/**
 * AgriSpectra Enterprise Database Schema & Auto-Provisioning Engine
 * 
 * Logic implemented:
 * 1. On backend startup, verifies the database and checks for all required collections/tables.
 * 2. If a particular table does not exist, automatically creates it with default schema & structure.
 * 3. Fills / merges data coming from the user end (user registrations, IoT telemetry, valve actuations, soil scans).
 * 4. If the table already exists, appends / merges the data without overwriting existing records.
 */

import { firestoreClient } from './firestoreClient.js';
import { enterpriseStore } from './enterpriseStore.js';
import { centralStorage } from './centralStorage.js';
import crypto from 'crypto';

// Authoritative Default Farm Configuration
const DEFAULT_FARMS = [
  {
    id: "farm-valley-1",
    name: "AgriSpectra Precision Block A (1-Acre High-Density)",
    location: "36.7783° N, 119.4179° W",
    totalArea: "1.00 Acre (6 Zones)",
    ownerId: "system-admin-harshith",
    createdAt: new Date().toISOString()
  },
  {
    id: "farm-carlos-valley-1",
    name: "Sonoma Valley Drip Vineyard",
    location: "38.2919° N, 122.4580° W",
    totalArea: "1.00 Acre (6 Zones)",
    ownerId: "user-carlos-1",
    createdAt: new Date().toISOString()
  }
];

// 6 Precision Agricultural Plots (Zones 1 through 6)
const DEFAULT_PLOTS = [
  {
    id: "plot-1",
    name: "Zone 1 - North Orchard",
    crop: "Cabernet Sauvignon",
    areaAcres: 0.16,
    soilType: "Clay Loam",
    valveStatus: "CLOSED",
    targetMoisturePercent: 32,
    currentMoisturePercent: 28.5,
    ec: 1.42,
    soilTempC: 21.8,
    nitrogenPpm: 125,
    phosphorusPpm: 42,
    potassiumPpm: 210,
    ph: 6.8,
    batteryLevel: 98,
    lat: 36.7784,
    lng: -119.4180,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "plot-2",
    name: "Zone 2 - Central Canopy",
    crop: "Pinot Noir",
    areaAcres: 0.17,
    soilType: "Silty Clay Loam",
    valveStatus: "CLOSED",
    targetMoisturePercent: 30,
    currentMoisturePercent: 19.4, // Drought stress simulation
    ec: 1.15,
    soilTempC: 23.4,
    nitrogenPpm: 98,
    phosphorusPpm: 35,
    potassiumPpm: 180,
    ph: 6.5,
    batteryLevel: 94,
    lat: 36.7785,
    lng: -119.4178,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "plot-3",
    name: "Zone 3 - East Terraces",
    crop: "Heirloom Tomatoes",
    areaAcres: 0.17,
    soilType: "Sandy Loam",
    valveStatus: "CLOSED",
    targetMoisturePercent: 34,
    currentMoisturePercent: 31.2,
    ec: 1.55,
    soilTempC: 22.0,
    nitrogenPpm: 140,
    phosphorusPpm: 55,
    potassiumPpm: 245,
    ph: 6.7,
    batteryLevel: 96,
    lat: 36.7783,
    lng: -119.4175,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "plot-4",
    name: "Zone 4 - South Ridge",
    crop: "Russet Potatoes",
    areaAcres: 0.16,
    soilType: "Loamy Sand",
    valveStatus: "CLOSED",
    targetMoisturePercent: 28,
    currentMoisturePercent: 26.8,
    ec: 1.20,
    soilTempC: 20.9,
    nitrogenPpm: 110,
    phosphorusPpm: 38,
    potassiumPpm: 195,
    ph: 6.4,
    batteryLevel: 91,
    lat: 36.7781,
    lng: -119.4177,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "plot-5",
    name: "Zone 5 - West Micro-Climate",
    crop: "Nonpareil Almonds",
    areaAcres: 0.17,
    soilType: "Silt Loam",
    valveStatus: "CLOSED",
    targetMoisturePercent: 35,
    currentMoisturePercent: 33.1,
    ec: 1.48,
    soilTempC: 21.5,
    nitrogenPpm: 130,
    phosphorusPpm: 48,
    potassiumPpm: 220,
    ph: 6.9,
    batteryLevel: 99,
    lat: 36.7782,
    lng: -119.4182,
    lastUpdated: new Date().toISOString()
  },
  {
    id: "plot-6",
    name: "Zone 6 - Experimental Parcel",
    crop: "Spring Wheat",
    areaAcres: 0.17,
    soilType: "Clay Loam",
    valveStatus: "CLOSED",
    targetMoisturePercent: 30,
    currentMoisturePercent: 29.0,
    ec: 1.35,
    soilTempC: 21.1,
    nitrogenPpm: 115,
    phosphorusPpm: 40,
    potassiumPpm: 200,
    ph: 6.6,
    batteryLevel: 95,
    lat: 36.7780,
    lng: -119.4180,
    lastUpdated: new Date().toISOString()
  }
];

