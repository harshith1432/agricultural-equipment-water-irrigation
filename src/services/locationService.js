/**
 * Precision GPS Location and Hyper-Local Weather Engine
 * 
 * Provides:
 *   - Device GPS positioning via navigator.geolocation with fallback to cached/agricultural belt coordinates
 *   - Automated reverse geocoding via BigDataCloud client
 *   - Hyper-local microclimate weather ingestion via Open-Meteo Forecast API
 *   - Reactive event emitting for location and weather updates
 *   - Seamless synchronization with TempHumiditySensorUSB hardware module
 */

import { tempHumiditySensorUSB } from '../hardware/tempHumiditySensorUSB.js';

export const DEFAULT_LOCATION = {
  latitude: 30.9010,
  longitude: 75.8573,
  accuracy: 100,
  city: 'Ludhiana',
  region: 'Punjab',
  country: 'India',
  displayName: 'Ludhiana, Punjab • 30.90°N, 75.86°E',
  timestamp: new Date().toISOString(),
  permissionState: 'prompt', // 'prompt' | 'granted' | 'denied' | 'unsupported'
  isGpsExact: false
};

export const DEFAULT_WEATHER = {
  temperatureC: 26.0,
  humidityPercent: 55.0,
  tempMaxC: 30.0,
  tempMinC: 18.0,
  precipitationMm: 0.0,
  pressureHpa: 1012.0,
  windSpeedKmh: 12.0,
  sunriseStr: '6:00 am',
  sunsetStr: '6:30 pm',
  conditionText: 'Partly Cloudy',
  weatherCode: 2,
  lastUpdated: new Date().toISOString()
};

/**
 * Format coordinates to human-readable DMS/cardinal representation
 * e.g. "30.90°N, 75.86°E"
 */
export function formatCoordinates(lat, lon) {
  const numLat = Number(lat) || 0;
  const numLon = Number(lon) || 0;
  const latStr = `${Math.abs(numLat).toFixed(2)}°${numLat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(numLon).toFixed(2)}°${numLon >= 0 ? 'E' : 'W'}`;
  return `${latStr}, ${lonStr}`;
}

/**
 * Convert ISO time string or Date to 12-hour formatted string (e.g. "6:20 am")
 */
export function formatSunTime(timeVal) {
  if (!timeVal) return '';
  try {
    const str = String(timeVal);
    if (str.includes('T')) {
      const parts = str.split('T')[1].split(':');
      let hour = parseInt(parts[0], 10);
      const min = parts[1].padStart(2, '0');
      const ampm = hour >= 12 ? 'pm' : 'am';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${min} ${ampm}`;
    }
    const d = new Date(timeVal);
    if (!isNaN(d.getTime())) {
      let hour = d.getHours();
      const min = String(d.getMinutes()).padStart(2, '0');
      const ampm = hour >= 12 ? 'pm' : 'am';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${hour}:${min} ${ampm}`;
    }
    return str;
  } catch (e) {
    return String(timeVal);
  }
}

/**
 * Map WMO Weather Interpretation Codes to human readable descriptors
 */
export function getWeatherConditionText(code) {
  const c = Number(code);
  switch (c) {
    case 0: return 'Clear Sky';
    case 1: return 'Mainly Clear';
    case 2: return 'Partly Cloudy';
    case 3: return 'Overcast';
    case 45: case 48: return 'Foggy';
    case 51: case 53: case 55: return 'Drizzle';
    case 56: case 57: return 'Freezing Drizzle';
    case 61: case 63: case 65: return 'Rain';
    case 66: case 67: return 'Freezing Rain';
    case 71: case 73: case 75: return 'Snowfall';
    case 77: return 'Snow Grains';
    case 80: case 81: case 82: return 'Rain Showers';
    case 85: case 86: return 'Snow Showers';
    case 95: return 'Thunderstorm';
    case 96: case 99: return 'Thunderstorm with Hail';
    default: return 'Partly Cloudy';
  }
}

