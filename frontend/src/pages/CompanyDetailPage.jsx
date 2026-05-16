import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Badge, ScoreBadge, StatusPill, Spinner } from '../components/Shared';

export default function CompanyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [matches, setMatches] = useState([]);
  const [aiProfile, setAiProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [contributors, setContributors] = useState({});

  useEffect(() => {
    async function load() {
      // Load company
      const compDoc = await getDoc(doc(db, 'companies', id));
      if (compDoc.exists()) {
        setCompany({ id: compDoc.id, ...compDoc.data() });
      }

      // Load contributor names for display
      const contSnap = await getDocs(collection(db, 'contributors'));
      const contMap = {};
      contSnap.forEach((d) => { contMap[d.id] = d.data().name; });
      setContributors(contMap);

      // Load matches for this company
      const q = query(collection(db, 'relationships'), where('sourceId', '==', id));
      const matchSnap = await getDocs(q);
      const list = [];
      matchSnap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.aiMatchScore || 0) - (a.aiMatchScore || 0));
      setMatches(list);

      setLoading(false);
    }
    load();
  }, [id]);

  async function loadAIProfile() {
    setProfileLoading(true);
    try {
      const summarise = httpsCallable(functions, 'summarise_company_profile');
      const result = await summarise({ companyId: id });
      setAiProfile(result.data.profile);
    } catch (e) {
      console.error('AI profile failed:', e);
    }
    setProfileLoading(false);
  }

  if (loading) return <Spinner />;
  if (!company) return <div className="empty-state"><p>Company not found.</p></div>;

  return (
    <div>
      <div className="detail-header">
        <div>
          <button className="btn btn-sm btn-outline" onClick={() => navigate('/companies')} style={{ marginBottom: 12 }}>
            ← Back to Companies
          </button>
          <h2>{company.name}</h2>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <Badge variant="blue">{company.industry}</Badge>
            <Badge variant="gray">{company.stage}</Badge>
            <StatusPill status={company.verificationStatus} />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div className="detail-sections">
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Company Profile</h3>
          <div className="detail-field">
            <label>Problem Statement</label>
            <p>{company.problemStatement}</p>
          </div>
          <div className="detail-field">
            <label>Product</label>
            <p>{company.productDescription}</p>
          </div>
          <div className="detail-field">
            <label>Country</label>
            <p>{company.country}</p>
          </div>
          <div className="detail-field">
            <label>Team Size</label>
            <p>{company.teamSize} people</p>
          </div>
          <div className="detail-field">
            <label>Support Needs</label>
            <div className="entity-tags" style={{ marginTop: 4 }}>
              {company.supportNeeds?.map((n) => <Badge key={n} variant="blue">{n}</Badge>)}
            </div>
          </div>
          <div className="detail-field">
            <label>Current Challenges</label>
            <div className="entity-tags" style={{ marginTop: 4 }}>
              {company.currentChallenges?.map((c) => <Badge key={c} variant="yellow">{c}</Badge>)}
            </div>
          </div>
        </div>

        {/* AI Profile */}
        <div className="card">
          <div className="card-header">
            <h3>AI Profile Summary</h3>
            {!aiProfile && (
              <button className="btn btn-sm btn-primary" onClick={loadAIProfile} disabled={profileLoading}>
                {profileLoading ? 'Analyzing...' : 'Generate AI Profile'}
              </button>
            )}
          </div>
          {profileLoading && <Spinner />}
          {aiProfile ? (
            <div className="ai-profile">
              <div className="detail-field">
                <label>Executive Summary</label>
                <p>{aiProfile.summary}</p>
              </div>
              <div className="detail-field">
                <label>Readiness Score</label>
                <div className="readiness-score">{aiProfile.readinessScore}</div>
                <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 8 }}>/ 10</span>
              </div>
              <div className="detail-field">
                <label>Auto Tags</label>
                <div className="entity-tags" style={{ marginTop: 4 }}>
                  {aiProfile.autoTags?.map((t) => <Badge key={t} variant="blue">{t}</Badge>)}
                </div>
              </div>
              <div className="detail-field">
                <label>Suggested Programmes</label>
                <div className="entity-tags" style={{ marginTop: 4 }}>
                  {aiProfile.suggestedProgrammes?.map((p) => <Badge key={p} variant="green">{p}</Badge>)}
                </div>
              </div>
              <div className="detail-field">
                <label>Risk Flags</label>
                <div className="entity-tags" style={{ marginTop: 4 }}>
                  {aiProfile.riskFlags?.map((r) => <Badge key={r} variant="red">{r}</Badge>)}
                </div>
              </div>
            </div>
          ) : (
            !profileLoading && (
              <div className="empty-state">
                <p>Click "Generate AI Profile" to get an AI-powered analysis.</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Matches */}
      <div className="card">
        <div className="card-header">
          <h3>AI-Recommended Matches ({matches.length})</h3>
        </div>
        {matches.length === 0 ? (
          <div className="empty-state"><p>No matches found for this company.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Contributor</th>
                <th>Type</th>
                <th>Score</th>
                <th>AI Explanation</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 600 }}>{contributors[m.targetId] || m.targetId}</td>
                  <td>{m.type}</td>
                  <td><ScoreBadge score={m.aiMatchScore} /></td>
                  <td className="match-explanation">{m.aiExplanation?.substring(0, 200)}...</td>
                  <td><StatusPill status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
