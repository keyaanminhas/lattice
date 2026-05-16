import os

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import firestore as admin_firestore
from google.cloud import firestore as google_firestore

USE_FIRESTORE_EMULATOR = os.environ.get("USE_FIRESTORE_EMULATOR", "").lower() in {"1", "true", "yes"}
if USE_FIRESTORE_EMULATOR:
    os.environ["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080"
    os.environ.setdefault("FIREBASE_AUTH_EMULATOR_HOST", "127.0.0.1:9099")

if USE_FIRESTORE_EMULATOR:
    from google.auth.credentials import AnonymousCredentials

    db = google_firestore.Client(
        project=os.environ.get("GOOGLE_CLOUD_PROJECT", "lattice-2026"),
        credentials=AnonymousCredentials(),
    )
    SERVER_TIMESTAMP = google_firestore.SERVER_TIMESTAMP
else:
    try:
        firebase_admin.initialize_app()
    except ValueError:
        pass
    db = admin_firestore.client()
    SERVER_TIMESTAMP = admin_firestore.SERVER_TIMESTAMP

MANAGED_COLLECTIONS = [
    "roleAssignments",
    "accounts",
    "graph_edges",
    "outcomes",
    "relationships",
    "recommendations",
    "programmeContributors",
    "applications",
    "contributors",
    "companies",
    "programmes",
    "organisations",
]

DEMO_LOGINS = [
    {
        "uid": "demo-admin",
        "email": "admin@lattice.demo",
        "password": "lattice-demo-admin",
        "display_name": "Cradle Fund Admin",
        "account_type": "organisation",
        "entity_type": "organisation",
        "entity_id": "org-1",
        "role_key": "organisation_admin",
        "status": "Active",
    },
    {
        "uid": "demo-startup",
        "email": "startup@lattice.demo",
        "password": "lattice-demo-startup",
        "display_name": "MediScan AI",
        "account_type": "startup",
        "entity_type": "company",
        "entity_id": "comp-1",
        "role_key": "startup",
        "status": "Active",
    },
    {
        "uid": "demo-contributor",
        "email": "contributor@lattice.demo",
        "password": "lattice-demo-contributor",
        "display_name": "Dr. Sarah Lim",
        "account_type": "contributor",
        "entity_type": "contributor",
        "entity_id": "cont-1",
        "role_key": "mentor",
        "status": "Active",
    },
]


def _with_created(record: dict) -> dict:
    payload = dict(record)
    payload["createdAt"] = SERVER_TIMESTAMP
    return payload


def _with_created_updated(record: dict) -> dict:
    payload = dict(record)
    payload["createdAt"] = SERVER_TIMESTAMP
    payload["updatedAt"] = SERVER_TIMESTAMP
    return payload


def clear_collection(name: str):
    while True:
        docs = list(db.collection(name).limit(200).stream())
        if not docs:
            break
        batch = db.batch()
        for doc in docs:
            batch.delete(doc.reference)
        batch.commit()


def seed_collection(name: str, records: list[dict]):
    for record in records:
        db.collection(name).document(record["id"]).set(record)


def account(
    uid: str,
    email: str,
    display_name: str,
    account_type: str,
    entity_type: str,
    entity_id: str,
    status: str,
    role_key: str | None = None,
):
    if not role_key:
        if account_type == "organisation":
            role_key = "organisation_admin"
        elif account_type == "startup":
            role_key = "startup"
        else:
            role_key = "mentor"
    return _with_created_updated(
        {
            "id": uid,
            "accountType": account_type,
            "roleKey": role_key,
            "entityType": entity_type,
            "entityId": entity_id,
            "displayName": display_name,
            "email": email,
            "status": status,
        }
    )


def role_assignment(
    assignment_id: str,
    uid: str | None,
    role_key: str,
    scope_type: str,
    scope_id: str,
    status: str = "active",
    organisation_id: str | None = None,
    programme_id: str | None = None,
):
    return _with_created_updated(
        {
            "id": assignment_id,
            "uid": uid,
            "roleKey": role_key,
            "scopeType": scope_type,
            "scopeId": scope_id,
            "status": status,
            "organisationId": organisation_id,
            "programmeId": programme_id,
            "isSeeded": True,
            "createdByUid": "seed_db",
            "approvedByUid": "seed_db",
        }
    )


def sync_demo_auth_users():
    auth_emulator_host = os.environ.get("FIREBASE_AUTH_EMULATOR_HOST", "").strip()
    if not auth_emulator_host:
        print("Skipping demo Auth user sync because FIREBASE_AUTH_EMULATOR_HOST is not set.")
        return

    print(f"Syncing demo Firebase Auth users in emulator at {auth_emulator_host}...")
    for login in DEMO_LOGINS:
        existing = None
        try:
            existing = firebase_auth.get_user(login["uid"])
        except firebase_auth.UserNotFoundError:
            try:
                same_email_user = firebase_auth.get_user_by_email(login["email"])
            except firebase_auth.UserNotFoundError:
                same_email_user = None
            if same_email_user and same_email_user.uid != login["uid"]:
                firebase_auth.delete_user(same_email_user.uid)

        if existing:
            firebase_auth.update_user(
                login["uid"],
                email=login["email"],
                password=login["password"],
                display_name=login["display_name"],
                disabled=False,
            )
        else:
            firebase_auth.create_user(
                uid=login["uid"],
                email=login["email"],
                password=login["password"],
                display_name=login["display_name"],
                disabled=False,
            )

def organisation(org_id: str, name: str, org_type: str, roles: list[str], country: str, focus_areas: list[str], status: str):
    return _with_created(
        {
            "id": org_id,
            "name": name,
            "organisationType": org_type,
            "roles": roles,
            "country": country,
            "focusAreas": focus_areas,
            "status": status,
        }
    )


def programme(
    programme_id: str,
    organisation_id: str,
    name: str,
    programme_type: str,
    sectors: list[str],
    stages: list[str],
    country: str,
    eligibility_rules: list[str],
    outcomes: list[str],
    status: str,
):
    return _with_created(
        {
            "id": programme_id,
            "organisationId": organisation_id,
            "name": name,
            "type": programme_type,
            "targetSectors": sectors,
            "targetStages": stages,
            "country": country,
            "eligibilityRules": eligibility_rules,
            "expectedOutcomes": outcomes,
            "status": status,
        }
    )


def company(
    company_id: str,
    organisation_id: str,
    name: str,
    sector: str,
    stage: str,
    country: str,
    team_size: int,
    problem: str,
    product: str,
    support_needs: list[str],
    challenges: list[str],
    traction: str,
    verification_status: str,
):
    return _with_created(
        {
            "id": company_id,
            "organisationId": organisation_id,
            "name": name,
            "companyName": name,
            "industry": sector,
            "sector": sector,
            "stage": stage,
            "country": country,
            "teamSize": team_size,
            "problemStatement": problem,
            "productDescription": product,
            "supportNeeds": support_needs,
            "currentChallenges": challenges,
            "traction": traction,
            "verificationStatus": verification_status,
        }
    )


def contributor(
    contributor_id: str,
    organisation_id: str,
    name: str,
    contributor_type: str,
    contributor_types: list[str],
    expertise: list[str],
    supported_stages: list[str],
    country_coverage: list[str],
    availability: str,
    rating: float,
    can_support: list[str] | None = None,
    investment_thesis: list[str] | None = None,
    stages: list[str] | None = None,
    ticket_size: str | None = None,
    capacity: dict | int | None = None,
):
    payload = {
        "id": contributor_id,
        "organisationId": organisation_id,
        "name": name,
        "type": contributor_type,
        "contributorTypes": contributor_types,
        "expertise": expertise,
        "supportedStages": supported_stages,
        "countryCoverage": country_coverage,
        "availability": availability,
        "status": "Verified",
        "rating": rating,
    }
    if can_support:
        payload["canSupport"] = can_support
    if investment_thesis:
        payload["investmentThesis"] = investment_thesis
    if stages:
        payload["stages"] = stages
    if ticket_size:
        payload["ticketSize"] = ticket_size
    if capacity is not None:
        payload["capacity"] = capacity
    return _with_created(payload)


def application(
    startup_id: str,
    programme_id: str,
    score: float,
    status: str,
    explanation: str,
):
    return _with_created_updated(
        {
            "id": f"{startup_id}_{programme_id}",
            "startupId": startup_id,
            "programmeId": programme_id,
            "aiFitScore": score,
            "aiExplanation": explanation,
            "status": status,
        }
    )


def programme_contributor(
    contributor_id: str,
    programme_id: str,
    contributor_type: str,
    status: str = "Approved",
):
    return _with_created_updated(
        {
            "id": f"{contributor_id}_{programme_id}",
            "programmeId": programme_id,
            "contributorId": contributor_id,
            "contributorType": contributor_type,
            "status": status,
        }
    )


def recommendation(
    rec_id: str,
    recommendation_type: str,
    source_entity_type: str,
    source_entity_id: str,
    target_entity_type: str,
    target_entity_id: str,
    programme_id: str,
    score: float,
    explanation: str,
    risks: list[str],
    status: str,
    score_breakdown: dict | None = None,
    graph_evidence: dict | None = None,
):
    return _with_created_updated(
        {
            "id": rec_id,
            "recommendationType": recommendation_type,
            "sourceEntityType": source_entity_type,
            "sourceEntityId": source_entity_id,
            "targetEntityType": target_entity_type,
            "targetEntityId": target_entity_id,
            "programmeId": programme_id,
            "matchScore": score,
            "explanation": explanation,
            "riskFlags": risks,
            "scoreBreakdown": score_breakdown
            or {
                "ruleScore": score,
                "semanticScore": score,
                "graphScore": score,
                "finalScore": score,
            },
            "graphEvidence": graph_evidence
            or {
                "summary": explanation,
                "edges": [],
                "pastOutcomeSignals": [],
                "riskFlags": risks,
            },
            "status": status,
        }
    )


def relationship(
    rel_id: str,
    relationship_type: str,
    source_entity_id: str,
    target_entity_id: str,
    programme_id: str,
    recommendation_id: str,
    score: float,
    status: str,
    expected_outcome: str,
    start_date: str,
):
    return _with_created_updated(
        {
            "id": rel_id,
            "relationshipType": relationship_type,
            "sourceEntityId": source_entity_id,
            "targetEntityId": target_entity_id,
            "programmeId": programme_id,
            "createdFromRecommendationId": recommendation_id,
            "matchScore": score,
            "status": status,
            "expectedOutcome": expected_outcome,
            "startDate": start_date,
        }
    )


def outcome(
    outcome_id: str,
    relationship_id: str,
    achieved: str,
    quality: str,
    startup_rating: float,
    startup_feedback: str,
    contributor_rating: float,
    contributor_feedback: str,
    admin_evaluation: str,
    ai_lesson: str,
    reuse_pattern: bool,
):
    return _with_created(
        {
            "id": outcome_id,
            "relationshipId": relationship_id,
            "outcomeAchieved": achieved,
            "relationshipQuality": quality,
            "startupRating": startup_rating,
            "startupFeedback": startup_feedback,
            "contributorRating": contributor_rating,
            "contributorFeedback": contributor_feedback,
            "adminEvaluation": admin_evaluation,
            "aiLesson": ai_lesson,
            "reusePattern": reuse_pattern,
        }
    )


def graph_edge(
    source_type: str,
    source_id: str,
    edge_type: str,
    target_type: str,
    target_id: str,
    programme_id: str | None = None,
    status: str = "active",
    weight: float = 1.0,
    confidence: float = 1.0,
    created_from: str = "",
    created_from_id: str = "",
    metadata: dict | None = None,
):
    doc_id = f"{source_type}__{source_id}__{edge_type}__{target_type}__{target_id}"
    return _with_created_updated(
        {
            "id": doc_id,
            "sourceType": source_type,
            "sourceId": source_id,
            "edgeType": edge_type,
            "targetType": target_type,
            "targetId": target_id,
            "programmeId": programme_id,
            "status": status,
            "weight": weight,
            "confidence": confidence,
            "createdFrom": created_from,
            "createdFromId": created_from_id,
            "metadata": metadata or {},
        }
    )


def build_seed_data():
    organisations = [
        organisation(
            "org-1",
            "Cradle Fund",
            "Government-linked startup ecosystem agency",
            ["Ecosystem Owner", "Programme Owner", "Funding Partner"],
            "Malaysia",
            ["AI", "Healthtech", "Funding", "Market Access"],
            "Active",
        ),
        organisation(
            "org-2",
            "ASEAN Founders Network",
            "Regional founder and operator network",
            ["Programme Owner", "Mentor Network"],
            "Singapore",
            ["Regional Expansion", "DeepTech", "Mobility"],
            "Active",
        ),
        organisation(
            "org-3",
            "KL Digital Trade Alliance",
            "Industry and enterprise innovation consortium",
            ["Programme Owner", "Corporate Partner"],
            "Malaysia",
            ["Fintech", "Cybersecurity", "Logistics", "Enterprise SaaS"],
            "Active",
        ),
        organisation(
            "org-4",
            "Health Innovation Malaysia",
            "Health system and clinical innovation platform",
            ["Programme Owner", "Pilot Network"],
            "Malaysia",
            ["Healthtech", "MedTech", "Clinical Validation"],
            "Active",
        ),
        organisation(
            "org-5",
            "Green Growth Malaysia",
            "Climate and sustainability ecosystem platform",
            ["Programme Owner", "Corporate Sustainability Partner"],
            "Malaysia",
            ["ClimateTech", "AgriTech", "Clean Energy", "Food Systems"],
            "Active",
        ),
    ]

    programmes = [
        programme(
            "prog-1",
            "org-1",
            "AI Startup Accelerator 2026",
            "Accelerator",
            ["AI", "SaaS", "Data Platforms", "Healthtech"],
            ["MVP", "Pre-seed", "Seed"],
            "Malaysia",
            ["Working prototype required", "Team of at least 2", "Malaysia-based or Malaysia-expansion interest"],
            ["Investor readiness", "Cloud adoption", "Pilot readiness", "Market access"],
            "Open",
        ),
        programme(
            "prog-2",
            "org-4",
            "HealthTech Accelerator",
            "Mentorship Cohort",
            ["Healthtech", "MedTech", "AI"],
            ["MVP", "Seed", "Pre-seed"],
            "Malaysia",
            ["Working prototype required", "Clinical or pilot use case preferred", "Team of at least 2"],
            ["Clinical pilot access", "Regulatory guidance", "Hospital partnerships"],
            "Active",
        ),
        programme(
            "prog-3",
            "org-3",
            "Fintech Market Access Programme",
            "Market Access Programme",
            ["Fintech", "Payments", "InsurTech"],
            ["MVP", "Seed", "Growth"],
            "Malaysia",
            ["ASEAN market use case preferred", "Product must be launch-ready"],
            ["Banking partnerships", "Regulatory sandbox access", "Enterprise pilots"],
            "Open",
        ),
        programme(
            "prog-4",
            "org-5",
            "ClimateTech Venture Lab",
            "Venture Lab",
            ["ClimateTech", "AgriTech", "Clean Energy", "Sustainability"],
            ["Idea", "MVP", "Seed"],
            "Malaysia",
            ["Founding team required", "Pilot hypothesis required"],
            ["Pilot farms", "Corporate sustainability pilots", "Carbon reporting readiness"],
            "Active",
        ),
        programme(
            "prog-5",
            "org-1",
            "SME Digitisation Launchpad",
            "Launchpad",
            ["SaaS", "RetailTech", "Logistics", "HRTech"],
            ["MVP", "Seed", "Growth"],
            "Malaysia",
            ["Operational product required", "Clear SME customer use case"],
            ["SME customer discovery", "Channel partnerships", "Cloud migration"],
            "Open",
        ),
        programme(
            "prog-6",
            "org-2",
            "DeepTech Commercialisation Bootcamp",
            "Commercialisation Bootcamp",
            ["DeepTech", "Robotics", "AI", "Cybersecurity"],
            ["MVP", "Seed", "Growth"],
            "Singapore",
            ["Technical prototype required", "Commercial team commitment required"],
            ["Research translation", "Enterprise pilots", "Grant readiness"],
            "Active",
        ),
        programme(
            "prog-7",
            "org-2",
            "ASEAN Expansion Sprint",
            "Expansion Sprint",
            ["Fintech", "SaaS", "Logistics", "TradeTech"],
            ["Seed", "Growth"],
            "Singapore",
            ["Regional expansion intent required", "Dedicated business lead required"],
            ["Regional partnerships", "Market access", "Localization support"],
            "Open",
        ),
        programme(
            "prog-8",
            "org-1",
            "EdTech Impact Cohort",
            "Impact Cohort",
            ["EdTech", "AI", "Consumer", "Future of Work"],
            ["MVP", "Seed"],
            "Malaysia",
            ["Working product required", "Evidence of learner demand preferred"],
            ["School pilots", "Content partnerships", "Government grant access"],
            "Active",
        ),
        programme(
            "prog-9",
            "org-4",
            "Digital Health Procurement Track",
            "Procurement Track",
            ["Healthtech", "AI", "SaaS"],
            ["Seed", "Growth", "MVP"],
            "Malaysia",
            ["Clinical workflow relevance required", "Procurement readiness preferred"],
            ["Hospital procurement readiness", "Compliance support", "Clinical validation"],
            "Open",
        ),
        programme(
            "prog-10",
            "org-3",
            "Cyber Resilience Foundry",
            "Enterprise Readiness Programme",
            ["Cybersecurity", "AI", "Enterprise SaaS"],
            ["MVP", "Seed", "Growth"],
            "Malaysia",
            ["Enterprise security use case required", "Technical buyer relevance required"],
            ["CISO introductions", "Compliance readiness", "Enterprise security pilots"],
            "Active",
        ),
        programme(
            "prog-11",
            "org-2",
            "Smart City Mobility Sandbox",
            "Sandbox Programme",
            ["Mobility", "IoT", "Logistics", "Clean Energy"],
            ["MVP", "Seed", "Growth"],
            "Singapore",
            ["Pilot-ready product required", "Deployment operations lead required"],
            ["Municipality pilots", "Infrastructure partners", "Sandbox permits"],
            "Open",
        ),
        programme(
            "prog-12",
            "org-5",
            "Food Systems Innovation Circle",
            "Innovation Circle",
            ["AgriTech", "FoodTech", "Sustainability", "ClimateTech"],
            ["MVP", "Seed", "Growth"],
            "Malaysia",
            ["Supply chain use case required", "Commercial pilot partner preferred"],
            ["Supply chain pilots", "Manufacturing partners", "Sustainability certification"],
            "Open",
        ),
    ]

    companies = [
        company(
            "comp-1",
            "startup-org-1",
            "MediScan AI",
            "Healthtech",
            "MVP",
            "Malaysia",
            5,
            "Clinics and hospitals need faster patient triage and decision support.",
            "AI-powered medical triage assistant for outpatient clinics and hospitals.",
            ["Clinical pilot access", "Regulatory guidance", "Cloud infrastructure", "Investor readiness"],
            ["Need hospital pilot partner", "Need MDA regulatory advisor"],
            "Prototype tested with 2 clinics",
            "Verified",
        ),
        company(
            "comp-2",
            "startup-org-2",
            "FinFlow",
            "Fintech",
            "Seed",
            "Malaysia",
            8,
            "SMEs struggle with cash flow forecasting and treasury visibility.",
            "AI cash flow forecasting and finance operations platform for SMEs.",
            ["Banking partnerships", "Enterprise pilots", "Regulatory sandbox access"],
            ["Need pilot bank partner", "Long enterprise sales cycles"],
            "15 pilot customers and 2 bank conversations",
            "Verified",
        ),
        company(
            "comp-3",
            "startup-org-3",
            "EduLeap",
            "EdTech",
            "MVP",
            "Malaysia",
            4,
            "Rural students lack access to high-quality STEM learning.",
            "Gamified offline-first STEM learning platform.",
            ["School pilots", "Content partnerships", "Government grant access"],
            ["Need curriculum partners", "Need scale-ready infrastructure"],
            "Piloted in 3 schools",
            "Verified",
        ),
        company(
            "comp-4",
            "startup-org-4",
            "GreenHarvest",
            "AgriTech",
            "Idea",
            "Malaysia",
            2,
            "Small farms lose yield because supply coordination is poor.",
            "Supply chain coordination platform for smallholder farms.",
            ["Pilot farms", "IoT prototyping", "Sustainability mentorship"],
            ["No working prototype yet", "Limited funding"],
            "",
            "Pending",
        ),
        company(
            "comp-5",
            "startup-org-5",
            "PayBridge",
            "Fintech",
            "MVP",
            "Malaysia",
            6,
            "Cross-border micro-payments across ASEAN are slow and costly.",
            "Cross-border payment rail for ASEAN micro-transactions.",
            ["Regulatory guidance", "Banking partnerships", "Compliance support"],
            ["Need licensing strategy", "Need sandbox pathway"],
            "3 merchant pilots in Malaysia",
            "Verified",
        ),
        company(
            "comp-6",
            "startup-org-6",
            "CarbonLedger",
            "ClimateTech",
            "Seed",
            "Singapore",
            7,
            "Mid-market manufacturers struggle to measure and verify emissions across suppliers.",
            "Carbon accounting and supplier emissions workflow platform.",
            ["Corporate sustainability pilots", "Carbon reporting readiness", "Enterprise introductions"],
            ["Need anchor manufacturing partner", "Need verification workflow advisor"],
            "6 paid pilots across Malaysia and Singapore",
            "Verified",
        ),
        company(
            "comp-7",
            "startup-org-7",
            "PortPulse",
            "Logistics",
            "Pre-seed",
            "Malaysia",
            5,
            "Freight operators lack unified berth, customs, and cargo exception visibility.",
            "Port operations workflow platform with predictive cargo disruption alerts.",
            ["Regional partnerships", "Market access", "Enterprise pilots"],
            ["Need shipping line design partners", "Need cross-border operations mentors"],
            "Prototype with one port operator",
            "Verified",
        ),
        company(
            "comp-8",
            "startup-org-8",
            "SecureLayer",
            "Cybersecurity",
            "Growth",
            "Malaysia",
            12,
            "Mid-sized enterprises struggle to detect identity risk across cloud and SaaS systems.",
            "Identity posture and privilege monitoring platform.",
            ["CISO introductions", "Compliance readiness", "Enterprise security pilots"],
            ["Need more enterprise buyers", "Need regional reference customers"],
            "28 enterprise customers across ASEAN",
            "Verified",
        ),
        company(
            "comp-9",
            "startup-org-9",
            "RetailRay",
            "RetailTech",
            "MVP",
            "Thailand",
            6,
            "Independent retailers have poor sell-through forecasting and stock visibility.",
            "Demand forecasting and automated replenishment platform for multi-branch retailers.",
            ["SME customer discovery", "Channel partnerships", "Cloud migration"],
            ["Need distributor channels", "Need merchant onboarding playbook"],
            "Pilots running with 18 stores",
            "Verified",
        ),
        company(
            "comp-10",
            "startup-org-10",
            "AgroMesh",
            "AgriTech",
            "Seed",
            "Malaysia",
            8,
            "Fresh produce buyers cannot trace crop quality and harvest reliability fast enough.",
            "Farm-to-buyer traceability and procurement coordination platform.",
            ["Pilot farms", "Manufacturing partners", "Supply chain pilots"],
            ["Need procurement network access", "Need post-harvest logistics support"],
            "Working with 42 farms and 3 wholesalers",
            "Verified",
        ),
        company(
            "comp-11",
            "startup-org-11",
            "CareQueue",
            "Healthtech",
            "Pre-seed",
            "Malaysia",
            4,
            "Outpatient clinics waste capacity because booking, triage, and follow-up are disconnected.",
            "Clinic intake, scheduling, and follow-up coordination platform.",
            ["Clinical pilot access", "Hospital partnerships", "Cloud infrastructure"],
            ["Need pilot clinic cluster", "Need workflow validation"],
            "Prototype used by 1 private clinic group",
            "Verified",
        ),
        company(
            "comp-12",
            "startup-org-12",
            "OmniLend",
            "Fintech",
            "Growth",
            "Indonesia",
            15,
            "SME lenders struggle to underwrite fragmented borrowers consistently across channels.",
            "Embedded credit decision engine and lender workflow stack.",
            ["Regional partnerships", "Banking partnerships", "Enterprise pilots"],
            ["Need new bank distribution partners", "Need faster localization into new markets"],
            "Live with 4 lenders across Indonesia",
            "Verified",
        ),
        company(
            "comp-13",
            "startup-org-13",
            "TutorLoop",
            "EdTech",
            "Seed",
            "Vietnam",
            7,
            "Schools cannot personalize after-school learning support without extra staffing.",
            "AI tutoring orchestration platform for schools and learning centers.",
            ["School pilots", "Government grant access", "Content partnerships"],
            ["Need district-level access", "Need curriculum accreditation support"],
            "Pilots in 9 schools and 2 learning chains",
            "Verified",
        ),
        company(
            "comp-14",
            "startup-org-14",
            "VoltPath",
            "Clean Energy",
            "MVP",
            "Malaysia",
            6,
            "Commercial building owners delay solar and storage adoption because project viability is unclear.",
            "Energy project intelligence and financing-readiness platform.",
            ["Corporate sustainability pilots", "Investor readiness", "Infrastructure partners"],
            ["Need EPC introductions", "Need better project bankability story"],
            "3 feasibility pilots signed",
            "Verified",
        ),
        company(
            "comp-15",
            "startup-org-15",
            "CivicGrid",
            "Mobility",
            "Seed",
            "Singapore",
            9,
            "City operators struggle to coordinate curb, parking, and last-mile logistics in dense corridors.",
            "Mobility operations platform for curb and fleet access management.",
            ["Municipality pilots", "Infrastructure partners", "Sandbox permits"],
            ["Need policy stakeholder buy-in", "Need hardware integration partners"],
            "2 municipal corridor pilots underway",
            "Verified",
        ),
        company(
            "comp-16",
            "startup-org-16",
            "FactoryTwin",
            "DeepTech",
            "MVP",
            "Malaysia",
            10,
            "Factories lack digital visibility into line downtime and process drift at the edge.",
            "Industrial digital twin and anomaly detection platform.",
            ["Enterprise pilots", "Grant readiness", "Research translation"],
            ["Need factory champion users", "Need procurement support"],
            "Pilot live in one electronics plant",
            "Verified",
        ),
        company(
            "comp-17",
            "startup-org-17",
            "MealLink",
            "FoodTech",
            "MVP",
            "Malaysia",
            5,
            "Cloud kitchens and food producers have poor demand and procurement coordination.",
            "Procurement and demand coordination software for distributed food operators.",
            ["Manufacturing partners", "Supply chain pilots", "SME customer discovery"],
            ["Need large buyer anchor", "Need supplier onboarding at scale"],
            "12 paying kitchen operators",
            "Verified",
        ),
        company(
            "comp-18",
            "startup-org-18",
            "FreightSense",
            "Logistics",
            "Seed",
            "Indonesia",
            8,
            "Regional shippers lack predictive visibility on inland freight exceptions and handoffs.",
            "Shipment risk detection and route exception intelligence platform.",
            ["Regional partnerships", "Enterprise pilots", "Localization support"],
            ["Need more cross-border pilots", "Need trade corridor experts"],
            "Pilots with 3 forwarders and 2 manufacturers",
            "Verified",
        ),
        company(
            "comp-19",
            "startup-org-19",
            "ClaimBridge",
            "InsurTech",
            "Seed",
            "Malaysia",
            7,
            "Insurers process small-ticket claims too slowly because evidence review is manual.",
            "Claims automation platform with fraud and triage workflows.",
            ["Banking partnerships", "Regulatory sandbox access", "Enterprise pilots"],
            ["Need insurer reference clients", "Need policy workflow advisors"],
            "Processing pilots with 2 insurers",
            "Verified",
        ),
        company(
            "comp-20",
            "startup-org-20",
            "NurseFlow",
            "Healthtech",
            "Growth",
            "Philippines",
            14,
            "Hospitals cannot optimize nurse staffing and patient handoff quality across wards.",
            "Workforce orchestration platform for hospital staffing and ward coordination.",
            ["Hospital procurement readiness", "Compliance support", "Clinical validation"],
            ["Need procurement navigation help", "Need enterprise hospital champions"],
            "Deployed in 5 hospitals",
            "Verified",
        ),
        company(
            "comp-21",
            "startup-org-21",
            "VaultKite",
            "Cybersecurity",
            "Seed",
            "Malaysia",
            8,
            "Growing companies mismanage secrets and machine credentials across environments.",
            "Secrets governance and machine identity platform.",
            ["CISO introductions", "Enterprise security pilots", "Compliance readiness"],
            ["Need regulated-sector references", "Need enterprise procurement coach"],
            "9 active design partners",
            "Verified",
        ),
        company(
            "comp-22",
            "startup-org-22",
            "PeoplePilot",
            "HRTech",
            "Pre-seed",
            "Malaysia",
            3,
            "SMEs struggle to onboard, train, and retain front-line employees consistently.",
            "Front-line hiring, onboarding, and training workflow platform.",
            ["SME customer discovery", "Channel partnerships", "Content partnerships"],
            ["Need stronger product proof", "Need early adopter pipeline"],
            "Prototype with 2 F&B employers",
            "Pending",
        ),
        company(
            "comp-23",
            "startup-org-23",
            "HydroSight",
            "Clean Energy",
            "Growth",
            "Vietnam",
            13,
            "Industrial campuses waste energy because sub-meter and asset efficiency data is fragmented.",
            "Industrial energy intelligence platform for distributed facilities.",
            ["Infrastructure partners", "Corporate sustainability pilots", "Regional partnerships"],
            ["Need regional integrator network", "Need large industrial references"],
            "18 sites monitored across Vietnam",
            "Verified",
        ),
        company(
            "comp-24",
            "startup-org-24",
            "CropCircle",
            "AgriTech",
            "MVP",
            "Malaysia",
            6,
            "Smallholder growers cannot coordinate demand planning, input financing, and harvest timing.",
            "Grower network operating system for crop planning and buyer matching.",
            ["Pilot farms", "Supply chain pilots", "Sustainability certification"],
            ["Need offtaker pilots", "Need farm ops advisors"],
            "Working with 140 growers in two states",
            "Verified",
        ),
    ]

    contributors = [
        contributor(
            "cont-1",
            "contrib-org-1",
            "Dr. Sarah Lim",
            "Mentor",
            ["Mentor"],
            ["Healthtech", "Regulatory Strategy", "Clinical Pilots", "Hospital Partnerships"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Available",
            4.8,
            capacity={"globalMaxProgrammes": 4, "globalMaxStartupAssignments": 5, "perProgrammeStartupCapacity": 2},
        ),
        contributor(
            "cont-2",
            "contrib-org-2",
            "Google Cloud Malaysia",
            "Partner",
            ["Partner", "Technical Provider"],
            ["Cloud Infrastructure", "AI", "Startup Credits", "Architecture Support"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Available",
            4.9,
            can_support=["Programme"],
        ),
        contributor(
            "cont-3",
            "contrib-org-3",
            "Ahmad Razak",
            "Mentor",
            ["Mentor"],
            ["Go-to-market Strategy", "Fundraising", "Marketplace Scaling", "Fintech"],
            ["Seed", "Growth"],
            ["Malaysia", "Singapore", "Indonesia"],
            "Available",
            4.7,
            capacity={"globalMaxProgrammes": 3, "globalMaxStartupAssignments": 4, "perProgrammeStartupCapacity": 2},
        ),
        contributor(
            "cont-4",
            "contrib-org-4",
            "LegalPro MY",
            "Service Provider",
            ["Service Provider"],
            ["Compliance", "Corporate Law", "Regulatory Advisory", "IP Protection"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia"],
            "Available",
            4.5,
            can_support=["Programme"],
        ),
        contributor(
            "cont-5",
            "contrib-org-5",
            "SeedFund MY",
            "Investor",
            ["Investor"],
            [],
            ["Pre-seed", "Seed"],
            ["Malaysia"],
            "Available",
            4.6,
            can_support=["Programme"],
            investment_thesis=["AI", "SaaS", "Healthtech", "Fintech"],
            stages=["Pre-seed", "Seed"],
            ticket_size="MYR 100k - MYR 1M",
        ),
        contributor(
            "cont-6",
            "contrib-org-6",
            "Bank Negara Sandbox Team",
            "Partner",
            ["Partner"],
            ["Regulatory Sandbox", "Fintech Compliance", "Payments"],
            ["MVP", "Seed"],
            ["Malaysia"],
            "Available",
            4.4,
            can_support=["Programme"],
        ),
        contributor(
            "cont-7",
            "contrib-org-7",
            "Dr. Kavitha Nair",
            "Mentor",
            ["Mentor"],
            ["Hospital Procurement", "Clinical Workflows", "Care Operations", "Healthtech"],
            ["Pre-seed", "MVP", "Seed", "Growth"],
            ["Malaysia", "Philippines"],
            "Available",
            4.7,
            capacity={"globalMaxProgrammes": 4, "globalMaxStartupAssignments": 4, "perProgrammeStartupCapacity": 2},
        ),
        contributor(
            "cont-8",
            "contrib-org-8",
            "Daniel Tan",
            "Mentor",
            ["Mentor"],
            ["Cybersecurity", "Enterprise Sales", "B2B SaaS", "Compliance Readiness"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Limited",
            4.8,
            capacity={"globalMaxProgrammes": 3, "globalMaxStartupAssignments": 2, "perProgrammeStartupCapacity": 1},
        ),
        contributor(
            "cont-9",
            "contrib-org-9",
            "Aisha Karim",
            "Mentor",
            ["Mentor"],
            ["ClimateTech", "AgriTech", "Sustainability", "Pilot Design"],
            ["Idea", "MVP", "Seed"],
            ["Malaysia", "Singapore"],
            "Available",
            4.6,
            capacity={"globalMaxProgrammes": 4, "globalMaxStartupAssignments": 4, "perProgrammeStartupCapacity": 2},
        ),
        contributor(
            "cont-10",
            "contrib-org-10",
            "ASEAN Hospital Network",
            "Partner",
            ["Partner"],
            ["Hospital Partnerships", "Clinical Validation", "Procurement Navigation"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore", "Philippines"],
            "Available",
            4.8,
            can_support=["Programme"],
        ),
        contributor(
            "cont-11",
            "contrib-org-11",
            "Horizon Ventures",
            "Investor",
            ["Investor"],
            [],
            ["Seed", "Growth"],
            ["Singapore", "Malaysia", "Indonesia"],
            "Available",
            4.7,
            can_support=["Programme"],
            investment_thesis=["ClimateTech", "DeepTech", "Cybersecurity", "Enterprise SaaS"],
            stages=["Seed", "Growth"],
            ticket_size="USD 250k - USD 2M",
        ),
        contributor(
            "cont-12",
            "contrib-org-12",
            "MyDigital SME Network",
            "Partner",
            ["Partner"],
            ["SME Distribution", "Channel Partnerships", "Merchant Access"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia"],
            "Available",
            4.3,
            can_support=["Programme"],
        ),
        contributor(
            "cont-13",
            "contrib-org-13",
            "SecureOps Advisory",
            "Service Provider",
            ["Service Provider"],
            ["ISO 27001", "Security Audits", "Compliance Readiness", "Security Architecture"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Available",
            4.5,
            can_support=["Programme"],
        ),
        contributor(
            "cont-14",
            "contrib-org-14",
            "Catalyst Growth Studio",
            "Service Provider",
            ["Service Provider"],
            ["Go-to-market Strategy", "Enterprise Messaging", "Sales Process Design"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore", "Indonesia"],
            "Available",
            4.4,
            can_support=["Programme"],
        ),
        contributor(
            "cont-15",
            "contrib-org-15",
            "Nusantara Logistics Group",
            "Partner",
            ["Partner"],
            ["Trade Corridors", "Freight Operations", "Distribution Partnerships"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore", "Indonesia", "Vietnam"],
            "Available",
            4.5,
            can_support=["Programme"],
        ),
        contributor(
            "cont-16",
            "contrib-org-16",
            "GreenGrid Capital",
            "Investor",
            ["Investor"],
            [],
            ["Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Limited",
            4.5,
            can_support=["Programme"],
            investment_thesis=["Clean Energy", "ClimateTech", "AgriTech", "Sustainability"],
            stages=["Seed", "Growth"],
            ticket_size="USD 300k - USD 3M",
        ),
        contributor(
            "cont-17",
            "contrib-org-17",
            "EduNation Foundation",
            "Partner",
            ["Partner"],
            ["School Networks", "Curriculum Partnerships", "Learner Access"],
            ["MVP", "Seed"],
            ["Malaysia", "Vietnam"],
            "Available",
            4.6,
            can_support=["Programme"],
        ),
        contributor(
            "cont-18",
            "contrib-org-18",
            "PatentBridge Asia",
            "Service Provider",
            ["Service Provider"],
            ["IP Protection", "Patent Strategy", "Research Commercialisation"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Available",
            4.4,
            can_support=["Programme"],
        ),
        contributor(
            "cont-19",
            "contrib-org-19",
            "Mei Lin Chua",
            "Mentor",
            ["Mentor"],
            ["EdTech", "Consumer Growth", "Learning Product Design", "Partnerships"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Vietnam", "Singapore"],
            "Available",
            4.7,
            capacity={"globalMaxProgrammes": 3, "globalMaxStartupAssignments": 3, "perProgrammeStartupCapacity": 2},
        ),
        contributor(
            "cont-20",
            "contrib-org-20",
            "Farid Iskandar",
            "Mentor",
            ["Mentor"],
            ["DeepTech", "Industrial AI", "Manufacturing Pilots", "Enterprise Procurement"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Available",
            4.8,
            capacity={"globalMaxProgrammes": 4, "globalMaxStartupAssignments": 4, "perProgrammeStartupCapacity": 2},
        ),
        contributor(
            "cont-21",
            "contrib-org-21",
            "Civic Labs MY",
            "Partner",
            ["Partner"],
            ["Municipality Pilots", "Public Sector Procurement", "Urban Infrastructure"],
            ["MVP", "Seed", "Growth"],
            ["Malaysia", "Singapore"],
            "Available",
            4.5,
            can_support=["Programme"],
        ),
        contributor(
            "cont-22",
            "contrib-org-22",
            "PeopleScale Advisory",
            "Service Provider",
            ["Service Provider"],
            ["Workforce Design", "Learning Content", "HR Operations"],
            ["Idea", "Pre-seed", "MVP", "Seed"],
            ["Malaysia"],
            "Available",
            4.2,
            can_support=["Programme"],
        ),
    ]

    company_map = {item["id"]: item for item in companies}
    programme_map = {item["id"]: item for item in programmes}
    contributor_map = {item["id"]: item for item in contributors}

    application_specs = [
        ("comp-1", "prog-2", 94, "Accepted"),
        ("comp-1", "prog-9", 88, "Accepted"),
        ("comp-2", "prog-3", 91, "Accepted"),
        ("comp-2", "prog-7", 83, "Accepted"),
        ("comp-3", "prog-8", 86, "Pending Admin Review"),
        ("comp-3", "prog-1", 72, "Rejected"),
        ("comp-4", "prog-4", 74, "Pending Admin Review"),
        ("comp-4", "prog-12", 69, "Rejected"),
        ("comp-5", "prog-3", 90, "Accepted"),
        ("comp-5", "prog-7", 81, "Accepted"),
        ("comp-6", "prog-4", 89, "Accepted"),
        ("comp-6", "prog-12", 84, "Accepted"),
        ("comp-7", "prog-7", 85, "Accepted"),
        ("comp-7", "prog-11", 77, "Pending Admin Review"),
        ("comp-8", "prog-10", 95, "Accepted"),
        ("comp-8", "prog-6", 82, "Accepted"),
        ("comp-9", "prog-5", 88, "Accepted"),
        ("comp-10", "prog-4", 87, "Accepted"),
        ("comp-10", "prog-12", 84, "Accepted"),
        ("comp-11", "prog-2", 90, "Accepted"),
        ("comp-11", "prog-9", 86, "Accepted"),
        ("comp-12", "prog-7", 92, "Accepted"),
        ("comp-12", "prog-3", 79, "Rejected"),
        ("comp-13", "prog-8", 91, "Accepted"),
        ("comp-14", "prog-4", 85, "Accepted"),
        ("comp-14", "prog-11", 78, "Pending Admin Review"),
        ("comp-15", "prog-11", 90, "Accepted"),
        ("comp-16", "prog-6", 93, "Accepted"),
        ("comp-17", "prog-12", 89, "Accepted"),
        ("comp-17", "prog-5", 73, "Rejected"),
        ("comp-18", "prog-7", 88, "Accepted"),
        ("comp-18", "prog-11", 81, "Accepted"),
        ("comp-19", "prog-3", 89, "Accepted"),
        ("comp-20", "prog-9", 94, "Accepted"),
        ("comp-20", "prog-2", 87, "Accepted"),
        ("comp-21", "prog-10", 93, "Accepted"),
        ("comp-21", "prog-6", 84, "Accepted"),
        ("comp-22", "prog-5", 76, "Pending Admin Review"),
        ("comp-23", "prog-11", 86, "Accepted"),
        ("comp-23", "prog-4", 82, "Accepted"),
        ("comp-24", "prog-12", 90, "Accepted"),
        ("comp-24", "prog-4", 83, "Accepted"),
    ]

    applications = []
    recommendations = []
    relationships = []

    for index, (startup_id, programme_id, score, status) in enumerate(application_specs, start=1):
        startup = company_map[startup_id]
        programme_data = programme_map[programme_id]
        explanation = (
            f"{startup['name']} aligns with {programme_data['name']} through "
            f"{startup['stage']} stage traction in {startup['industry']} and a need profile that overlaps the "
            f"programme outcomes around {programme_data['expectedOutcomes'][0].lower()}."
        )
        applications.append(application(startup_id, programme_id, score, status, explanation))

        rec_status = "Approved" if status == "Accepted" else status
        risks = []
        if startup["verificationStatus"] != "Verified":
            risks.append("Startup profile is not verified yet.")
        if startup["stage"] not in programme_data["targetStages"]:
            risks.append("Startup stage is outside the programme's main focus.")
        if status == "Rejected":
            risks.append("Programme outcomes do not strongly cover the startup's top support needs.")

        recommendation_id = f"rec-startup-programme-{index:03d}"
        recommendations.append(
            recommendation(
                recommendation_id,
                "Startup-to-Programme",
                "Startup",
                startup_id,
                "Programme",
                programme_id,
                programme_id,
                score,
                explanation,
                risks,
                rec_status,
            )
        )

        if status == "Accepted":
            relationship_status = "Completed" if startup_id in {"comp-2", "comp-6", "comp-13", "comp-20"} else "Active"
            relationships.append(
                relationship(
                    f"rel-startup-programme-{index:03d}",
                    "Startup-to-Programme",
                    startup_id,
                    programme_id,
                    programme_id,
                    recommendation_id,
                    score,
                    relationship_status,
                    programme_data["expectedOutcomes"][0],
                    f"2026-04-{(index % 20) + 1:02d}",
                )
            )

    pool_specs = [
        ("cont-1", "prog-2", "Mentor", 92),
        ("cont-1", "prog-9", "Mentor", 90),
        ("cont-2", "prog-1", "Partner", 94),
        ("cont-2", "prog-5", "Partner", 92),
        ("cont-2", "prog-10", "Partner", 88),
        ("cont-3", "prog-3", "Mentor", 91),
        ("cont-3", "prog-7", "Mentor", 94),
        ("cont-4", "prog-2", "Service Provider", 88),
        ("cont-4", "prog-3", "Service Provider", 84),
        ("cont-4", "prog-9", "Service Provider", 86),
        ("cont-5", "prog-1", "Investor", 89),
        ("cont-5", "prog-3", "Investor", 87),
        ("cont-5", "prog-8", "Investor", 78),
        ("cont-6", "prog-3", "Partner", 93),
        ("cont-7", "prog-2", "Mentor", 93),
        ("cont-7", "prog-9", "Mentor", 92),
        ("cont-8", "prog-10", "Mentor", 90),
        ("cont-8", "prog-6", "Mentor", 86),
        ("cont-9", "prog-4", "Mentor", 92),
        ("cont-9", "prog-12", "Mentor", 90),
        ("cont-10", "prog-2", "Partner", 94),
        ("cont-10", "prog-9", "Partner", 95),
        ("cont-11", "prog-6", "Investor", 90),
        ("cont-11", "prog-10", "Investor", 88),
        ("cont-12", "prog-5", "Partner", 91),
        ("cont-12", "prog-8", "Partner", 76),
        ("cont-13", "prog-10", "Service Provider", 90),
        ("cont-13", "prog-6", "Service Provider", 85),
        ("cont-14", "prog-5", "Service Provider", 88),
        ("cont-14", "prog-7", "Service Provider", 86),
        ("cont-15", "prog-7", "Partner", 92),
        ("cont-15", "prog-11", "Partner", 88),
        ("cont-15", "prog-12", "Partner", 79),
        ("cont-16", "prog-4", "Investor", 90),
        ("cont-16", "prog-12", "Investor", 88),
        ("cont-17", "prog-8", "Partner", 92),
        ("cont-18", "prog-6", "Service Provider", 87),
        ("cont-19", "prog-8", "Mentor", 93),
        ("cont-20", "prog-6", "Mentor", 94),
        ("cont-20", "prog-11", "Mentor", 79),
        ("cont-21", "prog-11", "Partner", 91),
        ("cont-21", "prog-4", "Partner", 80),
        ("cont-22", "prog-5", "Service Provider", 84),
        ("cont-22", "prog-8", "Service Provider", 83),
    ]

    programme_contributors = []
    for index, (contributor_id, programme_id, contributor_type, score) in enumerate(pool_specs, start=1):
        programme_contributors.append(programme_contributor(contributor_id, programme_id, contributor_type))
        contributor_data = contributor_map[contributor_id]
        programme_data = programme_map[programme_id]
        explanation = (
            f"{contributor_data['name']} adds {contributor_type.lower()} capacity to {programme_data['name']} with "
            f"relevant expertise in {', '.join((contributor_data.get('expertise') or contributor_data.get('investmentThesis') or [])[:2])}."
        )
        risks = []
        if contributor_data["availability"] == "Limited":
            risks.append("Mentor availability is limited." if contributor_type == "Mentor" else "Contributor is currently unavailable.")
        recommendations.append(
            recommendation(
                f"rec-contributor-programme-{index:03d}",
                f"{contributor_type}-to-Programme",
                "Contributor",
                contributor_id,
                "Programme",
                programme_id,
                programme_id,
                score,
                explanation,
                risks,
                "Approved",
            )
        )

    pending_pool_specs = [
        ("cont-11", "prog-7", "Investor", 81, ["Investor stage focus does not strongly match the programme."]),
        ("cont-18", "prog-1", "Service Provider", 77, []),
        ("cont-21", "prog-12", "Partner", 75, []),
        ("cont-22", "prog-1", "Service Provider", 73, ["Programme outcomes do not strongly cover the startup's top support needs."]),
    ]
    for index, (contributor_id, programme_id, contributor_type, score, risks) in enumerate(pending_pool_specs, start=1):
        contributor_data = contributor_map[contributor_id]
        programme_data = programme_map[programme_id]
        recommendations.append(
            recommendation(
                f"rec-contributor-programme-pending-{index:03d}",
                f"{contributor_type}-to-Programme",
                "Contributor",
                contributor_id,
                "Programme",
                programme_id,
                programme_id,
                score,
                f"{contributor_data['name']} is a plausible addition to {programme_data['name']}, but the fit still needs admin review.",
                risks,
                "Pending Approval",
            )
        )

    mentor_assignment_specs = [
        ("comp-1", "cont-1", "prog-2", 94, "Active", "Clinical pilot and regulatory roadmap"),
        ("comp-2", "cont-3", "prog-3", 89, "Completed", "Go-to-market support and bank partnership preparation"),
        ("comp-5", "cont-3", "prog-3", 88, "Active", "Fintech regulatory strategy and distribution readiness"),
        ("comp-6", "cont-9", "prog-4", 86, "Completed", "Corporate sustainability pilot design"),
        ("comp-8", "cont-8", "prog-10", 95, "Active", "Enterprise security buyer access and compliance readiness"),
        ("comp-11", "cont-7", "prog-2", 90, "Needs Review", "Clinical operations fit validation"),
        ("comp-13", "cont-19", "prog-8", 92, "Completed", "School adoption strategy and partnership design"),
        ("comp-16", "cont-20", "prog-6", 93, "Active", "Industrial pilot planning and procurement navigation"),
        ("comp-20", "cont-7", "prog-9", 91, "Completed", "Hospital procurement and validation strategy"),
        ("comp-21", "cont-8", "prog-10", 92, "Completed", "Enterprise security positioning and buyer access"),
        ("comp-24", "cont-9", "prog-12", 87, "Active", "Pilot grower network activation and sustainability planning"),
    ]

    mentor_relationship_ids = {}
    for index, (startup_id, contributor_id, programme_id, score, status, expected_outcome) in enumerate(mentor_assignment_specs, start=1):
        startup = company_map[startup_id]
        mentor = contributor_map[contributor_id]
        programme_data = programme_map[programme_id]
        recommendation_id = f"rec-startup-mentor-{index:03d}"
        recommendations.append(
            recommendation(
                recommendation_id,
                "Startup-to-Mentor",
                "Startup",
                startup_id,
                "Contributor",
                contributor_id,
                programme_id,
                score,
                f"{mentor['name']} is a strong mentor fit for {startup['name']} inside {programme_data['name']} because the startup's needs overlap the mentor's domain expertise.",
                ["Mentor has limited remaining availability."] if mentor["availability"] == "Limited" else [],
                "Approved",
            )
        )
        rel_id = f"rel-startup-mentor-{index:03d}"
        mentor_relationship_ids[rel_id] = (startup_id, contributor_id, programme_id)
        relationships.append(
            relationship(
                rel_id,
                "Startup-to-Mentor",
                startup_id,
                contributor_id,
                programme_id,
                recommendation_id,
                score,
                status,
                expected_outcome,
                f"2026-04-{((index + 7) % 20) + 1:02d}",
            )
        )

    pending_mentor_specs = [
        ("comp-12", "cont-3", "prog-7", 81, ["Mentor has limited remaining availability."]),
        ("comp-15", "cont-20", "prog-11", 76, ["Domain fit is weaker than ideal."]),
        ("comp-18", "cont-3", "prog-7", 79, []),
        ("comp-23", "cont-9", "prog-11", 72, ["Domain fit is weaker than ideal."]),
    ]
    for index, (startup_id, contributor_id, programme_id, score, risks) in enumerate(pending_mentor_specs, start=1):
        startup = company_map[startup_id]
        mentor = contributor_map[contributor_id]
        recommendations.append(
            recommendation(
                f"rec-startup-mentor-pending-{index:03d}",
                "Startup-to-Mentor",
                "Startup",
                startup_id,
                "Contributor",
                contributor_id,
                programme_id,
                score,
                f"{mentor['name']} could support {startup['name']} in {programme_map[programme_id]['name']}, but the match still needs admin review.",
                risks,
                "Pending Approval",
            )
        )

    outcomes = [
        outcome(
            "out-001",
            "rel-startup-mentor-002",
            "Yes",
            "High",
            4.8,
            "The mentor helped us tighten our bank partnership narrative and procurement sequence.",
            4.4,
            "The team executed quickly and translated feedback into enterprise-ready messaging.",
            "Strong programme and mentor fit. Repeat for fintech teams that already have customer traction.",
            "Fintech seed startups perform best when GTM mentoring is paired with programme-level regulatory access and enterprise introductions.",
            True,
        ),
        outcome(
            "out-002",
            "rel-startup-mentor-004",
            "Partial",
            "High",
            4.4,
            "We secured a sustainability pilot design, but still need a larger deployment partner.",
            4.2,
            "The startup was pilot-ready, though commercial conversion will require stronger corporate sponsors.",
            "Keep pairing climate founders with pilot-design mentors early, then layer in investor support.",
            "ClimateTech teams convert pilot interest faster when sustainability mentors are paired with corporate buyer access before fundraising.",
            True,
        ),
        outcome(
            "out-003",
            "rel-startup-mentor-007",
            "Yes",
            "High",
            4.7,
            "The mentor unlocked the right school partner strategy and improved our product rollout plan.",
            4.5,
            "Strong execution. The team responded well to curriculum and adoption feedback.",
            "Excellent mentor fit for EdTech teams moving from pilot usage into institutional rollout.",
            "EdTech startups gain more from partnership-oriented mentors than generic growth mentors when school adoption is the key bottleneck.",
            True,
        ),
        outcome(
            "out-004",
            "rel-startup-mentor-009",
            "Yes",
            "High",
            4.6,
            "We now understand hospital procurement sequencing and have a clearer validation roadmap.",
            4.4,
            "The team was mature enough for procurement planning and responded well to enterprise process coaching.",
            "Use this pattern again for growth-stage hospital workflow products entering procurement-heavy accounts.",
            "Hospital workflow startups at growth stage benefit from procurement-focused mentors more than generic clinical advisors.",
            True,
        ),
        outcome(
            "out-005",
            "rel-startup-mentor-010",
            "Partial",
            "Medium",
            4.1,
            "The relationship clarified our compliance path, but buyer cycles remain slow.",
            4.0,
            "Good team and domain fit, though enterprise timing remains a risk.",
            "Keep the mentor profile, but add more direct enterprise design partners earlier in the programme.",
            "Cybersecurity startups improve faster when compliance mentoring is combined with direct buyer design partners rather than advisory alone.",
            True,
        ),
        outcome(
            "out-006",
            "rel-startup-programme-003",
            "Yes",
            "High",
            4.5,
            "The programme opened the right bank and regulator conversations at the right time.",
            4.2,
            "The startup entered with enough traction to use programme resources effectively.",
            "Excellent market-access fit. This should remain a flagship pathway for bank-facing fintech teams.",
            "Fintech startups with early traction extract high value from programmes that combine sandbox guidance with bank distribution access.",
            True,
        ),
        outcome(
            "out-007",
            "rel-startup-programme-006",
            "Partial",
            "Medium",
            4.0,
            "We got the right climate pilot conversations, but commercial closure still needs work.",
            4.1,
            "Promising founder-market fit, though buyer qualification needs to tighten earlier.",
            "The programme fit is good, but climate startups need more commercial readiness support before pilot expansion.",
            "Climate programmes should add stronger commercial qualification support before expanding pilot access for seed-stage companies.",
            True,
        ),
        outcome(
            "out-008",
            "rel-startup-programme-034",
            "Yes",
            "High",
            4.7,
            "The procurement track accelerated hospital buyer readiness and gave us confidence in the rollout plan.",
            4.5,
            "This company was ready for a procurement-heavy programme and used the support well.",
            "Digital health products with existing deployment traction should be routed into procurement-led tracks earlier.",
            "Growth-stage digital health startups benefit from procurement-track programmes once they already have live operational deployments.",
            True,
        ),
    ]

    graph_edges = []
    for organisation_data in organisations:
        for programme_data in programmes:
            if programme_data["organisationId"] == organisation_data["id"]:
                graph_edges.append(
                    graph_edge(
                        "Organisation",
                        organisation_data["id"],
                        "OWNS",
                        "Programme",
                        programme_data["id"],
                        programme_id=programme_data["id"],
                        created_from="programmes",
                        created_from_id=programme_data["id"],
                    )
                )

    for application_data in applications:
        graph_edges.append(
            graph_edge(
                "Startup",
                application_data["startupId"],
                "APPLIED_TO",
                "Programme",
                application_data["programmeId"],
                programme_id=application_data["programmeId"],
                created_from="applications",
                created_from_id=application_data["id"],
            )
        )
        if application_data["status"] == "Accepted":
            graph_edges.append(
                graph_edge(
                    "Startup",
                    application_data["startupId"],
                    "ACCEPTED_INTO",
                    "Programme",
                    application_data["programmeId"],
                    programme_id=application_data["programmeId"],
                    created_from="applications",
                    created_from_id=application_data["id"],
                )
            )

    for pool in programme_contributors:
        graph_edges.append(
            graph_edge(
                "Contributor",
                pool["contributorId"],
                "ATTACHED_TO",
                "Programme",
                pool["programmeId"],
                programme_id=pool["programmeId"],
                created_from="programmeContributors",
                created_from_id=pool["id"],
                metadata={"contributorType": pool["contributorType"]},
            )
        )

    relationship_map = {item["id"]: item for item in relationships}
    for relationship_data in relationships:
        if relationship_data["relationshipType"] == "Startup-to-Mentor":
            graph_edges.append(
                graph_edge(
                    "Startup",
                    relationship_data["sourceEntityId"],
                    "MATCHED_WITH",
                    "Contributor",
                    relationship_data["targetEntityId"],
                    programme_id=relationship_data["programmeId"],
                    created_from="relationships",
                    created_from_id=relationship_data["id"],
                )
            )

    for outcome_data in outcomes:
        relationship_data = relationship_map.get(outcome_data["relationshipId"])
        graph_edges.append(
            graph_edge(
                "Relationship",
                outcome_data["relationshipId"],
                "PRODUCED_OUTCOME",
                "Outcome",
                outcome_data["id"],
                programme_id=relationship_data["programmeId"] if relationship_data else None,
                created_from="outcomes",
                created_from_id=outcome_data["id"],
                metadata={"outcomeAchieved": outcome_data["outcomeAchieved"], "reusePattern": outcome_data["reusePattern"]},
            )
        )

    for startup in companies:
        if startup["id"] == "comp-1":
            startup["authUid"] = "demo-startup"
    for contributor_record in contributors:
        if contributor_record["id"] == "cont-1":
            contributor_record["authUid"] = "demo-contributor"

    accounts = [
        account(
            login["uid"],
            login["email"],
            login["display_name"],
            login["account_type"],
            login["entity_type"],
            login["entity_id"],
            login["status"],
            login.get("role_key"),
        )
        for login in DEMO_LOGINS
    ]

    role_assignments = []
    for account_item in accounts:
        role_key = account_item["roleKey"]
        uid = account_item["id"]
        entity_id = account_item["entityId"]
        if role_key == "organisation_admin":
            role_assignments.append(
                role_assignment(
                    f"ra-org-{uid}",
                    uid,
                    "organisation_admin",
                    "organisation",
                    entity_id,
                    status="active",
                    organisation_id=entity_id,
                )
            )
        elif role_key == "startup":
            role_assignments.append(
                role_assignment(
                    f"ra-startup-{uid}",
                    uid,
                    "startup",
                    "self",
                    entity_id,
                    status="active",
                )
            )
        else:
            role_assignments.append(
                role_assignment(
                    f"ra-contributor-{uid}",
                    uid,
                    role_key,
                    "self",
                    entity_id,
                    status="active",
                )
            )

    for programme in programmes:
        role_assignments.append(
            role_assignment(
                f"ra-programme-slot-{programme['id']}",
                None,
                "programme_admin",
                "programme",
                programme["id"],
                status="unassigned",
                organisation_id=programme["organisationId"],
                programme_id=programme["id"],
            )
        )

    return {
        "roleAssignments": role_assignments,
        "accounts": accounts,
        "organisations": organisations,
        "programmes": programmes,
        "companies": companies,
        "contributors": contributors,
        "applications": applications,
        "programmeContributors": programme_contributors,
        "recommendations": recommendations,
        "relationships": relationships,
        "outcomes": outcomes,
        "graph_edges": graph_edges,
    }


def seed_data():
    print("Clearing existing emulator data for Lattice demo collections...")
    for collection_name in MANAGED_COLLECTIONS:
        clear_collection(collection_name)

    dataset = build_seed_data()
    print("Seeding expanded Lattice ecosystem dataset...")
    for collection_name in MANAGED_COLLECTIONS[::-1]:
        seed_collection(collection_name, dataset.get(collection_name, []))
    sync_demo_auth_users()

    print(
        "Seed complete with "
        f"{len(dataset['accounts'])} accounts, "
        f"{len(dataset['organisations'])} organisations, "
        f"{len(dataset['programmes'])} programmes, "
        f"{len(dataset['companies'])} companies, "
        f"{len(dataset['contributors'])} contributors, "
        f"{len(dataset['applications'])} applications, "
        f"{len(dataset['programmeContributors'])} programme pool assignments, "
        f"{len(dataset['recommendations'])} recommendations, "
        f"{len(dataset['relationships'])} relationships, and "
        f"{len(dataset['outcomes'])} outcomes."
    )


if __name__ == "__main__":
    seed_data()
