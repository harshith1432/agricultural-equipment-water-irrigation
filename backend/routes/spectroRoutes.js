/**
 * Modular VIS-NIR Spectroscopy Route Handlers (350–1100 nm)
 * Endpoints:
 *   - POST /api/spectroscopy/scans (Ingest spectral scan with raw intensities & chemometrics)
 *   - GET  /api/spectroscopy/scans (List spectroscopy scans)
 *   - GET  /api/spectroscopy/scans/:id (Scan details)
 *   - GET  /api/spectroscopy/scans/:id/results (Chemometrics & canopy health analysis)
 *   - GET  /api/spectroscopy/latest (Fast query endpoint for mobile app)
 */

import { Router } from 'express';
import { centralStorage } from '../services/centralStorage.js';

const router = Router();

// ===========================================================================
// 1. INGESTION ENDPOINTS
// ===========================================================================

/**
 * POST /api/spectroscopy/scans
 * Ingest raw spectral intensities, integration time, calibration reference, and chemometrics
 * Supports USB_TYPE_C, BLUETOOTH_BLE, and WIFI_CLOUD
 */
router.post('/spectroscopy/scans', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Empty spectroscopy scan payload."
      });
    }

    const record = centralStorage.addSpectroScan(payload);

    res.status(201).json({
      success: true,
      message: `Spectroscopy scan ingested (${record.source} via ${record.connectionMode}).`,
      data: record
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
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
 * GET /api/spectroscopy/scans
 * List spectroscopy scans with filtering
 */
router.get('/spectroscopy/scans', (req, res) => {
  try {
    const { farmId, plotId, deviceId, source, limit } = req.query;
    const scans = centralStorage.getSpectroScans({ farmId, plotId, deviceId, source });

    const max = Number(limit) || 50;
    const paginated = scans.slice(0, max);

    res.status(200).json({
      success: true,
      count: paginated.length,
      totalAvailable: scans.length,
      data: paginated
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/spectroscopy/scans/:id
 * Retrieve specific scan by ID
 */
router.get('/spectroscopy/scans/:id', (req, res) => {
  try {
    const { id } = req.params;
    const scan = centralStorage.getSpectroScanById(id);
    if (!scan) {
      return res.status(404).json({ success: false, error: `Spectroscopy scan '${id}' not found.` });
    }

    res.status(200).json({
      success: true,
      data: scan
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/spectroscopy/scans/:id/results
 * Returns chemometrics indices, nitrogen prescriptions, and pathogen diagnosis
 */
router.get('/spectroscopy/scans/:id/results', (req, res) => {
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
