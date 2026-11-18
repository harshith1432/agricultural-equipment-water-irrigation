/**
 * AgriSpectra Field Operator Dashboard
 * Designed for Irrigation Technicians, Field Operators, and Hardware Maintenance Crews.
 * Focus: 1-Acre 6-Zone hydraulic plumbing topology, bi-stable ±12V DC latching solenoid actuation,
 * FDR multi-depth soil probes (10cm, 30cm, 50cm), mainline pressure transducer,
 * telemetry simulation, and Emergency 1-Tap Killswitch.
 */
import { createPlotCanvas6Zone } from '../PlotCanvas6Zone.js';
import { createValveControlCenter } from '../ValveControlCenter.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createFieldOperatorDashboard({
  plots = [],
  selectedPlotId = "plot-1",
  telemetryMetrics = {},
  irrigationLogs = [],
  onSelectPlot,
  onActuateValve,
  onEmergencyStop,
  onOpenSimModal
}) {
  const container = document.createElement('div');
  container.className = "space-y-6 animate-fadeIn";

  const activeValves = plots.filter(p => p.valve?.state === 'OPEN').length;
  const pressure = telemetryMetrics.mainlinePressureBar || 2.42;
  const isOverpressure = pressure > 3.0;
  const activeFlow = telemetryMetrics.activeFlowLph || (activeValves * 480);
  const consumedToday = telemetryMetrics.consumedLitersToday || 1845;

  // 1. Top Hydraulic Command Banner
  const banner = document.createElement('div');
  banner.className = `bg-gradient-to-r ${isOverpressure ? 'from-rose-950 via-slate-900 to-rose-950 border-rose-500/60' : 'from-blue-950 via-slate-900 to-cyan-950 border-blue-700/40'} text-white rounded-3xl p-6 sm:p-7 shadow-2xl border relative overflow-hidden`;
  banner.innerHTML = `
    <div class="absolute -right-8 -bottom-8 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5 mb-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-400/20 text-blue-300 border border-blue-400/30 uppercase tracking-widest">
            Field Operations
          </span>
          <span class="text-xs text-blue-200/80 font-mono font-medium">1-Acre 6-Zone Hydraulic Grid • ±12V Bi-Stable Controls</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white">
          Field Operator Hydraulic Command
        </h1>
        <p class="text-xs sm:text-sm text-blue-100/80 mt-1 max-w-2xl font-medium">
          Direct solenoid latch pulse actuation (+12V open / -12V close), multi-depth capacitive FDR probe monitoring, and hydraulic mainline isolation.
        </p>
      </div>

      <!-- Quick Action Controls -->
      <div class="flex items-center flex-wrap gap-2.5">
        <button id="btn-operator-sim" class="min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-blue-200 font-bold text-xs border border-blue-500/30 shadow transition flex items-center gap-2 cursor-pointer active:scale-95">
          <svg class="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
          </svg>
          <span>Telemetry Simulator</span>
        </button>

        <!-- EMERGENCY KILLSWITCH (High-Visibility Operational Button) -->
        <button id="btn-operator-killswitch" class="min-h-[48px] px-5 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white font-extrabold text-xs shadow-lg shadow-red-950/50 border border-red-400/50 transition flex items-center gap-2 cursor-pointer active:scale-95 animate-pulse">
          <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          <span>EMERGENCY STOP (ALL VALVES)</span>
        </button>
      </div>
    </div>
  `;
  container.appendChild(banner);

  // 2. Real-Time Hydraulic Telemetry Status Strip
  const telemetryStrip = document.createElement('div');
  telemetryStrip.className = "grid grid-cols-2 lg:grid-cols-4 gap-4";
  telemetryStrip.innerHTML = `
    <!-- Pressure Transducer -->
    <div class="p-4 rounded-2xl border ${isOverpressure ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-600' : 'bg-white dark:bg-slate-850 border-stone-200 dark:border-slate-750'} shadow-md">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Mainline Pressure</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isOverpressure ? 'bg-rose-600 text-white animate-ping' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'}">
          ${isOverpressure ? 'OVERPRESSURE (>3.0)' : 'NOMINAL'}
        </span>
      </div>
      <div class="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900 dark:text-white">
        ${pressure} <span class="text-sm font-normal text-stone-500">Bar</span>
      </div>
      <div class="text-[11px] text-stone-500 mt-1">4–20mA Piezoresistive Transducer</div>
    </div>

    <!-- Active Volumetric Flow Rate -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Active Flow Rate</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${activeValves > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-400'}">
          ${activeValves > 0 ? `${activeValves} VALVES OPEN` : 'STANDBY'}
        </span>
      </div>
      <div class="text-2xl sm:text-3xl font-extrabold font-mono text-blue-600 dark:text-blue-400">
        ${activeFlow} <span class="text-sm font-normal text-stone-500">L/h</span>
      </div>
      <div class="text-[11px] text-stone-500 mt-1">Pulse Hall-Effect Flowmeter</div>
    </div>

    <!-- Water Delivered Today -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Liters Delivered Today</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
          PARCEL TOTAL
        </span>
      </div>
      <div class="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900 dark:text-white">
        ${consumedToday.toLocaleString()} <span class="text-sm font-normal text-stone-500">Liters</span>
      </div>
      <div class="text-[11px] text-stone-500 mt-1">Cumulative NoSQL Accounting</div>
    </div>

    <!-- Environmental / Climate Mode -->
    <div class="p-4 rounded-2xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="flex items-center justify-between mb-1">
        <span class="text-[11px] font-bold text-stone-500 dark:text-slate-400 uppercase tracking-wider">Atmospheric Mode</span>
        <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          ${telemetryMetrics.weatherMode || 'NORMAL'}
        </span>
      </div>
      <div class="text-2xl sm:text-3xl font-extrabold font-mono text-stone-900 dark:text-white">
        ${telemetryMetrics.weatherMode === 'HEATWAVE' ? '☀️ Heatwave' : (telemetryMetrics.weatherMode === 'RAIN' ? '🌧️ Rainstorm' : '⛅ Normal')}
      </div>
      <div class="text-[11px] text-stone-500 mt-1">Evapotranspiration Adjustment Active</div>
    </div>
  `;
  container.appendChild(telemetryStrip);

  // 3. 1-Acre 6-Zone Visual Field Canvas Topology
  const canvasSection = createPlotCanvas6Zone(plots, selectedPlotId, (plotId) => {
    if (onSelectPlot) onSelectPlot(plotId);
  });
  canvasSection.id = "plot-canvas-section";
  container.appendChild(canvasSection);

  // 4. 6-Zone Solenoid Hydraulic Actuation Hub (Gates G1 - G6)
  const valveCenter = createValveControlCenter(plots, (params) => {
    if (onActuateValve) onActuateValve(params);
  });
  valveCenter.id = "valve-control-section";
  container.appendChild(valveCenter);

  // 5. Recent Actuation Activity & Hydraulic Event Log
  const logSection = document.createElement('div');
  logSection.className = "bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md";
  
  const displayLogs = (irrigationLogs && irrigationLogs.length > 0)
    ? irrigationLogs.slice(0, 5)
    : [
        { id: '1', gateId: 'G2', action: 'OPEN', timestamp: new Date(Date.now() - 12 * 60000).toISOString(), durationMinutes: 25, triggeredBy: 'CLOSED_LOOP' },
        { id: '2', gateId: 'G1', action: 'CLOSE', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), durationMinutes: 15, triggeredBy: 'MANUAL' },
        { id: '3', gateId: 'G5', action: 'CLOSE', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), durationMinutes: 30, triggeredBy: 'TIMER_END' }
      ];

  logSection.innerHTML = `
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Solenoid Pulse Actuation Event Log
        </h2>
        <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
          Real-time record of latching polarity pulses (+12V OPEN / -12V CLOSE) and automated timer expirations.
        </p>
      </div>
      <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-stone-100 dark:bg-slate-800 text-stone-600 dark:text-slate-300">
        ±12V Hardware Audit
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-stone-200 dark:border-slate-750 text-stone-400 font-mono uppercase text-[10px]">
            <th class="py-2.5 px-3">Gate</th>
            <th class="py-2.5 px-3">Action Pulse</th>
            <th class="py-2.5 px-3">Duration</th>
            <th class="py-2.5 px-3">Trigger Source</th>
            <th class="py-2.5 px-3 text-right">Timestamp</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-stone-100 dark:divide-slate-800 font-medium">
          ${displayLogs.map(log => {
            const isOpen = log.action === 'OPEN';
            return `
              <tr>
                <td class="py-3 px-3 font-mono font-bold text-stone-900 dark:text-white">
                  ${log.gateId}
                </td>
                <td class="py-3 px-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${isOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200'}">
                    ${isOpen ? '+12V DC LATCH OPEN' : '-12V DC REVERSE CLOSE'}
                  </span>
                </td>
                <td class="py-3 px-3 text-stone-600 dark:text-slate-300 font-mono">
                  ${log.durationMinutes ? `${log.durationMinutes} min` : 'Continuous'}
                </td>
                <td class="py-3 px-3 text-stone-600 dark:text-slate-300 font-mono">
                  ${log.triggeredBy || 'MANUAL'}
                </td>
                <td class="py-3 px-3 text-right text-stone-500 font-mono">
                  ${new Date(log.timestamp).toLocaleTimeString()}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  container.appendChild(logSection);

  // Attach Event Handlers
  const killBtn = banner.querySelector('#btn-operator-killswitch');
  if (killBtn && onEmergencyStop) {
    killBtn.addEventListener('click', () => onEmergencyStop());
  }

  const simBtn = banner.querySelector('#btn-operator-sim');
  if (simBtn && onOpenSimModal) {
    simBtn.addEventListener('click', () => onOpenSimModal());
  }

  return container;
}
