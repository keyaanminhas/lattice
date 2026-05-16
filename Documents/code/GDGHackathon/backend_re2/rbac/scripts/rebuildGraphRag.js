#!/usr/bin/env node
/**
 * Quick rebuild of graph_edges in rbac-new-db only.
 * Usage: node scripts/rebuildGraphRag.js [--programmeId=prog-1] [--clear]
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps } from "firebase-admin/app";
import { rebuildGraphRag } from "../src/ai/rebuildGraph.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  }),
);

async function main() {
  process.env.USE_GRAPH_RAG = "true";
  if (!getApps().length) {
    initializeApp({ projectId: process.env.GCLOUD_PROJECT || "lattice-2026" });
  }

  const stats = await rebuildGraphRag({
    programmeId: args.programmeId && args.programmeId !== true ? args.programmeId : null,
    clearFirst: Boolean(args.clear),
  });

  console.log("[rebuildGraphRag] Done:", JSON.stringify(stats, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
