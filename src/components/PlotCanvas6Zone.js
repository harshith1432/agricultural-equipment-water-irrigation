/**
 * Interactive 1-Acre 6-Plot Visual Canvas
 * Visualizes Plots 1 to 6 in a 2x3 acre parcel with live water ripples & moisture heatmaps.
 */
import { getMoistureColor, formatTimeRemaining } from '../utils/formatters.js';

export function createPlotCanvas6Zone(plots = [], selectedPlotId = "plot-1", onSelectPlot) {
  const container = document.createElement('section');
  container.className = "plot-canvas-6zone bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 shadow-sm border border-emerald-900/10 dark:border-slate-800 text-slate-800 dark:text-slate-100 select-none overflow-hidden";

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4 sm:mb-5">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-[#0E5431] dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
            </svg>
            1-Acre Hierarchical 6-Zone Field Canvas
          </h2>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
            Interactive Topology
          </span>
        </div>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Click any plot to focus spectroscopy diagnostics and probe telemetry.</p>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-2.5 sm:gap-3 text-[10px] sm:text-[11px] font-medium text-slate-600 dark:text-slate-300 flex-wrap">
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs shadow-emerald-500/50"></span>
          Optimal (>22%)
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-xs shadow-amber-500/50"></span>
          Moderate (18-22%)
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse shadow-xs shadow-rose-500/50"></span>
          Deficit (&lt;18%)
        </span>
      </div>
    </div>

    <!-- 1-Acre Field Grid: 2 columns for responsive balance without squashing -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3.5" id="acre-plots-grid">
      ${plots.map(plot => {
        const isSelected = plot.id === selectedPlotId;
        const isOpen = plot.valve?.state === 'OPEN';
        
        // Compute average VWC
        let avgVwc = 25.0;
        if (plot.soilSensors && plot.soilSensors.length > 0) {
          const sum = plot.soilSensors.reduce((a, s) => a + Number(s.vwc), 0);
          avgVwc = Number((sum / plot.soilSensors.length).toFixed(1));
        }

        const moistureStyle = getMoistureColor(avgVwc);
        const timerLeft = formatTimeRemaining(plot.valve?.timerEnd);

        return `
          <div data-plot-id="${plot.id}" class="plot-card relative rounded-2xl p-3.5 sm:p-4 transition-all duration-200 cursor-pointer overflow-hidden border min-w-0 ${
            isSelected 
              ? 'ring-2 ring-[#0E5431] dark:ring-emerald-400 border-[#0E5431] dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-md' 
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850 hover:border-emerald-600/40 hover:bg-white dark:hover:bg-slate-800 shadow-2xs'
          }">
            <!-- Water Pulse Animation Layer when Valve is OPEN -->
            ${isOpen ? `
              <div class="absolute inset-0 pointer-events-none overflow-hidden">
                <div class="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-cyan-400/20 to-blue-500/10 animate-pulse"></div>
                <!-- Concentric animated water ripples -->
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-cyan-400/40 animate-ping"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-400/20 animate-ping" style="animation-delay: 0.6s"></div>
                <div class="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-800 dark:text-cyan-300 bg-cyan-100/90 dark:bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-400/40 shadow-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-ping"></span>
                  WATERING ${timerLeft ? `(${timerLeft})` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Header of Plot -->
            <div class="flex items-center justify-between gap-2 mb-2 relative z-10 min-w-0">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span class="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                  isOpen 
                    ? 'bg-[#0E5431] text-white dark:bg-emerald-500 dark:text-slate-950 shadow-xs' 
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200'
                }">
                  ${plot.valve?.id || 'G' + plot.plotNumber}
                </span>
                <div class="min-w-0 flex-1">
                  <h3 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">${plot.crop}</h3>
                  <span class="text-[10px] font-medium text-slate-500 dark:text-slate-400 block truncate">Zone ${plot.plotNumber} • ${plot.stage}</span>
                </div>
              </div>

              <!-- Valve State Indicator Pill -->
              <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold shrink-0 ${
                isOpen 
                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-[#0E5431] dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700' 
                  : 'bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-[#0E5431] dark:bg-emerald-400 animate-ping' : 'bg-slate-400'}"></span>
                ${plot.valve?.state || 'CLOSED'}
              </div>
            </div>

            <!-- VWC Moisture Bar & Metric -->
            <div class="mt-3 relative z-10">
              <div class="flex items-baseline justify-between text-xs mb-1">
                <span class="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Mean Soil VWC</span>
                <span class="font-mono font-bold ${moistureStyle.text} text-sm">${avgVwc}%</span>
              </div>
              
              <!-- Progress bar -->
              <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden border border-slate-300/60 dark:border-slate-700/60 p-0.5">
                <div class="h-full rounded-full transition-all duration-700" style="width: ${Math.min(100, (avgVwc / 45) * 100)}%; background-color: ${moistureStyle.hex}"></div>
              </div>
            </div>

            <!-- Multi-Depth Sensor Mini Readout -->
            <div class="mt-3 pt-2 border-t border-slate-200/80 dark:border-slate-750/80 grid grid-cols-3 gap-1 text-[10px] font-mono text-center relative z-10">
              ${(plot.soilSensors || []).map(s => `
                <div class="bg-white dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                  <span class="text-slate-500 dark:text-slate-400 block text-[9px] font-medium">${s.depthCm}cm</span>
                  <span class="font-bold text-slate-800 dark:text-slate-100">${s.vwc}%</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach selection clicks
  container.querySelectorAll('.plot-card').forEach(card => {
    card.addEventListener('click', () => {
      const plotId = card.getAttribute('data-plot-id');
      if (onSelectPlot) onSelectPlot(plotId);
    });
  });

  return container;
}
