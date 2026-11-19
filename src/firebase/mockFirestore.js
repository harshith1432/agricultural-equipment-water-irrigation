/**
 * Reactive In-Memory & LocalStorage Persisted Multi-Tenant Firestore Store
 * Implements real-time Firestore NoSQL API semantics (onSnapshot, updateDoc, setDoc, addDoc)
 * Ensures instantaneous out-of-the-box operation, offline resilience, and strict user/farm isolation chambers.
 */

export const PRIMARY_STORAGE_KEY = "agrispectra_offline_db";
export const LEGACY_STORAGE_KEY = "AGRISPECTRA_FIRESTORE_DATA_V2";
const STORAGE_KEY = PRIMARY_STORAGE_KEY;
export const USER_PREFS_STORAGE_KEY = "agrispectra_user_prefs";

export const PRESEEDED_CROPS = {
  "crop-potato": {
    id: "crop-potato",
    name: "Potato",
    scientificName: "Solanum tuberosum",
    optimalVwcMin: 22.0,
    optimalVwcMax: 35.0,
    optimalPhMin: 5.5,
    optimalPhMax: 6.5,
    targetNitrogen: 140,
    growthStages: ["Sprouting", "Vegetative", "Tuber Initiation", "Tuber Bulking", "Maturation"],
    category: "Tubers",
    defaultCycleDays: 90,
    areaHaDefault: 1.4,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-tomato": {
    id: "crop-tomato",
    name: "Tomato",
    scientificName: "Solanum lycopersicum",
    optimalVwcMin: 20.0,
    optimalVwcMax: 32.0,
    optimalPhMin: 6.0,
    optimalPhMax: 6.8,
    targetNitrogen: 120,
    growthStages: ["Germination", "Vegetative", "Flowering", "Fruit Sizing", "Ripening"],
    category: "Vegetables",
    defaultCycleDays: 90,
    areaHaDefault: 1.2,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-bell-pepper": {
    id: "crop-bell-pepper",
    name: "Bell Pepper",
    scientificName: "Capsicum annuum",
    optimalVwcMin: 22.0,
    optimalVwcMax: 34.0,
    optimalPhMin: 6.0,
    optimalPhMax: 7.0,
    targetNitrogen: 110,
    growthStages: ["Seedling", "Vegetative", "Budding", "Fruiting", "Harvest"],
    category: "Vegetables",
    defaultCycleDays: 85,
    areaHaDefault: 1.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-sweet-corn": {
    id: "crop-sweet-corn",
    name: "Sweet Corn",
    scientificName: "Zea mays var. saccharata",
    optimalVwcMin: 24.0,
    optimalVwcMax: 38.0,
    optimalPhMin: 5.8,
    optimalPhMax: 7.0,
    targetNitrogen: 160,
    growthStages: ["Emergence", "V4-V8 Vegetative", "Tasseling & Silking", "Blister/Milk", "Maturity"],
    category: "Cereals",
    defaultCycleDays: 75,
    areaHaDefault: 1.6,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-wheat": {
    id: "crop-wheat",
    name: "Wheat",
    scientificName: "Triticum aestivum",
    optimalVwcMin: 18.0,
    optimalVwcMax: 28.0,
    optimalPhMin: 6.0,
    optimalPhMax: 7.5,
    targetNitrogen: 120,
    growthStages: ["Germination", "Tillering", "Stem Elongation", "Booting & Heading", "Grain Fill & Ripening"],
    category: "Cereals",
    defaultCycleDays: 120,
    areaHaDefault: 2.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-cotton": {
    id: "crop-cotton",
    name: "Cotton",
    scientificName: "Gossypium hirsutum",
    optimalVwcMin: 20.0,
    optimalVwcMax: 30.0,
    optimalPhMin: 5.8,
    optimalPhMax: 7.5,
    targetNitrogen: 150,
    growthStages: ["Emergence", "Squaring", "Flowering & Boll Setting", "Boll Maturation", "Defoliation & Opening"],
    category: "Cash Crops",
    defaultCycleDays: 150,
    areaHaDefault: 2.5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-sugarcane": {
    id: "crop-sugarcane",
    name: "Sugarcane",
    scientificName: "Saccharum officinarum",
    optimalVwcMin: 28.0,
    optimalVwcMax: 42.0,
    optimalPhMin: 6.0,
    optimalPhMax: 7.5,
    targetNitrogen: 200,
    growthStages: ["Germination", "Tillering", "Grand Growth", "Ripening & Sugar Accumulation"],
    category: "Cash Crops",
    defaultCycleDays: 360,
    areaHaDefault: 3.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-paddy-rice": {
    id: "crop-paddy-rice",
    name: "Paddy Rice",
    scientificName: "Oryza sativa",
    optimalVwcMin: 35.0,
    optimalVwcMax: 50.0,
    optimalPhMin: 5.0,
    optimalPhMax: 6.5,
    targetNitrogen: 130,
    growthStages: ["Seedling", "Tillering", "Panicle Initiation", "Flowering/Heading", "Dough & Ripening"],
    category: "Cereals",
    defaultCycleDays: 120,
    areaHaDefault: 1.8,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-chilli": {
    id: "crop-chilli",
    name: "Chilli",
    scientificName: "Capsicum frutescens",
    optimalVwcMin: 20.0,
    optimalVwcMax: 32.0,
    optimalPhMin: 6.0,
    optimalPhMax: 7.0,
    targetNitrogen: 100,
    growthStages: ["Seedling", "Vegetative Growth", "Flowering", "Pod Development", "Red Ripe Maturation"],
    category: "Vegetables / Spices",
    defaultCycleDays: 100,
    areaHaDefault: 0.8,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-groundnut": {
    id: "crop-groundnut",
    name: "Groundnut",
    scientificName: "Arachis hypogaea",
    optimalVwcMin: 18.0,
    optimalVwcMax: 28.0,
    optimalPhMin: 5.8,
    optimalPhMax: 6.8,
    targetNitrogen: 40,
    growthStages: ["Emergence", "Vegetative", "Flowering & Pegging", "Pod Development", "Maturity"],
    category: "Oilseeds / Legumes",
    defaultCycleDays: 110,
    areaHaDefault: 1.5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  },
  "crop-soybean": {
    id: "crop-soybean",
    name: "Soybean",
    scientificName: "Glycine max",
    optimalVwcMin: 22.0,
    optimalVwcMax: 32.0,
    optimalPhMin: 6.0,
    optimalPhMax: 7.0,
    targetNitrogen: 60,
    growthStages: ["Emergence", "Vegetative Branches", "Flowering (R1-R2)", "Pod Development (R3-R4)", "Seed Fill (R5-R6)", "Full Maturity"],
    category: "Oilseeds / Legumes",
    defaultCycleDays: 100,
    areaHaDefault: 2.0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  }
};

export const DEFAULT_USER_PREFERENCES = {
  theme: "dark",
  telemetryRefreshRateMs: 3000,
  preferredPlotId: "plot-1",
  notificationsEnabled: true,
  offlineAutoSync: true,
  unitSystem: "metric",
  language: "en",
  autoRecommendationApproval: false,
  hapticFeedback: true
};

