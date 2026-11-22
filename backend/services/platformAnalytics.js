/**
 * Platform Analytics Service
 * Real, Firestore-backed aggregation for the public website's admin dashboard:
 * registered users, farmer breakdown, scan volume/reports, app event activity,
 * and APK download counter. Unlike enterpriseStore (in-memory, reset on every
 * backend restart/redeploy), every number here is read fresh from Cloud
 * Firestore so it survives deploys and reflects real app usage.
 */

import { firestoreClient } from './firestoreClient.js';

const FARMER_ROLES = ['Farm Owner', 'farm_owner'];

class PlatformAnalytics {
  async getUserStats() {
    const users = (await firestoreClient.getCollection('users')) || [];
    const roleBreakdown = {};
    let totalFarmers = 0;

    for (const u of users) {
      const role = u.role || 'Unknown';
      roleBreakdown[role] = (roleBreakdown[role] || 0) + 1;
      if (FARMER_ROLES.includes(role)) totalFarmers++;
    }

    return {
      totalRegisteredUsers: users.length,
      totalFarmers,
      roleBreakdown
    };
  }

  async getScanStats({ limit = 50, offset = 0 } = {}) {
    const scans = (await firestoreClient.getCollection('spectral_scans')) || [];
    scans.sort((a, b) => new Date(b.timestamp || b.syncedAt || 0) - new Date(a.timestamp || a.syncedAt || 0));

    const bySource = {};
    for (const s of scans) {
      const key = s.source || s.connectionMode || 'UNKNOWN';
      bySource[key] = (bySource[key] || 0) + 1;
    }

    return {
      totalScans: scans.length,
      bySource,
      scans: scans.slice(offset, offset + limit)
    };
  }

  async getAppEventStats({ limit = 100 } = {}) {
    const events = (await firestoreClient.getCollection('appEvents')) || [];
    events.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));

    const byType = {};
    for (const e of events) {
      const type = e.eventType || 'UNKNOWN';
      byType[type] = (byType[type] || 0) + 1;
    }

    return {
      totalEvents: events.length,
      byType,
      recent: events.slice(0, limit)
    };
  }

  async getDownloadCount() {
    const doc = await firestoreClient.getDoc('platformStats/downloads');
    return doc?.count || 0;
  }

  async recordDownloadClick(meta = {}) {
    await firestoreClient.incrementCounter('platformStats/downloads', 'count', 1);
    await firestoreClient.addDocument('downloadEvents', {
      timestamp: new Date().toISOString(),
      platform: meta.platform || 'unknown',
      userAgent: meta.userAgent || null
    }).catch(() => {});
    return this.getDownloadCount();
  }

  /**
   * Single aggregate payload for the website's admin overview screen.
   */
  async getOverview() {
    const [userStats, scanStats, eventStats, totalDownloads] = await Promise.all([
      this.getUserStats(),
      this.getScanStats({ limit: 10 }),
      this.getAppEventStats({ limit: 10 }),
      this.getDownloadCount()
    ]);

    return {
      totalDownloads,
      totalRegisteredUsers: userStats.totalRegisteredUsers,
      totalFarmers: userStats.totalFarmers,
      roleBreakdown: userStats.roleBreakdown,
      totalScans: scanStats.totalScans,
      scansBySource: scanStats.bySource,
      recentScans: scanStats.scans,
      totalAppEvents: eventStats.totalEvents,
      appEventsByType: eventStats.byType,
      recentAppEvents: eventStats.recent
    };
  }
}

export const platformAnalytics = new PlatformAnalytics();
