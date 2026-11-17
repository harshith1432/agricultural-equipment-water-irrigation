/**
 * AgriSpectra Flow & Field - Main Application Entrypoint
 * Coordinates Leaf Spectroscopy, 6-Zone Hydraulic Solenoids, Firestore NoSQL, and Hardware Simulation.
 */
import { firestoreService } from './firebase/firestoreService.js';
import { leafClipDevice } from './hardware/webBluetoothLeafClip.js';
import { mqttSimulator } from './hardware/mqttTelemetrySimulator.js';
import { createHeader } from './components/Header.js';
import { createFieldOverviewBento } from './components/FieldOverviewBento.js';
import { createPlotCanvas6Zone } from './components/PlotCanvas6Zone.js';
import { createValveControlCenter } from './components/ValveControlCenter.js';
import {
  createSpectroscopyStudio,
  renderDecisionCards,
  drawSpectralCurve
} from './components/SpectroscopyStudio.js';
import { createClosedLoopSynergySection } from './components/ClosedLoopSynergyCard.js';
import { createCalibrationModal } from './components/CalibrationWizard.js';
import { createTelemetrySimulatorModal } from './components/TelemetrySimulatorModal.js';
import { generateSpectralSignature, processSpectralVector } from './hardware/chemometricsEngine.js';

class AgriSpectraApp {
  constructor() {
    this.appEl = document.getElementById('app');
    this.currentTheme = localStorage.getItem('agrispectra_theme') || 'creamy-agri';
    this.selectedPlotId = "plot-2"; // Start focused on Plot 2 to highlight water stress scenario

    // Reactive State
    this.plots = [];
    this.actionRecommendations = [];
    this.irrigationLogs = [];
    this.latestScanAnalysis = null;
    this.telemetryMetrics = {
      mainlinePressureBar: 2.42,
      activeFlowLph: 0,
      consumedLitersToday: 1845,
      weatherMode: 'NORMAL'
    };

    this.bleState = {
      connected: false,
      simulated: true
    };

    this.mqttState = {
      running: false
    };

    this.init();
  }

  async init() {
    console.log("[AgriSpectra] Initializing unified precision agriculture platform...");

    // Apply the active agricultural visual theme (Creamy Light & Foliage Green default)
    this.applyTheme(this.currentTheme);

    // 1. Connect Simulated BLE device by default so user has immediate out-of-the-box experience
    await leafClipDevice.connect({ forceSimulation: false });
    this.bleState.connected = leafClipDevice.isConnected;
    this.bleState.simulated = leafClipDevice.isSimulated;

    // 2. Initial analysis for selected plot (Plot 2 default)
    const initialSpectrum = generateSpectralSignature({
      vitality: 54,
      waterContent: 0.62,
      nitrogenLevel: 0.55,
      diseaseStress: 0.65
    });
    this.latestScanAnalysis = processSpectralVector(initialSpectrum, "Heirloom Drip Tomatoes", "Fruit Sizing & Ripening");

    // 3. Subscribe to Real-Time Firestore NoSQL Collections
    this.unsubscribePlots = firestoreService.subscribePlots((plots) => {
      this.plots = plots;
      this.render();

      // Ensure MQTT simulator has latest plot references
      if (!this.mqttState.running) {
        mqttSimulator.start(this.plots, (updatedPlot) => {
          firestoreService.updatePlotTelemetry(
            updatedPlot.id,
            updatedPlot.soilSensors,
            updatedPlot.totalLitersDelivered
          );
        });
        this.mqttState.running = true;
      }
    });

    this.unsubscribeRecommendations = firestoreService.subscribeActionRecommendations((recs) => {
      this.actionRecommendations = recs;
      this.render();
    });

    this.unsubscribeLogs = firestoreService.subscribeIrrigationLogs((logs) => {
      this.irrigationLogs = logs;
      this.render();
    });

    // 4. Listen to hardware telemetry ticks
    mqttSimulator.on('telemetryTick', (data) => {
      this.telemetryMetrics = {
        mainlinePressureBar: data.mainlinePressureBar,
        activeFlowLph: data.activeFlowLph,
        consumedLitersToday: data.consumedLitersToday,
        weatherMode: data.weatherMode
      };
      this.updateBentoAndCanvasMetrics();
    });

    mqttSimulator.on('statusChange', ({ running }) => {
      this.mqttState.running = running;
      this.render();
    });

    leafClipDevice.on('connectionChange', ({ status, simulated }) => {
      this.bleState.connected = status === 'CONNECTED';
      this.bleState.simulated = simulated;
      this.render();
    });

    this.render();
  }

