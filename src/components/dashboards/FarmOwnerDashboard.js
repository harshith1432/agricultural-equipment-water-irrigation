/**
 * AgriSpectra Farm Owner Executive Dashboard
 * Designed for Agribusiness Owners, Farm Managers, and Executive Growers.
 * Focus: High-level farm KPIs, 1-acre water accounting, economic savings,
 * 6-zone crop health matrix, harvest timeline forecasting, and executive audit export.
 */
import { formatTimeRemaining, getMoistureColor } from '../../utils/formatters.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createFarmOwnerDashboard({
  plots = [],
  telemetryMetrics = {},
  actionRecommendations = [],
  onSynergyAction,
  onSelectPlot,
  onNavigateToRole,
  announcements = []
}) {
  const container = document.createElement('div');
  container.className = "space-y-6 animate-fadeIn";

  const totalPlots = plots.length || 6;
  const activeValves = plots.filter(p => p.valve?.state === 'OPEN').length;

  // Farm-wide averages
  let totalVwc = 0;
  let sensorCount = 0;
  let totalLitersSum = 0;

  plots.forEach(p => {
    totalLitersSum += Number(p.totalLitersDelivered) || 0;
    (p.soilSensors || []).forEach(s => {
      totalVwc += Number(s.vwc) || 0;
      sensorCount++;
    });
  });

  const avgVwc = sensorCount > 0 ? (totalVwc / sensorCount).toFixed(1) : "25.2";
  const consumedLiters = telemetryMetrics.consumedLitersToday || 1845;
  const dailyBudgetLiters = 3000;
  const budgetPercent = Math.min(100, Math.round((consumedLiters / dailyBudgetLiters) * 100));
  const estimatedSavingsLiters = Math.max(850, Math.round(consumedLiters * 0.42));
  const estimatedDollarSavings = (estimatedSavingsLiters * 0.038).toFixed(2); // ~$0.038/liter agronomic value

  // Count zones with stress (<18% moisture)
  const stressCount = plots.filter(p => {
    if (!p.soilSensors || p.soilSensors.length === 0) return false;
    const avg = p.soilSensors.reduce((a, s) => a + Number(s.vwc), 0) / p.soilSensors.length;
    return avg < 18.0;
  }).length;

  const parcelHealthScore = Math.max(60, 100 - (stressCount * 12));

  // Pending Synergy recommendations
  const pendingRecs = actionRecommendations.filter(r => r.status === 'PENDING');

  container.innerHTML = `
    <!-- Top Executive Banner -->
    <div class="bg-gradient-to-r from-emerald-900 via-teal-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-emerald-700/40 relative overflow-hidden">
      <div class="absolute -right-8 -bottom-8 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2.5 mb-1.5">
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase tracking-widest">
              Executive View
            </span>
            <span class="text-xs text-emerald-200/80 font-mono font-medium">1.00 Acre Drip Parcel • Sonoma Valley</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white">
            Farm Owner Executive Dashboard
          </h1>
          <p class="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-2xl font-medium">
            Real-time financial resource allocation, water conservation accounting, and closed-loop agronomic yields across all 6 zones.
          </p>
        </div>

        <!-- Executive Quick Actions -->
        <div class="flex items-center flex-wrap gap-2.5">
          <button id="btn-export-audit" class="min-h-[48px] px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 shadow-sm transition flex items-center gap-2 cursor-pointer active:scale-95">
            <svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
            </svg>
            <span>Export Farm Audit (CSV)</span>
          </button>

          <button id="btn-owner-deepdive-agronomy" class="min-h-[48px] px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-950/40 transition flex items-center gap-1.5 cursor-pointer active:scale-95">
            <span>Inspect Crop Science</span>
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Active Broadcast Notice (if any) -->
    ${announcements.length > 0 ? `
      <div class="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 flex items-center gap-3.5 text-amber-900 dark:text-amber-200 shadow-sm">
        <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"/>
          </svg>
        </div>
        <div class="flex-1 text-xs">
          <span class="font-bold uppercase tracking-wider text-[10px] text-amber-700 dark:text-amber-400">Operations Advisory:</span>
          <p class="font-semibold text-slate-800 dark:text-amber-100">${escapeHtml(announcements[0].message)}</p>
        </div>
      </div>
    ` : ''}

    <!-- 4 Executive KPI Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      
      <!-- KPI 1: Daily Water Budget -->
      <div class="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-stone-200 dark:border-slate-750 shadow-md flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">Daily Water Budget</span>
            <span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
              ${budgetPercent}% OF BUDGET
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white font-mono">${consumedLiters.toLocaleString()}</span>
            <span class="text-xs text-stone-500 dark:text-slate-400">/ ${dailyBudgetLiters.toLocaleString()} Liters</span>
          </div>
          <!-- Visual progress bar -->
          <div class="w-full bg-stone-100 dark:bg-slate-800 rounded-full h-2.5 mt-3 overflow-hidden">
            <div class="h-2.5 rounded-full ${budgetPercent > 90 ? 'bg-rose-500' : 'bg-emerald-500'}" style="width: ${budgetPercent}%"></div>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
          <span>Remaining Allocation</span>
          <span class="font-bold text-stone-800 dark:text-slate-200 font-mono">${(dailyBudgetLiters - consumedLiters).toLocaleString()} L</span>
        </div>
      </div>

      <!-- KPI 2: Water & Cost Savings Index -->
      <div class="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-stone-200 dark:border-slate-750 shadow-md flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">Conservation Savings</span>
            <span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
              CLOSED-LOOP
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">+${estimatedSavingsLiters.toLocaleString()}</span>
            <span class="text-xs text-stone-500 dark:text-slate-400">Liters Saved</span>
          </div>
          <p class="text-xs text-stone-600 dark:text-slate-300 mt-2 font-medium">
            Precision Drip vs Conventional Flood: <strong class="text-emerald-600 dark:text-emerald-400">+\$${estimatedDollarSavings}</strong> estimated daily resource savings.
          </p>
        </div>
        <div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
          <span>Irrigation Efficiency</span>
          <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">91.4% Target</span>
        </div>
      </div>

      <!-- KPI 3: 1-Acre Parcel Health -->
      <div class="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-stone-200 dark:border-slate-750 shadow-md flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">Parcel Health Index</span>
            <span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md ${
              stressCount > 0 ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
            }">
              ${stressCount > 0 ? `${stressCount} ZONE STRESSED` : 'ALL OPTIMAL'}
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white font-mono">${parcelHealthScore}</span>
            <span class="text-xs text-stone-500 dark:text-slate-400">/ 100 Score</span>
          </div>
          <div class="mt-2 text-xs text-stone-600 dark:text-slate-300 font-medium">
            <span>Average Soil Moisture: </span>
            <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">${avgVwc}% VWC</span>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
          <span>Active Canopy Surveillance</span>
          <span class="font-bold text-stone-800 dark:text-slate-200 font-mono">6 of 6 Zones</span>
        </div>
      </div>

      <!-- KPI 4: Hydraulic Actuation Status -->
      <div class="bg-white dark:bg-slate-850 rounded-2xl p-5 border border-stone-200 dark:border-slate-750 shadow-md flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold uppercase tracking-wider text-stone-500 dark:text-slate-400">Solenoid Actuators</span>
            <span class="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md ${
              activeValves > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-stone-100 text-stone-600 dark:bg-slate-800 dark:text-slate-400'
            }">
              ${activeValves > 0 ? `${activeValves} GATES OPEN` : 'STANDBY'}
            </span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-white font-mono">${activeValves}</span>
            <span class="text-xs text-stone-500 dark:text-slate-400">/ 6 Active Valves</span>
          </div>
          <div class="mt-2 text-xs text-stone-600 dark:text-slate-300 font-medium">
            <span>Line Pressure: </span>
            <span class="font-bold text-stone-800 dark:text-white font-mono">${telemetryMetrics.mainlinePressureBar || 2.42} Bar</span>
          </div>
        </div>
        <div class="mt-4 pt-3 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-stone-500 dark:text-slate-400">
          <span>Active Delivery Rate</span>
          <span class="font-bold text-blue-600 dark:text-blue-400 font-mono">${telemetryMetrics.activeFlowLph || (activeValves * 480)} L/h</span>
        </div>
      </div>

    </div>

    <!-- Closed-Loop Synergy Alerts Queue (High Priority Action) -->
    ${pendingRecs.length > 0 ? `
      <div class="bg-amber-50 dark:bg-amber-950/30 rounded-2xl p-5 border border-amber-300 dark:border-amber-600/40 shadow-lg">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center">
            <svg class="w-4 h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
          </div>
          <div>
            <h3 class="text-sm font-extrabold text-amber-950 dark:text-amber-100 uppercase tracking-wide">
              Closed-Loop Agronomic Synergy Action Required (${pendingRecs.length})
            </h3>
            <p class="text-xs text-amber-800 dark:text-amber-200/80 font-medium">
              Leaf-clip spectroscopy diagnosed acute dehydration verified by multi-depth FDR soil deficit.
            </p>
          </div>
        </div>

        <div class="space-y-3">
          ${pendingRecs.map(rec => `
            <div class="bg-white dark:bg-slate-800/90 rounded-xl p-4 border border-amber-200 dark:border-amber-500/30 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div class="flex items-center gap-2 mb-1">
                  <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500 text-white">
                    ZONE ${rec.plotNumber || '2'}
                  </span>
                  <span class="text-xs font-bold text-stone-900 dark:text-white">${rec.crop || 'Crop Zone'}</span>
                  <span class="text-[11px] text-stone-500 dark:text-slate-400 font-mono">• Gate ${rec.gateId || 'G2'}</span>
                </div>
                <p class="text-xs text-stone-700 dark:text-slate-300 font-medium">
                  ${escapeHtml(rec.reason || 'Canopy water stress detected. Automated 25-minute solenoid hydration cycle recommended.')}
                </p>
              </div>

              <div class="flex items-center gap-2 shrink-0">
                <button data-rec-id="${rec.id}" data-action="APPROVE" class="btn-rec-action min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition cursor-pointer">
                  Approve Pulse (${rec.recommendedDurationMinutes || 25}m)
                </button>
                <button data-rec-id="${rec.id}" data-action="DISMISS" class="btn-rec-action min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 dark:bg-slate-700 dark:hover:bg-slate-650 dark:text-slate-200 text-xs font-semibold transition cursor-pointer">
                  Dismiss
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}

    <!-- 6-Zone 1-Acre Field Status Summary Matrix -->
    <div class="bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
            </svg>
            1-Acre 6-Zone Field Status Matrix
          </h2>
          <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
            Operational snapshot of crop varieties, multi-depth moisture levels, and solenoid gate status.
          </p>
        </div>

        <div class="text-xs font-mono text-stone-500 dark:text-slate-400">
          Total Water Delivered: <strong class="text-emerald-600 dark:text-emerald-400 font-bold">${totalLitersSum.toLocaleString()} L</strong>
        </div>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${plots.map(plot => {
          let plotAvgVwc = 25.0;
          if (plot.soilSensors && plot.soilSensors.length > 0) {
            const sum = plot.soilSensors.reduce((a, s) => a + Number(s.vwc), 0);
            plotAvgVwc = Number((sum / plot.soilSensors.length).toFixed(1));
          }
          const isOpen = plot.valve?.state === 'OPEN';
          const moistureStatus = plotAvgVwc >= 22 ? 'OPTIMAL' : (plotAvgVwc >= 18 ? 'MODERATE' : 'DEFICIT');
          const statusBadgeColor = moistureStatus === 'OPTIMAL' 
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
            : (moistureStatus === 'MODERATE' 
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300'
              : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 animate-pulse');

          return `
            <div class="p-4 rounded-2xl border border-stone-200 dark:border-slate-700/80 bg-stone-50/60 dark:bg-slate-800/60 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center gap-2">
                    <span class="w-7 h-7 rounded-lg bg-emerald-700 text-white font-mono font-bold text-xs flex items-center justify-center">
                      Z${plot.plotNumber}
                    </span>
                    <div>
                      <h4 class="text-sm font-extrabold text-stone-900 dark:text-white leading-tight">${plot.crop}</h4>
                      <span class="text-[10px] text-stone-500 dark:text-slate-400 font-medium">${plot.stage || 'Vegetative Growth'}</span>
                    </div>
                  </div>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${statusBadgeColor}">
                    ${moistureStatus}
                  </span>
                </div>

                <!-- Soil Moisture Probes Summary -->
                <div class="grid grid-cols-3 gap-1.5 my-3 py-2 px-2.5 rounded-xl bg-white dark:bg-slate-850 border border-stone-200 dark:border-slate-700 text-center text-xs">
                  <div>
                    <div class="text-[10px] text-stone-400 font-mono">10cm</div>
                    <div class="font-bold text-stone-800 dark:text-slate-100 font-mono">${plot.soilSensors?.[0]?.vwc || '24.2'}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-stone-400 font-mono">30cm</div>
                    <div class="font-bold text-stone-800 dark:text-slate-100 font-mono">${plot.soilSensors?.[1]?.vwc || '26.1'}%</div>
                  </div>
                  <div>
                    <div class="text-[10px] text-stone-400 font-mono">50cm</div>
                    <div class="font-bold text-stone-800 dark:text-slate-100 font-mono">${plot.soilSensors?.[2]?.vwc || '28.0'}%</div>
                  </div>
                </div>

                <!-- Valve & Flow State -->
                <div class="flex items-center justify-between text-xs text-stone-600 dark:text-slate-300">
                  <div class="flex items-center gap-1.5">
                    <span class="w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500 animate-ping' : 'bg-stone-400'}"></span>
                    <span class="font-mono font-bold">${plot.valve?.id || 'G' + plot.plotNumber}: ${isOpen ? 'OPEN' : 'CLOSED'}</span>
                  </div>
                  <span class="font-mono text-[11px] text-stone-500">${plot.totalLitersDelivered || 310} L total</span>
                </div>
              </div>

              <!-- Action Link -->
              <div class="mt-4 pt-3 border-t border-stone-200 dark:border-slate-700/80 flex items-center justify-between">
                <button data-plot-id="${plot.id}" class="btn-inspect-zone text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 transition flex items-center gap-1 cursor-pointer">
                  <span>Inspect Zone Telemetry</span>
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Crop Ripening & Yield Forecast Table -->
    <div class="bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white">
            Yield & Harvest Forecast Matrix
          </h2>
          <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
            Canopy spectral indices model projected harvest windows and fertilizer requirements.
          </p>
        </div>
        <span class="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
          Urea Balance: 36.5 kg total
        </span>
      </div>

      <div class="overflow-x-auto">
        <table class="w-full text-left text-xs">
          <thead>
            <tr class="border-b border-stone-200 dark:border-slate-750 text-stone-400 font-mono uppercase text-[10px]">
              <th class="py-2.5 px-3">Zone & Crop</th>
              <th class="py-2.5 px-3">Growth Stage</th>
              <th class="py-2.5 px-3">Canopy Ripeness</th>
              <th class="py-2.5 px-3">Harvest Target</th>
              <th class="py-2.5 px-3">Nitrogen Prescription</th>
              <th class="py-2.5 px-3 text-right">Status</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-100 dark:divide-slate-800 font-medium">
            <tr>
              <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Plot 1: Bell Peppers
              </td>
              <td class="py-3 px-3 text-stone-600 dark:text-slate-300">Fruit Formation</td>
              <td class="py-3 px-3 font-mono font-bold text-stone-800 dark:text-slate-200">58% Ripening</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300 font-mono">~24 Days</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300">6.0 kg/acre Urea (Maintenance)</td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">ON TRACK</span>
              </td>
            </tr>
            <tr>
              <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                Plot 2: Heirloom Drip Tomatoes
              </td>
              <td class="py-3 px-3 text-stone-600 dark:text-slate-300">Fruit Sizing & Ripening</td>
              <td class="py-3 px-3 font-mono font-bold text-amber-600 dark:text-amber-400">77% Ripening</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300 font-mono">~9 Days (Urgent)</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300">14.5 kg/acre Urea (Moderate)</td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">WATER STRESS</span>
              </td>
            </tr>
            <tr>
              <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Plot 3: Sweet Corn (Golden Bantam)
              </td>
              <td class="py-3 px-3 text-stone-600 dark:text-slate-300">Silking & Tasseling</td>
              <td class="py-3 px-3 font-mono font-bold text-stone-800 dark:text-slate-200">42% Ripening</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300 font-mono">~31 Days</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300">0.0 kg/acre (Optimal)</td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">OPTIMAL</span>
              </td>
            </tr>
            <tr>
              <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Plot 4: Romaine Lettuce
              </td>
              <td class="py-3 px-3 text-stone-600 dark:text-slate-300">Head Formation</td>
              <td class="py-3 px-3 font-mono font-bold text-stone-800 dark:text-slate-200">84% Maturity</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300 font-mono">~6 Days</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300">8.0 kg/acre Calcium Nitrate</td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">HARVEST READY</span>
              </td>
            </tr>
            <tr>
              <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Plot 5: Strawberries (Albion Everbearing)
              </td>
              <td class="py-3 px-3 text-stone-600 dark:text-slate-300">Continuous Berry Ripening</td>
              <td class="py-3 px-3 font-mono font-bold text-stone-800 dark:text-slate-200">65% Brix Target</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300 font-mono">Ongoing (Every 3 Days)</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300">4.0 kg/acre Potassium</td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">OPTIMAL</span>
              </td>
            </tr>
            <tr>
              <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                Plot 6: Wine Grapes (Cabernet Sauvignon)
              </td>
              <td class="py-3 px-3 text-stone-600 dark:text-slate-300">Véraison (Berry Softening)</td>
              <td class="py-3 px-3 font-mono font-bold text-stone-800 dark:text-slate-200">22.4° Brix</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300 font-mono">~18 Days</td>
              <td class="py-3 px-3 text-stone-700 dark:text-slate-300">Water Deficit Deficit Strategy</td>
              <td class="py-3 px-3 text-right">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">REGULATED</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Attach Event Handlers
  const exportBtn = container.querySelector('#btn-export-audit');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      exportFarmAuditCSV(plots, telemetryMetrics);
    });
  }

  const deepdiveBtn = container.querySelector('#btn-owner-deepdive-agronomy');
  if (deepdiveBtn && onNavigateToRole) {
    deepdiveBtn.addEventListener('click', () => {
      onNavigateToRole('Agronomist');
    });
  }

  container.querySelectorAll('.btn-rec-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const recId = btn.getAttribute('data-rec-id');
      const action = btn.getAttribute('data-action');
      if (onSynergyAction) onSynergyAction(recId, action);
    });
  });

  container.querySelectorAll('.btn-inspect-zone').forEach(btn => {
    btn.addEventListener('click', () => {
      const plotId = btn.getAttribute('data-plot-id');
      if (onSelectPlot) onSelectPlot(plotId);
      if (onNavigateToRole) onNavigateToRole('Field Operator');
    });
  });

  return container;
}

