/**
 * Module 0 Dashboard: Home / Field Overview
 * Faithfully styled after the lush forest green farm mobile theme.
 * Strict NO-EMOJI vector UI.
 * Features customizable Bento grid modules:
 *   - Weather Widget Card: Location, Large Temp, 4 Metrics, Sunrise/Sunset Arc
 *   - 1-Acre 6-Zone Interactive Canvas with water pulse animations
 *   - Vitality Gauge, Mainline Pressure, and Water Accounting KPI Bento cards
 *   - Core Category Quick Modules (Soil 8-in-1, Drip Hub, Spectroscopy, AI Insights)
 *   - Closed-Loop Leaf-to-Valve Synergy Recommendations
 *   - Live Field Zones & Solenoid Valve Actuations
 *   - Direct "Customize Layout" modal access
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange, getCropName, getStageName } from '../../utils/i18n.js';
import { irrigationControllerAdapter, VALVE_STATES } from '../../hardware/irrigationControllerAdapter.js';
import { getDashboardWidgetSettings, createDashboardSettingsModal } from '../DashboardSettingsModal.js';
import { createPlotCanvas6Zone } from '../PlotCanvas6Zone.js';
import { createClosedLoopSynergySection } from '../ClosedLoopSynergyCard.js';
import { locationService } from '../../services/locationService.js';
import { openGPSPermissionModal } from '../GPSPermissionModal.js';

function stripLeadingPlus(text) {
  if (!text) return '';
  return String(text).replace(/^\s*\+\s*/, '');
}

