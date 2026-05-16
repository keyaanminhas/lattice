import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Badge, Spinner } from '../components/Shared';

export default function InsightsPage() {
  const [insights, setInsights] = useState(null);
  const [stats, setStats] = useState(null);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadOutcomes() {
      const snap = await getDocs(collection(db, 'outcomes'));
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
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
    } catch (e) {
      console.error('Failed to get insights:', e);
      alert('Failed to generate insights. The AI may be rate-limited. Try again in a minute.');
    }
    setLoading(false);
  }

  return (
    <div>
      <div className="page-header">
        <h2>AI Insights</h2>
        <p>AI-powered ecosystem health analysis</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <button className="btn btn-primary" onClick={generateInsights} disabled={loading}>
          {loading ? 'Generating Insights...' : 'Generate AI Insights'}
        </button>
      </div>

      {loading && <Spinner />}

      {/* AI Insight Cards */}
      {insights && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginBottom: 28 }}>
          {insights.map((insight, i) => (
            <div key={i} className={`insight-card severity-${insight.severity}`}>
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

      {/* Ecosystem Stats */}
      {stats && (
        <div className="two-col" style={{ marginBottom: 28 }}>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Support Needs (Demand)</h3>
            {Object.entries(stats.companySupportNeeds || {})
              .sort((a, b) => b[1] - a[1])
              .map(([need, count]) => (
                <div key={need} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13 }}>{need}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 80, height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
                      <div style={{ width: `${Math.min(count * 20, 100)}%`, height: '100%', background: 'var(--color-primary)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: 20 }}>{count}</span>
                  </div>
                </div>
              ))}
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 16 }}>Contributor Expertise (Supply)</h3>
            {Object.entries(stats.contributorExpertise || {})
              .sort((a, b) => b[1] - a[1])
              .map(([exp, count]) => (
                <div key={exp} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: 13 }}>{exp}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Outcomes / Lessons */}
      <div className="card">
        <div className="card-header">
          <h3>Outcome History &amp; Lessons Learned</h3>
        </div>
        {outcomes.length === 0 ? (
          <div className="empty-state"><p>No outcomes recorded yet.</p></div>
        ) : (
          <div>
            {outcomes.map((o) => (
              <div key={o.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--color-border)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                  <Badge variant={o.outcomeAchieved === 'Yes' ? 'green' : o.outcomeAchieved === 'Partial' ? 'yellow' : 'red'}>
                    {o.outcomeAchieved}
                  </Badge>
                  <Badge variant="gray">{o.relationshipQuality} Quality</Badge>
                </div>
                <p style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Company:</strong> "{o.companyFeedback}" ({o.companyRating}/5)
                </p>
                <p style={{ fontSize: 13, marginBottom: 4 }}>
                  <strong>Contributor:</strong> "{o.contributorFeedback}" ({o.contributorRating}/5)
                </p>
                {o.lessonLearned && (
                  <p style={{ fontSize: 12, color: 'var(--color-primary)', fontStyle: 'italic', marginTop: 6 }}>
                    Lesson: {o.lessonLearned}
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
