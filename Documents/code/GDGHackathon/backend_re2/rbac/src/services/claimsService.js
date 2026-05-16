import { getAuth } from "firebase-admin/auth";
import { HttpsError } from "firebase-functions/v2/https";
import { buildCustomClaimsFromUser } from "../auth/claims.js";
import { getUserProfile } from "../db.js";

export async function syncClaimsForUid(uid) {
  const profile = await getUserProfile(uid);
  if (!profile) {
    throw new HttpsError(
      "failed-precondition",
      `No RBAC user profile found for uid ${uid}.`,
    );
  }

  const claims = buildCustomClaimsFromUser(profile);
  await getAuth().setCustomUserClaims(uid, claims);
  return claims;
}
