/**
 * AgriSpectra Handheld Leaf-Clip Spectroscopy Studio
 * Spectral reflectance curve (350-1100 nm), 5 Farmer Agronomic Decisions, and Voice TTS.
 */
import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { WAVELENGTHS } from '../hardware/chemometricsEngine.js';
import { ttsEngine } from '../audio/voiceReadoutTTS.js';
import { getVitalityColor } from '../utils/formatters.js';

export function createSpectroscopyStudio({
  plots = [],
  selectedPlotId = "plot-1",
  onAcquireScan,
  onOpenCalibration
}) {
  const container = document.createElement('section');
  container.className = "bg-slate-850/90 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl";

  const selectedPlot = plots.find(p => p.id === selectedPlotId) || plots[0] || {
    id: "plot-1",
    plotNumber: 1,
    crop: "Bell Peppers",
    stage: "Fruit Formation"
  };

  container.innerHTML = `
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
      <div>
        <div class="flex items-center gap-2">
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            AgriSpectra Handheld Leaf-Clip Spectroscopy
          </h2>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-emeraldGlow/10 text-emeraldGlow border border-emeraldGlow/30">
            350–1100 nm VIS-NIR
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">Non-destructive in-situ chemometrics & pre-symptomatic physiological screening.</p>
      </div>

      <!-- Quick Action Controls -->
      <div class="flex items-center gap-2">
        <!-- Target Plot Selector -->
        <div class="min-h-[48px] flex items-center gap-2 bg-slate-800 px-3 py-2 rounded-xl border border-slate-700">
          <span class="text-xs text-slate-400 font-mono font-medium">Target:</span>
          <select id="spectro-plot-select" class="min-h-[44px] bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer">
            ${plots.map(p => `
              <option value="${p.id}" ${p.id === selectedPlot.id ? 'selected' : ''}>
                Plot ${p.plotNumber}: ${p.crop} (${p.valve?.id || 'G' + p.plotNumber})
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Scan Trigger Button -->
        <button id="spectro-scan-btn" class="min-h-[48px] flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emeraldGlow to-teal-400 hover:from-emeraldGlow-light hover:to-teal-300 shadow-lg shadow-emeraldGlow/25 border border-emerald-300 transition transform active:scale-95">
          <svg class="w-4 h-4 text-slate-950 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          </svg>
          <span>Acquire Leaf Scan</span>
        </button>
      </div>
    </div>

    <!-- Active Status Bar -->
    <div class="bg-slate-800/80 rounded-xl p-3 border border-slate-750 flex flex-wrap items-center justify-between gap-2 mb-6 text-xs">
      <div class="flex items-center gap-3 font-mono">
        <span class="flex items-center gap-1.5 text-slate-300">
          <span class="w-2 h-2 rounded-full ${leafClipDevice.isConnected ? 'bg-emeraldGlow animate-ping' : 'bg-slate-500'}"></span>
          BLE Sensor: <strong class="text-white">${leafClipDevice.isConnected ? (leafClipDevice.isSimulated ? 'Simulated BLE 5.0' : 'Clip-Pro 500') : 'Disconnected'}</strong>
        </span>
        <span class="text-slate-500">|</span>
        <span class="text-slate-300">
          Optics: <strong class="${leafClipDevice.calibration.isCalibrated ? 'text-emeraldGlow' : 'text-amberPulse'}">
            ${leafClipDevice.calibration.isCalibrated ? '99% PTFE Calibrated' : 'Default Preset'}
          </strong>
        </span>
        <span class="text-slate-500">|</span>
        <span class="text-slate-300">Battery: <strong class="text-emeraldGlow font-mono">${leafClipDevice.batteryLevel}%</strong></span>
      </div>

      <button id="recalibrate-link-btn" class="text-xs text-amberPulse hover:text-amber-300 font-medium flex items-center gap-1">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Run Dark/White Calibration
      </button>
    </div>

    <!-- Interactive 350-1100 nm Spectral Reflectance Canvas -->
    <div class="bg-slate-900/90 rounded-2xl p-4 border border-slate-750 mb-6 shadow-inner">
      <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Reflectance Curve R(λ) [350 – 1100 nm]</span>
          <span class="text-[10px] font-mono text-emeraldGlow bg-emeraldGlow/10 px-2 py-0.5 rounded border border-emeraldGlow/30">76 Channels</span>
        </div>
        <div class="flex items-center gap-3 text-[10px] font-mono text-slate-400">
          <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-blue-400"></span> 450nm Chlorophyll</span>
          <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-green-400"></span> 550nm Green Peak</span>
          <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-rose-400"></span> 705nm Red Edge</span>
          <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-cyan-400"></span> 970nm Water Dip</span>
        </div>
      </div>

      <div class="relative w-full h-56 sm:h-64">
        <canvas id="spectral-canvas" class="w-full h-full"></canvas>
      </div>
    </div>

    <!-- 5 FARMER AGRONOMIC DECISION CARDS -->
    <div id="decision-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <!-- Will be filled dynamically by renderDecisionCards() -->
    </div>
  `;

  // Attach event handlers
  const plotSelect = container.querySelector('#spectro-plot-select');
  const scanBtn = container.querySelector('#spectro-scan-btn');
  const recalibBtn = container.querySelector('#recalibrate-link-btn');

  scanBtn.addEventListener('click', () => {
    const plotId = plotSelect.value;
    if (onAcquireScan) onAcquireScan(plotId);
  });

  recalibBtn.addEventListener('click', () => {
    if (onOpenCalibration) onOpenCalibration('FULL');
  });

  return container;
}

/**
 * Render the 5 Farmer Agronomic Decision Cards into the container
 */
export function renderDecisionCards(container, analysis, cropName = "Bell Peppers", plotNumber = 1) {
  const cardsHost = container.querySelector('#decision-cards-container');
  if (!cardsHost || !analysis) return;

  const vitalityColor = getVitalityColor(analysis.vitalityScore);

  cardsHost.innerHTML = `
    <!-- Decision 1: Crop Vitality Score (Speedometer Circular Gauge) -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">1. Crop Vitality Score</span>
        <button data-tts="VITALITY" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <!-- Animated SVG Speedometer / Circular Gauge -->
      <div class="flex items-center justify-center my-2">
        <div class="relative w-36 h-36 flex items-center justify-center">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <!-- Background circle track -->
            <circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="8" class="text-slate-700/60" fill="transparent"/>
            <!-- Animated Progress circle -->
            <circle cx="50" cy="50" r="40" stroke="${vitalityColor}" stroke-width="8" stroke-linecap="round" fill="transparent"
              stroke-dasharray="251.2"
              stroke-dashoffset="${251.2 - (251.2 * analysis.vitalityScore) / 100}"
              class="transition-all duration-1000 ease-out"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-3xl font-extrabold font-mono text-white tracking-tight">${analysis.vitalityScore}</span>
            <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">/ 100 Vigor</span>
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] text-slate-300 font-mono">
        <span>NDVI: <strong>${analysis.indices.ndvi}</strong></span>
        <span>NDRE: <strong>${analysis.indices.ndre}</strong></span>
        <span>LWI: <strong>${analysis.indices.leafWaterIndex}</strong></span>
      </div>
    </div>

    <!-- Decision 2: Nitrogen & Fertilizer Prescription -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">2. Nitrogen Prescription</span>
        <button data-tts="NITROGEN" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono ${analysis.nitrogenPrescriptionKg > 0 ? 'text-amberPulse' : 'text-emeraldGlow'}">
            ${analysis.nitrogenPrescriptionKg}
          </span>
          <span class="text-xs font-mono text-slate-300">kg/acre Urea</span>
        </div>
        <p class="text-xs text-slate-300 mt-2 leading-relaxed">
          ${analysis.nitrogenMessage}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Red-Edge Inflection: 720nm</span>
        <span class="${analysis.nitrogenPrescriptionKg > 0 ? 'text-amberPulse' : 'text-emeraldGlow'} font-bold">
          ${analysis.nitrogenPrescriptionKg > 0 ? 'Supplemental Needed' : 'Chlorophyll Balanced'}
        </span>
      </div>
    </div>

    <!-- Decision 3: Irrigation Need Countdown -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">3. Irrigation Countdown</span>
        <button data-tts="IRRIGATION" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono ${analysis.irrigationCountdownHours < 12 ? 'text-crimsonCoral animate-pulse' : 'text-cyan-400'}">
            ${analysis.irrigationCountdownHours}
          </span>
          <span class="text-xs font-mono text-slate-300">Hours Until Depletion</span>
        </div>
        <p class="text-xs text-slate-300 mt-2 leading-relaxed">
          ${analysis.irrigationMessage}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] font-mono">
        <span class="text-slate-400">970nm Water Dip:</span>
        <span class="font-bold ${analysis.irrigationUrgency === 'CRITICAL' ? 'text-crimsonCoral' : 'text-cyan-300'}">
          ${analysis.irrigationUrgency}
        </span>
      </div>
    </div>

    <!-- Decision 4: Pre-Symptomatic Disease Alert -->
    <div class="bg-slate-800/80 rounded-xl p-4 border ${analysis.diseaseRisk.detected ? 'border-amberPulse/60 bg-amber-950/20' : 'border-slate-700/80'} shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">4. Pre-Symptomatic Alert</span>
        <button data-tts="DISEASE" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full ${analysis.diseaseRisk.detected ? 'bg-amberPulse animate-ping' : 'bg-emeraldGlow'}"></span>
          <h4 class="text-sm font-bold text-white">${analysis.diseaseRisk.pathogen}</h4>
        </div>
        <div class="mt-2 text-xs text-slate-300">
          Confidence: <strong class="text-white font-mono">${analysis.diseaseRisk.confidence}%</strong>
        </div>
        <p class="text-xs text-slate-400 mt-1 leading-relaxed">
          ${analysis.diseaseRisk.preventativeAction}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Chlorophyll Trough: 680nm</span>
        <span class="text-slate-300">Edge ML ResNet-18</span>
      </div>
    </div>

    <!-- Decision 5: Harvest Window Predictor -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">5. Harvest Window Predictor</span>
        <button data-tts="HARVEST" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono text-emeraldGlow">
            ${analysis.harvest.maturityPercent}%
          </span>
          <span class="text-xs font-mono text-slate-300">Canopy Maturity</span>
        </div>
        <p class="text-xs text-slate-300 mt-2 leading-relaxed">
          ${analysis.harvest.statusMessage}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Peak Harvest Window:</span>
        <span class="text-emeraldGlow font-bold">~${analysis.harvest.daysToPeakHarvest} Days</span>
      </div>
    </div>
  `;

  // Attach TTS listeners
  cardsHost.querySelectorAll('.tts-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-tts');
      ttsEngine.speakDecision(type, {
        ...analysis,
        cropName,
        plotNumber
      });
    });
  });
}

/**
 * Draws the 350-1100 nm VIS-NIR Spectral Reflectance Chart on HTML5 Canvas
 */
export function drawSpectralCurve(canvas, spectrum = []) {
  if (!canvas || !spectrum || spectrum.length === 0) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  const isCreamy = document.body.classList.contains('theme-creamy-agri') || !document.body.classList.contains('theme-dark-soil');
  const gridStroke = isCreamy ? "rgba(180, 195, 185, 0.55)" : "rgba(51, 65, 85, 0.4)";
  const tickText = isCreamy ? "#4A6B52" : "#64748b";
  const curveStroke = isCreamy ? "#1B5E20" : "#10B981";

  // Clear background
  ctx.clearRect(0, 0, width, height);

  // Draw grid lines
  ctx.strokeStyle = gridStroke;
  ctx.lineWidth = 1;
  for (let y = 0.2; y <= 0.8; y += 0.2) {
    const py = height * (1 - y);
    ctx.beginPath();
    ctx.moveTo(35, py);
    ctx.lineTo(width - 15, py);
    ctx.stroke();

    ctx.fillStyle = tickText;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`${Math.round(y * 100)}%`, 8, py + 3);
  }

  // Wavelength ticks (400, 550, 700, 850, 1000 nm)
  const keyWls = [400, 550, 700, 850, 1000];
  keyWls.forEach(wl => {
    const px = 40 + ((wl - 350) / (1100 - 350)) * (width - 60);
    ctx.beginPath();
    ctx.moveTo(px, 10);
    ctx.lineTo(px, height - 20);
    ctx.strokeStyle = gridStroke;
    ctx.stroke();

    ctx.fillStyle = tickText;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`${wl}nm`, px - 14, height - 6);
  });

  // Highlight key absorption bands
  // 1. Blue & Red chlorophyll absorption bands (450nm & 680nm)
  const drawBand = (targetWl, color, label) => {
    const px = 40 + ((targetWl - 350) / (1100 - 350)) * (width - 60);
    ctx.fillStyle = color;
    ctx.fillRect(px - 10, 10, 20, height - 32);
    ctx.fillStyle = isCreamy ? "#2D4B34" : "#cbd5e1";
    ctx.font = "9px 'Inter', sans-serif";
    ctx.fillText(label, px - 12, 22);
  };

  drawBand(450, isCreamy ? "rgba(43, 108, 176, 0.12)" : "rgba(59, 130, 246, 0.08)", "Chl-b");
  drawBand(680, isCreamy ? "rgba(197, 48, 48, 0.12)" : "rgba(239, 68, 68, 0.08)", "Chl-a");
  drawBand(970, isCreamy ? "rgba(49, 151, 149, 0.15)" : "rgba(6, 182, 212, 0.12)", "H₂O Dip");

  // Draw Spectral Gradient Curve
  const points = spectrum.map((r, i) => {
    const wl = WAVELENGTHS[i] || (350 + i * 10);
    const x = 40 + ((wl - 350) / (1100 - 350)) * (width - 60);
    const y = (height - 25) - (r * (height - 40));
    return { x, y };
  });

  // Area fill below curve
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (isCreamy) {
    gradient.addColorStop(0, "rgba(46, 125, 50, 0.35)");
    gradient.addColorStop(0.6, "rgba(46, 125, 50, 0.12)");
    gradient.addColorStop(1, "rgba(46, 125, 50, 0.0)");
  } else {
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.4)");
    gradient.addColorStop(0.6, "rgba(16, 185, 129, 0.1)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - 25);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - 25);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Stroke line
  ctx.beginPath();
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = curveStroke;
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Highlight points
  points.forEach((p, idx) => {
    const wl = WAVELENGTHS[idx];
    if (wl === 550 || wl === 680 || wl === 720 || wl === 970) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isCreamy ? "#FCFAF6" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = curveStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  });
}
