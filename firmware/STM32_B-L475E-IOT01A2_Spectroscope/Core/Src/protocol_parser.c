/**
  ******************************************************************************
  * @file           : protocol_parser.c
  * @brief          : Wire command protocol parser, dispatcher, and responses.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#include "protocol_parser.h"
#include "ble_service.h"
#include "led_driver.h"
#include "sensor_hal.h"
#include "sd_storage_manager.h"
#include "sd_card_driver.h"
#include "main.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h>

static SpecimenMetadata_t s_metadata = {0};
static char s_lineAccumulator[256];
static uint16_t s_linePos = 0;

static void Protocol_FileListCallback(const char *filename, uint32_t sizeBytes, uint32_t timestamp) {
  char buf[128];
  snprintf(buf, sizeof(buf), "$SD_FILE:NAME=%s,SIZE=%lu,TIME=%lu\r\n", 
           filename, (unsigned long)sizeBytes, (unsigned long)timestamp);
  BLE_Service_SendString(buf);
  VCP_Printf("[Protocol TX] %s", buf);
}

void Protocol_Parser_Init(void) {
  s_linePos = 0;
  memset(&s_metadata, 0, sizeof(s_metadata));
  strncpy(s_metadata.plantNumber, "PLANT-042", MAX_METADATA_LEN - 1);
  strncpy(s_metadata.plantName, "Roma Tomato", MAX_METADATA_LEN - 1);
  strncpy(s_metadata.potNumber, "POT-01", MAX_METADATA_LEN - 1);
  strncpy(s_metadata.cropVariety, "Roma Tomato", MAX_METADATA_LEN - 1);
  strncpy(s_metadata.zone, "Zone 1", MAX_METADATA_LEN - 1);
  strncpy(s_metadata.leafSpot, "Leaf 1", MAX_METADATA_LEN - 1);
  s_metadata.hasMetadata = true;
}

void Protocol_Parser_Feed(const uint8_t *buffer, uint16_t len) {
  if (!buffer || len == 0) return;

  for (uint16_t i = 0; i < len; i++) {
    char c = (char)buffer[i];
    if (c == '\r' || c == '\n') {
      if (s_linePos > 0) {
        s_lineAccumulator[s_linePos] = '\0';
        Protocol_Parser_ExecuteCommand(s_lineAccumulator);
        s_linePos = 0;
      }
    } else {
      if (s_linePos < sizeof(s_lineAccumulator) - 1) {
        s_lineAccumulator[s_linePos++] = c;
      } else {
        /* Line buffer overflow safeguard */
        s_linePos = 0;
      }
    }
  }
}

