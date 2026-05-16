import type { LatticeClaims, LatticeRole } from "./roles";
import { isContributorRole, ROLES } from "./roles";

/** Canonical home route per role — prevents cross-tenant layout bleed. */
export function resolveHomePath(claims: LatticeClaims): string {
  const role = claims.role;
  switch (role) {
    case ROLES.PLATFORM_ADMIN:
      return "/platform";
    case ROLES.ORG_ADMIN:
      return claims.orgId ? `/org/${claims.orgId}` : "/auth/pending";
    case ROLES.PROGRAMME_ADMIN:
      return claims.programmeId ? `/programme/${claims.programmeId}` : "/auth/pending";
    case ROLES.STARTUP:
      return claims.entityId ? `/startup/${claims.entityId}` : "/auth/pending";
    default:
      if (role && isContributorRole(role)) {
        return claims.entityId ? `/contributor/${claims.entityId}` : "/auth/pending";
      }
      return "/auth/pending";
  }
}

/** Prefix allowed for a role (middleware traffic controller). */
export function allowedPrefixForRole(role?: LatticeRole): string | null {
  switch (role) {
    case ROLES.PLATFORM_ADMIN:
      return "/platform";
    case ROLES.ORG_ADMIN:
      return "/org";
    case ROLES.PROGRAMME_ADMIN:
      return "/programme";
    case ROLES.STARTUP:
      return "/startup";
    case ROLES.MENTOR:
    case ROLES.PARTNER:
    case ROLES.INVESTOR:
    case ROLES.SERVICE_PROVIDER:
      return "/contributor";
    default:
      return null;
  }
}

export function pathMatchesRole(pathname: string, claims: LatticeClaims): boolean {
  // Platform admin may access any workspace route for oversight
  if (claims.role === ROLES.PLATFORM_ADMIN) {
    return (
      pathname.startsWith("/platform") ||
      pathname.startsWith("/org/") ||
      pathname.startsWith("/programme/") ||
      pathname.startsWith("/startup/") ||
      pathname.startsWith("/contributor/")
    );
  }

  const prefix = allowedPrefixForRole(claims.role);
  if (!prefix) return false;
  if (claims.role === ROLES.ORG_ADMIN && claims.orgId) {
    return pathname.startsWith(`/org/${claims.orgId}`);
  }
  if (claims.role === ROLES.PROGRAMME_ADMIN && claims.programmeId) {
    return pathname.startsWith(`/programme/${claims.programmeId}`);
  }
  if (claims.role === ROLES.STARTUP && claims.entityId) {
    return pathname.startsWith(`/startup/${claims.entityId}`);
  }
  if (claims.role && isContributorRole(claims.role) && claims.entityId) {
    return pathname.startsWith(`/contributor/${claims.entityId}`);
  }
  return pathname.startsWith(prefix);
}

export const PUBLIC_PATHS = ["/", "/login", "/signup", "/auth/pending"];
