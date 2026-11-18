/**
 * Native Mobile App View
 * Full-screen, edge-to-edge mobile application for Android / iOS / Capacitor.
 * Eliminates fake phone shells, fake clocks, and desktop banners to provide
 * an authentic, high-performance, native precision agriculture mobile experience.
 */

import { createCropOverviewScreen } from './CropOverviewScreen.js';
import { createFieldZoneScreen } from './FieldZoneScreen.js';
import { createSpectroscopyStudio } from './SpectroscopyStudio.js';
import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { ttsEngine } from '../audio/voiceReadoutTTS.js';
import { INITIAL_FARM_DATA } from '../firebase/mockFirestore.js';

export function createNativeMobileAppView({
  plots = [],
  selectedPlotId = "plot-1",
  latestScanAnalysis = null,
  telemetryMetrics = {},
  actionRecommendations = [],
  onSelectPlot,
  onAcquireScan,
  onActuateValve,
  onOpenCalibration,
  onEmergencyStop,
  onOpenSimModal,
  onOpenEnterpriseAdmin,
  currentUser = null
}) {
  const container = document.createElement('div');
  container.className = "native-mobile-app w-full min-h-screen bg-[#07160c] text-white flex flex-col relative overflow-x-hidden selection:bg-lime-500 selection:text-slate-950";

  // Fixed aerial farmland background with ambient gradient
  container.style.backgroundImage = "url('/assets/drone-farmland-bg.svg')";
  container.style.backgroundSize = "cover";
  container.style.backgroundAttachment = "fixed";
  container.style.backgroundPosition = "center";

  // Ambient dark overlay
  const ambientOverlay = document.createElement('div');
  ambientOverlay.className = "fixed inset-0 bg-gradient-to-b from-[#07160c]/85 via-[#07160c]/70 to-[#07160c]/95 pointer-events-none z-0";
  container.appendChild(ambientOverlay);

  // App Navigation State
  let activeTab = 'crop'; // 'crop' | 'field' | 'scan' | 'valves' | 'overview'
  let currentPlotId = selectedPlotId || "plot-1";
  const activePlots = (plots && plots.length > 0) ? plots : Object.values(INITIAL_FARM_DATA.plots || {});

  // Main UI shell containers
  const topBar = document.createElement('header');
  topBar.className = "sticky top-0 z-30 w-full px-4 pt-3 pb-2.5 flex items-center justify-between bg-[#07160c]/90 backdrop-blur-xl border-b border-white/10 shadow-lg select-none";

  const scrollBody = document.createElement('main');
  scrollBody.className = "relative z-10 flex-1 w-full max-w-lg mx-auto px-3.5 pt-3 pb-28 overflow-y-auto no-scrollbar scroll-smooth";

  const dockContainer = document.createElement('nav');
  dockContainer.className = "fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-1 flex justify-center pointer-events-none select-none";

  function getSelectedPlot() {
    return activePlots.find(p => p.id === currentPlotId) || activePlots[0] || {
      id: "plot-1",
      plotNumber: 1,
      name: "Zone 1 - Potato Field Zone",
      crop: "Potato Crop",
      stage: "Tuber Bulking & Maturity"
    };
  }

  function renderTopBar() {
    const plot = getSelectedPlot();
    const isBleConnected = leafClipDevice.isConnected;

    topBar.innerHTML = `
      <!-- Brand & Zone Selector -->
      <div class="flex items-center gap-2.5">
        <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center shadow-md shadow-emerald-950/60 border border-lime-300/40 shrink-0">
          <svg class="w-4 h-4 text-slate-950 font-bold" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M7 20h10"/>
            <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
            <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4-.1 5.5.8z"/>
          </svg>
        </div>

        <div class="flex flex-col">
          <div class="flex items-center gap-1.5">
            <span class="text-xs font-black tracking-tight text-white font-sans">AGRISPECTRA</span>
            <span class="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-lime-400/20 text-lime-300 border border-lime-400/30">
              PRO
            </span>
          </div>
          
          <!-- Interactive Zone Picker Button -->
          <div class="relative">
            <button 
              type="button" 
              id="mobile-zone-picker-btn"
              class="flex items-center gap-1 text-[11px] font-mono text-emerald-300 hover:text-white transition"
              title="Change active field zone"
            >
              <span>Zone ${plot.plotNumber}: ${plot.crop}</span>
              <svg class="w-3 h-3 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
            </button>

            <!-- Dropdown Menu -->
            <div id="mobile-zone-picker-dropdown" class="hidden absolute left-0 mt-2 w-60 rounded-2xl bg-[#091b10]/95 border border-white/15 shadow-2xl backdrop-blur-2xl p-2 z-50 text-xs">
              <div class="px-3 py-1.5 text-[10px] font-mono text-slate-400 uppercase tracking-wider border-b border-white/10">Switch Parcel Block</div>
              ${activePlots.map(p => `
                <button 
                  type="button" 
                  data-plot-id="${p.id}"
                  class="mobile-zone-option w-full text-left px-3 py-2 rounded-xl flex items-center justify-between hover:bg-white/10 transition ${p.id === plot.id ? 'text-lime-300 font-bold bg-white/5' : 'text-slate-300'}"
                >
                  <span>Plot ${p.plotNumber}: ${p.crop}</span>
                  ${p.id === plot.id ? '<span class="w-1.5 h-1.5 rounded-full bg-lime-400"></span>' : ''}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Status & Action Pills -->
      <div class="flex items-center gap-2">
        <!-- BLE Leaf Clip Status Pill -->
        <button 
          type="button" 
          id="mobile-leaf-scan-trigger" 
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[10px] font-mono font-semibold transition shadow-sm active:scale-95 ${
            isBleConnected 
              ? 'bg-lime-400/20 text-lime-300 border border-lime-400/40 shadow-[0_0_12px_rgba(163,230,53,0.3)]' 
              : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
          }"
          title="Leaf Clip Connected (Simulated BLE). Tap to scan."
        >
          <span class="w-2 h-2 rounded-full ${isBleConnected ? 'bg-lime-400 animate-pulse' : 'bg-emerald-400'}"></span>
          <span>Leaf Clip</span>
        </button>

        <!-- Simulation / Diagnostic Modal Trigger -->
        <button 
          type="button" 
          id="mobile-sim-toggle-btn" 
          class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-slate-200 active:scale-95 transition"
          title="IoT Telemetry Simulation"
        >
          <svg class="w-4 h-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/>
          </svg>
        </button>

        <!-- User / Enterprise Admin Profile Avatar -->
        <button 
          type="button" 
          id="mobile-user-profile-btn" 
          class="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/40 flex items-center justify-center text-slate-950 font-bold text-xs shadow-md active:scale-95 transition"
          title="${currentUser?.displayName || 'User Profile'}"
        >
          ${currentUser?.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'C'}
        </button>
      </div>
    `;

    // Dropdown toggle
    const dropdown = topBar.querySelector('#mobile-zone-picker-dropdown');
    topBar.querySelector('#mobile-zone-picker-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
      dropdown?.classList.add('hidden');
    }, { once: true });

    topBar.querySelectorAll('.mobile-zone-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-plot-id');
        if (plotId) {
          currentPlotId = plotId;
          if (onSelectPlot) onSelectPlot(plotId);
          renderApp();
        }
      });
    });

    topBar.querySelector('#mobile-leaf-scan-trigger')?.addEventListener('click', () => {
      if (onAcquireScan) {
        onAcquireScan(currentPlotId);
      }
      activeTab = 'crop';
      renderApp();
    });

    topBar.querySelector('#mobile-sim-toggle-btn')?.addEventListener('click', () => {
      if (onOpenSimModal) onOpenSimModal();
    });

    topBar.querySelector('#mobile-user-profile-btn')?.addEventListener('click', () => {
      if (onOpenEnterpriseAdmin) onOpenEnterpriseAdmin();
    });
  }

  function renderBottomDock() {
    const pendingCount = (actionRecommendations || []).filter(r => r?.status === 'PENDING').length;

    const navTabs = [
      {
        id: 'crop',
        label: 'Crop',
        badge: 0,
        icon: `
          <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 20h10"/>
            <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
            <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4-.1 5.5.8z"/>
            <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
          </svg>
        `
      },
      {
        id: 'field',
        label: 'Field Zone',
        badge: pendingCount,
        icon: `
          <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          </svg>
        `
      },
      {
        id: 'scan',
        label: 'Spectro',
        badge: 0,
        icon: `
          <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2 12h3l2-5 4 10 3-7 2 4h4"/>
          </svg>
        `
      },
      {
        id: 'valves',
        label: 'Valves',
        badge: 0,
        icon: `
          <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="7" x="3" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="3" rx="1"/>
            <rect width="7" height="7" x="14" y="14" rx="1"/>
            <rect width="7" height="7" x="3" y="14" rx="1"/>
          </svg>
        `
      },
      {
        id: 'overview',
        label: 'Bento',
        badge: 0,
        icon: `
          <svg class="w-5 h-5 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
          </svg>
        `
      }
    ];

    dockContainer.innerHTML = `
      <div class="pointer-events-auto flex items-center justify-between gap-1 sm:gap-2 px-3 py-2 rounded-full border border-white/15 shadow-2xl backdrop-blur-2xl bg-[#091b10]/95 transition-all duration-300">
        ${navTabs.map(tab => {
          const isActive = tab.id === activeTab;
          return `
            <button 
              type="button" 
              data-tab-id="${tab.id}"
              class="mobile-nav-btn group relative px-3 py-1.5 rounded-full flex flex-col items-center justify-center transition-all duration-200 outline-none ${
                isActive 
                  ? 'bg-gradient-to-b from-white/25 to-white/10 text-lime-300 shadow-[0_0_16px_rgba(163,230,53,0.4)] ring-1 ring-lime-400/50 scale-105 font-bold' 
                  : 'text-slate-300 hover:text-white hover:bg-white/10 active:scale-95'
              }"
              aria-label="${tab.label}"
            >
              ${tab.icon}
              <span class="text-[9px] font-mono mt-0.5 tracking-tight ${isActive ? 'text-lime-300 font-bold' : 'text-slate-400'}">
                ${tab.label}
              </span>

              ${tab.badge > 0 ? `
                <span class="absolute top-1 right-2 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-[#091b10] animate-pulse"></span>
              ` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;

    dockContainer.querySelectorAll('.mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab-id');
        if (tabId && tabId !== activeTab) {
          activeTab = tabId;
          renderApp();
        }
      });
    });
  }

  function renderScreenContent() {
    scrollBody.innerHTML = '';

    if (activeTab === 'crop') {
      const cropScreen = createCropOverviewScreen({
        plots: activePlots,
        selectedPlotId: currentPlotId,
        latestScanAnalysis,
        onSelectPlot: (plotId) => {
          currentPlotId = plotId;
          if (onSelectPlot) onSelectPlot(plotId);
          renderApp();
        },
        onAcquireScan: (plotId) => {
          if (onAcquireScan) onAcquireScan(plotId);
        },
        onOpenCalibration: () => {
          if (onOpenCalibration) onOpenCalibration('FULL');
        },
        onBack: () => {
          activeTab = 'overview';
          renderApp();
        }
      });
      scrollBody.appendChild(cropScreen);
    } else if (activeTab === 'field') {
      const fieldScreen = createFieldZoneScreen({
        plots: activePlots,
        selectedPlotId: currentPlotId,
        onSelectPlot: (plotId) => {
          currentPlotId = plotId;
          if (onSelectPlot) onSelectPlot(plotId);
          renderApp();
        },
        onActuateValve: (params) => {
          if (onActuateValve) onActuateValve(params);
        },
        onBack: () => {
          activeTab = 'crop';
          renderApp();
        },
        onNavigateTab: (tabId) => {
          activeTab = tabId;
          renderApp();
        }
      });
      scrollBody.appendChild(fieldScreen);
    } else if (activeTab === 'scan') {
      const spectroWrapper = document.createElement('div');
      spectroWrapper.className = "w-full flex flex-col space-y-4 pb-20";

      // Mobile friendly spectroscopy screen
      const spectroHeader = document.createElement('header');
      spectroHeader.className = "flex items-center justify-between px-1 py-1";
      spectroHeader.innerHTML = `
        <h1 class="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
          <span>🔬 Spectroscopy Studio</span>
        </h1>
        <button 
          type="button" 
          id="mobile-calibrate-btn" 
          class="px-2.5 py-1 rounded-full text-xs font-mono font-medium bg-amber-400/20 text-amber-300 border border-amber-400/40 hover:bg-amber-400/30 transition"
        >
          Calibrate
        </button>
      `;
      spectroWrapper.appendChild(spectroHeader);

      spectroHeader.querySelector('#mobile-calibrate-btn')?.addEventListener('click', () => {
        if (onOpenCalibration) onOpenCalibration('FULL');
      });

      const studio = createSpectroscopyStudio({
        plots: activePlots,
        selectedPlotId: currentPlotId,
        onAcquireScan: (plotId) => {
          if (onAcquireScan) onAcquireScan(plotId);
        },
        onOpenCalibration: () => {
          if (onOpenCalibration) onOpenCalibration('FULL');
        }
      });
      spectroWrapper.appendChild(studio);
      scrollBody.appendChild(spectroWrapper);
    } else if (activeTab === 'valves') {
      scrollBody.appendChild(buildValvesHub());
    } else {
      scrollBody.appendChild(buildBentoOverview());
    }
  }

  function buildBentoOverview() {
    const el = document.createElement('div');
    el.className = "w-full flex flex-col space-y-4 text-white pb-20";

    const totalPlots = activePlots.length || 6;
    const activeValves = activePlots.filter(p => p.valve?.state === 'OPEN').length;
    const pressure = telemetryMetrics.mainlinePressureBar || 2.42;
    const consumedLiters = telemetryMetrics.consumedLitersToday || 1845;

    el.innerHTML = `
      <header class="flex items-center justify-between px-1 py-1">
        <h1 class="text-base font-bold text-white tracking-wide">Parcel Bento Operations</h1>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          ${totalPlots} Zones Synced
        </span>
      </header>

      <!-- KPI Grid -->
      <div class="grid grid-cols-2 gap-3">
        <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/80 border border-white/10 shadow-lg">
          <span class="text-[10px] uppercase font-mono text-slate-400">Solenoid Gates</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">
            ${activeValves} <span class="text-xs text-slate-400 font-normal">/ ${totalPlots}</span>
          </div>
          <div class="text-[11px] text-lime-400 mt-2 font-mono">
            ${activeValves > 0 ? `${activeValves} Active Flowing` : 'System Standby'}
          </div>
        </div>

        <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/80 border border-white/10 shadow-lg">
          <span class="text-[10px] uppercase font-mono text-slate-400">Line Pressure</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">
            ${pressure} <span class="text-xs text-slate-400 font-normal">Bar</span>
          </div>
          <div class="text-[11px] text-emerald-400 mt-2 font-mono">
            Piezo Nominal
          </div>
        </div>
      </div>

      <!-- Water Accounting -->
      <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/80 border border-white/10 shadow-lg">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase font-mono text-slate-400">Water Consumption Today</span>
          <span class="text-xs font-mono text-emerald-300 font-bold">${consumedLiters.toLocaleString()} L</span>
        </div>
        <div class="w-full bg-white/10 rounded-full h-2.5 mt-3 overflow-hidden">
          <div class="bg-gradient-to-r from-lime-400 to-emerald-500 h-2.5 rounded-full" style="width: 48%;"></div>
        </div>
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2">
          <span>Daily Budget: 3,800 L</span>
          <span>48% Delivered</span>
        </div>
      </div>

      <!-- Quick Zones Grid -->
      <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/80 border border-white/10 shadow-lg">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-xs font-mono uppercase text-slate-300">1-Acre Micro-Parcels</h3>
          <span class="text-[10px] font-mono text-emerald-300">Tap zone to inspect</span>
        </div>
        <div class="space-y-2">
          ${activePlots.map(p => `
            <div 
              data-plot-id="${p.id}" 
              class="mobile-bento-plot-row p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between cursor-pointer transition active:scale-98"
            >
              <div class="flex items-center gap-2.5">
                <span class="w-2.5 h-2.5 rounded-full ${p.valve?.state === 'OPEN' ? 'bg-cyan-400 animate-ping' : 'bg-lime-400'}"></span>
                <div>
                  <div class="text-xs font-bold text-white">Plot ${p.plotNumber}: ${p.crop}</div>
                  <div class="text-[10px] text-slate-400 font-mono">${p.stage || 'Active Cycle'}</div>
                </div>
              </div>
              <span class="text-xs font-mono text-emerald-300 font-semibold">Gate ${p.valve?.id || 'G' + p.plotNumber}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    el.querySelectorAll('.mobile-bento-plot-row').forEach(row => {
      row.addEventListener('click', () => {
        const plotId = row.getAttribute('data-plot-id');
        if (plotId) {
          currentPlotId = plotId;
          if (onSelectPlot) onSelectPlot(plotId);
          activeTab = 'crop';
          renderApp();
        }
      });
    });

    return el;
  }

  function buildValvesHub() {
    const el = document.createElement('div');
    el.className = "w-full flex flex-col space-y-4 text-white pb-20";

    el.innerHTML = `
      <header class="flex items-center justify-between px-1 py-1">
        <h1 class="text-base font-bold text-white tracking-wide">6-Zone Hydraulic Solenoids</h1>
        <button 
          type="button" 
          id="mobile-e-stop-btn" 
          class="px-3 py-1.5 rounded-full text-xs font-bold font-mono bg-red-600/30 text-red-300 border border-red-500/50 hover:bg-red-600/50 transition active:scale-95 shadow-md shadow-red-950/40"
        >
          E-STOP
        </button>
      </header>

      <div class="space-y-3">
        ${activePlots.map(plot => {
          const isOpen = plot.valve?.state === 'OPEN';
          return `
            <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/80 border border-white/10 flex items-center justify-between shadow-lg">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-white">Gate ${plot.valve?.id || 'G' + plot.plotNumber}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono ${isOpen ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40' : 'bg-white/10 text-slate-400'}">
                    ${isOpen ? 'FLOWING' : 'CLOSED'}
                  </span>
                </div>
                <div class="text-xs text-slate-400 mt-1">${plot.crop} (Plot ${plot.plotNumber})</div>
                <div class="text-[10px] text-slate-500 font-mono mt-0.5">Flow: ${plot.valve?.flowRate || 480} L/h • ±12V Latching</div>
              </div>

              <button 
                type="button" 
                data-plot-id="${plot.id}"
                data-gate-id="${plot.valve?.id || 'G' + plot.plotNumber}"
                data-action="${isOpen ? 'CLOSE' : 'OPEN'}"
                class="mobile-valve-toggle-btn px-4 py-2.5 rounded-xl text-xs font-bold font-mono transition shadow-md active:scale-95 ${
                  isOpen 
                    ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30' 
                    : 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 hover:from-lime-300 hover:to-emerald-300'
                }"
              >
                ${isOpen ? 'CLOSE (-12V)' : 'OPEN (+12V)'}
              </button>
            </div>
          `;
        }).join('')}
      </div>
    `;

    el.querySelector('#mobile-e-stop-btn')?.addEventListener('click', () => {
      if (onEmergencyStop) onEmergencyStop();
    });

    el.querySelectorAll('.mobile-valve-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-plot-id');
        const gateId = btn.getAttribute('data-gate-id');
        const action = btn.getAttribute('data-action');
        if (onActuateValve) {
          onActuateValve({
            plotId,
            gateId,
            action,
            durationMinutes: 20
          });
        }
      });
    });

    return el;
  }

  function renderApp() {
    renderTopBar();
    renderScreenContent();
    renderBottomDock();
  }

  container.appendChild(topBar);
  container.appendChild(scrollBody);
  container.appendChild(dockContainer);

  renderApp();
  return container;
}
