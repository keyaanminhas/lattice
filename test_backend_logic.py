import sys
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "functions"))

if "firebase_admin" not in sys.modules:
    firebase_admin = types.ModuleType("firebase_admin")
    firestore_stub = types.SimpleNamespace(SERVER_TIMESTAMP=object())
    firebase_admin.firestore = firestore_stub
    firebase_admin.initialize_app = lambda *args, **kwargs: None
    sys.modules["firebase_admin"] = firebase_admin

if "firebase_functions" not in sys.modules:
    firebase_functions = types.ModuleType("firebase_functions")

    class FakeHttpsError(Exception):
        def __init__(self, code=None, message=""):
            super().__init__(message)
            self.code = code
            self.message = message

    class FakeFunctionsErrorCode:
        INVALID_ARGUMENT = "INVALID_ARGUMENT"
        FAILED_PRECONDITION = "FAILED_PRECONDITION"
        NOT_FOUND = "NOT_FOUND"
        INTERNAL = "INTERNAL"
        PERMISSION_DENIED = "PERMISSION_DENIED"
        UNAUTHENTICATED = "UNAUTHENTICATED"

    class FakeCallableRequest:
        def __init__(self, data=None, auth=None):
            self.data = data or {}
            self.auth = auth

    def fake_on_call(**_kwargs):
        def decorator(fn):
            return fn

        return decorator

    firebase_functions.https_fn = types.SimpleNamespace(
        HttpsError=FakeHttpsError,
        FunctionsErrorCode=FakeFunctionsErrorCode,
        CallableRequest=FakeCallableRequest,
        on_call=fake_on_call,
    )
    sys.modules["firebase_functions"] = firebase_functions

if "firebase_functions.options" not in sys.modules:
    firebase_functions_options = types.ModuleType("firebase_functions.options")
    firebase_functions_options.set_global_options = lambda **kwargs: None
    sys.modules["firebase_functions.options"] = firebase_functions_options

import main  # noqa: E402


