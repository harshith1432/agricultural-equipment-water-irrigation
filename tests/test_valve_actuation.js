// Test Valve Actuation on Device
import http from 'http';
import { execSync } from 'child_process';

async function run() {
  const data = await new Promise((resolve, reject) => {
    http.get('http://localhost:9222/json', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });
  const page = data.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);

  let id = 1;
  function send(method, params = {}) {
    return new Promise((resolve) => {
      const msgId = id++;
      const handler = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.id === msgId) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  // 1. Inspect first valve button
  const statusBefore = await send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.querySelector('.valve-actuate-btn');
      return {
        found: !!btn,
        action: btn ? btn.getAttribute('data-action') : null,
        gateId: btn ? btn.getAttribute('data-gate-id') : null,
        text: btn ? btn.textContent.trim() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Valve Status Before Click:', statusBefore.result.value);

  // 2. Select 45m duration and click Open Gate
  const clickResult = await send('Runtime.evaluate', {
    expression: `(function() {
      const timer45 = document.querySelector('.timer-btn[data-duration="45"]');
      if (timer45) timer45.click();
      const btn = document.querySelector('.valve-actuate-btn');
      if (btn) {
        btn.click();
        return { clicked: true, gateId: btn.getAttribute('data-gate-id'), action: btn.getAttribute('data-action') };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Valve Click Result:', clickResult.result.value);

  await new Promise(r => setTimeout(r, 1200));

  // 3. Inspect valve button after actuation
  const statusAfter = await send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.querySelector('.valve-actuate-btn');
      return {
        action: btn ? btn.getAttribute('data-action') : null,
        text: btn ? btn.textContent.trim() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Valve Status After Actuation:', statusAfter.result.value);

  // Capture screenshot of opened valve
  const qaDir = 'C:\\Users\\harsh\\.gemini\\antigravity\\brain\\4d7789e5-67da-4365-9f64-62dbc4c8bd7c\\qa_screenshots';
  const wsQaDir = 'd:\\projects softwares\\agricultural-equipment-water-irrigation\\tests\\qa_artifacts';
  execSync(`adb -s 083773125M072224 exec-out screencap -p > "${qaDir}\\07_valve_opened.png"`, { shell: 'powershell.exe' });
  execSync(`Copy-Item "${qaDir}\\07_valve_opened.png" "${wsQaDir}\\07_valve_opened.png" -Force`, { shell: 'powershell.exe' });
  console.log('Screenshot 07_valve_opened.png saved.');

  // 4. Now click Send -12V Pulse to Close
  const closeResult = await send('Runtime.evaluate', {
    expression: `(function() {
      const btn = document.querySelector('.valve-actuate-btn');
      if (btn && btn.getAttribute('data-action') === 'CLOSE') {
        btn.click();
        return { closed: true, text: btn.textContent.trim() };
      }
      return { closed: false };
    })()`,
    returnByValue: true
  });
  console.log('Valve Close Result:', closeResult.result.value);

  await new Promise(r => setTimeout(r, 1200));

  execSync(`adb -s 083773125M072224 exec-out screencap -p > "${qaDir}\\08_valve_closed.png"`, { shell: 'powershell.exe' });
  execSync(`Copy-Item "${qaDir}\\08_valve_closed.png" "${wsQaDir}\\08_valve_closed.png" -Force`, { shell: 'powershell.exe' });
  console.log('Screenshot 08_valve_closed.png saved.');

  ws.close();
}

run().catch(console.error);
