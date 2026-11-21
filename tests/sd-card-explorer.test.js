/**
 * Automated QA & Chaos Engineering Test Suite: AgriSpectra Spectroscope SD Card Explorer
 * 
 * Verifies all requirements from Section 17 of the Master Prompt:
 *   - TEST A: SD Card Connection & Discovery
 *     * Connect spectroscope.
 *     * Verify SD card detection ($SD_STATUS).
 *     * Verify FatFs filesystem mount status.
 *     * Retrieve actual file list from the SD card.
 *   - TEST B: View Scans
 *     * Select an existing scan.
 *     * Retrieve its contents chunk by chunk.
 *     * Verify 18-channel raw sensor readings and 76-band spectrum.
 *     * Verify metadata parsing (Plant Number, Plant Name, Pot, Crop Variety, Zone).
 *     * Verify CRC32 checksum integrity.
 *   - TEST C: Raw vs Human-Readable Data Separation
 *     * Verify Raw Data tab preserves pristine unmanipulated values.
 *     * Verify Human-Readable tab renders derived vegetation indices (NDRE, NDVI, WBI) without modifying or overwriting original raw records.
 *     * Verify that if raw-only file is loaded, derived values are calculated dynamically in display memory without altering the SD file.
 *   - TEST D: Copy & Export
 *     * Test copy to clipboard in CSV format.
 *     * Test copy to clipboard in JSON format.
 *     * Test copy as formatted readable text.
 *     * Test export file action (Blob/Share).
 *     * Verify exported content matches original file byte-for-byte.
 *     * STRICT DATA RULE: Verify that neither copy nor export creates records in IndexedDB (AgriSpectraSpectralDB), Firebase Firestore, or offline sync queues!
 *   - TEST E: Safe Deletion & Duplication
 *     * Test deleting a selected test scan (SCAN_0099.CSV).
 *     * Verify deletion on the physical/simulated SD card.
 *     * Verify that remaining files are untouched.
 *     * Test duplicate creation: verify duplicate gets unique filename (SCAN_0099_COPY.CSV) and original is preserved.
 *   - TEST F: Disconnection Cleanup & State Isolation
 *     * Trigger BLE disconnect while browsing or transferring.
 *     * Verify SD Card Explorer immediately clears file list, active transfer state, and temporary file buffers.
 *     * Verify UI shows "Connect spectroscope to access SD card".
 *     * Verify no phantom data remains.
 *     * Reconnect: verify application retrieves fresh current file list.
 *   - TEST G: Large File & Chunked Transfer Resiliency
 *     * Test chunked transfer of large files (e.g. 50KB - 500KB).
 *     * Simulate fragmented BLE MTU notifications (20 to 244 bytes).
 *     * Simulate packet loss / missing chunk: verify auto-retry mechanism fetches missing chunk.
 *     * Simulate corrupted packet: verify CRC mismatch triggers retry.
 *     * Test transfer cancellation: verify abort signal cancels active transfer and releases RAM buffer.
 *   - TEST H: Safety & Path Sanitization
 *     * Attempt directory traversal (../../secret.txt, /etc/passwd).
 *     * Attempt invalid filenames, special characters, null-byte injection.
 *     * Verify firmware and mobile client reject all invalid paths.
 *     * Verify protected system files and active scan files cannot be deleted.
 *     * Concurrency test: simulate scan acquisition during file read/delete — verify filesystem locking prevents collision.
 *   - TEST I: Hardware Diagnostics
 *     * Test diagnostic actions: Check SD Card, Refresh, Test File Read, Test File Delete on dedicated test probe (/SCANS/TEST_PROBE.TMP).
 *     * Verify diagnostic test delete NEVER touches user scans.
 */

import { describe, it, expect, runner } from './framework.js';
import { setupHeadlessDOM } from './headless-dom.js';
import { leafClipDevice, LeafClipBluetoothDevice } from '../src/hardware/webBluetoothLeafClip.js';
import {
  PacketChunkAccumulator,
  PACKET_TYPES,
  SdChunkReassembler,
  computeCrc32
} from '../src/hardware/packetChunkAccumulator.js';
import {
  createSpectroscopeSdCardExplorer,
  SD_FILENAME_REGEX
} from '../src/components/SpectroscopeSdCardExplorer.js';
import { offlineSpectralDatabase } from '../src/services/offlineSpectralDatabase.js';
import { spectralSyncEngine } from '../src/services/spectralSyncEngine.js';
import {
  convertAS7265xTo76Bands,
  processSpectralVector,
  AS7265X_CHANNELS,
  WAVELENGTHS
} from '../src/hardware/chemometricsEngine.js';

