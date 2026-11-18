/**
 * Unified Hardware Device Manager & Factory Coordinator
 * Coordinates all 4 independent agricultural hardware adapters:
 *   1. labartSoilSensor: LABART Professional 8-in-1 Soil Tester (USB-C OTG / BLE / Wi-Fi Cloud)
 *   2. spectrometer: Portable VIS-NIR Leaf Spectrometer (350–1100 nm)
 *   3. tempHumiditySensor: Dual-Source AtmosThermo Microclimate Sensor & Weather API
 *   4. irrigationController: Multi-Gate DC Latching Solenoid & Hall-Effect Flow Gateway
 * 
 * Supports Multi-Modal Connection Modes:
 *   - 'USB_TYPE_C' | 'BLUETOOTH_BLE' | 'WIFI_CLOUD'
 * 
 * Unified Lifecycle Methods:
 *   - connect(deviceName, options) / connectAll(options)
 *   - disconnect(deviceName) / disconnectAll()
 *   - getStatus(deviceName) / getAllStatuses()
 *   - readData(deviceName, options) / readAllData(options)
 *   - exportAudit(format = 'json' | 'csv')
 * 
 * Cross-Device Synergy:
 *   - Pairs LABART probe thermal sensor with atmospheric sensor
 *   - Closed-loop leaf-water tension to root-zone moisture synergy
 */

import { labartSoilSensorUSB, LabartSoilSensorUSB, CONNECTION_MODES as SOIL_MODES } from './labartSoilSensorUSB.js';
import { spectrometerUSBAdapter, SpectrometerUSBAdapter, CONNECTION_MODES as SPEC_MODES } from './spectrometerUSBAdapter.js';
import { tempHumiditySensorUSB, TempHumiditySensorUSB, CONNECTION_MODES as TEMP_MODES, DATA_SOURCES } from './tempHumiditySensorUSB.js';
import { irrigationControllerAdapter, IrrigationControllerAdapter, CONNECTION_MODES as IRRIG_MODES, VALVE_STATES } from './irrigationControllerAdapter.js';

export const DEVICE_NAMES = {
  SOIL_SENSOR: 'soil_sensor',
  SPECTROMETER: 'spectrometer',
  TEMP_HUMIDITY: 'temp_humidity',
  IRRIGATION: 'irrigation'
};

export const CONNECTION_MODES = {
  USB_TYPE_C: 'USB_TYPE_C',
  BLUETOOTH_BLE: 'BLUETOOTH_BLE',
  WIFI_CLOUD: 'WIFI_CLOUD'
};

export class DeviceManager {
  constructor(options = {}) {
    // Instantiate or accept adapter instances
    this.soilSensor = options.soilSensor || labartSoilSensorUSB;
    this.spectrometer = options.spectrometer || spectrometerUSBAdapter;
    this.tempHumidity = options.tempHumidity || tempHumiditySensorUSB;
    this.irrigation = options.irrigation || irrigationControllerAdapter;

    // Cross-link soil sensor to tempHumidity adapter for thermal pairing
    if (this.tempHumidity && this.tempHumidity.linkSoilSensor) {
      this.tempHumidity.linkSoilSensor(this.soilSensor);
    }

    // Global unified audit & telemetry ledger
    this.auditLedger = [];
    this.listeners = new Map();

    // Wire internal events from children to manager emitter
    this._attachChildListeners();
  }

