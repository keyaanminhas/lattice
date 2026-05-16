import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'react-router-dom';
import { db, functions } from '../firebase';
import { Badge, ScoreBadge, StatusPill, Spinner } from '../components/Shared';
import { RoleAccessBanner } from '../components/FeatureVisibility';
import { featureFlags } from '../config/featureFlags';
import { getDashboardTabs } from '../config/accessPolicy';

export default function CompanyDashboard({ user }) {
  const [company, setCompany] = useState(null);
  const [applications, setApplications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [programmes, setProgrammes] = useState([]);
  const [programmeNames, setProgrammeNames] = useState({});
  const [contributorNames, setContributorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState('');

  useEffect(() => {
    async function load() {
      const [compDoc, pSnap, cSnap, aSnap, recSnap, relSnap] = await Promise.all([
        getDoc(doc(db, 'companies', user.id)),
        getDocs(collection(db, 'programmes')),
        getDocs(collection(db, 'contributors')),
        getDocs(query(collection(db, 'applications'), where('startupId', '==', user.id))),
        getDocs(query(collection(db, 'recommendations'), where('sourceEntityId', '==', user.id))),
        getDocs(query(collection(db, 'relationships'), where('sourceEntityId', '==', user.id))),
      ]);
      if (compDoc.exists()) { const d = { id: compDoc.id, ...compDoc.data() }; setCompany(d); setEditForm(d); }
      const pm = {}; const pList = []; pSnap.forEach((d) => { pm[d.id] = d.data().name; pList.push({ id: d.id, ...d.data() }); });
      setProgrammeNames(pm); setProgrammes(pList);
      const cm = {}; cSnap.forEach((d) => { cm[d.id] = d.data().name; }); setContributorNames(cm);
      const al = []; aSnap.forEach((d) => al.push({ id: d.id, ...d.data() })); setApplications(al);
      const rl = []; recSnap.forEach((d) => rl.push({ id: d.id, ...d.data() })); setRecommendations(rl);
      const ll = []; relSnap.forEach((d) => ll.push({ id: d.id, ...d.data() })); setRelationships(ll);
      setLoading(false);
    }
    load();
  }, [user.id]);

  async function saveProfile() {
    setSaving(true);
    try {
      await updateDoc(doc(db, 'companies', user.id), {
        problemStatement: editForm.problemStatement || '',
        productDescription: editForm.productDescription || '',
        traction: editForm.traction || '',
        supportNeeds: editForm.supportNeeds || [],
        currentChallenges: editForm.currentChallenges || [],
      });
      setCompany((p) => ({ ...p, ...editForm }));
      setEditMode(false);
    } catch (e) { console.error(e); alert('Failed to save.'); }
    setSaving(false);
  }

  async function applyToProgramme(programmeId) {
    setApplying(programmeId);
    try {
      const submit = httpsCallable(functions, 'submit_programme_application');
      await submit({ programmeId });
      // Refresh applications
      const aSnap = await getDocs(query(collection(db, 'applications'), where('startupId', '==', user.id)));
      const al = []; aSnap.forEach((d) => al.push({ id: d.id, ...d.data() })); setApplications(al);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Failed to apply to programme.');
    }
    setApplying('');
  }

  const tabs = getDashboardTabs(user?.roleKey || 'startup');
  const activeTab = tabs.some((tab) => tab.id === searchParams.get('tab')) ? searchParams.get('tab') : 'overview';

  useEffect(() => {
    if (!searchParams.get('tab')) {
      setSearchParams({ tab: 'overview' }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  if (loading) return <Spinner />;

  const mentorRecs = recommendations.filter((r) => r.recommendationType === 'Startup-to-Mentor');
  const mentorRels = relationships.filter((r) => r.relationshipType === 'Startup-to-Mentor');
  const appliedProgrammeIds = new Set(applications.map((a) => a.programmeId));
  const openProgrammes = programmes.filter((p) => (p.status === 'Open' || p.status === 'Active') && !appliedProgrammeIds.has(p.id));

  return (
    <div>
      {featureFlags.roleFeatureVisibilityV1 ? (
        <RoleAccessBanner roleKey={user?.roleKey || 'startup'} scopeLabel="Self + accepted programme scope" />
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">{company?.name || user.name}</h2>
          <p className="page-subtitle">Programme progress, profile management, and mentor pathway.</p>
        </div>
        <div className="tag-list">
          <Badge variant="blue">{company?.industry || company?.sector}</Badge>
          <Badge variant="gray">{company?.stage}</Badge>
          <StatusPill status={company?.verificationStatus || 'Pending'} />
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSearchParams({ tab: t.id })}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Applications</span><span className="material-symbols-outlined stat-card-icon">description</span></div><div className="stat-card-value">{applications.length}</div></div>
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Accepted</span><span className="material-symbols-outlined stat-card-icon">check_circle</span></div><div className="stat-card-value accent">{applications.filter((a) => a.status === 'Accepted').length}</div></div>
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Mentor Recs</span><span className="material-symbols-outlined stat-card-icon">recommend</span></div><div className="stat-card-value">{mentorRecs.length}</div></div>
            <div className="stat-card"><div className="stat-card-header"><span className="stat-card-label">Active Mentors</span><span className="material-symbols-outlined stat-card-icon">handshake</span></div><div className="stat-card-value">{mentorRels.filter((r) => r.status === 'Active').length}</div></div>
          </div>
          <div className="table-container">
            <div className="table-header"><h3>Programme Applications</h3></div>
            {applications.length === 0 ? <div className="empty-state">No programme applications yet. Browse programmes to apply.</div> : (
              <table className="data-table"><thead><tr><th>Programme</th><th>AI Fit</th><th>Status</th></tr></thead>
                <tbody>{applications.map((a) => (<tr key={a.id}><td className="cell-bold">{programmeNames[a.programmeId] || a.programmeId}</td><td><ScoreBadge score={a.aiFitScore} label="Programme fit" /></td><td><StatusPill status={a.status} /></td></tr>))}</tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Edit Profile Tab */}
      {activeTab === 'profile' && company && (
        <div className="card" style={{ maxWidth: 720 }}>
          <div className="card-title" style={{ marginBottom: 16 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>edit</span> Company Profile</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div><label className="field-label">Company Name</label><div className="field-value">{company.name}</div></div>
            <div><label className="field-label">Country</label><div className="field-value">{company.country}</div></div>
            <div><label className="field-label">Sector</label><div className="field-value">{company.industry || company.sector}</div></div>
            <div><label className="field-label">Stage</label><div className="field-value">{company.stage}</div></div>
          </div>
          <div className="field-divider">
            <label className="field-label">Problem Statement</label>
            <textarea className="filter-input" value={editForm.problemStatement || ''} onChange={(e) => setEditForm((p) => ({ ...p, problemStatement: e.target.value }))} rows={3} style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div className="field-divider">
            <label className="field-label">Product Description</label>
            <textarea className="filter-input" value={editForm.productDescription || ''} onChange={(e) => setEditForm((p) => ({ ...p, productDescription: e.target.value }))} rows={3} style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div className="field-divider">
            <label className="field-label">Traction</label>
            <textarea className="filter-input" value={editForm.traction || ''} onChange={(e) => setEditForm((p) => ({ ...p, traction: e.target.value }))} rows={2} style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
          </div>
          <div className="field-divider">
            <label className="field-label">Support Needs (comma-separated)</label>
            <input className="filter-input" value={(editForm.supportNeeds || []).join(', ')} onChange={(e) => setEditForm((p) => ({ ...p, supportNeeds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div className="field-divider">
            <label className="field-label">Current Challenges (comma-separated)</label>
            <input className="filter-input" value={(editForm.currentChallenges || []).join(', ')} onChange={(e) => setEditForm((p) => ({ ...p, currentChallenges: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} style={{ width: '100%', marginTop: 4 }} />
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={saveProfile} disabled={saving}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> {saving ? 'Saving...' : 'Save Profile'}</button>
          </div>
        </div>
      )}

      {/* Browse Programmes Tab */}
      {activeTab === 'browse' && (
        <div className="table-container">
          <div className="table-header"><h3>Available Programmes</h3><span className="table-meta">{openProgrammes.length} open</span></div>
          {openProgrammes.length === 0 ? <div className="empty-state">No open programmes available right now.</div> : (
            <table className="data-table"><thead><tr><th>Programme</th><th>Type</th><th>Sectors</th><th>Outcomes</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
              <tbody>{openProgrammes.map((p) => (
                <tr key={p.id}>
                  <td className="cell-bold">{p.name}</td>
                  <td>{p.type}</td>
                  <td><div className="tag-list">{p.targetSectors?.slice(0, 2).map((s) => <Badge key={s} variant="blue">{s}</Badge>)}</div></td>
                  <td><div className="tag-list">{p.expectedOutcomes?.slice(0, 2).map((o) => <Badge key={o} variant="green">{o}</Badge>)}</div></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-sm btn-primary" onClick={() => applyToProgramme(p.id)} disabled={applying === p.id}>
                      {applying === p.id ? 'Applying...' : 'Apply'}
                    </button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {/* Mentor Pathway Tab */}
      {activeTab === 'mentors' && (
        <div className="table-container">
          <div className="table-header"><h3>Mentor Recommendations & Active Links</h3></div>
          {(mentorRecs.length === 0 && mentorRels.length === 0) ? <div className="empty-state">No mentor recommendations yet. Apply and get accepted to a programme first.</div> : (
            <table className="data-table"><thead><tr><th>Mentor</th><th>Programme</th><th>Score / Status</th><th>Details</th></tr></thead>
              <tbody>
                {mentorRecs.map((r) => (<tr key={r.id}><td className="cell-bold">{contributorNames[r.targetEntityId] || r.targetEntityId}</td><td>{programmeNames[r.programmeId] || r.programmeId}</td><td><ScoreBadge score={r.matchScore} label="Fit" /></td><td className="cell-muted" style={{ maxWidth: 260 }}>{r.explanation}</td></tr>))}
                {mentorRels.map((r) => (<tr key={r.id}><td className="cell-bold">{contributorNames[r.targetEntityId] || r.targetEntityId}</td><td>{programmeNames[r.programmeId] || r.programmeId}</td><td><StatusPill status={r.status} /></td><td className="cell-muted">{r.expectedOutcome}</td></tr>))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Resources Tab */}
      {activeTab === 'resources' && (
        <div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>cloud</span> Programme Resources</div>
            <p style={{ fontSize: 13, color: '#434655', marginBottom: 16 }}>Access resources provided by programme-level partners, investors, and service providers.</p>
            {applications.filter((a) => a.status === 'Accepted').length === 0 ? (
              <div className="empty-state">Get accepted to a programme to access its resources.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                {[{ icon: 'groups', label: 'Partner Support', desc: 'Access programme-level partner networks and resources.' },
                  { icon: 'account_balance', label: 'Investor Exposure', desc: 'Participate in programme investor activities and introductions.' },
                  { icon: 'build', label: 'Service Support', desc: 'Access professional services through programme service providers.' }].map((r) => (
                  <div key={r.label} className="card" style={{ marginBottom: 0, textAlign: 'center', padding: 24 }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 32, color: '#004ac6', marginBottom: 8, display: 'block' }}>{r.icon}</span>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{r.label}</div>
                    <p className="cell-muted">{r.desc}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
