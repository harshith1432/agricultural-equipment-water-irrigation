/**
 * AgriSpectra Enterprise Management Backend Server
 * High-performance Node.js / Express microservice for managing users,
 * real-time multi-tenant agricultural parcels, bi-stable latching solenoids,
 * edge IoT sensor telemetry, and executive entrepreneur dashboards.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
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
import platformRoutes from './routes/platformRoutes.js';
import { adminCredentials } from './services/adminCredentials.js';
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

// OWASP A05:2021 Security Misconfiguration - standard hardened HTTP response
// headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, no X-Powered-By).
// Keep Helmet's secure defaults (including CSP and frame protection) rather
// than disabling them - this is a JSON API so a default CSP is harmless, and
// disabling it is itself flagged as an insecure configuration.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Hardened Security & CORS Middleware
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : [
      'http://localhost',
      'https://localhost',
      'http://localhost:5173',
      'http://localhost:5050',
      'http://localhost:3000',
      'http://localhost:4173',
      'http://127.0.0.1',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5050',
      'http://192.168.0.116',
      'http://192.168.0.116:5173',
      'http://192.168.0.116:5050',
      'capacitor://localhost',
      'ionic://localhost'
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
        const host = originUrl.hostname;

        // Allow mobile Capacitor / Ionic apps
        if (originUrl.protocol === 'capacitor:' || originUrl.protocol === 'ionic:') {
          isAllowed = true;
        }
        // Allow localhost and loopback on any port
        else if (host === 'localhost' || host === '127.0.0.1' || host === '10.0.2.2') {
          isAllowed = true;
        }
        // Allow local LAN Wi-Fi / subnet devices (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
        else if (
          host.startsWith('192.168.') ||
          host.startsWith('10.') ||
          (host.startsWith('172.') && parseInt(host.split('.')[1], 10) >= 16 && parseInt(host.split('.')[1], 10) <= 31)
        ) {
          isAllowed = true;
        }
        // Allow Vercel & Render cloud deployments
        else if (
          host === 'vercel.app' ||
          host.endsWith('.vercel.app') ||
          host === 'onrender.com' ||
          host.endsWith('.onrender.com')
        ) {
          isAllowed = true;
        }
        // Allow the Firebase-Hosted marketing website & admin dashboard
        else if (
          host.endsWith('.web.app') ||
          host.endsWith('.firebaseapp.com')
        ) {
          isAllowed = true;
        }
      } catch {
        // Invalid origin URL format
      }
    }

    if (isAllowed) {
      return callback(null, true);
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
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
    "default-src 'self' capacitor: https: http:; script-src 'self' 'unsafe-inline' https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https: http: blob:; connect-src 'self' https://firestore.googleapis.com https://identitytoolkit.googleapis.com http://localhost:* ws://localhost:* http://127.0.0.1:* http://192.168.*:* http://10.0.2.2:* capacitor://* https://*.vercel.app https://*.onrender.com; object-src 'none'; frame-ancestors 'none'; base-uri 'self';"
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

// Public APK download. Firebase Hosting's free Spark plan rejects .apk files
// outright ("Executable files are forbidden"), so the installable app is
// served from here instead and linked to from the marketing website.
app.use('/downloads', express.static(path.join(__dirname, 'public', 'downloads')));

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
app.use('/api', platformRoutes);

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

    // 2. Sync ADMIN_USERNAME/ADMIN_PASSWORD into Firestore on every boot, so
    // changing them in Render's dashboard takes effect on the very next
    // redeploy rather than waiting for someone to attempt a login first.
    await adminCredentials.syncFromEnv().catch((err) => {
      console.warn(`[AdminCredentials] Startup sync failed: ${err.message}`);
    });

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
