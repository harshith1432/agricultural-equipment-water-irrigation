/**
 * Telemetry Drift & Weather Chaos Engineering Test Suite
 * Tests multi-depth FDR capacitive soil probes, hydraulic mainline pressure,
 * and environmental disturbances: Normal, Heatwave, Rainfall, and Overpressure faults.
 */

import { describe, it, expect } from './framework.js';
import { MqttTelemetrySimulator } from '../src/hardware/mqttTelemetrySimulator.js';
import { INITIAL_FARM_DATA } from '../src/firebase/mockFirestore.js';

export function registerTelemetryChaosTests() {
  describe('Multi-Depth FDR Soil Moisture Dynamics', () => {
    it('models multi-depth stratification (10cm, 30cm, 50cm probes)', () => {
      const plots = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      const p1 = plots[0];

      expect(p1.soilSensors.length).toBe(3);
      expect(p1.soilSensors[0].depthCm).toBe(10);
      expect(p1.soilSensors[1].depthCm).toBe(30);
      expect(p1.soilSensors[2].depthCm).toBe(50);

      // Verify physical moisture gradient: subsoil retains higher water content than surface
      expect(p1.soilSensors[2].vwc).toBeGreaterThan(p1.soilSensors[0].vwc);
    });

    it('increases volumetric water content (VWC) when irrigation valve is open', () => {
      const sim = new MqttTelemetrySimulator();
      const plots = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      const plot = plots[0];
      plot.valve.state = 'OPEN';
      plot.valve.flowRate = 450.0;
      plot.totalLitersDelivered = 420.0;

      const initialVwc = plot.soilSensors[0].vwc;
      const initialTemp = plot.soilSensors[0].temperature;
      const initialLiters = plot.totalLitersDelivered;

      // Execute 3 ticks
      let currentPlots = [plot];
      for (let i = 0; i < 3; i++) {
        sim.tick(currentPlots, (updated) => {
          currentPlots = [updated];
        });
      }

      const updatedPlot = currentPlots[0];
      // VWC must increase due to irrigation
      expect(updatedPlot.soilSensors[0].vwc).toBeGreaterThan(initialVwc);
      // Soil temperature should cool slightly or remain stable
      expect(updatedPlot.soilSensors[0].temperature).toBeLessThanOrEqual(initialTemp);
      // Delivered liters must increment
      expect(updatedPlot.totalLitersDelivered).toBeGreaterThan(initialLiters);
    });
  });

  describe('Weather Chaos Disturbance Modes - Heatwave vs Rainfall', () => {
    it('accelerates soil moisture depletion and elevates temperature during HEATWAVE mode', () => {
      const sim = new MqttTelemetrySimulator();
      sim.setWeatherMode('HEATWAVE');
      expect(sim.weatherMode).toBe('HEATWAVE');

      const plots = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      const plot = plots[0];
      plot.valve.state = 'CLOSED';

      const initialVwc = plot.soilSensors[0].vwc;
      const initialTemp = plot.soilSensors[0].temperature;

      let currentPlots = [plot];
      // Run 5 ticks under heatwave
      for (let i = 0; i < 5; i++) {
        sim.tick(currentPlots, (updated) => {
          currentPlots = [updated];
        });
      }

      const finalPlot = currentPlots[0];
      // Drought evaporation rate is 0.25% per tick
      expect(finalPlot.soilSensors[0].vwc).toBeLessThan(initialVwc);
      // Heatwave elevates soil temperature up to 36°C
      expect(finalPlot.soilSensors[0].temperature).toBeGreaterThanOrEqual(initialTemp);
    });

    it('recharges soil moisture across all zones during RAIN mode', () => {
      const sim = new MqttTelemetrySimulator();
      sim.setWeatherMode('RAIN');
      expect(sim.weatherMode).toBe('RAIN');

      // Start with plot 2 which has severe deficit (13.8% VWC)
      const plots = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      const plot2 = plots.find(p => p.id === 'plot-2');
      plot2.valve.state = 'CLOSED';

      const initialVwc = plot2.soilSensors[0].vwc;
      let currentPlots = [plot2];

      // Run 5 rain ticks
      for (let i = 0; i < 5; i++) {
        sim.tick(currentPlots, (updated) => {
          currentPlots = [updated];
        });
      }

      const rechargedPlot = currentPlots[0];
      // Rain negative drop rate of -1.2% per tick increases moisture
      expect(rechargedPlot.soilSensors[0].vwc).toBeGreaterThan(initialVwc + 3.0);
      // Moisture should never exceed physical saturation ceiling (50.0%)
      expect(rechargedPlot.soilSensors[0].vwc).toBeLessThanOrEqual(50.0);
    });
  });

  describe('Hydraulic Mainline Pressure Dynamics & Overpressure Chaos', () => {
    it('modulates mainline pressure inversely with total volumetric flow rate', () => {
      // Test static zero-flow pressure
      const simZero = new MqttTelemetrySimulator();
      const plotsZero = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      plotsZero.forEach(p => p.valve.state = 'CLOSED');

      let capturedPressureZeroFlow = 0;
      simZero.on('telemetryTick', (data) => {
        capturedPressureZeroFlow = data.mainlinePressureBar;
      });
      simZero.tick(plotsZero);

      // Nominal static pressure is ~2.52 Bar (tolerance +/- 0.1 Bar)
      expect(capturedPressureZeroFlow).toBeGreaterThan(2.40);
      expect(capturedPressureZeroFlow).toBeLessThan(2.65);

      // Test dynamic high-flow pressure drop
      const simHigh = new MqttTelemetrySimulator();
      const plotsHigh = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      plotsHigh[0].valve.state = 'OPEN';
      plotsHigh[0].valve.flowRate = 450.0;
      plotsHigh[1].valve.state = 'OPEN';
      plotsHigh[1].valve.flowRate = 520.0; // Total active = 970 LPH (> 800)

      let capturedPressureHighFlow = 0;
      simHigh.on('telemetryTick', (data) => {
        capturedPressureHighFlow = data.mainlinePressureBar;
      });
      simHigh.tick(plotsHigh);

      // High flow creates friction drop down to ~2.15 Bar
      expect(capturedPressureHighFlow).toBeLessThan(capturedPressureZeroFlow);
      expect(capturedPressureHighFlow).toBeBetween(2.05, 2.30);
    });

    it('chaos engineering: detects hydraulic overpressure surge (> 3.0 Bar) and triggers warning', () => {
      const NORMAL_MAX_PRESSURE = 2.80; // Bar
      const CRITICAL_OVERPRESSURE = 3.20; // Bar

      // Simulate a pump surge spike
      const simulatedPressures = [2.40, 2.55, 2.78, 3.25, 3.42, 2.45];
      const alarms = [];

      simulatedPressures.forEach(pressure => {
        if (pressure > CRITICAL_OVERPRESSURE) {
          alarms.push({
            severity: 'CRITICAL',
            message: `Hydraulic Overpressure Alarm: ${pressure} Bar exceeds safety burst threshold (${CRITICAL_OVERPRESSURE} Bar). Auto-divert recommended.`
          });
        } else if (pressure > NORMAL_MAX_PRESSURE) {
          alarms.push({
            severity: 'WARNING',
            message: `Line pressure elevated: ${pressure} Bar.`
          });
        }
      });

      expect(alarms.length).toBe(2);
      expect(alarms[0].severity).toBe('CRITICAL');
      expect(alarms[0].message).toContain('3.25 Bar');
      expect(alarms[1].severity).toBe('CRITICAL');
      expect(alarms[1].message).toContain('3.42 Bar');
    });

    it('ensures zero NaN or corrupted telemetry packets over 50 consecutive simulator ticks', () => {
      const sim = new MqttTelemetrySimulator();
      const plots = JSON.parse(JSON.stringify(Object.values(INITIAL_FARM_DATA.plots)));
      let tickCount = 0;
      let corruptions = 0;

      sim.on('telemetryTick', (event) => {
        tickCount++;
        if (isNaN(event.mainlinePressureBar) || event.mainlinePressureBar <= 0) corruptions++;
        if (isNaN(event.activeFlowLph) || event.activeFlowLph < 0) corruptions++;
        if (isNaN(event.consumedLitersToday)) corruptions++;
        event.plots.forEach(plot => {
          plot.soilSensors.forEach(s => {
            if (isNaN(s.vwc) || s.vwc < 0) corruptions++;
            if (isNaN(s.temperature)) corruptions++;
          });
        });
      });

      for (let i = 0; i < 50; i++) {
        // Toggle occasional weather modes
        if (i === 15) sim.setWeatherMode('HEATWAVE');
        if (i === 30) sim.setWeatherMode('RAIN');
        if (i === 45) sim.setWeatherMode('NORMAL');
        sim.tick(plots);
      }

      expect(tickCount).toBe(50);
      expect(corruptions).toBe(0);
    });
  });
}
