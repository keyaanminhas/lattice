import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { db, functions } from '../firebase';
import { Badge, GraphEvidence, ScoreBadge, ScoreBreakdown, StatusPill, Spinner } from '../components/Shared';
import { RoleAccessBanner } from '../components/FeatureVisibility';
import { trackRoleFeatureEvent } from '../services/telemetry';
import { canPerformAction } from '../config/accessPolicy';

export default function ProgrammeDetailPage({ user }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [programme, setProgramme] = useState(null);
  const [applications, setApplications] = useState([]);
  const [poolAssignments, setPoolAssignments] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [graphView, setGraphView] = useState(null);
  const [startupNames, setStartupNames] = useState({});
  const [contributorNames, setContributorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [graphError, setGraphError] = useState('');
  const [busyStartupId, setBusyStartupId] = useState('');
  const [busyApplicationId, setBusyApplicationId] = useState('');
  const [busyConnectionId, setBusyConnectionId] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError('');
      setGraphError('');

      try {
        const [programmeDoc, startupSnap, contributorSnap, appSnap, poolSnap, recSnap, relSnap] = await Promise.all([
          getDoc(doc(db, 'programmes', id)),
          getDocs(collection(db, 'companies')),
          getDocs(collection(db, 'contributors')),
          getDocs(query(collection(db, 'applications'), where('programmeId', '==', id))),
          getDocs(query(collection(db, 'programmeContributors'), where('programmeId', '==', id))),
          getDocs(query(collection(db, 'recommendations'), where('programmeId', '==', id))),
          getDocs(query(collection(db, 'relationships'), where('programmeId', '==', id))),
        ]);

        if (cancelled) return;

        setProgramme(programmeDoc.exists() ? { id: programmeDoc.id, ...programmeDoc.data() } : null);

        const startupMap = {};
        startupSnap.forEach((item) => { startupMap[item.id] = item.data().name; });
        const contributorMap = {};
        contributorSnap.forEach((item) => { contributorMap[item.id] = item.data().name; });
        setStartupNames(startupMap);
        setContributorNames(contributorMap);

        const appList = [];
        appSnap.forEach((item) => appList.push({ id: item.id, ...item.data() }));
        const poolList = [];
        poolSnap.forEach((item) => poolList.push({ id: item.id, ...item.data() }));
        const recList = [];
        recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
        const relList = [];
        relSnap.forEach((item) => relList.push({ id: item.id, ...item.data() }));

        setApplications(appList);
        setPoolAssignments(poolList);
        setRecommendations(recList);
        setRelationships(relList);

        try {
          const getGraphView = httpsCallable(functions, 'get_programme_graph_view');
          const graphResult = await getGraphView({ programmeId: id });
          if (!cancelled) setGraphView(graphResult.data);
        } catch (error) {
          console.error('Failed to load programme graph view:', error);
          if (!cancelled) {
            setGraphView(null);
            setGraphError('Programme graph insights are not available for this account.');
            trackRoleFeatureEvent('permission_attempt_failed', { action: 'get_programme_graph_view', programmeId: id });
          }
        }

        trackRoleFeatureEvent('programme_page_loaded', { programmeId: id });
      } catch (error) {
        console.error('Failed to load programme detail:', error);
        if (!cancelled) setLoadError('Programme data could not be loaded.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (loading) return;
    const section = searchParams.get('section');
    if (!section) return;
    const sectionIdMap = {
      applications: 'section-applications',
      connections: 'section-connections',
      'mentor-generation': 'section-applications',
      relationships: 'section-relationships',
    };
    const targetId = sectionIdMap[section];
    if (!targetId) return;
    const node = document.getElementById(targetId);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [loading, searchParams]);

  async function generateMentorRecommendations(startupId) {
    setBusyStartupId(startupId);
    try {
      const recommend = httpsCallable(functions, 'recommend_mentor_for_startup');
      await recommend({ startupId, programmeId: id });
      trackRoleFeatureEvent('mentor_recommendation_generated', { programmeId: id, startupId });
      const recSnap = await getDocs(query(collection(db, 'recommendations'), where('programmeId', '==', id)));
      const recList = [];
      recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
      setRecommendations(recList);
    } catch (error) {
      console.error('Failed to generate mentor recommendations:', error);
      trackRoleFeatureEvent('permission_attempt_failed', { action: 'recommend_mentor_for_startup', programmeId: id, startupId });
      alert('Failed to generate mentor recommendations. Check the function logs.');
    }
    setBusyStartupId('');
  }

  async function reviewProgrammeApplication(applicationId, decision) {
    setBusyApplicationId(applicationId);
    try {
      const review = httpsCallable(functions, 'review_programme_application');
      await review({ applicationId, decision });
      const [appSnap, relSnap] = await Promise.all([
        getDocs(query(collection(db, 'applications'), where('programmeId', '==', id))),
        getDocs(query(collection(db, 'relationships'), where('programmeId', '==', id))),
      ]);
      const appList = [];
      appSnap.forEach((item) => appList.push({ id: item.id, ...item.data() }));
      const relList = [];
      relSnap.forEach((item) => relList.push({ id: item.id, ...item.data() }));
      setApplications(appList);
      setRelationships(relList);
    } catch (error) {
      console.error('Failed to review programme application:', error);
      alert(error?.message || 'Failed to review programme application.');
    }
    setBusyApplicationId('');
  }

  async function reviewProgrammeConnectionRequest(requestId, decision) {
    setBusyConnectionId(requestId);
    try {
      const review = httpsCallable(functions, 'review_programme_connection_request');
      await review({ requestId, decision });
      const [poolSnap, relSnap] = await Promise.all([
        getDocs(query(collection(db, 'programmeContributors'), where('programmeId', '==', id))),
        getDocs(query(collection(db, 'relationships'), where('programmeId', '==', id))),
      ]);
      const poolList = [];
      poolSnap.forEach((item) => poolList.push({ id: item.id, ...item.data() }));
      const relList = [];
      relSnap.forEach((item) => relList.push({ id: item.id, ...item.data() }));
      setPoolAssignments(poolList);
      setRelationships(relList);
    } catch (error) {
      console.error('Failed to review contributor connection request:', error);
      alert(error?.message || 'Failed to review contributor connection request.');
    }
    setBusyConnectionId('');
  }

  if (loading) return <Spinner />;
  if (loadError) return <div className="empty-state"><p>{loadError}</p><button className="btn btn-outline" onClick={() => navigate('/programmes')}>Back to Programmes</button></div>;
  if (!programme) return <div className="empty-state"><p>Programme not found.</p></div>;

  const canGenerateMentorRecommendations = () => canPerformAction(user?.roleKey, 'recommend_mentor_for_startup');
  const canReviewProgrammeApplication = canPerformAction(user?.roleKey, 'review_programme_application');
  const canReviewProgrammeConnectionRequest = canPerformAction(user?.roleKey, 'review_programme_connection_request');
  const activeSection = searchParams.get('section') || '';
  const pendingConnectionRequests = poolAssignments.filter((item) => item.status === 'Pending Approval');
  const approvedPoolAssignments = poolAssignments.filter((item) => item.status === 'Approved');
  const mentorPool = approvedPoolAssignments.filter((item) => item.contributorType === 'Mentor');
  const resourcePool = approvedPoolAssignments.filter((item) => item.contributorType !== 'Mentor');

  return (
    <div>
      <RoleAccessBanner roleKey={user?.roleKey || 'programme_admin'} scopeLabel={`Programme scope: ${id}`} />
      <div className="hero-panel">
        <div className="hero-kicker">Programme Operations</div>
        <div className="hero-title-row">
          <div>
            <h2>{programme.name}</h2>
            <p>
              This programme controls startup admission, governs contributor pool access,
              and activates mentor matching only after formal acceptance.
            </p>
            <div className="hero-actions">
              <button className="btn btn-outline" onClick={() => navigate('/programmes')}>Back to Programmes</button>
            </div>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{programme.type}</strong>
              <span>{programme.country || programme.region}</span>
            </div>
            <div className="hero-chip">
              <strong>{applications.filter((item) => item.status === 'Accepted').length} accepted startups</strong>
              <span>Only accepted startups can move into mentor matching.</span>
            </div>
            <div className="hero-chip">
              <strong>{approvedPoolAssignments.length} approved pool actors</strong>
              <span>Programme resources are controlled through explicit approval.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flow-strip">
        <div className="flow-step">
          <div className="step-index">1</div>
          <strong>Programme fit</strong>
          <span>AI evaluates startups against sector, stage, and expected outcome criteria.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">2</div>
          <strong>Administrative admission</strong>
          <span>Accepted startups become eligible for programme resources and mentor matching.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">3</div>
          <strong>Mentor activation</strong>
          <span>Mentor recommendations are generated only from the approved mentor pool.</span>
        </div>
        <div className="flow-step">
          <div className="step-index">4</div>
          <strong>Outcome tracking</strong>
          <span>Every relationship feeds the learning loop for stronger future orchestration.</span>
        </div>
      </div>

      {activeSection ? (
        <div className="card glass-panel" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>Focused Queue: {activeSection.replace('-', ' ')}</h3>
          </div>
          <p className="cell-muted">You are viewing this programme from a queue shortcut. Relevant review surfaces are below.</p>
        </div>
      ) : null}

      <div className="detail-sections">
        <div className="card glass-panel">
          <h3 style={{ marginBottom: 16 }}>Programme Governance Profile</h3>
          <div className="detail-field">
            <label>Target Sectors</label>
            <div className="entity-tags">{programme.targetSectors?.map((item) => <Badge key={item} variant="blue">{item}</Badge>)}</div>
          </div>
          <div className="detail-field">
            <label>Target Stages</label>
            <div className="entity-tags">{programme.targetStages?.map((item) => <Badge key={item} variant="gray">{item}</Badge>)}</div>
          </div>
          <div className="detail-field">
            <label>Expected Outcomes</label>
            <div className="entity-tags">{programme.expectedOutcomes?.map((item) => <Badge key={item} variant="green">{item}</Badge>)}</div>
          </div>
          <div className="detail-field">
            <label>Eligibility Rules</label>
            <div className="stack-list">
              {programme.eligibilityRules?.map((item) => (
                <div key={item} className="stack-item">
                  <div className="stack-item-copy">{item}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="stat-rail">
          <div className="stat-rail-card">
            <strong>{applications.length}</strong>
            <span>startup applications tracked inside this programme</span>
          </div>
          <div className="stat-rail-card">
            <strong>{mentorPool.length}</strong>
            <span>approved mentors in the programme actor pool</span>
          </div>
          <div className="stat-rail-card">
            <strong>{resourcePool.length}</strong>
            <span>partners, investors, and providers accessible through the programme</span>
          </div>
          <div className="stat-rail-card">
            <strong>{relationships.length}</strong>
            <span>active or tracked programme-scoped relationships</span>
          </div>
        </div>
      </div>

      {graphView ? (
        <div className="two-col" style={{ marginBottom: 20 }}>
          <div className="card glass-panel">
            <div className="card-header">
              <h3>LatticeGraph</h3>
            </div>
            <div className="stat-rail" style={{ marginBottom: 0 }}>
              <div className="stat-rail-card">
                <strong>{graphView.counts?.acceptedStartups || 0}</strong>
                <span>accepted startups in graph scope</span>
              </div>
              <div className="stat-rail-card">
                <strong>{graphView.counts?.attachedMentors || 0}</strong>
                <span>attached mentors</span>
              </div>
              <div className="stat-rail-card">
                <strong>{(graphView.counts?.attachedPartners || 0) + (graphView.counts?.attachedInvestors || 0) + (graphView.counts?.attachedServiceProviders || 0)}</strong>
                <span>attached non-mentor actors</span>
              </div>
              <div className="stat-rail-card">
                <strong>{graphView.counts?.completedOutcomes || 0}</strong>
                <span>successful outcomes tracked as evidence</span>
              </div>
            </div>
            <GraphEvidence evidence={graphView.graphEvidence} />
          </div>

          <div className="card glass-panel">
            <div className="card-header">
              <h3>Graph Gap Insights</h3>
            </div>
            <div className="stack-list">
              {(graphView.graphInsights || []).map((item) => (
                <div key={`${item.type}-${item.summary}`} className="stack-item recommendation-item">
                  <div className="stack-item-header">
                    <div className="stack-item-title">{item.type}</div>
                    <Badge variant={item.severity === 'high' ? 'red' : item.severity === 'medium' ? 'yellow' : 'green'}>
                      {item.severity}
                    </Badge>
                  </div>
                  <div className="stack-item-copy">{item.summary}</div>
                  <div className="stack-item-copy" style={{ color: 'var(--color-text-secondary)' }}>{item.suggestedAction}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : graphError ? (
        <div className="card glass-panel" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <h3>LatticeGraph</h3>
          </div>
          <div className="empty-state"><p>{graphError}</p></div>
        </div>
      ) : null}

      <div id="section-applications" className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Startup Application Register</h3>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state"><p>No applications for this programme yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Startup</th>
                <th>AI Fit</th>
                <th>Status</th>
                <th>Mentor Recommendations</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{startupNames[item.startupId] || item.startupId}</td>
                  <td><ScoreBadge score={item.aiFitScore} label="Programme fit" /></td>
                  <td><StatusPill status={item.status} /></td>
                  <td>
                    {item.status === 'Accepted' && canGenerateMentorRecommendations(item.startupId) ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => generateMentorRecommendations(item.startupId)}
                        disabled={busyStartupId === item.startupId}
                      >
                        {busyStartupId === item.startupId ? 'Generating...' : 'Generate Mentor Recommendations'}
                      </button>
                    ) : item.status === 'Accepted' ? (
                      <span className="review-note">Accepted startup</span>
                    ) : (
                      <span className="review-note">Accept startup first</span>
                    )}
                  </td>
                  <td>
                    {item.status === 'Pending Admin Review' && canReviewProgrammeApplication ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => reviewProgrammeApplication(item.id, 'Approved')}
                          disabled={busyApplicationId === item.id}
                        >
                          {busyApplicationId === item.id ? 'Reviewing...' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => reviewProgrammeApplication(item.id, 'Rejected')}
                          disabled={busyApplicationId === item.id}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="review-note">{item.status === 'Accepted' ? 'Reviewed' : 'Awaiting admin'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div id="section-connections" className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Contributor Connection Requests</h3>
        </div>
        {pendingConnectionRequests.length === 0 ? (
          <div className="empty-state"><p>No pending contributor connection requests.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contributor</th>
                <th>Type</th>
                <th>Status</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {pendingConnectionRequests.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{contributorNames[item.contributorId] || item.contributorId}</td>
                  <td>{item.contributorType}</td>
                  <td><StatusPill status={item.status} /></td>
                  <td>
                    {canReviewProgrammeConnectionRequest ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => reviewProgrammeConnectionRequest(item.id, 'Approved')}
                          disabled={busyConnectionId === item.id}
                        >
                          {busyConnectionId === item.id ? 'Reviewing...' : 'Approve'}
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => reviewProgrammeConnectionRequest(item.id, 'Rejected')}
                          disabled={busyConnectionId === item.id}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <span className="review-note">Awaiting admin review</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="two-col" style={{ marginBottom: 20 }}>
        <div className="card glass-panel">
          <div className="card-header">
            <h3>Approved Mentor Pool</h3>
          </div>
          {mentorPool.length === 0 ? (
            <div className="empty-state"><p>No mentors approved for this programme.</p></div>
          ) : (
            <div className="resource-grid">
              {mentorPool.map((item) => (
                <div key={item.id} className="resource-card">
                  <h4>{contributorNames[item.contributorId] || item.contributorId}</h4>
                  <p>{item.contributorType}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card glass-panel">
          <div className="card-header">
            <h3>Approved Resource Pool</h3>
          </div>
          {resourcePool.length === 0 ? (
            <div className="empty-state"><p>No approved resource contributors yet.</p></div>
          ) : (
            <div className="resource-grid">
              {resourcePool.map((item) => (
                <div key={item.id} className="resource-card">
                  <h4>{contributorNames[item.contributorId] || item.contributorId}</h4>
                  <p>{item.contributorType}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div id="section-relationships" className="card">
        <div className="card-header">
          <h3>Programme Recommendation and Relationship Register</h3>
        </div>
        {(recommendations.length === 0 && relationships.length === 0) ? (
          <div className="empty-state"><p>No recommendations or relationships yet.</p></div>
        ) : (
          <div className="recommendation-grid">
            {recommendations.map((item) => (
              <div key={item.id} className="recommendation-card">
                <div className="stack-item-header">
                  <div>
                    <h4>{item.recommendationType}</h4>
                    <div className="stack-item-meta">
                      Source: {startupNames[item.sourceEntityId] || contributorNames[item.sourceEntityId] || item.sourceEntityId}
                    </div>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <ScoreBreakdown breakdown={item.scoreBreakdown} />
                <p className="recommendation-copy">{item.explanation}</p>
                <GraphEvidence evidence={item.graphEvidence} />
              </div>
            ))}
            {relationships.map((item) => (
              <div key={item.id} className="recommendation-card">
                <div className="stack-item-header">
                  <div>
                    <h4>{item.relationshipType}</h4>
                    <div className="stack-item-meta">Active programme linkage</div>
                  </div>
                  <StatusPill status={item.status} />
                </div>
                <p className="recommendation-copy">{item.expectedOutcome}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
