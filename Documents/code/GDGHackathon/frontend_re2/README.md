# Lattice Frontend (`frontend_re2`)

Enterprise Next.js 15 UI for the Lattice RBAC platform — formal, high-density, Graph RAG–transparent.

## Quick start

```bash
cd frontend_re2
cp .env.example .env.local
# Fill Firebase web app keys from Firebase Console → Project settings
npm install
npm run dev
```

Open http://localhost:3000

### Development logins

All accounts use password **`LatticeDemo2026!`** — see [DEMO_ACCOUNTS.md](./DEMO_ACCOUNTS.md).

On `/login`, use the **Development logins** panel to auto-fill credentials (login page only).

```bash
npm run seed:demo   # re-create users in Firebase (from backend)
```

## Backend

- Auth: Firebase (`lattice-2026`)
- API: Callable `rbacApi` in region `asia-southeast1` (`NEXT_PUBLIC_RBAC_REGION`)
- Database: `rbac-new-db` (via backend only)

## Routes

| Path | Audience |
|------|----------|
| `/` | Public landing + LatticeGraph hero |
| `/login`, `/signup` | Auth gateway + progressive profiling |
| `/auth/resolve` | Post-login role router |
| `/platform` | Platform admin |
| `/org/[orgId]` | Organisation admin |
| `/programme/[programmeId]` | Programme admin |
| `/programme/[programmeId]/matches` | XAI mentor match review |
| `/startup/[entityId]` | Startup |
| `/contributor/[entityId]` | Mentor / partner / investor / provider |

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for IA, auth pipeline, dashboard anatomy, and XAI workflow.

## Deploy (GCP)

Build static/server output and host on Cloud Run, Firebase App Hosting, or Vercel with env vars matching `.env.example`.
