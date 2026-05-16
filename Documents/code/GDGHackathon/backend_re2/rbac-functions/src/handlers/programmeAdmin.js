import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { requireProgrammeAdmin, requireRole } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { getRbacDb } from "../db.js";
import { writeAuditLog } from "../services/auditService.js";
import { upsertRecommendation } from "../services/recommendationService.js";
import { upsertGraphEdge } from "../ai/graphService.js";
import { scoreStartupMentorFit } from "../ai/latticeGraph.js";
import { newId } from "../utils/ids.js";
import { cleanString, parseData, requireField } from "../utils/parse.js";

const VALID_APP_DECISIONS = new Set(["Accepted", "Rejected"]);
const VALID_REL_DECISIONS = new Set(["Approved", "Rejected"]);
const VALID_REL_STATUSES = new Set([
  "Approved",
  "Active",
  "Needs Review",
  "Completed",
  "Rejected",
  "Expired",
]);

async function loadProgramme(db, programmeId) {
  const snap = await db.collection("programmes").doc(programmeId).get();
  if (!snap.exists) throw new HttpsError("not-found", `Programme ${programmeId} not found.`);
  return { id: snap.id, ...snap.data() };
}

async function assertProgrammeScope(ctx, programmeId, db = null) {
  if (ctx.role === ROLES.PLATFORM_ADMIN) return;
  if (ctx.role === ROLES.PROGRAMME_ADMIN && ctx.claims.programmeId === programmeId) return;
  if (ctx.role === ROLES.ORG_ADMIN && db) {
    const programme = await loadProgramme(db, programmeId);
    if (programme.orgId === ctx.claims.orgId) return;
  }
  throw new HttpsError(
    "permission-denied",
    "Programme admin scope does not match target programme.",
  );
}

export async function manageProgrammePoolHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const contributorId = requireField(data, "contributorId");
  const contributorType = cleanString(data.contributorType, "Mentor");
  const action = cleanString(data.action, "add");

  const ctx = requireProgrammeAdmin(request, programmeId);
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const programme = await loadProgramme(db, programmeId);
  const contributorSnap = await db.collection("contributors").doc(contributorId).get();
  if (!contributorSnap.exists) {
    throw new HttpsError("not-found", `Contributor ${contributorId} not found.`);
  }

  const poolId = `pc-${programmeId}-${contributorId}`;
  const poolRef = db.collection("programmeContributors").doc(poolId);

  if (action === "remove") {
    await poolRef.set(
      { status: "Rejected", updatedAt: FieldValue.serverTimestamp(), removedByUid: ctx.uid },
      { merge: true },
    );
  } else {
    await poolRef.set(
      {
        id: poolId,
        programmeId,
        orgId: programme.orgId,
        contributorId,
        contributorType,
        status: cleanString(data.status, "Approved"),
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await upsertGraphEdge(db, {
      sourceType: "contributor",
      sourceId: contributorId,
      edgeType: "ATTACHED_TO",
      targetType: "programme",
      targetId: programmeId,
      programmeId,
      createdFrom: "manageProgrammePool",
      metadata: { contributorType },
    });
  }

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: `programme.pool.${action}`,
    targetType: "programmeContributors",
    targetId: poolId,
    orgId: programme.orgId,
    programmeId,
  });

  return { poolId, programmeId, contributorId, action };
}

/** Convenience wrapper: add mentor directly to programme pool (Approved). */
export async function addMentorToProgrammeHandler(request) {
  const data = parseData(request);
  return manageProgrammePoolHandler({
    ...request,
    data: {
      ...data,
      action: "add",
      contributorType: cleanString(data.contributorType, "Mentor"),
      status: cleanString(data.status, "Approved"),
    },
  });
}

/** Convenience wrapper: remove mentor from programme pool. */
export async function removeMentorFromProgrammeHandler(request) {
  const data = parseData(request);
  return manageProgrammePoolHandler({
    ...request,
    data: { ...data, action: "remove", contributorType: cleanString(data.contributorType, "Mentor") },
  });
}

/** Invite contributor/mentor — Pending until they call acceptProgrammeAssignment. */
export async function inviteContributorToProgrammeHandler(request) {
  const data = parseData(request);
  return manageProgrammePoolHandler({
    ...request,
    data: {
      ...data,
      action: "add",
      contributorType: cleanString(data.contributorType, "Mentor"),
      status: "Pending",
    },
  });
}

export async function reviewApplicationHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const applicationId = requireField(data, "applicationId");
  const decision = requireField(data, "decision");

  if (!VALID_APP_DECISIONS.has(decision)) {
    throw new HttpsError("invalid-argument", "decision must be Accepted or Rejected.");
  }

  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.PROGRAMME_ADMIN, ROLES.ORG_ADMIN]);
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const appRef = db.collection("applications").doc(applicationId);
  const appSnap = await appRef.get();
  if (!appSnap.exists) throw new HttpsError("not-found", "Application not found.");

  const application = appSnap.data();
  if (application.programmeId !== programmeId) {
    throw new HttpsError("permission-denied", "Application is outside programme scope.");
  }

  await appRef.set(
    {
      status: decision,
      reviewedByUid: ctx.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  if (decision === "Accepted") {
    await upsertGraphEdge(db, {
      sourceType: "startup",
      sourceId: application.startupId,
      edgeType: "ACCEPTED_INTO",
      targetType: "programme",
      targetId: programmeId,
      programmeId,
      createdFrom: "reviewApplication",
      createdFromId: applicationId,
    });
  }

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "application.review",
    targetType: "application",
    targetId: applicationId,
    programmeId,
    metadata: { decision },
  });

  return { applicationId, programmeId, status: decision };
}