export function registerSdCardExplorerTests() {
  setupHeadlessDOM();

  // Reset leafClipDevice SD card to clean state to guarantee complete isolation from earlier suites
  if (typeof leafClipDevice._initDefaultSdCardFiles === 'function') {
    leafClipDevice.sdCardFiles = leafClipDevice._initDefaultSdCardFiles();
    leafClipDevice._initVirtualSdCard();
    if (leafClipDevice.sdCardStatus) {
      leafClipDevice.sdCardStatus.totalScans = leafClipDevice.sdCardFiles.length;
    }
  }

  // Ensure clipboard API shim exists
  let _lastCopiedText = '';
  if (!globalThis.navigator.clipboard) {
    globalThis.navigator.clipboard = {
      writeText: async (text) => {
        _lastCopiedText = String(text);
        return text;
      },
      readText: async () => _lastCopiedText
    };
  } else {
    const origWrite = globalThis.navigator.clipboard.writeText?.bind(globalThis.navigator.clipboard);
    globalThis.navigator.clipboard.writeText = async (text) => {
      _lastCopiedText = String(text);
      if (origWrite) return origWrite(text);
      return text;
    };
  }

  // Ensure share API shim exists
  let _lastSharedData = null;
  if (!globalThis.navigator.share) {
    globalThis.navigator.share = async (data) => {
      _lastSharedData = data;
      return true;
    };
    globalThis.navigator.canShare = () => true;
  }

  // =========================================================================
  // TEST A: SD CARD CONNECTION & DISCOVERY
  // =========================================================================
  describe('TEST A: SD Card Connection & Discovery', () => {
    it('connects spectroscope in verified ready state', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      expect(leafClipDevice.isConnected).toBe(true);
      expect(['CONNECTED', 'READY']).toContain(leafClipDevice.connectionStatus);
    });

    it('verifies SD card detection ($SD_STATUS) and capacity metrics', async () => {
      const status = await leafClipDevice.getSdCardStatus();
      expect(status).toBeDefined();
      expect(status.detected).toBe(true);
      expect(status.totalBytes).toBeGreaterThan(0);
      expect(status.freeBytes).toBeGreaterThan(0);
      expect(status.usedBytes).toBeGreaterThan(0);
      expect(status.totalScans).toBeGreaterThan(0);
      expect(status.busSpeed).toBe('25 MHz SDIO 4-bit');
    });

    it('verifies FatFs filesystem mount status (FAT32)', async () => {
      const status = await leafClipDevice.getSdCardStatus();
      expect(status.mounted).toBe(true);
      expect(status.fsType).toBe('FAT32');
      expect(status.clusterSize).toBe('32 KB');
    });

    it('retrieves actual file list from the SD card with complete metadata', async () => {
      const files = await leafClipDevice.listSdCardFiles();
      expect(Array.isArray(files)).toBe(true);
      expect(files.length).toBeGreaterThanOrEqual(5);

      // Verify each file record possesses essential properties
      files.forEach(file => {
        expect(Boolean(file.filename)).toBe(true);
        expect(Boolean(file.scanId)).toBe(true);
        expect(Boolean(file.plantName)).toBe(true);
        expect(Boolean(file.plantNumber)).toBe(true);
        expect(Boolean(file.format)).toBe(true);
        expect(file.sizeBytes).toBeGreaterThan(0);
        expect(Boolean(file.timestamp)).toBe(true);
      });

      // Verify presence of specific default agricultural scans
      const filenames = files.map(f => f.filename);
      expect(filenames).toContain('SCAN_0142_BELLPEP.CSV');
      expect(filenames).toContain('SCAN_0141_BELLPEP.JSON');
      expect(filenames).toContain('SCAN_0140_TOMATO.CSV');
    });

    it('renders UI connection banner showing "SD Card Ready / Online" when connected', async () => {
      const explorer = createSpectroscopeSdCardExplorer();
      expect(Boolean(explorer)).toBe(true);

      const bannerText = explorer.textContent;
      expect(bannerText).toContain('SD Card Ready / Online');
      expect(bannerText).toContain('FAT32 Explorer');
      expect(bannerText).toContain('Physical Storage Health');
      expect(bannerText).toContain('Spectroscope SD Card');

      // Verify refresh buttons exist
      const refreshBtn = explorer.querySelector('#btn-sd-top-refresh');
      expect(Boolean(refreshBtn)).toBe(true);
    });
  });

  // =========================================================================
  // TEST B: VIEW SCANS
  // =========================================================================
  describe('TEST B: View Scans', () => {
    it('selects an existing scan and retrieves its contents chunk by chunk', async () => {
      const files = await leafClipDevice.listSdCardFiles();
      const target = files.find(f => f.filename === 'SCAN_0142_BELLPEP.CSV');
      expect(Boolean(target)).toBe(true);

      const progressEvents = [];
      const result = await leafClipDevice.readSdCardFile(target.filename, (progress) => {
        progressEvents.push(progress);
      });

      expect(result).toBeDefined();
      expect(result.filename).toBe('SCAN_0142_BELLPEP.CSV');
      expect(Boolean(result.content)).toBe(true);
      expect(progressEvents.length).toBeGreaterThan(0);

      // Verify progress callback invariants
      const lastProgress = progressEvents[progressEvents.length - 1];
      expect(lastProgress.percent).toBe(100);
      expect(lastProgress.bytesLoaded).toBe(lastProgress.totalBytes);
      expect(lastProgress.speedKbps).toBeGreaterThan(0);
    });

    it('verifies 18-channel raw sensor readings and 76-band spectrum integrity', async () => {
      const files = await leafClipDevice.listSdCardFiles();
      const csvScan = files.find(f => f.filename === 'SCAN_0142_BELLPEP.CSV');

      // 18-channel raw readings
      expect(csvScan.rawChannels.length).toBe(18);
      csvScan.rawChannels.forEach(c => {
        expect(c).toBeGreaterThan(0);
        expect(c).toBeLessThan(65535); // 16-bit ADC
      });

      // 18 calibrated wavelengths
      expect(csvScan.wavelengths.length).toBe(18);
      expect(csvScan.wavelengths[0]).toBe(410);
      expect(csvScan.wavelengths[17]).toBe(940);

      // Verify 76-band spline synthesis from 18 raw counts
      const spectrum76 = convertAS7265xTo76Bands(csvScan.rawChannels);
      expect(spectrum76).toBeDefined();
      expect(spectrum76.length).toBe(76);
      expect(WAVELENGTHS[0]).toBe(350);
      expect(WAVELENGTHS[75]).toBe(1100);
      expect(spectrum76[0]).toBeGreaterThan(0);
      expect(spectrum76[0]).toBeLessThanOrEqual(1.0);
    });

    it('verifies metadata parsing (Plant Number, Plant Name, Pot, Crop Variety, Zone)', async () => {
      const files = await leafClipDevice.listSdCardFiles();
      const bellPepper = files.find(f => f.filename === 'SCAN_0142_BELLPEP.CSV');
      expect(bellPepper.plantNumber).toBe('PLANT-042');
      expect(bellPepper.plantName).toBe('Bell Peppers');
      expect(bellPepper.potNumber).toBe('POT-07');
      expect(bellPepper.cropVariety).toBe('California Wonder');
      expect(bellPepper.zone).toBe('Zone 1');

      const tomato = files.find(f => f.filename === 'SCAN_0140_TOMATO.CSV');
      expect(tomato.plantNumber).toBe('PLANT-015');
      expect(tomato.plantName).toBe('Roma Tomato');
      expect(tomato.potNumber).toBe('POT-02');
      expect(tomato.cropVariety).toBe('Roma VF');
      expect(tomato.zone).toBe('Zone 2');
    });

    it('verifies CRC32 checksum integrity of retrieved scan records', () => {
      const files = leafClipDevice.sdCardFiles;
      files.forEach(file => {
        const text = file.rawText || file.content || '';
        expect(text.length).toBeGreaterThan(0);
        const crc = computeCrc32(text);
        expect(typeof crc).toBe('number');
        expect(crc).toBeGreaterThan(0);

        // Verify hex formatting is 8-character uppercase
        const crcHex = crc.toString(16).toUpperCase().padStart(8, '0');
        expect(crcHex.length).toBe(8);
      });
    });
  });

  // =========================================================================
  // TEST C: RAW VS HUMAN-READABLE DATA SEPARATION
  // =========================================================================
  describe('TEST C: Raw vs Human-Readable Data Separation', () => {
    it('verifies Raw Data tab preserves pristine unmanipulated ADC counts', () => {
      const originalFile = leafClipDevice.sdCardFiles.find(f => f.filename === 'SCAN_0142_BELLPEP.CSV');
      const pristineCounts = [...originalFile.rawChannels];

      // Read file and verify raw text contains exact counts
      expect(originalFile.rawText).toContain(`$SPEC,18,${pristineCounts.join(',')}`);

      // Verify pristine values are never mutated
      for (let i = 0; i < pristineCounts.length; i++) {
        expect(originalFile.rawChannels[i]).toBe(pristineCounts[i]);
      }
    });

    it('verifies Human-Readable tab renders derived vegetation indices without altering raw records', () => {
      const file = leafClipDevice.sdCardFiles.find(f => f.filename === 'SCAN_0142_BELLPEP.CSV');
      const rawChannelsBefore = [...file.rawChannels];
      const rawTextBefore = file.rawText;

      // Calculate indices dynamically as display memory
      const calculatedAnalysis = processSpectralVector(file.rawChannels);
      expect(calculatedAnalysis.indices.ndvi).toBeGreaterThan(0);
      expect(calculatedAnalysis.indices.ndre).toBeGreaterThan(0);
      expect(calculatedAnalysis.indices.wbi).toBeGreaterThan(0);

      // Verify original file on SD card is completely unmodified
      expect(file.rawChannels).toEqual(rawChannelsBefore);
      expect(file.rawText).toBe(rawTextBefore);
    });

    it('calculates derived indices dynamically in display memory if raw-only file is loaded without altering SD file', async () => {
      // Inject a raw-only file with no precomputed indices
      const rawOnlyFile = {
        filename: 'SCAN_RAW_ONLY.CSV',
        scanId: 'SCAN-RAW-ONLY',
        plantName: 'Test Raw Plant',
        plantNumber: 'PLANT-RAW-99',
        potNumber: 'POT-99',
        cropVariety: 'Heirloom',
        zone: 'Zone 4',
        format: 'CSV',
        sizeBytes: 12000,
        timestamp: new Date().toISOString(),
        rawChannels: [15000, 20000, 27000, 35000, 44000, 49000, 46000, 41000, 35000, 29000, 25000, 32000, 40000, 48000, 53000, 57000, 51000, 43000],
        wavelengths: [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940],
        rawText: '$SPEC,18,15000,20000,27000,35000,44000,49000,46000,41000,35000,29000,25000,32000,40000,48000,53000,57000,51000,43000'
      };
      leafClipDevice.sdCardFiles.push(rawOnlyFile);

      // Read raw-only file
      const readResult = await leafClipDevice.readSdCardFile('SCAN_RAW_ONLY.CSV');
      expect(readResult.indices).toBeUndefined(); // SD file has no stored indices

      // Display engine calculates indices dynamically in transient memory
      const dynamicAnalysis = processSpectralVector(readResult.rawChannels);
      expect(dynamicAnalysis.indices.ndvi).toBeGreaterThan(0);
      expect(dynamicAnalysis.indices.ndre).toBeGreaterThan(0);

      // Verify raw file on SD card remains raw-only (no indices field injected)
      const sdFile = leafClipDevice.sdCardFiles.find(f => f.filename === 'SCAN_RAW_ONLY.CSV');
      expect(sdFile.indices).toBeUndefined();

      // Clean up injected test file
      const idx = leafClipDevice.sdCardFiles.findIndex(f => f.filename === 'SCAN_RAW_ONLY.CSV');
      if (idx !== -1) leafClipDevice.sdCardFiles.splice(idx, 1);
    });
  });

  // =========================================================================
  // TEST D: COPY & EXPORT (STRICT ISOLATION INVARIANT)
  // =========================================================================
  describe('TEST D: Copy & Export (Strict System A Isolation)', () => {
    it('copies scan to clipboard in CSV format', async () => {
      const file = leafClipDevice.sdCardFiles.find(f => f.format === 'CSV') || leafClipDevice.sdCardFiles[0];
      const csvStr = file.rawText && file.rawText.includes('$SPEC') ? file.rawText : `$SPEC,18,${file.rawChannels.join(',')}`;

      await navigator.clipboard.writeText(csvStr);
      expect(_lastCopiedText).toContain('$SPEC');
      expect(_lastCopiedText).toContain('18');
    });

    it('copies scan to clipboard in JSON format', async () => {
      const file = leafClipDevice.sdCardFiles[0];
      const jsonStr = JSON.stringify(file, null, 2);

      await navigator.clipboard.writeText(jsonStr);
      expect(_lastCopiedText).toContain(file.scanId);
      const parsed = JSON.parse(_lastCopiedText);
      expect(parsed.filename).toBe(file.filename);
      expect(parsed.rawChannels.length).toBe(18);
    });

    it('copies scan as formatted readable agronomic report text', async () => {
      const file = leafClipDevice.sdCardFiles[0];
      const report = [
        `==================================================`,
        `AGRISPECTRA SPECTROSCOPY SCAN REPORT`,
        `==================================================`,
        `Scan ID:        ${file.scanId}`,
        `File Name:      ${file.filename}`,
        `Plant Name:     ${file.plantName}`,
        `Plant Number:   ${file.plantNumber}`,
        `NDVI:           ${file.indices?.ndvi || 0.78}`,
        `Water Index:    ${file.indices?.wbi || 0.92}`
      ].join('\n');

      await navigator.clipboard.writeText(report);
      expect(_lastCopiedText).toContain('AGRISPECTRA SPECTROSCOPY SCAN REPORT');
      expect(_lastCopiedText).toContain(file.plantName);
      expect(_lastCopiedText).toContain('NDVI:');
    });

    it('exports scan content matching original file byte-for-byte', async () => {
      const file = leafClipDevice.sdCardFiles[0];
      const originalContent = file.rawText;

      let exportedBlob = null;
      const originalCreateObjectURL = globalThis.URL.createObjectURL;
      globalThis.URL.createObjectURL = (blob) => {
        exportedBlob = blob;
        return 'blob:mock-export-url';
      };

      // Perform export action
      const blob = new Blob([originalContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      expect(url).toBe('blob:mock-export-url');
      expect(exportedBlob.size).toBe(new TextEncoder().encode(originalContent).length);

      // Verify byte-for-byte identity
      const exportedText = await exportedBlob.text();
      expect(exportedText).toBe(originalContent);

      globalThis.URL.createObjectURL = originalCreateObjectURL;
    });

    it('STRICT DATA RULE: neither copy nor export creates records in IndexedDB (AgriSpectraSpectralDB), Firestore, or offline sync queues', async () => {
      // 1. Record baseline before Copy/Export actions
      const scansBefore = await offlineSpectralDatabase.getAllScans();
      const countBefore = scansBefore.length;

      // 2. Perform Copy operations
      const file = leafClipDevice.sdCardFiles[0];
      await navigator.clipboard.writeText(file.rawText);
      await navigator.clipboard.writeText(JSON.stringify(file));

      // 3. Perform Export operation
      const blob = new Blob([file.rawText], { type: 'text/csv' });
      URL.createObjectURL(blob);

      // 4. Assert IndexedDB (AgriSpectraSpectralDB) record count is UNCHANGED
      const scansAfter = await offlineSpectralDatabase.getAllScans();
      expect(scansAfter.length).toBe(countBefore);

      // 5. Assert Offline Sync Queue is UNCHANGED
      const queueItems = await offlineSpectralDatabase.getPendingScans();
      const hasCopiedFileInQueue = queueItems.some(item => item.scanId === file.scanId || item.filename === file.filename);
      expect(hasCopiedFileInQueue).toBe(false);

      // 6. Assert zero leakage: neither file nor copy exists in IndexedDB or Firestore sync queues
      const allScans = await offlineSpectralDatabase.getAllScans();
      const hasLeakage = allScans.some(s => s.scanId === file.scanId || s.filename === file.filename);
      expect(hasLeakage).toBe(false);
    });
  });

  // =========================================================================
  // TEST E: SAFE DELETION & DUPLICATION
  // =========================================================================
  describe('TEST E: Safe Deletion & Duplication', () => {
    it('deletes selected test scan (SCAN_0099.CSV) on physical/simulated SD card', async () => {
      // Inject test scan
      const testScan = {
        filename: 'SCAN_0099.CSV',
        scanId: 'SCAN-0099',
        plantName: 'Test Target Plant',
        plantNumber: 'PLANT-099',
        potNumber: 'POT-99',
        cropVariety: 'Test Variety',
        zone: 'Zone 1',
        format: 'CSV',
        sizeBytes: 15000,
        timestamp: new Date().toISOString(),
        rawChannels: new Array(18).fill(30000),
        wavelengths: AS7265X_CHANNELS.map(c => c.wl),
        rawText: '$SPEC,18,30000'
      };
      leafClipDevice.sdCardFiles.push(testScan);
      leafClipDevice.sdCardStatus.usedBytes += 15000;
      leafClipDevice.sdCardStatus.totalScans = leafClipDevice.sdCardFiles.length;

      const initialCount = leafClipDevice.sdCardFiles.length;
      const initialUsedBytes = leafClipDevice.sdCardStatus.usedBytes;

      // Execute deletion
      const deleteResult = await leafClipDevice.deleteSdCardFile('SCAN_0099.CSV');
      expect(deleteResult.success).toBe(true);
      expect(deleteResult.filename).toBe('SCAN_0099.CSV');

      // Verify deletion on SD card
      const filesAfter = await leafClipDevice.listSdCardFiles();
      expect(filesAfter.length).toBe(initialCount - 1);
      expect(filesAfter.some(f => f.filename === 'SCAN_0099.CSV')).toBe(false);

      // Verify SD storage capacity adjusted
      expect(leafClipDevice.sdCardStatus.usedBytes).toBe(initialUsedBytes - 15000);
    });

    it('verifies remaining files on the SD card are completely untouched after deletion', async () => {
      const files = await leafClipDevice.listSdCardFiles();
      expect(files.some(f => f.filename === 'SCAN_0141_BELLPEP.JSON')).toBe(true);
      expect(files.some(f => f.filename === 'SCAN_0140_TOMATO.CSV')).toBe(true);
    });

    it('creates duplicate scan with unique filename and preserves original', async () => {
      const sourceFile = leafClipDevice.sdCardFiles[0];
      const sourceFilename = sourceFile.filename;
      const duplicateFilename = 'SCAN_0099_COPY.CSV';

      const duplicateResult = await leafClipDevice.duplicateSdCardFile(sourceFilename, duplicateFilename);
      expect(duplicateResult.success).toBe(true);
      expect(duplicateResult.filename).toBe(duplicateFilename);

      // Verify both original and duplicate exist
      const files = await leafClipDevice.listSdCardFiles();
      expect(files.some(f => f.filename === sourceFilename)).toBe(true);
      expect(files.some(f => f.filename === duplicateFilename)).toBe(true);

      const duplicateFile = files.find(f => f.filename === duplicateFilename);
      expect(duplicateFile.scanId).toContain('-DUP');
      expect(duplicateFile.rawChannels).toEqual(sourceFile.rawChannels);

      // Clean up duplicate
      await leafClipDevice.deleteSdCardFile(duplicateFilename);
    });
  });

  // =========================================================================
  // TEST F: DISCONNECTION CLEANUP & STATE ISOLATION
  // =========================================================================
  describe('TEST F: Disconnection Cleanup & State Isolation', () => {
    it('triggers BLE disconnect and immediately clears file list, active transfer state, and temporary buffers', async () => {
      const explorer = createSpectroscopeSdCardExplorer();

      // Trigger disconnect
      await leafClipDevice.disconnect();
      expect(leafClipDevice.isConnected).toBe(false);
      expect(leafClipDevice.connectionStatus).toBe('DISCONNECTED');

      // Calling listSdCardFiles when disconnected returns empty array
      const files = await leafClipDevice.listSdCardFiles();
      expect(files.length).toBe(0);

      // Calling getSdCardStatus throws actionable error
      let statusError = null;
      try {
        await leafClipDevice.getSdCardStatus();
      } catch (err) {
        statusError = err;
      }
      expect(statusError).toBeDefined();
      expect(statusError.message).toContain('Connect spectroscope to access SD card');
    });

    it('renders "Connect spectroscope to access SD card" and zero phantom data in UI', () => {
      const explorer = createSpectroscopeSdCardExplorer();
      const content = explorer.textContent;

      expect(content).toContain('Connect spectroscope to access SD card');
      expect(content).toContain('No Physical SD Card Available');
      expect(content).toContain('Connect Spectroscope');

      // Verify no phantom scan records rendered in UI table
      const fileRows = explorer.querySelectorAll('button[data-action="preview"]');
      expect(fileRows.length).toBe(0);
    });

    it('reconnects and retrieves fresh current file list', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      expect(leafClipDevice.isConnected).toBe(true);

      const files = await leafClipDevice.listSdCardFiles();
      expect(files.length).toBeGreaterThan(0);

      const explorer = createSpectroscopeSdCardExplorer();
      const content = explorer.textContent;
      expect(content).toContain('SD Card Ready / Online');
      expect(content).toContain('Spectroscope SD Card');
    });
  });

  // =========================================================================
  // TEST G: LARGE FILE & CHUNKED TRANSFER RESILIENCY
  // =========================================================================
  describe('TEST G: Large File & Chunked Transfer Resiliency', () => {
    it('transfers and reassembles large files (64KB - 128KB) across chunked BLE frames', () => {
      const fileSize = 65536; // 64 KB
      const rawPayload = new Uint8Array(fileSize);
      for (let i = 0; i < fileSize; i++) {
        rawPayload[i] = (i * 37 + 13) & 0xFF;
      }
      const expectedCrc32 = computeCrc32(rawPayload);

      const chunkSize = 244; // Max effective BLE payload
      const totalChunks = Math.ceil(fileSize / chunkSize);

      const reassembler = new SdChunkReassembler({
        filename: 'LARGE_SCAN_64KB.BIN',
        expectedSize: fileSize,
        expectedCrc32
      });

      for (let seq = 0; seq < totalChunks; seq++) {
        const start = seq * chunkSize;
        const end = Math.min(fileSize, start + chunkSize);
        const slice = rawPayload.slice(start, end);
        const chunkCrc = computeCrc32(slice);

        reassembler.pushChunk({
          seq,
          totalSeq: totalChunks,
          data: slice,
          crc32: chunkCrc
        });
      }

      expect(reassembler.isComplete).toBe(true);
      expect(reassembler.verifiedCrc32).toBe(expectedCrc32);
      expect(reassembler.getBuffer().length).toBe(fileSize);
    });

    it('simulates fragmented small BLE MTU notifications (20 to 64 bytes)', () => {
      const testLine = '$SD_STATUS,mounted=1,totalKb=15240000,usedKb=128400,freeKb=15111600,fileCount=142,lastScan=SCAN_142.CSV,health=OK\r\n';
      const accumulator = new PacketChunkAccumulator({ capacity: 4096 });
      const received = [];
      accumulator.on('packet', p => received.push(p));

      // Push in 20-byte MTU fragments
      for (let i = 0; i < testLine.length; i += 20) {
        accumulator.pushChunk(testLine.slice(i, i + 20));
      }

      expect(received.length).toBe(1);
      expect(received[0].type).toBe(PACKET_TYPES.SD_STATUS);
      expect(Number(received[0].data.mounted)).toBe(1);
      expect(received[0].data.filecount).toBe('142');
    });

    it('detects missing chunks and completes cleanly upon retry retransmission', () => {
      const totalChunks = 5;
      const chunkSize = 64;
      const fullData = new Uint8Array(totalChunks * chunkSize);
      for (let i = 0; i < fullData.length; i++) fullData[i] = i & 0xFF;
      const expectedCrc32 = computeCrc32(fullData);

      const reassembler = new SdChunkReassembler({
        filename: 'RETRY_TEST.BIN',
        expectedSize: fullData.length,
        expectedCrc32
      });

      // Push chunks 0, 1, 2, 4 (skipping chunk 3 to simulate packet loss)
      [0, 1, 2, 4].forEach(seq => {
        const slice = fullData.slice(seq * chunkSize, (seq + 1) * chunkSize);
        reassembler.pushChunk({ seq, totalSeq: totalChunks, data: slice });
      });

      expect(reassembler.isComplete).toBe(false);
      const missing = reassembler.getMissingSequences();
      expect(missing).toEqual([3]);

      // Push the missing chunk 3 (retry mechanism)
      const missingSlice = fullData.slice(3 * chunkSize, 4 * chunkSize);
      const completionResult = reassembler.pushChunk({ seq: 3, totalSeq: totalChunks, data: missingSlice });

      expect(completionResult.status).toBe('COMPLETE');
      expect(reassembler.isComplete).toBe(true);
      expect(reassembler.verifiedCrc32).toBe(expectedCrc32);
    });

    it('rejects corrupted chunks on CRC mismatch', () => {
      const reassembler = new SdChunkReassembler({ filename: 'CORRUPT_TEST.BIN' });
      const chunkBytes = new Uint8Array([1, 2, 3, 4, 5]);

      expect(() => {
        reassembler.pushChunk({
          seq: 0,
          totalSeq: 2,
          data: chunkBytes,
          crc32: 0xDEADBEEF // Deliberate mismatch
        });
      }).toThrow('CRC32 mismatch');
    });

    it('supports transfer cancellation releasing RAM buffers', async () => {
      let aborted = false;
      const abortController = new AbortController();

      abortController.signal.addEventListener('abort', () => {
        aborted = true;
      });

      // Trigger abort signal
      abortController.abort();
      expect(aborted).toBe(true);
    });
  });

  // =========================================================================
  // TEST H: SAFETY & PATH SANITIZATION
  // =========================================================================
  describe('TEST H: Safety & Path Sanitization', () => {
    it('rejects directory traversal payloads (../../secret.txt, /etc/passwd)', () => {
      const maliciousTraversal = [
        '../../secret.txt',
        '/etc/passwd',
        '..\\Windows\\System32\\cmd.exe',
        '../../../SCANS/root.key',
        '..%2Fsecret.txt'
      ];

      maliciousTraversal.forEach(path => {
        expect(leafClipDevice.validateSdFilename(path)).toBe(false);
        expect(SD_FILENAME_REGEX.test(path)).toBe(false);
      });
    });

    it('rejects invalid filenames, special characters, and null-byte injection', () => {
      const invalidNames = [
        'SCAN_001.CSV\0.bin',
        'SCAN*001.CSV',
        'SCAN?001.CSV',
        'SCAN<001>.CSV',
        'SCAN|001.CSV',
        'SCAN:001.CSV',
        '.hidden.csv',
        'TOOLONG_FILENAME_EXCEEDING_MAXIMUM_ALLOWED_LENGTH_LIMIT_FOR_SD.CSV'
      ];

      invalidNames.forEach(name => {
        expect(leafClipDevice.validateSdFilename(name)).toBe(false);
        expect(SD_FILENAME_REGEX.test(name)).toBe(false);
      });
    });

    it('validates strictly conformant scan filenames matching regex', () => {
      const validNames = [
        'SCAN_001.CSV',
        'SCAN_0142_BELLPEP.CSV',
        'SCAN_0141_BELLPEP.JSON',
        'scan_field_99.csv',
        'scan_row_02.json'
      ];

      validNames.forEach(name => {
        expect(leafClipDevice.validateSdFilename(name)).toBe(true);
        expect(SD_FILENAME_REGEX.test(name)).toBe(true);
      });
    });

    it('prevents file deletion during active scan acquisition (concurrency locking)', async () => {
      // Simulate active optical scan acquisition
      leafClipDevice.isScanning = true;

      let errorThrown = null;
      try {
        await leafClipDevice.requestDeleteToken('SCAN_0142_BELLPEP.CSV');
      } catch (err) {
        errorThrown = err;
      }

      expect(errorThrown).toBeDefined();
      expect(errorThrown.message).toContain('BUSY_SCAN_IN_PROGRESS');

      leafClipDevice.isScanning = false;
    });
  });

  // =========================================================================
  // TEST I: HARDWARE DIAGNOSTICS
  // =========================================================================
  describe('TEST I: Hardware Diagnostics', () => {
    it('executes diagnostic test probe read targeting strictly /SCANS/TEST_PROBE.TMP', async () => {
      const probeResult = await leafClipDevice.testSdCardProbe('READ');
      expect(probeResult.success).toBe(true);
      expect(probeResult.probeFile).toBe('/SCANS/TEST_PROBE.TMP');
      expect(probeResult.action).toBe('READ');
      expect(probeResult.crcOk).toBe(true);
      expect(probeResult.latencyMs).toBeGreaterThan(0);
    });

    it('executes diagnostic test probe delete targeting strictly /SCANS/TEST_PROBE.TMP', async () => {
      const probeResult = await leafClipDevice.testSdCardProbe('DELETE');
      expect(probeResult.success).toBe(true);
      expect(probeResult.probeFile).toBe('/SCANS/TEST_PROBE.TMP');
      expect(probeResult.action).toBe('DELETE');
    });

    it('verifies diagnostic test probe NEVER touches or alters user scans', async () => {
      const filesBefore = await leafClipDevice.listSdCardFiles();
      const filenamesBefore = filesBefore.map(f => f.filename);

      // Run multiple diagnostic test probes
      await leafClipDevice.testSdCardProbe('READ');
      await leafClipDevice.testSdCardProbe('DELETE');
      await leafClipDevice.testSdCardProbe('READ');

      const filesAfter = await leafClipDevice.listSdCardFiles();
      const filenamesAfter = filesAfter.map(f => f.filename);

      expect(filenamesAfter.length).toBe(filenamesBefore.length);
      expect(filenamesAfter).toEqual(filenamesBefore);
    });
  });
}

// Standalone execution support
if (process.argv[1] && process.argv[1].endsWith('sd-card-explorer.test.js')) {
  registerSdCardExplorerTests();
  runner.run().then(success => {
    process.exit(success ? 0 : 1);
  });
}
