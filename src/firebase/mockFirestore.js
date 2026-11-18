/**
 * Reactive In-Memory & LocalStorage Persisted Firestore Store
 * Implements real-time Firestore NoSQL API semantics (onSnapshot, updateDoc, setDoc, addDoc)
 * Ensures instantaneous out-of-the-box operation and offline resilience.
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

export const INITIAL_FARM_DATA = {
  farmId: "farm-valley-1",
  name: "AgriSpectra High-Density Precision Block Alpha",
  totalArea: "1.00 Acre (6 Zones)",
  location: { latitude: 36.7783, longitude: -119.4179 },
  createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
  ownerId: "user-agrispectra-admin",
  managers: ["user-agrispectra-admin", "manager-san-joaquin"],
  operators: ["operator-field-tech-1", "operator-field-tech-2"],
  members: ["agronomist-consultant", "viewer-demo"],
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
        state: "CLOSED", // OPEN | CLOSED | FAULT
        flowRate: 480.0, // Liters per hour
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
        { probeId: "S2_10cm", depthCm: 10, vwc: 13.8, temperature: 27.8, salinityEc: 1.85, lastUpdated: new Date().toISOString() }, // LOW WATER DEFICIT
        { probeId: "S2_30cm", depthCm: 30, vwc: 17.2, temperature: 25.1, salinityEc: 1.60, lastUpdated: new Date().toISOString() },
        { probeId: "S2_50cm", depthCm: 50, vwc: 22.0, temperature: 22.0, salinityEc: 1.30, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-3": {
      id: "plot-3",
      name: "Zone 3 - Sweet Corn Block",
      plotNumber: 3,
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
        id: "G3",
        state: "CLOSED",
        flowRate: 610.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S3_10cm", depthCm: 10, vwc: 31.2, temperature: 22.5, salinityEc: 1.05, lastUpdated: new Date().toISOString() },
        { probeId: "S3_30cm", depthCm: 30, vwc: 34.0, temperature: 21.0, salinityEc: 0.92, lastUpdated: new Date().toISOString() },
        { probeId: "S3_50cm", depthCm: 50, vwc: 36.5, temperature: 19.8, salinityEc: 0.81, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-4": {
      id: "plot-4",
      name: "Zone 4 - Strawberries Block",
      plotNumber: 4,
      crop: "Strawberries",
      stage: "Vegetative / Foliar Bloom",
      targetVwcMin: 18.0,
      targetVwcMax: 30.0,
      plantAgeDays: 38,
      totalCycleDays: 65,
      daysToHarvest: 27,
      areaHa: 0.8,
      projectedYieldTons: 4.8,
      currentHeightCm: 22,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 10, label: "Day 15" },
        { day: 30, heightCm: 18, label: "Day 30" },
        { day: 45, heightCm: 24, label: "Day 45" },
        { day: 60, heightCm: 28, label: "Day 60" },
        { day: 75, heightCm: 30, label: "Day 75" },
        { day: 90, heightCm: 30, label: "Day 90" }
      ],
      valve: {
        id: "G4",
        state: "CLOSED",
        flowRate: 380.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S4_10cm", depthCm: 10, vwc: 21.5, temperature: 24.2, salinityEc: 1.40, lastUpdated: new Date().toISOString() },
        { probeId: "S4_30cm", depthCm: 30, vwc: 24.8, temperature: 22.3, salinityEc: 1.25, lastUpdated: new Date().toISOString() },
        { probeId: "S4_50cm", depthCm: 50, vwc: 27.0, temperature: 21.1, salinityEc: 1.10, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-5": {
      id: "plot-5",
      name: "Zone 5 - Leafy Greens Block",
      plotNumber: 5,
      crop: "Leafy Greens",
      stage: "Head Expansion",
      targetVwcMin: 25.0,
      targetVwcMax: 40.0,
      plantAgeDays: 28,
      totalCycleDays: 45,
      daysToHarvest: 17,
      areaHa: 0.9,
      projectedYieldTons: 3.2,
      currentHeightCm: 26,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 12, label: "Day 15" },
        { day: 30, heightCm: 25, label: "Day 30" },
        { day: 45, heightCm: 32, label: "Day 45" },
        { day: 60, heightCm: 34, label: "Day 60" },
        { day: 75, heightCm: 35, label: "Day 75" },
        { day: 90, heightCm: 35, label: "Day 90" }
      ],
      valve: {
        id: "G5",
        state: "CLOSED",
        flowRate: 400.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S5_10cm", depthCm: 10, vwc: 28.0, temperature: 21.9, salinityEc: 0.90, lastUpdated: new Date().toISOString() },
        { probeId: "S5_30cm", depthCm: 30, vwc: 32.5, temperature: 20.8, salinityEc: 0.82, lastUpdated: new Date().toISOString() },
        { probeId: "S5_50cm", depthCm: 50, vwc: 35.0, temperature: 19.5, salinityEc: 0.74, lastUpdated: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 720 * 3600000).toISOString(),
      updatedAt: new Date().toISOString()
    },
    "plot-6": {
      id: "plot-6",
      name: "Zone 6 - Citrus Nursery",
      plotNumber: 6,
      crop: "Citrus",
      stage: "Active Root Establishment",
      targetVwcMin: 20.0,
      targetVwcMax: 32.0,
      plantAgeDays: 110,
      totalCycleDays: 180,
      daysToHarvest: 70,
      areaHa: 2.1,
      projectedYieldTons: 15.0,
      currentHeightCm: 115,
      growthRateData: [
        { day: 0, heightCm: 0, label: "Day 0" },
        { day: 15, heightCm: 25, label: "Day 15" },
        { day: 30, heightCm: 48, label: "Day 30" },
        { day: 45, heightCm: 65, label: "Day 45" },
        { day: 60, heightCm: 80, label: "Day 60" },
        { day: 75, heightCm: 95, label: "Day 75" },
        { day: 90, heightCm: 110, label: "Day 90" }
      ],
      valve: {
        id: "G6",
        state: "CLOSED",
        flowRate: 340.0,
        timerEnd: null
      },
      soilSensors: [
        { probeId: "S6_10cm", depthCm: 10, vwc: 25.1, temperature: 23.8, salinityEc: 1.15, lastUpdated: new Date().toISOString() },
        { probeId: "S6_30cm", depthCm: 30, vwc: 27.4, temperature: 22.0, salinityEc: 1.02, lastUpdated: new Date().toISOString() },
        { probeId: "S6_50cm", depthCm: 50, vwc: 29.8, temperature: 20.7, salinityEc: 0.88, lastUpdated: new Date().toISOString() }
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
      gpsLocation: { latitude: 36.7785, longitude: -119.4181 },
      scannedBy: "operator-field-tech-1",
      notes: "Canopy upper foliage shows severe cellular dehydration and incipient fungal conidia."
    },
    {
      id: "scan-plot1-optimal-01",
      plotId: "plot-1",
      crop: "Bell Peppers",
      scannedAt: new Date(Date.now() - 52 * 60000).toISOString(),
      vitalityScore: 89.4,
      leafWaterIndex: 1.82,
      nitrogenPrescriptionKg: 0.0,
      rawSpectrumPreview: [0.05, 0.06, 0.13, 0.15, 0.08, 0.46, 0.61, 0.63, 0.49, 0.55],
      diseaseRisk: null,
      gpsLocation: { latitude: 36.7781, longitude: -119.4178 },
      scannedBy: "operator-field-tech-1",
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
      operatorId: "operator-field-tech-1",
      notes: "Pre-sunrise baseline pulse across South High-Tunnel"
    },
    {
      id: "log-irr-102",
      plotId: "plot-3",
      valveId: "G3",
      action: "CLOSE",
      durationMinutes: 20.0,
      litersDelivered: 203.3,
      triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
      timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
      operatorId: "operator-field-tech-2",
      notes: "Autonomous replenishment following high mid-morning evapotranspiration"
    },
    {
      id: "log-irr-103",
      plotId: "plot-5",
      valveId: "G5",
      action: "CLOSE",
      durationMinutes: 12.0,
      litersDelivered: 80.0,
      triggeredBy: "CLOSED_LOOP_SPECTROSCOPY",
      timestamp: new Date(Date.now() - 3600000 * 2.5).toISOString(),
      operatorId: "operator-field-tech-1",
      notes: "Cooling foliar micro-burst for head expansion greens"
    },
    {
      id: "log-irr-104",
      plotId: "plot-6",
      valveId: "G6",
      action: "CLOSE",
      durationMinutes: 18.0,
      litersDelivered: 102.0,
      triggeredBy: "MANUAL_TOUCH",
      timestamp: new Date(Date.now() - 3600000 * 1.2).toISOString(),
      operatorId: "operator-field-tech-2",
      notes: "Citrus nursery deep-pot wetting verification"
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

class ReactiveMockFirestore {
  constructor() {
    this.data = this.loadData();
    this.subscribers = new Map(); // key -> Array of callbacks
  }

  loadData() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(PRIMARY_STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (!parsed.crops || Object.keys(parsed.crops).length === 0) {
            parsed.crops = JSON.parse(JSON.stringify(PRESEEDED_CROPS));
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Could not read from localStorage, using initial mock data.");
    }
    return JSON.parse(JSON.stringify(INITIAL_FARM_DATA));
  }

  saveData() {
    try {
      if (typeof localStorage !== 'undefined') {
        const serialized = JSON.stringify(this.data);
        localStorage.setItem(PRIMARY_STORAGE_KEY, serialized);
        localStorage.setItem(LEGACY_STORAGE_KEY, serialized);
      }
    } catch (e) {
      console.warn("Could not persist to localStorage:", e);
    }
  }

  subscribe(channel, callback) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, []);
    }
    this.subscribers.get(channel).push(callback);
    // Initial call with current state
    callback(this.getChannelSnapshot(channel));

    return () => {
      const list = this.subscribers.get(channel) || [];
      this.subscribers.set(channel, list.filter(cb => cb !== callback));
    };
  }

  notify(channel) {
    if (this.subscribers.has(channel)) {
      const snap = this.getChannelSnapshot(channel);
      this.subscribers.get(channel).forEach(cb => cb(snap));
    }
  }

  getPlots() {
    return this.getChannelSnapshot('plots');
  }

  getCrops() {
    return this.getChannelSnapshot('crops');
  }

  getChannelSnapshot(channel) {
    if (channel === 'plots') {
      return Object.values(this.data.plots || {});
    }
    if (channel === 'crops' || channel === 'cropCatalog') {
      return Object.values(this.data.crops || {});
    }
    if (channel === 'leafScans') {
      return [...(this.data.leafScans || [])].reverse();
    }
    if (channel === 'irrigationLogs') {
      return [...(this.data.irrigationLogs || [])].reverse();
    }
    if (channel === 'actionRecommendations') {
      return [...(this.data.actionRecommendations || [])].reverse();
    }
    if (channel === 'farm') {
      return {
        farmId: this.data.farmId,
        name: this.data.name,
        totalArea: this.data.totalArea,
        location: this.data.location
      };
    }
    if (channel === 'userPreferences') {
      return this.getUserPreferences();
    }
    return null;
  }

  // --- API Mutators ---

  createPlot(plotData = {}) {
    const id = plotData.id || `plot-${Date.now()}`;
    const plotNumber = plotData.plotNumber !== undefined ? Number(plotData.plotNumber) : (Object.keys(this.data.plots || {}).length + 1);
    const crop = plotData.crop || "Potato Crop";
    const name = plotData.name || `Zone ${plotNumber} - ${crop}`;
    const targetVwcMin = Number(plotData.targetVwcMin !== undefined ? plotData.targetVwcMin : 20.0);
    const targetVwcMax = Number(plotData.targetVwcMax !== undefined ? plotData.targetVwcMax : 35.0);
    const stage = plotData.stage || plotData.growthStage || "Vegetative";

    // Standardized soil sensors if not provided
    const soilSensors = Array.isArray(plotData.soilSensors) && plotData.soilSensors.length > 0
      ? plotData.soilSensors
      : [
          { probeId: `S${plotNumber}_10cm`, depthCm: 10, vwc: Number((targetVwcMin + 4.5).toFixed(1)), temperature: 23.5, salinityEc: 1.10, lastUpdated: new Date().toISOString() },
          { probeId: `S${plotNumber}_30cm`, depthCm: 30, vwc: Number((targetVwcMin + 7.2).toFixed(1)), temperature: 22.0, salinityEc: 1.00, lastUpdated: new Date().toISOString() },
          { probeId: `S${plotNumber}_50cm`, depthCm: 50, vwc: Number((targetVwcMin + 10.0).toFixed(1)), temperature: 20.5, salinityEc: 0.90, lastUpdated: new Date().toISOString() }
        ];

    // Standardized valve if not provided
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

    if (!this.data.plots) {
      this.data.plots = {};
    }
    this.data.plots[id] = newPlot;
    this.saveData();
    this.notify('plots');
    return newPlot;
  }

  updatePlot(plotId, updates) {
    if (this.data.plots && this.data.plots[plotId]) {
      this.data.plots[plotId] = {
        ...this.data.plots[plotId],
        ...updates,
        id: plotId,
        updatedAt: new Date().toISOString()
      };
      this.saveData();
      this.notify('plots');
      return this.data.plots[plotId];
    }
    return null;
  }

  deletePlot(plotId) {
    if (!this.data.plots || !this.data.plots[plotId]) {
      return { success: false, error: `Plot with ID "${plotId}" not found.` };
    }
    delete this.data.plots[plotId];
    if (Array.isArray(this.data.actionRecommendations)) {
      this.data.actionRecommendations = this.data.actionRecommendations.filter(r => r.plotId !== plotId);
      this.notify('actionRecommendations');
    }
    this.saveData();
    this.notify('plots');
    return { success: true, id: plotId };
  }

  // --- Crop Catalog Subcollection & Store Methods ---

  getCropCatalog() {
    if (!this.data.crops || Object.keys(this.data.crops).length === 0) {
      this.data.crops = JSON.parse(JSON.stringify(PRESEEDED_CROPS));
      this.saveData();
    }
    return Object.values(this.data.crops);
  }

  subscribeCropCatalog(callback) {
    return this.subscribe('crops', callback);
  }

  addCropType(cropData = {}) {
    if (!cropData.name) {
      throw new Error("Crop name is required to add a crop type.");
    }
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

    if (!this.data.crops) {
      this.data.crops = {};
    }
    this.data.crops[id] = newCrop;
    this.saveData();
    this.notify('crops');
    return newCrop;
  }

  updateCropType(cropId, updates = {}) {
    if (!this.data.crops || !this.data.crops[cropId]) {
      return null;
    }
    this.data.crops[cropId] = {
      ...this.data.crops[cropId],
      ...updates,
      id: cropId,
      updatedAt: new Date().toISOString()
    };
    this.saveData();
    this.notify('crops');
    return this.data.crops[cropId];
  }

  deleteCropType(cropId) {
    if (!this.data.crops || !this.data.crops[cropId]) {
      return { success: false, error: `Crop type with ID "${cropId}" not found.` };
    }
    delete this.data.crops[cropId];
    this.saveData();
    this.notify('crops');
    return { success: true, id: cropId };
  }

  addLeafScan(scan) {
    const id = "scan-" + Date.now();
    const doc = {
      id,
      ...scan,
      scannedAt: new Date().toISOString()
    };
    this.data.leafScans.push(doc);
    this.saveData();
    this.notify('leafScans');

    // Closed-Loop Synergy Evaluation
    this.evaluateClosedLoop(doc);
    return id;
  }

  addIrrigationLog(log) {
    const id = "log-" + Date.now();
    const doc = {
      id,
      ...log,
      timestamp: new Date().toISOString()
    };
    this.data.irrigationLogs.push(doc);
    this.saveData();
    this.notify('irrigationLogs');
    return id;
  }

  addActionRecommendation(rec) {
    const id = "rec-" + Date.now();
    const doc = {
      id,
      ...rec,
      status: 'PENDING',
      generatedAt: new Date().toISOString()
    };
    this.data.actionRecommendations.push(doc);
    this.saveData();
    this.notify('actionRecommendations');
    return id;
  }

  updateActionRecommendation(recId, updates) {
    const idx = this.data.actionRecommendations.findIndex(r => r.id === recId);
    if (idx !== -1) {
      this.data.actionRecommendations[idx] = {
        ...this.data.actionRecommendations[idx],
        ...updates
      };
      this.saveData();
      this.notify('actionRecommendations');
    }
  }

  /**
   * Internal Closed-Loop Synergy Checker
   */
  evaluateClosedLoop(scan) {
    const plot = this.data.plots[scan.plotId];
    if (!plot) return;

    // Check average soil moisture
    let avgVwc = 25;
    if (plot.soilSensors && plot.soilSensors.length > 0) {
      const sum = plot.soilSensors.reduce((a, b) => a + Number(b.vwc), 0);
      avgVwc = Number((sum / plot.soilSensors.length).toFixed(1));
    }

    const lwi = Number(scan.leafWaterIndex) || 1.0;
    const vitality = Number(scan.vitalityScore) || 100;
    const isWaterStressed = lwi < 0.88 || vitality < 60;
    const isSoilDeficit = avgVwc <= plot.targetVwcMin;

    if (isWaterStressed && isSoilDeficit && plot.valve.state !== "OPEN") {
      this.addActionRecommendation({
        plotId: plot.id,
        plotNumber: plot.plotNumber,
        crop: plot.crop,
        gateId: plot.valve.id,
        triggerReason: `Plot ${plot.plotNumber} leaf stress (LWI ${lwi.toFixed(2)}, Vitality ${vitality}%) confirmed by ${avgVwc}% FDR soil moisture (Target: >${plot.targetVwcMin}%).`,
        suggestedAction: "OPEN",
        suggestedDurationMinutes: 25,
        nitrogenPrescriptionKg: scan.nitrogenPrescriptionKg || 0,
        diseaseAlert: scan.diseaseRisk || null,
        leafScanId: scan.id
      });
    }
  }

  // --- User Preferences NoSQL Store (agrispectra_user_prefs) ---

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

  getAggregatedStats(farmId = 'farm-valley-1') {
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const logs = this.data.irrigationLogs || [];
    const plots = Object.values(this.data.plots || {});
    const leafScans = this.data.leafScans || [];

    // 1. Total Liters Delivered Today (last 24 hours)
    const todayLogs = logs.filter(l => {
      const ts = l.timestamp ? new Date(l.timestamp).getTime() : 0;
      return (now - ts) <= oneDayMs;
    });
    let totalLitersDeliveredToday = todayLogs.reduce((acc, l) => acc + (Number(l.litersDelivered) || 0), 0);

    // 2. Total Liters Delivered All-Time
    let totalLitersDeliveredAllTime = logs.reduce((acc, l) => acc + (Number(l.litersDelivered) || 0), 0);
    const plotDeliveredSum = plots.reduce((acc, p) => acc + (Number(p.totalLitersDelivered) || 0), 0);
    totalLitersDeliveredAllTime = Math.max(totalLitersDeliveredAllTime, plotDeliveredSum);

    // 3. Valve cycle count per plot
    const valveCycleCountPerPlot = {};
    plots.forEach(p => {
      valveCycleCountPerPlot[p.id] = 0;
    });
    logs.forEach(l => {
      if (l.plotId) {
        valveCycleCountPerPlot[l.plotId] = (valveCycleCountPerPlot[l.plotId] || 0) + 1;
      }
    });

    // 4. Total leaf scans conducted
    const totalLeafScansConducted = leafScans.length;

    // 5. Average canopy vitality
    let averageCanopyVitality = 0;
    if (leafScans.length > 0) {
      const sum = leafScans.reduce((acc, s) => acc + (Number(s.vitalityScore) || 0), 0);
      averageCanopyVitality = Math.round((sum / leafScans.length) * 10) / 10;
    } else {
      averageCanopyVitality = 85.0;
    }

    return {
      farmId: farmId || this.data.farmId,
      totalLitersDeliveredToday: Math.round(totalLitersDeliveredToday * 10) / 10,
      totalLitersDeliveredAllTime: Math.round(totalLitersDeliveredAllTime * 10) / 10,
      valveCycleCountPerPlot,
      totalLeafScansConducted,
      averageCanopyVitality,
      timestamp: new Date().toISOString()
    };
  }

  resetToDefault() {
    this.data = JSON.parse(JSON.stringify(INITIAL_FARM_DATA));
    this.saveData();
    this.notify('plots');
    this.notify('crops');
    this.notify('leafScans');
    this.notify('irrigationLogs');
    this.notify('actionRecommendations');
    this.notify('farm');
    this.notify('userPreferences');
  }
}

export const mockFirestore = new ReactiveMockFirestore();
