/**
 * AgriSpectra Flow & Field - Marketing Landing Page
 * Mobile nav, FAQ accordion, scroll-reveal, product switcher, download tracking.
 */

// ---------------------------------------------------------------------------
// Backend target (same Render backend the mobile app talks to)
// ---------------------------------------------------------------------------
const BACKEND_URL = 'https://agricultural-equipment-water-irrigation.onrender.com';
// Firebase Hosting's free Spark plan rejects .apk files outright, so the
// installable app is served from the Render backend instead.
const APK_DOWNLOAD_PATH = `${BACKEND_URL}/downloads/agrispectra-flow-and-field.apk`;

// ---------------------------------------------------------------------------
// Cinematic hero parallax: layered sky/sun/hills/field move at different
// speeds while scrolling, and the whole scene zooms + fades as you scroll
// past it, like descending into the field rather than past a flat banner.
// ---------------------------------------------------------------------------
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hero = document.getElementById('cinematicHero');

if (hero && !prefersReducedMotion) {
  const layers = Array.from(hero.querySelectorAll('.parallax-layer'));
  let ticking = false;

  function applyParallax() {
    const heroHeight = hero.offsetHeight || 1;
    const scrollY = window.scrollY;
    const progress = Math.min(Math.max(scrollY / heroHeight, 0), 1);

    layers.forEach((layer) => {
      const speed = parseFloat(layer.dataset.speed) || 0.3;
      const offset = scrollY * speed * 0.4;
      const zoom = 1 + progress * 0.12;
      layer.style.transform = `translateY(${offset}px) scale(${zoom})`;
      layer.style.opacity = String(1 - progress * 0.55);
    });

    ticking = false;
  }

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(applyParallax);
      ticking = true;
    }
  }, { passive: true });

  applyParallax();
}

// ---------------------------------------------------------------------------
// Footer year
// ---------------------------------------------------------------------------
const yearSpan = document.getElementById('yearSpan');
if (yearSpan) yearSpan.textContent = new Date().getFullYear();

// ---------------------------------------------------------------------------
// Mobile nav drawer
// ---------------------------------------------------------------------------
const hamburgerBtn = document.getElementById('hamburgerBtn');
const mobileNavDrawer = document.getElementById('mobileNavDrawer');
if (hamburgerBtn && mobileNavDrawer) {
  hamburgerBtn.addEventListener('click', () => {
    mobileNavDrawer.classList.toggle('open');
  });
  mobileNavDrawer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => mobileNavDrawer.classList.remove('open'));
  });
}

// ---------------------------------------------------------------------------
// FAQ accordion
// ---------------------------------------------------------------------------
document.querySelectorAll('.faq-accordion-item').forEach(item => {
  const header = item.querySelector('.faq-header-btn');
  if (!header) return;
  header.addEventListener('click', () => {
    const wasOpen = item.classList.contains('open');
    item.parentElement.querySelectorAll('.faq-accordion-item').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});

// ---------------------------------------------------------------------------
// Scroll-reveal animation
// ---------------------------------------------------------------------------
document.querySelectorAll(
  '.workflow-step-card, .solution-card, .tech-spec-card, .live-feat-item, .faq-accordion-item, .section-header-wrap'
).forEach(el => el.classList.add('reveal-on-scroll'));

if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.reveal-on-scroll').forEach(el => revealObserver.observe(el));
} else {
  document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('is-visible'));
}