export async function reviewMentorRelationshipHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const recommendationId = requireField(data, "recommendationId");
  const decision = requireField(data, "decision");

  if (!VALID_REL_DECISIONS.has(decision)) {
    throw new HttpsError("invalid-argument", "decision must be Approved or Rejected.");
  }

  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.PROGRAMME_ADMIN, ROLES.ORG_ADMIN]);
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const recRef = db.collection("recommendations").doc(recommendationId);
  const recSnap = await recRef.get();
  if (!recSnap.exists) throw new HttpsError("not-found", "Recommendation not found.");

  const rec = recSnap.data();
  if (rec.programmeId !== programmeId || rec.recommendationType !== "Startup-to-Mentor") {
    throw new HttpsError("permission-denied", "Recommendation is outside programme scope.");
  }

  await recRef.set(
    { status: decision === "Approved" ? "Approved" : "Rejected", updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  let relationshipId = null;
  if (decision === "Approved") {
    relationshipId = `rel-${rec.sourceEntityId}-${rec.targetEntityId}-${programmeId}`;
    await db.collection("relationships").doc(relationshipId).set(
      {
        id: relationshipId,
        relationshipType: "Startup-to-Mentor",
        sourceEntityId: rec.sourceEntityId,
        targetEntityId: rec.targetEntityId,
        programmeId,
        orgId: rec.orgId || null,
        createdFromRecommendationId: recommendationId,
        matchScore: rec.matchScore,
        status: "Approved",
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await upsertGraphEdge(db, {
      sourceType: "startup",
      sourceId: rec.sourceEntityId,
      edgeType: "MATCHED_WITH",
      targetType: "contributor",
      targetId: rec.targetEntityId,
      programmeId,
      createdFrom: "reviewMentorRelationship",
      createdFromId: recommendationId,
    });
  }

  return { recommendationId, relationshipId, decision, programmeId };
}

const VALID_REC_DECISIONS = new Set(["Approved", "Rejected"]);

export async function reviewRecommendationHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const recommendationId = requireField(data, "recommendationId");
  const decision = requireField(data, "decision");

  if (!VALID_REC_DECISIONS.has(decision)) {
    throw new HttpsError("invalid-argument", "decision must be Approved or Rejected.");
  }

  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.PROGRAMME_ADMIN, ROLES.ORG_ADMIN]);
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const recRef = db.collection("recommendations").doc(recommendationId);
  const recSnap = await recRef.get();
  if (!recSnap.exists) throw new HttpsError("not-found", "Recommendation not found.");

  const rec = recSnap.data();
  if (rec.programmeId && rec.programmeId !== programmeId) {
    throw new HttpsError("permission-denied", "Recommendation is outside programme scope.");
  }

  await recRef.set(
    { status: decision === "Approved" ? "Approved" : "Rejected", updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  let createdId = null;
  if (decision === "Approved") {
    const recType = rec.recommendationType || "";

    if (recType === "Startup-to-Mentor") {
      return reviewMentorRelationshipHandler({
        ...request,
        data: { programmeId, recommendationId, decision: "Approved" },
      });
    }

    if (recType === "Startup-to-Programme") {
      const apps = await db
        .collection("applications")
        .where("startupId", "==", rec.sourceEntityId)
        .where("programmeId", "==", programmeId)
        .limit(1)
        .get();
      if (!apps.empty) {
        await apps.docs[0].ref.set(
          { status: "Accepted", updatedAt: FieldValue.serverTimestamp(), reviewedByUid: ctx.uid },
          { merge: true },
        );
      }
      await upsertGraphEdge(db, {
        sourceType: "startup",
        sourceId: rec.sourceEntityId,
        edgeType: "ACCEPTED_INTO",
        targetType: "programme",
        targetId: programmeId,
        programmeId,
        createdFrom: "reviewRecommendation",
        createdFromId: recommendationId,
      });
    }

    if (recType.endsWith("-to-Programme")) {
      const contributorId = rec.sourceEntityId;
      const poolId = `pc-${programmeId}-${contributorId}`;
      await db.collection("programmeContributors").doc(poolId).set(
        {
          id: poolId,
          programmeId,
          orgId: rec.orgId,
          contributorId,
          contributorType: recType.replace("-to-Programme", ""),
          status: "Approved",
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await upsertGraphEdge(db, {
        sourceType: "contributor",
        sourceId: contributorId,
        edgeType: "ATTACHED_TO",
        targetType: "programme",
        targetId: programmeId,
        programmeId,
        createdFrom: "reviewRecommendation",
        createdFromId: recommendationId,
      });
      createdId = poolId;
    }
  }

  return { recommendationId, programmeId, decision, createdId };
}

export async function recommendMentorForStartupHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const startupId = requireField(data, "startupId");

  const ctx = requireRole(request, [
    ROLES.PLATFORM_ADMIN,
    ROLES.PROGRAMME_ADMIN,
    ROLES.STARTUP,
  ]);
  if (ctx.role === ROLES.STARTUP && ctx.claims.entityId !== startupId) {
    throw new HttpsError("permission-denied", "You can only request mentors for your own startup.");
  }
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const acceptedSnap = await db
    .collection("applications")
    .where("startupId", "==", startupId)
    .where("programmeId", "==", programmeId)
    .where("status", "==", "Accepted")
    .limit(1)
    .get();

  if (acceptedSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Startup must be accepted into the programme before mentor matching.",
    );
  }

  const startupSnap = await db.collection("startups").doc(startupId).get();
  if (!startupSnap.exists) throw new HttpsError("not-found", "Startup not found.");
  const programme = await loadProgramme(db, programmeId);
  const startup = { id: startupSnap.id, ...startupSnap.data() };

  const poolsSnap = await db
    .collection("programmeContributors")
    .where("programmeId", "==", programmeId)
    .where("status", "==", "Approved")
    .where("contributorType", "==", "Mentor")
    .get();

  const recommendations = [];
  for (const poolDoc of poolsSnap.docs) {
    const mentorSnap = await db.collection("contributors").doc(poolDoc.data().contributorId).get();
    if (!mentorSnap.exists || mentorSnap.data().availability === "Unavailable") continue;

    const mentor = { id: mentorSnap.id, ...mentorSnap.data() };
    const score = await scoreStartupMentorFit(db, startup, mentor, programme);
    if (!score.passesThreshold) continue;

    const recommendation = await upsertRecommendation(db, {
      recommendationType: "Startup-to-Mentor",
      sourceEntityType: "startup",
      sourceEntityId: startupId,
      targetEntityType: "contributor",
      targetEntityId: mentor.id,
      programmeId,
      orgId: programme.orgId,
      matchScore: score.matchScore,
      explanation: score.explanation,
      riskFlags: score.riskFlags,
      scoreBreakdown: score.scoreBreakdown,
      graphEvidence: { summary: "Ranked from approved programme mentor pool." },
      status: "Pending Approval",
    });
    recommendations.push(recommendation);
  }

  recommendations.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
  return { programmeId, startupId, recommendations };
}

export async function updateRelationshipStatusHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const relationshipId = requireField(data, "relationshipId");
  const status = requireField(data, "status");

  if (!VALID_REL_STATUSES.has(status)) {
    throw new HttpsError("invalid-argument", `Invalid status: ${status}`);
  }

  const ctx = requireProgrammeAdmin(request, programmeId);
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const relRef = db.collection("relationships").doc(relationshipId);
  const relSnap = await relRef.get();
  if (!relSnap.exists) throw new HttpsError("not-found", "Relationship not found.");
  if (relSnap.data().programmeId !== programmeId) {
    throw new HttpsError("permission-denied", "Relationship is outside programme scope.");
  }

  await relRef.set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { relationshipId, status, programmeId };
}

export async function requestAlternateMentorHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  const startupId = requireField(data, "startupId");

  const ctx = requireProgrammeAdmin(request, programmeId);
  const db = getRbacDb();
  await assertProgrammeScope(ctx, programmeId, db);
  const startupSnap = await db.collection("startups").doc(startupId).get();
  if (!startupSnap.exists) throw new HttpsError("not-found", "Startup not found.");
  const programme = await loadProgramme(db, programmeId);

  const poolsSnap = await db
    .collection("programmeContributors")
    .where("programmeId", "==", programmeId)
    .where("status", "==", "Approved")
    .where("contributorType", "==", "Mentor")
    .get();

  const startup = { id: startupSnap.id, ...startupSnap.data() };
  let best = null;

  for (const poolDoc of poolsSnap.docs) {
    const mentorSnap = await db.collection("contributors").doc(poolDoc.data().contributorId).get();
    if (!mentorSnap.exists) continue;
    const mentor = { id: mentorSnap.id, ...mentorSnap.data() };
    const score = await scoreStartupMentorFit(db, startup, mentor, programme);
    if (!best || score.matchScore > best.matchScore) {
      best = { mentor, score };
    }
  }

  if (!best) {
    throw new HttpsError("failed-precondition", "No mentors in programme pool.");
  }

  const recommendation = await upsertRecommendation(db, {
    recommendationType: "Startup-to-Mentor",
    sourceEntityType: "startup",
    sourceEntityId: startupId,
    targetEntityType: "contributor",
    targetEntityId: best.mentor.id,
    programmeId,
    orgId: programme.orgId,
    matchScore: best.score.matchScore,
    explanation: best.score.explanation,
    riskFlags: best.score.riskFlags,
    scoreBreakdown: best.score.scoreBreakdown,
    graphEvidence: { summary: "Alternate mentor requested via graph-ranked pool." },
    status: "Pending Approval",
  });

  return { recommendation, programmeId, startupId };
}
