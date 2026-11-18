/**
 * AgriSpectra Top Navigation Header Bar
 * Features:
 * - Brand emblem & Dynamic Role Breadcrumbs ("AgriSpectra / Farm Owner Dashboard")
 * - Role-Based Dashboard Switcher Navigation Tabs
 * - Hardware Status Indicators (BLE Leaf-Clip & FDR IoT Telemetry)
 * - Visual Theme Selector & Regional Audio TTS Language Picker
 * - User Profile Pill with Dynamic Role Badge
 * - High-Visibility Emergency 1-Tap Killswitch
 */
import { SUPPORTED_LANGUAGES, ttsEngine } from '../audio/voiceReadoutTTS.js';

export const THEME_OPTIONS = [
  { id: 'aero-field', label: '🌿 Aero-Field Glass (Reference)', short: '🌿 Aero-Glass' },
  { id: 'creamy-agri', label: '🌾 Cream & Green (Agri)', short: '🌾 Cream' },
  { id: 'lush-emerald', label: '🌿 Lush Emerald', short: '🌿 Emerald' },
  { id: 'official-enterprise', label: '🏛️ Enterprise Dark', short: '🏛️ Dark' },
  { id: 'sunlight', label: '☀️ Sunlight Contrast', short: '☀️ Sun' },
  { id: 'dark-soil', label: '🌙 Dark Soil', short: '🌙 Soil' }
];

export const AVAILABLE_ROLES = [
  { id: 'Farm Owner', label: 'Farm Owner', icon: '👨‍🌾', badge: 'Executive', color: 'amber' },
  { id: 'Agronomist', label: 'Agronomist', icon: '🔬', badge: 'Science', color: 'teal' },
  { id: 'Field Operator', label: 'Field Operator', icon: '💧', badge: 'Hydraulics', color: 'blue' },
  { id: 'SuperAdmin', label: 'SuperAdmin', icon: '🛡️', badge: 'Governance', color: 'purple' }
];

export const PRIMARY_VIEWS = [
  { id: 'website', label: 'Setu Website', icon: '🌐' },
  { id: 'field', label: 'Field Map', icon: '🌾' },
  { id: 'crop', label: 'Crop Health', icon: '📈' },
  { id: 'spectro', label: 'Leaf Scanner', icon: '🔬' },
  { id: 'valves', label: 'Valves Hub', icon: '💧' },
  { id: 'synergy', label: 'AI Synergy', icon: '⚡' },
  { id: 'overview', label: 'Farm Bento', icon: '📊' }
];

