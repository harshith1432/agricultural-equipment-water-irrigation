/**
 * Mobile Frame Showcase Component
 * Faithfully reproduces the Twin Phone Mockup from the reference image,
 * while allowing fluid switching between:
 * 1. 📱 Twin Device Showcase (Side-by-side Potato Crop Overview + Potato Field Zone)
 * 2. 📱 Single Mobile View (Interactive tabbed mobile experience)
 * 3. 🖥️ Full Web Grid View (Enterprise desktop agronomy view)
 */

import { createCropOverviewScreen } from './CropOverviewScreen.js';
import { createFieldZoneScreen } from './FieldZoneScreen.js';
import { createFloatingBottomNav } from './FloatingBottomNav.js';

export function createMobileFrameShowcase({
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
  onOpenAuthModal,
  onOpenEnterpriseAdmin,
  currentUser = null,
  initialDisplayMode = 'twin' // 'twin' | 'single' | 'web'
}) {
  const container = document.createElement('div');
  container.className = "w-full flex flex-col items-center justify-start min-h-screen py-4 px-2 sm:px-4 transition-all duration-300";

  let displayMode = initialDisplayMode; // 'twin' | 'single' | 'web'
  let singleTab = 'crop'; // 'crop' | 'field' | 'overview' | 'valves'

  function renderShowcase() {
    container.innerHTML = `
      <!-- Showcase Mode Switcher Header Bar -->
      <div class="w-full max-w-6xl mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 px-2">
        <!-- Brand & Title -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-2xl bg-gradient-to-br from-lime-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-950/40 border border-lime-300/40">
            <svg class="w-5 h-5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M7 20h10"/>
              <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
              <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4-.1 5.5.8z"/>
              <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-2">
              AgriSpectra Flow & Field
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-lime-400/20 text-lime-300 border border-lime-400/30">
                Aero-Field UI/UX
              </span>
            </h2>
            <p class="text-xs text-slate-400">Handheld Leaf Spectroscopy & 6-Zone Smart Irrigation</p>
          </div>
        </div>

        <!-- Mode Toggle Segmented Control -->
        <div class="flex items-center gap-1 p-1 rounded-2xl bg-[#0b2114]/90 border border-white/15 shadow-xl backdrop-blur-xl">
          <button 
            type="button" 
            id="mode-btn-twin"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              displayMode === 'twin' 
                ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }"
            title="Twin Mockup Showcase (as in reference image)"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M12 3v18"/></svg>
            <span class="hidden sm:inline">Twin Reference Showcase</span>
            <span class="sm:hidden">Twin</span>
          </button>

          <button 
            type="button" 
            id="mode-btn-single"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              displayMode === 'single' 
                ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }"
            title="Single Phone Interactive View"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
            <span class="hidden sm:inline">Single Mobile</span>
            <span class="sm:hidden">Mobile</span>
          </button>

          <button 
            type="button" 
            id="mode-btn-web"
            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              displayMode === 'web' 
                ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }"
            title="Wide Desktop Agronomy Hub"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            <span class="hidden sm:inline">Desktop Wide</span>
            <span class="sm:hidden">Desktop</span>
          </button>
        </div>
      </div>

      <!-- Main Showcase Canvas Body -->
      <div id="showcase-content-host" class="w-full flex justify-center"></div>
    `;

    const contentHost = container.querySelector('#showcase-content-host');

    if (displayMode === 'twin') {
      renderTwinMockup(contentHost);
    } else if (displayMode === 'single') {
      renderSingleMockup(contentHost);
    } else {
      // Dispatches request to switch to web mode
      window.dispatchEvent(new CustomEvent('agrispectra_switch_view', { detail: { mode: 'web' } }));
    }

    // Attach Mode Switcher Listeners
    container.querySelector('#mode-btn-twin')?.addEventListener('click', () => {
      displayMode = 'twin';
      renderShowcase();
    });

    container.querySelector('#mode-btn-single')?.addEventListener('click', () => {
      displayMode = 'single';
      renderShowcase();
    });

    container.querySelector('#mode-btn-web')?.addEventListener('click', () => {
      displayMode = 'web';
      window.dispatchEvent(new CustomEvent('agrispectra_switch_view', { detail: { mode: 'web' } }));
    });
  }

  /**
   * Helper to build a realistic mobile phone shell
   */
  function buildPhoneShell(screenContentElement, activeDockTab = 'crop', onDockChange = null) {
    const shell = document.createElement('div');
    shell.className = "phone-shell relative w-full max-w-[390px] h-[830px] rounded-[50px] border-[9px] border-[#182b1e] bg-[#08180e] shadow-[0_30px_90px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.12)] overflow-hidden flex flex-col shrink-0";
    
    // Background aerial farmland graphic inside the phone
    shell.style.backgroundImage = "url('/assets/drone-farmland-bg.svg')";
    shell.style.backgroundSize = "cover";
    shell.style.backgroundPosition = "center";

    // Ambient inner shadow / vignette
    const vignette = document.createElement('div');
    vignette.className = "absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70 pointer-events-none z-10";
    shell.appendChild(vignette);

    // 1. Phone Top Island & Status Bar (matches "9:54" in reference screenshot)
    const statusBar = document.createElement('div');
    statusBar.className = "relative z-30 pt-2 px-6 flex items-center justify-between text-white shrink-0 pointer-events-none select-none";
    statusBar.innerHTML = `
      <!-- Time -->
      <span class="text-xs font-semibold font-mono tracking-tight">9:54</span>

      <!-- Dynamic Island Cutout -->
      <div class="w-24 h-5 bg-black rounded-full border border-white/10 flex items-center justify-center">
        <div class="w-2.5 h-2.5 rounded-full bg-[#121f15] border border-white/20"></div>
      </div>

      <!-- Status Icons: Cellular, Wifi, Battery -->
      <div class="flex items-center gap-1.5 text-xs text-white">
        <!-- Cellular Signal -->
        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M2 20h2v-4H2v4zm4 0h2v-8H6v8zm4 0h2V8h-2v12zm4 0h2V4h-2v16zm4 0h2V2h-2v18z"/></svg>
        <!-- Wifi -->
        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 4C7.31 4 3.07 5.9 0 8.98L12 21 24 8.98C20.93 5.9 16.69 4 12 4zm0 3.5c3.78 0 7.2 1.48 9.77 3.91L12 18.25 2.23 11.41C4.8 8.98 8.22 7.5 12 7.5z"/></svg>
        <!-- Battery 94% -->
        <div class="w-5 h-2.5 rounded-sm border border-white p-0.5 flex items-center">
          <div class="h-full bg-lime-400 rounded-2xs" style="width: 90%;"></div>
        </div>
      </div>
    `;
    shell.appendChild(statusBar);

    // 2. Scrollable App Content Container
    const scrollContainer = document.createElement('div');
    scrollContainer.className = "relative z-20 flex-1 overflow-y-auto overflow-x-hidden px-3 pt-2 pb-24 scroll-smooth no-scrollbar";
    scrollContainer.appendChild(screenContentElement);
    shell.appendChild(scrollContainer);

    // 3. Floating Bottom Navigation Dock (docked at phone bottom)
    const dockWrapper = document.createElement('div');
    dockWrapper.className = "absolute bottom-3 inset-x-0 z-40 px-4 flex flex-col items-center pointer-events-none";

    const navDock = createFloatingBottomNav({
      activeTab: activeDockTab,
      onTabChange: (tabId) => {
        if (onDockChange) {
          onDockChange(tabId);
        } else {
          // In twin mode, switch single mode tab
          singleTab = tabId;
          displayMode = 'single';
          renderShowcase();
        }
      }
    });
    dockWrapper.appendChild(navDock);

    // Home indicator bar at bottom
    const homeIndicator = document.createElement('div');
    homeIndicator.className = "w-32 h-1 bg-white/40 rounded-full mx-auto mt-1.5 shadow-sm";
    dockWrapper.appendChild(homeIndicator);

    shell.appendChild(dockWrapper);

    return shell;
  }

  /**
   * Render Twin Mockup: Two phones side by side exactly like the user's reference image!
   */
  function renderTwinMockup(host) {
    host.innerHTML = '';

    const twinWrapper = document.createElement('div');
    twinWrapper.className = "w-full max-w-5xl flex flex-wrap items-center justify-center gap-8 lg:gap-14 py-4";

    // Phone 1: Potato Crop Overview (Left Screen in Reference)
    const cropScreen = createCropOverviewScreen({
      plots,
      selectedPlotId,
      latestScanAnalysis,
      onSelectPlot: (plotId) => {
        if (onSelectPlot) onSelectPlot(plotId);
      },
      onAcquireScan: (plotId) => {
        if (onAcquireScan) onAcquireScan(plotId);
      },
      onOpenCalibration: () => {
        if (onOpenCalibration) onOpenCalibration();
      },
      onBack: () => {
        singleTab = 'overview';
        displayMode = 'single';
        renderShowcase();
      }
    });

    const phone1 = buildPhoneShell(cropScreen, 'crop', (tabId) => {
      singleTab = tabId;
      displayMode = 'single';
      renderShowcase();
    });

    // Phone 2: Potato Field Zone (Right Screen in Reference)
    const fieldScreen = createFieldZoneScreen({
      plots,
      selectedPlotId,
      onSelectPlot: (plotId) => {
        if (onSelectPlot) onSelectPlot(plotId);
      },
      onActuateValve: (params) => {
        if (onActuateValve) onActuateValve(params);
      },
      onBack: () => {
        singleTab = 'crop';
        displayMode = 'single';
        renderShowcase();
      },
      onNavigateTab: (tabId) => {
        singleTab = tabId;
        displayMode = 'single';
        renderShowcase();
      }
    });

    const phone2 = buildPhoneShell(fieldScreen, 'field', (tabId) => {
      singleTab = tabId;
      displayMode = 'single';
      renderShowcase();
    });

    // Labels under phones
    const col1 = document.createElement('div');
    col1.className = "flex flex-col items-center gap-3";
    col1.appendChild(phone1);
    const label1 = document.createElement('div');
    label1.className = "text-center";
    label1.innerHTML = `
      <div class="text-xs font-bold text-white tracking-wide">Screen 1: Potato Crop Overview</div>
      <div class="text-[11px] text-slate-400 font-mono">Growth Rate Chart • 63-Day Health Ring • Leaf Chemometrics</div>
    `;
    col1.appendChild(label1);

    const col2 = document.createElement('div');
    col2.className = "flex flex-col items-center gap-3";
    col2.appendChild(phone2);
    const label2 = document.createElement('div');
    label2.className = "text-center";
    label2.innerHTML = `
      <div class="text-xs font-bold text-white tracking-wide">Screen 2: Potato Field Zone</div>
      <div class="text-[11px] text-slate-400 font-mono">Satellite Drone Map • Pinned 7-Ton Telemetry • 1-Tap Irrigation</div>
    `;
    col2.appendChild(label2);

    twinWrapper.appendChild(col1);
    twinWrapper.appendChild(col2);
    host.appendChild(twinWrapper);
  }

  /**
   * Render Single Interactive Phone with Floating Navigation
   */
  function renderSingleMockup(host) {
    host.innerHTML = '';

    const singleWrapper = document.createElement('div');
    singleWrapper.className = "w-full flex flex-col items-center justify-center py-2";

    let activeScreenContent;

    if (singleTab === 'crop') {
      activeScreenContent = createCropOverviewScreen({
        plots,
        selectedPlotId,
        latestScanAnalysis,
        onSelectPlot: (plotId) => {
          if (onSelectPlot) onSelectPlot(plotId);
        },
        onAcquireScan: (plotId) => {
          if (onAcquireScan) onAcquireScan(plotId);
        },
        onOpenCalibration: () => {
          if (onOpenCalibration) onOpenCalibration();
        },
        onBack: () => {
          singleTab = 'overview';
          renderSingleMockup(host);
        }
      });
    } else if (singleTab === 'field') {
      activeScreenContent = createFieldZoneScreen({
        plots,
        selectedPlotId,
        onSelectPlot: (plotId) => {
          if (onSelectPlot) onSelectPlot(plotId);
        },
        onActuateValve: (params) => {
          if (onActuateValve) onActuateValve(params);
        },
        onBack: () => {
          singleTab = 'crop';
          renderSingleMockup(host);
        },
        onNavigateTab: (tabId) => {
          singleTab = tabId;
          renderSingleMockup(host);
        }
      });
    } else if (singleTab === 'overview') {
      // Create mini bento view for mobile
      activeScreenContent = buildMobileBentoOverview();
    } else {
      // Valves view for mobile
      activeScreenContent = buildMobileValvesHub();
    }

    const phone = buildPhoneShell(activeScreenContent, singleTab, (tabId) => {
      singleTab = tabId;
      renderSingleMockup(host);
    });

    singleWrapper.appendChild(phone);
    host.appendChild(singleWrapper);
  }

  function buildMobileBentoOverview() {
    const el = document.createElement('div');
    el.className = "w-full flex flex-col space-y-4 text-white";

    const totalPlots = plots.length || 6;
    const activeValves = plots.filter(p => p.valve?.state === 'OPEN').length;
    const pressure = telemetryMetrics.mainlinePressureBar || 2.42;
    const consumedLiters = telemetryMetrics.consumedLitersToday || 1845;

    el.innerHTML = `
      <header class="flex items-center justify-between px-1 py-1">
        <h1 class="text-base font-bold text-white tracking-wide">Parcel Bento Operations</h1>
        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          6 Zones Synced
        </span>
      </header>

      <!-- KPI 1 & 2 -->
      <div class="grid grid-cols-2 gap-3">
        <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/75 border border-white/10">
          <span class="text-[10px] uppercase font-mono text-slate-400">Solenoid Gates</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">
            ${activeValves} <span class="text-xs text-slate-400 font-normal">/ 6</span>
          </div>
          <div class="text-[11px] text-lime-400 mt-2 font-mono">
            ${activeValves > 0 ? `${activeValves} Active Flowing` : 'System Standby'}
          </div>
        </div>

        <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/75 border border-white/10">
          <span class="text-[10px] uppercase font-mono text-slate-400">Line Pressure</span>
          <div class="text-2xl font-bold font-mono text-white mt-1">
            ${pressure} <span class="text-xs text-slate-400 font-normal">Bar</span>
          </div>
          <div class="text-[11px] text-emerald-400 mt-2 font-mono">
            Nominal Piezo
          </div>
        </div>
      </div>

      <!-- Water Accounting -->
      <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/75 border border-white/10">
        <div class="flex items-center justify-between">
          <span class="text-[10px] uppercase font-mono text-slate-400">Water Consumption Today</span>
          <span class="text-xs font-mono text-emerald-300 font-bold">${consumedLiters.toLocaleString()} L</span>
        </div>
        <div class="w-full bg-white/10 rounded-full h-2 mt-3 overflow-hidden">
          <div class="bg-gradient-to-r from-lime-400 to-emerald-500 h-2 rounded-full" style="width: 48%;"></div>
        </div>
        <div class="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2">
          <span>Target: 3,800 L</span>
          <span>48% Utilized</span>
        </div>
      </div>

      <!-- Zones Quick List -->
      <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/75 border border-white/10">
        <h3 class="text-xs font-mono uppercase text-slate-300 mb-2">1-Acre Micro-Parcels</h3>
        <div class="space-y-2">
          ${plots.map(p => `
            <div 
              data-plot-id="${p.id}" 
              class="mobile-bento-plot-row p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-between cursor-pointer transition"
            >
              <div class="flex items-center gap-2">
                <span class="w-2 h-2 rounded-full ${p.valve?.state === 'OPEN' ? 'bg-cyan-400 animate-ping' : 'bg-lime-400'}"></span>
                <span class="text-xs font-semibold text-white">Plot ${p.plotNumber}: ${p.crop}</span>
              </div>
              <span class="text-[11px] font-mono text-slate-300">Gate ${p.valve?.id || 'G' + p.plotNumber}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    el.querySelectorAll('.mobile-bento-plot-row').forEach(row => {
      row.addEventListener('click', () => {
        const plotId = row.getAttribute('data-plot-id');
        if (plotId && onSelectPlot) {
          onSelectPlot(plotId);
          singleTab = 'crop';
          renderSingleMockup(host);
        }
      });
    });

    return el;
  }

  function buildMobileValvesHub() {
    const el = document.createElement('div');
    el.className = "w-full flex flex-col space-y-4 text-white";

    el.innerHTML = `
      <header class="flex items-center justify-between px-1 py-1">
        <h1 class="text-base font-bold text-white tracking-wide">6-Zone Hydraulic Hub</h1>
        <button type="button" id="mobile-e-stop-btn" class="px-3 py-1 rounded-full text-xs font-bold bg-red-600/30 text-red-300 border border-red-500/50 hover:bg-red-600/50 transition">
          Emergency Stop
        </button>
      </header>

      <div class="space-y-3">
        ${plots.map(plot => {
          const isOpen = plot.valve?.state === 'OPEN';
          return `
            <div class="aero-glass-card p-4 rounded-2xl bg-[#0d2616]/75 border border-white/10 flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-white">Gate ${plot.valve?.id || 'G' + plot.plotNumber}</span>
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono ${isOpen ? 'bg-cyan-400/20 text-cyan-300 border border-cyan-400/40' : 'bg-white/10 text-slate-400'}">
                    ${isOpen ? 'FLOWING' : 'CLOSED'}
                  </span>
                </div>
                <div class="text-xs text-slate-400 mt-1">${plot.crop} (Plot ${plot.plotNumber})</div>
              </div>

              <button 
                type="button" 
                data-plot-id="${plot.id}"
                data-gate-id="${plot.valve?.id || 'G' + plot.plotNumber}"
                data-action="${isOpen ? 'CLOSE' : 'OPEN'}"
                class="mobile-valve-toggle-btn px-4 py-2 rounded-xl text-xs font-bold font-mono transition shadow-md active:scale-95 ${
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

  // Initial render
  renderShowcase();

  return container;
}
