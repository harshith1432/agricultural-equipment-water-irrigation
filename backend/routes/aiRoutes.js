/**
 * Modular AI Intelligence & Analytics Route Handlers
 * Endpoints:
 *   - GET  /api/analytics/farm-overview (Executive farm KPIs & hydraulic summary)
 *   - GET  /api/analytics/field-comparison (Zone-by-zone multi-sensor comparison)
 *   - POST /api/ai/analyze (Cross-correlate Soil + Spectroscopy + Weather + Flow)
 *   - GET  /api/ai/recommendations (Closed-loop actionable farmer advice)
 */

import { Router } from 'express';
import { aiIntelligenceEngine } from '../services/aiIntelligenceEngine.js';

const router = Router();

// ===========================================================================
// 1. EXECUTIVE ANALYTICS
// ===========================================================================

/**
 * GET /api/analytics/farm-overview
 * Executive entrepreneur & farm owner macro-overview
 */
router.get('/analytics/farm-overview', (req, res) => {
  try {
    const farmId = req.query.farmId || req.headers['x-farm-id'] || "farm-valley-1";
    const overview = aiIntelligenceEngine.getFarmOverview(farmId);

    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/analytics/field-comparison
 * Comparative analysis across all farming parcels (soil, canopy, water, state)
 */
router.get('/analytics/field-comparison', (req, res) => {
  try {
    const farmId = req.query.farmId || req.headers['x-farm-id'] || "farm-valley-1";
    const comparison = aiIntelligenceEngine.getFieldComparison(farmId);

    res.status(200).json({
      success: true,
      data: comparison
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ===========================================================================
// 2. AI DATA FUSION & CLOSED-LOOP ADVICE
// ===========================================================================

/**
 * POST /api/ai/analyze
 * Cross-correlates multi-modal data:
 *   Soil NPK/Moisture + Spectroscopy Vitality/LWI + Ambient Temp/Humidity + Irrigation Flow
 */
router.post('/ai/analyze', async (req, res) => {
  try {
    const params = req.body || {};
    const prediction = await aiIntelligenceEngine.analyzeField(params);

    res.status(200).json({
      success: true,
      message: "Multi-sensor cross-correlation completed successfully.",
      data: prediction
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/ai/recommendations
 * Closed-loop actionable farmer advice with calibrated confidence & model version
 */
router.get('/ai/recommendations', async (req, res) => {
  try {
    const farmId = req.query.farmId || req.headers['x-farm-id'] || "farm-valley-1";
    const recommendations = await aiIntelligenceEngine.getRecommendations({ farmId });

    res.status(200).json({
      success: true,
      farmId,
      modelVersion: aiIntelligenceEngine.modelVersion,
      count: recommendations.length,
      timestamp: new Date().toISOString(),
      recommendations
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
