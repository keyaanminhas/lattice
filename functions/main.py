import json
import hashlib
import os
import re
import subprocess
import time
from datetime import datetime
from typing import Any, Callable

import numpy as np
from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn
from firebase_functions.options import set_global_options

set_global_options(max_instances=10)

MAX_RETRIES = 3
RETRY_DELAY = 10
STARTUP_PROGRAMME_THRESHOLD = 60.0
CONTRIBUTOR_PROGRAMME_THRESHOLD = 65.0
MENTOR_RECOMMENDATION_THRESHOLD = 70.0
MAX_RECOMMENDATIONS_PER_CALL = 5
VALID_DECISIONS = {"Approved", "Rejected"}
VALID_RELATIONSHIP_STATUSES = {"Approved", "Active", "Needs Review", "Completed", "Rejected", "Expired"}
VALID_OUTCOME_ACHIEVEMENTS = {"Yes", "Partial", "No"}
ACTIVE_MENTOR_RELATIONSHIP_STATUSES = {"Approved", "Active", "Needs Review"}
AI_INSIGHT_SEVERITIES = {"low", "medium", "high"}
ADMIN_ROLE_KEYS = {"platform_admin", "organisation_admin", "programme_admin"}
CONTRIBUTOR_ROLE_KEYS = {"mentor", "partner", "investor", "service_provider"}
PROFILE_REQUIRED_FIELDS = (
    "summary",
    "autoTags",
    "suggestedProgrammeTypes",
    "riskFlags",
    "profileCompletenessScore",
    "readinessScore",
)
INSIGHT_REQUIRED_FIELDS = ("type", "title", "description", "severity")
GRAPH_EXPLANATION_REQUIRED_FIELDS = ("summary", "edges", "pastOutcomeSignals", "riskFlags")
GRAPH_EDGE_TYPES = {
    "OWNS",
    "APPLIED_TO",
    "ACCEPTED_INTO",
    "ATTACHED_TO",
    "MATCHED_WITH",
    "PRODUCED_OUTCOME",
    "HAS_CONFLICT",
}
RELATIONSHIP_TRANSITIONS = {
    "Approved": {"Approved", "Active", "Expired", "Rejected"},
    "Active": {"Active", "Needs Review", "Completed", "Expired"},
    "Needs Review": {"Needs Review", "Active", "Completed", "Rejected", "Expired"},
    "Completed": {"Completed"},
    "Rejected": {"Rejected"},
    "Expired": {"Expired"},
}
RISK_PENALTIES = {
    "Startup team size is below the programme minimum.": 5.0,
    "Startup profile does not show a clear product or prototype.": 4.0,
    "Startup profile is not verified yet.": 3.0,
    "Sector fit is weak for this programme.": 8.0,
    "Startup stage is outside the programme's main focus.": 10.0,
    "Programme outcomes do not strongly cover the startup's top support needs.": 7.0,
    "Mentor availability is limited.": 5.0,
    "Investor stage focus does not strongly match the programme.": 7.0,
    "Contributor is currently unavailable.": 12.0,
    "Contributor is unavailable.": 12.0,
    "Mentor has no remaining availability.": 12.0,
    "Mentor has limited remaining availability.": 5.0,
    "Domain fit is weaker than ideal.": 7.0,
    "Possible conflict of interest detected.": 15.0,
    "Contributor is already attached to this programme.": 8.0,
    "Programme has limited active resource coverage for this startup's needs.": 6.0,
    "Programme has weak evidence for similar successful outcomes.": 5.0,
    "Programme currently has limited accepted startup demand.": 4.0,
    "This contributor does not clearly fill a current programme demand gap.": 7.0,
    "Programme already has strong coverage for this contributor profile.": 4.0,
    "No similar successful mentor outcomes were found in this programme context.": 5.0,
    "Explicit conflict edge detected.": 30.0,
}


def _sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    if isinstance(value, np.generic):
        return value.item()
    if isinstance(value, np.ndarray):
        return [_sanitize(item) for item in value.tolist()]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _init_firebase():
    try:
        if os.environ.get("USE_FIRESTORE_EMULATOR", "").lower() in {"1", "true", "yes"}:
            from google.auth.credentials import AnonymousCredentials
            from google.cloud import firestore as google_firestore

            return google_firestore.Client(
                project=os.environ.get("GOOGLE_CLOUD_PROJECT", "lattice-2026"),
                credentials=AnonymousCredentials(),
            )
        initialize_app()
    except ValueError:
        pass
    return firestore.client()


def _require_account(req: https_fn.CallableRequest, db):
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Sign in is required.",
        )

    account_doc = db.collection("accounts").document(req.auth.uid).get()
    if not account_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="This login is not linked to a Lattice account.",
        )

    account = {"uid": req.auth.uid, **account_doc.to_dict()}
    # Backward compatibility for legacy accounts that only had accountType.
    if not account.get("roleKey"):
        account["roleKey"] = _legacy_account_type_to_role_key(account.get("accountType"))
    if account.get("status") == "Suspended":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="This Lattice account is suspended.",
        )
    return account


def _is_admin_account(account: dict) -> bool:
    role_key = _clean_string(account.get("roleKey")).lower()
    return account.get("status") == "Active" and role_key in ADMIN_ROLE_KEYS


def _require_admin(req: https_fn.CallableRequest, db):
    account = _require_account(req, db)
    if not _is_admin_account(account):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin access is required.",
        )
    return account


def _has_role_assignment(
    db,
    uid: str,
    role_key: str,
    scope_type: str,
    scope_id: str,
    accepted_statuses: set[str] | None = None,
) -> bool:
    statuses = accepted_statuses or {"active"}
    query = (
        db.collection("roleAssignments")
        .where("uid", "==", uid)
        .where("roleKey", "==", role_key)
        .where("scopeType", "==", scope_type)
        .where("scopeId", "==", scope_id)
    )
    for doc in query.stream():
        data = doc.to_dict()
        if _clean_string(data.get("status")).lower() in statuses:
            return True
    return False


def _load_programme(db, programme_id: str) -> dict[str, Any]:
    programme_doc = _get_document_or_error(db, "programmes", programme_id, "Programme")
    return {"id": programme_doc.id, **programme_doc.to_dict()}


def _require_admin_scope_for_programme(db, account: dict, programme_id: str):
    role_key = _clean_string(account.get("roleKey")).lower()
    if role_key == "platform_admin":
        return

    programme = _load_programme(db, programme_id)
    if role_key == "programme_admin":
        if _has_role_assignment(db, account["uid"], "programme_admin", "programme", programme_id):
            return
    if role_key == "organisation_admin":
        organisation_id = _clean_string(programme.get("organisationId"))
        if organisation_id and _has_role_assignment(
            db, account["uid"], "organisation_admin", "organisation", organisation_id
        ):
            return

    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
        message="You do not have access to this programme scope.",
    )


def _require_startup_owner_or_admin(account: dict, startup_id: str):
    if _is_admin_account(account):
        return
    if (
        account.get("status") == "Active"
        and _clean_string(account.get("roleKey")).lower() == "startup"
        and account.get("entityType") == "company"
        and account.get("entityId") == startup_id
    ):
        return
    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
        message="You can only access your own startup profile.",
    )


def _clean_string(value, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value).strip() or fallback


def _clean_string_list(value) -> list[str]:
    if isinstance(value, list):
        return [_clean_string(item) for item in value if _clean_string(item)]
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    return []


def _clean_positive_int(value, fallback: int = 1) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if parsed > 0 else fallback


def _legacy_account_type_to_role_key(account_type: str | None) -> str:
    account_type = _clean_string(account_type).lower()
    if account_type in {"platformadmin", "platform_admin"}:
        return "platform_admin"
    if account_type in {"organisationadmin", "organisation_admin", "organisation"}:
        return "organisation_admin"
    if account_type in {"programmeadmin", "programme_admin"}:
        return "programme_admin"
    if account_type == "startup":
        return "startup"
    if account_type == "contributor":
        # Legacy contributor accounts are now split into sub-roles. Keep a safe default.
        return "mentor"
    return "startup"


def _normalise_role_key(role_key: str) -> str:
    key = _clean_string(role_key).lower().replace(" ", "_").replace("-", "_")
    mapping = {
        "organization_admin": "organisation_admin",
        "organisation": "organisation_admin",
        "platformadmin": "platform_admin",
        "programmeadmin": "programme_admin",
        "serviceprovider": "service_provider",
        "technical_provider": "service_provider",
        "technicalprovider": "service_provider",
        "company": "startup",
    }
    return mapping.get(key, key)


def _require_profile_name(profile: dict, *keys: str) -> str:
    for key in keys:
        value = _clean_string(profile.get(key))
        if value:
            return value
    raise https_fn.HttpsError(
        code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
        message="A profile name is required.",
    )


def _normalise_contributor_types(value) -> list[str]:
    allowed = ["Mentor", "Partner", "Investor", "Service Provider"]
    selected = [item for item in _clean_string_list(value) if item in allowed]
    return list(dict.fromkeys(selected)) or ["Mentor"]


def _registration_account(
    uid: str,
    account_type: str,
    role_key: str,
    entity_type: str,
    entity_id: str,
    display_name: str,
    email: str,
) -> dict:
    return {
        "accountType": account_type,
        "roleKey": role_key,
        "entityType": entity_type,
        "entityId": entity_id,
        "displayName": display_name,
        "email": email,
        "status": "Pending",
        "createdAt": firestore.SERVER_TIMESTAMP,
        "lastLoginAt": firestore.SERVER_TIMESTAMP,
    }


