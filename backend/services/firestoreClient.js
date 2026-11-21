/**
 * Firestore Client Service (AgriSpectra Enterprise Backend)
 * Connects to Google Cloud Firestore (water-irrigation-system-8aeeb) via:
 * 1. Firebase Admin SDK (with FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS)
 * 2. Google Cloud ADC Bearer Token
 * 3. Graceful fallback to local resilient store
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

let adminApp = null;
let adminFirestore = null;

async function loadFirebaseAdmin() {
  if (!adminApp) {
    try {
      adminApp = await import('firebase-admin/app');
      adminFirestore = await import('firebase-admin/firestore');
    } catch {
      // Optional in test or serverless environments without cloud credentials
    }
  }
  return { adminApp, adminFirestore };
}

export class FirestoreClient {
  constructor() {
    this.projectId = process.env.FIREBASE_PROJECT_ID || "water-irrigation-system-8aeeb";
    this.apiKey = process.env.FIREBASE_API_KEY || "";
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
    this.cachedToken = null;
    this.tokenExpiry = 0;
    this.isConnected = false;
    this.adminDb = null;
    this.authProvider = "Web API Fallback";

    this.readyPromise = this.initAdminSdk();
  }

  async ensureReady() {
    if (this.readyPromise) {
      await this.readyPromise;
    }
    return this.isConnected;
  }

  /**
   * Automatically initialize Firebase Admin SDK if service account credentials are provided
   */
  async initAdminSdk() {
    try {
      const { adminApp: appModule, adminFirestore: firestoreModule } = await loadFirebaseAdmin();
      if (!appModule || !firestoreModule) return;

      const apps = appModule.getApps();
      if (apps.length > 0) {
        this.adminDb = firestoreModule.getFirestore(apps[0]);
        this.isConnected = true;
        this.authProvider = "Firebase Admin SDK";
        return;
      }

      // 1. Check for local service-account JSON files on disk
      const possiblePaths = [
        path.resolve(process.cwd(), 'service-account.json'),
        path.resolve(process.cwd(), 'backend/service-account.json'),
        path.resolve(process.cwd(), 'water-irrigation-system-8aeeb-firebase-adminsdk-fbsvc-0b4678c042.json'),
        path.resolve(process.cwd(), 'backend/water-irrigation-system-8aeeb-firebase-adminsdk-fbsvc-0b4678c042.json'),
        path.resolve(process.cwd(), 'credentials/water-irrigation-system-8aeeb-firebase-adminsdk-fbsvc-0b4678c042.json')
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          try {
            const raw = fs.readFileSync(p, 'utf8');
            const sa = JSON.parse(raw);
            const app = appModule.initializeApp({
              credential: appModule.cert(sa),
              projectId: sa.project_id || this.projectId
            });
            this.adminDb = firestoreModule.getFirestore(app);
            this.isConnected = true;
            this.authProvider = `Firebase Admin SDK (${path.basename(p)})`;
            console.log(`[FirestoreClient] Initialized Firebase Admin SDK from ${p}`);
            return;
          } catch (e) {
            console.warn(`[FirestoreClient] Failed to load local service account from ${p}:`, e.message);
          }
        }
      }

      // Check for FIREBASE_SERVICE_ACCOUNT environment variable (JSON string or base64)
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        let credStr = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
        let serviceAccount = null;
        if (credStr.startsWith('{')) {
          serviceAccount = JSON.parse(credStr);
        } else {
          const decoded = Buffer.from(credStr, 'base64').toString('utf-8');
          serviceAccount = JSON.parse(decoded);
        }
        const app = appModule.initializeApp({
          credential: appModule.cert(serviceAccount),
          projectId: serviceAccount.project_id || this.projectId
        });
        this.adminDb = firestoreModule.getFirestore(app);
        this.isConnected = true;
        this.authProvider = "Firebase Admin SDK (Service Account)";
        console.log(`[FirestoreClient] Initialized Firebase Admin SDK for ${this.projectId}`);
        return;
      }

      // Check for GOOGLE_APPLICATION_CREDENTIALS
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        const app = appModule.initializeApp({
          credential: appModule.applicationDefault(),
          projectId: this.projectId
        });
        this.adminDb = firestoreModule.getFirestore(app);
        this.isConnected = true;
        this.authProvider = "Firebase Admin SDK (Application Default)";
        console.log(`[FirestoreClient] Initialized Firebase Admin SDK via Application Default`);
        return;
      }

      // Check for discrete environment variables
      if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
        const app = appModule.initializeApp({
          credential: appModule.cert({
            projectId: this.projectId,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
          })
        });
        this.adminDb = firestoreModule.getFirestore(app);
        this.isConnected = true;
        this.authProvider = "Firebase Admin SDK (Credentials)";
        return;
      }
    } catch (err) {
      // Non-fatal: running without service account credentials, will fallback
    }
  }

  /**
   * Acquire or refresh Google Cloud Bearer Token
   */
  getAccessToken() {
    if (this.adminDb) {
      return "firebase-admin-sdk-active";
    }

    const now = Date.now();
    if (this.cachedToken && now < this.tokenExpiry) {
      return this.cachedToken;
    }

    try {
      const token = execSync('gcloud auth print-access-token', {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'ignore']
      }).trim();
      if (token && token.startsWith('ya29.')) {
        this.cachedToken = token;
        this.tokenExpiry = now + 45 * 60 * 1000; // cache for 45 mins
        this.isConnected = true;
        this.authProvider = "Google Cloud ADC Bearer";
        return token;
      }
    } catch {
      // Non-fatal: running without local gcloud CLI or offline
    }
    return null;
  }

  /**
   * Validate and construct a safe Firestore REST API URL
   * Defends against Server-Side Request Forgery (SSRF - CWE-918) and ReDoS (CWE-1333)
   */
  buildSafeFirestoreUrl(relativePath, queryParams = {}) {
    if (!relativePath || typeof relativePath !== 'string') return null;
    const segments = relativePath.split('/').filter(Boolean);
    const ALLOWED_ROOT_COLLECTIONS = new Set(['farms', 'users', 'irrigation_logs', 'telemetry_logs', 'soil_scans', 'spectral_scans', 'crops', 'plots']);
    if (segments.length === 0 || !ALLOWED_ROOT_COLLECTIONS.has(segments[0])) {
      return null;
    }

    // Deterministic loop validation replacing regex to eliminate catastrophic backtracking (ReDoS)
    for (const segment of segments) {
      if (typeof segment !== 'string' || segment.length === 0 || segment.length > 128) {
        return null;
      }
      for (let i = 0; i < segment.length; i++) {
        const code = segment.charCodeAt(i);
        const isAlphaNum = (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
        // Allow alphanumeric, '_', '-', '.', ':'
        if (!isAlphaNum && code !== 95 && code !== 45 && code !== 46 && code !== 58) {
          return null;
        }
      }
    }

    const cleanPath = segments.map(s => encodeURIComponent(s)).join('/');
    const FIRESTORE_ORIGIN = 'https://firestore.googleapis.com';
    const basePath = `/v1/projects/${encodeURIComponent(this.projectId)}/databases/(default)/documents/${cleanPath}`;
    const safeUrl = new URL(basePath, FIRESTORE_ORIGIN);
    if (safeUrl.origin !== FIRESTORE_ORIGIN) {
      return null;
    }
    return safeUrl.href;
  }

  /**
   * Fetch documents from a collection in Firestore
   */
  async getCollection(collectionPath) {
    if (this.adminDb) {
      try {
        const snap = await this.adminDb.collection(collectionPath).get();
        this.isConnected = true;
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK query error: ${err.message}`);
      }
    }

    const token = this.getAccessToken();
    const url = this.buildSafeFirestoreUrl(collectionPath);
    if (!url) return null;
    const headers = { 'Content-Type': 'application/json' };
    if (token && token.startsWith('ya29.')) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        throw new Error(`Firestore REST error: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      this.isConnected = true;
      return (data.documents || []).map(doc => this.fromFirestoreDocument(doc));
    } catch (err) {
      // Return null to signal fallback to local resilient store
      return null;
    }
  }

  /**
   * Check if a collection or subcollection exists and list root collections
   */
  async listCollections() {
    await this.ensureReady();
    if (this.adminDb) {
      try {
        const collections = await this.adminDb.listCollections();
        return collections.map(c => c.id);
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK listCollections error: ${err.message}`);
      }
    }
    return ['farms', 'users'];
  }

  /**
   * Check if a document exists
   */
  async docExists(docPath) {
    await this.ensureReady();
    if (this.adminDb) {
      try {
        const snap = await this.adminDb.doc(docPath).get();
        return snap.exists;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK docExists error: ${err.message}`);
      }
    }
    const token = this.getAccessToken();
    if (!token) return false;
    const url = this.buildSafeFirestoreUrl(docPath);
    if (!url || typeof url !== 'string' || !url.startsWith('https://firestore.googleapis.com/')) return false;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get a single document from Firestore
   */
  async getDoc(docPath) {
    await this.ensureReady();
    if (this.adminDb) {
      try {
        const snap = await this.adminDb.doc(docPath).get();
        if (snap.exists) {
          return { id: snap.id, ...snap.data() };
        }
        return null;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK getDoc error: ${err.message}`);
      }
    }
    const token = this.getAccessToken();
    if (!token) return null;
    const url = this.buildSafeFirestoreUrl(docPath);
    if (!url) return null;
    try {
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) return null;
      const data = await res.json();
      return this.fromFirestoreDocument(data);
    } catch {
      return null;
    }
  }

  /**
   * Update or write document in Firestore with configurable merge
   */
  async setDocument(docPath, fields, options = { merge: true }) {
    await this.ensureReady();
    if (this.adminDb) {
      try {
        await this.adminDb.doc(docPath).set(fields, options);
        this.isConnected = true;
        return true;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK setDocument error: ${err.message}`);
      }
    }
    return this.updateDocument(docPath, fields);
  }

  /**
   * Add a new document with auto-generated ID to a collection
   */
  async addDocument(collectionPath, data) {
    await this.ensureReady();
    if (this.adminDb) {
      try {
        const docRef = await this.adminDb.collection(collectionPath).add({
          ...data,
          createdAt: data.createdAt || new Date().toISOString()
        });
        this.isConnected = true;
        return { success: true, id: docRef.id };
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK addDocument error: ${err.message}`);
      }
    }
    const secureHex = crypto.randomBytes(4).toString('hex');
    const docId = `doc_${Date.now()}_${secureHex}`;
    const ok = await this.setDocument(`${collectionPath}/${docId}`, data, { merge: true });
    return { success: ok, id: docId };
  }

  /**
   * Update or write document in Firestore
   */
  async updateDocument(docPath, fields) {
    if (this.adminDb) {
      try {
        await this.adminDb.doc(docPath).set(fields, { merge: true });
        this.isConnected = true;
        return true;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK write error: ${err.message}`);
      }
    }

    const token = this.getAccessToken();
    if (!token || !token.startsWith('ya29.')) return false;

    const url = this.buildSafeFirestoreUrl(docPath);
    if (!url || typeof url !== 'string' || !url.startsWith('https://firestore.googleapis.com/')) return false;

    try {
      const firestoreFields = {};
      for (const [key, val] of Object.entries(fields)) {
        firestoreFields[key] = this.toFirestoreValue(val);
      }

      const response = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields: firestoreFields })
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Convert Firestore REST value format to plain JS value
   */
  fromFirestoreDocument(doc) {
    const result = { id: doc.name.split('/').pop() };
    if (doc.fields) {
      for (const [key, val] of Object.entries(doc.fields)) {
        result[key] = this.fromFirestoreValue(val);
      }
    }
    return result;
  }

  fromFirestoreValue(val) {
    if ('stringValue' in val) return val.stringValue;
    if ('booleanValue' in val) return val.booleanValue;
    if ('integerValue' in val) return parseInt(val.integerValue, 10);
    if ('doubleValue' in val) return parseFloat(val.doubleValue);
    if ('timestampValue' in val) return val.timestampValue;
    if ('nullValue' in val) return null;
    if ('mapValue' in val) {
      const map = {};
      for (const [k, v] of Object.entries(val.mapValue.fields || {})) {
        map[k] = this.fromFirestoreValue(v);
      }
      return map;
    }
    if ('arrayValue' in val) {
      return (val.arrayValue.values || []).map(v => this.fromFirestoreValue(v));
    }
    return null;
  }

  toFirestoreValue(val) {
    if (val === null || val === undefined) return { nullValue: null };
    if (typeof val === 'boolean') return { booleanValue: val };
    if (typeof val === 'number') {
      if (Number.isInteger(val)) return { integerValue: String(val) };
      return { doubleValue: val };
    }
    if (typeof val === 'string') return { stringValue: val };
    if (val instanceof Date) return { timestampValue: val.toISOString() };
    if (Array.isArray(val)) {
      return { arrayValue: { values: val.map(v => this.toFirestoreValue(v)) } };
    }
    if (typeof val === 'object') {
      const fields = {};
      for (const [k, v] of Object.entries(val)) {
        fields[k] = this.toFirestoreValue(v);
      }
      return { mapValue: { fields } };
    }
    return { stringValue: String(val) };
  }

  /**
   * Check if a spectral scan exists in Firestore under farms/{farmId}/spectralScans/{scanId}
   * Used for idempotency and duplicate prevention
   */
  async spectralScanExists(farmId, scanId) {
    await this.ensureReady();
    const docPath = `farms/${farmId}/spectralScans/${scanId}`;
    if (this.adminDb) {
      try {
        const docRef = this.adminDb.collection('farms').doc(farmId).collection('spectralScans').doc(scanId);
        const snap = await docRef.get();
        return snap.exists;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK spectralScanExists error: ${err.message}`);
      }
    }
    return this.docExists(docPath);
  }

  /**
   * Fetch a spectral scan from farms/{farmId}/spectralScans/{scanId}
   * Transparently resolves reference structure if payload was partitioned
   */
  async getSpectralScan(farmId, scanId) {
    await this.ensureReady();
    const docPath = `farms/${farmId}/spectralScans/${scanId}`;
    if (this.adminDb) {
      try {
        const docRef = this.adminDb.collection('farms').doc(farmId).collection('spectralScans').doc(scanId);
        const snap = await docRef.get();
        if (snap.exists) {
          const docData = { id: snap.id, ...snap.data() };
          // If large payload was offloaded to reference subdoc, fetch and reconstruct
          if (docData.isReferenced && docData.rawDataReference) {
            try {
              const refSnap = await this.adminDb.doc(docData.rawDataReference).get();
              if (refSnap.exists) {
                const refData = refSnap.data();
                docData.rawData = refData.rawData || docData.rawData;
                docData.rawReflectance = refData.rawReflectance || docData.rawReflectance;
              }
            } catch (refErr) {
              console.warn(`[FirestoreClient] Error resolving reference structure: ${refErr.message}`);
            }
          }
          return docData;
        }
        return null;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK getSpectralScan error: ${err.message}`);
      }
    }
    return this.getDoc(docPath);
  }

  /**
   * Securely writes spectral scan to farms/{farmId}/spectralScans/{scanId}
   * Defends against Firestore 1MB document limit by automatically preparing reference structure if needed.
   */
  async saveSpectralScanDoc(farmId, scanId, data, options = { merge: true }) {
    await this.ensureReady();
    const docPath = `farms/${farmId}/spectralScans/${scanId}`;
    let dataToSave = { ...data };

    // Payload size guard: Firestore limit is 1MB (1,048,576 bytes)
    try {
      const jsonStr = JSON.stringify(dataToSave);
      const byteLength = Buffer.byteLength(jsonStr, 'utf8');
      const CHUNK_THRESHOLD = 750 * 1024; // 750 KB safety limit

      if (byteLength > CHUNK_THRESHOLD) {
        console.warn(`[FirestoreClient] Spectral scan '${scanId}' size (${byteLength} bytes) approaches 1MB limit. Offloading raw data to reference subdocument.`);
        const refPath = `${docPath}/chunks/raw_payload`;
        const rawPayload = {
          scanId,
          rawData: dataToSave.rawData || null,
          rawReflectance: dataToSave.rawReflectance || null,
          storedAt: new Date().toISOString()
        };

        if (this.adminDb) {
          await this.adminDb.doc(refPath).set(rawPayload);
        } else {
          await this.setDocument(refPath, rawPayload);
        }

        dataToSave = {
          ...dataToSave,
          isReferenced: true,
          rawDataReference: refPath,
          rawDataSize: byteLength,
          rawDataSummary: {
            bandCount: Array.isArray(dataToSave.rawData?.intensities) ? dataToSave.rawData.intensities.length : (Array.isArray(dataToSave.rawReflectance) ? dataToSave.rawReflectance.length : 0),
            reference: refPath
          }
        };
        delete dataToSave.rawData;
        delete dataToSave.rawReflectance;
      }
    } catch (sizeErr) {
      console.warn(`[FirestoreClient] Size check error: ${sizeErr.message}`);
    }

    if (this.adminDb) {
      try {
        const docRef = this.adminDb.collection('farms').doc(farmId).collection('spectralScans').doc(scanId);
        await docRef.set(dataToSave, options);
        this.isConnected = true;
        return { success: true, docPath, cloudDocumentId: docPath };
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK saveSpectralScanDoc error: ${err.message}`);
      }
    }

    const ok = await this.setDocument(docPath, dataToSave, options);
    return { success: ok, docPath, cloudDocumentId: docPath };
  }

  /**
   * Batch write multiple spectral scans using Firebase Admin SDK batch operations
   */
  async batchSaveSpectralScans(farmId, scansList, options = { merge: true }) {
    await this.ensureReady();
    if (!Array.isArray(scansList) || scansList.length === 0) {
      return [];
    }

    if (this.adminDb) {
      try {
        const CHUNK_SIZE = 400; // Firestore batch write limit is 500
        const results = [];
        for (let i = 0; i < scansList.length; i += CHUNK_SIZE) {
          const chunk = scansList.slice(i, i + CHUNK_SIZE);
          const batch = this.adminDb.batch();
          for (const item of chunk) {
            const scanId = item.scanId || item.id;
            const docRef = this.adminDb.collection('farms').doc(farmId).collection('spectralScans').doc(scanId);
            batch.set(docRef, item, options);
          }
          await batch.commit();
          for (const item of chunk) {
            const scanId = item.scanId || item.id;
            results.push({
              success: true,
              scanId,
              cloudDocumentId: `farms/${farmId}/spectralScans/${scanId}`,
              syncedAt: item.syncedAt || new Date().toISOString()
            });
          }
        }
        this.isConnected = true;
        return results;
      } catch (err) {
        console.warn(`[FirestoreClient] Admin SDK batch error: ${err.message}, falling back to sequential writes`);
      }
    }

    // Fallback sequential
    const fallbackResults = [];
    for (const item of scansList) {
      const scanId = item.scanId || item.id;
      const res = await this.saveSpectralScanDoc(farmId, scanId, item, options);
      fallbackResults.push({
        success: res.success,
        scanId,
        cloudDocumentId: `farms/${farmId}/spectralScans/${scanId}`,
        syncedAt: item.syncedAt || new Date().toISOString()
      });
    }
    return fallbackResults;
  }
}

export const firestoreClient = new FirestoreClient();
