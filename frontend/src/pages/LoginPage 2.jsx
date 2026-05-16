import { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

const demoAccounts = [
  { label: 'Ecosystem Admin', email: 'admin@lattice.demo', password: 'lattice-demo-admin' },
  { label: 'MediScan AI Startup', email: 'startup@lattice.demo', password: 'lattice-demo-startup' },
  { label: 'Dr. Sarah Lim Contributor', email: 'contributor@lattice.demo', password: 'lattice-demo-contributor' },
];

const initialRegistration = {
  startupName: '',
  email: '',
  password: '',
  sector: '',
  stage: 'MVP',
  country: 'Malaysia',
  teamSize: '2',
  supportNeeds: '',
  problemStatement: '',
  productDescription: '',
  traction: '',
};

function formatAuthError(error) {
  if (error?.code === 'auth/invalid-credential') return 'Email or password is incorrect.';
  if (error?.code === 'auth/email-already-in-use') return 'An account already exists for this email.';
  if (error?.code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (error?.code === 'auth/network-request-failed') return 'Could not reach Firebase Auth. Check that the emulator is running locally.';
  if (error?.code === 'auth/configuration-not-found') return 'Firebase Auth is not configured for this project. Use the local Auth emulator or enable an Auth provider in Firebase.';
  return error?.message || 'Authentication failed.';
}

export default function LoginPage({ authError }) {
  const [mode, setMode] = useState('signin');
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [registration, setRegistration] = useState(initialRegistration);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSignIn(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, signInForm.email.trim(), signInForm.password);
    } catch (err) {
      setError(formatAuthError(err));
    }
    setBusy(false);
  }

  async function handleDemoSignIn(account) {
    setBusy(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, account.email, account.password);
    } catch (err) {
      setError(`${formatAuthError(err)} Run python3 seed_db.py after starting the Firebase emulators to create demo logins.`);
    }
    setBusy(false);
  }

  async function handleRegistration(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const credential = await createUserWithEmailAndPassword(
        auth,
        registration.email.trim(),
        registration.password
      );
      const uid = credential.user.uid;
      const companyId = `comp-${uid}`;
      const needs = registration.supportNeeds
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      await setDoc(doc(db, 'companies', companyId), {
        id: companyId,
        organisationId: `org-startup-${uid}`,
        name: registration.startupName.trim(),
        companyName: registration.startupName.trim(),
        sector: registration.sector.trim(),
        industry: registration.sector.trim(),
        stage: registration.stage,
        country: registration.country.trim(),
        teamSize: Number(registration.teamSize) || 1,
        problemStatement: registration.problemStatement.trim(),
        productDescription: registration.productDescription.trim(),
        supportNeeds: needs,
        traction: registration.traction.trim(),
        currentChallenges: [],
        verificationStatus: 'Pending',
        createdAt: serverTimestamp(),
      });

      await setDoc(doc(db, 'accounts', uid), {
        accountType: 'startup',
        entityType: 'company',
        entityId: companyId,
        displayName: registration.startupName.trim(),
        email: registration.email.trim(),
        status: 'Pending',
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
      });
      await signOut(auth);
      await signInWithEmailAndPassword(auth, registration.email.trim(), registration.password);
    } catch (err) {
      setError(formatAuthError(err));
    }
    setBusy(false);
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
              Startup accounts map directly to company profiles, so recommendations stay tied to the ecosystem entity.
            </p>
          </div>

          <div className="auth-tabs">
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => setMode('signin')} type="button">
              Sign in
            </button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')} type="button">
              Startup register
            </button>
          </div>

          {shownError ? <div className="auth-alert">{shownError}</div> : null}

          {mode === 'signin' ? (
            <form className="auth-form" onSubmit={handleSignIn}>
              <label>
                Email
                <input
                  type="email"
                  value={signInForm.email}
                  onChange={(event) => setSignInForm({ ...signInForm, email: event.target.value })}
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={signInForm.password}
                  onChange={(event) => setSignInForm({ ...signInForm, password: event.target.value })}
                  required
                />
              </label>
              <button className="btn btn-primary auth-submit" disabled={busy} type="submit">
                {busy ? 'Signing in...' : 'Sign in'}
              </button>

              <div className="demo-login-group">
                {demoAccounts.map((account) => (
                  <button
                    key={account.email}
                    className="role-button"
                    disabled={busy}
                    onClick={() => handleDemoSignIn(account)}
                    type="button"
                  >
                    {account.label}
                  </button>
                ))}
                <div className="dev-note">
                  Local demo: run <code>firebase emulators:start</code>, then <code>python3 seed_db.py</code>.
                </div>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegistration}>
              <label>
                Startup name
                <input
                  value={registration.startupName}
                  onChange={(event) => setRegistration({ ...registration, startupName: event.target.value })}
                  required
                />
              </label>
              <div className="auth-form-grid">
                <label>
                  Email
                  <input
                    type="email"
                    value={registration.email}
                    onChange={(event) => setRegistration({ ...registration, email: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    value={registration.password}
                    onChange={(event) => setRegistration({ ...registration, password: event.target.value })}
                    required
                    minLength={6}
                  />
                </label>
              </div>
              <div className="auth-form-grid">
                <label>
                  Sector
                  <input
                    value={registration.sector}
                    onChange={(event) => setRegistration({ ...registration, sector: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Stage
                  <select value={registration.stage} onChange={(event) => setRegistration({ ...registration, stage: event.target.value })}>
                    <option>Idea</option>
                    <option>MVP</option>
                    <option>Pre-seed</option>
                    <option>Seed</option>
                    <option>Growth</option>
                  </select>
                </label>
              </div>
              <div className="auth-form-grid">
                <label>
                  Country
                  <input
                    value={registration.country}
                    onChange={(event) => setRegistration({ ...registration, country: event.target.value })}
                    required
                  />
                </label>
                <label>
                  Team size
                  <input
                    type="number"
                    min="1"
                    value={registration.teamSize}
                    onChange={(event) => setRegistration({ ...registration, teamSize: event.target.value })}
                    required
                  />
                </label>
              </div>
              <label>
                Support needs
                <input
                  placeholder="Clinical pilot access, investor readiness"
                  value={registration.supportNeeds}
                  onChange={(event) => setRegistration({ ...registration, supportNeeds: event.target.value })}
                  required
                />
              </label>
              <label>
                Problem statement
                <textarea
                  value={registration.problemStatement}
                  onChange={(event) => setRegistration({ ...registration, problemStatement: event.target.value })}
                  required
                />
              </label>
              <label>
                Product description
                <textarea
                  value={registration.productDescription}
                  onChange={(event) => setRegistration({ ...registration, productDescription: event.target.value })}
                  required
                />
              </label>
              <label>
                Traction
                <input
                  value={registration.traction}
                  onChange={(event) => setRegistration({ ...registration, traction: event.target.value })}
                />
              </label>
              <button className="btn btn-primary auth-submit" disabled={busy} type="submit">
                {busy ? 'Creating account...' : 'Create startup account'}
              </button>
            </form>
          )}
        </div>
      </div>
      <div className="login-right">
        <div className="hero-kicker">Programme-First Relationship Engine</div>
        <h2 style={{ fontSize: 48, marginBottom: 20, fontFamily: 'var(--font-display)' }}>
          One login maps to one ecosystem actor.
        </h2>
        <p style={{ fontSize: 18, color: '#c5d2df', lineHeight: 1.75, maxWidth: 560, marginBottom: 26 }}>
          Startups sign in as the company profile that receives programme recommendations, applications,
          governed mentor access, and outcome tracking.
        </p>
        <div className="hero-chip-grid" style={{ maxWidth: 520 }}>
          <div className="hero-chip">
            <strong>Entity account</strong>
            <span>Authentication maps to a startup, contributor, or admin organisation without changing the matching schema.</span>
          </div>
          <div className="hero-chip">
            <strong>Schema-safe recommendations</strong>
            <span>AI still reads companies, contributors, and programmes for embeddings and fit scoring.</span>
          </div>
          <div className="hero-chip">
            <strong>Admin-governed access</strong>
            <span>New startups start pending and programme admission remains a reviewed decision.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
