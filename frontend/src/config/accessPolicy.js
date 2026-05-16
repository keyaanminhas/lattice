const ROUTE_ACCESS = {
  platform_admin: new Set(['/','/companies','/contributors','/programmes','/settings','/feature-guide','/privacy']),
  organisation_admin: new Set(['/','/companies','/contributors','/programmes','/programmes/create','/insights','/feature-guide','/privacy']),
  programme_admin: new Set(['/','/companies','/contributors','/programmes','/matches','/outcomes','/feature-guide','/privacy']),
  startup: new Set(['/','/programmes','/companies','/contributors','/feature-guide','/privacy']),
  mentor: new Set(['/','/programmes','/companies','/feature-guide','/privacy']),
  partner: new Set(['/','/programmes','/companies','/feature-guide','/privacy']),
  investor: new Set(['/','/programmes','/companies','/feature-guide','/privacy']),
  service_provider: new Set(['/','/programmes','/companies','/feature-guide','/privacy']),
  admin: new Set(['/','/companies','/contributors','/programmes','/settings','/feature-guide','/privacy']),
  contributor: new Set(['/','/programmes','/companies','/feature-guide','/privacy']),
};

const ACTION_ACCESS = {
  create_programme: new Set(['organisation_admin']),
  review_pending_registration: new Set(['platform_admin']),
  recommend_contributor_to_programmes: new Set(['organisation_admin']),
  review_programme_application: new Set(['programme_admin']),
  review_programme_connection_request: new Set(['programme_admin']),
  recommend_mentor_for_startup: new Set(['programme_admin']),
  review_recommendation: new Set(['programme_admin']),
  update_relationship_status: new Set(['programme_admin']),
  submit_outcome: new Set(['programme_admin']),
  generate_profile_summary: new Set(['startup']),
  generate_programme_recommendations: new Set(['startup']),
};

const DASHBOARD_TABS = {
  startup: [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'profile', label: 'Edit Profile', icon: 'edit' },
    { id: 'browse', label: 'Browse Programmes', icon: 'school' },
    { id: 'mentors', label: 'Mentor Pathway', icon: 'handshake' },
    { id: 'resources', label: 'Resources', icon: 'folder_open' },
  ],
  contributor: [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'profile', label: 'Edit Profile', icon: 'edit' },
    { id: 'programmes', label: 'Suggested Programmes', icon: 'school' },
    { id: 'mentees', label: 'Startup Assignments', icon: 'handshake' },
  ],
};

function normaliseRole(roleKey) {
  if (['mentor', 'partner', 'investor', 'service_provider', 'contributor'].includes(roleKey)) {
    return 'contributor';
  }
  return roleKey || 'startup';
}

function routeMatches(pathname, allowedRoute) {
  if (allowedRoute === pathname) return true;
  if (allowedRoute === '/companies' && pathname.startsWith('/companies/')) return true;
  if (allowedRoute === '/programmes' && pathname.startsWith('/programmes/')) return true;
  return false;
}

export function canAccessRoute(roleKey, pathname) {
  const role = normaliseRole(roleKey);
  const allowedRoutes = ROUTE_ACCESS[role] || ROUTE_ACCESS.startup;
  return Array.from(allowedRoutes).some((allowedRoute) => routeMatches(pathname, allowedRoute));
}

export function canPerformAction(roleKey, actionId, context = {}) {
  const role = normaliseRole(roleKey);
  const allowedRoles = ACTION_ACCESS[actionId];
  if (!allowedRoles || !allowedRoles.has(role)) return false;
  if ((actionId === 'generate_profile_summary' || actionId === 'generate_programme_recommendations') && role === 'startup') {
    return Boolean(context.isOwner);
  }
  return true;
}

export function getDashboardTabs(roleKey) {
  const role = normaliseRole(roleKey);
  return DASHBOARD_TABS[role] || [];
}

export function getSidebarItems(roleKey) {
  const role = normaliseRole(roleKey);
  if (role === 'startup') {
    const tabs = getDashboardTabs('startup');
    return [
      ...tabs.map((tab) => ({ to: `/?tab=${tab.id}`, icon: tab.icon, label: tab.label })),
      { to: '/feature-guide', icon: 'menu_book', label: 'Feature Guide', capabilityTag: 'Guide' },
    ];
  }
  if (role === 'contributor') {
    const tabs = getDashboardTabs('contributor');
    return [
      ...tabs.map((tab) => ({ to: `/?tab=${tab.id}`, icon: tab.icon, label: tab.label })),
      { to: '/feature-guide', icon: 'menu_book', label: 'Feature Guide', capabilityTag: 'Guide' },
    ];
  }

  const items = [
    { to: '/', icon: 'dashboard', label: 'Dashboard' },
    { to: '/programmes', icon: 'school', label: 'Programmes' },
    { to: '/companies', icon: 'business', label: 'Startups' },
    { to: '/contributors', icon: 'groups', label: 'Contributors' },
    { to: '/matches', icon: 'handshake', label: 'Recommendations' },
    { to: '/outcomes', icon: 'rate_review', label: 'Outcomes' },
    { to: '/insights', icon: 'insights', label: 'Insights' },
    { to: '/settings', icon: 'settings', label: 'Settings' },
    { to: '/programmes/create', icon: 'add_circle', label: 'Create Programme' },
    { to: '/feature-guide', icon: 'menu_book', label: 'Feature Guide', capabilityTag: 'Guide' },
  ];
  return items.filter((item) => canAccessRoute(role, item.to));
}
