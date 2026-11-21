/**
 * Firebase App Configuration
 * Reads from environment variables (Vite) or falls back to the configured project.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentSingleTabManager 
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_API_KEY) || "",
  authDomain: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN) || "water-irrigation-system-8aeeb.firebaseapp.com",
  projectId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_PROJECT_ID) || "water-irrigation-system-8aeeb",
  storageBucket: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET) || "water-irrigation-system-8aeeb.firebasestorage.app",
  messagingSenderId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID) || "160643566396",
  appId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_APP_ID) || "1:160643566396:web:62dedea727308c050d6c39",
  measurementId: (typeof import.meta !== 'undefined' && import.meta.env?.VITE_FIREBASE_MEASUREMENT_ID) || "G-VYL5W9P5NF"
};

// True when live credentials are set and not a demo placeholder
export const isLiveFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes("demo-agrispectra")
);

let app = null;
let db = null;
let auth = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

  // Initialize Firestore with persistent offline cache in browser environments
  if (typeof window !== 'undefined' && typeof indexedDB !== 'undefined') {
    try {
      db = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager()
        })
      });
    } catch (e) {
      db = getFirestore(app);
    }
  } else {
    db = getFirestore(app);
  }

  // Initialize modular Firebase Authentication
  try {
    auth = getAuth(app);
  } catch (e) {
    console.info("[Firebase Auth] Auth initialization note:", e.message);
  }
} catch (e) {
  console.info("[Firebase] Client initialization note:", e.message);
}

export { app, db, auth };
