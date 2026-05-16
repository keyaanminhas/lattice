import os

import firebase_admin
from firebase_admin import auth, credentials, firestore
from google.auth.credentials import AnonymousCredentials

os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = "127.0.0.1:9099"


class EmulatorCredential(credentials.Base):
    def get_credential(self):
        return AnonymousCredentials()


try:
    firebase_admin.initialize_app(EmulatorCredential(), options={"projectId": "lattice-2026"})
except ValueError:
    pass

db = firestore.client()


def seed_collection(name: str, records: list[dict]):
    for record in records:
        db.collection(name).document(record["id"]).set(record)


def upsert_auth_user(uid: str, email: str, password: str, display_name: str):
    try:
        auth.update_user(uid, email=email, password=password, display_name=display_name)
    except auth.UserNotFoundError:
        auth.create_user(uid=uid, email=email, password=password, display_name=display_name)


def seed_data():
    organisations = [
        {
            "id": "org-1",
            "name": "Cradle Fund",
            "organisationType": "Government-linked startup ecosystem agency",
            "roles": ["Ecosystem Owner", "Programme Owner", "Funding Partner"],
            "country": "Malaysia",
            "focusAreas": ["AI", "Healthtech", "Funding", "Market Access"],
            "status": "Active",
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    ]

    programmes = [
        {
            "id": "prog-1",
            "organisationId": "org-1",
            "name": "AI Startup Accelerator 2026",
            "type": "Accelerator",
            "targetSectors": ["AI", "SaaS", "Data Platforms", "Healthtech"],
            "targetStages": ["MVP", "Pre-seed", "Seed"],
            "country": "Malaysia",
            "eligibilityRules": [
                "Working prototype required",
                "Team of at least 2",
                "Malaysia-based or Malaysia-expansion interest",
            ],
            "expectedOutcomes": ["Investor readiness", "Cloud adoption", "Pilot readiness", "Market access"],
            "status": "Open",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "prog-2",
            "organisationId": "org-1",
            "name": "HealthTech Accelerator",
            "type": "Mentorship Cohort",
            "targetSectors": ["Healthtech", "MedTech", "AI"],
            "targetStages": ["MVP", "Seed"],
            "country": "Malaysia",
            "eligibilityRules": [
                "Working prototype required",
                "Clinical or pilot use case preferred",
                "Team of at least 2",
            ],
            "expectedOutcomes": ["Clinical pilot access", "Regulatory guidance", "Hospital partnerships"],
            "status": "Active",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "prog-3",
            "organisationId": "org-1",
            "name": "Fintech Market Access Programme",
            "type": "Market Access Programme",
            "targetSectors": ["Fintech", "Payments", "InsurTech"],
            "targetStages": ["MVP", "Seed", "Growth"],
            "country": "Malaysia",
            "eligibilityRules": [
                "ASEAN market use case preferred",
                "Product must be launch-ready",
            ],
            "expectedOutcomes": ["Banking partnerships", "Regulatory sandbox access", "Enterprise pilots"],
            "status": "Open",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    startups = [
        {
            "id": "comp-1",
            "organisationId": "org-startup-1",
            "name": "MediScan AI",
            "companyName": "MediScan AI",
            "industry": "Healthtech",
            "sector": "Healthtech",
            "stage": "MVP",
            "country": "Malaysia",
            "teamSize": 5,
            "problemStatement": "Clinics and hospitals need faster patient triage and decision support.",
            "productDescription": "AI-powered medical triage assistant for outpatient clinics and hospitals.",
            "supportNeeds": ["Clinical pilot access", "Regulatory guidance", "Cloud infrastructure", "Investor readiness"],
            "currentChallenges": ["Need hospital pilot partner", "Need MDA regulatory advisor"],
            "traction": "Prototype tested with 2 clinics",
            "verificationStatus": "Verified",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "comp-2",
            "organisationId": "org-startup-2",
            "name": "FinFlow",
            "companyName": "FinFlow",
            "industry": "Fintech",
            "sector": "Fintech",
            "stage": "Seed",
            "country": "Malaysia",
            "teamSize": 8,
            "problemStatement": "SMEs struggle with cash flow forecasting and treasury visibility.",
            "productDescription": "AI cash flow forecasting and finance operations platform for SMEs.",
            "supportNeeds": ["Banking partnerships", "Enterprise sales support", "Regulatory sandbox access"],
            "currentChallenges": ["Need pilot bank partner", "Long enterprise sales cycles"],
            "traction": "15 pilot customers and 2 bank conversations",
            "verificationStatus": "Verified",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "comp-3",
            "organisationId": "org-startup-3",
            "name": "EduLeap",
            "companyName": "EduLeap",
            "industry": "EdTech",
            "sector": "EdTech",
            "stage": "MVP",
            "country": "Malaysia",
            "teamSize": 4,
            "problemStatement": "Rural students lack access to high-quality STEM learning.",
            "productDescription": "Gamified offline-first STEM learning platform.",
            "supportNeeds": ["Cloud infrastructure", "Content partnerships", "Government grant"],
            "currentChallenges": ["Need curriculum partners", "Need scale-ready infra"],
            "traction": "Piloted in 3 schools",
            "verificationStatus": "Verified",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "comp-4",
            "organisationId": "org-startup-4",
            "name": "GreenHarvest",
            "companyName": "GreenHarvest",
            "industry": "AgriTech",
            "sector": "AgriTech",
            "stage": "Idea",
            "country": "Malaysia",
            "teamSize": 2,
            "problemStatement": "Small farms lose yield because supply coordination is poor.",
            "productDescription": "Supply chain coordination platform for smallholder farms.",
            "supportNeeds": ["Pilot farms", "IoT prototyping", "Sustainability mentorship"],
            "currentChallenges": ["No working prototype yet", "Limited funding"],
            "traction": "",
            "verificationStatus": "Pending",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "comp-5",
            "organisationId": "org-startup-5",
            "name": "PayBridge",
            "companyName": "PayBridge",
            "industry": "Fintech",
            "sector": "Fintech",
            "stage": "MVP",
            "country": "Malaysia",
            "teamSize": 6,
            "problemStatement": "Cross-border micro-payments across ASEAN are slow and costly.",
            "productDescription": "Cross-border payment rail for ASEAN micro-transactions.",
            "supportNeeds": ["Regulatory guidance", "Banking partnerships", "Compliance support"],
            "currentChallenges": ["Need licensing strategy", "Need sandbox pathway"],
            "traction": "3 merchant pilots in Malaysia",
            "verificationStatus": "Verified",
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    contributors = [
        {
            "id": "cont-1",
            "organisationId": "org-contrib-1",
            "name": "Dr. Sarah Lim",
            "type": "Mentor",
            "contributorTypes": ["Mentor"],
            "expertise": ["Healthtech", "Regulatory Strategy", "Clinical Pilots", "Hospital Partnerships"],
            "supportedStages": ["MVP", "Seed"],
            "countryCoverage": ["Malaysia", "Singapore"],
            "capacity": {
                "globalMaxProgrammes": 3,
                "globalMaxStartupAssignments": 5,
                "perProgrammeStartupCapacity": 2,
            },
            "availability": "Available",
            "status": "Verified",
            "rating": 4.8,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-2",
            "organisationId": "org-contrib-2",
            "name": "Google Cloud Malaysia",
            "type": "Partner",
            "contributorTypes": ["Partner", "Technical Provider"],
            "expertise": ["Cloud Infrastructure", "AI", "Startup Credits", "Architecture Support"],
            "supportedStages": ["MVP", "Seed", "Growth"],
            "countryCoverage": ["Malaysia"],
            "canSupport": ["Programme"],
            "availability": "Available",
            "status": "Verified",
            "rating": 4.9,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-3",
            "organisationId": "org-contrib-3",
            "name": "Ahmad Razak",
            "type": "Mentor",
            "contributorTypes": ["Mentor"],
            "expertise": ["Go-to-market Strategy", "Fundraising", "Marketplace Scaling", "Fintech"],
            "supportedStages": ["Seed", "Growth"],
            "countryCoverage": ["Malaysia", "Singapore", "Indonesia"],
            "capacity": {
                "globalMaxProgrammes": 2,
                "globalMaxStartupAssignments": 3,
                "perProgrammeStartupCapacity": 2,
            },
            "availability": "Available",
            "status": "Verified",
            "rating": 4.7,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-4",
            "organisationId": "org-contrib-4",
            "name": "LegalPro MY",
            "type": "Service Provider",
            "contributorTypes": ["Service Provider"],
            "expertise": ["Compliance", "Corporate Law", "Regulatory Advisory", "IP Protection"],
            "supportedStages": ["MVP", "Seed"],
            "countryCoverage": ["Malaysia"],
            "canSupport": ["Programme"],
            "availability": "Available",
            "status": "Verified",
            "rating": 4.5,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-5",
            "organisationId": "org-contrib-5",
            "name": "SeedFund MY",
            "type": "Investor",
            "contributorTypes": ["Investor"],
            "investmentThesis": ["AI", "SaaS", "Healthtech", "Fintech"],
            "stages": ["Pre-seed", "Seed"],
            "supportedStages": ["Pre-seed", "Seed"],
            "ticketSize": "MYR 100k - MYR 1M",
            "countryCoverage": ["Malaysia"],
            "canSupport": ["Programme"],
            "availability": "Available",
            "status": "Verified",
            "rating": 4.6,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-6",
            "organisationId": "org-contrib-6",
            "name": "Bank Negara Sandbox Team",
            "type": "Partner",
            "contributorTypes": ["Partner"],
            "expertise": ["Regulatory Sandbox", "Fintech Compliance", "Payments"],
            "supportedStages": ["MVP", "Seed"],
            "countryCoverage": ["Malaysia"],
            "canSupport": ["Programme"],
            "availability": "Available",
            "status": "Verified",
            "rating": 4.4,
            "createdAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    applications = [
        {
            "id": "comp-1_prog-2",
            "startupId": "comp-1",
            "programmeId": "prog-2",
            "aiFitScore": 94,
            "aiExplanation": "MediScan AI is a direct fit for a healthtech programme focused on pilots and regulatory support.",
            "status": "Accepted",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "comp-2_prog-3",
            "startupId": "comp-2",
            "programmeId": "prog-3",
            "aiFitScore": 91,
            "aiExplanation": "FinFlow fits the programme's fintech market access and regulatory support goals.",
            "status": "Accepted",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "comp-3_prog-1",
            "startupId": "comp-3",
            "programmeId": "prog-1",
            "aiFitScore": 78,
            "aiExplanation": "EduLeap benefits from cloud and accelerator support, but sector fit is partial.",
            "status": "Pending Admin Review",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    programme_contributors = [
        {
            "id": "cont-1_prog-2",
            "programmeId": "prog-2",
            "contributorId": "cont-1",
            "contributorType": "Mentor",
            "status": "Approved",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-2_prog-1",
            "programmeId": "prog-1",
            "contributorId": "cont-2",
            "contributorType": "Partner",
            "status": "Approved",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-3_prog-3",
            "programmeId": "prog-3",
            "contributorId": "cont-3",
            "contributorType": "Mentor",
            "status": "Approved",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-4_prog-2",
            "programmeId": "prog-2",
            "contributorId": "cont-4",
            "contributorType": "Service Provider",
            "status": "Approved",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-5_prog-1",
            "programmeId": "prog-1",
            "contributorId": "cont-5",
            "contributorType": "Investor",
            "status": "Approved",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "cont-6_prog-3",
            "programmeId": "prog-3",
            "contributorId": "cont-6",
            "contributorType": "Partner",
            "status": "Approved",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    recommendations = [
        {
            "id": "rec-1",
            "recommendationType": "Startup-to-Programme",
            "sourceEntityType": "Startup",
            "sourceEntityId": "comp-3",
            "targetEntityType": "Programme",
            "targetEntityId": "prog-1",
            "programmeId": "prog-1",
            "matchScore": 78,
            "explanation": "EduLeap fits the accelerator's cloud and market support, though it is outside the programme's strongest sectors.",
            "riskFlags": ["Sector fit is partial."],
            "status": "Pending Approval",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "rec-2",
            "recommendationType": "Startup-to-Mentor",
            "sourceEntityType": "Startup",
            "sourceEntityId": "comp-1",
            "targetEntityType": "Contributor",
            "targetEntityId": "cont-1",
            "programmeId": "prog-2",
            "matchScore": 94,
            "explanation": "MediScan AI needs regulatory and clinical pilot support, and Dr. Sarah Lim is already in the programme mentor pool with strong healthtech experience.",
            "riskFlags": ["Mentor has limited per-programme capacity."],
            "status": "Pending Approval",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "rec-3",
            "recommendationType": "Investor-to-Programme",
            "sourceEntityType": "Contributor",
            "sourceEntityId": "cont-5",
            "targetEntityType": "Programme",
            "targetEntityId": "prog-3",
            "programmeId": "prog-3",
            "matchScore": 82,
            "explanation": "SeedFund MY matches the programme's seed-stage and fintech startup profile well.",
            "riskFlags": ["Investor capacity should be rationed across clinics."],
            "status": "Pending Approval",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    relationships = [
        {
            "id": "rel-1",
            "relationshipType": "Startup-to-Programme",
            "sourceEntityId": "comp-1",
            "targetEntityId": "prog-2",
            "programmeId": "prog-2",
            "createdFromRecommendationId": "seed-accepted-1",
            "matchScore": 94,
            "status": "Active",
            "expectedOutcome": "Clinical pilot and regulatory roadmap",
            "startDate": "2026-05-10",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "rel-2",
            "relationshipType": "Startup-to-Programme",
            "sourceEntityId": "comp-2",
            "targetEntityId": "prog-3",
            "programmeId": "prog-3",
            "createdFromRecommendationId": "seed-accepted-2",
            "matchScore": 91,
            "status": "Active",
            "expectedOutcome": "Banking partnership and sandbox access",
            "startDate": "2026-05-12",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
        {
            "id": "rel-3",
            "relationshipType": "Startup-to-Mentor",
            "sourceEntityId": "comp-2",
            "targetEntityId": "cont-3",
            "programmeId": "prog-3",
            "createdFromRecommendationId": "seed-mentor-1",
            "matchScore": 89,
            "status": "Active",
            "expectedOutcome": "Go-to-market support and fintech partnership preparation",
            "startDate": "2026-05-12",
            "createdAt": firestore.SERVER_TIMESTAMP,
            "updatedAt": firestore.SERVER_TIMESTAMP,
        },
    ]

    outcomes = [
        {
            "id": "out-1",
            "relationshipId": "rel-3",
            "outcomeAchieved": "Partial",
            "relationshipQuality": "High",
            "startupRating": 4.5,
            "startupFeedback": "The mentor sharpened our GTM and bank pitch significantly.",
            "contributorRating": 4.0,
            "contributorFeedback": "Strong team, but they still need tighter compliance preparation.",
            "adminEvaluation": "Good mentor fit. The next cohort should pair fintech mentors with sandbox support earlier.",
            "aiLesson": "Fintech MVP and seed startups perform better when GTM mentoring is paired with programme-level regulatory access.",
            "reusePattern": True,
            "createdAt": firestore.SERVER_TIMESTAMP,
        }
    ]

    print("Seeding programme-first Lattice demo data...")
    demo_accounts = [
        {
            "uid": "demo-admin",
            "email": "admin@lattice.demo",
            "password": "lattice-demo-admin",
            "displayName": "System Admin",
            "accountType": "platformAdmin",
            "entityType": "platform",
            "entityId": "platform",
            "status": "Active",
        },
        {
            "uid": "demo-startup-comp-1",
            "email": "startup@lattice.demo",
            "password": "lattice-demo-startup",
            "displayName": "MediScan AI",
            "accountType": "startup",
            "entityType": "company",
            "entityId": "comp-1",
            "status": "Active",
        },
        {
            "uid": "demo-contributor-cont-1",
            "email": "contributor@lattice.demo",
            "password": "lattice-demo-contributor",
            "displayName": "Dr. Sarah Lim",
            "accountType": "contributor",
            "entityType": "contributor",
            "entityId": "cont-1",
            "status": "Active",
        },
    ]

    for account in demo_accounts:
        upsert_auth_user(account["uid"], account["email"], account["password"], account["displayName"])
        db.collection("accounts").document(account["uid"]).set(
            {
                "accountType": account["accountType"],
                "entityType": account["entityType"],
                "entityId": account["entityId"],
                "displayName": account["displayName"],
                "email": account["email"],
                "status": account["status"],
                "createdAt": firestore.SERVER_TIMESTAMP,
                "lastLoginAt": firestore.SERVER_TIMESTAMP,
            },
            merge=True,
        )

    seed_collection("organisations", organisations)
    seed_collection("programmes", programmes)
    seed_collection("companies", startups)
    seed_collection("contributors", contributors)
    seed_collection("applications", applications)
    seed_collection("programmeContributors", programme_contributors)
    seed_collection("recommendations", recommendations)
    seed_collection("relationships", relationships)
    seed_collection("outcomes", outcomes)
    print("Seed complete.")


if __name__ == "__main__":
    seed_data()
