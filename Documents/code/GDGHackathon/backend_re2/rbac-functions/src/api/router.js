import { HttpsError } from "firebase-functions/v2/https";
import { requireAuth, requireOrgAdmin, requireProgrammeAdmin, requireRole } from "../auth/middleware.js";
import { ROLES } from "../auth/roles.js";
import { syncClaimsForUid } from "../services/claimsService.js";
import {
  assignOrgAdminHandler,
  createOrganisationHandler,
  suspendOrganisationHandler,
} from "../handlers/platformAdmin.js";
import {
  assignProgrammeAdminHandler,
  createProgrammeHandler,
  updateProgrammeHandler,
  verifyContributorHandler,
} from "../handlers/orgAdmin.js";
import {
  addMentorToProgrammeHandler,
  inviteContributorToProgrammeHandler,
  manageProgrammePoolHandler,
  recommendMentorForStartupHandler,
  removeMentorFromProgrammeHandler,
  requestAlternateMentorHandler,
  reviewApplicationHandler,
  reviewMentorRelationshipHandler,
  reviewRecommendationHandler,
  updateRelationshipStatusHandler,
} from "../handlers/programmeAdmin.js";
import {
  applyToProgrammeHandler,
  registerStartupProfileHandler,
  recommendProgrammesForStartupHandler,
  runAiMatchPreviewHandler,
  summariseStartupProfileHandler,
  updateStartupProfileHandler,
} from "../handlers/startup.js";
import {
  acceptProgrammeAssignmentHandler,
  approveOrgAssociationHandler,
  rejectOrgAssociationHandler,
  registerContributorProfileHandler,
  rejectProgrammeAssignmentHandler,
  requestOrgAssociationHandler,
  updateContributorCapacityHandler,
  updateContributorProfileHandler,
  submitContributorFeedbackHandler,
  recommendContributorToProgrammesHandler,
} from "../handlers/contributor.js";
import { getGraphRagContextHandler, rebuildGraphRagHandler } from "../handlers/graphRag.js";
import {
  getAiInsightsHandler,
  getDashboardStatsHandler,
  getProgrammeGraphViewHandler,
} from "../handlers/insights.js";
import {
  runContributorAnalysisHandler,
  runStartupAnalysisHandler,
} from "../handlers/aiEngine.js";

