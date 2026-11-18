/**
 * Native Mobile App View
 * Full-screen, edge-to-edge unified mobile application for Android / iOS / Capacitor.
 * Follows the lush forest emerald green and clean card style from the user's reference.
 * Strict NO-EMOJI vector UI.
 * Coordinates the 7 modular views:
 *   1. Home / Field Overview
 *   2. Drip Irrigation Hub
 *   3. Spectroscopy Studio
 *   4. Temperature & Humidity Monitor
 *   5. Soil Analysis (LABART 8-in-1)
 *   6. AI Insights & Crop Health
 *   7. Settings & Device Manager
 */

import { createAppNavigationHeader } from './AppNavigationHeader.js';
import { createNavigationDock } from './NavigationDock.js';
import { createFieldOverviewDashboard } from './dashboards/FieldOverviewDashboard.js';
import { createIrrigationManagementView } from './dashboards/IrrigationManagementView.js';
import { createSpectroscopyAnalysisView } from './dashboards/SpectroscopyAnalysisView.js';
import { createEnvironmentMonitorView } from './dashboards/EnvironmentMonitorView.js';
import { createSoilAnalysisView } from './dashboards/SoilAnalysisView.js';
import { createAIIntelligenceView } from './dashboards/AIIntelligenceView.js';
import { createSettingsDeviceManagerView } from './dashboards/SettingsDeviceManagerView.js';
import { INITIAL_FARM_DATA } from '../firebase/mockFirestore.js';

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
  currentUser = null,
  initialTab = 'overview',
  currentTheme = 'creamy-agri',
  onThemeChange
}) {
  const container = document.createElement('div');
  container.className = "native-mobile-app w-full min-h-screen bg-[#F4F6F3] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-[#0E5431] selection:text-white";

  // Tab mapping for backward compatibility
  const TAB_ALIASES = {
    'crop': 'overview',
    'field': 'overview',
    'scan': 'spectroscopy',
    'valves': 'irrigation'
  };

  let activeTab = TAB_ALIASES[initialTab] || initialTab || 'overview';
  let currentPlotId = selectedPlotId || "plot-1";
  const activePlots = (plots && plots.length > 0) ? plots : Object.values(INITIAL_FARM_DATA.plots || {});

  // Main scrollable body container
  const scrollBody = document.createElement('main');
  scrollBody.className = "relative z-10 flex-1 w-full max-w-lg mx-auto px-3.5 pt-3.5 pb-28 overflow-y-auto no-scrollbar scroll-smooth";

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
    onThemeChange,
    currentTheme,
    currentUser
  });
  container.appendChild(header);

  // 2. Append Scroll Body
  container.appendChild(scrollBody);

  // 3. Create Floating Bottom Navigation Dock
  const dock = createNavigationDock({
    activeView: activeTab,
    onNavigate: (targetView) => {
      activeTab = targetView;
      renderActiveScreen();
    }
  });
  container.appendChild(dock.element);

  function getSelectedPlot() {
    return activePlots.find(p => p.id === currentPlotId) || activePlots[0];
  }

  function renderActiveScreen() {
    scrollBody.innerHTML = '';
    dock.setActiveView(activeTab);

    const plot = getSelectedPlot();

    switch (activeTab) {
      case 'overview': {
        const screen = createFieldOverviewDashboard({
          plots: activePlots,
          selectedPlotId: currentPlotId,
          onSelectPlot: (plotId) => {
            currentPlotId = plotId;
            if (onSelectPlot) onSelectPlot(plotId);
            renderActiveScreen();
          },
          onNavigateTab: (targetTab) => {
            activeTab = targetTab;
            renderActiveScreen();
          },
          onActuateValve
        });
        scrollBody.appendChild(screen);
        break;
      }

      case 'irrigation': {
        const screen = createIrrigationManagementView({
          plots: activePlots,
          onActuateValve,
          onEmergencyStop
        });
        scrollBody.appendChild(screen);
        break;
      }

      case 'spectroscopy': {
        const screen = createSpectroscopyAnalysisView({
          plot,
          onOpenCalibration
        });
        scrollBody.appendChild(screen);
        break;
      }

      case 'environment': {
        const screen = createEnvironmentMonitorView();
        scrollBody.appendChild(screen);
        break;
      }

      case 'soil': {
        const screen = createSoilAnalysisView({
          plot
        });
        scrollBody.appendChild(screen);
        break;
      }

      case 'ai': {
        const screen = createAIIntelligenceView({
          plots: activePlots,
          latestScanAnalysis,
          onActuateValve
        });
        scrollBody.appendChild(screen);
        break;
      }

      case 'settings': {
        const screen = createSettingsDeviceManagerView({
          currentUser,
          onOpenSimModal,
          onThemeChange,
          currentTheme
        });
        scrollBody.appendChild(screen);
        break;
      }

      default: {
        const fallback = createFieldOverviewDashboard({
          plots: activePlots,
          selectedPlotId: currentPlotId,
          onSelectPlot,
          onNavigateTab: (tab) => {
            activeTab = tab;
            renderActiveScreen();
          },
          onActuateValve
        });
        scrollBody.appendChild(fallback);
      }
    }

    // Scroll to top on navigation
    scrollBody.scrollTop = 0;
  }

  // Initial render
  renderActiveScreen();

  return container;
}
