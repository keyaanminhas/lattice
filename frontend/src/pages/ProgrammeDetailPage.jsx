import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { db, functions } from '../firebase';
import { Badge, ScoreBadge, StatusPill, Spinner } from '../components/Shared';

export default function ProgrammeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [programme, setProgramme] = useState(null);
  const [applications, setApplications] = useState([]);
  const [poolAssignments, setPoolAssignments] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [startupNames, setStartupNames] = useState({});
  const [contributorNames, setContributorNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyStartupId, setBusyStartupId] = useState('');

  useEffect(() => {
    async function load() {
      const [programmeDoc, startupSnap, contributorSnap, appSnap, poolSnap, recSnap, relSnap] = await Promise.all([
        getDoc(doc(db, 'programmes', id)),
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'contributors')),
        getDocs(query(collection(db, 'applications'), where('programmeId', '==', id))),
        getDocs(query(collection(db, 'programmeContributors'), where('programmeId', '==', id))),
        getDocs(query(collection(db, 'recommendations'), where('programmeId', '==', id))),
        getDocs(query(collection(db, 'relationships'), where('programmeId', '==', id))),
      ]);

      if (programmeDoc.exists()) setProgramme({ id: programmeDoc.id, ...programmeDoc.data() });

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
      setLoading(false);
    }

    load();
  }, [id]);

  async function generateMentorRecommendations(startupId) {
    setBusyStartupId(startupId);
    try {
      const recommend = httpsCallable(functions, 'recommend_mentor_for_startup');
      await recommend({ startupId, programmeId: id });
      const recSnap = await getDocs(query(collection(db, 'recommendations'), where('programmeId', '==', id)));
      const recList = [];
      recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
      setRecommendations(recList);
    } catch (error) {
      console.error('Failed to generate mentor recommendations:', error);
      alert('Failed to generate mentor recommendations. Check the function logs.');
    }
    setBusyStartupId('');
  }

  if (loading) return <Spinner />;
  if (!programme) return <div className="empty-state"><p>Programme not found.</p></div>;

  const mentorPool = poolAssignments.filter((item) => item.contributorType === 'Mentor');
  const resourcePool = poolAssignments.filter((item) => item.contributorType !== 'Mentor');

  return (
    <div>
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
              <strong>{poolAssignments.filter((item) => item.status === 'Approved').length} approved pool actors</strong>
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

      <div className="card" style={{ marginBottom: 20 }}>
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
              </tr>
            </thead>
            <tbody>
              {applications.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{startupNames[item.startupId] || item.startupId}</td>
                  <td><ScoreBadge score={item.aiFitScore} label="Programme fit" /></td>
                  <td><StatusPill status={item.status} /></td>
                  <td>
                    {item.status === 'Accepted' ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => generateMentorRecommendations(item.startupId)}
                        disabled={busyStartupId === item.startupId}
                      >
                        {busyStartupId === item.startupId ? 'Generating...' : 'Generate Mentor Recommendations'}
                      </button>
                    ) : (
                      <span className="review-note">Accept startup first</span>
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

      <div className="card">
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
                <p className="recommendation-copy">{item.explanation}</p>
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
