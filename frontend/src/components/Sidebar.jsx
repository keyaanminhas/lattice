import { NavLink } from 'react-router-dom';

const adminNav = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/programmes', icon: '🧭', label: 'Programmes' },
  { to: '/companies', icon: '🏢', label: 'Startups' },
  { to: '/contributors', icon: '👥', label: 'Contributors' },
  { to: '/matches', icon: '🤖', label: 'Recommendations' },
  { to: '/insights', icon: '💡', label: 'Insights' },
];

const companyNav = [
  { to: '/', icon: '🚀', label: 'My Programmes' },
  { to: '/programmes', icon: '🧭', label: 'Browse Programmes' },
  { to: '/contributors', icon: '👥', label: 'Programme Contributors' },
];

const contributorNav = [
  { to: '/', icon: '🤝', label: 'Programme Assignments' },
  { to: '/programmes', icon: '🧭', label: 'Browse Programmes' },
  { to: '/companies', icon: '🏢', label: 'Browse Startups' },
];

export default function Sidebar({ user, onLogout }) {
  const roleNav = user.role === 'admin' ? adminNav : user.role === 'company' ? companyNav : contributorNav;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Lattice</h1>
        <span>{user.role === 'admin' ? 'Programme Admin' : user.role === 'company' ? 'Startup Portal' : 'Contributor Portal'}</span>
      </div>
      
      <div style={{ padding: '20px 20px 0', fontSize: 13, color: '#fff', fontWeight: 500 }}>
        Welcome, {user.name}
      </div>

      <nav className="sidebar-nav">
        {roleNav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => isActive ? 'active' : ''}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-logout">
        <button 
          onClick={onLogout} 
          style={{ width: '100%', padding: '10px', background: 'transparent', color: '#94A3B8', border: '1px solid #1E293B', borderRadius: 4, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
        >
          Logout
        </button>
      </div>
    </aside>
  );
}
