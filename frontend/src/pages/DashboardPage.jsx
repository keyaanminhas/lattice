import { useEffect, useState } from 'react';
import { collection, getDocs, limit, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { db, functions } from '../firebase';
import { Badge, ScoreBadge, StatusPill, Spinner } from '../components/Shared';

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
        <div className="hero-kicker">Ecosystem Operations Brief</div>
        <div className="hero-title-row">
          <div>
            <h2>Govern ecosystem relationships through clear programme structures.</h2>
            <p>
              Lattice centralises admissions, actor-pool governance, mentor activation, and outcome learning
              into one operating layer so each relationship can be reviewed, justified, and reused.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary" onClick={() => navigate('/programmes')}>Review Programmes</button>
              <button className="btn btn-outline" onClick={() => navigate('/matches')}>Open Recommendation Queue</button>
              <button className="btn btn-outline" onClick={() => navigate('/insights')}>Open Intelligence View</button>
            </div>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>Programme pools precede startup access</strong>
              <span>Mentors, investors, partners, and providers are approved into formal pools before activation.</span>
            </div>
            <div className="hero-chip">
              <strong>Approval remains a formal control</strong>
              <span>Recommendations do not become operational assignments until an administrator confirms them.</span>
            </div>
            <div className="hero-chip">
              <strong>Outcome evidence informs future matching</strong>
              <span>Structured post-engagement feedback strengthens future recommendations and oversight.</span>
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
            <div className="stat-sub">{stats.activeRelationships} active governed relationships</div>
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
          <span>Administrators define sector, stage, geography, and expected outcome requirements.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">2</div>
          <strong>Assemble actor pools</strong>
          <span>Mentors, partners, investors, and service providers are admitted into governed programme pools.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">3</div>
          <strong>Admit startups</strong>
          <span>AI recommends programme fit, while administrators determine final admission decisions.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">4</div>
          <strong>Activate governed links</strong>
          <span>Only admitted startups can progress to mentor assignment and managed resource access.</span>
        </div>
      </div>

      <div className="section-grid">
        <div className="card glass-panel">
          <div className="card-header">
            <h3>Recent Recommendation Activity</h3>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/matches')}>View Full Queue</button>
          </div>
          {recentRecommendations.length === 0 ? (
            <div className="empty-state"><p>No recommendations generated yet.</p></div>
          ) : (
            <div className="stack-list">
              {recentRecommendations.map((item) => (
                <div key={item.id} className="stack-item recommendation-item">
                  <div className="stack-item-header">
                    <div>
                      <div className="stack-item-title">{item.recommendationType}</div>
                      <div className="stack-item-meta">{programmes[item.programmeId] || item.programmeId}</div>
                    </div>
                    <ScoreBadge score={item.matchScore} label="AI confidence" />
                  </div>
                  <div className="recommendation-meta-line">
                    <span className="meta-term">Source</span>
                    <span>{startups[item.sourceEntityId] || contributors[item.sourceEntityId] || item.sourceEntityId}</span>
                  </div>
                  <div className="recommendation-meta-line">
                    <span className="meta-term">Target</span>
                    <span>{programmes[item.targetEntityId] || contributors[item.targetEntityId] || item.targetEntityId}</span>
                  </div>
                  <p className="stack-item-copy">{item.explanation}</p>
                  <div className="recommendation-meta">
                    <StatusPill status={item.status} />
                    {item.riskFlags?.slice(0, 2).map((flag) => <Badge key={flag} variant="red">{flag}</Badge>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="stat-rail">
          <div className="stat-rail-card">
            <strong>{stats?.pendingApplications || 0}</strong>
            <span>startup applications remain under administrative review</span>
          </div>
          <div className="stat-rail-card">
            <strong>{stats?.programmePoolAssignments || 0}</strong>
            <span>programme-pool assignments are approved across the active portfolio</span>
          </div>
          <div className="stat-rail-card">
            <strong>{stats?.activeRelationships || 0}</strong>
            <span>governed relationships are currently active inside programme contexts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