// Baseline System Operators
const DEFAULT_USERS = [
  {
    uid: "system-admin-harshith",
    email: "harshithkd032@gmail.com",
    displayName: "Harshith (System Admin)",
    role: "superadmin",
    status: "active",
    farmId: "farm-valley-1",
    farmName: "AgriSpectra Precision Block A (1-Acre High-Density)",
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    uid: "user-carlos-1",
    email: "carlos.mendoza@valleyfarms.com",
    displayName: "Carlos Mendoza",
    role: "farm_owner",
    status: "active",
    farmId: "farm-carlos-valley-1",
    farmName: "Sonoma Valley Drip Vineyard",
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    uid: "user-elena-2",
    email: "elena.rostova@agrispectra.io",
    displayName: "Dr. Elena Rostova",
    role: "agronomist",
    status: "active",
    farmId: "farm-valley-1",
    farmName: "AgriSpectra Precision Block A (1-Acre High-Density)",
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    lastLoginAt: new Date().toISOString()
  },
  {
    uid: "user-mateo-3",
    email: "mateo.field@agrispectra.io",
    displayName: "Mateo Rossi",
    role: "field_operator",
    status: "active",
    farmId: "farm-valley-1",
    farmName: "AgriSpectra Precision Block A (1-Acre High-Density)",
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    lastLoginAt: new Date().toISOString()
  }
];

class SchemaManager {
  constructor() {
    this.isInitialized = false;
    this.verifiedTables = new Set();
  }

  /**
   * Main startup check:
   * Inspects database and verifies / creates all required tables & collections.
   */
  async ensureSchemaAndCollections() {
    console.log("[SchemaManager] 🔍 Checking database connectivity and schema tables...");
    await firestoreClient.ensureReady();

    const db = firestoreClient.adminDb;
    if (!db) {
      console.log(`[SchemaManager] ⚠️ Firebase Admin SDK offline; using resilient fallback store (${firestoreClient.authProvider}).`);
      this.isInitialized = true;
      return { initialized: true, mode: 'local-resilient', tables: [] };
    }

    const tableStatuses = [];

    try {
      // 1. Check Root Collection: 'farms'
      const farmsStatus = await this.ensureFarmsCollection(db);
      tableStatuses.push({ table: 'farms', ...farmsStatus });

      // 2. Check Root Collection: 'users'
      const usersStatus = await this.ensureUsersCollection(db);
      tableStatuses.push({ table: 'users', ...usersStatus });

      // 3. Check Root Collection: 'telemetry_logs'
      const telemetryStatus = await this.ensureTelemetryCollection(db);
      tableStatuses.push({ table: 'telemetry_logs', ...telemetryStatus });

      // 4. Check Root Collection: 'irrigation_logs'
      const irrigationStatus = await this.ensureIrrigationLogsCollection(db);
      tableStatuses.push({ table: 'irrigation_logs', ...irrigationStatus });

      // 5. Check Root Collection: 'soil_scans'
      const soilStatus = await this.ensureSoilScansCollection(db);
      tableStatuses.push({ table: 'soil_scans', ...soilStatus });

      // 6. Check Root Collection: 'audit_logs'
      const auditStatus = await this.ensureAuditLogsCollection(db);
      tableStatuses.push({ table: 'audit_logs', ...auditStatus });

      // 7. Check Root Collection: 'spectral_scans'
      const spectralStatus = await this.ensureSpectralScansCollection(db);
      tableStatuses.push({ table: 'spectral_scans', ...spectralStatus });

      // 8. Load database state into in-memory stores for zero-latency queries
      await this.syncDatabaseStateToMemory(db);

      this.isInitialized = true;
      console.log("[SchemaManager] ✅ All database collections and tables verified & synchronized.");
      return { initialized: true, mode: 'cloud-firestore', tables: tableStatuses };
    } catch (err) {
      console.error("[SchemaManager] ❌ Error during schema verification:", err.message);
      this.isInitialized = true;
      return { initialized: false, error: err.message };
    }
  }

