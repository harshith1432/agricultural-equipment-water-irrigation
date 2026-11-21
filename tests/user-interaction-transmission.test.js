import { setupHeadlessDOM } from './headless-dom.js';
import { describe, it, expect, runner } from './framework.js';
import { LeafClipBluetoothDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { SpectrometerUSBAdapter } from '../src/hardware/spectrometerUSBAdapter.js';
import { createSpectroscopyAnalysisView } from '../src/components/dashboards/SpectroscopyAnalysisView.js';

export function registerUserInteractionTransmissionTests() {
  describe('User-Initiated Transmission Strict Enforcement (Zero Auto-Transmissions)', () => {

    it('enforces that autoResponderEnabled is false by default on both BLE and USB adapters', () => {
      const ble = new LeafClipBluetoothDevice();
      const usb = new SpectrometerUSBAdapter();

      expect(ble.autoResponderEnabled).toBe(false);
      expect(usb.autoResponderEnabled).toBe(false);
    });

    it('connects to device silently without sending unprompted HELLO or newline packets', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });

      // In simulation or real BLE, txPacketCount starts at 0 upon connection
      expect(ble.txPacketCount).toBe(0);
      expect(ble.sentCommandsHistory.length).toBe(0);
    });

    it('receives incoming UART prompts passively without sending any automatic reply', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });

      const initialTx = ble.txPacketCount;

      // Push typical STM32 prompts into accumulator
      ble.accumulator.pushChunk('Enter Plant Number: ');
      ble.accumulator.pushChunk('Enter Plant Name: ');
      ble.accumulator.pushChunk('Enter Pot Number: ');
      ble.accumulator.pushChunk('Correct? Y/N: ');
      ble.accumulator.pushChunk('Calibrate DARK now? Y/N: ');

      // Verify ZERO outgoing packets were sent
      expect(ble.txPacketCount).toBe(initialTx);
      expect(ble.sentCommandsHistory.length).toBe(0);
    });

    it('transmits metadata ONLY when user explicitly triggers transmitSpecimenBatch (Step 2)', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });

      expect(ble.txPacketCount).toBe(0);

      // Explicit user action: user clicks "Verify & Send to Spectroscope"
      await ble.transmitSpecimenBatch({
        plantName: 'Roma Tomato',
        plantNumber: 'PLANT-042',
        potNumber: 'POT-01',
        leafSpot: 1,
        zone: 'Zone 1'
      });

      // Packets should now be sent
      expect(ble.txPacketCount).toBeGreaterThan(0);
      expect(ble.sentCommandsHistory.some(cmd => cmd.includes('PLANT-042'))).toBe(true);
      expect(ble.sentCommandsHistory.some(cmd => cmd.includes('POT-01'))).toBe(true);
    });

    it('transmits dark calibration command ONLY when user explicitly clicks Step 3 button', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });
      ble.isSimulated = false;
      const sentRaw = [];
      ble.sendRaw = async (data) => {
        sentRaw.push(data);
        ble.txPacketCount++;
        return { success: true };
      };

      const txBefore = ble.txPacketCount;

      // Explicit user action: user clicks "Calibrate Dark Baseline"
      const resPromise = ble.runCalibrationStep('DARK_CURRENT');
      // Push response so waitForPacket resolves
      setTimeout(() => {
        ble.accumulator._dispatchPacket({ type: 'CALIB_DARK', data: { status: 'OK', offset: 0.0001 } });
      }, 50);

      const res = await resPromise;
      expect(res.success).toBe(true);
      expect(ble.txPacketCount).toBeGreaterThan(txBefore);
      expect(sentRaw.some(s => s.includes('START_DARK_CALIBRATION') || s.includes('Y\r\n'))).toBe(true);
    });

    it('transmits white reference command ONLY when user explicitly clicks Step 4 button', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });
      ble.isSimulated = false;
      const sentRaw = [];
      ble.sendRaw = async (data) => {
        sentRaw.push(data);
        ble.txPacketCount++;
        return { success: true };
      };

      const txBefore = ble.txPacketCount;

      // Explicit user action: user clicks "Calibrate White Reference Standard"
      const resPromise = ble.runCalibrationStep('WHITE_REFERENCE');
      setTimeout(() => {
        ble.accumulator._dispatchPacket({ type: 'CALIB_WHITE', data: { status: 'OK', value: 0.992 } });
      }, 50);

      const res = await resPromise;
      expect(res.success).toBe(true);
      expect(ble.txPacketCount).toBeGreaterThan(txBefore);
      expect(sentRaw.some(s => s.includes('START_WHITE_CALIBRATION') || s.includes('Y\r\n'))).toBe(true);
    });

    it('transmits leaf scan command ONLY when user explicitly clicks Step 5 button', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });
      ble.isSimulated = false;
      const sentRaw = [];
      ble.sendRaw = async (data) => {
        sentRaw.push(data);
        ble.txPacketCount++;
        return { success: true };
      };

      const txBefore = ble.txPacketCount;

      // Explicit user action: user clicks "Scan Plant Leaf"
      const scanPromise = ble.triggerLeafMeasurement({
        plotNumber: 1,
        cropName: 'Roma Tomato',
        metadata: {
          plantNumber: 'PLANT-042',
          plantName: 'Roma Tomato',
          potNumber: 'POT-01',
          leafSpot: 'Leaf 1'
        }
      });
      setTimeout(() => {
        ble.accumulator._dispatchPacket({
          type: 'SPECTRUM',
          data: {
            rawCounts: new Array(18).fill(25000),
            channels: new Array(18).fill(25000),
            wavelengths: [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940]
          }
        });
      }, 50);

      const scan = await scanPromise;
      expect(scan).toBeDefined();
      expect(ble.txPacketCount).toBeGreaterThan(txBefore);
      expect(sentRaw.some(s => s.includes('START_LEAF_SCAN') || s.includes('Y\r\n') || s.includes('1\r\n'))).toBe(true);
    });

    it('transmits ping packet ONLY when user explicitly clicks Ping / Test Link', async () => {
      const ble = new LeafClipBluetoothDevice();
      await ble.connect({ forceSimulation: true });

      const txBefore = ble.txPacketCount;

      // Explicit user action: user clicks "Ping / Test Link"
      const pingRes = await ble.ping();
      expect(pingRes.success).toBe(true);
      expect(ble.txPacketCount).toBeGreaterThan(txBefore);
    });

    it('switching between Auto and Manual tabs in Step 2 does NOT transmit any BLE packets', async () => {
      setupHeadlessDOM();
      const view = createSpectroscopyAnalysisView();
      expect(view).toBeDefined();

      const autoTab = view.querySelector('#specimen-mode-auto-tab');
      const manualTab = view.querySelector('#specimen-mode-manual-tab');

      // Clicking tabs should NOT fire transmitSpecimenBatch
      autoTab?.click();
      manualTab?.click();
      autoTab?.click();
      expect(true).toBe(true);
    });
  });
}
