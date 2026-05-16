import json
import os
import re
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
VALID_DECISIONS = {"Approved", "Rejected"}
VALID_RELATIONSHIP_STATUSES = {"Approved", "Active", "Needs Review", "Completed", "Rejected", "Expired"}
VALID_OUTCOME_ACHIEVEMENTS = {"Yes", "Partial", "No"}
ACTIVE_MENTOR_RELATIONSHIP_STATUSES = {"Approved", "Active", "Needs Review"}
AI_INSIGHT_SEVERITIES = {"low", "medium", "high"}
PROFILE_REQUIRED_FIELDS = (
    "summary",
    "autoTags",
    "suggestedProgrammeTypes",
    "riskFlags",
    "profileCompletenessScore",
    "readinessScore",
)
INSIGHT_REQUIRED_FIELDS = ("type", "title", "description", "severity")
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
}


def _sanitize(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _sanitize(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_sanitize(item) for item in value]
    if isinstance(value, datetime):
        return value.isoformat()
    return value


def _init_firebase():
    try:
        initialize_app()
    except ValueError:
        pass
    return firestore.client()


def _get_genai_client():
    from google import genai

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.FAILED_PRECONDITION,
            message="GEMINI_API_KEY is not configured.",
        )
    return genai.Client(api_key=api_key)


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


def _generate_text(model: str, prompt: str) -> str:
    client = _get_genai_client()

    def _call():
        response = client.models.generate_content(model=model, contents=prompt)
        return (response.text or "").strip()

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


def _blended_total(base_score: float, similarity: float, semantic_weight: float = 20.0) -> float:
    return round(min(100.0, base_score * 0.8 + max(similarity, 0.0) * semantic_weight), 2)


def _apply_risk_penalties(score: float, risks: list[str]) -> tuple[float, list[str]]:
    unique_risks = list(dict.fromkeys(risks))
    penalty = sum(RISK_PENALTIES.get(risk, 0.0) for risk in unique_risks)
    adjusted = round(max(0.0, min(100.0, score - penalty)), 2)
    return adjusted, unique_risks


def _startup_programme_score(startup: dict, programme: dict, similarity: float) -> tuple[float, list[str]]:
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
    total = _blended_total(sector_fit + stage_fit + need_fit + eligibility_fit + region_fit, similarity)

    if sector_fit < 12:
        risks.append("Sector fit is weak for this programme.")
    if stage_fit == 0:
        risks.append("Startup stage is outside the programme's main focus.")
    if need_fit < 10:
        risks.append("Programme outcomes do not strongly cover the startup's top support needs.")

    return _apply_risk_penalties(total, risks)


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

    total, risks = _apply_risk_penalties(total, risks)
    return total, risks, contributor_type


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

    return _apply_risk_penalties(total, risks)


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


def _build_explanation_fallback(context: str, payload: dict) -> str:
    score = payload.get("score")
    score_text = f"Score {score}" if isinstance(score, (int, float)) else "The match"
    startup = payload.get("startup", {}).get("name")
    programme = payload.get("programme", {}).get("name")
    contributor = payload.get("contributor", {}).get("name")

    if startup and programme and contributor:
        subject = f"{contributor} is a strong fit for {startup} within {programme}"
    elif startup and programme:
        subject = f"{startup} aligns well with {programme}"
    elif contributor and programme:
        subject = f"{contributor} aligns well with {programme}"
    else:
        subject = f"{context} shows a strong fit"

    risks = payload.get("risks") or []
    risk_text = risks[0] if risks else "No blocking risk flags were detected, but admin review should still confirm fit."
    return f"{subject}. {score_text} is supported by the structured scoring signals. Risk to watch: {risk_text}"


