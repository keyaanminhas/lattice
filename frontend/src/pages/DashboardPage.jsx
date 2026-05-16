import { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { ScoreBadge, StatusPill, Spinner } from '../components/Shared';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        // Load dashboard stats from Cloud Function
        const getStats = httpsCallable(functions, 'get_dashboard_stats');
        const result = await getStats({});
        setStats(result.data);
      } catch (e) {
        console.error('Failed to load stats:', e);
      }

      try {
        // Load recent relationships from Firestore
        const q = query(collection(db, 'relationships'), limit(5));
        const snap = await getDocs(q);
        const matches = [];
        snap.forEach((doc) => matches.push({ id: doc.id, ...doc.data() }));
        setRecentMatches(matches);
      } catch (e) {
        console.error('Failed to load matches:', e);
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Ecosystem overview and AI-powered insights</p>
      </div>

      {/* Stat Cards */}
      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Active Programmes</div>
            <div className="stat-value">{stats.activeProgrammes}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Companies</div>
            <div className="stat-value">{stats.totalCompanies}</div>
            <div className="stat-sub">{stats.verifiedCompanies} verified · {stats.pendingCompanies} pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Contributors</div>
            <div className="stat-value">{stats.totalContributors}</div>
            <div className="stat-sub">{stats.availableContributors} available</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">AI Matches</div>
            <div className="stat-value">{stats.totalRelationships}</div>
            <div className="stat-sub">{stats.pendingRecommendations} pending review</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Capacity Used</div>
            <div className="stat-value">{stats.contributorCapacity}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Success Rate</div>
            <div className="stat-value">{stats.outcomeSuccessRate}%</div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 28 }}>
        <button className="btn btn-primary" onClick={() => navigate('/matches')}>View AI Matches</button>
        <button className="btn btn-outline" onClick={() => navigate('/companies')}>Browse Companies</button>
        <button className="btn btn-outline" onClick={() => navigate('/insights')}>View Insights</button>
      </div>

      {/* Recent Matches */}
      <div className="card">
        <div className="card-header">
          <h3>Recent AI Matches</h3>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/matches')}>View All</button>
        </div>
        {recentMatches.length === 0 ? (
          <div className="empty-state"><p>No matches generated yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Company</th>
                <th>Contributor</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentMatches.map((m) => (
                <tr key={m.id}>
                  <td>{m.type}</td>
                  <td>{m.sourceId}</td>
                  <td>{m.targetId}</td>
                  <td><ScoreBadge score={m.aiMatchScore} /></td>
                  <td><StatusPill status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
