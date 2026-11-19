/**
 * AgriSpectra Enterprise Backend Sync Service
 * Connects the mobile / web client directly with both Cloud Firestore and
 * the Standalone Enterprise Backend Server (Port 5050).
 */

export class BackendSyncService {
  constructor() {
    let resolvedBackend = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_API_URL) || 
      (typeof process !== 'undefined' && process.env?.VITE_BACKEND_API_URL) || 
      "http://localhost:5050";

    if (typeof window !== 'undefined' && window.location?.hostname) {
      const hostname = window.location.hostname;
      if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) {
        resolvedBackend = `http://${hostname}:5050`;
      } else if (
        Boolean(window.Capacitor?.isNativePlatform?.()) ||
        window.location?.protocol === 'capacitor:' ||
        /Android|iPhone|iPad|iPod/i.test(navigator?.userAgent || '')
      ) {
        resolvedBackend = "http://192.168.0.116:5050";
      }
    }

    this.backendUrl = resolvedBackend;

    this.apiSecret = (typeof import.meta !== 'undefined' && (import.meta.env?.VITE_ENTERPRISE_API_SECRET || import.meta.env?.ENTERPRISE_API_SECRET)) ||
      (typeof process !== 'undefined' && (process.env?.VITE_ENTERPRISE_API_SECRET || process.env?.ENTERPRISE_API_SECRET)) ||
      "agrispectra_enterprise_sec_2026_99x";

    this.isOnline = true;
    console.log(`[BackendSyncService] Enterprise Backend Target: ${this.backendUrl}`);
  }

  /**
   * Sync user profile directly to backend and Cloud Firestore
   */
  async syncUser(userData) {
    if (!userData) return { success: false, error: 'No user data' };

    const targetUrls = [
      `${this.backendUrl}/api/auth/sync-user`,
      'http://192.168.0.116:5050/api/auth/sync-user',
      'http://10.0.2.2:5050/api/auth/sync-user',
      'http://localhost:5050/api/auth/sync-user'
    ];

    const uniqueUrls = [...new Set(targetUrls)];

    for (const url of uniqueUrls) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: this._getAuthHeaders(),
          body: JSON.stringify(userData),
          signal: AbortSignal.timeout(3000)
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`[BackendSyncService] User synced successfully via ${url}`);
          return data;
        }
      } catch {
        // Continue to fallback
      }
    }
    return { success: false, localFallback: true };
  }

  /**
   * Internal helper to generate authenticated request headers
   */
  _getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    if (this.apiSecret) {
      headers['X-Enterprise-Secret'] = this.apiSecret;
      headers['Authorization'] = `Bearer ${this.apiSecret}`;
    }
    return headers;
  }

  /**
   * Check Backend Server Health
   */
  async checkHealth() {
    try {
      const res = await fetch(`${this.backendUrl}/api/health`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      // Backend not running or unreachable
    }
    return { status: "OFFLINE", fallback: true };
  }

  /**
   * Fetch Executive Entrepreneur Metrics
   */
  async getExecutiveMetrics() {
    try {
      const res = await fetch(`${this.backendUrl}/api/admin/metrics`, {
        headers: this._getAuthHeaders(),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.data;
      }
    } catch {
      // Fallback
    }
    return null;
  }

  /**
   * Send Telemetry Packet directly to Enterprise Backend
   */
  async syncTelemetryPacket(packet) {
    try {
      const res = await fetch(`${this.backendUrl}/api/telemetry/sync`, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(packet),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[BackendSyncService] Telemetry sync offline fallback:", e.message);
    }
    return { received: false, localFallback: true };
  }

  /**
   * Send Emergency Killswitch to Enterprise Backend
   */
  async triggerEnterpriseKillswitch(operatorId = "MOBILE_APP_EMERGENCY", reason = "Manual 1-Tap Emergency Killswitch") {
    try {
      const res = await fetch(`${this.backendUrl}/api/admin/emergency-killswitch`, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify({ operatorId, reason }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[BackendSyncService] Backend killswitch offline fallback:", e.message);
    }
    return { success: false, localFallback: true };
  }

  /**
   * Sync newly acquired Leaf Spectroscopy Scan to Enterprise Backend
   */
  async syncLeafScan(scanData) {
    return this.syncSpectralScan(scanData);
  }

  /**
   * Sync newly acquired Spectral Scan to Enterprise Backend
   */
  async syncSpectralScan(scanData) {
    try {
      const res = await fetch(`${this.backendUrl}/api/spectral/scans`, {
        method: 'POST',
        headers: this._getAuthHeaders(),
        body: JSON.stringify(scanData),
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("[BackendSyncService] Spectral scan sync offline fallback:", e.message);
    }
    return { received: false, localFallback: true };
  }

  /**
   * Fetch Enterprise Users Directory
   */
  async getEnterpriseUsers(role = null) {
    try {
      const url = role
        ? `${this.backendUrl}/api/admin/users?role=${encodeURIComponent(role)}`
        : `${this.backendUrl}/api/admin/users`;
      const res = await fetch(url, { 
        headers: this._getAuthHeaders(),
        signal: AbortSignal.timeout(3000) 
      });
      if (res.ok) {
        const json = await res.json();
        return json.data;
      }
    } catch {
      // Fallback
    }
    return [];
  }
}

export const backendSyncService = new BackendSyncService();
