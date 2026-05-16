const base = process.env.BASE_URL || "http://localhost:3002";
const cookie = "lattice_session=1";

const routes = [
  "/platform",
  "/platform/tenants",
  "/platform/graph",
  "/platform/audit",
  "/org/org-sginnovate",
  "/org/org-sginnovate/programmes",
  "/org/org-sginnovate/contributors",
  "/org/org-sginnovate/audit",
  "/programme/prog-healthtech-catalyst-2026",
  "/programme/prog-healthtech-catalyst-2026/applications",
  "/programme/prog-healthtech-catalyst-2026/pool",
  "/programme/prog-healthtech-catalyst-2026/matches",
  "/startup/startup-mediscan-ai",
  "/startup/startup-mediscan-ai/programmes",
  "/startup/startup-mediscan-ai/applications",
  "/startup/startup-mediscan-ai/profile",
  "/contributor/cont-priya-menon",
  "/contributor/cont-priya-menon/assignments",
  "/contributor/cont-priya-menon/capacity",
  "/contributor/cont-priya-menon/profile",
];

let failed = 0;

for (const path of routes) {
  const res = await fetch(`${base}${path}`, {
    redirect: "manual",
    headers: { Cookie: cookie },
  });
  const ok = res.status === 200;
  if (!ok) failed += 1;
  console.log(`${ok ? "OK" : "FAIL"} ${res.status} ${path}`);
}

if (failed) {
  console.error(`\n${failed} authed route(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${routes.length} authed routes return 200 (middleware + SSR).`);
