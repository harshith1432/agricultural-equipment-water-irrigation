/**
 * Modular VIS-NIR Spectroscopy Route Handlers (350–1100 nm)
 * High-performance backend endpoints for AgriSpectra handheld micro-spectrometer.
 * Endpoints:
 *   - POST /api/spectroscopy/sync (Batch synchronization & duplicate prevention / idempotency)
 *   - POST /api/spectroscopy/scans (Ingest single scan or batch with explicit verification confirmation)
 *   - GET  /api/spectroscopy/scans (List spectroscopy scans with pagination ?limit=..., ?offset=..., ?since=...)
 *   - GET  /api/spectroscopy/scans/:scanId (Scan details returning both raw and processed data)
 *   - GET  /api/spectroscopy/scans/:id/results (Chemometrics & canopy health analysis)
 *   - GET  /api/spectroscopy/latest (Fast query endpoint for mobile app)
 */

import { Router } from 'express';
import { centralStorage } from '../services/centralStorage.js';
import { schemaManager } from '../services/schemaManager.js';
import { firestoreClient } from '../services/firestoreClient.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { standardApiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Protect all spectroscopy endpoints with enterprise authentication / ID token verification
// and a standard rate limiter (mobile handhelds sync scans in bursts, but should
// never be able to flood the ingestion endpoint).
router.use('/spectroscopy', standardApiLimiter, authenticate);
router.use('/spectral', standardApiLimiter, authenticate);

// ===========================================================================
// 1. INGESTION & SYNCHRONIZATION ENDPOINTS
// ===========================================================================

/**
 * POST /api/spectroscopy/sync and /api/spectral/sync
 * High-reliability mobile synchronization endpoint.
 * Accepts:
 *   - Batch array: [ { scanId, specimen, location, timestamps, rawData, processedData }, ... ]
 *   - Object with batch: { scans: [ ... ] } or { records: [ ... ] }
 *   - Single scan: { scanId, specimen, location, timestamps, rawData, processedData }
 *
 * Idempotency & Duplicate Prevention:
 *   - Checks if scanId already exists in Cloud Firestore (farms/{farmId}/spectralScans/{scanId}).
 *   - If exists, updates without creating duplicates or throwing errors.
 *   - Permanently writes to Cloud Firestore.
 *   - Returns explicit verification confirmation: { success: true, scanId, cloudDocumentId, syncedAt }.
 */
