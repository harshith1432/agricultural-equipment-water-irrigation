/**
  ******************************************************************************
  * @file           : sd_card_driver.h
  * @brief          : SPI SD Card low-level driver for STM32L475VGT6 on B-L475E-IOT01A2.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  * @mcu            : STM32L475VGT6 (ARM Cortex-M4 @ 80 MHz)
  ******************************************************************************
  * @attention
  *
  * Arduino Uno Expansion Header SD Card Pinout:
  *   SPI1_SCK  : PA5 (Arduino D13 - Note: shares trace with green User LED1)
  *   SPI1_MISO : PA6 (Arduino D12)
  *   SPI1_MOSI : PA7 (Arduino D11)
  *   SD_CS     : PB1 (Arduino D4 - Active Low GPIO Output)
  *   SD_CD     : PC2 (Arduino A1 - Active Low GPIO Input w/ Pull-Up, Card Detect)
  *   VCC       : 3.3V / 5.0V (CN6 pin 4/5)
  *   GND       : Ground (CN6 pin 6/7)
  ******************************************************************************
  */

#ifndef __SD_CARD_DRIVER_H
#define __SD_CARD_DRIVER_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>

/* Hardware Configuration Defines -------------------------------------------*/
#define SD_SPI_INSTANCE                SPI1

/* Pinout definitions matching B-L475E-IOT01A2 Arduino Uno header */
#define SD_SPI_SCK_PORT                GPIOA
#define SD_SPI_SCK_PIN                 (1U << 5)   /* PA5 - Arduino D13 (Shared with LED1) */
#define SD_SPI_MISO_PORT               GPIOA
#define SD_SPI_MISO_PIN                (1U << 6)   /* PA6 - Arduino D12 */
#define SD_SPI_MOSI_PORT               GPIOA
#define SD_SPI_MOSI_PIN                (1U << 7)   /* PA7 - Arduino D11 */

#define SD_CS_PORT                     GPIOB
#define SD_CS_PIN                      (1U << 1)   /* PB1 - Arduino D4 (Active Low) */

#define SD_CD_PORT                     GPIOC
#define SD_CD_PIN                      (1U << 2)   /* PC2 - Arduino A1 (Card Detect, Active Low) */

/* Standard Sector & Timing Constants ---------------------------------------*/
#define SD_SECTOR_SIZE                 512U
#define SD_INIT_TIMEOUT_MS             2000U
#define SD_CMD_TIMEOUT_MS              300U
#define SD_READ_TIMEOUT_MS             500U
#define SD_WRITE_TIMEOUT_MS            1000U
#define SD_DEBOUNCE_MS                 25U

/* SD SPI Commands (0x40 | Command Index) -----------------------------------*/
#define SD_CMD0                        (0x40 | 0)   /* GO_IDLE_STATE */
#define SD_CMD1                        (0x40 | 1)   /* SEND_OP_COND (MMC) */
#define SD_CMD8                        (0x40 | 8)   /* SEND_IF_COND (VHS/Check Pattern) */
#define SD_CMD9                        (0x40 | 9)   /* SEND_CSD */
#define SD_CMD10                       (0x40 | 10)  /* SEND_CID */
#define SD_CMD12                       (0x40 | 12)  /* STOP_TRANSMISSION */
#define SD_CMD16                       (0x40 | 16)  /* SET_BLOCKLEN (512 bytes) */
#define SD_CMD17                       (0x40 | 17)  /* READ_SINGLE_BLOCK */
#define SD_CMD18                       (0x40 | 18)  /* READ_MULTIPLE_BLOCK */
#define SD_CMD23                       (0x40 | 23)  /* SET_BLOCK_COUNT */
#define SD_CMD24                       (0x40 | 24)  /* WRITE_BLOCK */
#define SD_CMD25                       (0x40 | 25)  /* WRITE_MULTIPLE_BLOCK */
#define SD_CMD55                       (0x40 | 55)  /* APP_CMD (Precedes ACMD) */
#define SD_CMD58                       (0x40 | 58)  /* READ_OCR */

/* SD Application Specific Commands (Preceded by CMD55) ---------------------*/
#define SD_ACMD23                      (0x40 | 23)  /* SET_WR_BLK_ERASE_COUNT */
#define SD_ACMD41                      (0x40 | 41)  /* SD_SEND_OP_COND */

/* SD SPI Tokens & Flags ----------------------------------------------------*/
#define SD_TOKEN_START_BLOCK           0xFEU
#define SD_TOKEN_START_MULTIBLOCK      0xFCU
#define SD_TOKEN_STOP_TRANSMISSION     0xFDU
#define SD_TOKEN_DATA_ACCEPTED         0x05U
#define SD_TOKEN_DATA_CRC_ERR          0x0BU
#define SD_TOKEN_DATA_WRITE_ERR        0x0DU

/* R1 Response Bitmasks -----------------------------------------------------*/
#define SD_R1_IN_IDLE_STATE            (1U << 0)
#define SD_R1_ERASE_RESET              (1U << 1)
#define SD_R1_ILLEGAL_COMMAND          (1U << 2)
#define SD_R1_COMMAND_CRC_ERROR        (1U << 3)
#define SD_R1_ERASE_SEQ_ERROR          (1U << 4)
#define SD_R1_ADDRESS_ERROR            (1U << 5)
#define SD_R1_PARAMETER_ERROR          (1U << 6)

