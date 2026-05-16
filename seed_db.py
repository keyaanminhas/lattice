import firebase_admin
from firebase_admin import credentials, firestore
import os

# Point to local emulator
os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"

try:
    app = firebase_admin.initialize_app()
    print("Initialized Firebase App.")
except Exception as e:
    print(f"Error: {e}")
    exit(1)

db = firestore.client()

def seed_data():
    # ===== ECOSYSTEM =====
    print("Seeding Ecosystem...")
    db.collection('ecosystems').document('eco-1').set({
        'name': 'Malaysia Startup Growth Ecosystem',
        'owner': 'Cradle Fund',
        'countries': ['Malaysia', 'Singapore'],
        'focusAreas': ['AI', 'Fintech', 'Healthtech', 'Sustainability', 'EdTech'],
        'createdAt': firestore.SERVER_TIMESTAMP
    })

    # ===== PROGRAMMES =====
    print("Seeding Programmes...")
    programmes = [
        {
            'id': 'prog-1',
            'ecosystemId': 'eco-1',
            'name': 'AI Startup Accelerator 2026',
            'type': 'Accelerator',
            'targetSectors': ['AI', 'Healthtech', 'SaaS'],
            'targetStages': ['MVP', 'Seed'],
            'region': 'Malaysia',
            'eligibilityRules': 'Must be registered in Malaysia. Must have a working prototype.',
            'expectedOutcomes': ['Pilot Access', 'Investor Readiness', 'Cloud Adoption'],
            'status': 'Active',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'prog-2',
            'ecosystemId': 'eco-1',
            'name': 'HealthTech Commercialisation Programme',
            'type': 'Grant',
            'targetSectors': ['Healthtech', 'Biotech', 'MedTech'],
            'targetStages': ['Seed', 'Growth'],
            'region': 'Malaysia',
            'eligibilityRules': 'Must have clinical validation or pilot data.',
            'expectedOutcomes': ['Regulatory Approval', 'Hospital Partnerships', 'Funding'],
            'status': 'Active',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'prog-3',
            'ecosystemId': 'eco-1',
            'name': 'Fintech Innovation Challenge 2026',
            'type': 'Challenge',
            'targetSectors': ['Fintech', 'InsurTech', 'WealthTech'],
            'targetStages': ['Idea', 'MVP'],
            'region': 'Southeast Asia',
            'eligibilityRules': 'Open to ASEAN-based startups.',
            'expectedOutcomes': ['Banking Partnerships', 'Regulatory Sandbox Access'],
            'status': 'Active',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'prog-4',
            'ecosystemId': 'eco-1',
            'name': 'Green Sustainability Bootcamp',
            'type': 'Bootcamp',
            'targetSectors': ['Sustainability', 'CleanTech', 'AgriTech'],
            'targetStages': ['Idea', 'MVP', 'Seed'],
            'region': 'Malaysia',
            'eligibilityRules': 'Must address a UN SDG goal.',
            'expectedOutcomes': ['ESG Compliance', 'Grant Readiness', 'Impact Measurement'],
            'status': 'Draft',
            'createdAt': firestore.SERVER_TIMESTAMP
        }
    ]
    for p in programmes:
        db.collection('programmes').document(p['id']).set(p)

    # ===== COMPANIES =====
    print("Seeding Companies...")
    companies = [
        {
            'id': 'comp-1',
            'name': 'MediScan AI',
            'industry': 'Healthtech',
            'stage': 'MVP',
            'country': 'Malaysia',
            'teamSize': 5,
            'problemStatement': 'Hospitals need faster and more accurate MRI analysis to reduce diagnostic delays.',
            'productDescription': 'AI-powered MRI analysis tool that detects anomalies 60% faster than manual review.',
            'supportNeeds': ['Regulatory Approval', 'Cloud Credits', 'Hospital Partnerships'],
            'currentChallenges': ['Lack of clinical validation data', 'No regulatory advisor'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-2',
            'name': 'FinFlow',
            'industry': 'Fintech',
            'stage': 'Seed',
            'country': 'Singapore',
            'teamSize': 8,
            'problemStatement': 'SMEs struggle with cash flow prediction and invoice management.',
            'productDescription': 'Cash flow forecasting platform using AI to predict payment cycles and liquidity risks.',
            'supportNeeds': ['Go-to-market Strategy', 'Series A Funding', 'Banking API Partnerships'],
            'currentChallenges': ['Customer acquisition cost too high', 'Need regulatory sandbox access'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-3',
            'name': 'EduLeap',
            'industry': 'EdTech',
            'stage': 'MVP',
            'country': 'Malaysia',
            'teamSize': 4,
            'problemStatement': 'Rural students in Malaysia lack access to quality STEM education.',
            'productDescription': 'Gamified STEM learning platform with offline-first mobile support for rural areas.',
            'supportNeeds': ['Cloud Infrastructure', 'Content Partnerships', 'Government Grant'],
            'currentChallenges': ['Low smartphone penetration in target areas', 'Need Bahasa Malaysia content'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-4',
            'name': 'GreenHarvest',
            'industry': 'AgriTech',
            'stage': 'Idea',
            'country': 'Malaysia',
            'teamSize': 3,
            'problemStatement': 'Small-scale farmers waste 30% of produce due to poor supply chain coordination.',
            'productDescription': 'IoT-based supply chain monitoring for smallholder farmers.',
            'supportNeeds': ['IoT Hardware Partners', 'Sustainability Mentorship', 'Pilot Farms'],
            'currentChallenges': ['No working prototype yet', 'Limited funding'],
            'verificationStatus': 'Pending',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-5',
            'name': 'PayBridge',
            'industry': 'Fintech',
            'stage': 'MVP',
            'country': 'Malaysia',
            'teamSize': 6,
            'problemStatement': 'Cross-border payments between Malaysia and Indonesia are slow and expensive.',
            'productDescription': 'Blockchain-based cross-border payment rail for ASEAN micro-transactions.',
            'supportNeeds': ['Regulatory Advice', 'Banking Partnerships', 'Compliance Support'],
            'currentChallenges': ['Regulatory uncertainty in crypto', 'Need compliance advisor'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-6',
            'name': 'CarbonLens',
            'industry': 'Sustainability',
            'stage': 'Seed',
            'country': 'Singapore',
            'teamSize': 7,
            'problemStatement': 'Corporations struggle to accurately measure and report Scope 3 carbon emissions.',
            'productDescription': 'AI-driven carbon accounting platform for supply chain emissions tracking.',
            'supportNeeds': ['ESG Advisory', 'Enterprise Sales Support', 'Cloud Infrastructure'],
            'currentChallenges': ['Complex supply chain data integration', 'Long enterprise sales cycle'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-7',
            'name': 'NeuroPath',
            'industry': 'Healthtech',
            'stage': 'Seed',
            'country': 'Malaysia',
            'teamSize': 10,
            'problemStatement': 'Early detection of neurodegenerative diseases is expensive and inaccessible.',
            'productDescription': 'Wearable EEG device paired with AI for early Alzheimer screening at primary care clinics.',
            'supportNeeds': ['Clinical Trial Support', 'Hospital Partnerships', 'Series A Funding'],
            'currentChallenges': ['FDA/MDA regulatory pathway unclear', 'Need neurology domain mentor'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'comp-8',
            'name': 'LogiTrack',
            'industry': 'Logistics',
            'stage': 'Growth',
            'country': 'Malaysia',
            'teamSize': 25,
            'problemStatement': 'Last-mile delivery in Southeast Asia is fragmented and unreliable.',
            'productDescription': 'AI-optimized last-mile delivery routing platform for e-commerce logistics.',
            'supportNeeds': ['Regional Expansion Support', 'Series B Funding', 'Strategic Partnerships'],
            'currentChallenges': ['Scaling to Indonesia and Thailand', 'Driver retention'],
            'verificationStatus': 'Verified',
            'createdAt': firestore.SERVER_TIMESTAMP
        }
    ]
    for c in companies:
        db.collection('companies').document(c['id']).set(c)

    # ===== CONTRIBUTORS =====
    print("Seeding Contributors...")
    contributors = [
        {
            'id': 'cont-1',
            'name': 'Dr. Sarah Lim',
            'type': 'Mentor',
            'organization': 'HealthTech Partners LLC',
            'expertise': ['Healthtech', 'Regulatory Strategy', 'Clinical Pilots'],
            'supportedStages': ['MVP', 'Seed'],
            'capacity': 3,
            'availability': 'Available',
            'countryCoverage': ['Malaysia', 'Singapore'],
            'conflictAreas': [],
            'rating': 4.8,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-2',
            'name': 'Google Cloud (APAC)',
            'type': 'Partner',
            'organization': 'Google',
            'expertise': ['Cloud Infrastructure', 'AI APIs', 'Credits'],
            'supportedStages': ['Idea', 'MVP', 'Seed', 'Growth'],
            'capacity': 50,
            'availability': 'Available',
            'countryCoverage': ['Global'],
            'conflictAreas': [],
            'rating': 4.9,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-3',
            'name': 'Ahmad Razak',
            'type': 'Mentor',
            'organization': 'Ex-Grab, Venture Partner at Sequoia SEA',
            'expertise': ['Go-to-market Strategy', 'Fundraising', 'Marketplace Scaling'],
            'supportedStages': ['Seed', 'Growth'],
            'capacity': 2,
            'availability': 'Available',
            'countryCoverage': ['Malaysia', 'Singapore', 'Indonesia'],
            'conflictAreas': ['Competing logistics startups'],
            'rating': 4.7,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-4',
            'name': 'Lee & Partners LLP',
            'type': 'Service Provider',
            'organization': 'Lee & Partners LLP',
            'expertise': ['Corporate Law', 'Startup Incorporation', 'IP Protection', 'Compliance'],
            'supportedStages': ['Idea', 'MVP', 'Seed'],
            'capacity': 10,
            'availability': 'Available',
            'countryCoverage': ['Malaysia', 'Singapore'],
            'conflictAreas': [],
            'rating': 4.5,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-5',
            'name': 'Dr. Priya Nair',
            'type': 'Mentor',
            'organization': 'National University Hospital Singapore',
            'expertise': ['Neurology', 'Clinical Trials', 'MedTech Commercialisation'],
            'supportedStages': ['MVP', 'Seed'],
            'capacity': 2,
            'availability': 'Limited',
            'countryCoverage': ['Singapore', 'Malaysia'],
            'conflictAreas': [],
            'rating': 4.9,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-6',
            'name': 'TerraVentures',
            'type': 'Investor',
            'organization': 'TerraVentures Capital',
            'expertise': ['Sustainability', 'ESG Investing', 'Impact Measurement', 'CleanTech'],
            'supportedStages': ['Seed', 'Growth'],
            'capacity': 5,
            'availability': 'Available',
            'countryCoverage': ['Southeast Asia'],
            'conflictAreas': [],
            'rating': 4.6,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-7',
            'name': 'Bank Negara Sandbox Team',
            'type': 'Partner',
            'organization': 'Bank Negara Malaysia',
            'expertise': ['Regulatory Sandbox', 'Fintech Compliance', 'Payment Licensing'],
            'supportedStages': ['MVP', 'Seed'],
            'capacity': 8,
            'availability': 'Available',
            'countryCoverage': ['Malaysia'],
            'conflictAreas': [],
            'rating': 4.4,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-8',
            'name': 'Fatimah Hassan',
            'type': 'Mentor',
            'organization': 'Ex-Ministry of Education, EdTech Consultant',
            'expertise': ['Education Policy', 'Curriculum Design', 'Government Grant Applications'],
            'supportedStages': ['Idea', 'MVP'],
            'capacity': 4,
            'availability': 'Available',
            'countryCoverage': ['Malaysia'],
            'conflictAreas': [],
            'rating': 4.3,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-9',
            'name': 'AWS Activate (SEA)',
            'type': 'Partner',
            'organization': 'Amazon Web Services',
            'expertise': ['Cloud Infrastructure', 'DevOps', 'Machine Learning', 'Credits'],
            'supportedStages': ['Idea', 'MVP', 'Seed', 'Growth'],
            'capacity': 100,
            'availability': 'Available',
            'countryCoverage': ['Global'],
            'conflictAreas': ['Google Cloud partnerships'],
            'rating': 4.8,
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'cont-10',
            'name': 'Datuk Tan Wei Ming',
            'type': 'Mentor',
            'organization': 'Chairman, ASEAN IoT Alliance',
            'expertise': ['IoT', 'Supply Chain', 'AgriTech', 'Hardware Prototyping'],
            'supportedStages': ['Idea', 'MVP', 'Seed'],
            'capacity': 3,
            'availability': 'Available',
            'countryCoverage': ['Malaysia', 'Thailand', 'Indonesia'],
            'conflictAreas': [],
            'rating': 4.5,
            'createdAt': firestore.SERVER_TIMESTAMP
        }
    ]
    for cont in contributors:
        db.collection('contributors').document(cont['id']).set(cont)

    # ===== SAMPLE OUTCOMES (for the learning loop) =====
    print("Seeding Sample Outcomes...")
    outcomes = [
        {
            'id': 'out-1',
            'relationshipId': 'rel-historical-1',
            'companyRating': 5,
            'companyFeedback': 'Dr. Lim helped us navigate the MDA regulatory process. Invaluable.',
            'contributorRating': 4,
            'contributorFeedback': 'Strong team, clear vision. Needed more preparation on clinical data.',
            'adminEvaluation': 'Excellent match. Resulted in successful regulatory submission.',
            'outcomeAchieved': 'Yes',
            'outcomeType': 'Regulatory Approval',
            'relationshipQuality': 'High',
            'futureRecommendationValue': True,
            'lessonLearned': 'Healthtech MVP companies with clinical pilot needs benefit from mentors who have direct hospital partnership experience.',
            'createdAt': firestore.SERVER_TIMESTAMP
        },
        {
            'id': 'out-2',
            'relationshipId': 'rel-historical-2',
            'companyRating': 3,
            'companyFeedback': 'Cloud credits were helpful but we needed more hands-on technical guidance.',
            'contributorRating': 4,
            'contributorFeedback': 'Company utilized credits well but engagement was minimal.',
            'adminEvaluation': 'Partial success. Credits used but no deep technical engagement.',
            'outcomeAchieved': 'Partial',
            'outcomeType': 'Cloud Adoption',
            'relationshipQuality': 'Medium',
            'futureRecommendationValue': True,
            'lessonLearned': 'Cloud partner credits alone are insufficient. Pair cloud partnerships with a technical mentor for better outcomes.',
            'createdAt': firestore.SERVER_TIMESTAMP
        }
    ]
    for o in outcomes:
        db.collection('outcomes').document(o['id']).set(o)

    print("Seed complete! All fake data is now in Firestore.")

if __name__ == "__main__":
    seed_data()
