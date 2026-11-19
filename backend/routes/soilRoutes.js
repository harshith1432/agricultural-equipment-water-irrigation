/**
 * Modular Soil Telemetry & LABART 8-in-1 Modbus Route Handlers
 * Endpoints:
 *   - POST /api/soil/scans (Ingest LABART 8-in-1 measurements or raw Modbus)
 *   - POST /api/telemetry/soil/raw (Direct Wi-Fi / Cloud IoT ingestion)
 *   - GET  /api/soil/scans (List scans with filtering)
 *   - GET  /api/soil/scans/:id (Scan details)
 *   - GET  /api/soil/scans/:id/results (Farmer-friendly crop threshold interpretations)
 *   - GET  /api/soil/history (Historical time-series with depth and crop stage)
 *   - GET  /api/soil/latest (Fast query endpoint for mobile app by deviceId/plotId)
 */

import { Router } from 'express';
import { centralStorage, CROP_PROFILES } from '../services/centralStorage.js';
import { enterpriseStore } from '../services/enterpriseStore.js';
import { schemaManager } from '../services/schemaManager.js';

const router = Router();

// ===========================================================================
// 1. INGESTION ENDPOINTS
// ===========================================================================

/**
 * POST /api/soil/scans
 * Ingest LABART 8-in-1 raw or converted soil measurements
 * Source modes: 'WIFI_CLOUD' | 'USB_TYPE_C' | 'BLUETOOTH_BLE'
 */
router.post('/soil/scans', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Empty payload. Expected LABART 8-in-1 sensor measurements or raw Modbus array."
      });
    }

    const record = centralStorage.addSoilScan(payload);

    // Sync with enterpriseStore plots if applicable
    if (enterpriseStore && enterpriseStore.plots) {
      const plot = enterpriseStore.plots.find(p => p.id === record.fieldId || p.id === record.plotId);
      if (plot && plot.soilSensors) {
        if (record.depthCm <= 15) {
          plot.soilSensors.depth10cm = {
            vwc: record.measurements.moisture,
            temperatureC: record.measurements.temperature,
            ec: record.measurements.ec / 1000
          };
        } else if (record.depthCm <= 35) {
          plot.soilSensors.depth30cm = {
            vwc: record.measurements.moisture,
            temperatureC: record.measurements.temperature,
            ec: record.measurements.ec / 1000
          };
        } else {
          plot.soilSensors.depth50cm = {
            vwc: record.measurements.moisture,
            temperatureC: record.measurements.temperature,
            ec: record.measurements.ec / 1000
          };
        }
      }
    }

    // Persist scan to Cloud Firestore database via schemaManager
    schemaManager.saveSoilScan(record).catch(e => console.warn('[soilRoutes] DB scan save note:', e.message));

    res.status(201).json({
      success: true,
      message: `LABART 8-in-1 scan ingested (${record.source} via ${record.connectionMode}).`,
      data: record
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/telemetry/soil/raw
 * Direct Wi-Fi IoT gateway / sensor node packet ingestion
 * connectionMode: 'WIFI_DIRECT', source: 'WIFI_CLOUD'
 */
router.post('/telemetry/soil/raw', (req, res) => {
  try {
    const rawPacket = req.body;
    if (!rawPacket || (!rawPacket.rawModbus && !rawPacket.measurements && rawPacket.moisture === undefined)) {
      return res.status(400).json({
        success: false,
        error: "Invalid raw packet format. Expected rawModbus register array or measurement object."
      });
    }

    const record = centralStorage.addSoilScan({
      ...rawPacket,
      connectionMode: "WIFI_DIRECT",
      source: "WIFI_CLOUD",
      timestamp: rawPacket.timestamp || new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: "Direct Wi-Fi soil telemetry packet ingested successfully.",
      source: "WIFI_CLOUD",
      connectionMode: "WIFI_DIRECT",
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
 * GET /api/soil/latest
 * Fast query endpoint for mobile app: returns latest reading
 * Supports ?deviceId=..., ?plotId=..., ?farmId=...
 */
router.get('/soil/latest', (req, res) => {
  try {
    const { deviceId, plotId, fieldId, farmId } = req.query;
    const latest = centralStorage.getLatestSoilScan({
      deviceId,
      plotId: plotId || fieldId,
      farmId
    });

    if (!latest) {
      return res.status(404).json({
        success: false,
        error: "No soil scan records found matching query criteria."
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
 * GET /api/soil/scans
 * List all soil scans with optional filtering
 */
router.get('/soil/scans', (req, res) => {
  try {
    const { farmId, fieldId, plotId, deviceId, source, limit } = req.query;
    const scans = centralStorage.getSoilScans({
      farmId,
      fieldId,
      plotId,
      deviceId,
      source
    });

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
 * GET /api/soil/scans/:id
 * Fetch single soil scan record
 */
router.get('/soil/scans/:id', (req, res) => {
  try {
    const { id } = req.params;
    const scan = centralStorage.getSoilScanById(id);
    if (!scan) {
      return res.status(404).json({ success: false, error: `Soil scan '${id}' not found.` });
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
 * GET /api/soil/scans/:id/results
 * Farmer-friendly agronomic interpretations with crop profile thresholds
 */
router.get('/soil/scans/:id/results', (req, res) => {
  try {
    const { id } = req.params;
    const scan = centralStorage.getSoilScanById(id);
    if (!scan) {
      return res.status(404).json({ success: false, error: `Soil scan '${id}' not found.` });
    }

    const { cropProfile } = req.query;
    let interpretations = scan.interpretations;

    // Recalculate if custom crop profile is requested
    if (cropProfile && CROP_PROFILES[cropProfile.toUpperCase()]) {
      interpretations = centralStorage.interpretSoilScan(scan.measurements, cropProfile.toUpperCase());
    }

    res.status(200).json({
      success: true,
      scanId: scan.id,
      timestamp: scan.timestamp,
      fieldId: scan.fieldId,
      crop: scan.crop,
      connectionMode: scan.connectionMode,
      source: scan.source,
      measurements: scan.measurements,
      interpretations
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/soil/history
 * Historical time-series with depth, crop stage, and sensor metadata
 */
router.get('/soil/history', (req, res) => {
  try {
    const { fieldId, plotId, farmId, depth, limit } = req.query;
    const history = centralStorage.getSoilHistory({
      fieldId,
      plotId,
      farmId,
      depth,
      limit
    });

    res.status(200).json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
