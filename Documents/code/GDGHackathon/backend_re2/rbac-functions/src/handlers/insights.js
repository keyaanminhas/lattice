import { HttpsError } from "firebase-functions/v2/https";
import { requireRole, requireProgrammeAdmin } from "../auth/middleware.js";
import { ROLES, ADMIN_ROLES } from "../auth/roles.js";
import { getRbacDb } from "../db.js";
import { getProgrammeSubgraph } from "../ai/graphService.js";
import { parseData, requireField } from "../utils/parse.js";
import { generateAiInsightsWithGemini } from "../ai/geminiText.js";

const MAX_LIST = 500;

async function countCollection(db, name, filterFn = null) {
  const snap = await db.collection(name).limit(MAX_LIST).get();
  const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return filterFn ? docs.filter(filterFn) : docs;
}

function requireAnyAdmin(request) {
  const ctx = requireRole(request, [
    ROLES.PLATFORM_ADMIN,
    ROLES.ORG_ADMIN,
    ROLES.PROGRAMME_ADMIN,
  ]);
  if (!ADMIN_ROLES.has(ctx.role)) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }
  return ctx;
}

function programmeGraphGaps(subgraph) {
  const gaps = [];
  const { counts } = subgraph;
  if (counts.graphEdges === 0) {
    gaps.push({
      type: "graph_empty",
      title: "No graph edges",
      description: "Run rebuildGraphRag to materialise programme relationships.",
      severity: "high",
    });
  }
  if (counts.attachedContributors < 3) {
    gaps.push({
      type: "mentor_capacity",
      title: "Thin mentor pool",
      description: `Only ${counts.attachedContributors} approved contributors in pool.`,
      severity: "medium",
    });
  }
  if (counts.acceptedStartups === 0) {
    gaps.push({
      type: "startup_pipeline",
      title: "No accepted startups",
      description: "Review pending applications to grow the cohort.",
      severity: "medium",
    });
  }
  return gaps;
}

export async function getProgrammeGraphViewHandler(request) {
  const data = parseData(request);
  const programmeId = requireField(data, "programmeId");
  requireProgrammeAdmin(request, programmeId);

  const db = getRbacDb();
  const subgraph = await getProgrammeSubgraph(db, programmeId);
  const graphInsights = programmeGraphGaps(subgraph);

  return {
    programme: subgraph.programme,
    counts: subgraph.counts,
    graphEvidence: {
      edges: subgraph.edges.slice(0, 8).map((e) => `${e.edgeType}:${e.sourceId}->${e.targetId}`),
      acceptedStartups: subgraph.acceptedApplications.length,
      poolSize: subgraph.pools.length,
    },
    graphInsights,
  };
}

export async function getDashboardStatsHandler(request) {
  requireAnyAdmin(request);
  const db = getRbacDb();

  const organisations = await countCollection(db, "organisations");
  const programmes = await countCollection(db, "programmes");
  const startups = await countCollection(db, "startups");
  const contributors = await countCollection(db, "contributors");
  const applications = await countCollection(db, "applications");
  const pools = await countCollection(db, "programmeContributors");
  const recommendations = await countCollection(db, "recommendations");
  const relationships = await countCollection(db, "relationships");
  const outcomes = await countCollection(db, "outcomes");
  const graphEdges = await countCollection(db, "graph_edges");

  const successfulOutcomes = outcomes.filter((o) => o.outcomeAchieved === "Yes").length;
  const successRate = outcomes.length
    ? Number(((successfulOutcomes / outcomes.length) * 100).toFixed(1))
    : 0;

  return {
    totalOrganisations: organisations.length,
    openProgrammes: programmes.filter((p) => ["Open", "Active"].includes(p.status)).length,
    totalStartups: startups.length,
    verifiedStartups: startups.filter((s) => s.verificationStatus === "Verified").length,
    totalContributors: contributors.length,
    programmePoolAssignments: pools.filter((p) => p.status === "Approved").length,
    pendingApplications: applications.filter((a) => a.status === "Pending Admin Review").length,
    acceptedApplications: applications.filter((a) => a.status === "Accepted").length,
    pendingRecommendations: recommendations.filter((r) => r.status === "Pending Approval")
      .length,
    activeRelationships: relationships.filter((r) => r.status === "Active").length,
    graphEdges: graphEdges.length,
    totalOutcomes: outcomes.length,
    successfulOutcomes,
    successRate,
  };
}

export async function getAiInsightsHandler(request) {
  requireAnyAdmin(request);
  const stats = await getDashboardStatsHandler(request);
  const db = getRbacDb();

  const programmes = await countCollection(db, "programmes");
  const programmeGapReports = [];
  for (const programme of programmes.filter((p) => ["Open", "Active"].includes(p.status)).slice(0, 10)) {
    try {
      const subgraph = await getProgrammeSubgraph(db, programme.id);
      programmeGapReports.push({
        programmeId: programme.id,
        programmeName: programme.name,
        counts: subgraph.counts,
        gaps: programmeGraphGaps(subgraph),
      });
    } catch {
      /* skip missing programme */
    }
  }

  const statsWithGaps = { ...stats, programmeGapReports };
  const { insights, engine, geminiError } = await generateAiInsightsWithGemini(statsWithGaps);

  return {
    insights,
    engine,
    ...(geminiError ? { geminiError } : {}),
    stats: statsWithGaps,
  };
}
