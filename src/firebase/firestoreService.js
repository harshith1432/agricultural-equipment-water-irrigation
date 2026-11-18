/**
 * AgriSpectra Flow & Field - Unified Cloud Firestore & Offline Data Service
 * 
 * Architecture & Invariants:
 *  - Direct live connection to Cloud Firestore `(default)` database with automatic offline persistence.
 *  - Real-time `onSnapshot` listeners syncing live telemetry directly into mobile app UI components.
 *  - Full document & collection operations for:
 *      * users/{userId}
 *      * farms/{farmId}
 *      * farms/{farmId}/plots/{plotId}
 *      * farms/{farmId}/leafScans/{scanId}
 *      * farms/{farmId}/irrigationLogs/{logId} (Strict append-only water ledger)
 *      * farms/{farmId}/actionRecommendations/{recId}
 *  - Bi-directional offline resilience: operates seamlessly during field dead zones, buffering updates
 *    and falling back to persistent reactive local store, while auto-syncing when Cloud connection returns.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore';
import { db, isLiveFirebaseConfigured } from './config.js';
import { mockFirestore } from './mockFirestore.js';
import { backendSyncService } from './backendSyncService.js';

export const FARM_ID = "farm-valley-1";

export class FirestoreDataService {
  constructor() {
    this.db = db;
    this.useLive = Boolean(isLiveFirebaseConfigured && this.db !== null);
    console.log(`[FirestoreService] Active Backend Mode: ${this.useLive ? 'CLOUD FIRESTORE (LIVE & OFFLINE PERSISTENT)' : 'REACTIVE PERSISTENT LOCAL NO-SQL'}`);
  }

  // =========================================================================
  // 1. User Profiles: users/{userId}
  // =========================================================================

  /**
   * Fetch a user profile document by UID
   * @param {string} userId
   */
  async getUserProfile(userId) {
    if (!userId) return null;

    if (this.useLive) {
      try {
        const userRef = doc(this.db, "users", userId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("[FirestoreService] Error fetching user profile from Cloud Firestore:", err.message);
      }
    }

    // Fallback to local storage
    try {
      if (typeof localStorage !== 'undefined') {
        const cached = localStorage.getItem("agrispectra_offline_profile");
        if (cached) {
          const profile = JSON.parse(cached);
          if (profile.uid === userId) return profile;
        }
      }
    } catch (e) {
      // Ignore
    }

    return null;
  }

  /**
   * Create or update a user profile
   * @param {Object} userData
   */
  async saveUserProfile(userData) {
    if (!userData || !userData.uid) throw new Error("User UID required to save profile.");

    const now = new Date();
    const profilePayload = {
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName || userData.email?.split('@')[0] || "Farmer",
      photoURL: userData.photoURL || null,
      role: userData.role || "farm_owner",
      farmId: userData.farmId || FARM_ID,
      farmIds: userData.farmIds || [userData.farmId || FARM_ID],
      lastLoginAt: this.useLive ? serverTimestamp() : now.toISOString(),
      updatedAt: this.useLive ? serverTimestamp() : now.toISOString()
    };

    if (this.useLive) {
      try {
        const userRef = doc(this.db, "users", userData.uid);
        await setDoc(userRef, profilePayload, { merge: true });
        console.log(`[FirestoreService] Saved user profile in Cloud Firestore: ${userData.uid}`);
      } catch (err) {
        console.warn("[FirestoreService] Failed to write user profile to Cloud Firestore, buffered locally:", err.message);
      }
    }

    // Mirror to local cache
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem("agrispectra_offline_profile", JSON.stringify({
          ...profilePayload,
          lastLoginAt: now.toISOString(),
          updatedAt: now.toISOString()
        }));
      }
    } catch (e) {
      // Ignore
    }

    return profilePayload;
  }

  // =========================================================================
  // 2. Farm Root Document: farms/{farmId}
  // =========================================================================

  /**
   * Read farm root metadata
   * @param {string} farmId
   */
  async getFarm(farmId = FARM_ID) {
    if (this.useLive) {
      try {
        const farmRef = doc(this.db, "farms", farmId);
        const snap = await getDoc(farmRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("[FirestoreService] Error reading farm doc from Cloud Firestore:", err.message);
      }
    }
    return mockFirestore.getChannelSnapshot('farm');
  }

  /**
   * Subscribe to real-time farm root updates
   * @param {string} farmId
   * @param {Function} callback
   */
  subscribeFarm(farmId = FARM_ID, callback) {
    if (this.useLive) {
      try {
        const farmRef = doc(this.db, "farms", farmId);
        return onSnapshot(farmRef, (snap) => {
          if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() });
          } else {
            callback(mockFirestore.getChannelSnapshot('farm'));
          }
        }, (err) => {
          console.warn("[FirestoreService] Farm snapshot error, using local fallback:", err.message);
          mockFirestore.subscribe('farm', callback);
        });
      } catch (err) {
        console.warn("[FirestoreService] Init farm subscribe error:", err.message);
      }
    }
    return mockFirestore.subscribe('farm', callback);
  }

  /**
   * Update Farm document
   * @param {string} farmId
   * @param {Object} data
   */
  async updateFarm(farmId = FARM_ID, data) {
    if (this.useLive) {
      try {
        const farmRef = doc(this.db, "farms", farmId);
        await updateDoc(farmRef, {
          ...data,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("[FirestoreService] Live updateFarm error:", err.message);
      }
    }
    if (mockFirestore.data.farmId === farmId) {
      mockFirestore.data = { ...mockFirestore.data, ...data };
      mockFirestore.saveData();
      mockFirestore.notify('farm');
    }
    return { success: true };
  }

  // =========================================================================
  // 3. Plots Subcollection: farms/{farmId}/plots/{plotId}
  // =========================================================================

  /**
   * Subscribe to 6-Zone Plots with real-time updates and offline synchronization
   * @param {Function} callback
   */
  subscribePlots(callback) {
    if (this.useLive) {
      try {
        const plotsRef = collection(this.db, "farms", FARM_ID, "plots");
        return onSnapshot(plotsRef, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('plots'));
            return;
          }
          const plots = [];
          snapshot.forEach((doc) => {
            const plotData = { id: doc.id, ...doc.data() };
            plots.push(plotData);
            // Synchronize with local mock Firestore cache so offline transitions are seamless
            if (mockFirestore.data.plots[doc.id]) {
              mockFirestore.data.plots[doc.id] = {
                ...mockFirestore.data.plots[doc.id],
                ...plotData
              };
            }
          });
          plots.sort((a, b) => (a.plotNumber || 0) - (b.plotNumber || 0));
          mockFirestore.saveData();
          callback(plots);
        }, (error) => {
          console.warn("[FirestoreService] Live plots subscription error, using local fallback:", error);
          mockFirestore.subscribe('plots', callback);
        });
      } catch (err) {
        console.warn("[FirestoreService] Live plots init error, falling back to local:", err);
      }
    }
    return mockFirestore.subscribe('plots', callback);
  }

  /**
   * Update Plot document directly
   * @param {string} plotId
   * @param {Object} plotData
   */
  async updatePlot(plotId, plotData) {
    mockFirestore.updatePlot(plotId, plotData);

    if (this.useLive) {
      try {
        const plotRef = doc(this.db, "farms", FARM_ID, "plots", plotId);
        await updateDoc(plotRef, {
          ...plotData,
          updatedAt: serverTimestamp()
        });
      } catch (err) {
        console.warn("[FirestoreService] Cloud updatePlot note:", err.message);
      }
    }
    return { success: true };
  }

  /**
   * Actuate Solenoid Valve (Gate G1 to G6)
   * Sends +12V pulse to latch OPEN, -12V reverse pulse to latch CLOSED.
   * Records immutable append-only log in irrigationLogs.
   */
  async actuateValve({ plotId, gateId, action, durationMinutes = 20, triggeredBy = "MANUAL", operatorId = null }) {
    const now = new Date();
    const isOpening = action === "OPEN";
    const timerEnd = isOpening ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : null;
    const pulseVoltage = isOpening ? 12 : -12;

    // 1. Update local reactive store for 0ms instantaneous UI feedback
    mockFirestore.updatePlot(plotId, {
      valve: {
        id: gateId,
        state: isOpening ? "OPEN" : "CLOSED",
        flowRate: 480.0,
        timerEnd: timerEnd
      },
      updatedAt: now.toISOString()
    });

    // 2. Record immutable append-only Irrigation Log
    const logDoc = {
      plotId,
      valveId: gateId,
      action: isOpening ? "OPEN" : "CLOSE",
      durationMinutes: isOpening ? durationMinutes : 0,
      litersDelivered: isOpening ? 0 : 160.0,
      triggeredBy,
      operatorId: operatorId || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || null
    };
    mockFirestore.addIrrigationLog(logDoc);

    // 3. Write directly to Cloud Firestore `(default)`
    if (this.useLive) {
      try {
        const plotRef = doc(this.db, "farms", FARM_ID, "plots", plotId);
        await updateDoc(plotRef, {
          "valve.state": isOpening ? "OPEN" : "CLOSED",
          "valve.timerEnd": timerEnd,
          "updatedAt": serverTimestamp()
        });

        const logsRef = collection(this.db, "farms", FARM_ID, "irrigationLogs");
        await addDoc(logsRef, {
          ...logDoc,
          timestamp: serverTimestamp()
        });
      } catch (err) {
        console.warn("[FirestoreService] Cloud Firestore valve actuation write queued/buffered:", err.message);
      }
    }

    // Direct asynchronous telemetry dispatch to Enterprise Backend Server
    backendSyncService.syncTelemetryPacket({
      farmId: FARM_ID,
      plotId,
      action: isOpening ? "OPEN" : "CLOSE",
      durationMinutes,
      operator: operatorId || triggeredBy
    }).catch(() => {});

    return { success: true, action, timerEnd, pulseVoltage };
  }

  /**
   * Emergency 1-tap "Shut Off All Valves"
   * Shuts off all active solenoid valves simultaneously.
   */
  async emergencyShutOffAll() {
    const plots = mockFirestore.getChannelSnapshot('plots') || [];
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

    // Trigger Enterprise Backend Emergency Shutdown
    backendSyncService.triggerEnterpriseKillswitch("MOBILE_APP_1_TAP", "Emergency shutoff from mobile client").catch(() => {});

    return { success: true, closedCount };
  }

  /**
   * Update Plot Telemetry from MQTT or sensor cycle
   */
  updatePlotTelemetry(plotId, soilSensors, totalLiters) {
    mockFirestore.updatePlot(plotId, {
      soilSensors,
      totalLitersDelivered: totalLiters
    });

    if (this.useLive) {
      try {
        const plotRef = doc(this.db, "farms", FARM_ID, "plots", plotId);
        updateDoc(plotRef, {
          soilSensors,
          totalLitersDelivered: totalLiters,
          updatedAt: serverTimestamp()
        }).catch(() => {});
      } catch (e) {
        // Telemetry ticks are high-frequency; silent fallback
      }
    }
  }

  // =========================================================================
  // 4. Leaf Spectroscopy Scans: farms/{farmId}/leafScans/{scanId}
  // =========================================================================

  /**
   * Subscribe to Leaf Spectroscopy Scans
   * @param {Function} callback
   */
  subscribeLeafScans(callback) {
    if (this.useLive) {
      try {
        const scansRef = collection(this.db, "farms", FARM_ID, "leafScans");
        const q = query(scansRef, orderBy("scannedAt", "desc"), limit(50));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('leafScans'));
            return;
          }
          const scans = [];
          snapshot.forEach((doc) => {
            scans.push({ id: doc.id, ...doc.data() });
          });
          callback(scans);
        }, (err) => {
          console.warn("[FirestoreService] Error reading scans from Cloud Firestore:", err.message);
          mockFirestore.subscribe('leafScans', callback);
        });
      } catch (err) {
        console.warn("[FirestoreService] Scans subscription init error:", err.message);
      }
    }
    return mockFirestore.subscribe('leafScans', callback);
  }

  /**
   * Save a newly acquired Leaf Spectroscopy Scan directly to Cloud Firestore
   * @param {Object} scanData
   */
  async saveLeafScan(scanData) {
    // 1. Add to local mock store and trigger closed-loop synergy evaluation
    const scanId = mockFirestore.addLeafScan({
      plotId: scanData.plotId,
      crop: scanData.crop,
      gpsLocation: scanData.gpsLocation || { latitude: 36.7783, longitude: -119.4179 },
      vitalityScore: scanData.vitalityScore,
      leafWaterIndex: scanData.indices?.leafWaterIndex ?? scanData.leafWaterIndex,
      nitrogenPrescriptionKg: scanData.nitrogenPrescriptionKg,
      diseaseRisk: scanData.diseaseRisk,
      harvest: scanData.harvest,
      rawSpectrumPreview: (scanData.rawSpectrumPreview || []).slice(0, 30)
    });

    // 2. Write directly to Cloud Firestore collection `farms/{farmId}/leafScans`
    if (this.useLive) {
      try {
        const scansRef = collection(this.db, "farms", FARM_ID, "leafScans");
        await addDoc(scansRef, {
          plotId: scanData.plotId,
          vitalityScore: Number(scanData.vitalityScore) || 0,
          leafWaterIndex: Number(scanData.indices?.leafWaterIndex ?? scanData.leafWaterIndex) || 0,
          nitrogenPrescriptionKg: Number(scanData.nitrogenPrescriptionKg) || 0,
          diseaseRisk: scanData.diseaseRisk || null,
          rawSpectrumPreview: (scanData.rawSpectrumPreview || []).slice(0, 30),
          gpsLocation: scanData.gpsLocation || { latitude: 36.7783, longitude: -119.4179 },
          crop: scanData.crop || "Crop Canopy",
          scannedAt: serverTimestamp()
        });
        console.log(`[FirestoreService] Saved leaf scan directly to Cloud Firestore: ${scanId}`);
      } catch (e) {
        console.warn("[FirestoreService] Failed to write live scan to Cloud Firestore:", e.message);
      }
    }

    // Direct asynchronous sync to Enterprise Backend Server
    backendSyncService.syncLeafScan(scanData).catch(() => {});

    return scanId;
  }

  // =========================================================================
  // 5. Irrigation Logs: farms/{farmId}/irrigationLogs/{logId} (APPEND-ONLY)
  // =========================================================================

  /**
   * Subscribe to real-time Irrigation Logs
   * @param {Function} callback
   */
  subscribeIrrigationLogs(callback) {
    if (this.useLive) {
      try {
        const logsRef = collection(this.db, "farms", FARM_ID, "irrigationLogs");
        const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('irrigationLogs'));
            return;
          }
          const logs = [];
          snapshot.forEach((doc) => {
            logs.push({ id: doc.id, ...doc.data() });
          });
          callback(logs);
        }, (err) => {
          console.warn("[FirestoreService] Error reading live irrigation logs:", err.message);
          mockFirestore.subscribe('irrigationLogs', callback);
        });
      } catch (err) {
        console.warn("[FirestoreService] Irrigation logs subscription init error:", err.message);
      }
    }
    return mockFirestore.subscribe('irrigationLogs', callback);
  }

  /**
   * Direct record to Irrigation Logs
   * @param {Object} logData
   */
  async recordIrrigationLog(logData) {
    const id = mockFirestore.addIrrigationLog(logData);
    if (this.useLive) {
      try {
        const logsRef = collection(this.db, "farms", FARM_ID, "irrigationLogs");
        await addDoc(logsRef, {
          ...logData,
          timestamp: serverTimestamp()
        });
      } catch (e) {
        console.warn("[FirestoreService] Direct log write error:", e.message);
      }
    }
    return id;
  }

  // =========================================================================
  // 6. Action Recommendations: farms/{farmId}/actionRecommendations/{recId}
  // =========================================================================

  /**
   * Subscribe to Closed-Loop Action Recommendations
   * @param {Function} callback
   */
  subscribeActionRecommendations(callback) {
    if (this.useLive) {
      try {
        const recsRef = collection(this.db, "farms", FARM_ID, "actionRecommendations");
        const q = query(recsRef, orderBy("generatedAt", "desc"), limit(50));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('actionRecommendations'));
            return;
          }
          const recs = [];
          snapshot.forEach((doc) => {
            recs.push({ id: doc.id, ...doc.data() });
          });
          callback(recs);
        }, (err) => {
          console.warn("[FirestoreService] Live action recommendations subscription error:", err.message);
          mockFirestore.subscribe('actionRecommendations', callback);
        });
      } catch (err) {
        console.warn("[FirestoreService] Recommendations init error:", err.message);
      }
    }
    return mockFirestore.subscribe('actionRecommendations', callback);
  }

  /**
   * Handle Smart Recommendation Action (APPROVE / DISMISS)
   * @param {string} recId
   * @param {"APPROVE"|"DISMISS"} action
   * @param {string} justification
   */
  async handleRecommendationAction(recId, action, justification = "") {
    const recs = mockFirestore.getChannelSnapshot('actionRecommendations') || [];
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
      mockFirestore.updateActionRecommendation(recId, { 
        status: "DISMISSED",
        dismissalJustification: justification || "Operator dismissed"
      });
    }

    if (this.useLive) {
      try {
        const recRef = doc(this.db, "farms", FARM_ID, "actionRecommendations", recId);
        await updateDoc(recRef, {
          status: action === "APPROVE" ? "APPROVED" : "DISMISSED",
          updatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("[FirestoreService] Cloud update recommendation status note:", e.message);
      }
    }
  }

  /**
   * Create an action recommendation document directly
   * @param {Object} recData
   */
  async createActionRecommendation(recData) {
    const id = mockFirestore.addActionRecommendation(recData);
    if (this.useLive) {
      try {
        const recsRef = collection(this.db, "farms", FARM_ID, "actionRecommendations");
        await addDoc(recsRef, {
          ...recData,
          status: "PENDING",
          generatedAt: serverTimestamp()
        });
      } catch (e) {
        console.warn("[FirestoreService] Live recommendation creation error:", e.message);
      }
    }
    return id;
  }

  // =========================================================================
  // 7. User Preferences: userPreferences/{userId} (agrispectra_user_prefs)
  // =========================================================================

  /**
   * Save user dashboard and UI preferences
   * Synchronizes with Cloud Firestore `userPreferences/{userId}` and local storage
   * @param {string} userId
   * @param {Object} preferences
   */
  async saveUserPreferences(userId, preferences = {}) {
    const effectiveUid = userId || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'default';

    // 1. Instantly save to persistent local store (0ms UI latency)
    const localResult = mockFirestore.saveUserPreferences(effectiveUid, preferences);

    // 2. Persist to Cloud Firestore if connected
    if (this.useLive) {
      try {
        const prefRef = doc(this.db, "userPreferences", effectiveUid);
        await setDoc(prefRef, {
          ...preferences,
          userId: effectiveUid,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log(`[FirestoreService] Saved user preferences to Cloud Firestore: ${effectiveUid}`);
      } catch (err) {
        console.warn("[FirestoreService] Could not write user preferences to Cloud Firestore, cached locally:", err.message);
      }
    }

    return localResult;
  }

  /**
   * Load user dashboard and UI preferences
   * Fetches from Cloud Firestore or falls back gracefully to offline cache
   * @param {string} userId
   */
  async getUserPreferences(userId) {
    const effectiveUid = userId || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'default';

    if (this.useLive) {
      try {
        const prefRef = doc(this.db, "userPreferences", effectiveUid);
        const snap = await getDoc(prefRef);
        if (snap.exists()) {
          const remoteData = { id: snap.id, ...snap.data() };
          mockFirestore.saveUserPreferences(effectiveUid, remoteData);
          return remoteData;
        }
      } catch (err) {
        console.warn("[FirestoreService] Error reading user preferences from Cloud Firestore, falling back to local store:", err.message);
      }
    }

    return mockFirestore.getUserPreferences(effectiveUid);
  }

  /**
   * Subscribe to real-time user preference updates
   * @param {string} userId
   * @param {Function} callback
   */
  subscribeUserPreferences(userId, callback) {
    const effectiveUid = userId || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'default';

    if (this.useLive) {
      try {
        const prefRef = doc(this.db, "userPreferences", effectiveUid);
        return onSnapshot(prefRef, (snap) => {
          if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() };
            mockFirestore.saveUserPreferences(effectiveUid, data);
            callback(data);
          } else {
            callback(mockFirestore.getUserPreferences(effectiveUid));
          }
        }, (err) => {
          console.warn("[FirestoreService] User preferences snapshot note, using local fallback:", err.message);
          mockFirestore.subscribe('userPreferences', () => callback(mockFirestore.getUserPreferences(effectiveUid)));
        });
      } catch (err) {
        console.warn("[FirestoreService] User preferences subscribe error:", err.message);
      }
    }

    return mockFirestore.subscribe('userPreferences', () => callback(mockFirestore.getUserPreferences(effectiveUid)));
  }

  // =========================================================================
  // 8. Aggregated Usage Statistics (Offline-First Resilient Analytics)
  // =========================================================================

  /**
   * Fetch aggregated usage statistics across the farm:
   *  - Total liters delivered today (last 24h) and all-time
   *  - Valve cycle count per plot
   *  - Total leaf scans conducted
   *  - Average canopy vitality
   * 
   * Seamlessly falls back to local cache if Firestore is offline or fails.
   * @param {string} farmId
   */
  async getAggregatedStats(farmId = FARM_ID) {
    if (this.useLive) {
      try {
        const logsRef = collection(this.db, "farms", farmId, "irrigationLogs");
        const scansRef = collection(this.db, "farms", farmId, "leafScans");
        const plotsRef = collection(this.db, "farms", farmId, "plots");

        const [logsSnap, scansSnap, plotsSnap] = await Promise.all([
          getDocs(logsRef),
          getDocs(scansRef),
          getDocs(plotsRef)
        ]);

        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        let totalLitersDeliveredToday = 0;
        let totalLitersDeliveredAllTime = 0;
        const valveCycleCountPerPlot = {};

        plotsSnap.forEach((doc) => {
          valveCycleCountPerPlot[doc.id] = 0;
        });

        logsSnap.forEach((doc) => {
          const log = doc.data();
          const liters = Number(log.litersDelivered) || 0;
          totalLitersDeliveredAllTime += liters;
          const ts = log.timestamp?.toDate ? log.timestamp.toDate().getTime() : (log.timestamp ? new Date(log.timestamp).getTime() : 0);
          if ((now - ts) <= oneDayMs) {
            totalLitersDeliveredToday += liters;
          }
          if (log.plotId) {
            valveCycleCountPerPlot[log.plotId] = (valveCycleCountPerPlot[log.plotId] || 0) + 1;
          }
        });

        const totalLeafScansConducted = scansSnap.size;
        let vitalitySum = 0;
        scansSnap.forEach((doc) => {
          vitalitySum += (Number(doc.data().vitalityScore) || 0);
        });
        const averageCanopyVitality = totalLeafScansConducted > 0
          ? Math.round((vitalitySum / totalLeafScansConducted) * 10) / 10
          : 85.0;

        return {
          farmId,
          totalLitersDeliveredToday: Math.round(totalLitersDeliveredToday * 10) / 10,
          totalLitersDeliveredAllTime: Math.round(totalLitersDeliveredAllTime * 10) / 10,
          valveCycleCountPerPlot,
          totalLeafScansConducted,
          averageCanopyVitality,
          timestamp: new Date().toISOString()
        };
      } catch (err) {
        console.warn("[FirestoreService] Live aggregated stats query error, falling back to local:", err.message);
      }
    }

    return mockFirestore.getAggregatedStats(farmId);
  }
}

export const firestoreService = new FirestoreDataService();
