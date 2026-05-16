import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ScoreBadge, StatusPill, Spinner, Badge } from '../components/Shared';

export default function CompanyDashboard({ user }) {
  const [matches, setMatches] = useState([]);
  const [contributors, setContributors] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Load contributor names for display
      const contSnap = await getDocs(collection(db, 'contributors'));
      const contMap = {};
      contSnap.forEach((d) => { contMap[d.id] = d.data().name; });
      setContributors(contMap);

      // Find matches where target company is user.id
      const q = query(collection(db, 'relationships'), where('sourceId', '==', user.id));
      const snap = await getDocs(q);
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      list.sort((a, b) => (b.aiMatchScore || 0) - (a.aiMatchScore || 0));
      setMatches(list);
      setLoading(false);
    }
    load();
  }, [user.id]);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="page-header">
        <h2>Welcome, {user.name}</h2>
        <p>Your personalized startup dashboard and AI-recommended connections.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">AI Matches Found</div>
          <div className="stat-value">{matches.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Connections</div>
          <div className="stat-value">{matches.filter(m => m.status === 'Active').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Profile Readiness</div>
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>High</div>
          <div className="stat-sub">Optimized for matching</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Your Recommended Mentors & Partners</h3>
        </div>
        {matches.length === 0 ? (
          <div className="empty-state"><p>No recommendations yet. The AI is still analyzing your profile.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contributor Name</th>
                <th>Match Score</th>
                <th>Why It's a Match</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{contributors[m.targetId] || m.targetId}</td>
                  <td><ScoreBadge score={m.aiMatchScore} /></td>
                  <td className="match-explanation">{m.aiExplanation}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td>
                    {m.status === 'Approved' ? (
                      <button className="btn btn-sm btn-primary">Connect</button>
                    ) : (
                      <button className="btn btn-sm btn-outline" disabled>Pending Admin</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
