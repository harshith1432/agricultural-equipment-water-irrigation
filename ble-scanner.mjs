/**
 * BLE Scanner for AgriSpectra Spectroscope
 * Uses @abandonware/noble to discover the STM32 B-L475E-IOT01A2 BlueNRG device,
 * enumerate all GATT services/characteristics, and log real notification payloads.
 * 
 * Run: node ble-scanner.mjs
 * Requirements: @abandonware/noble installed, Windows BLE adapter active
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let noble;
try {
  noble = require('@abandonware/noble');
} catch (e) {
  console.error('[BLE Scanner] noble not installed. Run: npm install @abandonware/noble');
  process.exit(1);
}

// Known target device names / name fragments
const TARGET_NAMES = [
  'agrispectra', 'spectr', 'bluenrg', 'stm32', 'iot01', 'spbtle',
  'leafclip', 'leaf_clip', 'leaf-clip', 'nrg', 'bluechar', 'chatble',
  'chat', 'bluechat', 'st ble', 'stm ble'
];

const KNOWN_UUIDS = {
  'd973f2e0b19e11e29e960800200c9a66': 'BlueNRG Chat Service',
  'd973f2e1b19e11e29e960800200c9a66': 'BlueNRG TX (notify → phone)',
  'd973f2e2b19e11e29e960800200c9a66': 'BlueNRG RX (write ← phone)',
  '6e400001b5a3f393e0a9e50e24dcca9e': 'Nordic UART Service (NUS)',
  '6e400002b5a3f393e0a9e50e24dcca9e': 'NUS RX (write ← phone)',
  '6e400003b5a3f393e0a9e50e24dcca9e': 'NUS TX (notify → phone)',
  '0000ffe0000010008000005f9b34fb': 'FFE0 Custom Service',
  '0000ffe1000010008000005f9b34fb': 'FFE1 Data (notify)',
  '0000ffe2000010008000005f9b34fb': 'FFE2 Command (write)',
  '0000180f000010008000005f9b34fb': 'Battery Service',
  '0000180a000010008000005f9b34fb': 'Device Information Service',
};

const scanResults = [];

function normalizeUuid(uuid) {
  return uuid.replace(/-/g, '').toLowerCase();
}

function describeUuid(uuid) {
  const n = normalizeUuid(uuid);
  return KNOWN_UUIDS[n] || uuid;
}

function isTargetDevice(peripheral) {
  const name = (peripheral.advertisement?.localName || peripheral.id || '').toLowerCase();
  return TARGET_NAMES.some(t => name.includes(t));
}

console.log('\n=== AgriSpectra BLE Scanner ===');
console.log('Scanning for spectroscope... (30 seconds)');
console.log('All nearby BLE devices will also be listed.\n');

noble.on('stateChange', (state) => {
  console.log(`[noble] BT State: ${state}`);
  if (state === 'poweredOn') {
    // Scan for all devices (no service filter) so we can find the spectroscope
    noble.startScanning([], false);
  } else {
    noble.stopScanning();
    console.error(`[noble] Bluetooth adapter not ready: ${state}`);
  }
});

noble.on('discover', async (peripheral) => {
  const name = peripheral.advertisement?.localName || '(no name)';
  const addr = peripheral.address || peripheral.id;
  const rssi = peripheral.rssi;
  const svcs = (peripheral.advertisement?.serviceUuids || []).map(u => describeUuid(u)).join(', ') || 'none';

  const isTarget = isTargetDevice(peripheral);
  if (isTarget) {
    console.log(`\n[*** TARGET FOUND ***] ${name} @ ${addr} RSSI:${rssi}`);
    console.log(`  Advertised services: ${svcs}`);
  } else {
    console.log(`[Nearby] ${name} @ ${addr} RSSI:${rssi} svcs:[${svcs}]`);
  }

  scanResults.push({ name, addr, rssi, svcs: peripheral.advertisement?.serviceUuids || [], isTarget });

  if (isTarget) {
    noble.stopScanning();
    console.log(`\n[+] Connecting to ${name}...`);

    peripheral.connect((err) => {
      if (err) {
        console.error(`[!] Connection error: ${err}`);
        return;
      }
      console.log(`[+] Connected to ${name}`);
      console.log('[+] Discovering all services and characteristics...\n');

      peripheral.discoverAllServicesAndCharacteristics((err, services, characteristics) => {
        if (err) {
          console.error(`[!] Discovery error: ${err}`);
          peripheral.disconnect();
          return;
        }

        console.log(`\n=== GATT Profile for "${name}" (${addr}) ===\n`);

        const profile = [];
        for (const svc of services) {
          const svcDesc = describeUuid(svc.uuid);
          console.log(`SERVICE: ${svc.uuid}`);
          console.log(`  Description: ${svcDesc}`);
          
          const chars = [];
          for (const c of (svc.characteristics || [])) {
            const props = c.properties.join(', ');
            const cDesc = describeUuid(c.uuid);
            console.log(`  CHAR: ${c.uuid}`);
            console.log(`    Description: ${cDesc}`);
            console.log(`    Properties:  ${props}`);
            chars.push({ uuid: c.uuid, desc: cDesc, props });

            // Subscribe to notifications on any notifiable characteristic
            if (c.properties.includes('notify') || c.properties.includes('indicate')) {
              c.notify(true, (err) => {
                if (!err) {
                  console.log(`    [*] Subscribed to notifications on ${c.uuid} (${cDesc})`);
                }
              });

              c.on('data', (data, isNotify) => {
                const hex = data.toString('hex');
                const ascii = data.toString('ascii').replace(/[^\x20-\x7E]/g, '.');
                console.log(`\n[NOTIFICATION] char:${c.uuid} (${cDesc})`);
                console.log(`  HEX:   ${hex}`);
                console.log(`  ASCII: ${ascii}`);
                console.log(`  Bytes: ${data.length}`);
              });
            }
          }
          console.log('');
          profile.push({ service: svc.uuid, desc: svcDesc, characteristics: chars });
        }

        // Write a HELLO command to the most likely command characteristic
        // Try BlueNRG RX first, then NUS RX
        const helloPayload = Buffer.from('$CMD:HELLO\n');
        const candidateWriteChars = characteristics.filter(c =>
          (c.properties.includes('write') || c.properties.includes('writeWithoutResponse')) &&
          (normalizeUuid(c.uuid).includes('d973f2e2') || normalizeUuid(c.uuid).includes('6e400002') || normalizeUuid(c.uuid).includes('ffe2'))
        );

        if (candidateWriteChars.length > 0) {
          const wChar = candidateWriteChars[0];
          console.log(`\n[+] Sending HELLO to ${wChar.uuid}...`);
          setTimeout(() => {
            wChar.write(helloPayload, false, (err) => {
              if (err) console.error(`[!] HELLO write failed: ${err}`);
              else console.log(`[+] HELLO sent: ${helloPayload.toString('ascii').trim()}`);
            });
          }, 500);
        } else {
          console.log('\n[!] No known writable characteristic found for HELLO command.');
        }

        // Write summary to file
        const fs = require('fs');
        const summary = {
          device: { name, addr, rssi },
          advertisedServices: scanResults.find(r => r.addr === addr)?.svcs || [],
          gattProfile: profile,
          scanTime: new Date().toISOString()
        };
        fs.writeFileSync('BLE_Scan_Output.json', JSON.stringify(summary, null, 2));
        console.log('\n[+] Scan results written to BLE_Scan_Output.json');
      });
    });

    peripheral.on('disconnect', () => {
      console.log('\n[!] Peripheral disconnected.');
      process.exit(0);
    });
  }
});

// Auto-stop scanning after 30 seconds if target not found
setTimeout(() => {
  if (noble._state === 'poweredOn') {
    noble.stopScanning();
    console.log('\n[!] Scan timeout - spectroscope not found in range.');
    console.log('Found devices:');
    scanResults.forEach(r => console.log(`  - ${r.name} @ ${r.addr} RSSI:${r.rssi}`));
    
    const fs = require('fs');
    fs.writeFileSync('BLE_Scan_Output.json', JSON.stringify({ 
      error: 'Target not found', 
      nearbyDevices: scanResults,
      scanTime: new Date().toISOString()
    }, null, 2));
  }
}, 30000);
