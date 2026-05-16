#!/usr/bin/env node
/**
 * Seed rbac-new-db with realistic ASEAN ecosystem data + login accounts.
 * Password for all login emails: LatticeDemo2026!
 *
 * Usage: node scripts/seedRealisticFixtures.js
 *        npm run seed:demo-users
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { buildCustomClaimsFromUser } from "../src/auth/claims.js";
import { getRbacDb } from "../src/db.js";
import { upsertGraphEdge } from "../src/ai/graphService.js";
import {
  SEED_PASSWORD,
  IDS,
  LOGIN_USERS,
  ORGANISATIONS,
  PROGRAMMES,
  STARTUPS,
  CONTRIBUTORS,
  APPLICATION_FIXTURES,
  POOL_FIXTURES,
  RECOMMENDATION_FIXTURES,
  RELATIONSHIP_FIXTURES,
  OUTCOME_FIXTURES,
  ORG_ASSOCIATION_FIXTURES,
  EXTRA_STARTUPS,
  EXTRA_CONTRIBUTORS,
  EXTRA_APPLICATIONS,
  EXTRA_POOL,
  EXTRA_RECOMMENDATIONS,
  AUDIT_LOG_FIXTURES,
} from "./fixtures/realisticUniverse.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

async function upsertAuthUser(auth, { email, password, displayName }) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, displayName, disabled: false });
    return existing.uid;
  } catch {
    const created = await auth.createUser({ email, password, displayName });
    return created.uid;
  }
}

async function batchSet(db, writes) {
  let batch = db.batch();
  let n = 0;
  for (const { ref, data, merge = true } of writes) {
    batch.set(ref, { ...data, updatedAt: FieldValue.serverTimestamp() }, { merge });
    n += 1;
    if (n >= 400) {
      await batch.commit();
      batch = db.batch();
      n = 0;
    }
  }
  if (n > 0) await batch.commit();
}

async function seedGraphEdges(db) {
  const edges = [
    {
      sourceType: "startup",
      sourceId: IDS.startupLogin,
      edgeType: "APPLIED_TO",
      targetType: "programme",
      targetId: IDS.progHealth,
      programmeId: IDS.progHealth,
    },
    {
      sourceType: "startup",
      sourceId: IDS.startupLogin,
      edgeType: "ACCEPTED_INTO",
      targetType: "programme",
      targetId: IDS.progHealth,
      programmeId: IDS.progHealth,
    },
    {
      sourceType: "contributor",
      sourceId: IDS.mentorLogin,
      edgeType: "ATTACHED_TO",
      targetType: "programme",
      targetId: IDS.progHealth,
      programmeId: IDS.progHealth,
    },
    {
      sourceType: "startup",
      sourceId: "startup-neuropulse",
      edgeType: "APPLIED_TO",
      targetType: "programme",
      targetId: IDS.progHealth,
      programmeId: IDS.progHealth,
    },
    {
      sourceType: "startup",
      sourceId: "startup-kyclear",
      edgeType: "APPLIED_TO",
      targetType: "programme",
      targetId: IDS.progFintech,
      programmeId: IDS.progFintech,
    },
    {
      sourceType: "startup",
      sourceId: "startup-greenroute",
      edgeType: "ACCEPTED_INTO",
      targetType: "programme",
      targetId: IDS.progFintech,
      programmeId: IDS.progFintech,
    },
  ];
  for (const e of edges) {
    await upsertGraphEdge(db, { ...e, createdFrom: "seedRealisticFixtures" });
  }
}

async function main() {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || "lattice-2026";
  if (!getApps().length) initializeApp({ projectId });

  const auth = getAuth();
  const db = getRbacDb();
  const writes = [];

  for (const org of ORGANISATIONS) {
    writes.push({ ref: db.collection("organisations").doc(org.id), data: { id: org.id, ...org } });
    writes.push({
      ref: db.collection("org_rules").doc(org.id),
      data: {
        id: org.id,
        orgId: org.id,
        verificationRequired: true,
        contributorApprovalMode: "manual",
        aiSuggestionsEnabled: true,
        allowedContributorRoles: ["mentor", "partner", "investor", "service_provider"],
      },
    });
  }

  for (const p of PROGRAMMES) {
    writes.push({ ref: db.collection("programmes").doc(p.id), data: { id: p.id, ...p } });
  }

  const allStartups = [...STARTUPS, ...EXTRA_STARTUPS];
  const allContributors = [...CONTRIBUTORS, ...EXTRA_CONTRIBUTORS];
  const allApplications = [...APPLICATION_FIXTURES, ...EXTRA_APPLICATIONS];
  const allPools = [...POOL_FIXTURES, ...EXTRA_POOL];
  const allRecs = [...RECOMMENDATION_FIXTURES, ...EXTRA_RECOMMENDATIONS];

  for (const s of allStartups) {
    writes.push({
      ref: db.collection("startups").doc(s.id),
      data: { id: s.id, orgId: IDS.orgPrimary, ...s },
    });
  }

  for (const c of allContributors) {
    writes.push({
      ref: db.collection("contributors").doc(c.id),
      data: { id: c.id, orgId: IDS.orgPrimary, ...c },
    });
  }

  for (const app of allApplications) {
    const prog = PROGRAMMES.find((p) => p.id === app.programmeId);
    writes.push({
      ref: db.collection("applications").doc(app.id),
      data: {
        id: app.id,
        orgId: prog?.orgId || IDS.orgPrimary,
        startupId: app.startupId,
        programmeId: app.programmeId,
        status: app.status,
        aiFitScore: app.aiFitScore,
        aiExplanation: app.aiExplanation,
        scoreBreakdown: {
          semanticScore: Math.round(app.aiFitScore * 0.7),
          ruleScore: Math.round(app.aiFitScore * 0.2),
          graphScore: 8,
          finalScore: app.aiFitScore,
        },
        graphEvidence: { summary: "Seeded fit score for review queue testing." },
        riskFlags: app.aiFitScore < 60 ? ["Below typical fit threshold"] : [],
      },
    });
  }

  for (const pool of allPools) {
    const poolId = `pc-${pool.programmeId}-${pool.contributorId}`;
    const prog = PROGRAMMES.find((p) => p.id === pool.programmeId);
    writes.push({
      ref: db.collection("programmeContributors").doc(poolId),
      data: {
        id: poolId,
        programmeId: pool.programmeId,
        orgId: prog?.orgId || IDS.orgPrimary,
        contributorId: pool.contributorId,
        contributorType: pool.contributorType,
        status: pool.status,
      },
    });
  }

  for (const rec of allRecs) {
    writes.push({
      ref: db.collection("recommendations").doc(rec.id),
      data: {
        sourceEntityType: rec.recommendationType.startsWith("Startup") ? "startup" : "contributor",
        targetEntityType:
          rec.recommendationType === "Startup-to-Mentor" ? "contributor" : "programme",
        ...rec,
      },
    });
  }

  for (const rel of RELATIONSHIP_FIXTURES) {
    writes.push({
      ref: db.collection("relationships").doc(rel.id),
      data: {
        createdFromRecommendationId: null,
        createdAt: FieldValue.serverTimestamp(),
        ...rel,
      },
    });
  }

  for (const o of OUTCOME_FIXTURES) {
    writes.push({ ref: db.collection("outcomes").doc(o.id), data: o });
  }

  for (const req of ORG_ASSOCIATION_FIXTURES) {
    writes.push({
      ref: db.collection("org_association_requests").doc(req.id),
      data: {
        ...req,
        requestedByUid: "seed-system",
        createdAt: FieldValue.serverTimestamp(),
      },
    });
  }

  writes.push({
    ref: db.collection("platform_config").doc("global"),
    data: {
      id: "global",
      globalCategories: ["HealthTech", "FinTech", "Climate", "EdTech", "DeepTech", "AgriTech"],
      aiThresholds: {
        startupProgrammeMinScore: 60,
        contributorProgrammeMinScore: 65,
        mentorMatchMinScore: 70,
        maxRecommendationsPerCall: 5,
      },
      featureFlags: { latticeGraphEnabled: true, aiInsightsEnabled: true },
    },
  });

  console.log("[seed] Writing Firestore documents…");
  await batchSet(db, writes);

  console.log("[seed] Graph edges…");
  await seedGraphEdges(db);

  console.log("\n=== Login accounts (password for all) ===");
  console.log(`Password: ${SEED_PASSWORD}\n`);

  for (const user of LOGIN_USERS) {
    const uid = await upsertAuthUser(auth, {
      email: user.email,
      password: SEED_PASSWORD,
      displayName: user.displayName,
    });

    const userDoc = {
      id: uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      orgId: user.orgId || null,
      programmeId: user.programmeId || null,
      entityType: user.entityType || null,
      entityId: user.entityId || null,
      status: "active",
      updatedAt: new Date().toISOString(),
    };

    await db.collection("users").doc(uid).set(userDoc, { merge: true });
    await auth.setCustomUserClaims(uid, buildCustomClaimsFromUser(userDoc));
    console.log(`${user.role.padEnd(18)} ${user.email.padEnd(28)} ${user.displayName}`);
  }

  for (const entry of AUDIT_LOG_FIXTURES) {
    await db.collection("audit_logs").doc(entry.id).set({
      ...entry,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  console.log("\n[seed] Summary");
  console.log(`  Organisations: ${ORGANISATIONS.length}`);
  console.log(`  Programmes:    ${PROGRAMMES.length} (includes Draft + Active edge cases)`);
  console.log(`  Startups:      ${allStartups.length}`);
  console.log(`  Contributors:  ${allContributors.length} (includes Unavailable mentor)`);
  console.log(`  Applications:  ${allApplications.length} (Pending / Accepted / Rejected)`);
  console.log(`  Recommendations: ${allRecs.length} (pending mentor + programme matches)`);
  console.log(`  Audit logs:    ${AUDIT_LOG_FIXTURES.length}`);
  console.log(`  Primary org:   ${IDS.orgPrimary} (SGInnovate)`);
  console.log(`  Primary prog:  ${IDS.progHealth} (HealthTech Catalyst 2026)`);
  console.log("\nDone. Sign in at http://localhost:3000/login\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
