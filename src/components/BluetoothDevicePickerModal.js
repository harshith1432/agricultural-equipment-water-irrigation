/**
 * AgriSpectra BluetoothDevicePickerModal Component (White & Green Theme)
 * High-clarity mobile Bluetooth scanner:
 * - Always shows meaningful device names (never "Unknown ...")
 * - Upgrades device names dynamically when scan responses arrive
 * - Click-to-expand details and prominent green Connect button
 */

import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { escapeHtml } from '../utils/sanitizer.js';

export const DEFAULT_BLE_PRESETS = [];

export function enrichDevice(dev) {
  if (!dev) return dev;
  let name = (dev.name || dev.localName || '').trim();
  const mac = dev.mac || dev.deviceId || dev.id || '';
  const id = dev.id || dev.deviceId || '';
  const macUpper = String(mac || id).toUpperCase();
  const last4 = macUpper.replace(/[^A-F0-9]/g, '').slice(-4);
  const last4Fmt = last4.length === 4 ? `${last4.slice(0, 2)}:${last4.slice(2)}` : (last4 || 'BLE');

  const isBlueNrg = Boolean(
    dev.isBlueNrg || 
    /bluenrg/i.test(name) || 
    /chat/i.test(name) || 
    macUpper.startsWith('02:80') || 
    macUpper.includes('02:80:E1') || 
    /b-l475e/i.test(name) ||
    name === 'BlueNRG_Chat'
  );

  const isNrf = !isBlueNrg && Boolean(dev.isNrf || /nrf|nordic/i.test(name));

  if (!name || /unknown/i.test(name)) {
    if (isBlueNrg) {
      name = 'BlueNRG_Chat (Spectroscope)';
    } else if (isNrf) {
      name = 'Nordic nRF Spectroscope';
    } else if (macUpper.startsWith('66:C6:D2')) {
      name = 'L3250 Series Printer';
    } else if (macUpper.startsWith('FF:3B:DC')) {
      name = `IPC Device (${last4Fmt})`;
    } else if (macUpper.startsWith('24:0A') || macUpper.startsWith('30:AE') || macUpper.startsWith('84:F3') || macUpper.startsWith('CC:50') || macUpper.startsWith('70:B8')) {
      name = `ESP32 Controller (${last4Fmt})`;
    } else if (macUpper.startsWith('67:41:46')) {
      name = `OnePlus Device (${last4Fmt})`;
    } else if (macUpper.startsWith('3D:E8:0C')) {
      name = `Wireless Audio (${last4Fmt})`;
    } else if (macUpper.startsWith('26:AD:E7')) {
      name = `BLE Peripheral (${last4Fmt})`;
    } else if (macUpper.startsWith('30:22:C6')) {
      name = `Smart Sensor (${last4Fmt})`;
    } else if (macUpper.startsWith('69:31:17')) {
      name = `Wireless Tracker (${last4Fmt})`;
    } else {
      name = `Bluetooth Device (${last4Fmt})`;
    }
  }

  return {
    ...dev,
    name,
    mac: dev.mac || (isBlueNrg ? '02:80:E1:00:00:AA' : (dev.id || dev.deviceId)),
    isBlueNrg,
    isNrf,
    recommended: isBlueNrg ? true : (dev.recommended !== undefined ? dev.recommended : isNrf),
    protocol: isBlueNrg ? 'ST BlueNRG Chat' : (dev.protocol || (isNrf ? 'Nordic UART (NUS)' : 'Standard BLE GATT')),
    type: dev.type || (isBlueNrg ? 'STMicroelectronics B-L475E-IOT01A2 Spectroscope' : (isNrf ? 'Leaf-Clip Spectroscope' : 'Bluetooth Peripheral'))
  };
}

