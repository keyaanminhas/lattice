# Lattice

Lattice is a programme-first relationship orchestration platform for startup ecosystems. Instead of treating mentor matching, partner access, and programme admissions as one-off manual actions, the app turns them into structured recommendations, approvals, active relationships, and outcome-learning loops.

The current repo contains a working React frontend, Firebase-backed Python callable functions, seeded demo data, and Gemini-powered scoring, summaries, and ecosystem insights.

## What The Current Build Does

- Recommends startups into programmes before any mentor relationship is activated.
- Recommends contributors into approved programme pools.
- Recommends mentors for accepted startups inside a specific programme context.
- Requires admin approval before a recommendation becomes an application, pool assignment, or active relationship.
- Captures outcome feedback and turns it into reusable AI lessons.
- Generates AI startup summaries and ecosystem-level insight cards.

## Repo Layout

```text
frontend/                  React + Vite application
  src/pages/               Admin, startup, contributor, programme, and insights screens
functions/                 Firebase Cloud Functions (Python)
  main.py                  Matching, review, insights, and outcome-learning callables
public/                    Legacy static hosting assets
seed_db.py                 Seeds Firestore emulator/demo data
compute_all_embeddings.py  Generates embedding vectors for companies, contributors, programmes
run_bulk_generation.py     Prints recommendation queue context
test_match.py              Quick callable-function smoke test
AI_TEAM_PLAN.md            Team coordination notes from the hackathon build
```

## Stack

- Frontend: React 19, Vite, React Router, Firebase Web SDK
- Backend: Firebase Functions for Python, Firestore
- AI: Gemini 2.5 Flash for generation, `gemini-embedding-2` for semantic matching
- Local tooling: Firebase Emulator Suite

## Product Model

The current implementation is intentionally programme-first:

1. Organisations define programmes with sector, stage, country, and expected outcome constraints.
2. Contributors can be attached to programme pools.
3. Startups are recommended into programmes.
4. Accepted startups can then receive mentor recommendations within that programme.
5. Admins approve or reject recommendations.
6. Completed relationships generate structured outcomes and one-line AI lessons for future reuse.

This is the main design constraint to preserve in future changes. Do not collapse the system back into direct startup-to-mentor matching without programme context.

## Firestore Collections Used By The App

- `organisations`
- `programmes`
- `companies`
- `contributors`
- `applications`
- `programmeContributors`
- `recommendations`
- `relationships`
- `outcomes`

## Key Callable Functions

- `recommend_programmes_for_startup`: ranks programme fit for a startup and creates pending recommendations.
- `recommend_contributor_to_programmes`: suggests which contributors should join which programme pools.
- `recommend_mentor_for_startup`: ranks mentors for an accepted startup within a specific programme.
- `review_recommendation`: approves or rejects a recommendation and materializes the correct downstream object.
- `update_relationship_status`: advances relationship lifecycle state.
- `submit_outcome`: stores ratings and feedback, then generates a reusable AI lesson.
- `summarise_startup_profile`: returns a structured AI summary for a startup profile.
- `summarise_company_profile`: alias-style callable for company summary consumers.
- `get_ai_insights`: returns four ecosystem insight cards plus supporting stats.
- `get_dashboard_stats`: returns dashboard KPI totals and rates.

## Demo Roles

The login screen currently uses simple demo role selection instead of full auth:

- `admin`: ecosystem / programme admin workspace
- `company`: startup dashboard using seeded company `comp-1` (`MediScan AI`)
- `contributor`: mentor dashboard using seeded contributor `cont-1` (`Dr. Sarah Lim`)

## Local Development

### 1. Install frontend dependencies

```bash
cd frontend
npm install
```

### 2. Install backend dependencies

```bash
cd functions
pip install -r requirements.txt
```

If you want to run the helper scripts in the repo root, also install:

```bash
pip install python-dotenv requests
```

### 3. Configure environment variables

Create `functions/.env` with at least:

```env
GEMINI_API_KEY=your_key_here
FUNCTIONS_DISCOVERY_TIMEOUT=60000
```

### 4. Start Firebase emulators

From the repo root:

```bash
firebase emulators:start
```

This repo is configured for:

- Firestore emulator: `127.0.0.1:8080`
- Functions emulator: `127.0.0.1:5001`
- Hosting emulator: `127.0.0.1:5000`

### 5. Seed demo data

In a separate shell:

```bash
python seed_db.py
```

### 6. Generate embeddings

```bash
python compute_all_embeddings.py
```

### 7. Start the React app

```bash
cd frontend
npm run dev
```

The frontend auto-connects to Firestore and Functions emulators when opened on `localhost` or `127.0.0.1`.

## Useful Test / Utility Scripts

```bash
python test_match.py
python run_bulk_generation.py
```

`test_match.py` sends quick callable requests to the local functions emulator for dashboard stats, startup summarization, programme recommendation, and mentor recommendation.

## Current AI Prompting Approach

The backend is using Gemini for four distinct jobs:

- concise explanation generation for recommendations
- structured startup profile summarization
- one-sentence outcome lesson generation
- four-card ecosystem insight generation

The matching score itself is not purely LLM-based. It is a hybrid of:

- overlap scoring across sector, stage, needs, outcomes, and geography
- contributor availability / capacity signals
- embedding similarity
- LLM-generated explanation text layered on top of deterministic scoring

## Updated AI Handoff Prompt

Use this when handing the repo to another teammate or coding assistant:

```text
You are working on Lattice, a programme-first startup ecosystem orchestration platform.

Read the README first, then inspect the existing code before proposing changes.

Current stack:
- React + Vite frontend in /frontend
- Firebase callable functions in /functions/main.py
- Firestore as the source of truth
- Gemini 2.5 Flash for summaries, explanations, lessons, and insights
- gemini-embedding-2 for semantic similarity

Core product rule:
Startups do not get direct mentor access first. They are recommended into programmes, contributors are attached to programme pools, and mentor relationships happen inside accepted programme context. Preserve that workflow.

Main collections:
organisations, programmes, companies, contributors, applications, programmeContributors, recommendations, relationships, outcomes

Main callable functions:
recommend_programmes_for_startup
recommend_contributor_to_programmes
recommend_mentor_for_startup
review_recommendation
update_relationship_status
submit_outcome
summarise_startup_profile
get_ai_insights
get_dashboard_stats

When making changes:
- keep recommendation outputs explainable
- keep admins in the approval loop
- do not break the seeded demo flow
- prefer editing the existing architecture over introducing parallel patterns
- if you change data shape, update both frontend consumers and callable functions

If the task touches AI behavior, inspect the current prompt strings in /functions/main.py and keep outputs JSON-only where the parser expects JSON.
```

## Notes

- The active application UI is the React app in `frontend/`.
- `public/` still exists for legacy static hosting assets.
- Seed data is Malaysia-focused and centered on startup support, mentor pools, and programme approvals.
