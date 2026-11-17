/**
 * Closed-Loop Leaf-to-Valve Synergy Engine
 * Evaluates newly created leaf spectroscopy scans against real-time FDR soil moisture
 * to generate actionable Smart Irrigation Recommendations with enterprise resiliency.
 */
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");

exports.onLeafScanCreated = onDocumentCreated("farms/{farmId}/leafScans/{scanId}", async (event) => {
  const db = admin.firestore();
  const snapshot = event.data;
  if (!snapshot) return;

  const scan = snapshot.data();
  const { farmId, scanId } = event.params;
  const plotId = scan.plotId; // e.g., "plot-2"

  if (!plotId) {
    console.log(`[ClosedLoop] Scan ${scanId} missing plotId, skipping.`);
    return;
  }

  // Fetch Plot details and current soil moisture
  const plotRef = db.collection("farms").doc(farmId).collection("plots").doc(plotId);
  const plotSnap = await plotRef.get();

  if (!plotSnap.exists) {
    console.log(`[ClosedLoop] Plot ${plotId} not found in farm ${farmId}.`);
    return;
  }

  const plotData = plotSnap.data();
  const targetVwcMin = Number(plotData.targetVwcMin) || 20.0;
  
  // Calculate average current soil VWC from FDR sensors or plot field
  let currentVwc = 25.0; // default safe value
  if (Array.isArray(plotData.soilSensors) && plotData.soilSensors.length > 0) {
    const sum = plotData.soilSensors.reduce((acc, sensor) => acc + (Number(sensor.vwc) || 0), 0);
    currentVwc = Number((sum / plotData.soilSensors.length).toFixed(1));
  } else if (plotData.currentVwc !== undefined && plotData.currentVwc !== null) {
    currentVwc = Number(plotData.currentVwc);
  }

  // Support both flat fields and nested indices
  const vitalityScore = Number(scan.vitalityScore) ?? 100;
  const leafWaterIndex = Number(scan.leafWaterIndex ?? scan.indices?.leafWaterIndex ?? 1.0);
  const valveState = plotData.valve?.state || "CLOSED";

  console.log(`[ClosedLoop] Scan evaluation for Plot ${plotId}: Vitality=${vitalityScore}, LWI=${leafWaterIndex}, Soil VWC=${currentVwc}% (Min: ${targetVwcMin}%), Valve=${valveState}`);

  // Enterprise Synergy Logic:
  // Water stress indicated if Leaf Water Index < 0.88 or Vitality < 60%
  const isLeafWaterStressed = leafWaterIndex < 0.88 || vitalityScore < 60;
  const isSoilDeficit = currentVwc <= targetVwcMin;

  if (isLeafWaterStressed && isSoilDeficit && valveState !== "OPEN") {
    // Check if an unresolved recommendation already exists for this plot to prevent spamming
    const existingRecs = await db.collection("farms").doc(farmId)
      .collection("actionRecommendations")
      .where("plotId", "==", plotId)
      .where("status", "==", "PENDING")
      .limit(1)
      .get();

    if (!existingRecs.empty) {
      console.log(`[ClosedLoop] Active PENDING recommendation already exists for Plot ${plotId}. Skipping duplicate creation.`);
      return;
    }

    // Adaptive duration calculation based on severity of deficit
    const deficitDelta = targetVwcMin - currentVwc;
    const recommendedMinutes = deficitDelta > 6 ? 35 : (deficitDelta > 3 ? 30 : 25);
    const gateId = plotData.valve?.id || `G${plotData.plotNumber || "1"}`;

    const recRef = db.collection("farms").doc(farmId).collection("actionRecommendations").doc();

    const recommendation = {
      recId: recRef.id,
      plotId: plotId,
      plotNumber: plotData.plotNumber || 1,
      crop: plotData.crop || plotData.cropName || "Unknown Crop",
      gateId: gateId,
      triggerReason: `Plot ${plotData.plotNumber || plotId} leaf stress (LWI ${leafWaterIndex.toFixed(2)}, Vitality ${vitalityScore}%) confirmed by ${currentVwc}% FDR soil moisture (Target: >${targetVwcMin}%).`,
      suggestedAction: "OPEN",
      suggestedDurationMinutes: recommendedMinutes,
      status: "PENDING", // PENDING -> APPROVED | DISMISSED | EXECUTED
      nitrogenPrescriptionKg: Number(scan.nitrogenPrescriptionKg || scan.nitrogen_prescription_kg_per_acre || 0),
      diseaseAlert: scan.diseaseRisk || scan.pathogenName || scan.pathogen_name || null,
      currentVwc: currentVwc,
      targetVwcMin: targetVwcMin,
      vitalityScore: vitalityScore,
      leafWaterIndex: leafWaterIndex,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      leafScanId: scanId
    };

    await recRef.set(recommendation);
    console.log(`[ClosedLoop] Successfully created Smart Action Recommendation ${recRef.id} for Plot ${plotId}`);
  } else {
    console.log(`[ClosedLoop] No irrigation trigger needed. Stressed=${isLeafWaterStressed}, SoilDeficit=${isSoilDeficit}, Valve=${valveState}`);
  }
});