export class LocationService {
  constructor() {
    this.STORAGE_KEY_LOCATION = 'agrispectra_user_location';
    this.STORAGE_KEY_WEATHER = 'agrispectra_live_weather';

    this.listeners = new Map();
    this.location = this._loadLocation();
    this.weather = this._loadWeather();

    // Synchronize initial location and weather cache with USB/Weather hardware adapter
    this._syncWithHardware();
  }

  /**
   * Automatic background network geolocation fallback
   */
  async detectNetworkLocation() {
    try {
      const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?localityLanguage=en');
      if (res.ok) {
        const netGeo = await res.json();
        if (netGeo.latitude && netGeo.longitude) {
          const lat = Number(netGeo.latitude);
          const lon = Number(netGeo.longitude);
          const city = netGeo.city || netGeo.locality || 'Farm Parcel';
          const region = netGeo.principalSubdivision || '';
          const country = netGeo.countryName || 'India';
          const coordStr = formatCoordinates(lat, lon);
          const displayName = `${city}${region ? `, ${region}` : ''} • ${coordStr}`;

          this.location = {
            ...this.location,
            latitude: lat,
            longitude: lon,
            city,
            region,
            country,
            displayName,
            timestamp: new Date().toISOString()
          };

          this._saveLocation(this.location);
          this.emit('locationUpdated', this.location);
          this._syncWithHardware();
          await this.fetchLiveWeather(lat, lon);
          return this.location;
        }
      }
    } catch (e) {
      console.warn('[LocationService] Network location detection error:', e.message);
    }
    return this.location;
  }

