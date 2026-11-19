/**
 * GPSPermissionModal Component
 * Farmer-friendly GPS location verification modal.
 * Styled in the Forest Cream theme (#F7F4EB oat cream, #0E5431 emerald green, #12301A dark green).
 * 
 * Provides clear agronomic value proposition:
 *   1. Hyper-Local Atmospheric Weather (Open-Meteo)
 *   2. Evapotranspiration & VPD Tuning (Leaf & Soil closed loop)
 *   3. Device-Only Privacy Guarantee
 */

import { icon } from '../utils/icons.js';
import { t } from '../utils/i18n.js';
import { locationService } from '../services/locationService.js';

export function createGPSPermissionModal({ onResolved, onDismiss } = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'gps-permission-modal-overlay';
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm transition-opacity duration-300 animate-fadeIn";

  const modal = document.createElement('div');
  modal.className = "w-full max-w-md bg-[#F7F4EB] dark:bg-slate-900 rounded-[28px] p-6 shadow-2xl border border-[#0E5431]/20 dark:border-slate-800 text-slate-800 dark:text-slate-100 space-y-5 transform transition-all duration-300 scale-100 max-h-[92vh] overflow-y-auto no-scrollbar";

  function renderContent(state = { isLoading: false, error: null, success: false }) {
    modal.innerHTML = `
      <!-- Modal Header -->
      <div class="flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-[#0E5431] text-emerald-100 flex items-center justify-center shadow-md shadow-[#0E5431]/20 shrink-0">
            ${icon('satellite', 'w-6 h-6 text-emerald-300')}
          </div>
          <div>
            <h2 class="text-base font-black text-[#12301A] dark:text-emerald-400 tracking-tight leading-snug">
              ${t('gps_permission_title', 'GPS Location Verification')}
            </h2>
            <p class="text-[11px] font-semibold text-emerald-800/80 dark:text-emerald-500/90 font-mono">
              Precise Farm Coordinates
            </p>
          </div>
        </div>

        <button 
          type="button"
          id="btn-close-gps-modal"
          class="w-8 h-8 rounded-full bg-stone-200/60 dark:bg-slate-800 hover:bg-stone-300/60 text-slate-500 hover:text-slate-700 dark:text-slate-400 flex items-center justify-center transition"
          aria-label="Close"
        >
          ${icon('x', 'w-4 h-4')}
        </button>
      </div>

      <!-- Value Proposition Body -->
      <p class="text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
        ${t('gps_permission_desc', 'AgriSpectra requires your physical location to retrieve live local temperature, relative humidity, solar radiation, and irrigation evapotranspiration (VPD) for your crops.')}
      </p>

      <!-- 3 Agronomic Explanatory Cards -->
      <div class="space-y-2.5">
        <!-- Feature 1 -->
        <div class="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-emerald-900/10 dark:border-slate-700/60 shadow-xs">
          <div class="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
            ${icon('satellite', 'w-4 h-4')}
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">
              ${t('gps_hyperlocal_title', 'Hyper-Local Atmospheric Weather')}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
              ${t('gps_hyperlocal_desc', 'Exact hourly temperature & humidity from Open-Meteo.')}
            </p>
          </div>
        </div>

        <!-- Feature 2 -->
        <div class="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-emerald-900/10 dark:border-slate-700/60 shadow-xs">
          <div class="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0 mt-0.5">
            ${icon('droplet', 'w-4 h-4')}
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">
              ${t('gps_vpd_title', 'Evapotranspiration & VPD Tuning')}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
              ${t('gps_vpd_desc', 'Precision closed-loop leaf & soil irrigation calculations.')}
            </p>
          </div>
        </div>

        <!-- Feature 3 -->
        <div class="flex items-start gap-3 p-3 rounded-2xl bg-white dark:bg-slate-800/80 border border-emerald-900/10 dark:border-slate-700/60 shadow-xs">
          <div class="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
            ${icon('shieldCheck', 'w-4 h-4')}
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">
              ${t('gps_privacy_title', 'Privacy Guarantee')}
            </h4>
            <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-normal mt-0.5">
              ${t('gps_privacy_desc', 'Coordinates stay on your device and are never shared or tracked.')}
            </p>
          </div>
        </div>
      </div>

      <!-- Error / Instructions Alert (if permission denied) -->
      ${state.error ? `
        <div class="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300 space-y-1.5 animate-fadeIn">
          <div class="flex items-center gap-2">
            ${icon('alert', 'w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0')}
            <span class="text-xs font-bold">${t('gps_not_granted', 'GPS Permission Needed')}</span>
          </div>
          <p class="text-[11px] leading-relaxed text-rose-700 dark:text-rose-300/90">
            ${t('gps_enable_help', 'Please enable location in phone settings or browser permissions to use live microclimate data.')}
          </p>
          <div class="text-[10px] text-rose-600 dark:text-rose-400/80 font-mono">
            Error: ${state.error}
          </div>
        </div>
      ` : ''}

      <!-- Success State -->
      ${state.success ? `
        <div class="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-[#0E5431] dark:text-emerald-300 flex items-center gap-2.5 animate-fadeIn">
          ${icon('check', 'w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0')}
          <div class="min-w-0">
            <div class="text-xs font-bold">${t('gps_verified', 'GPS Active')}</div>
            <div class="text-[11px] text-emerald-700 dark:text-emerald-400/90 truncate">${locationService.getLocation().displayName}</div>
          </div>
        </div>
      ` : ''}

      <!-- Action Buttons -->
      <div class="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
        <button 
          type="button" 
          id="btn-allow-gps"
          class="w-full sm:flex-1 py-3 px-4 rounded-2xl bg-[#0E5431] hover:bg-[#0A3D23] active:bg-[#072B18] text-white text-xs font-bold shadow-md shadow-[#0E5431]/20 flex items-center justify-center gap-2 transition cursor-pointer active:scale-98 disabled:opacity-60 disabled:cursor-not-allowed"
          ${state.isLoading ? 'disabled' : ''}
        >
          ${state.isLoading ? `
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>${t('detecting_location', 'Detecting GPS...')}</span>
          ` : `
            ${icon('navigation', 'w-4 h-4 text-emerald-200')}
            <span>${t('allow_gps', 'Allow GPS Location')}</span>
          `}
        </button>

        <button 
          type="button" 
          id="btn-dismiss-gps"
          class="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white dark:bg-slate-800 hover:bg-stone-100 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 text-xs font-semibold border border-slate-200 dark:border-slate-700 transition cursor-pointer active:scale-98"
        >
          ${t('gps_default_later', 'Use Default / Later')}
        </button>
      </div>
    `;

    bindEvents();
  }

  function dismiss() {
    locationService.setPrompted();
    overlay.classList.add('opacity-0');
    setTimeout(() => {
      overlay.remove();
      if (typeof onDismiss === 'function') onDismiss();
    }, 200);
  }

  function bindEvents() {
    modal.querySelector('#btn-close-gps-modal')?.addEventListener('click', dismiss);
    modal.querySelector('#btn-dismiss-gps')?.addEventListener('click', dismiss);

    modal.querySelector('#btn-allow-gps')?.addEventListener('click', async () => {
      renderContent({ isLoading: true, error: null, success: false });

      const res = await locationService.requestLocationPermission({ silent: false });

      if (res.success) {
        renderContent({ isLoading: false, error: null, success: true });
        setTimeout(() => {
          overlay.classList.add('opacity-0');
          setTimeout(() => {
            overlay.remove();
            if (typeof onResolved === 'function') onResolved(res);
          }, 200);
        }, 1200);
      } else {
        renderContent({ isLoading: false, error: res.error || 'Permission denied', success: false });
      }
    });
  }

  overlay.appendChild(modal);
  renderContent();

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });

  return overlay;
}

/**
 * Open the modal directly in document.body
 */
export function openGPSPermissionModal(options = {}) {
  const existing = document.getElementById('gps-permission-modal-overlay');
  if (existing) existing.remove();

  const modalEl = createGPSPermissionModal(options);
  document.body.appendChild(modalEl);
  return modalEl;
}
