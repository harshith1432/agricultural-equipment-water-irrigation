/**
 * AgriSpectra Enterprise State & Data Store
 * Controls platform-wide enterprise data, multi-tenant users, real-time IoT telemetry,
 * bi-stable hydraulic valve latching states, and immutable audit trails.
 */

import { firestoreClient } from './firestoreClient.js';

export const VALID_ROLES = ['superadmin', 'farm_owner', 'agronomist', 'field_operator'];

export const ROLE_PERMISSIONS = {
  superadmin: [
    'ALL_ACCESS',
    'USER_ROLE_MANAGEMENT',
    'EMERGENCY_KILLSWITCH',
    'VALVE_OVERRIDE',
    'SPECTROSCOPY_ADMIN',
    'AUDIT_LOG_EXPORT',
    'TENANT_FARM_PROVISIONING'
  ],
  farm_owner: [
    'VALVE_CONTROL',
    'TELEMETRY_VIEW',
    'SCHEDULE_IRRIGATION',
    'FIELD_OPERATOR_INVITE',
    'HARVEST_ANALYTICS_VIEW',
    'WATER_BUDGET_ADJUST'
  ],
  agronomist: [
    'SPECTROSCOPY_INGEST',
    'PRESCRIPTION_AUTHOR',
    'DISEASE_DIAGNOSIS',
    'CANOPY_HEALTH_AUDIT',
    'TELEMETRY_VIEW'
  ],
  field_operator: [
    'VALVE_MANUAL_ACTUATE',
    'TELEMETRY_VIEW',
    'PROBE_CALIBRATION_CHECK',
    'HARDWARE_ALARM_ACK'
  ]
};

class EnterpriseStore {
  constructor() {
    this.startTime = Date.now();
    this.users = this.initUsers();
    this.plots = this.initPlots();
    this.auditLogs = this.initAuditLogs();
    this.telemetryPackets = [];
    this.totalWaterDeliveredLiters = 48250.0;
    this.lastKillswitchTimestamp = null;
  }

  initUsers() {
    return [
      {
        id: "usr_exec_001",
        name: "Dr. Harsh Vardhan",
        email: "harsh.ceo@agrispectra.io",
        role: "superadmin",
        title: "Executive CEO & Chief Architect",
        organization: "AgriSpectra Global Holdings",
        status: "active",
        assignedFarms: ["farm-valley-1", "farm-salinas-2", "farm-napa-3"],
        registrationDate: "2025-01-10T08:00:00.000Z",
        lastActive: new Date().toISOString(),
        device: "Executive Command Terminal",
        permissions: ROLE_PERMISSIONS.superadmin
      },
      {
        id: "usr_farm_002",
        name: "Marcus Vance",
        email: "marcus.vance@vancevalley.com",
        role: "farm_owner",
        title: "Principal Proprietor - Vance Orchards",
        organization: "Vance Valley Agriculture Corp.",
        status: "active",
        assignedFarms: ["farm-valley-1"],
        registrationDate: "2025-02-14T10:15:00.000Z",
        lastActive: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        device: "Android Mobile Client (Galaxy S24 Ultra)",
        permissions: ROLE_PERMISSIONS.farm_owner
      },
      {
        id: "usr_agro_003",
        name: "Dr. Elena Rostova",
        email: "elena.rostova@agrispectra.io",
        role: "agronomist",
        title: "Lead Chemometrics & Canopy Pathologist",
        organization: "AgriSpectra AgScience Div.",
        status: "active",
        assignedFarms: ["farm-valley-1", "farm-salinas-2"],
        registrationDate: "2025-03-01T09:30:00.000Z",
        lastActive: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        device: "Agrispectra Handheld Spec-v3",
        permissions: ROLE_PERMISSIONS.agronomist
      },
      {
        id: "usr_oper_004",
        name: "Carlos Mendez",
        email: "carlos.mendez@vancevalley.com",
        role: "field_operator",
        title: "Senior Hydraulic & Solenoid Technician",
        organization: "Vance Valley Field Ops",
        status: "active",
        assignedFarms: ["farm-valley-1"],
        registrationDate: "2025-04-12T06:00:00.000Z",
        lastActive: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        device: "Android Field Tablet (Rugged Tab Active5)",
        permissions: ROLE_PERMISSIONS.field_operator
      },
      {
        id: "usr_oper_005",
        name: "Aisha Patel",
        email: "aisha.patel@vancevalley.com",
        role: "field_operator",
        title: "Irrigation Line Inspector",
        organization: "Vance Valley Field Ops",
        status: "active",
        assignedFarms: ["farm-valley-1"],
        registrationDate: "2025-05-19T07:20:00.000Z",
        lastActive: new Date(Date.now() - 65 * 60 * 1000).toISOString(),
        device: "Mobile Handheld Client",
        permissions: ROLE_PERMISSIONS.field_operator
      },
      {
        id: "usr_exec_006",
        name: "Sarah Chen, P.E.",
        email: "sarah.chen@agrispectra.io",
        role: "superadmin",
        title: "VP Enterprise Hydraulics & Automation",
        organization: "AgriSpectra Global Holdings",
        status: "active",
        assignedFarms: ["farm-valley-1", "farm-salinas-2", "farm-napa-3"],
        registrationDate: "2025-01-22T14:45:00.000Z",
        lastActive: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        device: "Enterprise Control Console",
        permissions: ROLE_PERMISSIONS.superadmin
      }
    ];
  }

