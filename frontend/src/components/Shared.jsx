export function Badge({ children, variant = 'blue' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function StarRating({ value = 0, max = 5, caption = '' }) {
  const rounded = Math.max(0, Math.min(max, Math.round(value)));
  const stars = Array.from({ length: max }, (_, index) => (
    <span key={`${caption}-${index}`} className={index < rounded ? 'star-filled' : 'star-empty'}>
      ★
    </span>
  ));

  return (
    <span className="star-rating" aria-label={`${value} out of ${max} stars`}>
      <span className="star-row">{stars}</span>
      {caption ? <span className="star-caption">{caption}</span> : null}
    </span>
  );
}

export function ScoreBadge({ score, label }) {
  let cls = 'score-low';
  let tier = label || 'Developing';
  if (score >= 80) cls = 'score-high';
  if (score >= 80) tier = label || 'Strong';
  else if (score >= 65) {
    cls = 'score-medium';
    tier = label || 'Moderate';
  }

  const starValue = Math.max(1, Math.min(5, Math.round(score / 20)));

  return (
    <span className={`score-badge ${cls}`}>
      <span className="score-badge-value">{Math.round(score)}%</span>
      <StarRating value={starValue} caption={tier} />
    </span>
  );
}

export function StatusPill({ status }) {
  const map = {
    Open: 'blue',
    Accepted: 'green',
    Recommended: 'blue',
    Approved: 'green',
    Active: 'green',
    Completed: 'gray',
    Rejected: 'red',
    'Needs Review': 'yellow',
    'Pending Approval': 'yellow',
    'Pending Admin Review': 'yellow',
    Verified: 'green',
    Pending: 'yellow',
    Draft: 'gray',
  };
  return <Badge variant={map[status] || 'gray'}>{status}</Badge>;
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