@https_fn.on_call()
def complete_entity_registration(req: https_fn.CallableRequest):
    db = _init_firebase()
    if not req.auth:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Sign in is required to complete registration.",
        )

    data = req.data if isinstance(req.data, dict) else {}
    account_type = _clean_string(data.get("accountType"))
    requested_role_key = _normalise_role_key(_clean_string(data.get("requestedRoleKey")))
    profile = data.get("profile") if isinstance(data.get("profile"), dict) else {}
    if account_type not in ["startup", "contributor", "organisation"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="accountType must be startup, contributor, or organisation.",
        )

    uid = req.auth.uid
    auth_token = getattr(req.auth, "token", {}) or {}
    email = _clean_string(auth_token.get("email") or profile.get("email"))
    account_ref = db.collection("accounts").document(uid)
    if account_ref.get().exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="This login already has a Lattice account.",
        )

    if account_type == "startup":
        role_key = "startup"
        entity_type = "company"
        entity_id = f"comp-{uid}"
        display_name = _require_profile_name(profile, "name", "startupName", "companyName")
        sector = _clean_string(profile.get("sector") or profile.get("industry"))
        entity_payload = {
            "id": entity_id,
            "authUid": uid,
            "organisationId": f"org-startup-{uid}",
            "name": display_name,
            "companyName": display_name,
            "sector": sector,
            "industry": sector,
            "stage": _clean_string(profile.get("stage"), "MVP"),
            "country": _clean_string(profile.get("country"), "Malaysia"),
            "teamSize": _clean_positive_int(profile.get("teamSize"), 1),
            "problemStatement": _clean_string(profile.get("problemStatement")),
            "productDescription": _clean_string(profile.get("productDescription")),
            "supportNeeds": _clean_string_list(profile.get("supportNeeds")),
            "traction": _clean_string(profile.get("traction")),
            "currentChallenges": _clean_string_list(profile.get("currentChallenges")),
            "verificationStatus": "Pending",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        entity_ref = db.collection("companies").document(entity_id)
    elif account_type == "contributor":
        entity_type = "contributor"
        entity_id = f"cont-{uid}"
        display_name = _require_profile_name(profile, "name", "contributorName")
        contributor_types = _normalise_contributor_types(profile.get("contributorTypes"))
        contributor_primary_type = contributor_types[0] if contributor_types else "Mentor"
        role_from_type = {
            "Mentor": "mentor",
            "Partner": "partner",
            "Investor": "investor",
            "Service Provider": "service_provider",
        }.get(contributor_primary_type, "mentor")
        role_key = requested_role_key if requested_role_key in CONTRIBUTOR_ROLE_KEYS else role_from_type
        entity_payload = {
            "id": entity_id,
            "authUid": uid,
            "organisationId": f"org-contrib-{uid}",
            "name": display_name,
            "contributorTypes": contributor_types,
            "expertise": _clean_string_list(profile.get("expertise")),
            "supportedStages": _clean_string_list(profile.get("supportedStages")),
            "investmentThesis": _clean_string_list(profile.get("investmentThesis")),
            "ticketSize": _clean_string(profile.get("ticketSize")),
            "countryCoverage": _clean_string_list(profile.get("countryCoverage")) or [_clean_string(profile.get("country"), "Malaysia")],
            "canSupport": _clean_string_list(profile.get("canSupport")),
            "capacity": {
                "globalMaxProgrammes": _clean_positive_int(profile.get("globalMaxProgrammes"), 1),
                "globalMaxStartupAssignments": _clean_positive_int(profile.get("globalMaxStartupAssignments"), 3),
                "perProgrammeStartupCapacity": _clean_positive_int(profile.get("perProgrammeStartupCapacity"), 1),
            },
            "availability": _clean_string(profile.get("availability"), "Available"),
            "status": "Pending",
            "rating": 0,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        entity_ref = db.collection("contributors").document(entity_id)
    else:
        role_key = "organisation_admin"
        entity_type = "organisation"
        entity_id = f"org-{uid}"
        display_name = _require_profile_name(profile, "name", "organisationName")
        entity_payload = {
            "id": entity_id,
            "authUid": uid,
            "name": display_name,
            "organisationType": _clean_string(profile.get("organisationType"), "Programme Owner"),
            "roles": _clean_string_list(profile.get("roles")) or ["Programme Owner"],
            "country": _clean_string(profile.get("country"), "Malaysia"),
            "focusAreas": _clean_string_list(profile.get("focusAreas")),
            "status": "Pending",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
        entity_ref = db.collection("organisations").document(entity_id)

    if entity_ref.get().exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="This entity registration already exists.",
        )

    account_payload = _registration_account(uid, account_type, role_key, entity_type, entity_id, display_name, email)
    batch = db.batch()
    batch.set(entity_ref, entity_payload)
    batch.set(account_ref, account_payload)
    batch.commit()

    return {
        "account": {
            "accountType": account_type,
            "roleKey": role_key,
            "entityType": entity_type,
            "entityId": entity_id,
            "displayName": display_name,
            "email": email,
            "status": "Pending",
        },
        "entity": {
            "id": entity_id,
            "status": "Pending",
        },
    }



def _get_genai_client():
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GEMINI_API_KEY is not configured.",
        )
    return genai.Client(api_key=api_key)


def _has_gemini_api_key() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY"))


def _running_in_firestore_emulator() -> bool:
    return os.environ.get("USE_FIRESTORE_EMULATOR", "").lower() in {"1", "true", "yes"} or bool(
        os.environ.get("FIRESTORE_EMULATOR_HOST")
    )


def _gemini_rest_post(model: str, method: str, payload: dict[str, Any]) -> dict[str, Any]:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GEMINI_API_KEY is not configured.",
        )

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:{method}"
    process = subprocess.run(
        [
            "curl",
            "--silent",
            "--show-error",
            "--fail",
            "--request",
            "POST",
            url,
            "--header",
            f"x-goog-api-key: {api_key}",
            "--header",
            "Content-Type: application/json",
            "--data-raw",
            json.dumps(payload),
        ],
        capture_output=True,
        text=True,
        timeout=90,
        check=False,
    )
    if process.returncode != 0:
        stderr = (process.stderr or process.stdout or "").strip()
        raise RuntimeError(f"Gemini REST {method} failed: {stderr}")
    return json.loads(process.stdout or "{}")


def _gemini_rest_generate_text(model: str, prompt: str) -> str:
    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt,
                    }
                ]
            }
        ]
    }
    response = _gemini_rest_post(model, "generateContent", payload)
    candidates = response.get("candidates") or []
    if not candidates:
        return ""
    content = candidates[0].get("content") or {}
    parts = content.get("parts") or []
    texts = [part.get("text", "") for part in parts if isinstance(part, dict)]
    return "".join(texts).strip()


def _gemini_rest_embed_text(model: str, text: str) -> list[float]:
    payload = {
        "content": {
            "parts": [
                {
                    "text": text,
                }
            ]
        }
    }
    response = _gemini_rest_post(model, "embedContent", payload)
    embedding = response.get("embedding") or {}
    values = embedding.get("values") or []
    return [float(value) for value in values]


def _retryable_model_call(fn: Callable[[], Any]):
    for attempt in range(MAX_RETRIES):
        try:
            return fn()
        except https_fn.HttpsError:
            raise
        except Exception as exc:  # pragma: no cover - runtime integration path
            if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                time.sleep(RETRY_DELAY * (2**attempt))
                continue
            raise
    return fn()


def _require_data(req: https_fn.CallableRequest) -> dict[str, Any]:
    if not isinstance(req.data, dict):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="Request data must be an object.",
        )
    return req.data


def _require_string(data: dict[str, Any], field_name: str) -> str:
    value = data.get(field_name)
    if not isinstance(value, str) or not value.strip():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"{field_name} is required.",
        )
    return value.strip()


def _require_choice(data: dict[str, Any], field_name: str, choices: set[str]) -> str:
    value = _require_string(data, field_name)
    if value not in choices:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"{field_name} must be one of {sorted(choices)}.",
        )
    return value


def _require_rating(data: dict[str, Any], field_name: str) -> float:
    value = data.get(field_name)
    try:
        rating = float(value)
    except (TypeError, ValueError):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"{field_name} must be a number between 0 and 5.",
        ) from None

    if rating < 0 or rating > 5:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"{field_name} must be a number between 0 and 5.",
        )
    return round(rating, 2)


def _optional_text(data: dict[str, Any], field_name: str) -> str:
    value = data.get(field_name, "")
    if value is None:
        return ""
    if not isinstance(value, str):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"{field_name} must be a string.",
        )
    return value.strip()


def _firestore_query(collection_ref, filters: dict[str, Any]):
    query = collection_ref
    for field_name, value in filters.items():
        query = query.where(field_name, "==", value)
    return query


def _get_document_or_error(db, collection_name: str, doc_id: str, label: str):
    doc = db.collection(collection_name).document(doc_id).get()
    if not doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message=f"{label} not found.",
        )
    return doc


def _find_one_by_fields(db, collection_name: str, filters: dict[str, Any]):
    query = _firestore_query(db.collection(collection_name), filters).limit(1)
    docs = list(query.stream())
    if not docs:
        return None
    doc = docs[0]
    return {"id": doc.id, **doc.to_dict()}


def _list_by_fields(db, collection_name: str, filters: dict[str, Any]) -> list[dict[str, Any]]:
    query = _firestore_query(db.collection(collection_name), filters)
    return [{"id": doc.id, **doc.to_dict()} for doc in query.stream()]


def _safe_id_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9_-]+", "-", value.strip())


def _recommendation_document_id(
    recommendation_type: str,
    source_entity_id: str,
    target_entity_id: str,
    programme_id: str,
) -> str:
    return "__".join(
        [
            _safe_id_part(recommendation_type),
            _safe_id_part(source_entity_id),
            _safe_id_part(target_entity_id),
            _safe_id_part(programme_id),
        ]
    )


def _relationship_document_id(
    relationship_type: str,
    source_entity_id: str,
    target_entity_id: str,
    programme_id: str,
) -> str:
    return "__".join(
        [
            _safe_id_part(relationship_type),
            _safe_id_part(source_entity_id),
            _safe_id_part(target_entity_id),
            _safe_id_part(programme_id),
        ]
    )


def _graph_edge_document_id(
    source_type: str,
    source_id: str,
    edge_type: str,
    target_type: str,
    target_id: str,
) -> str:
    return "__".join(
        [
            _safe_id_part(source_type),
            _safe_id_part(source_id),
            _safe_id_part(edge_type),
            _safe_id_part(target_type),
            _safe_id_part(target_id),
        ]
    )


def _edge_evidence_text(edge: dict[str, Any]) -> str:
    return (
        f"{edge.get('sourceType', 'Entity')} {edge.get('sourceId', '')} "
        f"{edge.get('edgeType', 'LINKED_TO')} "
        f"{edge.get('targetType', 'Entity')} {edge.get('targetId', '')}"
    ).strip()


def _generate_text(model: str, prompt: str) -> str:
    if not _has_gemini_api_key():
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GEMINI_API_KEY is not configured.",
        )

    def _call():
        return _gemini_rest_generate_text(model, prompt)

    return _retryable_model_call(_call)


def _strip_code_fences(raw: str) -> str:
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```[a-zA-Z0-9_-]*\s*", "", cleaned, count=1)
        cleaned = re.sub(r"\s*```$", "", cleaned, count=1)
    return cleaned.strip()


def _extract_json_payload(raw: str, expected_type: type) -> Any:
    cleaned = _strip_code_fences(raw)
    decoder = json.JSONDecoder()
    candidate_positions = [0] + [idx for idx, char in enumerate(cleaned) if char in "[{"]
    seen = set()

    for position in candidate_positions:
        if position in seen:
            continue
        seen.add(position)
        try:
            payload, _ = decoder.raw_decode(cleaned[position:])
        except json.JSONDecodeError:
            continue
        if isinstance(payload, expected_type):
            return payload

    raise ValueError("AI response did not contain the expected JSON payload.")


def _coerce_string_list(value: Any, field_name: str) -> list[str]:
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise ValueError(f"{field_name} must be a list of strings.")
    return [item.strip() for item in value if item.strip()]


def _coerce_number(value: Any, field_name: str, minimum: float, maximum: float) -> float | int:
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"{field_name} must be numeric.") from None
    if number < minimum or number > maximum:
        raise ValueError(f"{field_name} must be between {minimum} and {maximum}.")
    return int(number) if number.is_integer() else round(number, 2)


def _normalise_profile_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Profile payload must be an object.")
    missing = [field for field in PROFILE_REQUIRED_FIELDS if field not in payload]
    if missing:
        raise ValueError(f"Profile payload is missing fields: {', '.join(missing)}.")

    summary = payload["summary"]
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("summary must be a non-empty string.")

    return {
        "summary": summary.strip(),
        "autoTags": _coerce_string_list(payload["autoTags"], "autoTags"),
        "suggestedProgrammeTypes": _coerce_string_list(
            payload["suggestedProgrammeTypes"], "suggestedProgrammeTypes"
        ),
        "riskFlags": _coerce_string_list(payload["riskFlags"], "riskFlags"),
        "profileCompletenessScore": _coerce_number(
            payload["profileCompletenessScore"], "profileCompletenessScore", 0, 100
        ),
        "readinessScore": _coerce_number(payload["readinessScore"], "readinessScore", 0, 10),
    }


def _normalise_insights_payload(payload: Any) -> list[dict[str, str]]:
    if not isinstance(payload, list) or len(payload) != 4:
        raise ValueError("Insights payload must be an array with exactly 4 objects.")

    insights = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Insight {index} must be an object.")
        missing = [field for field in INSIGHT_REQUIRED_FIELDS if field not in item]
        if missing:
            raise ValueError(f"Insight {index} is missing fields: {', '.join(missing)}.")

        normalised = {}
        for field_name in INSIGHT_REQUIRED_FIELDS:
            value = item[field_name]
            if not isinstance(value, str) or not value.strip():
                raise ValueError(f"Insight {index} field {field_name} must be a non-empty string.")
            normalised[field_name] = value.strip()

        severity = normalised["severity"].lower()
        if severity not in AI_INSIGHT_SEVERITIES:
            raise ValueError(f"Insight {index} severity must be one of {sorted(AI_INSIGHT_SEVERITIES)}.")
        normalised["severity"] = severity
        insights.append(normalised)

    return insights


