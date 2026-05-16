import { NavLink } from 'react-router-dom';

const adminNav = [
  { to: '/', glyph: 'DB', label: 'Dashboard' },
  { to: '/programmes', glyph: 'PG', label: 'Programmes' },
  { to: '/companies', glyph: 'ST', label: 'Startups' },
  { to: '/contributors', glyph: 'CT', label: 'Contributors' },
  { to: '/matches', glyph: 'RQ', label: 'Recommendations' },
  { to: '/insights', glyph: 'IN', label: 'Insights' },
];

const companyNav = [
  { to: '/', glyph: 'MP', label: 'My Programmes' },
  { to: '/programmes', glyph: 'PG', label: 'Browse Programmes' },
  { to: '/contributors', glyph: 'CT', label: 'Programme Contributors' },
];

const contributorNav = [
  { to: '/', glyph: 'PA', label: 'Programme Assignments' },
  { to: '/programmes', glyph: 'PG', label: 'Browse Programmes' },
  { to: '/companies', glyph: 'ST', label: 'Browse Startups' },
];

export default function Sidebar({ user, onLogout }) {
  const roleNav = user.role === 'admin' ? adminNav : user.role === 'company' ? companyNav : contributorNav;
  const roleLabel = user.role === 'admin' ? 'Programme Administration' : user.role === 'company' ? 'Startup Workspace' : 'Contributor Workspace';

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Lattice</h1>
        <span>Programme Relationship Governance</span>
      </div>

      <div className="sidebar-user-card">
        <div className="sidebar-user-kicker">{roleLabel}</div>
        <strong>{user.name}</strong>
        <span>Structured admissions, governed actor pools, and monitored relationship outcomes.</span>
      </div>

      <nav className="sidebar-nav">
        {roleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <span className="nav-glyph">{item.glyph}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-logout">
        <button onClick={onLogout} className="sidebar-button">
          Logout
        </button>
      </div>
    </aside>
  );
}
