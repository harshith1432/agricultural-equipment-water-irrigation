/**
 * AgriSpectra SuperAdmin & Enterprise Governance Dashboard
 * Designed for Platform Administrators, Corporate Agronomists, and Operations Directors.
 * Focus: Multi-tenant user directory, real-time role governance, account suspension,
 * telemetry chaos engineering injection, emergency broadcast dispatcher, and cross-role inspection.
 *
 * Hardened against DOM XSS and static code analysis vulnerabilities:
 * - Static module-level template constant (immune to CodeQL js/xss-through-dom)
 * - Zero dynamic string interpolation into innerHTML
 * - Safe DOM element construction with .textContent and element attributes
 * - Robust input handling preserving focus and state
 */
import { authService } from '../../firebase/authService.js';
import { mqttSimulator } from '../../hardware/mqttTelemetrySimulator.js';

// Static dashboard framework constant (zero variables, zero taint flows)
const SUPERADMIN_SHELL_HTML = `
  <!-- Top Enterprise Banner -->
  <div class="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-purple-700/40 relative overflow-hidden">
    <div class="absolute -right-8 -bottom-8 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5 mb-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-400/20 text-purple-300 border border-purple-400/30 uppercase tracking-widest">
            Enterprise Authority
          </span>
          <span class="text-xs text-purple-200/80 font-mono font-medium">Multi-Tenant Governance • 18 Enterprise Farms</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white">
          SuperAdmin Enterprise Operations Hub
        </h1>
        <p class="text-xs sm:text-sm text-purple-100/80 mt-1 max-w-2xl font-medium">
          Platform-wide user access governance, telemetry chaos simulation, cross-role inspection, and global hydraulic security locks.
        </p>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center flex-wrap gap-2.5">
        <button id="btn-admin-open-sim" class="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 shadow transition flex items-center gap-2 cursor-pointer active:scale-95">
          <svg class="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span>Telemetry Chaos Modal</span>
        </button>

        <button id="btn-admin-global-killswitch" class="min-h-[48px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-lg shadow-red-950/50 border border-red-400/50 transition flex items-center gap-2 cursor-pointer active:scale-95">
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          <span>GLOBAL SYSTEM KILLSWITCH</span>
        </button>
      </div>
    </div>
  </div>

  <!-- Toast Notification Container -->
  <div id="admin-toast-container"></div>

  <!-- Cross-Role Inspection Bar -->
  <div class="bg-white dark:bg-slate-850 rounded-2xl p-4 border border-stone-200 dark:border-slate-750 shadow-sm flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <span class="text-xs font-bold text-stone-700 dark:text-slate-300">Quick Switch Role View:</span>
      <span class="text-[11px] text-stone-500">Preview how each user role experiences their specialized dashboard:</span>
    </div>
    <div class="flex items-center flex-wrap gap-2">
      <button data-goto-role="Farm Owner" class="btn-cross-role min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold border border-amber-500/30 transition cursor-pointer">
        👨‍🌾 Farm Owner View
      </button>
      <button data-goto-role="Agronomist" class="btn-cross-role min-h-[40px] px-3.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 text-xs font-bold border border-emerald-500/30 transition cursor-pointer">
        🔬 Agronomist View
      </button>
      <button data-goto-role="Field Operator" class="btn-cross-role min-h-[40px] px-3.5 py-1.5 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-800 dark:text-blue-300 text-xs font-bold border border-blue-500/30 transition cursor-pointer">
        💧 Field Operator View
      </button>
    </div>
  </div>

  <!-- Enterprise Platform KPI Cards -->
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1">Total Users Roster</div>
      <div id="stat-total-users" class="text-3xl font-extrabold font-mono text-stone-900 dark:text-white">--</div>
      <div id="stat-active-now" class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1">● -- Active Sessions Now</div>
    </div>

    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1">Managed Hectares</div>
      <div id="stat-hectares" class="text-3xl font-extrabold font-mono text-purple-600 dark:text-purple-400">-- ha</div>
      <div id="stat-active-farms" class="text-[11px] text-stone-500 mt-1">Across -- Enterprise Farms</div>
    </div>

    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1">Hardware Health</div>
      <div id="stat-hardware-health" class="text-3xl font-extrabold font-mono text-emerald-600 dark:text-emerald-400">--%</div>
      <div id="stat-valves-count" class="text-[11px] text-stone-500 mt-1">-- Valves Monitored</div>
    </div>

    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider mb-1">Fleet Water Delivered</div>
      <div id="stat-liters" class="text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">-- L</div>
      <div class="text-[11px] text-stone-500 mt-1">Today's Fleet Volumetric Total</div>
    </div>
  </div>

  <!-- Telemetry Chaos Engineering Panel -->
  <div class="bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md">
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          Telemetry Chaos Injection & Disturbance Engine
        </h2>
        <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
          Live stress-testing of agronomic algorithms, FDR capacitive probe dynamics, and hydraulic overpressure.
        </p>
      </div>
      <span id="label-chaos-mode" class="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
        Current: NORMAL
      </span>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <button data-chaos-mode="NORMAL" class="btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer">
        <span class="text-base">⛅</span>
        <span>Normal Climate</span>
      </button>

      <button data-chaos-mode="HEATWAVE" class="btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer">
        <span class="text-base">☀️</span>
        <span>Heatwave (3x Evap)</span>
      </button>

      <button data-chaos-mode="RAIN" class="btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer">
        <span class="text-base">🌧️</span>
        <span>Rainstorm Recharge</span>
      </button>

      <button id="btn-inject-overpressure" class="min-h-[48px] p-3 rounded-2xl border bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border-rose-300 dark:border-rose-700 text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer">
        <span class="text-base">💥</span>
        <span>Inject Overpressure (>3.0 Bar)</span>
      </button>
    </div>
  </div>

  <!-- Emergency Field Broadcast Announcement Station -->
  <div class="bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md">
    <div class="mb-4">
      <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
        <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
        </svg>
        Emergency Field Broadcast Dispatcher
      </h2>
      <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
        Broadcast high-priority operational notices to all active field worker devices and farm owner dashboards.
      </p>
    </div>

    <form id="broadcast-form" class="flex flex-col sm:flex-row gap-3">
      <input type="text" id="broadcast-input" required placeholder="e.g. FROST WARNING: Temperature dropping below 0°C at 03:00. Solenoid pre-soak initiated." class="flex-1 min-h-[48px] px-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-stone-900 dark:text-white" />
      <button type="submit" class="min-h-[48px] px-6 py-2.5 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-950/30 transition shrink-0 cursor-pointer">
        Dispatch Broadcast Announcement
      </button>
    </form>
  </div>

  <!-- Multi-Tenant User Management & Role Governance Directory -->
  <div class="bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md">
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
      <div>
        <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-purple-600 dark:text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          Multi-Tenant User Governance & Role Management
        </h2>
        <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
          Live role assignment and permission enforcement across the enterprise roster.
        </p>
      </div>

      <!-- Role Filter & Search Bar -->
      <div class="flex items-center flex-wrap gap-2">
        <input type="text" id="admin-search-user" placeholder="Search grower or farm..." class="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-750 text-xs text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500" />
        <select id="admin-filter-role" class="min-h-[40px] px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-750 text-xs font-bold text-stone-800 dark:text-slate-200 focus:outline-none cursor-pointer">
          <option value="ALL">All Roles</option>
          <option value="Farm Owner">Farm Owner</option>
          <option value="Agronomist">Agronomist</option>
          <option value="Field Operator">Field Operator</option>
          <option value="SuperAdmin">SuperAdmin</option>
        </select>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-stone-200 dark:border-slate-750 text-stone-400 font-mono uppercase text-[10px]">
            <th class="py-2.5 px-3">Grower / User</th>
            <th class="py-2.5 px-3">Farm Organization</th>
            <th class="py-2.5 px-3">Current Role</th>
            <th class="py-2.5 px-3">Status</th>
            <th class="py-2.5 px-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody id="admin-users-tbody" class="divide-y divide-stone-100 dark:divide-slate-800 font-medium">
          <!-- Dynamically generated rows via safe DOM methods -->
        </tbody>
      </table>
      <div id="admin-users-empty" class="hidden text-center py-6 text-stone-400 text-xs font-medium">
        <!-- Populated via textContent -->
      </div>
    </div>
  </div>
`;

