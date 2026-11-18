/**
 * Mobile User Lifecycle Flow & UI Architecture Tests
 * Validates:
 *  1. Onboarding Carousel & Cold Launch state persistence
 *  2. Authentication Screen & Offline Field Guest Mode
 *  3. Bottom Navigation Bar (6 tabs: Dashboard, Irrigation, Spectroscopy, Synergy, Usage, Settings)
 *  4. Usage Analytics View (Liters/zone, latch cycles, scan archives, CSV generator)
 *  5. Dashboard Customization / Widget Settings Modal & Persistence
 *  6. Network Connectivity Banners & Lifecycle state persistence
 */
import { describe, it, expect } from './framework.js';
import { 
  hasCompletedOnboarding, 
  setOnboardingCompleted, 
  ONBOARDING_STORAGE_KEY,
  createOnboardingCarousel 
} from '../src/components/OnboardingCarousel.js';
import { authService } from '../src/firebase/authService.js';
import { 
  createBottomNavBar, 
  MOBILE_TABS 
} from '../src/components/BottomNavBar.js';
import { 
  getDashboardWidgetSettings, 
  saveDashboardWidgetSettings, 
  resetDashboardWidgetSettings, 
  DEFAULT_WIDGET_CONFIG,
  createDashboardSettingsModal
} from '../src/components/DashboardSettingsModal.js';
import { createUsageAnalyticsView } from '../src/components/UsageAnalyticsView.js';
import { createSettingsView } from '../src/components/SettingsView.js';

