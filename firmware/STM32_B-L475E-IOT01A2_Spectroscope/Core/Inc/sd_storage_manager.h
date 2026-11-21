/**
  ******************************************************************************
  * @file           : sd_storage_manager.h
  * @brief          : Header for Secure SD Card Storage & File Explorer HAL.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  * 
  * 6-ROUND ADVERSARIAL PENETRATION RESISTANCE & DEFENSE SPECIFICATION:
  *   ROUND 1: Path Traversal & Arbitrary File Access Defense
  *            - Strict whitelist regex: ^[a-zA-Z0-9_-]{1,32}\.(CSV|csv|JSON|json)$
  *            - Sandboxed to canonical /SCANS/ jail. Rejects '..', '/', '\', '\0', '%2e', '%2f'.
  *   ROUND 2: Buffer Overflow, Packet Injection & Memory Corruption Defense
  *            - Payload bounds checking (<= 512 bytes / MTU limit).
  *            - Sequence monotonicity checking (strictly 0 to totalChunks - 1).
  *            - IEEE 802.3 CRC32 verification on chunks and assembled files.
  *            - Hard 5MB maximum file size limit (5,242,880 bytes).
  *   ROUND 3: Concurrency Race Conditions & Collision Attacks Defense
  *            - Atomic state locking (s_fsLock, s_activeScanInProgress).
  *            - Rejects conflicting operations with BUSY_SCAN_IN_PROGRESS or FILE_IN_USE.
  *   ROUND 4: Unauthorized / Replayed Destructive Commands Defense
  *            - 32-bit single-use confirmation tokens with 30s TTL.
  *            - Connection state validation.
  *            - Wildcard deletion strictly prohibited (no *.*, *, ALL, rm -rf).
  *   ROUND 5: Data System Isolation (Zero Contamination)
  *            - Transient volatile memory only; never touches flash NVRAM or cloud sync queues.
  *   ROUND 6: BLE Adversarial Disconnection & Hardware Removal Defense
  *            - Graceful transfer abort and instant buffer deallocation.
  *            - Clean unmount on card removal without FAT corruptions.
  ******************************************************************************
  */

#ifndef __SD_STORAGE_MANAGER_H
#define __SD_STORAGE_MANAGER_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include "protocol_parser.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Constants and Limits */
#define SD_SCANS_DIRECTORY             "/SCANS"
#define SD_MAX_FILENAME_LEN            36U   /* 32 chars name + .ext + null */
#define SD_MAX_PATH_LEN                64U   /* /SCANS/ + filename */
#define SD_DEFAULT_CHUNK_SIZE          128U
#define SD_MAX_CHUNK_SIZE              240U  /* Fits inside 247 MTU NUS notification */
#define SD_MAX_FILE_SIZE               (5U * 1024U * 1024U) /* 5MB Hard Cap */
#define SD_TOKEN_LIFETIME_MS           30000U /* 30 seconds expiration for delete tokens */

/* Unified Status and Error Result Codes */
typedef enum {
  SD_STORAGE_OK                        = 0,
  SD_STORAGE_ERR_NOT_MOUNTED           = 1,
  SD_STORAGE_ERR_BUSY                  = 2,
  SD_STORAGE_ERR_BUSY_SCAN_IN_PROGRESS = 3,
  SD_STORAGE_ERR_ACTIVE_FILE           = 4,
  SD_STORAGE_ERR_INVALID_NAME          = 5,
  SD_STORAGE_ERR_PATH_TRAVERSAL        = 6,
  SD_STORAGE_ERR_FILE_NOT_FOUND        = 7,
  SD_STORAGE_ERR_DISK_FULL             = 8,
  SD_STORAGE_ERR_EXCEEDS_5MB           = 9,
  SD_STORAGE_ERR_INVALID_TOKEN         = 10,
  SD_STORAGE_ERR_WILDCARD_PROHIBITED   = 11,
  SD_STORAGE_ERR_SECURITY_VIOLATION    = 12,
  SD_STORAGE_ERR_CHUNK_OUT_OF_BOUNDS   = 13,
  SD_STORAGE_ERR_CRC_MISMATCH          = 14,
  SD_STORAGE_ERR_CARD_REMOVED          = 15,
  SD_STORAGE_ERR_IO_FAILURE            = 16
} SD_StorageResult_t;

/* Backward-compatibility alias */
typedef SD_StorageResult_t SdStorageStatus_t;

typedef struct {
  char filename[SD_MAX_FILENAME_LEN];
  uint32_t sizeBytes;
  uint32_t timestamp;
  uint32_t crc32;
} SdFileInfo_t;

typedef struct {
  bool detected;
  bool mounted;
  char fsType[8];
  uint32_t totalCapacityMB;
  uint32_t usedCapacityMB;
  uint32_t freeCapacityMB;
  uint32_t fileCount;
  char lastErrorStr[32];
} SD_StorageHealth_t;

typedef void (*SD_FileListCallback_t)(const char *filename, uint32_t sizeBytes, uint32_t timestamp);

/* Global Atomic State Locks */
extern volatile bool s_fsLock;
extern volatile bool s_activeScanInProgress;
extern volatile bool s_activeFileReadInProgress;
extern volatile char s_activeReadFile[SD_MAX_FILENAME_LEN];

/**
  * @brief  Initialize SD storage subsystem, mock FATFS structures, and lock states.
  */
SD_StorageResult_t SD_Storage_Init(void);

