export const ROLES = Object.freeze({
  PLATFORM_ADMIN: "platform_admin",
  ORG_ADMIN: "org_admin",
  PROGRAMME_ADMIN: "programme_admin",
  STARTUP: "startup",
  MENTOR: "mentor",
  PARTNER: "partner",
  INVESTOR: "investor",
  SERVICE_PROVIDER: "service_provider",
});

export const CONTRIBUTOR_ROLES = new Set([
  ROLES.MENTOR,
  ROLES.PARTNER,
  ROLES.INVESTOR,
  ROLES.SERVICE_PROVIDER,
]);

export const ADMIN_ROLES = new Set([
  ROLES.PLATFORM_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.PROGRAMME_ADMIN,
]);
