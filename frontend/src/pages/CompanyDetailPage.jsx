import { useEffect, useState } from 'react';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useNavigate, useParams } from 'react-router-dom';
import { db, functions } from '../firebase';
import { Badge, GraphEvidence, ScoreBadge, ScoreBreakdown, StarRating, StatusPill, Spinner } from '../components/Shared';

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [startup, setStartup] = useState(null);
  const [applications, setApplications] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [aiProfile, setAiProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [generatingProgrammes, setGeneratingProgrammes] = useState(false);
  const [generatingMentorFor, setGeneratingMentorFor] = useState('');
  const [programmeNames, setProgrammeNames] = useState({});
  const [contributorNames, setContributorNames] = useState({});

  useEffect(() => {
    async function load() {
      const [startupDoc, programmeSnap, contributorSnap, appSnap, recSnap, relSnap] = await Promise.all([
        getDoc(doc(db, 'companies', id)),
        getDocs(collection(db, 'programmes')),
        getDocs(collection(db, 'contributors')),
        getDocs(query(collection(db, 'applications'), where('startupId', '==', id))),
        getDocs(query(collection(db, 'recommendations'), where('sourceEntityId', '==', id))),
        getDocs(query(collection(db, 'relationships'), where('sourceEntityId', '==', id))),
      ]);

      if (startupDoc.exists()) setStartup({ id: startupDoc.id, ...startupDoc.data() });

      const programmeMap = {};
      programmeSnap.forEach((item) => { programmeMap[item.id] = item.data().name; });
      const contributorMap = {};
      contributorSnap.forEach((item) => { contributorMap[item.id] = item.data().name; });
      setProgrammeNames(programmeMap);
      setContributorNames(contributorMap);

      const appList = [];
      appSnap.forEach((item) => appList.push({ id: item.id, ...item.data() }));
      const recList = [];
      recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
      const relList = [];
      relSnap.forEach((item) => relList.push({ id: item.id, ...item.data() }));

      setApplications(appList);
      setRecommendations(recList);
      setRelationships(relList);
      setLoading(false);
    }

    load();
  }, [id]);

  async function refreshRecommendations() {
    const recSnap = await getDocs(query(collection(db, 'recommendations'), where('sourceEntityId', '==', id)));
    const recList = [];
    recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));
    setRecommendations(recList);
  }

  async function generateProgrammeRecommendations() {
    setGeneratingProgrammes(true);
    try {
      const recommend = httpsCallable(functions, 'recommend_programmes_for_startup');
      await recommend({ startupId: id });
      await refreshRecommendations();
    } catch (error) {
      console.error('Programme recommendation failed:', error);
      alert('Failed to generate programme recommendations.');
    }
    setGeneratingProgrammes(false);
  }

  async function generateMentorRecommendations(programmeId) {
    setGeneratingMentorFor(programmeId);
    try {
      const recommend = httpsCallable(functions, 'recommend_mentor_for_startup');
      await recommend({ startupId: id, programmeId });
      await refreshRecommendations();
    } catch (error) {
      console.error('Mentor recommendation failed:', error);
      alert('Failed to generate mentor recommendations.');
    }
    setGeneratingMentorFor('');
  }

  async function loadAIProfile() {
    setProfileLoading(true);
    try {
      const summarise = httpsCallable(functions, 'summarise_startup_profile');
      const result = await summarise({ startupId: id });
      setAiProfile(result.data.profile);
    } catch (error) {
      console.error('AI profile failed:', error);
    }
    setProfileLoading(false);
  }

  if (loading) return <Spinner />;
  if (!startup) return <div className="empty-state"><p>Startup not found.</p></div>;

  const mentorRecommendations = recommendations.filter((item) => item.recommendationType === 'Startup-to-Mentor');
  const mentorRelationships = relationships.filter((item) => item.relationshipType === 'Startup-to-Mentor');
  const programmeRecommendations = recommendations.filter((item) => item.recommendationType === 'Startup-to-Programme');

  return (
    <div>
      <div className="hero-panel">
        <div className="hero-kicker">Startup Record</div>
        <div className="hero-title-row">
          <div>
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/companies')} style={{ marginBottom: 12 }}>
              Back to Startups
            </button>
            <h2>{startup.name}</h2>
            <p>
              Review the operating profile, AI-generated assessment, programme pathway, and mentor activation status for this startup.
            </p>
            <div className="entity-tags entity-tag-row">
              <Badge variant="blue">{startup.industry || startup.sector}</Badge>
              <Badge variant="gray">{startup.stage}</Badge>
              <StatusPill status={startup.verificationStatus} />
            </div>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{applications.length} programme applications</strong>
              <span>Applications show current progress toward governed programme admission.</span>
            </div>
            <div className="hero-chip">
              <strong>{mentorRecommendations.length} mentor recommendations</strong>
              <span>Mentor pathways activate only after programme acceptance.</span>
            </div>
            <div className="hero-chip">
              <strong>{mentorRelationships.length} active mentor links</strong>
              <span>Relationships listed here are already formalised inside programme context.</span>
            </div>
          </div>
        </div>
        <div className="hero-actions">
          <button className="btn btn-outline" onClick={loadAIProfile} disabled={profileLoading}>
            {profileLoading ? 'Analyzing...' : 'Generate Profile Summary'}
          </button>
          <button className="btn btn-primary" onClick={generateProgrammeRecommendations} disabled={generatingProgrammes}>
            {generatingProgrammes ? 'Generating...' : 'Generate Programme Recommendations'}
          </button>
        </div>
      </div>

      <div className="detail-sections">
        <div className="card glass-panel">
          <h3 style={{ marginBottom: 16 }}>Operating Profile</h3>
          <div className="entity-facts detail-metrics">
            <div className="entity-fact"><span>Country</span><strong>{startup.country || 'Not specified'}</strong></div>
            <div className="entity-fact"><span>Team Size</span><strong>{startup.teamSize || 0}</strong></div>
            <div className="entity-fact"><span>Support Needs</span><strong>{startup.supportNeeds?.length || 0}</strong></div>
          </div>
          <div className="detail-field">
            <label>Problem Statement</label>
            <p>{startup.problemStatement}</p>
          </div>
          <div className="detail-field">
            <label>Product</label>
            <p>{startup.productDescription}</p>
          </div>
          <div className="detail-field">
            <label>Traction</label>
            <p>{startup.traction || 'No traction summary yet.'}</p>
          </div>
          <div className="detail-field">
            <label>Support Needs</label>
            <div className="entity-tags">{startup.supportNeeds?.map((item) => <Badge key={item} variant="blue">{item}</Badge>)}</div>
          </div>
          <div className="detail-field">
            <label>Current Challenges</label>
            <div className="entity-tags">{startup.currentChallenges?.map((item) => <Badge key={item} variant="yellow">{item}</Badge>)}</div>
          </div>
          <div className="detail-field">
            <label>Skills</label>
            <div className="entity-tags">{startup.skills?.map((item) => <Badge key={item} variant="purple">{item}</Badge>)}</div>
          </div>
        </div>

        <div className="card glass-panel">
          <div className="card-header">
            <h3>AI Readiness Summary</h3>
          </div>
          {profileLoading && <Spinner />}
          {aiProfile ? (
            <div className="ai-profile">
              <div className="ai-score-grid">
                <div className="ai-score-card">
                  <span>Profile Completeness</span>
                  <strong>{Math.round(aiProfile.profileCompletenessScore)}%</strong>
                  <StarRating value={aiProfile.profileCompletenessScore / 20} caption="Documentation quality" />
                </div>
                <div className="ai-score-card">
                  <span>Readiness Rating</span>
                  <strong>{aiProfile.readinessScore} / 10</strong>
                  <StarRating value={aiProfile.readinessScore / 2} caption="Operational readiness" />
                </div>
              </div>
              <div className="detail-field">
                <label>Summary</label>
                <p>{aiProfile.summary}</p>
              </div>
              <div className="detail-field">
                <label>Profile Completeness</label>
                <p className="metric-footnote">
                  Higher completeness indicates that the startup record includes enough commercial, product,
                  and traction detail for programme matching to be more reliable.
                </p>
              </div>
              <div className="detail-field">
                <label>Readiness Score</label>
                <p className="metric-footnote">
                  Readiness reflects the AI view of how prepared this company is for formal programme admission and
                  mentor activation.
                </p>
              </div>
              <div className="detail-field">
                <label>Auto Tags</label>
                <div className="entity-tags">{aiProfile.autoTags?.map((item) => <Badge key={item} variant="blue">{item}</Badge>)}</div>
              </div>
              <div className="detail-field">
                <label>Suggested Programme Types</label>
                <div className="entity-tags">{aiProfile.suggestedProgrammeTypes?.map((item) => <Badge key={item} variant="green">{item}</Badge>)}</div>
              </div>
              <div className="detail-field">
                <label>Risk Flags</label>
                <div className="entity-tags">{aiProfile.riskFlags?.map((item) => <Badge key={item} variant="red">{item}</Badge>)}</div>
              </div>
            </div>
          ) : (
            !profileLoading && <div className="empty-state"><p>Generate an AI summary to inspect readiness and programme fit.</p></div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <h3>Programme Application Register</h3>
        </div>
        {applications.length === 0 ? (
          <div className="empty-state"><p>No programme applications yet.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Programme</th>
                <th>AI Fit</th>
                <th>Status</th>
                <th>Mentor Matching</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((item) => (
                <tr key={item.id}>
                  <td style={{ fontWeight: 600 }}>{programmeNames[item.programmeId] || item.programmeId}</td>
                  <td><ScoreBadge score={item.aiFitScore} /></td>
                  <td><StatusPill status={item.status} /></td>
                  <td>
                    {item.status === 'Accepted' ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => generateMentorRecommendations(item.programmeId)}
                        disabled={generatingMentorFor === item.programmeId}
                      >
                        {generatingMentorFor === item.programmeId ? 'Generating...' : 'Generate Mentor Recommendations'}
                      </button>
                    ) : (
                      <span className="review-note">Admission required first</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="two-col">
        <div className="card">
          <div className="card-header">
            <h3>Programme Recommendation Briefing</h3>
          </div>
          {programmeRecommendations.length === 0 ? (
            <div className="empty-state"><p>No programme recommendations yet.</p></div>
          ) : (
            <div className="stack-list">
              {programmeRecommendations.map((item) => (
                <div key={item.id} className="stack-item recommendation-item">
                  <div className="stack-item-header">
                    <div className="stack-item-title">{programmeNames[item.programmeId] || item.programmeId}</div>
                    <ScoreBadge score={item.matchScore} label="Programme fit" />
                  </div>
                  <div className="stack-item-copy">{item.explanation}</div>
                  <ScoreBreakdown breakdown={item.scoreBreakdown} />
                  <GraphEvidence evidence={item.graphEvidence} />
                  <div className="recommendation-meta">
                    <StatusPill status={item.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Mentor Recommendations and Active Links</h3>
          </div>
          {mentorRecommendations.length === 0 && mentorRelationships.length === 0 ? (
            <div className="empty-state"><p>No mentor recommendations or links yet.</p></div>
          ) : (
            <div className="stack-list">
              {mentorRecommendations.map((item) => (
                <div key={item.id} className="stack-item recommendation-item">
                  <div className="stack-item-header">
                    <div className="stack-item-title">{contributorNames[item.targetEntityId] || item.targetEntityId}</div>
                    <ScoreBadge score={item.matchScore} label="Mentor fit" />
                  </div>
                  <div className="stack-item-copy">{item.explanation}</div>
                  <ScoreBreakdown breakdown={item.scoreBreakdown} />
                  <GraphEvidence evidence={item.graphEvidence} />
                  <div className="recommendation-meta">
                    <StatusPill status={item.status} />
                  </div>
                </div>
              ))}
              {mentorRelationships.map((item) => (
                <div key={item.id} className="stack-item recommendation-item">
                  <div className="stack-item-header">
                    <div className="stack-item-title">{contributorNames[item.targetEntityId] || item.targetEntityId}</div>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="stack-item-copy">{item.expectedOutcome}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
