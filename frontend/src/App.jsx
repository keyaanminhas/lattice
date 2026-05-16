import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, usingEmulators } from './firebase';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
import PendingAccountPage from './pages/PendingAccountPage';
import DashboardPage from './pages/DashboardPage';
import CompanyDashboard from './pages/CompanyDashboard';
import ContributorDashboard from './pages/ContributorDashboard';
import CompaniesPage from './pages/CompaniesPage';
import CompanyDetailPage from './pages/CompanyDetailPage';
import ContributorsPage from './pages/ContributorsPage';
import MatchesPage from './pages/MatchesPage';
import InsightsPage from './pages/InsightsPage';
import ProgrammesPage from './pages/ProgrammesPage';
import ProgrammeDetailPage from './pages/ProgrammeDetailPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import SettingsPage from './pages/SettingsPage';
import CreateProgrammePage from './pages/CreateProgrammePage';
import OutcomesPage from './pages/OutcomesPage';
import FeatureGuidePage from './pages/FeatureGuidePage';
import { canAccessRoute } from './config/accessPolicy';

const CONTRIBUTOR_ROLES = new Set(['mentor', 'partner', 'investor', 'service_provider', 'contributor']);

function normaliseRoleKey(account) {
  if (account?.roleKey) return account.roleKey;
  if (account?.accountType === 'startup') return 'startup';
  if (account?.accountType === 'contributor') return 'mentor';
  if (account?.accountType === 'organisation') return 'organisation_admin';
  return 'startup';
}

function mapAccountToUser(firebaseUser, account) {
  const roleKey = normaliseRoleKey(account);

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    accountType: account.accountType,
    entityType: account.entityType,
    roleKey,
    id: account.entityId,
    name: account.displayName || firebaseUser.email || 'Lattice Account',
    status: account.status || 'Pending',
  };
}

async function loadAccountWithRetry(uid, attempts = 8, delayMs = 300) {
  const accountRef = doc(db, 'accounts', uid);
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const accountSnap = await getDoc(accountRef);
      if (accountSnap.exists()) return { ref: accountRef, snap: accountSnap };
      lastError = null;
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts - 1) {
      await new Promise((resolve) => window.setTimeout(resolve, delayMs * (attempt + 1)));
    }
  }

  if (lastError) {
    throw lastError;
  }

  return { ref: accountRef, snap: null };
}

