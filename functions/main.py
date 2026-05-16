import json
import os
import re
import time
from datetime import datetime

import numpy as np
from firebase_admin import firestore, initialize_app
from firebase_functions import https_fn
from firebase_functions.options import set_global_options

set_global_options(max_instances=10)

try:
    initialize_app(options={"projectId": os.environ.get("GCLOUD_PROJECT", "lattice-2026")})
except ValueError:
    pass

MAX_RETRIES = 3
RETRY_DELAY = 10


def _sanitize(doc_dict: dict) -> dict:
    clean = {}
    for key, value in doc_dict.items():
        if value is None:
            clean[key] = None
        elif isinstance(value, datetime):
            clean[key] = value.isoformat()
        elif isinstance(value, list):
            clean[key] = value
        elif isinstance(value, dict):
            clean[key] = _sanitize(value)
        else:
            clean[key] = value
    return clean


def _init_firebase():
    try:
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
    if account.get("status") == "Suspended":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="This Lattice account is suspended.",
        )
    return account


def _is_admin_account(account: dict) -> bool:
    return account.get("status") == "Active" and account.get("accountType") in [
        "organisation",
        "organisationAdmin",
        "platformAdmin",
    ]


def _require_admin(req: https_fn.CallableRequest, db):
    account = _require_account(req, db)
    if not _is_admin_account(account):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
            message="Admin access is required.",
        )
    return account


