/**
 * AgriSpectra Offline Spectral Database
 * Local persistence engine for AS7265x spectroscope scans with IndexedDB
 * and resilient in-memory / localStorage fallback for offline field resilience.
 *
 * Status Lifecycle:
 *   LOCAL_ONLY -> PENDING_SYNC -> SYNCING -> SYNCED (or SYNC_FAILED -> PENDING_SYNC)
 */

export const SYNC_STATUS = {
  LOCAL_ONLY: 'LOCAL_ONLY',
  PENDING_SYNC: 'PENDING_SYNC',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  SYNC_FAILED: 'SYNC_FAILED'
};

const DB_NAME = 'agrispectra_spectral_db';
const DB_VERSION = 1;
const STORE_NAME = 'spectral_scans';
const LOCAL_STORAGE_KEY = 'agrispectra_offline_spectral_scans';
const METRICS_STORAGE_KEY = 'agrispectra_spectral_sync_metrics';

export class OfflineSpectralDatabase {
  constructor() {
    this._memoryStore = new Map();
    this._subscribers = new Set();
    this._db = null;
    this._isInitialized = false;
    this._initPromise = null;
    this._init();
  }

  /**
   * Initialize IndexedDB with localStorage fallback
   */
  async _init() {
    if (this._isInitialized) return;
    if (this._initPromise) return this._initPromise;

    this._initPromise = (async () => {
      // Load fallback from localStorage first
      this._loadFromLocalStorage();

      // Attempt IndexedDB if available in environment
      if (typeof indexedDB !== 'undefined') {
        try {
          this._db = await new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
            request.onupgradeneeded = (event) => {
              const db = event.target.result;
              if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('syncStatus', 'syncStatus', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
                store.createIndex('plantNumber', 'plantNumber', { unique: false });
              }
            };
          });

          // Hydrate memory store from IndexedDB
          await this._hydrateFromIndexedDB();
        } catch (e) {
          // IndexedDB unavailable or blocked (e.g. private mode or node test runner)
          // Fall back gracefully to localStorage and memory store
        }
      }

      this._isInitialized = true;
    })();

    return this._initPromise;
  }

  _loadFromLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw) {
        const records = JSON.parse(raw);
        if (Array.isArray(records)) {
          records.forEach(r => {
            if (r && r.id) this._memoryStore.set(r.id, r);
          });
        }
      }
    } catch (_) {}
  }

  _saveToLocalStorage() {
    if (typeof localStorage === 'undefined') return;
    try {
      const records = Array.from(this._memoryStore.values());
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
    } catch (_) {}
  }

  async _hydrateFromIndexedDB() {
    if (!this._db) return;
    try {
      const tx = this._db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      const records = await new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      records.forEach(r => {
        if (r && r.id) this._memoryStore.set(r.id, r);
      });
      this._saveToLocalStorage();
    } catch (_) {}
  }

  async _persistRecordToIndexedDB(record) {
    if (!this._db) return;
    try {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(record);
    } catch (_) {}
  }

  async _deleteFromIndexedDB(id) {
    if (!this._db) return;
    try {
      const tx = this._db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.delete(id);
    } catch (_) {}
  }

  /**
   * Save a leaf scan record to offline database
   * Sets default status to PENDING_SYNC unless specified
   */
  async saveScan(scanData) {
    await this._init();

    if (!scanData) {
      throw new Error('Cannot save empty scan data');
    }

    const timestamp = scanData.timestamp || new Date().toISOString();
    const plantNumClean = String(scanData.plantNumber || 'LEAF').replace(/[^a-zA-Z0-9]/g, '');
    const id = scanData.id || `scan_${Date.now()}_${plantNumClean}_${Math.floor(Math.random() * 1000)}`;

    const record = {
      id,
      timestamp,
      syncStatus: scanData.syncStatus || SYNC_STATUS.PENDING_SYNC,
      cloudDocumentId: scanData.cloudDocumentId || null,
      syncedAt: scanData.syncedAt || null,
      syncError: scanData.syncError || null,
      retryCount: Number(scanData.retryCount || 0),

      // Specimen metadata
      plantNumber: scanData.plantNumber || 'P-001',
      plantName: scanData.plantName || scanData.cropVariety || 'Specimen Plant',
      potNumber: scanData.potNumber || 'POT-1',
      zone: scanData.zone || 'Zone 1',
      cropVariety: scanData.cropVariety || scanData.plantName || 'Crop',
      plotNumber: Number(scanData.plotNumber || 1),
      plotId: scanData.plotId || 'plot-1',

      // Raw Sensor Measurements (18-channel AS7265x)
      rawCounts: Array.isArray(scanData.rawCounts) ? [...scanData.rawCounts] : (scanData.rawData?.rawCounts || null),
      darkCounts: Array.isArray(scanData.darkCounts) ? [...scanData.darkCounts] : (scanData.rawData?.darkCounts || null),
      whiteCounts: Array.isArray(scanData.whiteCounts) ? [...scanData.whiteCounts] : (scanData.rawData?.whiteCounts || null),
      rawText: scanData.rawText || scanData.rawData?.rawText || null,

      // Environmental readings
      environmental: {
        temperature: Number(scanData.environmental?.temperature ?? scanData.tempC ?? 24.5),
        humidity: Number(scanData.environmental?.humidity ?? scanData.humidityPct ?? 55.0),
        pressure: Number(scanData.environmental?.pressure ?? scanData.pressureHpa ?? 1013.25)
      },

      // Processed chemometric indices
      chemometrics: scanData.chemometrics ? { ...scanData.chemometrics } : {},
      wavelengths: Array.isArray(scanData.wavelengths) ? [...scanData.wavelengths] : [],
      reflectance: Array.isArray(scanData.reflectance) ? [...scanData.reflectance] : [],

      // Hardware and calibration
      hardware: scanData.hardware ? { ...scanData.hardware } : {},
      calibrationRef: scanData.calibrationRef ? { ...scanData.calibrationRef } : null
    };

    this._memoryStore.set(record.id, record);
    this._saveToLocalStorage();
    await this._persistRecordToIndexedDB(record);

    this._notifySubscribers('save', record);
    return record;
  }

  /**
   * Retrieve a single record by ID
   */
  async getScan(id) {
    await this._init();
    return this._memoryStore.get(id) || null;
  }

  /**
   * Get all scans sorted newest first
   */
  async getAllScans() {
    await this._init();
    const scans = Array.from(this._memoryStore.values());
    scans.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return scans;
  }

  /**
   * Retrieve all pending records waiting for sync (PENDING_SYNC or SYNC_FAILED)
   */
  async getPendingScans() {
    await this._init();
    const scans = Array.from(this._memoryStore.values());
    return scans.filter(s => s.syncStatus === SYNC_STATUS.PENDING_SYNC || s.syncStatus === SYNC_STATUS.SYNC_FAILED);
  }

  /**
   * Update scan status and metadata (e.g. SYNCING, SYNCED, SYNC_FAILED)
   */
  async updateScanStatus(id, newStatus, metadata = {}) {
    await this._init();
    const record = this._memoryStore.get(id);
    if (!record) {
      throw new Error(`Record with ID ${id} not found in offline database`);
    }

    record.syncStatus = newStatus;
    if (metadata.cloudDocumentId !== undefined) record.cloudDocumentId = metadata.cloudDocumentId;
    if (metadata.syncedAt !== undefined) record.syncedAt = metadata.syncedAt;
    if (metadata.syncError !== undefined) record.syncError = metadata.syncError;
    if (metadata.retryCount !== undefined) record.retryCount = metadata.retryCount;
    else if (newStatus === SYNC_STATUS.SYNC_FAILED) record.retryCount = (record.retryCount || 0) + 1;

    this._memoryStore.set(id, record);
    this._saveToLocalStorage();
    await this._persistRecordToIndexedDB(record);

    this._notifySubscribers('update', record);
    return record;
  }

  /**
   * Delete a scan record
   */
  async deleteScan(id) {
    await this._init();
    const existed = this._memoryStore.delete(id);
    this._saveToLocalStorage();
    await this._deleteFromIndexedDB(id);
    if (existed) {
      this._notifySubscribers('delete', { id });
    }
    return existed;
  }

  /**
   * Compute synchronization metrics for dashboard widget
   */
  async getMetrics() {
    await this._init();
    const scans = Array.from(this._memoryStore.values());
    
    let totalScans = scans.length;
    let locallyStored = 0;
    let pendingSync = 0;
    let syncing = 0;
    let syncedToCloud = 0;
    let syncFailed = 0;
    let lastSyncTimestamp = null;

    for (const scan of scans) {
      locallyStored++; // All items in this database are locally persisted
      if (scan.syncStatus === SYNC_STATUS.PENDING_SYNC) pendingSync++;
      else if (scan.syncStatus === SYNC_STATUS.SYNCING) syncing++;
      else if (scan.syncStatus === SYNC_STATUS.SYNCED) {
        syncedToCloud++;
        if (scan.syncedAt) {
          if (!lastSyncTimestamp || new Date(scan.syncedAt) > new Date(lastSyncTimestamp)) {
            lastSyncTimestamp = scan.syncedAt;
          }
        }
      } else if (scan.syncStatus === SYNC_STATUS.SYNC_FAILED) {
        syncFailed++;
      }
    }

    // Check localStorage fallback for lastSyncTimestamp if none yet
    if (!lastSyncTimestamp && typeof localStorage !== 'undefined') {
      try {
        lastSyncTimestamp = localStorage.getItem(METRICS_STORAGE_KEY) || null;
      } catch (_) {}
    }

    return {
      totalScans,
      locallyStored,
      pendingSync,
      syncing,
      syncedToCloud,
      syncFailed,
      lastSyncTimestamp
    };
  }

  /**
   * Record last successful sync timestamp
   */
  recordSyncTimestamp(isoTimestamp) {
    const ts = isoTimestamp || new Date().toISOString();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(METRICS_STORAGE_KEY, ts);
      } catch (_) {}
    }
  }

  /**
   * Subscribe to changes in offline database
   * Returns unsubscribe function
   */
  subscribe(callback) {
    this._subscribers.add(callback);
    return () => {
      this._subscribers.delete(callback);
    };
  }

  _notifySubscribers(eventType, record) {
    for (const sub of this._subscribers) {
      try {
        sub({ eventType, record, metrics: this.getMetricsSync() });
      } catch (err) {
        console.warn('[OfflineSpectralDatabase] Subscriber error:', err);
      }
    }
  }

  /**
   * Synchronous metrics computation for fast UI renders
   */
  getMetricsSync() {
    const scans = Array.from(this._memoryStore.values());
    let pendingSync = 0;
    let syncing = 0;
    let syncedToCloud = 0;
    let syncFailed = 0;
    let lastSyncTimestamp = null;

    for (const scan of scans) {
      if (scan.syncStatus === SYNC_STATUS.PENDING_SYNC) pendingSync++;
      else if (scan.syncStatus === SYNC_STATUS.SYNCING) syncing++;
      else if (scan.syncStatus === SYNC_STATUS.SYNCED) {
        syncedToCloud++;
        if (scan.syncedAt && (!lastSyncTimestamp || new Date(scan.syncedAt) > new Date(lastSyncTimestamp))) {
          lastSyncTimestamp = scan.syncedAt;
        }
      } else if (scan.syncStatus === SYNC_STATUS.SYNC_FAILED) syncFailed++;
    }

    return {
      totalScans: scans.length,
      locallyStored: scans.length,
      pendingSync,
      syncing,
      syncedToCloud,
      syncFailed,
      lastSyncTimestamp
    };
  }

  /**
   * Clear all records (testing/reset)
   */
  async clear() {
    this._memoryStore.clear();
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      } catch (_) {}
    }
    if (this._db) {
      try {
        const tx = this._db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
      } catch (_) {}
    }
    this._notifySubscribers('clear', null);
  }
}

export const offlineSpectralDatabase = new OfflineSpectralDatabase();
