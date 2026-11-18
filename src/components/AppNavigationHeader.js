/**
 * App Navigation Header Component
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Features:
 *   - Rich emerald green banner (#0E5431)
 *   - Multilingual picker (EN, Kannada [ಕನ್ನಡ], Hindi [हिन्दी], Spanish [Español], Swahili [Kiswahili])
 *   - Theme selector preserving #header-theme-select for automated CDP testing
 *   - Hardware status pills: #header-ble-btn, #header-mqtt-btn, #header-emergency-kill-btn
 *   - Field Zone selector
 */

import { icon } from '../utils/icons.js';
import { t, getLocale, setLocale, SUPPORTED_LOCALES, onLocaleChange } from '../utils/i18n.js';

export function createAppNavigationHeader({
  plots = [],
  selectedPlotId = 'plot-1',
  onSelectPlot,
  onEmergencyStop,
  onOpenSimModal,
  onThemeChange,
  currentTheme = 'creamy-agri',
  bleState = { connected: false },
  mqttState = { running: true },
  currentUser = null
}) {
  const header = document.createElement('header');
  header.className = "w-full bg-[#0E5431] text-white select-none z-30 transition-all duration-300 shadow-md";

  let currentPlot = plots.find(p => p.id === selectedPlotId) || plots[0] || {
    id: 'plot-1',
    plotNumber: 1,
    name: 'Zone 1 - Potato Field Zone',
    crop: 'Potato Crop'
  };

  function getFormattedDate() {
    const now = new Date();
    const options = { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' };
    return now.toLocaleDateString(getLocale() === 'en' ? 'en-US' : undefined, options);
  }

  function render() {
    const locale = getLocale();
    const activeLocale = SUPPORTED_LOCALES.find(l => l.code === locale) || SUPPORTED_LOCALES[0];

    header.innerHTML = `
      <!-- Top Status & Hero Greeting Bar -->
      <div class="px-4 pt-3.5 pb-3">
        <div class="flex items-center justify-between mb-3">
          <!-- Left: Greeting & Current Date -->
          <div class="flex flex-col">
            <span class="text-[11px] font-medium text-emerald-200/90 tracking-wide flex items-center gap-1.5">
              <span>${getFormattedDate()}</span>
            </span>
            <h1 class="text-lg font-bold text-white tracking-tight leading-snug">
              ${t('hello_greeting')}
            </h1>
          </div>

          <!-- Right: Profile, Language & Theme Controls -->
          <div class="flex items-center gap-2">
            <!-- Language Dropdown -->
            <div class="relative" id="lang-picker-wrapper">
              <button 
                type="button" 
                id="header-lang-btn"
                class="min-h-[38px] px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-semibold text-white flex items-center gap-1.5 transition"
                title="Change Language"
              >
                ${icon('globe', 'w-3.5 h-3.5 text-emerald-300')}
                <span>${activeLocale.native}</span>
                ${icon('chevronDown', 'w-3 h-3 text-emerald-200')}
              </button>

              <div id="header-lang-dropdown" class="hidden absolute right-0 mt-2 w-48 rounded-2xl bg-[#092B19] border border-emerald-600/30 shadow-2xl p-1.5 z-50 text-xs">
                <div class="px-2.5 py-1 text-[10px] uppercase font-mono text-emerald-400/80 border-b border-white/10 mb-1">
                  Select Language
                </div>
                ${SUPPORTED_LOCALES.map(l => `
                  <button 
                    type="button" 
                    data-lang-code="${l.code}"
                    class="lang-option-btn w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-white hover:bg-white/10 transition ${l.code === locale ? 'bg-white/15 font-bold text-emerald-300' : ''}"
                  >
                    <span>${l.native} (${l.name})</span>
                    ${l.code === locale ? icon('check', 'w-3.5 h-3.5 text-emerald-300') : ''}
                  </button>
                `).join('')}
              </div>
            </div>

            <!-- Theme Selector (Preserves #header-theme-select for automated QA tests) -->
            <div class="relative">
              <select 
                id="header-theme-select" 
                class="min-h-[38px] px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-medium text-white appearance-none pr-7 pl-3 focus:outline-none cursor-pointer hover:bg-white/15 transition"
                title="Select Theme"
              >
                <option value="creamy-agri" class="text-slate-900" ${currentTheme === 'creamy-agri' ? 'selected' : ''}>Forest Cream</option>
                <option value="lush-emerald" class="text-slate-900" ${currentTheme === 'lush-emerald' ? 'selected' : ''}>Lush Emerald</option>
                <option value="sunlight" class="text-slate-900" ${currentTheme === 'sunlight' ? 'selected' : ''}>Sunlight Gold</option>
                <option value="dark-soil" class="text-slate-900" ${currentTheme === 'dark-soil' ? 'selected' : ''}>Dark Soil</option>
              </select>
              <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-200">
                ${icon('chevronDown', 'w-3 h-3')}
              </div>
            </div>

            <!-- User Avatar Circle -->
            <div class="w-9 h-9 rounded-full bg-emerald-700/80 border-2 border-emerald-400/40 flex items-center justify-center font-bold text-xs text-white shadow-inner" title="${currentUser?.displayName || 'Farm Owner'}">
              ${(currentUser?.displayName || 'Grower').charAt(0).toUpperCase()}
            </div>
          </div>
        </div>

        <!-- Quick Hardware Status & Emergency Shutoff Bar -->
        <div class="flex items-center justify-between gap-2 pt-1 border-t border-emerald-700/40">
          <!-- Zone Picker Pill -->
          <div class="relative" id="zone-picker-wrapper">
            <button 
              type="button" 
              id="header-zone-btn"
              class="min-h-[36px] px-3 py-1 rounded-full bg-[#092B19]/80 hover:bg-[#092B19] border border-emerald-500/30 text-xs font-medium text-emerald-100 flex items-center gap-1.5 transition"
            >
              ${icon('mapPin', 'w-3.5 h-3.5 text-emerald-400')}
              <span>Zone ${currentPlot.plotNumber}: ${currentPlot.crop}</span>
              ${icon('chevronDown', 'w-3 h-3 text-emerald-400')}
            </button>

            <div id="header-zone-dropdown" class="hidden absolute left-0 mt-2 w-64 rounded-2xl bg-[#092B19] border border-emerald-600/30 shadow-2xl p-1.5 z-50 text-xs">
              <div class="px-2.5 py-1 text-[10px] uppercase font-mono text-emerald-400/80 border-b border-white/10 mb-1">
                Field Zones
              </div>
              ${plots.map(p => `
                <button 
                  type="button" 
                  data-plot-id="${p.id}"
                  class="zone-select-option w-full text-left px-2.5 py-2 rounded-xl flex items-center justify-between text-white hover:bg-white/10 transition ${p.id === currentPlot.id ? 'bg-white/15 font-bold text-emerald-300' : ''}"
                >
                  <div class="flex flex-col">
                    <span class="font-medium">Zone ${p.plotNumber}: ${p.crop}</span>
                    <span class="text-[10px] text-emerald-300/70 font-mono">${p.name || ''}</span>
                  </div>
                  ${p.id === currentPlot.id ? icon('check', 'w-3.5 h-3.5 text-emerald-300') : ''}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- Hardware Quick Action Badges -->
          <div class="flex items-center gap-1.5">
            <!-- Bluetooth BLE Button -->
            <button 
              type="button" 
              id="header-ble-btn" 
              class="min-h-[36px] px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition border ${bleState.connected ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-white/5 text-emerald-300/60 border-white/10'}"
              title="Bluetooth BLE Status"
            >
              ${icon('bluetooth', 'w-3.5 h-3.5')}
              <span class="hidden sm:inline">${bleState.connected ? 'BLE Active' : 'BLE Off'}</span>
            </button>

            <!-- MQTT Cloud Button -->
            <button 
              type="button" 
              id="header-mqtt-btn" 
              class="min-h-[36px] px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 transition border ${mqttState.running ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' : 'bg-white/5 text-emerald-300/60 border-white/10'}"
              title="Cloud Telemetry Sync Status"
            >
              ${icon('wifi', 'w-3.5 h-3.5')}
              <span class="hidden sm:inline">${mqttState.running ? 'IoT Stream' : 'IoT Idle'}</span>
            </button>

            <!-- Emergency Killswitch Button -->
            <button 
              type="button" 
              id="header-emergency-kill-btn" 
              class="min-h-[36px] px-3 py-1 rounded-full text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 transition shadow-sm border border-rose-400/30 animate-pulse"
              title="Emergency All-Stop Killswitch"
            >
              ${icon('power', 'w-3.5 h-3.5')}
              <span>KILL</span>
            </button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Theme Select
    const themeSelect = header.querySelector('#header-theme-select');
    themeSelect?.addEventListener('change', (e) => {
      if (onThemeChange) onThemeChange(e.target.value);
    });

    // Language Dropdown Toggle
    const langBtn = header.querySelector('#header-lang-btn');
    const langDropdown = header.querySelector('#header-lang-dropdown');
    langBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      langDropdown?.classList.toggle('hidden');
    });

    header.querySelectorAll('.lang-option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const langCode = btn.getAttribute('data-lang-code');
        if (langCode) {
          setLocale(langCode);
          langDropdown?.classList.add('hidden');
          render();
        }
      });
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

    // Close dropdowns on document click
    document.addEventListener('click', () => {
      langDropdown?.classList.add('hidden');
      zoneDropdown?.classList.add('hidden');
    });

    // Emergency Killswitch
    header.querySelector('#header-emergency-kill-btn')?.addEventListener('click', () => {
      if (onEmergencyStop) onEmergencyStop();
    });

    // MQTT Modal
    header.querySelector('#header-mqtt-btn')?.addEventListener('click', () => {
      if (onOpenSimModal) onOpenSimModal();
    });
  }

  onLocaleChange(() => {
    render();
  });

  render();
  return header;
}
