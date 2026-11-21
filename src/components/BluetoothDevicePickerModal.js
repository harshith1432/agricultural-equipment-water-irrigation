/**
 * AgriSpectra BluetoothDevicePickerModal Component (White & Green Theme)
 * High-clarity mobile Bluetooth scanner:
 * - Always shows meaningful device names and prioritizes named spectroscope hardware
 * - Zero jumping on scroll: card expands smoothly in place without resetting scroll position
 * - MAC address formatted with full-width key-value rows so it never overflows
 * - Clean white and emerald-green theme with no unnecessary banner text
 */

import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { escapeHtml } from '../utils/sanitizer.js';

export function getInitialBlePresets() {
  const presets = [];
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem) {
      const raw = localStorage.getItem('agri_last_spectro_device');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved && (saved.id || saved.deviceId || saved.mac)) {
          presets.push({
            ...saved,
            isRemembered: true,
            recommended: true,
            rssi: saved.rssi || -55
          });
        }
      }
    }
  } catch (e) {
    console.warn('[BLE] Could not parse remembered spectroscope:', e);
  }

  // Pre-seed default BlueNRG_Chat spectroscope if not already present
  if (!presets.some(p => p.isBlueNrg || /bluenrg|chat/i.test(p.name || ''))) {
    presets.push({
      id: '02:80:E1:00:00:AA',
      deviceId: '02:80:E1:00:00:AA',
      name: 'BlueNRG_Chat (Spectroscope)',
      mac: '02:80:E1:00:00:AA',
      isBlueNrg: true,
      recommended: true,
      rssi: -58,
      type: 'STMicroelectronics B-L475E-IOT01A2 Spectroscope'
    });
  }
  return presets;
}

export const DEFAULT_BLE_PRESETS = getInitialBlePresets();

