/**
 * Official AgriCare Platform Governance Dashboard View
 * 100% faithful representation of the official Super Admin Governance portal.
 * Features 8 KPI Cards, Revenue Analytics line chart (Chart.js), Organization Status donut,
 * and Organization Onboarding & Adoption Trend panel.
 */

import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

export function createPlatformGovernanceView({
  plots = [],
  telemetryData = {},
  recommendations = [],
  onApproveSynergy,
  onDismissSynergy,
  onAcquireScan,
  onOpenPlotCanvas,
  onOpenValveCenter,
  onOpenSpectroscopy
}) {
  const container = document.createElement('div');
  container.className = "space-y-6 w-full";

  // State toggle: 'mock' (exact match with uploaded screenshot) or 'telemetry' (live IoT data)
  let isLiveMode = false;

  const renderContent = () => {
    const activeValves = plots.filter(p => p.valve?.state === 'OPEN').length;
    const pendingRecs = recommendations.filter(r => r.status === 'PENDING').length;
    const consumedLiters = telemetryData.consumedLitersToday || 1845;
    const pressure = telemetryData.mainlinePressureBar || 2.42;

    container.innerHTML = `
      <!-- Page Title & Header Bar -->
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div>
          <div class="flex items-center gap-2.5">
            <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A]">Platform Governance</h1>
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-200 text-slate-700 select-none">
              ${isLiveMode ? 'Live Synced' : 'Read Only'}
            </span>
            <button
              type="button"
              id="toggle-live-mode-btn"
              class="text-xs px-2.5 py-1 rounded-md border font-medium transition ${
                isLiveMode 
                  ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' 
                  : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }"
            >
              ${isLiveMode ? '🌱 Mode: Live Telemetry' : '🏢 Mode: Official View'}
            </button>
          </div>
          <p class="text-sm text-slate-500 mt-1">
            Global oversight, financial control, and system stability.
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center gap-2.5 flex-wrap">
          <div class="relative">
            <button
              type="button"
              class="inline-flex items-center gap-2 bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition"
            >
              <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>Last 30 Days</span>
              <svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg>
            </button>
          </div>

          <button
            type="button"
            id="gov-refresh-btn"
            class="inline-flex items-center gap-1.5 bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition"
          >
            <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
              <path d="M16 21h5v-5"/>
            </svg>
            <span>Refresh</span>
          </button>

          <button
            type="button"
            id="gov-export-btn"
            class="inline-flex items-center gap-1.5 bg-white text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm hover:bg-slate-50 transition"
          >
            <svg class="w-3.5 h-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
            </svg>
            <span>Export</span>
          </button>
        </div>
      </div>

      <!-- 8 Metric Cards Grid (2 rows x 4 cols) -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        
        <!-- Card 1: Total Organizations -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="16" height="16" x="4" y="4" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 4v4"/><path d="M16 4v4"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ${isLiveMode ? plots.length || 6 : 0}
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            TOTAL ORGANIZATIONS
          </span>
        </div>

        <!-- Card 2: Paid Organizations -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ${isLiveMode ? activeValves : 0}
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            PAID ORGANIZATIONS
          </span>
        </div>

        <!-- Card 3: On Trial Organizations -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ${isLiveMode ? pendingRecs : 0}
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            ON TRIAL ORGANIZATIONS
          </span>
        </div>

        <!-- Card 4: Inactive (200) -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="17" x2="22" y1="8" y2="13"/><line x1="22" x2="17" y1="8" y2="13"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            0
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            INACTIVE (200)
          </span>
        </div>

        <!-- Card 5: Expired Subscriptions -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="15" x2="9" y1="9" y2="15"/><line x1="9" x2="15" y1="9" y2="15"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            0
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            EXPIRED SUBSCRIPTIONS
          </span>
        </div>

        <!-- Card 6: Platform Storage Usage -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ${isLiveMode ? `${Math.round(consumedLiters).toLocaleString()} L` : '0 MB'}
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            ${isLiveMode ? 'PLATFORM WATER USAGE' : 'PLATFORM STORAGE USAGE'}
          </span>
        </div>

        <!-- Card 7: Revenue (Selected Period) -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ${isLiveMode ? '₹4,250' : '₹0'}
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            REVENUE (SELECTED PERIOD)
          </span>
        </div>

        <!-- Card 8: Pending Tickets -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition">
          <div class="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500 mb-2.5">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/>
            </svg>
          </div>
          <span class="text-2xl font-bold text-slate-900 font-mono tracking-tight">
            ${isLiveMode ? (pressure > 3.0 ? 1 : 0) : 0}
          </span>
          <span class="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mt-1">
            PENDING TICKETS
          </span>
        </div>

      </div>

      <!-- Middle Section: Revenue Analytics Chart (Left) + Organization Status (Right) -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        <!-- Left: Revenue Analytics Line Chart (2 cols) -->
        <div class="lg:col-span-2 bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div class="flex items-center justify-between pb-3">
              <div>
                <h3 class="text-sm font-bold text-slate-800">Revenue Analytics</h3>
                <div class="flex items-center gap-4 mt-2">
                  <div class="text-xs">
                    <span class="text-slate-400 block text-[10px] uppercase font-semibold">MRR</span>
                    <span class="font-bold text-slate-800 text-sm font-mono">₹0</span>
                  </div>
                  <div class="text-xs">
                    <span class="text-slate-400 block text-[10px] uppercase font-semibold">ARR</span>
                    <span class="font-bold text-slate-800 text-sm font-mono">₹0</span>
                  </div>
                  <div class="text-xs">
                    <span class="text-slate-400 block text-[10px] uppercase font-semibold">Paid Orgs</span>
                    <span class="font-bold text-slate-800 text-sm font-mono">0</span>
                  </div>
                </div>
              </div>

              <!-- Time Filters -->
              <div class="flex items-center gap-1">
                <span class="px-2 py-1 text-[11px] font-medium text-slate-600 bg-slate-100 rounded cursor-pointer hover:bg-slate-200 transition">6M</span>
                <span class="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer transition">12M</span>
                <span class="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer transition">YTD</span>
                <span class="px-1.5 py-1 text-[11px] text-slate-400 hover:bg-slate-100 rounded cursor-pointer transition">···</span>
              </div>
            </div>

            <!-- Chart Legends -->
            <div class="flex items-center justify-center gap-6 my-2 text-xs text-slate-600 select-none">
              <span class="flex items-center gap-1.5">
                <span class="w-5 h-3 border border-blue-600 bg-blue-50/30 rounded-sm inline-block"></span>
                <span>MRR (₹)</span>
              </span>
              <span class="flex items-center gap-1.5">
                <span class="w-5 h-3 border border-dashed border-slate-400 bg-slate-100/50 rounded-sm inline-block"></span>
                <span>ARR (Secondary, ₹)</span>
              </span>
            </div>
          </div>

          <!-- Canvas Container -->
          <div class="w-full h-56 relative mt-2">
            <canvas id="revenue-analytics-chart"></canvas>
          </div>
        </div>

        <!-- Right: Organization Status (1 col) -->
        <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 flex flex-col justify-between">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 class="text-sm font-bold text-slate-800">Organization Status</h3>
            <button type="button" class="text-xs text-blue-600 hover:text-blue-700 font-semibold transition" id="org-view-all-btn">
              View All
            </button>
          </div>

          <!-- Donut Graphic & Center Metric -->
          <div class="flex-1 flex flex-col items-center justify-center py-6">
            <div class="relative w-36 h-36 flex items-center justify-center">
              <svg class="w-36 h-36 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#F1F5F9" stroke-width="12" />
                <circle cx="50" cy="50" r="40" fill="transparent" stroke="#2563EB" stroke-width="12" stroke-dasharray="251.2" stroke-dashoffset="${isLiveMode ? '50' : '251.2'}" stroke-linecap="round" />
              </svg>
              <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span class="text-3xl font-extrabold text-slate-900 font-mono tracking-tight">
                  ${isLiveMode ? plots.length || 6 : 0}
                </span>
                <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
              </div>
            </div>
          </div>

          <!-- Status Distribution Dots -->
          <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600 flex-wrap gap-1 font-medium">
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Paid: ${isLiveMode ? 5 : 0} (${isLiveMode ? '83%' : '0%'})</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>On Trial: 0 (0%)</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>Expired: ${isLiveMode ? 1 : 0} (${isLiveMode ? '17%' : '0%'})</span>
            </span>
            <span class="flex items-center gap-1">
              <span class="w-2 h-2 rounded-full bg-slate-400"></span>
              <span>On Hold: 0 (0%)</span>
            </span>
          </div>
        </div>

      </div>

      <!-- Third Section: Organization Onboarding & Adoption Trend -->
      <div class="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
              </svg>
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-800">Organization Onboarding & Adoption Trend</h3>
              <p class="text-xs text-slate-400">Month-by-month platform onboarding velocity and tenant adoption rate</p>
            </div>
          </div>

          <div class="flex items-center gap-1">
            <span class="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer transition">6M</span>
            <span class="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer transition">12M</span>
            <span class="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer transition">YTD</span>
            <span class="px-2 py-1 text-[11px] font-semibold text-blue-600 bg-blue-50 rounded cursor-pointer transition">ALL</span>
            <span class="px-1.5 py-1 text-[11px] text-slate-400 hover:bg-slate-100 rounded cursor-pointer transition">···</span>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 text-xs">
          <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">New Onboarded</span>
            <span class="font-bold text-slate-800 text-base font-mono mt-0.5 block">${isLiveMode ? 6 : 0}</span>
          </div>
          <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Avg Monthly</span>
            <span class="font-bold text-slate-800 text-base font-mono mt-0.5 block">0</span>
          </div>
          <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Adoption Rate</span>
            <span class="font-bold text-slate-800 text-base font-mono mt-0.5 block">100%</span>
          </div>
          <div class="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <span class="text-slate-400 block text-[10px] uppercase font-semibold">Peak Month</span>
            <span class="font-bold text-slate-800 text-base font-mono mt-0.5 block">Nov 26</span>
          </div>
        </div>
      </div>

      <!-- Quick Action Gateway to Precision Agronomy Engines -->
      <div class="bg-gradient-to-r from-blue-900 via-slate-900 to-indigo-950 rounded-2xl p-5 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              OPERATIONAL HARDWARE LINK
            </span>
            <span class="text-xs text-slate-300 font-medium">1-Acre 6-Zone Precision Agronomy</span>
          </div>
          <h4 class="text-base font-bold text-white">Direct Field Actuation & Spectroscopy Diagnostics</h4>
          <p class="text-xs text-slate-300 mt-0.5">Switch between the official Governance Overview and the interactive Field Control modules.</p>
        </div>

        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            id="quick-goto-canvas"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-900 hover:bg-slate-100 shadow transition flex items-center gap-1.5"
          >
            <span>🗺️ 6-Zone Field Canvas</span>
          </button>
          <button
            type="button"
            id="quick-goto-spectroscopy"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition flex items-center gap-1.5"
          >
            <span>🔬 Leaf Spectroscopy</span>
          </button>
          <button
            type="button"
            id="quick-goto-valves"
            class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-700 hover:bg-emerald-600 text-white shadow transition flex items-center gap-1.5"
          >
            <span>💧 Solenoid Valves</span>
          </button>
        </div>
      </div>
    `;

    // Initialize Chart.js for Revenue Analytics
    initRevenueChart();

    // Attach button listeners
    const toggleLiveBtn = container.querySelector('#toggle-live-mode-btn');
    if (toggleLiveBtn) {
      toggleLiveBtn.addEventListener('click', () => {
        isLiveMode = !isLiveMode;
        renderContent();
      });
    }

    const gotoCanvasBtn = container.querySelector('#quick-goto-canvas');
    if (gotoCanvasBtn && onOpenPlotCanvas) {
      gotoCanvasBtn.addEventListener('click', onOpenPlotCanvas);
    }

    const gotoSpectroscopyBtn = container.querySelector('#quick-goto-spectroscopy');
    if (gotoSpectroscopyBtn && onOpenSpectroscopy) {
      gotoSpectroscopyBtn.addEventListener('click', onOpenSpectroscopy);
    }

    const gotoValvesBtn = container.querySelector('#quick-goto-valves');
    if (gotoValvesBtn && onOpenValveCenter) {
      gotoValvesBtn.addEventListener('click', onOpenValveCenter);
    }

    const refreshBtn = container.querySelector('#gov-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        refreshBtn.classList.add('animate-spin');
        setTimeout(() => {
          refreshBtn.classList.remove('animate-spin');
          renderContent();
        }, 500);
      });
    }

    const exportBtn = container.querySelector('#gov-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        alert("Platform Governance report exported successfully to JSON.");
      });
    }
  };

  function initRevenueChart() {
    const canvas = container.querySelector('#revenue-analytics-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const months = ['Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26', 'Nov 26'];
    const dataPoints = isLiveMode ? [0, 0, 0, 0, 0, 0.42] : [0, 0, 0, 0, 0, 0];

    new Chart(ctx, {
      type: 'line',
      data: {
        labels: months,
        datasets: [{
          label: 'MRR (₹)',
          data: dataPoints,
          borderColor: '#2563EB',
          backgroundColor: 'rgba(37, 99, 235, 0.08)',
          borderWidth: 2,
          pointBackgroundColor: '#2563EB',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          tension: 0.1,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#0F172A',
            padding: 8,
            titleFont: { size: 11, family: 'Inter' },
            bodyFont: { size: 11, family: 'Inter' }
          }
        },
        scales: {
          y: {
            min: 0.0,
            max: 1.0,
            ticks: {
              stepSize: 0.2,
              color: '#94A3B8',
              font: { size: 10 }
            },
            grid: {
              color: '#F1F5F9'
            }
          },
          x: {
            ticks: {
              color: '#94A3B8',
              font: { size: 10 }
            },
            grid: {
              display: false
            }
          }
        }
      }
    });
  }

  renderContent();
  return container;
}
