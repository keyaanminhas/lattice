import { useState } from 'react';
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions } from '../firebase';
import {
  SECTOR_OPTIONS, STAGE_OPTIONS, TEAM_SIZE_OPTIONS, SUPPORT_NEED_OPTIONS,
  CHALLENGE_OPTIONS, TRACTION_OPTIONS, CONTRIBUTOR_TYPE_OPTIONS,
  SECTOR_EXPERTISE_OPTIONS, SUPPORT_AREA_OPTIONS, SUPPORTED_STAGE_OPTIONS,
  COUNTRY_OPTIONS, ORG_TYPE_OPTIONS, FOCUS_SECTOR_OPTIONS,
  CONTRIBUTOR_TYPE_MAP, STEP_LABELS, initialRegistration, demoAccounts,
} from './registrationOptions';
import {
  WizardProgress, MultiSelect, FieldHelper, WizardNav, ReviewField, ReviewSection,
} from './WizardComponents';

function formatAuthError(error) {
  if (error?.code === 'auth/invalid-credential') return 'Email or password is incorrect.';
  if (error?.code === 'auth/email-already-in-use') return 'An account already exists for this email.';
  if (error?.code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (error?.code === 'auth/network-request-failed') return 'Could not reach Firebase Auth. Check that the emulator is running locally.';
  if (error?.code === 'auth/configuration-not-found') return 'Firebase Auth is not configured for this project. Use the local Auth emulator or enable an Auth provider in Firebase.';
  if (error?.code === 'functions/unavailable') return 'Could not reach Firebase Functions. Start the Firebase emulators before creating an account.';
  if (error?.code === 'functions/failed-precondition') return error.message || 'This login already has a Lattice account.';
  if (error?.code === 'functions/invalid-argument') return error.message || 'Some registration details are missing or invalid.';
  return error?.message || 'Authentication failed.';
}

function buildRegistrationProfile(r) {
  if (r.accountType === 'startup') {
    const traction = r.tractionDetail ? `${r.tractionLevel} — ${r.tractionDetail}` : r.tractionLevel;
    return {
      name: r.startupName.trim(),
      sector: r.sector,
      stage: r.stage,
      country: r.country,
      teamSize: r.teamSize,
      supportNeeds: r.supportNeeds,
      currentChallenges: r.currentChallenges,
      problemStatement: r.problemStatement.trim(),
      productDescription: r.productDescription.trim(),
      traction,
    };
  }
  if (r.accountType === 'contributor') {
    const mapped = CONTRIBUTOR_TYPE_MAP[r.contributorType] || r.contributorType;
    return {
      name: r.contributorName.trim(),
      contributorTypes: [mapped],
      expertise: r.sectorExpertise,
      supportedStages: r.supportedStages,
      investmentThesis: r.investmentThesis ? r.investmentThesis.split(',').map((s) => s.trim()).filter(Boolean) : [],
      ticketSize: r.ticketSize.trim(),
      countryCoverage: r.countryCoverage,
      canSupport: r.supportAreas,
      availability: r.availability,
      globalMaxProgrammes: r.globalMaxProgrammes,
      globalMaxStartupAssignments: r.globalMaxStartupAssignments,
      perProgrammeStartupCapacity: r.perProgrammeStartupCapacity,
    };
  }
  return {
    name: r.organisationName.trim(),
    organisationType: r.organisationType,
    country: r.country,
    focusAreas: r.focusSectors,
  };
}

export default function LoginPage({ authError }) {
  const [mode, setMode] = useState('signin');
  const [step, setStep] = useState(0);
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [reg, setReg] = useState(initialRegistration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const up = (field, value) => setReg((c) => ({ ...c, [field]: value }));
  const steps = STEP_LABELS[reg.accountType];
  const maxStep = steps.length - 1;

  function switchMode(m) { setMode(m); setError(''); setStep(0); }
  function switchEntity(type) { setReg({ ...initialRegistration, accountType: type }); setStep(0); setError(''); }

  async function handleSignIn(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, signInForm.email.trim(), signInForm.password); }
    catch (err) { setError(formatAuthError(err)); }
    setBusy(false);
  }

  async function handleDemoSignIn(account) {
    setBusy(true); setError('');
    try { await signInWithEmailAndPassword(auth, account.email, account.password); }
    catch (err) { setError(`${formatAuthError(err)} Run python3 seed_db.py after starting the Firebase emulators to create demo logins.`); }
    setBusy(false);
  }

  async function handleRegistration(e) {
    e.preventDefault(); setBusy(true); setError('');
    let createdUser = null; let done = false;
    try {
      const cred = await createUserWithEmailAndPassword(auth, reg.email.trim(), reg.password);
      createdUser = cred.user;
      const fn = httpsCallable(functions, 'complete_entity_registration');
      await fn({ accountType: reg.accountType, profile: buildRegistrationProfile(reg) });
      done = true;
      await signOut(auth);
      await signInWithEmailAndPassword(auth, reg.email.trim(), reg.password);
      setReg(initialRegistration); setStep(0);
    } catch (err) {
      if (createdUser && !done) await deleteUser(createdUser).catch(() => signOut(auth).catch(() => {}));
      setError(formatAuthError(err));
    }
    setBusy(false);
  }

  function goNext() { if (step < maxStep) setStep(step + 1); }
  function goBack() { if (step > 0) setStep(step - 1); }

  const submitLabel = reg.accountType === 'startup' ? 'Create startup account'
    : reg.accountType === 'contributor' ? 'Create contributor account' : 'Create organisation account';

  function renderAccountStep() {
    return (
      <>
        <div className="entity-choice-grid" aria-label="Choose account type">
          {[
            { value: 'startup', label: 'Startup', detail: 'Company profile seeking programme support' },
            { value: 'contributor', label: 'Contributor', detail: 'Mentor, partner, investor, or service provider' },
            { value: 'organisation', label: 'Organisation', detail: 'Programme owner pending governance review' },
          ].map((o) => (
            <button key={o.value} className={`entity-choice ${reg.accountType === o.value ? 'active' : ''}`}
              onClick={() => switchEntity(o.value)} type="button">
              <strong>{o.label}</strong><span>{o.detail}</span>
            </button>
          ))}
        </div>
        <div className="auth-form-grid">
          <label>Email<input type="email" value={reg.email} onChange={(e) => up('email', e.target.value)} required /></label>
          <label>Password<input type="password" value={reg.password} onChange={(e) => up('password', e.target.value)} required minLength={6} /></label>
        </div>
      </>
    );
  }

  function renderStartupStep() {
    if (step === 1) return (
      <>
        <h3 className="wizard-section-title">Startup Basics</h3>
        <label>Startup name<input value={reg.startupName} onChange={(e) => up('startupName', e.target.value)} required /></label>
        <div className="auth-form-grid">
          <label>Sector
            <select value={reg.sector} onChange={(e) => up('sector', e.target.value)} required>
              <option value="">Select sector</option>
              {SECTOR_OPTIONS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          <label>Country
            <select value={reg.country} onChange={(e) => up('country', e.target.value)} required>
              {COUNTRY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <label>Team size
          <select value={reg.teamSize} onChange={(e) => up('teamSize', e.target.value)} required>
            <option value="">Select range</option>
            {TEAM_SIZE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </>
    );
    if (step === 2) return (
      <>
        <h3 className="wizard-section-title">Product & Stage</h3>
        <label>Stage
          <select value={reg.stage} onChange={(e) => up('stage', e.target.value)} required>
            <option value="">Select stage</option>
            {STAGE_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </label>
        <label>Problem statement<textarea value={reg.problemStatement} onChange={(e) => up('problemStatement', e.target.value)} required /></label>
        <label>Product description<textarea value={reg.productDescription} onChange={(e) => up('productDescription', e.target.value)} required /></label>
        <label>Traction
          <select value={reg.tractionLevel} onChange={(e) => up('tractionLevel', e.target.value)}>
            <option value="">Select traction level</option>
            {TRACTION_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {reg.tractionLevel && reg.tractionLevel !== 'No traction yet' && reg.tractionLevel !== 'Early conversations' && (
          <label>Traction details<textarea value={reg.tractionDetail} onChange={(e) => up('tractionDetail', e.target.value)} placeholder="Describe your traction milestones" /></label>
        )}
      </>
    );
    if (step === 3) return (
      <>
        <h3 className="wizard-section-title">Needs</h3>
        <label>Support needs</label>
        <FieldHelper text="What kind of help does your startup need from the ecosystem?" />
        <MultiSelect options={SUPPORT_NEED_OPTIONS} value={reg.supportNeeds} onChange={(v) => up('supportNeeds', v)} />
        <label style={{ marginTop: 12 }}>Current challenges</label>
        <FieldHelper text="Select the blockers your team is facing right now." />
        <MultiSelect options={CHALLENGE_OPTIONS} value={reg.currentChallenges} onChange={(v) => up('currentChallenges', v)} />
      </>
    );
    return (
      <>
        <h3 className="wizard-section-title">Review your startup profile</h3>
        <ReviewSection title="Account"><ReviewField label="Email" value={reg.email} /><ReviewField label="Account type" value="Startup" /></ReviewSection>
        <ReviewSection title="Startup Basics"><ReviewField label="Name" value={reg.startupName} /><ReviewField label="Sector" value={reg.sector} /><ReviewField label="Country" value={reg.country} /><ReviewField label="Team size" value={reg.teamSize} /></ReviewSection>
        <ReviewSection title="Product & Stage"><ReviewField label="Stage" value={reg.stage} /><ReviewField label="Problem" value={reg.problemStatement} /><ReviewField label="Product" value={reg.productDescription} /><ReviewField label="Traction" value={reg.tractionLevel} />{reg.tractionDetail && <ReviewField label="Traction details" value={reg.tractionDetail} />}</ReviewSection>
        <ReviewSection title="Needs"><ReviewField label="Support needs" value={reg.supportNeeds} /><ReviewField label="Challenges" value={reg.currentChallenges} /></ReviewSection>
        <div className="dev-note">Public registrations start as pending. Programme records are created later by approved organisation accounts.</div>
      </>
    );
  }

  function renderContributorStep() {
    if (step === 1) return (
      <>
        <h3 className="wizard-section-title">Contributor Info</h3>
        <label>Full name<input value={reg.contributorName} onChange={(e) => up('contributorName', e.target.value)} required /></label>
        <label>Primary contributor type
          <select value={reg.contributorType} onChange={(e) => up('contributorType', e.target.value)} required>
            <option value="">Select type</option>
            {CONTRIBUTOR_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <FieldHelper text="This determines which fields are shown and how you appear in recommendations." />
      </>
    );
    if (step === 2) return (
      <>
        <h3 className="wizard-section-title">Expertise & Coverage</h3>
        <label>Sector expertise</label>
        <FieldHelper text="Select the industries and skill areas where you can add value." />
        <MultiSelect options={SECTOR_EXPERTISE_OPTIONS} value={reg.sectorExpertise} onChange={(v) => up('sectorExpertise', v)} />
        <label style={{ marginTop: 12 }}>Supported stages</label>
        <MultiSelect options={SUPPORTED_STAGE_OPTIONS} value={reg.supportedStages} onChange={(v) => up('supportedStages', v)} columns={3} />
        <label style={{ marginTop: 12 }}>Country coverage</label>
        <MultiSelect options={COUNTRY_OPTIONS} value={reg.countryCoverage} onChange={(v) => up('countryCoverage', v)} columns={4} />
        {reg.contributorType === 'Investor / Funder' && (
          <>
            <label style={{ marginTop: 12 }}>Investment thesis<input value={reg.investmentThesis} onChange={(e) => up('investmentThesis', e.target.value)} placeholder="AI, SaaS, Healthtech" /></label>
            <label>Ticket size<input value={reg.ticketSize} onChange={(e) => up('ticketSize', e.target.value)} placeholder="e.g. MYR 100k – MYR 1M" /></label>
          </>
        )}
        {reg.contributorType === 'Professional Service Provider' && (
          <>
            <label style={{ marginTop: 12 }}>Support areas offered</label>
            <MultiSelect options={SUPPORT_AREA_OPTIONS} value={reg.supportAreas} onChange={(v) => up('supportAreas', v)} />
          </>
        )}
      </>
    );
    if (step === 3) return (
      <>
        <h3 className="wizard-section-title">Capacity</h3>
        <label>Availability
          <select value={reg.availability} onChange={(e) => up('availability', e.target.value)}>
            <option>Available</option><option>Limited</option><option>Unavailable</option>
          </select>
        </label>
        <div className="auth-form-grid auth-form-grid-three">
          <label>Max programmes<input type="number" min="1" value={reg.globalMaxProgrammes} onChange={(e) => up('globalMaxProgrammes', e.target.value)} /></label>
          <label>Max startups<input type="number" min="1" value={reg.globalMaxStartupAssignments} onChange={(e) => up('globalMaxStartupAssignments', e.target.value)} /></label>
          <label>Per programme<input type="number" min="1" value={reg.perProgrammeStartupCapacity} onChange={(e) => up('perProgrammeStartupCapacity', e.target.value)} /></label>
        </div>
      </>
    );
    return (
      <>
        <h3 className="wizard-section-title">Review your contributor profile</h3>
        <ReviewSection title="Account"><ReviewField label="Email" value={reg.email} /><ReviewField label="Account type" value="Contributor" /></ReviewSection>
        <ReviewSection title="Contributor Info"><ReviewField label="Name" value={reg.contributorName} /><ReviewField label="Type" value={reg.contributorType} /></ReviewSection>
        <ReviewSection title="Expertise & Coverage"><ReviewField label="Sector expertise" value={reg.sectorExpertise} /><ReviewField label="Stages" value={reg.supportedStages} /><ReviewField label="Countries" value={reg.countryCoverage} />{reg.contributorType === 'Investor / Funder' && <><ReviewField label="Investment thesis" value={reg.investmentThesis} /><ReviewField label="Ticket size" value={reg.ticketSize} /></>}{reg.contributorType === 'Professional Service Provider' && <ReviewField label="Support areas" value={reg.supportAreas} />}</ReviewSection>
        <ReviewSection title="Capacity"><ReviewField label="Availability" value={reg.availability} /><ReviewField label="Max programmes" value={reg.globalMaxProgrammes} /><ReviewField label="Max startups" value={reg.globalMaxStartupAssignments} /><ReviewField label="Per programme" value={reg.perProgrammeStartupCapacity} /></ReviewSection>
        <div className="dev-note">Public registrations start as pending. Programme records are created later by approved organisation accounts.</div>
      </>
    );
  }

  function renderOrganisationStep() {
    if (step === 1) return (
      <>
        <h3 className="wizard-section-title">Organisation</h3>
        <label>Organisation name<input value={reg.organisationName} onChange={(e) => up('organisationName', e.target.value)} required /></label>
        <div className="auth-form-grid">
          <label>Organisation type
            <select value={reg.organisationType} onChange={(e) => up('organisationType', e.target.value)} required>
              <option value="">Select type</option>
              {ORG_TYPE_OPTIONS.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label>Country
            <select value={reg.country} onChange={(e) => up('country', e.target.value)} required>
              {COUNTRY_OPTIONS.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <FieldHelper text="How your organisation participates in the startup ecosystem." />
      </>
    );
    if (step === 2) return (
      <>
        <h3 className="wizard-section-title">Ecosystem Scope</h3>
        <label>Focus sectors</label>
        <FieldHelper text="The industries your programmes and partnerships target." />
        <MultiSelect options={FOCUS_SECTOR_OPTIONS} value={reg.focusSectors} onChange={(v) => up('focusSectors', v)} />
        <label style={{ marginTop: 12 }}>Main support areas</label>
        <MultiSelect options={SUPPORT_AREA_OPTIONS} value={reg.supportAreas} onChange={(v) => up('supportAreas', v)} />
      </>
    );
    return (
      <>
        <h3 className="wizard-section-title">Review your organisation profile</h3>
        <ReviewSection title="Account"><ReviewField label="Email" value={reg.email} /><ReviewField label="Account type" value="Organisation" /></ReviewSection>
        <ReviewSection title="Organisation"><ReviewField label="Name" value={reg.organisationName} /><ReviewField label="Type" value={reg.organisationType} /><ReviewField label="Country" value={reg.country} /></ReviewSection>
        <ReviewSection title="Ecosystem Scope"><ReviewField label="Focus sectors" value={reg.focusSectors} /><ReviewField label="Support areas" value={reg.supportAreas} /></ReviewSection>
        <div className="dev-note">Public registrations start as pending. Programme records are created later by approved organisation accounts.</div>
      </>
    );
  }

  function renderStepContent() {
    if (step === 0) return renderAccountStep();
    if (reg.accountType === 'startup') return renderStartupStep();
    if (reg.accountType === 'contributor') return renderContributorStep();
    return renderOrganisationStep();
  }

  const shownError = error || authError;

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-card">
          <div style={{ marginBottom: 24 }}>
            <div className="hero-kicker" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)', marginBottom: 16 }}>
              Lattice Access
            </div>
            <h1 style={{ fontSize: 32, color: 'var(--color-text)', marginBottom: 10, fontFamily: 'var(--font-display)' }}>
              Sign in to the programme workspace.
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              Each login maps to one startup, contributor, or organisation entity so recommendations stay tied to the ecosystem graph.
            </p>
          </div>

          <div className="auth-tabs">
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')} type="button">Sign in</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Create account</button>
          </div>

          {shownError ? <div className="auth-alert">{shownError}</div> : null}

          {mode === 'signin' ? (
            <form className="auth-form" onSubmit={handleSignIn}>
              <label>Email<input type="email" value={signInForm.email} onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })} required /></label>
              <label>Password<input type="password" value={signInForm.password} onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })} required /></label>
              <button className="btn btn-primary auth-submit" disabled={busy} type="submit">{busy ? 'Signing in...' : 'Sign in'}</button>
              <div className="demo-login-group">
                {demoAccounts.map((account) => (
                  <button key={account.email} className="role-button" disabled={busy} onClick={() => handleDemoSignIn(account)} type="button">{account.label}</button>
                ))}
                <div className="dev-note">Local demo: run <code>firebase emulators:start</code>, then <code>python3 seed_db.py</code>.</div>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegistration}>
              <WizardProgress steps={steps} current={step} />
              {renderStepContent()}
              <WizardNav step={step} maxStep={maxStep} onBack={goBack} onContinue={goNext} busy={busy} submitLabel={submitLabel} />
            </form>
          )}
        </div>
      </div>
      <div className="login-right">
        <div className="hero-kicker">Programme-First Relationship Engine</div>
        <h2 style={{ fontSize: 48, marginBottom: 20, fontFamily: 'var(--font-display)' }}>
          One account represents one ecosystem actor.
        </h2>
        <p style={{ fontSize: 18, color: '#c5d2df', lineHeight: 1.75, maxWidth: 560, marginBottom: 26 }}>
          Startups, contributors, and organisations register into their existing schema collections.
          The account document only links authentication to that entity.
        </p>
        <div className="hero-chip-grid" style={{ maxWidth: 520 }}>
          <div className="hero-chip"><strong>Entity account</strong><span>No startup member hierarchy is created for the MVP.</span></div>
          <div className="hero-chip"><strong>Schema-safe recommendations</strong><span>AI still reads companies, contributors, and programmes for embeddings and fit scoring.</span></div>
          <div className="hero-chip"><strong>Governed access</strong><span>New public accounts remain pending until reviewed by an active governance account.</span></div>
        </div>
      </div>
    </div>
  );
}
