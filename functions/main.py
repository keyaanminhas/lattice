import os
import json
import time
import numpy as np
from datetime import datetime
from firebase_functions import https_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore

# We will initialize Firebase Admin lazily inside functions
set_global_options(max_instances=10)

# Retry config for Gemini API rate limits
MAX_RETRIES = 3
RETRY_DELAY = 2  # seconds, doubles each retry


def _sanitize(doc_dict: dict) -> dict:
    """Remove or convert non-serializable Firestore fields (timestamps)."""
    clean = {}
    for k, v in doc_dict.items():
        if v is None:
            clean[k] = None
        elif isinstance(v, datetime):
            clean[k] = v.isoformat()
        elif isinstance(v, list):
            clean[k] = v
        elif isinstance(v, dict):
            clean[k] = _sanitize(v)
        else:
            clean[k] = v
    return clean

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _init_firebase():
    """Safely initialize Firebase Admin (idempotent)."""
    try:
        initialize_app()
    except ValueError:
        pass
    return firestore.client()


def _get_genai_client():
    """Return a google-genai Client configured with the API key."""
    from google import genai
    api_key = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")
    return genai.Client(api_key=api_key)


def get_embedding(text: str) -> list[float]:
    """Generates an embedding for the given text using Gemini, with retry on rate limit."""
    client = _get_genai_client()
    for attempt in range(MAX_RETRIES):
        try:
            response = client.models.embed_content(
                model="gemini-embedding-2",
                contents=text
            )
            return response.embeddings[0].values
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                wait = RETRY_DELAY * (2 ** attempt)
                time.sleep(wait)
            else:
                raise
    # Final attempt without catching
    response = client.models.embed_content(
        model="gemini-embedding-2",
        contents=text
    )
    return response.embeddings[0].values


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Calculates cosine similarity between two vectors."""
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))


def generate_explanation(company_data: dict, contributor_data: dict, score: float) -> str:
    """Generates a human-readable explanation of why this match makes sense."""
    client = _get_genai_client()

    prompt = f"""
    You are an AI Relationship Engine for an innovation ecosystem.
    You matched this Company with this Contributor with a score of {score}/100.

    Company: {json.dumps(_sanitize(company_data))}
    Contributor: {json.dumps(_sanitize(contributor_data))}

    Write a 2-sentence explanation of why this is a good match based on the company's needs and the contributor's expertise.
    Also mention one potential risk (e.g. capacity or stage mismatch).
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )
    return response.text.strip()


# ---------------------------------------------------------------------------
# FUNCTION 1: Generate matches for a single company
# ---------------------------------------------------------------------------

@https_fn.on_call()
def generate_matches_for_company(req: https_fn.CallableRequest):
    """
    Callable from the frontend.
    Accepts: { "companyId": "comp-1" }
    Returns: List of recommended relationships.
    """
    db = _init_firebase()

    company_id = req.data.get("companyId")
    if not company_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="companyId is required."
        )

    # Fetch company
    company_doc = db.collection('companies').document(company_id).get()
    if not company_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Company not found."
        )
    company_data = company_doc.to_dict()

    # Build company text for embedding
    company_text = (
        f"Industry: {company_data.get('industry', '')}. "
        f"Stage: {company_data.get('stage', '')}. "
        f"Needs: {', '.join(company_data.get('supportNeeds', []))}. "
        f"Problem: {company_data.get('problemStatement', '')}"
    )
    company_embedding = get_embedding(company_text)

    # Fetch all contributors
    recommendations = []
    for cont_doc in db.collection('contributors').stream():
        cont_data = cont_doc.to_dict()
        if cont_data.get('availability') == 'Unavailable' or cont_data.get('capacity', 0) <= 0:
            continue

        cont_text = (
            f"Type: {cont_data.get('type', '')}. "
            f"Expertise: {', '.join(cont_data.get('expertise', []))}. "
            f"Supported Stages: {', '.join(cont_data.get('supportedStages', []))}."
        )
        cont_embedding = get_embedding(cont_text)

        similarity = cosine_similarity(company_embedding, cont_embedding)
        score = round(similarity * 100, 2)

        if score > 60:
            explanation = generate_explanation(company_data, cont_data, score)

            recommendation = {
                'type': f"Company-to-{cont_data.get('type', 'Contributor')}",
                'sourceId': company_id,
                'targetId': cont_doc.id,
                'programmeContextId': '',
                'aiMatchScore': score,
                'aiExplanation': explanation,
                'risks': [],
                'status': 'Recommended',
                'expectedOutcome': 'Support ' + ', '.join(company_data.get('supportNeeds', [])),
                'reusabilityTag': False,
                'createdAt': firestore.SERVER_TIMESTAMP
            }

            new_rel_ref = db.collection('relationships').document()
            recommendation['id'] = new_rel_ref.id
            new_rel_ref.set(recommendation)
            recommendations.append(recommendation)

    return {"matches": recommendations}


