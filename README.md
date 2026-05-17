# Lattice

## The Problem
Startup ecosystems often handle mentor matching, partner access, and programme admissions as one-off, manual actions. This leads to fragmented relationships, inefficient matching, and a lack of data-driven insights into what makes a successful engagement.

## Our Solution
Lattice is a programme-first relationship orchestration platform. We turn ecosystem management into structured recommendations, approvals, active relationships, and outcome-learning loops. 

Instead of direct startup-to-mentor matching, everything is anchored to a **programme context**:
1. Startups are recommended into programmes.
2. Contributors are attached to programme pools.
3. Mentors are recommended to accepted startups.
4. Admins approve or reject recommendations.
5. Finished relationships generate structured outcomes and reusable lessons.

## Our Backend Architecture
- **Frontend**: React 19, Vite, React Router, Firebase Web SDK
- **Backend**: Firebase Functions (Python) and Firestore
- **Workflow Engine**: The backend runs a `read-score-explain-approve-learn` cycle. It handles matching thresholds and state transitions, ensuring admins always remain in the approval loop before any relationship is formalized.

## Our AI Integration
We use **Gemini 3.1 Flash-Lite** and **gemini-embedding-2** for specific, high-value tasks rather than running the whole system end-to-end:
- **Embeddings**: Converting startup, programme, and contributor data into vectors to compute semantic similarity.
- **Explanations**: Generating human-readable reasoning (and risk framing) to explain *why* a specific match was recommended.
- **Summaries**: Structuring raw data into clean JSON summaries for startup profiles.
- **Learning & Insights**: Synthesizing completed relationship outcomes into one-line reusable lessons and generating ecosystem-wide insight cards.

## Test Accounts (Live Firebase Auth)
The application uses live Firebase Auth. Use the following credentials to test different roles and workspaces:

- **Platform Admin:** `platform.admin@lattice.demo` / `Lattice2026!platform`
- **Programme Admin:** `programme.admin.prog-1@lattice.demo` / `Lattice2026!prog-1-admin`
- **Organisation Admin:** `org.asean-founders-network.org-2@lattice.demo` / `Lattice2026!org-2`
- **Startup:** `startup.eduleap.comp-3@lattice.demo` / `Lattice2026!comp-3`
- **Mentor:** `contrib.farid-iskandar.cont-20@lattice.demo` / `Lattice2026!cont-20`
- **Service Provider:** `contrib.legalpro-my.cont-4@lattice.demo` / `Lattice2026!cont-4`
- **Partner:** `contrib.google-cloud-malaysia.cont-2@lattice.demo` / `Lattice2026!cont-2`
- **Investor:** `contrib.seedfund-my.cont-5@lattice.demo` / `Lattice2026!cont-5`

## Local Development

### 1. Install Dependencies
```bash
# Frontend
cd frontend
npm install

# Backend
cd ../functions
pip install -r requirements.txt
```

### 2. Run Locally
Start the Firebase emulators (from the project root):
```bash
firebase emulators:start
```

Start the React frontend (in a new terminal):
```bash
cd frontend
npm run dev
```
