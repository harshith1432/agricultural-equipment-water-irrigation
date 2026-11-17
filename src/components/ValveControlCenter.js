/**
 * 6-Zone Hydraulic Valve Control Center
 * Manages Solenoid latching pulse actuation (+12V / -12V), countdown timers, and FDR depth probes.
 */
import { formatTimeRemaining, getMoistureColor } from '../utils/formatters.js';

export function createValveControlCenter(plots = [], onActuateValve) {
  const container = document.createElement('section');
  container.className = "bg-slate-850/90 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl";

  container.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>
            </svg>
            6-Zone Solenoid Hydraulic Actuation Hub
          </h2>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-blue-950/80 text-blue-300 border border-blue-500/30">
            ±12V DC Latching
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">Bi-stable latching solenoid pulses with auto-countdown shutoff.</p>
      </div>

      <div class="text-xs text-slate-400 font-mono">
        Default Pulse: <span class="text-emeraldGlow font-bold">250ms ±12V</span>
      </div>
    </div>

    <!-- 6 Gates Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      ${plots.map(plot => {
        const valve = plot.valve || { id: 'G' + plot.plotNumber, state: 'CLOSED', flowRate: 450 };
        const isOpen = valve.state === 'OPEN';
        const timerLeft = formatTimeRemaining(valve.timerEnd);

        // Average moisture
        let avgVwc = 25.0;
        if (plot.soilSensors && plot.soilSensors.length > 0) {
          const sum = plot.soilSensors.reduce((a, s) => a + Number(s.vwc), 0);
          avgVwc = Number((sum / plot.soilSensors.length).toFixed(1));
        }
        const moistureStyle = getMoistureColor(avgVwc);

        return `
          <div class="valve-card bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative overflow-hidden transition-all duration-200 hover:border-slate-600">
            <!-- Header of Valve Card -->
            <div class="flex items-center justify-between mb-3">
              <div class="flex items-center gap-2">
                <div class="w-8 h-8 rounded-lg font-mono font-bold text-sm flex items-center justify-center ${
                  isOpen ? 'bg-emeraldGlow text-slate-950 shadow-md shadow-emeraldGlow/30' : 'bg-slate-700 text-slate-200'
                }">
                  ${valve.id}
                </div>
                <div>
                  <h3 class="text-sm font-bold text-white">${plot.crop}</h3>
                  <span class="text-[10px] text-slate-400 font-mono">Zone ${plot.plotNumber} • Flow: ${valve.flowRate || 450} L/h</span>
                </div>
              </div>

              <!-- State Tag -->
              <span class="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold tracking-wide ${
                isOpen ? 'bg-emeraldGlow/20 text-emeraldGlow border border-emeraldGlow/40 animate-pulse' : 'bg-slate-900 text-slate-400 border border-slate-750'
              }">
                ${valve.state}
              </span>
            </div>

            <!-- Pulse Actuation & Timer Status -->
            <div class="bg-slate-850/90 rounded-lg p-3 border border-slate-750 mb-3">
              <div class="flex items-center justify-between text-xs mb-1">
                <span class="text-slate-400">Actuation Status:</span>
                <span class="font-mono font-semibold ${isOpen ? 'text-emeraldGlow' : 'text-slate-400'}">
                  ${isOpen ? `OPEN • ${timerLeft || 'Active'}` : 'CLOSED (Latched)'}
                </span>
              </div>
              <div class="flex items-center justify-between text-[11px] text-slate-400">
                <span>Voltage State:</span>
                <span class="font-mono text-slate-300">
                  ${isOpen ? '+12V Open Pulse Sent' : '-12V Reverse Locked'}
                </span>
              </div>
            </div>

            <!-- FDR Soil Probes Readout -->
            <div class="grid grid-cols-3 gap-1.5 text-center mb-4">
              ${(plot.soilSensors || []).map(sensor => `
                <div class="bg-slate-900/60 rounded p-1.5 border border-slate-750/60">
                  <span class="text-[9px] text-slate-400 uppercase font-mono block">${sensor.depthCm || '10'}cm FDR</span>
                  <span class="text-xs font-mono font-bold text-slate-200">${sensor.vwc}%</span>
                  <span class="text-[9px] text-slate-400 block">${sensor.temperature}°C</span>
                </div>
              `).join('')}
            </div>

            <!-- Actuation Controls & Presets -->
            ${!isOpen ? `
              <div class="space-y-3">
                <div>
                  <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
                    <span>Target Irrigation Duration:</span>
                    <span class="text-emeraldGlow font-bold">Bi-Stable Latch</span>
                  </div>
                  <div class="grid grid-cols-4 gap-1.5">
                    <button data-duration="15" class="timer-btn min-h-[48px] flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-650 text-xs font-mono font-semibold text-slate-300 border border-slate-650 active:bg-slate-600 transition">15m</button>
                    <button data-duration="25" class="timer-btn active min-h-[48px] flex items-center justify-center rounded-xl bg-emeraldGlow/20 text-emeraldGlow border border-emeraldGlow/40 text-xs font-mono font-bold transition shadow-sm shadow-emeraldGlow/20">25m</button>
                    <button data-duration="45" class="timer-btn min-h-[48px] flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-650 text-xs font-mono font-semibold text-slate-300 border border-slate-650 active:bg-slate-600 transition">45m</button>
                    <button data-duration="60" class="timer-btn min-h-[48px] flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-650 text-xs font-mono font-semibold text-slate-300 border border-slate-650 active:bg-slate-600 transition">60m</button>
                  </div>
                </div>

                <!-- Neumorphic Slide / Tap to OPEN -->
                <button data-plot-id="${plot.id}" data-gate-id="${valve.id}" data-action="OPEN" class="valve-actuate-btn w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 border border-emerald-400/30 active:scale-98 transition transform">
                  <svg class="w-4 h-4 text-emerald-200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polygon points="5 3 19 12 5 21 5 3"/>
                  </svg>
                  Pulse +12V to Open Gate
                </button>
              </div>
            ` : `
              <div class="space-y-3">
                <button data-plot-id="${plot.id}" data-gate-id="${valve.id}" data-action="CLOSE" class="valve-actuate-btn w-full min-h-[48px] py-3 px-4 rounded-xl font-bold text-xs tracking-wider uppercase text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 shadow-lg shadow-red-900/30 flex items-center justify-center gap-2 border border-red-400/30 active:scale-98 transition transform">
                  <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="6" y="6" width="12" height="12"/>
                  </svg>
                  Send -12V Pulse to Close
                </button>
              </div>
            `}
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach duration selectors and actuation handlers
  container.querySelectorAll('.valve-card').forEach(card => {
    let selectedDuration = 25; // default 25 mins

    card.querySelectorAll('.timer-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        card.querySelectorAll('.timer-btn').forEach(b => {
          b.className = "timer-btn min-h-[48px] flex items-center justify-center rounded-xl bg-slate-700/60 hover:bg-slate-650 text-xs font-mono font-semibold text-slate-300 border border-slate-650 active:bg-slate-600 transition";
        });
        btn.className = "timer-btn active min-h-[48px] flex items-center justify-center rounded-xl bg-emeraldGlow/20 text-emeraldGlow border border-emeraldGlow/40 text-xs font-mono font-bold transition shadow-sm shadow-emeraldGlow/20";
        selectedDuration = parseInt(btn.getAttribute('data-duration'), 10);
      });
    });

    const actuateBtn = card.querySelector('.valve-actuate-btn');
    if (actuateBtn) {
      actuateBtn.addEventListener('click', () => {
        const plotId = actuateBtn.getAttribute('data-plot-id');
        const gateId = actuateBtn.getAttribute('data-gate-id');
        const action = actuateBtn.getAttribute('data-action');

        if (onActuateValve) {
          onActuateValve({
            plotId,
            gateId,
            action,
            durationMinutes: selectedDuration
          });
        }
      });
    }
  });

  return container;
}
