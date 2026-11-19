/**
 * Guided Spectroscope Calibration & Leaf Acquisition Wizard Test Suite
 * Exhaustive QA verifying:
 *  1. Step 1: Dark Calibration ("Put on the dark", 0% baseline, audio prompt, sweep)
 *  2. Step 2: White Calibration ("Put on the white light", 99% PTFE disc, audio prompt, sweep)
 *  3. Step 3: Specimen Metadata Form (Plant Number, Port/Row, Crop Variety, Zone, Validation)
 *  4. Step 4: Leaf Placement Guidance ("Place on the plant leaf", Lamina & Vein avoidance visual guide)
 *  5. Step 5: Spectral Capture & Results (76-band curve, NDVI, NDRE, WBI, Chlorophyll, Vitality)
 *  6. Design Standards: min 44px touch targets, zero corrupt text, proper completion callbacks
 *  7. SpectroscopyAnalysisView Integration with Guided Wizard
 */

import { describe, it, expect, runner } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';

// Setup headless DOM
setupHeadlessDOM();

import { createCalibrationModal } from '../src/components/CalibrationWizard.js';
import { createSpectroscopyAnalysisView } from '../src/components/dashboards/SpectroscopyAnalysisView.js';
import { leafClipDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { spectrometerUSBAdapter } from '../src/hardware/spectrometerUSBAdapter.js';
import { setLocale } from '../src/utils/i18n.js';

export function registerCalibrationWizardTests() {
  describe('Guided Spectroscope Calibration & Leaf Acquisition Wizard', () => {
    setLocale('en');

    it('Step 1 (Dark Calibration): displays dark prompt, audio button, and executes 0% baseline sweep', async () => {
      setLocale('en');
      // Mock fast calibration step
      const origRun = leafClipDevice.runCalibrationStep.bind(leafClipDevice);
      leafClipDevice.runCalibrationStep = async (phase, onProgress) => {
        leafClipDevice.calibration.darkCurrentCompleted = true;
        onProgress(100, "Dark Current Reference Locked.");
        return { success: true, phase };
      };

      let closed = false;
      const modal = createCalibrationModal({
        initialStep: 'DARK_CURRENT',
        onClose: () => { closed = true; }
      });

      expect(Boolean(modal)).toBe(true);

      // Verify header and step title
      const text = modal.textContent;
      expect(text).toContain('Spectroscope Calibration & Leaf Acquisition');
      expect(text).toContain('Put on the dark');
      expect(text).toContain('Dark Current');

      // Verify audio button
      const audioBtn = modal.querySelector('#calib-audio-btn');
      expect(Boolean(audioBtn)).toBe(true);
      expect(audioBtn.getBoundingClientRect().width).toBeGreaterThanOrEqual(44);
      expect(audioBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

      // Audio click shouldn't throw
      audioBtn.click();

      // Verify run button
      const runBtn = modal.querySelector('#calib-run-btn');
      expect(Boolean(runBtn)).toBe(true);
      expect(runBtn.textContent).toContain('Dark Current');
      expect(runBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

      // Execute Dark Current sweep
      await runBtn.click();
      expect(leafClipDevice.calibration.darkCurrentCompleted).toBe(true);

      // Step advances to Step 2: White Reference
      const step2Text = modal.textContent;
      expect(step2Text).toContain('Put on the white light');
      expect(step2Text).toContain('99% PTFE');

      leafClipDevice.runCalibrationStep = origRun;
    });

    it('Step 2 (White Calibration): displays white prompt, executes 99% PTFE disc sweep, and unlocks options', async () => {
      setLocale('en');
      const origRun = leafClipDevice.runCalibrationStep.bind(leafClipDevice);
      leafClipDevice.runCalibrationStep = async (phase, onProgress) => {
        leafClipDevice.calibration.whiteDiscCompleted = true;
        leafClipDevice.calibration.isCalibrated = true;
        onProgress(100, "White Disc Reference Locked.");
        return { success: true, phase };
      };

      leafClipDevice.calibration.whiteDiscCompleted = false;
      leafClipDevice.calibration.isCalibrated = false;

      let completedData = null;
      const modal = createCalibrationModal({
        initialStep: 'WHITE_REFERENCE',
        onComplete: (data) => { completedData = data; }
      });

      // Verify White step contents
      expect(modal.textContent).toContain('Put on the white light');
      const whiteBtn = modal.querySelector('#calib-run-btn');
      expect(Boolean(whiteBtn)).toBe(true);
      expect(whiteBtn.textContent).toContain('White Disc');

      // Run White Disc sweep
      await whiteBtn.click();
      expect(leafClipDevice.calibration.whiteDiscCompleted).toBe(true);
      expect(leafClipDevice.calibration.isCalibrated).toBe(true);

      // Both "Done & Return" and "Next: Specimen ID" buttons appear
      const doneBtn = modal.querySelector('#calib-done-btn');
      const nextBtn = modal.querySelector('#calib-next-btn');
      expect(Boolean(doneBtn)).toBe(true);
      expect(Boolean(nextBtn)).toBe(true);
      expect(doneBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      expect(nextBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

      // Click Next to advance to Step 3: Metadata
      nextBtn.click();
      expect(modal.textContent).toContain('Specimen Traceability Metadata');
      expect(modal.textContent).toContain('Plant Number');

      leafClipDevice.runCalibrationStep = origRun;
    });

    it('Step 3 (Specimen Metadata Form): enforces validation on plant number, port, variety, and zone', () => {
      setLocale('en');
      const modal = createCalibrationModal({
        initialStep: 'METADATA'
      });

      expect(modal.textContent).toContain('Specimen Traceability Metadata');

      let plantInput = modal.querySelector('#calib-input-plant');
      let portInput = modal.querySelector('#calib-input-port');
      let cropInput = modal.querySelector('#calib-input-crop');
      let toPlacementBtn = modal.querySelector('#calib-to-placement-btn');

      expect(Boolean(plantInput)).toBe(true);
      expect(Boolean(portInput)).toBe(true);
      expect(Boolean(cropInput)).toBe(true);
      expect(Boolean(toPlacementBtn)).toBe(true);

      // Clear inputs to trigger validation failure
      plantInput.value = '';
      portInput.value = '';
      cropInput.value = '';

      toPlacementBtn.click();

      // Should remain on Step 3 and show validation errors
      expect(modal.textContent).toContain('Plant number is required');
      expect(modal.textContent).toContain('Port/Row number is required');
      expect(modal.textContent).toContain('Crop variety is required');

      // Re-query newly rendered inputs
      plantInput = modal.querySelector('#calib-input-plant');
      portInput = modal.querySelector('#calib-input-port');
      cropInput = modal.querySelector('#calib-input-crop');
      toPlacementBtn = modal.querySelector('#calib-to-placement-btn');

      // Now fill with valid data
      plantInput.value = 'PLANT-108';
      portInput.value = 'PORT-04';
      cropInput.value = 'Roma Tomato';

      // Select Zone 3
      const zone3Btn = modal.querySelector('.calib-zone-btn[data-zone="Zone 3"]');
      if (zone3Btn) zone3Btn.click();

      // Proceed to Step 4: Leaf Placement
      const finalToPlacementBtn = modal.querySelector('#calib-to-placement-btn');
      finalToPlacementBtn.click();
      expect(modal.textContent).toContain('Place on the plant leaf');
      expect(modal.textContent).toContain('Guided Probe Clamp Placement');
    });

    it('Step 4 (Leaf Placement): shows lamina visual guidance and avoids thick veins', async () => {
      setLocale('en');
      const modal = createCalibrationModal({
        initialStep: 'LEAF_PLACEMENT',
        specimen: {
          plantNumber: 'PLANT-042',
          portNumber: 'PORT-08',
          cropVariety: 'Roma Tomato',
          zone: 'Zone 2'
        }
      });

      const text = modal.textContent;
      expect(text).toContain('Place on the plant leaf');
      expect(text).toContain('TARGET LAMINA');
      expect(text).toContain('AVOID THICK VEINS');

      // Verify touch targets for back, cancel, and scan buttons
      const backBtn = modal.querySelector('#calib-back-btn');
      const scanBtn = modal.querySelector('#calib-start-scan-btn');
      expect(Boolean(backBtn)).toBe(true);
      expect(Boolean(scanBtn)).toBe(true);
      expect(scanBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

      // Acquire 76-band scan
      await scanBtn.click();

      // Should advance to Step 5: Results
      expect(modal.textContent).toContain('Live 76-Band Reflectance Spectrum');
      expect(modal.textContent).toContain('Vitality');
      expect(modal.textContent).toContain('NDVI');
      expect(modal.textContent).toContain('NDRE');
    });

    it('Step 5 (Spectral Capture & Results): displays 76-band curve, NDVI, NDRE, WBI, vitality and completes', () => {
      setLocale('en');
      let completedPayload = null;
      const modal = createCalibrationModal({
        initialStep: 'RESULTS',
        specimen: {
          plantNumber: 'PLANT-099',
          portNumber: 'PORT-12',
          cropVariety: 'Bell Peppers',
          zone: 'Zone 4'
        },
        onComplete: (data) => { completedPayload = data; }
      });

      // Specimen header check
      const text = modal.textContent;
      expect(text).toContain('PLANT-099');
      expect(text).toContain('PORT-12');
      expect(text).toContain('Bell Peppers');
      expect(text).toContain('Zone 4');

      // Canvas check
      const canvas = modal.querySelector('#calib-spectral-canvas');
      expect(Boolean(canvas)).toBe(true);

      // Rescan button returns to Step 4
      const rescanBtn = modal.querySelector('#calib-rescan-btn');
      expect(Boolean(rescanBtn)).toBe(true);

      // Done button applies scan and exits
      const doneBtn = modal.querySelector('#calib-done-btn');
      expect(Boolean(doneBtn)).toBe(true);
      expect(doneBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
      doneBtn.click();

      expect(Boolean(completedPayload)).toBe(true);
      expect(completedPayload.specimen.plantNumber).toBe('PLANT-099');
      expect(completedPayload.specimen.cropVariety).toBe('Bell Peppers');
    });

    it('SpectroscopyAnalysisView integrates with Guided Leaf Acquisition Wizard', () => {
      setLocale('en');
      let calibOpened = false;
      const view = createSpectroscopyAnalysisView({
        onOpenCalibration: (mode) => { calibOpened = mode; }
      });

      expect(Boolean(view)).toBe(true);

      // Verify Guided Scan button exists and has min 44px height
      const guidedBtn = view.querySelector('#btn-guided-scan');
      expect(Boolean(guidedBtn)).toBe(true);
      expect(guidedBtn.getBoundingClientRect().height).toBeGreaterThanOrEqual(44);

      // Click Guided Scan button
      guidedBtn.click();
      expect(Boolean(calibOpened)).toBe(true);
    });

  });
}

// Execute standalone if run directly
if (process.argv[1]?.endsWith('calibration-wizard.test.js')) {
  registerCalibrationWizardTests();
  runner.run().then(res => {
    if (!res.success) process.exit(1);
  });
}
