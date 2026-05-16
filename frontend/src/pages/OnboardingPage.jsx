/**
 * OnboardingPage — Shown to new users after Firebase Auth signup.
 * Collects role selection + profile data, then calls registrationService
 * to create Firestore docs and trigger AI analysis.
 * 
 * Props:
 *   authUid: string — Firebase Auth UID
 *   email: string — user email from Firebase Auth
 *   displayName: string — from Firebase Auth (optional)
 *   onComplete: (profile) => void — called after successful registration
 */
import { useState } from 'react';
import { registerCompany, registerContributor } from '../services/registrationService';

const SECTORS = ['Healthtech', 'Fintech', 'EdTech', 'AgriTech', 'DeepTech', 'Clean Energy', 'Mobility', 'Cybersecurity', 'FoodTech', 'Logistics', 'SaaS', 'IoT', 'AI/ML'];
const STAGES = ['Idea', 'Pre-seed', 'Seed', 'MVP', 'Growth', 'Series A', 'Scale-up'];
const CONTRIBUTOR_TYPES = ['Mentor', 'Partner', 'Investor', 'Service Provider', 'Technical Provider'];
const EXPERTISE_OPTIONS = ['Go-to-market Strategy', 'Fundraising', 'Product Design', 'Cloud Infrastructure', 'Enterprise Sales', 'Compliance', 'Clinical Trials', 'Distribution', 'Manufacturing', 'Regulatory', 'IP Protection', 'Growth Learning', 'Marketplace Scaling'];

