import { FieldValue } from "firebase-admin/firestore";
import { getRbacDb } from "../db.js";
import { buildContributorText, buildStartupText, ensureEmbedding } from "./embeddings.js";
import { scoreStartupProgrammeFit, loadPlatformConfig } from "./latticeGraph.js";
import { upsertGraphEdge } from "./graphService.js";
import { newId } from "../utils/ids.js";

const MAX_PROGRAMMES_PER_RUN = 15;

function meaningfulChange(before, after) {
  const beforeExists = before?.exists ?? false;
  const afterExists = after?.exists ?? false;
  if (!beforeExists && afterExists) return true;
  if (!afterExists) return false;
  const keys = ["name", "sector", "stage", "supportNeeds", "expertise", "problemStatement", "productDescription"];
  const b = before?.data() || {};
  const a = after.data() || {};
  return keys.some((k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
}

async function writeProgrammeRecommendation(db, programmeId, payload) {
  const recId = payload.id || newId("rec");
  const doc = {
    ...payload,
    id: recId,
    status: payload.status || "Pending Approval",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    source: "profileEngine-v1",
  };

  await db
    .collection("programmes")
    .doc(programmeId)
    .collection("recommendations")
    .doc(recId)
    .set(doc, { merge: true });

  await db.collection("recommendations").doc(recId).set(doc, { merge: true });
  return recId;
}

export async function analyzeStartupProfile(db, startupId, startupData) {
  const platformConfig = await loadPlatformConfig(db);
  const programmesSnap = await db
    .collection("programmes")
    .where("status", "in", ["Open", "Active", "Draft"])
    .limit(MAX_PROGRAMMES_PER_RUN)
    .get();

  const startup = { id: startupId, ...startupData };
  const created = [];

  for (const progDoc of programmesSnap.docs) {
    const programme = { id: progDoc.id, ...progDoc.data() };
    const fit = await scoreStartupProgrammeFit(db, startup, programme, platformConfig);
    if (!fit.passesThreshold) continue;

    const recId = await writeProgrammeRecommendation(db, programme.id, {
      recommendationType: "Startup-to-Programme",
      sourceEntityType: "startup",
      sourceEntityId: startupId,
      targetEntityType: "programme",
      targetEntityId: programme.id,
      programmeId: programme.id,
      orgId: programme.orgId,
      matchScore: fit.matchScore,
      explanation: fit.explanation,
      riskFlags: fit.riskFlags,
      scoreBreakdown: fit.scoreBreakdown,
      graphEvidence: fit.graphEvidence,
    });
    created.push(recId);

    await upsertGraphEdge(db, {
      sourceType: "startup",
      sourceId: startupId,
      edgeType: "APPLIED_TO",
      targetType: "programme",
      targetId: programme.id,
      programmeId: programme.id,
      createdFrom: "profileEngine",
      metadata: { auto: true, score: fit.matchScore },
    });
  }

  await ensureEmbedding(db, "startups", startupId, startup, buildStartupText, { persist: true });

  return { startupId, recommendationsCreated: created.length, recommendationIds: created };
}

export async function analyzeContributorProfile(db, contributorId, contributorData) {
  const programmesSnap = await db
    .collection("programmes")
    .where("status", "in", ["Open", "Active"])
    .limit(MAX_PROGRAMMES_PER_RUN)
    .get();

  const contributor = { id: contributorId, ...contributorData };
  const created = [];

  for (const progDoc of programmesSnap.docs) {
    const programme = { id: progDoc.id, ...progDoc.data() };
    const recId = await writeProgrammeRecommendation(db, programme.id, {
      recommendationType: "Mentor-to-Programme",
      sourceEntityType: "contributor",
      sourceEntityId: contributorId,
      targetEntityType: "programme",
      targetEntityId: programme.id,
      programmeId: programme.id,
      orgId: programme.orgId,
      matchScore: 65,
      explanation: `Contributor ${contributor.name} may support programme ${programme.name} (rule-based stub).`,
      scoreBreakdown: { ruleScore: 65, semanticScore: 0, graphScore: 0, finalScore: 65 },
      graphEvidence: { summary: "Auto-generated on profile update." },
    });
    created.push(recId);
  }

  await ensureEmbedding(db, "contributors", contributorId, contributor, buildContributorText, {
    persist: true,
  });

  return { contributorId, recommendationsCreated: created.length, recommendationIds: created };
}

export async function handleStartupDocumentWrite(event) {
  if (!meaningfulChange(event.data?.before, event.data?.after)) {
    return { skipped: true, reason: "no meaningful profile change" };
  }
  const startupId = event.params.startupId;
  const data = event.data.after.data();
  const db = getRbacDb();
  return analyzeStartupProfile(db, startupId, data);
}

export async function handleContributorDocumentWrite(event) {
  if (!meaningfulChange(event.data?.before, event.data?.after)) {
    return { skipped: true, reason: "no meaningful profile change" };
  }
  const contributorId = event.params.contributorId;
  const data = event.data.after.data();
  const db = getRbacDb();
  return analyzeContributorProfile(db, contributorId, data);
}
