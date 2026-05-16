import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { Badge, StatusPill, Spinner } from '../components/Shared';

export default function CompaniesPage({ user }) {
  const [startups, setStartups] = useState([]);
  const [applicationCounts, setApplicationCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const startupSnap = await getDocs(collection(db, 'companies'));

      const startupList = [];
      startupSnap.forEach((doc) => startupList.push({ id: doc.id, ...doc.data() }));
      const counts = {};
      if (user?.role === 'admin') {
        const appSnap = await getDocs(collection(db, 'applications'));
        appSnap.forEach((doc) => {
          const item = doc.data();
          counts[item.startupId] = (counts[item.startupId] || 0) + 1;
        });
      }

      setStartups(startupList);
      setApplicationCounts(counts);
      setLoading(false);
    }
    load();
  }, [user]);

  if (loading) return <Spinner />;

  const industries = [...new Set(startups.map((item) => item.industry || item.sector).filter(Boolean))];
  const stages = [...new Set(startups.map((item) => item.stage).filter(Boolean))];

  const filtered = startups.filter((item) => {
    if (filterIndustry && (item.industry || item.sector) !== filterIndustry) return false;
    if (filterStage && item.stage !== filterStage) return false;
    if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Startups</h2>
        <p>{startups.length} startup profiles available for programme matching</p>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search startups..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}>
          <option value="">All Sectors</option>
          {industries.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {stages.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="card-grid">
        {filtered.map((startup) => (
          <div
            key={startup.id}
            className="entity-card"
            onClick={() => navigate(`/companies/${startup.id}`)}
            style={{ cursor: 'pointer' }}
          >
            <h4>{startup.name}</h4>
            <div className="entity-meta">
              {(startup.industry || startup.sector)} · {startup.stage} · {startup.country} · {startup.teamSize} people
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              {startup.problemStatement?.substring(0, 110)}...
            </p>
            <div className="entity-tags" style={{ marginBottom: 10 }}>
              <StatusPill status={startup.verificationStatus} />
              {startup.supportNeeds?.slice(0, 2).map((item) => (
                <Badge key={item} variant="blue">{item}</Badge>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {applicationCounts[startup.id] || 0} programme applications
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state"><p>No startups match your filters.</p></div>
      )}
    </div>
  );
}
