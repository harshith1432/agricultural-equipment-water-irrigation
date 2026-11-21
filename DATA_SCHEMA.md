# AgriSpectra Flow & Field — Master Data Schema Specification

**Document Version:** 1.0.0  
**Classification:** Official Data Architecture & Contract Specification  
**Authority:** Observation & Governance Council  
**Target Systems:** Cloud Firestore, Render Backend Microservice, Local IndexedDB/LocalStorage, Hardware Drivers

---

## 1. Schema Hierarchy & Collection Taxonomy

AgriSpectra Flow & Field organizes multi-tenant agricultural data into an isolated hierarchical collection model.

```
/farms/{farmId}                                [Root Farm Isolation Chamber]
  ├── /plots/{plotId}                          [6 Micro-Zones: plot-1 to plot-6]
  ├── /crops/{cropId}                          [Agronomic Crop Catalog]
  ├── /spectralScans/{scanId}                  [Authoritative 76-Band Spectral Scans]
  ├── /leafScans/{scanId}                      [Backward Compatibility Mirror]
  ├── /irrigationLogs/{logId}                  [Append-Only Water Volume Ledger]
  └── /actionRecommendations/{recId}           [Closed-Loop Diagnostic Directives]

/users/{userId}                                [Enterprise User Directory & RBAC]
/spectral_scans/{scanId}                       [Central Cloud Mirror Table]
/telemetry_logs/{logId}                        [Environmental & Soil Time Series]
/audit_logs/{auditId}                          [Administrative Action Trail]
```

---

## 2. Spectral Scan Schema: `farms/{farmId}/spectralScans/{scanId}`

The primary document storing raw detector counts, optical calibration references, 76-band reflectance signatures, edge chemometrics indices, and agronomic prescriptions.

### Document Path & Identifiers
* **Collection:** `farms/{farmId}/spectralScans`
* **Document ID (`scanId`):** Format `scan-YYYYMMDD-XXX` (e.g., `scan-20261120-482`)
* **Backward-Compatibility Mirror:** Also saved to `farms/{farmId}/leafScans/{scanId}` and global `spectral_scans/{scanId}`.

### JSON Representation

