/**
 * Network Connectivity Banner Component
 * Real-time connection status banner for mobile field operations:
 *   - 🟢 Online Synced (Cloud Firestore & Firebase live connection)
 *   - 🟡 Offline Cached (Field worker mode, buffering commands locally)
 *   - 🔵 BLE Direct (Direct Web Bluetooth connection to Handheld Leaf-Clip)
 */
import { icon } from '../utils/icons.js';
import { leafClipDevice } from '../hardware/webBluetoothLeafClip.js';
import { t, onLocaleChange } from '../utils/i18n.js';

export function createNetworkConnectivityBanner() {
  const banner = document.createElement('div');
  banner.id = "network-connectivity-banner";
  banner.className = "w-full transition-all duration-300 z-30 select-none text-xs font-medium";

  let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  let isBleConnected = leafClipDevice.isConnected;
  let offlineQueueCount = getOfflineQueueCount();
  let isExpanded = false;

  function getOfflineQueueCount() {
    try {
      const q = localStorage.getItem('agrispectra_offline_mutation_queue');
      return q ? JSON.parse(q).length : 0;
    } catch (e) {
      return 0;
    }
  }

  function getActiveState() {
    if (isBleConnected) {
      return {
        mode: 'BLE_DIRECT',
        title: t('net_ble_direct'),
        subtitle: t('net_ble_direct_sub'),
        badgeClass: 'bg-teal-500/20 text-teal-200 border-teal-400/40',
        pillColor: 'bg-teal-400',
        iconName: 'bluetooth',
        bgColor: 'bg-teal-950/80 border-b border-teal-800/40 text-teal-100'
      };
    }
    if (!isOnline) {
      return {
        mode: 'OFFLINE_CACHED',
        title: t('net_offline_cached'),
        subtitle: `${t('net_offline_cached_sub')} (${offlineQueueCount} ${t('net_queued')})`,
        badgeClass: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
        pillColor: 'bg-amber-400',
        iconName: 'cloud',
        bgColor: 'bg-amber-950/90 border-b border-amber-800/50 text-amber-100'
      };
    }
    return {
      mode: 'ONLINE_SYNCED',
      title: t('net_online_synced'),
      subtitle: t('net_online_synced_sub'),
      badgeClass: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
      pillColor: 'bg-emerald-400',
      iconName: 'wifi',
      bgColor: 'bg-[#062414] border-b border-emerald-800/40 text-emerald-100'
    };
  }

  function render() {
    const state = getActiveState();

    banner.className = `w-full transition-all duration-300 z-30 select-none text-xs font-medium ${state.bgColor}`;
    banner.innerHTML = `
      <div class="max-w-lg mx-auto px-3.5 py-1.5 flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="relative flex h-2 w-2 flex-shrink-0">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full ${state.pillColor} opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 ${state.pillColor}"></span>
          </span>

          <div class="flex items-center gap-1.5 min-w-0 truncate">
            <span class="font-bold text-[11px] tracking-tight uppercase font-mono">${state.title}</span>
            <span class="text-slate-400 text-[10px] hidden sm:inline truncate">• ${state.subtitle}</span>
          </div>
        </div>

        <div class="flex items-center gap-2 flex-shrink-0">
          ${!isOnline && offlineQueueCount > 0 ? `
            <span class="px-1.5 py-0.5 rounded text-[9.5px] font-mono font-bold bg-amber-400 text-slate-950">
              ${offlineQueueCount} ${t('net_queued')}
            </span>
          ` : ''}

          <button 
            type="button" 
            id="banner-details-btn"
            class="text-[10px] font-semibold underline text-emerald-200 hover:text-white cursor-pointer px-1 py-0.5"
            aria-label="Toggle network diagnostics"
          >
            ${isExpanded ? t('net_hide') : t('net_diagnostics')}
          </button>
        </div>
      </div>

      <!-- Expanded Diagnostics Tray -->
      ${isExpanded ? `
        <div class="max-w-lg mx-auto px-4 py-2.5 border-t border-white/10 bg-black/30 text-[11px] space-y-1.5 animate-fadeIn">
          <div class="flex items-center justify-between">
            <span class="text-slate-300">Cellular / Wi-Fi Network:</span>
            <span class="font-mono font-bold ${isOnline ? 'text-emerald-300' : 'text-amber-300'}">${isOnline ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-300">Bluetooth LE 5.0 Leaf-Clip:</span>
            <span class="font-mono font-bold ${isBleConnected ? 'text-teal-300' : 'text-slate-400'}">${isBleConnected ? 'PAIRED & STREAMING' : 'IDLE / DISCONNECTED'}</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-slate-300">Offline Local Storage Queue:</span>
            <span class="font-mono font-bold text-white">${offlineQueueCount} actions pending upload</span>
          </div>
          <div class="pt-1 flex justify-end">
            <button 
              type="button" 
              id="sync-now-btn"
              class="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold text-[10px] transition cursor-pointer"
            >
              Force Sync Now
            </button>
          </div>
        </div>
      ` : ''}
    `;

    banner.querySelector('#banner-details-btn')?.addEventListener('click', () => {
      isExpanded = !isExpanded;
      render();
    });

    banner.querySelector('#sync-now-btn')?.addEventListener('click', () => {
      offlineQueueCount = 0;
      try {
        localStorage.removeItem('agrispectra_offline_mutation_queue');
      } catch (e) {}
      render();
    });
  }

  // Setup reactive window listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      isOnline = true;
      render();
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      render();
    });

    leafClipDevice.on('connectionChange', ({ status }) => {
      isBleConnected = status === 'CONNECTED';
      render();
    });
  }

  onLocaleChange(() => render());

  render();

  return {
    element: banner,
    updateState: (online, ble) => {
      if (typeof online === 'boolean') isOnline = online;
      if (typeof ble === 'boolean') isBleConnected = ble;
      offlineQueueCount = getOfflineQueueCount();
      render();
    }
  };
}
