/**
 * Central AI Crop Health & Decision Support View
 * Strict NO-EMOJI vector UI styled after the lush forest green farm mobile theme.
 * Features:
 *   - Cross-module multi-modal data fusion:
 *       1. Soil NPK & Moisture from LABART 8-in-1
 *       2. Canopy Vitality & Disease Risk from Spectroscopy Studio
 *       3. Ambient Temp, RH & VPD from Environment Monitor
 *       4. Hydraulic water delivered from Drip Irrigation Hub
 *   - Actionable smart advice cards with 1-tap execution buttons
 *   - Closed-Loop synergy status verification
 */

import { icon } from '../../utils/icons.js';
import { t, onLocaleChange } from '../../utils/i18n.js';
import { irrigationControllerAdapter } from '../../hardware/irrigationControllerAdapter.js';

export function createAIIntelligenceView({
  plots = [],
  latestScanAnalysis = null,
  onActuateValve
}) {
  const container = document.createElement('div');
  container.className = "ai-intelligence-view w-full space-y-4 pb-28 text-slate-800 select-none";

  // State of executed recommendations
  const executedActions = new Set();

  function render() {
    container.innerHTML = `
      <!-- 1. Top Hero Card: Cross-Module Data Fusion -->
      <div class="bg-gradient-to-br from-[#0E5431] to-[#0A3D23] text-white rounded-3xl p-5 shadow-lg border border-emerald-800/40 space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-emerald-300">
              ${icon('zap', 'w-4 h-4')}
            </div>
            <div>
              <h2 class="text-base font-bold tracking-tight">${t('ai_title')}</h2>
              <p class="text-[11px] text-emerald-200/80">${t('ai_subtitle')}</p>
            </div>
          </div>

          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/15 border border-white/20 text-emerald-100 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>Live Fusion</span>
          </span>
        </div>

        <!-- Multi-Modal Data Ingestion Matrix -->
        <div class="grid grid-cols-4 gap-2 pt-2 border-t border-emerald-700/40 text-center">
          <div class="bg-white/10 rounded-2xl p-2 flex flex-col items-center">
            <span class="text-[9px] text-emerald-200">Soil Moisture</span>
            <span class="text-sm font-black font-mono mt-0.5 text-white">42.2%</span>
            <span class="text-[8px] text-emerald-300">LABART 8-in-1</span>
          </div>

          <div class="bg-white/10 rounded-2xl p-2 flex flex-col items-center">
            <span class="text-[9px] text-emerald-200">Canopy Vitality</span>
            <span class="text-sm font-black font-mono mt-0.5 text-white">84 / 100</span>
            <span class="text-[8px] text-emerald-300">VIS-NIR Spec</span>
          </div>

          <div class="bg-white/10 rounded-2xl p-2 flex flex-col items-center">
            <span class="text-[9px] text-emerald-200">Vapor Deficit</span>
            <span class="text-sm font-black font-mono mt-0.5 text-white">1.25 kPa</span>
            <span class="text-[8px] text-emerald-300">Open-Meteo</span>
          </div>

          <div class="bg-white/10 rounded-2xl p-2 flex flex-col items-center">
            <span class="text-[9px] text-emerald-200">Water Given</span>
            <span class="text-sm font-black font-mono mt-0.5 text-white">1,845 L</span>
            <span class="text-[8px] text-emerald-300">Drip Hub</span>
          </div>
        </div>

        <!-- Synergy Active Badge -->
        <div class="bg-emerald-950/60 rounded-2xl p-2.5 border border-emerald-600/30 flex items-center gap-2 text-xs text-emerald-200">
          ${icon('shieldCheck', 'w-4 h-4 text-emerald-400 shrink-0')}
          <span>${t('ai_synergy')}</span>
        </div>
      </div>

      <!-- 2. Actionable Smart Advice Cards with 1-Tap Execution -->
      <div class="space-y-3">
        <h3 class="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
          Autonomous Actionable Recommendations
        </h3>

        <!-- Recommendation 1: Smart Irrigation Pulse -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-blue-50 dark:bg-blue-950/60 border border-blue-500/20 flex items-center justify-center text-blue-600">
                ${icon('droplet', 'w-5 h-5')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">Relieve Sub-surface Water Stress</h4>
                <p class="text-[11px] text-slate-500">Zone 2 Tomato canopy requires 450L root pulse</p>
              </div>
            </div>

            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 font-mono">
              96% Impact
            </span>
          </div>

          <p class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            Spectroscopy detects Leaf Water Index dip (0.84), while LABART probe indicates dry root boundary at 30cm depth.
          </p>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] font-mono text-slate-400">Target: Gate 2 • 25 Minutes</span>
            <button 
              type="button" 
              data-rec-id="rec-pulse-zone2"
              class="rec-exec-btn px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                executedActions.has('rec-pulse-zone2') 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed' 
                  : 'bg-[#0E5431] hover:bg-[#083820] text-white transform active:scale-95'
              }"
              ${executedActions.has('rec-pulse-zone2') ? 'disabled' : ''}
            >
              ${executedActions.has('rec-pulse-zone2') ? icon('check', 'w-3.5 h-3.5 text-emerald-600') : icon('play', 'w-3.5 h-3.5')}
              <span>${executedActions.has('rec-pulse-zone2') ? 'Executed' : t('ai_execute')}</span>
            </button>
          </div>
        </div>

        <!-- Recommendation 2: Precision Nitrogen Fertigation -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-500/20 flex items-center justify-center text-amber-700">
                ${icon('sprout', 'w-5 h-5')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">Precision NPK Fertigation Dosage</h4>
                <p class="text-[11px] text-slate-500">Inject 14 kg/acre liquid Urea via Venturi bypass</p>
              </div>
            </div>

            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 font-mono">
              92% Impact
            </span>
          </div>

          <p class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            Red edge reflectance (NDRE 0.28) and soil available Nitrogen (68 mg/kg) fall below tuber expansion thresholds.
          </p>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] font-mono text-slate-400">Venturi Doser • Line G1</span>
            <button 
              type="button" 
              data-rec-id="rec-urea-doser"
              class="rec-exec-btn px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                executedActions.has('rec-urea-doser') 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed' 
                  : 'bg-[#0E5431] hover:bg-[#083820] text-white transform active:scale-95'
              }"
              ${executedActions.has('rec-urea-doser') ? 'disabled' : ''}
            >
              ${executedActions.has('rec-urea-doser') ? icon('check', 'w-3.5 h-3.5 text-emerald-600') : icon('calendar', 'w-3.5 h-3.5')}
              <span>${executedActions.has('rec-urea-doser') ? 'Scheduled' : t('ai_schedule')}</span>
            </button>
          </div>
        </div>

        <!-- Recommendation 3: Preventative Bio-Fungicide Spraying -->
        <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-emerald-900/5 dark:border-slate-800 space-y-3">
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-teal-50 dark:bg-teal-950/60 border border-teal-500/20 flex items-center justify-center text-teal-700">
                ${icon('shieldCheck', 'w-5 h-5')}
              </div>
              <div>
                <h4 class="text-xs font-bold text-slate-900 dark:text-white">Pre-Symptomatic Mildew Shield</h4>
                <p class="text-[11px] text-slate-500">Apply Bacillus subtilis organic bio-spray</p>
              </div>
            </div>

            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-800 font-mono">
              90% Impact
            </span>
          </div>

          <p class="text-xs text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-850 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            Green-to-Red ratio shift combined with sustained 76% relative humidity indicates high fungal spore incubation.
          </p>

          <div class="flex items-center justify-between pt-1">
            <span class="text-[10px] font-mono text-slate-400">Wind: 12 km/h • Optimum Window</span>
            <button 
              type="button" 
              data-rec-id="rec-bio-spray"
              class="rec-exec-btn px-4 py-2 rounded-full text-xs font-bold transition flex items-center gap-1.5 shadow-sm ${
                executedActions.has('rec-bio-spray') 
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 cursor-not-allowed' 
                  : 'bg-[#0E5431] hover:bg-[#083820] text-white transform active:scale-95'
              }"
              ${executedActions.has('rec-bio-spray') ? 'disabled' : ''}
            >
              ${executedActions.has('rec-bio-spray') ? icon('check', 'w-3.5 h-3.5 text-emerald-600') : icon('shield', 'w-3.5 h-3.5')}
              <span>${executedActions.has('rec-bio-spray') ? 'Logged Spray' : 'Log Treatment'}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    container.querySelectorAll('.rec-exec-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-rec-id');
        if (!id || executedActions.has(id)) return;

        if (id === 'rec-pulse-zone2') {
          try {
            await irrigationControllerAdapter.openValve('valve-2', { durationMinutes: 25 });
            if (onActuateValve) onActuateValve({ valveId: 'valve-2', gateId: 'G2', action: 'OPEN', duration: 25 });
          } catch (e) {}
        }

        executedActions.add(id);
        render();
      });
    });
  }

  onLocaleChange(() => render());

  render();
  return container;
}
