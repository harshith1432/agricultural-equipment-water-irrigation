/**
 * Closed-Loop Leaf-to-Valve Synergy Card
 * Auto-generates real-time agronomic interventions when leaf reflectance detects water deficit
 * confirmed by multi-depth FDR soil telemetry.
 */
import { ttsEngine } from '../audio/voiceReadoutTTS.js';

export function createClosedLoopSynergySection(recommendations = [], onAction) {
  const container = document.createElement('section');
  container.className = "w-full";

  const pendingRecs = (recommendations || []).filter(r => r?.status === 'PENDING');
  const pastRecs = (recommendations || []).filter(r => r?.status && r.status !== 'PENDING').slice(0, 3);

  if (recommendations.length === 0) {
    return container; // Empty if no recommendations
  }

  container.innerHTML = `
    <div class="bg-gradient-to-r from-amber-950/40 via-slate-850 to-slate-850 rounded-2xl p-5 border border-amber-500/40 shadow-xl relative overflow-hidden">
      <!-- Glow ambient backdrop -->
      <div class="absolute top-0 right-0 w-80 h-40 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div class="flex flex-wrap items-center justify-between gap-3 mb-4 relative z-10">
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amberPulse">
            <svg class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <div>
            <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              Closed-Loop Leaf-to-Valve Synergy Engine
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amberPulse border border-amber-500/40">
                ${pendingRecs.length} Action Needed
              </span>
            </h2>
            <p class="text-xs text-slate-300">Edge ML Chemometrics cross-referenced with live FDR soil telemetry.</p>
          </div>
        </div>
      </div>

      <!-- Pending Action Cards List -->
      <div class="space-y-3 relative z-10" id="synergy-cards-list">
        ${pendingRecs.map(rec => `
          <div class="bg-slate-800/90 rounded-xl p-4 border border-amber-500/30 shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-1">
                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emeraldGlow text-slate-950">
                  GATE ${rec.gateId || 'G' + rec.plotNumber}
                </span>
                <span class="text-xs font-bold text-white">${rec.crop} (Zone ${rec.plotNumber})</span>
                <span class="text-[10px] font-mono text-amberPulse bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30">
                  Water Stress Confirmed
                </span>
              </div>
              <p class="text-xs sm:text-sm text-slate-200 mt-1 font-medium">
                ${rec.triggerReason}
              </p>
              <div class="flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-400 mt-2">
                <span>Proposed: <strong class="text-emeraldGlow">${rec.suggestedDurationMinutes || 25} min +12V pulse</strong></span>
                <span>•</span>
                <span>Est. Volume: <strong class="text-blue-300">~${Math.round((rec.suggestedDurationMinutes || 25) * 8.5)} Liters</strong></span>
                ${rec.nitrogenPrescriptionKg > 0 ? `<span>•</span><span class="text-amber-300">Fertilizer: ${rec.nitrogenPrescriptionKg} kg Urea</span>` : ''}
              </div>
            </div>

            <!-- Action Buttons: Voice Readout, APPROVE, DISMISS -->
            <div class="flex items-center gap-2 w-full md:w-auto justify-end">
              <!-- Voice TTS Readout -->
              <button data-rec-id="${rec.id}" class="rec-tts-btn min-w-[48px] min-h-[48px] flex items-center justify-center p-2.5 rounded-xl bg-slate-700 hover:bg-slate-650 text-slate-300 hover:text-white transition" title="Voice Readout">
                <svg class="w-5 h-5 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
                </svg>
              </button>

              <!-- Dismiss Button -->
              <button data-rec-id="${rec.id}" data-action="DISMISS" class="rec-action-btn min-h-[48px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-750 hover:bg-slate-700 border border-slate-650 transition">
                Dismiss
              </button>

              <!-- Approve Button -->
              <button data-rec-id="${rec.id}" data-action="APPROVE" class="rec-action-btn min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emeraldGlow to-teal-400 hover:from-emeraldGlow-light hover:to-teal-300 shadow-md shadow-emeraldGlow/25 border border-emerald-300 transition transform active:scale-95 flex items-center gap-2">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                Approve & Actuate (+12V)
              </button>
            </div>
          </div>
        `).join('')}

        ${pendingRecs.length === 0 ? `
          <div class="text-center py-6 text-xs text-slate-400 font-mono">
            No pending stress actions. Canopy turgor & FDR soil telemetry are in equilibrium across all 6 zones.
          </div>
        ` : ''}
      </div>

      <!-- Past resolved recommendations preview -->
      ${pastRecs.length > 0 ? `
        <div class="mt-4 pt-3 border-t border-slate-750/80 flex flex-wrap items-center gap-2 text-[11px] text-slate-400 font-mono">
          <span class="text-slate-500">Recent:</span>
          ${pastRecs.map(pr => `
            <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Zone ${pr.plotNumber}: ${pr.status === 'APPROVED' ? '✓ Actuated' : '✕ Dismissed'}
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

  return container;
}
