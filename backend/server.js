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
import irrigationRoutes from './routes/irrigationRoutes.js';
import soilRoutes from './routes/soilRoutes.js';
import spectroRoutes from './routes/spectroRoutes.js';
import environmentRoutes from './routes/environmentRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import authRoutes from './routes/authRoutes.js';
import { authLimiter } from './middleware/rateLimiter.js';
import { firestoreClient } from './services/firestoreClient.js';
import { enterpriseStore } from './services/enterpriseStore.js';
import { centralStorage } from './services/centralStorage.js';
import { schemaManager } from './services/schemaManager.js';

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
    
    const isProduction = process.env.NODE_ENV === 'production';
    
    // Strict CORS: Reject wildcard origins in production mode
    if (isProduction && (allowedOrigins.includes('*') || origin === '*')) {
      return callback(new Error(`Wildcard CORS origin is forbidden in production`), false);
    }

    let isAllowed = (!isProduction && allowedOrigins.includes('*')) || allowedOrigins.includes(origin);
    
    if (!isAllowed) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.hostname === 'vercel.app' || originUrl.hostname.endsWith('.vercel.app')) {
          isAllowed = true;
        }
      } catch {
        // Invalid origin URL format
      }
    }

    if (isAllowed) {
      return callback(null, true);
    }
    return callback(new Error(`Origin ${origin} not permitted by CORS policy`), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Enterprise-Secret', 'X-Farm-Id', 'x-telemetry-api-key'],
  credentials: true
}));

// HTTP Defense Security Headers (OWASP MASVS-NETWORK / OWASP Top 10)
app.use((req, res, next) => {
  // Content Security Policy
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: blob:; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com http://localhost:* ws://localhost:* https://*.vercel.app; object-src 'none'; frame-ancestors 'none'; base-uri 'self';"
  );
  // Strict Transport Security (HSTS)
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  // Content Type Sniffing Prevention
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Clickjacking Prevention
  res.setHeader('X-Frame-Options', 'DENY');
  // Legacy XSS Filter
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Hardware Feature & Sensor Permissions Policy
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=(self)');
  // Cross-Origin Isolation & Popups for OAuth
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// Enforce 500kb request payload limit to defend against memory exhaustion DoS attacks
app.use(express.json({ limit: '500kb' }));

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
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', adminRoutes);
app.use('/api', telemetryRoutes);
app.use('/api', irrigationRoutes);
app.use('/api', soilRoutes);
app.use('/api', spectroRoutes);
app.use('/api', environmentRoutes);
app.use('/api', aiRoutes);

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
  (async () => {
    // 1. Verify Database and Auto-Create Missing Tables / Collections on Startup
    await schemaManager.ensureSchemaAndCollections();

    serverInstance = app.listen(PORT, '0.0.0.0', () => {
      const token = firestoreClient.getAccessToken();
      const isLiveDb = Boolean(firestoreClient.adminDb || (token && token.startsWith('ya29.')) || token === 'firebase-admin-sdk-active');
      console.log("====================================================================");
      console.log("   AGRISPECTRA FLOW & FIELD - ENTERPRISE BACKEND SERVER            ");
      console.log("====================================================================");
      console.log(` > Server Listening Port:  http://0.0.0.0:${PORT}`);
      console.log(` > Health Endpoint:        /api/health`);
      console.log(` > Admin Metrics:          /api/admin/metrics`);
      console.log(` > User Authentication:    /api/auth/login | /api/auth/register`);
      console.log(` > Irrigation Control:     /api/irrigation/valves`);
      console.log(` > Soil 8-in-1 Telemetry:  /api/soil/scans`);
      console.log(` > NIR Spectroscopy:       /api/spectroscopy/scans`);
      console.log(` > Environment & Weather:  /api/environment/latest`);
      console.log(` > AI Closed-Loop Engine:  /api/ai/recommendations`);
      console.log(` > Emergency Killswitch:   /api/irrigation/emergency-stop`);
      console.log(` > Audit Trail:            /api/admin/audit-logs`);
      console.log(` > Telemetry Sync:         /api/telemetry/sync`);
      console.log(` > Cloud Firestore DB:     ${firestoreClient.projectId} (${isLiveDb ? `LIVE CLOUD LINK - ${firestoreClient.authProvider}` : 'OFFLINE STORE'})`);
      console.log(` > Verified Tables:        farms, users, telemetry_logs, irrigation_logs, soil_scans, audit_logs`);
      console.log(` > Active Parcels:         ${centralStorage.getValves().length} Zones Managed`);
      console.log(` > Registered Users:       ${enterpriseStore.users.length} Enterprise Operators`);
      console.log("====================================================================");
    });
  })();
}

export { app, serverInstance };
