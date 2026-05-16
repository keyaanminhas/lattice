import { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  deleteUser,
  fetchSignInMethodsForEmail,
  GoogleAuthProvider,
  linkWithCredential,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { auth, functions, googleProvider, usingEmulators } from '../firebase';
import {
  SECTOR_OPTIONS,
  STAGE_OPTIONS,
  TEAM_SIZE_OPTIONS,
  TEAM_SIZE_RANGE_META,
  SUPPORT_NEED_OPTIONS,
  CHALLENGE_OPTIONS,
  TRACTION_OPTIONS,
  CONTRIBUTOR_TYPE_OPTIONS,
  SECTOR_EXPERTISE_OPTIONS,
  SUPPORT_AREA_OPTIONS,
  SUPPORTED_STAGE_OPTIONS,
  COUNTRY_OPTIONS,
  COUNTRY_COVERAGE_OPTIONS,
  ORG_TYPE_OPTIONS,
  FOCUS_SECTOR_OPTIONS,
  CONTRIBUTOR_TYPE_MAP,
  STEP_LABELS,
  initialRegistration,
  demoAccounts,
} from './registrationOptions';
import {
  WizardProgress,
  FieldHelper,
  WizardNav,
  ReviewField,
  ReviewSection,
  SearchableSelect,
  SearchableMultiSelect,
  CustomMultiSelectField,
} from './WizardComponents';

function formatAuthError(error) {
  if (error?.code === 'auth/invalid-credential') return 'Email or password is incorrect.';
  if (error?.code === 'auth/email-already-in-use') return 'An account already exists for this email.';
  if (error?.code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (error?.code === 'auth/network-request-failed') return usingEmulators
    ? 'Could not reach Firebase Auth. Check that the emulator is running locally.'
    : 'Could not reach live Firebase Auth. Check your network connection and project settings.';
  if (error?.code === 'auth/configuration-not-found') return 'Firebase Auth is not configured for this project. Use the local Auth emulator or enable an Auth provider in Firebase.';
  if (error?.code === 'functions/unavailable') return usingEmulators
    ? 'Could not reach Firebase Functions. Start the Firebase emulators before creating an account.'
    : 'Could not reach live Firebase Functions. Check the deployed backend and network connection.';
  if (error?.code === 'functions/failed-precondition') return error.message || 'This login already has a Lattice account.';
  if (error?.code === 'functions/invalid-argument') return error.message || 'Some registration details are missing or invalid.';
  if (error?.code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled before completion.';
  if (error?.code === 'auth/popup-blocked') return 'Google sign-in popup was blocked by the browser.';
  if (error?.code === 'auth/cancelled-popup-request') return 'Google sign-in was interrupted by another popup request.';
  if (error?.code === 'auth/account-exists-with-different-credential') return 'This email already exists with another sign-in method. Sign in with your password once to link Google.';
  if (error?.code === 'auth/credential-already-in-use') return 'That Google account is already linked to another login.';
  return error?.message || 'Authentication failed.';
}

function uniqueValues(values) {
  return Array.from(new Set((values || []).map((item) => `${item}`.trim()).filter(Boolean)));
}

function mergeValues(baseValues, customValues) {
  return uniqueValues([...(baseValues || []), ...(customValues || [])]);
}

function parseTeamSizeRange(rangeValue) {
  const meta = TEAM_SIZE_RANGE_META[rangeValue] || TEAM_SIZE_RANGE_META['Prefer not to say'];
  return {
    teamSizeRange: rangeValue || 'Prefer not to say',
    teamSizeMin: meta.min,
    teamSizeMax: meta.max,
    teamSizeKnown: Boolean(meta.known),
    teamSize: meta.compatibility,
  };
}

function resolveStartupSector(registration) {
  if (registration.sector === 'Other') {
    return registration.customSector.trim();
  }
  return registration.sector.trim();
}

function buildRegistrationProfile(r) {
  if (r.accountType === 'startup') {
    const traction = r.tractionDetail ? `${r.tractionLevel} - ${r.tractionDetail}` : r.tractionLevel;
    const resolvedSector = resolveStartupSector(r);
    const teamSize = parseTeamSizeRange(r.teamSizeRange);
    const supportNeeds = mergeValues(r.supportNeeds, r.customSupportNeeds);
    const currentChallenges = mergeValues(r.currentChallenges, r.customChallenges);
    return {
      name: r.startupName.trim(),
      sector: resolvedSector,
      industry: resolvedSector,
      customSector: r.sector === 'Other' ? r.customSector.trim() : '',
      stage: r.stage,
      country: r.country,
      ...teamSize,
      supportNeeds,
      customSupportNeeds: uniqueValues(r.customSupportNeeds),
      currentChallenges,
      customChallenges: uniqueValues(r.customChallenges),
      problemStatement: r.problemStatement.trim(),
      productDescription: r.productDescription.trim(),
      traction,
    };
  }

  if (r.accountType === 'contributor') {
    const primaryContributorType = r.contributorType;
    const mapped = CONTRIBUTOR_TYPE_MAP[primaryContributorType] || '';
    const expertise = mergeValues(r.sectorExpertise, r.customExpertise);
    const supportAreas = mergeValues(r.supportAreas, r.customSupportAreas);
    return {
      name: r.contributorName.trim(),
      primaryContributorType,
      contributorTypes: mapped ? [mapped] : [],
      expertise,
      customExpertise: uniqueValues(r.customExpertise),
      supportedStages: uniqueValues(r.supportedStages),
      investmentThesis: r.investmentThesis ? r.investmentThesis.split(',').map((s) => s.trim()).filter(Boolean) : [],
      ticketSize: r.ticketSize.trim(),
      countryCoverage: uniqueValues(r.countryCoverage),
      canSupport: supportAreas,
      supportAreas,
      customSupportAreas: uniqueValues(r.customSupportAreas),
    };
  }

  const orgType = r.organisationType === 'Other' ? r.customOrganisationType.trim() : r.organisationType;
  const focusSectors = mergeValues(r.focusSectors, r.customFocusSectors);
  const mainSupportAreas = mergeValues(r.mainSupportAreas, r.customMainSupportAreas);
  return {
    name: r.organisationName.trim(),
    organisationType: orgType,
    customOrganisationType: r.organisationType === 'Other' ? r.customOrganisationType.trim() : '',
    country: r.country,
    focusSectors,
    customFocusSectors: uniqueValues(r.customFocusSectors),
    mainSupportAreas,
    customMainSupportAreas: uniqueValues(r.customMainSupportAreas),
    focusAreas: focusSectors,
    supportAreas: mainSupportAreas,
  };
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function hasAnyItems(primaryItems, customItems) {
  return hasItems(uniqueValues(primaryItems)) || hasItems(uniqueValues(customItems));
}

function requestedRoleKeyForRegistration(reg) {
  if (reg.accountType === 'startup') return 'startup';
  if (reg.accountType === 'organisation') return 'organisation_admin';
  const mapped = CONTRIBUTOR_TYPE_MAP[reg.contributorType];
  if (mapped === 'Mentor') return 'mentor';
  if (mapped === 'Partner') return 'partner';
  if (mapped === 'Investor') return 'investor';
  if (mapped === 'Service Provider') return 'service_provider';
  return '';
}

function validateRegistrationStep(reg, step, options = {}) {
  const requiresPassword = options.requiresPassword !== false;
  if (step === 0) {
    if (!hasText(reg.email)) return 'Email is required.';
    if (requiresPassword) {
      if (!hasText(reg.password)) return 'Password is required.';
      if (reg.password.length < 6) return 'Password must be at least 6 characters.';
    }
    return '';
  }

  if (reg.accountType === 'startup') {
    if (step === 1) {
      if (!hasText(reg.startupName)) return 'Startup name is required.';
      if (!hasText(reg.sector)) return 'Select a sector.';
      if (reg.sector === 'Other' && !hasText(reg.customSector)) return 'Custom sector is required when sector is Other.';
      if (!hasText(reg.country)) return 'Select a country.';
      if (!hasText(reg.teamSizeRange)) return 'Select a team size range.';
    }
    if (step === 2) {
      if (!hasText(reg.stage)) return 'Select a stage.';
      if (!hasText(reg.problemStatement)) return 'Problem statement is required.';
      if (!hasText(reg.productDescription)) return 'Product description is required.';
    }
    if (step === 3) {
      if (!hasAnyItems(reg.supportNeeds, reg.customSupportNeeds)) return 'Select at least one support need or add a custom support need.';
      if (!hasAnyItems(reg.currentChallenges, reg.customChallenges)) return 'Select at least one current challenge or add a custom challenge.';
    }
  }

  if (reg.accountType === 'contributor') {
    if (step === 1) {
      if (!hasText(reg.contributorName)) return 'Contributor name is required.';
      if (!hasText(reg.contributorType)) return 'Select contributor type.';
    }
    if (step === 2) {
      if (!hasAnyItems(reg.sectorExpertise, reg.customExpertise)) return 'Select at least one expertise area or add custom expertise.';
      if (!hasItems(reg.supportedStages)) return 'Select at least one supported stage.';
      if (!hasItems(reg.countryCoverage)) return 'Select at least one country coverage value.';
      if (!hasAnyItems(reg.supportAreas, reg.customSupportAreas)) return 'Select at least one support area or add a custom support area.';
    }
  }

  if (reg.accountType === 'organisation') {
    if (step === 1) {
      if (!hasText(reg.organisationName)) return 'Organisation name is required.';
      if (!hasText(reg.organisationType)) return 'Select an organisation type.';
      if (reg.organisationType === 'Other' && !hasText(reg.customOrganisationType)) return 'Custom organisation type is required when type is Other.';
      if (!hasText(reg.country)) return 'Select a country.';
    }
    if (step === 2) {
      if (!hasAnyItems(reg.focusSectors, reg.customFocusSectors)) return 'Select at least one focus sector or add a custom focus sector.';
      if (!hasAnyItems(reg.mainSupportAreas, reg.customMainSupportAreas)) return 'Select at least one main support area or add a custom support area.';
    }
  }

  return '';
}

function validateRegistration(reg, options = {}) {
  for (let currentStep = 0; currentStep < STEP_LABELS[reg.accountType].length - 1; currentStep += 1) {
    const currentError = validateRegistrationStep(reg, currentStep, options);
    if (currentError) return currentError;
  }
  return '';
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" className="auth-google-icon" viewBox="0 0 24 24">
      <path
        d="M21.805 12.23c0-.68-.061-1.334-.174-1.963H12v3.713h5.498a4.705 4.705 0 0 1-2.04 3.086v2.565h3.296c1.93-1.776 3.05-4.394 3.05-7.401Z"
        fill="#4285F4"
      />
      <path
        d="M12 22.2c2.76 0 5.076-.914 6.768-2.47l-3.296-2.565c-.914.614-2.083.977-3.472.977-2.667 0-4.925-1.8-5.732-4.22H2.86v2.645A10.2 10.2 0 0 0 12 22.2Z"
        fill="#34A853"
      />
      <path
        d="M6.268 13.922A6.127 6.127 0 0 1 5.948 12c0-.667.115-1.315.32-1.922V7.433H2.86A10.2 10.2 0 0 0 1.8 12c0 1.647.394 3.207 1.06 4.567l3.408-2.645Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.858c1.502 0 2.852.516 3.914 1.528l2.937-2.937C17.072 2.79 14.756 1.8 12 1.8a10.2 10.2 0 0 0-9.14 5.633l3.408 2.645C7.075 7.658 9.333 5.858 12 5.858Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function defaultContributorName(pendingAuthUser) {
  return typeof pendingAuthUser?.displayName === 'string' ? pendingAuthUser.displayName.trim() : '';
}

export default function LoginPage({ authError, pendingAuthUser, onRegistrationCompleted }) {
  const [mode, setMode] = useState('signin');
  const [step, setStep] = useState(0);
  const [signInForm, setSignInForm] = useState({ email: '', password: '' });
  const [reg, setReg] = useState(initialRegistration);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState('');
  const [error, setError] = useState('');
  const [linkState, setLinkState] = useState({ email: '', password: '', methods: [], credential: null });

  const isGoogleRegistration = Boolean(pendingAuthUser?.uid);
  const requiresPassword = !isGoogleRegistration;

  const up = (field, value) => setReg((current) => ({ ...current, [field]: value }));
  const steps = STEP_LABELS[reg.accountType];
  const maxStep = steps.length - 1;

  useEffect(() => {
    if (!pendingAuthUser) return;
    setMode('register');
    setStep(0);
    setError('');
    setReg((current) => ({
      ...current,
      email: pendingAuthUser.email || current.email,
      password: '',
      contributorName: current.contributorName || defaultContributorName(pendingAuthUser),
    }));
  }, [pendingAuthUser]);

  function switchMode(nextMode) {
    if (isGoogleRegistration && nextMode === 'signin') return;
    setMode(nextMode);
    setError('');
    setStep(0);
  }

  function switchEntity(type) {
    setReg({
      ...initialRegistration,
      accountType: type,
      email: isGoogleRegistration ? pendingAuthUser.email || '' : '',
      password: '',
      contributorName: isGoogleRegistration && type === 'contributor' ? defaultContributorName(pendingAuthUser) : '',
    });
    setStep(0);
    setError('');
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setBusy(true);
    setBusyAction('signin');
    setError('');
    try {
      await signInWithEmailAndPassword(auth, signInForm.email.trim(), signInForm.password);
    } catch (err) {
      setError(formatAuthError(err));
    }
    setBusyAction('');
    setBusy(false);
  }

  async function handleDemoSignIn(account) {
    setBusy(true);
    setBusyAction('demo');
    setError('');
    try {
      await signInWithEmailAndPassword(auth, account.email, account.password);
    } catch (err) {
      setError(`${formatAuthError(err)} Run python seed_db.py after starting the Firebase emulators to create demo logins.`);
    }
    setBusyAction('');
    setBusy(false);
  }

  async function handleGoogleSignIn() {
    if (usingEmulators) {
      setError('Google sign-in is not available against the local Auth emulator. Use the hosted Firebase environment for Google auth.');
      return;
    }

    setBusy(true);
    setBusyAction('google');
    setError('');
    setLinkState({ email: '', password: '', methods: [], credential: null });

    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      if (err?.code === 'auth/account-exists-with-different-credential') {
        const credential = GoogleAuthProvider.credentialFromError(err);
        const email = err?.customData?.email || '';
        const methods = email ? await fetchSignInMethodsForEmail(auth, email) : [];
        if (methods.includes('password') && credential) {
          setLinkState({
            email,
            password: '',
            methods,
            credential,
          });
          setError('This email already uses password sign-in. Enter that password once to link Google to the same account.');
        } else {
          setError('This email already exists with another sign-in method. Sign in with that method first, then link Google later.');
        }
      } else {
        setError(formatAuthError(err));
      }
    }

    setBusyAction('');
    setBusy(false);
  }

  async function handleGoogleLink() {
    if (!linkState.email || !linkState.password || !linkState.credential) {
      setError('Email, password, and Google credential are required to complete linking.');
      return;
    }

    setBusy(true);
    setBusyAction('link');
    setError('');

    try {
      const linkedUser = await signInWithEmailAndPassword(auth, linkState.email.trim(), linkState.password);
      await linkWithCredential(linkedUser.user, linkState.credential);
      setLinkState({ email: '', password: '', methods: [], credential: null });
    } catch (err) {
      setError(formatAuthError(err));
    }

    setBusyAction('');
    setBusy(false);
  }

  async function handleRegistration(e) {
    e.preventDefault();
    const registrationError = validateRegistration(reg, { requiresPassword });
    if (registrationError) {
      setError(registrationError);
      return;
    }

    setBusy(true);
    setBusyAction('register');
    setError('');

    let createdUser = null;
    let done = false;

    try {
      if (isGoogleRegistration) {
        createdUser = auth.currentUser;
      } else {
        const cred = await createUserWithEmailAndPassword(auth, reg.email.trim(), reg.password);
        createdUser = cred.user;
      }
      const fn = httpsCallable(functions, 'complete_entity_registration');
      await fn({
        accountType: reg.accountType,
        requestedRoleKey: requestedRoleKeyForRegistration(reg),
        profile: buildRegistrationProfile(reg),
      });
      done = true;
      if (isGoogleRegistration) {
        await onRegistrationCompleted?.();
      } else {
        await signOut(auth);
        await signInWithEmailAndPassword(auth, reg.email.trim(), reg.password);
      }
      setReg(initialRegistration);
      setStep(0);
    } catch (err) {
      if (createdUser && !done && !isGoogleRegistration) {
        await deleteUser(createdUser).catch(() => signOut(auth).catch(() => {}));
      }
      setError(formatAuthError(err));
    }

    setBusyAction('');
    setBusy(false);
  }

  function goNext() {
    const stepError = validateRegistrationStep(reg, step, { requiresPassword });
    if (stepError) {
      setError(stepError);
      return;
    }
    setError('');
    if (step < maxStep) setStep(step + 1);
  }

  function goBack() {
    setError('');
    if (step > 0) setStep(step - 1);
  }

  const submitLabel = reg.accountType === 'startup'
    ? 'Create startup account'
    : reg.accountType === 'contributor'
      ? 'Create contributor account'
      : 'Create organisation account';

  function renderGoogleAction(label) {
    const googleBusyLabel = busyAction === 'google' ? 'Loading Google account...' : label;
    return (
      <button className="auth-google-button" disabled={busy} onClick={handleGoogleSignIn} type="button">
        <GoogleMark />
        <span>{busy ? googleBusyLabel : label}</span>
      </button>
    );
  }

  function renderAccountStep() {
    return (
      <>
        {isGoogleRegistration ? (
          <div className="auth-provider-note">
            <div>
              <strong>Google account connected</strong>
              <span>{pendingAuthUser.email}</span>
            </div>
            <button className="btn btn-outline" onClick={() => signOut(auth)} type="button">Use different account</button>
          </div>
        ) : null}
        <div className="entity-choice-grid" aria-label="Choose account type">
          {[
            { value: 'startup', label: 'Startup', detail: 'Company profile seeking programme support' },
            { value: 'contributor', label: 'Contributor', detail: 'Mentor, partner, investor, or service provider' },
            { value: 'organisation', label: 'Organisation', detail: 'Programme owner pending governance review' },
          ].map((option) => (
            <button
              key={option.value}
              className={`entity-choice ${reg.accountType === option.value ? 'active' : ''}`}
              onClick={() => switchEntity(option.value)}
              type="button"
            >
              <strong>{option.label}</strong>
              <span>{option.detail}</span>
            </button>
          ))}
        </div>
        <div className="auth-form-grid">
          <label>Email<input type="email" value={reg.email} onChange={(e) => up('email', e.target.value)} required readOnly={isGoogleRegistration} /></label>
          {requiresPassword ? <label>Password<input type="password" value={reg.password} onChange={(e) => up('password', e.target.value)} required minLength={6} /></label> : null}
        </div>
      </>
    );
  }

  function renderStartupStep() {
    if (step === 1) return (
      <>
        <h3 className="wizard-section-title">Startup Basics</h3>
        <label>Startup name<input value={reg.startupName} onChange={(e) => up('startupName', e.target.value)} required /></label>
        <div className="auth-form-grid">
          <label>Sector
            <SearchableSelect options={SECTOR_OPTIONS} value={reg.sector} onChange={(value) => up('sector', value)} placeholder="Select sector" />
          </label>
          <label>Country
            <SearchableSelect options={COUNTRY_OPTIONS} value={reg.country} onChange={(value) => up('country', value)} placeholder="Search country" />
          </label>
        </div>
        {reg.sector === 'Other' && (
          <label>Custom sector<input value={reg.customSector} onChange={(e) => up('customSector', e.target.value)} placeholder="Enter your sector" required /></label>
        )}
        <label>Team size
          <select value={reg.teamSizeRange} onChange={(e) => up('teamSizeRange', e.target.value)} required>
            <option value="">Select range</option>
            {TEAM_SIZE_OPTIONS.map((teamSize) => <option key={teamSize}>{teamSize}</option>)}
          </select>
        </label>
      </>
    );

    if (step === 2) return (
      <>
        <h3 className="wizard-section-title">Product & Stage</h3>
        <label>Stage
          <SearchableSelect options={STAGE_OPTIONS} value={reg.stage} onChange={(value) => up('stage', value)} placeholder="Select stage" />
        </label>
        <label>Problem statement<textarea value={reg.problemStatement} onChange={(e) => up('problemStatement', e.target.value)} required /></label>
        <label>Product description<textarea value={reg.productDescription} onChange={(e) => up('productDescription', e.target.value)} required /></label>
        <label>Traction
          <SearchableSelect options={TRACTION_OPTIONS} value={reg.tractionLevel} onChange={(value) => up('tractionLevel', value)} placeholder="Select traction level" isClearable />
        </label>
        {reg.tractionLevel && reg.tractionLevel !== 'No traction yet' && reg.tractionLevel !== 'Early conversations' && (
          <label>Traction details<textarea value={reg.tractionDetail} onChange={(e) => up('tractionDetail', e.target.value)} placeholder="Describe your traction milestones" /></label>
        )}
      </>
    );

    if (step === 3) return (
      <>
        <h3 className="wizard-section-title">Needs</h3>
        <label>Support needs</label>
        <FieldHelper text="Choose support needs and add custom ones if the list does not fit." />
        <CustomMultiSelectField
          options={SUPPORT_NEED_OPTIONS}
          selected={reg.supportNeeds}
          customValues={reg.customSupportNeeds}
          onSelectedChange={(value) => up('supportNeeds', value)}
          onCustomChange={(value) => up('customSupportNeeds', value)}
          placeholder="Select or add custom support needs"
        />
        <label style={{ marginTop: 12 }}>Current challenges</label>
        <FieldHelper text="Choose current blockers and add custom challenges when needed." />
        <CustomMultiSelectField
          options={CHALLENGE_OPTIONS}
          selected={reg.currentChallenges}
          customValues={reg.customChallenges}
          onSelectedChange={(value) => up('currentChallenges', value)}
          onCustomChange={(value) => up('customChallenges', value)}
          placeholder="Select or add custom challenges"
        />
      </>
    );

    return (
      <>
        <h3 className="wizard-section-title">Review your startup profile</h3>
        <ReviewSection title="Account"><ReviewField label="Email" value={reg.email} /><ReviewField label="Account type" value="Startup" /></ReviewSection>
        <ReviewSection title="Startup Basics"><ReviewField label="Name" value={reg.startupName} /><ReviewField label="Sector" value={resolveStartupSector(reg)} /><ReviewField label="Custom sector" value={reg.sector === 'Other' ? reg.customSector : ''} /><ReviewField label="Country" value={reg.country} /><ReviewField label="Team size" value={reg.teamSizeRange} /></ReviewSection>
        <ReviewSection title="Product & Stage"><ReviewField label="Stage" value={reg.stage} /><ReviewField label="Problem" value={reg.problemStatement} /><ReviewField label="Product" value={reg.productDescription} /><ReviewField label="Traction" value={reg.tractionLevel} />{reg.tractionDetail && <ReviewField label="Traction details" value={reg.tractionDetail} />}</ReviewSection>
        <ReviewSection title="Needs"><ReviewField label="Support needs" value={mergeValues(reg.supportNeeds, reg.customSupportNeeds)} /><ReviewField label="Custom support needs" value={reg.customSupportNeeds} /><ReviewField label="Challenges" value={mergeValues(reg.currentChallenges, reg.customChallenges)} /><ReviewField label="Custom challenges" value={reg.customChallenges} /></ReviewSection>
        <div className="dev-note">Public registrations start as pending. Programme records are created later by approved organisation accounts.</div>
      </>
    );
  }

  function renderContributorStep() {
    if (step === 1) return (
      <>
        <h3 className="wizard-section-title">Contributor Info</h3>
        <label>Full name<input value={reg.contributorName} onChange={(e) => up('contributorName', e.target.value)} required /></label>
        <label>Primary contributor type
          <SearchableSelect options={CONTRIBUTOR_TYPE_OPTIONS} value={reg.contributorType} onChange={(value) => { up('contributorType', value); up('primaryContributorType', value); }} placeholder="Select contributor type" />
        </label>
        <FieldHelper text="Choose the main identity you want to register under. You can refine operations after approval." />
      </>
    );

    if (step === 2) return (
      <>
        <h3 className="wizard-section-title">Expertise & Coverage</h3>
        <label>Expertise</label>
        <FieldHelper text="Select expertise areas and add custom expertise if needed." />
        <CustomMultiSelectField
          options={SECTOR_EXPERTISE_OPTIONS}
          selected={reg.sectorExpertise}
          customValues={reg.customExpertise}
          onSelectedChange={(value) => up('sectorExpertise', value)}
          onCustomChange={(value) => up('customExpertise', value)}
          placeholder="Select or add custom expertise"
        />
        <label style={{ marginTop: 12 }}>Supported stages</label>
        <SearchableMultiSelect options={SUPPORTED_STAGE_OPTIONS} value={reg.supportedStages} onChange={(value) => up('supportedStages', value)} placeholder="Select supported stages" />
        <label style={{ marginTop: 12 }}>Country coverage</label>
        <SearchableMultiSelect options={COUNTRY_COVERAGE_OPTIONS} value={reg.countryCoverage} onChange={(value) => up('countryCoverage', value)} placeholder="Select countries or Global / Remote" />
        <label style={{ marginTop: 12 }}>Support areas</label>
        <CustomMultiSelectField
          options={SUPPORT_AREA_OPTIONS}
          selected={reg.supportAreas}
          customValues={reg.customSupportAreas}
          onSelectedChange={(value) => up('supportAreas', value)}
          onCustomChange={(value) => up('customSupportAreas', value)}
          placeholder="Select or add custom support areas"
        />
        {reg.contributorType === 'Investor / Funder' && (
          <>
            <label style={{ marginTop: 12 }}>Investment thesis<input value={reg.investmentThesis} onChange={(e) => up('investmentThesis', e.target.value)} placeholder="AI, SaaS, Healthtech" /></label>
            <label>Ticket size<input value={reg.ticketSize} onChange={(e) => up('ticketSize', e.target.value)} placeholder="e.g. MYR 100k - MYR 1M" /></label>
          </>
        )}
        {reg.contributorType === 'Professional Service Provider' && (
          <FieldHelper text="You can add detailed delivery and capacity settings after account approval." />
        )}
      </>
    );

    return (
      <>
        <h3 className="wizard-section-title">Review your contributor profile</h3>
        <ReviewSection title="Account"><ReviewField label="Email" value={reg.email} /><ReviewField label="Account type" value="Contributor" /></ReviewSection>
        <ReviewSection title="Contributor Info"><ReviewField label="Name" value={reg.contributorName} /><ReviewField label="Primary type" value={reg.contributorType} /></ReviewSection>
        <ReviewSection title="Expertise & Coverage"><ReviewField label="Expertise" value={mergeValues(reg.sectorExpertise, reg.customExpertise)} /><ReviewField label="Custom expertise" value={reg.customExpertise} /><ReviewField label="Stages" value={reg.supportedStages} /><ReviewField label="Countries" value={reg.countryCoverage} /><ReviewField label="Support areas" value={mergeValues(reg.supportAreas, reg.customSupportAreas)} /><ReviewField label="Custom support areas" value={reg.customSupportAreas} />{reg.contributorType === 'Investor / Funder' && <><ReviewField label="Investment thesis" value={reg.investmentThesis} /><ReviewField label="Ticket size" value={reg.ticketSize} /></>}</ReviewSection>
        <div className="dev-note">Public registrations start as pending. Programme records are created later by approved organisation accounts.</div>
      </>
    );
  }

  function renderOrganisationStep() {
    if (step === 1) return (
      <>
        <h3 className="wizard-section-title">Organisation</h3>
        <label>Organisation name<input value={reg.organisationName} onChange={(e) => up('organisationName', e.target.value)} required /></label>
        <div className="auth-form-grid">
          <label>Organisation type
            <SearchableSelect options={ORG_TYPE_OPTIONS} value={reg.organisationType} onChange={(value) => up('organisationType', value)} placeholder="Select type" />
          </label>
          <label>Country
            <SearchableSelect options={COUNTRY_OPTIONS} value={reg.country} onChange={(value) => up('country', value)} placeholder="Search country" />
          </label>
        </div>
        {reg.organisationType === 'Other' && (
          <label>Custom organisation type<input value={reg.customOrganisationType} onChange={(e) => up('customOrganisationType', e.target.value)} placeholder="Describe your organisation type" required /></label>
        )}
        <FieldHelper text="Organisation roles are configured internally after approval." />
      </>
    );

    if (step === 2) return (
      <>
        <h3 className="wizard-section-title">Ecosystem Scope</h3>
        <label>Focus sectors</label>
        <FieldHelper text="Select focus sectors and add custom sectors if needed." />
        <CustomMultiSelectField
          options={FOCUS_SECTOR_OPTIONS}
          selected={reg.focusSectors}
          customValues={reg.customFocusSectors}
          onSelectedChange={(value) => up('focusSectors', value)}
          onCustomChange={(value) => up('customFocusSectors', value)}
          placeholder="Select or add custom focus sectors"
        />
        <label style={{ marginTop: 12 }}>Main support areas</label>
        <CustomMultiSelectField
          options={SUPPORT_AREA_OPTIONS}
          selected={reg.mainSupportAreas}
          customValues={reg.customMainSupportAreas}
          onSelectedChange={(value) => up('mainSupportAreas', value)}
          onCustomChange={(value) => up('customMainSupportAreas', value)}
          placeholder="Select or add custom support areas"
        />
      </>
    );

    return (
      <>
        <h3 className="wizard-section-title">Review your organisation profile</h3>
        <ReviewSection title="Account"><ReviewField label="Email" value={reg.email} /><ReviewField label="Account type" value="Organisation" /></ReviewSection>
        <ReviewSection title="Organisation"><ReviewField label="Name" value={reg.organisationName} /><ReviewField label="Type" value={reg.organisationType === 'Other' ? reg.customOrganisationType : reg.organisationType} /><ReviewField label="Custom type" value={reg.organisationType === 'Other' ? reg.customOrganisationType : ''} /><ReviewField label="Country" value={reg.country} /></ReviewSection>
        <ReviewSection title="Ecosystem Scope"><ReviewField label="Focus sectors" value={mergeValues(reg.focusSectors, reg.customFocusSectors)} /><ReviewField label="Custom focus sectors" value={reg.customFocusSectors} /><ReviewField label="Main support areas" value={mergeValues(reg.mainSupportAreas, reg.customMainSupportAreas)} /><ReviewField label="Custom support areas" value={reg.customMainSupportAreas} /></ReviewSection>
        <div className="dev-note">Public registrations start as pending. Programme records are created later by approved organisation accounts.</div>
      </>
    );
  }

  function renderStepContent() {
    if (step === 0) return renderAccountStep();
    if (reg.accountType === 'startup') return renderStartupStep();
    if (reg.accountType === 'contributor') return renderContributorStep();
    return renderOrganisationStep();
  }

  const shownError = error || authError;

  return (
    <div className="login-container">
      <div className="login-left">
        <div className="login-card">
          <div style={{ marginBottom: 24 }}>
            <div className="hero-kicker" style={{ color: 'var(--color-primary)', background: 'var(--color-primary-bg)', marginBottom: 16 }}>
              Lattice Access
            </div>
            <h1 style={{ fontSize: 32, color: 'var(--color-text)', marginBottom: 10, fontFamily: 'var(--font-display)' }}>
              Sign in to the programme workspace.
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
              Each login maps to one startup, contributor, or organisation entity so recommendations stay tied to the ecosystem graph.
            </p>
          </div>

          <div className="auth-tabs">
            <button className={mode === 'signin' ? 'active' : ''} onClick={() => switchMode('signin')} type="button">Sign in</button>
            <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')} type="button">Create account</button>
          </div>

          {shownError ? <div className="auth-alert">{shownError}</div> : null}

          {mode === 'signin' ? (
            <form className="auth-form" onSubmit={handleSignIn}>
              <label>Email<input type="email" value={signInForm.email} onChange={(e) => setSignInForm({ ...signInForm, email: e.target.value })} required /></label>
              <label>Password<input type="password" value={signInForm.password} onChange={(e) => setSignInForm({ ...signInForm, password: e.target.value })} required /></label>
              <button className="btn btn-primary auth-submit" disabled={busy} type="submit">{busy && busyAction === 'signin' ? 'Signing in...' : 'Sign in'}</button>
              {renderGoogleAction('Continue with Google')}
              {linkState.credential ? (
                <div className="auth-link-form">
                  <div className="auth-link-copy">
                    Link Google to <strong>{linkState.email}</strong>.
                  </div>
                  <label>Password<input type="password" value={linkState.password} onChange={(e) => setLinkState((current) => ({ ...current, password: e.target.value }))} required /></label>
                  <button className="btn btn-outline auth-submit" disabled={busy} onClick={handleGoogleLink} type="button">{busy && busyAction === 'link' ? 'Linking...' : 'Link Google and continue'}</button>
                </div>
              ) : null}
              {usingEmulators ? (
                <div className="demo-login-group">
                  {demoAccounts.map((account) => (
                    <button key={account.email} className="role-button" disabled={busy} onClick={() => handleDemoSignIn(account)} type="button">{account.label}</button>
                  ))}
                  <div className="dev-note">Local demo: run <code>firebase emulators:start</code>, then <code>python seed_db.py</code>.</div>
                </div>
              ) : null}
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegistration}>
              <WizardProgress steps={steps} current={step} />
              {renderStepContent()}
              {!isGoogleRegistration && step === 0 ? renderGoogleAction('Create account with Google') : null}
              <WizardNav step={step} maxStep={maxStep} onBack={goBack} onContinue={goNext} busy={busy} submitLabel={submitLabel} />
            </form>
          )}
        </div>
      </div>
      <div className="login-right">
        <div className="hero-kicker">Programme-First Relationship Engine</div>
        <h2 style={{ fontSize: 48, marginBottom: 20, fontFamily: 'var(--font-display)' }}>
          One account represents one ecosystem actor.
        </h2>
        <p style={{ fontSize: 18, color: '#c5d2df', lineHeight: 1.75, maxWidth: 560, marginBottom: 26 }}>
          Startups, contributors, and organisations register into their existing schema collections.
          The account document only links authentication to that entity.
        </p>
        <div className="hero-chip-grid" style={{ maxWidth: 520 }}>
          <div className="hero-chip"><strong>Entity account</strong><span>No startup member hierarchy is created for the MVP.</span></div>
          <div className="hero-chip"><strong>Schema-safe recommendations</strong><span>AI still reads companies, contributors, and programmes for embeddings and fit scoring.</span></div>
          <div className="hero-chip"><strong>Governed access</strong><span>New public accounts remain pending until reviewed by an active governance account.</span></div>
        </div>
      </div>
    </div>
  );
}
