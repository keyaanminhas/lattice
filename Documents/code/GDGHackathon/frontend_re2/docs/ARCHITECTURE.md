# Lattice `frontend_re2` — Enterprise IA & Auth Architecture

## 1. Landing page & onboarding strategy

### Hero (public `/`)
- **Left column:** Formal value proposition — Graph RAG, embeddings, nine entity roles. Metric strip (9 roles · RAG · XAI).
- **Right column:** `LatticeGraphHero` — animated SVG graph (Programme, Startup, Mentor, Outcome nodes; `APPLIED_TO`, `ATTACHED_TO`, `MATCHED_WITH` edges). Communicates the engine without decorative glassmorphism.
- **CTA:** Primary → `/signup` (progressive profiling); secondary → `/login` (admin gateway).

### Progressive signup (`/signup`)
1. **Semantic intake:** User enters bio; `classifySignupBio()` scores keyword/embedding-style signals → suggested role (Startup, Mentor, Investor, …).
2. **Human confirm:** User overrides role in dense select; captures name + email.
3. **Provision:** Redirect to login; backend `rbacApi` registers profile (`registerStartupProfile` / `registerContributorProfile`) after Auth user exists.

Production upgrade: server-side classify via Gemini or dedicated `rbacApi` action using text embeddings.

---

## 2. Auth & routing code strategy

### Pipeline (decoupled)
```
Firebase Auth (identity)
  → ID token custom claims { role, orgId, programmeId, entityId }
  → rbacApi.syncAuthClaims (optional refresh from rbac-new-db/users)
  → AuthGuard (client interstitial)
  → Role-isolated route prefix
```

### Next.js middleware (`src/middleware.ts`)
- Coarse cookie gate `lattice_session` (set on auth state change).
- Public: `/`, `/login`, `/signup`, `/auth/pending`.
- Fine-grained role checks in `AuthGuard` (requires Firebase token claims).

### Pseudo-code: role resolution
```ts
// After signIn
const token = await user.getIdTokenResult(true);
const claims = {
  role: token.claims.role,
  orgId: token.claims.orgId,
  programmeId: token.claims.programmeId,
  entityId: token.claims.entityId,
};
await callRbacApi("syncAuthClaims");
const home = resolveHomePath(claims);
router.replace(home);
```

### Route map (`src/lib/auth/routing.ts`)
| Role | Home prefix |
|------|-------------|
| platform_admin | `/platform` |
| org_admin | `/org/{orgId}` |
| programme_admin | `/programme/{programmeId}` |
| startup | `/startup/{entityId}` |
| mentor / partner / investor / service_provider | `/contributor/{entityId}` |

`pathMatchesRole()` blocks cross-tenant navigation (e.g. org admin cannot mount `/startup/*`).

---

## 3. Organisation admin dashboard anatomy

`AppShell` (`src/components/layout/AppShell.tsx`):

| Zone | Purpose |
|------|---------|
| **Sidebar (224px)** | Logo, role badge, nav with count badges, sign out |
| **Topbar (56px)** | Page title, subtitle, toggle for contextual side-sheet |
| **Main (flex)** | Dense data grid / kanban — AI-pre-sorted queues |
| **Side-sheet (420px)** | XAI match review without route change |

Org overview (`/org/[orgId]`): applications + match review table; links to programme XAI flow.

---

## 4. Explainable AI workflow — Mentor recommendation

**Backend:** `recommendMentorForStartup` → `reviewMentorRelationship` on `rbacApi`.

**UI steps (`/programme/[id]/matches`):**
1. Kanban lists pending `Startup-to-Mentor` recommendations (score visible).
2. Admin selects row → **side-sheet opens** (`MatchReviewPanel`).
3. Panel shows:
   - Total score + decomposition bars (semantic / rule / graph)
   - Graph RAG edge list (`APPLIED_TO`, `ATTACHED_TO`, …)
   - Risk flags + narrative explanation
4. **Approve** → `reviewMentorRelationship` creates relationship + graph edge; no page navigation.

---

## Run locally

```bash
cd frontend_re2
cp .env.example .env.local   # Firebase web config
npm install
npm run dev
```

Connect to `rbacApi` in `asia-southeast1` with authenticated Firebase user (custom claims required).
