import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Badge, StatusPill, Spinner } from '../components/Shared';
import { useNavigate } from 'react-router-dom';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      const snap = await getDocs(collection(db, 'companies'));
      const list = [];
      snap.forEach((doc) => list.push({ id: doc.id, ...doc.data() }));
      setCompanies(list);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const industries = [...new Set(companies.map((c) => c.industry))];
  const stages = [...new Set(companies.map((c) => c.stage))];

  const filtered = companies.filter((c) => {
    if (filterIndustry && c.industry !== filterIndustry) return false;
    if (filterStage && c.stage !== filterStage) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <h2>Companies</h2>
        <p>{companies.length} startups in the ecosystem</p>
      </div>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filterIndustry} onChange={(e) => setFilterIndustry(e.target.value)}>
          <option value="">All Industries</option>
          {industries.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={filterStage} onChange={(e) => setFilterStage(e.target.value)}>
          <option value="">All Stages</option>
          {stages.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="card-grid">
        {filtered.map((c) => (
          <div key={c.id} className="entity-card" onClick={() => navigate(`/companies/${c.id}`)}>
            <h4>{c.name}</h4>
            <div className="entity-meta">
              {c.industry} · {c.stage} · {c.country} · {c.teamSize} people
            </div>
            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12, lineHeight: 1.5 }}>
              {c.problemStatement?.substring(0, 100)}...
            </p>
            <div className="entity-tags">
              <StatusPill status={c.verificationStatus} />
              {c.supportNeeds?.slice(0, 3).map((n) => (
                <Badge key={n} variant="blue">{n}</Badge>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="empty-state"><p>No companies match your filters.</p></div>
      )}
    </div>
  );
}
