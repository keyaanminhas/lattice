import { FieldValue } from "firebase-admin/firestore";

const GRAPH_EDGE_TYPES = new Set([
  "OWNS",
  "APPLIED_TO",
  "ACCEPTED_INTO",
  "ATTACHED_TO",
  "MATCHED_WITH",
  "PRODUCED_OUTCOME",
  "HAS_CONFLICT",
]);

function edgeDocId(sourceType, sourceId, edgeType, targetType, targetId) {
  return ["edge", sourceType, sourceId, edgeType, targetType, targetId]
    .map((p) => String(p).replace(/[^a-zA-Z0-9_-]/g, "-"))
    .join("__");
}

export async function upsertGraphEdge(
  db,
  {
    sourceType,
    sourceId,
    edgeType,
    targetType,
    targetId,
    programmeId = null,
    status = "active",
    weight = 1,
    confidence = 1,
    createdFrom = "",
    createdFromId = "",
    metadata = {},
  },
) {
  if (!GRAPH_EDGE_TYPES.has(edgeType)) {
    throw new Error(`Unsupported edge type: ${edgeType}`);
  }

  const id = edgeDocId(sourceType, sourceId, edgeType, targetType, targetId);
  const ref = db.collection("graph_edges").doc(id);
  const existing = await ref.get();
  const payload = {
    id,
    sourceType,
    sourceId,
    edgeType,
    targetType,
    targetId,
    programmeId,
    status,
    weight: Number(weight.toFixed(2)),
    confidence: Number(confidence.toFixed(2)),
    createdFrom,
    createdFromId,
    metadata,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (existing.exists) {
    await ref.set(payload, { merge: true });
  } else {
    await ref.set({ ...payload, createdAt: FieldValue.serverTimestamp() });
  }
  return payload;
}

export async function listGraphEdges(db, filters = {}) {
  let query = db.collection("graph_edges");
  for (const [key, value] of Object.entries(filters)) {
    if (value != null && value !== "") {
      query = query.where(key, "==", value);
    }
  }
  const snap = await query.get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function loadByIds(db, collection, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const docs = await Promise.all(unique.map((id) => db.collection(collection).doc(id).get()));
  return docs.filter((d) => d.exists).map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Programme subgraph for graph-RAG context retrieval.
 */
export async function getProgrammeSubgraph(db, programmeId) {
  const programmeSnap = await db.collection("programmes").doc(programmeId).get();
  if (!programmeSnap.exists) {
    throw new Error(`Programme ${programmeId} not found`);
  }
  const programme = { id: programmeSnap.id, ...programmeSnap.data() };

  const applicationsSnap = await db
    .collection("applications")
    .where("programmeId", "==", programmeId)
    .get();
  const applications = applicationsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const accepted = applications.filter((a) => a.status === "Accepted");
  const startups = await loadByIds(
    db,
    "startups",
    accepted.map((a) => a.startupId),
  );

  const poolsSnap = await db
    .collection("programmeContributors")
    .where("programmeId", "==", programmeId)
    .where("status", "==", "Approved")
    .get();
  const pools = poolsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const contributors = await loadByIds(
    db,
    "contributors",
    pools.map((p) => p.contributorId),
  );

  const relationshipsSnap = await db
    .collection("relationships")
    .where("programmeId", "==", programmeId)
    .get();
  const relationships = relationshipsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const edges = await listGraphEdges(db, { programmeId });

  return {
    programme,
    applications,
    acceptedApplications: accepted,
    startups,
    pools,
    contributors,
    relationships,
    edges,
    counts: {
      acceptedStartups: startups.length,
      attachedContributors: contributors.length,
      graphEdges: edges.length,
      activeRelationships: relationships.filter((r) =>
        ["Approved", "Active", "Needs Review"].includes(r.status),
      ).length,
    },
  };
}

/**
 * Fast graph-RAG context: programme edges + startup doc (2–3 reads, not full subgraph).
 */
export async function getStartupProgrammeGraphContext(db, startupId, programmeId) {
  const [startupSnap, programmeSnap, edges] = await Promise.all([
    db.collection("startups").doc(startupId).get(),
    db.collection("programmes").doc(programmeId).get(),
    listGraphEdges(db, { programmeId }),
  ]);

  if (!startupSnap.exists) throw new Error(`Startup ${startupId} not found`);
  if (!programmeSnap.exists) throw new Error(`Programme ${programmeId} not found`);

  const startup = { id: startupSnap.id, ...startupSnap.data() };
  const programme = { id: programmeSnap.id, ...programmeSnap.data() };

  const evidenceEdges = edges.filter(
    (e) => e.sourceId === startupId || e.targetId === startupId,
  );

  const poolEdges = edges.filter((e) => e.edgeType === "ATTACHED_TO");
  const acceptedEdges = edges.filter((e) => e.edgeType === "ACCEPTED_INTO");

  return {
    startup,
    programme,
    evidenceEdges,
    edgeCount: edges.length,
    poolContributorCount: poolEdges.length,
    acceptedStartupCount: acceptedEdges.length,
    positiveOutcomeSignals: edges
      .filter((e) => e.edgeType === "MATCHED_WITH" && e.sourceId === startupId)
      .slice(0, 5)
      .map((e) => `Prior match ${e.targetId} in programme ${programmeId}`),
    summary: {
      programmeId,
      totalEdges: edges.length,
      startupLinkedEdges: evidenceEdges.length,
    },
  };
}
