import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Badge, StarRating, Spinner } from '../components/Shared';

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [stats, setStats] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOutcomes() {
      const snap = await getDocs(collection(db, 'outcomes'));
      const list = [];
      snap.forEach((item) => list.push({ id: item.id, ...item.data() }));
      setOutcomes(list);
    }
    loadOutcomes();
  }, []);

  async function generateInsights() {
    setLoading(true);
    try {
      const getInsights = httpsCallable(functions, 'get_ai_insights');
      const result = await getInsights({});
      setInsights(result.data.insights);
      setStats(result.data.stats);
    } catch (error) {
      console.error('Failed to get insights:', error);
      alert('Failed to generate insights. The AI may be rate-limited.');
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="hero-panel page-hero-compact">
        <div className="hero-kicker">AI Intelligence Layer</div>
        <div className="hero-title-row">
          <div>
            <h2>Review system-wide demand, outcome quality, and reusable learning patterns.</h2>
            <p>
              This view translates Lattice activity into portfolio-level signals so programme leads can understand
              demand pressure, delivery quality, and where the matching system is strongest or weakest.
            </p>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{outcomes.length} recorded outcomes</strong>
              <span>Each completed relationship adds more evidence for future recommendation quality.</span>
            </div>
            {stats ? (
              <div className="hero-chip">
                <strong>{stats.graphEdges || 0} graph edges</strong>
                <span>The materialized graph layer now feeds retrieval, ranking, and evidence panels.</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={generateInsights} disabled={loading}>
          {loading ? 'Generating Insights...' : 'Generate AI Insights'}
        </button>
      </div>

      {loading && <Spinner />}

      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
          {insights.map((insight, index) => (
            <div key={index} className={`insight-card severity-${insight.severity}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Badge variant={insight.severity === 'high' ? 'red' : insight.severity === 'medium' ? 'yellow' : 'green'}>
                  {insight.severity?.toUpperCase()}
                </Badge>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>{insight.type}</span>
              </div>
              <h4>{insight.title}</h4>
              <p>{insight.description}</p>
            </div>
          ))}
        </div>
      )}

      {stats && (
        <div className="two-col" style={{ marginBottom: 28 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Startup Demand Signals</h3>
            {Object.entries(stats.startupSupportNeeds || {})
              .sort((left, right) => right[1] - left[1])
              .map(([need, count]) => (
                <div key={need} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13 }}>{need}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{count}</span>
                </div>
              ))}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Programme Outcome Demand</h3>
            {Object.entries(stats.programmeOutcomeDemand || {})
              .sort((left, right) => right[1] - left[1])
              .map(([outcome, count]) => (
                <div key={outcome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13 }}>{outcome}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {stats?.programmeGraphGaps?.length ? (
        <div className="card" style={{ marginBottom: 28 }}>
          <div className="card-header">
            <h3>Programme Graph Gaps</h3>
          </div>
          <div className="stack-list">
            {stats.programmeGraphGaps.slice(0, 6).map((programme) => (
              <div key={programme.programmeId} className="stack-item recommendation-item">
                <div className="stack-item-header">
                  <div className="stack-item-title">{programme.programmeName}</div>
                  <Badge variant="gray">{programme.counts?.graphEdges || 0} edges</Badge>
                </div>
                {(programme.gaps || []).slice(0, 2).map((gap) => (
                  <div key={`${programme.programmeId}-${gap.summary}`} style={{ marginTop: 8 }}>
                    <p style={{ fontSize: 13, marginBottom: 4 }}>
                      <strong>{gap.severity.toUpperCase()}</strong> {gap.summary}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{gap.suggestedAction}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-header">
          <h3>Outcome History &amp; AI Lessons</h3>
        </div>
        {outcomes.length === 0 ? (
          <div className="empty-state"><p>No outcomes recorded yet.</p></div>
        ) : (
          <div className="stack-list">
            {outcomes.map((item) => (
              <div key={item.id} className="stack-item recommendation-item">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
                  <Badge variant={item.outcomeAchieved === 'Yes' ? 'green' : item.outcomeAchieved === 'Partial' ? 'yellow' : 'red'}>
                    {item.outcomeAchieved}
                  </Badge>
                  <Badge variant="gray">{item.relationshipQuality} Quality</Badge>
                </div>
                <div className="ai-score-grid">
                  <div className="ai-score-card">
                    <span>Startup Rating</span>
                    <strong>{item.startupRating}/5</strong>
                    <StarRating value={item.startupRating} caption="Founder experience" />
                  </div>
                  <div className="ai-score-card">
                    <span>Contributor Rating</span>
                    <strong>{item.contributorRating}/5</strong>
                    <StarRating value={item.contributorRating} caption="Contributor experience" />
                  </div>
                </div>
                <p style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Startup:</strong> "{item.startupFeedback}"
                </p>
                <p style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Contributor:</strong> "{item.contributorFeedback}"
                </p>
                <p style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Admin:</strong> {item.adminEvaluation}
                </p>
                {item.aiLesson && (
                  <p style={{ fontSize: 12, color: 'var(--color-primary)', fontStyle: 'italic', marginTop: 6 }}>
                    Lesson: {item.aiLesson}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
