import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";

import { buildCustomClaimsFromUser } from "../src/auth/claims.js";
import {
  requireOrgAdmin,
  requireProgrammeAdmin,
  requireRole,
} from "../src/auth/middleware.js";

function mockRequest(claims, data = {}) {
  return {
    auth: {
      uid: "test-uid",
      token: claims,
    },
    data,
  };
}

test("buildCustomClaimsFromUser sets orgId for org_admin", () => {
  const claims = buildCustomClaimsFromUser({
    role: "org_admin",
    orgId: "org-1",
    entityId: "org-1",
    status: "active",
  });
  assert.equal(claims.role, "org_admin");
  assert.equal(claims.orgId, "org-1");
});

test("startup cannot access platform admin route", () => {
  const req = mockRequest({ role: "startup", entityId: "comp-1" });
  assert.throws(
    () => requireRole(req, ["platform_admin"]),
    (err) => err instanceof HttpsError && err.code === "permission-denied",
  );
});

test("org_admin cannot access platform admin route", () => {
  const req = mockRequest({ role: "org_admin", orgId: "org-1" });
  assert.throws(
    () => requireRole(req, ["platform_admin"]),
    (err) => err instanceof HttpsError && err.code === "permission-denied",
  );
});

test("org_admin can access own org scope", () => {
  const req = mockRequest({ role: "org_admin", orgId: "org-1" });
  const ctx = requireOrgAdmin(req, "org-1");
  assert.equal(ctx.role, "org_admin");
  assert.equal(ctx.orgId, "org-1");
});

test("org_admin cannot access different org", () => {
  const req = mockRequest({ role: "org_admin", orgId: "org-1" });
  assert.throws(
    () => requireOrgAdmin(req, "org-2"),
    (err) => err instanceof HttpsError && err.code === "permission-denied",
  );
});

test("programme_admin scoped to programmeId", () => {
  const req = mockRequest({ role: "programme_admin", programmeId: "prog-1" });
  const ctx = requireProgrammeAdmin(req, "prog-1");
  assert.equal(ctx.programmeId, "prog-1");
});

test("startup cannot access programme admin route", () => {
  const req = mockRequest({ role: "startup", entityId: "comp-1" });
  assert.throws(
    () => requireProgrammeAdmin(req, "prog-1"),
    (err) => err instanceof HttpsError && err.code === "permission-denied",
  );
});