def _normalise_graph_explanation_payload(payload: Any) -> dict[str, Any]:
    if not isinstance(payload, dict):
        raise ValueError("Graph explanation payload must be an object.")
    missing = [field for field in GRAPH_EXPLANATION_REQUIRED_FIELDS if field not in payload]
    if missing:
        raise ValueError(f"Graph explanation payload is missing fields: {', '.join(missing)}.")

    summary = payload["summary"]
    if not isinstance(summary, str) or not summary.strip():
        raise ValueError("summary must be a non-empty string.")

    return {
        "summary": summary.strip(),
        "edges": _coerce_string_list(payload["edges"], "edges")[:5],
        "pastOutcomeSignals": _coerce_string_list(payload["pastOutcomeSignals"], "pastOutcomeSignals")[:3],
        "riskFlags": _coerce_string_list(payload["riskFlags"], "riskFlags")[:4],
    }


def _generate_json_payload(model: str, prompt: str, expected_type: type, normaliser: Callable[[Any], Any]):
    raw = _generate_text(model, prompt)
    try:
        extracted = _extract_json_payload(raw, expected_type)
        return normaliser(extracted)
    except ValueError as exc:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"AI returned invalid structured output: {exc}",
        ) from exc


def get_embedding(text: str) -> list[float]:
    if not _has_gemini_api_key():
        tokens = re.findall(r"[a-z0-9]+", (text or "").lower())
        if not tokens:
            return [0.0] * 64
        vector = [0.0] * 64
        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
            index = int(digest[:8], 16) % len(vector)
            vector[index] += 1.0
        norm = float(np.linalg.norm(vector))
        if norm == 0:
            return vector
        return [round(value / norm, 6) for value in vector]

    def _call():
        return _gemini_rest_embed_text("gemini-embedding-2", text)

    return _retryable_model_call(_call)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))


def _tokenize(value: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (value or "").lower()))


def _list_tokens(values: list[str]) -> set[str]:
    tokens = set()
    for value in values or []:
        tokens |= _tokenize(value)
    return tokens


def _normalise_type(contributor: dict) -> str:
    types = contributor.get("contributorTypes") or []
    if types:
        return types[0]
    return contributor.get("type", "Contributor")


def _build_startup_text(startup: dict) -> str:
    return (
        f"Startup: {startup.get('name', startup.get('companyName', ''))}. "
        f"Sector: {startup.get('industry', startup.get('sector', ''))}. "
        f"Stage: {startup.get('stage', '')}. "
        f"Country: {startup.get('country', '')}. "
        f"Needs: {', '.join(startup.get('supportNeeds', []))}. "
        f"Problem: {startup.get('problemStatement', '')}. "
        f"Product: {startup.get('productDescription', '')}. "
        f"Traction: {startup.get('traction', '')}."
    )


def _build_programme_text(programme: dict) -> str:
    return (
        f"Programme: {programme.get('name', '')}. "
        f"Type: {programme.get('type', '')}. "
        f"Target sectors: {', '.join(programme.get('targetSectors', []))}. "
        f"Target stages: {', '.join(programme.get('targetStages', []))}. "
        f"Country or region: {programme.get('country', programme.get('region', ''))}. "
        f"Expected outcomes: {', '.join(programme.get('expectedOutcomes', []))}. "
        f"Eligibility: {' '.join(programme.get('eligibilityRules', [])) if isinstance(programme.get('eligibilityRules'), list) else programme.get('eligibilityRules', '')}."
    )


def _build_contributor_text(contributor: dict) -> str:
    return (
        f"Contributor: {contributor.get('name', '')}. "
        f"Types: {', '.join(contributor.get('contributorTypes', [contributor.get('type', 'Contributor')]))}. "
        f"Expertise: {', '.join(contributor.get('expertise', []))}. "
        f"Supported stages: {', '.join(contributor.get('supportedStages', contributor.get('stages', [])))}. "
        f"Country coverage: {', '.join(contributor.get('countryCoverage', []))}. "
        f"Support model: {', '.join(contributor.get('canSupport', []))}. "
        f"Investment thesis: {', '.join(contributor.get('investmentThesis', []))}. "
        f"Ticket size: {contributor.get('ticketSize', '')}."
    )


def _ensure_embedding(collection_name: str, doc_id: str, data: dict, text_builder) -> list[float]:
    vector = data.get("embeddingVector")
    if vector:
        return vector

    db = _init_firebase()
    vector = get_embedding(text_builder(data))
    db.collection(collection_name).document(doc_id).update({"embeddingVector": vector})
    return vector


def _overlap_score(source_values: list[str], target_values: list[str], max_points: int) -> float:
    left = _list_tokens(source_values)
    right = _list_tokens(target_values)
    if not left or not right:
        return 0.0
    overlap = len(left & right) / max(1, len(left))
    return round(overlap * max_points, 2)


def _country_fit(value: str, coverage: list[str], max_points: int) -> float:
    country = (value or "").lower()
    coverage_values = [item.lower() for item in coverage or [] if item]
    if not country or not coverage_values:
        return 0.0
    if country in coverage_values or "global" in coverage_values:
        return float(max_points)
    joined = " ".join(coverage_values)
    if country in joined:
        return round(max_points * 0.7, 2)
    if "asean" in joined or "southeast asia" in joined:
        return round(max_points * 0.6, 2)
    return 0.0


def _eligibility_score(startup: dict, programme: dict) -> tuple[float, list[str]]:
    score = 15.0
    risks = []
    rules = programme.get("eligibilityRules", [])
    if isinstance(rules, str):
        rules = [rules]
    rules_text = " ".join(rules).lower()

    team_size = startup.get("teamSize", 0)
    if ("team of at least 2" in rules_text or "team of 2" in rules_text) and team_size < 2:
        score -= 10
        risks.append("Startup team size is below the programme minimum.")

    has_product = bool(startup.get("productDescription"))
    if ("prototype" in rules_text or "mvp" in rules_text) and not has_product:
        score -= 7
        risks.append("Startup profile does not show a clear product or prototype.")

    if startup.get("verificationStatus") != "Verified":
        score -= 5
        risks.append("Startup profile is not verified yet.")

    return max(score, 0.0), risks


def _similarity_score(similarity: float) -> float:
    return round(max(0.0, min(1.0, similarity)) * 100.0, 2)


def _graph_blended_total(rule_score: float, semantic_score: float, graph_score: float) -> float:
    return round(
        max(0.0, min(100.0, rule_score * 0.60 + semantic_score * 0.20 + graph_score * 0.20)),
        2,
    )


def _apply_risk_penalties(score: float, risks: list[str]) -> tuple[float, list[str]]:
    unique_risks = list(dict.fromkeys(risks))
    penalty = sum(RISK_PENALTIES.get(risk, 0.0) for risk in unique_risks)
    adjusted = round(max(0.0, min(100.0, score - penalty)), 2)
    return adjusted, unique_risks


def _startup_programme_rule_score(startup: dict, programme: dict) -> tuple[float, list[str], dict[str, float]]:
    sector_fit = 25.0 if startup.get("industry") in programme.get("targetSectors", []) else _overlap_score(
        [startup.get("industry", "")], programme.get("targetSectors", []), 25
    )
    stage_fit = 15.0 if startup.get("stage") in programme.get("targetStages", []) else 0.0
    need_fit = _overlap_score(startup.get("supportNeeds", []), programme.get("expectedOutcomes", []), 25)
    region_fit = _country_fit(
        startup.get("country", ""),
        [programme.get("country", ""), programme.get("region", "")],
        10,
    )
    eligibility_fit, risks = _eligibility_score(startup, programme)
    total = sector_fit + stage_fit + need_fit + eligibility_fit + region_fit

    if sector_fit < 12:
        risks.append("Sector fit is weak for this programme.")
    if stage_fit == 0:
        risks.append("Startup stage is outside the programme's main focus.")
    if need_fit < 10:
        risks.append("Programme outcomes do not strongly cover the startup's top support needs.")

    adjusted, risks = _apply_risk_penalties(total, risks)
    return adjusted, risks, {
        "sectorFit": round(sector_fit, 2),
        "stageFit": round(stage_fit, 2),
        "needFit": round(need_fit, 2),
        "eligibilityFit": round(eligibility_fit, 2),
        "regionFit": round(region_fit, 2),
    }


def _contributor_programme_rule_score(contributor: dict, programme: dict) -> tuple[float, list[str], str, dict[str, float]]:
    contributor_type = _normalise_type(contributor)
    programme_sectors = programme.get("targetSectors", [])
    programme_stages = programme.get("targetStages", [])
    programme_country = programme.get("country", programme.get("region", ""))
    risks = []

    if contributor_type == "Mentor":
        expertise_fit = _overlap_score(contributor.get("expertise", []), programme_sectors, 30)
        sector_fit = _overlap_score(contributor.get("expertise", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("supportedStages", []), programme_stages, 15)
        capacity_fit = 15.0 if contributor.get("availability") == "Available" else 8.0 if contributor.get("availability") == "Limited" else 0.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        outcome_fit = min(float(contributor.get("rating", 0)) * 2, 10.0)
        total = expertise_fit + sector_fit + stage_fit + capacity_fit + region_fit + outcome_fit
        if capacity_fit < 10:
            risks.append("Mentor availability is limited.")
        breakdown = {
            "expertiseFit": round(expertise_fit, 2),
            "sectorFit": round(sector_fit, 2),
            "stageFit": round(stage_fit, 2),
            "capacityFit": round(capacity_fit, 2),
            "regionFit": round(region_fit, 2),
            "outcomeFit": round(outcome_fit, 2),
        }
    elif contributor_type == "Investor":
        thesis_fit = _overlap_score(contributor.get("investmentThesis", []), programme_sectors, 30)
        sector_fit = _overlap_score(contributor.get("investmentThesis", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("stages", contributor.get("supportedStages", [])), programme_stages, 20)
        ticket_fit = 10.0 if contributor.get("ticketSize") else 4.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        strategic_fit = _overlap_score(programme.get("expectedOutcomes", []), contributor.get("investmentThesis", []), 10)
        total = thesis_fit + sector_fit + stage_fit + ticket_fit + region_fit + strategic_fit
        if stage_fit < 10:
            risks.append("Investor stage focus does not strongly match the programme.")
        breakdown = {
            "thesisFit": round(thesis_fit, 2),
            "sectorFit": round(sector_fit, 2),
            "stageFit": round(stage_fit, 2),
            "ticketFit": round(ticket_fit, 2),
            "regionFit": round(region_fit, 2),
            "strategicFit": round(strategic_fit, 2),
        }
    elif contributor_type == "Partner":
        strategic_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 30)
        sector_fit = _overlap_score(contributor.get("expertise", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("supportedStages", []), programme_stages, 20)
        activation_fit = 10.0 if contributor.get("availability") == "Available" else 5.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        value_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 10)
        total = strategic_fit + sector_fit + stage_fit + activation_fit + region_fit + value_fit
        breakdown = {
            "strategicFit": round(strategic_fit, 2),
            "sectorFit": round(sector_fit, 2),
            "stageFit": round(stage_fit, 2),
            "activationFit": round(activation_fit, 2),
            "regionFit": round(region_fit, 2),
            "valueFit": round(value_fit, 2),
        }
    else:
        service_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 30)
        sector_fit = _overlap_score(contributor.get("expertise", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("supportedStages", []), programme_stages, 15)
        availability_fit = 15.0 if contributor.get("availability") == "Available" else 8.0 if contributor.get("availability") == "Limited" else 0.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        value_fit = min(float(contributor.get("rating", 0)) * 2, 10.0)
        total = service_fit + sector_fit + stage_fit + availability_fit + region_fit + value_fit
        if availability_fit == 0:
            risks.append("Contributor is currently unavailable.")
        breakdown = {
            "serviceFit": round(service_fit, 2),
            "sectorFit": round(sector_fit, 2),
            "stageFit": round(stage_fit, 2),
            "availabilityFit": round(availability_fit, 2),
            "regionFit": round(region_fit, 2),
            "valueFit": round(value_fit, 2),
        }

    if contributor.get("availability") == "Unavailable":
        risks.append("Contributor is unavailable.")

    total, risks = _apply_risk_penalties(total, risks)
    return total, risks, contributor_type, breakdown


def _startup_mentor_rule_score(startup: dict, contributor: dict, programme: dict) -> tuple[float, list[str], dict[str, float]]:
    needs_fit = _overlap_score(startup.get("supportNeeds", []), contributor.get("expertise", []), 30)
    domain_fit = _overlap_score([startup.get("industry", "")], contributor.get("expertise", []), 20)
    stage_fit = _overlap_score([startup.get("stage", "")], contributor.get("supportedStages", []), 15)
    region_fit = _country_fit(startup.get("country", ""), contributor.get("countryCoverage", []), 10)
    capacity_fit = 15.0 if contributor.get("availability") == "Available" else 7.0 if contributor.get("availability") == "Limited" else 0.0
    programme_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 10)
    total = needs_fit + domain_fit + stage_fit + region_fit + capacity_fit + programme_fit
    risks = []

    if capacity_fit == 0:
        risks.append("Mentor has no remaining availability.")
    elif capacity_fit < 10:
        risks.append("Mentor has limited remaining availability.")
    if domain_fit < 10:
        risks.append("Domain fit is weaker than ideal.")
    if contributor.get("conflictAreas"):
        startup_name = startup.get("name", "").lower()
        if any(area.lower() in startup_name for area in contributor.get("conflictAreas", [])):
            risks.append("Possible conflict of interest detected.")

    adjusted, risks = _apply_risk_penalties(total, risks)
    return adjusted, risks, {
        "needsFit": round(needs_fit, 2),
        "domainFit": round(domain_fit, 2),
        "stageFit": round(stage_fit, 2),
        "regionFit": round(region_fit, 2),
        "capacityFit": round(capacity_fit, 2),
        "programmeFit": round(programme_fit, 2),
    }


