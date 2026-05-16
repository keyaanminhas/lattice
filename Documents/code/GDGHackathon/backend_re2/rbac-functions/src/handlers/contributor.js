import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireOrgAdmin, requireRole } from "../auth/middleware.js";
import { ROLES, CONTRIBUTOR_ROLES } from "../auth/roles.js";
import { getRbacDb } from "../db.js";
import { syncClaimsForUid } from "../services/claimsService.js";
import { writeAuditLog } from "../services/auditService.js";
import { newId } from "../utils/ids.js";
import { cleanString, cleanStringList, parseData, requireField } from "../utils/parse.js";
import { normaliseRoleKey } from "../transformers.js";
import { upsertRecommendation } from "../services/recommendationService.js";
import { loadPlatformConfig, scoreContributorProgrammeFit } from "../ai/latticeGraph.js";

function requireContributor(request, contributorId) {
  const ctx = requireRole(request, [...CONTRIBUTOR_ROLES, ROLES.PLATFORM_ADMIN]);
  if (ctx.role === ROLES.PLATFORM_ADMIN) return ctx;
  if (ctx.claims.entityId === contributorId) return ctx;
  throw new HttpsError("permission-denied", "You can only access your own contributor profile.");
}

export async function registerContributorProfileHandler(request) {
  const { uid } = requireAuth(request);
  const data = parseData(request);

  const name = requireField(data, "name");
  const role = normaliseRoleKey(requireField(data, "role"));
  if (!CONTRIBUTOR_ROLES.has(role)) {
    throw new HttpsError("invalid-argument", "role must be mentor, partner, investor, or service_provider.");
  }

  const contributorId = cleanString(data.contributorId) || newId("cont");
  const db = getRbacDb();

  let email = cleanString(data.email);
  try {
    email = email || (await getAuth().getUser(uid)).email || "";
  } catch {
    /* emulator */
  }

  const contributorPayload = {
    id: contributorId,
    authUid: uid,
    orgId: null,
    name,
    role,
    contributorTypes: cleanStringList(data.contributorTypes).length
      ? cleanStringList(data.contributorTypes)
      : [role.charAt(0).toUpperCase() + role.slice(1).replace("_", " ")],
    expertise: cleanStringList(data.expertise),
    supportedStages: cleanStringList(data.supportedStages),
    availability: cleanString(data.availability, "Available"),
    status: "Pending",
    capacity: data.capacity || { globalMaxProgrammes: 3, globalMaxStartupAssignments: 5 },
    updatedAt: FieldValue.serverTimestamp(),
  };

  const ref = db.collection("contributors").doc(contributorId);
  if (!(await ref.get()).exists) contributorPayload.createdAt = FieldValue.serverTimestamp();
  await ref.set(contributorPayload, { merge: true });

  await db.collection("users").doc(uid).set(
    {
      id: uid,
      email,
      displayName: name,
      role,
      orgId: null,
      programmeId: null,
      entityType: "contributor",
      entityId: contributorId,
      status: "active",
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const claims = await syncClaimsForUid(uid);

  await writeAuditLog({
    actorUid: uid,
    actorRole: role,
    action: "contributor.register",
    targetType: "contributor",
    targetId: contributorId,
  });

  return { contributor: contributorPayload, claims };
}

export async function requestOrgAssociationHandler(request) {
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  const orgId = requireField(data, "orgId");
  const ctx = requireContributor(request, contributorId);

  const db = getRbacDb();
  const orgSnap = await db.collection("organisations").doc(orgId).get();
  if (!orgSnap.exists) throw new HttpsError("not-found", "Organisation not found.");

  const requestId = newId("org-req");
  await db.collection("org_association_requests").doc(requestId).set({
    id: requestId,
    contributorId,
    orgId,
    status: "Pending",
    message: cleanString(data.message),
    createdAt: FieldValue.serverTimestamp(),
    requestedByUid: ctx.uid,
  });

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "contributor.request_org_association",
    targetType: "org_association_requests",
    targetId: requestId,
    orgId,
  });

  return { requestId, orgId, contributorId, status: "Pending" };
}

