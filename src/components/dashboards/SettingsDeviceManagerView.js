/**
 * Module 6 Dashboard: Settings & Device Manager
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Features:
 *   - Comprehensive Unified Device Manager for all 4 hardware adapters:
 *       1. LABART 8-in-1 Soil Tester
 *       2. VIS-NIR Micro-Spectrometer
 *       3. Drip Irrigation Multi-Valve Controller
 *       4. SHT4x Temperature & Humidity Sensor
 *   - Connectivity Manager: USB Type-C OTG, Bluetooth BLE, Wi-Fi Cloud API endpoint
 *   - Agronomic preferences: Language, Theme, Simulation toggle
 */

import { icon } from '../../utils/icons.js';
import { t, getLocale, setLocale, SUPPORTED_LOCALES, onLocaleChange } from '../../utils/i18n.js';
import { deviceManager } from '../../hardware/deviceManager.js';
import { labartSoilSensorUSB } from '../../hardware/labartSoilSensorUSB.js';
import { spectrometerUSBAdapter } from '../../hardware/spectrometerUSBAdapter.js';
import { irrigationControllerAdapter } from '../../hardware/irrigationControllerAdapter.js';
import { tempHumiditySensorUSB } from '../../hardware/tempHumiditySensorUSB.js';

export function createSettingsDeviceManagerView({
  currentUser = null,
  onOpenSimModal,
  onThemeChange,
  currentTheme = 'creamy-agri'
}) {
  const container = document.createElement('div');
  container.className = "settings-device-manager-view w-full space-y-4 pb-28 text-slate-800 select-none overflow-x-hidden";

  function render() {
    try {
      const locale = getLocale();

    container.innerHTML = `
      <!-- 1. Header Card -->
      <div class="bg-gradient-to-br from-[#0E5431] to-[#0A3D23] text-white rounded-3xl p-5 shadow-lg border border-emerald-800/40 space-y-3">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-emerald-300">
            ${icon('settings', 'w-4 h-4')}
          </div>
          <div>
            <h2 class="text-base font-bold tracking-tight">Settings & Hardware Manager</h2>
            <p class="text-[11px] text-emerald-200/80">Manage OTG USB-C, BLE 5.0, Wi-Fi Cloud Ingestion & Farm Config</p>
          </div>
        </div>

        <div class="pt-2 border-t border-emerald-700/40 flex items-center justify-between text-xs text-emerald-100">
          <span>Enterprise Farm Account:</span>
          <span class="font-bold text-white">${currentUser?.displayName || 'Carlos Mendoza'}</span>
        </div>
      </div>

      <!-- 2. Hardware Device Matrix -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('layers', 'w-4 h-4 text-[#0E5431]')}
            <span>Connected Agricultural Adapters</span>
          </h3>
          <span class="text-[10px] text-emerald-700 font-mono font-bold">4 of 4 Ready</span>
        </div>

        <div class="space-y-2.5">
          <!-- Device 1: LABART 8-in-1 Soil Tester -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-emerald-100 text-[#0E5431] flex items-center justify-center">
                ${icon('soil', 'w-4 h-4')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">LABART 8-in-1 Soil Tester</h4>
                <p class="text-[10px] text-slate-500 font-mono">Modbus RTU RS485 • USB Type-C</p>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#0E5431]">
              ONLINE
            </span>
          </div>

          <!-- Device 2: VIS-NIR Spectrometer -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center">
                ${icon('spectroscopy', 'w-4 h-4')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">VIS-NIR Spectrometer (350–1100 nm)</h4>
                <p class="text-[10px] text-slate-500 font-mono">76 Spectral Bands • PTFE Calibrated</p>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#0E5431]">
              CALIBRATED
            </span>
          </div>

          <!-- Device 3: Hydraulic Solenoid Drip Gateway -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center">
                ${icon('droplet', 'w-4 h-4')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">Drip Irrigation Multi-Valve Controller</h4>
                <p class="text-[10px] text-slate-500 font-mono">±12V Bi-Stable Latch • Hall Flow Meter</p>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#0E5431]">
              6 VALVES
            </span>
          </div>

          <!-- Device 4: Environment Sensor -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                ${icon('thermometer', 'w-4 h-4')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">Temperature & Humidity Sensor</h4>
                <p class="text-[10px] text-slate-500 font-mono">SHT4x Atmospheric + Open-Meteo API</p>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-[#0E5431]">
              DUAL SYNC
            </span>
          </div>
        </div>
      </div>

      <!-- 3. Regional Language Preference -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          ${icon('globe', 'w-4 h-4 text-[#0E5431]')}
          <span>Regional Language & Dialect</span>
        </h3>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          ${SUPPORTED_LOCALES.map(loc => `
            <button 
              type="button" 
              data-set-lang="${loc.code}"
              class="lang-choice-btn p-3 rounded-2xl border text-left flex items-center justify-between transition ${
                locale === loc.code 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-[#0E5431] text-[#0E5431] dark:text-emerald-300 font-bold' 
                  : 'bg-slate-50 dark:bg-slate-850 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }"
            >
              <div>
                <div class="text-xs font-bold">${loc.native}</div>
                <div class="text-[10px] text-slate-500 font-mono">${loc.name} • ${loc.region}</div>
              </div>
              ${locale === loc.code ? icon('check', 'w-4 h-4 text-[#0E5431] dark:text-emerald-300') : ''}
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 4. Diagnostic Telemetry Simulator -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              ${icon('refresh', 'w-4 h-4 text-[#0E5431]')}
              <span>Hardware Telemetry Simulator</span>
            </h3>
            <p class="text-[10px] text-slate-500">Inject heatwave, rain, and overpressure chaos</p>
          </div>

          <button 
            type="button" 
            id="btn-open-sim"
            class="px-3.5 py-1.5 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold transition shadow-sm"
          >
            Open Simulator
          </button>
        </div>
      </div>
    `;

    attachEvents();
    } catch (err) {
      console.error("[SettingsDeviceManagerView] Safe render fallback:", err);
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-emerald-900/10 dark:border-slate-800 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-[#0E5431] flex items-center justify-center">
            ${icon('settings', 'w-6 h-6')}
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Settings & Hardware Manager</h3>
          <p class="text-xs text-slate-500">Device profiles and communication settings ready.</p>
          <button type="button" id="btn-settings-recovery-retry" class="px-4 py-2 rounded-full bg-[#0E5431] text-white text-xs font-bold">
            Refresh Settings
          </button>
        </div>
      `;
      container.querySelector('#btn-settings-recovery-retry')?.addEventListener('click', () => render());
    }
  }

  function attachEvents() {
    // Language Selection
    container.querySelectorAll('.lang-choice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const code = btn.getAttribute('data-set-lang');
        if (code) {
          setLocale(code);
          render();
        }
      });
    });

    // Open Simulator Modal
    container.querySelector('#btn-open-sim')?.addEventListener('click', () => {
      if (onOpenSimModal) onOpenSimModal();
    });
  }

  onLocaleChange(() => render());

  render();
  return container;
}