class BackendLogicTests(unittest.TestCase):
    class FakeSnapshot:
        def __init__(self, payload=None, doc_id=None):
            self._payload = payload
            self._doc_id = doc_id
            self.exists = payload is not None

        def to_dict(self):
            return self._payload

        @property
        def id(self):
            if self._doc_id:
                return self._doc_id
            return self._payload.get("id") if self._payload else None

    class FakeDocumentRef:
        def __init__(self, store, doc_id):
            self.store = store
            self.doc_id = doc_id

        def get(self):
            return BackendLogicTests.FakeSnapshot(self.store.get(self.doc_id), self.doc_id)

        def set(self, payload, merge=False):
            if merge and self.doc_id in self.store:
                current = dict(self.store[self.doc_id])
                current.update(payload)
                self.store[self.doc_id] = current
            else:
                self.store[self.doc_id] = dict(payload)

        def update(self, payload):
            if self.doc_id not in self.store:
                raise KeyError(self.doc_id)
            current = dict(self.store[self.doc_id])
            current.update(payload)
            self.store[self.doc_id] = current

    class FakeCollection:
        def __init__(self, store, filters=None, row_limit=None):
            self.store = store
            self.filters = filters or []
            self.row_limit = row_limit

        def document(self, doc_id):
            return BackendLogicTests.FakeDocumentRef(self.store, doc_id)

        def where(self, field_name, operator, value):
            if operator != "==":
                raise ValueError("Only equality filters are supported by this fake.")
            return BackendLogicTests.FakeCollection(
                self.store,
                [*self.filters, (field_name, value)],
                self.row_limit,
            )

        def limit(self, row_limit):
            return BackendLogicTests.FakeCollection(self.store, self.filters, row_limit)

        def stream(self):
            rows = []
            for doc_id, payload in self.store.items():
                if all(payload.get(field_name) == value for field_name, value in self.filters):
                    rows.append(BackendLogicTests.FakeSnapshot(payload, doc_id))
            return rows[: self.row_limit] if self.row_limit else rows

    class FakeDb:
        def __init__(self):
            self.collections = {"graph_edges": {}}

        def collection(self, name):
            return BackendLogicTests.FakeCollection(self.collections.setdefault(name, {}))

    def test_extract_json_payload_handles_fenced_json(self):
        raw = """```json
        {"summary": "ok"}
        ```"""
        parsed = main._extract_json_payload(raw, dict)
        self.assertEqual(parsed["summary"], "ok")

    def test_extract_json_payload_handles_embedded_json(self):
        raw = 'Here is the result: {"summary": "ok", "autoTags": []} Thanks.'
        parsed = main._extract_json_payload(raw, dict)
        self.assertEqual(parsed["summary"], "ok")

    def test_build_recommendation_payload_preserves_review_state(self):
        existing = {"status": "Approved", "createdAt": "old-ts"}
        payload = main._build_recommendation_payload(
            existing,
            "Startup-to-Programme",
            "Startup",
            "comp-1",
            "Programme",
            "prog-1",
            "prog-1",
            82.5,
            "Explanation",
            ["Risk"],
        )
        self.assertEqual(payload["status"], "Approved")
        self.assertNotIn("createdAt", payload)

    def test_mentor_capacity_gate_uses_global_and_programme_limits(self):
        contributor = {
            "capacity": {
                "globalMaxStartupAssignments": 3,
                "perProgrammeStartupCapacity": 1,
            }
        }
        self.assertTrue(main._is_mentor_at_capacity(contributor, 3, 0))
        self.assertTrue(main._is_mentor_at_capacity(contributor, 2, 1))
        self.assertFalse(main._is_mentor_at_capacity(contributor, 2, 0))

    def test_relationship_transition_rules(self):
        self.assertTrue(main._can_transition_relationship("Active", "Completed"))
        self.assertFalse(main._can_transition_relationship("Completed", "Active"))

    def test_profile_normaliser_rejects_invalid_shape(self):
        with self.assertRaises(ValueError):
            main._normalise_profile_payload({"summary": "ok"})

    def test_insight_normaliser_requires_exactly_four_items(self):
        with self.assertRaises(ValueError):
            main._normalise_insights_payload([{"type": "gap"}])

    def test_graph_edge_document_id_is_deterministic(self):
        left = main._graph_edge_document_id("Contributor", "cont-1", "ATTACHED_TO", "Programme", "prog-2")
        right = main._graph_edge_document_id("Contributor", "cont-1", "ATTACHED_TO", "Programme", "prog-2")
        self.assertEqual(left, right)

    def test_upsert_graph_edge_is_idempotent(self):
        db = self.FakeDb()
        edge = main.upsert_graph_edge(
            db,
            "Contributor",
            "cont-1",
            "ATTACHED_TO",
            "Programme",
            "prog-2",
            programme_id="prog-2",
            metadata={"contributorType": "Mentor"},
        )
        main.upsert_graph_edge(
            db,
            "Contributor",
            "cont-1",
            "ATTACHED_TO",
            "Programme",
            "prog-2",
            programme_id="prog-2",
            metadata={"contributorType": "Mentor"},
        )
        self.assertEqual(len(db.collections["graph_edges"]), 1)
        self.assertEqual(edge["id"], "Contributor__cont-1__ATTACHED_TO__Programme__prog-2")

    def test_graph_explanation_normaliser_rejects_invalid_shape(self):
        with self.assertRaises(ValueError):
            main._normalise_graph_explanation_payload({"summary": "ok"})

    def test_startup_programme_graph_score_produces_breakdown(self):
        context = {
            "startup": {"supportNeeds": ["Clinical pilot access", "Regulatory guidance"]},
            "subgraph": {"counts": {"acceptedStartups": 3, "activeMentorRelationships": 2, "attachedMentors": 2, "attachedPartners": 1, "attachedInvestors": 1, "attachedServiceProviders": 1}},
            "resourceTokens": ["clinical", "pilot", "regulatory", "guidance"],
            "evidenceEdges": ["Contributor cont-1 ATTACHED_TO Programme prog-2"],
            "pastOutcomeSignals": ["Prior outcome signal"],
        }
        result = main.calculate_graph_score(context, "Startup-to-Programme")
        self.assertIn("resourceCoverage", result["breakdown"])
        self.assertGreater(result["graphScore"], 0)

    def test_startup_mentor_graph_score_hard_rejects_conflict(self):
        context = {
            "startup": {"id": "comp-1", "supportNeeds": ["Clinical pilot access"]},
            "mentor": {"id": "cont-1", "availability": "Available", "expertise": ["Clinical Pilots"]},
            "subgraph": {"pools": [], "acceptedApplications": [], "relationships": []},
            "conflictEdges": [{"id": "edge-1"}],
            "evidenceEdges": [],
            "pastOutcomeSignals": [],
        }
        result = main.calculate_graph_score(context, "Startup-to-Mentor")
        self.assertTrue(result["hardReject"])
        self.assertEqual(result["rejectReason"], "Explicit conflict edge detected.")

    def test_get_programme_graph_view_allows_active_startup_accounts(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "startup-uid": {
                        "status": "Active",
                        "roleKey": "startup",
                        "entityType": "company",
                        "entityId": "comp-1",
                    }
                },
                "programmes": {
                    "prog-1": {
                        "id": "prog-1",
                        "name": "Growth Programme",
                        "organisationId": "org-1",
                    }
                },
                "applications": {
                    "app-1": {
                        "id": "app-1",
                        "programmeId": "prog-1",
                        "startupId": "comp-1",
                        "status": "Accepted",
                    }
                },
                "companies": {
                    "comp-1": {
                        "id": "comp-1",
                        "name": "Startup One",
                        "supportNeeds": ["Pilot access"],
                    }
                },
                "programmeContributors": {},
                "contributors": {},
                "relationships": {},
                "outcomes": {},
                "roleAssignments": {},
                "graph_edges": {},
            }
        )
        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest(
                {"programmeId": "prog-1"},
                auth=types.SimpleNamespace(uid="startup-uid"),
            )
            response = main.get_programme_graph_view(request)
        finally:
            main._init_firebase = original_init

        self.assertEqual(response["programme"]["id"], "prog-1")
        self.assertEqual(response["counts"]["acceptedStartups"], 1)

    def test_get_programme_graph_view_keeps_admin_programme_scope_enforced(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "org-admin-uid": {
                        "status": "Active",
                        "roleKey": "organisation_admin",
                        "entityType": "organisation",
                        "entityId": "org-2",
                    }
                },
                "programmes": {
                    "prog-1": {
                        "id": "prog-1",
                        "name": "Growth Programme",
                        "organisationId": "org-1",
                    }
                },
                "roleAssignments": {},
            }
        )
        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest(
                {"programmeId": "prog-1"},
                auth=types.SimpleNamespace(uid="org-admin-uid"),
            )
            with self.assertRaises(main.https_fn.HttpsError) as raised:
                main.get_programme_graph_view(request)
        finally:
            main._init_firebase = original_init

        self.assertEqual(raised.exception.code, main.https_fn.FunctionsErrorCode.PERMISSION_DENIED)
        self.assertEqual(raised.exception.message, "You do not have access to this programme scope.")

    def test_submit_and_review_programme_application_flow(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "startup-uid": {
                        "status": "Active",
                        "roleKey": "startup",
                        "entityType": "company",
                        "entityId": "comp-1",
                    },
                    "programme-admin-uid": {
                        "status": "Active",
                        "roleKey": "programme_admin",
                        "entityType": "programme",
                        "entityId": "prog-1",
                    },
                },
                "roleAssignments": {
                    "ra-prog-1": {
                        "id": "ra-prog-1",
                        "uid": "programme-admin-uid",
                        "roleKey": "programme_admin",
                        "scopeType": "programme",
                        "scopeId": "prog-1",
                        "status": "active",
                    }
                },
                "companies": {"comp-1": {"id": "comp-1", "name": "Startup One"}},
                "programmes": {"prog-1": {"id": "prog-1", "name": "Growth", "status": "Open", "organisationId": "org-1"}},
                "applications": {},
                "relationships": {},
                "graph_edges": {},
            }
        )

        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            submit_request = main.https_fn.CallableRequest(
                {"programmeId": "prog-1"},
                auth=types.SimpleNamespace(uid="startup-uid"),
            )
            submit_response = main.submit_programme_application(submit_request)
            self.assertEqual(submit_response["application"]["status"], "Pending Admin Review")

            review_request = main.https_fn.CallableRequest(
                {"applicationId": "comp-1_prog-1", "decision": "Approved"},
                auth=types.SimpleNamespace(uid="programme-admin-uid"),
            )
            review_response = main.review_programme_application(review_request)
            self.assertEqual(review_response["status"], "Accepted")
            self.assertTrue(review_response["relationshipId"])
        finally:
            main._init_firebase = original_init

    def test_request_and_review_programme_connection_flow(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "contrib-uid": {
                        "status": "Active",
                        "roleKey": "mentor",
                        "entityType": "contributor",
                        "entityId": "cont-1",
                    },
                    "programme-admin-uid": {
                        "status": "Active",
                        "roleKey": "programme_admin",
                        "entityType": "programme",
                        "entityId": "prog-1",
                    },
                },
                "roleAssignments": {
                    "ra-prog-1": {
                        "id": "ra-prog-1",
                        "uid": "programme-admin-uid",
                        "roleKey": "programme_admin",
                        "scopeType": "programme",
                        "scopeId": "prog-1",
                        "status": "active",
                    }
                },
                "contributors": {"cont-1": {"id": "cont-1", "name": "Mentor One", "status": "Active"}},
                "programmes": {"prog-1": {"id": "prog-1", "name": "Growth", "status": "Open", "organisationId": "org-1"}},
                "programmeContributors": {},
                "relationships": {},
                "graph_edges": {},
            }
        )

        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest(
                {"programmeId": "prog-1"},
                auth=types.SimpleNamespace(uid="contrib-uid"),
            )
            create_response = main.request_programme_connection(request)
            self.assertEqual(create_response["connectionRequest"]["status"], "Pending Approval")

            review_request = main.https_fn.CallableRequest(
                {"requestId": "cont-1_prog-1", "decision": "Approved"},
                auth=types.SimpleNamespace(uid="programme-admin-uid"),
            )
            review_response = main.review_programme_connection_request(review_request)
            self.assertEqual(review_response["status"], "Approved")
            self.assertTrue(review_response["relationshipId"])
        finally:
            main._init_firebase = original_init

    def test_review_pending_registration_approves_account_and_role_assignment(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "admin-uid": {
                        "status": "Active",
                        "roleKey": "platform_admin",
                        "entityType": "platform",
                        "entityId": "platform-1",
                    },
                    "pending-org-uid": {
                        "status": "Pending",
                        "roleKey": "organisation_admin",
                        "entityType": "organisation",
                        "entityId": "org-9",
                    },
                },
                "organisations": {
                    "org-9": {
                        "id": "org-9",
                        "name": "Pending Org",
                        "status": "Pending",
                    }
                },
                "roleAssignments": {},
            }
        )

        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest(
                {"uid": "pending-org-uid", "decision": "Approved"},
                auth=types.SimpleNamespace(uid="admin-uid"),
            )
            response = main.review_pending_registration(request)
            self.assertEqual(response["status"], "Active")
            self.assertTrue(response["roleAssignmentId"])
            self.assertEqual(db.collections["accounts"]["pending-org-uid"]["status"], "Active")
            self.assertEqual(db.collections["organisations"]["org-9"]["status"], "Active")
        finally:
            main._init_firebase = original_init

    def test_create_programme_rejects_platform_admin(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "platform-uid": {
                        "status": "Active",
                        "roleKey": "platform_admin",
                        "entityType": "platform",
                        "entityId": "platform-1",
                    }
                },
                "organisations": {"org-1": {"id": "org-1", "name": "Org 1"}},
                "roleAssignments": {},
            }
        )
        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest(
                {
                    "name": "Programme A",
                    "type": "Accelerator",
                    "targetSectors": ["Fintech"],
                    "targetStages": ["Seed"],
                    "expectedOutcomes": ["Investor readiness"],
                    "eligibilityRules": ["Malaysia based"],
                    "organisationId": "org-1",
                },
                auth=types.SimpleNamespace(uid="platform-uid"),
            )
            with self.assertRaises(main.https_fn.HttpsError) as raised:
                main.create_programme(request)
        finally:
            main._init_firebase = original_init
        self.assertEqual(raised.exception.code, main.https_fn.FunctionsErrorCode.PERMISSION_DENIED)

    def test_submit_outcome_rejects_non_programme_admin(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "org-admin-uid": {
                        "status": "Active",
                        "roleKey": "organisation_admin",
                        "entityType": "organisation",
                        "entityId": "org-1",
                    }
                },
                "relationships": {
                    "rel-1": {
                        "id": "rel-1",
                        "programmeId": "prog-1",
                        "relationshipType": "Startup-to-Mentor",
                        "status": "Active",
                    }
                },
                "roleAssignments": {},
            }
        )
        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest(
                {
                    "relationshipId": "rel-1",
                    "outcomeAchieved": "Yes",
                    "startupRating": 4,
                    "contributorRating": 4,
                },
                auth=types.SimpleNamespace(uid="org-admin-uid"),
            )
            with self.assertRaises(main.https_fn.HttpsError) as raised:
                main.submit_outcome(request)
        finally:
            main._init_firebase = original_init
        self.assertEqual(raised.exception.code, main.https_fn.FunctionsErrorCode.PERMISSION_DENIED)

    def test_get_recommendation_queue_marks_out_of_scope_items_read_only(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "prog-admin-uid": {
                        "status": "Active",
                        "roleKey": "programme_admin",
                        "entityType": "programme",
                        "entityId": "prog-1",
                    }
                },
                "roleAssignments": {
                    "ra-prog-1": {
                        "id": "ra-prog-1",
                        "uid": "prog-admin-uid",
                        "roleKey": "programme_admin",
                        "scopeType": "programme",
                        "scopeId": "prog-1",
                        "status": "active",
                    }
                },
                "companies": {"comp-1": {"id": "comp-1", "name": "Startup One"}},
                "contributors": {"cont-1": {"id": "cont-1", "name": "Mentor One"}},
                "programmes": {
                    "prog-1": {"id": "prog-1", "name": "Prog One", "organisationId": "org-1"},
                    "prog-2": {"id": "prog-2", "name": "Prog Two", "organisationId": "org-1"},
                },
                "recommendations": {
                    "rec-1": {
                        "id": "rec-1",
                        "recommendationType": "Startup-to-Mentor",
                        "programmeId": "prog-1",
                        "sourceEntityId": "comp-1",
                        "targetEntityId": "cont-1",
                        "status": "Pending Approval",
                        "matchScore": 88,
                        "explanation": "Good fit",
                    },
                    "rec-2": {
                        "id": "rec-2",
                        "recommendationType": "Startup-to-Mentor",
                        "programmeId": "prog-2",
                        "sourceEntityId": "comp-1",
                        "targetEntityId": "cont-1",
                        "status": "Pending Approval",
                        "matchScore": 77,
                        "explanation": "Other programme",
                    },
                },
            }
        )

        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest({}, auth=types.SimpleNamespace(uid="prog-admin-uid"))
            response = main.get_recommendation_queue(request)
        finally:
            main._init_firebase = original_init

        self.assertEqual(len(response["items"]), 1)
        self.assertEqual(response["items"][0]["id"], "rec-1")
        self.assertTrue(response["items"][0]["canReview"])

    def test_get_dashboard_overview_returns_programme_admin_scoped_counts(self):
        db = self.FakeDb()
        db.collections.update(
            {
                "accounts": {
                    "prog-admin-uid": {
                        "status": "Active",
                        "roleKey": "programme_admin",
                        "entityType": "programme",
                        "entityId": "prog-1",
                    }
                },
                "roleAssignments": {
                    "ra-prog-1": {
                        "id": "ra-prog-1",
                        "uid": "prog-admin-uid",
                        "roleKey": "programme_admin",
                        "scopeType": "programme",
                        "scopeId": "prog-1",
                        "status": "active",
                    }
                },
                "companies": {"comp-1": {"id": "comp-1", "name": "Startup One", "verificationStatus": "Verified"}},
                "contributors": {"cont-1": {"id": "cont-1", "name": "Mentor One"}},
                "programmes": {"prog-1": {"id": "prog-1", "name": "Prog One", "status": "Open", "organisationId": "org-1"}},
                "applications": {"app-1": {"id": "app-1", "programmeId": "prog-1", "startupId": "comp-1", "status": "Pending Admin Review"}},
                "programmeContributors": {"pc-1": {"id": "pc-1", "programmeId": "prog-1", "status": "Pending Approval"}},
                "recommendations": {"rec-1": {"id": "rec-1", "recommendationType": "Startup-to-Mentor", "programmeId": "prog-1", "status": "Pending Approval", "sourceEntityId": "comp-1", "targetEntityId": "cont-1", "matchScore": 90}},
                "relationships": {"rel-1": {"id": "rel-1", "programmeId": "prog-1", "status": "Active"}},
                "outcomes": {},
                "organisations": {},
            }
        )

        original_init = main._init_firebase
        main._init_firebase = lambda: db
        try:
            request = main.https_fn.CallableRequest({}, auth=types.SimpleNamespace(uid="prog-admin-uid"))
            response = main.get_dashboard_overview(request)
        finally:
            main._init_firebase = original_init

        stats = response["stats"]
        self.assertEqual(stats["pendingApplications"], 1)
        self.assertEqual(stats["pendingConnectionRequests"], 1)
        self.assertEqual(stats["pendingRecommendations"], 1)
        self.assertEqual(len(response["recentQueue"]), 1)


if __name__ == "__main__":
    unittest.main()
