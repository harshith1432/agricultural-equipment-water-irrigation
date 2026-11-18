/**
 * Header & Field Operations Bar
 * Displays live hardware links, Agricultural Theme Selector, Enterprise Admin Hub,
 * User Authentication Profile Pill, TTS language picker, and Emergency Killswitch.
 */
import { SUPPORTED_LANGUAGES, ttsEngine } from '../audio/voiceReadoutTTS.js';

export const THEME_OPTIONS = [
  { id: 'creamy-agri', label: '🌾 Cream & Green (Agri)', short: '🌾 Cream' },
  { id: 'lush-emerald', label: '🌿 Lush Emerald', short: '🌿 Emerald' },
  { id: 'sunlight', label: '☀️ Sunlight Contrast', short: '☀️ Sun' },
  { id: 'dark-soil', label: '🌙 Dark Soil', short: '🌙 Dark' }
];

export function createHeader({
  onEmergencyStop,
  onOpenCalibration,
  onOpenSimModal,
  onThemeChange,
  currentTheme = 'creamy-agri',
  bleState,
  mqttState,
  currentUser = null,
  onOpenAuthModal,
  onOpenEnterpriseAdmin,
  onSignOut
}) {
  const container = document.createElement('header');
  container.className = "w-full border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300";

  const userInitials = currentUser?.displayName
    ? currentUser.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : (currentUser?.email ? currentUser.email.substring(0, 2).toUpperCase() : 'AG');

  container.innerHTML = `
    <div class="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
      
      <!-- Brand & Mission -->
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-green-900 flex items-center justify-center shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/30 shrink-0">
          <svg class="w-6 h-6 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12a10 10 0 0 1 10-10Z"/>
            <path d="m9 12 2 2 4-4"/>
            <path d="M12 6v2"/>
            <path d="M12 16v2"/>
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 font-sans">
              AGRISPECTRA <span class="text-emeraldGlow font-medium text-xs sm:text-sm px-2 py-0.5 rounded-lg bg-emeraldGlow/10 border border-emeraldGlow/30">FLOW & FIELD</span>
            </h1>
            <span class="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-750">
              1-ACRE PRECISION
            </span>
          </div>
          <p class="text-[11px] text-slate-400 font-medium hidden sm:block">Unified Handheld Leaf Spectroscopy & Solenoid Smart Irrigation</p>
        </div>
      </div>

      <!-- Quick Status Badges, Auth & Hardware Control Hub -->
      <div class="flex items-center flex-wrap gap-2">
        
        <!-- BLE Leaf Clip Chip -->
        <button id="header-ble-btn" class="min-h-[48px] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 border ${
          bleState.connected 
            ? 'bg-emeraldGlow/15 text-emerald-700 dark:text-emeraldGlow-light border-emeraldGlow/40 shadow-sm shadow-emeraldGlow/20' 
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
        }" title="Leaf-Clip Spectrometer BLE Status">
          <span class="w-2.5 h-2.5 rounded-full ${bleState.connected ? 'bg-emeraldGlow animate-ping' : 'bg-slate-500'}"></span>
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m7 7 10 10-5 5V2l5 5L7 17"/>
          </svg>
          <span class="hidden xs:inline">${bleState.connected ? 'BLE: Active' : 'BLE: Offline'}</span>
        </button>

        <!-- MQTT Telemetry Chip -->
        <button id="header-mqtt-btn" class="min-h-[48px] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 border ${
          mqttState.running 
            ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/20' 
            : 'bg-slate-800 text-slate-400 border-slate-700'
        }" title="FDR Soil Probes & Pressure Telemetry Stream">
          <span class="w-2.5 h-2.5 rounded-full ${mqttState.running ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}"></span>
          <span>FDR IoT</span>
        </button>

        <!-- Optical Calibration Button -->
        <button id="header-calib-btn" class="min-h-[48px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition" title="Dark Current & 99% PTFE Disc Calibration">
          <svg class="w-4 h-4 text-amberPulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          <span class="hidden lg:inline">Calibrate</span>
        </button>

        <!-- ENTERPRISE ADMIN PILL (Accessible directly from header) -->
        <button id="header-admin-pill-btn" class="min-h-[48px] flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all duration-200 border bg-gradient-to-r from-amber-500/15 to-emerald-500/15 hover:from-amber-500/25 hover:to-emerald-500/25 text-amber-900 dark:text-amber-300 border-amber-500/30 shadow-sm cursor-pointer" title="Open Enterprise Admin & Governance Hub">
          <svg class="w-4 h-4 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>
          </svg>
          <span class="hidden sm:inline">Enterprise Hub</span>
          <span class="sm:hidden">Admin</span>
        </button>

        <!-- Theme Selector: Creamy Light / Emerald Green / Sunlight -->
        <div class="relative hidden sm:block">
          <select id="header-theme-select" class="min-h-[48px] appearance-none bg-emerald-950/20 dark:bg-slate-800 hover:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 text-xs font-bold pl-3 pr-8 py-2 rounded-xl border border-emerald-600/30 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm" title="Select Agricultural Visual Theme">
            ${THEME_OPTIONS.map(t => `<option value="${t.id}" ${t.id === currentTheme ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-700 dark:text-emerald-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- Regional Voice Audio TTS Selector -->
        <div class="relative hidden md:block">
          <select id="header-lang-select" class="min-h-[48px] appearance-none bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium pl-3 pr-8 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer" title="Select Voice TTS Readout Language">
            ${SUPPORTED_LANGUAGES.map(l => `<option value="${l.code}">${l.flag} ${l.label.split(' ')[0]}</option>`).join('')}
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- USER AUTHENTICATION / PROFILE TRIGGER PILL -->
        <div class="relative" id="header-user-wrapper">
          ${currentUser ? `
            <!-- Logged In Profile Pill -->
            <button id="header-user-pill-btn" class="min-h-[48px] flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-100 border border-slate-700 transition cursor-pointer shadow-sm" title="User Profile: ${currentUser.displayName || currentUser.email}">
              ${currentUser.photoURL ? `
                <img src="${currentUser.photoURL}" alt="${currentUser.displayName}" class="w-7 h-7 rounded-lg object-cover ring-1 ring-emerald-500" />
              ` : `
                <div class="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-800 text-white font-bold flex items-center justify-center text-[11px] shadow-sm">
                  ${userInitials}
                </div>
              `}
              <div class="text-left hidden xs:block">
                <div class="text-xs font-bold leading-none text-slate-100 truncate max-w-[110px]">
                  ${currentUser.displayName || currentUser.email.split('@')[0]}
                </div>
                <div class="text-[10px] text-emerald-400 font-medium leading-tight flex items-center gap-1 mt-0.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>${currentUser.role || 'Farm Owner'}</span>
                </div>
              </div>
              <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            <!-- User Dropdown Menu (Hidden by default) -->
            <div id="header-user-dropdown" class="hidden absolute right-0 mt-2 w-64 bg-[#FBF9F4] text-[#1E462A] rounded-2xl border border-[#E2D9CB] shadow-2xl py-2 z-50 animate-fadeIn font-sans">
              <div class="px-4 py-3 border-b border-stone-200">
                <div class="font-bold text-sm text-[#1E462A] truncate">${currentUser.displayName || 'Field Operator'}</div>
                <div class="text-xs text-stone-500 truncate font-mono">${currentUser.email}</div>
                <div class="mt-2 inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                  ${currentUser.role || 'Farm Owner'} • ${currentUser.farmName || 'Valley Acre'}
                </div>
              </div>

              <div class="py-1">
                <button id="dropdown-admin-btn" class="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-stone-100 text-stone-800 flex items-center gap-2.5 transition min-h-[44px] cursor-pointer">
                  <svg class="w-4 h-4 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>
                  <span>Enterprise Admin Portal</span>
                </button>

                <button id="dropdown-switch-role-btn" class="w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-stone-100 text-stone-800 flex items-center gap-2.5 transition min-h-[44px] cursor-pointer">
                  <svg class="w-4 h-4 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                  <span>Switch Account / Sign In</span>
                </button>
              </div>

              <div class="pt-1 border-t border-stone-200">
                <button id="dropdown-signout-btn" class="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-2.5 transition min-h-[44px] cursor-pointer">
                  <svg class="w-4 h-4 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ` : `
            <!-- Logged Out Sign In / Register Button -->
            <button id="header-login-btn" class="min-h-[48px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-emerald-700 to-teal-800 hover:from-emerald-600 hover:to-teal-700 border border-emerald-600/40 shadow-sm transition cursor-pointer">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
              </svg>
              <span>Sign In / Register</span>
            </button>
          `}
        </div>

        <!-- EMERGENCY 1-TAP SHUTOFF BUTTON -->
        <button id="header-emergency-kill-btn" class="min-h-[48px] flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 border border-red-500/50 shadow-md shadow-red-900/30 transition transform active:scale-95 shrink-0" title="Emergency Stop: Closes all valves G1-G6 immediately">
          <svg class="w-4 h-4 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          <span>KILLSWITCH</span>
        </button>

      </div>
    </div>
  `;

  // Attach event handlers
  container.querySelector('#header-ble-btn')?.addEventListener('click', () => {
    onOpenCalibration('BLE');
  });

  container.querySelector('#header-mqtt-btn')?.addEventListener('click', () => {
    onOpenSimModal();
  });

  container.querySelector('#header-calib-btn')?.addEventListener('click', () => {
    onOpenCalibration('FULL');
  });

  container.querySelector('#header-admin-pill-btn')?.addEventListener('click', () => {
    if (onOpenEnterpriseAdmin) onOpenEnterpriseAdmin();
  });

  container.querySelector('#header-theme-select')?.addEventListener('change', (e) => {
    if (onThemeChange) onThemeChange(e.target.value);
  });

  container.querySelector('#header-lang-select')?.addEventListener('change', (e) => {
    ttsEngine.setLanguage(e.target.value);
  });

  container.querySelector('#header-emergency-kill-btn')?.addEventListener('click', () => {
    onEmergencyStop();
  });

  // Auth / Login button
  const loginBtn = container.querySelector('#header-login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      if (onOpenAuthModal) onOpenAuthModal('SIGN_IN');
    });
  }

  // Profile Pill & Dropdown handling
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

    // Dropdown Actions
    container.querySelector('#dropdown-admin-btn')?.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      if (onOpenEnterpriseAdmin) onOpenEnterpriseAdmin();
    });

    container.querySelector('#dropdown-switch-role-btn')?.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      if (onOpenAuthModal) onOpenAuthModal('SIGN_IN');
    });

    container.querySelector('#dropdown-signout-btn')?.addEventListener('click', () => {
      userDropdown.classList.add('hidden');
      if (onSignOut) onSignOut();
    });
  }

  return container;
}
