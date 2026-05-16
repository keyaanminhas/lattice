import { FieldValue } from "firebase-admin/firestore";
import { getRbacDb } from "../db.js";
import { newId } from "../utils/ids.js";

export async function writeAuditLog({
  actorUid,
  actorRole,
  action,
  targetType,
  targetId,
  orgId = null,
  programmeId = null,
  metadata = {},
}) {
  const db = getRbacDb();
  const id = newId("audit");
  await db.collection("audit_logs").doc(id).set({
    id,
    actorUid,
    actorRole,
    action,
    targetType,
    targetId,
    orgId,
    programmeId,
    metadata,
    createdAt: FieldValue.serverTimestamp(),
  });
  return id;
}
