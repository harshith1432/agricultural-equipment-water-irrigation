/**
 * AgriSpectra Admin Portal
 * Username/password login (checked server-side against ADMIN_USERNAME /
 * ADMIN_PASSWORD env vars, synced into Firestore) backed by real
 * Firestore/Firestore-durable endpoints. 4 tabs: Identity & RBAC,
 * Hardware Fleet, Hydraulic Safety, Commercial (honestly left empty -
 * not yet implemented, see tab content).
 */
const BACKEND_URL = 'https://agricultural-equipment-water-irrigation.onrender.com';
const TOKEN_STORAGE_KEY = 'agrispectra_admin_token';

const loginWrap = document.getElementById('loginWrap');
const adminMain = document.getElementById('adminMain');
const adminLoading = document.getElementById('adminLoading');
const adminContent = document.getElementById('adminContent');
const signOutBtn = document.getElementById('signOutBtn');
const loginForm = document.getElementById('loginForm');
const loginErrorMsg = document.getElementById('loginErrorMsg');
const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');

let currentToken = null;

function showError(message) {
  loginErrorMsg.textContent = message;
  loginErrorMsg.style.display = 'block';
}

function hideError() {
  loginErrorMsg.style.display = 'none';
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function authHeaders(token) {
  return { 'X-Enterprise-Secret': token, 'Authorization': `Bearer ${token}` };
}

async function apiFetch(path, { method = 'GET', body, timeoutMs = 45000 } = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...authHeaders(currentToken) },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

function showLoggedOut() {
  loginWrap.style.display = 'flex';
  signOutBtn.style.display = 'none';
  adminMain.classList.remove('active');
}

function showLoggedIn() {
  loginWrap.style.display = 'none';
  signOutBtn.style.display = 'inline-flex';
}

// ---------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const submitBtn = loginForm.querySelector('button[type="submit"]');
  const originalBtnText = submitBtn.textContent;

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in… (waking up server if idle)';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal
    });
    const body = await res.json();

    if (!res.ok || !body.success) {
      showError(body.error || 'Invalid username or password.');
      return;
    }

    currentToken = body.token;
    if (rememberMeCheckbox.checked) {
      localStorage.setItem(TOKEN_STORAGE_KEY, body.token);
    } else {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, body.token);
    }

    showLoggedIn();
    await loadDashboard();
  } catch (err) {
    if (err.name === 'AbortError') {
      showError('The server took too long to respond (it may be waking up from sleep). Please try again.');
    } else {
      showError(`Sign-in failed: ${err.message}`);
    }
  } finally {
    clearTimeout(timeoutId);
    submitBtn.disabled = false;
    submitBtn.textContent = originalBtnText;
  }
});

signOutBtn.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  currentToken = null;
  showLoggedOut();
});

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

