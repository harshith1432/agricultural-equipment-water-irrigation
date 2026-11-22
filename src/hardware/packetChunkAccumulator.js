/**
 * AgriSpectra Streaming Ring Buffer & Packet Chunk Accumulator
 * Reassembles fragmented BLE MTU notifications (20 to 512 bytes) and USB CDC Serial stream.
 * Supports:
 *   1. Delimited JSON lines (e.g. {"type":"SPECTRUM", ...}\n)
 *   2. Delimited ASCII commands ($SPEC,76,c0,c1...\r\n or $CALIB_DARK,OK\r\n)
 *   3. Framed Binary packets (0xAA 0x55 [len:uint16] [type:uint8] [payload] [crc:uint16] 0x0D 0x0A)
 */

export const PACKET_TYPES = {
  SPECTRUM: 'SPECTRUM',
  CALIB_DARK: 'CALIB_DARK',
  CALIB_WHITE: 'CALIB_WHITE',
  METADATA_ACK: 'METADATA_ACK',
  COMMAND_ACK: 'COMMAND_ACK',
  LED_STATUS: 'LED_STATUS',
  HARDWARE_ERROR: 'HARDWARE_ERROR',
  BATTERY: 'BATTERY',
  STATUS: 'STATUS',
  IDENT: 'IDENT',
  DEVICE_PROMPT: 'DEVICE_PROMPT',
  ENV_TELEMETRY: 'ENV_TELEMETRY',
  UNKNOWN: 'UNKNOWN',
  // SD Card Explorer Extensions
  SD_STATUS: 'SD_STATUS',
  SD_LIST_ITEM: 'SD_LIST_ITEM',
  SD_LIST_END: 'SD_LIST_END',
  SD_FILE_INFO: 'SD_FILE_INFO',
  SD_DATA_CHUNK: 'SD_DATA_CHUNK',
  SD_OP_ACK: 'SD_OP_ACK',
  SD_OP_ERR: 'SD_OP_ERR',
  SD_DIAG_REPORT: 'SD_DIAG_REPORT',
  SCAN_PROGRESS: 'SCAN_PROGRESS'
};

export const BINARY_MAGIC = [0xAA, 0x55];
export const BINARY_TAIL = [0x0D, 0x0A];

// Precomputed IEEE 802.3 CRC32 lookup table (polynomial 0xEDB88320)
const CRC32_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC32_TABLE[i] = c >>> 0;
}

/**
 * Compute IEEE 802.3 32-bit CRC checksum
 * @param {Uint8Array|ArrayBuffer|ArrayBufferView|number[]|string} data
 * @returns {number} 32-bit unsigned CRC32 integer
 */
export function computeCrc32(data) {
  let bytes;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof Uint8Array) {
    bytes = data;
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else if (ArrayBuffer.isView(data)) {
    bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  } else if (Array.isArray(data)) {
    bytes = new Uint8Array(data);
  } else {
    bytes = new Uint8Array(0);
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ bytes[i]) & 0xFF];
  }
  return ((crc ^ 0xFFFFFFFF) >>> 0);
}

/**
 * Robust SD Card Chunk Reassembler
 * Reassembles chunked file streams with CRC32 verification, sequence number checking (0, 1, 2...),
 * missing sequence detection, duplicate suppression, and strict buffer bounds checking.
 */
export class SdChunkReassembler {
  /**
   * @param {object} options
   * @param {string} options.filename - Name of target file being reassembled
   * @param {number|null} options.expectedSize - Expected file size in bytes
   * @param {number|string|null} options.expectedCrc32 - Expected CRC32 checksum (hex string or uint32)
   * @param {number} options.maxFileSize - Strict memory safety cap in bytes (default 5MB)
   */
  constructor({ filename = 'file.bin', expectedSize = null, expectedCrc32 = null, maxFileSize = 5 * 1024 * 1024 } = {}) {
    this.filename = filename;
    this.expectedSize = expectedSize;
    if (expectedCrc32 != null) {
      if (typeof expectedCrc32 === 'string') {
        const clean = expectedCrc32.trim().replace(/^0x/i, '');
        this.expectedCrc32 = parseInt(clean, 16) >>> 0;
      } else {
        this.expectedCrc32 = expectedCrc32 >>> 0;
      }
    } else {
      this.expectedCrc32 = null;
    }
    this.maxFileSize = maxFileSize;

    this.chunks = new Map(); // seq -> Uint8Array
    this.totalSeq = null;
    this.receivedBytes = 0;
    this.isComplete = false;
    this.buffer = null; // Uint8Array when complete
    this.verifiedCrc32 = null;
    this.duplicateCount = 0;
    this.missingSeqs = [];
  }

