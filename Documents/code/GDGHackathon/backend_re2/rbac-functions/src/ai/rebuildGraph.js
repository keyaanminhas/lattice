import { getRbacDb } from "../db.js";
import { upsertGraphEdge } from "./graphService.js";

const BATCH = 400;

async function commitBatch(batch, pending) {
  if (pending.length === 0) return 0;
  for (const op of pending) op(batch);
  await batch.commit();
  return pending.length;
}

/**
 * Rebuild graph_edges in rbac-new-db from operational collections (no Gemini, read-only on source logic).
 */
export async function rebuildGraphRag({ programmeId = null, clearFirst = false } = {}) {
  const db = getRbacDb();
  const stats = { edges: 0, cleared: 0 };

  if (clearFirst) {
    let query = db.collection("graph_edges");
    if (programmeId) query = query.where("programmeId", "==", programmeId);
    const snap = await query.get();
    for (let i = 0; i < snap.docs.length; i += BATCH) {
      const batch = db.batch();
      const chunk = snap.docs.slice(i, i + BATCH);
      for (const doc of chunk) batch.delete(doc.ref);
      await batch.commit();
      stats.cleared += chunk.length;
    }
  }

  const pending = [];
  let batch = db.batch();

  const flush = async () => {
    stats.edges += await commitBatch(
      batch,
      pending.splice(0, pending.length),
    );
    batch = db.batch();
  };

  const queueEdge = async (params) => {
    pending.push((b) => {
      const id = [
        "edge",
        params.sourceType,
        params.sourceId,
        params.edgeType,
        params.targetType,
        params.targetId,
      ]
        .map((p) => String(p).replace(/[^a-zA-Z0-9_-]/g, "-"))
        .join("__");
      b.set(db.collection("graph_edges").doc(id), {
        id,
        ...params,
        status: params.status || "active",
        weight: params.weight ?? 1,
        confidence: params.confidence ?? 1,
        createdFrom: params.createdFrom || "rebuildGraphRag",
        metadata: params.metadata || {},
        rebuiltAt: new Date().toISOString(),
      }, { merge: true });
    });
    if (pending.length >= BATCH) await flush();
  };

  let appsQuery = db.collection("applications");
  if (programmeId) appsQuery = appsQuery.where("programmeId", "==", programmeId);
  const apps = await appsQuery.get();
  for (const doc of apps.docs) {
    const a = doc.data();
    const pid = a.programmeId;
    const sid = a.startupId;
    if (!pid || !sid) continue;
    await queueEdge({
      sourceType: "startup",
      sourceId: sid,
      edgeType: "APPLIED_TO",
      targetType: "programme",
      targetId: pid,
      programmeId: pid,
      createdFromId: doc.id,
      metadata: { status: a.status },
    });
    if (a.status === "Accepted") {
      await queueEdge({
        sourceType: "startup",
        sourceId: sid,
        edgeType: "ACCEPTED_INTO",
        targetType: "programme",
        targetId: pid,
        programmeId: pid,
        createdFromId: doc.id,
      });
    }
  }

  let poolsQuery = db.collection("programmeContributors").where("status", "==", "Approved");
  if (programmeId) poolsQuery = poolsQuery.where("programmeId", "==", programmeId);
  const pools = await poolsQuery.get();
  for (const doc of pools.docs) {
    const p = doc.data();
    if (!p.programmeId || !p.contributorId) continue;
    await queueEdge({
      sourceType: "contributor",
      sourceId: p.contributorId,
      edgeType: "ATTACHED_TO",
      targetType: "programme",
      targetId: p.programmeId,
      programmeId: p.programmeId,
      createdFromId: doc.id,
      metadata: { contributorType: p.contributorType },
    });
  }

  let relQuery = db.collection("relationships");
  if (programmeId) relQuery = relQuery.where("programmeId", "==", programmeId);
  const rels = await relQuery.get();
  for (const doc of rels.docs) {
    const r = doc.data();
    if (!r.programmeId || !r.sourceEntityId || !r.targetEntityId) continue;
    const edgeType = r.relationshipType === "Startup-to-Mentor" ? "MATCHED_WITH" : "MATCHED_WITH";
    await queueEdge({
      sourceType: "startup",
      sourceId: r.sourceEntityId,
      edgeType,
      targetType: "contributor",
      targetId: r.targetEntityId,
      programmeId: r.programmeId,
      createdFromId: doc.id,
      metadata: { relationshipType: r.relationshipType, status: r.status },
    });
  }

  await flush();

  await db.collection("_migration_meta").doc("rebuildGraphRag-v1").set(
    {
      completedAt: new Date().toISOString(),
      programmeId: programmeId || "all",
      stats,
      database: process.env.RBAC_FIRESTORE_DATABASE || "rbac-new-db",
    },
    { merge: true },
  );

  return stats;
}
