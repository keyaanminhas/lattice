import test from "node:test";
import assert from "node:assert/strict";
import { listRbacActions } from "../../src/api/router.js";

/** Expected minor + core flows — regression guard when adding handlers. */
const REQUIRED_ACTIONS = [
  // Platform
  "createOrganisation",
  "assignOrgAdmin",
  "suspendOrganisation",
  // Org
  "createProgramme",
  "updateProgramme",
  "assignProgrammeAdmin",
  "verifyContributor",
  "approveOrgAssociation",
  "rejectOrgAssociation",
  // Programme pool & mentors
  "manageProgrammePool",
  "addMentorToProgramme",
  "removeMentorFromProgramme",
  "inviteContributorToProgramme",
  "reviewApplication",
  "reviewRecommendation",
  "reviewMentorRelationship",
  "recommendMentorForStartup",
  "requestAlternateMentor",
  "updateRelationshipStatus",
  // Startup
  "registerStartupProfile",
  "updateStartupProfile",
  "applyToProgramme",
  "runAiMatchPreview",
  "recommendProgrammesForStartup",
  "summariseStartupProfile",
  // Contributor
  "registerContributorProfile",
  "requestOrgAssociation",
  "acceptProgrammeAssignment",
  "rejectProgrammeAssignment",
  "updateContributorProfile",
  "updateContributorCapacity",
  "submitContributorFeedback",
  "recommendContributorToProgrammes",
  // Insights / graph admin
  "getProgrammeGraphView",
  "getDashboardStats",
  "getAiInsights",
];

test("rbacApi exposes programme, mentor, and org minor actions", () => {
  const actions = listRbacActions();
  for (const name of REQUIRED_ACTIONS) {
    assert.ok(actions.includes(name), `missing action: ${name}`);
  }
  assert.ok(actions.length >= REQUIRED_ACTIONS.length);
});
