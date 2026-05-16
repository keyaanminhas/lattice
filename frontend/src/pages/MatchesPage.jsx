import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { Badge, ScoreBadge, StatusPill, Spinner } from '../components/Shared';

export default function MatchesPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [startups, setStartups] = useState({});
  const [contributors, setContributors] = useState({});
  const [programmes, setProgrammes] = useState({});
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    async function load() {
      const [startupSnap, contributorSnap, programmeSnap, recSnap] = await Promise.all([
        getDocs(collection(db, 'companies')),
        getDocs(collection(db, 'contributors')),
        getDocs(collection(db, 'programmes')),
        getDocs(collection(db, 'recommendations')),
      ]);

      const startupMap = {};
      startupSnap.forEach((item) => { startupMap[item.id] = item.data().name; });
      const contributorMap = {};
      contributorSnap.forEach((item) => { contributorMap[item.id] = item.data().name; });
      const programmeMap = {};
      programmeSnap.forEach((item) => { programmeMap[item.id] = item.data().name; });

      const recList = [];
      recSnap.forEach((item) => recList.push({ id: item.id, ...item.data() }));

      setStartups(startupMap);
      setContributors(contributorMap);
      setProgrammes(programmeMap);
      setRecommendations(recList);
      setLoading(false);
    }
    load();
  }, []);

  async function handleDecision(recommendationId, decision) {
    try {
      const review = httpsCallable(functions, 'review_recommendation');
      await review({ recommendationId, decision });
      setRecommendations((current) =>
        current.map((item) => (item.id === recommendationId ? { ...item, status: decision } : item))
      );
    } catch (error) {
      console.error('Failed to review recommendation:', error);
      alert('Failed to review recommendation. Check the function logs.');
    }
  }

  if (loading) return <Spinner />;

  const types = [...new Set(recommendations.map((item) => item.recommendationType))];
  let filtered = recommendations;
  if (filterStatus) filtered = filtered.filter((item) => item.status === filterStatus);
  if (filterType) filtered = filtered.filter((item) => item.recommendationType === filterType);
  filtered = [...filtered].sort((left, right) => (right.matchScore || 0) - (left.matchScore || 0));

  return (
    <div>
      <div className="hero-panel">
        <div className="hero-kicker">Recommendation Review Board</div>
        <div className="hero-title-row">
          <div>
            <h2>Recommendation decisions remain a controlled administrative action.</h2>
            <p>
              This board consolidates startup admissions, contributor pool proposals, and mentor activation
              so that no relationship enters live operation without documented review.
            </p>
          </div>
          <div className="hero-chip-grid">
            <div className="hero-chip">
              <strong>{recommendations.filter((item) => item.status === 'Pending Approval').length} pending approvals</strong>
              <span>These are the next decisions capable of changing programme state.</span>
            </div>
            <div className="hero-chip">
              <strong>{recommendations.filter((item) => item.status === 'Approved').length} approved records</strong>
              <span>Approved recommendations become applications, pool assignments, or active relationships.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="page-header">
        <h2>Recommendation Queue</h2>
        <p>{recommendations.length} recommendation records across admissions, programme pools, and mentor assignment workflows</p>
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="Pending Approval">Pending Approval</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
          <option value="">All Recommendation Types</option>
          {types.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card"><div className="empty-state"><p>No recommendations found.</p></div></div>
      ) : (
        <div className="recommendation-grid">
          {filtered.map((item) => (
            <div key={item.id} className="recommendation-card">
              <div className="stack-item-header">
                <div>
                  <h4>{item.recommendationType}</h4>
                  <div className="stack-item-meta">{programmes[item.programmeId] || item.programmeId}</div>
                </div>
                <ScoreBadge score={item.matchScore} label="AI confidence" />
              </div>
              <div className="recommendation-meta">
                <StatusPill status={item.status} />
              </div>
              <div className="recommendation-meta-line">
                <span className="meta-term">Source</span>
                <span>{startups[item.sourceEntityId] || contributors[item.sourceEntityId] || programmes[item.sourceEntityId] || item.sourceEntityId}</span>
              </div>
              <div className="recommendation-meta-line">
                <span className="meta-term">Target</span>
                <span>{startups[item.targetEntityId] || contributors[item.targetEntityId] || programmes[item.targetEntityId] || item.targetEntityId}</span>
              </div>
              <p className="recommendation-copy">{item.explanation}</p>
              {item.riskFlags?.length ? (
                <div className="recommendation-meta">
                  {item.riskFlags.map((flag) => <Badge key={flag} variant="red">{flag}</Badge>)}
                </div>
              ) : null}
              {item.status === 'Pending Approval' ? (
                <div className="recommendation-actions">
                  <button className="btn btn-sm btn-success" onClick={() => handleDecision(item.id, 'Approved')}>
                    Approve
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleDecision(item.id, 'Rejected')}>
                    Reject
                  </button>
                </div>
              ) : (
                <div className="recommendation-actions">
                  <span className="review-note">Recommendation already reviewed</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