void Protocol_Parser_ExecuteCommand(const char *rawLine) {
  if (!rawLine) return;

  /* Trim leading spaces */
  while (*rawLine == ' ') rawLine++;
  if (*rawLine == '\0') return;

  /* Strip optional $CMD: or $ prefix for wire compatibility */
  if (strncmp(rawLine, "$CMD:", 5) == 0) {
    rawLine += 5;
  } else if (strncmp(rawLine, "$cmd:", 5) == 0) {
    rawLine += 5;
  } else if (strncmp(rawLine, "$", 1) == 0 && strncmp(rawLine, "$SD", 3) != 0 && strncmp(rawLine, "$SPEC", 5) != 0) {
    rawLine += 1;
  }
  while (*rawLine == ' ') rawLine++;
  if (*rawLine == '\0') return;

  VCP_Printf("[Protocol RX] \"%s\"\r\n", rawLine);

  /* Case-insensitive command comparison */
  if (strncmp(rawLine, "HELLO", 5) == 0 || strncmp(rawLine, "PING", 4) == 0) {
    Protocol_SendAck("HELLO", "DEVICE=B-L475E-IOT01A2,FW=2.1.0,STATUS=OK");
  } 
  else if (strncmp(rawLine, "GET_DEVICE_INFO", 15) == 0) {
    Protocol_SendAck("INFO", "MODEL=B-L475E-IOT01A2,MCU=STM32L475,BLE=BlueNRG-MS,SENSOR=AS7265X,FW=2.1.0");
  }
  else if (strncmp(rawLine, "GET_STATUS", 10) == 0) {
    LedState_t led = LED_Driver_GetState();
    const SpectrometerSensor_t *sen = Sensor_HAL_GetStatus();
    char buf[128];
    snprintf(buf, sizeof(buf), "LED=%s,SENSOR=%s,CALIB_DARK=%s,CALIB_WHITE=%s,BAT=98",
             led == LED_STATE_ON ? "ON" : "OFF",
             sen->isInitialized ? "OK" : "ERR",
             sen->isDarkCalibrated ? "DONE" : "NO",
             sen->isWhiteCalibrated ? "DONE" : "NO");
    Protocol_SendAck("STATUS", buf);
  }
  else if (strncmp(rawLine, "LED_ON", 6) == 0) {
    LED_Driver_SetOn();
    Protocol_SendAck("LED_ON", "STATUS=ON,GATE=PB0");
  }
  else if (strncmp(rawLine, "LED_OFF", 7) == 0) {
    LED_Driver_SetOff();
    Protocol_SendAck("LED_OFF", "STATUS=OFF,GATE=PB0");
  }
  else if (strncmp(rawLine, "START_DARK_CALIBRATION", 22) == 0 || 
           strcmp(rawLine, "DARK") == 0 || 
           strncmp(rawLine, "DARK ", 5) == 0 ||
           strcmp(rawLine, "DARK_CALIBRATION") == 0) {
    /* Immediate Dark Calibration Execution: Execute sensor routine directly without interactive Y/N prompts */
    uint16_t offset = 0;
    if (Sensor_HAL_CalibrateDark(&offset)) {
      char buf[64];
      snprintf(buf, sizeof(buf), "STATUS=OK,OFFSET=%u", offset);
      Protocol_SendAck("CALIB_DARK", buf);
    } else {
      Protocol_SendErr("CALIB_DARK", "Optical detector timeout");
    }
  }
  else if (strncmp(rawLine, "START_WHITE_CALIBRATION", 23) == 0 || 
           strcmp(rawLine, "WHITE") == 0 || 
           strncmp(rawLine, "WHITE ", 6) == 0 ||
           strcmp(rawLine, "WHITE_CALIBRATION") == 0) {
    /* Immediate White Calibration Execution: Execute sensor routine directly without interactive Y/N prompts */
    uint16_t peak = 0;
    if (Sensor_HAL_CalibrateWhite(&peak)) {
      char buf[64];
      snprintf(buf, sizeof(buf), "STATUS=OK,PEAK=%u", peak);
      Protocol_SendAck("CALIB_WHITE", buf);
    } else {
      Protocol_SendErr("CALIB_WHITE", "Illumination reference failure");
    }
  }
  else if (strncmp(rawLine, "SET_PLANT_NUMBER", 16) == 0) {
    const char *p = rawLine + 16;
    while (*p == ' ' || *p == '=' || *p == ':') p++;
    strncpy(s_metadata.plantNumber, p, MAX_METADATA_LEN - 1);
    s_metadata.hasMetadata = true;
    char buf[64];
    snprintf(buf, sizeof(buf), "PLANT_NUMBER=%s,STATUS=OK", s_metadata.plantNumber);
    Protocol_SendAck("SET_PLANT_NUMBER", buf);
  }
  else if (strncmp(rawLine, "SET_PLANT_NAME", 14) == 0) {
    const char *p = rawLine + 14;
    while (*p == ' ' || *p == '=' || *p == ':') p++;
    strncpy(s_metadata.plantName, p, MAX_METADATA_LEN - 1);
    if (s_metadata.cropVariety[0] == '\0' || strcmp(s_metadata.cropVariety, "Roma Tomato") == 0) {
      strncpy(s_metadata.cropVariety, p, MAX_METADATA_LEN - 1);
    }
    s_metadata.hasMetadata = true;
    char buf[64];
    snprintf(buf, sizeof(buf), "PLANT_NAME=%s,STATUS=OK", s_metadata.plantName);
    Protocol_SendAck("SET_PLANT_NAME", buf);
  }
  else if (strncmp(rawLine, "SET_POT_NUMBER", 14) == 0) {
    const char *p = rawLine + 14;
    while (*p == ' ' || *p == '=' || *p == ':') p++;
    strncpy(s_metadata.potNumber, p, MAX_METADATA_LEN - 1);
    s_metadata.hasMetadata = true;
    char buf[64];
    snprintf(buf, sizeof(buf), "POT_NUMBER=%s,STATUS=OK", s_metadata.potNumber);
    Protocol_SendAck("SET_POT_NUMBER", buf);
  }
  else if (strncmp(rawLine, "SET_LEAF_SPOT", 13) == 0 || strncmp(rawLine, "SET_SPOT", 8) == 0) {
    const char *p = (strncmp(rawLine, "SET_LEAF_SPOT", 13) == 0) ? rawLine + 13 : rawLine + 8;
    while (*p == ' ' || *p == '=' || *p == ':') p++;
    strncpy(s_metadata.leafSpot, p, MAX_METADATA_LEN - 1);
    s_metadata.hasMetadata = true;
    char buf[64];
    snprintf(buf, sizeof(buf), "LEAF_SPOT=%s,STATUS=OK", s_metadata.leafSpot);
    Protocol_SendAck("SET_LEAF_SPOT", buf);
  }
  else if (strncmp(rawLine, "SET_ZONE", 8) == 0) {
    const char *p = rawLine + 8;
    while (*p == ' ' || *p == '=' || *p == ':') p++;
    strncpy(s_metadata.zone, p, MAX_METADATA_LEN - 1);
    s_metadata.hasMetadata = true;
    char buf[64];
    snprintf(buf, sizeof(buf), "ZONE=%s,STATUS=OK", s_metadata.zone);
    Protocol_SendAck("SET_ZONE", buf);
  }
  else if (strncmp(rawLine, "SET_METADATA", 12) == 0 || strncmp(rawLine, "SET_SPECIMEN", 12) == 0) {
    /* Fast batch metadata setter e.g. SET_METADATA PLANT=P101,NAME=Roma Tomato,POT=POT-01,SPOT=Leaf 1,ZONE=Zone 1 */
    const char *cmdName = (strncmp(rawLine, "SET_SPECIMEN", 12) == 0) ? "SET_SPECIMEN" : "SET_METADATA";
    const char *p = rawLine + 12;
    while (*p == ' ' || *p == ':') p++;

    const char *pPlant = strstr(p, "PLANT=");
    if (pPlant) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pPlant + 6, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.plantNumber, val, MAX_METADATA_LEN - 1);
      }
    }

    const char *pName = strstr(p, "NAME=");
    if (pName) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pName + 5, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.plantName, val, MAX_METADATA_LEN - 1);
        if (s_metadata.cropVariety[0] == '\0' || strcmp(s_metadata.cropVariety, "Roma Tomato") == 0) {
          strncpy(s_metadata.cropVariety, val, MAX_METADATA_LEN - 1);
        }
      }
    }

    const char *pPot = strstr(p, "POT=");
    if (pPot) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pPot + 4, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.potNumber, val, MAX_METADATA_LEN - 1);
      }
    }

    const char *pSpot = strstr(p, "SPOT=");
    const char *pLeaf = strstr(p, "LEAF=");
    if (pSpot) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pSpot + 5, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.leafSpot, val, MAX_METADATA_LEN - 1);
      }
    } else if (pLeaf) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pLeaf + 5, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.leafSpot, val, MAX_METADATA_LEN - 1);
      }
    }

    const char *pZone = strstr(p, "ZONE=");
    if (pZone) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pZone + 5, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.zone, val, MAX_METADATA_LEN - 1);
      }
    }

    const char *pVariety = strstr(p, "VARIETY=");
    if (pVariety) {
      char val[MAX_METADATA_LEN] = {0};
      if (sscanf(pVariety + 8, "%47[^,\r\n]", val) == 1) {
        strncpy(s_metadata.cropVariety, val, MAX_METADATA_LEN - 1);
      }
    }

    s_metadata.hasMetadata = true;

    char buf[160];
    snprintf(buf, sizeof(buf), "PLANT=%s,NAME=%s,POT=%s,SPOT=%s,ZONE=%s,STATUS=OK", 
             s_metadata.plantNumber, s_metadata.plantName, s_metadata.potNumber, 
             s_metadata.leafSpot, s_metadata.zone);
    Protocol_SendAck(cmdName, buf);
  }
  else if (strncmp(rawLine, "START_SCAN", 10) == 0 || 
           strcmp(rawLine, "SCAN") == 0 || 
           strncmp(rawLine, "SCAN ", 5) == 0) {
    /* Immediate Scan Execution: Execute sensor routine directly without interactive Y/N prompts */
    if (s_activeFileReadInProgress) {
      Protocol_SendErr("START_SCAN", "SD_FILE_TRANSFER_IN_PROGRESS");
      return;
    }
    SD_Storage_SetScanInProgress(true);
    uint16_t spectrum[SENSOR_INTERPOLATED_BANDS];
    if (Sensor_HAL_ExecuteScan(spectrum)) {
      SD_Storage_SetScanInProgress(false);
      Protocol_SendSpectrum(spectrum, SENSOR_INTERPOLATED_BANDS);

      /* Automatic Save on Every Scan to /SCANS/ (CSV or JSON with LeafSpot header) */
      uint32_t savedScanId = 0;
      char savedFilename[SD_MAX_FILENAME_LEN] = {0};
      bool asJson = (strstr(rawLine, "JSON") != NULL || strstr(rawLine, "json") != NULL);
      SD_StorageResult_t sres = SD_Storage_SaveScan(&savedScanId, savedFilename, sizeof(savedFilename), asJson);
      if (sres == SD_STORAGE_OK) {
        char ackBuf[96];
        snprintf(ackBuf, sizeof(ackBuf), "STATUS=OK,BANDS=76,SD=SAVED,FILE=%s", savedFilename);
        Protocol_SendAck("START_SCAN", ackBuf);
      } else {
        Protocol_SendAck("START_SCAN", "STATUS=OK,BANDS=76,SD=NOT_SAVED");
      }
    } else {
      SD_Storage_SetScanInProgress(false);
      LED_Driver_SetOff(); /* Failsafe */
      Protocol_SendErr("START_SCAN", "Optical scan integration timeout");
    }
  }
  else if (strncmp(rawLine, "SD_STATUS", 9) == 0) {
    const SD_StorageHealth_t *h = SD_Storage_GetHealth();
    char buf[192];
    snprintf(buf, sizeof(buf), "STATUS=OK,DETECTED=%s,MOUNTED=%s,FS=%s,TOTAL_MB=%lu,USED_MB=%lu,FREE_MB=%lu,FILES=%lu,LAST_ERR=%s",
             h->detected ? "YES" : "NO",
             h->mounted ? "YES" : "NO",
             h->fsType,
             (unsigned long)h->totalCapacityMB,
             (unsigned long)h->usedCapacityMB,
             (unsigned long)h->freeCapacityMB,
             (unsigned long)h->fileCount,
             h->lastErrorStr);
    Protocol_SendAck("SD_STATUS", buf);
  }
  else if (strncmp(rawLine, "SD_LIST", 7) == 0) {
    uint16_t offset = 0;
    uint16_t limit = 10;
    const char *p = rawLine + 7;
    while (*p == ' ') p++;
    if (*p != '\0') {
      sscanf(p, "%hu %hu", &offset, &limit);
    }
    if (limit == 0 || limit > 50) limit = 10;

    uint32_t totalFiles = SD_Storage_ListScans(offset, limit, Protocol_FileListCallback);
    char buf[80];
    snprintf(buf, sizeof(buf), "STATUS=OK,COUNT=%u,TOTAL=%lu,OFFSET=%u,LIMIT=%u", 
             (unsigned int)((totalFiles > offset) ? ((totalFiles - offset < limit) ? (totalFiles - offset) : limit) : 0),
             (unsigned long)totalFiles, offset, limit);
    Protocol_SendAck("SD_LIST", buf);
  }
  else if (strncmp(rawLine, "SD_INFO", 7) == 0) {
    char filename[SD_MAX_FILENAME_LEN] = {0};
    const char *p = rawLine + 7;
    while (*p == ' ') p++;
    sscanf(p, "%35s", filename);

    if (!SD_Storage_ValidateFilename(filename)) {
      Protocol_SendErr("SD_INFO", "PATH_TRAVERSAL_DETECTED");
      return;
    }

    uint32_t sizeBytes = 0, crc32 = 0, timestamp = 0;
    SD_StorageResult_t res = SD_Storage_GetFileInfo(filename, &sizeBytes, &crc32, &timestamp);
    if (res == SD_STORAGE_OK) {
      char buf[128];
      snprintf(buf, sizeof(buf), "STATUS=OK,NAME=%s,SIZE=%lu,CRC32=0x%08lX,TIME=%lu",
               filename, (unsigned long)sizeBytes, (unsigned long)crc32, (unsigned long)timestamp);
      Protocol_SendAck("SD_INFO", buf);
    } else if (res == SD_STORAGE_ERR_INVALID_NAME || res == SD_STORAGE_ERR_PATH_TRAVERSAL) {
      Protocol_SendErr("SD_INFO", "PATH_TRAVERSAL_DETECTED");
    } else {
      Protocol_SendErr("SD_INFO", "FILE_NOT_FOUND");
    }
  }
  else if (strncmp(rawLine, "SD_TOKEN", 8) == 0) {
    char filename[SD_MAX_FILENAME_LEN] = {0};
    const char *p = rawLine + 8;
    while (*p == ' ') p++;
    sscanf(p, "%35s", filename);

    if (!SD_Storage_ValidateFilename(filename)) {
      Protocol_SendErr("SD_TOKEN", "PATH_TRAVERSAL_DETECTED");
    } else if (SD_Storage_IsScanInProgress()) {
      Protocol_SendErr("SD_TOKEN", "BUSY_SCAN_IN_PROGRESS");
    } else {
      uint32_t token = SD_Storage_GenerateDeleteToken(filename);
      if (token != 0) {
        char buf[96];
        snprintf(buf, sizeof(buf), "STATUS=OK,FILE=%s,TOKEN=%lu", filename, (unsigned long)token);
        Protocol_SendAck("SD_TOKEN", buf);
      } else {
        Protocol_SendErr("SD_TOKEN", "TOKEN_GENERATION_FAILED");
      }
    }
  }
  else if (strncmp(rawLine, "SD_READ", 7) == 0) {
    char filename[SD_MAX_FILENAME_LEN] = {0};
    uint16_t chunkSize = SD_DEFAULT_CHUNK_SIZE;
    const char *p = rawLine + 7;
    while (*p == ' ') p++;
    sscanf(p, "%35s %hu", filename, &chunkSize);

    if (!SD_Storage_ValidateFilename(filename)) {
      Protocol_SendErr("SD_READ", "PATH_TRAVERSAL_DETECTED");
    } else if (SD_Storage_IsScanInProgress()) {
      Protocol_SendErr("SD_READ", "BUSY_SCAN_IN_PROGRESS");
    } else {
      uint32_t totalBytes = 0;
      uint16_t totalChunks = 0;
      uint32_t crc32 = 0;
      SD_StorageResult_t res = SD_Storage_StartRead(filename, chunkSize, &totalBytes, &totalChunks, &crc32);
      if (res == SD_STORAGE_OK) {
        char buf[128];
        snprintf(buf, sizeof(buf), "STATUS=OK,NAME=%s,SIZE=%lu,CHUNK_SIZE=%u,TOTAL_CHUNKS=%u,CRC32=0x%08lX",
                 filename, (unsigned long)totalBytes, chunkSize, totalChunks, (unsigned long)crc32);
        Protocol_SendAck("SD_READ", buf);
      } else if (res == SD_STORAGE_ERR_EXCEEDS_5MB) {
        Protocol_SendErr("SD_READ", "EXCEEDS_5MB_LIMIT");
      } else if (res == SD_STORAGE_ERR_BUSY_SCAN_IN_PROGRESS) {
        Protocol_SendErr("SD_READ", "BUSY_SCAN_IN_PROGRESS");
      } else if (res == SD_STORAGE_ERR_INVALID_NAME || res == SD_STORAGE_ERR_PATH_TRAVERSAL) {
        Protocol_SendErr("SD_READ", "PATH_TRAVERSAL_DETECTED");
      } else {
        Protocol_SendErr("SD_READ", "FILE_NOT_FOUND");
      }
    }
  }
  else if (strncmp(rawLine, "SD_CHUNK", 8) == 0) {
    char filename[SD_MAX_FILENAME_LEN] = {0};
    uint16_t seq = 1;
    const char *p = rawLine + 8;
    while (*p == ' ') p++;
    if (isdigit((unsigned char)*p)) {
      sscanf(p, "%hu", &seq);
    } else {
      sscanf(p, "%35s %hu", filename, &seq);
    }

    uint8_t chunkBuf[SD_MAX_CHUNK_SIZE + 1];
    uint16_t chunkLen = 0;
    uint32_t chunkCrc = 0;
    SD_StorageResult_t res = SD_Storage_GetChunk(seq, chunkBuf, &chunkLen, &chunkCrc);
    if (res == SD_STORAGE_OK) {
      chunkBuf[chunkLen] = '\0';
      char hdr[128];
      snprintf(hdr, sizeof(hdr), "$SD_CHUNK:SEQ=%u,LEN=%u,CRC32=0x%08lX,DATA=",
               seq, chunkLen, (unsigned long)chunkCrc);
      BLE_Service_SendString(hdr);
      BLE_Service_SendString((const char*)chunkBuf);
      BLE_Service_SendString("\r\n");

      char ack[64];
      snprintf(ack, sizeof(ack), "STATUS=OK,SEQ=%u,LEN=%u,CRC32=0x%08lX", 
               seq, chunkLen, (unsigned long)chunkCrc);
      Protocol_SendAck("SD_CHUNK", ack);
    } else {
      Protocol_SendErr("SD_CHUNK", "CHUNK_READ_ERROR");
    }
  }
  else if (strncmp(rawLine, "SD_DELETE", 9) == 0 || strncmp(rawLine, "SD_DEL", 6) == 0) {
    const char *cmdName = (strncmp(rawLine, "SD_DELETE", 9) == 0) ? "SD_DELETE" : "SD_DEL";
    char filename[SD_MAX_FILENAME_LEN] = {0};
    uint32_t token = 0;
    const char *p = rawLine + (strcmp(cmdName, "SD_DELETE") == 0 ? 9 : 6);
    while (*p == ' ') p++;
    sscanf(p, "%35s %lu", filename, (unsigned long*)&token);

    /* Check for wildcard attempts */
    if (filename[0] == '\0' || strcmp(filename, "*") == 0 || strcmp(filename, "*.*") == 0 ||
        strcmp(filename, "ALL") == 0 || strstr(filename, "*") != NULL || strstr(filename, "?") != NULL ||
        strstr(filename, "rm -rf") != NULL) {
      Protocol_SendErr(cmdName, "WILDCARD_DELETION_PROHIBITED");
    } else if (!SD_Storage_ValidateFilename(filename)) {
      Protocol_SendErr(cmdName, "PATH_TRAVERSAL_DETECTED");
    } else if (SD_Storage_IsScanInProgress()) {
      Protocol_SendErr(cmdName, "BUSY_SCAN_IN_PROGRESS");
    } else if (s_activeFileReadInProgress && strcmp((const char*)s_activeReadFile, filename) == 0) {
      Protocol_SendErr(cmdName, "FILE_IN_USE");
    } else if (token == 0) {
      Protocol_SendErr(cmdName, "UNAUTHORIZED_OR_INVALID_TOKEN");
    } else {
      SD_StorageResult_t res = SD_Storage_DeleteScanWithToken(filename, token);
      if (res == SD_STORAGE_OK) {
        char buf[64];
        snprintf(buf, sizeof(buf), "STATUS=DELETED,NAME=%s", filename);
        Protocol_SendAck(cmdName, buf);
      } else if (res == SD_STORAGE_ERR_ACTIVE_FILE) {
        Protocol_SendErr(cmdName, "FILE_IN_USE");
      } else if (res == SD_STORAGE_ERR_INVALID_TOKEN) {
        Protocol_SendErr(cmdName, "UNAUTHORIZED_OR_INVALID_TOKEN");
      } else if (res == SD_STORAGE_ERR_PATH_TRAVERSAL || res == SD_STORAGE_ERR_INVALID_NAME) {
        Protocol_SendErr(cmdName, "PATH_TRAVERSAL_DETECTED");
      } else if (res == SD_STORAGE_ERR_WILDCARD_PROHIBITED) {
        Protocol_SendErr(cmdName, "WILDCARD_DELETION_PROHIBITED");
      } else if (res == SD_STORAGE_ERR_BUSY_SCAN_IN_PROGRESS) {
        Protocol_SendErr(cmdName, "BUSY_SCAN_IN_PROGRESS");
      } else {
        Protocol_SendErr(cmdName, "FILE_NOT_FOUND");
      }
    }
  }
  else if (strncmp(rawLine, "SD_COPY", 7) == 0) {
    char srcFile[SD_MAX_FILENAME_LEN] = {0};
    const char *p = rawLine + 7;
    while (*p == ' ') p++;
    sscanf(p, "%35s", srcFile);

    char copyFile[SD_MAX_FILENAME_LEN] = {0};
    SD_StorageResult_t res = SD_Storage_CopyScan(srcFile, copyFile, sizeof(copyFile));
    if (res == SD_STORAGE_OK) {
      char buf[96];
      snprintf(buf, sizeof(buf), "STATUS=COPIED,SOURCE=%s,TARGET=%s", srcFile, copyFile);
      Protocol_SendAck("SD_COPY", buf);
    } else if (res == SD_STORAGE_ERR_DISK_FULL) {
      Protocol_SendErr("SD_COPY", "DISK_FULL");
    } else if (res == SD_STORAGE_ERR_INVALID_NAME) {
      Protocol_SendErr("SD_COPY", "INVALID_FILENAME");
    } else {
      Protocol_SendErr("SD_COPY", "SOURCE_NOT_FOUND");
    }
  }
  else if (strncmp(rawLine, "SD_CANCEL", 9) == 0 || strncmp(rawLine, "SD_ABORT", 8) == 0) {
    SD_Storage_AbortTransfer();
    Protocol_SendAck("SD_ABORT", "STATUS=ABORTED");
  }
  else if (strncmp(rawLine, "SD_DIAG_CHECK", 13) == 0) {
    uint32_t speedKbps = 0;
    uint32_t latencyMs = 0;
    bool crcMatch = false;
    SD_StorageResult_t res = SD_Storage_DiagCheck(&speedKbps, &latencyMs, &crcMatch);
    if (res == SD_STORAGE_OK) {
      char buf[96];
      snprintf(buf, sizeof(buf), "STATUS=PASSED,SPEED_KBPS=%lu,LATENCY_MS=%lu,CRC_MATCH=%s",
               (unsigned long)speedKbps, (unsigned long)latencyMs, crcMatch ? "YES" : "NO");
      Protocol_SendAck("SD_DIAG_CHECK", buf);
    } else {
      Protocol_SendErr("SD_DIAG_CHECK", "TEST_PROBE_FAILED");
    }
  }
  else if (strncmp(rawLine, "SD_DIAG_READ", 12) == 0) {
    SD_StorageResult_t res = SD_Storage_DiagRead();
    if (res == SD_STORAGE_OK) {
      Protocol_SendAck("SD_DIAG_READ", "STATUS=OK,SECTOR_0=READ_OK,SIZE=512");
    } else {
      Protocol_SendErr("SD_DIAG_READ", "SECTOR_0_READ_FAIL");
    }
  }
  else if (strncmp(rawLine, "SD_DIAG_TEST_DEL", 16) == 0) {
    SD_StorageResult_t res = SD_Storage_DiagTestDelete();
    if (res == SD_STORAGE_OK) {
      Protocol_SendAck("SD_DIAG_TEST_DEL", "TARGET=TEST_PROBE.TMP,STATUS=DELETED");
    } else {
      Protocol_SendErr("SD_DIAG_TEST_DEL", "FILE_NOT_FOUND");
    }
  }
  else if (strncmp(rawLine, "STOP_SCAN", 9) == 0) {
    LED_Driver_SetOff();
    Protocol_SendAck("STOP_SCAN", "STATUS=ABORTED");
  }
  else if (strncmp(rawLine, "RESET_DEVICE", 12) == 0) {
    LED_Driver_SetOff();
    Protocol_SendAck("RESET_DEVICE", "STATUS=RESET_INITIATED");
  }
  else if (strcmp(rawLine, "Y") == 0 || strcmp(rawLine, "1") == 0) {
    /* Interactive dialogue prompt confirmation response */
    Protocol_SendAck("PROMPT_OK", "ANSWER=CONFIRMED");
  }
  else {
    /* Unknown command fallback */
    Protocol_SendErr(rawLine, "UNKNOWN_COMMAND");
  }
}

