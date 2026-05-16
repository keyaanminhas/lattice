import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp } from "firebase-admin/app";
import {
  configureEmulatorEnv,
  isEmulatorPortOpen,
  teardownFirebaseApps,
} from "../helpers/emulator.js";
import { getRbacDb } from "../../src/db.js";
import { upsertGraphEdge, getProgrammeSubgraph, listGraphEdges } from "../../src/ai/graphService.js";

// Port probe only at load time — no Firebase init (prevents open-handle hangs).
const emulatorUp = await isEmulatorPortOpen();

test.after(async () => {
  await teardownFirebaseApps();
});

test("graph service integration", { skip: !emulatorUp }, async () => {
  configureEmulatorEnv();
  await teardownFirebaseApps();
  initializeApp({ projectId: "lattice-2026" });
  const db = getRbacDb();

  const programmeId = `prog-graph-${Date.now()}`;
  const startupId = `startup-graph-${Date.now()}`;

  await db.collection("programmes").doc(programmeId).set({
    id: programmeId,
    orgId: "org-test",
    name: "Graph Test Programme",
    targetSectors: ["HealthTech"],
    country: "SG",
  });

  await db.collection("startups").doc(startupId).set({
    id: startupId,
    name: "Graph Test Startup",
    sector: "HealthTech",
    country: "SG",
    supportNeeds: ["Mentorship"],
  });

  await upsertGraphEdge(db, {
    sourceType: "startup",
    sourceId: startupId,
    edgeType: "APPLIED_TO",
    targetType: "programme",
    targetId: programmeId,
    programmeId,
  });

  const edges = await listGraphEdges(db, { programmeId, edgeType: "APPLIED_TO" });
  assert.ok(edges.length >= 1);

  const subgraph = await getProgrammeSubgraph(db, programmeId);
  assert.equal(subgraph.programme.id, programmeId);
  assert.ok(subgraph.counts.graphEdges >= 1);
});
