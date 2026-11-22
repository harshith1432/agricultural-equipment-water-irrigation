/**
 * AgriSpectra Admin Portal
 * Username/password login (checked server-side against ADMIN_USERNAME /
 * ADMIN_PASSWORD env vars) backed by the real Firestore-backed
 * /api/admin/* endpoints. On success the server returns the enterprise
 * secret as a bearer token for subsequent requests; "remember me" persists
 * it in localStorage so the admin isn't prompted every visit.
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

function showLoggedOut() {
  loginWrap.style.display = 'flex';
  signOutBtn.style.display = 'none';
  adminMain.classList.remove('active');
}

function showLoggedIn() {
  loginWrap.style.display = 'none';
  signOutBtn.style.display = 'inline-flex';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideError();

  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${BACKEND_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const body = await res.json();

    if (!res.ok || !body.success) {
      showError(body.error || 'Invalid username or password.');
      return;
    }

    if (rememberMeCheckbox.checked) {
      localStorage.setItem(TOKEN_STORAGE_KEY, body.token);
    } else {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, body.token);
    }

    showLoggedIn();
    await loadDashboard(body.token);
  } catch (err) {
    showError(`Sign-in failed: ${err.message}`);
  }
});

signOutBtn.addEventListener('click', () => {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  showLoggedOut();
});

async function loadDashboard(token) {
  adminMain.classList.add('active');
  adminLoading.style.display = 'block';
  adminContent.style.display = 'none';

  const res = await fetch(`${BACKEND_URL}/api/admin/platform-overview`, {
    headers: { 'X-Enterprise-Secret': token, 'Authorization': `Bearer ${token}` }
  });

  if (res.status === 401 || res.status === 403) {
    adminLoading.style.display = 'none';
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    showLoggedOut();
    showError('Session expired or invalid. Please sign in again.');
    return;
  }

  if (!res.ok) {
    adminLoading.textContent = `Failed to load dashboard data (HTTP ${res.status}). Is the backend awake?`;
    return;
  }

  const { data } = await res.json();
  renderDashboard(data);
  adminLoading.style.display = 'none';
  adminContent.style.display = 'block';
}

function renderDashboard(data) {
  document.getElementById('kpiDownloads').textContent = data.totalDownloads ?? 0;
  document.getElementById('kpiUsers').textContent = data.totalRegisteredUsers ?? 0;
  document.getElementById('kpiFarmers').textContent = data.totalFarmers ?? 0;
  document.getElementById('kpiScans').textContent = data.totalScans ?? 0;
  document.getElementById('kpiEvents').textContent = data.totalAppEvents ?? 0;

  const roleEl = document.getElementById('roleBreakdown');
  const roles = data.roleBreakdown || {};
  roleEl.innerHTML = Object.keys(roles).length
    ? Object.entries(roles).map(([role, count]) => `<span class="breakdown-pill">${escapeHtml(role)}: ${count}</span>`).join('')
    : '<span class="admin-empty">No registered users yet</span>';

  const sourceEl = document.getElementById('scanSourceBreakdown');
  const sources = data.scansBySource || {};
  sourceEl.innerHTML = Object.entries(sources).map(([src, count]) => `<span class="breakdown-pill">${escapeHtml(src)}: ${count}</span>`).join('');

  const scansBody = document.getElementById('recentScansBody');
  const scans = data.recentScans || [];
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

  const eventsBody = document.getElementById('recentEventsBody');
  const events = data.recentAppEvents || [];
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

function getStoredToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
}

document.getElementById('downloadCsvBtn').addEventListener('click', async () => {
  const token = getStoredToken();
  if (!token) return;
  const res = await fetch(`${BACKEND_URL}/api/admin/scan-reports?format=csv&limit=1000`, {
    headers: { 'X-Enterprise-Secret': token, 'Authorization': `Bearer ${token}` }
  });
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

// Auto-login if a remembered token exists
const existingToken = getStoredToken();
if (existingToken) {
  showLoggedIn();
  loadDashboard(existingToken);
} else {
  showLoggedOut();
}