// ---------------------------------------------------------------------------
// Tab Navigation
// ---------------------------------------------------------------------------
document.querySelectorAll('.admin-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// ---------------------------------------------------------------------------
// Dashboard Loading (Tab 1 + Tab 2 scan data)
// ---------------------------------------------------------------------------
let allUsers = [];

async function loadDashboard() {
  adminMain.classList.add('active');
  adminLoading.style.display = 'block';
  adminLoading.textContent = 'Loading platform data… (waking up the server if it was idle, this can take up to a minute)';
  adminContent.style.display = 'none';

  let overviewRes, usersRes, fleetRes, auditRes;
  try {
    [overviewRes, usersRes, fleetRes, auditRes] = await Promise.all([
      apiFetch('/api/admin/platform-overview'),
      apiFetch('/api/admin/users'),
      apiFetch('/api/admin/fleet'),
      apiFetch('/api/admin/audit-logs?limit=30')
    ]);
  } catch (err) {
    adminLoading.textContent = err.name === 'AbortError'
      ? 'The server took too long to respond. Please reload this page and try again.'
      : `Failed to load dashboard: ${err.message}`;
    return;
  }

  if ([overviewRes, usersRes, fleetRes, auditRes].some(r => r.status === 401 || r.status === 403)) {
    adminLoading.style.display = 'none';
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    showLoggedOut();
    showError('Session expired or invalid. Please sign in again.');
    return;
  }

  const overview = (await overviewRes.json()).data;
  const usersData = await usersRes.json();
  const fleetData = (await fleetRes.json()).data;
  const auditData = await auditRes.json();

  allUsers = usersData.data || [];

  renderIdentityTab(overview, usersData);
  renderFleetTab(overview, fleetData);
  renderHydraulicTab(auditData, overview);

  adminLoading.style.display = 'none';
  adminContent.style.display = 'block';
}

function renderIdentityTab(overview, usersData) {
  document.getElementById('kpiDownloads').textContent = overview.totalDownloads ?? 0;
  document.getElementById('kpiUsers').textContent = overview.totalRegisteredUsers ?? 0;
  document.getElementById('kpiFarmers').textContent = overview.totalFarmers ?? 0;
  document.getElementById('kpiScans').textContent = overview.totalScans ?? 0;
  document.getElementById('kpiEvents').textContent = overview.totalAppEvents ?? 0;

  const roleEl = document.getElementById('roleBreakdown');
  const roles = usersData.rolesBreakdown || {};
  roleEl.innerHTML = Object.entries(roles).map(([role, count]) =>
    `<span class="breakdown-pill">${escapeHtml(role)}: ${count}</span>`).join('') || '<span class="admin-empty">No data</span>';

  renderUserDirectory(allUsers);

  const eventsBody = document.getElementById('recentEventsBody');
  const events = overview.recentAppEvents || [];
  eventsBody.innerHTML = events.length
    ? events.map(e => `
        <tr>
          <td>${escapeHtml(e.eventType)}</td>
          <td>${escapeHtml(e.email || '—')}</td>
          <td>${escapeHtml(e.clientTimestamp || e.createdAt || '—')}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="3" class="admin-empty">No app events logged yet</td></tr>`;
}

function renderUserDirectory(users) {
  const body = document.getElementById('userDirectoryBody');
  body.innerHTML = users.length
    ? users.map(u => {
        const role = (u.role || 'unknown').toLowerCase();
        const roleClass = ['superadmin', 'farm_owner', 'agronomist', 'field_operator'].includes(role) ? role : 'unknown';
        return `
          <tr>
            <td>${escapeHtml(u.name || u.displayName || '—')}</td>
            <td>${escapeHtml(u.email || '—')}</td>
            <td><span class="role-badge ${roleClass}">${escapeHtml(u.role || 'unknown')}</span></td>
            <td>${escapeHtml((u.assignedFarms || []).join(', ') || '—')}</td>
            <td>${escapeHtml(u.lastActive ? new Date(u.lastActive).toLocaleString() : '—')}</td>
            <td><button class="btn btn-outline btn-xs role-change-btn" data-uid="${escapeHtml(u.uid || u.id)}" data-name="${escapeHtml(u.name || u.email)}" data-role="${escapeHtml(u.role)}">Change Role</button></td>
          </tr>
        `;
      }).join('')
    : `<tr><td colspan="6" class="admin-empty">No users found</td></tr>`;

  body.querySelectorAll('.role-change-btn').forEach(btn => {
    btn.addEventListener('click', () => openRoleModal(btn.dataset.uid, btn.dataset.name, btn.dataset.role));
  });
}

document.getElementById('userSearchInput').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allUsers.filter(u =>
    (u.name || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q));
  renderUserDirectory(filtered);
});

// ---------------------------------------------------------------------------
// Role Change Modal
// ---------------------------------------------------------------------------
const roleModalOverlay = document.getElementById('roleModalOverlay');
let roleModalTargetUid = null;

function openRoleModal(uid, name, currentRole) {
  roleModalTargetUid = uid;
  document.getElementById('roleModalUserLabel').textContent = `Changing role for: ${name}`;
  document.getElementById('roleModalSelect').value = (currentRole || 'field_operator').toLowerCase();
  roleModalOverlay.classList.add('open');
}

document.getElementById('roleModalCancelBtn').addEventListener('click', () => roleModalOverlay.classList.remove('open'));

