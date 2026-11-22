/**
 * AgriSpectra Admin Portal
 * Real Firebase Auth (same project as the mobile app) + the backend's
 * real Firestore-backed /api/admin/* endpoints. Non-admin accounts are
 * rejected by the backend itself (bootstrap-admin email check in
 * authMiddleware.js) - this page has no client-side-only gating.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyBm_aZ_92IJwSuX4YHgWh6eca4ygQSH8eE',
  authDomain: 'water-irrigation-system-8aeeb.firebaseapp.com',
  projectId: 'water-irrigation-system-8aeeb',
  storageBucket: 'water-irrigation-system-8aeeb.firebasestorage.app',
  messagingSenderId: '160643566396',
  appId: '1:160643566396:web:62dedea727308c050d6c39'
};

const BACKEND_URL = 'https://agricultural-equipment-water-irrigation.onrender.com';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginWrap = document.getElementById('loginWrap');
const adminMain = document.getElementById('adminMain');
const adminLoading = document.getElementById('adminLoading');
const adminContent = document.getElementById('adminContent');
const signOutBtn = document.getElementById('signOutBtn');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const loginErrorMsg = document.getElementById('loginErrorMsg');

function showError(message) {
  loginErrorMsg.textContent = message;
  loginErrorMsg.style.display = 'block';
}

googleSignInBtn.addEventListener('click', async () => {
  loginErrorMsg.style.display = 'none';
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    showError(`Sign-in failed: ${err.message}`);
  }
});

signOutBtn.addEventListener('click', () => signOut(auth));

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function loadDashboard(idToken) {
  adminMain.classList.add('active');
  adminLoading.style.display = 'block';
  adminContent.style.display = 'none';

  const res = await fetch(`${BACKEND_URL}/api/admin/platform-overview`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
  });

  if (res.status === 401 || res.status === 403) {
    adminLoading.style.display = 'none';
    await signOut(auth);
    showError('This account does not have admin access to AgriSpectra Flow & Field.');
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

document.getElementById('downloadCsvBtn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  const idToken = await user.getIdToken();
  const res = await fetch(`${BACKEND_URL}/api/admin/scan-reports?format=csv&limit=1000`, {
    headers: { 'Authorization': `Bearer ${idToken}` }
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

onAuthStateChanged(auth, async (user) => {
  if (user) {
    loginWrap.style.display = 'none';
    signOutBtn.style.display = 'inline-flex';
    try {
      const idToken = await user.getIdToken();
      await loadDashboard(idToken);
    } catch (err) {
      adminLoading.textContent = `Error loading dashboard: ${err.message}`;
    }
  } else {
    loginWrap.style.display = 'flex';
    signOutBtn.style.display = 'none';
    adminMain.classList.remove('active');
  }
});
