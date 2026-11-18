/**
 * AgriSpectra Flow & Field - Exhaustive Multi-Language Verification Test Suite
 *
 * Requirements:
 *   1. Test all 8 supported languages:
 *      - English ('en')
 *      - Kannada ('kn' - ಕನ್ನಡ)
 *      - Hindi ('hi' - हिन्दी)
 *      - Telugu ('te' - తెలుగు)
 *      - Tamil ('ta' - தமிழ்)
 *      - Malayalam ('ml' - മലയാളം)
 *      - Marathi ('mr' - मराठी)
 *      - Spanish ('es' - Español)
 *   2. For each language, verify that key screens and components translate dynamically:
 *      - AppNavigationHeader
 *      - NavigationDock
 *      - FieldOverviewDashboard
 *      - IrrigationManagementView
 *      - SpectroscopyAnalysisView
 *      - SoilAnalysisView
 *      - EnvironmentMonitorView
 *      - AIIntelligenceView
 *      - SettingsView
 *      - UsageAnalyticsView
 *      - CropZoneManagerModal
 *   3. Confirm that 100% of dictionary keys exist and no missing tokens fallback.
 *   4. Execute 3 consecutive complete testing cycles to guarantee repeatable stability.
 */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { setLocale, getLocale, t, SUPPORTED_LOCALES, DICTIONARY } from '../src/utils/i18n.js';
import { createAppNavigationHeader } from '../src/components/AppNavigationHeader.js';
import { createNavigationDock } from '../src/components/NavigationDock.js';
import { createFieldOverviewDashboard } from '../src/components/dashboards/FieldOverviewDashboard.js';
import { createIrrigationManagementView } from '../src/components/dashboards/IrrigationManagementView.js';
import { createSpectroscopyAnalysisView } from '../src/components/dashboards/SpectroscopyAnalysisView.js';
import { createSoilAnalysisView } from '../src/components/dashboards/SoilAnalysisView.js';
import { createEnvironmentMonitorView } from '../src/components/dashboards/EnvironmentMonitorView.js';
import { createAIIntelligenceView } from '../src/components/dashboards/AIIntelligenceView.js';
import { createSettingsView } from '../src/components/SettingsView.js';
import { createUsageAnalyticsView } from '../src/components/UsageAnalyticsView.js';
import { createCropZoneManagerModal } from '../src/components/CropZoneManagerModal.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';

