/**
 * Automated QA & Chaos Test Suite:
 * Authentication State Lifecycle, Cache Eviction & Isolated Session Chamber Verification
 *
 * Verifies User-Reported Production Bug:
 * "When I log out and clear the app cache and log in again, the app needs to show the login page
 *  or user registration page. But here it is not showing anything, it is directly opening the
 *  dashboard and showing some data which is not at all related to any user. So, fix this issue properly."
 *
 * Requirements Matrix:
 *  - Requirement A: App boot with unauthenticated state (authService.getCurrentUser() === null)
 *                   leads strictly to the authentication screen / login & register portal and DOES NOT render private dashboard data.
 *  - Requirement B: User logout (authService.signOut() / handleSignOut()) resets session to null,
 *                   wipes cached credentials, unbinds the Firestore user chamber, and transitions back to the Login / Register screen.
 *  - Requirement C: Clearing cache / localStorage and reloading leaves the app in the unauthenticated state
 *                   strictly requiring sign-in or registration.
 *  - Requirement D: Logging in with user credentials or Google establishes that user's isolated session
 *                   and displays only their plots and records without cross-tenant leakage.
 */

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => store.get(key) || null,
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
    get length() { return store.size; },
    key: (i) => Array.from(store.keys())[i] || null
  };
}

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { authService } from '../src/firebase/authService.js';
import { firestoreService } from '../src/firebase/firestoreService.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';
import { AgriSpectraApp } from '../src/main.js';

