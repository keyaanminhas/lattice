/**
 * Optional Gemini text generation (USE_GEMINI_SUMMARIES=true + GEMINI_API_KEY).
 * Mirrors Python main.py gemini-3.1-flash-lite usage; falls back to rule-based output.
 */

const DEFAULT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.0-flash-lite";
const INSIGHT_SEVERITIES = new Set(["low", "medium", "high"]);

export function useGeminiSummaries() {
  return (
    String(process.env.USE_GEMINI_SUMMARIES || "false").toLowerCase() === "true" &&
    Boolean(process.env.GEMINI_API_KEY)
  );
}

export function isGeminiTextSkipped() {
  if (!useGeminiSummaries()) return true;
  const emu =
    String(process.env.USE_FIRESTORE_EMULATOR || "").toLowerCase() === "true" ||
    Boolean(process.env.FIRESTORE_EMULATOR_HOST);
  return emu;
}

function stripCodeFences(raw) {
  let cleaned = String(raw || "").trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }
  return cleaned.trim();
}

export function extractJsonPayload(raw, expectedType) {
  const cleaned = stripCodeFences(raw);
  const starts = [0, ...[...cleaned].map((c, i) => (c === "{" || c === "[" ? i : -1)).filter((i) => i >= 0)];
  const seen = new Set();

  for (const position of starts) {
    if (seen.has(position)) continue;
    seen.add(position);
    try {
      const payload = JSON.parse(cleaned.slice(position));
      if (expectedType === "array" && Array.isArray(payload)) return payload;
      if (expectedType === "object" && payload && typeof payload === "object" && !Array.isArray(payload)) {
        return payload;
      }
    } catch {
      /* try next position */
    }
  }
  throw new Error("AI response did not contain the expected JSON payload.");
}

export async function geminiGenerateText(prompt, model = DEFAULT_MODEL) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: String(prompt).slice(0, 28000) }] }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini generateContent failed: ${res.status} ${errText.slice(0, 200)}`);
  }

  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

export async function geminiGenerateJson(prompt, expectedType, normaliser, model = DEFAULT_MODEL) {
  const raw = await geminiGenerateText(prompt, model);
  const extracted = extractJsonPayload(raw, expectedType);
  return normaliser(extracted);
}

function coerceStringList(value, fieldName) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${fieldName} must be a list of strings.`);
  }
  return value.map((s) => s.trim()).filter(Boolean);
}

function coerceNumber(value, fieldName, min, max) {
  const n = Number(value);
  if (Number.isNaN(n) || n < min || n > max) {
    throw new Error(`${fieldName} must be between ${min} and ${max}.`);
  }
  return Number.isInteger(n) ? n : Number(n.toFixed(2));
}

export function normaliseProfilePayload(payload) {
  const required = [
    "summary",
    "autoTags",
    "suggestedProgrammeTypes",
    "riskFlags",
    "profileCompletenessScore",
    "readinessScore",
  ];
  for (const field of required) {
    if (!(field in payload)) throw new Error(`Profile missing field: ${field}`);
  }
  if (!String(payload.summary).trim()) throw new Error("summary must be non-empty");

  return {
    summary: String(payload.summary).trim(),
    autoTags: coerceStringList(payload.autoTags, "autoTags"),
    suggestedProgrammeTypes: coerceStringList(
      payload.suggestedProgrammeTypes,
      "suggestedProgrammeTypes",
    ),
    riskFlags: coerceStringList(payload.riskFlags, "riskFlags"),
    profileCompletenessScore: coerceNumber(
      payload.profileCompletenessScore,
      "profileCompletenessScore",
      0,
      100,
    ),
    readinessScore: coerceNumber(payload.readinessScore, "readinessScore", 0, 10),
  };
}

export function normaliseInsightsPayload(payload) {
  if (!Array.isArray(payload) || payload.length !== 4) {
    throw new Error("Insights payload must be an array with exactly 4 objects.");
  }
  const fields = ["type", "title", "description", "severity"];
  return payload.map((item, index) => {
    if (!item || typeof item !== "object") throw new Error(`Insight ${index + 1} must be an object.`);
    const out = {};
    for (const field of fields) {
      if (!String(item[field] || "").trim()) {
        throw new Error(`Insight ${index + 1} field ${field} must be non-empty.`);
      }
      out[field] = String(item[field]).trim();
    }
    const severity = out.severity.toLowerCase();
    if (!INSIGHT_SEVERITIES.has(severity)) {
      throw new Error(`Insight ${index + 1} severity invalid.`);
    }
    out.severity = severity;
    return out;
  });
}

export function buildStartupSummaryPrompt(startup) {
  const safe = JSON.stringify(startup, (_k, v) => (v === undefined ? null : v));
  return `You are an AI assistant for a programme-first startup ecosystem platform.
Analyse this startup profile and return ONLY a JSON object with:
summary, autoTags, suggestedProgrammeTypes, riskFlags, profileCompletenessScore, readinessScore.

Startup: ${safe}`;
}

export function buildAiInsightsPrompt(stats) {
  return `You are the AI ecosystem analyst for Lattice, a programme-first startup relationship orchestration platform.
Review these ecosystem statistics:
${JSON.stringify(stats, null, 2)}

Return ONLY a JSON array with exactly 4 objects. Each object must include:
type, title, description, severity (low|medium|high).

Cover:
1. a programme supply-demand gap
2. a mentor capacity warning
3. a reusable outcome pattern
4. a strategic recommendation for organisation admins`;
}

