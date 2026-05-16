import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { auth, functions } from '../firebase';

const SECTORS = ['Healthtech', 'Fintech', 'EdTech', 'AgriTech', 'DeepTech', 'Clean Energy', 'Mobility', 'Cybersecurity', 'FoodTech', 'Logistics', 'SaaS', 'IoT', 'AI/ML'];
const STAGES = ['Idea', 'Pre-seed', 'Seed', 'MVP', 'Growth', 'Series A', 'Scale-up'];
const OUTCOMES = ['Investor readiness', 'Cloud adoption', 'CISO introductions', 'Compliance readiness', 'Municipality pilots', 'Infrastructure partners', 'Supply chain pilots', 'Manufacturing partners', 'Clinical pilot access', 'Regulatory guidance', 'Banking partnerships', 'Regulatory sandbox access', 'Distribution channels', 'School pilots', 'Government grant access'];

function isPermissionDenied(error) {
  return ['permission-denied', 'functions/permission-denied'].includes(error?.code)
    || error?.message?.toLowerCase?.().includes('missing or insufficient permissions');
}

function formatCreateProgrammeError(error) {
  if (error?.code === 'functions/unauthenticated' || error?.message === 'Unauthenticated') {
    return 'Your Firebase sign-in session is not fully ready yet. Wait a moment and try again, or reload the app if it persists.';
  }
  if (isPermissionDenied(error)) {
    return 'Programme creation is blocked by account scope or backend permissions for this organisation.';
  }
  if (error?.code === 'functions/invalid-argument') {
    return error.message || 'Programme details are incomplete or invalid.';
  }
  if (error?.code === 'functions/internal') {
    return 'The deployed create-programme backend returned an internal error. Check the live Cloud Function logs for create_programme.';
  }
  return error?.message || 'Failed to create programme.';
}

export default function CreateProgrammePage({ user }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '', type: 'Accelerator', country: 'Malaysia', region: '',
    targetSectors: [], targetStages: [], expectedOutcomes: [],
    eligibilityRules: [''],
    status: 'Draft',
  });

  function set(key, val) { setForm((p) => ({ ...p, [key]: val })); }
  function toggleList(key, val) {
    setForm((p) => {
      const arr = p[key].includes(val) ? p[key].filter((v) => v !== val) : [...p[key], val];
      return { ...p, [key]: arr };
    });
  }
  function setRule(idx, val) { setForm((p) => { const rules = [...p.eligibilityRules]; rules[idx] = val; return { ...p, eligibilityRules: rules }; }); }
  function addRule() { setForm((p) => ({ ...p, eligibilityRules: [...p.eligibilityRules, ''] })); }
  function removeRule(idx) { setForm((p) => ({ ...p, eligibilityRules: p.eligibilityRules.filter((_, i) => i !== idx) })); }

  async function ensureFirebaseSession(attempts = 12, delayMs = 250) {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      if (auth.currentUser) {
        await auth.currentUser.getIdToken();
        return auth.currentUser;
      }
      await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    }
    throw new Error('Firebase authentication is still initializing.');
  }

  async function createProgrammeViaCallable(payload) {
    const createProgramme = httpsCallable(functions, 'create_programme');
    const result = await createProgramme(payload);
    return result.data.programme.id;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) return alert('Programme name is required.');
    if (form.targetSectors.length === 0) return alert('Select at least one target sector.');
    setSaving(true);
    try {
      const payload = {
        ...form,
        organisationId: user?.entityType === 'organisation' ? user.id : undefined,
        eligibilityRules: form.eligibilityRules.map((rule) => rule.trim()).filter(Boolean),
      };
      await ensureFirebaseSession();

      const programmeId = await createProgrammeViaCallable(payload);

      navigate(`/programmes/${programmeId}`);
      return;
    } catch (error) {
      console.error(error);
      setError(formatCreateProgrammeError(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
        <button className="btn btn-outline" onClick={() => navigate('/programmes')} style={{ padding: '6px 10px' }}>
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div><h2 className="page-title">Create Programme</h2><p className="page-subtitle">Define a new programme context for startup admissions and contributor pools.</p></div>
      </div>

      {error ? (
        <div className="card" style={{ marginBottom: 16, borderColor: '#ba1a1a', background: '#fffbff' }}>
          <div style={{ color: '#ba1a1a', fontSize: 13, fontWeight: 600 }}>{error}</div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-title" style={{ marginBottom: 16 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>school</span> Programme Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Programme Name *</label><input className="filter-input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. AI Startup Accelerator 2026" style={{ width: '100%', marginTop: 4 }} required /></div>
            <div><label className="field-label">Type</label>
              <select className="filter-input" value={form.type} onChange={(e) => set('type', e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                {['Accelerator', 'Mentorship Cohort', 'Innovation Circle', 'Sandbox Programme', 'Enterprise Readiness Programme', 'Market Access Programme', 'Grant Programme'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div><label className="field-label">Status</label>
              <select className="filter-input" value={form.status} onChange={(e) => set('status', e.target.value)} style={{ width: '100%', marginTop: 4 }}>
                {['Draft', 'Open', 'Active', 'Closed'].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label className="field-label">Country</label><input className="filter-input" value={form.country} onChange={(e) => set('country', e.target.value)} style={{ width: '100%', marginTop: 4 }} /></div>
            <div><label className="field-label">Region (optional)</label><input className="filter-input" value={form.region} onChange={(e) => set('region', e.target.value)} placeholder="e.g. Southeast Asia" style={{ width: '100%', marginTop: 4 }} /></div>
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>filter_list</span> Target Sectors *</div>
          <div className="tag-list" style={{ gap: 6 }}>
            {SECTORS.map((s) => (
              <button key={s} type="button" className={`badge ${form.targetSectors.includes(s) ? 'badge-blue' : 'badge-gray'}`}
                style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12 }} onClick={() => toggleList('targetSectors', s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>trending_up</span> Target Stages</div>
          <div className="tag-list" style={{ gap: 6 }}>
            {STAGES.map((s) => (
              <button key={s} type="button" className={`badge ${form.targetStages.includes(s) ? 'badge-blue' : 'badge-gray'}`}
                style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12 }} onClick={() => toggleList('targetStages', s)}>{s}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>flag</span> Expected Outcomes</div>
          <div className="tag-list" style={{ gap: 6 }}>
            {OUTCOMES.map((o) => (
              <button key={o} type="button" className={`badge ${form.expectedOutcomes.includes(o) ? 'badge-green' : 'badge-gray'}`}
                style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12 }} onClick={() => toggleList('expectedOutcomes', o)}>{o}</button>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>checklist</span> Eligibility Rules</div>
          {form.eligibilityRules.map((rule, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input className="filter-input" value={rule} onChange={(e) => setRule(idx, e.target.value)} placeholder={`Rule ${idx + 1}`} style={{ flex: 1 }} />
              {form.eligibilityRules.length > 1 && <button type="button" className="btn btn-sm btn-danger-outline" onClick={() => removeRule(idx)}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>close</span></button>}
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline" onClick={addRule}><span className="material-symbols-outlined" style={{ fontSize: 14 }}>add</span> Add Rule</button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/programmes')}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}><span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span> {saving ? 'Creating...' : 'Create Programme'}</button>
        </div>
      </form>
    </div>
  );
}