  _attachChildListeners() {
    this.soilSensor.on('statusChange', (data) => this._relayEvent('soil_sensor:statusChange', data));
    this.soilSensor.on('data', (data) => {
      this._recordAudit('SOIL_TELEMETRY_INGESTION', { vwc: data.raw?.moisture_vwc, ph: data.raw?.ph, ec: data.raw?.ec_us_cm });
      this._relayEvent('soil_sensor:data', data);
    });
    this.soilSensor.on('error', (err) => this._relayEvent('soil_sensor:error', err));

    this.spectrometer.on('statusChange', (data) => this._relayEvent('spectrometer:statusChange', data));
    this.spectrometer.on('scan', (data) => {
      this._recordAudit('SPECTROMETER_SCAN_CAPTURED', { ndvi: data.features?.ndvi, ndre: data.features?.ndre, lwi: data.features?.lwi });
      this._relayEvent('spectrometer:scan', data);
    });

    this.tempHumidity.on('statusChange', (data) => this._relayEvent('temp_humidity:statusChange', data));
    this.tempHumidity.on('data', (data) => {
      this._relayEvent('temp_humidity:data', data);
    });

    this.irrigation.on('statusChange', (data) => this._relayEvent('irrigation:statusChange', data));
    this.irrigation.on('valveStateChange', (data) => {
      this._recordAudit('VALVE_STATE_TRANSITION', { valveId: data.valveId, state: data.state, liters: data.deliveredLiters });
      this._relayEvent('irrigation:valveStateChange', data);
    });
    this.irrigation.on('safetyAlert', (data) => {
      this._recordAudit('SAFETY_ALERT_TRIGGERED', data);
      this._relayEvent('irrigation:safetyAlert', data);
    });
    this.irrigation.on('emergencyStop', (data) => {
      this._recordAudit('EMERGENCY_ALL_STOP', data);
      this._relayEvent('irrigation:emergencyStop', data);
    });
  }

