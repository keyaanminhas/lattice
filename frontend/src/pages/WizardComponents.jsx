import Select from 'react-select';
import CreatableSelect from 'react-select/creatable';

const selectStyles = {
  control: (base, state) => ({
    ...base,
    minHeight: 42,
    borderColor: state.isFocused ? 'var(--color-primary-light)' : 'var(--color-border)',
    boxShadow: state.isFocused ? '0 0 0 2px var(--color-primary-bg)' : 'none',
    '&:hover': { borderColor: 'var(--color-primary-light)' },
  }),
  placeholder: (base) => ({ ...base, color: 'var(--color-text-muted)' }),
  menu: (base) => ({ ...base, zIndex: 30 }),
};

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

function toOption(value) {
  return { value, label: value };
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  isClearable = false,
}) {
  const selectOptions = options.map(toOption);
  const selected = value ? toOption(value) : null;
  return (
    <Select
      options={selectOptions}
      value={selected}
      onChange={(next) => onChange(next?.value || '')}
      placeholder={placeholder}
      isClearable={isClearable}
      isSearchable
      styles={selectStyles}
    />
  );
}

export function SearchableMultiSelect({ options, value, onChange, placeholder }) {
  const selectOptions = options.map(toOption);
  const selected = (value || []).map(toOption);
  return (
    <Select
      options={selectOptions}
      value={selected}
      onChange={(next) => onChange((next || []).map((item) => item.value))}
      placeholder={placeholder}
      isMulti
      isSearchable
      closeMenuOnSelect={false}
      styles={selectStyles}
    />
  );
}

export function CustomMultiSelectField({
  options,
  selected = [],
  customValues = [],
  onSelectedChange,
  onCustomChange,
  placeholder,
}) {
  const selectOptions = options.map(toOption);
  const customOptions = customValues.map(toOption);
  const selectedOptions = selected.map(toOption);
  const value = [...selectedOptions, ...customOptions];

  function handleChange(nextItems) {
    const next = nextItems || [];
    const optionSet = new Set(options);
    const nextSelected = [];
    const nextCustom = [];
    next.forEach((item) => {
      if (optionSet.has(item.value)) nextSelected.push(item.value);
      else nextCustom.push(item.value);
    });
    onSelectedChange(Array.from(new Set(nextSelected)));
    onCustomChange(Array.from(new Set(nextCustom)));
  }

  return (
    <CreatableSelect
      options={selectOptions}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      isMulti
      isSearchable
      closeMenuOnSelect={false}
      formatCreateLabel={(inputValue) => `Add custom: ${inputValue}`}
      styles={selectStyles}
    />
  );
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
