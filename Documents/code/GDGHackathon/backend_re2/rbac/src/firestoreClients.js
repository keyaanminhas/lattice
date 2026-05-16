import { initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Returns read-only source and write-only target Firestore handles.
 * cloneDB.js must only call write APIs on targetDb.
 */
export function createFirestoreClients({
  projectId,
  sourceDatabase,
  targetDatabase,
  useEmulator,
}) {
  if (useEmulator) {
    process.env.FIRESTORE_EMULATOR_HOST =
      process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
    process.env.GOOGLE_CLOUD_PROJECT = projectId;
  } else {
    delete process.env.FIRESTORE_EMULATOR_HOST;
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : initializeApp({ projectId }, `rbac-clone-${Date.now()}`);

  const sourceDb = getFirestore(app, sourceDatabase);
  const targetDb = getFirestore(app, targetDatabase);

  return { app, sourceDb, targetDb };
}