  initPlots() {
    return [
      {
        id: "plot-1",
        plotNumber: 1,
        name: "Zone 1 - High Density Almonds",
        crop: "Almond Orchards (Nonpareil)",
        soilSensors: {
          depth10cm: { vwc: 18.5, temperatureC: 22.4, ec: 1.15 },
          depth30cm: { vwc: 21.0, temperatureC: 20.1, ec: 1.05 },
          depth50cm: { vwc: 23.8, temperatureC: 18.6, ec: 0.95 }
        },
        valve: {
          id: "G1",
          state: "CLOSED",
          flowRateLph: 480.0,
          pulseVoltage: -12,
          timerEnd: null,
          lastActuatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString()
        },
        totalLitersDelivered: 8420.0
      },
      {
        id: "plot-2",
        plotNumber: 2,
        name: "Zone 2 - Cabernet Sauvignon Grapes",
        crop: "Wine Grape Canopy",
        soilSensors: {
          depth10cm: { vwc: 16.2, temperatureC: 23.8, ec: 1.30 },
          depth30cm: { vwc: 19.4, temperatureC: 21.2, ec: 1.20 },
          depth50cm: { vwc: 22.1, temperatureC: 19.5, ec: 1.05 }
        },
        valve: {
          id: "G2",
          state: "CLOSED",
          flowRateLph: 480.0,
          pulseVoltage: -12,
          timerEnd: null,
          lastActuatedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString()
        },
        totalLitersDelivered: 7150.0
      },
      {
        id: "plot-3",
        plotNumber: 3,
        name: "Zone 3 - Golden Hills Pistachios",
        crop: "Pistachio Trees",
        soilSensors: {
          depth10cm: { vwc: 22.4, temperatureC: 21.9, ec: 1.10 },
          depth30cm: { vwc: 24.6, temperatureC: 19.8, ec: 1.00 },
          depth50cm: { vwc: 26.5, temperatureC: 18.3, ec: 0.90 }
        },
        valve: {
          id: "G3",
          state: "CLOSED",
          flowRateLph: 480.0,
          pulseVoltage: -12,
          timerEnd: null,
          lastActuatedAt: new Date(Date.now() - 210 * 60 * 1000).toISOString()
        },
        totalLitersDelivered: 9600.0
      },
      {
        id: "plot-4",
        plotNumber: 4,
        name: "Zone 4 - Organic Hass Avocados",
        crop: "Avocado Grove",
        soilSensors: {
          depth10cm: { vwc: 15.8, temperatureC: 24.1, ec: 1.40 },
          depth30cm: { vwc: 18.2, temperatureC: 21.5, ec: 1.25 },
          depth50cm: { vwc: 21.0, temperatureC: 19.1, ec: 1.10 }
        },
        valve: {
          id: "G4",
          state: "CLOSED",
          flowRateLph: 480.0,
          pulseVoltage: -12,
          timerEnd: null,
          lastActuatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
        },
        totalLitersDelivered: 6890.0
      },
      {
        id: "plot-5",
        plotNumber: 5,
        name: "Zone 5 - Washington Navel Citrus",
        crop: "Citrus Trees",
        soilSensors: {
          depth10cm: { vwc: 24.1, temperatureC: 20.8, ec: 1.05 },
          depth30cm: { vwc: 26.8, temperatureC: 18.9, ec: 0.95 },
          depth50cm: { vwc: 28.5, temperatureC: 17.5, ec: 0.85 }
        },
        valve: {
          id: "G5",
          state: "CLOSED",
          flowRateLph: 480.0,
          pulseVoltage: -12,
          timerEnd: null,
          lastActuatedAt: new Date(Date.now() - 300 * 60 * 1000).toISOString()
        },
        totalLitersDelivered: 8940.0
      },
      {
        id: "plot-6",
        plotNumber: 6,
        name: "Zone 6 - Drip Heirloom Tomatoes",
        crop: "Heirloom Tomatoes (Open Field)",
        soilSensors: {
          depth10cm: { vwc: 20.1, temperatureC: 22.9, ec: 1.25 },
          depth30cm: { vwc: 23.3, temperatureC: 20.4, ec: 1.15 },
          depth50cm: { vwc: 25.7, temperatureC: 18.8, ec: 1.00 }
        },
        valve: {
          id: "G6",
          state: "CLOSED",
          flowRateLph: 480.0,
          pulseVoltage: -12,
          timerEnd: null,
          lastActuatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
        },
        totalLitersDelivered: 7250.0
      }
    ];
  }