# ---------------------------------------------------------------------------
# FUNCTION 2: Generate matches for all companies in a programme
# ---------------------------------------------------------------------------

@https_fn.on_call()
def generate_matches_for_programme(req: https_fn.CallableRequest):
    """
    Runs AI matching for every verified company that fits a programme.
    Accepts: { "programmeId": "prog-1" }
    Returns: { "totalMatches": N, "companiesProcessed": N }
    """
    db = _init_firebase()

    programme_id = req.data.get("programmeId")
    if not programme_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="programmeId is required."
        )

    prog_doc = db.collection('programmes').document(programme_id).get()
    if not prog_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Programme not found."
        )
    prog_data = prog_doc.to_dict()

    target_sectors = prog_data.get('targetSectors', [])
    target_stages = prog_data.get('targetStages', [])

    # Find eligible companies
    companies_processed = 0
    total_matches = 0

    for comp_doc in db.collection('companies').stream():
        comp_data = comp_doc.to_dict()
        if comp_data.get('verificationStatus') != 'Verified':
            continue
        if comp_data.get('industry') not in target_sectors:
            continue
        if comp_data.get('stage') not in target_stages:
            continue

        companies_processed += 1

        # Build embedding text
        company_text = (
            f"Industry: {comp_data.get('industry', '')}. "
            f"Stage: {comp_data.get('stage', '')}. "
            f"Needs: {', '.join(comp_data.get('supportNeeds', []))}. "
            f"Problem: {comp_data.get('problemStatement', '')}"
        )
        company_embedding = get_embedding(company_text)

        for cont_doc in db.collection('contributors').stream():
            cont_data = cont_doc.to_dict()
            if cont_data.get('availability') == 'Unavailable' or cont_data.get('capacity', 0) <= 0:
                continue

            cont_text = (
                f"Type: {cont_data.get('type', '')}. "
                f"Expertise: {', '.join(cont_data.get('expertise', []))}. "
                f"Supported Stages: {', '.join(cont_data.get('supportedStages', []))}."
            )
            cont_embedding = get_embedding(cont_text)

            similarity = cosine_similarity(company_embedding, cont_embedding)
            score = round(similarity * 100, 2)

            if score > 65:  # Higher threshold for bulk matching
                explanation = generate_explanation(comp_data, cont_data, score)
                rec = {
                    'type': f"Company-to-{cont_data.get('type', 'Contributor')}",
                    'sourceId': comp_doc.id,
                    'targetId': cont_doc.id,
                    'programmeContextId': programme_id,
                    'aiMatchScore': score,
                    'aiExplanation': explanation,
                    'risks': [],
                    'status': 'Recommended',
                    'expectedOutcome': 'Support ' + ', '.join(comp_data.get('supportNeeds', [])),
                    'reusabilityTag': False,
                    'createdAt': firestore.SERVER_TIMESTAMP
                }
                new_ref = db.collection('relationships').document()
                rec['id'] = new_ref.id
                new_ref.set(rec)
                total_matches += 1

    return {"companiesProcessed": companies_processed, "totalMatches": total_matches}


# ---------------------------------------------------------------------------
# FUNCTION 3: Update relationship status (Approve / Reject / Modify)
# ---------------------------------------------------------------------------