/* SD Card Type Classification ----------------------------------------------*/
typedef enum {
  SD_CARD_TYPE_UNKNOWN  = 0x00,
  SD_CARD_TYPE_MMC      = 0x01,
  SD_CARD_TYPE_SDSC_V1  = 0x02,  /* Standard Capacity v1.x (Byte addressed) */
  SD_CARD_TYPE_SDSC_V2  = 0x04,  /* Standard Capacity v2.0 (Byte addressed) */
  SD_CARD_TYPE_SDHC     = 0x08   /* SDHC / SDXC v2.0+ (Block addressed, 512B) */
} SD_CardType_t;

/* SD Error Codes -----------------------------------------------------------*/
typedef enum {
  SD_ERR_OK             = 0,
  SD_ERR_NO_CARD        = 1,
  SD_ERR_TIMEOUT        = 2,
  SD_ERR_CMD0_FAIL      = 3,
  SD_ERR_CMD8_FAIL      = 4,
  SD_ERR_ACMD41_FAIL    = 5,
  SD_ERR_CMD58_FAIL     = 6,
  SD_ERR_CMD16_FAIL     = 7,
  SD_ERR_READ_FAIL      = 8,
  SD_ERR_WRITE_FAIL     = 9,
  SD_ERR_WRITE_TIMEOUT  = 10,
  SD_ERR_CRC_FAIL       = 11,
  SD_ERR_UNSUPPORTED    = 12
} SD_ErrorCode_t;

/* SD Card Information Structure --------------------------------------------*/
typedef struct {
  SD_CardType_t   cardType;
  bool            isInserted;
  bool            isInitialized;
  uint32_t        sectorCount;
  uint32_t        sectorSize;       /* Always 512 */
  uint64_t        capacityBytes;
  uint32_t        totalCapacityMB;
  SD_ErrorCode_t  lastErrorCode;
  char            lastErrorStr[32];
  uint32_t        readOperations;
  uint32_t        writeOperations;
  uint32_t        lastOpTick;
} SD_CardInfo_t;

/* Exported Driver Functions ------------------------------------------------*/

/**
  * @brief  Initialize MCU GPIO pins and SPI1 peripheral for SD Card interface.
  * @retval true on success, false on peripheral configuration fault.
  */
bool SD_Driver_Init(void);

/**
  * @brief  De-initialize SD Card SPI interface and release GPIOs.
  */
void SD_Driver_DeInit(void);

/**
  * @brief  Check physical card detect pin with 25ms software debounce filter.
  * @retval true if card is present, false otherwise.
  */
bool SD_Driver_IsCardDetected(void);

/**
  * @brief  Execute full SD card SPI initialization sequence:
  *         Pours 80 dummy clock cycles with CS high, issues CMD0, CMD8,
  *         ACMD41 loop, CMD58 OCR interrogation, CMD16 block size setting,
  *         and switches SPI1 from 312.5 kHz to 20 MHz high-speed mode.
  * @retval true if card entered data transfer mode successfully.
  */
bool SD_Driver_CardInitialize(void);

/**
  * @brief  Read a single 512-byte block from SD card.
  * @param  sector LBA sector address (block address on SDHC, byte address on SDSC).
  * @param  buffer Pointer to 512-byte destination memory buffer.
  * @retval true on successful read.
  */
bool SD_Driver_ReadSector(uint32_t sector, uint8_t *buffer);

/**
  * @brief  Write a single 512-byte block to SD card.
  * @param  sector LBA sector address.
  * @param  buffer Pointer to 512-byte source memory buffer.
  * @retval true on successful write.
  */
bool SD_Driver_WriteSector(uint32_t sector, const uint8_t *buffer);

/**
  * @brief  Read multiple sequential 512-byte blocks.
  * @param  sector Starting LBA sector address.
  * @param  buffer Destination memory buffer (count * 512 bytes).
  * @param  count Number of sectors to read.
  * @retval true on success.
  */
bool SD_Driver_ReadMultipleSectors(uint32_t sector, uint8_t *buffer, uint32_t count);

/**
  * @brief  Write multiple sequential 512-byte blocks.
  * @param  sector Starting LBA sector address.
  * @param  buffer Source memory buffer (count * 512 bytes).
  * @param  count Number of sectors to write.
  * @retval true on success.
  */
bool SD_Driver_WriteMultipleSectors(uint32_t sector, const uint8_t *buffer, uint32_t count);

/**
  * @brief  Flush internal card caches and wait for flash programming ready.
  * @retval true if ready.
  */
bool SD_Driver_Sync(void);

/**
  * @brief  Get total sector count detected during card initialization.
  */
uint32_t SD_Driver_GetSectorCount(void);

/**
  * @brief  Get sector size in bytes (512).
  */
uint32_t SD_Driver_GetSectorSize(void);

/**
  * @brief  Interrogate card driver status and metrics.
  * @retval Read-only pointer to internal SD_CardInfo_t structure.
  */
const SD_CardInfo_t* SD_Driver_GetInfo(void);

/**
  * @brief  Switch SPI1 baud rate prescaler.
  * @param  enableHighSpeed If true, sets prescaler to 4 (~20 MHz).
  *                         If false, sets prescaler to 256 (~312.5 kHz).
  */
void SD_Driver_SetHighSpeed(bool enableHighSpeed);

#ifdef __cplusplus
}
#endif

#endif /* __SD_CARD_DRIVER_H */
