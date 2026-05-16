import { HttpsError } from "firebase-functions/v2/https";
import { requireRole } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { analyzeContributorProfile, analyzeStartupProfile } from "../ai/profileEngine.js";
import { getRbacDb } from "../db.js";
import { parseData, requireField } from "../utils/parse.js";

export async function runStartupAnalysisHandler(request) {
  requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN, ROLES.PROGRAMME_ADMIN]);
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  const db = getRbacDb();
  const snap = await db.collection("startups").doc(startupId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Startup not found.");
  return analyzeStartupProfile(db, startupId, snap.data());
}

export async function runContributorAnalysisHandler(request) {
  requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN]);
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  const db = getRbacDb();
  const snap = await db.collection("contributors").doc(contributorId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Contributor not found.");
  return analyzeContributorProfile(db, contributorId, snap.data());
}