  _relayEvent(eventName, payload) {
    this.emit(eventName, payload);
    this.emit('deviceEvent', { event: eventName, data: payload, timestamp: new Date().toISOString() });
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(cb => cb !== callback));
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[DeviceManager Event: ${event}]`, e); }
      });
    }
  }

  /**
   * Connect a specific device by name
   * @param {string} deviceName - 'soil_sensor' | 'spectrometer' | 'temp_humidity' | 'irrigation'
   * @param {object} options
   */
  async connect(deviceName, options = {}) {
    const mode = options.mode || CONNECTION_MODES.USB_TYPE_C;
    switch (deviceName) {
      case DEVICE_NAMES.SOIL_SENSOR:
        return await this.soilSensor.connect({ mode, ...options });
      case DEVICE_NAMES.SPECTROMETER:
        return await this.spectrometer.connect({ mode, ...options });
      case DEVICE_NAMES.TEMP_HUMIDITY:
        return await this.tempHumidity.connect({ mode, ...options });
      case DEVICE_NAMES.IRRIGATION:
        return await this.irrigation.connect({ mode, ...options });
      default:
        throw new Error(`Unknown device name: ${deviceName}`);
    }
  }

  /**
   * Connect all 4 hardware adapters simultaneously
   * @param {object} options
   * @param {'USB_TYPE_C'|'BLUETOOTH_BLE'|'WIFI_CLOUD'} options.mode
   * @param {boolean} options.forceSimulation
   */
  async connectAll(options = {}) {
    const mode = options.mode || CONNECTION_MODES.USB_TYPE_C;
    const results = {};

    const tasks = [
      { name: DEVICE_NAMES.SOIL_SENSOR, promise: this.soilSensor.connect({ mode, ...options }) },
      { name: DEVICE_NAMES.SPECTROMETER, promise: this.spectrometer.connect({ mode, ...options }) },
      { name: DEVICE_NAMES.TEMP_HUMIDITY, promise: this.tempHumidity.connect({ mode, ...options }) },
      { name: DEVICE_NAMES.IRRIGATION, promise: this.irrigation.connect({ mode, ...options }) }
    ];

    for (const t of tasks) {
      try {
        results[t.name] = await t.promise;
      } catch (err) {
        results[t.name] = { success: false, error: err.message };
      }
    }

    this._recordAudit('ALL_DEVICES_CONNECT_ATTEMPT', { mode, results });
    return results;
  }

  /**
   * Disconnect a specific device
   */
  async disconnect(deviceName) {
    switch (deviceName) {
      case DEVICE_NAMES.SOIL_SENSOR:
        return await this.soilSensor.disconnect();
      case DEVICE_NAMES.SPECTROMETER:
        return await this.spectrometer.disconnect();
      case DEVICE_NAMES.TEMP_HUMIDITY:
        return await this.tempHumidity.disconnect();
      case DEVICE_NAMES.IRRIGATION:
        return await this.irrigation.disconnect();
      default:
        throw new Error(`Unknown device name: ${deviceName}`);
    }
  }

  /**
   * Disconnect all devices cleanly
   */
  async disconnectAll() {
    const results = {
      soil_sensor: await this.soilSensor.disconnect(),
      spectrometer: await this.spectrometer.disconnect(),
      temp_humidity: await this.tempHumidity.disconnect(),
      irrigation: await this.irrigation.disconnect()
    };
    this._recordAudit('ALL_DEVICES_DISCONNECTED', results);
    return results;
  }

  /**
   * Get status of a single device or all devices
   */
  getStatus(deviceName = null) {
    if (deviceName) {
      switch (deviceName) {
        case DEVICE_NAMES.SOIL_SENSOR: return this.soilSensor.getStatus();
        case DEVICE_NAMES.SPECTROMETER: return this.spectrometer.getStatus();
        case DEVICE_NAMES.TEMP_HUMIDITY: return this.tempHumidity.getStatus();
        case DEVICE_NAMES.IRRIGATION: return this.irrigation.getStatus();
        default: throw new Error(`Unknown device: ${deviceName}`);
      }
    }

    return {
      soilSensor: this.soilSensor.getStatus(),
      spectrometer: this.spectrometer.getStatus(),
      tempHumidity: this.tempHumidity.getStatus(),
      irrigation: this.irrigation.getStatus(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Auto-detect and connect to available sensors
   */
  async autoDetectAndConnect(options = {}) {
    const soilResult = await this.soilSensor.autoDetectAndConnect(options);
    return {
      soil_sensor: soilResult
    };
  }

  /**
   * Read data from a single device
   */
  async readData(deviceName, options = {}) {
    switch (deviceName) {
      case DEVICE_NAMES.SOIL_SENSOR:
        return await this.soilSensor.readData(options);
      case DEVICE_NAMES.SPECTROMETER:
        return await (this.spectrometer.acquireSample ? this.spectrometer.acquireSample(options) : this.spectrometer.captureSpectrum(options));
      case DEVICE_NAMES.TEMP_HUMIDITY:
        return await this.tempHumidity.readData(options);
      case DEVICE_NAMES.IRRIGATION:
        return {
          telemetry: this.irrigation.getTelemetry ? this.irrigation.getTelemetry() : this.irrigation.telemetry,
          valves: this.irrigation.getAllValves(),
          alerts: this.irrigation.getActiveAlerts()
        };
      default:
        throw new Error(`Unknown device name: ${deviceName}`);
    }
  }

  /**
   * Read all telemetry across all connected hardware in parallel
   */
  async readAllData(options = {}) {
    const [soil, spectro, microclimate] = await Promise.all([
      this.soilSensor.readData(options.soilOptions || {}),
      (this.spectrometer.acquireSample ? this.spectrometer.acquireSample(options.spectroOptions || {}) : this.spectrometer.captureSpectrum(options.spectroOptions || {})),
      this.tempHumidity.readData(options.weatherOptions || {})
    ]);

    const irrigationState = {
      telemetry: this.irrigation.getTelemetry ? this.irrigation.getTelemetry() : this.irrigation.telemetry,
      valves: this.irrigation.getAllValves(),
      activeAlerts: this.irrigation.getActiveAlerts()
    };

    // Evaluate Closed-Loop Synergy between canopy spectral tension and soil moisture
    const synergy = this.evaluateClosedLoopSynergy(spectro, soil);

    return {
      timestamp: new Date().toISOString(),
      soilSensor: soil,
      spectrometer: spectro,
      microclimate,
      irrigation: irrigationState,
      closedLoopSynergy: synergy
    };
  }

  /**
   * Evaluate cross-device closed loop synergy:
   * Cross-references Spectrometer leaf water index (LWI) with LABART root-zone VWC
   */
  evaluateClosedLoopSynergy(spectroScan, soilReading) {
    const lwi = spectroScan?.features?.lwi || 0.90;
    const vwc = soilReading?.raw?.moisture_vwc || 25.0;
    const ndre = spectroScan?.features?.ndre || 0.32;
    const soilN = soilReading?.raw?.nitrogen_mg_kg || 80;

    let leafWaterDeficit = lwi < 0.85;
    let soilWaterDeficit = vwc < 20.0;
    let recommendation = null;

    if (leafWaterDeficit && soilWaterDeficit) {
      recommendation = {
        action: 'RECOMMEND_IRRIGATION',
        urgency: 'HIGH',
        confidence: 0.94,
        rationale: `Leaf spectral water index (${lwi}) indicates dehydration, corroborated by low root-zone moisture (${vwc}% VWC).`,
        suggestedValveDurationMinutes: 25,
        suggestedVolumeLiters: 175.0
      };
    } else if (leafWaterDeficit && !soilWaterDeficit) {
      recommendation = {
        action: 'INSPECT_VASCULAR_HEALTH',
        urgency: 'MEDIUM',
        confidence: 0.78,
        rationale: `Leaf exhibits water stress (LWI ${lwi}) despite adequate soil moisture (${vwc}% VWC). Check for root rot, vascular wilt, or excessive atmospheric VPD.`,
        suggestedValveDurationMinutes: 0
      };
    } else if (vwc > 38.0) {
      recommendation = {
        action: 'SUSPEND_IRRIGATION',
        urgency: 'MEDIUM',
        confidence: 0.88,
        rationale: `Soil is saturated (${vwc}% VWC). Risk of anaerobic root asphyxiation.`,
        suggestedValveDurationMinutes: 0
      };
    }

    return {
      leafWaterIndex: lwi,
      soilMoistureVwc: vwc,
      nitrogenConcordance: {
        canopyNdre: ndre,
        soilNitrogenMgKg: soilN,
        status: ndre < 0.28 && soilN < 50 ? 'CONCORDANT_DEFICIENCY' : 'NORMAL'
      },
      recommendation
    };
  }

  _recordAudit(eventType, payload) {
    const entry = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp: new Date().toISOString(),
      eventType,
      details: payload
    };
    this.auditLedger.unshift(entry);
    if (this.auditLedger.length > 500) this.auditLedger.pop();
  }

  /**
   * Export complete hardware audit trail in JSON or CSV
   * @param {'json'|'csv'} format
   * @returns {string} Formatted audit log
   */
  exportAudit(format = 'json') {
    const irrigationAudit = this.irrigation.getAuditLogs();
    const combinedLedger = [
      ...this.auditLedger.map(e => ({ source: 'DEVICE_MANAGER', ...e })),
      ...irrigationAudit.map(e => ({ source: 'IRRIGATION_CONTROLLER', eventType: e.action, details: e }))
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (format === 'csv') {
      const headers = ['Timestamp', 'Source', 'EventType', 'Details'];
      const rows = combinedLedger.map(e => {
        const time = e.timestamp || '';
        const src = e.source || '';
        const ev = e.eventType || '';
        const det = JSON.stringify(e.details || {}).replace(/"/g, '""');
        return `"${time}","${src}","${ev}","${det}"`;
      });
      return [headers.join(','), ...rows].join('\n');
    }

    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      devicesStatus: this.getStatus(),
      auditTrail: combinedLedger
    }, null, 2);
  }
}

// Singleton export
export const deviceManager = new DeviceManager();
export default deviceManager;
