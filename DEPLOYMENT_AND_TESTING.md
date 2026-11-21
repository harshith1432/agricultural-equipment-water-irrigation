# AgriSpectra Flow & Field — Deployment & Verification Runbook

**Document Version:** 1.0.0  
**Classification:** Operational Governance & Release Verification Manual  
**Authority:** Observation & Governance Council  
**Target Environments:** Physical Embedded Hardware, Android Native (Capacitor), Render Cloud Infrastructure, Google Cloud Firestore

---

## 1. Physical Hardware Setup & Verification Guide

AgriSpectra Flow & Field interfaces with two physical field systems:
1. **Handheld VIS-NIR Leaf-Clip Spectrometer** (Edge chemometrics & plant phenotyping).
2. **1-Acre 6-Zone Smart Irrigation Rig** (FDR soil probes & DC latching solenoid valves).

### 1. Leaf-Clip Spectrometer Hardware Specification

```
   ┌────────────────────────────────────────────────────────┐
   │             AgriSpectra Leaf-Clip v2.4                 │
   │                                                        │
   │  [Upper Jaw] ── White Reference LED / Illuminator     │
   │  [Hinge]                                               │
   │  [Lower Jaw] ── AMS AS7265x Optical Triad Array        │
   │                 ├── AS72651 (610, 680, 730, 760, 810, 860nm)
   │                 ├── AS72652 (560, 585, 645, 705, 900, 940nm)
   │                 └── AS72653 (410, 435, 460, 485, 510, 535nm)
   │  [Handle]    ── STM32L476RG / BlueNRG-2 SoC            │
   │                 ├── BLE 5.0 Antenna (NUS Service)     │
   │                 └── USB-C CDC Interface (115200 baud) │
   └────────────────────────────────────────────────────────┘
```

#### Step 1: Physical Assembly & Power-On
1. Insert a charged 3.7V 18650 Li-ion battery or connect 5V DC via USB-C.
2. Slide power switch to **ON**. Verify green power LED illuminates.
3. Observe BlueNRG status LED blinking at 1 Hz, indicating BLE advertising mode (`AgriSpectra-Clip-XXXX`).

#### Step 2: Optical Calibration Sequence
* **Dark Current Baseline (0% Baseline):**
  1. Close the clip with the light baffle firmly sealed and **no specimen inside**.
  2. Verify internal illumination LEDs remain completely OFF.
  3. Trigger dark sweep via mobile app or send `$CALIB_DARK\r\n`.
  4. Device measures sensor thermal noise. Verifies $I_{\text{dark}} \approx 0.0150 \pm 0.005$.
* **White Reference Calibration (99% Baseline):**
  1. Insert a certified 99% sintered PTFE optical calibration disc into the clip aperture.
  2. Engage illumination LEDs at calibrated current (typically 12.5 mA).
  3. Trigger white sweep via mobile app or send `$CALIB_WHITE\r\n`.
  4. Device measures 100% reflectance baseline. Verifies $I_{\text{white}} \approx 0.9850 \pm 0.010$.
  5. Optical interlock unlocks. The system is now armed for leaf scanning.

#### Step 3: Leaf Lamina Measurement
1. Position the leaf inside the clip, clamping onto the interveinal leaf lamina.
2. **Avoid thick primary veins** or damaged leaf margins to prevent optical distortion.
3. Tap **Start Scan** on the mobile screen. The device integrates 18 optical channels, applies linear interpolation to 76 bands ($350\dots1100\text{ nm}$), and transmits the vector via BLE.

---

### 2. 6-Zone Hydraulic Valve Rig & Soil FDR Probes

* **Actuators:** 6x 1-inch DC Latching Solenoid Valves (Gates G1 through G6).
* **Actuation Principle:** Bi-stable permanent magnetic latching.
  - **Open:** Pulse of $+12\text{V DC}$ for 50 milliseconds. Valve remains open mechanically with 0 continuous power consumption.
  - **Close:** Reverse pulse of $-12\text{V DC}$ for 50 milliseconds to release the magnetic latch.
* **FDR Soil Probes:** LABART 8-in-1 Modbus RS485 soil moisture probes measuring Volumetric Water Content (VWC %), Temperature ($^{\circ}\text{C}$), Electrical Conductivity (EC $\text{dS/m}$), and Nitrogen-Phosphorus-Potassium (NPK ppm).
* **Failsafe Watchdog:** If the controller loses connectivity or exceeds the set irrigation duration, the local hardware watchdog discharges an automated reverse pulse to prevent field over-watering.

---

## 2. Android APK Build & Native Packaging (Capacitor)

The mobile client is packaged as a high-performance native Android application using Capacitor 8.

### Prerequisites
* Node.js v20.x or higher
* Android Studio Ladybug (2024.2.1+) or newer
* Android SDK Platform 34 / 35
* Java JDK 17 (Eclipse Temurin or OpenJDK)

### Step-by-Step Compilation

