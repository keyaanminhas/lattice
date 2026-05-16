import { Link, useLocation } from 'react-router-dom';
import { getSidebarItems } from '../config/accessPolicy';

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
  const nav = getSidebarItems(user.roleKey);
  const location = useLocation();

  function isActive(itemTo) {
    const target = new URL(itemTo, 'http://local');
    const current = new URL(`${location.pathname}${location.search}`, 'http://local');
    const targetTab = target.searchParams.get('tab');
    const currentTab = current.searchParams.get('tab');
    if (target.pathname !== current.pathname) return false;
    if (targetTab) return targetTab === currentTab;
    return true;
  }

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
          <Link
            key={item.to}
            to={item.to}
            className={`sidebar-nav-link ${isActive(item.to) ? 'active' : ''}`}
          >
            <span className="material-symbols-outlined">{item.icon}</span>
            <span>{item.label}</span>
            {item.capabilityTag ? <span className="nav-capability-tag">{item.capabilityTag}</span> : null}
          </Link>
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