export async function approveOrgAssociationHandler(request) {
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const requestId = requireField(data, "requestId");
  const ctx = requireOrgAdmin(request, orgId);

  const db = getRbacDb();
  const reqRef = db.collection("org_association_requests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "Association request not found.");

  const reqData = reqSnap.data();
  if (reqData.orgId !== orgId) {
    throw new HttpsError("permission-denied", "Request is outside your organisation.");
  }

  await reqRef.set(
    { status: "Approved", reviewedByUid: ctx.uid, reviewedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  await db.collection("contributors").doc(reqData.contributorId).set(
    { orgId, status: "Pending", updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return { requestId, contributorId: reqData.contributorId, orgId, status: "Approved" };
}

export async function rejectOrgAssociationHandler(request) {
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const requestId = requireField(data, "requestId");
  const ctx = requireOrgAdmin(request, orgId);

  const db = getRbacDb();
  const reqRef = db.collection("org_association_requests").doc(requestId);
  const reqSnap = await reqRef.get();
  if (!reqSnap.exists) throw new HttpsError("not-found", "Association request not found.");

  const reqData = reqSnap.data();
  if (reqData.orgId !== orgId) {
    throw new HttpsError("permission-denied", "Request is outside your organisation.");
  }

  await reqRef.set(
    {
      status: "Rejected",
      reviewedByUid: ctx.uid,
      reviewedAt: FieldValue.serverTimestamp(),
      rejectionReason: cleanString(data.reason),
    },
    { merge: true },
  );

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "contributor.reject_org_association",
    targetType: "org_association_requests",
    targetId: requestId,
    orgId,
  });

  return { requestId, contributorId: reqData.contributorId, orgId, status: "Rejected" };
}

export async function acceptProgrammeAssignmentHandler(request) {
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  const poolId = requireField(data, "poolId");
  const ctx = requireContributor(request, contributorId);

  const db = getRbacDb();
  const poolRef = db.collection("programmeContributors").doc(poolId);
  const poolSnap = await poolRef.get();
  if (!poolSnap.exists) throw new HttpsError("not-found", "Pool assignment not found.");
  if (poolSnap.data().contributorId !== contributorId) {
    throw new HttpsError("permission-denied", "Assignment does not belong to this contributor.");
  }

  await poolRef.set(
    {
      status: "Approved",
      contributorAcceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  return { poolId, status: "Approved", contributorId };
}

export async function rejectProgrammeAssignmentHandler(request) {
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  const poolId = requireField(data, "poolId");
  requireContributor(request, contributorId);

  const db = getRbacDb();
  const poolRef = db.collection("programmeContributors").doc(poolId);
  const poolSnap = await poolRef.get();
  if (!poolSnap.exists) throw new HttpsError("not-found", "Pool assignment not found.");
  if (poolSnap.data().contributorId !== contributorId) {
    throw new HttpsError("permission-denied", "Assignment does not belong to this contributor.");
  }

  await poolRef.set(
    { status: "Rejected", updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return { poolId, status: "Rejected", contributorId };
}

export async function updateContributorProfileHandler(request) {
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  requireContributor(request, contributorId);

  const db = getRbacDb();
  const ref = db.collection("contributors").doc(contributorId);
  if (!(await ref.get()).exists) {
    throw new HttpsError("not-found", "Contributor not found.");
  }

  const updates = { updatedAt: FieldValue.serverTimestamp() };
  for (const key of ["name", "availability", "ticketSize"]) {
    if (data[key] != null) updates[key] = data[key];
  }
  if (data.expertise) updates.expertise = cleanStringList(data.expertise);
  if (data.supportedStages) updates.supportedStages = cleanStringList(data.supportedStages);
  if (data.capacity) updates.capacity = data.capacity;

  await ref.set(updates, { merge: true });
  return { contributorId, updated: Object.keys(updates) };
}

export async function submitContributorFeedbackHandler(request) {
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  const relationshipId = requireField(data, "relationshipId");
  const ctx = requireContributor(request, contributorId);

  const db = getRbacDb();
  await db.collection("outcomes").doc(newId("outcome")).set({
    relationshipId,
    contributorId,
    contributorFeedback: cleanString(data.feedback),
    contributorRating: Number(data.rating) || null,
    submittedByUid: ctx.uid,
    createdAt: FieldValue.serverTimestamp(),
  });

  return { ok: true, relationshipId };
}

export async function updateContributorCapacityHandler(request) {
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");
  requireContributor(request, contributorId);

  const db = getRbacDb();
  const capacity = data.capacity;
  if (!capacity || typeof capacity !== "object") {
    throw new HttpsError("invalid-argument", "capacity object is required.");
  }

  await db.collection("contributors").doc(contributorId).set(
    { capacity, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );

  return { contributorId, capacity };
}

const MAX_CONTRIBUTOR_PROGRAMME_RECS = 8;

export async function recommendContributorToProgrammesHandler(request) {
  requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN, ROLES.PROGRAMME_ADMIN]);
  const data = parseData(request);
  const contributorId = requireField(data, "contributorId");

  const db = getRbacDb();
  const contributorSnap = await db.collection("contributors").doc(contributorId).get();
  if (!contributorSnap.exists) throw new HttpsError("not-found", "Contributor not found.");

  const contributor = { id: contributorSnap.id, ...contributorSnap.data() };
  if (contributor.availability === "Unavailable") {
    return { contributorId, recommendations: [] };
  }

  const platformConfig = await loadPlatformConfig(db);
  const programmesSnap = await db
    .collection("programmes")
    .where("status", "in", ["Open", "Active"])
    .limit(40)
    .get();

  const candidates = [];
  for (const progDoc of programmesSnap.docs) {
    const programme = { id: progDoc.id, ...progDoc.data() };
    const fit = await scoreContributorProgrammeFit(db, contributor, programme, platformConfig);
    if (!fit.passesThreshold) continue;
    candidates.push({ programme, fit });
  }

  candidates.sort((a, b) => b.fit.matchScore - a.fit.matchScore);
  const recommendations = [];

  for (const item of candidates.slice(0, MAX_CONTRIBUTOR_PROGRAMME_RECS)) {
    const recType = `${item.fit.contributorType}-to-Programme`;
    const recommendation = await upsertRecommendation(db, {
      recommendationType: recType,
      sourceEntityType: "contributor",
      sourceEntityId: contributorId,
      targetEntityType: "programme",
      targetEntityId: item.programme.id,
      programmeId: item.programme.id,
      orgId: item.programme.orgId,
      matchScore: item.fit.matchScore,
      explanation: item.fit.explanation,
      riskFlags: item.fit.riskFlags,
      scoreBreakdown: item.fit.scoreBreakdown,
      graphEvidence: { summary: "Contributor programme fit (rule + semantic)." },
      status: "Pending Approval",
    });
    recommendations.push(recommendation);
  }

  return { contributorId, recommendations, candidatesScored: candidates.length };
}