def _generate_explanation(context: str, payload: dict) -> str:
    prompt = f"""
    You are the AI Relationship Engine for a programme-first startup ecosystem platform called Lattice.
    Context: {context}
    Data: {json.dumps(_sanitize(payload))}

    Write a concise explanation in 2 sentences.
    Sentence 1: why the match is strong.
    Sentence 2: one realistic governance or capacity risk to watch.
    """

    _get_genai_client()
    try:
        explanation = _generate_text("gemini-3.1-flash-lite", prompt)
        if not explanation:
            return _build_explanation_fallback(context, payload)
        return explanation
    except Exception:
        return _build_explanation_fallback(context, payload)


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
    )

    doc_id = existing["id"] if existing else _recommendation_document_id(
        recommendation_type, source_entity_id, target_entity_id, programme_id
    )
    ref = db.collection("recommendations").document(doc_id)
    document_payload = {"id": doc_id, **payload}
    ref.set(document_payload, merge=bool(existing))

    response = {"id": doc_id, **payload}
    if existing and "createdAt" in existing:
        response["createdAt"] = existing["createdAt"]
    return response


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
    data = _require_data(req)
    startup_id = _require_string(data, "startupId")

    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
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
        if score < STARTUP_PROGRAMME_THRESHOLD:
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
        score, risks, contributor_type = _contributor_programme_score(contributor, programme, similarity)
        if score < CONTRIBUTOR_PROGRAMME_THRESHOLD:
            continue

        explanation = _generate_explanation(
            "Contributor-to-Programme recommendation",
            {
                "contributor": contributor,
                "programme": programme,
                "recommendationType": f"{contributor_type}-to-Programme",
                "score": score,
                "risks": risks,
            },
        )
        recommendation = _upsert_recommendation(
            db,
            f"{contributor_type}-to-Programme",
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
    data = _require_data(req)
    startup_id = _require_string(data, "startupId")
    programme_id = _require_string(data, "programmeId")

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
        score, risks = _startup_mentor_score(startup, contributor, programme, similarity)
        if score < MENTOR_RECOMMENDATION_THRESHOLD:
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

    return {"success": True, "recommendationId": recommendation_id, "decision": decision, "createdId": created_id}


@https_fn.on_call()
def update_relationship_status(req: https_fn.CallableRequest):
    db = _init_firebase()
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
    lesson = _generate_text("gemini-3.1-flash-lite", lesson_prompt)

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

    return {"success": True, "outcomeId": outcome_id, "aiLesson": lesson}


def _summary_prompt(startup: dict) -> str:
    return f"""
    You are an AI assistant for a programme-first startup ecosystem platform.
    Analyse this startup profile and return ONLY a JSON object with:
    summary, autoTags, suggestedProgrammeTypes, riskFlags, profileCompletenessScore, readinessScore.

    Startup: {json.dumps(_sanitize(startup))}
    """


@https_fn.on_call()
def summarise_startup_profile(req: https_fn.CallableRequest):
    db = _init_firebase()
    data = _require_data(req)
    startup_id = _require_string(data, "startupId")

    startup_doc = _get_document_or_error(db, "companies", startup_id, "Startup")
    startup = startup_doc.to_dict()
    profile = _generate_json_payload("gemini-3.1-flash-lite", _summary_prompt(startup), dict, _normalise_profile_payload)
    return {"startupId": startup_id, "profile": profile}


@https_fn.on_call()
def summarise_company_profile(req: https_fn.CallableRequest):
    db = _init_firebase()
    data = _require_data(req)
    company_id = _require_string(data, "companyId")

    startup_doc = _get_document_or_error(db, "companies", company_id, "Startup")
    startup = startup_doc.to_dict()
    profile = _generate_json_payload("gemini-3.1-flash-lite", _summary_prompt(startup), dict, _normalise_profile_payload)
    return {"startupId": company_id, "profile": profile}


@https_fn.on_call()
def get_ai_insights(req: https_fn.CallableRequest):
    db = _init_firebase()
    _require_data(req)

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

    insights = _generate_json_payload("gemini-3.1-flash-lite", prompt, list, _normalise_insights_payload)
    return {"insights": insights, "stats": stats}


@https_fn.on_call()
def get_dashboard_stats(req: https_fn.CallableRequest):
    db = _init_firebase()
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
