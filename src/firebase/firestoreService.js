/**
 * Unified Firestore Service
 * Provides real-time reactive Firestore snapshots with offline / fallback support.
 */
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  serverTimestamp,
  query,
  orderBy
} from 'firebase/firestore';
import { db, isLiveFirebaseConfigured } from './config.js';
import { mockFirestore } from './mockFirestore.js';

export const FARM_ID = "farm-valley-1";

export class FirestoreDataService {
  constructor() {
    this.useLive = isLiveFirebaseConfigured && db !== null;
    console.log(`[FirestoreService] Active Mode: ${this.useLive ? 'LIVE CLOUD FIRESTORE' : 'REACTIVE PERSISTENT LOCAL NO-SQL'}`);
  }

  /**
   * Subscribe to 6-Zone Plots
   */
  subscribePlots(callback) {
    if (this.useLive) {
      try {
        const plotsRef = collection(db, "farms", FARM_ID, "plots");
        return onSnapshot(plotsRef, (snapshot) => {
          if (snapshot.empty) {
            // If empty, fall back to mock data
            callback(mockFirestore.getChannelSnapshot('plots'));
            return;
          }
          const plots = [];
          snapshot.forEach((doc) => {
            plots.push({ id: doc.id, ...doc.data() });
          });
          plots.sort((a, b) => (a.plotNumber || 0) - (b.plotNumber || 0));
          callback(plots);
        }, (error) => {
          console.warn("[Firestore] Live subscription error, using mock:", error);
          mockFirestore.subscribe('plots', callback);
        });
      } catch (err) {
        console.warn("[Firestore] Init error, falling back to mock:", err);
      }
    }
    return mockFirestore.subscribe('plots', callback);
  }

  /**
   * Subscribe to Leaf Spectroscopy Scans
   */
  subscribeLeafScans(callback) {
    if (this.useLive) {
      try {
        const scansRef = collection(db, "farms", FARM_ID, "leafScans");
        const q = query(scansRef, orderBy("scannedAt", "desc"));
        return onSnapshot(q, (snapshot) => {
          const scans = [];
          snapshot.forEach((doc) => {
            scans.push({ id: doc.id, ...doc.data() });
          });
          callback(scans);
        }, (err) => {
          console.warn("[Firestore] Error reading scans, using mock:", err);
          mockFirestore.subscribe('leafScans', callback);
        });
      } catch (err) {
        console.warn("[Firestore] Error, using mock:", err);
      }
    }
    return mockFirestore.subscribe('leafScans', callback);
  }

