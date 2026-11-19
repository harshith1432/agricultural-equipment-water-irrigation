/**
 * AgriSpectra Enterprise Admin & Entrepreneur Governance Dashboard
 * Company-level multi-tenant control center: Executive KPIs, User Management,
 * Field Announcements, and Global Emergency Solenoid Killswitch.
 *
 * Hardened against DOM XSS and static code analysis vulnerabilities:
 * - Zero dynamic string interpolation into innerHTML (prevents CodeQL js/xss-through-dom)
 * - Safe DOM element construction with .textContent and element attributes
 * - Robust input handling preserving focus and state
 */
import { authService } from '../firebase/authService.js';

export function createEnterpriseAdminModal({ onClose, onGlobalEmergencyStop }) {
  const overlay = document.createElement('div');
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn";

  let users = authService.enterpriseUsers || [];
  let stats = authService.getEnterpriseStats();
  let roleFilter = 'ALL';
  let searchQuery = '';

  // 1. Render Static Modal Framework (Zero Untrusted Data in innerHTML)
  overlay.innerHTML = `
    <div class="relative w-full max-w-5xl my-auto bg-[#F7F4EB] text-[#1E462A] rounded-3xl border border-[#E2D9CB] shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
      
      <!-- Header Bar -->
      <div class="bg-[#1E462A] text-white px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between gap-3 border-b border-emerald-900/40 shrink-0">
        <div class="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
          <div class="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-[#10B981] flex items-center justify-center text-white shadow-lg ring-4 ring-emerald-400/20 shrink-0">
            <svg class="w-5 h-5 sm:w-6 sm:h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>
            </svg>
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h2 class="text-base sm:text-xl font-extrabold tracking-tight text-white font-sans truncate">
                Enterprise Executive Hub
              </h2>
              <span class="px-2 sm:px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0">
                ENTREPRENEUR TIER
              </span>
            </div>
            <p class="text-[11px] sm:text-xs text-emerald-100/70 font-medium truncate">Multi-tenant agronomy network & global hydraulic governance</p>
          </div>
        </div>

        <!-- Close Modal Button -->
        <button id="admin-close-btn" class="min-w-[40px] min-h-[40px] sm:min-w-[48px] sm:min-h-[48px] flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer shrink-0" title="Close Executive Dashboard" aria-label="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <!-- Notification Toast Container -->
      <div id="admin-toast-container"></div>

      <!-- Scrollable Dashboard Content -->
      <div class="overflow-y-auto p-5 sm:p-7 space-y-6 flex-1">

        <!-- EXECUTIVE KPI CARDS -->
        <div class="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
          
          <!-- KPI 1: Total Teams -->
          <div class="bg-white p-4 rounded-2xl border border-[#E2D9CB] shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Teams</span>
              <span class="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center text-xs">👥</span>
            </div>
            <div id="kpi-total-users" class="text-2xl font-black text-[#1E462A] tracking-tight">--</div>
            <p class="text-[11px] text-stone-500 mt-1">Across 14 enterprise hubs</p>
          </div>

          <!-- KPI 2: Active Users Right Now -->
          <div class="bg-white p-4 rounded-2xl border border-[#E2D9CB] shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Active Now</span>
              <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            </div>
            <div id="kpi-active-now" class="text-2xl font-black text-emerald-700 tracking-tight">--</div>
            <p class="text-[11px] text-stone-500 mt-1">Field operators live</p>
          </div>

          <!-- KPI 3: Managed Hectares -->
          <div class="bg-white p-4 rounded-2xl border border-[#E2D9CB] shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Total Hectares</span>
              <span class="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center text-xs">🌾</span>
            </div>
            <div id="kpi-total-hectares" class="text-2xl font-black text-[#1E462A] tracking-tight">--</div>
            <p id="kpi-parcels" class="text-[11px] text-stone-500 mt-1">-- connected parcels</p>
          </div>

          <!-- KPI 4: Water Delivered Today -->
          <div class="bg-white p-4 rounded-2xl border border-[#E2D9CB] shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Liters Today</span>
              <span class="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center text-xs">💧</span>
            </div>
            <div id="kpi-liters-today" class="text-2xl font-black text-blue-800 tracking-tight">-- L</div>
            <p class="text-[11px] text-stone-500 mt-1">Solenoids G1–G6</p>
          </div>

          <!-- KPI 5: Hardware Health Index -->
          <div class="col-span-2 md:col-span-1 bg-white p-4 rounded-2xl border border-[#E2D9CB] shadow-sm">
            <div class="flex items-center justify-between mb-2">
              <span class="text-[11px] font-bold text-stone-500 uppercase tracking-wider">Mesh Uptime</span>
              <span class="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center text-xs font-mono font-bold">IoT</span>
            </div>
            <div id="kpi-mesh-health" class="text-2xl font-black text-teal-800 tracking-tight">--%</div>
            <p class="text-[11px] text-emerald-600 font-semibold mt-1">Zero latency drop</p>
          </div>

        </div>

        <!-- ENTERPRISE MASTER EMERGENCY & BROADCAST CONTROLS -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <!-- Broadcast Announcement Card -->
          <div class="bg-white p-5 rounded-3xl border border-[#E2D9CB] shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-700 flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/></svg>
                </div>
                <h3 class="text-sm font-bold text-[#1E462A]">Company Broadcast to Field Workers</h3>
              </div>
              <p class="text-xs text-stone-500 mb-3">Push immediate operational advisory or weather freeze warnings to all active terminal operators.</p>
              
              <div class="relative">
                <textarea id="broadcast-input" rows="2" placeholder="e.g. Frost warning tonight at 02:00. Solenoids G1-G6 automated pre-soak schedule active." class="w-full p-3 rounded-xl bg-stone-50 border border-[#E2D9CB] text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#10B981] resize-none"></textarea>
              </div>
            </div>

            <div class="mt-3 flex justify-end">
              <button id="send-broadcast-btn" class="min-h-[48px] px-5 py-2.5 rounded-xl bg-[#1E462A] hover:bg-[#12301A] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shadow-sm">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/></svg>
                <span>Dispatch All-Worker Broadcast</span>
              </button>
            </div>
          </div>

          <!-- Global Killswitch Control Card -->
          <div class="bg-rose-50/60 p-5 rounded-3xl border border-rose-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <div class="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                </div>
                <h3 class="text-sm font-bold text-rose-950">Global Emergency Hydraulic Killswitch</h3>
              </div>
              <p class="text-xs text-rose-800 leading-relaxed mb-2">
                Immediately transmits a reverse negative latching pulse across all registered farm valve gateways. Overrides active schedules and grounds mainline flow.
              </p>
              <div class="p-2.5 rounded-xl bg-white/70 border border-rose-200 text-[11px] text-rose-900 font-mono">
                Target: 6 Zones (G1–G6) + 14 Distributed Remote Field Gateways
              </div>
            </div>

            <div class="mt-4 flex justify-end">
              <button id="global-emergency-kill-btn" class="min-h-[48px] px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-extrabold flex items-center gap-2.5 shadow-md shadow-rose-900/20 transition cursor-pointer">
                <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10"/></svg>
                <span>EXECUTE GLOBAL ALL-FARM KILLSWITCH</span>
              </button>
            </div>
          </div>

        </div>

        <!-- USER MANAGEMENT ROSTER SECTION -->
        <div class="bg-white rounded-3xl border border-[#E2D9CB] p-5 sm:p-6 shadow-sm">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h3 class="text-base font-bold text-[#1E462A]">Enterprise User & Role Directory</h3>
              <p class="text-xs text-stone-500">Manage permissions, agronomy tiers, and account active states</p>
            </div>

            <!-- Search and Filter Bar -->
            <div class="flex flex-wrap items-center gap-2.5">
              <!-- Search Input -->
              <div class="relative">
                <input type="text" id="user-search-input" placeholder="Search by name, email, farm..." class="min-h-[48px] pl-9 pr-4 py-2 rounded-xl bg-stone-50 border border-[#E2D9CB] text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#10B981] w-48 sm:w-64" />
                <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none text-stone-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                </div>
              </div>

              <!-- Role Filter Chips -->
              <div class="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 overflow-x-auto" id="role-filters-group">
                <button class="role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] bg-[#1E462A] text-white shadow-sm" data-role="ALL">ALL</button>
                <button class="role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] text-stone-600 hover:text-stone-900" data-role="SuperAdmin">SuperAdmin</button>
                <button class="role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] text-stone-600 hover:text-stone-900" data-role="Farm Owner">Farm Owner</button>
                <button class="role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] text-stone-600 hover:text-stone-900" data-role="Agronomist">Agronomist</button>
                <button class="role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] text-stone-600 hover:text-stone-900" data-role="Operator">Operator</button>
              </div>
            </div>
          </div>

          <!-- Users Roster Table -->
          <div class="overflow-x-auto -mx-5 sm:mx-0">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="border-b border-stone-200 bg-stone-50/70 text-stone-500 uppercase font-mono text-[10px]">
                  <th class="py-3 px-4 rounded-l-xl">User & Contact</th>
                  <th class="py-3 px-4">Farm / Enterprise Unit</th>
                  <th class="py-3 px-4">Role Badge</th>
                  <th class="py-3 px-4">Status</th>
                  <th class="py-3 px-4 text-right rounded-r-xl">Governance Actions</th>
                </tr>
              </thead>
              <tbody id="enterprise-users-tbody" class="divide-y divide-stone-100">
                <!-- User rows dynamically injected via safe DOM operations -->
              </tbody>
            </table>

            <div id="enterprise-users-empty" class="hidden text-center py-8 text-stone-400 text-xs font-medium">
              <!-- Empty state message populated via textContent -->
            </div>
          </div>

        </div>

      </div>

      <!-- Footer Bar -->
      <div class="bg-stone-100 px-6 py-3.5 border-t border-[#E2D9CB] flex items-center justify-between text-xs text-stone-500 shrink-0">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>Enterprise Gateway Online (AES-256 Cloud Sync)</span>
        </div>
        <div>
          <span>AgriSpectra SaaS v1.0 • Enterprise License</span>
        </div>
      </div>

    </div>
  `;

  // ---------------------------------------------------------------------------
  // Safe Dynamic Rendering Functions (100% DOM-Safe & Zero HTML Injection)
  // ---------------------------------------------------------------------------

  function updateKPIs(currentStats) {
    if (!currentStats) return;
    const kpiTotalUsers = overlay.querySelector('#kpi-total-users');
    const kpiActiveNow = overlay.querySelector('#kpi-active-now');
    const kpiTotalHectares = overlay.querySelector('#kpi-total-hectares');
    const kpiParcels = overlay.querySelector('#kpi-parcels');
    const kpiLiters = overlay.querySelector('#kpi-liters-today');
    const kpiHealth = overlay.querySelector('#kpi-mesh-health');

    if (kpiTotalUsers) kpiTotalUsers.textContent = String(currentStats.totalUsers ?? 0);
    if (kpiActiveNow) kpiActiveNow.textContent = String(currentStats.activeNow ?? 0);
    if (kpiTotalHectares) kpiTotalHectares.textContent = (currentStats.totalHectares ?? 0).toLocaleString();
    if (kpiParcels) kpiParcels.textContent = `${currentStats.totalParcels ?? 0} connected parcels`;
    if (kpiLiters) kpiLiters.textContent = `${(currentStats.totalLitersDistributedToday ?? 0).toLocaleString()} L`;
    if (kpiHealth) kpiHealth.textContent = `${currentStats.hardwareHealthIndex ?? 100}%`;
  }

  function showToast(msg, isSuccess = true) {
    const container = overlay.querySelector('#admin-toast-container');
    if (!container) return;

    container.innerHTML = '';
    const toast = document.createElement('div');
    toast.className = `px-6 py-2.5 ${isSuccess ? 'bg-emerald-700' : 'bg-rose-700'} text-white text-xs font-bold flex items-center justify-between animate-fadeIn shrink-0`;

    const msgSpan = document.createElement('span');
    msgSpan.textContent = msg;

    const closeBtn = document.createElement('button');
    closeBtn.className = "text-white/80 hover:text-white font-bold ml-4";
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => toast.remove());

    toast.appendChild(msgSpan);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) toast.remove();
    }, 3500);
  }

  function updateFilterButtonsUI() {
    const filterButtons = overlay.querySelectorAll('.role-filter-btn');
    filterButtons.forEach((btn) => {
      const btnRole = btn.getAttribute('data-role');
      if (roleFilter.toLowerCase() === btnRole.toLowerCase()) {
        btn.className = "role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] bg-[#1E462A] text-white shadow-sm";
      } else {
        btn.className = "role-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer min-h-[36px] text-stone-600 hover:text-stone-900";
      }
    });
  }

  function renderUserRoster() {
    const tbody = overlay.querySelector('#enterprise-users-tbody');
    const emptyContainer = overlay.querySelector('#enterprise-users-empty');
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
      emptyContainer.textContent = `No users found matching "${searchQuery}" in role "${roleFilter}".`;
    } else {
      emptyContainer.classList.add('hidden');
      emptyContainer.textContent = '';
    }

    filteredUsers.forEach((u) => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-stone-50/80 transition";

      const isSuspended = u.status === 'SUSPENDED';
      const rawDisplayName = u.displayName || 'Unknown User';
      const initials = rawDisplayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';

      // Cell 1: User & Contact with Avatar
      const tdUser = document.createElement('td');
      tdUser.className = "py-3 px-4";
      const userFlex = document.createElement('div');
      userFlex.className = "flex items-center gap-3";

      if (u.photoURL && (u.photoURL.startsWith('https://') || u.photoURL.startsWith('http://'))) {
        const img = document.createElement('img');
        img.src = u.photoURL;
        img.alt = rawDisplayName;
        img.className = "w-9 h-9 rounded-xl object-cover ring-2 ring-stone-200";
        userFlex.appendChild(img);
      } else {
        const avatarDiv = document.createElement('div');
        avatarDiv.className = "w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold flex items-center justify-center text-xs shadow-sm";
        avatarDiv.textContent = initials;
        userFlex.appendChild(avatarDiv);
      }

      const textWrap = document.createElement('div');
      const nameDiv = document.createElement('div');
      nameDiv.className = "font-bold text-stone-900 flex items-center gap-1.5";
      const nameSpan = document.createElement('span');
      nameSpan.textContent = rawDisplayName;
      nameDiv.appendChild(nameSpan);

      if (u.role === 'SuperAdmin') {
        const starSpan = document.createElement('span');
        starSpan.title = "Platform Administrator";
        starSpan.className = "text-amber-500 text-xs";
        starSpan.textContent = "★";
        nameDiv.appendChild(starSpan);
      }

      const emailDiv = document.createElement('div');
      emailDiv.className = "text-[11px] text-stone-500 font-mono";
      emailDiv.textContent = u.email || '';

      textWrap.appendChild(nameDiv);
      textWrap.appendChild(emailDiv);
      userFlex.appendChild(textWrap);
      tdUser.appendChild(userFlex);

      // Cell 2: Farm Assignment
      const tdFarm = document.createElement('td');
      tdFarm.className = "py-3 px-4 font-medium text-stone-700";
      const farmNameDiv = document.createElement('div');
      farmNameDiv.textContent = u.farmName || 'Unassigned Farm';
      const hectaresDiv = document.createElement('div');
      hectaresDiv.className = "text-[10px] text-stone-400 font-mono";
      hectaresDiv.textContent = `${u.hectaresManaged || 15} Hectares Managed`;
      tdFarm.appendChild(farmNameDiv);
      tdFarm.appendChild(hectaresDiv);

      // Cell 3: Role Badge
      const tdRole = document.createElement('td');
      tdRole.className = "py-3 px-4";
      const badge = document.createElement('span');
      badge.className = `inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold ${
        u.role === 'SuperAdmin'
          ? 'bg-purple-100 text-purple-900 border border-purple-200'
          : (u.role === 'Farm Owner'
            ? 'bg-amber-100 text-amber-900 border border-amber-200'
            : (u.role === 'Agronomist'
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
              : 'bg-blue-100 text-blue-900 border border-blue-200'))
      }`;
      badge.textContent = u.role || 'Operator';
      tdRole.appendChild(badge);

      // Cell 4: Account Status
      const tdStatus = document.createElement('td');
      tdStatus.className = "py-3 px-4";
      const statusBadge = document.createElement('span');
      statusBadge.className = `inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${
        isSuspended ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
      }`;
      const dot = document.createElement('span');
      dot.className = `w-1.5 h-1.5 rounded-full ${isSuspended ? 'bg-rose-600' : 'bg-emerald-600'}`;
      const statusText = document.createTextNode(u.status || 'ACTIVE');
      statusBadge.appendChild(dot);
      statusBadge.appendChild(statusText);
      tdStatus.appendChild(statusBadge);

      // Cell 5: Actions
      const tdActions = document.createElement('td');
      tdActions.className = "py-3 px-4 text-right";
      const actionWrap = document.createElement('div');
      actionWrap.className = "inline-flex items-center gap-2 justify-end";

      // Role switcher dropdown
      const select = document.createElement('select');
      select.className = "user-role-select text-xs font-semibold px-2 py-1.5 rounded-lg border border-stone-300 bg-white hover:border-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-h-[38px] cursor-pointer";
      select.dataset.uid = u.uid;
      ['SuperAdmin', 'Farm Owner', 'Agronomist', 'Operator'].forEach(roleOption => {
        const opt = document.createElement('option');
        opt.value = roleOption;
        opt.textContent = roleOption;
        if (u.role === roleOption) opt.selected = true;
        select.appendChild(opt);
      });
      select.addEventListener('change', async (e) => {
        const newRole = e.target.value;
        await authService.updateUserRole(u.uid, newRole);
        showToast(`Role updated to ${newRole}`);
      });

      // Suspend / Activate toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.className = `toggle-status-btn min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
        isSuspended
          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
          : 'bg-white hover:bg-rose-50 text-rose-700 border-rose-300'
      }`;
      toggleBtn.textContent = isSuspended ? 'Activate' : 'Suspend';
      toggleBtn.dataset.uid = u.uid;
      toggleBtn.addEventListener('click', async () => {
        const newStatus = await authService.toggleUserStatus(u.uid);
        showToast(`User status changed to ${newStatus}`);
      });

      actionWrap.appendChild(select);
      actionWrap.appendChild(toggleBtn);
      tdActions.appendChild(actionWrap);

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

  // Live Unsubscribe handle
  const unsubscribeUsers = typeof authService.subscribeEnterpriseUsers === 'function'
    ? authService.subscribeEnterpriseUsers((updatedUsers) => {
        users = updatedUsers;
        stats = authService.getEnterpriseStats();
        updateKPIs(stats);
        renderUserRoster();
      })
    : () => {};

  // Close Button
  const closeBtn = overlay.querySelector('#admin-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      unsubscribeUsers();
      if (onClose) onClose();
    });
  }

  // Search Input (Preserves natural typing focus and zero DOM destruction)
  const searchInput = overlay.querySelector('#user-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderUserRoster();
    });
  }

  // Role Filter Chips
  const filterButtons = overlay.querySelectorAll('.role-filter-btn');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      roleFilter = btn.getAttribute('data-role');
      updateFilterButtonsUI();
      renderUserRoster();
    });
  });

  // Broadcast Message Dispatcher
  const broadcastInput = overlay.querySelector('#broadcast-input');
  const sendBroadcastBtn = overlay.querySelector('#send-broadcast-btn');
  if (sendBroadcastBtn && broadcastInput) {
    sendBroadcastBtn.addEventListener('click', async () => {
      const message = broadcastInput.value.trim();
      if (!message) {
        showToast('Please type a message before broadcasting.', false);
        return;
      }
      await authService.broadcastAnnouncement(message);
      showToast('Company broadcast dispatched to all field terminals!');
      broadcastInput.value = '';
    });
  }

  // Global Emergency Killswitch
  const killBtn = overlay.querySelector('#global-emergency-kill-btn');
  if (killBtn) {
    killBtn.addEventListener('click', () => {
      const confirmed = window.confirm(
        "⚠️ CRITICAL ACTION: Are you sure you want to execute the GLOBAL ALL-FARM SOLENOID KILLSWITCH? This will immediately de-energize and close all latching valves G1-G6 across all enterprise plots."
      );
      if (confirmed) {
        if (onGlobalEmergencyStop) onGlobalEmergencyStop();
        showToast("GLOBAL ALL-FARM KILLSWITCH ACTIVATED: All valves de-energized.");
      }
    });
  }

  // Initial population of KPIs and user directory
  updateKPIs(stats);
  renderUserRoster();

  return overlay;
}
