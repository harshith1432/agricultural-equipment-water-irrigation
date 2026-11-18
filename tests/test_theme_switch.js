// Test Theme Switcher
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

  // Check current theme
  const currentTheme = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        bodyClass: document.body.className,
        themeSelect: document.querySelector('#header-theme-select')?.value,
        bgColor: window.getComputedStyle(document.body).backgroundColor,
        textColor: window.getComputedStyle(document.body).color
      };
    })()`,
    returnByValue: true
  });
  console.log('Current Theme Status:', currentTheme.result.value);

  // Switch to Creamy Light Oat/Linen
  await send('Runtime.evaluate', {
    expression: `(() => {
      const sel = document.querySelector('#header-theme-select');
      if (sel) {
        sel.value = 'creamy-agri';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`,
    returnByValue: true
  });

  await new Promise(r => setTimeout(r, 600));

  const creamyStatus = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        bodyClass: document.body.className,
        themeSelect: document.querySelector('#header-theme-select')?.value,
        bgColor: window.getComputedStyle(document.body).backgroundColor,
        computedFont: window.getComputedStyle(document.body).fontFamily
      };
    })()`,
    returnByValue: true
  });
  console.log('Creamy Agri Theme Status:', creamyStatus.result.value);

  const qaDir = 'C:\\Users\\harsh\\.gemini\\antigravity\\brain\\4d7789e5-67da-4365-9f64-62dbc4c8bd7c\\qa_screenshots';
  const wsQaDir = 'd:\\projects softwares\\agricultural-equipment-water-irrigation\\tests\\qa_artifacts';
  execSync(`adb -s 083773125M072224 exec-out screencap -p > "${qaDir}\\09_creamy_agri_theme_verified.png"`, { shell: 'powershell.exe' });
  execSync(`Copy-Item "${qaDir}\\09_creamy_agri_theme_verified.png" "${wsQaDir}\\09_creamy_agri_theme_verified.png" -Force`, { shell: 'powershell.exe' });
  console.log('Screenshot 09_creamy_agri_theme_verified.png saved.');

  ws.close();
}
run().catch(console.error);
