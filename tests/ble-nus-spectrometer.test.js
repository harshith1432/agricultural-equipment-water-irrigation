/**
 * Test Suite: Native BLE & Nordic UART Service (NUS) & ST-Link USB Serial Integration
 * Verifies:
 *   1. Nordic UART Service (NUS) GATT UUIDs and Fallback FFE0 & Battery Service
 *   2. Dual-backend BLE (Capacitor BLE / Web Bluetooth) & High-Fidelity Simulation Fallback
 *   3. MTU Negotiation (247 / 512 bytes)
 *   4. Streaming Ring Buffer / Packet Chunk Accumulator reassembly across fragmented BLE MTU frames
 *   5. Hardware Commands: Dark Calibration, White Reference, Leaf Measurement, Specimen Metadata
 *   6. USB Serial Detection (ST-Link / COM9 Virtual COM Port VID:0x0483, PID:0x374b) & Handshake
 */

import { describe, it, expect } from './framework.js';
import {
  leafClipDevice,
  LeafClipBluetoothDevice,
  BLE_SERVICES
} from '../src/hardware/webBluetoothLeafClip.js';
import {
  spectrometerUSBAdapter,
  SpectrometerUSBAdapter,
  CONNECTION_MODES,
  SPECTROMETER_USB_FILTERS,
  BLE_SPECTROMETER_SERVICES,
  SPECTROMETER_CONFIG
} from '../src/hardware/spectrometerUSBAdapter.js';
import {
  PacketChunkAccumulator,
  PACKET_TYPES,
  BINARY_MAGIC,
  BINARY_TAIL
} from '../src/hardware/packetChunkAccumulator.js';

