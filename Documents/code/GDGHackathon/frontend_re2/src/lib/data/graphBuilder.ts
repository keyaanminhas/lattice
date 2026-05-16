import {
  getContributor,
  getProgramme,
  getStartup,
  listApplicationsForProgramme,
  listGraphEdgesForProgramme,
  listPendingMentorRecommendations,
  listProgrammePool,
  type DocRow,
} from "@/lib/data/firestoreQueries";

export type GraphNodeKind = "programme" | "startup" | "contributor";

export type GraphNode = {
  id: string;
  label: string;
  kind: GraphNodeKind;
  subtitle?: string;
};

export type GraphLinkKind =
  | "applied"
  | "accepted"
  | "pool"
  | "match_pending"
  | "match_active"
  | "graph";

export type GraphLink = {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: GraphLinkKind;
};

const EDGE_LABELS: Record<string, string> = {
  APPLIED_TO: "Applied",
  ACCEPTED_INTO: "Accepted",
  ATTACHED_TO: "In pool",
  MATCHED_WITH: "Matched",
  OWNS: "Owns",
  PRODUCED_OUTCOME: "Outcome",
  HAS_CONFLICT: "Conflict",
};

function nodeKey(kind: GraphNodeKind, id: string) {
  return `${kind}:${id}`;
}

export async function buildProgrammeGraphData(programmeId: string): Promise<{
  nodes: GraphNode[];
  links: GraphLink[];
  programmeName: string;
}> {
  const [programme, applications, pool, pendingMatches, graphEdges] = await Promise.all([
    getProgramme(programmeId),
    listApplicationsForProgramme(programmeId),
    listProgrammePool(programmeId),
    listPendingMentorRecommendations(programmeId),
    listGraphEdgesForProgramme(programmeId),
  ]);

  const programmeName = programme ? String(programme.name) : programmeId;
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];

  const progKey = nodeKey("programme", programmeId);
  nodes.set(progKey, {
    id: progKey,
    label: programmeName,
    kind: "programme",
    subtitle: programme ? String(programme.status) : undefined,
  });

  async function ensureStartup(startupId: string) {
    const key = nodeKey("startup", startupId);
    if (nodes.has(key)) return key;
    const s = await getStartup(startupId);
    nodes.set(key, {
      id: key,
      label: s ? String(s.name) : startupId,
      kind: "startup",
      subtitle: s ? String(s.sector) : undefined,
    });
    return key;
  }

  async function ensureContributor(contributorId: string) {
    const key = nodeKey("contributor", contributorId);
    if (nodes.has(key)) return key;
    const c = await getContributor(contributorId);
    nodes.set(key, {
      id: key,
      label: c ? String(c.name) : contributorId,
      kind: "contributor",
      subtitle: c ? String(c.role) : undefined,
    });
    return key;
  }

  for (const app of applications) {
    const sid = String(app.startupId);
    const sKey = await ensureStartup(sid);
    const accepted = app.status === "Accepted";
    links.push({
      id: `app-${app.id}`,
      source: sKey,
      target: progKey,
      label: accepted ? "Accepted" : String(app.status ?? "Applied"),
      kind: accepted ? "accepted" : "applied",
    });
  }

  for (const p of pool.filter((row) => row.status === "Approved")) {
    const cid = String(p.contributorId);
    const cKey = await ensureContributor(cid);
    links.push({
      id: `pool-${p.id}`,
      source: cKey,
      target: progKey,
      label: "Mentor pool",
      kind: "pool",
    });
  }

  for (const rec of pendingMatches) {
    const sKey = await ensureStartup(String(rec.sourceEntityId));
    const cKey = await ensureContributor(String(rec.targetEntityId));
    links.push({
      id: `rec-${rec.id}`,
      source: sKey,
      target: cKey,
      label: `Match ${rec.matchScore ?? "?"}`,
      kind: "match_pending",
    });
  }

  for (const edge of graphEdges as DocRow[]) {
    const edgeType = String(edge.edgeType ?? "LINK");
    const label = EDGE_LABELS[edgeType] ?? edgeType.replace(/_/g, " ");

    let source = progKey;
    let target = progKey;

    if (edge.sourceType === "startup") {
      source = await ensureStartup(String(edge.sourceId));
    } else if (edge.sourceType === "contributor") {
      source = await ensureContributor(String(edge.sourceId));
    } else if (edge.sourceType === "programme") {
      source = nodeKey("programme", String(edge.sourceId));
    }

    if (edge.targetType === "programme") {
      target = nodeKey("programme", String(edge.targetId));
      if (!nodes.has(target) && String(edge.targetId) === programmeId) {
        nodes.set(target, nodes.get(progKey)!);
      }
    } else if (edge.targetType === "startup") {
      target = await ensureStartup(String(edge.targetId));
    } else if (edge.targetType === "contributor") {
      target = await ensureContributor(String(edge.targetId));
    }

    if (source !== target) {
      links.push({
        id: `edge-${edge.id}`,
        source,
        target,
        label,
        kind: "graph",
      });
    }
  }

  return {
    nodes: [...nodes.values()],
    links,
    programmeName,
  };
}
