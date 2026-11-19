/**
 * Bottom Navigation Bar for Mobile (BottomNavBar.js)
 * High-performance, ergonomic 6-tab mobile navigation bar for precision agriculture:
 *   1. Dashboard (Overview, 1-Acre Plot Canvas, Vitality gauge, quick actions)
 *   2. Irrigation (Valve Control Center, bi-stable latching solenoids, emergency stop, mainline pressure)
 *   3. Spectroscopy (Leaf-clip BLE scanner, 76-band chemometrics, 5 farmer decisions, calibration)
 *   4. Synergy (Closed-loop leaf-to-valve smart recommendation cards)
 *   5. Usage (UsageAnalyticsView: cumulative water in liters, valve cycles, leaf scan archives, CSV export)
 *   6. Settings (SettingsView: Profile details, Google account, plot targets, pulse timing, glare mode, log out)
 */
import { icon } from '../utils/icons.js';
import { t, getLocale, onLocaleChange } from '../utils/i18n.js';

export const MOBILE_TABS = [
  { id: 'dashboard', alias: 'overview', icon: 'home', labelKey: 'nav_home', defaultLabel: 'Home' },
  { id: 'irrigation', alias: 'irrigation', icon: 'droplet', labelKey: 'nav_irrigation', defaultLabel: 'Drip' },
  { id: 'spectroscopy', alias: 'spectroscopy', icon: 'spectroscopy', labelKey: 'nav_spectroscopy', defaultLabel: 'Spectro' },
  { id: 'soil', alias: 'soil', icon: 'soil', labelKey: 'nav_soil', defaultLabel: 'Soil' },
  { id: 'environment', alias: 'weather', icon: 'thermometer', labelKey: 'nav_environment', defaultLabel: 'Weather' },
  { id: 'synergy', alias: 'ai', icon: 'synergy', labelKey: 'nav_ai', defaultLabel: 'AI' },
  { id: 'settings', alias: 'settings', icon: 'settings', labelKey: 'nav_settings', defaultLabel: 'Settings' }
];

export function createBottomNavBar({
  activeTab = 'dashboard',
  onTabChange,
  badges = {} // e.g. { synergy: 2, irrigation: 1 }
}) {
  const container = document.createElement('nav');
  container.className = "fixed bottom-0 inset-x-0 z-40 px-1 sm:px-3 pb-2.5 pt-1 pointer-events-none select-none flex justify-center";
  container.setAttribute('role', 'navigation');
  container.setAttribute('aria-label', 'Mobile Main Navigation');

  let currentTab = normalizeTab(activeTab);
  let currentBadges = { ...badges };

  function normalizeTab(id) {
    if (!id) return 'dashboard';
    if (id === 'overview') return 'dashboard';
    if (id === 'ai') return 'synergy';
    if (id === 'weather') return 'environment';
    return id;
  }

  function getLabel(tab) {
    try {
      const loc = getLocale();
      // On mobile viewports in English, use concise 1-word tab names to eliminate awkward ellipsis truncation
      if (loc === 'en' && tab.defaultLabel) {
        return tab.defaultLabel;
      }
      const translated = t(tab.labelKey);
      if (translated && !translated.startsWith('nav_')) return translated;
    } catch (e) {}
    return tab.defaultLabel;
  }

  function render() {
    container.innerHTML = `
      <div class="pointer-events-auto max-w-lg w-full mx-auto bg-white/95 dark:bg-[#07190F]/95 backdrop-blur-2xl border border-emerald-900/10 dark:border-emerald-800/40 rounded-3xl shadow-[0_12px_36px_rgba(7,22,12,0.22)] px-1 sm:px-1.5 py-1 flex items-center justify-between gap-0.5 sm:gap-1">
        ${MOBILE_TABS.map(tab => {
          const isActive = currentTab === tab.id || 
            (tab.id === 'dashboard' && (currentTab === 'overview' || currentTab === 'dashboard')) || 
            (tab.id === 'synergy' && (currentTab === 'ai' || currentTab === 'synergy')) ||
            (tab.id === 'soil' && currentTab === 'soil') ||
            (tab.id === 'environment' && (currentTab === 'weather' || currentTab === 'environment'));
          const badgeCount = currentBadges[tab.id] || (tab.id === 'synergy' ? currentBadges['ai'] : 0);
          const label = getLabel(tab);

          return `
            <button 
              type="button" 
              data-tab-id="${tab.id}"
              class="bottom-nav-btn flex-1 min-w-0 min-h-[48px] py-1 px-0.5 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 relative group active:scale-95 cursor-pointer select-none ${
                isActive 
                  ? 'bg-emerald-50 dark:bg-emerald-900/40 text-[#0E5431] dark:text-emerald-300 font-bold shadow-xs border border-emerald-500/20' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/50'
              }"
              title="${label}"
              aria-label="${label}"
              aria-selected="${isActive ? 'true' : 'false'}"
            >
              <!-- Icon Container -->
              <div class="transition-transform duration-200 relative flex items-center justify-center w-6 h-5 ${isActive ? 'scale-110 -translate-y-0.5' : 'group-hover:scale-105'}">
                ${icon(tab.icon, isActive ? 'w-5 h-5 text-[#0E5431] dark:text-emerald-300' : 'w-5 h-5 text-slate-500 dark:text-slate-400')}
                
                <!-- Badge Counter (e.g. pending recommendation alert) -->
                ${badgeCount > 0 ? `
                  <span class="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-amber-500 text-slate-950 font-mono font-black text-[8.5px] flex items-center justify-center shadow-xs ring-1 ring-white dark:ring-slate-950 z-20 pointer-events-none">
                    ${badgeCount > 9 ? '9+' : badgeCount}
                  </span>
                ` : ''}
              </div>

              <!-- Label -->
              <span class="text-[8px] sm:text-[9px] font-bold tracking-tight mt-0.5 text-center leading-tight whitespace-nowrap overflow-hidden text-ellipsis w-full max-w-full px-0.5 block ${
                isActive ? 'text-[#0E5431] font-bold dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400 font-medium'
              }">
                ${label}
              </span>

              <!-- Active Dot Indicator -->
              ${isActive ? `
                <span class="w-1.5 h-1.5 rounded-full bg-[#0E5431] dark:bg-emerald-400 absolute bottom-0.5 shadow-xs shadow-emerald-400 pointer-events-none"></span>
              ` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;

    // Attach click handlers
    container.querySelectorAll('.bottom-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab-id');
        if (tabId && tabId !== currentTab) {
          currentTab = tabId;
          render();
          if (onTabChange) onTabChange(tabId);
        }
      });
    });
  }

  onLocaleChange(() => render());
  render();

  return {
    element: container,
    setActiveTab: (tabId) => {
      currentTab = normalizeTab(tabId);
      render();
    },
    setBadge: (tabId, count) => {
      currentBadges[tabId] = count;
      render();
    },
    getActiveTab: () => currentTab
  };
}
