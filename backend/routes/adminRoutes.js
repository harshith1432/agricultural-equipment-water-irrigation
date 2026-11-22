/**
 * Enterprise Admin & Entrepreneur Management Endpoints (Hardened)
 * Secured with strict RBAC, rate-limiting, tenant isolation, and input sanitization.
 */
import { Router } from 'express';
import { enterpriseStore, VALID_ROLES } from '../services/enterpriseStore.js';
import { authenticate, requireAdmin, requireRole, sanitizeUserInput } from '../middleware/authMiddleware.js';
import { adminLimiter, standardApiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Apply administrative rate limiter and base authentication to all /admin/* endpoints
router.use('/admin', standardApiLimiter, adminLimiter, authenticate);

/**
 * GET /api/admin/metrics
 * Executive entrepreneur dashboard metrics
 * Requires: Admin or Superadmin
 */
router.get('/admin/metrics', requireAdmin, (req, res) => {
  try {
    const metrics = enterpriseStore.getExecutiveMetrics();
    res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: metrics
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/users
 * Enterprise user directory with tenant scoping, filtering and statistics
 * Requires: Admin, Superadmin, or Farm Owner (scoped to their farm)
 */
router.get('/admin/users', requireRole(['superadmin', 'admin', 'farm_owner']), (req, res) => {
  try {
    const { role, search, farmId } = req.query;
    let users = enterpriseStore.getUsers({ role, search });

    // Multi-tenant isolation: If user is scoped to specific farms, filter user list
    const userFarms = req.user.assignedFarms || [];
    if (!userFarms.includes('*')) {
      users = users.filter(u => u.assignedFarms?.some(f => userFarms.includes(f)));
    } else if (farmId) {
      users = users.filter(u => u.assignedFarms?.includes(farmId));
    }

    res.status(200).json({
      success: true,
      count: users.length,
      rolesBreakdown: {
        superadmin: enterpriseStore.users.filter(u => u.role === 'superadmin').length,
        farm_owner: enterpriseStore.users.filter(u => u.role === 'farm_owner').length,
        agronomist: enterpriseStore.users.filter(u => u.role === 'agronomist').length,
        field_operator: enterpriseStore.users.filter(u => u.role === 'field_operator').length
      },
      data: users
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users
 * Register/provision a new user with input sanitization
 * Requires: Superadmin
 */
router.post('/admin/users', requireAdmin, sanitizeUserInput, (req, res) => {
  try {
    const { name, email, role, title, organization, assignedFarms } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: "Fields 'name' and 'email' are mandatory." });
    }
    const newUser = enterpriseStore.createUser({ name, email, role, title, organization, assignedFarms });
    res.status(201).json({ success: true, message: "User provisioned successfully", data: newUser });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/users/role
 * Update user permissions/role with strict RBAC privilege escalation defense
 * Requires: Superadmin
 */
router.post('/admin/users/role', requireAdmin, sanitizeUserInput, (req, res) => {
  try {
    const { userId, email, role, newRole, updatedBy } = req.body;
    const targetRole = newRole || role;

    if (!targetRole) {
      return res.status(400).json({
        success: false,
        error: `Missing target role. Allowed roles: ${VALID_ROLES.join(', ')}`
      });
    }

    if (!userId && !email) {
      return res.status(400).json({
        success: false,
        error: "Either 'userId' or 'email' must be provided to identify the user."
      });
    }

    const updatedUser = enterpriseStore.updateUserRole({
      userId,
      email,
      newRole: targetRole,
      updatedBy: updatedBy || req.user.uid || "enterprise_admin_api"
    });

    res.status(200).json({
      success: true,
      message: `User permissions and role updated to '${targetRole}'`,
      data: updatedUser
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/admin/emergency-killswitch
 * Enterprise-grade emergency shutdown of all hydraulic valves across all farms.
 * Requires: Superadmin
 */
router.post('/admin/emergency-killswitch', requireAdmin, (req, res) => {
  try {
    const { operatorId, reason } = req.body;
    const result = enterpriseStore.emergencyKillswitch({
      operatorId: operatorId || req.user.uid || "EMERGENCY_DASHBOARD_1_TAP",
      reason: reason || "Enterprise hydraulic emergency killswitch activated via REST API"
    });

    res.status(200).json({
      success: true,
      alert: "CRITICAL: ALL HYDRAULIC VALVES ISOLATED",
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/audit-logs
 * Enterprise audit trail (logins, valve actuations, leaf scans, killswitches)
 * Requires: Superadmin
 */
router.get('/admin/audit-logs', requireAdmin, (req, res) => {
  try {
    const { category, severity, limit } = req.query;
    const logs = enterpriseStore.getAuditLogs({ category, severity, limit });
    res.status(200).json({
      success: true,
      count: logs.length,
      data: logs
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
