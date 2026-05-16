/** Development login accounts — password shared for local / staging use only. */
export const LOGIN_PASSWORD = "LatticeDemo2026!";

export const LOGIN_ACCOUNTS = [
  { role: "Platform Admin", email: "platform@lattice.dev", path: "/platform", name: "Elena Vasquez" },
  { role: "Org Admin", email: "orgadmin@lattice.dev", path: "/org/org-sginnovate", name: "Marcus Chen · SGInnovate" },
  {
    role: "Programme Admin",
    email: "progadmin@lattice.dev",
    path: "/programme/prog-healthtech-catalyst-2026",
    name: "Amelia Koh",
  },
  {
    role: "Startup",
    email: "startup@lattice.dev",
    path: "/startup/startup-mediscan-ai",
    name: "Arjun Nair · MediScan AI",
  },
  {
    role: "Mentor",
    email: "mentor@lattice.dev",
    path: "/contributor/cont-priya-menon",
    name: "Dr. Priya Menon",
  },
  {
    role: "Partner",
    email: "partner@lattice.dev",
    path: "/contributor/cont-dbs-partnerships",
    name: "DBS Innovation Partnerships",
  },
  {
    role: "Investor",
    email: "investor@lattice.dev",
    path: "/contributor/cont-vertex-holdings-sea",
    name: "Vertex Holdings (SEA)",
  },
  {
    role: "Service Provider",
    email: "service@lattice.dev",
    path: "/contributor/cont-rajah-tann-cyber",
    name: "Rajah & Tann Cyber",
  },
] as const;
