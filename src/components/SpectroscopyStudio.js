/**
 * AgriSpectra Handheld Leaf-Clip Spectroscopy Studio
 * Spectral reflectance curve (350-1100 nm), 5 Farmer Agronomic Decisions, Voice TTS,
 * Bluetooth Device Selection & Live Raw Hardware Telemetry Terminal.
 */
import { leafClipDevice, BLE_SERVICES } from '../hardware/webBluetoothLeafClip.js';
import { WAVELENGTHS } from '../hardware/chemometricsEngine.js';
import { ttsEngine } from '../audio/voiceReadoutTTS.js';
import { getVitalityColor } from '../utils/formatters.js';
import { createBluetoothDevicePickerModal } from './BluetoothDevicePickerModal.js';

export function createSpectroscopyStudio({
  plots = [],
  selectedPlotId = "plot-1",
  onAcquireScan,
  onOpenCalibration,
  onSelectBluetoothDevice
}) {
  const container = document.createElement('section');
  container.className = "bg-slate-850/90 backdrop-blur-md rounded-2xl p-5 border border-slate-750/70 shadow-xl space-y-5";

  const selectedPlot = plots.find(p => p.id === selectedPlotId) || plots[0] || {
    id: "plot-1",
    plotNumber: 1,
    crop: "Bell Peppers",
    stage: "Fruit Formation"
  };

  // State management
  let activeTab = 'CURVE'; // 'CURVE' | 'RAW_DATA'
  let isPairing = false;
  let autoScroll = true;
  let formatFilter = 'ALL'; // 'ALL' | 'JSON' | 'CSV' | 'ASCII'
  let rawPackets = [];
  let latestRawChannels = null;
  let latestAnalysis = null;
  let totalBytes = 0;
  let packetsCount = 0;
  let lastPacketTime = null;

  container.innerHTML = `
    <!-- Top Studio Header -->
    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
      <div>
        <div class="flex items-center gap-2 flex-wrap">
          <h2 class="text-base sm:text-lg font-bold text-white flex items-center gap-2">
            <svg class="w-5 h-5 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
              <line x1="12" y1="22.08" x2="12" y2="12"/>
            </svg>
            AgriSpectra Handheld Leaf-Clip Spectroscopy
          </h2>
          <span class="px-2 py-0.5 rounded text-[11px] font-mono bg-emeraldGlow/10 text-emeraldGlow border border-emeraldGlow/30">
            350–1100 nm VIS-NIR
          </span>
        </div>
        <p class="text-xs text-slate-400 mt-0.5">
          Non-destructive in-situ chemometrics, pre-symptomatic physiological screening & raw telemetry inspection.
        </p>
      </div>

      <!-- Quick Action Controls & Bluetooth Status Controls -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- High-Visibility Bluetooth Status & Connect Controls -->
        <div id="ble-header-controls" class="flex items-center gap-2">
          <!-- Will be rendered by updateBluetoothControls() -->
        </div>

        <!-- Target Plot Selector -->
        <div class="min-h-[44px] flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
          <span class="text-xs text-slate-400 font-mono font-medium">Target:</span>
          <select id="spectro-plot-select" class="min-h-[40px] bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer">
            ${plots.map(p => `
              <option value="${p.id}" ${p.id === selectedPlot.id ? 'selected' : ''}>
                Plot ${p.plotNumber}: ${p.crop} (${p.valve?.id || 'G' + p.plotNumber})
              </option>
            `).join('')}
          </select>
        </div>

        <!-- Scan Trigger Button -->
        <button id="spectro-scan-btn" class="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-emeraldGlow to-teal-400 hover:from-emeraldGlow-light hover:to-teal-300 shadow-lg shadow-emeraldGlow/25 border border-emerald-300 transition transform active:scale-95 cursor-pointer">
          <svg class="w-4 h-4 text-slate-950 animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M3 7V5a2 2 0 0 1 2-2h2"/>
            <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
            <path d="M21 17v2a2 2 0 0 1-2 2h-2"/>
            <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
          </svg>
          <span>Acquire Leaf Scan</span>
        </button>
      </div>
    </div>

    <!-- Active Hardware & Calibration Status Sub-Bar -->
    <div id="active-hardware-bar" class="bg-slate-800/80 rounded-xl p-3 border border-slate-750 flex flex-wrap items-center justify-between gap-3 text-xs">
      <!-- Dynamic hardware status -->
    </div>

    <!-- View Mode Tabs: Curve vs Raw Hardware Terminal -->
    <div class="flex items-center justify-between gap-2 border-b border-slate-750 pb-2">
      <div class="flex items-center gap-2">
        <button 
          id="tab-btn-curve" 
          class="px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer ${activeTab === 'CURVE' ? 'bg-emeraldGlow text-slate-950 shadow-md shadow-emeraldGlow/20' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
          <span>Reflectance Curve R(λ) [350–1100 nm]</span>
        </button>

        <button 
          id="tab-btn-raw" 
          class="px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer ${activeTab === 'RAW_DATA' ? 'bg-emeraldGlow text-slate-950 shadow-md shadow-emeraldGlow/20' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'}"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          <span>Raw Hardware Telemetry & Channel Stream</span>
          <span id="tab-raw-counter-badge" class="px-1.5 py-0.2 rounded text-[10px] font-mono ${activeTab === 'RAW_DATA' ? 'bg-slate-950 text-emeraldGlow' : 'bg-emeraldGlow/20 text-emeraldGlow'}">
            0 pkts
          </span>
        </button>
      </div>

      <div class="hidden sm:flex items-center gap-2 text-[11px] font-mono text-slate-400">
        <span class="w-2 h-2 rounded-full ${leafClipDevice.isConnected ? 'bg-emeraldGlow animate-ping' : 'bg-slate-500'}"></span>
        <span id="live-stream-status-text">${leafClipDevice.isConnected ? 'Live Telemetry Active' : 'Sensor Offline'}</span>
      </div>
    </div>

    <!-- TAB 1: 350-1100 nm Spectral Reflectance Canvas Visualizer -->
    <div id="panel-curve-view" class="${activeTab === 'CURVE' ? 'block' : 'hidden'} space-y-4">
      <div class="bg-slate-900/90 rounded-2xl p-4 border border-slate-750 shadow-inner">
        <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">VIS-NIR Absorption Spectroscopy</span>
            <span class="text-[10px] font-mono text-emeraldGlow bg-emeraldGlow/10 px-2 py-0.5 rounded border border-emeraldGlow/30">76 Channels (10nm Pitch)</span>
          </div>
          <div class="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-400">
            <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-blue-400"></span> 450nm Chl-b</span>
            <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-green-400"></span> 550nm Green Peak</span>
            <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-rose-400"></span> 705nm Red Edge</span>
            <span class="flex items-center gap-1"><span class="w-2 h-0.5 bg-cyan-400"></span> 970nm Water Dip</span>
          </div>
        </div>

        <div class="relative w-full h-56 sm:h-64">
          <canvas id="spectral-canvas" class="w-full h-full"></canvas>
        </div>
      </div>
    </div>

    <!-- TAB 2: Live Raw Hardware Data Terminal & Viewer -->
    <div id="panel-raw-view" class="${activeTab === 'RAW_DATA' ? 'block' : 'hidden'} space-y-4">
      <!-- Live Hardware Telemetry Stats Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-750">
          <div class="text-[10px] font-mono uppercase text-slate-400">Total Ingestion</div>
          <div id="raw-metric-bytes" class="text-base font-bold font-mono text-emeraldGlow mt-0.5">0 B</div>
        </div>
        <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-750">
          <div class="text-[10px] font-mono uppercase text-slate-400">Reassembled</div>
          <div id="raw-metric-packets" class="text-base font-bold font-mono text-cyan-400 mt-0.5">0 pkts</div>
        </div>
        <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-750">
          <div class="text-[10px] font-mono uppercase text-slate-400">Negotiated MTU</div>
          <div id="raw-metric-mtu" class="text-base font-bold font-mono text-amberPulse mt-0.5">${leafClipDevice.negotiatedMtu} Bytes</div>
        </div>
        <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-750">
          <div class="text-[10px] font-mono uppercase text-slate-400">Active Protocol</div>
          <div id="raw-metric-protocol" class="text-xs font-bold font-mono text-slate-200 mt-0.5 truncate">${(leafClipDevice.deviceInfo?.model?.includes('BlueNRG') || leafClipDevice.device?.name?.includes('BlueNRG') || leafClipDevice.deviceInfo?.protocol?.includes('BlueNRG')) ? 'ST BlueNRG Chat' : (leafClipDevice.deviceInfo?.protocol?.split(' ')[0] || 'NUS')}</div>
        </div>
        <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-750">
          <div class="text-[10px] font-mono uppercase text-slate-400">Last Telemetry</div>
          <div id="raw-metric-time" class="text-xs font-bold font-mono text-slate-300 mt-0.5">Waiting...</div>
        </div>
        <div class="bg-slate-900/80 rounded-xl p-3 border border-slate-750">
          <div class="text-[10px] font-mono uppercase text-slate-400">Signal RSSI</div>
          <div id="raw-metric-rssi" class="text-xs font-bold font-mono text-emeraldGlow mt-0.5">${leafClipDevice.rssi} dBm</div>
        </div>
      </div>

      <!-- Raw Stream Console / Terminal -->
      <div class="bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
        <!-- Terminal Header & Actions Toolbar -->
        <div class="bg-slate-900/90 px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div class="flex items-center gap-2 font-mono text-xs">
            <span class="w-2.5 h-2.5 rounded-full bg-emeraldGlow ${leafClipDevice.isConnected ? 'animate-pulse' : ''}"></span>
            <span class="font-bold text-white tracking-wider">HARDWARE RX CONSOLE</span>
            <span class="text-slate-500">•</span>
            <span id="hardware-console-model-tag" class="text-slate-400 text-[11px]">${(leafClipDevice.deviceInfo?.model?.includes('BlueNRG') || leafClipDevice.device?.name?.includes('BlueNRG')) ? 'BlueNRG_Chat (ST B-L475E)' : (leafClipDevice.deviceInfo?.model || 'nRF52 Spectroscope')}</span>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Format Filter -->
            <select id="raw-format-filter" class="bg-slate-800 text-slate-200 text-[11px] font-mono px-2 py-1 rounded-lg border border-slate-700 focus:outline-none">
              <option value="ALL">All Formats</option>
              <option value="JSON">JSON Packets</option>
              <option value="CSV">CSV ($SPEC)</option>
              <option value="ASCII">ASCII Status</option>
            </select>

            <!-- Auto-Scroll Toggle -->
            <button id="btn-toggle-autoscroll" class="px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition border flex items-center gap-1 cursor-pointer ${autoScroll ? 'bg-emeraldGlow/15 text-emeraldGlow border-emeraldGlow/40' : 'bg-slate-800 text-slate-400 border-slate-700'}">
              <span>Auto-Scroll:</span>
              <strong class="${autoScroll ? 'text-emeraldGlow' : 'text-slate-400'}">${autoScroll ? 'ON' : 'OFF'}</strong>
            </button>

            <!-- Trigger Test Packet -->
            <button id="btn-trigger-test-packet" class="px-2.5 py-1 rounded-lg text-[11px] font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1 cursor-pointer" title="Inject a simulated hardware packet">
              <svg class="w-3.5 h-3.5 text-teal-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              <span>Test Pkt</span>
            </button>

            <!-- Copy Raw Data Button -->
            <button id="btn-copy-raw-data" class="px-2.5 py-1 rounded-lg text-[11px] font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1 cursor-pointer">
              <svg class="w-3.5 h-3.5 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span id="copy-btn-text">Copy</span>
            </button>

            <!-- Clear Terminal Button -->
            <button id="btn-clear-terminal" class="px-2.5 py-1 rounded-lg text-[11px] font-mono text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-800/40 transition flex items-center gap-1 cursor-pointer">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
              <span>Clear</span>
            </button>
          </div>
        </div>

        <!-- Monospace Raw Data Terminal Window -->
        <div id="raw-terminal-log" class="p-4 font-mono text-xs overflow-y-auto max-h-72 min-h-[220px] space-y-1.5 select-text no-scrollbar bg-slate-950 text-slate-300">
          <div class="text-slate-600 italic">// AgriSpectra BLE 5.0 UART Packet Stream initialized. Waiting for incoming telemetry frames...</div>
        </div>
      </div>

      <!-- Live Raw ADC Intensities & Channel Inspector -->
      <div class="bg-slate-900/90 rounded-2xl p-4 border border-slate-750 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
              Live Raw 16-Bit ADC Channel Matrix [76 Bands • 350–1100 nm]
            </h3>
            <p class="text-[11px] text-slate-400 mt-0.5">
              Direct uncalibrated CMOS detector pixel counts from nRF52840 SPI interface.
            </p>
          </div>

          <div class="flex items-center gap-2 text-[10px] font-mono text-slate-400">
            <span>Range: <strong>0 – 65,535 ADC Counts</strong></span>
            <span>•</span>
            <span class="text-emeraldGlow">Baseline: <strong>~0.02 Dark / ~0.99 White</strong></span>
          </div>
        </div>

        <!-- Channels Grid / Table -->
        <div id="raw-channels-matrix" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-60 overflow-y-auto no-scrollbar p-1">
          <!-- Will be rendered by renderChannelsMatrix() -->
        </div>
      </div>
    </div>

    <!-- 5 FARMER AGRONOMIC DECISION CARDS -->
    <div id="decision-cards-container" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
      <!-- Will be filled dynamically by renderDecisionCards() -->
    </div>
  `;

  // Attach UI Element References
  const bleHeaderControls = container.querySelector('#ble-header-controls');
  const activeHardwareBar = container.querySelector('#active-hardware-bar');
  const plotSelect = container.querySelector('#spectro-plot-select');
  const scanBtn = container.querySelector('#spectro-scan-btn');
  const tabBtnCurve = container.querySelector('#tab-btn-curve');
  const tabBtnRaw = container.querySelector('#tab-btn-raw');
  const panelCurveView = container.querySelector('#panel-curve-view');
  const panelRawView = container.querySelector('#panel-raw-view');
  const rawTerminalLog = container.querySelector('#raw-terminal-log');
  const tabRawCounterBadge = container.querySelector('#tab-raw-counter-badge');
  const rawChannelsMatrix = container.querySelector('#raw-channels-matrix');
  const btnToggleAutoscroll = container.querySelector('#btn-toggle-autoscroll');
  const btnTriggerTestPacket = container.querySelector('#btn-trigger-test-packet');
  const btnCopyRawData = container.querySelector('#btn-copy-raw-data');
  const btnClearTerminal = container.querySelector('#btn-clear-terminal');
  const rawFormatFilter = container.querySelector('#raw-format-filter');

  // Metric nodes
  const rawMetricBytes = container.querySelector('#raw-metric-bytes');
  const rawMetricPackets = container.querySelector('#raw-metric-packets');
  const rawMetricMtu = container.querySelector('#raw-metric-mtu');
  const rawMetricProtocol = container.querySelector('#raw-metric-protocol');
  const rawMetricTime = container.querySelector('#raw-metric-time');
  const rawMetricRssi = container.querySelector('#raw-metric-rssi');

  /**
   * 1. Render Bluetooth Header Controls (Pill + Select Device Button)
   */
  function updateBluetoothControls() {
    const isConn = leafClipDevice.isConnected;
    const isPairing = leafClipDevice.connectionStatus === 'PAIRING';
    const isSim = leafClipDevice.isSimulated;

    const devName = leafClipDevice.device?.name || leafClipDevice.deviceInfo?.model || '';
    const devId = leafClipDevice.device?.id || leafClipDevice.device?.deviceId || leafClipDevice.deviceInfo?.id || '';
    const isBlueNrg = Boolean(
      /bluenrg/i.test(devName) || 
      /bluenrg/i.test(devId) || 
      /02:80/i.test(devId) || 
      devName === 'BlueNRG_Chat' ||
      leafClipDevice.deviceInfo?.protocol?.includes('BlueNRG') ||
      leafClipDevice.deviceInfo?.model?.includes('BlueNRG')
    );

    const defaultModel = isConn ? (isSim ? 'Simulated BLE 5.0' : 'Clip-Pro 500') : 'Spectroscope';
    const rawModel = leafClipDevice.deviceInfo?.model || defaultModel;
    const model = isBlueNrg ? 'BlueNRG_Chat (ST B-L475E)' : rawModel;

    const rawProto = leafClipDevice.deviceInfo?.protocol;
    const protoDisplay = isBlueNrg ? 'ST BlueNRG Chat' : (rawProto || 'NUS');
    const proto = isConn ? `(${isBlueNrg ? 'ST BlueNRG Chat' : protoDisplay.split(' ')[0]})` : '';

    if (rawMetricProtocol) {
      rawMetricProtocol.textContent = protoDisplay;
    }
    const consoleModelTag = container.querySelector('#hardware-console-model-tag');
    if (consoleModelTag) {
      consoleModelTag.textContent = model;
    }

    bleHeaderControls.innerHTML = `
      <!-- High Visibility Status & Connect Button -->
      <button 
        id="btn-ble-main-connect"
        class="min-h-[44px] px-3.5 py-1.5 rounded-xl text-xs font-mono font-bold flex items-center gap-2 border transition cursor-pointer active:scale-95 ${
          isPairing 
            ? 'bg-amber-950/30 text-amberPulse border-amber-500/40 animate-pulse' 
            : (isConn 
                ? 'bg-emeraldGlow/15 hover:bg-emeraldGlow/25 text-emeraldGlow border-emeraldGlow/40 shadow-sm shadow-emeraldGlow/10' 
                : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700')
        }"
        title="${isConn ? 'Click to disconnect' : 'Click to connect Spectroscope'}"
      >
        <span class="w-2.5 h-2.5 rounded-full ${isPairing ? 'bg-amberPulse animate-ping' : (isConn ? 'bg-emeraldGlow animate-pulse' : 'bg-rose-500')}"></span>
        <span class="truncate max-w-[200px]">
          ${isPairing ? 'Pairing BLE...' : (isConn ? `Connected: ${model} ${proto}` : 'BLE: Disconnected')}
        </span>
        ${isConn ? `
          <span class="px-1.5 py-0.5 rounded text-[10px] bg-emeraldGlow/20 text-emerald-300">
            ${leafClipDevice.batteryLevel}%
          </span>
        ` : ''}
      </button>

      <!-- Select Bluetooth Device (Discovers all devices including NRF) -->
      <button 
        id="btn-ble-open-picker"
        class="min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
        title="Scan and select nearby Bluetooth devices (including NRF and ST BlueNRG)"
      >
        <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="7 7 17 17 12 22 12 2 17 7 7 17"/>
        </svg>
        <span class="hidden sm:inline">Select Bluetooth Device</span>
      </button>
    `;

    // Active Hardware Sub-Bar
    activeHardwareBar.innerHTML = `
      <div class="flex items-center gap-3 font-mono flex-wrap">
        <span class="flex items-center gap-1.5 text-slate-300">
          <span class="w-2 h-2 rounded-full ${isConn ? 'bg-emeraldGlow animate-ping' : 'bg-slate-500'}"></span>
          BLE Sensor: <strong class="text-white">${model}</strong>
        </span>
        <span class="text-slate-600">|</span>
        <span class="text-slate-300">
          Optics: <strong class="${leafClipDevice.calibration.isCalibrated ? 'text-emeraldGlow' : 'text-amberPulse'}">
            ${leafClipDevice.calibration.isCalibrated ? '99% PTFE Calibrated' : 'Default Preset'}
          </strong>
        </span>
        <span class="text-slate-600">|</span>
        <span class="text-slate-300">Battery: <strong class="text-emeraldGlow font-mono">${leafClipDevice.batteryLevel}%</strong></span>
        <span class="text-slate-600">|</span>
        <span class="text-slate-300">Protocol: <strong class="text-slate-200 font-mono">${protoDisplay}</strong></span>
      </div>

      <button id="recalibrate-link-btn" class="text-xs text-amberPulse hover:text-amber-300 font-medium flex items-center gap-1 cursor-pointer">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
        Run Dark/White Calibration
      </button>
    `;

    // Reattach header handlers
    const mainConnectBtn = bleHeaderControls.querySelector('#btn-ble-main-connect');
    const openPickerBtn = bleHeaderControls.querySelector('#btn-ble-open-picker');
    const recalibBtn = activeHardwareBar.querySelector('#recalibrate-link-btn');

    if (mainConnectBtn) {
      mainConnectBtn.addEventListener('click', handleMainConnectClick);
    }
    if (openPickerBtn) {
      openPickerBtn.addEventListener('click', handleOpenDevicePicker);
    }
    if (recalibBtn) {
      recalibBtn.addEventListener('click', () => {
        if (onOpenCalibration) onOpenCalibration('FULL');
      });
    }

    const liveStreamText = container.querySelector('#live-stream-status-text');
    if (liveStreamText) {
      liveStreamText.textContent = isConn ? 'Live Telemetry Active' : 'Sensor Offline';
    }
  }

  /**
   * Main Connect Action:
   * - On Web Bluetooth: Triggers leafClipDevice.connect() (launches browser's native Bluetooth device selector)
   * - On Native Capacitor: Opens BluetoothDevicePickerModal
   */
  async function handleMainConnectClick() {
    if (leafClipDevice.isConnected) {
      if (confirm(`Disconnect from ${leafClipDevice.deviceInfo?.model || 'Bluetooth device'}?`)) {
        leafClipDevice.disconnect();
      }
      return;
    }

    if (leafClipDevice.isCapacitor) {
      handleOpenDevicePicker();
      return;
    }

    isPairing = true;
    updateBluetoothControls();

    try {
      await leafClipDevice.connect({ forceSimulation: false });
    } catch (err) {
      console.warn("[BLE] Connect error:", err);
    } finally {
      isPairing = false;
      updateBluetoothControls();
    }
  }

  /**
   * Open Device Picker Modal (Lists all available Bluetooth devices including NRF)
   */
  function handleOpenDevicePicker() {
    if (onSelectBluetoothDevice) {
      onSelectBluetoothDevice();
      return;
    }

    createBluetoothDevicePickerModal({
      onConnected: () => {
        updateBluetoothControls();
      }
    });
  }

  /**
   * 2. Tab Navigation Handling
   */
  function switchTab(newTab) {
    activeTab = newTab;
    if (activeTab === 'CURVE') {
      tabBtnCurve.className = "px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer bg-emeraldGlow text-slate-950 shadow-md shadow-emeraldGlow/20";
      tabBtnRaw.className = "px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer bg-slate-800 text-slate-400 hover:text-white border border-slate-700";
      panelCurveView.classList.remove('hidden');
      panelRawView.classList.add('hidden');
      tabRawCounterBadge.className = "px-1.5 py-0.2 rounded text-[10px] font-mono bg-emeraldGlow/20 text-emeraldGlow";

      // Redraw canvas on tab activation
      const canvas = container.querySelector('#spectral-canvas');
      if (canvas && latestAnalysis?.rawSpectrumPreview) {
        drawSpectralCurve(canvas, latestAnalysis.rawSpectrumPreview);
      }
    } else {
      tabBtnCurve.className = "px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer bg-slate-800 text-slate-400 hover:text-white border border-slate-700";
      tabBtnRaw.className = "px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer bg-emeraldGlow text-slate-950 shadow-md shadow-emeraldGlow/20";
      panelCurveView.classList.add('hidden');
      panelRawView.classList.remove('hidden');
      tabRawCounterBadge.className = "px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-950 text-emeraldGlow";

      renderRawTerminal();
      renderChannelsMatrix();
      if (autoScroll) {
        rawTerminalLog.scrollTop = rawTerminalLog.scrollHeight;
      }
    }
  }

  tabBtnCurve.addEventListener('click', () => switchTab('CURVE'));
  tabBtnRaw.addEventListener('click', () => switchTab('RAW_DATA'));

  /**
   * 3. Raw Data Terminal Ingestion & Rendering
   */
  function handleRawDataPacket(packet) {
    totalBytes += (packet.text?.length || 0);
    packetsCount++;
    lastPacketTime = new Date(packet.timestamp || Date.now()).toLocaleTimeString();

    // Store in ring buffer
    rawPackets.push(packet);
    if (rawPackets.length > 250) {
      rawPackets.shift();
    }

    if (packet.channels && Array.isArray(packet.channels)) {
      latestRawChannels = packet.channels;
    }

    // Update Counter Badge
    tabRawCounterBadge.textContent = `${packetsCount} pkts`;

    // Update Telemetry Metrics Strip
    rawMetricBytes.textContent = totalBytes > 1024 ? `${(totalBytes / 1024).toFixed(1)} KB` : `${totalBytes} B`;
    rawMetricPackets.textContent = `${packetsCount} pkts`;
    rawMetricMtu.textContent = `${packet.mtu || leafClipDevice.negotiatedMtu} Bytes`;
    const isBlueNrgPkt = Boolean(
      leafClipDevice.deviceInfo?.model?.includes('BlueNRG') ||
      leafClipDevice.device?.name?.includes('BlueNRG') ||
      leafClipDevice.deviceInfo?.protocol?.includes('BlueNRG') ||
      leafClipDevice.deviceInfo?.id?.includes('02:80')
    );
    rawMetricProtocol.textContent = isBlueNrgPkt ? 'ST BlueNRG Chat' : (leafClipDevice.deviceInfo?.protocol?.split(' ')[0] || 'NUS');
    rawMetricTime.textContent = lastPacketTime;
    rawMetricRssi.textContent = `${leafClipDevice.rssi} dBm`;

    if (activeTab === 'RAW_DATA') {
      appendPacketToTerminal(packet);
      if (packet.channels) {
        renderChannelsMatrix();
      }
    }
  }

  function appendPacketToTerminal(packet) {
    if (formatFilter !== 'ALL' && packet.format !== formatFilter) return;

    const row = document.createElement('div');
    row.className = "flex items-start gap-2 py-0.5 border-b border-slate-900/60 font-mono text-[11px] leading-relaxed hover:bg-slate-900/40 transition";

    const timeStr = new Date(packet.timestamp || Date.now()).toTimeString().split(' ')[0] + '.' + String(Date.now() % 1000).padStart(3, '0');
    
    let formatBadge = '';
    if (packet.format === 'JSON') {
      formatBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">JSON</span>`;
    } else if (packet.format === 'CSV' || packet.format === 'CSV_SPEC') {
      formatBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">CSV</span>`;
    } else if (packet.format === 'HEX') {
      formatBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30">HEX</span>`;
    } else {
      formatBadge = `<span class="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30">ASCII</span>`;
    }

    const sanitizedText = (packet.text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    row.innerHTML = `
      <span class="text-slate-500 shrink-0 select-none">[${timeStr}]</span>
      <span class="shrink-0 select-none">${formatBadge}</span>
      <span class="text-slate-300 break-all">${sanitizedText}</span>
    `;

    rawTerminalLog.appendChild(row);

    if (autoScroll) {
      rawTerminalLog.scrollTop = rawTerminalLog.scrollHeight;
    }
  }

  function renderRawTerminal() {
    rawTerminalLog.innerHTML = '';
    const filtered = formatFilter === 'ALL' 
      ? rawPackets 
      : rawPackets.filter(p => p.format === formatFilter);

    if (filtered.length === 0) {
      rawTerminalLog.innerHTML = `<div class="text-slate-600 italic py-4">// No raw telemetry frames match the active filter. Listening on BLE GATT...</div>`;
      return;
    }

    filtered.forEach(p => appendPacketToTerminal(p));
  }

  /**
   * 4. Render Live 16-Bit Raw ADC Channels Matrix (76 Bands)
   */
  function renderChannelsMatrix() {
    const channels = latestRawChannels || Array.from({ length: 76 }, (_, i) => {
      const wl = 350 + i * 10;
      let count = 4200;
      if (wl >= 520 && wl <= 560) count = 14200;
      else if (wl >= 720 && wl <= 880) count = 52000;
      else if (wl >= 950 && wl <= 980) count = 38000;
      else count = 24000;
      return count;
    });

    rawChannelsMatrix.innerHTML = channels.map((val, idx) => {
      const wl = WAVELENGTHS[idx] || (350 + idx * 10);
      const ratio = (val / 65535).toFixed(3);
      const pct = Math.min(100, Math.round((val / 65535) * 100));

      let bandColor = 'bg-slate-700';
      if (wl === 450) bandColor = 'bg-blue-400';
      else if (wl === 550) bandColor = 'bg-green-400';
      else if (wl === 680 || wl === 705) bandColor = 'bg-rose-400';
      else if (wl === 970) bandColor = 'bg-cyan-400';

      return `
        <div class="bg-slate-950 p-2 rounded-xl border border-slate-800 text-[10px] font-mono flex flex-col justify-between">
          <div class="flex items-center justify-between text-slate-400">
            <span class="font-bold text-slate-200">#${idx}</span>
            <span>${wl}nm</span>
          </div>
          <div class="text-xs font-bold text-white font-mono mt-1">
            ${val.toLocaleString()}
          </div>
          <div class="w-full bg-slate-800 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div class="${bandColor} h-full rounded-full transition-all duration-300" style="width: ${pct}%"></div>
          </div>
          <div class="flex items-center justify-between text-[9px] text-slate-500 mt-1">
            <span>R: ${ratio}</span>
            <span>${pct}%</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Terminal Controls Handlers
  btnToggleAutoscroll.addEventListener('click', () => {
    autoScroll = !autoScroll;
    btnToggleAutoscroll.className = `px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium transition border flex items-center gap-1 cursor-pointer ${
      autoScroll ? 'bg-emeraldGlow/15 text-emeraldGlow border-emeraldGlow/40' : 'bg-slate-800 text-slate-400 border-slate-700'
    }`;
    btnToggleAutoscroll.innerHTML = `<span>Auto-Scroll:</span><strong class="${autoScroll ? 'text-emeraldGlow' : 'text-slate-400'}">${autoScroll ? 'ON' : 'OFF'}</strong>`;
  });

  rawFormatFilter.addEventListener('change', (e) => {
    formatFilter = e.target.value;
    renderRawTerminal();
  });

  btnTriggerTestPacket.addEventListener('click', () => {
    leafClipDevice.triggerTestPacket('SPEC');
  });

  btnClearTerminal.addEventListener('click', () => {
    rawPackets = [];
    totalBytes = 0;
    packetsCount = 0;
    renderRawTerminal();
    tabRawCounterBadge.textContent = '0 pkts';
    rawMetricBytes.textContent = '0 B';
    rawMetricPackets.textContent = '0 pkts';
  });

  btnCopyRawData.addEventListener('click', async () => {
    const textToCopy = rawPackets.map(p => {
      const timeStr = new Date(p.timestamp || Date.now()).toISOString();
      return `[${timeStr}] [${p.format}] ${p.text}`;
    }).join('\n');

    try {
      await navigator.clipboard.writeText(textToCopy);
      const copyBtnText = container.querySelector('#copy-btn-text');
      if (copyBtnText) {
        copyBtnText.textContent = 'Copied!';
        setTimeout(() => { copyBtnText.textContent = 'Copy'; }, 2000);
      }
    } catch (e) {
      console.warn("Clipboard copy failed:", e);
    }
  });

  // Attach Hardware Listeners (reactive without full-page reloads)
  const unbindRawData = leafClipDevice.on('rawData', (data) => {
    handleRawDataPacket(data);
  });

  const unbindConn = leafClipDevice.on('connectionChange', () => {
    updateBluetoothControls();
  });

  // Cleanup listeners when removed from DOM
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container)) {
      unbindRawData();
      unbindConn();
      observer.disconnect();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Initial UI Render
  updateBluetoothControls();
  renderChannelsMatrix();

  // Scan Button Trigger
  scanBtn.addEventListener('click', () => {
    const plotId = plotSelect.value;
    if (onAcquireScan) onAcquireScan(plotId);
  });

  return container;
}

/**
 * Render the 5 Farmer Agronomic Decision Cards into the container
 */
export function renderDecisionCards(container, analysis, cropName = "Bell Peppers", plotNumber = 1) {
  const cardsHost = container.querySelector('#decision-cards-container');
  if (!cardsHost || !analysis) return;

  const vitalityColor = getVitalityColor(analysis.vitalityScore);

  cardsHost.innerHTML = `
    <!-- Decision 1: Crop Vitality Score (Speedometer Circular Gauge) -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">1. Crop Vitality Score</span>
        <button data-tts="VITALITY" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <!-- Animated SVG Speedometer / Circular Gauge -->
      <div class="flex items-center justify-center my-2">
        <div class="relative w-36 h-36 flex items-center justify-center">
          <svg class="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <!-- Background circle track -->
            <circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="8" class="text-slate-700/60" fill="transparent"/>
            <!-- Animated Progress circle -->
            <circle cx="50" cy="50" r="40" stroke="${vitalityColor}" stroke-width="8" stroke-linecap="round" fill="transparent"
              stroke-dasharray="251.2"
              stroke-dashoffset="${251.2 - (251.2 * analysis.vitalityScore) / 100}"
              class="transition-all duration-1000 ease-out"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span class="text-3xl font-extrabold font-mono text-white tracking-tight">${analysis.vitalityScore}</span>
            <span class="text-[10px] font-mono uppercase tracking-wider text-slate-400">/ 100 Vigor</span>
          </div>
        </div>
      </div>

      <div class="pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] text-slate-300 font-mono">
        <span>NDVI: <strong>${analysis.indices.ndvi}</strong></span>
        <span>NDRE: <strong>${analysis.indices.ndre}</strong></span>
        <span>LWI: <strong>${analysis.indices.leafWaterIndex}</strong></span>
      </div>
    </div>

    <!-- Decision 2: Nitrogen & Fertilizer Prescription -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">2. Nitrogen Prescription</span>
        <button data-tts="NITROGEN" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono ${analysis.nitrogenPrescriptionKg > 0 ? 'text-amberPulse' : 'text-emeraldGlow'}">
            ${analysis.nitrogenPrescriptionKg}
          </span>
          <span class="text-xs font-mono text-slate-300">kg/acre Urea</span>
        </div>
        <p class="text-xs text-slate-300 mt-2 leading-relaxed">
          ${analysis.nitrogenMessage}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] text-slate-400 font-mono">
        <span>Red-Edge Inflection: 720nm</span>
        <span class="${analysis.nitrogenPrescriptionKg > 0 ? 'text-amberPulse' : 'text-emeraldGlow'} font-bold">
          ${analysis.nitrogenPrescriptionKg > 0 ? 'Supplemental Needed' : 'Chlorophyll Balanced'}
        </span>
      </div>
    </div>

    <!-- Decision 3: Irrigation Need Countdown -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">3. Irrigation Countdown</span>
        <button data-tts="IRRIGATION" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono ${analysis.irrigationCountdownHours < 12 ? 'text-crimsonCoral animate-pulse' : 'text-cyan-400'}">
            ${analysis.irrigationCountdownHours}
          </span>
          <span class="text-xs font-mono text-slate-300">Hours Until Depletion</span>
        </div>
        <p class="text-xs text-slate-300 mt-2 leading-relaxed">
          ${analysis.irrigationMessage}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] font-mono">
        <span class="text-slate-400">970nm Water Dip:</span>
        <span class="font-bold ${analysis.irrigationUrgency === 'CRITICAL' ? 'text-crimsonCoral' : 'text-cyan-300'}">
          ${analysis.irrigationUrgency}
        </span>
      </div>
    </div>

    <!-- Decision 4: Pre-Symptomatic Disease Alert -->
    <div class="bg-slate-800/80 rounded-xl p-4 border ${analysis.diseaseRisk.detected ? 'border-amberPulse/60 bg-amber-950/20' : 'border-slate-700/80'} shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">4. Pre-Symptomatic Alert</span>
        <button data-tts="DISEASE" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full ${analysis.diseaseRisk.detected ? 'bg-amberPulse animate-ping' : 'bg-emeraldGlow'}"></span>
          <h4 class="text-sm font-bold text-white">${analysis.diseaseRisk.pathogen}</h4>
        </div>
        <div class="mt-2 text-xs text-slate-300">
          Confidence: <strong class="text-white font-mono">${analysis.diseaseRisk.confidence}%</strong>
        </div>
        <p class="text-xs text-slate-400 mt-1 leading-relaxed">
          ${analysis.diseaseRisk.preventativeAction}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Chlorophyll Trough: 680nm</span>
        <span class="text-slate-300">Edge ML ResNet-18</span>
      </div>
    </div>

    <!-- Decision 5: Harvest Window Predictor -->
    <div class="bg-slate-800/80 rounded-xl p-4 border border-slate-700/80 shadow-md relative group hover:border-slate-600 transition">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400">5. Harvest Window Predictor</span>
        <button data-tts="HARVEST" class="tts-speak-btn p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white transition cursor-pointer" title="Voice Readout">
          <svg class="w-4 h-4 text-emeraldGlow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
          </svg>
        </button>
      </div>

      <div class="my-2">
        <div class="flex items-baseline gap-2">
          <span class="text-3xl font-extrabold font-mono text-emeraldGlow">
            ${analysis.harvest.maturityPercent}%
          </span>
          <span class="text-xs font-mono text-slate-300">Canopy Maturity</span>
        </div>
        <p class="text-xs text-slate-300 mt-2 leading-relaxed">
          ${analysis.harvest.statusMessage}
        </p>
      </div>

      <div class="mt-4 pt-2 border-t border-slate-750 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <span>Peak Harvest Window:</span>
        <span class="text-emeraldGlow font-bold">~${analysis.harvest.daysToPeakHarvest} Days</span>
      </div>
    </div>
  `;

  // Attach TTS listeners
  cardsHost.querySelectorAll('.tts-speak-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const type = btn.getAttribute('data-tts');
      ttsEngine.speakDecision(type, {
        ...analysis,
        cropName,
        plotNumber
      });
    });
  });
}

/**
 * Draws the 350-1100 nm VIS-NIR Spectral Reflectance Chart on HTML5 Canvas
 */
export function drawSpectralCurve(canvas, spectrum = []) {
  if (!canvas || !spectrum || spectrum.length === 0) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  if (rect.width === 0 || rect.height === 0) return;

  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  const isCreamy = document.body.classList.contains('theme-creamy-agri') || !document.body.classList.contains('theme-dark-soil');
  const gridStroke = isCreamy ? "rgba(180, 195, 185, 0.55)" : "rgba(51, 65, 85, 0.4)";
  const tickText = isCreamy ? "#4A6B52" : "#64748b";
  const curveStroke = isCreamy ? "#1B5E20" : "#10B981";

  // Clear background
  ctx.clearRect(0, 0, width, height);

  // Draw grid lines
  ctx.strokeStyle = gridStroke;
  ctx.lineWidth = 1;
  for (let y = 0.2; y <= 0.8; y += 0.2) {
    const py = height * (1 - y);
    ctx.beginPath();
    ctx.moveTo(35, py);
    ctx.lineTo(width - 15, py);
    ctx.stroke();

    ctx.fillStyle = tickText;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`${Math.round(y * 100)}%`, 8, py + 3);
  }

  // Wavelength ticks (400, 550, 700, 850, 1000 nm)
  const keyWls = [400, 550, 700, 850, 1000];
  keyWls.forEach(wl => {
    const px = 40 + ((wl - 350) / (1100 - 350)) * (width - 60);
    ctx.beginPath();
    ctx.moveTo(px, 10);
    ctx.lineTo(px, height - 20);
    ctx.strokeStyle = gridStroke;
    ctx.stroke();

    ctx.fillStyle = tickText;
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.fillText(`${wl}nm`, px - 14, height - 6);
  });

  // Highlight key absorption bands
  const drawBand = (targetWl, color, label) => {
    const px = 40 + ((targetWl - 350) / (1100 - 350)) * (width - 60);
    ctx.fillStyle = color;
    ctx.fillRect(px - 10, 10, 20, height - 32);
    ctx.fillStyle = isCreamy ? "#2D4B34" : "#cbd5e1";
    ctx.font = "9px 'Inter', sans-serif";
    ctx.fillText(label, px - 12, 22);
  };

  drawBand(450, isCreamy ? "rgba(43, 108, 176, 0.12)" : "rgba(59, 130, 246, 0.08)", "Chl-b");
  drawBand(680, isCreamy ? "rgba(197, 48, 48, 0.12)" : "rgba(239, 68, 68, 0.08)", "Chl-a");
  drawBand(970, isCreamy ? "rgba(49, 151, 149, 0.15)" : "rgba(6, 182, 212, 0.12)", "H₂O Dip");

  // Draw Spectral Gradient Curve
  const points = spectrum.map((r, i) => {
    const wl = WAVELENGTHS[i] || (350 + i * 10);
    const x = 40 + ((wl - 350) / (1100 - 350)) * (width - 60);
    const y = (height - 25) - (r * (height - 40));
    return { x, y };
  });

  // Area fill below curve
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  if (isCreamy) {
    gradient.addColorStop(0, "rgba(46, 125, 50, 0.35)");
    gradient.addColorStop(0.6, "rgba(46, 125, 50, 0.12)");
    gradient.addColorStop(1, "rgba(46, 125, 50, 0.0)");
  } else {
    gradient.addColorStop(0, "rgba(16, 185, 129, 0.4)");
    gradient.addColorStop(0.6, "rgba(16, 185, 129, 0.1)");
    gradient.addColorStop(1, "rgba(16, 185, 129, 0.0)");
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - 25);
  points.forEach(p => ctx.lineTo(p.x, p.y));
  ctx.lineTo(points[points.length - 1].x, height - 25);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // Stroke line
  ctx.beginPath();
  points.forEach((p, idx) => {
    if (idx === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  });
  ctx.strokeStyle = curveStroke;
  ctx.lineWidth = 2.8;
  ctx.stroke();

  // Highlight points
  points.forEach((p, idx) => {
    const wl = WAVELENGTHS[idx];
    if (wl === 550 || wl === 680 || wl === 720 || wl === 970) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = isCreamy ? "#FCFAF6" : "#ffffff";
      ctx.fill();
      ctx.strokeStyle = curveStroke;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  });
}