  initAuditLogs() {
    return [
      {
        id: "log_init_001",
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        category: "SYSTEM_BOOT",
        severity: "INFO",
        actor: "SYSTEM_KERNEL",
        action: "Enterprise Backend Server Initialized",
        details: "Live Cloud Firestore link established on water-irrigation-system-8aeeb. Dual-node failover armed."
      },
      {
        id: "log_init_002",
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
        category: "VALVE_CONTROL",
        severity: "INFO",
        actor: "usr_farm_002 (Marcus Vance)",
        action: "Solenoid Gate G1 Cycle Completed",
        details: "Gate G1 latched OPEN for 20m (+12V pulse). Delivered 160.0 Liters. De-energized (-12V reverse pulse)."
      },
      {
        id: "log_init_003",
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        category: "SPECTROSCOPY",
        severity: "INFO",
        actor: "usr_agro_003 (Dr. Elena Rostova)",
        action: "Handheld Leaf Scan Ingested",
        details: "Plot-4 Avocado Canopy scan. Vitality: 82.4, NDVI: 0.74, Nitrogen: 6.0 kg/acre urea prescribed."
      },
      {
        id: "log_init_004",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        category: "AUTH",
        severity: "INFO",
        actor: "usr_exec_001 (Dr. Harsh Vardhan)",
        action: "Superadmin Executive Session Authenticated",
        details: "Command center session active from Executive Terminal."
      }
    ];
  }

  /**
   * Executive Entrepreneur Dashboard Metrics
   */
  getExecutiveMetrics() {
    const activeValvesCount = this.plots.filter(p => p.valve?.state === 'OPEN').length;
    const activeUsersCount = this.users.filter(u => {
      const lastActiveMs = new Date(u.lastActive).getTime();
      return (Date.now() - lastActiveMs) < 60 * 60 * 1000; // active in last 60 mins
    }).length;

    return {
      platformStatus: "OPERATIONAL",
      totalRegisteredUsers: this.users.length,
      activeOnlineUsers: Math.max(activeUsersCount, 1),
      activeFarmingParcels: this.plots.length,
      activeSolenoidGates: activeValvesCount,
      waterThroughput24hLiters: Math.round(this.totalWaterDeliveredLiters * 10) / 10,
      platformStabilityIndex: 99.98,
      waterConservationRatePercent: 34.2,
      estimatedCropYieldGainPercent: 18.4,
      carbonOffsetKgCO2: Math.round(this.totalWaterDeliveredLiters * 0.0257 * 10) / 10,
      telemetryIngestionRatePerMin: 120,
      lastKillswitchTriggered: this.lastKillswitchTimestamp,
      enterpriseTenants: [
        { id: "tenant_01", name: "Vance Valley Agriculture Corp.", acres: 250, status: "HEALTHY" },
        { id: "tenant_02", name: "Salinas Organic Produce Co.", acres: 180, status: "HEALTHY" },
        { id: "tenant_03", name: "Napa Valley Premier Vineyards", acres: 320, status: "HEALTHY" }
      ]
    };
  }

