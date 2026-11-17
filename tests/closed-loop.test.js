/**
 * Closed-Loop Leaf-to-Valve Synergy Test Suite
 * Tests multi-sensor cross-validation (spectroscopy leaf scan + FDR soil moisture),
 * actionable smart recommendation generation, and approval/execution lifecycles.
 */

import { describe, it, expect } from './framework.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';

export function registerClosedLoopTests() {
  describe('Closed-Loop Synergy - Cross-Validation & Smart Recommendation Triggers', () => {
    it('triggers a PENDING recommendation when leaf stress is confirmed by soil deficit', () => {
      mockFirestore.resetToDefault();

      // Plot 2 initial state: Tomato with low soil moisture (13.8% topsoil, avg ~17.6%)
      // Target min is 20.0%, valve is CLOSED
      const initialPlot = mockFirestore.data.plots['plot-2'];
      expect(initialPlot.valve.state).toBe('CLOSED');

      const initialRecsCount = mockFirestore.getChannelSnapshot('actionRecommendations').length;

      // Submit leaf scan with severe water stress: LWI = 0.76 (< 0.88), Vitality = 48 (< 60)
      const scanId = mockFirestore.addLeafScan({
        plotId: 'plot-2',
        cropName: 'Heirloom Drip Tomatoes',
        vitalityScore: 48,
        leafWaterIndex: 0.76,
        nitrogenPrescriptionKg: 14.5,
        diseaseRisk: {
          detected: false,
          pathogen: 'None (Healthy Tissue)',
          confidence: 15,
          severity: 'Low'
        }
      });

      expect(typeof scanId).toBe('string');

      // Verify recommendation was generated
      const recs = mockFirestore.getChannelSnapshot('actionRecommendations');
      expect(recs.length).toBe(initialRecsCount + 1);

      const latestRec = recs[0]; // Newest first
      expect(latestRec.plotId).toBe('plot-2');
      expect(latestRec.status).toBe('PENDING');
      expect(latestRec.suggestedAction).toBe('OPEN');
      expect(latestRec.suggestedDurationMinutes).toBe(25);
      expect(latestRec.triggerReason).toContain('leaf stress');
      expect(latestRec.triggerReason).toContain('confirmed by');
    });

    it('suppresses false irrigation trigger when leaf is stressed but soil moisture is ADEQUATE/HIGH', () => {
      mockFirestore.resetToDefault();

      // Set Plot 1 soil moisture high (32% VWC, well above targetVwcMin 22%)
      mockFirestore.updatePlot('plot-1', {
        soilSensors: [
          { probeId: 'S1_10cm', depthCm: 10, vwc: 30.5, temperature: 22.0 },
          { probeId: 'S1_30cm', depthCm: 30, vwc: 33.0, temperature: 21.0 },
          { probeId: 'S1_50cm', depthCm: 50, vwc: 35.0, temperature: 20.0 }
        ]
      });

      const initialRecsCount = mockFirestore.getChannelSnapshot('actionRecommendations').length;

      // Submit a scan with low LWI (e.g. temporary midday transpiration or osmotic shock)
      mockFirestore.addLeafScan({
        plotId: 'plot-1',
        cropName: 'Bell Peppers',
        vitalityScore: 55,
        leafWaterIndex: 0.82
      });

      // Soil is 32.8% (> 22.0%), so irrigation must NOT trigger (prevents root suffocation)
      const recs = mockFirestore.getChannelSnapshot('actionRecommendations');
      expect(recs.length).toBe(initialRecsCount);
    });

    it('suppresses recommendation when target valve is already OPEN', () => {
      mockFirestore.resetToDefault();

      // Open Gate 2
      mockFirestore.updatePlot('plot-2', {
        valve: {
          id: 'G2',
          state: 'OPEN',
          flowRate: 520.0,
          pulseVoltage: 12,
          timerEnd: new Date(Date.now() + 20 * 60000).toISOString(),
          lastActuatedAt: new Date().toISOString()
        }
      });

      const initialRecsCount = mockFirestore.getChannelSnapshot('actionRecommendations').length;

      // Scan plot 2 again with stress
      mockFirestore.addLeafScan({
        plotId: 'plot-2',
        cropName: 'Heirloom Drip Tomatoes',
        vitalityScore: 45,
        leafWaterIndex: 0.72
      });

      // Valve is already OPEN, so no duplicate open recommendation
      const recs = mockFirestore.getChannelSnapshot('actionRecommendations');
      expect(recs.length).toBe(initialRecsCount);
    });
  });

  describe('Recommendation Lifecycle - Approval and Execution', () => {
    it('transitions recommendation from PENDING to APPROVED and EXECUTED', () => {
      mockFirestore.resetToDefault();
      const recs = mockFirestore.getChannelSnapshot('actionRecommendations');
      const rec = recs.find(r => r.status === 'PENDING');
      expect(rec).toBeTruthy();

      // Operator clicks APPROVE
      mockFirestore.updateActionRecommendation(rec.id, {
        status: 'APPROVED',
        approvedAt: new Date().toISOString()
      });

      let updatedRec = mockFirestore.getChannelSnapshot('actionRecommendations').find(r => r.id === rec.id);
      expect(updatedRec.status).toBe('APPROVED');

      // System actuates valve and updates to EXECUTED
      mockFirestore.updatePlot(rec.plotId, {
        valve: {
          id: rec.gateId,
          state: 'OPEN',
          flowRate: 500.0,
          pulseVoltage: 12,
          timerEnd: new Date(Date.now() + rec.suggestedDurationMinutes * 60000).toISOString(),
          lastActuatedAt: new Date().toISOString()
        }
      });

      mockFirestore.updateActionRecommendation(rec.id, {
        status: 'EXECUTED',
        executedAt: new Date().toISOString()
      });

      updatedRec = mockFirestore.getChannelSnapshot('actionRecommendations').find(r => r.id === rec.id);
      expect(updatedRec.status).toBe('EXECUTED');

      const plot = mockFirestore.getChannelSnapshot('plots').find(p => p.id === rec.plotId);
      expect(plot.valve.state).toBe('OPEN');
    });

    it('allows operator to DISMISS recommendation with justification', () => {
      mockFirestore.resetToDefault();
      const recs = mockFirestore.getChannelSnapshot('actionRecommendations');
      const rec = recs[0];

      mockFirestore.updateActionRecommendation(rec.id, {
        status: 'DISMISSED',
        dismissReason: 'Heavy rain forecasted within 2 hours. Irrigation deferred.',
        dismissedAt: new Date().toISOString()
      });

      const updatedRec = mockFirestore.getChannelSnapshot('actionRecommendations').find(r => r.id === rec.id);
      expect(updatedRec.status).toBe('DISMISSED');
      expect(updatedRec.dismissReason).toContain('Heavy rain forecasted');
    });
  });
}
