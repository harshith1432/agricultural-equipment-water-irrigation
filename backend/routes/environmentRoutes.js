/**
 * Modular Micro-Climate & Agrometeorology Route Handlers
 * Endpoints:
 *   - POST /api/environment/readings (Ingest physical USB / Wi-Fi / BLE ambient readings)
 *   - GET  /api/environment/latest (Latest readings with explicit source differentiation)
 *   - GET  /api/environment/weather (Open-Meteo API with IMD fallback)
 *   - GET  /api/environment/history (Daily min/max and environmental trends)
 */

import { Router } from 'express';
import { centralStorage } from '../services/centralStorage.js';
import { weatherService } from '../services/weatherService.js';

const router = Router();

// ===========================================================================
// 1. INGESTION ENDPOINTS
// ===========================================================================

/**
 * POST /api/environment/readings
 * Ingest ambient temperature & humidity from physical USB-C, Wi-Fi IoT node, or BLE
 */
router.post('/environment/readings', (req, res) => {
  try {
    const payload = req.body;
    if (!payload || (payload.temperature === undefined && payload.temp === undefined)) {
      return res.status(400).json({
        success: false,
        error: "Missing required environmental parameters ('temperature' required)."
      });
    }

    const record = centralStorage.addEnvReading({
      ...payload,
      temperature: payload.temperature !== undefined ? payload.temperature : payload.temp,
      relativeHumidity: payload.relativeHumidity !== undefined ? payload.relativeHumidity : (payload.humidity || 50)
    });

    res.status(201).json({
      success: true,
      message: `Environmental telemetry ingested (${record.source}).`,
      data: record
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 2. QUERY & WEATHER ENDPOINTS
// ===========================================================================

/**
 * GET /api/environment/latest
 * Returns latest readings with explicit multi-modal source differentiation:
 *   - WIFI_CLOUD
 *   - USB_TYPE_C
 *   - BLUETOOTH_BLE
 */
router.get('/environment/latest', (req, res) => {
  try {
    const { farmId, plotId, source } = req.query;

    const latest = centralStorage.getLatestEnvReading({ farmId, plotId, source });
    if (!latest) {
      return res.status(404).json({
        success: false,
        error: "No environmental readings found."
      });
    }

    // Source breakdown across all three connection modes
    const latestWifi = centralStorage.getLatestEnvReading({ farmId, plotId, source: 'WIFI_CLOUD' });
    const latestUsb = centralStorage.getLatestEnvReading({ farmId, plotId, source: 'USB_TYPE_C' });
    const latestBle = centralStorage.getLatestEnvReading({ farmId, plotId, source: 'BLUETOOTH_BLE' });

    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      primaryReading: latest,
      sources: {
        WIFI_CLOUD: latestWifi || null,
        USB_TYPE_C: latestUsb || null,
        BLUETOOTH_BLE: latestBle || null
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/environment/weather
 * Open-Meteo API hyper-local agrometeorological forecast with IMD fallback
 * Supports ?lat=...&lon=... or ?latitude=...&longitude=...
 */
router.get('/environment/weather', async (req, res) => {
  try {
    const lat = Number(req.query.lat || req.query.latitude || 36.6777);
    const lon = Number(req.query.lon || req.query.longitude || -121.6555);

    const weather = await weatherService.getWeather(lat, lon);
    res.status(200).json(weather);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: `Weather retrieval failed: ${error.message}`
    });
  }
});

/**
 * GET /api/environment/history
 * Historical environmental trends (daily min/max, VPD, solar radiation)
 */
router.get('/environment/history', (req, res) => {
  try {
    const { farmId, plotId, source, limit } = req.query;
    const history = centralStorage.getEnvHistory({ farmId, plotId, source, limit });

    // Aggregate daily min, max, avg
    const temps = history.map(h => h.temperature).filter(t => !isNaN(t));
    const rhs = history.map(h => h.relativeHumidity).filter(h => !isNaN(h));
    const vpds = history.map(h => h.vpd).filter(v => !isNaN(v));

    const stats = {
      sampleCount: history.length,
      temperature: {
        min: temps.length ? Math.min(...temps) : null,
        max: temps.length ? Math.max(...temps) : null,
        avg: temps.length ? Number((temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1)) : null
      },
      humidity: {
        min: rhs.length ? Math.min(...rhs) : null,
        max: rhs.length ? Math.max(...rhs) : null,
        avg: rhs.length ? Number((rhs.reduce((a, b) => a + b, 0) / rhs.length).toFixed(1)) : null
      },
      vpd: {
        min: vpds.length ? Math.min(...vpds) : null,
        max: vpds.length ? Math.max(...vpds) : null,
        avg: vpds.length ? Number((vpds.reduce((a, b) => a + b, 0) / vpds.length).toFixed(2)) : null
      }
    };

    res.status(200).json({
      success: true,
      statistics: stats,
      history
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
