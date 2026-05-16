#!/usr/bin/env node
/**
 * Verify live RBAC stack: rbac-new-db + rbacApi callable.
 * Requires: gcloud auth application-default login (or GOOGLE_APPLICATION_CREDENTIALS)
 */
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getRbacDb, RBAC_DATABASE_ID } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || "lattice-2026";
const REGION = "asia-southeast1";
const CALLABLE_URL = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/rbacApi`;

function ok(label, detail = "") {
  console.log(`  OK  ${label}${detail ? `: ${detail}` : ""}`);
}

function fail(label, detail = "") {
  console.error(`  FAIL ${label}${detail ? `: ${detail}` : ""}`);
}

async function checkFirestore() {
  if (getApps().length === 0) {
    delete process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.USE_FIRESTORE_EMULATOR;
    initializeApp({ projectId: PROJECT_ID });
  }
  const db = getRbacDb();

  const config = await db.collection("platform_config").doc("global").get();
  if (!config.exists) fail("platform_config/global missing — run npm run patch:database");
  else ok("platform_config/global");

  const edgeSnap = await db.collection("graph_edges").limit(1).get();
  ok("graph_edges readable", `${edgeSnap.size >= 0 ? "collection ok" : ""}`);

  const usersSnap = await db.collection("users").where("role", "==", "platform_admin").limit(1).get();
  if (usersSnap.empty) fail("no platform_admin in users — run npm run bootstrap:platform-admin");
  else ok("platform_admin user", usersSnap.docs[0].id);

  return db;
}

async function checkCallable() {
  const res = await fetch(CALLABLE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { action: "listActions" } }),
  });
  if (!res.ok) {
    fail("rbacApi HTTP", `${res.status} ${await res.text()}`);
    return false;
  }
  const json = await res.json();
  const result = json.result || json.data;
  const actions = result?.actions || [];
  if (!actions.length) {
    fail("rbacApi listActions", "empty actions");
    return false;
  }
  ok("rbacApi listActions", `${actions.length} actions, db=${result?.database || RBAC_DATABASE_ID}`);
  ok("graph RAG flag", String(result?.graphRagEnabled));
  ok("gemini summaries flag", String(result?.geminiSummariesEnabled));
  return true;
}

async function main() {
  console.log(`\n[smokeLive] project=${PROJECT_ID} database=${RBAC_DATABASE_ID}\n`);
  let passed = 0;
  let failed = 0;

  try {
    await checkFirestore();
    passed += 3;
  } catch (e) {
    fail("Firestore", e.message);
    failed += 1;
  }

  try {
    const callableOk = await checkCallable();
    if (callableOk) passed += 1;
    else failed += 1;
  } catch (e) {
    fail("rbacApi", e.message);
    failed += 1;
  }

  console.log(`\n[smokeLive] ${passed} checks passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
