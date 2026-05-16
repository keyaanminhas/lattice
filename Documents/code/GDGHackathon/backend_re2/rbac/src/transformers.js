/**
 * Maps legacy lattice documents into strict RBAC target schema.
 * Custom claims are NOT set here — Phase 1 handles Auth claims from users docs.
 */

const CONTRIBUTOR_ROLES = new Set([
  "mentor",
  "partner",
  "investor",
  "service_provider",
]);

const ROLE_ALIASES = {
  organisation_admin: "org_admin",
  organization_admin: "org_admin",
  organisation: "org_admin",
  orgadmin: "org_admin",
  platformadmin: "platform_admin",
  programmeadmin: "programme_admin",
  serviceprovider: "service_provider",
  technical_provider: "service_provider",
  company: "startup",
};

export function normaliseRoleKey(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[key] || key;
}

export function roleFromAccountType(accountType) {
  const type = String(accountType || "").trim().toLowerCase();
  if (type === "organisation") return "org_admin";
  if (type === "startup") return "startup";
  if (type === "contributor") return "mentor";
  if (type === "platformadmin" || type === "platform_admin") return "platform_admin";
  return "startup";
}

export function contributorPrimaryRole(contributorDoc) {
  const types = contributorDoc?.contributorTypes || [];
  for (const item of types) {
    const value = normaliseRoleKey(item);
    if (CONTRIBUTOR_ROLES.has(value)) return value;
  }
  return "mentor";
}

function stripUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== undefined),
  );
}

function baseMeta(sourceCollection, sourceId) {
  return {
    migrationSource: "cloneDB-v1",
    legacyCollection: sourceCollection,
    legacyId: sourceId,
    clonedAt: new Date().toISOString(),
  };
}

export function transformOrganisation(docId, data) {
  return stripUndefined({
    id: docId,
    name: data.name,
    organisationType: data.organisationType,
    country: data.country,
    focusAreas: data.focusAreas || [],
    status: data.status || "Active",
    platformConfig: data.platformConfig || {},
    createdAt: data.createdAt,
    ...baseMeta("organisations", docId),
  });
}

export function transformProgramme(docId, data) {
  return stripUndefined({
    id: docId,
    orgId: data.organisationId || data.orgId,
    name: data.name,
    type: data.type,
    targetSectors: data.targetSectors || [],
    targetStages: data.targetStages || [],
    country: data.country,
    region: data.region,
    eligibilityRules: data.eligibilityRules || [],
    expectedOutcomes: data.expectedOutcomes || [],
    status: data.status || "Draft",
    createdAt: data.createdAt,
    ...baseMeta("programmes", docId),
  });
}

export function transformStartup(docId, data) {
  return stripUndefined({
    id: docId,
    orgId: data.organisationId || data.orgId || null,
    authUid: data.authUid || null,
    name: data.name,
    sector: data.sector || data.industry,
    industry: data.industry || data.sector,
    stage: data.stage,
    country: data.country,
    teamSize: data.teamSize,
    problemStatement: data.problemStatement,
    productDescription: data.productDescription,
    supportNeeds: data.supportNeeds || [],
    traction: data.traction,
    currentChallenges: data.currentChallenges || [],
    verificationStatus: data.verificationStatus || "Pending",
    embeddingVector: data.embeddingVector,
    createdAt: data.createdAt,
    ...baseMeta("companies", docId),
  });
}

export function transformContributor(docId, data) {
  const role = contributorPrimaryRole(data);
  return stripUndefined({
    id: docId,
    orgId: data.organisationId || data.orgId || null,
    authUid: data.authUid || null,
    name: data.name,
    role,
    contributorTypes: data.contributorTypes || [],
    expertise: data.expertise || [],
    supportedStages: data.supportedStages || [],
    investmentThesis: data.investmentThesis || [],
    ticketSize: data.ticketSize,
    countryCoverage: data.countryCoverage || [],
    canSupport: data.canSupport || [],
    capacity: data.capacity || {},
    availability: data.availability || "Available",
    status: data.status || "Pending",
    rating: data.rating,
    embeddingVector: data.embeddingVector,
    createdAt: data.createdAt,
    ...baseMeta("contributors", docId),
  });
}

