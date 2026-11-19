/**
 * AgriSpectra Flow & Field - Main Application Entrypoint
 * Coordinates Role-Based Precision Agronomy Dashboards, Leaf Spectroscopy,
 * 6-Zone Hydraulic Solenoids, Firestore NoSQL, and Login-Based Access Control.
 */
import { firestoreService } from './firebase/firestoreService.js';
import { leafClipDevice } from './hardware/webBluetoothLeafClip.js';
import { mqttSimulator } from './hardware/mqttTelemetrySimulator.js';
import { createSidebar } from './components/Sidebar.js';
import { createHeader } from './components/Header.js';
import { createAuthPortal } from './components/AuthPortal.js';
import { createAuthModal } from './components/AuthModal.js';
import { createOnboardingCarousel, hasCompletedOnboarding, setOnboardingCompleted } from './components/OnboardingCarousel.js';
import { createFarmOwnerDashboard } from './components/dashboards/FarmOwnerDashboard.js';
import { createAgronomistDashboard } from './components/dashboards/AgronomistDashboard.js';
import { createFieldOperatorDashboard } from './components/dashboards/FieldOperatorDashboard.js';
import { createSuperAdminDashboard } from './components/dashboards/SuperAdminDashboard.js';
import { drawSpectralCurve, renderDecisionCards } from './components/SpectroscopyStudio.js';
import { createCalibrationModal } from './components/CalibrationWizard.js';
import { createTelemetrySimulatorModal } from './components/TelemetrySimulatorModal.js';
import { createEnterpriseAdminModal } from './components/EnterpriseAdminModal.js';
import { createCropZoneManagerModal } from './components/CropZoneManagerModal.js';
import { createMobileFrameShowcase } from './components/MobileFrameShowcase.js';
import { createNativeMobileAppView } from './components/NativeMobileAppView.js';
import { createSetuLandingView } from './components/SetuLandingView.js';
import { createCropOverviewScreen } from './components/CropOverviewScreen.js';
import { createFieldZoneScreen } from './components/FieldZoneScreen.js';
import { createClosedLoopSynergySection } from './components/ClosedLoopSynergyCard.js';
import { authService } from './firebase/authService.js';
import { INITIAL_FARM_DATA } from './firebase/mockFirestore.js';
import { generateSpectralSignature, processSpectralVector } from './hardware/chemometricsEngine.js';
import { deviceManager } from './hardware/deviceManager.js';
import { labartSoilSensorUSB } from './hardware/labartSoilSensorUSB.js';
import { spectrometerUSBAdapter } from './hardware/spectrometerUSBAdapter.js';
import { tempHumiditySensorUSB } from './hardware/tempHumiditySensorUSB.js';
import { irrigationControllerAdapter } from './hardware/irrigationControllerAdapter.js';
import { onLocaleChange } from './utils/i18n.js';
import { Capacitor } from '@capacitor/core';

