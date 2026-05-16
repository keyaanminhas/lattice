#!/usr/bin/env node
/**
 * Patch rbac-new-db with required platform/org config and fix scoped user fields.
 * READ/WRITE target database only — never touches (default).
 */

import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { getRbacDb } from "../src/db.js";
import { normaliseRoleKey } from "../src/transformers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PLATFORM_CONFIG_ID = "global";

async function main() {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "lattice-2026";
  if (!getApps().length) initializeApp({ projectId });

  const db = getRbacDb();
  const stats = {
    usersPatched: 0,
    orgRulesCreated: 0,
    platformConfigCreated: false,
  };

  const [usersSnap, orgsSnap, programmesSnap, assignmentsSnap] = await Promise.all([
    db.collection("users").get(),
    db.collection("organisations").get(),
    db.collection("programmes").get(),
    db.collection("role_assignments").get(),
  ]);

  const programmesById = new Map(
    programmesSnap.docs.map((d) => [d.id, { id: d.id, ...d.data() }]),
  );
  const assignmentsByUid = new Map();
  for (const doc of assignmentsSnap.docs) {
    const data = doc.data();
    const uid = data.uid;
    if (!uid) continue;
    if (!assignmentsByUid.has(uid)) assignmentsByUid.set(uid, []);
    assignmentsByUid.get(uid).push({ id: doc.id, ...data });
  }

  let batch = db.batch();
  let ops = 0;

  const commitIfNeeded = async (force = false) => {
    if (ops === 0) return;
    if (!force && ops < 400) return;
    await batch.commit();
    batch = db.batch();
    ops = 0;
  };

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const role = normaliseRoleKey(data.role);
    const updates = {};
    const userAssignments = assignmentsByUid.get(userDoc.id) || [];

    if (role === "org_admin" && !data.orgId) {
      const orgAssignment = userAssignments.find(
        (a) => normaliseRoleKey(a.role) === "org_admin" && a.scopeType === "organisation",
      );
      updates.orgId =
        orgAssignment?.scopeId ||
        orgAssignment?.orgId ||
        (data.entityType === "organisation" ? data.entityId : null);
    }

    if (role === "programme_admin") {
      if (!data.programmeId) {
        const progAssignment = userAssignments.find(
          (a) =>
            normaliseRoleKey(a.role) === "programme_admin" && a.scopeType === "programme",
        );
        updates.programmeId = progAssignment?.programmeId || progAssignment?.scopeId || null;
      }
      if (!data.orgId && updates.programmeId) {
        const programme = programmesById.get(updates.programmeId || data.programmeId);
        if (programme?.orgId) updates.orgId = programme.orgId;
      }
    }

    if (Object.keys(updates).length) {
      batch.set(
        userDoc.ref,
        {
          ...updates,
          patchedAt: FieldValue.serverTimestamp(),
          patchSource: "patchRbacDatabase-v1",
        },
        { merge: true },
      );
      stats.usersPatched += 1;
      ops += 1;
    }

    await commitIfNeeded();
  }

  for (const orgDoc of orgsSnap.docs) {
    const orgId = orgDoc.id;
    const orgRulesRef = db.collection("org_rules").doc(orgId);
    const existing = await orgRulesRef.get();
    if (existing.exists) continue;

    batch.set(orgRulesRef, {
      id: orgId,
      orgId,
      verificationRequired: true,
      contributorApprovalMode: "manual",
      aiSuggestionsEnabled: true,
      allowedContributorRoles: ["mentor", "partner", "investor", "service_provider"],
      createdAt: FieldValue.serverTimestamp(),
      patchSource: "patchRbacDatabase-v1",
    });
    stats.orgRulesCreated += 1;
    ops += 1;
    await commitIfNeeded();
  }

  const platformRef = db.collection("platform_config").doc(PLATFORM_CONFIG_ID);
  const platformSnap = await platformRef.get();
  if (!platformSnap.exists) {
    batch.set(platformRef, {
      id: PLATFORM_CONFIG_ID,
      globalCategories: [
        "HealthTech",
        "FinTech",
        "Climate",
        "EdTech",
        "DeepTech",
        "AgriTech",
      ],
      aiThresholds: {
        startupProgrammeMinScore: 60,
        contributorProgrammeMinScore: 65,
        mentorMatchMinScore: 70,
        maxRecommendationsPerCall: 5,
      },
      featureFlags: {
        latticeGraphEnabled: true,
        aiInsightsEnabled: true,
      },
      updatedAt: FieldValue.serverTimestamp(),
      patchSource: "patchRbacDatabase-v1",
    });
    stats.platformConfigCreated = true;
    ops += 1;
  }

  await commitIfNeeded(true);

  await db.collection("_migration_meta").doc("patchRbacDatabase-v1").set(
    {
      completedAt: new Date().toISOString(),
      stats,
      database: process.env.TARGET_DATABASE || "rbac-new-db",
    },
    { merge: true },
  );

  console.log("[patchRbacDatabase] Done:", JSON.stringify(stats, null, 2));
}

main().catch((err) => {
  console.error("[patchRbacDatabase] FAILED:", err.message);
  process.exit(1);
});
