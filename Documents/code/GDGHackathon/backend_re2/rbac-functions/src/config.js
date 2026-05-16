import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export const PROJECT_ID =
  process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || "lattice-2026";

export const SOURCE_DATABASE = process.env.SOURCE_DATABASE || "(default)";
export const TARGET_DATABASE = process.env.TARGET_DATABASE || "rbac-new-db";

export const USE_EMULATOR = ["1", "true", "yes"].includes(
  String(process.env.USE_FIRESTORE_EMULATOR || "").toLowerCase(),
);

export const BATCH_SIZE = Math.min(
  500,
  Math.max(1, Number.parseInt(process.env.CLONE_BATCH_SIZE || "400", 10) || 400),
);

export const SOURCE_COLLECTIONS = [
  "organisations",
  "programmes",
  "companies",
  "contributors",
  "accounts",
  "roleAssignments",
  "applications",
  "programmeContributors",
  "recommendations",
  "relationships",
  "outcomes",
  "graph_edges",
];

export const TARGET_COLLECTION_ORDER = [
  "organisations",
  "programmes",
  "startups",
  "contributors",
  "users",
  "role_assignments",
  "applications",
  "programmeContributors",
  "recommendations",
  "relationships",
  "outcomes",
  "graph_edges",
  "_migration_meta",
];
