import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Badge, Spinner } from '../components/Shared';

export default function ContributorsPage() {
  const [contributors, setContributors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterAvail, setFilterAvail] = useState('');

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'contributors'));
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setContributors(list);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const types = [...new Set(contributors.map((c) => c.type))];

  const filtered = contributors.filter((c) => {
    if (filterType && c.type !== filterType) return false;
    if (filterAvail && c.availability !== filterAvail) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Contributors</h2>
        <p>{contributors.length} mentors, partners, investors &amp; service providers</p>
      </div>

      <div className="filter-bar">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}>
          <option value="">All Availability</option>
          <option value="Available">Available</option>
          <option value="Limited">Limited</option>
          <option value="Unavailable">Unavailable</option>
        </select>
      </div>

      <div className="card-grid">
        {filtered.map((c) => (
          <div key={c.id} className="entity-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h4>{c.name}</h4>
                <div className="entity-meta">{c.type} · {c.organization}</div>
              </div>
              <Badge variant={c.availability === 'Available' ? 'green' : c.availability === 'Limited' ? 'yellow' : 'red'}>
                {c.availability}
              </Badge>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 10 }}>
              Capacity: <strong>{c.capacity}</strong> engagements
              {c.rating && <> · Rating: <strong>{c.rating}</strong>/5</>}
            </div>
            <div className="entity-tags">
              {c.expertise?.map((e) => <Badge key={e} variant="blue">{e}</Badge>)}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
              Stages: {c.supportedStages?.join(', ')}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state"><p>No contributors match your filters.</p></div>
      )}
    </div>
  );
}
