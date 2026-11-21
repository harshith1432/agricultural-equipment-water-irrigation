/**
 * BLE Initializer — ensures BleClient.initialize() is called exactly once
 * and properly before any scan/connect/read/write operations.
 * Fixes: BtGatt.ContextMap "Context not found for ID 0" on Android.
 */

let _initialized = false;
let _initializing = false;
let _initPromise = null;

export async function ensureBleInitialized() {
  if (_initialized) return;
  if (_initializing) return _initPromise;

  _initializing = true;
  _initPromise = (async () => {
    try {
      // Capacitor BLE plugin: prefer mocked or window plugin if available
      const BleClient = (typeof window !== 'undefined' && window.Capacitor?.Plugins?.BleClient)
        || (await import('@capacitor-community/bluetooth-le')).BleClient;
      await BleClient.initialize({ androidNeverForLocation: true });
      _initialized = true;
      console.log('[BLE] BleClient initialized successfully');
    } catch (err) {
      _initialized = false;
      _initializing = false;
      _initPromise = null;
      console.error('[BLE] BleClient.initialize failed:', err);
      throw err;
    }
    _initializing = false;
  })();
  return _initPromise;
}

export function resetBleInit() {
  _initialized = false;
  _initializing = false;
  _initPromise = null;
}
