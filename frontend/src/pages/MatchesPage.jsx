import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useSearchParams } from 'react-router-dom';
import { functions } from '../firebase';
import { Badge, GraphEvidence, ScoreBadge, ScoreBreakdown, StatusPill, Spinner } from '../components/Shared';
import { RoleAccessBanner } from '../components/FeatureVisibility';
import { trackRoleFeatureEvent } from '../services/telemetry';
import { canPerformAction } from '../config/accessPolicy';

export default function MatchesPage({ user }) {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [hiddenNonActionableCount, setHiddenNonActionableCount] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const getQueue = httpsCallable(functions, 'get_recommendation_queue');
        const result = await getQueue({
          status: searchParams.get('status') || '',
          type: searchParams.get('type') || '',
          programmeId: searchParams.get('programmeId') || '',
        });
        const items = result.data?.items || [];
        setRecommendations(items);
        const hiddenCount = items.filter((item) => !item.canReview && item.status === 'Pending Approval').length;
        setHiddenNonActionableCount(hiddenCount);
        trackRoleFeatureEvent('client_hidden_unreviewable', { count: hiddenCount });
      } catch (error) {
        trackRoleFeatureEvent('permission_denied_by_backend', { action: 'get_recommendation_queue', message: error?.message || 'unknown' });
        console.error('Failed to load recommendation queue:', error);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [searchParams]);

  async function handleDecision(recommendationId, decision) {
    try {
      const target = recommendations.find((item) => item.id === recommendationId);
      if (!target?.canReview) {
        trackRoleFeatureEvent('client_hidden_unreviewable', { recommendationId, decision, reason: target?.scopeReason || 'unknown' });
        return;
      }
      const review = httpsCallable(functions, 'review_recommendation');
      await review({ recommendationId, decision });
      trackRoleFeatureEvent('recommendation_review_success', { recommendationId, decision });
      setRecommendations((current) =>
        current.map((item) => (item.id === recommendationId ? { ...item, status: decision } : item))
      );
    } catch (error) {
      console.error('Failed to review recommendation:', error);
      trackRoleFeatureEvent('permission_denied_by_backend', { action: 'review_recommendation', recommendationId, decision, message: error?.message || 'unknown' });
      alert('Failed to review recommendation. Check the function logs.');
    }
  }

  if (loading) return <Spinner />;

  const filterStatus = searchParams.get('status') || '';
  const filterType = searchParams.get('type') || '';
  const filterProgrammeId = searchParams.get('programmeId') || '';
  const types = [...new Set(recommendations.map((item) => item.recommendationType).filter(Boolean))];
  const programmeOptions = [...new Set(recommendations.map((item) => item.programmeId).filter(Boolean))];
  const canReviewRecommendations = canPerformAction(user?.roleKey, 'review_recommendation');

  function updateSearch(next) {
    const params = new URLSearchParams(searchParams);
    Object.entries(next).forEach(([key, value]) => {
      if (!value) params.delete(key);
      else params.set(key, value);
    });
    setSearchParams(params);
  }

  const filtered = [...recommendations].sort((left, right) => (right.matchScore || 0) - (left.matchScore || 0));

  return (
    <div>
      <RoleAccessBanner roleKey={user?.roleKey || 'programme_admin'} scopeLabel="Programme-scoped approval action" />
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
        {hiddenNonActionableCount > 0 ? (
          <p className="cell-muted" style={{ marginTop: 6 }}>{hiddenNonActionableCount} pending items are read-only due to scope.</p>
        ) : null}
      </div>

      <div className="filter-bar">
        <select value={filterStatus} onChange={(e) => updateSearch({ status: e.target.value })}>
          <option value="">All Statuses</option>
          <option value="Pending Approval">Pending Approval</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select value={filterType} onChange={(e) => updateSearch({ type: e.target.value })}>
          <option value="">All Recommendation Types</option>
          {types.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={filterProgrammeId} onChange={(e) => updateSearch({ programmeId: e.target.value })}>
          <option value="">All Programmes</option>
          {programmeOptions.map((programmeId) => (
            <option key={programmeId} value={programmeId}>{recommendations.find((item) => item.programmeId === programmeId)?.programmeName || programmeId}</option>
          ))}
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
                  <div className="stack-item-meta">{item.programmeName || item.programmeId}</div>
                </div>
                <ScoreBadge score={item.matchScore} label="AI confidence" />
              </div>
              <div className="recommendation-meta">
                <StatusPill status={item.status} />
              </div>
              <div className="recommendation-meta-line">
                <span className="meta-term">Source</span>
                <span>{item.sourceLabel || item.sourceEntityId}</span>
              </div>
              <div className="recommendation-meta-line">
                <span className="meta-term">Target</span>
                <span>{item.targetLabel || item.targetEntityId}</span>
              </div>
              <ScoreBreakdown breakdown={item.scoreBreakdown} />
              <p className="recommendation-copy">{item.explanation}</p>
              {item.riskFlags?.length ? (
                <div className="recommendation-meta">
                  {item.riskFlags.map((flag) => <Badge key={flag} variant="red">{flag}</Badge>)}
                </div>
              ) : null}
              <GraphEvidence evidence={item.graphEvidence} />
              {item.status === 'Pending Approval' && canReviewRecommendations && item.canReview ? (
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
                  <span className="review-note">
                    {item.status === 'Pending Approval'
                      ? (item.scopeReason === 'out_of_scope' ? 'Out of scope' : 'Read-only')
                      : 'Recommendation already reviewed'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
