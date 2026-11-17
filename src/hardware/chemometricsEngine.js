/**
 * AgriSpectra Edge Chemometrics Engine
 * Processes 350–1100 nm VIS-NIR spectral reflectance signatures
 * Simulates on-device embedded inference for plant phenotyping & stress diagnosis
 */

// Wavelength sample points (every 10nm from 350 to 1100)
export const WAVELENGTHS = Array.from({ length: 76 }, (_, i) => 350 + i * 10);

/**
 * Generate synthetic spectral reflectance vector (0.0 to 1.0)
 * based on physiological state
 */
export function generateSpectralSignature({
  vitality = 85,          // 0 to 100
  waterContent = 0.85,    // 0.4 to 1.0 (relative leaf water content)
  nitrogenLevel = 0.80,   // 0.3 to 1.0
  diseaseStress = 0.15,   // 0.0 to 1.0
  noiseLevel = 0.015
} = {}) {
  return WAVELENGTHS.map((wl) => {
    let r = 0.05; // baseline reflectance

    // 1. Visible spectrum (350 - 700 nm)
    if (wl < 700) {
      // Blue absorption trough around 450nm
      const blueAbsorption = Math.exp(-Math.pow((wl - 450) / 45, 2)) * 0.035;
      // Green peak around 550nm (Chlorophyll reflection)
      const greenPeak = Math.exp(-Math.pow((wl - 550) / 40, 2)) * (0.12 * (vitality / 100));
      // Red absorption trough around 670-680nm (Chlorophyll-a absorption)
      const redAbsorption = Math.exp(-Math.pow((wl - 675) / 30, 2)) * (0.05 * nitrogenLevel);

      r = 0.04 + greenPeak - blueAbsorption - redAbsorption;

      // In disease or chlorosis, fungal mycelium/lesions increase red reflection and reduce green peak
      if (diseaseStress > 0.3) {
        r += (diseaseStress * 0.07) * Math.exp(-Math.pow((wl - 660) / 50, 2));
      }
    }
    // 2. Red Edge transition (700 - 750 nm)
    else if (wl >= 700 && wl <= 750) {
      const redEdgeSlope = (wl - 700) / 50; // 0 to 1
      // Chlorosis (low nitrogen) causes red edge to flatten/shift blue (higher R700-725)
      const chlorosisShift = (1 - nitrogenLevel) * 0.12;
      r = 0.08 + redEdgeSlope * 0.38 + chlorosisShift;
    }
    // 3. Near-Infrared (NIR) plateau (750 - 1100 nm)
    else {
      // Mesophyll cell scattering gives high NIR reflectance (40% - 60%)
      const baseNIR = 0.42 + (vitality / 100) * 0.16;

      // Water absorption features at 970nm (O-H vibrational overtone)
      // High water content absorbs more light at 970nm, lowering R970
      const waterBand970 = Math.exp(-Math.pow((wl - 970) / 40, 2)) * (0.18 * waterContent);

      // Minor water/cellulose harmonic around 1050nm
      const celluloseHarmonic = Math.exp(-Math.pow((wl - 1050) / 50, 2)) * 0.04;

      r = baseNIR - waterBand970 - celluloseHarmonic;
    }

    // Add physical detector Gaussian noise
    const noise = (Math.random() - 0.5) * noiseLevel;
    return Math.max(0.01, Math.min(0.95, Number((r + noise).toFixed(4))));
  });
}

/**
 * Calculate Agronomic Vegetation & Stress Indices from Spectral Vector
 */