// Setup minimal headless DOM mock for Node if document is absent
if (typeof document === 'undefined') {
  class MockElement {
    constructor(tag) {
      this.tagName = (tag || 'div').toUpperCase();
      this.id = '';
      this.className = '';
      this._innerHTML = '';
      this.children = [];
      this.parentNode = null;
      this.attributes = new Map();
      this.eventListeners = new Map();
      this.classList = {
        _set: new Set(),
        add: (...cls) => cls.forEach(c => this.classList._set.add(c)),
        remove: (...cls) => cls.forEach(c => this.classList._set.delete(c)),
        contains: (c) => this.classList._set.has(c),
        toggle: (c) => this.classList._set.has(c) ? this.classList._set.delete(c) : this.classList._set.add(c)
      };
    }
    get innerHTML() { return this._innerHTML; }
    set innerHTML(html) {
      this._innerHTML = String(html);
    }
    get textContent() {
      return this._innerHTML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    setAttribute(key, val) { this.attributes.set(key, String(val)); }
    getAttribute(key) { return this.attributes.get(key) || null; }
    hasAttribute(key) { return this.attributes.has(key); }
    appendChild(child) {
      child.parentNode = this;
      this.children.push(child);
      return child;
    }
    removeChild(child) {
      const idx = this.children.indexOf(child);
      if (idx !== -1) {
        this.children.splice(idx, 1);
        child.parentNode = null;
      }
      return child;
    }
    remove() {
      if (this.parentNode) this.parentNode.removeChild(this);
    }
    addEventListener(event, fn) {
      if (!this.eventListeners.has(event)) this.eventListeners.set(event, []);
      this.eventListeners.get(event).push(fn);
    }
    dispatchEvent(event) {
      const fns = this.eventListeners.get(event.type) || [];
      fns.forEach(fn => fn(event));
    }
    click() {
      this.dispatchEvent({ type: 'click', target: this });
    }
    querySelector(selector) {
      const all = this.querySelectorAll(selector);
      return all.length > 0 ? all[0] : null;
    }
    querySelectorAll(selector) {
      const matches = [];
      // Support basic ID and class matching in mock innerHTML
      if (selector.startsWith('#')) {
        const idTarget = selector.slice(1);
        const regex = new RegExp(`id=["']${idTarget}["']`, 'i');
        if (regex.test(this._innerHTML)) {
          const mockMatch = new MockElement('div');
          mockMatch.id = idTarget;
          mockMatch.click = () => mockMatch.dispatchEvent({ type: 'click', target: mockMatch });
          matches.push(mockMatch);
        }
      } else if (selector.startsWith('.')) {
        const classTarget = selector.slice(1);
        const regex = new RegExp(`class=["'][^"']*\\b${classTarget}\\b[^"']*["']`, 'gi');
        const count = (this._innerHTML.match(regex) || []).length;
        for (let i = 0; i < count; i++) {
          const mockMatch = new MockElement('div');
          mockMatch.className = classTarget;
          matches.push(mockMatch);
        }
      }
      return matches;
    }
  }

  globalThis.document = {
    createElement: (tag) => new MockElement(tag),
    getElementById: (id) => null,
    body: new MockElement('body'),
    addEventListener: () => {}
  };
}

export function registerMobileLifecycleTests() {
  describe('Mobile User Lifecycle: Cold Launch & Onboarding Carousel', () => {
    it('detects uncompleted onboarding on fresh cold launch', () => {
      localStorage.clear();
      expect(hasCompletedOnboarding()).toBe(false);
    });

    it('sets and persists onboarding completion state', () => {
      localStorage.clear();
      setOnboardingCompleted(true);
      expect(hasCompletedOnboarding()).toBe(true);
      expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBe('true');

      setOnboardingCompleted(false);
      expect(hasCompletedOnboarding()).toBe(false);
    });

    it('instantiates OnboardingCarousel with 3 slides and action buttons', () => {
      const carousel = createOnboardingCarousel({
        onComplete: () => {},
        onContinueAsGuest: () => {}
      });

      expect(Boolean(carousel)).toBe(true);
      expect(carousel.id).toBe('agrispectra-onboarding-modal');
      expect(carousel.textContent).toContain('Leaf Spectroscopy');
      expect(carousel.textContent).toContain('Continue as Offline Field Guest');
      expect(carousel.textContent).toContain('Skip Intro');
    });
  });

  describe('Mobile Authentication Flow & Offline Guest Access', () => {
    it('authenticates 1-tap Offline Field Guest with operator scope', () => {
      localStorage.clear();
      const res = authService.signInAsOfflineGuest("Mateo Silva", "Field Operator", "Sonoma Valley Parcel");
      expect(res.success).toBe(true);
      expect(res.isOffline).toBe(true);
      expect(res.displayName).toBe("Mateo Silva");
      expect(res.role).toBe("Field Operator");

      const current = authService.getCurrentUser();
      expect(Boolean(current)).toBe(true);
      expect(current.isOffline).toBe(true);
      expect(current.role).toBe("Field Operator");
    });

    it('supports role selection in offline guest access (Farm Owner / Agronomist / Field Tech)', () => {
      const res = authService.signInAsOfflineGuest("Elena Rostova", "Agronomist", "Sonoma Valley Parcel");
      expect(res.role).toBe("Agronomist");
      const current = authService.getCurrentUser();
      expect(current.role).toBe("Agronomist");
    });
  });

  describe('Mobile Bottom Navigation Bar (7 Ergonomic Tabs)', () => {
    it('exposes exactly 7 ergonomic tabs for precision agronomy', () => {
      expect(MOBILE_TABS.length).toBe(7);
      const tabIds = MOBILE_TABS.map(t => t.id);
      expect(tabIds).toContain('dashboard');
      expect(tabIds).toContain('irrigation');
      expect(tabIds).toContain('spectroscopy');
      expect(tabIds).toContain('soil');
      expect(tabIds).toContain('environment');
      expect(tabIds).toContain('synergy');
      expect(tabIds).toContain('settings');
    });

    it('creates responsive bottom nav bar with active indicator and badge support', () => {
      let switchedTab = null;
      const nav = createBottomNavBar({
        activeTab: 'dashboard',
        badges: { synergy: 3 },
        onTabChange: (id) => { switchedTab = id; }
      });

      expect(Boolean(nav.element)).toBe(true);
      expect(nav.getActiveTab()).toBe('dashboard');

      nav.setActiveTab('irrigation');
      expect(nav.getActiveTab()).toBe('irrigation');
    });
  });

  describe('Dashboard Bento Customizer & Layout Settings', () => {
    it('retrieves default widget settings when none stored', () => {
      localStorage.clear();
      const settings = getDashboardWidgetSettings();
      expect(settings.weather_hero).toBe(true);
      expect(settings.plot_canvas).toBe(true);
      expect(settings.vitality_gauge).toBe(true);
      expect(settings.pressure_meter).toBe(true);
      expect(settings.water_ledger).toBe(true);
      expect(settings.quick_modules).toBe(true);
      expect(settings.synergy_recommendations).toBe(true);
      expect(settings.zone_valves).toBe(true);
    });

    it('persists and restores custom farmer widget toggles', () => {
      localStorage.clear();
      const custom = {
        ...DEFAULT_WIDGET_CONFIG,
        plot_canvas: false,
        pressure_meter: false
      };
      saveDashboardWidgetSettings(custom);

      const loaded = getDashboardWidgetSettings();
      expect(loaded.plot_canvas).toBe(false);
      expect(loaded.pressure_meter).toBe(false);
      expect(loaded.weather_hero).toBe(true);

      const reset = resetDashboardWidgetSettings();
      expect(reset.plot_canvas).toBe(true);
      expect(reset.pressure_meter).toBe(true);
    });

    it('creates DashboardSettingsModal with active toggle counts', () => {
      const modal = createDashboardSettingsModal({
        onSettingsChanged: () => {}
      });
      expect(Boolean(modal)).toBe(true);
      expect(modal.textContent).toContain('Dashboard Bento Customizer');
      expect(modal.textContent).toContain('Reset Defaults');
      expect(modal.textContent).toContain('Save Layout');
    });
  });

  describe('UsageAnalyticsView: Water Accounting, Cycles & CSV Export', () => {
    it('instantiates UsageAnalyticsView with zone water volume and latch cycles', () => {
      const view = createUsageAnalyticsView({
        plots: [
          { id: 'plot-1', plotNumber: 1, crop: 'Potato', totalLitersDelivered: 450 },
          { id: 'plot-2', plotNumber: 2, crop: 'Tomatoes', totalLitersDelivered: 620 }
        ],
        telemetryMetrics: { mainlinePressureBar: 2.45, consumedLitersToday: 1070 }
      });

      expect(Boolean(view)).toBe(true);
      const text = view.textContent;
      expect(text).toContain('Export CSV');
      expect(text).toContain('Total Water Delivered');
      expect(text).toContain('Valve Latch Cycles');
    });
  });

  describe('SettingsView: Agronomic Preferences & Glare Mode', () => {
    it('instantiates SettingsView with pulse timing, targets, and glare toggle', () => {
      const view = createSettingsView({
        currentUser: { displayName: 'Carlos Mendoza', role: 'Farm Owner', email: 'carlos@valleyfarms.com' },
        currentTheme: 'creamy-agri'
      });

      expect(Boolean(view)).toBe(true);
      const text = view.textContent;
      expect(text).toContain('Carlos Mendoza');
      expect(text).toContain('Farm Owner');
      expect(text).toContain('Glare Mode');
      expect(text).toContain('Farm Plot Agronomic Targets');
      expect(text).toContain('Solenoid');
      expect(text).toContain('Cache');
    });
  });
}
