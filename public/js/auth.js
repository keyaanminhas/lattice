// ─── App Shell ───────────────────────────────────────────────────────────────
function renderAppShell() {
  const account = App.currentAccount;
  const role = account?.accountType === 'startup' ? 'Startup' :
               account?.accountType === 'contributor' ? 'Contributor' :
               account?.accountType === 'organisation' ? 'Admin' :
               account?.accountType === 'organisationAdmin' ? 'Org Admin' : 'Platform Admin';

  const adminNav = isAdmin(account) ? `
    <span class="nav-section-label">Admin</span>
    <button class="nav-item" data-page="programmes" onclick="navigate('programmes')">
      <span class="nav-icon">🎯</span> Programmes
    </button>
    <button class="nav-item" data-page="companies" onclick="navigate('companies')">
      <span class="nav-icon">🏢</span> Companies
    </button>
    <button class="nav-item" data-page="contributors" onclick="navigate('contributors')">
      <span class="nav-icon">🤝</span> Contributors
    </button>
    <button class="nav-item" data-page="recommendations" onclick="navigate('recommendations')">
      <span class="nav-icon">✨</span> Approval Board
    </button>
    <button class="nav-item" data-page="relationships" onclick="navigate('relationships')">
      <span class="nav-icon">🔗</span> Relationships
    </button>` : '';

  document.getElementById('app').innerHTML = `
    <div class="app-layout">
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <a class="logo-mark" href="#" onclick="navigate('dashboard')">
            <div class="logo-icon">L</div>
            <div>
              <div class="logo-text">Lattice</div>
              <div class="logo-badge">ECOSYSTEM PLATFORM</div>
            </div>
          </a>
        </div>
        <div class="sidebar-nav">
          <span class="nav-section-label">General</span>
          <button class="nav-item" data-page="dashboard" onclick="navigate('dashboard')">
            <span class="nav-icon">📊</span> Dashboard
          </button>
          ${adminNav}
          <button class="nav-item" data-page="profile" onclick="navigate('profile')">
            <span class="nav-icon">👤</span> My Profile
          </button>
        </div>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${(account?.displayName || 'U')[0].toUpperCase()}</div>
            <div class="user-info">
              <div class="user-name">${account?.displayName || 'User'}</div>
              <div class="user-role">${role}</div>
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:10px;" onclick="signOut()">Sign Out</button>
        </div>
      </nav>
      <main class="main-content">
        <div class="top-bar">
          <div class="top-bar-title" id="top-bar-title">Dashboard</div>
          <div class="top-bar-actions">
            <span class="badge badge-green">${account?.status || 'Active'}</span>
          </div>
        </div>
        <div class="page-content" id="page-root"></div>
      </main>
    </div>
    <div class="modal-overlay" id="modal-overlay" onclick="closeModal(event)">
      <div class="modal" id="modal-box"></div>
    </div>
  `;
}

function signOut() {
  App.auth.signOut().then(() => { App.currentUser = null; App.currentAccount = null; renderAuthPage(); });
}

function getRoot() { return document.getElementById('page-root'); }

function showModal(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    document.getElementById('modal-overlay').classList.remove('open');
  }
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function renderAuthPage() {
  document.getElementById('app').innerHTML = `
    <div class="auth-page">
      <div class="auth-card fade-in">
        <div class="auth-logo">
          <div class="logo-icon" style="width:52px;height:52px;font-size:26px;margin:0 auto 12px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;">L</div>
          <h1 style="font-size:26px;font-weight:800;">Lattice</h1>
          <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">AI-Powered Ecosystem Relationship Platform</p>
        </div>
        <div class="auth-tabs">
          <button class="auth-tab active" id="tab-login" onclick="switchAuthTab('login')">Sign In</button>
          <button class="auth-tab" id="tab-signup" onclick="switchAuthTab('signup')">Register</button>
        </div>
        <div id="auth-form-wrap"></div>
      </div>
    </div>
  `;
  renderLoginForm();
}

function switchAuthTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
  if (tab === 'login') renderLoginForm(); else renderSignupForm();
}

function renderLoginForm() {
  document.getElementById('auth-form-wrap').innerHTML = `
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" type="email" id="login-email" placeholder="you@example.com">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" type="password" id="login-pass" placeholder="••••••••">
    </div>
    <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" id="login-btn" onclick="doLogin()">
      Sign In
    </button>
    <p id="auth-error" style="color:var(--danger);font-size:12px;margin-top:12px;text-align:center;"></p>
  `;
  document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
}

function renderSignupForm() {
  document.getElementById('auth-form-wrap').innerHTML = `
    <div class="form-group">
      <label class="form-label">Email</label>
      <input class="form-input" type="email" id="signup-email" placeholder="you@example.com">
    </div>
    <div class="form-group">
      <label class="form-label">Password</label>
      <input class="form-input" type="password" id="signup-pass" placeholder="Min 6 characters">
    </div>
    <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;" id="signup-btn" onclick="doSignup()">
      Create Account
    </button>
    <p id="auth-error" style="color:var(--danger);font-size:12px;margin-top:12px;text-align:center;"></p>
  `;
}

