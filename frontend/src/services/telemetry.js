export function trackRoleFeatureEvent(eventName, payload = {}) {
  try {
    const event = {
      eventName,
      timestamp: new Date().toISOString(),
      payload,
    };
    // Placeholder telemetry sink for v1 rollout.
    window.dispatchEvent(new CustomEvent('role-feature-telemetry', { detail: event }));
    // Keep visible in dev tools for now.
    // eslint-disable-next-line no-console
    console.info('[role-feature-telemetry]', event);
  } catch (_) {
    // no-op
  }
}

