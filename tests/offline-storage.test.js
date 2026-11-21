/**
 * AgriSpectra Flow & Field - Offline Storage & Retention Test Suite
 *
 * Verifies:
 *  - Section 2: Offline-First Local Database & Storage Architecture (IndexedDB / Fallback)
 *  - Section 6: 30-Day Data Retention Policy, Expiry Engine & Safe Export/Purge
 *  - Section 7: Raw 18-Channel AS7265x & 76-Band Processed Chemometrics Schema
 *  - Section 8: Specimen & Location Metadata Specification
 *  - Section 11: Cryptographic Payload Integrity & Traceability Ledger (SHA-256)
 */

import { describe, it, expect } from './framework.js';
import {
  offlineSpectralDatabase,
  OfflineSpectralDatabase,
  SYNC_STATUS,
  createSpectralScanRecord,
  validateScanRecord,
  calculatePayloadChecksum,
  deterministicStringify,
  extractIntegrityPayload,
  AS7265X_CHANNELS,
  RETENTION_PERIOD_MS
} from '../src/storage/offlineSpectralDatabase.js';

import {
  retentionManager,
  RetentionManager
} from '../src/storage/retentionManager.js';

export function registerOfflineStorageTests() {
  describe('Section 2: Offline-First Local Database Architecture', () => {
    it('initializes persistent database with scans and sync_queue object stores', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Init' });
      await db.init();
      expect(db.isInitialized).toBe(true);

      const stats = await db.getStats();
      expect(stats.totalScans).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.countsByStatus[SYNC_STATUS.PENDING_SYNC]).toBe(0);
    });

    it('stores complete spectral records locally BEFORE any network request', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Save' });
      await db.clearDatabase();

      const scanData = await createSpectralScanRecord({
        userId: 'farmer-ramesh',
        farmId: 'farm-punjab-01',
        deviceId: 'AGRI-BLE-CLIP-01',
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        specimen: {
          plantNumber: 'P-101',
          plantName: 'Oryza sativa (Basmati Paddy)',
          potNumber: 'POT-A4',
          plotId: 'plot-1',
          farmName: 'Amritsar Organic Farm',
          zone: 'Zone 1 - Main North'
        }
      });

      const saved = await db.saveScan(scanData);
      expect(saved).toBeDefined();
      expect(saved.scanId).toBe(scanData.scanId);
      expect(saved.syncStatus).toBe(SYNC_STATUS.PENDING_SYNC);
      expect(saved.checksum).toBeDefined();
      expect(typeof saved.checksum).toBe('string');
      expect(saved.checksum.length).toBe(64);

      // Verify immediate local retrieval without network
      const retrieved = await db.getScan(scanData.scanId);
      expect(retrieved).toBeDefined();
      expect(retrieved.userId).toBe('farmer-ramesh');
      expect(retrieved.specimen.plantName).toBe('Oryza sativa (Basmati Paddy)');

      // Verify auto-enqueued in sync_queue
      const queue = await db.getSyncQueue();
      expect(queue.length).toBe(1);
      expect(queue[0].scanId).toBe(scanData.scanId);
      expect(queue[0].payloadSummary.plantName).toBe('Oryza sativa (Basmati Paddy)');
    });

    it('supports LOCAL_ONLY scans that persist without entering the cloud sync queue', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_LocalOnly' });
      await db.clearDatabase();

      const localScan = await createSpectralScanRecord({
        userId: 'guest-farmer',
        farmId: 'farm-guest-local-0',
        syncStatus: SYNC_STATUS.LOCAL_ONLY,
        specimen: {
          plantNumber: 'TEST-01',
          plantName: 'Experimental Basil',
          plotId: 'plot-sandbox'
        }
      });

      await db.saveScan(localScan);

      const retrieved = await db.getScan(localScan.scanId);
      expect(retrieved.syncStatus).toBe(SYNC_STATUS.LOCAL_ONLY);

      // Verify it did not enter sync queue
      const queue = await db.getSyncQueue();
      expect(queue.length).toBe(0);
    });

    it('filters scans by userId, farmId, syncStatus, and plotId', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Filters' });
      await db.clearDatabase();

      const scan1 = await createSpectralScanRecord({
        userId: 'user-carlos-1',
        farmId: 'farm-valley-1',
        syncStatus: SYNC_STATUS.SYNCED,
        specimen: { plantNumber: '1', plantName: 'Potato', plotId: 'plot-1' }
      });

      const scan2 = await createSpectralScanRecord({
        userId: 'user-carlos-1',
        farmId: 'farm-valley-1',
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        specimen: { plantNumber: '2', plantName: 'Tomato', plotId: 'plot-2' }
      });

      const scan3 = await createSpectralScanRecord({
        userId: 'user-elena-2',
        farmId: 'farm-elena-2',
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        specimen: { plantNumber: '3', plantName: 'Sugarcane', plotId: 'plot-1' }
      });

      await db.saveScan(scan1);
      await db.saveScan(scan2);
      await db.saveScan(scan3);

      const carlosScans = await db.getAllScans({ userId: 'user-carlos-1' });
      expect(carlosScans.length).toBe(2);

      const elenaScans = await db.getAllScans({ userId: 'user-elena-2' });
      expect(elenaScans.length).toBe(1);

      const plot1Scans = await db.getAllScans({ plotId: 'plot-1' });
      expect(plot1Scans.length).toBe(2);

      const pendingScans = await db.getAllScans({ syncStatus: SYNC_STATUS.PENDING_SYNC });
      expect(pendingScans.length).toBe(2);
    });

    it('tracks sync failures with exponential backoff retry scheduling', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Backoff' });
      await db.clearDatabase();

      const scan = await createSpectralScanRecord({
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        specimen: { plantNumber: 'B-1', plantName: 'Wheat', plotId: 'plot-3' }
      });
      await db.saveScan(scan);

      // Attempt 1 Failure
      const failed1 = await db.markSyncFailure(scan.scanId, 'HTTP 503 Service Unavailable');
      expect(failed1.syncStatus).toBe(SYNC_STATUS.SYNC_FAILED);
      expect(failed1.syncAttempts).toBe(1);
      expect(failed1.lastSyncError).toBe('HTTP 503 Service Unavailable');
      expect(failed1.nextRetryAt).toBeDefined();

      // Attempt 2 Failure
      const failed2 = await db.markSyncFailure(scan.scanId, 'Network Timeout (Socket reset)');
      expect(failed2.syncAttempts).toBe(2);
      expect(new Date(failed2.nextRetryAt).getTime()).toBeGreaterThan(new Date(failed1.nextRetryAt).getTime());

      // Validation Failure (Non-retryable)
      const failedVal = await db.markSyncFailure(scan.scanId, 'Invalid Schema Payload', { isValidationFailure: true });
      expect(failedVal.syncStatus).toBe(SYNC_STATUS.VALIDATION_FAILED);
      expect(failedVal.nextRetryAt).toBeNull();

      // Ensure dropped from sync queue
      const queue = await db.getSyncQueue();
      const inQueue = queue.find(q => q.scanId === scan.scanId);
      expect(inQueue).toBeUndefined();
    });

    it('transitions to SYNCED upon successful Firebase transmission and calculates 30-day retention', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Success' });
      await db.clearDatabase();

      const scan = await createSpectralScanRecord({
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        specimen: { plantNumber: 'S-1', plantName: 'Bell Pepper', plotId: 'plot-2' }
      });
      await db.saveScan(scan);

      const syncTimestamp = '2026-06-01T10:00:00.000Z';
      const synced = await db.markSyncSuccess(scan.scanId, {
        cloudDocumentId: 'firestore_doc_bellpepper_994',
        syncedAt: syncTimestamp
      });

      expect(synced.syncStatus).toBe(SYNC_STATUS.SYNCED);
      expect(synced.cloudDocumentId).toBe('firestore_doc_bellpepper_994');
      expect(synced.syncedAt).toBe(syncTimestamp);

      // Verify exact 30-day retention expiration timestamp
      const expectedExpiry = new Date(new Date(syncTimestamp).getTime() + RETENTION_PERIOD_MS).toISOString();
      expect(synced.retentionExpiresAt).toBe(expectedExpiry);

      // Verify removed from sync queue
      const queue = await db.getSyncQueue();
      expect(queue.length).toBe(0);
    });
  });

  describe('Section 7: Raw & Processed Data Schema & Storage', () => {
    it('stores and preserves raw 18-channel AS7265x sensor counts and optical baseline sweeps', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Raw' });
      await db.clearDatabase();

      const rawCounts = [483, 57, 54, 31, 84, 8, 209, 444, 280, 32, 12, 15, 43, 558, 817, 206, 432, 409];
      const darkBaselineCounts = [18, 12, 14, 15, 12, 10, 11, 14, 13, 10, 8, 9, 12, 15, 16, 12, 14, 11];
      const whiteReferenceCounts = [35000, 38000, 41000, 42000, 43000, 44000, 45000, 46000, 47000, 48000, 47000, 46000, 45000, 44000, 43000, 42000, 41000, 39000];

      const scan = await createSpectralScanRecord({
        rawData: {
          rawCounts,
          darkBaselineCounts,
          whiteReferenceCounts,
          sensorTelemetry: {
            temperatureC: 28.4,
            pressureHpa: 1011.8,
            humidityPercent: 62.5,
            batteryPercent: 91,
            supplyVoltageV: 3.28,
            integrationTimeMs: 100,
            gain: '64x'
          }
        },
        specimen: { plantNumber: 'AS-1', plantName: 'Cotton', plotId: 'plot-4' }
      });

      await db.saveScan(scan);
      const retrieved = await db.getScan(scan.scanId);

      expect(retrieved.rawData.rawCounts).toEqual(rawCounts);
      expect(retrieved.rawData.darkBaselineCounts).toEqual(darkBaselineCounts);
      expect(retrieved.rawData.whiteReferenceCounts).toEqual(whiteReferenceCounts);
      expect(retrieved.rawData.sensorTelemetry.temperatureC).toBe(28.4);
      expect(retrieved.rawData.sensorTelemetry.pressureHpa).toBe(1011.8);
      expect(retrieved.rawData.sensorTelemetry.humidityPercent).toBe(62.5);
      expect(retrieved.rawData.sensorTelemetry.gain).toBe('64x');
      expect(AS7265X_CHANNELS.length).toBe(18);
    });

    it('stores 76-band processed reflectance vector, agronomic indices, units, and formulas', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Processed' });
      await db.clearDatabase();

      const reflectance76 = [];
      for (let i = 0; i < 76; i++) {
        reflectance76.push(Number((0.1 + 0.7 * (i / 76)).toFixed(4)));
      }

      const scan = await createSpectralScanRecord({
        processedData: {
          reflectance76,
          ndvi: 0.78,
          ndre: 0.39,
          wbi: 0.992,
          leafWaterIndex: 0.89,
          vitalityScore: 92,
          nitrogenPrescription: {
            kgPerAcre: 0.0,
            recommendation: 'Nitrogen levels optimal. Maintenance mode.',
            timing: 'Standard fertigation cycle'
          }
        },
        specimen: { plantNumber: 'P-76', plantName: 'Maize', plotId: 'plot-5' }
      });

      await db.saveScan(scan);
      const retrieved = await db.getScan(scan.scanId);

      expect(retrieved.processedData.reflectance76.length).toBe(76);
      expect(retrieved.processedData.ndvi).toBe(0.78);
      expect(retrieved.processedData.ndre).toBe(0.39);
      expect(retrieved.processedData.vitalityScore).toBe(92);
      expect(retrieved.processedData.units.reflectance).toBe('ratio');
      expect(retrieved.processedData.units.ndvi).toContain('unitless');
      expect(retrieved.processedData.calculationMethods.ndviFormula).toBe('(R800 - R670) / (R800 + R670)');
      expect(retrieved.processedData.calculationMethods.ndreFormula).toBe('(R790 - R720) / (R790 + R720)');
    });
  });

  describe('Section 8: Specimen & Location Metadata Specification', () => {
    it('captures full specimen metadata and spatial location with GPS accuracy', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Metadata' });
      await db.clearDatabase();

      const scan = await createSpectralScanRecord({
        specimen: {
          plantNumber: 'GRAPE-42',
          plantName: 'Vitis vinifera (Cabernet Sauvignon)',
          potNumber: 'ROW-14-VINE-09',
          plotId: 'plot-sonoma-6',
          farmName: 'Sonoma Hillside Vineyard',
          zone: 'Zone 6 - South Slope',
          cropVariety: 'Cabernet Clone 337',
          growthStage: 'Veraison'
        },
        location: {
          latitude: 38.4522,
          longitude: -122.9567,
          accuracyMeters: 2.8,
          capturedAt: '2026-07-15T14:30:00.000Z',
          source: 'GPS_HARDWARE',
          permissionStatus: 'granted'
        }
      });

      await db.saveScan(scan);
      const retrieved = await db.getScan(scan.scanId);

      expect(retrieved.specimen.plantNumber).toBe('GRAPE-42');
      expect(retrieved.specimen.plantName).toBe('Vitis vinifera (Cabernet Sauvignon)');
      expect(retrieved.specimen.potNumber).toBe('ROW-14-VINE-09');
      expect(retrieved.specimen.plotId).toBe('plot-sonoma-6');
      expect(retrieved.specimen.zone).toBe('Zone 6 - South Slope');
      expect(retrieved.location.latitude).toBe(38.4522);
      expect(retrieved.location.longitude).toBe(-122.9567);
      expect(retrieved.location.accuracyMeters).toBe(2.8);
      expect(retrieved.location.source).toBe('GPS_HARDWARE');
    });

    it('validates and rejects records missing essential specimen or location data', () => {
      const invalidSpecimen = {
        scanId: 'invalid_1',
        userId: 'u1',
        farmId: 'f1',
        deviceId: 'd1',
        syncStatus: SYNC_STATUS.LOCAL_ONLY,
        rawData: {
          rawCounts: new Array(18).fill(100),
          darkBaselineCounts: new Array(18).fill(10),
          whiteReferenceCounts: new Array(18).fill(1000),
          sensorTelemetry: { temperatureC: 25, pressureHpa: 1013, humidityPercent: 50 }
        },
        processedData: {
          reflectance76: new Array(76).fill(0.5),
          ndvi: 0.6,
          ndre: 0.3,
          vitalityScore: 80
        },
        specimen: {
          // Missing plantNumber, plantName, plotId
        },
        location: {
          latitude: 30.0,
          longitude: 75.0,
          accuracyMeters: 5.0
        }
      };

      const result = validateScanRecord(invalidSpecimen);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('specimen.plantNumber'))).toBe(true);
      expect(result.errors.some(e => e.includes('specimen.plantName'))).toBe(true);
    });
  });

  describe('Section 11: Cryptographic Payload Integrity & Traceability Ledger', () => {
    it('generates SHA-256 payload checksum and validates record integrity', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Integrity' });
      await db.clearDatabase();

      const scan = await createSpectralScanRecord({
        specimen: { plantNumber: 'P-INT-1', plantName: 'Golden Delicious Apple', plotId: 'plot-1' }
      });
      await db.saveScan(scan);

      // Verify integrity check passes
      const verification = await db.verifyRecordIntegrity(scan.scanId);
      expect(verification.valid).toBe(true);
      expect(verification.recordedChecksum).toBe(scan.checksum);
      expect(verification.calculatedChecksum).toBe(scan.checksum);
      expect(verification.error).toBeNull();
    });

    it('detects tampering or corruption in raw sensor counts', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Tamper' });
      await db.clearDatabase();

      const scan = await createSpectralScanRecord({
        specimen: { plantNumber: 'P-TAMPER-1', plantName: 'Wheat', plotId: 'plot-1' }
      });
      await db.saveScan(scan);

      // Simulating malicious tampering or memory bit-flip in rawCounts
      const tamperedRecord = JSON.parse(JSON.stringify(scan));
      tamperedRecord.rawData.rawCounts[0] = 999999;

      const verification = await db.verifyRecordIntegrity(tamperedRecord);
      expect(verification.valid).toBe(false);
      expect(verification.calculatedChecksum).not.toBe(tamperedRecord.checksum);
      expect(verification.error).toContain('checksum mismatch');
    });

    it('detects tampering in processed reflectance or chemometric indices', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_TamperChem' });
      const scan = await createSpectralScanRecord({
        specimen: { plantNumber: 'P-TAMPER-2', plantName: 'Soybean', plotId: 'plot-2' }
      });

      const tamperedRecord = JSON.parse(JSON.stringify(scan));
      tamperedRecord.processedData.ndvi = 0.9999; // Altered

      const verification = await db.verifyRecordIntegrity(tamperedRecord);
      expect(verification.valid).toBe(false);
    });

    it('preserves scientific payload checksum across normal sync lifecycle transitions', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_SyncPreserve' });
      await db.clearDatabase();

      const scan = await createSpectralScanRecord({
        specimen: { plantNumber: 'P-PRESERVE-1', plantName: 'Corn', plotId: 'plot-3' }
      });
      await db.saveScan(scan);

      const initialChecksum = scan.checksum;

      // Update sync lifecycle state
      await db.markSyncSuccess(scan.scanId, {
        cloudDocumentId: 'cloud_corn_doc_771',
        syncedAt: new Date().toISOString()
      });

      const updated = await db.getScan(scan.scanId);
      expect(updated.syncStatus).toBe(SYNC_STATUS.SYNCED);
      expect(updated.cloudDocumentId).toBe('cloud_corn_doc_771');

      // Checksum must remain identical and verify 100% valid
      expect(updated.checksum).toBe(initialChecksum);
      const verification = await db.verifyRecordIntegrity(scan.scanId);
      expect(verification.valid).toBe(true);
    });
  });

  describe('Section 6: 30-Day Data Retention Policy Manager', () => {
    it('keeps synchronized records available for 30 days starting from syncedAt', () => {
      const syncedAt = '2026-05-01T12:00:00.000Z';
      const expiry = retentionManager.calculateRetentionExpiry(syncedAt);

      expect(expiry).toBe('2026-05-31T12:00:00.000Z');

      const activeRecord = {
        scanId: 'rec_active',
        syncStatus: SYNC_STATUS.SYNCED,
        cloudDocumentId: 'cloud_doc_1',
        syncedAt,
        retentionExpiresAt: expiry
      };

      // 15 days later: record must NOT be deleted
      const day15 = new Date('2026-05-16T12:00:00.000Z');
      const eval15 = retentionManager.canSafelyDelete(activeRecord, day15);
      expect(eval15.canDelete).toBe(false);
      expect(eval15.reason).toContain('remaining');

      // 31 days later: record has expired
      const day31 = new Date('2026-06-01T12:00:00.000Z');
      const eval31 = retentionManager.canSafelyDelete(activeRecord, day31);
      expect(eval31.canDelete).toBe(true);
      expect(eval31.reason).toContain('expired');
    });

    it('NEVER deletes records with LOCAL_ONLY, PENDING_SYNC, SYNCING, or SYNC_FAILED regardless of age', () => {
      const ancientTime = '2024-01-01T00:00:00.000Z'; // 2+ years ago
      const currentDate = new Date('2026-06-01T00:00:00.000Z');

      const protectedStatuses = [
        SYNC_STATUS.LOCAL_ONLY,
        SYNC_STATUS.PENDING_SYNC,
        SYNC_STATUS.SYNCING,
        SYNC_STATUS.SYNC_FAILED,
        SYNC_STATUS.VALIDATION_FAILED
      ];

      for (const status of protectedStatuses) {
        const record = {
          scanId: `protected_${status}`,
          syncStatus: status,
          createdAt: ancientTime,
          cloudDocumentId: null
        };

        const result = retentionManager.canSafelyDelete(record, currentDate);
        expect(result.canDelete).toBe(false);
        expect(result.reason).toContain('strictly protected');
      }
    });

    it('NEVER deletes records that have not reached Firebase even if status is claimed SYNCED', () => {
      const currentDate = new Date('2026-06-01T00:00:00.000Z');

      const falseSyncedRecord = {
        scanId: 'rec_ghost_sync',
        syncStatus: SYNC_STATUS.SYNCED,
        syncedAt: '2025-01-01T00:00:00.000Z',
        cloudDocumentId: null // Crucial: missing Firebase confirmation!
      };

      const result = retentionManager.canSafelyDelete(falseSyncedRecord, currentDate);
      expect(result.canDelete).toBe(false);
      expect(result.reason).toContain('has not reached Firebase');
    });

    it('provides manual and automated export before purging expired records (JSON format)', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_ExportJson' });
      await db.clearDatabase();
      const manager = new RetentionManager(db);

      // Seed 1 active record and 1 expired record
      const ancientSyncedAt = '2026-01-01T10:00:00.000Z';
      const expiredScan = await createSpectralScanRecord({
        scanId: 'scan_expired_01',
        syncStatus: SYNC_STATUS.SYNCED,
        syncedAt: ancientSyncedAt,
        cloudDocumentId: 'firebase_exp_01',
        specimen: { plantNumber: 'EXP-1', plantName: 'Old Potato', plotId: 'plot-1' }
      });
      await db.saveScan(expiredScan);

      const recentSyncedAt = '2026-05-25T10:00:00.000Z';
      const activeScan = await createSpectralScanRecord({
        scanId: 'scan_active_02',
        syncStatus: SYNC_STATUS.SYNCED,
        syncedAt: recentSyncedAt,
        cloudDocumentId: 'firebase_act_02',
        specimen: { plantNumber: 'ACT-2', plantName: 'Fresh Tomato', plotId: 'plot-2' }
      });
      await db.saveScan(activeScan);

      const auditDate = new Date('2026-06-01T10:00:00.000Z');

      // Purge with JSON export
      const purgeResult = await manager.purgeExpiredRecords({
        exportBeforePurge: true,
        format: 'json',
        referenceDate: auditDate
      });

      expect(purgeResult.purgedCount).toBe(1);
      expect(purgeResult.purgedIds).toEqual(['scan_expired_01']);
      expect(purgeResult.exportedData).toBeDefined();

      const parsedExport = JSON.parse(purgeResult.exportedData);
      expect(parsedExport.recordCount).toBe(1);
      expect(parsedExport.records[0].scanId).toBe('scan_expired_01');
      expect(parsedExport.records[0].specimen.plantName).toBe('Old Potato');

      // Verify expired scan is gone, but active scan remains
      const checkExpired = await db.getScan('scan_expired_01');
      expect(checkExpired).toBeNull();

      const checkActive = await db.getScan('scan_active_02');
      expect(checkActive).toBeDefined();
      expect(checkActive.scanId).toBe('scan_active_02');
    });

    it('provides manual and automated export before purging expired records (CSV format)', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_ExportCsv' });
      await db.clearDatabase();
      const manager = new RetentionManager(db);

      const ancientSyncedAt = '2026-01-01T10:00:00.000Z';
      const expiredScan = await createSpectralScanRecord({
        scanId: 'scan_expired_csv',
        syncStatus: SYNC_STATUS.SYNCED,
        syncedAt: ancientSyncedAt,
        cloudDocumentId: 'firebase_csv_01',
        specimen: { plantNumber: 'CSV-99', plantName: 'Punjab Basmati', plotId: 'plot-1' }
      });
      await db.saveScan(expiredScan);

      const auditDate = new Date('2026-06-01T10:00:00.000Z');
      const purgeResult = await manager.purgeExpiredRecords({
        exportBeforePurge: true,
        format: 'csv',
        referenceDate: auditDate
      });

      expect(purgeResult.purgedCount).toBe(1);
      expect(purgeResult.exportedData).toBeDefined();
      expect(purgeResult.exportedData).toContain('scanId,createdAt,syncedAt');
      expect(purgeResult.exportedData).toContain('scan_expired_csv');
      expect(purgeResult.exportedData).toContain('Punjab Basmati');
    });

    it('runs retention audit and guarantees 100% policy compliance', async () => {
      const db = new OfflineSpectralDatabase({ dbName: 'TestSpectralDB_Audit' });
      await db.clearDatabase();
      const manager = new RetentionManager(db);

      // Seed 2 unsynced, 1 active synced, 1 expired synced
      const unSynced1 = await createSpectralScanRecord({
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        specimen: { plantNumber: 'U1', plantName: 'Rice', plotId: 'plot-1' }
      });
      const unSynced2 = await createSpectralScanRecord({
        syncStatus: SYNC_STATUS.LOCAL_ONLY,
        specimen: { plantNumber: 'U2', plantName: 'Chilli', plotId: 'plot-2' }
      });
      const activeSynced = await createSpectralScanRecord({
        syncStatus: SYNC_STATUS.SYNCED,
        syncedAt: '2026-05-20T00:00:00.000Z',
        cloudDocumentId: 'doc_active',
        specimen: { plantNumber: 'A1', plantName: 'Soybean', plotId: 'plot-3' }
      });
      const expiredSynced = await createSpectralScanRecord({
        syncStatus: SYNC_STATUS.SYNCED,
        syncedAt: '2026-01-01T00:00:00.000Z',
        cloudDocumentId: 'doc_expired',
        specimen: { plantNumber: 'E1', plantName: 'Wheat', plotId: 'plot-4' }
      });

      await db.saveScan(unSynced1);
      await db.saveScan(unSynced2);
      await db.saveScan(activeSynced);
      await db.saveScan(expiredSynced);

      const audit = await manager.runRetentionAudit({ referenceDate: new Date('2026-06-01T00:00:00.000Z') });

      expect(audit.totalScans).toBe(4);
      expect(audit.syncedScans).toBe(2);
      expect(audit.unSyncedProtected).toBe(2);
      expect(audit.activeRetainedScans).toBe(1);
      expect(audit.expiredEligibleScans).toBe(1);
      expect(audit.complianceStatus).toBe('100%_COMPLIANT');
    });
  });
}
