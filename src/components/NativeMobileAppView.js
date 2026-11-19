/**
 * Native Mobile App View
 * Full-screen, edge-to-edge unified mobile application for Android / iOS / Capacitor / Mobile Web.
 * Follows the lush forest emerald green and clean card style.
 * Coordinates the 6 primary tabs + Network Connectivity Banner:
 *   1. Dashboard (Overview, 1-Acre Plot Canvas, Vitality gauge, quick actions)
 *   2. Irrigation (Valve Control Center, bi-stable latching solenoids, emergency stop, mainline pressure)
 *   3. Spectroscopy (Leaf-clip BLE scanner, 76-band chemometrics, 5 farmer decisions, calibration)
 *   4. Synergy (Closed-loop leaf-to-valve smart recommendation cards & AI Intelligence)
 *   5. Usage (UsageAnalyticsView: cumulative water in liters per zone, valve cycle counts, leaf scan archives, CSV export)
 *   6. Settings (SettingsView: Profile details, Google linked account, Farm plot targets, valve pulse timing, offline cache flush, sunlight glare mode toggle, audio language, log out)
 */

import { createAppNavigationHeader } from './AppNavigationHeader.js';
import { createBottomNavBar } from './BottomNavBar.js';
import { createFieldOverviewDashboard } from './dashboards/FieldOverviewDashboard.js';
import { createIrrigationManagementView } from './dashboards/IrrigationManagementView.js';
import { createSpectroscopyAnalysisView } from './dashboards/SpectroscopyAnalysisView.js';
import { createEnvironmentMonitorView } from './dashboards/EnvironmentMonitorView.js';
import { createSoilAnalysisView } from './dashboards/SoilAnalysisView.js';
import { createAIIntelligenceView } from './dashboards/AIIntelligenceView.js';
import { createUsageAnalyticsView } from './UsageAnalyticsView.js';
import { createSettingsView } from './SettingsView.js';
import { createSettingsDeviceManagerView } from './dashboards/SettingsDeviceManagerView.js';
import { INITIAL_FARM_DATA } from '../firebase/mockFirestore.js';
import { onLocaleChange } from '../utils/i18n.js';

