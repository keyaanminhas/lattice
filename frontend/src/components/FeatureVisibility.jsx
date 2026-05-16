import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, CapabilityBadge } from './Shared';
import { getCapabilitiesForRole, roleLabels } from '../config/roleCapabilityMatrix';
import { trackRoleFeatureEvent } from '../services/telemetry';

export function RoleAccessBanner({ roleKey, scopeLabel }) {
  const roleName = roleLabels[roleKey] || roleKey || 'User';
  return (
    <div className="role-access-banner">
      <div className="role-access-title">Role Access</div>
      <div className="role-access-body">
        <Badge variant="blue">{roleName}</Badge>
        <Badge variant="gray">{scopeLabel || 'Scoped access applies'}</Badge>
      </div>
    </div>
  );
}

export function FeatureVisibilityPanel({ roleKey, surfacePath }) {
  const navigate = useNavigate();
  const roleCapabilities = useMemo(() => getCapabilitiesForRole(roleKey), [roleKey]);
  const highlighted = useMemo(
    () => roleCapabilities.filter((capability) => capability.surface === surfacePath).slice(0, 6),
    [roleCapabilities, surfacePath],
  );

  return (
    <div className="feature-visibility-panel card">
      <div className="feature-visibility-head">
        <div>
          <h3>What You Can Do</h3>
          <p>{roleCapabilities.length} capabilities mapped for this role.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => {
            trackRoleFeatureEvent('feature_guide_opened', { roleKey, surfacePath });
            navigate('/feature-guide');
          }}
        >
          <span className="material-symbols-outlined">menu_book</span>
          Feature Guide
        </button>
      </div>
      <div className="feature-capability-grid">
        {highlighted.map((capability) => (
          <div key={capability.capabilityId} className="feature-capability-card">
            <div className="feature-capability-title">{capability.label}</div>
            <div className="feature-capability-meta">
              <CapabilityBadge actionType={capability.actionType} scope={capability.scope} />
            </div>
          </div>
        ))}
      </div>
      {highlighted.length === 0 ? (
        <div className="feature-locked-note">
          No direct capabilities are mapped to this surface. Check the Feature Guide for full access map.
        </div>
      ) : null}
    </div>
  );
}

