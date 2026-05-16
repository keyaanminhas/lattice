import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { ScoreBadge, StatusPill, Spinner } from '../components/Shared';
import { FeatureVisibilityPanel, RoleAccessBanner } from '../components/FeatureVisibility';
import { featureFlags } from '../config/featureFlags';

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState(null);
  const [recentRecommendations, setRecentRecommendations] = useState([]);
  const [startups, setStartups] = useState({});
  const [contributors, setContributors] = useState({});
  const [programmes, setProgrammes] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [startupSnap, contributorSnap, programmeSnap] = await Promise.all([
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'contributors')),
          getDocs(collection(db, 'programmes')),
        ]);
        const sMap = {}; startupSnap.forEach((d) => { sMap[d.id] = d.data().name; }); setStartups(sMap);
        const cMap = {}; contributorSnap.forEach((d) => { cMap[d.id] = d.data().name; }); setContributors(cMap);
        const pMap = {}; programmeSnap.forEach((d) => { pMap[d.id] = d.data().name; }); setProgrammes(pMap);

        const getStats = httpsCallable(functions, 'get_dashboard_stats');
        const result = await getStats({});
        setStats(result.data);

        const recSnap = await getDocs(query(collection(db, 'recommendations'), limit(5)));
        const recList = []; recSnap.forEach((d) => recList.push({ id: d.id, ...d.data() }));
        setRecentRecommendations(recList);
      } catch (e) { console.error('Dashboard load failed:', e); }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;

  const statCards = [
    { label: 'Organisations', value: stats?.totalOrganisations, icon: 'apartment' },
    { label: 'Open Programmes', value: stats?.openProgrammes, icon: 'school', accent: true },
    { label: 'Startups', value: stats?.totalStartups, sub: `${stats?.verifiedStartups || 0} verified`, icon: 'business' },
    { label: 'Pool Assignments', value: stats?.programmePoolAssignments, icon: 'group_add' },
    { label: 'Pending Apps', value: stats?.pendingApplications, sub: `${stats?.acceptedApplications || 0} accepted`, icon: 'pending_actions' },
    { label: 'Pending Recs', value: stats?.pendingRecommendations, sub: `${stats?.activeRelationships || 0} active`, icon: 'recommend' },
    { label: 'Completed', value: stats?.completedRelationships, icon: 'check_circle' },
    { label: 'Success Rate', value: `${stats?.outcomeSuccessRate || 0}%`, icon: 'trending_up' },
  ];

  return (
    <div>
      {featureFlags.roleFeatureVisibilityV1 ? (
        <>
          <RoleAccessBanner roleKey={user?.roleKey || 'organisation_admin'} scopeLabel="Organisation / Programme scope" />
          <FeatureVisibilityPanel roleKey={user?.roleKey || 'organisation_admin'} surfacePath="/" />
        </>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Ecosystem operations overview and recommendation activity.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/programmes')}>
            <span className="material-symbols-outlined">school</span> Programmes
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/matches')}>
            <span className="material-symbols-outlined">handshake</span> Recommendation Queue
          </button>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          {statCards.map((c) => (
            <div key={c.label} className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">{c.label}</span>
                <span className="material-symbols-outlined stat-card-icon">{c.icon}</span>
              </div>
              <div className={`stat-card-value${c.accent ? ' accent' : ''}`}>{c.value ?? '—'}</div>
              {c.sub && <div className="stat-card-sub">{c.sub}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="table-container">
        <div className="table-header">
          <h3>Recent Recommendations</h3>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/matches')}>View All <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span></button>
        </div>
        {recentRecommendations.length === 0 ? (
          <div className="empty-state">No recommendations generated yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Type</th><th>Programme</th><th>Source</th><th>Target</th><th>Score</th><th>Status</th>
            </tr></thead>
            <tbody>
              {recentRecommendations.map((r) => (
                <tr key={r.id}>
                  <td className="cell-bold">{r.recommendationType}</td>
                  <td>{programmes[r.programmeId] || r.programmeId}</td>
                  <td>{startups[r.sourceEntityId] || contributors[r.sourceEntityId] || r.sourceEntityId}</td>
                  <td>{programmes[r.targetEntityId] || contributors[r.targetEntityId] || r.targetEntityId}</td>
                  <td><ScoreBadge score={r.matchScore} label="AI confidence" /></td>
                  <td><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
