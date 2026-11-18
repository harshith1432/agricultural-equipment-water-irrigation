/**
 * Unified Ergonomic Mobile Navigation Dock
 * Floating 5-tab ergonomic dock positioned at the bottom of the screen.
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Replaces the cramped 7-item squish with 5 spacious, ergonomic touch targets:
 *   1. Home / Overview (overview)
 *   2. Drip Irrigation (irrigation)
 *   3. Leaf Spectro (spectroscopy)
 *   4. Soil & Climate (soil / environment)
 *   5. AI Insights (ai)
 * (Settings & Device Diagnostics are accessible via the top 3-dot overflow menu)
 */

import { icon } from '../utils/icons.js';
import { t, onLocaleChange } from '../utils/i18n.js';

export function createNavigationDock({
  activeView = 'overview',
  onNavigate
}) {
  const navContainer = document.createElement('nav');
  navContainer.className = "fixed bottom-0 inset-x-0 z-40 px-3 pb-3 pt-1 pointer-events-none select-none flex justify-center";

  let currentActive = activeView;

  // 5 Ergonomic Core Hubs
  const NAV_ITEMS = [
    { id: 'overview', iconName: 'home', labelKey: 'nav_home' },
    { id: 'irrigation', iconName: 'droplet', labelKey: 'nav_irrigation' },
    { id: 'spectroscopy', iconName: 'microscope', labelKey: 'nav_spectroscopy' },
    { id: 'soil', iconName: 'soil', labelKey: 'nav_soil_climate' },
    { id: 'ai', iconName: 'zap', labelKey: 'nav_ai' }
  ];

  function isItemActive(itemId) {
    if (itemId === currentActive) return true;
    if (itemId === 'soil' && (currentActive === 'soil' || currentActive === 'environment')) {
      return true;
    }
    return false;
  }

  function render() {
    navContainer.innerHTML = `
      <div class="pointer-events-auto max-w-md w-full mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-900/10 dark:border-slate-800 rounded-3xl shadow-[0_12px_36px_rgba(14,84,49,0.18)] px-2 py-1.5 flex items-center justify-between gap-1 overflow-hidden">
        ${NAV_ITEMS.map(item => {
          const active = isItemActive(item.id);
          return `
            <button 
              type="button" 
              data-nav-id="${item.id}"
              class="nav-dock-btn flex-1 min-w-[56px] min-h-[50px] py-1 px-1 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 relative group active:scale-95 ${
                active 
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 font-bold shadow-sm border border-emerald-600/20' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-slate-800/60'
              }"
              title="${t(item.labelKey)}"
              aria-label="${t(item.labelKey)}"
            >
              <div class="transition-transform duration-200 ${active ? 'scale-110 -translate-y-0.5' : 'group-hover:scale-105'}">
                ${icon(item.iconName, active ? 'w-5 h-5 text-[#0E5431] dark:text-emerald-300' : 'w-5 h-5 text-slate-500 dark:text-slate-400')}
              </div>
              <span class="text-[8.5px] font-medium tracking-tight mt-0.5 text-center leading-[1.15] w-full max-w-[70px] line-clamp-2 overflow-hidden px-0.5 ${
                active ? 'text-[#0E5431] font-bold dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'
              }">
                ${t(item.labelKey)}
              </span>
              ${active ? `<span class="w-1.5 h-1.5 rounded-full bg-[#0E5431] dark:bg-emerald-400 absolute bottom-0.5"></span>` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;

    navContainer.querySelectorAll('.nav-dock-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = btn.getAttribute('data-nav-id');
        if (id && onNavigate) {
          currentActive = id;
          render();
          onNavigate(id);
        }
      });
    });
  }

  onLocaleChange(() => {
    render();
  });

  render();

  return {
    element: navContainer,
    setActiveView: (viewId) => {
      currentActive = viewId;
      render();
    }
  };
}
