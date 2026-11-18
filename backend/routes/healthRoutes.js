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
  const isConnected = Boolean(firestoreClient.adminDb || (token && token.startsWith('ya29.')) || token === 'firebase-admin-sdk-active');

  const healthPayload = {
    status: "HEALTHY",
    service: "AgriSpectra Enterprise Management Backend",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    uptimeSeconds,
    timestamp: new Date().toISOString(),
    database: {
      projectId: firestoreClient.projectId,
      status: isConnected ? "CONNECTED" : "FALLBACK_RESILIENT_STORE",
      mode: isConnected ? "LIVE_CLOUD_FIRESTORE" : "REACTIVE_OFFLINE_CACHE",
      authProvider: firestoreClient.adminDb
        ? firestoreClient.authProvider
        : (token && token.startsWith('ya29.') ? "Google Cloud ADC Bearer" : "Web API Fallback")
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
