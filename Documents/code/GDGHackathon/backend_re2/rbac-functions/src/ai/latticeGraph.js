import {
  buildContributorText,
  buildProgrammeText,
  buildStartupText,
  cosineSimilarity,
  ensureEmbedding,
  getLocalEmbedding,
} from "./embeddings.js";
/** Graph RAG on by default; set USE_GRAPH_RAG=false to disable. */
function useGraphRag() {
  return String(process.env.USE_GRAPH_RAG ?? "true").toLowerCase() !== "false";
}

function tokenSet(values) {
  const tokens = new Set();
  for (const value of values || []) {
    for (const t of String(value).toLowerCase().match(/[a-z0-9]+/g) || []) {
      tokens.add(t);
    }
  }
  return tokens;
}

function overlapScore(sourceValues, targetValues, maxPoints) {
  const left = tokenSet(sourceValues);
  const right = tokenSet(targetValues);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  for (const t of left) {
    if (right.has(t)) overlap += 1;
  }
  return Number(((overlap / left.size) * maxPoints).toFixed(2));
}

function readThresholds(platformConfig) {
  const ai = platformConfig?.aiThresholds || {};
  return {
    startupProgramme: Number(ai.startupProgrammeMinScore ?? 60),
    mentorMatch: Number(ai.mentorMatchMinScore ?? 70),
    contributorProgramme: Number(ai.contributorProgrammeMinScore ?? 60),
  };
}

export async function scoreContributorProgrammeFit(db, contributor, programme, platformConfig) {
  const contributorVec = await ensureEmbedding(
    db,
    "contributors",
    contributor.id,
    contributor,
    buildContributorText,
  );
  const programmeVec = await ensureEmbedding(
    db,
    "programmes",
    programme.id,
    programme,
    buildProgrammeText,
  );

  const semanticScore = Number((cosineSimilarity(contributorVec, programmeVec) * 100).toFixed(2));
  const ruleScore = overlapScore(
    [...(contributor.expertise || []), ...(contributor.supportedStages || [])],
    [...(programme.targetSectors || []), ...(programme.targetStages || []), programme.country],
    40,
  );
  const graphScore = 5;
  const finalScore = Number(Math.min(100, semanticScore * 0.5 + ruleScore + graphScore).toFixed(2));
  const thresholds = readThresholds(platformConfig);

  const riskFlags = [];
  if (contributor.availability === "Unavailable") {
    riskFlags.push("Contributor is unavailable.");
  }
  if (contributor.verificationStatus && contributor.verificationStatus !== "Verified") {
    riskFlags.push("Contributor is not verified yet.");
  }

  const contributorType =
    (contributor.contributorTypes || [])[0] ||
    contributor.role ||
    "Mentor";

  return {
    matchScore: finalScore,
    scoreBreakdown: { ruleScore, semanticScore, graphScore, finalScore },
    explanation: `${contributorType} ${contributor.name} fit ${finalScore}/100 for ${programme.name}.`,
    riskFlags,
    contributorType,
    passesThreshold: finalScore >= thresholds.contributorProgramme,
  };
}

