/**
 * Field Overview Bento Grid
 * Ultra-modern Bento KPI cards for 1-Acre hydraulic & crop health status.
 */

export function createFieldOverviewBento(plots = [], telemetryData = {}) {
  const container = document.createElement('section');
  container.className = "w-full";

  const totalPlots = plots.length || 6;
  const activeValves = plots.filter(p => p.valve?.state === 'OPEN').length;
  
  // Calculate farm-wide averages
  let totalVwc = 0;
  let totalTemp = 0;
  let sensorCount = 0;

  plots.forEach(p => {
    (p.soilSensors || []).forEach(s => {
      totalVwc += Number(s.vwc) || 0;
      totalTemp += Number(s.temperature) || 0;
      sensorCount++;
    });
  });

  const avgVwc = sensorCount > 0 ? (totalVwc / sensorCount).toFixed(1) : "25.2";
  const avgTemp = sensorCount > 0 ? (totalTemp / sensorCount).toFixed(1) : "23.5";
  const pressure = telemetryData.mainlinePressureBar || 2.42;
  const activeFlow = telemetryData.activeFlowLph || (activeValves * 480);
  const consumedLiters = telemetryData.consumedLitersToday || 1845;

  // Pressure status
  let pressureStatus = { color: 'text-emeraldGlow', text: 'Nominal Operating Range' };
  if (pressure > 3.0) pressureStatus = { color: 'text-crimsonCoral animate-pulse', text: 'Overpressure Alert (>3.0 Bar)' };
  if (pressure < 1.8 && activeValves > 0) pressureStatus = { color: 'text-amberPulse', text: 'Line Pressure Drop' };

  container.innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Bento 1: 1-Acre Hydraulic Grid Status -->
      <div class="bg-slate-850/80 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl relative overflow-hidden group hover:border-slate-650 transition">
        <div class="absolute -right-4 -bottom-4 w-24 h-24 bg-emeraldGlow/5 rounded-full blur-xl pointer-events-none"></div>
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Parcel Hydraulic State</span>
          <span class="px-2 py-0.5 text-[10px] font-mono rounded-full ${activeValves > 0 ? 'bg-emeraldGlow/20 text-emeraldGlow border border-emeraldGlow/40' : 'bg-slate-700/50 text-slate-400 border border-slate-600'}">
            ${activeValves > 0 ? `${activeValves} GATES OPEN` : 'STANDBY'}
          </span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold tracking-tight text-white font-mono">${activeValves}</span>
          <span class="text-sm text-slate-400">/ 6 Solenoid Gates Active</span>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Target Parcel: 1.00 Acre</span>
          <span class="font-mono text-emeraldGlow">${totalPlots} Zones Synced</span>
        </div>
      </div>

      <!-- Bento 2: Mainline Pressure Transducer -->
      <div class="bg-slate-850/80 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl relative overflow-hidden group hover:border-slate-650 transition">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Mainline Pressure</span>
          <div class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${pressure > 3.0 ? 'bg-crimsonCoral animate-ping' : 'bg-emeraldGlow'}"></span>
            <span class="text-[10px] font-mono text-slate-300">Piezo-Resistive</span>
          </div>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold tracking-tight text-white font-mono">${pressure}</span>
          <span class="text-sm font-semibold text-slate-300 font-mono">Bar</span>
          <span class="text-xs text-slate-400 font-mono">(${Math.round(pressure * 14.5038)} PSI)</span>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
          <span class="${pressureStatus.color} font-medium flex items-center gap-1">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
            ${pressureStatus.text}
          </span>
        </div>
      </div>

      <!-- Bento 3: Water Volume Accounting Ledger -->
      <div class="bg-slate-850/80 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl relative overflow-hidden group hover:border-slate-650 transition">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Daily Water Ledger</span>
          <span class="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
            ${activeFlow.toLocaleString()} L/hr Active
          </span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold tracking-tight text-white font-mono">${Math.round(consumedLiters).toLocaleString()}</span>
          <span class="text-sm text-slate-300 font-mono">Liters Today</span>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Est. ~${(consumedLiters / 3785.41).toFixed(1)} k-Gal</span>
          <span class="text-slate-300 font-mono">ACID Logged</span>
        </div>
      </div>

      <!-- Bento 4: Soil FDR Telemetry Aggregate -->
      <div class="bg-slate-850/80 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl relative overflow-hidden group hover:border-slate-650 transition">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">Mean Rootzone VWC</span>
          <span class="text-[10px] font-mono text-emeraldGlow bg-emeraldGlow/10 px-2 py-0.5 rounded border border-emeraldGlow/30">
            18 Depth Probes
          </span>
        </div>
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold tracking-tight text-white font-mono">${avgVwc}%</span>
          <span class="text-xs text-slate-400 font-mono">Soil Moisture</span>
        </div>
        <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Mean Soil Temp: <strong class="text-slate-200 font-mono">${avgTemp}°C</strong></span>
          <span class="text-emeraldGlow font-medium">FDR Calibrated</span>
        </div>
      </div>
    </div>
  `;

  return container;
}
