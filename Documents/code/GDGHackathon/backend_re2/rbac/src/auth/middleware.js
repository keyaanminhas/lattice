import { HttpsError } from "firebase-functions/v2/https";
import { ADMIN_ROLES, ROLES } from "./roles.js";

function clean(value) {
  return String(value ?? "").trim();
}

function token(auth) {
  return auth?.token || {};
}

/**
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 * @param {string[]} allowedRoles
 */
export function requireAuth(request) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }
  return { uid: request.auth.uid, claims: token(request.auth) };
}

/**
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 * @param {string[]} allowedRoles
 */
export function requireRole(request, allowedRoles) {
  const { uid, claims } = requireAuth(request);
  const role = clean(claims.role).toLowerCase();
  const normalizedAllowed = allowedRoles.map((r) => clean(r).toLowerCase());

  if (!role || !normalizedAllowed.includes(role)) {
    throw new HttpsError(
      "permission-denied",
      `Role '${role || "none"}' is not allowed. Required: ${normalizedAllowed.join(", ")}`,
    );
  }

  return { uid, role, claims };
}

/**
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 * @param {string} orgId
 */
export function requireOrgAdmin(request, orgId) {
  const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN, ROLES.ORG_ADMIN]);
  const targetOrgId = clean(orgId);

  if (ctx.role === ROLES.PLATFORM_ADMIN) {
    return { ...ctx, orgId: targetOrgId };
  }

  if (ctx.role === ROLES.ORG_ADMIN && clean(ctx.claims.orgId) === targetOrgId) {
    return { ...ctx, orgId: targetOrgId };
  }

  throw new HttpsError(
    "permission-denied",
    "You do not have organisation admin access for this org.",
  );
}

/**
 * @param {import('firebase-functions/v2/https').CallableRequest} request
 * @param {string} programmeId
 */
export function requireProgrammeAdmin(request, programmeId) {
  const ctx = requireRole(request, [
    ROLES.PLATFORM_ADMIN,
    ROLES.ORG_ADMIN,
    ROLES.PROGRAMME_ADMIN,
  ]);
  const targetProgrammeId = clean(programmeId);

  if (ctx.role === ROLES.PLATFORM_ADMIN) {
    return { ...ctx, programmeId: targetProgrammeId };
  }

  if (
    ctx.role === ROLES.PROGRAMME_ADMIN &&
    clean(ctx.claims.programmeId) === targetProgrammeId
  ) {
    return { ...ctx, programmeId: targetProgrammeId };
  }

  if (ctx.role === ROLES.ORG_ADMIN) {
    // Org admin may access programmes in their org when programmeId is validated upstream.
    return { ...ctx, programmeId: targetProgrammeId, orgScoped: true };
  }

  throw new HttpsError(
    "permission-denied",
    "You do not have programme admin access for this programme.",
  );
}

export function isAdminRole(role) {
  return ADMIN_ROLES.has(clean(role).toLowerCase());
}