export function registerBleNusSpectrometerTests() {
  describe('Nordic UART Service (NUS) & GATT Protocol Profile', () => {
    it('defines primary Nordic UART Service (NUS) UUIDs with direct in-app GATT communication', () => {
      expect(BLE_SERVICES.NUS_SERVICE).toBe('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
      expect(BLE_SERVICES.NUS_TX_CHAR).toBe('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
      expect(BLE_SERVICES.NUS_RX_CHAR).toBe('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
    });

    it('defines fallback custom service (FFE0/FFE1/FFE2) and standard Battery Service (0x180F)', () => {
      expect(BLE_SERVICES.FALLBACK_SERVICE).toBe('0000ffe0-0000-1000-8000-00805f9b34fb');
      expect(BLE_SERVICES.FALLBACK_DATA_CHAR).toBe('0000ffe1-0000-1000-8000-00805f9b34fb');
      expect(BLE_SERVICES.FALLBACK_COMMAND_CHAR).toBe('0000ffe2-0000-1000-8000-00805f9b34fb');
      expect(BLE_SERVICES.BATTERY_SERVICE).toBe('0000180f-0000-1000-8000-00805f9b34fb');
      expect(BLE_SERVICES.BATTERY_LEVEL_CHAR).toBe('00002a19-0000-1000-8000-00805f9b34fb');
    });

    it('maintains backward-compatible service and characteristic aliases', () => {
      expect(BLE_SERVICES.SPECTROMETER_SERVICE).toBeDefined();
      expect(BLE_SERVICES.DATA_CHAR).toBeDefined();
      expect(BLE_SERVICES.COMMAND_CHAR).toBeDefined();
      expect(BLE_SERVICES.LEGACY_SPECTROMETER_SERVICE).toBe('0000ffe0-0000-1000-8000-00805f9b34fb');
    });
  });

  describe('Streaming Ring Buffer & Packet Chunk Accumulator', () => {
    it('reassembles JSON lines fragmented into small 20-byte BLE MTU chunks', async () => {
      const accumulator = new PacketChunkAccumulator({ capacity: 4096 });
      const received = [];
      accumulator.on('packet', p => received.push(p));

      const payload = {
        type: PACKET_TYPES.SPECTRUM,
        plot: 3,
        rawCounts: [1250, 1340, 1580, 22000, 58000],
        timestamp: 1700000000000
      };
      const jsonLine = JSON.stringify(payload) + '\n';

      // Push in 18-byte chunks (simulating standard 23 MTU minus 3 byte GATT header)
      for (let i = 0; i < jsonLine.length; i += 18) {
        accumulator.pushChunk(jsonLine.slice(i, i + 18));
      }

      expect(received.length).toBe(1);
      expect(received[0].type).toBe(PACKET_TYPES.SPECTRUM);
      expect(received[0].format).toBe('JSON');
      expect(received[0].data.plot).toBe(3);
      expect(received[0].data.rawCounts.length).toBe(5);
    });

    it('reassembles delimited ASCII CSV spectral vectors ($SPEC) across MTU chunks', () => {
      const accumulator = new PacketChunkAccumulator();
      let spectrumPacket = null;
      accumulator.on('spectrum', p => { spectrumPacket = p; });

      const csvData = '$SPEC,5,1300,1350,1400,28000,61000\r\n';
      // Push in 7-byte chunks
      for (let i = 0; i < csvData.length; i += 7) {
        accumulator.pushChunk(csvData.slice(i, i + 7));
      }

      expect(spectrumPacket).toBeDefined();
      expect(spectrumPacket.data.totalBands).toBe(5);
      expect(spectrumPacket.data.rawCounts).toEqual([1300, 1350, 1400, 28000, 61000]);
    });

    it('reassembles framed binary packets with magic header 0xAA 0x55 and tail 0x0D 0x0A', () => {
      const accumulator = new PacketChunkAccumulator();
      const packets = [];
      accumulator.on('packet', p => packets.push(p));

      // Build 76-band uint16 binary frame
      const bands = 76;
      const rawPayload = new Uint8Array(bands * 2);
      const view = new DataView(rawPayload.buffer);
      for (let i = 0; i < bands; i++) {
        view.setUint16(i * 2, 1000 + i * 500, true);
      }

      const frame = PacketChunkAccumulator.buildBinaryFrame(0x03, Array.from(rawPayload));

      // Push in 20-byte chunks
      for (let i = 0; i < frame.length; i += 20) {
        accumulator.pushChunk(frame.slice(i, i + 20));
      }

      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe(PACKET_TYPES.SPECTRUM);
      expect(packets[0].format).toBe('BINARY');
      expect(packets[0].data.totalBands).toBe(76);
      expect(packets[0].data.rawCounts.length).toBe(76);
      expect(packets[0].data.rawCounts[0]).toBe(1000);
      expect(packets[0].data.rawCounts[75]).toBe(1000 + 75 * 500);
    });

    it('handles waitForPacket with matching predicate and timeout', async () => {
      const accumulator = new PacketChunkAccumulator();

      // Trigger packet after 50ms delay
      setTimeout(() => {
        accumulator.pushChunk(JSON.stringify({ type: PACKET_TYPES.CALIB_DARK, status: 'OK', offset: 0.019 }) + '\n');
      }, 50);

      const packet = await accumulator.waitForPacket(PACKET_TYPES.CALIB_DARK, 2000);
      expect(packet.type).toBe(PACKET_TYPES.CALIB_DARK);
      expect(packet.data.status).toBe('OK');
    });
  });

  describe('LeafClipBluetoothDevice - BLE NUS & Command Triggers', () => {
    it('seamlessly connects in high-fidelity simulation mode when physical BLE is unavailable', async () => {
      const device = new LeafClipBluetoothDevice();
      const res = await device.connect({ forceSimulation: true });

      expect(res.success).toBe(true);
      expect(res.simulated).toBe(true);
      expect(device.isConnected).toBe(true);
      expect(device.isSimulated).toBe(true);
      expect(device.negotiatedMtu).toBe(247);
      expect(device.deviceInfo.protocol).toContain('Nordic UART Service');
    });

    it('supports MTU negotiation requesting 247 or 512 bytes', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      let mtuEvent = null;
      device.on('mtuChange', data => { mtuEvent = data; });

      const mtu512 = await device.requestMtu(512);
      expect(mtu512).toBe(512);
      expect(device.negotiatedMtu).toBe(512);
      expect(mtuEvent.mtu).toBe(512);

      const mtu247 = await device.requestMtu(247);
      expect(mtu247).toBe(247);
      expect(device.negotiatedMtu).toBe(247);
    });

    it('executes triggerDarkCalibration command and updates calibration state', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      const result = await device.triggerDarkCalibration();
      expect(result.success).toBe(true);
      expect(result.phase).toBe('DARK_CURRENT');
      expect(device.calibration.darkCurrentCompleted).toBe(true);
      expect(device.calibration.darkCurrentValue).toBeGreaterThan(0);
    });

    it('executes triggerWhiteReference command and updates calibration state', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      const result = await device.triggerWhiteReference();
      expect(result.success).toBe(true);
      expect(result.phase).toBe('WHITE_REFERENCE');
      expect(device.calibration.whiteDiscCompleted).toBe(true);
      expect(device.calibration.isCalibrated).toBe(true);
      expect(device.calibration.lastCalibratedAt).toBeDefined();
    });

    it('maintains runCalibrationStep backward compatibility for wizard progression', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      const progressSteps = [];
      await device.runCalibrationStep('DARK_CURRENT', (pct, msg) => {
        progressSteps.push({ pct, msg });
      });

      expect(progressSteps.length).toBeGreaterThan(0);
      expect(device.calibration.darkCurrentCompleted).toBe(true);
    });

    it('tags physical specimen with metadata via setSpecimenMetadata', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      let metadataEvent = null;
      device.on('metadataUpdated', d => { metadataEvent = d; });

      const meta = {
        plotNumber: 4,
        cropName: 'Tomato',
        growthStage: 'Flowering',
        specimenId: 'TOM-FL-042',
        notes: 'Upper leaf quadrant scan'
      };

      const res = await device.setSpecimenMetadata(meta);
      expect(res.success).toBe(true);
      expect(device.specimenMetadata.plotNumber).toBe(4);
      expect(device.specimenMetadata.cropName).toBe('Tomato');
      expect(device.specimenMetadata.specimenId).toBe('TOM-FL-042');
      expect(metadataEvent.metadata.specimenId).toBe('TOM-FL-042');
    });

    it('executes triggerLeafMeasurement and returns complete chemometrics diagnostic report', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      const analysis = await device.triggerLeafMeasurement({
        plotNumber: 1,
        cropName: 'Bell Peppers',
        growthStage: 'Fruit Formation',
        soilVwc: 26.5
      });

      expect(analysis).toBeDefined();
      expect(analysis.indices).toBeDefined();
      expect(analysis.indices.ndvi).toBeDefined();
      expect(analysis.indices.ndre).toBeDefined();
      expect(analysis.indices.lwi).toBeDefined();
      expect(analysis.vitalityScore).toBeGreaterThan(50);
      expect(analysis.nitrogenPrescriptionKg).toBeDefined();
      expect(analysis.irrigationCountdownHours).toBeDefined();
      expect(analysis.diseaseRisk).toBeDefined();
      expect(analysis.device).toBeDefined();
    });
  });

  describe('SpectrometerUSBAdapter - ST-Link (COM9) USB Serial & BLE NUS Handshake', () => {
    it('includes ST-Link Virtual COM Port (VID:0x0483, PID:0x374b) in SPECTROMETER_USB_FILTERS', () => {
      const stlinkFilter = SPECTROMETER_USB_FILTERS.find(f => f.vendorId === 0x0483 && f.productId === 0x374b);
      expect(stlinkFilter).toBeDefined();
      expect(stlinkFilter.vendorId).toBe(0x0483);
      expect(stlinkFilter.productId).toBe(0x374b);

      const stlinkV3 = SPECTROMETER_USB_FILTERS.find(f => f.vendorId === 0x0483 && f.productId === 0x374e);
      expect(stlinkV3).toBeDefined();
    });

    it('defines Nordic UART Service in BLE_SPECTROMETER_SERVICES', () => {
      expect(BLE_SPECTROMETER_SERVICES.NUS_SERVICE_UUID).toBe('6e400001-b5a3-f393-e0a9-e50e24dcca9e');
      expect(BLE_SPECTROMETER_SERVICES.NUS_TX_CHAR_UUID).toBe('6e400003-b5a3-f393-e0a9-e50e24dcca9e');
      expect(BLE_SPECTROMETER_SERVICES.NUS_RX_CHAR_UUID).toBe('6e400002-b5a3-f393-e0a9-e50e24dcca9e');
    });

    it('supports connection handshake across both USB serial OTG and BLE NUS modes', async () => {
      const spectrometer = new SpectrometerUSBAdapter();

      // USB Mode
      const usbRes = await spectrometer.connect({ mode: CONNECTION_MODES.USB_TYPE_C, forceSimulation: true });
      expect(usbRes.success).toBe(true);
      expect(spectrometer.connectionMode).toBe(CONNECTION_MODES.USB_TYPE_C);
      expect(spectrometer.isConnected).toBe(true);

      // BLE Mode
      const bleRes = await spectrometer.connect({ mode: CONNECTION_MODES.BLUETOOTH_BLE, forceSimulation: true });
      expect(bleRes.success).toBe(true);
      expect(spectrometer.connectionMode).toBe(CONNECTION_MODES.BLUETOOTH_BLE);
      expect(spectrometer.isConnected).toBe(true);

      await spectrometer.disconnect();
      expect(spectrometer.isConnected).toBe(false);
    });

    it('provides calibrateDark, calibrateWhite, triggerDarkCalibration, and triggerWhiteReference', async () => {
      const spectrometer = new SpectrometerUSBAdapter();
      await spectrometer.connect({ forceSimulation: true });

      const dark = await spectrometer.calibrateDark();
      expect(dark.success).toBe(true);
      expect(dark.quality).toBe('OPTIMAL');

      const white = await spectrometer.calibrateWhite();
      expect(white.success).toBe(true);
      expect(white.quality).toBe('OPTIMAL');
      expect(spectrometer.calibration.isCalibrated).toBe(true);
    });

    it('supports setSpecimenMetadata and specimen tagging on SpectrometerUSBAdapter', async () => {
      const spectrometer = new SpectrometerUSBAdapter();
      await spectrometer.connect({ forceSimulation: true });

      const meta = await spectrometer.setSpecimenMetadata({
        plotNumber: 2,
        cropName: 'Eggplant',
        growthStage: 'Vegetative',
        specimenId: 'EGG-092'
      });

      expect(meta.success).toBe(true);
      expect(spectrometer.specimenMetadata.cropName).toBe('Eggplant');
      expect(spectrometer.specimenMetadata.specimenId).toBe('EGG-092');
    });
  });
}