  /**
   * 1. Ensure 'farms' collection and subcollections: plots, actionRecommendations, irrigationLogs, leafScans, crops
   */
  async ensureFarmsCollection(db) {
    const farmsCol = db.collection('farms');
    const snap = await farmsCol.limit(5).get();
    const exists = snap.size > 0;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'farms' not found. Creating table and default farm documents...");
    } else {
      console.log(`[SchemaManager] ✓ Collection 'farms' exists (${snap.size} farms found).`);
    }

    for (const farm of DEFAULT_FARMS) {
      const farmRef = farmsCol.doc(farm.id);
      const farmDoc = await farmRef.get();
      if (!farmDoc.exists) {
        await farmRef.set(farm, { merge: true });
        console.log(`[SchemaManager]   + Created farm document: ${farm.id}`);
      }

      // Check subcollection: plots (plot-1 to plot-6)
      const plotsCol = farmRef.collection('plots');
      const plotsSnap = await plotsCol.limit(10).get();
      if (plotsSnap.size < DEFAULT_PLOTS.length) {
        console.log(`[SchemaManager]   ⚡ Plots subcollection under ${farm.id} incomplete (${plotsSnap.size}/${DEFAULT_PLOTS.length}). Populating plots...`);
        for (const plot of DEFAULT_PLOTS) {
          const plotDocRef = plotsCol.doc(plot.id);
          const pDoc = await plotDocRef.get();
          if (!pDoc.exists) {
            await plotDocRef.set(plot, { merge: true });
          }
        }
        console.log(`[SchemaManager]   ✅ All 6 plots populated under ${farm.id}`);
      }

      // Check subcollection: actionRecommendations
      const recCol = farmRef.collection('actionRecommendations');
      const recSnap = await recCol.limit(1).get();
      if (recSnap.empty) {
        await recCol.doc('rec-plot2-urgent-01').set({
          id: 'rec-plot2-urgent-01',
          plotId: 'plot-2',
          plotName: 'Zone 2 - Central Canopy',
          type: 'IRRIGATION_DEFICIT',
          severity: 'HIGH',
          title: 'Immediate Drip Irrigation Required',
          description: 'Soil moisture dropped to 19.4% (Threshold: 30%). Recommended actuation: 25 minutes (450 Liters).',
          recommendedAction: 'OPEN_VALVE_TIMED',
          recommendedDurationMin: 25,
          waterVolumeLiters: 450,
          status: 'PENDING_OPERATOR_APPROVAL',
          createdAt: new Date().toISOString()
        }, { merge: true });
      }

      // Check subcollection: irrigationLogs
      const logCol = farmRef.collection('irrigationLogs');
      const logSnap = await logCol.limit(1).get();
      if (logSnap.empty) {
        await logCol.doc('log-init-01').set({
          id: 'log-init-01',
          plotId: 'plot-1',
          valveId: 'valve-plot-1',
          action: 'AUTOMATED_PULSE_CYCLE',
          status: 'COMPLETED',
          durationMinutes: 15,
          litersDelivered: 270,
          soilMoistureBefore: 26.2,
          soilMoistureAfter: 32.1,
          operator: 'Autonomous AI Soil Loop',
          timestamp: new Date().toISOString()
        }, { merge: true });
      }

      // Check subcollection: leafScans
      const leafCol = farmRef.collection('leafScans');
      const leafSnap = await leafCol.limit(1).get();
      if (leafSnap.empty) {
        await leafCol.doc('scan-init-plot2').set({
          id: 'scan-init-plot2',
          plotId: 'plot-2',
          crop: 'Pinot Noir',
          ndvi: 0.74,
          chlorophyllIndex: 48.2,
          canopyWaterIndex: 0.81,
          stressDetected: false,
          healthStatus: 'OPTIMAL',
          timestamp: new Date().toISOString()
        }, { merge: true });
      }

      // Check subcollection: spectralScans
      const specCol = farmRef.collection('spectralScans');
      const specSnap = await specCol.limit(1).get();
      if (specSnap.empty) {
        await specCol.doc('scan-20261119-042').set({
          id: 'scan-20261119-042',
          plantNumber: 'PLANT-042',
          portNumber: 'PORT-08',
          plantName: 'Roma Tomato',
          plotId: 'plot-1',
          plotNumber: 1,
          crop: 'tomato',
          calibrationRef: {
            darkCurrent: 0.012,
            whiteReference: 0.985,
            calibratedAt: new Date().toISOString()
          },
          rawReflectance: Array.from({ length: 76 }, (_, i) => Number((0.05 + 0.6 * Math.sin((i / 75) * Math.PI)).toFixed(4))),
          indices: {
            ndvi: 0.78,
            ndre: 0.35,
            wbi: 0.92,
            cire: 2.15,
            vitality: 88,
            lwi: 0.94
          },
          nitrogenPrescriptionKg: 0.0,
          irrigationNeedHours: 36,
          diseaseRisk: 'HEALTHY_OPTIMAL',
          hardwareLink: 'BLE_NUS',
          timestamp: new Date().toISOString()
        }, { merge: true });
      }
    }

