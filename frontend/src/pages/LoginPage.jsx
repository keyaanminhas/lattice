export default function LoginPage({ onLogin }) {
  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-card">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <h1 style={{ fontSize: 28, color: 'var(--color-primary)', marginBottom: 8 }}>Lattice</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Sign in to access your ecosystem</p>
          </div>

          <button className="role-button" onClick={() => onLogin({ role: 'admin', name: 'System Admin' })}>
            <span className="role-icon">🛡️</span> Ecosystem Admin
          </button>
          
          <button className="role-button" onClick={() => onLogin({ role: 'company', id: 'comp-1', name: 'MediScan AI' })}>
            <span className="role-icon">🚀</span> Startup / Company
          </button>
          
          <button className="role-button" onClick={() => onLogin({ role: 'contributor', id: 'cont-1', name: 'Dr. Sarah Lim' })}>
            <span className="role-icon">🤝</span> Contributor / Mentor
          </button>
        </div>
      </div>
      <div className="login-right">
        <h2 style={{ fontSize: 42, marginBottom: 20 }}>Welcome to Lattice.</h2>
        <p style={{ fontSize: 20, color: '#94A3B8', lineHeight: 1.6, maxWidth: 500 }}>
          The AI-powered ecosystem relationship engine. We connect startups with the exact mentors, partners, and investors they need to succeed.
        </p>
      </div>
    </div>
  );
}
