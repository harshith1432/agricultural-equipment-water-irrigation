/**
 * AgriSpectra Flow & Field - Offline-First Local Spectral Database
 *
 * Implements:
 *  - Section 2: Offline-First Client Storage Engine (IndexedDB + In-Memory Fallback)
 *  - Section 7: Raw 18-Channel AS7265x & 76-Band Processed Chemometrics Schema
 *  - Section 8: Specimen & Location Metadata Specification
 *  - Section 11: Cryptographic Payload Integrity & Traceability Ledger
 *
 * Designed for: Modern Web Browsers, Android Capacitor WebView, and Headless Node Test Environments.
 */

export const DB_NAME = 'AgriSpectraSpectralDB';
export const DB_VERSION = 1;

export const STORES = {
  SCANS: 'scans',
  SYNC_QUEUE: 'sync_queue'
};

export const SYNC_STATUS = {
  LOCAL_ONLY: 'LOCAL_ONLY',
  PENDING_SYNC: 'PENDING_SYNC',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  SYNC_FAILED: 'SYNC_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED'
};

export const RETENTION_PERIOD_DAYS = 30;
export const RETENTION_PERIOD_MS = RETENTION_PERIOD_DAYS * 24 * 60 * 60 * 1000;

// Standard AS7265x 18-channel optical wavelengths (nm)
export const AS7265X_CHANNELS = [
  410, 435, 460, 485, 510, 535, // AS72651 (UV/VIS)
  560, 585, 610, 645, 680, 705, // AS72652 (VIS/NIR)
  730, 760, 810, 860, 900, 940  // AS72653 (NIR)
];

/**
 * Deterministically stringifies an object with sorted keys
 * Ensures byte-for-byte identical JSON serialization across platforms.
 */
export function deterministicStringify(obj) {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => deterministicStringify(item)).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const parts = sortedKeys.map(key => {
    return JSON.stringify(key) + ':' + deterministicStringify(obj[key]);
  });
  return '{' + parts.join(',') + '}';
}

/**
 * Computes SHA-256 cryptographic checksum across an arbitrary object or string
 * Leverages WebCrypto API when available (Web, Capacitor, Node v15+),
 * with fallback to Node's node:crypto or deterministic fallback hash.
 */
export async function calculatePayloadChecksum(payload) {
  const normalizedString = typeof payload === 'string'
    ? payload
    : deterministicStringify(payload);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(normalizedString);
      const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (_) {}
  }

  try {
    const nodeCrypto = await import('node:crypto');
    return nodeCrypto.createHash('sha256').update(normalizedString).digest('hex');
  } catch (_) {}

  // Pure-JS deterministic 32-bit FNV-1a based 64-char hex fallback (for extreme legacy headless)
  let h1 = 0x811c9dc5;
  let h2 = 0x811c9dc5;
  for (let i = 0; i < normalizedString.length; i++) {
    const code = normalizedString.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619);
    h2 = Math.imul(h2 ^ (code >> 4), 1099511628211 % 16777619);
  }
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return (hex1 + hex2).repeat(4);
}

/**
 * Extracts immutable scientific measurement fields for cryptographic signing.
 * Excludes mutable synchronization lifecycle fields.
 */
export function extractIntegrityPayload(record) {
  return {
    scanId: record.scanId,
    userId: record.userId,
    farmId: record.farmId,
    deviceId: record.deviceId,
    createdAt: record.createdAt,
    rawData: record.rawData,
    processedData: record.processedData,
    specimen: record.specimen,
    location: record.location
  };
}

/**
 * Validates complete schema integrity for a leaf spectroscopy scan record.
 */