    this.verifiedTables.add('farms');
    return { exists, status: 'ready', records: snap.size || DEFAULT_FARMS.length };
  }

  /**
   * 2. Ensure 'users' collection
   */
  async ensureUsersCollection(db) {
    const usersCol = db.collection('users');
    const snap = await usersCol.limit(5).get();
    const exists = snap.size > 0;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'users' not found. Creating table and seeding initial system accounts...");
      for (const u of DEFAULT_USERS) {
        await usersCol.doc(u.uid).set(u, { merge: true });
        console.log(`[SchemaManager]   + Created system user: ${u.email} (${u.role})`);
      }
    } else {
      console.log(`[SchemaManager] ✓ Collection 'users' exists (${snap.size} user accounts found).`);
    }

    this.verifiedTables.add('users');
    return { exists, status: 'ready', records: snap.size || DEFAULT_USERS.length };
  }

  /**
   * 3. Ensure 'telemetry_logs' collection
   */
  async ensureTelemetryCollection(db) {
    const col = db.collection('telemetry_logs');
    const snap = await col.limit(1).get();
    const exists = !snap.empty;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'telemetry_logs' not found. Creating table with baseline IoT telemetry record...");
      await col.doc('telemetry-calibration-init').set({
        id: 'telemetry-calibration-init',
        deviceId: 'gateway-field-alpha-01',
        plotId: 'plot-1',
        farmId: 'farm-valley-1',
        measurements: {
          moisturePercent: 28.5,
          temperatureC: 21.8,
          ec: 1.42,
          humidityPercent: 62.0,
          solarRadiationWm2: 680.0
        },
        batteryPercent: 99.0,
        firmwareVersion: 'v2.4.1-bi-stable',
        status: 'CALIBRATED_ONLINE',
        timestamp: new Date().toISOString()
      }, { merge: true });
    } else {
      console.log("[SchemaManager] ✓ Collection 'telemetry_logs' exists and active.");
    }

    this.verifiedTables.add('telemetry_logs');
    return { exists, status: 'ready' };
  }

  /**
   * 4. Ensure 'irrigation_logs' collection
   */
  async ensureIrrigationLogsCollection(db) {
    const col = db.collection('irrigation_logs');
    const snap = await col.limit(1).get();
    const exists = !snap.empty;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'irrigation_logs' not found. Creating table with baseline actuation log...");
      await col.doc('log-calibration-init').set({
        id: 'log-calibration-init',
        valveId: 'valve-plot-1',
        plotId: 'plot-1',
        farmId: 'farm-valley-1',
        action: 'VALVE_TEST_CYCLE',
        flowRateLpm: 18.0,
        litersApplied: 54.0,
        durationMinutes: 3,
        operator: 'System Provisioning',
        voltagePulseMs: 150,
        timestamp: new Date().toISOString()
      }, { merge: true });
    } else {
      console.log("[SchemaManager] ✓ Collection 'irrigation_logs' exists and active.");
    }

    this.verifiedTables.add('irrigation_logs');
    return { exists, status: 'ready' };
  }

  /**
   * 5. Ensure 'soil_scans' collection
   */
  async ensureSoilScansCollection(db) {
    const col = db.collection('soil_scans');
    const snap = await col.limit(1).get();
    const exists = !snap.empty;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'soil_scans' not found. Creating table with baseline 8-in-1 Modbus scan...");
      await col.doc('soil-scan-init-01').set({
        id: 'soil-scan-init-01',
        plotId: 'plot-1',
        farmId: 'farm-valley-1',
        depthCm: 15,
        sourceMode: 'WIFI_CLOUD',
        measurements: {
          nitrogen: 125,
          phosphorus: 42,
          potassium: 210,
          ph: 6.8,
          moisture: 28.5,
          ec: 1420,
          temperature: 21.8
        },
        agronomicStatus: 'OPTIMAL',
        timestamp: new Date().toISOString()
      }, { merge: true });
    } else {
      console.log("[SchemaManager] ✓ Collection 'soil_scans' exists and active.");
    }

    this.verifiedTables.add('soil_scans');
    return { exists, status: 'ready' };
  }

  /**
   * 6. Ensure 'audit_logs' collection
   */
  async ensureAuditLogsCollection(db) {
    const col = db.collection('audit_logs');
    const snap = await col.limit(1).get();
    const exists = !snap.empty;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'audit_logs' not found. Creating table with system boot audit entry...");
      await col.doc('audit-system-init').set({
        id: 'audit-system-init',
        action: 'SYSTEM_BOOT_INITIALIZATION',
        actor: 'AgriSpectra Backend Engine',
        role: 'system',
        details: 'Cloud database verified. Tables auto-provisioned.',
        ipAddress: '127.0.0.1',
        timestamp: new Date().toISOString()
      }, { merge: true });
    } else {
      console.log("[SchemaManager] ✓ Collection 'audit_logs' exists and active.");
    }

    this.verifiedTables.add('audit_logs');
    return { exists, status: 'ready' };
  }

  /**
   * 7. Ensure 'spectral_scans' collection
   */
  async ensureSpectralScansCollection(db) {
    const col = db.collection('spectral_scans');
    const snap = await col.limit(1).get();
    const exists = !snap.empty;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'spectral_scans' not found. Creating table with baseline 76-band specimen scan...");
      await col.doc('scan-20261119-042').set({
        id: "scan-20261119-042",
        plantNumber: "PLANT-042",
        portNumber: "PORT-08",
        plantName: "Roma Tomato",
        plotId: "plot-1",
        plotNumber: 1,
        crop: "tomato",
        calibrationRef: {
          darkCurrent: 0.012,
          whiteReference: 0.985,
          calibratedAt: new Date().toISOString()
        },
        rawReflectance: Array.from({ length: 76 }, (_, i) => Number((0.05 + 0.6 * Math.sin((i / 75) * Math.PI)).toFixed(4))),
        indices: {
          ndvi: 0.78,
          ndre: 0.35,
          wbi: 0.92,
          cire: 2.15,
          vitality: 88,
          lwi: 0.94
        },
        nitrogenPrescriptionKg: 0.0,
        irrigationNeedHours: 36,
        diseaseRisk: "HEALTHY_OPTIMAL",
        hardwareLink: "BLE_NUS",
        timestamp: new Date().toISOString()
      }, { merge: true });
    } else {
      console.log("[SchemaManager] ✓ Collection 'spectral_scans' exists and active.");
    }

    this.verifiedTables.add('spectral_scans');
    return { exists, status: 'ready' };
  }

  /**
   * Load live Firestore database state into backend in-memory cache
   */
  async syncDatabaseStateToMemory(db) {
    try {
      // Sync users
      const usersSnap = await db.collection('users').get();
      if (!usersSnap.empty) {
        const liveUsers = usersSnap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }));
        for (const lu of liveUsers) {
          const idx = enterpriseStore.users.findIndex(u => u.uid === lu.uid || u.id === lu.uid || u.email === lu.email);
          if (idx >= 0) {
            enterpriseStore.users[idx] = { ...enterpriseStore.users[idx], ...lu };
          } else {
            enterpriseStore.users.push(lu);
          }
        }
        console.log(`[SchemaManager] 🔄 Synced ${liveUsers.length} users from Firestore into backend memory.`);
      }

      // Sync plots
      const plotsSnap = await db.collection('farms').doc('farm-valley-1').collection('plots').get();
      if (!plotsSnap.empty) {
        const livePlots = plotsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        for (const lp of livePlots) {
          const idx = enterpriseStore.plots.findIndex(p => p.id === lp.id);
          if (idx >= 0) {
            enterpriseStore.plots[idx] = { ...enterpriseStore.plots[idx], ...lp };
          }
        }
        console.log(`[SchemaManager] 🔄 Synced ${livePlots.length} plots from Firestore into backend memory.`);
      }
    } catch (e) {
      console.warn("[SchemaManager] Database memory synchronization note:", e.message);
    }
  }

  // ===========================================================================
  // USER DATA FILLING & INGESTION LOGIC
  // "After that, it needs to fill the data which has come from the user end. 
  //  If the table already exists, it needs to go and fill the data. 
  //  So, if the table does not exist, it needs to create the table."
  // ===========================================================================

  /**
   * Generic save/merge helper:
   * Checks if table/collection exists. If not, creates it. Then writes/merges data.
   */
  async saveUserData(collectionName, docId, data, options = { merge: true }) {
    await firestoreClient.ensureReady();
    const db = firestoreClient.adminDb;

    const docPath = `${collectionName}/${docId}`;
    const enrichedData = {
      ...data,
      updatedAt: new Date().toISOString()
    };

    if (db) {
      try {
        const colRef = db.collection(collectionName);
        // Check collection existence
        if (!this.verifiedTables.has(collectionName)) {
          const snap = await colRef.limit(1).get();
          if (snap.empty) {
            console.log('[SchemaManager] Table does not exist. Auto-creating table for user data: %s', collectionName);
          }
          this.verifiedTables.add(collectionName);
        }

        await colRef.doc(docId).set(enrichedData, options);
        console.log('[SchemaManager] ✅ Saved user data to %s (merge: %s)', docPath, Boolean(options.merge));
        return { success: true, docPath, data: enrichedData };
      } catch (err) {
        console.error('[SchemaManager] Error saving document to path %s: %s', docPath, err.message);
      }
    }

    // Fallback via firestoreClient REST or resilient store
    await firestoreClient.setDocument(docPath, enrichedData, options);
    return { success: true, docPath, data: enrichedData };
  }

  /**
   * Ingest user registration from user end:
   * Auto-creates 'users' table if not existing, fills user data, and updates enterprise store.
   */
  async saveUserRegistration(userData) {
    if (!userData || (!userData.uid && !userData.email)) {
      throw new Error("Invalid user registration data. 'uid' or 'email' is required.");
    }

    const secureRand = crypto.randomBytes(4).toString('hex');
    const uid = userData.uid || `usr_${Date.now()}_${secureRand}`;
    const email = String(userData.email || '').trim().toLowerCase();
    const displayName = userData.displayName || (email ? email.split('@')[0] : 'Farmer Operator');
    const role = userData.role || 'Agronomist';
    const farmId = userData.farmId || 'farm-valley-1';
    const farmName = userData.farmName || 'AgriSpectra Precision Block A (1-Acre High-Density)';

    const userProfile = {
      uid,
      id: uid,
      email,
      displayName,
      role,
      farmId,
      farmName,
      status: userData.status || 'active',
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      ...(userData.photoURL ? { photoURL: userData.photoURL } : {})
    };

    // Auto-create 'users' table if not exists and fill data
    await this.saveUserData('users', uid, userProfile, { merge: true });

    // Update in-memory enterprise store
    const existingIdx = enterpriseStore.users.findIndex(u => u.uid === uid || u.email.toLowerCase() === email);
    if (existingIdx >= 0) {
      enterpriseStore.users[existingIdx] = { ...enterpriseStore.users[existingIdx], ...userProfile };
    } else {
      enterpriseStore.users.push(userProfile);
    }

    return userProfile;
  }

  /**
   * Ingest telemetry packet from user/field device:
   * Auto-creates 'telemetry_logs' if not existing, stores packet, and updates plot current readings.
   */
  async saveTelemetryPacket(telemetryData) {
    const plotId = telemetryData.plotId || 'plot-1';
    const farmId = telemetryData.farmId || 'farm-valley-1';
    const docId = `telemetry_${Date.now()}_${plotId}`;

    const packet = {
      id: docId,
      plotId,
      farmId,
      measurements: telemetryData.measurements || {
        moisturePercent: telemetryData.soilMoisture ?? telemetryData.moisture ?? 28.0,
        temperatureC: telemetryData.soilTemp ?? telemetryData.temperature ?? 22.0,
        ec: telemetryData.ec ?? 1.4,
        humidityPercent: telemetryData.humidity ?? 60.0
      },
      batteryPercent: telemetryData.batteryLevel ?? telemetryData.battery ?? 95,
      timestamp: new Date().toISOString()
    };

    // Save to telemetry_logs
    await this.saveUserData('telemetry_logs', docId, packet, { merge: true });

    // Update the plot document under farms/{farmId}/plots/{plotId}
    const plotDocPath = `farms/${farmId}/plots/${plotId}`;
    const plotUpdate = {
      currentMoisturePercent: packet.measurements.moisturePercent,
      soilTempC: packet.measurements.temperatureC,
      ec: packet.measurements.ec,
      batteryLevel: packet.batteryPercent,
      lastUpdated: packet.timestamp
    };

    await this.saveUserData(`farms/${farmId}/plots`, plotId, plotUpdate, { merge: true });

    // Update in-memory enterpriseStore
    const plotIdx = enterpriseStore.plots.findIndex(p => p.id === plotId);
    if (plotIdx >= 0) {
      enterpriseStore.plots[plotIdx] = { ...enterpriseStore.plots[plotIdx], ...plotUpdate };
    }
    enterpriseStore.telemetryPackets.push(packet);

    return packet;
  }

  /**
   * Ingest irrigation action:
   * Auto-creates 'irrigation_logs' if not existing, logs actuation, and updates valve status.
   */
  async saveIrrigationAction(actionData) {
    const valveId = actionData.valveId || 'valve-plot-1';
    const plotId = actionData.plotId || 'plot-1';
    const farmId = actionData.farmId || 'farm-valley-1';
    const docId = `log_${Date.now()}_${plotId}`;

    const record = {
      id: docId,
      valveId,
      plotId,
      farmId,
      action: actionData.action || 'VALVE_ACTUATION',
      state: actionData.state || 'OPEN',
      durationMinutes: actionData.durationMinutes || 0,
      litersDelivered: actionData.litersDelivered || 0,
      operator: actionData.operator || 'Field Operator',
      status: 'ACKNOWLEDGED',
      timestamp: new Date().toISOString()
    };

    // Save to root irrigation_logs and farm subcollection
    await this.saveUserData('irrigation_logs', docId, record, { merge: true });
    await this.saveUserData(`farms/${farmId}/irrigationLogs`, docId, record, { merge: true });

    // Update plot valve status
    await this.saveUserData(`farms/${farmId}/plots`, plotId, {
      valveStatus: record.state === 'OPEN' ? 'OPEN' : 'CLOSED',
      lastActuation: record.timestamp
    }, { merge: true });

    return record;
  }

  /**
   * Ingest soil scan (LABART 8-in-1 Modbus / Wi-Fi):
   * Auto-creates 'soil_scans' if not existing, fills data, and updates plot soil chemistry.
   */
  async saveSoilScan(scanData) {
    const plotId = scanData.plotId || scanData.fieldId || 'plot-1';
    const farmId = scanData.farmId || 'farm-valley-1';
    const docId = `scan_${Date.now()}_${plotId}`;

    const record = {
      id: docId,
      plotId,
      farmId,
      depthCm: scanData.depthCm || 15,
      sourceMode: scanData.sourceMode || 'WIFI_CLOUD',
      measurements: scanData.measurements || {
        nitrogen: scanData.nitrogen || 120,
        phosphorus: scanData.phosphorus || 40,
        potassium: scanData.potassium || 200,
        ph: scanData.ph || 6.5,
        moisture: scanData.moisture || 28.0,
        ec: scanData.ec || 1400,
        temperature: scanData.temperature || 21.5
      },
      timestamp: new Date().toISOString()
    };

    await this.saveUserData('soil_scans', docId, record, { merge: true });
    return record;
  }

  /**
   * Ingest audit log
   */
  async saveAuditLog(auditData) {
    const secureAuditRand = crypto.randomBytes(4).toString('hex');
    const docId = `audit_${Date.now()}_${secureAuditRand}`;
    const log = {
      id: docId,
      action: auditData.action || 'SECURITY_EVENT',
      actor: auditData.actor || 'Anonymous',
      details: auditData.details || '',
      ipAddress: auditData.ipAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    };
    await this.saveUserData('audit_logs', docId, log, { merge: true });
    return log;
  }

  /**
   * Ingest and persist spectral scan (VIS-NIR 350nm-1100nm, 76 bands, specimen metadata)
   * Auto-creates 'spectral_scans' table if not existing, fills data, and updates farm subcollection
   */
  async saveSpectralScan(scanData) {
    const timestamp = scanData.timestamp || scanData.scannedAt || new Date().toISOString();
    const id = scanData.id || `scan-${timestamp.slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const plotId = scanData.plotId || "plot-1";
    const plotNumber = Number(scanData.plotNumber || (plotId.match(/\d+/) ? parseInt(plotId.match(/\d+/)[0], 10) : 1));
    const plantNumber = String(scanData.plantNumber || `PLANT-${String(plotNumber).padStart(3, '0')}`);
    const portNumber = String(scanData.portNumber || `PORT-0${plotNumber}`);
    const plantName = String(scanData.plantName || scanData.crop || "Specimen Plant");
    const farmId = scanData.farmId || "farm-valley-1";
    const crop = String(scanData.crop || "tomato");

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
          : Array.from({ length: 76 }, (_, i) => Number((0.05 + 0.6 * Math.sin((i / 75) * Math.PI)).toFixed(4))));

    const nitrogenPrescriptionKg = Number(scanData.nitrogenPrescriptionKg ?? 0);
    const irrigationNeedHours = Number(scanData.irrigationNeedHours ?? (indices.lwi < 0.82 ? 4 : (indices.lwi < 0.89 ? 18 : 36)));
    const diseaseRisk = typeof scanData.diseaseRisk === 'string' ? scanData.diseaseRisk : (scanData.diseaseRisk?.pathogen || "HEALTHY_OPTIMAL");
    const hardwareLink = ["BLE_NUS", "USB_SERIAL", "SIMULATED"].includes(scanData.hardwareLink) ? scanData.hardwareLink : (scanData.sourceMode || "SIMULATED");

    const record = {
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
      timestamp
    };

    // Auto-create/save to root spectral_scans table
    await this.saveUserData('spectral_scans', id, record, { merge: true });

    // Auto-create/save to farm subcollection
    await this.saveUserData(`farms/${farmId}/spectralScans`, id, record, { merge: true });

    // Update centralStorage in-memory model
    try {
      centralStorage.addSpectroScan({
        id,
        farmId,
        plotId,
        crop,
        timestamp,
        connectionMode: hardwareLink,
        source: hardwareLink,
        rawIntensities: rawReflectance,
        chemometrics: {
          ndvi: indices.ndvi,
          ndre: indices.ndre,
          leafWaterIndex: indices.lwi,
          cire: indices.cire,
          vitalityScore: indices.vitality,
          nitrogenPrescriptionKg,
          irrigationCountdownHours: irrigationNeedHours,
          diseaseRisk: { pathogen: diseaseRisk }
        }
      });
    } catch (e) {
      // Non-fatal
    }

    return record;
  }
}

export const schemaManager = new SchemaManager();
