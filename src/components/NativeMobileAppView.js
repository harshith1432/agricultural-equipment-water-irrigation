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
import { icon } from '../utils/icons.js';

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
  onSynergyAction,
  onTabChange
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

  const savedTab = (() => {
    try { return localStorage.getItem('agrispectra_mobile_tab'); } catch (e) { return null; }
  })();
  let activeTab = TAB_ALIASES[initialTab] || TAB_ALIASES[savedTab] || savedTab || initialTab || 'spectroscopy';
  let currentPlotId = selectedPlotId || "plot-1";
  let activePlots = (plots && plots.length > 0) ? plots : Object.values(INITIAL_FARM_DATA.plots || {});

  // Compute pending synergy recommendations count for bottom badge
  const pendingSynergyCount = (actionRecommendations || []).filter(r => r?.status === 'PENDING').length;

  // 1. Create Top Header
  const header = createAppNavigationHeader({
    plots: activePlots,
    selectedPlotId: currentPlotId,
    onSelectPlot: (plotId) => {
      currentPlotId = plotId;
      if (onSelectPlot) onSelectPlot(plotId);
      renderActiveScreen({ resetScroll: false });
    },
    onEmergencyStop,
    onOpenSimModal,
    onOpenCalibration,
    onOpenEnterpriseAdmin,
    onOpenCropZoneManager,
    onNavigate: (targetView) => {
      activeTab = TAB_ALIASES[targetView] || targetView;
      try { localStorage.setItem('agrispectra_mobile_tab', activeTab); } catch (e) {}
      if (typeof onTabChange === 'function') onTabChange(activeTab);
      renderActiveScreen({ resetScroll: false });
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
  scrollBody.className = "relative z-10 flex-1 w-full max-w-lg mx-auto px-3.5 pt-3 pb-36 overflow-y-auto overflow-x-hidden no-scrollbar";
  scrollBody.style.overscrollBehaviorY = 'contain';
  scrollBody.style.webkitOverflowScrolling = 'touch';
  container.appendChild(scrollBody);

  // Per-tab Screen Cache & persistent scroll position dictionary
  const screenCache = {};
  const tabScrollPositions = {};
  let currentActiveTabKey = null;

  // Continuously record user scroll position per tab
  scrollBody.addEventListener('scroll', () => {
    if (currentActiveTabKey) {
      tabScrollPositions[currentActiveTabKey] = scrollBody.scrollTop;
    }
  }, { passive: true });

  // 4. Create Floating Bottom Navigation Bar (6 Tabs)
  const bottomNav = createBottomNavBar({
    activeTab: activeTab,
    badges: {
      synergy: pendingSynergyCount,
      ai: pendingSynergyCount
    },
    onTabChange: (targetTab) => {
      activeTab = TAB_ALIASES[targetTab] || targetTab;
      try { localStorage.setItem('agrispectra_mobile_tab', activeTab); } catch (e) {}
      if (typeof onTabChange === 'function') onTabChange(activeTab);
      renderActiveScreen({ resetScroll: false });
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
      delete screenCache[activeTab];
      renderActiveScreen({ resetScroll: false });
    });
    card.querySelector('#btn-fallback-home')?.addEventListener('click', () => {
      activeTab = 'overview';
      renderActiveScreen({ resetScroll: true });
    });
    return card;
  }

  function createScreenForTab(tabKey) {
    const plot = getSelectedPlot();

    switch (tabKey) {
      case 'dashboard':
      case 'overview':
        return createFieldOverviewDashboard({
          plots: activePlots,
          selectedPlotId: currentPlotId,
          onSelectPlot: (plotId) => {
            currentPlotId = plotId;
            if (onSelectPlot) onSelectPlot(plotId);
            delete screenCache['dashboard'];
            delete screenCache['overview'];
            renderActiveScreen({ resetScroll: false });
          },
          onNavigateTab: (targetTab) => {
            activeTab = TAB_ALIASES[targetTab] || targetTab;
            try { localStorage.setItem('agrispectra_mobile_tab', activeTab); } catch (e) {}
            if (typeof onTabChange === 'function') onTabChange(activeTab);
            renderActiveScreen({ resetScroll: true });
          },
          onActuateValve,
          onOpenCropZoneManager,
          actionRecommendations,
          telemetryMetrics,
          onSynergyAction
        });

      case 'irrigation':
        return createIrrigationManagementView({
          plots: activePlots,
          onActuateValve,
          onEmergencyStop
        });

      case 'spectroscopy':
        return createSpectroscopyAnalysisView({
          plot,
          latestScanAnalysis,
          onAcquireScan,
          onOpenCalibration
        });

      case 'synergy':
      case 'ai':
        return createAIIntelligenceView({
          plots: activePlots,
          latestScanAnalysis,
          actionRecommendations,
          onActuateValve,
          onSynergyAction
        });

      case 'usage':
        return createUsageAnalyticsView({
          plots: activePlots,
          telemetryMetrics,
          scanHistory: []
        });

      case 'settings':
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

      case 'soil':
        return createSoilAnalysisView({ plot });

      case 'weather':
      case 'environment':
        return createEnvironmentMonitorView();

      default:
        return createFieldOverviewDashboard({
          plots: activePlots,
          selectedPlotId: currentPlotId,
          onSelectPlot,
          onNavigateTab: (tab) => {
            activeTab = TAB_ALIASES[tab] || tab;
            renderActiveScreen({ resetScroll: true });
          },
          onActuateValve,
          actionRecommendations,
          telemetryMetrics,
          onSynergyAction
        });
    }
  }

  function renderActiveScreen({ resetScroll = false } = {}) {
    const normalizedTab = TAB_ALIASES[activeTab] || activeTab || 'dashboard';

    // If current tab screen is already mounted in DOM and resetScroll is false, do not rebuild or touch DOM
    if (currentActiveTabKey === normalizedTab && !resetScroll && screenCache[normalizedTab]) {
      bottomNav.setActiveTab(normalizedTab);
      return;
    }

    // Save previous tab's scroll position before leaving it
    if (currentActiveTabKey && currentActiveTabKey !== normalizedTab) {
      tabScrollPositions[currentActiveTabKey] = scrollBody.scrollTop;
    }

    bottomNav.setActiveTab(normalizedTab);

    let screen = screenCache[normalizedTab];
    if (!screen) {
      try {
        screen = createScreenForTab(normalizedTab);
        screenCache[normalizedTab] = screen;
      } catch (err) {
        console.error(`[NativeApp] Error rendering screen for tab "${normalizedTab}":`, err);
        screen = createScreenFallback(normalizedTab, err);
      }
    }

    // Atomic replacement: replaces screen without destroying container or resetting height to 0
    if (typeof scrollBody.replaceChildren === 'function') {
      scrollBody.replaceChildren(screen);
    } else {
      scrollBody.innerHTML = '';
      scrollBody.appendChild(screen);
    }
    currentActiveTabKey = normalizedTab;

    if (resetScroll) {
      scrollBody.scrollTop = 0;
      tabScrollPositions[normalizedTab] = 0;
    } else {
      const targetScroll = tabScrollPositions[normalizedTab] || 0;
      scrollBody.scrollTop = targetScroll;
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 0);
      raf(() => {
        if (scrollBody.scrollTop !== targetScroll) {
          scrollBody.scrollTop = targetScroll;
        }
      });
    }
  }

  // Exposed update method for data subscriptions without destroying UI or resetting scroll
  container.updateData = function(newData = {}) {
    if (newData.plots && Array.isArray(newData.plots)) {
      activePlots = newData.plots;
    }
    if (newData.actionRecommendations && Array.isArray(newData.actionRecommendations)) {
      actionRecommendations = newData.actionRecommendations;
      const count = actionRecommendations.filter(r => r?.status === 'PENDING').length;
      bottomNav.setBadge('synergy', count);
      bottomNav.setBadge('ai', count);
    }
    if (newData.telemetryMetrics) {
      telemetryMetrics = newData.telemetryMetrics;
    }
    if (newData.selectedPlotId && newData.selectedPlotId !== currentPlotId) {
      currentPlotId = newData.selectedPlotId;
      delete screenCache['dashboard'];
      delete screenCache['overview'];
      delete screenCache['soil'];
      renderActiveScreen({ resetScroll: false });
      return;
    }

    // Dynamic in-place metric updates on the active screen without DOM teardown or scroll bounce
    const activeScreen = screenCache[currentActiveTabKey];
    if (activeScreen && typeof activeScreen.updateTelemetry === 'function') {
      activeScreen.updateTelemetry(telemetryMetrics);
    }
  };

  // Subscribe to reactive locale changes to update active screen instantly
  onLocaleChange(() => {
    const savedScroll = scrollBody.scrollTop;
    Object.keys(screenCache).forEach(k => delete screenCache[k]);
    renderActiveScreen({ resetScroll: false });
    scrollBody.scrollTop = savedScroll;
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => {
        scrollBody.scrollTop = savedScroll;
      });
    }
  });

  // Initial render
  renderActiveScreen({ resetScroll: true });

  return container;
}