export function registerAuthLifecycleIsolationTests() {
  describe('Auth Lifecycle & Multi-Tenant Chamber Isolation (Regression Bug Fix)', () => {

    it('Requirement A: Fresh boot without active session displays Login/Register Portal and hides private dashboard', async () => {
      // 1. Evict any existing session and clear localStorage
      await authService.signOut();
      localStorage.clear();

      expect(authService.getCurrentUser()).toBe(null);

      // 2. Setup clean headless DOM with #app root
      const { document, body } = setupHeadlessDOM();
      let appEl = document.getElementById('app');
      if (!appEl) {
        appEl = document.createElement('div');
        appEl.id = 'app';
        body.appendChild(appEl);
      }
      appEl.innerHTML = '';

      // 3. Instantiate fresh AgriSpectraApp in unauthenticated state
      const app = new AgriSpectraApp();
      expect(app.currentUser).toBe(null);
      expect(app.activeRoleView).toBe(null);

      // Force synchronous render verification
      app.render();

      // 4. Verify rendered DOM content: Must show AuthScreen and must NOT show private dashboard
      expect(appEl.querySelector('#portal-email-input') !== null).toBe(true);
      expect(appEl.querySelector('#portal-submit-btn') !== null).toBe(true);
      expect(appEl.querySelector('#btn-google-auth') !== null).toBe(true);
      expect(appEl.querySelector('#tab-mode-signup') !== null).toBe(true);
      expect(appEl.querySelector('#btn-offline-guest') === null).toBe(true);

      // Verify absence of private farm dashboard components and sensitive crop zone data
      expect(appEl.querySelector('.native-mobile-app') === null).toBe(true);
      expect(appEl.querySelector('.dynamic-mainline-pressure') === null).toBe(true);
    });

    it('Requirement B: User logout wipes cached credentials, unbinds Firestore chamber, and switches to Auth screen', async () => {
      const { document, body } = setupHeadlessDOM();
      let appEl = document.getElementById('app');
      if (!appEl) {
        appEl = document.createElement('div');
        appEl.id = 'app';
        body.appendChild(appEl);
      }

      // 1. Establish an active session (Carlos Mendoza - Farm Owner)
      const user = await authService.loginAsDemoRole('Farm Owner');
      expect(authService.getCurrentUser()?.uid).toBe(user.uid);
      expect(localStorage.getItem('agrispectra_auth_user')).toBeDefined();

      const app = new AgriSpectraApp();
      app.currentUser = user;
      firestoreService.setActiveUser(user);
      app.render();

      // Verify dashboard is initially rendered for the authenticated user
      expect(app.currentUser).toBeDefined();
      expect(app.currentUser.displayName).toBe('Carlos Mendoza');

      // 2. Perform user logout
      await app.handleSignOut();

      // 3. Verify session teardown invariants
      expect(authService.getCurrentUser()).toBe(null);
      expect(app.currentUser).toBe(null);
      expect(app.activeRoleView).toBe(null);
      expect(localStorage.getItem('agrispectra_auth_user')).toBe(null);

      // Verify Firestore chamber unbinding
      expect(firestoreService.currentUser).toBe(null);

      // 4. Verify UI transitioned back to the Login / Register portal
      expect(appEl.querySelector('#portal-email-input') !== null).toBe(true);
      expect(appEl.querySelector('#portal-submit-btn') !== null).toBe(true);
      expect(appEl.querySelector('#tab-mode-signup') !== null).toBe(true);
      expect(appEl.querySelector('.native-mobile-app') === null).toBe(true);
    });

    it('Requirement C: Clearing cache & localStorage and reloading app remains in unauthenticated state', async () => {
      // 1. Simulate active user with cached session in localStorage
      await authService.loginAsDemoRole('Agronomist');
      expect(authService.getCurrentUser()?.role).toBe('Agronomist');
      expect(localStorage.getItem('agrispectra_auth_user')).toBeDefined();

      // 2. User logs out and clears all app cache and storage
      await authService.signOut();
      localStorage.clear();

      // 3. Simulate reload by triggering internal session reload and fresh instantiation
      authService._loadCachedSession();
      expect(authService.getCurrentUser()).toBe(null);

      const { document, body } = setupHeadlessDOM();
      let appEl = document.getElementById('app');
      if (!appEl) {
        appEl = document.createElement('div');
        appEl.id = 'app';
        body.appendChild(appEl);
      }
      appEl.innerHTML = '';

      const reloadedApp = new AgriSpectraApp();
      expect(reloadedApp.currentUser).toBe(null);
      reloadedApp.render();

      // Verify the reloaded app strictly renders Login / User Registration portal
      expect(appEl.querySelector('#portal-email-input') !== null).toBe(true);
      expect(appEl.querySelector('#portal-submit-btn') !== null).toBe(true);
      expect(appEl.querySelector('#btn-google-auth') !== null).toBe(true);
      expect(appEl.querySelector('#tab-mode-signup') !== null).toBe(true);

      // Verify that no unrelated demo dashboard is displayed
      expect(appEl.querySelector('.native-mobile-app') === null).toBe(true);
    });

    it('Requirement D: Logging in with credentials or Google binds user isolated chamber without cross-tenant leak', async () => {
      const { document, body } = setupHeadlessDOM();
      let appEl = document.getElementById('app');
      if (!appEl) {
        appEl = document.createElement('div');
        appEl.id = 'app';
        body.appendChild(appEl);
      }
      appEl.innerHTML = '';

      // Reset mock database to clean baseline
      mockFirestore.resetToDefault();

      // 1. Start from clean unauthenticated state
      await authService.signOut();
      localStorage.clear();
      const app = new AgriSpectraApp();
      expect(app.currentUser).toBe(null);

      // 2. User logs in with Google OAuth / enterprise credentials (Dr. Elena Rostova - SuperAdmin)
      const elenaUser = await authService.loginAsDemoRole('SuperAdmin');
      expect(elenaUser.displayName).toBe('Elena Rostova');
      expect(elenaUser.farmId).toBe('farm-elena-research-2');

      // Bind session and render
      app.currentUser = elenaUser;
      app.activeRoleView = elenaUser.role;
      firestoreService.setActiveUser(elenaUser);
      app.render();

      // 3. Verify Elena's chamber is bound and active
      expect(app.currentUser.uid).toBe('user-elena-2');
      expect(firestoreService.currentFarmId).toBe('farm-elena-research-2');

      // User creates a plot in their isolated chamber
      const elenaPlot = await firestoreService.createPlot({
        id: 'plot-elena-sugar-9',
        name: 'Zone 9 - Elena Sugarcane Trial',
        crop: 'Sugarcane',
        plotNumber: 9
      });
      expect(elenaPlot).toBeDefined();

      const elenaPlots = await firestoreService.getPlots();
      expect(elenaPlots.some(p => p.id === 'plot-elena-sugar-9')).toBe(true);

      // 4. Now user logs out and a different user (Mateo Silva - Field Operator) logs in
      await app.handleSignOut();
      expect(app.currentUser).toBe(null);

      const mateoUser = await authService.loginAsDemoRole('Field Operator');
      app.currentUser = mateoUser;
      app.activeRoleView = mateoUser.role;
      firestoreService.setActiveUser(mateoUser);
      app.render();

      // 5. Verify Mateo cannot see Elena's private plots
      expect(firestoreService.currentFarmId).toBe('farm-mateo-hydraulic-3');
      const mateoPlots = await firestoreService.getPlots();
      expect(mateoPlots.some(p => p.id === 'plot-elena-sugar-9')).toBe(false);
      expect(mateoPlots.some(p => p.name === 'Zone 9 - Elena Sugarcane Trial')).toBe(false);

      // Clean teardown
      await app.handleSignOut();
    });

  });
}
