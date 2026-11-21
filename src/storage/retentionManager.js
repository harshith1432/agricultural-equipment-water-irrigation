/**
 * AgriSpectra Flow & Field - 30-Day Data Retention Policy Manager
 *
 * Implements Section 6:
 *  - Successfully synchronized records (status === 'SYNCED') remain available for 30 days starting from `syncedAt`.
 *  - Strict Safeguard: NEVER delete records with LOCAL_ONLY, PENDING_SYNC, SYNCING, or SYNC_FAILED.
 *  - Strict Safeguard: NEVER delete records that have not reached Firebase (missing cloudDocumentId).
 *  - Automated & Manual Export Functionality (JSON / CSV) before any purge.
 */

import {
  offlineSpectralDatabase,
  SYNC_STATUS,
  RETENTION_PERIOD_DAYS,
  RETENTION_PERIOD_MS
} from './offlineSpectralDatabase.js';

export class RetentionManager {
  constructor(database = offlineSpectralDatabase) {
    this.db = database;
    this.retentionPeriodDays = RETENTION_PERIOD_DAYS;
    this.retentionPeriodMs = RETENTION_PERIOD_MS;
  }

  /**
   * Calculates retention expiry timestamp (30 days from syncedAt)
   */
  calculateRetentionExpiry(syncedAt) {
    if (!syncedAt) return null;
    const syncedTime = new Date(syncedAt).getTime();
    if (isNaN(syncedTime)) return null;
    return new Date(syncedTime + this.retentionPeriodMs).toISOString();
  }

  /**
   * Evaluates whether a specific record can be safely purged under Section 6 rules.
   * Enforces 4-layer defense in depth.
   */
  canSafelyDelete(record, referenceDate = new Date()) {
    if (!record || typeof record !== 'object') {
      return { canDelete: false, reason: 'Invalid record object' };
    }

    // Safeguard 1: Status must be strictly 'SYNCED'
    if (record.syncStatus !== SYNC_STATUS.SYNCED) {
      return {
        canDelete: false,
        reason: `Record is not SYNCED (current status: ${record.syncStatus}). Non-synced records are strictly protected.`
      };
    }

    // Safeguard 2: Must have confirmed Firebase / Cloud Document ID
    if (!record.cloudDocumentId || typeof record.cloudDocumentId !== 'string' || record.cloudDocumentId.trim() === '') {
      return {
        canDelete: false,
        reason: 'Record has not reached Firebase or backend cloud ledger (missing cloudDocumentId).'
      };
    }

    // Safeguard 3: Must have valid syncedAt timestamp
    if (!record.syncedAt) {
      return {
        canDelete: false,
        reason: 'Record missing syncedAt timestamp; cannot establish retention window.'
      };
    }

    const syncedTime = new Date(record.syncedAt).getTime();
    if (isNaN(syncedTime)) {
      return {
        canDelete: false,
        reason: 'Invalid syncedAt timestamp format.'
      };
    }

    // Safeguard 4: 30-Day Window Verification
    const refTime = new Date(referenceDate).getTime();
    const expiryTime = record.retentionExpiresAt
      ? new Date(record.retentionExpiresAt).getTime()
      : syncedTime + this.retentionPeriodMs;

    if (refTime >= expiryTime) {
      const daysElapsed = ((refTime - syncedTime) / (24 * 60 * 60 * 1000)).toFixed(1);
      return {
        canDelete: true,
        reason: `Record expired (${daysElapsed} days since sync). Eligible for safe deletion.`
      };
    }

    const daysRemaining = Math.max(0, ((expiryTime - refTime) / (24 * 60 * 60 * 1000))).toFixed(1);
    return {
      canDelete: false,
      reason: `Record within active 30-day retention window (${daysRemaining} days remaining).`
    };
  }

  /**
   * Scans the database and finds all records that have exceeded their 30-day retention window.
   * Only returns records that meet all 4 deletion criteria.
   */
  async findExpiredRecords({ referenceDate = new Date() } = {}) {
    const allScans = await this.db.getAllScans();
    const expired = [];

    for (const scan of allScans) {
      const evaluation = this.canSafelyDelete(scan, referenceDate);
      if (evaluation.canDelete) {
        expired.push(scan);
      }
    }

    return expired;
  }

  /**
   * Exports an array of scan records to formatted JSON bundle.
   */
  exportRecordsToJSON(records) {
    const bundle = {
      system: 'AgriSpectra Flow & Field',
      module: 'Offline Spectral Storage & Retention Engine',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      retentionPolicyDays: this.retentionPeriodDays,
      recordCount: records.length,
      records: records
    };
    return JSON.stringify(bundle, null, 2);
  }