@https_fn.on_call()
def update_relationship_status(req: https_fn.CallableRequest):
    """
    Admin action to change a relationship's status.
    Accepts: { "relationshipId": "...", "newStatus": "Approved" | "Rejected" | "Active" | "Needs Review" }
    """
    db = _init_firebase()

    rel_id = req.data.get("relationshipId")
    new_status = req.data.get("newStatus")

    valid_statuses = ['Recommended', 'Pending Approval', 'Approved', 'Active', 'Needs Review', 'Completed', 'Rejected']
    if not rel_id or not new_status:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="relationshipId and newStatus are required."
        )
    if new_status not in valid_statuses:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message=f"Invalid status. Must be one of: {valid_statuses}"
        )

    rel_ref = db.collection('relationships').document(rel_id)
    rel_doc = rel_ref.get()
    if not rel_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Relationship not found."
        )

    rel_ref.update({
        'status': new_status,
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

    return {"success": True, "relationshipId": rel_id, "newStatus": new_status}


# ---------------------------------------------------------------------------
# FUNCTION 4: Submit engagement outcome / feedback
# ---------------------------------------------------------------------------

@https_fn.on_call()
def submit_outcome(req: https_fn.CallableRequest):
    """
    Submit feedback for a completed relationship.
    Accepts: {
        "relationshipId": "...",
        "companyRating": 4,
        "companyFeedback": "...",
        "contributorRating": 5,
        "contributorFeedback": "...",
        "outcomeAchieved": "Yes" | "Partial" | "No"
    }
    """
    db = _init_firebase()
    data = req.data

    rel_id = data.get("relationshipId")
    if not rel_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="relationshipId is required."
        )

    rel_doc = db.collection('relationships').document(rel_id).get()
    if not rel_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Relationship not found."
        )

    # Generate AI lesson summary
    rel_data = rel_doc.to_dict()
    client = _get_genai_client()
    lesson_prompt = f"""
    A relationship between a company and contributor just completed.
    Relationship details: {json.dumps(_sanitize(rel_data))}
    Company rated {data.get('companyRating')}/5: "{data.get('companyFeedback', '')}"
    Contributor rated {data.get('contributorRating')}/5: "{data.get('contributorFeedback', '')}"
    Outcome achieved: {data.get('outcomeAchieved')}

    Write a 1-sentence lesson learned that can help improve future AI matching.
    """
    lesson_response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=lesson_prompt
    )
    lesson = lesson_response.text.strip()

    outcome = {
        'relationshipId': rel_id,
        'companyRating': data.get('companyRating', 0),
        'companyFeedback': data.get('companyFeedback', ''),
        'contributorRating': data.get('contributorRating', 0),
        'contributorFeedback': data.get('contributorFeedback', ''),
        'outcomeAchieved': data.get('outcomeAchieved', 'Pending'),
        'outcomeType': data.get('outcomeType', ''),
        'relationshipQuality': 'High' if (data.get('companyRating', 0) + data.get('contributorRating', 0)) / 2 >= 4 else ('Medium' if (data.get('companyRating', 0) + data.get('contributorRating', 0)) / 2 >= 3 else 'Low'),
        'futureRecommendationValue': data.get('outcomeAchieved') in ['Yes', 'Partial'],
        'lessonLearned': lesson,
        'createdAt': firestore.SERVER_TIMESTAMP
    }

    outcome_ref = db.collection('outcomes').document()
    outcome['id'] = outcome_ref.id
    outcome_ref.set(outcome)

    # Update the relationship status to Completed
    db.collection('relationships').document(rel_id).update({
        'status': 'Completed',
        'outcomeAchieved': data.get('outcomeAchieved', 'Pending'),
        'updatedAt': firestore.SERVER_TIMESTAMP
    })

    return {"success": True, "outcomeId": outcome['id'], "lessonLearned": lesson}


# ---------------------------------------------------------------------------
# FUNCTION 5: AI Insights - ecosystem bottleneck and learning loop
# ---------------------------------------------------------------------------

