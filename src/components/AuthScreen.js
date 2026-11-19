/**
 * AgriSpectra Full-Screen Authentication & Registration Screen
 * Dedicated mobile & responsive entrypoint for unauthenticated visitors.
 * 
 * Features:
 *  - Native Google Play Services Credential Manager / Firebase Google OAuth One-Tap
 *  - Email & Password Sign In with brute-force lockout protection (OWASP MASVS-AUTH)
 *  - Multi-Role Account Creation & Registration (Farm Owner, Agronomist, Field Tech)
 *  - Offline Field Guest Mode for zero-reception rural field operations
 *  - Multilingual Language Selector (EN, HI, KN, TE, TA, ML, MR, ES)
 *  - Visual Theme Selector
 *  - 1-Click Instant Demo Persona Access (Farm Owner, Agronomist, Field Tech, SuperAdmin)
 *  - Forest Green (#1E462A) & Earth Cream (#FBF9F4) Agricultural Palette
 */

import { authService } from '../firebase/authService.js';
import { t, getLocale, setLocale, onLocaleChange, SUPPORTED_LOCALES } from '../utils/i18n.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createAuthScreen({ onAuthSuccess, onThemeChange, currentTheme = 'creamy-agri' }) {
  const container = document.createElement('div');
  container.className = "w-full min-h-screen min-h-[100dvh] flex flex-col bg-[#FBF9F4] dark:bg-[#0a1a0f] text-[#1E462A] dark:text-emerald-100 transition-colors duration-300 selection:bg-[#1E462A] selection:text-white";

  let mode = 'SIGN_IN'; // 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD'
  let showPassword = false;
  let rememberMe = true;
  let selectedRole = 'Farm Owner'; // 'Farm Owner' | 'Agronomist' | 'Field Tech'
  let bannerState = null; // { type: 'success' | 'error', message: string }
  let isSubmitting = false;
  let showDemoAccordion = false;
  let currentEmail = '';
  let currentPassword = '';
  let currentName = '';
  let currentFarm = '';

  function syncFormState() {
    const emailInput = container.querySelector('#portal-email-input, #auth-email-input');
    const passwordInput = container.querySelector('#auth-password-input');
    const nameInput = container.querySelector('#auth-name-input');
    const farmInput = container.querySelector('#auth-farm-input');
    if (emailInput && typeof emailInput.value === 'string') currentEmail = emailInput.value;
    if (passwordInput && typeof passwordInput.value === 'string') currentPassword = passwordInput.value;
    if (nameInput && typeof nameInput.value === 'string') currentName = nameInput.value;
    if (farmInput && typeof farmInput.value === 'string') currentFarm = farmInput.value;
  }

  function render() {
    syncFormState();
    const activeLocale = getLocale();

    container.innerHTML = `
      <!-- Top Navigation Header: Branding + Language + Theme Switcher -->
      <header class="w-full px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-[#E5DDCF] dark:border-emerald-950/80 bg-white/70 dark:bg-[#0c2214]/80 backdrop-blur-md sticky top-0 z-30">
        <div class="flex items-center gap-2.5 min-w-0">
          <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#1E462A] via-[#2A603B] to-[#12301A] flex items-center justify-center text-white shadow-md shadow-emerald-950/30 ring-2 ring-emerald-500/20 shrink-0">
            <svg class="w-5 h-5 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12a10 10 0 0 1 10-10Z"/>
              <path d="m9 12 2 2 4-4"/>
              <path d="M12 6v2"/>
              <path d="M12 16v2"/>
            </svg>
          </div>
          <div class="min-w-0">
            <span class="text-xs sm:text-sm font-black tracking-tight text-[#1E462A] dark:text-white uppercase font-sans block truncate">
              AGRISPECTRA FLOW & FIELD
            </span>
            <span class="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono hidden sm:block">
              Precision Agronomy & Hydraulic Infrastructure
            </span>
          </div>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <!-- Multilingual Language Selector -->
          <div class="relative">
            <select id="auth-lang-select" class="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-xs font-bold text-[#1E462A] dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm">
              ${SUPPORTED_LOCALES.map(loc => `
                <option value="${loc.code}" ${loc.code === activeLocale ? 'selected' : ''}>
                  ${loc.native} (${loc.name})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Theme Selector -->
          <select id="auth-theme-select" class="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-xs font-bold text-[#1E462A] dark:text-emerald-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm hidden xs:block">
            <option value="creamy-agri" ${currentTheme === 'creamy-agri' ? 'selected' : ''}>🌾 Cream & Green</option>
            <option value="lush-emerald" ${currentTheme === 'lush-emerald' ? 'selected' : ''}>🌿 Lush Emerald</option>
            <option value="sunlight" ${currentTheme === 'sunlight' ? 'selected' : ''}>☀️ Sunlight</option>
            <option value="dark-soil" ${currentTheme === 'dark-soil' ? 'selected' : ''}>🌙 Dark Soil</option>
          </select>
        </div>
      </header>

      <!-- Main Scrollable Content Area -->
      <main class="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:py-12 max-w-lg mx-auto w-full">
        
        <!-- Auth Card Container -->
        <div class="w-full bg-white dark:bg-[#0c2214] rounded-3xl border border-[#E5DDCF] dark:border-emerald-950/80 shadow-2xl shadow-emerald-950/10 overflow-hidden transition-all duration-300 animate-fadeIn">
          
          <!-- Card Header / Agricultural Hero Banner -->
          <div class="relative bg-gradient-to-br from-[#1E462A] via-[#2A603B] to-[#12301A] text-white p-6 sm:p-7">
            <!-- Botanical SVG Pattern Background -->
            <div class="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
              <svg class="w-full h-full" viewBox="0 0 400 200" fill="none">
                <path d="M0 100 C 150 200, 250 0, 400 100" stroke="#FFF" stroke-width="4" fill="none"/>
                <circle cx="50" cy="50" r="30" stroke="#FFF" stroke-width="2"/>
                <circle cx="350" cy="150" r="50" stroke="#FFF" stroke-width="2"/>
              </svg>
            </div>

            <div class="relative z-10">
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-[11px] font-mono font-bold uppercase tracking-wider mb-2.5">
                <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                <span>${mode === 'SIGN_IN' ? t('auth_status_secure', 'SECURE FIELD TERMINAL') : (mode === 'SIGN_UP' ? t('auth_status_register', 'NEW FARM REGISTRATION') : t('auth_status_recovery', 'ACCOUNT RECOVERY'))}</span>
              </div>

              <h1 class="text-xl sm:text-2xl font-black tracking-tight text-white leading-tight">
                ${mode === 'SIGN_IN' 
                  ? t('auth_welcome_title', 'Welcome to AgriSpectra') 
                  : (mode === 'SIGN_UP' 
                      ? t('auth_create_title', 'Create Farm Account') 
                      : t('auth_reset_title', 'Reset Password'))}
              </h1>

              <p class="text-xs sm:text-sm text-emerald-100/90 mt-1.5 font-medium leading-relaxed">
                ${mode === 'SIGN_IN' 
                  ? t('auth_signin_desc', 'Sign in to access your 6-zone precision irrigation & leaf spectroscopy terminal.') 
                  : (mode === 'SIGN_UP' 
                      ? t('auth_signup_desc', 'Equip your farm team with real-time closed-loop telemetry & chemometrics.') 
                      : t('auth_forgot_desc', 'Enter your registered email address to receive immediate password reset steps.'))}
              </p>

              <!-- Segmented Tab Toggle (Sign In vs Create Account) -->
              ${(mode === 'SIGN_IN' || mode === 'SIGN_UP') ? `
                <div class="mt-5 flex bg-black/30 p-1 rounded-2xl border border-white/15 backdrop-blur-sm">
                  <button type="button" id="tab-mode-signin" class="flex-1 py-2 rounded-xl text-xs font-extrabold transition-all text-center cursor-pointer ${mode === 'SIGN_IN' ? 'bg-white text-[#1E462A] shadow-md shadow-black/20' : 'text-emerald-100/80 hover:text-white'}">
                    ${t('sign_in', 'Sign In')}
                  </button>
                  <button type="button" id="tab-mode-signup" class="flex-1 py-2 rounded-xl text-xs font-extrabold transition-all text-center cursor-pointer ${mode === 'SIGN_UP' ? 'bg-white text-[#1E462A] shadow-md shadow-black/20' : 'text-emerald-100/80 hover:text-white'}">
                    ${t('create_account', 'Create Account')}
                  </button>
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Notification Banner (Alerts, Lockouts, Success) -->
          ${bannerState ? `
            <div class="mx-5 mt-5 p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-3 animate-fadeIn ${
              bannerState.type === 'success' 
                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 shadow-sm' 
                : 'bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-300 dark:border-rose-700 shadow-sm'
            }">
              <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${bannerState.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}">
                ${bannerState.type === 'success' 
                  ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' 
                  : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'}
              </div>
              <span class="flex-1">${escapeHtml(bannerState.message)}</span>
            </div>
          ` : ''}

          <!-- Form Body -->
          <div class="p-5 sm:p-7 space-y-4">
            
            ${(mode === 'SIGN_IN' || mode === 'SIGN_UP') ? `
              <!-- 1-Tap Google Sign-In (Credential Manager) -->
              <button 
                type="button" 
                id="btn-google-auth" 
                class="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 hover:bg-stone-50 dark:hover:bg-slate-800 text-stone-800 dark:text-stone-100 font-bold text-xs sm:text-sm border border-[#DDD5C7] dark:border-emerald-900 shadow-sm hover:shadow flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer active:scale-[0.98]"
              >
                <!-- Official Multi-Color Google G SVG -->
                <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <span>${t('continue_with_google', 'Continue with Google')}</span>
              </button>

              <!-- Offline Field Guest Access Button -->
              <button 
                type="button" 
                id="btn-offline-guest" 
                class="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-amber-50/80 hover:bg-amber-100 dark:bg-amber-950/30 dark:hover:bg-amber-950/50 text-amber-950 dark:text-amber-200 font-semibold text-xs border border-amber-300/80 dark:border-amber-700/60 shadow-sm flex items-center justify-between transition-all duration-200 cursor-pointer active:scale-[0.98]"
              >
                <div class="flex items-center gap-2.5 text-left">
                  <span class="w-7 h-7 rounded-lg bg-amber-200/80 dark:bg-amber-900/60 flex items-center justify-center text-amber-900 dark:text-amber-300 shrink-0">
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="1" y1="1" x2="23" y2="23"/>
                      <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                      <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                      <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
                      <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                      <line x1="12" y1="20" x2="12.01" y2="20"/>
                    </svg>
                  </span>
                  <div>
                    <div class="font-bold text-amber-950 dark:text-amber-200 text-xs">
                      ${t('continue_offline_guest', 'Continue as Offline Field Guest')}
                    </div>
                    <div class="text-[10px] text-amber-800 dark:text-amber-300/80">
                      ${t('offline_guest_sub', 'Zero cellular reception • Direct BLE & Local Cache')}
                    </div>
                  </div>
                </div>
                <span class="text-[10px] font-mono font-bold bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded-md">
                  0ms Boot
                </span>
              </button>

              <!-- Organic Divider -->
              <div class="relative flex items-center justify-center my-3">
                <div class="border-t border-[#E5DDCF] dark:border-emerald-950 w-full"></div>
                <span class="bg-white dark:bg-[#0c2214] px-3 text-[11px] font-bold text-stone-400 dark:text-emerald-500/80 uppercase tracking-wider">
                  ${mode === 'SIGN_IN' ? t('or_signin_email', 'or sign in with email') : t('or_register_email', 'or create with email')}
                </span>
              </div>
            ` : ''}

            <!-- Main Interactive Form -->
            <form id="auth-main-form" class="space-y-3.5">
              
              <!-- FORGOT PASSWORD MODE -->
              ${mode === 'FORGOT_PASSWORD' ? `
                <div>
                  <label class="block text-xs font-bold text-[#1E462A] dark:text-emerald-200 mb-1">
                    ${t('work_email_label', 'Registered Work Email')}
                  </label>
                  <div class="relative">
                    <input 
                      type="email" 
                      id="portal-email-input" 
                      data-testid="auth-email-input"
                      required 
                      value="${escapeHtml(currentEmail)}"
                      placeholder="grower@agrispectra.io" 
                      class="auth-email-input w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-stone-900 dark:text-white placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] transition"
                    />
                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/></svg>
                    </div>
                  </div>
                  <p class="text-[11px] text-stone-500 dark:text-emerald-400/80 mt-1.5">
                    ${t('forgot_password_help', 'We will send instantaneous password reset instructions directly to your email.')}
                  </p>
                </div>
              ` : `
                <!-- SIGN UP FIELDS: Name, Farm Name, Role -->
                ${mode === 'SIGN_UP' ? `
                  <div>
                    <label class="block text-xs font-bold text-[#1E462A] dark:text-emerald-200 mb-1">
                      ${t('full_name_label', 'Full Name')}
                    </label>
                    <input 
                      type="text" 
                      id="auth-name-input" 
                      required 
                      value="${escapeHtml(currentName)}"
                      placeholder="e.g. Ramesh Patel / Sarah Jenkins" 
                      class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-stone-900 dark:text-white placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] transition"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-[#1E462A] dark:text-emerald-200 mb-1">
                      ${t('farm_name_label', 'Farm / Enterprise Name')}
                    </label>
                    <input 
                      type="text" 
                      id="auth-farm-input" 
                      required 
                      value="${escapeHtml(currentFarm)}"
                      placeholder="e.g. Sonoma Valley Parcel / Deccan Agri Block" 
                      class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-stone-900 dark:text-white placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] transition"
                    />
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-[#1E462A] dark:text-emerald-200 mb-1.5">
                      ${t('operational_role_label', 'Operational Persona / Role')}
                    </label>
                    <div class="grid grid-cols-3 gap-2">
                      ${[
                        { id: 'Farm Owner', label: 'Farm Owner', icon: '👨‍🌾' },
                        { id: 'Agronomist', label: 'Agronomist', icon: '🔬' },
                        { id: 'Field Tech', label: 'Field Tech', icon: '💧' }
                      ].map(r => `
                        <button 
                          type="button" 
                          data-role="${r.id}" 
                          class="role-select-btn min-h-[46px] px-2 py-2 rounded-xl text-xs font-bold border transition flex flex-col items-center justify-center cursor-pointer ${
                            selectedRole === r.id 
                              ? 'bg-[#1E462A] text-white border-[#1E462A] shadow-md shadow-emerald-950/20 ring-2 ring-emerald-500/40' 
                              : 'bg-stone-50 dark:bg-slate-900 text-stone-700 dark:text-emerald-200 border-[#DDD5C7] dark:border-emerald-800 hover:bg-stone-100 dark:hover:bg-slate-800'
                          }"
                        >
                          <span class="text-base mb-0.5">${r.icon}</span>
                          <span class="leading-tight text-[11px]">${r.label}</span>
                        </button>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- EMAIL ADDRESS -->
                <div>
                  <label class="block text-xs font-bold text-[#1E462A] dark:text-emerald-200 mb-1">
                    ${t('work_email_label', 'Work Email')}
                  </label>
                  <div class="relative">
                    <input 
                      type="email" 
                      id="portal-email-input" 
                      data-testid="auth-email-input"
                      required 
                      value="${escapeHtml(currentEmail)}"
                      placeholder="grower@agrispectra.io" 
                      class="auth-email-input w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-stone-900 dark:text-white placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] transition"
                    />
                    <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/></svg>
                    </div>
                  </div>
                </div>

                <!-- PASSWORD -->
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="block text-xs font-bold text-[#1E462A] dark:text-emerald-200">
                      ${t('password_label', 'Password')}
                    </label>
                    ${mode === 'SIGN_IN' ? `
                      <button type="button" id="auth-goto-forgot" class="text-xs text-[#10B981] hover:text-[#059669] font-bold transition hover:underline cursor-pointer">
                        ${t('forgot_password', 'Forgot Password?')}
                      </button>
                    ` : ''}
                  </div>
                  <div class="relative">
                    <input 
                      type="${showPassword ? 'text' : 'password'}" 
                      id="auth-password-input" 
                      required 
                      minlength="6" 
                      value="${escapeHtml(currentPassword)}"
                      placeholder="••••••••••••" 
                      class="w-full min-h-[46px] px-3.5 pr-12 py-2.5 rounded-xl bg-stone-50 dark:bg-slate-900 border border-[#DDD5C7] dark:border-emerald-800 text-stone-900 dark:text-white placeholder-stone-400 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] transition font-mono"
                    />
                    <!-- Eye toggle -->
                    <button type="button" id="auth-toggle-pwd" class="absolute inset-y-0 right-0 px-3.5 min-h-[46px] flex items-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition cursor-pointer" title="${showPassword ? 'Hide password' : 'Show password'}">
                      ${showPassword ? `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                      ` : `
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      `}
                    </button>
                  </div>
                </div>

                <!-- Remember Me (Sign In only) -->
                ${mode === 'SIGN_IN' ? `
                  <div class="flex items-center gap-2 pt-0.5">
                    <input type="checkbox" id="auth-remember-check" ${rememberMe ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 cursor-pointer" />
                    <label for="auth-remember-check" class="text-xs text-stone-600 dark:text-emerald-300 select-none cursor-pointer">
                      ${t('stay_signed_in', 'Stay signed in on this field terminal')}
                    </label>
                  </div>
                ` : ''}
              `}

              <!-- Submit Button -->
              <button 
                type="submit" 
                id="portal-submit-btn" 
                data-testid="auth-submit-btn"
                ${isSubmitting ? 'disabled' : ''} 
                class="auth-submit-btn w-full min-h-[48px] px-4 py-3 rounded-2xl bg-gradient-to-r from-[#1E462A] to-[#10B981] hover:from-[#173821] hover:to-[#059669] text-white font-black text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-3"
              >
                ${isSubmitting ? `
                  <svg class="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>${t('processing_auth', 'Authorizing...')}</span>
                ` : (
                  mode === 'SIGN_IN' 
                    ? t('btn_signin_farm', 'Sign In to Farm') 
                    : (mode === 'SIGN_UP' ? t('btn_create_farm', 'Create Farm Account') : t('btn_send_reset', 'Send Password Reset Link'))
                )}
              </button>
            </form>

            <!-- Mode Switch Footer Link -->
            <div class="pt-3 border-t border-[#E5DDCF] dark:border-emerald-950 text-center text-xs text-stone-600 dark:text-emerald-300/80">
              ${mode === 'SIGN_IN' ? `
                <span>${t('no_account_prompt', "Don't have an enterprise account?")}</span>
                <button type="button" id="auth-goto-signup" class="ml-1.5 font-bold text-[#1E462A] dark:text-emerald-400 hover:text-[#10B981] transition cursor-pointer hover:underline">
                  ${t('create_account', 'Create Account')}
                </button>
              ` : (mode === 'SIGN_UP' ? `
                <span>${t('have_account_prompt', 'Already have an account?')}</span>
                <button type="button" id="auth-goto-signin" class="ml-1.5 font-bold text-[#1E462A] dark:text-emerald-400 hover:text-[#10B981] transition cursor-pointer hover:underline">
                  ${t('sign_in', 'Sign In')}
                </button>
              ` : `
                <button type="button" id="auth-goto-signin" class="inline-flex items-center gap-1.5 font-bold text-[#1E462A] dark:text-emerald-400 hover:text-[#10B981] transition cursor-pointer hover:underline">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                  <span>${t('back_to_signin', 'Back to Sign In')}</span>
                </button>
              `)}
            </div>

            <!-- Instant Demo Roles (1-Click Test Drive Accordion) -->
            <div class="pt-2 border-t border-[#E5DDCF] dark:border-emerald-950">
              <button 
                type="button" 
                id="btn-toggle-demo-roles" 
                class="w-full py-2 px-3 rounded-xl bg-stone-100 dark:bg-slate-900/80 hover:bg-stone-200 dark:hover:bg-slate-800 text-[#1E462A] dark:text-emerald-300 font-bold text-xs flex items-center justify-between transition cursor-pointer"
              >
                <div class="flex items-center gap-2">
                  <span>🧪</span>
                  <span>${t('demo_roles_title', 'Instant Test Profiles (1-Click Demo)')}</span>
                </div>
                <svg class="w-4 h-4 transition-transform duration-200 ${showDemoAccordion ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
              </button>

              ${showDemoAccordion ? `
                <div class="grid grid-cols-2 gap-2 mt-2.5 animate-fadeIn">
                  <!-- Demo 1: Farm Owner -->
                  <button type="button" data-demo-role="Farm Owner" class="btn-demo-persona p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 text-left hover:bg-amber-100 dark:hover:bg-amber-950/50 transition cursor-pointer">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm">👨‍🌾</span>
                      <div class="font-bold text-[11px] text-amber-950 dark:text-amber-200 truncate">Farm Owner (Demo)</div>
                    </div>
                    <div class="text-[9px] font-mono text-amber-800 dark:text-amber-300 mt-0.5">Executive Workspace • 6 Zones</div>
                  </button>

                  <!-- Demo 2: Agronomist -->
                  <button type="button" data-demo-role="Agronomist" class="btn-demo-persona p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30 border border-teal-300 dark:border-teal-700 text-left hover:bg-teal-100 dark:hover:bg-teal-950/50 transition cursor-pointer">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm">🔬</span>
                      <div class="font-bold text-[11px] text-teal-950 dark:text-teal-200 truncate">Agronomist (Demo)</div>
                    </div>
                    <div class="text-[9px] font-mono text-teal-800 dark:text-teal-300 mt-0.5">Spectroscopy & Crop Science</div>
                  </button>

                  <!-- Demo 3: Field Operator -->
                  <button type="button" data-demo-role="Field Operator" class="btn-demo-persona p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-300 dark:border-blue-700 text-left hover:bg-blue-100 dark:hover:bg-blue-950/50 transition cursor-pointer">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm">💧</span>
                      <div class="font-bold text-[11px] text-blue-950 dark:text-blue-200 truncate">Field Tech (Demo)</div>
                    </div>
                    <div class="text-[9px] font-mono text-blue-800 dark:text-blue-300 mt-0.5">±12V Solenoids & Valves</div>
                  </button>

                  <!-- Demo 4: SuperAdmin -->
                  <button type="button" data-demo-role="SuperAdmin" class="btn-demo-persona p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-300 dark:border-purple-700 text-left hover:bg-purple-100 dark:hover:bg-purple-950/50 transition cursor-pointer">
                    <div class="flex items-center gap-1.5">
                      <span class="text-sm">🛡️</span>
                      <div class="font-bold text-[11px] text-purple-950 dark:text-purple-200 truncate">SuperAdmin (Demo)</div>
                    </div>
                    <div class="text-[9px] font-mono text-purple-800 dark:text-purple-300 mt-0.5">Multi-Tenant Governance</div>
                  </button>
                </div>
              ` : ''}
            </div>

          </div>
        </div>

        <!-- Footer Notice -->
        <footer class="mt-6 text-center text-[11px] text-stone-500 dark:text-emerald-500/70 font-mono space-y-1">
          <div>AgriSpectra Flow & Field • Precision Agronomy Infrastructure</div>
          <div>AES-256 Encrypted Session • ±12V Hydraulic Solenoid Control</div>
        </footer>

      </main>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Language change
    const langSelect = container.querySelector('#auth-lang-select');
    langSelect?.addEventListener('change', (e) => {
      setLocale(e.target.value);
      render();
    });

    // Theme change
    const themeSelect = container.querySelector('#auth-theme-select');
    themeSelect?.addEventListener('change', (e) => {
      if (onThemeChange) onThemeChange(e.target.value);
    });

    // Tabs
    container.querySelector('#tab-mode-signin')?.addEventListener('click', () => {
      mode = 'SIGN_IN';
      bannerState = null;
      render();
    });

    container.querySelector('#tab-mode-signup')?.addEventListener('click', () => {
      mode = 'SIGN_UP';
      bannerState = null;
      render();
    });

    container.querySelector('#auth-goto-signup')?.addEventListener('click', () => {
      mode = 'SIGN_UP';
      bannerState = null;
      render();
    });

    container.querySelector('#auth-goto-signin')?.addEventListener('click', () => {
      mode = 'SIGN_IN';
      bannerState = null;
      render();
    });

    container.querySelector('#auth-goto-forgot')?.addEventListener('click', () => {
      mode = 'FORGOT_PASSWORD';
      bannerState = null;
      render();
    });

    // Toggle demo accordion
    container.querySelector('#btn-toggle-demo-roles')?.addEventListener('click', () => {
      showDemoAccordion = !showDemoAccordion;
      render();
    });

    // Toggle password eye
    container.querySelector('#auth-toggle-pwd')?.addEventListener('click', () => {
      showPassword = !showPassword;
      render();
    });

    // Role selector buttons
    container.querySelectorAll('.role-select-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRole = btn.getAttribute('data-role') || 'Farm Owner';
        render();
      });
    });

    // 1-Click Demo Persona buttons
    container.querySelectorAll('.btn-demo-persona').forEach(btn => {
      btn.addEventListener('click', async () => {
        const role = btn.getAttribute('data-demo-role');
        try {
          isSubmitting = true;
          bannerState = null;
          render();
          const user = await authService.loginAsDemoRole(role);
          bannerState = { type: 'success', message: `Entering as ${user.displayName} (${user.role})...` };
          render();
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(user);
          }, 350);
        } catch (err) {
          isSubmitting = false;
          bannerState = { type: 'error', message: err.message || "Failed to launch demo role." };
          render();
        }
      });
    });

    // One-Tap Google Sign-In
    container.querySelector('#btn-google-auth')?.addEventListener('click', async () => {
      try {
        isSubmitting = true;
        bannerState = null;
        render();
        const res = await authService.signInWithGoogle({ role: selectedRole });
        if (res && res.success === false) throw new Error(res.message);
        const user = res.user || res;
        bannerState = { type: 'success', message: `Welcome back, ${user.displayName || user.email}!` };
        render();
        setTimeout(() => {
          if (onAuthSuccess) onAuthSuccess(user);
        }, 500);
      } catch (err) {
        isSubmitting = false;
        bannerState = { type: 'error', message: err.message || "Google authentication was cancelled or interrupted." };
        render();
      }
    });

    // Continue as Offline Field Guest
    container.querySelector('#btn-offline-guest')?.addEventListener('click', async () => {
      try {
        isSubmitting = true;
        bannerState = null;
        render();
        const user = authService.signInAsGuest();
        bannerState = { type: 'success', message: "Continuing in Offline Field Guest Mode..." };
        render();
        setTimeout(() => {
          if (onAuthSuccess) onAuthSuccess(user);
        }, 350);
      } catch (err) {
        isSubmitting = false;
        bannerState = { type: 'error', message: err.message || "Failed to start offline session." };
        render();
      }
    });

    // Main Form Submit
    const form = container.querySelector('#auth-main-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (isSubmitting) return;

      const emailInput = container.querySelector('#portal-email-input, #auth-email-input');
      const passwordInput = container.querySelector('#auth-password-input');
      const nameInput = container.querySelector('#auth-name-input');
      const farmInput = container.querySelector('#auth-farm-input');
      const rememberCheck = container.querySelector('#auth-remember-check');

      const email = emailInput?.value?.trim();
      const password = passwordInput?.value;
      const name = nameInput?.value?.trim();
      const farm = farmInput?.value?.trim();
      rememberMe = rememberCheck ? rememberCheck.checked : true;

      // Check lockout status before submission
      if (mode === 'SIGN_IN' && email) {
        const lockout = authService.checkLoginLockout(email);
        if (lockout.isLocked) {
          bannerState = {
            type: 'error',
            message: `Account temporarily locked due to consecutive failed attempts. Please retry in ${lockout.remainingSeconds} seconds.`
          };
          render();
          return;
        }
      }

      isSubmitting = true;
      bannerState = null;
      render();

      try {
        if (mode === 'FORGOT_PASSWORD') {
          const res = await authService.sendPasswordReset(email);
          isSubmitting = false;
          if (res.success) {
            bannerState = { type: 'success', message: res.message || `Password reset link sent to ${email}!` };
          } else {
            bannerState = { type: 'error', message: res.message || 'Failed to send reset link.' };
          }
          render();
          return;
        }

        if (mode === 'SIGN_UP') {
          const res = await authService.registerWithEmail(email, password, name, selectedRole, farm);
          if (res && res.success === false) {
            throw new Error(res.message);
          }
          const user = res.user || res;
          isSubmitting = false;
          bannerState = { type: 'success', message: `Welcome to AgriSpectra, ${user.displayName || user.name || user.email || 'Grower'}!` };
          render();
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(user);
          }, 500);
          return;
        }

        // SIGN_IN
        const res = await authService.signInWithEmail(email, password, { rememberMe });
        if (res && res.success === false) {
          throw new Error(res.message);
        }
        const user = res.user || res;
        isSubmitting = false;
        bannerState = { type: 'success', message: `Welcome back, ${user.displayName || user.name || user.email}!` };
        render();
        setTimeout(() => {
          if (onAuthSuccess) onAuthSuccess(user);
        }, 500);

      } catch (err) {
        isSubmitting = false;
        bannerState = { type: 'error', message: err.message || "Authentication error." };
        render();
      }
    });
  }

  // Reactive locale listener
  onLocaleChange(() => {
    render();
  });

  render();
  return container;
}