/**
 * Build users + role_assignments from legacy accounts and roleAssignments.
 */
export function buildUsersAndAssignments(accounts, roleAssignments, contributorsById) {
  const assignmentsByUid = new Map();
  for (const assignment of roleAssignments) {
    const uid = assignment.uid;
    if (!uid) continue;
    if (!assignmentsByUid.has(uid)) assignmentsByUid.set(uid, []);
    assignmentsByUid.get(uid).push(assignment);
  }

  const users = [];
  const role_assignments = [];

  for (const account of accounts) {
    const uid = account.id;
    let role = normaliseRoleKey(account.roleKey);
    if (!role) role = roleFromAccountType(account.accountType);

    if (account.accountType === "contributor" && account.entityId) {
      const contributor = contributorsById.get(account.entityId);
      if (contributor) role = contributorPrimaryRole(contributor);
    }

    const userAssignments = assignmentsByUid.get(uid) || [];
    let orgId = null;
    let programmeId = null;
    let entityId = account.entityId || null;
    let entityType = account.entityType || null;

    if (role === "org_admin") {
      orgId =
        account.entityType === "organisation"
          ? account.entityId
          : userAssignments.find((a) => a.scopeType === "organisation")?.scopeId ||
            account.organisationId ||
            null;
    }

    if (role === "programme_admin") {
      const programmeAssignment = userAssignments.find(
        (a) =>
          normaliseRoleKey(a.roleKey) === "programme_admin" && a.scopeType === "programme",
      );
      programmeId = programmeAssignment?.programmeId || programmeAssignment?.scopeId || null;
      orgId = programmeAssignment?.organisationId || null;
    }

    if (role === "startup") {
      entityType = "startup";
      entityId = account.entityId;
    }

    if (CONTRIBUTOR_ROLES.has(role)) {
      entityType = "contributor";
      entityId = account.entityId;
    }

    users.push(
      stripUndefined({
        id: uid,
        email: account.email,
        displayName: account.displayName,
        role,
        orgId,
        programmeId,
        entityType,
        entityId,
        status: String(account.status || "Active").toLowerCase(),
        legacyRoleKey: account.roleKey || null,
        legacyAccountType: account.accountType || null,
        createdAt: account.createdAt,
        updatedAt: account.updatedAt,
        ...baseMeta("accounts", uid),
      }),
    );

    for (const assignment of userAssignments) {
      const assignmentRole = normaliseRoleKey(assignment.roleKey);
      role_assignments.push(
        stripUndefined({
          id: assignment.id,
          uid: assignment.uid,
          role: assignmentRole,
          scopeType: assignment.scopeType,
          scopeId: assignment.scopeId,
          orgId: assignment.organisationId || assignment.orgId || null,
          programmeId: assignment.programmeId || null,
          status: String(assignment.status || "active").toLowerCase(),
          isSeeded: Boolean(assignment.isSeeded),
          createdByUid: assignment.createdByUid,
          approvedByUid: assignment.approvedByUid,
          createdAt: assignment.createdAt,
          updatedAt: assignment.updatedAt,
          ...baseMeta("roleAssignments", assignment.id),
        }),
      );
    }
  }

  // Programme admin slots without uid (seeded placeholders)
  for (const assignment of roleAssignments) {
    if (assignment.uid) continue;
    if (normaliseRoleKey(assignment.roleKey) !== "programme_admin") continue;
    role_assignments.push(
      stripUndefined({
        id: assignment.id,
        uid: null,
        role: "programme_admin",
        scopeType: assignment.scopeType || "programme",
        scopeId: assignment.scopeId,
        orgId: assignment.organisationId || assignment.orgId || null,
        programmeId: assignment.programmeId || assignment.scopeId || null,
        status: String(assignment.status || "unassigned").toLowerCase(),
        isSeeded: Boolean(assignment.isSeeded),
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        ...baseMeta("roleAssignments", assignment.id),
      }),
    );
  }

  return { users, role_assignments };
}

export function transformApplication(docId, data) {
  return stripUndefined({
    id: docId,
    startupId: data.startupId,
    programmeId: data.programmeId,
    orgId: data.organisationId || data.orgId || null,
    aiFitScore: data.aiFitScore,
    aiExplanation: data.aiExplanation,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...baseMeta("applications", docId),
  });
}

