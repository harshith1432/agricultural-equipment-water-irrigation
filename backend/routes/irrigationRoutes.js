/**
 * Modular Irrigation Route Handlers
 * Endpoints:
 *   - GET    /api/irrigation/valves (dynamic valve directory)
 *   - POST   /api/irrigation/valves (add valve configuration)
 *   - GET    /api/irrigation/valves/:id
 *   - PATCH  /api/irrigation/valves/:id
 *   - DELETE /api/irrigation/valves/:id
 *   - POST   /api/irrigation/valves/:id/on  (with controller status SENT/ACKNOWLEDGED/ACTIVE/FAILED)
 *   - POST   /api/irrigation/valves/:id/off (with controller status SENT/ACKNOWLEDGED/ACTIVE/FAILED)
 *   - GET    /api/irrigation/schedules
 *   - POST   /api/irrigation/schedules
 *   - PATCH  /api/irrigation/schedules/:id
 *   - DELETE /api/irrigation/schedules/:id
 *   - GET    /api/irrigation/sessions
 *   - POST   /api/irrigation/sessions
 *   - GET    /api/irrigation/flow-readings
 *   - POST   /api/irrigation/emergency-stop (1-tap killswitch)
 */

import { Router } from 'express';
import { centralStorage } from '../services/centralStorage.js';
import { enterpriseStore } from '../services/enterpriseStore.js';

const router = Router();

// ===========================================================================
// 1. VALVES DIRECTORY & MANAGEMENT
// ===========================================================================

/**
 * GET /api/irrigation/valves
 * Dynamic list of all physical latching solenoid valves
 */
