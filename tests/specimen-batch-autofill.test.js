/**
 * Comprehensive Specimen Batch Metadata Autofill & Direct Scan Test Suite
 * (tests/specimen-batch-autofill.test.js)
 * 
 * Verifies:
 * 1. Two Modes Available (Manually Fill vs Automatically Fill) in Modal and Dashboard
 * 2. Single-Batch Metadata Unified Layout (Plant Name, Tag ID, Pot, Leaf Spot, Zone, Timestamp)
 * 3. Duplicate Detection Logic (leaf-specific granularity: same plant/pot but different leaf is VALID)
 * 4. "Automatically Fill" Behavior (auto-populate, auto-increment leaf spot, auto-transmit, ready banner)
 * 5. "Manually Fill" Behavior (validate, verify & send, arm spectroscope, ready banner)
 * 6. Prompt Elimination (direct scan triggers for Dark, White, and Leaf scans without interactive Y/N prompts)
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';

setupHeadlessDOM();

import { 
  createSpecimenSetupModal, 
  findDuplicateScanRecord, 
  getNextUnscannedLeafSpot, 
  getNextSequentialPlantTag, 
  formatCurrentDateTime,
  extractSpotNumber 
} from '../src/components/SpecimenSetupModal.js';
import { createSpectroscopyAnalysisView } from '../src/components/dashboards/SpectroscopyAnalysisView.js';
import { leafClipDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { spectrometerUSBAdapter } from '../src/hardware/spectrometerUSBAdapter.js';
import { setLocale } from '../src/utils/i18n.js';

export function registerSpecimenBatchAutofillTests() {
  setLocale('en');

  describe('Scenario 1: Two Modes Available (Manual vs Automatic)', () => {
    it('renders both "Automatically Fill" and "Manually Fill" toggle controls in SpecimenSetupModal', () => {
      const modal = createSpecimenSetupModal({
        initialData: { setupMode: 'auto' },
        existingScans: []
      });

      expect(Boolean(modal)).toBe(true);
      const autoBtn = modal.querySelector('#modal-mode-auto-btn');
      const manualBtn = modal.querySelector('#modal-mode-manual-btn');

      expect(Boolean(autoBtn)).toBe(true);
      expect(Boolean(manualBtn)).toBe(true);
      expect(autoBtn.textContent).toContain('Automatically Fill');
      expect(manualBtn.textContent).toContain('Manually Fill');
    });

    it('renders both "Automatically Fill" and "Manually Fill" mode tabs in SpectroscopyAnalysisView', () => {
      const view = createSpectroscopyAnalysisView({
        plot: { id: 'plot-1', crop: 'Tomato', pot: 'POT-1', name: 'Zone 1' }
      });

      const autoTab = view.querySelector('#specimen-mode-auto-tab');
      const manualTab = view.querySelector('#specimen-mode-manual-tab');

      expect(Boolean(autoTab)).toBe(true);
      expect(Boolean(manualTab)).toBe(true);
      expect(autoTab.textContent).toContain('Automatically Fill');
      expect(manualTab.textContent).toContain('Manually Fill');
    });

    it('toggles active visual state between Automatically Fill and Manually Fill', async () => {
      const modal = createSpecimenSetupModal({
        initialData: { setupMode: 'auto' },
        existingScans: []
      });

      const manualBtn = modal.querySelector('#modal-mode-manual-btn');
      manualBtn.click();

      // In manual mode, the verify and send button is rendered
      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      expect(Boolean(verifyBtn)).toBe(true);
      expect(verifyBtn.textContent).toContain('Verify & Send');

      const autoBtn = modal.querySelector('#modal-mode-auto-btn');
      autoBtn.click();
      await new Promise(r => setTimeout(r, 20));

      // Back in auto mode, autoPopulateAndTransmit runs and arms the device
      expect(modal.textContent).toContain('Spectroscope is ready');
    });
  });

  describe('Scenario 2: Single-Batch Metadata Layout', () => {
    it('provides all 6 fields in a single unified form in SpecimenSetupModal', () => {
      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Bell Pepper',
          plantNumber: 'PLANT-077',
          potNumber: 'POT-03',
          leafSpot: 'Leaf 3',
          zone: 'Zone 4',
          timestamp: '21 Nov 2026, 05:30 PM'
        },
        existingScans: []
      });

      const plantNameInput = modal.querySelector('#specimen-plant-name');
      const plantNumInput = modal.querySelector('#specimen-plant-number');
      const potNumInput = modal.querySelector('#specimen-pot-number');
      const leafSpotInput = modal.querySelector('#specimen-leaf-spot');
      const zoneSelect = modal.querySelector('#specimen-zone-select');
      const timestampInput = modal.querySelector('#specimen-timestamp');

      expect(Boolean(plantNameInput)).toBe(true);
      expect(Boolean(plantNumInput)).toBe(true);
      expect(Boolean(potNumInput)).toBe(true);
      expect(Boolean(leafSpotInput)).toBe(true);
      expect(Boolean(zoneSelect)).toBe(true);
      expect(Boolean(timestampInput)).toBe(true);

      expect(plantNameInput.value).toBe('Bell Pepper');
      expect(plantNumInput.value).toBe('PLANT-077');
      expect(potNumInput.value).toBe('POT-03');
      expect(leafSpotInput.value).toBe('Leaf 3');
      expect(zoneSelect.value).toBe('Zone 4');
      expect(timestampInput.value).toBe('21 Nov 2026, 05:30 PM');
    });

    it('transmits all 6 fields together in a single batch payload to hardware', async () => {
      let transmittedBatch = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (batch) => {
        transmittedBatch = batch;
        return { success: true, metadata: batch };
      };

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Sugarcane',
          plantNumber: 'PLANT-500',
          potNumber: 'POT-12',
          leafSpot: 'Spot 4',
          zone: 'Zone 2'
        },
        existingScans: []
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();

      expect(Boolean(transmittedBatch)).toBe(true);
      expect(transmittedBatch.plantName).toBe('Sugarcane');
      expect(transmittedBatch.plantNumber).toBe('PLANT-500');
      expect(transmittedBatch.potNumber).toBe('POT-12');
      expect(transmittedBatch.leafSpot).toBe('Spot 4');
      expect(transmittedBatch.zone).toBe('Zone 2');
      expect(Boolean(transmittedBatch.timestamp)).toBe(true);

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });
  });

  describe('Scenario 3: Duplicate Detection Logic & Leaf Granularity', () => {
    const existingScans = [
      {
        id: 'scan_001',
        plantName: 'Tomato',
        plantNumber: 'P-01',
        potNumber: 'POT-1',
        leafSpot: '1',
        timestamp: '2026-11-20T10:00:00Z'
      }
    ];

    it('Test 1: Submitting exact duplicate { Tomato, P-01, POT-1, leafSpot: 1 } MUST detect duplicate and display warning banner', async () => {
      let transmitted = false;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      leafClipDevice.transmitSpecimenBatch = async () => {
        transmitted = true;
        return { success: true };
      };

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Tomato',
          plantNumber: 'P-01',
          potNumber: 'POT-1',
          leafSpot: '1'
        },
        existingScans
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();

      // Must NOT transmit
      expect(transmitted).toBe(false);

      // Must display warning banner
      const modalText = modal.textContent;
      expect(modalText).toContain('Duplicate Detected');
      expect(modalText).toContain('Plant Tomato');
      expect(modalText).toContain('#P-01');
      expect(modalText).toContain('#POT-1');
      expect(modalText).toContain('Please change the leaf spot number or plant tag');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
    });

    it('Test 2: Submitting { Tomato, P-01, POT-1, leafSpot: 2 } (different leaf on SAME plant & pot) MUST NOT detect duplicate and MUST proceed', async () => {
      let transmittedData = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (data) => {
        transmittedData = data;
        return { success: true };
      };

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Tomato',
          plantNumber: 'P-01',
          potNumber: 'POT-1',
          leafSpot: '2'
        },
        existingScans
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();

      // Must proceed and transmit
      expect(Boolean(transmittedData)).toBe(true);
      expect(transmittedData.plantName).toBe('Tomato');
      expect(transmittedData.plantNumber).toBe('P-01');
      expect(transmittedData.potNumber).toBe('POT-1');
      expect(transmittedData.leafSpot).toBe('2');

      // Duplicate warning must NOT appear
      expect(modal.textContent).not.toContain('Duplicate Detected');
      // Ready guidance banner MUST appear
      expect(modal.textContent).toContain('Spectroscope is ready! You can scan now.');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });

    it('Test 3: Submitting { Tomato, P-02, POT-1, leafSpot: 1 } (different plant) MUST NOT detect duplicate', async () => {
      let transmittedData = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (data) => {
        transmittedData = data;
        return { success: true };
      };

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Tomato',
          plantNumber: 'P-02',
          potNumber: 'POT-1',
          leafSpot: '1'
        },
        existingScans
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();

      expect(Boolean(transmittedData)).toBe(true);
      expect(transmittedData.plantNumber).toBe('P-02');
      expect(modal.textContent).not.toContain('Duplicate Detected');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });

    it('findDuplicateScanRecord helper correctly identifies exact matches and ignores differing fields', () => {
      const scans = [
        { plantName: 'Tomato', plantNumber: 'P-01', potNumber: 'POT-1', leafSpot: '1' },
        { plantName: 'Tomato', plantNumber: 'P-01', potNumber: 'POT-1', leafSpot: 'Leaf 2' }
      ];

      // Exact match
      const d1 = findDuplicateScanRecord({ plantName: 'Tomato', plantNumber: 'P-01', potNumber: 'POT-1', leafSpot: '1' }, scans);
      expect(Boolean(d1)).toBe(true);

      // Case insensitive match
      const dCase = findDuplicateScanRecord({ plantName: 'tomato', plantNumber: 'p-01', potNumber: 'pot-1', leafSpot: 'Leaf 1' }, scans);
      expect(Boolean(dCase)).toBe(true);

      // Spot 2 match
      const d2 = findDuplicateScanRecord({ plantName: 'Tomato', plantNumber: 'P-01', potNumber: 'POT-1', leafSpot: '2' }, scans);
      expect(Boolean(d2)).toBe(true);

      // Spot 3 is NOT a duplicate
      const d3 = findDuplicateScanRecord({ plantName: 'Tomato', plantNumber: 'P-01', potNumber: 'POT-1', leafSpot: '3' }, scans);
      expect(d3).toBe(null);

      // Different pot is NOT a duplicate
      const dPot = findDuplicateScanRecord({ plantName: 'Tomato', plantNumber: 'P-01', potNumber: 'POT-2', leafSpot: '1' }, scans);
      expect(dPot).toBe(null);

      // Different crop is NOT a duplicate
      const dCrop = findDuplicateScanRecord({ plantName: 'Potato', plantNumber: 'P-01', potNumber: 'POT-1', leafSpot: '1' }, scans);
      expect(dCrop).toBe(null);
    });

    it('allows adjusting field after duplicate detection to resolve conflict and arm device', async () => {
      let transmitted = false;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async () => {
        transmitted = true;
        return { success: true };
      };

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Tomato',
          plantNumber: 'P-01',
          potNumber: 'POT-1',
          leafSpot: '1'
        },
        existingScans
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();
      expect(modal.textContent).toContain('Duplicate Detected');
      expect(transmitted).toBe(false);

      // User changes leaf spot from 1 to 2
      const leafSpotInput = modal.querySelector('#specimen-leaf-spot');
      leafSpotInput.value = 'Leaf 2';
      leafSpotInput.dispatchEvent({ type: 'input' });

      // Click verify again
      const verifyBtn2 = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn2.click();

      expect(transmitted).toBe(true);
      expect(modal.textContent).not.toContain('Duplicate Detected');
      expect(modal.textContent).toContain('Spectroscope is ready! You can scan now.');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });
  });

  describe('Scenario 4: "Automatically Fill" Behavior', () => {
    it('auto-populates fields, auto-increments leaf spot, and transmits to hardware on load', async () => {
      let transmittedData = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (data) => {
        transmittedData = data;
        return { success: true, metadata: data };
      };

      const existingScans = [
        { plantName: 'Roma Tomato', plantNumber: 'PLANT-042', potNumber: 'POT-01', leafSpot: 'Leaf 1' }
      ];

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'auto',
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01'
        },
        existingScans,
        isDarkDone: false,
        isWhiteDone: false
      });

      await new Promise(r => setTimeout(r, 20));

      // Because setupMode is 'auto', it auto-populates and auto-transmits immediately
      expect(Boolean(transmittedData)).toBe(true);
      expect(transmittedData.plantName).toBe('Roma Tomato');
      expect(transmittedData.plantNumber).toBe('PLANT-042');
      expect(transmittedData.potNumber).toBe('POT-01');
      // Leaf 1 exists in scans, so it auto-increments to Leaf 2!
      expect(transmittedData.leafSpot).toBe('Leaf 2');
      expect(Boolean(transmittedData.timestamp)).toBe(true);

      // Displays "Spectroscope is ready! You can scan now. Press the button below to scan Dark Baseline"
      const text = modal.textContent;
      expect(text).toContain('Spectroscope is ready! You can scan now.');
      expect(text).toContain('Dark Baseline');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });

    it('getNextUnscannedLeafSpot accurately finds the next hole in spot sequence', () => {
      const scans = [
        { plantName: 'Tomato', plantNumber: 'P-1', potNumber: 'POT-1', leafSpot: 'Leaf 1' },
        { plantName: 'Tomato', plantNumber: 'P-1', potNumber: 'POT-1', leafSpot: 'Leaf 2' }
      ];

      expect(getNextUnscannedLeafSpot('Tomato', 'P-1', 'POT-1', scans)).toBe('Leaf 3');

      // Different plant starts at Leaf 1
      expect(getNextUnscannedLeafSpot('Tomato', 'P-2', 'POT-1', scans)).toBe('Leaf 1');

      // With gap: 1 and 3 used
      const scansWithGap = [
        { plantName: 'Tomato', plantNumber: 'P-1', potNumber: 'POT-1', leafSpot: '1' },
        { plantName: 'Tomato', plantNumber: 'P-1', potNumber: 'POT-1', leafSpot: '3' }
      ];
      expect(getNextUnscannedLeafSpot('Tomato', 'P-1', 'POT-1', scansWithGap)).toBe('Leaf 2');
    });

    it('formatCurrentDateTime returns standard formatted human-readable timestamp', () => {
      const testDate = new Date(2026, 10, 21, 17, 45); // Nov 21 2026, 5:45 PM
      const formatted = formatCurrentDateTime(testDate);
      expect(formatted).toContain('21 Nov 2026');
      expect(formatted).toContain('05:45 PM');
    });
  });

  describe('Scenario 5: "Manually Fill" Behavior & Spectroscope Arming', () => {
    it('arms device and displays "Spectroscope is ready! You can scan now. Press the button below to scan [Scan Target]"', async () => {
      let transmitted = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (batch) => {
        transmitted = batch;
        return { success: true };
      };

      // Case: Dark is already done, White is remaining
      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Wheat',
          plantNumber: 'WHEAT-09',
          potNumber: 'POT-99',
          leafSpot: 'Leaf 1'
        },
        isDarkDone: true,
        isWhiteDone: false,
        existingScans: []
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();

      expect(Boolean(transmitted)).toBe(true);
      const text = modal.textContent;
      expect(text).toContain('Spectroscope is ready! You can scan now.');
      expect(text).toContain('White Reference');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });

    it('displays Leaf Scan as next target when both Dark and White calibrations are completed', async () => {
      let transmitted = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (batch) => {
        transmitted = batch;
        return { success: true };
      };

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Potato',
          plantNumber: 'POTATO-01',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1'
        },
        isDarkDone: true,
        isWhiteDone: true,
        existingScans: []
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      await verifyBtn.click();

      expect(Boolean(transmitted)).toBe(true);
      const text = modal.textContent;
      expect(text).toContain('Spectroscope is ready! You can scan now.');
      expect(text).toContain('Leaf Scan');

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConn;
    });
  });

  describe('Scenario 6: Prompt Elimination & Direct Scan Execution', () => {
    it('triggers Dark calibration directly on Step 3 button click without interactive Y/N prompts', async () => {
      let runCalibrationCalled = null;
      const origRun = leafClipDevice.runCalibrationStep.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.runCalibrationStep = async (step) => {
        runCalibrationCalled = step;
        return { success: true, phase: step };
      };

      const view = createSpectroscopyAnalysisView({
        plot: { id: 'plot-1', crop: 'Tomato', pot: 'POT-1', name: 'Zone 1' }
      });

      const darkBtn = view.querySelector('#btn-step-dark-calib');
      expect(Boolean(darkBtn)).toBe(true);
      await darkBtn.click();

      // Directly calls runCalibrationStep without opening any prompt modal
      expect(runCalibrationCalled).toBe('DARK_CURRENT');

      leafClipDevice.runCalibrationStep = origRun;
      leafClipDevice.isConnected = origIsConn;
    });

    it('triggers White Reference calibration directly on Step 4 button click without interactive Y/N prompts', async () => {
      let runCalibrationCalled = null;
      const origRun = leafClipDevice.runCalibrationStep.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      const origDarkDone = leafClipDevice.calibration.darkCurrentCompleted;
      leafClipDevice.isConnected = true;
      leafClipDevice.calibration.darkCurrentCompleted = true;
      leafClipDevice.runCalibrationStep = async (step) => {
        runCalibrationCalled = step;
        return { success: true, phase: step };
      };

      const view = createSpectroscopyAnalysisView({
        plot: { id: 'plot-1', crop: 'Tomato', pot: 'POT-1', name: 'Zone 1' }
      });

      const whiteBtn = view.querySelector('#btn-step-white-calib');
      expect(Boolean(whiteBtn)).toBe(true);
      await whiteBtn.click();

      expect(runCalibrationCalled).toBe('WHITE_REFERENCE');

      leafClipDevice.runCalibrationStep = origRun;
      leafClipDevice.isConnected = origIsConn;
      leafClipDevice.calibration.darkCurrentCompleted = origDarkDone;
    });

    it('triggers Leaf Scan directly on Step 5 button click without interactive Y/N prompts', async () => {
      let leafScanTriggered = false;
      const origTrigger = leafClipDevice.triggerLeafMeasurement.bind(leafClipDevice);
      const origIsConn = leafClipDevice.isConnected;
      const origDarkDone = leafClipDevice.calibration.darkCurrentCompleted;
      const origWhiteDone = leafClipDevice.calibration.whiteDiscCompleted;
      leafClipDevice.isConnected = true;
      leafClipDevice.calibration.darkCurrentCompleted = true;
      leafClipDevice.calibration.whiteDiscCompleted = true;

      leafClipDevice.triggerLeafMeasurement = async () => {
        leafScanTriggered = true;
        return {
          id: 'test_scan_direct',
          timestamp: new Date().toISOString(),
          spectrum: new Array(76).fill(0.4),
          rawCounts: new Array(76).fill(25000),
          chemometrics: { ndvi: 0.65, vitalityScore: 85 }
        };
      };

      const view = createSpectroscopyAnalysisView({
        plot: { id: 'plot-1', crop: 'Tomato', pot: 'POT-1', name: 'Zone 1' }
      });

      const leafBtn = view.querySelector('#btn-step-leaf-scan');
      expect(Boolean(leafBtn)).toBe(true);
      await leafBtn.click();

      expect(leafScanTriggered).toBe(true);

      leafClipDevice.triggerLeafMeasurement = origTrigger;
      leafClipDevice.isConnected = origIsConn;
      leafClipDevice.calibration.darkCurrentCompleted = origDarkDone;
      leafClipDevice.calibration.whiteDiscCompleted = origWhiteDone;
    });

    it('verifies leafClipDevice and spectrometerUSBAdapter expose calibrateDark, calibrateWhite, and acquireLeafScan directly', async () => {
      expect(typeof leafClipDevice.calibrateDark).toBe('function');
      expect(typeof leafClipDevice.calibrateWhite).toBe('function');
      expect(typeof leafClipDevice.acquireLeafScan).toBe('function');
      expect(typeof leafClipDevice.setSpecimenBatchData).toBe('function');

      expect(typeof spectrometerUSBAdapter.calibrateDarkCurrent).toBe('function');
      expect(typeof spectrometerUSBAdapter.calibrateWhiteReference).toBe('function');
      expect(typeof spectrometerUSBAdapter.acquireLeafScan).toBe('function');
      expect(typeof spectrometerUSBAdapter.setSpecimenBatchData).toBe('function');
    });
  });
}
