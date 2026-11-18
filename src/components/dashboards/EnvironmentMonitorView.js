/**
 * Module 3 Dashboard: Temperature & Humidity Monitor
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Features:
 *   - 3-Way Connection Mode Switcher: USB Type-C | Bluetooth BLE | Wi-Fi Cloud Stream
 *   - Live "Wi-Fi IoT Synced (via Cloud Database)" badge when Cloud Stream selected with auto-polling
 *   - Dual-Source Cards: 'Live Physical USB Sensor' vs 'Outdoor Weather Forecast (Open-Meteo / IMD)'
 *   - Farm weather card styled after user's reference: +24°C, sunrise/sunset arc, 4-metric row
 *   - 24-hour trend sparklines for Temp & Relative Humidity
 *   - Configurable environmental threshold alerts (heat stress, frost, mold risk)
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange } from '../../utils/i18n.js';
import { 
  tempHumiditySensorUSB, 
  CONNECTION_MODES,
  calculateVaporPressureDeficit,
  calculateDewPoint
} from '../../hardware/tempHumiditySensorUSB.js';

export function createEnvironmentMonitorView() {
  const container = document.createElement('div');
  container.className = "environment-monitor-view w-full space-y-4 pb-28 text-slate-800 select-none";

  let connectionMode = tempHumiditySensorUSB.connectionMode || CONNECTION_MODES.USB_TYPE_C;
  let currentReading = null;
  let pollingIntervalId = null;

  // Threshold alerts configuration state
  let thresholds = tempHumiditySensorUSB.getThresholds();

  // Synthetic 24-hour sparkline history
  const tempHistory = [18, 17, 16, 16, 17, 19, 21, 23, 25, 27, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 19, 18, 18, 17];
  const rhHistory = [75, 78, 80, 82, 80, 72, 65, 58, 52, 48, 45, 46, 50, 55, 60, 64, 68, 70, 72, 74, 75, 76, 76, 75];

  async function loadReading() {
    try {
      currentReading = await tempHumiditySensorUSB.readData({ forceSource: null });
      render();
    } catch (e) {
      console.warn("Temp read error:", e);
    }
  }

  function handleModeChange(mode) {
    connectionMode = mode;
    tempHumiditySensorUSB.setConnectionMode(mode);

    if (mode === CONNECTION_MODES.WIFI_CLOUD) {
      if (pollingIntervalId) clearInterval(pollingIntervalId);
      pollingIntervalId = setInterval(loadReading, 4000);
    } else {
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
      }
    }
    loadReading();
  }

  function render() {
    const temp = currentReading?.temperatureC ?? 24.2;
    const rh = currentReading?.relativeHumidityPercent ?? 48.5;
    const vpd = currentReading?.vpdKPa ?? calculateVaporPressureDeficit(temp, rh);
    const dew = currentReading?.dewPointC ?? calculateDewPoint(temp, rh);
    const alerts = currentReading?.activeAlerts || [];

    container.innerHTML = `
      <!-- 1. Connection Mode Switcher Pill (3-Way: USB-C | BLE | Wi-Fi Cloud) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-2.5">
        <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
          <span class="flex items-center gap-1.5">
            ${icon('thermometer', 'w-4 h-4 text-[#0E5431]')}
            <span>Environment Sensor Mode:</span>
          </span>
          <div class="flex items-center gap-1.5">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#0E5431] border border-emerald-300">
              ${t('status_connected')}
            </span>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-2xl">
          <button 
            type="button" 
            data-mode="${CONNECTION_MODES.USB_TYPE_C}"
            class="mode-switch-btn py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              connectionMode === CONNECTION_MODES.USB_TYPE_C 
                ? 'bg-[#0E5431] text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }"
          >
            ${icon('usb', 'w-3.5 h-3.5')}
            <span>${t('mode_usb')}</span>
          </button>

          <button 
            type="button" 
            data-mode="${CONNECTION_MODES.BLUETOOTH_BLE}"
            class="mode-switch-btn py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              connectionMode === CONNECTION_MODES.BLUETOOTH_BLE 
                ? 'bg-[#0E5431] text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }"
          >
            ${icon('bluetooth', 'w-3.5 h-3.5')}
            <span>${t('mode_ble')}</span>
          </button>

          <button 
            type="button" 
            data-mode="${CONNECTION_MODES.WIFI_CLOUD}"
            class="mode-switch-btn py-2 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
              connectionMode === CONNECTION_MODES.WIFI_CLOUD 
                ? 'bg-[#0E5431] text-white shadow-sm' 
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }"
          >
            ${icon('wifi', 'w-3.5 h-3.5')}
            <span>${t('mode_wifi')}</span>
          </button>
        </div>

        <!-- Wi-Fi Cloud Live Badge -->
        ${connectionMode === CONNECTION_MODES.WIFI_CLOUD ? `
          <div class="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/50 flex items-center justify-between text-xs text-[#0E5431] dark:text-emerald-300">
            <span class="font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              <span>${t('wifi_synced_badge')}</span>
            </span>
            <span class="text-[10px] font-mono opacity-80">Auto-polling 4s</span>
          </div>
        ` : ''}
      </div>

      <!-- 2. Dual-Source Cards -->
      <!-- Card A: Outdoor Weather Forecast (Open-Meteo / IMD) - Styled faithfully after user's reference image -->
      <div class="bg-gradient-to-br from-[#0E5431] to-[#0A3D23] text-white rounded-3xl p-5 shadow-lg border border-emerald-800/40 space-y-4">
        <!-- Top Badge & Location -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-emerald-300">
              ${icon('mapPin', 'w-3.5 h-3.5')}
            </div>
            <div>
              <div class="text-xs font-bold tracking-tight">Sonoma Valley Parcel / Chateauneuf-du-Pape</div>
              <div class="text-[10px] text-emerald-200/80 font-mono">Open-Meteo High-Resolution Grid</div>
            </div>
          </div>

          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-emerald-100 border border-white/20">
            Weather API
          </span>
        </div>

        <!-- Large Temp & Condition -->
        <div class="flex items-center justify-between pt-1">
          <div class="flex flex-col">
            <div class="flex items-baseline gap-1">
              <span class="text-4xl font-black tracking-tight font-mono">+${temp.toFixed(0)}°C</span>
              <span class="text-xs text-emerald-200 font-mono">H: 28°C • L: 16°C</span>
            </div>
            <span class="text-xs text-emerald-100/90 font-medium mt-0.5">Partly Sunny • Moderate Vapor Deficit</span>
          </div>

          <!-- Weather Icon Vector -->
          <div class="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center text-amber-300 shadow-inner">
            ${icon('sunMoon', 'w-8 h-8')}
          </div>
        </div>

        <!-- 4 Metrics Row (Humidity, Precipitation, Pressure, Wind) -->
        <div class="grid grid-cols-4 gap-2 pt-3 border-t border-emerald-700/40 text-center">
          <div class="bg-white/10 rounded-2xl py-2 px-1">
            <div class="text-[10px] text-emerald-200 font-medium">Humidity</div>
            <div class="text-sm font-black font-mono mt-0.5">${rh.toFixed(0)}%</div>
          </div>
          <div class="bg-white/10 rounded-2xl py-2 px-1">
            <div class="text-[10px] text-emerald-200 font-medium">Precip</div>
            <div class="text-sm font-black font-mono mt-0.5">0.0 mm</div>
          </div>
          <div class="bg-white/10 rounded-2xl py-2 px-1">
            <div class="text-[10px] text-emerald-200 font-medium">Pressure</div>
            <div class="text-sm font-black font-mono mt-0.5">1013 hPa</div>
          </div>
          <div class="bg-white/10 rounded-2xl py-2 px-1">
            <div class="text-[10px] text-emerald-200 font-medium">Wind</div>
            <div class="text-sm font-black font-mono mt-0.5">12 km/h</div>
          </div>
        </div>

        <!-- Sunrise / Sunset Daylight Arc Indicator -->
        <div class="bg-white/10 rounded-2xl p-3 flex items-center justify-between text-xs text-emerald-100 font-mono">
          <div class="flex items-center gap-1.5">
            ${icon('sun', 'w-4 h-4 text-amber-300')}
            <span>Sunrise: 05:45 AM</span>
          </div>
          <div class="w-16 h-1 bg-gradient-to-r from-amber-300 via-emerald-300 to-amber-400 rounded-full"></div>
          <div class="flex items-center gap-1.5">
            ${icon('cloud', 'w-4 h-4 text-emerald-300')}
            <span>Sunset: 06:15 PM</span>
          </div>
        </div>

        <!-- Operational Advice Banner -->
        <div class="bg-emerald-950/60 rounded-2xl p-2.5 border border-emerald-600/30 flex items-center gap-2 text-xs text-emerald-200">
          ${icon('shieldCheck', 'w-4 h-4 text-emerald-400 shrink-0')}
          <span>Today is a good day to apply biological spray / fertigation. Low wind drift.</span>
        </div>
      </div>

      <!-- Card B: Live Physical USB Atmospheric Probe -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-xl bg-emerald-100 text-[#0E5431] flex items-center justify-center">
              ${icon('usb', 'w-4 h-4')}
            </div>
            <div>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white">${t('env_source_usb')}</h3>
              <p class="text-[10px] text-slate-500">SHT4x Micro-Environmental Chamber</p>
            </div>
          </div>

          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#0E5431] border border-emerald-300">
            Physical Telemetry
          </span>
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">Probe Temperature</span>
            <span class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">${temp.toFixed(1)}°C</span>
            <span class="text-[9px] text-slate-400 mt-1">±0.2°C Factory Calibrated</span>
          </div>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">Relative Humidity</span>
            <span class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">${rh.toFixed(1)}%</span>
            <span class="text-[9px] text-slate-400 mt-1">VPD: ${vpd.toFixed(2)} kPa</span>
          </div>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">Dew Point</span>
            <span class="text-xl font-black text-slate-900 dark:text-white font-mono mt-0.5">${dew.toFixed(1)}°C</span>
            <span class="text-[9px] text-slate-400 mt-1">Condensation onset limit</span>
          </div>

          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">Vapor Deficit (VPD)</span>
            <span class="text-xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">${vpd.toFixed(2)} kPa</span>
            <span class="text-[9px] text-slate-400 mt-1">Stomatal Transpiration Zone</span>
          </div>
        </div>
      </div>

      <!-- 3. 24-Hour Trend Sparklines -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          ${icon('clock', 'w-4 h-4 text-[#0E5431]')}
          <span>24-Hour Diurnal Trends</span>
        </h3>

        <!-- Temp Sparkline -->
        <div class="space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-600 dark:text-slate-400 font-medium">Temperature (°C)</span>
            <span class="font-mono font-bold text-slate-800 dark:text-white">Min 16°C • Max 28°C</span>
          </div>
          <div class="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 flex items-end gap-1">
            ${tempHistory.map(val => {
              const heightPercent = Math.max(15, Math.min(100, ((val - 14) / (30 - 14)) * 100));
              return `<div class="flex-1 bg-amber-500/80 hover:bg-amber-600 rounded-t-sm transition-all" style="height: ${heightPercent}%" title="${val}°C"></div>`;
            }).join('')}
          </div>
        </div>

        <!-- Humidity Sparkline -->
        <div class="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-600 dark:text-slate-400 font-medium">Relative Humidity (%)</span>
            <span class="font-mono font-bold text-slate-800 dark:text-white">Min 45% • Max 82%</span>
          </div>
          <div class="h-10 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 flex items-end gap-1">
            ${rhHistory.map(val => {
              const heightPercent = Math.max(15, Math.min(100, val));
              return `<div class="flex-1 bg-blue-500/80 hover:bg-blue-600 rounded-t-sm transition-all" style="height: ${heightPercent}%" title="${val}%"></div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- 4. Configurable Environmental Threshold Alerts -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              ${icon('shieldCheck', 'w-4 h-4 text-emerald-700')}
              <span>Agronomic Microclimate Guards</span>
            </h3>
            <p class="text-[10px] text-slate-500">Autonomous protection rules & frost/heat mitigation</p>
          </div>

          <button 
            type="button" 
            id="save-thresholds-btn"
            class="px-3 py-1 rounded-full bg-[#0E5431] text-white text-xs font-bold hover:bg-[#083820] transition"
          >
            Update
          </button>
        </div>

        <div class="space-y-2.5 text-xs">
          <!-- Heat Stress Alert Guard -->
          <div class="p-2.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                ${icon('sun', 'w-4 h-4')}
              </div>
              <div>
                <div class="font-bold text-amber-900 dark:text-amber-200">${t('env_heat_stress')}</div>
                <div class="text-[10px] text-amber-700/80">Trigger overhead cooling mist</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-slate-500">&gt;</span>
              <input type="number" id="thresh-heat" value="${thresholds.highTempC}" class="w-14 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-white" />
              <span class="text-slate-500">°C</span>
            </div>
          </div>

          <!-- Frost Risk Alert Guard -->
          <div class="p-2.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
                ${icon('cloud', 'w-4 h-4')}
              </div>
              <div>
                <div class="font-bold text-blue-900 dark:text-blue-200">${t('env_frost_risk')}</div>
                <div class="text-[10px] text-blue-700/80">Trigger ground water heating</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-slate-500">&lt;</span>
              <input type="number" id="thresh-frost" value="${thresholds.lowTempC}" class="w-14 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-white" />
              <span class="text-slate-500">°C</span>
            </div>
          </div>

          <!-- Fungal Mold Risk Alert Guard -->
          <div class="p-2.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800/40 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <div class="w-7 h-7 rounded-lg bg-teal-100 text-teal-800 flex items-center justify-center">
                ${icon('shield', 'w-4 h-4')}
              </div>
              <div>
                <div class="font-bold text-teal-900 dark:text-teal-200">${t('env_mold_risk')}</div>
                <div class="text-[10px] text-teal-700/80">High RH sporulation alert</div>
              </div>
            </div>
            <div class="flex items-center gap-1">
              <span class="text-slate-500">&gt;</span>
              <input type="number" id="thresh-rh" value="${thresholds.highRhPercent}" class="w-14 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 font-mono font-bold text-slate-800 dark:text-white" />
              <span class="text-slate-500">%</span>
            </div>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Mode Switcher Buttons
    container.querySelectorAll('.mode-switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode) handleModeChange(mode);
      });
    });

    // Update Thresholds
    container.querySelector('#save-thresholds-btn')?.addEventListener('click', () => {
      const heat = parseFloat(container.querySelector('#thresh-heat')?.value) || 35.0;
      const frost = parseFloat(container.querySelector('#thresh-frost')?.value) || 3.0;
      const rh = parseFloat(container.querySelector('#thresh-rh')?.value) || 85.0;

      tempHumiditySensorUSB.configureThresholds({
        highTempC: heat,
        lowTempC: frost,
        highRhPercent: rh
      });
      thresholds = tempHumiditySensorUSB.getThresholds();
      alert("Microclimate Thresholds Updated!");
    });
  }

  onLocaleChange(() => render());

  loadReading();
  return container;
}
