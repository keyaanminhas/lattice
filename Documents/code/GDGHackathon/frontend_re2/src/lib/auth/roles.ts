export const ROLES = {
  PLATFORM_ADMIN: "platform_admin",
  ORG_ADMIN: "org_admin",
  PROGRAMME_ADMIN: "programme_admin",
  STARTUP: "startup",
  MENTOR: "mentor",
  PARTNER: "partner",
  INVESTOR: "investor",
  SERVICE_PROVIDER: "service_provider",
} as const;

export type LatticeRole = (typeof ROLES)[keyof typeof ROLES];

export const CONTRIBUTOR_ROLES: LatticeRole[] = [
  ROLES.MENTOR,
  ROLES.PARTNER,
  ROLES.INVESTOR,
  ROLES.SERVICE_PROVIDER,
];

export const ADMIN_ROLES: LatticeRole[] = [
  ROLES.PLATFORM_ADMIN,
  ROLES.ORG_ADMIN,
  ROLES.PROGRAMME_ADMIN,
];

export interface LatticeClaims {
  role?: LatticeRole;
  orgId?: string;
  programmeId?: string;
  entityId?: string;
}

export function isContributorRole(role?: string): boolean {
  return CONTRIBUTOR_ROLES.includes(role as LatticeRole);
}