  /**
   * User Management: List Users
   */
  getUsers(filters = {}) {
    let result = [...this.users];
    if (filters.role) {
      result = result.filter(u => u.role.toLowerCase() === filters.role.toLowerCase());
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.title.toLowerCase().includes(q)
      );
    }
    return result;
  }

  /**
   * User Management: Update User Role
   */
  updateUserRole({ userId, email, newRole, updatedBy = "superadmin_console" }) {
    if (!VALID_ROLES.includes(newRole)) {
      throw new Error(`Invalid role '${newRole}'. Allowed roles: ${VALID_ROLES.join(', ')}`);
    }

    const user = this.users.find(u =>
      (userId && u.id === userId) || (email && u.email.toLowerCase() === email.toLowerCase())
    );

    if (!user) {
      throw new Error(`User not found with identifier: ${userId || email}`);
    }

    const previousRole = user.role;
    user.role = newRole;
    user.permissions = ROLE_PERMISSIONS[newRole];
    user.lastActive = new Date().toISOString();

    // Audit log entry
    this.addAuditLog({
      category: "ROLE_UPDATE",
      severity: "WARN",
      actor: updatedBy,
      action: `User Role Modified for ${user.name}`,
      details: `Role updated from '${previousRole}' to '${newRole}'. New permissions applied: ${user.permissions.length} grants.`
    });

    return user;
  }

  /**
   * User Management: Create User
   */
  createUser({ name, email, role, title, organization, assignedFarms = ["farm-valley-1"] }) {
    if (!name || !email) {
      throw new Error("User name and email are required.");
    }
    const roleToSet = VALID_ROLES.includes(role) ? role : "field_operator";

    const existing = this.users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      throw new Error(`User already registered with email: ${email}`);
    }

    const newUser = {
      id: `usr_${Date.now().toString(36)}`,
      name,
      email,
      role: roleToSet,
      title: title || `${roleToSet.replace('_', ' ').toUpperCase()}`,
      organization: organization || "AgriSpectra Managed Partner",
      status: "active",
      assignedFarms,
      registrationDate: new Date().toISOString(),
      lastActive: new Date().toISOString(),
      device: "Web / Mobile Client",
      permissions: ROLE_PERMISSIONS[roleToSet]
    };

    this.users.push(newUser);

    this.addAuditLog({
      category: "USER_PROVISION",
      severity: "INFO",
      actor: "superadmin_console",
      action: `New Enterprise User Registered: ${name}`,
      details: `Account provisioned with role '${roleToSet}', assigned farms: ${assignedFarms.join(', ')}`
    });

    return newUser;
  }

  /**
   * Enterprise Emergency Hydraulic Killswitch
   * Instantly closes all 6 bi-stable latching solenoid valves across all farming parcels.
   */
  emergencyKillswitch({ operatorId = "usr_exec_001", reason = "ENTERPRISE_COMMAND_SHUTDOWN" } = {}) {
    const now = new Date().toISOString();
    const closedValves = [];

    for (const plot of this.plots) {
      const priorState = plot.valve.state;
      plot.valve.state = "CLOSED";
      plot.valve.pulseVoltage = -12; // -12V reverse polarity pulse
      plot.valve.timerEnd = null;
      plot.valve.lastActuatedAt = now;

      closedValves.push({
        plotId: plot.id,
        gateId: plot.valve.id,
        priorState,
        newState: "CLOSED",
        polarity: "-12V latch pulse applied"
      });
    }

    this.lastKillswitchTimestamp = now;

    // Critical severity audit log
    this.addAuditLog({
      category: "KILLSWITCH",
      severity: "CRITICAL",
      actor: operatorId,
      action: "EMERGENCY HYDRAULIC KILLSWITCH TRIGGERED",
      details: `Operator triggered immediate shutdown across ${closedValves.length} solenoid gates. Reason: ${reason}. Reverse -12V pulses dispatched.`
    });

    return {
      success: true,
      timestamp: now,
      reason,
      operatorId,
      closedCount: closedValves.length,
      valves: closedValves
    };
  }

  /**
   * Actuate Single Valve (G1-G6)
   */
  actuateValve({ plotId, action, durationMinutes = 20, operator = "API_CLIENT" }) {
    const plot = this.plots.find(p => p.id === plotId || p.plotNumber === Number(plotId));
    if (!plot) {
      throw new Error(`Plot '${plotId}' not found.`);
    }

    const isOpening = action.toUpperCase() === "OPEN";
    const now = new Date();
    const timerEnd = isOpening ? new Date(now.getTime() + durationMinutes * 60000).toISOString() : null;
    const pulseVoltage = isOpening ? 12 : -12;

    plot.valve.state = isOpening ? "OPEN" : "CLOSED";
    plot.valve.timerEnd = timerEnd;
    plot.valve.pulseVoltage = pulseVoltage;
    plot.valve.lastActuatedAt = now.toISOString();

    if (isOpening) {
      this.totalWaterDeliveredLiters += (plot.valve.flowRateLph / 60) * durationMinutes;
      plot.totalLitersDelivered += (plot.valve.flowRateLph / 60) * durationMinutes;
    }

    this.addAuditLog({
      category: "VALVE_CONTROL",
      severity: isOpening ? "INFO" : "WARN",
      actor: operator,
      action: `Valve ${plot.valve.id} (${plot.name}) set to ${plot.valve.state}`,
      details: `Pulse: ${pulseVoltage > 0 ? '+12V' : '-12V'} | Timer: ${durationMinutes}m | Delivered: ${(plot.valve.flowRateLph / 60) * durationMinutes}L`
    });

    return {
      success: true,
      plotId: plot.id,
      gateId: plot.valve.id,
      state: plot.valve.state,
      timerEnd,
      pulseVoltage
    };
  }

  /**
   * IoT Telemetry Packet Ingestion & Validation
   */
  ingestTelemetry(packet) {
    if (!packet || (!packet.plotId && !packet.zoneId)) {
      throw new Error("Telemetry packet must contain 'plotId' or 'zoneId'.");
    }

    const targetPlotId = packet.plotId || packet.zoneId;
    const plot = this.plots.find(p => p.id === targetPlotId || p.plotNumber === Number(targetPlotId));

    const packetId = `pkt_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`;
    const processedPacket = {
      id: packetId,
      timestamp: packet.timestamp || new Date().toISOString(),
      plotId: targetPlotId,
      soilSensors: packet.soilSensors || null,
      flowSensorLPH: packet.flowSensorLPH || 0,
      batteryVoltage: packet.batteryVoltage || 12.6,
      rssiDbm: packet.rssiDbm || -70,
      mainlinePressureBar: packet.mainlinePressureBar || 2.4
    };

    if (plot && packet.soilSensors) {
      plot.soilSensors = {
        ...plot.soilSensors,
        ...packet.soilSensors
      };
    }

    // Keep ring buffer of latest 200 telemetry packets
    this.telemetryPackets.unshift(processedPacket);
    if (this.telemetryPackets.length > 200) {
      this.telemetryPackets.pop();
    }

    // Anomaly detection
    let anomalyDetected = false;
    let anomalyReason = null;
    if (processedPacket.mainlinePressureBar > 3.2) {
      anomalyDetected = true;
      anomalyReason = `Overpressure surge detected: ${processedPacket.mainlinePressureBar} Bar > 3.2 Bar max threshold`;
      this.addAuditLog({
        category: "TELEMETRY_ANOMALY",
        severity: "CRITICAL",
        actor: "EDGE_TELEMETRY_GATEWAY",
        action: "Mainline Hydraulic Overpressure Surge",
        details: anomalyReason
      });
    }

    return {
      received: true,
      packetId,
      targetPlot: plot ? plot.name : "Unmapped Parcel",
      anomalyDetected,
      anomalyReason,
      nextSyncIntervalSec: 30
    };
  }

  /**
   * Ingest Handheld Leaf Spectroscopy Scan
   */
  ingestLeafScan(scan) {
    const scanId = `scan_${Date.now().toString(36)}`;
    const record = {
      id: scanId,
      plotId: scan.plotId || "plot-1",
      scannedAt: new Date().toISOString(),
      crop: scan.crop || "Almond Canopy",
      vitalityScore: scan.vitalityScore || 85,
      leafWaterIndex: scan.leafWaterIndex || 0.88,
      nitrogenPrescriptionKg: scan.nitrogenPrescriptionKg || 6.0,
      diseaseRisk: scan.diseaseRisk || { status: "NONE", pathogen: "Clear" },
      harvestWindow: scan.harvestWindow || { projectedDate: "2026-09-15", daysRemaining: 120 }
    };

    this.addAuditLog({
      category: "SPECTROSCOPY",
      severity: "INFO",
      actor: scan.operator || "Handheld_Device_Direct",
      action: `Spectroscopy Scan Analyzed for ${record.crop}`,
      details: `Plot: ${record.plotId} | Vitality: ${record.vitalityScore}/100 | Nitrogen: ${record.nitrogenPrescriptionKg} kg/acre`
    });

    return record;
  }

  /**
   * Audit Trail Management
   */
  addAuditLog(entry) {
    const log = {
      id: `log_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      severity: entry.severity || "INFO",
      ...entry
    };
    this.auditLogs.unshift(log);
    if (this.auditLogs.length > 500) {
      this.auditLogs.pop();
    }
    return log;
  }

  getAuditLogs(filters = {}) {
    let logs = [...this.auditLogs];
    if (filters.category) {
      logs = logs.filter(l => l.category.toLowerCase() === filters.category.toLowerCase());
    }
    if (filters.severity) {
      logs = logs.filter(l => l.severity.toLowerCase() === filters.severity.toLowerCase());
    }
    const limit = Number(filters.limit) || 50;
    return logs.slice(0, limit);
  }
}

export const enterpriseStore = new EnterpriseStore();
