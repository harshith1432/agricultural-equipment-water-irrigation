/**
 * Firestore Client Service (AgriSpectra Enterprise Backend)
 * Connects to Google Cloud Firestore (water-irrigation-system-8aeeb) via:
 * 1. Firebase Admin SDK (with FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS)
 * 2. Google Cloud ADC Bearer Token
 * 3. Graceful fallback to local resilient store
 */

import { execSync } from 'child_process';

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

    this.initAdminSdk();
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
    const url = `${this.baseUrl}/${collectionPath}`;
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

    const url = `${this.baseUrl}/${docPath}`;
    try {
      const firestoreFields = {};
      for (const [key, val] of Object.entries(fields)) {
        firestoreFields[key] = this.toFirestoreValue(val);
      }

      const response = await fetch(`${url}?updateMask.fieldPaths=${Object.keys(fields).join('&updateMask.fieldPaths=')}`, {
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
}

export const firestoreClient = new FirestoreClient();
