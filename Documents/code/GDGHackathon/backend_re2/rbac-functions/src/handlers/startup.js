import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireRole } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { getRbacDb } from "../db.js";
import { syncClaimsForUid } from "../services/claimsService.js";
import { writeAuditLog } from "../services/auditService.js";
import { upsertRecommendation } from "../services/recommendationService.js";
import { upsertGraphEdge } from "../ai/graphService.js";
import { loadPlatformConfig, scoreStartupProgrammeFit } from "../ai/latticeGraph.js";
import { summariseStartupWithGemini } from "../ai/geminiText.js";
import { newId } from "../utils/ids.js";
import { cleanString, cleanStringList, parseData, requireField } from "../utils/parse.js";

function requireStartupOwner(request, startupId) {
  const ctx = requireRole(request, [ROLES.STARTUP, ROLES.PLATFORM_ADMIN]);
  if (ctx.role === ROLES.PLATFORM_ADMIN) return ctx;
  if (ctx.claims.entityId !== startupId) {
    throw new HttpsError("permission-denied", "You can only access your own startup profile.");
  }
  return ctx;
}

export async function registerStartupProfileHandler(request) {
  const { uid } = requireAuth(request);
  const data = parseData(request);

  const name = requireField(data, "name");
  const sector = requireField(data, "sector");
  const stage = cleanString(data.stage, "Seed");
  const country = requireField(data, "country");
  const startupId = cleanString(data.startupId) || newId("startup");

  const db = getRbacDb();
  const existingUser = await db.collection("users").doc(uid).get();
  if (existingUser.exists && existingUser.data().role !== ROLES.STARTUP) {
    throw new HttpsError("failed-precondition", "This account already has a non-startup role.");
  }

  let email = cleanString(data.email);
  try {
    const authUser = await getAuth().getUser(uid);
    email = email || authUser.email || "";
  } catch {
    /* emulator */
  }

  const startupPayload = {
    id: startupId,
    authUid: uid,
    orgId: cleanString(data.orgId) || null,
    name,
    sector,
    industry: sector,
    stage,
    country,
    teamSize: Number(data.teamSize) || 1,
    problemStatement: cleanString(data.problemStatement),
    productDescription: cleanString(data.productDescription),
    supportNeeds: cleanStringList(data.supportNeeds),
    verificationStatus: "Pending",
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
  };

  const startupRef = db.collection("startups").doc(startupId);
  if (!(await startupRef.get()).exists) {
    startupPayload.createdAt = FieldValue.serverTimestamp();
  }
  await startupRef.set(startupPayload, { merge: true });

  await db.collection("users").doc(uid).set(
    {
      id: uid,
      email,
      displayName: name,
      role: ROLES.STARTUP,
      orgId: startupPayload.orgId,
      programmeId: null,
      entityType: "startup",
      entityId: startupId,
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const claims = await syncClaimsForUid(uid);

  await writeAuditLog({
    actorUid: uid,
    actorRole: ROLES.STARTUP,
    action: "startup.register",
    targetType: "startup",
    targetId: startupId,
  });

  return { startup: startupPayload, claims };
}

export async function updateStartupProfileHandler(request) {
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  const ctx = requireStartupOwner(request, startupId);

  const db = getRbacDb();
  const ref = db.collection("startups").doc(startupId);
  if (!(await ref.get()).exists) {
    throw new HttpsError("not-found", "Startup not found.");
  }

  const updates = {
    updatedAt: FieldValue.serverTimestamp(),
  };
  for (const key of [
    "name",
    "sector",
    "stage",
    "country",
    "problemStatement",
    "productDescription",
    "traction",
  ]) {
    if (data[key] != null) updates[key] = data[key];
  }
  if (data.supportNeeds) updates.supportNeeds = cleanStringList(data.supportNeeds);
  if (data.teamSize != null) updates.teamSize = Number(data.teamSize);

  await ref.set(updates, { merge: true });
  return { startupId, updated: Object.keys(updates) };
}

export async function applyToProgrammeHandler(request) {
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  const programmeId = requireField(data, "programmeId");
  const ctx = requireStartupOwner(request, startupId);

  const db = getRbacDb();
  const startupSnap = await db.collection("startups").doc(startupId).get();
  const programmeSnap = await db.collection("programmes").doc(programmeId).get();
  if (!startupSnap.exists) throw new HttpsError("not-found", "Startup not found.");
  if (!programmeSnap.exists) throw new HttpsError("not-found", "Programme not found.");

  const startup = { id: startupSnap.id, ...startupSnap.data() };
  const programme = { id: programmeSnap.id, ...programmeSnap.data() };
  const platformConfig = await loadPlatformConfig(db);
  const fit = await scoreStartupProgrammeFit(db, startup, programme, platformConfig);

  const applicationId = newId("app");
  await db.collection("applications").doc(applicationId).set({
    id: applicationId,
    startupId,
    programmeId,
    orgId: programme.orgId,
    status: "Pending Admin Review",
    aiFitScore: fit.matchScore,
    aiExplanation: fit.explanation,
    scoreBreakdown: fit.scoreBreakdown,
    graphEvidence: fit.graphEvidence,
    riskFlags: fit.riskFlags,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    submittedByUid: ctx.uid,
  });

  await upsertGraphEdge(db, {
    sourceType: "startup",
    sourceId: startupId,
    edgeType: "APPLIED_TO",
    targetType: "programme",
    targetId: programmeId,
    programmeId,
    createdFrom: "applyToProgramme",
    createdFromId: applicationId,
    metadata: { score: fit.matchScore },
  });

  const recommendation = await upsertRecommendation(db, {
    recommendationType: "Startup-to-Programme",
    sourceEntityType: "startup",
    sourceEntityId: startupId,
    targetEntityType: "programme",
    targetEntityId: programmeId,
    programmeId,
    orgId: programme.orgId,
    matchScore: fit.matchScore,
    explanation: fit.explanation,
    riskFlags: fit.riskFlags,
    scoreBreakdown: fit.scoreBreakdown,
    graphEvidence: fit.graphEvidence,
    status: "Pending Approval",
  });

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "startup.apply_programme",
    targetType: "application",
    targetId: applicationId,
    programmeId,
    metadata: { matchScore: fit.matchScore },
  });

  return {
    applicationId,
    recommendationId: recommendation.id,
    fit,
  };
}

