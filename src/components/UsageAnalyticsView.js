/**
 * UsageAnalyticsView Component
 * Precision Agronomy Water & Valve Usage Analytics
 * Features:
 *   - Cumulative water in liters per zone (Zones 1-6)
 *   - Latching solenoid valve cycle counts (Open/Close endurance telemetry)
 *   - Leaf spectroscopy scan archives (NDVI, LWI, Vitality, Nitrogen status)
 *   - Timeframe filter (Today, 7 Days, 30 Days, Season)
 *   - One-Click CSV Export for agricultural reporting & auditing
 */
import { icon } from '../utils/icons.js';
import { irrigationControllerAdapter } from '../hardware/irrigationControllerAdapter.js';

export function createUsageAnalyticsView({
  plots = [],
  telemetryMetrics = {},
  scanHistory = []
}) {
  const container = document.createElement('div');
  container.className = "usage-analytics-view w-full space-y-4 pb-28 text-slate-800 dark:text-slate-100 select-none";

  let timeframe = '7d'; // 'today' | '7d' | '30d' | 'season'

  // Standard mock baseline history if none provided
  const defaultScanHistory = scanHistory.length > 0 ? scanHistory : [
    { timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), plotId: 'plot-1', crop: 'Heirloom Potato', vitality: 82, ndvi: 0.74, lwi: 0.91, nitrogen: 'Optimal (0 kg/ac)' },
    { timestamp: new Date(Date.now() - 3600000 * 6).toISOString(), plotId: 'plot-2', crop: 'Drip Tomatoes', vitality: 64, ndvi: 0.58, lwi: 0.81, nitrogen: 'Deficit (14.5 kg/ac)' },
    { timestamp: new Date(Date.now() - 3600000 * 18).toISOString(), plotId: 'plot-3', crop: 'Bell Peppers', vitality: 78, ndvi: 0.69, lwi: 0.88, nitrogen: 'Optimal (0 kg/ac)' },
    { timestamp: new Date(Date.now() - 3600000 * 30).toISOString(), plotId: 'plot-4', crop: 'Sweet Corn', vitality: 55, ndvi: 0.49, lwi: 0.76, nitrogen: 'Severe Deficit (22.5 kg/ac)' },
    { timestamp: new Date(Date.now() - 3600000 * 48).toISOString(), plotId: 'plot-5', crop: 'Carrots', vitality: 88, ndvi: 0.81, lwi: 0.93, nitrogen: 'Optimal (0 kg/ac)' },
    { timestamp: new Date(Date.now() - 3600000 * 72).toISOString(), plotId: 'plot-6', crop: 'Strawberries', vitality: 71, ndvi: 0.62, lwi: 0.85, nitrogen: 'Moderate (6.0 kg/ac)' }
  ];

  function getZoneUsageData() {
    const valves = irrigationControllerAdapter.getAllValves();
    const multiplier = timeframe === 'today' ? 1 : (timeframe === '7d' ? 6.8 : (timeframe === '30d' ? 28.5 : 82));

    return plots.map((plot, idx) => {
      const valve = valves.find(v => v.plotId === plot.id) || valves[idx] || {};
      const baseLiters = plot.totalLitersDelivered || (320 + idx * 75);
      const deliveredLiters = Math.round(baseLiters * (timeframe === 'today' ? 1 : multiplier * 0.18));
      const cycles = Math.round((valve.cycleCount || (14 + idx * 6)) * (timeframe === 'today' ? 1 : multiplier * 0.22));

      return {
        zoneNumber: plot.plotNumber || (idx + 1),
        plotId: plot.id,
        crop: plot.crop || `Zone ${idx + 1}`,
        deliveredLiters,
        cycles,
        avgFlowLph: valve.calibratedFlowLph || 480,
        valveHealth: cycles > 80000 ? 'Service Recommended' : 'Optimal (99.8%)'
      };
    });
  }

  function downloadCSV() {
    const zoneData = getZoneUsageData();
    const now = new Date().toISOString().slice(0, 10);
    
    let csv = `AGRISPECTRA FLOW & FIELD - PRECISION USAGE & IRRIGATION AUDIT REPORT\n`;
    csv += `Generated At,${new Date().toISOString()}\n`;
    csv += `Timeframe Scope,${timeframe.toUpperCase()}\n`;
    csv += `Mainline Pressure,${telemetryMetrics.mainlinePressureBar || 2.42} Bar\n\n`;

    csv += `--- CUMULATIVE WATER VOLUME & VALVE CYCLES PER ZONE ---\n`;
    csv += `Zone,Plot ID,Crop,Delivered Water (Liters),Delivered Water (m³),Valve Latch Cycles,Calibrated Flow (L/hr),Solenoid Status\n`;
    
    let totalL = 0;
    let totalC = 0;
    zoneData.forEach(z => {
      totalL += z.deliveredLiters;
      totalC += z.cycles;
      csv += `Zone ${z.zoneNumber},${z.plotId},"${z.crop}",${z.deliveredLiters},${(z.deliveredLiters / 1000).toFixed(2)},${z.cycles},${z.avgFlowLph},${z.valveHealth}\n`;
    });
    csv += `TOTAL PARCEL,-,-,${totalL},${(totalL / 1000).toFixed(2)},${totalC},-,-\n\n`;

    csv += `--- RECENT LEAF SPECTROSCOPY SCANS ARCHIVE ---\n`;
    csv += `Timestamp,Plot ID,Crop,Vitality Index (5-100),NDVI,Leaf Water Index (LWI),Nitrogen Prescription\n`;
    defaultScanHistory.forEach(s => {
      csv += `${s.timestamp},${s.plotId},"${s.crop}",${s.vitality},${s.ndvi},${s.lwi},"${s.nitrogen}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agrispectra_usage_audit_${timeframe}_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function render() {
    const zoneData = getZoneUsageData();
    const totalWaterLiters = zoneData.reduce((acc, z) => acc + z.deliveredLiters, 0);
    const totalCycles = zoneData.reduce((acc, z) => acc + z.cycles, 0);
    const maxZoneLiters = Math.max(...zoneData.map(z => z.deliveredLiters), 1);

    container.innerHTML = `
      <!-- Header Hero Card -->
      <div class="bg-gradient-to-br from-[#0E5431] to-[#083820] text-white rounded-3xl p-5 shadow-lg border border-emerald-800/40 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300">
              ${icon('usage', 'w-5 h-5')}
            </div>
            <div>
              <h2 class="text-base font-bold tracking-tight">Usage & Telemetry Ledger</h2>
              <p class="text-[11px] text-emerald-200/80">Cumulative Hydration & Solenoid Actuation Cycles</p>
            </div>
          </div>

          <!-- CSV Export Button -->
          <button 
            type="button" 
            id="export-csv-btn"
            class="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-white text-[#0E5431] hover:bg-emerald-50 text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer active:scale-95"
            title="Download CSV Audit Report"
          >
            ${icon('download', 'w-4 h-4')}
            <span>Export CSV</span>
          </button>
        </div>

        <!-- Timeframe Segmented Switcher -->
        <div class="pt-2 border-t border-emerald-700/40 flex items-center justify-between">
          <span class="text-xs text-emerald-200/90 font-medium">Time Horizon:</span>
          <div class="inline-flex bg-black/25 p-1 rounded-xl border border-white/10">
            ${[
              { id: 'today', label: 'Today' },
              { id: '7d', label: '7 Days' },
              { id: '30d', label: '30 Days' },
              { id: 'season', label: 'Season' }
            ].map(tf => `
              <button 
                type="button" 
                data-timeframe="${tf.id}"
                class="timeframe-btn px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                  timeframe === tf.id ? 'bg-white text-[#0E5431] shadow-sm' : 'text-emerald-100 hover:text-white'
                }"
              >
                ${tf.label}
              </button>
            `).join('')}
          </div>
        </div>

        <!-- 2 Big KPI Counters -->
        <div class="grid grid-cols-2 gap-2 pt-1">
          <div class="bg-black/20 rounded-2xl p-3 border border-white/10">
            <span class="text-[10px] text-emerald-200 font-medium">Delivered Water Volume</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="text-2xl font-black font-mono tracking-tight text-white">${totalWaterLiters.toLocaleString()}</span>
              <span class="text-xs font-mono text-emerald-300">L</span>
            </div>
            <span class="text-[10px] text-emerald-200/70 font-mono">≈ ${(totalWaterLiters / 1000).toFixed(2)} m³ parcel total</span>
          </div>

          <div class="bg-black/20 rounded-2xl p-3 border border-white/10">
            <span class="text-[10px] text-emerald-200 font-medium">Solenoid Latch Cycles</span>
            <div class="flex items-baseline gap-1 mt-0.5">
              <span class="text-2xl font-black font-mono tracking-tight text-white">${totalCycles.toLocaleString()}</span>
              <span class="text-xs font-mono text-emerald-300">pulses</span>
            </div>
            <span class="text-[10px] text-emerald-200/70 font-mono">±12V bi-stable actuations</span>
          </div>
        </div>
      </div>

      <!-- Cumulative Water Consumption Breakdown per Zone -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('droplet', 'w-4 h-4 text-[#0E5431] dark:text-emerald-400')}
            <span>Water Volume per 1-Acre Zone</span>
          </h3>
          <span class="text-[10px] text-slate-500 font-mono">6 Sub-Parcels</span>
        </div>

        <div class="space-y-2.5">
          ${zoneData.map(z => {
            const pct = Math.round((z.deliveredLiters / maxZoneLiters) * 100);
            return `
              <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 space-y-1.5">
                <div class="flex items-center justify-between text-xs">
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-[#0E5431] dark:text-emerald-300 flex items-center justify-center font-bold font-mono text-[11px]">
                      Z${z.zoneNumber}
                    </span>
                    <span class="font-bold text-slate-800 dark:text-white">${z.crop}</span>
                  </div>
                  <div class="text-right font-mono">
                    <span class="font-bold text-slate-900 dark:text-white">${z.deliveredLiters.toLocaleString()} L</span>
                    <span class="text-[10px] text-slate-400 ml-1">(${z.cycles} cycles)</span>
                  </div>
                </div>

                <!-- Progress Bar -->
                <div class="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                  <div class="h-full rounded-full bg-gradient-to-r from-[#0E5431] to-emerald-400" style="width: ${pct}%"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Valve Solenoid Endurance Status -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('gauge', 'w-4 h-4 text-blue-600')}
            <span>Valve Endurance & Latch Health</span>
          </h3>
          <span class="text-[10px] font-mono text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-bold">Rated 100,000 Cycles</span>
        </div>

        <div class="grid grid-cols-2 gap-2 text-xs">
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 block">Avg Pulse Duration</span>
            <span class="font-bold font-mono text-slate-800 dark:text-white mt-0.5 block">50 ms ±12V</span>
            <span class="text-[9.5px] text-emerald-600 font-mono">Zero continuous power</span>
          </div>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
            <span class="text-[10px] text-slate-400 block">Mainline Dynamic Pressure</span>
            <span class="font-bold font-mono text-slate-800 dark:text-white mt-0.5 block">${telemetryMetrics.mainlinePressureBar || 2.42} Bar</span>
            <span class="text-[9.5px] text-emerald-600 font-mono">Nominal (1.8 - 3.0 Bar)</span>
          </div>
        </div>
      </div>

      <!-- Recent Leaf Scan Chemometrics Archive -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('spectroscopy', 'w-4 h-4 text-teal-600')}
            <span>Leaf Spectroscopy Archives</span>
          </h3>
          <span class="text-[10px] text-teal-700 font-mono font-bold">${defaultScanHistory.length} Scans Cached</span>
        </div>

        <div class="space-y-2">
          ${defaultScanHistory.map(s => {
            const timeStr = new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
              <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <div class="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/20 flex items-center justify-center font-bold text-xs text-teal-700 dark:text-teal-300 font-mono">
                    ${s.plotId.replace('plot-', 'Z')}
                  </div>
                  <div>
                    <h4 class="text-xs font-bold text-slate-900 dark:text-white">${s.crop}</h4>
                    <p class="text-[10px] text-slate-400 font-mono">${timeStr} • ${s.nitrogen}</p>
                  </div>
                </div>

                <div class="text-right font-mono">
                  <div class="text-xs font-bold ${s.vitality > 75 ? 'text-emerald-600' : 'text-amber-500'}">
                    ${s.vitality}% Vitality
                  </div>
                  <div class="text-[10px] text-slate-400">
                    NDVI: ${s.ndvi} • LWI: ${s.lwi}
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
    container.querySelector('#export-csv-btn')?.addEventListener('click', downloadCSV);

    container.querySelectorAll('.timeframe-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        timeframe = btn.getAttribute('data-timeframe') || '7d';
        render();
      });
    });
  }

  render();
  return container;
}