  /**
   * Push incoming chunk
   * @param {object} chunk
   * @param {number} chunk.seq - Zero-based sequence number (0, 1, 2, ...)
   * @param {number} [chunk.totalSeq] - Total number of chunks expected
   * @param {Uint8Array|ArrayBuffer|string} chunk.data - Raw chunk payload
   * @param {number|string} [chunk.crc32] - Optional chunk-level CRC32
   * @returns {object} Progress / completion status
   */
  pushChunk({ seq, totalSeq, data, crc32 = null }) {
    if (this.isComplete) {
      return { status: 'ALREADY_COMPLETE', isComplete: true, filename: this.filename };
    }

    if (totalSeq != null && totalSeq > 0) {
      if (this.totalSeq != null && this.totalSeq !== totalSeq) {
        throw new Error(`[SdChunkReassembler] Inconsistent totalSeq: expected ${this.totalSeq}, got ${totalSeq}`);
      }
      this.totalSeq = totalSeq;
    }

    // Round 2 Defense: Integer check, negative check, and 64-bit overflow prevention
    if (typeof seq !== 'number' || !Number.isInteger(seq) || isNaN(seq)) {
      throw new Error(`[SdChunkReassembler] Invalid sequence number: must be an integer (got ${seq})`);
    }
    if (seq < 0) {
      throw new Error(`[SdChunkReassembler] Invalid negative sequence number: ${seq}`);
    }
    if (seq > Number.MAX_SAFE_INTEGER || seq > 1000000) {
      throw new Error(`[SdChunkReassembler] Sequence number overflow: ${seq}`);
    }

    if (this.totalSeq != null && seq >= this.totalSeq) {
      throw new Error(`[SdChunkReassembler] Invalid sequence number ${seq} for totalSeq ${this.totalSeq}`);
    }

    // Convert data to Uint8Array
    let chunkBytes;
    if (typeof data === 'string') {
      if (/^[0-9a-fA-F]+$/.test(data) && data.length % 2 === 0 && data.length >= 32) {
        // Hex encoded string
        chunkBytes = new Uint8Array(data.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
      } else {
        chunkBytes = new TextEncoder().encode(data);
      }
    } else if (data instanceof Uint8Array) {
      chunkBytes = data;
    } else if (data instanceof ArrayBuffer) {
      chunkBytes = new Uint8Array(data);
    } else if (ArrayBuffer.isView(data)) {
      chunkBytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    } else if (Array.isArray(data)) {
      chunkBytes = new Uint8Array(data);
    } else {
      throw new Error(`[SdChunkReassembler] Unsupported chunk data type: ${typeof data}`);
    }

    // Round 2 Defense: Strict single-chunk payload bounds checking against MTU limits (512 bytes)
    if (chunkBytes.length > 512) {
      throw new Error(`[SdChunkReassembler] Chunk payload length ${chunkBytes.length} exceeds maximum allowable MTU bounds (512 bytes)`);
    }

    // Duplicate packet suppression
    if (this.chunks.has(seq)) {
      this.duplicateCount++;
      return {
        status: 'DUPLICATE',
        seq,
        duplicateCount: this.duplicateCount,
        isComplete: this.isComplete,
        receivedBytes: this.receivedBytes,
        missingSeqs: this.getMissingSequences()
      };
    }

    // Chunk-level CRC32 check if provided
    if (crc32 != null) {
      const targetCrc = typeof crc32 === 'string' ? (parseInt(crc32.replace(/^0x/i, ''), 16) >>> 0) : (crc32 >>> 0);
      const actualCrc = computeCrc32(chunkBytes);
      if (actualCrc !== targetCrc) {
        throw new Error(`[SdChunkReassembler] Chunk ${seq} CRC32 mismatch: calculated 0x${actualCrc.toString(16).toUpperCase()}, expected 0x${targetCrc.toString(16).toUpperCase()}`);
      }
    }

    // Memory safety: strict buffer bounds check against maxFileSize
    if (this.receivedBytes + chunkBytes.length > this.maxFileSize) {
      throw new Error(`[SdChunkReassembler] File size bounds exceeded: exceeds maximum allowed cap of ${this.maxFileSize} bytes`);
    }

    this.chunks.set(seq, chunkBytes);
    this.receivedBytes += chunkBytes.length;

    // Check completion condition
    if (this.totalSeq != null && this.chunks.size === this.totalSeq) {
      const missing = this.getMissingSequences();
      if (missing.length === 0) {
        this._assembleBuffer();
        return {
          status: 'COMPLETE',
          isComplete: true,
          filename: this.filename,
          totalBytes: this.buffer.length,
          crc32: this.verifiedCrc32,
          crc32Hex: this.verifiedCrc32.toString(16).toUpperCase().padStart(8, '0'),
          missingSeqs: []
        };
      }
    }

    const missing = this.getMissingSequences();
    this.missingSeqs = missing;

    return {
      status: 'PROGRESS',
      seq,
      isComplete: false,
      filename: this.filename,
      receivedBytes: this.receivedBytes,
      missingSeqs: missing,
      totalSeq: this.totalSeq,
      chunksReceived: this.chunks.size,
      percentage: this.totalSeq ? Math.min(100, Math.round((this.chunks.size / this.totalSeq) * 100)) : 0
    };
  }

  getMissingSequences() {
    if (this.totalSeq == null) return [];
    const missing = [];
    for (let i = 0; i < this.totalSeq; i++) {
      if (!this.chunks.has(i)) {
        missing.push(i);
      }
    }
    return missing;
  }

  _assembleBuffer() {
    const totalLen = Array.from(this.chunks.values()).reduce((sum, c) => sum + c.length, 0);
    this.buffer = new Uint8Array(totalLen);
    let offset = 0;
    for (let i = 0; i < this.totalSeq; i++) {
      const chunk = this.chunks.get(i);
      if (!chunk) {
        throw new Error(`[SdChunkReassembler] Missing chunk at sequence ${i} during assembly`);
      }
      this.buffer.set(chunk, offset);
      offset += chunk.length;
    }

    this.verifiedCrc32 = computeCrc32(this.buffer);

    if (this.expectedCrc32 != null && this.verifiedCrc32 !== this.expectedCrc32) {
      throw new Error(`[SdChunkReassembler] End-to-end CRC32 checksum mismatch: calculated 0x${this.verifiedCrc32.toString(16).toUpperCase()}, expected 0x${this.expectedCrc32.toString(16).toUpperCase()}`);
    }

    this.isComplete = true;
  }

  getBuffer() {
    return this.buffer;
  }

  getText() {
    if (!this.buffer) return '';
    return new TextDecoder('utf-8', { fatal: false }).decode(this.buffer);
  }

  /**
   * ROUND 5 & 6 DEFENSE: Zero Contamination and Instant Memory Eradication
   * Explicitly zeros all temporary memory buffers so no sensitive spectral
   * data lingers in memory or leaks into persistent storage.
   */
  zeroAndWipe() {
    if (this.buffer && this.buffer instanceof Uint8Array) {
      this.buffer.fill(0);
      this.buffer = null;
    }
    for (const [seq, chunk] of this.chunks.entries()) {
      if (chunk && chunk instanceof Uint8Array) {
        chunk.fill(0);
      }
    }
    this.chunks.clear();
    this.isComplete = false;
    this.receivedBytes = 0;
    this.verifiedCrc32 = null;
    this.expectedCrc32 = null;
    this.missingSeqs = [];
    this.totalSeq = null;
  }

  release() {
    this.zeroAndWipe();
  }
}

export class PacketChunkAccumulator {
  /**
   * @param {object} options
   * @param {number} options.capacity - Maximum ring buffer capacity in bytes (default 65536)
   */
  constructor({ capacity = 65536 } = {}) {
    this.capacity = capacity;
    this.buffer = new Uint8Array(capacity);
    this.writePos = 0;
    this.readPos = 0;
    this.byteCount = 0;

    this.textDecoder = new TextDecoder('utf-8', { fatal: false });
    this.textEncoder = new TextEncoder();

    this.textAccumulator = '';
    this.listeners = new Map();
    this.waiters = [];
    this.recentPackets = [];

    this.stats = {
      totalBytesReceived: 0,
      packetsReassembled: 0,
      droppedFrames: 0,
      bufferOverflows: 0
    };
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this.listeners.has(event)) return;
    this.listeners.set(event, this.listeners.get(event).filter(cb => cb !== callback));
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(cb => {
        try { cb(data); } catch (e) { console.error(`[Accumulator Event Error: ${event}]`, e); }
      });
    }
  }

  /**
   * Push incoming chunk (ArrayBuffer, DataView, Uint8Array, number[], or string)
   */
  pushChunk(chunk) {
    if (chunk == null) return;

    let bytes;
    if (typeof chunk === 'string') {
      bytes = this.textEncoder.encode(chunk);
    } else if (chunk instanceof DataView) {
      bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    } else if (chunk instanceof ArrayBuffer) {
      bytes = new Uint8Array(chunk);
    } else if (ArrayBuffer.isView(chunk)) {
      bytes = new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    } else if (Array.isArray(chunk)) {
      bytes = new Uint8Array(chunk);
    } else {
      console.warn('[Accumulator] Unrecognized chunk data type:', typeof chunk);
      return;
    }

    const chunkLen = bytes.length;
    if (chunkLen === 0) return;

    this.stats.totalBytesReceived += chunkLen;

    let chunkText = '';
    // Append to text accumulator for ASCII / JSON lines
    try {
      chunkText = this.textDecoder.decode(bytes, { stream: true });
      this.textAccumulator += chunkText;
    } catch (e) {
      chunkText = String.fromCharCode(...bytes);
      this.textAccumulator += chunkText;
    }

    // Capture raw incoming chunks and emit rawChunk event
    this.emit('rawChunk', {
      rawBytes: bytes,
      rawText: chunkText,
      timestamp: Date.now(),
      length: chunkLen
    });

    // Append to ring buffer for binary frame scanning
    for (let i = 0; i < chunkLen; i++) {
      if (this.byteCount >= this.capacity) {
        // Buffer overflow: drop oldest byte
        this.readPos = (this.readPos + 1) % this.capacity;
        this.byteCount--;
        this.stats.bufferOverflows++;
      }
      this.buffer[this.writePos] = bytes[i];
      this.writePos = (this.writePos + 1) % this.capacity;
      this.byteCount++;
    }

    // Process both text lines and binary frames
    this._processTextLines();
    this._checkInteractivePrompts();
    this._processBinaryFrames();
  }

  /**
   * Check for interactive hardware terminal prompts that might not be terminated with a newline
   */
  _checkInteractivePrompts() {
    if (!this.textAccumulator) return;
    const promptPatterns = [
      { regex: /Enter\s+Plant\s+Number:\s*$/i, type: 'ENTER_PLANT_NUMBER' },
      { regex: /Enter\s+Plant\s+Name:\s*$/i, type: 'ENTER_PLANT_NAME' },
      { regex: /Enter\s+Pot\s+Number:\s*$/i, type: 'ENTER_POT_NUMBER' },
      { regex: /already\s+saved.*R=rename.*:\s*$/i, type: 'ALREADY_SAVED_RENAME' },
      { regex: /Correct\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):\s*$/i, type: 'CONFIRM_METADATA' },
      { regex: /Calibrate\s+DARK(?:\s*\(LED\s*off\))?\s*(?:now)?\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?\s*$/i, type: 'PROMPT_CALIBRATE_DARK' },
      { regex: /(?:Ready for DARK measurement\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):|DARK:.*(?:Ready\?|close the enclosure)|close the enclosure.*nothing inside)/i, type: 'DARK_READY' },
      { regex: /Save\s+DARK\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):\s*$/i, type: 'SAVE_DARK' },
      { regex: /(?:WHITE:\s*put the white tile.*Ready\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?|Ready\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?\s*$)/is, type: 'READY_WHITE' },
      { regex: /Calibrate\s+WHITE(?:\s*\(LED\s*on\))?\s*(?:now)?\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?\s*$/i, type: 'PROMPT_CALIBRATE_WHITE' },
      { regex: /(?:Ready for WHITE measurement\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):|WHITE:.*Ready\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?)/i, type: 'WHITE_READY' },
      { regex: /Save\s+WHITE\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):\s*$/i, type: 'SAVE_WHITE' },
      { regex: /(?:Y=save\s+R=redo\s+C=cancel:\s*$|Y=save.*:\s*$)/i, type: 'SAVE_CONFIRMATION' },
      { regex: /(?:Ready for leaf scan\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?|Ready to scan leaf\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?|Scan\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?|Start leaf scan\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?)/i, type: 'START_LEAF_SCAN' },
      { regex: /(?:Ready for measurement(?:\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)|:)|Ready for measurement:\s*$)/i, type: 'MEASUREMENT_READY' },
      { regex: /(?:Enter\s+Spot(?:\s+Number)?|Leaf\s+Spot(?:\s+Number)?)(?:\s*\([^\)]*\))?:\s*$/i, type: 'LEAF_SPOT_NUMBER' },
      { regex: /Scan another spot\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):\s*$/i, type: 'SCAN_ANOTHER_SPOT' },
      { regex: /Exit anyway\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):\s*$/i, type: 'EXIT_ANYWAY' },
      { regex: /Drift check.*Do it now\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):\s*$/i, type: 'DRIFT_CHECK' },
      { regex: /Start a new session\?\s*Y:\s*$/i, type: 'START_NEW_SESSION' }
    ];

    for (const p of promptPatterns) {
      if (p.regex.test(this.textAccumulator)) {
        const line = this.textAccumulator.trim();
        const packet = {
          format: 'DEVICE_PROMPT',
          type: PACKET_TYPES.DEVICE_PROMPT,
          data: {
            promptType: p.type,
            promptKey: p.type,
            prompt: line
          },
          rawText: line,
          timestamp: Date.now()
        };
        this.textAccumulator = '';
        this._dispatchPacket(packet);
        break;
      }
    }
  }

  /**
   * Process delimited ASCII lines & JSON objects
   */
  _processTextLines() {
    let newlineIdx;
    while ((newlineIdx = this.textAccumulator.indexOf('\n')) !== -1) {
      const line = this.textAccumulator.slice(0, newlineIdx).trim();
      this.textAccumulator = this.textAccumulator.slice(newlineIdx + 1);

      if (line.length === 0) continue;

      const packet = this._parseTextLine(line);
      if (packet) {
        this._dispatchPacket(packet);
      }
    }

    // Protect against unbounded growth if no newline received for a long time
    if (this.textAccumulator.length > 32768) {
      // Look for last complete JSON block or trim
      const lastBrace = this.textAccumulator.lastIndexOf('}');
      if (lastBrace !== -1) {
        const potentialJson = this.textAccumulator.slice(0, lastBrace + 1);
        const parsed = this._tryParseJson(potentialJson);
        if (parsed) {
          this._dispatchPacket(parsed);
          this.textAccumulator = this.textAccumulator.slice(lastBrace + 1);
          return;
        }
      }
      this.textAccumulator = this.textAccumulator.slice(-8192);
      this.stats.droppedFrames++;
    }
  }

  _tryParseJson(str) {
    try {
      const obj = JSON.parse(str);
      let type = obj.type || obj.event;
      if (!type) {
        if (obj.cmd === 'DARK' || obj.phase === 'DARK_CURRENT' || obj.calib === 'DARK') {
          type = PACKET_TYPES.CALIB_DARK;
        } else if (obj.cmd === 'WHITE' || obj.phase === 'WHITE_REFERENCE' || obj.calib === 'WHITE') {
          type = PACKET_TYPES.CALIB_WHITE;
        } else if (obj.raw || obj.spectrum || obj.rawCounts) {
          type = PACKET_TYPES.SPECTRUM;
        } else if (obj.res || obj.ack || obj.command) {
          type = PACKET_TYPES.COMMAND_ACK;
        } else if (obj.error || obj.err) {
          type = PACKET_TYPES.HARDWARE_ERROR;
        } else {
          type = PACKET_TYPES.UNKNOWN;
        }
      }
      return {
        format: 'JSON',
        type,
        data: obj,
        rawText: str,
        timestamp: Date.now()
      };
    } catch {
      return null;
    }
  }

  _parseTextLine(line) {
    // Ignore lines that contain binary header or unprintable characters (e.g. binary frames)
    if (/[\x00-\x08\x0E-\x1F\x7F-\x9F]/.test(line)) {
      return null;
    }

    // 1. JSON line
    if (line.startsWith('{') && line.endsWith('}')) {
      const jsonPacket = this._tryParseJson(line);
      if (jsonPacket) return jsonPacket;
    }

    // 1b. Protocol ACKs: $ACK:<CMD>,... or ACK:<CMD>,...
    const ackMatch = line.match(/^[\$]?ACK:([A-Z0-9_]+)(?:,(.*))?$/i);
    if (ackMatch) {
      const cmd = ackMatch[1].toUpperCase();
      const rawParams = ackMatch[2] || '';
      const params = {};
      rawParams.split(',').forEach(p => {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          const key = p.slice(0, eqIdx).trim().toLowerCase();
          const rawValue = p.slice(eqIdx + 1).trim();
          // Coerce plain numeric ACK params (OFFSET=0, PEAK=16, ...) to real
          // JS numbers. Without this, every `typeof x === 'number'` check
          // downstream silently fails against these always-string values,
          // falling back to hardcoded placeholder numbers instead of the
          // genuine hardware reading the firmware just reported.
          params[key] = /^-?\d+(\.\d+)?$/.test(rawValue) ? Number(rawValue) : rawValue;
        } else if (p.trim()) {
          if (!params.status) {
            params.status = p.trim();
          }
        }
      });
      const isSdOp = cmd.startsWith('SD_') || cmd.startsWith('SD');
      let packetType = isSdOp ? PACKET_TYPES.SD_OP_ACK : PACKET_TYPES.COMMAND_ACK;
      if (cmd === 'CALIB_DARK' || cmd === 'START_DARK_CALIBRATION' || cmd === 'DARK') {
        packetType = PACKET_TYPES.CALIB_DARK;
      } else if (cmd === 'CALIB_WHITE' || cmd === 'START_WHITE_CALIBRATION' || cmd === 'WHITE') {
        packetType = PACKET_TYPES.CALIB_WHITE;
      }
      return {
        format: 'PROTOCOL_ACK',
        type: packetType,
        data: {
          command: cmd,
          cmd,
          operation: cmd,
          status: params.status || 'OK',
          ...params,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 1c. Protocol Errors: $ERR:<CMD>,... or ERR:<CMD>,...
    const errMatch = line.match(/^[\$]?ERR:([A-Z0-9_]+)(?:,(.*))?$/i);
    if (errMatch) {
      const cmd = errMatch[1].toUpperCase();
      const rawMsg = errMatch[2] || 'Hardware reported command error';
      const isSdOp = cmd.startsWith('SD_') || cmd.startsWith('SD');
      const errParts = rawMsg.split(',');
      const errorCode = errParts[0]?.trim() || 'ERROR';
      const message = errParts.length > 1 ? errParts.slice(1).join(',').trim() : (errParts[0]?.trim() || rawMsg);
      return {
        format: 'PROTOCOL_ERR',
        type: isSdOp ? PACKET_TYPES.SD_OP_ERR : PACKET_TYPES.HARDWARE_ERROR,
        data: {
          command: cmd,
          operation: cmd,
          status: 'ERROR',
          errorCode,
          code: errorCode,
          message,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 1d. Real firmware streaming file listing: $SD_FILE:NAME=...,SIZE=...,TIME=...
    if (/^\$SD_FILE:/i.test(line)) {
      const params = {};
      line.replace(/^\$SD_FILE:/i, '').split(',').forEach(p => {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          params[p.slice(0, eqIdx).trim().toLowerCase()] = p.slice(eqIdx + 1).trim();
        }
      });
      const filename = params.name || '';
      const size = parseInt(params.size, 10) || 0;
      return {
        format: 'SD_FILE',
        type: PACKET_TYPES.SD_LIST_ITEM,
        data: {
          filename,
          size,
          sizeBytes: size,
          timestamp: params.time || '',
          fileType: filename.toLowerCase().endsWith('.json') || filename.toLowerCase().endsWith('.jsn') ? 'JSON' : 'CSV'
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 1h. Real firmware chunk data: $SD_CHUNK:SEQ=<n>,LEN=<n>,CRC32=0x<hex>,DATA=<raw bytes...>
    {
      const chunkMatch = line.match(/^\$SD_CHUNK:SEQ=(\d+),LEN=(\d+),CRC32=(0x[0-9A-Fa-f]+),DATA=([\s\S]*)$/i);
      if (chunkMatch) {
        return {
          format: 'SD_CHUNK',
          type: PACKET_TYPES.SD_DATA_CHUNK,
          data: {
            seq: parseInt(chunkMatch[1], 10) || 0,
            len: parseInt(chunkMatch[2], 10) || 0,
            crc32: chunkMatch[3],
            data: chunkMatch[4]
          },
          rawText: line,
          timestamp: Date.now()
        };
      }
    }

    // 1i. SD Card Explorer: $SD_DIAG_REPORT,...
    if (line.startsWith('$SD_DIAG_REPORT') || line.startsWith('SD_DIAG:')) {
      const cleanLine = line.replace(/^(?:\$SD_DIAG_REPORT|SD_DIAG:)[\s,]*/i, '');
      const params = {};
      cleanLine.split(',').forEach(p => {
        const eqIdx = p.indexOf('=');
        if (eqIdx !== -1) {
          params[p.slice(0, eqIdx).trim().toLowerCase()] = p.slice(eqIdx + 1).trim();
        }
      });
      return {
        format: 'SD_DIAG_REPORT',
        type: PACKET_TYPES.SD_DIAG_REPORT,
        data: {
          ...params,
          mounted: params.mounted === '1' || params.mounted === 'true' || params.mounted === true,
          spiSpeedKhz: parseInt(params.spispeedkhz || params.spispeed || 0, 10),
          sdType: params.sdtype || 'SDHC',
          initStatus: params.initstatus || 'OK',
          readLatencyMs: parseFloat(params.readlatencyms || params.latency || 0),
          fsType: params.fstype || 'FAT32',
          sectorsPerCluster: parseInt(params.sectorspercluster || 0, 10)
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 2. Delimited CSV: $SPEC,totalBands,count0,count1,...
    if (line.startsWith('$SPEC')) {
      const parts = line.split(',');
      if (parts.length >= 3) {
        const totalBands = parseInt(parts[1], 10) || 76;
        const counts = parts.slice(2).map(Number).filter(n => !isNaN(n));
        return {
          format: 'CSV_SPEC',
          type: PACKET_TYPES.SPECTRUM,
          data: {
            totalBands,
            rawCounts: counts,
            rawSample: counts
          },
          rawText: line,
          timestamp: Date.now()
        };
      }
    }

    // 3. Calibration progress announcements
    if (/Measuring DARK/i.test(line)) {
      return {
        format: 'ASCII_CALIB',
        type: PACKET_TYPES.CALIB_DARK,
        data: {
          status: 'MEASURING',
          phase: 'DARK_CURRENT',
          message: line,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    if (/Measuring WHITE/i.test(line)) {
      return {
        format: 'ASCII_CALIB',
        type: PACKET_TYPES.CALIB_WHITE,
        data: {
          status: 'MEASURING',
          phase: 'WHITE_REFERENCE',
          message: line,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 3b. Hardware Optical Array counts (AS7265x / Tri-Spectrometer / C12880MA / BlueNRG)
    if (/^DARK:\s*[\d\s,]+/i.test(line)) {
      const nums = line.replace(/^DARK:\s*/i, '').trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        return {
          format: 'AS7265X_DARK',
          type: PACKET_TYPES.CALIB_DARK,
          data: {
            channels: nums,
            rawCounts: nums,
            count: nums.length,
            status: 'OK',
            rawText: line
          },
          rawText: line,
          timestamp: Date.now()
        };
      }
    }

    if (/^WHITE:\s*[\d\s,]+/i.test(line) && !/put the white tile/i.test(line)) {
      const nums = line.replace(/^WHITE:\s*/i, '').trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
      if (nums.length > 0) {
        return {
          format: 'AS7265X_WHITE',
          type: PACKET_TYPES.CALIB_WHITE,
          data: {
            channels: nums,
            rawCounts: nums,
            count: nums.length,
            status: 'OK',
            rawText: line
          },
          rawText: line,
          timestamp: Date.now()
        };
      }
    }

    // 3bb. Hardware calibration saved & session status lines
    // e.g. "DARK saved as calibration #54" or "DARK : #54 at 2026-11-12 23:56:58" or "DARK : #54"
    const darkSavedMatch = line.match(/(?:DARK\s+saved\s+as\s+calibration\s+#?(\d+)|DARK\s*:\s*#?(\d+)(?:\s+at\s+([^\r\n]+))?)/i);
    if (darkSavedMatch) {
      const calibId = parseInt(darkSavedMatch[1] || darkSavedMatch[2], 10);
      return {
        format: 'ASCII_CALIB_SAVED',
        type: PACKET_TYPES.CALIB_DARK,
        data: {
          status: 'SAVED',
          calibId,
          timestamp: darkSavedMatch[3] ? darkSavedMatch[3].trim() : new Date().toISOString(),
          phase: 'DARK_CURRENT',
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    const whiteSavedMatch = line.match(/(?:WHITE\s+saved\s+as\s+calibration\s+#?(\d+)|WHITE\s*:\s*#?(\d+)(?:\s+at\s+([^\r\n]+))?)/i);
    if (whiteSavedMatch) {
      const calibId = parseInt(whiteSavedMatch[1] || whiteSavedMatch[2], 10);
      return {
        format: 'ASCII_CALIB_SAVED',
        type: PACKET_TYPES.CALIB_WHITE,
        data: {
          status: 'SAVED',
          calibId,
          timestamp: whiteSavedMatch[3] ? whiteSavedMatch[3].trim() : new Date().toISOString(),
          phase: 'WHITE_REFERENCE',
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 3bc. Leaf scan progress: "Scan 1 of 5 done", "Scan 2 of 5 done", etc.
    const scanProgMatch = line.match(/Scan\s*(\d+)\s*of\s*(\d+)\s*done/i);
    if (scanProgMatch) {
      return {
        format: 'SCAN_PROGRESS',
        type: PACKET_TYPES.SCAN_PROGRESS,
        data: {
          current: parseInt(scanProgMatch[1], 10),
          total: parseInt(scanProgMatch[2], 10),
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 3b2. Firmware persistent calibration status: "DARK : #60 at 2026-11-12 22:08:28"
    const darkStatusMatch = line.match(/DARK\s*:\s*#(\d+)(?:\s+at\s+([^\r\n]+))?/i);
    if (darkStatusMatch) {
      return {
        format: 'ASCII_CALIB_STATUS',
        type: PACKET_TYPES.CALIB_DARK,
        data: {
          status: 'SAVED',
          calibId: parseInt(darkStatusMatch[1], 10),
          timestamp: darkStatusMatch[2] ? darkStatusMatch[2].trim() : new Date().toISOString(),
          offset: 0.0001,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 3b3. Firmware persistent calibration status: "WHITE: #59 at 2026-11-12 22:08:52"
    const whiteStatusMatch = line.match(/WHITE\s*:\s*#(\d+)(?:\s+at\s+([^\r\n]+))?/i);
    if (whiteStatusMatch) {
      return {
        format: 'ASCII_CALIB_STATUS',
        type: PACKET_TYPES.CALIB_WHITE,
        data: {
          status: 'SAVED',
          calibId: parseInt(whiteStatusMatch[1], 10),
          timestamp: whiteStatusMatch[2] ? whiteStatusMatch[2].trim() : new Date().toISOString(),
          peak: 65535,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 3c. Calibration responses: $CALIB_DARK,OK,offset or $CALIB_WHITE,OK,peak, plus hardware ASCII confirmations
    const isDarkMatch = /^(?:\$CALIB_DARK|\$DARK\b|DARK_OK\b|CALIB_DARK_OK\b|DARK\s*:\s*OK\b|DARK\s*:\s*done\b|DARK\s+DONE\b|DARK\s+CALIBRATION\s+COMPLETE\b|DARK\s*CURRENT|DARK\s+LOCKED)/i.test(line) ||
      /DARK\s*:\s*OK/i.test(line) ||
      /DARK\s*:\s*done/i.test(line) ||
      /DARK\s+DONE/i.test(line);

    if (isDarkMatch) {
      const parts = line.split(/[,:]\s*/);
      let offset = null;
      for (const part of parts) {
        const num = parseFloat(part);
        if (!isNaN(num) && num > 0 && num < 1.0) {
          offset = num;
          break;
        }
      }
      const status = /done/i.test(line) ? 'DONE' : ((parts[1] ? parts[1].trim() : 'OK') || 'OK');
      return {
        format: 'ASCII_CALIB',
        type: PACKET_TYPES.CALIB_DARK,
        data: {
          status,
          offset,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    const isWhiteMatch = /^(?:\$CALIB_WHITE|\$WHITE\b|WHITE_OK\b|CALIB_WHITE_OK\b|WHITE\s*:\s*OK\b|WHITE\s*:\s*done\b|WHITE\s+DONE\b|WHITE\s+CALIBRATION\s+COMPLETE\b|WHITE\s*REFERENCE|WHITE\s+LOCKED)/i.test(line) ||
      /WHITE\s*:\s*OK/i.test(line) ||
      /WHITE\s*:\s*done/i.test(line) ||
      /WHITE\s+DONE/i.test(line);

    if (isWhiteMatch) {
      const parts = line.split(/[,:]\s*/);
      let peak = null;
      for (const part of parts) {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num > 100) {
          peak = num;
          break;
        }
      }
      const status = /done/i.test(line) ? 'DONE' : ((parts[1] ? parts[1].trim() : 'OK') || 'OK');
      return {
        format: 'ASCII_CALIB',
        type: PACKET_TYPES.CALIB_WHITE,
        data: {
          status,
          peak,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 4. Battery response: $BATT,94
    if (line.startsWith('$BATT')) {
      const parts = line.split(',');
      return {
        format: 'ASCII_BATT',
        type: PACKET_TYPES.BATTERY,
        data: {
          level: parseInt(parts[1], 10) || 94
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    if (/^Scan\s*(\d+)[:\s]+([\d\s]+)/i.test(line)) {
      const match = line.match(/^Scan\s*(\d+)[:\s]+(.*)$/i);
      const scanIndex = match ? parseInt(match[1], 10) : 1;
      const rawNums = match ? match[2].trim().split(/\s+/).map(Number).filter(n => !isNaN(n)) : [];
      return {
        format: 'AS7265X_SCAN',
        type: PACKET_TYPES.SPECTRUM,
        data: {
          scanIndex,
          channels: rawNums,
          rawCounts: rawNums,
          rawSample: rawNums,
          totalBands: rawNums.length
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    if (/T=([\d.-]+)\s+P=([\d.-]+)\s+H=([\d.-]+)/i.test(line)) {
      const match = line.match(/T=([\d.-]+)\s+P=([\d.-]+)\s+H=([\d.-]+)/i);
      return {
        format: 'AS7265X_ENV',
        type: PACKET_TYPES.ENV_TELEMETRY,
        data: {
          temperature: parseFloat(match[1]),
          pressure: parseFloat(match[2]),
          humidity: parseFloat(match[3])
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 4c. Interactive Hardware Questions / Prompts
    if (/Enter\s+Plant\s+Number/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ENTER_PLANT_NUMBER', promptKey: 'ENTER_PLANT_NUMBER', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Enter\s+Plant\s+Name/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ENTER_PLANT_NAME', promptKey: 'ENTER_PLANT_NAME', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Enter\s+Pot\s+Number/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ENTER_POT_NUMBER', promptKey: 'ENTER_POT_NUMBER', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/already\s+saved.*R=rename/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ALREADY_SAVED_RENAME', promptKey: 'ALREADY_SAVED_RENAME', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Correct\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'CONFIRM_METADATA', promptKey: 'CONFIRM_METADATA', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Calibrate\s+DARK.*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'PROMPT_CALIBRATE_DARK', promptKey: 'PROMPT_CALIBRATE_DARK', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/DARK:\s*close the enclosure/i.test(line) || /close the enclosure.*nothing inside/i.test(line) || /DARK:.*Ready\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'DARK_READY', promptKey: 'DARK_READY', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Save\s+DARK\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'SAVE_DARK', promptKey: 'SAVE_DARK', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/WHITE:\s*put the white tile/i.test(line) || (/put the white tile/i.test(line) && /Ready\?/i.test(line))) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'READY_WHITE', promptKey: 'READY_WHITE', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Calibrate\s+WHITE.*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'PROMPT_CALIBRATE_WHITE', promptKey: 'PROMPT_CALIBRATE_WHITE', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/(?:WHITE:.*Ready\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)|Ready\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N):?)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'READY_WHITE', promptKey: 'READY_WHITE', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Save\s+WHITE\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'SAVE_WHITE', promptKey: 'SAVE_WHITE', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/(?:Ready for leaf scan|Ready to scan leaf|Start leaf scan|Scan\?)\s*\??\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'START_LEAF_SCAN', promptKey: 'START_LEAF_SCAN', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Leaf Spot(?:\s+Number)?|Enter Spot Number/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'LEAF_SPOT_NUMBER', promptKey: 'LEAF_SPOT_NUMBER', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Y=save\s+R=redo\s+C=cancel/i.test(line) || /Y=save.*:\s*$/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'SAVE_CONFIRMATION', promptKey: 'SAVE_CONFIRMATION', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Scan another spot\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'SCAN_ANOTHER_SPOT', promptKey: 'SCAN_ANOTHER_SPOT', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Exit anyway\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'EXIT_ANYWAY', promptKey: 'EXIT_ANYWAY', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Drift check.*Do it now\?\s*(?:\(?[Yy]\/[Nn]\)?|Y\/N)/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'DRIFT_CHECK', promptKey: 'DRIFT_CHECK', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Start a new session\?\s*Y/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'START_NEW_SESSION', promptKey: 'START_NEW_SESSION', prompt: line }, rawText: line, timestamp: Date.now() };
    }

    // 5. Identification / Handshake: AGRISPECTRA-SPEC, ST-Link, C12880MA
    if (line.includes('AGRISPECTRA') || line.includes('SPEC') || line.includes('ST-Link') || line.includes('PONG')) {
      return {
        format: 'ASCII_IDENT',
        type: PACKET_TYPES.IDENT,
        data: {
          identity: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    // 6. Delimited numeric vector / spectral counts (e.g. comma/space separated counts: AS726x 6/18 channels, C12880MA arrays, or raw counts)
    const cleaned = line.replace(/^[a-zA-Z0-9_#-]+[:=]\s*/, '').replace(/[\[\]()]/g, '').trim();
    if (cleaned.length > 0) {
      const parts = cleaned.split(/[,;\t\s]+/).filter(Boolean);
      if (parts.length > 0) {
        const counts = parts.map(Number);
        if (counts.every(n => !isNaN(n) && isFinite(n))) {
          return {
            format: 'RAW_NUMERIC',
            type: PACKET_TYPES.SPECTRUM,
            data: {
              totalBands: counts.length,
              rawCounts: counts,
              rawSample: counts
            },
            rawText: line,
            timestamp: Date.now()
          };
        }
      }
    }

    // 7. Generic Line
    return {
      format: 'ASCII_RAW',
      type: PACKET_TYPES.UNKNOWN,
      data: { text: line },
      rawText: line,
      timestamp: Date.now()
    };
  }

  /**
   * Process structured binary frames:
   * [0xAA 0x55] [len:uint16] [type:uint8] [payload] [crc:uint16] [0x0D 0x0A]
   */
  _processBinaryFrames() {
    while (this.byteCount >= 8) { // Minimum frame size: 2 header + 2 len + 1 type + 0 payload + 2 crc + 2 tail = 9
      // Search for 0xAA 0x55
      const b0 = this.buffer[this.readPos];
      const b1 = this.buffer[(this.readPos + 1) % this.capacity];

      if (b0 !== BINARY_MAGIC[0] || b1 !== BINARY_MAGIC[1]) {
        // Not magic header, advance by 1
        this.readPos = (this.readPos + 1) % this.capacity;
        this.byteCount--;
        continue;
      }

      // Check if we have header + len + type
      if (this.byteCount < 5) break;

      const lenHigh = this.buffer[(this.readPos + 2) % this.capacity];
      const lenLow = this.buffer[(this.readPos + 3) % this.capacity];
      const payloadLen = (lenHigh << 8) | lenLow;
      const totalFrameLen = 2 + 2 + 1 + payloadLen + 2 + 2; // magic(2) + len(2) + type(1) + payload(N) + crc(2) + tail(2)

      if (payloadLen > 4096) {
        // Corrupted length header, advance past magic
        this.readPos = (this.readPos + 2) % this.capacity;
        this.byteCount -= 2;
        this.stats.droppedFrames++;
        continue;
      }

      if (this.byteCount < totalFrameLen) {
        // Need more bytes to complete frame
        break;
      }

      // Verify tail
      const tail0 = this.buffer[(this.readPos + totalFrameLen - 2) % this.capacity];
      const tail1 = this.buffer[(this.readPos + totalFrameLen - 1) % this.capacity];

      if (tail0 !== BINARY_TAIL[0] || tail1 !== BINARY_TAIL[1]) {
        // Corrupted tail, skip header
        this.readPos = (this.readPos + 2) % this.capacity;
        this.byteCount -= 2;
        this.stats.droppedFrames++;
        continue;
      }

      // Extract frame
      const frameBytes = new Uint8Array(totalFrameLen);
      for (let i = 0; i < totalFrameLen; i++) {
        frameBytes[i] = this.buffer[(this.readPos + i) % this.capacity];
      }

      this.readPos = (this.readPos + totalFrameLen) % this.capacity;
      this.byteCount -= totalFrameLen;

      const packetTypeByte = frameBytes[4];
      const payload = frameBytes.slice(5, 5 + payloadLen);

      const packet = this._parseBinaryPacket(packetTypeByte, payload);
      if (packet) {
        this._dispatchPacket(packet);
      }
    }
  }

  _parseBinaryPacket(typeByte, payload) {
    let type = PACKET_TYPES.UNKNOWN;
    let data = {};

    switch (typeByte) {
      case 0x01: { // DARK CALIBRATION
        type = PACKET_TYPES.CALIB_DARK;
        data = { status: 'OK', phase: 'DARK_CURRENT', raw: Array.from(payload) };
        break;
      }
      case 0x02: { // WHITE CALIBRATION
        type = PACKET_TYPES.CALIB_WHITE;
        data = { status: 'OK', phase: 'WHITE_REFERENCE', raw: Array.from(payload) };
        break;
      }
      case 0x03: { // LEAF SPECTRUM (76 uint16 values = 152 bytes)
        type = PACKET_TYPES.SPECTRUM;
        const totalBands = Math.floor(payload.length / 2);
        const counts = [];
        const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        for (let i = 0; i < totalBands; i++) {
          counts.push(view.getUint16(i * 2, true)); // Little endian ADC counts
        }
        data = {
          totalBands,
          rawCounts: counts,
          rawSample: counts
        };
        break;
      }
      case 0x04: { // METADATA ACK
        type = PACKET_TYPES.METADATA_ACK;
        data = { status: 'OK', payload: Array.from(payload) };
        break;
      }
      case 0x05: { // BATTERY & TELEMETRY
        type = PACKET_TYPES.BATTERY;
        const level = payload.length > 0 ? payload[0] : 100;
        data = { level };
        break;
      }
      case 0x10: { // SD_DATA_CHUNK (0xAA 0x55 [len:16] [0x10] [seq:16] [total_seq:16] [chunk_len:16] [crc32:32] [data] [crc:16] [0x0D 0x0A])
        type = PACKET_TYPES.SD_DATA_CHUNK;
        const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
        const seq = payload.length >= 2 ? view.getUint16(0, true) : 0;
        const totalSeq = payload.length >= 4 ? view.getUint16(2, true) : 1;
        const chunkLen = payload.length >= 6 ? view.getUint16(4, true) : 0;
        const crc32 = payload.length >= 10 ? view.getUint32(6, true) : 0;
        const chunkBytes = payload.length > 10 ? payload.slice(10, 10 + chunkLen) : new Uint8Array(0);
        data = {
          seq,
          totalSeq,
          chunkLen: chunkBytes.length,
          crc32: crc32 ? crc32.toString(16).toUpperCase() : null,
          bytes: chunkBytes,
          data: chunkBytes
        };
        break;
      }
      default:
        type = PACKET_TYPES.UNKNOWN;
        data = { rawPayload: Array.from(payload) };
    }

    return {
      format: 'BINARY',
      type,
      data,
      rawBytes: payload,
      timestamp: Date.now()
    };
  }

  _dispatchPacket(packet) {
    this.stats.packetsReassembled++;

    // Track in recent packets buffer
    if (!this.recentPackets) this.recentPackets = [];
    this.recentPackets.push({ packet, timestamp: Date.now() });
    if (this.recentPackets.length > 50) this.recentPackets.shift();

    // Resolve any waiters waiting for this packet type or matching predicate
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const waiter = this.waiters[i];
      let matches = false;
      if (typeof waiter.predicate === 'string') {
        matches = packet.type === waiter.predicate;
      } else if (typeof waiter.predicate === 'function') {
        matches = waiter.predicate(packet);
      }
      if (matches) {
        clearTimeout(waiter.timer);
        this.waiters.splice(i, 1);
        waiter.resolve(packet);
      }
    }

    // Emit typed and generic events
    this.emit('packet', packet);
    if (packet.type === PACKET_TYPES.SPECTRUM) {
      this.emit('spectrum', packet);
    } else if (packet.type === PACKET_TYPES.CALIB_DARK || packet.type === PACKET_TYPES.CALIB_WHITE) {
      this.emit('calibration', packet);
    } else if (packet.type === PACKET_TYPES.BATTERY) {
      this.emit('battery', packet);
    } else if (packet.type === PACKET_TYPES.SD_STATUS) {
      this.emit('sdStatus', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_LIST_ITEM) {
      this.emit('sdListItem', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_LIST_END) {
      this.emit('sdListEnd', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_FILE_INFO) {
      this.emit('sdFileInfo', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_DATA_CHUNK) {
      this.emit('sdDataChunk', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_OP_ACK) {
      this.emit('sdOpAck', packet.data);
      this.emit('commandAck', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_OP_ERR) {
      this.emit('sdOpErr', packet.data);
      this.emit('hardwareError', packet.data);
    } else if (packet.type === PACKET_TYPES.SD_DIAG_REPORT) {
      this.emit('sdDiagReport', packet.data);
    } else if (packet.type === PACKET_TYPES.COMMAND_ACK) {
      this.emit('commandAck', packet.data);
      const cmd = String(packet.data?.command || packet.data?.cmd || packet.data?.res || '').toUpperCase();
      if (cmd === 'LED_ON' || cmd === 'LED_OFF' || packet.data?.led !== undefined) {
        const isLedOn = cmd === 'LED_ON' || packet.data?.led === 'ON' || packet.data?.led === true;
        this.emit('ledStatus', {
          led: isLedOn,
          status: packet.data?.status || 'OK',
          rawText: packet.rawText
        });
      }
    } else if (packet.type === PACKET_TYPES.HARDWARE_ERROR) {
      this.emit('hardwareError', packet.data);
    }
  }

  /**
   * Wait for a command acknowledgement (ACK) with optional timeout
   * @param {string} commandName e.g. 'HELLO', 'LED_ON', 'LED_OFF', 'SET_METADATA', 'START_SCAN'
   * @param {number} timeoutMs
   */
  waitForAck(commandName, timeoutMs = 5000) {
    const cmdUpper = String(commandName).toUpperCase();
    return this.waitForPacket((packet) => {
      if (packet.type === PACKET_TYPES.COMMAND_ACK || packet.type === PACKET_TYPES.SD_OP_ACK) {
        const pCmd = String(packet.data?.command || packet.data?.cmd || packet.data?.operation || packet.data?.res || packet.data?.ack || '').toUpperCase();
        return pCmd === cmdUpper || pCmd === `SD_${cmdUpper}` || pCmd.endsWith(cmdUpper);
      }
      if (packet.type === PACKET_TYPES.HARDWARE_ERROR || packet.type === PACKET_TYPES.SD_OP_ERR) {
        const pCmd = String(packet.data?.command || packet.data?.cmd || packet.data?.operation || '').toUpperCase();
        if (pCmd === cmdUpper || pCmd === `SD_${cmdUpper}` || pCmd.endsWith(cmdUpper)) {
          throw new Error(packet.data?.message || `Hardware reported error executing ${commandName}`);
        }
      }
      return false;
    }, timeoutMs);
  }

  /**
   * Wait specifically for an SD Card Operation Acknowledgement ($ACK:SD_<OP> or $ERR:SD_<OP>)
   * @param {string} operationName e.g. 'DELETE', 'COPY', 'CANCEL', 'STATUS', 'READ'
   * @param {number} timeoutMs
   */
  waitForSdOpAck(operationName, timeoutMs = 8000) {
    const opUpper = String(operationName).toUpperCase();
    return this.waitForPacket((packet) => {
      if (packet.type === PACKET_TYPES.SD_OP_ACK || packet.type === PACKET_TYPES.COMMAND_ACK) {
        const pCmd = String(packet.data?.command || packet.data?.operation || packet.data?.cmd || '').toUpperCase();
        return pCmd === opUpper || pCmd === `SD_${opUpper}` || pCmd.endsWith(opUpper);
      }
      if (packet.type === PACKET_TYPES.SD_OP_ERR || packet.type === PACKET_TYPES.HARDWARE_ERROR) {
        const pCmd = String(packet.data?.command || packet.data?.operation || '').toUpperCase();
        if (pCmd === opUpper || pCmd === `SD_${opUpper}` || pCmd.endsWith(opUpper)) {
          const errCode = packet.data?.errorCode || packet.data?.code || 'SD_ERROR';
          const errMsg = packet.data?.message || `Hardware reported error executing SD operation: ${operationName}`;
          const err = new Error(errMsg);
          err.code = errCode;
          throw err;
        }
      }
      return false;
    }, timeoutMs);
  }

  /**
   * Wait for a packet of given type or matching predicate with timeout
   */
  waitForPacket(predicate, timeoutMs = 8000) {
    if (!this.recentPackets) this.recentPackets = [];
    const now = Date.now();
    for (let i = this.recentPackets.length - 1; i >= 0; i--) {
      const entry = this.recentPackets[i];
      if (now - entry.timestamp <= 5000) {
        let matches = false;
        if (typeof predicate === 'string') {
          matches = entry.packet.type === predicate;
        } else if (typeof predicate === 'function') {
          try { matches = predicate(entry.packet); } catch (_) {}
        }
        if (matches) {
          this.recentPackets.splice(i, 1);
          return Promise.resolve(entry.packet);
        }
      }
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex(w => w.timer === timer);
        if (idx !== -1) {
          this.waiters.splice(idx, 1);
        }
        reject(new Error(`[Accumulator] Timeout waiting for packet (${typeof predicate === 'string' ? predicate : 'custom'}) after ${timeoutMs}ms`));
      }, timeoutMs);

      this.waiters.push({ predicate, resolve, reject, timer });
    });
  }

  /**
   * Clear accumulator buffers and reset state
   */
  clear() {
    this.writePos = 0;
    this.readPos = 0;
    this.byteCount = 0;
    this.textAccumulator = '';
    this.recentPackets = [];
    this.waiters.forEach(w => {
      clearTimeout(w.timer);
      w.reject(new Error('[Accumulator] Cleared before packet arrived'));
    });
    this.waiters = [];
  }

  getStats() {
    return {
      ...this.stats,
      bufferedBytes: this.byteCount,
      textAccumulatorLength: this.textAccumulator.length,
      activeWaiters: this.waiters.length
    };
  }

  /**
   * Helper: Build binary frame [0xAA 0x55] [len:16] [type:8] [payload] [crc:16] [0x0D 0x0A]
   */
  static buildBinaryFrame(typeByte, payloadBytes = []) {
    const payloadLen = payloadBytes.length;
    const totalLen = 2 + 2 + 1 + payloadLen + 2 + 2;
    const frame = new Uint8Array(totalLen);
    frame[0] = BINARY_MAGIC[0];
    frame[1] = BINARY_MAGIC[1];
    frame[2] = (payloadLen >> 8) & 0xFF;
    frame[3] = payloadLen & 0xFF;
    frame[4] = typeByte;
    for (let i = 0; i < payloadLen; i++) {
      frame[5 + i] = payloadBytes[i];
    }
    // Simple 16-bit Fletcher/sum CRC
    let crc = 0;
    for (let i = 0; i < payloadLen + 1; i++) {
      crc = (crc + frame[4 + i]) & 0xFFFF;
    }
    frame[5 + payloadLen] = (crc >> 8) & 0xFF;
    frame[6 + payloadLen] = crc & 0xFF;
    frame[7 + payloadLen] = BINARY_TAIL[0];
    frame[8 + payloadLen] = BINARY_TAIL[1];
    return frame;
  }
}
