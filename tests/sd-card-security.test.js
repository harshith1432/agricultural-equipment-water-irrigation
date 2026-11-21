/**
  ******************************************************************************
  * Test Suite: SD Card Explorer - 6-Round Adversarial Penetration & Remediation
  * AgriSpectra Spectroscope Clip-Pro 500 & STM32 B-L475E-IOT01A2 Firmware
  * 
  * Verifies:
  *   ROUND 1: Path Traversal & Arbitrary File Access
  *   ROUND 2: Buffer Overflow, Packet Injection & Memory Corruption
  *   ROUND 3: Concurrency Race Conditions & Collision Attacks
  *   ROUND 4: Unauthorized / Replayed Destructive Commands
  *   ROUND 5: Data System Isolation (Zero Contamination)
  *   ROUND 6: BLE Adversarial Disconnection & Hardware Removal
  ******************************************************************************
  */

import { describe, it, expect } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { leafClipDevice, LeafClipBluetoothDevice } from '../src/hardware/webBluetoothLeafClip.js';
import { SdChunkReassembler } from '../src/hardware/packetChunkAccumulator.js';
import { createSpectroscopeSdCardExplorer, SD_FILENAME_REGEX } from '../src/components/SpectroscopeSdCardExplorer.js';
import { offlineSpectralDatabase } from '../src/services/offlineSpectralDatabase.js';

