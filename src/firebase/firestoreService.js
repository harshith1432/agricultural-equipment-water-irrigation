/**
 * AgriSpectra Flow & Field - Unified Cloud Firestore & Multi-Tenant Isolated Data Service
 * 
 * Architecture & Invariants:
 *  - Direct live connection to Cloud Firestore `(default)` database with automatic offline persistence.
 *  - Dynamic multi-tenant user isolation chambers:
 *      * carlos (`farm-carlos-valley-1`): Sonoma Valley Drip Vineyard (6 crop zones: Potato, Tomato, Bell Pepper, Corn, Wheat, Cotton)
 *      * elena (`farm-elena-research-2`): Salinas Agronomy Research Hub (Research crops: Sugarcane, Paddy Rice, Chilli)
 *      * mateo (`farm-mateo-hydraulic-3`): Central Valley Hydraulic Orchard (Orchard crops: Citrus, Almonds, Pistachio)
 *      * guest (`farm-guest-local-0`): Offline Sandbox Parcel
 *      * dynamically registered users: `farm_${uid}`
 *  - Real-time `onSnapshot` listeners syncing live telemetry directly into mobile app UI components.
 *  - Full document & collection operations for:
 *      * users/{userId}
 *      * farms/{farmId}
 *      * farms/{farmId}/plots/{plotId}
 *      * farms/{farmId}/crops/{cropId}
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
  deleteDoc,
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
    this.currentUser = null;
    console.log(`[FirestoreService] Active Backend Mode: ${this.useLive ? 'CLOUD FIRESTORE (LIVE & OFFLINE PERSISTENT)' : 'REACTIVE PERSISTENT LOCAL NO-SQL'}`);
  }

  get currentFarmId() {
    return mockFirestore.currentFarmId;
  }

  set currentFarmId(val) {
    mockFirestore.currentFarmId = val;
  }

  /**
   * Set the active user and dynamically bind queries to that user's farm isolation chamber
   * @param {Object} user
   */
  setActiveUser(user) {
    this.currentUser = user;
    if (!user) {
      this.currentFarmId = null;
      mockFirestore.resetActiveChamber();
      return null;
    }

    let farmId;
    if (user.uid === 'system-admin-harshith' || user.email === 'harshithkd0321@gmail.com') {
      farmId = 'farm-valley-1';
    } else if (user.farmId) {
      farmId = user.farmId;
    } else if (user.uid === 'user-carlos-1' || user.uid === 'usr-demo-01' || user.uid === 'usr-ent-01') {
      farmId = 'farm-valley-1';
    } else if (user.uid === 'user-elena-2' || user.uid === 'usr-ent-03') {
      farmId = 'farm-elena-research-2';
    } else if (user.uid === 'user-mateo-3' || user.uid === 'usr-ent-04') {
      farmId = 'farm-mateo-hydraulic-3';
    } else if (user.uid === 'offline-guest' || user.uid === 'guest-offline-farmer') {
      farmId = 'farm-guest-local-0';
    } else if (user.uid) {
      farmId = 'farm_' + user.uid;
    } else {
      farmId = FARM_ID;
    }

    this.currentFarmId = farmId;
    mockFirestore.setActiveFarm(farmId, user);
    return farmId;
  }

  /**
   * Helper to dispatch a Cloud Firestore mutation.
   * Runs in non-blocking background task with bounded timeout (1200ms) race safeguard.
   * Ensures callers and UI components are never blocked or frozen by Firestore network latency.
   * @param {Function} mutationFn Async function executing the Cloud Firestore write
   * @param {string} desc Operation description for diagnostics
   * @param {number} timeoutMs Max wait time for bounded race (default 1200ms)
   */
  _dispatchCloudMutation(mutationFn, desc = 'mutation', timeoutMs = 1200) {
    if (!this.useLive || !this.db) return;

    (async () => {
      try {
        await Promise.race([
          mutationFn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Bounded cloud timeout (${timeoutMs}ms)`)), timeoutMs)
          )
        ]);
        console.log(`[FirestoreService] Real-time ${desc} synced to Cloud Firestore.`);
      } catch (err) {
        console.warn(`[FirestoreService] Cloud ${desc} buffered/backgrounded:`, err.message);
      }
    })();
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
    const effectiveFarmId = userData.farmId || (userData.uid ? 'farm_' + userData.uid : this.currentFarmId);
    const profilePayload = {
      uid: userData.uid,
      email: userData.email,
      displayName: userData.displayName || userData.email?.split('@')[0] || "Farmer",
      photoURL: userData.photoURL || null,
      role: userData.role || "farm_owner",
      farmId: effectiveFarmId,
      farmIds: userData.farmIds || [effectiveFarmId],
      lastLoginAt: this.useLive ? serverTimestamp() : now.toISOString(),
      updatedAt: this.useLive ? serverTimestamp() : now.toISOString()
    };

    // Mirror to local cache synchronously (0ms)
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

    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const userRef = doc(this.db, "users", userData.uid);
        await setDoc(userRef, profilePayload, { merge: true });
        console.log(`[FirestoreService] Saved user profile in Cloud Firestore: ${userData.uid}`);
      }, `saveUserProfile (${userData.uid})`);
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
  async getFarm(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (!targetFarm) return null;
    if (this.useLive) {
      try {
        const farmRef = doc(this.db, "farms", targetFarm);
        const snap = await getDoc(farmRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("[FirestoreService] Error reading farm doc from Cloud Firestore:", err.message);
      }
    }
    return mockFirestore.getChannelSnapshot('farm', targetFarm);
  }

  /**
   * Subscribe to real-time farm root updates
   * Supports subscribeFarm(callback) or subscribeFarm(farmId, callback)
   */
  subscribeFarm(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 !== undefined ? arg2 : this.currentFarmId;
    } else {
      farmId = arg1 !== undefined ? arg1 : this.currentFarmId;
      callback = arg2;
    }

    if (!farmId) {
      callback(null);
      return () => {};
    }

    if (this.useLive) {
      try {
        const farmRef = doc(this.db, "farms", farmId);
        return onSnapshot(farmRef, (snap) => {
          if (snap.exists()) {
            callback({ id: snap.id, ...snap.data() });
          } else {
            callback(mockFirestore.getChannelSnapshot('farm', farmId));
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
  async updateFarm(farmId = this.currentFarmId, data = {}) {
    const targetFarm = farmId || this.currentFarmId;

    // 1. Update local reactive store & write synchronously to localStorage (0ms)
    const farmData = mockFirestore.getFarmData(targetFarm);
    Object.assign(farmData, data);
    mockFirestore.saveData(targetFarm);
    if (mockFirestore.normalizeFarmId(targetFarm) === mockFirestore.normalizeFarmId(this.currentFarmId)) {
      mockFirestore.notify('farm');
    }

    // 2. Synchronize to Cloud Firestore in background with bounded timeout
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const farmRef = doc(this.db, "farms", targetFarm);
        await updateDoc(farmRef, {
          ...data,
          updatedAt: serverTimestamp()
        });
      }, `updateFarm (${targetFarm})`);
    }

    return { success: true };
  }

  // =========================================================================
  // 3. Plots Subcollection: farms/{farmId}/plots/{plotId}
  // =========================================================================

  /**
   * Read all plots for a specific farm
   * @param {string} farmId
   */
  async getPlots(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (!targetFarm) return [];
    if (this.useLive) {
      try {
        const plotsRef = collection(this.db, "farms", targetFarm, "plots");
        const snap = await getDocs(plotsRef);
        if (!snap.empty) {
          const plots = [];
          snap.forEach(d => plots.push({ id: d.id, ...d.data() }));
          plots.sort((a, b) => (a.plotNumber || 0) - (b.plotNumber || 0));
          return plots;
        }
      } catch (err) {
        console.warn("[FirestoreService] Live getPlots note, using local fallback:", err.message);
      }
    }
    return mockFirestore.getPlots(targetFarm);
  }

  /**
   * Subscribe to Plots with real-time updates and offline synchronization
   * Supports subscribePlots(callback) or subscribePlots(callback, farmId)
   */
  subscribePlots(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 !== undefined ? arg2 : this.currentFarmId;
    } else {
      farmId = arg1 !== undefined ? arg1 : this.currentFarmId;
      callback = arg2;
    }

    if (!farmId) {
      callback([]);
      return () => {};
    }

    if (this.useLive) {
      try {
        // Immediate local snapshot emission (0ms initial render)
        try {
          const cached = mockFirestore.getChannelSnapshot('plots', farmId);
          if (cached && cached.length > 0) {
            callback(cached);
          }
        } catch (e) {}

        const plotsRef = collection(this.db, "farms", farmId, "plots");
        return onSnapshot(plotsRef, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('plots', farmId));
            return;
          }
          const plots = [];
          snapshot.forEach((doc) => {
            const plotData = { id: doc.id, ...doc.data() };
            plots.push(plotData);
            const chamberData = mockFirestore.getFarmData(farmId);
            if (chamberData.plots) {
              chamberData.plots[doc.id] = {
                ...(chamberData.plots[doc.id] || {}),
                ...plotData
              };
            }
          });
          plots.sort((a, b) => (a.plotNumber || 0) - (b.plotNumber || 0));
          mockFirestore.saveData(farmId);
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
   * Create a new plot/crop zone in Firestore under farms/{farmId}/plots/{plotId} and local reactive store.
   * Auto-generates ID if not provided.
   * @param {Object} plotData
   * @param {string} farmId
   */
  async createPlot(plotData = {}, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;

    // 1. Write to local reactive store and localStorage synchronously (0ms instantaneous UI update)
    const createdPlot = mockFirestore.createPlot(plotData, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 2. Synchronize to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const plotRef = doc(this.db, "farms", targetFarm, "plots", createdPlot.id);
        const { id, ...firestorePayload } = createdPlot;
        await setDoc(plotRef, {
          ...firestorePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`[FirestoreService] Real-time Plot created in Cloud Firestore: ${createdPlot.id} under farm ${targetFarm}`);
      }, `createPlot (${createdPlot.id})`);
    }

    return createdPlot;
  }

  /**
   * Update existing plot in Firestore & reactive store in real time
   * @param {string} plotId
   * @param {Object} plotData
   * @param {string} farmId
   */
  async updatePlot(plotId, plotData, farmId = this.currentFarmId) {
    if (!plotId) throw new Error("Plot ID is required for updatePlot.");
    const targetFarm = farmId || this.currentFarmId;

    // 1. Update local reactive store & write synchronously to localStorage (0ms)
    const updated = mockFirestore.updatePlot(plotId, plotData, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 2. Synchronize to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const plotRef = doc(this.db, "farms", targetFarm, "plots", plotId);
        await updateDoc(plotRef, {
          ...plotData,
          updatedAt: serverTimestamp()
        });
        console.log(`[FirestoreService] Live Plot updated in Cloud Firestore: ${plotId}`);
      }, `updatePlot (${plotId})`);
    }

    return { success: true, plot: updated || mockFirestore.getFarmData(targetFarm)?.plots?.[plotId] };
  }

  /**
   * Delete plot/crop from Firestore & reactive store
   * @param {string} plotId
   * @param {string} farmId
   */
  async deletePlot(plotId, farmId = this.currentFarmId) {
    if (!plotId) throw new Error("Plot ID is required for deletePlot.");
    const targetFarm = farmId || this.currentFarmId;

    // 1. Delete from local reactive store & write synchronously to localStorage (0ms)
    const result = mockFirestore.deletePlot(plotId, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 2. Synchronize to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const plotRef = doc(this.db, "farms", targetFarm, "plots", plotId);
        await deleteDoc(plotRef);
        console.log(`[FirestoreService] Real-time Plot deleted from Cloud Firestore: ${plotId}`);
      }, `deletePlot (${plotId})`);
    }

    return result;
  }

  /**
   * Read single plot by ID
   * @param {string} plotId
   * @param {string} farmId
   */
  async getPlot(plotId, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (this.useLive) {
      try {
        const plotRef = doc(this.db, "farms", targetFarm, "plots", plotId);
        const snap = await getDoc(plotRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("[FirestoreService] Error reading plot doc from Cloud Firestore:", err.message);
      }
    }
    return mockFirestore.getFarmData(targetFarm)?.plots?.[plotId] || null;
  }

  /**
   * Actuate Solenoid Valve (Gate G1 to G8)
   * Sends +12V pulse to latch OPEN, -12V reverse pulse to latch CLOSED.
   * Records immutable append-only log in irrigationLogs.
   */
  async actuateValve({ plotId, gateId, action, durationMinutes = 20, triggeredBy = "MANUAL", operatorId = null, farmId = this.currentFarmId }) {
    const targetFarm = farmId || this.currentFarmId;
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
    }, targetFarm);

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
    mockFirestore.addIrrigationLog(logDoc, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 3. Write directly to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const plotRef = doc(this.db, "farms", targetFarm, "plots", plotId);
        await updateDoc(plotRef, {
          "valve.state": isOpening ? "OPEN" : "CLOSED",
          "valve.timerEnd": timerEnd,
          "updatedAt": serverTimestamp()
        });

        const logsRef = collection(this.db, "farms", targetFarm, "irrigationLogs");
        await addDoc(logsRef, {
          ...logDoc,
          timestamp: serverTimestamp()
        });
      }, `actuateValve (${gateId} -> ${action})`);
    }

    // Direct asynchronous telemetry dispatch to Enterprise Backend Server
    backendSyncService.syncTelemetryPacket({
      farmId: targetFarm,
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
  async emergencyShutOffAll(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    const plots = mockFirestore.getChannelSnapshot('plots', targetFarm) || [];
    let closedCount = 0;

    for (const plot of plots) {
      if (plot.valve?.state === "OPEN") {
        await this.actuateValve({
          plotId: plot.id,
          gateId: plot.valve.id,
          action: "CLOSE",
          durationMinutes: 0,
          triggeredBy: "EMERGENCY",
          farmId: targetFarm
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
  updatePlotTelemetry(plotId, soilSensors, totalLiters, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    mockFirestore.updatePlot(plotId, {
      soilSensors,
      totalLitersDelivered: totalLiters
    }, targetFarm);

    if (this.useLive) {
      try {
        const plotRef = doc(this.db, "farms", targetFarm, "plots", plotId);
        updateDoc(plotRef, {
          soilSensors,
          totalLitersDelivered: totalLiters,
          updatedAt: serverTimestamp()
        }).catch(() => {});
      } catch (e) {
        // High-frequency telemetry tick; silent fallback
      }
    }
  }

  // =========================================================================
  // 4. Spectral Scans: farms/{farmId}/spectralScans/{scanId} & leafScans
  // =========================================================================

  /**
   * Subscribe to Spectral Scans
   * Supports subscribeSpectralScans(callback) or subscribeSpectralScans(callback, farmId) or subscribeSpectralScans(farmId, callback)
   */
  subscribeSpectralScans(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 || this.currentFarmId;
    } else {
      farmId = arg1 || this.currentFarmId;
      callback = arg2;
    }

    if (!farmId) {
      if (typeof callback === 'function') callback([]);
      return () => {};
    }

    if (this.useLive) {
      try {
        const scansRef = collection(this.db, "farms", farmId, "spectralScans");
        const q = query(scansRef, orderBy("timestamp", "desc"), limit(100));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('spectralScans', farmId));
            return;
          }
          const scans = [];
          snapshot.forEach((doc) => {
            scans.push({ id: doc.id, ...doc.data() });
          });
          callback(scans);
        }, (err) => {
          console.warn("[FirestoreService] Error reading spectral scans from Cloud Firestore:", err.message);
          mockFirestore.subscribe('spectralScans', callback);
        });
      } catch (err) {
        console.warn("[FirestoreService] Spectral scans subscription init error:", err.message);
      }
    }
    return mockFirestore.subscribe('spectralScans', callback);
  }

  /**
   * Subscribe to Leaf Spectroscopy Scans (Backward Compatibility wrapper)
   * Supports subscribeLeafScans(callback) or subscribeLeafScans(callback, farmId)
   */
  subscribeLeafScans(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 || this.currentFarmId;
    } else {
      farmId = arg1 || this.currentFarmId;
      callback = arg2;
    }

    if (this.useLive) {
      try {
        const scansRef = collection(this.db, "farms", farmId, "leafScans");
        const q = query(scansRef, orderBy("scannedAt", "desc"), limit(50));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('leafScans', farmId));
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
   * Save a newly acquired Spectral Scan directly to Cloud Firestore with atomic offline persistence
   * Enforces authoritative schema:
   *  - id: unique scan ID (e.g. "scan-20261119-042")
   *  - plantNumber: string (e.g. "PLANT-042")
   *  - portNumber: string (e.g. "PORT-08")
   *  - plantName: string (e.g. "Roma Tomato")
   *  - plotId: string (e.g. "plot-1")
   *  - plotNumber: number (e.g. 1)
   *  - crop: string (e.g. "tomato")
   *  - calibrationRef: { darkCurrent, whiteReference, calibratedAt }
   *  - rawReflectance: array of 76 floating-point values [0.0 ... 1.0] (350nm - 1100nm)
   *  - indices: { ndvi, ndre, wbi, cire, vitality, lwi }
   *  - nitrogenPrescriptionKg: number
   *  - irrigationNeedHours: number
   *  - diseaseRisk: string
   *  - hardwareLink: string ("BLE_NUS", "USB_SERIAL", or "SIMULATED")
   *  - timestamp: string (ISO 8601)
   */
  async saveSpectralScan(scanData, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;

    const timestamp = scanData.timestamp || scanData.scannedAt || new Date().toISOString();
    const plotId = scanData.plotId || "plot-1";
    const plotNumber = Number(scanData.plotNumber || (plotId.match(/\d+/) ? parseInt(plotId.match(/\d+/)[0], 10) : 1));
    const plantNumber = String(scanData.plantNumber || `PLANT-${String(plotNumber).padStart(3, '0')}`);
    const portNumber = String(scanData.portNumber || `PORT-0${plotNumber}`);
    const plantName = String(scanData.plantName || scanData.crop || "Specimen Plant");
    const crop = String(scanData.crop || "crop");

    const calibrationRef = scanData.calibrationRef || {
      darkCurrent: Number(scanData.calibrationRef?.darkCurrent ?? 0.015),
      whiteReference: Number(scanData.calibrationRef?.whiteReference ?? 0.985),
      calibratedAt: scanData.calibrationRef?.calibratedAt || timestamp
    };

    const indices = {
      ndvi: Number(scanData.indices?.ndvi ?? scanData.ndvi ?? 0.75),
      ndre: Number(scanData.indices?.ndre ?? scanData.ndre ?? 0.32),
      wbi: Number(scanData.indices?.wbi ?? scanData.wbi ?? 0.92),
      cire: Number(scanData.indices?.cire ?? scanData.cire ?? 2.10),
      vitality: Number(scanData.indices?.vitality ?? scanData.vitalityScore ?? scanData.vitality ?? 85),
      lwi: Number(scanData.indices?.lwi ?? scanData.indices?.leafWaterIndex ?? scanData.leafWaterIndex ?? 0.92)
    };

    const rawReflectance = Array.isArray(scanData.rawReflectance) && scanData.rawReflectance.length === 76
      ? scanData.rawReflectance.map(v => Number(Number(v).toFixed(4)))
      : (Array.isArray(scanData.rawReflectance) && scanData.rawReflectance.length > 0
          ? scanData.rawReflectance.map(v => Number(Number(v).toFixed(4)))
          : (Array.isArray(scanData.rawSpectrumPreview) && scanData.rawSpectrumPreview.length === 76
              ? scanData.rawSpectrumPreview.map(v => Number(Number(v).toFixed(4)))
              : (typeof mockFirestore.generate76BandReflectance === 'function'
                  ? mockFirestore.generate76BandReflectance(indices.ndvi, indices.vitality)
                  : [])));

    const nitrogenPrescriptionKg = Number(scanData.nitrogenPrescriptionKg ?? 0);
    const irrigationNeedHours = Number(scanData.irrigationNeedHours ?? (indices.lwi < 0.82 ? 4 : (indices.lwi < 0.89 ? 18 : 36)));
    const diseaseRisk = typeof scanData.diseaseRisk === 'string' ? scanData.diseaseRisk : (scanData.diseaseRisk?.pathogen || "HEALTHY_OPTIMAL");
    const hardwareLink = ["BLE_NUS", "USB_SERIAL", "SIMULATED"].includes(scanData.hardwareLink) ? scanData.hardwareLink : (scanData.sourceMode || "SIMULATED");
    const id = scanData.id || `scan-${timestamp.slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`;

    const normalizedScan = {
      id,
      plantNumber,
      portNumber,
      plantName,
      plotId,
      plotNumber,
      crop,
      calibrationRef,
      rawReflectance,
      indices,
      nitrogenPrescriptionKg,
      irrigationNeedHours,
      diseaseRisk,
      hardwareLink,
      timestamp,
      // Backward compatibility fields
      scannedAt: timestamp,
      vitalityScore: indices.vitality,
      leafWaterIndex: indices.lwi,
      rawSpectrumPreview: rawReflectance.slice(0, 30),
      gpsLocation: scanData.gpsLocation || { latitude: 36.7783, longitude: -119.4179 }
    };

    // 1. ATOMIC LOCAL PERSISTENCE FIRST (Offline buffer guarantee)
    const scanId = mockFirestore.addSpectralScan(normalizedScan, targetFarm);
    mockFirestore.saveData(targetFarm);

    // Save atomic offline pending sync buffer in localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const offlineQueueKey = `agrispectra_offline_spectral_buffer_${targetFarm}`;
        const existingQueue = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]');
        existingQueue.push({ id: scanId, data: normalizedScan, bufferedAt: new Date().toISOString() });
        localStorage.setItem(offlineQueueKey, JSON.stringify(existingQueue));
      }
    } catch (e) {
      console.warn("[FirestoreService] Offline buffer write note:", e.message);
    }

    // 2. DISPATCH ASYNC SYNC TO CLOUD FIRESTORE CHAMBER
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const scansCol = collection(this.db, "farms", targetFarm, "spectralScans");
        const docRef = doc(scansCol, scanId);
        await setDoc(docRef, {
          ...normalizedScan,
          syncedAt: serverTimestamp()
        }, { merge: true });

        // Backward compatibility mirror in leafScans
        const legacyCol = collection(this.db, "farms", targetFarm, "leafScans");
        await setDoc(doc(legacyCol, scanId), {
          plotId: normalizedScan.plotId,
          crop: normalizedScan.crop,
          vitalityScore: normalizedScan.indices.vitality,
          leafWaterIndex: normalizedScan.indices.lwi,
          nitrogenPrescriptionKg: normalizedScan.nitrogenPrescriptionKg,
          diseaseRisk: normalizedScan.diseaseRisk,
          rawSpectrumPreview: normalizedScan.rawReflectance.slice(0, 30),
          gpsLocation: normalizedScan.gpsLocation,
          scannedAt: serverTimestamp()
        }, { merge: true });

        // Clean from offline queue upon confirmed cloud commit
        try {
          if (typeof localStorage !== 'undefined') {
            const offlineQueueKey = `agrispectra_offline_spectral_buffer_${targetFarm}`;
            const queue = JSON.parse(localStorage.getItem(offlineQueueKey) || '[]');
            const filtered = queue.filter(item => item.id !== scanId);
            localStorage.setItem(offlineQueueKey, JSON.stringify(filtered));
          }
        } catch (e) {}

        console.log(`[FirestoreService] Synced spectral scan directly to Cloud Firestore: ${scanId}`);
      }, `saveSpectralScan (${scanId})`);
    }

    // 3. BACKGROUND SYNC TO ENTERPRISE BACKEND SERVER
    backendSyncService.syncSpectralScan(normalizedScan).catch(() => {});

    return scanId;
  }

  /**
   * Save a newly acquired Leaf Spectroscopy Scan directly to Cloud Firestore (Backward Compatibility)
   * Delegates directly to saveSpectralScan to maintain a unified storage pipeline
   */
  async saveLeafScan(scanData, farmId = this.currentFarmId) {
    return this.saveSpectralScan(scanData, farmId);
  }

  /**
   * Query Spectral Scans with optional filtering by plantNumber, plotId, timestamp, etc.
   */
  getSpectralScans(filter = {}, farmId = this.currentFarmId) {
    return mockFirestore.getSpectralScans(filter, farmId);
  }

  getSpectralScanById(scanId, farmId = this.currentFarmId) {
    return mockFirestore.getSpectralScanById(scanId, farmId);
  }

  getSpectralScansByPlant(plantNumber, farmId = this.currentFarmId) {
    return mockFirestore.getSpectralScansByPlant(plantNumber, farmId);
  }

  getSpectralScansByPlot(plotId, farmId = this.currentFarmId) {
    return mockFirestore.getSpectralScansByPlot(plotId, farmId);
  }

  // =========================================================================
  // 5. Irrigation Logs: farms/{farmId}/irrigationLogs/{logId} (APPEND-ONLY)
  // =========================================================================

  /**
   * Subscribe to real-time Irrigation Logs
   */
  subscribeIrrigationLogs(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 !== undefined ? arg2 : this.currentFarmId;
    } else {
      farmId = arg1 !== undefined ? arg1 : this.currentFarmId;
      callback = arg2;
    }

    if (!farmId) {
      callback([]);
      return () => {};
    }

    if (this.useLive) {
      try {
        const logsRef = collection(this.db, "farms", farmId, "irrigationLogs");
        const q = query(logsRef, orderBy("timestamp", "desc"), limit(100));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('irrigationLogs', farmId));
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
   * @param {string} farmId
   */
  async recordIrrigationLog(logData, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    const id = mockFirestore.addIrrigationLog(logData, targetFarm);
    mockFirestore.saveData(targetFarm);

    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const logsRef = collection(this.db, "farms", targetFarm, "irrigationLogs");
        await addDoc(logsRef, {
          ...logData,
          timestamp: serverTimestamp()
        });
      }, `recordIrrigationLog (${id})`);
    }
    return id;
  }

  async getIrrigationLogs(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (!targetFarm) return [];
    return mockFirestore.getChannelSnapshot('irrigationLogs', targetFarm);
  }

  // =========================================================================
  // 6. Action Recommendations: farms/{farmId}/actionRecommendations/{recId}
  // =========================================================================

  /**
   * Subscribe to Closed-Loop Action Recommendations
   */
  subscribeActionRecommendations(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 !== undefined ? arg2 : this.currentFarmId;
    } else {
      farmId = arg1 !== undefined ? arg1 : this.currentFarmId;
      callback = arg2;
    }

    if (!farmId) {
      callback([]);
      return () => {};
    }

    if (this.useLive) {
      try {
        const recsRef = collection(this.db, "farms", farmId, "actionRecommendations");
        const q = query(recsRef, orderBy("generatedAt", "desc"), limit(50));
        return onSnapshot(q, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getChannelSnapshot('actionRecommendations', farmId));
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
   * @param {string} farmId
   */
  async handleRecommendationAction(recId, action, justification = "", farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    const recs = mockFirestore.getChannelSnapshot('actionRecommendations', targetFarm) || [];
    const rec = recs.find(r => r.id === recId);
    if (!rec) return;

    if (action === "APPROVE") {
      // Actuate the valve immediately
      await this.actuateValve({
        plotId: rec.plotId,
        gateId: rec.gateId,
        action: "OPEN",
        durationMinutes: rec.suggestedDurationMinutes || 25,
        triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
        farmId: targetFarm
      });
      mockFirestore.updateActionRecommendation(recId, { status: "APPROVED" }, targetFarm);
    } else if (action === "DISMISS") {
      mockFirestore.updateActionRecommendation(recId, { 
        status: "DISMISSED",
        dismissalJustification: justification || "Operator dismissed"
      }, targetFarm);
    }
    mockFirestore.saveData(targetFarm);

    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const recRef = doc(this.db, "farms", targetFarm, "actionRecommendations", recId);
        await updateDoc(recRef, {
          status: action === "APPROVE" ? "APPROVED" : "DISMISSED",
          updatedAt: serverTimestamp()
        });
      }, `handleRecommendationAction (${recId})`);
    }
  }

  /**
   * Create an action recommendation document directly
   * @param {Object} recData
   * @param {string} farmId
   */
  async createActionRecommendation(recData, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    const id = mockFirestore.addActionRecommendation(recData, targetFarm);
    mockFirestore.saveData(targetFarm);

    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const recsRef = collection(this.db, "farms", targetFarm, "actionRecommendations");
        await addDoc(recsRef, {
          ...recData,
          status: "PENDING",
          generatedAt: serverTimestamp()
        });
      }, `createActionRecommendation (${id})`);
    }
    return id;
  }

  async getActionRecommendations(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (!targetFarm) return [];
    return mockFirestore.getChannelSnapshot('actionRecommendations', targetFarm);
  }

  // =========================================================================
  // 7. User Preferences: userPreferences/{userId} (agrispectra_user_prefs)
  // =========================================================================

  /**
   * Save user dashboard and UI preferences
   * @param {string} userId
   * @param {Object} preferences
   */
  async saveUserPreferences(userId, preferences = {}) {
    const effectiveUid = userId || this.currentUser?.uid || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'default';

    const localResult = mockFirestore.saveUserPreferences(effectiveUid, preferences);

    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const prefRef = doc(this.db, "userPreferences", effectiveUid);
        await setDoc(prefRef, {
          ...preferences,
          userId: effectiveUid,
          updatedAt: serverTimestamp()
        }, { merge: true });
        console.log(`[FirestoreService] Saved user preferences to Cloud Firestore: ${effectiveUid}`);
      }, `saveUserPreferences (${effectiveUid})`);
    }

    return localResult;
  }

  /**
   * Load user dashboard and UI preferences
   * @param {string} userId
   */
  async getUserPreferences(userId) {
    const effectiveUid = userId || this.currentUser?.uid || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'default';

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
    const effectiveUid = userId || this.currentUser?.uid || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'default';

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
  // 8. Crop Catalog Subcollection: farms/{farmId}/crops/{cropId}
  // =========================================================================

  /**
   * Subscribe to real-time Crop Catalog updates
   * Supports subscribeCropCatalog(callback) or subscribeCropCatalog(callback, farmId)
   */
  subscribeCropCatalog(arg1, arg2) {
    let callback, farmId;
    if (typeof arg1 === 'function') {
      callback = arg1;
      farmId = arg2 !== undefined ? arg2 : this.currentFarmId;
    } else {
      farmId = arg1 !== undefined ? arg1 : this.currentFarmId;
      callback = arg2;
    }

    if (!farmId) {
      callback([]);
      return () => {};
    }

    if (this.useLive) {
      try {
        // Immediate local snapshot emission (0ms initial render)
        try {
          const cached = mockFirestore.getChannelSnapshot('crops', farmId);
          if (cached && cached.length > 0) {
            callback(cached);
          }
        } catch (e) {}

        const cropsRef = collection(this.db, "farms", farmId, "crops");
        return onSnapshot(cropsRef, (snapshot) => {
          if (snapshot.empty) {
            callback(mockFirestore.getCropCatalog(farmId));
            return;
          }
          const crops = [];
          snapshot.forEach((doc) => {
            const cropData = { id: doc.id, ...doc.data() };
            crops.push(cropData);
            const chamberData = mockFirestore.getFarmData(farmId);
            if (chamberData.crops) {
              chamberData.crops[doc.id] = cropData;
            }
          });
          crops.sort((a, b) => a.name.localeCompare(b.name));
          mockFirestore.saveData(farmId);
          callback(crops);
        }, (error) => {
          console.warn("[FirestoreService] Live crops subscription error, using local fallback:", error);
          mockFirestore.subscribeCropCatalog(callback, farmId);
        });
      } catch (err) {
        console.warn("[FirestoreService] Live crops init error, falling back to local:", err);
      }
    }
    return mockFirestore.subscribeCropCatalog(callback, farmId);
  }

  /**
   * Get all crop types from catalog
   * @param {string} farmId
   */
  async getCropCatalog(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (!targetFarm) return [];
    if (this.useLive) {
      try {
        const cropsRef = collection(this.db, "farms", targetFarm, "crops");
        const snap = await getDocs(cropsRef);
        if (!snap.empty) {
          const crops = [];
          snap.forEach(d => {
            const c = { id: d.id, ...d.data() };
            crops.push(c);
            const chamberData = mockFirestore.getFarmData(targetFarm);
            if (chamberData.crops) {
              chamberData.crops[d.id] = c;
            }
          });
          crops.sort((a, b) => a.name.localeCompare(b.name));
          return crops;
        }
      } catch (err) {
        console.warn("[FirestoreService] Live getCropCatalog note, using local fallback:", err.message);
      }
    }
    return mockFirestore.getCropCatalog(targetFarm);
  }

  /**
   * Get single crop type by ID
   * @param {string} cropId
   * @param {string} farmId
   */
  async getCropType(cropId, farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (this.useLive) {
      try {
        const cropRef = doc(this.db, "farms", targetFarm, "crops", cropId);
        const snap = await getDoc(cropRef);
        if (snap.exists()) {
          return { id: snap.id, ...snap.data() };
        }
      } catch (err) {
        console.warn("[FirestoreService] Live getCropType note, using local fallback:", err.message);
      }
    }
    return mockFirestore.getFarmData(targetFarm)?.crops?.[cropId] || null;
  }

  /**
   * Insert a new crop type into Firestore and local reactive store
   * @param {Object} cropData
   * @param {string} farmId
   */
  async addCropType(cropData, farmId = this.currentFarmId) {
    if (!cropData || !cropData.name) {
      throw new Error("Crop name is required to add crop type.");
    }
    const targetFarm = farmId || this.currentFarmId;

    // 1. Write to local reactive store & write synchronously to localStorage (0ms instantaneous UI feedback)
    const createdCrop = mockFirestore.addCropType(cropData, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 2. Synchronize to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const cropRef = doc(this.db, "farms", targetFarm, "crops", createdCrop.id);
        const { id, ...firestorePayload } = createdCrop;
        await setDoc(cropRef, {
          ...firestorePayload,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log(`[FirestoreService] Real-time Crop Type created in Cloud Firestore: ${createdCrop.id}`);
      }, `addCropType (${createdCrop.id})`);
    }

    return createdCrop;
  }

  /**
   * Edit an existing crop type in Firestore and reactive store
   * @param {string} cropId
   * @param {Object} cropData
   * @param {string} farmId
   */
  async updateCropType(cropId, cropData, farmId = this.currentFarmId) {
    if (!cropId) throw new Error("Crop ID is required to update crop type.");
    const targetFarm = farmId || this.currentFarmId;

    // 1. Update local reactive store & write synchronously to localStorage (0ms)
    const updated = mockFirestore.updateCropType(cropId, cropData, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 2. Synchronize to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const cropRef = doc(this.db, "farms", targetFarm, "crops", cropId);
        await updateDoc(cropRef, {
          ...cropData,
          updatedAt: serverTimestamp()
        });
        console.log(`[FirestoreService] Real-time Crop Type updated in Cloud Firestore: ${cropId}`);
      }, `updateCropType (${cropId})`);
    }

    return updated || mockFirestore.getFarmData(targetFarm)?.crops?.[cropId];
  }

  /**
   * Delete a crop type from Firestore and reactive store
   * @param {string} cropId
   * @param {string} farmId
   */
  async deleteCropType(cropId, farmId = this.currentFarmId) {
    if (!cropId) throw new Error("Crop ID is required to delete crop type.");
    const targetFarm = farmId || this.currentFarmId;

    // 1. Delete from local reactive store & write synchronously to localStorage (0ms)
    const result = mockFirestore.deleteCropType(cropId, targetFarm);
    mockFirestore.saveData(targetFarm);

    // 2. Synchronize to Cloud Firestore in background with bounded timeout safeguard
    if (this.useLive) {
      this._dispatchCloudMutation(async () => {
        const cropRef = doc(this.db, "farms", targetFarm, "crops", cropId);
        await deleteDoc(cropRef);
        console.log(`[FirestoreService] Real-time Crop Type deleted from Cloud Firestore: ${cropId}`);
      }, `deleteCropType (${cropId})`);
    }

    return result;
  }

  // =========================================================================
  // 9. Aggregated Usage Statistics (Offline-First Resilient Analytics)
  // =========================================================================

  /**
   * Fetch aggregated usage statistics across the farm
   * @param {string} farmId
   */
  async getAggregatedStats(farmId = this.currentFarmId) {
    const targetFarm = farmId || this.currentFarmId;
    if (this.useLive) {
      try {
        const logsRef = collection(this.db, "farms", targetFarm, "irrigationLogs");
        const scansRef = collection(this.db, "farms", targetFarm, "leafScans");
        const plotsRef = collection(this.db, "farms", targetFarm, "plots");

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
          farmId: targetFarm,
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

    return mockFirestore.getAggregatedStats(targetFarm);
  }

  // =========================================================================
  // 10. Database Connection Verification API
  // =========================================================================

  /**
   * Verifies whether the app is directly connected to the active database (Cloud Firestore or Isolated Local Chamber)
   * Executes a write-and-read roundtrip test, checks query latency, and validates document sync counts.
   * @returns {Promise<{ connected: boolean, mode: 'LIVE_CLOUD' | 'ISOLATED_LOCAL', latencyMs: number, farmId: string, userId: string, syncedCount: number, error: string | null }>}
   */
  async verifyDatabaseConnection() {
    const startTime = Date.now();
    const farmId = this.currentFarmId || FARM_ID;
    const userId = this.currentUser?.uid || (typeof localStorage !== 'undefined' ? JSON.parse(localStorage.getItem('agrispectra_auth_user') || '{}')?.uid : null) || 'offline-grower';

    // 1. If configured for Live Cloud Firestore, test direct cloud write & read with bounded timeout
    if (this.useLive) {
      try {
        const probeRef = doc(this.db, "farms", farmId, "_healthCheck", "connectivity_probe");
        const probePayload = {
          probeId: `probe_${Date.now()}`,
          verifiedAt: serverTimestamp(),
          clientUser: userId
        };
        await Promise.race([
          setDoc(probeRef, probePayload, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Cloud probe write timeout")), 1500))
        ]);
        const snap = await Promise.race([
          getDoc(probeRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Cloud probe read timeout")), 1200))
        ]);
        const latencyMs = Math.max(1, Date.now() - startTime);

        if (snap.exists()) {
          const plots = await this.getPlots(farmId);
          return {
            connected: true,
            mode: 'LIVE_CLOUD',
            latencyMs,
            farmId,
            userId,
            syncedCount: Array.isArray(plots) ? plots.length : 0,
            error: null
          };
        }
      } catch (err) {
        console.warn("[FirestoreService] Live Cloud verification probe failed, evaluating isolated local fallback:", err.message);
      }
    }

    // 2. Validate Isolated Local Multi-Tenant Chamber (Local NoSQL Storage)
    try {
      const probeKey = `_health_probe_${Date.now()}`;
      const probeVal = { verifiedAt: new Date().toISOString(), userId };
      mockFirestore.saveUserPreferences(userId, { [probeKey]: probeVal });
      const prefs = mockFirestore.getUserPreferences(userId);
      const latencyMs = Math.max(1, Date.now() - startTime);
      const plots = mockFirestore.getPlots(farmId);

      const isVerified = Boolean(prefs && prefs[probeKey]);
      return {
        connected: isVerified,
        mode: 'ISOLATED_LOCAL',
        latencyMs,
        farmId,
        userId,
        syncedCount: Array.isArray(plots) ? plots.length : 0,
        error: isVerified ? null : 'Isolated local storage write/read verification failed.'
      };
    } catch (localErr) {
      return {
        connected: false,
        mode: 'ISOLATED_LOCAL',
        latencyMs: Math.max(1, Date.now() - startTime),
        farmId,
        userId,
        syncedCount: 0,
        error: localErr.message
      };
    }
  }
}

export const firestoreService = new FirestoreDataService();
