import { StatusPill } from '../components/Shared';

function entityLabel(user) {
  if (user.roleKey) return user.roleKey.replaceAll('_', ' ');
  if (user.accountType === 'startup') return 'startup';
  if (user.accountType === 'contributor') return 'contributor';
  if (user.accountType === 'organisation') return 'organisation';
  return 'account';
}

export default function PendingAccountPage({ user, onLogout }) {
  const label = entityLabel(user);

  return (
    <div className="pending-account-screen">
      <section className="pending-account-card">
        <div className="hero-kicker" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)', marginBottom: 16 }}>
          Lattice Access
        </div>
        <div className="pending-account-header">
          <div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
          </div>
          <StatusPill status={user.status || 'Pending'} />
        </div>
        <div className="pending-account-body">
          <h2>Your {label} registration is under review.</h2>
          <p>
            Public registrations are created as pending entities first. An active governance account
            needs to review the profile before operational dashboards, programme management, or
            recommendation actions become available.
          </p>
        </div>
        <dl className="pending-account-details">
          <div>
            <dt>Account type</dt>
            <dd>{user.accountType}</dd>
          </div>
          <div>
            <dt>Entity type</dt>
            <dd>{user.entityType}</dd>
          </div>
          <div>
            <dt>Entity ID</dt>
            <dd>{user.id}</dd>
          </div>
        </dl>
        <button className="btn btn-primary pending-account-action" onClick={onLogout} type="button">
          Sign out
        </button>
      </section>
    </div>
  );
}
