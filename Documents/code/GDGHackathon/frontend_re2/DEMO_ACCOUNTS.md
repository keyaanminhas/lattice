# Development login credentials

**Password for every account:** `LatticeDemo2026!`

| Role | Email | Home route |
|------|-------|------------|
| Platform Admin | platform@lattice.dev | /platform |
| Org Admin | orgadmin@lattice.dev | /org/org-sginnovate |
| Programme Admin | progadmin@lattice.dev | /programme/prog-healthtech-catalyst-2026 |
| Startup | startup@lattice.dev | /startup/startup-mediscan-ai |
| Mentor | mentor@lattice.dev | /contributor/cont-priya-menon |
| Partner | partner@lattice.dev | /contributor/cont-dbs-partnerships |
| Investor | investor@lattice.dev | /contributor/cont-vertex-holdings-sea |
| Service Provider | service@lattice.dev | /contributor/cont-rajah-tann-cyber |

## Seed / refresh accounts

```bash
cd backend_re2/rbac
npm run seed:realistic
```

Requires Firebase Admin credentials (`gcloud auth application-default login` or service account).
