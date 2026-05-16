export const roleLabels = {
  platform_admin: 'Platform Admin',
  organisation_admin: 'Organisation Admin',
  programme_admin: 'Programme Admin',
  startup: 'Startup',
  mentor: 'Mentor',
  partner: 'Partner',
  investor: 'Investor',
  service_provider: 'Service Provider',
};

export const roleCapabilityMatrix = [
  { capabilityId: 'platform.organisation.create', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'write', scope: 'platform', label: 'Create organisation' },
  { capabilityId: 'platform.organisation.manage', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'configure', scope: 'platform', label: 'Manage organisation' },
  { capabilityId: 'platform.organisation.suspend', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'write', scope: 'platform', label: 'Suspend organisation' },
  { capabilityId: 'platform.admin.assign_org_admin', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'approve', scope: 'platform', label: 'Assign organisation admin' },
  { capabilityId: 'platform.users.manage', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'configure', scope: 'platform', label: 'Manage platform users' },
  { capabilityId: 'platform.categories.configure', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'configure', scope: 'platform', label: 'Configure global categories' },
  { capabilityId: 'platform.ai_thresholds.configure', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'configure', scope: 'platform', label: 'Configure AI thresholds' },
  { capabilityId: 'platform.analytics.view', roleKeys: ['platform_admin'], surface: '/', actionType: 'read', scope: 'platform', label: 'View platform analytics' },
  { capabilityId: 'platform.audit.view', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'read', scope: 'platform', label: 'View audit logs' },
  { capabilityId: 'platform.health.monitor', roleKeys: ['platform_admin'], surface: '/settings', actionType: 'read', scope: 'platform', label: 'Monitor system health' },

  { capabilityId: 'org.profile.manage', roleKeys: ['organisation_admin'], surface: '/settings', actionType: 'write', scope: 'organisation', label: 'Manage organisation profile' },
  { capabilityId: 'org.programme.create', roleKeys: ['organisation_admin'], surface: '/programmes/create', actionType: 'write', scope: 'organisation', label: 'Create programme' },
  { capabilityId: 'org.programme.edit', roleKeys: ['organisation_admin'], surface: '/programmes/:id', actionType: 'write', scope: 'organisation', label: 'Edit programme' },
  { capabilityId: 'org.programme.archive', roleKeys: ['organisation_admin'], surface: '/programmes/:id', actionType: 'write', scope: 'organisation', label: 'Archive programme' },
  { capabilityId: 'org.admin.assign_programme_admin', roleKeys: ['organisation_admin'], surface: '/programmes/:id', actionType: 'approve', scope: 'organisation', label: 'Assign programme admin' },
  { capabilityId: 'org.contributor.verify', roleKeys: ['organisation_admin'], surface: '/contributors', actionType: 'approve', scope: 'organisation', label: 'Verify contributor' },
  { capabilityId: 'org.contributor.association.approve', roleKeys: ['organisation_admin'], surface: '/contributors', actionType: 'approve', scope: 'organisation', label: 'Approve contributor association' },
  { capabilityId: 'org.recommendations.contributor_programme.view', roleKeys: ['organisation_admin'], surface: '/matches', actionType: 'read', scope: 'organisation', label: 'View contributor-to-programme suggestions' },
  { capabilityId: 'org.recommendations.contributor_programme.approve', roleKeys: ['organisation_admin'], surface: '/matches', actionType: 'approve', scope: 'organisation', label: 'Approve contributor-to-programme linkage' },
  { capabilityId: 'org.analytics.view', roleKeys: ['organisation_admin'], surface: '/insights', actionType: 'read', scope: 'organisation', label: 'View organisation analytics' },
  { capabilityId: 'org.gaps.view', roleKeys: ['organisation_admin'], surface: '/insights', actionType: 'read', scope: 'organisation', label: 'View ecosystem gap insights' },
  { capabilityId: 'org.rules.configure', roleKeys: ['organisation_admin'], surface: '/settings', actionType: 'configure', scope: 'organisation', label: 'Configure organisation-level rules' },

  { capabilityId: 'programme.profile.manage', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'write', scope: 'programme', label: 'Manage programme profile' },
  { capabilityId: 'programme.eligibility.define', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'configure', scope: 'programme', label: 'Define eligibility rules' },
  { capabilityId: 'programme.targets.define', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'configure', scope: 'programme', label: 'Define target sectors/stages' },
  { capabilityId: 'programme.outcomes.define', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'configure', scope: 'programme', label: 'Define expected outcomes' },
  { capabilityId: 'programme.startup.review', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'approve', scope: 'programme', label: 'Review startup applications' },
  { capabilityId: 'programme.startup.recommendations.view', roleKeys: ['programme_admin'], surface: '/matches', actionType: 'read', scope: 'programme', label: 'View startup-to-programme recommendations' },
  { capabilityId: 'programme.pool.manage', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'write', scope: 'programme', label: 'Manage mentor/partner/investor/service pools' },
  { capabilityId: 'programme.mentor.recommendations.review', roleKeys: ['programme_admin'], surface: '/matches', actionType: 'approve', scope: 'programme', label: 'Review startup-to-mentor recommendations' },
  { capabilityId: 'programme.relationship.status.update', roleKeys: ['programme_admin'], surface: '/outcomes', actionType: 'write', scope: 'programme', label: 'Update relationship status' },
  { capabilityId: 'programme.outcome.record', roleKeys: ['programme_admin'], surface: '/outcomes', actionType: 'write', scope: 'programme', label: 'Record outcome' },
  { capabilityId: 'programme.feedback.review', roleKeys: ['programme_admin'], surface: '/outcomes', actionType: 'read', scope: 'programme', label: 'Review feedback' },
  { capabilityId: 'programme.analytics.view', roleKeys: ['programme_admin'], surface: '/', actionType: 'read', scope: 'programme', label: 'View programme analytics' },
  { capabilityId: 'programme.graph_gaps.view', roleKeys: ['programme_admin'], surface: '/programmes/:id', actionType: 'read', scope: 'programme', label: 'View graph gap insights' },

  { capabilityId: 'startup.profile.register', roleKeys: ['startup'], surface: '/login', actionType: 'write', scope: 'self', label: 'Register company' },
  { capabilityId: 'startup.profile.edit', roleKeys: ['startup'], surface: '/', actionType: 'write', scope: 'self', label: 'Edit company profile' },
  { capabilityId: 'startup.support.submit', roleKeys: ['startup'], surface: '/', actionType: 'write', scope: 'self', label: 'Submit support needs' },
  { capabilityId: 'startup.documents.upload', roleKeys: ['startup'], surface: '/', actionType: 'write', scope: 'self', label: 'Upload documents' },
  { capabilityId: 'startup.ai_summary.view', roleKeys: ['startup'], surface: '/companies/:id', actionType: 'read', scope: 'self', label: 'View AI profile summary' },
  { capabilityId: 'startup.programmes.view', roleKeys: ['startup'], surface: '/programmes', actionType: 'read', scope: 'self', label: 'View and filter recommended programmes' },
  { capabilityId: 'startup.programme.apply', roleKeys: ['startup'], surface: '/', actionType: 'write', scope: 'self', label: 'Apply to programme' },
  { capabilityId: 'startup.application.track', roleKeys: ['startup'], surface: '/', actionType: 'read', scope: 'self', label: 'Track application status' },
  { capabilityId: 'startup.accepted_programmes.view', roleKeys: ['startup'], surface: '/', actionType: 'read', scope: 'self', label: 'View accepted programmes' },
  { capabilityId: 'startup.mentor.view', roleKeys: ['startup'], surface: '/', actionType: 'read', scope: 'self', label: 'View assigned mentor' },
  { capabilityId: 'startup.resources.access', roleKeys: ['startup'], surface: '/', actionType: 'read', scope: 'programme', label: 'Access programme-level resources and support' },
  { capabilityId: 'startup.feedback.submit', roleKeys: ['startup'], surface: '/', actionType: 'write', scope: 'self', label: 'Submit relationship/outcome feedback' },
];

export function getCapabilitiesForRole(roleKey) {
  return roleCapabilityMatrix.filter((capability) => capability.roleKeys.includes(roleKey));
}

export function surfaceCapabilitiesForRole(roleKey, surfacePath) {
  return getCapabilitiesForRole(roleKey).filter((capability) =>
    capability.surface === surfacePath || capability.surface === '/');
}

