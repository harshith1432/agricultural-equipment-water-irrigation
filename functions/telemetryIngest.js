/**
 * Ingestion handler for FDR soil sensors & hydraulic pressure telemetry.
 * Supports LoRaWAN / MQTT gateway webhooks for real-time sensor updates.
 */
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

exports.ingestMqttTelemetry = onRequest(async (req, res) => {
  // Enforce HTTP POST
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed. Use POST." });
    return;
  }

  // Security Check 1: Ingestion API Key / Gateway Token Authentication
  const providedKey = req.headers["x-telemetry-api-key"] || 
                      req.headers["x-api-key"] || 
                      req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  const expectedKey = process.env.TELEMETRY_API_KEY || "agrispectra-iot-telemetry-secure-key-2026";

  if (!providedKey || providedKey !== expectedKey) {
    res.status(401).json({ error: "Unauthorized: Invalid or missing telemetry gateway API key." });
    return;
  }

  const { farmId, plotId, probeId, vwc, temperature, salinityEc, mainlinePressureBar, sensors } = req.body || {};

  if (!farmId || !plotId) {
    res.status(400).json({ error: "farmId and plotId are required parameters." });
    return;
  }

  try {
    const db = admin.firestore();
    const plotRef = db.collection("farms").doc(farmId).collection("plots").doc(plotId);
    const plotSnap = await plotRef.get();

    if (!plotSnap.exists) {
      res.status(404).json({ error: `Plot ${plotId} not found in farm ${farmId}.` });
      return;
    }

    const plotData = plotSnap.data();
    let currentSensors = Array.isArray(plotData.soilSensors) ? [...plotData.soilSensors] : [];

    // Support both single probe payload and batch sensors payload
    const incomingSensors = Array.isArray(sensors) && sensors.length > 0 
      ? sensors 
      : [{
          probeId: probeId || "probe-default",
          vwc: vwc !== undefined ? Number(vwc) : 25.0,
          temperature: temperature !== undefined ? Number(temperature) : 22.0,
          salinityEc: salinityEc !== undefined ? Number(salinityEc) : 1.2
        }];

    for (const incoming of incomingSensors) {
      const idx = currentSensors.findIndex(s => s.probeId === incoming.probeId);
      const rawVwc = Number(incoming.vwc);
      const rawTemp = Number(incoming.temperature);
      const rawSal = Number(incoming.salinityEc);

      // Clamp values to realistic agronomic sensor limits (prevent overflow / poisoning)
      const clampedVwc = Math.min(Math.max(isNaN(rawVwc) ? 25.0 : rawVwc, 0.0), 100.0);
      const clampedTemp = Math.min(Math.max(isNaN(rawTemp) ? 20.0 : rawTemp, -40.0), 85.0);
      const clampedSal = Math.min(Math.max(isNaN(rawSal) ? 1.2 : rawSal, 0.0), 25.0);

      const sensorObj = {
        probeId: String(incoming.probeId || "probe-default").slice(0, 50),
        vwc: Number(clampedVwc.toFixed(1)),
        temperature: Number(clampedTemp.toFixed(1)),
        salinityEc: Number(clampedSal.toFixed(2)),
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      };

      if (idx >= 0) {
        currentSensors[idx] = { ...currentSensors[idx], ...sensorObj };
      } else {
        currentSensors.push(sensorObj);
      }

      // Record time-series historical reading
      await plotRef.collection("soilReadings").add({
        probeId: incoming.probeId,
        vwc: Number(incoming.vwc) || 0,
        temperature: Number(incoming.temperature) || 20,
        salinityEc: Number(incoming.salinityEc) || 1.2,
        recordedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Calculate updated average plot soil moisture VWC
    const sumVwc = currentSensors.reduce((acc, s) => acc + (Number(s.vwc) || 0), 0);
    const avgVwc = currentSensors.length > 0 ? Number((sumVwc / currentSensors.length).toFixed(1)) : 25.0;

    const updatePayload = {
      soilSensors: currentSensors,
      currentVwc: avgVwc,
      lastTelemetryAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (mainlinePressureBar !== undefined && mainlinePressureBar !== null) {
      updatePayload.mainlinePressureBar = Number(mainlinePressureBar);
    }

    await plotRef.update(updatePayload);

    res.status(200).json({
      success: true,
      message: `Telemetry ingested for plot ${plotId}. ${incomingSensors.length} probe(s) updated.`,
      plotId,
      currentVwc: avgVwc,
      recordedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[TelemetryIngest] Error processing telemetry:", error);
    res.status(500).json({ error: "Internal server error processing telemetry.", details: error.message });
  }
});
