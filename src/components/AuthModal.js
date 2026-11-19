/**
 * AgriSpectra Authentication Modal
 * Designed with Creamy Light & Agricultural Forest Green Palette (#F7F4EB & #1E462A).
 * Supports: Sign In, Sign Up (Multi-Role), Forgot Password, Google OAuth One-Tap,
 * and Instant Offline Field Guest Mode (for areas with no cellular reception).
 */
import { authService } from '../firebase/authService.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createAuthModal({ initialMode = 'SIGN_IN', onClose, onAuthSuccess }) {
  const overlay = document.createElement('div');
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md overflow-y-auto animate-fadeIn select-none";

  let mode = initialMode; // 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD'
  let showPassword = false;
  let rememberMe = true;
  let selectedRole = 'Farm Owner'; // 'Farm Owner' | 'Agronomist' | 'Field Tech'
  let bannerState = null; // { type: 'success' | 'error', message: string }
  let isSubmitting = false;

  function render() {
    overlay.innerHTML = `
      <div class="relative w-full max-w-md my-auto bg-[#FBF9F4] text-[#1E462A] rounded-3xl border border-[#E5DDCF] shadow-2xl overflow-hidden transition-all duration-300">
        
        <!-- Agricultural Top Graphic Pattern -->
        <div class="relative bg-gradient-to-br from-[#1E462A] via-[#2D5A3A] to-[#12301A] text-white p-6 pb-6">
          <!-- Background botanical SVG texture -->
          <div class="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
            <svg class="w-full h-full" viewBox="0 0 400 200" fill="none">
              <path d="M0 100 C 150 200, 250 0, 400 100" stroke="#FFF" stroke-width="4" fill="none"/>
              <circle cx="50" cy="50" r="30" stroke="#FFF" stroke-width="2"/>
              <circle cx="350" cy="150" r="50" stroke="#FFF" stroke-width="2"/>
            </svg>
          </div>

          <!-- Close Modal Button -->
          <button id="auth-close-btn" class="absolute top-4 right-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-2xl bg-white/10 hover:bg-white/20 text-white/90 hover:text-white transition cursor-pointer" title="Close" aria-label="Close Authentication Modal">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>

          <!-- Brand Emblem -->
          <div class="flex items-center gap-3 pr-12 min-w-0">
            <div class="w-12 h-12 rounded-2xl bg-[#10B981] flex items-center justify-center text-white shadow-lg shadow-emerald-950/40 ring-4 ring-emerald-400/20 shrink-0">
              <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4">
                <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12a10 10 0 0 1 10-10Z"/>
                <path d="m9 12 2 2 4-4"/>
                <path d="M12 6v2"/>
                <path d="M12 16v2"/>
              </svg>
            </div>
            <div class="min-w-0 flex-1">
              <span class="text-[11px] font-mono tracking-widest uppercase text-emerald-300 font-bold block truncate">AgriSpectra Access</span>
              <h2 class="text-lg sm:text-xl font-extrabold tracking-tight text-white leading-tight break-words">
                ${mode === 'SIGN_IN' ? 'Welcome Back, Grower' : (mode === 'SIGN_UP' ? 'Create Farm Workspace' : 'Reset Farm Access')}
              </h2>
            </div>
          </div>
          <p class="text-xs text-emerald-100/80 mt-2 font-medium">
            ${mode === 'SIGN_IN' ? 'Access your 6-zone precision irrigation & leaf spectroscopy portal' : (mode === 'SIGN_UP' ? 'Equip your team with closed-loop telemetry & chemometrics' : 'Enter your registered email to receive instantaneous recovery steps')}
          </p>

          <!-- Sign In / Sign Up Mode Segmented Tabs -->
          ${mode !== 'FORGOT_PASSWORD' ? `
            <div class="mt-4 flex bg-black/25 p-1 rounded-2xl border border-white/10 backdrop-blur-sm">
              <button type="button" id="tab-mode-signin" class="flex-1 py-1.5 rounded-xl text-xs font-bold transition text-center ${mode === 'SIGN_IN' ? 'bg-white text-[#1E462A] shadow-md' : 'text-emerald-100/80 hover:text-white'}">
                Sign In
              </button>
              <button type="button" id="tab-mode-signup" class="flex-1 py-1.5 rounded-xl text-xs font-bold transition text-center ${mode === 'SIGN_UP' ? 'bg-white text-[#1E462A] shadow-md' : 'text-emerald-100/80 hover:text-white'}">
                Create Account
              </button>
            </div>
          ` : ''}
        </div>

        <!-- Notification Banner (Alerts / Success) -->
        ${bannerState ? `
          <div class="mx-6 mt-4 p-3.5 rounded-2xl text-xs font-medium flex items-center gap-3 animate-fadeIn ${
            bannerState.type === 'success' 
              ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-sm' 
              : 'bg-rose-50 text-rose-900 border border-rose-300 shadow-sm'
          }">
            <div class="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${bannerState.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}">
              ${bannerState.type === 'success' 
                ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"/></svg>' 
                : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'}
            </div>
            <span class="flex-1">${escapeHtml(bannerState.message)}</span>
          </div>
        ` : ''}

        <!-- Interactive Form Body -->
        <div class="p-6 space-y-4">
          
          <!-- One-Tap Google Sign-In High-End Button -->
          ${mode !== 'FORGOT_PASSWORD' ? `
            <button id="google-auth-btn" class="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 text-stone-800 font-semibold text-sm border border-[#DDD5C7] shadow-sm hover:shadow flex items-center justify-center gap-3 transition-all duration-200 cursor-pointer active:scale-[0.98]">
              <!-- Official Multi-Color Google G SVG -->
              <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <!-- Offline Field Guest Access Button -->
            <button id="offline-guest-btn" type="button" class="w-full min-h-[46px] px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-950 font-semibold text-xs border border-amber-300 shadow-sm flex items-center justify-between transition-all duration-200 cursor-pointer active:scale-[0.98]">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-amber-200/80 flex items-center justify-center text-amber-900">
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="1" y1="1" x2="23" y2="23"/>
                    <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
                    <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
                    <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
                    <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
                    <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
                    <line x1="12" y1="20" x2="12.01" y2="20"/>
                  </svg>
                </span>
                <div class="text-left">
                  <div class="font-bold text-amber-950 text-xs">Continue as Offline Field Guest</div>
                  <div class="text-[10px] text-amber-800">Zero cellular reception • Direct BLE & Local Cache</div>
                </div>
              </div>
              <span class="text-[10px] font-mono font-bold bg-amber-200 px-2 py-0.5 rounded-md text-amber-900">
                0ms Boot
              </span>
            </button>

            <!-- Organic Divider -->
            <div class="relative flex items-center justify-center my-2">
              <div class="border-t border-[#E5DDCF] w-full"></div>
              <span class="bg-[#FBF9F4] px-3 text-[11px] font-bold text-stone-400 uppercase tracking-wider">or sign in with email</span>
            </div>
          ` : ''}

          <form id="auth-main-form" class="space-y-3.5">
            
            <!-- SIGN UP FIELDS: Full Name & Farm Name & Role -->
            ${mode === 'SIGN_UP' ? `
              <div>
                <label class="block text-xs font-bold text-[#1E462A] mb-1">Full Name</label>
                <div class="relative">
                  <input type="text" id="auth-name-input" required placeholder="e.g. Sarah Jenkins" class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-white border border-[#DDD5C7] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#1E462A] mb-1">Farm / Enterprise Name</label>
                <div class="relative">
                  <input type="text" id="auth-farm-input" required placeholder="e.g. Sonoma Valley Parcel" class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-white border border-[#DDD5C7] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-[#1E462A] mb-1.5">Operational Role</label>
                <div class="grid grid-cols-3 gap-2">
                  ${['Farm Owner', 'Agronomist', 'Field Tech'].map(r => `
                    <button type="button" data-role="${r}" class="role-select-btn min-h-[46px] px-2 py-2 rounded-xl text-xs font-bold border transition text-center flex flex-col items-center justify-center cursor-pointer ${
                      selectedRole === r 
                        ? 'bg-[#1E462A] text-white border-[#1E462A] shadow-md shadow-emerald-950/20' 
                        : 'bg-white text-stone-700 border-[#DDD5C7] hover:bg-stone-50'
                    }">
                      <span class="leading-tight">${r}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- EMAIL ADDRESS FIELD (Present in all modes) -->
            <div>
              <label class="block text-xs font-bold text-[#1E462A] mb-1">Work Email</label>
              <div class="relative">
                <input type="email" id="auth-email-input" required placeholder="grower@agrispectra.io" class="w-full min-h-[46px] px-3.5 py-2.5 rounded-xl bg-white border border-[#DDD5C7] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition" />
                <div class="absolute inset-y-0 right-3 flex items-center pointer-events-none text-stone-400">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"/></svg>
                </div>
              </div>
            </div>

            <!-- PASSWORD FIELD (Sign In & Sign Up) -->
            ${mode !== 'FORGOT_PASSWORD' ? `
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-[#1E462A]">Password</label>
                  ${mode === 'SIGN_IN' ? `
                    <button type="button" id="auth-goto-forgot" class="text-xs text-[#10B981] hover:text-[#059669] font-bold transition hover:underline cursor-pointer">
                      Forgot Password?
                    </button>
                  ` : ''}
                </div>
                <div class="relative">
                  <input type="${showPassword ? 'text' : 'password'}" id="auth-password-input" required minlength="6" placeholder="••••••••••••" class="w-full min-h-[46px] px-3.5 pr-12 py-2.5 rounded-xl bg-white border border-[#DDD5C7] text-stone-900 placeholder-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-[#10B981] focus:border-transparent transition" />
                  <!-- Eye toggle button -->
                  <button type="button" id="auth-toggle-pwd" class="absolute inset-y-0 right-0 px-3.5 min-h-[46px] flex items-center text-stone-400 hover:text-stone-700 transition cursor-pointer" title="${showPassword ? 'Hide password' : 'Show password'}">
                    ${showPassword ? `
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/></svg>
                    ` : `
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                    `}
                  </button>
                </div>
              </div>

              <!-- Remember Me Toggle (Sign In only) -->
              ${mode === 'SIGN_IN' ? `
                <div class="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="auth-remember-check" ${rememberMe ? 'checked' : ''} class="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 cursor-pointer" />
                  <label for="auth-remember-check" class="text-xs text-stone-600 select-none cursor-pointer">
                    Stay authenticated on this field device
                  </label>
                </div>
              ` : ''}
            ` : ''}

            <!-- Primary Action Button -->
            <button type="submit" id="auth-submit-btn" ${isSubmitting ? 'disabled' : ''} class="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-gradient-to-r from-[#1E462A] to-[#10B981] hover:from-[#173821] hover:to-[#059669] text-white font-bold text-sm shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              ${isSubmitting ? `
                <svg class="w-5 h-5 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Processing Authorization...</span>
              ` : (
                mode === 'SIGN_IN' 
                  ? 'Sign In to Farm' 
                  : (mode === 'SIGN_UP' ? 'Create Farm Account' : 'Send Password Reset Link')
              )}
            </button>
          </form>

          <!-- Footer Switch Links -->
          <div class="pt-3 border-t border-[#E5DDCF] text-center text-xs text-stone-600">
            ${mode === 'SIGN_IN' ? `
              <span>Don't have an enterprise account?</span>
              <button type="button" id="auth-goto-signup" class="ml-1.5 font-bold text-[#1E462A] hover:text-[#10B981] transition cursor-pointer hover:underline">
                Create Account
              </button>
            ` : (mode === 'SIGN_UP' ? `
              <span>Already have an account?</span>
              <button type="button" id="auth-goto-signin" class="ml-1.5 font-bold text-[#1E462A] hover:text-[#10B981] transition cursor-pointer hover:underline">
                Sign In
              </button>
            ` : `
              <button type="button" id="auth-goto-signin" class="inline-flex items-center gap-1.5 font-bold text-[#1E462A] hover:text-[#10B981] transition cursor-pointer hover:underline">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/></svg>
                <span>Back to Sign In</span>
              </button>
            `)}
          </div>

        </div>

      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Close button
    const closeBtn = overlay.querySelector('#auth-close-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        if (onClose) onClose();
      });
    }

    // Top Segmented Tabs
    const tabSignIn = overlay.querySelector('#tab-mode-signin');
    if (tabSignIn) {
      tabSignIn.addEventListener('click', () => {
        mode = 'SIGN_IN';
        bannerState = null;
        render();
      });
    }

    const tabSignUp = overlay.querySelector('#tab-mode-signup');
    if (tabSignUp) {
      tabSignUp.addEventListener('click', () => {
        mode = 'SIGN_UP';
        bannerState = null;
        render();
      });
    }

    // One-Tap Google Sign-In
    const googleBtn = overlay.querySelector('#google-auth-btn');
    if (googleBtn) {
      googleBtn.addEventListener('click', async () => {
        try {
          isSubmitting = true;
          bannerState = null;
          render();
          const res = await authService.signInWithGoogle();
          if (res && res.success === false) throw new Error(res.message);
          const user = res.user || res;
          bannerState = { type: 'success', message: `Welcome back, ${user.displayName || user.email}!` };
          render();
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(user);
            if (onClose) onClose();
          }, 600);
        } catch (err) {
          isSubmitting = false;
          bannerState = { type: 'error', message: err.message || "Google authentication was cancelled or interrupted." };
          render();
        }
      });
    }

    // Offline Field Guest Mode Button
    const offlineGuestBtn = overlay.querySelector('#offline-guest-btn');
    if (offlineGuestBtn) {
      offlineGuestBtn.addEventListener('click', () => {
        try {
          const guestRole = selectedRole === 'Field Tech' ? 'Field Operator' : selectedRole;
          const user = authService.signInAsOfflineGuest(
            `Field Guest (${guestRole})`,
            guestRole,
            "Sonoma Valley Parcel"
          );
          bannerState = {
            type: 'success',
            message: `Logged in as Offline Field Guest (${guestRole}). Offline telemetry & valve commands active.`
          };
          render();
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(user.user || user);
            if (onClose) onClose();
          }, 500);
        } catch (e) {
          bannerState = { type: 'error', message: 'Could not initialize offline guest session: ' + e.message };
          render();
        }
      });
    }

    // Role selection in SIGN_UP
    overlay.querySelectorAll('.role-select-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        selectedRole = btn.getAttribute('data-role');
        render();
      });
    });

    // Toggle password eye
    const togglePwdBtn = overlay.querySelector('#auth-toggle-pwd');
    if (togglePwdBtn) {
      togglePwdBtn.addEventListener('click', () => {
        showPassword = !showPassword;
        render();
      });
    }

    // Switch to Forgot Password
    const gotoForgot = overlay.querySelector('#auth-goto-forgot');
    if (gotoForgot) {
      gotoForgot.addEventListener('click', () => {
        mode = 'FORGOT_PASSWORD';
        bannerState = null;
        render();
      });
    }

    // Switch to Sign Up
    const gotoSignUp = overlay.querySelector('#auth-goto-signup');
    if (gotoSignUp) {
      gotoSignUp.addEventListener('click', () => {
        mode = 'SIGN_UP';
        bannerState = null;
        render();
      });
    }

    // Switch to Sign In
    const gotoSignIn = overlay.querySelector('#auth-goto-signin');
    if (gotoSignIn) {
      gotoSignIn.addEventListener('click', () => {
        mode = 'SIGN_IN';
        bannerState = null;
        render();
      });
    }

    // Main Form Submit
    const form = overlay.querySelector('#auth-main-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = overlay.querySelector('#auth-email-input')?.value?.trim();
        const password = overlay.querySelector('#auth-password-input')?.value;

        if (!email) {
          bannerState = { type: 'error', message: 'Please enter a valid email address.' };
          render();
          return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          bannerState = { type: 'error', message: 'Please provide a valid email format (e.g., name@domain.com).' };
          render();
          return;
        }

        if (mode !== 'FORGOT_PASSWORD' && (!password || password.length < 6)) {
          bannerState = { type: 'error', message: 'Password must be at least 6 characters long.' };
          render();
          return;
        }

        isSubmitting = true;
        bannerState = null;
        render();

        try {
          if (mode === 'SIGN_IN') {
            const res = await authService.signInWithEmail(email, password);
            if (res && res.success === false) throw new Error(res.message);
            const user = res.user || res;
            bannerState = { type: 'success', message: `Signed in successfully as ${user.displayName || user.email}` };
            render();
            setTimeout(() => {
              if (onAuthSuccess) onAuthSuccess(user);
              if (onClose) onClose();
            }, 600);
          } else if (mode === 'SIGN_UP') {
            const displayName = overlay.querySelector('#auth-name-input')?.value?.trim() || email.split('@')[0];
            const farmName = overlay.querySelector('#auth-farm-input')?.value?.trim() || 'Sonoma Valley Parcel';
            const mappedRole = selectedRole === 'Field Tech' ? 'Field Operator' : selectedRole;
            const res = await authService.signUpWithEmail(email, password, displayName, farmName, mappedRole);
            if (res && res.success === false) throw new Error(res.message);
            const user = res.user || res;
            bannerState = { type: 'success', message: `Account created for ${displayName}! Welcome to AgriSpectra.` };
            render();
            setTimeout(() => {
              if (onAuthSuccess) onAuthSuccess(user);
              if (onClose) onClose();
            }, 700);
          } else if (mode === 'FORGOT_PASSWORD') {
            const res = await authService.sendPasswordReset(email);
            if (res && res.success === false) throw new Error(res.message);
            bannerState = { type: 'success', message: res.message };
            isSubmitting = false;
            render();
          }
        } catch (err) {
          isSubmitting = false;
          bannerState = { type: 'error', message: err.message || 'Authentication operation failed.' };
          render();
        }
      });
    }
  }

  // Initial render
  render();

  return overlay;
}