class AgriSpectraApp {
  constructor() {
    this.appEl = document.getElementById('app');
    this.currentTheme = localStorage.getItem('agrispectra_theme') || 'aero-field';

    // Robust detection for native Android / iOS Capacitor container & mobile screens
    const isNative = (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) ||
      (typeof window !== 'undefined' && (
        window.location.protocol === 'capacitor:' ||
        window.location.hostname === 'localhost' ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') ||
        window.innerWidth < 1024
      ));

    this.isNative = Boolean(isNative);
    if (this.isNative) {
      this.viewMode = 'mobile';
      try { localStorage.setItem('agrispectra_view_mode', 'mobile'); } catch (e) {}
    } else {
      const savedMode = localStorage.getItem('agrispectra_view_mode');
      this.viewMode = (savedMode && savedMode !== 'aero-showcase') ? savedMode : 'mobile';
    }
    this.isSidebarOpen = true;
    this.selectedPlotId = localStorage.getItem('agrispectra_selected_plot') || "plot-1";

    // Reactive State with robust offline defaults
    this.plots = Object.values(INITIAL_FARM_DATA.plots || {});
    this.actionRecommendations = Object.values(INITIAL_FARM_DATA.actionRecommendations || {});
    this.irrigationLogs = Object.values(INITIAL_FARM_DATA.irrigationLogs || []);
    this.latestScanAnalysis = null;

    let cachedMetrics = null;
    try {
      const rawMetrics = localStorage.getItem('agrispectra_last_telemetry');
      if (rawMetrics) cachedMetrics = JSON.parse(rawMetrics);
    } catch (e) {}

    this.telemetryMetrics = cachedMetrics || {
      mainlinePressureBar: 2.42,
      activeFlowLph: 0,
      consumedLitersToday: 1845,
      weatherMode: 'NORMAL'
    };

    // Setup lifecycle event handlers for state persistence
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        try {
          localStorage.setItem('agrispectra_last_telemetry', JSON.stringify(this.telemetryMetrics));
          localStorage.setItem('agrispectra_selected_plot', this.selectedPlotId);
        } catch (e) {}
      });

      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          try {
            localStorage.setItem('agrispectra_last_telemetry', JSON.stringify(this.telemetryMetrics));
            localStorage.setItem('agrispectra_selected_plot', this.selectedPlotId);
          } catch (e) {}
        }
      });
    }

    this.bleState = {
      connected: false,
      simulated: true
    };

    this.mqttState = {
      running: false
    };

    // Modular hardware device manager coordinating all 4 adapters
    this.deviceManager = deviceManager;

    // Listen to global switch view events
    window.addEventListener('agrispectra_switch_view', (e) => {
      if (e.detail?.mode) {
        this.viewMode = e.detail.mode === 'web' ? 'desktop' : e.detail.mode;
        localStorage.setItem('agrispectra_view_mode', this.viewMode);
        this.render();
      }
    });

    // User authentication state - Defaults to active grower session
    this.currentUser = authService.getCurrentUser() || {
      uid: "usr-demo-01",
      displayName: "Carlos Mendoza",
      email: "carlos.mendoza@valleyfarms.com",
      role: "Farm Owner",
      farmName: "Sonoma Valley Parcel"
    };
    this.activeRoleView = this.currentUser ? (this.currentUser.role || 'Farm Owner') : 'Farm Owner';

    this.init();
  }

  async init() {
    console.log("[AgriSpectra] Initializing role-based precision agriculture platform...");

    // Bind firestoreService to current user's isolated farm chamber
    try {
      firestoreService.setActiveUser(this.currentUser);
    } catch (e) {
      console.warn("[AgriSpectraApp] Setting active user note:", e);
    }

    // Apply the active theme
    this.applyTheme(this.currentTheme);

    // 1. Connect Simulated BLE device by default
    await leafClipDevice.connect({ forceSimulation: false });
    this.bleState.connected = leafClipDevice.isConnected;
    this.bleState.simulated = leafClipDevice.isSimulated;

    // 2. Initial analysis for selected plot (Plot 2 default)
    const initialSpectrum = generateSpectralSignature({
      vitality: 54,
      waterContent: 0.62,
      nitrogenLevel: 0.55,
      diseaseStress: 0.65
    });
    this.latestScanAnalysis = processSpectralVector(initialSpectrum, "Heirloom Drip Tomatoes", "Fruit Sizing & Ripening");

    // 3. Subscribe to Real-Time Firestore NoSQL Collections
    this.unsubscribePlots = firestoreService.subscribePlots((plots) => {
      this.plots = plots;

      // Auto-fallback if active selected plot was deleted
      if (this.plots.length > 0 && !this.plots.some(p => p.id === this.selectedPlotId)) {
        this.selectedPlotId = this.plots[0].id;
        try { localStorage.setItem('agrispectra_selected_plot', this.selectedPlotId); } catch (e) {}
      }

      if (this.currentUser) this.render();

      // Ensure MQTT simulator has latest plot references
      if (!this.mqttState.running && this.plots.length > 0) {
        mqttSimulator.start(this.plots, (updatedPlot) => {
          firestoreService.updatePlotTelemetry(
            updatedPlot.id,
            updatedPlot.soilSensors,
            updatedPlot.totalLitersDelivered
          );
        });
        this.mqttState.running = true;
      }
    });

    this.unsubscribeCropCatalog = firestoreService.subscribeCropCatalog((crops) => {
      this.cropCatalog = crops;
      if (this.currentUser) this.render();
    });

    this.unsubscribeRecommendations = firestoreService.subscribeActionRecommendations((recs) => {
      this.actionRecommendations = recs;
      if (this.currentUser) this.render();
    });

    this.unsubscribeLogs = firestoreService.subscribeIrrigationLogs((logs) => {
      this.irrigationLogs = logs;
      if (this.currentUser) this.render();
    });

    // 4. Listen to hardware telemetry ticks
    mqttSimulator.on('telemetryTick', (data) => {
      this.telemetryMetrics = {
        mainlinePressureBar: data.mainlinePressureBar,
        activeFlowLph: data.activeFlowLph,
        consumedLitersToday: data.consumedLitersToday,
        weatherMode: data.weatherMode
      };
      this.updateDynamicMetrics();
    });

    mqttSimulator.on('statusChange', ({ running }) => {
      this.mqttState.running = running;
      if (this.currentUser) this.render();
    });

    leafClipDevice.on('connectionChange', ({ status, simulated }) => {
      this.bleState.connected = status === 'CONNECTED';
      this.bleState.simulated = simulated;
      if (this.currentUser) this.render();
    });

    // 5. Auth state listener: synchronizes UI when user logs in or out
    this.unsubscribeAuth = authService.onAuthStateChanged((user) => {
      this.currentUser = user;
      if (user) {
        this.activeRoleView = user.role || 'Farm Owner';
      }
      try {
        firestoreService.setActiveUser(user);
      } catch (e) {
        console.warn("[AgriSpectraApp] Error binding active user chamber:", e);
      }

      // Re-subscribe to real-time collections for the newly active user's isolation chamber
      if (typeof this.unsubscribePlots === 'function') this.unsubscribePlots();
      this.unsubscribePlots = firestoreService.subscribePlots((plots) => {
        this.plots = plots;
        if (this.plots.length > 0 && !this.plots.some(p => p.id === this.selectedPlotId)) {
          this.selectedPlotId = this.plots[0].id;
          try { localStorage.setItem('agrispectra_selected_plot', this.selectedPlotId); } catch (e) {}
        }
        if (this.currentUser) this.render();
      });

      if (typeof this.unsubscribeCropCatalog === 'function') this.unsubscribeCropCatalog();
      this.unsubscribeCropCatalog = firestoreService.subscribeCropCatalog((crops) => {
        this.cropCatalog = crops;
        if (this.currentUser) this.render();
      });

      if (typeof this.unsubscribeRecommendations === 'function') this.unsubscribeRecommendations();
      this.unsubscribeRecommendations = firestoreService.subscribeActionRecommendations((recs) => {
        this.actionRecommendations = recs;
        if (this.currentUser) this.render();
      });

      if (typeof this.unsubscribeLogs === 'function') this.unsubscribeLogs();
      this.unsubscribeLogs = firestoreService.subscribeIrrigationLogs((logs) => {
        this.irrigationLogs = logs;
        if (this.currentUser) this.render();
      });

      this.render();
    });

    // Reactive Locale Change: Re-render web/desktop view if active
    onLocaleChange(() => {
      if (!this.isNative && this.viewMode !== 'mobile') {
        this.render();
      }
    });

    this.render();

    // 6. Cold Launch: Only show carousel in non-native desktop browsers
    if (typeof window !== 'undefined' && !hasCompletedOnboarding() && !this.isNative) {
      setTimeout(() => {
        this.showOnboarding();
      }, 250);
    }
  }

  render() {
    if (!this.appEl) return;
    this.appEl.innerHTML = '';

    // =========================================================================
    // CASE 0: TRUE FULL-SCREEN NATIVE MOBILE APP (Capacitor Android / iOS & Mobile)
    // =========================================================================
    const isNative = (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) ||
      (typeof window !== 'undefined' && (
        window.location.protocol === 'capacitor:' ||
        window.location.hostname === 'localhost' ||
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '') ||
        window.innerWidth < 1024
      ));

    this.isNative = Boolean(isNative || this.isNative);
    if (this.isNative || this.viewMode === 'mobile' || this.viewMode !== 'desktop') {
      this.viewMode = 'mobile';
      const mobileApp = createNativeMobileAppView({
        plots: this.plots,
        selectedPlotId: this.selectedPlotId,
        latestScanAnalysis: this.latestScanAnalysis,
        telemetryMetrics: this.telemetryMetrics,
        actionRecommendations: this.actionRecommendations,
        currentTheme: this.currentTheme,
        onThemeChange: (themeId) => this.setTheme(themeId),
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onAcquireScan: (plotId) => this.handleAcquireScan(plotId),
        onActuateValve: (params) => this.handleActuateValve(params),
        onOpenCalibration: (type) => this.openCalibrationModal(type),
        onEmergencyStop: () => this.handleEmergencyStop(),
        onOpenSimModal: () => this.openTelemetrySimModal(),
        onOpenCropZoneManager: (tab) => this.openCropZoneManagerModal(tab),
        onOpenEnterpriseAdmin: () => this.openEnterpriseAdminModal(),
        onOpenAuthModal: () => this.openAuthModal(),
        onReplayOnboarding: () => this.showOnboarding(),
        onSignOut: () => this.handleSignOut(),
        onSynergyAction: (recId, action) => this.handleSynergyAction(recId, action),
        currentUser: this.currentUser || {
          displayName: "Carlos Mendoza",
          email: "grower@agrispectra.io",
          role: "Farm Owner"
        }
      });

      this.appEl.appendChild(mobileApp);
      return;
    }

    // =========================================================================
    // CASE 1: SETU ENTERPRISE WEB PLATFORM (Default Web Landing & Product Showcase)
    // =========================================================================
    if (this.viewMode === 'website' || this.viewMode === 'aero-showcase') {
      const landingView = createSetuLandingView({
        currentUser: this.currentUser,
        onLaunchDashboard: (role) => {
          if (role) {
            this.activeRoleView = role;
            if (this.currentUser) this.currentUser.role = role;
          }
          this.viewMode = 'overview';
          try { localStorage.setItem('agrispectra_view_mode', 'overview'); } catch (e) {}
          this.render();
        },
        onOpenSignIn: () => {
          this.viewMode = 'mobile';
          try { localStorage.setItem('agrispectra_view_mode', 'mobile'); } catch (e) {}
          this.render();
          this.openAuthModal();
        },
        onOpenRegister: () => {
          this.viewMode = 'mobile';
          try { localStorage.setItem('agrispectra_view_mode', 'mobile'); } catch (e) {}
          this.render();
          this.openAuthModal();
        }
      });

      this.appEl.appendChild(landingView);
      return;
    }

    // =========================================================================
    // CASE 1: UN-AUTHENTICATED VISITOR -> Show Login / Access Portal Gateway
    // =========================================================================
    if (!this.currentUser) {
      const portalWrapper = document.createElement('div');
      portalWrapper.className = "flex-1 flex flex-col min-h-screen bg-[#FBF9F4] dark:bg-slate-900 transition-colors duration-300";

      // Minimal top bar with theme toggle
      const topBar = document.createElement('div');
      topBar.className = "w-full px-6 py-4 flex items-center justify-between border-b border-stone-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md";
      topBar.innerHTML = `
        <div class="flex items-center gap-2.5">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white text-xs font-bold shadow-sm">
            🌾
          </div>
          <span class="text-sm font-extrabold tracking-tight text-stone-900 dark:text-white font-sans">AGRISPECTRA FLOW & FIELD</span>
        </div>

        <div class="flex items-center gap-2">
          <select id="header-theme-select" class="min-h-[38px] px-3 py-1.5 rounded-xl bg-stone-100 dark:bg-slate-800 border border-stone-200 dark:border-slate-700 text-xs font-bold text-stone-700 dark:text-slate-300 focus:outline-none cursor-pointer">
            <option value="creamy-agri" ${this.currentTheme === 'creamy-agri' ? 'selected' : ''}>🌾 Cream & Green</option>
            <option value="lush-emerald" ${this.currentTheme === 'lush-emerald' ? 'selected' : ''}>🌿 Lush Emerald</option>
            <option value="sunlight" ${this.currentTheme === 'sunlight' ? 'selected' : ''}>☀️ Sunlight</option>
            <option value="dark-soil" ${this.currentTheme === 'dark-soil' ? 'selected' : ''}>🌙 Dark Soil</option>
          </select>
        </div>
      `;
      portalWrapper.appendChild(topBar);

      topBar.querySelector('#header-theme-select')?.addEventListener('change', (e) => {
        this.setTheme(e.target.value);
      });

      // The full AuthPortal component
      const authPortal = createAuthPortal({
        onAuthSuccess: (user) => {
          this.currentUser = user;
          this.activeRoleView = user.role || 'Farm Owner';
          this.render();
        }
      });
      portalWrapper.appendChild(authPortal);

      // Simple footer
      const portalFooter = document.createElement('footer');
      portalFooter.className = "py-6 text-center text-xs text-stone-500 dark:text-slate-500 border-t border-stone-200 dark:border-slate-800 font-mono";
      portalFooter.innerHTML = `
        <span>AgriSpectra Flow & Field • Precision Agronomy & ±12V Hydraulic Infrastructure • Multi-Tenant Enterprise</span>
      `;
      portalWrapper.appendChild(portalFooter);

      this.appEl.appendChild(portalWrapper);
      return;
    }

    // =========================================================================
    // CASE 2: AUTHENTICATED USER -> Show Role-Tailored Specialized Dashboard
    // =========================================================================
    const layoutWrapper = document.createElement('div');
    layoutWrapper.className = "flex-1 flex min-h-screen bg-[#F8F5EE] dark:bg-slate-900 transition-colors duration-200";

    // 1. Role-Adaptive Sidebar Navigation
    const sidebar = createSidebar({
      activeView: 'dashboard',
      currentRole: this.activeRoleView,
      onNavigate: (viewId) => {
        // Handle in-dashboard navigation anchors
        if (viewId === 'calibration') {
          this.openCalibrationModal('FULL');
        } else if (viewId === 'telemetry-sim') {
          this.openTelemetrySimModal();
        } else if (viewId === 'audit-reports') {
          const exportBtn = document.getElementById('btn-export-audit');
          if (exportBtn) exportBtn.click();
        }
      },
      onLogout: () => this.handleSignOut()
    });
    if (!this.isSidebarOpen) {
      sidebar.classList.add('hidden');
    }
    layoutWrapper.appendChild(sidebar);

    // 2. Right Content Column
    const rightCol = document.createElement('div');
    rightCol.className = "flex-1 flex flex-col min-w-0";

    // Top Header Bar
    const header = createHeader({
      onEmergencyStop: () => this.handleEmergencyStop(),
      onOpenCalibration: (type) => this.openCalibrationModal(type),
      onOpenSimModal: () => this.openTelemetrySimModal(),
      onThemeChange: (themeId) => this.setTheme(themeId),
      currentTheme: this.currentTheme,
      bleState: this.bleState,
      mqttState: this.mqttState,
      currentUser: this.currentUser,
      activeRoleView: this.activeRoleView,
      activeView: this.viewMode,
      onSelectView: (targetView) => {
        this.viewMode = targetView;
        localStorage.setItem('agrispectra_view_mode', targetView);
        this.render();
      },
      onSelectRoleView: (targetRole) => {
        this.activeRoleView = targetRole;
        const normR = targetRole.toLowerCase().replace(/[\s_-]+/g, '');
        if (normR.includes('agronomist') || normR.includes('science')) {
          this.viewMode = 'spectro';
        } else if (normR.includes('operator') || normR.includes('field')) {
          this.viewMode = 'valves';
        } else if (normR.includes('superadmin') || normR.includes('governance')) {
          this.viewMode = 'governance';
        } else {
          this.viewMode = 'overview';
        }
        this.render();
      },
      onOpenAuthModal: () => {},
      onOpenEnterpriseAdmin: () => this.openEnterpriseAdminModal(),
      onSignOut: () => this.handleSignOut(),
      onToggleSidebar: () => {
        this.isSidebarOpen = !this.isSidebarOpen;
        const sb = document.getElementById('app-sidebar');
        if (sb) sb.classList.toggle('hidden');
      }
    });
    rightCol.appendChild(header);

    // Main Content Area
    const content = document.createElement('main');
    content.className = "w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 flex-1";

    // View-driven rendering with role fallback
    if (this.viewMode === 'overview' || this.viewMode === 'dashboard') {
      const ownerDashboard = createFarmOwnerDashboard({
        plots: this.plots,
        telemetryMetrics: this.telemetryMetrics,
        actionRecommendations: this.actionRecommendations,
        onSynergyAction: (recId, action) => this.handleSynergyAction(recId, action),
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onNavigateToRole: (role) => {
          this.activeRoleView = role;
          this.render();
        },
        announcements: authService.announcements || []
      });
      content.appendChild(ownerDashboard);

    } else if (this.viewMode === 'field') {
      const fieldScreen = createFieldZoneScreen({
        plots: this.plots,
        selectedPlotId: this.selectedPlotId,
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onActuateValve: (params) => this.handleActuateValve(params),
        onBack: () => {
          this.viewMode = 'overview';
          this.render();
        },
        onNavigateTab: (tabId) => {
          this.viewMode = tabId;
          this.render();
        }
      });
      content.appendChild(fieldScreen);

    } else if (this.viewMode === 'crop') {
      const cropScreen = createCropOverviewScreen({
        plots: this.plots,
        selectedPlotId: this.selectedPlotId,
        latestScanAnalysis: this.latestScanAnalysis,
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onAcquireScan: (plotId) => this.handleAcquireScan(plotId),
        onOpenCalibration: () => this.openCalibrationModal('FULL'),
        onBack: () => {
          this.viewMode = 'overview';
          this.render();
        }
      });
      content.appendChild(cropScreen);

    } else if (this.viewMode === 'spectro') {
      const agronomistDashboard = createAgronomistDashboard({
        plots: this.plots,
        selectedPlotId: this.selectedPlotId,
        latestScanAnalysis: this.latestScanAnalysis,
        bleState: this.bleState,
        onAcquireScan: (plotId) => this.handleAcquireScan(plotId),
        onOpenCalibration: (type) => this.openCalibrationModal(type),
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        }
      });
      content.appendChild(agronomistDashboard);

    } else if (this.viewMode === 'valves') {
      const operatorDashboard = createFieldOperatorDashboard({
        plots: this.plots,
        selectedPlotId: this.selectedPlotId,
        telemetryMetrics: this.telemetryMetrics,
        irrigationLogs: this.irrigationLogs,
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onActuateValve: (params) => this.handleActuateValve(params),
        onEmergencyStop: () => this.handleEmergencyStop(),
        onOpenSimModal: () => this.openTelemetrySimModal()
      });
      content.appendChild(operatorDashboard);

    } else if (this.viewMode === 'synergy') {
      const synergySection = createClosedLoopSynergySection(
        this.actionRecommendations,
        (recId, action) => this.handleSynergyAction(recId, action)
      );
      content.appendChild(synergySection);

    } else if (this.viewMode === 'overview') {
      const ownerDashboard = createFarmOwnerDashboard({
        plots: this.plots,
        telemetryMetrics: this.telemetryMetrics,
        actionRecommendations: this.actionRecommendations,
        onSynergyAction: (recId, action) => this.handleSynergyAction(recId, action),
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onNavigateToRole: (role) => {
          this.activeRoleView = role;
          this.render();
        },
        announcements: authService.announcements || []
      });
      content.appendChild(ownerDashboard);

    } else if (this.viewMode === 'governance') {
      const adminDashboard = createSuperAdminDashboard({
        onGlobalEmergencyStop: () => this.handleEmergencyStop(),
        onOpenSimModal: () => this.openTelemetrySimModal(),
        onNavigateToRole: (role) => {
          this.activeRoleView = role;
          this.render();
        }
      });
      content.appendChild(adminDashboard);

    } else {
      // Default: Farm Owner Dashboard
      const ownerDashboard = createFarmOwnerDashboard({
        plots: this.plots,
        telemetryMetrics: this.telemetryMetrics,
        actionRecommendations: this.actionRecommendations,
        onSynergyAction: (recId, action) => this.handleSynergyAction(recId, action),
        onSelectPlot: (plotId) => {
          this.selectedPlotId = plotId;
          this.render();
        },
        onNavigateToRole: (role) => {
          this.activeRoleView = role;
          this.render();
        },
        announcements: authService.announcements || []
      });
      content.appendChild(ownerDashboard);
    }

    // Footer Audit Info
    const footer = document.createElement('footer');
    footer.className = "py-6 border-t border-stone-200 dark:border-slate-800 text-center text-xs text-stone-500 dark:text-slate-500 font-mono";
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
        <span>AGRISPECTRA FLOW & FIELD • ${this.activeRoleView.toUpperCase()} WORKSPACE</span>
        <span>Authenticated as ${this.currentUser.email} (${this.currentUser.role || 'User'})</span>
      </div>
    `;
    content.appendChild(footer);

    rightCol.appendChild(content);
    layoutWrapper.appendChild(rightCol);
    this.appEl.appendChild(layoutWrapper);

    // If Spectroscopy canvas is present, render spectral canvas & decision cards
    if (document.getElementById('spectral-canvas')) {
      this.postRenderSpectroscopy();
    }
  }

  postRenderSpectroscopy() {
    const canvas = document.getElementById('spectral-canvas');
    const studioSection = document.getElementById('spectroscopy-studio-section');
    if (canvas && this.latestScanAnalysis) {
      drawSpectralCurve(canvas, this.latestScanAnalysis.rawSpectrumPreview);
    }
    if (studioSection && this.latestScanAnalysis) {
      const selectedPlot = this.plots.find(p => p.id === this.selectedPlotId) || this.plots[0];
      renderDecisionCards(
        studioSection,
        this.latestScanAnalysis,
        selectedPlot?.crop || "Bell Peppers",
        selectedPlot?.plotNumber || 1
      );
    }
  }

  /**
   * Acquire a fresh spectral leaf scan for targeted plot
   */
  async handleAcquireScan(plotId) {
    this.selectedPlotId = plotId;
    const plot = this.plots.find(p => p.id === plotId) || this.plots[0];
    
    let avgVwc = 25.0;
    if (plot?.soilSensors && plot.soilSensors.length > 0) {
      avgVwc = plot.soilSensors.reduce((a, s) => a + Number(s.vwc), 0) / plot.soilSensors.length;
    }

    try {
      const analysis = await leafClipDevice.acquireScan({
        plotNumber: plot?.plotNumber || 1,
        cropName: plot?.crop || "Bell Peppers",
        growthStage: plot?.stage || "Fruit Formation",
        soilVwc: avgVwc
      });

      this.latestScanAnalysis = analysis;

      await firestoreService.saveLeafScan({
        plotId: plot.id,
        crop: plot.crop,
        ...analysis
      });

      this.postRenderSpectroscopy();
    } catch (err) {
      alert("Scan error: " + err.message);
    }
  }

  /**
   * Actuate a solenoid valve (+12V open / -12V close)
   */
  async handleActuateValve({ plotId, gateId, action, durationMinutes }) {
    try {
      await firestoreService.actuateValve({
        plotId,
        gateId,
        action,
        durationMinutes,
        triggeredBy: "MANUAL"
      });
    } catch (err) {
      console.error("Actuation error:", err);
      alert("Failed to actuate valve: " + err.message);
    }
  }

  /**
   * Handle Smart Recommendation Action (APPROVE / DISMISS)
   */
  async handleSynergyAction(recId, action) {
    try {
      await firestoreService.handleRecommendationAction(recId, action);
    } catch (err) {
      console.error("Recommendation action error:", err);
    }
  }

  /**
   * Emergency 1-tap shut off all valves
   */
  async handleEmergencyStop() {
    const confirmed = confirm("EMERGENCY KILLSWITCH: Are you sure you want to send immediate -12V reverse latch pulses to close ALL 6 valves?");
    if (!confirmed) return;

    try {
      const result = await firestoreService.emergencyShutOffAll();
      alert(`SAFETY ACTIVATED: ${result.closedCount} active valves closed simultaneously. System locked.`);
    } catch (err) {
      alert("Emergency shutoff failed: " + err.message);
    }
  }

  /**
   * Set and persist visual theme
   */
  setTheme(themeId) {
    this.currentTheme = themeId;
    try {
      localStorage.setItem('agrispectra_theme', themeId);
    } catch (e) {}
    this.applyTheme(themeId);
    this.render();
  }

  applyTheme(themeId) {
    const body = document.body;
    body.classList.remove('theme-aero-field', 'theme-official-enterprise', 'theme-creamy-agri', 'theme-lush-emerald', 'theme-sunlight', 'theme-dark-soil', 'sunlight-mode');
    
    if (themeId === 'aero-field') {
      body.classList.add('theme-aero-field');
    } else if (themeId === 'sunlight') {
      body.classList.add('theme-sunlight', 'sunlight-mode');
    } else if (themeId === 'lush-emerald') {
      body.classList.add('theme-lush-emerald');
    } else if (themeId === 'dark-soil') {
      body.classList.add('theme-dark-soil');
    } else if (themeId === 'creamy-agri') {
      body.classList.add('theme-creamy-agri');
    } else {
      body.classList.add('theme-aero-field');
    }
  }

  openCalibrationModal(type = 'FULL') {
    const modal = createCalibrationModal({
      onClose: () => modal.remove(),
      onComplete: () => {
        modal.remove();
        this.render();
      }
    });
    document.body.appendChild(modal);
  }

  openTelemetrySimModal() {
    const modal = createTelemetrySimulatorModal({
      onClose: () => modal.remove()
    });
    document.body.appendChild(modal);
  }

  openEnterpriseAdminModal() {
    const modal = createEnterpriseAdminModal({
      onClose: () => modal.remove(),
      onGlobalEmergencyStop: () => this.handleEmergencyStop()
    });
    document.body.appendChild(modal);
  }

  openCropZoneManagerModal(initialTab = 'zones') {
    const modal = createCropZoneManagerModal({
      initialTab,
      selectedPlotId: this.selectedPlotId,
      onClose: () => {
        this.render();
      },
      onSelectPlot: (plotId) => {
        this.selectedPlotId = plotId;
        try { localStorage.setItem('agrispectra_selected_plot', this.selectedPlotId); } catch (e) {}
        this.render();
      },
      onPlotDeleted: (deletedPlotId, fallbackPlotId) => {
        if (this.selectedPlotId === deletedPlotId) {
          this.selectedPlotId = fallbackPlotId;
          try { localStorage.setItem('agrispectra_selected_plot', this.selectedPlotId); } catch (e) {}
          this.render();
        }
      }
    });
    document.body.appendChild(modal);
  }

  showOnboarding() {
    const existing = document.getElementById('agrispectra-onboarding-modal');
    if (existing) existing.remove();
    const carousel = createOnboardingCarousel({
      onComplete: () => {
        this.render();
      },
      onContinueAsGuest: () => {
        this.currentUser = authService.getCurrentUser();
        this.activeRoleView = this.currentUser?.role || 'Field Operator';
        this.render();
      }
    });
    document.body.appendChild(carousel);
  }

  openAuthModal(initialMode = 'SIGN_IN') {
    const modal = createAuthModal({
      initialMode,
      onClose: () => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      },
      onAuthSuccess: (user) => {
        this.currentUser = user;
        this.activeRoleView = user.role || 'Farm Owner';
        this.render();
      }
    });
    document.body.appendChild(modal);
  }

  async handleSignOut() {
    await authService.signOut();
    this.currentUser = null;
    this.render();
  }

  /**
   * Lightweight dynamic metric updates on MQTT ticks
   */
  updateDynamicMetrics() {
    // If elements in DOM have pressure or flow, update dynamically
    const pressureEls = document.querySelectorAll('.dynamic-mainline-pressure');
    pressureEls.forEach(el => {
      el.textContent = `${this.telemetryMetrics.mainlinePressureBar} Bar`;
    });
  }
}

// Instantiate on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.agriSpectraApp = new AgriSpectraApp();
  window.deviceManager = deviceManager;
  window.hardware = {
    deviceManager,
    labartSoilSensorUSB,
    spectrometerUSBAdapter,
    tempHumiditySensorUSB,
    irrigationControllerAdapter
  };

  // Handle PWA Service Worker: only for web browser, bypass in native Capacitor container
  const isCapacitor = Boolean(window.Capacitor?.isNativePlatform && window.Capacitor.isNativePlatform());
  if ('serviceWorker' in navigator) {
    if (isCapacitor) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (let registration of registrations) {
          registration.unregister();
        }
      });
    } else if (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[AgriSpectra PWA] Service Worker registered:', reg.scope))
        .catch((err) => console.warn('[AgriSpectra PWA] Service Worker registration failed:', err));
    }
  }
});
