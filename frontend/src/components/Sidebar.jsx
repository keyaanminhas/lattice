import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', icon: '📊', label: 'Dashboard' },
  { to: '/companies', icon: '🏢', label: 'Companies' },
  { to: '/contributors', icon: '👥', label: 'Contributors' },
  { to: '/matches', icon: '🤖', label: 'AI Matches' },
  { to: '/insights', icon: '💡', label: 'Insights' },
];

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>Lattice</h1>
        <span>Admin Dashboard</span>
      </div>
      <nav className="sidebar-nav">
        {navItems.map((item) => (
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
    </aside>
  );
}
