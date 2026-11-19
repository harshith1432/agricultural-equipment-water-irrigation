/**
 * AgriSpectra BluetoothDevicePickerModal Component
 * Discovers and pairs with physical or simulated BLE 5.0 spectroscope hardware.
 * Supports:
 *   1. STMicroelectronics BlueNRG BLE Chat (B-L475E-IOT01A2 / SPBTLE-RF)
 *   2. Nordic UART Service (nRF52 / nRF53 / NUS)
 *   3. STMicroelectronics STM32WB55 custom GATT (FFE0 / FFE1)
 *   4. Native Capacitor BLE (@capacitor-community/bluetooth-le)
 *   5. Direct Web Bluetooth API trigger
 */

import { leafClipDevice, BLE_SERVICES } from '../hardware/webBluetoothLeafClip.js';
import { icon } from '../utils/icons.js';
import { escapeHtml } from '../utils/sanitizer.js';

export const DEFAULT_BLE_PRESETS = [];

export function enrichDevice(dev) {
  if (!dev) return dev;
  const name = dev.name || '';
  const mac = dev.mac || dev.deviceId || dev.id || '';
  const id = dev.id || dev.deviceId || '';

  const isBlueNrg = Boolean(
    dev.isBlueNrg || 
    /bluenrg/i.test(name) || 
    /chat/i.test(name) ||
    /02:80/i.test(mac) || 
    /02:80/i.test(id) || 
    /b-l475e/i.test(name) ||
    name === 'BlueNRG_Chat'
  );

  const isNrf = !isBlueNrg && Boolean(dev.isNrf || /nrf|nordic/i.test(name));

  return {
    ...dev,
    name: name || (isBlueNrg ? 'BlueNRG_Chat' : 'Unknown BLE Device'),
    mac: dev.mac || (isBlueNrg ? '02:80:E1:00:00:AA' : (dev.id || dev.deviceId)),
    isBlueNrg,
    isNrf,
    recommended: isBlueNrg ? true : (dev.recommended !== undefined ? dev.recommended : isNrf),
    protocol: isBlueNrg ? 'ST BlueNRG Chat' : (dev.protocol || (isNrf ? 'Nordic UART Service (NUS)' : 'Custom GATT')),
    type: dev.type || (isBlueNrg ? 'STMicroelectronics B-L475E-IOT01A2 (SPBTLE-RF)' : (isNrf ? 'Leaf-Clip Spectroscope' : 'Spectroscope'))
  };
}

