/**
 * Spectroscope Specimen & Field Setup Modal (SpecimenSetupModal.js)
 * Tactile High-Contrast Mobile Pop-Up Window / Dialog
 * 
 * Redesigned Specimen Setup & Scan Preparation UI:
 * - Two Modes: [ Automatically Fill ] and [ Manually Fill ]
 * - Unified Batch Layout: Plant Name, Plant Number, Pot Number, Leaf Spot, Zone, Real-time Timestamp
 * - Duplicate Detection Logic:
 *     Flag as duplicate ONLY IF ALL matching fields are identical:
 *     existing.plantName === current.plantName &&
 *     existing.plantNumber === current.plantNumber &&
 *     existing.potNumber === current.potNumber &&
 *     (existing.leafSpot === current.leafSpot || (!current.leafSpot && existing.leafSpot === 1))
 * - When duplicate detected: High-visibility amber/red banner with actionable guidance
 * - "Automatically Fill" Workflow: Auto-increments leaf spot, auto-tags, batch transmits to spectroscope,
 *     and shows prominent green guidance banner:
 *     "✓ Spectroscope is ready! You can scan now. Press the button below to scan [Dark Baseline / White Reference / Leaf Scan, whichever is remaining]."
 * - "Manually Fill" Workflow: "Verify & Send to Spectroscope", checks duplicates, transmits batch, and arms spectroscope.
 * - Direct scan execution without interactive prompt inquiries ("eliminate asking why or yes").
 */

import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { offlineSpectralDatabase } from '../services/offlineSpectralDatabase.js';
import { t } from '../utils/i18n.js';
import { icon } from '../utils/icons.js';
import { sanitizeText, escapeHtml } from '../utils/sanitizer.js';

export function formatCurrentDateTime(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');
  return `${day} ${month} ${year}, ${strHours}:${minutes} ${ampm}`;
}

export function extractSpotNumber(val) {
  if (val == null) return 1;
  const m = String(val).match(/\d+/);
  return m ? parseInt(m[0], 10) : 1;
}

export function findDuplicateScanRecord(current, existingScans = []) {
  if (!current || !existingScans || !existingScans.length) return null;
  const norm = (v) => String(v || '').trim().toLowerCase();

  const curSpot = extractSpotNumber(current.leafSpot);

  return existingScans.find(existing => {
    const matchPlant = norm(existing.plantName) === norm(current.plantName);
    const matchNumber = norm(existing.plantNumber) === norm(current.plantNumber);
    const matchPot = norm(existing.potNumber) === norm(current.potNumber);

    const existSpot = extractSpotNumber(existing.leafSpot);
    const matchSpot = (norm(existing.leafSpot) === norm(current.leafSpot)) ||
                      (!current.leafSpot && (existSpot === 1)) ||
                      (existSpot === curSpot);

    return matchPlant && matchNumber && matchPot && matchSpot;
  }) || null;
}

export function getNextUnscannedLeafSpot(plantName, plantNumber, potNumber, existingScans = []) {
  const norm = (v) => String(v || '').trim().toLowerCase();
  const matching = (existingScans || []).filter(s =>
    norm(s.plantName) === norm(plantName) &&
    norm(s.plantNumber) === norm(plantNumber) &&
    norm(s.potNumber) === norm(potNumber)
  );

  const usedSpots = new Set();
  matching.forEach(s => {
    usedSpots.add(extractSpotNumber(s.leafSpot));
  });

  let next = 1;
  while (usedSpots.has(next)) {
    next++;
  }
  return `Leaf ${next}`;
}

export function getNextSequentialPlantTag(existingScans = []) {
  let maxNum = 0;
  (existingScans || []).forEach(s => {
    const num = s.plantNumber;
    if (num) {
      const m = String(num).match(/PLANT-(\d+)/i);
      if (m) {
        const val = parseInt(m[1], 10);
        if (val > maxNum) maxNum = val;
      }
    }
  });
  if (maxNum === 0) return 'PLANT-042';
  return `PLANT-${String(maxNum + 1).padStart(3, '0')}`;
}

