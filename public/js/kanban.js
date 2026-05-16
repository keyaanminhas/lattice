// ─── Recommendation Approval Board (Kanban) ────────────────────────────────
async function renderRecommendations() {
  const root = getRoot();
  root.innerHTML = `<div class="loading-pulse" style="color:var(--text-muted);font-size:14px;padding:40px 0;">Loading recommendations…</div>`;

  const snap = await App.db.collection('recommendations').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  const cols = [
    { key: 'Pending Approval', label: 'Pending Approval', color: 'var(--warning)' },
    { key: 'Approved',         label: 'Approved',         color: 'var(--success)' },
    { key: 'Rejected',         label: 'Rejected',         color: 'var(--danger)'  },
  ];

  root.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div><h1>Relationship Approval Board</h1><p>Review and approve AI-generated ecosystem relationship recommendations</p></div>
      </div>
      <div class="kanban-board" id="kanban-board">
        ${cols.map(col => {
          const cards = docs.filter(d => d.status === col.key);
          return `
            <div class="kanban-col">
              <div class="kanban-col-header">
                <div style="display:flex;align-items:center;gap:8px;">
                  <div style="width:8px;height:8px;border-radius:50%;background:${col.color};"></div>
                  <span class="kanban-col-title">${col.label}</span>
                </div>
                <span class="kanban-col-count">${cards.length}</span>
              </div>
              <div class="kanban-cards" id="col-${col.key.replace(/ /g,'-')}">
                ${cards.length === 0 ? `<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px;">No items</div>` :
                  cards.map(rec => kanbanCard(rec)).join('')
                }
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function kanbanCard(rec) {
  const score = rec.matchScore || 0;
  const typeColors = {
    'Startup-to-Mentor': '#6366f1',
    'Startup-to-Programme': '#10b981',
    'Mentor-to-Programme': '#f59e0b',
    'Partner-to-Programme': '#8b5cf6',
    'Investor-to-Programme': '#ef4444',
  };
  const color = typeColors[rec.recommendationType] || '#6366f1';

  return `
    <div class="kanban-card" onclick="showRecommendationDetail('${rec.id}')">
      <div class="kanban-card-type" style="color:${color};">${rec.recommendationType || 'Recommendation'}</div>
      <div class="kanban-card-title">${rec.sourceEntityId || '—'}</div>
      <div class="kanban-card-meta">→ ${rec.targetEntityId || '—'}</div>
      ${rec.programmeId ? `<div class="kanban-card-meta" style="margin-top:4px;">📋 ${rec.programmeId}</div>` : ''}
      <div class="score-bar" style="margin-top:10px;">
        <div class="score-fill" style="width:${score}%;background:linear-gradient(90deg,${color},${color}99);"></div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;">
        <span style="font-size:11px;color:var(--text-muted);">Match Score</span>
        <span style="font-size:13px;font-weight:700;color:${scoreColor(score)};">${score}%</span>
      </div>
      ${rec.status === 'Pending Approval' ? `
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button class="btn btn-success btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();decideRec('${rec.id}','Approved')">✓ Approve</button>
          <button class="btn btn-danger btn-sm" style="flex:1;justify-content:center;" onclick="event.stopPropagation();decideRec('${rec.id}','Rejected')">✕ Reject</button>
        </div>` : ''}
    </div>
  `;
}

async function showRecommendationDetail(id) {
  const doc = await App.db.collection('recommendations').doc(id).get();
  const r = { id, ...doc.data() };
  showModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${r.recommendationType}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Match Score: <strong style="color:${scoreColor(r.matchScore)};">${r.matchScore}%</strong></div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px;">
      <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border);">
        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">SOURCE</div>
        <div style="font-weight:600;">${r.sourceEntityId}</div>
        <div style="color:var(--text-muted);font-size:11px;">${r.sourceEntityType}</div>
      </div>
      <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border);">
        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">TARGET</div>
        <div style="font-weight:600;">${r.targetEntityId}</div>
        <div style="color:var(--text-muted);font-size:11px;">${r.targetEntityType}</div>
      </div>
    </div>
    ${r.explanation ? `
      <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:14px;margin-bottom:14px;">
        <div style="font-size:11px;color:var(--accent-light);font-weight:600;margin-bottom:6px;">🤖 AI EXPLANATION</div>
        <div style="font-size:13px;color:var(--text-secondary);">${r.explanation}</div>
      </div>` : ''}
    ${r.riskFlags && r.riskFlags.length ? `
      <div style="margin-bottom:14px;">
        <div style="font-size:11px;color:var(--warning);font-weight:600;margin-bottom:8px;">⚠️ RISK FLAGS</div>
        ${r.riskFlags.map(flag => `<div style="font-size:12px;color:var(--text-secondary);padding:4px 0;border-bottom:1px solid var(--border);">${flag}</div>`).join('')}
      </div>` : ''}
    ${statusBadge(r.status)}
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      ${r.status === 'Pending Approval' ? `
        <button class="btn btn-danger" onclick="decideRec('${id}','Rejected');closeModal()">✕ Reject</button>
        <button class="btn btn-success" onclick="decideRec('${id}','Approved');closeModal()">✓ Approve</button>` : ''}
    </div>
  `);
}

async function decideRec(id, decision) {
  try {
    await callFn('review_recommendation', { recommendationId: id, decision });
    toast(`Recommendation ${decision.toLowerCase()}!`, decision === 'Approved' ? 'success' : 'info');
    renderRecommendations();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

// ─── Active Relationships ─────────────────────────────────────────────────────
async function renderRelationships() {
  const root = getRoot();
  root.innerHTML = `<div class="loading-pulse" style="color:var(--text-muted);font-size:14px;padding:40px 0;">Loading relationships…</div>`;

  const snap = await App.db.collection('relationships').orderBy('createdAt', 'desc').get().catch(() => ({ docs: [] }));
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  root.innerHTML = `
    <div class="fade-in">
      <div class="page-header">
        <div><h1>Active Relationships</h1><p>${docs.length} total · ${docs.filter(d => d.status === 'Active').length} active</p></div>
      </div>
      <div class="card">
        <div class="table-wrap">
          <table>
            <thead><tr>
              <th>Type</th><th>Source</th><th>Target</th><th>Programme</th><th>Score</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${docs.length === 0 ? `<tr><td colspan="7"><div class="empty-state"><div class="empty-state-icon">🔗</div><h3>No relationships yet</h3><p>Approve recommendations to create active relationships.</p></div></td></tr>` :
                docs.map(r => `
                  <tr>
                    <td><span class="badge badge-purple">${(r.relationshipType || '').split('-').join(' ')}</span></td>
                    <td style="color:var(--text-primary);font-weight:500;">${r.sourceEntityId || '—'}</td>
                    <td>${r.targetEntityId || '—'}</td>
                    <td style="font-size:12px;color:var(--text-muted);">${r.programmeId || '—'}</td>
                    <td><span style="font-weight:700;color:${scoreColor(r.matchScore)};">${r.matchScore || '—'}%</span></td>
                    <td>${statusBadge(r.status)}</td>
                    <td>
                      <div style="display:flex;gap:6px;">
                        <button class="btn btn-sm btn-secondary" onclick="showRelationshipDetail('${r.id}')">View</button>
                        ${r.status === 'Active' ? `<button class="btn btn-sm btn-primary" onclick="showOutcomeForm('${r.id}')">Submit Outcome</button>` : ''}
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

async function showRelationshipDetail(id) {
  const doc = await App.db.collection('relationships').doc(id).get();
  const r = { id, ...doc.data() };
  const statuses = ['Active', 'Needs Review', 'Completed', 'Rejected', 'Expired'];

  showModal(`
    <div class="modal-header">
      <div>
        <div class="modal-title">${r.relationshipType}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Started ${formatDate(r.startDate)}</div>
      </div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;font-size:13px;">
      <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border);">
        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">SOURCE</div>
        <div style="font-weight:600;">${r.sourceEntityId}</div>
      </div>
      <div style="background:var(--bg-card);padding:12px;border-radius:8px;border:1px solid var(--border);">
        <div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">TARGET</div>
        <div style="font-weight:600;">${r.targetEntityId}</div>
      </div>
    </div>
    <div style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">${r.expectedOutcome ? `Expected: ${r.expectedOutcome}` : ''}</div>
    <div class="form-group">
      <label class="form-label">Update Status</label>
      <select class="form-select" id="rel-status-select">
        ${statuses.map(s => `<option ${s === r.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Close</button>
      <button class="btn btn-primary" onclick="updateRelStatus('${id}')">Update Status</button>
    </div>
  `);
}

async function updateRelStatus(id) {
  const newStatus = document.getElementById('rel-status-select').value;
  try {
    await callFn('update_relationship_status', { relationshipId: id, newStatus });
    toast('Status updated!', 'success');
    closeModal();
    renderRelationships();
  } catch (e) { toast('Error: ' + e.message, 'error'); }
}

function showOutcomeForm(relationshipId) {
  showModal(`
    <div class="modal-header">
      <div class="modal-title">Submit Engagement Outcome</div>
      <button class="modal-close" onclick="closeModal()">✕</button>
    </div>
    <div class="form-group"><label class="form-label">Outcome Achieved</label>
      <select class="form-select" id="oc-achieved"><option>Yes</option><option selected>Partial</option><option>No</option></select>
    </div>
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Company Rating (1-5)</label><input class="form-input" type="number" id="oc-s-rating" min="1" max="5" value="4"></div>
      <div class="form-group"><label class="form-label">Contributor Rating (1-5)</label><input class="form-input" type="number" id="oc-c-rating" min="1" max="5" value="4"></div>
    </div>
    <div class="form-group"><label class="form-label">Company Feedback</label><textarea class="form-textarea" id="oc-s-feedback" placeholder="How was the relationship from the startup side?" style="min-height:80px;"></textarea></div>
    <div class="form-group"><label class="form-label">Contributor Feedback</label><textarea class="form-textarea" id="oc-c-feedback" placeholder="How was the engagement from the contributor side?" style="min-height:80px;"></textarea></div>
    <div class="form-group"><label class="form-label">Admin Evaluation</label><textarea class="form-textarea" id="oc-admin" placeholder="Admin assessment and notes" style="min-height:80px;"></textarea></div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" id="oc-submit-btn" onclick="submitOutcomeForm('${relationshipId}')">Submit Outcome</button>
    </div>
  `);
}

async function submitOutcomeForm(relationshipId) {
  const btn = document.getElementById('oc-submit-btn');
  btn.innerHTML = '<span class="spinner"></span>'; btn.disabled = true;
  try {
    const r = await callFn('submit_outcome', {
      relationshipId,
      outcomeAchieved: document.getElementById('oc-achieved').value,
      startupRating: parseFloat(document.getElementById('oc-s-rating').value),
      contributorRating: parseFloat(document.getElementById('oc-c-rating').value),
      startupFeedback: document.getElementById('oc-s-feedback').value,
      contributorFeedback: document.getElementById('oc-c-feedback').value,
      adminEvaluation: document.getElementById('oc-admin').value,
    });
    toast(`Outcome submitted! AI lesson: "${r.aiLesson}"`, 'success');
    closeModal();
    renderRelationships();
  } catch (e) {
    toast('Error: ' + e.message, 'error');
    btn.innerHTML = 'Submit Outcome'; btn.disabled = false;
  }
}

// ─── My Profile ───────────────────────────────────────────────────────────────
async function renderProfile() {
  const root = getRoot();
  const account = App.currentAccount;
  let entity = null;

  try {
    if (account?.entityId && account?.entityType) {
      const col = account.entityType === 'company' ? 'companies' : account.entityType === 'contributor' ? 'contributors' : 'organisations';
      const d = await App.db.collection(col).doc(account.entityId).get();
      entity = d.exists ? d.data() : null;
    }
  } catch (e) {}

  root.innerHTML = `
    <div class="fade-in">
      <div class="page-header"><div><h1>My Profile</h1><p>Your account and entity details</p></div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
        <div class="card">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
            <div class="user-avatar" style="width:52px;height:52px;font-size:20px;">${(account?.displayName || 'U')[0]}</div>
            <div>
              <div style="font-size:16px;font-weight:700;">${account?.displayName || 'User'}</div>
              <div style="font-size:12px;color:var(--text-muted);">${account?.email || ''}</div>
              <div style="margin-top:6px;">${statusBadge(account?.status)}</div>
            </div>
          </div>
          <div style="display:grid;gap:10px;font-size:13px;">
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-muted);">Account Type</span>
              <span style="color:var(--text-primary);font-weight:600;">${account?.accountType || '—'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">
              <span style="color:var(--text-muted);">Entity</span>
              <span style="color:var(--text-primary);">${account?.entityId || '—'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:8px 0;">
              <span style="color:var(--text-muted);">Firebase UID</span>
              <span style="color:var(--text-muted);font-size:11px;">${account?.uid || '—'}</span>
            </div>
          </div>
        </div>
        <div class="card">
          <div style="font-size:15px;font-weight:700;margin-bottom:16px;">Entity Details</div>
          ${!entity ? `<div class="empty-state" style="padding:30px 0;"><div class="empty-state-icon">📋</div><p>No entity profile found.</p></div>` : `
            <div style="display:grid;gap:10px;font-size:13px;">
              ${Object.entries(entity).filter(([k]) => !['id','createdAt','updatedAt','embeddingVector'].includes(k)).slice(0,10).map(([k, v]) => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);">
                  <span style="color:var(--text-muted);text-transform:capitalize;">${k.replace(/([A-Z])/g,' $1').trim()}</span>
                  <span style="color:var(--text-primary);text-align:right;max-width:200px;">${Array.isArray(v) ? v.join(', ') : String(v ?? '—')}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}
