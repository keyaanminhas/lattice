# Lattice MVP: Team & AI Alignment Plan

This document serves as the master plan for building the Lattice MVP during the hackathon. Since all 4 teammates are using AI coding assistants, this file includes a **Universal AI Context Prompt** that each teammate can feed to their AI to immediately get them up to speed.

## 🚀 What to Start First
Before anything else, the **Frontend Foundation** and **Database Schema** need to be established so that the AI matching engine and the dashboards have a shared structure to work with.
1. **Initialize the Frontend**: Decide if you are sticking to Vanilla HTML/JS/CSS (as currently set up in `/public`) or using a framework (like React/Vite). Set up the basic routing and shared CSS design system.
2. **Define Firestore Collections**: Write out the exact JSON structure for `Companies`, `Contributors`, `Programmes`, and `Relationships`.

---

## 👥 Division of Labor (4 Teammates)

We divide the Lattice MVP into 4 parallel tracks so you can build simultaneously without merge conflicts:

### **Track 1: AI & Python Backend (Teammate 1)**
* **Focus**: The Brain of Lattice.
* **Tasks**: Write the Firebase Cloud Functions (Python) in `/functions` to connect to LLMs. Create the "AI Relationship Recommendation Engine" that takes a company profile and contributor profiles, and outputs match scores and explanations.
* **Files**: `/functions/main.py`, `/functions/requirements.txt`

### **Track 2: Data, Auth & Rules (Teammate 2)**
* **Focus**: The Core Architecture.
* **Tasks**: Define the Firestore database schema. Set up Firebase Authentication (Login/Roles). Write `firestore.rules` to secure the data (Admin vs Company vs Contributor access). Create a script to populate the database with mock hackathon data.
* **Files**: `/firestore.rules`, `/firestore.indexes.json`, Seed scripts.

### **Track 3: Admin & Ecosystem Dashboards (Teammate 3)**
* **Focus**: The Ecosystem Owner & Programme Admin UX.
* **Tasks**: Build the UI for the **Ecosystem Dashboard**, **Programme Management**, and the **Relationship Approval Board** (Kanban style).
* **Files**: `/public/admin/*`, CSS, API integration for fetching relationships.

### **Track 4: Participant Portals & Onboarding (Teammate 4)**
* **Focus**: The Company & Contributor UX.
* **Tasks**: Build the UI for **Company Profile Submission**, **Contributor Onboarding**, **Programme Applications**, and the **Feedback/Outcome Forms**.
* **Files**: `/public/company/*`, `/public/contributor/*`, Onboarding forms.

---

## 🤖 Copy-Paste AI Prompts for Each Teammate

*Instruct your teammates to open their AI chat and paste the following prompt corresponding to their track. They should also provide the AI with the `README.md` file.*

### For Teammate 1 (AI & Backend)
> **PROMPT:** "You are an expert AI Backend Developer. We are building 'Lattice', an AI-powered relationship orchestration platform for innovation ecosystems. I am responsible for Track 1: The AI Relationship Recommendation Engine. Our backend uses Firebase Cloud Functions (Python) located in the `/functions` directory. Please read the `README.md` for context. Our first task is to create a Python Firebase function that accepts a Company Profile and a list of Contributor Profiles, sends them to an LLM, and returns a JSON array of recommended relationships with a `matchScore`, `explanation`, and `risks`. Let's draft the `main.py` and the prompt structure for the LLM."

### For Teammate 2 (Database & Auth)
> **PROMPT:** "You are an expert Firebase Architect. We are building 'Lattice', an AI-powered relationship orchestration platform for innovation ecosystems. I am responsible for Track 2: Database Schema, Auth, and Security Rules. Our project uses Firebase Firestore. Please read the `README.md` for context. Our first task is to define the exact NoSQL document schema for 5 collections: `Ecosystems`, `Programmes`, `Companies`, `Contributors`, and `Relationships`. After defining the JSON schemas, we need to write the `firestore.rules` to ensure only Programme Admins can approve relationships, while Companies and Contributors can only read their own active relationships."

### For Teammate 3 (Admin Dashboards)
> **PROMPT:** "You are an expert Frontend Developer specializing in premium, modern UI/UX. We are building 'Lattice', an AI-powered relationship orchestration platform for innovation ecosystems. I am responsible for Track 3: The Admin Dashboards. Our frontend is in the `/public` directory. Please read the `README.md` for context. We need to build a dynamic, visually stunning Ecosystem Dashboard and a Relationship Approval Board (a kanban board where admins can approve or reject AI-recommended linkages). Let's start by designing the layout and HTML/CSS structure for the Ecosystem Dashboard, ensuring it looks extremely premium and responsive."

### For Teammate 4 (Participant Portals)
> **PROMPT:** "You are an expert Frontend Developer specializing in premium, user-friendly UI/UX. We are building 'Lattice', an AI-powered relationship orchestration platform for innovation ecosystems. I am responsible for Track 4: Participant Portals and Onboarding. Our frontend is in the `/public` directory. Please read the `README.md` for context. We need to build the onboarding flow for Companies and Contributors (mentors/partners), capturing their profiles, needs, and expertise. We also need to build the Engagement Outcome Feedback form. Let's start by designing a beautiful, step-by-step Company Onboarding HTML/CSS form that feels modern, alive, and polished."

---
## Next Steps for the Team Lead
1. Tell your 3 teammates to pull the latest changes from GitHub.
2. Have each teammate copy their specific AI prompt and start working in their designated area!
