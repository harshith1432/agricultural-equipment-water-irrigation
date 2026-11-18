/**
 * SettingsView Component
 * Comprehensive Farm Configuration, Profile Management & Field Preferences
 * Covers:
 *   1. Profile Details & Active Role (Farm Owner / Agronomist / Field Tech)
 *   2. Google Linked Account Status & Re-auth
 *   3. Farm Plot Targets (Moisture VWC % threshold & daily allocation)
 *   4. Valve Pulse Timing (50ms, 100ms, 250ms ±12V bi-stable latch)
 *   5. Offline Cache Flush (Local telemetry buffer reset with safeguard)
 *   6. Sunlight Glare Mode Toggle (High-contrast outdoor ambient viewing)
 *   7. Audio Language Selector (Voice Readout TTS & UI Localization)
 *   8. Replay Onboarding Guide
 *   9. Log Out & Switch Account
 */
import { icon } from '../utils/icons.js';
import { authService } from '../firebase/authService.js';
import { t, onLocaleChange, getLocale, setLocale, SUPPORTED_LOCALES } from '../utils/i18n.js';
import { setOnboardingCompleted } from './OnboardingCarousel.js';

export function createSettingsView({
  currentUser = null,
  onThemeChange,
  currentTheme = 'creamy-agri',
  onSignOut,
  onOpenAuthModal,
  onReplayOnboarding,
  onOpenSimModal,
  onOpenCalibration
}) {
  const container = document.createElement('div');
  container.className = "settings-view w-full space-y-4 pb-32 text-slate-800 dark:text-slate-100 select-none overflow-x-hidden";

  // Persistent settings state
  let farmTargets = {
    targetVwcPercent: 24.0,
    dailyWaterBudgetLiters: 2400,
    ...getStoredTargets()
  };

  let pulseTimingMs = getStoredPulseTiming();
  let glareModeActive = currentTheme === 'sunlight';
  let bannerMessage = null;

  function getStoredTargets() {
    try {
      const data = localStorage.getItem('agrispectra_farm_targets');
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function getStoredPulseTiming() {
    try {
      return Number(localStorage.getItem('agrispectra_solenoid_pulse_ms')) || 50;
    } catch (e) {
      return 50;
    }
  }

  function saveFarmTargets() {
    try {
      localStorage.setItem('agrispectra_farm_targets', JSON.stringify(farmTargets));
    } catch (e) {}
  }

  function savePulseTiming(ms) {
    pulseTimingMs = ms;
    try {
      localStorage.setItem('agrispectra_solenoid_pulse_ms', String(ms));
    } catch (e) {}
  }

  function render() {
    const user = currentUser || authService.getCurrentUser() || {
      displayName: "Carlos Mendoza",
      email: "carlos.mendoza@valleyfarms.com",
      role: "Farm Owner",
      isOffline: false
    };

    const isGoogleLinked = user.email && (user.email.includes('@gmail.com') || !user.isOffline);
    const activeLocaleCode = getLocale();

    container.innerHTML = `
      <!-- User Profile Card -->
      <div class="bg-gradient-to-br from-[#0E5431] to-[#083820] text-white rounded-3xl p-5 shadow-lg border border-emerald-800/40 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-full bg-emerald-700/80 border-2 border-emerald-400/50 flex items-center justify-center font-black text-lg text-white shadow-inner flex-shrink-0">
              ${(user.displayName || 'G').charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base font-bold text-white tracking-tight">${user.displayName || 'Grower Dave'}</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  ${t('profile_role')}
                </span>
              </div>
              <p class="text-xs text-emerald-200/80 font-mono mt-0.5">${user.email || 'offline.guest@agrispectra.local'}</p>
            </div>
          </div>

          <!-- Switch Role / Account -->
          <button 
            type="button" 
            id="settings-open-auth-btn"
            class="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold text-white transition cursor-pointer"
          >
            ${t('menu_profile')}
          </button>
        </div>

        <div class="pt-2 border-t border-emerald-700/40 flex items-center justify-between text-xs text-emerald-200">
          <span class="flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full ${user.isOffline ? 'bg-amber-400' : 'bg-emerald-400'}"></span>
            <span>${user.isOffline ? t('net_offline_cached') : t('net_online_synced')}</span>
          </span>
          <span class="font-mono text-emerald-300">${t('dash_parcel_title')}</span>
        </div>
      </div>

      <!-- Feedback Banner -->
      ${bannerMessage ? `
        <div class="p-3 rounded-2xl bg-emerald-50 text-[#0E5431] border border-emerald-300 text-xs font-medium flex items-center justify-between">
          <span>${bannerMessage}</span>
          <button type="button" id="dismiss-banner-btn" class="text-emerald-700 font-bold ml-2">✕</button>
        </div>
      ` : ''}

      <!-- 0. Farmer Profile & Operational Scope Editor -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('user', 'w-4 h-4 text-[#0E5431] dark:text-emerald-400')}
            <span>${t('profile_details')}</span>
          </h3>
          <span class="text-[10px] text-emerald-700 font-mono font-bold">${t('profile_role')}</span>
        </div>

        <div class="space-y-3 text-xs">
          <div>
            <label class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Full Name</label>
            <input 
              type="text" 
              id="profile-name-input" 
              value="${user.displayName || 'Carlos Mendoza'}" 
              class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500" 
            />
          </div>

          <div>
            <label class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Work Email</label>
            <input 
              type="email" 
              id="profile-email-input" 
              value="${user.email || 'carlos.mendoza@valleyfarms.com'}" 
              class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500" 
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="font-bold text-slate-700 dark:text-slate-300 block mb-1">Farm / Parcel</label>
              <input 
                type="text" 
                id="profile-farm-input" 
                value="${user.farmName || 'Sonoma Valley Parcel'}" 
                class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:ring-1 focus:ring-emerald-500" 
              />
            </div>

            <div>
              <label class="font-bold text-slate-700 dark:text-slate-300 block mb-1">${t('profile_role')}</label>
              <select 
                id="profile-role-select" 
                class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Farm Owner" ${user.role === 'Farm Owner' ? 'selected' : ''}>Farm Owner</option>
                <option value="Agronomist" ${user.role === 'Agronomist' ? 'selected' : ''}>Agronomist</option>
                <option value="Field Tech" ${user.role === 'Field Tech' ? 'selected' : ''}>Field Tech</option>
                <option value="Super Admin" ${user.role === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
              </select>
            </div>
          </div>

          <button 
            type="button" 
            id="save-profile-btn" 
            class="w-full py-2.5 rounded-xl bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold shadow-sm transition active:scale-98"
          >
            ${t('save_changes')}
          </button>
        </div>
      </div>

      <!-- 1. Google Account Link Status -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <!-- Google G SVG -->
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <div>
              <h3 class="text-xs font-bold text-slate-900 dark:text-white">${t('google_account')}</h3>
              <p class="text-[10px] text-slate-500">${isGoogleLinked ? t('google_linked') : t('net_offline_cached')}</p>
            </div>
          </div>

          <button 
            type="button" 
            id="google-link-action-btn"
            class="min-h-[36px] px-3 py-1 rounded-xl text-xs font-bold transition ${
              isGoogleLinked 
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300' 
                : 'bg-white text-slate-800 border border-slate-300 shadow-sm hover:bg-slate-50'
            }"
          >
            ${isGoogleLinked ? t('google_linked') : 'Connect'}
          </button>
        </div>
      </div>

      <!-- 2. Sunlight Glare Mode Toggle (Direct Outdoor High Contrast) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 flex items-center justify-center text-amber-500">
            ${icon('sun', 'w-4 h-4')}
          </div>
          <div>
            <h3 class="text-xs font-bold text-slate-900 dark:text-white">${t('display_glare_mode')}</h3>
            <p class="text-[10px] text-slate-500">${t('display_glare_desc')}</p>
          </div>
        </div>

        <button 
          type="button" 
          id="toggle-glare-mode-btn"
          class="min-h-[38px] px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
            glareModeActive 
              ? 'bg-amber-500 text-slate-950 font-black shadow-md' 
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }"
        >
          <span>${glareModeActive ? 'ACTIVE ☀️' : t('valve_on')}</span>
        </button>
      </div>

      <!-- 3. Farm Plot Targets (Agronomic Moisture & Water Budget) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('sprout', 'w-4 h-4 text-[#0E5431] dark:text-emerald-400')}
            <span>${t('farm_plot_targets')}</span>
          </h3>
          <span class="text-[10px] text-emerald-700 font-mono font-bold">${t('gates_cumulative')}</span>
        </div>

        <div class="space-y-3 text-xs">
          <!-- Target VWC % Threshold -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-slate-600 dark:text-slate-400 font-medium">${t('root_zone_vwc')}</label>
              <span id="vwc-val-display" class="font-mono font-bold text-[#0E5431] dark:text-emerald-300">${farmTargets.targetVwcPercent}%</span>
            </div>
            <input 
              type="range" 
              id="target-vwc-range" 
              min="15" 
              max="35" 
              step="0.5" 
              value="${farmTargets.targetVwcPercent}" 
              class="w-full accent-[#0E5431] cursor-pointer"
            />
            <span class="text-[10px] text-slate-400">${t('target_vwc_range')}</span>
          </div>

          <!-- Daily Water Budget -->
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-slate-600 dark:text-slate-400 font-medium">${t('daily_water_budget')}</label>
              <span id="budget-val-display" class="font-mono font-bold text-blue-600">${farmTargets.dailyWaterBudgetLiters} L</span>
            </div>
            <input 
              type="range" 
              id="water-budget-range" 
              min="1000" 
              max="5000" 
              step="100" 
              value="${farmTargets.dailyWaterBudgetLiters}" 
              class="w-full accent-blue-600 cursor-pointer"
            />
            <span class="text-[10px] text-slate-400">${t('daily_water_budget')}</span>
          </div>
        </div>
      </div>

      <!-- 4. Solenoid Valve Pulse Timing -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('zap', 'w-4 h-4 text-amber-500')}
            <span>${t('solenoid_pulse_timing')}</span>
          </h3>
          <span class="text-[10px] font-mono text-slate-400">${t('latching_12v')}</span>
        </div>
        <p class="text-[10px] text-slate-500">${t('solenoid_pulse_desc')}</p>

        <div class="grid grid-cols-3 gap-2">
          ${[
            { ms: 50, label: '50 ms', desc: t('bistable_zero_current') },
            { ms: 100, label: '100 ms', desc: t('optimal_ph_range') },
            { ms: 250, label: '250 ms', desc: t('pressure_bar') }
          ].map(p => `
            <button 
              type="button" 
              data-pulse-ms="${p.ms}"
              class="pulse-timing-btn p-2.5 rounded-2xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                pulseTimingMs === p.ms 
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-[#0E5431] dark:text-emerald-300 font-bold shadow-sm' 
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-100'
              }"
            >
              <span class="text-xs font-bold font-mono">${p.label}</span>
              <span class="text-[9px] text-slate-400 mt-0.5 leading-tight">${p.desc}</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- 5. Regional Audio Language (Voice Readout TTS & UI) -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-2.5">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            ${icon('globe', 'w-4 h-4 text-emerald-600')}
            <span>${t('audio_voice_language')}</span>
          </h3>
          <span class="text-[10px] font-mono text-slate-400">${SUPPORTED_LOCALES.length} Languages</span>
        </div>

        <select id="settings-language-select" class="w-full min-h-[44px] px-3.5 py-2 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer">
          ${SUPPORTED_LOCALES.map(loc => `
            <option value="${loc.code}" ${loc.code === activeLocaleCode ? 'selected' : ''}>
              ${loc.native || loc.name} (${loc.name})
            </option>
          `).join('')}
        </select>
      </div>

      <!-- 6. Offline Cache Flush & Guide Replay -->
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-2.5">
        <h3 class="text-xs font-bold text-slate-900 dark:text-white">${t('offline_telemetry_cache')}</h3>

        <div class="grid grid-cols-2 gap-2">
          <!-- Replay Onboarding Guide -->
          <button 
            type="button" 
            id="replay-onboard-btn"
            class="min-h-[44px] p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            ${icon('helpCircle', 'w-4 h-4 text-emerald-600')}
            <span>${t('replay_onboarding')}</span>
          </button>

          <!-- Flush Offline Cache -->
          <button 
            type="button" 
            id="flush-cache-btn"
            class="min-h-[44px] p-2.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            ${icon('trash', 'w-4 h-4')}
            <span>${t('clear_cache')}</span>
          </button>
        </div>
      </div>

      <!-- 7. Log Out Button -->
      <div class="pt-2">
        <button 
          type="button" 
          id="settings-logout-btn"
          class="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs sm:text-sm border border-rose-200 shadow-sm flex items-center justify-center gap-2 transition duration-200 cursor-pointer active:scale-98"
        >
          ${icon('logOut', 'w-4 h-4 text-rose-600')}
          <span>${t('logout_session')}</span>
        </button>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const user = currentUser || authService.getCurrentUser() || {
      displayName: "Carlos Mendoza",
      email: "carlos.mendoza@valleyfarms.com",
      role: "Farm Owner",
      farmName: "Sonoma Valley Parcel"
    };

    // Save Profile Changes
    container.querySelector('#save-profile-btn')?.addEventListener('click', () => {
      const name = container.querySelector('#profile-name-input')?.value?.trim();
      const email = container.querySelector('#profile-email-input')?.value?.trim();
      const farm = container.querySelector('#profile-farm-input')?.value?.trim();
      const role = container.querySelector('#profile-role-select')?.value;

      if (name) {
        const updated = {
          ...user,
          displayName: name,
          email: email || user.email,
          farmName: farm || user.farmName,
          role: role || user.role
        };
        authService.currentUser = updated;
        try {
          localStorage.setItem('agrispectra_current_user', JSON.stringify(updated));
        } catch (e) {}
        bannerMessage = "Profile updated successfully.";
        render();
      }
    });

    // Open Auth Modal
    container.querySelector('#settings-open-auth-btn')?.addEventListener('click', () => {
      if (onOpenAuthModal) onOpenAuthModal();
    });

    container.querySelector('#google-link-action-btn')?.addEventListener('click', async () => {
      try {
        const res = await authService.signInWithGoogle();
        bannerMessage = `Google Account linked: ${res.user?.email || res.displayName || 'Authorized'}`;
        render();
      } catch (e) {
        bannerMessage = `Google Link notice: ${e.message}`;
        render();
      }
    });

    // Dismiss banner
    container.querySelector('#dismiss-banner-btn')?.addEventListener('click', () => {
      bannerMessage = null;
      render();
    });

    // Glare Mode Toggle
    container.querySelector('#toggle-glare-mode-btn')?.addEventListener('click', () => {
      glareModeActive = !glareModeActive;
      const targetTheme = glareModeActive ? 'sunlight' : 'creamy-agri';
      if (onThemeChange) onThemeChange(targetTheme);
      bannerMessage = glareModeActive 
        ? "Sunlight Glare Mode activated for outdoor field visibility." 
        : "Standard Cream & Green agricultural theme restored.";
      render();
    });

    // Farm target range inputs
    const vwcRange = container.querySelector('#target-vwc-range');
    const vwcDisplay = container.querySelector('#vwc-val-display');
    if (vwcRange && vwcDisplay) {
      vwcRange.addEventListener('input', (e) => {
        farmTargets.targetVwcPercent = Number(e.target.value);
        vwcDisplay.textContent = `${farmTargets.targetVwcPercent}%`;
        saveFarmTargets();
      });
    }

    const budgetRange = container.querySelector('#water-budget-range');
    const budgetDisplay = container.querySelector('#budget-val-display');
    if (budgetRange && budgetDisplay) {
      budgetRange.addEventListener('input', (e) => {
        farmTargets.dailyWaterBudgetLiters = Number(e.target.value);
        budgetDisplay.textContent = `${farmTargets.dailyWaterBudgetLiters} L`;
        saveFarmTargets();
      });
    }

    // Pulse timing buttons
    container.querySelectorAll('.pulse-timing-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ms = Number(btn.getAttribute('data-pulse-ms'));
        if (ms) {
          savePulseTiming(ms);
          bannerMessage = `Solenoid pulse width updated to ${ms} ms (±12V DC).`;
          render();
        }
      });
    });

    // Language selector
    container.querySelector('#settings-language-select')?.addEventListener('change', (e) => {
      const code = e.target.value;
      setLocale(code);
      bannerMessage = `Regional voice language updated.`;
      render();
    });

    // Replay Onboarding
    container.querySelector('#replay-onboard-btn')?.addEventListener('click', () => {
      setOnboardingCompleted(false);
      if (onReplayOnboarding) onReplayOnboarding();
    });

    // Flush cache
    container.querySelector('#flush-cache-btn')?.addEventListener('click', () => {
      if (window.confirm("Flush offline telemetry buffer and cached scan vectors? Any unsaved local edits will be cleared.")) {
        try {
          localStorage.removeItem('agrispectra_offline_mutation_queue');
          localStorage.removeItem('agrispectra_last_telemetry');
          bannerMessage = "Offline cache flushed successfully. Storage refreshed.";
          render();
        } catch (e) {
          bannerMessage = "Error flushing cache: " + e.message;
          render();
        }
      }
    });

    // Log Out
    container.querySelector('#settings-logout-btn')?.addEventListener('click', async () => {
      if (window.confirm("Are you sure you want to log out of this field terminal?")) {
        await authService.signOut();
        if (onSignOut) onSignOut();
        else if (onOpenAuthModal) onOpenAuthModal();
      }
    });
  }

  onLocaleChange(() => render());

  render();
  return container;
}