def _require_startup_owner_or_admin(account: dict, startup_id: str):
    if _is_admin_account(account):
        return
    if (
        account.get("status") == "Active"
        and account.get("accountType") == "startup"
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


def _registration_account(uid: str, account_type: str, entity_type: str, entity_id: str, display_name: str, email: str) -> dict:
    return {
        "accountType": account_type,
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
        entity_type = "company"
        entity_id = f"comp-{uid}"
        display_name = _require_profile_name(profile, "name", "startupName", "companyName")
        sector = _clean_string(profile.get("sector") or profile.get("industry"))
        entity_payload = {
            "id": entity_id,
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
        entity_payload = {
            "id": entity_id,
            "organisationId": f"org-contrib-{uid}",
            "name": display_name,
            "contributorTypes": _normalise_contributor_types(profile.get("contributorTypes")),
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
        entity_type = "organisation"
        entity_id = f"org-{uid}"
        display_name = _require_profile_name(profile, "name", "organisationName")
        entity_payload = {
            "id": entity_id,
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

    account_payload = _registration_account(uid, account_type, entity_type, entity_id, display_name, email)
    batch = db.batch()
    batch.set(entity_ref, entity_payload)
    batch.set(account_ref, account_payload)
    batch.commit()

    return {
        "account": {
            "accountType": account_type,
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

    api_key = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def _retryable_model_call(fn):
    for attempt in range(MAX_RETRIES):
        try:
            return fn()
        except Exception as exc:  # pragma: no cover - runtime integration path
            if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                time.sleep(RETRY_DELAY * (2 ** attempt))
                continue
            raise
    return fn()


def get_embedding(text: str) -> list[float]:
    client = _get_genai_client()

    def _call():
        response = client.models.embed_content(
            model="gemini-embedding-2",
            contents=text,
        )
        return response.embeddings[0].values

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
    coverage_values = [item.lower() for item in coverage or []]
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
    if "team of at least 2" in rules_text or "team of 2" in rules_text:
        if team_size < 2:
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


def _blended_total(base_score: float, similarity: float, semantic_weight: float = 20.0) -> float:
    return round(min(100.0, base_score * 0.8 + max(similarity, 0.0) * semantic_weight), 2)


def _startup_programme_score(startup: dict, programme: dict, similarity: float) -> tuple[float, list[str]]:
    sector_fit = 25.0 if startup.get("industry") in programme.get("targetSectors", []) else _overlap_score(
        [startup.get("industry", "")], programme.get("targetSectors", []), 25
    )
    stage_fit = 15.0 if startup.get("stage") in programme.get("targetStages", []) else 0.0
    need_fit = _overlap_score(startup.get("supportNeeds", []), programme.get("expectedOutcomes", []), 25)
    outcome_fit = _overlap_score(startup.get("supportNeeds", []), programme.get("expectedOutcomes", []), 10)
    region_fit = _country_fit(
        startup.get("country", ""),
        [programme.get("country", ""), programme.get("region", "")],
        10,
    )
    eligibility_fit, risks = _eligibility_score(startup, programme)
    total = _blended_total(sector_fit + stage_fit + need_fit + eligibility_fit + region_fit + outcome_fit, similarity)

    if sector_fit < 12:
        risks.append("Sector fit is weak for this programme.")
    if stage_fit == 0:
        risks.append("Startup stage is outside the programme's main focus.")
    if need_fit < 10:
        risks.append("Programme outcomes do not strongly cover the startup's top support needs.")

    return total, list(dict.fromkeys(risks))


def _contributor_programme_score(contributor: dict, programme: dict, similarity: float) -> tuple[float, list[str], str]:
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
        total = _blended_total(expertise_fit + sector_fit + stage_fit + capacity_fit + region_fit + outcome_fit, similarity)
        if capacity_fit < 10:
            risks.append("Mentor availability is limited.")
    elif contributor_type == "Investor":
        thesis_fit = _overlap_score(contributor.get("investmentThesis", []), programme_sectors, 30)
        sector_fit = _overlap_score(contributor.get("investmentThesis", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("stages", contributor.get("supportedStages", [])), programme_stages, 20)
        ticket_fit = 10.0 if contributor.get("ticketSize") else 4.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        strategic_fit = _overlap_score(programme.get("expectedOutcomes", []), contributor.get("investmentThesis", []), 10)
        total = _blended_total(thesis_fit + sector_fit + stage_fit + ticket_fit + region_fit + strategic_fit, similarity)
        if stage_fit < 10:
            risks.append("Investor stage focus does not strongly match the programme.")
    elif contributor_type == "Partner":
        strategic_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 30)
        sector_fit = _overlap_score(contributor.get("expertise", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("supportedStages", []), programme_stages, 20)
        activation_fit = 10.0 if contributor.get("availability") == "Available" else 5.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        value_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 10)
        total = _blended_total(strategic_fit + sector_fit + stage_fit + activation_fit + region_fit + value_fit, similarity)
    else:
        service_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 30)
        sector_fit = _overlap_score(contributor.get("expertise", []), programme_sectors, 20)
        stage_fit = _overlap_score(contributor.get("supportedStages", []), programme_stages, 15)
        availability_fit = 15.0 if contributor.get("availability") == "Available" else 8.0 if contributor.get("availability") == "Limited" else 0.0
        region_fit = _country_fit(programme_country, contributor.get("countryCoverage", []), 10)
        value_fit = min(float(contributor.get("rating", 0)) * 2, 10.0)
        total = _blended_total(service_fit + sector_fit + stage_fit + availability_fit + region_fit + value_fit, similarity)
        if availability_fit == 0:
            risks.append("Contributor is currently unavailable.")

    if contributor.get("availability") == "Unavailable":
        risks.append("Contributor is unavailable.")

    return total, list(dict.fromkeys(risks)), contributor_type


def _startup_mentor_score(startup: dict, contributor: dict, programme: dict, similarity: float) -> tuple[float, list[str]]:
    needs_fit = _overlap_score(startup.get("supportNeeds", []), contributor.get("expertise", []), 30)
    domain_fit = _overlap_score([startup.get("industry", "")], contributor.get("expertise", []), 20)
    stage_fit = _overlap_score([startup.get("stage", "")], contributor.get("supportedStages", []), 15)
    region_fit = _country_fit(startup.get("country", ""), contributor.get("countryCoverage", []), 10)
    capacity_fit = 15.0 if contributor.get("availability") == "Available" else 7.0 if contributor.get("availability") == "Limited" else 0.0
    programme_fit = _overlap_score(contributor.get("expertise", []), programme.get("expectedOutcomes", []), 10)
    total = _blended_total(needs_fit + domain_fit + stage_fit + region_fit + capacity_fit + programme_fit, similarity)
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

    return total, risks


def _generate_explanation(context: str, payload: dict) -> str:
    client = _get_genai_client()
    prompt = f"""
    You are the AI Relationship Engine for a programme-first startup ecosystem platform called Lattice.
    Context: {context}
    Data: {json.dumps(_sanitize(payload))}

    Write a concise explanation in 2 sentences.
    Sentence 1: why the match is strong.
    Sentence 2: one realistic governance or capacity risk to watch.
    """

    def _call():
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        return response.text.strip()

    return _retryable_model_call(_call)


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
):
    existing = []
    for doc in db.collection("recommendations").stream():
        data = doc.to_dict()
        if (
            data.get("recommendationType") == recommendation_type
            and data.get("sourceEntityId") == source_entity_id
            and data.get("targetEntityId") == target_entity_id
            and data.get("programmeId") == programme_id
        ):
            existing = [doc]
            break

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
        "status": "Pending Approval",
        "createdAt": firestore.SERVER_TIMESTAMP,
        "updatedAt": firestore.SERVER_TIMESTAMP,
    }

    if existing:
        ref = db.collection("recommendations").document(existing[0].id)
        ref.set(payload, merge=True)
        return {"id": existing[0].id, **payload}

    ref = db.collection("recommendations").document()
    payload["id"] = ref.id
    ref.set(payload)
    return payload


def _relationship_exists(db, relationship_type: str, source_entity_id: str, target_entity_id: str, programme_id: str) -> bool:
    for doc in db.collection("relationships").stream():
        data = doc.to_dict()
        if (
            data.get("relationshipType") == relationship_type
            and data.get("sourceEntityId") == source_entity_id
            and data.get("targetEntityId") == target_entity_id
            and data.get("programmeId") == programme_id
        ):
            return True
    return False


def _create_relationship(db, recommendation: dict, expected_outcome: str) -> str:
    relationship_type = recommendation["recommendationType"]
    if _relationship_exists(
        db,
        relationship_type,
        recommendation["sourceEntityId"],
        recommendation["targetEntityId"],
        recommendation["programmeId"],
    ):
        for doc in db.collection("relationships").stream():
            data = doc.to_dict()
            if (
                data.get("relationshipType") == relationship_type
                and data.get("sourceEntityId") == recommendation["sourceEntityId"]
                and data.get("targetEntityId") == recommendation["targetEntityId"]
                and data.get("programmeId") == recommendation["programmeId"]
            ):
                return doc.id

    ref = db.collection("relationships").document()
    payload = {
        "id": ref.id,
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
    ref.set(payload)
    return ref.id


@https_fn.on_call()
def recommend_programmes_for_startup(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    startup_id = req.data.get("startupId")
    if not startup_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="startupId is required.",
        )
    _require_startup_owner_or_admin(account, startup_id)

    startup_doc = db.collection("companies").document(startup_id).get()
    if not startup_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Startup not found.",
        )

    startup = startup_doc.to_dict()
    startup_embedding = _ensure_embedding("companies", startup_id, startup, _build_startup_text)

    recommendations = []
    for programme_doc in db.collection("programmes").stream():
        programme = programme_doc.to_dict()
        if programme.get("status") not in ["Open", "Active"]:
            continue

        programme_embedding = _ensure_embedding("programmes", programme_doc.id, programme, _build_programme_text)
        similarity = cosine_similarity(startup_embedding, programme_embedding)
        score, risks = _startup_programme_score(startup, programme, similarity)
        if score < 65:
            continue

        explanation = _generate_explanation(
            "Startup-to-Programme recommendation",
            {"startup": startup, "programme": programme, "score": score, "risks": risks},
        )
        recommendation = _upsert_recommendation(
            db,
            "Startup-to-Programme",
            "Startup",
            startup_id,
            "Programme",
            programme_doc.id,
            programme_doc.id,
            score,
            explanation,
            risks,
        )
        recommendations.append(recommendation)

    return {"recommendations": recommendations}


@https_fn.on_call()
def recommend_contributor_to_programmes(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    contributor_id = req.data.get("contributorId")
    if not contributor_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="contributorId is required.",
        )

    contributor_doc = db.collection("contributors").document(contributor_id).get()
    if not contributor_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Contributor not found.",
        )

    contributor = contributor_doc.to_dict()
    contributor_embedding = _ensure_embedding("contributors", contributor_id, contributor, _build_contributor_text)

    recommendations = []
    for programme_doc in db.collection("programmes").stream():
        programme = programme_doc.to_dict()
        if programme.get("status") not in ["Open", "Active"]:
            continue

        programme_embedding = _ensure_embedding("programmes", programme_doc.id, programme, _build_programme_text)
        similarity = cosine_similarity(contributor_embedding, programme_embedding)
        score, risks, contributor_type = _contributor_programme_score(contributor, programme, similarity)
        if score < 65:
            continue

        recommendation_type = f"{contributor_type}-to-Programme"
        explanation = _generate_explanation(
            "Contributor-to-Programme recommendation",
            {
                "contributor": contributor,
                "programme": programme,
                "recommendationType": recommendation_type,
                "score": score,
                "risks": risks,
            },
        )
        recommendation = _upsert_recommendation(
            db,
            recommendation_type,
            "Contributor",
            contributor_id,
            "Programme",
            programme_doc.id,
            programme_doc.id,
            score,
            explanation,
            risks,
        )
        recommendations.append(recommendation)

    return {"recommendations": recommendations}


@https_fn.on_call()
def recommend_mentor_for_startup(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    startup_id = req.data.get("startupId")
    programme_id = req.data.get("programmeId")
    if not startup_id or not programme_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="startupId and programmeId are required.",
        )

    startup_doc = db.collection("companies").document(startup_id).get()
    programme_doc = db.collection("programmes").document(programme_id).get()
    if not startup_doc.exists or not programme_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Startup or programme not found.",
        )

    accepted_application = []
    for doc in db.collection("applications").stream():
        data = doc.to_dict()
        if (
            data.get("startupId") == startup_id
            and data.get("programmeId") == programme_id
            and data.get("status") == "Accepted"
        ):
            accepted_application = [doc]
            break
    if not accepted_application:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="Startup must be accepted into the programme before mentor matching.",
        )

    startup = startup_doc.to_dict()
    programme = programme_doc.to_dict()
    startup_embedding = _ensure_embedding("companies", startup_id, startup, _build_startup_text)

    recommendations = []
    for pool_doc in db.collection("programmeContributors").stream():
        pool = pool_doc.to_dict()
        if pool.get("programmeId") != programme_id or pool.get("status") != "Approved":
            continue
        contributor_id = pool.get("contributorId")
        contributor_doc = db.collection("contributors").document(contributor_id).get()
        if not contributor_doc.exists:
            continue

        contributor = contributor_doc.to_dict()
        if _normalise_type(contributor) != "Mentor":
            continue

        contributor_embedding = _ensure_embedding("contributors", contributor_id, contributor, _build_contributor_text)
        similarity = cosine_similarity(startup_embedding, contributor_embedding)
        score, risks = _startup_mentor_score(startup, contributor, programme, similarity)
        if score < 70:
            continue

        explanation = _generate_explanation(
            "Startup-to-Mentor recommendation inside an approved programme",
            {"startup": startup, "programme": programme, "contributor": contributor, "score": score, "risks": risks},
        )
        recommendation = _upsert_recommendation(
            db,
            "Startup-to-Mentor",
            "Startup",
            startup_id,
            "Contributor",
            contributor_id,
            programme_id,
            score,
            explanation,
            risks,
        )
        recommendations.append(recommendation)

    return {"recommendations": recommendations}


@https_fn.on_call()
def review_recommendation(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    recommendation_id = req.data.get("recommendationId")
    decision = req.data.get("decision")
    if not recommendation_id or decision not in ["Approved", "Rejected"]:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="recommendationId and a valid decision are required.",
        )

    rec_ref = db.collection("recommendations").document(recommendation_id)
    rec_doc = rec_ref.get()
    if not rec_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Recommendation not found.",
        )

    recommendation = {"id": rec_doc.id, **rec_doc.to_dict()}
    rec_ref.update({"status": decision, "updatedAt": firestore.SERVER_TIMESTAMP})

    created_id = None
    if decision == "Approved":
        rec_type = recommendation["recommendationType"]

        if rec_type == "Startup-to-Programme":
            app_ref = db.collection("applications").document(f"{recommendation['sourceEntityId']}_{recommendation['programmeId']}")
            app_ref.set(
                {
                    "id": app_ref.id,
                    "startupId": recommendation["sourceEntityId"],
                    "programmeId": recommendation["programmeId"],
                    "aiFitScore": recommendation["matchScore"],
                    "aiExplanation": recommendation["explanation"],
                    "status": "Accepted",
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
                merge=True,
            )
            created_id = _create_relationship(db, recommendation, "Accepted into programme and onboarded to programme resources.")
        elif rec_type.endswith("-to-Programme"):
            pool_ref = db.collection("programmeContributors").document(
                f"{recommendation['targetEntityId']}_{recommendation['programmeId']}"
                if recommendation["sourceEntityType"] == "Programme"
                else f"{recommendation['sourceEntityId']}_{recommendation['programmeId']}"
            )
            contributor_id = recommendation["sourceEntityId"]
            pool_ref.set(
                {
                    "id": pool_ref.id,
                    "programmeId": recommendation["programmeId"],
                    "contributorId": contributor_id,
                    "contributorType": rec_type.replace("-to-Programme", ""),
                    "status": "Approved",
                    "createdAt": firestore.SERVER_TIMESTAMP,
                    "updatedAt": firestore.SERVER_TIMESTAMP,
                },
                merge=True,
            )
            created_id = _create_relationship(db, recommendation, "Contributor attached to the programme pool.")
        elif rec_type == "Startup-to-Mentor":
            created_id = _create_relationship(db, recommendation, "Mentor guidance for programme milestones.")

    return {"success": True, "recommendationId": recommendation_id, "decision": decision, "createdId": created_id}


@https_fn.on_call()
def update_relationship_status(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    relationship_id = req.data.get("relationshipId")
    new_status = req.data.get("newStatus")
    valid_statuses = ["Approved", "Active", "Needs Review", "Completed", "Rejected", "Expired"]

    if not relationship_id or new_status not in valid_statuses:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="relationshipId and a valid newStatus are required.",
        )

    rel_ref = db.collection("relationships").document(relationship_id)
    rel_doc = rel_ref.get()
    if not rel_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Relationship not found.",
        )

    rel_ref.update({"status": new_status, "updatedAt": firestore.SERVER_TIMESTAMP})
    return {"success": True, "relationshipId": relationship_id, "newStatus": new_status}