export default function OnboardingPage({ authUid, email, displayName, onComplete }) {
  const [step, setStep] = useState(1); // 1=role, 2=profile, 3=done
  const [role, setRole] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Company form
  const [companyForm, setCompanyForm] = useState({
    name: displayName || '', sector: '', stage: 'Idea', country: 'Malaysia',
    teamSize: 1, problemStatement: '', productDescription: '',
    supportNeeds: [], currentChallenges: [], traction: '',
  });

  // Contributor form
  const [contribForm, setContribForm] = useState({
    name: displayName || '', contributorTypes: ['Mentor'], expertise: [],
    supportedStages: [], countryCoverage: ['Malaysia'], availability: 'Available',
    maxProgrammes: 5, maxStartups: 10, perProgrammeCapacity: 3,
    investmentThesis: [], ticketSize: '',
  });

  function toggleItem(formSetter, key, val) {
    formSetter((p) => {
      const arr = p[key].includes(val) ? p[key].filter((v) => v !== val) : [...p[key], val];
      return { ...p, [key]: arr };
    });
  }

  async function handleSubmit() {
    setSaving(true); setError('');
    try {
      let profile;
      if (role === 'company') {
        if (!companyForm.name.trim()) throw new Error('Company name is required.');
        profile = await registerCompany(authUid, { ...companyForm, email });
      } else {
        if (!contribForm.name.trim()) throw new Error('Name is required.');
        profile = await registerContributor(authUid, { ...contribForm, email });
      }
      setStep(3);
      setTimeout(() => onComplete(profile), 1500);
    } catch (e) {
      setError(e.message || 'Registration failed.');
    }
    setSaving(false);
  }

  // Step 1: Role selection
  if (step === 1) {
    return (
      <div className="login-container">
        <div className="login-left">
          <div className="login-card">
            <div className="sidebar-brand" style={{ marginBottom: 28 }}>
              <div className="sidebar-brand-icon">L</div>
              <div>
                <h1 style={{ fontSize: 20, fontWeight: 700, color: '#004ac6' }}>Welcome to Lattice</h1>
                <p style={{ fontSize: 10, fontWeight: 600, color: '#737686', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Complete Your Profile</p>
              </div>
            </div>
            <h2 className="page-title" style={{ fontSize: 20, marginBottom: 6 }}>What best describes you?</h2>
            <p className="page-subtitle" style={{ marginBottom: 24 }}>This determines your dashboard and how AI analyses your profile.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button className="role-button" onClick={() => { setRole('company'); setStep(2); }}>
                <div className="avatar avatar-md avatar-green"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>business</span></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#191c1e' }}>Startup / Company</div>
                  <div style={{ fontSize: 12, color: '#737686', marginTop: 2 }}>Apply to programmes, get matched with mentors and resources.</div>
                </div>
                <span className="material-symbols-outlined" style={{ color: '#c3c6d7' }}>chevron_right</span>
              </button>

              <button className="role-button" onClick={() => { setRole('contributor'); setStep(2); }}>
                <div className="avatar avatar-md avatar-blue"><span className="material-symbols-outlined" style={{ fontSize: 18 }}>person</span></div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#191c1e' }}>Contributor (Mentor / Partner / Investor)</div>
                  <div style={{ fontSize: 12, color: '#737686', marginTop: 2 }}>Join programme pools, mentor startups, provide resources.</div>
                </div>
                <span className="material-symbols-outlined" style={{ color: '#c3c6d7' }}>chevron_right</span>
              </button>
            </div>
          </div>
        </div>
        <div className="login-right">
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.2 }}>Your profile powers the AI engine.</h2>
            <p style={{ opacity: 0.8, fontSize: 15, lineHeight: 1.6, maxWidth: 460 }}>The more detail you provide, the better Lattice can match you with programmes, mentors, and partners.</p>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: Success
  if (step === 3) {
    return (
      <div className="login-container">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 64, color: '#1b5e20', marginBottom: 16, display: 'block' }}>check_circle</span>
            <h2 className="page-title" style={{ marginBottom: 8 }}>Profile Created!</h2>
            <p className="page-subtitle">AI is analysing your profile. Redirecting to your dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Step 2: Profile form
  return (
    <div className="login-container">
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 40, overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <button className="btn btn-outline" onClick={() => setStep(1)} style={{ padding: '6px 10px' }}>
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div>
              <h2 className="page-title" style={{ fontSize: 20 }}>{role === 'company' ? 'Startup Profile' : 'Contributor Profile'}</h2>
              <p className="page-subtitle">Fill in your details — AI will analyse your profile after submission.</p>
            </div>
          </div>

          {error && <div style={{ background: '#ffdad6', color: '#ba1a1a', padding: '10px 16px', borderRadius: 6, marginBottom: 16, fontSize: 13, fontWeight: 500 }}>{error}</div>}

          {role === 'company' ? (
            <div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 14 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>business</span> Company Details</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Company Name *</label><input className="filter-input" value={companyForm.name} onChange={(e) => setCompanyForm((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', marginTop: 4 }} required /></div>
                  <div><label className="field-label">Sector</label>
                    <select className="filter-input" value={companyForm.sector} onChange={(e) => setCompanyForm((p) => ({ ...p, sector: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                      <option value="">Select sector</option>{SECTORS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="field-label">Stage</label>
                    <select className="filter-input" value={companyForm.stage} onChange={(e) => setCompanyForm((p) => ({ ...p, stage: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                      {STAGES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div><label className="field-label">Country</label><input className="filter-input" value={companyForm.country} onChange={(e) => setCompanyForm((p) => ({ ...p, country: e.target.value }))} style={{ width: '100%', marginTop: 4 }} /></div>
                  <div><label className="field-label">Team Size</label><input className="filter-input" type="number" value={companyForm.teamSize} onChange={(e) => setCompanyForm((p) => ({ ...p, teamSize: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} /></div>
                </div>
              </div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 14 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>description</span> About Your Startup</div>
                <div style={{ marginBottom: 12 }}><label className="field-label">Problem Statement</label><textarea className="filter-input" value={companyForm.problemStatement} onChange={(e) => setCompanyForm((p) => ({ ...p, problemStatement: e.target.value }))} rows={3} placeholder="What problem does your startup solve?" style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                <div style={{ marginBottom: 12 }}><label className="field-label">Product Description</label><textarea className="filter-input" value={companyForm.productDescription} onChange={(e) => setCompanyForm((p) => ({ ...p, productDescription: e.target.value }))} rows={3} placeholder="Describe your product or service." style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} /></div>
                <div><label className="field-label">Traction</label><textarea className="filter-input" value={companyForm.traction} onChange={(e) => setCompanyForm((p) => ({ ...p, traction: e.target.value }))} rows={2} placeholder="Revenue, users, pilots, partnerships..." style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} /></div>
              </div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>support</span> Support Needs</div>
                <label className="field-label">What support does your startup need? (comma-separated)</label>
                <input className="filter-input" value={companyForm.supportNeeds.join(', ')} onChange={(e) => setCompanyForm((p) => ({ ...p, supportNeeds: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) }))} placeholder="e.g. Regulatory guidance, Investor readiness" style={{ width: '100%', marginTop: 4 }} />
              </div>
            </div>
          ) : (
            <div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 14 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>person</span> Basic Info</div>
                <div style={{ gridColumn: '1 / -1', marginBottom: 12 }}><label className="field-label">Full Name *</label><input className="filter-input" value={contribForm.name} onChange={(e) => setContribForm((p) => ({ ...p, name: e.target.value }))} style={{ width: '100%', marginTop: 4 }} required /></div>
                <label className="field-label" style={{ marginBottom: 6, display: 'block' }}>Contributor Type(s)</label>
                <div className="tag-list" style={{ gap: 6 }}>
                  {CONTRIBUTOR_TYPES.map((t) => (
                    <button key={t} type="button" className={`badge ${contribForm.contributorTypes.includes(t) ? 'badge-blue' : 'badge-gray'}`}
                      style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12 }} onClick={() => toggleItem(setContribForm, 'contributorTypes', t)}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>psychology</span> Expertise</div>
                <div className="tag-list" style={{ gap: 6 }}>
                  {EXPERTISE_OPTIONS.map((e) => (
                    <button key={e} type="button" className={`badge ${contribForm.expertise.includes(e) ? 'badge-blue' : 'badge-gray'}`}
                      style={{ cursor: 'pointer', padding: '5px 10px', fontSize: 12 }} onClick={() => toggleItem(setContribForm, 'expertise', e)}>{e}</button>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title" style={{ marginBottom: 12 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>tune</span> Availability & Capacity</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                  <div><label className="field-label">Availability</label>
                    <select className="filter-input" value={contribForm.availability} onChange={(e) => setContribForm((p) => ({ ...p, availability: e.target.value }))} style={{ width: '100%', marginTop: 4 }}>
                      <option>Available</option><option>Limited</option><option>Unavailable</option>
                    </select>
                  </div>
                  <div><label className="field-label">Max Programmes</label><input className="filter-input" type="number" value={contribForm.maxProgrammes} onChange={(e) => setContribForm((p) => ({ ...p, maxProgrammes: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} /></div>
                  <div><label className="field-label">Max Startups</label><input className="filter-input" type="number" value={contribForm.maxStartups} onChange={(e) => setContribForm((p) => ({ ...p, maxStartups: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} /></div>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
              {saving ? 'Creating & Analyzing...' : 'Create Profile & Run AI'}
            </button>
          </div>
        </div>
      </div>
      <div className="login-right">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', marginBottom: 20, display: 'inline-flex' }}>AI-Powered Onboarding</span>
          <h2 style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.2 }}>
            {role === 'company' ? 'AI will analyse your startup profile.' : 'AI will match you with programmes.'}
          </h2>
          <p style={{ opacity: 0.8, fontSize: 15, lineHeight: 1.6, maxWidth: 460 }}>
            {role === 'company'
              ? 'After submission, Lattice generates embeddings, computes readiness scores, and recommends the best-fit programmes for your startup.'
              : 'After submission, Lattice analyses your expertise, generates programme match suggestions, and places you in relevant contributor pools.'}
          </p>
        </div>
      </div>
    </div>
  );
}
