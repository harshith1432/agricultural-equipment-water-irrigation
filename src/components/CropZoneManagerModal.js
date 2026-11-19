/**
 * AgriSpectra Flow & Field - Real-Time Crop & Field Zone Manager Modal
 * Component: CropZoneManagerModal.js
 * 
 * Provides farmers with full real-time database management for:
 *   1. Field Zones (ಫೀಲ್ಡ್ ವಲಯಗಳು / खेत के क्षेत्र):
 *      - Real-time Firestore sync of all active plots/zones.
 *      - "+ Add New Zone" form with crop selection from real-time catalog, soil type,
 *        target VWC range, and solenoid valve gate assignment (G1–G8).
 *      - "Edit Zone" with pre-filled telemetry/agronomic data.
 *      - "Delete Zone" with confirmation alert and auto-fallback to safe zone.
 *   2. Crop Catalog (ಬೆಳೆಗಳ ಪಟ್ಟಿ / फसल सूची):
 *      - Real-time catalog of all crop types (pre-seeded 11+ and farmer-defined custom crops).
 *      - Displays scientific names, optimal moisture range (VWC%), target pH, and nitrogen.
 *      - "+ Add Custom Crop" to define new crops (Turmeric, Millets, Ginger, Coffee, etc.).
 *      - Real-time edit and delete of crop types in Cloud Firestore / local database.
 */

import { firestoreService, FARM_ID } from '../firebase/firestoreService.js';
import { INITIAL_FARM_DATA, PRESEEDED_CROPS } from '../firebase/mockFirestore.js';
import { icon } from '../utils/icons.js';
import { t, onLocaleChange } from '../utils/i18n.js';

