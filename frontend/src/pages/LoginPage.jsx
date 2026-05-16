export default function LoginPage({ onLogin }) {
  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-card">
          <div className="login-card-header">
            <div className="hero-kicker login-kicker">
              Lattice Access
            </div>
            <h1 className="login-title">
              Enter the programme orchestration workspace.
            </h1>
            <p className="login-copy">
              Select a demonstration role to inspect the administration, startup, or contributor experience in a controlled environment.
            </p>
          </div>

          <button className="role-button" onClick={() => onLogin({ role: 'admin', name: 'System Admin' })}>
            <span className="role-mark">AD</span>
            <span className="role-content">
              <strong>Ecosystem Admin</strong>
              <small>Review recommendation queues, programme health, approvals, and strategic intelligence.</small>
            </span>
          </button>

          <button className="role-button" onClick={() => onLogin({ role: 'company', id: 'comp-1', name: 'MediScan AI' })}>
            <span className="role-mark">ST</span>
            <span className="role-content">
              <strong>Startup / Company</strong>
              <small>Review programme applications, AI summaries, and the mentor activation pathway.</small>
            </span>
          </button>

          <button className="role-button" onClick={() => onLogin({ role: 'contributor', id: 'cont-1', name: 'Dr. Sarah Lim' })}>
            <span className="role-mark">CT</span>
            <span className="role-content">
              <strong>Contributor / Mentor</strong>
              <small>Inspect approved programme assignments and governed startup mentorship relationships.</small>
            </span>
          </button>
        </div>
      </div>
      <div className="login-right">
        <div className="hero-kicker">Programme-First Relationship Engine</div>
        <h2 className="login-panel-title">
          Govern startup support with structured programme context.
        </h2>
        <p className="login-panel-copy">
          Lattice routes startups into programmes first, attaches mentors and resource actors through approved pools,
          and turns every meaningful linkage into an outcome-tracked relationship instead of a one-off assignment.
        </p>
        <div className="hero-chip-grid login-chip-grid">
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