export function createBluetoothDevicePickerModal({ onConnected, onDismiss } = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'ble-device-picker-modal-overlay';
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md transition-opacity duration-300 animate-fadeIn";

  const modal = document.createElement('div');
  modal.className = "w-full max-w-xl bg-slate-900 rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-750 text-white space-y-5 transform transition-all duration-300 scale-100 max-h-[90vh] flex flex-col";

  let discoveredDevices = DEFAULT_BLE_PRESETS.map(enrichDevice);
  let isScanning = false;
  let activeFilter = 'ALL'; // 'ALL', 'BLUENRG', 'NRF', 'SPEC'
  let searchQuery = '';
  let connectingDeviceId = null;

  function mergeDeviceLists(existing, incoming) {
    const map = new Map();
    existing.forEach(d => map.set(d.id || d.deviceId || d.mac, enrichDevice(d)));
    incoming.forEach(d => {
      const key = d.id || d.deviceId || d.mac;
      const enriched = enrichDevice(d);
      map.set(key, { ...map.get(key), ...enriched });
    });
    return Array.from(map.values());
  }

  function render() {
    const isNativePlatform = typeof window !== 'undefined' &&
      (window.Capacitor?.isNativePlatform?.() || window.Capacitor?.getPlatform?.() === 'android');
    const enrichedList = discoveredDevices.map(enrichDevice);

    const filtered = enrichedList.filter(dev => {
      const q = searchQuery.trim().toLowerCase();
      const devName = (dev.name || '').toLowerCase();
      const devMac = (dev.mac || dev.id || '').toLowerCase();
      const devProto = (dev.protocol || '').toLowerCase();
      const devType = (dev.type || '').toLowerCase();

      // Search matching: allow searching by bluenrg, chat, st, 02:80, aa, etc.
      const matchesSearch = !q || 
        devName.includes(q) ||
        devMac.includes(q) ||
        devProto.includes(q) ||
        devType.includes(q) ||
        (dev.isBlueNrg && (
          q === 'bluenrg' || 
          q === 'chat' || 
          q === 'st' || 
          q === '02:80' || 
          q === 'aa' ||
          'bluenrg_chat'.includes(q) ||
          '02:80:e1:00:00:aa'.includes(q) ||
          'stmicroelectronics'.includes(q)
        )) ||
        (q === 'st' && (dev.isBlueNrg || devName.includes('st') || devProto.includes('st') || devType.includes('st'))) ||
        (q === 'chat' && (dev.isBlueNrg || devName.includes('chat') || devProto.includes('chat'))) ||
        (q === 'bluenrg' && (dev.isBlueNrg || devName.includes('bluenrg') || devProto.includes('bluenrg'))) ||
        (q === '02:80' && (devMac.includes('02:80') || dev.isBlueNrg)) ||
        (q === 'aa' && (devMac.includes('aa') || dev.isBlueNrg));

      if (!matchesSearch) return false;
      if (activeFilter === 'BLUENRG') return dev.isBlueNrg || devName.includes('bluenrg') || devProto.includes('bluenrg');
      if (activeFilter === 'NRF') return dev.isNrf || devName.includes('nrf') || devName.includes('nordic');
      if (activeFilter === 'SPEC') return devType.includes('spectro') || devName.includes('spec');
      return true;
    });

    const blueNrgCount = enrichedList.filter(d => d.isBlueNrg).length;

    modal.innerHTML = `
      <!-- Modal Header -->
      <div class="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
        <div class="flex items-center gap-3">
          <div class="w-12 h-12 rounded-2xl bg-emeraldGlow/10 border border-emeraldGlow/30 text-emeraldGlow flex items-center justify-center shrink-0 shadow-lg shadow-emeraldGlow/10">
            <svg class="w-6 h-6 text-emeraldGlow ${isScanning ? 'animate-pulse' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-bold text-white tracking-tight">
                Select Bluetooth Spectroscope
              </h2>
              ${isScanning ? `
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emeraldGlow/10 text-emeraldGlow border border-emeraldGlow/30">
                  <span class="w-1.5 h-1.5 rounded-full bg-emeraldGlow animate-ping"></span>
                  Scanning...
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                  ${enrichedList.length} Detected
                </span>
              `}
            </div>
            <p class="text-xs text-slate-400 mt-0.5">
              Connect to ST BlueNRG Chat, Nordic nRF52/nRF53, STM32, or custom BLE spectroscope hardware.
            </p>
          </div>
        </div>

        <button 
          type="button"
          id="btn-close-ble-picker"
          class="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white flex items-center justify-center transition border border-slate-700 cursor-pointer"
          aria-label="Close"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Controls: Search & Re-Scan -->
      <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div class="relative flex-1">
          <svg class="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            id="ble-search-input" 
            value="${escapeHtml(searchQuery)}"
            placeholder="Search by BlueNRG, Chat, ST, 02:80, NRF, MAC..."
            class="w-full pl-9 pr-3 py-2 bg-slate-800/90 text-xs rounded-xl border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-emeraldGlow transition"
          />
        </div>

        <!-- Filter Chips: All, ST BlueNRG, Nordic / nRF, Spectroscopes -->
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button data-filter="ALL" class="ble-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${activeFilter === 'ALL' ? 'bg-emeraldGlow text-slate-950 font-bold shadow-sm shadow-emeraldGlow/20' : 'bg-slate-800 text-slate-400 hover:text-white'}">
            All (${enrichedList.length})
          </button>
          <button data-filter="BLUENRG" class="ble-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer flex items-center gap-1.5 ${activeFilter === 'BLUENRG' ? 'bg-emeraldGlow text-slate-950 font-bold shadow-sm shadow-emeraldGlow/20' : 'bg-slate-800 text-emerald-400 hover:text-white border border-emerald-500/30'}">
            <svg class="w-3.5 h-3.5 text-current shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="4" y="4" width="16" height="16" rx="2"/>
              <rect x="9" y="9" width="6" height="6"/>
              <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>
            </svg>
            <span>ST BlueNRG ${blueNrgCount > 0 ? `(${blueNrgCount})` : ''}</span>
          </button>
          <button data-filter="NRF" class="ble-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${activeFilter === 'NRF' ? 'bg-emeraldGlow text-slate-950 font-bold shadow-sm shadow-emeraldGlow/20' : 'bg-slate-800 text-slate-400 hover:text-white'}">
            Nordic / nRF
          </button>
          <button data-filter="SPEC" class="ble-filter-btn px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium transition cursor-pointer ${activeFilter === 'SPEC' ? 'bg-emeraldGlow text-slate-950 font-bold shadow-sm shadow-emeraldGlow/20' : 'bg-slate-800 text-slate-400 hover:text-white'}">
            Spectroscopes
          </button>
        </div>

        <button 
          id="btn-ble-rescan"
          class="px-3.5 py-2 rounded-xl text-xs font-mono font-bold bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer"
          ${isScanning ? 'disabled' : ''}
        >
          <svg class="w-3.5 h-3.5 text-emeraldGlow ${isScanning ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          <span>${isScanning ? 'Scanning...' : 'Re-scan'}</span>
        </button>
      </div>

      <!-- Discovered Devices List -->
      <div class="flex-1 overflow-y-auto no-scrollbar space-y-2.5 min-h-[220px] max-h-[380px] pr-1">
        ${filtered.length === 0 ? `
          <div class="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <div class="relative w-16 h-16 rounded-full bg-emeraldGlow/10 border border-emeraldGlow/30 text-emeraldGlow flex items-center justify-center shadow-lg shadow-emeraldGlow/10">
              ${isScanning ? `
                <div class="absolute inset-0 rounded-full border border-emeraldGlow/50 animate-ping"></div>
                <div class="absolute -inset-2 rounded-full border border-emeraldGlow/30 animate-pulse"></div>
                <svg class="w-7 h-7 text-emeraldGlow animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M16 21h5v-5"/>
                </svg>
              ` : `
                <svg class="w-7 h-7 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/>
                </svg>
              `}
            </div>
            <div class="space-y-1">
              <h4 class="text-sm font-bold text-white">
                ${isScanning ? 'Scanning for nearby Bluetooth devices...' : 'No Bluetooth devices detected'}
              </h4>
              <p class="text-xs text-slate-400 max-w-xs mx-auto">
                ${isScanning 
                  ? 'Searching for ST BlueNRG_Chat, nRF52/53, or any nearby Bluetooth peripheral. Keep device close.' 
                  : 'Ensure your spectroscope is powered on and Bluetooth/Location is turned on, then tap Re-scan.'}
              </p>
            </div>
          </div>
        ` : filtered.map(dev => {
          const isConnecting = connectingDeviceId === dev.id;
          const isCurrentConnected = leafClipDevice.isConnected && (
            leafClipDevice.deviceInfo?.id === dev.id || 
            leafClipDevice.deviceInfo?.deviceId === dev.id ||
            leafClipDevice.device?.deviceId === dev.id ||
            leafClipDevice.device?.id === dev.id
          );
          const rssiQuality = dev.rssi >= -65 ? 'text-emeraldGlow' : (dev.rssi >= -80 ? 'text-amberPulse' : 'text-slate-500');

          return `
            <div class="p-3.5 rounded-2xl ${
              dev.isBlueNrg 
                ? 'bg-slate-800/95 border-emerald-500/50 shadow-md shadow-emerald-500/10' 
                : (dev.recommended ? 'bg-slate-800/80 border-emeraldGlow/40 shadow-sm shadow-emeraldGlow/5' : 'bg-slate-800/80 border-slate-750')
            } hover:bg-slate-800 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition group">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h4 class="text-xs sm:text-sm font-bold text-white group-hover:text-emeraldGlow transition truncate">
                    ${escapeHtml(dev.name)}
                  </h4>
                  ${dev.isBlueNrg ? `
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm shadow-emerald-500/10">
                      <svg class="w-3.5 h-3.5 text-emerald-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                        <rect x="9" y="9" width="6" height="6"/>
                        <path d="M15 2v2M9 2v2M15 20v2M9 20v2M2 15h2M2 9h2M20 15h2M20 9h2"/>
                      </svg>
                      ST BlueNRG Chat
                    </span>
                  ` : ''}
                  ${dev.isNrf ? `
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      nRF NUS
                    </span>
                  ` : ''}
                  ${dev.recommended ? `
                    <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-teal-500/15 text-teal-300 border border-teal-500/30">
                      Recommended
                    </span>
                  ` : ''}
                </div>

                <div class="flex items-center gap-3 text-[11px] font-mono text-slate-400">
                  <span class="flex items-center gap-1">
                    <span class="text-slate-500">MAC:</span>
                    <strong class="${dev.isBlueNrg ? 'text-emerald-300 font-bold' : 'text-slate-300'}">${escapeHtml(dev.mac || dev.id)}</strong>
                  </span>
                  <span class="text-slate-600">|</span>
                  <span class="flex items-center gap-1">
                    <span class="text-slate-500">Protocol:</span>
                    <span class="${dev.isBlueNrg ? 'text-emerald-300 font-semibold' : 'text-slate-300'}">${escapeHtml(dev.protocol || 'Nordic UART')}</span>
                  </span>
                </div>

                ${dev.type ? `
                  <div class="text-[10px] text-slate-400 font-sans mt-0.5">
                    ${escapeHtml(dev.type)}
                  </div>
                ` : ''}
              </div>

              <!-- Metrics & Connect Action -->
              <div class="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                <!-- Signal & Battery -->
                <div class="flex items-center gap-2.5 text-right font-mono text-[11px]">
                  <div class="flex items-center gap-1 ${rssiQuality}" title="RSSI Signal: ${dev.rssi} dBm">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V4"/></svg>
                    <span>${dev.rssi} dBm</span>
                  </div>
                  ${dev.battery ? `
                    <span class="text-slate-500">|</span>
                    <span class="text-slate-300">${dev.battery}%</span>
                  ` : ''}
                </div>

                <!-- Connect Button -->
                <button 
                  data-connect-id="${escapeHtml(dev.id)}"
                  class="btn-connect-device min-h-[38px] px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                    isCurrentConnected 
                      ? 'bg-emeraldGlow/20 text-emeraldGlow border border-emeraldGlow/40 cursor-default' 
                      : (isConnecting 
                          ? 'bg-slate-700 text-slate-300 cursor-wait' 
                          : 'bg-emeraldGlow hover:bg-emeraldGlow-light text-slate-950 shadow-md shadow-emeraldGlow/20 cursor-pointer')
                  }"
                  ${isConnecting || isCurrentConnected ? 'disabled' : ''}
                >
                  ${isConnecting ? `
                    <svg class="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg>
                    <span>Pairing...</span>
                  ` : (isCurrentConnected ? `
                    <svg class="w-3.5 h-3.5 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>Connected</span>
                  ` : `
                    <span>Connect</span>
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                  `)}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Bottom Platform Bar -->
      <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        ${isNativePlatform ? `
          <div class="flex items-center gap-2 text-xs font-mono text-emerald-400">
            <span class="w-2 h-2 rounded-full bg-emeraldGlow animate-ping"></span>
            <span>Mobile In-App BLE 5.0 Active • Tap Connect to pair directly</span>
          </div>
        ` : `
          <button 
            type="button" 
            id="btn-trigger-web-ble"
            class="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-mono font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/></svg>
            <span>Open Browser Native Bluetooth Chooser</span>
          </button>
        `}

        <span class="text-[11px] font-mono text-slate-400 text-center sm:text-right">
          Direct In-App Pairing with ST BlueNRG Chat & nRF52
        </span>
      </div>
    `;

    // Attach listeners
    modal.querySelector('#btn-close-ble-picker').addEventListener('click', closeModal);

    const searchInput = modal.querySelector('#ble-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    modal.querySelectorAll('.ble-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeFilter = btn.getAttribute('data-filter');
        render();
      });
    });

    modal.querySelector('#btn-ble-rescan').addEventListener('click', () => {
      startScan();
    });

    modal.querySelector('#btn-trigger-web-ble')?.addEventListener('click', async () => {
      try {
        closeModal();
        const res = await leafClipDevice.connect({ forceSimulation: false });
        if (onConnected) onConnected(res);
      } catch (e) {
        console.warn("[BLE] Web Bluetooth native trigger failed:", e);
      }
    });

    modal.querySelectorAll('.btn-connect-device').forEach(btn => {
      btn.addEventListener('click', async () => {
        const devId = btn.getAttribute('data-connect-id');
        const dev = enrichedList.find(d => (d.id === devId || d.deviceId === devId || d.mac === devId));
        if (!dev) return;

        connectingDeviceId = devId;
        render();

        try {
          const res = await leafClipDevice.connectToDevice(dev);
          connectingDeviceId = null;
          render();
          setTimeout(() => {
            closeModal();
            if (onConnected) onConnected(res);
          }, 400);
        } catch (err) {
          connectingDeviceId = null;
          alert("Connection error: " + err.message);
          render();
        }
      });
    });
  }

  async function startScan() {
    isScanning = true;
    render();

    try {
      const results = await leafClipDevice.scanForDevices((newDev, all) => {
        discoveredDevices = mergeDeviceLists(discoveredDevices, all);
        render();
      });
      if (results && results.length > 0) {
        discoveredDevices = mergeDeviceLists(discoveredDevices, results);
      }
    } catch (e) {
      console.warn("[BLE] Scan error:", e);
    } finally {
      isScanning = false;
      render();
    }
  }

  function closeModal() {
    overlay.classList.add('opacity-0');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (onDismiss) onDismiss();
    }, 250);
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      window.removeEventListener('keydown', onKeyDown);
      closeModal();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  render();
  startScan();

  return {
    close: closeModal,
    rescan: startScan
  };
}
