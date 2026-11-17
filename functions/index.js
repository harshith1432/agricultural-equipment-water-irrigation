const admin = require("firebase-admin");
admin.initializeApp();

const { onLeafScanCreated } = require("./closedLoopSynergy");
const { actuateValve, emergencyShutOffAll, scheduledFailsafeCheck } = require("./valveController");
const { ingestMqttTelemetry } = require("./telemetryIngest");

exports.onLeafScanCreated = onLeafScanCreated;
exports.actuateValve = actuateValve;
exports.emergencyShutOffAll = emergencyShutOffAll;
exports.scheduledFailsafeCheck = scheduledFailsafeCheck;
exports.ingestMqttTelemetry = ingestMqttTelemetry;
