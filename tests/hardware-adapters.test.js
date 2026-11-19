/**
 * Automated Verification Suite for Modular Hardware Device Adapters
 * Tests:
 *   1. LABART 8-in-1 Soil Tester USB/BLE/Cloud driver & Modbus RTU CRC-16
 *   2. Portable Spectrometer USB/BLE/Cloud adapter & PTFE calibration & feature extraction
 *   3. Dual-Source Temperature & Humidity sensor with Open-Meteo fallback & VPD
 *   4. Drip Irrigation Controller multi-valve latching, Hall flow meter & failsafes
 *   5. Unified Device Manager coordination, lifecycle, closed-loop synergy & audit export
 */

import { describe, it, expect } from './framework.js';
import {
  labartSoilSensorUSB,
  LabartSoilSensorUSB,
  CONNECTION_MODES as SOIL_MODES,
  calculateCRC16Modbus,
  buildModbusReadRequest,
  parseModbusResponse,
  interpretSoilReading,
  CROP_THRESHOLDS
} from '../src/hardware/labartSoilSensorUSB.js';

import {
  spectrometerUSBAdapter,
  SpectrometerUSBAdapter,
  CONNECTION_MODES as SPEC_MODES,
  SPECTROMETER_CONFIG
} from '../src/hardware/spectrometerUSBAdapter.js';

import {
  tempHumiditySensorUSB,
  TempHumiditySensorUSB,
  CONNECTION_MODES as TEMP_MODES,
  DATA_SOURCES,
  ALERT_TYPES,
  calculateVaporPressureDeficit,
  calculateDewPoint,
  calculateHeatIndex,
  assessMicroclimateAlerts
} from '../src/hardware/tempHumiditySensorUSB.js';

import {
  irrigationControllerAdapter,
  IrrigationControllerAdapter,
  CONNECTION_MODES as IRRIG_MODES,
  VALVE_STATES,
  SAFETY_ALERTS
} from '../src/hardware/irrigationControllerAdapter.js';

import {
  deviceManager,
  DeviceManager,
  DEVICE_NAMES
} from '../src/hardware/deviceManager.js';

