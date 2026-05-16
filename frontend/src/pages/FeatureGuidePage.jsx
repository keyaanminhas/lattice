import { useMemo } from 'react';
import { Badge, CapabilityBadge } from '../components/Shared';
import { roleCapabilityMatrix, roleLabels } from '../config/roleCapabilityMatrix';
import { trackRoleFeatureEvent } from '../services/telemetry';

function groupByRole() {
  const grouped = {};
  Object.keys(roleLabels).forEach((role) => {
    grouped[role] = roleCapabilityMatrix.filter((capability) => capability.roleKeys.includes(role));
  });
  return grouped;
}

export default function FeatureGuidePage({ user }) {
  const grouped = useMemo(() => groupByRole(), []);

  return (
    <div>
      <div className="page-header">
        <h2>Feature Guide</h2>
        <p>
          Role capability matrix generated from a single source of truth. Current role:
          {' '}
          <strong>{roleLabels[user?.roleKey] || user?.roleKey || 'Unknown'}</strong>
        </p>
      </div>

      <div style={{ marginBottom: 20 }}>
        <button
          className="btn btn-outline"
          onClick={() => {
            trackRoleFeatureEvent('feature_docs_export_clicked', { roleKey: user?.roleKey || '' });
            window.open('/role-feature-matrix.md', '_blank', 'noopener,noreferrer');
          }}
        >
          <span className="material-symbols-outlined">download</span>
          Open Generated Docs
        </button>
      </div>

      {Object.entries(grouped).map(([roleKey, capabilities]) => (
        <div key={roleKey} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <h3>{roleLabels[roleKey]}</h3>
            <Badge variant={roleKey === user?.roleKey ? 'blue' : 'gray'}>
              {roleKey === user?.roleKey ? 'Current Role' : 'Reference'}
            </Badge>
          </div>
          <div className="stack-list">
            {capabilities.map((capability) => (
              <div key={capability.capabilityId} className="stack-item">
                <div className="stack-item-header">
                  <div className="stack-item-title">{capability.label}</div>
                  <CapabilityBadge actionType={capability.actionType} scope={capability.scope} />
                </div>
                <div className="stack-item-copy">
                  <strong>ID:</strong>
                  {' '}
                  {capability.capabilityId}
                  {' · '}
                  <strong>Surface:</strong>
                  {' '}
                  {capability.surface}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

