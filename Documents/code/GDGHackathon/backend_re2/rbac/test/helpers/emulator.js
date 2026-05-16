import net from "node:net";
import { initializeApp, getApps, deleteApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getRbacDb, RBAC_DATABASE_ID } from "../../src/db.js";

export const PROJECT_ID = "lattice-2026";

export function configureEmulatorEnv() {
  process.env.USE_FIRESTORE_EMULATOR = "true";
  process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
  process.env.GOOGLE_CLOUD_PROJECT = PROJECT_ID;
  process.env.RBAC_FIRESTORE_DATABASE = RBAC_DATABASE_ID;
}

export async function initEmulatorApps() {
  configureEmulatorEnv();
  for (const app of getApps()) {
    await deleteApp(app);
  }
  initializeApp({ projectId: PROJECT_ID });
  return { auth: getAuth(), db: getRbacDb() };
}

export function mockCallable(uid, token, data = {}) {
  return { auth: { uid, token }, data };
}

export async function ensureAuthUser(auth, { uid, email, password = "test-password-123" }) {
  try {
    await auth.getUser(uid);
    await auth.updateUser(uid, { email, password, disabled: false });
  } catch {
    await auth.createUser({ uid, email, password });
  }
}

export async function seedUserDoc(db, uid, profile) {
  await db.collection("users").doc(uid).set(
    {
      id: uid,
      status: "active",
      createdAt: new Date().toISOString(),
      ...profile,
    },
    { merge: true },
  );
}

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function parseEmulatorHost() {
  const raw = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  const [host, portStr] = raw.split(":");
  return { host: host || "127.0.0.1", port: Number(portStr) || 8080 };
}

/** TCP probe only — avoids leaving Firestore gRPC clients open when the emulator is down. */
export function isEmulatorPortOpen(timeoutMs = 1500) {
  const { host, port } = parseEmulatorHost();
  return new Promise((resolve) => {
    const socket = net.connect({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    const done = (open) => {
      socket.removeAllListeners();
      if (!socket.destroyed) socket.destroy();
      resolve(open);
    };
    socket.on("error", () => done(false));
    setTimeout(() => done(false), timeoutMs);
  });
}

export async function teardownFirebaseApps() {
  const apps = [...getApps()];
  await Promise.all(apps.map((app) => deleteApp(app)));
}

export async function isEmulatorReachable(timeoutMs = 3000) {
  const portOpen = await isEmulatorPortOpen(Math.min(timeoutMs, 1500));
  if (!portOpen) return false;

  try {
    await withTimeout(
      (async () => {
        const { db } = await initEmulatorApps();
        await db.collection("_health").doc("probe").set({ ok: true });
      })(),
      timeoutMs,
    );
    return true;
  } catch {
    return false;
  } finally {
    await teardownFirebaseApps();
  }
}