export function createSuperAdminDashboard({
  onGlobalEmergencyStop,
  onOpenSimModal,
  onNavigateToRole
}) {
  const container = document.createElement('div');
  container.className = "space-y-6 animate-fadeIn";

  let users = [...authService.enterpriseUsers];
  let stats = authService.getEnterpriseStats();
  let roleFilter = 'ALL';
  let searchQuery = '';

  // 1. Assign Pure Static Shell (100% Constant String, Zero Variable Interpolation)
  container.innerHTML = SUPERADMIN_SHELL_HTML;

  // ---------------------------------------------------------------------------
  // Safe Dynamic Rendering Functions (100% DOM-Safe & Zero HTML Injection)
  // ---------------------------------------------------------------------------

  function updateKPIs() {
    const totalUsersEl = container.querySelector('#stat-total-users');
    const activeNowEl = container.querySelector('#stat-active-now');
    const hectaresEl = container.querySelector('#stat-hectares');
    const activeFarmsEl = container.querySelector('#stat-active-farms');
    const healthEl = container.querySelector('#stat-hardware-health');
    const valvesEl = container.querySelector('#stat-valves-count');
    const litersEl = container.querySelector('#stat-liters');

    if (totalUsersEl) totalUsersEl.textContent = String(stats.totalUsers ?? 0);
    if (activeNowEl) activeNowEl.textContent = `● ${stats.activeNow ?? 0} Active Sessions Now`;
    if (hectaresEl) hectaresEl.textContent = `${(stats.totalHectares ?? 0).toLocaleString()} ha`;
    if (activeFarmsEl) activeFarmsEl.textContent = `Across ${stats.activeFarms ?? 0} Enterprise Farms`;
    if (healthEl) healthEl.textContent = `${stats.hardwareHealthIndex ?? 100}%`;
    if (valvesEl) valvesEl.textContent = `${stats.activeValvesCount ?? 0} Valves Monitored`;
    if (litersEl) litersEl.textContent = `${(stats.totalLitersDistributedToday ?? 0).toLocaleString()} L`;
  }

  function showToast(msg, isSuccess = true) {
    const toastContainer = container.querySelector('#admin-toast-container');
    if (!toastContainer) return;

    toastContainer.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `p-3.5 rounded-2xl ${isSuccess ? 'bg-emerald-600' : 'bg-rose-600'} text-white text-xs font-bold flex items-center justify-between shadow-lg animate-fadeIn mb-4`;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = msg;

    const badgeSpan = document.createElement('span');
    badgeSpan.className = "text-[10px] opacity-80 uppercase tracking-wider font-mono ml-3";
    badgeSpan.textContent = "System Confirmed";

    toast.appendChild(msgSpan);
    toast.appendChild(badgeSpan);
    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 3500);
  }

  function updateChaosButtonsUI() {
    const mode = mqttSimulator.weatherMode || 'NORMAL';
    const label = container.querySelector('#label-chaos-mode');
    if (label) label.textContent = `Current: ${mode}`;

    container.querySelectorAll('.btn-chaos-trigger').forEach(btn => {
      const btnMode = btn.getAttribute('data-chaos-mode');
      if (btnMode === mode) {
        if (mode === 'NORMAL') {
          btn.className = "btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer bg-emerald-600 text-white border-emerald-600 shadow";
        } else if (mode === 'HEATWAVE') {
          btn.className = "btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer bg-amber-600 text-white border-amber-600 shadow";
        } else if (mode === 'RAIN') {
          btn.className = "btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer bg-blue-600 text-white border-blue-600 shadow";
        }
      } else {
        btn.className = "btn-chaos-trigger min-h-[48px] p-3 rounded-2xl border text-xs font-bold transition flex flex-col items-center justify-center gap-1 cursor-pointer bg-stone-50 hover:bg-stone-100 dark:bg-slate-800 text-stone-800 dark:text-slate-200 border-stone-200 dark:border-slate-700";
      }
    });
  }

  function renderUserTable() {
    const tbody = container.querySelector('#admin-users-tbody');
    const emptyContainer = container.querySelector('#admin-users-empty');
    if (!tbody || !emptyContainer) return;

    tbody.innerHTML = '';

    const cleanQuery = (searchQuery || '').trim().toLowerCase();
    const filteredUsers = users.filter((u) => {
      const matchRole = roleFilter === 'ALL' || (u.role && u.role.toLowerCase() === roleFilter.toLowerCase());
      const matchSearch = !cleanQuery ||
        (u.displayName && u.displayName.toLowerCase().includes(cleanQuery)) ||
        (u.email && u.email.toLowerCase().includes(cleanQuery)) ||
        (u.farmName && u.farmName.toLowerCase().includes(cleanQuery));
      return matchRole && matchSearch;
    });

    if (filteredUsers.length === 0) {
      emptyContainer.classList.remove('hidden');
      emptyContainer.textContent = `No enterprise operators found matching "${searchQuery}" in role "${roleFilter}".`;
    } else {
      emptyContainer.classList.add('hidden');
      emptyContainer.textContent = '';
    }

    filteredUsers.forEach(user => {
      const tr = document.createElement('tr');
      const isActive = user.status === 'ACTIVE';

      // Cell 1: Grower / User
      const tdUser = document.createElement('td');
      tdUser.className = "py-3 px-3";
      const nameDiv = document.createElement('div');
      nameDiv.className = "font-bold text-stone-900 dark:text-white";
      nameDiv.textContent = user.displayName || 'Unknown User';
      const emailDiv = document.createElement('div');
      emailDiv.className = "text-[11px] text-stone-500 font-mono";
      emailDiv.textContent = user.email || '';
      tdUser.appendChild(nameDiv);
      tdUser.appendChild(emailDiv);

      // Cell 2: Farm Organization
      const tdFarm = document.createElement('td');
      tdFarm.className = "py-3 px-3 text-stone-700 dark:text-slate-300 font-medium";
      tdFarm.textContent = user.farmName || 'Unassigned Farm';

      // Cell 3: Current Role Dropdown
      const tdRole = document.createElement('td');
      tdRole.className = "py-3 px-3";
      const roleSelect = document.createElement('select');
      roleSelect.className = "select-user-role min-h-[36px] px-2.5 py-1 rounded-lg border border-stone-200 dark:border-slate-750 bg-stone-50 dark:bg-slate-800 text-xs font-bold text-stone-800 dark:text-slate-200 focus:outline-none cursor-pointer";
      roleSelect.dataset.userUid = user.uid;

      ['Farm Owner', 'Agronomist', 'Field Operator', 'SuperAdmin'].forEach(r => {
        const opt = document.createElement('option');
        opt.value = r;
        opt.textContent = r;
        if (r.toLowerCase() === (user.role || '').toLowerCase()) opt.selected = true;
        roleSelect.appendChild(opt);
      });

      roleSelect.addEventListener('change', async (e) => {
        const newRole = e.target.value;
        const res = await authService.updateUserRole(user.uid, newRole);
        if (res.success) {
          showToast(`Role updated to ${newRole} for user`);
          users = [...authService.enterpriseUsers];
          renderUserTable();
        }
      });
      tdRole.appendChild(roleSelect);

      // Cell 4: Status Badge
      const tdStatus = document.createElement('td');
      tdStatus.className = "py-3 px-3";
      const statusBadge = document.createElement('span');
      statusBadge.className = `px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
        isActive
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
          : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
      }`;
      statusBadge.textContent = user.status || 'ACTIVE';
      tdStatus.appendChild(statusBadge);

      // Cell 5: Actions Button
      const tdActions = document.createElement('td');
      tdActions.className = "py-3 px-3 text-right";
      const toggleBtn = document.createElement('button');
      toggleBtn.className = `btn-toggle-status px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
        isActive
          ? 'border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-700 dark:text-rose-300 dark:hover:bg-rose-950/40'
          : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40'
      }`;
      toggleBtn.textContent = isActive ? 'Suspend' : 'Reactivate';
      toggleBtn.dataset.toggleUid = user.uid;
      toggleBtn.addEventListener('click', async () => {
        const newStatus = await authService.toggleUserStatus(user.uid);
        showToast(`User status updated to ${newStatus}`);
        users = [...authService.enterpriseUsers];
        renderUserTable();
      });
      tdActions.appendChild(toggleBtn);

      tr.appendChild(tdUser);
      tr.appendChild(tdFarm);
      tr.appendChild(tdRole);
      tr.appendChild(tdStatus);
      tr.appendChild(tdActions);

      tbody.appendChild(tr);
    });
  }

  // ---------------------------------------------------------------------------
  // Event Attachments
  // ---------------------------------------------------------------------------

  // Cross-role inspection navigation
  container.querySelectorAll('.btn-cross-role').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-goto-role');
      if (onNavigateToRole) onNavigateToRole(role);
    });
  });

  // Chaos mode trigger buttons
  container.querySelectorAll('.btn-chaos-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-chaos-mode');
      mqttSimulator.setWeatherMode(mode);
      updateChaosButtonsUI();
      showToast(`Environmental mode set to: ${mode}`);
    });
  });

  // Overpressure surge trigger
  const surgeBtn = container.querySelector('#btn-inject-overpressure');
  if (surgeBtn) {
    surgeBtn.addEventListener('click', () => {
      mqttSimulator.mainlinePressureBar = 3.45;
      showToast("Chaos surge injected: Mainline Pressure spiked to 3.45 Bar!");
    });
  }

  // Broadcast Form
  const broadcastForm = container.querySelector('#broadcast-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = container.querySelector('#broadcast-input');
      if (input && input.value.trim()) {
        const msg = input.value.trim();
        await authService.broadcastAnnouncement(msg, "SuperAdmin Operations HQ");
        input.value = '';
        showToast(`Broadcast dispatched: "${msg.substring(0, 40)}..."`);
      }
    });
  }

  // Role Filter & Search Input (Preserves natural typing focus and zero DOM destruction)
  const searchInput = container.querySelector('#admin-search-user');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderUserTable();
    });
  }

  const roleSelect = container.querySelector('#admin-filter-role');
  if (roleSelect) {
    roleSelect.addEventListener('change', (e) => {
      roleFilter = e.target.value;
      renderUserTable();
    });
  }

  // Killswitch
  const killBtn = container.querySelector('#btn-admin-global-killswitch');
  if (killBtn && onGlobalEmergencyStop) {
    killBtn.addEventListener('click', () => onGlobalEmergencyStop());
  }

  // Simulator modal
  const simModalBtn = container.querySelector('#btn-admin-open-sim');
  if (simModalBtn && onOpenSimModal) {
    simModalBtn.addEventListener('click', () => onOpenSimModal());
  }

  // Initial render
  updateKPIs();
  updateChaosButtonsUI();
  renderUserTable();

  return container;
}
