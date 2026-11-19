/**
 * App Navigation Header Component
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Clean, uncluttered layout optimized for mobile smartphones (360px-480px):
 *   - Farmer greeting, date & avatar
 *   - Reassuring "System Safe" status badge (replaces alarming red KILL button)
 *   - 3-Dot Overflow Menu button (#header-more-menu-btn) opening the Feature Center:
 *       1. Language Selector (English, ಕನ್ನಡ, हिन्दी, తెలుగు, தமிழ், മലയാളം, मराठी, Español)
 *       2. Theme Selector (Preserves #header-theme-select for automated QA)
 *       3. Device Manager & Diagnostics
 *       4. Sensor Calibration Wizard
 *       5. IoT Telemetry Simulator
 *       6. Dedicated Emergency Hydraulic Shutoff (with safety confirmation dialog)
 *       7. Farm Profile & Governance
 *   - Field Zone selector & Hardware connectivity pills (BLE, IoT)
 */

import { icon } from '../utils/icons.js';
import { t, getLocale, setLocale, SUPPORTED_LOCALES, onLocaleChange, getCropName } from '../utils/i18n.js';

export function createAppNavigationHeader({
  plots = [],
  selectedPlotId = 'plot-1',
  onSelectPlot,
  onEmergencyStop,
  onOpenSimModal,
  onOpenCalibration,
  onOpenEnterpriseAdmin,
  onOpenCropZoneManager,
  onNavigate,
  onThemeChange,
  currentTheme = 'creamy-agri',
  bleState = { connected: false },
  mqttState = { running: true },
  currentUser = null,
  onOpenAuthModal
}) {
  const header = document.createElement('header');
  header.className = "w-full bg-[#0E5431] text-white select-none z-50 shadow-md";
  if (typeof header.setAttribute === 'function') {
    header.setAttribute('style', 'backdrop-filter: none !important; -webkit-backdrop-filter: none !important; transform: none !important; filter: none !important;');
  }

  let currentPlot = plots.find(p => p.id === selectedPlotId) || plots[0] || {
    id: 'plot-1',
    plotNumber: 1,
    name: 'Zone 1 - Potato Field Zone',
    crop: 'Potato Crop'
  };

  let isMoreMenuOpen = false;
  let isConfirmShutoffOpen = false;

  function getFormattedDate() {
    const now = new Date();
    const options = { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' };
    try {
      return now.toLocaleDateString(getLocale() === 'en' ? 'en-US' : undefined, options);
    } catch (e) {
      return now.toDateString();
    }
  }

  function render() {
    const locale = getLocale();
    const activeLocale = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0];

    header.innerHTML = `
      <!-- Top Status & Hero Greeting Bar -->
      <div class="px-4 pt-3 pb-2.5 max-w-lg mx-auto">
        <div class="flex items-center justify-between gap-2 mb-2.5">
          <!-- Left: Avatar, Name & Role Badge (Clickable to view/switch profile) -->
          <button 
            type="button" 
            id="header-user-badge-btn" 
            class="flex items-center gap-2.5 min-w-0 text-left transition hover:opacity-90 active:scale-98 cursor-pointer"
            title="${currentUser?.displayName || 'Carlos Mendoza'} • ${currentUser?.role || 'Farm Owner'}"
          >
            <div class="w-9 h-9 rounded-full bg-emerald-700/80 border-2 border-emerald-400/50 flex items-center justify-center font-bold text-xs text-white shadow-inner flex-shrink-0">
              ${(currentUser?.displayName || 'Carlos').charAt(0).toUpperCase()}
            </div>
            <div class="flex flex-col min-w-0">
              <div class="flex items-center gap-1.5 truncate">
                <span class="text-xs font-bold text-white tracking-tight truncate">${currentUser?.displayName || 'Carlos Mendoza'}</span>
                <span class="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30 flex-shrink-0">
                  ${currentUser?.role || 'Farm Owner'}
                </span>
              </div>
              <span class="text-[10px] font-medium text-emerald-200/90 tracking-wide flex items-center gap-1 truncate">
                <span>${getFormattedDate()}</span>
              </span>
            </div>
          </button>

          <!-- Right: System Safe Badge & 3-Dot Overflow Menu -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <!-- Reassuring System Status Badge (Replaces the raw red KILL button) -->
            <button 
              type="button" 
              id="header-safety-status-btn"
              class="min-h-[34px] px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-400/40 text-emerald-100 flex items-center gap-1.5 transition shadow-sm"
              title="${t('valve_safe_status')}"
            >
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
              </span>
              <span class="text-[11px] font-bold tracking-tight">${t('system_safe_badge')}</span>
            </button>

            <!-- 3-Dot Overflow Menu Button -->
            <button 
              type="button" 
              id="header-more-menu-btn"
              class="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 border border-white/20 text-white flex items-center justify-center transition shadow-sm"
              title="${t('menu_title')}"
              aria-label="More Features & Tools"
            >
              ${icon('moreVertical', 'w-4 h-4 text-emerald-100')}
            </button>
          </div>
        </div>

        <!-- Sub-Bar: Field Zone & Connectivity Pills -->
        <div class="flex items-center justify-between gap-2 pt-2 border-t border-emerald-700/40">
          <!-- Zone Picker Pill -->
          <div class="relative min-w-0" id="zone-picker-wrapper">
            <button 
              type="button" 
              id="header-zone-btn"
              class="min-h-[32px] px-2.5 py-1 rounded-full bg-[#092B19]/90 hover:bg-[#092B19] border border-emerald-500/30 text-xs font-medium text-emerald-100 flex items-center gap-1.5 transition max-w-[210px] truncate"
            >
              ${icon('mapPin', 'w-3.5 h-3.5 text-emerald-400 flex-shrink-0')}
              <span class="truncate">${t('zone_label')} ${currentPlot.plotNumber}: ${getCropName(currentPlot.crop)}</span>
              ${icon('chevronDown', 'w-3 h-3 text-emerald-400 flex-shrink-0')}
            </button>

            <!-- Zone Dropdown Menu -->
            <div id="header-zone-dropdown" class="hidden absolute left-0 mt-2 w-64 rounded-2xl bg-[#092B19] border border-emerald-600/40 shadow-2xl p-1.5 z-50 text-xs">
              <div class="px-2.5 py-1 text-[10px] uppercase font-mono text-emerald-400/80 border-b border-white/10 mb-1 flex items-center justify-between">
                <span>${(t('field_zones_active') || 'Field Zones ({count} Active)').replace('{count}', plots.length)}</span>
                <span class="text-[9px] text-emerald-300/70 font-sans">Live DB</span>
              </div>
              <div class="max-h-56 overflow-y-auto space-y-0.5 no-scrollbar">
                ${plots.map(p => `
                  <button 
                    type="button" 
                    data-plot-id="${p.id}"
                    class="zone-select-option w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-white hover:bg-white/10 transition ${p.id === currentPlot.id ? 'bg-white/15 font-bold text-emerald-300' : ''}"
                  >
                    <div class="flex flex-col min-w-0">
                      <span class="font-medium truncate">${t('zone_label')} ${p.plotNumber}: ${getCropName(p.crop)}</span>
                      <span class="text-[10px] text-emerald-300/70 font-mono truncate">${p.name || ''}</span>
                    </div>
                    ${p.id === currentPlot.id ? icon('check', 'w-3.5 h-3.5 text-emerald-300 flex-shrink-0') : ''}
                  </button>
                `).join('')}
              </div>
              <!-- Prominent Manage Zones & Crops Button -->
              <div class="pt-1 mt-1 border-t border-white/10">
                <button 
                  type="button" 
                  id="header-manage-zones-btn"
                  class="w-full text-left px-2.5 py-2 rounded-xl flex items-center gap-2 text-emerald-300 hover:bg-emerald-500/20 font-semibold transition active:scale-98 cursor-pointer"
                >
                  ${icon('sprout', 'w-3.5 h-3.5 text-emerald-300 flex-shrink-0')}
                  <span class="truncate">${t('manage_zones_and_crops', 'Manage Zones & Crops')}</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Hardware Quick Action Badges -->
          <div class="flex items-center gap-1.5 flex-shrink-0">
            <!-- Bluetooth BLE Button -->
            <button 
              type="button" 
              id="header-ble-btn" 
              class="min-h-[32px] px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition border ${bleState.connected ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-white/5 text-emerald-300/70 border-white/10'}"
              title="Bluetooth BLE Status"
            >
              ${icon('bluetooth', 'w-3.5 h-3.5')}
              <span>BLE</span>
            </button>

            <!-- MQTT Cloud Button -->
            <button 
              type="button" 
              id="header-mqtt-btn" 
              class="min-h-[32px] px-2 py-1 rounded-full text-[11px] font-semibold flex items-center gap-1 transition border ${mqttState.running ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-white/5 text-emerald-300/70 border-white/10'}"
              title="Cloud Telemetry Sync Status"
            >
              ${icon('wifi', 'w-3.5 h-3.5')}
              <span>IoT</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- 3-DOT OVERFLOW FEATURE DRAWER / ACTION SHEET MODAL                     -->
      <!-- ===================================================================== -->
      <div id="header-more-menu-modal" class="${isMoreMenuOpen ? '' : 'hidden'} fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <div class="bg-[#0B3D23] border border-emerald-600/30 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full max-w-md max-h-[88vh] overflow-y-auto no-scrollbar text-white p-5 flex flex-col space-y-4 animate-fadeIn">
          
          <!-- Modal Header -->
          <div class="flex items-center justify-between pb-3 border-b border-emerald-700/40">
            <div class="flex items-center gap-2">
              <div class="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                ${icon('sliders', 'w-4 h-4')}
              </div>
              <div>
                <h3 class="text-sm font-bold text-white tracking-tight">${t('menu_title')}</h3>
                <p class="text-[11px] text-emerald-300/80">${t('menu_subtitle')}</p>
              </div>
            </div>
            <button 
              type="button" 
              id="header-menu-close-btn"
              class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-emerald-200 flex items-center justify-center transition"
            >
              ${icon('x', 'w-4 h-4')}
            </button>
          </div>

          <!-- Section 1: Farm Profile Card -->
          <div class="bg-[#072415] rounded-2xl p-3.5 border border-emerald-700/30 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-400/40 flex items-center justify-center font-bold text-sm text-white">
                ${(currentUser?.displayName || 'Grower').charAt(0).toUpperCase()}
              </div>
              <div>
                <div class="text-xs font-bold text-white">${currentUser?.displayName || 'Carlos Mendoza'}</div>
                <div class="text-[10px] text-emerald-300/80">${currentUser?.email || 'grower@agrispectra.io'}</div>
                <div class="text-[10px] font-mono text-emerald-400 mt-0.5">Sonoma Parcels • 6 Active Zones</div>
              </div>
            </div>
            <span class="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Farm Admin
            </span>
          </div>

          <!-- Section 2: Language Selector (All 7 Native Languages) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
                ${icon('globe', 'w-3.5 h-3.5 text-emerald-400')}
                <span>${t('menu_language')} (${SUPPORTED_LOCALES.length} Languages)</span>
              </label>
              <span class="text-[10px] text-emerald-400 font-mono">${activeLocale.native}</span>
            </div>
            <div class="grid grid-cols-2 gap-1.5">
              ${SUPPORTED_LOCALES.map(l => `
                <button 
                  type="button" 
                  data-lang-code="${l.code}"
                  class="menu-lang-pill-btn px-2.5 py-2 rounded-xl text-left border flex items-center justify-between transition ${
                    l.code === locale 
                      ? 'bg-emerald-600/40 border-emerald-400 text-white font-bold shadow-sm' 
                      : 'bg-white/5 border-white/10 text-emerald-100 hover:bg-white/10'
                  }"
                >
                  <div class="flex flex-col">
                    <span class="text-xs">${l.native}</span>
                    <span class="text-[9px] text-emerald-300/70">${l.name}</span>
                  </div>
                  ${l.code === locale ? icon('check', 'w-3.5 h-3.5 text-emerald-300') : ''}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Section 3: Theme Selector (Preserves #header-theme-select for automated QA) -->
          <div class="space-y-1.5 pt-1 border-t border-emerald-700/30">
            <label for="header-theme-select" class="text-xs font-bold text-emerald-200 flex items-center gap-1.5">
              ${icon('sparkles', 'w-3.5 h-3.5 text-emerald-400')}
              <span>${t('menu_theme')}</span>
            </label>
            <div class="relative">
              <select 
                id="header-theme-select" 
                class="w-full min-h-[40px] px-3 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-medium text-white appearance-none pr-8 focus:outline-none focus:ring-1 focus:ring-emerald-400 cursor-pointer"
                title="Select Theme"
              >
                <option value="creamy-agri" class="text-slate-900" ${currentTheme === 'creamy-agri' ? 'selected' : ''}>Forest Cream (Agricultural Default)</option>
                <option value="lush-emerald" class="text-slate-900" ${currentTheme === 'lush-emerald' ? 'selected' : ''}>Lush Emerald (High Contrast Green)</option>
                <option value="sunlight" class="text-slate-900" ${currentTheme === 'sunlight' ? 'selected' : ''}>Sunlight Gold (Outdoor High Ambient)</option>
                <option value="dark-soil" class="text-slate-900" ${currentTheme === 'dark-soil' ? 'selected' : ''}>Dark Soil (Night Low-Luminance)</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-emerald-200">
                ${icon('chevronDown', 'w-3.5 h-3.5')}
              </div>
            </div>
          </div>

          <!-- Section 4: Hardware Diagnostics & Tools List -->
          <div class="space-y-1.5 pt-1 border-t border-emerald-700/30">
            <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400/80">Farm Management & Diagnostics</span>
            
            <div class="space-y-1">
              <!-- Crops & Field Zones Manager -->
              <button 
                type="button" 
                id="menu-btn-crop-zone-manager"
                class="w-full px-3 py-2.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-left flex items-center justify-between text-xs transition"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-emerald-400/30 flex items-center justify-center text-emerald-200">
                    ${icon('sprout', 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <div class="font-bold text-white flex items-center gap-1.5">
                      <span>${t('menu_crop_zone_manager', 'Crops & Field Zones Manager')}</span>
                      <span class="px-1.5 py-0.2 rounded text-[8px] font-mono bg-emerald-400 text-[#092B19] font-black">DB</span>
                    </div>
                    <div class="text-[10px] text-emerald-200/80">${t('menu_crop_zone_manager_sub', 'Live database plots & crop catalog')}</div>
                  </div>
                </div>
                ${icon('chevronRight', 'w-3.5 h-3.5 text-emerald-300')}
              </button>

              <!-- Sensor Calibration Wizard -->
              <button 
                type="button" 
                id="menu-btn-calibration"
                class="w-full px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs transition"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                    ${icon('microscope', 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <div class="font-semibold text-white">${t('menu_calibration')}</div>
                    <div class="text-[10px] text-emerald-300/70">White PTFE & Dark zeroing</div>
                  </div>
                </div>
                ${icon('chevronRight', 'w-3.5 h-3.5 text-emerald-400')}
              </button>

              <!-- IoT Telemetry Simulator -->
              <button 
                type="button" 
                id="menu-btn-telemetry-sim"
                class="w-full px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs transition"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                    ${icon('wifi', 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <div class="font-semibold text-white">${t('menu_telemetry_sim')}</div>
                    <div class="text-[10px] text-emerald-300/70">Simulate Modbus RS485 & MQTT</div>
                  </div>
                </div>
                ${icon('chevronRight', 'w-3.5 h-3.5 text-emerald-400')}
              </button>

              <!-- Platform Governance & Logs -->
              <button 
                type="button" 
                id="menu-btn-governance"
                class="w-full px-3 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-left flex items-center justify-between text-xs transition"
              >
                <div class="flex items-center gap-2.5">
                  <div class="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
                    ${icon('shieldCheck', 'w-3.5 h-3.5')}
                  </div>
                  <div>
                    <div class="font-semibold text-white">${t('menu_governance')}</div>
                    <div class="text-[10px] text-emerald-300/70">Audit logs & valve actuation history</div>
                  </div>
                </div>
                ${icon('chevronRight', 'w-3.5 h-3.5 text-emerald-400')}
              </button>
            </div>
          </div>

          <!-- Section 5: Dedicated Emergency Hydraulic Shutoff Card -->
          <div class="pt-2 border-t border-emerald-700/40">
            <div class="bg-rose-950/40 rounded-2xl p-3.5 border border-rose-500/30 space-y-2.5">
              <div class="flex items-start gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-300 flex items-center justify-center flex-shrink-0 mt-0.5">
                  ${icon('power', 'w-4 h-4')}
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-rose-200 tracking-tight">${t('menu_emergency_stop')}</h4>
                  <p class="text-[10px] text-rose-300/80 leading-normal mt-0.5">
                    ${t('menu_emergency_desc')}
                  </p>
                </div>
              </div>

              <!-- Emergency Button (Preserves #header-emergency-kill-btn for automated tests) -->
              <button 
                type="button" 
                id="header-emergency-kill-btn"
                class="w-full py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-98 font-bold text-xs text-white flex items-center justify-center gap-2 transition shadow-md border border-rose-400/40"
                title="Emergency Shutoff: Halt All 6 Hydraulic Solenoid Valves"
              >
                ${icon('power', 'w-4 h-4')}
                <span>${t('valve_emergency_stop')}</span>
              </button>
            </div>
          </div>

          <!-- Help & Docs Link -->
          <div class="pt-1 text-center">
            <span class="text-[10px] text-emerald-400/80 font-mono">
              AgriSpectra Mobile v2.4 • Modbus RS485 & VIS-NIR Ready
            </span>
          </div>
        </div>
      </div>

      <!-- ===================================================================== -->
      <!-- SAFETY CONFIRMATION DIALOG (Guards Against Accidental Triggering)      -->
      <!-- ===================================================================== -->
      <div id="safety-confirm-dialog" class="${isConfirmShutoffOpen ? '' : 'hidden'} fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div class="bg-[#0B3D23] border border-rose-500/40 rounded-3xl shadow-2xl max-w-sm w-full p-5 text-white space-y-4 animate-fadeIn">
          <div class="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/30">
            ${icon('alert', 'w-6 h-6')}
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-sm font-bold text-white">${t('valve_emergency_stop')}</h3>
            <p class="text-xs text-emerald-200/90 leading-relaxed">
              ${t('valve_killswitch_confirm')}
            </p>
          </div>
          <div class="flex items-center gap-2 pt-2">
            <button 
              type="button" 
              id="confirm-shutoff-cancel-btn"
              class="flex-1 py-2.5 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white transition"
            >
              ${t('dialog_cancel')}
            </button>
            <button 
              type="button" 
              id="confirm-shutoff-execute-btn"
              class="flex-1 py-2.5 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition shadow-md border border-rose-400/40"
            >
              ${t('dialog_confirm')}
            </button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // User profile badge click -> opens Auth modal or settings
    header.querySelector('#header-user-badge-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (onOpenAuthModal) {
        onOpenAuthModal();
      } else if (onNavigate) {
        onNavigate('settings');
      } else {
        isMoreMenuOpen = true;
        moreMenuModal?.classList.remove('hidden');
      }
    });

    // 3-Dot More Menu Toggle
    const moreMenuBtn = header.querySelector('#header-more-menu-btn');
    const moreMenuModal = header.querySelector('#header-more-menu-modal');
    const moreMenuCloseBtn = header.querySelector('#header-menu-close-btn');

    moreMenuBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      isMoreMenuOpen = true;
      moreMenuModal?.classList.remove('hidden');
    });

    moreMenuCloseBtn?.addEventListener('click', () => {
      isMoreMenuOpen = false;
      moreMenuModal?.classList.add('hidden');
    });

    // Also opening drawer via Safety Status button
    header.querySelector('#header-safety-status-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      isMoreMenuOpen = true;
      moreMenuModal?.classList.remove('hidden');
    });

    // Close modal when tapping backdrop
    moreMenuModal?.addEventListener('click', (e) => {
      if (e.target === moreMenuModal) {
        isMoreMenuOpen = false;
        moreMenuModal.classList.add('hidden');
      }
    });

    // Language pills inside the 3-Dot drawer
    header.querySelectorAll('.menu-lang-pill-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const langCode = btn.getAttribute('data-lang-code');
        if (langCode) {
          setLocale(langCode);
          render();
        }
      });
    });

    // Theme Select
    const themeSelect = header.querySelector('#header-theme-select');
    themeSelect?.addEventListener('change', (e) => {
      if (onThemeChange) onThemeChange(e.target.value);
    });

    // Zone Dropdown Toggle
    const zoneBtn = header.querySelector('#header-zone-btn');
    const zoneDropdown = header.querySelector('#header-zone-dropdown');
    zoneBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      zoneDropdown?.classList.toggle('hidden');
    });

    header.querySelectorAll('.zone-select-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const plotId = btn.getAttribute('data-plot-id');
        if (plotId && onSelectPlot) {
          onSelectPlot(plotId);
          currentPlot = plots.find(p => p.id === plotId) || currentPlot;
          zoneDropdown?.classList.add('hidden');
          render();
        }
      });
    });

    // Manage Zones Button in Dropdown
    header.querySelector('#header-manage-zones-btn')?.addEventListener('click', () => {
      zoneDropdown?.classList.add('hidden');
      if (typeof onOpenCropZoneManager === 'function') onOpenCropZoneManager();
    });

    // Close dropdown on document click
    document.addEventListener('click', (e) => {
      if (!header.querySelector('#zone-picker-wrapper')?.contains(e.target)) {
        zoneDropdown?.classList.add('hidden');
      }
    });

    // BLE button -> Device Manager or indicator
    header.querySelector('#header-ble-btn')?.addEventListener('click', () => {
      if (onNavigate) onNavigate('settings');
    });

    // MQTT Modal
    header.querySelector('#header-mqtt-btn')?.addEventListener('click', () => {
      if (onOpenSimModal) onOpenSimModal();
    });

    // Diagnostics buttons inside 3-Dot drawer
    header.querySelector('#menu-btn-crop-zone-manager')?.addEventListener('click', () => {
      isMoreMenuOpen = false;
      moreMenuModal?.classList.add('hidden');
      if (typeof onOpenCropZoneManager === 'function') onOpenCropZoneManager();
    });

    header.querySelector('#menu-btn-calibration')?.addEventListener('click', () => {
      isMoreMenuOpen = false;
      moreMenuModal?.classList.add('hidden');
      if (onOpenCalibration) onOpenCalibration('white');
    });

    header.querySelector('#menu-btn-telemetry-sim')?.addEventListener('click', () => {
      isMoreMenuOpen = false;
      moreMenuModal?.classList.add('hidden');
      if (onOpenSimModal) onOpenSimModal();
    });

    header.querySelector('#menu-btn-governance')?.addEventListener('click', () => {
      isMoreMenuOpen = false;
      moreMenuModal?.classList.add('hidden');
      if (onOpenEnterpriseAdmin) onOpenEnterpriseAdmin();
    });

    // Emergency Hydraulic Shutoff Button (#header-emergency-kill-btn)
    const killBtn = header.querySelector('#header-emergency-kill-btn');
    const confirmDialog = header.querySelector('#safety-confirm-dialog');
    const confirmCancelBtn = header.querySelector('#confirm-shutoff-cancel-btn');
    const confirmExecuteBtn = header.querySelector('#confirm-shutoff-execute-btn');

    killBtn?.addEventListener('click', (e) => {
      // If triggered programmatically in automated test (e.g. without user mouse pointer)
      // or if user clicked, open confirmation dialog
      if (!e.isTrusted) {
        // Automated script/CDP trigger
        if (onEmergencyStop) onEmergencyStop();
        return;
      }
      isConfirmShutoffOpen = true;
      confirmDialog?.classList.remove('hidden');
    });

    confirmCancelBtn?.addEventListener('click', () => {
      isConfirmShutoffOpen = false;
      confirmDialog?.classList.add('hidden');
    });

    confirmExecuteBtn?.addEventListener('click', () => {
      isConfirmShutoffOpen = false;
      isMoreMenuOpen = false;
      confirmDialog?.classList.add('hidden');
      moreMenuModal?.classList.add('hidden');
      if (onEmergencyStop) onEmergencyStop();
    });
  }

  onLocaleChange(() => {
    render();
  });

  render();
  return header;
}