export async function runAiMatchPreviewHandler(request) {
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  const programmeId = requireField(data, "programmeId");
  requireStartupOwner(request, startupId);

  const db = getRbacDb();
  const startupSnap = await db.collection("startups").doc(startupId).get();
  const programmeSnap = await db.collection("programmes").doc(programmeId).get();
  if (!startupSnap.exists || !programmeSnap.exists) {
    throw new HttpsError("not-found", "Startup or programme not found.");
  }

  const platformConfig = await loadPlatformConfig(db);
  const fit = await scoreStartupProgrammeFit(
    db,
    { id: startupSnap.id, ...startupSnap.data() },
    { id: programmeSnap.id, ...programmeSnap.data() },
    platformConfig,
  );

  return { startupId, programmeId, fit, engine: "lattice-graph-v1-stub" };
}

const MAX_PROGRAMME_RECOMMENDATIONS = 5;

export async function recommendProgrammesForStartupHandler(request) {
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  requireStartupOwner(request, startupId);

  const db = getRbacDb();
  const startupSnap = await db.collection("startups").doc(startupId).get();
  if (!startupSnap.exists) throw new HttpsError("not-found", "Startup not found.");

  const startup = { id: startupSnap.id, ...startupSnap.data() };
  const platformConfig = await loadPlatformConfig(db);
  const programmesSnap = await db
    .collection("programmes")
    .where("status", "in", ["Open", "Active"])
    .limit(40)
    .get();

  const candidates = [];
  for (const progDoc of programmesSnap.docs) {
    const programme = { id: progDoc.id, ...progDoc.data() };
    const fit = await scoreStartupProgrammeFit(db, startup, programme, platformConfig);
    if (!fit.passesThreshold) continue;
    candidates.push({ programme, programmeId: programme.id, fit });
  }

  candidates.sort((a, b) => b.fit.matchScore - a.fit.matchScore);
  const top = candidates.slice(0, MAX_PROGRAMME_RECOMMENDATIONS);

  const recommendations = [];
  for (const item of top) {
    const recommendation = await upsertRecommendation(db, {
      recommendationType: "Startup-to-Programme",
      sourceEntityType: "startup",
      sourceEntityId: startupId,
      targetEntityType: "programme",
      targetEntityId: item.programmeId,
      programmeId: item.programmeId,
      orgId: item.programme.orgId,
      matchScore: item.fit.matchScore,
      explanation: item.fit.explanation,
      riskFlags: item.fit.riskFlags,
      scoreBreakdown: item.fit.scoreBreakdown,
      graphEvidence: item.fit.graphEvidence,
      status: "Pending Approval",
    });
    recommendations.push(recommendation);
  }

  return { startupId, recommendations, candidatesScored: candidates.length };
}

export async function summariseStartupProfileHandler(request) {
  const data = parseData(request);
  const startupId = requireField(data, "startupId");
  requireStartupOwner(request, startupId);

  const db = getRbacDb();
  const snap = await db.collection("startups").doc(startupId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Startup not found.");

  const startup = { id: snap.id, ...snap.data() };
  const { profile, engine, geminiError } = await summariseStartupWithGemini(startup);

  return {
    startupId,
    profile,
    engine,
    ...(geminiError ? { geminiError } : {}),
  };
}