export function buildProfileFallback(entity) {
  const name = entity.name || entity.companyName || "This startup";
  const industry = entity.industry || entity.sector || "unknown sector";
  const stage = entity.stage || "unknown stage";
  const country = entity.country || "an unspecified country";
  const supportNeeds = [...(entity.supportNeeds || [])];

  const suggestedProgrammeTypes = [];
  if (["Idea", "Pre-seed", "Seed", "MVP"].includes(stage)) {
    suggestedProgrammeTypes.push("Accelerator");
  }
  const tokenBlob = `${name} ${industry} ${stage} ${country} ${supportNeeds.join(" ")}`.toLowerCase();
  if (/fintech|payments|regulatory/.test(tokenBlob)) suggestedProgrammeTypes.push("Market Access Programme");
  if (/health|med|clinical|healthtech/.test(tokenBlob)) {
    suggestedProgrammeTypes.push("Healthcare Accelerator");
  }
  if (!suggestedProgrammeTypes.length) suggestedProgrammeTypes.push("Mentorship Cohort");

  const riskFlags = [];
  if (entity.verificationStatus !== "Verified") riskFlags.push("Startup profile is not verified yet.");
  if (!entity.productDescription) {
    riskFlags.push("Startup profile does not show a clear product or prototype.");
  }
  if (!supportNeeds.length) riskFlags.push("Startup support needs are not fully articulated.");

  let completeness = 65;
  if (entity.productDescription) completeness += 15;
  if (entity.verificationStatus === "Verified") completeness += 10;
  if (supportNeeds.length) completeness += 5;

  let readiness = 5;
  if (["MVP", "Seed", "Growth"].includes(stage)) readiness += 1.5;
  if (entity.productDescription) readiness += 1.5;
  if (entity.verificationStatus === "Verified") readiness += 1;
  if (supportNeeds.length) readiness += 0.5;

  return {
    summary: `${name} is a ${stage} ${industry} startup in ${country} seeking ${
      supportNeeds.slice(0, 3).join(", ") || "programme support"
    }.`,
    autoTags: [industry, stage, country, ...supportNeeds.slice(0, 3)].filter(Boolean),
    suggestedProgrammeTypes,
    riskFlags: riskFlags.length ? riskFlags : ["Profile is broadly suitable for programme matching."],
    profileCompletenessScore: Math.min(100, Math.round(completeness * 100) / 100),
    readinessScore: Math.min(10, Math.round(readiness * 100) / 100),
  };
}

export function buildAiInsightsFallback(stats) {
  const topGap = (stats.programmeGapReports || []).sort(
    (a, b) => (b.gaps?.length || 0) - (a.gaps?.length || 0),
  )[0];

  return [
    {
      type: "programme_supply_gap",
      title: "Programme supply gap",
      description:
        topGap?.gaps?.[0]?.description ||
        `${stats.openProgrammes || 0} open programmes vs ${stats.pendingApplications || 0} pending applications.`,
      severity: topGap?.gaps?.length ? "high" : "low",
    },
    {
      type: "mentor_capacity",
      title: "Mentor capacity",
      description: `${stats.programmePoolAssignments || 0} approved pool assignments; expand mentor pools where gaps exist.`,
      severity: (stats.programmePoolAssignments || 0) < 5 ? "high" : "medium",
    },
    {
      type: "outcome_pattern",
      title: "Outcome success pattern",
      description: `${stats.successRate || 0}% success rate across ${stats.totalOutcomes || 0} recorded outcomes.`,
      severity: (stats.successRate || 0) < 50 ? "medium" : "low",
    },
    {
      type: "admin_recommendation",
      title: "Admin recommendation",
      description: "Use graph evidence when approving recommendations; run rebuildGraphRag after bulk data imports.",
      severity: "medium",
    },
  ];
}

export async function summariseStartupWithGemini(startup) {
  if (isGeminiTextSkipped()) {
    return { profile: buildProfileFallback(startup), engine: "rule-based-v1" };
  }
  try {
    const profile = await geminiGenerateJson(
      buildStartupSummaryPrompt(startup),
      "object",
      normaliseProfilePayload,
    );
    return { profile, engine: "gemini-text-v1" };
  } catch (err) {
    console.warn("summariseStartupWithGemini fallback:", err.message);
    return { profile: buildProfileFallback(startup), engine: "rule-based-v1", geminiError: err.message };
  }
}

export async function generateAiInsightsWithGemini(stats) {
  if (isGeminiTextSkipped()) {
    return { insights: buildAiInsightsFallback(stats), engine: "rule-based-v1" };
  }
  try {
    const insights = await geminiGenerateJson(
      buildAiInsightsPrompt(stats),
      "array",
      normaliseInsightsPayload,
    );
    return { insights, engine: "gemini-text-v1" };
  } catch (err) {
    console.warn("generateAiInsightsWithGemini fallback:", err.message);
    return {
      insights: buildAiInsightsFallback(stats),
      engine: "rule-based-v1",
      geminiError: err.message,
    };
  }
}
