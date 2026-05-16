#!/usr/bin/env node
/**
 * NON-DESTRUCTIVE Firestore clone: READ source database only, WRITE target database only.
 *
 * Usage:
 *   npm run clone:emulator:dry-run   # preview against emulators
 *   npm run clone:emulator           # write to rbac-new-db emulator
 *   npm run clone                    # production (requires credentials + created DB)
 */

import {
  BATCH_SIZE,
  PROJECT_ID,
  SOURCE_COLLECTIONS,
  SOURCE_DATABASE,
  TARGET_COLLECTION_ORDER,
  TARGET_DATABASE,
  USE_EMULATOR,
} from "./src/config.js";
import { createFirestoreClients } from "./src/firestoreClients.js";
import {
  buildUsersAndAssignments,
  transformCollection,
} from "./src/transformers.js";

const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const FORCE_TARGET = args.has("--force-target");

function log(message) {
  console.log(`[cloneDB] ${message}`);
}

async function readCollection(sourceDb, collectionName) {
  const snapshot = await sourceDb.collection(collectionName).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

function groupByCollection(rows) {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.collection)) grouped.set(row.collection, []);
    grouped.get(row.collection).push(row);
  }
  return grouped;
}

async function assertTargetWritable(targetDb, dryRun) {
  if (dryRun) return;

  const probeRef = targetDb.collection("_migration_meta").doc("_write_probe");
  await probeRef.set(
    {
      probe: true,
      at: new Date().toISOString(),
      database: TARGET_DATABASE,
    },
    { merge: true },
  );
  await probeRef.delete();
}

async function assertTargetEmptyUnlessForced(targetDb) {
  if (FORCE_TARGET) {
    log("Skipping target empty check (--force-target).");
    return;
  }

  for (const collection of TARGET_COLLECTION_ORDER) {
    if (collection.startsWith("_")) continue;
    const snap = await targetDb.collection(collection).limit(1).get();
    if (!snap.empty) {
      throw new Error(
        `Target collection "${collection}" is not empty in ${TARGET_DATABASE}. ` +
          "Use --force-target to append/overwrite via merge, or wipe emulator data first.",
      );
    }
  }
}

async function commitBatches(targetDb, rows, dryRun) {
  if (!rows.length) return 0;

  let written = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    if (dryRun) {
      written += chunk.length;
      continue;
    }

    const batch = targetDb.batch();
    for (const row of chunk) {
      const ref = targetDb.collection(row.collection).doc(row.id);
      batch.set(ref, row.doc, { merge: true });
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

async function buildTransformedRows(sourceDb) {
  const sourceData = {};
  for (const name of SOURCE_COLLECTIONS) {
    sourceData[name] = await readCollection(sourceDb, name);
    log(`Read ${sourceData[name].length} docs from ${SOURCE_DATABASE}/${name}`);
  }

  const transformed = [];

  for (const collectionName of SOURCE_COLLECTIONS) {
    if (collectionName === "accounts" || collectionName === "roleAssignments") continue;

    for (const { id, data } of sourceData[collectionName]) {
      const result = transformCollection(collectionName, id, data);
      if (!result) continue;
      transformed.push({ collection: result.collection, id, doc: result.doc });
    }
  }

  const contributorsById = new Map(
    sourceData.contributors.map(({ id, data }) => [id, data]),
  );

  const accounts = sourceData.accounts.map(({ id, data }) => ({ id, ...data }));
  const roleAssignments = sourceData.roleAssignments.map(({ id, data }) => ({
    id,
    ...data,
  }));

  const { users, role_assignments } = buildUsersAndAssignments(
    accounts,
    roleAssignments,
    contributorsById,
  );

  for (const user of users) {
    transformed.push({ collection: "users", id: user.id, doc: user });
  }
  for (const assignment of role_assignments) {
    transformed.push({
      collection: "role_assignments",
      id: assignment.id,
      doc: assignment,
    });
  }

  return { transformed, sourceCounts: sourceData };
}

async function writeMigrationMeta(targetDb, summary, dryRun) {
  const meta = {
    id: "cloneDB-v1",
    sourceDatabase: SOURCE_DATABASE,
    targetDatabase: TARGET_DATABASE,
    projectId: PROJECT_ID,
    dryRun,
    completedAt: new Date().toISOString(),
    ...summary,
  };

  if (dryRun) {
    log(`Dry run complete. Would write _migration_meta/cloneDB-v1`);
    return;
  }

  await targetDb.collection("_migration_meta").doc("cloneDB-v1").set(meta, { merge: true });
}

async function main() {
  log(`Project: ${PROJECT_ID}`);
  log(`Source (READ-ONLY): ${SOURCE_DATABASE}`);
  log(`Target (WRITE):     ${TARGET_DATABASE}`);
  log(`Emulator:           ${USE_EMULATOR ? "yes" : "no"}`);
  log(`Mode:               ${DRY_RUN ? "DRY RUN" : "LIVE WRITE"}`);

  if (SOURCE_DATABASE === TARGET_DATABASE) {
    throw new Error("SOURCE_DATABASE and TARGET_DATABASE must differ.");
  }

  const { sourceDb, targetDb } = createFirestoreClients({
    projectId: PROJECT_ID,
    sourceDatabase: SOURCE_DATABASE,
    targetDatabase: TARGET_DATABASE,
    useEmulator: USE_EMULATOR,
  });

  // Safety: verify we can distinguish databases by attempting target-only probe.
  await assertTargetWritable(targetDb, DRY_RUN);
  await assertTargetEmptyUnlessForced(targetDb);

  const { transformed, sourceCounts } = await buildTransformedRows(sourceDb);
  const grouped = groupByCollection(transformed);

  const writeStats = {};
  let totalWritten = 0;

  for (const collection of TARGET_COLLECTION_ORDER) {
    if (collection === "_migration_meta") continue;
    const rows = grouped.get(collection) || [];
    rows.sort((a, b) => a.id.localeCompare(b.id));

    const count = await commitBatches(targetDb, rows, DRY_RUN);
    writeStats[collection] = count;
    totalWritten += count;
    log(`${DRY_RUN ? "Would write" : "Wrote"} ${count} docs -> ${TARGET_DATABASE}/${collection}`);
  }

  const summary = {
    sourceCounts: Object.fromEntries(
      Object.entries(sourceCounts).map(([key, docs]) => [key, docs.length]),
    ),
    targetCounts: writeStats,
    totalDocuments: totalWritten,
  };

  await writeMigrationMeta(targetDb, summary, DRY_RUN);

  log("--- Summary ---");
  console.log(JSON.stringify(summary, null, 2));
  log(
    DRY_RUN
      ? "No writes performed (dry run). Re-run without --dry-run to clone."
      : `Clone complete. Live database ${SOURCE_DATABASE} was not modified.`,
  );
}

main().catch((error) => {
  console.error("[cloneDB] FAILED:", error.message);
  if (error.stack) console.error(error.stack);
  process.exit(1);
});
