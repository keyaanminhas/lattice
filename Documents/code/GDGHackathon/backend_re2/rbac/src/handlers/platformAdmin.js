import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";
import { requireRole } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { getRbacDb } from "../db.js";
import { syncClaimsForUid } from "../services/claimsService.js";
import { writeAuditLog } from "../services/auditService.js";
import { newId } from "../utils/ids.js";
import { cleanString, cleanStringList, parseData, requireField } from "../utils/parse.js";

export async function createOrganisationHandler(request) {
  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN]);
  const data = parseData(request);

  const name = requireField(data, "name");
  const organisationType = cleanString(data.organisationType, "Ecosystem");
  const country = requireField(data, "country");
  const focusAreas = cleanStringList(data.focusAreas);

  const orgId = cleanString(data.orgId) || newId("org");
  const db = getRbacDb();
  const orgRef = db.collection("organisations").doc(orgId);

  if ((await orgRef.get()).exists) {
    throw new HttpsError("already-exists", `Organisation ${orgId} already exists.`);
  }

  const payload = {
    id: orgId,
    name,
    organisationType,
    country,
    focusAreas,
    status: "Active",
    createdAt: FieldValue.serverTimestamp(),
    createdByUid: ctx.uid,
  };

  await orgRef.set(payload);

  await db.collection("org_rules").doc(orgId).set(
    {
      id: orgId,
      orgId,
      verificationRequired: true,
      contributorApprovalMode: "manual",
      aiSuggestionsEnabled: true,
      allowedContributorRoles: ["mentor", "partner", "investor", "service_provider"],
      createdAt: FieldValue.serverTimestamp(),
      createdByUid: ctx.uid,
    },
    { merge: true },
  );

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "organisation.create",
    targetType: "organisation",
    targetId: orgId,
    orgId,
    metadata: { name },
  });

  return { organisation: payload };
}

export async function assignOrgAdminHandler(request) {
  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN]);
  const data = parseData(request);

  const orgId = requireField(data, "orgId");
  const targetUid = requireField(data, "targetUid");

  const db = getRbacDb();
  const orgSnap = await db.collection("organisations").doc(orgId).get();
  if (!orgSnap.exists) {
    throw new HttpsError("not-found", `Organisation ${orgId} not found.`);
  }

  let authUser;
  try {
    authUser = await getAuth().getUser(targetUid);
  } catch {
    throw new HttpsError("not-found", `Auth user ${targetUid} not found.`);
  }

  const displayName =
    cleanString(data.displayName) || authUser.displayName || authUser.email || "Org Admin";
  const email = cleanString(data.email) || authUser.email || "";

  const userPayload = {
    id: targetUid,
    email,
    displayName,
    role: ROLES.ORG_ADMIN,
    orgId,
    programmeId: null,
    entityType: "organisation",
    entityId: orgId,
    status: "active",
    updatedAt: FieldValue.serverTimestamp(),
    assignedByUid: ctx.uid,
  };

  const userRef = db.collection("users").doc(targetUid);
  if (!(await userRef.get()).exists) {
    userPayload.createdAt = FieldValue.serverTimestamp();
  }
  await userRef.set(userPayload, { merge: true });

  const assignmentId = `ra-org-${targetUid}-${orgId}`;
  await db.collection("role_assignments").doc(assignmentId).set(
    {
      id: assignmentId,
      uid: targetUid,
      role: ROLES.ORG_ADMIN,
      scopeType: "organisation",
      scopeId: orgId,
      orgId,
      programmeId: null,
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
    action: "organisation.assign_org_admin",
    targetType: "user",
    targetId: targetUid,
    orgId,
    metadata: { email, claims },
  });

  return { targetUid, orgId, claims };
}

export async function suspendOrganisationHandler(request) {
  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN]);
  const data = parseData(request);
  const orgId = requireField(data, "orgId");
  const reason = cleanString(data.reason, "Suspended by platform admin");

  const db = getRbacDb();
  const orgRef = db.collection("organisations").doc(orgId);
  if (!(await orgRef.get()).exists) {
    throw new HttpsError("not-found", `Organisation ${orgId} not found.`);
  }

  await orgRef.set(
    {
      status: "Suspended",
      suspendedAt: FieldValue.serverTimestamp(),
      suspendedByUid: ctx.uid,
      suspensionReason: reason,
    },
    { merge: true },
  );

  await writeAuditLog({
    actorUid: ctx.uid,
    actorRole: ctx.role,
    action: "organisation.suspend",
    targetType: "organisation",
    targetId: orgId,
    orgId,
    metadata: { reason },
  });

  return { orgId, status: "Suspended" };
}
