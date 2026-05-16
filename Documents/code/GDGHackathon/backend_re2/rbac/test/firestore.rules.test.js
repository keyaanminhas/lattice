import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import assert from "node:assert/strict";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rules = readFileSync(
  path.resolve(__dirname, "..", "..", "firestore.rbac.rules"),
  "utf8",
);

const PROJECT_ID = "rbac-rules-test";
const DATABASE_ID = "rbac-new-db";

let testEnv;

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules,
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

test.after(async () => {
  await testEnv.cleanup();
});

function dbAs(auth) {
  return testEnv
    .authenticatedContext(auth.uid, auth.token)
    .firestore()
    .database(DATABASE_ID);
}

test("startup cannot write platform_config", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await context.firestore().database(DATABASE_ID).doc("platform_config/global").set({
      id: "global",
    });
  });

  const startupDb = dbAs({
    uid: "startup-1",
    token: { role: "startup", entityId: "comp-1" },
  });

  await assertFails(
    startupDb.doc("platform_config/global").update({ globalCategories: ["X"] }),
  );
});

test("platform_admin can read platform_config", async () => {
  const adminDb = dbAs({
    uid: "admin-1",
    token: { role: "platform_admin" },
  });

  await assertSucceeds(adminDb.doc("platform_config/global").get());
});

test("org_admin cannot read other org_rules", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore().database(DATABASE_ID);
    await db.doc("org_rules/org-1").set({ orgId: "org-1" });
    await db.doc("org_rules/org-2").set({ orgId: "org-2" });
  });

  const orgAdminDb = dbAs({
    uid: "org-admin-1",
    token: { role: "org_admin", orgId: "org-1" },
  });

  await assertSucceeds(orgAdminDb.doc("org_rules/org-1").get());
  await assertFails(orgAdminDb.doc("org_rules/org-2").get());
});

test("startup can read own profile only among users", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore().database(DATABASE_ID);
    await db.doc("users/startup-1").set({ role: "startup", orgId: null });
    await db.doc("users/other-user").set({ role: "org_admin", orgId: "org-1" });
  });

  const startupDb = dbAs({
    uid: "startup-1",
    token: { role: "startup", entityId: "comp-1" },
  });

  await assertSucceeds(startupDb.doc("users/startup-1").get());
  await assertFails(startupDb.doc("users/other-user").get());
});

test("org_admin cannot create organisations", async () => {
  const orgAdminDb = dbAs({
    uid: "org-admin-1",
    token: { role: "org_admin", orgId: "org-1" },
  });

  await assertFails(
    orgAdminDb.doc("organisations/org-new").set({
      id: "org-new",
      name: "New Org",
      orgId: "org-new",
    }),
  );
});

test("programme_admin can read programme in scope", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore().database(DATABASE_ID);
    await db.doc("programmes/prog-1").set({ orgId: "org-1", name: "Accel" });
  });

  const progAdminDb = dbAs({
    uid: "prog-admin-1",
    token: { role: "programme_admin", programmeId: "prog-1", orgId: "org-1" },
  });

  await assertSucceeds(progAdminDb.doc("programmes/prog-1").get());
});
