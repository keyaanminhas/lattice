import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Badge, StatusPill, Spinner } from '../components/Shared';

export default function ProgrammesPage() {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [filterStatus, setFilterStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [pSnap, aSnap, poolSnap, relSnap] = await Promise.all([
        getDocs(collection(db, 'programmes')), getDocs(collection(db, 'applications')),
        getDocs(collection(db, 'programmeContributors')), getDocs(collection(db, 'relationships')),
      ]);
      const list = []; pSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      const agg = {};
      aSnap.forEach((d) => { const v = d.data(); agg[v.programmeId] ||= { apps: 0, accepted: 0, pools: 0, mentors: 0 }; agg[v.programmeId].apps++; if (v.status === 'Accepted') agg[v.programmeId].accepted++; });
      poolSnap.forEach((d) => { const v = d.data(); agg[v.programmeId] ||= { apps: 0, accepted: 0, pools: 0, mentors: 0 }; if (v.status === 'Approved') agg[v.programmeId].pools++; });
      relSnap.forEach((d) => { const v = d.data(); agg[v.programmeId] ||= { apps: 0, accepted: 0, pools: 0, mentors: 0 }; if (v.relationshipType === 'Startup-to-Mentor' && v.status !== 'Rejected') agg[v.programmeId].mentors++; });
      setProgrammes(list); setStats(agg); setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;
  const filtered = programmes.filter((p) => !filterStatus || p.status === filterStatus);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Programmes</h2>
          <p className="page-subtitle">{programmes.length} programme contexts for admissions, pools, and mentor relationships.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/programmes/create')}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Create Programme
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-label">Total</div><div className="stat-card-value">{programmes.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Open</div><div className="stat-card-value accent">{programmes.filter((p) => p.status === 'Open').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Active</div><div className="stat-card-value">{programmes.filter((p) => p.status === 'Active').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Closed</div><div className="stat-card-value">{programmes.filter((p) => p.status === 'Closed').length}</div></div>
      </div>

      <div className="filter-bar">
        <select className="filter-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option><option value="Open">Open</option><option value="Active">Active</option><option value="Draft">Draft</option><option value="Closed">Closed</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-header"><span className="table-meta">Showing {filtered.length} of {programmes.length}</span></div>
        {filtered.length === 0 ? <div className="empty-state">No programmes match your filter.</div> : (
          <table className="data-table">
            <thead><tr><th>Programme</th><th>Type</th><th>Status</th><th>Outcomes</th><th style={{ textAlign: 'right' }}>Apps</th><th style={{ textAlign: 'right' }}>Admitted</th><th style={{ textAlign: 'right' }}>Pool</th><th style={{ textAlign: 'right' }}>Mentors</th><th></th></tr></thead>
            <tbody>{filtered.map((p) => {
              const s = stats[p.id] || { apps: 0, accepted: 0, pools: 0, mentors: 0 };
              return (
                <tr key={p.id} onClick={() => navigate(`/programmes/${p.id}`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="avatar avatar-sm avatar-blue"><span className="material-symbols-outlined" style={{ fontSize: 14 }}>school</span></div>
                      <div><div className="cell-bold">{p.name}</div><div className="cell-muted">{p.country || p.region}</div></div>
                    </div>
                  </td>
                  <td>{p.type}</td>
                  <td><StatusPill status={p.status} /></td>
                  <td><div className="tag-list">{p.expectedOutcomes?.slice(0, 2).map((o) => <Badge key={o} variant="blue">{o}</Badge>)}</div></td>
                  <td style={{ textAlign: 'right' }} className="cell-bold">{s.apps}</td>
                  <td style={{ textAlign: 'right' }} className="cell-bold">{s.accepted}</td>
                  <td style={{ textAlign: 'right' }} className="cell-bold">{s.pools}</td>
                  <td style={{ textAlign: 'right' }} className="cell-bold">{s.mentors}</td>
                  <td><span className="material-symbols-outlined" style={{ color: '#c3c6d7' }}>chevron_right</span></td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
