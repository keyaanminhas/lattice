import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import { dispatchRbacAction, listRbacActions } from "../../src/api/router.js";

test("router exposes Phase 5 and 6 actions", () => {
  const actions = listRbacActions();
  for (const name of [
    "registerContributorProfile",
    "requestOrgAssociation",
    "approveOrgAssociation",
    "acceptProgrammeAssignment",
    "updateContributorProfile",
    "submitContributorFeedback",
    "runStartupAnalysis",
    "runContributorAnalysis",
    "rebuildGraphRag",
  ]) {
    assert.ok(actions.includes(name), `missing action ${name}`);
  }
});

test("unknown action rejected", async () => {
  await assert.rejects(
    () => dispatchRbacAction({ auth: { uid: "x", token: { role: "platform_admin" } }, data: { action: "nope" } }),
    (e) => e instanceof HttpsError && e.code === "invalid-argument",
  );
});