export function enrichDevice(dev) {
  if (!dev) return dev;
  let name = (dev.name || dev.localName || '').trim();
  const mac = dev.mac || dev.deviceId || dev.id || '';
  const id = dev.id || dev.deviceId || '';
  const macUpper = String(mac || id).toUpperCase();
  const last4 = macUpper.replace(/[^A-F0-9]/g, '').slice(-4);
  const last4Fmt = last4.length === 4 ? `${last4.slice(0, 2)}:${last4.slice(2)}` : (last4 || 'BLE');
  const isRemembered = Boolean(dev.isRemembered || dev.remembered);

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
    isRemembered,
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
    if (!rssi && rssi !== 0) return { label: 'Signal: Detecting', color: 'text-slate-400', bars: 1 };
    if (rssi >= -65) return { label: `${rssi} dBm (Strong)`, color: 'text-emerald-700 font-bold', bars: 4 };
    if (rssi >= -80) return { label: `${rssi} dBm (Good)`, color: 'text-emerald-600 font-medium', bars: 3 };
    return { label: `${rssi} dBm (Weak)`, color: 'text-amber-600', bars: 2 };
  }

  // Build static modal frame once
  modal.innerHTML = `
    <!-- Clean White & Green Modal Header -->
    <div class="flex items-center justify-between pb-3 border-b border-emerald-100">
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-sm">
          <svg id="ble-header-icon" class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/>
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Bluetooth Devices
            </h2>
            <div id="ble-status-badge-container"></div>
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

    <!-- Controls: Search & Re-Scan Button -->
    <div class="flex items-center gap-2">
      <div class="relative flex-1">
        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input 
          type="text" 
          id="ble-search-input" 
          placeholder="Search by device name or MAC..."
          class="w-full pl-9 pr-3 py-2 bg-slate-50 hover:bg-white text-xs rounded-xl border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white transition"
        />
      </div>

      <button 
        id="btn-ble-rescan"
        class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 transition active:scale-95 shrink-0 cursor-pointer shadow-sm"
      >
        <svg id="ble-rescan-icon" class="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 21h5v-5"/></svg>
        <span id="ble-rescan-text">Re-scan</span>
      </button>
    </div>

    <!-- Discovered Devices List Container (Scrollable) -->
    <div id="ble-devices-list-container" class="flex-1 overflow-y-auto space-y-2.5 min-h-[240px] max-h-[420px] pr-0.5"></div>
  `;

  const listContainer = modal.querySelector('#ble-devices-list-container');
  const statusBadgeContainer = modal.querySelector('#ble-status-badge-container');
  const rescanBtn = modal.querySelector('#btn-ble-rescan');
  const rescanIcon = modal.querySelector('#ble-rescan-icon');
  const rescanText = modal.querySelector('#ble-rescan-text');
  const headerIcon = modal.querySelector('#ble-header-icon');
  const searchInput = modal.querySelector('#ble-search-input');

  function updateHeaderState(deviceCount) {
    if (isScanning) {
      headerIcon.classList.add('animate-pulse');
      rescanIcon.classList.add('animate-spin');
      rescanBtn.disabled = true;
      rescanText.textContent = 'Scanning...';
      statusBadgeContainer.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-ping"></span>
          Scanning...
        </span>
      `;
    } else {
      headerIcon.classList.remove('animate-pulse');
      rescanIcon.classList.remove('animate-spin');
      rescanBtn.disabled = false;
      rescanText.textContent = 'Re-scan';
      statusBadgeContainer.innerHTML = `
        <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
          ${deviceCount} found
        </span>
      `;
    }
  }

  function renderList(targetToScrollIntoView = null) {
    // Preserve scroll position so tapping never jumps to top
    const prevScrollTop = listContainer.scrollTop;

    const enrichedList = discoveredDevices.map(enrichDevice);

    // Prioritization:
    // 1. Currently connected device
    // 2. ST BlueNRG & Remembered Spectroscopes at top
    // 3. nRF Spectroscopes
    // 4. Real named peripherals (e.g. OnePlus, Printers, named devices)
    // 5. Generic unnamed beacons
    // 6. Signal strength (RSSI)
    enrichedList.sort((a, b) => {
      const aIsConn = leafClipDevice.isConnected && (leafClipDevice.deviceInfo?.id === (a.id || a.deviceId || a.mac));
      const bIsConn = leafClipDevice.isConnected && (leafClipDevice.deviceInfo?.id === (b.id || b.deviceId || b.mac));
      if (aIsConn && !bIsConn) return -1;
      if (!aIsConn && bIsConn) return 1;

      if ((a.isBlueNrg || a.isRemembered) && !(b.isBlueNrg || b.isRemembered)) return -1;
      if (!(a.isBlueNrg || a.isRemembered) && (b.isBlueNrg || b.isRemembered)) return 1;

      if (a.isBlueNrg && !b.isBlueNrg) return -1;
      if (!a.isBlueNrg && b.isBlueNrg) return 1;
      if (a.isNrf && !b.isNrf) return -1;
      if (!a.isNrf && b.isNrf) return 1;
      const aGeneric = /Bluetooth Device|BLE Peripheral|Smart Sensor|Wireless Tracker/i.test(a.name);
      const bGeneric = /Bluetooth Device|BLE Peripheral|Smart Sensor|Wireless Tracker/i.test(b.name);
      if (!aGeneric && bGeneric) return -1;
      if (aGeneric && !bGeneric) return 1;
      return (Number(b.rssi) || -100) - (Number(a.rssi) || -100);
    });

    const filtered = enrichedList.filter(dev => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;
      const devName = (dev.name || '').toLowerCase();
      const devMac = (dev.mac || dev.id || '').toLowerCase();
      const devProto = (dev.protocol || '').toLowerCase();
      return devName.includes(q) || devMac.includes(q) || devProto.includes(q);
    });

    updateHeaderState(enrichedList.length);

    listContainer.innerHTML = '';

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
      return;
    }

    filtered.forEach(dev => {
      const devKey = dev.id || dev.deviceId || dev.mac;
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
      card.setAttribute('data-dev-card', devKey);
      card.className = `device-card-item rounded-2xl transition-all duration-200 border ${
        isCurrentConnected
          ? 'bg-emerald-50/70 border-emerald-400 shadow-sm'
          : (isExpanded 
              ? 'bg-emerald-50/40 border-emerald-500 shadow-md ring-2 ring-emerald-500/20' 
              : (dev.isBlueNrg 
                  ? 'bg-white hover:bg-emerald-50/30 border-emerald-300 shadow-sm' 
                  : 'bg-white hover:bg-slate-50 border-slate-200'))
      }`;

      // Card Header row (Tap to toggle expansion)
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
      if (dev.isRemembered && !isCurrentConnected) {
        const memBadge = document.createElement('span');
        memBadge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 shrink-0';
        memBadge.textContent = 'Known (1-Tap)';
        titleRow.appendChild(memBadge);
      }
      if (isCurrentConnected) {
        const badge = document.createElement('span');
        badge.className = 'px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shrink-0';
        badge.textContent = 'Connected';
        titleRow.appendChild(badge);
      }
      infoBox.appendChild(titleRow);

      const macEl = document.createElement('p');
      macEl.className = 'text-[11px] text-slate-500 font-mono mt-0.5 break-all select-all';
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

      // Expanded details (Full width stacked layout - MAC address never goes outside layout)
      if (isExpanded) {
        const expDiv = document.createElement('div');
        expDiv.className = 'px-4 pb-4 pt-1 border-t border-emerald-100 space-y-3 animate-fadeIn';

        const specCard = document.createElement('div');
        specCard.className = 'space-y-2 bg-emerald-50/40 p-3 rounded-xl border border-emerald-100/80 text-xs';

        // Row 1: Device Name
        const r1 = document.createElement('div');
        r1.className = 'flex items-center justify-between gap-3 border-b border-emerald-100/60 pb-1.5';
        r1.innerHTML = '<span class="text-slate-500 text-[11px] font-medium shrink-0">Device Name</span>';
        const r1Val = document.createElement('span');
        r1Val.className = 'text-slate-800 font-bold text-xs text-right break-words';
        r1Val.textContent = dev.name || 'Bluetooth Device';
        r1.appendChild(r1Val);
        specCard.appendChild(r1);

        // Row 2: MAC Address (Full-width, break-all, zero overflow!)
        const r2 = document.createElement('div');
        r2.className = 'flex items-center justify-between gap-3 border-b border-emerald-100/60 pb-1.5';
        r2.innerHTML = '<span class="text-slate-500 text-[11px] font-medium shrink-0">MAC Address</span>';
        const r2Val = document.createElement('span');
        r2Val.className = 'text-slate-800 font-mono text-xs text-right tracking-tight break-all select-all';
        r2Val.textContent = dev.mac || dev.id || '';
        r2.appendChild(r2Val);
        specCard.appendChild(r2);

        // Row 3: Protocol
        const r3 = document.createElement('div');
        r3.className = 'flex items-center justify-between gap-3 border-b border-emerald-100/60 pb-1.5';
        r3.innerHTML = '<span class="text-slate-500 text-[11px] font-medium shrink-0">Protocol</span>';
        const r3Val = document.createElement('span');
        r3Val.className = 'text-emerald-700 font-semibold text-xs text-right';
        r3Val.textContent = dev.protocol || 'ST BlueNRG Chat';
        r3.appendChild(r3Val);
        specCard.appendChild(r3);

        // Row 4: Signal Quality
        const r4 = document.createElement('div');
        r4.className = 'flex items-center justify-between gap-3';
        r4.innerHTML = '<span class="text-slate-500 text-[11px] font-medium shrink-0">Signal Quality</span>';
        const r4Val = document.createElement('span');
        r4Val.className = `${sig.color} text-xs font-semibold text-right`;
        r4Val.textContent = sig.label;
        r4.appendChild(r4Val);
        specCard.appendChild(r4);

        expDiv.appendChild(specCard);

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

        connBtn.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (leafClipDevice.isConnected && (leafClipDevice.deviceInfo?.id === devKey || leafClipDevice.device?.deviceId === devKey)) {
            connBtn.disabled = true;
            connBtn.innerHTML = '<svg class="w-4 h-4 animate-spin text-slate-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-linecap="round"/></svg><span>Resetting spectroscope & disconnecting...</span>';
            try {
              await leafClipDevice.disconnect();
            } catch (err) {
              console.warn('[BLE] Disconnect error:', err);
            }
            renderList();
            return;
          }

          connectingDeviceId = devKey;
          renderList();

          try {
            isScanning = false;
            try {
              if (leafClipDevice.BleClient) await leafClipDevice.BleClient.stopLEScan();
            } catch (_) {}
            const res = await leafClipDevice.connectToDevice(dev);
            connectingDeviceId = null;
            renderList();
            setTimeout(() => {
              closeModal();
              if (onConnected) onConnected(res);
            }, 350);
          } catch (err) {
            connectingDeviceId = null;
            alert("Bluetooth connection failed: " + (err.message || err));
            renderList();
          }
        });

        expDiv.appendChild(connBtn);
        card.appendChild(expDiv);
      }

      // Event listener for expanding card without scrolling to top
      headerRow.addEventListener('click', () => {
        const willExpand = expandedDeviceId !== devKey;
        expandedDeviceId = willExpand ? devKey : null;
        renderList(willExpand ? devKey : null);
      });

      listContainer.appendChild(card);
    });

    // Restore previous scroll position immediately
    listContainer.scrollTop = prevScrollTop;

    // If a card was just clicked to expand, scroll that card into view smoothly
    if (targetToScrollIntoView) {
      setTimeout(() => {
        const targetEl = listContainer.querySelector(`[data-dev-card="${targetToScrollIntoView}"]`);
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 50);
    }
  }

  async function startScan() {
    isScanning = true;
    renderList();

    try {
      const results = await leafClipDevice.scanForDevices((newDev, all) => {
        discoveredDevices = mergeDeviceLists(discoveredDevices, all);
        renderList();
      });
      if (results && results.length > 0) {
        discoveredDevices = mergeDeviceLists(discoveredDevices, results);
      }
    } catch (e) {
      console.warn("[BLE] Scan error:", e);
    } finally {
      isScanning = false;
      renderList();
    }
  }

  function closeModal() {
    overlay.classList.add('opacity-0');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      if (onDismiss) onDismiss();
    }, 200);
  }

  // Header and control event listeners
  modal.querySelector('#btn-close-ble-picker').addEventListener('click', closeModal);

  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderList();
  });

  rescanBtn.addEventListener('click', () => {
    startScan();
  });

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

  renderList();
  startScan();

  return {
    close: closeModal,
    rescan: startScan
  };
}