router.post(['/spectroscopy/sync', '/spectral/sync'], async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Empty spectroscopy sync payload."
      });
    }

    // Determine if batch array or single object
    const scansList = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload.scans) ? payload.scans : (Array.isArray(payload.records) ? payload.records : null));

    if (scansList) {
      if (scansList.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Batch scan list cannot be empty."
        });
      }

      const batchResult = await schemaManager.batchSyncSpectralScans(scansList, { isStrict: true });
      return res.status(200).json(batchResult);
    }

    // Single scan sync
    const syncResult = await schemaManager.syncSpectralScan(payload, { isStrict: true });

    return res.status(syncResult.isDuplicate ? 200 : 201).json({
      success: true,
      scanId: syncResult.scanId,
      cloudDocumentId: syncResult.cloudDocumentId,
      syncedAt: syncResult.syncedAt,
      isDuplicate: syncResult.isDuplicate,
      status: syncResult.status,
      data: syncResult.data
    });
  } catch (error) {
    const statusCode = error.status || (error.message.includes('Validation Error') ? 400 : 500);
    return res.status(statusCode).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/spectroscopy/scans and /api/spectral/scans
 * Ingest raw spectral intensities, integration time, calibration reference, specimen metadata, and chemometrics.
 * Supports single scan ingestion or batch upload.
 * Returns explicit verification confirmation with cloudDocumentId and syncedAt.
 */
router.post(['/spectroscopy/scans', '/spectral/scans'], async (req, res) => {
  try {
    const payload = req.body;
    if (!payload || (typeof payload === 'object' && Object.keys(payload).length === 0)) {
      return res.status(400).json({
        success: false,
        error: "Empty spectroscopy scan payload."
      });
    }

    // Check if batch is passed to scans endpoint
    const scansList = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload.scans) ? payload.scans : (Array.isArray(payload.records) ? payload.records : null));

    if (scansList) {
      if (scansList.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Batch scan list cannot be empty."
        });
      }

      const batchResult = await schemaManager.batchSyncSpectralScans(scansList, { isStrict: false });
      return res.status(200).json(batchResult);
    }

    // Single scan ingestion (graceful normalization allows legacy hardware payloads)
    const syncResult = await schemaManager.syncSpectralScan(payload, { isStrict: false });
    const savedRecord = syncResult.data;

    return res.status(syncResult.isDuplicate ? 200 : 201).json({
      success: true,
      scanId: syncResult.scanId,
      cloudDocumentId: syncResult.cloudDocumentId,
      syncedAt: syncResult.syncedAt,
      isDuplicate: syncResult.isDuplicate,
      status: syncResult.status,
      message: `Spectroscopy scan ingested (${savedRecord.plantNumber || savedRecord.id} via ${savedRecord.hardwareLink || 'SYSTEM'}).`,
      data: savedRecord
    });
  } catch (error) {
    const statusCode = error.status || (error.message.includes('Validation Error') ? 400 : 500);
    return res.status(statusCode).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 2. QUERY & REPORTING ENDPOINTS
// ===========================================================================

/**
 * GET /api/spectroscopy/latest
 * Fast query endpoint for mobile app: returns latest spectral scan
 * Supports ?deviceId=..., ?plotId=..., ?farmId=...
 */
router.get('/spectroscopy/latest', (req, res) => {
  try {
    const { deviceId, plotId, farmId } = req.query;
    const latest = centralStorage.getLatestSpectroScan({ deviceId, plotId, farmId });

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: "No spectroscopy scans found matching query."
      });
    }

    res.status(200).json({
      success: true,
      data: latest
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/spectroscopy/scans and /api/spectral/scans
 * List spectroscopy scans with pagination (?limit=..., ?offset=..., ?since=...)
 * and multi-tenant filters (?farmId=..., ?plotId=..., ?deviceId=..., ?source=...)
 */
router.get(['/spectroscopy/scans', '/spectral/scans'], (req, res) => {
  try {
    const { farmId, plotId, deviceId, source, limit, offset, since } = req.query;
    let scans = centralStorage.getSpectroScans({ farmId, plotId, deviceId, source });

    // Filter by 'since' timestamp (ISO date string or epoch timestamp)
    if (since) {
      const sinceTime = new Date(since).getTime();
      if (!isNaN(sinceTime)) {
        scans = scans.filter(s => {
          const t = new Date(s.timestamp || s.scannedAt || s.timestamps?.scannedAt || 0).getTime();
          return t >= sinceTime;
        });
      }
    }

    // Chronological order: newest first
    scans.sort((a, b) => {
      const ta = new Date(a.timestamp || a.scannedAt || 0).getTime();
      const tb = new Date(b.timestamp || b.scannedAt || 0).getTime();
      return tb - ta;
    });

    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 500);
    const parsedOffset = Math.max(Number(offset) || 0, 0);
    const paginated = scans.slice(parsedOffset, parsedOffset + parsedLimit);

    res.status(200).json({
      success: true,
      count: paginated.length,
      totalAvailable: scans.length,
      limit: parsedLimit,
      offset: parsedOffset,
      hasMore: (parsedOffset + paginated.length) < scans.length,
      data: paginated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/spectroscopy/scans/:scanId
 * Retrieve specific scan by scanId returning both raw and processed data.
 */
router.get(['/spectroscopy/scans/:scanId', '/spectral/scans/:scanId'], async (req, res) => {
  try {
    const { scanId } = req.params;
    let scan = centralStorage.getSpectroScanById(scanId);

    // If not found in-memory, query Cloud Firestore
    if (!scan) {
      const farmId = req.query.farmId || req.headers['x-farm-id'] || 'farm-valley-1';
      scan = await firestoreClient.getSpectralScan(farmId, scanId);
    }

    if (!scan) {
      return res.status(404).json({ success: false, error: `Spectroscopy scan '${scanId}' not found.` });
    }

    // Structure both raw and processed data explicitly
    const rawReflectance = scan.rawReflectance || scan.rawIntensities || scan.rawData?.intensities || [];
    const rawData = scan.rawData || {
      intensities: rawReflectance,
      wavelengths: scan.wavelengths || Array.from({ length: rawReflectance.length || 76 }, (_, i) => 350 + i * 10),
      integrationTimeMs: scan.integrationTimeMs || 40
    };

    const processedData = scan.processedData || scan.chemometrics || scan.indices || {};
    const chemometrics = scan.chemometrics || processedData;
    const specimen = scan.specimen || {
      crop: scan.crop || "Agricultural Specimen",
      plantName: scan.plantName || scan.crop || "Specimen Plant",
      plantNumber: scan.plantNumber || "PLANT-001"
    };
    const location = scan.location || {
      farmId: scan.farmId || "farm-valley-1",
      plotId: scan.plotId || "plot-1",
      plotNumber: scan.plotNumber || 1
    };
    const timestamps = scan.timestamps || {
      scannedAt: scan.timestamp || scan.scannedAt || new Date().toISOString(),
      syncedAt: scan.syncedAt || scan.updatedAt || new Date().toISOString()
    };

    const enrichedScan = {
      ...scan,
      id: scan.id || scanId,
      scanId: scan.scanId || scan.id || scanId,
      specimen,
      location,
      timestamps,
      rawData,
      processedData,
      rawReflectance,
      rawIntensities: rawReflectance,
      chemometrics
    };

    res.status(200).json({
      success: true,
      data: enrichedScan
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/spectroscopy/scans/:id/results
 * Returns chemometrics indices, nitrogen prescriptions, and pathogen diagnosis
 */
router.get(['/spectroscopy/scans/:id/results', '/spectral/scans/:id/results'], (req, res) => {
  try {
    const { id } = req.params;
    const scan = centralStorage.getSpectroScanById(id);
    if (!scan) {
      return res.status(404).json({ success: false, error: `Spectroscopy scan '${id}' not found.` });
    }

    const { chemometrics } = scan;

    res.status(200).json({
      success: true,
      scanId: scan.id,
      timestamp: scan.timestamp,
      crop: scan.crop,
      plotId: scan.plotId,
      source: scan.source,
      indices: {
        ndvi: chemometrics.ndvi,
        ndre: chemometrics.ndre,
        leafWaterIndex: chemometrics.leafWaterIndex,
        cire: chemometrics.cire,
        vitalityScore: chemometrics.vitalityScore
      },
      prescriptions: {
        nitrogenPrescriptionKgAcre: chemometrics.nitrogenPrescriptionKg,
        irrigationCountdownHours: chemometrics.irrigationCountdownHours,
        irrigationUrgency: chemometrics.irrigationUrgency
      },
      pathology: chemometrics.diseaseRisk
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;