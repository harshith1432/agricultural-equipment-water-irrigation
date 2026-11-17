/**
 * Optical Calibration Wizard Modal
 * Step-by-step Dark Current Reference Test + 99% PTFE White Disc Calibration
 */
import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';

export function createCalibrationModal({ onClose, onComplete }) {
  const overlay = document.createElement('div');
  overlay.className = "fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn";

  let currentStep = 'DARK_CURRENT'; // 'DARK_CURRENT' -> 'WHITE_REFERENCE' -> 'COMPLETED'
  let progress = 0;
  let statusText = "Ready to initialize CMOS detector baseline.";
  let isRunning = false;

  function render() {
    overlay.innerHTML = `
      <div class="bg-slate-850 border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        <!-- Close button -->
        <button id="calib-close-btn" class="absolute top-3 right-3 text-slate-400 hover:text-white min-w-[48px] min-h-[48px] flex items-center justify-center rounded-xl hover:bg-slate-750 transition" title="Close">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Header -->
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amberPulse">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
            </svg>
          </div>
          <div>
            <h3 class="text-base sm:text-lg font-bold text-white">Leaf-Clip Spectrometer Calibration</h3>
            <p class="text-xs text-slate-400">Two-point optical normalization [350–1100 nm VIS-NIR]</p>
          </div>
        </div>

        <!-- Step Indicator -->
        <div class="grid grid-cols-2 gap-2 mb-6 text-xs font-mono">
          <div class="p-2.5 rounded-xl border ${currentStep === 'DARK_CURRENT' ? 'bg-amber-500/10 border-amber-500/50 text-amber-300' : (leafClipDevice.calibration.darkCurrentCompleted ? 'bg-emeraldGlow/10 border-emeraldGlow/40 text-emeraldGlow' : 'bg-slate-800 border-slate-700 text-slate-400')}">
            <div class="flex items-center gap-1.5 font-bold mb-0.5">
              <span>Step 1:</span>
              <span>${leafClipDevice.calibration.darkCurrentCompleted ? '✓ Verified' : 'Dark Current'}</span>
            </div>
            <p class="text-[10px] text-slate-400 font-sans">Null thermal sensor drift</p>
          </div>

          <div class="p-2.5 rounded-xl border ${currentStep === 'WHITE_REFERENCE' ? 'bg-blue-500/10 border-blue-500/50 text-blue-300' : (leafClipDevice.calibration.whiteDiscCompleted ? 'bg-emeraldGlow/10 border-emeraldGlow/40 text-emeraldGlow' : 'bg-slate-800 border-slate-700 text-slate-400')}">
            <div class="flex items-center gap-1.5 font-bold mb-0.5">
              <span>Step 2:</span>
              <span>${leafClipDevice.calibration.whiteDiscCompleted ? '✓ Calibrated' : '99% PTFE Disc'}</span>
            </div>
            <p class="text-[10px] text-slate-400 font-sans">Diffuse standard 100% R(λ)</p>
          </div>
        </div>

        <!-- Instructions and animation box -->
        <div class="bg-slate-900/90 rounded-xl p-4 border border-slate-750 mb-6">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-slate-300 font-mono font-bold text-xs">
              ${currentStep === 'DARK_CURRENT' ? '01' : (currentStep === 'WHITE_REFERENCE' ? '02' : '✓')}
            </div>
            <div>
              <h4 class="text-xs font-bold text-white mb-1">
                ${currentStep === 'DARK_CURRENT' 
                  ? 'Close Leaf-Clip Optical Chamber (Zero Light)' 
                  : (currentStep === 'WHITE_REFERENCE' 
                    ? 'Insert 99% Pure PTFE Spectralon Disc' 
                    : 'Optical Normalization Locked')}
              </h4>
              <p class="text-xs text-slate-400 leading-relaxed font-sans">
                ${currentStep === 'DARK_CURRENT'
                  ? 'Ensure the leaf-clip clamp is snapped shut without any leaf. This samples CMOS dark thermal currents across all 76 wavelength photodiodes.'
                  : (currentStep === 'WHITE_REFERENCE'
                    ? 'Clamp the white calibration target disc inside the sample holder to calibrate 100% reflectance across 350-1100 nm.'
                    : 'System calibrated. Ready for high-precision in-situ leaf scans with optimal signal-to-noise ratio.')}
              </p>
            </div>
          </div>

          <!-- Progress Bar -->
          ${isRunning ? `
            <div class="mt-4 pt-3 border-t border-slate-800">
              <div class="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>Calibration Sweep</span>
                <span class="text-emeraldGlow">${progress}%</span>
              </div>
              <div class="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div class="h-full bg-gradient-to-r from-amber-500 to-emeraldGlow transition-all duration-300 rounded-full" style="width: ${progress}%"></div>
              </div>
              <p class="text-[11px] font-mono text-slate-300 mt-2">${statusText}</p>
            </div>
          ` : ''}
        </div>

        <!-- Action Buttons -->
        <div class="flex items-center justify-end gap-3">
          <button id="calib-cancel-btn" class="min-h-[48px] px-5 py-2.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition">
            Close
          </button>

          ${currentStep !== 'COMPLETED' ? `
            <button id="calib-run-btn" ${isRunning ? 'disabled' : ''} class="min-h-[48px] px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emeraldGlow to-teal-400 hover:from-emeraldGlow-light hover:to-teal-300 shadow-md shadow-emeraldGlow/25 border border-emerald-300 transition disabled:opacity-50">
              ${isRunning ? 'Calibrating...' : `Run ${currentStep === 'DARK_CURRENT' ? 'Dark Current Test' : 'White Disc Test'}`}
            </button>
          ` : `
            <button id="calib-done-btn" class="min-h-[48px] px-6 py-2.5 rounded-xl text-xs font-bold text-slate-950 bg-emeraldGlow hover:bg-emeraldGlow-light shadow-md shadow-emeraldGlow/30 transition">
              Done & Return to Field
            </button>
          `}
        </div>
      </div>
    `;

    // Attach handlers
    overlay.querySelector('#calib-close-btn').addEventListener('click', () => {
      overlay.remove();
      if (onClose) onClose();
    });

    overlay.querySelector('#calib-cancel-btn').addEventListener('click', () => {
      overlay.remove();
      if (onClose) onClose();
    });

    const runBtn = overlay.querySelector('#calib-run-btn');
    if (runBtn) {
      runBtn.addEventListener('click', async () => {
        isRunning = true;
        render();

        try {
          if (currentStep === 'DARK_CURRENT') {
            await leafClipDevice.runCalibrationStep('DARK_CURRENT', (p, msg) => {
              progress = p;
              statusText = msg;
              render();
            });
            isRunning = false;
            currentStep = 'WHITE_REFERENCE';
            render();
          } else if (currentStep === 'WHITE_REFERENCE') {
            await leafClipDevice.runCalibrationStep('WHITE_REFERENCE', (p, msg) => {
              progress = p;
              statusText = msg;
              render();
            });
            isRunning = false;
            currentStep = 'COMPLETED';
            render();
            if (onComplete) onComplete();
          }
        } catch (err) {
          console.error("Calibration error:", err);
          isRunning = false;
          statusText = "Error during calibration: " + err.message;
          render();
        }
      });
    }

    const doneBtn = overlay.querySelector('#calib-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        overlay.remove();
        if (onComplete) onComplete();
      });
    }
  }

  render();
  return overlay;
}
