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
      const [startupSnap, appSnap] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'applications')),
      ]);

      const startupList = [];
      startupSnap.forEach((doc) => startupList.push({ id: doc.id, ...doc.data() }));
      const counts = {};
      appSnap.forEach((doc) => {
        const item = doc.data();
        counts[item.startupId] = (counts[item.startupId] || 0) + 1;
      });

      setStartups(startupList);
      setApplicationCounts(counts);
      setLoading(false);
    }
    load();
  }, []);

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
      <div className="hero-panel page-hero-compact">
        <div className="hero-kicker">Startup Portfolio</div>
        <div className="hero-title-row">
          <div>
            <h2>Review startup records in a programme-readiness format.</h2>
            <p>
              This directory supports structured screening by sector, stage, verification status, and support demand
              before any programme-level recommendation is issued.
            </p>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{startups.length} profiles in scope</strong>
              <span>Each record is available for programme-fit review and AI-assisted summarisation.</span>
            </div>
            <div className="hero-chip">
              <strong>{filtered.length} visible after filters</strong>
              <span>Search and categorical filters narrow the current review set.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-header">
        <h2>Startups</h2>
        <p>{startups.length} startup profiles available for programme matching</p>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search startups"
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
          >
            <div className="entity-card-top">
              <div>
                <h4>{startup.name}</h4>
                <div className="entity-meta">
                  {(startup.industry || startup.sector)} / {startup.stage} / {startup.country} / {startup.teamSize} team members
                </div>
              </div>
              <StatusPill status={startup.verificationStatus} />
            </div>
            <p className="entity-summary">
              {startup.problemStatement?.substring(0, 120)}...
            </p>
            <div className="entity-tags entity-tag-row">
              {startup.supportNeeds?.slice(0, 3).map((item) => (
                <Badge key={item} variant="blue">{item}</Badge>
              ))}
            </div>
            <div className="entity-facts">
              <div className="entity-fact"><span>Applications</span><strong>{applicationCounts[startup.id] || 0}</strong></div>
              <div className="entity-fact"><span>Support Needs</span><strong>{startup.supportNeeds?.length || 0}</strong></div>
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
