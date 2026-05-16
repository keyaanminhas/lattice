import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { getAuth } from "firebase-admin/auth";
import {
  configureEmulatorEnv,
  initEmulatorApps,
  mockCallable,
  ensureAuthUser,
  seedUserDoc,
  isEmulatorReachable,
} from "../helpers/emulator.js";
import { registerStartupProfileHandler, applyToProgrammeHandler } from "../../src/handlers/startup.js";
import {
  manageProgrammePoolHandler,
  reviewApplicationHandler,
  requestAlternateMentorHandler,
} from "../../src/handlers/programmeAdmin.js";
import { scoreStartupProgrammeFit, loadPlatformConfig } from "../../src/ai/latticeGraph.js";

const emulatorUp = await isEmulatorReachable();

test("Phase 4 integration + AI scoring", { skip: !emulatorUp }, async (t) => {
  configureEmulatorEnv();
  const { auth, db } = await initEmulatorApps();

  const suffix = Date.now();
  const orgId = `org-p4-${suffix}`;
  const programmeId = `prog-p4-${suffix}`;
  const mentorId = `mentor-p4-${suffix}`;
  const startupUid = `startup-p4-${suffix}`;
  const progAdminUid = `progadmin-p4-${suffix}`;

  await db.collection("organisations").doc(orgId).set({ id: orgId, name: "P4 Org", country: "SG" });
  await db.collection("programmes").doc(programmeId).set({
    id: programmeId,
    orgId,
    name: "P4 Accelerator",
    type: "Accelerator",
    country: "SG",
    targetSectors: ["HealthTech"],
    targetStages: ["Seed"],
    expectedOutcomes: ["Funding"],
    status: "Open",
  });
  await db.collection("platform_config").doc("global").set({
    aiThresholds: { startupProgrammeMinScore: 50, mentorMatchMinScore: 50 },
  });
  await db.collection("contributors").doc(mentorId).set({
    id: mentorId,
    orgId,
    name: "P4 Mentor",
    contributorTypes: ["Mentor"],
    expertise: ["HealthTech", "Regulatory"],
    availability: "Available",
    status: "Verified",
  });

  await ensureAuthUser(auth, { uid: startupUid, email: `startup-p4-${suffix}@test.local` });
  await ensureAuthUser(auth, { uid: progAdminUid, email: `progadmin-p4-${suffix}@test.local` });
  await seedUserDoc(db, progAdminUid, {
    role: "programme_admin",
    programmeId,
    orgId,
    entityType: "programme",
    entityId: programmeId,
  });

  let startupId;
  let applicationId;

  await t.test("startup registers and applies with AI fit score", async () => {
    const reg = await registerStartupProfileHandler(
      mockCallable(startupUid, { role: "startup" }, {
        name: "P4 HealthCo",
        sector: "HealthTech",
        stage: "Seed",
        country: "SG",
        supportNeeds: ["Regulatory", "HealthTech"],
        problemStatement: "Clinical workflow",
        productDescription: "AI triage",
      }),
    );
    startupId = reg.startup.id;

    const authUser = await getAuth().getUser(startupUid);
    assert.equal(authUser.customClaims.role, "startup");
    assert.equal(authUser.customClaims.entityId, startupId);

    const apply = await applyToProgrammeHandler(
      mockCallable(startupUid, { role: "startup", entityId: startupId }, {
        startupId,
        programmeId,
      }),
    );
    applicationId = apply.applicationId;
    assert.ok(apply.fit.matchScore > 0);
    assert.ok(apply.fit.scoreBreakdown.semanticScore >= 0);
    assert.ok(apply.fit.graphEvidence.edges);

    const appSnap = await db.collection("applications").doc(applicationId).get();
    assert.equal(appSnap.data().status, "Pending Admin Review");
    assert.ok(appSnap.data().aiFitScore > 0);

    const edges = await db
      .collection("graph_edges")
      .where("programmeId", "==", programmeId)
      .where("edgeType", "==", "APPLIED_TO")
      .get();
    assert.ok(edges.size >= 1);
  });

  await t.test("programme admin manages pool and accepts application", async () => {
    await manageProgrammePoolHandler(
      mockCallable(progAdminUid, { role: "programme_admin", programmeId, orgId }, {
        programmeId,
        contributorId: mentorId,
        contributorType: "Mentor",
        action: "add",
      }),
    );

    const review = await reviewApplicationHandler(
      mockCallable(progAdminUid, { role: "programme_admin", programmeId }, {
        programmeId,
        applicationId,
        decision: "Accepted",
      }),
    );
    assert.equal(review.status, "Accepted");

    const acceptedEdges = await db
      .collection("graph_edges")
      .where("programmeId", "==", programmeId)
      .where("edgeType", "==", "ACCEPTED_INTO")
      .get();
    assert.ok(acceptedEdges.size >= 1);
  });

  await t.test("programme admin requests alternate mentor via graph ranking", async () => {
    const alt = await requestAlternateMentorHandler(
      mockCallable(progAdminUid, { role: "programme_admin", programmeId }, {
        programmeId,
        startupId,
      }),
    );
    assert.equal(alt.recommendation.recommendationType, "Startup-to-Mentor");
    assert.ok(alt.recommendation.matchScore > 0);
  });

  await t.test("programme admin cannot review application for other programme", async () => {
    await assert.rejects(
      () =>
        reviewApplicationHandler(
          mockCallable(progAdminUid, { role: "programme_admin", programmeId: "other-prog" }, {
            programmeId: "other-prog",
            applicationId,
            decision: "Accepted",
          }),
        ),
      (err) => err instanceof HttpsError && err.code === "permission-denied",
    );
  });

  await t.test("lattice graph scores health startup higher for health programme", async () => {
    const startup = {
      id: "s-health",
      name: "HealthCo",
      sector: "HealthTech",
      stage: "Seed",
      country: "SG",
      supportNeeds: ["Regulatory"],
    };
    const programme = {
      id: "p-health",
      name: "Health Acc",
      targetSectors: ["HealthTech"],
      targetStages: ["Seed"],
      country: "SG",
    };
    const platformConfig = await loadPlatformConfig(db);
    const fit = await scoreStartupProgrammeFit(db, startup, programme, platformConfig);
    assert.ok(fit.matchScore >= 40);
    assert.ok(fit.scoreBreakdown.semanticScore > 0);
  });
});
