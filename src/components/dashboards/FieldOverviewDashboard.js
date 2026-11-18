/**
 * Module 0 Dashboard: Home / Field Overview
 * Faithfully styled after Screen 1 of the user's uploaded mobile reference.
 * Strict NO-EMOJI vector UI:
 *   - Weather Widget Card: Location, Large Temp, 4 Metrics, Sunrise/Sunset Arc
 *   - Quick Category Modules: 4 clean rounded white cards (Soil 8-in-1, Drip Hub, Spectroscopy, AI Insights)
 *   - Live Field Zones Carousel / Cards with crop stage, moisture VWC, and valve control
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange } from '../../utils/i18n.js';
import { irrigationControllerAdapter, VALVE_STATES } from '../../hardware/irrigationControllerAdapter.js';

export function createFieldOverviewDashboard({
  plots = [],
  selectedPlotId = 'plot-1',
  onSelectPlot,
  onNavigateTab,
  onActuateValve
}) {
  const container = document.createElement('div');
  container.className = "field-overview-dashboard w-full space-y-4 pb-28 text-slate-800 select-none";

  function render() {
    const valves = irrigationControllerAdapter.getAllValves();
    const openValvesCount = valves.filter(v => v.state === VALVE_STATES.OPEN).length;

    container.innerHTML = `
      <!-- 1. Overlapping Weather / Location Hero Card (Matches uploaded image left screen) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_8px_30px_rgba(14,84,49,0.08)] border border-emerald-900/5 dark:border-slate-800 space-y-4">
        <!-- Location & Header -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
            ${icon('mapPin', 'w-4 h-4 text-[#0E5431]')}
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
            <p class="text-xs text-slate-500 mt-1">Light Breeze • Ideal photosynthetic light</p>
          </div>

          <div class="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-500 shadow-sm">
            ${icon('sunMoon', 'w-8 h-8')}
          </div>
        </div>

        <!-- 4 Key Environmental Metrics Row (Matching photo) -->
        <div class="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <div class="flex flex-col">
            <span class="text-[10px] text-slate-400">Humidity</span>
            <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5">40%</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-slate-400">Precipitation</span>
            <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5">5.1 ml</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-slate-400">Pressure</span>
            <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5">450 hPa</span>
          </div>
          <div class="flex flex-col">
            <span class="text-[10px] text-slate-400">Wind</span>
            <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5">23 m/s</span>
          </div>
        </div>

        <!-- Sunrise / Sunset Daylight Arc (Matching photo) -->
        <div class="bg-slate-50 dark:bg-slate-850 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-mono">
          <div class="flex items-center gap-1.5">
            ${icon('sun', 'w-4 h-4 text-amber-500')}
            <span>5:25 am</span>
          </div>
          <div class="flex-1 mx-4 h-0.5 border-t border-dashed border-amber-400/60 relative flex items-center justify-center">
            <div class="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow-sm"></div>
          </div>
          <div class="flex items-center gap-1.5">
            ${icon('cloud', 'w-4 h-4 text-slate-400')}
            <span>8:04 am</span>
          </div>
        </div>
      </div>

      <!-- 2. Quick Category Modules (Matching "Invest by Category" 4-Card row in uploaded photo) -->
      <div class="space-y-2.5">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-500">
            Core Precision Modules
          </h3>
          <span class="text-[10px] text-emerald-700 font-bold">4 Active Hubs</span>
        </div>

        <div class="grid grid-cols-4 gap-2">
          <!-- Soil Tester 8-in-1 -->
          <button 
            type="button" 
            data-target-tab="soil"
            class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center"
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
            class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center"
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
            class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center"
          >
            <div class="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/20 flex items-center justify-center text-teal-700">
              ${icon('spectroscopy', 'w-5 h-5')}
            </div>
            <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">Spectroscopy</span>
          </button>

          <!-- AI Insights -->
          <button 
            type="button" 
            data-target-tab="ai"
            class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center"
          >
            <div class="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-600">
              ${icon('zap', 'w-5 h-5')}
            </div>
            <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight">AI Insights</span>
          </button>
        </div>
      </div>

      <!-- 3. Live Field Zones (Matching "Best Offers" in uploaded photo) -->
      <div class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-xs font-black uppercase tracking-wider text-slate-500">
            Field Zones & Irrigation States
          </h3>
          <div class="flex items-center gap-1.5">
            ${[15, 30, 45, 60].map(dur => `
              <button 
                type="button" 
                data-duration="${dur}"
                class="timer-btn px-2 py-0.5 rounded-lg text-[10px] font-semibold transition ${
                  dur === 45 
                    ? 'bg-[#0E5431] text-white shadow-sm' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }"
              >
                ${dur}m
              </button>
            `).join('')}
          </div>
        </div>

        <div class="space-y-2.5">
          ${plots.map(plot => {
            const valve = valves.find(v => v.plotId === plot.id) || valves[0];
            const isOpen = valve?.state === VALVE_STATES.OPEN;
            const isSelected = plot.id === selectedPlotId;

            return `
              <div 
                data-plot-id="${plot.id}"
                class="field-zone-card bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border transition-all ${
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

                  <!-- Quick Actuate Action Button (preserves .valve-actuate-btn for automated tests) -->
                  <button 
                    type="button" 
                    data-valve-id="${valve?.id || 'valve-1'}"
                    data-gate-id="${valve?.gateIdentifier || 'G1'}"
                    data-action="${isOpen ? 'CLOSE' : 'OPEN'}"
                    class="valve-actuate-btn quick-valve-btn px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
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
    `;

    attachEvents();
  }

  function attachEvents() {
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