@https_fn.on_call()
def submit_outcome(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    data = req.data
    relationship_id = data.get("relationshipId")
    if not relationship_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="relationshipId is required.",
        )

    rel_doc = db.collection("relationships").document(relationship_id).get()
    if not rel_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Relationship not found.",
        )

    relationship = rel_doc.to_dict()
    if not _is_admin_account(account):
        if account.get("status") != "Active":
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                message="This Lattice account must be active before submitting outcomes.",
            )
        owns_startup_side = (
            account.get("accountType") == "startup"
            and account.get("entityType") == "company"
            and relationship.get("sourceEntityId") == account.get("entityId")
        )
        owns_contributor_side = (
            account.get("accountType") == "contributor"
            and account.get("entityType") == "contributor"
            and relationship.get("targetEntityId") == account.get("entityId")
        )
        if not owns_startup_side and not owns_contributor_side:
            raise https_fn.HttpsError(
                code=https_fn.FunctionsErrorCode.PERMISSION_DENIED,
                message="You can only submit outcomes for your own relationships.",
            )

    client = _get_genai_client()
    lesson_prompt = f"""
    You are the AI learning loop for a programme-first startup support platform.
    Summarise what should be reused or avoided in future matching.

    Relationship: {json.dumps(_sanitize(relationship))}
    Startup rating: {data.get('startupRating')} with feedback "{data.get('startupFeedback', '')}"
    Contributor rating: {data.get('contributorRating')} with feedback "{data.get('contributorFeedback', '')}"
    Admin evaluation: "{data.get('adminEvaluation', '')}"
    Outcome achieved: {data.get('outcomeAchieved')}

    Return one sentence only.
    """

    lesson = _retryable_model_call(
        lambda: client.models.generate_content(model="gemini-2.5-flash", contents=lesson_prompt).text.strip()
    )

    outcome_ref = db.collection("outcomes").document()
    quality_average = (float(data.get("startupRating", 0)) + float(data.get("contributorRating", 0))) / 2
    outcome = {
        "id": outcome_ref.id,
        "relationshipId": relationship_id,
        "outcomeAchieved": data.get("outcomeAchieved", "Pending"),
        "relationshipQuality": "High" if quality_average >= 4 else "Medium" if quality_average >= 3 else "Low",
        "startupRating": data.get("startupRating", 0),
        "startupFeedback": data.get("startupFeedback", ""),
        "contributorRating": data.get("contributorRating", 0),
        "contributorFeedback": data.get("contributorFeedback", ""),
        "adminEvaluation": data.get("adminEvaluation", ""),
        "aiLesson": lesson,
        "reusePattern": data.get("outcomeAchieved") in ["Yes", "Partial"],
        "createdAt": firestore.SERVER_TIMESTAMP,
    }
    outcome_ref.set(outcome)

    db.collection("relationships").document(relationship_id).update(
        {"status": "Completed", "updatedAt": firestore.SERVER_TIMESTAMP}
    )

    return {"success": True, "outcomeId": outcome_ref.id, "aiLesson": lesson}


