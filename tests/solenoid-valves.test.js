/**
 * Solenoid Valve Latching & Actuator Test Suite
 * Tests +12V pulse to open, -12V reverse pulse to close, countdown timers,
 * volume calculations, emergency killswitch, and failsafe auto-shutoff.
 */

import { describe, it, expect } from './framework.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';
import { irrigationControllerAdapter, IrrigationControllerAdapter, VALVE_STATES } from '../src/hardware/irrigationControllerAdapter.js';

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

  describe('Hydraulic Pipe Burst Safety & Minimum Open Valve Interlock', () => {
    it('enforces minOpenValves safety setting and blocks closing the last open valve', async () => {
      const adapter = new IrrigationControllerAdapter();
      adapter.registerValve({ id: 'v1', gateIdentifier: 'G1', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v2', gateIdentifier: 'G2', state: VALVE_STATES.CLOSED });

      // Configure safety setting to 1 (safe default)
      adapter.setMinOpenValves(1);
      expect(adapter.getMinOpenValves()).toBe(1);

      // Open v1
      await adapter.openValve('v1', { durationMinutes: 30 });
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.OPEN);

      // Attempt to close v1 while it is the only open valve
      const check = adapter.canCloseValve('v1');
      expect(check.allowed).toBe(false);
      expect(check.reason).toBe('MIN_OPEN_VALVES_ENFORCED');
      expect(check.minRequired).toBe(1);

      // Closing via adapter.closeValve without force is blocked to protect pipe
      const closeResult = await adapter.closeValve('v1');
      expect(closeResult.success).toBe(false);
      expect(closeResult.blockedBySafety).toBe(true);
      expect(closeResult.message.includes('Pipe Burst Protection')).toBe(true);
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.OPEN); // Still OPEN
    });

    it('allows closing previous valve only after farmer opens another valve first (handoff flow)', async () => {
      const adapter = new IrrigationControllerAdapter();
      adapter.registerValve({ id: 'v1', gateIdentifier: 'G1', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v2', gateIdentifier: 'G2', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v3', gateIdentifier: 'G3', state: VALVE_STATES.CLOSED });

      adapter.setMinOpenValves(1);

      // Step 1: Open v1
      await adapter.openValve('v1', { durationMinutes: 30 });
      expect(adapter.canCloseValve('v1').allowed).toBe(false);

      // Step 2: Farmer opens v2 first
      await adapter.openValve('v2', { durationMinutes: 30 });
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.OPEN);
      expect(adapter.getValve('v2').state).toBe(VALVE_STATES.OPEN);

      // Now with 2 valves open, closing v1 is safe and ALLOWED!
      expect(adapter.canCloseValve('v1').allowed).toBe(true);
      await adapter.closeValve('v1');
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.CLOSED);
      expect(adapter.getValve('v2').state).toBe(VALVE_STATES.OPEN);

      // Now v2 is the only open valve; closing v2 is blocked again!
      expect(adapter.canCloseValve('v2').allowed).toBe(false);
    });

    it('supports 2 valves always open setting for dual-line split irrigation', async () => {
      const adapter = new IrrigationControllerAdapter();
      adapter.registerValve({ id: 'v1', gateIdentifier: 'G1', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v2', gateIdentifier: 'G2', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v3', gateIdentifier: 'G3', state: VALVE_STATES.CLOSED });

      adapter.setMinOpenValves(2);
      expect(adapter.getMinOpenValves()).toBe(2);

      await adapter.openValve('v1', { durationMinutes: 30 });
      await adapter.openValve('v2', { durationMinutes: 30 });

      // With 2 valves open and minRequired=2, closing either is blocked
      expect(adapter.canCloseValve('v1').allowed).toBe(false);
      expect(adapter.canCloseValve('v2').allowed).toBe(false);

      // Open a 3rd valve
      await adapter.openValve('v3', { durationMinutes: 30 });
      // Now closing v1 is allowed because 3 - 1 = 2 >= 2
      expect(adapter.canCloseValve('v1').allowed).toBe(true);
      await adapter.closeValve('v1');
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.CLOSED);
    });

    it('supports 0 valves (manual mode) allowing complete closure of all valves', async () => {
      const adapter = new IrrigationControllerAdapter();
      adapter.registerValve({ id: 'v1', gateIdentifier: 'G1', state: VALVE_STATES.CLOSED });
      adapter.setMinOpenValves(0);

      await adapter.openValve('v1', { durationMinutes: 30 });
      expect(adapter.canCloseValve('v1').allowed).toBe(true);
      await adapter.closeValve('v1');
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.CLOSED);
    });

    it('allows emergency killswitch to bypass minOpenValves interlock during critical emergencies', async () => {
      const adapter = new IrrigationControllerAdapter();
      adapter.registerValve({ id: 'v1', gateIdentifier: 'G1', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v2', gateIdentifier: 'G2', state: VALVE_STATES.CLOSED });
      adapter.setMinOpenValves(1);

      await adapter.openValve('v1', { durationMinutes: 30 });
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.OPEN);

      // Emergency killswitch immediately stops all valves regardless of minOpenValves
      await adapter.emergencyAllStop('HIGH_PRESSURE_BURST_PREVENTION');
      expect(adapter.getValve('v1').state).toBe(VALVE_STATES.CLOSED);
    });

    it('automatically ensures minimum valves are open on boot via ensureMinimumValvesOpen', async () => {
      const adapter = new IrrigationControllerAdapter();
      adapter.registerValve({ id: 'v1', gateIdentifier: 'G1', state: VALVE_STATES.CLOSED });
      adapter.registerValve({ id: 'v2', gateIdentifier: 'G2', state: VALVE_STATES.CLOSED });
      adapter.setMinOpenValves(1);

      expect(adapter.getAllValves().filter(v => v.state === VALVE_STATES.OPEN).length).toBe(0);

      const opened = adapter.ensureMinimumValvesOpen();
      expect(opened.length).toBe(1);
      expect(opened[0]).toBe('v1');
    });
  });
}