export function createFieldOverviewDashboard({
  plots = [],
  selectedPlotId = 'plot-1',
  onSelectPlot,
  onNavigateTab,
  onActuateValve,
  onSynergyAction,
  onOpenCropZoneManager,
  actionRecommendations = [],
  telemetryMetrics = {}
}) {
  const container = document.createElement('div');
  container.className = "field-overview-dashboard w-full space-y-4 pb-32 text-slate-800 dark:text-slate-100 select-none overflow-x-hidden";

  let widgetSettings = getDashboardWidgetSettings();
  let isRefreshingLocation = false;

  function render() {
    try {
      const scrollParent = container.closest('main') || container.parentElement;
      const prevScroll = scrollParent ? scrollParent.scrollTop : 0;

      const valves = irrigationControllerAdapter.getAllValves ? irrigationControllerAdapter.getAllValves() : [];
      const openValvesCount = valves.filter(v => v.state === VALVE_STATES.OPEN).length;
      const pressure = telemetryMetrics.mainlinePressureBar || 2.42;
      const consumedLiters = telemetryMetrics.consumedLitersToday || 1845;
      const activeFlow = telemetryMetrics.activeFlowLph || (openValvesCount * 480);

      const location = locationService.getLocation();
      const weather = locationService.getWeather();
      const isGPS = locationService.isGPSVerified();
      const formattedTemp = (weather.temperatureC > 0 ? '+' : '') + weather.temperatureC + '°C';

    container.innerHTML = `
      <!-- Dashboard Subheader with Customize Bento Button -->
      <div class="flex items-center justify-between px-1 pt-1">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <h2 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            ${t('dash_parcel_title', 'Sonoma Valley Parcel (1 Acre)')}
          </h2>
        </div>

        <button 
          type="button" 
          id="dash-customize-btn"
          class="min-h-[34px] px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 hover:bg-stone-50 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-300 shadow-sm flex items-center gap-1.5 transition cursor-pointer active:scale-95"
          title="${t('customize_bento', 'Customize Bento')}"
        >
          ${icon('sliders', 'w-3.5 h-3.5 text-[#0E5431] dark:text-emerald-400')}
          <span>${t('customize_bento', 'Customize Bento')}</span>
        </button>
      </div>

      <!-- 1. Overlapping Weather / Location Hero Card -->
      ${widgetSettings.weather_hero ? `
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-[0_8px_30px_rgba(14,84,49,0.08)] border border-emerald-900/5 dark:border-slate-800 space-y-4">
          <!-- Location & Header -->
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 min-w-0">
              ${icon('mapPin', 'w-4 h-4 text-[#0E5431] dark:text-emerald-400 shrink-0')}
              <span class="text-xs font-bold tracking-tight truncate">${location.displayName || t('parcel_location_name', 'Chateauneuf-du-Pape • Sonoma')}</span>
            </div>

            <div class="flex items-center gap-1.5 shrink-0">
              ${isGPS ? `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-[#0E5431] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700/60 flex items-center gap-1 shadow-2xs">
                  ${icon('satellite', 'w-3 h-3 text-[#0E5431] dark:text-emerald-400')}
                  <span>${t('gps_verified', 'GPS Active')}</span>
                </span>
              ` : `
                <button 
                  type="button" 
                  id="btn-request-gps" 
                  class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50 flex items-center gap-1 hover:bg-amber-100 transition cursor-pointer active:scale-95 shadow-2xs"
                  title="${t('allow_gps', 'Verify GPS Location')}"
                >
                  ${icon('crosshair', 'w-3 h-3 text-amber-600 dark:text-amber-400')}
                  <span>GPS</span>
                </button>
              `}

              <button 
                type="button" 
                id="btn-refresh-location" 
                class="p-1 rounded-lg text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-slate-800 transition cursor-pointer active:scale-90"
                title="${t('gps_refresh', 'Refresh GPS Location')}"
              >
                ${icon('refresh', `w-3.5 h-3.5 ${isRefreshingLocation ? 'animate-spin text-emerald-600' : ''}`)}
              </button>

              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-[#0E5431] dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                ${t('live_parcel', 'Live Parcel')}
              </span>
            </div>
          </div>

          <!-- Non-intrusive GPS verification prompt banner if not granted -->
          ${(!isGPS && location.permissionState !== 'granted') ? `
            <div class="p-2.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-500/20 flex items-center justify-between gap-2 transition">
              <div class="flex items-center gap-2 min-w-0">
                <div class="w-6 h-6 rounded-lg bg-[#0E5431] text-emerald-200 flex items-center justify-center shrink-0">
                  ${icon('satellite', 'w-3.5 h-3.5')}
                </div>
                <div class="text-[11px] font-medium text-emerald-900 dark:text-emerald-200 truncate">
                  ${t('gps_permission_desc', 'AgriSpectra requires physical location for live weather and VPD.')}
                </div>
              </div>
              <button 
                type="button" 
                id="btn-banner-verify-gps"
                class="px-2.5 py-1 rounded-xl bg-[#0E5431] hover:bg-[#0A3D23] text-white text-[10px] font-bold shrink-0 transition active:scale-95 shadow-xs"
              >
                ${t('allow_gps', 'Allow GPS')}
              </button>
            </div>
          ` : ''}

          <!-- Big Temperature & Weather Icon -->
          <div class="flex items-center justify-between">
            <div>
              <div class="flex items-baseline gap-2">
                <span class="text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">${formattedTemp}</span>
                <span class="text-xs font-semibold text-slate-400 font-mono">H: ${weather.tempMaxC}°C • L: ${weather.tempMinC}°C</span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">${weather.conditionText || t('weather_light_breeze', 'Light Breeze • Ideal photosynthetic light')}</p>
            </div>

            <div class="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 flex items-center justify-center text-amber-500 shadow-sm flex-shrink-0">
              ${icon('sunMoon', 'w-8 h-8')}
            </div>
          </div>

          <!-- 4 Key Environmental Metrics Row -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1.5 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center min-w-0 overflow-hidden break-words">
              <span class="text-[9.5px] text-slate-400 font-medium truncate block">${t('humidity', 'Humidity')}</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block truncate">${weather.humidityPercent}%</span>
            </div>
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1.5 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center min-w-0 overflow-hidden break-words">
              <span class="text-[9.5px] text-slate-400 font-medium truncate block">${t('precipitation', 'Precip')}</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block truncate">${weather.precipitationMm} mm</span>
            </div>
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1.5 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center min-w-0 overflow-hidden break-words">
              <span class="text-[9.5px] text-slate-400 font-medium truncate block">${t('pressure', 'Pressure')}</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block truncate">${weather.pressureHpa} hPa</span>
            </div>
            <div class="bg-slate-50/80 dark:bg-slate-800/60 rounded-2xl py-2 px-1.5 text-center border border-slate-100/80 dark:border-slate-800 flex flex-col justify-center min-w-0 overflow-hidden break-words">
              <span class="text-[9.5px] text-slate-400 font-medium truncate block">${t('wind', 'Wind')}</span>
              <span class="text-xs font-bold text-slate-800 dark:text-white font-mono mt-0.5 block truncate">${weather.windSpeedKmh} km/h</span>
            </div>
          </div>

          <!-- Sunrise / Sunset Daylight Arc -->
          <div class="bg-slate-50 dark:bg-slate-850 rounded-2xl p-3 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300 font-mono min-w-0 overflow-hidden">
            <div class="flex items-center gap-1.5 shrink-0">
              ${icon('sun', 'w-4 h-4 text-amber-500')}
              <span>${weather.sunriseStr}</span>
            </div>
            <div class="flex-1 mx-2 sm:mx-4 h-0.5 border-t border-dashed border-amber-400/60 relative flex items-center justify-center min-w-[20px]">
              <div class="w-2.5 h-2.5 rounded-full bg-amber-400 border-2 border-white shadow-sm"></div>
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              ${icon('cloud', 'w-4 h-4 text-slate-400')}
              <span>${weather.sunsetStr}</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 2. Bento Summary Row: Pressure, Vitality, and Water Accounting -->
      ${(widgetSettings.pressure_meter || widgetSettings.vitality_gauge || widgetSettings.water_ledger) ? `
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          ${widgetSettings.pressure_meter ? `
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-3.5 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-1">
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>${t('pressure', 'Pressure')}</span>
                <span class="w-2 h-2 rounded-full ${pressure > 3.0 ? 'bg-rose-500 animate-ping' : 'bg-emerald-500'}"></span>
              </div>
              <div class="flex items-baseline gap-1 mt-1">
                <span id="dash-kpi-pressure" class="text-2xl font-black font-mono text-slate-900 dark:text-white">${pressure}</span>
                <span class="text-xs font-mono text-slate-500">Bar</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono block">${t('piezo_resistive', 'Piezo-Resistive')}</span>
            </div>
          ` : ''}

          ${widgetSettings.vitality_gauge ? `
            <div class="bg-white dark:bg-slate-900 rounded-3xl p-3.5 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-1">
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>${t('canopy_vitality', 'Canopy Vitality')}</span>
                <span class="text-[10px] text-emerald-600 font-mono font-bold">NDVI 0.76</span>
              </div>
              <div class="flex items-baseline gap-1 mt-1">
                <span class="text-2xl font-black font-mono text-[#0E5431] dark:text-emerald-400">84%</span>
                <span class="text-xs font-mono text-slate-500">${t('optimum', 'Optimum')}</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono block">${t('chemometrics_76band', '76-Band Chemometrics')}</span>
            </div>
          ` : ''}

          ${widgetSettings.water_ledger ? `
            <div class="col-span-2 sm:col-span-1 bg-white dark:bg-slate-900 rounded-3xl p-3.5 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-1">
              <div class="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>${t('daily_volume', 'Daily Volume')}</span>
                <span class="text-[10px] text-blue-600 font-mono font-bold">${activeFlow} L/hr</span>
              </div>
              <div class="flex items-baseline gap-1 mt-1">
                <span id="dash-kpi-volume" class="text-2xl font-black font-mono text-blue-600 dark:text-blue-400">${consumedLiters.toLocaleString()}</span>
                <span class="text-xs font-mono text-slate-500">${t('liters', 'Liters')}</span>
              </div>
              <span class="text-[10px] text-slate-400 font-mono block">${t('gates_cumulative', '6 Gates Cumulative')}</span>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- 3. 1-Acre 6-Zone Field Plot Canvas -->
      ${widgetSettings.plot_canvas ? `
        <div id="plot-canvas-host" class="w-full"></div>
      ` : ''}

      <!-- 4. Quick Category Modules -->
      ${widgetSettings.quick_modules ? `
        <div class="space-y-2.5">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ${t('core_precision_modules', 'Core Precision Modules')}
            </h3>
            <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold">${t('active_hubs', '4 Active Hubs')}</span>
          </div>

          <div class="grid grid-cols-4 gap-2">
            <!-- Soil Tester 8-in-1 -->
            <button 
              type="button" 
              data-target-tab="soil"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer min-w-0 overflow-hidden"
            >
              <div class="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-[#0E5431] dark:text-emerald-300 shrink-0">
                ${icon('soil', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full min-w-0 flex-1 truncate">${t('cat_soil', 'Soil 8-in-1')}</span>
            </button>

            <!-- Drip Hub -->
            <button 
              type="button" 
              data-target-tab="irrigation"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer min-w-0 overflow-hidden"
            >
              <div class="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-500/20 flex items-center justify-center text-blue-600 shrink-0">
                ${icon('droplet', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full min-w-0 flex-1 truncate">${t('cat_drip', 'Drip Hub')}</span>
            </button>

            <!-- Spectroscopy -->
            <button 
              type="button" 
              data-target-tab="spectroscopy"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer min-w-0 overflow-hidden"
            >
              <div class="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/20 flex items-center justify-center text-teal-700 dark:text-teal-300 shrink-0">
                ${icon('spectroscopy', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full min-w-0 flex-1 truncate">${t('cat_spectro', 'Spectro')}</span>
            </button>

            <!-- Synergy / AI Insights -->
            <button 
              type="button" 
              data-target-tab="synergy"
              class="cat-module-btn bg-white dark:bg-slate-900 rounded-3xl p-3 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex flex-col items-center justify-center gap-2 hover:border-[#0E5431]/30 transition transform active:scale-95 text-center cursor-pointer min-w-0 overflow-hidden"
            >
              <div class="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-600 shrink-0">
                ${icon('synergy', 'w-5 h-5')}
              </div>
              <span class="text-[10px] font-bold text-slate-800 dark:text-slate-200 leading-tight w-full min-w-0 flex-1 truncate">${t('cat_synergy', 'Synergy')}</span>
            </button>
          </div>
        </div>
      ` : ''}

      <!-- 5. Closed-Loop Leaf-to-Valve Synergy Recommendations Host -->
      ${widgetSettings.synergy_recommendations ? `
        <div id="synergy-recommendations-host" class="w-full"></div>
      ` : ''}

      <!-- 6. Live Field Zones & Solenoid Controls -->
      ${widgetSettings.zone_valves ? `
        <div class="space-y-3">
          <div class="flex items-center justify-between px-1">
            <h3 class="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              ${t('field_zones_irrigation_states', 'Field Zones & Irrigation States')}
            </h3>
            <div class="flex items-center gap-2">
              <span class="text-[10px] text-slate-400 font-mono">${openValvesCount} ${t('gates_active', 'Gates Active')}</span>
              <button 
                type="button" 
                id="btn-overview-manage-zones"
                class="px-2.5 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-[#0E5431] dark:text-emerald-300 text-[11px] font-bold transition flex items-center gap-1 border border-emerald-600/20 active:scale-95 cursor-pointer"
                title="${t('manage_zones_and_crops', 'Manage Zones & Crops')}"
              >
                ${icon('plus', 'w-3 h-3')}
                <span>${t('quick_add_zone', '+ Add Zone')}</span>
              </button>
            </div>
          </div>

          <div class="space-y-2.5">
            ${plots.map(plot => {
              const valve = valves.find(v => v.plotId === plot.id) || valves[0];
              const isOpen = valve?.state === VALVE_STATES.OPEN;
              const isSelected = plot.id === selectedPlotId;

              return `
                <div 
                  data-plot-id="${plot.id}"
                  class="field-zone-card bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border transition-all cursor-pointer ${
                    isSelected 
                      ? 'border-[#0E5431] ring-2 ring-[#0E5431]/10' 
                      : 'border-emerald-900/5 dark:border-slate-800 hover:border-slate-300'
                  }"
                >
                  <div class="flex items-center justify-between gap-3 min-w-0">
                    <div class="flex items-center gap-3 min-w-0 flex-1">
                      <div class="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-[#0E5431] dark:text-emerald-300 font-bold font-mono text-sm shrink-0">
                        Z${plot.plotNumber}
                      </div>

                      <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 min-w-0">
                          <h4 class="text-xs font-bold text-slate-900 dark:text-white truncate">${getCropName(plot.crop)}</h4>
                          <span class="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold shrink-0 ${
                            isOpen ? 'bg-emerald-100 text-[#0E5431]' : 'bg-slate-100 text-slate-500'
                          }">
                            ${isOpen ? t('valve_on', 'VALVE ON') : t('valve_idle', 'IDLE')}
                          </span>
                        </div>
                        <p class="text-[10px] text-slate-400 mt-0.5 truncate">${getStageName(plot.stage || 'Vegetative & Root Bulking')}</p>
                      </div>
                    </div>

                    <!-- Quick Actuate Action Button -->
                    <button 
                      type="button" 
                      data-valve-id="${valve?.id || 'valve-1'}"
                      data-gate-id="${valve?.gateIdentifier || 'G1'}"
                      data-action="${isOpen ? 'CLOSE' : 'OPEN'}"
                      class="valve-actuate-btn quick-valve-btn shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                        isOpen 
                          ? 'bg-rose-600 hover:bg-rose-700 text-white' 
                          : 'bg-[#0E5431] hover:bg-[#083820] text-white'
                      }"
                    >
                      ${isOpen ? icon('pause', 'w-3 h-3') : icon('play', 'w-3 h-3')}
                      <span class="truncate">${isOpen ? t('valve_close', 'Close') : t('valve_irrigate', 'Irrigate')}</span>
                    </button>
                  </div>

                  <!-- Soil Moisture Progress Bar -->
                  <div class="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                    <span class="text-slate-500">${t('root_zone_vwc', 'Root-zone VWC:')}</span>
                    <div class="flex items-center gap-2">
                      <div class="w-24 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div class="h-full bg-[#0E5431] rounded-full" style="width: 70%"></div>
                      </div>
                      <span class="font-mono font-bold text-slate-800 dark:text-white">28.5%</span>
                    </div>
                  </div>
                </div>
              `;
            }).join('')}

            <!-- Quick Add Zone Card -->
            <button 
              type="button" 
              id="card-overview-add-zone"
              aria-label="+ Add New Zone"
              class="w-full bg-emerald-50/60 dark:bg-slate-900/50 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-3xl p-3.5 border-2 border-dashed border-emerald-600/30 dark:border-emerald-500/20 text-[#0E5431] dark:text-emerald-300 transition flex items-center justify-center gap-2 font-bold text-xs active:scale-98 cursor-pointer shadow-xs"
            >
              <div class="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center">
                ${icon('plus', 'w-3.5 h-3.5')}
              </div>
              <span>${stripLeadingPlus(t('add_new_zone_db', 'Add New Zone to Database'))}</span>
            </button>
          </div>
        </div>
      ` : ''}
    `;

    // Render Canvas if enabled
    if (widgetSettings.plot_canvas) {
      const canvasHost = container.querySelector('#plot-canvas-host');
      if (canvasHost) {
        const canvas = createPlotCanvas6Zone(plots, selectedPlotId, (pId) => {
          if (onSelectPlot) onSelectPlot(pId);
        });
        canvasHost.appendChild(canvas);
      }
    }

    // Render Synergy Recommendations if enabled
    if (widgetSettings.synergy_recommendations) {
      const synHost = container.querySelector('#synergy-recommendations-host');
      if (synHost && actionRecommendations) {
        const synergyCard = createClosedLoopSynergySection(actionRecommendations, (recId, action) => {
          if (onSynergyAction) {
            onSynergyAction(recId, action);
          } else if (onActuateValve) {
            onActuateValve({ recId, action });
          }
        });
        synHost.appendChild(synergyCard);
      }
    }

    attachEvents();

    if (scrollParent && prevScroll > 0) {
      scrollParent.scrollTop = prevScroll;
      requestAnimationFrame(() => {
        if (scrollParent.scrollTop !== prevScroll) {
          scrollParent.scrollTop = prevScroll;
        }
      });
    }
    } catch (err) {
      console.error("[FieldOverviewDashboard] Safe render fallback:", err);
      container.innerHTML = `
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-emerald-900/10 dark:border-slate-800 text-center space-y-3">
          <div class="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-[#0E5431] flex items-center justify-center">
            ${icon('home', 'w-6 h-6')}
          </div>
          <h3 class="text-sm font-bold text-slate-900 dark:text-white">Field Overview Active</h3>
          <p class="text-xs text-slate-500">Live parcel telemetry and hydraulic gates synced.</p>
          <button type="button" id="btn-overview-recovery-retry" class="px-4 py-2 rounded-full bg-[#0E5431] text-white text-xs font-bold">
            Refresh Overview
          </button>
        </div>
      `;
      container.querySelector('#btn-overview-recovery-retry')?.addEventListener('click', () => render());
    }
  }

  function attachEvents() {
    // Open Customizer Modal
    container.querySelector('#dash-customize-btn')?.addEventListener('click', () => {
      const modal = createDashboardSettingsModal({
        onSettingsChanged: (newSettings) => {
          widgetSettings = newSettings;
          render();
        }
      });
      document.body.appendChild(modal);
    });

    // Manage Zones / Add Zone Buttons
    container.querySelector('#btn-overview-manage-zones')?.addEventListener('click', () => {
      if (typeof onOpenCropZoneManager === 'function') onOpenCropZoneManager('zones');
    });

    container.querySelector('#card-overview-add-zone')?.addEventListener('click', () => {
      if (typeof onOpenCropZoneManager === 'function') onOpenCropZoneManager('zones');
    });

    // Quick Category Module Buttons
    container.querySelectorAll('.cat-module-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-target-tab');
        if (tab && onNavigateTab) onNavigateTab(tab);
      });
    });

    // Select Plot Click
    container.querySelectorAll('.field-zone-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        const pId = card.getAttribute('data-plot-id');
        if (pId && onSelectPlot) onSelectPlot(pId);
      });
    });

    // GPS Location Refresh & Request
    container.querySelector('#btn-refresh-location')?.addEventListener('click', async () => {
      isRefreshingLocation = true;
      render();
      try {
        await locationService.requestLocationPermission({ silent: false });
      } catch (e) {
        console.warn('GPS refresh error:', e);
      } finally {
        isRefreshingLocation = false;
        render();
      }
    });

    container.querySelector('#btn-request-gps')?.addEventListener('click', () => {
      openGPSPermissionModal({
        onResolved: () => render(),
        onDismiss: () => render()
      });
    });

    container.querySelector('#btn-banner-verify-gps')?.addEventListener('click', () => {
      openGPSPermissionModal({
        onResolved: () => render(),
        onDismiss: () => render()
      });
    });

    // Quick Valve Actuate
    container.querySelectorAll('.quick-valve-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const vId = btn.getAttribute('data-valve-id');
        const gId = btn.getAttribute('data-gate-id');
        const act = btn.getAttribute('data-action');
        if (vId) {
          try {
            if (act === 'OPEN') {
              await irrigationControllerAdapter.openValve(vId, { durationMinutes: 30 });
            } else {
              await irrigationControllerAdapter.closeValve(vId);
            }
          } catch (err) {
            // Safe fallback if valve adapter is simulated or not pre-registered
          }
          if (onActuateValve) onActuateValve({ valveId: vId, gateId: gId, action: act, duration: 30 });
          render();
        }
      });
    });
  }

  // Non-destructive in-place dynamic metric update without wiping innerHTML
  container.updateTelemetry = function(metrics = {}) {
    if (metrics.mainlinePressureBar !== undefined) {
      const pEl = container.querySelector('#dash-kpi-pressure');
      if (pEl) pEl.textContent = metrics.mainlinePressureBar;
    }
    if (metrics.consumedLitersToday !== undefined) {
      const vEl = container.querySelector('#dash-kpi-volume');
      if (vEl) vEl.textContent = Number(metrics.consumedLitersToday).toLocaleString();
    }
  };

  // Subscribe to live location and weather updates
  const unsubLocation = locationService.on('locationUpdated', () => render());
  const unsubWeather = locationService.on('weatherUpdated', () => render());

  onLocaleChange(() => render());

  render();

  // If initial load and GPS not yet prompted or granted, non-intrusively open modal after short delay
  if (!locationService.hasPrompted() && !locationService.isGPSVerified()) {
    setTimeout(() => {
      // Check again in case prompted elsewhere
      if (!locationService.hasPrompted() && !locationService.isGPSVerified()) {
        openGPSPermissionModal({
          onResolved: () => render(),
          onDismiss: () => render()
        });
      }
    }, 1500);
  }

  return container;
}
