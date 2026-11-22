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
    ],
    sim: { label: 'LIVE READOUT', metric: 'NDVI', value: '0.87', metric2: 'Vitality', value2: '91%' },
    icon: 'leaf'
  },
  valve: {
    title: 'Bi-Stable Solenoid Drip Valve',
    status: 'lineup',
    statusLabel: 'Hardware Lineup',
    desc: 'A magnetic latching solenoid gate for each of up to 6 irrigation zones — the closed-loop control logic for this is already built and running in the app today; the standalone retail hardware module is in our upcoming lineup.',
    specs: [
      ['Zones Supported', '6 independent gates per controller'],
      ['Latch Type', 'Bi-stable magnetic (holds state without continuous power)'],
      ['Actuation', '+12V DC pulse, ~30ms'],
      ['Failsafe', 'Local emergency killswitch closes all zones without network'],
      ['Control Source', 'Manual, scheduled, or spectroscopy-driven recommendation']
    ],
    sim: { label: 'ZONE STATE', metric: 'Zone 1', value: 'OPEN', metric2: 'Zone 2', value2: 'CLOSED' },
    icon: 'droplet'
  },
  soil: {
    title: 'Multi-Depth Soil Moisture Probe',
    status: 'lineup',
    statusLabel: 'Hardware Lineup',
    desc: 'Volumetric water content, temperature and salinity readings at three depths per zone, feeding the same irrigation decision logic already live in the app.',
    specs: [
      ['Measurement Depths', '10cm / 30cm / 50cm per probe'],
      ['Readings', 'Volumetric water content (VWC), temperature, EC (salinity)'],
      ['Per-Zone Coverage', 'Independent probe cluster for each of 6 zones'],
      ['Reporting Interval', 'Continuous telemetry to the irrigation controller']
    ],
    sim: { label: 'SOIL READOUT', metric: 'VWC @30cm', value: '21.0%', metric2: 'Temp', value2: '20.1°C' },
    icon: 'soil'
  },
  climate: {
    title: 'Canopy Microclimate Station',
    status: 'lineup',
    statusLabel: 'Hardware Lineup',
    desc: 'Ambient temperature, humidity and pressure at canopy height, correlated with spectroscopy readings to separate genuine water stress from normal diurnal variation.',
    specs: [
      ['Measurements', 'Air temperature, relative humidity, barometric pressure'],
      ['Placement', 'Canopy-height mount, per field zone'],
      ['Purpose', 'Context for spectroscopy vitality & water-stress readings'],
      ['Sync', 'Shares the same offline-first app sync pipeline']
    ],
    sim: { label: 'AMBIENT', metric: 'Humidity', value: '55%', metric2: 'Pressure', value2: '1013 hPa' },
    icon: 'climate'
  }
};

const PRODUCT_ICONS = {
  leaf: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.5"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 9.1 17 9.1s3.4 2.4 3 8.1c-3.5-.9-5.5.4-5.5.4"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 11 14 11 14"/></svg>',
  droplet: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.5"><path d="M12 22s8-4.5 8-11.8A8 8 0 0 0 4 10.2C4 17.5 12 22 12 22z"/></svg>',
  soil: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.5"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
  climate: '<svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="1.5"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>'
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
          <div class="product-illustration-card">${PRODUCT_ICONS[p.icon] || ''}</div>
          <div class="simulator-card-box">
            <div class="simulator-top">
              <span class="sim-live-tag"><span class="dot"></span> ${p.status === 'active' ? 'LIVE' : 'ILLUSTRATIVE'}</span>
              <span style="font-size:0.7rem;color:#64748b;">${escapeHtml(p.sim.label)}</span>
            </div>
            <div class="sim-body">
              <div class="product-visual-metric-row" style="margin-bottom:10px;">
                <span class="product-visual-metric-label">${escapeHtml(p.sim.metric)}</span>
                <span class="product-visual-metric-value">${escapeHtml(p.sim.value)}</span>
              </div>
              <div class="product-visual-metric-row">
                <span class="product-visual-metric-label">${escapeHtml(p.sim.metric2)}</span>
                <span class="product-visual-metric-value">${escapeHtml(p.sim.value2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
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
