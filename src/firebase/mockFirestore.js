/**
 * Reactive In-Memory & LocalStorage Persisted Firestore Store
 * Implements real-time Firestore NoSQL API semantics (onSnapshot, updateDoc, setDoc, addDoc)
 * Ensures instantaneous out-of-the-box operation and offline resilience.
 */

const STORAGE_KEY = "AGRISPECTRA_FIRESTORE_DATA_V1";

export const INITIAL_FARM_DATA = {
  farmId: "farm-valley-1",
  name: "AgriSpectra High-Density Precision Block Alpha",
  totalArea: "1.00 Acre (6 Zones)",
  location: { latitude: 36.7783, longitude: -119.4179 },
  createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
  ownerId: "user-agrispectra-admin",
  managers: ["user-agrispectra-admin", "manager-san-joaquin"],
  operators: ["operator-field-tech-1", "operator-field-tech-2"],
  members: ["agronomist-consultant", "viewer-demo"],
  plots: {
    "plot-1": {
      id: "plot-1",
      name: "Zone 1 - Bell Peppers Block",
      plotNumber: 1,
      crop: "Bell Peppers",
      stage: "Fruit Formation",
      targetVwcMin: 22.0,
      targetVwcMax: 35.0,
      valve: {
        id: "G1",
        state: "CLOSED", // OPEN | CLOSED | FAULT
        flowRate: 450.0, // Liters per hour
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S1_10cm", depthCm: 10, vwc: 26.4, temperature: 23.2, salinityEc: 1.20, lastUpdated: new Date().toISOString() },
        { probeId: "S1_30cm", depthCm: 30, vwc: 29.1, temperature: 21.8, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
        { probeId: "S1_50cm", depthCm: 50, vwc: 31.5, temperature: 20.4, salinityEc: 0.95, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-2": {
      id: "plot-2",
      name: "Zone 2 - Heirloom Tomatoes Block",
      plotNumber: 2,
      crop: "Heirloom Tomatoes",
      stage: "Fruit Sizing & Ripening",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      valve: {
        id: "G2",
        state: "CLOSED",
        flowRate: 520.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S2_10cm", depthCm: 10, vwc: 13.8, temperature: 27.8, salinityEc: 1.85, lastUpdated: new Date().toISOString() }, // LOW WATER DEFICIT
        { probeId: "S2_30cm", depthCm: 30, vwc: 17.2, temperature: 25.1, salinityEc: 1.60, lastUpdated: new Date().toISOString() },
        { probeId: "S2_50cm", depthCm: 50, vwc: 22.0, temperature: 22.0, salinityEc: 1.30, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-3": {
      id: "plot-3",
      name: "Zone 3 - Sweet Corn Block",
      plotNumber: 3,
      crop: "Sweet Corn",
      stage: "Tasseling & Silking",
      targetVwcMin: 24.0,
      targetVwcMax: 38.0,
      valve: {
        id: "G3",
        state: "CLOSED",
        flowRate: 610.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S3_10cm", depthCm: 10, vwc: 31.2, temperature: 22.5, salinityEc: 1.05, lastUpdated: new Date().toISOString() },
        { probeId: "S3_30cm", depthCm: 30, vwc: 34.0, temperature: 21.0, salinityEc: 0.92, lastUpdated: new Date().toISOString() },
        { probeId: "S3_50cm", depthCm: 50, vwc: 36.5, temperature: 19.8, salinityEc: 0.81, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-4": {
      id: "plot-4",
      name: "Zone 4 - Strawberries Block",
      plotNumber: 4,
      crop: "Strawberries",
      stage: "Vegetative / Foliar Bloom",
      targetVwcMin: 18.0,
      targetVwcMax: 30.0,
      valve: {
        id: "G4",
        state: "CLOSED",
        flowRate: 380.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S4_10cm", depthCm: 10, vwc: 21.5, temperature: 24.2, salinityEc: 1.40, lastUpdated: new Date().toISOString() },
        { probeId: "S4_30cm", depthCm: 30, vwc: 24.8, temperature: 22.3, salinityEc: 1.25, lastUpdated: new Date().toISOString() },
        { probeId: "S4_50cm", depthCm: 50, vwc: 27.0, temperature: 21.1, salinityEc: 1.10, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-5": {
      id: "plot-5",
      name: "Zone 5 - Leafy Greens Block",
      plotNumber: 5,
      crop: "Leafy Greens",
      stage: "Head Expansion",
      targetVwcMin: 25.0,
      targetVwcMax: 40.0,
      valve: {
        id: "G5",
        state: "CLOSED",
        flowRate: 400.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S5_10cm", depthCm: 10, vwc: 28.0, temperature: 21.9, salinityEc: 0.90, lastUpdated: new Date().toISOString() },
        { probeId: "S5_30cm", depthCm: 30, vwc: 32.5, temperature: 20.8, salinityEc: 0.82, lastUpdated: new Date().toISOString() },
        { probeId: "S5_50cm", depthCm: 50, vwc: 35.0, temperature: 19.5, salinityEc: 0.74, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-6": {
      id: "plot-6",
      name: "Zone 6 - Citrus Nursery",
      plotNumber: 6,
      crop: "Citrus",
      stage: "Active Root Establishment",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      valve: {
        id: "G6",
        state: "CLOSED",
        flowRate: 340.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S6_10cm", depthCm: 10, vwc: 25.1, temperature: 23.8, salinityEc: 1.15, lastUpdated: new Date().toISOString() },
        { probeId: "S6_30cm", depthCm: 30, vwc: 27.4, temperature: 22.0, salinityEc: 1.02, lastUpdated: new Date().toISOString() },
        { probeId: "S6_50cm", depthCm: 50, vwc: 29.8, temperature: 20.7, salinityEc: 0.88, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  leafScans: [
    {
      id: "scan-plot2-stress-01",
      plotId: "plot-2",
      crop: "Heirloom Tomatoes",
      scannedAt: new Date(Date.now() - 18 * 60000).toISOString(),
      vitalityScore: 54.2,
      leafWaterIndex: 0.62,
      nitrogenPrescriptionKg: 14.5,
      rawSpectrumPreview: [0.06, 0.07, 0.14, 0.22, 0.18, 0.45, 0.58, 0.59, 0.38, 0.52],
      diseaseRisk: {
        pathogen: "Early Powdery Mildew",
        confidence: 84.5,
        preventativeAction: "Apply Potassium Bicarbonate foliar spray."
      },
      gpsLocation: { latitude: 36.7785, longitude: -119.4181 },
      scannedBy: "operator-field-tech-1",
      notes: "Canopy upper foliage shows severe cellular dehydration and incipient fungal conidia."
    },
    {
      id: "scan-plot1-optimal-01",
      plotId: "plot-1",
      crop: "Bell Peppers",
      scannedAt: new Date(Date.now() - 52 * 60000).toISOString(),
      vitalityScore: 89.4,
      leafWaterIndex: 1.82,
      nitrogenPrescriptionKg: 0.0,
      rawSpectrumPreview: [0.05, 0.06, 0.13, 0.15, 0.08, 0.46, 0.61, 0.63, 0.49, 0.55],
      diseaseRisk: null,
      gpsLocation: { latitude: 36.7781, longitude: -119.4178 },
      scannedBy: "operator-field-tech-1",
      notes: "High chlorophyll density, robust turgor pressure across south canopy."
    }
  ],
  irrigationLogs: [
    {
      id: "log-irr-101",
      plotId: "plot-1",
      valveId: "G1",
      action: "CLOSE",
      durationMinutes: 15.0,
      litersDelivered: 112.5,
      triggeredBy: "MANUAL",
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
      operatorId: "operator-field-tech-1",
      notes: "Pre-sunrise baseline pulse across South High-Tunnel"
    },
    {
      id: "log-irr-102",
      plotId: "plot-3",
      valveId: "G3",
      action: "CLOSE",
      durationMinutes: 20.0,
      litersDelivered: 203.3,
      triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      operatorId: "operator-field-tech-2",
      notes: "Autonomous replenishment following high mid-morning evapotranspiration"
    },
    {
      id: "log-irr-103",
      plotId: "plot-5",
      valveId: "G5",
      action: "CLOSE",
      durationMinutes: 12.0,
      litersDelivered: 80.0,
      triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
      timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
      operatorId: "operator-field-tech-1",
      notes: "Cooling foliar micro-burst for head expansion greens"
    },
    {
      id: "log-irr-104",
      plotId: "plot-6",
      valveId: "G6",
      action: "CLOSE",
      durationMinutes: 18.0,
      litersDelivered: 102.0,
      triggeredBy: "MANUAL_TOUCH",
      timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
      operatorId: "operator-field-tech-2",
      notes: "Citrus nursery deep-pot wetting verification"
    }
  ],
  actionRecommendations: [
    {
      id: "rec-plot2-urgent-01",
      plotId: "plot-2",
      plotNumber: 2,
      crop: "Heirloom Tomatoes",
      gateId: "G2",
      status: "PENDING",
      generatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      title: "Urgent Drip Hydration & Nitrogen Foliar Correction",
      details: "Handheld spectroscopy detected acute leaf dehydration (LWI 0.62, Vitality 54%). 10cm FDR probe confirms critical moisture deficit at 13.8% (Target: >20.0%).",
      triggerReason: "Plot 2 leaf stress (LWI 0.62, Vitality 54%) confirmed by 13.8% FDR soil moisture (Target: >20.0%).",
      suggestedAction: "OPEN",
      suggestedDurationMinutes: 25.0,
      nitrogenPrescriptionKg: 14.5,
      leafScanId: "scan-plot2-stress-01",
      diseaseAlert: {
        detected: true,
        pathogen: "Early Powdery Mildew",
        confidence: 84.5,
        preventativeAction: "Apply Potassium Bicarbonate foliar spray."
      }
    }
  ]
};

class ReactiveMockFirestore {
  constructor() {
    this.data = this.loadData();
    this.subscribers = new Map(); // key -> Array of callbacks
  }

  loadData() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn("Could not read from localStorage, using initial mock data.");
    }
    return JSON.parse(JSON.stringify(INITIAL_FARM_DATA));
  }

  saveData() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      }
    } catch (e) {
      console.warn("Could not persist to localStorage:", e);
    }
  }

  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel).push(callback);
    // Initial call with current state
    callback(this.getChannelSnapshot(channel));

    return () => {
      const list = this.subscribers.get(channel) || [];
      this.subscribers.set(channel, list.filter(cb => cb !== callback));
    };
  }

  notify(channel) {
    if (this.subscribers.has(channel)) {
      const snap = this.getChannelSnapshot(channel);
      this.subscribers.get(channel).forEach(cb => cb(snap));
    }
  }

  getChannelSnapshot(channel) {
    if (channel === 'plots') {
      return Object.values(this.data.plots);
    }
    if (channel === 'leafScans') {
      return [...this.data.leafScans].reverse();
    }
    if (channel === 'irrigationLogs') {
      return [...this.data.irrigationLogs].reverse();
    }
    if (channel === 'actionRecommendations') {
      return [...this.data.actionRecommendations].reverse();
    }
    if (channel === 'farm') {
      return {
        farmId: this.data.farmId,
        name: this.data.name,
        totalArea: this.data.totalArea,
        location: this.data.location
      };
    }
    return null;
  }

  // --- API Mutators ---

  updatePlot(plotId, updates) {
    if (this.data.plots[plotId]) {
      this.data.plots[plotId] = {
        ...this.data.plots[plotId],
        ...updates
      };
      this.saveData();
      this.notify('plots');
    }
  }

  addLeafScan(scan) {
    const id = "scan-" + Date.now();
    const doc = {
      id,
      ...scan,
      scannedAt: new Date().toISOString()
    };
    this.data.leafScans.push(doc);
    this.saveData();
    this.notify('leafScans');

    // Closed-Loop Synergy Evaluation
    this.evaluateClosedLoop(doc);
    return id;
  }

  addIrrigationLog(log) {
    const id = "log-" + Date.now();
    const doc = {
      id,
      ...log,
      timestamp: new Date().toISOString()
    };
    this.data.irrigationLogs.push(doc);
    this.saveData();
    this.notify('irrigationLogs');
    return id;
  }

  addActionRecommendation(rec) {
    const id = "rec-" + Date.now();
    const doc = {
      id,
      ...rec,
      status: 'PENDING',
      generatedAt: new Date().toISOString()
    };
    this.data.actionRecommendations.push(doc);
    this.saveData();
    this.notify('actionRecommendations');
    return id;
  }

  updateActionRecommendation(recId, updates) {
    const idx = this.data.actionRecommendations.findIndex(r => r.id === recId);
    if (idx !== -1) {
      this.data.actionRecommendations[idx] = {
        ...this.data.actionRecommendations[idx],
        ...updates
      };
      this.saveData();
      this.notify('actionRecommendations');
    }
  }

  /**
   * Internal Closed-Loop Synergy Checker
   */
  evaluateClosedLoop(scan) {
    const plot = this.data.plots[scan.plotId];
    if (!plot) return;

    // Check average soil moisture
    let avgVwc = 25;
    if (plot.soilSensors && plot.soilSensors.length > 0) {
      const sum = plot.soilSensors.reduce((a, b) => a + Number(b.vwc), 0);
      avgVwc = Number((sum / plot.soilSensors.length).toFixed(1));
    }

    const lwi = Number(scan.leafWaterIndex) || 1.0;
    const vitality = Number(scan.vitalityScore) || 100;
    const isWaterStressed = lwi < 0.88 || vitality < 60;
    const isSoilDeficit = avgVwc <= plot.targetVwcMin;

    if (isWaterStressed && isSoilDeficit && plot.valve.state !== "OPEN") {
      this.addActionRecommendation({
        plotId: plot.id,
        plotNumber: plot.plotNumber,
        crop: plot.crop,
        gateId: plot.valve.id,
        triggerReason: `Plot ${plot.plotNumber} leaf stress (LWI ${lwi.toFixed(2)}, Vitality ${vitality}%) confirmed by ${avgVwc}% FDR soil moisture (Target: >${plot.targetVwcMin}%).`,
        suggestedAction: "OPEN",
        suggestedDurationMinutes: 25,
        nitrogenPrescriptionKg: scan.nitrogenPrescriptionKg || 0,
        diseaseAlert: scan.diseaseRisk || null,
        leafScanId: scan.id
      });
    }
  }

  resetToDefault() {
    this.data = JSON.parse(JSON.stringify(INITIAL_FARM_DATA));
    this.saveData();
    this.notify('plots');
    this.notify('leafScans');
    this.notify('irrigationLogs');
    this.notify('actionRecommendations');
    this.notify('farm');
  }
}

export const mockFirestore = new ReactiveMockFirestore();
