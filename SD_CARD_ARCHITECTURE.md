# ST B-L475E-IOT01A2 Spectroscope: SD Card Storage Subsystem & Architecture

**Document Version:** 2.1.0  
**Target Hardware:** STMicroelectronics B-L475E-IOT01A2 Discovery Kit (IoT Node)  
**Microcontroller:** STM32L475VGT6 (ARM Cortex-M4 with FPU @ 80 MHz, 1024 KB Flash, 128 KB SRAM)  
**Expansion Bus:** Arduino Uno V3 Compatible Connector (CN6, CN7, CN8, CN9)  
**Storage Medium:** External Micro-SD / SDHC Card via SPI Mode (FAT16 / FAT32)  
**Directory Mount:** `/SCANS/`  

---

## 1. Executive Hardware & Electrical Audit

### 1.1 Physical Pinout Mapping on Arduino Uno Header

The STMicroelectronics B-L475E-IOT01A2 board provides standard Arduino Uno V3 extension headers. The external SPI micro-SD card module is interfaced through the `SPI1` peripheral and dedicated GPIO control lines.

| Signal Name | MCU Pin | Arduino Header Pin | Physical Connector | Signal Direction | Hardware Description & Electrical Characteristics |
|---|---|---|---|---|---|
| **SPI1_SCK** | **PA5** | **D13** | CN7 Pin 5 | Output (AF5) | SPI Serial Clock. **Important Hardware Notice:** PA5 is also physically tied to onboard User LED1 (Green). When SPI1 clock pulses occur during SD read/write transactions, LED1 will flicker in direct proportion to bus activity. This serves as a natural hardware visual activity indicator. |
| **SPI1_MISO** | **PA6** | **D12** | CN7 Pin 6 | Input (AF5) | SPI Master In / Slave Out (Data from SD card to STM32). High impedance when CS is high. |
| **SPI1_MOSI** | **PA7** | **D11** | CN7 Pin 7 | Output (AF5) | SPI Master Out / Slave In (Commands and data from STM32 to SD card). |
| **SD_CS** | **PB1** | **D4** | CN8 Pin 4 | Output (GPIO) | Active-Low Chip Select. Driven LOW to select the SD card slave, HIGH to release bus. |
| **SD_CD** | **PC2** | **A1** | CN9 Pin 2 | Input (GPIO Pull-Up) | Card Detect switch. Configured with internal pull-up resistor (~40 kΩ). When a card is inserted, the switch grounds PC2 (Active-Low). Software applies a 25ms debounce filter. |
| **VCC** | 3.3V / 5.0V | 3V3 / 5V | CN6 Pin 4 / 5 | Power Output | Power rail. Modules with onboard 3.3V LDO regulator connect to 5V; bare 3.3V level-shifted modules connect to 3.3V rail. |
| **GND** | GND | GND | CN6 Pin 6 / 7 | Ground | Common reference ground return. |

```
              +----------------------------------------------+
              |           B-L475E-IOT01A2 (STM32L475)        |
              |                                              |
              |  [PA5 / D13] ---- SPI1_SCK ---> [SCK]        |
              |  [PA6 / D12] <--- SPI1_MISO --- [MISO]       |
              |  [PA7 / D11] ---- SPI1_MOSI --> [MOSI]       |  External
              |  [PB1 / D4]  ---- SD_CS (L) --> [CS]         |  Micro-SD
              |  [PC2 / A1]  <--- SD_CD (L) --- [CD/DET]     |  Card Module
              |  [+3.3V/5V]  -----------------> [VCC]        |
              |  [GND]       -----------------> [GND]        |
              |                                              |
              |  * Note: PA5 also drives LD1 (Green LED)     |
              +----------------------------------------------+
```

---

## 2. SPI Timing & Clock Configuration

The STM32L475VGT6 system clock is configured at **80.0 MHz**. The `SPI1` peripheral resides on the **APB2** high-speed peripheral bus (`PCLK2 = 80 MHz`).

```
                    80 MHz APB2 Clock
                            |
           +----------------+----------------+
           |                                 |
    Prescaler = 256                   Prescaler = 4
           |                                 |
     312.5 kHz                         20.0 MHz
(Identification Phase)           (Data Transfer Phase)
```

1. **Card Identification & Initialization Phase (Low Speed):**
   - **Clock Rate:** `80 MHz / 256 = 312.5 kHz`
   - **SD Specification Requirement:** 100 kHz to 400 kHz.
   - Used during initial power-up, pouring 80 dummy clock cycles with CS high, issuing `CMD0`, `CMD8`, `ACMD41` polling loop, and `CMD58` OCR interrogation.
2. **Data Streaming & Bulk Sector Transfer Phase (High Speed):**
   - **Clock Rate:** `80 MHz / 4 = 20.0 MHz`
   - **SD Specification Standard:** Maximum SPI mode clock is 25.0 MHz.
   - Delivers up to ~1.85 MB/s raw sustained SPI sector throughput on STM32 Cortex-M4.

---

## 3. Firmware Software Stack

The storage architecture is organized into five strict, modular abstraction layers:

