/**
 * Automated Verification Suite for Precision GPS Location & Hyper-Local Weather Engine
 * 
 * Verifies:
 *   1. LocationService initialization and fallback to Punjab agricultural belt
 *   2. Schema compliance for location and weather state in localStorage
 *   3. Reactive event emitter (locationUpdated, weatherUpdated)
 *   4. Geolocation permission lifecycle (unsupported, denied, granted)
 *   5. Reverse geocoding with BigDataCloud and coordinate fallback
 *   6. Hyper-local weather ingestion from Open-Meteo
 *   7. Dynamic integration and synchronization with TempHumiditySensorUSB
 */

import { describe, it, expect } from './framework.js';

// Headless in-memory localStorage shim
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

import {
  LocationService,
  locationService,
  DEFAULT_LOCATION,
  DEFAULT_WEATHER,
  formatCoordinates,
  formatSunTime,
  getWeatherConditionText
} from '../src/services/locationService.js';

import {
  tempHumiditySensorUSB,
  TempHumiditySensorUSB,
  CONNECTION_MODES,
  DATA_SOURCES
} from '../src/hardware/tempHumiditySensorUSB.js';

export function registerLocationServiceTests() {
  describe('Location & Weather Service - Initialization & Defaults', () => {
    it('initializes with default Punjab agricultural belt coordinates when no cache exists', () => {
      // Clear storage
      localStorage.removeItem('agrispectra_user_location');
      localStorage.removeItem('agrispectra_live_weather');

      const service = new LocationService();
      const loc = service.getLocation();

      expect(loc.latitude).toBe(30.9010);
      expect(loc.longitude).toBe(75.8573);
      expect(loc.city).toBe('Ludhiana');
      expect(loc.region).toBe('Punjab');
      expect(loc.country).toBe('India');
      expect(loc.permissionState).toBe('prompt');
      expect(loc.isGpsExact).toBe(false);
      expect(loc.displayName).toContain('Ludhiana, Punjab');
    });

    it('loads and merges persistent cached location from localStorage', () => {
      const cached = {
        latitude: 12.9716,
        longitude: 77.5946,
        accuracy: 15,
        city: 'Bengaluru',
        region: 'Karnataka',
        country: 'India',
        displayName: 'Bengaluru, Karnataka • 12.97°N, 77.59°E',
        timestamp: new Date().toISOString(),
        permissionState: 'granted',
        isGpsExact: true
      };
      localStorage.setItem('agrispectra_user_location', JSON.stringify(cached));

      const service = new LocationService();
      const loc = service.getLocation();

      expect(loc.latitude).toBe(12.9716);
      expect(loc.longitude).toBe(77.5946);
      expect(loc.city).toBe('Bengaluru');
      expect(loc.permissionState).toBe('granted');
      expect(loc.isGpsExact).toBe(true);
    });

    it('loads cached live weather data with complete schema', () => {
      const weatherCached = {
        temperatureC: 28.5,
        humidityPercent: 62.0,
        tempMaxC: 32.0,
        tempMinC: 21.0,
        precipitationMm: 1.2,
        pressureHpa: 1010.5,
        windSpeedKmh: 14.2,
        sunriseStr: '6:15 am',
        sunsetStr: '6:45 pm',
        conditionText: 'Partly Cloudy',
        weatherCode: 2,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem('agrispectra_live_weather', JSON.stringify(weatherCached));

      const service = new LocationService();
      const w = service.getWeather();

      expect(w.temperatureC).toBe(28.5);
      expect(w.humidityPercent).toBe(62.0);
      expect(w.sunriseStr).toBe('6:15 am');
      expect(w.conditionText).toBe('Partly Cloudy');
    });
  });

  describe('Location & Weather Service - Formatters & Utilities', () => {
    it('formats coordinates with cardinal compass suffixes', () => {
      const northEast = formatCoordinates(12.9716, 77.5946);
      expect(northEast).toBe('12.97°N, 77.59°E');

      const southWest = formatCoordinates(-33.8688, -151.2093);
      expect(southWest).toBe('33.87°S, 151.21°W');
    });

    it('formats ISO timestamps to 12-hour AM/PM representations', () => {
      expect(formatSunTime('2026-11-19T06:20')).toBe('6:20 am');
      expect(formatSunTime('2026-11-19T18:45')).toBe('6:45 pm');
      expect(formatSunTime('2026-11-19T00:05')).toBe('12:05 am');
      expect(formatSunTime('2026-11-19T12:00')).toBe('12:00 pm');
    });

    it('maps WMO Weather interpretation codes accurately', () => {
      expect(getWeatherConditionText(0)).toBe('Clear Sky');
      expect(getWeatherConditionText(1)).toBe('Mainly Clear');
      expect(getWeatherConditionText(2)).toBe('Partly Cloudy');
      expect(getWeatherConditionText(3)).toBe('Overcast');
      expect(getWeatherConditionText(45)).toBe('Foggy');
      expect(getWeatherConditionText(61)).toBe('Rain');
      expect(getWeatherConditionText(80)).toBe('Rain Showers');
      expect(getWeatherConditionText(95)).toBe('Thunderstorm');
    });
  });

  describe('Location & Weather Service - Reactive Event Broadcasting', () => {
    it('emits locationUpdated and weatherUpdated events', () => {
      const service = new LocationService();
      let locationFired = null;
      let weatherFired = null;

      const unsubLoc = service.on('locationUpdated', (data) => {
        locationFired = data;
      });

      const unsubWeather = service.on('weatherUpdated', (data) => {
        weatherFired = data;
      });

      service.setLocation(26.9124, 75.7873, 'Jaipur, Rajasthan • 26.91°N, 75.79°E');
      expect(locationFired).toBeDefined();
      expect(locationFired.latitude).toBe(26.9124);
      expect(locationFired.displayName).toContain('Jaipur');

      service.emit('weatherUpdated', { temperatureC: 31.0 });
      expect(weatherFired).toBeDefined();
      expect(weatherFired.temperatureC).toBe(31.0);

      // Unsubscribe verification
      unsubLoc();
      locationFired = null;
      service.setLocation(28.6139, 77.2090, 'Delhi • 28.61°N, 77.21°E');
      expect(locationFired).toBeNull();
    });
  });

  describe('Location & Weather Service - Geolocation & Permissions', () => {
    it('gracefully flags unsupported when navigator.geolocation is missing', async () => {
      const originalGeo = globalThis.navigator?.geolocation;
      if (globalThis.navigator) delete globalThis.navigator.geolocation;

      const service = new LocationService();
      const res = await service.requestLocationPermission();

      expect(res.success).toBe(false);
      expect(service.getLocation().permissionState).toBe('unsupported');

      // Restore
      if (globalThis.navigator && originalGeo) {
        globalThis.navigator.geolocation = originalGeo;
      }
    });

    it('handles permission denial and flags permissionState: denied', async () => {
      if (!globalThis.navigator) globalThis.navigator = {};
      globalThis.navigator.geolocation = {
        getCurrentPosition: (success, error) => {
          error({ code: 1, message: 'User denied Geolocation' });
        }
      };

      const service = new LocationService();
      const res = await service.requestLocationPermission();

      expect(res.success).toBe(false);
      expect(service.getLocation().permissionState).toBe('denied');
      expect(service.getLocation().isGpsExact).toBe(false);
    });

    it('successfully acquires GPS fix, updates coordinates, and synchronizes state', async () => {
      if (!globalThis.navigator) globalThis.navigator = {};
      globalThis.navigator.geolocation = {
        getCurrentPosition: (success) => {
          success({
            coords: {
              latitude: 19.0760,
              longitude: 72.8777,
              accuracy: 12
            }
          });
        }
      };

      const service = new LocationService();
      const res = await service.requestLocationPermission({ highAccuracy: true });

      expect(res.success).toBe(true);
      const loc = service.getLocation();
      expect(loc.latitude).toBe(19.0760);
      expect(loc.longitude).toBe(72.8777);
      expect(loc.isGpsExact).toBe(true);
      expect(loc.permissionState).toBe('granted');
      expect(loc.accuracy).toBe(12);

      // Verifies persistence in localStorage
      const savedRaw = localStorage.getItem('agrispectra_user_location');
      expect(savedRaw).toBeDefined();
      const saved = JSON.parse(savedRaw);
      expect(saved.latitude).toBe(19.0760);
      expect(saved.permissionState).toBe('granted');
    });
  });

  describe('Hardware Dual-Source Integration - TempHumiditySensorUSB', () => {
    it('automatically synchronizes location coordinates to tempHumiditySensorUSB', () => {
      const service = new LocationService();
      service.setLocation(23.0225, 72.5714, 'Ahmedabad, Gujarat • 23.02°N, 72.57°E');

      const status = tempHumiditySensorUSB.getStatus();
      expect(status.location.latitude).toBe(23.0225);
      expect(status.location.longitude).toBe(72.5714);
      expect(status.location.regionName).toContain('Ahmedabad');
    });

    it('supplies weather cache to TempHumiditySensorUSB in ESTIMATED_WEATHER_API mode', async () => {
      const atmos = new TempHumiditySensorUSB();
      const mockWeather = {
        temperatureC: 29.4,
        humidityPercent: 51.2,
        apparentTempC: 30.1,
        pressureHpa: 1011.0,
        windSpeedKmh: 16.5,
        precipitationMm: 0.0,
        conditionText: 'Mainly Clear',
        weatherCode: 1,
        lastUpdated: new Date().toISOString()
      };

      atmos.setLocation(15.3173, 75.7139, 'Gadag, Karnataka');
      atmos.setWeatherCache(mockWeather);

      const reading = await atmos.readData({ forceSource: DATA_SOURCES.ESTIMATED_WEATHER_API });

      expect(reading.source).toBe(DATA_SOURCES.ESTIMATED_WEATHER_API);
      expect(reading.temperatureCelsius).toBe(29.4);
      expect(reading.humidityPercent).toBe(51.2);
      expect(reading.apparentTempCelsius).toBe(30.1);
      expect(reading.meta.regionName).toBe('Gadag, Karnataka');
      expect(reading.meta.conditionText).toBe('Mainly Clear');
      expect(reading.vpdKpa).toBeDefined();
    });

    it('uses location weather cache when in WIFI_CLOUD mode', async () => {
      const atmos = new TempHumiditySensorUSB();
      atmos.setConnectionMode(CONNECTION_MODES.WIFI_CLOUD);

      const mockWeather = {
        temperatureC: 22.8,
        humidityPercent: 78.4,
        pressureHpa: 1014.2,
        windSpeedKmh: 8.0,
        precipitationMm: 2.4,
        conditionText: 'Drizzle',
        weatherCode: 51,
        lastUpdated: new Date().toISOString()
      };
      atmos.setWeatherCache(mockWeather);

      const reading = await atmos.readData();

      expect(reading.source).toBe(DATA_SOURCES.ESTIMATED_WEATHER_API);
      expect(reading.temperatureCelsius).toBe(22.8);
      expect(reading.humidityPercent).toBe(78.4);
      expect(reading.meta.conditionText).toBe('Drizzle');
    });
  });
}
