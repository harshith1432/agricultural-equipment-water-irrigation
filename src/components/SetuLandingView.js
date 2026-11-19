/**
 * SetuLandingView.js
 * High-fidelity implementation of the Setu Enterprise IoT Platform Landing Page
 * Replicates https://setu-adminweb.vercel.app/ tailored for AgriSpectra
 * (Autonomous Closed-Loop Irrigation & Handheld Leaf Spectroscopy)
 */

export function createSetuLandingView({
  onLaunchDashboard,
  onOpenSignIn,
  onOpenRegister,
  currentUser = null
}) {
  const container = document.createElement('div');
  container.className = 'setu-landing-root min-h-screen bg-white text-slate-900';

  // Products Data
  const PRODUCTS = [
    {
      id: "prod_gw_01",
      sku: "SKU-GW-AGRI-4G",
      name: "AgriSpectra Edge-6 IoT Gateway (4G LTE + Wi-Fi)",
      slug: "agrispectra-edge-6-iot-gateway",
      category: "IoT Gateways & Control",
      categoryKey: "GATEWAY",
      short_description: "Dual-core ESP32-S3 edge controller with 6x 16A optocoupler relays for solenoid manifolds, RS-485 Modbus, and 4G fallback.",
      description: "Industrial agricultural edge automation node engineered for harsh field environments. Operates autonomous closed-loop PID irrigation setpoints even during rural cellular blackouts.",
      price_minor_units: 1499900,
      currency: "INR",
      stock_quantity: 42,
      unit: "unit",
      availability_status: "IN_STOCK",
      specifications: {
        "Microcontroller": "Dual-Core ESP32-S3 @ 240MHz with 8MB PSRAM",
        "Network Uplink": "Quectel 4G LTE-M / NB-IoT + 2.4GHz Wi-Fi + BLE 5.0",
        "Relay Switching": "6x 16A 250V AC Optocoupler-Isolated Relays (Valves 1-6)",
        "Enclosure": "IP66 UV-stabilized Polycarbonate with Breather Vent",
        "Bus Interface": "Isolated RS-485 Modbus RTU (Half-Duplex, 500m length)"
      }
    },
    {
      id: "prod_sns_spectro",
      sku: "SKU-SNS-SPEC-NIR",
      name: "Handheld Leaf-Clip NIR Spectrometer (350–1100nm)",
      slug: "handheld-leaf-clip-spectrometer",
      category: "Spectrometers & Optics",
      categoryKey: "SPECTROMETER",
      short_description: "Non-destructive optical leaf clip providing real-time NDVI, Water Band Index (WBI), and canopy nitrogen stress vectors.",
      description: "Laboratory-grade chemometrics in the palm of your hand. Integrates dual halogen-tungsten reference illuminators and 288-pixel optical array with direct WebBluetooth wireless synchronization.",
      price_minor_units: 2499900,
      currency: "INR",
      stock_quantity: 18,
      unit: "unit",
      availability_status: "IN_STOCK",
      specifications: {
        "Spectral Range": "350nm – 1100nm (VIS-NIR Full Spectrum)",
        "Optical Resolution": "288 Spectral Channels (FWHM ~10nm)",
        "Derived Metrics": "NDVI, WBI, Chlorophyll Index, Nitrogen Deficit Ratio",
        "Wireless Link": "Bluetooth 5.2 Low Energy (WebBluetooth & BLE Central)",
        "Battery Life": "3200 mAh USB-C Fast Charge (18 hours continuous scans)"
      }
    },
    {
      id: "prod_sns_fdr",
      sku: "SKU-SNS-FDR-MULTI",
      name: "Multi-Depth FDR Soil Moisture & EC Probe (0–60cm)",
      slug: "multi-depth-fdr-soil-moisture-probe",
      category: "Soil & Water Sensors",
      categoryKey: "SENSOR",
      short_description: "Hermetically sealed Frequency Domain Reflectometry sensor monitoring root-zone volumetric water content, EC, and temp.",
      description: "High-frequency 100MHz dielectric permittivity probe delivering ±1.2% volumetric water content accuracy across sandy, loamy, and clay soil matrices without salinity interference.",
      price_minor_units: 480000,
      currency: "INR",
      stock_quantity: 85,
      unit: "unit",
      availability_status: "IN_STOCK",
      specifications: {
        "Moisture Accuracy": "±1.2% VWC (Range: 0% to 100% Saturation)",
        "Electrical Conductivity": "0 – 20,000 µS/cm (Salinity Drift Compensated)",
        "Measurement Depths": "Dual Multi-Level (15cm shallow & 45cm root-zone)",
        "Ingress Protection": "IP68 Hermetic Polyurethane Encapsulation",
        "Protocol": "RS-485 Modbus RTU Standard Register Map"
      }
    },
    {
      id: "prod_act_valve",
      sku: "SKU-ACT-SOL-2IN",
      name: "Industrial 2-Inch Brass 12V DC Latching Solenoid Valve",
      slug: "industrial-2-inch-brass-solenoid-valve",
      category: "Precision Actuators",
      categoryKey: "ACTUATOR",
      short_description: "Ultra-low power pulse-latching solenoid rated for 0.5–10 Bar drip irrigation manifolds with manual mechanical override.",
      description: "Engineered specifically for agricultural drip manifolds. Requires only a 50ms DC pulse to change latching state, drawing zero continuous standby power from solar batteries.",
      price_minor_units: 325000,
      currency: "INR",
      stock_quantity: 64,
      unit: "unit",
      availability_status: "IN_STOCK",
      specifications: {
        "Actuation Mechanism": "Pulse-Latching Solenoid (12V DC, 50ms Pulse)",
        "Operating Pressure": "0.5 to 10.0 Bar (7 to 145 PSI)",
        "Flow Capacity (Kv)": "35.0 m³/hr with minimal pressure drop (<0.15 Bar)",
        "Body Material": "Forged CW617N Industrial Brass with Viton Diaphragm",
        "Override": "Manual 3-position lever (Auto / Open / Locked Shut)"
      }
    },
    {
      id: "prod_sns_sht35",
      sku: "SKU-SNS-SHT35-RAD",
      name: "Sensirion SHT35 Microclimate Canopy Probe",
      slug: "sensirion-sht35-microclimate-probe",
      category: "Soil & Water Sensors",
      categoryKey: "SENSOR",
      short_description: "IP67 sintered brass radiation-shielded ambient temperature and relative humidity probe for Vapor Pressure Deficit (VPD).",
      description: "Authoritative ambient weather sensing with ±0.1°C thermal accuracy. Computes precise atmospheric VPD to adjust transpiration irrigation pulses dynamically.",
      price_minor_units: 245000,
      currency: "INR",
      stock_quantity: 110,
      unit: "unit",
      availability_status: "IN_STOCK",
      specifications: {
        "Temperature Precision": "±0.1°C (at 0°C to 65°C)",
        "Humidity Precision": "±1.5% Relative Humidity (RH)",
        "Shielding": "Multi-Plate Sintered Brass Aspirated Radiation Shield",
        "Response Time (t63%)": "4 seconds in ambient air circulation",
        "Output": "I2C / RS-485 Modbus RTU with CRC-16 Checksum"
      }
    },
    {
      id: "prod_act_fert",
      sku: "SKU-ACT-FERT-PWM",
      name: "Smart Proportional Fertigation Dosing Actuator",
      slug: "smart-proportional-fertigation-dosing-actuator",
      category: "Precision Actuators",
      categoryKey: "ACTUATOR",
      short_description: "Zero-crossing PWM doser with integrated optical flowmeter for closed-loop NPK nutrient injection into main drip lines.",
      description: "Automates chemical fertigation dosing in synchrony with soil EC feedback. Prevents fertilizer burn and ensures uniform nutrient delivery across all 6 field sectors.",
      price_minor_units: 650000,
      currency: "INR",
      stock_quantity: 26,
      unit: "unit",
      availability_status: "IN_STOCK",
      specifications: {
        "Injection Flow Rate": "10 to 250 Litres / hour adjustable",
        "Dosing Accuracy": "±1.5% volumetric precision with pulse feedback",
        "Chemical Compatibility": "NPK, Micronutrients, Phosphoric & Nitric Acid",
        "Control Interface": "Isolated 4-20mA / Modbus RTU / PWM 0-100%",
        "Power Supply": "24V DC @ 45W industrial power pack"
      }
    }
  ];

  // Selected product for modals
  let activeModalProduct = PRODUCTS[0];
  let checkoutProduct = PRODUCTS[0];
  let checkoutQty = 1;

  container.innerHTML = `
    <!-- ======================================================================
         1. SITE HEADER & TOP NAVIGATION
         ====================================================================== -->
    <header class="site-header" id="siteHeader">
      <div class="container">
        <div class="nav-wrapper">
          <a href="#hero" class="brand-link" aria-label="AgriSpectra Home">
            <img src="/landing/assets/logo.png" alt="AgriSpectra Logo" class="brand-logo-img">
            <span class="brand-name">AgriSpectra</span>
          </a>

          <!-- Desktop Navigation -->
          <nav class="nav-desktop" aria-label="Main Navigation">
            <a href="#hero" class="nav-item-link active">Home</a>
            <a href="#products" class="nav-item-link">Products</a>
            <a href="#solutions" class="nav-item-link">Solutions</a>
            <a href="#how-it-works" class="nav-item-link">How It Works</a>
            <a href="#technology" class="nav-item-link">Technology</a>
            <a href="#operations" class="nav-item-link">About Us</a>
            <a href="#faqs" class="nav-item-link">FAQs</a>
            <a href="#demo-request" class="nav-item-link">Contact</a>
          </nav>

          <!-- Navigation CTAs -->
          <div class="nav-actions">
            <button type="button" class="btn btn-outline" id="navSignInBtn" title="Sign In to AgriSpectra">
              <i data-lucide="log-in"></i>
              <span>Sign In</span>
            </button>
            <button type="button" class="btn btn-primary" id="navRegisterBtn" title="Register as a Grower">
              <i data-lucide="user-plus"></i>
              <span>Farmer Register</span>
            </button>
            <button class="hamburger-btn" id="mobileMenuBtn" aria-label="Toggle navigation menu">
              <i data-lucide="menu"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div class="mobile-nav-drawer" id="mobileNavDrawer">
        <div class="mobile-nav-links">
          <a href="#hero" class="mobile-nav-item">Home</a>
          <a href="#products" class="mobile-nav-item">Products</a>
          <a href="#solutions" class="mobile-nav-item">Solutions</a>
          <a href="#how-it-works" class="mobile-nav-item">How It Works</a>
          <a href="#technology" class="mobile-nav-item">Technology</a>
          <a href="#operations" class="mobile-nav-item">About Us</a>
          <a href="#faqs" class="mobile-nav-item">FAQs</a>
          <a href="#demo-request" class="mobile-nav-item">Contact</a>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 20px;">
          <button type="button" class="btn btn-primary mobile-nav-item" id="drawerSignInBtn" style="width: 100%;">
            <i data-lucide="log-in"></i>
            <span>Sign In to Platform</span>
          </button>
          <button type="button" class="btn btn-outline mobile-nav-item" id="drawerRegisterBtn" style="width: 100%;">
            <i data-lucide="user-plus"></i>
            <span>Register as a Farmer</span>
          </button>
          <a href="#demo-request" class="btn btn-outline mobile-nav-item" style="width: 100%;">
            <i data-lucide="calendar"></i>
            <span>Request a Demo</span>
          </a>
        </div>
      </div>
    </header>

    <main>
      <!-- ======================================================================
           2. HERO SECTION
           ====================================================================== -->
      <section class="hero-section" id="hero">
        <div class="container">
          <div class="hero-grid">
            <div class="hero-copy">
              <div class="hero-pill-badge">
                <span class="indicator-dot"></span>
                <span>Precision IoT for Agricultural Irrigation & Spectroscopy</span>
              </div>
              <h1 class="hero-headline">
                Smarter Precision Agriculture.<br>
                Healthier Crops. Better<br>
                Insights.
              </h1>
              <p class="hero-subtext">
                Monitor open fields and orchards with Autonomous Closed-Loop Irrigation, understand crop stress through handheld leaf spectroscopy, and manage 6-zone solenoid valve manifolds through an intelligent IoT edge platform.
              </p>

              <div class="hero-cta-group">
                <a href="#products" class="btn btn-primary btn-lg">
                  <span>Explore Products</span>
                  <i data-lucide="arrow-right"></i>
                </a>
                <a href="#demo-request" class="btn btn-outline btn-lg">
                  <i data-lucide="calendar-check"></i>
                  <span>Request a Demo</span>
                </a>
                <button type="button" class="btn btn-secondary btn-lg" id="heroLaunchDashboardBtn" title="Launch Live Platform Demo">
                  <i data-lucide="layout-dashboard"></i>
                  <span>Launch Live Platform</span>
                </button>
              </div>

              <!-- Factual Verification Metrics Strip -->
              <div class="hero-specs-strip">
                <div class="spec-strip-item">
                  <span class="spec-strip-val">±1.2% VWC</span>
                  <span class="spec-strip-lbl">Soil Moisture Accuracy (FDR)</span>
                </div>
                <div class="spec-strip-item">
                  <span class="spec-strip-val">Sub-Second</span>
                  <span class="spec-strip-lbl">Edge Telemetry Sampling</span>
                </div>
                <div class="spec-strip-item">
                  <span class="spec-strip-val">100% Closed</span>
                  <span class="spec-strip-lbl">Automated Hardware Relay</span>
                </div>
                <div class="spec-strip-item">
                  <span class="spec-strip-val">ICAR Grounded</span>
                  <span class="spec-strip-lbl">Agronomic Research Envelopes</span>
                </div>
              </div>
            </div>

            <!-- Hero Technical Showcase Card -->
            <div class="hero-visual-card">
              <div class="visual-card-top">
                <div class="status-beacon">
                  <span class="pulse"></span>
                  <span id="heroStatusText">PARCEL 01 · ICAR WATER PROTOCOL</span>
                </div>
                <span class="actuator-badge active" id="heroStageBadge">Vegetative G1</span>
              </div>

              <div class="live-dials-grid">
                <div class="live-dial-box">
                  <div class="dial-box-head">
                    <span class="dial-box-lbl"><i data-lucide="droplet"></i> Soil Moisture</span>
                  </div>
                  <div class="dial-box-val" id="heroDialMoist">28.4%</div>
                  <div class="dial-box-target" id="heroRangeMoist">Target: 28.0–34.0% VWC</div>
                </div>

                <div class="live-dial-box">
                  <div class="dial-box-head">
                    <span class="dial-box-lbl"><i data-lucide="thermometer"></i> Canopy Temp</span>
                  </div>
                  <div class="dial-box-val" id="heroDialTemp">24.2°C</div>
                  <div class="dial-box-target" id="heroRangeTemp">Target: 22.0–26.5°C</div>
                </div>

                <div class="live-dial-box">
                  <div class="dial-box-head">
                    <span class="dial-box-lbl"><i data-lucide="leaf"></i> Leaf Vitality</span>
                  </div>
                  <div class="dial-box-val" id="heroDialNdvi">0.78</div>
                  <div class="dial-box-target">NDVI (Optimal Vigor)</div>
                </div>

                <div class="live-dial-box">
                  <div class="dial-box-head">
                    <span class="dial-box-lbl"><i data-lucide="gauge"></i> Line Pressure</span>
                  </div>
                  <div class="dial-box-val" id="heroDialPress">2.42 Bar</div>
                  <div class="dial-box-target">Zones 1–6 Balanced</div>
                </div>
              </div>

              <div class="hero-actuators-strip">
                <div class="actuator-indicator">
                  <span>Main Drip Pump</span>
                  <span class="actuator-badge active" id="chipPump">Active</span>
                </div>
                <div class="actuator-indicator">
                  <span>Zone 1 Solenoid</span>
                  <span class="actuator-badge active" id="chipZ1">Open</span>
                </div>
                <div class="actuator-indicator">
                  <span>Zone 2 Solenoid</span>
                  <span class="actuator-badge standby" id="chipZ2">Standby</span>
                </div>
                <div class="actuator-indicator">
                  <span>Fertigation Doser</span>
                  <span class="actuator-badge active" id="chipFert">PWM 20%</span>
                </div>
              </div>

              <div class="visual-card-footer">
                <span id="heroLastUpdate">Synchronizing authoritative field telemetry...</span>
                <a href="#technology">Explore Technology &amp; Hardware <i data-lucide="arrow-right"></i></a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           3. FEATURED PRODUCTS CATALOGUE
           ====================================================================== -->
      <section class="section-wrapper bg-alt" id="products">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">Enterprise Hardware &amp; Software</span>
            <h2 class="section-title">Precision Hardware Engineered for Soil, Canopy &amp; Hydraulics</h2>
            <p class="section-desc">
              Industrial-grade IoT gateways, multi-depth FDR soil probes, NIR spectrometers, solenoid valve controllers, and cloud software purpose-built for commercial agriculture.
            </p>
          </div>

          <!-- Category Filters -->
          <div class="category-filter-bar" id="categoryFilters" role="tablist" aria-label="Product Categories">
            <button class="cat-pill-btn active" data-category="ALL" role="tab" aria-selected="true">All Products</button>
            <button class="cat-pill-btn" data-category="GATEWAY" role="tab" aria-selected="false">IoT Gateways &amp; Control</button>
            <button class="cat-pill-btn" data-category="SPECTROMETER" role="tab" aria-selected="false">Spectrometers &amp; Optics</button>
            <button class="cat-pill-btn" data-category="SENSOR" role="tab" aria-selected="false">Soil &amp; Water Sensors</button>
            <button class="cat-pill-btn" data-category="ACTUATOR" role="tab" aria-selected="false">Precision Actuators</button>
          </div>

          <!-- Products Catalog Grid -->
          <div class="products-catalog-grid" id="productsCatalogGrid">
            <!-- Dynamic product cards rendered below -->
          </div>
        </div>
      </section>

      <!-- ======================================================================
           4. SOLUTIONS & USE CASES
           ====================================================================== -->
      <section class="section-wrapper" id="solutions">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">Targeted Applications</span>
            <h2 class="section-title">Engineered Solutions for Every Crop Growth Stage</h2>
            <p class="section-desc">
              From seed emergence to peak vegetative growth and tuber sizing, crops require micro-managed root-zone hydration and leaf spectral health to achieve maximum yield.
            </p>
          </div>

          <div class="solutions-grid">
            <!-- Solution 1: Vegetative Stage Irrigation -->
            <article class="solution-card">
              <span class="solution-badge">Stage: Vegetative &amp; Seedling</span>
              <h3 class="solution-title">Root-Zone Moisture Stabilization</h3>
              <div class="solution-breakdown">
                <div class="solution-row">
                  <span class="solution-label">Challenge</span>
                  <span class="solution-text">Shallow root systems are vulnerable to both drought desiccation and waterlogged anoxia, stunting early root anchoring.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Solution</span>
                  <span class="solution-text highlight">High-frequency pulse irrigation maintaining 28%–32% VWC precisely in the top 15cm without leaching nitrogen past the root perimeter.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Outcome</span>
                  <span class="solution-text">Uniform seedling establishment with 42% water savings and zero root rot mortality.</span>
                </div>
              </div>
            </article>

            <!-- Solution 2: Spectroscopy Leaf Defense -->
            <article class="solution-card">
              <span class="solution-badge">Stage: Tuber Bulking &amp; Flowering</span>
              <h3 class="solution-title">Leaf Spectral Disease &amp; Nitrogen Detection</h3>
              <div class="solution-breakdown">
                <div class="solution-row">
                  <span class="solution-label">Challenge</span>
                  <span class="solution-text">Sub-clinical nitrogen deficiency and early fungal blight are invisible to the naked eye until yield damage is already irreversible.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Solution</span>
                  <span class="solution-text highlight">Instant handheld leaf clip scans measuring 705nm red-edge inflection and 970nm water absorption bands via chemometric vectors.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Outcome</span>
                  <span class="solution-text">Deficiency detected 6–8 days before visual chlorosis, saving up to 28% in wasted prophylactic fertilizer.</span>
                </div>
              </div>
            </article>

            <!-- Solution 3: Hydraulic 6-Zone Balancing -->
            <article class="solution-card">
              <span class="solution-badge">All Growth Cycles</span>
              <h3 class="solution-title">6-Zone Hydraulic Pressure Balancing</h3>
              <div class="solution-breakdown">
                <div class="solution-row">
                  <span class="solution-label">Challenge</span>
                  <span class="solution-text">Elevation slopes and varying soil types across 1-acre blocks cause emitter clogging, uneven emitter discharge, and water hammer.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Solution</span>
                  <span class="solution-text highlight">Sequential interlocked solenoid valve scheduling with soft-start pump ramp times and pressure transducer feedback (2.2–2.6 Bar).</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Outcome</span>
                  <span class="solution-text">Zero pipe rupture events, balanced volumetric emission uniformity (&gt;94%), and protected pump longevity.</span>
                </div>
              </div>
            </article>

            <!-- Solution 4: Extreme Heatwave Protection -->
            <article class="solution-card">
              <span class="solution-badge">Extreme Weather Mode</span>
              <h3 class="solution-title">Heatwave Micro-Pulse Evaporative Cooling</h3>
              <div class="solution-breakdown">
                <div class="solution-row">
                  <span class="solution-label">Challenge</span>
                  <span class="solution-text">Midday ambient temperatures exceeding 38°C induce stomatal closure, vegetative thermal shock, and blossom drop.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Solution</span>
                  <span class="solution-text highlight">Automated short 90-second misting micro-pulses triggered when Vapor Pressure Deficit exceeds 2.8 kPa, lowering canopy temp by 4–6°C.</span>
                </div>
                <div class="solution-row">
                  <span class="solution-label">Outcome</span>
                  <span class="solution-text">Prevention of blossom abortion, continued midday photosynthesis, and uninterrupted crop bulking.</span>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           5. HOW IT WORKS
           ====================================================================== -->
      <section class="section-wrapper bg-alt" id="how-it-works">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">End-to-End Pipeline</span>
            <h2 class="section-title">How AgriSpectra Delivers Closed-Loop Autonomous Agronomy</h2>
            <p class="section-desc">
              From in-field sensor sampling and spectral leaf scans to sub-second cloud analytics and physical solenoid valve actuation.
            </p>
          </div>

          <div class="workflow-steps-grid">
            <div class="workflow-step-card">
              <div class="step-num-badge">01</div>
              <h3 class="step-title">Physical Sensor Deployment</h3>
              <p class="step-desc">
                Multi-depth FDR soil moisture sensors and Sensirion SHT35 probes are installed across all 6 crop management zones.
              </p>
            </div>

            <div class="workflow-step-card">
              <div class="step-num-badge">02</div>
              <h3 class="step-title">Continuous Edge Sampling</h3>
              <p class="step-desc">
                The dual-core ESP32-S3 edge node samples volumetric water content, line pressure, temperature, and leaf reflectance vectors.
              </p>
            </div>

            <div class="workflow-step-card">
              <div class="step-num-badge">03</div>
              <h3 class="step-title">Encrypted Ingestion Stream</h3>
              <p class="step-desc">
                Telemetry is cryptographically signed with mTLS device certificates and streamed over 4G LTE-M / MQTT 5.0 into cloud time-series.
              </p>
            </div>

            <div class="workflow-step-card">
              <div class="step-num-badge">04</div>
              <h3 class="step-title">Evaluate Agronomic Setpoints</h3>
              <p class="step-desc">
                The decision engine compares real-time root-zone depletion against ICAR crop water stress indices and vegetative stage curves.
              </p>
            </div>

            <div class="workflow-step-card">
              <div class="step-num-badge">05</div>
              <h3 class="step-title">Execute Closed-Loop Actuation</h3>
              <p class="step-desc">
                Actuator commands trigger 12V pulse-latching solenoids, the main booster pump, and PWM fertigation injectors with mutual interlocks.
              </p>
            </div>

            <div class="workflow-step-card">
              <div class="step-num-badge">06</div>
              <h3 class="step-title">Farmer Alerts &amp; AI Explanations</h3>
              <p class="step-desc">
                Growers receive actionable notifications and multilingual TTS audio readouts explaining every autonomous valve activation.
              </p>
            </div>
          </div>

          <!-- Architecture Flow Banner -->
          <div class="arch-diagram-banner">
            <div>
              <h3 class="arch-banner-title">Zero-Single-Point-of-Failure Architecture</h3>
              <p class="arch-banner-desc">
                If cellular connectivity drops, the local ESP32-S3 gateway continues autonomous PID irrigation regulation using cached agronomic setpoints, then safely backfills buffered telemetry once reconnected.
              </p>
            </div>
            <div class="arch-flow-diagram">
              <div class="flow-node">
                <div class="flow-node-icon"><i data-lucide="cpu"></i></div>
                <span class="flow-node-title">Soil &amp; Leaf Probes</span>
              </div>
              <i data-lucide="arrow-right" class="flow-arrow"></i>
              <div class="flow-node">
                <div class="flow-node-icon"><i data-lucide="router"></i></div>
                <span class="flow-node-title">Agri-Edge Node</span>
              </div>
              <i data-lucide="arrow-right" class="flow-arrow"></i>
              <div class="flow-node">
                <div class="flow-node-icon"><i data-lucide="server"></i></div>
                <span class="flow-node-title">Cloud Analytics</span>
              </div>
              <i data-lucide="arrow-right" class="flow-arrow"></i>
              <div class="flow-node">
                <div class="flow-node-icon"><i data-lucide="zap"></i></div>
                <span class="flow-node-title">6-Zone Valves</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           6. TECHNOLOGY & PROTOCOLS
           ====================================================================== -->
      <section class="section-wrapper" id="technology">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">Hardware &amp; Protocols</span>
            <h2 class="section-title">Built on Open Standards and Resilient Industrial Protocols</h2>
            <p class="section-desc">
              No proprietary lock-in. AgriSpectra hardware interfaces seamlessly with industry-standard sensors, modems, and electrical control panels.
            </p>
          </div>

          <div class="tech-spec-grid">
            <div class="tech-spec-card">
              <div class="tech-icon-wrap"><i data-lucide="cable"></i></div>
              <h3 class="tech-card-title">RS-485 Modbus RTU &amp; I²C</h3>
              <p class="tech-card-desc">
                High-noise-immunity differential bus supporting sensor runs up to 500 meters in outdoor agricultural fields without packet loss.
              </p>
              <div class="tech-tag-list">
                <span class="tech-tag">MODBUS-RTU</span>
                <span class="tech-tag">I2C BUS</span>
                <span class="tech-tag">500M RANGE</span>
              </div>
            </div>

            <div class="tech-spec-card">
              <div class="tech-icon-wrap"><i data-lucide="cpu"></i></div>
              <h3 class="tech-card-title">ESP32-S3 Dual-Core SoC</h3>
              <p class="tech-card-desc">
                240MHz Xtensa LX7 dual-core processor with hardware cryptographic acceleration, running non-blocking FreeRTOS telemetry tasks.
              </p>
              <div class="tech-tag-list">
                <span class="tech-tag">240 MHZ</span>
                <span class="tech-tag">FREERTOS</span>
                <span class="tech-tag">HARDWARE AES</span>
              </div>
            </div>

            <div class="tech-spec-card">
              <div class="tech-icon-wrap"><i data-lucide="lock"></i></div>
              <h3 class="tech-card-title">MQTT 5 &amp; mTLS Transport</h3>
              <p class="tech-card-desc">
                Bidirectional publish/subscribe over TLS 1.3 with individual X.509 device certificates for tamper-proof telemetry transmission.
              </p>
              <div class="tech-tag-list">
                <span class="tech-tag">TLS 1.3</span>
                <span class="tech-tag">X.509 CERTS</span>
                <span class="tech-tag">MQTT 5.0</span>
              </div>
            </div>

            <div class="tech-spec-card">
              <div class="tech-icon-wrap"><i data-lucide="database"></i></div>
              <h3 class="tech-card-title">PostgreSQL Time-Series Core</h3>
              <p class="tech-card-desc">
                ACID-compliant relational integrity with table partitioning for billions of historical telemetry rows, audit logs, and analytics.
              </p>
              <div class="tech-tag-list">
                <span class="tech-tag">PARTITIONED</span>
                <span class="tech-tag">JSONB</span>
                <span class="tech-tag">FASTAPI</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           7. OPERATIONAL BENEFITS
           ====================================================================== -->
      <section class="section-wrapper bg-alt" id="benefits">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">Factual Operational Value</span>
            <h2 class="section-title">Measurable Operational Advantages for Commercial Agriculture</h2>
            <p class="section-desc">
              Direct, verifiable improvements in crop yield consistency, water conservation, and input cost reduction.
            </p>
          </div>

          <div class="benefits-grid">
            <div class="benefit-card">
              <div class="benefit-icon"><i data-lucide="droplets"></i></div>
              <h3 class="benefit-title">35% to 50% Water Conservation</h3>
              <p class="benefit-desc">
                By irrigating only when root-zone volumetric water content dips below certified depletion setpoints, water waste and deep percolation loss are eliminated.
              </p>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon"><i data-lucide="leaf"></i></div>
              <h3 class="benefit-title">Early Nitrogen Stress Detection</h3>
              <p class="benefit-desc">
                Handheld leaf spectroscopy catches chlorophyll degradation up to a week prior to visible canopy yellowing, protecting tuber bulking potential.
              </p>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon"><i data-lucide="zap"></i></div>
              <h3 class="benefit-title">Zero Water Hammer Pipe Protection</h3>
              <p class="benefit-desc">
                Soft-transition valve interlocks and pressure stabilization algorithms protect PVC/HDPE drip laterals from pressure surges and bursting.
              </p>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon"><i data-lucide="battery-charging"></i></div>
              <h3 class="benefit-title">Solar &amp; Low-Power Optimization</h3>
              <p class="benefit-desc">
                Pulse-latching solenoids consume zero standby power, allowing the entire 1-acre gateway system to run indefinitely on a single 50W solar panel.
              </p>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon"><i data-lucide="layout-grid"></i></div>
              <h3 class="benefit-title">Centralized Multi-Parcel Oversight</h3>
              <p class="benefit-desc">
                Farm owners, agronomists, and operators monitor multiple disparate plots, valve states, and spectral logs from a single unified cloud view.
              </p>
            </div>

            <div class="benefit-card">
              <div class="benefit-icon"><i data-lucide="languages"></i></div>
              <h3 class="benefit-title">Multilingual Farmer Accessibility</h3>
              <p class="benefit-desc">
                Voice readouts and notifications in English, Hindi, Kannada, Telugu, and Spanish ensure field operators can act immediately on irrigation insights.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           8. OPERATIONS & AGRONOMIC GROUNDING
           ====================================================================== -->
      <section class="section-wrapper" id="operations">
        <div class="container">
          <div class="field-ops-card">
            <div>
              <span class="section-eyebrow">Agronomic Grounding</span>
              <h2 class="field-ops-title">Engineered Specifically for High-Value Commercial Crops</h2>
              <p class="field-ops-desc">
                AgriSpectra was developed to solve real-world irrigation and fertilizer challenges across intensive potato, tomato, onion, and orchard farming belts. Our irrigation setpoints are grounded in ICAR and State Agricultural University scientific protocols for precision drip management.
              </p>
              <div class="field-clusters-wrap">
                <span class="cluster-pill">Sonoma Valley Trial Plot</span>
                <span class="cluster-pill">Nashik Onion &amp; Grape Belt</span>
                <span class="cluster-pill">Kolar Vegetable Cluster</span>
                <span class="cluster-pill">Mysuru Agri Basin</span>
                <span class="cluster-pill">Anantapur Drylands</span>
                <span class="cluster-pill">Punjab Potato Belt</span>
              </div>
            </div>

            <div class="research-citation-box">
              <div class="citation-header"><i data-lucide="book-open"></i> ICAR Recommended Irrigation Standards</div>
              <p class="citation-text">
                <strong>Vegetative Emergence:</strong> 28.0–32.0% VWC | Top 15cm root-zone<br>
                <strong>Tuber Bulking / Fruit Sizing:</strong> 30.0–34.0% VWC | Continuous root aeration<br>
                <strong>Hydraulic Manifold Pressure:</strong> 2.0 to 2.8 Bar maintained<br>
                <strong>Spectral NDVI Health Gate:</strong> &gt; 0.72 indicates optimal canopy vigor.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           9. PROFESSIONAL INSTALLATION & SUPPORT
           ====================================================================== -->
      <section class="section-wrapper bg-alt" id="installation">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">Professional Services</span>
            <h2 class="section-title">Comprehensive Installation &amp; Field Engineering Support</h2>
            <p class="section-desc">
              We provide full-spectrum engineering services from pre-installation hydraulic audits to on-site probe calibration and grower training.
            </p>
          </div>

          <div class="services-steps-grid">
            <div class="service-step-card">
              <div class="service-icon"><i data-lucide="clipboard-check"></i></div>
              <h3 class="service-title">1. Site Survey &amp; Hydraulic Audit</h3>
              <p class="service-desc">
                Assessment of field slopes, pipe friction loss, pump flow rates, and optimal FDR probe placement in representative soil zones.
              </p>
            </div>

            <div class="service-step-card">
              <div class="service-icon"><i data-lucide="wrench"></i></div>
              <h3 class="service-title">2. Turnkey Hardware Mounting</h3>
              <p class="service-desc">
                Certified field mounting of IP66 gateway enclosures, 12V latching solenoid valve manifolds, and protected RS-485 conduits.
              </p>
            </div>

            <div class="service-step-card">
              <div class="service-icon"><i data-lucide="sliders"></i></div>
              <h3 class="service-title">3. Multi-Point Calibration</h3>
              <p class="service-desc">
                Laboratory-verified gravimetric soil calibration to set soil-specific dielectric offsets in gateway non-volatile memory.
              </p>
            </div>

            <div class="service-step-card">
              <div class="service-icon"><i data-lucide="users"></i></div>
              <h3 class="service-title">4. Farmer &amp; Staff Training</h3>
              <p class="service-desc">
                Hands-on training for farm managers and field operators on leaf clip scanning, valve override levers, and mobile alert management.
              </p>
            </div>

            <div class="service-step-card">
              <div class="service-icon"><i data-lucide="refresh-cw"></i></div>
              <h3 class="service-title">5. Firmware &amp; Model Updates</h3>
              <p class="service-desc">
                Secure over-the-air firmware updates delivering refined chemometric spectral calibration and seasonal setpoint adjustments.
              </p>
            </div>

            <div class="service-step-card">
              <div class="service-icon"><i data-lucide="headphones"></i></div>
              <h3 class="service-title">6. Dedicated Regional Support</h3>
              <p class="service-desc">
                Rapid field technician dispatch with guaranteed SLAs and direct WhatsApp phone assistance throughout the growing season.
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           10. FAQS (ACCORDION)
           ====================================================================== -->
      <section class="section-wrapper" id="faqs">
        <div class="container">
          <div class="section-header-wrap">
            <span class="section-eyebrow">Clear Answers</span>
            <h2 class="section-title">Frequently Asked Questions</h2>
            <p class="section-desc">
              Common questions regarding AgriSpectra hardware compatibility, offline resilience, and operational deployment.
            </p>
          </div>

          <div class="faqs-container-max" id="faqsAccordionWrap">
            <!-- FAQ 1 -->
            <div class="faq-accordion-item open">
              <button class="faq-header-btn" type="button" aria-expanded="true">
                <span>What does the AgriSpectra platform do?</span>
                <i data-lucide="chevron-down" class="faq-chevron"></i>
              </button>
              <div class="faq-body-content">
                <p>AgriSpectra is an industrial IoT precision irrigation and agronomic intelligence platform designed for commercial open-field and greenhouse crops:</p>
                <ul class="faq-list">
                  <li><strong>Multi-Depth Soil Sensing:</strong> Continuously monitors root-zone volumetric water content (VWC), electrical conductivity (EC), and soil temperature.</li>
                  <li><strong>Handheld Leaf Spectroscopy:</strong> Measures reflectance across 350–1100nm to identify water stress and nitrogen deficiencies non-destructively.</li>
                  <li><strong>Autonomous 6-Zone Actuation:</strong> Edge gateways trigger 12V latching solenoid valve manifolds to deliver precise water pulses without human delay.</li>
                </ul>
              </div>
            </div>

            <!-- FAQ 2 -->
            <div class="faq-accordion-item">
              <button class="faq-header-btn" type="button" aria-expanded="false">
                <span>Does the system function during rural broadband or cellular outages?</span>
                <i data-lucide="chevron-down" class="faq-chevron"></i>
              </button>
              <div class="faq-body-content">
                <p><strong>Yes, 100% autonomously.</strong> AgriSpectra gateways are built with local failover state machines:</p>
                <ul class="faq-list">
                  <li><strong>Local Closed-Loop Decisions:</strong> PID irrigation algorithms run locally on the ESP32-S3 microcontroller using stored agronomic setpoints.</li>
                  <li><strong>Non-Volatile Buffer:</strong> Up to 30 days of sub-second sensor readings are stored in encrypted flash memory if cellular data is offline.</li>
                  <li><strong>Auto Cloud Sync:</strong> All buffered data seamlessly syncs with the cloud database the moment connection is restored.</li>
                </ul>
              </div>
            </div>

            <!-- FAQ 3 -->
            <div class="faq-accordion-item">
              <button class="faq-header-btn" type="button" aria-expanded="false">
                <span>Can AgriSpectra retrofit onto existing drip irrigation setups?</span>
                <i data-lucide="chevron-down" class="faq-chevron"></i>
              </button>
              <div class="faq-body-content">
                <p><strong>Yes.</strong> AgriSpectra was specifically engineered to avoid replacing your expensive existing drip piping and pumps:</p>
                <ul class="faq-list">
                  <li><strong>Standard 2-Inch Manifolds:</strong> Our latching solenoid valves screw directly onto standard 2-inch or 2.5-inch PVC/HDPE irrigation manifolds.</li>
                  <li><strong>Standard Starter Panels:</strong> The gateway relay switches wire directly into existing contactor coils of electric or solar submersible pumps.</li>
                </ul>
              </div>
            </div>

            <!-- FAQ 4 -->
            <div class="faq-accordion-item">
              <button class="faq-header-btn" type="button" aria-expanded="false">
                <span>How accurate is the handheld leaf spectrometer compared to lab testing?</span>
                <i data-lucide="chevron-down" class="faq-chevron"></i>
              </button>
              <div class="faq-body-content">
                <p>The handheld optical leaf clip features a 288-channel VIS-NIR detector covering 350nm to 1100nm with dual tungsten reference illuminators. In comparative trials against destructive laboratory Dumas nitrogen combustion analysis, AgriSpectra chemometric models achieve an R² correlation of 0.94 for canopy nitrogen and 0.96 for moisture content.</p>
              </div>
            </div>

            <!-- FAQ 5 -->
            <div class="faq-accordion-item">
              <button class="faq-header-btn" type="button" aria-expanded="false">
                <span>How are alerts and irrigation notifications delivered to growers?</span>
                <i data-lucide="chevron-down" class="faq-chevron"></i>
              </button>
              <div class="faq-body-content">
                <p>When soil moisture or canopy stress exceeds safe thresholds, notifications are dispatched across multiple redundant channels:</p>
                <ul class="faq-list">
                  <li><strong>Instant WhatsApp Alerts:</strong> One-line concise operational summaries of every valve actuation and sensor alert.</li>
                  <li><strong>Voice TTS Audio Notes:</strong> Spoken audio briefings in the grower's regional language (English, Hindi, Kannada, Telugu, Spanish).</li>
                  <li><strong>Web &amp; Mobile Push Alerts:</strong> Real-time dashboard updates with interactive valve override controls.</li>
                </ul>
              </div>
            </div>

            <!-- FAQ 6 -->
            <div class="faq-accordion-item">
              <button class="faq-header-btn" type="button" aria-expanded="false">
                <span>What warranty and after-sales support do you provide?</span>
                <i data-lucide="chevron-down" class="faq-chevron"></i>
              </button>
              <div class="faq-body-content">
                <p>All AgriSpectra gateways, sensors, and solenoid valves include a comprehensive <strong>2-Year Comprehensive Replacement Warranty</strong>. Our regional agricultural engineering teams provide scheduled on-site calibration visits and 24/7 technical assistance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ======================================================================
           11. CONTACT & DEMO REQUEST
           ====================================================================== -->
      <section class="contact-section-wrap" id="demo-request">
        <div class="container">
          <div class="contact-grid">
            <div class="contact-info-col">
              <span class="section-eyebrow" style="color: var(--emerald-400);">Get In Touch</span>
              <h2 style="font-size: 2.2rem; font-weight: 800; color: var(--white); line-height: 1.2; margin-bottom: 16px;">
                Request a Field Demonstration or Custom Farm Engineering Audit
              </h2>
              <p style="font-size: 1rem; color: var(--slate-300); line-height: 1.6; margin-bottom: 28px;">
                Our agricultural engineers evaluate your water availability, soil type, and crop schedule to design an automated 6-zone closed-loop irrigation system.
              </p>

              <div class="contact-points-list">
                <div class="contact-point-item">
                  <div class="contact-point-icon"><i data-lucide="map-pin"></i></div>
                  <div>
                    <strong style="color: var(--white); display: block; font-size: 0.92rem;">Regional Engineering Hubs</strong>
                    <span style="color: var(--slate-400); font-size: 0.84rem;">Bengaluru · Nashik · Kolar · Sonoma Valley</span>
                  </div>
                </div>

                <div class="contact-point-item">
                  <div class="contact-point-icon"><i data-lucide="phone"></i></div>
                  <div>
                    <strong style="color: var(--white); display: block; font-size: 0.92rem;">Direct Field Line</strong>
                    <span style="color: var(--slate-400); font-size: 0.84rem;">+91 80 2846 1000 / +1 (707) 555-0199</span>
                  </div>
                </div>

                <div class="contact-point-item">
                  <div class="contact-point-icon"><i data-lucide="mail"></i></div>
                  <div>
                    <strong style="color: var(--white); display: block; font-size: 0.92rem;">Technical Inquiries</strong>
                    <span style="color: var(--slate-400); font-size: 0.84rem;">engineering@agrispectra.io</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Demo Request Form Card -->
            <div class="contact-form-card">
              <form id="demoEnquiryForm" novalidate>
                <div style="margin-bottom: 20px;">
                  <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--slate-900); margin-bottom: 4px;">Request a Technical Consultation</h3>
                  <p style="font-size: 0.84rem; color: var(--slate-500);">Complete the details below to receive a customized precision agronomy quote.</p>
                </div>

                <div class="form-row-2col">
                  <div class="form-group">
                    <label class="form-label" for="enqFullName">Full Name *</label>
                    <input type="text" id="enqFullName" class="form-input" placeholder="e.g. Ramesh Patel / Acchu harshith" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="enqPhone">Phone Number *</label>
                    <input type="tel" id="enqPhone" class="form-input" placeholder="+91 98765 43210" required>
                  </div>
                </div>

                <div class="form-row-2col">
                  <div class="form-group">
                    <label class="form-label" for="enqFarmLocation">Farm Location / District *</label>
                    <input type="text" id="enqFarmLocation" class="form-input" placeholder="e.g. Sonoma / Kolar / Nashik" required>
                  </div>
                  <div class="form-group">
                    <label class="form-label" for="enqFarmSize">Total Acreage / Farm Size</label>
                    <select id="enqFarmSize" class="form-input">
                      <option value="1_acre">1 Acre (Standard 6-Zone Kit)</option>
                      <option value="2_5_acres">2 to 5 Acres</option>
                      <option value="5_15_acres">5 to 15 Acres</option>
                      <option value="commercial">15+ Acres Commercial Orchard</option>
                    </select>
                  </div>
                </div>

                <div class="form-group">
                  <label class="form-label" for="enqCropType">Primary Crop Cultivated</label>
                  <input type="text" id="enqCropType" class="form-input" placeholder="e.g. Potatoes, Tomatoes, Vineyards, Citrus">
                </div>

                <div class="form-group">
                  <label class="form-label" for="enqMessage">Specific Irrigation or Spectroscopy Requirements</label>
                  <textarea id="enqMessage" class="form-input" rows="3" placeholder="Tell us about your soil type, water source, or specific problem..."></textarea>
                </div>

                <button type="submit" class="btn btn-primary" id="enqSubmitBtn" style="width: 100%; padding: 13px;">
                  <i data-lucide="send"></i>
                  <span>Submit Technical Request</span>
                </button>
              </form>

              <!-- Success Card -->
              <div id="enquirySuccessCard" class="hidden" style="text-align: center; padding: 24px 12px;">
                <div style="width: 60px; height: 60px; border-radius: 50%; background: var(--emerald-100); color: var(--emerald-700); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 28px;">
                  ✓
                </div>
                <h3 style="font-size: 1.4rem; font-weight: 800; color: var(--slate-900); margin-bottom: 8px;">Inquiry Confirmed</h3>
                <p style="font-size: 0.9rem; color: var(--slate-600); line-height: 1.55; margin-bottom: 16px;">
                  Your request has been logged in our enterprise CRM. A field agronomy engineer will review your parcel requirements and contact you within 1 business day.
                </p>
                <div class="enquiry-ref-box" style="margin-bottom: 20px;">
                  Reference ID: <span id="enquiryReferenceBadge" style="font-family: var(--font-mono); font-weight: 700; color: var(--emerald-800);">ENQ-2026-0842</span>
                </div>
                <div>
                  <button type="button" class="btn btn-outline btn-sm" id="resetEnquiryBtn">
                    <span>Submit Another Inquiry</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ======================================================================
         12. ENTERPRISE FOOTER
         ====================================================================== -->
    <footer class="site-footer">
      <div class="container">
        <div class="footer-top-grid">
          <div class="footer-brand-col">
            <div class="brand-link">
              <img src="/landing/assets/logo.png" alt="AgriSpectra Logo" class="brand-logo-img">
              <span class="brand-name" style="color: var(--white);">AgriSpectra</span>
            </div>
            <p>
              Autonomous precision irrigation management, 6-zone hydraulic automation, and non-destructive handheld leaf spectroscopy engineered for commercial agriculture.
            </p>
            <p style="font-size: 0.78rem; color: var(--slate-500); margin-top: 10px;">
              Grounded in scientific guidelines by Indian Council of Agricultural Research (ICAR) and Global Precision Agronomy standards.
            </p>
          </div>

          <div>
            <h4 class="footer-heading">Navigation</h4>
            <div class="footer-links-list">
              <a href="#hero">Overview</a>
              <a href="#products">Hardware Products</a>
              <a href="#solutions">Stage Solutions</a>
              <a href="#how-it-works">How It Works</a>
              <a href="#technology">Technology &amp; Specs</a>
              <a href="#faqs">Frequently Asked Questions</a>
              <a href="#demo-request">Request a Demo</a>
            </div>
          </div>

          <div>
            <h4 class="footer-heading">Field Support</h4>
            <div class="footer-links-list">
              <span style="color: var(--slate-300); font-weight: 600;">Regional Agronomy Hubs</span>
              <span>Bengaluru · Nashik · Kolar · Sonoma</span>
              <span style="margin-top: 8px;">Direct: +91 80 2846 1000</span>
              <span>Email: support@agrispectra.io</span>
              <span style="color: var(--emerald-400); font-weight: 600; margin-top: 8px;">ISO 9001:2015 Compliant QA</span>
            </div>
          </div>
        </div>

        <div class="footer-bottom-bar">
          <div>
            &copy; 2026 AgriSpectra Flow &amp; Field Technologies. All rights reserved. Built with authoritative database telemetry.
          </div>
          <div class="footer-legal-links">
            <a href="javascript:void(0)" id="footerPrivacyLink">Privacy Policy</a>
            <a href="javascript:void(0)" id="footerTermsLink">Terms of Service</a>
            <a href="javascript:void(0)" id="footerSignInLink">Sign In</a>
            <a href="javascript:void(0)" id="footerRegisterLink">Farmer Registration</a>
          </div>
        </div>
      </div>
    </footer>

    <!-- ======================================================================
         13. MODALS (PRODUCT DETAILS, CHECKOUT, SIGN IN, REGISTER, PRIVACY, TERMS)
         ====================================================================== -->

    <!-- Product Details Modal -->
    <div class="modal-overlay" id="productDetailModal" role="dialog" aria-modal="true" aria-labelledby="modalProductTitle">
      <div class="modal-card">
        <div class="modal-header">
          <div>
            <span class="product-badge-cat" id="modalProductCategory">CATEGORY</span>
            <h3 class="modal-title" id="modalProductTitle" style="margin-top: 6px;">Product Name</h3>
            <span class="product-sku" id="modalProductSku">SKU-0000</span>
          </div>
          <button class="modal-close-btn" id="modalProductCloseBtn" aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <h4 style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-400); margin-bottom: 6px;">Overview</h4>
            <p id="modalProductDesc" style="font-size: 0.92rem; color: var(--slate-700); line-height: 1.6;"></p>
          </div>

          <div style="margin-bottom: 24px;">
            <h4 style="font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-400); margin-bottom: 10px;">Technical Specifications</h4>
            <table class="modal-specs-table" id="modalSpecsTable">
              <tbody></tbody>
            </table>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; padding-top: 16px; border-top: 1px solid var(--slate-200);">
            <div>
              <div id="modalProductPrice" style="font-size: 1.3rem; font-weight: 800; color: var(--slate-900);">₹0.00</div>
              <span style="font-size: 0.74rem; color: var(--slate-400);">Excl. applicable taxes &amp; installation</span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button type="button" class="btn btn-outline" id="modalProductQuoteBtn">
                <i data-lucide="mail"></i>
                <span>Get Quote</span>
              </button>
              <button type="button" class="btn btn-primary" id="modalProductBuyBtn">
                <i data-lucide="shopping-bag"></i>
                <span>Buy Now</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Product Checkout Modal -->
    <div class="modal-overlay" id="productCheckoutModal" role="dialog" aria-modal="true" aria-labelledby="checkoutModalTitle">
      <div class="modal-card checkout-modal-card">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div class="checkout-icon-badge">
              <i data-lucide="shopping-bag"></i>
            </div>
            <div>
              <h3 class="modal-title" id="checkoutModalTitle">Complete Hardware Purchase</h3>
              <span style="font-size: 0.8rem; color: var(--slate-500);">Direct Precision Agricultural Hardware Fulfillment</span>
            </div>
          </div>
          <button class="modal-close-btn" id="checkoutCloseBtn" aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
        </div>

        <div class="modal-body" id="checkoutModalContent">
          <!-- Step 1: Form View -->
          <div id="checkoutFormView">
            <div class="checkout-product-card">
              <div class="checkout-product-details" style="width: 100%;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <span class="product-badge-cat" id="checkoutProductCategory">Sensors</span>
                  <span class="product-badge-avail in-stock" id="checkoutProductStock">In Stock</span>
                </div>
                <h4 id="checkoutProductName" style="font-size: 1.1rem; font-weight: 800; margin: 4px 0; color: var(--slate-900);">Product Name</h4>
                <span class="product-sku" id="checkoutProductSku">SKU-0000</span>
                <div style="margin-top: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <span style="font-size: 0.72rem; color: var(--slate-500); display: block; text-transform: uppercase; font-weight: 700;">Unit Price</span>
                    <strong id="checkoutUnitUnitPrice" style="font-size: 1.15rem; color: var(--emerald-800);">₹0.00</strong>
                  </div>
                  <!-- Quantity Stepper -->
                  <div class="qty-stepper-wrap">
                    <span style="font-size: 0.72rem; color: var(--slate-500); display: block; margin-bottom: 2px; text-transform: uppercase; font-weight: 700;">Quantity</span>
                    <div class="qty-stepper">
                      <button type="button" class="qty-btn" id="btnQtyMinus" aria-label="Decrease quantity">-</button>
                      <input type="number" id="checkoutQuantity" value="1" min="1" max="99" readonly>
                      <button type="button" class="qty-btn" id="btnQtyPlus" aria-label="Increase quantity">+</button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Price & Tax Breakdown Card -->
            <div class="checkout-cost-summary">
              <div class="cost-row">
                <span>Base Subtotal (<span id="checkoutQtySummary">1 unit</span>)</span>
                <strong id="checkoutCostSubtotal">₹0.00</strong>
              </div>
              <div class="cost-row">
                <span>GST (18% Input Tax Credit Eligible)</span>
                <strong id="checkoutCostGst">₹0.00</strong>
              </div>
              <div class="cost-row">
                <span>Farm Delivery &amp; Safe Transit</span>
                <span class="badge-free-delivery">FREE</span>
              </div>
              <div class="cost-total-row">
                <span>Total Amount Due</span>
                <span class="total-amount-val" id="checkoutCostTotal">₹0.00</span>
              </div>
            </div>

            <!-- Shipping Address Form -->
            <form id="checkoutShippingForm" novalidate style="margin-top: 16px;">
              <h5 style="font-size: 0.88rem; font-weight: 700; color: var(--slate-900); margin-bottom: 12px; display: flex; align-items: center; gap: 6px;">
                <i data-lucide="map-pin" style="width: 16px; height: 16px;"></i> Delivery Destination
              </h5>
              <div class="form-row-2col">
                <div class="form-group">
                  <label class="form-label" for="chkCustomerName">Farmer / Business Name *</label>
                  <input type="text" id="chkCustomerName" class="form-input" placeholder="e.g. Ramesh Patel" required value="Acchu harshith">
                </div>
                <div class="form-group">
                  <label class="form-label" for="chkCustomerPhone">Phone Number *</label>
                  <input type="tel" id="chkCustomerPhone" class="form-input" placeholder="+91 98765 43210" required value="+91 98450 12345">
                </div>
              </div>
              <div class="form-row-2col">
                <div class="form-group">
                  <label class="form-label" for="chkAddress">Village / Farm Address *</label>
                  <input type="text" id="chkAddress" class="form-input" placeholder="AgriSpectra Precision Block A" required value="Parcel 01, Drip Block A">
                </div>
                <div class="form-group">
                  <label class="form-label" for="chkPinCode">Postal PIN Code *</label>
                  <input type="text" id="chkPinCode" class="form-input" placeholder="560001" required value="560064">
                </div>
              </div>

              <!-- Payment Method Selection -->
              <div style="margin-top: 16px; margin-bottom: 18px;">
                <label class="form-label">Payment Method</label>
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
                  <label style="border: 1px solid var(--emerald-600); background: var(--emerald-50); padding: 10px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 700; color: var(--emerald-900); display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="payMethod" value="UPI" checked> Instant UPI / QR
                  </label>
                  <label style="border: 1px solid var(--slate-300); background: var(--white); padding: 10px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; color: var(--slate-700); display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="payMethod" value="CARD"> Credit / Debit Card
                  </label>
                  <label style="border: 1px solid var(--slate-300); background: var(--white); padding: 10px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; color: var(--slate-700); display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="payMethod" value="COD"> Cash on Delivery
                  </label>
                </div>
              </div>

              <button type="submit" class="btn btn-primary" id="btnConfirmPay" style="width: 100%; padding: 13px;">
                <i data-lucide="lock"></i>
                <span id="btnPayLabel">Pay Now &amp; Confirm Order</span>
              </button>
            </form>
          </div>

          <!-- Step 2: Receipt Success View -->
          <div id="checkoutReceiptView" class="hidden" style="text-align: center; padding: 24px 12px;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--emerald-100); color: var(--emerald-700); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 32px;">
              ✓
            </div>
            <h3 style="font-size: 1.45rem; font-weight: 800; color: var(--slate-900); margin-bottom: 6px;">Payment Confirmed!</h3>
            <p style="font-size: 0.88rem; color: var(--slate-600); margin-bottom: 16px;">
              Your order has been authorized and forwarded to AgriSpectra hardware fulfillment.
            </p>
            <div style="background: var(--slate-50); border: 1px dashed var(--slate-300); border-radius: var(--radius-md); padding: 16px; margin-bottom: 20px; text-align: left; font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: var(--slate-500);">Order ID:</span>
                <strong id="receiptOrderId" style="font-family: var(--font-mono); color: var(--slate-900);">ORD-2026-9284</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: var(--slate-500);">Item:</span>
                <strong id="receiptItemName">AgriSpectra Edge-6 IoT Gateway</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: var(--slate-500);">Total Paid:</span>
                <strong id="receiptTotalPaid" style="color: var(--emerald-800); font-size: 1rem;">₹17,698.82</strong>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--slate-500);">Delivery To:</span>
                <span id="receiptDeliveryTo" style="color: var(--slate-700);">Acchu harshith (+91 98450 12345)</span>
              </div>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
              <button type="button" class="btn btn-outline" id="receiptCloseBtn">
                <span>Back to Catalog</span>
              </button>
              <button type="button" class="btn btn-primary" id="receiptGoDashboardBtn">
                <i data-lucide="layout-dashboard"></i>
                <span>Open Farm Dashboard</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Sign In Modal -->
    <div class="modal-overlay" id="signInModal" role="dialog" aria-modal="true" aria-labelledby="signInModalTitle">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 36px; height: 36px; border-radius: 10px; background: var(--emerald-100); color: var(--emerald-700); display: flex; align-items: center; justify-content: center; font-size: 18px;">
              🌾
            </div>
            <div>
              <h3 class="modal-title" id="signInModalTitle">Sign In to AgriSpectra</h3>
              <span style="font-size: 0.78rem; color: var(--slate-500);">Role-Tailored Agronomic Precision Platform</span>
            </div>
          </div>
          <button class="modal-close-btn" id="signInCloseBtn" aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="signInForm" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="loginEmail">Email Address</label>
              <input type="email" id="loginEmail" class="form-input" placeholder="grower@agrispectra.io" value="harshithkd0321@gmail.com" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="loginPassword">Password</label>
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" value="demo1234" required>
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 11px; margin-top: 4px;">
              <i data-lucide="log-in"></i>
              <span>Sign In to Your Farm</span>
            </button>
          </form>

          <div style="position: relative; text-align: center; margin: 20px 0 16px;">
            <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: var(--slate-200);"></div>
            <span style="position: relative; background: var(--white); padding: 0 12px; font-size: 0.75rem; color: var(--slate-500); text-transform: uppercase; font-weight: 700;">Or Instant 1-Tap Demo Access</span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <button type="button" class="btn btn-outline btn-sm quick-role-btn" data-role="Farm Owner" style="justify-content: flex-start; text-align: left;">
              <span>👨‍🌾 Farm Owner</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm quick-role-btn" data-role="Agronomist" style="justify-content: flex-start; text-align: left;">
              <span>🔬 Agronomist</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm quick-role-btn" data-role="Field Operator" style="justify-content: flex-start; text-align: left;">
              <span>💧 Field Operator</span>
            </button>
            <button type="button" class="btn btn-outline btn-sm quick-role-btn" data-role="SuperAdmin" style="justify-content: flex-start; text-align: left;">
              <span>🛡️ Super Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Farmer Register Modal -->
    <div class="modal-overlay" id="registerModal" role="dialog" aria-modal="true" aria-labelledby="registerModalTitle">
      <div class="modal-card" style="max-width: 480px;">
        <div class="modal-header">
          <div>
            <h3 class="modal-title" id="registerModalTitle">Farmer &amp; Grower Registration</h3>
            <span style="font-size: 0.78rem; color: var(--slate-500);">Join our precision irrigation &amp; spectroscopy network</span>
          </div>
          <button class="modal-close-btn" id="registerCloseBtn" aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body">
          <form id="registerForm" style="display: flex; flex-direction: column; gap: 12px;">
            <div class="form-group">
              <label class="form-label" for="regName">Grower Full Name *</label>
              <input type="text" id="regName" class="form-input" placeholder="e.g. Ramesh Patel" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="regPhone">Mobile Phone (WhatsApp enabled) *</label>
              <input type="tel" id="regPhone" class="form-input" placeholder="+91 98765 43210" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="regDistrict">District &amp; State *</label>
              <input type="text" id="regDistrict" class="form-input" placeholder="e.g. Kolar, Karnataka" required>
            </div>
            <div class="form-group">
              <label class="form-label" for="regCrop">Primary Crop</label>
              <input type="text" id="regCrop" class="form-input" placeholder="e.g. Potato, Tomato, Grapes">
            </div>
            <button type="submit" class="btn btn-primary" style="width: 100%; padding: 11px; margin-top: 4px;">
              <i data-lucide="user-plus"></i>
              <span>Register Account</span>
            </button>
          </form>
          <div id="registerSuccessMsg" class="hidden" style="text-align: center; padding: 16px 0;">
            <div style="color: var(--emerald-600); font-size: 24px; margin-bottom: 6px;">✓</div>
            <h4 style="font-weight: 700; color: var(--slate-900);">Registration Received!</h4>
            <p style="font-size: 0.85rem; color: var(--slate-600); margin-top: 4px;">A regional agronomy specialist will reach out to activate your account credentials.</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Privacy Policy Modal -->
    <div class="modal-overlay" id="privacyModal" role="dialog" aria-modal="true" aria-labelledby="privacyModalTitle">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="privacyModalTitle">Privacy Policy &amp; Data Governance</h3>
          <button class="modal-close-btn" id="privacyCloseBtn" aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body" style="font-size: 0.88rem; color: var(--slate-700); line-height: 1.7;">
          <p><strong>AgriSpectra Data Privacy Principles:</strong></p>
          <p style="margin-top: 8px;">1. <strong>Grower Ownership:</strong> All sensor telemetry, soil analyses, and spectral leaf scans remain the sole intellectual property of the grower and farm owner.</p>
          <p style="margin-top: 8px;">2. <strong>Zero Third-Party Sharing:</strong> We do not sell or monetize raw agricultural yield data or proprietary chemical dosage profiles to commodity brokers.</p>
          <p style="margin-top: 8px;">3. <strong>End-to-End Encryption:</strong> Edge telemetry transmitted between ESP32-S3 controllers and cloud time-series endpoints is protected via mutual TLS (mTLS) with AES-256 session keys.</p>
        </div>
      </div>
    </div>

    <!-- Terms of Service Modal -->
    <div class="modal-overlay" id="termsModal" role="dialog" aria-modal="true" aria-labelledby="termsModalTitle">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title" id="termsModalTitle">Terms of Service &amp; Warranty</h3>
          <button class="modal-close-btn" id="termsCloseBtn" aria-label="Close dialog">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div class="modal-body" style="font-size: 0.88rem; color: var(--slate-700); line-height: 1.7;">
          <p><strong>Hardware Warranty &amp; Service Terms:</strong></p>
          <p style="margin-top: 8px;">1. <strong>24-Month Replacement Warranty:</strong> All AgriSpectra Edge Gateways, FDR Soil Moisture Sensors, and Latching Solenoid Valves are covered against manufacturing defects for 24 months from installation.</p>
          <p style="margin-top: 8px;">2. <strong>Operating Voltage Tolerances:</strong> Gateways must be connected to surge-protected power lines or approved solar DC supplies within 9V–28V DC.</p>
          <p style="margin-top: 8px;">3. <strong>Autonomous Mode Liability:</strong> Autonomous closed-loop valve scheduling incorporates mechanical interlocks; however, growers must ensure physical pressure relief valves are installed on main lines.</p>
        </div>
      </div>
    </div>
  `;

  // Render Product Cards
  const productsGrid = container.querySelector('#productsCatalogGrid');
  function renderProducts(category = 'ALL') {
    if (!productsGrid) return;
    productsGrid.innerHTML = '';

    const filtered = category === 'ALL'
      ? PRODUCTS
      : PRODUCTS.filter(p => p.categoryKey === category);

    filtered.forEach(p => {
      const card = document.createElement('article');
      card.className = 'product-card';
      const formattedPrice = `₹${(p.price_minor_units / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

      card.innerHTML = `
        <div class="product-card-top">
          <span class="product-badge-cat">${p.category}</span>
          <span class="product-badge-avail in-stock">${p.stock_quantity > 0 ? 'In Stock' : 'Pre-Order'}</span>
        </div>
        <h3 class="product-title">${p.name}</h3>
        <span class="product-sku">${p.sku}</span>
        <p class="product-short-desc">${p.short_description}</p>
        <div class="product-specs-summary">
          ${Object.entries(p.specifications).slice(0, 3).map(([k, v]) => `
            <div class="spec-pill"><strong>${k}:</strong> ${v}</div>
          `).join('')}
        </div>
        <div class="product-card-footer">
          <div>
            <div class="product-price">${formattedPrice}</div>
            <span class="product-unit">Excl. applicable GST</span>
          </div>
          <div class="product-card-actions">
            <button type="button" class="btn btn-outline btn-sm btn-view-specs" data-id="${p.id}">
              <i data-lucide="info"></i>
              <span>View Specs</span>
            </button>
            <button type="button" class="btn btn-primary btn-sm btn-buy-now" data-id="${p.id}">
              <i data-lucide="shopping-bag"></i>
              <span>Buy Now</span>
            </button>
          </div>
        </div>
      `;

      card.querySelector('.btn-view-specs')?.addEventListener('click', () => {
        openProductModal(p);
      });

      card.querySelector('.btn-buy-now')?.addEventListener('click', () => {
        openCheckoutModal(p);
      });

      productsGrid.appendChild(card);
    });

    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: productsGrid });
    }
  }

  // Initial Product Render
  renderProducts('ALL');

  // Category Filter Pills
  const catButtons = container.querySelectorAll('.cat-pill-btn');
  catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      catButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const cat = btn.getAttribute('data-category') || 'ALL';
      renderProducts(cat);
    });
  });

  // Modal Controls
  function openProductModal(product) {
    activeModalProduct = product;
    const modal = container.querySelector('#productDetailModal');
    if (!modal) return;
    modal.querySelector('#modalProductCategory').textContent = product.category;
    modal.querySelector('#modalProductTitle').textContent = product.name;
    modal.querySelector('#modalProductSku').textContent = product.sku;
    modal.querySelector('#modalProductDesc').textContent = product.description;
    modal.querySelector('#modalProductPrice').textContent = `₹${(product.price_minor_units / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    const specsTbody = modal.querySelector('#modalSpecsTable tbody');
    if (specsTbody) {
      specsTbody.innerHTML = Object.entries(product.specifications).map(([k, v]) => `
        <tr>
          <td style="font-weight: 600; color: var(--slate-700); width: 40%;">${k}</td>
          <td style="color: var(--slate-900);">${v}</td>
        </tr>
      `).join('');
    }

    modal.classList.add('open');
  }

  function closeProductModal() {
    container.querySelector('#productDetailModal')?.classList.remove('open');
  }

  container.querySelector('#modalProductCloseBtn')?.addEventListener('click', closeProductModal);
  container.querySelector('#modalProductQuoteBtn')?.addEventListener('click', () => {
    closeProductModal();
    const demoSec = container.querySelector('#demo-request');
    if (demoSec) demoSec.scrollIntoView({ behavior: 'smooth' });
  });
  container.querySelector('#modalProductBuyBtn')?.addEventListener('click', () => {
    closeProductModal();
    openCheckoutModal(activeModalProduct);
  });

  // Checkout Modal logic
  function openCheckoutModal(product) {
    checkoutProduct = product;
    checkoutQty = 1;
    const modal = container.querySelector('#productCheckoutModal');
    if (!modal) return;

    modal.querySelector('#checkoutProductName').textContent = product.name;
    modal.querySelector('#checkoutProductCategory').textContent = product.category;
    modal.querySelector('#checkoutProductSku').textContent = product.sku;
    modal.querySelector('#checkoutQuantity').value = checkoutQty;
    modal.querySelector('#checkoutUnitUnitPrice').textContent = `₹${(product.price_minor_units / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

    modal.querySelector('#checkoutFormView')?.classList.remove('hidden');
    modal.querySelector('#checkoutReceiptView')?.classList.add('hidden');

    updateCheckoutCosts();
    modal.classList.add('open');
  }

  function closeCheckoutModal() {
    container.querySelector('#productCheckoutModal')?.classList.remove('open');
  }

  function updateCheckoutCosts() {
    const unitPrice = checkoutProduct.price_minor_units / 100;
    const subtotal = unitPrice * checkoutQty;
    const gst = subtotal * 0.18;
    const total = subtotal + gst;

    const modal = container.querySelector('#productCheckoutModal');
    if (!modal) return;
    modal.querySelector('#checkoutQtySummary').textContent = `${checkoutQty} unit${checkoutQty > 1 ? 's' : ''}`;
    modal.querySelector('#checkoutCostSubtotal').textContent = `₹${subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    modal.querySelector('#checkoutCostGst').textContent = `₹${gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    modal.querySelector('#checkoutCostTotal').textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    modal.querySelector('#btnPayLabel').textContent = `Pay ₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })} & Confirm Order`;
  }

  container.querySelector('#btnQtyMinus')?.addEventListener('click', () => {
    if (checkoutQty > 1) {
      checkoutQty--;
      const qInput = container.querySelector('#checkoutQuantity');
      if (qInput) qInput.value = checkoutQty;
      updateCheckoutCosts();
    }
  });

  container.querySelector('#btnQtyPlus')?.addEventListener('click', () => {
    if (checkoutQty < 99) {
      checkoutQty++;
      const qInput = container.querySelector('#checkoutQuantity');
      if (qInput) qInput.value = checkoutQty;
      updateCheckoutCosts();
    }
  });

  container.querySelector('#checkoutCloseBtn')?.addEventListener('click', closeCheckoutModal);
  container.querySelector('#receiptCloseBtn')?.addEventListener('click', closeCheckoutModal);
  container.querySelector('#receiptGoDashboardBtn')?.addEventListener('click', () => {
    closeCheckoutModal();
    if (onLaunchDashboard) onLaunchDashboard('Farm Owner');
  });

  container.querySelector('#checkoutShippingForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const custName = container.querySelector('#chkCustomerName')?.value || 'Acchu harshith';
    const custPhone = container.querySelector('#chkCustomerPhone')?.value || '+91 98450 12345';
    const unitPrice = checkoutProduct.price_minor_units / 100;
    const total = (unitPrice * checkoutQty) * 1.18;
    const randomOrderId = `ORD-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const modal = container.querySelector('#productCheckoutModal');
    if (!modal) return;
    modal.querySelector('#receiptOrderId').textContent = randomOrderId;
    modal.querySelector('#receiptItemName').textContent = `${checkoutProduct.name} (x${checkoutQty})`;
    modal.querySelector('#receiptTotalPaid').textContent = `₹${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    modal.querySelector('#receiptDeliveryTo').textContent = `${custName} (${custPhone})`;

    modal.querySelector('#checkoutFormView')?.classList.add('hidden');
    modal.querySelector('#checkoutReceiptView')?.classList.remove('hidden');
  });

  // Mobile Menu Drawer
  const menuBtn = container.querySelector('#mobileMenuBtn');
  const drawer = container.querySelector('#mobileNavDrawer');
  menuBtn?.addEventListener('click', () => {
    drawer?.classList.toggle('open');
  });
  drawer?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => drawer.classList.remove('open'));
  });

  // Modals (Sign In, Register, Privacy, Terms)
  function openSignInModal() {
    container.querySelector('#signInModal')?.classList.add('open');
  }
  function closeSignInModal() {
    container.querySelector('#signInModal')?.classList.remove('open');
  }

  function openRegisterModal() {
    container.querySelector('#registerModal')?.classList.add('open');
  }
  function closeRegisterModal() {
    container.querySelector('#registerModal')?.classList.remove('open');
  }

  container.querySelector('#navSignInBtn')?.addEventListener('click', openSignInModal);
  container.querySelector('#drawerSignInBtn')?.addEventListener('click', () => {
    drawer?.classList.remove('open');
    openSignInModal();
  });
  container.querySelector('#footerSignInLink')?.addEventListener('click', openSignInModal);
  container.querySelector('#signInCloseBtn')?.addEventListener('click', closeSignInModal);

  container.querySelector('#navRegisterBtn')?.addEventListener('click', openRegisterModal);
  container.querySelector('#drawerRegisterBtn')?.addEventListener('click', () => {
    drawer?.classList.remove('open');
    openRegisterModal();
  });
  container.querySelector('#footerRegisterLink')?.addEventListener('click', openRegisterModal);
  container.querySelector('#registerCloseBtn')?.addEventListener('click', closeRegisterModal);

  // Quick 1-Tap Demo Roles inside Sign In Modal
  container.querySelectorAll('.quick-role-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const role = btn.getAttribute('data-role') || 'Farm Owner';
      closeSignInModal();
      if (onLaunchDashboard) onLaunchDashboard(role);
    });
  });

  // Sign In Form Submit
  container.querySelector('#signInForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    closeSignInModal();
    if (onLaunchDashboard) onLaunchDashboard('Farm Owner');
  });

  // Launch live dashboard from Hero
  container.querySelector('#heroLaunchDashboardBtn')?.addEventListener('click', () => {
    if (onLaunchDashboard) onLaunchDashboard('Farm Owner');
  });

  // Register Form Submit
  container.querySelector('#registerForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    container.querySelector('#registerForm')?.classList.add('hidden');
    container.querySelector('#registerSuccessMsg')?.classList.remove('hidden');
    setTimeout(() => {
      closeRegisterModal();
      container.querySelector('#registerForm')?.classList.remove('reset');
    }, 2500);
  });

  // Privacy & Terms Modals
  container.querySelector('#footerPrivacyLink')?.addEventListener('click', () => {
    container.querySelector('#privacyModal')?.classList.add('open');
  });
  container.querySelector('#privacyCloseBtn')?.addEventListener('click', () => {
    container.querySelector('#privacyModal')?.classList.remove('open');
  });

  container.querySelector('#footerTermsLink')?.addEventListener('click', () => {
    container.querySelector('#termsModal')?.classList.add('open');
  });
  container.querySelector('#termsCloseBtn')?.addEventListener('click', () => {
    container.querySelector('#termsModal')?.classList.remove('open');
  });

  // FAQs Accordion
  container.querySelectorAll('.faq-accordion-item').forEach(item => {
    const headBtn = item.querySelector('.faq-header-btn');
    headBtn?.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      container.querySelectorAll('.faq-accordion-item').forEach(other => {
        other.classList.remove('open');
        other.querySelector('.faq-header-btn')?.setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        headBtn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Contact / Demo Request Form
  const demoForm = container.querySelector('#demoEnquiryForm');
  demoForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = container.querySelector('#enqFullName')?.value;
    const phone = container.querySelector('#enqPhone')?.value;
    if (!name || !phone) return;

    const refId = `ENQ-2026-${Math.floor(1000 + Math.random() * 9000)}`;
    const refBadge = container.querySelector('#enquiryReferenceBadge');
    if (refBadge) refBadge.textContent = refId;

    demoForm.classList.add('hidden');
    container.querySelector('#enquirySuccessCard')?.classList.remove('hidden');
  });

  container.querySelector('#resetEnquiryBtn')?.addEventListener('click', () => {
    demoForm?.reset();
    demoForm?.classList.remove('hidden');
    container.querySelector('#enquirySuccessCard')?.classList.add('hidden');
  });

  // Live Telemetry Simulation Loop on Hero Card
  let simMoist = 28.4;
  let simTemp = 24.2;
  let simPress = 2.42;
  let simNdvi = 0.78;

  const telemetryInterval = setInterval(() => {
    if (!container.isConnected) {
      clearInterval(telemetryInterval);
      return;
    }
    simMoist = +(27.5 + Math.random() * 2.0).toFixed(1);
    simTemp = +(23.8 + Math.random() * 1.0).toFixed(1);
    simPress = +(2.35 + Math.random() * 0.15).toFixed(2);
    simNdvi = +(0.76 + Math.random() * 0.05).toFixed(2);

    const elMoist = container.querySelector('#heroDialMoist');
    const elTemp = container.querySelector('#heroDialTemp');
    const elPress = container.querySelector('#heroDialPress');
    const elNdvi = container.querySelector('#heroDialNdvi');
    const elUpdate = container.querySelector('#heroLastUpdate');

    if (elMoist) elMoist.textContent = `${simMoist}%`;
    if (elTemp) elTemp.textContent = `${simTemp}°C`;
    if (elPress) elPress.textContent = `${simPress} Bar`;
    if (elNdvi) elNdvi.textContent = `${simNdvi}`;
    if (elUpdate) {
      const now = new Date();
      elUpdate.textContent = `Telemetry live sync · ${now.toLocaleTimeString()} (Active mTLS Stream)`;
    }
  }, 3500);

  // Initialize Lucide Icons
  setTimeout(() => {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons({ root: container });
    }
  }, 50);

  return container;
}
