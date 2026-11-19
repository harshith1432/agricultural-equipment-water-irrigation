/**
 * AgriSpectra Flow & Field - Device Integrity & Anti-Tamper Sentinel
 *
 * Implements OWASP MASVS-CODE:
 *  - Client-side root / jailbreak detection markers (Magisk, Frida, Cydia, su).
 *  - Active debugger timing probe detecting interactive breakpoint hijacking.
 *  - Mock geolocation detection preventing GPS location spoofing for farm water gates.
 *  - Automation & WebDriver inspection (Puppeteer, Selenium, Headless Chrome).
 *  - Exports checkDeviceIntegrity() with unified security posture and risk classification.
 */

/**
 * Checks for known root/jailbreak markers, hooking frameworks, and emulators
 * @returns {string[]} Detected threat flags
 */
export function checkRootJailbreakMarkers() {
  const flags = [];
  const g = typeof window !== 'undefined' ? window : globalThis;

  // 1. Known jailbreak / hooking globals
  const hookProperties = [
    { prop: 'su', flag: 'ROOT_BINARY_PROPERTY_SU' },
    { prop: 'Cydia', flag: 'JAILBREAK_CYDIA_DETECTED' },
    { prop: 'Frida', flag: 'HOOKING_FRAMEWORK_FRIDA' },
    { prop: 'Magisk', flag: 'ROOT_FRAMEWORK_MAGISK' },
    { prop: '__nightmare', flag: 'HEADLESS_NIGHTMARE_DETECTED' },
    { prop: '_phantom', flag: 'HEADLESS_PHANTOM_DETECTED' },
    { prop: 'callPhantom', flag: 'HEADLESS_CALLPHANTOM_DETECTED' }
  ];

  for (const { prop, flag } of hookProperties) {
    if (g && typeof g[prop] !== 'undefined') {
      flags.push(flag);
    }
  }

  // 2. Emulator User-Agent signatures (common in automated bot networks)
  const userAgent = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '';
  const emulatorMarkers = [
    /Android SDK built for x86/i,
    /goldfish/i,
    /ranchu/i,
    /Genymotion/i
  ];

  for (const marker of emulatorMarkers) {
    if (marker.test(userAgent)) {
      flags.push('EMULATOR_SIGNATURE_DETECTED');
      break;
    }
  }

  return flags;
}

/**
 * Executes high-precision timing probe to detect attached debuggers and breakpoint pausing
 * @param {number} [thresholdMs=100] - Timing threshold in milliseconds
 * @returns {boolean} True if interactive debugger pause was detected
 */
export function checkDebuggerPresence(thresholdMs = 100) {
  try {
    const perf = typeof performance !== 'undefined' ? performance : Date;
    const t0 = perf.now();

    // Standard debugger statement triggers execution pause if DevTools breakpoint or inspector is attached
    /* eslint-disable no-debugger */
    debugger;
    /* eslint-enable no-debugger */

    const t1 = perf.now();
    return (t1 - t0) > thresholdMs;
  } catch {
    return false;
  }
}

/**
 * Inspects navigator for automation frameworks (WebDriver / Selenium / Puppeteer)
 * @returns {string[]} Detected automation flags
 */
export function checkAutomationFlags() {
  const flags = [];
  if (typeof navigator !== 'undefined') {
    if (navigator.webdriver === true) {
      flags.push('AUTOMATION_WEBDRIVER_ACTIVE');
    }
  }
  return flags;
}

/**
 * Analyzes geolocation coordinates for mock location provider anomalies
 * @param {Object} coords - GeolocationCoordinates or mock location object
 * @returns {string[]} Detected GPS anomalies
 */
export function checkMockLocation(coords) {
  const flags = [];
  if (!coords || typeof coords !== 'object') return flags;

  // 1. Android/iOS Mock Provider Flag
  if (coords.isMock === true || coords.mocked === true) {
    flags.push('MOCK_GEOLOCATION_PROVIDER_ACTIVE');
  }

  // 2. Null Island (0.0, 0.0) coordinates spoofing
  if (coords.latitude === 0 && coords.longitude === 0) {
    flags.push('MOCK_GEOLOCATION_NULL_ISLAND');
  }

  // 3. Unrealistic GPS accuracy
  if (coords.accuracy !== undefined && coords.accuracy <= 0) {
    flags.push('MOCK_GEOLOCATION_INVALID_ACCURACY');
  }

  return flags;
}

/**
 * Master Device Integrity & Anti-Tamper Sentinel Probe
 * @param {Object} [options]
 * @param {Object} [options.coords] - Optional GPS coordinates to inspect for mocking
 * @param {boolean} [options.skipDebugger=false] - Skip debugger probe (e.g. in IDE test runs)
 * @returns {{ isSecure: boolean, flags: string[], riskLevel: 'LOW' | 'MEDIUM' | 'HIGH', timestamp: string }}
 */
export function checkDeviceIntegrity(options = {}) {
  const flags = [];

  // 1. Root & Jailbreak checks
  const rootFlags = checkRootJailbreakMarkers();
  flags.push(...rootFlags);

  // 2. Debugger timing probe
  if (!options.skipDebugger) {
    const isDebugging = checkDebuggerPresence(options.debuggerThresholdMs || 100);
    if (isDebugging) {
      flags.push('DEBUGGER_PAUSE_DETECTED');
    }
  }

  // 3. Automation / WebDriver checks
  const autoFlags = checkAutomationFlags();
  flags.push(...autoFlags);

  // 4. Mock GPS checks (if coordinates passed)
  if (options.coords) {
    const gpsFlags = checkMockLocation(options.coords);
    flags.push(...gpsFlags);
  }

  // Assess Risk Level
  let riskLevel = 'LOW';
  let isSecure = true;

  const highRiskFlags = [
    'ROOT_BINARY_PROPERTY_SU',
    'JAILBREAK_CYDIA_DETECTED',
    'HOOKING_FRAMEWORK_FRIDA',
    'ROOT_FRAMEWORK_MAGISK',
    'DEBUGGER_PAUSE_DETECTED'
  ];

  const hasHighRisk = flags.some(f => highRiskFlags.includes(f));
  if (hasHighRisk) {
    riskLevel = 'HIGH';
    isSecure = false;
  } else if (flags.length > 0) {
    riskLevel = 'MEDIUM';
    isSecure = false;
  }

  return {
    isSecure,
    flags,
    riskLevel,
    timestamp: new Date().toISOString()
  };
}

export const deviceIntegrity = {
  checkDeviceIntegrity,
  checkRootJailbreakMarkers,
  checkDebuggerPresence,
  checkAutomationFlags,
  checkMockLocation
};

export default deviceIntegrity;