def _capacity_value(contributor: dict, field_name: str) -> int | None:
    capacity = contributor.get("capacity")
    if isinstance(capacity, dict):
        value = capacity.get(field_name)
    elif isinstance(capacity, (int, float)):
        value = capacity
    else:
        value = None
    if value in [None, ""]:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _is_mentor_at_capacity(
    contributor: dict,
    active_assignment_count: int,
    programme_assignment_count: int,
) -> bool:
    global_limit = _capacity_value(contributor, "globalMaxStartupAssignments")
    per_programme_limit = _capacity_value(contributor, "perProgrammeStartupCapacity")
    if global_limit is not None and active_assignment_count >= global_limit:
        return True
    if per_programme_limit is not None and programme_assignment_count >= per_programme_limit:
        return True
    return False


def _has_programme_capacity(contributor: dict, approved_programme_count: int) -> bool:
    global_limit = _capacity_value(contributor, "globalMaxProgrammes")
    if global_limit is None:
        return True
    return approved_programme_count < global_limit


def _count_active_mentor_relationships(db, contributor_id: str, programme_id: str | None = None) -> int:
    filters = {"relationshipType": "Startup-to-Mentor", "targetEntityId": contributor_id}
    if programme_id:
        filters["programmeId"] = programme_id
    relationships = _list_by_fields(db, "relationships", filters)
    return len([item for item in relationships if item.get("status") in ACTIVE_MENTOR_RELATIONSHIP_STATUSES])


def _count_approved_programmes(db, contributor_id: str) -> int:
    assignments = _list_by_fields(
        db,
        "programmeContributors",
        {"contributorId": contributor_id, "status": "Approved"},
    )
    return len(assignments)