// ---------------------------------------------------------------------------
// 4-Product Interactive Switcher
// ---------------------------------------------------------------------------
const PRODUCTS = {
  spectroscope: {
    title: 'AS7265x Handheld Leaf Spectroscope',
    status: 'active',
    statusLabel: 'Active · Shipping Now',
    desc: 'An 18-channel optical sensor clipped directly onto a leaf, reading reflectance across visible and near-infrared light to compute real vitality indices on-device.',
    specs: [
      ['Sensor', 'AS7265x (AS72651 / AS72652 / AS72653)'],
      ['Channels', '18 spectral bands, 410–940nm'],
      ['MCU', 'STM32L475VGT6'],
      ['Radio', 'BlueNRG-MS Bluetooth Low Energy'],
      ['Local Storage', 'On-board SD card (CSV + JSON scan log)'],
      ['Calibration', 'Dark-current + 99% PTFE white reference'],
      ['Indices Computed', 'NDVI, NDRE, Water Band Index, CIre, Vitality']
    ]
  },
  valve: {
    title: 'Bi-Stable Solenoid Drip Irrigation Valve',
    status: 'lineup',
    statusLabel: 'Hardware Lineup',
    desc: 'Ultra-low-power latching hydraulic valve engineered for 6-zone precision drip and micro-irrigation lines. The closed-loop control logic is already built and running in the app today; the standalone retail hardware module is in our upcoming lineup.',
    specs: [
      ['Zones Supported', '6 independent gates per controller'],
      ['Latch Type', 'Bi-stable magnetic (holds state without continuous power)'],
      ['Actuation', '+12V DC pulse to open, -12V DC pulse to latch closed'],
      ['Failsafe', 'Local emergency killswitch closes all zones without network'],
      ['Control Source', 'Manual, scheduled, or spectroscopy-driven recommendation']
    ]
  },
  soil: {
    title: 'Multi-Depth Soil Moisture Probe',
    status: 'lineup',
    statusLabel: 'Hardware Lineup',
    desc: 'Frequency-domain capacitance probe measuring volumetric water content, salinity and temperature at three root-zone depths, feeding the same irrigation decision logic already live in the app.',
    specs: [
      ['Sensor Method', 'Frequency Domain Reflectometry (FDR at 100MHz)'],
      ['Measurement Depths', '10cm surface / 20cm active root / 30cm subsoil'],
      ['Moisture Range', '0% to 100% Volumetric Water Content (±2% VWC)'],
      ['Also Reports', 'Bulk electrical conductivity (salinity), soil temperature'],
      ['Per-Zone Coverage', 'Independent probe cluster for each of 6 zones']
    ]
  },
  climate: {
    title: 'Aspirated Canopy Microclimate Station',
    status: 'lineup',
    statusLabel: 'Hardware Lineup',
    desc: 'Fan-aspirated temperature and humidity shield at canopy height, correlated with spectroscopy readings to separate genuine water stress from normal diurnal variation.',
    specs: [
      ['Measurements', 'Air temperature, relative humidity, barometric pressure'],
      ['Shield Type', 'Louvred, UV-stabilized, continuously aspirated'],
      ['Calculated Metric', 'Vapor Pressure Deficit (VPD) & dew point'],
      ['Placement', 'Canopy-height mount, per field zone'],
      ['Sync', 'Shares the same offline-first app sync pipeline']
    ]
  }
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// Per-product diagram illustrations (hand-built SVG, not stock photography)
// ---------------------------------------------------------------------------
const PRODUCT_DIAGRAMS = {
  spectroscope: `
    <svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet">
      <path d="M40 150 C60 90 140 70 220 95 C260 108 280 130 260 145 C220 170 100 175 60 165 C48 162 36 158 40 150 Z" fill="#14532d" stroke="#34d399" stroke-width="1.5"/>
      <path d="M50 150 C90 140 180 130 250 125" stroke="#4ade80" stroke-width="1.2" fill="none" opacity="0.6"/>
      <rect x="175" y="60" width="70" height="40" rx="6" fill="#0f172a" stroke="#34d399" stroke-width="1.5"/>
      <text x="210" y="84" text-anchor="middle" font-size="9" fill="#a7f3d0" font-family="monospace">AS7265x</text>
      <line x1="205" y1="100" x2="190" y2="120" stroke="#34d399" stroke-width="2"/>
      <circle cx="190" cy="120" r="3" fill="#34d399"/>
    </svg>`,
  valve: `
    <svg width="100%" height="100%" viewBox="0 0 400 180" preserveAspectRatio="xMidYMid meet">
      <rect x="20" y="78" width="140" height="24" rx="4" fill="#78350f" opacity="0.6"/>
      <text x="90" y="68" text-anchor="middle" font-size="10" fill="#fbbf24" font-family="monospace">INLET (Main)</text>
      <rect x="170" y="65" width="60" height="50" rx="8" fill="#0f172a" stroke="#34d399" stroke-width="2"/>
      <text x="200" y="86" text-anchor="middle" font-size="8" fill="#a7f3d0" font-family="monospace">BI-STABLE</text>
      <text x="200" y="98" text-anchor="middle" font-size="8" fill="#6ee7b7" font-family="monospace">+12V/-12V</text>
      <rect x="240" y="78" width="140" height="24" rx="4" fill="#065f46" opacity="0.6"/>
      <text x="310" y="68" text-anchor="middle" font-size="10" fill="#6ee7b7" font-family="monospace">DRIP ZONE</text>
      <path d="M160 90 L170 90" stroke="#34d399" stroke-width="3"/>
      <path d="M230 90 L240 90" stroke="#34d399" stroke-width="3"/>
    </svg>`,
  soil: `
    <svg width="100%" height="100%" viewBox="0 0 400 220" preserveAspectRatio="xMidYMid meet">
      <rect x="60" y="20" width="280" height="50" fill="#1c3a26"/>
      <rect x="60" y="70" width="280" height="50" fill="#152e1d" opacity="0.9"/>
      <rect x="60" y="120" width="280" height="50" fill="#0e2114"/>
      <text x="70" y="48" font-size="11" fill="#a7f3d0" font-family="monospace">10cm: Organic Topsoil</text>
      <text x="70" y="98" font-size="11" fill="#6ee7b7" font-family="monospace">20cm: Active Root Zone</text>
      <text x="70" y="148" font-size="11" fill="#86efac" font-family="monospace">30cm: Subsoil Horizon</text>
      <line x1="190" y1="20" x2="190" y2="170" stroke="#94a3b8" stroke-width="2"/>
      <circle cx="190" cy="25" r="4" fill="#cbd5e1"/>
      <path d="M190 95 C210 105 225 95 245 115 M190 95 C175 110 160 100 150 125" stroke="#fbbf24" stroke-width="1.5" fill="none" opacity="0.8"/>
    </svg>`,
  climate: `
    <svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid meet">
      <line x1="200" y1="30" x2="200" y2="170" stroke="#94a3b8" stroke-width="3"/>
      <rect x="175" y="50" width="50" height="10" rx="4" fill="#475569"/>
      <rect x="175" y="68" width="50" height="10" rx="4" fill="#475569"/>
      <rect x="175" y="86" width="50" height="10" rx="4" fill="#475569"/>
      <rect x="175" y="104" width="50" height="10" rx="4" fill="#475569"/>
      <circle cx="200" cy="40" r="6" fill="#38bdf8"/>
      <path d="M225 75 C240 70 250 80 245 95" stroke="#38bdf8" stroke-width="1.5" fill="none" opacity="0.7"/>
    </svg>`
};

// ---------------------------------------------------------------------------
// Per-product live-feel simulator bodies + interaction handlers.
// These are client-side illustrative demos (no real hardware is connected
// to the marketing website) - every panel says so explicitly rather than
// implying the website itself is reading a live sensor.
// ---------------------------------------------------------------------------
function randRange(min, max, decimals = 1) {
  return Number((Math.random() * (max - min) + min).toFixed(decimals));
}

function renderSpectroscopeSim() {
  const bars = Array.from({ length: 18 }, () => randRange(15, 95, 0));
  const ndvi = randRange(0.75, 0.93, 2);
  const vitality = randRange(84, 96, 0);
  return `
    <div class="simulator-top">
      <span class="sim-live-tag"><span class="dot"></span> LIVE ON REAL HARDWARE</span>
      <span style="font-size:0.7rem;color:#64748b;">AS7265x OPTICAL FEED</span>
    </div>
    <div class="sim-body">
      <div class="product-visual-metric-row" style="margin-bottom:10px;">
        <span class="product-visual-metric-label">NDVI Index</span>
        <span class="product-visual-metric-value">${ndvi}</span>
      </div>
      <div class="product-visual-metric-row" style="margin-bottom:10px;">
        <span class="product-visual-metric-label">Canopy Vitality</span>
        <span class="product-visual-metric-value">${vitality}%</span>
      </div>
      <div class="spectral-bar-chart">
        ${bars.map(h => `<div class="spectral-bar" style="height:${h}%"></div>`).join('')}
      </div>
      <div class="spectral-bar-labels"><span>410nm (UV)</span><span>680nm (Red)</span><span>940nm (NIR)</span></div>
    </div>
    <button class="sim-btn-action" id="simTriggerBtn" style="margin-top:14px;width:100%;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
      Simulate 18-Channel Leaf Scan
    </button>
    <p style="font-size:0.7rem;color:#64748b;margin-top:8px;text-align:center;">Illustrative demo values. Real scans happen on-device via the Android app over Bluetooth.</p>
  `;
}

function renderValveSim() {
  const zoneState = window.__valveZoneState || (window.__valveZoneState = [true, false, false, false, false, false]);
  return `
    <div class="simulator-top">
      <span class="sim-live-tag"><span class="dot"></span> ILLUSTRATIVE</span>
      <span style="font-size:0.7rem;color:#64748b;">6-ZONE DRIP MANIFOLD</span>
    </div>
    <div class="sim-body">
      <p style="font-size:0.74rem;color:#94a3b8;margin-bottom:10px;">Click any zone to toggle +12V DC open pulse or -12V DC latching shutoff:</p>
      <div class="valve-zone-grid">
        ${zoneState.map((open, i) => `
          <button class="valve-zone-btn ${open ? 'open' : ''}" data-zone="${i}">
            <span>Zone ${i + 1} Drip</span>
            <span class="valve-zone-badge">${open ? 'OPEN (+12V)' : 'CLOSED'}</span>
          </button>
        `).join('')}
      </div>
    </div>
    <button class="sim-btn-action" id="simTriggerBtn" style="margin-top:14px;width:100%;justify-content:center;background:#dc2626;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/></svg>
      Emergency Shut-Off (All Zones, -12V)
    </button>
  `;
}

function renderSoilSim() {
  const depth = window.__soilDepth || '10';
  const depths = {
    '10': { label: '10cm Surface', vwc: randRange(30, 45, 1), ec: randRange(1.0, 1.8, 2), temp: randRange(20, 26, 1) },
    '20': { label: '20cm Active Root', vwc: randRange(35, 50, 1), ec: randRange(1.0, 1.6, 2), temp: randRange(18, 23, 1) },
    '30': { label: '30cm Subsoil', vwc: randRange(40, 55, 1), ec: randRange(0.8, 1.4, 2), temp: randRange(16, 21, 1) }
  };
  const d = depths[depth];
  return `
    <div class="simulator-top">
      <span class="sim-live-tag"><span class="dot"></span> ILLUSTRATIVE</span>
      <span style="font-size:0.7rem;color:#64748b;">ROOT TELEMETRY PROBE</span>
    </div>
    <div class="sim-body">
      <div class="depth-tab-row">
        ${['10', '20', '30'].map(k => `<button class="depth-tab-btn ${k === depth ? 'active' : ''}" data-depth="${k}">${depths[k].label}</button>`).join('')}
      </div>
      <div class="product-visual-metric-row" style="flex-direction:column;align-items:flex-start;gap:4px;margin:12px 0;">
        <span class="product-visual-metric-label">Volumetric Water Content</span>
        <span class="product-visual-metric-value" style="font-size:1.6rem;">${d.vwc}% VWC</span>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:0.76rem;color:#94a3b8;">
        <span>Salinity: <strong style="color:#e2e8f0;">${d.ec} dS/m</strong></span>
        <span>Soil Temp: <strong style="color:#e2e8f0;">${d.temp}°C</strong></span>
      </div>
    </div>
    <button class="sim-btn-action" id="simTriggerBtn" style="margin-top:14px;width:100%;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
      Sample Multi-Horizon Moisture
    </button>
  `;
}

function renderClimateSim() {
  const temp = randRange(24, 31, 1);
  const rh = randRange(48, 70, 1);
  const vpd = randRange(0.8, 1.9, 2);
  const status = vpd < 1.6 ? 'Healthy Transpiration' : 'Elevated Stress';
  return `
    <div class="simulator-top">
      <span class="sim-live-tag"><span class="dot"></span> ILLUSTRATIVE</span>
      <span style="font-size:0.7rem;color:#64748b;">ASPIRATED MICROCLIMATE</span>
    </div>
    <div class="sim-body">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px;">
        <div class="product-visual-metric-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
          <span class="product-visual-metric-label">Canopy Temp</span>
          <span class="product-visual-metric-value">${temp}°C</span>
        </div>
        <div class="product-visual-metric-row" style="flex-direction:column;align-items:flex-start;gap:4px;">
          <span class="product-visual-metric-label">Relative Humidity</span>
          <span class="product-visual-metric-value">${rh}%</span>
        </div>
      </div>
      <div class="product-visual-metric-row">
        <span class="product-visual-metric-label">Vapor Pressure Deficit</span>
        <span class="product-visual-metric-value" style="font-size:1.1rem;">${vpd} kPa</span>
      </div>
      <p style="margin-top:8px;"><span class="badge-rec" style="background:${vpd < 1.6 ? '#dcfce7' : '#fee2e2'};color:${vpd < 1.6 ? '#166534' : '#991b1b'};">${status}</span></p>
    </div>
    <button class="sim-btn-action" id="simTriggerBtn" style="margin-top:14px;width:100%;justify-content:center;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
      Refresh Microclimate Stream
    </button>
  `;
}

const SIM_RENDERERS = { spectroscope: renderSpectroscopeSim, valve: renderValveSim, soil: renderSoilSim, climate: renderClimateSim };

function wireSimInteractions(key, container) {
  const triggerBtn = container.querySelector('#simTriggerBtn');
  if (triggerBtn) {
    triggerBtn.addEventListener('click', () => {
      const simMount = container.querySelector('.simulator-card-box');
      if (simMount) simMount.innerHTML = SIM_RENDERERS[key]();
      wireSimInteractions(key, container);
    });
  }

  if (key === 'valve') {
    container.querySelectorAll('.valve-zone-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.zone);
        window.__valveZoneState[i] = !window.__valveZoneState[i];
        const simMount = container.querySelector('.simulator-card-box');
        if (simMount) simMount.innerHTML = renderValveSim();
        wireSimInteractions(key, container);
      });
    });
  }

  if (key === 'soil') {
    container.querySelectorAll('.depth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        window.__soilDepth = btn.dataset.depth;
        const simMount = container.querySelector('.simulator-card-box');
        if (simMount) simMount.innerHTML = renderSoilSim();
        wireSimInteractions(key, container);
      });
    });
  }
}

