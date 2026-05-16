import { useState } from 'react';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Spinner } from '../components/Shared';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState('');

  // AI Thresholds
  const [thresholds, setThresholds] = useState({
    minProgrammeFit: 60,
    minMentorFit: 65,
    minContributorFit: 55,
    autoApproveAbove: 85,
    autoRejectBelow: 30,
    semanticWeight: 20,
    riskPenalty: 5,
  });

  // Global Categories
  const [categories, setCategories] = useState({
    sectors: 'Healthtech, Fintech, EdTech, AgriTech, DeepTech, Clean Energy, Mobility, Cybersecurity, FoodTech, Logistics, SaaS, IoT, AI/ML, Blockchain, E-commerce',
    stages: 'Idea, Pre-seed, Seed, MVP, Growth, Series A, Scale-up',
    supportNeeds: 'Clinical pilot access, Regulatory guidance, Manufacturing partners, Banking partnerships, School pilots, Government grant access, Corporate sustainability pilots, Investor readiness, Municipality pilots, Infrastructure partners, Enterprise pilots, Distribution channels',
    contributorTypes: 'Mentor, Partner, Investor, Service Provider, Technical Provider',
    outcomeTypes: 'Investor readiness, Cloud adoption, CISO introductions, Compliance readiness, Municipality pilots, Infrastructure partners, Supply chain pilots, Manufacturing partners, Clinical pilot access, Regulatory guidance, Banking partnerships, Regulatory sandbox access',
  });

  // Platform
  const [platform, setPlatform] = useState({
    platformName: 'Lattice',
    supportEmail: 'support@lattice-platform.io',
    maxProgrammesPerOrg: 20,
    maxStartupsPerProgramme: 50,
    defaultContributorCapacity: 5,
    enableAuditLogging: true,
    enableEmailNotifications: false,
    maintenanceMode: false,
  });

  async function handleSave(section) {
    setSaving(true);
    try {
      await addDoc(collection(db, 'platformConfig'), {
        section,
        data: section === 'ai' ? thresholds : section === 'categories' ? categories : platform,
        updatedAt: serverTimestamp(),
      });
      setSaved(section);
      setTimeout(() => setSaved(''), 2000);
    } catch (e) {
      console.error('Save failed:', e);
      alert('Failed to save settings.');
    }
    setSaving(false);
  }

  const tabs = [
    { id: 'ai', label: 'AI Thresholds', icon: 'auto_awesome' },
    { id: 'categories', label: 'Global Categories', icon: 'category' },
    { id: 'platform', label: 'Platform Config', icon: 'settings' },
    { id: 'audit', label: 'Audit Log', icon: 'history' },
    { id: 'health', label: 'System Health', icon: 'monitor_heart' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 className="page-title">Platform Settings</h2>
        <p className="page-subtitle">Configure AI thresholds, global categories, and platform behaviour.</p>
      </div>

      <div className="filter-bar" style={{ marginBottom: 24 }}>
        {tabs.map((t) => (
          <button key={t.id} className={`btn ${activeTab === t.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => setActiveTab(t.id)}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* AI Thresholds */}
      {activeTab === 'ai' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>auto_awesome</span> AI Matching Thresholds</div>
          <p style={{ fontSize: 13, color: '#434655', marginBottom: 20 }}>These thresholds govern how AI recommendations are scored and filtered before reaching admin review.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {Object.entries(thresholds).map(([key, val]) => (
              <div key={key}>
                <label className="field-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</label>
                <input className="filter-input" type="number" value={val} onChange={(e) => setThresholds((prev) => ({ ...prev, [key]: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => handleSave('ai')} disabled={saving}>{saving ? 'Saving...' : 'Save Thresholds'}</button>
            {saved === 'ai' && <span style={{ color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      )}

      {/* Global Categories */}
      {activeTab === 'categories' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>category</span> Global Categories</div>
          <p style={{ fontSize: 13, color: '#434655', marginBottom: 20 }}>Comma-separated values used across the platform for classification and filtering.</p>
          {Object.entries(categories).map(([key, val]) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label className="field-label">{key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}</label>
              <textarea className="filter-input" value={val} onChange={(e) => setCategories((prev) => ({ ...prev, [key]: e.target.value }))} rows={2} style={{ width: '100%', marginTop: 4, resize: 'vertical', fontFamily: 'inherit' }} />
            </div>
          ))}
          <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => handleSave('categories')} disabled={saving}>{saving ? 'Saving...' : 'Save Categories'}</button>
            {saved === 'categories' && <span style={{ color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      )}

      {/* Platform Config */}
      {activeTab === 'platform' && (
        <div className="card">
          <div className="card-title" style={{ marginBottom: 20 }}><span className="material-symbols-outlined" style={{ color: '#737686' }}>settings</span> Platform Configuration</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div><label className="field-label">Platform Name</label><input className="filter-input" value={platform.platformName} onChange={(e) => setPlatform((p) => ({ ...p, platformName: e.target.value }))} style={{ width: '100%', marginTop: 4 }} /></div>
            <div><label className="field-label">Support Email</label><input className="filter-input" value={platform.supportEmail} onChange={(e) => setPlatform((p) => ({ ...p, supportEmail: e.target.value }))} style={{ width: '100%', marginTop: 4 }} /></div>
            <div><label className="field-label">Max Programmes Per Org</label><input className="filter-input" type="number" value={platform.maxProgrammesPerOrg} onChange={(e) => setPlatform((p) => ({ ...p, maxProgrammesPerOrg: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} /></div>
            <div><label className="field-label">Max Startups Per Programme</label><input className="filter-input" type="number" value={platform.maxStartupsPerProgramme} onChange={(e) => setPlatform((p) => ({ ...p, maxStartupsPerProgramme: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} /></div>
            <div><label className="field-label">Default Contributor Capacity</label><input className="filter-input" type="number" value={platform.defaultContributorCapacity} onChange={(e) => setPlatform((p) => ({ ...p, defaultContributorCapacity: Number(e.target.value) }))} style={{ width: '100%', marginTop: 4 }} /></div>
          </div>
          <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[{ key: 'enableAuditLogging', label: 'Enable Audit Logging' }, { key: 'enableEmailNotifications', label: 'Enable Email Notifications' }, { key: 'maintenanceMode', label: 'Maintenance Mode' }].map((toggle) => (
              <label key={toggle.key} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={platform[toggle.key]} onChange={(e) => setPlatform((p) => ({ ...p, [toggle.key]: e.target.checked }))} />
                <span>{toggle.label}</span>
              </label>
            ))}
          </div>
          <div style={{ marginTop: 20, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => handleSave('platform')} disabled={saving}>{saving ? 'Saving...' : 'Save Configuration'}</button>
            {saved === 'platform' && <span style={{ color: '#1b5e20', fontSize: 13, fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      )}

      {/* Audit Log */}
      {activeTab === 'audit' && <AuditLogTab />}

      {/* System Health */}
      {activeTab === 'health' && <SystemHealthTab />}
    </div>
  );
}

function AuditLogTab() {
  const logs = [
    { time: '2026-05-16 20:12:04', user: 'System Admin', action: 'Approved recommendation', target: 'FreightSense → Ahmad Razak', type: 'recommendation' },
    { time: '2026-05-16 20:10:33', user: 'System Admin', action: 'Generated programme recommendations', target: 'MediScan AI', type: 'ai' },
    { time: '2026-05-16 19:58:12', user: 'System Admin', action: 'Approved programme contributor', target: 'Dr. Sarah Lim → HealthTech Accelerator', type: 'pool' },
    { time: '2026-05-16 19:45:01', user: 'System Admin', action: 'Accepted application', target: 'AgroMesh → Food Systems Innovation Circle', type: 'application' },
    { time: '2026-05-16 19:30:22', user: 'AI Engine', action: 'Generated mentor recommendations', target: 'CareQueue (HealthTech Accelerator)', type: 'ai' },
    { time: '2026-05-16 19:15:08', user: 'System Admin', action: 'Updated programme status', target: 'Cyber Resilience Foundry → Active', type: 'programme' },
    { time: '2026-05-16 18:55:44', user: 'AI Engine', action: 'Computed embeddings', target: '24 startups, 22 contributors', type: 'ai' },
    { time: '2026-05-16 18:30:11', user: 'System Admin', action: 'Rejected recommendation', target: 'PatentBridge Asia → AI Startup Accelerator', type: 'recommendation' },
    { time: '2026-05-16 18:10:55', user: 'System Admin', action: 'Verified contributor', target: 'Google Cloud Malaysia', type: 'contributor' },
    { time: '2026-05-16 17:45:33', user: 'System Admin', action: 'Created programme', target: 'CleanTech Innovation Lab', type: 'programme' },
  ];

  const typeIcon = { recommendation: 'handshake', ai: 'auto_awesome', pool: 'group_add', application: 'description', programme: 'school', contributor: 'person' };

  return (
    <div className="table-container">
      <div className="table-header"><h3>Recent Platform Activity</h3><span className="table-meta">{logs.length} entries</span></div>
      <table className="data-table">
        <thead><tr><th></th><th>Timestamp</th><th>User</th><th>Action</th><th>Target</th></tr></thead>
        <tbody>{logs.map((l, i) => (
          <tr key={i}>
            <td><span className="material-symbols-outlined" style={{ fontSize: 16, color: '#737686' }}>{typeIcon[l.type] || 'info'}</span></td>
            <td className="cell-muted">{l.time}</td>
            <td className="cell-bold">{l.user}</td>
            <td>{l.action}</td>
            <td className="cell-muted">{l.target}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}

function SystemHealthTab() {
  const services = [
    { name: 'Firebase Firestore', status: 'operational', latency: '12ms', uptime: '99.99%' },
    { name: 'Cloud Functions (Python)', status: 'operational', latency: '340ms', uptime: '99.97%' },
    { name: 'Gemini AI API', status: 'operational', latency: '1.2s', uptime: '99.85%' },
    { name: 'Embedding Service', status: 'operational', latency: '180ms', uptime: '99.95%' },
    { name: 'Firebase Authentication', status: 'operational', latency: '45ms', uptime: '99.99%' },
    { name: 'Firebase Hosting', status: 'operational', latency: '8ms', uptime: '100%' },
  ];

  const statusColor = { operational: { bg: '#e8f5e9', text: '#1b5e20', dot: '#4caf50' }, degraded: { bg: '#fff3e0', text: '#e65100', dot: '#ff9800' }, down: { bg: '#ffdad6', text: '#ba1a1a', dot: '#ba1a1a' } };

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card"><div className="stat-card-label">Services</div><div className="stat-card-value accent">{services.length}</div><div className="stat-card-sub">All operational</div></div>
        <div className="stat-card"><div className="stat-card-label">Avg Latency</div><div className="stat-card-value">{Math.round(services.reduce((a, s) => a + parseFloat(s.latency), 0) / services.length)}ms</div></div>
        <div className="stat-card"><div className="stat-card-label">Platform Uptime</div><div className="stat-card-value">99.96%</div><div className="stat-card-sub">Last 30 days</div></div>
      </div>
      <div className="table-container">
        <div className="table-header"><h3>Service Status</h3></div>
        <table className="data-table">
          <thead><tr><th>Service</th><th>Status</th><th>Latency</th><th>Uptime</th></tr></thead>
          <tbody>{services.map((s) => {
            const c = statusColor[s.status];
            return (
              <tr key={s.name}>
                <td className="cell-bold">{s.name}</td>
                <td><span className="status-pill" style={{ background: c.bg, color: c.text }}><span className="status-dot" style={{ background: c.dot }}></span>{s.status}</span></td>
                <td>{s.latency}</td>
                <td className="cell-bold">{s.uptime}</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    </div>
  );
}
