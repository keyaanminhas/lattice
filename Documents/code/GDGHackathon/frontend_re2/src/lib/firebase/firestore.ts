import { getFirestore, type Firestore } from "firebase/firestore";
import { getFirebaseApp } from "./client";

const databaseId =
  process.env.NEXT_PUBLIC_RBAC_FIRESTORE_DATABASE || "rbac-new-db";

let db: Firestore | null = null;

export function getRbacFirestore() {
  if (!db) {
    db = getFirestore(getFirebaseApp(), databaseId);
  }
  return db;
}