  /**
   * Subscribe to Irrigation Logs
   */
  subscribeIrrigationLogs(callback) {
    if (this.useLive) {
      try {
        const logsRef = collection(db, "farms", FARM_ID, "irrigationLogs");
        const q = query(logsRef, orderBy("timestamp", "desc"));
        return onSnapshot(q, (snapshot) => {
          const logs = [];
          snapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() });
          });
          callback(logs);
        }, (err) => {
          console.warn("[Firestore] Error reading logs, using mock:", err);
          mockFirestore.subscribe('irrigationLogs', callback);
        });
      } catch (err) {
        console.warn("[Firestore] Error, using mock:", err);
      }
    }
    return mockFirestore.subscribe('irrigationLogs', callback);
  }

  /**
   * Subscribe to Closed-Loop Action Recommendations
   */
  subscribeActionRecommendations(callback) {
    return mockFirestore.subscribe('actionRecommendations', callback);
  }

  /**
   * Actuate a valve (Gate G1 to G6)
   * Sends +12V pulse to open, -12V reverse pulse to close.
   */
  async actuateValve({ plotId, gateId, action, durationMinutes = 20, triggeredBy = "MANUAL" }) {
    const now = new Date();
    const isOpening = action === "OPEN";
    const timerEnd = isOpening ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : null;
    const pulseVoltage = isOpening ? 12 : -12;

    const updates = {
      "valve.state": isOpening ? "OPEN" : "CLOSED",
      "valve.timerEnd": timerEnd,
      "valve.pulseVoltage": pulseVoltage,
      "valve.lastActuatedAt": now.toISOString()
    };

    // Update in mock store
    mockFirestore.updatePlot(plotId, {
      valve: {
        id: gateId,
        state: isOpening ? "OPEN" : "CLOSED",
        flowRate: 480.0,
        timerEnd: timerEnd
      },
      updatedAt: now.toISOString()
    });

    // Record in Irrigation Logs
    const logDoc = {
      plotId,
      valveId: gateId,
      action: isOpening ? "OPEN" : "CLOSE",
      durationMinutes: isOpening ? durationMinutes : 0,
      litersDelivered: isOpening ? 0 : 160.0,
      triggeredBy
    };
    mockFirestore.addIrrigationLog(logDoc);

    // If live Firestore configured, update there too
    if (this.useLive) {
      try {
        const plotRef = doc(db, "farms", FARM_ID, "plots", plotId);
        await updateDoc(plotRef, {
          "valve.state": isOpening ? "OPEN" : "CLOSED",
          "valve.timerEnd": timerEnd,
          "updatedAt": serverTimestamp()
        });

        const logsRef = collection(db, "farms", FARM_ID, "irrigationLogs");
        await addDoc(logsRef, {
          ...logDoc,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.warn("[Firestore] Live update failed, operated locally:", err);
      }
    }

    return { success: true, action, timerEnd, pulseVoltage };
  }

  /**
   * Emergency 1-tap "Shut Off All Valves"
   */
  async emergencyShutOffAll() {
    const plots = mockFirestore.getChannelSnapshot('plots');
    let closedCount = 0;

    for (const plot of plots) {
      if (plot.valve?.state === "OPEN") {
        await this.actuateValve({
          plotId: plot.id,
          gateId: plot.valve.id,
          action: "CLOSE",
          durationMinutes: 0,
          triggeredBy: "EMERGENCY"
        });
        closedCount++;
      }
    }

    return { success: true, closedCount };
  }

  /**
   * Save a newly acquired Leaf Spectroscopy Scan
   */
  async saveLeafScan(scanData) {
    const scanId = mockFirestore.addLeafScan({
      plotId: scanData.plotId,
      crop: scanData.crop,
      gpsLocation: { latitude: 36.7783, longitude: -119.4179 },
      vitalityScore: scanData.vitalityScore,
      leafWaterIndex: scanData.indices.leafWaterIndex,
      nitrogenPrescriptionKg: scanData.nitrogenPrescriptionKg,
      diseaseRisk: scanData.diseaseRisk,
      harvest: scanData.harvest,
      rawSpectrumPreview: scanData.rawSpectrumPreview.slice(0, 20) // subset preview for storage
    });

    if (this.useLive) {
      try {
        const scansRef = collection(db, "farms", FARM_ID, "leafScans");
        await addDoc(scansRef, {
          plotId: scanData.plotId,
          vitalityScore: scanData.vitalityScore,
          leafWaterIndex: scanData.indices.leafWaterIndex,
          nitrogenPrescriptionKg: scanData.nitrogenPrescriptionKg,
          diseaseRisk: scanData.diseaseRisk,
          rawSpectrumPreview: scanData.rawSpectrumPreview.slice(0, 20),
          scannedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("[Firestore] Failed to save live scan:", e);
      }
    }

    return scanId;
  }

  /**
   * Update Smart Recommendation (APPROVE / DISMISS)
   */
  async handleRecommendationAction(recId, action) {
    const recs = mockFirestore.getChannelSnapshot('actionRecommendations');
    const rec = recs.find(r => r.id === recId);
    if (!rec) return;

    if (action === "APPROVE") {
      // Actuate the valve immediately
      await this.actuateValve({
        plotId: rec.plotId,
        gateId: rec.gateId,
        action: "OPEN",
        durationMinutes: rec.suggestedDurationMinutes || 25,
        triggeredBy: "CLOSED_LOOP_SPECTROSCOPY"
      });
      mockFirestore.updateActionRecommendation(recId, { status: "APPROVED" });
    } else if (action === "DISMISS") {
      mockFirestore.updateActionRecommendation(recId, { status: "DISMISSED" });
    }
  }

  /**
   * Direct update of soil sensor readings from MQTT telemetry
   */
  updatePlotTelemetry(plotId, soilSensors, totalLiters) {
    mockFirestore.updatePlot(plotId, {
      soilSensors,
      totalLitersDelivered: totalLiters
    });
  }
}

export const firestoreService = new FirestoreDataService();