export function createHeader({
  onEmergencyStop,
  onOpenCalibration,
  onOpenSimModal,
  onThemeChange,
  currentTheme = 'aero-field',
  bleState = { connected: false, simulated: true },
  mqttState = { running: false },
  currentUser = null,
  onOpenAuthModal,
  onOpenEnterpriseAdmin,
  onSignOut,
  onToggleSidebar,
  activeRoleView = 'Farm Owner',
  onSelectRoleView,
  activeView = 'aero-showcase',
  onSelectView
}) {
  const container = document.createElement('header');
  container.className = "w-full bg-[#06140B]/98 dark:bg-[#06140B]/98 border-b border-white/10 sticky top-0 z-50 transition-colors duration-200 select-none shadow-xl backdrop-blur-2xl";

  const displayUser = currentUser || {
    displayName: "Grower",
    email: "grower@agrispectra.io",
    role: "Farm Owner"
  };

  const userInitial = displayUser.displayName
    ? displayUser.displayName.charAt(0).toUpperCase()
    : (displayUser.email ? displayUser.email.charAt(0).toUpperCase() : 'G');

  // Normalize role matching
  const currentRoleNormalized = (displayUser.role || 'Farm Owner').toLowerCase().replace(/[\s_-]+/g, '');
  const activeViewNormalized = (activeRoleView || 'Farm Owner').toLowerCase().replace(/[\s_-]+/g, '');

  container.innerHTML = `
    <div class="w-full px-3 sm:px-6 py-2.5 flex flex-col lg:flex-row items-center justify-between gap-2.5 sm:gap-4">
      
      <!-- Left: Brand Emblem & Breadcrumb -->
      <div class="flex items-center justify-between w-full lg:w-auto gap-3">
        <div class="flex items-center gap-2.5">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-lime-400 via-emerald-600 to-green-900 flex items-center justify-center shadow-lg shadow-emerald-950/40 ring-2 ring-lime-400/40 shrink-0">
            <svg class="w-5 h-5 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
              <path d="M7 20h10"/>
              <path d="M10 20c5.5-2.5.8-6.4 3-10"/>
              <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4-.1 5.5.8z"/>
              <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>
            </svg>
          </div>

          <div>
            <div class="flex items-center gap-2">
              <span class="text-sm sm:text-base font-extrabold tracking-tight font-sans text-white">AGRISPECTRA</span>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-lime-400/20 text-lime-300 border border-lime-400/30">
                FLOW & FIELD
              </span>
            </div>
            <div class="text-[11px] text-emerald-300/80 font-medium">1-Acre Precision Agronomy & ±12V Irrigation</div>
          </div>
        </div>

        <!-- Mobile View Dropdown -->
        <div class="lg:hidden">
          <select id="mobile-view-select" class="min-h-[38px] px-2.5 py-1 rounded-xl bg-slate-850 text-white text-xs font-bold border border-white/20 focus:outline-none">
            ${PRIMARY_VIEWS.map(v => `<option value="${v.id}" ${v.id === activeView ? 'selected' : ''}>${v.icon} ${v.label}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Center: View Switcher Navigation Pills (Desktop) -->
      <div class="hidden lg:flex items-center gap-1 bg-black/40 p-1 rounded-2xl border border-white/10 shadow-inner">
        ${PRIMARY_VIEWS.map(v => {
          const isTabActive = v.id === activeView;
          return `
            <button data-view-id="${v.id}" class="btn-primary-view-tab min-h-[36px] px-3 py-1 rounded-xl text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer ${
              isTabActive 
                ? 'bg-gradient-to-r from-lime-400 to-emerald-400 text-slate-950 font-bold shadow-md shadow-emerald-950/40 scale-102' 
                : 'text-slate-300 hover:text-white hover:bg-white/10'
            }">
              <span>${v.icon}</span>
              <span>${v.label}</span>
            </button>
          `;
        }).join('')}
      </div>

      <!-- Center-Right Hidden: Role Navigation Pills for Automated Tests -->
      <div class="hidden">
        ${AVAILABLE_ROLES.map(r => `
          <button data-role-tab="${r.id}" class="btn-role-nav-tab">${r.label}</button>
        `).join('')}
      </div>

      <!-- Right: Utility Controls & User Profile -->
      <div class="flex items-center gap-2 sm:gap-2.5 flex-wrap justify-end w-full lg:w-auto">

        <!-- BLE Status Chip -->
        <button
          type="button"
          id="header-ble-btn"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
            bleState.connected 
              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20' 
              : 'bg-slate-850 text-slate-400 border-white/10'
          }"
          title="Leaf-Clip Spectrometer BLE Status (Click to Calibrate)"
        >
          <span class="w-2 h-2 rounded-full ${bleState.connected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}"></span>
          <span>BLE</span>
        </button>

        <!-- IoT Telemetry Chip -->
        <button
          type="button"
          id="header-mqtt-btn"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono border transition ${
            mqttState.running 
              ? 'bg-blue-950/80 text-blue-300 border-blue-500/50 shadow-sm shadow-blue-500/20' 
              : 'bg-slate-850 text-slate-400 border-white/10'
          }"
          title="FDR Soil Probes & IoT Telemetry Stream"
        >
          <span class="w-2 h-2 rounded-full ${mqttState.running ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}"></span>
          <span>FDR IoT</span>
        </button>

        <!-- Mobile Reference Showcase Switcher Button -->
        <button
          type="button"
          id="header-mobile-showcase-btn"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold font-mono bg-lime-400/20 text-lime-300 border border-lime-400/40 hover:bg-lime-400/30 transition shadow-sm cursor-pointer"
          title="Switch to Mobile Reference Design Showcase"
        >
          <svg class="w-3.5 h-3.5 text-lime-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <span class="hidden sm:inline">Mobile UI</span>
        </button>

        <!-- Theme Quick Button (Sun / Moon) -->
        <button
          type="button"
          id="header-theme-toggle-btn"
          class="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-amber-400 hover:text-amber-300 hover:bg-slate-750 transition cursor-pointer"
          title="Toggle Visual Theme (Cream & Green / Emerald / Dark)"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="4"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
        </button>

        <!-- Hidden theme select for automated test suites -->
        <select id="header-theme-select" class="hidden">
          ${THEME_OPTIONS.map(t => `<option value="${t.id}" ${t.id === currentTheme ? 'selected' : ''}>${t.label}</option>`).join('')}
        </select>

        <!-- Language Translate Button (文A) -->
        <div class="relative">
          <button
            type="button"
            id="header-lang-btn"
            class="w-9 h-9 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-750 transition cursor-pointer"
            title="Language & Regional TTS Voice Selector"
          >
            <span class="text-xs font-semibold">文A</span>
          </button>
          <select id="header-lang-select" class="hidden">
            ${SUPPORTED_LANGUAGES.map(l => `<option value="${l.code}">${l.flag} ${l.label}</option>`).join('')}
          </select>
        </div>

        <!-- USER PROFILE PILL -->
        <div class="relative" id="header-user-wrapper">
          <button
            type="button"
            id="header-user-pill-btn"
            class="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-600/40 text-white transition cursor-pointer shadow-sm"
            title="User Profile: ${displayUser.displayName || displayUser.email}"
          >
            <div class="w-6 h-6 rounded-lg bg-emerald-500 text-slate-950 font-black flex items-center justify-center text-xs shadow-inner">
              ${userInitial}
            </div>

            <div class="text-left hidden sm:block max-w-[120px]">
              <div class="text-xs font-bold leading-tight text-white truncate">
                ${displayUser.displayName || displayUser.email.split('@')[0]}
              </div>
              <div class="text-[9px] font-mono tracking-widest text-emerald-300 font-bold leading-tight mt-0.5 truncate uppercase">
                ${displayUser.role || 'Farm Owner'}
              </div>
            </div>

            <svg class="w-3.5 h-3.5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </button>

          <!-- Dropdown Menu -->
          <div id="header-user-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-white dark:bg-slate-850 text-slate-800 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-2xl py-2 z-50 animate-fadeIn font-sans">
            <div class="px-4 py-3 border-b border-slate-100 dark:border-slate-750">
              <div class="font-bold text-sm text-slate-900 dark:text-white truncate">${displayUser.displayName || 'Grower'}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400 truncate font-mono">${displayUser.email}</div>
              <div class="mt-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-300 border border-emerald-300">
                ${displayUser.role || 'Farm Owner'} • ${displayUser.farmName || 'Sonoma Valley'}
              </div>
            </div>

            <div class="py-1">
              <button id="dropdown-admin-btn" class="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition cursor-pointer">
                <svg class="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                <span>Enterprise Governance Hub</span>
              </button>

              <button id="dropdown-calib-btn" class="w-full text-left px-4 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 transition cursor-pointer">
                <svg class="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
                <span>Leaf Spectrometer Calibration</span>
              </button>
            </div>

            <div class="pt-1 border-t border-slate-100 dark:border-slate-750">
              <button id="dropdown-signout-btn" class="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition cursor-pointer">
                <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                <span>Sign Out to Login Portal</span>
              </button>
            </div>
          </div>
        </div>

        <!-- EMERGENCY KILLSWITCH BUTTON -->
        <button
          type="button"
          id="header-emergency-kill-btn"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-500 border border-red-500 shadow-md transition active:scale-95 shrink-0 cursor-pointer"
          title="Emergency Stop: Closes all valves G1-G6 immediately"
        >
          <svg class="w-3.5 h-3.5 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          <span class="hidden sm:inline">KILLSWITCH</span>
        </button>

      </div>
    </div>
  `;

  // Attach event listeners for primary views
  container.querySelectorAll('.btn-primary-view-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.getAttribute('data-view-id');
      if (onSelectView) onSelectView(targetView);
      window.dispatchEvent(new CustomEvent('agrispectra_switch_view', { detail: { mode: targetView } }));
    });
  });

  const mobileViewSelect = container.querySelector('#mobile-view-select');
  if (mobileViewSelect) {
    mobileViewSelect.addEventListener('change', (e) => {
      const targetView = e.target.value;
      if (onSelectView) onSelectView(targetView);
      window.dispatchEvent(new CustomEvent('agrispectra_switch_view', { detail: { mode: targetView } }));
    });
  }

  // Attach event listeners for roles (backward compatibility)
  container.querySelectorAll('.btn-role-nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetRole = btn.getAttribute('data-role-tab');
      if (onSelectRoleView) onSelectRoleView(targetRole);
    });
  });

  container.querySelector('#header-ble-btn')?.addEventListener('click', () => {
    if (onOpenCalibration) onOpenCalibration('BLE');
  });

  container.querySelector('#header-mqtt-btn')?.addEventListener('click', () => {
    if (onOpenSimModal) onOpenSimModal();
  });

  container.querySelector('#header-emergency-kill-btn')?.addEventListener('click', () => {
    if (onEmergencyStop) onEmergencyStop();
  });

  // Mobile Reference Showcase Button
  const mobileShowcaseBtn = container.querySelector('#header-mobile-showcase-btn');
  if (mobileShowcaseBtn) {
    mobileShowcaseBtn.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('agrispectra_switch_view', { detail: { mode: 'aero-showcase' } }));
    });
  }

  // Theme Toggle Button
  const themeToggleBtn = container.querySelector('#header-theme-toggle-btn');
  const themeSelect = container.querySelector('#header-theme-select');
  if (themeToggleBtn && themeSelect) {
    themeToggleBtn.addEventListener('click', () => {
      const themes = ['creamy-agri', 'lush-emerald', 'dark-soil', 'sunlight'];
      const currentIndex = themes.indexOf(themeSelect.value);
      const nextTheme = themes[(currentIndex + 1) % themes.length];
      themeSelect.value = nextTheme;
      if (onThemeChange) onThemeChange(nextTheme);
    });

    themeSelect.addEventListener('change', (e) => {
      if (onThemeChange) onThemeChange(e.target.value);
    });
  }

  // Profile Pill & Dropdown
  const userPillBtn = container.querySelector('#header-user-pill-btn');
  const userDropdown = container.querySelector('#header-user-dropdown');
  if (userPillBtn && userDropdown) {
    userPillBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && !userPillBtn.contains(e.target)) {
        userDropdown.classList.add('hidden');
      }
    });

    container.querySelector('#dropdown-admin-btn')?.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      if (onOpenEnterpriseAdmin) onOpenEnterpriseAdmin();
    });

    container.querySelector('#dropdown-calib-btn')?.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      if (onOpenCalibration) onOpenCalibration('FULL');
    });

    container.querySelector('#dropdown-signout-btn')?.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      if (onSignOut) onSignOut();
    });
  }

  return container;
}