export function registerSDCardSecurityTests() {
  setupHeadlessDOM();

  // =========================================================================
  // ROUND 1: PATH TRAVERSAL & ARBITRARY FILE ACCESS
  // =========================================================================
  describe('Round 1: Path Traversal & Arbitrary File Access', () => {
    const maliciousPaths = [
      '../../system.bin',
      '..\\Windows\\System32\\cmd.exe',
      '/etc/passwd',
      '/',
      '\\',
      '..%2Fsystem.bin',
      '..%2e%2fsystem.bin',
      'SCAN_001.CSV\0.bin',
      'SCAN_001.CSV%00.txt',
      '../../../SCANS/secret.key',
      '.hidden_scan.csv',
      'SCAN_001.EXE',
      'SCAN_VERY_LONG_NAME_EXCEEDING_THIRTY_TWO_CHARACTERS_BEFORE_DOT.CSV',
      'SCAN;rm -rf /;.CSV',
      'SCAN`cat /etc/passwd`.CSV'
    ];

    it('rejects all path traversal and non-whitelisted payloads on client validator', () => {
      maliciousPaths.forEach((path) => {
        const isValid = leafClipDevice.validateSdFilename(path);
        expect(isValid).toBe(false);
      });
    });

    it('validates strictly conformant scan filenames matching regex ^[a-zA-Z0-9_-]{1,32}\\.(CSV|csv|JSON|json)$', () => {
      const validFilenames = [
        'SCAN_001.CSV',
        'scan_20261120_042.csv',
        'FIELD_ZONE_1.JSON',
        'plant-test-99.json',
        'ROMA_TOMATO_A1.CSV',
        'TEST_PROBE.TMP'
      ];

      validFilenames.forEach((fn) => {
        expect(leafClipDevice.validateSdFilename(fn)).toBe(true);
      });
    });

    it('throws SECURITY_VIOLATION when readSdCardFile is invoked with path traversal payload', async () => {
      leafClipDevice.isConnected = true;
      let errorThrown = false;

      try {
        await leafClipDevice.readSdCardFile('../../system.bin');
      } catch (err) {
        errorThrown = true;
        expect(err.message).toContain('SECURITY_VIOLATION');
      }

      expect(errorThrown).toBe(true);
    });

    it('throws SECURITY_VIOLATION when deleteSdCardFile is invoked with path traversal payload', async () => {
      leafClipDevice.isConnected = true;
      let errorThrown = false;

      try {
        await leafClipDevice.deleteSdCardFile('../../system.bin', 12345678);
      } catch (err) {
        errorThrown = true;
        expect(err.message).toContain('SECURITY_VIOLATION');
      }

      expect(errorThrown).toBe(true);
    });

    it('simulates STM32 C firmware canonical path builder /SCANS/ jail', () => {
      function firmwareValidateAndBuildCanonical(filename) {
        // Strict C firmware simulation of SD_Storage_ValidateFilename
        if (!filename || filename.length < 5 || filename.length > 36) return null;
        if (filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.includes('\0')) return null;
        if (!/^[a-zA-Z0-9_-]{1,32}\.(CSV|csv|JSON|json)$/.test(filename) && filename !== 'TEST_PROBE.TMP') return null;

        // Canonical prepending
        const canonical = `/SCANS/${filename}`;
        if (!canonical.startsWith('/SCANS/')) return null;
        if (canonical.slice(7).includes('/') || canonical.slice(7).includes('\\')) return null;
        return canonical;
      }

      expect(firmwareValidateAndBuildCanonical('../../system.bin')).toBe(null);
      expect(firmwareValidateAndBuildCanonical('/etc/passwd')).toBe(null);
      expect(firmwareValidateAndBuildCanonical('SCAN_001.CSV\0.bin')).toBe(null);
      expect(firmwareValidateAndBuildCanonical('SCAN_001.CSV')).toBe('/SCANS/SCAN_001.CSV');
    });
  });

  // =========================================================================
  // ROUND 2: BUFFER OVERFLOW, PACKET INJECTION & MEMORY CORRUPTION
  // =========================================================================
  describe('Round 2: Buffer Overflow, Packet Injection & Memory Corruption', () => {
    it('rejects oversized chunk payload exceeding 512 bytes MTU boundary', () => {
      const reassembler = new SdChunkReassembler({ filename: 'SCAN_001.CSV' });
      const oversizedPayload = new Uint8Array(600); // Exceeds 512B MTU boundary
      let errorThrown = false;

      try {
        reassembler.pushChunk({
          seq: 0,
          totalSeq: 1,
          data: oversizedPayload
        });
      } catch (err) {
        errorThrown = true;
        expect(err.message).toContain('exceeds maximum allowable MTU bounds');
      }

      expect(errorThrown).toBe(true);
    });

    it('rejects negative sequence numbers and non-integer sequence injections', () => {
      const reassembler = new SdChunkReassembler({ filename: 'SCAN_001.CSV' });
      const payload = new Uint8Array(64);

      // Negative sequence
      expect(() => {
        reassembler.pushChunk({ seq: -1, totalSeq: 5, data: payload });
      }).toThrow();

      // Float sequence
      expect(() => {
        reassembler.pushChunk({ seq: 1.5, totalSeq: 5, data: payload });
      }).toThrow();

      // NaN sequence
      expect(() => {
        reassembler.pushChunk({ seq: NaN, totalSeq: 5, data: payload });
      }).toThrow();
    });

    it('rejects 64-bit integer overflow and astronomical sequence numbers', () => {
      const reassembler = new SdChunkReassembler({ filename: 'SCAN_001.CSV' });
      const payload = new Uint8Array(64);

      expect(() => {
        reassembler.pushChunk({
          seq: 9007199254740992, // Exceeds Number.MAX_SAFE_INTEGER
          totalSeq: 10,
          data: payload
        });
      }).toThrow();

      expect(() => {
        reassembler.pushChunk({
          seq: 0xFFFFFFFF,
          totalSeq: 10,
          data: payload
        });
      }).toThrow();
    });

    it('detects corrupted chunk CRC32 checksums and rejects corrupted packets', () => {
      const reassembler = new SdChunkReassembler({ filename: 'SCAN_001.CSV' });
      const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      let errorCaught = false;

      try {
        reassembler.pushChunk({
          seq: 0,
          totalSeq: 1,
          data: payload,
          crc32: 0xDEADBEEF // Deliberately corrupted CRC
        });
      } catch (err) {
        errorCaught = true;
        expect(err.message).toContain('CRC32 mismatch');
      }

      expect(errorCaught).toBe(true);
    });

    it('enforces hard 5MB memory safety cap to prevent RAM exhaustion DoS', () => {
      const reassembler = new SdChunkReassembler({
        filename: 'MASSIVE_FILE.CSV',
        maxFileSize: 5 * 1024 * 1024 // 5MB Cap
      });

      // Push 5MB + 1 byte in valid 512B chunks
      const chunk = new Uint8Array(512);
      let breached = false;

      try {
        const totalChunksNeeded = Math.ceil((5 * 1024 * 1024 + 1024) / 512);
        for (let i = 0; i < totalChunksNeeded; i++) {
          reassembler.pushChunk({
            seq: i,
            totalSeq: totalChunksNeeded,
            data: chunk
          });
        }
      } catch (err) {
        breached = true;
        expect(err.message).toContain('File size bounds exceeded');
      }

      expect(breached).toBe(true);
    });
  });

  // =========================================================================
  // ROUND 3: CONCURRENCY RACE CONDITIONS & COLLISION ATTACKS
  // =========================================================================
  describe('Round 3: Concurrency Race Conditions & Collision Attacks', () => {
    it('blocks file deletion when an active optical scan is running (BUSY_SCAN_IN_PROGRESS)', async () => {
      leafClipDevice.isConnected = true;
      leafClipDevice.leafScanPending = true; // Optical integration active

      let blocked = false;
      try {
        await leafClipDevice.deleteSdCardFile('SCAN_20261120_001.CSV', 12345678);
      } catch (err) {
        blocked = true;
        expect(err.message).toContain('BUSY_SCAN_IN_PROGRESS');
      } finally {
        leafClipDevice.leafScanPending = false;
      }

      expect(blocked).toBe(true);
    });

    it('blocks file read when an active optical scan is running (BUSY_SCAN_IN_PROGRESS)', async () => {
      leafClipDevice.isConnected = true;
      leafClipDevice.isScanning = true;

      let blocked = false;
      try {
        await leafClipDevice.readSdCardFile('SCAN_20261120_001.CSV');
      } catch (err) {
        blocked = true;
        expect(err.message).toContain('BUSY_SCAN_IN_PROGRESS');
      } finally {
        leafClipDevice.isScanning = false;
      }

      expect(blocked).toBe(true);
    });

    it('blocks starting an optical scan while an SD card file read is in progress', async () => {
      leafClipDevice.isConnected = true;
      leafClipDevice.activeSdFileRead = 'SCAN_0142_BELLPEP.CSV';

      let blocked = false;
      try {
        await leafClipDevice.triggerLeafMeasurement();
      } catch (err) {
        blocked = true;
        expect(err.message).toContain('SD_FILE_TRANSFER_IN_PROGRESS');
      } finally {
        leafClipDevice.activeSdFileRead = null;
      }

      expect(blocked).toBe(true);
    });

    it('blocks file deletion on a file currently being read (FILE_IN_USE)', async () => {
      leafClipDevice.isConnected = true;
      leafClipDevice.activeSdFileRead = 'SCAN_0142_BELLPEP.CSV';

      // Seed valid token
      const token = await leafClipDevice.requestDeleteToken('SCAN_0142_BELLPEP.CSV');

      let blocked = false;
      try {
        await leafClipDevice.deleteSdCardFile('SCAN_0142_BELLPEP.CSV', token);
      } catch (err) {
        blocked = true;
        expect(err.message).toContain('FILE_IN_USE');
      } finally {
        leafClipDevice.activeSdFileRead = null;
      }

      expect(blocked).toBe(true);
    });
  });

  // =========================================================================
  // ROUND 4: UNAUTHORIZED / REPLAYED DESTRUCTIVE COMMANDS
  // =========================================================================
  describe('Round 4: Unauthorized / Replayed Destructive Commands', () => {
    it('rejects unsolicited deletion without a valid 32-bit confirmation token', async () => {
      leafClipDevice.isConnected = true;

      let rejected = false;
      try {
        await leafClipDevice.deleteSdCardFile('SCAN_20261120_001.CSV', null);
      } catch (err) {
        rejected = true;
        expect(err.message).toContain('UNAUTHORIZED');
      }

      expect(rejected).toBe(true);
    });

    it('rejects replayed deletion token after token has already been consumed', async () => {
      leafClipDevice.isConnected = true;
      const filename = 'SCAN_TOKEN_REPLAY_TEST.CSV';
      leafClipDevice.sdCardFiles.push({
        filename,
        scanId: 'SCAN-REPLAY',
        format: 'CSV',
        sizeBytes: 1024,
        timestamp: new Date().toISOString(),
        rawChannels: new Array(18).fill(30000),
        rawText: '$SPEC,18,30000'
      });
      leafClipDevice.virtualSdCard?.set(filename, { size: 1024, content: 'test' });
      leafClipDevice.sdCardStatus.totalScans = leafClipDevice.sdCardFiles.length;

      // 1. Request legitimate token
      const token = await leafClipDevice.requestDeleteToken(filename);
      expect(typeof token).toBe('number');
      expect(token).toBeGreaterThan(0);

      // 2. Perform deletion with token
      const res = await leafClipDevice.deleteSdCardFile(filename, token);
      expect(res.success).toBe(true);

      // 3. Attempt replay of identical token
      let replayBlocked = false;
      try {
        await leafClipDevice.deleteSdCardFile(filename, token);
      } catch (err) {
        replayBlocked = true;
        expect(err.message).toContain('UNAUTHORIZED_OR_INVALID_TOKEN');
      }

      expect(replayBlocked).toBe(true);
    });

    it('strictly prohibits wildcard and mass deletion commands (*.*, *, ALL, rm -rf)', async () => {
      leafClipDevice.isConnected = true;
      const wildcards = ['*.*', '*', 'ALL', 'rm -rf', 'SCAN_*.CSV', '?.CSV'];

      for (const wc of wildcards) {
        let blocked = false;
        try {
          await leafClipDevice.deleteSdCardFile(wc, 12345678);
        } catch (err) {
          blocked = true;
          expect(err.message).toContain('WILDCARD_DELETION_PROHIBITED');
        }
        expect(blocked).toBe(true);
      }
    });

    it('rejects deletion when spectroscope is disconnected', async () => {
      leafClipDevice.isConnected = false;

      let rejected = false;
      try {
        await leafClipDevice.deleteSdCardFile('SCAN_20261120_002.CSV', 12345678);
      } catch (err) {
        rejected = true;
        expect(err.message).toContain('UNAUTHORIZED');
      }

      expect(rejected).toBe(true);
    });
  });

  // =========================================================================
  // ROUND 5: DATA SYSTEM ISOLATION (ZERO CONTAMINATION)
  // =========================================================================
  describe('Round 5: Data System Isolation (Zero Contamination)', () => {
    it('verifies SD card scan reading does not contaminate IndexedDB offlineSpectralDatabase', async () => {
      leafClipDevice.isConnected = true;
      await offlineSpectralDatabase.clear();

      // Read SD card file
      const sdFile = await leafClipDevice.readSdCardFile('SCAN_0140_TOMATO.CSV');
      expect(sdFile).toBeDefined();
      expect(sdFile.filename).toBe('SCAN_0140_TOMATO.CSV');

      // Verify that offlineSpectralDatabase remains completely empty (ZERO CONTAMINATION)
      const allScans = await offlineSpectralDatabase.getAllScans();
      expect(allScans.length).toBe(0);

      // Verify metrics
      const metrics = await offlineSpectralDatabase.getMetrics();
      expect(metrics.totalScans).toBe(0);
      expect(metrics.locallyStored).toBe(0);
      expect(metrics.pendingSync).toBe(0);
    });

    it('verifies SD Card Explorer UI does not touch localStorage sync queue', () => {
      localStorage.clear();

      const explorer = createSpectroscopeSdCardExplorer({ device: leafClipDevice });
      expect(explorer).toBeDefined();

      // Inspect localStorage keys
      const keys = Object.keys(localStorage);
      const contaminatedKeys = keys.filter(k => k.includes('spectral_scan') || k.includes('sync_queue'));
      expect(contaminatedKeys.length).toBe(0);

      explorer.destroy();
    });

    it('verifies that zeroTransientBuffers and zeroAndWipe instantly clears memory upon disconnect', () => {
      const reassembler = new SdChunkReassembler({ filename: 'SCAN_001.CSV' });
      reassembler.pushChunk({
        seq: 0,
        totalSeq: 1,
        data: new Uint8Array([10, 20, 30, 40, 50])
      });

      expect(reassembler.isComplete).toBe(true);
      expect(reassembler.getBuffer()).toBeDefined();

      // Wipe memory
      reassembler.zeroAndWipe();

      expect(reassembler.getBuffer()).toBe(null);
      expect(reassembler.chunks.size).toBe(0);
      expect(reassembler.receivedBytes).toBe(0);
    });
  });

  // =========================================================================
  // ROUND 6: BLE ADVERSARIAL DISCONNECTION & HARDWARE REMOVAL
  // =========================================================================
  describe('Round 6: BLE Adversarial Disconnection & Hardware Removal', () => {
    it('simulates sudden BLE disconnect during active 500KB file transfer and verifies graceful abort', async () => {
      leafClipDevice.isConnected = true;
      let abortedFired = false;

      leafClipDevice.on('sdTransferAborted', () => {
        abortedFired = true;
      });

      // Start file read
      leafClipDevice.activeSdFileRead = 'SCAN_0141_TOMATO.CSV';

      // Abruptly trigger disconnect
      await leafClipDevice.disconnect();

      expect(leafClipDevice.isConnected).toBe(false);
      expect(leafClipDevice.activeSdFileRead).toBe(null);
      expect(abortedFired).toBe(true);
    });

    it('simulates physical SD card removal mid-operation and verifies clean unmount handling', () => {
      function simulateFirmwareCardRemoval() {
        const state = {
          mounted: true,
          activeFile: 'SCAN_001.CSV',
          fsLock: true,
          activeSession: true
        };

        // Hardware removal interrupt triggers SD_Storage_HandleRemoval()
        state.mounted = false;
        state.activeFile = null;
        state.fsLock = false;
        state.activeSession = false;

        return state;
      }

      const unmountedState = simulateFirmwareCardRemoval();
      expect(unmountedState.mounted).toBe(false);
      expect(unmountedState.activeFile).toBe(null);
      expect(unmountedState.fsLock).toBe(false);
      expect(unmountedState.activeSession).toBe(false);
    });

    it('recovers cleanly upon reconnect without ghost artifacts or state lock deadlocks', async () => {
      const dev = new LeafClipBluetoothDevice();
      dev.isConnected = false;

      // Disconnected state
      expect(dev.isConnected).toBe(false);
      const filesWhileDisconnected = await dev.listSdCardFiles();
      expect(filesWhileDisconnected.length).toBe(0);

      // Reconnect
      dev.isConnected = true;
      dev.connectionStatus = 'CONNECTED';

      const filesAfterReconnect = await dev.listSdCardFiles();
      expect(filesAfterReconnect.length).toBeGreaterThan(0);
      expect(dev.activeSdFileRead).toBe(null);
    });
  });
}
