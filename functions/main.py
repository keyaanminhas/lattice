import os
import json
import numpy as np
import google.generativeai as genai
from firebase_functions import https_fn
from firebase_functions.options import set_global_options
from firebase_admin import initialize_app, firestore

# Initialize Firebase Admin
initialize_app()
db = firestore.client()

set_global_options(max_instances=10)

def get_gemini_key():
    # Make sure to set GEMINI_API_KEY in your environment, or hardcode here for testing
    api_key = os.environ.get("GEMINI_API_KEY", "YOUR_GEMINI_API_KEY")
    genai.configure(api_key=api_key)

def get_embedding(text: str) -> list[float]:
    """Generates an embedding for the given text using Gemini."""
    get_gemini_key()
    result = genai.embed_content(
        model="models/text-embedding-004",
        content=text,
        task_type="retrieval_document"
    )
    return result['embedding']

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Calculates cosine similarity between two vectors."""
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot_product / (norm_a * norm_b)

def generate_explanation(company_data: dict, contributor_data: dict, score: float) -> str:
    """Generates a human-readable explanation of why this match makes sense."""
    get_gemini_key()
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    prompt = f"""
    You are an AI Relationship Engine for an innovation ecosystem.
    You matched this Company with this Contributor with a score of {score}/100.
    
    Company: {json.dumps(company_data)}
    Contributor: {json.dumps(contributor_data)}
    
    Write a 2-sentence explanation of why this is a good match based on the company's needs and the contributor's expertise.
    Also mention one potential risk (e.g. capacity or stage mismatch).
    """
    
    response = model.generate_content(prompt)
    return response.text.strip()

@https_fn.on_call()
def generate_matches_for_company(req: https_fn.CallableRequest) -> any:
    """
    Cloud Function callable from the frontend.
    Accepts: { "companyId": "comp-1" }
    Returns: List of recommended relationships.
    """
    company_id = req.data.get("companyId")
    if not company_id:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="companyId is required."
        )

    # 1. Fetch Company Data
    company_ref = db.collection('companies').document(company_id)
    company_doc = company_ref.get()
    if not company_doc.exists:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.NOT_FOUND,
            message="Company not found."
        )
    company_data = company_doc.to_dict()

    # 2. Build Company Text for Embedding
    company_text = f"Industry: {company_data.get('industry', '')}. " \
                   f"Stage: {company_data.get('stage', '')}. " \
                   f"Needs: {', '.join(company_data.get('supportNeeds', []))}. " \
                   f"Problem: {company_data.get('problemStatement', '')}"
    
    company_embedding = get_embedding(company_text)

    # 3. Fetch all Contributors
    contributors_ref = db.collection('contributors').stream()
    recommendations = []

    for cont_doc in contributors_ref:
        cont_data = cont_doc.to_dict()
        if cont_data.get('availability') == 'Unavailable' or cont_data.get('capacity', 0) <= 0:
            continue
        
        # 4. Build Contributor Text for Embedding
        cont_text = f"Expertise: {', '.join(cont_data.get('expertise', []))}. " \
                    f"Supported Stages: {', '.join(cont_data.get('supportedStages', []))}."
        
        cont_embedding = get_embedding(cont_text)

        # 5. Calculate Similarity (Score out of 100)
        similarity = cosine_similarity(company_embedding, cont_embedding)
        score = round(similarity * 100, 2)
        
        if score > 60: # Threshold for a "good" match
            # 6. Generate AI Explanation
            explanation = generate_explanation(company_data, cont_data, score)
            
            recommendation = {
                'type': f"Company-to-{cont_data.get('type', 'Contributor')}",
                'sourceId': company_id,
                'targetId': cont_doc.id,
                'aiMatchScore': score,
                'aiExplanation': explanation,
                'status': 'Recommended',
                'expectedOutcome': 'Support ' + ', '.join(company_data.get('supportNeeds', [])),
                'reusabilityTag': False
            }
            
            # Save to Firestore
            new_rel_ref = db.collection('relationships').document()
            recommendation['id'] = new_rel_ref.id
            new_rel_ref.set(recommendation)
            
            recommendations.append(recommendation)

    return {"matches": recommendations}