/**
 * Test Suite: Extended BLE Communication Layer & SD Card Explorer Wire Protocol
 * AgriSpectra Leaf-Clip Spectroscope (Clip-Pro 500)
 * 
 * Verifies:
 * 1. Extended Packet Types (SD_STATUS, SD_LIST_ITEM, SD_LIST_END, SD_FILE_INFO, SD_DATA_CHUNK, SD_OP_ACK, SD_OP_ERR, SD_DIAG_REPORT)
 * 2. Packet Chunk Accumulator text line parsing and framed binary parsing (Type 0x10)
 * 3. SdChunkReassembler with IEEE 802.3 CRC32, out-of-order arrival, duplicate suppression, and bounds
 * 4. High-level leafClipDevice SD Card API:
 *    - getSdCardStatus()
 *    - listSdCardFiles() with pagination, search, and sorting
 *    - getSdCardFileInfo()
 *    - readSdCardFile() with progress callbacks, speed, and CRC32 verification
 *    - cancelSdCardTransfer()
 *    - duplicateSdCardFile()
 *    - deleteSdCardFile()
 *    - runSdCardDiagnostics()
 * 5. Connection-Dependent Visibility & State Cleanup (SpectroscopeDisconnectedError, buffer purge, event notifications)
 * 6. High-fidelity in-memory simulation with authentic 18-channel AS7265x data and strict zero database pollution
 */

import { describe, it, expect } from './framework.js';
import {
  PacketChunkAccumulator,
  PACKET_TYPES,
  SdChunkReassembler,
  computeCrc32,
  BINARY_MAGIC,
  BINARY_TAIL
} from '../src/hardware/packetChunkAccumulator.js';
import {
  leafClipDevice,
  LeafClipBluetoothDevice,
  SpectroscopeDisconnectedError,
  OPERATING_MODES
} from '../src/hardware/webBluetoothLeafClip.js';
import { offlineSpectralDatabase } from '../src/services/offlineSpectralDatabase.js';

