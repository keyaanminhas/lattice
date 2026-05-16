import { useEffect, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useNavigate } from 'react-router-dom';
import { functions } from '../firebase';
import { ScoreBadge, StatusPill, Spinner } from '../components/Shared';
import { RoleAccessBanner } from '../components/FeatureVisibility';
import { featureFlags } from '../config/featureFlags';
import { canAccessRoute, canPerformAction } from '../config/accessPolicy';
import { trackRoleFeatureEvent } from '../services/telemetry';

export default function DashboardPage({ user }) {
  const [stats, setStats] = useState(null);
  const [recentRecommendations, setRecentRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function load() {
      try {
        const getOverview = httpsCallable(functions, 'get_dashboard_overview');
        const result = await getOverview({});
        const payload = result.data || {};
        setStats(payload.stats || {});
        setRecentRecommendations(payload.recentQueue || []);
      } catch (error) {
        trackRoleFeatureEvent('permission_denied_by_backend', { action: 'get_dashboard_overview', message: error?.message || 'unknown' });
        console.error('Dashboard load failed:', error);
      }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <Spinner />;
  const roleKey = user?.roleKey || '';

  const statCards = [
    { label: 'Organisations', value: stats?.totalOrganisations, icon: 'apartment' },
    { label: 'Open Programmes', value: stats?.openProgrammes, icon: 'school', accent: true },
    { label: 'Startups', value: stats?.totalStartups, sub: `${stats?.verifiedStartups || 0} verified`, icon: 'business' },
    { label: 'Pool Assignments', value: stats?.programmePoolAssignments, icon: 'group_add' },
    { label: 'Pending Apps', value: stats?.pendingApplications, sub: `${stats?.acceptedApplications || 0} accepted`, icon: 'pending_actions' },
    { label: 'Pending Recs', value: stats?.pendingRecommendations, sub: `${stats?.activeRelationships || 0} active`, icon: 'recommend' },
    { label: 'Completed', value: stats?.completedRelationships, icon: 'check_circle' },
    { label: 'Success Rate', value: `${stats?.outcomeSuccessRate || 0}%`, icon: 'trending_up' },
  ];

  const taskCards = [
    {
      id: 'pending-registrations',
      visible: canPerformAction(roleKey, 'review_pending_registration') && canAccessRoute(roleKey, '/settings'),
      label: 'Pending Registrations',
      count: stats?.pendingRegistrations || 0,
      cta: 'Open Registration Queue',
      onClick: () => navigate('/settings?tab=registrations'),
    },
    {
      id: 'pending-applications',
      visible: canPerformAction(roleKey, 'review_programme_application') && canAccessRoute(roleKey, '/programmes'),
      label: 'Pending Startup Applications',
      count: stats?.pendingApplications || 0,
      cta: 'Review Applications',
      onClick: () => navigate('/programmes?queue=applications'),
    },
    {
      id: 'pending-connections',
      visible: canPerformAction(roleKey, 'review_programme_connection_request') && canAccessRoute(roleKey, '/programmes'),
      label: 'Pending Contributor Requests',
      count: stats?.pendingConnectionRequests || 0,
      cta: 'Review Connections',
      onClick: () => navigate('/programmes?queue=connections'),
    },
    {
      id: 'pending-recommendations',
      visible: canPerformAction(roleKey, 'review_recommendation') && canAccessRoute(roleKey, '/matches'),
      label: 'Pending Recommendations',
      count: stats?.pendingRecommendations || 0,
      cta: 'Open Recommendation Queue',
      onClick: () => navigate('/matches?status=Pending%20Approval'),
    },
    {
      id: 'awaiting-outcomes',
      visible: canPerformAction(roleKey, 'submit_outcome') && canAccessRoute(roleKey, '/outcomes'),
      label: 'Awaiting Outcomes',
      count: stats?.awaitingOutcomes || 0,
      cta: 'Record Outcomes',
      onClick: () => navigate('/outcomes?status=awaiting'),
    },
    {
      id: 'create-programme',
      visible: canPerformAction(roleKey, 'create_programme') && canAccessRoute(roleKey, '/programmes/create'),
      label: 'Programme Setup',
      count: null,
      cta: 'Create Programme',
      onClick: () => navigate('/programmes/create'),
    },
  ].filter((item) => item.visible);

  return (
    <div>
      {featureFlags.roleFeatureVisibilityV1 ? (
        <RoleAccessBanner roleKey={user?.roleKey || 'organisation_admin'} scopeLabel="Organisation / Programme scope" />
      ) : null}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title">Dashboard</h2>
          <p className="page-subtitle">Ecosystem operations overview and recommendation activity.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => navigate('/programmes')}>
            <span className="material-symbols-outlined">school</span> Programmes
          </button>
          {canAccessRoute(roleKey, '/matches') ? (
            <button className="btn btn-primary" onClick={() => navigate('/matches?status=Pending%20Approval')}>
              <span className="material-symbols-outlined">handshake</span> Recommendation Queue
            </button>
          ) : null}
          {canAccessRoute(roleKey, '/settings') ? (
            <button className="btn btn-primary" onClick={() => navigate('/settings?tab=registrations')}>
              <span className="material-symbols-outlined">pending_actions</span> Registration Queue
            </button>
          ) : null}
        </div>
      </div>

      {stats && (
        <div className="stat-grid">
          {statCards.map((c) => (
            <div key={c.label} className="stat-card">
              <div className="stat-card-header">
                <span className="stat-card-label">{c.label}</span>
                <span className="material-symbols-outlined stat-card-icon">{c.icon}</span>
              </div>
              <div className={`stat-card-value${c.accent ? ' accent' : ''}`}>{c.value ?? '—'}</div>
              {c.sub && <div className="stat-card-sub">{c.sub}</div>}
            </div>
          ))}
        </div>
      )}

      {taskCards.length > 0 ? (
        <div className="table-container" style={{ marginBottom: 20 }}>
          <div className="table-header">
            <h3>Action Queue</h3>
          </div>
          <div className="recommendation-grid">
            {taskCards.map((task) => (
              <div key={task.id} className="recommendation-card">
                <div className="stack-item-header">
                  <div>
                    <h4>{task.label}</h4>
                    <div className="stack-item-meta">
                      {typeof task.count === 'number' ? `${task.count} pending` : 'Action available'}
                    </div>
                  </div>
                </div>
                <div className="recommendation-actions">
                  <button className="btn btn-sm btn-primary" onClick={task.onClick}>{task.cta}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="table-container">
        <div className="table-header">
          <h3>Recent Recommendations</h3>
          {canAccessRoute(roleKey, '/matches') ? (
            <button className="btn btn-sm btn-outline" onClick={() => navigate('/matches?status=Pending%20Approval')}>View Queue <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span></button>
          ) : null}
        </div>
        {recentRecommendations.length === 0 ? (
          <div className="empty-state">No recommendations generated yet.</div>
        ) : (
          <table className="data-table">
            <thead><tr>
              <th>Type</th><th>Programme</th><th>Source</th><th>Target</th><th>Score</th><th>Status</th>
            </tr></thead>
            <tbody>
              {recentRecommendations.map((r) => (
                <tr key={r.id}>
                  <td className="cell-bold">{r.recommendationType}</td>
                  <td>{r.programmeName || r.programmeId}</td>
                  <td>{r.sourceLabel || r.sourceEntityId}</td>
                  <td>{r.targetLabel || r.targetEntityId}</td>
                  <td><ScoreBadge score={r.matchScore} label="AI confidence" /></td>
                  <td><StatusPill status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