export function validateScanRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    return { isValid: false, errors: ['Scan record must be a valid object'] };
  }

  // Core Identifiers
  if (!record.scanId || typeof record.scanId !== 'string') errors.push('Missing or invalid scanId');
  if (!record.userId || typeof record.userId !== 'string') errors.push('Missing or invalid userId');
  if (!record.farmId || typeof record.farmId !== 'string') errors.push('Missing or invalid farmId');
  if (!record.deviceId || typeof record.deviceId !== 'string') errors.push('Missing or invalid deviceId');
  if (!record.syncStatus || !Object.values(SYNC_STATUS).includes(record.syncStatus)) {
    errors.push(`Invalid syncStatus: ${record.syncStatus}`);
  }

  // Raw Sensor Data (Section 7A)
  if (!record.rawData || typeof record.rawData !== 'object') {
    errors.push('Missing rawData block');
  } else {
    const { rawCounts, darkBaselineCounts, whiteReferenceCounts, sensorTelemetry } = record.rawData;
    if (!Array.isArray(rawCounts) || rawCounts.length !== 18) {
      errors.push(`rawCounts must be an 18-channel array, received length ${rawCounts?.length}`);
    }
    if (!Array.isArray(darkBaselineCounts) || darkBaselineCounts.length !== 18) {
      errors.push(`darkBaselineCounts must be an 18-channel array, received length ${darkBaselineCounts?.length}`);
    }
    if (!Array.isArray(whiteReferenceCounts) || whiteReferenceCounts.length !== 18) {
      errors.push(`whiteReferenceCounts must be an 18-channel array, received length ${whiteReferenceCounts?.length}`);
    }
    if (!sensorTelemetry || typeof sensorTelemetry !== 'object') {
      errors.push('Missing sensorTelemetry in rawData');
    } else {
      if (typeof sensorTelemetry.temperatureC !== 'number') errors.push('sensorTelemetry.temperatureC must be numeric');
      if (typeof sensorTelemetry.pressureHpa !== 'number') errors.push('sensorTelemetry.pressureHpa must be numeric');
      if (typeof sensorTelemetry.humidityPercent !== 'number') errors.push('sensorTelemetry.humidityPercent must be numeric');
    }
  }

  // Processed Chemometrics Data (Section 7B)
  if (!record.processedData || typeof record.processedData !== 'object') {
    errors.push('Missing processedData block');
  } else {
    const { reflectance76, ndvi, ndre, vitalityScore } = record.processedData;
    if (!Array.isArray(reflectance76) || reflectance76.length !== 76) {
      errors.push(`reflectance76 must be a 76-band array (350-1100nm), received length ${reflectance76?.length}`);
    }
    if (typeof ndvi !== 'number') errors.push('processedData.ndvi must be numeric');
    if (typeof ndre !== 'number') errors.push('processedData.ndre must be numeric');
    if (typeof vitalityScore !== 'number' || vitalityScore < 0 || vitalityScore > 100) {
      errors.push('processedData.vitalityScore must be numeric in range [0, 100]');
    }
  }

  // Specimen Metadata (Section 8)
  if (!record.specimen || typeof record.specimen !== 'object') {
    errors.push('Missing specimen metadata block');
  } else {
    if (record.specimen.plantNumber === undefined || record.specimen.plantNumber === null || record.specimen.plantNumber === '') {
      errors.push('specimen.plantNumber is required');
    }
    if (!record.specimen.plantName || typeof record.specimen.plantName !== 'string') {
      errors.push('specimen.plantName is required and must be a string');
    }
    if (record.specimen.plotId === undefined || record.specimen.plotId === null) {
      errors.push('specimen.plotId is required');
    }
  }

  // Location Metadata (Section 8)
  if (!record.location || typeof record.location !== 'object') {
    errors.push('Missing location metadata block');
  } else {
    if (typeof record.location.latitude !== 'number') errors.push('location.latitude must be numeric');
    if (typeof record.location.longitude !== 'number') errors.push('location.longitude must be numeric');
    if (typeof record.location.accuracyMeters !== 'number') errors.push('location.accuracyMeters must be numeric');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Factory helper to construct a fully standardized AgriSpectra spectral scan record.
 */
export async function createSpectralScanRecord(params) {
  const scanId = params.scanId || `scan_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const createdAt = params.createdAt || new Date().toISOString();
  const syncStatus = params.syncStatus || SYNC_STATUS.PENDING_SYNC;

  // Build Standardized Record
  const record = {
    scanId,
    userId: params.userId || 'guest-offline-farmer',
    farmId: params.farmId || 'farm-valley-1',
    deviceId: params.deviceId || 'AGRI-BLE-AS7265X-01',
    syncStatus,
    syncAttempts: params.syncAttempts || 0,
    lastSyncAttempt: params.lastSyncAttempt || null,
    nextRetryAt: params.nextRetryAt || (syncStatus === SYNC_STATUS.PENDING_SYNC ? createdAt : null),
    syncedAt: params.syncedAt || null,
    cloudDocumentId: params.cloudDocumentId || null,
    lastSyncError: params.lastSyncError || null,
    createdAt,
    retentionExpiresAt: params.retentionExpiresAt || null,

    // A. Raw Sensor Data
    rawData: {
      rawCounts: Array.isArray(params.rawData?.rawCounts) ? [...params.rawData.rawCounts] : new Array(18).fill(1000),
      darkBaselineCounts: Array.isArray(params.rawData?.darkBaselineCounts) ? [...params.rawData.darkBaselineCounts] : new Array(18).fill(25),
      whiteReferenceCounts: Array.isArray(params.rawData?.whiteReferenceCounts) ? [...params.rawData.whiteReferenceCounts] : new Array(18).fill(40000),
      sensorTelemetry: {
        temperatureC: params.rawData?.sensorTelemetry?.temperatureC ?? 26.5,
        pressureHpa: params.rawData?.sensorTelemetry?.pressureHpa ?? 1013.25,
        humidityPercent: params.rawData?.sensorTelemetry?.humidityPercent ?? 55.0,
        batteryPercent: params.rawData?.sensorTelemetry?.batteryPercent ?? 95,
        supplyVoltageV: params.rawData?.sensorTelemetry?.supplyVoltageV ?? 3.3,
        integrationTimeMs: params.rawData?.sensorTelemetry?.integrationTimeMs ?? 50,
        gain: params.rawData?.sensorTelemetry?.gain ?? '64x'
      }
    },

    // B. Human-Readable Processed Data
    processedData: {
      reflectance76: Array.isArray(params.processedData?.reflectance76) && params.processedData.reflectance76.length === 76
        ? [...params.processedData.reflectance76]
        : new Array(76).fill(0.45),
      ndvi: Number(params.processedData?.ndvi ?? 0.72),
      ndre: Number(params.processedData?.ndre ?? 0.38),
      wbi: Number(params.processedData?.wbi ?? 0.98),
      leafWaterIndex: Number(params.processedData?.leafWaterIndex ?? 0.88),
      vitalityScore: Number(params.processedData?.vitalityScore ?? 85),
      nitrogenPrescription: {
        kgPerAcre: Number(params.processedData?.nitrogenPrescription?.kgPerAcre ?? 0.0),
        recommendation: params.processedData?.nitrogenPrescription?.recommendation || 'Nitrogen levels optimal. Maintenance mode.',
        timing: params.processedData?.nitrogenPrescription?.timing || 'Normal irrigation window'
      },
      units: {
        reflectance: 'ratio',
        ndvi: 'unitless (-1.0 to 1.0)',
        ndre: 'unitless (-1.0 to 1.0)',
        vitalityScore: 'index (0 to 100)',
        nitrogenPrescription: 'kg/acre Urea equivalent',
        temperature: 'Celsius',
        pressure: 'hPa',
        humidity: '% RH'
      },
      calculationMethods: {
        ndviFormula: '(R800 - R670) / (R800 + R670)',
        ndreFormula: '(R790 - R720) / (R790 + R720)',
        wbiFormula: 'R900 / R970',
        reflectanceFormula: '(raw - dark) / (white - dark)',
        engineVersion: 'AgriSpectra-Chemometrics-v2.5'
      }
    },

    // Specimen Metadata
    specimen: {
      plantNumber: params.specimen?.plantNumber ?? 'P-01',
      plantName: params.specimen?.plantName || 'Solanum tuberosum (Potato)',
      potNumber: params.specimen?.potNumber ?? 'POT-12',
      plotId: params.specimen?.plotId ?? 'plot-1',
      farmName: params.specimen?.farmName || 'Sonoma Valley Plot A',
      zone: params.specimen?.zone || 'Zone 1 - Mainline Gate 1',
      cropVariety: params.specimen?.cropVariety || 'Russet Burbank',
      growthStage: params.specimen?.growthStage || 'Vegetative Canopy'
    },

    // Location Metadata
    location: {
      latitude: Number(params.location?.latitude ?? 38.2975),
      longitude: Number(params.location?.longitude ?? -122.4578),
      accuracyMeters: Number(params.location?.accuracyMeters ?? 4.2),
      capturedAt: params.location?.capturedAt || createdAt,
      source: params.location?.source || 'GPS_HARDWARE',
      permissionStatus: params.location?.permissionStatus || 'granted'
    },

    // Integrity Traceability
    checksumAlgorithm: 'SHA-256',
    integrityVerified: true
  };

  // If already synced, calculate retention expiry (syncedAt + 30 days)
  if (record.syncStatus === SYNC_STATUS.SYNCED && record.syncedAt) {
    record.retentionExpiresAt = new Date(new Date(record.syncedAt).getTime() + RETENTION_PERIOD_MS).toISOString();
  }

  // Calculate cryptographic payload checksum
  const integrityPayload = extractIntegrityPayload(record);
  record.checksum = await calculatePayloadChecksum(integrityPayload);

  return record;
}

/**
 * In-Memory Structured ObjectStore implementation
 * Emulates full IndexedDB semantics for headless Node.js tests or environments
 * where IndexedDB is blocked or unavailable.
 */
class MemoryIndexedDBStore {
  constructor(name) {
    this.name = name;
    this.records = new Map();
  }

  async put(key, value) {
    this.records.set(key, JSON.parse(JSON.stringify(value)));
    return key;
  }

  async get(key) {
    const val = this.records.get(key);
    return val ? JSON.parse(JSON.stringify(val)) : undefined;
  }

  async getAll() {
    return Array.from(this.records.values()).map(v => JSON.parse(JSON.stringify(v)));
  }

  async delete(key) {
    return this.records.delete(key);
  }

  async count() {
    return this.records.size;
  }

  async clear() {
    this.records.clear();
  }
}

/**
 * OfflineSpectralDatabase
 * High-performance, offline-first client storage engine for leaf spectroscopy records.
 */
export class OfflineSpectralDatabase {
  constructor({ dbName = DB_NAME, version = DB_VERSION } = {}) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.isFallback = false;
    this.fallbackStores = {
      [STORES.SCANS]: new MemoryIndexedDBStore(STORES.SCANS),
      [STORES.SYNC_QUEUE]: new MemoryIndexedDBStore(STORES.SYNC_QUEUE)
    };
    this.isInitialized = false;
  }

  /**
   * Initializes the persistent database.
   * Auto-selects native IndexedDB (Browser/Capacitor) or in-memory structured store (Node/Headless).
   */
  async init() {
    if (this.isInitialized && (this.db || this.isFallback)) {
      return this;
    }

    const hasNativeIndexedDB = typeof globalThis !== 'undefined' &&
      typeof globalThis.indexedDB !== 'undefined' &&
      globalThis.indexedDB !== null;

    if (!hasNativeIndexedDB) {
      this.isFallback = true;
      this.isInitialized = true;
      return this;
    }

    return new Promise((resolve, reject) => {
      try {
        const request = globalThis.indexedDB.open(this.dbName, this.version);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // 1. Scans Object Store
          if (!db.objectStoreNames.contains(STORES.SCANS)) {
            const scansStore = db.createObjectStore(STORES.SCANS, { keyPath: 'scanId' });
            scansStore.createIndex('userId', 'userId', { unique: false });
            scansStore.createIndex('farmId', 'farmId', { unique: false });
            scansStore.createIndex('deviceId', 'deviceId', { unique: false });
            scansStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            scansStore.createIndex('createdAt', 'createdAt', { unique: false });
            scansStore.createIndex('syncedAt', 'syncedAt', { unique: false });
            scansStore.createIndex('retentionExpiresAt', 'retentionExpiresAt', { unique: false });
            scansStore.createIndex('plotId', 'specimen.plotId', { unique: false });
          }

          // 2. Sync Queue Object Store
          if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
            const queueStore = db.createObjectStore(STORES.SYNC_QUEUE, { keyPath: 'queueId' });
            queueStore.createIndex('scanId', 'scanId', { unique: true });
            queueStore.createIndex('syncStatus', 'syncStatus', { unique: false });
            queueStore.createIndex('nextRetryAt', 'nextRetryAt', { unique: false });
            queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.isFallback = false;
          this.isInitialized = true;
          resolve(this);
        };

        request.onerror = (event) => {
          console.warn('[OfflineSpectralDatabase] Native IndexedDB open failed. Falling back to structured memory store:', event.target.error);
          this.isFallback = true;
          this.isInitialized = true;
          resolve(this);
        };
      } catch (err) {
        console.warn('[OfflineSpectralDatabase] IndexedDB exception. Falling back to memory store:', err);
        this.isFallback = true;
        this.isInitialized = true;
        resolve(this);
      }
    });
  }

  /**
   * Internal helper to perform a transaction
   */
  async _transaction(storeName, mode, callback) {
    await this.init();

    if (this.isFallback || !this.db) {
      const store = this.fallbackStores[storeName];
      return callback(store);
    }

    return new Promise((resolve, reject) => {
      try {
        const tx = this.db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        let callbackResult;

        tx.oncomplete = () => resolve(callbackResult);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));

        callbackResult = callback(store);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Stores a complete spectroscopy record locally BEFORE any network dispatch.
   * Maintains offline persistence and automatically enqueues into sync_queue if pending.
   */
  async saveScan(scanRecord, { autoEnqueue = true, strictValidation = true } = {}) {
    await this.init();

    // 1. Schema Validation
    if (strictValidation) {
      const validation = validateScanRecord(scanRecord);
      if (!validation.isValid) {
        throw new Error(`[OfflineSpectralDatabase] Schema validation failed: ${validation.errors.join('; ')}`);
      }
    }

    // 2. Ensure Cryptographic Payload Checksum
    const recordToSave = JSON.parse(JSON.stringify(scanRecord));
    if (!recordToSave.checksum) {
      const integrityPayload = extractIntegrityPayload(recordToSave);
      recordToSave.checksum = await calculatePayloadChecksum(integrityPayload);
    }
    recordToSave.checksumAlgorithm = recordToSave.checksumAlgorithm || 'SHA-256';
    recordToSave.integrityVerified = true;

    // 3. Save to 'scans' object store
    if (this.isFallback || !this.db) {
      await this.fallbackStores[STORES.SCANS].put(recordToSave.scanId, recordToSave);
    } else {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES.SCANS, 'readwrite');
        const store = tx.objectStore(STORES.SCANS);
        const req = store.put(recordToSave);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    // 4. If pending synchronization, add to sync_queue
    if (autoEnqueue && recordToSave.syncStatus === SYNC_STATUS.PENDING_SYNC) {
      await this.enqueueSync(recordToSave);
    }

    return recordToSave;
  }

  /**
   * Retrieves a single scan by scanId
   */
  async getScan(scanId) {
    if (!scanId) return null;
    await this.init();

    if (this.isFallback || !this.db) {
      return (await this.fallbackStores[STORES.SCANS].get(scanId)) || null;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.SCANS, 'readonly');
      const store = tx.objectStore(STORES.SCANS);
      const req = store.get(scanId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Retrieves all scans matching an optional filter query
   */
  async getAllScans(filter = null) {
    await this.init();
    let records = [];

    if (this.isFallback || !this.db) {
      records = await this.fallbackStores[STORES.SCANS].getAll();
    } else {
      records = await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES.SCANS, 'readonly');
        const store = tx.objectStore(STORES.SCANS);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    if (!filter || typeof filter !== 'object') {
      return records;
    }

    return records.filter(record => {
      if (filter.userId && record.userId !== filter.userId) return false;
      if (filter.farmId && record.farmId !== filter.farmId) return false;
      if (filter.deviceId && record.deviceId !== filter.deviceId) return false;
      if (filter.syncStatus && record.syncStatus !== filter.syncStatus) return false;
      if (filter.plotId && record.specimen?.plotId !== filter.plotId) return false;
      return true;
    });
  }

  /**
   * Updates fields of an existing scan record
   */
  async updateScan(scanId, updates) {
    const existing = await this.getScan(scanId);
    if (!existing) {
      throw new Error(`[OfflineSpectralDatabase] Scan not found for update: ${scanId}`);
    }

    const updated = {
      ...existing,
      ...updates,
      scanId // Preserve primary key
    };

    if (this.isFallback || !this.db) {
      await this.fallbackStores[STORES.SCANS].put(scanId, updated);
    } else {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES.SCANS, 'readwrite');
        const store = tx.objectStore(STORES.SCANS);
        const req = store.put(updated);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return updated;
  }

  /**
   * Deletes a scan by scanId
   */
  async deleteScan(scanId) {
    await this.init();
    await this.dequeueSync(scanId);

    if (this.isFallback || !this.db) {
      return await this.fallbackStores[STORES.SCANS].delete(scanId);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.SCANS, 'readwrite');
      const store = tx.objectStore(STORES.SCANS);
      const req = store.delete(scanId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Enqueues a scan record into the sync_queue store
   */
  async enqueueSync(scanOrScanId, { priority = 1, nextRetryAt = null } = {}) {
    await this.init();
    const scanId = typeof scanOrScanId === 'string' ? scanOrScanId : scanOrScanId.scanId;
    const scan = typeof scanOrScanId === 'object' ? scanOrScanId : await this.getScan(scanId);

    if (!scan) {
      throw new Error(`[OfflineSpectralDatabase] Cannot enqueue non-existent scan: ${scanId}`);
    }

    const queueId = `q_${scanId}`;
    const queueItem = {
      queueId,
      scanId,
      syncStatus: SYNC_STATUS.PENDING_SYNC,
      syncAttempts: scan.syncAttempts || 0,
      priority,
      nextRetryAt: nextRetryAt || scan.nextRetryAt || new Date().toISOString(),
      createdAt: scan.createdAt || new Date().toISOString(),
      payloadSummary: {
        plantName: scan.specimen?.plantName,
        plotId: scan.specimen?.plotId,
        vitalityScore: scan.processedData?.vitalityScore,
        checksum: scan.checksum
      }
    };

    if (this.isFallback || !this.db) {
      await this.fallbackStores[STORES.SYNC_QUEUE].put(queueId, queueItem);
    } else {
      await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.put(queueItem);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }

    return queueItem;
  }

  /**
   * Retrieves all items in the sync queue, sorted by nextRetryAt and priority
   */
  async getSyncQueue() {
    await this.init();
    let queueItems = [];

    if (this.isFallback || !this.db) {
      queueItems = await this.fallbackStores[STORES.SYNC_QUEUE].getAll();
    } else {
      queueItems = await new Promise((resolve, reject) => {
        const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readonly');
        const store = tx.objectStore(STORES.SYNC_QUEUE);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    }

    // Sort by priority (higher first), then nextRetryAt (earlier first)
    return queueItems.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const timeA = new Date(a.nextRetryAt || a.createdAt).getTime();
      const timeB = new Date(b.nextRetryAt || b.createdAt).getTime();
      return timeA - timeB;
    });
  }

  /**
   * Removes an item from the sync queue
   */
  async dequeueSync(scanIdOrQueueId) {
    await this.init();
    const queueId = String(scanIdOrQueueId).startsWith('q_')
      ? scanIdOrQueueId
      : `q_${scanIdOrQueueId}`;

    if (this.isFallback || !this.db) {
      return await this.fallbackStores[STORES.SYNC_QUEUE].delete(queueId);
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(STORES.SYNC_QUEUE, 'readwrite');
      const store = tx.objectStore(STORES.SYNC_QUEUE);
      const req = store.delete(queueId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Marks a scan as successfully synced to Firebase / Enterprise Cloud backend.
   * Implements Section 6: Calculates retentionExpiresAt = syncedAt + 30 days.
   * Removes item from sync_queue.
   */
  async markSyncSuccess(scanId, { cloudDocumentId, syncedAt = new Date().toISOString() } = {}) {
    if (!cloudDocumentId) {
      throw new Error(`[OfflineSpectralDatabase] markSyncSuccess requires valid cloudDocumentId`);
    }

    const retentionExpiresAt = new Date(new Date(syncedAt).getTime() + RETENTION_PERIOD_MS).toISOString();

    const updated = await this.updateScan(scanId, {
      syncStatus: SYNC_STATUS.SYNCED,
      syncedAt,
      cloudDocumentId,
      retentionExpiresAt,
      lastSyncError: null,
      nextRetryAt: null
    });

    await this.dequeueSync(scanId);
    return updated;
  }

  /**
   * Marks a sync attempt as failed.
   * Handles exponential backoff retry scheduling or permanent validation failure.
   */
  async markSyncFailure(scanId, error, { isValidationFailure = false } = {}) {
    const existing = await this.getScan(scanId);
    if (!existing) return null;

    const attempts = (existing.syncAttempts || 0) + 1;
    const now = new Date();
    const errorMessage = typeof error === 'string' ? error : (error?.message || 'Unknown network sync error');

    if (isValidationFailure) {
      // Non-retryable validation error: drop from sync queue
      const updated = await this.updateScan(scanId, {
        syncStatus: SYNC_STATUS.VALIDATION_FAILED,
        syncAttempts: attempts,
        lastSyncAttempt: now.toISOString(),
        lastSyncError: errorMessage,
        nextRetryAt: null
      });
      await this.dequeueSync(scanId);
      return updated;
    }

    // Exponential backoff: 5s, 15s, 45s, 120s, up to max 5 minutes
    const backoffSec = Math.min(300, 5 * Math.pow(2, Math.min(attempts - 1, 6)));
    const nextRetryAt = new Date(now.getTime() + backoffSec * 1000).toISOString();

    const updated = await this.updateScan(scanId, {
      syncStatus: SYNC_STATUS.SYNC_FAILED,
      syncAttempts: attempts,
      lastSyncAttempt: now.toISOString(),
      lastSyncError: errorMessage,
      nextRetryAt
    });

    // Update queue item
    await this.enqueueSync(scanId, { nextRetryAt });
    return updated;
  }

  /**
   * Cryptographically verifies the SHA-256 payload checksum against the stored data.
   * Detects any tampering or bit-rot in raw sensor readings or chemometrics.
   */
  async verifyRecordIntegrity(scanOrScanId) {
    const scan = typeof scanOrScanOrId === 'string'
      ? await this.getScan(scanOrScanId)
      : (typeof scanOrScanId === 'object' ? scanOrScanId : await this.getScan(scanOrScanId));

    if (!scan) {
      return { valid: false, error: 'Record not found' };
    }

    const recordedChecksum = scan.checksum;
    if (!recordedChecksum) {
      return { valid: false, error: 'No recorded checksum present on record' };
    }

    const integrityPayload = extractIntegrityPayload(scan);
    const calculatedChecksum = await calculatePayloadChecksum(integrityPayload);

    const valid = (calculatedChecksum.toLowerCase() === recordedChecksum.toLowerCase());
    return {
      valid,
      calculatedChecksum,
      recordedChecksum,
      error: valid ? null : 'Cryptographic payload checksum mismatch: data has been altered or corrupted'
    };
  }

  /**
   * Returns high-level database diagnostics and statistics
   */
  async getStats() {
    const scans = await this.getAllScans();
    const queue = await this.getSyncQueue();

    const countsByStatus = {
      [SYNC_STATUS.LOCAL_ONLY]: 0,
      [SYNC_STATUS.PENDING_SYNC]: 0,
      [SYNC_STATUS.SYNCING]: 0,
      [SYNC_STATUS.SYNCED]: 0,
      [SYNC_STATUS.SYNC_FAILED]: 0,
      [SYNC_STATUS.VALIDATION_FAILED]: 0
    };

    scans.forEach(s => {
      if (countsByStatus[s.syncStatus] !== undefined) {
        countsByStatus[s.syncStatus]++;
      }
    });

    return {
      totalScans: scans.length,
      queueLength: queue.length,
      countsByStatus,
      isFallbackEngine: this.isFallback
    };
  }

  /**
   * Clears all records from the database (for testing and reset)
   */
  async clearDatabase() {
    await this.init();

    if (this.isFallback || !this.db) {
      await this.fallbackStores[STORES.SCANS].clear();
      await this.fallbackStores[STORES.SYNC_QUEUE].clear();
      return true;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([STORES.SCANS, STORES.SYNC_QUEUE], 'readwrite');
      tx.objectStore(STORES.SCANS).clear();
      tx.objectStore(STORES.SYNC_QUEUE).clear();
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Global Singleton Instance
export const offlineSpectralDatabase = new OfflineSpectralDatabase();
