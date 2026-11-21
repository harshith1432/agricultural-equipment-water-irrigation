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
  BLE_SERVICES,
  OPERATING_MODES
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
    it('defines STMicroelectronics BlueNRG BLE Chat Profile UUIDs (B-L475E-IOT01A2 / SPBTLE-RF)', () => {
      expect(BLE_SERVICES.BLUENRG_SERVICE).toBe('d973f2e0-b19e-11e2-9e96-0800200c9a66');
      expect(BLE_SERVICES.BLUENRG_TX_CHAR).toBe('d973f2e1-b19e-11e2-9e96-0800200c9a66');
      expect(BLE_SERVICES.BLUENRG_RX_CHAR).toBe('d973f2e2-b19e-11e2-9e96-0800200c9a66');
      expect(BLE_SPECTROMETER_SERVICES.BLUENRG_SERVICE).toBe('d973f2e0-b19e-11e2-9e96-0800200c9a66');
      expect(BLE_SPECTROMETER_SERVICES.BLUENRG_TX_CHAR).toBe('d973f2e1-b19e-11e2-9e96-0800200c9a66');
      expect(BLE_SPECTROMETER_SERVICES.BLUENRG_RX_CHAR).toBe('d973f2e2-b19e-11e2-9e96-0800200c9a66');
    });

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

    it('defines standard Device Information, Generic Access, and Generic Attribute services', () => {
      expect(BLE_SERVICES.DEVICE_INFO_SERVICE).toBe('0000180a-0000-1000-8000-00805f9b34fb');
      expect(BLE_SERVICES.GENERIC_ACCESS_SERVICE).toBe('00001800-0000-1000-8000-00805f9b34fb');
      expect(BLE_SERVICES.GENERIC_ATTRIBUTE_SERVICE).toBe('00001801-0000-1000-8000-00805f9b34fb');
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

    it('captures raw incoming chunks and emits rawChunk with rawBytes, rawText, timestamp, length', () => {
      const accumulator = new PacketChunkAccumulator();
      const rawChunks = [];
      accumulator.on('rawChunk', c => rawChunks.push(c));

      accumulator.pushChunk('RAW_TEST_CHUNK_DATA');

      expect(rawChunks.length).toBe(1);
      expect(rawChunks[0].rawText).toBe('RAW_TEST_CHUNK_DATA');
      expect(rawChunks[0].length).toBe(19);
      expect(rawChunks[0].rawBytes instanceof Uint8Array).toBe(true);
      expect(rawChunks[0].timestamp).toBeGreaterThan(0);
    });

    it('recognizes any line with numeric values even without $SPEC as PACKET_TYPES.SPECTRUM', () => {
      const accumulator = new PacketChunkAccumulator();
      const spectra = [];
      accumulator.on('spectrum', s => spectra.push(s));

      // 1. Comma separated counts (e.g. AS7262 6 channels)
      accumulator.pushChunk('1200, 1450, 1800, 2400, 3100, 4200\n');
      expect(spectra.length).toBe(1);
      expect(spectra[0].type).toBe(PACKET_TYPES.SPECTRUM);
      expect(spectra[0].format).toBe('RAW_NUMERIC');
      expect(spectra[0].data.rawCounts).toEqual([1200, 1450, 1800, 2400, 3100, 4200]);
      expect(spectra[0].data.totalBands).toBe(6);

      // 2. Space separated counts
      accumulator.pushChunk('500 600 700 800\n');
      expect(spectra.length).toBe(2);
      expect(spectra[1].data.rawCounts).toEqual([500, 600, 700, 800]);

      // 3. Prefixed numeric line (e.g. C12880MA)
      accumulator.pushChunk('RAW: 100, 200, 300\n');
      expect(spectra.length).toBe(3);
      expect(spectra[2].data.rawCounts).toEqual([100, 200, 300]);
    });

    it('parses real hardware AS7265x 18-channel DARK, WHITE, Scan lines, and environmental sensor telemetry', () => {
      const accumulator = new PacketChunkAccumulator();
      const packets = [];
      accumulator.on('packet', p => packets.push(p));

      // 1. DARK reading
      accumulator.pushChunk('DARK: 483 57 54 31 84 8 209 444 280 32 12 15 43 558 817 206 432 409\n');
      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe(PACKET_TYPES.CALIB_DARK);
      expect(packets[0].format).toBe('AS7265X_DARK');
      expect(packets[0].data.channels.length).toBe(18);
      expect(packets[0].data.channels[0]).toBe(483);
      expect(packets[0].data.channels[17]).toBe(409);

      // 2. WHITE reading
      accumulator.pushChunk('WHITE: 604 58 58 33 104 9 466 727 419 42 15 16 50 613 827 280 545 457\n');
      expect(packets.length).toBe(2);
      expect(packets[1].type).toBe(PACKET_TYPES.CALIB_WHITE);
      expect(packets[1].format).toBe('AS7265X_WHITE');
      expect(packets[1].data.channels.length).toBe(18);

      // 3. Scan 1 reading
      accumulator.pushChunk('Scan 1: 605 59 58 33 104 9 467 729 419 42 15 16 50 614 825 280 545 458\n');
      expect(packets.length).toBe(3);
      expect(packets[2].type).toBe(PACKET_TYPES.SPECTRUM);
      expect(packets[2].format).toBe('AS7265X_SCAN');
      expect(packets[2].data.scanIndex).toBe(1);
      expect(packets[2].data.channels.length).toBe(18);

      // 4. Environmental sensor line (BME280)
      accumulator.pushChunk('T=28.3 P=914.4 H=48.1\n');
      expect(packets.length).toBe(4);
      expect(packets[3].type).toBe(PACKET_TYPES.ENV_TELEMETRY);
      expect(packets[3].format).toBe('AS7265X_ENV');
      expect(packets[3].data.temperature).toBe(28.3);
      expect(packets[3].data.pressure).toBe(914.4);
      expect(packets[3].data.humidity).toBe(48.1);

      // 5. Hardware interactive prompt questions
      accumulator.pushChunk('Enter Plant Number:\n');
      expect(packets.length).toBe(5);
      expect(packets[4].type).toBe(PACKET_TYPES.DEVICE_PROMPT);
      expect(packets[4].data.promptType).toBe('ENTER_PLANT_NUMBER');

      accumulator.pushChunk('Calibrate DARK (LED off) now? Y/N:\n');
      expect(packets.length).toBe(6);
      expect(packets[5].type).toBe(PACKET_TYPES.DEVICE_PROMPT);
      expect(packets[5].data.promptType).toBe('PROMPT_CALIBRATE_DARK');
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

    it('initializes in clear DISCONNECTED state until user explicitly initiates connection', () => {
      const freshDevice = new LeafClipBluetoothDevice();
      expect(freshDevice.isConnected).toBe(false);
      expect(freshDevice.connectionStatus).toBe('DISCONNECTED');
      expect(freshDevice.device).toBe(null);
    });

    it('discovers BlueNRG_Chat device via scanForDevices with ST BlueNRG Chat protocol and recommendations', async () => {
      const device = new LeafClipBluetoothDevice();
      const devices = await device.scanForDevices(200);

      const blueNrgDevice = devices.find(d => d.name === 'BlueNRG_Chat' || d.isBlueNrg);
      expect(blueNrgDevice).toBeDefined();
      expect(blueNrgDevice.isBlueNrg).toBe(true);
      expect(blueNrgDevice.protocol).toBe('ST BlueNRG Chat');
      expect(blueNrgDevice.serviceUuid).toBe(BLE_SERVICES.BLUENRG_SERVICE);
      expect(blueNrgDevice.recommended).toBe(true);
      expect(blueNrgDevice.mac).toBe('02:80:E1:00:00:AA');
    });

    it('connects to BlueNRG_Chat device and configures ST BlueNRG Chat Service protocol', async () => {
      const device = new LeafClipBluetoothDevice();
      const res = await device.connectToDevice({
        deviceId: '02:80:E1:00:00:AA',
        name: 'BlueNRG_Chat'
      });

      expect(res.success).toBe(true);
      expect(device.isConnected).toBe(true);
      expect(device.deviceInfo.protocol).toBe('ST BlueNRG Chat Service');
      expect(device.deviceInfo.model).toBe('BlueNRG_Chat');
    });

    it('binds ST BlueNRG Chat GATT characteristics when Web Bluetooth discovers BLUENRG_SERVICE', async () => {
      const device = new LeafClipBluetoothDevice();
      
      const mockTxChar = {
        uuid: BLE_SERVICES.BLUENRG_TX_CHAR,
        startNotifications: async () => {},
        addEventListener: (event, cb) => {}
      };
      const mockRxChar = {
        uuid: BLE_SERVICES.BLUENRG_RX_CHAR,
        writeValueWithoutResponse: async () => {}
      };

      const mockService = {
        uuid: BLE_SERVICES.BLUENRG_SERVICE,
        getCharacteristic: async (uuid) => {
          if (uuid === BLE_SERVICES.BLUENRG_TX_CHAR) return mockTxChar;
          if (uuid === BLE_SERVICES.BLUENRG_RX_CHAR) return mockRxChar;
          throw new Error('Characteristic not found: ' + uuid);
        }
      };

      const mockGatt = {
        connected: true,
        connect: async () => mockGatt,
        disconnect: () => {},
        getPrimaryService: async (uuid) => {
          if (uuid === BLE_SERVICES.BLUENRG_SERVICE) return mockService;
          throw new Error('Service not found: ' + uuid);
        }
      };

      let requestedOptions = null;
      if (!globalThis.navigator) globalThis.navigator = {};
      const originalBluetooth = globalThis.navigator?.bluetooth;
      Object.defineProperty(globalThis.navigator, 'bluetooth', {
        value: {
          requestDevice: async (opts) => {
            requestedOptions = opts;
            return {
              id: '02:80:E1:00:00:AA',
              name: 'BlueNRG_Chat',
              gatt: mockGatt,
              addEventListener: () => {}
            };
          }
        },
        configurable: true,
        writable: true
      });

      try {
        const res = await device.connect({ preferredMtu: 247 });
        expect(res.success).toBe(true);
        expect(device.isConnected).toBe(true);
        expect(device.isSimulated).toBe(false);
        expect(device.activeServiceUuid).toBe(BLE_SERVICES.BLUENRG_SERVICE);
        expect(device.deviceInfo.protocol).toBe('ST BlueNRG Chat Service');
        expect(device.txCharacteristic).toBe(mockTxChar);
        expect(device.rxCharacteristic).toBe(mockRxChar);
        expect(requestedOptions.optionalServices).toContain(BLE_SERVICES.BLUENRG_SERVICE);
      } finally {
        if (globalThis.navigator) {
          if (originalBluetooth !== undefined) {
            Object.defineProperty(globalThis.navigator, 'bluetooth', {
              value: originalBluetooth,
              configurable: true,
              writable: true
            });
          } else {
            delete globalThis.navigator.bluetooth;
          }
        }
        device.disconnect();
      }
    });

    it('binds ST BlueNRG Chat GATT characteristics when Native Capacitor BLE connects', async () => {
      const device = new LeafClipBluetoothDevice();
      
      const notificationsStarted = [];
      const mockBleClient = {
        initialize: async () => {},
        connect: async (id, onDisconnect) => {},
        requestMtu: async (id, mtu) => mtu,
        startNotifications: async (id, serviceUuid, charUuid, cb) => {
          notificationsStarted.push({ serviceUuid, charUuid });
          if (serviceUuid !== BLE_SERVICES.BLUENRG_SERVICE) {
            throw new Error('Service not supported');
          }
        },
        read: async () => new DataView(new Uint8Array([95]).buffer),
        disconnect: async () => {}
      };

      // Mock Capacitor native platform
      const originalWindow = globalThis.window;
      globalThis.window = {
        ...originalWindow,
        Capacitor: {
          isNativePlatform: () => true,
          getPlatform: () => 'android',
          Plugins: { BleClient: mockBleClient }
        }
      };

      try {
        const res = await device.connectToDevice({
          deviceId: '02:80:E1:00:00:AA',
          name: 'BlueNRG_Chat'
        });

        expect(res.success).toBe(true);
        expect(device.isConnected).toBe(true);
        expect(device.isSimulated).toBe(false);
        expect(device.activeServiceUuid).toBe(BLE_SERVICES.BLUENRG_SERVICE);
        expect(device.txCharacteristic).toBe(BLE_SERVICES.BLUENRG_TX_CHAR);
        expect(device.rxCharacteristic).toBe(BLE_SERVICES.BLUENRG_RX_CHAR);
        expect(device.deviceInfo.protocol).toBe('ST BlueNRG Chat Service');
      } finally {
        if (originalWindow) {
          globalThis.window = originalWindow;
          if (originalWindow.Capacitor) {
            delete globalThis.window.Capacitor;
          }
        } else {
          delete globalThis.window;
        }
        device.disconnect();
      }
    });

    it('discovers nearby devices unrestricted via scanForDevices and streams scanResult events', async () => {
      const device = new LeafClipBluetoothDevice();
      const results = [];
      device.on('scanResult', r => results.push(r));

      const devices = await device.scanForDevices(200);
      expect(devices.length).toBeGreaterThan(0);
      expect(devices[0].deviceId).toBeDefined();
      expect(devices[0].name).toBeDefined();
      expect(devices[0].rssi).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].deviceId).toBe(devices[0].deviceId);
    });

    it('connects to chosen device via connectToDevice(deviceId) and manual connect({ deviceId })', async () => {
      const device = new LeafClipBluetoothDevice();
      let lastEvent = null;
      device.on('connectionChange', e => { lastEvent = e; });

      // Direct connectToDevice
      const res = await device.connectToDevice('CUSTOM-DEV-1234');
      expect(res.success).toBe(true);
      expect(device.isConnected).toBe(true);
      expect(device.connectionStatus).toBe('CONNECTED');
      expect(device.deviceInfo.id).toBe('CUSTOM-DEV-1234');
      expect(lastEvent.status).toBe('CONNECTED');

      // Manual connect with deviceId
      const device2 = new LeafClipBluetoothDevice();
      const res2 = await device2.connect({ deviceId: 'NRF52-MANUAL-001' });
      expect(res2.success).toBe(true);
      expect(device2.isConnected).toBe(true);
      expect(device2.deviceInfo.id).toBe('NRF52-MANUAL-001');
    });

    it('maintains rolling rawHistory log of last 50 entries and updates lastRawReading', () => {
      const device = new LeafClipBluetoothDevice();
      const rawEvents = [];
      device.on('rawData', d => rawEvents.push(d));

      // Push 60 chunks into accumulator
      for (let i = 0; i < 60; i++) {
        device.accumulator.pushChunk(`RAW_PAYLOAD_${i}\n`);
      }

      // rawHistory must be clamped to at most 50
      expect(device.rawHistory.length).toBe(50);
      expect(rawEvents.length).toBeGreaterThan(0);

      // Push a numeric spectrum line
      device.accumulator.pushChunk('1100, 1250, 1380, 24000\n');
      expect(device.lastRawReading).toBeDefined();
      expect(device.lastRawReading.rawCounts).toEqual([1100, 1250, 1380, 24000]);
      expect(device.lastRawReading.format).toBe('RAW_NUMERIC');
    });

    it('preserves and attaches rawCounts and rawText to analysis.rawData when physical packet is received', async () => {
      const device = new LeafClipBluetoothDevice();
      device.isConnected = true;
      device.isSimulated = false; // Physical mode

      // Emit physical spectrum packet shortly after triggerLeafMeasurement
      setTimeout(() => {
        const counts = Array.from({ length: 76 }, (_, i) => 15000 + i * 200);
        device.accumulator.pushChunk(`$SPEC,76,${counts.join(',')}\r\n`);
      }, 50);

      const analysis = await device.triggerLeafMeasurement({
        plotNumber: 1,
        cropName: 'Bell Peppers',
        growthStage: 'Fruit Formation'
      });

      expect(analysis.rawData).toBeDefined();
      expect(analysis.rawData.rawCounts).toBeDefined();
      expect(analysis.rawData.rawCounts.length).toBe(76);
      expect(analysis.rawData.rawText).toContain('$SPEC');
      expect(analysis.rawData.timestamp).toBeDefined();
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

  describe('Interactive Firmware Terminal Prompts & Intelligent Dialogue State Machine', () => {
    it('sendBatchSpecimenData transmits Plant Number, Plant Name, Pot Number, and confirmation Y sequentially', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });

      const res = await device.sendBatchSpecimenData({
        plantNumber: 'PLANT-101',
        plantName: 'Cotton',
        potNumber: 'POT-1'
      });

      expect(res.success).toBe(true);
      expect(device.specimenMetadata.plantNumber).toBe('PLANT-101');
      expect(device.specimenMetadata.plantName).toBe('Cotton');
      expect(device.specimenMetadata.potNumber).toBe('POT-1');
      expect(device.sentCommandsHistory).toContain('PLANT-101\r\n');
      expect(device.sentCommandsHistory).toContain('Cotton\r\n');
      expect(device.sentCommandsHistory).toContain('POT-1\r\n');
      expect(device.sentCommandsHistory).toContain('Y\r\n');
    });

    it('auto-responds to Enter Plant Number, Enter Plant Name, Enter Pot Number, and Correct? Y/N', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });
      device.autoResponderEnabled = true;

      device.specimenMetadata.plantNumber = 'PLANT-555';
      device.specimenMetadata.plantName = 'Roma Tomato';
      device.specimenMetadata.potNumber = 'POT-09';

      const promptsCaptured = [];
      device.on('dialoguePrompt', p => promptsCaptured.push(p));

      // 1. Enter Plant Number:
      device.accumulator.pushChunk('Enter Plant Number: ');
      expect(promptsCaptured.some(p => p.prompt === 'ENTER_PLANT_NUMBER' && p.response === 'PLANT-555\r\n')).toBe(true);
      expect(device.sentCommandsHistory).toContain('PLANT-555\r\n');

      // 2. Enter Plant Name:
      device.accumulator.pushChunk('Enter Plant Name: ');
      expect(promptsCaptured.some(p => p.prompt === 'ENTER_PLANT_NAME' && p.response === 'Roma Tomato\r\n')).toBe(true);
      expect(device.sentCommandsHistory).toContain('Roma Tomato\r\n');

      // 3. Enter Pot Number:
      device.accumulator.pushChunk('Enter Pot Number: ');
      expect(promptsCaptured.some(p => p.prompt === 'ENTER_POT_NUMBER' && p.response === 'POT-09\r\n')).toBe(true);
      expect(device.sentCommandsHistory).toContain('POT-09\r\n');

      // 4. Correct? Y/N:
      device.accumulator.pushChunk('Correct? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'CONFIRM_METADATA' && p.response === 'Y\r\n')).toBe(true);
      expect(device.sentCommandsHistory).toContain('Y\r\n');
    });

    it('auto-responds to DARK prompts and auto-saves calibration baseline', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });
      device.autoResponderEnabled = true;

      const prompts = [];
      device.on('dialoguePrompt', p => prompts.push(p));

      device.darkCalibPending = true;
      device.accumulator.pushChunk('Ready for DARK measurement? Y/N: ');
      expect(prompts.some(p => p.prompt === 'DARK_READY' && p.response === 'Y\r\n')).toBe(true);

      device.accumulator.pushChunk('Save DARK? Y/N: ');
      expect(prompts.some(p => p.prompt === 'SAVE_DARK' && p.response === 'Y\r\n')).toBe(true);
    });

    it('auto-responds to WHITE prompts (turning on white light) and auto-saves white baseline', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });
      device.autoResponderEnabled = true;

      const prompts = [];
      device.on('dialoguePrompt', p => prompts.push(p));

      device.whiteCalibPending = true;
      device.accumulator.pushChunk('Ready for WHITE measurement? Y/N: ');
      expect(prompts.some(p => p.prompt === 'WHITE_READY' && p.response === 'Y\r\n')).toBe(true);

      device.accumulator.pushChunk('Save WHITE? Y/N: ');
      expect(prompts.some(p => p.prompt === 'SAVE_WHITE' && p.response === 'Y\r\n')).toBe(true);
    });

    it('auto-responds to leaf scan and spot number prompts (turning on leaf illumination light)', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });
      device.autoResponderEnabled = true;

      const prompts = [];
      device.on('dialoguePrompt', p => prompts.push(p));

      device.leafScanPending = true;
      device.accumulator.pushChunk('Ready for leaf scan? Y/N: ');
      expect(prompts.some(p => p.prompt === 'LEAF_SCAN_READY' && p.response === 'Y\r\n')).toBe(true);

      device.accumulator.pushChunk('Enter Spot Number (1..): ');
      expect(prompts.some(p => p.prompt === 'LEAF_SPOT_NUMBER' && p.response === '1\r\n')).toBe(true);
      expect(device.sentCommandsHistory).toContain('1\r\n');
    });

    it('triggerDarkCalibration, triggerWhiteReference, and triggerLeafMeasurement transmit both prompt confirmation and command', async () => {
      const device = new LeafClipBluetoothDevice();
      device.isConnected = true;
      device.isSimulated = false;

      // Mock write endpoint to verify transmitted raw commands
      const writes = [];
      device.rxCharacteristic = {
        writeValueWithoutResponse: async (data) => {
          writes.push(new TextDecoder().decode(data));
        },
        writeValue: async (data) => {
          writes.push(new TextDecoder().decode(data));
        }
      };

      // 1. Dark Calibration
      setTimeout(() => {
        device.accumulator.pushChunk(JSON.stringify({ type: PACKET_TYPES.CALIB_DARK, status: 'OK' }) + '\n');
      }, 50);
      await device.triggerDarkCalibration();
      expect(writes.some(w => w.includes('Y\r\n'))).toBe(true);

      // 2. White Reference (turns on white light!)
      setTimeout(() => {
        device.accumulator.pushChunk(JSON.stringify({ type: PACKET_TYPES.CALIB_WHITE, status: 'OK' }) + '\n');
      }, 50);
      await device.triggerWhiteReference();
      expect(writes.filter(w => w.includes('Y\r\n')).length).toBeGreaterThanOrEqual(2);

      // 3. Leaf Measurement (turns on leaf illumination light!)
      setTimeout(() => {
        const counts = Array.from({ length: 76 }, (_, i) => 20000 + i * 100);
        device.accumulator.pushChunk(`$SPEC,76,${counts.join(',')}\r\n`);
      }, 50);
      await device.triggerLeafMeasurement({ cropName: 'Cotton', plotNumber: 1 });
      expect(writes.some(w => w.includes('1\r\n'))).toBe(true);
    });

    it('mirrors sendBatchSpecimenData and dialogue handling on SpectrometerUSBAdapter', async () => {
      const spectrometer = new SpectrometerUSBAdapter();
      await spectrometer.connect({ forceSimulation: true });

      const res = await spectrometer.sendBatchSpecimenData({
        plantNumber: 'PLANT-999',
        plantName: 'Sweet Strawberry',
        potNumber: 'POT-7'
      });

      expect(res.success).toBe(true);
      expect(spectrometer.specimenMetadata.plantNumber).toBe('PLANT-999');
      expect(spectrometer.specimenMetadata.plantName).toBe('Sweet Strawberry');
      expect(spectrometer.specimenMetadata.potNumber).toBe('POT-7');
    });

    it('handles physical ST-LINK / BlueNRG sequential interactive console dialogue protocol', async () => {
      const device = new LeafClipBluetoothDevice();
      await device.connect({ forceSimulation: true });
      device.autoResponderEnabled = true;

      device.specimenMetadata.plantNumber = 'PLANT-042';
      device.specimenMetadata.plantName = 'Roma Tomato';
      device.specimenMetadata.potNumber = 'POT-01';

      const promptsCaptured = [];
      device.on('dialoguePrompt', p => promptsCaptured.push(p));

      // 1. Specimen Prompts
      device.accumulator.pushChunk('Enter Plant Number: ');
      expect(promptsCaptured.some(p => p.prompt === 'ENTER_PLANT_NUMBER' && p.response === 'PLANT-042\r\n')).toBe(true);

      device.accumulator.pushChunk('Enter Plant Name: ');
      expect(promptsCaptured.some(p => p.prompt === 'ENTER_PLANT_NAME' && p.response === 'Roma Tomato\r\n')).toBe(true);

      device.accumulator.pushChunk('Enter Pot Number: ');
      expect(promptsCaptured.some(p => p.prompt === 'ENTER_POT_NUMBER' && p.response === 'POT-01\r\n')).toBe(true);

      device.accumulator.pushChunk('Correct? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'CONFIRM_METADATA' && p.response === 'Y\r\n')).toBe(true);

      // 2. Calibrate DARK prompt: does NOT decline N if darkCalibPending is false (waits for user)
      device.darkCalibPending = false;
      device.accumulator.pushChunk('Calibrate DARK (LED off) now? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'DARK_NOW_DECLINE')).toBe(false);

      // Calibrate DARK prompt: confirms Y if darkCalibPending is true
      device.darkCalibPending = true;
      device.accumulator.pushChunk('Calibrate DARK (LED off) now? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'DARK_NOW_CONFIRM' && p.response === 'Y\r\n')).toBe(true);
      device.darkCalibPending = false;

      // 3. Calibrate WHITE prompt: does NOT decline N if whiteCalibPending is false (waits for user)
      device.whiteCalibPending = false;
      device.accumulator.pushChunk('Calibrate WHITE (LED on) now? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'WHITE_NOW_DECLINE')).toBe(false);

      // Calibrate WHITE prompt: confirms Y if whiteCalibPending is true
      device.whiteCalibPending = true;
      device.accumulator.pushChunk('Calibrate WHITE (LED on) now? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'WHITE_NOW_CONFIRM' && p.response === 'Y\r\n')).toBe(true);

      // 4. White Reference Tile Instruction and Ready? Y/N: prompt
      device.accumulator.pushChunk('WHITE: put the white tile where the leaf goes. LED turns ON.\r\nUse the same enclosure and distance as for the leaf.\r\nReady? Y/N: ');
      expect(promptsCaptured.some(p => p.prompt === 'READY_WHITE' && p.response === 'Y\r\n')).toBe(true);
    });

    it('recognizes Measuring DARK and Measuring WHITE as progress and cleanly parses counts', () => {
      const accumulator = new PacketChunkAccumulator();
      const packets = [];
      accumulator.on('packet', p => packets.push(p));

      // Measuring DARK
      accumulator.pushChunk('Measuring DARK (5 readings)...\n');
      expect(packets.length).toBe(1);
      expect(packets[0].type).toBe(PACKET_TYPES.CALIB_DARK);
      expect(packets[0].data.status).toBe('MEASURING');

      // DARK counts
      accumulator.pushChunk('DARK: 483 57 54 31 84 8 209 444 280 32 12 15 43 558 817 206 432 409\n');
      expect(packets.length).toBe(2);
      expect(packets[1].type).toBe(PACKET_TYPES.CALIB_DARK);
      expect(packets[1].data.channels.length).toBe(18);
      expect(packets[1].data.channels[0]).toBe(483);

      // Measuring WHITE
      accumulator.pushChunk('Measuring WHITE (5 readings)...\n');
      expect(packets.length).toBe(3);
      expect(packets[2].type).toBe(PACKET_TYPES.CALIB_WHITE);
      expect(packets[2].data.status).toBe('MEASURING');

      // WHITE counts
      accumulator.pushChunk('WHITE: 604 58 58 33 104 9 466 727 419 42 15 16 50 613 827 280 545 457\n');
      expect(packets.length).toBe(4);
      expect(packets[3].type).toBe(PACKET_TYPES.CALIB_WHITE);
      expect(packets[3].data.channels.length).toBe(18);
      expect(packets[3].data.channels[0]).toBe(604);

      // WHITE prompt with Ready? Y/N: emits DEVICE_PROMPT with READY_WHITE
      accumulator.pushChunk('WHITE: put the white tile where the leaf goes. LED turns ON.\r\nUse the same enclosure and distance as for the leaf.\r\nReady? Y/N: ');
      expect(packets.some(p => p.type === PACKET_TYPES.DEVICE_PROMPT && p.data.promptKey === 'READY_WHITE')).toBe(true);
      expect(packets[packets.length - 1].type).toBe(PACKET_TYPES.DEVICE_PROMPT);
      expect(packets[packets.length - 1].data.promptKey).toBe('READY_WHITE');

      // Calibration done lines: DARK : done, DARK done, WHITE : done, WHITE done
      accumulator.pushChunk('DARK : done\n');
      expect(packets[packets.length - 1].type).toBe(PACKET_TYPES.CALIB_DARK);
      expect(packets[packets.length - 1].data.status).toBe('DONE');

      accumulator.pushChunk('DARK done\n');
      expect(packets[packets.length - 1].type).toBe(PACKET_TYPES.CALIB_DARK);
      expect(packets[packets.length - 1].data.status).toBe('DONE');

      accumulator.pushChunk('WHITE : done\n');
      expect(packets[packets.length - 1].type).toBe(PACKET_TYPES.CALIB_WHITE);
      expect(packets[packets.length - 1].data.status).toBe('DONE');

      accumulator.pushChunk('WHITE done\n');
      expect(packets[packets.length - 1].type).toBe(PACKET_TYPES.CALIB_WHITE);
      expect(packets[packets.length - 1].data.status).toBe('DONE');
    });
  });

  describe('STM32 Spectroscope Two-Way BLE Protocol, ACK Verification & Diagnostics', () => {
    it('enforces strict operating mode separation (REAL_HARDWARE vs SIMULATION)', () => {
      const device = new LeafClipBluetoothDevice();
      expect(device.operatingMode).toBe(OPERATING_MODES.REAL_HARDWARE);
      expect(device.isSimulated).toBe(false);

      device.setOperatingMode(OPERATING_MODES.SIMULATION);
      expect(device.operatingMode).toBe(OPERATING_MODES.SIMULATION);
      expect(device.isSimulated).toBe(true);

      device.setOperatingMode(OPERATING_MODES.REAL_HARDWARE);
      expect(device.operatingMode).toBe(OPERATING_MODES.REAL_HARDWARE);
      expect(device.isSimulated).toBe(false);
    });

    it('throws explicitly on write errors in sendRaw and sendCommand rather than swallowing', async () => {
      const device = new LeafClipBluetoothDevice();
      device.isConnected = true;
      device.rxCharacteristic = {
        writeValueWithoutResponse: async () => {
          throw new Error('GATT write failure: Connection supervised timeout');
        }
      };

      let threw = false;
      try {
        await device.sendRaw('HELLO\r\n');
      } catch (err) {
        threw = true;
        expect(err.message).toBeDefined();
      }
      expect(threw).toBe(true);
    });

    it('parses protocol ACK for HELLO, LED_ON, LED_OFF, and SET_METADATA', async () => {
      const device = new LeafClipBluetoothDevice();
      device.isConnected = true;

      // Simulate asynchronous ACK arrival
      setTimeout(() => {
        device.accumulator.pushChunk('$ACK:HELLO,DEVICE=B-L475E-IOT01A2,FW=2.1.0\r\n');
      }, 30);

      const ackHello = await device.accumulator.waitForAck('HELLO', 1000);
      expect(ackHello).toBeDefined();
      expect(ackHello.data.command).toBe('HELLO');
      expect(ackHello.data.device).toBe('B-L475E-IOT01A2');
      expect(ackHello.data.fw).toBe('2.1.0');

      // LED_ON ACK
      setTimeout(() => {
        device.accumulator.pushChunk('$ACK:LED_ON,STATUS=ON,GATE=PB0\r\n');
      }, 30);
      const ackLed = await device.accumulator.waitForAck('LED_ON', 1000);
      expect(ackLed.data.status).toBe('ON');

      // LED_OFF ACK
      setTimeout(() => {
        device.accumulator.pushChunk('$ACK:LED_OFF,STATUS=OFF\r\n');
      }, 30);
      const ackLedOff = await device.accumulator.waitForAck('LED_OFF', 1000);
      expect(ackLedOff.data.status).toBe('OFF');
    });

    it('provides comprehensive hardware diagnostics telemetry via getDiagnostics', () => {
      const device = new LeafClipBluetoothDevice();
      device.isConnected = true;
      device.deviceInfo.id = 'ST-BLE-475';
      device.deviceInfo.model = 'B-L475E-IOT01A2';
      device.ledStatus = 'OFF';

      const diag = device.getDiagnostics();
      expect(diag.isConnected).toBe(true);
      expect(diag.operatingMode).toBe(OPERATING_MODES.REAL_HARDWARE);
      expect(diag.deviceName).toBe('B-L475E-IOT01A2');
      expect(diag.ledStatus).toBe('OFF');
      expect(diag.calibration).toBeDefined();
    });

    it('failsafe shuts off illumination LED on scan completion', async () => {
      const device = new LeafClipBluetoothDevice();
      device.isConnected = true;
      device.isSimulated = false; // Physical mode

      let ledOffCalled = false;
      const origOff = device.turnLedOff.bind(device);
      device.turnLedOff = async () => {
        ledOffCalled = true;
        return origOff();
      };

      setTimeout(() => {
        const counts = Array.from({ length: 76 }, (_, i) => 20000 + i * 50);
        device.accumulator.pushChunk(`$SPEC,76,${counts.join(',')}\r\n`);
      }, 50);

      await device.triggerLeafMeasurement({ plotNumber: 1, cropName: 'Tomato' });
      expect(ledOffCalled).toBe(true);
      expect(device.ledStatus).toBe('OFF');
    });

    describe('Single-Batch Metadata & Direct Scan Triggers (Zero Step-by-Step Prompt Inquiries)', () => {
      it('setSpecimenBatchData transmits unified wire format and legacy UART lines on both adapters', async () => {
        const device = new LeafClipBluetoothDevice();
        await device.connect({ forceSimulation: true });

        const res = await device.setSpecimenBatchData({
          plantName: 'San Marzano',
          plantNumber: 'PLANT-500',
          potNumber: 'POT-10',
          leafSpot: 3,
          zone: 'Zone 4'
        });

        expect(res.success).toBe(true);
        expect(res.wireCommand).toBe('SET_METADATA PLANT=PLANT-500,NAME=San Marzano,POT=POT-10,SPOT=3,ZONE=Zone 4');
        expect(device.specimenMetadata.plantNumber).toBe('PLANT-500');
        expect(device.specimenMetadata.plantName).toBe('San Marzano');
        expect(device.specimenMetadata.potNumber).toBe('POT-10');
        expect(device.specimenMetadata.leafSpot).toBe(3);
        expect(device.specimenMetadata.zone).toBe('Zone 4');

        expect(device.sentCommandsHistory).toContain('SET_METADATA PLANT=PLANT-500,NAME=San Marzano,POT=POT-10,SPOT=3,ZONE=Zone 4\r\n');
        expect(device.sentCommandsHistory).toContain('PLANT-500\r\n');
        expect(device.sentCommandsHistory).toContain('San Marzano\r\n');
        expect(device.sentCommandsHistory).toContain('POT-10\r\n');
        expect(device.sentCommandsHistory).toContain('3\r\n');
        expect(device.sentCommandsHistory).toContain('Y\r\n');

        const spectrometer = new SpectrometerUSBAdapter();
        await spectrometer.connect({ forceSimulation: true });
        const usbRes = await spectrometer.setSpecimenBatchData({
          plantName: 'Bell Pepper',
          plantNumber: 'PLANT-600',
          potNumber: 'POT-20',
          leafSpot: 2,
          zone: 'Zone 1'
        });
        expect(usbRes.success).toBe(true);
        expect(spectrometer.specimenMetadata.leafSpot).toBe(2);
        expect(spectrometer.specimenMetadata.plantNumber).toBe('PLANT-600');
      });

      it('executes calibrateDarkCurrent, calibrateWhiteReference, and acquireLeafScan directly without dialogue turns', async () => {
        const device = new LeafClipBluetoothDevice();
        await device.connect({ forceSimulation: true });

        let readyEmitted = false;
        device.on('hardwareReadyForScan', () => { readyEmitted = true; });

        const dark = await device.calibrateDarkCurrent();
        expect(dark.success).toBe(true);
        expect(device.calibration.darkCurrentCompleted).toBe(true);

        const white = await device.calibrateWhiteReference();
        expect(white.success).toBe(true);
        expect(device.calibration.whiteDiscCompleted).toBe(true);
        expect(readyEmitted).toBe(true);

        const scan = await device.acquireLeafScan();
        expect(scan.status).toBe('OK');
        expect(Array.isArray(scan.reflectance)).toBe(true);

        const usb = new SpectrometerUSBAdapter();
        await usb.connect({ forceSimulation: true });
        const usbDark = await usb.calibrateDarkCurrent();
        expect(usbDark.success).toBe(true);
        const usbWhite = await usb.calibrateWhiteReference();
        expect(usbWhite.success).toBe(true);
        const usbScan = await usb.acquireLeafScan();
        expect(usbScan.status).toBe('OK');
      });

      it('auto-acknowledges all background firmware prompts without halting execution', async () => {
        const device = new LeafClipBluetoothDevice();
        await device.connect({ forceSimulation: true });
        device.autoResponderEnabled = true;
        device.specimenMetadata.leafSpot = 5;
        device.darkCalibPending = true;
        device.whiteCalibPending = true;
        device.leafScanPending = true;

        const answered = [];
        device.on('dialoguePrompt', p => answered.push(p));

        device.accumulator.pushChunk('Ready for DARK measurement? Y/N: ');
        device.accumulator.pushChunk('Save DARK? Y/N: ');
        device.accumulator.pushChunk('Ready for WHITE measurement? Y/N: ');
        device.accumulator.pushChunk('Save WHITE? Y/N: ');
        device.accumulator.pushChunk('Ready for leaf scan? Y/N: ');
        device.accumulator.pushChunk('Enter Spot Number (1..): ');
        device.accumulator.pushChunk('Scan another spot? Y/N: ');
        device.accumulator.pushChunk('Drift check... Do it now? Y/N: ');

        expect(answered.some(a => a.prompt === 'DARK_READY' && a.response === 'Y\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'SAVE_DARK' && a.response === 'Y\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'WHITE_READY' && a.response === 'Y\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'SAVE_WHITE' && a.response === 'Y\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'LEAF_SCAN_READY' && a.response === 'Y\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'LEAF_SPOT_NUMBER' && a.response === '5\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'SCAN_ANOTHER_SPOT' && a.response === 'N\r\n')).toBe(true);
        expect(answered.some(a => a.prompt === 'DRIFT_CHECK' && a.response === 'N\r\n')).toBe(true);
      });
    });
  });
}
