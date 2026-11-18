/**
 * AgriSpectra Agronomist Dashboard
 * Designed for Plant Scientists, Crop Advisors, and Agronomists.
 * Focus: Non-destructive leaf-clip optical spectroscopy (350-1100nm),
 * 5 Chemometrics Decision Engines, Edge ML Diagnostics, Sensor Calibration,
 * and Multi-Lingual Regional Voice TTS Readout.
 */
import {
  createSpectroscopyStudio,
  renderDecisionCards,
  drawSpectralCurve
} from '../SpectroscopyStudio.js';

export function createAgronomistDashboard({
  plots = [],
  selectedPlotId = "plot-2",
  latestScanAnalysis = null,
  bleState = {},
  onAcquireScan,
  onOpenCalibration,
  onSelectPlot
}) {
  const container = document.createElement('div');
  container.className = "space-y-6 animate-fadeIn";

  // 1. Top Agronomist Science Banner
  const banner = document.createElement('div');
  banner.className = "bg-gradient-to-r from-teal-900 via-emerald-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-teal-700/40 relative overflow-hidden";
  banner.innerHTML = `
    <div class="absolute -right-8 -bottom-8 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none"></div>
    
    <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5 mb-1.5">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-widest">
            Crop Science & Diagnostics
          </span>
          <span class="text-xs text-teal-200/80 font-mono font-medium">Edge Chemometrics Studio • 76 Spectral Bands</span>
        </div>
        <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight font-sans text-white">
          Agronomist Plant Science Dashboard
        </h1>
        <p class="text-xs sm:text-sm text-teal-100/80 mt-1 max-w-2xl font-medium">
          In-situ leaf-clip optical reflectance (350–1100 nm), 5 agronomic decision engines, pre-symptomatic disease classification, and calibrated nitrogen prescriptions.
        </p>
      </div>

      <!-- Hardware Link Status & Calibration Action -->
      <div class="flex items-center flex-wrap gap-2.5">
        <div class="min-h-[48px] px-3.5 py-2 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center gap-2.5 text-xs font-mono">
          <span class="w-2.5 h-2.5 rounded-full ${bleState.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
          <span class="text-slate-200">${bleState.connected ? (bleState.simulated ? 'BLE: Simulated Leaf-Clip' : 'BLE 5.0 GATT: Active') : 'BLE: Disconnected'}</span>
        </div>

        <button id="btn-agronomist-calib" class="min-h-[48px] px-4 py-2.5 rounded-2xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-lg shadow-teal-950/40 transition flex items-center gap-2 cursor-pointer active:scale-95">
          <svg class="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          <span>Calibrate Optical Sensor</span>
        </button>
      </div>
    </div>
  `;
  container.appendChild(banner);

  // 2. Spectroscopy Studio Section (Canvas & 5 Decisions)
  const studioSection = createSpectroscopyStudio({
    plots,
    selectedPlotId,
    onAcquireScan: (plotId) => {
      if (onAcquireScan) onAcquireScan(plotId);
    },
    onOpenCalibration: () => {
      if (onOpenCalibration) onOpenCalibration('FULL');
    }
  });
  studioSection.id = "spectroscopy-studio-section";
  container.appendChild(studioSection);

  // 3. Canopy Spectral Indices Cross-Zone Matrix
  const matrixSection = document.createElement('div');
  matrixSection.className = "bg-white dark:bg-slate-850 rounded-3xl p-6 border border-stone-200 dark:border-slate-750 shadow-md";
  matrixSection.innerHTML = `
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div>
        <h2 class="text-base sm:text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
          <svg class="w-5 h-5 text-teal-600 dark:text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 3v18h18"/>
            <path d="m19 9-5 5-4-4-3 3"/>
          </svg>
          1-Acre Canopy Chemometrics Comparison
        </h2>
        <p class="text-xs text-stone-500 dark:text-slate-400 mt-0.5">
          Comparison of NDVI (Vegetation Index), NDRE (Red Edge Chlorophyll), WBI (Water Band Index), and CIre.
        </p>
      </div>
      <span class="text-xs font-mono text-stone-500 dark:text-slate-400">
        Active Wavelength Range: <strong class="text-teal-600 dark:text-teal-400">350–1100 nm (10nm steps)</strong>
      </span>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-left text-xs">
        <thead>
          <tr class="border-b border-stone-200 dark:border-slate-750 text-stone-400 font-mono uppercase text-[10px]">
            <th class="py-2.5 px-3">Zone & Crop</th>
            <th class="py-2.5 px-3">NDVI (Vigor)</th>
            <th class="py-2.5 px-3">NDRE (Chlorophyll)</th>
            <th class="py-2.5 px-3">WBI / LWI (Water)</th>
            <th class="py-2.5 px-3">CIre Index</th>
            <th class="py-2.5 px-3">Pathogen Risk</th>
            <th class="py-2.5 px-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-stone-100 dark:divide-slate-800 font-medium">
          ${plots.map(p => {
            const isTarget = p.id === selectedPlotId;
            const ndvi = isTarget && latestScanAnalysis ? latestScanAnalysis.indices.ndvi : (p.plotNumber === 2 ? 0.68 : 0.84);
            const ndre = isTarget && latestScanAnalysis ? latestScanAnalysis.indices.ndre : (p.plotNumber === 2 ? 0.28 : 0.38);
            const lwi = isTarget && latestScanAnalysis ? latestScanAnalysis.indices.leafWaterIndex : (p.plotNumber === 2 ? 0.79 : 0.92);
            const cire = isTarget && latestScanAnalysis ? latestScanAnalysis.indices.cire : (p.plotNumber === 2 ? 2.1 : 3.4);
            const isStressed = lwi < 0.82 || ndre < 0.30;

            return `
              <tr class="${isTarget ? 'bg-teal-50/50 dark:bg-teal-950/20' : ''}">
                <td class="py-3 px-3 font-bold text-stone-900 dark:text-white flex items-center gap-2">
                  <span class="w-6 h-6 rounded-md bg-teal-800 text-white font-mono text-[10px] flex items-center justify-center">
                    Z${p.plotNumber}
                  </span>
                  <div>
                    <span class="block">${p.crop}</span>
                    <span class="text-[10px] text-stone-400 font-normal font-mono">${p.stage || 'Vegetative'}</span>
                  </div>
                </td>
                <td class="py-3 px-3 font-mono font-bold ${ndvi >= 0.75 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${ndvi}</td>
                <td class="py-3 px-3 font-mono font-bold ${ndre >= 0.31 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">${ndre}</td>
                <td class="py-3 px-3 font-mono font-bold ${lwi >= 0.85 ? 'text-cyan-600 dark:text-cyan-400' : 'text-rose-600 dark:text-rose-400'}">${lwi}</td>
                <td class="py-3 px-3 font-mono text-stone-700 dark:text-slate-300">${cire}</td>
                <td class="py-3 px-3">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isStressed ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}">
                    ${isStressed ? 'WATER STRESS' : 'HEALTHY'}
                  </span>
                </td>
                <td class="py-3 px-3 text-right">
                  <button data-plot-id="${p.id}" class="btn-scan-target px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-stone-800 dark:text-slate-200 text-xs font-bold transition cursor-pointer">
                    Scan Plot
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  container.appendChild(matrixSection);

  // Event handlers
  const calibBtn = banner.querySelector('#btn-agronomist-calib');
  if (calibBtn && onOpenCalibration) {
    calibBtn.addEventListener('click', () => onOpenCalibration('FULL'));
  }

  matrixSection.querySelectorAll('.btn-scan-target').forEach(btn => {
    btn.addEventListener('click', () => {
      const plotId = btn.getAttribute('data-plot-id');
      if (onSelectPlot) onSelectPlot(plotId);
      if (onAcquireScan) onAcquireScan(plotId);
    });
  });

  return container;
}
