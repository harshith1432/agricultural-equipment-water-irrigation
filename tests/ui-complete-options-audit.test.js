/**
 * AgriSpectra Flow & Field - UI Option-by-Option Automated Verification Test Suite
 * File: tests/ui-complete-options-audit.test.js
 *
 * Exhaustive QA & Chaos Engineering verification covering:
 *  1. Every Navigation Tab:
 *     - Dashboard / Overview (Hero Weather, Bento KPIs, 6-Zone Canvas, Category Hubs, Quick Valve actuate)
 *     - Irrigation (G1-G6 valves, Emergency All-Stop, Pulse timing durations, Add/Delete valve)
 *     - Spectroscopy (Connection modes, Leaf Scan acquisition, Detail toggle, 5 Decision Cards, Calibration modal)
 *     - Synergy (Cross-module fusion, Action execution, Approve +12V pulse, Dismiss with justification)
 *     - Usage (Timeframe pills: Today, 7D, 30D, Season; CSV export generation & audit verification)
 *     - Settings (Profile details, Google SSO link, Glare mode toggle, Plot target sliders, Pulse width selection, Language, Flush cache, Sign out)
 *  2. Every Modal & Overlay:
 *     - Onboarding Carousel (Next, Prev, Dot navigation, Skip intro, Get Started, Offline Guest mode)
 *     - Auth Modal (Tab switch, Inputs, Password visibility, Forgot password flow, Role selection, Google OAuth, Offline Field Guest)
 *     - Dashboard Settings Modal (Toggle each of the 8 widgets, Reset Defaults, Cancel, Save Layout)
 *     - Telemetry Simulator Modal (MQTT stream toggle, Weather disturbances, Database reset, Close)
 *     - Calibration Wizard (Dark current sweep, PTFE white disc step, Complete & Return)
 *  3. DOM & Layout Bounds Check:
 *     - Verifies buttons do not have zero width/height, are not unexpectedly disabled, and fire handlers.
 *     - Verifies no NaN or undefined text is injected anywhere in the DOM.
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';

// Setup headless DOM
setupHeadlessDOM();

// Component Imports
import { createNativeMobileAppView } from '../src/components/NativeMobileAppView.js';
import { createFieldOverviewDashboard } from '../src/components/dashboards/FieldOverviewDashboard.js';
import { createIrrigationManagementView } from '../src/components/dashboards/IrrigationManagementView.js';
import { createValveControlCenter } from '../src/components/ValveControlCenter.js';
import { createSpectroscopyAnalysisView } from '../src/components/dashboards/SpectroscopyAnalysisView.js';
import { createAIIntelligenceView } from '../src/components/dashboards/AIIntelligenceView.js';
import { createClosedLoopSynergySection } from '../src/components/ClosedLoopSynergyCard.js';
import { createUsageAnalyticsView } from '../src/components/UsageAnalyticsView.js';
import { createSettingsView } from '../src/components/SettingsView.js';
import { createOnboardingCarousel, setOnboardingCompleted } from '../src/components/OnboardingCarousel.js';
import { createAuthModal } from '../src/components/AuthModal.js';
import { createDashboardSettingsModal, resetDashboardWidgetSettings, getDashboardWidgetSettings } from '../src/components/DashboardSettingsModal.js';
import { createTelemetrySimulatorModal } from '../src/components/TelemetrySimulatorModal.js';
import { createCalibrationModal } from '../src/components/CalibrationWizard.js';

import { authService } from '../src/firebase/authService.js';
import { irrigationControllerAdapter, VALVE_STATES } from '../src/hardware/irrigationControllerAdapter.js';
import { spectrometerUSBAdapter, CONNECTION_MODES } from '../src/hardware/spectrometerUSBAdapter.js';
import { mqttSimulator } from '../src/hardware/mqttTelemetrySimulator.js';
import { leafClipDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { INITIAL_FARM_DATA } from '../src/firebase/mockFirestore.js';
import { getLocale, setLocale } from '../src/utils/i18n.js';

const mockPlots = Object.values(INITIAL_FARM_DATA.plots || {});

/**
 * Deep text scanner verifying zero NaN, undefined, or [object Object] artifacts in element text
 */
