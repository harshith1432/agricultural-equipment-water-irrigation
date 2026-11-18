/**
 * Unified Mobile Navigation Dock
 * Floating ergonomic dock positioned at the bottom of the screen.
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Features 7 independent modular entry points:
 *   1. Home / Field Overview
 *   2. Drip Irrigation Hub
 *   3. Spectroscopy Studio
 *   4. Temperature & Humidity
 *   5. Soil Analysis (LABART 8-in-1)
 *   6. AI Insights & Crop Health
 *   7. Settings & Device Manager
 */

import { icon } from '../utils/icons.js';
import { t, onLocaleChange } from '../utils/i18n.js';

export function createNavigationDock({
  activeView = 'overview',
  onNavigate
}) {
  const navContainer = document.createElement('nav');
  navContainer.className = "fixed bottom-0 inset-x-0 z-40 px-2 pb-3 pt-1 pointer-events-none select-none flex justify-center";

  let currentActive = activeView;

  const NAV_ITEMS = [
    { id: 'overview', iconName: 'home', labelKey: 'nav_home' },
    { id: 'irrigation', iconName: 'droplet', labelKey: 'nav_irrigation' },
    { id: 'spectroscopy', iconName: 'microscope', labelKey: 'nav_spectroscopy' },
    { id: 'environment', iconName: 'thermometer', labelKey: 'nav_environment' },
    { id: 'soil', iconName: 'soil', labelKey: 'nav_soil' },
    { id: 'ai', iconName: 'zap', labelKey: 'nav_ai' },
    { id: 'settings', iconName: 'settings', labelKey: 'nav_settings' }
  ];

  function render() {
    navContainer.innerHTML = `
      <div class="pointer-events-auto max-w-md w-full mx-auto bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-emerald-900/10 dark:border-slate-800 rounded-3xl shadow-[0_10px_35px_rgba(14,84,49,0.15)] px-1.5 py-1.5 flex items-center justify-around gap-0.5 overflow-hidden">
        ${NAV_ITEMS.map(item => {
          const isActive = currentActive === item.id;
          return `
            <button 
              type="button" 
              data-nav-id="${item.id}"
              class="nav-dock-btn flex-1 min-w-0 max-w-[52px] min-h-[48px] py-1 px-0.5 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 relative overflow-hidden ${
                isActive 
                  ? 'text-[#0E5431] font-bold bg-emerald-50 dark:bg-emerald-950/40 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 hover:bg-slate-100/60 dark:hover:bg-slate-800/60'
              }"
              title="${t(item.labelKey)}"
            >
              <div class="transition-transform duration-200 ${isActive ? 'scale-110' : ''}">
                ${icon(item.iconName, isActive ? 'w-5 h-5 text-[#0E5431]' : 'w-5 h-5 text-slate-500 dark:text-slate-400')}
              </div>
              <span class="text-[8px] font-medium tracking-tight mt-0.5 truncate w-full text-center leading-tight ${isActive ? 'text-[#0E5431] font-bold dark:text-emerald-400' : 'text-slate-500'}">
                ${t(item.labelKey)}
              </span>
              ${isActive ? `<span class="w-1.5 h-1.5 rounded-full bg-[#0E5431] absolute bottom-0.5"></span>` : ''}
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