@https_fn.on_call()
def summarise_startup_profile(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    client = _get_genai_client()
    startup_id = req.data.get("startupId")
    if not startup_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="startupId is required.",
        )
    _require_startup_owner_or_admin(account, startup_id)

    startup_doc = db.collection("companies").document(startup_id).get()
    if not startup_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Startup not found.",
        )

    startup = startup_doc.to_dict()
    prompt = f"""
    You are an AI assistant for a programme-first startup ecosystem platform.
    Analyse this startup profile and return ONLY a JSON object with:
    summary, autoTags, suggestedProgrammeTypes, riskFlags, profileCompletenessScore, readinessScore.

    Startup: {json.dumps(_sanitize(startup))}
    """

    raw = _retryable_model_call(
        lambda: client.models.generate_content(model="gemini-2.5-flash", contents=prompt).text.strip()
    )

    try:
        cleaned = raw
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        profile = json.loads(cleaned)
    except (json.JSONDecodeError, IndexError):
        profile = {
            "summary": raw,
            "autoTags": [],
            "suggestedProgrammeTypes": [],
            "riskFlags": [],
            "profileCompletenessScore": 0,
            "readinessScore": 0,
        }

    return {"startupId": startup_id, "profile": profile}


@https_fn.on_call()
def summarise_company_profile(req: https_fn.CallableRequest):
    db = _init_firebase()
    account = _require_account(req, db)
    client = _get_genai_client()
    company_id = req.data.get("companyId")
    if not company_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="companyId is required.",
        )
    _require_startup_owner_or_admin(account, company_id)

    startup_doc = db.collection("companies").document(company_id).get()
    if not startup_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Startup not found.",
        )

    startup = startup_doc.to_dict()
    prompt = f"""
    You are an AI assistant for a programme-first startup ecosystem platform.
    Analyse this startup profile and return ONLY a JSON object with:
    summary, autoTags, suggestedProgrammeTypes, riskFlags, profileCompletenessScore, readinessScore.

    Startup: {json.dumps(_sanitize(startup))}
    """

    raw = _retryable_model_call(
        lambda: client.models.generate_content(model="gemini-2.5-flash", contents=prompt).text.strip()
    )

    try:
        cleaned = raw
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        profile = json.loads(cleaned)
    except (json.JSONDecodeError, IndexError):
        profile = {
            "summary": raw,
            "autoTags": [],
            "suggestedProgrammeTypes": [],
            "riskFlags": [],
            "profileCompletenessScore": 0,
            "readinessScore": 0,
        }

    return {"startupId": company_id, "profile": profile}