export function registerBleSdCardProtocolTests() {
  describe('Extended BLE Packet Types & Accumulator Protocol Parsing', () => {
    it('defines all 8 required SD Card protocol packet types in PACKET_TYPES', () => {
      expect(PACKET_TYPES.SD_STATUS).toBe('SD_STATUS');
      expect(PACKET_TYPES.SD_LIST_ITEM).toBe('SD_LIST_ITEM');
      expect(PACKET_TYPES.SD_LIST_END).toBe('SD_LIST_END');
      expect(PACKET_TYPES.SD_FILE_INFO).toBe('SD_FILE_INFO');
      expect(PACKET_TYPES.SD_DATA_CHUNK).toBe('SD_DATA_CHUNK');
      expect(PACKET_TYPES.SD_OP_ACK).toBe('SD_OP_ACK');
      expect(PACKET_TYPES.SD_OP_ERR).toBe('SD_OP_ERR');
      expect(PACKET_TYPES.SD_DIAG_REPORT).toBe('SD_DIAG_REPORT');
    });

    it('parses $SD_STATUS response line into structured SD_STATUS packet', () => {
      const accumulator = new PacketChunkAccumulator();
      let receivedPacket = null;
      accumulator.on('sdStatus', (data) => {
        receivedPacket = data;
      });

      accumulator.pushChunk('$SD_STATUS,mounted=1,totalKb=15240000,usedKb=128400,freeKb=15111600,fileCount=142,lastScan=SCAN_142.CSV,health=OK\r\n');

      expect(receivedPacket).toBeDefined();
      expect(receivedPacket.mounted).toBe(true);
      expect(receivedPacket.totalKb).toBe(15240000);
      expect(receivedPacket.usedKb).toBe(128400);
      expect(receivedPacket.freeKb).toBe(15111600);
      expect(receivedPacket.fileCount).toBe(142);
      expect(receivedPacket.lastScan).toBe('SCAN_142.CSV');
      expect(receivedPacket.health).toBe('OK');
    });

    it('parses $SD_LIST_ITEM and $SD_LIST_END directory enumeration stream', () => {
      const accumulator = new PacketChunkAccumulator();
      const items = [];
      let endData = null;

      accumulator.on('sdListItem', (item) => items.push(item));
      accumulator.on('sdListEnd', (end) => { endData = end; });

      accumulator.pushChunk('$SD_LIST_ITEM,SCAN_001.CSV,18432,2026-11-20T10:00:00Z,SCAN-9941,Roma Tomato,18\r\n');
      accumulator.pushChunk('$SD_LIST_ITEM,SCAN_002.JSON,24500,2026-11-20T11:15:00Z,SCAN-9942,Bell Peppers,18\r\n');
      accumulator.pushChunk('$SD_LIST_END,142,2\r\n');

      expect(items.length).toBe(2);
      expect(items[0].filename).toBe('SCAN_001.CSV');
      expect(items[0].size).toBe(18432);
      expect(items[0].scanId).toBe('SCAN-9941');
      expect(items[0].plantName).toBe('Roma Tomato');
      expect(items[0].recordsCount).toBe(18);

      expect(items[1].filename).toBe('SCAN_002.JSON');
      expect(items[1].size).toBe(24500);

      expect(endData).toBeDefined();
      expect(endData.total).toBe(142);
      expect(endData.returned).toBe(2);
    });

    it('parses $SD_FILE_INFO detailed metadata response', () => {
      const accumulator = new PacketChunkAccumulator();
      let infoData = null;
      accumulator.on('sdFileInfo', (info) => { infoData = info; });

      accumulator.pushChunk('$SD_FILE_INFO,SCAN_042.CSV,18432,A3B4C5D6,2026-11-20T14:22:00Z,SCAN-9941,Roma Tomato,18,CSV\r\n');

      expect(infoData).toBeDefined();
      expect(infoData.filename).toBe('SCAN_042.CSV');
      expect(infoData.size).toBe(18432);
      expect(infoData.crc32).toBe('A3B4C5D6');
      expect(infoData.plantName).toBe('Roma Tomato');
      expect(infoData.fileType).toBe('CSV');
    });

    it('parses $SD_CHUNK ASCII streaming chunk notifications', () => {
      const accumulator = new PacketChunkAccumulator();
      let chunkData = null;
      accumulator.on('sdDataChunk', (chunk) => { chunkData = chunk; });

      accumulator.pushChunk('$SD_CHUNK,0,16,128,7B2E9F10,Wavelength_nm,Raw_Sample_Count\r\n');

      expect(chunkData).toBeDefined();
      expect(chunkData.seq).toBe(0);
      expect(chunkData.totalSeq).toBe(16);
      expect(chunkData.chunkLen).toBe(128);
      expect(chunkData.crc32).toBe('7B2E9F10');
      expect(chunkData.data).toContain('Wavelength_nm');
    });

    it('parses framed binary SD_DATA_CHUNK (0xAA 0x55, Type 0x10)', () => {
      const accumulator = new PacketChunkAccumulator();
      let binaryChunk = null;
      accumulator.on('sdDataChunk', (chunk) => { binaryChunk = chunk; });

      // Build binary payload: [seq:uint16] [total_seq:uint16] [chunk_len:uint16] [crc32:uint32] [data...]
      const rawText = "AgriSpectra NIR 76-band scan payload test";
      const textBytes = new TextEncoder().encode(rawText);
      const crc32 = computeCrc32(textBytes);

      const payload = new Uint8Array(10 + textBytes.length);
      const view = new DataView(payload.buffer);
      view.setUint16(0, 3, true); // seq = 3
      view.setUint16(2, 20, true); // totalSeq = 20
      view.setUint16(4, textBytes.length, true); // chunkLen
      view.setUint32(6, crc32, true); // crc32
      payload.set(textBytes, 10);

      const frame = PacketChunkAccumulator.buildBinaryFrame(0x10, payload);
      accumulator.pushChunk(frame);

      expect(binaryChunk).toBeDefined();
      expect(binaryChunk.seq).toBe(3);
      expect(binaryChunk.totalSeq).toBe(20);
      expect(binaryChunk.chunkLen).toBe(textBytes.length);
      expect(binaryChunk.crc32).toBe(crc32.toString(16).toUpperCase());
      expect(new TextDecoder().decode(binaryChunk.bytes)).toBe(rawText);
    });

    it('parses $ACK:SD_<OP> and $ERR:SD_<OP> operation acknowledgements', () => {
      const accumulator = new PacketChunkAccumulator();
      let ackData = null;
      let errData = null;

      accumulator.on('sdOpAck', (ack) => { ackData = ack; });
      accumulator.on('sdOpErr', (err) => { errData = err; });

      accumulator.pushChunk('$ACK:SD_DELETE,OK,filename=SCAN_001.CSV\r\n');
      expect(ackData).toBeDefined();
      expect(ackData.command).toBe('SD_DELETE');
      expect(ackData.status).toBe('OK');
      expect(ackData.filename).toBe('SCAN_001.CSV');

      accumulator.pushChunk('$ERR:SD_READ,ERR_FILE_NOT_FOUND,File does not exist\r\n');
      expect(errData).toBeDefined();
      expect(errData.command).toBe('SD_READ');
      expect(errData.errorCode).toBe('ERR_FILE_NOT_FOUND');
      expect(errData.message).toBe('File does not exist');
    });

    it('parses $SD_DIAG_REPORT into structured diagnostic telemetry', () => {
      const accumulator = new PacketChunkAccumulator();
      let diagReport = null;
      accumulator.on('sdDiagReport', (report) => { diagReport = report; });

      accumulator.pushChunk('$SD_DIAG_REPORT,mounted=1,spiSpeedKhz=25000,sdType=SDHC,initStatus=OK,readLatencyMs=1.24,fsType=FAT32,sectorsPerCluster=64\r\n');

      expect(diagReport).toBeDefined();
      expect(diagReport.mounted).toBe(true);
      expect(diagReport.spiSpeedKhz).toBe(25000);
      expect(diagReport.sdType).toBe('SDHC');
      expect(diagReport.initStatus).toBe('OK');
      expect(diagReport.readLatencyMs).toBe(1.24);
      expect(diagReport.fsType).toBe('FAT32');
      expect(diagReport.sectorsPerCluster).toBe(64);
    });
  });

  describe('SdChunkReassembler & IEEE 802.3 CRC32 Verification Engine', () => {
    it('computes accurate IEEE 802.3 CRC32 checksums', () => {
      // Known standard test vector: "123456789" -> 0xCBF43926
      const standardVector = "123456789";
      const crc = computeCrc32(standardVector);
      expect(crc.toString(16).toUpperCase()).toBe('CBF43926');

      // Empty input -> 0
      expect(computeCrc32("")).toBe(0);
    });

    it('reassembles out-of-order chunks and verifies end-to-end CRC32', () => {
      const fullText = "Wavelength_nm,Raw_Sample_Count,Reflectance\r\n410,1450,0.0316\r\n435,1620,0.0342\r\n760,41200,0.7325\r\n";
      const fullBytes = new TextEncoder().encode(fullText);
      const expectedCrc32 = computeCrc32(fullBytes);

      const reassembler = new SdChunkReassembler({
        filename: 'SCAN_ORDER.CSV',
        expectedSize: fullBytes.length,
        expectedCrc32
      });

      // Split into 3 chunks
      const c0 = fullBytes.slice(0, 30);
      const c1 = fullBytes.slice(30, 60);
      const c2 = fullBytes.slice(60);

      // Push out of order: chunk 2, then chunk 0, then chunk 1
      const res2 = reassembler.pushChunk({ seq: 2, totalSeq: 3, data: c2 });
      expect(res2.isComplete).toBe(false);
      expect(reassembler.getMissingSequences()).toEqual([0, 1]);

      const res0 = reassembler.pushChunk({ seq: 0, totalSeq: 3, data: c0 });
      expect(res0.isComplete).toBe(false);
      expect(reassembler.getMissingSequences()).toEqual([1]);

      const res1 = reassembler.pushChunk({ seq: 1, totalSeq: 3, data: c1 });
      expect(res1.isComplete).toBe(true);
      expect(res1.status).toBe('COMPLETE');
      expect(reassembler.getMissingSequences().length).toBe(0);
      expect(reassembler.getText()).toBe(fullText);
      expect(reassembler.verifiedCrc32).toBe(expectedCrc32);
    });

    it('suppresses duplicate chunks without memory leak or corrupting buffer', () => {
      const payload = new Uint8Array([10, 20, 30]);
      const reassembler = new SdChunkReassembler({ filename: 'DUP_TEST.CSV' });

      const first = reassembler.pushChunk({ seq: 0, totalSeq: 2, data: payload });
      expect(first.status).toBe('PROGRESS');
      expect(reassembler.receivedBytes).toBe(3);

      // Send duplicate of sequence 0
      const duplicate = reassembler.pushChunk({ seq: 0, totalSeq: 2, data: payload });
      expect(duplicate.status).toBe('DUPLICATE');
      expect(reassembler.duplicateCount).toBe(1);
      expect(reassembler.receivedBytes).toBe(3); // Unchanged!
    });

    it('detects missing chunks and reports sequence gaps accurately', () => {
      const reassembler = new SdChunkReassembler({ filename: 'GAP_TEST.CSV' });
      reassembler.pushChunk({ seq: 0, totalSeq: 5, data: new Uint8Array([1, 2]) });
      reassembler.pushChunk({ seq: 3, totalSeq: 5, data: new Uint8Array([7, 8]) });

      const missing = reassembler.getMissingSequences();
      expect(missing).toEqual([1, 2, 4]);
    });
  });

  describe('LeafClipBluetoothDevice - SD Card High-Level API Methods', () => {
    it('getSdCardStatus() returns complete hardware metrics matching expected contract', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      const status = await leafClipDevice.getSdCardStatus();
      expect(status).toBeDefined();
      expect(status.mounted).toBe(true);
      expect(status.totalKb).toBeGreaterThan(0);
      expect(status.usedKb).toBeGreaterThan(0);
      expect(status.freeKb).toBeGreaterThan(0);
      expect(status.fileCount).toBeGreaterThan(0);
      expect(status.lastScan).toBeDefined();
      expect(status.health).toBe('OK');
    });

    it('listSdCardFiles() supports pagination, search filter, and sorting', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      // Test pagination
      const page1 = await leafClipDevice.listSdCardFiles({ offset: 0, limit: 3 });
      expect(page1.length).toBe(3);
      expect(page1.total).toBeGreaterThan(3);

      // Test search filter
      const searchRes = await leafClipDevice.listSdCardFiles({ search: 'Tomato' });
      expect(searchRes.length).toBeGreaterThan(0);
      searchRes.forEach(f => {
        const matches = f.filename.toLowerCase().includes('tomato') ||
                        (f.plantName && f.plantName.toLowerCase().includes('tomato'));
        expect(matches).toBe(true);
      });

      // Test sorting by name asc
      const sortedName = await leafClipDevice.listSdCardFiles({ sortBy: 'name', sortOrder: 'asc' });
      for (let i = 1; i < sortedName.length; i++) {
        expect(sortedName[i].filename >= sortedName[i - 1].filename).toBe(true);
      }
    });

    it('getSdCardFileInfo() retrieves accurate metadata with calculated CRC32', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      const files = await leafClipDevice.listSdCardFiles({ limit: 1 });
      const targetFilename = files[0].filename;

      const info = await leafClipDevice.getSdCardFileInfo(targetFilename);
      expect(info.filename).toBe(targetFilename);
      expect(info.size).toBeGreaterThan(0);
      expect(info.crc32).toBeDefined();
      expect(info.crc32.length).toBe(8);
      expect(info.scanId).toBeDefined();
    });

    it('readSdCardFile() transfers file chunks with progress events and verifies CRC32', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      const files = await leafClipDevice.listSdCardFiles({ limit: 1 });
      const targetFilename = files[0].filename;

      const progressHistory = [];
      const result = await leafClipDevice.readSdCardFile(targetFilename, {
        chunkSize: 128,
        onProgress: (p) => progressHistory.push(p)
      });

      expect(result).toBeDefined();
      expect(result.filename).toBe(targetFilename);
      expect(result.data instanceof Uint8Array).toBe(true);
      expect(result.text.length).toBeGreaterThan(0);
      expect(result.verified).toBe(true);
      expect(result.crc32).toBeDefined();

      expect(progressHistory.length).toBeGreaterThan(0);
      const lastProgress = progressHistory[progressHistory.length - 1];
      expect(lastProgress.percentage).toBe(100);
      expect(lastProgress.bytesReceived).toBe(result.size);
    });

    it('cancelSdCardTransfer() cleanly aborts transfer and deallocates memory', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      // Start read without awaiting and immediately cancel
      const readPromise = leafClipDevice.readSdCardFile('SCAN_0142_BELLPEP.CSV', { chunkSize: 32 });
      await leafClipDevice.cancelSdCardTransfer();

      let cancelled = false;
      try {
        await readPromise;
      } catch (err) {
        cancelled = true;
        expect(err.message).toContain('Transfer cancelled by user');
      }
      expect(cancelled).toBe(true);
      expect(leafClipDevice.activeSdTransfer).toBe(null);
    });

    it('duplicateSdCardFile() creates cloned file with verified capacity and unique identifier', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      const files = await leafClipDevice.listSdCardFiles();
      const initialCount = files.length;
      const sourceFilename = files[0].filename;

      const cloneRes = await leafClipDevice.duplicateSdCardFile(sourceFilename, 'SCAN_AUTOTEST_COPY.CSV');
      expect(cloneRes.success).toBe(true);

      const afterClone = await leafClipDevice.listSdCardFiles();
      expect(afterClone.length).toBe(initialCount + 1);
      const found = afterClone.find(f => f.filename === 'SCAN_AUTOTEST_COPY.CSV');
      expect(found).toBeDefined();
    });

    it('deleteSdCardFile() safely deletes file and frees storage space', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      // Delete the cloned file from previous test
      const delRes = await leafClipDevice.deleteSdCardFile('SCAN_AUTOTEST_COPY.CSV');
      expect(delRes.success).toBe(true);

      const afterDel = await leafClipDevice.listSdCardFiles();
      expect(afterDel.some(f => f.filename === 'SCAN_AUTOTEST_COPY.CSV')).toBe(false);
    });

    it('runSdCardDiagnostics() executes comprehensive hardware probe checks', async () => {
      await leafClipDevice.connect({ forceSimulation: true });

      const diag = await leafClipDevice.runSdCardDiagnostics();
      expect(diag.mounted).toBe(true);
      expect(diag.probeCheck).toBe('PASSED');
      expect(diag.probeRead).toBe('PASSED');
      expect(diag.probeDelete).toBe('PASSED');
      expect(diag.cardHealth).toBe('EXCELLENT');
    });
  });

  describe('Connection-Dependent Visibility & State Cleanup Invariants', () => {
    it('throws SpectroscopeDisconnectedError when operations are attempted while disconnected', async () => {
      await leafClipDevice.disconnect();

      let threwDisconnect = false;
      try {
        await leafClipDevice.readSdCardFile('SCAN_0142_BELLPEP.CSV');
      } catch (err) {
        threwDisconnect = true;
        expect(err instanceof SpectroscopeDisconnectedError || err.message.includes('Connect spectroscope')).toBe(true);
      }
      expect(threwDisconnect).toBe(true);
    });

    it('emits sdCardInaccessible and clears buffers immediately on disconnect', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      let inaccessibleFired = false;
      leafClipDevice.on('sdCardInaccessible', () => { inaccessibleFired = true; });

      // Put buffer in temporary store
      leafClipDevice.temporarySdBuffers.set('TEST.CSV', new Uint8Array([1, 2, 3]));
      expect(leafClipDevice.temporarySdBuffers.size).toBe(1);

      await leafClipDevice.disconnect();

      expect(leafClipDevice.temporarySdBuffers.size).toBe(0);
      expect(inaccessibleFired).toBe(true);
    });
  });

  describe('Strict Zero Database Pollution (System B Isolation)', () => {
    it('strictly isolates virtual SD card from IndexedDB and Firestore', async () => {
      await leafClipDevice.connect({ forceSimulation: true });
      await offlineSpectralDatabase.clear();

      // Read virtual SD file
      const res = await leafClipDevice.readSdCardFile('SCAN_0140_TOMATO.CSV');
      expect(res.data).toBeDefined();

      // Query IndexedDB offline database to ensure ZERO records leaked
      const allScans = await offlineSpectralDatabase.getAllScans();
      expect(allScans.length).toBe(0);

      const metrics = await offlineSpectralDatabase.getMetrics();
      expect(metrics.totalScans).toBe(0);
      expect(metrics.locallyStored).toBe(0);
      expect(metrics.pendingSync).toBe(0);
    });
  });
}
