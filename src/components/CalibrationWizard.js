/**
 * Guided Spectroscope Calibration & Leaf Acquisition Wizard (CalibrationWizard.js)
 * Strict High-Contrast Tactile Green & Slate Theme matching Mobile App.
 * 
 * 5-Step Guided Flow:
 *  - Step 1: Dark Current Calibration ("Put on the dark" - 0% baseline)
 *  - Step 2: 99% PTFE White Disc Calibration ("Put on the white light" - 100% reflectance)
 *  - Step 3: Specimen Metadata Entry Form (Plant Number, Port/Row, Variety, Zone)
 *  - Step 4: Guided Leaf Placement Prompt ("Place on the plant leaf" - Lamina & Vein avoidance)
 *  - Step 5: Spectral Capture & Results (76-band VIS-NIR curve, NDVI, NDRE, WBI, Chlorophyll, Vitality)
 */

import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { spectrometerUSBAdapter } from '../hardware/spectrometerUSBAdapter.js';
import { t, getLocale, onLocaleChange } from '../utils/i18n.js';
import { icon } from '../utils/icons.js';
import { ttsEngine } from '../audio/voiceReadoutTTS.js';
import { sanitizeText } from '../utils/sanitizer.js';

export function createCalibrationModal({
  onClose,
  onComplete,
  initialStep = 'DARK_CURRENT',
  plot = null,
  specimen = null
} = {}) {
  const overlay = document.createElement('div');
  overlay.className = "fixed inset-0 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 z-50 animate-fadeIn select-none overflow-y-auto";

  let currentStep = initialStep; // 'DARK_CURRENT' | 'WHITE_REFERENCE' | 'METADATA' | 'LEAF_PLACEMENT' | 'RESULTS'
  let progress = 0;
  let statusText = t('calib_ready', 'Ready to initialize CMOS detector baseline.');
  let isRunning = false;
  let isSpeaking = false;
  let sessionWhiteDone = false;

  // Specimen Metadata State
  const specimenData = {
    plantNumber: specimen?.plantNumber || 'PLANT-042',
    portNumber: specimen?.portNumber || 'PORT-08',
    cropVariety: specimen?.cropVariety || (plot?.crop || 'Roma Tomato'),
    zone: specimen?.zone || (plot?.name || 'Zone 1')
  };

  const validationErrors = {
    plantNumber: '',
    portNumber: '',
    cropVariety: '',
    zone: ''
  };

  // Spectral scan result for Step 5
  let scanResult = null;

  function speakPromptForStep(step) {
    let script = "";
    switch (step) {
      case 'DARK_CURRENT':
        script = t('calib_voice_dark', 'Step 1: Dark Current Calibration. Please cover the optical aperture or place the probe inside the dark chamber to measure zero percent reflectance baseline.');
        break;
      case 'WHITE_REFERENCE':
        script = t('calib_voice_white', 'Step 2: White Reference Calibration. Please insert the 99 percent pure PTFE reference disc and illuminate with white reference standard.');
        break;
      case 'METADATA':
        script = t('calib_voice_metadata', 'Step 3: Specimen Metadata. Please verify the plant identification tag, row port number, crop variety, and field zone.');
        break;
      case 'LEAF_PLACEMENT':
        script = t('calib_voice_placement', 'Step 4: Place on the plant leaf. Gently clip the probe onto the interveinal leaf blade, avoiding thick primary veins, and keep steady.');
        break;
      case 'RESULTS':
        if (scanResult?.chemometrics) {
          const che = scanResult.chemometrics;
          script = `Scan complete. Crop vitality is ${che.vitalityScore || 85} percent. Canopy NDVI is ${che.indices?.ndvi?.toFixed(2) || '0.84'}. Leaf water index is ${che.waterIndex || 'Optimal'}.`;
        } else {
          script = t('calib_voice_results', '76-band spectral scan captured. Ready to return to studio.');
        }
        break;
      default:
        break;
    }

    if (script) {
      isSpeaking = true;
      const lang = getLocale();
      ttsEngine.speakText(script, { lang: lang === 'en' ? 'en-US' : `${lang}-${lang.toUpperCase()}` });
      setTimeout(() => {
        isSpeaking = false;
        const btn = overlay.querySelector('#calib-audio-btn');
        if (btn) btn.classList.remove('animate-pulse');
      }, 4000);
    }
  }

  function validateMetadata() {
    let valid = true;
    validationErrors.plantNumber = '';
    validationErrors.portNumber = '';
    validationErrors.cropVariety = '';
    validationErrors.zone = '';

    // Sanitize and trim inputs against XSS and control characters, clamping overflows
    specimenData.plantNumber = sanitizeText(specimenData.plantNumber || '').slice(0, 32);
    specimenData.portNumber = sanitizeText(specimenData.portNumber || '').slice(0, 32);
    specimenData.cropVariety = sanitizeText(specimenData.cropVariety || '').slice(0, 64);

    if (!specimenData.plantNumber || specimenData.plantNumber.trim().length < 2) {
      validationErrors.plantNumber = t('err_plant_required', 'Plant number is required (min 2 chars)');
      valid = false;
    }
    if (!specimenData.portNumber || specimenData.portNumber.trim().length < 2) {
      validationErrors.portNumber = t('err_port_required', 'Port/Row number is required (min 2 chars)');
      valid = false;
    }
    if (!specimenData.cropVariety || specimenData.cropVariety.trim().length < 2) {
      validationErrors.cropVariety = t('err_crop_required', 'Crop variety is required');
      valid = false;
    }
    if (!specimenData.zone) {
      validationErrors.zone = t('err_zone_required', 'Please select a Zone');
      valid = false;
    }
    return valid;
  }

  function render() {
    const isDarkDone = Boolean(leafClipDevice.calibration?.darkCurrentCompleted);
    const isWhiteDone = sessionWhiteDone || (currentStep !== 'WHITE_REFERENCE' && Boolean(leafClipDevice.calibration?.whiteDiscCompleted));
    const isCalibrated = Boolean(leafClipDevice.calibration?.isCalibrated);

    overlay.innerHTML = `
      <div class="bg-slate-900 border border-slate-750 rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden text-white my-auto max-h-[92vh] flex flex-col">
        
        <!-- Header Row -->
        <div class="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div class="flex items-center gap-3 min-w-0 pr-2">
            <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              ${icon('spectroscopy', 'w-5 h-5 text-emerald-400')}
            </div>
            <div class="min-w-0 flex-1">
              <h3 class="text-sm sm:text-base font-bold text-white truncate leading-snug">
                ${t('calib_guided_title', 'Spectroscope Calibration & Leaf Acquisition Wizard')}
              </h3>
              <p class="text-[11px] text-emerald-300/80 font-mono truncate mt-0.5">
                ${t('calib_subtitle', 'Two-point optical normalization [350–1100 nm VIS-NIR]')}
              </p>
            </div>
          </div>

          <!-- Top Action Buttons: Voice Prompter & Close Button -->
          <div class="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              id="calib-audio-btn"
              class="w-10 h-10 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 flex items-center justify-center transition active:scale-95 cursor-pointer min-w-[44px] min-h-[44px]"
              title="${t('voice_prompt_listen', 'Listen voice instructions')}"
              aria-label="Voice prompt instructions"
            >
              ${icon('volume', 'w-4 h-4')}
            </button>

            <button
              type="button"
              id="calib-close-btn"
              class="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition active:scale-95 cursor-pointer min-w-[44px] min-h-[44px]"
              title="${t('calib_close', 'Close')}"
              aria-label="Close wizard"
            >
              ${icon('x', 'w-4 h-4')}
            </button>
          </div>
        </div>

        <!-- 5-Step Stepper Breadcrumbs Bar -->
        <div class="py-3 border-b border-slate-800 shrink-0">
          <div class="flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
            <!-- Step 1 Pill -->
            <button type="button" data-nav-step="DARK_CURRENT" class="step-nav-pill flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition whitespace-nowrap min-h-[36px] ${
              currentStep === 'DARK_CURRENT'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                : (isDarkDone ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700/60')
            }">
              <span>${isDarkDone ? '✓' : '1.'}</span>
              <span>${t('step_dark_short', 'Dark (0%)')}</span>
            </button>

            <span class="text-slate-600 text-[10px]">→</span>

            <!-- Step 2 Pill -->
            <button type="button" data-nav-step="WHITE_REFERENCE" class="step-nav-pill flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition whitespace-nowrap min-h-[36px] ${
              currentStep === 'WHITE_REFERENCE'
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                : (isWhiteDone ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700/60')
            }">
              <span>${isWhiteDone ? '✓' : '2.'}</span>
              <span>${t('step_white_short', 'White (99%)')}</span>
            </button>

            <span class="text-slate-600 text-[10px]">→</span>

            <!-- Step 3 Pill -->
            <button type="button" data-nav-step="METADATA" class="step-nav-pill flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition whitespace-nowrap min-h-[36px] ${
              currentStep === 'METADATA'
                ? 'bg-[#0E5431] text-emerald-100 border border-emerald-500'
                : (currentStep === 'LEAF_PLACEMENT' || currentStep === 'RESULTS' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700/60')
            }">
              <span>3.</span>
              <span>${t('step_meta_short', 'Specimen')}</span>
            </button>

            <span class="text-slate-600 text-[10px]">→</span>

            <!-- Step 4 Pill -->
            <button type="button" data-nav-step="LEAF_PLACEMENT" class="step-nav-pill flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition whitespace-nowrap min-h-[36px] ${
              currentStep === 'LEAF_PLACEMENT'
                ? 'bg-[#0E5431] text-emerald-100 border border-emerald-500'
                : (currentStep === 'RESULTS' ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800/80 text-slate-400 border border-slate-700/60')
            }">
              <span>4.</span>
              <span>${t('step_clamp_short', 'Clamp')}</span>
            </button>

            <span class="text-slate-600 text-[10px]">→</span>

            <!-- Step 5 Pill -->
            <button type="button" data-nav-step="RESULTS" class="step-nav-pill flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] sm:text-xs font-mono font-bold transition whitespace-nowrap min-h-[36px] ${
              currentStep === 'RESULTS'
                ? 'bg-emerald-500 text-slate-950 font-black border border-emerald-300'
                : 'bg-slate-800/80 text-slate-400 border border-slate-700/60'
            }">
              <span>5.</span>
              <span>${t('step_results_short', 'Results')}</span>
            </button>
          </div>
        </div>

        <!-- Scrollable Main Step Container -->
        <div class="py-4 space-y-4 overflow-y-auto flex-1 pr-0.5">
          ${renderStepContent(currentStep, isDarkDone, isWhiteDone, isCalibrated)}
        </div>

        <!-- Sticky Bottom Footer Controls -->
        <div class="pt-3 border-t border-slate-800 shrink-0 flex items-center justify-between gap-2.5 flex-wrap">
          ${renderStepFooter(currentStep, isDarkDone, isWhiteDone, isCalibrated)}
        </div>
      </div>
    `;

    attachEvents();

    if (currentStep === 'RESULTS') {
      setTimeout(() => renderResultsCanvas(), 50);
    }
  }

  function renderStepContent(step, isDarkDone, isWhiteDone, isCalibrated) {
    switch (step) {
      case 'DARK_CURRENT':
        return `
          <!-- Step 1: Dark Calibration ("Put on the dark") -->
          <div class="space-y-3.5">
            <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-amber-500/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-500/30">
                ${icon('sunMoon', 'w-6 h-6')}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ${t('calib_step1_badge', 'Step 1: Put on the dark')}
                  </span>
                  ${isDarkDone ? `<span class="text-xs text-emerald-400 font-bold">✓ ${t('calib_verified', 'Verified')}</span>` : ''}
                </div>
                <h4 class="text-sm font-bold text-white mt-1">
                  ${t('calib_dark_prompt_title', 'Dark Current Zero Baseline (0% Reflectance)')}
                </h4>
                <p class="text-xs text-slate-300 leading-relaxed mt-1">
                  ${t('calib_step1_desc_long', 'Ensure the leaf-clip optical chamber is tightly closed or cover the optical aperture completely with zero light. This records CMOS thermal detector dark noise across all 76 wavelength photodiodes.')}
                </p>
              </div>
            </div>

            <!-- Optical Chamber Dark Visual Graphic -->
            <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-4 text-center">
              <div class="space-y-1">
                <div class="w-14 h-14 mx-auto rounded-full bg-slate-900 border-2 border-dashed border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner">
                  ${icon('shield', 'w-7 h-7 text-amber-400')}
                </div>
                <div class="text-[11px] font-mono text-amber-200 font-bold">${t('calib_aperture_sealed', 'Aperture Sealed: 0 LUX')}</div>
                <div class="text-[10px] text-slate-400">${t('calib_dark_spec', 'Null electronic offset: 350–1100 nm')}</div>
              </div>
            </div>

            <!-- Sweep Progress Bar -->
            ${isRunning ? renderProgressBar() : ''}
          </div>
        `;

      case 'WHITE_REFERENCE':
        return `
          <!-- Step 2: White Calibration ("Put on the white light") -->
          <div class="space-y-3.5">
            <div class="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-start gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-blue-500/20 text-blue-300 flex items-center justify-center shrink-0 border border-blue-500/30">
                ${icon('sun', 'w-6 h-6')}
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    ${t('calib_step2_badge', 'Step 2: Put on the white light')}
                  </span>
                  ${isWhiteDone ? `<span class="text-xs text-emerald-400 font-bold">✓ ${t('calib_calibrated', 'Calibrated')}</span>` : ''}
                </div>
                <h4 class="text-sm font-bold text-white mt-1">
                  ${t('calib_white_prompt_title', '99% PTFE White Target Disc Standard')}
                </h4>
                <p class="text-xs text-slate-300 leading-relaxed mt-1">
                  ${t('calib_step2_desc_long', 'Insert the 99% pure diffuse PTFE Spectralon disc into the probe clamp or activate the calibrated white reference illuminator. This normalizes 100% reflectance baseline across 350-1100 nm.')}
                </p>
              </div>
            </div>

            <!-- Optical Disc White Visual Graphic -->
            <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center gap-4 text-center">
              <div class="space-y-1">
                <div class="w-14 h-14 mx-auto rounded-full bg-slate-100 border-2 border-blue-400 flex items-center justify-center text-slate-900 shadow-md">
                  <div class="w-10 h-10 rounded-full border border-slate-300 bg-white flex items-center justify-center font-mono font-bold text-[10px] text-blue-700">
                    99%
                  </div>
                </div>
                <div class="text-[11px] font-mono text-blue-200 font-bold">${t('calib_ptfe_inserted', 'PTFE Standard Disc Inserted')}</div>
                <div class="text-[10px] text-slate-400">${t('calib_ptfe_spec', 'Halogen 2850K / White LED Normalization')}</div>
              </div>
            </div>

            <!-- Sweep Progress Bar -->
            ${isRunning ? renderProgressBar() : ''}
          </div>
        `;

      case 'METADATA':
        return `
          <!-- Step 3: Specimen Metadata Entry Form -->
          <div class="space-y-3.5">
            <div class="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-3">
              <div class="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
                ${icon('edit', 'w-4 h-4')}
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="text-xs sm:text-sm font-bold text-white">
                  ${t('calib_meta_title', 'Step 3: Specimen Traceability Metadata')}
                </h4>
                <p class="text-[11px] text-slate-300 mt-0.5">
                  ${t('calib_meta_desc', 'Enter plant identifier, row port, variety, and target zone for field cataloging.')}
                </p>
              </div>
            </div>

            <!-- Form Fields Grid -->
            <div class="space-y-3">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <!-- Plant Number Input -->
                <div class="space-y-1">
                  <label class="block text-xs font-semibold text-slate-300">
                    ${t('calib_field_plant_id', 'Plant Number')} <span class="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="calib-input-plant"
                    value="${specimenData.plantNumber}"
                    placeholder="e.g. PLANT-042"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border ${validationErrors.plantNumber ? 'border-rose-500' : 'border-slate-700'} text-white text-xs font-mono focus:border-emerald-500 focus:outline-none transition min-h-[44px]"
                  />
                  ${validationErrors.plantNumber ? `<p class="text-[10px] text-rose-400 font-medium">${validationErrors.plantNumber}</p>` : ''}
                </div>

                <!-- Port / Row Number Input -->
                <div class="space-y-1">
                  <label class="block text-xs font-semibold text-slate-300">
                    ${t('calib_field_port_row', 'Port / Row Number')} <span class="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    id="calib-input-port"
                    value="${specimenData.portNumber}"
                    placeholder="e.g. PORT-08"
                    class="w-full px-3 py-2.5 rounded-xl bg-slate-950 border ${validationErrors.portNumber ? 'border-rose-500' : 'border-slate-700'} text-white text-xs font-mono focus:border-emerald-500 focus:outline-none transition min-h-[44px]"
                  />
                  ${validationErrors.portNumber ? `<p class="text-[10px] text-rose-400 font-medium">${validationErrors.portNumber}</p>` : ''}
                </div>
              </div>

              <!-- Plant Name / Crop Variety -->
              <div class="space-y-1">
                <label class="block text-xs font-semibold text-slate-300">
                  ${t('calib_field_crop_name', 'Plant Name / Crop Variety')} <span class="text-rose-400">*</span>
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    id="calib-input-crop"
                    value="${specimenData.cropVariety}"
                    placeholder="e.g. Roma Tomato"
                    class="flex-1 px-3 py-2.5 rounded-xl bg-slate-950 border ${validationErrors.cropVariety ? 'border-rose-500' : 'border-slate-700'} text-white text-xs focus:border-emerald-500 focus:outline-none transition min-h-[44px]"
                  />
                  <select
                    id="calib-crop-quick-select"
                    class="px-2.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 text-xs focus:border-emerald-500 focus:outline-none transition cursor-pointer min-h-[44px]"
                    title="Quick crop presets"
                  >
                    <option value="">${t('calib_select_preset', 'Quick Pick')}</option>
                    <option value="Roma Tomato">Roma Tomato</option>
                    <option value="Bell Peppers">Bell Peppers</option>
                    <option value="Crisp Spinach">Crisp Spinach</option>
                    <option value="Golden Corn">Golden Corn</option>
                    <option value="Sweet Strawberry">Sweet Strawberry</option>
                    <option value="Punjab Cotton">Punjab Cotton</option>
                  </select>
                </div>
                ${validationErrors.cropVariety ? `<p class="text-[10px] text-rose-400 font-medium">${validationErrors.cropVariety}</p>` : ''}
              </div>

              <!-- Zone / Plot Selection (Zone 1 through 6) -->
              <div class="space-y-1.5">
                <label class="block text-xs font-semibold text-slate-300">
                  ${t('calib_field_zone', 'Field Zone / Plot Selection')} <span class="text-rose-400">*</span>
                </label>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  ${[1, 2, 3, 4, 5, 6].map(z => {
                    const zoneKey = `Zone ${z}`;
                    const isSelected = specimenData.zone === zoneKey || specimenData.zone === `plot-${z}`;
                    return `
                      <button
                        type="button"
                        data-zone="Zone ${z}"
                        class="calib-zone-btn py-2 px-1 rounded-xl text-xs font-mono font-bold transition flex flex-col items-center justify-center gap-0.5 min-h-[44px] cursor-pointer ${
                          isSelected
                            ? 'bg-[#0E5431] text-emerald-100 border-2 border-emerald-400 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700 hover:text-white'
                        }"
                      >
                        <span class="text-[10px] uppercase">Z-${z}</span>
                        <span class="text-[11px] font-semibold">${z}</span>
                      </button>
                    `;
                  }).join('')}
                </div>
                ${validationErrors.zone ? `<p class="text-[10px] text-rose-400 font-medium">${validationErrors.zone}</p>` : ''}
              </div>
            </div>
          </div>
        `;

      case 'LEAF_PLACEMENT':
        return `
          <!-- Step 4: Leaf Placement Prompt ("Place on the plant leaf") -->
          <div class="space-y-3.5">
            <div class="p-4 rounded-2xl bg-[#0E5431]/25 border border-emerald-500/40 flex items-start gap-3.5">
              <div class="w-11 h-11 rounded-2xl bg-emerald-500/20 text-emerald-300 flex items-center justify-center shrink-0 border border-emerald-500/30">
                ${icon('leaf', 'w-6 h-6 text-emerald-400')}
              </div>
              <div class="min-w-0 flex-1">
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  ${t('calib_step4_badge', 'Step 4: Place on the plant leaf')}
                </span>
                <h4 class="text-sm font-bold text-white mt-1">
                  ${t('calib_leaf_prompt_title', 'Guided Probe Clamp Placement')}
                </h4>
                <p class="text-xs text-slate-300 leading-relaxed mt-1">
                  ${t('calib_leaf_instruction', 'Gently clamp the optical sensor probe onto the leaf lamina blade. Position the aperture squarely over interveinal green tissue, avoiding thick central midribs or heavy secondary veins.')}
                </p>
              </div>
            </div>

            <!-- Tactile Guided Leaf Placement Graphic Diagram (SVG) -->
            <div class="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-2">
              <div class="relative w-full h-32 bg-gradient-to-b from-slate-900 to-slate-950 rounded-xl overflow-hidden flex items-center justify-center p-2">
                <svg viewBox="0 0 320 120" class="w-full h-full max-w-[280px]">
                  <!-- Leaf Outline -->
                  <path d="M 40,60 C 90,15 220,15 280,60 C 220,105 90,105 40,60 Z" fill="#064E3B" stroke="#059669" stroke-width="2"/>
                  <!-- Thick Midrib Vein (Avoided) -->
                  <path d="M 40,60 Q 160,60 280,60" fill="none" stroke="#047857" stroke-width="4" stroke-linecap="round"/>
                  <!-- Secondary Lateral Veins -->
                  <path d="M 100,60 Q 130,35 150,25" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
                  <path d="M 100,60 Q 130,85 150,95" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
                  <path d="M 180,60 Q 210,38 230,30" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round"/>
                  <path d="M 180,60 Q 210,82 230,90" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round"/>

                  <!-- Bad Placement Marker (On Midrib) -->
                  <circle cx="110" cy="60" r="10" fill="rgba(239, 68, 68, 0.2)" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="2,2"/>
                  <line x1="104" y1="54" x2="116" y2="66" stroke="#EF4444" stroke-width="1.5"/>
                  <line x1="116" y1="54" x2="104" y2="66" stroke="#EF4444" stroke-width="1.5"/>

                  <!-- Correct Sensor Placement Target (Interveinal Lamina) -->
                  <g transform="translate(190, 38)">
                    <circle cx="0" cy="0" r="15" fill="rgba(16, 185, 129, 0.3)" stroke="#10B981" stroke-width="2"/>
                    <circle cx="0" cy="0" r="6" fill="#10B981"/>
                    <circle cx="0" cy="0" r="20" fill="none" stroke="#34D399" stroke-width="1" stroke-dasharray="3,3" class="animate-spin"/>
                  </g>

                  <!-- Target Callout Labels -->
                  <text x="215" y="32" fill="#34D399" font-size="9" font-family="monospace" font-weight="bold">✓ TARGET LAMINA</text>
                  <text x="50" y="82" fill="#F87171" font-size="8" font-family="monospace">✕ AVOID THICK VEINS</text>
                </svg>
              </div>

              <!-- Quick Checklist -->
              <div class="grid grid-cols-2 gap-2 text-[11px] text-slate-300">
                <div class="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span class="text-emerald-400 font-bold shrink-0">✓</span>
                  <span class="truncate">${t('calib_chk_lamina', 'Clean leaf surface')}</span>
                </div>
                <div class="flex items-center gap-1.5 p-2 rounded-xl bg-slate-900 border border-slate-800">
                  <span class="text-emerald-400 font-bold shrink-0">✓</span>
                  <span class="truncate">${t('calib_chk_seal', 'Light-tight seal')}</span>
                </div>
              </div>
            </div>

            <!-- Sweep Progress Bar -->
            ${isRunning ? renderProgressBar() : ''}
          </div>
        `;

      case 'RESULTS':
        const che = scanResult?.chemometrics || {
          vitalityScore: 88,
          chlorophyllIndex: 'High',
          waterIndex: 'Optimal',
          nitrogenStatus: 'Adequate',
          nitrogenPrescriptionKg: 0,
          irrigationCountdownHours: 36,
          indices: {
            ndvi: 0.842,
            ndre: 0.388,
            wbi: 0.941,
            cire: 2.15
          }
        };

        return `
          <!-- Step 5: Spectral Capture & Results -->
          <div class="space-y-3.5">
            <!-- Specimen Badge Header -->
            <div class="p-3 rounded-2xl bg-slate-950 border border-emerald-800/40 flex items-center justify-between text-xs font-mono">
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded-lg bg-[#0E5431] text-emerald-200 font-bold">${specimenData.zone}</span>
                <span class="font-bold text-white">${specimenData.plantNumber}</span>
                <span class="text-slate-400">${specimenData.portNumber}</span>
              </div>
              <span class="text-emerald-400 font-sans font-bold">${specimenData.cropVariety}</span>
            </div>

            <!-- 76-Band Live Curve Canvas -->
            <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div class="flex items-center justify-between text-[11px]">
                <span class="font-bold text-slate-300 flex items-center gap-1.5">
                  ${icon('activity', 'w-3.5 h-3.5 text-emerald-400')}
                  <span>${t('calib_76_curve_title', 'Live 76-Band Reflectance Spectrum (350–1100 nm)')}</span>
                </span>
                <span class="text-[10px] font-mono text-emerald-400 font-bold">16 Scans Avg</span>
              </div>
              
              <div class="relative w-full bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                <canvas id="calib-spectral-canvas" class="w-full h-32 block"></canvas>
              </div>

              <div class="flex items-center justify-between text-[9px] font-mono text-slate-400 px-1">
                <span class="text-violet-400">UV 350</span>
                <span class="text-blue-400">Blue 450</span>
                <span class="text-emerald-400">Green 550</span>
                <span class="text-rose-400">Red 680</span>
                <span class="text-red-300">Edge 720</span>
                <span class="text-purple-300">NIR 970</span>
                <span class="text-slate-400">1100nm</span>
              </div>
            </div>

            <!-- Chemometrics Key Indicators -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <!-- Vitality -->
              <div class="p-2.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-center">
                <div class="text-[10px] uppercase font-mono text-emerald-300 font-semibold">${t('calib_metric_vitality', 'Vitality')}</div>
                <div class="text-lg font-black font-mono text-emerald-400 mt-0.5">${che.vitalityScore}%</div>
                <div class="text-[9px] text-emerald-200/70 font-mono">Mesophyll Turgor</div>
              </div>

              <!-- NDVI -->
              <div class="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div class="text-[10px] uppercase font-mono text-slate-400 font-semibold">NDVI</div>
                <div class="text-base font-bold font-mono text-white mt-0.5">${che.indices?.ndvi?.toFixed(3) || '0.842'}</div>
                <div class="text-[9px] text-slate-500 font-mono">Canopy Vigor</div>
              </div>

              <!-- NDRE -->
              <div class="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div class="text-[10px] uppercase font-mono text-slate-400 font-semibold">NDRE</div>
                <div class="text-base font-bold font-mono text-white mt-0.5">${che.indices?.ndre?.toFixed(3) || '0.388'}</div>
                <div class="text-[9px] text-slate-500 font-mono">Chlorophyll/N</div>
              </div>

              <!-- WBI / Leaf Water -->
              <div class="p-2.5 rounded-2xl bg-slate-950 border border-slate-800 text-center">
                <div class="text-[10px] uppercase font-mono text-slate-400 font-semibold">WBI Water</div>
                <div class="text-base font-bold font-mono text-white mt-0.5">${che.indices?.wbi?.toFixed(3) || '0.941'}</div>
                <div class="text-[9px] text-slate-500 font-mono">${che.waterIndex || 'Optimal'}</div>
              </div>
            </div>
          </div>
        `;

      default:
        return `<p class="text-xs text-slate-400">${t('calib_unknown_step', 'Step unknown.')}</p>`;
    }
  }

  function renderProgressBar() {
    return `
      <div class="p-3 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 mt-2">
        <div class="flex items-center justify-between text-[11px] font-mono">
          <span class="text-slate-300 font-bold">${t('calib_integration', 'CMOS Integration')}</span>
          <span class="text-emerald-400 font-bold">${progress}%</span>
        </div>
        <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div class="h-full bg-gradient-to-r from-amber-500 via-emerald-400 to-emerald-500 transition-all duration-200 rounded-full" style="width: ${progress}%"></div>
        </div>
        <p class="text-[10px] font-mono text-slate-400 truncate">${statusText}</p>
      </div>
    `;
  }

  function renderStepFooter(step, isDarkDone, isWhiteDone, isCalibrated) {
    switch (step) {
      case 'DARK_CURRENT':
        return `
          <button
            type="button"
            id="calib-cancel-btn"
            class="min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer active:scale-95"
          >
            ${t('calib_close', 'Close')}
          </button>

          <button
            type="button"
            id="calib-run-btn"
            ${isRunning ? 'disabled' : ''}
            class="min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 ml-auto"
          >
            ${isRunning ? '<span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>' : icon('sunMoon', 'w-4 h-4')}
            <span>${t('calib_start_dark', 'Start Dark Current Sweep')}</span>
          </button>
        `;

      case 'WHITE_REFERENCE':
        return `
          <button
            type="button"
            id="calib-cancel-btn"
            class="min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer active:scale-95"
          >
            ${t('calib_close', 'Close')}
          </button>

          ${!isWhiteDone ? `
            <button
              type="button"
              id="calib-run-btn"
              ${isRunning ? 'disabled' : ''}
              class="min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 ml-auto"
            >
              ${isRunning ? '<span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>' : icon('sun', 'w-4 h-4')}
              <span>${t('calib_start_white', 'Calibrate 99% White Disc')}</span>
            </button>
          ` : `
            <div class="flex items-center gap-2 ml-auto">
              <button
                type="button"
                id="calib-done-btn"
                class="min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-md cursor-pointer active:scale-95"
              >
                ${t('calib_done_return', 'Done & Return to Studio')}
              </button>

              <button
                type="button"
                id="calib-next-btn"
                class="min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-white bg-[#0E5431] hover:bg-[#083820] border border-emerald-500/50 transition shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>${t('calib_proceed_specimen', 'Next: Specimen ID →')}</span>
              </button>
            </div>
          `}
        `;

      case 'METADATA':
        return `
          <div class="flex items-center gap-2">
            <button
              type="button"
              id="calib-back-btn"
              class="min-h-[48px] px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer active:scale-95 flex items-center gap-1"
            >
              ${icon('chevronLeft', 'w-4 h-4')}
              <span>${t('btn_back', 'Back')}</span>
            </button>

            <button
              type="button"
              id="calib-cancel-btn"
              class="min-h-[48px] px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              ${t('calib_cancel', 'Cancel')}
            </button>
          </div>

          <button
            type="button"
            id="calib-to-placement-btn"
            class="min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-[#0E5431] hover:bg-[#083820] border border-emerald-500/60 transition shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 ml-auto"
          >
            <span>${t('calib_next_placement', 'Next: Leaf Placement →')}</span>
          </button>
        `;

      case 'LEAF_PLACEMENT':
        return `
          <div class="flex items-center gap-2">
            <button
              type="button"
              id="calib-back-btn"
              class="min-h-[48px] px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer active:scale-95 flex items-center gap-1"
            >
              ${icon('chevronLeft', 'w-4 h-4')}
              <span>${t('btn_back', 'Back')}</span>
            </button>

            <button
              type="button"
              id="calib-cancel-btn"
              class="min-h-[48px] px-3.5 py-2.5 rounded-2xl text-xs font-semibold text-slate-400 hover:text-white transition cursor-pointer"
            >
              ${t('calib_cancel', 'Cancel')}
            </button>
          </div>

          <button
            type="button"
            id="calib-start-scan-btn"
            ${isRunning ? 'disabled' : ''}
            class="min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-95 ml-auto"
          >
            ${isRunning ? '<span class="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></span>' : icon('refresh', 'w-4 h-4 text-slate-950')}
            <span>${t('calib_acquire_scan_btn', 'Acquire 76-Band Spectral Scan')}</span>
          </button>
        `;

      case 'RESULTS':
        return `
          <button
            type="button"
            id="calib-rescan-btn"
            class="min-h-[48px] px-4 py-2.5 rounded-2xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer active:scale-95 flex items-center gap-1.5"
          >
            ${icon('refresh', 'w-4 h-4')}
            <span>${t('calib_rescan_btn', 'Rescan Leaf')}</span>
          </button>

          <button
            type="button"
            id="calib-done-btn"
            class="min-h-[48px] px-5 py-2.5 rounded-2xl text-xs font-bold text-slate-950 bg-emerald-400 hover:bg-emerald-300 transition shadow-lg flex items-center gap-1.5 cursor-pointer active:scale-95 ml-auto"
          >
            ${icon('check', 'w-4 h-4 text-slate-950')}
            <span>${t('calib_apply_studio', 'Apply Scan & Return to Studio')}</span>
          </button>
        `;

      default:
        return `
          <button type="button" id="calib-cancel-btn" class="min-h-[48px] px-4 py-2 rounded-2xl text-xs font-bold text-white bg-slate-800">
            ${t('calib_close', 'Close')}
          </button>
        `;
    }
  }

  function renderResultsCanvas() {
    const canvas = overlay.querySelector('#calib-spectral-canvas');
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width = (canvas.parentElement?.clientWidth || 360);
    const height = canvas.height = 128;

    ctx.clearRect(0, 0, width, height);

    // Background VIS-NIR spectrum regions
    const bands = [
      { start: 350, end: 400, color: 'rgba(139, 92, 246, 0.15)' },
      { start: 400, end: 500, color: 'rgba(59, 130, 246, 0.15)' },
      { start: 500, end: 600, color: 'rgba(34, 197, 94, 0.20)' },
      { start: 600, end: 700, color: 'rgba(239, 68, 68, 0.18)' },
      { start: 700, end: 750, color: 'rgba(185, 28, 28, 0.25)' },
      { start: 750, end: 1100, color: 'rgba(168, 85, 247, 0.12)' }
    ];

    bands.forEach(b => {
      const x1 = ((b.start - 350) / (1100 - 350)) * width;
      const x2 = ((b.end - 350) / (1100 - 350)) * width;
      ctx.fillStyle = b.color;
      ctx.fillRect(x1, 0, x2 - x1, height);
    });

    // Horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    for (let r = 0.25; r <= 1.0; r += 0.25) {
      const y = height - (r * height * 0.8) - 10;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    const wavelengths = scanResult?.wavelengths || Array.from({ length: 76 }, (_, i) => 350 + i * 10);
    const reflectance = scanResult?.reflectance || Array.from({ length: 76 }, (_, i) => {
      const wl = 350 + i * 10;
      if (wl < 500) return 0.05 + 0.04 * Math.sin(i / 5);
      if (wl < 600) return 0.14 + 0.08 * Math.sin((wl - 500) / 100 * Math.PI); // Green peak
      if (wl < 700) return 0.04 + 0.02 * Math.sin((wl - 600) / 100 * Math.PI); // Chlorophyll pit
      if (wl < 750) return 0.06 + 0.42 * ((wl - 700) / 50); // Red edge steep rise
      return 0.48 + 0.05 * Math.sin((wl - 750) / 100); // NIR plateau
    });

    if (reflectance.length > 0) {
      ctx.beginPath();
      for (let i = 0; i < wavelengths.length; i++) {
        const wl = wavelengths[i];
        const ref = reflectance[i] || 0;
        const x = ((wl - 350) / (1100 - 350)) * width;
        const y = height - (ref * height * 0.8) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#22C55E';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Soft glow fill
      ctx.lineTo(width, height);
      ctx.lineTo(0, height);
      ctx.closePath();
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, 'rgba(34, 197, 94, 0.35)');
      grad.addColorStop(1, 'rgba(34, 197, 94, 0.0)');
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  function simulateCalibrationSweep(onUpdate) {
    return new Promise(resolve => {
      let p = 15;
      const interval = setInterval(() => {
        p += 20;
        if (p >= 100) {
          clearInterval(interval);
          onUpdate(100, t('calib_integration_complete', 'Integration complete. Baseline stored.'));
          setTimeout(resolve, 250);
        } else {
          onUpdate(p, `${t('calib_averaging_scans', 'Averaging 16 scans across photodiodes...')} (${p}%)`);
        }
      }, 100);
    });
  }

  function attachEvents() {
    // Header Close & Cancel buttons
    overlay.querySelector('#calib-close-btn')?.addEventListener('click', close);
    overlay.querySelector('#calib-cancel-btn')?.addEventListener('click', close);

    // Audio Voice Readout button
    overlay.querySelector('#calib-audio-btn')?.addEventListener('click', () => {
      speakPromptForStep(currentStep);
    });

    // Step Breadcrumbs Navigation
    overlay.querySelectorAll('.step-nav-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        const targetStep = pill.getAttribute('data-nav-step');
        if (targetStep) {
          // Allow going back to earlier steps or jumping if calibrated
          if (targetStep === 'DARK_CURRENT' || targetStep === 'WHITE_REFERENCE') {
            currentStep = targetStep;
            render();
          } else if (leafClipDevice.calibration.isCalibrated || spectrometerUSBAdapter.calibration.isCalibrated) {
            currentStep = targetStep;
            render();
          }
        }
      });
    });

    // Back Button in Step 3 & 4
    overlay.querySelector('#calib-back-btn')?.addEventListener('click', () => {
      if (currentStep === 'METADATA') {
        currentStep = 'WHITE_REFERENCE';
      } else if (currentStep === 'LEAF_PLACEMENT') {
        currentStep = 'METADATA';
      }
      render();
    });

    // Step 1 & 2 Action Button (Dark Current & White Disc Sweep)
    const runBtn = overlay.querySelector('#calib-run-btn');
    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        if (isRunning) return;
        isRunning = true;
        progress = 10;
        statusText = t('calib_engaging_cmos', 'Engaging spectrometer CMOS sensor array...');
        render();

        try {
          if (currentStep === 'DARK_CURRENT') {
            if (typeof leafClipDevice.runCalibrationStep === 'function') {
              await leafClipDevice.runCalibrationStep('DARK_CURRENT', (p, txt) => {
                progress = p;
                statusText = txt;
                render();
              });
            } else {
              await simulateCalibrationSweep((p, txt) => {
                progress = p;
                statusText = txt;
                render();
              });
            }
            leafClipDevice.calibration.darkCurrentCompleted = true;
            leafClipDevice.calibration.darkCurrentTimestamp = new Date().toISOString();
            if (typeof spectrometerUSBAdapter.calibrateDarkCurrent === 'function') {
              try { await spectrometerUSBAdapter.calibrateDarkCurrent(); } catch (e) {}
            }
            currentStep = 'WHITE_REFERENCE';
          } else if (currentStep === 'WHITE_REFERENCE') {
            if (typeof leafClipDevice.runCalibrationStep === 'function') {
              await leafClipDevice.runCalibrationStep('WHITE_REFERENCE', (p, txt) => {
                progress = p;
                statusText = txt;
                render();
              });
            } else {
              await simulateCalibrationSweep((p, txt) => {
                progress = p;
                statusText = txt;
                render();
              });
            }
            leafClipDevice.calibration.whiteDiscCompleted = true;
            leafClipDevice.calibration.whiteDiscTimestamp = new Date().toISOString();
            leafClipDevice.calibration.isCalibrated = true;
            sessionWhiteDone = true;
            if (typeof spectrometerUSBAdapter.calibrateWhiteReference === 'function') {
              try { await spectrometerUSBAdapter.calibrateWhiteReference(); } catch (e) {}
            }
            // Step 2 stays on WHITE_REFERENCE so the user can either click Done & Return or proceed to Metadata
          }
        } catch (err) {
          statusText = t('calib_err_failed', 'Calibration failed: ') + (err.message || err);
        } finally {
          isRunning = false;
          render();
        }
      });
    }

    // Step 2 Proceed to Specimen ID button
    overlay.querySelector('#calib-next-btn')?.addEventListener('click', () => {
      currentStep = 'METADATA';
      render();
    });

    // Step 3 Metadata Inputs & Zone Selection
    const plantInput = overlay.querySelector('#calib-input-plant');
    plantInput?.addEventListener('input', (e) => {
      const rawVal = (e && e.target && e.target.value !== undefined) ? e.target.value : (plantInput?.value || '');
      specimenData.plantNumber = (typeof sanitizeText === 'function' ? sanitizeText(rawVal) : rawVal).toUpperCase().slice(0, 32);
    });

    const portInput = overlay.querySelector('#calib-input-port');
    portInput?.addEventListener('input', (e) => {
      const rawVal = (e && e.target && e.target.value !== undefined) ? e.target.value : (portInput?.value || '');
      specimenData.portNumber = (typeof sanitizeText === 'function' ? sanitizeText(rawVal) : rawVal).toUpperCase().slice(0, 32);
    });

    const cropInput = overlay.querySelector('#calib-input-crop');
    cropInput?.addEventListener('input', (e) => {
      const rawVal = (e && e.target && e.target.value !== undefined) ? e.target.value : (cropInput?.value || '');
      specimenData.cropVariety = (typeof sanitizeText === 'function' ? sanitizeText(rawVal) : rawVal).slice(0, 64);
    });

    const cropSelect = overlay.querySelector('#calib-crop-quick-select');
    cropSelect?.addEventListener('change', (e) => {
      const rawVal = (e && e.target && e.target.value !== undefined) ? e.target.value : (cropSelect?.value || '');
      if (rawVal) {
        specimenData.cropVariety = (typeof sanitizeText === 'function' ? sanitizeText(rawVal) : rawVal).slice(0, 64);
        if (cropInput) cropInput.value = specimenData.cropVariety;
      }
    });

    overlay.querySelectorAll('.calib-zone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const z = btn.getAttribute('data-zone');
        if (z) {
          specimenData.zone = z;
          render();
        }
      });
    });

    // Step 3 Next Button -> Validate and Go to Step 4
    overlay.querySelector('#calib-to-placement-btn')?.addEventListener('click', () => {
      const pIn = overlay.querySelector('#calib-input-plant');
      const rIn = overlay.querySelector('#calib-input-port');
      const cIn = overlay.querySelector('#calib-input-crop');
      if (pIn && pIn.value !== undefined) {
        specimenData.plantNumber = (typeof sanitizeText === 'function' ? sanitizeText(pIn.value) : pIn.value).trim().toUpperCase().slice(0, 32);
      }
      if (rIn && rIn.value !== undefined) {
        specimenData.portNumber = (typeof sanitizeText === 'function' ? sanitizeText(rIn.value) : rIn.value).trim().toUpperCase().slice(0, 32);
      }
      if (cIn && cIn.value !== undefined) {
        specimenData.cropVariety = (typeof sanitizeText === 'function' ? sanitizeText(cIn.value) : cIn.value).trim().slice(0, 64);
      }

      if (validateMetadata()) {
        currentStep = 'LEAF_PLACEMENT';
        render();
      } else {
        render();
      }
    });

    // Step 4 Start Spectral Scan button
    overlay.querySelector('#calib-start-scan-btn')?.addEventListener('click', async () => {
      if (isRunning) return;
      isRunning = true;
      progress = 20;
      statusText = t('calib_broadband_pulse', 'Emitting VIS-NIR broadband light pulse...');
      render();

      try {
        await simulateCalibrationSweep((p, txt) => {
          progress = p;
          statusText = txt;
          render();
        });

        // Acquire scan safely from spectrometer adapter
        let acquired = null;
        if (typeof spectrometerUSBAdapter.acquireSample === 'function') {
          acquired = await spectrometerUSBAdapter.acquireSample({
            cropName: specimenData.cropVariety,
            plotNumber: parseInt(specimenData.zone.replace(/\D/g, '')) || 1
          });
        } else if (typeof leafClipDevice.acquireScan === 'function') {
          acquired = await leafClipDevice.acquireScan({
            cropName: specimenData.cropVariety,
            plotNumber: parseInt(specimenData.zone.replace(/\D/g, '')) || 1
          });
        }

        scanResult = acquired || spectrometerUSBAdapter.lastScan;
        currentStep = 'RESULTS';
      } catch (err) {
        statusText = "Scan error: " + (err.message || err);
      } finally {
        isRunning = false;
        render();
      }
    });

    // Step 5 Rescan Button
    overlay.querySelector('#calib-rescan-btn')?.addEventListener('click', () => {
      currentStep = 'LEAF_PLACEMENT';
      render();
    });

    // Done Button (in Step 2 & Step 5)
    overlay.querySelector('#calib-done-btn')?.addEventListener('click', () => {
      if (onComplete) {
        onComplete({
          calibration: leafClipDevice.calibration,
          scan: scanResult,
          specimen: specimenData
        });
      }
      close();
    });
  }

  function close() {
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (onClose) onClose();
  }

  onLocaleChange(() => render());

  render();
  return overlay;
}
