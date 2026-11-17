/**
 * Interactive 1-Acre 6-Plot Visual Canvas
 * Visualizes Plots 1 to 6 in a 2x3 acre parcel with live water ripples & moisture heatmaps.
 */
import { getMoistureColor, formatTimeRemaining } from '../utils/formatters.js';

export function createPlotCanvas6Zone(plots = [], selectedPlotId = "plot-1", onSelectPlot) {
  const container = document.createElement('section');
  container.className = "bg-slate-850/90 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl";

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
            </svg>
            1-Acre Hierarchical 6-Zone Field Canvas
          </h2>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
            Interactive Topology
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">Click any plot to focus spectroscopy diagnostics and probe telemetry.</p>
      </div>

      <!-- Legend -->
      <div class="flex items-center gap-3 text-[11px] font-medium text-slate-300">
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-emeraldGlow shadow-sm shadow-emeraldGlow/50"></span>
          Optimal (>22%)
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-amberPulse shadow-sm shadow-amberPulse/50"></span>
          Moderate (18-22%)
        </span>
        <span class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-full bg-crimsonCoral animate-pulse shadow-sm shadow-crimsonCoral/50"></span>
          Deficit (&lt;18%)
        </span>
      </div>
    </div>

    <!-- 1-Acre Field Grid: 2 rows of 3 plots -->
    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="acre-plots-grid">
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
          <div data-plot-id="${plot.id}" class="plot-card relative rounded-xl p-4 transition-all duration-300 cursor-pointer overflow-hidden border ${
            isSelected 
              ? 'ring-2 ring-emeraldGlow border-emeraldGlow/80 bg-slate-800/90 shadow-lg shadow-emeraldGlow/10' 
              : 'border-slate-750/70 bg-slate-800/50 hover:border-slate-650 hover:bg-slate-800/70'
          }">
            <!-- Water Pulse Animation Layer when Valve is OPEN -->
            ${isOpen ? `
              <div class="absolute inset-0 pointer-events-none overflow-hidden">
                <div class="absolute -inset-4 bg-gradient-to-r from-blue-500/10 via-cyan-400/20 to-blue-500/10 animate-pulse"></div>
                <!-- Concentric animated water ripples -->
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-cyan-400/40 animate-ping"></div>
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-blue-400/20 animate-ping" style="animation-delay: 0.6s"></div>
                <div class="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] font-mono font-bold text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-500/40">
                  <span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
                  WATERING ${timerLeft ? `(${timerLeft})` : ''}
                </div>
              </div>
            ` : ''}

            <!-- Header of Plot -->
            <div class="flex items-center justify-between mb-2 relative z-10">
              <div class="flex items-center gap-2">
                <span class="w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center ${
                  isOpen ? 'bg-emeraldGlow text-slate-950' : 'bg-slate-700 text-slate-200'
                }">
                  ${plot.valve?.id || 'G' + plot.plotNumber}
                </span>
                <div>
                  <h3 class="text-sm font-bold text-white tracking-tight">${plot.crop}</h3>
                  <span class="text-[10px] font-medium text-slate-400">Zone ${plot.plotNumber} • ${plot.stage}</span>
                </div>
              </div>

              <!-- Valve State Indicator Pill -->
              <div class="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                isOpen 
                  ? 'bg-emeraldGlow/20 text-emeraldGlow border border-emeraldGlow/40' 
                  : 'bg-slate-750 text-slate-400 border border-slate-700'
              }">
                <span class="w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emeraldGlow animate-ping' : 'bg-slate-500'}"></span>
                ${plot.valve?.state || 'CLOSED'}
              </div>
            </div>

            <!-- VWC Moisture Bar & Metric -->
            <div class="mt-3 relative z-10">
              <div class="flex items-baseline justify-between text-xs mb-1">
                <span class="text-slate-400 text-[11px]">Mean Soil VWC</span>
                <span class="font-mono font-bold ${moistureStyle.text} text-sm">${avgVwc}%</span>
              </div>
              
              <!-- Progress bar -->
              <div class="w-full h-2 rounded-full bg-slate-900/80 overflow-hidden border border-slate-700/60 p-0.5">
                <div class="h-full rounded-full transition-all duration-700" style="width: ${Math.min(100, (avgVwc / 45) * 100)}%; background-color: ${moistureStyle.hex}"></div>
              </div>
            </div>

            <!-- Multi-Depth Sensor Mini Readout -->
            <div class="mt-3 pt-2 border-t border-slate-750/80 grid grid-cols-3 gap-1 text-[10px] font-mono text-center text-slate-300 relative z-10">
              ${(plot.soilSensors || []).map(s => `
                <div class="bg-slate-850/90 rounded p-1 border border-slate-700/50">
                  <span class="text-slate-500 block text-[9px]">${s.depthCm}cm</span>
                  <span class="font-bold text-slate-200">${s.vwc}%</span>
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
