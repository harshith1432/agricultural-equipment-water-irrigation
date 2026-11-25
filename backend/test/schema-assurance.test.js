/**
 * AgriSpectra Schema Assurance & Dynamic Table Auto-Creation Test Suite
 * 
 * Verifies that:
 * 1. On backend startup, the engine checks for database and all collections/tables.
 * 2. If a table does not exist, it automatically creates it with default schema.
 * 3. Incoming user data is properly filled / merged whether table is fresh or pre-existing.
 * 4. User registration, telemetry sync, valve actuation, and soil scans populate their respective tables.
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import { app } from '../server.js';
import { schemaManager } from '../services/schemaManager.js';
import { firestoreClient } from '../services/firestoreClient.js';
import { enterpriseStore } from '../services/enterpriseStore.js';

let server;
const PORT = 5057;
const BASE_URL = `http://localhost:${PORT}`;

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
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

describe('Database Schema Assurance & Auto-Provisioning Engine', () => {

  before(async () => {
    // Run schema manager check
    await schemaManager.ensureSchemaAndCollections();

    await new Promise((resolve) => {
      server = app.listen(PORT, '127.0.0.1', resolve);
    });
  });

  after((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  it('1. Verifies that all 6 required tables/collections exist or are created', async () => {
    await firestoreClient.ensureReady();
    const collections = await firestoreClient.listCollections();

    const expectedCollections = ['farms', 'users', 'telemetry_logs', 'irrigation_logs', 'soil_scans', 'audit_logs'];
    for (const ec of expectedCollections) {
      assert.ok(
        collections.includes(ec) || schemaManager.verifiedTables.has(ec),
        `Collection '${ec}' must be verified and present in database`
      );
    }
  });

  it('2. Automatically creates an unrecognised/dynamic table and fills user data', async () => {
    const dynamicTable = `test_dynamic_table_${Date.now()}`;
    const docId = 'record_user_01';
    const payload = {
      sensorType: 'SPECTRO_CANOPY',
      operator: 'Field Tester',
      sampleValue: 42.8
    };

    const result = await schemaManager.saveUserData(dynamicTable, docId, payload, { merge: true });
    assert.equal(result.success, true);
    assert.equal(result.docPath, `${dynamicTable}/${docId}`);
    assert.equal(result.data.sensorType, 'SPECTRO_CANOPY');
    assert.ok(result.data.updatedAt, 'Must attach updatedAt timestamp');
  });

  it('3. Successfully registers new user via POST /api/auth/register and fills users table', async () => {
    const testEmail = `operator_${Date.now()}@agrispectra.test`;
    const testCredential = process.env.TEST_USER_SECRET || ('Secured_' + Date.now() + '!');
    const res = await makeRequest('POST', '/api/auth/register', {
      email: testEmail,
      password: testCredential,
      displayName: 'Test Operator Alpha',
      role: 'Field Technician',
      farmId: 'farm-valley-1'
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.email, testEmail);
    assert.equal(res.body.user.role, 'field_operator');

    // Verify user is in enterpriseStore.users
    const memoryUser = enterpriseStore.users.find(u => u.email === testEmail);
    assert.ok(memoryUser, 'User must be present in backend runtime memory');
  });

  it('4. Successfully synchronizes user profile via POST /api/auth/sync-user', async () => {
    const syncUid = `uid_sync_${Date.now()}`;
    const syncEmail = `synced_${Date.now()}@agrispectra.test`;

    const res = await makeRequest('POST', '/api/auth/sync-user', {
      uid: syncUid,
      email: syncEmail,
      displayName: 'Synced Agronomist',
      role: 'Agronomist',
      farmId: 'farm-valley-1',
      farmName: 'AgriSpectra Precision Block A (1-Acre High-Density)'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.user.uid, syncUid);
    assert.equal(res.body.user.displayName, 'Synced Agronomist');
  });

  it('5. Retrieves registered users list via GET /api/auth/users', async () => {
    const res = await makeRequest('GET', '/api/auth/users');

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.ok(res.body.count >= 4, 'Must return at least default operators');
    assert.ok(Array.isArray(res.body.users));
  });

  it('6. Ingests IoT telemetry via POST /api/telemetry/sync and updates plot moisture', async () => {
    const res = await makeRequest('POST', '/api/telemetry/sync', {
      plotId: 'plot-2',
      farmId: 'farm-valley-1',
      soilMoisture: 31.4,
      soilTemp: 22.8,
      ec: 1.38,
      batteryLevel: 97
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);

    // Verify plot-2 moisture updated in memory store
    const plot = enterpriseStore.plots.find(p => p.id === 'plot-2');
    assert.ok(plot);
    assert.equal(plot.currentMoisturePercent, 31.4);
  });

  it('7. Actuates valve via POST /api/irrigation/valves/:id/on and updates actuation records', async () => {
    const res = await makeRequest('POST', '/api/irrigation/valves/valve-plot-1/on', {
      durationMinutes: 15,
      operator: 'Unit Test Suite'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.state, 'OPEN');
  });

  it('8. Ingests LABART 8-in-1 Modbus soil scan via POST /api/soil/scans and populates table', async () => {
    const res = await makeRequest('POST', '/api/soil/scans', {
      plotId: 'plot-3',
      farmId: 'farm-valley-1',
      depthCm: 15,
      sourceMode: 'WIFI_CLOUD',
      measurements: {
        nitrogen: 135,
        phosphorus: 50,
        potassium: 230,
        ph: 6.7,
        moisture: 30.5,
        ec: 1510,
        temperature: 22.1
      }
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.measurements.nitrogen, 135);
  });

  it('9. Ingests 76-band specimen spectral scan via POST /api/spectral/scans and populates spectral_scans table', async () => {
    const raw76 = Array.from({ length: 76 }, (_, i) => Number((0.05 + 0.6 * Math.sin((i / 75) * Math.PI)).toFixed(4)));
    const res = await makeRequest('POST', '/api/spectral/scans', {
      id: `scan-${Date.now()}-test`,
      plantNumber: "PLANT-042",
      portNumber: "PORT-08",
      plantName: "Roma Tomato",
      plotId: "plot-1",
      plotNumber: 1,
      crop: "tomato",
      calibrationRef: {
        darkCurrent: 0.012,
        whiteReference: 0.985,
        calibratedAt: new Date().toISOString()
      },
      rawReflectance: raw76,
      indices: {
        ndvi: 0.78,
        ndre: 0.35,
        wbi: 0.92,
        cire: 2.15,
        vitality: 88,
        lwi: 0.94
      },
      nitrogenPrescriptionKg: 0.0,
      irrigationNeedHours: 36,
      diseaseRisk: "HEALTHY_OPTIMAL",
      hardwareLink: "BLE_NUS"
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.plantNumber, "PLANT-042");
    assert.equal(res.body.data.portNumber, "PORT-08");
    assert.equal(res.body.data.rawReflectance.length, 76);
    assert.equal(res.body.data.indices.ndvi, 0.78);
    assert.equal(res.body.data.hardwareLink, "BLE_NUS");
    assert.ok(res.body.data.timestamp);
  });
});
