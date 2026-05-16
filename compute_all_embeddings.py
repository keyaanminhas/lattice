import os
import time
from google import genai
import firebase_admin
from firebase_admin import credentials, firestore

os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
from dotenv import load_dotenv
load_dotenv("functions/.env")

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("GEMINI_API_KEY not found in functions/.env")
    exit(1)

client = genai.Client(api_key=api_key)

try:
    firebase_admin.initialize_app()
except ValueError:
    pass

db = firestore.client()

def get_embedding(text):
    for attempt in range(3):
        try:
            response = client.models.embed_content(
                model="gemini-embedding-2",
                contents=text
            )
            return response.embeddings[0].values
        except Exception as e:
            if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                print(f"Rate limited. Waiting {10 * (2**attempt)} seconds...")
                time.sleep(10 * (2**attempt))
            else:
                raise
    # Final attempt
    response = client.models.embed_content(
        model="gemini-embedding-2",
        contents=text
    )
    return response.embeddings[0].values

def train_embeddings():
    print("Starting Bulk Embedding 'Training' Process...")
    
    # 1. Process Companies
    companies = db.collection('companies').stream()
    comp_count = 0
    for doc in companies:
        data = doc.to_dict()
        if 'embeddingVector' in data:
            continue # Already trained
        
        print(f"Computing embedding for Company: {data.get('name')}")
        text = (
            f"Industry: {data.get('industry', '')}. "
            f"Stage: {data.get('stage', '')}. "
            f"Needs: {', '.join(data.get('supportNeeds', []))}. "
            f"Problem: {data.get('problemStatement', '')}"
        )
        vector = get_embedding(text)
        db.collection('companies').document(doc.id).update({'embeddingVector': vector})
        comp_count += 1
        time.sleep(1) # Small delay to avoid basic rate limits

    # 2. Process Contributors
    contributors = db.collection('contributors').stream()
    cont_count = 0
    for doc in contributors:
        data = doc.to_dict()
        if 'embeddingVector' in data:
            continue
            
        print(f"Computing embedding for Contributor: {data.get('name')}")
        text = (
            f"Type: {data.get('type', '')}. "
            f"Expertise: {', '.join(data.get('expertise', []))}. "
            f"Supported Stages: {', '.join(data.get('supportedStages', []))}."
        )
        vector = get_embedding(text)
        db.collection('contributors').document(doc.id).update({'embeddingVector': vector})
        cont_count += 1
        time.sleep(1)

    print(f"\n✅ Training Complete! Generated and saved {comp_count} Company embeddings and {cont_count} Contributor embeddings.")

if __name__ == "__main__":
    train_embeddings()
