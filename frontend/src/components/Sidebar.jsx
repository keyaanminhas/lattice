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
];

const companyNav = [
  { to: '/', icon: 'home', label: 'My Programmes' },
  { to: '/programmes', icon: 'school', label: 'Browse Programmes' },
  { to: '/contributors', icon: 'groups', label: 'Programme Contributors' },
];

const contributorNav = [
  { to: '/', icon: 'assignment', label: 'Programme Assignments' },
  { to: '/programmes', icon: 'school', label: 'Browse Programmes' },
  { to: '/companies', icon: 'business', label: 'Browse Startups' },
];

export default function Sidebar({ user, onLogout }) {
  const roleNav = user.role === 'admin' ? adminNav : user.role === 'company' ? companyNav : contributorNav;
  const roleLabel = user.role === 'admin' ? 'Admin' : user.role === 'company' ? 'Startup' : 'Contributor';

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
        {roleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => `sidebar-nav-link ${isActive ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{user.name?.charAt(0) || 'U'}</div>
        <div className="sidebar-user-info">
          <div className="name">{user.name}</div>
          <div className="role">{roleLabel}</div>
        </div>
        <button onClick={onLogout} className="sidebar-logout-btn" title="Logout">
          <span className="material-symbols-outlined">logout</span>
        </button>
      </div>
    </aside>
  );
}
