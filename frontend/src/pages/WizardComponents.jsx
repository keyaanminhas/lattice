export function WizardProgress({ steps, current }) {
  return (
    <div className="wizard-progress">
      {steps.map((label, i) => (
        <div key={label} className="wiz-step-wrap">
          {i > 0 && <div className={`wiz-line${i <= current ? ' done' : ''}`} />}
          <div className={`wiz-step${i === current ? ' active' : ''}${i < current ? ' done' : ''}`}>
            {i < current ? '✓' : i + 1}
          </div>
          <span className="wiz-label">{label}</span>
        </div>
      ))}
    </div>
  );
}

export function MultiSelect({ options, value, onChange, columns = 2 }) {
  function toggle(option) {
    const next = value.includes(option)
      ? value.filter((v) => v !== option)
      : [...value, option];
    onChange(next);
  }
  return (
    <div className="multi-select-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {options.map((option) => (
        <label className="checkbox-option" key={option}>
          <input type="checkbox" checked={value.includes(option)} onChange={() => toggle(option)} />
          {option}
        </label>
      ))}
    </div>
  );
}

export function FieldHelper({ text }) {
  return <span className="wizard-helper">{text}</span>;
}

export function WizardNav({ step, maxStep, onBack, onContinue, busy, submitLabel }) {
  const isLast = step === maxStep;
  return (
    <div className="wizard-nav">
      {step > 0 ? (
        <button className="btn btn-outline" onClick={onBack} type="button" disabled={busy}>← Back</button>
      ) : <span />}
      {isLast ? (
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating account...' : submitLabel}
        </button>
      ) : (
        <button className="btn btn-primary" onClick={onContinue} type="button">Continue →</button>
      )}
    </div>
  );
}

export function ReviewField({ label, value }) {
  const display = Array.isArray(value) ? value.join(', ') : value;
  if (!display) return null;
  return (
    <div className="review-field">
      <dt>{label}</dt>
      <dd>{display}</dd>
    </div>
  );
}

export function ReviewSection({ title, children }) {
  return (
    <div className="review-section">
      <h4>{title}</h4>
      <dl>{children}</dl>
    </div>
  );
}
