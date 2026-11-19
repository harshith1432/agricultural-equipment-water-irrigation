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
  BATTERY: 'BATTERY',
  STATUS: 'STATUS',
  IDENT: 'IDENT',
  DEVICE_PROMPT: 'DEVICE_PROMPT',
  ENV_TELEMETRY: 'ENV_TELEMETRY',
  UNKNOWN: 'UNKNOWN'
};

export const BINARY_MAGIC = [0xAA, 0x55];
export const BINARY_TAIL = [0x0D, 0x0A];

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
    this._processBinaryFrames();
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
      const type = obj.type || obj.event || (obj.raw || obj.spectrum ? PACKET_TYPES.SPECTRUM : PACKET_TYPES.UNKNOWN);
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

    // 3. Calibration responses: $CALIB_DARK,OK,offset or $CALIB_WHITE,OK,peak
    if (line.startsWith('$CALIB_DARK')) {
      const parts = line.split(',');
      return {
        format: 'ASCII_CALIB',
        type: PACKET_TYPES.CALIB_DARK,
        data: {
          status: parts[1] || 'OK',
          offset: parseFloat(parts[2]) || 0.019
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    if (line.startsWith('$CALIB_WHITE')) {
      const parts = line.split(',');
      return {
        format: 'ASCII_CALIB',
        type: PACKET_TYPES.CALIB_WHITE,
        data: {
          status: parts[1] || 'OK',
          peak: parseInt(parts[2], 10) || 58000
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

    // 4b. Hardware Tri-Spectrometer (AS7265x / MicroSpec 18-channel optical array & BME280)
    if (/^DARK:\s*([\d\s]+)/i.test(line)) {
      const nums = line.replace(/^DARK:\s*/i, '').trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
      return {
        format: 'AS7265X_DARK',
        type: PACKET_TYPES.CALIB_DARK,
        data: {
          channels: nums,
          count: nums.length,
          rawText: line
        },
        rawText: line,
        timestamp: Date.now()
      };
    }

    if (/^WHITE:\s*([\d\s]+)/i.test(line)) {
      const nums = line.replace(/^WHITE:\s*/i, '').trim().split(/\s+/).map(Number).filter(n => !isNaN(n));
      return {
        format: 'AS7265X_WHITE',
        type: PACKET_TYPES.CALIB_WHITE,
        data: {
          channels: nums,
          count: nums.length,
          rawText: line
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
    if (/Enter Plant Number/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ENTER_PLANT_NUMBER', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Enter Plant Name/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ENTER_PLANT_NAME', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Enter Pot Number/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'ENTER_POT_NUMBER', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Correct\?\s*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'CONFIRM_METADATA', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Calibrate DARK.*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'PROMPT_CALIBRATE_DARK', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/DARK:.*Ready\?\s*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'DARK_READY', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Calibrate WHITE.*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'PROMPT_CALIBRATE_WHITE', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/WHITE:.*Ready\?\s*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'WHITE_READY', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Start leaf scan\?\s*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'START_LEAF_SCAN', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Leaf Spot Number:/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'LEAF_SPOT_NUMBER', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Y=save\s+R=redo\s+C=cancel/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'SAVE_CONFIRMATION', prompt: line }, rawText: line, timestamp: Date.now() };
    }
    if (/Scan another spot\?\s*Y\/N/i.test(line)) {
      return { format: 'DEVICE_PROMPT', type: PACKET_TYPES.DEVICE_PROMPT, data: { promptType: 'SCAN_ANOTHER_SPOT', prompt: line }, rawText: line, timestamp: Date.now() };
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
    }
  }

  /**
   * Wait for a packet of given type or matching predicate with timeout
   */
  waitForPacket(predicate, timeoutMs = 8000) {
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
