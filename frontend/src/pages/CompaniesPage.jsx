import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Badge, StatusPill, Spinner } from '../components/Shared';

export default function CompaniesPage() {
  const [startups, setStartups] = useState([]);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const [sSnap, aSnap] = await Promise.all([getDocs(collection(db, 'companies')), getDocs(collection(db, 'applications'))]);
      const list = []; sSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      const counts = {}; aSnap.forEach((d) => { const v = d.data(); counts[v.startupId] = (counts[v.startupId] || 0) + 1; });
      setStartups(list); setApplicationCounts(counts); setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const industries = [...new Set(startups.map((s) => s.industry || s.sector).filter(Boolean))];
  const stages = [...new Set(startups.map((s) => s.stage).filter(Boolean))];
  const filtered = startups.filter((s) => {
    if (filterIndustry && (s.industry || s.sector) !== filterIndustry) return false;
    if (filterStage && s.stage !== filterStage) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Startup Directory</h2>
          <p className="page-subtitle">Manage and review {startups.length} startup profiles for programme matching.</p>
        </div>
      </div>

      <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card"><div className="stat-card-label">Total Startups</div><div className="stat-card-value">{startups.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Filtered</div><div className="stat-card-value accent">{filtered.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Verified</div><div className="stat-card-value">{startups.filter((s) => s.verificationStatus === 'Verified').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Sectors</div><div className="stat-card-value">{industries.length}</div></div>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <span className="material-symbols-outlined">search</span>
          <input className="filter-input" placeholder="Search startups..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ width: '100%', paddingLeft: 34 }} />
        </div>
        <select className="filter-input" value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}>
          <option value="">All Sectors</option>{industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select className="filter-input" value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>{stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-container">
        <div className="table-header"><span className="table-meta">Showing {filtered.length} of {startups.length}</span></div>
        {filtered.length === 0 ? <div className="empty-state">No startups match your filters.</div> : (
          <table className="data-table">
            <thead><tr><th>Name</th><th>Sector</th><th>Stage</th><th>Status</th><th>Apps</th><th>Needs</th><th></th></tr></thead>
            <tbody>{filtered.map((s) => (
              <tr key={s.id} onClick={() => navigate(`/companies/${s.id}`)} style={{ cursor: 'pointer' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar avatar-sm avatar-blue">{s.name?.substring(0, 2).toUpperCase()}</div>
                    <div><div className="cell-bold">{s.name}</div><div className="cell-muted">{s.country} · {s.teamSize} members</div></div>
                  </div>
                </td>
                <td>{s.industry || s.sector}</td>
                <td>{s.stage}</td>
                <td><StatusPill status={s.verificationStatus} /></td>
                <td className="cell-bold">{applicationCounts[s.id] || 0}</td>
                <td><div className="tag-list">{s.supportNeeds?.slice(0, 2).map((n) => <Badge key={n} variant="blue">{n}</Badge>)}</div></td>
                <td><span className="material-symbols-outlined" style={{ color: '#c3c6d7' }}>chevron_right</span></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