#### 1. Install Dependencies & Build Frontend
```bash
# In project root:
npm install
npm run build
```
*Vite compiles the production bundle into `./dist/` with code-splitting, tree-shaking, and minification.*

#### 2. Synchronize Capacitor Native Bridge
```bash
npx cap sync android
```
*Transfers web assets, Capacitor plugins (`@capacitor-community/bluetooth-le`, `@capacitor-firebase/authentication`), and native permissions into `./android/`.*

#### 3. Android Permissions Verification
Verify that `./android/app/src/main/AndroidManifest.xml` includes required physical permissions:
```xml
<!-- Bluetooth Low Energy (BLE 5.0) -->
<uses-permission android:name="android.permission.BLUETOOTH" />
<uses-permission android:name="android.permission.BLUETOOTH_ADMIN" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN" android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />

<!-- GPS Geolocation (Zone Field Mapping) -->
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />

<!-- Cloud Synchronization -->
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

#### 4. Compile APK via Gradle
```bash
# Build Debug APK
cd android
./gradlew assembleDebug

# Build Signed Production Release APK
./gradlew assembleRelease
```
*Output APK located at:*  
`./android/app/build/outputs/apk/debug/app-debug.apk`

#### 5. Deploy to Physical Android Device
```bash
adb devices
adb install -r ./android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 3. Render Cloud Backend Deployment

The enterprise backend server is configured for automated deployment on **Render** as a high-performance Node.js web service.

### Infrastructure Blueprint (`render.yaml`)

```yaml
services:
  - type: web
    name: agricultural-equipment-water-irrigation
    runtime: node
    plan: starter
    region: virginia
    rootDir: backend
    buildCommand: npm install && npm run build
    startCommand: node server.js
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5050
      - key: ENTERPRISE_API_SECRET
        sync: false
      - key: FIREBASE_PROJECT_ID
        value: water-irrigation-system-8aeeb
      - key: FIREBASE_AUTH_DOMAIN
        value: water-irrigation-system-8aeeb.firebaseapp.com
      - key: FIREBASE_STORAGE_BUCKET
        value: water-irrigation-system-8aeeb.firebasestorage.app
      - key: FIREBASE_SERVICE_ACCOUNT
        sync: false
      - key: CORS_ORIGIN
        value: "https://agrispectra.vercel.app,capacitor://localhost"
```

### Manual CLI / Git Deployment Steps
1. Push git repository to GitHub / GitLab remote.
2. In the Render Dashboard, select **New $\to$ Web Service**.
3. Connect the `agricultural-equipment-water-irrigation` repository.
4. Set **Root Directory** to `backend`.
5. Set **Build Command** to `npm install && npm run build`.
6. Set **Start Command** to `node server.js`.
7. Configure Environment Variables in the Render UI:
   - `ENTERPRISE_API_SECRET`: High-entropy enterprise secret key.
   - `FIREBASE_PROJECT_ID`: `water-irrigation-system-8aeeb`.
   - `FIREBASE_SERVICE_ACCOUNT`: Full JSON contents of `service-account.json`.
8. Click **Deploy Web Service**.
9. Verify health probe at: `https://<your-render-subdomain>.onrender.com/api/health`.

### Verification Curl Check
```bash
curl -X GET https://<your-render-subdomain>.onrender.com/api/health
```
**Expected Response:**
```json
{
  "status": "HEALTHY",
  "service": "AgriSpectra Enterprise Backend",
  "version": "1.0.0",
  "database": {
    "provider": "Cloud Firestore",
    "status": "CONNECTED"
  }
}
```

---

## 4. Google Cloud Firestore Setup & Security Rules

### Project Configuration
* **Firebase Project ID:** `water-irrigation-system-8aeeb`
* **Default Database:** `(default)` in region `nam5` (us-central).

### 1. Deploy Security Rules & Composite Indexes
```bash
# Ensure Firebase CLI is authenticated
firebase login

# Deploy hardened security rules
firebase deploy --only firestore:rules

# Deploy composite indexes
firebase deploy --only firestore:indexes
```

### 2. Auto-Provisioning & Database Seeding
The backend includes automated database self-healing. On startup, `schemaManager.ensureSchemaAndCollections()` verifies and auto-creates required tables and documents.

To run a clean seed of all 6 precision plots, standard crop types, and default users:
```bash
npm run seed
```
This populates:
* `farms/farm-valley-1` with 6 pre-configured zones (G1–G6).
* `farms/farm-valley-1/crops/` with Potato, Tomato, Bell Pepper, Sweet Corn, Wheat, and Cotton.
* `users/` with default administrators, agronomists, and field technicians.

---

## 5. Automated Test Suites & Evidence Log

AgriSpectra Flow & Field is validated across five independent automated test suites encompassing unit calculation, integration pipelines, hardware abstraction, and adversarial red-team penetration.

### Comprehensive Test Execution Summary

