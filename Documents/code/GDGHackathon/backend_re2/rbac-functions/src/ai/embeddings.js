import { createHash } from "node:crypto";
import { getGeminiEmbedding, useGeminiEmbeddings } from "./geminiEmbeddings.js";

const FALLBACK_DIM = 64;

/**
 * Local deterministic embedding (default — no API cost).
 */
export function getLocalEmbedding(text) {
  const tokens = String(text || "")
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  if (!tokens?.length) {
    return new Array(FALLBACK_DIM).fill(0);
  }

  const vector = new Array(FALLBACK_DIM).fill(0);
  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest("hex");
    const index = Number.parseInt(digest.slice(0, 8), 16) % FALLBACK_DIM;
    vector[index] += 1;
  }

  const norm = Math.hypot(...vector);
  if (norm === 0) return vector;
  return vector.map((v) => Number((v / norm).toFixed(6)));
}

/** Uses Gemini when USE_GEMINI_EMBEDDINGS=true, else local vectors. */
export async function getEmbedding(text) {
  if (useGeminiEmbeddings()) {
    try {
      return await getGeminiEmbedding(text);
    } catch {
      return getLocalEmbedding(text);
    }
  }
  return getLocalEmbedding(text);
}

export function cosineSimilarity(a, b) {
  if (!a?.length || !b?.length) return 0;
  if (a.length !== b.length) {
    const min = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < min; i += 1) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function buildStartupText(startup) {
  return [
    `Startup: ${startup.name || ""}`,
    `Sector: ${startup.sector || startup.industry || ""}`,
    `Stage: ${startup.stage || ""}`,
    `Country: ${startup.country || ""}`,
    `Needs: ${(startup.supportNeeds || []).join(", ")}`,
    `Problem: ${startup.problemStatement || ""}`,
    `Product: ${startup.productDescription || ""}`,
  ].join(". ");
}

export function buildProgrammeText(programme) {
  return [
    `Programme: ${programme.name || ""}`,
    `Type: ${programme.type || ""}`,
    `Sectors: ${(programme.targetSectors || []).join(", ")}`,
    `Stages: ${(programme.targetStages || []).join(", ")}`,
    `Country: ${programme.country || programme.region || ""}`,
    `Outcomes: ${(programme.expectedOutcomes || []).join(", ")}`,
  ].join(". ");
}

export function buildContributorText(contributor) {
  return [
    `Contributor: ${contributor.name || ""}`,
    `Types: ${(contributor.contributorTypes || []).join(", ")}`,
    `Expertise: ${(contributor.expertise || []).join(", ")}`,
    `Stages: ${(contributor.supportedStages || []).join(", ")}`,
  ].join(". ");
}

export async function ensureEmbedding(db, collection, docId, data, textBuilder, options = {}) {
  if (data.embeddingVector?.length) return data.embeddingVector;
  const vector = await getEmbedding(textBuilder(data));
  const persist =
    options.persist ??
    String(process.env.PERSIST_EMBEDDINGS || "false").toLowerCase() === "true";
  if (persist && db && collection && docId) {
    await db.collection(collection).doc(docId).set({ embeddingVector: vector }, { merge: true });
  }
  return vector;
}
