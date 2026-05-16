import { NavLink } from 'react-router-dom';

const adminNav = [
  { to: '/', icon: 'dashboard', label: 'Dashboard' },
  { to: '/programmes', icon: 'school', label: 'Programmes' },
  { to: '/companies', icon: 'business', label: 'Startups' },
  { to: '/contributors', icon: 'groups', label: 'Contributors' },
  { to: '/matches', icon: 'handshake', label: 'Recommendations' },
  { to: '/outcomes', icon: 'rate_review', label: 'Outcomes' },
  { to: '/insights', icon: 'insights', label: 'Insights' },
  { to: '/settings', icon: 'settings', label: 'Settings' },
  { to: '/feature-guide', icon: 'menu_book', label: 'Feature Guide', capabilityTag: 'Guide' },
];

const companyNav = [
  { to: '/', icon: 'home', label: 'My Programmes' },
  { to: '/programmes', icon: 'school', label: 'Browse Programmes' },
  { to: '/contributors', icon: 'groups', label: 'Programme Contributors' },
  { to: '/feature-guide', icon: 'menu_book', label: 'Feature Guide', capabilityTag: 'Guide' },
];

const contributorNav = [
  { to: '/', icon: 'assignment', label: 'Programme Assignments' },
  { to: '/programmes', icon: 'school', label: 'Browse Programmes' },
  { to: '/companies', icon: 'business', label: 'Browse Startups' },
  { to: '/feature-guide', icon: 'menu_book', label: 'Feature Guide', capabilityTag: 'Guide' },
];

const ADMIN_ROLES = new Set(['platform_admin', 'organisation_admin', 'programme_admin', 'admin']);
const CONTRIBUTOR_ROLES = new Set(['mentor', 'partner', 'investor', 'service_provider', 'contributor']);

function roleLabel(roleKey) {
  const map = {
    platform_admin: 'Platform Admin',
    organisation_admin: 'Organisation Admin',
    programme_admin: 'Programme Admin',
    startup: 'Startup',
    mentor: 'Mentor',
    partner: 'Partner',
    investor: 'Investor',
    service_provider: 'Service Provider',
    admin: 'Admin',
    contributor: 'Contributor',
  };
  return map[roleKey] || 'User';
}

export default function Sidebar({ user, onLogout }) {
  const isAdmin = ADMIN_ROLES.has(user.roleKey);
  const isStartup = user.roleKey === 'startup';
  const isContributor = CONTRIBUTOR_ROLES.has(user.roleKey);
  const nav = isAdmin ? adminNav : isStartup ? companyNav : isContributor ? contributorNav : companyNav;

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-icon">L</div>
        <div>
          <h1>Lattice</h1>
          <p>Ecosystem Platform</p>
        </div>
      </div>

      <nav className="sidebar-nav-list">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
            {item.capabilityTag ? <span className="nav-capability-tag">{item.capabilityTag}</span> : null}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{user.name?.charAt(0) || 'U'}</div>
        <div className="sidebar-user-info">
          <div className="name">{user.name}</div>
          <div className="role">{roleLabel(user.roleKey)}</div>
        </div>
        <button onClick={onLogout} className="sidebar-logout-btn" title="Logout">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </aside>
  );
}
