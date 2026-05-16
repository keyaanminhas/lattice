import { FieldValue } from "firebase-admin/firestore";
import { newId } from "../utils/ids.js";

export async function upsertRecommendation(db, payload) {
  const lookup = {
    recommendationType: payload.recommendationType,
    sourceEntityId: payload.sourceEntityId,
    targetEntityId: payload.targetEntityId,
    programmeId: payload.programmeId || null,
  };

  const existingSnap = await db
    .collection("recommendations")
    .where("recommendationType", "==", lookup.recommendationType)
    .where("sourceEntityId", "==", lookup.sourceEntityId)
    .where("targetEntityId", "==", lookup.targetEntityId)
    .where("programmeId", "==", lookup.programmeId)
    .limit(1)
    .get();

  const id = existingSnap.empty ? newId("rec") : existingSnap.docs[0].id;
  const doc = {
    id,
    ...payload,
    status: payload.status || "Pending Approval",
    updatedAt: FieldValue.serverTimestamp(),
  };
  if (existingSnap.empty) {
    doc.createdAt = FieldValue.serverTimestamp();
  }
  await db.collection("recommendations").doc(id).set(doc, { merge: true });
  return doc;
}
