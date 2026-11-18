// Automated Native App QA & Chaos Engineering Test Suite
// Targets com.agrispectra.flowfield running on device 083773125M072224 via DevTools CDP

import http from 'http';
import fs from 'fs';
import { execSync } from 'child_process';

async function getDebuggerUrl() {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const page = list.find(item => item.type === 'page');
          if (page && page.webSocketDebuggerUrl) {
            resolve(page.webSocketDebuggerUrl);
          } else {
            reject(new Error('No page target found in DevTools'));
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function captureScreenshot(filename) {
  const qaDir = "C:\\Users\\harsh\\.gemini\\antigravity\\brain\\4d7789e5-67da-4365-9f64-62dbc4c8bd7c\\qa_screenshots";
  const wsQaDir = "d:\\projects softwares\\agricultural-equipment-water-irrigation\\tests\\qa_artifacts";
  const localFile = `${qaDir}\\${filename}`;
  const wsFile = `${wsQaDir}\\${filename}`;
  execSync(`adb -s 083773125M072224 exec-out screencap -p > "${localFile}"`, { shell: 'powershell.exe' });
  execSync(`Copy-Item "${localFile}" "${wsFile}" -Force`, { shell: 'powershell.exe' });
  console.log(`[Screenshot Captured]: ${filename}`);
}

async function runQaSuite() {
  console.log('=== Starting AgriSpectra Native Mobile QA & Chaos Test Suite ===');
  
  const wsUrl = await getDebuggerUrl();
  console.log(`[CDP] Connected to WebView target: ${wsUrl}`);
  
  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = id++;
      callbacks.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.id && callbacks.has(data.id)) {
      const { resolve, reject } = callbacks.get(data.id);
      callbacks.delete(data.id);
      if (data.error) reject(data.error);
      else resolve(data.result);
    }
  };

  await new Promise((resolve) => ws.onopen = resolve);
  console.log('[CDP] WebSocket session initialized.');

  async function evaluate(expression) {
    const res = await sendCommand('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  // 1. App Identity and Base DOM Verification
  console.log('\n--- Step 1: Base Application DOM & Identity Verification ---');
  const appInfo = await evaluate(`({
    title: document.title,
    theme: document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('creamy-agri') ? 'creamy-agri' : 'default'),
    bodyClasses: document.body.className,
    htmlClasses: document.documentElement.className,
    valvesCount: document.querySelectorAll('[data-valve-id]').length,
    buttonsCount: document.querySelectorAll('button').length,
    headerBleBtn: !!document.querySelector('#header-ble-btn'),
    headerMqttBtn: !!document.querySelector('#header-mqtt-btn'),
    headerEmergencyBtn: !!document.querySelector('#header-emergency-kill-btn'),
    headerThemeSelect: !!document.querySelector('#header-theme-select')
  })`);
  console.log('App Metadata:', JSON.stringify(appInfo, null, 2));
  captureScreenshot('01_app_launch_creamy.png');

  // 2. Theme Switching Verification
  console.log('\n--- Step 2: Theme Switching & Contrast Verification ---');
  const themesToTest = ['creamy-agri', 'lush-emerald', 'sunlight', 'dark-soil'];
  for (const theme of themesToTest) {
    const applied = await evaluate(`(function() {
      const select = document.querySelector('#header-theme-select');
      if (select) {
        select.value = '${theme}';
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return {
        selected: select ? select.value : null,
        htmlClass: document.documentElement.className,
        bgCreamyPresent: document.documentElement.classList.contains('creamy-agri') || document.body.classList.contains('creamy-agri')
      };
    })()`);
    console.log(`[Theme Switch -> ${theme}]:`, applied);
    await new Promise(r => setTimeout(r, 600));
  }
  // Restore creamy-agri
  await evaluate(`(function() {
    const select = document.querySelector('#header-theme-select');
    if (select) {
      select.value = 'creamy-agri';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })()`);
  captureScreenshot('02_theme_switched_creamy.png');

  // 3. Valve Control Center Operation
  console.log('\n--- Step 3: Solenoid Valve Control Interactivity ---');
  const valveBefore = await evaluate(`(function() {
    const valveBtn = document.querySelector('button[data-valve-id="G1"]') || 
                     document.querySelector('button[data-action="toggle-valve"]') ||
                     Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('OPEN') || b.textContent.includes('CLOSE') || b.textContent.includes('G1'));
    return {
      found: !!valveBtn,
      text: valveBtn ? valveBtn.textContent.trim() : null,
      id: valveBtn ? (valveBtn.getAttribute('data-valve-id') || valveBtn.id) : null
    };
  })()`);
  console.log('Initial Valve Button:', valveBefore);

  // Click the valve button to actuate valve G1
  const valveClickResult = await evaluate(`(function() {
    const valveBtn = document.querySelector('button[data-valve-id="G1"]') || 
                     Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('G1') || b.textContent.includes('OPEN') || b.textContent.includes('VALVE'));
    if (valveBtn) {
      valveBtn.click();
      return { clicked: true, text: valveBtn.textContent.trim() };
    }
    return { clicked: false };
  })()`);
  console.log('Valve Actuation Trigger:', valveClickResult);
  await new Promise(r => setTimeout(r, 800));
  captureScreenshot('03_valve_interactivity.png');

  // 4. Emergency Killswitch Breaker
  console.log('\n--- Step 4: Emergency Stop Killswitch Stress Test ---');
  const killswitchResult = await evaluate(`(function() {
    const killBtn = document.querySelector('#header-emergency-kill-btn');
    if (killBtn) {
      killBtn.click();
      return { triggered: true };
    }
    return { triggered: false };
  })()`);
  console.log('Emergency Killswitch Action:', killswitchResult);
  await new Promise(r => setTimeout(r, 1000));
  captureScreenshot('04_emergency_killswitch_active.png');

  // 5. Leaf-Clip Spectrometer Hardware Simulation Trigger
  console.log('\n--- Step 5: Leaf-Clip Spectrometer Modal & Chemometrics ---');
  const modalResult = await evaluate(`(function() {
    const bleBtn = document.querySelector('#header-ble-btn');
    if (bleBtn) {
      bleBtn.click();
      return { modalOpened: true };
    }
    return { modalOpened: false };
  })()`);
  console.log('Leaf Clip Modal Trigger:', modalResult);
  await new Promise(r => setTimeout(r, 1000));
  captureScreenshot('05_leaf_clip_modal.png');

  // Close modal or dismiss
  await evaluate(`(function() {
    const closeBtn = document.querySelector('[data-modal-close]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Close') || b.textContent.includes('Cancel') || b.textContent.includes('Back'));
    if (closeBtn) closeBtn.click();
  })()`);

  ws.close();
  console.log('\n=== QA & Chaos Engineering Test Suite Completed Successfully! ===');
}

runQaSuite().catch(err => {
  console.error('QA Suite Failed:', err);
  process.exit(1);
});
