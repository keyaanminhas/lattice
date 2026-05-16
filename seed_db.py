import firebase_admin
from firebase_admin import credentials, firestore
import os

# Set emulator host if you want to run this against the local emulator
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"

# Initialize Firebase Admin
try:
    # Use application default credentials
    app = firebase_admin.initialize_app()
    print("Initialized Firebase App with default credentials.")
except Exception as e:
    print(f"Could not initialize with default credentials: {e}")
    print("Make sure you have run: gcloud auth application-default login")
    exit(1)

db = firestore.client()

def seed_data():
    print("Seeding Programmes...")
    programme_ref = db.collection('programmes').document('prog-1')
    programme_ref.set({
        'name': 'AI Startup Accelerator 2026',
        'type': 'Accelerator',
        'targetSectors': ['AI', 'Healthtech', 'SaaS'],
        'targetStages': ['MVP', 'Seed'],
        'region': 'Malaysia',
        'expectedOutcomes': ['Pilot Access', 'Investor Readiness'],
        'status': 'Active'
    })

    print("Seeding Companies...")
    companies = [
        {
            'id': 'comp-1',
            'name': 'MediScan AI',
            'industry': 'Healthtech',
            'stage': 'MVP',
            'country': 'Malaysia',
            'problemStatement': 'Hospitals need faster MRI analysis.',
            'supportNeeds': ['Regulatory Approval', 'Cloud Credits', 'Hospital Partnerships'],
            'verificationStatus': 'Verified'
        },
        {
            'id': 'comp-2',
            'name': 'FinFlow',
            'industry': 'Fintech',
            'stage': 'Seed',
            'country': 'Singapore',
            'problemStatement': 'SMEs struggle with cash flow prediction.',
            'supportNeeds': ['Go-to-market Strategy', 'Series A Funding'],
            'verificationStatus': 'Verified'
        }
    ]
    for c in companies:
        db.collection('companies').document(c['id']).set(c)

    print("Seeding Contributors...")
    contributors = [
        {
            'id': 'cont-1',
            'name': 'Dr. Sarah Lim',
            'type': 'Mentor',
            'expertise': ['Healthtech', 'Regulatory Strategy', 'Clinical Pilots'],
            'supportedStages': ['MVP', 'Seed'],
            'capacity': 3,
            'availability': 'Available',
            'countryCoverage': ['Malaysia', 'Singapore']
        },
        {
            'id': 'cont-2',
            'name': 'Google Cloud (APAC)',
            'type': 'Partner',
            'expertise': ['Cloud Infrastructure', 'AI APIs', 'Credits'],
            'supportedStages': ['Idea', 'MVP', 'Seed', 'Growth'],
            'capacity': 50,
            'availability': 'Available',
            'countryCoverage': ['Global']
        }
    ]
    for cont in contributors:
        db.collection('contributors').document(cont['id']).set(cont)

    print("Seeding Relationships...")
    db.collection('relationships').document('rel-1').set({
        'type': 'Company-to-Mentor',
        'sourceId': 'comp-1',
        'targetId': 'cont-1',
        'programmeContextId': 'prog-1',
        'aiMatchScore': 95,
        'aiExplanation': 'MediScan AI needs regulatory approval help. Dr. Sarah Lim specializes in Healthtech regulatory strategy.',
        'status': 'Recommended',
        'expectedOutcome': 'Clinical pilot roadmap',
        'outcomeAchieved': 'Pending'
    })

    print("✅ Seed complete! Fake data is now in Firestore.")

if __name__ == "__main__":
    seed_data()