router.get('/irrigation/valves', (req, res) => {
  try {
    const { farmId, plotId, state } = req.query;
    const valves = centralStorage.getValves({ farmId, plotId, state });
    res.status(200).json({
      success: true,
      count: valves.length,
      timestamp: new Date().toISOString(),
      data: valves
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/irrigation/valves
 * Add a new dynamic valve configuration
 */
router.post('/irrigation/valves', (req, res) => {
  try {
    const valveData = req.body;
    if (!valveData || !valveData.name) {
      return res.status(400).json({
        success: false,
        error: "Missing required valve parameters (name required)."
      });
    }

    const created = centralStorage.addValve(valveData);
    res.status(201).json({
      success: true,
      message: `Valve '${created.name}' (${created.code}) successfully provisioned.`,
      data: created
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/irrigation/valves/:id
 * Fetch specific valve by ID or Code
 */
router.get('/irrigation/valves/:id', (req, res) => {
  try {
    const { id } = req.params;
    const valve = centralStorage.getValveById(id);
    if (!valve) {
      return res.status(404).json({
        success: false,
        error: `Valve not found with ID '${id}'.`
      });
    }

    res.status(200).json({
      success: true,
      data: valve
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/irrigation/valves/:id
 * Update valve configuration
 */
router.patch('/irrigation/valves/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updated = centralStorage.updateValve(id, updates);
    if (!updated) {
      return res.status(404).json({
        success: false,
        error: `Valve not found with ID '${id}'.`
      });
    }

    res.status(200).json({
      success: true,
      message: `Valve ${id} updated successfully.`,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/irrigation/valves/:id
 * Remove valve configuration
 */
router.delete('/irrigation/valves/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = centralStorage.deleteValve(id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Valve not found with ID '${id}'.`
      });
    }

    res.status(200).json({
      success: true,
      message: `Valve ${id} deleted successfully.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 2. VALVE ACTUATION & CONTROLLER ACKNOWLEDGMENT (ON / OFF)
// ===========================================================================

/**
 * POST /api/irrigation/valves/:id/on
 * Actuates bi-stable solenoid to OPEN with +12V pulse
 * Controller acknowledgment status lifecycle: SENT -> ACKNOWLEDGED -> ACTIVE
 */
router.post('/irrigation/valves/:id/on', (req, res) => {
  try {
    const { id } = req.params;
    const { durationMinutes, operator, triggeredBy } = req.body || {};

    const result = centralStorage.actuateValve(id, 'OPEN', {
      durationMinutes: Number(durationMinutes) || 20,
      operator: operator || req.headers['x-operator-id'] || 'FIELD_APP',
      triggeredBy: triggeredBy || 'MANUAL'
    });

    // Sync with enterpriseStore plots if matched
    if (enterpriseStore && enterpriseStore.plots) {
      const plot = enterpriseStore.plots.find(p => p.id === result.valve.plotId || p.valve?.id === result.valve.code);
      if (plot) {
        plot.valve.state = 'OPEN';
        plot.valve.pulseVoltage = 12;
        plot.valve.timerEnd = result.valve.timerEnd;
        plot.valve.lastActuatedAt = result.valve.lastActuatedAt;
      }
    }

    res.status(200).json({
      success: true,
      message: `Valve ${result.valve.code} (${result.valve.name}) latched to OPEN (+12V pulse).`,
      controllerStatus: result.controllerAcknowledgment.status, // SENT, ACKNOWLEDGED, ACTIVE, FAILED
      acknowledgment: result.controllerAcknowledgment,
      data: result.valve,
      session: result.session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      controllerStatus: "FAILED",
      error: error.message
    });
  }
});

/**
 * POST /api/irrigation/valves/:id/off
 * Actuates bi-stable solenoid to CLOSED with -12V reverse pulse
 * Controller acknowledgment status: ACKNOWLEDGED
 */
router.post('/irrigation/valves/:id/off', (req, res) => {
  try {
    const { id } = req.params;
    const { operator } = req.body || {};

    const result = centralStorage.actuateValve(id, 'CLOSE', {
      operator: operator || req.headers['x-operator-id'] || 'FIELD_APP'
    });

    // Sync with enterpriseStore plots if matched
    if (enterpriseStore && enterpriseStore.plots) {
      const plot = enterpriseStore.plots.find(p => p.id === result.valve.plotId || p.valve?.id === result.valve.code);
      if (plot) {
        plot.valve.state = 'CLOSED';
        plot.valve.pulseVoltage = -12;
        plot.valve.timerEnd = null;
        plot.valve.lastActuatedAt = result.valve.lastActuatedAt;
      }
    }

    res.status(200).json({
      success: true,
      message: `Valve ${result.valve.code} latched to CLOSED (-12V reverse pulse).`,
      controllerStatus: result.controllerAcknowledgment.status,
      acknowledgment: result.controllerAcknowledgment,
      data: result.valve,
      session: result.session
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      controllerStatus: "FAILED",
      error: error.message
    });
  }
});

// ===========================================================================
// 3. MULTI-SLOT IRRIGATION SCHEDULES
// ===========================================================================

/**
 * GET /api/irrigation/schedules
 */
router.get('/irrigation/schedules', (req, res) => {
  try {
    const { farmId, valveId, enabled } = req.query;
    const schedules = centralStorage.getSchedules({ farmId, valveId, enabled });
    res.status(200).json({
      success: true,
      count: schedules.length,
      data: schedules
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/irrigation/schedules
 * Add multi-slot schedule per valve
 */
router.post('/irrigation/schedules', (req, res) => {
  try {
    const schedData = req.body;
    if (!schedData || !schedData.valveId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter 'valveId'."
      });
    }

    const created = centralStorage.addSchedule(schedData);
    res.status(201).json({
      success: true,
      message: `Irrigation schedule '${created.name}' created with ${created.slots.length} slots.`,
      data: created
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * PATCH /api/irrigation/schedules/:id
 */
router.patch('/irrigation/schedules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updated = centralStorage.updateSchedule(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: `Schedule not found: ${id}` });
    }

    res.status(200).json({
      success: true,
      message: `Schedule ${id} updated.`,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/irrigation/schedules/:id
 */
router.delete('/irrigation/schedules/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = centralStorage.deleteSchedule(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: `Schedule not found: ${id}` });
    }

    res.status(200).json({
      success: true,
      message: `Schedule ${id} deleted.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 4. IRRIGATION SESSIONS & WATER ACCOUNTING
// ===========================================================================

/**
 * GET /api/irrigation/sessions
 */
router.get('/irrigation/sessions', (req, res) => {
  try {
    const { valveId, plotId, farmId, status } = req.query;
    const sessions = centralStorage.getSessions({ valveId, plotId, farmId, status });

    const totalDelivered = sessions.reduce((acc, s) => acc + (s.deliveredVolumeLiters || 0), 0);

    res.status(200).json({
      success: true,
      count: sessions.length,
      waterAccounting: {
        totalDeliveredLiters: Number(totalDelivered.toFixed(1)),
        unit: "Liters"
      },
      data: sessions
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/irrigation/sessions
 * Record or manually start an irrigation session
 */
router.post('/irrigation/sessions', (req, res) => {
  try {
    const sessionData = req.body;
    if (!sessionData || !sessionData.valveId) {
      return res.status(400).json({
        success: false,
        error: "Missing required parameter 'valveId'."
      });
    }

    const session = centralStorage.createSession(sessionData);
    res.status(201).json({
      success: true,
      message: "Irrigation session ledger initialized.",
      data: session
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 5. WATER FLOW TELEMETRY READINGS
// ===========================================================================

/**
 * GET /api/irrigation/flow-readings
 * Live and historical water flow meter telemetry
 */
router.get('/irrigation/flow-readings', (req, res) => {
  try {
    const { valveId, plotId, farmId, since, limit } = req.query;
    const readings = centralStorage.getFlowReadings({ valveId, plotId, farmId, since, limit });

    res.status(200).json({
      success: true,
      count: readings.length,
      timestamp: new Date().toISOString(),
      data: readings
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 6. 1-TAP EMERGENCY STOP KILLSWITCH
// ===========================================================================

/**
 * POST /api/irrigation/emergency-stop
 * 1-Tap Killswitch: latches ALL valves CLOSED (-12V) across all zones immediately
 */
router.post('/irrigation/emergency-stop', (req, res) => {
  try {
    const { operatorId, reason } = req.body || {};
    const op = operatorId || req.headers['x-operator-id'] || "MOBILE_KILLSWITCH_DIRECT";
    const rsn = reason || "1-Tap Hydraulic Emergency Stop";

    const result = centralStorage.emergencyStop(op, rsn);

    // Also sync enterpriseStore if present
    if (enterpriseStore && enterpriseStore.plots) {
      enterpriseStore.plots.forEach(p => {
        p.valve.state = 'CLOSED';
        p.valve.pulseVoltage = -12;
        p.valve.timerEnd = null;
      });
      enterpriseStore.lastKillswitchTimestamp = result.timestamp;
    }

    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
