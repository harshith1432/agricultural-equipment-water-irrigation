/**
 * Firebase App Configuration
 * Reads from environment variables (Vite) or falls back to the configured project.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "water-irrigation-system-8aeeb.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "water-irrigation-system-8aeeb",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "water-irrigation-system-8aeeb.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "160643566396",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:160643566396:web:62dedea727308c050d6c39",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VYL5W9P5NF"
};

// True when live credentials are set and not a demo placeholder
export const isLiveFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  !firebaseConfig.apiKey.includes("demo-agrispectra")
);

let app = null;
let db = null;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  db = getFirestore(app);
} catch (e) {
  console.info("[Firebase] Client initialization note:", e.message);
}

export { app, db };
