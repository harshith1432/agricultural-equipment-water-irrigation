/**
 * Hardware & Telemetry Simulator Modal
 * Lets users test live MQTT soil moisture streaming, weather disturbance injection, and emergency scenarios.
 */
import { mqttSimulator } from '../hardware/mqttTelemetrySimulator.js';
import { mockFirestore } from '../firebase/mockFirestore.js';

export function createTelemetrySimulatorModal({ onClose }) {
  const overlay = document.createElement('div');
  overlay.className = "fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn";

  function render() {
    overlay.innerHTML = `
      <div class="bg-slate-850 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        <button id="sim-close-btn" class="absolute top-3 right-3 text-slate-400 hover:text-white min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl hover:bg-slate-750 transition" title="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-bold text-white">IoT Hardware & Telemetry Simulator</h3>
            <p class="text-xs text-slate-400">FDR multi-depth soil probes, mainline pressure, and weather modes</p>
          </div>
        </div>

        <!-- Telemetry Stream Toggle -->
        <div class="bg-slate-900/90 rounded-xl p-4 border border-slate-750 mb-4 flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-white mb-0.5">Live MQTT Telemetry Stream</h4>
            <p class="text-[11px] text-slate-400">Broadcasts VWC % & pressure ticks every 4 seconds</p>
          </div>
          <button id="toggle-stream-btn" class="min-h-[48px] px-4 py-2 rounded-xl text-xs font-mono font-bold transition border ${
            mqttSimulator.isRunning 
              ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' 
              : 'bg-slate-800 text-slate-400 border-slate-700'
          }">
            ${mqttSimulator.isRunning ? 'STREAMING (ACTIVE)' : 'STREAM: PAUSED'}
          </button>
        </div>

        <!-- Weather Disturbance Injection -->
        <div class="bg-slate-900/90 rounded-xl p-4 border border-slate-750 mb-4">
          <h4 class="text-xs font-bold text-white mb-2">Simulate Field Conditions & Evapotranspiration:</h4>
          <div class="grid grid-cols-3 gap-2">
            <button data-weather="NORMAL" class="weather-btn min-h-[48px] p-2.5 rounded-xl border text-center transition ${mqttSimulator.weatherMode === 'NORMAL' ? 'bg-emeraldGlow/15 border-emeraldGlow/50 text-emeraldGlow' : 'bg-slate-800 border-slate-700 text-slate-300'}">
              <span class="text-base block mb-0.5">⛅</span>
              <span class="text-[11px] font-bold block">Normal</span>
              <span class="text-[9px] text-slate-400 font-mono">-0.08%/tick</span>
            </button>

            <button data-weather="HEATWAVE" class="weather-btn min-h-[48px] p-2.5 rounded-xl border text-center transition ${mqttSimulator.weatherMode === 'HEATWAVE' ? 'bg-amberPulse/15 border-amberPulse/50 text-amberPulse' : 'bg-slate-800 border-slate-700 text-slate-300'}">
              <span class="text-base block mb-0.5">☀️🔥</span>
              <span class="text-[11px] font-bold block">Heatwave</span>
              <span class="text-[9px] text-slate-400 font-mono">-0.25%/tick</span>
            </button>

            <button data-weather="RAIN" class="weather-btn min-h-[48px] p-2.5 rounded-xl border text-center transition ${mqttSimulator.weatherMode === 'RAIN' ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-300'}">
              <span class="text-base block mb-0.5">🌧️💧</span>
              <span class="text-[11px] font-bold block">Rainfall</span>
              <span class="text-[9px] text-slate-400 font-mono">+1.2%/tick</span>
            </button>
          </div>
        </div>

        <!-- Interactive Telemetry Calibration Sliders -->
        <div class="bg-slate-900/90 rounded-xl p-4 border border-slate-750 mb-4 space-y-3">
          <h4 class="text-xs font-bold text-white">Manual Telemetry Modulation Sliders:</h4>

          <!-- Pressure Slider -->
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-slate-400">Mainline Pressure (Piezo-Transducer):</span>
              <span id="slider-pressure-val" class="font-mono font-bold ${mqttSimulator.mainlinePressureBar > 3.0 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}">
                ${mqttSimulator.mainlinePressureBar || 2.42} Bar
              </span>
            </div>
            <input 
              type="range" 
              id="sim-pressure-slider" 
              min="1.0" 
              max="4.5" 
              step="0.05" 
              value="${mqttSimulator.mainlinePressureBar || 2.42}"
              class="w-full accent-emerald-500 cursor-pointer"
            />
            <div class="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
              <span>1.0 Bar (Low)</span>
              <span>2.4 Bar (Nominal)</span>
              <span class="text-rose-400">&gt;3.0 Bar (Surge Risk)</span>
            </div>
          </div>

          <!-- Soil Moisture VWC Slider -->
          <div>
            <div class="flex items-center justify-between text-xs mb-1">
              <span class="text-slate-400">Global Root-Zone VWC %:</span>
              <span id="slider-vwc-val" class="font-mono font-bold text-cyan-400">25.0%</span>
            </div>
            <input 
              type="range" 
              id="sim-vwc-slider" 
              min="10.0" 
              max="45.0" 
              step="0.5" 
              value="25.0"
              class="w-full accent-cyan-500 cursor-pointer"
            />
            <div class="flex justify-between text-[9px] font-mono text-slate-500 mt-0.5">
              <span>10% (Severe Deficit)</span>
              <span>25% (Optimal)</span>
              <span>45% (Saturated)</span>
            </div>
          </div>
        </div>

        <!-- Database Reset Option -->
        <div class="bg-slate-900/90 rounded-xl p-4 border border-slate-750 flex items-center justify-between">
          <div>
            <h4 class="text-xs font-bold text-white mb-0.5">Reset Test Farm Database</h4>
            <p class="text-[11px] text-slate-400">Restores default 6 plots, water deficit on Plot 2, and logs</p>
          </div>
          <button id="reset-db-btn" class="min-h-[48px] px-4 py-2 rounded-xl text-xs font-bold text-rose-300 bg-rose-950/60 hover:bg-rose-900 border border-rose-500/40 transition">
            Reset Data
          </button>
        </div>

        <div class="mt-6 flex justify-end">
          <button id="sim-done-btn" class="min-h-[48px] px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emeraldGlow hover:bg-emeraldGlow-light transition">
            Close Panel
          </button>
        </div>
      </div>
    `;

    overlay.querySelector('#sim-close-btn').addEventListener('click', () => {
      overlay.remove();
      if (onClose) onClose();
    });

    overlay.querySelector('#sim-done-btn').addEventListener('click', () => {
      overlay.remove();
      if (onClose) onClose();
    });

    overlay.querySelector('#toggle-stream-btn').addEventListener('click', () => {
      if (mqttSimulator.isRunning) {
        mqttSimulator.stop();
      } else {
        const plots = mockFirestore.getChannelSnapshot('plots');
        mqttSimulator.start(plots, (updatedPlot) => {
          mockFirestore.updatePlot(updatedPlot.id, {
            soilSensors: updatedPlot.soilSensors,
            totalLitersDelivered: updatedPlot.totalLitersDelivered
          });
        });
      }
      render();
    });

    overlay.querySelectorAll('.weather-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-weather');
        mqttSimulator.setWeatherMode(mode);
        render();
      });
    });

    // Slider Listeners
    const pressureSlider = overlay.querySelector('#sim-pressure-slider');
    const pressureDisplay = overlay.querySelector('#slider-pressure-val');
    if (pressureSlider && pressureDisplay) {
      pressureSlider.addEventListener('input', (e) => {
        const p = parseFloat(e.target.value);
        mqttSimulator.setMainlinePressure(p);
        pressureDisplay.textContent = `${p.toFixed(2)} Bar`;
        if (p > 3.0) {
          pressureDisplay.className = "font-mono font-bold text-rose-400 animate-pulse";
        } else {
          pressureDisplay.className = "font-mono font-bold text-emerald-400";
        }
      });
    }

    const vwcSlider = overlay.querySelector('#sim-vwc-slider');
    const vwcDisplay = overlay.querySelector('#slider-vwc-val');
    if (vwcSlider && vwcDisplay) {
      vwcSlider.addEventListener('input', (e) => {
        const v = parseFloat(e.target.value);
        vwcDisplay.textContent = `${v.toFixed(1)}%`;
        const plots = mockFirestore.getChannelSnapshot('plots') || [];
        plots.forEach(plot => {
          const updatedSensors = (plot.soilSensors || []).map(s => ({ ...s, vwc: v }));
          mockFirestore.updatePlot(plot.id, { soilSensors: updatedSensors });
        });
      });
    }

    overlay.querySelector('#reset-db-btn').addEventListener('click', () => {
      mockFirestore.resetToDefault();
      alert("Farm database reset to default 6-zone state (Plot 2 water deficit initialized).");
      overlay.remove();
      if (onClose) onClose();
    });
  }

  render();
  return overlay;
}