export function registerMultilingualVerificationTests() {
  setupHeadlessDOM();

  const TARGET_LOCALES = ['en', 'kn', 'hi', 'te', 'ta', 'ml', 'mr', 'es'];

  describe('Comprehensive Multi-Language Dictionary Completeness', () => {
    it('verifies all 8 languages have 100% of dictionary keys without missing tokens', () => {
      const enKeys = Object.keys(DICTIONARY.en);
      expect(enKeys.length).toBeGreaterThan(250);

      TARGET_LOCALES.forEach(locale => {
        const dict = DICTIONARY[locale];
        expect(dict).toBeDefined();
        enKeys.forEach(key => {
          const val = dict[key];
          if (!val) {
            throw new Error(`Missing key "${key}" in locale "${locale}"`);
          }
          expect(typeof val).toBe('string');
          expect(val.length).toBeGreaterThan(0);
        });
      });
    });
  });

  // Execute 3 consecutive complete test cycles
  for (let cycle = 1; cycle <= 3; cycle++) {
    describe(`Multi-Language UI Reactive Cycle ${cycle}/3 - All 8 Languages Across All Screens`, () => {
      TARGET_LOCALES.forEach(locale => {
        it(`[Cycle ${cycle}] converts entire mobile app UI cleanly to "${locale}"`, () => {
          mockFirestore.resetToDefault();
          setLocale(locale);
          expect(getLocale()).toBe(locale);

          // 1. AppNavigationHeader
          const header = createAppNavigationHeader({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1',
            currentUser: { displayName: 'Carlos Mendoza', role: 'Farm Owner' }
          });
          expect(header).toBeDefined();
          const headerHtml = header.innerHTML;
          expect(headerHtml).toContain(t('system_safe_badge'));

          // 2. NavigationDock
          const dock = createNavigationDock({ activeView: 'overview' });
          expect(dock).toBeDefined();
          expect(dock.element.innerHTML).toContain(t('nav_home'));
          expect(dock.element.innerHTML).toContain(t('nav_irrigation'));
          expect(dock.element.innerHTML).toContain(t('nav_spectroscopy'));
          expect(dock.element.innerHTML).toContain(t('nav_soil_climate'));
          expect(dock.element.innerHTML).toContain(t('nav_ai'));

          // 3. FieldOverviewDashboard
          const dashboard = createFieldOverviewDashboard({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1'
          });
          expect(dashboard).toBeDefined();
          const dashHtml = dashboard.innerHTML;
          expect(dashHtml).toContain(t('live_parcel'));
          expect(dashHtml).toContain(t('core_precision_modules'));
          expect(dashHtml).toContain(t('humidity'));
          expect(dashHtml).toContain(t('pressure'));

          // 4. IrrigationManagementView
          const irrigation = createIrrigationManagementView({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1'
          });
          expect(irrigation).toBeDefined();
          const irrHtml = irrigation.innerHTML;
          expect(irrHtml).toContain(t('irrigation_title'));
          expect(irrHtml).toContain(t('irrigation_subtitle'));

          // 5. SpectroscopyAnalysisView
          const spectro = createSpectroscopyAnalysisView({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1'
          });
          expect(spectro).toBeDefined();
          const specHtml = spectro.innerHTML;
          expect(specHtml).toContain(t('spectro_title'));
          expect(specHtml).toContain(t('spectro_subtitle'));
          expect(specHtml).toContain(t('decision_vitality'));

          // 6. SoilAnalysisView
          const soil = createSoilAnalysisView({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1'
          });
          expect(soil).toBeDefined();
          const soilHtml = soil.innerHTML;
          expect(soilHtml).toContain(t('soil_title'));
          expect(soilHtml).toContain(t('soil_matrix_title'));

          // 7. EnvironmentMonitorView
          const env = createEnvironmentMonitorView({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1'
          });
          expect(env).toBeDefined();
          const envHtml = env.innerHTML;
          expect(envHtml).toContain(t('env_sensor_title'));
          expect(envHtml).toContain(t('env_dual_source_sync'));

          // 8. AIIntelligenceView
          const ai = createAIIntelligenceView({
            plots: Object.values(mockFirestore.data.plots),
            selectedPlotId: 'plot-1'
          });
          expect(ai).toBeDefined();
          const aiHtml = ai.innerHTML;
          expect(aiHtml).toContain(t('ai_title'));
          expect(aiHtml).toContain(t('autonomous_recommendations'));

          // 9. SettingsView
          const settings = createSettingsView({
            currentUser: { displayName: 'Carlos Mendoza', role: 'Farm Owner' }
          });
          expect(settings).toBeDefined();
          const setHtml = settings.innerHTML;
          expect(setHtml).toContain(t('menu_profile'));
          expect(setHtml).toContain(t('save_changes'));

          // 10. UsageAnalyticsView
          const usage = createUsageAnalyticsView({
            plots: Object.values(mockFirestore.data.plots),
            telemetryMetrics: { mainlinePressureBar: 2.45, consumedLitersToday: 1200 }
          });
          expect(usage).toBeDefined();
          const useHtml = usage.innerHTML;
          expect(useHtml).toContain(t('export_csv'));
          expect(useHtml).toContain(t('total_water_delivered'));

          // 11. CropZoneManagerModal
          const modal = createCropZoneManagerModal({
            initialTab: 'zones',
            selectedPlotId: 'plot-1',
            onClose: () => {}
          });
          expect(modal).toBeDefined();
          const modHtml = modal.innerHTML;
          expect(modHtml).toContain(t('manage_zones_and_crops'));
          expect(modHtml).toContain(t('field_zones_tab'));
          expect(modHtml).toContain(t('crop_catalog_tab'));
        });
      });
    });
  }

  // Restore English at end of test run
  setLocale('en');
}
