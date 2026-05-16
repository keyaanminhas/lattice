import test from "node:test";
import assert from "node:assert/strict";
import { HttpsError } from "firebase-functions/v2/https";
import {
  configureEmulatorEnv,
  initEmulatorApps,
  mockCallable,
  ensureAuthUser,
  seedUserDoc,
  isEmulatorReachable,
} from "../helpers/emulator.js";
import {
  createOrganisationHandler,
  assignOrgAdminHandler,
} from "../../src/handlers/platformAdmin.js";
import {
  createProgrammeHandler,
  assignProgrammeAdminHandler,
  verifyContributorHandler,
} from "../../src/handlers/orgAdmin.js";
import { getAuth } from "firebase-admin/auth";

const emulatorUp = await isEmulatorReachable();

test("Phase 3 integration (requires Firebase Emulator Suite)", { skip: !emulatorUp }, async (t) => {
  configureEmulatorEnv();
  const { auth, db } = await initEmulatorApps();

  const platformUid = "phase3-platform-admin";
  const orgAdminUid = "phase3-org-admin";
  const progAdminUid = "phase3-prog-admin";
  const orgId = `org-phase3-${Date.now()}`;
  const programmeId = `prog-phase3-${Date.now()}`;
  const contributorId = `cont-phase3-${Date.now()}`;

  await ensureAuthUser(auth, {
    uid: platformUid,
    email: "phase3-platform@lattice.test",
  });
  await ensureAuthUser(auth, {
    uid: orgAdminUid,
    email: "phase3-orgadmin@lattice.test",
  });
  await ensureAuthUser(auth, {
    uid: progAdminUid,
    email: "phase3-progadmin@lattice.test",
  });

  await seedUserDoc(db, platformUid, {
    email: "phase3-platform@lattice.test",
    displayName: "Phase3 Platform",
    role: "platform_admin",
  });

  await t.test("platform admin creates organisation", async () => {
    const result = await createOrganisationHandler(
      mockCallable(
        platformUid,
        { role: "platform_admin" },
        {
          orgId,
          name: "Phase3 Test Org",
          country: "SG",
          organisationType: "Accelerator",
          focusAreas: ["HealthTech"],
        },
      ),
    );

    assert.equal(result.organisation.id, orgId);
    const orgSnap = await db.collection("organisations").doc(orgId).get();
    assert.equal(orgSnap.data().status, "Active");
  });

  await t.test("platform admin assigns org admin with custom claims", async () => {
    const result = await assignOrgAdminHandler(
      mockCallable(
        platformUid,
        { role: "platform_admin" },
        { orgId, targetUid: orgAdminUid, displayName: "Phase3 Org Admin" },
      ),
    );

    assert.equal(result.orgId, orgId);
    assert.equal(result.claims.role, "org_admin");
    assert.equal(result.claims.orgId, orgId);

    const userSnap = await db.collection("users").doc(orgAdminUid).get();
    assert.equal(userSnap.data().role, "org_admin");
    assert.equal(userSnap.data().orgId, orgId);

    const authUser = await getAuth().getUser(orgAdminUid);
    assert.equal(authUser.customClaims.role, "org_admin");
    assert.equal(authUser.customClaims.orgId, orgId);
  });

  await t.test("org admin creates programme in own org", async () => {
    const result = await createProgrammeHandler(
      mockCallable(
        orgAdminUid,
        { role: "org_admin", orgId },
        {
          orgId,
          programmeId,
          name: "Phase3 Accelerator",
          country: "SG",
          targetSectors: ["HealthTech"],
          targetStages: ["Seed"],
        },
      ),
    );

    assert.equal(result.programme.id, programmeId);
    assert.equal(result.programme.orgId, orgId);
  });

  await t.test("org admin cannot create programme for another org", async () => {
    await assert.rejects(
      () =>
        createProgrammeHandler(
          mockCallable(
            orgAdminUid,
            { role: "org_admin", orgId },
            {
              orgId: "org-other",
              name: "Illegal Programme",
              country: "SG",
            },
          ),
        ),
      (err) => err instanceof HttpsError && err.code === "permission-denied",
    );
  });

  await t.test("org admin assigns programme admin", async () => {
    const result = await assignProgrammeAdminHandler(
      mockCallable(
        orgAdminUid,
        { role: "org_admin", orgId },
        { orgId, programmeId, targetUid: progAdminUid },
      ),
    );

    assert.equal(result.programmeId, programmeId);
    assert.equal(result.claims.role, "programme_admin");
    assert.equal(result.claims.programmeId, programmeId);

    const authUser = await getAuth().getUser(progAdminUid);
    assert.equal(authUser.customClaims.programmeId, programmeId);
  });

  await t.test("org admin verifies contributor in org scope", async () => {
    await db.collection("contributors").doc(contributorId).set({
      id: contributorId,
      orgId,
      name: "Phase3 Mentor",
      role: "mentor",
      status: "Pending",
    });

    const result = await verifyContributorHandler(
      mockCallable(
        orgAdminUid,
        { role: "org_admin", orgId },
        { orgId, contributorId, status: "Verified" },
      ),
    );

    assert.equal(result.status, "Verified");
    const contributorSnap = await db.collection("contributors").doc(contributorId).get();
    assert.equal(contributorSnap.data().status, "Verified");
  });

  await t.test("startup cannot call platform admin create organisation", async () => {
    await assert.rejects(
      () =>
        createOrganisationHandler(
          mockCallable(
            "phase3-startup",
            { role: "startup", entityId: "comp-x" },
            { name: "Hack Org", country: "SG" },
          ),
        ),
      (err) => err instanceof HttpsError && err.code === "permission-denied",
    );
  });
});
