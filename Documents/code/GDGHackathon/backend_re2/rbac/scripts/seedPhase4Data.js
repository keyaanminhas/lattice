#!/usr/bin/env node
/**
 * Seeds rbac-new-db with Phase 4 demo fixtures (target DB only).
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps } from "firebase-admin/app";
import { FieldValue } from "firebase-admin/firestore";
import { getRbacDb } from "../src/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function main() {
  const projectId = process.env.GCLOUD_PROJECT || "lattice-2026";
  if (!getApps().length) initializeApp({ projectId });

  const db = getRbacDb();
  const orgId = "org-phase4-demo";
  const programmeId = "prog-phase4-demo";
  const startupId = "startup-phase4-demo";
  const mentorId = "mentor-phase4-demo";
  const startupUid = "phase4-startup-uid";
  const progAdminUid = "phase4-progadmin-uid";

  await db.collection("organisations").doc(orgId).set(
    {
      id: orgId,
      name: "Phase4 Demo Org",
      country: "SG",
      status: "Active",
    },
    { merge: true },
  );

  await db.collection("programmes").doc(programmeId).set(
    {
      id: programmeId,
      orgId,
      name: "Phase4 Health Accelerator",
      type: "Accelerator",
      country: "SG",
      targetSectors: ["HealthTech", "MedTech"],
      targetStages: ["Seed", "Series A"],
      expectedOutcomes: ["Funding", "Clinical pilots"],
      status: "Open",
    },
    { merge: true },
  );

  await db.collection("startups").doc(startupId).set(
    {
      id: startupId,
      authUid: startupUid,
      orgId,
      name: "Phase4 MediScan",
      sector: "HealthTech",
      stage: "Seed",
      country: "SG",
      supportNeeds: ["Regulatory", "Clinical validation"],
      problemStatement: "Faster radiology triage",
      productDescription: "AI-assisted scan prioritisation",
      verificationStatus: "Pending",
    },
    { merge: true },
  );

  await db.collection("contributors").doc(mentorId).set(
    {
      id: mentorId,
      orgId,
      name: "Dr Phase4 Mentor",
      role: "mentor",
      contributorTypes: ["Mentor"],
      expertise: ["Regulatory", "HealthTech", "Clinical validation"],
      supportedStages: ["Seed"],
      availability: "Available",
      status: "Verified",
    },
    { merge: true },
  );

  await db.collection("users").doc(startupUid).set(
    {
      id: startupUid,
      role: "startup",
      entityType: "startup",
      entityId: startupId,
      email: "phase4-startup@lattice.test",
      status: "active",
    },
    { merge: true },
  );

  await db.collection("users").doc(progAdminUid).set(
    {
      id: progAdminUid,
      role: "programme_admin",
      programmeId,
      orgId,
      entityType: "programme",
      entityId: programmeId,
      email: "phase4-progadmin@lattice.test",
      status: "active",
    },
    { merge: true },
  );

  await db.collection("platform_config").doc("global").set(
    {
      id: "global",
      aiThresholds: {
        startupProgrammeMinScore: 60,
        mentorMatchMinScore: 70,
      },
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  console.log("[seedPhase4Data] Seeded:", { orgId, programmeId, startupId, mentorId });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