export async function scoreStartupProgrammeFit(db, startup, programme, platformConfig) {
  const startupVec = await ensureEmbedding(db, "startups", startup.id, startup, buildStartupText);
  const programmeVec = await ensureEmbedding(
    db,
    "programmes",
    programme.id,
    programme,
    buildProgrammeText,
  );

  const semanticScore = Number((cosineSimilarity(startupVec, programmeVec) * 100).toFixed(2));
  const ruleScore = overlapScore(
    [startup.sector, startup.industry, startup.stage, startup.country],
    [
      ...(programme.targetSectors || []),
      ...(programme.targetStages || []),
      programme.country,
    ],
    40,
  );

  let graphScore = 0;
  let graphEvidence = {
    summary: "Graph RAG skipped (lightweight scoring mode).",
    edges: [],
    pastOutcomeSignals: [],
    riskFlags: [],
  };

  if (useGraphRag()) {
    const { getStartupProgrammeGraphContext } = await import("./graphService.js");
    const graphContext = await getStartupProgrammeGraphContext(db, startup.id, programme.id);
    const edgeBoost = graphContext.evidenceEdges.length * 3;
    const poolBoost = Math.min(8, (graphContext.poolContributorCount || 0) * 0.5);
    const acceptedBoost = graphContext.evidenceEdges.some((e) => e.edgeType === "ACCEPTED_INTO")
      ? 5
      : 0;
    graphScore = Math.min(
      20,
      Number((edgeBoost + poolBoost + acceptedBoost + graphContext.positiveOutcomeSignals.length * 2).toFixed(2)),
    );
    graphEvidence = {
      summary: `Graph RAG: ${graphContext.edgeCount} programme edges, ${graphContext.evidenceEdges.length} linked to startup, ${graphContext.poolContributorCount} pool mentors.`,
      edges: graphContext.evidenceEdges.map((e) => `${e.edgeType}:${e.sourceId}->${e.targetId}`),
      pastOutcomeSignals: graphContext.positiveOutcomeSignals,
      riskFlags: graphContext.edgeCount === 0 ? ["Graph is empty — run rebuildGraphRag."] : [],
    };
  }

  const finalScore = Number(Math.min(100, semanticScore * 0.5 + ruleScore + graphScore).toFixed(2));
  const thresholds = readThresholds(platformConfig);

  const riskFlags = [];
  if (startup.verificationStatus !== "Verified") {
    riskFlags.push("Startup profile is not verified yet.");
  }
  if (finalScore < thresholds.startupProgramme) {
    riskFlags.push("Overall fit score is below programme threshold.");
  }

  return {
    matchScore: finalScore,
    scoreBreakdown: {
      ruleScore,
      semanticScore,
      graphScore,
      finalScore,
    },
    graphEvidence: { ...graphEvidence, riskFlags },
    explanation: `Semantic fit ${semanticScore}/100, rule fit ${ruleScore}/40, graph evidence +${graphScore}.`,
    riskFlags,
    passesThreshold: finalScore >= thresholds.startupProgramme,
  };
}

export async function scoreStartupMentorFit(db, startup, mentor, programme) {
  const startupVec = await ensureEmbedding(db, "startups", startup.id, startup, buildStartupText);
  const mentorVec = await ensureEmbedding(
    db,
    "contributors",
    mentor.id,
    mentor,
    buildContributorText,
  );
  const semanticScore = Number((cosineSimilarity(startupVec, mentorVec) * 100).toFixed(2));
  const ruleScore = overlapScore(startup.supportNeeds, mentor.expertise, 30);
  const graphScore = 5;
  const finalScore = Number(Math.min(100, semanticScore * 0.6 + ruleScore + graphScore).toFixed(2));

  return {
    matchScore: finalScore,
    scoreBreakdown: { ruleScore, semanticScore, graphScore, finalScore },
    explanation: `Mentor ${mentor.name} semantic overlap ${semanticScore}/100 for ${programme.name}.`,
    riskFlags: mentor.availability === "Unavailable" ? ["Contributor is unavailable."] : [],
    passesThreshold: finalScore >= 70,
  };
}

export async function loadPlatformConfig(db) {
  const snap = await db.collection("platform_config").doc("global").get();
  return snap.exists ? snap.data() : {};
}

/**
 * Quick embedding self-test for CI (no Firestore).
 */
export function runEmbeddingSelfTest() {
  const a = getLocalEmbedding("healthtech startup singapore seed");
  const b = getLocalEmbedding("health tech accelerator singapore");
  const c = getLocalEmbedding("fintech payments europe");
  const ab = cosineSimilarity(a, b);
  const ac = cosineSimilarity(a, c);
  return { ab, ac, passes: ab > ac };
}
