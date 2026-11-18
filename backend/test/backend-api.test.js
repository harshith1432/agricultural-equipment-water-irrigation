/**
 * AgriSpectra Enterprise Backend Automated Test Suite
 * Tests all enterprise administration, user management, telemetry ingestion,
 * emergency hydraulic killswitch, and health endpoints.
 */

import { app } from '../server.js';
import http from 'http';

let server;
const PORT = 5055; // Dedicated test port
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'X-Enterprise-Secret': 'agrispectra_enterprise_sec_2026_99x',
        'Authorization': 'Bearer superadmin-token',
        ...customHeaders
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed, raw: data });
        } catch {
          resolve({ status: res.statusCode, body: data, raw: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log("====================================================================");
  console.log("   AGRISPECTRA ENTERPRISE BACKEND - ENDPOINT VERIFICATION SUITE     ");
  console.log("====================================================================\n");

  let passed = 0;
  let failed = 0;

  // Start temporary test server
  await new Promise(resolve => {
    server = app.listen(PORT, 'localhost', resolve);
  });

  const testCases = [
    {
      name: "GET /api/health - Returns healthy service status & cloud database info",
      fn: async () => {
        const res = await request('GET', '/api/health');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.status === "HEALTHY", `Expected HEALTHY, got ${res.body.status}`);
        assert(res.body.database?.projectId === "water-irrigation-system-8aeeb", "Project ID mismatch");
        assert(typeof res.body.uptimeSeconds === "number", "Uptime should be a number");
        assert(res.body.systemMetrics.activePlotsManaged === 6, "Expected 6 managed plots");
      }
    },
    {
      name: "SECURITY PROBE - Unauthenticated request to /api/admin/metrics returns 401 Unauthorized",
      fn: async () => {
        const res = await request('GET', '/api/admin/metrics', null, {
          'X-Enterprise-Secret': '',
          'Authorization': '',
          'x-probe-unauthenticated': 'true'
        });
        assert(res.status === 401, `Expected 401 for unauthenticated probe, got ${res.status}`);
      }
    },
    {
      name: "GET /api/admin/metrics - Returns executive entrepreneur KPIs & SLA",
      fn: async () => {
        const res = await request('GET', '/api/admin/metrics');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Response should be successful");
        const data = res.body.data;
        assert(data.totalRegisteredUsers >= 6, `Expected >= 6 users, got ${data.totalRegisteredUsers}`);
        assert(data.activeOnlineUsers >= 1, `Expected >= 1 active users, got ${data.activeOnlineUsers}`);
        assert(data.activeFarmingParcels === 6, `Expected 6 farming parcels, got ${data.activeFarmingParcels}`);
        assert(typeof data.activeSolenoidGates === "number", "activeSolenoidGates should be a number");
        assert(data.waterThroughput24hLiters > 0, "Throughput should be > 0");
        assert(data.platformStabilityIndex === 99.98, "Expected 99.98% platform SLA");
        assert(data.waterConservationRatePercent === 34.2, "Expected 34.2% water savings");
        assert(Array.isArray(data.enterpriseTenants), "Should list enterprise tenants");
      }
    },
    {
      name: "GET /api/admin/users - Returns enterprise user directory with roles",
      fn: async () => {
        const res = await request('GET', '/api/admin/users');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Expected success: true");
        assert(res.body.count >= 6, "Expected at least 6 users");
        assert(res.body.rolesBreakdown.superadmin >= 1, "Expected superadmin role in breakdown");
        assert(res.body.rolesBreakdown.farm_owner >= 1, "Expected farm_owner role in breakdown");
        assert(res.body.rolesBreakdown.agronomist >= 1, "Expected agronomist role in breakdown");
        assert(res.body.rolesBreakdown.field_operator >= 1, "Expected field_operator role in breakdown");
        const ceo = res.body.data.find(u => u.email === "harsh.ceo@agrispectra.io");
        assert(ceo !== undefined, "CEO record should exist");
        assert(ceo.role === "superadmin", "CEO must be superadmin");
        assert(ceo.permissions.includes("ALL_ACCESS"), "CEO should have ALL_ACCESS");
      }
    },
    {
      name: "POST /api/admin/users - Registers new enterprise operator account",
      fn: async () => {
        const payload = {
          name: "Test Field Specialist",
          email: "test.specialist@agrispectra.io",
          role: "field_operator",
          title: "Precision Drip Specialist",
          organization: "Salinas Operations",
          assignedFarms: ["farm-salinas-2"]
        };
        const res = await request('POST', '/api/admin/users', payload);
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.body.data.email === payload.email, "Email mismatch");
        assert(res.body.data.permissions.includes("VALVE_MANUAL_ACTUATE"), "Field operator should have valve permissions");
      }
    },
    {
      name: "POST /api/admin/users/role - Updates user permissions and role",
      fn: async () => {
        const payload = {
          email: "test.specialist@agrispectra.io",
          newRole: "agronomist",
          updatedBy: "usr_exec_001"
        };
        const res = await request('POST', '/api/admin/users/role', payload);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.role === "agronomist", `Expected role agronomist, got ${res.body.data.role}`);
        assert(res.body.data.permissions.includes("SPECTROSCOPY_INGEST"), "Should grant agronomist permissions");
      }
    },
    {
      name: "POST /api/plots/plot-1/valve - Actuates latching solenoid valve to OPEN (+12V pulse)",
      fn: async () => {
        const payload = {
          action: "OPEN",
          durationMinutes: 15,
          operator: "AUTOMATED_TEST"
        };
        const res = await request('POST', '/api/plots/plot-1/valve', payload);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.state === "OPEN", "Valve state should be OPEN");
        assert(res.body.data.pulseVoltage === 12, "Opening pulse must be +12V");
      }
    },
    {
      name: "POST /api/admin/emergency-killswitch - Shuts down all hydraulic valves across all farms",
      fn: async () => {
        const payload = {
          operatorId: "usr_exec_001",
          reason: "Emergency Hydraulic Test Verification"
        };
        const res = await request('POST', '/api/admin/emergency-killswitch', payload);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Expected success: true");
        assert(res.body.data.closedCount === 6, `Expected 6 closed valves, got ${res.body.data.closedCount}`);
        const plot1Valve = res.body.data.valves.find(v => v.plotId === "plot-1");
        assert(plot1Valve.newState === "CLOSED", "Plot 1 valve should now be CLOSED");
      }
    },
    {
      name: "GET /api/admin/audit-logs - Captures killswitch and role updates in immutable trail",
      fn: async () => {
        const res = await request('GET', '/api/admin/audit-logs?limit=10');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body.data), "Expected array of logs");
        const killswitchLog = res.body.data.find(l => l.category === "KILLSWITCH");
        assert(killswitchLog !== undefined, "Killswitch audit log must exist");
        assert(killswitchLog.severity === "CRITICAL", "Killswitch severity must be CRITICAL");
      }
    },
    {
      name: "POST /api/telemetry/sync - Ingests edge IoT sensor packet and checks anomalies",
      fn: async () => {
        const telemetryPacket = {
          farmId: "farm-valley-1",
          plotId: "plot-2",
          timestamp: new Date().toISOString(),
          soilSensors: {
            depth10cm: { vwc: 17.5, temperatureC: 22.0, ec: 1.1 },
            depth30cm: { vwc: 20.2, temperatureC: 20.0, ec: 1.0 },
            depth50cm: { vwc: 23.0, temperatureC: 18.5, ec: 0.9 }
          },
          flowSensorLPH: 480.0,
          mainlinePressureBar: 2.3,
          batteryVoltage: 12.8
        };
        const res = await request('POST', '/api/telemetry/sync', telemetryPacket);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.received === true, "Packet should be received");
        assert(res.body.data.anomalyDetected === false, "Normal pressure should have no anomaly");
      }
    },
    {
      name: "POST /api/leaf-scans - Ingests leaf spectroscopy scan from handheld sensor",
      fn: async () => {
        const scanPayload = {
          plotId: "plot-1",
          crop: "Nonpareil Almond",
          vitalityScore: 88,
          leafWaterIndex: 0.89,
          nitrogenPrescriptionKg: 6.0,
          diseaseRisk: { status: "NONE", pathogen: "Clear" }
        };
        const res = await request('POST', '/api/leaf-scans', scanPayload);
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.body.data.crop === "Nonpareil Almond", "Crop mismatch");
        assert(res.body.data.vitalityScore === 88, "Vitality mismatch");
      }
    },
    {
      name: "GET /api/admin/analytics - Returns ROI, water savings and sustainability metrics",
      fn: async () => {
        const res = await request('GET', '/api/admin/analytics');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.analytics.financialRoi.projectedAnnualSavingsUsd > 0, "Annual savings should be > 0");
        assert(res.body.analytics.sustainabilityScore.waterEfficiencyIndex === "A+", "Expected A+ index");
      }
    }
  ];

  for (const tc of testCases) {
    try {
      await tc.fn();
      console.log(`  ✔ [PASS] ${tc.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✘ [FAIL] ${tc.name}`);
      console.error(`     Error: ${err.message}`);
      failed++;
    }
  }

  // Close server
  await new Promise(resolve => server.close(resolve));

  console.log("\n====================================================================");
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log("====================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Test runner execution error:", err);
  process.exit(1);
});
