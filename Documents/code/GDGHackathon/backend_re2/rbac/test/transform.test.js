import test from "node:test";
import assert from "node:assert/strict";
import {
  buildUsersAndAssignments,
  normaliseRoleKey,
  transformStartup,
} from "../src/transformers.js";

test("normaliseRoleKey maps organisation_admin to org_admin", () => {
  assert.equal(normaliseRoleKey("organisation_admin"), "org_admin");
});

test("transformStartup preserves company id and maps orgId", () => {
  const doc = transformStartup("comp-1", {
    name: "MediScan AI",
    organisationId: "org-1",
    sector: "HealthTech",
  });
  assert.equal(doc.id, "comp-1");
  assert.equal(doc.orgId, "org-1");
  assert.equal(doc.legacyCollection, "companies");
});

test("buildUsersAndAssignments scopes org_admin orgId", () => {
  const { users } = buildUsersAndAssignments(
    [
      {
        id: "uid-org",
        roleKey: "organisation_admin",
        accountType: "organisation",
        entityType: "organisation",
        entityId: "org-1",
        email: "org@example.com",
        displayName: "Org Admin",
        status: "Active",
      },
    ],
    [
      {
        id: "ra-1",
        uid: "uid-org",
        roleKey: "organisation_admin",
        scopeType: "organisation",
        scopeId: "org-1",
        status: "active",
      },
    ],
    new Map(),
  );

  assert.equal(users.length, 1);
  assert.equal(users[0].role, "org_admin");
  assert.equal(users[0].orgId, "org-1");
  assert.equal(users[0].programmeId, null);
});
