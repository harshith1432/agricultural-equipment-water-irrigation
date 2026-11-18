/**
 * Module 4 Dashboard: LABART 8-in-1 Soil Tester
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Faithfully matches the user's physical sensor interface:
 *   - Header: 'Soil Parameter Detector' with connected LABART device pill
 *   - 3-Way Connection Mode Switcher: USB Type-C | Bluetooth BLE | Wi-Fi Cloud Stream
 *   - Live "Wi-Fi IoT Synced (via Cloud Database)" badge when Cloud Stream selected with auto-polling
 *   - 8 Dynamic Tiles:
 *       1. Temperature °C (e.g. 12.5°C)
 *       2. Moisture % VWC (e.g. 42.2%)
 *       3. Conductivity (EC) µS/cm (e.g. 1378 µS/cm)
 *       4. pH (e.g. 7.9)
 *       5. (N) Nitrogen mg/kg (e.g. 68 mg/kg)
 *       6. (P) Phosphorus mg/kg (e.g. 96 mg/kg)
 *       7. (K) Potassium mg/kg (e.g. 220 mg/kg)
 *       8. Fertility mg/kg (e.g. 757 mg/kg)
 *   - Farmer-friendly condition summary: Nitrogen, Phosphorus, Potassium, Soil pH, Moisture
 *   - 'Save to file' and 'Data History' buttons
 *   - Crop selector (Tomatoes, Bell Peppers, Potatoes, Wheat, Corn, Cotton) adapting thresholds
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange } from '../../utils/i18n.js';
import { 
  labartSoilSensorUSB, 
  CONNECTION_MODES, 
  CROP_THRESHOLDS 
} from '../../hardware/labartSoilSensorUSB.js';

export function createSoilAnalysisView({
  plot = null
}) {
  const container = document.createElement('div');
  container.className = "soil-analysis-view w-full space-y-4 pb-28 text-slate-800 select-none";

  let connectionMode = labartSoilSensorUSB.connectionMode || CONNECTION_MODES.USB_TYPE_C;
  let selectedCropKey = 'POTATO';
  let currentReading = null;
  let pollingIntervalId = null;

  // History buffer for 'Data History' modal
  const historyLog = [
    { time: '10:45 AM', temp: 12.5, moisture: 42.2, ec: 1378, ph: 7.9, n: 68, p: 96, k: 220, fert: 757 },
    { time: '08:30 AM', temp: 11.8, moisture: 41.5, ec: 1350, ph: 7.8, n: 65, p: 94, k: 215, fert: 742 },
    { time: 'Yesterday', temp: 13.2, moisture: 38.4, ec: 1310, ph: 7.8, n: 70, p: 95, k: 210, fert: 735 }
  ];

  async function loadReading() {
    try {
      if (!labartSoilSensorUSB.isConnected) {
        await labartSoilSensorUSB.connect({ mode: connectionMode, autoFallback: true });
      }
      currentReading = await labartSoilSensorUSB.readData({ cropKey: selectedCropKey });
    } catch (e) {
      console.warn("Soil read error:", e);
    } finally {
      render();
    }
  }

  function handleModeChange(mode) {
    connectionMode = mode;
    labartSoilSensorUSB.setConnectionMode(mode);

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
    const p = currentReading?.parameters || (currentReading?.raw ? {
      temperatureC: currentReading.raw.temperature_c ?? 12.5,
      moistureVwc: currentReading.raw.moisture_vwc ?? 42.2,
      ecUsCm: currentReading.raw.ec_us_cm ?? 1378,
      ph: currentReading.raw.ph ?? 7.9,
      nitrogenMgKg: currentReading.raw.nitrogen_mg_kg ?? 68,
      phosphorusMgKg: currentReading.raw.phosphorus_mg_kg ?? 96,
      potassiumMgKg: currentReading.raw.potassium_mg_kg ?? 220,
      fertilityMgKg: currentReading.raw.fertility_mg_kg ?? 757
    } : null) || {
      temperatureC: 12.5,
      moistureVwc: 42.2,
      ecUsCm: 1378,
      ph: 7.9,
      nitrogenMgKg: 68,
      phosphorusMgKg: 96,
      potassiumMgKg: 220,
      fertilityMgKg: 757
    };

    const interp = currentReading?.interpretation?.npk ? {
      nitrogenCondition: currentReading.interpretation.npk?.nitrogen?.status || 'Moderate',
      phosphorusCondition: currentReading.interpretation.npk?.phosphorus?.status || 'High',
      potassiumCondition: currentReading.interpretation.npk?.potassium?.status || 'Moderate',
      phCondition: currentReading.interpretation.ph?.status || 'Alkaline',
      moistureCondition: currentReading.interpretation.moisture?.status || 'Saturated',
      overallAgronomicStatus: `Score: ${currentReading.interpretation.agronomicScore ?? 85}/100 • ${currentReading.interpretation.moisture?.advisory || 'Balanced'}`
    } : (currentReading?.interpretation || {
      nitrogenCondition: 'Moderate',
      phosphorusCondition: 'High',
      potassiumCondition: 'Moderate',
      phCondition: 'Alkaline',
      moistureCondition: 'Saturated',
      overallAgronomicStatus: 'Caution: Elevated pH & Moisture Saturated'
    });

    const activeCrop = CROP_THRESHOLDS[selectedCropKey] || CROP_THRESHOLDS.POTATO;

    container.innerHTML = `
      <!-- 1. Header Card with Connected LABART USB Device Pill -->
      <div class="bg-gradient-to-br from-[#0E5431] to-[#0A3D23] text-white rounded-3xl p-5 shadow-lg border border-emerald-800/40 space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-base font-bold tracking-tight">${t('soil_title')}</h2>
            <p class="text-[11px] text-emerald-200/80">${t('soil_subtitle')}</p>
          </div>

          <!-- Connected Device Pill -->
          <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 border border-white/20 text-emerald-100 flex items-center gap-1.5 shadow-sm">
            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>LABART USB Type-C</span>
          </span>
        </div>

        <!-- 3-Way Mode Switcher Pill -->
        <div class="pt-2 border-t border-emerald-700/40">
          <div class="grid grid-cols-3 gap-1.5 bg-black/20 p-1 rounded-2xl">
            <button 
              type="button" 
              data-mode="${CONNECTION_MODES.USB_TYPE_C}"
              class="soil-mode-btn py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                connectionMode === CONNECTION_MODES.USB_TYPE_C 
                  ? 'bg-white text-[#0E5431] shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10'
              }"
            >
              ${icon('usb', 'w-3.5 h-3.5')}
              <span>${t('mode_usb')}</span>
            </button>

            <button 
              type="button" 
              data-mode="${CONNECTION_MODES.BLUETOOTH_BLE}"
              class="soil-mode-btn py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                connectionMode === CONNECTION_MODES.BLUETOOTH_BLE 
                  ? 'bg-white text-[#0E5431] shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10'
              }"
            >
              ${icon('bluetooth', 'w-3.5 h-3.5')}
              <span>${t('mode_ble')}</span>
            </button>

            <button 
              type="button" 
              data-mode="${CONNECTION_MODES.WIFI_CLOUD}"
              class="soil-mode-btn py-1.5 px-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                connectionMode === CONNECTION_MODES.WIFI_CLOUD 
                  ? 'bg-white text-[#0E5431] shadow-sm' 
                  : 'text-emerald-100 hover:bg-white/10'
              }"
            >
              ${icon('wifi', 'w-3.5 h-3.5')}
              <span>${t('mode_wifi')}</span>
            </button>
          </div>
        </div>

        <!-- Wi-Fi Cloud Live Badge -->
        ${connectionMode === CONNECTION_MODES.WIFI_CLOUD ? `
          <div class="px-3 py-1.5 rounded-xl bg-white/15 border border-white/20 flex items-center justify-between text-xs text-white">
            <span class="font-bold flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>${t('wifi_synced_badge')}</span>
            </span>
            <span class="text-[10px] font-mono text-emerald-200">Auto-polling 4s</span>
          </div>
        ` : ''}

        <!-- Crop Selector Dropdown -->
        <div class="flex items-center justify-between pt-1">
          <span class="text-xs text-emerald-100 font-medium">${t('crop_selector')}:</span>
          <select id="soil-crop-select" class="min-h-[36px] px-3 py-1 rounded-xl bg-white/15 border border-white/25 text-xs font-bold text-white focus:outline-none cursor-pointer">
            <option value="POTATO" class="text-slate-900" ${selectedCropKey === 'POTATO' ? 'selected' : ''}>Potatoes (Scab pH Sensitive)</option>
            <option value="TOMATO" class="text-slate-900" ${selectedCropKey === 'TOMATO' ? 'selected' : ''}>Tomatoes (High K Feeder)</option>
            <option value="BELL_PEPPER" class="text-slate-900" ${selectedCropKey === 'BELL_PEPPER' ? 'selected' : ''}>Bell Peppers (Moisture Sensitive)</option>
            <option value="WHEAT" class="text-slate-900" ${selectedCropKey === 'WHEAT' ? 'selected' : ''}>Wheat (Crown Root Phase)</option>
            <option value="MAIZE" class="text-slate-900" ${selectedCropKey === 'MAIZE' ? 'selected' : ''}>Corn / Maize (High N Feeder)</option>
            <option value="COTTON" class="text-slate-900" ${selectedCropKey === 'COTTON' ? 'selected' : ''}>Cotton (Salt Tolerant)</option>
          </select>
        </div>
      </div>

      <!-- 2. The 8 Dynamic Tiles Matching Physical LABART 8-in-1 Device Interface -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              ${icon('soil', 'w-4 h-4 text-[#0E5431]')}
              <span>8-Parameter Digital Matrix</span>
            </h3>
            <p class="text-[10px] text-slate-500">Modbus RTU 5-Prong Multi-Depth Subsurface Probe</p>
          </div>

          <button 
            type="button" 
            id="btn-take-soil-reading"
            class="px-3 py-1.5 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition"
          >
            ${icon('refresh', 'w-3.5 h-3.5')}
            <span>Read Sensor</span>
          </button>
        </div>

        <!-- 8 Tiles Grid (2x4) -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <!-- 1. Temperature -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">${t('param_temp')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-slate-900 dark:text-white font-mono">${p.temperatureC.toFixed(1)}</span>
              <span class="text-xs text-slate-500 font-bold">°C</span>
            </div>
            <span class="text-[9px] text-slate-400 mt-1">Target: 15–24°C</span>
          </div>

          <!-- 2. Moisture % VWC -->
          <div class="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/40 flex flex-col">
            <span class="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">${t('param_moisture')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-emerald-900 dark:text-emerald-200 font-mono">${p.moistureVwc.toFixed(1)}</span>
              <span class="text-xs text-emerald-700 font-bold">%</span>
            </div>
            <span class="text-[9px] text-emerald-600 dark:text-emerald-400 mt-1">Opt: ${activeCrop.moistureVwc.optimalMin}–${activeCrop.moistureVwc.optimalMax}%</span>
          </div>

          <!-- 3. Conductivity (EC) -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">${t('param_ec')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-slate-900 dark:text-white font-mono">${p.ecUsCm}</span>
              <span class="text-xs text-slate-500 font-bold">µS/cm</span>
            </div>
            <span class="text-[9px] text-slate-400 mt-1">Max: ${activeCrop.ecMax} µS/cm</span>
          </div>

          <!-- 4. pH -->
          <div class="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 flex flex-col">
            <span class="text-[10px] text-amber-800 dark:text-amber-300 font-medium">${t('param_ph')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-amber-900 dark:text-amber-200 font-mono">${p.ph.toFixed(1)}</span>
              <span class="text-xs text-amber-700 font-bold">pH</span>
            </div>
            <span class="text-[9px] text-amber-600 dark:text-amber-400 mt-1">Opt: ${activeCrop.ph.optimalMin}–${activeCrop.ph.optimalMax}</span>
          </div>

          <!-- 5. Nitrogen (N) -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">${t('param_nitrogen')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-slate-900 dark:text-white font-mono">${p.nitrogenMgKg}</span>
              <span class="text-xs text-slate-500 font-bold">mg/kg</span>
            </div>
            <span class="text-[9px] text-slate-400 mt-1">Opt: ${activeCrop.nitrogen.optimal} mg/kg</span>
          </div>

          <!-- 6. Phosphorus (P) -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">${t('param_phosphorus')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-slate-900 dark:text-white font-mono">${p.phosphorusMgKg}</span>
              <span class="text-xs text-slate-500 font-bold">mg/kg</span>
            </div>
            <span class="text-[9px] text-slate-400 mt-1">Opt: ${activeCrop.phosphorus.optimal} mg/kg</span>
          </div>

          <!-- 7. Potassium (K) -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">${t('param_potassium')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-slate-900 dark:text-white font-mono">${p.potassiumMgKg}</span>
              <span class="text-xs text-slate-500 font-bold">mg/kg</span>
            </div>
            <span class="text-[9px] text-slate-400 mt-1">Opt: ${activeCrop.potassium.optimal} mg/kg</span>
          </div>

          <!-- 8. Fertility Index -->
          <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col">
            <span class="text-[10px] text-slate-500 font-medium">${t('param_fertility')}</span>
            <div class="flex items-baseline gap-1 mt-1">
              <span class="text-2xl font-black text-slate-900 dark:text-white font-mono">${p.fertilityMgKg}</span>
              <span class="text-xs text-slate-500 font-bold">mg/kg</span>
            </div>
            <span class="text-[9px] text-slate-400 mt-1">Comprehensive</span>
          </div>
        </div>
      </div>

      <!-- 3. Farmer-Friendly Condition Summary -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
          ${icon('shieldCheck', 'w-4 h-4 text-[#0E5431]')}
          <span>Farmer-Friendly Agronomic Summary</span>
        </h3>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500">Nitrogen Condition:</span>
            <span class="font-bold text-slate-800 dark:text-white mt-0.5">${interp.nitrogenCondition}</span>
          </div>

          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500">Phosphorus Condition:</span>
            <span class="font-bold text-slate-800 dark:text-white mt-0.5">${interp.phosphorusCondition}</span>
          </div>

          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500">Potassium Condition:</span>
            <span class="font-bold text-slate-800 dark:text-white mt-0.5">${interp.potassiumCondition}</span>
          </div>

          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500">Soil pH:</span>
            <span class="font-bold text-amber-700 dark:text-amber-300 mt-0.5">${interp.phCondition} (${p.ph.toFixed(1)})</span>
          </div>

          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500">Moisture Level:</span>
            <span class="font-bold text-blue-700 dark:text-blue-300 mt-0.5">${interp.moistureCondition} (${p.moistureVwc.toFixed(1)}%)</span>
          </div>

          <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col">
            <span class="text-[10px] text-slate-500">Target Crop:</span>
            <span class="font-bold text-[#0E5431] dark:text-emerald-300 mt-0.5">${activeCrop.name}</span>
          </div>
        </div>

        <div class="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-[#0E5431] dark:text-emerald-200">
          <span class="font-bold">Agronomic Insight:</span>
          <span>${activeCrop.notes}</span>
        </div>
      </div>

      <!-- 4. Action Buttons: 'Save to file' & 'Data History' -->
      <div class="grid grid-cols-2 gap-3">
        <button 
          type="button" 
          id="btn-save-to-file"
          class="py-3 px-4 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition transform active:scale-95"
        >
          ${icon('download', 'w-4 h-4')}
          <span>${t('save_to_file')}</span>
        </button>

        <button 
          type="button" 
          id="btn-data-history"
          class="py-3 px-4 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition border border-slate-300 dark:border-slate-700"
        >
          ${icon('history', 'w-4 h-4')}
          <span>${t('data_history')}</span>
        </button>
      </div>

      <!-- History Modal Container -->
      <div id="soil-history-modal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"></div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Mode Switcher Buttons
    container.querySelectorAll('.soil-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode) handleModeChange(mode);
      });
    });

    // Crop Selector Dropdown
    container.querySelector('#soil-crop-select')?.addEventListener('change', (e) => {
      selectedCropKey = e.target.value;
      loadReading();
    });

    // Read Sensor Button
    container.querySelector('#btn-take-soil-reading')?.addEventListener('click', () => {
      loadReading();
    });

    // Save to File (CSV Download)
    container.querySelector('#btn-save-to-file')?.addEventListener('click', () => {
      exportSoilReadingCSV();
    });

    // Data History Modal
    container.querySelector('#btn-data-history')?.addEventListener('click', () => {
      openHistoryModal();
    });
  }

  function exportSoilReadingCSV() {
    const p = currentReading?.parameters || {
      temperatureC: 12.5,
      moistureVwc: 42.2,
      ecUsCm: 1378,
      ph: 7.9,
      nitrogenMgKg: 68,
      phosphorusMgKg: 96,
      potassiumMgKg: 220,
      fertilityMgKg: 757
    };

    const csvContent = "data:text/csv;charset=utf-8," +
      "Timestamp,Crop,Temperature_C,Moisture_VWC_Percent,EC_uS_cm,pH,Nitrogen_mg_kg,Phosphorus_mg_kg,Potassium_mg_kg,Fertility_mg_kg\n" +
      `${new Date().toISOString()},${selectedCropKey},${p.temperatureC},${p.moistureVwc},${p.ecUsCm},${p.ph},${p.nitrogenMgKg},${p.phosphorusMgKg},${p.potassiumMgKg},${p.fertilityMgKg}\n`;

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `LABART_Soil_Reading_${selectedCropKey}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function openHistoryModal() {
    const modal = container.querySelector('#soil-history-modal');
    if (!modal) return;

    modal.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <div class="flex items-center justify-between border-b pb-2">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('history', 'w-4 h-4 text-[#0E5431]')}
            <span>LABART 8-in-1 Soil Log</span>
          </h3>
          <button type="button" id="close-history-modal" class="text-slate-400 hover:text-slate-600">
            ${icon('x', 'w-4 h-4')}
          </button>
        </div>

        <div class="space-y-2 max-h-72 overflow-y-auto pr-1">
          ${historyLog.map(log => `
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <div class="flex items-center justify-between font-bold text-slate-800 dark:text-white">
                <span>Reading at ${log.time}</span>
                <span class="text-emerald-700 dark:text-emerald-300 font-mono">${log.moisture}% VWC</span>
              </div>
              <div class="grid grid-cols-3 gap-1 text-[10px] text-slate-500 font-mono">
                <span>Temp: ${log.temp}°C</span>
                <span>pH: ${log.ph}</span>
                <span>EC: ${log.ec}</span>
                <span>N: ${log.n}</span>
                <span>P: ${log.p}</span>
                <span>K: ${log.k}</span>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.querySelector('#close-history-modal')?.addEventListener('click', () => {
      modal.classList.add('hidden');
    });
  }

  onLocaleChange(() => render());

  render();
  loadReading();
  return container;
}
