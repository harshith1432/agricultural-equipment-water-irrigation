/**
 * Automated Test Suite: Authentication, Google Login & Enterprise Admin Dashboard
 */
import { describe, it, expect } from './framework.js';
import { authService, GUEST_USER, signInAsGuest, onAuthStateChange, signOutUser } from '../src/firebase/authService.js';
import { firestoreService } from '../src/firebase/firestoreService.js';
import { mockFirestore } from '../src/firebase/mockFirestore.js';

export function registerAuthEnterpriseTests() {
  describe('Authentication & Enterprise Multi-Tenant Governance', () => {
    it('Google Sign-In authenticates grower and establishes active session', async () => {
      const user = await authService.signInWithGoogle();
      expect(Boolean(user)).toBe(true);
      expect(user.email).toContain('@');
      expect(['Agronomist', 'Field Technician']).toContain(user.role);
      expect(authService.getCurrentUser()?.uid).toBe(user.uid);
    });

    it('Offline Guest Mode activates anonymous technician session', async () => {
      const guest = await authService.signInAsGuest();
      expect(guest.uid).toBe('guest-offline-farmer');
      expect(guest.displayName).toBe('Field Operator (Guest)');
      expect(guest.email).toBe('offline@agrispectra.local');
      expect(guest.role).toBe('Field Technician');
      expect(guest.isAnonymous).toBe(true);
      expect(authService.getCurrentUser()?.uid).toBe('guest-offline-farmer');
      expect(authService.getCurrentUser()?.isAnonymous).toBe(true);
    });

    it('Email Sign-Up registers new enterprise grower with custom farm and role', async () => {
      const email = `grower_${Date.now()}@valleyfarms.com`;
      const user = await authService.signUpWithEmail(
        email,
        'AgriPass2026!',
        'Carlos Mendonza',
        'Sonoma Valley Drip Vineyard',
        'Farm Owner'
      );
      expect(user.email).toBe(email);
      expect(user.displayName).toBe('Carlos Mendonza');
      expect(user.farmName).toBe('Sonoma Valley Drip Vineyard');
      expect(user.role).toBe('Farm Owner');
    });

    it('Password reset request generates confirmation for field operator', async () => {
      const res = await authService.sendPasswordReset('mateo@solenoidflow.org');
      expect(res.success).toBe(true);
      expect(res.message).toContain('password reset instructions');
    });

    it('Enterprise Admin: Updates user role and toggles account suspension', async () => {
      const users = authService.enterpriseUsers;
      expect(users.length).toBeGreaterThan(0);
      
      const targetUser = users[0];
      const initialRole = targetUser.role;
      const newRole = initialRole === 'SuperAdmin' ? 'Agronomist' : 'SuperAdmin';
      
      await authService.updateUserRole(targetUser.uid, newRole);
      expect(targetUser.role).toBe(newRole);

      const newStatus = await authService.toggleUserStatus(targetUser.uid);
      expect(['ACTIVE', 'SUSPENDED']).toContain(newStatus);
    });

    it('Enterprise Broadcast: Dispatches urgent freeze announcement across field workers', async () => {
      const ann = await authService.broadcastAnnouncement(
        'FROST WARNING: Temperature drop below 0°C expected at 03:00. Solenoid pre-soak active.',
        'Central Operations HQ'
      );
      expect(ann.message).toContain('FROST WARNING');
      expect(ann.author).toBe('Central Operations HQ');
    });

    it('Enterprise Executive KPIs: Computes live cross-farm platform statistics', () => {
      const stats = authService.getEnterpriseStats();
      expect(stats.totalUsers).toBeGreaterThan(100);
      expect(stats.totalHectares).toBeGreaterThan(1000);
      expect(stats.hardwareHealthIndex).toBeGreaterThanOrEqual(99.0);
      expect(stats.totalLitersDistributedToday).toBeGreaterThan(10000);
    });

    it('1-Click Demo Login authenticates as Farm Owner with executive credentials', async () => {
      const res = await authService.loginAsDemoRole('Farm Owner');
      expect(Boolean(res)).toBe(true);
      expect(res.role).toBe('Farm Owner');
      expect(res.displayName).toBe('Carlos Mendoza');
      expect(authService.getCurrentUser()?.role).toBe('Farm Owner');
    });

    it('1-Click Demo Login authenticates as Agronomist with plant science scope', async () => {
      const res = await authService.loginAsDemoRole('Agronomist');
      expect(Boolean(res)).toBe(true);
      expect(res.role).toBe('Agronomist');
      expect(res.displayName).toBe('Dave Miller');
      expect(authService.getCurrentUser()?.role).toBe('Agronomist');
    });

    it('1-Click Demo Login authenticates as Field Operator with hydraulic scope', async () => {
      const res = await authService.loginAsDemoRole('Field Operator');
      expect(Boolean(res)).toBe(true);
      expect(res.role).toBe('Field Operator');
      expect(res.displayName).toBe('Mateo Silva');
      expect(authService.getCurrentUser()?.role).toBe('Field Operator');
    });

    it('1-Click Demo Login authenticates as SuperAdmin with enterprise governance scope', async () => {
      const res = await authService.loginAsDemoRole('SuperAdmin');
      expect(Boolean(res)).toBe(true);
      expect(res.role).toBe('SuperAdmin');
      expect(res.displayName).toBe('Elena Rostova');
      expect(authService.getCurrentUser()?.role).toBe('SuperAdmin');
    });

    it('Dynamically switches active user role and notifies listeners', async () => {
      let notifiedRole = null;
      const unsub = authService.onAuthStateChanged((user) => {
        if (user) notifiedRole = user.role;
      });

      await authService.switchRole('Agronomist');
      expect(authService.getCurrentUser()?.role).toBe('Agronomist');
      expect(notifiedRole).toBe('Agronomist');
      unsub();
    });

    it('Sign-Out terminates active session cleanly', async () => {
      await authService.signOut();
      expect(authService.getCurrentUser()).toBe(null);
    });

    it('Email Sign-Up supports 4-argument signature (email, password, displayName, role)', async () => {
      const email = `tech_${Date.now()}@valleyfarms.com`;
      const user = await authService.signUpWithEmail(
        email,
        'Secret123!',
        'Taylor Tech',
        'Field Technician'
      );
      expect(user.email).toBe(email);
      expect(user.displayName).toBe('Taylor Tech');
      expect(user.role).toBe('Field Technician');
    });

    it('onAuthStateChange listener and signOutUser clean session termination', async () => {
      await authService.signInAsGuest();
      expect(authService.getCurrentUser()?.uid).toBe('guest-offline-farmer');

      let notifiedUser = undefined;
      const unsub = onAuthStateChange((user) => {
        notifiedUser = user;
      });

      await signOutUser();
      expect(authService.getCurrentUser()).toBe(null);
      expect(notifiedUser).toBe(null);
      unsub();
    });

    it('saves and loads user preferences across FirestoreService and local storage', async () => {
      const prefs = {
        theme: 'high-contrast-field',
        telemetryRefreshRateMs: 1500,
        preferredPlotId: 'plot-3',
        offlineAutoSync: true
      };
      const saved = await firestoreService.saveUserPreferences('usr-test-1', prefs);
      expect(saved.theme).toBe('high-contrast-field');
      expect(saved.telemetryRefreshRateMs).toBe(1500);

      const loaded = await firestoreService.getUserPreferences('usr-test-1');
      expect(loaded.theme).toBe('high-contrast-field');
      expect(loaded.preferredPlotId).toBe('plot-3');

      // Verify local storage persistence under agrispectra_user_prefs
      const rawStored = localStorage.getItem('agrispectra_user_prefs');
      expect(rawStored).toContain('high-contrast-field');
    });

    it('fetches aggregated usage statistics (liters today/all-time, cycles, leaf scans, vitality)', async () => {
      const stats = await firestoreService.getAggregatedStats('farm-valley-1');
      expect(typeof stats.totalLitersDeliveredToday).toBe('number');
      expect(typeof stats.totalLitersDeliveredAllTime).toBe('number');
      expect(stats.totalLitersDeliveredAllTime).toBeGreaterThanOrEqual(stats.totalLitersDeliveredToday);
      expect(typeof stats.valveCycleCountPerPlot).toBe('object');
      expect(stats.valveCycleCountPerPlot['plot-1']).toBeGreaterThanOrEqual(0);
      expect(typeof stats.totalLeafScansConducted).toBe('number');
      expect(stats.totalLeafScansConducted).toBeGreaterThan(0);
      expect(typeof stats.averageCanopyVitality).toBe('number');
      expect(stats.averageCanopyVitality).toBeGreaterThan(0);
    });
  });
}
