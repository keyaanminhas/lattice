export default function LoginPage({ onLogin }) {
  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-card">
          <div style={{ marginBottom: 28 }}>
            <div className="hero-kicker" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)', marginBottom: 16 }}>
              Lattice Access
            </div>
            <h1 style={{ fontSize: 34, color: 'var(--color-text)', marginBottom: 10, fontFamily: 'var(--font-display)', letterSpacing: '-1.2px' }}>
              Enter the programme orchestration workspace.
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              Use one of the demo roles below to move through the organisation, programme, startup, and contributor flows.
            </p>
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
        <div className="hero-kicker">Programme-First Relationship Engine</div>
        <h2 style={{ fontSize: 48, marginBottom: 20, fontFamily: 'var(--font-display)', letterSpacing: '-2px' }}>
          Govern startup support with structured programme context.
        </h2>
        <p style={{ fontSize: 18, color: '#c5d2df', lineHeight: 1.75, maxWidth: 560, marginBottom: 26 }}>
          Lattice routes startups into programmes first, attaches mentors and resource actors through approved pools,
          and turns every meaningful linkage into an outcome-tracked relationship instead of a one-off assignment.
        </p>
        <div className="hero-chip-grid" style={{ maxWidth: 520 }}>
          <div className="hero-chip">
            <strong>1. Admit through programmes</strong>
            <span>AI recommends startup-to-programme fit before any startup gets access to mentors or resources.</span>
          </div>
          <div className="hero-chip">
            <strong>2. Govern actor pools</strong>
            <span>Mentors, partners, investors, and service providers become available through programme-level approvals.</span>
          </div>
          <div className="hero-chip">
            <strong>3. Learn from outcomes</strong>
            <span>Each relationship closes the loop with structured feedback and reusable matching patterns.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