async function doLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="spinner"></span> Signing in…'; btn.disabled = true;
  try {
    await App.auth.signInWithEmailAndPassword(email, pass);
  } catch (e) {
    document.getElementById('auth-error').textContent = e.message;
    btn.innerHTML = 'Sign In'; btn.disabled = false;
  }
}

async function doSignup() {
  const email = document.getElementById('signup-email').value;
  const pass = document.getElementById('signup-pass').value;
  const btn = document.getElementById('signup-btn');
  btn.innerHTML = '<span class="spinner"></span> Creating…'; btn.disabled = true;
  try {
    await App.auth.createUserWithEmailAndPassword(email, pass);
    // onAuthStateChanged will redirect to registration
  } catch (e) {
    document.getElementById('auth-error').textContent = e.message;
    btn.innerHTML = 'Create Account'; btn.disabled = false;
  }
}

// ─── Register Page ────────────────────────────────────────────────────────────
let regStep = 1;
let regType = '';

function renderRegisterPage() {
  document.getElementById('app').innerHTML = `
    <div class="auth-page" style="align-items:flex-start;padding-top:48px;">
      <div class="auth-card fade-in" style="max-width:560px;">
        <div style="text-align:center;margin-bottom:28px;">
          <div class="logo-icon" style="width:44px;height:44px;font-size:22px;margin:0 auto 12px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;font-weight:800;">L</div>
          <h1 style="font-size:20px;font-weight:700;">Complete Your Profile</h1>
          <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">Tell us who you are in the ecosystem</p>
        </div>
        <div class="steps" id="reg-steps">
          <div class="step active" id="step-1"><div class="step-num">1</div><div class="step-label">Account Type</div></div>
          <div class="step" id="step-2"><div class="step-num">2</div><div class="step-label">Profile</div></div>
          <div class="step" id="step-3"><div class="step-num">3</div><div class="step-label">Done</div></div>
        </div>
        <div id="reg-body"></div>
        <button class="btn btn-secondary btn-sm" style="margin-top:16px;" onclick="App.auth.signOut().then(renderAuthPage)">← Back to login</button>
      </div>
    </div>
  `;
  renderRegStep1();
}

function renderRegStep1() {
  regStep = 1;
  document.getElementById('reg-body').innerHTML = `
    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">How will you use Lattice?</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${[['startup','🏢','Startup / Company','We are a startup looking for support, mentors, and programmes.'],
         ['contributor','🤝','Contributor','I am a mentor, partner, investor, or service provider.'],
         ['organisation','🏛️','Programme Administrator','We manage innovation programmes and ecosystems.']].map(([v,icon,title,desc]) => `
        <button class="card" style="text-align:left;cursor:pointer;border:none;width:100%;background:var(--bg-card);padding:16px;" onclick="selectRegType('${v}')">
          <div style="font-size:20px;margin-bottom:6px;">${icon}</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);">${title}</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${desc}</div>
        </button>`).join('')}
    </div>
  `;
}

function selectRegType(type) {
  regType = type;
  document.getElementById('step-1').classList.remove('active'); document.getElementById('step-1').classList.add('done');
  document.getElementById('step-2').classList.add('active');
  regStep = 2;
  if (type === 'startup') renderStartupRegForm();
  else if (type === 'contributor') renderContributorRegForm();
  else renderOrgRegForm();
}

function renderStartupRegForm() {
  document.getElementById('reg-body').innerHTML = `
    <div class="form-group"><label class="form-label">Startup Name *</label><input class="form-input" id="r-name" placeholder="e.g. MediScan AI"></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Sector / Industry *</label><input class="form-input" id="r-sector" placeholder="e.g. Healthtech, AI, Fintech"></div>
      <div class="form-group"><label class="form-label">Stage *</label>
        <select class="form-select" id="r-stage">
          <option>Idea</option><option selected>MVP</option><option>Pre-seed</option><option>Seed</option><option>Growth</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label class="form-label">Country</label><input class="form-input" id="r-country" placeholder="e.g. Malaysia" value="Malaysia"></div>
    <div class="form-group"><label class="form-label">Problem Statement</label><textarea class="form-textarea" id="r-problem" placeholder="What problem does your startup solve?" style="min-height:80px;"></textarea></div>
    <div class="form-group"><label class="form-label">Product Description</label><textarea class="form-textarea" id="r-product" placeholder="What do you build?" style="min-height:80px;"></textarea></div>
    <div class="form-group"><label class="form-label">Support Needs (press Enter to add)</label><div class="tags-container" id="tags-needs"><input class="tags-input" placeholder="e.g. Funding, Cloud, Legal…"></div></div>
    <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;" id="reg-submit-btn" onclick="submitRegistration()">Complete Registration →</button>
    <p id="reg-error" style="color:var(--danger);font-size:12px;margin-top:10px;"></p>
  `;
  initTagsInput('tags-needs');
}

