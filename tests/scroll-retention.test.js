import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';

// Initialize headless DOM
setupHeadlessDOM();

import { createNativeMobileAppView } from '../src/components/NativeMobileAppView.js';
import { INITIAL_FARM_DATA } from '../src/firebase/mockFirestore.js';

export function registerScrollRetentionTests() {
  describe('Scroll Retention and Auto-Bounce-to-Top Defenses', () => {
    const mockPlots = Object.values(INITIAL_FARM_DATA.plots || {});

    it('preserves scroll position when updateData receives background telemetry ticks', () => {
      const appView = createNativeMobileAppView({
        plots: mockPlots,
        selectedPlotId: 'plot-1',
        initialTab: 'dashboard'
      });

      const main = appView.querySelector('main');
      expect(Boolean(main)).toBe(true);

      // Simulate user scrolling down towards bottom of the page
      main.scrollTop = 950;
      expect(main.scrollTop).toBe(950);

      // Background MQTT / telemetry tick occurs
      appView.updateData({
        plots: mockPlots,
        telemetryMetrics: {
          mainlinePressureBar: 2.8,
          activeFlowLph: 960,
          consumedLitersToday: 2100
        },
        actionRecommendations: []
      });

      // Verify main scroll position is strictly preserved and did NOT snap back to 0
      expect(main.scrollTop).toBe(950);
    });

    it('preserves scroll position across multiple consecutive high-frequency background ticks', () => {
      const appView = createNativeMobileAppView({
        plots: mockPlots,
        selectedPlotId: 'plot-1',
        initialTab: 'settings'
      });

      const main = appView.querySelector('main');
      expect(Boolean(main)).toBe(true);

      // User scrolls to the bottom of Settings view
      main.scrollTop = 1400;
      expect(main.scrollTop).toBe(1400);

      // Simulate 10 rapid telemetry ticks (as occurs from MQTT simulator)
      for (let i = 0; i < 10; i++) {
        appView.updateData({
          telemetryMetrics: {
            mainlinePressureBar: 2.1 + (i * 0.1),
            consumedLitersToday: 1800 + (i * 50)
          }
        });
        // Scroll position must NEVER be reset to 0
        expect(main.scrollTop).toBe(1400);
      }
    });

    it('retains independent scroll positions when switching back and forth between tabs', () => {
      const appView = createNativeMobileAppView({
        plots: mockPlots,
        selectedPlotId: 'plot-1',
        initialTab: 'dashboard'
      });

      const main = appView.querySelector('main');

      // 1. Scroll on Dashboard
      main.scrollTop = 620;

      // 2. Switch to Settings
      const settingsBtn = appView.querySelector('.bottom-nav-btn[data-tab-id="settings"]');
      expect(Boolean(settingsBtn)).toBe(true);
      settingsBtn.click();

      // In settings, initially top
      expect(main.scrollTop).toBe(0);

      // User scrolls to 850 in Settings
      main.scrollTop = 850;
      expect(main.scrollTop).toBe(850);

      // 3. Switch back to Dashboard (Home)
      const homeBtn = appView.querySelector('.bottom-nav-btn[data-tab-id="dashboard"]');
      expect(Boolean(homeBtn)).toBe(true);
      homeBtn.click();

      // Dashboard scroll position must be faithfully restored to 620
      expect(main.scrollTop).toBe(620);

      // 4. Switch back to Settings
      settingsBtn.click();
      // Settings scroll position must be restored to 850
      expect(main.scrollTop).toBe(850);
    });
  });
}
