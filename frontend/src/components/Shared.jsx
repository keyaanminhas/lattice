export function Badge({ children, variant = 'blue' }) {
  return <span className={`badge badge-${variant}`}>{children}</span>;
}

export function ScoreBadge({ score }) {
  let cls = 'score-low';
  if (score >= 80) cls = 'score-high';
  else if (score >= 65) cls = 'score-medium';
  return <span className={`score-badge ${cls}`}>{score}%</span>;
}

export function StatusPill({ status }) {
  const map = {
    Recommended: 'blue',
    Approved: 'green',
    Active: 'green',
    Completed: 'gray',
    Rejected: 'red',
    'Needs Review': 'yellow',
    'Pending Approval': 'yellow',
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
