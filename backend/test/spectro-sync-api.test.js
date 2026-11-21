/**
 * AgriSpectra Spectroscopy Synchronization & Idempotency Test Suite
 * Validates Section 9, 10, 3 & 5 requirements:
 *   - Authentication & validation error handling
 *   - Single scan synchronization & cloud verification confirmation
 *   - Idempotency & duplicate prevention (no duplicate records, graceful update)
 *   - High-throughput batch synchronization
 *   - Scans pagination (?limit=..., ?offset=..., ?since=...)
 *   - Detail scan retrieval returning both raw and processed data
 */

import { app } from '../server.js';
import http from 'http';

let server;
const PORT = 5058; // Dedicated port for spectro test suite
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null, customHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const headers = {
      'Content-Type': 'application/json',
      ...customHeaders
    };

    // If caller explicitly passes empty string for auth headers, delete them
    if (customHeaders['Authorization'] === '') delete headers['Authorization'];
    if (customHeaders['X-Enterprise-Secret'] === '') delete headers['X-Enterprise-Secret'];
    if (customHeaders['X-API-Secret'] === '') delete headers['X-API-Secret'];

    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
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
    if (body !== null && body !== undefined) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function authRequest(method, path, body = null, extraHeaders = {}) {
  return request(method, path, body, {
    'Authorization': 'Bearer superadmin-token',
    'X-Enterprise-Secret': 'agrispectra_enterprise_sec_2026_99x',
    ...extraHeaders
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function runTests() {
  console.log("====================================================================");
  console.log("   SPECTROSCOPY SYNC & IDEMPOTENCY ENDPOINT VERIFICATION SUITE       ");
  console.log("====================================================================\n");

  let passed = 0;
  let failed = 0;

  // Start temporary test server
  await new Promise(resolve => {
    server = app.listen(PORT, 'localhost', resolve);
  });

  const testScanId = `scan-mobile-idemp-${Date.now()}`;
  const batchScanId1 = `scan-batch-01-${Date.now()}`;
  const batchScanId2 = `scan-batch-02-${Date.now()}`;

  const validSingleScanPayload = {
    scanId: testScanId,
    specimen: {
      type: "leaf",
      crop: "Roma Tomato",
      cultivar: "Solanum lycopersicum",
      plantNumber: "PLANT-042",
      leafIndex: 3
    },
    location: {
      farmId: "farm-valley-1",
      plotId: "plot-1",
      plotNumber: 1,
      gps: { latitude: 36.6772, longitude: -121.6555 }
    },
    timestamps: {
      scannedAt: new Date(Date.now() - 60000).toISOString(),
      deviceLocalTime: "2026-11-20 14:30:00"
    },
    rawData: {
      wavelengths: [350, 400, 450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1050, 1100],
      intensities: [0.12, 0.15, 0.18, 0.22, 0.35, 0.45, 0.42, 0.28, 0.72, 0.85, 0.84, 0.81, 0.79, 0.75, 0.72, 0.68],
      integrationTimeMs: 40
    },
    processedData: {
      ndvi: 0.82,
      ndre: 0.38,
      leafWaterIndex: 0.91,
      cire: 2.65,
      vitalityScore: 92,
      nitrogenPrescriptionKg: 0.0,
      irrigationCountdownHours: 48,
      diseaseRisk: "HEALTHY_OPTIMAL"
    }
  };

  const testCases = [
    // -------------------------------------------------------------------------
    // 1. AUTHENTICATION DEFENSE TESTS
    // -------------------------------------------------------------------------
    {
      name: "SECURITY PROBE - Unauthenticated request to /api/spectroscopy/sync returns 401 Unauthorized",
      fn: async () => {
        const res = await request('POST', '/api/spectroscopy/sync', validSingleScanPayload, {
          'Authorization': '',
          'X-Enterprise-Secret': '',
          'X-API-Secret': ''
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assert(res.body.success === false, "Success must be false on unauthenticated access");
      }
    },
    {
      name: "SECURITY PROBE - Invalid Bearer token returns 401 Unauthorized",
      fn: async () => {
        const res = await request('POST', '/api/spectroscopy/sync', validSingleScanPayload, {
          'Authorization': 'Bearer bad-invalid-expired-token-999'
        });
        assert(res.status === 401, `Expected 401, got ${res.status}`);
        assert(res.body.success === false, "Success must be false on invalid token");
      }
    },
    {
      name: "SECURITY PROBE - Valid X-API-Secret authenticates successfully",
      fn: async () => {
        const res = await request('GET', '/api/spectroscopy/scans', null, {
          'X-API-Secret': 'agrispectra_enterprise_sec_2026_99x'
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Must authenticate with X-API-Secret");
      }
    },
    {
      name: "SECURITY PROBE - Valid User ID Token (Bearer) authenticates successfully",
      fn: async () => {
        const res = await request('GET', '/api/spectroscopy/scans', null, {
          'Authorization': 'Bearer valid-user-id-token'
        });
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Must authenticate with user ID token");
      }
    },

    // -------------------------------------------------------------------------
    // 2. VALIDATION ERROR HANDLING TESTS
    // -------------------------------------------------------------------------
    {
      name: "VALIDATION - Empty sync payload returns 400 Bad Request",
      fn: async () => {
        const res = await authRequest('POST', '/api/spectroscopy/sync', {});
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.success === false, "Success should be false on empty payload");
      }
    },
    {
      name: "VALIDATION - Missing scanId in sync payload returns 400 Bad Request",
      fn: async () => {
        const invalidPayload = { ...validSingleScanPayload };
        delete invalidPayload.scanId;
        const res = await authRequest('POST', '/api/spectroscopy/sync', invalidPayload);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.error.includes("scanId"), `Error message should mention scanId, got: ${res.body.error}`);
      }
    },
    {
      name: "VALIDATION - Missing specimen metadata returns 400 Bad Request",
      fn: async () => {
        const invalidPayload = { ...validSingleScanPayload, scanId: "scan-err-01" };
        delete invalidPayload.specimen;
        delete invalidPayload.crop;
        const res = await authRequest('POST', '/api/spectroscopy/sync', invalidPayload);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.error.includes("specimen"), `Error message should mention specimen, got: ${res.body.error}`);
      }
    },
    {
      name: "VALIDATION - Missing location metadata returns 400 Bad Request",
      fn: async () => {
        const invalidPayload = { ...validSingleScanPayload, scanId: "scan-err-02" };
        delete invalidPayload.location;
        delete invalidPayload.plotId;
        const res = await authRequest('POST', '/api/spectroscopy/sync', invalidPayload);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.error.includes("location"), `Error message should mention location, got: ${res.body.error}`);
      }
    },
    {
      name: "VALIDATION - Missing timestamps returns 400 Bad Request",
      fn: async () => {
        const invalidPayload = { ...validSingleScanPayload, scanId: "scan-err-03" };
        delete invalidPayload.timestamps;
        delete invalidPayload.timestamp;
        const res = await authRequest('POST', '/api/spectroscopy/sync', invalidPayload);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.error.includes("timestamps"), `Error message should mention timestamps, got: ${res.body.error}`);
      }
    },
    {
      name: "VALIDATION - Missing rawData returns 400 Bad Request",
      fn: async () => {
        const invalidPayload = { ...validSingleScanPayload, scanId: "scan-err-04" };
        delete invalidPayload.rawData;
        delete invalidPayload.rawReflectance;
        const res = await authRequest('POST', '/api/spectroscopy/sync', invalidPayload);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.error.includes("rawData"), `Error message should mention rawData, got: ${res.body.error}`);
      }
    },
    {
      name: "VALIDATION - Missing processedData returns 400 Bad Request",
      fn: async () => {
        const invalidPayload = { ...validSingleScanPayload, scanId: "scan-err-05" };
        delete invalidPayload.processedData;
        delete invalidPayload.chemometrics;
        delete invalidPayload.indices;
        const res = await authRequest('POST', '/api/spectroscopy/sync', invalidPayload);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
        assert(res.body.error.includes("processedData"), `Error message should mention processedData, got: ${res.body.error}`);
      }
    },
    {
      name: "VALIDATION - Empty batch array [] returns 400 Bad Request",
      fn: async () => {
        const res = await authRequest('POST', '/api/spectroscopy/sync', []);
        assert(res.status === 400, `Expected 400, got ${res.status}`);
      }
    },

    // -------------------------------------------------------------------------
    // 3. SINGLE SCAN SYNC & VERIFICATION CONFIRMATION
    // -------------------------------------------------------------------------
    {
      name: "POST /api/spectroscopy/sync - Synchronizes single scan with verified Cloud Firestore confirmation",
      fn: async () => {
        const res = await authRequest('POST', '/api/spectroscopy/sync', validSingleScanPayload);
        assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
        assert(res.body.success === true, "Response success must be true");
        assert(res.body.scanId === testScanId, `Expected scanId ${testScanId}, got ${res.body.scanId}`);
        assert(
          res.body.cloudDocumentId === `farms/farm-valley-1/spectralScans/${testScanId}`,
          `Expected cloudDocumentId farms/farm-valley-1/spectralScans/${testScanId}, got ${res.body.cloudDocumentId}`
        );
        assert(Boolean(res.body.syncedAt), "syncedAt timestamp must be returned");
        assert(res.body.isDuplicate === false, "isDuplicate must be false for initial sync");
        assert(res.body.status === 'created', "status must be 'created'");
      }
    },

    // -------------------------------------------------------------------------
    // 4. DUPLICATE PREVENTION & IDEMPOTENCY
    // -------------------------------------------------------------------------
    {
      name: "IDEMPOTENCY - Re-syncing existing scanId updates/confirms without creating duplicates or erroring out",
      fn: async () => {
        const updatedPayload = {
          ...validSingleScanPayload,
          processedData: {
            ...validSingleScanPayload.processedData,
            vitalityScore: 95 // updated score
          }
        };

        const res = await authRequest('POST', '/api/spectroscopy/sync', updatedPayload);
        assert(res.status === 200, `Expected 200 OK for duplicate sync, got ${res.status}`);
        assert(res.body.success === true, "Duplicate sync should succeed");
        assert(res.body.scanId === testScanId, "scanId must match");
        assert(res.body.cloudDocumentId === `farms/farm-valley-1/spectralScans/${testScanId}`, "cloudDocumentId must match");
        assert(res.body.isDuplicate === true, "isDuplicate must be true");
        assert(res.body.status === 'updated', "status must be 'updated'");
        assert(res.body.data.processedData.vitalityScore === 95, "Updated vitality score should be persisted");
      }
    },

    // -------------------------------------------------------------------------
    // 5. BATCH SYNCHRONIZATION ENDPOINT
    // -------------------------------------------------------------------------
    {
      name: "POST /api/spectroscopy/sync - Batch synchronizes multiple mobile scans with idempotency",
      fn: async () => {
        const batchPayload = [
          {
            scanId: batchScanId1,
            specimen: { crop: "Sweet Corn", plantNumber: "PLANT-C01" },
            location: { farmId: "farm-valley-1", plotId: "plot-2" },
            timestamps: { scannedAt: new Date().toISOString() },
            rawData: { intensities: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] },
            processedData: { ndvi: 0.77, ndre: 0.31, vitalityScore: 84 }
          },
          {
            scanId: batchScanId2,
            specimen: { crop: "Sweet Corn", plantNumber: "PLANT-C02" },
            location: { farmId: "farm-valley-1", plotId: "plot-2" },
            timestamps: { scannedAt: new Date().toISOString() },
            rawData: { intensities: [0.12, 0.22, 0.32, 0.42, 0.52, 0.62] },
            processedData: { ndvi: 0.79, ndre: 0.33, vitalityScore: 88 }
          },
          // Include the first scan again to test idempotency within batch
          {
            scanId: testScanId,
            specimen: { crop: "Roma Tomato", plantNumber: "PLANT-042" },
            location: { farmId: "farm-valley-1", plotId: "plot-1" },
            timestamps: { scannedAt: new Date().toISOString() },
            rawData: { intensities: [0.15, 0.25, 0.35, 0.45, 0.55, 0.65] },
            processedData: { ndvi: 0.82, ndre: 0.38, vitalityScore: 92 }
          }
        ];

        const res = await authRequest('POST', '/api/spectroscopy/sync', batchPayload);
        assert(res.status === 200, `Expected 200 OK, got ${res.status}`);
        assert(res.body.success === true, "Batch sync should succeed");
        assert(res.body.syncedCount === 3, `Expected syncedCount 3, got ${res.body.syncedCount}`);
        assert(Array.isArray(res.body.results), "Expected results array");
        assert(res.body.results.length === 3, "Expected 3 confirmation objects");

        // First 2 should be newly created
        const item1 = res.body.results.find(r => r.scanId === batchScanId1);
        const item2 = res.body.results.find(r => r.scanId === batchScanId2);
        const item3 = res.body.results.find(r => r.scanId === testScanId);

        assert(item1 && item1.cloudDocumentId === `farms/farm-valley-1/spectralScans/${batchScanId1}`, "Item 1 cloud ID mismatch");
        assert(item1.isDuplicate === false, "Item 1 should not be duplicate");

        assert(item2 && item2.cloudDocumentId === `farms/farm-valley-1/spectralScans/${batchScanId2}`, "Item 2 cloud ID mismatch");
        assert(item2.isDuplicate === false, "Item 2 should not be duplicate");

        assert(item3 && item3.isDuplicate === true, "Item 3 must be detected as duplicate");
        assert(item3.status === 'updated', "Item 3 status must be updated");
      }
    },

    // -------------------------------------------------------------------------
    // 6. QUERY & PAGINATION TESTS
    // -------------------------------------------------------------------------
    {
      name: "GET /api/spectroscopy/scans - Returns paginated spectral scans (?limit=2&offset=0)",
      fn: async () => {
        const res = await authRequest('GET', '/api/spectroscopy/scans?limit=2&offset=0');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Response should be success");
        assert(res.body.count === 2, `Expected count 2, got ${res.body.count}`);
        assert(res.body.limit === 2, `Expected limit 2, got ${res.body.limit}`);
        assert(res.body.offset === 0, `Expected offset 0, got ${res.body.offset}`);
        assert(res.body.totalAvailable >= 3, `totalAvailable should be >= 3, got ${res.body.totalAvailable}`);
        assert(res.body.hasMore === true, "hasMore should be true when more items exist");
      }
    },
    {
      name: "GET /api/spectroscopy/scans - Returns next page of scans (?limit=2&offset=2)",
      fn: async () => {
        const res = await authRequest('GET', '/api/spectroscopy/scans?limit=2&offset=2');
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.offset === 2, `Expected offset 2, got ${res.body.offset}`);
        assert(Array.isArray(res.body.data), "data must be an array");
      }
    },
    {
      name: "GET /api/spectroscopy/scans - Filters by 'since' timestamp (?since=...)",
      fn: async () => {
        const pastIso = new Date(Date.now() - 3600000).toISOString();
        const res = await authRequest('GET', `/api/spectroscopy/scans?since=${encodeURIComponent(pastIso)}`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(Array.isArray(res.body.data), "data must be an array");
      }
    },

    // -------------------------------------------------------------------------
    // 7. GET /api/spectroscopy/scans/:scanId (RAW & PROCESSED DATA)
    // -------------------------------------------------------------------------
    {
      name: "GET /api/spectroscopy/scans/:scanId - Returns both raw and processed data",
      fn: async () => {
        const res = await authRequest('GET', `/api/spectroscopy/scans/${testScanId}`);
        assert(res.status === 200, `Expected 200, got ${res.status}`);
        assert(res.body.success === true, "Response should be successful");
        const doc = res.body.data;
        assert(doc.scanId === testScanId, `Expected scanId ${testScanId}, got ${doc.scanId}`);

        // Verify RAW data
        assert(doc.rawData !== undefined, "rawData must be populated");
        assert(Array.isArray(doc.rawData.intensities) || Array.isArray(doc.rawReflectance), "rawData intensities/reflectance must be array");
        assert(doc.rawData.intensities.length > 0, "rawData intensities cannot be empty");

        // Verify PROCESSED data
        assert(doc.processedData !== undefined, "processedData must be populated");
        assert(doc.processedData.ndvi > 0, "processedData.ndvi must be > 0");
        assert(doc.processedData.vitalityScore !== undefined, "processedData.vitalityScore must exist");
        assert(doc.chemometrics !== undefined, "chemometrics must exist for compatibility");

        // Verify SPECIMEN & LOCATION
        assert(doc.specimen !== undefined, "specimen metadata must exist");
        assert(doc.location !== undefined, "location metadata must exist");
      }
    },
    {
      name: "GET /api/spectroscopy/scans/:scanId - Non-existent scan returns 404 Not Found",
      fn: async () => {
        const res = await authRequest('GET', '/api/spectroscopy/scans/non-existent-scan-id-xyz');
        assert(res.status === 404, `Expected 404, got ${res.status}`);
        assert(res.body.success === false, "Success should be false for 404");
      }
    },

    // -------------------------------------------------------------------------
    // 8. UPDATE POST /api/spectroscopy/scans COMPATIBILITY & IDEMPOTENCY
    // -------------------------------------------------------------------------
    {
      name: "POST /api/spectroscopy/scans - Returns explicit verification confirmation",
      fn: async () => {
        const singleScanId = `scan-post-scans-${Date.now()}`;
        const payload = {
          scanId: singleScanId,
          plotId: "plot-1",
          crop: "Nonpareil Almond",
          connectionMode: "BLUETOOTH_BLE",
          chemometrics: {
            ndvi: 0.85,
            ndre: 0.36,
            leafWaterIndex: 0.93,
            vitalityScore: 90
          }
        };

        const res = await authRequest('POST', '/api/spectroscopy/scans', payload);
        assert(res.status === 201, `Expected 201 Created, got ${res.status}`);
        assert(res.body.success === true, "Success should be true");
        assert(res.body.scanId === singleScanId, "scanId must match");
        assert(res.body.cloudDocumentId === `farms/farm-valley-1/spectralScans/${singleScanId}`, "cloudDocumentId must match");
        assert(Boolean(res.body.syncedAt), "syncedAt must be returned");
        assert(res.body.data.source === "BLUETOOTH_BLE", "Source should be BLUETOOTH_BLE");

        // Re-post to verify duplicate prevention
        const dupRes = await authRequest('POST', '/api/spectroscopy/scans', payload);
        assert(dupRes.status === 200, `Expected 200 on duplicate re-post, got ${dupRes.status}`);
        assert(dupRes.body.isDuplicate === true, "isDuplicate must be true");
      }
    }
  ];

  for (const tc of testCases) {
    try {
      await tc.fn();
      console.log(`  ✔ [PASS] ${tc.name}`);
      passed++;
    } catch (err) {
      console.error(`  ✖ [FAIL] ${tc.name}`);
      console.error(`     Reason: ${err.message}`);
      failed++;
    }
  }

  console.log("\n====================================================================");
  console.log(` RESULTS: ${passed} Passed, ${failed} Failed (${(passed / (passed + failed) * 100).toFixed(1)}%)`);
  console.log("====================================================================");

  if (server) {
    server.close();
  }

  if (failed > 0) {
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch(err => {
  console.error("Test execution failed:", err);
  if (server) server.close();
  process.exit(1);
});