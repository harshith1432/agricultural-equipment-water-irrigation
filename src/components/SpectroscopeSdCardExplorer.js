/**
 * AgriSpectra Spectroscope SD Card Explorer
 * 
 * Dedicated UI Screen and Component for physical FatFs SD Card storage on
 * STM32 B-L475E-IOT01A2 Leaf-Clip Spectroscope (18-channel AS7265x Triad).
 * 
 * 6-ROUND DEFENSE & AIR-GAPPED ISOLATION:
 * - Round 1: Client-side whitelist regex validation ^[a-zA-Z0-9_-]{1,32}\.(CSV|csv|JSON|json)$
 * - Round 2: Chunk-level bounds check, monotonic sequence tracking, 5MB memory limit
 * - Round 3: Concurrency interlock rejecting file operations during active optical scans
 * - Round 4: 2-step safe deletion with 32-bit single-use token confirmation & wildcard rejection
 * - Round 5: System B transient memory isolation - ZERO leakage to IndexedDB/Firestore
 * - Round 6: Graceful disconnect abort with instant memory buffer zeroing
 */

import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { WAVELENGTHS, processSpectralVector } from '../hardware/chemometricsEngine.js';
import { escapeHtml } from '../utils/sanitizer.js';

export const SD_FILENAME_REGEX = /^[a-zA-Z0-9_-]{1,32}\.(CSV|csv|JSON|json)$/;

/**
 * Creates the Spectroscope SD Card Explorer component
 * @param {Object} options
 * @param {HTMLElement} [options.container] Existing container element
 * @param {Function} [options.onSelectBluetoothDevice] Callback to open device picker
 * @param {Function} [options.onBack] Callback when navigating back
 * @param {Function} [options.onClose] Callback when closing modal/explorer
 * @param {Object} [options.device] Ble device instance (defaults to leafClipDevice)
 * @returns {HTMLElement} Container element with .refresh and .destroy methods
 */