/** Single entrypoint — one Cloud Run service (saves quota vs 20+ callables). */
const ACTIONS = {
  listActions: async () => ({
    actions: listRbacActions(),
    database: process.env.RBAC_FIRESTORE_DATABASE || "rbac-new-db",
    graphRagEnabled: String(process.env.USE_GRAPH_RAG ?? "true").toLowerCase() !== "false",
    geminiSummariesEnabled:
      String(process.env.USE_GEMINI_SUMMARIES || "false").toLowerCase() === "true" &&
      Boolean(process.env.GEMINI_API_KEY),
    geminiEmbeddingsEnabled:
      String(process.env.USE_GEMINI_EMBEDDINGS || "false").toLowerCase() === "true" &&
      Boolean(process.env.GEMINI_API_KEY),
  }),
  syncAuthClaims: async (request) => {
    const { uid } = requireAuth(request);
    const claims = await syncClaimsForUid(uid);
    return { uid, claims, database: process.env.RBAC_FIRESTORE_DATABASE || "rbac-new-db" };
  },
  platformAdminPing: async (request) => {
    const ctx = requireRole(request, [ROLES.PLATFORM_ADMIN]);
    return { ok: true, role: ctx.role, uid: ctx.uid };
  },
  orgAdminPing: async (request) => {
    const data = request.data || {};
    const orgId = String(data.orgId || "").trim();
    if (!orgId) throw new HttpsError("invalid-argument", "orgId is required.");
    const ctx = requireOrgAdmin(request, orgId);
    return { ok: true, role: ctx.role, orgId: ctx.orgId, uid: ctx.uid };
  },
  programmeAdminPing: async (request) => {
    const data = request.data || {};
    const programmeId = String(data.programmeId || "").trim();
    if (!programmeId) throw new HttpsError("invalid-argument", "programmeId is required.");
    const ctx = requireProgrammeAdmin(request, programmeId);
    return { ok: true, role: ctx.role, programmeId: ctx.programmeId, uid: ctx.uid };
  },
  startupPing: async (request) => {
    const ctx = requireRole(request, [ROLES.STARTUP]);
    return { ok: true, role: ctx.role, entityId: ctx.claims.entityId || null, uid: ctx.uid };
  },
  contributorPing: async (request) => {
    const ctx = requireRole(request, [
      ROLES.MENTOR,
      ROLES.PARTNER,
      ROLES.INVESTOR,
      ROLES.SERVICE_PROVIDER,
    ]);
    return { ok: true, role: ctx.role, entityId: ctx.claims.entityId || null, uid: ctx.uid };
  },
  createOrganisation: createOrganisationHandler,
  assignOrgAdmin: assignOrgAdminHandler,
  suspendOrganisation: suspendOrganisationHandler,
  createProgramme: createProgrammeHandler,
  updateProgramme: updateProgrammeHandler,
  assignProgrammeAdmin: assignProgrammeAdminHandler,
  verifyContributor: verifyContributorHandler,
  manageProgrammePool: manageProgrammePoolHandler,
  addMentorToProgramme: addMentorToProgrammeHandler,
  removeMentorFromProgramme: removeMentorFromProgrammeHandler,
  inviteContributorToProgramme: inviteContributorToProgrammeHandler,
  reviewApplication: reviewApplicationHandler,
  reviewRecommendation: reviewRecommendationHandler,
  reviewMentorRelationship: reviewMentorRelationshipHandler,
  recommendMentorForStartup: recommendMentorForStartupHandler,
  updateRelationshipStatus: updateRelationshipStatusHandler,
  requestAlternateMentor: requestAlternateMentorHandler,
  registerStartupProfile: registerStartupProfileHandler,
  updateStartupProfile: updateStartupProfileHandler,
  applyToProgramme: applyToProgrammeHandler,
  recommendProgrammesForStartup: recommendProgrammesForStartupHandler,
  summariseStartupProfile: summariseStartupProfileHandler,
  runAiMatchPreview: runAiMatchPreviewHandler,
  registerContributorProfile: registerContributorProfileHandler,
  requestOrgAssociation: requestOrgAssociationHandler,
  acceptProgrammeAssignment: acceptProgrammeAssignmentHandler,
  rejectProgrammeAssignment: rejectProgrammeAssignmentHandler,
  updateContributorCapacity: updateContributorCapacityHandler,
  updateContributorProfile: updateContributorProfileHandler,
  submitContributorFeedback: submitContributorFeedbackHandler,
  recommendContributorToProgrammes: recommendContributorToProgrammesHandler,
  approveOrgAssociation: approveOrgAssociationHandler,
  rejectOrgAssociation: rejectOrgAssociationHandler,
  rebuildGraphRag: rebuildGraphRagHandler,
  getGraphRagContext: getGraphRagContextHandler,
  getProgrammeGraphView: getProgrammeGraphViewHandler,
  getDashboardStats: getDashboardStatsHandler,
  getAiInsights: getAiInsightsHandler,
  runStartupAnalysis: runStartupAnalysisHandler,
  runContributorAnalysis: runContributorAnalysisHandler,
};

export async function dispatchRbacAction(request) {
  const data = request.data && typeof request.data === "object" ? request.data : {};
  const action = String(data.action || "").trim();
  if (!action || !ACTIONS[action]) {
    throw new HttpsError(
      "invalid-argument",
      `Unknown action '${action}'. Call rbacApi with { action, ...payload }.`,
    );
  }
  const payload = { ...data };
  delete payload.action;
  return ACTIONS[action]({ ...request, data: payload });
}

export function listRbacActions() {
  return Object.keys(ACTIONS);
}
