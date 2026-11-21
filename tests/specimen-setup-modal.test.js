/**
 * Spectroscope Specimen Setup Pop-Up Window & Hardware Raw Stream Test Suite
 * Tests full modal layout, batch metadata transmission, prompt detection,
 * terminal interactive input, mode toggles, and guided scan transitions.
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';

setupHeadlessDOM();

import { createSpecimenSetupModal } from '../src/components/SpecimenSetupModal.js';
import { createSpectroscopyAnalysisView } from '../src/components/dashboards/SpectroscopyAnalysisView.js';
import { leafClipDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { setLocale } from '../src/utils/i18n.js';

export function registerSpecimenSetupModalTests() {
  describe('Spectroscope Specimen & Field Setup Pop-up Modal', () => {
    setLocale('en');

    it('mounts full pop-up modal with required ID, title, and all unified field inputs', () => {
      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Cotton',
          plantNumber: 'PLANT-101',
          potNumber: 'POT-04',
          leafSpot: 'Leaf 1',
          zone: 'Zone 1'
        }
      });

      expect(Boolean(modal)).toBe(true);
      expect(modal.id).toBe('specimen-data-modal');

      const dialog = modal.querySelector('#specimen-entry-dialog');
      expect(Boolean(dialog)).toBe(true);

      const text = modal.textContent;
      expect(text).toContain('Spectroscope Specimen & Field Setup');
      expect(text).toContain('Enter plant data all at once to transmit to the spectroscope sensor');
      expect(text).toContain('Plant / Crop Name');
      expect(text).toContain('Plant Tag ID');
      expect(text).toContain('Pot / Row Number');
      expect(text).toContain('Leaf / Spot ID');
      expect(text).toContain('Field Zone');
      expect(text).toContain('Date & Time Stamp');

      // Verify mode toggles
      const autoBtn = modal.querySelector('#modal-mode-auto-btn');
      const manualBtn = modal.querySelector('#modal-mode-manual-btn');
      expect(Boolean(autoBtn)).toBe(true);
      expect(Boolean(manualBtn)).toBe(true);

      // Verify input elements exist with proper layout values
      const plantNameIn = modal.querySelector('#specimen-plant-name');
      const plantNumIn = modal.querySelector('#specimen-plant-number');
      const potNumIn = modal.querySelector('#specimen-pot-number');
      const leafSpotIn = modal.querySelector('#specimen-leaf-spot');
      const zoneSel = modal.querySelector('#specimen-zone-select');
      const tsIn = modal.querySelector('#specimen-timestamp');

      expect(Boolean(plantNameIn)).toBe(true);
      expect(Boolean(plantNumIn)).toBe(true);
      expect(Boolean(potNumIn)).toBe(true);
      expect(Boolean(leafSpotIn)).toBe(true);
      expect(Boolean(zoneSel)).toBe(true);
      expect(Boolean(tsIn)).toBe(true);

      expect(plantNameIn.value).toBe('Cotton');
      expect(plantNumIn.value).toBe('PLANT-101');
      expect(potNumIn.value).toBe('POT-04');
      expect(leafSpotIn.value).toBe('Leaf 1');
    });

    it('fills inputs when quick preset chips and autogen buttons are clicked', () => {
      const modal = createSpecimenSetupModal({
        initialData: { setupMode: 'manual' }
      });

      // Quick plant name chip for Potato
      const potatoBtn = modal.querySelector('.preset-plant-chip[data-name="Potato"]');
      expect(Boolean(potatoBtn)).toBe(true);
      potatoBtn.click();

      const plantNameIn = modal.querySelector('#specimen-plant-name');
      expect(plantNameIn.value).toBe('Potato');

      // Auto-gen plant number
      const autoGenBtn = modal.querySelector('#btn-autogen-plant-number');
      expect(Boolean(autoGenBtn)).toBe(true);
      autoGenBtn.click();

      const plantNumIn = modal.querySelector('#specimen-plant-number');
      expect(plantNumIn.value).toContain('PLANT-');

      // Preset pot chip
      const potChip = modal.querySelector('.preset-pot-chip[data-pot="POT-02"]');
      expect(Boolean(potChip)).toBe(true);
      potChip.click();

      const potNumIn = modal.querySelector('#specimen-pot-number');
      expect(potNumIn.value).toBe('POT-02');

      // Preset leaf spot chip
      const spotChips = modal.querySelectorAll('.preset-spot-chip');
      const spotChip = Array.from(spotChips).find(c => c.getAttribute('data-spot') === 'Leaf 2');
      expect(Boolean(spotChip)).toBe(true);
      spotChip.click();

      const leafSpotIn = modal.querySelector('#specimen-leaf-spot');
      expect(leafSpotIn.value).toBe('Leaf 2');
    });

    it('validates required fields and displays validation message on empty submission in manual mode', () => {
      const modal = createSpecimenSetupModal({
        initialData: { setupMode: 'manual' }
      });
      const plantNameIn = modal.querySelector('#specimen-plant-name');
      plantNameIn.value = '';

      const transmitBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      expect(Boolean(transmitBtn)).toBe(true);
      transmitBtn.click();

      expect(modal.textContent).toContain('Plant name is required');
    });

    it('transmits all specimen data at once when Verify & Send is clicked in manual mode', async () => {
      let transmittedPayload = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      const origIsConnected = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.transmitSpecimenBatch = async (data) => {
        transmittedPayload = data;
        return { success: true, metadata: data };
      };

      let savedCallbackData = null;
      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1',
          zone: 'Zone 2'
        },
        existingScans: [],
        onSaveAndTransmit: (data) => {
          savedCallbackData = data;
        }
      });

      const transmitBtn = modal.querySelector('#specimen-verify-transmit-btn') || modal.querySelector('#specimen-transmit-btn');
      expect(Boolean(transmitBtn)).toBe(true);
      await transmitBtn.click();

      expect(Boolean(transmittedPayload)).toBe(true);
      expect(transmittedPayload.plantName).toBe('Roma Tomato');
      expect(transmittedPayload.plantNumber).toBe('PLANT-042');
      expect(transmittedPayload.potNumber).toBe('POT-01');
      expect(transmittedPayload.leafSpot).toBe('Leaf 1');
      expect(Boolean(savedCallbackData)).toBe(true);

      leafClipDevice.transmitSpecimenBatch = origTransmit;
      leafClipDevice.isConnected = origIsConnected;
    });

    it('displays hardware prompt alert banner when prompt is provided', () => {
      const modal = createSpecimenSetupModal({
        initialData: { setupMode: 'manual' },
        hardwarePrompt: 'Enter Plant Name:'
      });

      expect(modal.textContent).toContain('Sensor Prompt Detected:');
      expect(modal.textContent).toContain('Enter Plant Name:');
    });

    it('navigates directly to scan when proceed scan button is clicked', async () => {
      let calibStarted = false;
      let startPayload = null;
      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Cotton',
          plantNumber: 'PLANT-101',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1',
          zone: 'Zone 1'
        },
        existingScans: [],
        onStartCalibration: (data) => {
          calibStarted = true;
          startPayload = data;
        }
      });

      const scanBtn = modal.querySelector('#specimen-proceed-scan-btn') || modal.querySelector('#specimen-calibrate-btn');
      expect(Boolean(scanBtn)).toBe(true);
      await scanBtn.click();

      expect(calibStarted).toBe(true);
      expect(startPayload.plantName).toBe('Cotton');
    });
  });

  describe('SpectroscopyAnalysisView - Live Hardware Raw Stream Integration', () => {
    setLocale('en');

    it('renders upgraded raw stream terminal and Enter Data in Popup button', () => {
      const view = createSpectroscopyAnalysisView();
      expect(Boolean(view)).toBe(true);

      const openPopupBtn = view.querySelector('#btn-open-specimen-popup');
      expect(Boolean(openPopupBtn)).toBe(true);
      expect(openPopupBtn.textContent).toContain('Enter Data in Popup');

      const terminalOutput = view.querySelector('#live-ble-raw-output');
      expect(Boolean(terminalOutput)).toBe(true);

      const terminalInput = view.querySelector('#ble-terminal-input');
      const terminalSendBtn = view.querySelector('#btn-ble-terminal-send');
      expect(Boolean(terminalInput)).toBe(true);
      expect(Boolean(terminalSendBtn)).toBe(true);

      const quickY = view.querySelector('.ble-quick-cmd-btn[data-cmd="Y"]');
      const quickN = view.querySelector('.ble-quick-cmd-btn[data-cmd="N"]');
      expect(Boolean(quickY)).toBe(true);
      expect(Boolean(quickN)).toBe(true);
    });

    it('clicking Enter Data in Popup opens specimen setup modal', () => {
      const view = createSpectroscopyAnalysisView();
      document.body.appendChild(view);

      const openPopupBtn = view.querySelector('#btn-open-specimen-popup');
      openPopupBtn.click();

      const modal = document.querySelector('#specimen-data-modal');
      expect(Boolean(modal)).toBe(true);
      expect(modal.textContent).toContain('Spectroscope Specimen & Field Setup');

      if (modal.parentNode) modal.parentNode.removeChild(modal);
      if (view.parentNode) view.parentNode.removeChild(view);
    });

    it('sends interactive terminal command when typing and clicking send', async () => {
      let sentLine = null;
      const origSend = leafClipDevice.sendRawLine.bind(leafClipDevice);
      const origConnected = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.sendRawLine = async (line) => {
        sentLine = line;
        return { success: true };
      };

      const view = createSpectroscopyAnalysisView();
      const input = view.querySelector('#ble-terminal-input');
      const sendBtn = view.querySelector('#btn-ble-terminal-send');

      input.value = 'Y';
      await sendBtn.click();

      expect(sentLine).toBe('Y');

      const rawOutput = view.querySelector('#live-ble-raw-output');
      expect(rawOutput.textContent).toContain('> Y');

      leafClipDevice.sendRawLine = origSend;
      leafClipDevice.isConnected = origConnected;
    });
  });

  describe('Specimen Setup - Duplicate Detection & Sequential Spot Rules', () => {
    it('flags duplicate when all 4 fields (plantName, plantNumber, potNumber, leafSpot) are identical', () => {
      const existingScans = [
        {
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1'
        }
      ];

      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1'
        },
        existingScans
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn');
      expect(Boolean(verifyBtn)).toBe(true);
      verifyBtn.click();

      // High-visibility duplicate alert banner must be displayed
      expect(modal.textContent).toContain('Duplicate Detected');
      expect(modal.textContent).toContain('This exact scan record already exists for Plant Roma Tomato');
      expect(modal.textContent).toContain('Tag #PLANT-042');
      expect(modal.textContent).toContain('Pot #POT-01');
      expect(modal.textContent).toContain('Leaf #Leaf 1');
      expect(modal.textContent).toContain('Please change the leaf spot number or plant tag');
    });

    it('does NOT flag duplicate when leaf spot is different on the same plant and pot', () => {
      const existingScans = [
        {
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1'
        }
      ];

      let transmitted = false;
      const modal = createSpecimenSetupModal({
        initialData: {
          setupMode: 'manual',
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 2' // Different leaf spot!
        },
        existingScans,
        onSaveAndTransmit: () => {
          transmitted = true;
        }
      });

      const verifyBtn = modal.querySelector('#specimen-verify-transmit-btn');
      expect(Boolean(verifyBtn)).toBe(true);
      verifyBtn.click();

      // Must NOT contain duplicate warning
      expect(modal.textContent).not.toContain('Duplicate Detected');
      expect(transmitted).toBe(true);
      expect(modal.textContent).toContain('Spectroscope is Ready');
    });

    it('in Automatically Fill mode, auto-increments to the next unscanned leaf spot and displays ready banner', () => {
      const existingScans = [
        {
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1'
        }
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

      const leafSpotIn = modal.querySelector('#specimen-leaf-spot');
      expect(leafSpotIn.value).toBe('Leaf 2'); // Auto-incremented!

      // Prominent green guidance banner with dynamic remaining scan target
      expect(modal.textContent).toContain('Spectroscope is Ready');
      expect(modal.textContent).toContain('✓ Spectroscope is ready! You can scan now. Press the button below to scan Dark Baseline');
    });
  });

  describe('SpectroscopyAnalysisView - Two Modes & Dynamic Scan Guidance', () => {
    it('renders Two Modes tabs in dashboard Step 2 with all 6 required fields', () => {
      const view = createSpectroscopyAnalysisView();
      expect(Boolean(view)).toBe(true);

      const autoTab = view.querySelector('#specimen-mode-auto-tab');
      const manualTab = view.querySelector('#specimen-mode-manual-tab');
      expect(Boolean(autoTab)).toBe(true);
      expect(Boolean(manualTab)).toBe(true);

      const plantNameIn = view.querySelector('#specimen-plant-name');
      const plantNumIn = view.querySelector('#specimen-plant-number');
      const potNumIn = view.querySelector('#specimen-pot-number');
      const leafSpotIn = view.querySelector('#specimen-leaf-spot');
      const timestampIn = view.querySelector('#specimen-timestamp');
      const zoneChips = view.querySelectorAll('.specimen-zone-chip');

      expect(Boolean(plantNameIn)).toBe(true);
      expect(Boolean(plantNumIn)).toBe(true);
      expect(Boolean(potNumIn)).toBe(true);
      expect(Boolean(leafSpotIn)).toBe(true);
      expect(Boolean(timestampIn)).toBe(true);
      expect(zoneChips.length).toBeGreaterThan(0);
    });

    it('highlights Step 3 as NEXT ACTION when Dark Baseline is not done', () => {
      leafClipDevice.calibration.darkCurrentCompleted = false;
      leafClipDevice.calibration.whiteDiscCompleted = false;

      const view = createSpectroscopyAnalysisView();
      const text = view.textContent;

      expect(text).toContain('Step 3: Dark Baseline Calibration (0% Null)');
      expect(text).toContain('NEXT ACTION');

      const darkBtn = view.querySelector('#btn-step-dark-calib');
      expect(Boolean(darkBtn)).toBe(true);
      expect(darkBtn.textContent).toContain('Scan Dark Baseline');
    });

    it('highlights Step 4 as NEXT ACTION when Dark is done but White is not done', async () => {
      const origRunCalib = leafClipDevice.runCalibrationStep;
      const origConnected = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;
      leafClipDevice.runCalibrationStep = async (step) => {
        leafClipDevice.calibration.darkCurrentCompleted = true;
        leafClipDevice.calibration.darkCurrentValue = 0.021;
        return { success: true };
      };

      const view = createSpectroscopyAnalysisView();
      const darkBtn = view.querySelector('#btn-step-dark-calib');
      await darkBtn.click();

      const text = view.textContent;
      expect(text).toContain('0% Dark Baseline Verified');
      expect(text).toContain('Step 4: White Reference Standard (100% Normalization)');
      expect(text).toContain('NEXT ACTION');

      leafClipDevice.isConnected = origConnected;
      leafClipDevice.runCalibrationStep = origRunCalib;
    });

    it('directly triggers dark baseline calibration without interactive prompt questions', async () => {
      let calibStepCalled = null;
      const origRunCalib = leafClipDevice.runCalibrationStep.bind(leafClipDevice);
      const origConnected = leafClipDevice.isConnected;
      leafClipDevice.isConnected = true;

      leafClipDevice.runCalibrationStep = async (step) => {
        calibStepCalled = step;
        leafClipDevice.calibration.darkCurrentCompleted = true;
        leafClipDevice.calibration.darkCurrentValue = 0.021;
        return { success: true };
      };

      const view = createSpectroscopyAnalysisView();
      const darkBtn = view.querySelector('#btn-step-dark-calib');
      await darkBtn.click();

      expect(calibStepCalled).toBe('DARK_CURRENT');
      expect(view.textContent).toContain('0% Dark Baseline Verified');

      leafClipDevice.runCalibrationStep = origRunCalib;
      leafClipDevice.isConnected = origConnected;
    });
  });
}
