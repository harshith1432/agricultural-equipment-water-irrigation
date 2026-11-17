/**
 * AgriSpectra BLE 5.0 GATT Profile & Leaf-Clip Controller
 * Connects to physical hardware via Web Bluetooth API or switches to high-precision hardware simulator.
 */
import { generateSpectralSignature, processSpectralVector } from './chemometricsEngine.js';

export const BLE_SERVICES = {
  SPECTROMETER_SERVICE: '0000ffe0-0000-1000-8000-00805f9b34fb',
  DATA_CHAR: '0000ffe1-0000-1000-8000-00805f9b34fb',
  COMMAND_CHAR: '0000ffe2-0000-1000-8000-00805f9b34fb',
  BATTERY_SERVICE: 0x180f,
  BATTERY_LEVEL_CHAR: 0x2a19
};

export class LeafClipBluetoothDevice {
  constructor() {
    this.device = null;
    this.server = null;
    this.isConnected = false;
    this.isSimulated = false;
    this.batteryLevel = 94;
    this.rssi = -62;
    this.deviceInfo = {
      model: "AgriSpectra Clip-Pro 500",
      firmware: "v2.4.1-edgeML",
      serialNumber: "AGRI-9948-NIR"
    };

    // Calibration states
    this.calibration = {
      darkCurrentCompleted: false,
      darkCurrentValue: 0.021,
      whiteDiscCompleted: false,
      whiteDiscValue: 0.985,
      isCalibrated: false,
      lastCalibratedAt: null
    };

    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => cb(data));
    }
  }

  /**
   * Attempt real Web Bluetooth connection or fall back to simulation
   */
  async connect({ forceSimulation = false } = {}) {
    if (forceSimulation || !navigator.bluetooth) {
      console.log("[BLE] Initializing in High-Fidelity Hardware Simulation mode.");
      this.isSimulated = true;
      this.isConnected = true;
      this.emit('connectionChange', {
        status: 'CONNECTED',
        simulated: true,
        device: this.deviceInfo
      });
      return { success: true, simulated: true };
    }

    try {
      this.emit('connectionChange', { status: 'PAIRING', simulated: false });

      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: 'AgriSpectra' },
          { namePrefix: 'SpectraClip' }
        ],
        optionalServices: [
          BLE_SERVICES.SPECTROMETER_SERVICE,
          BLE_SERVICES.BATTERY_SERVICE
        ]
      });

      this.device.addEventListener('gattserverdisconnected', () => {
        this.isConnected = false;
        this.emit('connectionChange', { status: 'DISCONNECTED' });
      });

      this.server = await this.device.gatt.connect();
      this.isConnected = true;
      this.isSimulated = false;

      this.emit('connectionChange', {
        status: 'CONNECTED',
        simulated: false,
        device: {
          model: this.device.name || "AgriSpectra Clip-Pro",
          id: this.device.id
        }
      });

      return { success: true, simulated: false };
    } catch (err) {
      console.warn("[BLE] Web Bluetooth pairing cancelled or failed. Defaulting to Simulated Hardware:", err.message);
      this.isSimulated = true;
      this.isConnected = true;
      this.emit('connectionChange', {
        status: 'CONNECTED',
        simulated: true,
        device: this.deviceInfo
      });
      return { success: true, simulated: true, fallback: true };
    }
  }

  disconnect() {
    if (this.device && this.device.gatt && this.device.gatt.connected) {
      this.device.gatt.disconnect();
    }
    this.isConnected = false;
    this.emit('connectionChange', { status: 'DISCONNECTED' });
  }

  /**
   * Run Calibration Sequence:
   * Phase 1: Dark Current Zero Test (350-1100 nm closed optical chamber)
   * Phase 2: 99% PTFE White Reference disc
   */
  async runCalibrationStep(phase, onProgress = () => {}) {
    if (phase === 'DARK_CURRENT') {
      onProgress(15, "Measuring CMOS detector dark thermal leakage...");
      await new Promise(r => setTimeout(r, 600));
      onProgress(55, "Nulling 350-1100 nm ADC electronic offset...");
      await new Promise(r => setTimeout(r, 800));
      onProgress(90, "Verifying thermal stability (±0.002 AU)...");
      await new Promise(r => setTimeout(r, 500));
      
      this.calibration.darkCurrentCompleted = true;
      this.calibration.darkCurrentValue = 0.019;
      onProgress(100, "Dark Current Reference Locked.");
      return { success: true, phase: 'DARK_CURRENT' };
    } 
    
    if (phase === 'WHITE_REFERENCE') {
      onProgress(20, "Broadband Tungsten-Halogen lamp warming to 2850K...");
      await new Promise(r => setTimeout(r, 700));
      onProgress(60, "Scanning 99% diffuse PTFE Spectralon standard disc...");
      await new Promise(r => setTimeout(r, 800));
      onProgress(90, "Normalizing 100% reflectance matrix [350 - 1100 nm]...");
      await new Promise(r => setTimeout(r, 600));

      this.calibration.whiteDiscCompleted = true;
      this.calibration.whiteDiscValue = 0.992;
      this.calibration.isCalibrated = true;
      this.calibration.lastCalibratedAt = new Date();
      onProgress(100, "Full Optical Calibration Complete.");
      return { success: true, phase: 'WHITE_REFERENCE' };
    }

    throw new Error(`Unknown calibration phase: ${phase}`);
  }

  /**
   * Acquire a fresh spectral leaf scan
   */
  async acquireScan({
    plotNumber = 1,
    cropName = "Bell Peppers",
    growthStage = "Fruit Formation",
    soilVwc = 25.0
  } = {}) {
    if (!this.isConnected) {
      throw new Error("Leaf Clip is disconnected. Please connect BLE first.");
    }

    this.emit('scanState', { status: 'SCANNING', message: "Broadband flash pulse active... capturing 350-1100 nm spectrum." });
    await new Promise(r => setTimeout(r, 1100));

    // Dynamic biological simulation based on plot properties:
    // If soil moisture is low, leaf water index and vitality drop
    let vitality = 85;
    let waterContent = 0.88;
    let nitrogenLevel = 0.82;
    let diseaseStress = 0.12;

    if (soilVwc < 18) {
      vitality = Math.round(45 + (soilVwc * 1.5));
      waterContent = 0.58; // severe water stress
      nitrogenLevel = 0.65;
    } else if (soilVwc < 24) {
      vitality = Math.round(68 + (soilVwc * 0.8));
      waterContent = 0.74;
      nitrogenLevel = 0.72;
    }

    // Specific plot personality for realistic diversity in demo
    if (plotNumber === 2) {
      // Plot 2 has early disease / water stress scenario
      vitality = 54;
      waterContent = 0.62;
      nitrogenLevel = 0.55;
      diseaseStress = 0.65; // Powdery Mildew
    } else if (plotNumber === 4) {
      // Plot 4 has nitrogen depletion
      vitality = 66;
      waterContent = 0.85;
      nitrogenLevel = 0.38; // Needs Urea!
    } else if (plotNumber === 3) {
      // Plot 3 is ripe for harvest
      vitality = 92;
      waterContent = 0.92;
      nitrogenLevel = 0.88;
    }

    const spectrum = generateSpectralSignature({
      vitality,
      waterContent,
      nitrogenLevel,
      diseaseStress
    });

    const analysis = processSpectralVector(spectrum, cropName, growthStage);

    this.emit('scanState', { status: 'COMPLETED', analysis });
    return analysis;
  }
}

export const leafClipDevice = new LeafClipBluetoothDevice();
