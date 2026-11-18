#!/usr/bin/env node
/**
 * Master Automated Test Runner for AgriSpectra Flow & Field
 * Orchestrates comprehensive QA and Chaos Engineering verification across:
 *  1. Spectral chemometrics calculation (NDVI, NDRE, WBI/LWI, CIre, Vitality, Urea, Irrigation Countdown, Disease)
 *  2. Solenoid valve latching state transitions (+12V, -12V, timer calculations, emergency killswitch)
 *  3. Telemetry drift simulation and weather disturbances (Normal, Heatwave, Rainfall, Overpressure)
 *  4. Closed-loop leaf-to-valve synergy triggers and lifecycle
 *
 * Run with: node tests/run-tests.js
 */

// Initialize clean in-memory localStorage shim for headless Node execution
if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null
  };
}

import { runner } from './framework.js';
import { registerChemometricsTests } from './chemometrics.test.js';
import { registerSolenoidValveTests } from './solenoid-valves.test.js';
import { registerTelemetryChaosTests } from './telemetry-chaos.test.js';
import { registerClosedLoopTests } from './closed-loop.test.js';
import { registerAuthEnterpriseTests } from './auth-enterprise.test.js';
import { registerHardwareAdapterTests } from './hardware-adapters.test.js';
import { registerMobileLifecycleTests } from './mobile-lifecycle-ui.test.js';
import { registerDatabaseStorageTests } from './database-storage.test.js';

async function main() {
  console.log('\x1b[35mStarting AgriSpectra Flow & Field Automated Test Suite...\x1b[0m');

  // Register all QA test suites
  registerChemometricsTests();
  registerSolenoidValveTests();
  registerTelemetryChaosTests();
  registerClosedLoopTests();
  registerAuthEnterpriseTests();
  registerHardwareAdapterTests();
  registerMobileLifecycleTests();
  registerDatabaseStorageTests();

  // Execute runner
  const success = await runner.run();

  if (success) {
    console.log('\x1b[32m✔ ALL QUALITY ASSURANCE & CHAOS ENGINEERING TESTS PASSED (100% PASS RATE)\x1b[0m\n');
    process.exit(0);
  } else {
    console.error('\x1b[31m✖ TEST FAILURES DETECTED IN APPLICATION LOGIC. PLEASE REVIEW LOGS ABOVE.\x1b[0m\n');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('\x1b[31mFatal unhandled error during test execution:\x1b[0m', err);
  process.exit(1);
});