  render() {
    if (!this.appEl) return;
    this.appEl.innerHTML = '';

    // Main layout container
    const mainWrapper = document.createElement('div');
    mainWrapper.className = "flex-1 flex flex-col min-h-screen transition-colors duration-300";

    // 1. Header
    const header = createHeader({
      onEmergencyStop: () => this.handleEmergencyStop(),
      onOpenCalibration: (type) => this.openCalibrationModal(type),
      onOpenSimModal: () => this.openTelemetrySimModal(),
      onThemeChange: (themeId) => this.setTheme(themeId),
      currentTheme: this.currentTheme,
      bleState: this.bleState,
      mqttState: this.mqttState
    });
    mainWrapper.appendChild(header);

    // 2. Main Content Container
    const content = document.createElement('main');
    content.className = "max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1";

    // Bento KPI Grid
    const bentoSection = createFieldOverviewBento(this.plots, this.telemetryMetrics);
    bentoSection.id = "overview-bento-section";
    content.appendChild(bentoSection);

    // Closed-Loop Leaf-to-Valve Synergy Section (High Priority Alert if stress detected)
    const synergySection = createClosedLoopSynergySection(
      this.actionRecommendations,
      (recId, action) => this.handleSynergyAction(recId, action)
    );
    content.appendChild(synergySection);

    // 1-Acre 6-Zone Field Visual Canvas
    const canvasSection = createPlotCanvas6Zone(
      this.plots,
      this.selectedPlotId,
      (plotId) => {
        this.selectedPlotId = plotId;
        this.render();
      }
    );
    canvasSection.id = "plot-canvas-section";
    content.appendChild(canvasSection);

    // Module A: Leaf Spectroscopy & Edge Chemometrics Studio
    const spectroscopyStudio = createSpectroscopyStudio({
      plots: this.plots,
      selectedPlotId: this.selectedPlotId,
      onAcquireScan: (plotId) => this.handleAcquireScan(plotId),
      onOpenCalibration: () => this.openCalibrationModal('FULL')
    });
    spectroscopyStudio.id = "spectroscopy-studio-section";
    content.appendChild(spectroscopyStudio);

    // Module B: 6-Zone Solenoid Hydraulic Actuation Hub
    const valveCenter = createValveControlCenter(
      this.plots,
      (params) => this.handleActuateValve(params)
    );
    valveCenter.id = "valve-control-section";
    content.appendChild(valveCenter);

    // Footer Audit Info
    const footer = document.createElement('footer');
    footer.className = "py-6 border-t border-slate-800 text-center text-xs text-slate-500 font-mono";
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
        <span>AGRISPECTRA FLOW & FIELD • Production Precision Agronomy</span>
        <span>Firebase NoSQL • BLE 5.0 GATT • ±12V DC Latching Controls</span>
      </div>
    `;
    content.appendChild(footer);

    mainWrapper.appendChild(content);
    this.appEl.appendChild(mainWrapper);

    // Render Canvas Spectral Curve & 5 Decision Cards for current selected plot
    this.postRenderSpectroscopy();
  }

  postRenderSpectroscopy() {
    const canvas = document.getElementById('spectral-canvas');
    const studioSection = document.getElementById('spectroscopy-studio-section');
    if (canvas && this.latestScanAnalysis) {
      drawSpectralCurve(canvas, this.latestScanAnalysis.rawSpectrumPreview);
    }
    if (studioSection && this.latestScanAnalysis) {
      const selectedPlot = this.plots.find(p => p.id === this.selectedPlotId) || this.plots[0];
      renderDecisionCards(
        studioSection,
        this.latestScanAnalysis,
        selectedPlot?.crop || "Bell Peppers",
        selectedPlot?.plotNumber || 1
      );
    }
  }

  /**
   * Acquire a fresh spectral leaf scan for targeted plot
   */
  async handleAcquireScan(plotId) {
    this.selectedPlotId = plotId;
    const plot = this.plots.find(p => p.id === plotId) || this.plots[0];
    
    // Average soil moisture of plot
    let avgVwc = 25.0;
    if (plot?.soilSensors && plot.soilSensors.length > 0) {
      avgVwc = plot.soilSensors.reduce((a, s) => a + Number(s.vwc), 0) / plot.soilSensors.length;
    }

    try {
      const analysis = await leafClipDevice.acquireScan({
        plotNumber: plot?.plotNumber || 1,
        cropName: plot?.crop || "Bell Peppers",
        growthStage: plot?.stage || "Fruit Formation",
        soilVwc: avgVwc
      });

      this.latestScanAnalysis = analysis;

      // Save to Firestore NoSQL collection
      await firestoreService.saveLeafScan({
        plotId: plot.id,
        crop: plot.crop,
        ...analysis
      });

      this.postRenderSpectroscopy();
    } catch (err) {
      alert("Scan error: " + err.message);
    }
  }

  /**
   * Actuate a solenoid valve (+12V open / -12V close)
   */
  async handleActuateValve({ plotId, gateId, action, durationMinutes }) {
    try {
      await firestoreService.actuateValve({
        plotId,
        gateId,
        action,
        durationMinutes,
        triggeredBy: "MANUAL"
      });
    } catch (err) {
      console.error("Actuation error:", err);
      alert("Failed to actuate valve: " + err.message);
    }
  }

  /**
   * Handle Smart Recommendation Action (APPROVE / DISMISS)
   */
  async handleSynergyAction(recId, action) {
    try {
      await firestoreService.handleRecommendationAction(recId, action);
    } catch (err) {
      console.error("Recommendation action error:", err);
    }
  }

  /**
   * Emergency 1-tap shut off all valves
   */
  async handleEmergencyStop() {
    const confirmed = confirm("EMERGENCY KILLSWITCH: Are you sure you want to send immediate -12V reverse latch pulses to close ALL 6 valves?");
    if (!confirmed) return;

    try {
      const result = await firestoreService.emergencyShutOffAll();
      alert(`SAFETY ACTIVATED: ${result.closedCount} active valves closed simultaneously. System locked.`);
    } catch (err) {
      alert("Emergency shutoff failed: " + err.message);
    }
  }

  /**
   * Set and persist agricultural visual theme
   */
  setTheme(themeId) {
    this.currentTheme = themeId;
    try {
      localStorage.setItem('agrispectra_theme', themeId);
    } catch (e) {}
    this.applyTheme(themeId);
    this.render();
  }

  applyTheme(themeId) {
    const body = document.body;
    body.classList.remove('theme-creamy-agri', 'theme-lush-emerald', 'theme-sunlight', 'theme-dark-soil', 'sunlight-mode');
    
    if (themeId === 'sunlight') {
      body.classList.add('theme-sunlight', 'sunlight-mode');
    } else if (themeId === 'lush-emerald') {
      body.classList.add('theme-lush-emerald');
    } else if (themeId === 'dark-soil') {
      body.classList.add('theme-dark-soil');
    } else {
      // Default: Creamy light theme & botanical green
      body.classList.add('theme-creamy-agri');
    }
  }

  openCalibrationModal(type = 'FULL') {
    const modal = createCalibrationModal({
      onClose: () => modal.remove(),
      onComplete: () => {
        modal.remove();
        this.render();
      }
    });
    document.body.appendChild(modal);
  }

  openTelemetrySimModal() {
    const modal = createTelemetrySimulatorModal({
      onClose: () => modal.remove()
    });
    document.body.appendChild(modal);
  }

  /**
   * Fast targeted DOM metric updates during fast MQTT ticks
   */
  updateBentoAndCanvasMetrics() {
    // Dynamically update pressure and counters in DOM without re-rendering entire layout
    const bentoHost = document.getElementById('overview-bento-section');
    if (bentoHost) {
      const newBento = createFieldOverviewBento(this.plots, this.telemetryMetrics);
      bentoHost.replaceWith(newBento);
      newBento.id = 'overview-bento-section';
    }
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.agriSpectraApp = new AgriSpectraApp();

  // Register PWA Service Worker for offline field resilience
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('[AgriSpectra PWA] Service Worker registered:', reg.scope))
      .catch((err) => console.warn('[AgriSpectra PWA] Service Worker registration failed:', err));
  }
});
