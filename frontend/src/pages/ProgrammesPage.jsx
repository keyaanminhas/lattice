import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../firebase';
import { Badge, StatusPill, Spinner } from '../components/Shared';
import { canPerformAction } from '../config/accessPolicy';

export default function ProgrammesPage({ user }) {
  const [programmes, setProgrammes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({});
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [pSnap, aSnap, poolSnap, relSnap] = await Promise.all([
        getDocs(collection(db, 'programmes')), getDocs(collection(db, 'applications')),
        getDocs(collection(db, 'programmeContributors')), getDocs(collection(db, 'relationships')),
      ]);
      const list = []; pSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      const agg = {};
      aSnap.forEach((d) => {
        const v = d.data();
        agg[v.programmeId] ||= { apps: 0, pendingApps: 0, accepted: 0, pools: 0, pendingConnections: 0, mentors: 0 };
        agg[v.programmeId].apps++;
        if (v.status === 'Pending Admin Review') agg[v.programmeId].pendingApps++;
        if (v.status === 'Accepted') agg[v.programmeId].accepted++;
      });
      poolSnap.forEach((d) => {
        const v = d.data();
        agg[v.programmeId] ||= { apps: 0, pendingApps: 0, accepted: 0, pools: 0, pendingConnections: 0, mentors: 0 };
        if (v.status === 'Approved') agg[v.programmeId].pools++;
        if (v.status === 'Pending Approval') agg[v.programmeId].pendingConnections++;
      });
      relSnap.forEach((d) => {
        const v = d.data();
        agg[v.programmeId] ||= { apps: 0, pendingApps: 0, accepted: 0, pools: 0, pendingConnections: 0, mentors: 0 };
        if (v.relationshipType === 'Startup-to-Mentor' && v.status !== 'Rejected') agg[v.programmeId].mentors++;
      });
      setProgrammes(list); setStats(agg); setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;
  const filterStatus = searchParams.get('status') || '';
  const queue = searchParams.get('queue') || '';
  const filtered = programmes.filter((p) => {
    const s = stats[p.id] || { pendingApps: 0, pendingConnections: 0, accepted: 0, mentors: 0 };
    if (filterStatus && p.status !== filterStatus) return false;
    if (queue === 'applications' && s.pendingApps <= 0) return false;
    if (queue === 'connections' && s.pendingConnections <= 0) return false;
    if (queue === 'mentor-generation' && s.accepted <= s.mentors) return false;
    return true;
  });
  const canCreateProgramme = canPerformAction(user?.roleKey, 'create_programme');

  function updateSearchParams(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    setSearchParams(params);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Programmes</h2>
          <p className="page-subtitle">{programmes.length} programme contexts for admissions, pools, and mentor relationships.</p>
        </div>
        {canCreateProgramme ? (
          <button className="btn btn-primary" onClick={() => navigate('/programmes/create')}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span> Create Programme
          </button>
        ) : null}
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-label">Total</div><div className="stat-card-value">{programmes.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Open</div><div className="stat-card-value accent">{programmes.filter((p) => p.status === 'Open').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Active</div><div className="stat-card-value">{programmes.filter((p) => p.status === 'Active').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Closed</div><div className="stat-card-value">{programmes.filter((p) => p.status === 'Closed').length}</div></div>
      </div>

      <div className="filter-bar">
        <select className="filter-input" value={filterStatus} onChange={(e) => updateSearchParams({ status: e.target.value })}>
          <option value="">All Statuses</option><option value="Open">Open</option><option value="Active">Active</option><option value="Draft">Draft</option><option value="Closed">Closed</option>
        </select>
        <select className="filter-input" value={queue} onChange={(e) => updateSearchParams({ queue: e.target.value })}>
          <option value="">All Queues</option>
          <option value="applications">Pending Applications</option>
          <option value="connections">Pending Connections</option>
          <option value="mentor-generation">Mentor Generation Needed</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-header"><span className="table-meta">Showing {filtered.length} of {programmes.length}</span></div>
        {filtered.length === 0 ? <div className="empty-state">No programmes match your filter.</div> : (
          <table className="data-table">
            <thead><tr><th>Programme</th><th>Type</th><th>Status</th><th>Outcomes</th><th style={{ textAlign: 'right' }}>Apps</th><th style={{ textAlign: 'right' }}>Admitted</th><th style={{ textAlign: 'right' }}>Pool</th><th style={{ textAlign: 'right' }}>Mentors</th><th></th></tr></thead>
            <tbody>{filtered.map((p) => {
              const s = stats[p.id] || { apps: 0, pendingApps: 0, accepted: 0, pools: 0, pendingConnections: 0, mentors: 0 };
              const detailSection = queue === 'applications' ? 'applications' : queue === 'connections' ? 'connections' : queue === 'mentor-generation' ? 'mentor-generation' : '';
              const detailTarget = detailSection ? `/programmes/${p.id}?section=${detailSection}` : `/programmes/${p.id}`;
              return (
                <tr key={p.id} onClick={() => navigate(detailTarget)} style={{ cursor: 'pointer' }}>
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
