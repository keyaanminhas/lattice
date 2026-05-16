import os
import time

import firebase_admin
from firebase_admin import firestore
from dotenv import load_dotenv

os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
load_dotenv("functions/.env")

try:
    firebase_admin.initialize_app()
except ValueError:
    pass

db = firestore.client()


def source_name(source_id):
    if source_id.startswith("comp-"):
        doc = db.collection("companies").document(source_id).get()
    else:
        doc = db.collection("contributors").document(source_id).get()
    return doc.to_dict().get("name", source_id) if doc.exists else source_id


def run_bulk():
    print("Programme-first bulk generation helper")
    print("This script assumes startup, contributor, and programme embeddings already exist.")
    print()

    for startup_doc in db.collection("companies").stream():
        startup = startup_doc.to_dict()
        if startup.get("verificationStatus") != "Verified":
            continue
        print(f"Startup ready for programme recommendations: {startup.get('name')}")

    print()
    print("Use the deployed callable functions to create recommendations:")
    print("- recommend_programmes_for_startup")
    print("- recommend_contributor_to_programmes")
    print("- recommend_mentor_for_startup")
    print()
    print("Pending recommendation queue:")

    count = 0
    for rec_doc in db.collection("recommendations").stream():
        rec = rec_doc.to_dict()
        if rec.get("status") != "Pending Approval":
            continue
        count += 1
        print(
            f"{count}. {rec.get('recommendationType')} | "
            f"{source_name(rec.get('sourceEntityId', ''))} -> {rec.get('programmeId')} | "
            f"Score {rec.get('matchScore')}"
        )
        time.sleep(0.1)

    if count == 0:
        print("No pending recommendations.")


if __name__ == "__main__":
    run_bulk()
