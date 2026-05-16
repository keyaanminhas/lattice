import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import LoginPage from './pages/LoginPage';
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

export default function App() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <LoginPage onLogin={(u) => setUser(u)} />;
  }

  // Determine home page based on role
  let Home = DashboardPage;
  if (user.role === 'company') Home = () => <CompanyDashboard user={user} />;
  if (user.role === 'contributor') Home = () => <ContributorDashboard user={user} />;

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar user={user} onLogout={() => setUser(null)} />
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
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/contributors" element={<ContributorsPage />} />
            <Route path="/programmes" element={<ProgrammesPage />} />
            <Route path="/programmes/:id" element={<ProgrammeDetailPage />} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