@https_fn.on_call()
def get_ai_insights(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
    client = _get_genai_client()

    startups = [doc.to_dict() for doc in db.collection("companies").stream()]
    programmes = [doc.to_dict() for doc in db.collection("programmes").stream()]
    contributors = [doc.to_dict() for doc in db.collection("contributors").stream()]
    applications = [doc.to_dict() for doc in db.collection("applications").stream()]
    pools = [doc.to_dict() for doc in db.collection("programmeContributors").stream()]
    recommendations = [doc.to_dict() for doc in db.collection("recommendations").stream()]
    relationships = [doc.to_dict() for doc in db.collection("relationships").stream()]
    outcomes = [doc.to_dict() for doc in db.collection("outcomes").stream()]

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
        "startupSupportNeeds": {},
        "programmeOutcomeDemand": {},
        "lowCapacityMentors": [],
    }

    for startup in startups:
        for need in startup.get("supportNeeds", []):
            stats["startupSupportNeeds"][need] = stats["startupSupportNeeds"].get(need, 0) + 1

    for programme in programmes:
        for outcome in programme.get("expectedOutcomes", []):
            stats["programmeOutcomeDemand"][outcome] = stats["programmeOutcomeDemand"].get(outcome, 0) + 1

    for contributor in contributors:
        if _normalise_type(contributor) == "Mentor" and contributor.get("availability") != "Unavailable":
            max_startups = contributor.get("capacity", {}).get("globalMaxStartupAssignments") if isinstance(contributor.get("capacity"), dict) else contributor.get("capacity", 0)
            if max_startups and max_startups <= 2:
                stats["lowCapacityMentors"].append(contributor.get("name"))

    prompt = f"""
    You are the AI ecosystem analyst for Lattice, a programme-first startup relationship orchestration platform.
    Review these ecosystem statistics:
    {json.dumps(stats, indent=2)}

    Return ONLY a JSON array with exactly 4 objects. Each object must include:
    type, title, description, severity.

    Cover:
    1. a programme supply-demand gap
    2. a mentor capacity warning
    3. a reusable outcome pattern
    4. a strategic recommendation for organisation admins
    """

    raw = _retryable_model_call(
        lambda: client.models.generate_content(model="gemini-2.5-flash", contents=prompt).text.strip()
    )

    try:
        cleaned = raw
        if cleaned.startswith("```"):
            cleaned = cleaned.split("\n", 1)[1]
            cleaned = cleaned.rsplit("```", 1)[0]
        insights = json.loads(cleaned)
    except (json.JSONDecodeError, IndexError):
        insights = [
            {
                "type": "error",
                "title": "Could not parse AI insights",
                "description": raw,
                "severity": "low",
            }
        ]

    return {"insights": insights, "stats": stats}


@https_fn.on_call()
def get_dashboard_stats(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_admin(req, db)
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
