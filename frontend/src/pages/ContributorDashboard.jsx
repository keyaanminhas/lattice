import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'react-router-dom';
import { db, functions } from '../firebase';
import { Badge, ScoreBadge, StatusPill, Spinner } from '../components/Shared';
import { FeatureVisibilityPanel, RoleAccessBanner } from '../components/FeatureVisibility';
import { featureFlags } from '../config/featureFlags';
import { getDashboardTabs } from '../config/accessPolicy';

export default function ContributorDashboard({ user }) {
  const [contributor, setContributor] = useState(null);
  const [poolAssignments, setPoolAssignments] = useState([]);
  const [mentorLinks, setMentorLinks] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [programmeNames, setProgrammeNames] = useState({});
  const [startupNames, setStartupNames] = useState({});
  const [recommendationScores, setRecommendationScores] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [requestingProgrammeId, setRequestingProgrammeId] = useState('');

  useEffect(() => {
    async function load() {
      const [contDoc, pSnap, sSnap, poolSnap, relSnap, recSnap] = await Promise.all([
        getDoc(doc(db, 'contributors', user.id)),
        getDocs(collection(db, 'programmes')), getDocs(collection(db, 'companies')),
        getDocs(query(collection(db, 'programmeContributors'), where('contributorId', '==', user.id))),
        getDocs(query(collection(db, 'relationships'), where('targetEntityId', '==', user.id))),
        getDocs(query(collection(db, 'recommendations'), where('targetEntityId', '==', user.id))),
      ]);
      if (contDoc.exists()) { const d = { id: contDoc.id, ...contDoc.data() }; setContributor(d); setEditForm(d); }
      const pm = {}; const pList = []; pSnap.forEach((d) => { pm[d.id] = d.data().name; pList.push({ id: d.id, ...d.data() }); });
      setProgrammeNames(pm); setProgrammes(pList);
      const sm = {}; sSnap.forEach((d) => { sm[d.id] = d.data().name; }); setStartupNames(sm);
      const scoreMap = {};
      recSnap.forEach((d) => { const v = d.data(); if (v.recommendationType === 'Startup-to-Mentor') scoreMap[`${v.sourceEntityId}_${v.programmeId}`] = v.matchScore; });
      setRecommendationScores(scoreMap);
      const pools = []; poolSnap.forEach((d) => pools.push({ id: d.id, ...d.data() })); setPoolAssignments(pools);
      const links = []; relSnap.forEach((d) => { const v = d.data(); if (v.relationshipType === 'Startup-to-Mentor') links.push({ id: d.id, ...v }); }); setMentorLinks(links);
      setLoading(false);
    }
    load();
  }, [user.id]);

  async function saveProfile() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'contributors', user.id), {
        expertise: editForm.expertise || [],
        supportedStages: editForm.supportedStages || [],
        availability: editForm.availability || 'Available',
        capacity: editForm.capacity || {},
        countryCoverage: editForm.countryCoverage || [],
      });
      setContributor((p) => ({ ...p, ...editForm }));
      setSearchParams({ tab: 'overview' });
    } catch (e) { console.error(e); alert('Failed to save.'); }
    setSaving(false);
  }

  async function requestProgrammeConnection(programmeId) {
    setRequestingProgrammeId(programmeId);
    try {
      const requestConnection = httpsCallable(functions, 'request_programme_connection');
      await requestConnection({ programmeId });
      const poolSnap = await getDocs(query(collection(db, 'programmeContributors'), where('contributorId', '==', user.id)));
      const pools = [];
      poolSnap.forEach((item) => pools.push({ id: item.id, ...item.data() }));
      setPoolAssignments(pools);
    } catch (error) {
      console.error('Failed to request programme connection:', error);
      alert(error?.message || 'Failed to request programme connection.');
    }
    setRequestingProgrammeId('');
  }

  const tabs = getDashboardTabs(user?.roleKey || 'mentor');
  const activeTab = tabs.some((tab) => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: 'overview' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (loading) return <Spinner />;

  return (
    <div>
      {featureFlags.roleFeatureVisibilityV1 ? (
        <>
          <RoleAccessBanner roleKey={user?.roleKey || 'mentor'} scopeLabel="Self + assigned programme scope" />
          <FeatureVisibilityPanel roleKey={user?.roleKey || 'mentor'} surfacePath="/" />
        </>
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">{contributor?.name || user.name}</h2>
          <p className="page-subtitle">Programme assignments, mentorship register, and profile management.</p>
        </div>
        <div className="tag-list">
          {(contributor?.contributorTypes || []).map((t) => <Badge key={t} variant="blue">{t}</Badge>)}
          <StatusPill status={contributor?.availability || 'Available'} />
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSearchParams({ tab: t.id })}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Programme Pools</span><span className="material-symbols-outlined stat-card-icon">group_add</span></div><div className="stat-card-value">{poolAssignments.filter((p) => p.status === 'Approved').length}</div></div>
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Mentor Links</span><span className="material-symbols-outlined stat-card-icon">handshake</span></div><div className="stat-card-value accent">{mentorLinks.length}</div></div>
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Active</span><span className="material-symbols-outlined stat-card-icon">check_circle</span></div><div className="stat-card-value">{mentorLinks.filter((l) => l.status === 'Active').length}</div></div>
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Capacity</span><span className="material-symbols-outlined stat-card-icon">speed</span></div><div className="stat-card-value">{contributor?.capacity?.globalMaxStartupAssignments || '∞'}</div><div className="stat-card-sub">{mentorLinks.filter((l) => l.status === 'Active').length} used</div></div>
          </div>
          <div className="table-container">
            <div className="table-header"><h3>Programme Pool Assignments</h3></div>
            {poolAssignments.length === 0 ? <div className="empty-state">No programme assignments yet.</div> : (
              <table className="data-table"><thead><tr><th>Programme</th><th>Role</th><th>Status</th></tr></thead>
                <tbody>{poolAssignments.map((p) => (<tr key={p.id}><td className="cell-bold">{programmeNames[p.programmeId] || p.programmeId}</td><td>{p.contributorType}</td><td><StatusPill status={p.status} /></td></tr>))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile */}
      {activeTab === 'profile' && contributor && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-title" style={{ marginBottom: 16 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>edit</span> Contributor Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label className="field-label">Name</label><div className="field-value">{contributor.name}</div></div>
            <div><label className="field-label">Types</label><div className="field-value">{(contributor.contributorTypes || []).join(', ')}</div></div>
          </div>
          <div className="field-divider">
            <label className="field-label">Expertise (comma-separated)</label>
            <input className="filter-input" value={(editForm.expertise || []).join(', ')} onChange={(e) => setEditForm((p) => ({ ...p, expertise: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div className="field-divider">
            <label className="field-label">Supported Stages (comma-separated)</label>
            <input className="filter-input" value={(editForm.supportedStages || []).join(', ')} onChange={(e) => setEditForm((p) => ({ ...p, supportedStages: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div className="field-divider">
            <label className="field-label">Country Coverage (comma-separated)</label>
            <input className="filter-input" value={(editForm.countryCoverage || []).join(', ')} onChange={(e) => setEditForm((p) => ({ ...p, countryCoverage: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div className="field-divider" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div><label className="field-label">Availability</label>
              <select className="filter-input" value={editForm.availability || 'Available'} onChange={(e) => setEditForm((p) => ({ ...p, availability: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                <option>Available</option><option>Limited</option><option>Unavailable</option>
              </select>
            </div>
            <div><label className="field-label">Max Programmes</label>
              <input className="filter-input" type="number" value={editForm.capacity?.globalMaxProgrammes || 5} onChange={(e) => setEditForm((p) => ({ ...p, capacity: { ...p.capacity, globalMaxProgrammes: Number(e.target.value) } }))} style={{ width: '100%', marginTop: 4 }} />
            </div>
            <div><label className="field-label">Max Startups</label>
              <input className="filter-input" type="number" value={editForm.capacity?.globalMaxStartupAssignments || 10} onChange={(e) => setEditForm((p) => ({ ...p, capacity: { ...p.capacity, globalMaxStartupAssignments: Number(e.target.value) } }))} style={{ width: '100%', marginTop: 4 }} />
            </div>
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> {saving ? 'Saving...' : 'Save Profile'}</button>
          </div>
        </div>
      )}

      {/* Suggested Programmes */}
      {activeTab === 'programmes' && (
        <div className="table-container">
          <div className="table-header"><h3>Browse Available Programmes</h3><span className="table-meta">{programmes.filter((p) => p.status === 'Open' || p.status === 'Active').length} open</span></div>
          <table className="data-table"><thead><tr><th>Programme</th><th>Type</th><th>Sectors</th><th>Status</th><th style={{ textAlign: 'right' }}>Connection</th></tr></thead>
            <tbody>{programmes.filter((p) => p.status === 'Open' || p.status === 'Active').map((p) => (
              <tr key={p.id}>
                <td className="cell-bold">{p.name}</td>
                <td>{p.type}</td>
                <td><div className="tag-list">{p.targetSectors?.slice(0, 2).map((s) => <Badge key={s} variant="blue">{s}</Badge>)}</div></td>
                <td><StatusPill status={p.status} /></td>
                <td style={{ textAlign: 'right' }}>
                  {(() => {
                    const assignment = poolAssignments.find((item) => item.programmeId === p.id);
                    if (!assignment) {
                      return (
                        <button className="btn btn-sm btn-primary" onClick={() => requestProgrammeConnection(p.id)} disabled={requestingProgrammeId === p.id}>
                          {requestingProgrammeId === p.id ? 'Requesting...' : 'Request Connection'}
                        </button>
                      );
                    }
                    return <StatusPill status={assignment.status} />;
                  })()}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}

      {/* Startup Assignments */}
      {activeTab === 'mentees' && (
        <div className="table-container">
          <div className="table-header"><h3>Startup Mentorship Register</h3></div>
          {mentorLinks.length === 0 ? <div className="empty-state">No startup mentorship assignments yet.</div> : (
            <table className="data-table"><thead><tr><th>Startup</th><th>Programme</th><th>Match Score</th><th>Status</th></tr></thead>
              <tbody>{mentorLinks.map((l) => (
                <tr key={l.id}>
                  <td className="cell-bold">{startupNames[l.sourceEntityId] || l.sourceEntityId}</td>
                  <td>{programmeNames[l.programmeId] || l.programmeId}</td>
                  <td>{recommendationScores[`${l.sourceEntityId}_${l.programmeId}`] ? <ScoreBadge score={recommendationScores[`${l.sourceEntityId}_${l.programmeId}`]} label="Match" /> : <span className="cell-muted">Direct</span>}</td>
                  <td><StatusPill status={l.status} /></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
