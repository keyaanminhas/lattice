// ─── Firebase Config ───────────────────────────────────────────────────────
const FIREBASE_CONFIG = {
  // Replace with your actual Firebase project config from the Firebase Console
  // Go to: Firebase Console → Project Settings → Your apps → SDK setup
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "lattice-2026.firebaseapp.com",
  projectId: "lattice-2026",
  storageBucket: "lattice-2026.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_SENDER_ID",
  appId: "REPLACE_WITH_APP_ID"
};

// ─── App State ─────────────────────────────────────────────────────────────
const App = {
  auth: null,
  db: null,
  functions: null,
  currentUser: null,
  currentAccount: null,
  currentPage: null,
};

// ─── Init Firebase ─────────────────────────────────────────────────────────
function initFirebase() {
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    App.auth = firebase.auth();
    App.db = firebase.firestore();
    App.functions = firebase.functions();
    // Use emulators if running locally
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      App.auth.useEmulator('http://localhost:9099');
      App.db.useEmulator('localhost', 8080);
      App.functions.useEmulator('localhost', 5001);
    }
  } catch (e) {
    console.error('Firebase init error:', e);
  }
}

// ─── Router ─────────────────────────────────────────────────────────────────
const routes = {
  login:       () => renderAuth(),
  dashboard:   () => renderDashboard(),
  programmes:  () => renderProgrammes(),
  companies:   () => renderCompanies(),
  contributors:() => renderContributors(),
  recommendations: () => renderRecommendations(),
  relationships:   () => renderRelationships(),
  register:    () => renderRegister(),
  profile:     () => renderProfile(),
};

function navigate(page, params = {}) {
  App.currentPage = page;
  App.routeParams = params;
  window.location.hash = page;
  render(page);
}

function render(page) {
  const fn = routes[page] || routes['dashboard'];
  fn();
  updateSidebarActive(page);
}

function updateSidebarActive(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  const titles = {
    dashboard: 'Ecosystem Dashboard',
    programmes: 'Programmes',
    companies: 'Companies & Startups',
    contributors: 'Contributors',
    recommendations: 'Relationship Approval Board',
    relationships: 'Active Relationships',
    profile: 'My Profile',
  };
  const bar = document.getElementById('top-bar-title');
  if (bar) bar.textContent = titles[page] || 'Lattice';
}

// ─── Auth Guard ─────────────────────────────────────────────────────────────
async function loadAccount(uid) {
  const snap = await App.db.collection('accounts').doc(uid).get();
  if (!snap.exists) return null;
  return { uid, ...snap.data() };
}

// ─── Main entry ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initFirebase();

  App.auth.onAuthStateChanged(async user => {
    if (!user) {
      renderAuthPage();
      return;
    }
    App.currentUser = user;
    App.currentAccount = await loadAccount(user.uid);
    if (!App.currentAccount) {
      renderRegisterPage();
      return;
    }
    renderAppShell();
    const hash = window.location.hash.replace('#', '') || 'dashboard';
    render(hash);
  });
});

// ─── Utilities ──────────────────────────────────────────────────────────────
function callFn(name, data) {
  const fn = App.functions.httpsCallable(name);
  return fn(data).then(r => r.data);
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function scoreColor(score) {
  if (score >= 80) return 'var(--success)';
  if (score >= 60) return 'var(--warning)';
  return 'var(--danger)';
}

function statusBadge(status) {
  const map = {
    'Active': 'badge-green', 'Verified': 'badge-green', 'Approved': 'badge-green', 'Accepted': 'badge-green', 'Completed': 'badge-green',
    'Pending': 'badge-yellow', 'Pending Approval': 'badge-yellow', 'Pending Admin Review': 'badge-yellow', 'Open': 'badge-yellow', 'Limited': 'badge-yellow',
    'Rejected': 'badge-red', 'Suspended': 'badge-red', 'Expired': 'badge-red', 'Unavailable': 'badge-red',
    'Needs Review': 'badge-purple',
  };
  const cls = map[status] || 'badge-gray';
  return `<span class="badge ${cls}">${status || '—'}</span>`;
}

function isAdmin(account) {
  return account && ['organisation', 'organisationAdmin', 'platformAdmin'].includes(account.accountType);
}

function toast(msg, type = 'info') {
  const colors = { info: 'var(--accent)', success: 'var(--success)', error: 'var(--danger)' };
  const el = document.createElement('div');
  el.style.cssText = `position:fixed;bottom:24px;right:24px;background:var(--bg-secondary);border:1px solid ${colors[type]};color:var(--text-primary);padding:12px 18px;border-radius:10px;font-size:13px;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,0.4);animation:fadeIn 0.2s ease;max-width:320px;`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── Tags input helper ───────────────────────────────────────────────────────
function initTagsInput(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const input = container.querySelector('.tags-input');
  const tags = [];

  function addTag(val) {
    const v = val.trim();
    if (!v || tags.includes(v)) return;
    tags.push(v);
    renderTags();
  }

  function renderTags() {
    container.querySelectorAll('.tag-chip').forEach(el => el.remove());
    tags.forEach((t, i) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `${t}<button onclick="event.stopPropagation()">×</button>`;
      chip.querySelector('button').onclick = () => { tags.splice(i, 1); renderTags(); };
      container.insertBefore(chip, input);
    });
  }

  input.addEventListener('keydown', e => {
    if (['Enter', ',', 'Tab'].includes(e.key)) {
      e.preventDefault();
      addTag(input.value);
      input.value = '';
    }
    if (e.key === 'Backspace' && !input.value && tags.length) {
      tags.pop(); renderTags();
    }
  });

  container.addEventListener('click', () => input.focus());
  container.getTags = () => [...tags];
  return container;
}

// ─── Chip toggles ────────────────────────────────────────────────────────────
function initChipGroup(groupId, max = Infinity) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.chip-toggle').forEach(chip => {
    chip.addEventListener('click', () => {
      const isSelected = chip.classList.contains('selected');
      const selected = group.querySelectorAll('.selected').length;
      if (!isSelected && selected >= max) return;
      chip.classList.toggle('selected', !isSelected);
    });
  });
  group.getSelected = () => [...group.querySelectorAll('.selected')].map(el => el.dataset.value);
  return group;
}
