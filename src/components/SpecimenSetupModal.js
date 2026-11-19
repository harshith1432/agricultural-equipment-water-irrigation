/**
 * Spectroscope Specimen & Field Setup Modal (SpecimenSetupModal.js)
 * Tactile High-Contrast Mobile Pop-Up Window / Dialog
 * 
 * Allows agronomists and field operators to enter all plant & specimen metadata
 * at once (Plant Name, Plant Number, Pot/Row Number, Variety, Zone) and transmit
 * them in a single batch to the physical spectroscope sensor.
 */

import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { t } from '../utils/i18n.js';
import { icon } from '../utils/icons.js';
import { sanitizeText, escapeHtml } from '../utils/sanitizer.js';

export function createSpecimenSetupModal({
  onSaveAndTransmit,
  onStartCalibration,
  onClose,
  initialData = {},
  hardwarePrompt = null
} = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'specimen-data-modal';
  overlay.className = "fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn select-none overflow-y-auto";

  let isTransmitting = false;
  let transmitStatus = '';
  let transmitSuccess = false;

  const formData = {
    plantName: initialData.plantName || initialData.cropVariety || leafClipDevice.specimenMetadata?.plantName || 'Roma Tomato',
    plantNumber: initialData.plantNumber || leafClipDevice.specimenMetadata?.plantNumber || 'PLANT-101',
    potNumber: initialData.potNumber || leafClipDevice.specimenMetadata?.potNumber || 'POT-01',
    cropVariety: initialData.cropVariety || leafClipDevice.specimenMetadata?.cropVariety || 'Roma Tomato',
    zone: initialData.zone || leafClipDevice.specimenMetadata?.zone || 'Zone 1'
  };

  const validationErrors = {
    plantName: '',
    plantNumber: '',
    potNumber: ''
  };

  function validate() {
    let valid = true;
    validationErrors.plantName = '';
    validationErrors.plantNumber = '';
    validationErrors.potNumber = '';

    formData.plantName = sanitizeText(formData.plantName || '').trim().slice(0, 64);
    formData.plantNumber = sanitizeText(formData.plantNumber || '').trim().toUpperCase().slice(0, 32);
    formData.potNumber = sanitizeText(formData.potNumber || '').trim().toUpperCase().slice(0, 32);

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
    return valid;
  }

  function render() {
    const isConn = leafClipDevice.isConnected;
    const modelName = isConn ? (leafClipDevice.deviceInfo?.model || 'BlueNRG_Chat') : 'Disconnected';

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
          <div class="mt-3 p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-200">
            <span class="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping shrink-0"></span>
            <div class="min-w-0 flex-1">
              <span class="font-bold uppercase tracking-wider text-[10px] text-amber-400">Sensor Prompt Detected:</span>
              <p class="font-mono text-white text-[11px] truncate mt-0.5">${escapeHtml(hardwarePrompt)}</p>
            </div>
          </div>
        ` : ''}

        <!-- Scrollable Form Body -->
        <div class="py-4 space-y-4 overflow-y-auto no-scrollbar flex-1 pr-1">

          <!-- Field 1: Plant Name -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label for="specimen-plant-name" class="font-bold text-slate-200 flex items-center gap-1.5">
                <span>1. ${t('specimen_label_plant_name', 'Plant Name')}</span>
                <span class="text-rose-400">*</span>
              </label>
              <span class="text-[10px] text-slate-400 font-mono">e.g. Cotton, Roma Tomato, Potato</span>
            </div>
            
            <input
              type="text"
              id="specimen-plant-name"
              class="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.plantName ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'} text-white text-sm font-semibold placeholder-slate-600 outline-none transition"
              placeholder="e.g. Cotton, Roma Tomato, Potato, Bell Pepper"
              autocomplete="off"
            />
            ${validationErrors.plantName ? `<p class="text-[11px] text-rose-400">${validationErrors.plantName}</p>` : ''}

            <!-- Quick Plant Name Preset Chips -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span class="text-[10px] text-slate-500 shrink-0">Quick presets:</span>
              ${['Cotton', 'Roma Tomato', 'Potato', 'Bell Pepper', 'Wheat', 'Sugarcane'].map(p => `
                <button
                  type="button"
                  class="preset-plant-chip px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[11px] font-medium border border-slate-700/60 transition shrink-0 cursor-pointer"
                  data-name="${p}"
                >
                  ${p}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Field 2: Plant Number -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label for="specimen-plant-number" class="font-bold text-slate-200 flex items-center gap-1.5">
                <span>2. ${t('specimen_label_plant_number', 'Plant Number')}</span>
                <span class="text-rose-400">*</span>
              </label>
              <span class="text-[10px] text-slate-400 font-mono">e.g. PLANT-101, PLANT-042</span>
            </div>

            <div class="relative">
              <input
                type="text"
                id="specimen-plant-number"
                class="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.plantNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'} text-white font-mono text-sm font-bold uppercase placeholder-slate-600 outline-none transition"
                placeholder="PLANT-101"
                autocomplete="off"
              />
              <button
                type="button"
                id="btn-autogen-plant-number"
                class="absolute right-2 top-2 bottom-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-mono font-bold transition flex items-center gap-1 cursor-pointer"
                title="Generate fresh ID"
              >
                ${icon('refresh', 'w-3 h-3')}
                <span>Gen</span>
              </button>
            </div>
            ${validationErrors.plantNumber ? `<p class="text-[11px] text-rose-400">${validationErrors.plantNumber}</p>` : ''}

            <!-- Quick Number Chips -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span class="text-[10px] text-slate-500 shrink-0">Samples:</span>
              ${['PLANT-101', 'PLANT-042', 'PLANT-001', 'PLANT-204'].map(num => `
                <button
                  type="button"
                  class="preset-number-chip px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[11px] font-mono border border-slate-700/60 transition shrink-0 cursor-pointer"
                  data-num="${num}"
                >
                  ${num}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Field 3: Pot / Row Number -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between text-xs">
              <label for="specimen-pot-number" class="font-bold text-slate-200 flex items-center gap-1.5">
                <span>3. ${t('specimen_label_pot_number', 'Pot / Row Number')}</span>
                <span class="text-rose-400">*</span>
              </label>
              <span class="text-[10px] text-slate-400 font-mono">e.g. POT-01, ROW-04, PLOT-A</span>
            </div>

            <input
              type="text"
              id="specimen-pot-number"
              class="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-slate-950 border ${validationErrors.potNumber ? 'border-rose-500 ring-1 ring-rose-500' : 'border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'} text-white font-mono text-sm font-bold uppercase placeholder-slate-600 outline-none transition"
              placeholder="POT-01"
              autocomplete="off"
            />
            ${validationErrors.potNumber ? `<p class="text-[11px] text-rose-400">${validationErrors.potNumber}</p>` : ''}

            <!-- Quick Pot Chips -->
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span class="text-[10px] text-slate-500 shrink-0">Presets:</span>
              ${['POT-01', 'POT-02', 'ROW-01', 'ROW-04', 'PLOT-A', 'GREENHOUSE-1'].map(pot => `
                <button
                  type="button"
                  class="preset-pot-chip px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-[11px] font-mono border border-slate-700/60 transition shrink-0 cursor-pointer"
                  data-pot="${pot}"
                >
                  ${pot}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Field 4: Crop Variety & Field Zone -->
          <div class="space-y-2 pt-1">
            <label class="block text-xs font-bold text-slate-200">
              4. ${t('specimen_label_zone_variety', 'Crop Variety & Field Zone')}
            </label>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <!-- Field Zone Dropdown -->
              <div>
                <label for="specimen-zone-select" class="block text-[11px] text-slate-400 mb-1">Field Zone</label>
                <select
                  id="specimen-zone-select"
                  class="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-emerald-500 outline-none transition"
                >
                  <option value="Zone 1" ${formData.zone === 'Zone 1' ? 'selected' : ''}>Zone 1 (North Orchard)</option>
                  <option value="Zone 2" ${formData.zone === 'Zone 2' ? 'selected' : ''}>Zone 2 (Greenhouse Beta)</option>
                  <option value="Zone 3" ${formData.zone === 'Zone 3' ? 'selected' : ''}>Zone 3 (Drip Pivot Alpha)</option>
                  <option value="Zone 4" ${formData.zone === 'Zone 4' ? 'selected' : ''}>Zone 4 (Valley Terrace)</option>
                  <option value="Zone 5" ${formData.zone === 'Zone 5' ? 'selected' : ''}>Zone 5 (High Tunnel)</option>
                  <option value="Zone 6" ${formData.zone === 'Zone 6' ? 'selected' : ''}>Zone 6 (South Perimeter)</option>
                </select>
              </div>

              <!-- Crop Variety Input -->
              <div>
                <label for="specimen-crop-variety" class="block text-[11px] text-slate-400 mb-1">Variety Tag</label>
                <input
                  type="text"
                  id="specimen-crop-variety"
                  class="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-xs font-semibold focus:border-emerald-500 outline-none transition"
                  placeholder="e.g. Roma Tomato, BT-2 Cotton"
                  value="${escapeHtml(formData.cropVariety)}"
                />
              </div>
            </div>
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
            <button
              type="button"
              id="specimen-calibrate-btn"
              class="flex-1 sm:flex-initial min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-emerald-300 bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-600/40 transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-center"
              title="Save data and proceed to step-by-step calibration"
            >
              ${icon('sliders', 'w-4 h-4')}
              <span>${t('specimen_btn_guided_calib', 'Start Guided Calibration')}</span>
            </button>

            <button
              type="button"
              id="specimen-transmit-btn"
              ${isTransmitting ? 'disabled' : ''}
              class="flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 border border-emerald-400 transition shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 text-center"
            >
              ${isTransmitting ? '<span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>' : icon('send', 'w-4 h-4 text-slate-950')}
              <span>${t('specimen_btn_save_transmit', 'Save & Transmit to Sensor')}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    const nameIn = overlay.querySelector('#specimen-plant-name');
    if (nameIn && formData.plantName) nameIn.value = formData.plantName;
    const numIn = overlay.querySelector('#specimen-plant-number');
    if (numIn && formData.plantNumber) numIn.value = formData.plantNumber;
    const potIn = overlay.querySelector('#specimen-pot-number');
    if (potIn && formData.potNumber) potIn.value = formData.potNumber;

    attachEvents();
  }

  function attachEvents() {
    overlay.querySelector('#specimen-close-btn')?.addEventListener('click', close);
    overlay.querySelector('#specimen-cancel-btn')?.addEventListener('click', close);

    // Form Inputs
    const plantNameInput = overlay.querySelector('#specimen-plant-name');
    if (plantNameInput && formData.plantName) {
      plantNameInput.value = formData.plantName;
    }
    plantNameInput?.addEventListener('input', (e) => {
      formData.plantName = (e.target.value || '').trim();
    });

    const plantNumInput = overlay.querySelector('#specimen-plant-number');
    if (plantNumInput && formData.plantNumber) {
      plantNumInput.value = formData.plantNumber;
    }
    plantNumInput?.addEventListener('input', (e) => {
      formData.plantNumber = (e.target.value || '').trim().toUpperCase();
    });

    const potNumInput = overlay.querySelector('#specimen-pot-number');
    if (potNumInput && formData.potNumber) {
      potNumInput.value = formData.potNumber;
    }
    potNumInput?.addEventListener('input', (e) => {
      formData.potNumber = (e.target.value || '').trim().toUpperCase();
    });

    const zoneSelect = overlay.querySelector('#specimen-zone-select');
    if (zoneSelect && formData.zone) {
      zoneSelect.value = formData.zone;
    }
    zoneSelect?.addEventListener('change', (e) => {
      formData.zone = e.target.value;
    });

    const cropVarietyInput = overlay.querySelector('#specimen-crop-variety');
    if (cropVarietyInput && formData.cropVariety) {
      cropVarietyInput.value = formData.cropVariety;
    }
    cropVarietyInput?.addEventListener('input', (e) => {
      formData.cropVariety = (e.target.value || '').trim();
    });

    // Auto-Gen Plant Number button
    overlay.querySelector('#btn-autogen-plant-number')?.addEventListener('click', () => {
      const randNum = String(Math.floor(Math.random() * 900) + 100);
      formData.plantNumber = `PLANT-${randNum}`;
      if (plantNumInput) plantNumInput.value = formData.plantNumber;
    });

    // Preset Chips
    overlay.querySelectorAll('.preset-plant-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name');
        if (name) {
          formData.plantName = name;
          formData.cropVariety = name;
          if (plantNameInput) plantNameInput.value = name;
          if (cropVarietyInput) cropVarietyInput.value = name;
        }
      });
    });

    overlay.querySelectorAll('.preset-number-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const num = btn.getAttribute('data-num');
        if (num) {
          formData.plantNumber = num;
          if (plantNumInput) plantNumInput.value = num;
        }
      });
    });

    overlay.querySelectorAll('.preset-pot-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const pot = btn.getAttribute('data-pot');
        if (pot) {
          formData.potNumber = pot;
          if (potNumInput) potNumInput.value = pot;
        }
      });
    });

    // Primary Action: Save & Transmit to Sensor All at Once
    overlay.querySelector('#specimen-transmit-btn')?.addEventListener('click', async () => {
      // Sync latest values from inputs
      if (plantNameInput && typeof plantNameInput.value === 'string') formData.plantName = plantNameInput.value.trim();
      if (plantNumInput && typeof plantNumInput.value === 'string') formData.plantNumber = plantNumInput.value.trim().toUpperCase();
      if (potNumInput && typeof potNumInput.value === 'string') formData.potNumber = potNumInput.value.trim().toUpperCase();
      if (cropVarietyInput && typeof cropVarietyInput.value === 'string') formData.cropVariety = cropVarietyInput.value.trim();
      if (zoneSelect && typeof zoneSelect.value === 'string') formData.zone = zoneSelect.value;

      if (!validate()) {
        render();
        return;
      }

      isTransmitting = true;
      transmitSuccess = false;
      transmitStatus = 'Transmitting specimen data batch to spectroscope sensor...';
      render();

      try {
        if (typeof leafClipDevice.transmitSpecimenBatch === 'function') {
          await leafClipDevice.transmitSpecimenBatch({
            plantName: formData.plantName,
            plantNumber: formData.plantNumber,
            potNumber: formData.potNumber,
            cropVariety: formData.cropVariety || formData.plantName,
            zone: formData.zone
          });
        }

        transmitSuccess = true;
        transmitStatus = `Transmitted successfully! Plant: ${formData.plantName} | #${formData.plantNumber} | ${formData.potNumber} sent to sensor.`;
        isTransmitting = false;
        render();

        if (onSaveAndTransmit) {
          onSaveAndTransmit(formData);
        }

        // Auto close after brief success confirmation
        setTimeout(() => {
          close();
        }, 1200);
      } catch (err) {
        isTransmitting = false;
        transmitSuccess = false;
        transmitStatus = `Transmission error: ${err.message || err}`;
        render();
      }
    });

    // Secondary Action: Start Guided Calibration
    overlay.querySelector('#specimen-calibrate-btn')?.addEventListener('click', async () => {
      if (plantNameInput && plantNameInput.value) formData.plantName = plantNameInput.value.trim();
      if (plantNumInput && plantNumInput.value) formData.plantNumber = plantNumInput.value.trim().toUpperCase();
      if (potNumInput && potNumInput.value) formData.potNumber = potNumInput.value.trim().toUpperCase();
      if (cropVarietyInput && cropVarietyInput.value) formData.cropVariety = cropVarietyInput.value.trim();
      if (zoneSelect && zoneSelect.value) formData.zone = zoneSelect.value;

      if (!validate()) {
        render();
        return;
      }

      // Transmit to device first if connected
      if (leafClipDevice.isConnected && typeof leafClipDevice.transmitSpecimenBatch === 'function') {
        try {
          await leafClipDevice.transmitSpecimenBatch(formData);
        } catch (e) {}
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

  render();
  return overlay;
}