/**
 * Generates and downloads a clean CSV file of current farm status
 */
function exportFarmAuditCSV(plots, telemetryMetrics) {
  const timestamp = new Date().toISOString();
  let csv = `AgriSpectra Flow & Field - Farm Executive Audit Report\n`;
  csv += `Generated At: ${timestamp}\n`;
  csv += `Mainline Pressure: ${telemetryMetrics.mainlinePressureBar || 2.42} Bar\n`;
  csv += `Total Consumed Today: ${telemetryMetrics.consumedLitersToday || 1845} Liters\n\n`;
  csv += `Zone,Gate,Crop,Growth Stage,Soil 10cm (%),Soil 30cm (%),Soil 50cm (%),Valve State,Delivered Liters\n`;

  plots.forEach(p => {
    const s10 = p.soilSensors?.[0]?.vwc || '24.2';
    const s30 = p.soilSensors?.[1]?.vwc || '26.1';
    const s50 = p.soilSensors?.[2]?.vwc || '28.0';
    const valveState = p.valve?.state || 'CLOSED';
    const liters = p.totalLitersDelivered || 310;
    csv += `Plot ${p.plotNumber},${p.valve?.id || 'G' + p.plotNumber},"${p.crop}","${p.stage}",${s10},${s30},${s50},${valveState},${liters}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `agrispectra_farm_audit_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
