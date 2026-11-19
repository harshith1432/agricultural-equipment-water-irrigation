/**
 * Closed-Loop Leaf-to-Valve Synergy Card
 * Auto-generates real-time agronomic interventions when leaf reflectance detects water deficit
 * confirmed by multi-depth FDR soil telemetry.
 */
import { ttsEngine } from '../audio/voiceReadoutTTS.js';
import { t, onLocaleChange, getCropName } from '../utils/i18n.js';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createClosedLoopSynergySection(recommendations = [], onAction) {
  const container = document.createElement('section');
  container.className = "w-full";

  function render() {
    const pendingRecs = (recommendations || []).filter(r => r?.status === 'PENDING');
    const pastRecs = (recommendations || []).filter(r => r?.status && r.status !== 'PENDING').slice(0, 3);

    if (recommendations.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <div class="bg-white dark:bg-slate-900 rounded-3xl p-4 sm:p-5 border border-amber-500/30 dark:border-amber-500/20 shadow-sm relative overflow-hidden select-none">
        <!-- Glow ambient backdrop -->
        <div class="absolute top-0 right-0 w-80 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div class="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
          <div class="flex items-center gap-2.5">
            <div class="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <svg class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <div>
              <h2 class="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                ${t('synergy_engine_title')}
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-400/40">
                  ${pendingRecs.length} ${t('actions_needed')}
                </span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${t('synergy_engine_desc')}</p>
            </div>
          </div>
        </div>

        <!-- Pending Action Cards List -->
        <div class="space-y-3 relative z-10" id="synergy-cards-list">
          ${pendingRecs.map(rec => `
            <div class="bg-amber-50/60 dark:bg-slate-800/90 rounded-2xl p-4 border border-amber-300/60 dark:border-amber-500/30 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-1 flex-wrap min-w-0">
                  <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#0E5431] text-white">
                    GATE ${escapeHtml(rec.gateId || 'G' + rec.plotNumber)}
                  </span>
                  <span class="text-xs font-bold text-slate-900 dark:text-white truncate">${escapeHtml(getCropName(rec.crop))} (${t('zone_label', 'Zone')} ${escapeHtml(rec.plotNumber)})</span>
                  <span class="text-[10px] font-mono font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-400/30 shrink-0">
                    ${t('water_stress_confirmed')}
                  </span>
                </div>
                <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-200 mt-1 font-medium">
                  ${escapeHtml(rec.triggerReason)}
                </p>
                <div class="flex flex-wrap items-center gap-2 sm:gap-3 text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-2">
                  <span>${t('proposed_pulse')}: <strong class="text-[#0E5431] dark:text-emerald-400">${Number(rec.suggestedDurationMinutes) || 25} min ${t('latching_12v')}</strong></span>
                  <span>•</span>
                  <span>${t('estimated_volume')}: <strong class="text-blue-600 dark:text-blue-300">~${Math.round((Number(rec.suggestedDurationMinutes) || 25) * 8.5)} ${t('liters')}</strong></span>
                  ${rec.nitrogenPrescriptionKg > 0 ? `<span>•</span><span class="text-amber-700 dark:text-amber-300">${t('fertilizer_prescr')}: ${Number(rec.nitrogenPrescriptionKg)} kg Urea</span>` : ''}
                </div>
              </div>

              <!-- Action Buttons: Voice Readout, APPROVE, DISMISS -->
              <div class="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap shrink-0">
                <!-- Voice TTS Readout -->
                <button data-rec-id="${escapeHtml(rec.id)}" class="rec-tts-btn min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-xl bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 transition shrink-0" title="${t('voice_readout')}">
                  <svg class="w-5 h-5 text-[#0E5431] dark:text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                  </svg>
                </button>

                <!-- Dismiss Button -->
                <button data-rec-id="${escapeHtml(rec.id)}" data-action="DISMISS" class="rec-action-btn min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 transition shrink-0 whitespace-nowrap">
                  ${t('rec_dismiss')}
                </button>

                <!-- Approve Button -->
                <button data-rec-id="${escapeHtml(rec.id)}" data-action="APPROVE" class="rec-action-btn min-h-[44px] px-4 sm:px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#0E5431] hover:bg-[#083820] shadow-sm transition active:scale-95 flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  ${t('approve_actuate')}
                </button>
              </div>
            </div>
          `).join('')}

          ${pendingRecs.length === 0 ? `
            <div class="text-center py-6 text-xs text-slate-500 font-mono">
              ${t('no_pending_stress')}
            </div>
          ` : ''}
        </div>

        <!-- Past resolved recommendations preview -->
        ${pastRecs.length > 0 ? `
          <div class="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 font-mono">
            <span class="text-slate-400">${t('recent_actions')}:</span>
            ${pastRecs.map(pr => `
              <span class="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                Zone ${escapeHtml(pr.plotNumber)}: ${pr.status === 'APPROVED' ? '✓ ' + t('actuated_ok') : '✕ ' + t('dismissed_ok')}
              </span>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Attach action button handlers
    container.querySelectorAll('.rec-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.getAttribute('data-rec-id');
        const action = btn.getAttribute('data-action');
        if (onAction) onAction(recId, action);
      });
    });

    container.querySelectorAll('.rec-tts-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const recId = btn.getAttribute('data-rec-id');
        const rec = recommendations.find(r => r.id === recId);
        if (rec) {
          ttsEngine.speakDecision('CLOSED_LOOP', {
            plotNumber: rec.plotNumber,
            gateId: rec.gateId,
            soilVwc: 13.8
          });
        }
      });
    });
  }

  onLocaleChange(() => render());
  render();
  return container;
}