```json
{
  "id": "scan-20261120-482",
  "farmId": "farm-valley-1",
  "plotId": "plot-2",
  "plotNumber": 2,
  "crop": "Pinot Noir",
  "growthStage": "Fruit Sizing",
  "plantNumber": "PLANT-002",
  "portNumber": "PORT-002",
  "plantName": "Canopy Vine B4",

  "metadata": {
    "hardwareLink": "BLE_NUS",
    "connectionMode": "BLE_NUS",
    "deviceModel": "AgriSpectra Leaf-Clip v2.4",
    "firmwareVersion": "v3.1.8-arm-cortex-m4",
    "opticalSensorArray": "Triad AMS AS72651/AS72652/AS72653",
    "batteryLevelPercent": 94,
    "bleRssiDbm": -62,
    "integrationTimeMs": 150,
    "gainMultiplier": "64x",
    "operatorUid": "usr_oper_004",
    "operatorEmail": "operator.carlos@valleyvineyard.com"
  },

  "geolocation": {
    "latitude": 36.7785000,
    "longitude": -119.4178000,
    "altitudeMeters": 118.4,
    "accuracyMeters": 2.1,
    "mockLocationDetected": false,
    "compassHeadingDegrees": 184.2
  },

  "timestamps": {
    "scannedAt": "2026-11-20T18:25:30.120Z",
    "timestamp": "2026-11-20T18:25:30.120Z",
    "bufferedAt": "2026-11-20T18:25:30.145Z",
    "syncedAt": "2026-11-20T18:25:32.400Z"
  },

  "syncTracking": {
    "syncState": "CONFIRMED_CLOUD",
    "syncAttempts": 1,
    "offlineBuffered": false,
    "localPersistenceKey": "agrispectra_offline_db"
  },

  "calibrationRef": {
    "darkCurrent": 0.0150,
    "whiteReference": 0.9850,
    "calibratedAt": "2026-11-20T18:15:00.000Z",
    "ptfeReflectanceGrade": "99% Certified Optical PTFE",
    "driftScore": 0.002
  },

  "rawHardwareData": {
    "channelCount": 18,
    "raw18Counts": [
      312, 420, 580, 710, 890, 1020,
      450, 490, 390, 680, 1140, 1190,
      180, 210, 260, 290, 340, 380
    ],
    "darkCounts18": [
      12, 14, 15, 16, 18, 19,
      14, 13, 15, 17, 20, 21,
      10, 11, 11, 12, 13, 14
    ],
    "whiteCounts18": [
      1250, 1420, 1680, 1890, 2150, 2300,
      1380, 1450, 1320, 1750, 2400, 2480,
      950, 1020, 1150, 1210, 1290, 1340
    ],
    "environmental": {
      "temperatureCelsius": 23.4,
      "relativeHumidityPercent": 48.2,
      "barometricPressureHpa": 1013.25,
      "ambientLux": 45200
    }
  },

  "processedSpectroscopy": {
    "bandCount": 76,
    "wavelengthMinNm": 350,
    "wavelengthMaxNm": 1100,
    "stepNm": 10,
    "rawReflectance": [
      0.0400, 0.0420, 0.0440, 0.0460, 0.0480, 0.0500, 0.0520, 0.0540,
      0.0580, 0.0650, 0.0750, 0.0900, 0.1150, 0.1380, 0.1450, 0.1400,
      0.1250, 0.1050, 0.0820, 0.0640, 0.0510, 0.0420, 0.0380, 0.0400,
      0.0450, 0.0580, 0.0820, 0.1350, 0.2200, 0.3400, 0.4600, 0.5400,
      0.5800, 0.6050, 0.6200, 0.6280, 0.6320, 0.6350, 0.6370, 0.6380,
      0.6390, 0.6400, 0.6400, 0.6410, 0.6410, 0.6420, 0.6420, 0.6430,
      0.6430, 0.6440, 0.6440, 0.6450, 0.6450, 0.6460, 0.6460, 0.6470,
      0.6470, 0.6480, 0.6480, 0.6490, 0.6490, 0.6120, 0.5820, 0.5510,
      0.5780, 0.6120, 0.6340, 0.6400, 0.6420, 0.6430, 0.6440, 0.6450,
      0.6450, 0.6460, 0.6460, 0.6470
    ]
  },

  "indices": {
    "ndvi": 0.884,
    "ndre": 0.342,
    "wbi": 1.163,
    "lwi": 0.709,
    "cire": 2.380,
    "vitality": 78
  },

  "prescriptions": {
    "nitrogenPrescriptionKg": 6.0,
    "nitrogenFormula": "46-0-0 Urea (Maintenance Top-Dress)",
    "irrigationNeedHours": 4,
    "irrigationUrgency": "CRITICAL",
    "irrigationMessage": "Turgor water band indicates watering required in 4 hours.",
    "diseaseRisk": {
      "detected": false,
      "pathogen": "None (Healthy Tissue)",
      "confidence": 12,
      "severity": "Low",
      "preventativeAction": "Maintain preventive bio-fungicide schedule."
    },
    "harvestWindow": {
      "maturityPercent": 74,
      "daysToPeakHarvest": 10,
      "statusMessage": "Canopy maturity is 74%. Peak harvest window in 10 days."
    }
  }
}
```

---

## 3. Raw Data Schema (AS7265x Triad & Environmental Sensor)

The optical front-end is based on the **AMS AS7265x Triad chipset**, comprising three 6-channel optical spectrometers configured in an integrated leaf-clip:

### 18-Channel Optical Layout

