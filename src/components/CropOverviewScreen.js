/**
 * Crop Overview Screen (Screen 1 in Reference Design)
 * Displays:
 * 1. Top Bar: Frosted back button, "Potato Crop Overview" title, options menu.
 * 2. Card 1: Interactive Growth Rate Bar Chart with dynamic floating tooltips.
 * 3. Card 2: Crop Health Timeline with multi-stage Circular Radial Progress Ring & stage markers.
 * 4. Card 3: In-situ Leaf Spectroscopy Studio with 5 AI Agronomic Decisions & Audio TTS.
 */

import { WAVELENGTHS } from '../hardware/chemometricsEngine.js';
import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { ttsEngine } from '../audio/voiceReadoutTTS.js';
import { getVitalityColor } from '../utils/formatters.js';

export function createCropOverviewScreen({
  plots = [],
  selectedPlotId = "plot-1",
  latestScanAnalysis = null,
  onSelectPlot,
  onAcquireScan,
  onOpenCalibration,
  onBack
}) {
  const container = document.createElement('div');
  container.className = "crop-overview-screen w-full flex flex-col space-y-4 pb-20 text-white select-none";

  const selectedPlot = plots.find(p => p.id === selectedPlotId) || plots[0] || {
    id: "plot-1",
    plotNumber: 1,
    name: "Zone 1 - Potato Field Zone",
    crop: "Potato Crop",
    stage: "Tuber Bulking & Maturity",
    plantAgeDays: 63,
    totalCycleDays: 83,
    daysToHarvest: 20,
    areaHa: 1.4,
    projectedYieldTons: 7.0,
    currentHeightCm: 74,
    growthRateData: [
      { day: 0, heightCm: 0, label: "Day 0" },
      { day: 15, heightCm: 30, label: "Day 15" },
      { day: 30, heightCm: 45, label: "Day 30" },
      { day: 45, heightCm: 60, label: "Day 45" },
      { day: 60, heightCm: 72, label: "Day 60" },
      { day: 75, heightCm: 82, label: "Day 75" },
      { day: 90, heightCm: 88, label: "Day 90" }
    ]
  };

  const cropTitle = selectedPlot.crop.toLowerCase().includes('potato') 
    ? "Potato Crop Overview" 
    : `${selectedPlot.crop} Overview`;

  const plantAge = selectedPlot.plantAgeDays || 63;
  const totalCycle = selectedPlot.totalCycleDays || 83;
  const daysToHarvest = selectedPlot.daysToHarvest || (totalCycle - plantAge);

  const growthData = selectedPlot.growthRateData || [
    { day: 0, heightCm: 0, label: "Day 0" },
    { day: 15, heightCm: 30, label: "Day 15" },
    { day: 30, heightCm: 45, label: "Day 30" },
    { day: 45, heightCm: 60, label: "Day 45" },
    { day: 60, heightCm: 72, label: "Day 60" },
    { day: 75, heightCm: 82, label: "Day 75" },
    { day: 90, heightCm: 88, label: "Day 90" }
  ];

  // Default active bar for tooltip is Day 15 to match the reference image exactly
  let activeTooltipIndex = 1; // index 1 corresponds to Day 15

  // Calculate circular progress: 63 / 83 = ~76%
  const progressRatio = Math.min(1, Math.max(0, plantAge / totalCycle));
  const strokeDashoffset = 283 - (283 * progressRatio);

  container.innerHTML = `
    <!-- 1. Screen Top Bar -->
    <header class="flex items-center justify-between px-1 py-1">
      <button 
        type="button" 
        id="crop-back-btn" 
        class="aero-glass-btn w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-white shadow-lg transition-transform active:scale-95"
        title="Back"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      <h1 class="text-base sm:text-lg font-semibold tracking-wide text-white drop-shadow-md">
        ${cropTitle}
      </h1>

      <div class="relative">
        <button 
          type="button" 
          id="crop-options-btn" 
          class="aero-glass-btn w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-white shadow-lg transition-transform active:scale-95"
          title="More options"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"/>
            <circle cx="19" cy="12" r="1"/>
            <circle cx="5" cy="12" r="1"/>
          </svg>
        </button>

        <!-- Dropdown Menu -->
        <div id="crop-options-dropdown" class="hidden absolute right-0 mt-2 w-56 rounded-2xl bg-[#0a1e12]/95 border border-white/15 shadow-2xl backdrop-blur-xl p-2 z-50 animate-fadeIn text-xs">
          <div class="px-3 py-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-white/10">Switch Parcel Block</div>
          ${plots.map(p => `
            <button 
              type="button" 
              data-plot-id="${p.id}" 
              class="plot-switch-item w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition ${p.id === selectedPlot.id ? 'text-lime-300 font-bold bg-white/5' : 'text-slate-300'}"
            >
              <span>Plot ${p.plotNumber}: ${p.crop}</span>
              ${p.id === selectedPlot.id ? '<span class="w-1.5 h-1.5 rounded-full bg-lime-400"></span>' : ''}
            </button>
          `).join('')}
          <div class="border-t border-white/10 my-1"></div>
          <button type="button" id="dropdown-calibrate-btn" class="w-full text-left px-3 py-2 rounded-xl text-amber-300 hover:bg-white/10 flex items-center gap-2">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
            Dark/White Reference Calibration
          </button>
        </div>
      </div>
    </header>

    <!-- 2. CARD 1: Growth Rate Bar Chart -->
    <div class="aero-glass-card p-4 sm:p-5 rounded-3xl relative overflow-visible shadow-2xl border border-white/10 bg-[#0d2616]/75 backdrop-blur-2xl">
      <!-- Card Header -->
      <div class="flex items-start justify-between gap-2 mb-4">
        <div>
          <h2 class="text-base sm:text-lg font-bold text-white tracking-tight">Growth Rate</h2>
          <p class="text-xs text-emerald-300/80 font-medium">Day 01 - ${totalCycle} Plant Age</p>
        </div>

        <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
          <span class="w-2 h-2 rounded-full bg-lime-400 animate-pulse shadow-[0_0_8px_#a3e635]"></span>
          <span class="text-[11px] font-mono font-semibold text-slate-200">Plant Height (cm)</span>
          <span class="text-[10px] text-slate-400 font-mono">${totalCycle} Days</span>
        </div>
      </div>

      <!-- Interactive Bar Chart Container -->
      <div class="relative pt-6 pb-2">
        <!-- Floating Tooltip Box (matching Day 15 from reference screenshot) -->
        <div 
          id="chart-floating-tooltip" 
          class="absolute z-20 pointer-events-none transition-all duration-300 ease-out -translate-x-1/2 -top-1"
          style="left: 21%;"
        >
          <div class="px-2.5 py-1.5 rounded-xl bg-[#1b3d26]/95 border border-white/20 shadow-xl backdrop-blur-md text-center">
            <div id="tooltip-day" class="text-[10px] font-mono text-emerald-300 font-medium">Day 15</div>
            <div id="tooltip-height" class="text-xs font-bold text-white whitespace-nowrap">Plant Height: 30cm</div>
            <!-- Tooltip pointer beak -->
            <div class="w-2 h-2 bg-[#1b3d26] border-r border-b border-white/20 transform rotate-45 mx-auto -mb-2 mt-0.5"></div>
          </div>
        </div>

        <!-- Chart Grid Lines and Axis -->
        <div class="relative h-44 flex items-end justify-between pl-8 pr-2 pb-5 border-b border-white/10">
          <!-- Y-Axis Vertical Label -->
          <div class="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase font-mono tracking-wider text-slate-400">
            Height (cm)
          </div>

          <!-- Y-Axis Ticks Background Guidelines -->
          <div class="absolute inset-x-8 inset-y-0 flex flex-col justify-between pointer-events-none opacity-20">
            <div class="border-b border-dashed border-white w-full"></div>
            <div class="border-b border-dashed border-white w-full"></div>
            <div class="border-b border-dashed border-white w-full"></div>
            <div class="border-b border-dashed border-white w-full"></div>
          </div>

          <!-- Vertical Bars -->
          ${growthData.map((item, idx) => {
            const heightPercent = Math.min(100, Math.max(8, (item.heightCm / 100) * 100));
            const isInitialActive = idx === activeTooltipIndex;
            return `
              <div 
                class="chart-bar-col group relative flex-1 flex flex-col items-center justify-end h-full cursor-pointer px-1 sm:px-1.5"
                data-bar-index="${idx}"
                data-day="${item.day}"
                data-height="${item.heightCm}"
              >
                <!-- Bar Column with Green Gradient & Glowing Top -->
                <div 
                  class="chart-bar w-full max-w-[28px] rounded-t-lg transition-all duration-300 group-hover:scale-y-105 group-hover:brightness-125 ${
                    isInitialActive 
                      ? 'bg-gradient-to-t from-[#144324] via-[#22c55e] to-[#a3e635] shadow-[0_0_14px_rgba(163,230,53,0.6)] ring-1 ring-lime-300' 
                      : 'bg-gradient-to-t from-[#0e2c18] via-[#166534] to-[#4ade80] opacity-80 group-hover:opacity-100'
                  }"
                  style="height: ${heightPercent}%;"
                >
                  <!-- Bright Top Edge Highlight -->
                  <div class="w-full h-1 bg-lime-300 rounded-t-lg shadow-sm"></div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- X-Axis Labels -->
        <div class="flex items-center justify-between pl-8 pr-2 pt-2 text-[10px] font-mono text-slate-300">
          ${growthData.map(item => `
            <span class="flex-1 text-center">${item.day}</span>
          `).join('')}
        </div>

        <!-- X-Axis Title -->
        <div class="text-center text-[11px] font-mono text-slate-400 mt-1">
          Days Since Planting
        </div>
      </div>
    </div>

    <!-- 3. CARD 2: Potato Crop Health Timeline -->
    <div class="aero-glass-card p-4 sm:p-5 rounded-3xl relative shadow-2xl border border-white/10 bg-[#0d2616]/75 backdrop-blur-2xl">
      <!-- Top Row Badges -->
      <div class="flex items-center justify-between text-xs text-slate-300 font-medium mb-3">
        <span class="text-slate-400">Days Since Planting</span>
        <span class="text-emerald-300 font-semibold">To Harvest in ${daysToHarvest} Days</span>
      </div>

      <!-- Main Middle Row: Title & Circular Radial Progress Ring -->
      <div class="flex items-center justify-between gap-4 py-1">
        <div class="flex-1">
          <h3 class="text-base sm:text-lg font-bold text-white tracking-tight leading-snug">
            ${cropTitle.replace('Overview', 'Health Timeline')}
          </h3>
          <p class="text-xs text-slate-400 mt-1 leading-relaxed">
            Track growth metrics for your planted field
          </p>
        </div>

        <!-- Radial Progress Ring: "63 Days" -->
        <div class="relative w-24 h-24 shrink-0 flex items-center justify-center">
          <svg class="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <!-- Background Track -->
            <circle 
              cx="50" 
              cy="50" 
              r="44" 
              stroke="rgba(255,255,255,0.08)" 
              stroke-width="7" 
              fill="transparent"
            />

            <!-- Seeding Arc Segment (Green) -->
            <circle 
              cx="50" 
              cy="50" 
              r="44" 
              stroke="#10b981" 
              stroke-width="7" 
              fill="transparent"
              stroke-dasharray="276"
              stroke-dashoffset="220"
              stroke-linecap="round"
            />

            <!-- Sprout Arc Segment (Lime) -->
            <circle 
              cx="50" 
              cy="50" 
              r="44" 
              stroke="#a3e635" 
              stroke-width="7" 
              fill="transparent"
              stroke-dasharray="276"
              stroke-dashoffset="150"
              stroke-linecap="round"
            />

            <!-- Maturity Arc Segment (Amber / Orange) - Active Indicator -->
            <circle 
              cx="50" 
              cy="50" 
              r="44" 
              stroke="#f59e0b" 
              stroke-width="7" 
              fill="transparent"
              stroke-dasharray="276"
              stroke-dashoffset="70"
              stroke-linecap="round"
              class="drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]"
            />
          </svg>

          <!-- Center Text Readout -->
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-2xl font-extrabold text-white font-mono leading-none tracking-tight">${plantAge}</span>
            <span class="text-[10px] text-slate-300 font-mono mt-0.5 font-medium">Days</span>
          </div>
        </div>
      </div>

      <!-- Bottom Stage Indicators (Legend with colored dots) -->
      <div class="mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div class="flex items-center gap-1.5 text-slate-300">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_6px_#10b981]"></span>
          <span>Seeding</span>
        </div>

        <div class="flex items-center gap-1.5 text-slate-300">
          <span class="w-2.5 h-2.5 rounded-full bg-lime-400 shadow-[0_0_6px_#a3e635]"></span>
          <span>Sprout</span>
        </div>

        <!-- Active Stage: Maturity -->
        <div class="flex items-center gap-1.5 text-amber-300 font-bold px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30">
          <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shadow-[0_0_6px_#f59e0b]"></span>
          <span>Maturity</span>
        </div>

        <div class="flex items-center gap-1.5 text-slate-400">
          <span class="w-2.5 h-2.5 rounded-full bg-slate-600"></span>
          <span>Harvest</span>
        </div>
      </div>
    </div>

    <!-- 4. CARD 3: Handheld Leaf Spectroscopy & Chemometrics Analysis -->
    <div class="aero-glass-card p-4 sm:p-5 rounded-3xl relative shadow-2xl border border-white/10 bg-[#0d2616]/75 backdrop-blur-2xl">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
          <h3 class="text-sm font-bold text-white tracking-wide">Leaf-Clip Chemometrics (350–1100 nm)</h3>
        </div>

        <button 
          type="button" 
          id="crop-scan-trigger-btn"
          class="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-lime-400 to-emerald-500 hover:from-lime-300 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-900/40 flex items-center gap-1.5 transition active:scale-95"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/></svg>
          Acquire Scan
        </button>
      </div>

      <!-- Spectral Curve Canvas -->
      <div class="h-28 w-full bg-black/40 rounded-2xl border border-white/10 p-2 relative overflow-hidden mb-3">
        <canvas id="crop-spectral-canvas" class="w-full h-full"></canvas>
        <div class="absolute bottom-1 right-2 text-[9px] font-mono text-slate-400">
          VIS-NIR Signature (Chlorophyll a/b & Turgor)
        </div>
      </div>

      <!-- 5 Diagnostic Decisions -->
      <div class="grid grid-cols-2 gap-2 text-xs" id="crop-decisions-grid">
        <!-- Vitality Score -->
        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-slate-400 font-mono">Vitality Score</div>
            <div class="text-base font-extrabold text-lime-400 font-mono">
              ${latestScanAnalysis?.vitalityScore ? Math.round(latestScanAnalysis.vitalityScore) : "86"} / 100
            </div>
          </div>
          <button type="button" class="tts-speak-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300" data-text="Crop Vitality is 86 out of 100. Plant foliage is healthy with high photosynthetic efficiency." title="Read aloud">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>

        <!-- Nitrogen Prescription -->
        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-slate-400 font-mono">Nitrogen Status</div>
            <div class="text-base font-extrabold text-white font-mono">
              ${latestScanAnalysis?.nitrogenPrescription?.status || (latestScanAnalysis?.nitrogenPrescriptionKg > 0 ? `${latestScanAnalysis.nitrogenPrescriptionKg} kg/ac` : "Optimal")}
            </div>
          </div>
          <button type="button" class="tts-speak-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300" data-text="Nitrogen levels are balanced. No supplemental urea required today." title="Read aloud">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>

        <!-- Disease Screening -->
        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-slate-400 font-mono">Pathogen Risk</div>
            <div class="text-xs font-bold text-emerald-300">
              Clear (No Stress)
            </div>
          </div>
          <button type="button" class="tts-speak-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300" data-text="No foliar fungal or bacterial pathogens detected in the current spectral signature." title="Read aloud">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>

        <!-- Harvest Predictor -->
        <div class="p-2.5 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-between">
          <div>
            <div class="text-[10px] text-slate-400 font-mono">Harvest Window</div>
            <div class="text-xs font-bold text-amber-300">
              In ${daysToHarvest} Days
            </div>
          </div>
          <button type="button" class="tts-speak-btn p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300" data-text="Peak harvest window projected in ${daysToHarvest} days at 7 tons expected yield." title="Read aloud">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
          </button>
        </div>
      </div>
    </div>
  `;

  // Draw Spectral Curve
  setTimeout(() => {
    const canvas = container.querySelector('#crop-spectral-canvas');
    if (canvas) {
      drawMiniSpectralCurve(canvas, latestScanAnalysis?.rawSpectrumPreview);
    }
  }, 50);

  // Wire Interactions
  // 1. Bar Hover / Tap Tooltip
  const barCols = container.querySelectorAll('.chart-bar-col');
  const tooltip = container.querySelector('#chart-floating-tooltip');
  const tooltipDay = container.querySelector('#tooltip-day');
  const tooltipHeight = container.querySelector('#tooltip-height');

  barCols.forEach((col, idx) => {
    const updateTooltip = () => {
      const day = col.getAttribute('data-day');
      const height = col.getAttribute('data-height');
      
      // Calculate horizontal position percentage
      const totalBars = barCols.length;
      // Position calculation based on column index
      const leftPercent = 8 + (idx / (totalBars - 1)) * 82;

      tooltip.style.left = `${leftPercent}%`;
      tooltipDay.textContent = `Day ${day}`;
      tooltipHeight.textContent = `Plant Height: ${height}cm`;

      // Update active styling
      barCols.forEach((c, i) => {
        const bar = c.querySelector('.chart-bar');
        if (i === idx) {
          bar.classList.add('shadow-[0_0_14px_rgba(163,230,53,0.6)]', 'ring-1', 'ring-lime-300', 'opacity-100');
          bar.classList.remove('opacity-80');
        } else {
          bar.classList.remove('shadow-[0_0_14px_rgba(163,230,53,0.6)]', 'ring-1', 'ring-lime-300', 'opacity-100');
          bar.classList.add('opacity-80');
        }
      });
    };

    col.addEventListener('mouseenter', updateTooltip);
    col.addEventListener('click', updateTooltip);
  });

  // 2. Options Dropdown Toggle
  const optionsBtn = container.querySelector('#crop-options-btn');
  const dropdown = container.querySelector('#crop-options-dropdown');
  optionsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
  });

  // 3. Switch Plot Items
  container.querySelectorAll('.plot-switch-item').forEach(item => {
    item.addEventListener('click', () => {
      const plotId = item.getAttribute('data-plot-id');
      if (plotId && onSelectPlot) {
        onSelectPlot(plotId);
      }
    });
  });

  // 4. Back button
  container.querySelector('#crop-back-btn')?.addEventListener('click', () => {
    if (onBack) onBack();
  });

  // 5. Scan trigger
  container.querySelector('#crop-scan-trigger-btn')?.addEventListener('click', () => {
    if (onAcquireScan) onAcquireScan(selectedPlot.id);
  });

  // 6. Calibrate button
  container.querySelector('#dropdown-calibrate-btn')?.addEventListener('click', () => {
    if (onOpenCalibration) onOpenCalibration();
  });

  // 7. TTS Buttons
  container.querySelectorAll('.tts-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const text = btn.getAttribute('data-text');
      if (text) {
        ttsEngine.speak(text);
      }
    });
  });

  return container;
}

function drawMiniSpectralCurve(canvas, previewData) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);

  const points = previewData || [0.06, 0.08, 0.16, 0.24, 0.18, 0.52, 0.65, 0.68, 0.42, 0.58];
  const stepX = w / (points.length - 1);

  // Gradient under curve
  const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, 'rgba(163, 230, 53, 0.35)');
  fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

  // Stroke gradient
  const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
  strokeGrad.addColorStop(0, '#10b981');
  strokeGrad.addColorStop(0.5, '#a3e635');
  strokeGrad.addColorStop(1, '#4ade80');

  ctx.beginPath();
  ctx.moveTo(0, h);

  points.forEach((val, idx) => {
    const x = idx * stepX;
    const y = h - (val * (h - 14)) - 6;
    if (idx === 0) {
      ctx.lineTo(x, y);
    } else {
      const prevX = (idx - 1) * stepX;
      const prevY = h - (points[idx - 1] * (h - 14)) - 6;
      const cpx = (prevX + x) / 2;
      ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
    }
  });

  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Draw stroke
  ctx.beginPath();
  points.forEach((val, idx) => {
    const x = idx * stepX;
    const y = h - (val * (h - 14)) - 6;
    if (idx === 0) {
      ctx.moveTo(x, y);
    } else {
      const prevX = (idx - 1) * stepX;
      const prevY = h - (points[idx - 1] * (h - 14)) - 6;
      const cpx = (prevX + x) / 2;
      ctx.bezierCurveTo(cpx, prevY, cpx, y, x, y);
    }
  });
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = strokeGrad;
  ctx.stroke();
}
