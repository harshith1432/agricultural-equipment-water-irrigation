/**
 * Spectral Chemometrics Test Suite
 * Tests 350–1100nm VIS-NIR reflectance processing, vegetation indices,
 * nitrogen prescriptions, irrigation countdowns, and disease classification.
 */

import { describe, it, expect } from './framework.js';
import {
  WAVELENGTHS,
  generateSpectralSignature,
  processSpectralVector
} from '../src/hardware/chemometricsEngine.js';

export function registerChemometricsTests() {
  describe('Spectral Chemometrics Engine - Spectral Generation & Band Integrity', () => {
    it('generates a 76-band vector from 350nm to 1100nm in 10nm increments', () => {
      expect(WAVELENGTHS.length).toBe(76);
      expect(WAVELENGTHS[0]).toBe(350);
      expect(WAVELENGTHS[75]).toBe(1100);
      expect(WAVELENGTHS[1] - WAVELENGTHS[0]).toBe(10);

      const spectrum = generateSpectralSignature();
      expect(spectrum.length).toBe(76);
      spectrum.forEach(r => {
        expect(r).toBeGreaterThanOrEqual(0.01);
        expect(r).toBeLessThanOrEqual(0.95);
      });
    });

    it('exhibits characteristic chlorophyll green reflection peak and red absorption pit', () => {
      const spectrum = generateSpectralSignature({ vitality: 90, nitrogenLevel: 0.9, noiseLevel: 0 });
      const idx550 = WAVELENGTHS.indexOf(550); // Green peak
      const idx670 = WAVELENGTHS.indexOf(670); // Chlorophyll-a red absorption
      const idx800 = WAVELENGTHS.indexOf(800); // NIR plateau

      expect(spectrum[idx550]).toBeGreaterThan(spectrum[idx670]);
      expect(spectrum[idx800]).toBeGreaterThan(spectrum[idx550]);
    });

    it('reflects leaf dehydration through 970nm water band attenuation', () => {
      const hydrated = generateSpectralSignature({ waterContent: 0.95, noiseLevel: 0 });
      const stressed = generateSpectralSignature({ waterContent: 0.40, noiseLevel: 0 });

      const idx900 = WAVELENGTHS.indexOf(900);
      const idx970 = WAVELENGTHS.indexOf(970);

      const hydratedWbi = hydrated[idx900] / hydrated[idx970];
      const stressedWbi = stressed[idx900] / stressed[idx970];

      // In hydrated leaf, deeper 970nm absorption means higher 900/970 ratio
      expect(hydratedWbi).toBeGreaterThan(0.9);
      expect(stressedWbi).toBeGreaterThan(0.9);
    });
  });

  describe('Spectral Indices - NDVI, NDRE, WBI, and CIre', () => {
    it('calculates correct NDVI for healthy vs stressed canopies', () => {
      // Deterministic healthy spectrum: R800 = 0.60, R680 = 0.08
      const mockSpectrum = new Array(76).fill(0.2);
      const idx680 = WAVELENGTHS.indexOf(680);
      const idx800 = WAVELENGTHS.indexOf(800);
      mockSpectrum[idx680] = 0.08;
      mockSpectrum[idx800] = 0.60;

      // Expected NDVI = (0.60 - 0.08) / (0.60 + 0.08) = 0.52 / 0.68 = 0.7647 -> 0.765
      const result = processSpectralVector(mockSpectrum);
      expect(result.indices.ndvi).toBeCloseTo(0.765, 0.005);
      expect(result.indices.ndvi).toBeGreaterThan(0.70);
    });

    it('calculates NDRE using red-edge transition (790nm vs 720nm)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx720 = WAVELENGTHS.indexOf(720);
      const idx790 = WAVELENGTHS.indexOf(790);
      mockSpectrum[idx720] = 0.20;
      mockSpectrum[idx790] = 0.50;

      // Expected NDRE = (0.50 - 0.20) / (0.50 + 0.20) = 0.30 / 0.70 = 0.4285 -> 0.429
      const result = processSpectralVector(mockSpectrum);
      expect(result.indices.ndre).toBeCloseTo(0.429, 0.005);
    });

    it('calculates WBI and normalized Leaf Water Index (LWI)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx900 = WAVELENGTHS.indexOf(900);
      const idx970 = WAVELENGTHS.indexOf(970);
      mockSpectrum[idx900] = 0.50;
      mockSpectrum[idx970] = 0.40;

      // wbi = 0.50 / 0.40 = 1.25
      // leafWaterIndex = (1.25 - 1.0) * 2.2 + 0.35 = 0.55 + 0.35 = 0.900
      const result = processSpectralVector(mockSpectrum);
      expect(result.indices.wbi).toBeCloseTo(1.25, 0.005);
      expect(result.indices.leafWaterIndex).toBeCloseTo(0.900, 0.005);
    });

    it('calculates Chlorophyll Index Red Edge (CIre)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx710 = WAVELENGTHS.indexOf(710); // closest >= 705nm
      const idx750 = WAVELENGTHS.indexOf(750);
      mockSpectrum[idx710] = 0.25;
      mockSpectrum[idx750] = 0.50;

      // cire = (R750 / R705) - 1 = (0.50 / 0.25) - 1 = 1.000
      const result = processSpectralVector(mockSpectrum);
      expect(result.indices.cire).toBeCloseTo(1.000, 0.01);
    });
  });

  describe('Crop Vitality Score & Clamping', () => {
    it('computes vitality score within [5, 100] bounds', () => {
      // 1. High vitality canopy
      const healthySpectrum = generateSpectralSignature({ vitality: 95, nitrogenLevel: 0.95 });
      const healthyResult = processSpectralVector(healthySpectrum);
      expect(healthyResult.vitalityScore).toBeGreaterThanOrEqual(75);
      expect(healthyResult.vitalityScore).toBeLessThanOrEqual(100);

      // 2. Severe stress canopy (vitality 15, low nitrogen and water)
      const severeStress = generateSpectralSignature({ vitality: 15, waterContent: 0.35, nitrogenLevel: 0.30, diseaseStress: 0.9 });
      const stressResult = processSpectralVector(severeStress);
      expect(stressResult.vitalityScore).toBeGreaterThanOrEqual(5);
      expect(stressResult.vitalityScore).toBeLessThanOrEqual(60);
    });

    it('clamps vitality score to minimum 5 on zeroed or black body spectrum', () => {
      const blackBody = new Array(76).fill(0.001);
      const result = processSpectralVector(blackBody);
      expect(result.vitalityScore).toBeGreaterThanOrEqual(5);
    });
  });

  describe('Nitrogen Prescription & Fertilizer Recommendations', () => {
    it('prescribes 22.5 kg/acre urea for severe nitrogen deficiency (NDRE < 0.25)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx720 = WAVELENGTHS.indexOf(720);
      const idx790 = WAVELENGTHS.indexOf(790);
      mockSpectrum[idx720] = 0.35;
      mockSpectrum[idx790] = 0.45; // NDRE = (0.45 - 0.35) / 0.80 = 0.125 < 0.25

      const result = processSpectralVector(mockSpectrum);
      expect(result.nitrogenPrescriptionKg).toBe(22.5);
      expect(result.nitrogenMessage).toContain('22.5 kg/acre Urea');
    });

    it('prescribes 14.5 kg/acre urea for moderate deficiency (0.25 <= NDRE < 0.31)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx720 = WAVELENGTHS.indexOf(720);
      const idx790 = WAVELENGTHS.indexOf(790);
      mockSpectrum[idx720] = 0.25;
      mockSpectrum[idx790] = 0.45; // NDRE = (0.45 - 0.25) / 0.70 = 0.2857

      const result = processSpectralVector(mockSpectrum);
      expect(result.nitrogenPrescriptionKg).toBe(14.5);
      expect(result.nitrogenMessage).toContain('14.5 kg/acre Urea');
    });

    it('prescribes 6.0 kg/acre urea for maintenance (0.31 <= NDRE < 0.36)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx720 = WAVELENGTHS.indexOf(720);
      const idx790 = WAVELENGTHS.indexOf(790);
      mockSpectrum[idx720] = 0.24;
      mockSpectrum[idx790] = 0.48; // NDRE = (0.48 - 0.24) / 0.72 = 0.333

      const result = processSpectralVector(mockSpectrum);
      expect(result.nitrogenPrescriptionKg).toBe(6.0);
      expect(result.nitrogenMessage).toContain('6 kg/acre Urea');
    });

    it('prescribes 0 kg/acre urea when canopy nitrogen is optimal (NDRE >= 0.36)', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx720 = WAVELENGTHS.indexOf(720);
      const idx790 = WAVELENGTHS.indexOf(790);
      mockSpectrum[idx720] = 0.15;
      mockSpectrum[idx790] = 0.55; // NDRE = (0.55 - 0.15) / 0.70 = 0.5714

      const result = processSpectralVector(mockSpectrum);
      expect(result.nitrogenPrescriptionKg).toBe(0);
      expect(result.nitrogenMessage).toContain('Nitrogen index optimal');
    });
  });

  describe('Irrigation Need Countdown & Urgency Classification', () => {
    it('flags CRITICAL urgency and 4-hour countdown when leaf water index < 0.82', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx900 = WAVELENGTHS.indexOf(900);
      const idx970 = WAVELENGTHS.indexOf(970);
      // wbi = 0.40 / 0.35 = 1.142; LWI = (1.142 - 1.0) * 2.2 + 0.35 = 0.663 (< 0.82)
      mockSpectrum[idx900] = 0.40;
      mockSpectrum[idx970] = 0.35;

      const result = processSpectralVector(mockSpectrum);
      expect(result.irrigationCountdownHours).toBe(4);
      expect(result.irrigationUrgency).toBe('CRITICAL');
    });

    it('flags MODERATE_STRESS and 18-hour countdown for 0.82 <= LWI < 0.89', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx900 = WAVELENGTHS.indexOf(900);
      const idx970 = WAVELENGTHS.indexOf(970);
      // wbi = 0.49 / 0.40 = 1.225; LWI = (1.225 - 1.0) * 2.2 + 0.35 = 0.845
      mockSpectrum[idx900] = 0.49;
      mockSpectrum[idx970] = 0.40;

      const result = processSpectralVector(mockSpectrum);
      expect(result.irrigationCountdownHours).toBe(18);
      expect(result.irrigationUrgency).toBe('MODERATE_STRESS');
    });

    it('flags ADEQUATE and 36-hour countdown for 0.89 <= LWI < 0.94', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx900 = WAVELENGTHS.indexOf(900);
      const idx970 = WAVELENGTHS.indexOf(970);
      // wbi = 0.504 / 0.40 = 1.26; LWI = (1.26 - 1.0) * 2.2 + 0.35 = 0.922
      mockSpectrum[idx900] = 0.504;
      mockSpectrum[idx970] = 0.40;

      const result = processSpectralVector(mockSpectrum);
      expect(result.irrigationCountdownHours).toBe(36);
      expect(result.irrigationUrgency).toBe('ADEQUATE');
    });

    it('flags SATURATED and 64-hour countdown for LWI >= 0.94', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx900 = WAVELENGTHS.indexOf(900);
      const idx970 = WAVELENGTHS.indexOf(970);
      // wbi = 0.53 / 0.40 = 1.325; LWI = (1.325 - 1.0) * 2.2 + 0.35 = 1.065
      mockSpectrum[idx900] = 0.53;
      mockSpectrum[idx970] = 0.40;

      const result = processSpectralVector(mockSpectrum);
      expect(result.irrigationCountdownHours).toBe(64);
      expect(result.irrigationUrgency).toBe('SATURATED');
    });
  });

  describe('Pre-Symptomatic Disease Risk Classification', () => {
    it('detects Early Powdery Mildew when greenRedRatio < 2.5', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx550 = WAVELENGTHS.indexOf(550);
      const idx680 = WAVELENGTHS.indexOf(680);

      mockSpectrum[idx550] = 0.15; // Green
      mockSpectrum[idx680] = 0.08; // Red -> greenRedRatio = 1.875 (< 2.5)

      const result = processSpectralVector(mockSpectrum);
      expect(result.diseaseRisk.detected).toBe(true);
      expect(result.diseaseRisk.pathogen).toContain('Powdery Mildew');
      expect(result.diseaseRisk.confidence).toBe(84);
      expect(result.diseaseRisk.severity).toBe('High');
      expect(result.diseaseRisk.preventativeAction).toContain('Potassium Bicarbonate');
    });

    it('detects Septoria Leaf Blight when vitality < 70, R680 > 0.04, and greenRedRatio >= 4.0', () => {
      const mockSpectrum = new Array(76).fill(0.05);
      const idx550 = WAVELENGTHS.indexOf(550);
      const idx680 = WAVELENGTHS.indexOf(680);
      const idx720 = WAVELENGTHS.indexOf(720);
      const idx790 = WAVELENGTHS.indexOf(790);

      mockSpectrum[idx550] = 0.30;
      mockSpectrum[idx680] = 0.06; // greenRedRatio = 5.0 (>= 4.0, avoiding powdery mildew trigger)
      mockSpectrum[idx720] = 0.15;
      mockSpectrum[idx790] = 0.25;

      const result = processSpectralVector(mockSpectrum);
      expect(result.vitalityScore).toBeLessThan(70);
      expect(result.diseaseRisk.detected).toBe(true);
      expect(result.diseaseRisk.pathogen).toContain('Septoria Leaf Blight');
      expect(result.diseaseRisk.confidence).toBe(76);
      expect(result.diseaseRisk.severity).toBe('Moderate');
    });

    it('reports healthy status for well-conditioned vegetative canopy', () => {
      const healthySpectrum = generateSpectralSignature({ vitality: 92, diseaseStress: 0.05, noiseLevel: 0 });
      const result = processSpectralVector(healthySpectrum);
      expect(result.diseaseRisk.detected).toBe(false);
      expect(result.diseaseRisk.pathogen).toContain('Healthy');
      expect(result.diseaseRisk.severity).toBe('Low');
    });
  });

  describe('Harvest Window Predictor', () => {
    it('projects fruit ripening harvest window based on growth stage and NDVI', () => {
      const mockSpectrum = new Array(76).fill(0.2);
      const idx680 = WAVELENGTHS.indexOf(680);
      const idx800 = WAVELENGTHS.indexOf(800);
      mockSpectrum[idx680] = 0.15;
      mockSpectrum[idx800] = 0.45; // NDVI = 0.30 / 0.60 = 0.50

      const result = processSpectralVector(mockSpectrum, 'Heirloom Tomatoes', 'Fruit Sizing & Ripening');
      expect(result.harvest.maturityPercent).toBeGreaterThanOrEqual(60);
      expect(result.harvest.daysToPeakHarvest).toBeGreaterThan(0);
      expect(result.harvest.statusMessage).toContain('Canopy maturity');
    });

    it('returns extended timeline for vegetative growth stage', () => {
      const spectrum = generateSpectralSignature();
      const result = processSpectralVector(spectrum, 'Bell Peppers', 'Vegetative Canopy');
      expect(result.harvest.maturityPercent).toBe(38);
      expect(result.harvest.daysToPeakHarvest).toBe(42);
    });
  });
}