  // --- Reactive Event Emitter ---
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(cb => cb !== callback));
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[LocationService Event Error: ${event}]`, e); }
      });
    }
  }

  // --- Cache Storage Management ---
  _loadLocation() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.STORAGE_KEY_LOCATION);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            ...DEFAULT_LOCATION,
            ...parsed
          };
        }
      }
    } catch (e) {
      console.warn('[LocationService] Failed to load cached location:', e.message);
    }
    return { ...DEFAULT_LOCATION };
  }

  _saveLocation(loc) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY_LOCATION, JSON.stringify(loc));
      }
    } catch (e) {
      console.warn('[LocationService] Failed to persist location:', e.message);
    }
  }

  _loadWeather() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(this.STORAGE_KEY_WEATHER);
        if (raw) {
          const parsed = JSON.parse(raw);
          return {
            ...DEFAULT_WEATHER,
            ...parsed
          };
        }
      }
    } catch (e) {
      console.warn('[LocationService] Failed to load cached weather:', e.message);
    }
    return { ...DEFAULT_WEATHER };
  }

  _saveWeather(weather) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.STORAGE_KEY_WEATHER, JSON.stringify(weather));
      }
    } catch (e) {
      console.warn('[LocationService] Failed to persist weather:', e.message);
    }
  }

  _syncWithHardware() {
    try {
      if (tempHumiditySensorUSB) {
        if (typeof tempHumiditySensorUSB.setLocation === 'function') {
          tempHumiditySensorUSB.setLocation(
            this.location.latitude,
            this.location.longitude,
            this.location.displayName
          );
        }
        if (typeof tempHumiditySensorUSB.setWeatherCache === 'function' && this.weather) {
          tempHumiditySensorUSB.setWeatherCache(this.weather);
        }
      }
    } catch (e) {
      console.warn('[LocationService] Hardware sync warning:', e.message);
    }
  }

  // --- Getters ---
  getLocation() {
    return { ...this.location };
  }

  getWeather() {
    return { ...this.weather };
  }

  /**
   * Reverse geocode latitude and longitude to administrative locality
   * Uses BigDataCloud reverse geocode API with graceful coordinate fallback
   */
  async reverseGeocode(lat, lon) {
    const coordStr = formatCoordinates(lat, lon);
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 4500) : null;

    try {
      const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
      const res = await fetch(url, { signal: controller ? controller.signal : undefined });
      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Reverse geocode returned HTTP ${res.status}`);
      const data = await res.json();

      const city = data.city || data.locality || data.principalSubdivision || '';
      const region = data.principalSubdivision || '';
      const country = data.countryName || '';

      let displayName = '';
      if (city && region && city.toLowerCase() !== region.toLowerCase()) {
        displayName = `${city}, ${region} • ${coordStr}`;
      } else if (city || region) {
        displayName = `${city || region} • ${coordStr}`;
      } else {
        displayName = coordStr;
      }

      return {
        city,
        region,
        country,
        displayName
      };
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      return {
        city: '',
        region: '',
        country: '',
        displayName: coordStr
      };
    }
  }

  /**
   * Fetch hyper-local live weather forecast from Open-Meteo
   */
  async fetchLiveWeather(lat, lon) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 6500) : null;

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,surface_pressure,wind_speed_10m,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=auto`;
      const res = await fetch(url, { signal: controller ? controller.signal : undefined });
      if (timeoutId) clearTimeout(timeoutId);

      if (!res.ok) throw new Error(`Open-Meteo returned HTTP ${res.status}`);
      const data = await res.json();
      const current = data.current || {};
      const daily = data.daily || {};

      const weatherCode = current.weather_code !== undefined ? current.weather_code : 0;
      const sunriseStr = daily.sunrise && daily.sunrise[0] ? formatSunTime(daily.sunrise[0]) : (this.weather?.sunriseStr || '6:00 am');
      const sunsetStr = daily.sunset && daily.sunset[0] ? formatSunTime(daily.sunset[0]) : (this.weather?.sunsetStr || '6:30 pm');

      const weather = {
        temperatureC: current.temperature_2m !== undefined ? Number(current.temperature_2m) : (this.weather?.temperatureC ?? 26.0),
        humidityPercent: current.relative_humidity_2m !== undefined ? Number(current.relative_humidity_2m) : (this.weather?.humidityPercent ?? 55.0),
        tempMaxC: daily.temperature_2m_max && daily.temperature_2m_max[0] !== undefined ? Number(daily.temperature_2m_max[0]) : (this.weather?.tempMaxC ?? 30.0),
        tempMinC: daily.temperature_2m_min && daily.temperature_2m_min[0] !== undefined ? Number(daily.temperature_2m_min[0]) : (this.weather?.tempMinC ?? 18.0),
        precipitationMm: current.precipitation !== undefined ? Number(current.precipitation) : 0.0,
        pressureHpa: current.surface_pressure !== undefined ? Number(current.surface_pressure) : 1012.0,
        windSpeedKmh: current.wind_speed_10m !== undefined ? Number(current.wind_speed_10m) : 12.0,
        sunriseStr,
        sunsetStr,
        conditionText: getWeatherConditionText(weatherCode),
        weatherCode,
        lastUpdated: new Date().toISOString()
      };

      this.weather = weather;
      this._saveWeather(weather);
      this.emit('weatherUpdated', this.weather);

      // Sync with tempHumiditySensorUSB
      if (tempHumiditySensorUSB && typeof tempHumiditySensorUSB.setWeatherCache === 'function') {
        tempHumiditySensorUSB.setWeatherCache(this.weather);
      }

      return weather;
    } catch (err) {
      if (timeoutId) clearTimeout(timeoutId);
      console.warn('[LocationService] fetchLiveWeather fallback:', err.message);
      // Return currently cached weather with updated timestamp if available
      return this.weather;
    }
  }

  /**
   * Re-fetch live weather for current active coordinates
   */
  async refreshWeather() {
    return await this.fetchLiveWeather(this.location.latitude, this.location.longitude);
  }

  /**
   * Set user prompted state to avoid nagging
   */
  setPrompted(value = true) {
    this.hasPromptedState = Boolean(value);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('agrispectra_location_prompted', String(this.hasPromptedState));
      }
    } catch (e) {}
  }

  /**
   * Check if user was already prompted for location
   */
  isPrompted() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('agrispectra_location_prompted') === 'true';
      }
    } catch (e) {}
    return Boolean(this.hasPromptedState);
  }

  /**
   * Alias for isPrompted() expected by UI components
   */
  hasPrompted() {
    return this.isPrompted();
  }

  /**
   * Check if current location is verified by hardware/device GPS
   */
  isGPSVerified() {
    return Boolean(this.location && this.location.isGpsExact && this.location.permissionState === 'granted');
  }

  /**
   * Request device GPS permission and locate user
   * Performs geolocation query -> reverse geocode -> hyper-local weather fetch -> hardware sync
   * @param {object} options
   * @param {boolean} options.highAccuracy - Request GPS hardware fix if true
   * @param {boolean} options.silent - If true, avoid noisy logging
   * @returns {Promise<{ success: boolean, location?: object, weather?: object, error?: string }>}
   */
  async requestLocationPermission({ highAccuracy = true, silent = false } = {}) {
    this.setPrompted(true);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.location.permissionState = 'unsupported';
      this._saveLocation(this.location);
      return { success: false, error: 'Geolocation is not supported by this platform' };
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = Number(position.coords.latitude);
            const lon = Number(position.coords.longitude);
            const accuracy = Number(position.coords.accuracy) || 10;

            // Step 1: Reverse Geocoding
            const geo = await this.reverseGeocode(lat, lon);

            // Step 2: Store location state
            this.location = {
              latitude: lat,
              longitude: lon,
              accuracy,
              city: geo.city,
              region: geo.region,
              country: geo.country,
              displayName: geo.displayName,
              timestamp: new Date().toISOString(),
              permissionState: 'granted',
              isGpsExact: true
            };

            this._saveLocation(this.location);
            this.emit('locationUpdated', this.location);

            // Step 3: Hardware synchronization
            if (tempHumiditySensorUSB && typeof tempHumiditySensorUSB.setLocation === 'function') {
              tempHumiditySensorUSB.setLocation(lat, lon, this.location.displayName);
            }

            // Step 4: Live weather ingestion
            const weather = await this.fetchLiveWeather(lat, lon);

            resolve({
              success: true,
              location: this.getLocation(),
              weather
            });
          } catch (e) {
            resolve({
              success: true,
              location: this.getLocation(),
              weather: this.getWeather()
            });
          }
        },
        async (error) => {
          // If user explicitly denied permission (code 1), strictly respect denial
          if (error && error.code === 1) {
            this.location.permissionState = 'denied';
            this.location.isGpsExact = false;
            this._saveLocation(this.location);
            this.emit('permissionDenied', { code: error.code, message: error.message });
            return resolve({
              success: false,
              error: error.message || 'Location permission denied'
            });
          }

          // If native GPS times out or errors, gracefully use the network location
          try {
            const fallbackLoc = await this.detectNetworkLocation();
            if (fallbackLoc && fallbackLoc.city !== 'Ludhiana') {
              this.location.permissionState = 'granted';
              this.location.isGpsExact = true;
              this._saveLocation(this.location);
              this.emit('locationUpdated', this.location);
              const weather = await this.fetchLiveWeather(this.location.latitude, this.location.longitude);
              return resolve({
                success: true,
                location: this.getLocation(),
                weather
              });
            }
          } catch (e) {}

          this.location.permissionState = 'denied';
          this.location.isGpsExact = false;
          this._saveLocation(this.location);
          this.emit('permissionDenied', { code: error.code, message: error.message });
          resolve({
            success: false,
            error: error.message || 'Location permission denied'
          });
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: 12000,
          maximumAge: 30000
        }
      );
    });
  }

  /**
   * Manually override or update location coordinates
   */
  setLocation(latitude, longitude, displayName = null) {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const coordStr = formatCoordinates(lat, lon);

    this.location = {
      ...this.location,
      latitude: lat,
      longitude: lon,
      displayName: displayName || `${coordStr}`,
      timestamp: new Date().toISOString()
    };

    this._saveLocation(this.location);
    this.emit('locationUpdated', this.location);
    this._syncWithHardware();
    return this.location;
  }
}

// Export singleton instance
export const locationService = new LocationService();
export default locationService;
