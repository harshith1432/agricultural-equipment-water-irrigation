/**
 * Field Zone Screen (Screen 2 in Reference Design)
 * Displays:
 * 1. Top Bar: Frosted back button, "Potato Field Zone" title, options menu.
 * 2. Drone Satellite Map: High-res aerial farmland with interactive polygonal parcel boundary.
 * 3. NDVI / Moisture Heatmap Zones & Glowing Pin with live Pinned Telemetry Badge:
 *    "Yield: 7 tons • Plant Age: 63 Days"
 * 4. Floating Action Controls: Mini crop viewfinder card, quick tool pill (Chart, Scan, Filter).
 * 5. Pagination Indicator Dots: [— • •] to swipe or cycle zones.
 * 6. Bottom Recommendation Card: Potato crop thumbnail, "Irrigation is recommended to ensure optimal growth",
 *    "1.4 ha" area chip, and 1-tap valve actuation trigger!
 */

export function createFieldZoneScreen({
  plots = [],
  selectedPlotId = "plot-1",
  onSelectPlot,
  onActuateValve,
  onBack,
  onNavigateTab
}) {
  const container = document.createElement('div');
  container.className = "field-zone-screen w-full flex flex-col space-y-4 pb-20 text-white select-none";

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
    valve: { id: "G1", state: "CLOSED", flowRate: 480 },
    soilSensors: [{ vwc: 24.8, depthCm: 10 }]
  };

  const zoneTitle = selectedPlot.crop.toLowerCase().includes('potato')
    ? "Potato Field Zone"
    : `${selectedPlot.crop} Field Zone`;

  const yieldTons = selectedPlot.projectedYieldTons || 7.0;
  const plantAge = selectedPlot.plantAgeDays || 63;
  const areaHa = selectedPlot.areaHa || 1.4;
  const isValveOpen = selectedPlot.valve?.state === 'OPEN';

  // Compute average VWC
  let avgVwc = 24.8;
  if (selectedPlot.soilSensors && selectedPlot.soilSensors.length > 0) {
    const sum = selectedPlot.soilSensors.reduce((a, s) => a + Number(s.vwc), 0);
    avgVwc = (sum / selectedPlot.soilSensors.length).toFixed(1);
  }

  // Active layer state: 'ndvi' | 'moisture' | 'thermal'
  let activeLayer = 'ndvi';

  container.innerHTML = `
    <!-- 1. Screen Top Bar -->
    <header class="flex items-center justify-between px-1 py-1">
      <button 
        type="button" 
        id="zone-back-btn" 
        class="aero-glass-btn w-10 h-10 rounded-full flex items-center justify-center text-slate-200 hover:text-white shadow-lg transition-transform active:scale-95"
        title="Back"
      >
        <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="m15 18-6-6 6-6"/>
        </svg>
      </button>

      <h1 class="text-base sm:text-lg font-semibold tracking-wide text-white drop-shadow-md">
        ${zoneTitle}
      </h1>

      <div class="relative">
        <button 
          type="button" 
          id="zone-options-btn" 
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
        <div id="zone-options-dropdown" class="hidden absolute right-0 mt-2 w-56 rounded-2xl bg-[#0a1e12]/95 border border-white/15 shadow-2xl backdrop-blur-xl p-2 z-50 animate-fadeIn text-xs">
          <div class="px-3 py-2 text-[11px] font-mono text-slate-400 uppercase tracking-wider border-b border-white/10">Select Field Zone</div>
          ${plots.map(p => `
            <button 
              type="button" 
              data-plot-id="${p.id}" 
              class="zone-switch-item w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between hover:bg-white/10 transition ${p.id === selectedPlot.id ? 'text-lime-300 font-bold bg-white/5' : 'text-slate-300'}"
            >
              <span>Gate ${p.valve?.id || 'G' + p.plotNumber}: ${p.crop}</span>
              ${p.id === selectedPlot.id ? '<span class="w-1.5 h-1.5 rounded-full bg-lime-400"></span>' : ''}
            </button>
          `).join('')}
        </div>
      </div>
    </header>

    <!-- 2. Satellite Drone Map Container -->
    <div class="relative w-full h-[420px] rounded-3xl overflow-hidden border border-white/15 shadow-2xl bg-[#0d2215]">
      <!-- Aerial Drone Farmland Background Graphic -->
      <div 
        class="absolute inset-0 bg-cover bg-center transition-transform duration-700 ease-out hover:scale-105"
        style="background-image: url('/assets/drone-farmland-bg.svg');"
      ></div>

      <!-- Vignette Lighting Gradient -->
      <div class="absolute inset-0 bg-gradient-to-t from-[#06140b] via-transparent to-black/30 pointer-events-none"></div>

      <!-- SVG Layer: Polygonal Field Parcel Boundary & NDVI Heatmap -->
      <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 400 420" preserveAspectRatio="none">
        <defs>
          <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <!-- NDVI Heatmap Gradient -->
          <linearGradient id="ndviHeatGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.55" />
            <stop offset="35%" stop-color="#f59e0b" stop-opacity="0.45" />
            <stop offset="65%" stop-color="#84cc16" stop-opacity="0.45" />
            <stop offset="100%" stop-color="#22c55e" stop-opacity="0.50" />
          </linearGradient>

          <!-- Water Stress / Irrigation Recommended Pattern -->
          <radialGradient id="stressPocket" cx="35%" cy="45%" r="40%">
            <stop offset="0%" stop-color="#ef4444" stop-opacity="0.65" />
            <stop offset="60%" stop-color="#f59e0b" stop-opacity="0.35" />
            <stop offset="100%" stop-color="#22c55e" stop-opacity="0.0" />
          </radialGradient>
        </defs>

        <!-- Main Polygonal Parcel Highlight (matching reference contour) -->
        <polygon 
          points="25,120 330,135 305,270 45,245" 
          fill="url(#ndviHeatGrad)" 
          stroke="none"
        />

        <!-- Water Stress Heatmap Pocket (justifying irrigation recommendation!) -->
        <ellipse cx="140" cy="180" rx="75" ry="40" fill="url(#stressPocket)" />

        <!-- Neon Boundary Stroke with Glow -->
        <polygon 
          points="25,120 330,135 305,270 45,245" 
          fill="none" 
          stroke="#a3e635" 
          stroke-width="2.5" 
          stroke-dasharray="6 3"
          filter="url(#neonGlow)"
        />

        <!-- Secondary Sub-Zone Drip Line Divider -->
        <line x1="165" y1="128" x2="155" y2="255" stroke="#a3e635" stroke-width="1.5" stroke-dasharray="3 3" opacity="0.75" />
      </svg>

      <!-- Pinned Pulsing Target Locator Marker -->
      <div class="absolute top-[195px] left-[270px] -translate-x-1/2 -translate-y-1/2 pointer-events-none">
        <span class="relative flex h-6 w-6">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-6 w-6 bg-lime-500/80 border-2 border-white shadow-lg items-center justify-center">
            <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
          </span>
        </span>
      </div>

      <!-- Pinned Floating Telemetry Tooltip Badge (matching reference screen) -->
      <div 
        id="field-pinned-badge"
        class="absolute top-[148px] right-[24px] z-20 pointer-events-auto rounded-2xl bg-[#14321e]/90 border border-white/20 shadow-2xl backdrop-blur-md px-3.5 py-2 transition-all duration-300 hover:scale-105"
      >
        <div class="flex items-center gap-2 text-xs font-mono font-bold text-white mb-1">
          <span class="w-2 h-2 rounded-full bg-lime-400 shadow-[0_0_6px_#a3e635]"></span>
          <span>Yield:</span>
          <span class="text-lime-300 font-extrabold">${yieldTons} tons</span>
        </div>

        <div class="flex items-center gap-2 text-xs font-mono font-bold text-white">
          <span class="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_#f59e0b]"></span>
          <span class="text-slate-300 font-medium">Plant Age:</span>
          <span class="text-amber-300 font-extrabold">${plantAge} Days</span>
        </div>

        <div class="mt-1 pt-1 border-t border-white/10 flex items-center justify-between text-[10px] font-mono text-emerald-300">
          <span>VWC: ${avgVwc}%</span>
          <span>Gate ${selectedPlot.valve?.id || 'G1'}</span>
        </div>
      </div>

      <!-- Floating Tool Overlay: Left Mini Viewfinder + Right Action Pill -->
      <div class="absolute bottom-12 inset-x-4 flex items-end justify-between pointer-events-none">
        <!-- Left: Mini Camera / Drone Crop Inspect Viewfinder Box -->
        <div class="pointer-events-auto w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-white/25 shadow-2xl bg-black/60 relative group cursor-pointer transition hover:scale-105" id="viewfinder-box" title="Camera 01: High-res Foliage Inspection">
          <img src="/assets/potato-leaf-thumb.svg" alt="Crop Viewfinder" class="w-full h-full object-cover opacity-90 group-hover:opacity-100" />
          
          <!-- Viewfinder Crosshairs -->
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <svg class="w-8 h-8 text-lime-400 drop-shadow opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M4 9V5a1 1 0 0 1 1-1h4"/>
              <path d="M20 9V5a1 1 0 0 0-1-1h-4"/>
              <path d="M4 15v4a1 1 0 0 0 1 1h4"/>
              <path d="M20 15v4a1 1 0 0 1-1 1h-4"/>
              <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          </div>
          <span class="absolute bottom-1 left-1 px-1 py-0.2 rounded text-[8px] font-mono bg-black/70 text-lime-300">
            CAM 1
          </span>
        </div>

        <!-- Right: Floating Action Tool Pill (3 tools: Chart, Scan, Layer Filter) -->
        <div class="pointer-events-auto flex items-center gap-1.5 p-1 rounded-2xl bg-[#091b10]/90 border border-white/15 shadow-2xl backdrop-blur-xl">
          <!-- 1: Chart / Growth analytics -->
          <button 
            type="button" 
            id="tool-chart-btn"
            class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title="Open Growth Rate & Analytics"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
          </button>

          <!-- 2: Target / Scan Crosshair -->
          <button 
            type="button" 
            id="tool-scan-btn"
            class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title="Acquire Field Spectroscopy Scan"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
              <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
              <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
              <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
            </svg>
          </button>

          <!-- 3: Heatmap Layer Filter Toggle -->
          <button 
            type="button" 
            id="tool-layers-btn"
            class="w-10 h-10 rounded-xl flex items-center justify-center text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 transition"
            title="Toggle NDVI / Moisture Heatmap Layer"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"/>
              <polyline points="2 17 12 22 22 17"/>
              <polyline points="2 12 12 17 22 12"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Pagination Carousel Indicator Dots [— • •] (matching reference screen) -->
      <div class="absolute bottom-3 inset-x-0 flex items-center justify-center gap-2 pointer-events-auto">
        ${plots.map((p, idx) => {
          const isSelected = p.id === selectedPlot.id;
          return `
            <button 
              type="button" 
              data-plot-id="${p.id}" 
              class="zone-dot-btn transition-all duration-200 ${
                isSelected 
                  ? 'w-6 h-1.5 rounded-full bg-lime-400 shadow-[0_0_8px_#a3e635]' 
                  : 'w-1.5 h-1.5 rounded-full bg-white/40 hover:bg-white/70'
              }"
              title="Zone ${p.plotNumber}: ${p.crop}"
            ></button>
          `;
        }).join('')}
      </div>
    </div>

    <!-- 3. Bottom Floating Glass Recommendation Card (matching reference screen) -->
    <div class="aero-glass-card p-4 rounded-3xl relative shadow-2xl border border-white/15 bg-[#0d2616]/80 backdrop-blur-2xl flex items-center gap-4 transition hover:border-white/25">
      <!-- Crop Leaf Closeup Thumbnail -->
      <div class="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden shrink-0 border border-white/20 shadow-md bg-emerald-950">
        <img 
          src="/assets/potato-leaf-thumb.svg" 
          alt="Potato Leaves" 
          class="w-full h-full object-cover hover:scale-110 transition duration-300"
        />
      </div>

      <!-- Recommendation Text & Badges -->
      <div class="flex-1 min-w-0">
        <h4 class="text-sm sm:text-base font-bold text-white tracking-tight truncate">
          ${zoneTitle}
        </h4>
        <p class="text-xs text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
          Irrigation is recommended to ensure optimal growth
        </p>

        <!-- Chips & 1-Tap Actuate Button -->
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <!-- Area Chip -->
          <span class="px-2.5 py-0.5 rounded-full bg-white/10 border border-white/15 text-[11px] font-mono font-medium text-slate-200">
            ${areaHa} ha
          </span>

          <!-- Activity Chip -->
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[11px] font-mono font-semibold text-emerald-300 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Activity
          </span>

          <!-- Quick Actuate Valve Button -->
          <button 
            type="button" 
            id="quick-actuate-valve-btn"
            class="px-3 py-1 rounded-full text-[11px] font-bold font-mono transition active:scale-95 shadow-md flex items-center gap-1 ${
              isValveOpen 
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30' 
                : 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 border border-lime-300 hover:from-lime-300 hover:to-emerald-300 shadow-lime-900/40'
            }"
            title="${isValveOpen ? 'Shut Off Valve' : 'Actuate 20-min Pulse'}"
          >
            <svg class="w-3 h-3 ${isValveOpen ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
            <span>${isValveOpen ? 'Close G1' : 'Open G1 (20m)'}</span>
          </button>
        </div>
      </div>
    </div>
  `;

  // Attach Interaction Events
  // 1. Dropdown Toggle
  const optionsBtn = container.querySelector('#zone-options-btn');
  const dropdown = container.querySelector('#zone-options-dropdown');
  optionsBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle('hidden');
  });

  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
  });

  // 2. Switch Plot items from menu
  container.querySelectorAll('.zone-switch-item').forEach(item => {
    item.addEventListener('click', () => {
      const plotId = item.getAttribute('data-plot-id');
      if (plotId && onSelectPlot) {
        onSelectPlot(plotId);
      }
    });
  });

  // 3. Dot pagination buttons
  container.querySelectorAll('.zone-dot-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const plotId = btn.getAttribute('data-plot-id');
      if (plotId && onSelectPlot) {
        onSelectPlot(plotId);
      }
    });
  });

  // 4. Back Button
  container.querySelector('#zone-back-btn')?.addEventListener('click', () => {
    if (onBack) onBack();
  });

  // 5. Tool Bar Buttons
  container.querySelector('#tool-chart-btn')?.addEventListener('click', () => {
    if (onNavigateTab) onNavigateTab('crop');
  });

  container.querySelector('#tool-scan-btn')?.addEventListener('click', () => {
    if (onNavigateTab) onNavigateTab('crop');
  });

  container.querySelector('#tool-layers-btn')?.addEventListener('click', () => {
    const layerNames = ['NDVI Vigor Heatmap', 'Soil Moisture (FDR) Density', 'Thermal Evapotranspiration'];
    alert(`Active Layer: ${layerNames[0]} (Visible)`);
  });

  // 6. Quick Valve Actuate
  container.querySelector('#quick-actuate-valve-btn')?.addEventListener('click', () => {
    if (onActuateValve) {
      const action = isValveOpen ? 'CLOSE' : 'OPEN';
      onActuateValve({
        plotId: selectedPlot.id,
        gateId: selectedPlot.valve?.id || 'G1',
        action,
        durationMinutes: 20
      });
    }
  });

  return container;
}
