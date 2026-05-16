/**
 * ISOLATED RBAC FUNCTIONS (clone of live Python `functions/` — do not modify Python).
 * Deploy only this codebase; live team keeps using `functions` + `(default)` DB.
 *
 * Credit-saving: ONE callable `rbacApi` routes all actions (single Cloud Run service).
 * Set USE_GRAPH_RAG=true only when you need full graph reads (slow / quota heavy).
 */
import { initializeApp, getApps } from "firebase-admin/app";
import { onCall } from "firebase-functions/v2/https";
import { beforeUserSignedIn } from "firebase-functions/v2/identity";
import { buildCustomClaimsFromUser } from "./src/auth/claims.js";
import { getUserProfile } from "./src/db.js";
import { dispatchRbacAction } from "./src/api/router.js";
export {
  onStartupProfileWritten,
  onContributorProfileWritten,
} from "./src/triggers/firestoreTriggers.js";

if (!getApps().length) {
  initializeApp();
}

const REGION = "asia-southeast1";
/**
 * Gemini: set GEMINI_API_KEY on the rbacApi Cloud Run service (Console → Functions → rbacApi → Environment),
 * or enable Secret Manager and use defineSecret + secrets: [geminiApiKey] after:
 *   firebase functions:secrets:set GEMINI_API_KEY
 */

export const rbacBeforeUserSignedIn = beforeUserSignedIn(
  { region: REGION },
  async (event) => {
  const uid = event.data?.uid;
  if (!uid) return;
  try {
    const profile = await getUserProfile(uid);
    if (!profile) return;
    const claims = buildCustomClaimsFromUser(profile);
    return { sessionClaims: claims, customClaims: claims };
  } catch {
    return;
  }
  },
);

export const rbacApi = onCall(
  { enforceAppCheck: false, region: REGION },
  async (request) => {
    return dispatchRbacAction(request);
  },
);