@https_fn.on_call()
def get_ai_insights(req: https_fn.CallableRequest):
    """
    Generates AI-powered insights about the ecosystem's health.
    Accepts: {} (no required params)
    Returns: { "insights": [...] }
    """
    db = _init_firebase()
    client = _get_genai_client()

    # Gather ecosystem stats
    companies = [doc.to_dict() for doc in db.collection('companies').stream()]
    contributors = [doc.to_dict() for doc in db.collection('contributors').stream()]
    relationships = [doc.to_dict() for doc in db.collection('relationships').stream()]
    outcomes = [doc.to_dict() for doc in db.collection('outcomes').stream()]

    stats = {
        'totalCompanies': len(companies),
        'verifiedCompanies': len([c for c in companies if c.get('verificationStatus') == 'Verified']),
        'totalContributors': len(contributors),
        'availableContributors': len([c for c in contributors if c.get('availability') == 'Available']),
        'totalRelationships': len(relationships),
        'recommendedRelationships': len([r for r in relationships if r.get('status') == 'Recommended']),
        'activeRelationships': len([r for r in relationships if r.get('status') == 'Active']),
        'completedRelationships': len([r for r in relationships if r.get('status') == 'Completed']),
        'totalOutcomes': len(outcomes),
        'successfulOutcomes': len([o for o in outcomes if o.get('outcomeAchieved') == 'Yes']),
        'companySupportNeeds': {},
        'contributorExpertise': {},
        'lowCapacityContributors': []
    }

    # Count support needs
    for c in companies:
        for need in c.get('supportNeeds', []):
            stats['companySupportNeeds'][need] = stats['companySupportNeeds'].get(need, 0) + 1

    # Count expertise supply
    for c in contributors:
        for exp in c.get('expertise', []):
            stats['contributorExpertise'][exp] = stats['contributorExpertise'].get(exp, 0) + 1
        if c.get('capacity', 0) <= 1 and c.get('availability') != 'Unavailable':
            stats['lowCapacityContributors'].append(c.get('name', 'Unknown'))

    prompt = f"""
    You are an AI Ecosystem Analyst for an innovation ecosystem platform called Lattice.

    Here are the current ecosystem statistics:
    {json.dumps(stats, indent=2)}

    Based on these statistics, generate exactly 4 insights:
    1. A supply/demand gap alert (where company needs exceed contributor expertise)
    2. A capacity warning (contributors running low on capacity)
    3. A "what worked" insight (based on outcomes)
    4. A strategic recommendation for the ecosystem owner

    Return your response as a JSON array of objects with keys: "type", "title", "description", "severity" (low/medium/high).
    Return ONLY the JSON array, no other text.
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )

    try:
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        insights = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        insights = [{"type": "error", "title": "Could not parse insights", "description": response.text, "severity": "low"}]

    return {"insights": insights, "stats": stats}


# ---------------------------------------------------------------------------
# FUNCTION 6: AI Profile Summarisation
# ---------------------------------------------------------------------------

@https_fn.on_call()
def summarise_company_profile(req: https_fn.CallableRequest):
    """
    Takes a company ID and returns an AI-generated structured summary with auto-tags.
    Accepts: { "companyId": "comp-1" }
    """
    db = _init_firebase()
    client = _get_genai_client()

    company_id = req.data.get("companyId")
    if not company_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="companyId is required."
        )

    company_doc = db.collection('companies').document(company_id).get()
    if not company_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Company not found."
        )

    company_data = company_doc.to_dict()

    prompt = f"""
    You are an AI assistant for an innovation ecosystem platform.
    Summarise this company profile in a structured way.

    Company data: {json.dumps(_sanitize(company_data))}

    Return a JSON object with these keys:
    - "summary": a 2-sentence executive summary
    - "autoTags": an array of relevant tags (e.g. "AI", "Healthtech", "MVP-stage", "B2B")
    - "suggestedProgrammes": an array of programme types that would benefit this company
    - "riskFlags": an array of any concerns (e.g. "Missing pitch deck", "No revenue data")
    - "readinessScore": a number from 1-10 for ecosystem readiness

    Return ONLY the JSON object, no other text.
    """

    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt
    )

    try:
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            raw = raw.rsplit("```", 1)[0]
        result = json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        result = {"summary": response.text, "autoTags": [], "suggestedProgrammes": [], "riskFlags": [], "readinessScore": 0}

    return {"companyId": company_id, "profile": result}


# ---------------------------------------------------------------------------
# FUNCTION 7: Get dashboard stats (lightweight, no AI calls)
# ---------------------------------------------------------------------------

@https_fn.on_call()
def get_dashboard_stats(req: https_fn.CallableRequest):
    """
    Returns ecosystem dashboard statistics.
    No AI calls - fast and free.
    """
    db = _init_firebase()

    companies = list(db.collection('companies').stream())
    contributors = list(db.collection('contributors').stream())
    relationships = list(db.collection('relationships').stream())
    programmes = list(db.collection('programmes').stream())

    rel_dicts = [r.to_dict() for r in relationships]
    cont_dicts = [c.to_dict() for c in contributors]

    total_capacity = sum(c.get('capacity', 0) for c in cont_dicts)
    used_capacity = len([r for r in rel_dicts if r.get('status') in ['Active', 'Approved']])

    completed = [r for r in rel_dicts if r.get('status') == 'Completed']
    # Get outcomes for success rate
    outcomes = [doc.to_dict() for doc in db.collection('outcomes').stream()]
    successful = len([o for o in outcomes if o.get('outcomeAchieved') == 'Yes'])
    success_rate = round((successful / len(outcomes) * 100), 1) if outcomes else 0

    return {
        "activeProgrammes": len([p.to_dict() for p in programmes if p.to_dict().get('status') == 'Active']),
        "totalCompanies": len(companies),
        "verifiedCompanies": len([c.to_dict() for c in companies if c.to_dict().get('verificationStatus') == 'Verified']),
        "pendingCompanies": len([c.to_dict() for c in companies if c.to_dict().get('verificationStatus') == 'Pending']),
        "totalContributors": len(contributors),
        "availableContributors": len([c for c in cont_dicts if c.get('availability') == 'Available']),
        "totalRelationships": len(relationships),
        "pendingRecommendations": len([r for r in rel_dicts if r.get('status') == 'Recommended']),
        "activeRelationships": len([r for r in rel_dicts if r.get('status') == 'Active']),
        "completedRelationships": len(completed),
        "contributorCapacity": f"{used_capacity}/{total_capacity}",
        "outcomeSuccessRate": success_rate
    }