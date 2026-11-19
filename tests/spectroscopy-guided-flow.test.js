/**
 * Master QA & Chaos Engineering Test Suite: Spectroscopy Guided Flow
 * 
 * Verifies:
 * 1. Guided Optical Calibration Sequence:
 *    - Dark current measurement (~0.02 baseline stored)
 *    - White reference measurement (99% PTFE standard ~0.985 stored)
 *    - Strict calibration requirement enforcement: scanning is blocked until both dark and white baselines pass.
 * 2. Specimen Metadata Entry & Validation:
 *    - Validates Plant Number, Port Number, Plant Name / Variety, and Field Zone.
 *    - Actionable error feedback on missing/invalid plant identifiers.
 *    - Strong defense against XSS script injection and string buffer overflow.
 * 3. Chemometric Calculation & Interlock:
 *    - High-fidelity NDVI, NDRE, WBI / LWI, and Vitality index generation.
 *    - Persistent storage verification across Cloud Firestore & offline multi-tenant chamber.
 * 4. Chaos & Resilience:
 *    - Sudden BLE disconnect during calibration with graceful UI/device recovery and retry.
 *    - Multi-part BLE MTU chunking and packet reassembly across fragmented transport frames.
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { leafClipDevice, LeafClipBluetoothDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { spectrometerUSBAdapter } from '../src/hardware/spectrometerUSBAdapter.js';
import { PacketChunkAccumulator, PACKET_TYPES, BINARY_MAGIC, BINARY_TAIL } from '../src/hardware/packetChunkAccumulator.js';
import { WAVELENGTHS, generateSpectralSignature, processSpectralVector } from '../src/hardware/chemometricsEngine.js';
import { createCalibrationModal } from '../src/components/CalibrationWizard.js';
import { firestoreService } from '../src/firebase/firestoreService.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';
import { sanitizeText } from '../src/utils/sanitizer.js';
import { setLocale } from '../src/utils/i18n.js';

export function registerSpectroscopyGuidedFlowTests() {
  setupHeadlessDOM();
  setLocale('en');

  describe('Spectroscopy Guided Flow - Guided Calibration Sequence', () => {
    it('executes dark calibration measurement and verifies dark current ~0.02 is stored', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      // Reset calibration state
      leafClipDevice.calibration.darkCurrentCompleted = false;
      leafClipDevice.calibration.whiteDiscCompleted = false;
      leafClipDevice.calibration.isCalibrated = false;

      let progressFired = false;
      leafClipDevice.on('calibrationProgress', (data) => {
        if (data.phase === 'DARK_CURRENT') progressFired = true;
      });

      const result = await leafClipDevice.triggerDarkCalibration();
      expect(result.success).toBe(true);
      expect(result.phase).toBe('DARK_CURRENT');
      expect(leafClipDevice.calibration.darkCurrentCompleted).toBe(true);

      // Verify dark current value is approximately 0.02 (0.015 - 0.025)
      expect(result.darkCurrentValue).toBeGreaterThanOrEqual(0.015);
      expect(result.darkCurrentValue).toBeLessThanOrEqual(0.025);
      expect(leafClipDevice.calibration.darkCurrentValue).toBe(result.darkCurrentValue);
      expect(Boolean(leafClipDevice.calibration.darkCurrentTimestamp)).toBe(true);

      // Calibration is not fully complete until white reference is also completed
      expect(leafClipDevice.calibration.isCalibrated).toBe(false);

      // Also verify spectrometer USB adapter dark current calibration baseline
      const usbDark = await spectrometerUSBAdapter.calibrateDarkCurrent();
      expect(usbDark.success).toBe(true);
      // 1350 ADC counts / 65535 is ~0.0206
      const usbDarkNormalized = usbDark.averageDarkCounts / 65535;
      expect(usbDarkNormalized).toBeGreaterThanOrEqual(0.015);
      expect(usbDarkNormalized).toBeLessThanOrEqual(0.025);
    });

    it('executes 99% PTFE white reference measurement and verifies baseline ~0.985 is stored', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      let progressFired = false;
      leafClipDevice.on('calibrationProgress', (data) => {
        if (data.phase === 'WHITE_REFERENCE') progressFired = true;
      });

      const result = await leafClipDevice.triggerWhiteReference();
      expect(result.success).toBe(true);
      expect(result.phase).toBe('WHITE_REFERENCE');
      expect(leafClipDevice.calibration.whiteDiscCompleted).toBe(true);

      // Verify white PTFE disc reference is approximately 0.985 - 0.995 (99% pure Spectralon)
      expect(result.whiteDiscValue).toBeGreaterThanOrEqual(0.980);
      expect(result.whiteDiscValue).toBeLessThanOrEqual(0.999);
      expect(leafClipDevice.calibration.whiteDiscValue).toBe(result.whiteDiscValue);
      expect(Boolean(leafClipDevice.calibration.whiteDiscTimestamp)).toBe(true);

      // Both dark and white baselines are completed -> isCalibrated is locked
      expect(leafClipDevice.calibration.isCalibrated).toBe(true);
      expect(result.isCalibrated).toBe(true);

      // Verify spectrometer USB adapter white reference calibration baseline
      const usbWhite = await spectrometerUSBAdapter.calibrateWhiteReference();
      expect(usbWhite.success).toBe(true);
      expect(usbWhite.isCalibrated).toBe(true);
    });

    it('enforces calibration requirement: scanning is blocked until both dark and white baselines pass', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      // Scenario A: Neither calibration baseline performed
      leafClipDevice.calibration.darkCurrentCompleted = false;
      leafClipDevice.calibration.whiteDiscCompleted = false;
      leafClipDevice.calibration.isCalibrated = false;

      let threwA = false;
      try {
        await leafClipDevice.triggerLeafMeasurement({ requireCalibration: true });
      } catch (err) {
        threwA = true;
        expect(err.message.includes('Optical calibration incomplete')).toBe(true);
      }
      expect(threwA).toBe(true);

      // Scenario B: Only dark calibration completed, white reference missing
      leafClipDevice.calibration.darkCurrentCompleted = true;
      leafClipDevice.calibration.whiteDiscCompleted = false;
      leafClipDevice.calibration.isCalibrated = false;

      let threwB = false;
      try {
        await leafClipDevice.triggerLeafMeasurement({ requireCalibration: true });
      } catch (err) {
        threwB = true;
        expect(err.message.includes('Optical calibration incomplete')).toBe(true);
      }
      expect(threwB).toBe(true);

      // Scenario C: Only white calibration completed, dark baseline missing
      leafClipDevice.calibration.darkCurrentCompleted = false;
      leafClipDevice.calibration.whiteDiscCompleted = true;
      leafClipDevice.calibration.isCalibrated = false;

      let threwC = false;
      try {
        await leafClipDevice.triggerLeafMeasurement({ requireCalibration: true });
      } catch (err) {
        threwC = true;
        expect(err.message.includes('Optical calibration incomplete')).toBe(true);
      }
      expect(threwC).toBe(true);

      // Scenario D: Both baselines completed -> scan succeeds without blocking
      leafClipDevice.calibration.darkCurrentCompleted = true;
      leafClipDevice.calibration.whiteDiscCompleted = true;
      leafClipDevice.calibration.isCalibrated = true;

      const scanResult = await leafClipDevice.triggerLeafMeasurement({ requireCalibration: true });
      expect(Boolean(scanResult)).toBe(true);
      expect(scanResult.vitalityScore).toBeGreaterThanOrEqual(5);
    });

    it('enforces calibration requirement on USB spectrometer adapter', async () => {
      // Clear USB calibration
      spectrometerUSBAdapter.calibration.darkCurrent = null;
      spectrometerUSBAdapter.calibration.whiteReference = null;
      spectrometerUSBAdapter.calibration.isCalibrated = false;

      let threw = false;
      try {
        spectrometerUSBAdapter.computeReflectance(new Float64Array(76).fill(25000));
      } catch (err) {
        threw = true;
        expect(err.message.includes('Spectrometer is not calibrated')).toBe(true);
      }
      expect(threw).toBe(true);

      // Restore baseline calibration so background timers stay safe
      await spectrometerUSBAdapter.calibrateDarkCurrent();
      await spectrometerUSBAdapter.calibrateWhiteReference();
    });
  });

  describe('Spectroscopy Guided Flow - Specimen Metadata Entry & Validation', () => {
    it('validates input of Plant Number, Port Number, Plant Name, and Zone in UI wizard', () => {
      const modal = createCalibrationModal({
        initialStep: 'METADATA',
        plot: { crop: 'Drip Tomatoes', name: 'Zone 2' }
      });

      const plantInput = modal.querySelector('#calib-input-plant');
      const portInput = modal.querySelector('#calib-input-port');
      const cropInput = modal.querySelector('#calib-input-crop');
      const zoneButtons = modal.querySelectorAll('.calib-zone-btn');
      const zoneBtn3 = zoneButtons.find(b => b.getAttribute('data-zone') === 'Zone 3') || zoneButtons[2];
      const nextBtn = modal.querySelector('#calib-to-placement-btn');

      expect(Boolean(plantInput)).toBe(true);
      expect(Boolean(portInput)).toBe(true);
      expect(Boolean(cropInput)).toBe(true);
      expect(Boolean(zoneBtn3)).toBe(true);
      expect(Boolean(nextBtn)).toBe(true);

      // Enter valid specimen metadata
      plantInput.value = 'PLANT-088';
      plantInput.dispatchEvent({ type: 'input', target: plantInput });

      portInput.value = 'PORT-14';
      portInput.dispatchEvent({ type: 'input', target: portInput });

      cropInput.value = 'San Marzano Tomato';
      cropInput.dispatchEvent({ type: 'input', target: cropInput });

      zoneBtn3.click();

      // Proceed to Step 4
      nextBtn.click();

      // Should have successfully navigated to Step 4: Leaf Placement Prompt
      const step4Badge = modal.querySelector('#calib-step4-badge') || modal.textContent;
      expect(step4Badge.includes('Place on the plant leaf') || step4Badge.includes('Step 4')).toBe(true);
    });

    it('rejects empty or invalid plant numbers with actionable validation messages', () => {
      const modal = createCalibrationModal({
        initialStep: 'METADATA'
      });

      const plantInput = modal.querySelector('#calib-input-plant');
      const nextBtn = modal.querySelector('#calib-to-placement-btn');

      // Test empty plant number
      plantInput.value = '';
      plantInput.dispatchEvent({ type: 'input', target: plantInput });
      nextBtn.click();

      // Modal must remain on Step 3 and display validation error
      let content = modal.innerHTML;
      expect(content.includes('Plant number is required') || content.includes('min 2 chars')).toBe(true);

      // Test single character (below 2 character threshold)
      plantInput.value = 'X';
      plantInput.dispatchEvent({ type: 'input', target: plantInput });
      nextBtn.click();

      content = modal.innerHTML;
      expect(content.includes('Plant number is required') || content.includes('min 2 chars')).toBe(true);

      // Enter valid plant number
      plantInput.value = 'PL-404';
      plantInput.dispatchEvent({ type: 'input', target: plantInput });
      nextBtn.click();

      // Validation error for plant number is cleared
      const errEl = modal.querySelector('#calib-input-plant')?.parentElement?.querySelector('.text-rose-400');
      expect(Boolean(errEl)).toBe(false);
    });

    it('defends against input XSS injection and string overflow in plant names', async () => {
      const modal = createCalibrationModal({
        initialStep: 'METADATA'
      });

      const cropInput = modal.querySelector('#calib-input-crop');
      const plantInput = modal.querySelector('#calib-input-plant');

      // 1. Script tag injection attack vector
      const xssPayload = '<script>alert("XSS")</script>Sweet Corn<img src=x onerror="steal()">';
      cropInput.value = xssPayload;
      cropInput.dispatchEvent({ type: 'input', target: cropInput });

      // 2. Buffer overflow vector (1000 characters)
      const overflowPlantNumber = 'PLANT-' + 'A'.repeat(500);
      plantInput.value = overflowPlantNumber;
      plantInput.dispatchEvent({ type: 'input', target: plantInput });

      const nextBtn = modal.querySelector('#calib-to-placement-btn');
      nextBtn.click();

      // Verify XSS scripts were neutralized and purged
      expect(modal.innerHTML.includes('<script>')).toBe(false);
      expect(modal.innerHTML.includes('onerror=')).toBe(false);

      // Verify device manager / metadata adapter also strips XSS and clamps overflow
      await leafClipDevice.setSpecimenMetadata({
        cropName: '<script>alert("pwn")</script>Bell Peppers',
        specimenId: '<svg/onload=alert(1)>SPEC-999',
        notes: 'X'.repeat(400)
      });

      const meta = leafClipDevice.specimenMetadata;
      expect(meta.cropName.includes('<script>')).toBe(false);
      expect(meta.cropName).toBe('Bell Peppers');
      expect(meta.specimenId.includes('onload')).toBe(false);
      expect(meta.notes.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Spectroscopy Guided Flow - Chemometric Calculation & Interlock', () => {
    it('generates accurate NDVI, NDRE, WBI, and vitality index from spectral reflectance', () => {
      // Create calibrated 76-band healthy vegetative spectrum
      const spectrum = generateSpectralSignature({
        vitality: 90,
        waterContent: 0.92,
        nitrogenLevel: 0.88,
        diseaseStress: 0.05,
        noiseLevel: 0
      });

      expect(spectrum.length).toBe(76);

      const analysis = processSpectralVector(spectrum, 'Bell Peppers', 'Fruit Formation');
      expect(Boolean(analysis.indices)).toBe(true);

      const { ndvi, ndre, wbi, leafWaterIndex, cire } = analysis.indices;

      // NDVI should reflect dense green canopy (typically 0.60 - 1.0)
      expect(ndvi).toBeGreaterThanOrEqual(0.60);
      expect(ndvi).toBeLessThanOrEqual(1.0);

      // NDRE should reflect active red-edge chlorophyll absorption
      expect(ndre).toBeGreaterThanOrEqual(0.28);
      expect(ndre).toBeLessThanOrEqual(0.65);

      // WBI should reflect high hydration
      expect(wbi).toBeGreaterThanOrEqual(0.90);
      expect(leafWaterIndex).toBeGreaterThanOrEqual(0.85);

      // Vitality index should be high (80-100)
      expect(analysis.vitalityScore).toBeGreaterThanOrEqual(80);
      expect(analysis.vitalityScore).toBeLessThanOrEqual(100);

      // Nitrogen prescription should be optimal (0 kg/acre urea)
      expect(analysis.nitrogenPrescriptionKg).toBe(0);

      // Urgent irrigation countdown should be relaxed for saturated canopy
      expect(['ADEQUATE', 'SATURATED'].includes(analysis.irrigationUrgency)).toBe(true);
    });

    it('verifies storage persistence in Firestore and retrievability with full metadata', async () => {
      const testScanData = {
        plotId: 'plot-1',
        crop: 'Roma Tomato',
        plantNumber: 'PLANT-77',
        portNumber: 'PORT-03',
        zone: 'Zone 1',
        vitalityScore: 89,
        indices: {
          ndvi: 0.79,
          ndre: 0.38,
          leafWaterIndex: 0.92
        },
        nitrogenPrescriptionKg: 0,
        diseaseRisk: null,
        harvest: { recommendedDays: 14, stage: 'Ripening' },
        gpsLocation: { latitude: 31.1471, longitude: 75.3412 },
        rawSpectrumPreview: [0.04, 0.05, 0.12, 0.03, 0.45, 0.58]
      };

      // Save directly to Firestore / mock multi-tenant chamber
      const scanId = await firestoreService.saveLeafScan(testScanData, 'farm-1');
      expect(Boolean(scanId)).toBe(true);

      // Retrieve snapshot from persistent chamber
      const savedScans = mockFirestore.getChannelSnapshot('leafScans', 'farm-1');
      expect(Array.isArray(savedScans)).toBe(true);

      const retrieved = savedScans.find(s => s.id === scanId || s.plantNumber === 'PLANT-77');
      expect(Boolean(retrieved)).toBe(true);
      expect(retrieved.crop).toBe('Roma Tomato');
      expect(retrieved.vitalityScore).toBe(89);
      expect(retrieved.leafWaterIndex).toBe(0.92);
      expect(retrieved.gpsLocation.latitude).toBe(31.1471);
      expect(retrieved.gpsLocation.longitude).toBe(75.3412);
      expect(retrieved.plotId).toBe('plot-1');
    });
  });

  describe('Spectroscopy Guided Flow - Chaos & Resilience', () => {
    it('simulates sudden BLE disconnect during dark or white calibration and verifies graceful recovery', async () => {
      const chaosDevice = new LeafClipBluetoothDevice();
      await chaosDevice.connect({ forceSimulation: true });
      expect(chaosDevice.isConnected).toBe(true);

      // 1. Sudden disconnect during Dark Current Calibration
      const darkPromise = chaosDevice.triggerDarkCalibration();
      // Drop connection immediately during measurement sweep
      chaosDevice.disconnect();
      expect(chaosDevice.isConnected).toBe(false);

      let darkFailed = false;
      try {
        await darkPromise;
      } catch (err) {
        darkFailed = true;
        expect(err.message.includes('disconnected') || err.message.includes('lost')).toBe(true);
      }
      expect(darkFailed).toBe(true);

      // Verify graceful device recovery: can reconnect cleanly
      const reconnectResult = await chaosDevice.connect({ forceSimulation: true });
      expect(reconnectResult.success).toBe(true);
      expect(chaosDevice.isConnected).toBe(true);

      // Retry dark calibration after reconnection -> completes successfully!
      const retryDark = await chaosDevice.triggerDarkCalibration();
      expect(retryDark.success).toBe(true);
      expect(chaosDevice.calibration.darkCurrentCompleted).toBe(true);

      // 2. Sudden disconnect during White Reference Calibration
      const whitePromise = chaosDevice.triggerWhiteReference();
      chaosDevice.disconnect();
      expect(chaosDevice.isConnected).toBe(false);

      let whiteFailed = false;
      try {
        await whitePromise;
      } catch (err) {
        whiteFailed = true;
        expect(err.message.includes('disconnected') || err.message.includes('lost')).toBe(true);
      }
      expect(whiteFailed).toBe(true);

      // Reconnect and retry white reference calibration
      await chaosDevice.connect({ forceSimulation: true });
      const retryWhite = await chaosDevice.triggerWhiteReference();
      expect(retryWhite.success).toBe(true);
      expect(chaosDevice.calibration.whiteDiscCompleted).toBe(true);
      expect(chaosDevice.calibration.isCalibrated).toBe(true);
    });

    it('reassembles multi-part BLE MTU chunks into full 76-band spectrum without packet loss', async () => {
      const accumulator = new PacketChunkAccumulator({ capacity: 65536 });

      // Generate complete 76-band raw ADC count vector
      const originalRawCounts = Array.from({ length: 76 }, (_, i) => Math.round(15000 + i * 500 + Math.sin(i) * 200));
      expect(originalRawCounts.length).toBe(76);

      const jsonPayload = JSON.stringify({
        type: PACKET_TYPES.SPECTRUM,
        rawCounts: originalRawCounts,
        totalBands: 76,
        timestamp: Date.now()
      }) + '\n';

      // Simulate aggressive MTU fragmentation (20 bytes per chunk, typical of BLE ATT MTU 23)
      const chunkSize = 20;
      const chunks = [];
      for (let i = 0; i < jsonPayload.length; i += chunkSize) {
        chunks.push(jsonPayload.slice(i, i + chunkSize));
      }

      expect(chunks.length).toBeGreaterThan(10); // Verifies realistic multi-chunk fragmentation

      // Start asynchronous packet waiter
      const packetPromise = accumulator.waitForPacket(PACKET_TYPES.SPECTRUM, 3000);

      // Stream chunks sequentially into accumulator with small jitter
      for (const chunk of chunks) {
        accumulator.pushChunk(chunk);
      }

      const receivedPacket = await packetPromise;
      expect(Boolean(receivedPacket)).toBe(true);
      expect(receivedPacket.type).toBe(PACKET_TYPES.SPECTRUM);
      const rawCounts = receivedPacket.data.rawCounts || receivedPacket.data.data?.rawCounts;
      expect(Array.isArray(rawCounts)).toBe(true);
      expect(rawCounts.length).toBe(76);

      // Verify bit-exact fidelity of all 76 bands
      for (let b = 0; b < 76; b++) {
        expect(rawCounts[b]).toBe(originalRawCounts[b]);
      }

      expect(accumulator.stats.packetsReassembled).toBe(1);
    });

    it('reassembles multi-part CSV delimited ASCII spectrum stream ($SPEC) across chunks', async () => {
      const accumulator = new PacketChunkAccumulator();

      const counts = Array.from({ length: 76 }, (_, i) => 20000 + i * 300);
      const csvLine = `$SPEC,76,${counts.join(',')}\r\n`;

      // Slice into 16-byte chunks
      const chunkSize = 16;
      const waiter = accumulator.waitForPacket(PACKET_TYPES.SPECTRUM, 3000);

      for (let i = 0; i < csvLine.length; i += chunkSize) {
        accumulator.pushChunk(csvLine.slice(i, i + chunkSize));
      }

      const packet = await waiter;
      expect(packet.format).toBe('CSV_SPEC');
      expect(packet.data.rawCounts.length).toBe(76);
      expect(packet.data.rawCounts[0]).toBe(counts[0]);
      expect(packet.data.rawCounts[75]).toBe(counts[75]);
    });
  });
}
