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
      const [contributorSnap, poolSnap] = await Promise.all([
        getDocs(collection(db, 'contributors')),
        getDocs(collection(db, 'programmeContributors')),
      ]);

      const contributorList = [];
      contributorSnap.forEach((doc) => contributorList.push({ id: doc.id, ...doc.data() }));

      const counts = {};
      poolSnap.forEach((doc) => {
        const item = doc.data();
        counts[item.contributorId] = (counts[item.contributorId] || 0) + 1;
      });

      setContributors(contributorList);
      setPoolCounts(counts);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const types = [...new Set(contributors.flatMap((item) => item.contributorTypes || [item.type]).filter(Boolean))];

  const filtered = contributors.filter((item) => {
    const contributorTypes = item.contributorTypes || [item.type];
    if (filterType && !contributorTypes.includes(filterType)) return false;
    if (filterAvail && item.availability !== filterAvail) return false;
    return true;
  });

  return (
    <div>
      <div className="hero-panel page-hero-compact">
        <div className="hero-kicker">Contributor Registry</div>
        <div className="hero-title-row">
          <div>
            <h2>Maintain a governed view of mentors and resource actors.</h2>
            <p>
              Contributor records are screened through type, availability, expertise, and programme-pool placement
              to keep downstream recommendations reliable and operationally practical.
            </p>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{contributors.length} contributor records</strong>
              <span>Mentors, investors, partners, and service providers are held in one structured registry.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-header">
        <h2>Contributors</h2>
        <p>{contributors.length} mentors, partners, investors, and service providers governed through programme pools</p>
      </div>

      <div className="filter-bar">
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Types</option>
          {types.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value)}>
          <option value="">All Availability</option>
          <option value="Available">Available</option>
          <option value="Limited">Limited</option>
          <option value="Unavailable">Unavailable</option>
        </select>
      </div>

      <div className="card-grid">
        {filtered.map((item) => (
          <div key={item.id} className="entity-card entity-card-static">
            <div className="entity-card-top">
              <div>
                <h4>{item.name}</h4>
                <div className="entity-meta">{(item.contributorTypes || [item.type]).join(', ')}</div>
              </div>
              <Badge variant={item.availability === 'Available' ? 'green' : item.availability === 'Limited' ? 'yellow' : 'red'}>
                {item.availability}
              </Badge>
            </div>
            <div className="entity-tags entity-tag-row">
              {(item.expertise || item.investmentThesis || []).slice(0, 4).map((tag) => (
                <Badge key={tag} variant="blue">{tag}</Badge>
              ))}
            </div>
            <div className="entity-summary entity-summary-tight">
              Supports {item.supportedStages?.join(', ') || item.stages?.join(', ') || 'programme-specific stages'}
            </div>
            <div className="entity-facts">
              <div className="entity-fact"><span>Programme Pools</span><strong>{poolCounts[item.id] || 0}</strong></div>
              <div className="entity-fact"><span>Coverage</span><strong>{item.countryCoverage?.length || 0}</strong></div>
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