function renderProductPanel(key) {
  const p = PRODUCTS[key];
  if (!p) return;
  const container = document.getElementById('product-details-container');
  if (!container) return;

  const specRows = p.specs.map(([label, value]) => `
    <tr>
      <td class="label">${escapeHtml(label)}</td>
      <td class="val">${escapeHtml(value)}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="product-panel-wrap reveal-on-scroll is-visible">
      <div class="product-meta-header">
        <div class="product-meta-left">
          <h3>${escapeHtml(p.title)}</h3>
          <p>${escapeHtml(p.desc)}</p>
        </div>
        <span class="product-status-pill ${p.status}">${escapeHtml(p.statusLabel)}</span>
      </div>
      <div class="product-content-grid">
        <div class="specs-card-box">
          <h4>Specifications</h4>
          <table class="spec-table">${specRows}</table>
        </div>
        <div>
          <div class="product-illustration-card">${PRODUCT_DIAGRAMS[key] || ''}</div>
          <div class="simulator-card-box">${SIM_RENDERERS[key]()}</div>
        </div>
      </div>
    </div>
  `;

  wireSimInteractions(key, container);
}

const productTabs = document.querySelectorAll('.product-tab-btn');
productTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    productTabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    renderProductPanel(tab.dataset.product);
  });
});

if (productTabs.length) {
  renderProductPanel('spectroscope');
}

// ---------------------------------------------------------------------------
// Download button: track the click (real counter, admin dashboard reads it),
// then send the visitor to the actual APK file.
// ---------------------------------------------------------------------------
const downloadApkBtn = document.getElementById('downloadApkBtn');
if (downloadApkBtn) {
  downloadApkBtn.addEventListener('click', (e) => {
    e.preventDefault();
    fetch(`${BACKEND_URL}/api/public/track-download`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'android' })
    }).catch(() => { /* non-blocking - the download proceeds regardless */ });

    window.location.href = APK_DOWNLOAD_PATH;
  });
}
