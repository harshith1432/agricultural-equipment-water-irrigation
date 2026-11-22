/**
 * Platform / Website Admin Dashboard Routes
 * Real Firestore-backed numbers for the public marketing website's admin
 * panel (total downloads, registered users, farmers, scan volume/reports)
 * plus a public, rate-limited download-click counter.
 */
import { Router } from 'express';
import { platformAnalytics } from '../services/platformAnalytics.js';
import { authenticate, requireAdmin } from '../middleware/authMiddleware.js';
import { standardApiLimiter } from '../middleware/rateLimiter.js';

const router = Router();

/**
 * GET /api/admin/platform-overview
 * Real counts: total downloads, registered users, farmers, scans, app events.
 * Requires: Admin or Superadmin (real Firebase ID token or enterprise secret).
 */
router.get('/admin/platform-overview', standardApiLimiter, authenticate, requireAdmin, async (req, res) => {
  try {
    const overview = await platformAnalytics.getOverview();
    res.status(200).json({ success: true, timestamp: new Date().toISOString(), data: overview });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/admin/scan-reports
 * Paginated, real spectral scan records for the admin dashboard's report
 * table. ?format=csv returns a downloadable CSV instead of JSON.
 */
router.get('/admin/scan-reports', standardApiLimiter, authenticate, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 1000);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const { totalScans, bySource, scans } = await platformAnalytics.getScanStats({ limit, offset });

    if (req.query.format === 'csv') {
      const columns = ['scanId', 'farmId', 'plotId', 'plantNumber', 'plantName', 'timestamp', 'syncedAt', 'vitalityScore', 'ndvi', 'ndre'];
      const rows = scans.map(s => columns.map(c => {
        if (c === 'scanId') return s.scanId || s.id || '';
        if (c === 'vitalityScore') return s.chemometrics?.vitalityScore ?? '';
        if (c === 'ndvi') return s.chemometrics?.indices?.ndvi ?? s.chemometrics?.ndvi ?? '';
        if (c === 'ndre') return s.chemometrics?.indices?.ndre ?? s.chemometrics?.ndre ?? '';
        const v = s[c] ?? '';
        return typeof v === 'string' ? `"${v.replace(/"/g, '""')}"` : v;
      }).join(','));
      const csv = [columns.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="agrispectra_scan_reports_${Date.now()}.csv"`);
      return res.status(200).send(csv);
    }

    res.status(200).json({ success: true, totalScans, bySource, count: scans.length, offset, limit, data: scans });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/public/track-download
 * Public (no auth) but rate-limited: increments the real APK download
 * counter shown on the admin dashboard when a visitor clicks "Download APK"
 * on the marketing website.
 */
router.post('/public/track-download', standardApiLimiter, async (req, res) => {
  try {
    const total = await platformAnalytics.recordDownloadClick({
      platform: req.body?.platform || 'android',
      userAgent: req.headers['user-agent'] || null
    });
    res.status(200).json({ success: true, totalDownloads: total });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
