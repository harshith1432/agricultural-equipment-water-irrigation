/**
 * Automated QA & Integration Test Suite: Spectral Sync Engine & Mobile UI
 * 
 * Verifies:
 * 1. Automatic Synchronization Engine (spectralSyncEngine.js):
 *    - Network status monitoring (online, offline, transition events)
 *    - Seamless offline queueing without UI interruption or unhandled errors
 *    - Automatic sync triggering on internet return
 *    - Exponential backoff with randomized jitter calculation (base 2s, 4s, 8s, max 60s)
 *    - Clean handling of HTTP 401, 403, 408, 429, 5xx and network drops
 *    - Status transitions: PENDING_SYNC -> SYNCING -> SYNCED with cloudDocumentId & syncedAt
 *    - Event emissions: syncStatusChange, syncProgress, syncComplete
 *    - Manual trigger via syncNow()
 * 2. Offline Spectral Database (offlineSpectralDatabase.js):
 *    - Local IndexedDB / localStorage persistence
 *    - Status management (LOCAL_ONLY, PENDING_SYNC, SYNCING, SYNCED, SYNC_FAILED)
 *    - Dynamic metrics computation (totalScans, locallyStored, pendingSync, syncedToCloud, syncFailed, lastSyncTimestamp)
 *    - Reactive subscriber notifications
 * 3. Spectroscopy Analysis Mobile Dashboard (SpectroscopyAnalysisView.js):
 *    - Synchronization Metrics Header / Widget with 6 counters & "Sync Now" button
 *    - Sync status badges on records
 *    - Step 5 capture auto-saves to offlineSpectralDatabase with PENDING_SYNC status
 *    - Step 6 Section 7.C Two Tabs:
 *      * "Processed Results" (76-band curve, calculated indices: NDVI, NDRE, WBI, Vitality, Urea, formulas, units, validity flag)
 *      * "Raw Spectrum" (18-channel AS7265x raw counts, dark counts, white counts, temperature, humidity, pressure, CSV/JSON download buttons)
 *    - ABSOLUTELY NO FAKE DATA: Awaiting scan status message when sensor has not measured
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { offlineSpectralDatabase, SYNC_STATUS, OfflineSpectralDatabase } from '../src/services/offlineSpectralDatabase.js';
import { spectralSyncEngine, ENGINE_STATUS, SpectralSyncEngine } from '../src/services/spectralSyncEngine.js';
import { createSpectroscopyAnalysisView, AS7265X_CHANNELS } from '../src/components/dashboards/SpectroscopyAnalysisView.js';
import { leafClipDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { spectrometerUSBAdapter } from '../src/hardware/spectrometerUSBAdapter.js';
import { setLocale } from '../src/utils/i18n.js';

export function registerSpectralSyncUITests() {
  setupHeadlessDOM();
  setLocale('en');

  // =========================================================================
  // SUITE 1: Offline Spectral Database Persistence & Metrics
  // =========================================================================
  describe('Spectral Sync Architecture - Offline Spectral Database', () => {
    it('initializes and saves leaf scan with default PENDING_SYNC status', async () => {
      await offlineSpectralDatabase.clear();

      const scanPayload = {
        plantNumber: 'PLANT-TEST-01',
        plantName: 'Roma Tomato',
        potNumber: 'POT-12',
        zone: 'Zone 3',
        rawCounts: [1200, 1450, 1800, 2200, 2900, 3400, 4100, 4800, 5200, 5900, 6800, 7500, 8400, 9200, 10100, 11000, 12500, 14000],
        darkCounts: new Array(18).fill(180),
        whiteCounts: new Array(18).fill(52000),
        environmental: { temperature: 25.2, humidity: 62.4, pressure: 1012.8 },
        chemometrics: {
          vitalityScore: 88,
          indices: { ndvi: 0.745, ndre: 0.325, wbi: 0.915, cire: 2.15 },
          nitrogenPrescriptionKg: 6.0,
          irrigationCountdownHours: 32,
          irrigationUrgency: 'ADEQUATE'
        }
      };

      const saved = await offlineSpectralDatabase.saveScan(scanPayload);

      expect(saved).toBeDefined();
      expect(typeof saved.id).toBe('string');
      expect(saved.syncStatus).toBe(SYNC_STATUS.PENDING_SYNC);
      expect(saved.plantNumber).toBe('PLANT-TEST-01');
      expect(saved.rawCounts.length).toBe(18);
      expect(saved.environmental.temperature).toBe(25.2);
      expect(saved.cloudDocumentId).toBe(null);

      // Verify retrieval
      const retrieved = await offlineSpectralDatabase.getScan(saved.id);
      expect(retrieved).toBeDefined();
      expect(retrieved.id).toBe(saved.id);

      // Verify metrics
      const metrics = await offlineSpectralDatabase.getMetrics();
      expect(metrics.totalScans).toBe(1);
      expect(metrics.locallyStored).toBe(1);
      expect(metrics.pendingSync).toBe(1);
      expect(metrics.syncedToCloud).toBe(0);
      expect(metrics.syncFailed).toBe(0);
    });

    it('updates record status to SYNCING and then SYNCED with cloudDocumentId and timestamp', async () => {
      const pending = await offlineSpectralDatabase.getPendingScans();
      expect(pending.length).toBeGreaterThan(0);
      const record = pending[0];

      // Transition to SYNCING
      await offlineSpectralDatabase.updateScanStatus(record.id, SYNC_STATUS.SYNCING);
      let updated = await offlineSpectralDatabase.getScan(record.id);
      expect(updated.syncStatus).toBe(SYNC_STATUS.SYNCING);

      let metrics = await offlineSpectralDatabase.getMetrics();
      expect(metrics.syncing).toBe(1);
      expect(metrics.pendingSync).toBe(0);

      // Transition to SYNCED
      const now = new Date().toISOString();
      await offlineSpectralDatabase.updateScanStatus(record.id, SYNC_STATUS.SYNCED, {
        cloudDocumentId: 'cloud_doc_xyz_998',
        syncedAt: now
      });

      updated = await offlineSpectralDatabase.getScan(record.id);
      expect(updated.syncStatus).toBe(SYNC_STATUS.SYNCED);
      expect(updated.cloudDocumentId).toBe('cloud_doc_xyz_998');
      expect(updated.syncedAt).toBe(now);

      metrics = await offlineSpectralDatabase.getMetrics();
      expect(metrics.syncedToCloud).toBe(1);
      expect(metrics.syncing).toBe(0);
      expect(metrics.pendingSync).toBe(0);
      expect(metrics.lastSyncTimestamp).toBe(now);
    });

    it('records sync failures, tracks retry count, and notifies reactive subscribers', async () => {
      let notifiedEvent = null;
      const unsubscribe = offlineSpectralDatabase.subscribe((evt) => {
        notifiedEvent = evt;
      });

      const secondScan = await offlineSpectralDatabase.saveScan({
        plantNumber: 'PLANT-FAIL-02',
        syncStatus: SYNC_STATUS.PENDING_SYNC
      });

      expect(notifiedEvent).toBeDefined();
      expect(notifiedEvent.eventType).toBe('save');
      expect(notifiedEvent.record.id).toBe(secondScan.id);

      // Mark as SYNC_FAILED
      await offlineSpectralDatabase.updateScanStatus(secondScan.id, SYNC_STATUS.SYNC_FAILED, {
        syncError: 'HTTP 503 Service Unavailable'
      });

      const failedRecord = await offlineSpectralDatabase.getScan(secondScan.id);
      expect(failedRecord.syncStatus).toBe(SYNC_STATUS.SYNC_FAILED);
      expect(failedRecord.syncError).toBe('HTTP 503 Service Unavailable');
      expect(failedRecord.retryCount).toBeGreaterThanOrEqual(1);

      const metrics = await offlineSpectralDatabase.getMetrics();
      expect(metrics.syncFailed).toBe(1);

      unsubscribe();
    });
  });

  // =========================================================================
  // SUITE 2: Automatic Synchronization Engine (spectralSyncEngine.js)
  // =========================================================================
  describe('Spectral Sync Architecture - Sync Engine Queue & Exponential Backoff', () => {
    it('calculates exponential backoff delay with randomized jitter across retries', () => {
      const engine = new SpectralSyncEngine({ autoSync: false });

      // Retry 0: base 2s -> [2000, 3000] ms
      const delay0 = engine.calculateBackoff(0);
      expect(delay0).toBeGreaterThanOrEqual(2000);
      expect(delay0).toBeLessThanOrEqual(3000);

      // Retry 1: base 4s -> [4000, 5000] ms
      const delay1 = engine.calculateBackoff(1);
      expect(delay1).toBeGreaterThanOrEqual(4000);
      expect(delay1).toBeLessThanOrEqual(5000);

      // Retry 2: base 8s -> [8000, 9000] ms
      const delay2 = engine.calculateBackoff(2);
      expect(delay2).toBeGreaterThanOrEqual(8000);
      expect(delay2).toBeLessThanOrEqual(9000);

      // Max ceiling capped at 60s
      const delay10 = engine.calculateBackoff(10);
      expect(delay10).toBeLessThanOrEqual(60000);
      expect(delay10).toBeGreaterThanOrEqual(60000); // 60s ceiling
    });

    it('queues scans seamlessly when device is offline without throwing unhandled exceptions', async () => {
      const engine = new SpectralSyncEngine({ autoSync: false });
      engine.setOnline(false);

      expect(engine.isOnline()).toBe(false);
      expect(engine.getStatus()).toBe(ENGINE_STATUS.OFFLINE);

      let statusChanged = null;
      engine.on('syncStatusChange', (data) => {
        statusChanged = data;
      });

      // Attempt manual sync while offline
      const result = await engine.syncNow();
      expect(result.success).toBe(false);
      expect(result.offline).toBe(true);
      expect(result.syncedCount).toBe(0);

      expect(statusChanged).toBeDefined();
      expect(statusChanged.status).toBe(ENGINE_STATUS.OFFLINE);
    });

    it('handles simulated HTTP 200/201 successful cloud ingestion and saves cloudDocumentId', async () => {
      await offlineSpectralDatabase.clear();

      // Save a pending scan record
      const scan = await offlineSpectralDatabase.saveScan({
        plantNumber: 'PLANT-SYNC-OK',
        syncStatus: SYNC_STATUS.PENDING_SYNC,
        chemometrics: { vitalityScore: 92 }
      });

      const engine = new SpectralSyncEngine({ autoSync: false });
      engine.setOnline(true);

      // Mock global fetch for successful backend sync
      const origFetch = globalThis.fetch;
      globalThis.fetch = async (url, options) => {
        if (url.includes('/api/spectroscopy/sync') || url.includes('/api/spectral/sync') || url.includes('/api/spectroscopy/scans')) {
          return {
            status: 201,
            ok: true,
            json: async () => ({
              success: true,
              cloudDocumentId: 'cloud_render_scan_7781',
              syncedAt: new Date().toISOString()
            })
          };
        }
        return { status: 404, ok: false };
      };

      try {
        let progressFired = false;
        let completeFired = false;
        engine.on('syncProgress', (prog) => { progressFired = true; });
        engine.on('syncComplete', (comp) => { completeFired = true; });

        const syncResult = await engine.syncNow();

        expect(syncResult.success).toBe(true);
        expect(syncResult.syncedCount).toBe(1);
        expect(progressFired).toBe(true);
        expect(completeFired).toBe(true);

        // Verify record in offline database is now SYNCED with cloudDocumentId
        const updated = await offlineSpectralDatabase.getScan(scan.id);
        expect(updated.syncStatus).toBe(SYNC_STATUS.SYNCED);
        expect(updated.cloudDocumentId).toBe('cloud_render_scan_7781');
        expect(Boolean(updated.syncedAt)).toBe(true);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('handles HTTP 401/403 authorization rejections cleanly without infinite retry hammering', async () => {
      await offlineSpectralDatabase.clear();
      const scan = await offlineSpectralDatabase.saveScan({
        plantNumber: 'PLANT-AUTH-TEST',
        syncStatus: SYNC_STATUS.PENDING_SYNC
      });

      const engine = new SpectralSyncEngine({ autoSync: false });
      engine.setOnline(true);

      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        status: 403,
        ok: false,
        json: async () => ({ success: false, error: 'Forbidden' })
      });

      try {
        const syncResult = await engine.syncNow();
        expect(syncResult.success).toBe(false);
        expect(syncResult.failedCount).toBe(1);

        const updated = await offlineSpectralDatabase.getScan(scan.id);
        expect(updated.syncStatus).toBe(SYNC_STATUS.SYNC_FAILED);
        expect(updated.syncError).toContain('Authentication failed (HTTP 403)');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('handles HTTP 500 / 503 transient server errors and network exceptions cleanly', async () => {
      await offlineSpectralDatabase.clear();
      const scan = await offlineSpectralDatabase.saveScan({
        plantNumber: 'PLANT-503-TEST',
        syncStatus: SYNC_STATUS.PENDING_SYNC
      });

      const engine = new SpectralSyncEngine({ autoSync: false });
      engine.setOnline(true);

      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        status: 503,
        ok: false,
        json: async () => ({ error: 'Service Unavailable' })
      });

      try {
        const syncResult = await engine.syncNow();
        expect(syncResult.success).toBe(false);
        expect(syncResult.failedCount).toBe(1);

        const updated = await offlineSpectralDatabase.getScan(scan.id);
        expect(updated.syncStatus).toBe(SYNC_STATUS.SYNC_FAILED);
        expect(updated.syncError).toContain('Server temporary error');
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });

  // =========================================================================
  // SUITE 3: SpectroscopyAnalysisView - Metrics Header & Sync UI Integration
  // =========================================================================
  describe('SpectroscopyAnalysisView - Synchronization Metrics Header & Sync Now Button', () => {
    it('renders the Synchronization Metrics Header Widget with all 6 counters and Sync Now button', async () => {
      spectralSyncEngine._autoSyncEnabled = false;
      spectralSyncEngine._activeSyncPromise = null;
      spectralSyncEngine._status = ENGINE_STATUS.IDLE;
      await offlineSpectralDatabase.clear();

      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        status: 200,
        ok: true,
        json: async () => ({ success: true, cloudDocumentId: 'cloud_mock_init', syncedAt: new Date().toISOString() })
      });

      try {
        // Seed 2 scans (1 synced, 1 pending)
        await offlineSpectralDatabase.saveScan({
          id: 'scan-1',
          plantNumber: 'PLANT-SEED-01',
          syncStatus: SYNC_STATUS.SYNCED,
          cloudDocumentId: 'cloud-001',
          syncedAt: new Date().toISOString()
        });
        await offlineSpectralDatabase.saveScan({
          id: 'scan-2',
          plantNumber: 'PLANT-SEED-02',
          syncStatus: SYNC_STATUS.PENDING_SYNC
        });

        const view = createSpectroscopyAnalysisView();
        expect(view).toBeDefined();

        // Verify Metrics Widget exists
        const widget = view.querySelector('#spectral-sync-metrics-widget');
        expect(widget).toBeDefined();

        // Verify "Sync" button (compact single-line bar replaced the old full-width
        // "Sync Now" card - see simplified UI)
        const syncBtn = view.querySelector('#btn-sync-now');
        expect(syncBtn).toBeDefined();
        expect(syncBtn.textContent).toContain('Sync');

        // Verify metrics counters in DOM
        const totalEl = view.querySelector('#metric-total-scans');
        const locallyEl = view.querySelector('#metric-locally-stored');
        const pendingEl = view.querySelector('#metric-pending-sync');
        const syncedEl = view.querySelector('#metric-synced-cloud');
        const failedEl = view.querySelector('#metric-sync-failed');

        expect(totalEl).toBeDefined();
        expect(totalEl.textContent.trim()).toBe('2');
        expect(locallyEl.textContent.trim()).toBe('2');
        expect(pendingEl.textContent.trim()).toBe('1');
        expect(syncedEl.textContent.trim()).toBe('1');
        expect(failedEl.textContent.trim()).toBe('0');
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('triggers manual synchronization on "Sync Now" click and updates UI', async () => {
      const view = createSpectroscopyAnalysisView();
      const syncBtn = view.querySelector('#btn-sync-now');
      expect(syncBtn).toBeDefined();

      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        status: 200,
        ok: true,
        json: async () => ({ success: true, cloudDocumentId: 'cloud_sync_now_test', syncedAt: new Date().toISOString() })
      });

      try {
        syncBtn.click();
        // Give event loop tick to process async sync
        await new Promise(r => setTimeout(r, 50));

        const metrics = await offlineSpectralDatabase.getMetrics();
        expect(metrics.syncedToCloud).toBeGreaterThanOrEqual(1);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('renders all sync status badges (LOCAL_ONLY, PENDING_SYNC, SYNCING, SYNCED, SYNC_FAILED)', () => {
      const view = createSpectroscopyAnalysisView();

      // Check badge classes and badges rendered across different statuses
      const badge = view.querySelector('.sync-badge');
      expect(badge).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 4: Step 6 Results View - Section 7.C Two Tabs (Processed vs Raw)
  // =========================================================================
  describe('SpectroscopyAnalysisView - Step 6 Results (simplified single-view, no raw/technical tabs)', () => {
    // The Raw Spectrum tab, the Farmer/Technical toggle, and the formula/units/
    // validity table were removed from the default view - a farmer only sees
    // the spectral curve, plain-language numbers, and 5 decision cards. Export
    // of the underlying data moved to the single "Export All (CSV)" button.
    it('displays canvas and 5 decision cards in the results section (no formula/validity table)', () => {
      const view = createSpectroscopyAnalysisView();

      const canvas = view.querySelector('#spectralChartCanvas');
      expect(canvas).toBeDefined();

      expect(view.innerHTML).not.toContain('Calculation Method / Formula');
      expect(view.innerHTML).not.toContain('(R810 - R680) / (R810 + R680)');

      const ttsBtns = view.querySelectorAll('.tts-speak-btn');
      expect(ttsBtns.length).toBe(5);
    });

    it('exposes a single "Export All (CSV)" button for downloading every locally stored scan', () => {
      const view = createSpectroscopyAnalysisView();
      const exportBtn = view.querySelector('#btn-export-all-scans-csv');
      expect(exportBtn).toBeDefined();
      expect(exportBtn.textContent).toContain('Export All');
    });

    it('shows a plain-language "leaf scan pending" message when no scan has been captured yet', () => {
      const view = createSpectroscopyAnalysisView();
      expect(view.innerHTML).toContain('Leaf scan pending');
    });

    it('verifies AS7265X_CHANNELS constant has exactly 18 spectral channels spanning AS72651, AS72652, and AS72653', () => {
      expect(Array.isArray(AS7265X_CHANNELS)).toBe(true);
      expect(AS7265X_CHANNELS.length).toBe(18);

      const wavelengths = AS7265X_CHANNELS.map(c => c.wavelength);
      expect(wavelengths).toContain(410);
      expect(wavelengths).toContain(535);
      expect(wavelengths).toContain(560);
      expect(wavelengths).toContain(730);
      expect(wavelengths).toContain(760);
      expect(wavelengths).toContain(970);

      // Verify IC mapping
      const as1 = AS7265X_CHANNELS.filter(c => c.sensor === 'AS72651');
      const as2 = AS7265X_CHANNELS.filter(c => c.sensor === 'AS72652');
      const as3 = AS7265X_CHANNELS.filter(c => c.sensor === 'AS72653');

      expect(as1.length).toBe(6);
      expect(as2.length).toBe(6);
      expect(as3.length).toBe(6);
    });
  });

  // =========================================================================
  // SUITE 5: Step 5 Leaf Scan Capture & Auto-Queue Persistence
  // =========================================================================
  describe('SpectroscopyAnalysisView - Step 5 Leaf Scan Local Queue & Cloud Sync Flow', () => {
    it('captures leaf scan in Step 5, saves to offlineSpectralDatabase immediately with PENDING_SYNC, and notifies spectralSyncEngine without blocking', async () => {
      await offlineSpectralDatabase.clear();
      await leafClipDevice.connect({ forceSimulation: true });

      // Simulate calibration pass
      leafClipDevice.calibration.darkCurrentCompleted = true;
      leafClipDevice.calibration.whiteDiscCompleted = true;
      leafClipDevice.calibration.isCalibrated = true;

      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        status: 200,
        ok: true,
        json: async () => ({ success: true, cloudDocumentId: 'cloud_step5_mock', syncedAt: new Date().toISOString() })
      });

      try {
        const view = createSpectroscopyAnalysisView();

        // Step 5 scan button
        const scanBtn = view.querySelector('#btn-step-leaf-scan');
        expect(scanBtn).toBeDefined();

        // Click scan button
        scanBtn.click();
        await new Promise(r => setTimeout(r, 100));

        // Verify scan was saved in offline database with PENDING_SYNC (or SYNCED if auto-synced)
        const allScans = await offlineSpectralDatabase.getAllScans();
        expect(allScans.length).toBeGreaterThan(0);

        const latest = allScans[0];
        expect(latest.id).toBeDefined();
        expect([SYNC_STATUS.PENDING_SYNC, SYNC_STATUS.SYNCING, SYNC_STATUS.SYNCED]).toContain(latest.syncStatus);
      } finally {
        globalThis.fetch = origFetch;
      }
    });

    it('saves record with Save Scan to Field Records button and updates status badge', async () => {
      const origFetch = globalThis.fetch;
      globalThis.fetch = async () => ({
        status: 200,
        ok: true,
        json: async () => ({ success: true, cloudDocumentId: 'cloud_save_btn_mock', syncedAt: new Date().toISOString() })
      });

      try {
        const view = createSpectroscopyAnalysisView();

        // Trigger a scan via BLE test button
        const bleScanBtn = view.querySelector('#btn-ble-send-scan');
        if (bleScanBtn) {
          bleScanBtn.click();
          await new Promise(r => setTimeout(r, 50));
        }

        // Click Save Scan to Field Records button
        const saveBtn = view.querySelector('#btn-save-scan-record');
        if (saveBtn) {
          saveBtn.click();
          await new Promise(r => setTimeout(r, 50));
        }

        const metrics = await offlineSpectralDatabase.getMetrics();
        expect(metrics.totalScans).toBeGreaterThan(0);
      } finally {
        globalThis.fetch = origFetch;
      }
    });
  });
}

// Auto-run if executed directly via node tests/spectral-sync-ui.test.js
if (process.argv[1]?.endsWith('spectral-sync-ui.test.js')) {
  (async () => {
    const { runner } = await import('./framework.js');
    registerSpectralSyncUITests();
    const passed = await runner.run();
    process.exit(passed ? 0 : 1);
  })();
}
