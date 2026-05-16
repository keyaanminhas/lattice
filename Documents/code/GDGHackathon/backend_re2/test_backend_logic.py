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
    firebase_admin.initialize_app = lambda: None
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

    class FakeCallableRequest:
        def __init__(self, data=None):
            self.data = data or {}

    def fake_on_call():
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
        def __init__(self, payload=None):
            self._payload = payload
            self.exists = payload is not None

        def to_dict(self):
            return self._payload

        @property
        def id(self):
            return self._payload.get("id") if self._payload else None

    class FakeDocumentRef:
        def __init__(self, store, doc_id):
            self.store = store
            self.doc_id = doc_id

        def get(self):
            return BackendLogicTests.FakeSnapshot(self.store.get(self.doc_id))

        def set(self, payload, merge=False):
            if merge and self.doc_id in self.store:
                current = dict(self.store[self.doc_id])
                current.update(payload)
                self.store[self.doc_id] = current
            else:
                self.store[self.doc_id] = dict(payload)

    class FakeCollection:
        def __init__(self, store):
            self.store = store

        def document(self, doc_id):
            return BackendLogicTests.FakeDocumentRef(self.store, doc_id)

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


if __name__ == "__main__":
    unittest.main()
