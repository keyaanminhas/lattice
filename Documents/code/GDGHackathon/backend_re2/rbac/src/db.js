import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

export const RBAC_DATABASE_ID =
  process.env.RBAC_FIRESTORE_DATABASE || process.env.TARGET_DATABASE || "rbac-new-db";

function useEmulator() {
  return ["1", "true", "yes"].includes(
    String(process.env.USE_FIRESTORE_EMULATOR || "").toLowerCase(),
  );
}

export function getRbacDb() {
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "lattice-2026";

  if (useEmulator()) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  } else {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  }

  const app =
    getApps().find((a) => a.name === "rbac") ||
    initializeApp({ projectId }, "rbac");

  return getFirestore(app, RBAC_DATABASE_ID);
}

export async function getUserProfile(uid) {
  const db = getRbacDb();
  const snap = await db.collection("users").doc(uid).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}
