import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { ScoreBadge, StatusPill, Spinner, Badge } from '../components/Shared';

export default function ContributorDashboard({ user }) {
  const [matches, setMatches] = useState([]);
  const [companies, setCompanies] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Load company names for display
      const compSnap = await getDocs(collection(db, 'companies'));
      const compMap = {};
      compSnap.forEach((d) => { compMap[d.id] = d.data().name; });
      setCompanies(compMap);

      // Find matches where target contributor is user.id
      const q = query(collection(db, 'relationships'), where('targetId', '==', user.id));
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
        <p>Review startups that the AI has matched with your expertise.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">Pending Requests</div>
          <div className="stat-value">{matches.filter(m => m.status === 'Approved').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Mentees / Partners</div>
          <div className="stat-value">{matches.filter(m => m.status === 'Active').length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Your Capacity</div>
          <div className="stat-value">Available</div>
          <div className="stat-sub">You can take 3 more startups</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Connection Requests</h3>
        </div>
        {matches.length === 0 ? (
          <div className="empty-state"><p>No connection requests yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Startup Name</th>
                <th>Match Score</th>
                <th>AI Synergy Notes</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {matches.map(m => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{companies[m.sourceId] || m.sourceId}</td>
                  <td><ScoreBadge score={m.aiMatchScore} /></td>
                  <td className="match-explanation">{m.aiExplanation}</td>
                  <td><StatusPill status={m.status} /></td>
                  <td>
                    {m.status === 'Approved' ? (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-sm btn-success">Accept</button>
                        <button className="btn btn-sm btn-danger">Decline</button>
                      </div>
                    ) : m.status === 'Active' ? (
                      <button className="btn btn-sm btn-outline">Message</button>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Pending Admin Review</span>
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
