// ─── Dashboard ────────────────────────────────────────────────────────────────
async function renderDashboard() {
  const root = getRoot();
  root.innerHTML = `<div class="loading-pulse" style="color:var(--text-muted);font-size:14px;padding:40px 0;">Loading dashboard…</div>`;

  try {
    const data = await callFn('get_dashboard_stats', {});
    const insights = await callFn('get_ai_insights', {}).catch(() => ({ insights: [], stats: {} }));

    root.innerHTML = `
      <div class="fade-in">
        <div class="page-header">
          <div>
            <h1>Ecosystem Dashboard</h1>
            <p>Overview of your innovation ecosystem at a glance</p>
          </div>
          <button class="btn btn-primary" onclick="navigate('recommendations')">✨ Approval Board</button>
        </div>

        <div class="stat-grid">
          ${statCard('Organisations', data.totalOrganisations, '🏛️', 'Registered ecosystem owners')}
          ${statCard('Open Programmes', data.openProgrammes, '🎯', 'Active & open for applications')}
          ${statCard('Companies', data.totalStartups, '🏢', `${data.verifiedStartups} verified`)}
          ${statCard('Contributors', data.totalContributors, '🤝', 'Mentors, partners & investors')}
          ${statCard('Pending Recommendations', data.pendingRecommendations, '⏳', 'Awaiting admin approval')}
          ${statCard('Active Relationships', data.activeRelationships, '🔗', `${data.completedRelationships} completed`)}
          ${statCard('Success Rate', (data.outcomeSuccessRate || 0) + '%', '📈', 'Outcomes marked as achieved')}
          ${statCard('Pending Applications', data.pendingApplications, '📋', `${data.acceptedApplications} accepted`)}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:4px;">
          <div class="card">
            <div style="font-size:15px;font-weight:700;margin-bottom:16px;">🤖 AI Insights</div>
            ${insights.insights && insights.insights.length ?
              insights.insights.map(i => alertCard(i)).join('') :
              '<div class="empty-state" style="padding:30px 0;"><div class="empty-state-icon">🤖</div><p>No insights yet — add data to generate AI alerts.</p></div>'
            }
          </div>
          <div class="card">
            <div style="font-size:15px;font-weight:700;margin-bottom:16px;">🚀 Quick Actions</div>
            <div style="display:flex;flex-direction:column;gap:10px;">
              <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="navigate('companies')">🏢 Review New Companies</button>
              <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="navigate('recommendations')">✨ Review AI Recommendations</button>
              <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="navigate('programmes')">🎯 Manage Programmes</button>
              <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="navigate('contributors')">🤝 Manage Contributors</button>
              <button class="btn btn-secondary" style="justify-content:flex-start;" onclick="navigate('relationships')">🔗 View Relationships</button>
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (e) {
    root.innerHTML = `
      <div class="fade-in">
        <div class="page-header"><div><h1>Dashboard</h1><p>Welcome to Lattice</p></div></div>
        <div class="alert-card info">
          <div class="alert-icon">ℹ️</div>
          <div><div class="alert-title">No data yet</div><div class="alert-desc">The platform is set up and ready. Start by adding programmes, companies, and contributors.</div></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:20px;">
          <button class="btn btn-primary" onclick="navigate('programmes')">🎯 Create First Programme</button>
          <button class="btn btn-secondary" onclick="navigate('companies')">🏢 Add Companies</button>
          <button class="btn btn-secondary" onclick="navigate('contributors')">🤝 Add Contributors</button>
        </div>
      </div>
    `;
  }
}

function statCard(label, value, icon, sub) {
  return `
    <div class="stat-card">
      <div class="stat-icon">${icon}</div>
      <div class="stat-label">${label}</div>
      <div class="stat-value">${value ?? '—'}</div>
      <div class="stat-sub">${sub}</div>
    </div>
  `;
}

function alertCard(insight) {
  const typeMap = { warning: 'warning', error: 'danger', info: 'info', success: 'success' };
  const icons = { warning: '⚠️', error: '🔴', info: '💡', success: '✅' };
  const cls = typeMap[insight.severity] || 'info';
  return `
    <div class="alert-card ${cls}" style="margin-bottom:10px;">
      <div class="alert-icon">${icons[cls] || '💡'}</div>
      <div>
        <div class="alert-title">${insight.title}</div>
        <div class="alert-desc">${insight.description}</div>
      </div>
    </div>
  `;
}

// ─── Programmes ───────────────────────────────────────────────────────────────
async function renderProgrammes() {
  const root = getRoot();
  root.innerHTML = `<div class="loading-pulse" style="color:var(--text-muted);font-size:14px;padding:40px 0;">Loading programmes…</div>`;
  const snap = await App.db.collection('programmes').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div><h1>Programmes</h1><p>${docs.length} programme(s) in the ecosystem</p></div>
        <button class="btn btn-primary" onclick="showCreateProgramme()">+ New Programme</button>
      </div>
      ${docs.length === 0 ? `<div class="empty-state"><div class="empty-state-icon">🎯</div><h3>No programmes yet</h3><p>Create the first programme to start matching companies and contributors.</p></div>` :
        `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;">
          ${docs.map(p => programmeCard(p)).join('')}
        </div>`
      }
    </div>
  `;
}

function programmeCard(p) {
  return `
    <div class="card fade-in" style="cursor:pointer;" onclick="showProgrammeDetail('${p.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
        <div style="font-size:15px;font-weight:700;">${p.name}</div>
        ${statusBadge(p.status)}
      </div>
      <div class="badge badge-purple" style="margin-bottom:10px;">${p.type || 'Programme'}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">${p.country || p.region || '—'} · ${(p.targetStages || []).join(', ') || 'All stages'}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;">
        ${(p.targetSectors || []).slice(0, 4).map(s => `<span class="badge badge-gray">${s}</span>`).join('')}
      </div>
      <div style="margin-top:14px;font-size:12px;color:var(--text-muted);">Created ${formatDate(p.createdAt)}</div>
    </div>
  `;
}

function showCreateProgramme() {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Create Programme</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group"><label class="form-label">Programme Name *</label><input class="form-input" id="p-name" placeholder="e.g. AI Startup Accelerator 2026"></div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Type</label>
        <select class="form-select" id="p-type"><option>Accelerator</option><option>Grant</option><option>Mentorship</option><option>Bootcamp</option><option>Challenge</option><option>SME Initiative</option></select>
      </div>
      <div class="form-group"><label class="form-label">Status</label>
        <select class="form-select" id="p-status"><option>Open</option><option>Active</option><option>Closed</option></select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Country / Region</label><input class="form-input" id="p-country" placeholder="Malaysia" value="Malaysia"></div>
      <div class="form-group"></div>
    </div>
    <div class="form-group"><label class="form-label">Target Sectors (Enter to add)</label><div class="tags-container" id="tags-sectors"><input class="tags-input" placeholder="AI, Fintech, Healthtech…"></div></div>
    <div class="form-group"><label class="form-label">Target Stages</label>
      <div class="chip-group" id="stage-group">
        ${['Idea','MVP','Pre-seed','Seed','Growth'].map(v => `<button class="chip-toggle" data-value="${v}" onclick="this.classList.toggle('selected')">${v}</button>`).join('')}
      </div>
    </div>
    <div class="form-group"><label class="form-label">Expected Outcomes (Enter to add)</label><div class="tags-container" id="tags-outcomes"><input class="tags-input" placeholder="Investor readiness, Cloud adoption…"></div></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="save-prog-btn" onclick="saveProgram()">Create Programme</button>
    </div>
  `);
  initTagsInput('tags-sectors');
  initTagsInput('tags-outcomes');
}

async function saveProgram() {
  const btn = document.getElementById('save-prog-btn');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  const payload = {
    name: document.getElementById('p-name').value,
    type: document.getElementById('p-type').value,
    status: document.getElementById('p-status').value,
    country: document.getElementById('p-country').value,
    targetSectors: document.getElementById('tags-sectors').getTags(),
    targetStages: [...document.querySelectorAll('#stage-group .selected')].map(el => el.dataset.value),
    expectedOutcomes: document.getElementById('tags-outcomes').getTags(),
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  };
  if (!payload.name) { toast('Programme name is required', 'error'); btn.innerHTML = 'Create Programme'; btn.disabled = false; return; }
  await App.db.collection('programmes').add(payload);
  toast('Programme created!', 'success');
  closeModal();
  renderProgrammes();
}

async function showProgrammeDetail(id) {
  const doc = await App.db.collection('programmes').doc(id).get();
  const p = { id, ...doc.data() };
  showModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${p.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${p.type} · ${p.country || '—'}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">
      ${statusBadge(p.status)}
      ${(p.targetSectors || []).map(s => `<span class="badge badge-gray">${s}</span>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;">
      <div><span style="color:var(--text-muted);">Target Stages:</span><br>${(p.targetStages || []).join(', ') || '—'}</div>
      <div><span style="color:var(--text-muted);">Expected Outcomes:</span><br>${(p.expectedOutcomes || []).join(', ') || '—'}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="closeModal();navigate('recommendations')">View Recommendations →</button>
    </div>
  `);
}

// ─── Companies ────────────────────────────────────────────────────────────────
async function renderCompanies() {
  const root = getRoot();
  root.innerHTML = `<div class="loading-pulse" style="color:var(--text-muted);font-size:14px;padding:40px 0;">Loading companies…</div>`;
  const snap = await App.db.collection('companies').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div><h1>Companies & Startups</h1><p>${docs.length} registered · ${docs.filter(d => d.verificationStatus === 'Verified').length} verified</p></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Company</th><th>Sector</th><th>Stage</th><th>Country</th>
              <th>Verification</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${docs.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🏢</div><h3>No companies yet</h3><p>Companies will appear here once they register.</p></div></td></tr>` :
                docs.map(c => `
                  <tr>
                    <td><div style="font-weight:600;color:var(--text-primary);">${c.companyName || c.name}</div><div style="font-size:11px;color:var(--text-muted);">${c.id}</div></td>
                    <td>${c.industry || c.sector || '—'}</td>
                    <td>${c.stage || '—'}</td>
                    <td>${c.country || '—'}</td>
                    <td>${statusBadge(c.verificationStatus)}</td>
                    <td>
                      <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="showCompanyDetail('${c.id}')">View</button>
                        ${c.verificationStatus !== 'Verified' ? `<button class="btn btn-sm btn-success" onclick="verifyCompany('${c.id}')">Verify</button>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="runAiMatchStartup('${c.id}')">✨ Match</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function verifyCompany(id) {
  await App.db.collection('companies').doc(id).update({ verificationStatus: 'Verified' });
  toast('Company verified!', 'success');
  renderCompanies();
}

async function showCompanyDetail(id) {
  const doc = await App.db.collection('companies').doc(id).get();
  const c = { id, ...doc.data() };
  showModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${c.companyName || c.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${c.industry || c.sector || '—'} · ${c.stage || '—'} · ${c.country || '—'}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">${statusBadge(c.verificationStatus)} ${(c.supportNeeds || []).map(n => `<span class="badge badge-purple">${n}</span>`).join('')}</div>
    <div style="font-size:13px;color:var(--text-secondary);">
      ${c.problemStatement ? `<div style="margin-bottom:10px;"><strong style="color:var(--text-muted);">Problem:</strong> ${c.problemStatement}</div>` : ''}
      ${c.productDescription ? `<div style="margin-bottom:10px;"><strong style="color:var(--text-muted);">Product:</strong> ${c.productDescription}</div>` : ''}
      ${c.traction ? `<div><strong style="color:var(--text-muted);">Traction:</strong> ${c.traction}</div>` : ''}
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="closeModal();runAiMatchStartup('${id}')">✨ Run AI Match</button>
    </div>
  `);
}

async function runAiMatchStartup(startupId) {
  toast('Running AI matching for startup…');
  try {
    const r = await callFn('recommend_programmes_for_startup', { startupId });
    toast(`Found ${r.recommendations?.length || 0} programme recommendations!`, 'success');
    navigate('recommendations');
  } catch (e) { toast('AI match failed: ' + e.message, 'error'); }
}

// ─── Contributors ─────────────────────────────────────────────────────────────
async function renderContributors() {
  const root = getRoot();
  root.innerHTML = `<div class="loading-pulse" style="color:var(--text-muted);font-size:14px;padding:40px 0;">Loading contributors…</div>`;
  const snap = await App.db.collection('contributors').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div><h1>Contributors</h1><p>${docs.length} mentors, partners & investors</p></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Name</th><th>Types</th><th>Expertise</th><th>Availability</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${docs.length === 0 ? `<tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">🤝</div><h3>No contributors yet</h3></div></td></tr>` :
                docs.map(c => `
                  <tr>
                    <td><div style="font-weight:600;color:var(--text-primary);">${c.name}</div></td>
                    <td>${(c.contributorTypes || []).map(t => `<span class="badge badge-purple" style="margin-right:4px;">${t}</span>`).join('')}</td>
                    <td>${(c.expertise || []).slice(0, 3).join(', ')}</td>
                    <td>${statusBadge(c.availability)}</td>
                    <td>${statusBadge(c.status)}</td>
                    <td>
                      <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="showContributorDetail('${c.id}')">View</button>
                        ${c.status !== 'Active' ? `<button class="btn btn-sm btn-success" onclick="approveContributor('${c.id}')">Approve</button>` : ''}
                        <button class="btn btn-sm btn-primary" onclick="runAiMatchContributor('${c.id}')">✨ Match</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

async function approveContributor(id) {
  await App.db.collection('contributors').doc(id).update({ status: 'Active' });
  toast('Contributor approved!', 'success');
  renderContributors();
}

async function showContributorDetail(id) {
  const doc = await App.db.collection('contributors').doc(id).get();
  const c = { id, ...doc.data() };
  showModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${c.name}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${(c.contributorTypes || []).join(', ')}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">${statusBadge(c.status)} ${statusBadge(c.availability)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;margin-bottom:16px;">
      <div><span style="color:var(--text-muted);">Expertise:</span><br>${(c.expertise || []).join(', ') || '—'}</div>
      <div><span style="color:var(--text-muted);">Country Coverage:</span><br>${(c.countryCoverage || []).join(', ') || '—'}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="closeModal();runAiMatchContributor('${id}')">✨ Match to Programmes</button>
    </div>
  `);
}

async function runAiMatchContributor(contributorId) {
  toast('Running AI matching for contributor…');
  try {
    const r = await callFn('recommend_contributor_to_programmes', { contributorId });
    toast(`Found ${r.recommendations?.length || 0} programme recommendations!`, 'success');
    navigate('recommendations');
  } catch (e) { toast('AI match failed: ' + e.message, 'error'); }
}
