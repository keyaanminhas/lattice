import os
import time
import json
import numpy as np
from google import genai
import firebase_admin
from firebase_admin import credentials, firestore

# Point to emulator
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
from dotenv import load_dotenv
load_dotenv("functions/.env")

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("GEMINI_API_KEY not found")
    exit(1)

client = genai.Client(api_key=api_key)

try:
    firebase_admin.initialize_app()
except ValueError:
    pass

db = firestore.client()

def cosine_similarity(a, b):
    dot_product = np.dot(a, b)
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return float(dot_product / (norm_a * norm_b))

def generate_explanation(company, contributor, score):
    prompt = f"""
    You are an AI Relationship Engine. You matched this Company with this Contributor with a score of {score}/100.
    Company Name: {company.get('name')} | Needs: {company.get('supportNeeds')} | Problem: {company.get('problemStatement')}
    Contributor Name: {contributor.get('name')} | Expertise: {contributor.get('expertise')}
    Write a 2-sentence explanation of why this is a good match.
    """
    
    # We will just retry if we hit rate limits
    for attempt in range(5):
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"    [Rate Limit] Waiting 20 seconds...")
                time.sleep(20)
            else:
                raise
    return "AI Explanation failed due to rate limits."

def run_bulk():
    print("Fetching pre-computed embeddings from database...")
    companies = []
    for doc in db.collection('companies').stream():
        data = doc.to_dict()
        data['id'] = doc.id
        if 'embeddingVector' in data:
            companies.append(data)
            
    contributors = []
    for doc in db.collection('contributors').stream():
        data = doc.to_dict()
        data['id'] = doc.id
        if 'embeddingVector' in data:
            contributors.append(data)

    print(f"Found {len(companies)} companies and {len(contributors)} contributors.")
    
    matches_found = 0
    # Process them
    for comp in companies:
        print(f"\nEvaluating: {comp['name']}")
        for cont in contributors:
            similarity = cosine_similarity(comp['embeddingVector'], cont['embeddingVector'])
            score = round(similarity * 100, 2)
            
            # Use a strict threshold so we don't generate too many explanations
            if score > 72.0:
                print(f"  -> MATCH FOUND: {cont['name']} (Score: {score})")
                print("     Generating AI Explanation (respecting free tier limits...)")
                explanation = generate_explanation(comp, cont, score)
                
                # Save relationship
                rec = {
                    'type': f"Company-to-{cont.get('type', 'Contributor')}",
                    'sourceId': comp['id'],
                    'targetId': cont['id'],
                    'aiMatchScore': score,
                    'aiExplanation': explanation,
                    'status': 'Recommended',
                    'expectedOutcome': 'Support ' + ', '.join(comp.get('supportNeeds', [])),
                    'reusabilityTag': False,
                    'createdAt': firestore.SERVER_TIMESTAMP
                }
                db.collection('relationships').add(rec)
                matches_found += 1
                
                # Explicit sleep to heavily respect the 5 req/min free limit
                time.sleep(13)

    print(f"\n✅ Bulk matching complete! Generated {matches_found} strong relationships.")

if __name__ == "__main__":
    run_bulk()
