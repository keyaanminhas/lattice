import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { StatusPill, Spinner } from '../components/Shared';

export default function OutcomesPage() {
  const [relationships, setRelationships] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [startupNames, setStartupNames] = useState({});
  const [contributorNames, setContributorNames] = useState({});
  const [programmeNames, setProgrammeNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [formOpen, setFormOpen] = useState('');
  const [form, setForm] = useState({ outcomeAchieved: 'Yes', relationshipQuality: 'High', startupRating: 4, contributorRating: 4, startupFeedback: '', contributorFeedback: '', adminEvaluation: '' });

  useEffect(() => {
    async function load() {
      const [sSnap, cSnap, pSnap, relSnap, outSnap] = await Promise.all([
        getDocs(collection(db, 'companies')), getDocs(collection(db, 'contributors')),
        getDocs(collection(db, 'programmes')), getDocs(collection(db, 'relationships')),
        getDocs(collection(db, 'outcomes')),
      ]);
      const sm = {}; sSnap.forEach((d) => { sm[d.id] = d.data().name; }); setStartupNames(sm);
      const cm = {}; cSnap.forEach((d) => { cm[d.id] = d.data().name; }); setContributorNames(cm);
      const pm = {}; pSnap.forEach((d) => { pm[d.id] = d.data().name; }); setProgrammeNames(pm);
      const rl = []; relSnap.forEach((d) => rl.push({ id: d.id, ...d.data() })); setRelationships(rl);
      const ol = []; outSnap.forEach((d) => ol.push({ id: d.id, ...d.data() })); setOutcomes(ol);
      setLoading(false);
    }
    load();
  }, []);

  const outcomeRelIds = new Set(outcomes.map((o) => o.relationshipId));
  const eligible = relationships.filter((r) => (r.status === 'Active' || r.status === 'Completed') && !outcomeRelIds.has(r.id));

  async function handleSubmit(relId) {
    setSubmitting(relId);
    try {
      const submitOutcome = httpsCallable(functions, 'submit_outcome');
      await submitOutcome({ relationshipId: relId, ...form });
      setOutcomes((prev) => [...prev, { id: Date.now().toString(), relationshipId: relId, ...form }]);
      setFormOpen('');
      setForm({ outcomeAchieved: 'Yes', relationshipQuality: 'High', startupRating: 4, contributorRating: 4, startupFeedback: '', contributorFeedback: '', adminEvaluation: '' });
    } catch (e) { console.error(e); alert('Failed to submit outcome.'); }
    setSubmitting('');
  }

  if (loading) return <Spinner />;

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-title">Outcome & Feedback</h2>
        <p className="page-subtitle">Record relationship outcomes and submit structured feedback to the AI learning loop.</p>
      </div>

      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-label">Total Relationships</div><div className="stat-card-value">{relationships.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Outcomes Recorded</div><div className="stat-card-value accent">{outcomes.length}</div></div>
        <div className="stat-card"><div className="stat-card-label">Awaiting Outcome</div><div className="stat-card-value">{eligible.length}</div></div>
      </div>

      <div className="table-container">
        <div className="table-header"><h3>Relationships Awaiting Outcome</h3><span className="table-meta">{eligible.length} pending</span></div>
        {eligible.length === 0 ? <div className="empty-state">All active relationships have recorded outcomes.</div> : (
          <div>
            {eligible.map((r) => (
              <div key={r.id} style={{ padding: 16, borderBottom: '1px solid #f2f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span className="cell-bold">{r.relationshipType}</span>
                    <div className="cell-muted" style={{ marginTop: 2 }}>
                      {startupNames[r.sourceEntityId] || contributorNames[r.sourceEntityId] || r.sourceEntityId}
                      {' → '}
                      {contributorNames[r.targetEntityId] || startupNames[r.targetEntityId] || programmeNames[r.targetEntityId] || r.targetEntityId}
                      {' · '}{programmeNames[r.programmeId] || r.programmeId}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <StatusPill status={r.status} />
                    <button className="btn btn-sm btn-primary" onClick={() => setFormOpen(formOpen === r.id ? '' : r.id)}>
                      <span className="material-symbols-outlined" style={{ fontSize: 14 }}>{formOpen === r.id ? 'expand_less' : 'rate_review'}</span>
                      {formOpen === r.id ? 'Close' : 'Record Outcome'}
                    </button>
                  </div>
                </div>
                {formOpen === r.id && (
                  <div style={{ background: '#f7f9fb', borderRadius: 6, padding: 16, marginTop: 8 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div><label className="field-label">Outcome Achieved</label>
                        <select className="filter-input" value={form.outcomeAchieved} onChange={(e) => setForm((p) => ({ ...p, outcomeAchieved: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                          <option>Yes</option><option>Partial</option><option>No</option>
                        </select>
                      </div>
                      <div><label className="field-label">Relationship Quality</label>
                        <select className="filter-input" value={form.relationshipQuality} onChange={(e) => setForm((p) => ({ ...p, relationshipQuality: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                          <option>High</option><option>Medium</option><option>Low</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div><label className="field-label">Startup Rating</label><input className="filter-input" type="number" min="1" max="5" value={form.startupRating} onChange={(e) => setForm((p) => ({ ...p, startupRating: Number(e.target.value) }))} style={{ width: 60, marginTop: 4 }} /></div>
                        <div><label className="field-label">Contributor</label><input className="filter-input" type="number" min="1" max="5" value={form.contributorRating} onChange={(e) => setForm((p) => ({ ...p, contributorRating: Number(e.target.value) }))} style={{ width: 60, marginTop: 4 }} /></div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div><label className="field-label">Startup Feedback</label><textarea className="filter-input" value={form.startupFeedback} onChange={(e) => setForm((p) => ({ ...p, startupFeedback: e.target.value }))} rows={2} placeholder="Founder perspective..." style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                      <div><label className="field-label">Contributor Feedback</label><textarea className="filter-input" value={form.contributorFeedback} onChange={(e) => setForm((p) => ({ ...p, contributorFeedback: e.target.value }))} rows={2} placeholder="Mentor/partner perspective..." style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                    </div>
                    <div style={{ marginBottom: 12 }}><label className="field-label">Admin Evaluation</label><textarea className="filter-input" value={form.adminEvaluation} onChange={(e) => setForm((p) => ({ ...p, adminEvaluation: e.target.value }))} rows={2} placeholder="Admin assessment of the relationship..." style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                    <button className="btn btn-primary" onClick={() => handleSubmit(r.id)} disabled={submitting === r.id}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>save</span>
                      {submitting === r.id ? 'Submitting...' : 'Submit Outcome'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
