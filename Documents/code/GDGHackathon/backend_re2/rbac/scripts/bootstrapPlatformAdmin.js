#!/usr/bin/env node
/**
 * Bootstrap a platform_admin in Firebase Auth + rbac-new-db/users.
 *
 * Usage:
 *   node scripts/bootstrapPlatformAdmin.js --email admin@lattice.dev --password "YourSecurePass1!"
 *   node scripts/bootstrapPlatformAdmin.js --uid existing-uid --email admin@lattice.dev
 *
 * Emulator:
 *   set USE_FIRESTORE_EMULATOR=true
 *   set FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
 */

import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildCustomClaimsFromUser } from "../src/auth/claims.js";
import { getRbacDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = true;
      }
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const email = String(args.email || "").trim();
  const password = String(args.password || "").trim();
  const displayName = String(args.displayName || "Platform Admin").trim();
  let uid = String(args.uid || "").trim();

  if (!email) {
    throw new Error("--email is required");
  }

  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "lattice-2026";

  if (!getApps().length) {
    initializeApp({ projectId });
  }

  const auth = getAuth();
  const db = getRbacDb();

  if (!uid) {
    try {
      const existing = await auth.getUserByEmail(email);
      uid = existing.uid;
      console.log(`[bootstrap] Found existing Auth user: ${uid}`);
    } catch {
      if (!password) {
        throw new Error("--password is required when creating a new Auth user");
      }
      const created = await auth.createUser({ email, password, displayName });
      uid = created.uid;
      console.log(`[bootstrap] Created Auth user: ${uid}`);
    }
  } else {
    await auth.updateUser(uid, { email, displayName, disabled: false });
  }

  const userDoc = {
    id: uid,
    email,
    displayName,
    role: "platform_admin",
    orgId: null,
    programmeId: null,
    entityType: null,
    entityId: null,
    status: "active",
    bootstrapSource: "bootstrapPlatformAdmin",
    updatedAt: new Date().toISOString(),
  };

  const userRef = db.collection("users").doc(uid);
  const existing = await userRef.get();
  if (!existing.exists) {
    userDoc.createdAt = new Date().toISOString();
  }

  await userRef.set(userDoc, { merge: true });
  console.log(`[bootstrap] Upserted rbac-new-db/users/${uid}`);

  const claims = buildCustomClaimsFromUser(userDoc);
  await auth.setCustomUserClaims(uid, claims);
  console.log("[bootstrap] Custom claims set:", JSON.stringify(claims));

  console.log("\nDone. User must sign out and sign in (or call syncAuthClaims) to refresh ID token.");
}

main().catch((err) => {
  console.error("[bootstrap] FAILED:", err.message);
  process.exit(1);
});
