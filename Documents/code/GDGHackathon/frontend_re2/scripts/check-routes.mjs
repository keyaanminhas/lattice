const base = process.env.BASE_URL || "http://localhost:3001";

const routes = [
  "/",
  "/login",
  "/signup",
  "/auth/pending",
  "/auth/resolve",
  "/lattice-logo.png",
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

const publicPaths = new Set([
  "/",
  "/login",
  "/signup",
  "/auth/pending",
  "/auth/resolve",
  "/lattice-logo.png",
]);

let failed = 0;

for (const path of routes) {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
  const expectedPublic = publicPaths.has(path);
  const ok = expectedPublic
    ? res.status === 200
    : res.status === 307 || res.status === 302;
  const tag = ok ? "OK" : "FAIL";
  if (!ok) failed += 1;
  console.log(`${tag} ${res.status} ${path}${res.headers.get("location") ? ` -> ${res.headers.get("location")}` : ""}`);
}

if (failed) {
  console.error(`\n${failed} route(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${routes.length} routes responded as expected.`);