export function transformProgrammeContributor(docId, data) {
  return stripUndefined({
    id: docId,
    programmeId: data.programmeId,
    contributorId: data.contributorId,
    contributorType: data.contributorType,
    orgId: data.organisationId || data.orgId || null,
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...baseMeta("programmeContributors", docId),
  });
}

export function transformRecommendation(docId, data) {
  return stripUndefined({
    id: docId,
    recommendationType: data.recommendationType,
    sourceEntityType: data.sourceEntityType,
    sourceEntityId: data.sourceEntityId,
    targetEntityType: data.targetEntityType,
    targetEntityId: data.targetEntityId,
    programmeId: data.programmeId,
    orgId: data.organisationId || data.orgId || null,
    matchScore: data.matchScore,
    explanation: data.explanation,
    riskFlags: data.riskFlags || [],
    scoreBreakdown: data.scoreBreakdown || {},
    graphEvidence: data.graphEvidence || {},
    status: data.status,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...baseMeta("recommendations", docId),
  });
}

export function transformRelationship(docId, data) {
  return stripUndefined({
    id: docId,
    relationshipType: data.relationshipType,
    sourceEntityId: data.sourceEntityId,
    targetEntityId: data.targetEntityId,
    programmeId: data.programmeId,
    orgId: data.organisationId || data.orgId || null,
    createdFromRecommendationId: data.createdFromRecommendationId,
    matchScore: data.matchScore,
    status: data.status,
    expectedOutcome: data.expectedOutcome,
    startDate: data.startDate,
    endDate: data.endDate,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...baseMeta("relationships", docId),
  });
}

export function transformOutcome(docId, data) {
  return stripUndefined({
    id: docId,
    relationshipId: data.relationshipId,
    outcomeAchieved: data.outcomeAchieved,
    relationshipQuality: data.relationshipQuality,
    startupRating: data.startupRating,
    startupFeedback: data.startupFeedback,
    contributorRating: data.contributorRating,
    contributorFeedback: data.contributorFeedback,
    adminEvaluation: data.adminEvaluation,
    aiLesson: data.aiLesson,
    reusePattern: data.reusePattern,
    createdAt: data.createdAt,
    ...baseMeta("outcomes", docId),
  });
}

export function transformGraphEdge(docId, data) {
  return stripUndefined({
    id: docId,
    sourceType: data.sourceType,
    sourceId: data.sourceId,
    edgeType: data.edgeType,
    targetType: data.targetType,
    targetId: data.targetId,
    programmeId: data.programmeId,
    orgId: data.organisationId || data.orgId || null,
    status: data.status,
    weight: data.weight,
    confidence: data.confidence,
    createdFrom: data.createdFrom,
    createdFromId: data.createdFromId,
    metadata: data.metadata || {},
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    ...baseMeta("graph_edges", docId),
  });
}

export function transformCollection(sourceName, docId, data, context = {}) {
  switch (sourceName) {
    case "organisations":
      return { collection: "organisations", doc: transformOrganisation(docId, data) };
    case "programmes":
      return { collection: "programmes", doc: transformProgramme(docId, data) };
    case "companies":
      return { collection: "startups", doc: transformStartup(docId, data) };
    case "contributors":
      return { collection: "contributors", doc: transformContributor(docId, data) };
    case "applications":
      return { collection: "applications", doc: transformApplication(docId, data) };
    case "programmeContributors":
      return {
        collection: "programmeContributors",
        doc: transformProgrammeContributor(docId, data),
      };
    case "recommendations":
      return { collection: "recommendations", doc: transformRecommendation(docId, data) };
    case "relationships":
      return { collection: "relationships", doc: transformRelationship(docId, data) };
    case "outcomes":
      return { collection: "outcomes", doc: transformOutcome(docId, data) };
    case "graph_edges":
      return { collection: "graph_edges", doc: transformGraphEdge(docId, data) };
    case "accounts":
    case "roleAssignments":
      return null;
    default:
      throw new Error(`Unsupported source collection: ${sourceName}`);
  }
}
