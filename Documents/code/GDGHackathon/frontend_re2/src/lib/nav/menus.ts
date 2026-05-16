import type { NavItem } from "@/components/layout/AppShell";
import { PRIMARY_LINKS } from "@/config/workspaceIds";

export function platformNav(): NavItem[] {
  return [
    { href: "/platform", label: "Global dashboard" },
    { href: "/platform/tenants", label: "Tenants" },
    { href: "/platform/graph", label: "LatticeGraph config" },
    { href: "/platform/audit", label: "Audit logs" },
  ];
}

export function orgNav(orgId: string): NavItem[] {
  const base = `/org/${orgId}`;
  return [
    { href: base, label: "Overview", badge: 3 },
    { href: `${base}/programmes`, label: "Programmes" },
    { href: `${base}/contributors`, label: "Contributors" },
    { href: `${base}/audit`, label: "Audit log" },
  ];
}

export function programmeNav(programmeId: string): NavItem[] {
  const base = `/programme/${programmeId}`;
  return [
    { href: base, label: "Dashboard" },
    { href: `${base}/applications`, label: "Applications", badge: 4 },
    { href: `${base}/pool`, label: "Contributor pool" },
    { href: `${base}/matches`, label: "Mentor matches", badge: 1 },
  ];
}

export function startupNav(entityId: string): NavItem[] {
  const base = `/startup/${entityId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/programmes`, label: "Programme discovery" },
    { href: `${base}/applications`, label: "My applications" },
    { href: `${base}/profile`, label: "Profile" },
  ];
}

export function contributorNav(entityId: string): NavItem[] {
  const base = `/contributor/${entityId}`;
  return [
    { href: base, label: "Overview" },
    { href: `${base}/assignments`, label: "Programme assignments" },
    { href: `${base}/capacity`, label: "Capacity" },
    { href: `${base}/profile`, label: "Profile" },
  ];
}

export { PRIMARY_LINKS };
