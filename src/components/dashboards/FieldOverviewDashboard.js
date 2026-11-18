/**
 * Module 0 Dashboard: Home / Field Overview
 * Faithfully styled after the lush forest green farm mobile theme.
 * Strict NO-EMOJI vector UI.
 * Features customizable Bento grid modules:
 *   - Weather Widget Card: Location, Large Temp, 4 Metrics, Sunrise/Sunset Arc
 *   - 1-Acre 6-Zone Interactive Canvas with water pulse animations
 *   - Vitality Gauge, Mainline Pressure, and Water Accounting KPI Bento cards
 *   - Core Category Quick Modules (Soil 8-in-1, Drip Hub, Spectroscopy, AI Insights)
 *   - Closed-Loop Leaf-to-Valve Synergy Recommendations
 *   - Live Field Zones & Solenoid Valve Actuations
 *   - Direct "Customize Layout" modal access
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange } from '../../utils/i18n.js';
import { irrigationControllerAdapter, VALVE_STATES } from '../../hardware/irrigationControllerAdapter.js';
import { getDashboardWidgetSettings, createDashboardSettingsModal } from '../DashboardSettingsModal.js';
import { createPlotCanvas6Zone } from '../PlotCanvas6Zone.js';
import { createClosedLoopSynergySection } from '../ClosedLoopSynergyCard.js';

export function createFieldOverviewDashboard({
  plots = [],
  selectedPlotId = 'plot-1',
  onSelectPlot,
  onNavigateTab,
  onActuateValve,
  actionRecommendations = [],
  telemetryMetrics = {}
}) {
  const container = document.createElement('div');
  container.className = "field-overview-dashboard w-full space-y-4 pb-28 text-slate-800 dark:text-slate-100 select-none overflow-x-hidden";

  let widgetSettings = getDashboardWidgetSettings();

  function render() {
    try {
      const valves = irrigationControllerAdapter.getAllValves ? irrigationControllerAdapter.getAllValves() : [];
    const openValvesCount = valves.filter(v => v.state === VALVE_STATES.OPEN).length;
    const pressure = telemetryMetrics.mainlinePressureBar || 2.42;
    const consumedLiters = telemetryMetrics.consumedLitersToday || 1845;
    const activeFlow = telemetryMetrics.activeFlowLph || (openValvesCount * 480);

    container.innerHTML = `
      <!-- Dashboard Subheader with Customize Bento Button -->
      <div class="flex items-center justify-between px-1 pt-1">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Sonoma Valley Parcel (1 Acre)
          </h2>
        </div>

        <button 
          type="button" 
          id="dash-customize-btn"
          class="min-h-[34px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-stone-50 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          title="Customize Bento Widgets"
        >
          ${icon('sliders', 'w-3.5 h-3.5 text-[#0E5431] dark:text-emerald-400')}
          <span>Customize Bento</span>
        </button>
      </div>

      <!-- 1. Overlapping Weather / Location Hero Card -->
      ${widgetSettings.weather_hero ? `
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_8px_30px_rgba(14,84,49,0.08)] border border-emerald-900/5 dark:border-slate-800 space-y-4">
          <!-- Location & Header -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
              ${icon('mapPin', 'w-4 h-4 text-[#0E5431] dark:text-emerald-400')}
              <span class="text-xs font-bold tracking-tight">Chateauneuf-du-Pape • Sonoma</span>
            </div>

            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-[#0E5431] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
              Live Parcel
            </span>
          </div>

          <!-- Big Temperature & Weather Icon -->
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">+17°C</span>
                <span class="text-xs font-semibold text-slate-400 font-mono">H: 23°C • L: 14°C</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Light Breeze • Ideal photosynthetic light</p>
            </div>

            <div class="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-500 shadow-sm flex-shrink-0">
              ${icon('sunMoon', 'w-8 h-8')}
            </div>
          </div>

          <!-- 4 Key Environmental Metrics Row -->
          <div class="grid grid-cols-4 gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center">
              <span class="text-[9.5px] text-slate-400 font-medium">Humidity</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block">40%</span>
            </div>
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center">
              <span class="text-[9.5px] text-slate-400 font-medium">Precip</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block">5.1 mm</span>
            </div>
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center">
              <span class="text-[9.5px] text-slate-400 font-medium">Pressure</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block">1013 hPa</span>
            </div>
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center">
              <span class="text-[9.5px] text-slate-400 font-medium">Wind</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block">14 km/h</span>
            </div>
          </div>

          <!-- Sunrise / Sunset Daylight Arc -->
          <div class="bg-slate-50 dark:bg-slate-850 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-mono min-w-0 overflow-hidden">
            <div class="flex items-center gap-1.5 shrink-0">
              ${icon('sun', 'w-4 h-4 text-amber-500')}
              <span>5:25 am</span>
            </div>
            <div class="flex-1 mx-2 sm:mx-4 h-0.5 border-t border-dashed border-amber-400/60 relative flex items-center justify-center min-w-[20px]">
              <div class="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow-sm"></div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${icon('cloud', 'w-4 h-4 text-slate-400')}
              <span>8:04 pm</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 2. Bento Summary Row: Pressure, Vitality, and Water Accounting -->
      ${(widgetSettings.pressure_meter || widgetSettings.vitality_gauge || widgetSettings.water_ledger) ? `
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          ${widgetSettings.pressure_meter ? `
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-3.5 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-1">
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Pressure</span>
                <span class="w-2 h-2 rounded-full ${pressure > 3.0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}"></span>
              </div>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-2xl font-black font-mono text-slate-900 dark:text-white">${pressure}</span>
                <span class="text-xs font-mono text-slate-500">Bar</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono block">Piezo-Resistive</span>
            </div>
          ` : ''}

          ${widgetSettings.vitality_gauge ? `
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-3.5 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-1">
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Canopy Vitality</span>
                <span class="text-[10px] text-emerald-600 font-mono font-bold">NDVI 0.76</span>
              </div>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-2xl font-black font-mono text-[#0E5431] dark:text-emerald-400">84%</span>
                <span class="text-xs font-mono text-slate-500">Optimum</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono block">76-Band Chemometrics</span>
            </div>
          ` : ''}

          ${widgetSettings.water_ledger ? `
            <div class="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-3.5 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-1">
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Daily Volume</span>
                <span class="text-[10px] text-blue-600 font-mono font-bold">${activeFlow} L/hr</span>
              </div>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">${consumedLiters.toLocaleString()}</span>
                <span class="text-xs font-mono text-slate-500">Liters</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono block">6 Gates Cumulative</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 3. 1-Acre 6-Zone Field Plot Canvas -->
      ${widgetSettings.plot_canvas ? `
        <div id="plot-canvas-host" class="w-full"></div>
      ` : ''}

      <!-- 4. Quick Category Modules -->
      ${widgetSettings.quick_modules ? `
        <div class="space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Core Precision Modules
            </h3>
            <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">4 Active Hubs</span>
          </div>

          <div class="grid grid-cols-4 gap-2">
            <!-- Soil Tester 8-in-1 -->
            <button 
              type="button" 
              data-target-tab="soil"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer"
            >
              <div class="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-[#0E5431] dark:text-emerald-300">
                ${icon('soil', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Soil 8-in-1</span>
            </button>

            <!-- Drip Hub -->
            <button 
              type="button" 
              data-target-tab="irrigation"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer"
            >
              <div class="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-500/20 flex items-center justify-center text-blue-600">
                ${icon('droplet', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Drip Hub</span>
            </button>

            <!-- Spectroscopy -->
            <button 
              type="button" 
              data-target-tab="spectroscopy"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer"
            >
              <div class="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-300">
                ${icon('spectroscopy', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Spectro</span>
            </button>

            <!-- Synergy / AI Insights -->
            <button 
              type="button" 
              data-target-tab="synergy"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer"
            >
              <div class="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-600">
                ${icon('synergy', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Synergy</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 5. Closed-Loop Leaf-to-Valve Synergy Recommendations Host -->
      ${widgetSettings.synergy_recommendations ? `
        <div id="synergy-recommendations-host" class="w-full"></div>
      ` : ''}

      <!-- 6. Live Field Zones & Solenoid Controls -->
      ${widgetSettings.zone_valves ? `
        <div class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Field Zones & Irrigation States
            </h3>
            <span class="text-[10px] text-slate-400 font-mono">${openValvesCount} Gates Active</span>
          </div>

          <div class="space-y-2.5">
            ${plots.map(plot => {
              const valve = valves.find(v => v.plotId === plot.id) || valves[0];
              const isOpen = valve?.state === VALVE_STATES.OPEN;
              const isSelected = plot.id === selectedPlotId;

              return `
                <div 
                  data-plot-id="${plot.id}"
                  class="field-zone-card bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#0E5431] ring-2 ring-[#0E5431]/10' 
                      : 'border-emerald-900/5 dark:border-slate-800 hover:border-slate-300'
                  }"
                >
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                      <div class="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-[#0E5431] dark:text-emerald-300 font-bold font-mono text-sm">
                        Z${plot.plotNumber}
                      </div>

                      <div>
                        <div class="flex items-center gap-2">
                          <h4 class="text-xs font-bold text-slate-900 dark:text-white">${plot.crop}</h4>
                          <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold ${
                            isOpen ? 'bg-emerald-100 text-[#0E5431]' : 'bg-slate-100 text-slate-500'
                          }">
                            ${isOpen ? 'VALVE ON' : 'IDLE'}
                          </span>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5">${plot.stage || 'Vegetative & Root Bulking'}</p>
                      </div>
                    </div>

                    <!-- Quick Actuate Action Button -->
                    <button 
                      type="button" 
                      data-valve-id="${valve?.id || 'valve-1'}"
                      data-gate-id="${valve?.gateIdentifier || 'G1'}"
                      data-action="${isOpen ? 'CLOSE' : 'OPEN'}"
                      class="valve-actuate-btn quick-valve-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isOpen 
                          ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                          : 'bg-[#0E5431] hover:bg-[#083820] text-white'
                      }"
                    >
                      ${isOpen ? icon('pause', 'w-3 h-3') : icon('play', 'w-3 h-3')}
                      <span>${isOpen ? 'Close' : 'Irrigate'}</span>
                    </button>
                  </div>

                  <!-- Soil Moisture Progress Bar -->
                  <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500">Root-zone VWC:</span>
                    <div class="flex items-center gap-2">
                      <div class="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-[#0E5431] rounded-full" style="width: 70%"></div>
                      </div>
                      <span class="font-mono font-bold text-slate-800 dark:text-white">28.5%</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}
    `;

    // Render Canvas if enabled
    if (widgetSettings.plot_canvas) {
      const canvasHost = container.querySelector('#plot-canvas-host');
      if (canvasHost) {
        const canvas = createPlotCanvas6Zone(plots, selectedPlotId, (pId) => {
          if (onSelectPlot) onSelectPlot(pId);
        });
        canvasHost.appendChild(canvas);
      }
    }

    // Render Synergy Recommendations if enabled
    if (widgetSettings.synergy_recommendations) {
      const synHost = container.querySelector('#synergy-recommendations-host');
      if (synHost && actionRecommendations) {
        const synergyCard = createClosedLoopSynergySection(actionRecommendations, (action, recId) => {
          if (onActuateValve) onActuateValve({ action, recId });
        });
        synHost.appendChild(synergyCard);
      }
    }

    attachEvents();
    } catch (err) {
      console.error("[FieldOverviewDashboard] Safe render fallback:", err);
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-emerald-900/10 dark:border-slate-800 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-[#0E5431] flex items-center justify-center">
            ${icon('home', 'w-6 h-6')}
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Field Overview Active</h3>
          <p class="text-xs text-slate-500">Live parcel telemetry and hydraulic gates synced.</p>
          <button type="button" id="btn-overview-recovery-retry" class="px-4 py-2 rounded-full bg-[#0E5431] text-white text-xs font-bold">
            Refresh Overview
          </button>
        </div>
      `;
      container.querySelector('#btn-overview-recovery-retry')?.addEventListener('click', () => render());
    }
  }

  function attachEvents() {
    // Open Customizer Modal
    container.querySelector('#dash-customize-btn')?.addEventListener('click', () => {
      const modal = createDashboardSettingsModal({
        onSettingsChanged: (newSettings) => {
          widgetSettings = newSettings;
          render();
        }
      });
      document.body.appendChild(modal);
    });

    // Quick Category Module Buttons
    container.querySelectorAll('.cat-module-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-target-tab');
        if (tab && onNavigateTab) onNavigateTab(tab);
      });
    });

    // Select Plot Click
    container.querySelectorAll('.field-zone-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const pId = card.getAttribute('data-plot-id');
        if (pId && onSelectPlot) onSelectPlot(pId);
      });
    });

    // Quick Valve Actuate
    container.querySelectorAll('.quick-valve-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vId = btn.getAttribute('data-valve-id');
        const act = btn.getAttribute('data-action');
        if (vId) {
          if (act === 'OPEN') {
            await irrigationControllerAdapter.openValve(vId, { durationMinutes: 30 });
          } else {
            await irrigationControllerAdapter.closeValve(vId);
          }
          if (onActuateValve) onActuateValve({ valveId: vId, action: act, duration: 30 });
          render();
        }
      });
    });
  }

  onLocaleChange(() => render());

  render();
  return container;
}