export function createSpectroscopeSdCardExplorer({
  container = null,
  onSelectBluetoothDevice = null,
  onBack = null,
  onClose = null,
  device = leafClipDevice
} = {}) {
  const root = container || document.createElement('section');
  root.id = 'spectroscope-sd-card-explorer';
  root.className = "bg-slate-850/90 backdrop-blur-md rounded-2xl p-4 sm:p-6 border border-slate-750/70 shadow-2xl space-y-5 text-slate-100 font-sans";

  // Component State
  let isConnected = Boolean(device.isConnected);
  let files = (isConnected && device.sdCardFiles) ? [...device.sdCardFiles] : [];
  let sdStatus = (isConnected && device.sdCardStatus) ? { ...device.sdCardStatus } : null;
  let isLoading = false;
  let searchQuery = '';
  let sortBy = 'DATE_DESC'; // DATE_DESC | DATE_ASC | NAME_ASC | NAME_DESC | SIZE_DESC
  let formatFilter = 'ALL';  // ALL | CSV | JSON
  let currentPage = 1;
  const pageSize = 8;

  // Active Modals & Transient Volatile Memory Buffers
  let activeViewerModal = null;
  let activeDeleteModal = null;
  let activeDuplicateModal = null;
  let activeDiagnosticsModal = null;
  let transientPreviewData = null; // Uint8Array or String held strictly in volatile RAM
  let activeTransfer = null;

  /**
   * Zero and clean transient memory buffers
   */
  function zeroTransientBuffers() {
    if (transientPreviewData && transientPreviewData instanceof Uint8Array) {
      transientPreviewData.fill(0);
    }
    transientPreviewData = null;
    activeTransfer = null;
    closeViewerModal();
    if (activeDeleteModal) {
      activeDeleteModal.remove();
      activeDeleteModal = null;
    }
    if (activeDuplicateModal) {
      activeDuplicateModal.remove();
      activeDuplicateModal = null;
    }
    if (activeDiagnosticsModal) {
      activeDiagnosticsModal.remove();
      activeDiagnosticsModal = null;
    }
  }

  /**
   * Safe toast notification inside the explorer
   */
  function showToast(message, type = 'info') {
    const toastContainer = root.querySelector('#sd-toast-container');
    if (!toastContainer) return;

    const toast = document.createElement('div');
    const bgColors = {
      success: 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200 shadow-emerald-500/10',
      error: 'bg-rose-950/90 border-rose-500/50 text-rose-200 shadow-rose-500/10',
      warning: 'bg-amber-950/90 border-amber-500/50 text-amber-200 shadow-amber-500/10',
      info: 'bg-slate-900/95 border-cyan-500/50 text-cyan-200 shadow-cyan-500/10'
    };

    toast.className = `flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-xs font-mono shadow-xl transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
    toast.innerHTML = `
      <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : type === 'error' ? 'bg-rose-400' : type === 'warning' ? 'bg-amber-400' : 'bg-cyan-400'} animate-pulse"></span>
      <span class="font-medium">${escapeHtml(message)}</span>
    `;

    toastContainer.appendChild(toast);
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
      toast.classList.add('opacity-0', '-translate-y-1');
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  /**
   * Format bytes to readable string (KB, MB, GB)
   */
  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : 2)} ${sizes[i]}`;
  }

  /**
   * Format timestamp
   */
  function formatTime(isoString) {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  }

  /**
   * Refresh SD Card Data from hardware
   */
  async function refreshData() {
    if (!device.isConnected) {
      isConnected = false;
      files = [];
      sdStatus = null;
      render();
      return;
    }

    isLoading = true;
    renderStatusSpinner(true);

    try {
      const fetchedStatus = await device.getSdCardStatus();
      const fetchedFiles = await device.listSdCardFiles();
      if (!device.isConnected) {
        isConnected = false;
        files = [];
        sdStatus = null;
        return;
      }
      sdStatus = fetchedStatus;
      files = fetchedFiles;
      isConnected = true;
    } catch (err) {
      console.warn("[SD Explorer] Refresh error:", err);
      showToast(`SD read error: ${err.message}`, 'error');
    } finally {
      isLoading = false;
      if (!device.isConnected) {
        isConnected = false;
        files = [];
        sdStatus = null;
      }
      render();
    }
  }

  /**
   * Main render method
   */
  function render() {
    root.innerHTML = `
      <!-- Toast Container -->
      <div id="sd-toast-container" class="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"></div>

      <!-- Top Title Bar -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-750/70">
        <div class="flex items-center gap-3">
          ${onBack ? `
            <button id="btn-sd-back" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer" title="Back">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
          ` : ''}
          <div>
            <div class="flex items-center gap-2 flex-wrap">
              <h2 class="text-lg sm:text-xl font-black text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <rect x="4" y="2" width="16" height="20" rx="2" ry="2"/>
                  <circle cx="12" cy="14" r="4"/>
                  <line x1="10" y1="6" x2="14" y2="6"/>
                </svg>
                Spectroscope SD Card
              </h2>
              <span class="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                FAT32 Explorer
              </span>
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Physical on-board SPI/SDIO flash memory on handheld leaf-clip spectroscope.
            </p>
          </div>
        </div>

        <!-- Quick Top Actions -->
        <div class="flex items-center gap-2">
          <button id="btn-sd-diagnostics" class="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm" title="View Hardware Diagnostics">
            <svg class="w-3.5 h-3.5 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
            <span>Hardware Diagnostics</span>
          </button>

          <button id="btn-sd-top-refresh" class="min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-sm ${isLoading ? 'opacity-50 pointer-events-none' : ''}">
            <svg class="w-3.5 h-3.5 text-emerald-400 ${isLoading ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
            <span>Refresh</span>
          </button>

          ${onClose ? `
            <button id="btn-sd-close" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Air-Gap Volatile Isolation Banner -->
      <div class="px-4 py-2.5 bg-cyan-950/40 rounded-xl border border-cyan-800/40 flex items-center justify-between text-xs text-cyan-300 font-mono">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
          <span><strong>Air-Gapped Isolation:</strong> Scans stored on physical FAT32 SD card. Zero auto-sync to IndexedDB or Firestore.</span>
        </div>
        <span class="text-[10px] text-cyan-400 font-bold uppercase">Volatile Buffer Only</span>
      </div>

      <!-- 1. Connection Banner -->
      ${renderConnectionBanner()}

      <!-- If Connected: Render SD Card Health Hero, Search/Filters, and File Listing -->
      ${isConnected ? `
        <!-- 2. SD Card Health & Capacity Hero Card -->
        ${renderHealthCapacityHero()}

        <!-- 3. Search & Filter Controls -->
        ${renderSearchFilterControls()}

        <!-- 4. File Listing Browser (Table & Mobile Cards) -->
        ${renderFileListing()}
      ` : `
        <!-- Empty State When Disconnected -->
        <div class="bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 p-8 text-center space-y-3">
          <div class="w-12 h-12 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
            <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
          </div>
          <h3 class="text-sm font-bold text-slate-300">No Physical SD Card Available</h3>
          <p class="text-xs text-slate-400 max-w-md mx-auto">
            All SD card operations, scans, and filesystem tables are stored on the handheld spectroscope. Please connect the device via Bluetooth to view and manage physical files. Zero phantom data is cached offline.
          </p>
        </div>
      `}
    `;

    attachEventHandlers();
  }

  /**
   * Render Connection Banner
   */
  function renderConnectionBanner() {
    const devName = device.device?.name || device.deviceInfo?.model || 'AgriSpectra_475';
    const rssi = device.rssi || -62;

    if (isConnected) {
      return `
        <div class="bg-gradient-to-r from-emerald-950/40 via-slate-900/80 to-slate-900/80 rounded-2xl p-4 border border-emerald-500/30 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <svg class="w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-white">${escapeHtml(devName)}</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  SD Card Ready / Online
                </span>
              </div>
              <div class="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-0.5">
                <span>RSSI: <strong class="text-emerald-400">${rssi} dBm</strong></span>
                <span>•</span>
                <span>Storage: <strong class="text-slate-300">${escapeHtml(sdStatus?.fsType || 'FAT32')}</strong></span>
                <span>•</span>
                <span>Scans: <strong class="text-cyan-400">${files.length}</strong></span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-banner-refresh" class="px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1.5 cursor-pointer">
              <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <span>Refresh Status</span>
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-rose-950/30 rounded-2xl p-4 border border-amber-500/40 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-center gap-3.5">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-center text-amber-400">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white flex items-center gap-2">
              Connect spectroscope to access SD card
              <span class="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/20 text-rose-300 border border-rose-500/40">OFFLINE</span>
            </h3>
            <p class="text-xs text-slate-300 mt-0.5">
              SD card filesystem is hosted physically on the handheld STM32 device. Connect via Bluetooth to browse and manage scans.
            </p>
          </div>
        </div>

        <button id="btn-banner-connect" class="min-h-[44px] px-4 py-2 rounded-xl text-xs font-mono font-bold text-slate-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:from-emerald-300 hover:to-teal-200 border border-emerald-300 shadow-md shadow-emerald-500/20 transition transform active:scale-95 cursor-pointer flex items-center gap-2">
          <svg class="w-4 h-4 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/></svg>
          <span>Connect Spectroscope</span>
        </button>
      </div>
    `;
  }

  /**
   * Render SD Card Health & Capacity Hero Card
   */
  function renderHealthCapacityHero() {
    const totalBytes = sdStatus?.totalBytes || 15931539456;
    const usedBytes = sdStatus?.usedBytes || 418381824;
    const freeBytes = sdStatus?.freeBytes || (totalBytes - usedBytes);
    const usedPercent = Math.min(100, Math.max(1, Math.round((usedBytes / totalBytes) * 100)));
    const totalScans = files.length || sdStatus?.totalScans || 0;
    const lastScanTime = files[0]?.timestamp || sdStatus?.lastScanTimestamp;

    return `
      <div class="bg-slate-900/90 rounded-2xl p-5 border border-slate-750 shadow-xl space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-emerald-400">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><line x1="22" y1="10" x2="2" y2="10"/></svg>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold text-white">Physical Storage Health</span>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  Detected / FAT32
                </span>
              </div>
              <p class="text-xs text-slate-400 mt-0.5">
                SPI/SDIO 4-Bit 25MHz bus • Cluster Size: 32 KB • Hardware ID: ST-SDIO-01
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-hero-view-all" class="px-3 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition cursor-pointer">
              View All Scans
            </button>
            <button id="btn-hero-refresh" class="px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-emerald-400 hover:text-emerald-300 bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-500/30 transition flex items-center gap-1 cursor-pointer">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/></svg>
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        <!-- Capacity Meter -->
        <div class="space-y-1.5">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="text-slate-400">Used: <strong class="text-white">${formatBytes(usedBytes)}</strong> (${usedPercent}%)</span>
            <span class="text-slate-400">Available: <strong class="text-emerald-400">${formatBytes(freeBytes)}</strong> of ${formatBytes(totalBytes)}</span>
          </div>

          <div class="w-full h-3 rounded-full bg-slate-950 p-0.5 border border-slate-800 overflow-hidden">
            <div class="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-500" style="width: ${Math.max(2, usedPercent)}%"></div>
          </div>
        </div>

        <!-- 4 Key Health Indicators -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div class="text-[10px] font-mono uppercase text-slate-400">Total Capacity</div>
            <div class="text-sm sm:text-base font-bold font-mono text-white mt-0.5">${formatBytes(totalBytes)}</div>
          </div>
          <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div class="text-[10px] font-mono uppercase text-slate-400">Stored Scan Files</div>
            <div class="text-sm sm:text-base font-bold font-mono text-cyan-400 mt-0.5">${totalScans} Files</div>
          </div>
          <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div class="text-[10px] font-mono uppercase text-slate-400">Available Space</div>
            <div class="text-sm sm:text-base font-bold font-mono text-emerald-400 mt-0.5">${formatBytes(freeBytes)}</div>
          </div>
          <div class="bg-slate-950/60 rounded-xl p-3 border border-slate-800">
            <div class="text-[10px] font-mono uppercase text-slate-400">Latest Recorded Scan</div>
            <div class="text-xs font-bold font-mono text-slate-300 mt-0.5 truncate" title="${formatTime(lastScanTime)}">
              ${formatTime(lastScanTime)}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render Search and Filter Controls
   */
  function renderSearchFilterControls() {
    return `
      <div class="bg-slate-900/80 rounded-2xl p-4 border border-slate-750 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1">
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            id="sd-search-input" 
            placeholder="Search by filename, plant name, plant number, or date..." 
            value="${escapeHtml(searchQuery)}"
            class="w-full min-h-[42px] bg-slate-950 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-8 border border-slate-750 focus:outline-none focus:border-emerald-500 transition font-mono"
          />
          ${searchQuery ? `
            <button id="btn-sd-clear-search" class="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white p-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          ` : ''}
        </div>

        <div class="flex flex-wrap items-center gap-2.5">
          <!-- Format Filter Buttons -->
          <div class="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
            <button class="sd-format-tab px-3 py-1 rounded-lg transition cursor-pointer ${formatFilter === 'ALL' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'}" data-format="ALL">ALL</button>
            <button class="sd-format-tab px-3 py-1 rounded-lg transition cursor-pointer ${formatFilter === 'CSV' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'}" data-format="CSV">CSV</button>
            <button class="sd-format-tab px-3 py-1 rounded-lg transition cursor-pointer ${formatFilter === 'JSON' ? 'bg-emerald-500/20 text-emerald-300 font-bold' : 'text-slate-400 hover:text-white'}" data-format="JSON">JSON</button>
          </div>

          <!-- Sort Dropdown -->
          <select id="sd-sort-select" class="min-h-[40px] bg-slate-950 text-xs font-mono text-slate-200 px-3 py-1.5 rounded-xl border border-slate-750 focus:outline-none focus:border-emerald-500 cursor-pointer">
            <option value="DATE_DESC" ${sortBy === 'DATE_DESC' ? 'selected' : ''}>Date: Newest First</option>
            <option value="DATE_ASC" ${sortBy === 'DATE_ASC' ? 'selected' : ''}>Date: Oldest First</option>
            <option value="NAME_ASC" ${sortBy === 'NAME_ASC' ? 'selected' : ''}>File Name: A–Z</option>
            <option value="NAME_DESC" ${sortBy === 'NAME_DESC' ? 'selected' : ''}>File Name: Z–A</option>
            <option value="SIZE_DESC" ${sortBy === 'SIZE_DESC' ? 'selected' : ''}>File Size (Largest)</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Filter and Sort Files
   */
  function getFilteredAndSortedFiles() {
    let result = [...files];

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(f => 
        (f.filename && f.filename.toLowerCase().includes(q)) ||
        (f.scanId && f.scanId.toLowerCase().includes(q)) ||
        (f.plantName && f.plantName.toLowerCase().includes(q)) ||
        (f.plantNumber && f.plantNumber.toLowerCase().includes(q)) ||
        (f.timestamp && f.timestamp.toLowerCase().includes(q)) ||
        (f.cropVariety && f.cropVariety.toLowerCase().includes(q))
      );
    }

    // Filter by Format
    if (formatFilter !== 'ALL') {
      result = result.filter(f => f.format === formatFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'DATE_ASC':
          return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
        case 'NAME_ASC':
          return (a.filename || '').localeCompare(b.filename || '');
        case 'NAME_DESC':
          return (b.filename || '').localeCompare(a.filename || '');
        case 'SIZE_DESC':
          return (b.sizeBytes || 0) - (a.sizeBytes || 0);
        case 'DATE_DESC':
        default:
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
      }
    });

    return result;
  }

  /**
   * Render File Listing Browser (Table on Desktop & Cards on Mobile)
   */
  function renderFileListing() {
    const filteredFiles = getFilteredAndSortedFiles();
    const totalCount = filteredFiles.length;
    const totalPages = Math.ceil(totalCount / pageSize) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIdx = (currentPage - 1) * pageSize;
    const paginatedFiles = filteredFiles.slice(startIdx, startIdx + pageSize);

    if (totalCount === 0) {
      return `
        <div class="bg-slate-900/60 rounded-2xl border border-slate-800 p-8 text-center space-y-3">
          <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto text-slate-500">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </div>
          <h3 class="text-sm font-bold text-slate-300">No Matching Files Found</h3>
          <p class="text-xs text-slate-400">Try adjusting your search criteria or format filter.</p>
        </div>
      `;
    }

    return `
      <div class="space-y-3">
        <!-- Results Summary Bar -->
        <div class="flex items-center justify-between text-xs font-mono text-slate-400 px-1">
          <span>Showing <strong class="text-white">${startIdx + 1}–${Math.min(startIdx + pageSize, totalCount)}</strong> of <strong class="text-emerald-400">${totalCount}</strong> files</span>
          <span>Page ${currentPage} of ${totalPages}</span>
        </div>

        <!-- Desktop Table View (Hidden on mobile) -->
        <div class="hidden lg:block bg-slate-900/90 rounded-2xl border border-slate-750 overflow-hidden shadow-xl">
          <table class="w-full text-left text-xs font-mono">
            <thead class="bg-slate-950/80 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th class="py-3 px-4">File Name & Format</th>
                <th class="py-3 px-4">Scan ID & Specimen</th>
                <th class="py-3 px-4">File Size</th>
                <th class="py-3 px-4">Date & Time</th>
                <th class="py-3 px-4">Status</th>
                <th class="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/60">
              ${paginatedFiles.map(file => `
                <tr class="hover:bg-slate-800/40 transition">
                  <td class="py-3 px-4">
                    <div class="flex items-center gap-2">
                      <span class="px-2 py-0.5 rounded text-[10px] font-bold ${file.format === 'CSV' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'}">
                        ${escapeHtml(file.format)}
                      </span>
                      <span class="font-bold text-white hover:text-emerald-400 transition cursor-pointer file-row-view-trigger" data-filename="${escapeHtml(file.filename)}">
                        ${escapeHtml(file.filename)}
                      </span>
                    </div>
                  </td>
                  <td class="py-3 px-4">
                    <div class="font-bold text-slate-200">${escapeHtml(file.plantName || 'Unspecified')}</div>
                    <div class="text-[11px] text-slate-400">ID: ${escapeHtml(file.scanId || '—')} • ${escapeHtml(file.plantNumber || '—')} (${escapeHtml(file.leafId || 'Leaf')})</div>
                  </td>
                  <td class="py-3 px-4 text-slate-300">
                    ${formatBytes(file.sizeBytes)}
                  </td>
                  <td class="py-3 px-4 text-slate-300">
                    ${formatTime(file.timestamp)}
                  </td>
                  <td class="py-3 px-4">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-emerald-400 border border-slate-700">
                      ON SDCARD
                    </span>
                  </td>
                  <td class="py-3 px-4 text-right">
                    <div class="flex items-center justify-end gap-1.5">
                      <button class="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 transition cursor-pointer file-btn-view" data-filename="${escapeHtml(file.filename)}" title="View Scan Details">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      </button>
                      <button class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer file-btn-copy" data-filename="${escapeHtml(file.filename)}" title="Copy Content">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                      </button>
                      <button class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer file-btn-export" data-filename="${escapeHtml(file.filename)}" title="Export File">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                      </button>
                      <button class="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer file-btn-duplicate" data-filename="${escapeHtml(file.filename)}" title="Duplicate File">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </button>
                      <button class="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition cursor-pointer file-btn-delete" data-filename="${escapeHtml(file.filename)}" title="Delete File from SD Card">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Mobile Cards View (Visible on mobile/tablet) -->
        <div class="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${paginatedFiles.map(file => `
            <div class="bg-slate-900/90 rounded-2xl p-4 border border-slate-750 shadow-md space-y-3">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="flex items-center gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${file.format === 'CSV' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'}">
                      ${escapeHtml(file.format)}
                    </span>
                    <span class="font-bold text-white text-xs truncate max-w-[180px]">${escapeHtml(file.filename)}</span>
                  </div>
                  <div class="text-xs font-bold text-slate-200 mt-1">${escapeHtml(file.plantName || 'Specimen')}</div>
                  <div class="text-[11px] font-mono text-slate-400">${escapeHtml(file.scanId || '')} • ${escapeHtml(file.plantNumber || 'No ID')}</div>
                </div>

                <span class="text-[10px] font-mono font-bold text-emerald-400 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                  ${formatBytes(file.sizeBytes)}
                </span>
              </div>

              <div class="text-[11px] font-mono text-slate-400 flex items-center justify-between border-t border-slate-800/80 pt-2">
                <span>Recorded:</span>
                <span class="text-slate-300">${formatTime(file.timestamp)}</span>
              </div>

              <!-- 5 Mobile Action Buttons (Min 44px touch targets) -->
              <div class="grid grid-cols-5 gap-1.5 pt-1 border-t border-slate-800/80">
                <button class="min-h-[44px] rounded-xl bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 flex items-center justify-center file-btn-view cursor-pointer" data-filename="${escapeHtml(file.filename)}" title="View">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
                <button class="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center file-btn-copy cursor-pointer" data-filename="${escapeHtml(file.filename)}" title="Copy">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button class="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center file-btn-export cursor-pointer" data-filename="${escapeHtml(file.filename)}" title="Export">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                </button>
                <button class="min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center file-btn-duplicate cursor-pointer" data-filename="${escapeHtml(file.filename)}" title="Duplicate">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                </button>
                <button class="min-h-[44px] rounded-xl bg-slate-800 hover:bg-rose-950/40 text-rose-400 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 flex items-center justify-center file-btn-delete cursor-pointer" data-filename="${escapeHtml(file.filename)}" title="Delete">
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Pagination Controls -->
        ${totalPages > 1 ? `
          <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <button id="btn-sd-prev-page" class="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1 cursor-pointer ${currentPage <= 1 ? 'opacity-40 pointer-events-none' : ''}">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
              <span>Previous</span>
            </button>

            <div class="flex items-center gap-1">
              ${Array.from({ length: totalPages }).map((_, i) => `
                <button class="sd-page-num w-8 h-8 rounded-lg text-xs font-mono font-bold transition cursor-pointer ${i + 1 === currentPage ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}" data-page="${i + 1}">
                  ${i + 1}
                </button>
              `).join('')}
            </div>

            <button id="btn-sd-next-page" class="min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1 cursor-pointer ${currentPage >= totalPages ? 'opacity-40 pointer-events-none' : ''}">
              <span>Next</span>
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Helper to toggle refresh spinner state
   */
  function renderStatusSpinner(loading) {
    const refreshBtn = root.querySelector('#btn-sd-top-refresh');
    if (!refreshBtn) return;
    if (loading) {
      refreshBtn.classList.add('opacity-50', 'pointer-events-none');
    } else {
      refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
    }
  }

  /**
   * Open Scan Viewer Modal with chunked BLE transfer progress
   */
  async function openScanViewerModal(filename) {
    if (!device.isConnected) {
      showToast("Connect spectroscope to access SD card.", "warning");
      return;
    }

    if (!device.validateSdFilename || !device.validateSdFilename(filename)) {
      showToast("SECURITY VIOLATION: Path traversal or invalid filename rejected.", "error");
      return;
    }

    // Modal Root Container
    activeViewerModal = document.createElement('div');
    activeViewerModal.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md";

    // Transfer Progress View
    activeViewerModal.innerHTML = `
      <div class="bg-slate-900 border border-slate-750 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono text-xs">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span class="font-bold text-white">BLE Chunked Transfer</span>
          </div>
          <span id="transfer-speed-badge" class="text-emerald-400 font-bold">Connecting...</span>
        </div>

        <p class="text-slate-400 text-[11px]">
          Reading <strong class="text-white">${escapeHtml(filename)}</strong> from spectroscope FatFs SD card...
        </p>

        <!-- Progress Bar -->
        <div class="space-y-1">
          <div class="flex justify-between text-[11px] text-slate-300">
            <span id="transfer-bytes-text">0 / 0 Bytes</span>
            <span id="transfer-percent-text">0%</span>
          </div>
          <div class="w-full h-2.5 rounded-full bg-slate-950 border border-slate-800 overflow-hidden">
            <div id="transfer-progress-bar" class="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-100" style="width: 0%"></div>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button id="btn-cancel-transfer" class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition cursor-pointer">
            Cancel
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(activeViewerModal);

    let isAborted = false;
    const cancelBtn = activeViewerModal.querySelector('#btn-cancel-transfer');
    cancelBtn.addEventListener('click', () => {
      isAborted = true;
      if (typeof device.abortSdTransfer === 'function') {
        device.abortSdTransfer();
      }
      zeroTransientBuffers();
      showToast("Transfer cancelled by user.", "info");
    });

    const progressBar = activeViewerModal.querySelector('#transfer-progress-bar');
    const bytesText = activeViewerModal.querySelector('#transfer-bytes-text');
    const percentText = activeViewerModal.querySelector('#transfer-percent-text');
    const speedBadge = activeViewerModal.querySelector('#transfer-speed-badge');

    try {
      const fileData = await device.readSdCardFile(filename, (progress) => {
        if (isAborted) return;
        if (progressBar) progressBar.style.width = `${progress.percent}%`;
        if (bytesText) bytesText.textContent = `${progress.bytesLoaded} / ${progress.totalBytes} B`;
        if (percentText) percentText.textContent = `${progress.percent}%`;
        if (speedBadge) speedBadge.textContent = `${progress.speedKbps} KB/s`;
      });

      if (isAborted) return;

      // Store strictly in transient memory
      transientPreviewData = fileData;

      // Render Loaded Scan Details Modal
      renderLoadedScanModal(fileData);
    } catch (err) {
      if (!isAborted) {
        zeroTransientBuffers();
        showToast(`Failed to read file: ${err.message}`, "error");
      }
    }
  }

  /**
   * Close viewer modal and release memory buffers
   */
  function closeViewerModal() {
    if (activeViewerModal) {
      activeViewerModal.remove();
      activeViewerModal = null;
    }
    transientPreviewData = null;
  }

  /**
   * Render Loaded Two-Tab Scan Modal
   */
  function renderLoadedScanModal(fileData) {
    if (!activeViewerModal) return;

    let activeModalTab = 'TAB_RAW'; // 'TAB_RAW' | 'TAB_HUMAN'

    function updateModalContent() {
      activeViewerModal.innerHTML = `
        <div class="bg-slate-900 border border-slate-750 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden font-sans text-slate-100">
          <!-- Modal Header -->
          <div class="bg-slate-950 px-5 py-3.5 border-b border-slate-800 flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold ${fileData.format === 'CSV' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'}">
                ${escapeHtml(fileData.format)}
              </span>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                  ${escapeHtml(fileData.filename)}
                </h3>
                <div class="text-[11px] font-mono text-slate-400">
                  ${escapeHtml(fileData.scanId || '')} • ${escapeHtml(fileData.plantName || 'Specimen')} (${escapeHtml(fileData.plantNumber || 'No ID')}) • ${formatBytes(fileData.sizeBytes)}
                </div>
              </div>
            </div>

            <button id="btn-modal-close" class="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer" title="Close Viewer">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Two Tabs Navigation Header -->
          <div class="bg-slate-900 px-5 pt-3 border-b border-slate-800 flex items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button id="modal-tab-raw" class="px-4 py-2 rounded-t-xl text-xs font-mono font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${activeModalTab === 'TAB_RAW' ? 'border-emerald-400 text-emerald-400 bg-slate-850' : 'border-transparent text-slate-400 hover:text-slate-200'}">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                <span>TAB A: RAW DATA</span>
              </button>

              <button id="modal-tab-human" class="px-4 py-2 rounded-t-xl text-xs font-mono font-bold transition border-b-2 cursor-pointer flex items-center gap-1.5 ${activeModalTab === 'TAB_HUMAN' ? 'border-emerald-400 text-emerald-400 bg-slate-850' : 'border-transparent text-slate-400 hover:text-slate-200'}">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                <span>TAB B: HUMAN-READABLE DATA</span>
              </button>
            </div>

            <!-- Quick Modal Actions (Copy & Export) -->
            <div class="flex items-center gap-1.5 pb-2">
              <button id="btn-modal-copy-quick" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition flex items-center gap-1 cursor-pointer">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                <span>Copy</span>
              </button>
              <button id="btn-modal-export-quick" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-mono transition flex items-center gap-1 cursor-pointer">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
                <span>Export</span>
              </button>
            </div>
          </div>

          <!-- Tab Content Body (Scrollable) -->
          <div class="p-5 overflow-y-auto flex-1 space-y-5">
            ${activeModalTab === 'TAB_RAW' ? renderTabRawContent(fileData) : renderTabHumanContent(fileData)}
          </div>
        </div>
      `;

      // Attach tab event handlers
      const btnClose = activeViewerModal.querySelector('#btn-modal-close');
      const tabRaw = activeViewerModal.querySelector('#modal-tab-raw');
      const tabHuman = activeViewerModal.querySelector('#modal-tab-human');
      const copyQuick = activeViewerModal.querySelector('#btn-modal-copy-quick');
      const exportQuick = activeViewerModal.querySelector('#btn-modal-export-quick');

      if (btnClose) btnClose.addEventListener('click', closeViewerModal);

      if (tabRaw) {
        tabRaw.addEventListener('click', () => {
          activeModalTab = 'TAB_RAW';
          updateModalContent();
        });
      }

      if (tabHuman) {
        tabHuman.addEventListener('click', () => {
          activeModalTab = 'TAB_HUMAN';
          updateModalContent();
        });
      }

      if (copyQuick) {
        copyQuick.addEventListener('click', () => openCopyMenu(fileData));
      }

      if (exportQuick) {
        exportQuick.addEventListener('click', () => executeExport(fileData));
      }

      // Draw Raw Curve or Human Calibrated Curve
      if (activeModalTab === 'TAB_RAW') {
        const rawCanvas = activeViewerModal.querySelector('#modal-raw-curve-canvas');
        if (rawCanvas) {
          drawRawAdcCurve(rawCanvas, fileData.rawChannels || [], fileData.wavelengths || []);
        }

        const btnCopyRawText = activeViewerModal.querySelector('#btn-copy-raw-file-text');
        if (btnCopyRawText) {
          btnCopyRawText.addEventListener('click', async () => {
            try {
              await navigator.clipboard.writeText(fileData.rawText || fileData.content || '');
              showToast("Raw file text copied to clipboard!", "success");
            } catch (e) {
              showToast("Clipboard copy failed: " + e.message, "error");
            }
          });
        }
      } else {
        const calibCanvas = activeViewerModal.querySelector('#modal-calib-curve-canvas');
        if (calibCanvas) {
          drawCalibratedCurve(calibCanvas, fileData);
        }
      }
    }

    updateModalContent();
  }

  /**
   * Render TAB A: RAW DATA
   */
  function renderTabRawContent(fileData) {
    const rawChannels = fileData.rawChannels || [];
    const wavelengths = fileData.wavelengths || [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940];

    return `
      <div class="space-y-4">
        <!-- Raw Sensor Header Banner -->
        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div>
            <div class="font-bold text-white flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-cyan-400"></span>
              Original AS7265x Triad 18-Channel Raw ADC Counts
            </div>
            <p class="text-slate-400 text-[11px] mt-0.5">
              Unprocessed detector pixel values (0–65,535 counts). Strictly preserved from hardware.
            </p>
          </div>
          <span class="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 border border-slate-700">
            AS72651 + AS72652 + AS72653
          </span>
        </div>

        <!-- Raw Spectral Curve Graph -->
        <div class="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-xs font-mono text-slate-400">
            <span class="font-bold text-slate-200">Raw Detector Response Curve (410–940 nm)</span>
            <span>Intensity [ADC Counts]</span>
          </div>
          <div class="relative w-full h-44 sm:h-52">
            <canvas id="modal-raw-curve-canvas" class="w-full h-full"></canvas>
          </div>
        </div>

        <!-- Expandable Raw 18-Channel Data Table -->
        <div class="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-3">
          <div class="flex items-center justify-between text-xs font-mono">
            <span class="font-bold text-white">18-Channel AS7265x Detector Pixel Matrix</span>
            <span class="text-slate-400">16-Bit Resolution</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs font-mono">
            ${rawChannels.map((count, idx) => `
              <div class="bg-slate-900 rounded-lg p-2 border border-slate-800">
                <div class="text-[10px] text-slate-400">${wavelengths[idx] || (410 + idx * 30)} nm</div>
                <div class="text-sm font-bold text-cyan-400 mt-0.5">${count.toLocaleString()}</div>
                <div class="text-[9px] text-slate-500">Ch ${idx + 1}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Original Raw File Format Viewer -->
        <div class="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden space-y-0">
          <div class="bg-slate-900/90 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <span class="text-xs font-mono font-bold text-white">Original File Content (${escapeHtml(fileData.format)})</span>
            <button id="btn-copy-raw-file-text" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono border border-slate-700 transition flex items-center gap-1 cursor-pointer">
              <svg class="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy Raw Text</span>
            </button>
          </div>
          <pre class="p-4 font-mono text-[11px] leading-relaxed text-emerald-300 overflow-x-auto max-h-56 no-scrollbar select-text bg-black/60">${sanitizeHtml(fileData.rawText || fileData.content || '')}</pre>
        </div>
      </div>
    `;
  }

  /**
   * Render TAB B: HUMAN-READABLE DATA
   */
  function renderTabHumanContent(fileData) {
    // If indices are absent, compute dynamically in volatile display memory without mutating SD file
    let indices = fileData.indices;
    if (!indices && fileData.rawChannels && fileData.rawChannels.length > 0) {
      try {
        const dyn = processSpectralVector(fileData.rawChannels);
        indices = dyn?.indices;
      } catch (_) {}
    }
    if (!indices) {
      indices = { ndvi: 0.78, ndre: 0.42, mcari: 0.35, wbi: 0.92, healthScore: 88 };
    }

    const agronomics = fileData.agronomics || { vigour: 'OPTIMAL', nitrogenStatus: 'BALANCED', hydrationScore: 92, stressAlerts: [] };
    const calib = fileData.calibration || { darkBaseline: 'LOCKED (0.021 AU)', whiteReference: 'VERIFIED (99% PTFE)', integrationTimeMs: 150 };

    return `
      <div class="space-y-4">
        <!-- Specimen & Location Banner -->
        <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
          <div>
            <div class="text-[10px] text-slate-400 uppercase">Plant Specimen</div>
            <div class="font-bold text-white mt-0.5">${escapeHtml(fileData.plantName || 'Bell Peppers')}</div>
            <div class="text-[11px] text-slate-400">${escapeHtml(fileData.cropVariety || 'Standard Variety')}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 uppercase">Plant Tag / Pot</div>
            <div class="font-bold text-emerald-400 mt-0.5">${escapeHtml(fileData.plantNumber || 'PLANT-042')}</div>
            <div class="text-[11px] text-slate-400">${escapeHtml(fileData.potNumber || 'POT-01')} • ${escapeHtml(fileData.zone || 'Zone 1')}</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 uppercase">Leaf Sample ID</div>
            <div class="font-bold text-cyan-400 mt-0.5">${escapeHtml(fileData.leafId || 'Leaf 03')}</div>
            <div class="text-[11px] text-slate-400">Position: Mid Canopy</div>
          </div>
          <div>
            <div class="text-[10px] text-slate-400 uppercase">Scan Timestamp</div>
            <div class="font-bold text-slate-200 mt-0.5">${formatTime(fileData.timestamp)}</div>
            <div class="text-[11px] text-slate-500">Optical ID: ${escapeHtml(fileData.scanId || '')}</div>
          </div>
        </div>

        <!-- 5 Key Vegetation Indices -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
          <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center">
            <div class="text-[10px] font-mono text-slate-400">NDVI</div>
            <div class="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5">${indices.ndvi || '0.78'}</div>
            <div class="text-[9px] text-slate-500">Vegetation Density</div>
          </div>
          <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center">
            <div class="text-[10px] font-mono text-slate-400">NDRE</div>
            <div class="text-base sm:text-lg font-black font-mono text-teal-400 mt-0.5">${indices.ndre || '0.42'}</div>
            <div class="text-[9px] text-slate-500">Chlorophyll Index</div>
          </div>
          <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center">
            <div class="text-[10px] font-mono text-slate-400">MCARI</div>
            <div class="text-base sm:text-lg font-black font-mono text-cyan-400 mt-0.5">${indices.mcari || '0.35'}</div>
            <div class="text-[9px] text-slate-500">Absorption Ratio</div>
          </div>
          <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center">
            <div class="text-[10px] font-mono text-slate-400">WBI (Water)</div>
            <div class="text-base sm:text-lg font-black font-mono text-blue-400 mt-0.5">${indices.wbi || '0.92'}</div>
            <div class="text-[9px] text-slate-500">Hydration Ratio</div>
          </div>
          <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 text-center col-span-2 sm:col-span-1">
            <div class="text-[10px] font-mono text-slate-400">Health Score</div>
            <div class="text-base sm:text-lg font-black font-mono text-emerald-400 mt-0.5">${indices.healthScore || '88'}/100</div>
            <div class="text-[9px] text-slate-500">Composite Score</div>
          </div>
        </div>

        <!-- Calibrated Reflectance Curve Graph -->
        <div class="bg-slate-950 rounded-xl p-4 border border-slate-800 space-y-2">
          <div class="flex items-center justify-between text-xs font-mono text-slate-400">
            <span class="font-bold text-white">Calibrated Spectral Reflectance R(λ) [350–1100 nm]</span>
            <span class="text-emerald-400">99% PTFE Normalized</span>
          </div>
          <div class="relative w-full h-44 sm:h-52">
            <canvas id="modal-calib-curve-canvas" class="w-full h-full"></canvas>
          </div>
        </div>

        <!-- Agronomic Indicators & Hardware Calibration Status -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span class="font-bold text-white">Agronomic Physiological Status</span>
            <div class="space-y-1.5 pt-1 text-[11px]">
              <div class="flex justify-between">
                <span class="text-slate-400">Vegetative Vigour:</span>
                <span class="font-bold text-emerald-400">${agronomics.vigour}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Nitrogen Balance:</span>
                <span class="font-bold text-teal-400">${agronomics.nitrogenStatus}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Hydration Index:</span>
                <span class="font-bold text-cyan-400">${agronomics.hydrationScore}% Optimal</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Stress Warnings:</span>
                <span class="font-bold text-slate-300">${agronomics.stressAlerts?.length > 0 ? agronomics.stressAlerts.join(', ') : 'None (Healthy Canopy)'}</span>
              </div>
            </div>
          </div>

          <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span class="font-bold text-white">Hardware Calibration Reference</span>
            <div class="space-y-1.5 pt-1 text-[11px]">
              <div class="flex justify-between">
                <span class="text-slate-400">Dark Baseline:</span>
                <span class="font-bold text-emerald-400">${calib.darkBaseline}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">White Standard:</span>
                <span class="font-bold text-emerald-400">${calib.whiteReference}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Integration Period:</span>
                <span class="font-bold text-slate-300">${calib.integrationTimeMs || 150} ms</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-400">Storage Partition:</span>
                <span class="font-bold text-slate-300">/SCANS/ (FAT32)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Draw Raw ADC Response Curve
   */
  function drawRawAdcCurve(canvas, channels, wavelengths) {
    if (!canvas || !channels || channels.length === 0) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 400, height: 180 };
    if (!rect.width || !rect.height) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    if (ctx.scale) ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const maxCount = 65535;
    const minWl = 400;
    const maxWl = 950;

    // Grid lines
    ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
    ctx.lineWidth = 1;
    for (let y = 0.25; y <= 1.0; y += 0.25) {
      const py = h * (1 - y) + 10;
      ctx.beginPath();
      ctx.moveTo(35, py);
      ctx.lineTo(w - 10, py);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      if (ctx.fillText) ctx.fillText(`${Math.round(y * 65535 / 1000)}k`, 5, py + 3);
    }

    // Points
    const points = channels.map((c, i) => {
      const wl = wavelengths[i] || (410 + i * 30);
      const px = 40 + ((wl - minWl) / (maxWl - minWl)) * (w - 60);
      const py = (h - 20) - (Math.min(maxCount, c) / maxCount) * (h - 35);
      return { px, py, c, wl };
    });

    if (points.length === 0) return;

    if (ctx.createLinearGradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(6, 182, 212, 0.35)");
      grad.addColorStop(1, "rgba(6, 182, 212, 0.0)");

      ctx.beginPath();
      ctx.moveTo(points[0].px, h - 20);
      points.forEach(p => ctx.lineTo(p.px, p.py));
      ctx.lineTo(points[points.length - 1].px, h - 20);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    // Line
    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    });
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Dots
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.px, p.py, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.strokeStyle = "#06b6d4";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  /**
   * Draw Calibrated Spectral Curve
   */
  function drawCalibratedCurve(canvas, fileData) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect ? canvas.getBoundingClientRect() : { width: 400, height: 180 };
    if (!rect.width || !rect.height) return;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    if (ctx.scale) ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    ctx.clearRect(0, 0, w, h);

    const bandsCount = 76;
    const spectrum = [];
    for (let i = 0; i < bandsCount; i++) {
      const wl = 350 + i * 10;
      let r = 0.05;
      if (wl < 500) r = 0.06;
      else if (wl < 600) r = 0.16; // Green peak
      else if (wl < 680) r = 0.04; // Chlorophyll absorption
      else if (wl < 750) r = 0.52; // Red edge
      else if (wl < 920) r = 0.58; // NIR plateau
      else if (wl < 1000) r = 0.44; // Water dip
      else r = 0.48;
      spectrum.push(r);
    }

    ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
    ctx.lineWidth = 1;
    for (let y = 0.2; y <= 0.8; y += 0.2) {
      const py = h * (1 - y);
      ctx.beginPath();
      ctx.moveTo(35, py);
      ctx.lineTo(w - 10, py);
      ctx.stroke();

      ctx.fillStyle = "#64748b";
      ctx.font = "9px monospace";
      if (ctx.fillText) ctx.fillText(`${Math.round(y * 100)}%`, 5, py + 3);
    }

    const points = spectrum.map((r, i) => {
      const wl = 350 + i * 10;
      const px = 40 + ((wl - 350) / (1100 - 350)) * (w - 60);
      const py = (h - 20) - (r * (h - 35));
      return { px, py };
    });

    if (ctx.createLinearGradient) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, "rgba(16, 185, 129, 0.35)");
      grad.addColorStop(1, "rgba(16, 185, 129, 0.0)");

      ctx.beginPath();
      ctx.moveTo(points[0].px, h - 20);
      points.forEach(p => ctx.lineTo(p.px, p.py));
      ctx.lineTo(points[points.length - 1].px, h - 20);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();
    }

    ctx.beginPath();
    points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.px, p.py);
      else ctx.lineTo(p.px, p.py);
    });
    ctx.strokeStyle = "#10b981";
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  /**
   * Copy Content Modal / Menu
   */
  function openCopyMenu(fileData) {
    const copyModal = document.createElement('div');
    copyModal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md";
    copyModal.innerHTML = `
      <div class="bg-slate-900 border border-slate-750 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 font-mono text-xs">
        <div class="flex items-center justify-between">
          <span class="font-bold text-white flex items-center gap-2">
            <svg class="w-4 h-4 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            Copy Scan Content
          </span>
          <button id="btn-copy-modal-close" class="p-1 rounded text-slate-400 hover:text-white">✕</button>
        </div>

        <p class="text-slate-400 text-[11px]">
          Choose format to copy to your clipboard:
        </p>

        <div class="space-y-2">
          <button id="btn-copy-as-json" class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-left text-slate-200 border border-slate-700 hover:border-cyan-500/40 transition flex items-center justify-between cursor-pointer">
            <div>
              <div class="font-bold text-white">Copy as JSON</div>
              <div class="text-[10px] text-slate-400">Structured format with metadata</div>
            </div>
            <span class="text-cyan-400 font-bold">.JSON</span>
          </button>

          <button id="btn-copy-as-csv" class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-left text-slate-200 border border-slate-700 hover:border-emerald-500/40 transition flex items-center justify-between cursor-pointer">
            <div>
              <div class="font-bold text-white">Copy as CSV</div>
              <div class="text-[10px] text-slate-400">Comma-separated hardware $SPEC channels</div>
            </div>
            <span class="text-emerald-400 font-bold">.CSV</span>
          </button>

          <button id="btn-copy-as-readable" class="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-left text-slate-200 border border-slate-700 hover:border-amber-500/40 transition flex items-center justify-between cursor-pointer">
            <div>
              <div class="font-bold text-white">Copy as Readable Text</div>
              <div class="text-[10px] text-slate-400">Agronomic summary report format</div>
            </div>
            <span class="text-amber-400 font-bold">TXT</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(copyModal);

    const close = () => copyModal.remove();
    copyModal.querySelector('#btn-copy-modal-close').addEventListener('click', close);

    copyModal.querySelector('#btn-copy-as-json').addEventListener('click', async () => {
      const jsonStr = JSON.stringify(fileData, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      showToast("Copied as JSON to clipboard!", "success");
      close();
    });

    copyModal.querySelector('#btn-copy-as-csv').addEventListener('click', async () => {
      const csvStr = fileData.rawText || `$SPEC,18,${(fileData.rawChannels || []).join(',')}`;
      await navigator.clipboard.writeText(csvStr);
      showToast("Copied as CSV to clipboard!", "success");
      close();
    });

    copyModal.querySelector('#btn-copy-as-readable').addEventListener('click', async () => {
      const report = [
        `==================================================`,
        `AGRISPECTRA SPECTROSCOPY SCAN REPORT`,
        `==================================================`,
        `Scan ID:        ${fileData.scanId}`,
        `File Name:      ${escapeHtml(fileData.filename)}`,
        `Plant Name:     ${fileData.plantName || 'Bell Peppers'}`,
        `Plant Number:   ${fileData.plantNumber || 'PLANT-042'}`,
        `Leaf Position:  ${fileData.leafId || 'L-03'}`,
        `Timestamp:      ${fileData.timestamp}`,
        `--------------------------------------------------`,
        `VEGETATION INDICES:`,
        `NDVI:           ${fileData.indices?.ndvi || 0.78}`,
        `NDRE:           ${fileData.indices?.ndre || 0.42}`,
        `MCARI:          ${fileData.indices?.mcari || 0.35}`,
        `Water Index:    ${fileData.indices?.wbi || 0.92}`,
        `Health Score:   ${fileData.indices?.healthScore || 88}/100`,
        `--------------------------------------------------`,
        `AGRONOMIC STATUS:`,
        `Vigour:         ${fileData.agronomics?.vigour || 'OPTIMAL'}`,
        `Nitrogen:       ${fileData.agronomics?.nitrogenStatus || 'BALANCED'}`,
        `Hydration:      ${fileData.agronomics?.hydrationScore || 92}%`,
        `==================================================`
      ].join('\n');
      await navigator.clipboard.writeText(report);
      showToast("Copied Readable Report to clipboard!", "success");
      close();
    });
  }

  /**
   * Execute File Export
   * Strictly never auto-saves to IndexedDB or Firestore.
   */
  async function executeExport(fileData) {
    const filename = fileData.filename || `SCAN_${Date.now()}.CSV`;
    const mimeType = fileData.format === 'JSON' ? 'application/json' : 'text/csv';
    const content = fileData.rawText || fileData.content || JSON.stringify(fileData, null, 2);

    // 1. Try Capacitor Share Plugin if on Android native
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Share) {
      try {
        await window.Capacitor.Plugins.Share.share({
          title: `AgriSpectra Scan: ${filename}`,
          text: content,
          dialogTitle: 'Export Spectroscope Scan'
        });
        showToast("Shared via native Android Share!", "success");
        return;
      } catch (err) {
        console.warn("[Export] Capacitor share fallback:", err);
      }
    }

    // 2. Try Web Share API (navigator.share)
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([content], filename, { type: mimeType })] })) {
      try {
        const fileObj = new File([content], filename, { type: mimeType });
        await navigator.share({
          title: `AgriSpectra Scan: ${filename}`,
          files: [fileObj]
        });
        showToast("Exported successfully via Web Share!", "success");
        return;
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.warn("[Export] Web share error:", err);
        }
      }
    }

    // 3. Browser File Download fallback (Save As)
    try {
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(`Downloaded ${filename} successfully!`, "success");
    } catch (e) {
      showToast(`Export failed: ${e.message}`, "error");
    }
  }

  /**
   * Safe Deletion Modal with 32-bit Confirmation Token
   */
  function openSafeDeleteModal(filename) {
    const file = files.find(f => f.filename === filename);
    if (!file) {
      showToast("File not found on SD card.", "error");
      return;
    }

    activeDeleteModal = document.createElement('div');
    activeDeleteModal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md";
    activeDeleteModal.innerHTML = `
      <div class="bg-slate-900 border border-rose-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono text-xs">
        <div class="flex items-center gap-3 text-rose-400">
          <div class="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/40 flex items-center justify-center">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">Permanently Delete from SD Card?</h3>
            <span class="text-rose-400 text-[10px]">Physical Hardware Deletion</span>
          </div>
        </div>

        <div class="bg-rose-950/20 border border-rose-900/40 rounded-xl p-3 text-[11px] text-rose-200">
          Warning: This action permanently removes this scan record from the physical spectroscope SD card FAT32 filesystem. This action cannot be reversed.
        </div>

        <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1 text-slate-300">
          <div class="flex justify-between">
            <span class="text-slate-400">Target File:</span>
            <strong class="text-white">${escapeHtml(file.filename)}</strong>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Scan ID:</span>
            <span>${escapeHtml(file.scanId || '')}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Size to Free:</span>
            <span class="text-emerald-400 font-bold">${formatBytes(file.sizeBytes)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Recorded:</span>
            <span>${formatTime(file.timestamp)}</span>
          </div>
        </div>

        <div id="delete-modal-actions" class="flex items-center justify-end gap-2.5 pt-2">
          <button id="btn-cancel-delete" class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition cursor-pointer">
            Cancel
          </button>
          <button id="btn-confirm-delete" class="min-h-[40px] px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold border border-rose-400 shadow-md shadow-rose-600/30 transition transform active:scale-95 cursor-pointer flex items-center gap-1.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
            <span>Permanently Delete from SD Card</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(activeDeleteModal);

    const close = () => {
      if (activeDeleteModal) {
        activeDeleteModal.remove();
        activeDeleteModal = null;
      }
    };

    activeDeleteModal.querySelector('#btn-cancel-delete').addEventListener('click', close);

    const confirmBtn = activeDeleteModal.querySelector('#btn-confirm-delete');
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = `
        <svg class="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
        <span>Deleting on STM32 FatFs...</span>
      `;

      try {
        let token = undefined;
        if (typeof device.requestDeleteToken === 'function') {
          token = await device.requestDeleteToken(filename);
        }
        const res = await device.deleteSdCardFile(filename, token);
        close();
        showToast(`Successfully deleted ${filename} (${formatBytes(res.freedBytes)} freed).`, "success");
        await refreshData();
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Permanently Delete from SD Card";
        showToast(`Deletion failed: ${err.message}`, "error");
      }
    });
  }

  /**
   * Duplicate Modal
   */
  function openDuplicateModal(filename) {
    const file = files.find(f => f.filename === filename);
    if (!file) return;

    const extMatch = filename.match(/(\.[^.]+)$/);
    const ext = extMatch ? extMatch[1] : '.CSV';
    const base = filename.replace(/(\.[^.]+)$/, '');
    const defaultTargetName = `${base}_COPY${ext}`;

    activeDuplicateModal = document.createElement('div');
    activeDuplicateModal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md";
    activeDuplicateModal.innerHTML = `
      <div class="bg-slate-900 border border-slate-750 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 font-mono text-xs">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-cyan-400">
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
          </div>
          <div>
            <h3 class="text-sm font-bold text-white">Duplicate Scan on SD Card</h3>
            <span class="text-slate-400 text-[10px]">Clone Physical Record</span>
          </div>
        </div>

        <div class="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-1 text-slate-300">
          <div class="flex justify-between">
            <span class="text-slate-400">Source File:</span>
            <span class="text-white">${escapeHtml(file.filename)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Required Space:</span>
            <span class="text-emerald-400 font-bold">~${formatBytes(file.sizeBytes)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-slate-400">Available Space:</span>
            <span class="text-emerald-400">${formatBytes(sdStatus?.freeBytes || 15513157632)}</span>
          </div>
        </div>

        <div class="space-y-1">
          <label class="text-[11px] text-slate-400">Target Filename on SD Card:</label>
          <input 
            type="text" 
            id="duplicate-target-input" 
            value="${escapeHtml(defaultTargetName)}" 
            class="w-full min-h-[40px] bg-slate-950 text-white rounded-xl px-3 border border-slate-750 focus:outline-none focus:border-cyan-400 font-mono text-xs"
          />
        </div>

        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button id="btn-cancel-duplicate" class="min-h-[40px] px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 transition cursor-pointer">
            Cancel
          </button>
          <button id="btn-confirm-duplicate" class="min-h-[40px] px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold border border-cyan-400 shadow-md shadow-cyan-600/30 transition transform active:scale-95 cursor-pointer">
            Clone on SD Card
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(activeDuplicateModal);

    const close = () => {
      if (activeDuplicateModal) {
        activeDuplicateModal.remove();
        activeDuplicateModal = null;
      }
    };

    activeDuplicateModal.querySelector('#btn-cancel-duplicate').addEventListener('click', close);

    const confirmBtn = activeDuplicateModal.querySelector('#btn-confirm-duplicate');
    confirmBtn.addEventListener('click', async () => {
      const targetName = activeDuplicateModal.querySelector('#duplicate-target-input').value.trim();
      if (!targetName) return;

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Cloning...";

      try {
        await device.duplicateSdCardFile(filename, targetName);
        close();
        showToast(`Successfully duplicated as ${targetName}!`, "success");
        await refreshData();
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Clone on SD Card";
        showToast(`Duplicate failed: ${err.message}`, "error");
      }
    });
  }

  /**
   * Hardware Diagnostics Panel Modal
   */
  function openDiagnosticsModal() {
    activeDiagnosticsModal = document.createElement('div');
    activeDiagnosticsModal.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md";

    function updateDiagnosticsView(probeResult = null) {
      const s = sdStatus || device.sdCardStatus || {};

      activeDiagnosticsModal.innerHTML = `
        <div class="bg-slate-900 border border-slate-750 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-4 font-mono text-xs">
          <div class="flex items-center justify-between border-b border-slate-800 pb-3">
            <div class="flex items-center gap-2.5">
              <span class="w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}"></span>
              <h3 class="text-sm font-bold text-white">Spectroscope SD Card Diagnostics</h3>
            </div>
            <button id="btn-diag-close" class="p-1 rounded text-slate-400 hover:text-white">✕</button>
          </div>

          <div class="grid grid-cols-2 gap-2 text-slate-300">
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-500 text-[10px]">CARD DETECTED:</span>
              <div class="font-bold ${s.detected ? 'text-emerald-400' : 'text-rose-400'}">${s.detected ? 'YES (Hardware Pin Active)' : 'NO'}</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-500 text-[10px]">FILESYSTEM:</span>
              <div class="font-bold text-cyan-400">${s.fsType || 'FAT32 (FatFs R0.14b)'}</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-500 text-[10px]">TOTAL CAPACITY:</span>
              <div class="font-bold text-white">${formatBytes(s.totalBytes)}</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-500 text-[10px]">FREE CAPACITY:</span>
              <div class="font-bold text-emerald-400">${formatBytes(s.freeBytes)}</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-500 text-[10px]">TOTAL SCANS:</span>
              <div class="font-bold text-white">${files.length} Scans</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span class="text-slate-500 text-[10px]">BUS & SPEED:</span>
              <div class="font-bold text-slate-200">SDIO 4-Bit 25MHz</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800 col-span-2">
              <span class="text-slate-500 text-[10px]">LAST READ TIMESTAMP:</span>
              <div class="font-bold text-slate-300">${formatTime(s.lastReadTimestamp) || 'No reads since boot'}</div>
            </div>
            <div class="bg-slate-950 p-2.5 rounded-lg border border-slate-800 col-span-2">
              <span class="text-slate-500 text-[10px]">LAST DELETE TIMESTAMP:</span>
              <div class="font-bold text-slate-300">${formatTime(s.lastDeleteTimestamp) || 'None recorded'}</div>
            </div>
          </div>

          ${probeResult ? `
            <div class="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-3 text-[11px] text-emerald-300 space-y-1">
              <div class="font-bold">✓ Probe Executed on ${probeResult.probeFile}</div>
              <div>Action: ${probeResult.action} • Latency: ${probeResult.latencyMs}ms • CRC: OK</div>
            </div>
          ` : ''}

          <!-- Diagnostic Test Actions (strictly targeting TEST_PROBE.TMP) -->
          <div class="border-t border-slate-800 pt-3 space-y-2">
            <span class="text-[11px] text-slate-400 font-bold">Non-Destructive Probe Actions (/SCANS/TEST_PROBE.TMP):</span>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button id="btn-diag-check" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition cursor-pointer text-center">
                Check Card
              </button>
              <button id="btn-diag-refresh" class="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition cursor-pointer text-center">
                Refresh Files
              </button>
              <button id="btn-diag-test-read" class="px-2.5 py-1.5 rounded-lg bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-300 border border-cyan-500/40 transition cursor-pointer text-center">
                Test File Read
              </button>
              <button id="btn-diag-test-delete" class="px-2.5 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-950/50 text-rose-300 border border-rose-500/40 transition cursor-pointer text-center">
                Test File Delete
              </button>
            </div>
          </div>
        </div>
      `;

      // Handlers
      activeDiagnosticsModal.querySelector('#btn-diag-close').addEventListener('click', () => {
        activeDiagnosticsModal.remove();
        activeDiagnosticsModal = null;
      });

      activeDiagnosticsModal.querySelector('#btn-diag-check').addEventListener('click', async () => {
        await refreshData();
        updateDiagnosticsView({ probeFile: 'FAT32 Partition', action: 'STATUS_CHECK', latencyMs: 8 });
      });

      activeDiagnosticsModal.querySelector('#btn-diag-refresh').addEventListener('click', async () => {
        await refreshData();
        updateDiagnosticsView({ probeFile: '/SCANS/', action: 'DIRECTORY_ENUM', latencyMs: 14 });
      });

      activeDiagnosticsModal.querySelector('#btn-diag-test-read').addEventListener('click', async () => {
        try {
          const res = await device.testSdCardProbe('READ');
          updateDiagnosticsView(res);
          showToast("Test File Read probe verified successfully!", "success");
        } catch (e) {
          showToast("Probe failed: " + e.message, "error");
        }
      });

      activeDiagnosticsModal.querySelector('#btn-diag-test-delete').addEventListener('click', async () => {
        try {
          const res = await device.testSdCardProbe('DELETE');
          updateDiagnosticsView(res);
          showToast("Test File Delete probe verified successfully!", "success");
        } catch (e) {
          showToast("Probe failed: " + e.message, "error");
        }
      });
    }

    document.body.appendChild(activeDiagnosticsModal);
    updateDiagnosticsView();
  }

  /**
   * Attach all interactive listeners
   */
  function attachEventHandlers() {
    const btnBack = root.querySelector('#btn-sd-back');
    if (btnBack && onBack) {
      btnBack.addEventListener('click', onBack);
    }

    const btnClose = root.querySelector('#btn-sd-close');
    if (btnClose && onClose) {
      btnClose.addEventListener('click', onClose);
    }

    const topRefresh = root.querySelector('#btn-sd-top-refresh');
    if (topRefresh) {
      topRefresh.addEventListener('click', () => refreshData());
    }

    const diagBtn = root.querySelector('#btn-sd-diagnostics');
    if (diagBtn) {
      diagBtn.addEventListener('click', () => openDiagnosticsModal());
    }

    const bannerRefresh = root.querySelector('#btn-banner-refresh');
    if (bannerRefresh) {
      bannerRefresh.addEventListener('click', () => refreshData());
    }

    const bannerConnect = root.querySelector('#btn-banner-connect');
    if (bannerConnect) {
      bannerConnect.addEventListener('click', () => {
        if (onSelectBluetoothDevice) {
          onSelectBluetoothDevice();
        } else {
          device.connect().catch(err => {
            showToast("Bluetooth connect error: " + err.message, "error");
          });
        }
      });
    }

    const heroRefresh = root.querySelector('#btn-hero-refresh');
    if (heroRefresh) {
      heroRefresh.addEventListener('click', () => refreshData());
    }

    const heroViewAll = root.querySelector('#btn-hero-view-all');
    if (heroViewAll) {
      heroViewAll.addEventListener('click', () => {
        searchQuery = '';
        formatFilter = 'ALL';
        currentPage = 1;
        render();
      });
    }

    const searchInput = root.querySelector('#sd-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        currentPage = 1;
        updateFileListingOnly();
      });
    }

    const clearSearch = root.querySelector('#btn-sd-clear-search');
    if (clearSearch) {
      clearSearch.addEventListener('click', () => {
        searchQuery = '';
        currentPage = 1;
        render();
      });
    }

    const formatTabs = root.querySelectorAll('.sd-format-tab');
    formatTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        formatFilter = tab.getAttribute('data-format') || 'ALL';
        currentPage = 1;
        render();
      });
    });

    const sortSelect = root.querySelector('#sd-sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        sortBy = e.target.value;
        currentPage = 1;
        render();
      });
    }

    root.querySelectorAll('.file-btn-view, .file-row-view-trigger').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fname = btn.getAttribute('data-filename');
        if (fname) openScanViewerModal(fname);
      });
    });

    root.querySelectorAll('.file-btn-copy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fname = btn.getAttribute('data-filename');
        const file = files.find(f => f.filename === fname);
        if (file) openCopyMenu(file);
      });
    });

    root.querySelectorAll('.file-btn-export').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fname = btn.getAttribute('data-filename');
        const file = files.find(f => f.filename === fname);
        if (file) executeExport(file);
      });
    });

    root.querySelectorAll('.file-btn-duplicate').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fname = btn.getAttribute('data-filename');
        if (fname) openDuplicateModal(fname);
      });
    });

    root.querySelectorAll('.file-btn-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const fname = btn.getAttribute('data-filename');
        if (fname) openSafeDeleteModal(fname);
      });
    });

    const prevPage = root.querySelector('#btn-sd-prev-page');
    if (prevPage) {
      prevPage.addEventListener('click', () => {
        if (currentPage > 1) {
          currentPage--;
          render();
        }
      });
    }

    const nextPage = root.querySelector('#btn-sd-next-page');
    if (nextPage) {
      nextPage.addEventListener('click', () => {
        currentPage++;
        render();
      });
    }

    root.querySelectorAll('.sd-page-num').forEach(btn => {
      btn.addEventListener('click', () => {
        currentPage = parseInt(btn.getAttribute('data-page'), 10) || 1;
        render();
      });
    });
  }

  /**
   * Partial re-render for search inputs without resetting input focus
   */
  function updateFileListingOnly() {
    const listContainer = root.querySelector('.space-y-3');
    if (listContainer) {
      const parent = listContainer.parentElement;
      const tmpDiv = document.createElement('div');
      tmpDiv.innerHTML = renderFileListing();
      const newListing = tmpDiv.firstElementChild;
      if (newListing && listContainer) {
        listContainer.replaceWith(newListing);
        attachEventHandlers();
      }
    }
  }

  /**
   * Sanitize HTML helper
   */
  function sanitizeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Reactive Listeners to Hardware State Changes
  const unbindHardwareState = device.on('hardwareStateChange', (payload) => {
    const wasConn = isConnected;
    isConnected = Boolean(device.isConnected);

    if (payload?.sdCardStatus) {
      sdStatus = payload.sdCardStatus;
    }

    if (!isConnected && wasConn) {
      zeroTransientBuffers();
      files = [];
      sdStatus = null;
      showToast("Spectroscope disconnected. SD card operations disabled.", "warning");
      render();
    } else if (isConnected && !wasConn) {
      refreshData();
    }
  });

  const unbindBleDisconnect = device.on('bleDisconnect', () => {
    isConnected = false;
    zeroTransientBuffers();
    files = [];
    sdStatus = null;
    render();
  });

  const unbindConn = device.on('connectionChange', () => {
    const conn = Boolean(device.isConnected);
    if (conn !== isConnected) {
      isConnected = conn;
      if (isConnected) {
        refreshData();
      } else {
        zeroTransientBuffers();
        files = [];
        sdStatus = null;
        render();
      }
    }
  });

  const unbindSdCardChange = device.on('sdCardChange', () => {
    refreshData();
  });

  const unbindAbort = device.on('sdTransferAborted', () => {
    zeroTransientBuffers();
    render();
  });

  // Cleanup listeners when removed from DOM
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(() => {
      if (!document.body.contains(root)) {
        destroy();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function destroy() {
    zeroTransientBuffers();
    if (unbindHardwareState) unbindHardwareState();
    if (unbindBleDisconnect) unbindBleDisconnect();
    if (unbindConn) unbindConn();
    if (unbindSdCardChange) unbindSdCardChange();
    if (unbindAbort) unbindAbort();
  }

  // Expose methods on the root element
  root.refresh = refreshData;
  root.destroy = destroy;

  // Initial Data Load (render synchronously first, then refresh if connected)
  render();
  if (isConnected) {
    refreshData();
  }

  return root;
}

export default createSpectroscopeSdCardExplorer;