| Index | Sensor IC | Channel Name | Center Wavelength ($\lambda$) | Full-Width Half-Max (FWHM) | Primary Biological Sensitivity |
| :---: | :---: | :---: | :---: | :---: | :--- |
| **0** | AS72651 | `R_610nm` | 610 nm | 20 nm | Chlorophyll-b & Carotenoid Slope |
| **1** | AS72651 | `S_680nm` | 680 nm | 20 nm | Chlorophyll-a Absorption Pit |
| **2** | AS72651 | `T_730nm` | 730 nm | 20 nm | Red Edge Inflection Point |
| **3** | AS72651 | `U_760nm` | 760 nm | 20 nm | Oxygen A-Band / NIR Plateau Onset |
| **4** | AS72651 | `V_810nm` | 810 nm | 20 nm | Mesophyll Cellular Scattering Reference |
| **5** | AS72651 | `W_860nm` | 860 nm | 20 nm | Structural Biomass Reference |
| **6** | AS72652 | `G_560nm` | 560 nm | 20 nm | Chlorophyll Green Reflectance Peak |
| **7** | AS72652 | `H_585nm` | 585 nm | 20 nm | Xanthophyll De-epoxidation Shift |
| **8** | AS72652 | `I_645nm` | 645 nm | 20 nm | Chlorophyll-b Secondary Absorption |
| **9** | AS72652 | `J_705nm` | 705 nm | 20 nm | Red Edge Boundary Marker |
| **10** | AS72652 | `K_900nm` | 900 nm | 20 nm | Water Index Reference Band |
| **11** | AS72652 | `L_940nm` | 940 nm | 20 nm | Secondary Water Vapor Band |
| **12** | AS72653 | `A_410nm` | 410 nm | 20 nm | Violet / Anthocyanin Cutoff |
| **13** | AS72653 | `B_435nm` | 435 nm | 20 nm | Blue Carotenoid Absorption Peak |
| **14** | AS72653 | `C_460nm` | 460 nm | 20 nm | Blue Soret Chlorophyll Band |
| **15** | AS72653 | `D_485nm` | 485 nm | 20 nm | Flavonoid / Phenolic Barrier |
| **16** | AS72653 | `E_510nm` | 510 nm | 20 nm | Photoprotective Carotenoid Index |
| **17** | AS72653 | `F_535nm` | 535 nm | 20 nm | Early Anthocyanin Lesion Shift |

### Environmental Metrics Schema (BME280 / SHT31 Companion Sensor)

| Metric | Field Key | Type | Unit | Range | Resolution |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Ambient Temperature** | `temperatureCelsius` | `number` | $^{\circ}\text{C}$ | $-20.0 \dots 70.0$ | $0.1^{\circ}\text{C}$ |
| **Relative Humidity** | `relativeHumidityPercent` | `number` | $\%$ | $0.0 \dots 100.0$ | $0.1\%$ |
| **Barometric Pressure** | `barometricPressureHpa` | `number` | $\text{hPa}$ | $300.0 \dots 1100.0$ | $0.1\text{ hPa}$ |
| **Ambient Illuminance** | `ambientLux` | `number` | $\text{lux}$ | $0 \dots 150000$ | $1\text{ lux}$ |

---

## 4. Processed Data Schema & Chemometrics Calculations

The edge chemometrics engine transforms raw 18-channel sensor counts into an agronomic intelligence report using five decision algorithms.

### 1. 76-Band Interpolated Curve
* **Wavelength Bounds:** $\lambda \in [350, 1100]\text{ nm}$ with $\Delta\lambda = 10\text{ nm}$.
* **Count:** Exactly 76 floating-point values bounded in $[0.0000, 1.0000]$.
* **Physical Derivation:**
  $$R(\lambda) = \frac{I_{\text{sample}}(\lambda) - I_{\text{dark}}(\lambda)}{I_{\text{white}}(\lambda) - I_{\text{dark}}(\lambda)}$$
  Followed by piecewise linear interpolation across sensor centroids and extrapolation at boundaries ($350\dots410\text{ nm}$ and $940\dots1100\text{ nm}$).

### 2. Normalized Difference Vegetation Index (NDVI)
* **Equation:**
  $$\text{NDVI} = \frac{R_{800} - R_{680}}{\max(0.001, \; R_{800} + R_{680})}$$
* **Unit:** Dimensionless index $[-1.000, 1.000]$ (Healthy crop canopies: $0.650 \dots 0.950$).
* **Significance:** Measures gross canopy biomass, photosynthetic capacity, and leaf area index (LAI).

### 3. Normalized Difference Red Edge (NDRE)
* **Equation:**
  $$\text{NDRE} = \frac{R_{790} - R_{720}}{\max(0.001, \; R_{790} + R_{720})}$$
* **Unit:** Dimensionless index $[-1.000, 1.000]$ (Optimal vegetative canopy: $\ge 0.360$).
* **Significance:** Highly sensitive to mid-to-high chlorophyll concentrations and leaf nitrogen status without saturating like standard NDVI.

### 4. Water Band Index (WBI) & Leaf Water Index (LWI)
* **Equation:**
  $$\text{WBI} = \frac{R_{900}}{\max(0.001, \; R_{970})}$$
  $$\text{LWI} = \text{clamp}\left(0.400, \; 1.100, \; (\text{WBI} - 1.0) \times 2.2 + 0.35\right)$$