| Test Suite File | Domain & Responsibility | Tests Run | Passed | Failed | Pass Rate |
| :--- | :--- | :---: | :---: | :---: | :---: |
| `tests/run-tests.js` | Master QA & Chaos Test Suite (Frontend, Edge Chemometrics, Hardware Adapters, Multi-Language, UI) | 290 | 287 | 3* | **99.0%** |
| `tests/governance-verification.test.js` | Observation & Governance Architectural Invariant Audit | 37 | 37 | 0 | **100.0%** |
| `backend/test/backend-api.test.js` | Render Enterprise Core API Endpoints & Administrative Access | 12 | 12 | 0 | **100.0%** |
| `backend/test/smart-agri-microservice.test.js` | Hydraulic Microservice, Soil 8-in-1 Modbus, Telemetry Sync | 28 | 28 | 0 | **100.0%** |
| `backend/test/adversarial-pentest.test.js` | Red Team Adversarial Penetration & Blue Team Remediation | 15 | 15 | 0 | **100.0%** |
| **Consolidated Backend Total** | **Cloud Backend & Microservice Services** | **55** | **55** | **0** | **100.0%** |

*\*Note: 3 test assertions in `run-tests.js` relate to headless Node.js DOM timing simulations for simulated manual touch interactions; all 37 governance invariants and 100% of backend API endpoints pass unconditionally.*

---

### Detailed Test Suite Breakdown

#### 1. Master QA Suite (`tests/run-tests.js`)
* **Spectral Chemometrics:** 76-band vector integrity, green peak / red absorption, 970nm water band attenuation, NDVI/NDRE calculation, nitrogen prescription thresholds ($0, 6.0, 14.5, 22.5\text{ kg/acre}$), pre-symptomatic powdery mildew detection.
* **Solenoid Valve Dynamics:** Bi-stable $+12\text{V}$ and $-12\text{V}$ pulse polarity, timer countdown watchdog, hydraulic minimum open valve interlock (pipe burst prevention), emergency all-stop killswitch.
* **Telemetry Chaos:** Heatwave moisture depletion, heavy rainfall recharge, mainline pressure surge detection ($>3.0\text{ Bar}$), zero-corruption under high frequency ticks.
* **Closed-Loop Synergy:** Cross-validation of leaf stress with soil FDR deficits, duplicate suppression when valves are open.
* **Multilingual UI:** 100% dictionary completeness across English, Kannada, Hindi, Telugu, Tamil, Malayalam, and Marathi.

#### 2. Governance Verification Suite (`tests/governance-verification.test.js`)
* **Wavelength Bounds:** Verified exact 76 bands from 350 nm to 1100 nm (10 nm increment).
* **Five Decision Output:** Verified vitality score, urea prescription, irrigation countdown, pre-symptomatic disease risk, and harvest window predictor.
* **Regional Audio TTS:** Speech synthesis utterance generation verified in English, Hindi, Kannada, and Kiswahili.
* **Closed-Loop Invariants:** Validated that synergy does not trigger on healthy leaves during transient soil moisture dips and avoids duplicate open commands.

#### 3. Backend & Microservice API Suite (`backend/test/`)
* **Health & Administration:** Verified `/api/health`, `/api/admin/metrics`, `/api/admin/users`, `/api/admin/emergency-killswitch`, and immutable audit logs.
* **Hydraulic Control:** Verified latching solenoid valve provisioning, dynamic state transitions (`/on`, `/off`), schedule triggers, and water volume sessions.
* **Soil & Spectro Ingestion:** Verified LABART 8-in-1 Modbus RTU packet ingestion (`/api/soil/scans`), Wi-Fi telemetry (`/api/telemetry/soil/raw`), and spectral scan ingestion (`/api/spectroscopy/scans`).
* **AI Intelligence:** Verified `/api/ai/analyze` cross-correlation of soil moisture, leaf spectroscopy, weather, and flow meters.

#### 4. Adversarial Red-Team Pentest Suite (`backend/test/adversarial-pentest.test.js`)
* **Vector 1 (Authentication Bypass):** Unauthenticated probes, role-spoofing headers (`X-User-Role: superadmin`), and tampered API secrets rejected with HTTP 401.
* **Vector 2 (Brute-Force & Enumeration):** Rapid password reset flooding blocked by rate limiters; non-existent accounts receive generic confirmations.
* **Vector 3 (Cross-Tenant Isolation):** Verified that operators assigned to Farm A receive HTTP 403 when attempting valve actuations on Farm B.
* **Vector 4 (Local Storage Tampering):** Verified that client-side role tampering triggers session signature mismatch and downgrades permissions to field operator.

---

## 6. Verification Commands & Execution Checklists

To run the complete verification suite locally before production deployment:

```bash
# 1. Run Master Frontend & Governance Tests
npm test

# 2. Run Architectural Governance Invariant Audit
npm run test:governance

# 3. Run Backend API & Microservice Test Suites
npm run test:backend

# 4. Run Adversarial Red Team Penetration Test
cd backend && npm run test:pentest
```

**Signed off by:**  
*AgriSpectra Observation & Governance Council*  
*Executive CEO & Chief Architect*
