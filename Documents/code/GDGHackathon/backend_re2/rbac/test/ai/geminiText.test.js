import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProfileFallback,
  buildAiInsightsFallback,
  extractJsonPayload,
  normaliseProfilePayload,
  normaliseInsightsPayload,
  isGeminiTextSkipped,
} from "../../src/ai/geminiText.js";

test("extractJsonPayload parses fenced JSON object", () => {
  const raw = '```json\n{"summary":"x","autoTags":[],"suggestedProgrammeTypes":[],"riskFlags":[],"profileCompletenessScore":80,"readinessScore":7}\n```';
  const obj = extractJsonPayload(raw, "object");
  const profile = normaliseProfilePayload(obj);
  assert.equal(profile.summary, "x");
});

test("buildProfileFallback returns required fields", () => {
  const p = buildProfileFallback({
    name: "MediScan",
    sector: "HealthTech",
    stage: "Seed",
    country: "SG",
    supportNeeds: ["Regulatory"],
  });
  assert.ok(p.summary.includes("MediScan"));
  assert.ok(p.autoTags.length >= 1);
});

test("buildAiInsightsFallback returns 4 insights", () => {
  const insights = buildAiInsightsFallback({ openProgrammes: 2, programmePoolAssignments: 1 });
  assert.equal(insights.length, 4);
  assert.ok(normaliseInsightsPayload(insights));
});

test("isGeminiTextSkipped when summaries flag off", () => {
  const prev = process.env.USE_GEMINI_SUMMARIES;
  process.env.USE_GEMINI_SUMMARIES = "false";
  assert.equal(isGeminiTextSkipped(), true);
  if (prev !== undefined) process.env.USE_GEMINI_SUMMARIES = prev;
  else delete process.env.USE_GEMINI_SUMMARIES;
});
