/**
 * AgriSpectra Authentication & Role Access Portal
 * Elegant landing page for unauthenticated visitors.
 * Features:
 *  - 1-Click Instant Role Demo Access for all 4 user personas:
 *      * Farm Owner (Carlos Mendoza)
 *      * Agronomist (Dave Miller)
 *      * Field Operator (Mateo Silva)
 *      * SuperAdmin (Elena Rostova)
 *  - Email & Password Sign-In
 *  - Multi-Role Account Registration
 *  - Google OAuth One-Tap
 *  - Password Recovery Flow
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

export function createAuthPortal({ onAuthSuccess }) {
  const container = document.createElement('div');
  container.className = "flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full animate-fadeIn";

  let activeTab = 'SIGN_IN'; // 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD'
  let showPassword = false;
  let selectedRole = 'Farm Owner';
  let bannerState = null;
  let isSubmitting = false;

  function render() {
    container.innerHTML = `
      <!-- Brand & Hero Introduction -->
      <div class="text-center max-w-3xl mx-auto mb-10">
        <div class="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/60 text-emerald-900 dark:text-emerald-300 text-xs font-bold font-mono uppercase tracking-widest mb-4 shadow-sm">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span>Role-Based Access Control</span>
        </div>
        
        <h1 class="text-3xl sm:text-5xl font-black tracking-tight text-stone-900 dark:text-white font-sans leading-tight">
          Precision Agronomy & Hydraulic Infrastructure
        </h1>
        
        <p class="mt-3 text-sm sm:text-base text-stone-600 dark:text-slate-300 max-w-2xl mx-auto font-medium">
          AgriSpectra delivers specialized, purpose-built dashboards for each operational role. 
          Sign in below or launch an instant demo profile to explore your tailored workspace.
        </p>
      </div>

      <!-- Notification Banner -->
      ${bannerState ? `
        <div class="max-w-4xl mx-auto w-full mb-6 p-4 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-3 animate-fadeIn ${
          bannerState.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-300 shadow-md' 
            : 'bg-rose-50 text-rose-900 border border-rose-300 shadow-md'
        }">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bannerState.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}">
            ${bannerState.type === 'success' 
              ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' 
              : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>'}
          </div>
          <span class="flex-1">${escapeHtml(bannerState.message)}</span>
        </div>
      ` : ''}

      <!-- Launch Aero-Field Mobile Reference Showcase Card -->
      <div class="max-w-6xl mx-auto w-full mb-8 p-4 sm:p-5 rounded-3xl bg-gradient-to-r from-[#0d2a18] via-[#143a23] to-[#0d2a18] border border-lime-400/30 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-lime-400/20 border border-lime-400/40 flex items-center justify-center text-lime-300 text-xl shadow-inner shrink-0">
            🌿
          </div>
          <div>
            <h3 class="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
              Aero-Field Mobile UI/UX Showcase
              <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-lime-400 text-slate-950 font-black">
                REFERENCE DESIGN
              </span>
            </h3>
            <p class="text-xs text-emerald-200/80 mt-0.5">
              Interactive twin mobile mockup: Potato Crop Overview (Growth Rate, 63-Day Health Ring) & Potato Field Zone (Satellite Drone Map, 7-Ton Telemetry).
            </p>
          </div>
        </div>

        <button 
          type="button" 
          id="btn-launch-mobile-showcase"
          class="shrink-0 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-lime-400 to-emerald-400 hover:from-lime-300 hover:to-emerald-300 text-slate-950 font-extrabold text-xs shadow-lg shadow-emerald-950/50 transition transform active:scale-95 flex items-center gap-2 cursor-pointer"
        >
          <svg class="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
          <span>Launch Mobile Mockup</span>
        </button>
      </div>

      <!-- Main Dual Grid: Instant Demo Role Access + Direct Authentication Form -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-6xl mx-auto w-full items-start">
        
        <!-- LEFT: 1-Click Instant Demo Role Profiles (8 cols on lg) -->
        <div class="lg:col-span-7 space-y-4">
          <div class="flex items-center justify-between mb-2">
            <div>
              <h2 class="text-lg font-extrabold text-stone-900 dark:text-white flex items-center gap-2">
                <span>Instant Role Access (1-Click Demo)</span>
              </h2>
              <p class="text-xs text-stone-500 dark:text-slate-400">
                Click any operational persona to jump directly into their specialized dashboard:
              </p>
            </div>
          </div>

          <!-- 4 Interactive Role Cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            
            <!-- Persona 1: Farm Owner -->
            <button data-demo-role="Farm Owner" class="btn-demo-role text-left p-4 rounded-3xl bg-white dark:bg-slate-850 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 border-2 border-stone-200 dark:border-slate-750 hover:border-amber-400 transition-all duration-200 shadow-sm hover:shadow-md group cursor-pointer flex flex-col justify-between min-h-[175px]">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg shadow-sm">
                    👨‍🌾
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                    EXECUTIVE
                  </span>
                </div>
                <h3 class="text-sm font-extrabold text-stone-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                  Farm Owner
                </h3>
                <div class="text-[11px] font-bold text-stone-600 dark:text-slate-300">Carlos Mendoza</div>
                <div class="text-[10px] text-stone-500 dark:text-slate-400 font-mono">Sonoma Valley Drip Vineyard</div>
                <p class="text-[11px] text-stone-600 dark:text-slate-300 mt-2 line-clamp-2">
                  Water economics, 1-acre budget savings, 6-zone matrix, harvest predictions, and CSV audit exports.
                </p>
              </div>
              <div class="mt-3 pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-amber-700 dark:text-amber-400">
                <span>Enter as Farm Owner</span>
                <span class="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>

            <!-- Persona 2: Agronomist -->
            <button data-demo-role="Agronomist" class="btn-demo-role text-left p-4 rounded-3xl bg-white dark:bg-slate-850 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 border-2 border-stone-200 dark:border-slate-750 hover:border-teal-400 transition-all duration-200 shadow-sm hover:shadow-md group cursor-pointer flex flex-col justify-between min-h-[175px]">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="w-10 h-10 rounded-2xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-lg shadow-sm">
                    🔬
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                    CROP SCIENCE
                  </span>
                </div>
                <h3 class="text-sm font-extrabold text-stone-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition">
                  Agronomist
                </h3>
                <div class="text-[11px] font-bold text-stone-600 dark:text-slate-300">Dave Miller</div>
                <div class="text-[10px] text-stone-500 dark:text-slate-400 font-mono">Central Valley Alpha Block</div>
                <p class="text-[11px] text-stone-600 dark:text-slate-300 mt-2 line-clamp-2">
                  350-1100nm spectroscopy, 5 Chemometrics decision engines, NDRE fertilizer doses, voice audio readout.
                </p>
              </div>
              <div class="mt-3 pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-teal-700 dark:text-teal-400">
                <span>Enter as Agronomist</span>
                <span class="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>

            <!-- Persona 3: Field Operator -->
            <button data-demo-role="Field Operator" class="btn-demo-role text-left p-4 rounded-3xl bg-white dark:bg-slate-850 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 border-2 border-stone-200 dark:border-slate-750 hover:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md group cursor-pointer flex flex-col justify-between min-h-[175px]">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-lg shadow-sm">
                    💧
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                    OPERATIONS
                  </span>
                </div>
                <h3 class="text-sm font-extrabold text-stone-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  Field Operator
                </h3>
                <div class="text-[11px] font-bold text-stone-600 dark:text-slate-300">Mateo Silva</div>
                <div class="text-[10px] text-stone-500 dark:text-slate-400 font-mono">Sonoma Valley Drip Vineyard</div>
                <p class="text-[11px] text-stone-600 dark:text-slate-300 mt-2 line-clamp-2">
                  1-Acre 6-Zone Field Visual Map, bi-stable ±12V latch pulse triggers, 10/30/50cm FDR probes, emergency killswitch.
                </p>
              </div>
              <div class="mt-3 pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-blue-700 dark:text-blue-400">
                <span>Enter as Field Operator</span>
                <span class="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>

            <!-- Persona 4: SuperAdmin -->
            <button data-demo-role="SuperAdmin" class="btn-demo-role text-left p-4 rounded-3xl bg-white dark:bg-slate-850 hover:bg-purple-50/50 dark:hover:bg-purple-950/20 border-2 border-stone-200 dark:border-slate-750 hover:border-purple-400 transition-all duration-200 shadow-sm hover:shadow-md group cursor-pointer flex flex-col justify-between min-h-[175px]">
              <div>
                <div class="flex items-center justify-between mb-2">
                  <div class="w-10 h-10 rounded-2xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-lg shadow-sm">
                    🛡️
                  </div>
                  <span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                    GOVERNANCE
                  </span>
                </div>
                <h3 class="text-sm font-extrabold text-stone-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">
                  SuperAdmin
                </h3>
                <div class="text-[11px] font-bold text-stone-600 dark:text-slate-300">Elena Rostova</div>
                <div class="text-[10px] text-stone-500 dark:text-slate-400 font-mono">Global Agronomic Operations</div>
                <p class="text-[11px] text-stone-600 dark:text-slate-300 mt-2 line-clamp-2">
                  Multi-tenant governance, user management, telemetry chaos injection, emergency broadcast dispatcher.
                </p>
              </div>
              <div class="mt-3 pt-2 border-t border-stone-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-purple-700 dark:text-purple-400">
                <span>Enter as SuperAdmin</span>
                <span class="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </button>

          </div>

          <!-- Feature Footnote -->
          <div class="p-3.5 rounded-2xl bg-stone-100 dark:bg-slate-800/60 border border-stone-200 dark:border-slate-750 text-[11px] text-stone-600 dark:text-slate-300 flex items-center gap-2.5">
            <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
            <span>Role-Based Separation: Each role only sees their pertinent controls, preventing operational accidents and cognitive overload.</span>
          </div>
        </div>

        <!-- RIGHT: Interactive Credentials Form (5 cols on lg) -->
        <div class="lg:col-span-5 bg-white dark:bg-slate-850 rounded-3xl p-6 sm:p-7 border border-stone-200 dark:border-slate-750 shadow-xl">
          
          <!-- Mode Tabs -->
          <div class="flex items-center p-1 rounded-2xl bg-stone-100 dark:bg-slate-800 mb-5">
            <button id="tab-signin" class="flex-1 min-h-[40px] py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'SIGN_IN' 
                ? 'bg-white dark:bg-slate-700 text-stone-900 dark:text-white shadow-sm' 
                : 'text-stone-500 dark:text-slate-400 hover:text-stone-900'
            }">
              Sign In
            </button>
            <button id="tab-signup" class="flex-1 min-h-[40px] py-1.5 rounded-xl text-xs font-extrabold transition cursor-pointer ${
              activeTab === 'SIGN_UP' 
                ? 'bg-white dark:bg-slate-700 text-stone-900 dark:text-white shadow-sm' 
                : 'text-stone-500 dark:text-slate-400 hover:text-stone-900'
            }">
              Create Account
            </button>
          </div>

          <!-- Google Sign-In Button -->
          ${activeTab !== 'FORGOT_PASSWORD' ? `
            <button id="btn-portal-google" class="w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-white hover:bg-stone-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-stone-800 dark:text-white font-semibold text-xs border border-stone-200 dark:border-slate-700 shadow-sm flex items-center justify-center gap-3 transition cursor-pointer active:scale-98">
              <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <div class="relative flex items-center justify-center my-3.5">
              <div class="border-t border-stone-200 dark:border-slate-750 w-full"></div>
              <span class="bg-white dark:bg-slate-850 px-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">or email password</span>
            </div>
          ` : ''}

          <!-- Form Body -->
          <form id="portal-form" class="space-y-3.5">
            
            <!-- Fields for SIGN_UP -->
            ${activeTab === 'SIGN_UP' ? `
              <div>
                <label class="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">Full Name</label>
                <input type="text" id="portal-name-input" required placeholder="e.g. Sarah Jenkins" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div>
                <label class="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">Farm / Company Name</label>
                <input type="text" id="portal-farm-input" required placeholder="e.g. Salinas Valley AgriCorp" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>

              <div>
                <label class="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">Your Operational Role</label>
                <div class="grid grid-cols-3 gap-2">
                  ${['Farm Owner', 'Agronomist', 'Field Operator'].map(r => `
                    <button type="button" data-role="${r}" class="btn-select-role min-h-[44px] px-2 py-1.5 rounded-xl text-[11px] font-bold border transition text-center flex flex-col items-center justify-center cursor-pointer ${
                      selectedRole === r 
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm' 
                        : 'bg-stone-50 hover:bg-stone-100 dark:bg-slate-800 text-stone-700 dark:text-slate-300 border-stone-200 dark:border-slate-700'
                    }">
                      <span class="leading-tight">${r}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
            ` : ''}

            <!-- Email Field -->
            <div>
              <label class="block text-xs font-bold text-stone-700 dark:text-slate-300 mb-1">Work Email</label>
              <input type="email" id="portal-email-input" required placeholder="grower@agrispectra.io" class="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            <!-- Password Field -->
            ${activeTab !== 'FORGOT_PASSWORD' ? `
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs font-bold text-stone-700 dark:text-slate-300">Password</label>
                  ${activeTab === 'SIGN_IN' ? `
                    <button type="button" id="portal-link-forgot" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-bold cursor-pointer">
                      Forgot Password?
                    </button>
                  ` : ''}
                </div>
                <div class="relative">
                  <input type="${showPassword ? 'text' : 'password'}" id="portal-password-input" required minlength="6" placeholder="••••••••••••" class="w-full min-h-[44px] px-3.5 pr-10 py-2 rounded-xl bg-stone-50 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-stone-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <button type="button" id="portal-toggle-pwd" class="absolute inset-y-0 right-0 px-3 flex items-center text-stone-400 hover:text-stone-600 cursor-pointer">
                    ${showPassword ? '👁️' : '🔒'}
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Submit Button -->
            <button type="submit" id="portal-submit-btn" ${isSubmitting ? 'disabled' : ''} class="w-full min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-50 mt-2">
              ${isSubmitting ? 'Authenticating...' : (
                activeTab === 'SIGN_IN' 
                  ? 'Sign In to Dashboard' 
                  : (activeTab === 'SIGN_UP' ? 'Create Account & Launch' : 'Send Recovery Link')
              )}
            </button>
          </form>

          <!-- Forgot Password Back Link -->
          ${activeTab === 'FORGOT_PASSWORD' ? `
            <div class="mt-4 pt-3 border-t border-stone-200 dark:border-slate-750 text-center">
              <button type="button" id="portal-back-signin" class="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer">
                ← Back to Sign In
              </button>
            </div>
          ` : ''}

        </div>

      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    // Launch Aero-Field Showcase Button
    container.querySelector('#btn-launch-mobile-showcase')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('agrispectra_switch_view', { detail: { mode: 'aero-showcase' } }));
    });

    // 1-Click Demo Logins
    container.querySelectorAll('.btn-demo-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        const role = btn.getAttribute('data-demo-role');
        try {
          isSubmitting = true;
          bannerState = { type: 'success', message: `Launching ${role} specialized dashboard...` };
          render();

          const result = await authService.loginAsDemoRole(role);
          const user = result.user || result;
          
          setTimeout(() => {
            if (onAuthSuccess) onAuthSuccess(user);
          }, 400);
        } catch (err) {
          isSubmitting = false;
          bannerState = { type: 'error', message: err.message };
          render();
        }
      });
    });

    // Tab buttons
    const tabSignIn = container.querySelector('#tab-signin');
    if (tabSignIn) {
      tabSignIn.addEventListener('click', () => {
        activeTab = 'SIGN_IN';
        bannerState = null;
        render();
      });
    }

    const tabSignUp = container.querySelector('#tab-signup');
    if (tabSignUp) {
      tabSignUp.addEventListener('click', () => {
        activeTab = 'SIGN_UP';
        bannerState = null;
        render();
      });
    }

    // Role selection in SIGN_UP
    container.querySelectorAll('.btn-select-role').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedRole = btn.getAttribute('data-role');
        render();
      });
    });

    // Toggle password eye
    const togglePwd = container.querySelector('#portal-toggle-pwd');
    if (togglePwd) {
      togglePwd.addEventListener('click', () => {
        showPassword = !showPassword;
        render();
      });
    }

    // Forgot password link
    const forgotLink = container.querySelector('#portal-link-forgot');
    if (forgotLink) {
      forgotLink.addEventListener('click', () => {
        activeTab = 'FORGOT_PASSWORD';
        bannerState = null;
        render();
      });
    }

    const backSignIn = container.querySelector('#portal-back-signin');
    if (backSignIn) {
      backSignIn.addEventListener('click', () => {
        activeTab = 'SIGN_IN';
        bannerState = null;
        render();
      });
    }

    // Google Sign-In
    const googleBtn = container.querySelector('#btn-portal-google');
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
          }, 400);
        } catch (err) {
          isSubmitting = false;
          bannerState = { type: 'error', message: err.message || 'Google sign-in was interrupted.' };
          render();
        }
      });
    }

    // Form submit
    const form = container.querySelector('#portal-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = container.querySelector('#portal-email-input')?.value?.trim();
        const password = container.querySelector('#portal-password-input')?.value;

        if (!email) {
          bannerState = { type: 'error', message: 'Please provide a valid email address.' };
          render();
          return;
        }

        isSubmitting = true;
        bannerState = null;
        render();

        try {
          if (activeTab === 'SIGN_IN') {
            const res = await authService.signInWithEmail(email, password);
            if (res && res.success === false) throw new Error(res.message);
            const user = res.user || res;
            bannerState = { type: 'success', message: `Signed in successfully as ${user.displayName || user.email}` };
            render();
            setTimeout(() => {
              if (onAuthSuccess) onAuthSuccess(user);
            }, 500);
          } else if (activeTab === 'SIGN_UP') {
            const displayName = container.querySelector('#portal-name-input')?.value?.trim() || email.split('@')[0];
            const farmName = container.querySelector('#portal-farm-input')?.value?.trim() || 'Central Valley Parcel';
            const res = await authService.signUpWithEmail(email, password, displayName, farmName, selectedRole);
            if (res && res.success === false) throw new Error(res.message);
            const user = res.user || res;
            bannerState = { type: 'success', message: `Welcome to AgriSpectra, ${displayName}!` };
            render();
            setTimeout(() => {
              if (onAuthSuccess) onAuthSuccess(user);
            }, 600);
          } else if (activeTab === 'FORGOT_PASSWORD') {
            const res = await authService.sendPasswordReset(email);
            bannerState = { type: 'success', message: res.message };
            isSubmitting = false;
            render();
          }
        } catch (err) {
          isSubmitting = false;
          bannerState = { type: 'error', message: err.message || 'Authentication error.' };
          render();
        }
      });
    }
  }

  render();
  return container;
}
