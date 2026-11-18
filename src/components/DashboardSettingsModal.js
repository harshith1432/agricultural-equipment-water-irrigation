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
 */
import { icon } from '../utils/icons.js';

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

  const WIDGET_DEFINITIONS = [
    {
      id: 'weather_hero',
      name: 'Weather & Sunlight Arc Hero',
      desc: 'Ambient temperature, humidity, wind, and daylight sunrise/sunset arc.',
      icon: 'sun'
    },
    {
      id: 'plot_canvas',
      name: '1-Acre 6-Zone Plot Canvas',
      desc: 'Interactive 2x3 field layout with live water ripples and soil moisture heatmaps.',
      icon: 'mapPin'
    },
    {
      id: 'vitality_gauge',
      name: 'Crop Vitality Speedometer Gauge',
      desc: 'Canopy health vitality meter (5–100%) and NDVI vegetative condition.',
      icon: 'gauge'
    },
    {
      id: 'pressure_meter',
      name: 'Mainline Pressure Transducer',
      desc: 'Real-time piezo-resistive line pressure (Bar & PSI) and overpressure surge alerts.',
      icon: 'activity'
    },
    {
      id: 'water_ledger',
      name: 'Daily Water Volume Ledger',
      desc: 'Instantaneous flow rate (L/hr) and cumulative liters delivered today.',
      icon: 'droplet'
    },
    {
      id: 'quick_modules',
      name: 'Core Category Hubs',
      desc: '4-Card quick launcher for Soil 8-in-1, Drip Hub, Spectroscopy, and AI.',
      icon: 'layers'
    },
    {
      id: 'synergy_recommendations',
      name: 'Closed-Loop Synergy Recommendations',
      desc: 'Autonomous Leaf-to-Valve action cards triggered by water stress detection.',
      icon: 'synergy'
    },
    {
      id: 'zone_valves',
      name: 'Field Zone Solenoid Controls',
      desc: 'Direct valve quick-irrigate buttons and root-zone moisture progress bars.',
      icon: 'power'
    }
  ];

  function render() {
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
              <h2 class="text-base font-bold text-white tracking-tight">Dashboard Bento Customizer</h2>
              <p class="text-[11px] text-emerald-200/80">Configure visible cards on your farm overview</p>
            </div>
          </div>

          <div class="mt-3 pt-2 border-t border-emerald-700/50 flex items-center justify-between text-xs text-emerald-200">
            <span>Enabled Cards: <strong class="text-white">${activeCount} of ${WIDGET_DEFINITIONS.length}</strong></span>
            <button type="button" id="reset-defaults-btn" class="text-emerald-300 hover:text-white font-bold underline cursor-pointer text-[11px]">
              Reset Defaults
            </button>
          </div>
        </div>

        <!-- Scrollable List of Widget Toggles -->
        <div class="p-5 max-h-[60vh] overflow-y-auto space-y-2.5">
          ${WIDGET_DEFINITIONS.map(widget => {
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
            Cancel
          </button>

          <button 
            type="button" 
            id="modal-save-btn"
            class="min-h-[42px] px-5 py-2 rounded-xl text-xs font-bold bg-[#0E5431] hover:bg-[#093d23] text-white shadow-md shadow-emerald-950/20 transition cursor-pointer active:scale-95"
          >
            Save Layout
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

  render();
  return overlay;
}