// =========================================================================
// Persona Chamber 1: Carlos Mendoza (Sonoma Valley Drip Vineyard)
// =========================================================================
export const SEED_CARLOS_FARM = {
  farmId: "farm-carlos-valley-1",
  name: "Sonoma Valley Drip Vineyard",
  totalArea: "1.00 Acre (6 Zones)",
  location: { latitude: 38.2919, longitude: -122.4580 },
  createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
  ownerId: "user-carlos-1",
  managers: ["user-carlos-1", "usr-ent-02"],
  operators: ["user-mateo-3"],
  members: ["user-elena-2"],
  plots: {
    "plot-1": {
      id: "plot-1",
      name: "Zone 1 - Potato Field Zone",
      plotNumber: 1,
      crop: "Potato Crop",
      stage: "Tuber Bulking & Maturity",
      targetVwcMin: 22.0,
      targetVwcMax: 35.0,
      plantAgeDays: 63,
      totalCycleDays: 83,
      daysToHarvest: 20,
      areaHa: 1.4,
      projectedYieldTons: 7.0,
      currentHeightCm: 74,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 30, label: "Day 15" },
        { day: 30, heightCm: 45, label: "Day 30" },
        { day: 45, heightCm: 60, label: "Day 45" },
        { day: 60, heightCm: 72, label: "Day 60" },
        { day: 75, heightCm: 82, label: "Day 75" },
        { day: 90, heightCm: 88, label: "Day 90" }
      ],
      valve: {
        id: "G1",
        state: "CLOSED",
        flowRate: 480.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S1_10cm", depthCm: 10, vwc: 24.8, temperature: 22.8, salinityEc: 1.15, lastUpdated: new Date().toISOString() },
        { probeId: "S1_30cm", depthCm: 30, vwc: 28.2, temperature: 21.4, salinityEc: 1.05, lastUpdated: new Date().toISOString() },
        { probeId: "S1_50cm", depthCm: 50, vwc: 31.0, temperature: 20.1, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-2": {
      id: "plot-2",
      name: "Zone 2 - Heirloom Tomatoes Block",
      plotNumber: 2,
      crop: "Heirloom Tomatoes",
      stage: "Fruit Sizing & Ripening",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      plantAgeDays: 54,
      totalCycleDays: 90,
      daysToHarvest: 36,
      areaHa: 1.2,
      projectedYieldTons: 9.5,
      currentHeightCm: 68,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 22, label: "Day 15" },
        { day: 30, heightCm: 42, label: "Day 30" },
        { day: 45, heightCm: 58, label: "Day 45" },
        { day: 60, heightCm: 70, label: "Day 60" },
        { day: 75, heightCm: 85, label: "Day 75" },
        { day: 90, heightCm: 92, label: "Day 90" }
      ],
      valve: {
        id: "G2",
        state: "CLOSED",
        flowRate: 520.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S2_10cm", depthCm: 10, vwc: 13.8, temperature: 27.8, salinityEc: 1.85, lastUpdated: new Date().toISOString() },
        { probeId: "S2_30cm", depthCm: 30, vwc: 17.2, temperature: 25.1, salinityEc: 1.60, lastUpdated: new Date().toISOString() },
        { probeId: "S2_50cm", depthCm: 50, vwc: 22.0, temperature: 22.0, salinityEc: 1.30, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-3": {
      id: "plot-3",
      name: "Zone 3 - Bell Pepper High-Tunnel",
      plotNumber: 3,
      crop: "Bell Pepper",
      stage: "Fruiting",
      targetVwcMin: 22.0,
      targetVwcMax: 34.0,
      plantAgeDays: 48,
      totalCycleDays: 85,
      daysToHarvest: 37,
      areaHa: 1.0,
      projectedYieldTons: 6.8,
      currentHeightCm: 55,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 18, label: "Day 15" },
        { day: 30, heightCm: 35, label: "Day 30" },
        { day: 45, heightCm: 50, label: "Day 45" },
        { day: 60, heightCm: 65, label: "Day 60" },
        { day: 75, heightCm: 72, label: "Day 75" },
        { day: 90, heightCm: 75, label: "Day 90" }
      ],
      valve: {
        id: "G3",
        state: "CLOSED",
        flowRate: 440.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S3_10cm", depthCm: 10, vwc: 26.5, temperature: 23.0, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
        { probeId: "S3_30cm", depthCm: 30, vwc: 29.0, temperature: 21.5, salinityEc: 0.98, lastUpdated: new Date().toISOString() },
        { probeId: "S3_50cm", depthCm: 50, vwc: 32.0, temperature: 20.2, salinityEc: 0.88, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-4": {
      id: "plot-4",
      name: "Zone 4 - Sweet Corn Block",
      plotNumber: 4,
      crop: "Sweet Corn",
      stage: "Tasseling & Silking",
      targetVwcMin: 24.0,
      targetVwcMax: 38.0,
      plantAgeDays: 48,
      totalCycleDays: 75,
      daysToHarvest: 27,
      areaHa: 1.6,
      projectedYieldTons: 12.0,
      currentHeightCm: 145,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 35, label: "Day 15" },
        { day: 30, heightCm: 80, label: "Day 30" },
        { day: 45, heightCm: 130, label: "Day 45" },
        { day: 60, heightCm: 170, label: "Day 60" },
        { day: 75, heightCm: 195, label: "Day 75" },
        { day: 90, heightCm: 210, label: "Day 90" }
      ],
      valve: {
        id: "G4",
        state: "CLOSED",
        flowRate: 610.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S4_10cm", depthCm: 10, vwc: 31.2, temperature: 22.5, salinityEc: 1.05, lastUpdated: new Date().toISOString() },
        { probeId: "S4_30cm", depthCm: 30, vwc: 34.0, temperature: 21.0, salinityEc: 0.92, lastUpdated: new Date().toISOString() },
        { probeId: "S4_50cm", depthCm: 50, vwc: 36.5, temperature: 19.8, salinityEc: 0.81, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-5": {
      id: "plot-5",
      name: "Zone 5 - Amber Durum Wheat",
      plotNumber: 5,
      crop: "Wheat",
      stage: "Grain Fill & Ripening",
      targetVwcMin: 18.0,
      targetVwcMax: 28.0,
      plantAgeDays: 95,
      totalCycleDays: 120,
      daysToHarvest: 25,
      areaHa: 2.0,
      projectedYieldTons: 8.5,
      currentHeightCm: 85,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 15, label: "Day 15" },
        { day: 30, heightCm: 35, label: "Day 30" },
        { day: 45, heightCm: 55, label: "Day 45" },
        { day: 60, heightCm: 70, label: "Day 60" },
        { day: 75, heightCm: 80, label: "Day 75" },
        { day: 90, heightCm: 85, label: "Day 90" }
      ],
      valve: {
        id: "G5",
        state: "CLOSED",
        flowRate: 390.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S5_10cm", depthCm: 10, vwc: 21.0, temperature: 24.0, salinityEc: 1.15, lastUpdated: new Date().toISOString() },
        { probeId: "S5_30cm", depthCm: 30, vwc: 24.0, temperature: 22.5, salinityEc: 1.00, lastUpdated: new Date().toISOString() },
        { probeId: "S5_50cm", depthCm: 50, vwc: 26.5, temperature: 21.0, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-6": {
      id: "plot-6",
      name: "Zone 6 - Pima Cotton Parcel",
      plotNumber: 6,
      crop: "Cotton",
      stage: "Flowering & Boll Setting",
      targetVwcMin: 20.0,
      targetVwcMax: 30.0,
      plantAgeDays: 110,
      totalCycleDays: 150,
      daysToHarvest: 40,
      areaHa: 2.5,
      projectedYieldTons: 11.0,
      currentHeightCm: 105,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 20, label: "Day 15" },
        { day: 30, heightCm: 45, label: "Day 30" },
        { day: 45, heightCm: 70, label: "Day 45" },
        { day: 60, heightCm: 90, label: "Day 60" },
        { day: 75, heightCm: 100, label: "Day 75" },
        { day: 90, heightCm: 105, label: "Day 90" }
      ],
      valve: {
        id: "G6",
        state: "CLOSED",
        flowRate: 350.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S6_10cm", depthCm: 10, vwc: 23.5, temperature: 25.0, salinityEc: 1.20, lastUpdated: new Date().toISOString() },
        { probeId: "S6_30cm", depthCm: 30, vwc: 26.0, temperature: 23.0, salinityEc: 1.05, lastUpdated: new Date().toISOString() },
        { probeId: "S6_50cm", depthCm: 50, vwc: 28.5, temperature: 21.5, salinityEc: 0.92, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  leafScans: [
    {
      id: "scan-plot2-stress-01",
      plotId: "plot-2",
      crop: "Heirloom Tomatoes",
      scannedAt: new Date(Date.now() - 18 * 60000).toISOString(),
      vitalityScore: 54.2,
      leafWaterIndex: 0.62,
      nitrogenPrescriptionKg: 14.5,
      rawSpectrumPreview: [0.06, 0.07, 0.14, 0.22, 0.18, 0.45, 0.58, 0.59, 0.38, 0.52],
      diseaseRisk: {
        pathogen: "Early Powdery Mildew",
        confidence: 84.5,
        preventativeAction: "Apply Potassium Bicarbonate foliar spray."
      },
      gpsLocation: { latitude: 38.2920, longitude: -122.4582 },
      scannedBy: "user-carlos-1",
      notes: "Canopy upper foliage shows severe cellular dehydration and incipient fungal conidia."
    },
    {
      id: "scan-plot1-optimal-01",
      plotId: "plot-1",
      crop: "Potato Crop",
      scannedAt: new Date(Date.now() - 52 * 60000).toISOString(),
      vitalityScore: 89.4,
      leafWaterIndex: 1.82,
      nitrogenPrescriptionKg: 0.0,
      rawSpectrumPreview: [0.05, 0.06, 0.13, 0.15, 0.08, 0.46, 0.61, 0.63, 0.49, 0.55],
      diseaseRisk: null,
      gpsLocation: { latitude: 38.2918, longitude: -122.4579 },
      scannedBy: "user-carlos-1",
      notes: "High chlorophyll density, robust turgor pressure across south canopy."
    }
  ],
  irrigationLogs: [
    {
      id: "log-irr-101",
      plotId: "plot-1",
      valveId: "G1",
      action: "CLOSE",
      durationMinutes: 15.0,
      litersDelivered: 112.5,
      triggeredBy: "MANUAL",
      timestamp: new Date(Date.now() - 3600000 * 6).toISOString(),
      operatorId: "user-carlos-1",
      notes: "Pre-sunrise baseline pulse across South High-Tunnel"
    },
    {
      id: "log-irr-102",
      plotId: "plot-4",
      valveId: "G4",
      action: "CLOSE",
      durationMinutes: 20.0,
      litersDelivered: 203.3,
      triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      operatorId: "user-carlos-1",
      notes: "Autonomous replenishment following high mid-morning evapotranspiration"
    },
    {
      id: "log-irr-103",
      plotId: "plot-3",
      valveId: "G3",
      action: "CLOSE",
      durationMinutes: 12.0,
      litersDelivered: 88.0,
      triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
      timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
      operatorId: "user-carlos-1",
      notes: "Cooling foliar micro-burst for high tunnel"
    },
    {
      id: "log-irr-104",
      plotId: "plot-6",
      valveId: "G6",
      action: "CLOSE",
      durationMinutes: 18.0,
      litersDelivered: 105.0,
      triggeredBy: "MANUAL_TOUCH",
      timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
      operatorId: "user-carlos-1",
      notes: "Cotton deep parcel wetting verification"
    }
  ],
  actionRecommendations: [
    {
      id: "rec-plot1-optimal-01",
      plotId: "plot-1",
      plotNumber: 1,
      crop: "Potato Crop",
      gateId: "G1",
      status: "PENDING",
      generatedAt: new Date(Date.now() - 5 * 60000).toISOString(),
      title: "Potato Field Zone Optimal Hydration",
      details: "Irrigation is recommended to ensure optimal growth during tuber bulking stage. 1.4 ha parcel target delivery.",
      triggerReason: "Irrigation is recommended to ensure optimal growth",
      suggestedAction: "OPEN",
      suggestedDurationMinutes: 20.0,
      nitrogenPrescriptionKg: 10.0,
      leafScanId: "scan-plot1-pot-01"
    },
    {
      id: "rec-plot2-urgent-01",
      plotId: "plot-2",
      plotNumber: 2,
      crop: "Heirloom Tomatoes",
      gateId: "G2",
      status: "PENDING",
      generatedAt: new Date(Date.now() - 15 * 60000).toISOString(),
      title: "Urgent Drip Hydration & Nitrogen Foliar Correction",
      details: "Handheld spectroscopy detected acute leaf dehydration (LWI 0.62, Vitality 54%). 10cm FDR probe confirms critical moisture deficit at 13.8% (Target: >20.0%).",
      triggerReason: "Plot 2 leaf stress (LWI 0.62, Vitality 54%) confirmed by 13.8% FDR soil moisture (Target: >20.0%).",
      suggestedAction: "OPEN",
      suggestedDurationMinutes: 25.0,
      nitrogenPrescriptionKg: 14.5,
      leafScanId: "scan-plot2-stress-01",
      diseaseAlert: {
        detected: true,
        pathogen: "Early Powdery Mildew",
        confidence: 84.5,
        preventativeAction: "Apply Potassium Bicarbonate foliar spray."
      }
    }
  ],
  crops: JSON.parse(JSON.stringify(PRESEEDED_CROPS))
};

export const INITIAL_FARM_DATA = SEED_CARLOS_FARM;

// =========================================================================
// Persona Chamber 2: Dr. Elena Rostova (Salinas Agronomy Research Hub)
// =========================================================================
export const SEED_ELENA_FARM = {
  farmId: "farm-elena-research-2",
  name: "Salinas Agronomy Research Hub",
  totalArea: "4.50 Hectares (Research Experimental Plots)",
  location: { latitude: 36.6777, longitude: -121.6555 },
  createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
  ownerId: "user-elena-2",
  managers: ["user-elena-2"],
  operators: ["usr-ent-02"],
  members: [],
  plots: {
    "plot-elena-1": {
      id: "plot-elena-1",
      name: "Trial Sector A - Sugarcane Clones",
      plotNumber: 1,
      crop: "Sugarcane",
      stage: "Grand Growth",
      targetVwcMin: 28.0,
      targetVwcMax: 42.0,
      plantAgeDays: 120,
      totalCycleDays: 360,
      daysToHarvest: 240,
      areaHa: 1.8,
      projectedYieldTons: 85.0,
      currentHeightCm: 180,
      valve: { id: "G1", state: "CLOSED", flowRate: 450.0, timerEnd: null },
      soilSensors: [
        { probeId: "SE1_10cm", depthCm: 10, vwc: 32.5, temperature: 21.0, salinityEc: 1.05, lastUpdated: new Date().toISOString() },
        { probeId: "SE1_30cm", depthCm: 30, vwc: 35.0, temperature: 20.0, salinityEc: 0.95, lastUpdated: new Date().toISOString() },
        { probeId: "SE1_50cm", depthCm: 50, vwc: 38.0, temperature: 19.0, salinityEc: 0.85, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-elena-2": {
      id: "plot-elena-2",
      name: "Trial Sector B - Paddy Rice Hydroponics",
      plotNumber: 2,
      crop: "Paddy Rice",
      stage: "Panicle Initiation",
      targetVwcMin: 35.0,
      targetVwcMax: 50.0,
      plantAgeDays: 60,
      totalCycleDays: 120,
      daysToHarvest: 60,
      areaHa: 1.5,
      projectedYieldTons: 14.0,
      currentHeightCm: 75,
      valve: { id: "G2", state: "CLOSED", flowRate: 500.0, timerEnd: null },
      soilSensors: [
        { probeId: "SE2_10cm", depthCm: 10, vwc: 42.0, temperature: 22.0, salinityEc: 0.90, lastUpdated: new Date().toISOString() },
        { probeId: "SE2_30cm", depthCm: 30, vwc: 44.5, temperature: 21.5, salinityEc: 0.85, lastUpdated: new Date().toISOString() },
        { probeId: "SE2_50cm", depthCm: 50, vwc: 47.0, temperature: 20.5, salinityEc: 0.80, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-elena-3": {
      id: "plot-elena-3",
      name: "Trial Sector C - Bio-Fortified Chilli",
      plotNumber: 3,
      crop: "Chilli",
      stage: "Pod Development",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      plantAgeDays: 70,
      totalCycleDays: 100,
      daysToHarvest: 30,
      areaHa: 1.2,
      projectedYieldTons: 8.0,
      currentHeightCm: 65,
      valve: { id: "G3", state: "CLOSED", flowRate: 360.0, timerEnd: null },
      soilSensors: [
        { probeId: "SE3_10cm", depthCm: 10, vwc: 24.0, temperature: 24.0, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
        { probeId: "SE3_30cm", depthCm: 30, vwc: 26.5, temperature: 22.5, salinityEc: 1.00, lastUpdated: new Date().toISOString() },
        { probeId: "SE3_50cm", depthCm: 50, vwc: 29.0, temperature: 21.0, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  leafScans: [
    {
      id: "scan-elena-101",
      plotId: "plot-elena-1",
      crop: "Sugarcane",
      scannedAt: new Date(Date.now() - 30 * 60000).toISOString(),
      vitalityScore: 94.5,
      leafWaterIndex: 1.95,
      nitrogenPrescriptionKg: 0.0,
      rawSpectrumPreview: [0.04, 0.05, 0.12, 0.18, 0.10, 0.48, 0.65, 0.68, 0.52, 0.58],
      diseaseRisk: null,
      gpsLocation: { latitude: 36.6780, longitude: -121.6560 },
      scannedBy: "user-elena-2",
      notes: "Exceptional vigor in transgenic drought-resistant sugarcane clone R-44."
    }
  ],
  irrigationLogs: [
    {
      id: "log-elena-101",
      plotId: "plot-elena-2",
      valveId: "G2",
      action: "CLOSE",
      durationMinutes: 25.0,
      litersDelivered: 208.3,
      triggeredBy: "RESEARCH_AUTOMATION",
      timestamp: new Date(Date.now() - 3600000 * 3).toISOString(),
      operatorId: "user-elena-2",
      notes: "Scheduled flooding for hydroponic rice rhizosphere"
    }
  ],
  actionRecommendations: [],
  crops: {
    "crop-sugarcane": JSON.parse(JSON.stringify(PRESEEDED_CROPS["crop-sugarcane"])),
    "crop-paddy-rice": JSON.parse(JSON.stringify(PRESEEDED_CROPS["crop-paddy-rice"])),
    "crop-chilli": JSON.parse(JSON.stringify(PRESEEDED_CROPS["crop-chilli"])),
    "crop-groundnut": JSON.parse(JSON.stringify(PRESEEDED_CROPS["crop-groundnut"])),
    "crop-soybean": JSON.parse(JSON.stringify(PRESEEDED_CROPS["crop-soybean"]))
  }
};

// =========================================================================
// Persona Chamber 3: Mateo Silva (Central Valley Hydraulic Orchard)
// =========================================================================
export const SEED_MATEO_FARM = {
  farmId: "farm-mateo-hydraulic-3",
  name: "Central Valley Hydraulic Orchard",
  totalArea: "12.0 Hectares (High-Flow Micro-Sprinklers)",
  location: { latitude: 36.3302, longitude: -119.2921 },
  createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
  ownerId: "user-mateo-3",
  managers: ["user-mateo-3"],
  operators: [],
  members: [],
  plots: {
    "plot-mateo-1": {
      id: "plot-mateo-1",
      name: "Orchard Block 1 - Valencia Orange",
      plotNumber: 1,
      crop: "Citrus",
      stage: "Active Root Establishment",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      plantAgeDays: 150,
      totalCycleDays: 365,
      daysToHarvest: 215,
      areaHa: 4.0,
      projectedYieldTons: 40.0,
      currentHeightCm: 160,
      valve: { id: "G1", state: "CLOSED", flowRate: 420.0, timerEnd: null },
      soilSensors: [
        { probeId: "SM1_10cm", depthCm: 10, vwc: 25.0, temperature: 23.0, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
        { probeId: "SM1_30cm", depthCm: 30, vwc: 27.0, temperature: 22.0, salinityEc: 1.00, lastUpdated: new Date().toISOString() },
        { probeId: "SM1_50cm", depthCm: 50, vwc: 30.0, temperature: 21.0, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-mateo-2": {
      id: "plot-mateo-2",
      name: "Orchard Block 2 - Nonpareil Almonds",
      plotNumber: 2,
      crop: "Almonds",
      stage: "Nut Development",
      targetVwcMin: 18.0,
      targetVwcMax: 28.0,
      plantAgeDays: 180,
      totalCycleDays: 365,
      daysToHarvest: 185,
      areaHa: 4.5,
      projectedYieldTons: 35.0,
      currentHeightCm: 220,
      valve: { id: "G2", state: "CLOSED", flowRate: 460.0, timerEnd: null },
      soilSensors: [
        { probeId: "SM2_10cm", depthCm: 10, vwc: 22.0, temperature: 24.0, salinityEc: 1.20, lastUpdated: new Date().toISOString() },
        { probeId: "SM2_30cm", depthCm: 30, vwc: 24.5, temperature: 23.0, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
        { probeId: "SM2_50cm", depthCm: 50, vwc: 26.0, temperature: 22.0, salinityEc: 1.00, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-mateo-3": {
      id: "plot-mateo-3",
      name: "Orchard Block 3 - Kerman Pistachios",
      plotNumber: 3,
      crop: "Pistachio",
      stage: "Kernel Filling",
      targetVwcMin: 16.0,
      targetVwcMax: 26.0,
      plantAgeDays: 200,
      totalCycleDays: 365,
      daysToHarvest: 165,
      areaHa: 3.5,
      projectedYieldTons: 28.0,
      currentHeightCm: 195,
      valve: { id: "G3", state: "CLOSED", flowRate: 380.0, timerEnd: null },
      soilSensors: [
        { probeId: "SM3_10cm", depthCm: 10, vwc: 19.0, temperature: 25.0, salinityEc: 1.30, lastUpdated: new Date().toISOString() },
        { probeId: "SM3_30cm", depthCm: 30, vwc: 21.0, temperature: 24.0, salinityEc: 1.15, lastUpdated: new Date().toISOString() },
        { probeId: "SM3_50cm", depthCm: 50, vwc: 23.5, temperature: 23.0, salinityEc: 1.05, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  leafScans: [],
  irrigationLogs: [],
  actionRecommendations: [],
  crops: {
    "crop-citrus": {
      id: "crop-citrus",
      name: "Citrus",
      scientificName: "Citrus sinensis",
      optimalVwcMin: 20.0,
      optimalVwcMax: 32.0,
      optimalPhMin: 6.0,
      optimalPhMax: 7.0,
      targetNitrogen: 120,
      growthStages: ["Root Establishment", "Flowering", "Fruit Set", "Fruit Growth", "Harvest"],
      category: "Fruit Trees",
      defaultCycleDays: 365
    },
    "crop-almonds": {
      id: "crop-almonds",
      name: "Almonds",
      scientificName: "Prunus dulcis",
      optimalVwcMin: 18.0,
      optimalVwcMax: 28.0,
      optimalPhMin: 6.5,
      optimalPhMax: 7.5,
      targetNitrogen: 140,
      growthStages: ["Dormancy", "Bloom", "Nut Development", "Hull Split", "Harvest"],
      category: "Nuts",
      defaultCycleDays: 365
    },
    "crop-pistachio": {
      id: "crop-pistachio",
      name: "Pistachio",
      scientificName: "Pistacia vera",
      optimalVwcMin: 16.0,
      optimalVwcMax: 26.0,
      optimalPhMin: 7.0,
      optimalPhMax: 8.0,
      targetNitrogen: 100,
      growthStages: ["Bud Break", "Flowering", "Shell Hardening", "Kernel Filling", "Harvest"],
      category: "Nuts",
      defaultCycleDays: 365
    }
  }
};

// =========================================================================
// Persona Chamber 4: Guest / Offline Technician (Offline Sandbox Parcel)
// =========================================================================
export const SEED_GUEST_FARM = {
  farmId: "farm-guest-local-0",
  name: "Offline Sandbox Parcel",
  totalArea: "0.5 Acre Sandbox",
  location: { latitude: 37.0000, longitude: -120.0000 },
  createdAt: new Date().toISOString(),
  ownerId: "offline-guest",
  managers: ["offline-guest"],
  operators: [],
  members: [],
  plots: {
    "plot-guest-1": {
      id: "plot-guest-1",
      name: "Sandbox Zone 1 - Demo Spuds",
      plotNumber: 1,
      crop: "Potato",
      stage: "Vegetative",
      targetVwcMin: 20.0,
      targetVwcMax: 35.0,
      plantAgeDays: 25,
      totalCycleDays: 90,
      daysToHarvest: 65,
      areaHa: 0.25,
      projectedYieldTons: 2.0,
      currentHeightCm: 30,
      valve: { id: "G1", state: "CLOSED", flowRate: 400.0, timerEnd: null },
      soilSensors: [
        { probeId: "SG1_10cm", depthCm: 10, vwc: 24.0, temperature: 22.0, salinityEc: 1.0, lastUpdated: new Date().toISOString() },
        { probeId: "SG1_30cm", depthCm: 30, vwc: 26.0, temperature: 21.0, salinityEc: 0.95, lastUpdated: new Date().toISOString() },
        { probeId: "SG1_50cm", depthCm: 50, vwc: 28.0, temperature: 20.0, salinityEc: 0.9, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-guest-2": {
      id: "plot-guest-2",
      name: "Sandbox Zone 2 - Cherry Tomatoes",
      plotNumber: 2,
      crop: "Tomato",
      stage: "Flowering",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      plantAgeDays: 35,
      totalCycleDays: 90,
      daysToHarvest: 55,
      areaHa: 0.25,
      projectedYieldTons: 1.8,
      currentHeightCm: 45,
      valve: { id: "G2", state: "CLOSED", flowRate: 400.0, timerEnd: null },
      soilSensors: [
        { probeId: "SG2_10cm", depthCm: 10, vwc: 22.0, temperature: 23.0, salinityEc: 1.1, lastUpdated: new Date().toISOString() },
        { probeId: "SG2_30cm", depthCm: 30, vwc: 24.0, temperature: 22.0, salinityEc: 1.0, lastUpdated: new Date().toISOString() },
        { probeId: "SG2_50cm", depthCm: 50, vwc: 26.0, temperature: 21.0, salinityEc: 0.95, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  },
  leafScans: [],
  irrigationLogs: [],
  actionRecommendations: [],
  crops: JSON.parse(JSON.stringify(PRESEEDED_CROPS))
};

class ReactiveMockFirestore {
  constructor() {
    this.currentFarmId = "farm-carlos-valley-1";
    this.farmsData = {};
    this.subscribers = new Map(); // channel -> Array of callbacks

    // Initialize active chamber
    this.farmsData[this.currentFarmId] = this.loadData(this.currentFarmId);
  }

  normalizeFarmId(farmId) {
    if (!farmId || farmId === "farm-valley-1") return "farm-carlos-valley-1";
    return farmId;
  }

  getSeedDataForFarm(farmId) {
    const norm = this.normalizeFarmId(farmId);
    if (norm === "farm-carlos-valley-1") return JSON.parse(JSON.stringify(SEED_CARLOS_FARM));
    if (norm === "farm-elena-research-2") return JSON.parse(JSON.stringify(SEED_ELENA_FARM));
    if (norm === "farm-mateo-hydraulic-3") return JSON.parse(JSON.stringify(SEED_MATEO_FARM));
    if (norm === "farm-guest-local-0") return JSON.parse(JSON.stringify(SEED_GUEST_FARM));

    // Dynamic clean chamber for newly registered farmers
    return {
      farmId: norm,
      name: `Precision Agro Parcel (${norm.replace(/^farm[_-]/, '')})`,
      totalArea: "1.00 Acre (1 Zone)",
      location: { latitude: 36.7783, longitude: -119.4179 },
      createdAt: new Date().toISOString(),
      ownerId: norm.replace(/^farm[_-]/, ''),
      managers: [norm.replace(/^farm[_-]/, '')],
      operators: [],
      members: [],
      plots: {
        [`plot-${norm}-1`]: {
          id: `plot-${norm}-1`,
          name: "Zone 1 - Primary Field Zone",
          plotNumber: 1,
          crop: "Potato Crop",
          stage: "Vegetative",
          targetVwcMin: 22.0,
          targetVwcMax: 35.0,
          plantAgeDays: 20,
          totalCycleDays: 90,
          daysToHarvest: 70,
          areaHa: 1.0,
          projectedYieldTons: 5.0,
          currentHeightCm: 35,
          growthRateData: [
            { day: 0, heightCm: 0, label: "Day 0" },
            { day: 15, heightCm: 25, label: "Day 15" },
            { day: 30, heightCm: 45, label: "Day 30" },
            { day: 60, heightCm: 70, label: "Day 60" },
            { day: 90, heightCm: 85, label: "Day 90" }
          ],
          valve: { id: "G1", state: "CLOSED", flowRate: 480.0, timerEnd: null },
          soilSensors: [
            { probeId: "S1_10cm", depthCm: 10, vwc: 24.5, temperature: 22.5, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
            { probeId: "S1_30cm", depthCm: 30, vwc: 27.2, temperature: 21.0, salinityEc: 1.00, lastUpdated: new Date().toISOString() },
            { probeId: "S1_50cm", depthCm: 50, vwc: 30.0, temperature: 20.0, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
          ],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      },
      leafScans: [],
      irrigationLogs: [],
      actionRecommendations: [],
      crops: JSON.parse(JSON.stringify(PRESEEDED_CROPS))
    };
  }

  loadData(farmId = this.currentFarmId) {
    const normId = this.normalizeFarmId(farmId);
    try {
      if (typeof localStorage !== 'undefined') {
        const key = `agrispectra_offline_db_${normId}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!parsed.crops || Object.keys(parsed.crops).length === 0) {
            parsed.crops = this.getSeedDataForFarm(normId).crops;
          }
          if (!parsed.plots) parsed.plots = {};
          if (!parsed.leafScans) parsed.leafScans = [];
          if (!parsed.irrigationLogs) parsed.irrigationLogs = [];
          if (!parsed.actionRecommendations) parsed.actionRecommendations = [];
          return parsed;
        }

        // Backward compatibility fallback for Carlos's primary farm
        if (normId === "farm-carlos-valley-1") {
          const legacy = localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
          if (legacy) {
            const parsed = JSON.parse(legacy);
            if (!parsed.crops || Object.keys(parsed.crops).length === 0) {
              parsed.crops = JSON.parse(JSON.stringify(PRESEEDED_CROPS));
            }
            return parsed;
          }
        }
      }
    } catch (e) {
      console.warn(`Could not read localStorage for farm chamber ${normId}:`, e);
    }

    return this.getSeedDataForFarm(normId);
  }

  saveData(farmId = this.currentFarmId) {
    const normId = this.normalizeFarmId(farmId);
    try {
      if (typeof localStorage !== 'undefined') {
        const payload = this.farmsData[normId] || this.getSeedDataForFarm(normId);
        const serialized = JSON.stringify(payload);
        // Isolated partition key
        localStorage.setItem(`agrispectra_offline_db_${normId}`, serialized);

        // Mirror active farm to primary legacy keys for backward test compatibility
        if (normId === this.normalizeFarmId(this.currentFarmId)) {
          localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
          localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
        }
      }
    } catch (e) {
      console.warn(`Could not persist to localStorage for farm ${normId}:`, e);
    }
  }

  getFarmData(farmId = this.currentFarmId) {
    const normId = this.normalizeFarmId(farmId);
    if (!this.farmsData[normId]) {
      this.farmsData[normId] = this.loadData(normId);
    }
    return this.farmsData[normId];
  }

  /**
   * Transparent getter/setter for backwards compatibility with code accessing mockFirestore.data
   */
  get data() {
    return this.getFarmData(this.currentFarmId);
  }

  set data(val) {
    if (val && val.farmId) {
      const normId = this.normalizeFarmId(val.farmId);
      this.farmsData[normId] = val;
    } else {
      this.farmsData[this.normalizeFarmId(this.currentFarmId)] = val;
    }
  }

  /**
   * Switch the active isolation chamber dynamically
   * @param {string} farmId
   * @param {Object} user
   */
  setActiveFarm(farmId, user = null) {
    const normId = this.normalizeFarmId(farmId);
    this.currentFarmId = normId;
    if (!this.farmsData[normId]) {
      this.farmsData[normId] = this.loadData(normId);
    }
    this.saveData(normId);
    this.notifyAll();
    return this.farmsData[normId];
  }

  notifyAll() {
    this.notify('plots');
    this.notify('crops');
    this.notify('cropCatalog');
    this.notify('leafScans');
    this.notify('irrigationLogs');
    this.notify('actionRecommendations');
    this.notify('farm');
    this.notify('userPreferences');
  }

  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel).push(callback);
    callback(this.getChannelSnapshot(channel));

    return () => {
      const list = this.subscribers.get(channel) || [];
      this.subscribers.set(channel, list.filter(cb => cb !== callback));
    };
  }

  notify(channel) {
    if (this.subscribers.has(channel)) {
      const snap = this.getChannelSnapshot(channel);
      this.subscribers.get(channel).forEach(cb => {
        try { cb(snap); } catch (e) { console.error(`Error in subscriber for ${channel}:`, e); }
      });
    }
  }

  getPlots(farmId = this.currentFarmId) {
    return Object.values(this.getFarmData(farmId).plots || {});
  }

  getCrops(farmId = this.currentFarmId) {
    return Object.values(this.getFarmData(farmId).crops || {});
  }

  getChannelSnapshot(channel, farmId = this.currentFarmId) {
    const farmData = this.getFarmData(farmId);
    if (channel === 'plots') {
      return Object.values(farmData.plots || {}).sort((a, b) => (a.plotNumber || 0) - (b.plotNumber || 0));
    }
    if (channel === 'crops' || channel === 'cropCatalog') {
      return Object.values(farmData.crops || {}).sort((a, b) => a.name.localeCompare(b.name));
    }
    if (channel === 'leafScans') {
      return [...(farmData.leafScans || [])].reverse();
    }
    if (channel === 'irrigationLogs') {
      return [...(farmData.irrigationLogs || [])].reverse();
    }
    if (channel === 'actionRecommendations') {
      return [...(farmData.actionRecommendations || [])].reverse();
    }
    if (channel === 'farm') {
      return {
        farmId: farmData.farmId,
        name: farmData.name,
        totalArea: farmData.totalArea,
        location: farmData.location
      };
    }
    if (channel === 'userPreferences') {
      return this.getUserPreferences();
    }
    return null;
  }

  // --- API Mutators Scoped to Chamber ---

  createPlot(plotData = {}, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    const id = plotData.id || `plot-${Date.now()}`;
    const plotNumber = plotData.plotNumber !== undefined ? Number(plotData.plotNumber) : (Object.keys(farm.plots || {}).length + 1);
    const crop = plotData.crop || "Potato Crop";
    const name = plotData.name || `Zone ${plotNumber} - ${crop}`;
    const targetVwcMin = Number(plotData.targetVwcMin !== undefined ? plotData.targetVwcMin : 20.0);
    const targetVwcMax = Number(plotData.targetVwcMax !== undefined ? plotData.targetVwcMax : 35.0);
    const stage = plotData.stage || plotData.growthStage || "Vegetative";

    const soilSensors = Array.isArray(plotData.soilSensors) && plotData.soilSensors.length > 0
      ? plotData.soilSensors
      : [
          { probeId: `S${plotNumber}_10cm`, depthCm: 10, vwc: Number((targetVwcMin + 4.5).toFixed(1)), temperature: 23.5, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
          { probeId: `S${plotNumber}_30cm`, depthCm: 30, vwc: Number((targetVwcMin + 7.2).toFixed(1)), temperature: 22.0, salinityEc: 1.00, lastUpdated: new Date().toISOString() },
          { probeId: `S${plotNumber}_50cm`, depthCm: 50, vwc: Number((targetVwcMin + 10.0).toFixed(1)), temperature: 20.5, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
        ];

    const valve = plotData.valve ? {
      id: plotData.valve.id || `G${plotNumber}`,
      state: plotData.valve.state || "CLOSED",
      flowRate: Number(plotData.valve.flowRate) || 480.0,
      timerEnd: plotData.valve.timerEnd || null
    } : {
      id: `G${plotNumber}`,
      state: "CLOSED",
      flowRate: 480.0,
      timerEnd: null
    };

    const newPlot = {
      id,
      name,
      plotNumber,
      crop,
      stage,
      targetVwcMin,
      targetVwcMax,
      plantAgeDays: Number(plotData.plantAgeDays) || 30,
      totalCycleDays: Number(plotData.totalCycleDays) || 90,
      daysToHarvest: Number(plotData.daysToHarvest) || 60,
      areaHa: Number(plotData.areaHa) || 1.0,
      projectedYieldTons: Number(plotData.projectedYieldTons) || 5.0,
      currentHeightCm: Number(plotData.currentHeightCm) || 40,
      growthRateData: Array.isArray(plotData.growthRateData) ? plotData.growthRateData : [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 20, label: "Day 15" },
        { day: 30, heightCm: 40, label: "Day 30" },
        { day: 45, heightCm: 55, label: "Day 45" },
        { day: 60, heightCm: 70, label: "Day 60" },
        { day: 75, heightCm: 80, label: "Day 75" },
        { day: 90, heightCm: 85, label: "Day 90" }
      ],
      valve,
      soilSensors,
      createdAt: plotData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!farm.plots) farm.plots = {};
    farm.plots[id] = newPlot;
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('plots');
    }
    return newPlot;
  }

  updatePlot(plotId, updates, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    if (farm.plots && farm.plots[plotId]) {
      farm.plots[plotId] = {
        ...farm.plots[plotId],
        ...updates,
        id: plotId,
        updatedAt: new Date().toISOString()
      };
      this.saveData(farmId);
      if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
        this.notify('plots');
      }
      return farm.plots[plotId];
    }
    return null;
  }

  deletePlot(plotId, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    if (!farm.plots || !farm.plots[plotId]) {
      return { success: false, error: `Plot with ID "${plotId}" not found in chamber ${farmId}.` };
    }
    delete farm.plots[plotId];
    if (Array.isArray(farm.actionRecommendations)) {
      farm.actionRecommendations = farm.actionRecommendations.filter(r => r.plotId !== plotId);
      if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
        this.notify('actionRecommendations');
      }
    }
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('plots');
    }
    return { success: true, id: plotId };
  }

  getCropCatalog(farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    if (!farm.crops || Object.keys(farm.crops).length === 0) {
      farm.crops = this.getSeedDataForFarm(farmId).crops;
      this.saveData(farmId);
    }
    return Object.values(farm.crops);
  }

  subscribeCropCatalog(callback, farmId = this.currentFarmId) {
    return this.subscribe('crops', callback);
  }

  addCropType(cropData = {}, farmId = this.currentFarmId) {
    if (!cropData.name) {
      throw new Error("Crop name is required to add a crop type.");
    }
    const farm = this.getFarmData(farmId);
    const cleanSlug = cropData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const id = cropData.id || `crop-${cleanSlug || Date.now()}`;
    const newCrop = {
      id,
      name: cropData.name,
      scientificName: cropData.scientificName || `${cropData.name} sp.`,
      optimalVwcMin: Number(cropData.optimalVwcMin !== undefined ? cropData.optimalVwcMin : 20.0),
      optimalVwcMax: Number(cropData.optimalVwcMax !== undefined ? cropData.optimalVwcMax : 35.0),
      optimalPhMin: Number(cropData.optimalPhMin !== undefined ? cropData.optimalPhMin : 6.0),
      optimalPhMax: Number(cropData.optimalPhMax !== undefined ? cropData.optimalPhMax : 7.0),
      targetNitrogen: Number(cropData.targetNitrogen !== undefined ? cropData.targetNitrogen : 100),
      growthStages: Array.isArray(cropData.growthStages) && cropData.growthStages.length > 0 
        ? cropData.growthStages 
        : ["Germination", "Vegetative", "Flowering", "Maturity"],
      category: cropData.category || "General",
      defaultCycleDays: Number(cropData.defaultCycleDays) || 90,
      createdAt: cropData.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (!farm.crops) farm.crops = {};
    farm.crops[id] = newCrop;
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('crops');
    }
    return newCrop;
  }

  updateCropType(cropId, updates = {}, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    if (!farm.crops || !farm.crops[cropId]) return null;

    farm.crops[cropId] = {
      ...farm.crops[cropId],
      ...updates,
      id: cropId,
      updatedAt: new Date().toISOString()
    };
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('crops');
    }
    return farm.crops[cropId];
  }

  deleteCropType(cropId, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    if (!farm.crops || !farm.crops[cropId]) {
      return { success: false, error: `Crop type with ID "${cropId}" not found in chamber ${farmId}.` };
    }
    delete farm.crops[cropId];
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('crops');
    }
    return { success: true, id: cropId };
  }

  addLeafScan(scan, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    const id = "scan-" + Date.now();
    const doc = {
      id,
      ...scan,
      scannedAt: new Date().toISOString()
    };
    if (!farm.leafScans) farm.leafScans = [];
    farm.leafScans.push(doc);
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('leafScans');
    }
    this.evaluateClosedLoop(doc, farmId);
    return id;
  }

  addIrrigationLog(log, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    const id = "log-" + Date.now();
    const doc = {
      id,
      ...log,
      timestamp: new Date().toISOString()
    };
    if (!farm.irrigationLogs) farm.irrigationLogs = [];
    farm.irrigationLogs.push(doc);
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('irrigationLogs');
    }
    return id;
  }

  addActionRecommendation(rec, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    const id = "rec-" + Date.now();
    const doc = {
      id,
      ...rec,
      status: 'PENDING',
      generatedAt: new Date().toISOString()
    };
    if (!farm.actionRecommendations) farm.actionRecommendations = [];
    farm.actionRecommendations.push(doc);
    this.saveData(farmId);
    if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
      this.notify('actionRecommendations');
    }
    return id;
  }

  updateActionRecommendation(recId, updates, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    if (!Array.isArray(farm.actionRecommendations)) return;
    const idx = farm.actionRecommendations.findIndex(r => r.id === recId);
    if (idx !== -1) {
      farm.actionRecommendations[idx] = {
        ...farm.actionRecommendations[idx],
        ...updates
      };
      this.saveData(farmId);
      if (this.normalizeFarmId(farmId) === this.normalizeFarmId(this.currentFarmId)) {
        this.notify('actionRecommendations');
      }
    }
  }

  evaluateClosedLoop(scan, farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    const plot = farm.plots?.[scan.plotId];
    if (!plot) return;

    let avgVwc = 25;
    if (plot.soilSensors && plot.soilSensors.length > 0) {
      const sum = plot.soilSensors.reduce((a, b) => a + Number(b.vwc), 0);
      avgVwc = Number((sum / plot.soilSensors.length).toFixed(1));
    }

    const lwi = Number(scan.leafWaterIndex) || 1.0;
    const vitality = Number(scan.vitalityScore) || 100;
    const isWaterStressed = lwi < 0.88 || vitality < 60;
    const isSoilDeficit = avgVwc <= plot.targetVwcMin;

    if (isWaterStressed && isSoilDeficit && plot.valve?.state !== "OPEN") {
      this.addActionRecommendation({
        plotId: plot.id,
        plotNumber: plot.plotNumber,
        crop: plot.crop,
        gateId: plot.valve?.id || "G1",
        triggerReason: `Plot ${plot.plotNumber} leaf stress (LWI ${lwi.toFixed(2)}, Vitality ${vitality}%) confirmed by ${avgVwc}% FDR soil moisture (Target: >${plot.targetVwcMin}%).`,
        suggestedAction: "OPEN",
        suggestedDurationMinutes: 25,
        nitrogenPrescriptionKg: scan.nitrogenPrescriptionKg || 0,
        diseaseAlert: scan.diseaseRisk || null,
        leafScanId: scan.id
      }, farmId);
    }
  }

  // --- User Preferences Store ---

  getUserPreferences(userId = 'default') {
    const userKey = userId || 'default';
    let storedPrefs = null;
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(USER_PREFS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          storedPrefs = parsed[userKey] || parsed._lastActive || parsed;
        }
      }
    } catch (e) {
      // Ignore
    }

    const memoryPrefs = this.data.userPreferences?.[userKey];
    return {
      ...DEFAULT_USER_PREFERENCES,
      ...(storedPrefs || {}),
      ...(memoryPrefs || {}),
      userId: userKey
    };
  }

  saveUserPreferences(userId = 'default', prefs = {}) {
    const userKey = userId || 'default';
    const current = this.getUserPreferences(userKey);
    const updated = {
      ...current,
      ...prefs,
      userId: userKey,
      updatedAt: new Date().toISOString()
    };

    if (!this.data.userPreferences) {
      this.data.userPreferences = {};
    }
    this.data.userPreferences[userKey] = updated;
    this.saveData();

    try {
      if (typeof localStorage !== 'undefined') {
        let allPrefs = {};
        const raw = localStorage.getItem(USER_PREFS_STORAGE_KEY);
        if (raw) {
          try { allPrefs = JSON.parse(raw); } catch (e) {}
        }
        allPrefs[userKey] = updated;
        allPrefs._lastActive = updated;
        localStorage.setItem(USER_PREFS_STORAGE_KEY, JSON.stringify(allPrefs));
      }
    } catch (e) {
      console.warn("Could not persist agrispectra_user_prefs to localStorage:", e);
    }

    this.notify('userPreferences');
    return updated;
  }

  // --- Aggregated Usage Statistics ---

  getAggregatedStats(farmId = this.currentFarmId) {
    const farm = this.getFarmData(farmId);
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const logs = farm.irrigationLogs || [];
    const plots = Object.values(farm.plots || {});
    const leafScans = farm.leafScans || [];

    const todayLogs = logs.filter(l => {
      const ts = l.timestamp ? new Date(l.timestamp).getTime() : 0;
      return (now - ts) <= oneDayMs;
    });
    let totalLitersDeliveredToday = todayLogs.reduce((acc, l) => acc + (Number(l.litersDelivered) || 0), 0);
    let totalLitersDeliveredAllTime = logs.reduce((acc, l) => acc + (Number(l.litersDelivered) || 0), 0);
    const plotDeliveredSum = plots.reduce((acc, p) => acc + (Number(p.totalLitersDelivered) || 0), 0);
    totalLitersDeliveredAllTime = Math.max(totalLitersDeliveredAllTime, plotDeliveredSum);

    const valveCycleCountPerPlot = {};
    plots.forEach(p => {
      valveCycleCountPerPlot[p.id] = 0;
    });
    logs.forEach(l => {
      if (l.plotId) {
        valveCycleCountPerPlot[l.plotId] = (valveCycleCountPerPlot[l.plotId] || 0) + 1;
      }
    });

    const totalLeafScansConducted = leafScans.length;
    let averageCanopyVitality = 0;
    if (leafScans.length > 0) {
      const sum = leafScans.reduce((acc, s) => acc + (Number(s.vitalityScore) || 0), 0);
      averageCanopyVitality = Math.round((sum / leafScans.length) * 10) / 10;
    } else {
      averageCanopyVitality = 85.0;
    }

    return {
      farmId: farm.farmId || farmId,
      totalLitersDeliveredToday: Math.round(totalLitersDeliveredToday * 10) / 10,
      totalLitersDeliveredAllTime: Math.round(totalLitersDeliveredAllTime * 10) / 10,
      valveCycleCountPerPlot,
      totalLeafScansConducted,
      averageCanopyVitality,
      timestamp: new Date().toISOString()
    };
  }

  resetToDefault(farmId = null) {
    if (farmId) {
      const normId = this.normalizeFarmId(farmId);
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`agrispectra_offline_db_${normId}`);
        }
      } catch (e) {}
      this.farmsData[normId] = this.getSeedDataForFarm(normId);
      this.saveData(normId);
    } else {
      const demoFarmIds = ['farm-carlos-valley-1', 'farm-elena-research-2', 'farm-mateo-hydraulic-3', 'farm-guest-local-0'];
      demoFarmIds.forEach(id => {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(`agrispectra_offline_db_${id}`);
          }
        } catch (e) {}
        this.farmsData[id] = this.getSeedDataForFarm(id);
        this.saveData(id);
      });
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(PRIMARY_STORAGE_KEY);
          localStorage.removeItem(LEGACY_STORAGE_KEY);
        }
      } catch (e) {}
      this.currentFarmId = 'farm-carlos-valley-1';
      this.saveData('farm-carlos-valley-1');
    }
    this.notifyAll();
  }
}

export const mockFirestore = new ReactiveMockFirestore();
