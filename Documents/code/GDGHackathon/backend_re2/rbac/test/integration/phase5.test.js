import test from "node:test";
import assert from "node:assert/strict";
import { dispatchRbacAction } from "../../src/api/router.js";
import {
  configureEmulatorEnv,
  initEmulatorApps,
  mockCallable,
  ensureAuthUser,
  isEmulatorReachable,
} from "../helpers/emulator.js";
import { runEmbeddingSelfTest } from "../../src/ai/latticeGraph.js";

test("embedding self-test (no Firestore)", () => {
  const r = runEmbeddingSelfTest();
  assert.ok(r.passes);
});

const emulatorUp = await isEmulatorReachable();

test("Phase 5 contributor flows via rbacApi router", { skip: !emulatorUp }, async () => {
  configureEmulatorEnv();
  const { auth, db } = await initEmulatorApps();
  const suffix = Date.now();
  const mentorUid = `mentor-p5-${suffix}`;
  const orgId = `org-p5-${suffix}`;

  await ensureAuthUser(auth, { uid: mentorUid, email: `mentor-p5-${suffix}@test.local` });
  await db.collection("organisations").doc(orgId).set({ id: orgId, name: "P5 Org", country: "SG" });

  const reg = await dispatchRbacAction(
    mockCallable(mentorUid, {}, {
      action: "registerContributorProfile",
      name: "P5 Mentor",
      role: "mentor",
      expertise: ["HealthTech"],
    }),
  );
  assert.equal(reg.contributor.role, "mentor");

  const req = await dispatchRbacAction(
    mockCallable(mentorUid, { role: "mentor", entityId: reg.contributor.id }, {
      action: "requestOrgAssociation",
      contributorId: reg.contributor.id,
      orgId,
    }),
  );
  assert.equal(req.status, "Pending");
});
