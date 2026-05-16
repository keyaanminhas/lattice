import { httpsCallable } from "firebase/functions";
import { getRbacFunctions } from "@/lib/firebase/client";

export async function callRbacApi<T = unknown>(
  action: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  const fn = httpsCallable(getRbacFunctions(), "rbacApi");
  const result = await fn({ action, ...payload });
  return result.data as T;
}

export async function syncAuthClaims() {
  return callRbacApi<{ uid: string; claims: Record<string, string> }>("syncAuthClaims");
}

export async function listRbacActions() {
  return callRbacApi<{
    actions: string[];
    database: string;
    graphRagEnabled: boolean;
    geminiSummariesEnabled: boolean;
  }>("listActions");
}

export async function getDashboardStats() {
  return callRbacApi<Record<string, number>>("getDashboardStats");
}

export type AiInsightItem = {
  type: string;
  title: string;
  description: string;
  severity: string;
};

export async function getAiInsights() {
  return callRbacApi<{
    insights: AiInsightItem[];
    engine: string;
    stats: Record<string, unknown>;
    geminiError?: string;
  }>("getAiInsights");
}

export async function getProgrammeGraphView(programmeId: string) {
  return callRbacApi<Record<string, unknown>>("getProgrammeGraphView", { programmeId });
}

export async function recommendProgrammesForStartup(startupId: string) {
  return callRbacApi<{ recommendations: Array<Record<string, unknown>> }>(
    "recommendProgrammesForStartup",
    { startupId },
  );
}

export async function recommendMentorForStartup(programmeId: string, startupId: string) {
  return callRbacApi<{ recommendations: Array<Record<string, unknown>> }>(
    "recommendMentorForStartup",
    { programmeId, startupId },
  );
}

export async function applyToProgramme(startupId: string, programmeId: string) {
  return callRbacApi("applyToProgramme", { startupId, programmeId });
}

export async function reviewApplication(
  programmeId: string,
  applicationId: string,
  decision: "Accepted" | "Rejected",
) {
  return callRbacApi("reviewApplication", { programmeId, applicationId, decision });
}

export async function reviewMentorRelationship(
  programmeId: string,
  recommendationId: string,
  decision: "Approved" | "Rejected",
) {
  return callRbacApi("reviewMentorRelationship", {
    programmeId,
    recommendationId,
    decision,
  });
}

export type StartupProfileSummary = {
  summary: string;
  autoTags?: string[];
  suggestedProgrammeTypes?: string[];
  riskFlags?: string[];
  profileCompletenessScore?: number;
  readinessScore?: number;
};

export async function summariseStartupProfile(startupId: string) {
  return callRbacApi<{
    profile: StartupProfileSummary;
    engine?: string;
    geminiError?: string;
  }>("summariseStartupProfile", { startupId });
}

export async function updateStartupProfile(
  startupId: string,
  patch: Record<string, unknown>,
) {
  return callRbacApi("updateStartupProfile", { startupId, ...patch });
}

export async function updateContributorProfile(
  contributorId: string,
  patch: Record<string, unknown>,
) {
  return callRbacApi("updateContributorProfile", { contributorId, ...patch });
}

export async function updateContributorCapacity(
  contributorId: string,
  capacity: Record<string, unknown>,
) {
  return callRbacApi("updateContributorCapacity", { contributorId, capacity });
}

export async function registerStartupProfile(payload: Record<string, unknown>) {
  return callRbacApi<{ startup: Record<string, unknown>; claims: Record<string, string> }>(
    "registerStartupProfile",
    payload,
  );
}

export async function registerContributorProfile(payload: Record<string, unknown>) {
  return callRbacApi<{ contributor: Record<string, unknown>; claims: Record<string, string> }>(
    "registerContributorProfile",
    payload,
  );
}

export async function addMentorToProgramme(programmeId: string, contributorId: string) {
  return callRbacApi("addMentorToProgramme", { programmeId, contributorId });
}

export async function runAiMatchPreview(startupId: string, programmeId: string) {
  return callRbacApi<{
    fit: { matchScore?: number; explanation?: string };
    engine?: string;
  }>("runAiMatchPreview", { startupId, programmeId });
}

export async function rebuildGraphRag(programmeId?: string) {
  return callRbacApi("rebuildGraphRag", programmeId ? { programmeId } : {});
}

export async function pingRole(action: string, payload: Record<string, unknown> = {}) {
  return callRbacApi(action, payload);
}