export function processSpectralVector(spectrum, cropName = "Bell Peppers", growthStage = "Fruit Formation") {
  const getR = (targetWl) => {
    const idx = WAVELENGTHS.findIndex((w) => w >= targetWl);
    return idx !== -1 ? spectrum[idx] : 0.2;
  };

  const R450 = getR(450);
  const R550 = getR(550);
  const R680 = getR(680);
  const R705 = getR(705);
  const R720 = getR(720);
  const R750 = getR(750);
  const R800 = getR(800);
  const R900 = getR(900);
  const R970 = getR(970);

  // 1. NDVI (Normalized Difference Vegetation Index)
  const ndvi = (R800 - R680) / Math.max(0.001, (R800 + R680));

  // 2. NDRE (Normalized Difference Red Edge) - Highly sensitive to leaf Nitrogen
  const ndre = (R790_proxy => (R790_proxy - R720) / Math.max(0.001, (R790_proxy + R720)))(getR(790));

  // 3. WBI / LWI (Water Band Index / Leaf Water Index) - Ratio of 900nm to 970nm absorption dip
  const wbi = R900 / Math.max(0.001, R970);
  // Normalized leaf water index: scales relative water index into 0.60 - 1.10 range
  const leafWaterIndex = Number((Math.max(0.4, (wbi - 1.0) * 2.2 + 0.35)).toFixed(3));

  // 4. Chlorophyll Index Red Edge (CIre)
  const cire = (R750 / Math.max(0.001, R705)) - 1;

  // 5. Crop Vitality Score (0 - 100)
  let rawScore = (ndvi * 48) + (ndre * 40) + (Math.min(1.0, leafWaterIndex) * 22) - 4;
  let vitalityScore = Math.min(100, Math.max(5, Math.round(rawScore)));

  // Calculate Nitrogen Prescription (kg/Acre)
  // Optimal NDRE is typically >= 0.36 for healthy canopies
  let nitrogenPrescriptionKg = 0;
  if (ndre < 0.25) {
    nitrogenPrescriptionKg = 22.5; // High deficit
  } else if (ndre < 0.31) {
    nitrogenPrescriptionKg = 14.5; // Moderate top-dress
  } else if (ndre < 0.36) {
    nitrogenPrescriptionKg = 6.0;  // Maintenance
  } else {
    nitrogenPrescriptionKg = 0;    // Nitrogen saturated / optimal
  }

  // Irrigation Need Countdown
  let irrigationCountdownHours = 48;
  let irrigationUrgency = "Normal";
  if (leafWaterIndex < 0.82) {
    irrigationCountdownHours = 4;
    irrigationUrgency = "CRITICAL";
  } else if (leafWaterIndex < 0.89) {
    irrigationCountdownHours = 18;
    irrigationUrgency = "MODERATE_STRESS";
  } else if (leafWaterIndex < 0.94) {
    irrigationCountdownHours = 36;
    irrigationUrgency = "ADEQUATE";
  } else {
    irrigationCountdownHours = 64;
    irrigationUrgency = "SATURATED";
  }

  // Pre-Symptomatic Disease Detection
  // Detects spectral shifts in 540-680nm (necrosis/mycelium) and degradation of chlorophyll ratio
  let diseaseRisk = {
    detected: false,
    pathogen: "None (Healthy Tissue)",
    confidence: 12,
    severity: "Low",
    preventativeAction: "Maintain preventive bio-fungicide schedule."
  };

  const greenRedRatio = R550 / Math.max(0.001, R680);
  if (greenRedRatio < 2.5 || (vitalityScore < 65 && greenRedRatio < 4.0)) {
    diseaseRisk = {
      detected: true,
      pathogen: "Early Powdery Mildew (Erysiphe cichoracearum)",
      confidence: 84,
      severity: "High",
      preventativeAction: "Apply Potassium Bicarbonate or Bacillus subtilis foliar spray within 24h."
    };
  } else if (vitalityScore < 70 && R680 > 0.04) {
    diseaseRisk = {
      detected: true,
      pathogen: "Septoria Leaf Blight & Nitrogen Chlorosis",
      confidence: 76,
      severity: "Moderate",
      preventativeAction: "Improve air circulation, prune lower canopy, apply copper chelate."
    };
  }

  // Harvest Window Predictor
  // Photochemical Reflectance Index & Anthocyanin buildup
  let harvestMaturityPercent = 65;
  let daysToPeakHarvest = 18;
  if (growthStage.toLowerCase().includes("fruit") || growthStage.toLowerCase().includes("ripen")) {
    harvestMaturityPercent = Math.min(98, Math.round(60 + (1 - ndvi) * 70));
    daysToPeakHarvest = Math.max(2, Math.round((100 - harvestMaturityPercent) / 2.5));
  } else if (growthStage.toLowerCase().includes("veg") || growthStage.toLowerCase().includes("bloom")) {
    harvestMaturityPercent = 38;
    daysToPeakHarvest = 42;
  }

  return {
    vitalityScore,
    indices: {
      ndvi: Number(ndvi.toFixed(3)),
      ndre: Number(ndre.toFixed(3)),
      wbi: Number(wbi.toFixed(3)),
      cire: Number(cire.toFixed(3)),
      leafWaterIndex
    },
    nitrogenPrescriptionKg,
    nitrogenMessage: nitrogenPrescriptionKg > 0
      ? `${nitrogenPrescriptionKg} kg/acre Urea (or 46-0-0 equivalent) recommended before next fertigation cycle.`
      : "Nitrogen index optimal. No supplemental fertilizer required.",
    irrigationCountdownHours,
    irrigationUrgency,
    irrigationMessage: `Turgor water band indicates watering required in ${irrigationCountdownHours} hours.`,
    diseaseRisk,
    harvest: {
      maturityPercent: harvestMaturityPercent,
      daysToPeakHarvest,
      statusMessage: `Canopy maturity is ${harvestMaturityPercent}%. Peak harvest window in ${daysToPeakHarvest} days.`
    },
    rawSpectrumPreview: spectrum
  };
}
