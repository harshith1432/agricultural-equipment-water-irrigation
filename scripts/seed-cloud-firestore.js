/**
 * Direct Cloud Firestore Seeder via Google Cloud ADC
 * Writes Farm, Plots (1-6), Probes, Leaf Scans, and Logs directly to:
 * projects/water-irrigation-system-8aeeb/databases/(default)
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = "water-irrigation-system-8aeeb";
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

console.log("====================================================================");
console.log(` Direct Cloud Firestore Seeder: ${PROJECT_ID}`);
console.log("====================================================================");

// 1. Obtain access token
console.log("[1/4] Acquiring Google Cloud access token...");
let token = "";
try {
  token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
} catch (e) {
  console.error("Failed to get gcloud token:", e.message);
  process.exit(1);
}

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Helper to convert plain JS object to Firestore REST v1 Value format
function toFirestoreValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(toFirestoreValue)
      }
    };
  }
  if (typeof val === 'object') {
    // GeoPoint check
    if ('latitude' in val && 'longitude' in val && Object.keys(val).length === 2) {
      return {
        geoPointValue: {
          latitude: Number(val.latitude),
          longitude: Number(val.longitude)
        }
      };
    }
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    fields[k] = toFirestoreValue(v);
  }
  return { fields };
}

async function writeDoc(docPath, data) {
  const url = `${BASE_URL}/${docPath}`;
  const body = JSON.stringify(toFirestoreFields(data));

  const res = await fetch(url, {
    method: 'PATCH',
    headers,
    body
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Write to ${docPath} failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

async function seed() {
  console.log("[2/4] Seeding Root Farm Document...");
  await writeDoc('farms/farm-valley-1', {
    name: "AgriSpectra Precision Block A (1-Acre High-Density)",
    totalArea: "1.00 Acre (6 Zones)",
    location: { latitude: 36.7783, longitude: -119.4179 },
    createdAt: new Date().toISOString(),
    ownerId: "system-admin-harshith"
  });
  console.log("  ✔ Seeded farms/farm-valley-1");

  console.log("[3/4] Seeding 6 Agronomic Plots (Gates G1-G6 & 18 FDR Probes)...");
  const plots = [
    {
      plotNumber: 1,
      crop: "Bell Peppers",
      stage: "Fruit Formation",
      targetVwcMin: 22.0,
      targetVwcMax: 35.0,
      valve: { id: "G1", state: "CLOSED", flowRate: 450.0, timerEnd: null },
      soilSensors: [
        { probeId: "S1_10cm", depthCm: 10, vwc: 26.4, temperature: 23.2, salinityEc: 1.2, lastUpdated: new Date().toISOString() },
        { probeId: "S1_30cm", depthCm: 30, vwc: 29.1, temperature: 21.8, salinityEc: 1.1, lastUpdated: new Date().toISOString() },
        { probeId: "S1_50cm", depthCm: 50, vwc: 31.5, temperature: 20.4, salinityEc: 0.9, lastUpdated: new Date().toISOString() }
      ]
    },
    {
      plotNumber: 2,
      crop: "Heirloom Drip Tomatoes",
      stage: "Fruit Sizing & Ripening",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      valve: { id: "G2", state: "CLOSED", flowRate: 520.0, timerEnd: null },
      soilSensors: [
        { probeId: "S2_10cm", depthCm: 10, vwc: 13.8, temperature: 27.8, salinityEc: 1.8, lastUpdated: new Date().toISOString() }, // LOW WATER DEFICIT
        { probeId: "S2_30cm", depthCm: 30, vwc: 17.2, temperature: 25.1, salinityEc: 1.6, lastUpdated: new Date().toISOString() },
        { probeId: "S2_50cm", depthCm: 50, vwc: 22.0, temperature: 22.0, salinityEc: 1.3, lastUpdated: new Date().toISOString() }
      ]
    },
    {
      plotNumber: 3,
      crop: "Sweet Corn",
      stage: "Tasseling & Silking",
      targetVwcMin: 24.0,
      targetVwcMax: 38.0,
      valve: { id: "G3", state: "CLOSED", flowRate: 610.0, timerEnd: null },
      soilSensors: [
        { probeId: "S3_10cm", depthCm: 10, vwc: 31.2, temperature: 22.5, salinityEc: 1.0, lastUpdated: new Date().toISOString() },
        { probeId: "S3_30cm", depthCm: 30, vwc: 34.0, temperature: 21.0, salinityEc: 0.9, lastUpdated: new Date().toISOString() },
        { probeId: "S3_50cm", depthCm: 50, vwc: 36.5, temperature: 19.8, salinityEc: 0.8, lastUpdated: new Date().toISOString() }
      ]
    },
    {
      plotNumber: 4,
      crop: "High-Density Strawberries",
      stage: "Vegetative / Foliar Bloom",
      targetVwcMin: 18.0,
      targetVwcMax: 30.0,
      valve: { id: "G4", state: "CLOSED", flowRate: 380.0, timerEnd: null },
      soilSensors: [
        { probeId: "S4_10cm", depthCm: 10, vwc: 21.5, temperature: 24.2, salinityEc: 1.4, lastUpdated: new Date().toISOString() },
        { probeId: "S4_30cm", depthCm: 30, vwc: 24.8, temperature: 22.3, salinityEc: 1.3, lastUpdated: new Date().toISOString() },
        { probeId: "S4_50cm", depthCm: 50, vwc: 27.0, temperature: 21.1, salinityEc: 1.1, lastUpdated: new Date().toISOString() }
      ]
    },
    {
      plotNumber: 5,
      crop: "Organic Leafy Greens",
      stage: "Head Expansion",
      targetVwcMin: 25.0,
      targetVwcMax: 40.0,
      valve: { id: "G5", state: "CLOSED", flowRate: 400.0, timerEnd: null },
      soilSensors: [
        { probeId: "S5_10cm", depthCm: 10, vwc: 28.0, temperature: 21.9, salinityEc: 0.9, lastUpdated: new Date().toISOString() },
        { probeId: "S5_30cm", depthCm: 30, vwc: 32.5, temperature: 20.8, salinityEc: 0.8, lastUpdated: new Date().toISOString() },
        { probeId: "S5_50cm", depthCm: 50, vwc: 35.0, temperature: 19.5, salinityEc: 0.7, lastUpdated: new Date().toISOString() }
      ]
    },
    {
      plotNumber: 6,
      crop: "Citrus Saplings Nursery",
      stage: "Active Root Establishment",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      valve: { id: "G6", state: "CLOSED", flowRate: 340.0, timerEnd: null },
      soilSensors: [
        { probeId: "S6_10cm", depthCm: 10, vwc: 25.1, temperature: 23.8, salinityEc: 1.1, lastUpdated: new Date().toISOString() },
        { probeId: "S6_30cm", depthCm: 30, vwc: 27.4, temperature: 22.0, salinityEc: 1.0, lastUpdated: new Date().toISOString() },
        { probeId: "S6_50cm", depthCm: 50, vwc: 29.8, temperature: 20.7, salinityEc: 0.9, lastUpdated: new Date().toISOString() }
      ]
    }
  ];

  for (let i = 0; i < plots.length; i++) {
    const plotId = `plot-${i + 1}`;
    await writeDoc(`farms/farm-valley-1/plots/${plotId}`, plots[i]);
    console.log(`  ✔ Seeded Plot ${i + 1}: ${plots[i].crop} (${plots[i].valve.id})`);
  }

  console.log("[4/4] Seeding Initial Leaf Scans, Irrigation Ledger, and Synergy Action Cards...");
  await writeDoc('farms/farm-valley-1/leafScans/scan-init-plot2', {
    plotId: "plot-2",
    crop: "Heirloom Drip Tomatoes",
    scannedAt: new Date().toISOString(),
    vitalityScore: 54,
    leafWaterIndex: 0.62,
    nitrogenPrescriptionKg: 14.5,
    diseaseRisk: {
      pathogen: "Early Powdery Mildew (Erysiphe cichoracearum)",
      confidence: 84,
      preventativeAction: "Apply Potassium Bicarbonate or Bacillus subtilis foliar spray within 24h."
    },
    rawSpectrumPreview: [0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.42, 0.48, 0.52, 0.55]
  });
  console.log("  ✔ Seeded leafScans/scan-init-plot2");

  await writeDoc('farms/farm-valley-1/irrigationLogs/log-init-01', {
    plotId: "plot-1",
    valveId: "G1",
    action: "CLOSE",
    durationMinutes: 15.0,
    litersDelivered: 112.5,
    triggeredBy: "MANUAL",
    timestamp: new Date().toISOString()
  });
  console.log("  ✔ Seeded irrigationLogs/log-init-01 (ACID append-only log)");

  await writeDoc('farms/farm-valley-1/actionRecommendations/rec-plot2-urgent-01', {
    plotId: "plot-2",
    plotNumber: 2,
    crop: "Heirloom Drip Tomatoes",
    gateId: "G2",
    triggerReason: "Plot 2 leaf stress (LWI 0.62, Vitality 54%) confirmed by 13.8% FDR soil moisture (Target: >20.0%).",
    suggestedAction: "OPEN",
    suggestedDurationMinutes: 25,
    status: "PENDING",
    nitrogenPrescriptionKg: 14.5,
    generatedAt: new Date().toISOString(),
    leafScanId: "scan-init-plot2"
  });
  console.log("  ✔ Seeded actionRecommendations/rec-plot2-urgent-01");

  console.log("\n====================================================================");
  console.log(" 🎉 ALL COLLECTIONS SUCCESSFULLY SEEDED INTO LIVE CLOUD FIRESTORE!");
  console.log(` Database: projects/${PROJECT_ID}/databases/(default)`);
  console.log("====================================================================");
}

seed().catch(err => {
  console.error("Seeding error:", err);
  process.exit(1);
});