function stripLeadingPlus(text) {
  if (!text) return '';
  return String(text).replace(/^\s*\+\s*/, '');
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const DEFAULT_GROWTH_STAGES = [
  "Germination",
  "Vegetative",
  "Flowering",
  "Yield Formation",
  "Ripening"
];

const SOIL_TYPES = [
  "Clay Loam",
  "Sandy Loam",
  "Red Soil",
  "Black Cotton Soil",
  "Silty Loam",
  "Alluvial Soil"
];

const VALVE_GATES = [
  { id: 'G1', label: 'Gate 1 (G1 - Solenoid A)' },
  { id: 'G2', label: 'Gate 2 (G2 - Solenoid B)' },
  { id: 'G3', label: 'Gate 3 (G3 - Solenoid C)' },
  { id: 'G4', label: 'Gate 4 (G4 - Solenoid D)' },
  { id: 'G5', label: 'Gate 5 (G5 - Solenoid E)' },
  { id: 'G6', label: 'Gate 6 (G6 - Solenoid F)' },
  { id: 'G7', label: 'Gate 7 (G7 - Auxiliary 1)' },
  { id: 'G8', label: 'Gate 8 (G8 - Auxiliary 2)' }
];

export function createCropZoneManagerModal({
  initialTab = 'zones', // 'zones' | 'crops'
  selectedPlotId = null,
  onClose,
  onSelectPlot,
  onPlotDeleted
}) {
  const overlay = document.createElement('div');
  overlay.id = "crop-zone-manager-modal-overlay";
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/75 backdrop-blur-md overflow-y-auto animate-fadeIn select-none";

  let activeTab = initialTab; // 'zones' | 'crops'
  let subView = 'list'; // 'list' | 'add_zone' | 'edit_zone' | 'add_crop' | 'edit_crop'
  let editingZoneId = null;
  let editingCropId = null;
  let deleteConfirmTarget = null; // { type: 'zone' | 'crop', id, name, plotNumber }

  let plots = Array.isArray(INITIAL_FARM_DATA?.plots) 
    ? [...INITIAL_FARM_DATA.plots] 
    : Object.values(INITIAL_FARM_DATA?.plots || {});

  let cropCatalog = Array.isArray(PRESEEDED_CROPS)
    ? [...PRESEEDED_CROPS]
    : Object.values(PRESEEDED_CROPS || {});
  let currentSelectedPlotId = selectedPlotId || (plots[0]?.id || null);
  let toastMessage = null;
  let isSaving = false;

  // Subscriptions
  let unsubscribePlots = null;
  let unsubscribeCrops = null;

  function showToast(msg, type = 'success') {
    toastMessage = { text: msg, type };
    render();
    setTimeout(() => {
      toastMessage = null;
      render();
    }, 3500);
  }

  function setupRealtimeListeners() {
    // 1. Subscribe to plots from firestoreService
    unsubscribePlots = firestoreService.subscribePlots((updatedPlots) => {
      if (Array.isArray(updatedPlots) && updatedPlots.length > 0) {
        plots = updatedPlots;
      } else if (!plots || plots.length === 0) {
        plots = Object.values(INITIAL_FARM_DATA?.plots || {});
      }
      if (!currentSelectedPlotId && plots.length > 0) {
        currentSelectedPlotId = plots[0].id;
      }
      render();
    });

    // 2. Subscribe to crop catalog
    unsubscribeCrops = firestoreService.subscribeCropCatalog((updatedCrops) => {
      if (Array.isArray(updatedCrops) && updatedCrops.length > 0) {
        cropCatalog = updatedCrops;
      } else if (!cropCatalog || cropCatalog.length === 0) {
        cropCatalog = Object.values(PRESEEDED_CROPS || {});
      }
      render();
    });
  }

  function cleanup() {
    if (typeof unsubscribePlots === 'function') unsubscribePlots();
    if (typeof unsubscribeCrops === 'function') unsubscribeCrops();
  }

  function handleClose() {
    cleanup();
    overlay.remove();
    if (typeof onClose === 'function') onClose();
  }

  function render() {
    const activePlotsCount = plots.length;
    const activeCropsCount = cropCatalog.length;

    overlay.innerHTML = `
      <div class="relative z-50 w-full max-w-xl my-auto bg-[#F7F9F6] dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl border border-emerald-900/15 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        <!-- Header -->
        <div class="relative bg-gradient-to-r from-[#092B19] via-[#0E5431] to-[#146B40] text-white p-4 sm:p-5 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-10 h-10 rounded-2xl bg-emerald-400/20 border border-emerald-300/30 flex items-center justify-center text-emerald-300 shadow-sm">
                ${icon('sprout', 'w-5 h-5')}
              </div>
              <div>
                <h2 class="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                  <span>${t('manage_zones_and_crops', 'Manage Zones & Crops')}</span>
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">LIVE DB</span>
                </h2>
                <p class="text-[11px] text-emerald-200/80 font-medium">
                  ${t('menu_crop_zone_manager_sub', 'Real-time database plots & crop catalog')}
                </p>
              </div>
            </div>

            <button 
              type="button" 
              id="btn-cz-close" 
              class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95"
              title="${t('cancel', 'Close')}"
            >
              ${icon('x', 'w-4 h-4')}
            </button>
          </div>

          <!-- Top Tabs -->
          <div class="flex items-center gap-2 mt-4 pt-3 border-t border-emerald-600/30">
            <button 
              type="button" 
              id="tab-cz-zones"
              class="flex-1 py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                activeTab === 'zones' 
                  ? 'bg-white text-[#0E5431] shadow-md shadow-emerald-950/20' 
                  : 'bg-white/10 text-emerald-100 hover:bg-white/15'
              }"
            >
              ${icon('mapPin', 'w-3.5 h-3.5')}
              <span>${t('field_zones_tab', 'Field Zones')}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'zones' ? 'bg-emerald-100 text-[#0E5431]' : 'bg-white/20 text-white'}">
                ${activePlotsCount}
              </span>
            </button>

            <button 
              type="button" 
              id="tab-cz-crops"
              class="flex-1 py-2 px-2.5 sm:px-3 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap ${
                activeTab === 'crops' 
                  ? 'bg-white text-[#0E5431] shadow-md shadow-emerald-950/20' 
                  : 'bg-white/10 text-emerald-100 hover:bg-white/15'
              }"
            >
              ${icon('leaf', 'w-3.5 h-3.5')}
              <span>${t('crop_catalog_tab', 'Crop Catalog')}</span>
              <span class="px-1.5 py-0.2 rounded-full text-[10px] font-mono ${activeTab === 'crops' ? 'bg-emerald-100 text-[#0E5431]' : 'bg-white/20 text-white'}">
                ${activeCropsCount}
              </span>
            </button>
          </div>
        </div>

        <!-- Toast Notification Banner -->
        ${toastMessage ? `
          <div class="px-4 py-2 bg-emerald-600 text-white text-xs font-semibold flex items-center justify-between animate-fadeIn shadow-inner">
            <div class="flex items-center gap-2">
              ${icon('check', 'w-4 h-4')}
              <span>${escapeHtml(toastMessage.text)}</span>
            </div>
            <span class="text-[10px] opacity-80 uppercase tracking-widest font-mono">Real-time synced</span>
          </div>
        ` : ''}

        <!-- Scrollable Modal Body -->
        <div class="p-3.5 sm:p-5 overflow-y-auto space-y-4 flex-1">
          ${renderModalContent()}
        </div>

        <!-- Delete Confirmation Dialog -->
        ${deleteConfirmTarget ? renderDeleteConfirmOverlay() : ''}

      </div>
    `;

    bindEvents();
  }

  function renderModalContent() {
    if (activeTab === 'zones') {
      if (subView === 'add_zone') return renderZoneForm(false);
      if (subView === 'edit_zone') return renderZoneForm(true);
      return renderZonesList();
    } else {
      if (subView === 'add_crop') return renderCropForm(false);
      if (subView === 'edit_crop') return renderCropForm(true);
      return renderCropsList();
    }
  }

  // =========================================================================
  // VIEW 1: FIELD ZONES LIST
  // =========================================================================
  function renderZonesList() {
    return `
      <div class="space-y-3">
        <!-- Action Row -->
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1 pr-1.5">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 break-words leading-tight">
              ${t('field_zones_tab', 'Active Field Plots')}
            </h3>
            <p class="text-[10px] text-slate-500 break-words leading-tight mt-0.5">Real-time Cloud Firestore</p>
          </div>

          <button 
            type="button" 
            id="btn-add-zone-view" 
            aria-label="+ Add New Zone"
            class="px-3.5 py-1.5 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 whitespace-nowrap"
          >
            ${icon('plus', 'w-3.5 h-3.5')}
            <span>${stripLeadingPlus(t('add_new_zone', 'Add New Zone'))}</span>
          </button>
        </div>

        <!-- Zones List -->
        <div class="space-y-2.5">
          ${plots.length === 0 ? `
            <div class="text-center py-10 bg-white dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-6 space-y-2">
              <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#0E5431] flex items-center justify-center">
                ${icon('sprout', 'w-6 h-6')}
              </div>
              <p class="text-xs font-bold text-slate-700 dark:text-slate-300">No field zones in database</p>
              <p class="text-[11px] text-slate-500">Tap '+ Add New Zone' above to register your first farm plot.</p>
            </div>
          ` : plots.map((p) => {
            const isSelected = p.id === currentSelectedPlotId;
            const gateId = p.valve?.id || `G${p.plotNumber || 1}`;
            const isOpen = p.valve?.state === 'OPEN';
            const avgVwc = Array.isArray(p.soilSensors) && p.soilSensors.length > 0
              ? (p.soilSensors.reduce((sum, s) => sum + (s.vwc || 0), 0) / p.soilSensors.length).toFixed(1)
              : (p.targetVwcMin || 22).toFixed(1);

            return `
              <div class="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border transition shadow-sm min-w-0 overflow-hidden break-words ${
                isSelected 
                  ? 'border-[#0E5431] ring-2 ring-[#0E5431]/15' 
                  : 'border-slate-200 dark:border-slate-700 hover:border-emerald-600/30'
              }">
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                  <div class="flex items-start gap-3 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 text-[#0E5431] dark:text-emerald-300 font-bold font-mono text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                      Z${p.plotNumber || '?'}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                        <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          ${escapeHtml(p.crop || 'Crop')}
                        </h4>
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                          isOpen ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                        }">
                          ${isOpen ? 'VALVE ON' : 'VALVE IDLE'}
                        </span>
                        ${isSelected ? `
                          <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#0E5431] text-white shrink-0">
                            Active Plot
                          </span>
                        ` : ''}
                      </div>

                      <div class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                        ${escapeHtml(p.name || `Zone ${p.plotNumber}`)}
                      </div>

                      <!-- Sub-badges -->
                      <div class="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap text-[10px] min-w-0">
                        <span class="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[#0E5431] dark:text-emerald-300 font-medium border border-emerald-600/10 whitespace-nowrap">
                          Stage: ${escapeHtml(p.stage || 'Vegetative')}
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 font-mono whitespace-nowrap">
                          Target VWC: ${p.targetVwcMin || 20}%–${p.targetVwcMax || 35}%
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 font-mono shrink-0 whitespace-nowrap">
                          ${escapeHtml(gateId)}
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 whitespace-nowrap">
                          Soil: ${escapeHtml(p.soilType || 'Clay Loam')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                    ${!isSelected ? `
                      <button 
                        type="button" 
                        data-action="select-plot" 
                        data-id="${escapeHtml(p.id)}"
                        class="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:text-[#0E5431] text-[11px] font-semibold transition whitespace-nowrap active:scale-95"
                        title="Select this zone as active"
                      >
                        Select
                      </button>
                    ` : ''}

                    <button 
                      type="button" 
                      data-action="edit-zone" 
                      data-id="${escapeHtml(p.id)}"
                      class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95 shrink-0"
                      title="${t('edit_zone', 'Edit Zone')}"
                    >
                      ${icon('edit', 'w-3.5 h-3.5')}
                    </button>

                    <button 
                      type="button" 
                      data-action="delete-zone" 
                      data-id="${escapeHtml(p.id)}"
                      data-number="${escapeHtml(p.plotNumber || '')}"
                      data-crop="${escapeHtml(p.crop || 'Crop')}"
                      class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center transition active:scale-95 shrink-0"
                      title="${t('delete_zone', 'Delete Zone')}"
                    >
                      ${icon('trash', 'w-3.5 h-3.5')}
                    </button>
                  </div>
                </div>

                <!-- Live Moisture telemetry bar -->
                <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Current Soil VWC: <strong class="text-slate-800 dark:text-slate-200">${avgVwc}%</strong></span>
                  <span>Flow: <strong>${p.valve?.flowRate || 480} LPH</strong></span>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 2: ADD / EDIT ZONE FORM
  // =========================================================================
  function renderZoneForm(isEdit = false) {
    const existingPlot = isEdit ? plots.find(p => p.id === editingZoneId) : null;
    const defaultPlotNumber = isEdit ? (existingPlot?.plotNumber || 1) : (plots.length + 1);
    const initialCrop = existingPlot?.crop || (cropCatalog[0]?.name || "Potato");
    const matchedCrop = cropCatalog.find(c => c.name.toLowerCase() === initialCrop.toLowerCase()) || cropCatalog[0];

    const currentVwcMin = existingPlot?.targetVwcMin !== undefined ? existingPlot.targetVwcMin : (matchedCrop?.optimalVwcMin || 20.0);
    const currentVwcMax = existingPlot?.targetVwcMax !== undefined ? existingPlot.targetVwcMax : (matchedCrop?.optimalVwcMax || 35.0);

    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-5 border border-emerald-900/10 dark:border-slate-700 shadow-sm space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-[#0E5431] text-white flex items-center justify-center">
              ${icon(isEdit ? 'edit' : 'plus', 'w-4 h-4')}
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                ${isEdit ? `${t('edit_zone', 'Edit Zone')} ${existingPlot?.plotNumber || ''}` : t('add_new_zone', 'Add New Field Zone')}
              </h3>
              <p class="text-[10px] text-slate-500">Directly syncs to Cloud Firestore</p>
            </div>
          </div>

          <button 
            type="button" 
            id="btn-cancel-zone-form" 
            class="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold transition"
          >
            ${t('cancel', 'Cancel')}
          </button>
        </div>

        <form id="form-field-zone" class="space-y-3.5">
          <!-- Zone Name & Number -->
          <div class="grid grid-cols-3 gap-2.5">
            <div class="col-span-1 space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Zone #</label>
              <input 
                type="number" 
                id="input-zone-number" 
                value="${defaultPlotNumber}" 
                min="1" 
                max="99" 
                required 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
              />
            </div>

            <div class="col-span-2 space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('zone_name_label', 'Zone Name')}</label>
              <input 
                type="text" 
                id="input-zone-name" 
                value="${escapeHtml(existingPlot?.name || `Zone ${defaultPlotNumber} - ${initialCrop}`)}" 
                placeholder="e.g. Zone 7 - Sugarcane Field" 
                required 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
              />
            </div>
          </div>

          <!-- Crop Type (Populated from real-time Crop Catalog) -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('crop_type_label', 'Crop Type')}</label>
              <button 
                type="button" 
                id="btn-quick-new-crop" 
                class="text-[10px] text-[#0E5431] dark:text-emerald-400 hover:underline font-bold"
              >
                + Add New Crop to Catalog
              </button>
            </div>
            <select 
              id="select-zone-crop" 
              class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E5431] cursor-pointer"
            >
              ${cropCatalog.map(c => `
                <option 
                  value="${escapeHtml(c.name)}" 
                  data-min="${c.optimalVwcMin || 20}" 
                  data-max="${c.optimalVwcMax || 35}"
                  ${c.name.toLowerCase() === initialCrop.toLowerCase() ? 'selected' : ''}
                >
                  ${escapeHtml(c.name)} (${escapeHtml(c.scientificName || '')})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Growth Stage & Soil Type -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('growth_stage_label', 'Growth Stage')}</label>
              <select 
                id="select-zone-stage" 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E5431] cursor-pointer"
              >
                ${DEFAULT_GROWTH_STAGES.map(st => `
                  <option value="${st}" ${(existingPlot?.stage || 'Vegetative') === st ? 'selected' : ''}>
                    ${st}
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('soil_type_label', 'Soil Type')}</label>
              <select 
                id="select-zone-soil" 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E5431] cursor-pointer"
              >
                ${SOIL_TYPES.map(soil => `
                  <option value="${soil}" ${(existingPlot?.soilType || 'Clay Loam') === soil ? 'selected' : ''}>
                    ${soil}
                  </option>
                `).join('')}
              </select>
            </div>
          </div>

          <!-- Target VWC Range (%) -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('target_vwc_label', 'Target Root-Zone VWC Range (%)')}</label>
              <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono" id="label-vwc-preview">
                Min ${currentVwcMin}% - Max ${currentVwcMax}%
              </span>
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <span class="text-[10px] text-slate-500">Min Moisture %</span>
                <input 
                  type="number" 
                  id="input-vwc-min" 
                  value="${currentVwcMin}" 
                  min="5" 
                  max="60" 
                  step="0.5" 
                  required 
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
                />
              </div>
              <div>
                <span class="text-[10px] text-slate-500">Max Moisture %</span>
                <input 
                  type="number" 
                  id="input-vwc-max" 
                  value="${currentVwcMax}" 
                  min="10" 
                  max="80" 
                  step="0.5" 
                  required 
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
                />
              </div>
            </div>
          </div>

          <!-- Solenoid Valve Gate Assignment -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('valve_gate_label', 'Solenoid Valve Gate Assignment')}</label>
            <select 
              id="select-valve-gate" 
              class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E5431] cursor-pointer"
            >
              ${VALVE_GATES.map(g => {
                const assignedGate = existingPlot?.valve?.id || `G${defaultPlotNumber}`;
                return `
                  <option value="${g.id}" ${assignedGate === g.id ? 'selected' : ''}>
                    ${g.label}
                  </option>
                `;
              }).join('')}
            </select>
          </div>

          <!-- Buttons -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button 
              type="button" 
              id="btn-cancel-zone-bottom"
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            >
              ${t('cancel', 'Cancel')}
            </button>
            <button 
              type="submit" 
              id="btn-save-zone"
              ${isSaving ? 'disabled' : ''}
              class="px-5 py-2 rounded-xl bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              ${icon('check', 'w-4 h-4')}
              <span>${isSaving ? 'Saving to Database...' : t('save_changes', 'Save Field Zone')}</span>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 3: CROP CATALOG LIST
  // =========================================================================
  function renderCropsList() {
    return `
      <div class="space-y-3">
        <!-- Action Row -->
        <div class="flex items-center justify-between gap-2">
          <div class="min-w-0 flex-1 pr-1.5">
            <h3 class="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 break-words leading-tight">
              ${t('crop_catalog_tab', 'Crop Catalog (Agronomic Specs)')}
            </h3>
            <p class="text-[10px] text-slate-500 break-words leading-tight mt-0.5">Pre-seeded Indian & Global Varieties</p>
          </div>

          <button 
            type="button" 
            id="btn-add-crop-view" 
            aria-label="+ Add Custom Crop"
            class="px-3.5 py-1.5 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0 whitespace-nowrap"
          >
            ${icon('plus', 'w-3.5 h-3.5')}
            <span>${stripLeadingPlus(t('add_custom_crop', 'Add Custom Crop'))}</span>
          </button>
        </div>

        <!-- Crops List -->
        <div class="space-y-2.5">
          ${cropCatalog.map(crop => {
            return `
              <div class="bg-white dark:bg-slate-800 rounded-2xl p-3.5 border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-600/30 transition min-w-0 overflow-hidden break-words">
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 min-w-0">
                  <div class="flex items-start gap-3 min-w-0 flex-1">
                    <div class="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 text-[#0E5431] dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      ${icon('sprout', 'w-5 h-5')}
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                        <h4 class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          ${escapeHtml(crop.name)}
                        </h4>
                        <span class="text-[10px] italic text-slate-400 truncate">
                          ${escapeHtml(crop.scientificName || '')}
                        </span>
                        <span class="px-2 py-0.5 rounded-full text-[9px] font-mono bg-emerald-50 dark:bg-emerald-950/50 text-[#0E5431] dark:text-emerald-300 border border-emerald-500/20 shrink-0">
                          ${escapeHtml(crop.category || 'Standard')}
                        </span>
                      </div>

                      <!-- Agronomic Specs Badges -->
                      <div class="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap text-[10px] min-w-0">
                        <span class="px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-mono whitespace-nowrap">
                          Optimal VWC: ${crop.optimalVwcMin || 20}%–${crop.optimalVwcMax || 35}%
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-mono whitespace-nowrap">
                          pH: ${crop.optimalPhMin || 6.0}–${crop.optimalPhMax || 7.0}
                        </span>
                        <span class="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-[#0E5431] dark:text-emerald-300 font-mono whitespace-nowrap">
                          N: ${crop.targetNitrogen || 100} kg/ha
                        </span>
                      </div>
                    </div>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-auto">
                    <button 
                      type="button" 
                      data-action="edit-crop" 
                      data-id="${escapeHtml(crop.id)}"
                      class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 flex items-center justify-center transition active:scale-95 shrink-0"
                      title="${t('edit_crop', 'Edit Crop')}"
                    >
                      ${icon('edit', 'w-3.5 h-3.5')}
                    </button>

                    <button 
                      type="button" 
                      data-action="delete-crop" 
                      data-id="${escapeHtml(crop.id)}"
                      data-name="${escapeHtml(crop.name)}"
                      class="w-8 h-8 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-300 flex items-center justify-center transition active:scale-95 shrink-0"
                      title="${t('delete_crop', 'Delete Crop')}"
                    >
                      ${icon('trash', 'w-3.5 h-3.5')}
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 4: ADD / EDIT CROP FORM
  // =========================================================================
  function renderCropForm(isEdit = false) {
    const existingCrop = isEdit ? cropCatalog.find(c => c.id === editingCropId) : null;

    return `
      <div class="bg-white dark:bg-slate-800 rounded-3xl p-4 sm:p-5 border border-emerald-900/10 dark:border-slate-700 shadow-sm space-y-4">
        <div class="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-xl bg-[#0E5431] text-white flex items-center justify-center">
              ${icon(isEdit ? 'edit' : 'plus', 'w-4 h-4')}
            </div>
            <div>
              <h3 class="text-sm font-bold text-slate-900 dark:text-white">
                ${isEdit ? `${t('edit_crop', 'Edit Crop Type')}: ${escapeHtml(existingCrop?.name || '')}` : t('add_custom_crop', 'Add Custom Crop to Catalog')}
              </h3>
              <p class="text-[10px] text-slate-500">Defines optimal hydration, pH, and nitrogen profiles</p>
            </div>
          </div>

          <button 
            type="button" 
            id="btn-cancel-crop-form" 
            class="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-white font-semibold transition"
          >
            ${t('cancel', 'Cancel')}
          </button>
        </div>

        <form id="form-crop-type" class="space-y-3.5">
          <!-- Crop Name & Scientific Name -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Crop Name</label>
              <input 
                type="text" 
                id="input-crop-name" 
                value="${escapeHtml(existingCrop?.name || '')}" 
                placeholder="e.g. Turmeric, Millets, Coffee" 
                required 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('scientific_name_label', 'Scientific Name')}</label>
              <input 
                type="text" 
                id="input-crop-scientific" 
                value="${escapeHtml(existingCrop?.scientificName || '')}" 
                placeholder="e.g. Curcuma longa" 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs italic focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
              />
            </div>
          </div>

          <!-- Optimal VWC Min & Max (%) -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('optimal_vwc_range', 'Optimal Volumetric Water Content (VWC %)')}</label>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <span class="text-[10px] text-slate-500">Min Moisture %</span>
                <input 
                  type="number" 
                  id="input-crop-vwc-min" 
                  value="${existingCrop?.optimalVwcMin !== undefined ? existingCrop.optimalVwcMin : 20.0}" 
                  min="5" 
                  max="60" 
                  step="0.5" 
                  required 
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
                />
              </div>
              <div>
                <span class="text-[10px] text-slate-500">Max Moisture %</span>
                <input 
                  type="number" 
                  id="input-crop-vwc-max" 
                  value="${existingCrop?.optimalVwcMax !== undefined ? existingCrop.optimalVwcMax : 35.0}" 
                  min="10" 
                  max="80" 
                  step="0.5" 
                  required 
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
                />
              </div>
            </div>
          </div>

          <!-- Optimal pH Min & Max -->
          <div class="space-y-1">
            <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('optimal_ph_range', 'Optimal Soil pH Range')}</label>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <span class="text-[10px] text-slate-500">Min pH</span>
                <input 
                  type="number" 
                  id="input-crop-ph-min" 
                  value="${existingCrop?.optimalPhMin !== undefined ? existingCrop.optimalPhMin : 6.0}" 
                  min="3.0" 
                  max="10.0" 
                  step="0.1" 
                  required 
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
                />
              </div>
              <div>
                <span class="text-[10px] text-slate-500">Max pH</span>
                <input 
                  type="number" 
                  id="input-crop-ph-max" 
                  value="${existingCrop?.optimalPhMax !== undefined ? existingCrop.optimalPhMax : 7.0}" 
                  min="3.0" 
                  max="10.0" 
                  step="0.1" 
                  required 
                  class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
                />
              </div>
            </div>
          </div>

          <!-- Target Nitrogen & Category -->
          <div class="grid grid-cols-2 gap-2.5">
            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">${t('target_nitrogen_label', 'Target Nitrogen (kg/ha)')}</label>
              <input 
                type="number" 
                id="input-crop-nitrogen" 
                value="${existingCrop?.targetNitrogen !== undefined ? existingCrop.targetNitrogen : 100}" 
                min="0" 
                max="500" 
                required 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
              />
            </div>

            <div class="space-y-1">
              <label class="text-[11px] font-bold text-slate-700 dark:text-slate-300">Agronomic Category</label>
              <input 
                type="text" 
                id="input-crop-category" 
                value="${escapeHtml(existingCrop?.category || 'Field Crop')}" 
                placeholder="e.g. Spices, Millets, Cash Crop" 
                class="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#0E5431]"
              />
            </div>
          </div>

          <!-- Buttons -->
          <div class="pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end gap-2">
            <button 
              type="button" 
              id="btn-cancel-crop-bottom"
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition"
            >
              ${t('cancel', 'Cancel')}
            </button>
            <button 
              type="submit" 
              id="btn-save-crop"
              ${isSaving ? 'disabled' : ''}
              class="px-5 py-2 rounded-xl bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              ${icon('check', 'w-4 h-4')}
              <span>${isSaving ? 'Saving...' : t('save_changes', 'Save Crop Type')}</span>
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 5: DELETE CONFIRMATION DIALOG
  // =========================================================================
  function renderDeleteConfirmOverlay() {
    if (!deleteConfirmTarget) return '';

    const isZone = deleteConfirmTarget.type === 'zone';
    const title = isZone 
      ? `Delete Zone ${deleteConfirmTarget.plotNumber}?` 
      : `Delete Crop: ${deleteConfirmTarget.name}?`;

    const message = isZone
      ? `Are you sure you want to delete Zone ${deleteConfirmTarget.plotNumber}: ${deleteConfirmTarget.crop}? This will remove this zone from the database and telemetry streams.`
      : `Are you sure you want to delete ${deleteConfirmTarget.name} from the crop catalog?`;

    return `
      <div class="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-30 flex items-center justify-center p-4 animate-fadeIn">
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-rose-500/30 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <div class="w-12 h-12 mx-auto rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center border border-rose-500/20">
            ${icon('trash', 'w-6 h-6')}
          </div>
          <div>
            <h4 class="text-sm font-bold text-slate-900 dark:text-white">${title}</h4>
            <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">${message}</p>
          </div>
          <div class="flex items-center justify-center gap-2 pt-2">
            <button 
              type="button" 
              id="btn-cancel-delete" 
              class="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
            >
              ${t('cancel', 'Cancel')}
            </button>
            <button 
              type="button" 
              id="btn-confirm-delete" 
              class="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm active:scale-95"
            >
              ${t('delete_zone', 'Confirm Delete')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // EVENT BINDINGS
  // =========================================================================
  function bindEvents() {
    // 1. Close Button & Backdrop
    overlay.querySelector('#btn-cz-close')?.addEventListener('click', handleClose);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) handleClose();
    });

    // 2. Tab switching
    overlay.querySelector('#tab-cz-zones')?.addEventListener('click', () => {
      activeTab = 'zones';
      subView = 'list';
      render();
    });

    overlay.querySelector('#tab-cz-crops')?.addEventListener('click', () => {
      activeTab = 'crops';
      subView = 'list';
      render();
    });

    // 3. Subview Triggers (List -> Forms)
    overlay.querySelector('#btn-add-zone-view')?.addEventListener('click', () => {
      subView = 'add_zone';
      render();
    });

    overlay.querySelector('#btn-add-crop-view')?.addEventListener('click', () => {
      subView = 'add_crop';
      render();
    });

    overlay.querySelector('#btn-cancel-zone-form')?.addEventListener('click', () => {
      subView = 'list';
      render();
    });

    overlay.querySelector('#btn-cancel-zone-bottom')?.addEventListener('click', () => {
      subView = 'list';
      render();
    });

    overlay.querySelector('#btn-cancel-crop-form')?.addEventListener('click', () => {
      subView = 'list';
      render();
    });

    overlay.querySelector('#btn-cancel-crop-bottom')?.addEventListener('click', () => {
      subView = 'list';
      render();
    });

    overlay.querySelector('#btn-quick-new-crop')?.addEventListener('click', () => {
      activeTab = 'crops';
      subView = 'add_crop';
      render();
    });

    // Dynamic VWC update in Zone form when selecting crop
    const cropSelect = overlay.querySelector('#select-zone-crop');
    if (cropSelect) {
      cropSelect.addEventListener('change', (e) => {
        const opt = cropSelect.selectedOptions[0];
        if (opt) {
          const min = opt.getAttribute('data-min');
          const max = opt.getAttribute('data-max');
          const vwcMinInput = overlay.querySelector('#input-vwc-min');
          const vwcMaxInput = overlay.querySelector('#input-vwc-max');
          const vwcPreview = overlay.querySelector('#label-vwc-preview');
          if (vwcMinInput && min) vwcMinInput.value = min;
          if (vwcMaxInput && max) vwcMaxInput.value = max;
          if (vwcPreview && min && max) vwcPreview.textContent = `Min ${min}% - Max ${max}%`;

          // Also suggest zone name
          const zoneNumInput = overlay.querySelector('#input-zone-number');
          const zoneNameInput = overlay.querySelector('#input-zone-name');
          if (zoneNameInput && zoneNumInput) {
            zoneNameInput.value = `Zone ${zoneNumInput.value} - ${opt.value}`;
          }
        }
      });
    }

    // 4. Zone Item Actions (Select, Edit, Delete)
    overlay.querySelectorAll('[data-action="select-plot"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-id');
        if (plotId) {
          currentSelectedPlotId = plotId;
          if (typeof onSelectPlot === 'function') onSelectPlot(plotId);
          showToast(`Active plot switched to Zone`);
        }
      });
    });

    overlay.querySelectorAll('[data-action="edit-zone"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-id');
        if (plotId) {
          editingZoneId = plotId;
          subView = 'edit_zone';
          render();
        }
      });
    });

    overlay.querySelectorAll('[data-action="delete-zone"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-id');
        const plotNumber = btn.getAttribute('data-number');
        const crop = btn.getAttribute('data-crop');
        deleteConfirmTarget = { type: 'zone', id: plotId, plotNumber, crop };
        render();
      });
    });

    // 5. Crop Item Actions (Edit, Delete)
    overlay.querySelectorAll('[data-action="edit-crop"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cropId = btn.getAttribute('data-id');
        if (cropId) {
          editingCropId = cropId;
          subView = 'edit_crop';
          render();
        }
      });
    });

    overlay.querySelectorAll('[data-action="delete-crop"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const cropId = btn.getAttribute('data-id');
        const name = btn.getAttribute('data-name');
        deleteConfirmTarget = { type: 'crop', id: cropId, name };
        render();
      });
    });

    // 6. Delete Dialog Confirmation Handlers
    overlay.querySelector('#btn-cancel-delete')?.addEventListener('click', () => {
      deleteConfirmTarget = null;
      render();
    });

    overlay.querySelector('#btn-confirm-delete')?.addEventListener('click', async () => {
      if (!deleteConfirmTarget) return;

      if (deleteConfirmTarget.type === 'zone') {
        const targetId = deleteConfirmTarget.id;
        const targetNum = deleteConfirmTarget.plotNumber;
        try {
          await firestoreService.deletePlot(targetId);
          deleteConfirmTarget = null;
          showToast(`Zone ${targetNum} deleted from database.`);

          // Fallback if deleted plot was currently selected
          if (targetId === currentSelectedPlotId) {
            const remaining = plots.filter(p => p.id !== targetId);
            const fallbackId = remaining[0]?.id || "plot-1";
            currentSelectedPlotId = fallbackId;
            if (typeof onPlotDeleted === 'function') {
              onPlotDeleted(targetId, fallbackId);
            } else if (typeof onSelectPlot === 'function') {
              onSelectPlot(fallbackId);
            }
          }
        } catch (err) {
          console.error("Error deleting plot:", err);
          showToast(`Error deleting plot: ${err.message}`, 'error');
        }
      } else if (deleteConfirmTarget.type === 'crop') {
        const cropId = deleteConfirmTarget.id;
        const cropName = deleteConfirmTarget.name;
        try {
          await firestoreService.deleteCropType(cropId);
          deleteConfirmTarget = null;
          showToast(`Crop '${cropName}' deleted from catalog.`);
        } catch (err) {
          console.error("Error deleting crop:", err);
          showToast(`Error deleting crop: ${err.message}`, 'error');
        }
      }
    });

    // 7. Zone Form Submit
    const zoneForm = overlay.querySelector('#form-field-zone');
    if (zoneForm) {
      zoneForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const plotNumber = Number(overlay.querySelector('#input-zone-number')?.value) || (plots.length + 1);
        const name = overlay.querySelector('#input-zone-name')?.value.trim() || `Zone ${plotNumber}`;
        const crop = overlay.querySelector('#select-zone-crop')?.value || "Potato";
        const stage = overlay.querySelector('#select-zone-stage')?.value || "Vegetative";
        const soilType = overlay.querySelector('#select-zone-soil')?.value || "Clay Loam";
        const targetVwcMin = Number(overlay.querySelector('#input-vwc-min')?.value) || 20.0;
        const targetVwcMax = Number(overlay.querySelector('#input-vwc-max')?.value) || 35.0;
        const valveGateId = overlay.querySelector('#select-valve-gate')?.value || `G${plotNumber}`;

        isSaving = true;
        const saveBtn = overlay.querySelector('#btn-save-zone');
        if (saveBtn) saveBtn.setAttribute('disabled', 'disabled');

        try {

          if (subView === 'edit_zone' && editingZoneId) {
            await firestoreService.updatePlot(editingZoneId, {
              plotNumber,
              name,
              crop,
              stage,
              soilType,
              targetVwcMin,
              targetVwcMax,
              valve: {
                id: valveGateId,
                state: "CLOSED",
                flowRate: 480.0
              }
            });
            showToast(`Zone ${plotNumber} updated in database.`);
          } else {
            const created = await firestoreService.createPlot({
              plotNumber,
              name,
              crop,
              stage,
              soilType,
              targetVwcMin,
              targetVwcMax,
              valve: {
                id: valveGateId,
                state: "CLOSED",
                flowRate: 480.0
              }
            });
            showToast(`New Zone ${plotNumber} created in database!`);
            currentSelectedPlotId = created.id;
            if (typeof onSelectPlot === 'function') onSelectPlot(created.id);
          }

          subView = 'list';
          editingZoneId = null;
        } catch (err) {
          console.error("Error saving zone:", err);
          showToast(`Failed to save zone: ${err.message}`, 'error');
        } finally {
          isSaving = false;
          render();
        }
      });
    }

    // 8. Crop Form Submit
    const cropForm = overlay.querySelector('#form-crop-type');
    if (cropForm) {
      cropForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = overlay.querySelector('#input-crop-name')?.value.trim();
        const scientificName = overlay.querySelector('#input-crop-scientific')?.value.trim() || `${name} sp.`;
        const optimalVwcMin = Number(overlay.querySelector('#input-crop-vwc-min')?.value) || 20.0;
        const optimalVwcMax = Number(overlay.querySelector('#input-crop-vwc-max')?.value) || 35.0;
        const optimalPhMin = Number(overlay.querySelector('#input-crop-ph-min')?.value) || 6.0;
        const optimalPhMax = Number(overlay.querySelector('#input-crop-ph-max')?.value) || 7.0;
        const targetNitrogen = Number(overlay.querySelector('#input-crop-nitrogen')?.value) || 100;
        const category = overlay.querySelector('#input-crop-category')?.value.trim() || "Field Crop";

        isSaving = true;
        const saveBtn = overlay.querySelector('#btn-save-crop');
        if (saveBtn) saveBtn.setAttribute('disabled', 'disabled');

        try {

          if (subView === 'edit_crop' && editingCropId) {
            await firestoreService.updateCropType(editingCropId, {
              name,
              scientificName,
              optimalVwcMin,
              optimalVwcMax,
              optimalPhMin,
              optimalPhMax,
              targetNitrogen,
              category
            });
            showToast(`Crop '${name}' updated in catalog.`);
          } else {
            await firestoreService.addCropType({
              name,
              scientificName,
              optimalVwcMin,
              optimalVwcMax,
              optimalPhMin,
              optimalPhMax,
              targetNitrogen,
              category
            });
            showToast(`Crop '${name}' added to catalog!`);
          }

          subView = 'list';
          editingCropId = null;
        } catch (err) {
          console.error("Error saving crop type:", err);
          showToast(`Failed to save crop: ${err.message}`, 'error');
        } finally {
          isSaving = false;
          render();
        }
      });
    }
  }

  // Initialize data and listeners
  setupRealtimeListeners();
  onLocaleChange(() => render());
  render();

  return overlay;
}
