/**
 * Smart Agriculture Mobile Application Microservice Verification Suite
 * Thoroughly validates all routes in:
 *   - irrigationRoutes.js
 *   - soilRoutes.js
 *   - spectroRoutes.js
 *   - environmentRoutes.js
 *   - aiRoutes.js
 * And services:
 *   - weatherService.js
 *   - aiIntelligenceEngine.js
 *   - centralStorage.js
 *
 * Verifies all 3 multi-modal sensor connection modes:
 *   1. USB_TYPE_C
 *   2. BLUETOOTH_BLE
 *   3. WIFI_CLOUD (direct cloud / Wi-Fi IoT ingestion)
 */

import { app } from '../server.js';
import http from 'http';

let server;
const PORT = 5057;
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
    throw new Error(`[ASSERTION FAILED]: ${message}`);
  }
}

async function runTestSuite() {
  console.log("====================================================================");
  console.log("   SMART AGRI MICROSERVICE - FULL ENDPOINT VERIFICATION SUITE       ");
  console.log("====================================================================\n");

  let passed = 0;
  let failed = 0;

  await new Promise(resolve => {
    server = app.listen(PORT, 'localhost', resolve);
  });

  let createdValveId = null;
  let createdScheduleId = null;
  let createdSoilScanId = null;
  let createdSpectroScanId = null;

  const testCases = [
    // -----------------------------------------------------------------------
    // 1. IRRIGATION ROUTES
    // -----------------------------------------------------------------------
    {
      name: "GET /api/irrigation/valves - Dynamic list of all physical latching valves",
      fn: async () => {
        const res = await request('GET', '/api/irrigation/valves');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Expected success: true");
        assert(Array.isArray(res.body.data), "Expected data to be array");
        assert(res.body.data.length >= 6, `Expected >= 6 valves, got ${res.body.data.length}`);
        const v1 = res.body.data.find(v => v.code === "G1" || v.id === "valve-1");
        assert(v1 !== undefined, "Valve G1 must exist");
        assert(typeof v1.flowRateLph === "number", "flowRateLph must be numeric");
      }
    },
    {
      name: "POST /api/irrigation/valves - Provision new dynamic valve configuration",
      fn: async () => {
        const payload = {
          name: "Test North Parcel Sub-Drip",
          code: "G7",
          plotId: "plot-test-7",
          farmId: "farm-valley-1",
          flowRateLph: 520.0,
          crop: "Organic Blueberries",
          gpioPin: 29
        };
        const res = await request('POST', '/api/irrigation/valves', payload);
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.body.data.name === payload.name, "Name mismatch");
        assert(res.body.data.code === "G7", "Code mismatch");
        createdValveId = res.body.data.id;
      }
    },
    {
      name: "GET /api/irrigation/valves/:id - Retrieve specific valve configuration",
      fn: async () => {
        const res = await request('GET', `/api/irrigation/valves/${createdValveId}`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.id === createdValveId, "Valve ID mismatch");
        assert(res.body.data.crop === "Organic Blueberries", "Crop mismatch");
      }
    },
    {
      name: "PATCH /api/irrigation/valves/:id - Update valve metadata & flow rate",
      fn: async () => {
        const updates = { flowRateLph: 550.0, pipeDiameterMm: 63 };
        const res = await request('PATCH', `/api/irrigation/valves/${createdValveId}`, updates);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.flowRateLph === 550.0, "Flow rate was not updated");
        assert(res.body.data.pipeDiameterMm === 63, "Pipe diameter was not updated");
      }
    },
    {
      name: "POST /api/irrigation/valves/:id/on - Actuates latching solenoid (+12V pulse) with controller ACK",
      fn: async () => {
        const payload = { durationMinutes: 15, operator: "TEST_OPERATOR" };
        const res = await request('POST', `/api/irrigation/valves/${createdValveId}/on`, payload);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.state === "OPEN", "Valve state should be OPEN");
        assert(res.body.controllerStatus === "ACTIVE", "Expected ACTIVE controller status");
        assert(res.body.acknowledgment.pulseVoltage === "12V", "Expected +12V pulse");
        assert(res.body.session !== null, "Irrigation session must be initialized");
      }
    },
    {
      name: "POST /api/irrigation/valves/:id/off - Actuates latching solenoid (-12V reverse pulse) with controller ACK",
      fn: async () => {
        const payload = { operator: "TEST_OPERATOR" };
        const res = await request('POST', `/api/irrigation/valves/${createdValveId}/off`, payload);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.state === "CLOSED", "Valve state should be CLOSED");
        assert(res.body.controllerStatus === "ACKNOWLEDGED", "Expected ACKNOWLEDGED controller status");
        assert(res.body.acknowledgment.pulseVoltage === "-12V", "Expected -12V reverse pulse");
      }
    },
    {
      name: "POST /api/irrigation/schedules & GET /api/irrigation/schedules - Multi-slot schedules per valve",
      fn: async () => {
        const schedPayload = {
          valveId: createdValveId,
          plotId: "plot-test-7",
          farmId: "farm-valley-1",
          name: "Blueberry Dual Daily Drip",
          daysOfWeek: ["Mon", "Wed", "Fri"],
          slots: [
            { startTime: "06:00", durationMinutes: 20, targetVolumeLiters: 180, active: true },
            { startTime: "17:30", durationMinutes: 15, targetVolumeLiters: 135, active: true }
          ]
        };
        const createRes = await request('POST', '/api/irrigation/schedules', schedPayload);
        assert(createRes.status === 201, `Expected 201, got ${createRes.status}`);
        createdScheduleId = createRes.body.data.id;
        assert(createRes.body.data.slots.length === 2, "Expected 2 schedule slots");

        const listRes = await request('GET', `/api/irrigation/schedules?valveId=${createdValveId}`);
        assert(listRes.status === 200, `Expected 200, got ${listRes.status}`);
        assert(listRes.body.data.length >= 1, "Expected created schedule in list");
      }
    },
    {
      name: "PATCH & DELETE /api/irrigation/schedules/:id - Update and remove schedule",
      fn: async () => {
        const patchRes = await request('PATCH', `/api/irrigation/schedules/${createdScheduleId}`, { enabled: false });
        assert(patchRes.status === 200, `Expected 200, got ${patchRes.status}`);
        assert(patchRes.body.data.enabled === false, "Expected schedule to be disabled");

        const delRes = await request('DELETE', `/api/irrigation/schedules/${createdScheduleId}`);
        assert(delRes.status === 200, `Expected 200, got ${delRes.status}`);
      }
    },
    {
      name: "GET & POST /api/irrigation/sessions - Session water accounting & ledger",
      fn: async () => {
        const sessionPayload = {
          valveId: "valve-1",
          plotId: "plot-1",
          farmId: "farm-valley-1",
          targetDurationMinutes: 25,
          targetVolumeLiters: 200.0,
          averageFlowRateLph: 480.0
        };
        const postRes = await request('POST', '/api/irrigation/sessions', sessionPayload);
        assert(postRes.status === 201, `Expected 201, got ${postRes.status}`);

        const getRes = await request('GET', '/api/irrigation/sessions?valveId=valve-1');
        assert(getRes.status === 200, `Expected 200, got ${getRes.status}`);
        assert(getRes.body.waterAccounting !== undefined, "Water accounting summary must exist");
        assert(typeof getRes.body.waterAccounting.totalDeliveredLiters === "number", "Total delivered must be number");
      }
    },
    {
      name: "GET /api/irrigation/flow-readings - Water flow meter telemetry time-series",
      fn: async () => {
        const res = await request('GET', '/api/irrigation/flow-readings?limit=10');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body.data), "Expected data array");
        assert(res.body.data.length > 0, "Expected flow readings");
        assert(typeof res.body.data[0].flowRateLph === "number", "flowRateLph must be numeric");
      }
    },
    {
      name: "POST /api/irrigation/emergency-stop - 1-tap killswitch shuts down all valves",
      fn: async () => {
        // Open a valve first
        await request('POST', `/api/irrigation/valves/valve-1/on`, { durationMinutes: 30 });

        const killRes = await request('POST', '/api/irrigation/emergency-stop', {
          operatorId: "USR_EXEC_99",
          reason: "Emergency Pressure Spurt Test"
        });
        assert(killRes.status === 200, `Expected 200, got ${killRes.status}`);
        assert(killRes.body.success === true, "Expected success: true");
        assert(killRes.body.closedCount >= 6, "All valves must be closed");

        // Verify valve-1 is now closed
        const valve1Res = await request('GET', '/api/irrigation/valves/valve-1');
        assert(valve1Res.body.data.state === "CLOSED", "Valve 1 must be latched CLOSED");
      }
    },
    {
      name: "DELETE /api/irrigation/valves/:id - Decommission test valve",
      fn: async () => {
        const res = await request('DELETE', `/api/irrigation/valves/${createdValveId}`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
      }
    },

    // -----------------------------------------------------------------------
    // 2. SOIL ROUTES (LABART 8-IN-1 MODBUS & MULTI-MODAL CONNECTION MODES)
    // -----------------------------------------------------------------------
    {
      name: "POST /api/soil/scans - Ingest LABART 8-in-1 Modbus RTU raw register packet (USB-C)",
      fn: async () => {
        const payload = {
          deviceId: "LABART-PROBE-01",
          farmId: "farm-valley-1",
          fieldId: "plot-1",
          crop: "Almond Orchards",
          cropStage: "Fruit Formation",
          depthCm: 15,
          connectionMode: "USB_TYPE_C",
          // Raw 16-bit Modbus registers: [moisture*10, temp*10, ec, ph*10, N, P, K, fertility]
          rawModbus: [265, 238, 1180, 68, 125, 42, 230, 840]
        };
        const res = await request('POST', '/api/soil/scans', payload);
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.body.data.source === "USB_TYPE_C", "Source must be USB_TYPE_C");
        assert(res.body.data.measurements.moisture === 26.5, "Moisture conversion mismatch (265 -> 26.5%)");
        assert(res.body.data.measurements.temperature === 23.8, "Temp conversion mismatch (238 -> 23.8°C)");
        assert(res.body.data.measurements.ph === 6.8, "pH conversion mismatch");
        assert(res.body.data.measurements.nitrogen === 125, "N mismatch");
        createdSoilScanId = res.body.data.id;
      }
    },
    {
      name: "POST /api/telemetry/soil/raw - Direct Wi-Fi sensor packet ingestion (WIFI_DIRECT / WIFI_CLOUD)",
      fn: async () => {
        const wifiPacket = {
          deviceId: "SOIL-WIFI-NODE-04",
          farmId: "farm-valley-1",
          fieldId: "plot-4",
          crop: "Organic Hass Avocados",
          depthCm: 25,
          measurements: {
            temperature: 21.5,
            moisture: 22.0,
            ec: 1100,
            ph: 6.5,
            nitrogen: 95,
            phosphorus: 32,
            potassium: 190,
            fertility: 780
          }
        };
        const res = await request('POST', '/api/telemetry/soil/raw', wifiPacket);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.source === "WIFI_CLOUD", "Source must be WIFI_CLOUD");
        assert(res.body.connectionMode === "WIFI_DIRECT", "Connection mode must be WIFI_DIRECT");
        assert(res.body.data.measurements.moisture === 22.0, "Moisture mismatch");
      }
    },
    {
      name: "GET /api/soil/latest - Fast query endpoint for mobile app",
      fn: async () => {
        const res = await request('GET', '/api/soil/latest?plotId=plot-1');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data !== null, "Expected latest reading");
        assert(res.body.data.measurements.nitrogen !== undefined, "Nitrogen reading must exist");
      }
    },
    {
      name: "GET /api/soil/scans/:id & :id/results - Farmer-friendly agronomic interpretations",
      fn: async () => {
        const res = await request('GET', `/api/soil/scans/${createdSoilScanId}/results?cropProfile=ALMOND`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.interpretations !== undefined, "Interpretations must exist");
        assert(typeof res.body.interpretations.overallHealthScore === "number", "Health score must be number");
        assert(res.body.interpretations.parameters.ph.status !== undefined, "pH evaluation status must exist");
        assert(res.body.interpretations.parameters.moisture.status !== undefined, "Moisture status must exist");
        assert(Array.isArray(res.body.interpretations.actionableDeficits), "Actionable deficits must be array");
      }
    },
    {
      name: "GET /api/soil/history - Historical depth time-series",
      fn: async () => {
        const res = await request('GET', '/api/soil/history?limit=10');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body.data), "History must be array");
        assert(res.body.data.length >= 1, "Expected historical scans");
      }
    },

    // -----------------------------------------------------------------------
    // 3. SPECTROSCOPY ROUTES (VIS-NIR 350-1100nm)
    // -----------------------------------------------------------------------
    {
      name: "POST /api/spectroscopy/scans - Ingest raw spectral intensities & chemometrics (BLE/WIFI)",
      fn: async () => {
        const specPayload = {
          deviceId: "MICROSPEC-VIS-NIR-01",
          plotId: "plot-1",
          crop: "Nonpareil Almond",
          connectionMode: "BLUETOOTH_BLE",
          integrationTimeMs: 40,
          calibrationReference: {
            darkBaselineCalibrated: true,
            whiteDiscCalibrated: true,
            calibrationTimestamp: new Date().toISOString()
          },
          chemometrics: {
            ndvi: 0.81,
            ndre: 0.36,
            leafWaterIndex: 0.92,
            cire: 2.7,
            vitalityScore: 89,
            nitrogenPrescriptionKg: 0.0,
            irrigationCountdownHours: 42,
            irrigationUrgency: "NORMAL",
            diseaseRisk: { detected: false, pathogen: "None", confidence: 10 }
          }
        };
        const res = await request('POST', '/api/spectroscopy/scans', specPayload);
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.body.data.source === "BLUETOOTH_BLE", "Source should be BLUETOOTH_BLE");
        assert(res.body.data.chemometrics.vitalityScore === 89, "Vitality score mismatch");
        createdSpectroScanId = res.body.data.id;
      }
    },
    {
      name: "GET /api/spectroscopy/latest - Fast query endpoint for mobile app",
      fn: async () => {
        const res = await request('GET', '/api/spectroscopy/latest?plotId=plot-1');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.chemometrics !== undefined, "Chemometrics must exist");
        assert(res.body.data.chemometrics.leafWaterIndex > 0.5, "Leaf water index should be valid");
      }
    },
    {
      name: "GET /api/spectroscopy/scans/:id/results - Extracted indices & pathology diagnosis",
      fn: async () => {
        const res = await request('GET', `/api/spectroscopy/scans/${createdSpectroScanId}/results`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.indices.ndvi === 0.81, "NDVI mismatch");
        assert(res.body.indices.leafWaterIndex === 0.92, "LWI mismatch");
        assert(res.body.prescriptions.irrigationUrgency === "NORMAL", "Urgency mismatch");
      }
    },

    // -----------------------------------------------------------------------
    // 4. ENVIRONMENT & WEATHER ROUTES
    // -----------------------------------------------------------------------
    {
      name: "POST /api/environment/readings - Ingest USB and Wi-Fi environmental telemetry",
      fn: async () => {
        const envPayload = {
          deviceId: "USB-SHT40-TEMP-HUMIDITY",
          plotId: "plot-1",
          source: "USB_TYPE_C",
          temperature: 26.2,
          relativeHumidity: 54.0,
          barometricPressureHpa: 1012.8
        };
        const res = await request('POST', '/api/environment/readings', envPayload);
        assert(res.status === 201, `Expected 201, got ${res.status}`);
        assert(res.body.data.source === "USB_TYPE_C", "Source must be USB_TYPE_C");
        assert(res.body.data.vpd > 0, "Vapor pressure deficit should be computed");
      }
    },
    {
      name: "GET /api/environment/latest - Multi-source breakdown (WIFI_CLOUD, USB_TYPE_C, BLUETOOTH_BLE)",
      fn: async () => {
        const res = await request('GET', '/api/environment/latest');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.sources !== undefined, "Sources breakdown must exist");
        assert(res.body.sources.USB_TYPE_C !== undefined, "USB_TYPE_C source must exist");
        assert(res.body.primaryReading !== null, "Primary reading must exist");
      }
    },
    {
      name: "GET /api/environment/weather - Open-Meteo & IMD coordinate weather fallback",
      fn: async () => {
        const res = await request('GET', '/api/environment/weather?lat=36.677&lon=-121.655');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Expected success: true");
        assert(res.body.current.temperatureC !== undefined, "Temperature must exist");
        assert(res.body.agronomicAdvisory !== undefined, "Agronomic advisory must exist");
        assert(res.body.agronomicAdvisory.spraySuitability !== undefined, "Spray suitability must exist");
        assert(Array.isArray(res.body.forecast7d), "7-day forecast must be an array");
      }
    },
    {
      name: "GET /api/environment/history - Environmental trends and daily stats",
      fn: async () => {
        const res = await request('GET', '/api/environment/history?limit=10');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.statistics !== undefined, "Statistics object must exist");
        assert(res.body.statistics.temperature.avg !== null, "Avg temp must be calculated");
      }
    },

    // -----------------------------------------------------------------------
    // 5. AI INTELLIGENCE & ANALYTICS ROUTES
    // -----------------------------------------------------------------------
    {
      name: "GET /api/analytics/farm-overview - Executive macro KPIs & hydraulic state",
      fn: async () => {
        const res = await request('GET', '/api/analytics/farm-overview');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.data.parcelsManaged >= 6, "Expected >= 6 parcels");
        assert(typeof res.body.data.waterConservationRatePercent === "number", "Water conservation rate must be numeric");
        assert(res.body.data.soilHealth !== undefined, "Soil health summary must exist");
      }
    },
    {
      name: "GET /api/analytics/field-comparison - Multi-parcel comparative breakdown",
      fn: async () => {
        const res = await request('GET', '/api/analytics/field-comparison');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body.data.fields), "Expected fields array");
        assert(res.body.data.fields.length >= 6, "Expected 6 fields compared");
        assert(res.body.data.fields[0].measurements.soilMoistureVwc !== undefined, "Moisture must be reported");
      }
    },
    {
      name: "POST /api/ai/analyze - Cross-correlates Soil + Spectroscopy + Weather + Flow",
      fn: async () => {
        const testPayload = {
          farmId: "farm-valley-1",
          plotId: "plot-1",
          crop: "Almond Orchards",
          rainProbability: 0,
          soil: {
            measurements: { moisture: 16.2, nitrogen: 65, phosphorus: 22, potassium: 170 }
          },
          spectroscopy: {
            chemometrics: { ndvi: 0.69, ndre: 0.25, leafWaterIndex: 0.81, vitalityScore: 68 }
          },
          environment: { temperature: 31.5, relativeHumidity: 42.0, vpd: 2.1 }
        };
        const res = await request('POST', '/api/ai/analyze', testPayload);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        const pred = res.body.data;
        assert(pred.modelVersion === "AGRI-FUSION-V2.4", "Expected model version AGRI-FUSION-V2.4");
        assert(pred.prescriptions.irrigation.urgency === "CRITICAL", "Compound stress must trigger CRITICAL irrigation urgency");
        assert(pred.prescriptions.irrigation.recommendedMinutes >= 30, "Critical deficit should recommend >= 30 mins");
        assert(pred.prescriptions.fertigation.nitrogenKgAcre > 15, "Low NDRE should trigger Nitrogen prescription");
      }
    },
    {
      name: "GET /api/ai/recommendations - Closed-loop actionable advice with confidence & model version",
      fn: async () => {
        const res = await request('GET', '/api/ai/recommendations');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.modelVersion === "AGRI-FUSION-V2.4", "Model version mismatch");
        assert(Array.isArray(res.body.recommendations), "Expected recommendations array");
        assert(res.body.recommendations.length >= 6, "Expected recommendations for all plots");
        const rec1 = res.body.recommendations[0];
        assert(typeof rec1.confidence === "number", "Confidence score must be numeric");
        assert(rec1.priority !== undefined, "Priority must exist");
        assert(rec1.summary.length > 10, "Summary must be descriptive");
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

  await new Promise(resolve => server.close(resolve));

  console.log("\n====================================================================");
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed (${((passed / (passed + failed)) * 100).toFixed(1)}%)`);
  console.log("====================================================================");

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error("Test runner execution error:", err);
  process.exit(1);
});
