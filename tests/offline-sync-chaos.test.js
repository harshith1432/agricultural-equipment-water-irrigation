#!/usr/bin/env node
process.env.NODE_ENV = 'test';

/**
 * Section 14: Offline-First Data Storage & Synchronization Chaos Test Suite
 * 
 * Verifies Section 14 (Required Testing Scenarios A through G):
 *  - TEST A: Online scanning flow (Capture -> Local Save as PENDING_SYNC -> Backend sync -> Mark SYNCED with cloudDocumentId).
 *  - TEST B: Offline scanning flow (Internet disabled -> Multiple scans -> Saved locally as PENDING_SYNC -> Application reload/restart simulation -> Records preserved in local DB).
 *  - TEST C: Automatic synchronization (Pending records in local DB -> Internet restored event -> Sync engine wakes up -> Batch uploaded -> Verified backend acknowledgement -> Status transitioned to SYNCED).
 *  - TEST D: Duplicate prevention & idempotency (Re-uploading the exact same scanId -> Backend recognises existing scanId -> Firestore updates without duplicate documents).
 *  - TEST E: 30-Day Local Retention Policy:
 *      * Record with syncedAt > 30 days ago is eligible for cleanup and removed locally.
 *      * Record with syncedAt < 30 days ago is retained.
 *      * Records with PENDING_SYNC, LOCAL_ONLY, SYNCING, or SYNC_FAILED are NEVER deleted, even if > 30 days old.
 *      * Cloud copy remains intact when local copy is cleaned.
 *  - TEST F: Network & Security Chaos:
 *      * Network drop mid-upload (Abort/Timeout) -> status remains PENDING_SYNC or SYNC_FAILED with exponential backoff nextRetryAt, not lost.
 *      * HTTP 429 rate limit or 503 service unavailable handling.
 *      * Payload validation: missing scanId, corrupted data rejected.
 *  - TEST G: Raw and Processed Data Integrity:
 *      * Raw 18-channel counts are stored verbatim and immutable.
 *      * Processed values (NDVI, NDRE, WBI) are mathematically verified against raw inputs with calculation metadata.
 *      * Raw readings are never altered.
 */

// Initialize in-memory localStorage shim if executing under Node.js
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null
  };
}

import { describe, it, expect, runner } from './framework.js';
import {
  OfflineSyncEngine,
  SyncStatus,
  RETENTION_PERIOD_MS,
  computeDataChecksum
} from '../src/services/offlineSyncEngine.js';
import {
  WAVELENGTHS,
  convertAS7265xTo76Bands
} from '../src/hardware/chemometricsEngine.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';

// Standard 18-channel healthy specimen reading
const SAMPLE_18_CHANNELS_HEALTHY = [
  4500,  // R_610nm
  3200,  // S_680nm (Chlorophyll absorption pit)
  14500, // T_730nm (Red edge transition)
  22000, // U_760nm
  27500, // V_810nm (NIR plateau)
  29000, // W_860nm
  7800,  // G_560nm (Chlorophyll green peak)
  6200,  // H_585nm
  3800,  // I_645nm
  9500,  // J_705nm
  30500, // K_900nm (Water reference)
  28000, // L_940nm
  1900,  // A_410nm
  2100,  // B_435nm
  2400,  // C_460nm
  2900,  // D_485nm
  4100,  // E_510nm
  5600   // F_535nm
];

