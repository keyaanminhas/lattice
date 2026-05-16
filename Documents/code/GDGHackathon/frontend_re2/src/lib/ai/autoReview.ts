import { reviewApplication, reviewMentorRelationship } from "@/lib/api/rbac";

/** AI-assisted approval thresholds (align with platform_config defaults). */
export const AI_APPLICATION_APPROVE_SCORE = 75;
export const AI_MATCH_APPROVE_SCORE = 80;

export type PendingApplication = {
  id: string;
  status?: unknown;
  aiFitScore?: unknown;
};

export type PendingMatch = {
  recommendationId: string;
  matchScore: number;
};

export async function aiAutoApproveApplications(
  programmeId: string,
  applications: PendingApplication[],
  minScore = AI_APPLICATION_APPROVE_SCORE,
): Promise<{ approved: number; skipped: number }> {
  let approved = 0;
  let skipped = 0;

  for (const app of applications) {
    if (app.status !== "Pending Admin Review") {
      skipped += 1;
      continue;
    }
    const score = Number(app.aiFitScore ?? 0);
    if (score < minScore) {
      skipped += 1;
      continue;
    }
    await reviewApplication(programmeId, app.id, "Accepted");
    approved += 1;
  }

  return { approved, skipped };
}

export async function aiAutoApproveMatches(
  programmeId: string,
  matches: PendingMatch[],
  minScore = AI_MATCH_APPROVE_SCORE,
): Promise<{ approved: number; skipped: number }> {
  let approved = 0;
  let skipped = 0;

  for (const m of matches) {
    if (m.matchScore < minScore) {
      skipped += 1;
      continue;
    }
    await reviewMentorRelationship(programmeId, m.recommendationId, "Approved");
    approved += 1;
  }

  return { approved, skipped };
}