def upsert_graph_edge(
    db,
    source_type: str,
    source_id: str,
    edge_type: str,
    target_type: str,
    target_id: str,
    programme_id: str | None = None,
    status: str = "active",
    weight: float = 1.0,
    confidence: float = 1.0,
    created_from: str | None = None,
    created_from_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if edge_type not in GRAPH_EDGE_TYPES:
        raise ValueError(f"Unsupported edge type: {edge_type}")

    doc_id = _graph_edge_document_id(source_type, source_id, edge_type, target_type, target_id)
    ref = db.collection("graph_edges").document(doc_id)
    existing = ref.get()
    payload = {
        "id": doc_id,
        "sourceType": source_type,
        "sourceId": source_id,
        "edgeType": edge_type,
        "targetType": target_type,
        "targetId": target_id,
        "programmeId": programme_id,
        "status": status,
        "weight": round(float(weight), 2),
        "confidence": round(float(confidence), 2),
        "createdFrom": created_from or "",
        "createdFromId": created_from_id or "",
        "metadata": metadata or {},
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if existing.exists:
        ref.set(payload, merge=True)
    else:
        ref.set({**payload, "createdAt": firestore.SERVER_TIMESTAMP}, merge=False)
    return {**payload, "createdAt": existing.to_dict().get("createdAt") if existing.exists else None}


def list_graph_edges(
    db,
    programme_id: str | None = None,
    source_id: str | None = None,
    target_id: str | None = None,
    edge_type: str | None = None,
) -> list[dict[str, Any]]:
    filters = {}
    if programme_id:
        filters["programmeId"] = programme_id
    if source_id:
        filters["sourceId"] = source_id
    if target_id:
        filters["targetId"] = target_id
    if edge_type:
        filters["edgeType"] = edge_type
    return _list_by_fields(db, "graph_edges", filters)


def _lookup_documents_by_ids(db, collection_name: str, doc_ids: list[str]) -> list[dict[str, Any]]:
    results = []
    for doc_id in dict.fromkeys([item for item in doc_ids if item]):
        doc = db.collection(collection_name).document(doc_id).get()
        if doc.exists:
            results.append({"id": doc.id, **doc.to_dict()})
    return results


def _positive_outcome_signal(db, relationship: dict[str, Any], outcome: dict[str, Any]) -> str:
    relationship_type = relationship.get("relationshipType", "Relationship")
    outcome_quality = outcome.get("relationshipQuality", "Unknown")
    achieved = outcome.get("outcomeAchieved", "Unknown")
    expected = relationship.get("expectedOutcome", "outcomes")
    return (
        f"{relationship_type} in programme {relationship.get('programmeId', '')} "
        f"achieved {achieved} with {outcome_quality.lower()} quality around {expected.lower()}."
    )


def get_programme_subgraph(db, programme_id: str) -> dict[str, Any]:
    programme_doc = _get_document_or_error(db, "programmes", programme_id, "Programme")
    programme = {"id": programme_doc.id, **programme_doc.to_dict()}
    applications = _list_by_fields(db, "applications", {"programmeId": programme_id})
    accepted_applications = [item for item in applications if item.get("status") == "Accepted"]
    startup_ids = [item.get("startupId") for item in accepted_applications]
    startups = _lookup_documents_by_ids(db, "companies", startup_ids)

    pools = _list_by_fields(db, "programmeContributors", {"programmeId": programme_id, "status": "Approved"})
    contributors = _lookup_documents_by_ids(db, "contributors", [item.get("contributorId") for item in pools])
    contributor_map = {item["id"]: item for item in contributors}

    relationships = _list_by_fields(db, "relationships", {"programmeId": programme_id})
    outcomes = []
    for relationship in relationships:
        outcome = _find_one_by_fields(db, "outcomes", {"relationshipId": relationship["id"]})
        if outcome:
            outcomes.append(outcome)

    edges = list_graph_edges(db, programme_id=programme_id)
    outcomes_by_relationship = {item["relationshipId"]: item for item in outcomes}
    outcome_signals = [
        _positive_outcome_signal(db, relationship, outcomes_by_relationship[relationship["id"]])
        for relationship in relationships
        if relationship["id"] in outcomes_by_relationship
        and outcomes_by_relationship[relationship["id"]].get("reusePattern")
    ]

    mentors = []
    partners = []
    investors = []
    service_providers = []
    for pool in pools:
        contributor = contributor_map.get(pool.get("contributorId"))
        if not contributor:
            continue
        contributor_type = pool.get("contributorType")
        if contributor_type == "Mentor":
            mentors.append(contributor)
        elif contributor_type == "Partner":
            partners.append(contributor)
        elif contributor_type == "Investor":
            investors.append(contributor)
        else:
            service_providers.append(contributor)

    counts = {
        "acceptedStartups": len(startups),
        "attachedMentors": len(mentors),
        "attachedPartners": len(partners),
        "attachedInvestors": len(investors),
        "attachedServiceProviders": len(service_providers),
        "activeMentorRelationships": len(
            [
                item
                for item in relationships
                if item.get("relationshipType") == "Startup-to-Mentor"
                and item.get("status") in ACTIVE_MENTOR_RELATIONSHIP_STATUSES
            ]
        ),
        "completedOutcomes": len([item for item in outcomes if item.get("outcomeAchieved") == "Yes"]),
        "graphEdges": len(edges),
    }

    return {
        "programme": programme,
        "applications": applications,
        "acceptedApplications": accepted_applications,
        "startups": startups,
        "pools": pools,
        "contributors": contributors,
        "mentors": mentors,
        "partners": partners,
        "investors": investors,
        "serviceProviders": service_providers,
        "relationships": relationships,
        "outcomes": outcomes,
        "edges": edges,
        "positiveOutcomeSignals": outcome_signals[:5],
        "counts": counts,
    }


def get_startup_programme_graph_context(db, startup_id: str, programme_id: str) -> dict[str, Any]:
    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
    startup = {"id": startup_doc.id, **startup_doc.to_dict()}
    subgraph = get_programme_subgraph(db, programme_id)
    contributor_capabilities = []
    for contributor in subgraph["contributors"]:
        contributor_capabilities.extend(
            contributor.get("expertise")
            or contributor.get("investmentThesis")
            or contributor.get("canSupport")
            or []
        )

    evidence_edges = [
        _edge_evidence_text(edge)
        for edge in subgraph["edges"]
        if edge.get("edgeType") in {"OWNS", "ATTACHED_TO", "ACCEPTED_INTO"}
    ]
    return {
        "startup": startup,
        "programme": subgraph["programme"],
        "subgraph": subgraph,
        "resourceTokens": sorted(_list_tokens(contributor_capabilities)),
        "evidenceEdges": evidence_edges[:5],
        "pastOutcomeSignals": subgraph["positiveOutcomeSignals"][:3],
    }


def get_contributor_programme_graph_context(db, contributor_id: str, programme_id: str) -> dict[str, Any]:
    contributor_doc = _get_document_or_error(db, "contributors", contributor_id, "Contributor")
    contributor = {"id": contributor_doc.id, **contributor_doc.to_dict()}
    subgraph = get_programme_subgraph(db, programme_id)
    accepted_startups = subgraph["startups"]
    demand_tokens = _list_tokens([need for startup in accepted_startups for need in startup.get("supportNeeds", [])])
    contributor_tokens = _list_tokens(
        contributor.get("expertise")
        or contributor.get("investmentThesis")
        or contributor.get("canSupport")
        or []
    )
    already_attached = any(item.get("contributorId") == contributor_id for item in subgraph["pools"])
    approved_programme_count = _count_approved_programmes(db, contributor_id)
    evidence_edges = [_edge_evidence_text(edge) for edge in subgraph["edges"] if edge.get("edgeType") == "ATTACHED_TO"]
    return {
        "contributor": contributor,
        "programme": subgraph["programme"],
        "subgraph": subgraph,
        "demandTokens": sorted(demand_tokens),
        "contributorTokens": sorted(contributor_tokens),
        "alreadyAttached": already_attached,
        "approvedProgrammeCount": approved_programme_count,
        "evidenceEdges": evidence_edges[:5],
        "pastOutcomeSignals": subgraph["positiveOutcomeSignals"][:3],
    }


def get_startup_mentor_graph_context(db, startup_id: str, mentor_id: str, programme_id: str) -> dict[str, Any]:
    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
    mentor_doc = _get_document_or_error(db, "contributors", mentor_id, "Contributor")
    startup = {"id": startup_doc.id, **startup_doc.to_dict()}
    mentor = {"id": mentor_doc.id, **mentor_doc.to_dict()}
    subgraph = get_programme_subgraph(db, programme_id)
    mentor_relationships = [
        item
        for item in subgraph["relationships"]
        if item.get("relationshipType") == "Startup-to-Mentor" and item.get("targetEntityId") == mentor_id
    ]
    mentor_outcomes = []
    mentor_pairs = []
    for relationship in mentor_relationships:
        outcome = _find_one_by_fields(db, "outcomes", {"relationshipId": relationship["id"]})
        if outcome:
            mentor_outcomes.append(outcome)
            mentor_pairs.append((relationship, outcome))

    conflict_edges = [
        edge
        for edge in list_graph_edges(db, edge_type="HAS_CONFLICT")
        if {
            edge.get("sourceId"),
            edge.get("targetId"),
        }
        == {startup_id, mentor_id}
    ]
    evidence_edges = [
        _edge_evidence_text(edge)
        for edge in subgraph["edges"]
        if (
            edge.get("sourceId") in {startup_id, mentor_id}
            or edge.get("targetId") in {startup_id, mentor_id}
            or edge.get("edgeType") == "ATTACHED_TO"
        )
    ]
    past_outcomes = [
        _positive_outcome_signal(db, relationship, outcome)
        for relationship, outcome in mentor_pairs
        if outcome.get("reusePattern")
    ]
    return {
        "startup": startup,
        "mentor": mentor,
        "programme": subgraph["programme"],
        "subgraph": subgraph,
        "mentorRelationships": mentor_relationships,
        "mentorOutcomes": mentor_outcomes,
        "conflictEdges": conflict_edges,
        "evidenceEdges": evidence_edges[:5],
        "pastOutcomeSignals": past_outcomes[:3] or subgraph["positiveOutcomeSignals"][:3],
    }


def calculate_graph_score(context: dict[str, Any], relationship_type: str) -> dict[str, Any]:
    risks = []
    hard_reject = False
    reject_reason = None
    breakdown: dict[str, float] = {}
    evidence_edges = list(context.get("evidenceEdges", []))
    past_outcome_signals = list(context.get("pastOutcomeSignals", []))

    if relationship_type == "Startup-to-Programme":
        startup = context["startup"]
        subgraph = context["subgraph"]
        support_need_tokens = _list_tokens(startup.get("supportNeeds", []))
        resource_tokens = set(context.get("resourceTokens", []))
        resource_overlap = len(support_need_tokens & resource_tokens)
        resource_coverage = min(30.0, resource_overlap * 8.0)
        prior_success = min(30.0, len(past_outcome_signals) * 10.0)
        programme_health = min(20.0, subgraph["counts"]["acceptedStartups"] * 2.0 + subgraph["counts"]["activeMentorRelationships"] * 3.0)
        pool_depth = min(
            20.0,
            subgraph["counts"]["attachedMentors"] * 4.0
            + subgraph["counts"]["attachedPartners"] * 2.0
            + subgraph["counts"]["attachedInvestors"] * 2.0
            + subgraph["counts"]["attachedServiceProviders"] * 2.0,
        )
        if resource_coverage < 12:
            risks.append("Programme has limited active resource coverage for this startup's needs.")
        if prior_success < 10:
            risks.append("Programme has weak evidence for similar successful outcomes.")
        breakdown = {
            "resourceCoverage": round(resource_coverage, 2),
            "priorSuccess": round(prior_success, 2),
            "programmeHealth": round(programme_health, 2),
            "poolDepth": round(pool_depth, 2),
        }
    elif relationship_type.endswith("-to-Programme"):
        contributor = context["contributor"]
        subgraph = context["subgraph"]
        if context.get("alreadyAttached"):
            risks.append("Contributor is already attached to this programme.")
        demand_tokens = set(context.get("demandTokens", []))
        contributor_tokens = set(context.get("contributorTokens", []))
        fills_gap = min(35.0, len(demand_tokens & contributor_tokens) * 8.0)
        accepted_startup_demand = min(20.0, len(subgraph["startups"]) * 4.0)
        type_capacity = 0
        contributor_type = _normalise_type(contributor)
        if contributor_type == "Mentor":
            max_programmes = _capacity_value(contributor, "globalMaxProgrammes")
            approved_programmes = context.get("approvedProgrammeCount", 0)
            type_capacity = 20.0 if max_programmes is None else max(0.0, 20.0 - approved_programmes * 4.0)
        else:
            type_capacity = 20.0 if contributor.get("availability") == "Available" else 10.0
        existing_coverage = max(
            0.0,
            25.0
            - len(
                [
                    pool
                    for pool in subgraph["pools"]
                    if pool.get("contributorType") == contributor_type
                ]
            )
            * 5.0,
        )
        if accepted_startup_demand < 8:
            risks.append("Programme currently has limited accepted startup demand.")
        if fills_gap < 10:
            risks.append("This contributor does not clearly fill a current programme demand gap.")
        if existing_coverage < 8:
            risks.append("Programme already has strong coverage for this contributor profile.")
        breakdown = {
            "fillsGap": round(fills_gap, 2),
            "acceptedStartupDemand": round(accepted_startup_demand, 2),
            "capacityRemaining": round(type_capacity, 2),
            "existingCoverageNeed": round(existing_coverage, 2),
        }
    else:
        if context.get("conflictEdges"):
            hard_reject = True
            reject_reason = "Explicit conflict edge detected."
            risks.append(reject_reason)
        subgraph = context["subgraph"]
        mentor = context["mentor"]
        mentor_attached = any(
            pool.get("contributorId") == mentor["id"] and pool.get("contributorType") == "Mentor"
            for pool in subgraph["pools"]
        )
        startup_accepted = any(item.get("startupId") == context["startup"]["id"] for item in subgraph["acceptedApplications"])
        capacity_available = 15.0 if mentor.get("availability") == "Available" else 8.0 if mentor.get("availability") == "Limited" else 0.0
        expertise_overlap = min(
            25.0,
            len(_list_tokens(context["startup"].get("supportNeeds", [])) & _list_tokens(mentor.get("expertise", []))) * 8.0,
        )
        prior_success = min(20.0, len(past_outcome_signals) * 10.0)
        programme_history = min(20.0, len(subgraph["relationships"]) * 1.5)
        breakdown = {
            "acceptedStartupContext": 20.0 if startup_accepted else 0.0,
            "attachedToProgramme": 20.0 if mentor_attached else 0.0,
            "capacityAvailable": round(capacity_available, 2),
            "expertiseOverlap": round(expertise_overlap, 2),
            "priorSuccess": round(prior_success, 2),
            "programmeHistory": round(programme_history, 2),
        }
        if prior_success < 10:
            risks.append("No similar successful mentor outcomes were found in this programme context.")

    graph_score = round(min(100.0, sum(breakdown.values())), 2)
    graph_score, risks = _apply_risk_penalties(graph_score, risks)
    return {
        "graphScore": graph_score,
        "breakdown": breakdown,
        "hardReject": hard_reject,
        "rejectReason": reject_reason,
        "riskFlags": risks,
        "evidenceEdges": evidence_edges[:5],
        "pastOutcomeSignals": past_outcome_signals[:3],
    }


def _programme_graph_gaps(subgraph: dict[str, Any]) -> list[dict[str, str]]:
    need_counts: dict[str, int] = {}
    for startup in subgraph["startups"]:
        for need in startup.get("supportNeeds", []):
            need_counts[need] = need_counts.get(need, 0) + 1

    expertise_counts: dict[str, int] = {}
    for contributor in subgraph["contributors"]:
        for expertise in contributor.get("expertise", []) or contributor.get("investmentThesis", []):
            expertise_counts[expertise] = expertise_counts.get(expertise, 0) + 1

    gaps = []
    for need, demand in sorted(need_counts.items(), key=lambda item: item[1], reverse=True)[:5]:
        coverage = sum(count for expertise, count in expertise_counts.items() if need.lower() in expertise.lower())
        if coverage >= demand:
            continue
        severity = "high" if demand - coverage >= 2 else "medium"
        gaps.append(
            {
                "type": "capacity_gap",
                "severity": severity,
                "summary": f"{demand} startups need {need}, but only {coverage} attached contributors clearly cover it.",
                "suggestedAction": f"Attach more contributors with {need} coverage to {subgraph['programme']['name']}.",
            }
        )

    if not gaps:
        gaps.append(
            {
                "type": "coverage_ok",
                "severity": "low",
                "summary": "Current accepted startup demand is broadly covered by the programme actor pool.",
                "suggestedAction": "Maintain the current mix and watch for new demand as more startups are accepted.",
            }
        )
    return gaps[:4]


def _build_graph_explanation_fallback(context: str, payload: dict) -> dict[str, Any]:
    score_breakdown = payload.get("scoreBreakdown", {})
    startup = payload.get("startup", {}).get("name")
    programme = payload.get("programme", {}).get("name")
    contributor = payload.get("target", {}).get("name") or payload.get("contributor", {}).get("name")

    if startup and programme and contributor:
        summary = f"{contributor} is a strong fit for {startup} in {programme} because the graph context supports the relationship."
    elif startup and programme:
        summary = f"{startup} is a strong fit for {programme} because the programme graph shows relevant coverage and outcomes."
    elif contributor and programme:
        summary = f"{contributor} is a strong fit for {programme} because the programme graph shows live demand for that profile."
    else:
        summary = f"{context} is supported by the current graph context and score breakdown."

    if isinstance(score_breakdown.get("finalScore"), (int, float)):
        summary = f"{summary} Final score: {round(score_breakdown['finalScore'])}%."

    graph_context = payload.get("graphContext", {})
    return {
        "summary": summary,
        "edges": list(graph_context.get("evidenceEdges", []))[:5],
        "pastOutcomeSignals": list(graph_context.get("pastOutcomeSignals", []))[:3],
        "riskFlags": list(payload.get("riskFlags", []))[:4],
    }


def _generate_graph_explanation(context: str, payload: dict[str, Any]) -> dict[str, Any]:
    if _running_in_firestore_emulator() or not _has_gemini_api_key():
        return _build_graph_explanation_fallback(context, payload)

    prompt = f"""
    You are the AI Relationship Engine for a programme-first startup ecosystem platform called Lattice.
    Context: {context}
    Data: {json.dumps(_sanitize(payload))}

    Return ONLY a JSON object with exactly these fields:
    - summary: string
    - edges: array of short evidence strings grounded in the provided graph context
    - pastOutcomeSignals: array of short evidence strings from prior outcomes
    - riskFlags: array of short governance or capacity risks

    Requirements:
    - Keep summary to 1-2 sentences.
    - Do not invent entities or edges not present in the payload.
    - Prefer graph evidence and prior outcomes over generic claims.
    - If risk flags are light, still include the most important watchout.
    """

    _get_genai_client()
    try:
        return _generate_json_payload(
            "gemini-3.1-flash-lite",
            prompt,
            dict,
            _normalise_graph_explanation_payload,
        )
    except Exception:
        return _build_graph_explanation_fallback(context, payload)


def _build_recommendation_payload(
    existing: dict[str, Any] | None,
    recommendation_type: str,
    source_entity_type: str,
    source_entity_id: str,
    target_entity_type: str,
    target_entity_id: str,
    programme_id: str,
    match_score: float,
    explanation: str,
    risk_flags: list[str],
    score_breakdown: dict[str, Any] | None = None,
    graph_evidence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    payload = {
        "recommendationType": recommendation_type,
        "sourceEntityType": source_entity_type,
        "sourceEntityId": source_entity_id,
        "targetEntityType": target_entity_type,
        "targetEntityId": target_entity_id,
        "programmeId": programme_id,
        "matchScore": match_score,
        "explanation": explanation,
        "riskFlags": risk_flags,
        "scoreBreakdown": score_breakdown or {},
        "graphEvidence": graph_evidence or {},
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if existing:
        payload["status"] = existing.get("status", "Pending Approval")
    else:
        payload["status"] = "Pending Approval"
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    return payload


def _upsert_recommendation(
    db,
    recommendation_type: str,
    source_entity_type: str,
    source_entity_id: str,
    target_entity_type: str,
    target_entity_id: str,
    programme_id: str,
    match_score: float,
    explanation: str,
    risk_flags: list[str],
    score_breakdown: dict[str, Any] | None = None,
    graph_evidence: dict[str, Any] | None = None,
):
    lookup = {
        "recommendationType": recommendation_type,
        "sourceEntityId": source_entity_id,
        "targetEntityId": target_entity_id,
        "programmeId": programme_id,
    }
    existing = _find_one_by_fields(db, "recommendations", lookup)
    payload = _build_recommendation_payload(
        existing,
        recommendation_type,
        source_entity_type,
        source_entity_id,
        target_entity_type,
        target_entity_id,
        programme_id,
        match_score,
        explanation,
        risk_flags,
        score_breakdown,
        graph_evidence,
    )

    doc_id = existing["id"] if existing else _recommendation_document_id(
        recommendation_type, source_entity_id, target_entity_id, programme_id
    )
    ref = db.collection("recommendations").document(doc_id)
    document_payload = {"id": doc_id, **payload}
    ref.set(document_payload, merge=bool(existing))

    response = {"id": doc_id, **{key: value for key, value in payload.items() if key not in {"createdAt", "updatedAt"}}}
    if existing and "createdAt" in existing:
        response["createdAt"] = existing["createdAt"]
    return _sanitize(response)


def _find_existing_relationship(
    db,
    relationship_type: str,
    source_entity_id: str,
    target_entity_id: str,
    programme_id: str,
):
    return _find_one_by_fields(
        db,
        "relationships",
        {
            "relationshipType": relationship_type,
            "sourceEntityId": source_entity_id,
            "targetEntityId": target_entity_id,
            "programmeId": programme_id,
        },
    )


def _create_relationship(db, recommendation: dict, expected_outcome: str) -> str:
    relationship_type = recommendation["recommendationType"]
    existing = _find_existing_relationship(
        db,
        relationship_type,
        recommendation["sourceEntityId"],
        recommendation["targetEntityId"],
        recommendation["programmeId"],
    )
    if existing:
        return existing["id"]

    doc_id = _relationship_document_id(
        relationship_type,
        recommendation["sourceEntityId"],
        recommendation["targetEntityId"],
        recommendation["programmeId"],
    )
    ref = db.collection("relationships").document(doc_id)
    payload = {
        "id": doc_id,
        "relationshipType": relationship_type,
        "sourceEntityId": recommendation["sourceEntityId"],
        "targetEntityId": recommendation["targetEntityId"],
        "programmeId": recommendation["programmeId"],
        "createdFromRecommendationId": recommendation["id"],
        "matchScore": recommendation["matchScore"],
        "status": "Active",
        "expectedOutcome": expected_outcome,
        "startDate": datetime.utcnow().date().isoformat(),
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    ref.set(payload, merge=False)
    return doc_id


def _materialize_graph_edges_for_approval(db, recommendation: dict, relationship_id: str | None = None):
    rec_type = recommendation["recommendationType"]
    programme_id = recommendation["programmeId"]

    if rec_type == "Startup-to-Programme":
        upsert_graph_edge(
            db,
            "Startup",
            recommendation["sourceEntityId"],
            "APPLIED_TO",
            "Programme",
            recommendation["targetEntityId"],
            programme_id=programme_id,
            created_from="recommendations",
            created_from_id=recommendation["id"],
        )
        upsert_graph_edge(
            db,
            "Startup",
            recommendation["sourceEntityId"],
            "ACCEPTED_INTO",
            "Programme",
            recommendation["targetEntityId"],
            programme_id=programme_id,
            created_from="recommendations",
            created_from_id=recommendation["id"],
        )
    elif rec_type.endswith("-to-Programme"):
        upsert_graph_edge(
            db,
            "Contributor",
            recommendation["sourceEntityId"],
            "ATTACHED_TO",
            "Programme",
            recommendation["targetEntityId"],
            programme_id=programme_id,
            created_from="recommendations",
            created_from_id=recommendation["id"],
            metadata={"contributorType": rec_type.replace("-to-Programme", "")},
        )
    elif rec_type == "Startup-to-Mentor":
        upsert_graph_edge(
            db,
            "Startup",
            recommendation["sourceEntityId"],
            "MATCHED_WITH",
            "Contributor",
            recommendation["targetEntityId"],
            programme_id=programme_id,
            created_from="recommendations",
            created_from_id=recommendation["id"],
        )

    if relationship_id:
        relationship_doc = db.collection("relationships").document(relationship_id).get()
        if relationship_doc.exists and relationship_doc.to_dict().get("relationshipType") == "Startup-to-Programme":
            upsert_graph_edge(
                db,
                "Relationship",
                relationship_id,
                "MATCHED_WITH",
                "Programme",
                programme_id,
                programme_id=programme_id,
                created_from="relationships",
                created_from_id=relationship_id,
            )


def _get_accepted_application(db, startup_id: str, programme_id: str):
    return _find_one_by_fields(
        db,
        "applications",
        {"startupId": startup_id, "programmeId": programme_id, "status": "Accepted"},
    )


def _upsert_application_from_recommendation(db, recommendation: dict) -> str:
    doc_id = f"{recommendation['sourceEntityId']}_{recommendation['programmeId']}"
    ref = db.collection("applications").document(doc_id)
    existing = ref.get()
    payload = {
        "id": doc_id,
        "startupId": recommendation["sourceEntityId"],
        "programmeId": recommendation["programmeId"],
        "aiFitScore": recommendation["matchScore"],
        "aiExplanation": recommendation["explanation"],
        "status": "Accepted",
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if not existing.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    ref.set(payload, merge=existing.exists)
    return doc_id


def _upsert_programme_contributor_from_recommendation(db, recommendation: dict) -> str:
    contributor_id = recommendation["sourceEntityId"]
    doc_id = f"{contributor_id}_{recommendation['programmeId']}"
    ref = db.collection("programmeContributors").document(doc_id)
    existing = ref.get()
    payload = {
        "id": doc_id,
        "programmeId": recommendation["programmeId"],
        "contributorId": contributor_id,
        "contributorType": recommendation["recommendationType"].replace("-to-Programme", ""),
        "status": "Approved",
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }
    if not existing.exists:
        payload["createdAt"] = firestore.SERVER_TIMESTAMP
    ref.set(payload, merge=existing.exists)
    return doc_id


def _can_transition_relationship(current_status: str, new_status: str) -> bool:
    return new_status in RELATIONSHIP_TRANSITIONS.get(current_status, set())


@https_fn.on_call()
def recommend_programmes_for_startup(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    data = _require_data(req)
    startup_id = _require_string(data, "startupId")
    _require_startup_owner_or_admin(account, startup_id)
    print(f"recommend_programmes_for_startup:start startupId={startup_id}")

    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
    startup = startup_doc.to_dict()
    startup_embedding = _ensure_embedding("companies", startup_id, startup, _build_startup_text)

    candidates = []
    for programme_doc in db.collection("programmes").stream():
        programme = programme_doc.to_dict()
        if programme.get("status") not in ["Open", "Active"]:
            continue

        programme_embedding = _ensure_embedding("programmes", programme_doc.id, programme, _build_programme_text)
        similarity = cosine_similarity(startup_embedding, programme_embedding)
        semantic_score = _similarity_score(similarity)
        rule_score, rule_risks, rule_breakdown = _startup_programme_rule_score(startup, programme)
        graph_context = get_startup_programme_graph_context(db, startup_id, programme_doc.id)
        graph_result = calculate_graph_score(graph_context, "Startup-to-Programme")
        score = _graph_blended_total(rule_score, semantic_score, graph_result["graphScore"])
        if score < STARTUP_PROGRAMME_THRESHOLD:
            continue

        candidates.append(
            {
                "programme": programme,
                "programmeId": programme_doc.id,
                "score": score,
                "ruleScore": rule_score,
                "semanticScore": semantic_score,
                "graphScore": graph_result["graphScore"],
                "graphContext": graph_context,
                "ruleRisks": rule_risks,
                "graphRisks": graph_result["riskFlags"],
                "ruleBreakdown": rule_breakdown,
                "graphBreakdown": graph_result["breakdown"],
            }
        )

    print(f"recommend_programmes_for_startup:candidates={len(candidates)}")

    recommendations = []
    for candidate in sorted(candidates, key=lambda item: item["score"], reverse=True)[:MAX_RECOMMENDATIONS_PER_CALL]:
        print(f"recommend_programmes_for_startup:explaining programmeId={candidate['programmeId']} score={candidate['score']}")
        score_breakdown = {
            "ruleScore": candidate["ruleScore"],
            "semanticScore": candidate["semanticScore"],
            "graphScore": candidate["graphScore"],
            "finalScore": candidate["score"],
            "ruleBreakdown": candidate["ruleBreakdown"],
            "graphBreakdown": candidate["graphBreakdown"],
        }
        combined_risks = list(dict.fromkeys(candidate["ruleRisks"] + candidate["graphRisks"]))
        explanation_payload = _generate_graph_explanation(
            "Startup-to-Programme recommendation",
            {
                "startup": startup,
                "programme": candidate["programme"],
                "scoreBreakdown": score_breakdown,
                "graphContext": candidate["graphContext"],
                "riskFlags": combined_risks,
            },
        )
        combined_risks = list(dict.fromkeys(combined_risks + explanation_payload["riskFlags"]))
        graph_evidence = {
            "summary": explanation_payload["summary"],
            "edges": explanation_payload["edges"],
            "pastOutcomeSignals": explanation_payload["pastOutcomeSignals"],
            "riskFlags": combined_risks,
        }
        recommendation = _upsert_recommendation(
            db,
            "Startup-to-Programme",
            "Startup",
            startup_id,
            "Programme",
            candidate["programmeId"],
            candidate["programmeId"],
            candidate["score"],
            explanation_payload["summary"],
            combined_risks,
            score_breakdown,
            graph_evidence,
        )
        recommendations.append(recommendation)
        print(f"recommend_programmes_for_startup:upserted programmeId={candidate['programmeId']}")

    print(f"recommend_programmes_for_startup:done recommendations={len(recommendations)}")
    return {"recommendations": recommendations}


@https_fn.on_call()
def recommend_contributor_to_programmes(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    data = _require_data(req)
    contributor_id = _require_string(data, "contributorId")

    contributor_doc = _get_document_or_error(db, "contributors", contributor_id, "Contributor")
    contributor = contributor_doc.to_dict()
    if contributor.get("availability") == "Unavailable":
        return {"recommendations": []}

    approved_programme_count = _count_approved_programmes(db, contributor_id)
    if not _has_programme_capacity(contributor, approved_programme_count):
        return {"recommendations": []}

    contributor_embedding = _ensure_embedding("contributors", contributor_id, contributor, _build_contributor_text)

    recommendations = []
    for programme_doc in db.collection("programmes").stream():
        programme = programme_doc.to_dict()
        if programme.get("status") not in ["Open", "Active"]:
            continue

        programme_embedding = _ensure_embedding("programmes", programme_doc.id, programme, _build_programme_text)
        similarity = cosine_similarity(contributor_embedding, programme_embedding)
        semantic_score = _similarity_score(similarity)
        rule_score, rule_risks, contributor_type, rule_breakdown = _contributor_programme_rule_score(contributor, programme)
        graph_context = get_contributor_programme_graph_context(db, contributor_id, programme_doc.id)
        graph_result = calculate_graph_score(graph_context, f"{contributor_type}-to-Programme")
        score = _graph_blended_total(rule_score, semantic_score, graph_result["graphScore"])
        if score < CONTRIBUTOR_PROGRAMME_THRESHOLD:
            continue

        score_breakdown = {
            "ruleScore": rule_score,
            "semanticScore": semantic_score,
            "graphScore": graph_result["graphScore"],
            "finalScore": score,
            "ruleBreakdown": rule_breakdown,
            "graphBreakdown": graph_result["breakdown"],
        }
        combined_risks = list(dict.fromkeys(rule_risks + graph_result["riskFlags"]))
        explanation_payload = _generate_graph_explanation(
            "Contributor-to-Programme recommendation",
            {
                "contributor": contributor,
                "target": programme,
                "programme": programme,
                "recommendationType": f"{contributor_type}-to-Programme",
                "scoreBreakdown": score_breakdown,
                "graphContext": graph_context,
                "riskFlags": combined_risks,
            },
        )
        combined_risks = list(dict.fromkeys(combined_risks + explanation_payload["riskFlags"]))
        graph_evidence = {
            "summary": explanation_payload["summary"],
            "edges": explanation_payload["edges"],
            "pastOutcomeSignals": explanation_payload["pastOutcomeSignals"],
            "riskFlags": combined_risks,
        }
        recommendation = _upsert_recommendation(
            db,
            f"{contributor_type}-to-Programme",
            "Contributor",
            contributor_id,
            "Programme",
            programme_doc.id,
            programme_doc.id,
            score,
            explanation_payload["summary"],
            combined_risks,
            score_breakdown,
            graph_evidence,
        )
        recommendations.append(recommendation)

    return {"recommendations": recommendations}


@https_fn.on_call()
def recommend_mentor_for_startup(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    data = _require_data(req)
    startup_id = _require_string(data, "startupId")
    _require_startup_owner_or_admin(account, startup_id)
    programme_id = _require_string(data, "programmeId")
    if _is_admin_account(account):
        _require_admin_scope_for_programme(db, account, programme_id)

    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
    programme_doc = _get_document_or_error(db, "programmes", programme_id, "Programme")

    accepted_application = _get_accepted_application(db, startup_id, programme_id)
    if not accepted_application:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Startup must be accepted into the programme before mentor matching.",
        )

    startup = startup_doc.to_dict()
    programme = programme_doc.to_dict()
    startup_embedding = _ensure_embedding("companies", startup_id, startup, _build_startup_text)

    recommendations = []
    approved_pools = _list_by_fields(db, "programmeContributors", {"programmeId": programme_id, "status": "Approved"})
    for pool in approved_pools:
        contributor_id = pool.get("contributorId")
        contributor_doc = db.collection("contributors").document(contributor_id).get()
        if not contributor_doc.exists:
            continue

        contributor = contributor_doc.to_dict()
        if _normalise_type(contributor) != "Mentor" or contributor.get("availability") == "Unavailable":
            continue

        active_assignments = _count_active_mentor_relationships(db, contributor_id)
        programme_assignments = _count_active_mentor_relationships(db, contributor_id, programme_id)
        if _is_mentor_at_capacity(contributor, active_assignments, programme_assignments):
            continue

        contributor_embedding = _ensure_embedding("contributors", contributor_id, contributor, _build_contributor_text)
        similarity = cosine_similarity(startup_embedding, contributor_embedding)
        semantic_score = _similarity_score(similarity)
        rule_score, rule_risks, rule_breakdown = _startup_mentor_rule_score(startup, contributor, programme)
        graph_context = get_startup_mentor_graph_context(db, startup_id, contributor_id, programme_id)
        graph_result = calculate_graph_score(graph_context, "Startup-to-Mentor")
        if graph_result["hardReject"]:
            continue
        score = _graph_blended_total(rule_score, semantic_score, graph_result["graphScore"])
        if score < MENTOR_RECOMMENDATION_THRESHOLD:
            continue

        score_breakdown = {
            "ruleScore": rule_score,
            "semanticScore": semantic_score,
            "graphScore": graph_result["graphScore"],
            "finalScore": score,
            "ruleBreakdown": rule_breakdown,
            "graphBreakdown": graph_result["breakdown"],
        }
        combined_risks = list(dict.fromkeys(rule_risks + graph_result["riskFlags"]))
        explanation_payload = _generate_graph_explanation(
            "Startup-to-Mentor recommendation inside an approved programme",
            {
                "startup": startup,
                "target": contributor,
                "programme": programme,
                "scoreBreakdown": score_breakdown,
                "graphContext": graph_context,
                "riskFlags": combined_risks,
            },
        )
        combined_risks = list(dict.fromkeys(combined_risks + explanation_payload["riskFlags"]))
        graph_evidence = {
            "summary": explanation_payload["summary"],
            "edges": explanation_payload["edges"],
            "pastOutcomeSignals": explanation_payload["pastOutcomeSignals"],
            "riskFlags": combined_risks,
        }
        recommendation = _upsert_recommendation(
            db,
            "Startup-to-Mentor",
            "Startup",
            startup_id,
            "Contributor",
            contributor_id,
            programme_id,
            score,
            explanation_payload["summary"],
            combined_risks,
            score_breakdown,
            graph_evidence,
        )
        recommendations.append(recommendation)

    return {"recommendations": recommendations}


@https_fn.on_call()
def review_recommendation(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_admin(req, db)
    data = _require_data(req)
    recommendation_id = _require_string(data, "recommendationId")
    decision = _require_choice(data, "decision", VALID_DECISIONS)

    rec_ref = db.collection("recommendations").document(recommendation_id)
    rec_doc = rec_ref.get()
    if not rec_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Recommendation not found.",
        )

    recommendation = {"id": rec_doc.id, **rec_doc.to_dict()}
    _require_admin_scope_for_programme(db, account, _clean_string(recommendation.get("programmeId")))
    current_status = recommendation.get("status", "Pending Approval")

    if current_status != "Pending Approval":
        if current_status == decision:
            return {"success": True, "recommendationId": recommendation_id, "decision": decision, "createdId": None}
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Reviewed recommendations cannot be changed to a different decision.",
        )

    rec_ref.update({"status": decision, "updatedAt": firestore.SERVER_TIMESTAMP})

    created_id = None
    if decision == "Approved":
        rec_type = recommendation["recommendationType"]

        if rec_type == "Startup-to-Programme":
            _upsert_application_from_recommendation(db, recommendation)
            created_id = _create_relationship(
                db,
                recommendation,
                "Accepted into programme and onboarded to programme resources.",
            )
        elif rec_type.endswith("-to-Programme"):
            _upsert_programme_contributor_from_recommendation(db, recommendation)
            created_id = _create_relationship(db, recommendation, "Contributor attached to the programme pool.")
        elif rec_type == "Startup-to-Mentor":
            created_id = _create_relationship(db, recommendation, "Mentor guidance for programme milestones.")
        _materialize_graph_edges_for_approval(db, recommendation, created_id)

    return {"success": True, "recommendationId": recommendation_id, "decision": decision, "createdId": created_id}


@https_fn.on_call()
def update_relationship_status(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_admin(req, db)
    data = _require_data(req)
    relationship_id = _require_string(data, "relationshipId")
    new_status = _require_choice(data, "newStatus", VALID_RELATIONSHIP_STATUSES)

    rel_ref = db.collection("relationships").document(relationship_id)
    rel_doc = rel_ref.get()
    if not rel_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Relationship not found.",
        )

    relationship = rel_doc.to_dict()
    _require_admin_scope_for_programme(db, account, _clean_string(relationship.get("programmeId")))
    current_status = relationship.get("status")
    if current_status == new_status:
        return {"success": True, "relationshipId": relationship_id, "newStatus": new_status}

    if not _can_transition_relationship(current_status, new_status):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message=f"Cannot transition relationship from {current_status} to {new_status}.",
        )

    rel_ref.update({"status": new_status, "updatedAt": firestore.SERVER_TIMESTAMP})
    return {"success": True, "relationshipId": relationship_id, "newStatus": new_status}


@https_fn.on_call()
def submit_outcome(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_admin(req, db)
    data = _require_data(req)
    relationship_id = _require_string(data, "relationshipId")
    outcome_achieved = _require_choice(data, "outcomeAchieved", VALID_OUTCOME_ACHIEVEMENTS)
    startup_rating = _require_rating(data, "startupRating")
    contributor_rating = _require_rating(data, "contributorRating")
    startup_feedback = _optional_text(data, "startupFeedback")
    contributor_feedback = _optional_text(data, "contributorFeedback")
    admin_evaluation = _optional_text(data, "adminEvaluation")

    rel_doc = _get_document_or_error(db, "relationships", relationship_id, "Relationship")
    relationship = rel_doc.to_dict()
    _require_admin_scope_for_programme(db, account, _clean_string(relationship.get("programmeId")))
    relationship_status = relationship.get("status")
    if relationship_status not in {"Active", "Needs Review", "Completed"}:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Outcomes can only be submitted for active or completed relationships.",
        )

    lesson_prompt = f"""
    You are the AI learning loop for a programme-first startup support platform.
    Summarise what should be reused or avoided in future matching.

    Relationship: {json.dumps(_sanitize(relationship))}
    Startup rating: {startup_rating} with feedback "{startup_feedback}"
    Contributor rating: {contributor_rating} with feedback "{contributor_feedback}"
    Admin evaluation: "{admin_evaluation}"
    Outcome achieved: {outcome_achieved}

    Return one sentence only.
    """
    if _has_gemini_api_key():
        lesson = _generate_text("gemini-3.1-flash-lite", lesson_prompt)
    else:
        lesson = (
            f"Reuse programme context and capacity checks for similar {relationship.get('relationshipType', 'relationship').lower()} "
            f"cases; this outcome was marked {outcome_achieved.lower()}."
        )

    quality_average = (startup_rating + contributor_rating) / 2
    outcome = {
        "relationshipId": relationship_id,
        "outcomeAchieved": outcome_achieved,
        "relationshipQuality": "High" if quality_average >= 4 else "Medium" if quality_average >= 3 else "Low",
        "startupRating": startup_rating,
        "startupFeedback": startup_feedback,
        "contributorRating": contributor_rating,
        "contributorFeedback": contributor_feedback,
        "adminEvaluation": admin_evaluation,
        "aiLesson": lesson,
        "reusePattern": outcome_achieved in {"Yes", "Partial"},
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    existing = _find_one_by_fields(db, "outcomes", {"relationshipId": relationship_id})
    if existing:
        outcome_ref = db.collection("outcomes").document(existing["id"])
        outcome_ref.set({"id": existing["id"], **outcome}, merge=True)
        outcome_id = existing["id"]
    else:
        outcome_id = relationship_id
        outcome_ref = db.collection("outcomes").document(outcome_id)
        outcome_ref.set(
            {"id": outcome_id, **outcome, "createdAt": firestore.SERVER_TIMESTAMP},
            merge=False,
        )

    if relationship_status != "Completed":
        db.collection("relationships").document(relationship_id).update(
            {"status": "Completed", "updatedAt": firestore.SERVER_TIMESTAMP}
        )

    upsert_graph_edge(
        db,
        "Relationship",
        relationship_id,
        "PRODUCED_OUTCOME",
        "Outcome",
        outcome_id,
        programme_id=relationship.get("programmeId"),
        created_from="outcomes",
        created_from_id=outcome_id,
        metadata={"outcomeAchieved": outcome_achieved, "reusePattern": outcome["reusePattern"]},
    )

    return {"success": True, "outcomeId": outcome_id, "aiLesson": lesson}


def _summary_prompt(startup: dict) -> str:
    return f"""
    You are an AI assistant for a programme-first startup ecosystem platform.
    Analyse this startup profile and return ONLY a JSON object with:
    summary, autoTags, suggestedProgrammeTypes, riskFlags, profileCompletenessScore, readinessScore.

    Startup: {json.dumps(_sanitize(startup))}
    """


def _build_profile_fallback(entity: dict[str, Any], entity_label: str) -> dict[str, Any]:
    name = entity.get("name") or entity.get("companyName") or f"This {entity_label}"
    industry = entity.get("industry") or entity.get("sector") or "unknown sector"
    stage = entity.get("stage") or "unknown stage"
    country = entity.get("country") or "an unspecified country"
    support_needs = list(entity.get("supportNeeds", []))
    tokens = _tokenize(" ".join([str(name), str(industry), str(stage), str(country), " ".join(support_needs)]))

    suggested_programmes = []
    if stage in {"Idea", "Pre-seed", "Seed", "MVP"}:
        suggested_programmes.append("Accelerator")
    if {"fintech", "payments", "regulatory"} & tokens:
        suggested_programmes.append("Market Access Programme")
    if {"health", "med", "clinical", "healthtech"} & tokens:
        suggested_programmes.append("Healthcare Accelerator")
    if not suggested_programmes:
        suggested_programmes.append("Mentorship Cohort")

    risk_flags = []
    if entity.get("verificationStatus") != "Verified":
        risk_flags.append("Startup profile is not verified yet.")
    if not entity.get("productDescription"):
        risk_flags.append("Startup profile does not show a clear product or prototype.")
    if not support_needs:
        risk_flags.append("Startup support needs are not fully articulated.")

    completeness = 65.0
    if entity.get("productDescription"):
        completeness += 15.0
    if entity.get("verificationStatus") == "Verified":
        completeness += 10.0
    if support_needs:
        completeness += 5.0

    readiness = 5.0
    if stage in {"MVP", "Seed", "Growth"}:
        readiness += 1.5
    if entity.get("productDescription"):
        readiness += 1.5
    if entity.get("verificationStatus") == "Verified":
        readiness += 1.0
    if support_needs:
        readiness += 0.5

    return {
        "summary": (
            f"{name} is a {stage} {industry} startup in {country} seeking "
            f"{', '.join(support_needs[:3]) if support_needs else 'programme support'}."
        ),
        "autoTags": [item for item in [industry, stage, country, *support_needs[:3]] if item],
        "suggestedProgrammeTypes": suggested_programmes,
        "riskFlags": risk_flags or ["Profile is broadly suitable for programme matching."],
        "profileCompletenessScore": round(min(completeness, 100.0), 2),
        "readinessScore": round(min(readiness, 10.0), 2),
    }


def _build_ai_insights_fallback(stats: dict[str, Any]) -> list[dict[str, str]]:
    top_gap = max(
        stats.get("programmeGraphGaps", []),
        key=lambda item: (len(item.get("gaps", [])), item.get("counts", {}).get("acceptedStartups", 0)),
        default=None,
    )
    return [
        {
            "type": "programme_supply_gap",
            "title": "Programme supply gap",
            "description": (
                top_gap["gaps"][0]["summary"]
                if top_gap and top_gap.get("gaps")
                else "Current programme coverage is broadly aligned with accepted startup demand."
            ),
            "severity": "high" if top_gap and top_gap.get("gaps") else "low",
        },
        {
            "type": "mentor_capacity_warning",
            "title": "Mentor capacity watch",
            "description": (
                f"{len(stats.get('lowCapacityMentors', []))} mentors are operating near capacity."
                if stats.get("lowCapacityMentors")
                else "No immediate mentor capacity bottleneck detected."
            ),
            "severity": "medium" if stats.get("lowCapacityMentors") else "low",
        },
        {
            "type": "reusable_outcome_pattern",
            "title": "Reusable outcome pattern",
            "description": (
                f"{stats.get('successfulOutcomes', 0)} of {stats.get('totalOutcomes', 0)} outcomes are marked successful, "
                "so those programme and relationship patterns should be reused first."
            ),
            "severity": "medium" if stats.get("successfulOutcomes", 0) else "low",
        },
        {
            "type": "admin_recommendation",
            "title": "Admin action",
            "description": "Use graph evidence when approving recommendations and watch programmes with repeated capacity gaps.",
            "severity": "medium",
        },
    ]


@https_fn.on_call()
def summarise_startup_profile(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    data = _require_data(req)
    startup_id = _require_string(data, "startupId")
    _require_startup_owner_or_admin(account, startup_id)

    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
    startup = startup_doc.to_dict()
    try:
        if _has_gemini_api_key() and not _running_in_firestore_emulator():
            profile = _generate_json_payload("gemini-3.1-flash-lite", _summary_prompt(startup), dict, _normalise_profile_payload)
        else:
            raise RuntimeError("fallback")
    except Exception:
        profile = _build_profile_fallback(startup, "startup")
    return {"startupId": startup_id, "profile": profile}


@https_fn.on_call()
def summarise_company_profile(req: https_fn.CallableRequest):
    db = _init_firebase()
    data = _require_data(req)
    company_id = _require_string(data, "companyId")

    startup_doc = _get_document_or_error(db, "companies", company_id, "Startup")
    startup = startup_doc.to_dict()
    try:
        if _has_gemini_api_key() and not _running_in_firestore_emulator():
            profile = _generate_json_payload("gemini-3.1-flash-lite", _summary_prompt(startup), dict, _normalise_profile_payload)
        else:
            raise RuntimeError("fallback")
    except Exception:
        profile = _build_profile_fallback(startup, "company")
    return {"startupId": company_id, "profile": profile}


@https_fn.on_call()
def get_programme_graph_view(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_admin(req, db)
    data = _require_data(req)
    programme_id = _require_string(data, "programmeId")
    _require_admin_scope_for_programme(db, account, programme_id)
    subgraph = get_programme_subgraph(db, programme_id)
    graph_insights = _programme_graph_gaps(subgraph)
    return {
        "programme": subgraph["programme"],
        "counts": subgraph["counts"],
        "graphEvidence": {
            "edges": [_edge_evidence_text(edge) for edge in subgraph["edges"][:8]],
            "pastOutcomeSignals": subgraph["positiveOutcomeSignals"][:4],
        },
        "graphInsights": graph_insights,
    }


@https_fn.on_call()
def get_ai_insights(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    _require_data(req)

    startups = [doc.to_dict() for doc in db.collection("companies").stream()]
    programmes = [doc.to_dict() for doc in db.collection("programmes").stream()]
    contributors = [doc.to_dict() for doc in db.collection("contributors").stream()]
    applications = [doc.to_dict() for doc in db.collection("applications").stream()]
    pools = [doc.to_dict() for doc in db.collection("programmeContributors").stream()]
    recommendations = [doc.to_dict() for doc in db.collection("recommendations").stream()]
    relationships = [doc.to_dict() for doc in db.collection("relationships").stream()]
    outcomes = [doc.to_dict() for doc in db.collection("outcomes").stream()]
    graph_edges = [doc.to_dict() for doc in db.collection("graph_edges").stream()]
    programme_graph_gaps = []
    for programme in programmes:
        subgraph = get_programme_subgraph(db, programme["id"])
        programme_graph_gaps.append(
            {
                "programmeId": programme["id"],
                "programmeName": programme["name"],
                "counts": subgraph["counts"],
                "gaps": _programme_graph_gaps(subgraph),
            }
        )

    stats = {
        "totalOrganisations": len([doc.to_dict() for doc in db.collection("organisations").stream()]),
        "openProgrammes": len([programme for programme in programmes if programme.get("status") in ["Open", "Active"]]),
        "totalStartups": len(startups),
        "verifiedStartups": len([startup for startup in startups if startup.get("verificationStatus") == "Verified"]),
        "pendingApplications": len([app for app in applications if app.get("status") == "Pending Admin Review"]),
        "acceptedApplications": len([app for app in applications if app.get("status") == "Accepted"]),
        "programmePoolAssignments": len([pool for pool in pools if pool.get("status") == "Approved"]),
        "pendingRecommendations": len([rec for rec in recommendations if rec.get("status") == "Pending Approval"]),
        "activeRelationships": len([rel for rel in relationships if rel.get("status") == "Active"]),
        "completedRelationships": len([rel for rel in relationships if rel.get("status") == "Completed"]),
        "totalOutcomes": len(outcomes),
        "successfulOutcomes": len([outcome for outcome in outcomes if outcome.get("outcomeAchieved") == "Yes"]),
        "graphEdges": len(graph_edges),
        "startupSupportNeeds": {},
        "programmeOutcomeDemand": {},
        "lowCapacityMentors": [],
        "programmeGraphGaps": programme_graph_gaps,
    }

    for startup in startups:
        for need in startup.get("supportNeeds", []):
            stats["startupSupportNeeds"][need] = stats["startupSupportNeeds"].get(need, 0) + 1

    for programme in programmes:
        for outcome in programme.get("expectedOutcomes", []):
            stats["programmeOutcomeDemand"][outcome] = stats["programmeOutcomeDemand"].get(outcome, 0) + 1

    for contributor in contributors:
        if _normalise_type(contributor) == "Mentor" and contributor.get("availability") != "Unavailable":
            max_startups = _capacity_value(contributor, "globalMaxStartupAssignments")
            if max_startups and max_startups <= 2:
                stats["lowCapacityMentors"].append(contributor.get("name"))

    outcome_context = [
        {
            "relationshipId": outcome.get("relationshipId"),
            "outcomeAchieved": outcome.get("outcomeAchieved"),
            "relationshipQuality": outcome.get("relationshipQuality"),
            "aiLesson": outcome.get("aiLesson", ""),
        }
        for outcome in outcomes[:40]
    ]

    if _has_gemini_api_key():
        prompt = f"""
        You are the AI ecosystem analyst for Lattice, a programme-first startup relationship orchestration platform.
        Review these ecosystem statistics:
        {json.dumps(stats, indent=2)}

        Outcome history sample:
        {json.dumps(outcome_context, indent=2)}

        Return ONLY a JSON array with exactly 4 objects. Each object must include:
        type, title, description, severity.

        Cover:
        1. a programme supply-demand gap
        2. a mentor capacity warning
        3. a reusable outcome pattern grounded in the outcome history
        4. a strategic recommendation for organisation admins
        """
        try:
            insights = _generate_json_payload("gemini-3.1-flash-lite", prompt, list, _normalise_insights_payload)
        except Exception:
            insights = _build_ai_insights_fallback(stats)
    else:
        insights = _build_ai_insights_fallback(stats)
    return {"insights": insights, "stats": stats}


@https_fn.on_call()
def get_dashboard_stats(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    _require_data(req)
    organisations = [doc.to_dict() for doc in db.collection("organisations").stream()]
    programmes = [doc.to_dict() for doc in db.collection("programmes").stream()]
    startups = [doc.to_dict() for doc in db.collection("companies").stream()]
    contributors = [doc.to_dict() for doc in db.collection("contributors").stream()]
    applications = [doc.to_dict() for doc in db.collection("applications").stream()]
    pools = [doc.to_dict() for doc in db.collection("programmeContributors").stream()]
    recommendations = [doc.to_dict() for doc in db.collection("recommendations").stream()]
    relationships = [doc.to_dict() for doc in db.collection("relationships").stream()]
    outcomes = [doc.to_dict() for doc in db.collection("outcomes").stream()]

    success_rate = 0
    if outcomes:
        success_rate = round(
            len([outcome for outcome in outcomes if outcome.get("outcomeAchieved") == "Yes"]) / len(outcomes) * 100,
            1,
        )

    return {
        "totalOrganisations": len(organisations),
        "openProgrammes": len([programme for programme in programmes if programme.get("status") in ["Open", "Active"]]),
        "totalStartups": len(startups),
        "verifiedStartups": len([startup for startup in startups if startup.get("verificationStatus") == "Verified"]),
        "totalContributors": len(contributors),
        "programmePoolAssignments": len([pool for pool in pools if pool.get("status") == "Approved"]),
        "pendingApplications": len([app for app in applications if app.get("status") == "Pending Admin Review"]),
        "acceptedApplications": len([app for app in applications if app.get("status") == "Accepted"]),
        "pendingRecommendations": len([rec for rec in recommendations if rec.get("status") == "Pending Approval"]),
        "activeRelationships": len([rel for rel in relationships if rel.get("status") == "Active"]),
        "completedRelationships": len([rel for rel in relationships if rel.get("status") == "Completed"]),
        "outcomeSuccessRate": success_rate,
    }