export function registerHardwareAdapterTests() {
  // =========================================================================
  // SUITE 1: LABART 8-in-1 Soil Tester & Modbus RTU Communication
  // =========================================================================
  describe('LABART 8-in-1 Soil Tester - Modbus RTU & Protocol Engine', () => {
    it('calculates accurate CRC-16 Modbus checksums against standard test frames', () => {
      // Standard Modbus test vector: Slave 0x01, Function 0x03, Start 0x0000, Count 0x0008
      const testBuffer = new Uint8Array([0x01, 0x03, 0x00, 0x00, 0x00, 0x08]);
      const crc = calculateCRC16Modbus(testBuffer);
      
      // Expected CRC for 01 03 00 00 00 08 is 0x440C (Low byte: 0x44, High byte: 0x0C)
      expect(crc & 0xFF).toBe(0x44);
      expect((crc >> 8) & 0xFF).toBe(0x0C);
    });

    it('builds valid Modbus RTU read request frames with correct CRC bytes', () => {
      const frame = buildModbusReadRequest(0x01, 0x0000, 0x0008);
      expect(frame.length).toBe(8);
      expect(frame[0]).toBe(0x01); // Slave
      expect(frame[1]).toBe(0x03); // Read Holding Registers
      expect(frame[2]).toBe(0x00); // Start Hi
      expect(frame[3]).toBe(0x00); // Start Lo
      expect(frame[4]).toBe(0x00); // Qty Hi
      expect(frame[5]).toBe(0x08); // Qty Lo
      expect(frame[6]).toBe(0x44); // CRC Lo
      expect(frame[7]).toBe(0x0C); // CRC Hi
    });

    it('parses valid Modbus RTU response frame into all 8 agricultural parameters', () => {
      // Synthetic 21-byte frame:
      // Moisture=28.5% (285), Temp=24.2°C (242), EC=1250, pH=6.80 (680), N=75, P=22, K=190, Fertility=850
      const frame = new Uint8Array(21);
      frame[0] = 0x01; // Slave
      frame[1] = 0x03; // Function
      frame[2] = 0x10; // Byte Count (16 bytes)
      const view = new DataView(frame.buffer, 3, 16);
      view.setUint16(0, 285, false);  // Moisture: 28.5%
      view.setInt16(2, 242, false);   // Temp: 24.2°C
      view.setUint16(4, 1250, false); // EC: 1250 µS/cm
      view.setUint16(6, 680, false);  // pH: 6.80
      view.setUint16(8, 75, false);   // N: 75 mg/kg
      view.setUint16(10, 22, false);  // P: 22 mg/kg
      view.setUint16(12, 190, false); // K: 190 mg/kg
      view.setUint16(14, 850, false); // Fertility: 850 mg/kg

      const crc = calculateCRC16Modbus(frame.subarray(0, 19));
      frame[19] = crc & 0xFF;
      frame[20] = (crc >> 8) & 0xFF;

      const result = parseModbusResponse(frame);
      expect(result.success).toBe(true);
      expect(result.data.moistureVwc).toBe(28.5);
      expect(result.data.temperatureC).toBe(24.2);
      expect(result.data.ecUsCm).toBe(1250);
      expect(result.data.ph).toBe(6.8);
      expect(result.data.nitrogenMgKg).toBe(75);
      expect(result.data.phosphorusMgKg).toBe(22);
      expect(result.data.potassiumMgKg).toBe(190);
      expect(result.data.fertilityMgKg).toBe(850);
    });

    it('rejects corrupted Modbus frames with CRC checksum error', () => {
      const corruptFrame = new Uint8Array([0x01, 0x03, 0x04, 0x01, 0x02, 0x03, 0x04, 0xEE, 0xFF]);
      const result = parseModbusResponse(corruptFrame);
      expect(result.success).toBe(false);
      expect(result.error).toBe('CRC_CHECKSUM_ERROR');
    });

    it('computes farmer-friendly interpretations with crop-specific threshold overrides', () => {
      const sampleSoil = {
        temperatureC: 22.0,
        moistureVwc: 15.0, // Low for Potato
        ecUsCm: 1100,
        ph: 5.4,           // Ideal for Potato, but acidic for general crops
        nitrogenMgKg: 35,  // Low
        phosphorusMgKg: 14,// Low
        potassiumMgKg: 120,// Low for Potato (needs 150-450)
        fertilityMgKg: 450
      };

      // 1. General Crop Interpretation
      const generalInterp = interpretSoilReading(sampleSoil, 'DEFAULT');
      expect(generalInterp.moisture.status).toBe('DRY');
      expect(generalInterp.npk.nitrogen.status).toBe('LOW');
      expect(generalInterp.fertility.rating).toBe('POOR');

      // 2. Potato-Specific Thresholds Override
      const potatoInterp = interpretSoilReading(sampleSoil, 'POTATO');
      expect(potatoInterp.cropTarget).toBe('Potato');
      expect(potatoInterp.ph.status).toBe('OPTIMAL_NEUTRAL'); // 5.4 is optimal for potato (5.2 - 6.5)
      expect(potatoInterp.npk.potassium.status).toBe('LOW');
    });

    it('seamlessly connects in USB_TYPE_C, BLUETOOTH_BLE, and WIFI_CLOUD modes with dynamic soil drift', async () => {
      const sensor = new LabartSoilSensorUSB();

      // Test USB Mode
      const usbRes = await sensor.connect({ mode: SOIL_MODES.USB_TYPE_C, forceSimulation: true });
      expect(usbRes.success).toBe(true);
      expect(sensor.connectionMode).toBe(SOIL_MODES.USB_TYPE_C);

      const readingUsb = await sensor.readData({ cropKey: 'BELL_PEPPER' });
      expect(readingUsb.status).toBe('OK');
      expect(readingUsb.source).toBe(SOIL_MODES.USB_TYPE_C);
      expect(readingUsb.raw.moisture_vwc).toBeDefined();
      expect(readingUsb.raw.ph).toBeDefined();

      // Test BLE Mode
      const bleRes = await sensor.connect({ mode: SOIL_MODES.BLUETOOTH_BLE, forceSimulation: true });
      expect(bleRes.success).toBe(true);
      expect(sensor.connectionMode).toBe(SOIL_MODES.BLUETOOTH_BLE);

      // Test Dynamic Drift under Rain Mode
      sensor.setDriftMode('RAIN');
      const readingRain = await sensor.readData();
      expect(readingRain.raw.moisture_vwc).toBeGreaterThan(25.0);

      await sensor.disconnect();
      expect(sensor.isConnected).toBe(false);
    });

    it('seamlessly auto-detects available connection interfaces and falls back without user intervention', async () => {
      const sensor = new LabartSoilSensorUSB();
      const autoRes = await sensor.autoDetectAndConnect();
      expect(autoRes.success).toBe(true);
      expect(sensor.isConnected).toBe(true);
      expect(autoRes.autoDetected).toBe(true);

      const reading = await sensor.readData();
      expect(reading.status).toBe('OK');
      expect(reading.raw.moisture_vwc).toBeDefined();

      // Test setConnectionMode
      sensor.setConnectionMode(SOIL_MODES.WIFI_CLOUD);
      expect(sensor.connectionMode).toBe(SOIL_MODES.WIFI_CLOUD);

      await sensor.disconnect();
    });
  });

  // =========================================================================
  // SUITE 2: Portable USB-C Spectrometer & Feature Extraction
  // =========================================================================
  describe('Spectrometer USB/BLE/Cloud Adapter & PTFE Calibration Engine', () => {
    it('executes dark current baseline and 99% PTFE white disc calibration', async () => {
      const spectrometer = new SpectrometerUSBAdapter();
      await spectrometer.connect({ mode: SPEC_MODES.USB_TYPE_C, forceSimulation: true });

      const darkReport = await spectrometer.calibrateDarkCurrent();
      expect(darkReport.success).toBe(true);
      expect(darkReport.quality).toBe('OPTIMAL');

      const whiteReport = await spectrometer.calibrateWhiteReference();
      expect(whiteReport.success).toBe(true);
      expect(whiteReport.quality).toBe('OPTIMAL');
      expect(spectrometer.calibration.isCalibrated).toBe(true);
    });

    it('computes standardized reflectance R = (Sample - Dark) / (White - Dark) strictly within [0.0, 1.0]', () => {
      const spectrometer = new SpectrometerUSBAdapter();
      const bands = SPECTROMETER_CONFIG.TOTAL_BANDS;
      const dark = spectrometer.calibration.darkCurrent;
      const white = spectrometer.calibration.whiteReference;

      // Create synthetic sample counts at 50% reflectance
      const sample = new Float64Array(bands);
      for (let i = 0; i < bands; i++) {
        sample[i] = dark[i] + 0.5 * (white[i] - dark[i]);
      }

      const reflectance = spectrometer.computeReflectance(sample);
      expect(reflectance.length).toBe(bands);
      for (const r of reflectance) {
        expect(r).toBeCloseTo(0.5, 0.05);
      }
    });

    it('preserves raw spectral intensities and extracts NDVI, NDRE, LWI, and 970nm water band', async () => {
      const spectrometer = new SpectrometerUSBAdapter();
      await spectrometer.connect({ mode: SPEC_MODES.USB_TYPE_C, forceSimulation: true });

      const scan = await spectrometer.captureSpectrum({
        cropName: 'Bell Peppers',
        growthStage: 'Fruit Formation',
        simulatedParams: { vitality: 88, waterContent: 0.90, nitrogenLevel: 0.85 }
      });

      expect(scan.status).toBe('OK');
      expect(scan.raw.rawSample).toBeDefined();
      expect(scan.raw.rawSample.length).toBe(76);
      expect(scan.raw.darkReference.length).toBe(76);
      expect(scan.raw.whiteReference.length).toBe(76);

      // Feature verification
      expect(scan.features.ndvi).toBeGreaterThan(0.6);
      expect(scan.features.ndre).toBeGreaterThan(0.25);
      expect(scan.features.lwi).toBeGreaterThan(0.85);
      expect(scan.features.greenRedRatio).toBeGreaterThan(1.5);
      expect(scan.features.waterBand970Depth).toBeGreaterThanOrEqual(0);
      expect(scan.features.cire).toBeDefined();
      expect(scan.features.pri).toBeDefined();
      expect(scan.features.vitalityScore).toBeGreaterThan(70);

      await spectrometer.disconnect();
    });

    it('implements acquireSample with auto-connect, returning standardized reflectance, indices (NDVI, NDRE, LWI), chemometrics, and raw vectors', async () => {
      const spectrometer = new SpectrometerUSBAdapter();
      // Notice: acquireSample without calling connect first -> must auto-connect defensively
      const scan = await spectrometer.acquireSample({
        cropName: 'Tomato',
        growthStage: 'Fruit Ripening'
      });

      expect(spectrometer.isConnected).toBe(true);
      expect(scan.status).toBe('OK');
      expect(scan.reflectance).toBeDefined();
      expect(scan.reflectanceSpectrum).toBeDefined();
      expect(scan.indices).toBeDefined();
      expect(scan.indices.ndvi).toBeDefined();
      expect(scan.indices.ndre).toBeDefined();
      expect(scan.indices.lwi).toBeDefined();
      expect(scan.chemometrics).toBeDefined();
      expect(scan.chemometrics.vitalityScore).toBeDefined();
      expect(scan.chemometrics.chlorophyllIndex).toBeDefined();
      expect(scan.chemometrics.waterIndex).toBeDefined();
      expect(scan.chemometrics.nitrogenStatus).toBeDefined();
      expect(scan.rawVectors).toBeDefined();
      expect(scan.rawVectors.rawSample.length).toBe(76);

      // setConnectionMode
      spectrometer.setConnectionMode(SPEC_MODES.BLUETOOTH_BLE);
      expect(spectrometer.connectionMode).toBe(SPEC_MODES.BLUETOOTH_BLE);

      // getSpectralData
      const last = spectrometer.getSpectralData();
      expect(last).toBe(scan);

      await spectrometer.disconnect();
    });
  });

  // =========================================================================
  // SUITE 3: Dual-Source Temperature & Humidity Sensor
  // =========================================================================
  describe('Dual-Source Temperature & Humidity Sensor with Microclimate Alerts', () => {
    it('calculates Vapor Pressure Deficit (VPD), Dew Point, and Heat Index accurately', () => {
      const tempC = 25.0;
      const rh = 60.0;

      const vpd = calculateVaporPressureDeficit(tempC, rh);
      expect(vpd).toBeGreaterThan(1.0);
      expect(vpd).toBeLessThan(1.5);

      const dewPoint = calculateDewPoint(tempC, rh);
      expect(dewPoint).toBeGreaterThan(15.0);
      expect(dewPoint).toBeLessThan(18.0);

      const heatIndex = calculateHeatIndex(tempC, rh);
      expect(heatIndex).toBe(25.0); // Heat index equals dry bulb below 27°C
    });

    it('generates high temperature, frost, and fungal blight microclimate alerts', () => {
      // 1. Extreme Heat Alert (> 38°C)
      const heatAlerts = assessMicroclimateAlerts(39.5, 45, 2.5);
      expect(heatAlerts.some(a => a.type === ALERT_TYPES.HIGH_TEMPERATURE_STRESS)).toBe(true);

      // 2. Frost Warning (< 4°C)
      const frostAlerts = assessMicroclimateAlerts(2.5, 75, 0.2);
      expect(frostAlerts.some(a => a.type === ALERT_TYPES.LOW_TEMPERATURE_FROST)).toBe(true);

      // 3. Fungal Spore / Blight Humidity Alert (> 85%)
      const blightAlerts = assessMicroclimateAlerts(22.0, 92, 0.3);
      expect(blightAlerts.some(a => a.type === ALERT_TYPES.HIGH_HUMIDITY_BLIGHT_RISK)).toBe(true);
    });

    it('enforces dual-source hierarchy with explicit source labels: LIVE_PHYSICAL_SENSOR, ESTIMATED_WEATHER_API, LAST_CACHED_READING', async () => {
      const atmos = new TempHumiditySensorUSB();
      await atmos.connect({ mode: TEMP_MODES.USB_TYPE_C, forceSimulation: true });

      // Force source test: ESTIMATED_WEATHER_API
      const apiReading = await atmos.readData({ forceSource: DATA_SOURCES.ESTIMATED_WEATHER_API });
      expect(apiReading.source).toBe(DATA_SOURCES.ESTIMATED_WEATHER_API);
      expect(apiReading.temperatureCelsius).toBeDefined();
      expect(apiReading.humidityPercent).toBeDefined();

      // Force source test: LAST_CACHED_READING
      const cachedReading = await atmos.readData({ forceSource: DATA_SOURCES.LAST_CACHED_READING });
      expect(cachedReading.source).toBe(DATA_SOURCES.LAST_CACHED_READING);

      // Linked LABART Soil Sensor Thermal Pairing
      const soilSensor = new LabartSoilSensorUSB();
      await soilSensor.connect({ mode: SOIL_MODES.USB_TYPE_C, forceSimulation: true });
      await soilSensor.readData();

      atmos.linkSoilSensor(soilSensor);
      const pairedReading = await atmos.readData({ forceSource: DATA_SOURCES.LIVE_PHYSICAL_SENSOR });
      expect(pairedReading.source).toBe(DATA_SOURCES.LIVE_PHYSICAL_SENSOR);

      await atmos.disconnect();
      await soilSensor.disconnect();
    });

    it('provides getThresholds, setThresholds, and configureThresholds returning valid threshold objects', () => {
      const atmos = new TempHumiditySensorUSB();
      const initial = atmos.getThresholds();
      expect(initial.highTempC).toBe(35);
      expect(initial.lowTempC).toBe(5);
      expect(initial.highRhPercent).toBe(85);

      const updated = atmos.setThresholds({ highTempC: 36, lowTempC: 3, highRhPercent: 90 });
      expect(updated.highTempC).toBe(36);
      expect(updated.lowTempC).toBe(3);
      expect(updated.highRhPercent).toBe(90);

      const configured = atmos.configureThresholds({ highTempC: 37 });
      expect(configured.highTempC).toBe(37);
      expect(atmos.getThresholds().highTempC).toBe(37);

      // setConnectionMode
      atmos.setConnectionMode(TEMP_MODES.BLUETOOTH_BLE);
      expect(atmos.connectionMode).toBe(TEMP_MODES.BLUETOOTH_BLE);
    });
  });

  // =========================================================================
  // SUITE 4: Drip Irrigation Controller & Hydraulic Safety Failsafes
  // =========================================================================
  describe('Drip Irrigation Controller - Bi-Stable Actuation, Flow Meter & Failsafes', () => {
    it('registers unlimited independent valves and actuates with +12V open / -12V close pulses', async () => {
      const controller = new IrrigationControllerAdapter();
      controller.setMinOpenValves(0);
      await controller.connect({ mode: IRRIG_MODES.USB_TYPE_C, forceSimulation: true });

      // Register multiple custom valves dynamically
      const v1 = controller.registerValve({ id: 'V-ZONE-1', gateIdentifier: 'G1', nominalFlowRateLph: 450 });
      const v2 = controller.registerValve({ id: 'V-ZONE-2', gateIdentifier: 'G2', nominalFlowRateLph: 500 });
      const v3 = controller.registerValve({ id: 'V-ZONE-3', gateIdentifier: 'G3', nominalFlowRateLph: 380 });

      expect(controller.getAllValves().length).toBe(3);

      // Actuate OPEN with +12V pulse and 15 min timer
      const openRes = await controller.openValve('V-ZONE-1', { durationMinutes: 15 });
      expect(openRes.success).toBe(true);
      expect(controller.getValve('V-ZONE-1').state).toBe(VALVE_STATES.OPEN);
      expect(controller.telemetry.totalActiveFlowRateLph).toBeGreaterThan(0);

      // Actuate CLOSE with -12V reverse pulse
      const closeRes = await controller.closeValve('V-ZONE-1');
      expect(closeRes.success).toBe(true);
      expect(controller.getValve('V-ZONE-1').state).toBe(VALVE_STATES.CLOSED);
      expect(controller.telemetry.totalActiveFlowRateLph).toBe(0);
    });

    it('calculates instantaneous flow rate and total delivered volume from Hall pulse frequency', () => {
      const controller = new IrrigationControllerAdapter();
      controller.registerValve({
        id: 'FLOW-TEST-VALVE',
        gateIdentifier: 'G1',
        kFactor: 7.5,
        pulsesPerLiter: 450
      });

      const valve = controller.getValve('FLOW-TEST-VALVE');
      valve.state = VALVE_STATES.OPEN;
      valve.openSinceTimestamp = Date.now();

      // Feed 45 pulses over 1 second => Frequency = 45 Hz => Flow = 45 / 7.5 = 6.0 L/min (360 LPH)
      controller.recordFlowPulses('FLOW-TEST-VALVE', 45, 1.0);

      expect(valve.pulseFrequencyHz).toBe(45);
      expect(valve.currentFlowRateLpm).toBe(6.0);
      expect(valve.currentFlowRateLph).toBe(360.0);
      expect(valve.litersDeliveredSession).toBeCloseTo(0.1, 0.05); // 45 / 450 = 0.1 Liter
    });

    it('executes 1-tap Emergency All-Stop simultaneously across multiple open valves', async () => {
      const controller = new IrrigationControllerAdapter();
      controller.setMinOpenValves(0);
      await controller.connect({ mode: IRRIG_MODES.USB_TYPE_C, forceSimulation: true });

      controller.registerValve({ id: 'V-A', gateIdentifier: 'G1' });
      controller.registerValve({ id: 'V-B', gateIdentifier: 'G2' });
      controller.registerValve({ id: 'V-C', gateIdentifier: 'G3' });

      await controller.openValve('V-A');
      await controller.openValve('V-B');
      expect(controller.getStatus().openValvesCount).toBe(2);

      // Execute 1-Tap Emergency All-Stop
      const stopReport = await controller.emergencyAllStop('MANUAL_TEST_KILLSWITCH');
      expect(stopReport.success).toBe(true);
      expect(stopReport.closedCount).toBe(2);
      expect(controller.getStatus().openValvesCount).toBe(0);
      expect(controller.getActiveAlerts().some(a => a.type === SAFETY_ALERTS.EMERGENCY_STOP_TRIGGERED)).toBe(true);
    });

    it('detects zero-flow anomaly when valve is open with no water flow', () => {
      const controller = new IrrigationControllerAdapter();
      controller.registerValve({ id: 'DRY-PUMP-VALVE', gateIdentifier: 'G4' });

      const valve = controller.getValve('DRY-PUMP-VALVE');
      valve.state = VALVE_STATES.OPEN;
      // Simulate open for 30 seconds (greater than grace period of 25s)
      valve.openSinceTimestamp = Date.now() - 30000;

      // 0 pulses recorded
      controller.recordFlowPulses('DRY-PUMP-VALVE', 0, 1.0);

      expect(controller.getActiveAlerts().some(a => a.type === SAFETY_ALERTS.ZERO_FLOW_ANOMALY)).toBe(true);
      expect(valve.state).toBe(VALVE_STATES.FAULT); // Auto-isolated into FAULT state
      expect(valve.faultReason).toBe('ZERO_FLOW_ANOMALY');
    });

    it('supports registerSchedule, getSchedules, deleteSchedule, and getTelemetry with defensive backwards compatibility', () => {
      const controller = new IrrigationControllerAdapter();
      controller.registerValve({ id: 'V-SCHED-1', gateIdentifier: 'G1' });

      // Register schedule
      const sched = controller.registerSchedule('V-SCHED-1', {
        slotName: 'Morning Root Hydration',
        startTime: '05:30',
        endTime: '06:15',
        activeDays: [1, 2, 3, 4, 5],
        targetVolumeLiters: 350,
        flowLimitLpm: 12.0,
        enabled: true
      });

      expect(sched).toBeDefined();
      expect(sched.slotName).toBe('Morning Root Hydration');
      expect(sched.durationMinutes).toBe(45); // 05:30 to 06:15 = 45 mins calculated
      expect(sched.activeDays.length).toBe(5);

      // getSchedules for specific valve
      const valveSchedules = controller.getSchedules('V-SCHED-1');
      expect(valveSchedules.length).toBe(1);
      expect(valveSchedules[0].id).toBe(sched.id);

      // getTelemetry
      const telemetry = controller.getTelemetry();
      expect(telemetry.mainlinePressureBar).toBeDefined();
      expect(telemetry.totalActiveFlowRateLph).toBe(0);

      // deleteSchedule
      const deleted = controller.deleteSchedule('V-SCHED-1', sched.id);
      expect(deleted).toBe(true);
      expect(controller.getSchedules('V-SCHED-1').length).toBe(0);

      // setConnectionMode
      controller.setConnectionMode(IRRIG_MODES.WIFI_CLOUD);
      expect(controller.connectionMode).toBe(IRRIG_MODES.WIFI_CLOUD);
    });
  });

  // =========================================================================
  // SUITE 5: Unified Device Manager & Closed-Loop Synergy
  // =========================================================================
  describe('Unified Device Manager - Lifecycle Coordination, Closed-Loop & Audit Export', () => {
    it('coordinates lifecycle connectAll and disconnectAll across all 4 adapters', async () => {
      const manager = new DeviceManager();

      const connectResults = await manager.connectAll({ forceSimulation: true });
      expect(connectResults.soil_sensor.success).toBe(true);
      expect(connectResults.spectrometer.success).toBe(true);
      expect(connectResults.temp_humidity.success).toBe(true);
      expect(connectResults.irrigation.success).toBe(true);

      const statuses = manager.getStatus();
      expect(statuses.soilSensor.connected).toBe(true);
      expect(statuses.spectrometer.connected).toBe(true);
      expect(statuses.tempHumidity.connected).toBe(true);
      expect(statuses.irrigation.connected).toBe(true);

      await manager.disconnectAll();
      const afterDisconnect = manager.getStatus();
      expect(afterDisconnect.soilSensor.connected).toBe(false);
      expect(afterDisconnect.spectrometer.connected).toBe(false);
    });

    it('evaluates closed-loop synergy between Spectrometer leaf water index and LABART soil moisture', () => {
      const manager = new DeviceManager();

      // Case 1: Concordant Dehydration (Low LWI + Low Soil VWC) -> Triggers Irrigation
      const spectroStressed = { features: { lwi: 0.81, ndre: 0.24 } };
      const soilDry = { raw: { moisture_vwc: 14.5, nitrogen_mg_kg: 35 } };

      const synergy1 = manager.evaluateClosedLoopSynergy(spectroStressed, soilDry);
      expect(synergy1.recommendation.action).toBe('RECOMMEND_IRRIGATION');
      expect(synergy1.recommendation.urgency).toBe('HIGH');
      expect(synergy1.recommendation.suggestedValveDurationMinutes).toBe(25);
      expect(synergy1.nitrogenConcordance.status).toBe('CONCORDANT_DEFICIENCY');

      // Case 2: Discordant Stress (Low LWI but Saturated Soil VWC) -> Triggers Vascular Inspection
      const soilWet = { raw: { moisture_vwc: 32.0, nitrogen_mg_kg: 95 } };
      const synergy2 = manager.evaluateClosedLoopSynergy(spectroStressed, soilWet);
      expect(synergy2.recommendation.action).toBe('INSPECT_VASCULAR_HEALTH');
      expect(synergy2.recommendation.suggestedValveDurationMinutes).toBe(0);
    });

    it('exports comprehensive hardware audit logs in valid JSON and CSV formats', async () => {
      const manager = new DeviceManager();
      await manager.connectAll({ forceSimulation: true });

      // Trigger some events
      await manager.soilSensor.readData();
      await manager.irrigation.registerValve({ id: 'AUDIT-VALVE', gateIdentifier: 'G1' });
      await manager.irrigation.openValve('AUDIT-VALVE', { durationMinutes: 10 });
      await manager.irrigation.closeValve('AUDIT-VALVE');

      // JSON Export
      const jsonAudit = manager.exportAudit('json');
      const parsedJson = JSON.parse(jsonAudit);
      expect(parsedJson.auditTrail).toBeDefined();
      expect(parsedJson.auditTrail.length).toBeGreaterThan(0);

      // CSV Export
      const csvAudit = manager.exportAudit('csv');
      expect(csvAudit.includes('Timestamp,Source,EventType,Details')).toBe(true);
      expect(csvAudit.includes('VALVE_STATE_TRANSITION')).toBe(true);

      await manager.disconnectAll();
    });

    it('supports autoDetectAndConnect and unified readData with acquireSample delegation', async () => {
      const manager = new DeviceManager();
      const autoRes = await manager.autoDetectAndConnect();
      expect(autoRes.soil_sensor.success).toBe(true);

      const spectroData = await manager.readData(DEVICE_NAMES.SPECTROMETER);
      expect(spectroData.status).toBe('OK');
      expect(spectroData.indices.ndvi).toBeDefined();

      const irrigData = await manager.readData(DEVICE_NAMES.IRRIGATION);
      expect(irrigData.telemetry.mainlinePressureBar).toBeDefined();

      await manager.disconnectAll();
    });
  });
}
