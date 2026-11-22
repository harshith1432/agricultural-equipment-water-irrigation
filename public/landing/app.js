/**
 * AgriSpectra Flow & Field - Landing Page Interactive Controller
 * Follows Unslop principles: calm, precise, interactive without gimmicks.
 * Manages 4-product interactive showcase, agricultural telemetry simulation, and navigation.
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Dynamic Copyright Year
  const yearSpan = document.getElementById('yearSpan');
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear();
  }

  // 2. Mobile Navigation Drawer Toggle
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');

  if (hamburgerBtn && mobileNavDrawer) {
    const toggleMenu = () => {
      const isOpen = mobileNavDrawer.classList.toggle('open');
      hamburgerBtn.setAttribute('aria-expanded', String(isOpen));
      hamburgerBtn.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
      document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    hamburgerBtn.addEventListener('click', toggleMenu);

    mobileNavDrawer.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        mobileNavDrawer.classList.remove('open');
        hamburgerBtn.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
        toggleMenu();
      }
    });
  }

  // 3. Accessible FAQ Accordions
  const faqItems = document.querySelectorAll('.faq-accordion-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-header-btn');
    const content = item.querySelector('.faq-body-content');

    if (btn && content) {
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', () => {
        const isExpanded = btn.getAttribute('aria-expanded') === 'true';

        faqItems.forEach(otherItem => {
          if (otherItem !== item) {
            const otherBtn = otherItem.querySelector('.faq-header-btn');
            const otherContent = otherItem.querySelector('.faq-body-content');
            if (otherBtn && otherContent) {
              otherItem.classList.remove('open');
              otherBtn.setAttribute('aria-expanded', 'false');
              otherContent.style.maxHeight = null;
            }
          }
        });

        if (isExpanded) {
          btn.setAttribute('aria-expanded', 'false');
          item.classList.remove('open');
          content.style.maxHeight = null;
        } else {
          btn.setAttribute('aria-expanded', 'true');
          item.classList.add('open');
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    }
  });

  // 4. Smooth Anchor Scrolling with Header Offset
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      const targetId = this.getAttribute('href');
      if (targetId === '#' || !targetId) return;
      const targetEl = document.querySelector(targetId);
      if (targetEl) {
        e.preventDefault();
        const headerHeight = document.querySelector('.site-header')?.offsetHeight || 72;
        const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - headerHeight;
        window.scrollTo({
          top: targetPos,
          behavior: 'smooth'
        });
      }
    });
  });

  // 5. Four-Product Interactive Showcase System
  const PRODUCTS = {
    spectroscope: {
      id: 'spectroscope',
      name: 'AS7265x Handheld Leaf Spectroscope',
      status: 'Active Hardware',
      statusClass: 'active',
      tagline: '18-channel optical leaf-clip sensor with on-device chemometrics for instant canopy vitality and water stress evaluation.',
      steps: [
        {
          num: '01',
          title: 'Optical Baseline Calibration',
          desc: 'Performs dual-step dark current and 99% PTFE optical calibration on-device to cancel ambient field light.'
        },
        {
          num: '02',
          title: 'Non-Destructive Leaf Clip',
          desc: 'Clips securely onto living foliage. In 1.2 seconds, 18 discrete spectral bands (410nm to 940nm) measure leaf reflectance.'
        },
        {
          num: '03',
          title: 'Instant On-Device Indices',
          desc: 'Computes NDVI, NDRE, Water Band Index (WBI), and Chlorophyll index on your phone with zero cloud latency.'
        }
      ],
      specs: [
        { label: 'Optical Channels', val: '18 discrete bands across AS72651, AS72652 & AS72653' },
        { label: 'Spectral Range', val: '410nm to 940nm (UV, Visible, and Near-Infrared)' },
        { label: 'FWHM Bandwidth', val: '20nm optical filter precision per channel' },
        { label: 'Connectivity', val: 'Bluetooth Low Energy 5.0 (BlueNRG-MS)' },
        { label: 'Local Memory', val: 'MicroSD storage for raw spectral CSV logs' },
        { label: 'Battery Capacity', val: '300+ field leaf scans per USB-C charge' }
      ],
      illustrationSvg: `
        <div class="product-illustration-card">
          <svg viewBox="0 0 460 160" width="100%" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="460" height="160" rx="12" fill="#04130a"/>
            <!-- Leaf Outline -->
            <path d="M 60,110 C 100,30 220,30 300,80 C 240,140 120,150 60,110 Z" fill="#14532d" stroke="#22c55e" stroke-width="2"/>
            <path d="M 60,110 Q 180,85 300,80" stroke="#86efac" stroke-width="2" stroke-linecap="round"/>
            <path d="M 120,95 Q 150,70 170,60" stroke="#86efac" stroke-width="1.2" stroke-linecap="round"/>
            <path d="M 180,88 Q 210,70 230,65" stroke="#86efac" stroke-width="1.2" stroke-linecap="round"/>
            <!-- Spectroscope Clip Head -->
            <rect x="180" y="20" width="100" height="45" rx="8" fill="#1e293b" stroke="#34d399" stroke-width="1.5"/>
            <text x="230" y="46" fill="#f8fafc" font-size="11" font-weight="700" text-anchor="middle" font-family="monospace">AS7265x SENSOR</text>
            <!-- 18 Spectral Rays -->
            <g opacity="0.85">
              <line x1="195" y1="65" x2="195" y2="85" stroke="#818cf8" stroke-width="2"/>
              <line x1="205" y1="65" x2="205" y2="85" stroke="#38bdf8" stroke-width="2"/>
              <line x1="215" y1="65" x2="215" y2="85" stroke="#34d399" stroke-width="2"/>
              <line x1="225" y1="65" x2="225" y2="85" stroke="#facc15" stroke-width="2"/>
              <line x1="235" y1="65" x2="235" y2="85" stroke="#fb923c" stroke-width="2"/>
              <line x1="245" y1="65" x2="245" y2="85" stroke="#f87171" stroke-width="2"/>
              <line x1="255" y1="65" x2="255" y2="85" stroke="#dc2626" stroke-width="2"/>
              <line x1="265" y1="65" x2="265" y2="85" stroke="#991b1b" stroke-width="2"/>
            </g>
            <!-- Photodiode Detector -->
            <rect x="180" y="95" width="100" height="40" rx="8" fill="#1e293b" stroke="#34d399" stroke-width="1.5"/>
            <text x="230" y="119" fill="#a7f3d0" font-size="10" font-weight="700" text-anchor="middle" font-family="monospace">CHEMOMETRICS</text>
            <!-- Callout -->
            <rect x="330" y="45" width="115" height="70" rx="6" fill="#0f291a" stroke="#22c55e" stroke-width="1"/>
            <text x="340" y="68" fill="#86efac" font-size="10" font-weight="700" font-family="monospace">NDVI: 0.87</text>
            <text x="340" y="86" fill="#86efac" font-size="10" font-weight="700" font-family="monospace">NDRE: 0.74</text>
            <text x="340" y="104" fill="#34d399" font-size="9" font-weight="600">Active Crop</text>
          </svg>
        </div>
      `,
      simType: 'spectroscope'
    },
    valve: {
      id: 'valve',
      name: 'Bi-Stable Solenoid Drip Irrigation Valve',
      status: 'Hardware Lineup',
      statusClass: 'lineup',
      tagline: 'Ultra-low-power latching hydraulic valve engineered for 6-zone precision drip and micro-irrigation lines.',
      steps: [
        {
          num: '01',
          title: 'Momentary Open Pulse',
          desc: 'Receives a 30-millisecond +12V DC pulse from the controller to unseat the plunger and initiate water delivery.'
        },
        {
          num: '02',
          title: 'Zero Continuous Power Draw',
          desc: 'Permanent magnetic latch maintains the open flow state indefinitely with zero electric current consumption.'
        },
        {
          num: '03',
          title: 'Reverse-Polarity Latching Close',
          desc: 'A -12V DC reverse pulse neutralizes the magnetic hold, allowing internal spring tension to seal the valve shut.'
        }
      ],
      specs: [
        { label: 'Operating Mechanism', val: '2-Way Latching Bi-Stable Solenoid' },
        { label: 'Hydraulic Pressure', val: '0.5 to 10 Bar (7 to 145 PSI)' },
        { label: 'Pipe Dimensions', val: '1-inch BSP / NPT female threads' },
        { label: 'Actuation Energy', val: '12V DC pulse, 30ms duration (250mA peak)' },
        { label: 'Field Waterproofing', val: 'IP68 fully submersible waterproof housing' },
        { label: 'Emergency Override', val: 'Mechanical manual quarter-turn shutoff' }
      ],
      illustrationSvg: `
        <div class="product-illustration-card">
          <svg viewBox="0 0 460 160" width="100%" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="460" height="160" rx="12" fill="#04130a"/>
            <!-- Pipe Body -->
            <path d="M 40,90 L 160,90 L 160,60 L 300,60 L 300,90 L 420,90 L 420,130 L 300,130 L 300,140 L 160,140 L 160,130 L 40,130 Z" fill="#1e293b" stroke="#475569" stroke-width="2"/>
            <!-- Solenoid Tower -->
            <rect x="200" y="15" width="60" height="55" rx="6" fill="#0f172a" stroke="#059669" stroke-width="2"/>
            <text x="230" y="38" fill="#a7f3d0" font-size="9" font-weight="700" text-anchor="middle" font-family="monospace">BI-STABLE</text>
            <text x="230" y="52" fill="#34d399" font-size="8" text-anchor="middle" font-family="monospace">+12V / -12V</text>
            <!-- Water Flow Arrows -->
            <g stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round">
              <path d="M 60,110 L 120,110 M 110,105 L 120,110 L 110,115"/>
              <path d="M 210,105 Q 230,85 250,105"/>
              <path d="M 340,110 L 400,110 M 390,105 L 400,110 L 390,115"/>
            </g>
            <text x="90" y="100" fill="#bae6fd" font-size="10" font-weight="700">INLET (Main)</text>
            <text x="350" y="100" fill="#bae6fd" font-size="10" font-weight="700">DRIP ZONE</text>
          </svg>
        </div>
      `,
      simType: 'valve'
    },
    soil: {
      id: 'soil',
      name: 'Multi-Depth Soil Moisture & Telemetry Probe',
      status: 'Hardware Lineup',
      statusClass: 'lineup',
      tagline: 'High-frequency capacitance sensor measuring volumetric water content, soil temperature, and salinity across irrigation depths.',
      steps: [
        {
          num: '01',
          title: 'Root Horizon Measurement',
          desc: 'Measures dielectric permittivity at 10cm surface, 20cm active root zone, and 30cm subsoil horizons.'
        },
        {
          num: '02',
          title: 'Salinity & Temp Compensation',
          desc: 'Integrated thermistor and electrical conductivity (EC) sensors automatically calibrate for soil fertilizer salts.'
        },
        {
          num: '03',
          title: 'Irrigation Infiltration Tracking',
          desc: 'Detects the wetting front in real-time, signaling the irrigation valve to stop before water percolates below roots.'
        }
      ],
      specs: [
        { label: 'Sensor Method', val: 'Frequency Domain Reflectometry (FDR at 100MHz)' },
        { label: 'Moisture Range', val: '0% to 100% Volumetric Water Content (±2% VWC)' },
        { label: 'Soil Temperature', val: '-20°C to +60°C (±0.3°C accuracy)' },
        { label: 'Electrical Conductivity', val: '0 to 20 mS/cm bulk soil salinity' },
        { label: 'Probe Construction', val: '316L Marine-grade stainless steel electrodes' },
        { label: 'Autonomous Lifespan', val: '5+ years on internal solar-assisted lithium cell' }
      ],
      illustrationSvg: `
        <div class="product-illustration-card">
          <svg viewBox="0 0 460 160" width="100%" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="460" height="160" rx="12" fill="#04130a"/>
            <!-- Soil Strata Background -->
            <rect x="20" y="30" width="420" height="40" fill="#292524" opacity="0.8"/>
            <rect x="20" y="70" width="420" height="45" fill="#1c1917" opacity="0.9"/>
            <rect x="20" y="115" width="420" height="35" fill="#0c0a09"/>
            <!-- Probe Body -->
            <rect x="190" y="10" width="22" height="135" rx="4" fill="#94a3b8" stroke="#f8fafc" stroke-width="1.5"/>
            <!-- Sensing Rings -->
            <rect x="187" y="40" width="28" height="10" rx="2" fill="#059669" stroke="#34d399"/>
            <rect x="187" y="80" width="28" height="10" rx="2" fill="#059669" stroke="#34d399"/>
            <rect x="187" y="120" width="28" height="10" rx="2" fill="#059669" stroke="#34d399"/>
            <!-- Depth Labels -->
            <text x="70" y="52" fill="#d6d3d1" font-size="11" font-weight="700">10cm: Organic Topsoil</text>
            <text x="70" y="92" fill="#86efac" font-size="11" font-weight="700">20cm: Active Root Zone (42% VWC)</text>
            <text x="70" y="132" fill="#94a3b8" font-size="11" font-weight="700">30cm: Subsoil Horizon</text>
            <!-- Plant Root Graphics -->
            <path d="M 280,30 Q 290,60 320,80 M 295,45 Q 330,65 350,90 M 285,55 Q 260,75 250,105" stroke="#fef08a" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </div>
      `,
      simType: 'soil'
    },
    climate: {
      id: 'climate',
      name: 'Ambient Canopy Microclimate Station',
      status: 'Hardware Lineup',
      statusClass: 'lineup',
      tagline: 'Aspirated weather node monitoring canopy temperature, relative humidity, vapor pressure deficit (VPD), and barometric pressure.',
      steps: [
        {
          num: '01',
          title: 'Shielded Air Ingestion',
          desc: 'Louvred UV-stabilized radiation shield eliminates direct solar heating errors for microclimate temperature precision.'
        },
        {
          num: '02',
          title: 'Vapor Pressure Deficit (VPD)',
          desc: 'Computes real-time transpiration demand from leaf boundary layer and saturation vapor pressure.'
        },
        {
          num: '03',
          title: 'Frost & Heat Wave Warnings',
          desc: 'Sends instant alerts directly to the Android app when canopy dew point or thermal threshold limits are breached.'
        }
      ],
      specs: [
        { label: 'Temperature Accuracy', val: '±0.2°C from -10°C to +65°C' },
        { label: 'Relative Humidity', val: '0% to 100% RH (±1.5% precision)' },
        { label: 'Barometric Range', val: '300 to 1100 hPa (±0.5 hPa absolute)' },
        { label: 'Calculated Metric', val: 'Vapor Pressure Deficit (VPD in kPa) & Dew Point' },
        { label: 'Wireless Link', val: 'Sub-1GHz Long Range / Bluetooth LE mesh' },
        { label: 'Mounting Style', val: 'Canopy height 1.5m stainless mast clamp' }
      ],
      illustrationSvg: `
        <div class="product-illustration-card">
          <svg viewBox="0 0 460 160" width="100%" height="160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="460" height="160" rx="12" fill="#04130a"/>
            <!-- Weather Mast -->
            <rect x="220" y="20" width="12" height="130" fill="#64748b"/>
            <!-- Solar Shield Plates -->
            <path d="M 190,45 L 260,45 L 250,55 L 200,55 Z" fill="#e2e8f0"/>
            <path d="M 190,60 L 260,60 L 250,70 L 200,70 Z" fill="#e2e8f0"/>
            <path d="M 190,75 L 260,75 L 250,85 L 200,85 Z" fill="#e2e8f0"/>
            <path d="M 190,90 L 260,90 L 250,100 L 200,100 Z" fill="#e2e8f0"/>
            <!-- Anemometer Arms -->
            <circle cx="226" cy="22" r="4" fill="#38bdf8"/>
            <line x1="205" y1="22" x2="247" y2="22" stroke="#38bdf8" stroke-width="2"/>
            <circle cx="205" cy="22" r="5" fill="#0284c7"/>
            <circle cx="247" cy="22" r="5" fill="#0284c7"/>
            <!-- Telemetry Broadcast Waves -->
            <path d="M 270,30 Q 285,45 270,60" stroke="#34d399" stroke-width="2" stroke-linecap="round"/>
            <path d="M 280,22 Q 302,45 280,68" stroke="#34d399" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
            <!-- Metrics Callout -->
            <rect x="310" y="35" width="130" height="90" rx="6" fill="#0f291a" stroke="#22c55e" stroke-width="1"/>
            <text x="320" y="58" fill="#f0fdf4" font-size="11" font-weight="700">CANOPY METRICS</text>
            <text x="320" y="76" fill="#86efac" font-size="10" font-family="monospace">Air Temp: 28.4°C</text>
            <text x="320" y="94" fill="#86efac" font-size="10" font-family="monospace">Humidity: 64.2%</text>
            <text x="320" y="112" fill="#38bdf8" font-size="10" font-family="monospace">VPD: 1.32 kPa</text>
          </svg>
        </div>
      `,
      simType: 'climate'
    }
  };

  const productTabs = document.querySelectorAll('.product-tab-btn');
  const detailsContainer = document.getElementById('product-details-container');

  function renderProductDetails(productId) {
    const product = PRODUCTS[productId] || PRODUCTS.spectroscope;

    // Update active tab buttons
    productTabs.forEach(tab => {
      const isTarget = tab.dataset.product === productId;
      tab.classList.toggle('active', isTarget);
      tab.setAttribute('aria-selected', String(isTarget));
    });

    if (!detailsContainer) return;

    // Render Steps HTML
    const stepsHtml = product.steps.map(s => `
      <div class="workflow-step-card">
        <div class="step-num-badge">${s.num}</div>
        <h4 class="step-title">${s.title}</h4>
        <p class="step-desc">${s.desc}</p>
      </div>
    `).join('');

    // Render Specs HTML
    const specsHtml = product.specs.map(sp => `
      <tr>
        <td class="label">${sp.label}</td>
        <td class="val">${sp.val}</td>
      </tr>
    `).join('');

    // Render Simulator Block
    let simHtml = '';
    if (product.simType === 'spectroscope') {
      simHtml = `
        <div class="simulator-card-box">
          <div class="simulator-top">
            <span class="sim-live-tag"><span class="dot"></span> AS7265x OPTICAL FEED</span>
            <span style="font-size:0.75rem;color:var(--slate-400);font-family:var(--font-mono);">18 Channels Active</span>
          </div>
          <div class="sim-body">
            <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:16px;">
              <div style="background:#0f2416;padding:12px;border-radius:8px;border:1px solid #1f4d2f;flex:1;text-align:center;">
                <div style="font-size:0.7rem;color:#86efac;text-transform:uppercase;font-family:var(--font-mono);">NDVI Index</div>
                <div id="sim-ndvi-val" style="font-size:1.6rem;font-weight:800;color:#f0fdf4;">0.87</div>
                <div style="font-size:0.7rem;color:#4ade80;">Healthy Foliage</div>
              </div>
              <div style="background:#0f2416;padding:12px;border-radius:8px;border:1px solid #1f4d2f;flex:1;text-align:center;">
                <div style="font-size:0.7rem;color:#86efac;text-transform:uppercase;font-family:var(--font-mono);">Canopy Vitality</div>
                <div id="sim-vitality-val" style="font-size:1.6rem;font-weight:800;color:#f0fdf4;">92%</div>
                <div style="font-size:0.7rem;color:#4ade80;">Chemometric Model</div>
              </div>
            </div>
            <div style="background:#06140b;border:1px solid #153820;border-radius:8px;padding:12px;height:100px;display:flex;align-items:flex-end;gap:4px;justify-content:space-between;" id="sim-spectral-bars">
              ${[40, 52, 60, 68, 75, 82, 88, 92, 95, 98, 92, 85, 78, 68, 55, 48, 42, 38].map((h, idx) => `
                <div style="flex:1;background:linear-gradient(to top, #10b981, #86efac);height:${h}%;border-radius:2px;" title="Channel ${idx + 1}"></div>
              `).join('')}
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:#64748b;font-family:var(--font-mono);margin-top:4px;">
              <span>410nm (UV)</span><span>680nm (Red)</span><span>940nm (NIR)</span>
            </div>
          </div>
          <button class="sim-btn-action" id="btnSimTriggerScan">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
            Trigger 18-Channel Leaf Scan
          </button>
        </div>
      `;
    } else if (product.simType === 'valve') {
      simHtml = `
        <div class="simulator-card-box">
          <div class="simulator-top">
            <span class="sim-live-tag"><span class="dot"></span> 6-ZONE DRIP MANIFOLD</span>
            <span style="font-size:0.75rem;color:var(--slate-400);font-family:var(--font-mono);">Bi-Stable Latching</span>
          </div>
          <div class="sim-body">
            <p style="font-size:0.8rem;color:#94a3b8;margin-bottom:14px;">Click any zone below to toggle +12V DC open pulse or -12V DC latching shutoff:</p>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;" id="sim-valve-grid">
              ${[1, 2, 3, 4, 5, 6].map(z => `
                <button class="sim-zone-toggle-btn" data-zone="${z}" style="background:${z === 1 ? '#064e3b' : '#141d18'};color:${z === 1 ? '#a7f3d0' : '#94a3b8'};border:1px solid ${z === 1 ? '#059669' : '#2d3731'};padding:10px 12px;border-radius:6px;font-size:0.8rem;font-weight:700;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
                  <span>Zone ${z} Drip</span>
                  <span class="valve-state-pill" style="font-size:0.7rem;font-family:var(--font-mono);">${z === 1 ? 'OPEN (+12V)' : 'CLOSED'}</span>
                </button>
              `).join('')}
            </div>
          </div>
          <button class="sim-btn-action" id="btnSimKillswitch" style="background:#dc2626;align-self:flex-start;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
            Emergency Shutoff (Latch All -12V)
          </button>
        </div>
      `;
    } else if (product.simType === 'soil') {
      simHtml = `
        <div class="simulator-card-box">
          <div class="simulator-top">
            <span class="sim-live-tag"><span class="dot"></span> ROOT TELEMETRY PROBE</span>
            <span style="font-size:0.75rem;color:var(--slate-400);font-family:var(--font-mono);">Capacitance FDR</span>
          </div>
          <div class="sim-body">
            <div style="display:flex;gap:8px;margin-bottom:16px;">
              <button class="sim-depth-btn active" data-depth="10" style="flex:1;padding:6px;border-radius:4px;border:1px solid #059669;background:#064e3b;color:#a7f3d0;font-size:0.75rem;font-weight:700;cursor:pointer;">10cm Surface</button>
              <button class="sim-depth-btn" data-depth="20" style="flex:1;padding:6px;border-radius:4px;border:1px solid #2d3731;background:#141d18;color:#94a3b8;font-size:0.75rem;font-weight:700;cursor:pointer;">20cm Active Root</button>
              <button class="sim-depth-btn" data-depth="30" style="flex:1;padding:6px;border-radius:4px;border:1px solid #2d3731;background:#141d18;color:#94a3b8;font-size:0.75rem;font-weight:700;cursor:pointer;">30cm Subsoil</button>
            </div>
            <div style="background:#0f2416;border:1px solid #1f4d2f;border-radius:8px;padding:16px;text-align:center;margin-bottom:12px;">
              <div style="font-size:0.7rem;color:#86efac;text-transform:uppercase;font-family:var(--font-mono);">Volumetric Water Content</div>
              <div id="sim-soil-vwc" style="font-size:2.2rem;font-weight:800;color:#f0fdf4;letter-spacing:-0.03em;">42.8% VWC</div>
              <div id="sim-soil-status" style="font-size:0.75rem;color:#4ade80;">Field Capacity: Optimal Plant Available Water</div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;color:#94a3b8;font-family:var(--font-mono);">
              <span>Salinity: <strong id="sim-soil-ec" style="color:#e2e8f0;">1.35 dS/m</strong></span>
              <span>Soil Temp: <strong id="sim-soil-temp" style="color:#e2e8f0;">22.6°C</strong></span>
            </div>
          </div>
          <button class="sim-btn-action" id="btnSimSampleSoil">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
            Sample Multi-Horizon Moisture
          </button>
        </div>
      `;
    } else if (product.simType === 'climate') {
      simHtml = `
        <div class="simulator-card-box">
          <div class="simulator-top">
            <span class="sim-live-tag"><span class="dot"></span> CANOPY WEATHER NODE</span>
            <span style="font-size:0.75rem;color:var(--slate-400);font-family:var(--font-mono);">Aspirated Microclimate</span>
          </div>
          <div class="sim-body">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
              <div style="background:#0f2416;padding:12px;border-radius:8px;border:1px solid #1f4d2f;text-align:center;">
                <div style="font-size:0.68rem;color:#86efac;text-transform:uppercase;font-family:var(--font-mono);">Canopy Temp</div>
                <div id="sim-air-temp" style="font-size:1.6rem;font-weight:800;color:#f0fdf4;">28.4°C</div>
                <div style="font-size:0.68rem;color:#94a3b8;">Normal Foliage Range</div>
              </div>
              <div style="background:#0f2416;padding:12px;border-radius:8px;border:1px solid #1f4d2f;text-align:center;">
                <div style="font-size:0.68rem;color:#86efac;text-transform:uppercase;font-family:var(--font-mono);">Relative Humidity</div>
                <div id="sim-air-rh" style="font-size:1.6rem;font-weight:800;color:#f0fdf4;">64.2%</div>
                <div style="font-size:0.68rem;color:#94a3b8;">Ambient Vapor</div>
              </div>
            </div>
            <div style="background:#06140b;border:1px solid #153820;border-radius:8px;padding:12px;display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="font-size:0.7rem;color:#86efac;font-family:var(--font-mono);">Vapor Pressure Deficit (VPD)</div>
                <div id="sim-air-vpd" style="font-size:1.2rem;font-weight:800;color:#38bdf8;">1.32 kPa</div>
              </div>
              <span style="font-size:0.72rem;background:#0369a1;color:#e0f2fe;padding:3px 8px;border-radius:4px;font-weight:700;">Healthy Transpiration</span>
            </div>
          </div>
          <button class="sim-btn-action" id="btnSimRefreshClimate">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
            Refresh Microclimate Stream
          </button>
        </div>
      `;
    }

    detailsContainer.innerHTML = `
      <div class="product-panel-wrap">
        <div class="product-meta-header">
          <div class="product-meta-left">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
              <span class="product-status-pill ${product.statusClass}">
                <span style="width:6px;height:6px;border-radius:50%;background:currentColor;"></span>
                ${product.status}
              </span>
            </div>
            <h3>${product.name}</h3>
            <p>${product.tagline}</p>
          </div>
        </div>

        <h4 style="font-size:0.85rem;text-transform:uppercase;letter-spacing:0.05em;color:var(--slate-500);font-weight:700;margin-bottom:16px;">
          Operational Sequence &amp; Field Execution
        </h4>
        <div class="workflow-steps-grid" style="margin-bottom:32px;">
          ${stepsHtml}
        </div>

        <div class="product-content-grid">
          <div class="specs-card-box">
            ${product.illustrationSvg || ''}
            <h4>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              Hardware Specifications
            </h4>
            <table class="spec-table">
              <tbody>
                ${specsHtml}
              </tbody>
            </table>
          </div>
          <div>
            ${simHtml}
          </div>
        </div>
      </div>
    `;

    // Re-attach interactive simulator handlers
    attachSimulatorHandlers(product.simType);
  }

  function attachSimulatorHandlers(simType) {
    if (simType === 'spectroscope') {
      const btn = document.getElementById('btnSimTriggerScan');
      const ndviEl = document.getElementById('sim-ndvi-val');
      const vitEl = document.getElementById('sim-vitality-val');
      const barsContainer = document.getElementById('sim-spectral-bars');

      if (btn) {
        btn.addEventListener('click', () => {
          btn.disabled = true;
          btn.textContent = 'Measuring 18 Channels...';
          setTimeout(() => {
            const newNdvi = (0.82 + Math.random() * 0.12).toFixed(2);
            const newVit = Math.floor(88 + Math.random() * 10);
            if (ndviEl) ndviEl.textContent = newNdvi;
            if (vitEl) vitEl.textContent = `${newVit}%`;

            if (barsContainer) {
              const bars = barsContainer.querySelectorAll('div');
              bars.forEach(b => {
                const randomH = Math.floor(35 + Math.random() * 60);
                b.style.height = `${randomH}%`;
              });
            }
            btn.disabled = false;
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Trigger 18-Channel Leaf Scan`;
          }, 600);
        });
      }
    } else if (simType === 'valve') {
      const valveBtns = document.querySelectorAll('.sim-zone-toggle-btn');
      valveBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const pill = btn.querySelector('.valve-state-pill');
          const isOpen = pill.textContent.includes('OPEN');
          if (isOpen) {
            btn.style.background = '#141d18';
            btn.style.borderColor = '#2d3731';
            btn.style.color = '#94a3b8';
            pill.textContent = 'CLOSED';
          } else {
            btn.style.background = '#064e3b';
            btn.style.borderColor = '#059669';
            btn.style.color = '#a7f3d0';
            pill.textContent = 'OPEN (+12V)';
          }
        });
      });

      const killBtn = document.getElementById('btnSimKillswitch');
      if (killBtn) {
        killBtn.addEventListener('click', () => {
          valveBtns.forEach(btn => {
            const pill = btn.querySelector('.valve-state-pill');
            btn.style.background = '#141d18';
            btn.style.borderColor = '#2d3731';
            btn.style.color = '#94a3b8';
            pill.textContent = 'CLOSED';
          });
        });
      }
    } else if (simType === 'soil') {
      const depthBtns = document.querySelectorAll('.sim-depth-btn');
      const vwcEl = document.getElementById('sim-soil-vwc');
      const statusEl = document.getElementById('sim-soil-status');

      depthBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          depthBtns.forEach(b => {
            b.classList.remove('active');
            b.style.background = '#141d18';
            b.style.color = '#94a3b8';
            b.style.borderColor = '#2d3731';
          });
          btn.classList.add('active');
          btn.style.background = '#064e3b';
          btn.style.color = '#a7f3d0';
          btn.style.borderColor = '#059669';

          const depth = btn.dataset.depth;
          if (depth === '10') {
            if (vwcEl) vwcEl.textContent = '42.8% VWC';
            if (statusEl) statusEl.textContent = 'Field Capacity: Optimal Plant Available Water';
          } else if (depth === '20') {
            if (vwcEl) vwcEl.textContent = '38.4% VWC';
            if (statusEl) statusEl.textContent = 'Active Root Absorption Zone: Healthy Moisture';
          } else {
            if (vwcEl) vwcEl.textContent = '31.2% VWC';
            if (statusEl) statusEl.textContent = 'Subsoil Horizon: Zero Deep Drainage Waste';
          }
        });
      });

      const sampleBtn = document.getElementById('btnSimSampleSoil');
      if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
          sampleBtn.disabled = true;
          sampleBtn.textContent = 'Sampling Probe Electrodes...';
          setTimeout(() => {
            if (vwcEl) vwcEl.textContent = `${(36 + Math.random() * 8).toFixed(1)}% VWC`;
            const ecEl = document.getElementById('sim-soil-ec');
            const tempEl = document.getElementById('sim-soil-temp');
            if (ecEl) ecEl.textContent = `${(1.2 + Math.random() * 0.4).toFixed(2)} dS/m`;
            if (tempEl) tempEl.textContent = `${(21 + Math.random() * 3).toFixed(1)}°C`;
            sampleBtn.disabled = false;
            sampleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Sample Multi-Horizon Moisture`;
          }, 500);
        });
      }
    } else if (simType === 'climate') {
      const refreshBtn = document.getElementById('btnSimRefreshClimate');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
          refreshBtn.disabled = true;
          refreshBtn.textContent = 'Reading Aspirated Chamber...';
          setTimeout(() => {
            const tempEl = document.getElementById('sim-air-temp');
            const rhEl = document.getElementById('sim-air-rh');
            const vpdEl = document.getElementById('sim-air-vpd');
            const t = (26 + Math.random() * 5).toFixed(1);
            const rh = (58 + Math.random() * 12).toFixed(1);
            const vpd = (1.1 + Math.random() * 0.4).toFixed(2);
            if (tempEl) tempEl.textContent = `${t}°C`;
            if (rhEl) rhEl.textContent = `${rh}%`;
            if (vpdEl) vpdEl.textContent = `${vpd} kPa`;
            refreshBtn.disabled = false;
            refreshBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Refresh Microclimate Stream`;
          }, 400);
        });
      }
    }
  }

  // Bind tab clicks
  productTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const productId = tab.dataset.product;
      renderProductDetails(productId);
    });
  });

  // Initial render of spectroscope
  renderProductDetails('spectroscope');

  // 6. Direct APK Download Button Handler
  const downloadApkBtn = document.getElementById('downloadApkBtn');
  if (downloadApkBtn) {
    downloadApkBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const apkPath = '/android/app/build/outputs/apk/debug/app-debug.apk';
      const anchor = document.createElement('a');
      anchor.href = apkPath;
      anchor.download = 'AgriSpectra-Flow-and-Field.apk';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    });
  }
});