export function registerOfflineSyncChaosTests() {
  describe('Section 14: Required Testing Scenarios A through G - Offline Sync & Chaos Engineering', () => {

    // =======================================================================
    // TEST A: Online scanning flow
    // =======================================================================
    it('TEST A: Online scanning flow (Capture -> Local Save as PENDING_SYNC -> Backend sync -> Mark SYNCED with cloudDocumentId)', async () => {
      localStorage.clear();
      const engine = new OfflineSyncEngine({
        storageKey: 'agrispectra_test_a_scans',
        isOnline: true
      });

      const scanPayload = {
        scanId: 'scan-online-001',
        plotId: 'plot-1',
        plotNumber: 1,
        crop: 'Roma Tomato',
        plantNumber: 'PLANT-042',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      };

      // Track lifecycle states through observer
      const stateTransitions = [];
      engine.subscribe((evt) => {
        if (evt.event === 'syncStateChange' && evt.scanId === 'scan-online-001') {
          stateTransitions.push(evt.status);
        }
      });

      // 1. Capture scan
      const captured = engine.captureScan(scanPayload);

      // Verify immediate local save
      expect(captured.scanId).toBe('scan-online-001');
      expect(captured.status).toBe(SyncStatus.PENDING_SYNC);
      expect(captured.cloudDocumentId).toBeNull();
      expect(captured.syncedAt).toBeNull();

      // Verify persisted in localStorage immediately
      const rawStored = localStorage.getItem('agrispectra_test_a_scans');
      expect(rawStored).toBeDefined();
      const storedArray = JSON.parse(rawStored);
      expect(storedArray.length).toBe(1);
      expect(storedArray[0].scanId).toBe('scan-online-001');

      // 2. Perform backend sync
      const syncResult = await engine.syncPending();
      expect(syncResult.syncedCount).toBe(1);
      expect(syncResult.failedCount).toBe(0);

      // 3. Verify status transitioned to SYNCED with cloudDocumentId
      const syncedScan = engine.getLocalScanById('scan-online-001');
      expect(syncedScan.status).toBe(SyncStatus.SYNCED);
      expect(syncedScan.cloudDocumentId).toBe('scan-online-001');
      expect(typeof syncedScan.syncedAt).toBe('string');
      expect(new Date(syncedScan.syncedAt).getTime()).toBeGreaterThan(0);

      // 4. Verify cloud copy received document
      const cloudCopy = engine.cloudDatabase.get('scan-online-001');
      expect(cloudCopy).toBeDefined();
      expect(cloudCopy.cloudDocumentId).toBe('scan-online-001');

      // 5. Verify state transition sequence: PENDING_SYNC -> SYNCING -> SYNCED
      expect(stateTransitions).toContain(SyncStatus.SYNCING);
      expect(stateTransitions).toContain(SyncStatus.SYNCED);
    });

    // =======================================================================
    // TEST B: Offline scanning flow
    // =======================================================================
    it('TEST B: Offline scanning flow (Internet disabled -> Multiple scans -> Saved locally as PENDING_SYNC -> Application reload/restart simulation -> Records preserved in local DB)', async () => {
      localStorage.clear();
      const storageKey = 'agrispectra_test_b_offline_scans';

      // 1. Initialize engine with internet disabled
      const offlineEngine = new OfflineSyncEngine({
        storageKey,
        isOnline: false
      });
      expect(offlineEngine.isOnline).toBe(false);

      // 2. Capture multiple scans while disconnected across multiple plots
      const scan1 = offlineEngine.captureScan({
        scanId: 'scan-offline-zone1',
        plotId: 'plot-1',
        crop: 'Cabernet Sauvignon',
        plantNumber: 'PLANT-101',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      });

      const scan2 = offlineEngine.captureScan({
        scanId: 'scan-offline-zone2',
        plotId: 'plot-2',
        crop: 'Pinot Noir',
        plantNumber: 'PLANT-202',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      });

      const scan3 = offlineEngine.captureScan({
        scanId: 'scan-offline-zone3',
        plotId: 'plot-3',
        crop: 'Heirloom Tomatoes',
        plantNumber: 'PLANT-303',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      });

      // 3. Verify all saved locally with PENDING_SYNC status
      expect(scan1.status).toBe(SyncStatus.PENDING_SYNC);
      expect(scan2.status).toBe(SyncStatus.PENDING_SYNC);
      expect(scan3.status).toBe(SyncStatus.PENDING_SYNC);
      expect(scan1.cloudDocumentId).toBeNull();
      expect(scan2.cloudDocumentId).toBeNull();
      expect(scan3.cloudDocumentId).toBeNull();

      // 4. Verify sync attempts abort gracefully when offline
      const syncAttempt = await offlineEngine.syncPending();
      expect(syncAttempt.reason).toBe('OFFLINE');
      expect(syncAttempt.syncedCount).toBe(0);

      // 5. Simulate application reload / cold restart (destroying in-memory instance)
      const reloadedEngine = new OfflineSyncEngine({
        storageKey,
        isOnline: false
      });

      // 6. Verify records preserved in local DB across cold reboot
      const localScans = reloadedEngine.getAllLocalScans();
      expect(localScans.length).toBe(3);

      const recovered1 = reloadedEngine.getLocalScanById('scan-offline-zone1');
      const recovered2 = reloadedEngine.getLocalScanById('scan-offline-zone2');
      const recovered3 = reloadedEngine.getLocalScanById('scan-offline-zone3');

      expect(recovered1).toBeDefined();
      expect(recovered2).toBeDefined();
      expect(recovered3).toBeDefined();

      expect(recovered1.status).toBe(SyncStatus.PENDING_SYNC);
      expect(recovered2.status).toBe(SyncStatus.PENDING_SYNC);
      expect(recovered3.status).toBe(SyncStatus.PENDING_SYNC);

      expect(recovered1.crop).toBe('Cabernet Sauvignon');
      expect(recovered2.crop).toBe('Pinot Noir');
      expect(recovered3.crop).toBe('Heirloom Tomatoes');

      expect(recovered1.raw18Channels.length).toBe(18);
      expect(recovered2.raw18Channels.length).toBe(18);
      expect(recovered3.raw18Channels.length).toBe(18);
    });

    // =======================================================================
    // TEST C: Automatic synchronization
    // =======================================================================
    it('TEST C: Automatic synchronization (Pending records in local DB -> Internet restored event -> Sync engine wakes up -> Batch uploaded -> Verified backend acknowledgement -> Status transitioned to SYNCED)', async () => {
      localStorage.clear();
      const storageKey = 'agrispectra_test_c_auto_sync';

      // 1. Seed engine in offline state with 2 pending scans
      const engine = new OfflineSyncEngine({
        storageKey,
        isOnline: false
      });

      engine.captureScan({
        scanId: 'scan-auto-sync-1',
        plotId: 'plot-4',
        crop: 'Russet Potatoes',
        plantNumber: 'PLANT-401',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      });

      engine.captureScan({
        scanId: 'scan-auto-sync-2',
        plotId: 'plot-5',
        crop: 'Sweet Corn',
        plantNumber: 'PLANT-501',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      });

      expect(engine.getPendingScans().length).toBe(2);

      // 2. Trigger internet restored event
      let networkEventFired = false;
      engine.subscribe((evt) => {
        if (evt.event === 'networkChange' && evt.isOnline === true) {
          networkEventFired = true;
        }
      });

      // Restore network
      const syncPromise = engine.setOnline(true);
      expect(networkEventFired).toBe(true);
      expect(engine.isOnline).toBe(true);

      const syncResult = await syncPromise;
      expect(syncResult.syncedCount).toBe(2);
      expect(syncResult.failedCount).toBe(0);
      expect(syncResult.remainingPending).toBe(0);

      // 3. Verify all records transitioned to SYNCED with backend acknowledgement
      const scan1 = engine.getLocalScanById('scan-auto-sync-1');
      const scan2 = engine.getLocalScanById('scan-auto-sync-2');

      expect(scan1.status).toBe(SyncStatus.SYNCED);
      expect(scan2.status).toBe(SyncStatus.SYNCED);
      expect(scan1.cloudDocumentId).toBe('scan-auto-sync-1');
      expect(scan2.cloudDocumentId).toBe('scan-auto-sync-2');
      expect(typeof scan1.syncedAt).toBe('string');
      expect(typeof scan2.syncedAt).toBe('string');

      // 4. Verify Cloud database has confirmed documents
      expect(engine.cloudDatabase.has('scan-auto-sync-1')).toBe(true);
      expect(engine.cloudDatabase.has('scan-auto-sync-2')).toBe(true);
    });

    // =======================================================================
    // TEST D: Duplicate prevention & idempotency
    // =======================================================================
    it('TEST D: Duplicate prevention & idempotency (Re-uploading the exact same scanId -> Backend recognises existing scanId -> Firestore updates without duplicate documents)', async () => {
      localStorage.clear();
      mockFirestore.resetToDefault();

      const engine = new OfflineSyncEngine({
        storageKey: 'agrispectra_test_d_idempotency',
        isOnline: true
      });

      const scanId = 'scan-idempotent-specimen-99';
      const scanPayload = {
        scanId,
        id: scanId,
        plotId: 'plot-1',
        crop: 'Roma Tomato',
        plantNumber: 'PLANT-099',
        raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
      };

      // 1. Initial capture and sync
      engine.captureScan(scanPayload);
      await engine.syncPending();

      expect(engine.cloudDatabase.size).toBe(1);
      expect(engine.cloudDatabase.has(scanId)).toBe(true);

      // 2. Simulate Cloud Firestore direct sync via mockFirestore
      const initialCloudDocCount = mockFirestore.getSpectralScans().length;
      await mockFirestore.addSpectralScan(scanPayload);
      const postFirstUploadCount = mockFirestore.getSpectralScans().length;
      expect(postFirstUploadCount).toBe(initialCloudDocCount + 1);

      // 3. CHAOS EVENT: Duplicate submission / network retry re-uploading the exact same scanId
      const duplicatePayload = {
        ...scanPayload,
        notes: 'Retry packet triggered after transient network stall'
      };

      // Re-upload to engine cloud database
      const uploaderResult = await engine._defaultCloudUploader(duplicatePayload);
      expect(uploaderResult.success).toBe(true);
      expect(uploaderResult.idempotentUpdated).toBe(true);
      expect(uploaderResult.cloudDocumentId).toBe(scanId);

      // Total documents in engine cloud store must remain exactly 1
      expect(engine.cloudDatabase.size).toBe(1);

      // Re-upload to Cloud Firestore / mockFirestore
      await mockFirestore.addSpectralScan(duplicatePayload);
      const postDuplicateCount = mockFirestore.getSpectralScans().length;

      // Crucial Idempotency Assertion: Count must NOT increase
      expect(postDuplicateCount).toBe(postFirstUploadCount);

      // Document is updated in place
      const updatedDoc = mockFirestore.getSpectralScanById(scanId);
      expect(updatedDoc).toBeDefined();
      expect(updatedDoc.id).toBe(scanId);
    });

    // =======================================================================
    // TEST E: 30-Day Local Retention Policy
    // =======================================================================
    it('TEST E: 30-Day Local Retention Policy (Prune >30d SYNCED, retain <30d SYNCED, NEVER delete PENDING_SYNC/LOCAL_ONLY/SYNC_FAILED, preserve cloud copy)', async () => {
      localStorage.clear();
      const engine = new OfflineSyncEngine({
        storageKey: 'agrispectra_test_e_retention',
        isOnline: false
      });

      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      // Seed 7 test scans covering every lifecycle permutation
      const testScans = [
        // 1. Eligible for purge: SYNCED 45 days ago (> 30 days)
        {
          scanId: 'scan-synced-45d-old',
          status: SyncStatus.SYNCED,
          capturedAt: new Date(now - 45 * ONE_DAY_MS).toISOString(),
          syncedAt: new Date(now - 45 * ONE_DAY_MS).toISOString(),
          cloudDocumentId: 'scan-synced-45d-old',
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        },
        // 2. Retained: SYNCED 10 days ago (< 30 days)
        {
          scanId: 'scan-synced-10d-recent',
          status: SyncStatus.SYNCED,
          capturedAt: new Date(now - 10 * ONE_DAY_MS).toISOString(),
          syncedAt: new Date(now - 10 * ONE_DAY_MS).toISOString(),
          cloudDocumentId: 'scan-synced-10d-recent',
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        },
        // 3. Retained: SYNCED 29 days ago (< 30 days)
        {
          scanId: 'scan-synced-29d-boundary',
          status: SyncStatus.SYNCED,
          capturedAt: new Date(now - 29 * ONE_DAY_MS).toISOString(),
          syncedAt: new Date(now - 29 * ONE_DAY_MS).toISOString(),
          cloudDocumentId: 'scan-synced-29d-boundary',
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        },
        // 4. CRITICAL RETENTION: PENDING_SYNC captured 45 days ago (NEVER purge unsynced data!)
        {
          scanId: 'scan-pending-45d-old',
          status: SyncStatus.PENDING_SYNC,
          capturedAt: new Date(now - 45 * ONE_DAY_MS).toISOString(),
          syncedAt: null,
          cloudDocumentId: null,
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        },
        // 5. CRITICAL RETENTION: LOCAL_ONLY captured 60 days ago
        {
          scanId: 'scan-local-only-60d-old',
          status: SyncStatus.LOCAL_ONLY,
          capturedAt: new Date(now - 60 * ONE_DAY_MS).toISOString(),
          syncedAt: null,
          cloudDocumentId: null,
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        },
        // 6. CRITICAL RETENTION: SYNC_FAILED captured 40 days ago
        {
          scanId: 'scan-failed-40d-old',
          status: SyncStatus.SYNC_FAILED,
          capturedAt: new Date(now - 40 * ONE_DAY_MS).toISOString(),
          syncedAt: null,
          cloudDocumentId: null,
          retryCount: 5,
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        },
        // 7. CRITICAL RETENTION: SYNCING captured 35 days ago
        {
          scanId: 'scan-syncing-35d-old',
          status: SyncStatus.SYNCING,
          capturedAt: new Date(now - 35 * ONE_DAY_MS).toISOString(),
          syncedAt: null,
          cloudDocumentId: null,
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        }
      ];

      // Insert directly into local storage and cloud database
      for (const s of testScans) {
        engine._cache.set(s.scanId, s);
        // Put all into cloud copy to verify cloud copy preservation
        engine.cloudDatabase.set(s.scanId, { ...s, cloudRetained: true });
      }
      engine._persistToStorage();

      expect(engine.getAllLocalScans().length).toBe(7);
      expect(engine.cloudDatabase.size).toBe(7);

      // Run 30-Day Retention Cleanup
      const cleanupReport = engine.runRetentionCleanup(now);

      // Verify cleanup statistics
      expect(cleanupReport.purgedCount).toBe(1);
      expect(cleanupReport.retainedCount).toBe(6);
      expect(cleanupReport.purgedScanIds).toContain('scan-synced-45d-old');

      // Verify local database contents
      expect(engine.getLocalScanById('scan-synced-45d-old')).toBeNull(); // Purged locally
      expect(engine.getLocalScanById('scan-synced-10d-recent')).toBeDefined(); // Retained
      expect(engine.getLocalScanById('scan-synced-29d-boundary')).toBeDefined(); // Retained
      expect(engine.getLocalScanById('scan-pending-45d-old')).toBeDefined(); // Protected
      expect(engine.getLocalScanById('scan-local-only-60d-old')).toBeDefined(); // Protected
      expect(engine.getLocalScanById('scan-failed-40d-old')).toBeDefined(); // Protected
      expect(engine.getLocalScanById('scan-syncing-35d-old')).toBeDefined(); // Protected

      // CLOUD COPY VERIFICATION: Cloud copy of purged scan remains 100% INTACT!
      expect(engine.cloudDatabase.has('scan-synced-45d-old')).toBe(true);
      const cloudCopy = engine.cloudDatabase.get('scan-synced-45d-old');
      expect(cloudCopy.cloudRetained).toBe(true);
    });

    // =======================================================================
    // TEST F: Network & Security Chaos
    // =======================================================================
    describe('TEST F: Network & Security Chaos', () => {

      it('F.1: Network drop mid-upload (Abort/Timeout) -> status remains PENDING_SYNC or SYNC_FAILED with exponential backoff nextRetryAt, not lost', async () => {
        localStorage.clear();

        // Custom cloud uploader that simulates network abort
        let attemptCount = 0;
        const abortUploader = async (scan) => {
          attemptCount++;
          const err = new Error('The operation was aborted due to timeout (ETIMEDOUT)');
          err.name = 'AbortError';
          throw err;
        };

        const engine = new OfflineSyncEngine({
          storageKey: 'agrispectra_test_f1_drop',
          cloudUploader: abortUploader,
          baseRetryDelayMs: 2000,
          isOnline: true
        });

        engine.captureScan({
          scanId: 'scan-chaos-drop-01',
          plotId: 'plot-1',
          crop: 'Mustard Greens',
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        });

        // Attempt sync which encounters mid-upload drop
        const res = await engine.syncPending();
        expect(res.failedCount).toBe(1);
        expect(res.syncedCount).toBe(0);

        // Verify scan was NOT lost
        const scan = engine.getLocalScanById('scan-chaos-drop-01');
        expect(scan).toBeDefined();
        expect(scan.status).toBe(SyncStatus.SYNC_FAILED);
        expect(scan.retryCount).toBe(1);
        expect(typeof scan.nextRetryAt).toBe('string');
        expect(scan.lastSyncError).toContain('aborted');

        // Verify exponential backoff scheduling (nextRetryAt is in the future)
        const backoffTime = new Date(scan.nextRetryAt).getTime();
        expect(backoffTime).toBeGreaterThan(Date.now() + 1500);

        // Subsequent immediate sync attempt skips scan because backoff has not expired
        const skipRes = await engine.syncPending();
        expect(skipRes.syncedCount).toBe(0);
        expect(skipRes.failedCount).toBe(0);
      });

      it('F.2: HTTP 429 rate limit or 503 service unavailable handling with exponential backoff', async () => {
        localStorage.clear();

        let rateLimitHit = false;
        const rateLimitUploader = async (scan) => {
          rateLimitHit = true;
          const err = new Error('HTTP 429 Too Many Requests: Rate limit exceeded');
          err.status = 429;
          err.retryAfterMs = 7000; // 7 seconds backoff
          throw err;
        };

        const engine = new OfflineSyncEngine({
          storageKey: 'agrispectra_test_f2_rate_limit',
          cloudUploader: rateLimitUploader,
          isOnline: true
        });

        engine.captureScan({
          scanId: 'scan-chaos-429',
          plotId: 'plot-2',
          crop: 'Strawberries',
          raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
        });

        await engine.syncPending();
        expect(rateLimitHit).toBe(true);

        const scan = engine.getLocalScanById('scan-chaos-429');
        expect(scan.status).toBe(SyncStatus.SYNC_FAILED);
        expect(scan.retryCount).toBe(1);

        const retryAtMs = new Date(scan.nextRetryAt).getTime();
        // Expected backoff around 7000ms
        expect(retryAtMs).toBeGreaterThan(Date.now() + 5000);
      });

      it('F.3: Payload validation: missing scanId, corrupted data rejected', () => {
        const engine = new OfflineSyncEngine({ isOnline: true });

        // Missing scanId
        expect(() => {
          engine.captureScan({
            plotId: 'plot-1',
            raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
          });
        }).toThrow('missing scanId');

        // Empty string scanId
        expect(() => {
          engine.captureScan({
            scanId: '   ',
            raw18Channels: [...SAMPLE_18_CHANNELS_HEALTHY]
          });
        }).toThrow('missing scanId');

        // Corrupted raw channels: not an array
        expect(() => {
          engine.captureScan({
            scanId: 'scan-corrupt-1',
            raw18Channels: 'corrupted-string'
          });
        }).toThrow('raw18Channels must be an array');

        // Corrupted raw channels: only 10 channels instead of 18
        expect(() => {
          engine.captureScan({
            scanId: 'scan-corrupt-2',
            raw18Channels: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]
          });
        }).toThrow('expected exactly 18 channels');

        // Corrupted raw channels: contains NaN or null
        expect(() => {
          engine.captureScan({
            scanId: 'scan-corrupt-3',
            raw18Channels: [
              4500, 3200, NaN, 22000, 27500, 29000,
              7800, 6200, 3800, 9500, 30500, 28000,
              1900, 2100, 2400, 2900, 4100, 5600
            ]
          });
        }).toThrow('invalid value');

        // Negative raw counts rejected
        expect(() => {
          engine.captureScan({
            scanId: 'scan-corrupt-4',
            raw18Channels: [
              4500, 3200, -50, 22000, 27500, 29000,
              7800, 6200, 3800, 9500, 30500, 28000,
              1900, 2100, 2400, 2900, 4100, 5600
            ]
          });
        }).toThrow('invalid value');
      });
    });

    // =======================================================================
    // TEST G: Raw and Processed Data Integrity
    // =======================================================================
    describe('TEST G: Raw and Processed Data Integrity', () => {

      it('G.1: Raw 18-channel counts are stored verbatim and immutable', () => {
        localStorage.clear();
        const engine = new OfflineSyncEngine({
          storageKey: 'agrispectra_test_g_integrity',
          isOnline: false
        });

        const originalRaw = [
          4500, 3200, 14500, 22000, 27500, 29000,
          7800, 6200, 3800, 9500, 30500, 28000,
          1900, 2100, 2400, 2900, 4100, 5600
        ];

        const scan = engine.captureScan({
          scanId: 'scan-integrity-raw-01',
          crop: 'Bell Peppers',
          raw18Channels: originalRaw
        });

        // 1. Verbatim check
        expect(scan.raw18Channels.length).toBe(18);
        expect(scan.raw18Channels).toEqual(originalRaw);

        // 2. Immutability check: raw18Channels is frozen
        expect(Object.isFrozen(scan.raw18Channels)).toBe(true);

        // Attempting to modify frozen raw channel fails in strict mode
        expect(() => {
          scan.raw18Channels[0] = 999999;
        }).toThrow();

        // Verify stored value was NOT altered
        expect(scan.raw18Channels[0]).toBe(4500);

        // Modifying caller's original array after ingestion does NOT affect stored record
        originalRaw[0] = 111111;
        expect(scan.raw18Channels[0]).toBe(4500);
      });

      it('G.2: Processed values (NDVI, NDRE, WBI) are mathematically verified against raw inputs with calculation metadata', () => {
        const engine = new OfflineSyncEngine({ isOnline: false });

        const raw18 = [
          4500, 3200, 14500, 22000, 27500, 29000,
          7800, 6200, 3800, 9500, 30500, 28000,
          1900, 2100, 2400, 2900, 4100, 5600
        ];

        const scan = engine.captureScan({
          scanId: 'scan-math-verification',
          crop: 'Roma Tomato',
          raw18Channels: raw18
        });

        // 1. Metadata presence & structure
        expect(scan.calculationMetadata).toBeDefined();
        expect(scan.calculationMetadata.algorithm).toContain('AgriSpectra Edge Chemometrics Engine');
        expect(scan.calculationMetadata.rawImmutable).toBe(true);
        expect(typeof scan.calculationMetadata.calculatedAt).toBe('string');
        expect(scan.calculationMetadata.inputChecksum).toBe(computeDataChecksum(raw18));

        // 2. Extract key wavelength reflectance points from calculation metadata
        const { R680, R800, R720, R790, R900, R970 } = scan.calculationMetadata.wavelengthPoints;
        expect(typeof R680).toBe('number');
        expect(typeof R800).toBe('number');
        expect(typeof R720).toBe('number');
        expect(typeof R790).toBe('number');
        expect(typeof R900).toBe('number');
        expect(typeof R970).toBe('number');

        // 3. Mathematical verification of NDVI: (R800 - R680) / (R800 + R680)
        const expectedNdvi = (R800 - R680) / Math.max(0.001, (R800 + R680));
        expect(scan.processedIndices.ndvi).toBeCloseTo(expectedNdvi, 0.001);

        // 4. Mathematical verification of NDRE: (R790 - R720) / (R790 + R720)
        const expectedNdre = (R790 - R720) / Math.max(0.001, (R790 + R720));
        expect(scan.processedIndices.ndre).toBeCloseTo(expectedNdre, 0.001);

        // 5. Mathematical verification of WBI: R900 / R970
        const expectedWbi = R900 / Math.max(0.001, R970);
        expect(scan.processedIndices.wbi).toBeCloseTo(expectedWbi, 0.001);

        // 6. Formula strings recorded in metadata
        expect(scan.calculationMetadata.formulae.ndvi).toBe('(R800 - R680) / max(0.001, R800 + R680)');
        expect(scan.calculationMetadata.formulae.ndre).toBe('(R790 - R720) / max(0.001, R790 + R720)');
        expect(scan.calculationMetadata.formulae.wbi).toBe('R900 / max(0.001, R970)');
      });

      it('G.3: Raw readings are never altered across multiple sync cycles', async () => {
        localStorage.clear();
        const engine = new OfflineSyncEngine({
          storageKey: 'agrispectra_test_g3_immutable_sync',
          isOnline: true
        });

        const rawInitial = [
          4500, 3200, 14500, 22000, 27500, 29000,
          7800, 6200, 3800, 9500, 30500, 28000,
          1900, 2100, 2400, 2900, 4100, 5600
        ];

        const initialScan = engine.captureScan({
          scanId: 'scan-lifecycle-raw-check',
          crop: 'Grapes',
          raw18Channels: rawInitial
        });

        const initialHash = computeDataChecksum(initialScan.raw18Channels);

        // Perform synchronization cycle
        await engine.syncPending();

        const postSyncScan = engine.getLocalScanById('scan-lifecycle-raw-check');
        expect(postSyncScan.status).toBe(SyncStatus.SYNCED);

        // Assert raw counts have not been altered or mutated in any way
        expect(postSyncScan.raw18Channels).toEqual(rawInitial);
        const postSyncHash = computeDataChecksum(postSyncScan.raw18Channels);
        expect(postSyncHash).toBe(initialHash);
      });
    });

  });
}

// Support direct CLI execution via: node tests/offline-sync-chaos.test.js
if (process.argv[1]?.includes('offline-sync-chaos.test.js')) {
  registerOfflineSyncChaosTests();
  runner.run().then((success) => {
    if (success) {
      console.log('\x1b[32m✔ Section 14: Required Testing Scenarios A through G passed cleanly!\x1b[0m');
      process.exit(0);
    } else {
      console.error('\x1b[31m✖ Section 14 test failures detected.\x1b[0m');
      process.exit(1);
    }
  }).catch((err) => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}
