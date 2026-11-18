/**
 * Health & Readiness Endpoints
 */
import { Router } from 'express';
import { firestoreClient } from '../services/firestoreClient.js';
import { enterpriseStore } from '../services/enterpriseStore.js';

const router = Router();

router.get('/health', async (req, res) => {
  const uptimeSeconds = Math.floor(process.uptime());
  const token = firestoreClient.getAccessToken();

  const healthPayload = {
    status: "HEALTHY",
    service: "AgriSpectra Enterprise Management Backend",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    database: {
      projectId: firestoreClient.projectId,
      status: token ? "CONNECTED" : "FALLBACK_RESILLIENT_STORE",
      mode: token ? "LIVE_CLOUD_FIRESTORE" : "REACTIVE_OFFLINE_CACHE",
      authProvider: token ? "Google Cloud ADC Bearer" : "Web API Fallback"
    },
    systemMetrics: {
      memoryMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 10) / 10,
      activePlotsManaged: enterpriseStore.plots.length,
      registeredUsers: enterpriseStore.users.length,
      auditRecords: enterpriseStore.auditLogs.length
    }
  };

  res.status(200).json(healthPayload);
});

export default router;
