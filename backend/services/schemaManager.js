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
    email: "harshithkd0321@gmail.com",
    displayName: "Acchu harshith",
    role: "superadmin",
    status: "active",
    farmId: "farm-valley-1",
    farmName: "AgriSpectra Precision Block A (1-Acre High-Density)",
    createdAt: new Date().toISOString(),
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
    }

    this.verifiedTables.add('farms');
    return { exists, status: 'ready', records: snap.size || DEFAULT_FARMS.length };
  }

  /**
   * 2. Ensure 'users' collection
   */
  async ensureUsersCollection(db) {
    const usersCol = db.collection('users');
    const snap = await usersCol.limit(10).get();
    const exists = snap.size > 0;

    if (!exists) {
      console.log("[SchemaManager] ⚡ Collection 'users' not found. Creating table and seeding initial system accounts...");
    } else {
      console.log(`[SchemaManager] ✓ Collection 'users' exists (${snap.size} user accounts found).`);
    }

    for (const u of DEFAULT_USERS) {
      const userRef = usersCol.doc(u.uid);
      const userDoc = await userRef.get();
      if (!userDoc.exists) {
        await userRef.set(u, { merge: true });
        console.log(`[SchemaManager]   + Created system user: ${u.email} (${u.displayName}) [${u.uid}]`);
      } else {
        const currentData = userDoc.data();
        if (currentData.email !== u.email || currentData.displayName !== u.displayName) {
          await userRef.set({
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            status: u.status,
            farmId: u.farmId,
            farmName: u.farmName,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          console.log(`[SchemaManager]   ✓ Synchronized user record: ${u.uid} -> ${u.email} (${u.displayName})`);
        }
      }
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
        const rootCollectionName = collectionName.split('/')[0];
        // Check root collection existence
        if (!this.verifiedTables.has(rootCollectionName)) {
          const snap = await db.collection(rootCollectionName).limit(1).get();
          if (snap.empty) {
            console.log('[SchemaManager] Table does not exist. Auto-creating table for user data: %s', rootCollectionName);
          }
          this.verifiedTables.add(rootCollectionName);
        }

        await db.doc(docPath).set(enrichedData, options);
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
   * Automatically checks if a user's farm chamber and 6 precision plots exist.
   * If not, automatically provisions the farm document and its plots in Cloud Firestore.
   */
  async ensureFarmChamberAndPlots(farmId, farmName, ownerId, ownerEmail) {
    await firestoreClient.ensureReady();
    const db = firestoreClient.adminDb;
    if (!db) {
      console.warn("[SchemaManager] Admin SDK not ready for farm chamber provisioning; fallback active.");
      return;
    }

    try {
      const targetFarmId = farmId || 'farm-valley-1';
      const farmRef = db.collection('farms').doc(targetFarmId);
      const farmDoc = await farmRef.get();

      if (!farmDoc.exists) {
        console.log(`[SchemaManager] ⚡ Auto-provisioning new farm chamber: ${targetFarmId} (${farmName}) for ${ownerEmail}`);
        await farmRef.set({
          id: targetFarmId,
          name: farmName || "Precision Farm Chamber",
          location: "36.7783° N, 119.4179° W",
          totalArea: "1.00 Acre (6 Zones)",
          ownerId: ownerId,
          ownerEmail: ownerEmail,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }

      // Ensure 6 precision agricultural plots exist under this farm
      const plotsCol = farmRef.collection('plots');
      const plotsSnap = await plotsCol.limit(10).get();
      if (plotsSnap.empty || plotsSnap.size < DEFAULT_PLOTS.length) {
        console.log(`[SchemaManager] ⚡ Auto-populating 6 precision plots under ${targetFarmId}...`);
        for (const plot of DEFAULT_PLOTS) {
          const plotDocRef = plotsCol.doc(plot.id);
          const pDoc = await plotDocRef.get();
          if (!pDoc.exists) {
            await plotDocRef.set({
              ...plot,
              farmId: targetFarmId,
              lastUpdated: new Date().toISOString()
            }, { merge: true });
          }
        }
        console.log(`[SchemaManager] ✅ All 6 precision plots active under ${targetFarmId}`);
      }

      // Subcollection: actionRecommendations
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

      // Subcollection: irrigationLogs
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
    } catch (err) {
      console.error('[SchemaManager] Error provisioning farm chamber:', String(farmId), err.message);
    }
  }

  /**
   * Ingest user registration from user end:
   * Auto-creates 'users' table if not existing, fills user data, provisions dedicated farm chamber & plots,
   * and updates enterprise store.
   */
  async saveUserRegistration(userData) {
    if (!userData || (!userData.uid && !userData.email)) {
      throw new Error("Invalid user registration data. 'uid' or 'email' is required.");
    }

    await firestoreClient.ensureReady();

    const rawEmail = String(userData.email || '').trim().toLowerCase();
    const isAcchuHarshith = rawEmail === 'harshithkd0321@gmail.com' || rawEmail === 'harshithkd032@gmail.com';
    // Normalize email to active account harshithkd0321@gmail.com
    const email = isAcchuHarshith ? 'harshithkd0321@gmail.com' : rawEmail;

    let uid = userData.uid ? String(userData.uid).replace(/[^a-zA-Z0-9_-]/g, '') : null;
    if (!uid) {
      if (isAcchuHarshith) {
        uid = 'system-admin-harshith';
      } else {
        const secureRand = crypto.randomBytes(4).toString('hex');
        uid = `usr_${Date.now()}_${secureRand}`;
      }
    }

    const displayName = userData.displayName || (isAcchuHarshith ? 'Acchu harshith' : (email ? email.split('@')[0] : 'Farmer Operator'));
    const role = userData.role || (isAcchuHarshith ? 'superadmin' : 'Agronomist');
    const farmId = userData.farmId || (isAcchuHarshith ? 'farm-valley-1' : `farm-${uid}`);
    const farmName = userData.farmName || (isAcchuHarshith ? 'AgriSpectra Precision Block A (1-Acre High-Density)' : `${displayName}'s Precision Farm`);

    const userProfile = {
      uid,
      id: uid,
      email,
      displayName,
      name: displayName,
      role,
      farmId,
      farmName,
      status: userData.status || 'active',
      createdAt: userData.createdAt || new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(userData.photoURL ? { photoURL: userData.photoURL } : {})
    };

    // 1. Auto-create 'users' table if not exists and persist user document
    await this.saveUserData('users', uid, userProfile, { merge: true });

    // For harshithkd0321@gmail.com, also ensure system-admin-harshith doc is kept in sync
    if (isAcchuHarshith && uid !== 'system-admin-harshith') {
      await this.saveUserData('users', 'system-admin-harshith', {
        ...userProfile,
        uid: 'system-admin-harshith',
        id: 'system-admin-harshith'
      }, { merge: true });
    }

    // 2. Automatically provision user's dedicated farm chamber and 6 precision plots if not existing
    await this.ensureFarmChamberAndPlots(farmId, farmName, uid, email);

    // 3. Update in-memory enterprise store
    const existingIdx = enterpriseStore.users.findIndex(u => u.uid === uid || (u.email && u.email.toLowerCase() === email));
    if (existingIdx >= 0) {
      enterpriseStore.users[existingIdx] = { ...enterpriseStore.users[existingIdx], ...userProfile };
    } else {
      enterpriseStore.users.push(userProfile);
    }

    // 4. Record entry in audit_logs
    try {
      await this.saveAuditLog({
        action: 'USER_REGISTRATION',
        actor: email,
        details: `User registration & farm chamber provisioned for ${displayName} (${role}) on farm ${farmId}`,
        ipAddress: '127.0.0.1'
      });
    } catch (auditErr) {
      console.warn('[SchemaManager] Audit log recording note:', auditErr.message);
    }

    console.log(`[SchemaManager] 👤 User registration & dedicated farm provisioned successfully for ${email} (${uid})`);
    return userProfile;
  }

  /**
   * Immediately syncs all default and registered users into live Cloud Firestore
   */
  async syncAllUsersToLiveFirestore() {
    console.log("[SchemaManager] 🚀 Initiating comprehensive sync to live Cloud Firestore...");
    await firestoreClient.ensureReady();
    const db = firestoreClient.adminDb;
    if (!db) {
      throw new Error("Cloud Firestore connection unavailable (Firebase Admin SDK offline)");
    }

    const syncedResults = [];

    // Ensure all DEFAULT_USERS
    for (const u of DEFAULT_USERS) {
      const res = await this.saveUserRegistration(u);
      syncedResults.push(res);
    }

    // Ensure users in enterpriseStore are synced
    for (const u of enterpriseStore.users) {
      if (u && (u.uid || u.email)) {
        const res = await this.saveUserRegistration(u);
        syncedResults.push(res);
      }
    }

    console.log(`[SchemaManager] ✅ Live sync complete: ${syncedResults.length} user records synchronized to Cloud Firestore.`);
    return {
      success: true,
      syncedCount: syncedResults.length,
      users: syncedResults
    };
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
   * Validates payload structure for a spectral scan:
   * scanId, specimen, location, timestamps, rawData, processedData
   */
  validateSpectralScan(scanData, isStrict = false) {
    if (!scanData || typeof scanData !== 'object' || Object.keys(scanData).length === 0) {
      return { valid: false, error: "Empty spectroscopy scan payload." };
    }

    if (isStrict) {
      // 1. scanId (or id)
      const scanId = scanData.scanId || scanData.id;
      if (!scanId || typeof scanId !== 'string' || scanId.trim().length === 0) {
        return { valid: false, error: "Validation Error: 'scanId' is required and must be a non-empty string." };
      }

      // 2. specimen
      const hasSpecimen = Boolean(
        (scanData.specimen && (typeof scanData.specimen === 'string' || (typeof scanData.specimen === 'object' && Object.keys(scanData.specimen).length > 0))) ||
        scanData.crop ||
        scanData.plantName
      );
      if (!hasSpecimen) {
        return { valid: false, error: "Validation Error: 'specimen' metadata is required." };
      }

      // 3. location (the mobile app identifies the scan location by irrigation
      // "Zone" (Zone 1-6) + plot/pot number rather than plotId/farmId - accept
      // that shape too instead of rejecting every real-world app payload)
      const hasLocation = Boolean(
        (scanData.location && (typeof scanData.location === 'string' || (typeof scanData.location === 'object' && Object.keys(scanData.location).length > 0))) ||
        scanData.plotId ||
        scanData.farmId ||
        scanData.zone ||
        scanData.plotNumber != null ||
        scanData.potNumber
      );
      if (!hasLocation) {
        return { valid: false, error: "Validation Error: 'location' metadata is required." };
      }

      // 4. timestamps
      const hasTimestamps = Boolean(
        (scanData.timestamps && (typeof scanData.timestamps === 'string' || (typeof scanData.timestamps === 'object' && Object.keys(scanData.timestamps).length > 0))) ||
        scanData.timestamp ||
        scanData.scannedAt
      );
      if (!hasTimestamps) {
        return { valid: false, error: "Validation Error: 'timestamps' is required." };
      }

      // 5. rawData (the mobile app's field is named "reflectance", and also
      // sends the AS7265x pre-conversion counts as rawCounts - accept either)
      const hasRawData = Boolean(
        (scanData.rawData && (Array.isArray(scanData.rawData) || (typeof scanData.rawData === 'object' && Object.keys(scanData.rawData).length > 0))) ||
        (Array.isArray(scanData.rawReflectance) && scanData.rawReflectance.length > 0) ||
        (Array.isArray(scanData.rawIntensities) && scanData.rawIntensities.length > 0) ||
        (Array.isArray(scanData.reflectance) && scanData.reflectance.length > 0) ||
        (Array.isArray(scanData.rawCounts) && scanData.rawCounts.length > 0)
      );
      if (!hasRawData) {
        return { valid: false, error: "Validation Error: 'rawData' is required." };
      }

      // 6. processedData
      const hasProcessedData = Boolean(
        (scanData.processedData && typeof scanData.processedData === 'object' && Object.keys(scanData.processedData).length > 0) ||
        (scanData.chemometrics && typeof scanData.chemometrics === 'object' && Object.keys(scanData.chemometrics).length > 0) ||
        (scanData.indices && typeof scanData.indices === 'object' && Object.keys(scanData.indices).length > 0) ||
        scanData.vitalityScore !== undefined ||
        scanData.ndvi !== undefined
      );
      if (!hasProcessedData) {
        return { valid: false, error: "Validation Error: 'processedData' is required." };
      }
    }

    return { valid: true };
  }

  /**
   * Normalizes spectral scan payload into canonical schema
   */
  normalizeSpectralScan(scanData) {
    const rawTimestamp = (scanData.timestamps && typeof scanData.timestamps === 'object' ? scanData.timestamps.scannedAt : scanData.timestamps) ||
      scanData.timestamp ||
      scanData.scannedAt ||
      new Date().toISOString();

    const scanId = String(scanData.scanId || scanData.id || `scan-${rawTimestamp.slice(0, 10).replace(/-/g, '')}-${String(Math.floor(Math.random() * 900) + 100)}`);
    const id = scanId;

    // Specimen normalization
    const specimen = typeof scanData.specimen === 'object' && scanData.specimen !== null
      ? { ...scanData.specimen }
      : {
          crop: String(scanData.specimen || scanData.crop || scanData.plantName || "Specimen Plant"),
          plantName: String(scanData.plantName || scanData.specimen || "Specimen Plant")
        };
    if (!specimen.crop && scanData.crop) specimen.crop = String(scanData.crop);
    if (!specimen.plantName && scanData.plantName) specimen.plantName = String(scanData.plantName);
    const crop = String(specimen.crop || scanData.crop || "tomato");

    // Location normalization. The mobile app identifies where a scan was taken
    // by irrigation Zone (Zone 1-6) + pot/row number rather than plotId/farmId,
    // so derive plotId from zone when no explicit plotId was sent.
    const zoneDerivedPlotId = scanData.zone
      ? `zone-${(String(scanData.zone).match(/\d+/) || ['1'])[0]}`
      : null;
    const location = typeof scanData.location === 'object' && scanData.location !== null
      ? { ...scanData.location }
      : {
          plotId: String(scanData.location || scanData.plotId || zoneDerivedPlotId || "plot-1"),
          farmId: String(scanData.farmId || "farm-valley-1")
        };
    if (!location.farmId) location.farmId = String(scanData.farmId || "farm-valley-1");
    if (!location.plotId) location.plotId = String(scanData.plotId || zoneDerivedPlotId || "plot-1");
    if (!location.zone && scanData.zone) location.zone = String(scanData.zone);
    if (!location.potNumber && scanData.potNumber) location.potNumber = String(scanData.potNumber);
    const farmId = String(location.farmId);
    const plotId = String(location.plotId);
    const plotNumber = Number(scanData.plotNumber || location.plotNumber || (plotId.match(/\d+/) ? parseInt(plotId.match(/\d+/)[0], 10) : 1));
    const plantNumber = String(specimen.plantNumber || scanData.plantNumber || `PLANT-${String(plotNumber).padStart(3, '0')}`);
    const portNumber = String(scanData.portNumber || `PORT-0${plotNumber}`);
    const plantName = String(specimen.plantName || scanData.plantName || crop);

    // Timestamps normalization
    const timestamps = typeof scanData.timestamps === 'object' && scanData.timestamps !== null
      ? { ...scanData.timestamps }
      : { scannedAt: rawTimestamp };
    if (!timestamps.scannedAt) timestamps.scannedAt = rawTimestamp;

    // Raw data normalization
    let rawReflectance;
    if (Array.isArray(scanData.rawData)) {
      rawReflectance = scanData.rawData.map(v => Number(Number(v).toFixed(4)));
    } else if (scanData.rawData && typeof scanData.rawData === 'object') {
      const arr = scanData.rawData.intensities || scanData.rawData.reflectance || scanData.rawData.rawIntensities || scanData.rawData.rawReflectance;
      if (Array.isArray(arr)) {
        rawReflectance = arr.map(v => Number(Number(v).toFixed(4)));
      }
    }
    if (!rawReflectance) {
      if (Array.isArray(scanData.rawReflectance) && scanData.rawReflectance.length > 0) {
        rawReflectance = scanData.rawReflectance.map(v => Number(Number(v).toFixed(4)));
      } else if (Array.isArray(scanData.rawIntensities) && scanData.rawIntensities.length > 0) {
        rawReflectance = scanData.rawIntensities.map(v => Number(Number(v).toFixed(4)));
      } else if (Array.isArray(scanData.reflectance) && scanData.reflectance.length > 0) {
        rawReflectance = scanData.reflectance.map(v => Number(Number(v).toFixed(4)));
      } else {
        rawReflectance = Array.from({ length: 76 }, (_, i) => Number((0.05 + 0.6 * Math.sin((i / 75) * Math.PI)).toFixed(4)));
      }
    }

    const rawData = (typeof scanData.rawData === 'object' && !Array.isArray(scanData.rawData) && scanData.rawData !== null)
      ? { ...scanData.rawData, intensities: rawReflectance, bandCount: rawReflectance.length }
      : { intensities: rawReflectance, bandCount: rawReflectance.length };
    // Preserve the real AS7265x 18-channel sensor counts alongside the derived
    // 76-band reflectance curve, for full traceability back to the raw instrument reading.
    if (Array.isArray(scanData.rawCounts) && scanData.rawCounts.length > 0) rawData.channelCounts = scanData.rawCounts;
    if (Array.isArray(scanData.darkCounts) && scanData.darkCounts.length > 0) rawData.darkCounts = scanData.darkCounts;
    if (Array.isArray(scanData.whiteCounts) && scanData.whiteCounts.length > 0) rawData.whiteCounts = scanData.whiteCounts;
    if (scanData.environmental) rawData.environmental = scanData.environmental;

    // Processed data & chemometrics normalization
    const proc = scanData.processedData || scanData.chemometrics || scanData.indices || {};
    const ndvi = Number(proc.ndvi ?? scanData.chemometrics?.ndvi ?? scanData.indices?.ndvi ?? scanData.ndvi ?? 0.75);
    const ndre = Number(proc.ndre ?? scanData.chemometrics?.ndre ?? scanData.indices?.ndre ?? scanData.ndre ?? 0.32);
    const lwi = Number(proc.leafWaterIndex ?? proc.lwi ?? proc.wbi ?? scanData.chemometrics?.leafWaterIndex ?? scanData.chemometrics?.wbi ?? scanData.indices?.wbi ?? 0.92);
    const cire = Number(proc.cire ?? scanData.chemometrics?.cire ?? scanData.indices?.cire ?? scanData.cire ?? 2.10);
    const vitality = Number(proc.vitalityScore ?? proc.vitality ?? scanData.chemometrics?.vitalityScore ?? scanData.indices?.vitality ?? scanData.vitalityScore ?? scanData.vitality ?? 85);
    const nitrogenPrescriptionKg = Number(proc.nitrogenPrescriptionKg ?? scanData.nitrogenPrescriptionKg ?? (ndre < 0.28 ? 18.0 : (ndre < 0.35 ? 8.0 : 0.0)));
    const irrigationNeedHours = Number(proc.irrigationCountdownHours ?? proc.irrigationNeedHours ?? scanData.irrigationNeedHours ?? (lwi < 0.82 ? 4 : (lwi < 0.89 ? 18 : 36)));
    const diseaseRisk = typeof (proc.diseaseRisk || scanData.diseaseRisk) === 'string'
      ? (proc.diseaseRisk || scanData.diseaseRisk)
      : ((proc.diseaseRisk || scanData.diseaseRisk)?.pathogen || "HEALTHY_OPTIMAL");

    const processedData = {
      ndvi,
      ndre,
      leafWaterIndex: lwi,
      cire,
      vitalityScore: vitality,
      nitrogenPrescriptionKg,
      irrigationCountdownHours: irrigationNeedHours,
      diseaseRisk: typeof diseaseRisk === 'string' ? { pathogen: diseaseRisk } : diseaseRisk
    };

    const indices = {
      ndvi,
      ndre,
      wbi: lwi,
      cire,
      vitality,
      lwi
    };

    const calibrationRef = scanData.calibrationRef || scanData.calibrationReference || {
      darkCurrent: Number(scanData.calibrationRef?.darkCurrent ?? 0.015),
      whiteReference: Number(scanData.calibrationRef?.whiteReference ?? 0.985),
      calibratedAt: scanData.calibrationRef?.calibratedAt || rawTimestamp
    };

    const source = scanData.connectionMode || scanData.source || scanData.hardwareLink || "SIMULATED";
    const hardwareLink = ["BLE_NUS", "USB_SERIAL", "SIMULATED"].includes(scanData.hardwareLink) ? scanData.hardwareLink : (scanData.sourceMode || source);

    const chemometrics = scanData.chemometrics || {
      ...processedData,
      irrigationUrgency: scanData.chemometrics?.irrigationUrgency || (lwi < 0.82 ? "CRITICAL" : "NORMAL"),
      diseaseRisk: typeof diseaseRisk === 'string' ? { pathogen: diseaseRisk } : diseaseRisk
    };

    return {
      scanId,
      id,
      plantNumber,
      portNumber,
      plantName,
      plotId,
      plotNumber,
      farmId,
      crop,
      specimen,
      location,
      timestamps,
      timestamp: rawTimestamp,
      scannedAt: rawTimestamp,
      calibrationRef,
      rawData,
      rawReflectance,
      rawIntensities: rawReflectance,
      indices,
      processedData,
      chemometrics,
      nitrogenPrescriptionKg,
      irrigationNeedHours,
      diseaseRisk,
      hardwareLink,
      source,
      connectionMode: source
    };
  }

  /**
   * Sync a single spectral scan with duplicate detection and idempotency:
   * Checks if scanId already exists in Firestore (farms/{farmId}/spectralScans/{scanId}).
   * If exists, updates/confirms without creating duplicate records or erroring out.
   * Permanently writes verified records to Cloud Firestore.
   */
  async syncSpectralScan(scanData, options = {}) {
    const isStrict = options.isStrict !== false;
    const validation = this.validateSpectralScan(scanData, isStrict);
    if (!validation.valid) {
      const err = new Error(validation.error);
      err.status = 400;
      throw err;
    }

    const record = this.normalizeSpectralScan(scanData);
    const farmId = record.farmId;
    const scanId = record.scanId;

    // Idempotency check: verify existence in Cloud Firestore & in-memory cache
    const existsInCloud = await firestoreClient.spectralScanExists(farmId, scanId);
    const existsInMemory = Boolean(centralStorage.getSpectroScanById(scanId));
    const isDuplicate = existsInCloud || existsInMemory;

    record.syncedAt = new Date().toISOString();
    record.status = isDuplicate ? 'updated' : 'created';
    record.isDuplicate = isDuplicate;

    // Permanently write to Cloud Firestore under farms/{farmId}/spectralScans/{scanId}
    await firestoreClient.saveSpectralScanDoc(farmId, scanId, record, { merge: true });

    // Also persist to root spectral_scans table for collection index compatibility
    await this.saveUserData('spectral_scans', scanId, record, { merge: true });

    // Update in-memory centralStorage
    try {
      centralStorage.addSpectroScan({
        ...record,
        id: scanId,
        source: record.source,
        rawIntensities: record.rawReflectance,
        chemometrics: record.chemometrics
      });
    } catch {
      // Non-fatal
    }

    return {
      success: true,
      scanId,
      cloudDocumentId: `farms/${farmId}/spectralScans/${scanId}`,
      syncedAt: record.syncedAt,
      isDuplicate,
      status: record.status,
      data: record
    };
  }

  /**
   * Batch synchronize spectral scans from mobile application
   */
  async batchSyncSpectralScans(scansList, options = {}) {
    if (!Array.isArray(scansList) || scansList.length === 0) {
      const err = new Error("Validation Error: Batch scan payload must be a non-empty array.");
      err.status = 400;
      throw err;
    }

    // Validate all items first
    for (let i = 0; i < scansList.length; i++) {
      const item = scansList[i];
      const validation = this.validateSpectralScan(item, true);
      if (!validation.valid) {
        const err = new Error(`Item ${i}: ${validation.error}`);
        err.status = 400;
        throw err;
      }
    }

    const results = [];
    for (const item of scansList) {
      const syncRes = await this.syncSpectralScan(item, { isStrict: true });
      results.push({
        success: true,
        scanId: syncRes.scanId,
        cloudDocumentId: syncRes.cloudDocumentId,
        syncedAt: syncRes.syncedAt,
        isDuplicate: syncRes.isDuplicate,
        status: syncRes.status
      });
    }

    return {
      success: true,
      syncedCount: results.length,
      results
    };
  }

  /**
   * Ingest and persist spectral scan (VIS-NIR 350nm-1100nm, 76 bands, specimen metadata)
   * Auto-creates 'spectral_scans' table if not existing, fills data, and updates farm subcollection
   */
  async saveSpectralScan(scanData) {
    const syncRes = await this.syncSpectralScan(scanData, { isStrict: false });
    return syncRes.data;
  }
}

export const schemaManager = new SchemaManager();
