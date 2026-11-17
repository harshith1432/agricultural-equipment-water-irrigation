/**
 * Valve Controller & Solenoid Actuator Manager
 * Handles +12V pulse to open, -12V reverse pulse to close, countdown timers,
 * water volume ledger accounting, emergency kill-switches, and offline scheduled failsafes.
 */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

/**
 * Actuate a specific valve (Gate G1 to G6)
 * Supports OPEN (+12V pulse with countdown timer) and CLOSE (-12V reverse pulse with water volume accounting)
 */
exports.actuateValve = onCall(async (request) => {
  const db = admin.firestore();
  const { farmId, plotId, action, durationMinutes = 20, triggeredBy = "MANUAL_TOUCH" } = request.data || {};

  // Security Check 1: Mandatory Authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to actuate valves.");
  }

  if (!farmId || !plotId || !action) {
    throw new HttpsError("invalid-argument", "farmId, plotId, and action ('OPEN' | 'CLOSE') are required.");
  }

  // Security Check 2: RBAC Operator / Manager Authorization
  const uid = request.auth.uid;
  const isCustomAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";
  
  if (!isCustomAdmin) {
    const farmRef = db.collection("farms").doc(farmId);
    const farmSnap = await farmRef.get();
    if (!farmSnap.exists) {
      throw new HttpsError("not-found", `Farm ${farmId} not found.`);
    }
    const farmData = farmSnap.data();
    const isOwner = farmData.ownerId === uid;
    const isManager = Array.isArray(farmData.managers) && farmData.managers.includes(uid);
    const isOperator = Array.isArray(farmData.operators) && farmData.operators.includes(uid);
    const isTokenOperator = request.auth.token?.farmId === farmId && ["operator", "manager"].includes(request.auth.token?.role);

    if (!isOwner && !isManager && !isOperator && !isTokenOperator) {
      throw new HttpsError("permission-denied", "Unauthorized: User lacks operator or manager privileges for this farm.");
    }
  }

  const normalizedAction = action.toUpperCase();
  if (normalizedAction !== "OPEN" && normalizedAction !== "CLOSE") {
    throw new HttpsError("invalid-argument", "Action must be 'OPEN' or 'CLOSE'.");
  }

  const plotRef = db.collection("farms").doc(farmId).collection("plots").doc(plotId);
  const plotSnap = await plotRef.get();

  if (!plotSnap.exists) {
    throw new HttpsError("not-found", `Plot ${plotId} not found in farm ${farmId}.`);
  }

  const plotData = plotSnap.data();
  const valve = plotData.valve || { id: `G${plotData.plotNumber || "1"}`, state: "CLOSED", flowRate: 420.0 };
  const now = new Date();

  // Clamp duration between 1 and 180 minutes
  const safeDuration = Math.min(Math.max(Number(durationMinutes) || 20, 1), 180);

  if (normalizedAction === "OPEN") {
    const timerEnd = new Date(now.getTime() + safeDuration * 60 * 1000);
    const flowRate = Number(valve.flowRate) || 420.0; // Liters per hour

    // Actuate valve: +12V pulse to latch solenoid open
    await plotRef.update({
      "valve.state": "OPEN",
      "valve.timerEnd": admin.firestore.Timestamp.fromDate(timerEnd),
      "valve.lastActuatedAt": admin.firestore.FieldValue.serverTimestamp(),
      "valve.pulseVoltage": 12,
      "valve.flowRate": flowRate
    });

    // Create Audit Log entry (Volume ledger initiation)
    const logRef = db.collection("farms").doc(farmId).collection("irrigationLogs").doc();
    await logRef.set({
      plotId: plotId,
      valveId: valve.id || `G${plotData.plotNumber || "1"}`,
      action: "OPEN",
      durationMinutes: safeDuration,
      litersDelivered: 0,
      triggeredBy: triggeredBy,
      pulseVoltage: 12,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      action: "OPEN",
      gateId: valve.id,
      pulseVoltage: 12,
      durationMinutes: safeDuration,
      timerEnd: timerEnd.toISOString(),
      message: `Gate ${valve.id} opened for ${safeDuration} minutes (+12V solenoid pulse applied).`
    };
  } else {
    // CLOSE action: -12V reverse polarity pulse
    let actualDuration = 0;
    if (valve.lastActuatedAt && valve.state === "OPEN") {
      const startMillis = valve.lastActuatedAt.toMillis 
        ? valve.lastActuatedAt.toMillis() 
        : (valve.lastActuatedAt.toDate ? valve.lastActuatedAt.toDate().getTime() : new Date(valve.lastActuatedAt).getTime());
      actualDuration = Math.max(0, (now.getTime() - startMillis) / 60000);
    }

    const flowRate = Number(valve.flowRate) || 420.0;
    const deliveredLiters = Number(((flowRate / 60) * actualDuration).toFixed(1));

    // Update Plot Valve state to CLOSED and add to cumulative volume ledger
    const plotUpdate = {
      "valve.state": "CLOSED",
      "valve.timerEnd": null,
      "valve.lastActuatedAt": admin.firestore.FieldValue.serverTimestamp(),
      "valve.pulseVoltage": -12
    };

    if (deliveredLiters > 0) {
      plotUpdate.totalLitersDelivered = admin.firestore.FieldValue.increment(deliveredLiters);
    }

    await plotRef.update(plotUpdate);

    // Create Audit Log entry (ACID water volume ledger completion)
    const logRef = db.collection("farms").doc(farmId).collection("irrigationLogs").doc();
    await logRef.set({
      plotId: plotId,
      valveId: valve.id || `G${plotData.plotNumber || "1"}`,
      action: "CLOSE",
      durationMinutes: Number(actualDuration.toFixed(1)),
      litersDelivered: deliveredLiters,
      triggeredBy: triggeredBy,
      pulseVoltage: -12,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      success: true,
      action: "CLOSE",
      gateId: valve.id,
      pulseVoltage: -12,
      actualDurationMinutes: Number(actualDuration.toFixed(1)),
      litersDelivered: deliveredLiters,
      message: `Gate ${valve.id} closed (-12V reverse pulse applied). Delivered ${deliveredLiters}L.`
    };
  }
});

/**
 * Emergency 1-tap shut off all valves (G1-G6) simultaneously
 * Applies -12V reverse pulse, clears timers, and logs accurate delivered water volume.
 */
exports.emergencyShutOffAll = onCall(async (request) => {
  const db = admin.firestore();
  const { farmId } = request.data || {};

  // Security Check 1: Mandatory Authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required to execute emergency shutoff.");
  }

  if (!farmId) {
    throw new HttpsError("invalid-argument", "farmId is required.");
  }

  // Security Check 2: Farm Member / Operator Authorization
  const uid = request.auth.uid;
  const isCustomAdmin = request.auth.token?.admin === true || request.auth.token?.role === "admin";

  if (!isCustomAdmin) {
    const farmRef = db.collection("farms").doc(farmId);
    const farmSnap = await farmRef.get();
    if (!farmSnap.exists) {
      throw new HttpsError("not-found", `Farm ${farmId} not found.`);
    }
    const farmData = farmSnap.data();
    const isOwner = farmData.ownerId === uid;
    const isManager = Array.isArray(farmData.managers) && farmData.managers.includes(uid);
    const isOperator = Array.isArray(farmData.operators) && farmData.operators.includes(uid);
    const isMember = Array.isArray(farmData.members) && farmData.members.includes(uid);
    const isTokenMember = request.auth.token?.farmId === farmId;

    if (!isOwner && !isManager && !isOperator && !isMember && !isTokenMember) {
      throw new HttpsError("permission-denied", "Unauthorized: User lacks permission to execute emergency shutoff for this farm.");
    }
  }

  const plotsRef = db.collection("farms").doc(farmId).collection("plots");
  const plotsSnap = await plotsRef.get();

  const batch = db.batch();
  let closedCount = 0;
  let totalLitersLogged = 0;
  const now = new Date();

  plotsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.valve?.state === "OPEN") {
      const valve = data.valve;
      let actualDuration = 0;
      if (valve.lastActuatedAt) {
        const startMillis = valve.lastActuatedAt.toMillis 
          ? valve.lastActuatedAt.toMillis() 
          : (valve.lastActuatedAt.toDate ? valve.lastActuatedAt.toDate().getTime() : new Date(valve.lastActuatedAt).getTime());
        actualDuration = Math.max(0, (now.getTime() - startMillis) / 60000);
      }
      const flowRate = Number(valve.flowRate) || 420.0;
      const deliveredLiters = Number(((flowRate / 60) * actualDuration).toFixed(1));
      totalLitersLogged += deliveredLiters;

      const plotUpdate = {
        "valve.state": "CLOSED",
        "valve.timerEnd": null,
        "valve.pulseVoltage": -12,
        "valve.lastActuatedAt": admin.firestore.FieldValue.serverTimestamp()
      };

      if (deliveredLiters > 0) {
        plotUpdate.totalLitersDelivered = admin.firestore.FieldValue.increment(deliveredLiters);
      }

      batch.update(doc.ref, plotUpdate);

      // Log emergency shutoff with delivered water accounting
      const logRef = db.collection("farms").doc(farmId).collection("irrigationLogs").doc();
      batch.set(logRef, {
        plotId: doc.id,
        valveId: valve.id || `G${data.plotNumber || "?"}`,
        action: "EMERGENCY_SHUTOFF",
        durationMinutes: Number(actualDuration.toFixed(1)),
        litersDelivered: deliveredLiters,
        triggeredBy: "EMERGENCY_KILLSWITCH",
        pulseVoltage: -12,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      closedCount++;
    }
  });

  if (closedCount > 0) {
    await batch.commit();
  }

  return {
    success: true,
    closedCount,
    totalLitersLogged: Number(totalLitersLogged.toFixed(1)),
    message: `Emergency shutoff executed: ${closedCount} active valves closed simultaneously (-12V reverse pulses delivered).`
  };
});

