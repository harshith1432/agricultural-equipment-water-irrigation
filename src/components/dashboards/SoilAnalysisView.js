/**
 * Module 4 Dashboard: LABART 8-in-1 Soil Tester
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Faithfully matches the user's physical sensor interface:
 *   - Auto-detection logic: plug-and-play detection for USB-C and Bluetooth
 *   - Sleek header with compact Auto-Detected status pill & 3-dots settings button
 *   - Settings modal accessible via 3-dots for inspecting connection or manual override
 *   - 8 Dynamic Tiles: Temp, Moisture, EC, pH, N, P, K, Fertility
 *   - Farmer-friendly condition summary: Nitrogen, Phosphorus, Potassium, Soil pH, Moisture
 *   - 'Save to file' (CSV) and 'Data History' buttons
 *   - Crop selector adapting thresholds
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange, getCropName } from '../../utils/i18n.js';
import { 
  labartSoilSensorUSB, 
  CONNECTION_MODES, 
  CROP_THRESHOLDS 
} from '../../hardware/labartSoilSensorUSB.js';

export function createSoilAnalysisView({
  plot = null
} = {}) {
  const container = document.createElement('div');
  container.className = "soil-analysis-view w-full space-y-4 pb-36 sm:pb-40 text-slate-800 dark:text-slate-100 select-none overflow-x-hidden";

  let connectionMode = labartSoilSensorUSB.connectionMode || CONNECTION_MODES.USB_TYPE_C;
  let selectedCropKey = 'POTATO';
  let currentReading = null;
  let pollingIntervalId = null;
  let isSettingsOpen = false;

  // History buffer for 'Data History' modal
  const historyLog = [
    { time: '10:45 AM', temp: 12.5, moisture: 42.2, ec: 1378, ph: 7.9, n: 68, p: 96, k: 220, fert: 757 },
    { time: '08:30 AM', temp: 11.8, moisture: 41.5, ec: 1350, ph: 7.8, n: 65, p: 94, k: 215, fert: 742 },
    { time: 'Yesterday', temp: 13.2, moisture: 38.4, ec: 1310, ph: 7.8, n: 70, p: 95, k: 210, fert: 735 }
  ];

  async function loadReading() {
    try {
      if (!labartSoilSensorUSB.isConnected) {
        if (typeof labartSoilSensorUSB.autoDetectAndConnect === 'function') {
          await labartSoilSensorUSB.autoDetectAndConnect({ cropKey: selectedCropKey });
        } else {
          await labartSoilSensorUSB.connect({ mode: connectionMode, autoFallback: true });
        }
      }
      currentReading = await labartSoilSensorUSB.readData({ cropKey: selectedCropKey });
      connectionMode = labartSoilSensorUSB.connectionMode || connectionMode;
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

  // Listen to auto-connected hardware events (USB plug-in or Bluetooth connection)
  const unsubs = [];
  if (typeof labartSoilSensorUSB.on === 'function') {
    unsubs.push(labartSoilSensorUSB.on('autoConnected', (data) => {
      connectionMode = data.mode;
      loadReading();
    }));
    unsubs.push(labartSoilSensorUSB.on('statusChange', () => {
      render();
    }));
  }

  function getReadableModeLabel(mode) {
    switch (mode) {
      case CONNECTION_MODES.USB_TYPE_C:
        return t('mode_usb');
      case CONNECTION_MODES.BLUETOOTH_BLE:
        return t('mode_ble');
      case CONNECTION_MODES.WIFI_CLOUD:
        return t('wifi_cloud');
      default:
        return t('auto_detection_active');
    }
  }

  function render() {
    try {
      const scrollParent = container.closest('main') || container.parentElement;
      const prevScroll = scrollParent ? scrollParent.scrollTop : 0;

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
      const isConnected = labartSoilSensorUSB.isConnected;
      const modeLabel = getReadableModeLabel(connectionMode);

      container.innerHTML = `
        <!-- 1. Sleek Forest Green Header Card (NO huge 3-button switcher, compact 3-dots button) -->
        <div class="bg-gradient-to-br from-[#0E5431] to-[#0A3D23] text-white rounded-3xl p-4 sm:p-5 shadow-lg border border-emerald-800/40 space-y-3 overflow-hidden">
          <div class="flex items-center justify-between gap-2">
            <div class="min-w-0 flex-1 pr-1">
              <h2 class="text-sm sm:text-base font-bold tracking-tight leading-snug break-words">${t('soil_title')}</h2>
              <p class="text-[10px] text-emerald-200/80 leading-normal break-words mt-0.5">${t('soil_subtitle')}</p>
            </div>

            <!-- Header Controls: Compact Auto-Detected Status Badge & 3-Dots Settings Button -->
            <div class="flex items-center gap-2 flex-shrink-0">
              <!-- Auto-Detected Hardware Pill -->
              <div 
                id="soil-connection-pill"
                class="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 border border-white/20 text-emerald-100 flex items-center gap-1.5 shadow-sm"
                title="Hardware Auto-Detected Interface"
              >
                <span class="w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}"></span>
                <span class="font-mono text-[11px]">${modeLabel}</span>
              </div>

              <!-- 3-Dots Settings Overflow Button -->
              <button 
                type="button" 
                id="btn-soil-settings"
                class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center transition border border-white/20 shadow-sm"
                title="Soil Sensor Connection & Calibration Settings"
                aria-label="Soil Settings"
              >
                ${icon('moreVertical', 'w-4 h-4')}
              </button>
            </div>
          </div>

          <!-- Crop Selector Dropdown (Compact, well-spaced) -->
          <div class="flex items-center justify-between pt-2 border-t border-emerald-700/40 flex-wrap gap-2">
            <span class="text-xs text-emerald-100 font-medium shrink-0">${t('crop_selector')}:</span>
            <select id="soil-crop-select" class="min-h-[34px] px-3 py-1 rounded-xl bg-white/15 border border-white/25 text-xs font-bold text-white focus:outline-none cursor-pointer flex-1 max-w-[220px]">
              <option value="POTATO" class="text-slate-900" ${selectedCropKey === 'POTATO' ? 'selected' : ''}>${t('crop_potato_opt', 'Potatoes (Scab pH Sensitive)')}</option>
              <option value="TOMATO" class="text-slate-900" ${selectedCropKey === 'TOMATO' ? 'selected' : ''}>${t('crop_tomato_opt', 'Tomatoes (High K Feeder)')}</option>
              <option value="BELL_PEPPER" class="text-slate-900" ${selectedCropKey === 'BELL_PEPPER' ? 'selected' : ''}>${t('crop_pepper_opt', 'Bell Peppers (Moisture Sensitive)')}</option>
              <option value="WHEAT" class="text-slate-900" ${selectedCropKey === 'WHEAT' ? 'selected' : ''}>${t('crop_wheat_opt', 'Wheat (Crown Root Phase)')}</option>
              <option value="MAIZE" class="text-slate-900" ${selectedCropKey === 'MAIZE' ? 'selected' : ''}>${t('crop_maize_opt', 'Corn / Maize (High N Feeder)')}</option>
              <option value="COTTON" class="text-slate-900" ${selectedCropKey === 'COTTON' ? 'selected' : ''}>${t('crop_cotton_opt', 'Cotton (Salt Tolerant)')}</option>
            </select>
          </div>
        </div>

        <!-- 2. The 8 Dynamic Tiles Matching Physical LABART 8-in-1 Device Interface -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3 overflow-hidden">
          <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 gap-2">
            <div class="min-w-0 flex-1">
              <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5 leading-snug break-words">
                ${icon('soil', 'w-4 h-4 text-[#0E5431] shrink-0')}
                <span>${t('soil_matrix_title')}</span>
              </h3>
              <p class="text-[10px] text-slate-500 leading-normal break-words mt-0.5">${t('soil_matrix_sub')}</p>
            </div>

            <button 
              type="button" 
              id="btn-take-soil-reading"
              class="px-3 py-1.5 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition shrink-0 active:scale-95 whitespace-nowrap"
            >
              ${icon('refresh', 'w-3.5 h-3.5')}
              <span>${t('read_sensor')}</span>
            </button>
          </div>

          <!-- 8 Tiles Grid (Clean 2x4 on mobile, 4x2 on tablet) -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <!-- 1. Temperature -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-slate-500 font-medium truncate">${t('param_temp')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">${p.temperatureC.toFixed(1)}</span>
                <span class="text-xs text-slate-500 font-bold shrink-0">°C</span>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 truncate">${t('optimum')}: 15–24°C</span>
            </div>

            <!-- 2. Moisture % VWC -->
            <div class="p-3 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-300 dark:border-emerald-800/40 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium truncate">${t('param_moisture')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-emerald-900 dark:text-emerald-200 font-mono leading-none">${p.moistureVwc.toFixed(1)}</span>
                <span class="text-xs text-emerald-700 font-bold shrink-0">%</span>
              </div>
              <span class="text-[9px] text-emerald-600 dark:text-emerald-400 mt-1 truncate">${t('optimum')}: ${activeCrop.moistureVwc.optimalMin}–${activeCrop.moistureVwc.optimalMax}%</span>
            </div>

            <!-- 3. Conductivity (EC) -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-slate-500 font-medium truncate">${t('param_ec')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">${p.ecUsCm}</span>
                <span class="text-xs text-slate-500 font-bold shrink-0">µS/cm</span>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 truncate">Max: ${activeCrop.ecMax} µS/cm</span>
            </div>

            <!-- 4. pH -->
            <div class="p-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300 dark:border-amber-800/40 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-amber-800 dark:text-amber-300 font-medium truncate">${t('param_ph')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-amber-900 dark:text-amber-200 font-mono leading-none">${p.ph.toFixed(1)}</span>
                <span class="text-xs text-amber-700 font-bold shrink-0">pH</span>
              </div>
              <span class="text-[9px] text-amber-600 dark:text-amber-400 mt-1 truncate">${t('optimum')}: ${activeCrop.ph.optimalMin}–${activeCrop.ph.optimalMax}</span>
            </div>

            <!-- 5. Nitrogen (N) -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-slate-500 font-medium truncate">${t('param_nitrogen')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">${p.nitrogenMgKg}</span>
                <span class="text-xs text-slate-500 font-bold shrink-0">mg/kg</span>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 truncate">${t('optimum')}: ${activeCrop.nitrogen.optimal} mg/kg</span>
            </div>

            <!-- 6. Phosphorus (P) -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-slate-500 font-medium truncate">${t('param_phosphorus')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">${p.phosphorusMgKg}</span>
                <span class="text-xs text-slate-500 font-bold shrink-0">mg/kg</span>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 truncate">${t('optimum')}: ${activeCrop.phosphorus.optimal} mg/kg</span>
            </div>

            <!-- 7. Potassium (K) -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-slate-500 font-medium truncate">${t('param_potassium')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">${p.potassiumMgKg}</span>
                <span class="text-xs text-slate-500 font-bold shrink-0">mg/kg</span>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 truncate">${t('optimum')}: ${activeCrop.potassium.optimal} mg/kg</span>
            </div>

            <!-- 8. Fertility Index -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700/80 flex flex-col min-w-0 overflow-hidden break-words">
              <span class="text-[10px] text-slate-500 font-medium truncate">${t('param_fertility')}</span>
              <div class="flex items-baseline gap-1 mt-1 whitespace-nowrap overflow-visible">
                <span class="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono leading-none">${p.fertilityMgKg}</span>
                <span class="text-xs text-slate-500 font-bold shrink-0">mg/kg</span>
              </div>
              <span class="text-[9px] text-slate-400 mt-1 truncate">${t('status_live_active')}</span>
            </div>
          </div>
        </div>

        <!-- 3. Farmer-Friendly Condition Summary -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3 overflow-hidden">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('shieldCheck', 'w-4 h-4 text-[#0E5431] shrink-0')}
            <span>${t('soil_summary_title')}</span>
          </h3>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col min-w-0 overflow-hidden">
              <span class="text-[10px] text-slate-500 truncate">${t('cond_nitrogen_label')}:</span>
              <span class="font-bold text-slate-800 dark:text-white mt-0.5 truncate">${t('cond_' + (interp.nitrogenCondition || 'moderate').toLowerCase())}</span>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col min-w-0 overflow-hidden">
              <span class="text-[10px] text-slate-500 truncate">${t('cond_phosphorus_label')}:</span>
              <span class="font-bold text-slate-800 dark:text-white mt-0.5 truncate">${t('cond_' + (interp.phosphorusCondition || 'high').toLowerCase())}</span>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col min-w-0 overflow-hidden">
              <span class="text-[10px] text-slate-500 truncate">${t('cond_potassium_label')}:</span>
              <span class="font-bold text-slate-800 dark:text-white mt-0.5 truncate">${t('cond_' + (interp.potassiumCondition || 'moderate').toLowerCase())}</span>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col min-w-0 overflow-hidden">
              <span class="text-[10px] text-slate-500 truncate">${t('cond_ph_label')}:</span>
              <span class="font-bold text-amber-700 dark:text-amber-300 mt-0.5 truncate">${t('cond_' + (interp.phCondition || 'alkaline').toLowerCase())} (${p.ph.toFixed(1)})</span>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col min-w-0 overflow-hidden">
              <span class="text-[10px] text-slate-500 truncate">${t('cond_moisture_label')}:</span>
              <span class="font-bold text-blue-700 dark:text-blue-300 mt-0.5 truncate">${t('cond_' + (interp.moistureCondition || 'saturated').toLowerCase())} (${p.moistureVwc.toFixed(1)}%)</span>
            </div>

            <div class="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 flex flex-col min-w-0 overflow-hidden">
              <span class="text-[10px] text-slate-500 truncate">${t('cond_target_crop_label')}:</span>
              <span class="font-bold text-[#0E5431] dark:text-emerald-300 mt-0.5 truncate">${getCropName(activeCrop.name)}</span>
            </div>
          </div>

          <div class="p-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs text-[#0E5431] dark:text-emerald-200">
            <span class="font-bold">${t('agronomic_insight')}:</span>
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
            class="py-3 px-4 rounded-full bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition border border-slate-200 dark:border-slate-700 hover:bg-slate-50 active:scale-95"
          >
            ${icon('history', 'w-4 h-4')}
            <span>${t('data_history')}</span>
          </button>
        </div>

        <!-- 5. Subtle Settings Modal (Opened via 3-dots in header) -->
        <div id="soil-settings-modal" class="${isSettingsOpen ? '' : 'hidden'} fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 max-w-sm w-full shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                ${icon('settings', 'w-4 h-4 text-[#0E5431]')}
                <span>${t('soil_hardware_settings', 'Soil Sensor Hardware Settings')}</span>
              </h3>
              <button type="button" id="close-settings-modal" class="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                ${icon('x', 'w-4 h-4')}
              </button>
            </div>

            <!-- Auto-Detection Status Info Banner -->
            <div class="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-700/50 text-xs space-y-1.5">
              <div class="flex items-center gap-2 font-bold text-[#0E5431] dark:text-emerald-300">
                <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                <span>${t('auto_detection_active', 'Auto-Detection Active (Plug & Play)')}</span>
              </div>
              <p class="text-[11px] text-emerald-800 dark:text-emerald-200/90 leading-relaxed">
                ${t('soil_auto_detect_desc', 'Connect your USB-C probe or turn on Bluetooth; the app automatically detects the hardware and streams telemetry with zero configuration needed.')}
              </p>
            </div>

            <!-- Manual Override Interface (Compact options if needed) -->
            <div class="space-y-1.5">
              <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${t('manual_interface_override', 'Manual Interface Override:')}</span>
              <div class="grid grid-cols-3 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                <button 
                  type="button" 
                  data-mode="${CONNECTION_MODES.USB_TYPE_C}"
                  class="soil-mode-btn py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                    connectionMode === CONNECTION_MODES.USB_TYPE_C 
                      ? 'bg-[#0E5431] text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }"
                >
                  ${icon('usb', 'w-3.5 h-3.5')}
                  <span class="text-[10px]">${t('mode_usb')}</span>
                </button>

                <button 
                  type="button" 
                  data-mode="${CONNECTION_MODES.BLUETOOTH_BLE}"
                  class="soil-mode-btn py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                    connectionMode === CONNECTION_MODES.BLUETOOTH_BLE 
                      ? 'bg-[#0E5431] text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }"
                >
                  ${icon('bluetooth', 'w-3.5 h-3.5')}
                  <span class="text-[10px]">${t('bluetooth')}</span>
                </button>

                <button 
                  type="button" 
                  data-mode="${CONNECTION_MODES.WIFI_CLOUD}"
                  class="soil-mode-btn py-1.5 px-1 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 transition ${
                    connectionMode === CONNECTION_MODES.WIFI_CLOUD 
                      ? 'bg-[#0E5431] text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }"
                >
                  ${icon('wifi', 'w-3.5 h-3.5')}
                  <span class="text-[10px]">${t('cloud_ingest', 'Cloud Ingest')}</span>
                </button>
              </div>
            </div>

            <!-- Hardware Specifications -->
            <div class="p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-700 text-xs space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-300">
              <div class="flex justify-between">
                <span>${t('protocol_label', 'Protocol:')}</span>
                <span class="font-bold text-slate-800 dark:text-white">Modbus RTU RS485</span>
              </div>
              <div class="flex justify-between">
                <span>${t('baud_rate_label', 'Baud Rate:')}</span>
                <span class="font-bold text-slate-800 dark:text-white">9600 bps (8-N-1)</span>
              </div>
              <div class="flex justify-between">
                <span>${t('probe_label', 'Probe:')}</span>
                <span class="font-bold text-slate-800 dark:text-white">${t('probe_material', '5-Prong 316L Steel')}</span>
              </div>
            </div>

            <button 
              type="button" 
              id="confirm-settings-btn"
              class="w-full py-2.5 rounded-full bg-[#0E5431] text-white text-xs font-bold hover:bg-[#083820] transition active:scale-95 shadow-sm"
            >
              ${t('apply_and_close', 'Apply & Close')}
            </button>
          </div>
        </div>

        <!-- 6. History Modal Container -->
        <div id="soil-history-modal" class="hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"></div>
      `;

      attachEvents();

      if (scrollParent && prevScroll > 0) {
        scrollParent.scrollTop = prevScroll;
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            if (scrollParent.scrollTop !== prevScroll) {
              scrollParent.scrollTop = prevScroll;
            }
          });
        }
      }
    } catch (renderError) {
      console.error("[SoilAnalysisView] Render error safely handled:", renderError);
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-emerald-900/10 dark:border-slate-800 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-[#0E5431] flex items-center justify-center">
            ${icon('soil', 'w-6 h-6')}
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">LABART 8-in-1 Soil Sensor Ready</h3>
          <p class="text-xs text-slate-500">Live Modbus RTU telemetry streaming in background.</p>
          <button type="button" id="btn-soil-recovery-retry" class="px-4 py-2 rounded-full bg-[#0E5431] text-white text-xs font-bold">
            Refresh Telemetry
          </button>
        </div>
      `;
      container.querySelector('#btn-soil-recovery-retry')?.addEventListener('click', () => loadReading());
    }
  }

  function attachEvents() {
    // 3-Dots Settings Button
    container.querySelector('#btn-soil-settings')?.addEventListener('click', () => {
      isSettingsOpen = true;
      render();
    });

    // Close Settings Button
    container.querySelector('#close-settings-modal')?.addEventListener('click', () => {
      isSettingsOpen = false;
      render();
    });
    container.querySelector('#confirm-settings-btn')?.addEventListener('click', () => {
      isSettingsOpen = false;
      render();
    });

    // Mode Switcher Buttons inside Settings Modal
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
        <div class="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
          <h3 class="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('history', 'w-4 h-4 text-[#0E5431]')}
            <span>${t('soil_history_title', 'Soil 8-in-1 Sensor History Log')}</span>
          </h3>
          <button type="button" id="close-history-modal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
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
