#!/usr/bin/env node
console.log(`
Gemini text + embeddings for RBAC (rbac-isolated)

1. Create an API key: https://aistudio.google.com/apikey

2. Enable Secret Manager (one-time): https://console.cloud.google.com/apis/library/secretmanager.googleapis.com?project=lattice-2026

3. Store key (pick one):
   A) Firebase secret:
      cd backend_re2
      npx firebase functions:secrets:set GEMINI_API_KEY
      Then add secrets: [defineSecret('GEMINI_API_KEY')] to rbacApi in index.js and redeploy.

   B) Cloud Run env (no code change):
      Google Cloud Console → Cloud Run → rbacapi → Edit → Variables → GEMINI_API_KEY

4. firebase.json already sets:
   USE_GEMINI_SUMMARIES=true
   USE_GEMINI_EMBEDDINGS=false  (enable separately to save cost)
   GEMINI_TEXT_MODEL=gemini-1.5-flash

4. Redeploy:
   cd rbac && npm run deploy:live

5. Verify:
   rbacApi({ action: "listActions" }) → geminiSummariesEnabled: true

Local dev: add to rbac/.env
   GEMINI_API_KEY=...
   USE_GEMINI_SUMMARIES=true
`);
