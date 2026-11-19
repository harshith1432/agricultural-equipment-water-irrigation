/**
 * Dashboard Customization / Widget Settings Modal (DashboardSettingsModal.js)
 * Allows farmers to customize which Bento cards and telemetry widgets appear on their Dashboard:
 *   - 1-Acre 6-Zone Hierarchical Canvas
 *   - Mainline Pressure Transducer Meter
 *   - Crop Vitality Speedometer / Health Gauge
 *   - Daily Water Volume Accounting Ledger
 *   - Weather & Daylight Sunrise Arc Hero
 *   - Quick Category Navigation Hubs
 *   - Leaf-to-Valve Synergy Action Cards
 *   - Field Zone Valve Actuation Cards
 * Persists preferences in localStorage ('agrispectra_dashboard_widgets').
 * Fully localized across all 8 supported languages.
 */
import { icon } from '../utils/icons.js';
import { t, onLocaleChange } from '../utils/i18n.js';

export const DASHBOARD_WIDGETS_KEY = 'agrispectra_dashboard_widgets';

export const DEFAULT_WIDGET_CONFIG = {
  weather_hero: true,
  plot_canvas: true,
  vitality_gauge: true,
  pressure_meter: true,
  water_ledger: true,
  quick_modules: true,
  synergy_recommendations: true,
  zone_valves: true
};

export function getDashboardWidgetSettings() {
  try {
    const raw = localStorage.getItem(DASHBOARD_WIDGETS_KEY);
    if (raw) {
      return { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(raw) };
    }
  } catch (e) {}
  return { ...DEFAULT_WIDGET_CONFIG };
}

export function saveDashboardWidgetSettings(settings) {
  try {
    localStorage.setItem(DASHBOARD_WIDGETS_KEY, JSON.stringify(settings));
  } catch (e) {}
}

export function resetDashboardWidgetSettings() {
  try {
    localStorage.removeItem(DASHBOARD_WIDGETS_KEY);
  } catch (e) {}
  return { ...DEFAULT_WIDGET_CONFIG };
}

