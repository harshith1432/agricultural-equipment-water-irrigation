/**
 * Header & Field Operations Bar
 * Displays live hardware links, Agricultural Theme Selector, TTS language picker, and Emergency Killswitch.
 */
import { SUPPORTED_LANGUAGES, ttsEngine } from '../audio/voiceReadoutTTS.js';

export const THEME_OPTIONS = [
  { id: 'creamy-agri', label: '🌾 Cream & Green (Agri)', short: '🌾 Cream' },
  { id: 'lush-emerald', label: '🌿 Lush Emerald', short: '🌿 Emerald' },
  { id: 'sunlight', label: '☀️ Sunlight Contrast', short: '☀️ Sun' },
  { id: 'dark-soil', label: '🌙 Dark Soil', short: '🌙 Dark' }
];

export function createHeader({
  onEmergencyStop,
  onOpenCalibration,
  onOpenSimModal,
  onThemeChange,
  currentTheme = 'creamy-agri',
  bleState,
  mqttState
}) {
  const container = document.createElement('header');
  container.className = "w-full border-b border-slate-700/60 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40 transition-colors duration-300";

  container.innerHTML = `
    <div class="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
      <!-- Brand & Mission -->
      <div class="flex items-center gap-3">
        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-700 to-green-900 flex items-center justify-center shadow-lg shadow-emerald-900/20 ring-2 ring-emerald-500/30">
          <svg class="w-6 h-6 text-emerald-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2a10 10 0 0 1 10 10c0 5.523-4.477 10-10 10S2 17.523 2 12a10 10 0 0 1 10-10Z"/>
            <path d="m9 12 2 2 4-4"/>
            <path d="M12 6v2"/>
            <path d="M12 16v2"/>
          </svg>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-white flex items-center gap-1.5 font-sans">
              AGRISPECTRA <span class="text-emeraldGlow font-medium text-xs sm:text-sm px-2 py-0.5 rounded-lg bg-emeraldGlow/10 border border-emeraldGlow/30">FLOW & FIELD</span>
            </h1>
            <span class="hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-750">
              1-ACRE PRECISION
            </span>
          </div>
          <p class="text-[11px] text-slate-400 font-medium hidden sm:block">Unified Handheld Leaf Spectroscopy & Solenoid Smart Irrigation</p>
        </div>
      </div>

      <!-- Quick Status Badges & Hardware Control Hub -->
      <div class="flex items-center flex-wrap gap-2">
        <!-- BLE Leaf Clip Chip -->
        <button id="header-ble-btn" class="min-h-[48px] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 border ${
          bleState.connected 
            ? 'bg-emeraldGlow/15 text-emerald-700 dark:text-emeraldGlow-light border-emeraldGlow/40 shadow-sm shadow-emeraldGlow/20' 
            : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600'
        }" title="Leaf-Clip Spectrometer BLE Status">
          <span class="w-2.5 h-2.5 rounded-full ${bleState.connected ? 'bg-emeraldGlow animate-ping' : 'bg-slate-500'}"></span>
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="m7 7 10 10-5 5V2l5 5L7 17"/>
          </svg>
          <span class="hidden xs:inline">${bleState.connected ? 'BLE: Connected' : 'BLE: Disconnected'}</span>
        </button>

        <!-- MQTT Telemetry Chip -->
        <button id="header-mqtt-btn" class="min-h-[48px] flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-mono font-medium transition-all duration-200 border ${
          mqttState.running 
            ? 'bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/20' 
            : 'bg-slate-800 text-slate-400 border-slate-700'
        }" title="FDR Soil Probes & Pressure Telemetry Stream">
          <span class="w-2.5 h-2.5 rounded-full ${mqttState.running ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}"></span>
          <span>FDR IoT</span>
        </button>

        <!-- Optical Calibration Button -->
        <button id="header-calib-btn" class="min-h-[48px] flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 transition" title="Dark Current & 99% PTFE Disc Calibration">
          <svg class="w-4 h-4 text-amberPulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
          </svg>
          <span class="hidden sm:inline">Calibrate</span>
        </button>

        <!-- Theme Selector: Creamy Light / Emerald Green / Sunlight -->
        <div class="relative">
          <select id="header-theme-select" class="min-h-[48px] appearance-none bg-emerald-950/20 dark:bg-slate-800 hover:bg-emerald-950/30 text-emerald-900 dark:text-emerald-300 text-xs font-bold pl-3 pr-8 py-2 rounded-xl border border-emerald-600/30 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm" title="Select Agricultural Visual Theme">
            ${THEME_OPTIONS.map(t => `<option value="${t.id}" ${t.id === currentTheme ? 'selected' : ''}>${t.label}</option>`).join('')}
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-emerald-700 dark:text-emerald-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- Regional Voice Audio TTS Selector -->
        <div class="relative">
          <select id="header-lang-select" class="min-h-[48px] appearance-none bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-medium pl-3 pr-8 py-2 rounded-xl border border-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer" title="Select Voice TTS Readout Language">
            ${SUPPORTED_LANGUAGES.map(l => `<option value="${l.code}">${l.flag} ${l.label.split(' ')[0]}</option>`).join('')}
          </select>
          <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7"/></svg>
          </div>
        </div>

        <!-- EMERGENCY 1-TAP SHUTOFF BUTTON -->
        <button id="header-emergency-kill-btn" class="min-h-[48px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 border border-red-500/50 shadow-md shadow-red-900/30 transition transform active:scale-95" title="Emergency Stop: Closes all valves G1-G6 immediately">
          <svg class="w-4 h-4 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
            <line x1="12" y1="2" x2="12" y2="12"/>
          </svg>
          <span>KILLSWITCH</span>
        </button>
      </div>
    </div>
  `;

  // Attach event handlers
  container.querySelector('#header-ble-btn').addEventListener('click', () => {
    onOpenCalibration('BLE');
  });

  container.querySelector('#header-mqtt-btn').addEventListener('click', () => {
    onOpenSimModal();
  });

  container.querySelector('#header-calib-btn').addEventListener('click', () => {
    onOpenCalibration('FULL');
  });

  container.querySelector('#header-theme-select').addEventListener('change', (e) => {
    if (onThemeChange) onThemeChange(e.target.value);
  });

  container.querySelector('#header-lang-select').addEventListener('change', (e) => {
    ttsEngine.setLanguage(e.target.value);
  });

  container.querySelector('#header-emergency-kill-btn').addEventListener('click', () => {
    onEmergencyStop();
  });

  return container;
}