function renderContributorRegForm() {
  document.getElementById('reg-body').innerHTML = `
    <div class="form-group"><label class="form-label">Full Name / Organisation Name *</label><input class="form-input" id="r-name" placeholder="e.g. Dr. Sarah Lim"></div>
    <div class="form-group"><label class="form-label">Contributor Type(s)</label>
      <div class="chip-group" id="ctype-group">
        ${['Mentor','Partner','Investor','Service Provider'].map(v => `<button class="chip-toggle" data-value="${v}" onclick="this.classList.toggle('selected')">${v}</button>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Expertise (press Enter to add)</label><div class="tags-container" id="tags-exp"><input class="tags-input" placeholder="e.g. Regulatory, AI, Finance…"></div></div>
    <div class="form-group"><label class="form-label">Country Coverage (press Enter to add)</label><div class="tags-container" id="tags-country"><input class="tags-input" placeholder="e.g. Malaysia, Singapore…"></div></div>
    <div class="form-group"><label class="form-label">Availability</label>
      <select class="form-select" id="r-availability"><option>Available</option><option>Limited</option><option>Unavailable</option></select>
    </div>
    <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;" id="reg-submit-btn" onclick="submitRegistration()">Complete Registration →</button>
    <p id="reg-error" style="color:var(--danger);font-size:12px;margin-top:10px;"></p>
  `;
  initTagsInput('tags-exp');
  initTagsInput('tags-country');
}

function renderOrgRegForm() {
  document.getElementById('reg-body').innerHTML = `
    <div class="form-group"><label class="form-label">Organisation Name *</label><input class="form-input" id="r-name" placeholder="e.g. Cradle Fund"></div>
    <div class="form-group"><label class="form-label">Organisation Type</label>
      <select class="form-select" id="r-org-type">
        <option>Programme Owner</option><option>Government Agency</option><option>University</option><option>Corporate</option><option>Accelerator</option>
      </select>
    </div>
    <div class="form-group"><label class="form-label">Country</label><input class="form-input" id="r-country" placeholder="Malaysia" value="Malaysia"></div>
    <div class="form-group"><label class="form-label">Focus Areas (press Enter to add)</label><div class="tags-container" id="tags-focus"><input class="tags-input" placeholder="e.g. AI, Fintech, Healthtech…"></div></div>
    <button class="btn btn-primary btn-lg" style="width:100%;justify-content:center;margin-top:8px;" id="reg-submit-btn" onclick="submitRegistration()">Complete Registration →</button>
    <p id="reg-error" style="color:var(--danger);font-size:12px;margin-top:10px;"></p>
  `;
  initTagsInput('tags-focus');
}

async function submitRegistration() {
  const btn = document.getElementById('reg-submit-btn');
  const err = document.getElementById('reg-error');
  btn.innerHTML = '<span class="spinner"></span> Registering…'; btn.disabled = true;
  err.textContent = '';

  let profile = {};
  if (regType === 'startup') {
    profile = {
      name: document.getElementById('r-name').value,
      sector: document.getElementById('r-sector').value,
      stage: document.getElementById('r-stage').value,
      country: document.getElementById('r-country').value,
      problemStatement: document.getElementById('r-problem').value,
      productDescription: document.getElementById('r-product').value,
      supportNeeds: document.getElementById('tags-needs').getTags(),
    };
    if (!profile.name || !profile.sector) { err.textContent = 'Startup name and sector are required.'; btn.innerHTML = 'Complete Registration →'; btn.disabled = false; return; }
  } else if (regType === 'contributor') {
    profile = {
      name: document.getElementById('r-name').value,
      contributorTypes: [...document.querySelectorAll('#ctype-group .selected')].map(el => el.dataset.value),
      expertise: document.getElementById('tags-exp').getTags(),
      countryCoverage: document.getElementById('tags-country').getTags(),
      availability: document.getElementById('r-availability').value,
    };
    if (!profile.name) { err.textContent = 'Name is required.'; btn.innerHTML = 'Complete Registration →'; btn.disabled = false; return; }
  } else {
    profile = {
      name: document.getElementById('r-name').value,
      organisationType: document.getElementById('r-org-type').value,
      country: document.getElementById('r-country').value,
      focusAreas: document.getElementById('tags-focus').getTags(),
    };
    if (!profile.name) { err.textContent = 'Organisation name is required.'; btn.innerHTML = 'Complete Registration →'; btn.disabled = false; return; }
  }

  try {
    const result = await callFn('complete_entity_registration', { accountType: regType, profile });
    App.currentAccount = await loadAccount(App.currentUser.uid);
    // Show success step
    document.getElementById('step-2').classList.remove('active'); document.getElementById('step-2').classList.add('done');
    document.getElementById('step-3').classList.add('active');
    document.getElementById('reg-body').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🎉</div>
        <h3>Registration Submitted!</h3>
        <p style="margin-bottom:20px;">Your profile is pending admin review. You'll be able to access the platform once approved.</p>
        <button class="btn btn-primary" onclick="renderAppShell();navigate('dashboard')">Go to Dashboard →</button>
      </div>
    `;
  } catch (e) {
    err.textContent = e.message;
    btn.innerHTML = 'Complete Registration →'; btn.disabled = false;
  }
}

function renderAuth() { /* redirect to auth page if not logged in */ }
function renderRegister() { renderRegisterPage(); }
