export function Badge({ children, variant = 'blue' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StarRating({ value = 0, max = 5, caption = '' }) {
  const rounded = Math.max(0, Math.min(max, Math.round(value)));
  const stars = Array.from({ length: max }, (_, index) => (
    <span key={`${caption}-${index}`} style={{ color: index < rounded ? '#f59e0b' : '#d1d5db' }}>★</span>
  ));
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
      <span style={{ display: 'inline-flex', gap: 1 }}>{stars}</span>
      {caption ? <span style={{ opacity: 0.8 }}>{caption}</span> : null}
    </span>
  );
}

export function ScoreBadge({ score, label }) {
  let cls = 'badge-gray';
  let tier = label || 'Developing';
  if (score >= 80) { cls = 'badge-green'; tier = label || 'Strong'; }
  else if (score >= 65) { cls = 'badge-yellow'; tier = label || 'Moderate'; }

  return (
    <span className={`score-badge badge ${cls}`}>
      <span>{Math.round(score)}%</span>
      <span className="score-tier">{tier}</span>
    </span>
  );
}

export function StatusPill({ status }) {
  const colorMap = {
    Open: { dot: '#2196f3', bg: '#e3f2fd', text: '#0d47a1' },
    Accepted: { dot: '#4caf50', bg: '#e8f5e9', text: '#1b5e20' },
    Recommended: { dot: '#2196f3', bg: '#e3f2fd', text: '#0d47a1' },
    Approved: { dot: '#4caf50', bg: '#e8f5e9', text: '#1b5e20' },
    Active: { dot: '#4caf50', bg: '#e8f5e9', text: '#1b5e20' },
    Completed: { dot: '#737686', bg: '#eceef0', text: '#191c1e' },
    Rejected: { dot: '#ba1a1a', bg: '#ffdad6', text: '#ba1a1a' },
    'Needs Review': { dot: '#ff9800', bg: '#fff3e0', text: '#e65100' },
    'Pending Approval': { dot: '#ff9800', bg: '#fff3e0', text: '#e65100' },
    'Pending Admin Review': { dot: '#ff9800', bg: '#fff3e0', text: '#e65100' },
    Verified: { dot: '#4caf50', bg: '#e8f5e9', text: '#1b5e20' },
    Pending: { dot: '#ff9800', bg: '#fff3e0', text: '#e65100' },
    Draft: { dot: '#737686', bg: '#eceef0', text: '#434655' },
    Available: { dot: '#4caf50', bg: '#e8f5e9', text: '#1b5e20' },
    Limited: { dot: '#ff9800', bg: '#fff3e0', text: '#e65100' },
    Unavailable: { dot: '#ba1a1a', bg: '#ffdad6', text: '#ba1a1a' },
    Closed: { dot: '#737686', bg: '#eceef0', text: '#434655' },
    Suspended: { dot: '#ba1a1a', bg: '#ffdad6', text: '#ba1a1a' },
  };
  const c = colorMap[status] || { dot: '#737686', bg: '#eceef0', text: '#434655' };

  return (
    <span className="status-pill" style={{ background: c.bg, color: c.text }}>
      <span className="status-dot" style={{ background: c.dot }}></span>
      {status}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="loading-container">
      <div className="spinner" />
    </div>
  );
}

export function ScoreBreakdown({ breakdown }) {
  if (!breakdown) return null;

  const items = [
    ['Rule', breakdown.ruleScore],
    ['Semantic', breakdown.semanticScore],
    ['Graph', breakdown.graphScore],
  ].filter(([, value]) => typeof value === 'number');

  if (items.length === 0) return null;

  return (
    <div className="recommendation-meta" style={{ gap: 10 }}>
      {items.map(([label, value]) => (
        <span key={label} className="meta-chip">{label}: {Math.round(value)}%</span>
      ))}
    </div>
  );
}

export function GraphEvidence({ evidence }) {
  if (!evidence) return null;
  const edges = evidence.edges || [];
  const signals = evidence.pastOutcomeSignals || [];
  const risks = evidence.riskFlags || [];

  if (edges.length === 0 && signals.length === 0 && risks.length === 0) return null;

  return (
    <div className="stack-list" style={{ gap: 10, marginTop: 12 }}>
      {edges.slice(0, 3).map((item) => (
        <div key={item} className="stack-item" style={{ padding: '10px 12px' }}>
          <div className="stack-item-copy"><strong>Edge:</strong> {item}</div>
        </div>
      ))}
      {signals.slice(0, 2).map((item) => (
        <div key={item} className="stack-item" style={{ padding: '10px 12px' }}>
          <div className="stack-item-copy"><strong>Outcome Signal:</strong> {item}</div>
        </div>
      ))}
      {risks.slice(0, 2).map((item) => (
        <div key={item} className="stack-item" style={{ padding: '10px 12px' }}>
          <div className="stack-item-copy"><strong>Risk:</strong> {item}</div>
        </div>
      ))}
    </div>
  );
}
