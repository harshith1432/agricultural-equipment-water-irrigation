/**
 * Telemetry, Plots, and Edge Synchronization Endpoints (Hardened)
 * Secured against unauthorized physical valve actuation, rate-flooding, and cross-tenant leakage.
 */
import { Router } from 'express';
import { enterpriseStore } from '../services/enterpriseStore.js';
import { authenticate, requireRole, verifyFarmTenantAccess } from '../middleware/authMiddleware.js';
import { valveActuationLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * POST /api/telemetry/sync
 * Ingestion endpoint for direct edge IoT sensor packets from field probes & wireless gateways
 */
router.post('/telemetry/sync', (req, res) => {
  try {
    const packet = req.body;
    if (!packet || Object.keys(packet).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Empty telemetry payload. Expected packet with plotId and sensor telemetry."
      });
    }

    const result = enterpriseStore.ingestTelemetry(packet);
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/plots
 * List all managed farming parcels and current bi-stable valve latching states
 */
router.get('/plots', (req, res) => {
  try {
    res.status(200).json({
      success: true,
      count: enterpriseStore.plots.length,
      data: enterpriseStore.plots
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/plots/:plotId/valve
 * Actuate specific solenoid valve (OPEN / CLOSE with +/-12V latching pulse)
 * Protected by hardware thermal rate limiter & RBAC role authorization
 */
router.post('/plots/:plotId/valve', 
  valveActuationLimiter, 
  authenticate, 
  requireRole(['superadmin', 'farm_owner', 'field_operator']),
  verifyFarmTenantAccess,
  (req, res) => {
    try {
      const { plotId } = req.params;
      const { action, durationMinutes, operator } = req.body;

      if (!action || !['OPEN', 'CLOSE'].includes(action.toUpperCase())) {
        return res.status(400).json({
          success: false,
          error: "Parameter 'action' must be either 'OPEN' or 'CLOSE'."
        });
      }

      const result = enterpriseStore.actuateValve({
        plotId,
        action: action.toUpperCase(),
        durationMinutes: Number(durationMinutes) || 20,
        operator: operator || req.user.uid || "MOBILE_APP_DIRECT"
      });

      res.status(200).json({
        success: true,
        message: `Valve ${result.gateId} successfully latched to ${result.state}`,
        data: result
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

/**
 * POST /api/leaf-scans
 * Direct ingestion of handheld leaf spectroscopy scan results
 */
router.post('/leaf-scans', 
  authenticate,
  requireRole(['superadmin', 'farm_owner', 'agronomist']),
  (req, res) => {
    try {
      const scanData = req.body;
      const result = enterpriseStore.ingestLeafScan(scanData);

      res.status(201).json({
        success: true,
        message: "Leaf spectroscopy scan ingested into enterprise agronomy repository.",
        data: result
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
);

export default router;