/**
 * Scheduled Failsafe Check:
 * Auto-closes any valve whose countdown timer has expired to prevent pipe burst or soil waterlogging.
 * Runs every 2 minutes via Cloud Scheduler.
 */
exports.scheduledFailsafeCheck = onSchedule("every 2 minutes", async (event) => {
  const db = admin.firestore();
  const farmsSnap = await db.collection("farms").get();
  const now = admin.firestore.Timestamp.now();

  for (const farmDoc of farmsSnap.docs) {
    const plotsSnap = await farmDoc.ref.collection("plots").where("valve.state", "==", "OPEN").get();
    for (const plotDoc of plotsSnap.docs) {
      const plot = plotDoc.data();
      const valve = plot.valve || {};
      const timerEnd = valve.timerEnd;

      if (timerEnd && timerEnd.toMillis() <= now.toMillis()) {
        console.log(`[Failsafe] Timer expired for plot ${plotDoc.id}. Auto-closing valve ${valve.id}.`);
        
        let actualDuration = 0;
        if (valve.lastActuatedAt) {
          const startMillis = valve.lastActuatedAt.toMillis 
            ? valve.lastActuatedAt.toMillis() 
            : (valve.lastActuatedAt.toDate ? valve.lastActuatedAt.toDate().getTime() : new Date(valve.lastActuatedAt).getTime());
          actualDuration = Math.max(0, (now.toMillis() - startMillis) / 60000);
        }
        const flowRate = Number(valve.flowRate) || 420.0;
        const deliveredLiters = Number(((flowRate / 60) * actualDuration).toFixed(1));

        const updatePayload = {
          "valve.state": "CLOSED",
          "valve.timerEnd": null,
          "valve.pulseVoltage": -12,
          "valve.lastActuatedAt": admin.firestore.FieldValue.serverTimestamp()
        };

        if (deliveredLiters > 0) {
          updatePayload.totalLitersDelivered = admin.firestore.FieldValue.increment(deliveredLiters);
        }

        await plotDoc.ref.update(updatePayload);

        // Audit log with liters accounting
        await farmDoc.ref.collection("irrigationLogs").add({
          plotId: plotDoc.id,
          valveId: valve.id || `G${plot.plotNumber || "?"}`,
          action: "CLOSE",
          durationMinutes: Number(actualDuration.toFixed(1)),
          litersDelivered: deliveredLiters,
          triggeredBy: "OFFLINE_FAILSAFE",
          pulseVoltage: -12,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[Failsafe] Gate ${valve.id} auto-closed. ${deliveredLiters}L logged.`);
      }
    }
  }
});