export function createBluetoothDevicePickerModal({ onConnected, onDismiss } = {}) {
  const overlay = document.createElement('div');
  overlay.id = 'ble-device-picker-modal-overlay';
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-200 animate-fadeIn";

  const modal = document.createElement('div');
  modal.className = "w-full max-w-lg bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-emerald-100 text-slate-800 space-y-4 transform transition-all duration-200 max-h-[92vh] flex flex-col";

  let discoveredDevices = DEFAULT_BLE_PRESETS.map(enrichDevice);
  let isScanning = false;
  let searchQuery = '';
  let connectingDeviceId = null;
  let expandedDeviceId = null;

  function mergeDeviceLists(existing, incoming) {
    const map = new Map();
    existing.forEach(d => {
      const key = d.id || d.deviceId || d.mac;
      map.set(key, enrichDevice(d));
    });
    incoming.forEach(d => {
      const key = d.id || d.deviceId || d.mac;
      const prev = map.get(key);
      const incomingEnriched = enrichDevice(d);
      if (prev) {
        const prevHasGeneric = !prev.name || /unknown|bluetooth device/i.test(prev.name);
        const incomingHasSpecific = incomingEnriched.name && !/unknown|bluetooth device/i.test(incomingEnriched.name);
        map.set(key, {
          ...prev,
          ...incomingEnriched,
          name: incomingHasSpecific ? incomingEnriched.name : (prevHasGeneric ? incomingEnriched.name : prev.name),
          rssi: incomingEnriched.rssi || prev.rssi
        });
      } else {
        map.set(key, incomingEnriched);
      }
    });
    return Array.from(map.values());
  }

  function getSignalBadge(rssi) {
    if (!rssi && rssi !== 0) return { label: 'Unknown', color: 'text-slate-400', bars: 1 };
    if (rssi >= -65) return { label: `${rssi} dBm (Strong)`, color: 'text-emerald-700 font-bold', bars: 4 };
    if (rssi >= -80) return { label: `${rssi} dBm (Good)`, color: 'text-emerald-600 font-medium', bars: 3 };
    return { label: `${rssi} dBm (Weak)`, color: 'text-amber-600', bars: 2 };
  }

  function renderSafeDeviceCards(container, list) {
    container.innerHTML = '';
    list.forEach(dev => {
      const devKey = String(dev.id || dev.deviceId || dev.mac || '');
      const isExpanded = expandedDeviceId === devKey;
      const isConnecting = connectingDeviceId === devKey;
      const isCurrentConnected = leafClipDevice.isConnected && (
        leafClipDevice.deviceInfo?.id === devKey || 
        leafClipDevice.deviceInfo?.deviceId === devKey ||
        leafClipDevice.device?.deviceId === devKey ||
        leafClipDevice.device?.id === devKey
      );
      const sig = getSignalBadge(dev.rssi);

      const card = document.createElement('div');
      card.className = `device-card-item rounded-2xl transition-all duration-200 border ${
        isCurrentConnected
          ? 'bg-emerald-50/70 border-emerald-400 shadow-sm'
          : (isExpanded 
              ? 'bg-emerald-50/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
              : (dev.isBlueNrg 
                  ? 'bg-white hover:bg-emerald-50/30 border-emerald-300 shadow-sm' 
                  : 'bg-white hover:bg-slate-50 border-slate-200'))
      }`;

      // Header row
      const headerRow = document.createElement('div');
      headerRow.className = 'btn-toggle-device-card p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none';
      headerRow.setAttribute('data-dev-toggle', devKey);

      const leftCol = document.createElement('div');
      leftCol.className = 'flex items-center gap-3 min-w-0 flex-1';

      const iconBox = document.createElement('div');
      iconBox.className = `w-9 h-9 rounded-xl ${dev.isBlueNrg ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'} flex items-center justify-center shrink-0 shadow-sm`;
      iconBox.innerHTML = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/></svg>';
      leftCol.appendChild(iconBox);

      const infoBox = document.createElement('div');
      infoBox.className = 'min-w-0 flex-1';

      const titleRow = document.createElement('div');
      titleRow.className = 'flex items-center gap-2 flex-wrap';

      const nameEl = document.createElement('h4');
      nameEl.className = 'text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words';
      nameEl.textContent = dev.name || 'Bluetooth Device';
      titleRow.appendChild(nameEl);

      if (dev.isBlueNrg) {
        const badge = document.createElement('span');
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 shrink-0';
        badge.textContent = 'Spectroscope';
        titleRow.appendChild(badge);
      }
      if (isCurrentConnected) {
        const badge = document.createElement('span');
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shrink-0';
        badge.textContent = 'Connected';
        titleRow.appendChild(badge);
      }
      infoBox.appendChild(titleRow);

      const macEl = document.createElement('p');
      macEl.className = 'text-[11px] text-slate-500 font-mono mt-0.5';
      macEl.textContent = dev.mac || dev.id || '';
      infoBox.appendChild(macEl);

      leftCol.appendChild(infoBox);
      headerRow.appendChild(leftCol);

      // Right signal & chevron
      const rightCol = document.createElement('div');
      rightCol.className = 'flex items-center gap-2 shrink-0';
      
      const sigBadge = document.createElement('div');
      sigBadge.className = `flex items-center gap-1 ${sig.color} text-xs font-mono`;
      sigBadge.setAttribute('title', `Signal: ${sig.label}`);
      sigBadge.innerHTML = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V4"/></svg>';
      const rssiText = document.createElement('span');
      rssiText.textContent = `${Number(dev.rssi) || -60} dBm`;
      sigBadge.appendChild(rssiText);
      rightCol.appendChild(sigBadge);

      const chev = document.createElement('div');
      chev.className = `w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 transition-transform duration-200 ${isExpanded ? 'rotate-180 bg-emerald-100 text-emerald-800' : ''}`;
      chev.innerHTML = '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
      rightCol.appendChild(chev);

      headerRow.appendChild(rightCol);
      card.appendChild(headerRow);

      // Expanded details
      if (isExpanded) {
        const expDiv = document.createElement('div');
        expDiv.className = 'px-4 pb-4 pt-1 border-t border-emerald-100 space-y-3 animate-fadeIn';

        const specGrid = document.createElement('div');
        specGrid.className = 'grid grid-cols-2 gap-2 text-xs bg-white/90 p-3 rounded-xl border border-emerald-100';

        const c1 = document.createElement('div');
        c1.innerHTML = '<span class="text-slate-400 block text-[10px] uppercase font-semibold">Device Name</span>';
        const c1Val = document.createElement('strong');
        c1Val.className = 'text-slate-800 text-xs';
        c1Val.textContent = dev.name || 'Bluetooth Device';
        c1.appendChild(c1Val);
        specGrid.appendChild(c1);

        const c2 = document.createElement('div');
        c2.innerHTML = '<span class="text-slate-400 block text-[10px] uppercase font-semibold">MAC Address</span>';
        const c2Val = document.createElement('strong');
        c2Val.className = 'text-slate-800 font-mono text-xs';
        c2Val.textContent = dev.mac || dev.id || '';
        c2.appendChild(c2Val);
        specGrid.appendChild(c2);

        const c3 = document.createElement('div');
        c3.innerHTML = '<span class="text-slate-400 block text-[10px] uppercase font-semibold">Protocol</span>';
        const c3Val = document.createElement('span');
        c3Val.className = 'text-emerald-700 font-semibold text-xs';
        c3Val.textContent = dev.protocol || 'ST BlueNRG Chat';
        c3.appendChild(c3Val);
        specGrid.appendChild(c3);

        const c4 = document.createElement('div');
        c4.innerHTML = '<span class="text-slate-400 block text-[10px] uppercase font-semibold">Signal Quality</span>';
        const c4Val = document.createElement('span');
        c4Val.className = `${sig.color} text-xs font-semibold`;
        c4Val.textContent = sig.label;
        c4.appendChild(c4Val);
        specGrid.appendChild(c4);

        expDiv.appendChild(specGrid);

        // Connect button
        const connBtn = document.createElement('button');
        connBtn.className = `btn-connect-device w-full py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 active:scale-98 shadow-sm ${
          isCurrentConnected 
            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-default' 
            : (isConnecting 
                ? 'bg-emerald-700 text-white cursor-wait' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer')
        }`;
        connBtn.setAttribute('data-connect-id', devKey);
        if (isConnecting) connBtn.disabled = true;

        const btnSpan = document.createElement('span');
        if (isConnecting) {
          connBtn.innerHTML = '<svg class="w-4 h-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg>';
          btnSpan.textContent = `Connecting to ${dev.name}...`;
        } else if (isCurrentConnected) {
          connBtn.innerHTML = '<svg class="w-4 h-4 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
          btnSpan.textContent = 'Currently Connected • Tap to Disconnect';
        } else {
          connBtn.innerHTML = '<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/></svg>';
          btnSpan.textContent = `Connect to ${dev.name}`;
        }
        connBtn.appendChild(btnSpan);
        expDiv.appendChild(connBtn);

        card.appendChild(expDiv);
      }

      container.appendChild(card);
    });
  }

  function render() {
    const enrichedList = discoveredDevices.map(enrichDevice);

    const filtered = enrichedList.filter(dev => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const devName = (dev.name || '').toLowerCase();
      const devMac = (dev.mac || dev.id || '').toLowerCase();
      const devProto = (dev.protocol || '').toLowerCase();
      return devName.includes(q) || devMac.includes(q) || devProto.includes(q);
    });

    modal.innerHTML = `
      <!-- Clean White & Green Modal Header -->
      <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
        <div class="flex items-center gap-3">
          <div class="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-sm">
            <svg class="w-6 h-6 ${isScanning ? 'animate-pulse' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/>
            </svg>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Bluetooth Devices
              </h2>
              ${isScanning ? `
                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                  Scanning...
                </span>
              ` : `
                <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                  ${enrichedList.length} found
                </span>
              `}
            </div>
            <p class="text-xs text-slate-500">
              Tap a device to view details and connect
            </p>
          </div>
        </div>

        <button 
          type="button"
          id="btn-close-ble-picker"
          class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition cursor-pointer"
          aria-label="Close"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <!-- Controls: Clean Search & Re-Scan Button -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            id="ble-search-input" 
            value="${escapeHtml(searchQuery)}"
            placeholder="Search by device name or MAC..."
            class="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white text-xs rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
          />
        </div>

        <button 
          id="btn-ble-rescan"
          class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer shadow-sm"
          ${isScanning ? 'disabled' : ''}
        >
          <svg class="w-3.5 h-3.5 text-white ${isScanning ? 'animate-spin' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
          <span>${isScanning ? 'Scanning...' : 'Re-scan'}</span>
        </button>
      </div>

      <!-- Discovered Devices List Container (Safe DOM Rendering) -->
      <div id="ble-devices-list-container" class="flex-1 overflow-y-auto no-scrollbar space-y-2.5 min-h-[220px] max-h-[380px] pr-0.5"></div>

      <!-- Footer Info -->
      <div class="pt-2 border-t border-emerald-100 flex items-center justify-between text-xs text-slate-500">
        <span class="flex items-center gap-1.5 font-medium text-emerald-800">
          <span class="w-2 h-2 rounded-full bg-emerald-600"></span>
          ST BlueNRG & nRF Spectroscopes supported
        </span>
        <span>Tap device to connect</span>
      </div>
    `;

    const listContainer = modal.querySelector('#ble-devices-list-container');
    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div class="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <div class="relative w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
            ${isScanning ? `
              <div class="absolute inset-0 rounded-full border border-emerald-400 animate-ping opacity-75"></div>
              <svg class="w-6 h-6 text-emerald-700 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                <path d="M16 21h5v-5"/>
              </svg>
            ` : `
              <svg class="w-6 h-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/>
              </svg>
            `}
          </div>
          <div class="space-y-1">
            <h4 class="text-sm font-bold text-slate-800">
              ${isScanning ? 'Searching for nearby Bluetooth devices...' : 'No Bluetooth devices detected'}
            </h4>
            <p class="text-xs text-slate-500 max-w-xs mx-auto">
              ${isScanning 
                ? 'Keep your spectroscope close and powered on...' 
                : 'Ensure Bluetooth is turned on on your spectroscope and tap Re-scan.'}
            </p>
          </div>
        </div>
      `;
    } else {
      renderSafeDeviceCards(listContainer, filtered);
    }

    // Attach event listeners
    modal.querySelector('#btn-close-ble-picker').addEventListener('click', closeModal);

    const searchInput = modal.querySelector('#ble-search-input');
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      render();
    });

    modal.querySelector('#btn-ble-rescan').addEventListener('click', () => {
      startScan();
    });

    // Toggle card expansion
    modal.querySelectorAll('.btn-toggle-device-card').forEach(elem => {
      elem.addEventListener('click', () => {
        const devKey = elem.getAttribute('data-dev-toggle');
        expandedDeviceId = (expandedDeviceId === devKey ? null : devKey);
        render();
      });
    });

    // Connect button click
    modal.querySelectorAll('.btn-connect-device').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const devKey = btn.getAttribute('data-connect-id');
        const dev = enrichedList.find(d => (d.id === devKey || d.deviceId === devKey || d.mac === devKey));
        if (!dev) return;

        // If already connected, clicking toggles disconnect
        if (leafClipDevice.isConnected && (leafClipDevice.deviceInfo?.id === devKey || leafClipDevice.device?.deviceId === devKey)) {
          leafClipDevice.disconnect();
          render();
          return;
        }

        connectingDeviceId = devKey;
        render();

        try {
          const res = await leafClipDevice.connectToDevice(dev);
          connectingDeviceId = null;
          render();
          setTimeout(() => {
            closeModal();
            if (onConnected) onConnected(res);
          }, 350);
        } catch (err) {
          connectingDeviceId = null;
          alert("Bluetooth connection failed: " + (err.message || err));
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
    }, 200);
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
