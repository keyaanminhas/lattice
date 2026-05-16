import test from "node:test";
import assert from "node:assert/strict";
import {
  cosineSimilarity,
  getEmbedding,
  buildStartupText,
} from "../../src/ai/embeddings.js";
import { runEmbeddingSelfTest } from "../../src/ai/latticeGraph.js";

test("getEmbedding returns normalized vector", async () => {
  const v = await getEmbedding("healthtech startup singapore");
  assert.equal(v.length, 64);
  const norm = Math.hypot(...v);
  assert.ok(Math.abs(norm - 1) < 0.01 || norm === 0);
});

test("similar texts have higher cosine similarity", () => {
  const result = runEmbeddingSelfTest();
  assert.ok(result.passes, `expected ab > ac, got ab=${result.ab}, ac=${result.ac}`);
});

test("buildStartupText includes core fields", () => {
  const text = buildStartupText({
    name: "MediScan",
    sector: "HealthTech",
    supportNeeds: ["Regulatory"],
  });
  assert.match(text, /MediScan/);
  assert.match(text, /Regulatory/);
});

test("cosineSimilarity is symmetric", async () => {
  const a = await getEmbedding("alpha beta");
  const b = await getEmbedding("beta alpha");
  assert.equal(cosineSimilarity(a, b), cosineSimilarity(b, a));
});