```
+--------------------------------------------------------------------------+
|  Layer 5: Two-Way BLE Wire Protocol & CLI Commands                       |
|           (protocol_parser.h / protocol_parser.c)                        |
|           SD_STATUS, SD_LIST, SD_INFO, SD_READ, SD_CHUNK, SD_DELETE, ...  |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|  Layer 4: High-Level Spectroscopy Scan Storage Manager                   |
|           (sd_storage_manager.h / sd_storage_manager.c)                  |
|           Mounts /SCANS/, auto-saves scans, enforces concurrency locks,  |
|           validates security, computes CRC32, runs diagnostic probes.     |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|  Layer 3: FatFs Embedded File System Core                                |
|           (ff.h / ffconf.h / ff.c)                                       |
|           FAT16 / FAT32 filesystem, LFN support (255 chars), cluster     |
|           chain management, directory parsing.                           |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|  Layer 2: FatFs DiskIO Driver Abstraction                                |
|           (fatfs_sd.h / fatfs_sd.c / diskio.h)                           |
|           disk_initialize, disk_status, disk_read, disk_write,           |
|           disk_ioctl, get_fattime (FAT packed timestamp).                |
+--------------------------------------------------------------------------+
                                    |
+--------------------------------------------------------------------------+
|  Layer 1: Low-Level SPI SD Card Peripheral Driver                        |
|           (sd_card_driver.h / sd_card_driver.c)                          |
|           CMD0, CMD8, CMD16, CMD17, CMD24, ACMD41, CMD58, CRC7 engine,  |
|           sector R/W (512B), card type detection, 25ms debounce.         |
+--------------------------------------------------------------------------+
```

---

## 4. Scan Record Storage Formats

All spectroscopy acquisition scans are stored inside the `/SCANS/` directory using standard 4-digit auto-incrementing filenames: `SCAN_xxxx.CSV` and `SCAN_xxxx.JSON`.

### 4.1 CSV Record Schema (`SCAN_xxxx.CSV`)

```csv
# AgriSpectra Optical Spectroscopy Record v2.1
Scan_ID,42
Timestamp,1732104000
Plant_Number,PLANT-042
Plant_Name,Roma Tomato
Pot_Number,POT-01
Crop_Variety,Roma Tomato
Zone,Zone 1
Dark_Calibrated,YES
White_Calibrated,YES
Raw_AS7265x_Counts_18ch,1240;1380;1510;1790;2100;2450;2890;3120;3450;3980;4210;4560;4980;5210;5670;6100;6450;6890
Interpolated_Spectrum_76bands,1100;1180;1260;1350;1460;1590;1740;1910;2100;2310;2540;2790;3060;3350;3660;3990;...
Payload_CRC32,0x9A4F32B1
```

### 4.2 JSON Record Schema (`SCAN_xxxx.JSON`)

```json
{
  "scanId": 42,
  "timestamp": 1732104000,
  "specimen": {
    "plantNumber": "PLANT-042",
    "plantName": "Roma Tomato",
    "potNumber": "POT-01",
    "cropVariety": "Roma Tomato",
    "zone": "Zone 1"
  },
  "calibration": {
    "darkCalibrated": true,
    "whiteCalibrated": true
  },
  "rawCounts": [
    1240, 1380, 1510, 1790, 2100, 2450, 2890, 3120, 3450, 
    3980, 4210, 4560, 4980, 5210, 5670, 6100, 6450, 6890
  ],
  "interpolatedSpectrum": [
    1100, 1180, 1260, 1350, 1460, 1590, 1740, 1910, 2100, 2310, 2540,
    2790, 3060, 3350, 3660, 3990, 4340, 4710, 5100, 5510, 5940, 6390
  ],
  "crc32": "0x9A4F32B1"
}
```

---

## 5. Security & Safety Hardening

