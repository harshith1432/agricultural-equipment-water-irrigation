/**
 * Firestore Client Service (AgriSpectra Enterprise Backend)
 * Connects directly to Google Cloud Firestore REST API for project 'water-irrigation-system-8aeeb'
 * Uses Google Cloud ADC token or API Key with automatic offline memory cache fallback.
 */

import { execSync } from 'child_process';

export class FirestoreClient {
  constructor() {
    this.projectId = process.env.FIREBASE_PROJECT_ID || "water-irrigation-system-8aeeb";
    this.apiKey = process.env.FIREBASE_API_KEY || "AIzaSyBm_aZ_92IJwSuX4YHgWh6eca4ygQSH8eE";
    this.baseUrl = `https://firestore.googleapis.com/v1/projects/${this.projectId}/databases/(default)/documents`;
    this.cachedToken = null;
    this.tokenExpiry = 0;
    this.isConnected = false;
  }

  /**
   * Acquire or refresh Google Cloud Bearer Token
   */
  getAccessToken() {
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
    const token = this.getAccessToken();
    const url = `${this.baseUrl}/${collectionPath}`;
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
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
    const token = this.getAccessToken();
    if (!token) return false;

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
