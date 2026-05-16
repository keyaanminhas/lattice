import test from "node:test";
import assert from "node:assert/strict";

test("meaningful profile fields affect scoring pipeline", async () => {
  const { runEmbeddingSelfTest } = await import("../../src/ai/latticeGraph.js");
  const r = runEmbeddingSelfTest();
  assert.ok(r.passes);
});

test("profileEngine exports analysis functions", async () => {
  const mod = await import("../../src/ai/profileEngine.js");
  assert.equal(typeof mod.analyzeStartupProfile, "function");
  assert.equal(typeof mod.analyzeContributorProfile, "function");
  assert.equal(typeof mod.handleStartupDocumentWrite, "function");
});