1. **Strict Path Traversal Immunity:**
   - Any filename passed via BLE or serial CLI is vetted by `SD_Storage_ValidateScanFilename()`.
   - Characters `/`, `\`, `..`, leading periods, or null-bytes are immediately rejected.
   - Operations are strictly jailed to `/SCANS/<valid_scan_name>`.
2. **Active Optical Integration Concurrency Lock:**
   - During optical integration sweeps (`Sensor_HAL_ExecuteScan()`), the flag `s_scanInProgress` is raised.
   - While raised, any incoming SD file operation (reading, deleting, listing, copying) is blocked or deferred, ensuring zero SPI electrical noise or DMA latency interferes with photodiode integration.
3. **Capacity Pre-Check Before Writes & Copies:**
   - Before executing `SD_Storage_CopyScan()`, the manager verifies that available free space exceeds the target file size plus a mandatory 64 KB sector allocation safety margin.
4. **Active File Read Protection:**
   - If a file is currently being streamed over BLE in an active chunked session, requests to `SD_DELETE` that file are rejected with `SD_STORAGE_ERR_ACTIVE_FILE`.
5. **CRC32 End-to-End Verification:**
   - All scan records include an IEEE 802.3 standard polynomial (`0xEDB88320`) 32-bit CRC checksum for verifying flash and transmission integrity.

---

## 6. Two-Way BLE Wire Protocol Specification

All wire commands use standard ASCII CRLF framing:

| Command | Arguments | Mobile App Example | Firmware Response | Description |
|---|---|---|---|---|
| `SD_STATUS` | None | `SD_STATUS\r\n` | `$ACK:SD_STATUS,STATUS=OK,DETECTED=YES,MOUNTED=YES,FS=FAT32,TOTAL_MB=15200,USED_MB=120,FREE_MB=15080,FILES=42,LAST_ERR=NONE\r\n` | Interrogates SD card presence, filesystem type, total capacity, used space, free space, and file count. |
| `SD_LIST` | `[OFFSET] [LIMIT]` | `SD_LIST 0 10\r\n` | Streams `$SD_FILE:NAME=...,SIZE=...,TIME=...\r\n` entries, followed by `$ACK:SD_LIST,COUNT=10,TOTAL=42,OFFSET=0,LIMIT=10\r\n` | Lists scan files in `/SCANS/` with pagination. |
| `SD_INFO` | `[FILENAME]` | `SD_INFO SCAN_0042.CSV\r\n` | `$ACK:SD_INFO,STATUS=OK,NAME=SCAN_0042.CSV,SIZE=1840,CRC32=0x9A4F32B1,TIME=1732104000\r\n` | Queries size, creation timestamp, and CRC32 of a specific scan file. |
| `SD_READ` | `[FILENAME] [CHUNK_SIZE]` | `SD_READ SCAN_0042.CSV 128\r\n` | `$ACK:SD_READ,STATUS=OK,NAME=SCAN_0042.CSV,SIZE=1840,CHUNK_SIZE=128,TOTAL_CHUNKS=15,CRC32=0x9A4F32B1\r\n` | Initiates chunked reading session for BLE transfer. |
| `SD_CHUNK` | `[FILENAME] [SEQ]` | `SD_CHUNK SCAN_0042.CSV 1\r\n` | Emits `$SD_CHUNK:SEQ=1,LEN=128,CRC32=0x12345678,DATA=...\r\n`, then `$ACK:SD_CHUNK,STATUS=OK,SEQ=1,LEN=128,CRC32=0x12345678\r\n` | Transmits 16-bit sequence numbered file payload chunk. |
| `SD_DELETE`| `[FILENAME]` | `SD_DELETE SCAN_0042.CSV\r\n` | `$ACK:SD_DELETE,STATUS=DELETED,NAME=SCAN_0042.CSV\r\n` | Securely unlinks scan record from `/SCANS/`. |
| `SD_COPY` | `[FILENAME]` | `SD_COPY SCAN_0042.CSV\r\n` | `$ACK:SD_COPY,STATUS=COPIED,SOURCE=SCAN_0042.CSV,TARGET=SCAN_0042_COPY.CSV\r\n` | Duplicates scan file with disk capacity pre-check. |
| `SD_CANCEL`| None | `SD_CANCEL\r\n` | `$ACK:SD_CANCEL,STATUS=CANCELLED\r\n` | Aborts active chunked read stream and closes open file handle. |
| `SD_DIAG_CHECK` | None | `SD_DIAG_CHECK\r\n` | `$ACK:SD_DIAG_CHECK,STATUS=PASSED,SPEED_KBPS=1850,LATENCY_MS=4,CRC_MATCH=YES\r\n` | Executes write/flush/readback CRC verification on `/SCANS/TEST_PROBE.TMP`. |
| `SD_DIAG_READ` | None | `SD_DIAG_READ\r\n` | `$ACK:SD_DIAG_READ,STATUS=OK,SECTOR_0=READ_OK,SIZE=512\r\n` | Tests raw physical block sector 0 access. |
| `SD_DIAG_TEST_DEL` | None | `SD_DIAG_TEST_DEL\r\n` | `$ACK:SD_DIAG_TEST_DEL,TARGET=TEST_PROBE.TMP,STATUS=DELETED\r\n` | Cleans up and verifies unlinking of the diagnostic probe file. |
| `START_SCAN`| None | `START_SCAN\r\n` | Emits `$SPEC,...`, then `$ACK:START_SCAN,STATUS=OK,BANDS=76,SD=SAVED,FILE=SCAN_0043.CSV\r\n` | Executes optical integration and automatically persists scan to SD card. |

---

## 7. Diagnostic Self-Test & Non-Destructive Probe

The diagnostic routine operates on `/SCANS/TEST_PROBE.TMP`:
1. **Probe Creation:** Generates a deterministic 1024-byte test pattern.
2. **Write & Sync:** Writes the block to flash memory, forces cache synchronization, and measures elapsed write time in milliseconds.
3. **Readback & CRC Check:** Reads back the block into RAM and calculates its IEEE 802.3 CRC32 checksum. If it matches the original CRC, `CRC_MATCH=YES` is confirmed.
4. **Cleanup:** `SD_DIAG_TEST_DEL` unlinks the test probe file, leaving no orphaned remnants on the card.
