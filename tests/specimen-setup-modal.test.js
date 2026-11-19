/**
 * Spectroscope Specimen Setup Pop-Up Window & Hardware Raw Stream Test Suite
 * Tests full modal layout, batch metadata transmission, prompt detection,
 * terminal interactive input, and guided calibration transitions.
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

    it('mounts full pop-up modal with required ID, title, and all 4 field inputs', () => {
      const modal = createSpecimenSetupModal({
        initialData: {
          plantName: 'Cotton',
          plantNumber: 'PLANT-101',
          potNumber: 'POT-04',
          cropVariety: 'BT-2 Cotton',
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
      expect(text).toContain('Plant Name');
      expect(text).toContain('Plant Number');
      expect(text).toContain('Pot / Row Number');
      expect(text).toContain('Crop Variety & Field Zone');

      // Verify input elements exist with proper layout sizes
      const plantNameIn = modal.querySelector('#specimen-plant-name');
      const plantNumIn = modal.querySelector('#specimen-plant-number');
      const potNumIn = modal.querySelector('#specimen-pot-number');
      const zoneSel = modal.querySelector('#specimen-zone-select');
      const varietyIn = modal.querySelector('#specimen-crop-variety');

      expect(Boolean(plantNameIn)).toBe(true);
      expect(Boolean(plantNumIn)).toBe(true);
      expect(Boolean(potNumIn)).toBe(true);
      expect(Boolean(zoneSel)).toBe(true);
      expect(Boolean(varietyIn)).toBe(true);

      expect(plantNameIn.value).toBe('Cotton');
      expect(plantNumIn.value).toBe('PLANT-101');
      expect(potNumIn.value).toBe('POT-04');
    });

    it('fills inputs when quick preset chips and autogen buttons are clicked', () => {
      const modal = createSpecimenSetupModal();

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
    });

    it('validates required fields and displays validation message on empty submission', () => {
      const modal = createSpecimenSetupModal();
      const plantNameIn = modal.querySelector('#specimen-plant-name');
      plantNameIn.value = '';

      const transmitBtn = modal.querySelector('#specimen-transmit-btn');
      transmitBtn.click();

      expect(modal.textContent).toContain('Plant name is required');
    });

    it('transmits all specimen data at once when Save & Transmit is clicked', async () => {
      let transmittedPayload = null;
      const origTransmit = leafClipDevice.transmitSpecimenBatch.bind(leafClipDevice);
      leafClipDevice.transmitSpecimenBatch = async (data) => {
        transmittedPayload = data;
        return { success: true, metadata: data };
      };

      let savedCallbackData = null;
      const modal = createSpecimenSetupModal({
        initialData: {
          plantName: 'Roma Tomato',
          plantNumber: 'PLANT-042',
          potNumber: 'POT-01',
          cropVariety: 'Roma Tomato',
          zone: 'Zone 2'
        },
        onSaveAndTransmit: (data) => {
          savedCallbackData = data;
        }
      });

      const transmitBtn = modal.querySelector('#specimen-transmit-btn');
      await transmitBtn.click();

      expect(Boolean(transmittedPayload)).toBe(true);
      expect(transmittedPayload.plantName).toBe('Roma Tomato');
      expect(transmittedPayload.plantNumber).toBe('PLANT-042');
      expect(transmittedPayload.potNumber).toBe('POT-01');
      expect(Boolean(savedCallbackData)).toBe(true);

      leafClipDevice.transmitSpecimenBatch = origTransmit;
    });

    it('displays hardware prompt alert banner when prompt is provided', () => {
      const modal = createSpecimenSetupModal({
        hardwarePrompt: 'Enter Plant Name:'
      });

      expect(modal.textContent).toContain('Sensor Prompt Detected:');
      expect(modal.textContent).toContain('Enter Plant Name:');
    });

    it('navigates to guided calibration when Start Guided Calibration is clicked', async () => {
      let calibStarted = false;
      let startPayload = null;
      const modal = createSpecimenSetupModal({
        initialData: {
          plantName: 'Cotton',
          plantNumber: 'PLANT-101',
          potNumber: 'POT-01',
          cropVariety: 'Cotton',
          zone: 'Zone 1'
        },
        onStartCalibration: (data) => {
          calibStarted = true;
          startPayload = data;
        }
      });

      const calibBtn = modal.querySelector('#specimen-calibrate-btn');
      await calibBtn.click();

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
}
