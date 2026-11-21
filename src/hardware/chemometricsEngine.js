/**
 * AgriSpectra Edge Chemometrics Engine
 * Processes 350–1100 nm VIS-NIR spectral reflectance signatures
 * Simulates on-device embedded inference for plant phenotyping & stress diagnosis
 */

// Wavelength sample points (every 10nm from 350 to 1100)
export const WAVELENGTHS = Array.from({ length: 76 }, (_, i) => 350 + i * 10);

// AS7265x Triad 18-channel sensor configuration and wavelength mapping
export const AS7265X_CHANNELS = [
  { name: 'R_610nm', wl: 610, index: 0 },
  { name: 'S_680nm', wl: 680, index: 1 },
  { name: 'T_730nm', wl: 730, index: 2 },
  { name: 'U_760nm', wl: 760, index: 3 },
  { name: 'V_810nm', wl: 810, index: 4 },
  { name: 'W_860nm', wl: 860, index: 5 },
  { name: 'G_560nm', wl: 560, index: 6 },
  { name: 'H_585nm', wl: 585, index: 7 },
  { name: 'I_645nm', wl: 645, index: 8 },
  { name: 'J_705nm', wl: 705, index: 9 },
  { name: 'K_900nm', wl: 900, index: 10 },
  { name: 'L_940nm', wl: 940, index: 11 },
  { name: 'A_410nm', wl: 410, index: 12 },
  { name: 'B_435nm', wl: 435, index: 13 },
  { name: 'C_460nm', wl: 460, index: 14 },
  { name: 'D_485nm', wl: 485, index: 15 },
  { name: 'E_510nm', wl: 510, index: 16 },
  { name: 'F_535nm', wl: 535, index: 17 }
];

/**
 * Convert 18-channel AS7265x raw counts to calibrated 76-band reflectance spectrum (350–1100 nm)
 * R(λ) = (I_sample - I_dark) / (I_white - I_dark)
 */
export function convertAS7265xTo76Bands(sampleCounts, darkCounts = null, whiteCounts = null) {
  if (!Array.isArray(sampleCounts) || sampleCounts.length < 18) {
    return null;
  }

  // Calculate 18-channel reflectance
  const points = AS7265X_CHANNELS.map(ch => {
    const s = Number(sampleCounts[ch.index]) || 0;
    const d = darkCounts ? (Number(darkCounts[ch.index]) || 0) : 0;
    const w = whiteCounts ? (Number(whiteCounts[ch.index]) || 0) : 0;

    let ref;
    const denom = w - d;
    if (denom > 10) {
      ref = (s - d) / denom;
    } else {
      // Fallback if white calibration is not saturated or unavailable
      const scale = s > 100 ? 65535 : (s > 1.0 ? 100 : 1.0);
      ref = Math.max(0.01, Math.min(1.0, s / scale));
    }
    return {
      wl: ch.wl,
      reflectance: Math.max(0.01, Math.min(1.0, ref))
    };
  });

  // Sort ascending by wavelength: 410 to 940 nm
  points.sort((a, b) => a.wl - b.wl);

  // Linear interpolation across full 76 bands [350 to 1100 nm]
  return WAVELENGTHS.map(targetWl => {
    if (targetWl <= points[0].wl) {
      return Number(points[0].reflectance.toFixed(4));
    }
    if (targetWl >= points[points.length - 1].wl) {
      return Number(points[points.length - 1].reflectance.toFixed(4));
    }

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      if (targetWl >= p1.wl && targetWl <= p2.wl) {
        const factor = (targetWl - p1.wl) / (p2.wl - p1.wl);
        const interp = p1.reflectance + factor * (p2.reflectance - p1.reflectance);
        return Number(interp.toFixed(4));
      }
    }
    return 0.15;
  });
}

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
  let effectiveSpectrum = spectrum;
  if (Array.isArray(spectrum) && spectrum.length === 18) {
    const converted = convertAS7265xTo76Bands(spectrum);
    if (converted) effectiveSpectrum = converted;
  }

  const getR = (targetWl) => {
    const idx = WAVELENGTHS.findIndex((w) => w >= targetWl);
    return idx !== -1 ? effectiveSpectrum[idx] : 0.2;
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
  const greenRedRatio = R550 / Math.max(0.001, R680);
  let rawScore = (ndvi * 48) + (ndre * 42) + (Math.min(1.0, leafWaterIndex) * 22) - 2;
  if (greenRedRatio < 2.5) {
    rawScore -= 6; // Pre-symptomatic fungal pathogen suppression penalty
  }
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