document.getElementById('roleModalConfirmBtn').addEventListener('click', async () => {
  const newRole = document.getElementById('roleModalSelect').value;
  const btn = document.getElementById('roleModalConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    const res = await apiFetch('/api/admin/users/role', {
      method: 'POST',
      body: { userId: roleModalTargetUid, newRole, updatedBy: 'admin_dashboard' }
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      alert(body.error || 'Failed to update role.');
      return;
    }
    roleModalOverlay.classList.remove('open');
    await loadDashboard();
  } catch (err) {
    alert(`Failed to update role: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Change';
  }
});

// ---------------------------------------------------------------------------
// Tab 2: Hardware Fleet
// ---------------------------------------------------------------------------
function renderFleetTab(overview, fleetData) {
  const sourceEl = document.getElementById('scanSourceBreakdown');
  const sources = overview.scansBySource || {};
  sourceEl.innerHTML = Object.entries(sources).map(([src, count]) =>
    `<span class="breakdown-pill">${escapeHtml(src)}: ${count}</span>`).join('');

  const scansBody = document.getElementById('recentScansBody');
  const scans = overview.recentScans || [];
  scansBody.innerHTML = scans.length
    ? scans.map(s => `
        <tr>
          <td>${escapeHtml(s.scanId || s.id)}</td>
          <td>${escapeHtml(s.farmId || '—')}</td>
          <td>${escapeHtml(s.plantNumber || s.plantName || '—')}</td>
          <td>${escapeHtml(s.timestamp || s.syncedAt || '—')}</td>
          <td>${escapeHtml(s.chemometrics?.vitalityScore ?? '—')}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" class="admin-empty">No scans recorded yet</td></tr>`;

  const zoneGrid = document.getElementById('zoneGrid');
  const zones = fleetData?.zones || [];
  zoneGrid.innerHTML = zones.length
    ? zones.map(z => `
        <div class="zone-card">
          <h4>${escapeHtml(z.zoneName || z.plotId)}</h4>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
            <span style="font-size:0.78rem;color:var(--slate-500);">Valve ${escapeHtml(z.valve?.id || '')}</span>
            <span class="valve-state-badge ${escapeHtml(z.valve?.state || 'CLOSED')}">${escapeHtml(z.valve?.state || 'CLOSED')}</span>
          </div>
          <div style="font-size:0.78rem;color:var(--slate-500);">Delivered: ${(z.totalLitersDelivered ?? 0).toLocaleString()} L</div>
        </div>
      `).join('')
    : '<div class="admin-empty">No zones configured</div>';
}

document.getElementById('downloadCsvBtn').addEventListener('click', async () => {
  if (!currentToken) return;
  const res = await apiFetch('/api/admin/scan-reports?format=csv&limit=1000');
  if (!res.ok) {
    alert('Failed to download scan report CSV.');
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agrispectra_scan_reports_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---------------------------------------------------------------------------
// Tab 3: Hydraulic Safety
// ---------------------------------------------------------------------------
function renderHydraulicTab(auditData, overview) {
  const body = document.getElementById('auditLogBody');
  const logs = auditData?.data || [];
  body.innerHTML = logs.length
    ? logs.map(l => `
        <tr>
          <td>${escapeHtml(l.severity)}</td>
          <td>${escapeHtml(l.category)}</td>
          <td>${escapeHtml(l.action)}</td>
          <td>${escapeHtml(l.actor)}</td>
          <td>${escapeHtml(l.timestamp ? new Date(l.timestamp).toLocaleString() : '—')}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="5" class="admin-empty">No audit events yet</td></tr>`;
}

const killswitchModalOverlay = document.getElementById('killswitchModalOverlay');
document.getElementById('killswitchBtn').addEventListener('click', () => killswitchModalOverlay.classList.add('open'));
document.getElementById('killswitchModalCancelBtn').addEventListener('click', () => killswitchModalOverlay.classList.remove('open'));

document.getElementById('killswitchModalConfirmBtn').addEventListener('click', async () => {
  const btn = document.getElementById('killswitchModalConfirmBtn');
  btn.disabled = true;
  btn.textContent = 'Shutting down…';
  try {
    const res = await apiFetch('/api/admin/emergency-killswitch', {
      method: 'POST',
      body: { operatorId: 'admin_dashboard', reason: 'Manual 1-tap killswitch via Admin Portal' }
    });
    const body = await res.json();
    if (!res.ok || !body.success) {
      alert(body.error || 'Killswitch failed.');
      return;
    }
    document.getElementById('lastKillswitchInfo').textContent =
      `Last triggered: ${new Date(body.data.timestamp).toLocaleString()} — ${body.data.closedCount} zones closed.`;
    killswitchModalOverlay.classList.remove('open');
    await loadDashboard();
    document.querySelector('.admin-tab-btn[data-tab="hydraulic"]').click();
  } catch (err) {
    alert(`Killswitch request failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Confirm Shutdown';
  }
});

// ---------------------------------------------------------------------------
// Auto-login if a remembered token exists
// ---------------------------------------------------------------------------
const existingToken = getStoredToken();
if (existingToken) {
  currentToken = existingToken;
  showLoggedIn();
  loadDashboard();
} else {
  showLoggedOut();
}