export function createNativeMobileAppView({
  plots = [],
  selectedPlotId = "plot-1",
  latestScanAnalysis = null,
  telemetryMetrics = {},
  actionRecommendations = [],
  onSelectPlot,
  onAcquireScan,
  onActuateValve,
  onOpenCalibration,
  onEmergencyStop,
  onOpenSimModal,
  onOpenEnterpriseAdmin,
  onOpenCropZoneManager,
  currentUser = null,
  initialTab = 'dashboard',
  currentTheme = 'creamy-agri',
  onThemeChange,
  onOpenAuthModal,
  onReplayOnboarding,
  onSignOut,
  onSynergyAction
}) {
  const container = document.createElement('div');
  container.className = "native-mobile-app w-full h-screen h-[100dvh] max-h-[100dvh] bg-[#F4F6F3] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col relative overflow-hidden selection:bg-[#0E5431] selection:text-white";

  // Tab mapping for backward compatibility
  const TAB_ALIASES = {
    'overview': 'dashboard',
    'crop': 'dashboard',
    'field': 'dashboard',
    'scan': 'spectroscopy',
    'valves': 'irrigation',
    'ai': 'synergy',
    'weather': 'environment',
    'climate': 'environment'
  };

  let activeTab = TAB_ALIASES[initialTab] || initialTab || 'dashboard';
  let currentPlotId = selectedPlotId || "plot-1";
  const activePlots = (plots && plots.length > 0) ? plots : Object.values(INITIAL_FARM_DATA.plots || {});

  // Compute pending synergy recommendations count for bottom badge
  const pendingSynergyCount = (actionRecommendations || []).filter(r => r?.status === 'PENDING').length;

  // 1. Create Top Header
  const header = createAppNavigationHeader({
    plots: activePlots,
    selectedPlotId: currentPlotId,
    onSelectPlot: (plotId) => {
      currentPlotId = plotId;
      if (onSelectPlot) onSelectPlot(plotId);
      renderActiveScreen();
    },
    onEmergencyStop,
    onOpenSimModal,
    onOpenCalibration,
    onOpenEnterpriseAdmin,
    onOpenCropZoneManager,
    onNavigate: (targetView) => {
      activeTab = TAB_ALIASES[targetView] || targetView;
      renderActiveScreen();
    },
    onThemeChange,
    currentTheme,
    currentUser,
    onOpenAuthModal,
    onSignOut
  });
  header.classList.add('flex-shrink-0');
  container.appendChild(header);

  // 3. Main scrollable body container
  const scrollBody = document.createElement('main');
  scrollBody.className = "relative z-10 flex-1 w-full max-w-lg mx-auto px-3.5 pt-3 pb-36 overflow-y-auto overflow-x-hidden no-scrollbar scroll-smooth";
  container.appendChild(scrollBody);

  // 4. Create Floating Bottom Navigation Bar (6 Tabs)
  const bottomNav = createBottomNavBar({
    activeTab: activeTab,
    badges: {
      synergy: pendingSynergyCount,
      ai: pendingSynergyCount
    },
    onTabChange: (targetTab) => {
      activeTab = TAB_ALIASES[targetTab] || targetTab;
      renderActiveScreen();
    }
  });
  container.appendChild(bottomNav.element);

  function getSelectedPlot() {
    return activePlots.find(p => p.id === currentPlotId) || activePlots[0];
  }

  function createScreenFallback(tabName, error) {
    const card = document.createElement('div');
    card.className = "w-full bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-emerald-900/10 dark:border-slate-800 text-center space-y-4 my-6";
    card.innerHTML = `
      <div class="w-14 h-14 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#0E5431] dark:text-emerald-300 flex items-center justify-center border border-emerald-500/20">
        ${icon('shieldCheck', 'w-7 h-7')}
      </div>
      <div>
        <h3 class="text-base font-bold text-slate-900 dark:text-white capitalize">${tabName} View Active</h3>
        <p class="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Hardware safe baseline active. Live sensor and hydraulic telemetry cached locally.
        </p>
      </div>
      <div class="flex items-center justify-center gap-2 pt-2">
        <button 
          type="button" 
          id="btn-fallback-retry"
          class="px-4 py-2 rounded-full bg-[#0E5431] hover:bg-[#083820] text-white text-xs font-bold transition active:scale-95 shadow-sm"
        >
          Reload Tab
        </button>
        <button 
          type="button" 
          id="btn-fallback-home"
          class="px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold hover:bg-slate-200 transition"
        >
          Return to Overview
        </button>
      </div>
    `;
    card.querySelector('#btn-fallback-retry')?.addEventListener('click', () => {
      renderActiveScreen();
    });
    card.querySelector('#btn-fallback-home')?.addEventListener('click', () => {
      activeTab = 'overview';
      renderActiveScreen();
    });
    return card;
  }

  function renderScreenSafely(createScreenFn, tabName) {
    try {
      const screen = createScreenFn();
      if (screen && screen.nodeType) {
        scrollBody.appendChild(screen);
      }
    } catch (err) {
      console.error(`[NativeApp] Error rendering screen for tab "${tabName}":`, err);
      const fallback = createScreenFallback(tabName, err);
      scrollBody.appendChild(fallback);
    }
  }

  function renderActiveScreen() {
    scrollBody.innerHTML = '';
    bottomNav.setActiveTab(activeTab);

    const plot = getSelectedPlot();

    switch (activeTab) {
      case 'dashboard':
      case 'overview': {
        renderScreenSafely(() => {
          return createFieldOverviewDashboard({
            plots: activePlots,
            selectedPlotId: currentPlotId,
            onSelectPlot: (plotId) => {
              currentPlotId = plotId;
              if (onSelectPlot) onSelectPlot(plotId);
              renderActiveScreen();
            },
            onNavigateTab: (targetTab) => {
              activeTab = TAB_ALIASES[targetTab] || targetTab;
              renderActiveScreen();
            },
            onActuateValve,
            onOpenCropZoneManager,
            actionRecommendations,
            telemetryMetrics,
            onSynergyAction
          });
        }, 'overview');
        break;
      }

      case 'irrigation': {
        renderScreenSafely(() => {
          return createIrrigationManagementView({
            plots: activePlots,
            onActuateValve,
            onEmergencyStop
          });
        }, 'irrigation');
        break;
      }

      case 'spectroscopy': {
        renderScreenSafely(() => {
          return createSpectroscopyAnalysisView({
            plot,
            latestScanAnalysis,
            onAcquireScan,
            onOpenCalibration
          });
        }, 'spectroscopy');
        break;
      }

      case 'synergy':
      case 'ai': {
        renderScreenSafely(() => {
          return createAIIntelligenceView({
            plots: activePlots,
            latestScanAnalysis,
            actionRecommendations,
            onActuateValve,
            onSynergyAction
          });
        }, 'ai');
        break;
      }

      case 'usage': {
        renderScreenSafely(() => {
          return createUsageAnalyticsView({
            plots: activePlots,
            telemetryMetrics,
            scanHistory: []
          });
        }, 'usage');
        break;
      }

      case 'settings': {
        renderScreenSafely(() => {
          return createSettingsView({
            currentUser,
            onThemeChange,
            currentTheme,
            onSignOut,
            onOpenAuthModal,
            onReplayOnboarding,
            onOpenSimModal,
            onOpenCalibration
          });
        }, 'settings');
        break;
      }

      case 'soil': {
        renderScreenSafely(() => {
          return createSoilAnalysisView({ plot });
        }, 'soil');
        break;
      }

      case 'weather':
      case 'environment': {
        renderScreenSafely(() => {
          return createEnvironmentMonitorView();
        }, 'weather');
        break;
      }

      default: {
        renderScreenSafely(() => {
          return createFieldOverviewDashboard({
            plots: activePlots,
            selectedPlotId: currentPlotId,
            onSelectPlot,
            onNavigateTab: (tab) => {
              activeTab = TAB_ALIASES[tab] || tab;
              renderActiveScreen();
            },
            onActuateValve,
            actionRecommendations,
            telemetryMetrics,
            onSynergyAction
          });
        }, 'overview');
      }
    }

    // Scroll to top on navigation
    scrollBody.scrollTop = 0;
  }

  // Subscribe to reactive locale changes to update active screen instantly
  onLocaleChange(() => {
    renderActiveScreen();
  });

  // Initial render
  renderActiveScreen();

  return container;
}
