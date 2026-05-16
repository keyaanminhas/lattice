import { CONTRIBUTOR_ROLES } from "./roles.js";

/**
 * Build Firebase Auth custom claims from rbac-new-db users document.
 * Shape: { role, entityId?, orgId?, programmeId? }
 */
export function buildCustomClaimsFromUser(userDoc) {
  if (!userDoc || typeof userDoc !== "object") {
    throw new Error("User profile is required to build custom claims.");
  }

  const role = String(userDoc.role || "").trim().toLowerCase();
  if (!role) {
    throw new Error("User profile is missing role.");
  }

  const status = String(userDoc.status || "active").trim().toLowerCase();
  if (status === "suspended") {
    throw new Error("User account is suspended.");
  }

  const claims = {
    role,
    entityId: userDoc.entityId || null,
  };

  if (role === "org_admin") {
    const orgId = userDoc.orgId || userDoc.entityId;
    if (!orgId) {
      throw new Error("org_admin requires orgId on user profile.");
    }
    claims.orgId = orgId;
    claims.entityId = claims.entityId || orgId;
  }

  if (role === "programme_admin") {
    const programmeId = userDoc.programmeId;
    if (!programmeId) {
      throw new Error("programme_admin requires programmeId on user profile.");
    }
    claims.programmeId = programmeId;
    if (userDoc.orgId) claims.orgId = userDoc.orgId;
  }

  if (CONTRIBUTOR_ROLES.has(role) && userDoc.entityId) {
    claims.entityId = userDoc.entityId;
  }

  if (role === "startup" && userDoc.entityId) {
    claims.entityId = userDoc.entityId;
  }

  return stripNullish(claims);
}

function stripNullish(claims) {
  return Object.fromEntries(
    Object.entries(claims).filter(([, value]) => value != null && value !== ""),
  );
}