function AuthLoadingPanel() {
  return (
    <div className="auth-loading-screen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: 'var(--color-bg-base)' }}>
      <div className="auth-loading-card" style={{ padding: 40, background: 'var(--color-surface)', borderRadius: 12, border: '1px solid var(--color-border)', textAlign: 'center' }}>
        <div className="hero-kicker" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)', marginBottom: 16, display: 'inline-block', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
          Lattice Access
        </div>
        <h1 style={{ marginBottom: 12, fontSize: 24 }}>Opening workspace</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: 24 }}>Checking the signed-in account before loading programme data.</p>
        <div className="spinner" style={{ margin: '0 auto' }} />
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    let initialResolved = false;
    const timeoutId = window.setTimeout(() => {
      if (initialResolved) return;
      initialResolved = true;
      setUser(null);
      setAuthError(
        usingEmulators
          ? 'Firebase Auth emulator is not reachable. Start Firebase emulators to use demo login or registration.'
          : 'Authentication is taking too long to initialize. Reload and sign in again if this persists.',
      );
      setAuthReady(true);
    }, usingEmulators ? 2500 : 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!initialResolved) {
        initialResolved = true;
        window.clearTimeout(timeoutId);
      }
      setAuthError('');
      if (!firebaseUser) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      try {
        const { ref: accountRef, snap: accountSnap } = await loadAccountWithRetry(firebaseUser.uid);
        if (!accountSnap) {
          setUser(null);
          setAuthError('This login exists in Firebase Auth but has no Lattice account mapping yet.');
          setAuthReady(true);
          return;
        }

        const account = accountSnap.data();
        setUser(mapAccountToUser(firebaseUser, account));
        setAuthReady(true);
        updateDoc(accountRef, { lastLoginAt: serverTimestamp() }).catch(() => {});
      } catch (error) {
        console.error('Failed to load account:', error);
        setUser(null);
        setAuthError('Could not load the Lattice account for this login.');
        setAuthReady(true);
      }
    });

    if (usingEmulators) {
      fetch('http://127.0.0.1:9099/', { mode: 'no-cors' }).catch(() => {
        setAuthError((current) => current || 'Firebase Auth emulator is not reachable. Start Firebase emulators to use demo login or registration.');
        setAuthReady(true);
      });
    }

    return () => {
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  if (!authReady) return <AuthLoadingPanel />;
  if (!user) return <LoginPage authError={authError} />;
  if (user.status !== 'Active') return <PendingAccountPage user={user} onLogout={() => signOut(auth)} />;

  const isStartup = user.roleKey === 'startup';
  const isContributor = CONTRIBUTOR_ROLES.has(user.roleKey);

  let Home = () => <DashboardPage user={user} />;
  if (isStartup) Home = () => <CompanyDashboard user={user} />;
  if (isContributor) Home = () => <ContributorDashboard user={user} />;

  const handleLogout = () => signOut(auth);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="app-main">
          <header className="app-header">
            <div className="search-wrap" style={{ maxWidth: 420 }}>
              <span className="material-symbols-outlined">search</span>
              <input className="filter-input" placeholder="Search startups, programmes, or contributors..." style={{ width: '100%', paddingLeft: 34 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button className="sidebar-logout-btn"><span className="material-symbols-outlined">notifications</span></button>
              <button className="sidebar-logout-btn"><span className="material-symbols-outlined">help_outline</span></button>
              <button className="sidebar-logout-btn" onClick={handleLogout} title="Logout">
                <span className="material-symbols-outlined">logout</span>
              </button>
            </div>
          </header>
          <main className="app-page">
            <Routes>
              <Route path="/" element={<Home />} />
              {canAccessRoute(user.roleKey, '/matches') ? <Route path="/matches" element={<MatchesPage user={user} />} /> : null}
              {canAccessRoute(user.roleKey, '/insights') ? <Route path="/insights" element={<InsightsPage />} /> : null}
              {canAccessRoute(user.roleKey, '/settings') ? <Route path="/settings" element={<SettingsPage />} /> : null}
              {canAccessRoute(user.roleKey, '/outcomes') ? <Route path="/outcomes" element={<OutcomesPage />} /> : null}
              {canAccessRoute(user.roleKey, '/programmes/create') ? <Route path="/programmes/create" element={<CreateProgrammePage user={user} />} /> : null}
              {canAccessRoute(user.roleKey, '/companies') ? <Route path="/companies" element={<CompaniesPage />} /> : null}
              {canAccessRoute(user.roleKey, '/companies') ? <Route path="/companies/:id" element={<CompanyDetailPage user={user} />} /> : null}
              {canAccessRoute(user.roleKey, '/contributors') ? <Route path="/contributors" element={<ContributorsPage />} /> : null}
              {canAccessRoute(user.roleKey, '/programmes') ? <Route path="/programmes" element={<ProgrammesPage user={user} />} /> : null}
              {canAccessRoute(user.roleKey, '/programmes') ? <Route path="/programmes/:id" element={<ProgrammeDetailPage user={user} />} /> : null}
              {canAccessRoute(user.roleKey, '/feature-guide') ? <Route path="/feature-guide" element={<FeatureGuidePage user={user} />} /> : null}
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="app-footer">
            <span>© {new Date().getFullYear()} Lattice Ecosystem Platform. All rights reserved.</span>
            <div className="footer-links">
              <Link to="/privacy">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>shield</span>
                Privacy Policy
              </Link>
              <a href="mailto:support@lattice-platform.io">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>mail</span>
                Contact
              </a>
              <a href="https://github.com" target="_blank" rel="noopener noreferrer">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>code</span>
                GitHub
              </a>
            </div>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
