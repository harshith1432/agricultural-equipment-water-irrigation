/**
 * AgriSpectra Enterprise Management Backend Server
 * High-performance Node.js / Express microservice for managing users,
 * real-time multi-tenant agricultural parcels, bi-stable latching solenoids,
 * edge IoT sensor telemetry, and executive entrepreneur dashboards.
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import healthRoutes from './routes/healthRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import telemetryRoutes from './routes/telemetryRoutes.js';
import { firestoreClient } from './services/firestoreClient.js';
import { enterpriseStore } from './services/enterpriseStore.js';

// Load environment variables (.env in backend or root)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = parseInt(process.env.PORT || process.env.BACKEND_PORT || "5050", 10);

// Hardened Security & CORS Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : [
      'http://localhost:5173',
      'http://localhost:5050',
      'http://localhost:3000',
      'capacitor://localhost',
      'https://localhost'
    ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (native mobile WebView, server-to-server IoT gateways, curl, testing)
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Enterprise-Secret', 'X-Farm-Id', 'x-telemetry-api-key'],
  credentials: true
}));

// HTTP Defense Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '10mb' }));

// Request Logging Middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'test') {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// Root / Welcome Route
app.get('/', (req, res) => {
  res.status(200).json({
    name: "AgriSpectra Enterprise Backend Server",
    status: "ONLINE",
    version: "1.0.0",
    docs: "/api/health",
    portal: "/api/admin/metrics",
    architecture: "Enterprise Microservice / Cloud Firestore Reactive Sync"
  });
});

// Mount Routes
app.use('/api', healthRoutes);
app.use('/api', adminRoutes);
app.use('/api', telemetryRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Enterprise Server Error]:', err.stack || err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

// Start Server if run directly
let serverInstance = null;
const isMainModule = process.argv[1] && (
  process.argv[1] === __filename ||
  process.argv[1].endsWith('server.js')
);

if (isMainModule || process.env.START_SERVER === 'true') {
  serverInstance = app.listen(PORT, '0.0.0.0', () => {
    const token = firestoreClient.getAccessToken();
    console.log("====================================================================");
    console.log("   AGRISPECTRA FLOW & FIELD - ENTERPRISE BACKEND SERVER            ");
    console.log("====================================================================");
    console.log(` > Server Listening Port:  http://localhost:${PORT}`);
    console.log(` > Health Endpoint:        http://localhost:${PORT}/api/health`);
    console.log(` > Admin Metrics:          http://localhost:${PORT}/api/admin/metrics`);
    console.log(` > User Management:        http://localhost:${PORT}/api/admin/users`);
    console.log(` > Emergency Killswitch:   http://localhost:${PORT}/api/admin/emergency-killswitch`);
    console.log(` > Audit Trail:            http://localhost:${PORT}/api/admin/audit-logs`);
    console.log(` > Telemetry Sync:         http://localhost:${PORT}/api/telemetry/sync`);
    console.log(` > Cloud Firestore DB:     ${firestoreClient.projectId} (${token ? 'LIVE CLOUD LINK' : 'OFFLINE STORE'})`);
    console.log(` > Active Parcels:         ${enterpriseStore.plots.length} Zones Managed`);
    console.log(` > Registered Users:       ${enterpriseStore.users.length} Enterprise Operators`);
    console.log("====================================================================");
  });
}

export { app, serverInstance };