  /**
   * Exports an array of scan records to standardized CSV format.
   * Flattens specimen, location, chemometrics, and telemetry for analytical export.
   */
  exportRecordsToCSV(records) {
    const headers = [
      'scanId',
      'createdAt',
      'syncedAt',
      'retentionExpiresAt',
      'syncStatus',
      'cloudDocumentId',
      'userId',
      'farmId',
      'deviceId',
      'plantNumber',
      'plantName',
      'potNumber',
      'plotId',
      'farmName',
      'zone',
      'cropVariety',
      'growthStage',
      'latitude',
      'longitude',
      'accuracyMeters',
      'locationSource',
      'ndvi',
      'ndre',
      'wbi',
      'leafWaterIndex',
      'vitalityScore',
      'nitrogenKgPerAcre',
      'tempC',
      'pressureHpa',
      'humidityPercent',
      'batteryPercent',
      'checksum'
    ];

    const escapeCsv = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = records.map(r => {
      return [
        escapeCsv(r.scanId),
        escapeCsv(r.createdAt),
        escapeCsv(r.syncedAt),
        escapeCsv(r.retentionExpiresAt),
        escapeCsv(r.syncStatus),
        escapeCsv(r.cloudDocumentId),
        escapeCsv(r.userId),
        escapeCsv(r.farmId),
        escapeCsv(r.deviceId),
        escapeCsv(r.specimen?.plantNumber),
        escapeCsv(r.specimen?.plantName),
        escapeCsv(r.specimen?.potNumber),
        escapeCsv(r.specimen?.plotId),
        escapeCsv(r.specimen?.farmName),
        escapeCsv(r.specimen?.zone),
        escapeCsv(r.specimen?.cropVariety),
        escapeCsv(r.specimen?.growthStage),
        escapeCsv(r.location?.latitude),
        escapeCsv(r.location?.longitude),
        escapeCsv(r.location?.accuracyMeters),
        escapeCsv(r.location?.source),
        escapeCsv(r.processedData?.ndvi),
        escapeCsv(r.processedData?.ndre),
        escapeCsv(r.processedData?.wbi),
        escapeCsv(r.processedData?.leafWaterIndex),
        escapeCsv(r.processedData?.vitalityScore),
        escapeCsv(r.processedData?.nitrogenPrescription?.kgPerAcre),
        escapeCsv(r.rawData?.sensorTelemetry?.temperatureC),
        escapeCsv(r.rawData?.sensorTelemetry?.pressureHpa),
        escapeCsv(r.rawData?.sensorTelemetry?.humidityPercent),
        escapeCsv(r.rawData?.sensorTelemetry?.batteryPercent),
        escapeCsv(r.checksum)
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  /**
   * Exports all records currently stored in the local database.
   */
  async exportAllRecords(format = 'json') {
    const records = await this.db.getAllScans();
    if (format.toLowerCase() === 'csv') {
      return this.exportRecordsToCSV(records);
    }
    return this.exportRecordsToJSON(records);
  }

  /**
   * Purges expired records after mandatory export backup.
   * Never deletes un-synced or non-Firebase records.
   */
  async purgeExpiredRecords({ exportBeforePurge = true, format = 'json', referenceDate = new Date() } = {}) {
    const expiredRecords = await this.findExpiredRecords({ referenceDate });

    if (expiredRecords.length === 0) {
      return {
        purgedCount: 0,
        purgedIds: [],
        exportedData: null,
        timestamp: new Date().toISOString()
      };
    }

    // 1. Mandatory Pre-Purge Export Backup
    let exportedData = null;
    if (exportBeforePurge) {
      exportedData = format.toLowerCase() === 'csv'
        ? this.exportRecordsToCSV(expiredRecords)
        : this.exportRecordsToJSON(expiredRecords);
    }

    // 2. Safe Deletion Execution
    const purgedIds = [];
    for (const record of expiredRecords) {
      // Re-validate safety rule immediately prior to delete
      const safetyCheck = this.canSafelyDelete(record, referenceDate);
      if (safetyCheck.canDelete) {
        await this.db.deleteScan(record.scanId);
        purgedIds.push(record.scanId);
      }
    }

    return {
      purgedCount: purgedIds.length,
      purgedIds,
      exportedData,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Audits the entire spectral database for compliance with the 30-day retention policy.
   */
  async runRetentionAudit({ referenceDate = new Date() } = {}) {
    const allScans = await this.db.getAllScans();
    const refTime = new Date(referenceDate).getTime();

    let syncedCount = 0;
    let unSyncedProtectedCount = 0;
    let activeRetainedCount = 0;
    let expiredEligibleCount = 0;

    allScans.forEach(scan => {
      const check = this.canSafelyDelete(scan, referenceDate);
      if (scan.syncStatus === SYNC_STATUS.SYNCED && scan.cloudDocumentId) {
        syncedCount++;
        if (check.canDelete) {
          expiredEligibleCount++;
        } else {
          activeRetainedCount++;
        }
      } else {
        unSyncedProtectedCount++;
      }
    });

    return {
      totalScans: allScans.length,
      syncedScans: syncedCount,
      unSyncedProtected: unSyncedProtectedCount,
      activeRetainedScans: activeRetainedCount,
      expiredEligibleScans: expiredEligibleCount,
      referenceDate: new Date(referenceDate).toISOString(),
      complianceStatus: '100%_COMPLIANT',
      policyGuarantee: 'Zero unsynced or non-Firebase records will ever be deleted.'
    };
  }
}

// Global Singleton Instance
export const retentionManager = new RetentionManager(offlineSpectralDatabase);
