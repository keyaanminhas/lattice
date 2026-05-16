import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { requireOrgAdmin } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { getRbacDb } from "../db.js";
import { syncClaimsForUid } from "../services/claimsService.js";
import { writeAuditLog } from "../services/auditService.js";
import { newId } from "../utils/ids.js";
import { cleanString, cleanStringList, parseData, requireField } from "../utils/parse.js";

async function loadProgramme(db, programmeId) {
  const snap = await db.collection("programmes").doc(programmeId).get();
  if (!snap.exists) {
    throw new HttpsError("not-found", `Programme ${programmeId} not found.`);
  }
  return { id: snap.id, ...snap.data() };
}

export async function createProgrammeHandler(request) {
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const ctx = requireOrgAdmin(request, orgId);

  const name = requireField(data, "name");
  const type = cleanString(data.type, "Accelerator");
  const country = requireField(data, "country");

  const programmeId = cleanString(data.programmeId) || newId("prog");
  const db = getRbacDb();
  const progRef = db.collection("programmes").doc(programmeId);

  if ((await progRef.get()).exists) {
    throw new HttpsError("already-exists", `Programme ${programmeId} already exists.`);
  }

  const payload = {
    id: programmeId,
    orgId,
    name,
    type,
    country,
    region: cleanString(data.region) || null,
    targetSectors: cleanStringList(data.targetSectors),
    targetStages: cleanStringList(data.targetStages),
    eligibilityRules: cleanStringList(data.eligibilityRules),
    expectedOutcomes: cleanStringList(data.expectedOutcomes),
    status: cleanString(data.status, "Draft"),
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: ctx.uid,
  };

  await progRef.set(payload);

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "programme.create",
    targetType: "programme",
    targetId: programmeId,
    orgId,
    programmeId,
    metadata: { name },
  });

  return { programme: payload };
}

export async function updateProgrammeHandler(request) {
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const programmeId = requireField(data, "programmeId");
  const ctx = requireOrgAdmin(request, orgId);

  const db = getRbacDb();
  const programme = await loadProgramme(db, programmeId);
  if (programme.orgId !== orgId) {
    throw new HttpsError("permission-denied", "Programme does not belong to this organisation.");
  }

  const updates = { updatedAt: FieldValue.serverTimestamp(), updatedByUid: ctx.uid };
  for (const key of ["name", "type", "country", "region", "status"]) {
    if (data[key] != null) updates[key] = cleanString(data[key]);
  }
  for (const key of ["targetSectors", "targetStages", "eligibilityRules", "expectedOutcomes"]) {
    if (data[key] != null) updates[key] = cleanStringList(data[key]);
  }

  await db.collection("programmes").doc(programmeId).set(updates, { merge: true });

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "programme.update",
    targetType: "programme",
    targetId: programmeId,
    orgId,
    programmeId,
    metadata: { fields: Object.keys(updates) },
  });

  return { programmeId, orgId, updated: Object.keys(updates) };
}

export async function assignProgrammeAdminHandler(request) {
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const programmeId = requireField(data, "programmeId");
  const targetUid = requireField(data, "targetUid");

  const ctx = requireOrgAdmin(request, orgId);
  const db = getRbacDb();
  const programme = await loadProgramme(db, programmeId);

  if (programme.orgId !== orgId) {
    throw new HttpsError(
      "permission-denied",
      "Programme does not belong to the specified organisation.",
    );
  }

  let authUser;
  try {
    authUser = await getAuth().getUser(targetUid);
  } catch {
    throw new HttpsError("not-found", `Auth user ${targetUid} not found.`);
  }

  const displayName =
    cleanString(data.displayName) ||
    authUser.displayName ||
    authUser.email ||
    "Programme Admin";
  const email = cleanString(data.email) || authUser.email || "";

  const userPayload = {
    id: targetUid,
    email,
    displayName,
    role: ROLES.PROGRAMME_ADMIN,
    orgId,
    programmeId,
    entityType: "programme",
    entityId: programmeId,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
    assignedByUid: ctx.uid,
  };

  const userRef = db.collection("users").doc(targetUid);
  if (!(await userRef.get()).exists) {
    userPayload.createdAt = FieldValue.serverTimestamp();
  }
  await userRef.set(userPayload, { merge: true });

  const assignmentId = `ra-prog-${targetUid}-${programmeId}`;
  await db.collection("role_assignments").doc(assignmentId).set(
    {
      id: assignmentId,
      uid: targetUid,
      role: ROLES.PROGRAMME_ADMIN,
      scopeType: "programme",
      scopeId: programmeId,
      orgId,
      programmeId,
      status: "active",
      createdByUid: ctx.uid,
      approvedByUid: ctx.uid,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  const claims = await syncClaimsForUid(targetUid);

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "programme.assign_programme_admin",
    targetType: "user",
    targetId: targetUid,
    orgId,
    programmeId,
    metadata: { email, claims },
  });

  return { targetUid, orgId, programmeId, claims };
}

export async function verifyContributorHandler(request) {
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const contributorId = requireField(data, "contributorId");
  const decision = cleanString(data.status, "Verified");

  if (!["Verified", "Rejected"].includes(decision)) {
    throw new HttpsError("invalid-argument", "status must be Verified or Rejected.");
  }

  const ctx = requireOrgAdmin(request, orgId);
  const db = getRbacDb();
  const contributorRef = db.collection("contributors").doc(contributorId);
  const snap = await contributorRef.get();

  if (!snap.exists) {
    throw new HttpsError("not-found", `Contributor ${contributorId} not found.`);
  }

  const contributor = snap.data();
  if (contributor.orgId && contributor.orgId !== orgId) {
    throw new HttpsError(
      "permission-denied",
      "Contributor does not belong to this organisation.",
    );
  }

  await contributorRef.set(
    {
      status: decision,
      verificationStatus: decision,
      verifiedAt: FieldValue.serverTimestamp(),
      verifiedByUid: ctx.uid,
    },
    { merge: true },
  );

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "contributor.verify",
    targetType: "contributor",
    targetId: contributorId,
    orgId,
    metadata: { status: decision },
  });

  return { contributorId, orgId, status: decision };
}
