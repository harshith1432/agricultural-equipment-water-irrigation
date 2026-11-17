/**
 * Firebase App Configuration
 * Reads from environment variables (Vite) or falls back to standard demo project.
 */
import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-mock-key-agrispectra-44812",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agrispectra-flow-field.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agrispectra-flow-field",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agrispectra-flow-field.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "102938475610",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:102938475610:web:89ef82ac398e"
};

// Check if live credentials are configured or if we are in demo/offline mode
export const isLiveFirebaseConfigured = Boolean(
  import.meta.env.VITE_FIREBASE_API_KEY && 
  import.meta.env.VITE_FIREBASE_PROJECT_ID &&
  !import.meta.env.VITE_FIREBASE_API_KEY.includes("demo-agrispectra")
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