* **Unit:** Dimensionless relative hydration factor.
* **Significance:** Measures liquid water absorption across the 970 nm vibrational O-H overtone. Lower reflectance at 970 nm denotes higher internal leaf cellular moisture (turgor).

### 5. Chlorophyll Index Red Edge ($CI_{\text{re}}$)
* **Equation:**
  $$CI_{\text{re}} = \frac{R_{750}}{\max(0.001, \; R_{705})} - 1.0$$
* **Unit:** Dimensionless relative chlorophyll content.

### 6. Crop Vitality Score (0–100 Gauge)
* **Equation:**
  $$\text{Score}_{\text{raw}} = (\text{NDVI} \times 48) + (\text{NDRE} \times 42) + (\min(1.0, \text{LWI}) \times 22) - 2$$
  $$\text{Penalty} = \begin{cases} 6, & \text{if } \frac{R_{550}}{R_{680}} < 2.5 \\ 0, & \text{otherwise} \end{cases}$$
  $$\text{Vitality} = \text{clamp}\left(5, \; 100, \; \text{round}(\text{Score}_{\text{raw}} - \text{Penalty})\right)$$

### 7. Nitrogen Prescription Formulation

| NDRE Threshold | Canopy Nitrogen Status | Recommended Urea (kg/Acre) | Application Timing |
| :--- | :--- | :---: | :--- |
| $\text{NDRE} < 0.25$ | Severe Nitrogen Chlorosis | **$22.5\text{ kg/acre}$** | Immediate foliar spray + fertigation |
| $0.25 \le \text{NDRE} < 0.31$ | Moderate Nitrogen Deficit | **$14.5\text{ kg/acre}$** | Apply before next scheduled watering |
| $0.31 \le \text{NDRE} < 0.36$ | Maintenance Requirement | **$6.0\text{ kg/acre}$** | Include in normal fertigation cycle |
| $\text{NDRE} \ge 0.36$ | Nitrogen Saturated / Optimal | **$0.0\text{ kg/acre}$** | None (prevents nitrate leaching) |

### 8. Irrigation Need Countdown & Urgency Classification

| Leaf Water Index (LWI) | Irrigation Countdown | Urgency Classification | System Interlock Trigger |
| :--- | :---: | :--- | :--- |
| $\text{LWI} < 0.82$ | **4 Hours** | `CRITICAL` | Generates High-Priority Closed-Loop Card |
| $0.82 \le \text{LWI} < 0.89$ | **18 Hours** | `MODERATE_STRESS` | Suggests Morning Valve Cycle |
| $0.89 \le \text{LWI} < 0.94$ | **36 Hours** | `ADEQUATE` | Normal Rotational Cycle |
| $\text{LWI} \ge 0.94$ | **64 Hours** | `SATURATED` | Valve Actuation Inhibited |

---

## 5. Security & Firestore Rules Contract

All writes to `farms/{farmId}/spectralScans/{scanId}` and `farms/{farmId}/leafScans/{scanId}` are governed by `firestore.rules`:

```javascript
match /farms/{farmId}/leafScans/{scanId} {
  allow read: if isFarmMember(farmId);

  allow create: if isFarmOperator(farmId) &&
                   isValidLeafScan(request.resource.data) &&
                   isRecent(request.resource.data.scannedAt);

  allow update: if isFarmManager(farmId) &&
                   isValidLeafScan(request.resource.data) &&
                   areImmutableFieldsUnchanged(['plotId', 'scannedAt']);

  allow delete: if isFarmManager(farmId);
}
```

### Validation Constraints (`isValidLeafScan`)
1. `plotId`: String between 1 and 20 characters (must match `plot-1` ... `plot-6`).
2. `scannedAt`: Valid Timestamp within $[-5\text{ min}, +1\text{ min}]$ of `request.time`.
3. `vitalityScore`: Number bounded in $[0.0, 100.0]$.
4. `leafWaterIndex`: Number bounded in $[0.0, 5.0]$.
5. `nitrogenPrescriptionKg`: Number bounded in $[0.0, 500.0]$.
6. `rawSpectrumPreview`: List of numbers with at most 120 elements.
7. `gpsLocation`: Valid lat/long map within $[-90.0, 90.0]$ and $[-180.0, 180.0]$.
