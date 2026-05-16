import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { ScoreBadge, StatusPill, Spinner } from '../components/Shared';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recentRecommendations, setRecentRecommendations] = useState([]);
  const [startups, setStartups] = useState({});
  const [contributors, setContributors] = useState({});
  const [programmes, setProgrammes] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const [startupSnap, contributorSnap, programmeSnap] = await Promise.all([
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'contributors')),
          getDocs(collection(db, 'programmes')),
        ]);

        const startupMap = {};
        startupSnap.forEach((doc) => { startupMap[doc.id] = doc.data().name; });
        const contributorMap = {};
        contributorSnap.forEach((doc) => { contributorMap[doc.id] = doc.data().name; });
        const programmeMap = {};
        programmeSnap.forEach((doc) => { programmeMap[doc.id] = doc.data().name; });
        setStartups(startupMap);
        setContributors(contributorMap);
        setProgrammes(programmeMap);

        const getStats = httpsCallable(functions, 'get_dashboard_stats');
        const result = await getStats({});
        setStats(result.data);

        const recSnap = await getDocs(query(collection(db, 'recommendations'), limit(5)));
        const recList = [];
        recSnap.forEach((doc) => recList.push({ id: doc.id, ...doc.data() }));
        setRecentRecommendations(recList);
      } catch (error) {
        console.error('Failed to load dashboard:', error);
      }

      setLoading(false);
    }

    load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div>
      <div className="hero-panel">
        <div className="hero-kicker">Programme-First Control Layer</div>
        <div className="hero-title-row">
          <div>
            <h2>Govern the ecosystem through programmes, not ad hoc matching.</h2>
            <p>
              Lattice now routes startup admissions, contributor pools, mentor assignment, and outcome learning
              through programme context so every linkage is explainable, approved, and reusable.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate('/programmes')}>Open Programmes</button>
              <button className="btn btn-outline" onClick={() => navigate('/matches')}>Review Queue</button>
              <button className="btn btn-outline" onClick={() => navigate('/insights')}>AI Insights</button>
            </div>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>Programme pools before startup access</strong>
              <span>Mentors, investors, partners, and providers are governed at the programme layer first.</span>
            </div>
            <div className="hero-chip">
              <strong>Human approval stays in the loop</strong>
              <span>Recommendations do not become operational relationships until a programme admin approves them.</span>
            </div>
            <div className="hero-chip">
              <strong>Learning compounds with outcomes</strong>
              <span>Structured feedback feeds back into future programme and mentor recommendations.</span>
            </div>
          </div>
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-label">Organisations</div>
            <div className="stat-value">{stats.totalOrganisations}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Open Programmes</div>
            <div className="stat-value">{stats.openProgrammes}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Startups</div>
            <div className="stat-value">{stats.totalStartups}</div>
            <div className="stat-sub">{stats.verifiedStartups} verified</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pool Assignments</div>
            <div className="stat-value">{stats.programmePoolAssignments}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Applications</div>
            <div className="stat-value">{stats.pendingApplications}</div>
            <div className="stat-sub">{stats.acceptedApplications} accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Pending Recommendations</div>
            <div className="stat-value">{stats.pendingRecommendations}</div>
            <div className="stat-sub">{stats.activeRelationships} active relationships</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Completed Relationships</div>
            <div className="stat-value">{stats.completedRelationships}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Outcome Success Rate</div>
            <div className="stat-value">{stats.outcomeSuccessRate}%</div>
          </div>
        </div>
      )}

      <div className="flow-strip">
        <div className="flow-step">
          <div className="step-index">1</div>
          <strong>Create programme context</strong>
          <span>Organisation admins define sector, stage, and expected outcome constraints.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">2</div>
          <strong>Assemble actor pools</strong>
          <span>Mentors, partners, investors, and service providers attach to programmes first.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">3</div>
          <strong>Admit startups</strong>
          <span>AI recommends startup-to-programme fit and admins decide admissions.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">4</div>
          <strong>Activate governed links</strong>
          <span>Only accepted startups receive mentor assignment and programme resource access.</span>
        </div>
      </div>

      <div className="section-grid">
        <div className="card glass-panel">
          <div className="card-header">
            <h3>Recent AI Recommendations</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/matches')}>View All</button>
          </div>
          {recentRecommendations.length === 0 ? (
            <div className="empty-state"><p>No recommendations generated yet.</p></div>
          ) : (
            <div className="recommendation-grid">
              {recentRecommendations.map((item) => (
                <div key={item.id} className="recommendation-card">
                  <div className="stack-item-header">
                    <div>
                      <h4>{item.recommendationType}</h4>
                      <div className="stack-item-meta">{programmes[item.programmeId] || item.programmeId}</div>
                    </div>
                    <ScoreBadge score={item.matchScore} />
                  </div>
                  <p>
                    {startups[item.sourceEntityId] || contributors[item.sourceEntityId] || item.sourceEntityId}
                  </p>
                  <div className="recommendation-meta">
                    <StatusPill status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stat-rail">
          <div className="stat-rail-card">
            <strong>{stats?.pendingApplications || 0}</strong>
            <span>startup applications still waiting on human review</span>
          </div>
          <div className="stat-rail-card">
            <strong>{stats?.programmePoolAssignments || 0}</strong>
            <span>programme-pool assignments already approved across the ecosystem</span>
          </div>
          <div className="stat-rail-card">
            <strong>{stats?.activeRelationships || 0}</strong>
            <span>active governed relationships currently running inside programme contexts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