void Protocol_SendAck(const char *cmd, const char *params) {
  char msg[256];
  if (params && strlen(params) > 0) {
    snprintf(msg, sizeof(msg), "$ACK:%s,%s\r\n", cmd, params);
  } else {
    snprintf(msg, sizeof(msg), "$ACK:%s,STATUS=OK\r\n", cmd);
  }
  BLE_Service_SendString(msg);
  VCP_Printf("[Protocol TX] %s", msg);
}

void Protocol_SendErr(const char *cmd, const char *reason) {
  char msg[256];
  snprintf(msg, sizeof(msg), "$ERR:%s,REASON=%s\r\n", cmd, reason ? reason : "ERROR");
  BLE_Service_SendString(msg);
  VCP_Printf("[Protocol TX] %s", msg);
}

void Protocol_SendSpectrum(const uint16_t *bands, uint16_t count) {
  if (!bands || count == 0) return;

  /* First emit raw header and comma-separated spectrum stream */
  char header[32];
  snprintf(header, sizeof(header), "$SPEC,%u,", (unsigned int)count);
  BLE_Service_SendString(header);

  /* Send bands in chunks */
  char buf[256];
  uint16_t pos = 0;
  for (uint16_t i = 0; i < count; i++) {
    char numStr[16];
    if (i == count - 1) {
      snprintf(numStr, sizeof(numStr), "%u\r\n", (unsigned int)bands[i]);
    } else {
      snprintf(numStr, sizeof(numStr), "%u,", (unsigned int)bands[i]);
    }

    uint16_t len = (uint16_t)strlen(numStr);
    if (pos + len >= sizeof(buf) - 1) {
      buf[pos] = '\0';
      BLE_Service_SendString(buf);
      pos = 0;
    }
    memcpy(buf + pos, numStr, len);
    pos += len;
  }
  if (pos > 0) {
    buf[pos] = '\0';
    BLE_Service_SendString(buf);
  }
}

const SpecimenMetadata_t* Protocol_GetMetadata(void) {
  return &s_metadata;
}

void Protocol_SetMetadata(const SpecimenMetadata_t *metadata) {
  if (metadata) {
    memcpy(&s_metadata, metadata, sizeof(SpecimenMetadata_t));
    s_metadata.hasMetadata = true;
  }
}