/**
  * @brief  Validate filename strictly against whitelist regex:
  *         ^[a-zA-Z0-9_-]{1,32}\.(CSV|csv|JSON|json)$
  *         Rejects '..', '/', '\', null bytes, URL encoded sequences, and control chars.
  */
bool SD_Storage_ValidateFilename(const char *filename);

/**
  * @brief  Build and canonicalize full path within /SCANS/ sandbox.
  */
bool SD_Storage_BuildCanonicalPath(const char *filename, char *outPath, size_t maxLen);

/**
  * @brief  Retrieve health and capacity statistics.
  */
const SD_StorageHealth_t* SD_Storage_GetHealth(void);

/**
  * @brief  Format CSV scan file header with specimen metadata including LeafSpot.
  *         Outputs: "# LeafSpot: <leafSpot>"
  * @param  outBuf Destination character buffer.
  * @param  maxLen Size of destination buffer.
  * @param  scanId Sequential scan identifier.
  * @param  meta Pointer to active specimen metadata.
  * @retval Length of written header in bytes.
  */
size_t SD_Storage_FormatCsvHeader(char *outBuf, size_t maxLen, uint32_t scanId, const SpecimenMetadata_t *meta);

/**
  * @brief  Format JSON scan file header / metadata with specimen metadata including LeafSpot.
  *         Outputs: "\"leafSpot\": \"<leafSpot>\""
  * @param  outBuf Destination character buffer.
  * @param  maxLen Size of destination buffer.
  * @param  scanId Sequential scan identifier.
  * @param  meta Pointer to active specimen metadata.
  * @retval Length of written JSON in bytes.
  */
size_t SD_Storage_FormatJsonHeader(char *outBuf, size_t maxLen, uint32_t scanId, const SpecimenMetadata_t *meta);

/**
  * @brief  Automatically save an acquired scan into /SCANS/ (default CSV format).
  */
SD_StorageResult_t SD_Storage_AutoSaveScan(uint32_t *outScanId, char *outFilename, size_t filenameBufSize);

/**
  * @brief  Automatically save an acquired scan into /SCANS/ in JSON format.
  */
SD_StorageResult_t SD_Storage_AutoSaveScanJson(uint32_t *outScanId, char *outFilename, size_t filenameBufSize);

/**
  * @brief  Save scan file in CSV or JSON format with complete metadata headers.
  */
SD_StorageResult_t SD_Storage_SaveScan(uint32_t *outScanId, char *outFilename, size_t filenameBufSize, bool asJson);

/**
  * @brief  List scans with pagination and stream via callback.
  */
uint32_t SD_Storage_ListScans(uint16_t offset, uint16_t limit, SD_FileListCallback_t callback);

/**
  * @brief  List all files contained in /SCANS/ directory directly into array.
  */
SD_StorageResult_t SD_Storage_ListFiles(SdFileInfo_t *files, uint16_t maxFiles, uint16_t *outCount);

/**
  * @brief  Get file metadata by filename.
  */
SD_StorageResult_t SD_Storage_GetFileInfo(const char *filename, uint32_t *sizeBytes, uint32_t *crc32, uint32_t *timestamp);

/**
  * @brief  Start chunked file read session.
  */
SD_StorageResult_t SD_Storage_StartRead(const char *filename, uint16_t chunkSize, uint32_t *totalBytes, uint16_t *totalChunks, uint32_t *crc32);

/**
  * @brief  Get specific chunk by sequence number (1-indexed or 0-indexed supported).
  */
SD_StorageResult_t SD_Storage_GetChunk(uint16_t seq, uint8_t *outBuf, uint16_t *outLen, uint32_t *outCrc);

/**
  * @brief  Cancel and reset active read session.
  */
void SD_Storage_CancelRead(void);
void SD_Storage_AbortTransfer(void);

/**
  * @brief  Generate a cryptographically-seeded 32-bit confirmation token for file deletion.
  */
uint32_t SD_Storage_GenerateDeleteToken(const char *filename);
uint32_t SD_Storage_GenerateToken(const char *filename);

/**
  * @brief  Delete file with explicit token verification.
  */
SD_StorageResult_t SD_Storage_DeleteScanWithToken(const char *filename, uint32_t confirmationToken);
SD_StorageResult_t SD_Storage_DeleteScan(const char *filename);
SD_StorageResult_t SD_Storage_DeleteFile(const char *filename, uint32_t confirmationToken);

/**
  * @brief  Copy scan file to duplicate name.
  */
SD_StorageResult_t SD_Storage_CopyScan(const char *srcFilename, char *outTargetFilename, size_t targetBufSize);

/**
  * @brief  Diagnostic test probes.
  */
SD_StorageResult_t SD_Storage_DiagCheck(uint32_t *speedKbps, uint32_t *latencyMs, bool *crcMatch);
SD_StorageResult_t SD_Storage_DiagRead(void);
SD_StorageResult_t SD_Storage_DiagTestDelete(void);

/**
  * @brief  Concurrency interlock with optical sensor scan acquisition.
  */
void SD_Storage_SetScanInProgress(bool inProgress);
bool SD_Storage_IsScanInProgress(void);

/**
  * @brief  Card status & removal handlers.
  */
SD_StorageResult_t SD_Storage_GetCardStatus(bool *cardPresent, uint64_t *totalBytes, uint64_t *freeBytes);
void SD_Storage_HandleRemoval(void);
void SD_Storage_HandleInsertion(void);
uint32_t SD_Storage_ComputeCRC32(const uint8_t *data, size_t length);

#ifdef __cplusplus
}
#endif

#endif /* __SD_STORAGE_MANAGER_H */