export function createDashboardSettingsModal({ onClose, onSettingsChanged }) {
  const overlay = document.createElement('div');
  overlay.id = "dashboard-settings-modal-overlay";
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-fadeIn select-none";

  let currentSettings = getDashboardWidgetSettings();

  function getWidgets() {
    return [
      {
        id: 'weather_hero',
        name: t('widget_weather_hero_title', 'Weather & Sunlight Arc Hero'),
        desc: t('widget_weather_hero_desc', 'Ambient temperature, humidity, wind, and daylight sunrise/sunset arc.'),
        icon: 'sun'
      },
      {
        id: 'plot_canvas',
        name: t('widget_plot_canvas_title', '1-Acre 6-Zone Plot Canvas'),
        desc: t('widget_plot_canvas_desc', 'Interactive 2x3 field layout with live water ripples and soil moisture heatmaps.'),
        icon: 'mapPin'
      },
      {
        id: 'vitality_gauge',
        name: t('widget_vitality_gauge_title', 'Crop Vitality Speedometer Gauge'),
        desc: t('widget_vitality_gauge_desc', 'Canopy health vitality meter (5–100%) and NDVI vegetative condition.'),
        icon: 'gauge'
      },
      {
        id: 'pressure_meter',
        name: t('widget_pressure_meter_title', 'Mainline Pressure Transducer'),
        desc: t('widget_pressure_meter_desc', 'Real-time piezo-resistive line pressure (Bar & PSI) and overpressure surge alerts.'),
        icon: 'activity'
      },
      {
        id: 'water_ledger',
        name: t('widget_water_ledger_title', 'Daily Water Volume Ledger'),
        desc: t('widget_water_ledger_desc', 'Instantaneous flow rate (L/hr) and cumulative liters delivered today.'),
        icon: 'droplet'
      },
      {
        id: 'quick_modules',
        name: t('widget_quick_modules_title', 'Core Category Hubs'),
        desc: t('widget_quick_modules_desc', '4-Card quick launcher for Soil 8-in-1, Drip Hub, Spectroscopy, and AI.'),
        icon: 'layers'
      },
      {
        id: 'synergy_recommendations',
        name: t('widget_synergy_recommendations_title', 'Closed-Loop Synergy Recommendations'),
        desc: t('widget_synergy_recommendations_desc', 'Autonomous Leaf-to-Valve action cards triggered by water stress detection.'),
        icon: 'synergy'
      },
      {
        id: 'zone_valves',
        name: t('widget_zone_valves_title', 'Field Zone Valve Controls'),
        desc: t('widget_zone_valves_desc', 'Individual hydraulic solenoid toggles, flow status pills, and root VWC bars.'),
        icon: 'power'
      }
    ];
  }

  function render() {
    const widgets = getWidgets();
    const activeCount = Object.values(currentSettings).filter(Boolean).length;

    overlay.innerHTML = `
      <div class="relative w-full max-w-md my-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-3xl border border-emerald-900/10 dark:border-slate-800 shadow-2xl overflow-hidden transition-all duration-300">
        
        <!-- Header -->
        <div class="bg-gradient-to-br from-[#0E5431] to-[#0A3D23] text-white p-5 pb-4 relative">
          <button id="modal-close-btn" class="absolute top-4 right-4 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer" title="Close" aria-label="Close Customization Modal">
            ${icon('x', 'w-4 h-4 text-white')}
          </button>

          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-2xl bg-white/15 flex items-center justify-center text-emerald-300">
              ${icon('sliders', 'w-5 h-5')}
            </div>
            <div>
              <h2 class="text-base font-bold text-white tracking-tight">${t('customize_bento_title', 'Dashboard Bento Customizer')}</h2>
              <p class="text-[11px] text-emerald-200/80">${t('customize_bento_desc', 'Configure visible cards on your farm overview')}</p>
            </div>
          </div>

          <div class="mt-3 pt-2 border-t border-emerald-700/50 flex items-center justify-between text-xs text-emerald-200">
            <span>Enabled Cards: <strong class="text-white">${activeCount} of ${widgets.length}</strong></span>
            <button type="button" id="reset-defaults-btn" class="text-emerald-300 hover:text-white font-bold underline cursor-pointer text-[11px]">
              ${t('reset_defaults', 'Reset Defaults')}
            </button>
          </div>
        </div>

        <!-- Live Bento Layout Mini-Preview Grid -->
        <div class="px-5 pt-3 pb-2 bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800">
          <div class="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider mb-1.5">
            <span>Bento Layout Preview</span>
            <span class="text-emerald-600 font-bold">${activeCount} of 8 Active</span>
          </div>
          <div class="grid grid-cols-4 gap-1 p-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
            <div class="col-span-4 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.weather_hero ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('widget_weather_hero_title')}
            </div>
            <div class="col-span-2 h-6 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.pressure_meter ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 border border-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('pressure')}
            </div>
            <div class="col-span-2 h-6 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.vitality_gauge ? 'bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border border-teal-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('vitality_label', 'Vitality')}
            </div>
            <div class="col-span-4 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.water_ledger ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('widget_water_ledger_title')}
            </div>
            <div class="col-span-4 h-6 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.plot_canvas ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 border border-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('widget_plot_canvas_title')}
            </div>
            <div class="col-span-4 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.quick_modules ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('widget_quick_modules_title')}
            </div>
            <div class="col-span-4 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.synergy_recommendations ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('widget_synergy_recommendations_title')}
            </div>
            <div class="col-span-4 h-5 rounded-lg text-[9px] font-bold flex items-center justify-center transition-all ${currentSettings.zone_valves ? 'bg-emerald-100 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 border border-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 opacity-40'}">
              ${t('widget_zone_valves_title')}
            </div>
          </div>
        </div>

        <!-- Scrollable List of Widget Toggles -->
        <div class="p-5 max-h-[60vh] overflow-y-auto space-y-2.5">
          ${widgets.map(widget => {
            const isChecked = Boolean(currentSettings[widget.id]);
            return `
              <label class="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 cursor-pointer hover:border-emerald-500/40 transition">
                <div class="flex items-center gap-3 pr-2 min-w-0">
                  <div class="w-8 h-8 rounded-xl ${isChecked ? 'bg-emerald-100 text-[#0E5431] dark:bg-emerald-950 dark:text-emerald-300' : 'bg-slate-200 text-slate-400 dark:bg-slate-800'} flex items-center justify-center flex-shrink-0 transition">
                    ${icon(widget.icon, 'w-4 h-4')}
                  </div>
                  <div class="min-w-0">
                    <span class="text-xs font-bold text-slate-800 dark:text-white block truncate">${widget.name}</span>
                    <span class="text-[10px] text-slate-500 block leading-tight mt-0.5">${widget.desc}</span>
                  </div>
                </div>

                <!-- Custom Switch Input -->
                <div class="relative flex-shrink-0 ml-2">
                  <input 
                    type="checkbox" 
                    data-widget-id="${widget.id}"
                    class="widget-toggle-input sr-only" 
                    ${isChecked ? 'checked' : ''}
                  />
                  <div class="toggle-bg w-11 h-6 rounded-full transition-colors duration-200 ${isChecked ? 'bg-[#0E5431]' : 'bg-slate-300 dark:bg-slate-700'}"></div>
                  <div class="toggle-dot absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${isChecked ? 'transform translate-x-5' : ''}"></div>
                </div>
              </label>
            `;
          }).join('')}
        </div>

        <!-- Footer Actions -->
        <div class="p-4 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
          <button 
            type="button" 
            id="modal-cancel-btn"
            class="min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            ${t('dialog_cancel', 'Cancel')}
          </button>

          <button 
            type="button" 
            id="modal-save-btn"
            class="min-h-[42px] px-5 py-2 rounded-xl text-xs font-bold bg-[#0E5431] hover:bg-[#093d23] text-white shadow-md shadow-emerald-950/20 transition cursor-pointer active:scale-95"
          >
            ${t('save_layout', 'Save Layout')}
          </button>
        </div>

      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    overlay.querySelector('#modal-close-btn')?.addEventListener('click', close);
    overlay.querySelector('#modal-cancel-btn')?.addEventListener('click', close);

    overlay.querySelector('#reset-defaults-btn')?.addEventListener('click', () => {
      currentSettings = resetDashboardWidgetSettings();
      render();
    });

    overlay.querySelectorAll('.widget-toggle-input').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const id = checkbox.getAttribute('data-widget-id');
        if (id) {
          currentSettings[id] = e.target.checked;
          render();
        }
      });
    });

    overlay.querySelector('#modal-save-btn')?.addEventListener('click', () => {
      saveDashboardWidgetSettings(currentSettings);
      if (onSettingsChanged) onSettingsChanged(currentSettings);
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