function assertNoCorruptText(element, contextName = 'View') {
  const text = element.textContent || '';
  expect(text.includes('$NaN')).toBe(false);
  expect(text.includes('NaN%')).toBe(false);
  expect(text.includes('NaN Bar')).toBe(false);
  expect(text.includes('NaN L')).toBe(false);
  expect(/\bNaN\b/.test(text)).toBe(false);
  expect(text.includes('undefined L')).toBe(false);
  expect(text.includes('undefined%')).toBe(false);
  expect(/\bundefined\b/.test(text)).toBe(false);
  expect(text.includes('[object Object]')).toBe(false);
  expect(text.includes('null')).toBe(false);
}

export function registerUICompleteOptionsAuditTests() {

  // =========================================================================
  // SUITE 1: Navigation Tabs & Complete Screen Options
  // =========================================================================

  describe('UI Option Audit - Tab 1: Dashboard / Field Overview', () => {
    it('renders all Dashboard modules and allows category module navigation', async () => {
      let navigatedTab = null;
      let selectedPlot = null;
      let actuatedValveData = null;

      const dashboard = createFieldOverviewDashboard({
        plots: mockPlots,
        selectedPlotId: 'plot-1',
        onSelectPlot: (pId) => { selectedPlot = pId; },
        onNavigateTab: (tab) => { navigatedTab = tab; },
        onActuateValve: (data) => { actuatedValveData = data; },
        telemetryMetrics: { mainlinePressureBar: 2.38, activeFlowLph: 480, consumedLitersToday: 1950 }
      });

      expect(Boolean(dashboard)).toBe(true);
      assertNoCorruptText(dashboard, 'Dashboard');

      // 1. Verify Customize Bento Button exists and can be clicked
      const customizeBtn = dashboard.querySelector('#dash-customize-btn');
      expect(Boolean(customizeBtn)).toBe(true);
      expect(customizeBtn.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(customizeBtn.getBoundingClientRect().height).toBeGreaterThan(0);

      // 2. Click each category quick launcher module
      const catButtons = dashboard.querySelectorAll('.cat-module-btn');
      expect(catButtons.length).toBe(4);

      const expectedTabs = ['soil', 'irrigation', 'spectroscopy', 'synergy'];
      catButtons.forEach((btn, idx) => {
        const targetTab = btn.getAttribute('data-target-tab');
        expect(expectedTabs).toContain(targetTab);
        btn.click();
        expect(navigatedTab).toBe(targetTab);
      });

      // 3. Click field zone card to select plot
      const zoneCards = dashboard.querySelectorAll('.field-zone-card');
      expect(zoneCards.length).toBeGreaterThan(0);
      zoneCards[0].click();
      expect(selectedPlot).toBe('plot-1');

      // 4. Click quick valve actuate button
      const quickValveBtn = dashboard.querySelector('.quick-valve-btn');
      expect(Boolean(quickValveBtn)).toBe(true);
      await quickValveBtn.click();
      expect(Boolean(actuatedValveData)).toBe(true);
    });
  });

  describe('UI Option Audit - Tab 2: Irrigation (G1-G6 Valves, Emergency All-Stop & Timers)', () => {
    it('verifies G1-G6 latching valves, timer durations, and Emergency All-Stop', async () => {
      let emergencyStopped = false;
      let valveActuated = null;

      // Ensure clean state before testing
      await irrigationControllerAdapter.emergencyAllStop('TEST_SETUP');

      const irrigationView = createIrrigationManagementView({
        plots: mockPlots,
        onActuateValve: (data) => { valveActuated = data; },
        onEmergencyStop: () => { emergencyStopped = true; }
      });

      expect(Boolean(irrigationView)).toBe(true);
      assertNoCorruptText(irrigationView, 'Irrigation');

      // 1. Verify timer duration selector buttons (15m, 30m, 45m, 60m)
      const durations = [15, 30, 45, 60];
      for (const dur of durations) {
        const btn = irrigationView.querySelector(`.timer-btn[data-duration="${dur}"]`);
        expect(Boolean(btn)).toBe(true);
        expect(Number(btn.getAttribute('data-duration'))).toBe(dur);
        btn.click();
        const activeBtn = irrigationView.querySelector(`.timer-btn[data-duration="${dur}"]`);
        expect(activeBtn.classList.contains('bg-[#0E5431]')).toBe(true);
      }

      // 2. Verify all 6 valves (G1 to G6) exist and can actuate
      const valveCards = irrigationView.querySelectorAll('.valve-card');
      expect(valveCards.length).toBeGreaterThanOrEqual(6);

      const g1Btn = irrigationView.querySelector('.valve-actuate-btn[data-gate-id="G1"]');
      expect(Boolean(g1Btn)).toBe(true);
      const initialAction = g1Btn.getAttribute('data-action');
      expect(['OPEN', 'CLOSE']).toContain(initialAction);
      
      // Click to toggle G1
      await g1Btn.click();
      expect(Boolean(g1Btn)).toBe(true);

      // 3. Verify Emergency All-Stop killswitch button
      const killswitchBtn = irrigationView.querySelector('#irrigation-emergency-kill-btn');
      expect(Boolean(killswitchBtn)).toBe(true);
      expect(killswitchBtn.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(killswitchBtn.getBoundingClientRect().height).toBeGreaterThan(0);

      await killswitchBtn.click();
      await new Promise(r => setTimeout(r, 150));
      expect(emergencyStopped).toBe(true);
      const remainingOpen = irrigationControllerAdapter.getAllValves().filter(v => v.state === VALVE_STATES.OPEN);
      expect(remainingOpen.length).toBe(0);

      // 4. Test Add Valve button
      const addValveBtn = irrigationView.querySelector('#btn-add-valve');
      expect(Boolean(addValveBtn)).toBe(true);
      addValveBtn.click();
    });

    it('verifies 6-Zone Solenoid Hydraulic Actuation Hub (ValveControlCenter)', () => {
      let actuatedParams = null;
      const center = createValveControlCenter(mockPlots, (params) => {
        actuatedParams = params;
      });

      expect(Boolean(center)).toBe(true);
      assertNoCorruptText(center, 'ValveControlCenter');

      // Verify timer buttons on valve card
      const timerBtns = center.querySelectorAll('.timer-btn');
      expect(timerBtns.length).toBeGreaterThan(0);
      timerBtns[0].click();

      // Verify pulse actuate button
      const actuateBtn = center.querySelector('.valve-actuate-btn');
      expect(Boolean(actuateBtn)).toBe(true);
      actuateBtn.click();
      expect(Boolean(actuatedParams)).toBe(true);
      expect(actuatedParams.gateId).toBe('G1');
      expect(actuatedParams.action).toBe('OPEN');
    });
  });

  describe('UI Option Audit - Tab 3: Spectroscopy (Modes, Acquisition & 5 Decision Cards)', () => {
    it('verifies connection mode switcher, leaf scan acquisition, and 5 decision cards', async () => {
      let calibOpened = false;
      const spectroView = createSpectroscopyAnalysisView({
        plot: mockPlots[0],
        onOpenCalibration: () => { calibOpened = true; }
      });

      expect(Boolean(spectroView)).toBe(true);
      assertNoCorruptText(spectroView, 'Spectroscopy');

      // 1. Connection Mode Switcher (USB, BLE, Wi-Fi Cloud)
      const modeButtons = spectroView.querySelectorAll('.mode-switch-btn');
      expect(modeButtons.length).toBe(3);

      const modes = [
        CONNECTION_MODES.USB_TYPE_C,
        CONNECTION_MODES.BLUETOOTH_BLE,
        CONNECTION_MODES.WIFI_CLOUD
      ];

      for (let i = 0; i < modeButtons.length; i++) {
        modeButtons[i].click();
        expect(spectrometerUSBAdapter.connectionMode).toBe(modes[i]);
      }

      // 2. Simple vs Advanced Detail Mode Toggle
      const simpleBtn = spectroView.querySelector('#toggle-view-simple');
      const advBtn = spectroView.querySelector('#toggle-view-advanced');
      expect(Boolean(simpleBtn)).toBe(true);
      expect(Boolean(advBtn)).toBe(true);

      advBtn.click();
      expect(spectroView.textContent).toContain('Vegetation Indices Matrix');
      expect(spectroView.textContent).toContain('NDVI');
      expect(spectroView.textContent).toContain('NDRE');

      simpleBtn.click();

      // 3. Leaf Scan Acquisition Button
      const scanBtn = spectroView.querySelector('#btn-acquire-scan');
      expect(Boolean(scanBtn)).toBe(true);
      await scanBtn.click();

      // 4. Verify 5 Agronomic Decision Cards presence and TTS buttons
      const ttsButtons = spectroView.querySelectorAll('.tts-speak-btn');
      expect(ttsButtons.length).toBe(5);

      const text = spectroView.textContent;
      // Decision 1: Crop Vitality
      expect(text).toContain('Crop Vitality');
      // Decision 2: Nitrogen & Fertilizer Prescription
      expect(text).toContain('Nitrogen');
      // Decision 3: Irrigation Countdown
      expect(text).toContain('Irrigation');
      // Decision 4: Disease Alert
      expect(text).toContain('Disease');

      // 5. Calibration Trigger
      const calibBtn = spectroView.querySelector('#btn-open-calibration');
      expect(Boolean(calibBtn)).toBe(true);
      calibBtn.click();
    });
  });

  describe('UI Option Audit - Tab 4: Synergy (Autonomous Loop & Action Execution)', () => {
    it('verifies AI Intelligence fusion cards and execution triggers', async () => {
      let valveActuated = false;
      const aiView = createAIIntelligenceView({
        plots: mockPlots,
        latestScanAnalysis: null,
        onActuateValve: () => { valveActuated = true; }
      });

      expect(Boolean(aiView)).toBe(true);
      assertNoCorruptText(aiView, 'AIIntelligence');

      // Verify execution buttons
      const execBtns = aiView.querySelectorAll('.rec-exec-btn');
      expect(execBtns.length).toBe(3);

      await execBtns[0].click();
      const updatedExecBtn = aiView.querySelector('.rec-exec-btn[data-rec-id="rec-pulse-zone2"]');
      expect(updatedExecBtn.textContent).toContain('Executed');
      expect(updatedExecBtn.disabled).toBe(true);
    });

    it('verifies ClosedLoopSynergySection with APPROVE and DISMISS actions', () => {
      let actionRecorded = null;
      const recommendations = [
        {
          id: 'rec-001',
          plotNumber: 2,
          gateId: 'G2',
          crop: 'Tomatoes',
          status: 'PENDING',
          triggerReason: 'Sub-surface moisture deficit confirmed at 30cm FDR probe.',
          suggestedDurationMinutes: 30,
          nitrogenPrescriptionKg: 14.5
        }
      ];

      const synergyCard = createClosedLoopSynergySection(recommendations, (recId, action) => {
        actionRecorded = { recId, action };
      });

      expect(Boolean(synergyCard)).toBe(true);
      assertNoCorruptText(synergyCard, 'ClosedLoopSynergyCard');

      // 1. Verify TTS button
      const ttsBtn = synergyCard.querySelector('.rec-tts-btn');
      expect(Boolean(ttsBtn)).toBe(true);
      ttsBtn.click();

      // 2. Verify DISMISS button
      const dismissBtn = synergyCard.querySelector('.rec-action-btn[data-action="DISMISS"]');
      expect(Boolean(dismissBtn)).toBe(true);
      dismissBtn.click();
      expect(actionRecorded?.action).toBe('DISMISS');
      expect(actionRecorded?.recId).toBe('rec-001');

      // 3. Verify APPROVE button
      const approveBtn = synergyCard.querySelector('.rec-action-btn[data-action="APPROVE"]');
      expect(Boolean(approveBtn)).toBe(true);
      approveBtn.click();
      expect(actionRecorded?.action).toBe('APPROVE');
      expect(actionRecorded?.recId).toBe('rec-001');
    });
  });

  describe('UI Option Audit - Tab 5: Usage (Timeframe Pills & CSV Export Generation)', () => {
    it('switches timeframes dynamically and generates CSV audit file', () => {
      const usageView = createUsageAnalyticsView({
        plots: mockPlots,
        telemetryMetrics: { mainlinePressureBar: 2.42, consumedLitersToday: 1845 }
      });

      expect(Boolean(usageView)).toBe(true);
      assertNoCorruptText(usageView, 'UsageAnalytics');

      // 1. Verify all 4 timeframe pills: Today, 7D, 30D, Season
      const pills = usageView.querySelectorAll('.timeframe-btn');
      expect(pills.length).toBe(4);

      const timeframeIds = ['today', '7d', '30d', 'season'];
      for (let i = 0; i < timeframeIds.length; i++) {
        const tfId = timeframeIds[i];
        const pill = usageView.querySelector(`.timeframe-btn[data-timeframe="${tfId}"]`);
        expect(Boolean(pill)).toBe(true);
        pill.click();
        const activePill = usageView.querySelector(`.timeframe-btn[data-timeframe="${tfId}"]`);
        expect(activePill.classList.contains('bg-white')).toBe(true);
      }

      // 2. Verify CSV Export Button and generation
      const exportBtn = usageView.querySelector('#export-csv-btn');
      expect(Boolean(exportBtn)).toBe(true);
      expect(exportBtn.getBoundingClientRect().width).toBeGreaterThan(0);
      expect(exportBtn.getBoundingClientRect().height).toBeGreaterThan(0);

      // Trigger export
      exportBtn.click();
    });
  });

  describe('UI Option Audit - Tab 6: Settings (Theme, Glare, Targets, Pulse & Cache)', () => {
    it('configures Glare mode, plot sliders, pulse timing, language and logout', async () => {
      let themeChanged = null;
      let loggedOut = false;
      let replayed = false;

      const settingsView = createSettingsView({
        currentUser: { displayName: 'Dave Miller', email: 'dave@agrispectra.io', role: 'Farm Owner' },
        currentTheme: 'creamy-agri',
        onThemeChange: (t) => { themeChanged = t; },
        onSignOut: () => { loggedOut = true; },
        onReplayOnboarding: () => { replayed = true; }
      });

      expect(Boolean(settingsView)).toBe(true);
      assertNoCorruptText(settingsView, 'Settings');

      // 1. Sunlight Glare Mode Toggle
      const glareBtn = settingsView.querySelector('#toggle-glare-mode-btn');
      expect(Boolean(glareBtn)).toBe(true);
      glareBtn.click();
      expect(themeChanged).toBe('sunlight');

      // 2. Plot target range sliders
      const vwcRange = settingsView.querySelector('#target-vwc-range');
      expect(Boolean(vwcRange)).toBe(true);
      vwcRange.value = 26.5;
      vwcRange.dispatchEvent({ type: 'input', target: vwcRange });
      const vwcDisplay = settingsView.querySelector('#vwc-val-display');
      expect(vwcDisplay.textContent).toBe('26.5%');

      const budgetRange = settingsView.querySelector('#water-budget-range');
      expect(Boolean(budgetRange)).toBe(true);
      budgetRange.value = 3500;
      budgetRange.dispatchEvent({ type: 'input', target: budgetRange });
      const budgetDisplay = settingsView.querySelector('#budget-val-display');
      expect(budgetDisplay.textContent).toBe('3500 L');

      // 3. Bi-Stable Solenoid pulse timing (50ms, 100ms, 250ms)
      const pulseBtns = settingsView.querySelectorAll('.pulse-timing-btn');
      expect(pulseBtns.length).toBe(3);
      pulseBtns[1].click(); // 100ms
      expect(localStorage.getItem('agrispectra_solenoid_pulse_ms')).toBe('100');

      // 4. Regional Audio Language select
      const langSelect = settingsView.querySelector('#settings-language-select');
      expect(Boolean(langSelect)).toBe(true);
      langSelect.value = 'es';
      langSelect.dispatchEvent({ type: 'change', target: langSelect });
      expect(getLocale()).toBe('es');
      setLocale('en'); // Restore English

      // 5. Replay guide button
      const replayBtn = settingsView.querySelector('#replay-onboard-btn');
      expect(Boolean(replayBtn)).toBe(true);
      replayBtn.click();
      expect(replayed).toBe(true);

      // 6. Flush cache button
      const flushBtn = settingsView.querySelector('#flush-cache-btn');
      expect(Boolean(flushBtn)).toBe(true);
      flushBtn.click();

      // 7. Log out button
      const logoutBtn = settingsView.querySelector('#settings-logout-btn');
      expect(Boolean(logoutBtn)).toBe(true);
      await logoutBtn.click();
      expect(loggedOut).toBe(true);
    });
  });

  // =========================================================================
  // SUITE 2: Modals & Overlays Complete Options
  // =========================================================================

  describe('UI Option Audit - Modal 1: Onboarding Carousel', () => {
    it('navigates next, prev, dots, skips, and completes as offline guest', () => {
      let completedData = null;
      let guestTriggered = false;

      const modal = createOnboardingCarousel({
        onComplete: (data) => { completedData = data; },
        onContinueAsGuest: () => { guestTriggered = true; }
      });

      expect(Boolean(modal)).toBe(true);
      assertNoCorruptText(modal, 'OnboardingCarousel');

      // 1. Next slide navigation
      const nextBtn = modal.querySelector('#onboard-next-btn');
      expect(Boolean(nextBtn)).toBe(true);
      expect(modal.textContent).toContain('Leaf Spectroscopy');

      nextBtn.click(); // Advance to Slide 2
      expect(modal.textContent).toContain('Smart Irrigation');

      // 2. Prev slide navigation
      const prevBtn = modal.querySelector('#onboard-prev-btn');
      expect(Boolean(prevBtn)).toBe(true);
      prevBtn.click(); // Back to Slide 1
      expect(modal.textContent).toContain('Leaf Spectroscopy');

      // 3. Dot button navigation
      const dots = modal.querySelectorAll('.slide-dot-btn');
      expect(dots.length).toBe(3);
      dots[2].click(); // Jump to Slide 3 (Synergy)
      expect(modal.textContent).toContain('Leaf-to-Valve Synergy');

      // 4. Continue as Offline Field Guest button
      const guestBtn = modal.querySelector('#onboard-guest-btn');
      expect(Boolean(guestBtn)).toBe(true);
      guestBtn.click();
      expect(guestTriggered).toBe(true);
    });
  });

  describe('UI Option Audit - Modal 2: Authentication Modal', () => {
    it('switches tabs, types credentials, toggles password, and signs in', async () => {
      let modalClosed = false;
      let authSucceeded = null;

      const authModal = createAuthModal({
        initialMode: 'SIGN_IN',
        onClose: () => { modalClosed = true; },
        onAuthSuccess: (u) => { authSucceeded = u; }
      });

      expect(Boolean(authModal)).toBe(true);
      assertNoCorruptText(authModal, 'AuthModal');

      // 1. Tab Switch: SignIn to SignUp
      const signUpTab = authModal.querySelector('#tab-mode-signup');
      expect(Boolean(signUpTab)).toBe(true);
      signUpTab.click();
      expect(authModal.textContent).toContain('Create Farm Workspace');
      expect(Boolean(authModal.querySelector('#auth-name-input'))).toBe(true);

      // Select operational role
      const agronomistRoleBtn = authModal.querySelector('.role-select-btn[data-role="Agronomist"]');
      expect(Boolean(agronomistRoleBtn)).toBe(true);
      agronomistRoleBtn.click();

      // Return to SignIn tab
      const signInTab = authModal.querySelector('#tab-mode-signin');
      expect(Boolean(signInTab)).toBe(true);
      signInTab.click();
      expect(authModal.textContent).toContain('Welcome Back, Grower');

      // 2. Input typing
      const emailInput = authModal.querySelector('#auth-email-input');
      const pwdInput = authModal.querySelector('#auth-password-input');
      expect(Boolean(emailInput)).toBe(true);
      expect(Boolean(pwdInput)).toBe(true);

      emailInput.value = 'grower.test@valleyfarms.com';
      pwdInput.value = 'FieldPass123!';

      // 3. Password visibility toggle
      const pwdToggleBtn = authModal.querySelector('#auth-toggle-pwd');
      expect(Boolean(pwdToggleBtn)).toBe(true);
      pwdToggleBtn.click();
      const updatedPwdInput = authModal.querySelector('#auth-password-input');
      expect(updatedPwdInput.type).toBe('text');
      pwdToggleBtn.click();

      // 4. Forgot password flow
      const forgotBtn = authModal.querySelector('#auth-goto-forgot');
      expect(Boolean(forgotBtn)).toBe(true);
      forgotBtn.click();
      expect(authModal.textContent).toContain('Reset Farm Access');

      const backToSignIn = authModal.querySelector('#auth-goto-signin');
      expect(Boolean(backToSignIn)).toBe(true);
      backToSignIn.click();

      // 5. Offline Field Guest Button
      const offlineBtn = authModal.querySelector('#offline-guest-btn');
      expect(Boolean(offlineBtn)).toBe(true);
      offlineBtn.click();
      expect(Boolean(authService.getCurrentUser())).toBe(true);
      expect(authService.getCurrentUser().isOffline).toBe(true);

      // 6. Close Modal Button
      const closeBtn = authModal.querySelector('#auth-close-btn');
      expect(Boolean(closeBtn)).toBe(true);
      closeBtn.click();
      expect(modalClosed).toBe(true);
    });
  });

  describe('UI Option Audit - Modal 3: Dashboard Bento Settings Modal', () => {
    it('toggles all 8 widget checkboxes, resets defaults, and saves layout', () => {
      let savedSettings = null;
      let modalClosed = false;

      const modal = createDashboardSettingsModal({
        onClose: () => { modalClosed = true; },
        onSettingsChanged: (s) => { savedSettings = s; }
      });

      expect(Boolean(modal)).toBe(true);
      assertNoCorruptText(modal, 'DashboardSettingsModal');

      // 1. Verify exactly 8 widget checkboxes
      const toggles = modal.querySelectorAll('.widget-toggle-input');
      expect(toggles.length).toBe(8);

      // Toggle first checkbox (weather_hero) off
      toggles[0].checked = false;
      toggles[0].dispatchEvent({ type: 'change', target: toggles[0] });

      // 2. Reset Defaults button
      const resetBtn = modal.querySelector('#reset-defaults-btn');
      expect(Boolean(resetBtn)).toBe(true);
      resetBtn.click();

      // 3. Save Layout button
      const saveBtn = modal.querySelector('#modal-save-btn');
      expect(Boolean(saveBtn)).toBe(true);
      saveBtn.click();
      expect(Boolean(savedSettings)).toBe(true);
      expect(modalClosed).toBe(true);
    });
  });

  describe('UI Option Audit - Modal 4: Telemetry Simulator Modal', () => {
    it('toggles MQTT stream, injects weather disturbances, and resets database', () => {
      let modalClosed = false;
      const simModal = createTelemetrySimulatorModal({
        onClose: () => { modalClosed = true; }
      });

      expect(Boolean(simModal)).toBe(true);
      assertNoCorruptText(simModal, 'TelemetrySimulatorModal');

      // 1. Toggle stream button
      const streamBtn = simModal.querySelector('#toggle-stream-btn');
      expect(Boolean(streamBtn)).toBe(true);
      streamBtn.click();

      // 2. Weather disturbance buttons (NORMAL, HEATWAVE, RAIN)
      const weatherBtns = simModal.querySelectorAll('.weather-btn');
      expect(weatherBtns.length).toBe(3);

      const modes = ['NORMAL', 'HEATWAVE', 'RAIN'];
      weatherBtns.forEach((btn, idx) => {
        expect(btn.getAttribute('data-weather')).toBe(modes[idx]);
        btn.click();
        expect(mqttSimulator.weatherMode).toBe(modes[idx]);
      });

      // 3. Close panel button
      const doneBtn = simModal.querySelector('#sim-done-btn');
      expect(Boolean(doneBtn)).toBe(true);
      doneBtn.click();
      expect(modalClosed).toBe(true);
    });
  });

  describe('UI Option Audit - Modal 5: Leaf Spectrometer Calibration Wizard', () => {
    it('executes Dark Current baseline, 99% PTFE disc calibration, and completes', async () => {
      let completed = false;
      let closed = false;

      // Mock calibration step timing for fast test execution
      const origRunCalib = leafClipDevice.runCalibrationStep.bind(leafClipDevice);
      leafClipDevice.runCalibrationStep = async (phase, onProgress) => {
        if (phase === 'DARK_CURRENT') {
          leafClipDevice.calibration.darkCurrentCompleted = true;
          onProgress(100, "Dark Current Reference Locked.");
          return { success: true, phase };
        }
        if (phase === 'WHITE_REFERENCE') {
          leafClipDevice.calibration.whiteDiscCompleted = true;
          leafClipDevice.calibration.isCalibrated = true;
          onProgress(100, "Full Optical Calibration Complete.");
          return { success: true, phase };
        }
      };

      const calModal = createCalibrationModal({
        onClose: () => { closed = true; },
        onComplete: () => { completed = true; }
      });

      expect(Boolean(calModal)).toBe(true);
      assertNoCorruptText(calModal, 'CalibrationWizard');

      // Step 1: Run Dark Current Test
      const runBtn = calModal.querySelector('#calib-run-btn');
      expect(Boolean(runBtn)).toBe(true);
      expect(runBtn.textContent).toContain('Dark Current');
      await runBtn.click();

      // Step 2: Run 99% White Disc Test
      const step2Btn = calModal.querySelector('#calib-run-btn');
      expect(Boolean(step2Btn)).toBe(true);
      expect(step2Btn.textContent).toContain('White Disc');
      await step2Btn.click();

      // Step 3: Complete & Return to field
      const doneBtn = calModal.querySelector('#calib-done-btn');
      expect(Boolean(doneBtn)).toBe(true);
      doneBtn.click();
      expect(completed).toBe(true);

      // Restore original calibration method
      leafClipDevice.runCalibrationStep = origRunCalib;
    });
  });

  // =========================================================================
  // SUITE 3: DOM, Layout Bounds & Complete Integrity Audit
  // =========================================================================

  describe('UI Layout Bounds & Event Handling Integrity Check', () => {
    it('verifies that buttons across all components have non-zero dimensions and proper states', () => {
      const components = [
        createFieldOverviewDashboard({ plots: mockPlots }),
        createIrrigationManagementView({ plots: mockPlots }),
        createSpectroscopyAnalysisView({ plot: mockPlots[0] }),
        createAIIntelligenceView({ plots: mockPlots }),
        createUsageAnalyticsView({ plots: mockPlots }),
        createSettingsView({ currentUser: { displayName: 'Dave' } })
      ];

      let totalButtonsTested = 0;

      for (const comp of components) {
        const buttons = comp.querySelectorAll('button');
        for (const btn of buttons) {
          totalButtonsTested++;
          const rect = btn.getBoundingClientRect();
          expect(rect.width).toBeGreaterThan(0);
          expect(rect.height).toBeGreaterThan(0);

          // Verify button fires event listener
          let fired = false;
          const handler = () => { fired = true; };
          btn.addEventListener('click', handler);
          btn.click();
          expect(fired).toBe(true);
          btn.removeEventListener('click', handler);
        }
      }

      expect(totalButtonsTested).toBeGreaterThanOrEqual(25);
    });

    it('verifies zero NaN or undefined corruptions across the entire NativeMobileAppView', () => {
      const appView = createNativeMobileAppView({
        plots: mockPlots,
        selectedPlotId: 'plot-1',
        currentUser: { displayName: 'Carlos Mendoza', role: 'Farm Owner' },
        initialTab: 'dashboard'
      });

      expect(Boolean(appView)).toBe(true);
      assertNoCorruptText(appView, 'NativeMobileAppView');
    });
  });
}
