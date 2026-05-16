import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Badge, Spinner } from '../components/Shared';

export default function ContributorsPage() {
  const [contributors, setContributors] = useState([]);
  const [poolCounts, setPoolCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterAvail, setFilterAvail] = useState('');

  useEffect(() => {
    async function load() {
      const [cSnap, pSnap] = await Promise.all([
        getDocs(collection(db, 'contributors')),
        getDocs(collection(db, 'programmeContributors')),
      ]);
      const list = [];
      cSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      const counts = {};
      pSnap.forEach((d) => {
        const v = d.data();
        counts[v.contributorId] = (counts[v.contributorId] || 0) + 1;
      });
      setContributors(list);
      setPoolCounts(counts);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const types = [...new Set(contributors.flatMap((c) => c.contributorTypes || [c.type]).filter(Boolean))];
  const filtered = contributors.filter((c) => {
    const ct = c.contributorTypes || [c.type];
    if (filterType && !ct.includes(filterType)) return false;
    if (filterAvail && c.availability !== filterAvail) return false;
    return true;
  });

  const ac = {
    Available: { dot: '#4caf50', bg: '#e8f5e9', text: '#1b5e20' },
    Limited: { dot: '#ff9800', bg: '#fff3e0', text: '#e65100' },
    Unavailable: { dot: '#ba1a1a', bg: '#ffdad6', text: '#ba1a1a' },
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-title">Contributors</h2>
        <p className="page-subtitle">{contributors.length} mentors, partners, investors, and service providers.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-label">Total</div><div className="stat-card-value">{contributors.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Available</div><div className="stat-card-value accent">{contributors.filter((c) => c.availability === 'Available').length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Types</div><div className="stat-card-value">{types.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">In Pools</div><div className="stat-card-value">{Object.values(poolCounts).reduce((a, b) => a + b, 0)}</div></div>
      </div>

      <div className="filter-bar">
        <select className="filter-input" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="filter-input" value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}>
          <option value="">All Availability</option>
          <option value="Available">Available</option>
          <option value="Limited">Limited</option>
          <option value="Unavailable">Unavailable</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-header">
          <span className="table-meta">Showing {filtered.length} of {contributors.length}</span>
        </div>
        {filtered.length === 0 ? (
          <div className="empty-state">No contributors match your filters.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Availability</th>
                <th>Expertise</th>
                <th>Stages</th>
                <th style={{ textAlign: 'right' }}>Pools</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const colors = ac[c.availability] || { dot: '#737686', bg: '#eceef0', text: '#434655' };
                return (
                  <tr key={c.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar avatar-sm avatar-gray">{c.name?.substring(0, 2).toUpperCase()}</div>
                        <span className="cell-bold">{c.name}</span>
                      </div>
                    </td>
                    <td>{(c.contributorTypes || [c.type]).join(', ')}</td>
                    <td>
                      <span className="status-pill" style={{ background: colors.bg, color: colors.text }}>
                        <span className="status-dot" style={{ background: colors.dot }}></span>
                        {c.availability}
                      </span>
                    </td>
                    <td>
                      <div className="tag-list">
                        {(c.expertise || c.investmentThesis || []).slice(0, 3).map((t) => (
                          <Badge key={t} variant="blue">{t}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="cell-muted">{c.supportedStages?.join(', ') || '—'}</td>
                    <td style={{ textAlign: 'right' }} className="cell-bold">{poolCounts[c.id] || 0}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
