import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
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

function mapAccountToUser(firebaseUser, account) {
  let role = 'admin';
  if (account.accountType === 'startup') role = 'company';
  if (account.accountType === 'contributor') role = 'contributor';

  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    accountType: account.accountType,
    entityType: account.entityType,
    role,
    id: account.entityId,
    name: account.displayName || firebaseUser.email || 'Lattice Account',
    status: account.status || 'Pending',
  };
}

function AuthLoadingPanel() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-card">
        <div className="hero-kicker" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)', marginBottom: 16 }}>
          Lattice Access
        </div>
        <h1>Opening workspace</h1>
        <p>Checking the signed-in account before loading programme data.</p>
        <div className="spinner" />
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
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const timeoutId = window.setTimeout(() => {
      if (initialResolved) return;
      initialResolved = true;
      setUser(null);
      setAuthError('Firebase Auth emulator is not reachable. Start Firebase emulators to use demo login or registration.');
      setAuthReady(true);
    }, 2500);

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
        const accountRef = doc(db, 'accounts', firebaseUser.uid);
        const accountSnap = await getDoc(accountRef);
        if (!accountSnap.exists()) {
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

    if (isLocalhost) {
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

  if (!authReady) {
    return <AuthLoadingPanel />;
  }

  if (!user) {
    return <LoginPage authError={authError} />;
  }

  if (user.status !== 'Active') {
    return <PendingAccountPage user={user} onLogout={() => signOut(auth)} />;
  }

  // Determine home page based on role
  let Home = DashboardPage;
  if (user.role === 'company') Home = () => <CompanyDashboard user={user} />;
  if (user.role === 'contributor') Home = () => <ContributorDashboard user={user} />;
  const handleLogout = () => signOut(auth);

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar user={user} onLogout={handleLogout} />
        <div className="mobile-topbar">
          <div>
            <strong>Lattice</strong>
            <span>{user.name}</span>
          </div>
          <button onClick={handleLogout} type="button">Logout</button>
        </div>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            
            {/* Admin only routes */}
            {user.role === 'admin' && (
              <>
                <Route path="/matches" element={<MatchesPage />} />
                <Route path="/insights" element={<InsightsPage />} />
              </>
            )}

            {/* Shared routes */}
            {user.role !== 'company' && (
              <>
                <Route path="/companies" element={<CompaniesPage user={user} />} />
                <Route path="/companies/:id" element={<CompanyDetailPage user={user} />} />
              </>
            )}
            <Route path="/contributors" element={<ContributorsPage />} />
            <Route path="/programmes" element={<ProgrammesPage user={user} />} />
            <Route path="/programmes/:id" element={<ProgrammeDetailPage user={user} />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
