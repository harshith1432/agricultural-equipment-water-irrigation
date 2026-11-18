/**
 * Onboarding Carousel & Cold Launch Splash Screen
 * 3 skippable interactive slides highlighting:
 *  1. Non-destructive Leaf Spectroscopy (76-band chemometrics, 350-1100nm)
 *  2. 1-Acre 6-Zone Smart Irrigation (bi-stable latching solenoids, ±12V pulses)
 *  3. Leaf-to-Valve Closed-Loop Synergy (precision autonomous agronomy)
 * Actions: 'Get Started' and 'Continue as Offline Guest'
 */
import { icon } from '../utils/icons.js';
import { authService } from '../firebase/authService.js';

export const ONBOARDING_STORAGE_KEY = 'agrispectra_onboarding_completed';

export function hasCompletedOnboarding() {
  try {
    return localStorage.getItem(ONBOARDING_STORAGE_KEY) === 'true';
  } catch (e) {
    return false;
  }
}

export function setOnboardingCompleted(completed = true) {
  try {
    if (completed) {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
    } else {
      localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    }
  } catch (e) {}
}

export function createOnboardingCarousel({ onComplete, onContinueAsGuest }) {
  const overlay = document.createElement('div');
  overlay.id = "agrispectra-onboarding-modal";
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-xl animate-fadeIn select-none overflow-y-auto";

  let currentSlide = 0;

  const SLIDES = [
    {
      id: 'spectroscopy',
      tag: 'CANOPY SENSING',
      title: 'Leaf Spectroscopy',
      subtitle: '76-Band Micro-Chemometrics',
      desc: 'Scan crop leaves non-destructively in 3.2s via BLE. Measure nitrogen deficiency, leaf water content (LWI), and chlorophyll index before symptoms appear.',
      badgeText: '350nm – 1100nm VIS-NIR',
      color: 'from-emerald-500/20 to-teal-500/10',
      accentColor: '#10B981',
      graphic: `
        <div class="relative w-48 h-48 mx-auto flex items-center justify-center">
          <div class="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping opacity-40"></div>
          <div class="w-40 h-40 rounded-full border border-emerald-400/30 bg-emerald-950/40 flex items-center justify-center relative shadow-inner">
            <!-- Leaf outline vector -->
            <svg class="w-20 h-20 text-emerald-400 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
              <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
            </svg>
            <!-- Spectral wave bands overlay -->
            <div class="absolute inset-x-4 bottom-5 flex items-end justify-between h-8 px-2 gap-1 opacity-80">
              <span class="w-1.5 h-3 bg-emerald-400 rounded-t"></span>
              <span class="w-1.5 h-6 bg-emerald-300 rounded-t"></span>
              <span class="w-1.5 h-7 bg-lime-300 rounded-t"></span>
              <span class="w-1.5 h-4 bg-amber-400 rounded-t"></span>
              <span class="w-1.5 h-8 bg-teal-300 rounded-t"></span>
              <span class="w-1.5 h-5 bg-emerald-400 rounded-t"></span>
            </div>
          </div>
          <span class="absolute top-1 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
            970nm H₂O Dip
          </span>
        </div>
      `
    },
    {
      id: 'irrigation',
      tag: 'HYDRAULIC AUTOMATION',
      title: 'Smart Irrigation',
      subtitle: '1-Acre 6-Zone Bi-Stable Solenoids',
      desc: 'Actuate latching valves with 50ms ±12V DC pulses. The bi-stable mechanism holds state at zero energy draw, safeguarding line pressure at 2.4 Bar.',
      badgeText: 'Zero-Power Latch Hold',
      color: 'from-blue-500/20 to-cyan-500/10',
      accentColor: '#0EA5E9',
      graphic: `
        <div class="relative w-48 h-48 mx-auto flex items-center justify-center">
          <div class="w-40 h-40 rounded-3xl border border-blue-400/30 bg-blue-950/40 p-3 shadow-inner flex flex-col justify-between">
            <div class="flex items-center justify-between text-[10px] font-mono text-cyan-300">
              <span>±12V PULSE</span>
              <span class="text-emerald-400">2.42 BAR</span>
            </div>
            <!-- 6 Zone visual blocks -->
            <div class="grid grid-cols-3 gap-1.5 my-auto">
              <div class="h-7 rounded-lg bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-white">Z1</div>
              <div class="h-7 rounded-lg bg-emerald-500/40 border border-emerald-400/50 flex items-center justify-center text-[10px] font-bold text-emerald-200 animate-pulse">Z2</div>
              <div class="h-7 rounded-lg bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-white">Z3</div>
              <div class="h-7 rounded-lg bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-white">Z4</div>
              <div class="h-7 rounded-lg bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-white">Z5</div>
              <div class="h-7 rounded-lg bg-blue-500/30 border border-blue-400/40 flex items-center justify-center text-[10px] font-bold text-white">Z6</div>
            </div>
            <div class="flex items-center justify-center gap-1.5 text-[10px] font-bold text-blue-300">
              <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
              <span>Latching Solenoid Matrix</span>
            </div>
          </div>
        </div>
      `
    },
    {
      id: 'synergy',
      tag: 'AUTONOMOUS LOOP',
      title: 'Leaf-to-Valve Synergy',
      subtitle: 'Closed-Loop Precision Agronomy',
      desc: 'When leaf spectroscopy detects canopy water stress, edge intelligence cross-validates with FDR soil probes to auto-schedule or approve optimal irrigation.',
      badgeText: 'Saves 35%+ Water Volume',
      color: 'from-amber-500/20 to-emerald-500/10',
      accentColor: '#F59E0B',
      graphic: `
        <div class="relative w-48 h-48 mx-auto flex items-center justify-center">
          <div class="w-40 h-40 rounded-full border-2 border-dashed border-amber-400/40 flex items-center justify-center relative">
            <!-- Center synergy core -->
            <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center text-white shadow-lg shadow-amber-950/40">
              <svg class="w-8 h-8 animate-spin" style="animation-duration: 9s;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
              </svg>
            </div>
            <!-- Orbiting badges -->
            <div class="absolute -top-1 px-2 py-0.5 rounded-full bg-emerald-900 border border-emerald-400 text-[9.5px] font-mono text-emerald-200">
              Spectro Scan
            </div>
            <div class="absolute -bottom-1 px-2 py-0.5 rounded-full bg-blue-900 border border-blue-400 text-[9.5px] font-mono text-blue-200">
              Valve Pulse
            </div>
            <div class="absolute -left-2 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded-full bg-amber-900 border border-amber-400 text-[9px] font-mono text-amber-200">
              FDR Probe
            </div>
          </div>
        </div>
      `
    }
  ];

  function finish(modeType = 'get_started') {
    setOnboardingCompleted(true);
    if (overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    if (modeType === 'offline_guest') {
      authService.signInAsOfflineGuest("Field Worker Guest", "Field Operator", "Sonoma Valley Parcel");
      if (onContinueAsGuest) onContinueAsGuest();
      else if (onComplete) onComplete({ mode: 'offline_guest' });
    } else {
      if (onComplete) onComplete({ mode: 'get_started' });
    }
  }

  function render() {
    const slide = SLIDES[currentSlide];
    const isLastSlide = currentSlide === SLIDES.length - 1;

    overlay.innerHTML = `
      <div class="relative w-full max-w-sm sm:max-w-md bg-[#07160C] text-white rounded-3xl border border-emerald-900/40 shadow-2xl overflow-hidden flex flex-col justify-between transition-all duration-300">
        
        <!-- Top Navigation Bar (Skip & Dots) -->
        <div class="px-5 pt-4 pb-2 flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <div class="w-6 h-6 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 text-xs font-bold">
              🌾
            </div>
            <span class="text-xs font-bold font-mono tracking-wider text-emerald-300 uppercase">AgriSpectra</span>
          </div>

          <!-- Skip Button -->
          <button type="button" id="onboard-skip-btn" class="min-h-[38px] px-3 py-1 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer">
            Skip Intro
          </button>
        </div>

        <!-- Slide Graphic Container -->
        <div class="p-4 sm:p-6 text-center">
          ${slide.graphic}

          <!-- Tag & Titles -->
          <div class="mt-4 space-y-1">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest text-emerald-300 bg-emerald-950/60 border border-emerald-500/30">
              ${slide.tag}
            </span>
            <h2 class="text-xl sm:text-2xl font-black text-white tracking-tight">
              ${slide.title}
            </h2>
            <div class="text-xs font-semibold text-emerald-400 font-mono">
              ${slide.subtitle}
            </div>
            <p class="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto pt-2">
              ${slide.desc}
            </p>
          </div>
        </div>

        <!-- Carousel Step Indicator Dots -->
        <div class="flex items-center justify-center gap-2 py-2">
          ${SLIDES.map((s, idx) => `
            <button 
              type="button" 
              data-slide-index="${idx}"
              class="slide-dot-btn transition-all duration-300 rounded-full ${
                idx === currentSlide 
                  ? 'w-7 h-2 bg-emerald-400 shadow-sm shadow-emerald-400/50' 
                  : 'w-2 h-2 bg-slate-700 hover:bg-slate-500'
              }"
              title="Slide ${idx + 1}"
              aria-label="Go to Slide ${idx + 1}"
            ></button>
          `).join('')}
        </div>

        <!-- Bottom Action Buttons -->
        <div class="p-5 pt-3 bg-black/40 border-t border-emerald-900/30 space-y-2.5">
          <div class="flex items-center gap-2">
            ${currentSlide > 0 ? `
              <button 
                type="button" 
                id="onboard-prev-btn" 
                class="min-h-[46px] px-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center justify-center transition cursor-pointer"
                aria-label="Previous Slide"
              >
                ${icon('chevronLeft', 'w-4 h-4')}
              </button>
            ` : ''}

            <button 
              type="button" 
              id="onboard-next-btn" 
              class="flex-1 min-h-[46px] px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-slate-950 font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 transition duration-200 cursor-pointer active:scale-98"
            >
              <span>${isLastSlide ? 'Get Started' : 'Next Slide'}</span>
              ${icon('arrowRight', 'w-4 h-4 text-slate-950')}
            </button>
          </div>

          <!-- Offline Field Guest Access Button (Always accessible) -->
          <button 
            type="button" 
            id="onboard-guest-btn" 
            class="w-full min-h-[44px] px-3 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 font-semibold text-xs border border-amber-500/30 transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <svg class="w-4 h-4 text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="1" y1="1" x2="23" y2="23"/>
              <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
              <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
              <path d="M10.71 5.05A16 16 0 0 1 22.58 9"/>
              <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
            <span>Continue as Offline Field Guest</span>
          </button>
        </div>

      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    overlay.querySelector('#onboard-skip-btn')?.addEventListener('click', () => finish('get_started'));
    overlay.querySelector('#onboard-guest-btn')?.addEventListener('click', () => finish('offline_guest'));

    overlay.querySelector('#onboard-prev-btn')?.addEventListener('click', () => {
      if (currentSlide > 0) {
        currentSlide--;
        render();
      }
    });

    overlay.querySelector('#onboard-next-btn')?.addEventListener('click', () => {
      if (currentSlide < SLIDES.length - 1) {
        currentSlide++;
        render();
      } else {
        finish('get_started');
      }
    });

    overlay.querySelectorAll('.slide-dot-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-slide-index'));
        if (!isNaN(idx)) {
          currentSlide = idx;
          render();
        }
      });
    });

    // Mobile touch swipe support
    let touchStartX = 0;
    overlay.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    overlay.addEventListener('touchend', (e) => {
      const touchEndX = e.changedTouches[0].screenX;
      const diff = touchStartX - touchEndX;
      if (Math.abs(diff) > 45) {
        if (diff > 0 && currentSlide < SLIDES.length - 1) {
          currentSlide++;
          render();
        } else if (diff < 0 && currentSlide > 0) {
          currentSlide--;
          render();
        }
      }
    }, { passive: true });
  }

  render();
  return overlay;
}
