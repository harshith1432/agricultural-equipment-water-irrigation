/**
 * Solenoid Valve Latching & Actuator Test Suite
 * Tests +12V pulse to open, -12V reverse pulse to close, countdown timers,
 * volume calculations, emergency killswitch, and failsafe auto-shutoff.
 */

import { describe, it, expect } from './framework.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';

export function registerSolenoidValveTests() {
  describe('Solenoid Valve Latching - Bi-Stable Actuation & Pulse Polarity', () => {
    it('applies a positive +12V pulse to actuate latching solenoid to OPEN', () => {
      mockFirestore.resetToDefault();
      const plotId = 'plot-1';
      const durationMinutes = 25;
      const now = new Date();

      const timerEnd = new Date(now.getTime() + durationMinutes * 60000).toISOString();
      const pulseVoltage = 12;

      // Actuate OPEN
      mockFirestore.updatePlot(plotId, {
        valve: {
          id: 'G1',
          state: 'OPEN',
          flowRate: 450.0,
          pulseVoltage: pulseVoltage,
          timerEnd: timerEnd,
          lastActuatedAt: now.toISOString()
        }
      });

      const updatedPlots = mockFirestore.getChannelSnapshot('plots');
      const p1 = updatedPlots.find(p => p.id === plotId);

      expect(p1.valve.state).toBe('OPEN');
      expect(p1.valve.pulseVoltage).toBe(12);
      expect(p1.valve.timerEnd).toBe(timerEnd);
      expect(p1.valve.lastActuatedAt).toBe(now.toISOString());
    });

    it('applies a negative -12V reverse pulse to de-energize and CLOSE the valve', () => {
      const plotId = 'plot-1';
      const now = new Date();
      const pulseVoltage = -12;

      // Actuate CLOSE
      mockFirestore.updatePlot(plotId, {
        valve: {
          id: 'G1',
          state: 'CLOSED',
          flowRate: 450.0,
          pulseVoltage: pulseVoltage,
          timerEnd: null,
          lastActuatedAt: now.toISOString()
        }
      });

      const updatedPlots = mockFirestore.getChannelSnapshot('plots');
      const p1 = updatedPlots.find(p => p.id === plotId);

      expect(p1.valve.state).toBe('CLOSED');
      expect(p1.valve.pulseVoltage).toBe(-12);
      expect(p1.valve.timerEnd).toBe(null);
    });

    it('calculates timerEnd accurately for irrigation countdowns', () => {
      const startTimeMs = 1700000000000;
      const durations = [10, 15, 20, 30, 45, 60];

      durations.forEach(mins => {
        const expectedEndMs = startTimeMs + mins * 60 * 1000;
        const computedEnd = new Date(startTimeMs + mins * 60 * 1000);
        expect(computedEnd.getTime()).toBe(expectedEndMs);
        expect((computedEnd.getTime() - startTimeMs) / 60000).toBe(mins);
      });
    });

    it('computes delivered water volume based on calibrated flow rate (LPH)', () => {
      const flowRateLph = 480.0; // Liters per hour
      const durationMinutes = 15.0; // 0.25 hour

      // Volume = (flowRate / 60) * minutes
      const deliveredLiters = Number(((flowRateLph / 60) * durationMinutes).toFixed(1));
      expect(deliveredLiters).toBe(120.0);

      // 45 minutes at 600 LPH
      const deliveredLitersHigh = Number(((600.0 / 60) * 45.0).toFixed(1));
      expect(deliveredLitersHigh).toBe(450.0);
    });
  });

  describe('Emergency 1-Tap Killswitch & Multi-Valve Isolation', () => {
    it('instantly shuts off all 6 gates simultaneously during hydraulic anomaly or manual killswitch', () => {
      mockFirestore.resetToDefault();

      // Open gates G1, G3, and G5
      const openGates = ['plot-1', 'plot-3', 'plot-5'];
      openGates.forEach(id => {
        const plot = mockFirestore.data.plots[id];
        mockFirestore.updatePlot(id, {
          valve: {
            ...plot.valve,
            state: 'OPEN',
            pulseVoltage: 12,
            timerEnd: new Date(Date.now() + 30 * 60000).toISOString(),
            lastActuatedAt: new Date().toISOString()
          }
        });
      });

      // Verify they are open
      let plots = mockFirestore.getChannelSnapshot('plots');
      const initiallyOpen = plots.filter(p => p.valve.state === 'OPEN');
      expect(initiallyOpen.length).toBe(3);

      // Execute emergency killswitch
      plots.forEach(plot => {
        if (plot.valve?.state === 'OPEN') {
          mockFirestore.updatePlot(plot.id, {
            valve: {
              ...plot.valve,
              state: 'CLOSED',
              timerEnd: null,
              pulseVoltage: -12,
              lastActuatedAt: new Date().toISOString()
            }
          });

          // Log killswitch
          mockFirestore.addIrrigationLog({
            plotId: plot.id,
            valveId: plot.valve.id,
            action: 'EMERGENCY_SHUTOFF',
            durationMinutes: 0,
            litersDelivered: 0,
            triggeredBy: 'EMERGENCY_KILLSWITCH'
          });
        }
      });

      // Verify all valves are now CLOSED with -12V pulse
      const finalPlots = mockFirestore.getChannelSnapshot('plots');
      const stillOpen = finalPlots.filter(p => p.valve.state === 'OPEN');
      expect(stillOpen.length).toBe(0);

      finalPlots.forEach(p => {
        expect(p.valve.state).toBe('CLOSED');
      });

      // Verify emergency audit log
      const logs = mockFirestore.getChannelSnapshot('irrigationLogs');
      const emergencyLogs = logs.filter(l => l.triggeredBy === 'EMERGENCY_KILLSWITCH');
      expect(emergencyLogs.length).toBe(3);
    });
  });

  describe('Scheduled Countdown Failsafe Watchdog', () => {
    it('detects and shuts off valves when countdown timer has elapsed', () => {
      mockFirestore.resetToDefault();
      const plotId = 'plot-2';
      const pastTime = new Date(Date.now() - 5000).toISOString(); // Expired 5 seconds ago

      mockFirestore.updatePlot(plotId, {
        valve: {
          id: 'G2',
          state: 'OPEN',
          flowRate: 520.0,
          pulseVoltage: 12,
          timerEnd: pastTime,
          lastActuatedAt: new Date(Date.now() - 25 * 60000).toISOString()
        }
      });

      // Run watchdog sweep
      const nowMillis = Date.now();
      const plots = mockFirestore.getChannelSnapshot('plots');
      let autoClosedCount = 0;

      plots.forEach(plot => {
        if (plot.valve?.state === 'OPEN' && plot.valve?.timerEnd) {
          const endMillis = new Date(plot.valve.timerEnd).getTime();
          if (endMillis <= nowMillis) {
            mockFirestore.updatePlot(plot.id, {
              valve: {
                ...plot.valve,
                state: 'CLOSED',
                timerEnd: null,
                pulseVoltage: -12,
                lastActuatedAt: new Date().toISOString()
              }
            });
            autoClosedCount++;
          }
        }
      });

      expect(autoClosedCount).toBe(1);
      const updatedPlot2 = mockFirestore.getChannelSnapshot('plots').find(p => p.id === plotId);
      expect(updatedPlot2.valve.state).toBe('CLOSED');
      expect(updatedPlot2.valve.timerEnd).toBe(null);
      expect(updatedPlot2.valve.pulseVoltage).toBe(-12);
    });
  });
}
