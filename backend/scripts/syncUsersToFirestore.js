/**
 * Cloud Firestore User & Farm Chamber Synchronization Migration Script
 * AgriSpectra Flow & Field Enterprise
 * 
 * Verifies and syncs:
 * 1. Cloud Firestore connection (water-irrigation-system-8aeeb) via service-account.json
 * 2. Root collections: users, farms, telemetry_logs, irrigation_logs, soil_scans, audit_logs, spectral_scans
 * 3. User account: harshithkd0321@gmail.com ("Acchu harshith") as SuperAdmin
 * 4. Dedicated farm chamber (farm-valley-1) with 6 precision agricultural plots (plot-1 to plot-6)
 */

import { firestoreClient } from '../services/firestoreClient.js';
import { schemaManager } from '../services/schemaManager.js';

async function runSync() {
  console.log("==================================================================");
  console.log("🌱 AgriSpectra Enterprise: Cloud Firestore Migration & Sync Script");
  console.log("==================================================================");

  // 1. Initialize and verify Firestore Schema
  const initResult = await schemaManager.ensureSchemaAndCollections();
  console.log("[Migration] Schema init result:", initResult.mode);

  if (!firestoreClient.adminDb) {
    console.error("❌ Firebase Admin SDK not connected. Check backend/service-account.json.");
    process.exit(1);
  }

  // 2. Explicitly provision harshithkd0321@gmail.com ("Acchu harshith")
  console.log("\n[Migration] 👤 Writing user harshithkd0321@gmail.com ('Acchu harshith') to Firestore 'users'...");
  const adminProfile = await schemaManager.saveUserRegistration({
    uid: "system-admin-harshith",
    email: "harshithkd0321@gmail.com",
    displayName: "Acchu harshith",
    name: "Acchu harshith",
    role: "superadmin",
    status: "active",
    farmId: "farm-valley-1",
    farmName: "AgriSpectra Precision Block A (1-Acre High-Density)",
    createdAt: new Date().toISOString()
  });

  // Also write user-acchu-harshith alias
  await schemaManager.saveUserRegistration({
    uid: "user-acchu-harshith",
    email: "harshithkd0321@gmail.com",
    displayName: "Acchu harshith",
    name: "Acchu harshith",
    role: "superadmin",
    status: "active",
    farmId: "farm-valley-1",
    farmName: "AgriSpectra Precision Block A (1-Acre High-Density)",
    createdAt: new Date().toISOString()
  });

  // 3. Trigger full sync
  console.log("\n[Migration] 🔄 Running full user & table synchronization...");
  const syncResult = await schemaManager.syncAllUsersToLiveFirestore();
  console.log(`[Migration] ✓ Synchronized ${syncResult.syncedCount} user profiles.`);

  // 4. Verify live Firestore state directly from database
  console.log("\n[Migration] 🔍 Reading live database state from Cloud Firestore 'users' collection:");
  const usersSnap = await firestoreClient.adminDb.collection('users').get();
  console.log(`[Migration] Found ${usersSnap.size} total user documents in 'users':`);
  usersSnap.docs.forEach(doc => {
    const data = doc.data();
    console.log(`  - [ID: ${doc.id}] ${data.displayName} <${data.email}> (Role: ${data.role}, Farm: ${data.farmId})`);
  });

  // 5. Verify live Firestore plots
  console.log("\n[Migration] 🔍 Reading live plots under 'farms/farm-valley-1/plots':");
  const plotsSnap = await firestoreClient.adminDb.collection('farms').doc('farm-valley-1').collection('plots').get();
  console.log(`[Migration] Found ${plotsSnap.size} plots in farm-valley-1:`);
  plotsSnap.docs.forEach(doc => {
    const p = doc.data();
    console.log(`  - [${doc.id}] ${p.name}: Crop: ${p.crop}, Target: ${p.targetMoisturePercent}%, Current: ${p.currentMoisturePercent}%`);
  });

  console.log("\n==================================================================");
  console.log("✅ Cloud Firestore Synchronization & Auto-Provisioning Successful!");
  console.log("==================================================================");
  process.exit(0);
}

runSync().catch(err => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
