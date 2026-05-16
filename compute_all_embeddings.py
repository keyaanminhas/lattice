import os
import time

import firebase_admin
from firebase_admin import firestore
from dotenv import load_dotenv
from google import genai

os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
load_dotenv("functions/.env")

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    print("GEMINI_API_KEY not found in functions/.env")
    raise SystemExit(1)

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
                contents=text,
            )
            return response.embeddings[0].values
        except Exception as exc:
            if "429" in str(exc) or "RESOURCE_EXHAUSTED" in str(exc):
                wait = 10 * (2 ** attempt)
                print(f"Rate limited. Waiting {wait} seconds...")
                time.sleep(wait)
            else:
                raise

    response = client.models.embed_content(
        model="gemini-embedding-2",
        contents=text,
    )
    return response.embeddings[0].values


def startup_text(data):
    return (
        f"Startup: {data.get('name', '')}. "
        f"Sector: {data.get('industry', data.get('sector', ''))}. "
        f"Stage: {data.get('stage', '')}. "
        f"Needs: {', '.join(data.get('supportNeeds', []))}. "
        f"Problem: {data.get('problemStatement', '')}. "
        f"Product: {data.get('productDescription', '')}."
    )


def contributor_text(data):
    return (
        f"Contributor: {data.get('name', '')}. "
        f"Types: {', '.join(data.get('contributorTypes', [data.get('type', 'Contributor')]))}. "
        f"Expertise: {', '.join(data.get('expertise', []))}. "
        f"Investment thesis: {', '.join(data.get('investmentThesis', []))}. "
        f"Stages: {', '.join(data.get('supportedStages', data.get('stages', [])))}."
    )


def programme_text(data):
    return (
        f"Programme: {data.get('name', '')}. "
        f"Type: {data.get('type', '')}. "
        f"Target sectors: {', '.join(data.get('targetSectors', []))}. "
        f"Target stages: {', '.join(data.get('targetStages', []))}. "
        f"Expected outcomes: {', '.join(data.get('expectedOutcomes', []))}. "
        f"Eligibility: {' '.join(data.get('eligibilityRules', [])) if isinstance(data.get('eligibilityRules'), list) else data.get('eligibilityRules', '')}."
    )


def train_collection(collection_name, builder):
    count = 0
    for doc in db.collection(collection_name).stream():
        data = doc.to_dict()
        if data.get("embeddingVector"):
            continue
        print(f"Computing embedding for {collection_name}: {data.get('name', doc.id)}")
        vector = get_embedding(builder(data))
        db.collection(collection_name).document(doc.id).update({"embeddingVector": vector})
        count += 1
        time.sleep(1)
    return count


def train_embeddings():
    print("Starting bulk embedding generation for the programme-first model...")
    startup_count = train_collection("companies", startup_text)
    contributor_count = train_collection("contributors", contributor_text)
    programme_count = train_collection("programmes", programme_text)
    print(
        f"\nDone. Generated {startup_count} startup embeddings, "
        f"{contributor_count} contributor embeddings, and {programme_count} programme embeddings."
    )


if __name__ == "__main__":
    train_embeddings()