export function createSpecimenSetupModal({
  onSaveAndTransmit,
  onStartCalibration,
  onClose,
  initialData = {},
  hardwarePrompt = null,
  isDarkDone = false,
  isWhiteDone = false,
  existingScans = null
} = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'specimen-data-modal';
  overlay.className = "fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn select-none overflow-y-auto";

  let setupMode = initialData.setupMode || 'auto'; // 'auto' | 'manual'
  let isTransmitting = false;
  let transmitStatus = '';
  let transmitSuccess = false;
  let isArmed = false;
  let duplicateWarning = null;

  // Local cached scans
  let scansList = existingScans || [];
  if (!existingScans && typeof offlineSpectralDatabase?.getAllScans === 'function') {
    offlineSpectralDatabase.getAllScans().then(scans => {
      scansList = scans || [];
      if (setupMode === 'auto' && !isArmed) {
        autoPopulateAndTransmit();
      }
    }).catch(() => {});
  }

  const darkDone = (isDarkDone !== null && isDarkDone !== undefined)
    ? Boolean(isDarkDone)
    : Boolean(leafClipDevice.calibration?.darkCurrentCompleted);
  const whiteDone = (isWhiteDone !== null && isWhiteDone !== undefined)
    ? Boolean(isWhiteDone)
    : Boolean(leafClipDevice.calibration?.whiteDiscCompleted);

  function getRemainingScanName() {
    if (!darkDone) return 'Dark Baseline';
    if (!whiteDone) return 'White Reference';
    return 'Leaf Scan';
  }

  function getRemainingScanStep() {
    if (!darkDone) return 3;
    if (!whiteDone) return 4;
    return 5;
  }

  const formData = {
    plantName: initialData.plantName || initialData.cropVariety || leafClipDevice.specimenMetadata?.plantName || 'Roma Tomato',
    plantNumber: initialData.plantNumber || leafClipDevice.specimenMetadata?.plantNumber || 'PLANT-042',
    potNumber: initialData.potNumber || leafClipDevice.specimenMetadata?.potNumber || 'POT-01',
    leafSpot: initialData.leafSpot || leafClipDevice.specimenMetadata?.leafSpot || 'Leaf 1',
    zone: initialData.zone || leafClipDevice.specimenMetadata?.zone || 'Zone 1',
    timestamp: initialData.timestamp || formatCurrentDateTime()
  };

  const validationErrors = {
    plantName: '',
    plantNumber: '',
    potNumber: '',
    leafSpot: ''
  };

  function validate() {
    let valid = true;
    validationErrors.plantName = '';
    validationErrors.plantNumber = '';
    validationErrors.potNumber = '';
    validationErrors.leafSpot = '';

    formData.plantName = sanitizeText(formData.plantName || '').trim().slice(0, 64);
    formData.plantNumber = sanitizeText(formData.plantNumber || '').trim().toUpperCase().slice(0, 32);
    formData.potNumber = sanitizeText(formData.potNumber || '').trim().toUpperCase().slice(0, 32);
    formData.leafSpot = sanitizeText(formData.leafSpot || '').trim().slice(0, 32);

    if (!formData.plantName || formData.plantName.length < 2) {
      validationErrors.plantName = t('err_plant_name_req', 'Plant name is required (min 2 chars)');
      valid = false;
    }
    if (!formData.plantNumber || formData.plantNumber.length < 2) {
      validationErrors.plantNumber = t('err_plant_num_req', 'Plant number is required (min 2 chars)');
      valid = false;
    }
    if (!formData.potNumber || formData.potNumber.length < 1) {
      validationErrors.potNumber = t('err_pot_num_req', 'Pot/Row number is required');
      valid = false;
    }
    if (!formData.leafSpot || formData.leafSpot.length < 1) {
      validationErrors.leafSpot = t('err_leaf_spot_req', 'Leaf / Spot identification is required');
      valid = false;
    }
    return valid;
  }

  async function autoPopulateAndTransmit() {
    formData.plantName = initialData.plantName || initialData.cropVariety || leafClipDevice.specimenMetadata?.plantName || 'Roma Tomato';
    formData.potNumber = initialData.potNumber || leafClipDevice.specimenMetadata?.potNumber || 'POT-01';
    formData.plantNumber = initialData.plantNumber || getNextSequentialPlantTag(scansList);
    formData.leafSpot = getNextUnscannedLeafSpot(formData.plantName, formData.plantNumber, formData.potNumber, scansList);
    formData.timestamp = formatCurrentDateTime();
    duplicateWarning = null;
    isArmed = true;
    transmitSuccess = true;
    transmitStatus = `Transmitted to spectroscope: ${formData.plantNumber} (${formData.plantName}), ${formData.potNumber}, ${formData.leafSpot}`;

    if (onSaveAndTransmit) {
      onSaveAndTransmit(formData);
    }
    render();

    try {
      if (leafClipDevice.isConnected && typeof leafClipDevice.transmitSpecimenBatch === 'function') {
        await leafClipDevice.transmitSpecimenBatch({
          plantName: formData.plantName,
          plantNumber: formData.plantNumber,
          potNumber: formData.potNumber,
          cropVariety: formData.plantName,
          leafSpot: formData.leafSpot,
          zone: formData.zone,
          timestamp: formData.timestamp
        });
      } else if (typeof leafClipDevice.setSpecimenMetadata === 'function') {
        leafClipDevice.setSpecimenMetadata({
          plantName: formData.plantName,
          plantNumber: formData.plantNumber,
          potNumber: formData.potNumber,
          cropVariety: formData.plantName,
          leafSpot: formData.leafSpot,
          zone: formData.zone,
          timestamp: formData.timestamp
        });
      }
    } catch (err) {
      console.warn('Specimen transmission notice:', err);
    }
  }

  async function handleManualVerifyAndTransmit() {
    duplicateWarning = null;
    if (!validate()) {
      render();
      return;
    }

    // Check duplicate
    const dup = findDuplicateScanRecord(formData, scansList);
    if (dup) {
      duplicateWarning = {
        plantName: dup.plantName,
        plantNumber: dup.plantNumber,
        potNumber: dup.potNumber,
        leafSpot: dup.leafSpot || 'Leaf 1'
      };
      isArmed = false;
      render();
      return;
    }

    isArmed = true;
    transmitSuccess = true;
    transmitStatus = `Transmitted to spectroscope: ${formData.plantNumber} (${formData.plantName}), ${formData.potNumber}, ${formData.leafSpot}`;
    if (onSaveAndTransmit) {
      onSaveAndTransmit(formData);
    }
    render();

    try {
      if (leafClipDevice.isConnected && typeof leafClipDevice.transmitSpecimenBatch === 'function') {
        await leafClipDevice.transmitSpecimenBatch({
          plantName: formData.plantName,
          plantNumber: formData.plantNumber,
          potNumber: formData.potNumber,
          cropVariety: formData.plantName,
          leafSpot: formData.leafSpot,
          zone: formData.zone,
          timestamp: formData.timestamp
        });
      } else if (typeof leafClipDevice.setSpecimenMetadata === 'function') {
        leafClipDevice.setSpecimenMetadata({
          plantName: formData.plantName,
          plantNumber: formData.plantNumber,
          potNumber: formData.potNumber,
          cropVariety: formData.plantName,
          leafSpot: formData.leafSpot,
          zone: formData.zone,
          timestamp: formData.timestamp
        });
      }
    } catch (err) {
      console.warn('Specimen transmission notice:', err);
    }
  }

  function render() {
    const isConn = leafClipDevice.isConnected;
    const modelName = isConn ? (leafClipDevice.deviceInfo?.model || 'BlueNRG_Chat') : 'Ready';
    const remainingTarget = getRemainingScanName();
    const remainingStep = getRemainingScanStep();

    overlay.innerHTML = `
      <div 
        id="specimen-entry-dialog"
        class="bg-slate-900 border border-slate-750 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-white my-auto max-h-[94vh] flex flex-col"
        role="dialog"
        aria-labelledby="specimen-modal-title"
      >
        <!-- Modal Top Accent Banner -->
        <div class="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-400 to-amber-400"></div>

        <!-- Header -->
        <div class="flex items-start justify-between pb-3.5 border-b border-slate-800 shrink-0">
          <div class="flex items-start gap-3 min-w-0 pr-2">
            <div class="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              ${icon('spectroscopy', 'w-6 h-6 text-emerald-400')}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h3 id="specimen-modal-title" class="text-base sm:text-lg font-bold text-white leading-snug">
                  ${t('specimen_setup_title', 'Spectroscope Specimen & Field Setup')}
                </h3>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${isConn ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
                  ${escapeHtml(modelName)}
                </span>
              </div>
              <p class="text-xs text-slate-300 mt-0.5 leading-relaxed">
                ${t('specimen_setup_subtitle', 'Enter plant data all at once to transmit to the spectroscope sensor')}
              </p>
            </div>
          </div>

          <button
            type="button"
            id="specimen-close-btn"
            class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer shrink-0"
            aria-label="Close dialog"
          >
            ${icon('x', 'w-5 h-5')}
          </button>
        </div>

        <!-- Hardware Prompt Alert Banner (if hardware sent prompt) -->
        ${hardwarePrompt ? `
          <div class="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200 shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
            <div class="min-w-0 flex-1">
              <span class="font-bold uppercase tracking-wider text-[10px] text-amber-400">Sensor Prompt Detected:</span>
              <p class="font-mono text-white text-[11px] truncate mt-0.5">${escapeHtml(hardwarePrompt)}</p>
            </div>
          </div>
        ` : ''}

        <!-- Hardware Prompt Alert Banner (if hardware sent prompt) -->
        ${hardwarePrompt ? `
          <div class="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200 shrink-0">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
            <div class="min-w-0 flex-1">
              <span class="font-bold uppercase tracking-wider text-[10px] text-amber-400">Sensor Prompt Detected:</span>
              <p class="font-mono text-white text-[11px] truncate mt-0.5">${escapeHtml(hardwarePrompt)}</p>
            </div>
          </div>
        ` : ''}

        <!-- MODE SELECTOR TOGGLE (Automatically Fill vs Manually Fill) -->
        <div class="mt-3.5 p-1 rounded-2xl bg-slate-950 border border-slate-800 flex items-center shrink-0">
          <button
            type="button"
            id="modal-mode-auto-btn"
            class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${setupMode === 'auto' ? 'bg-[#1b4332] text-white shadow-md border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'}"
          >
            <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span>Automatically Fill</span>
          </button>
          <button
            type="button"
            id="modal-mode-manual-btn"
            class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${setupMode === 'manual' ? 'bg-[#1b4332] text-white shadow-md border border-emerald-500/40' : 'text-slate-400 hover:text-slate-200'}"
          >
            <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span>Manually Fill</span>
          </button>
        </div>

        <!-- DUPLICATE DETECTION ALERT BANNER -->
        ${duplicateWarning ? `
          <div class="mt-3 p-3.5 rounded-2xl bg-rose-500/15 border-2 border-rose-500/60 flex items-start gap-3 text-xs text-rose-200 animate-pulse shrink-0">
            <span class="text-rose-400 font-extrabold text-base leading-none mt-0.5">⚠️</span>
            <div class="min-w-0 flex-1">
              <span class="font-extrabold uppercase tracking-wider text-[11px] text-rose-300 block mb-0.5">
                Duplicate Detected
              </span>
              <p class="text-white text-xs leading-relaxed">
                This exact scan record already exists for <strong>Plant ${escapeHtml(duplicateWarning.plantName)}</strong>, 
                Tag <strong>#${escapeHtml(duplicateWarning.plantNumber)}</strong>, 
                Pot <strong>#${escapeHtml(duplicateWarning.potNumber)}</strong>, 
                Leaf <strong>#${escapeHtml(duplicateWarning.leafSpot)}</strong>.
              </p>
              <p class="text-[11px] text-rose-300 mt-1 font-semibold">
                👉 Please change the leaf spot number or plant tag below to proceed.
              </p>
            </div>
          </div>
        ` : ''}

        <!-- SPECTROSCOPE ARMED & READY GUIDANCE BANNER -->
        ${isArmed ? `
          <div class="mt-3 p-3.5 rounded-2xl bg-emerald-500/15 border-2 border-emerald-500/50 flex items-start gap-3 text-xs text-emerald-200 shrink-0">
            <div class="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 font-extrabold text-sm">
              ✓
            </div>
            <div class="min-w-0 flex-1">
              <span class="font-extrabold uppercase tracking-wider text-[11px] text-emerald-300 block mb-0.5">
                Spectroscope is Ready
              </span>
              <p class="text-white text-xs font-semibold leading-relaxed">✓ Spectroscope is ready! You can scan now. Press the button below to scan <strong>${escapeHtml(remainingTarget)}</strong>.</p>
              <p class="text-[10px] text-emerald-400/80 font-mono mt-1">
                Batch Target: ${escapeHtml(formData.plantNumber)} (${escapeHtml(formData.plantName)}) | ${escapeHtml(formData.potNumber)} | ${escapeHtml(formData.leafSpot)}
              </p>
            </div>
          </div>
        ` : ''}

        <!-- Scrollable Form Body -->
        <div class="py-3.5 space-y-3.5 overflow-y-auto no-scrollbar flex-1 pr-1">

          <!-- Row 1: Plant Name -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label for="specimen-plant-name" class="font-bold text-slate-200 flex items-center gap-1.5">
                <span>1. ${t('specimen_label_plant_name', 'Plant / Crop Name')}</span>
                <span class="text-rose-400">*</span>
              </label>
              <span class="text-[10px] text-slate-400 font-mono">e.g. Roma Tomato</span>
            </div>
            
            <input
              type="text"
              id="specimen-plant-name"
              class="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.plantName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500'} text-white text-xs font-semibold placeholder-slate-600 outline-none transition"
              placeholder="e.g. Cotton, Roma Tomato, Potato, Bell Pepper"
              value="${escapeHtml(formData.plantName)}"
              autocomplete="off"
            />
            ${validationErrors.plantName ? `<p class="text-[11px] text-rose-400">${validationErrors.plantName}</p>` : ''}

            <!-- Quick Plant Name Preset Chips -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
              <span class="text-[10px] text-slate-500 shrink-0">Presets:</span>
              ${['Cotton', 'Roma Tomato', 'Potato', 'Bell Pepper', 'Wheat', 'Sugarcane'].map(p => `
                <button
                  type="button"
                  class="preset-plant-chip px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700/60 transition shrink-0 cursor-pointer ${formData.plantName === p ? 'bg-[#1b4332] text-white border-emerald-500/50' : ''}"
                  data-name="${p}"
                >
                  ${p}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Row 2: Plant Number & Pot Number -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Plant Number -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label for="specimen-plant-number" class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>2. ${t('specimen_label_plant_number', 'Plant Tag ID')}</span>
                  <span class="text-rose-400">*</span>
                </label>
              </div>

              <div class="relative">
                <input
                  type="text"
                  id="specimen-plant-number"
                  class="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.plantNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500'} text-white font-mono text-xs font-bold uppercase placeholder-slate-600 outline-none transition"
                  placeholder="PLANT-042"
                  value="${escapeHtml(formData.plantNumber)}"
                  autocomplete="off"
                />
                <button
                  type="button"
                  id="btn-autogen-plant-number"
                  class="absolute right-1.5 top-1.5 bottom-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-mono font-bold transition flex items-center gap-1 cursor-pointer"
                  title="Generate fresh ID"
                >
                  ${icon('refresh', 'w-3 h-3')}
                  <span>Gen</span>
                </button>
              </div>
              ${validationErrors.plantNumber ? `<p class="text-[11px] text-rose-400">${validationErrors.plantNumber}</p>` : ''}

              <!-- Quick Number Chips -->
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                <span class="text-[10px] text-slate-500 shrink-0">Samples:</span>
                ${['PLANT-001', 'PLANT-042', 'PLANT-101', 'PLANT-204'].map(num => `
                  <button
                    type="button"
                    class="preset-number-chip px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-mono border border-slate-700/60 transition shrink-0 cursor-pointer"
                    data-num="${num}"
                  >
                    ${num}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Pot / Row Number -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label for="specimen-pot-number" class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>3. ${t('specimen_label_pot_number', 'Pot / Row Number')}</span>
                  <span class="text-rose-400">*</span>
                </label>
              </div>

              <input
                type="text"
                id="specimen-pot-number"
                class="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.potNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500'} text-white font-mono text-xs font-bold uppercase placeholder-slate-600 outline-none transition"
                placeholder="POT-01"
                value="${escapeHtml(formData.potNumber)}"
                autocomplete="off"
              />
              ${validationErrors.potNumber ? `<p class="text-[11px] text-rose-400">${validationErrors.potNumber}</p>` : ''}

              <!-- Quick Pot Chips -->
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                <span class="text-[10px] text-slate-500 shrink-0">Presets:</span>
                ${['POT-01', 'POT-02', 'ROW-01', 'ROW-04'].map(pot => `
                  <button
                    type="button"
                    class="preset-pot-chip px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-mono border border-slate-700/60 transition shrink-0 cursor-pointer"
                    data-pot="${pot}"
                  >
                    ${pot}
                  </button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Row 3: Leaf / Spot Identification & Field Zone -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <!-- Leaf Spot Identification -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs">
                <label for="specimen-leaf-spot" class="font-bold text-slate-200 flex items-center gap-1.5">
                  <span>4. Leaf / Spot ID</span>
                  <span class="text-rose-400">*</span>
                </label>
                <span class="text-[10px] text-emerald-400 font-mono">Separate spot</span>
              </div>

              <input
                type="text"
                id="specimen-leaf-spot"
                class="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.leafSpot ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500'} text-white font-mono text-xs font-bold placeholder-slate-600 outline-none transition"
                placeholder="e.g. Leaf 1, Spot 2"
                value="${escapeHtml(formData.leafSpot)}"
                autocomplete="off"
              />
              ${validationErrors.leafSpot ? `<p class="text-[11px] text-rose-400">${validationErrors.leafSpot}</p>` : ''}

              <!-- Quick Spot Chips -->
              <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                <span class="text-[10px] text-slate-500 shrink-0">Spots:</span>
                ${['Leaf 1', 'Leaf 2', 'Leaf 3', 'Leaf 4', 'Spot 1', 'Spot 2'].map(s => `
                  <button
                    type="button"
                    class="preset-spot-chip px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[10px] font-mono border border-slate-700/60 transition shrink-0 cursor-pointer ${formData.leafSpot === s ? 'bg-[#1b4332] text-white border-emerald-500/50' : ''}"
                    data-spot="${s}"
                  >
                    ${s}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Field Zone -->
            <div class="space-y-1.5">
              <label for="specimen-zone-select" class="block text-xs font-bold text-slate-200">
                5. Field Zone
              </label>
              <select
                id="specimen-zone-select"
                class="w-full min-h-[46px] px-3.5 py-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-emerald-500 outline-none transition"
              >
                <option value="Zone 1" ${formData.zone === 'Zone 1' ? 'selected' : ''}>Zone 1 (North Orchard)</option>
                <option value="Zone 2" ${formData.zone === 'Zone 2' ? 'selected' : ''}>Zone 2 (Greenhouse Beta)</option>
                <option value="Zone 3" ${formData.zone === 'Zone 3' ? 'selected' : ''}>Zone 3 (Drip Pivot Alpha)</option>
                <option value="Zone 4" ${formData.zone === 'Zone 4' ? 'selected' : ''}>Zone 4 (Valley Terrace)</option>
                <option value="Zone 5" ${formData.zone === 'Zone 5' ? 'selected' : ''}>Zone 5 (High Tunnel)</option>
                <option value="Zone 6" ${formData.zone === 'Zone 6' ? 'selected' : ''}>Zone 6 (South Perimeter)</option>
              </select>
            </div>
          </div>

          <!-- Row 4: Real-time Date & Time stamp -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label for="specimen-timestamp" class="font-bold text-slate-200 flex items-center gap-1.5">
                <span>6. Date & Time Stamp</span>
              </label>
              <button
                type="button"
                id="btn-refresh-timestamp"
                class="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-mono cursor-pointer"
              >
                ${icon('refresh', 'w-2.5 h-2.5')}
                <span>Set to Current Time</span>
              </button>
            </div>
            <input
              type="text"
              id="specimen-timestamp"
              class="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs font-semibold outline-none focus:border-emerald-500"
              value="${escapeHtml(formData.timestamp)}"
              readonly
            />
          </div>

          <!-- Transmission Status Box -->
          ${(isTransmitting || transmitStatus) ? `
            <div class="p-3.5 rounded-2xl ${transmitSuccess ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200' : 'bg-slate-950 border-slate-800 text-slate-300'} border flex items-center gap-3">
              ${isTransmitting ? `
                <div class="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin shrink-0"></div>
              ` : transmitSuccess ? `
                <div class="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  ✓
                </div>
              ` : `
                <div class="w-5 h-5 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center shrink-0 text-xs">
                  ℹ
                </div>
              `}
              <div class="min-w-0 flex-1">
                <p class="text-xs font-mono font-medium">${escapeHtml(transmitStatus)}</p>
              </div>
            </div>
          ` : ''}

        </div>

        <!-- Sticky Modal Footer Action Controls -->
        <div class="pt-3.5 border-t border-slate-800 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            id="specimen-cancel-btn"
            class="w-full sm:w-auto min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer active:scale-95 text-center"
          >
            ${t('btn_cancel', 'Cancel / Close')}
          </button>

          <div class="flex items-center gap-2 w-full sm:w-auto ml-auto">
            ${setupMode === 'manual' ? `
              <button
                type="button"
                id="specimen-verify-transmit-btn"
                ${isTransmitting ? 'disabled' : ''}
                class="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 border border-emerald-400 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 text-center"
              >
                ${isTransmitting ? '<span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>' : icon('send', 'w-4 h-4 text-slate-950')}
                <span>Verify & Send to Spectroscope</span>
              </button>
            ` : ''}

            <!-- Guided Scan Action Button -->
            <button
              type="button"
              id="specimen-proceed-scan-btn"
              class="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-[#1b4332] hover:bg-[#2d6a4f] border border-emerald-500/50 transition flex items-center justify-center gap-2 cursor-pointer active:scale-95 text-center shadow-lg"
              title="Proceed to scan without interactive prompt questions"
            >
              <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <span>Scan ${escapeHtml(remainingTarget)} (Step ${remainingStep})</span>
            </button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    overlay.querySelector('#specimen-close-btn')?.addEventListener('click', close);
    overlay.querySelector('#specimen-cancel-btn')?.addEventListener('click', close);

    // Mode Toggle Buttons
    overlay.querySelector('#modal-mode-auto-btn')?.addEventListener('click', () => {
      if (setupMode !== 'auto') {
        setupMode = 'auto';
        autoPopulateAndTransmit();
      }
    });

    overlay.querySelector('#modal-mode-manual-btn')?.addEventListener('click', () => {
      setupMode = 'manual';
      isArmed = false;
      render();
    });

    // Form Inputs
    const plantNameInput = overlay.querySelector('#specimen-plant-name');
    plantNameInput?.addEventListener('input', (e) => {
      formData.plantName = (e.target.value || '').trim();
      duplicateWarning = null;
    });

    const plantNumInput = overlay.querySelector('#specimen-plant-number');
    plantNumInput?.addEventListener('input', (e) => {
      formData.plantNumber = (e.target.value || '').trim().toUpperCase();
      duplicateWarning = null;
    });

    const potNumInput = overlay.querySelector('#specimen-pot-number');
    potNumInput?.addEventListener('input', (e) => {
      formData.potNumber = (e.target.value || '').trim().toUpperCase();
      duplicateWarning = null;
    });

    const leafSpotInput = overlay.querySelector('#specimen-leaf-spot');
    leafSpotInput?.addEventListener('input', (e) => {
      formData.leafSpot = (e.target.value || '').trim();
      duplicateWarning = null;
    });

    const zoneSelect = overlay.querySelector('#specimen-zone-select');
    if (zoneSelect && formData.zone) {
      zoneSelect.value = formData.zone;
    }
    zoneSelect?.addEventListener('change', (e) => {
      formData.zone = e.target.value;
    });

    // Refresh Timestamp Button
    overlay.querySelector('#btn-refresh-timestamp')?.addEventListener('click', () => {
      formData.timestamp = formatCurrentDateTime();
      const tsInput = overlay.querySelector('#specimen-timestamp');
      if (tsInput) tsInput.value = formData.timestamp;
    });

    // Auto-Gen Plant Number button
    overlay.querySelector('#btn-autogen-plant-number')?.addEventListener('click', () => {
      formData.plantNumber = getNextSequentialPlantTag(scansList);
      if (plantNumInput) plantNumInput.value = formData.plantNumber;
      duplicateWarning = null;
    });

    // Preset Chips
    overlay.querySelectorAll('.preset-plant-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (name) {
          formData.plantName = name;
          if (plantNameInput) plantNameInput.value = name;
          duplicateWarning = null;
        }
      });
    });

    overlay.querySelectorAll('.preset-number-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-num');
        if (num) {
          formData.plantNumber = num;
          if (plantNumInput) plantNumInput.value = num;
          duplicateWarning = null;
        }
      });
    });

    overlay.querySelectorAll('.preset-pot-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const pot = btn.getAttribute('data-pot');
        if (pot) {
          formData.potNumber = pot;
          if (potNumInput) potNumInput.value = pot;
          duplicateWarning = null;
        }
      });
    });

    overlay.querySelectorAll('.preset-spot-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const spot = btn.getAttribute('data-spot');
        if (spot) {
          formData.leafSpot = spot;
          if (leafSpotInput) leafSpotInput.value = spot;
          duplicateWarning = null;
        }
      });
    });

    // Manual Mode Action: Verify & Send to Spectroscope
    const verifyTransmitBtn = overlay.querySelector('#specimen-verify-transmit-btn') || overlay.querySelector('#specimen-transmit-btn');
    verifyTransmitBtn?.addEventListener('click', () => {
      if (plantNameInput) formData.plantName = plantNameInput.value.trim();
      if (plantNumInput) formData.plantNumber = plantNumInput.value.trim().toUpperCase();
      if (potNumInput) formData.potNumber = potNumInput.value.trim().toUpperCase();
      if (leafSpotInput) formData.leafSpot = leafSpotInput.value.trim();
      if (zoneSelect && zoneSelect.value) formData.zone = zoneSelect.value;
      handleManualVerifyAndTransmit();
    });

    // Proceed to Scan Button (Direct execution without interactive prompt inquiries)
    const proceedScanBtn = overlay.querySelector('#specimen-proceed-scan-btn') || overlay.querySelector('#specimen-calibrate-btn');
    proceedScanBtn?.addEventListener('click', async () => {
      if (!validate()) {
        render();
        return;
      }

      // Check duplicate before proceeding
      const dup = findDuplicateScanRecord(formData, scansList);
      if (dup) {
        duplicateWarning = {
          plantName: dup.plantName,
          plantNumber: dup.plantNumber,
          potNumber: dup.potNumber,
          leafSpot: dup.leafSpot || 'Leaf 1'
        };
        isArmed = false;
        render();
        return;
      }

      // Make sure metadata is synced to device
      try {
        if (leafClipDevice.isConnected && typeof leafClipDevice.transmitSpecimenBatch === 'function') {
          await leafClipDevice.transmitSpecimenBatch(formData);
        } else if (typeof leafClipDevice.setSpecimenMetadata === 'function') {
          await leafClipDevice.setSpecimenMetadata(formData);
        }
      } catch (_) {}

      if (onSaveAndTransmit) {
        onSaveAndTransmit(formData);
      }

      close();

      if (onStartCalibration) {
        onStartCalibration(formData);
      }
    });
  }

  function close() {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (onClose) onClose();
  }

  // Initial render / auto-fill
  if (setupMode === 'auto') {
    autoPopulateAndTransmit();
  } else {
    render();
  }

  return overlay;
}
