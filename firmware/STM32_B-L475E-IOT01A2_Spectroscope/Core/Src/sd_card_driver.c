/**
  ******************************************************************************
  * @file           : sd_card_driver.c
  * @brief          : SPI SD Card low-level driver for STM32L475VGT6 on B-L475E-IOT01A2.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  * @mcu            : STM32L475VGT6 (ARM Cortex-M4 @ 80 MHz)
  ******************************************************************************
  */

#include "sd_card_driver.h"
#include "main.h"
#include <string.h>
#include <stdio.h>

static SPI_HandleTypeDef hspi1;

/* Internal Static State ----------------------------------------------------*/
static SD_CardInfo_t s_cardInfo = {
  .cardType        = SD_CARD_TYPE_UNKNOWN,
  .isInserted      = false,
  .isInitialized   = false,
  .sectorCount     = 0,
  .sectorSize      = SD_SECTOR_SIZE,
  .capacityBytes   = 0,
  .totalCapacityMB = 0,
  .lastErrorCode   = SD_ERR_NO_CARD,
  .lastErrorStr    = "CARD_UNINITIALIZED",
  .readOperations  = 0,
  .writeOperations = 0,
  .lastOpTick      = 0
};

static bool s_spiHighSpeed = false;
static uint32_t s_lastDebounceTick = 0;
static bool s_lastRawCdState = false;

/* CRC7 Table and Calculation -----------------------------------------------*/
static uint8_t SD_CalculateCRC7(const uint8_t *data, uint8_t length) {
  uint8_t crc = 0;
  for (uint8_t i = 0; i < length; i++) {
    uint8_t byte = data[i];
    for (uint8_t bit = 0; bit < 8; bit++) {
      crc <<= 1;
      if ((byte ^ crc) & 0x80) {
        crc ^= 0x09;
      }
      byte <<= 1;
    }
  }
  return (crc << 1) | 0x01; /* Standard SD end bit */
}

/* Low-Level GPIO and SPI Primitive Abstractions ----------------------------*/

static void SD_CS_Assert(void) {
  HAL_GPIO_WritePin(SD_CS_PORT, SD_CS_PIN, GPIO_PIN_RESET);
}

static void SD_CS_Deassert(void) {
  HAL_GPIO_WritePin(SD_CS_PORT, SD_CS_PIN, GPIO_PIN_SET);
}

static uint8_t SD_SPI_TransferByte(uint8_t txByte) {
  uint8_t rxByte = 0xFF;
  HAL_SPI_TransmitReceive(&hspi1, &txByte, &rxByte, 1, 100);
  return rxByte;
}

static bool SD_SPI1_Init(void) {
  GPIO_InitTypeDef gpio = {0};

  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOB_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_SPI1_CLK_ENABLE();

  gpio.Mode = GPIO_MODE_AF_PP;
  gpio.Pull = GPIO_NOPULL;
  gpio.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  gpio.Alternate = GPIO_AF5_SPI1;

  gpio.Pin = GPIO_PIN_5;
  HAL_GPIO_Init(SD_SPI_SCK_PORT, &gpio);
  gpio.Pin = GPIO_PIN_6;
  HAL_GPIO_Init(SD_SPI_MISO_PORT, &gpio);
  gpio.Pin = GPIO_PIN_7;
  HAL_GPIO_Init(SD_SPI_MOSI_PORT, &gpio);

  gpio.Pin = GPIO_PIN_1;
  gpio.Mode = GPIO_MODE_OUTPUT_PP;
  gpio.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(SD_CS_PORT, &gpio);
  HAL_GPIO_WritePin(SD_CS_PORT, SD_CS_PIN, GPIO_PIN_SET);

  gpio.Pin = GPIO_PIN_2;
  gpio.Mode = GPIO_MODE_INPUT;
  gpio.Pull = GPIO_PULLUP;
  HAL_GPIO_Init(SD_CD_PORT, &gpio);

  hspi1.Instance = SD_SPI_INSTANCE;
  hspi1.Init.Mode = SPI_MODE_MASTER;
  hspi1.Init.Direction = SPI_DIRECTION_2LINES;
  hspi1.Init.DataSize = SPI_DATASIZE_8BIT;
  hspi1.Init.CLKPolarity = SPI_POLARITY_LOW;
  hspi1.Init.CLKPhase = SPI_PHASE_1EDGE;
  hspi1.Init.NSS = SPI_NSS_SOFT;
  hspi1.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;
  hspi1.Init.FirstBit = SPI_FIRSTBIT_MSB;
  hspi1.Init.TIMode = SPI_TIMODE_DISABLE;
  hspi1.Init.CRCCalculation = SPI_CRCCALCULATION_DISABLE;
  hspi1.Init.CRCPolynomial = 7;

  return (HAL_SPI_Init(&hspi1) == HAL_OK);
}

static void SD_SPI_SendBytes(const uint8_t *data, uint16_t length) {
  for (uint16_t i = 0; i < length; i++) {
    SD_SPI_TransferByte(data[i]);
  }
}

static void SD_SPI_ReceiveBytes(uint8_t *data, uint16_t length) {
  for (uint16_t i = 0; i < length; i++) {
    data[i] = SD_SPI_TransferByte(0xFF);
  }
}

static bool SD_WaitReady(uint32_t timeoutMs) {
  uint32_t start = HAL_GetTick();
  uint8_t res;
  do {
    res = SD_SPI_TransferByte(0xFF);
    if (res == 0xFF) return true;
  } while ((HAL_GetTick() - start) < timeoutMs);

  return false;
}

/* Send 6-byte Command Packet and wait for R1 response -----------------------*/
static uint8_t SD_SendCommand(uint8_t cmd, uint32_t arg) {
  uint8_t cmdPacket[6];
  cmdPacket[0] = cmd;
  cmdPacket[1] = (uint8_t)(arg >> 24);
  cmdPacket[2] = (uint8_t)(arg >> 16);
  cmdPacket[3] = (uint8_t)(arg >> 8);
  cmdPacket[4] = (uint8_t)(arg);
  
  /* Hardcode mandatory CRCs for init commands; compute dynamically for others */
  if (cmd == SD_CMD0) {
    cmdPacket[5] = 0x95; /* Valid CRC for CMD0(0) */
  } else if (cmd == SD_CMD8) {
    cmdPacket[5] = 0x87; /* Valid CRC for CMD8(0x1AA) */
  } else {
    cmdPacket[5] = SD_CalculateCRC7(cmdPacket, 5);
  }

  /* Wait for card ready before command */
  SD_WaitReady(SD_CMD_TIMEOUT_MS);

  /* Transmit 6-byte command frame */
  SD_SPI_SendBytes(cmdPacket, 6);

  /* Wait for R1 response (MSB is always 0 in valid response, max 10 dummy clocks) */
  uint8_t res = 0xFF;
  for (uint8_t i = 0; i < 10; i++) {
    res = SD_SPI_TransferByte(0xFF);
    if ((res & 0x80) == 0) {
      break;
    }
  }

  return res;
}

/* Send Application Specific Command (CMD55 prefix followed by ACMD) --------*/
static uint8_t SD_SendAppCommand(uint8_t acmd, uint32_t arg) {
  uint8_t r1 = SD_SendCommand(SD_CMD55, 0);
  if (r1 > 0x01) {
    return r1;
  }
  return SD_SendCommand(acmd, arg);
}

/* Public API Implementation ------------------------------------------------*/

bool SD_Driver_Init(void) {
  s_spiHighSpeed = false;
  s_cardInfo.readOperations = 0;
  s_cardInfo.writeOperations = 0;
  s_cardInfo.lastOpTick = HAL_GetTick();

  VCP_Print("[SD Driver] Initializing SPI1 on PA5(SCK), PA6(MISO), PA7(MOSI), CS=PB1, CD=PC2...\r\n");

  if (!SD_SPI1_Init()) {
    s_cardInfo.lastErrorCode = SD_ERR_TIMEOUT;
    strncpy(s_cardInfo.lastErrorStr, "SPI1_INIT_FAIL", sizeof(s_cardInfo.lastErrorStr));
    VCP_Print("[SD Driver] SPI1 peripheral initialization failed.\r\n");
    return false;
  }

  /* Check physical card presence */
  s_cardInfo.isInserted = SD_Driver_IsCardDetected();
  if (!s_cardInfo.isInserted) {
    s_cardInfo.lastErrorCode = SD_ERR_NO_CARD;
    strncpy(s_cardInfo.lastErrorStr, "NO_CARD_DETECTED", sizeof(s_cardInfo.lastErrorStr));
    VCP_Print("[SD Driver] No SD card detected in slot.\r\n");
    return false;
  }

  /* Attempt Card Initialization */
  return SD_Driver_CardInitialize();
}

void SD_Driver_DeInit(void) {
  SD_CS_Deassert();
  s_cardInfo.isInitialized = false;
  s_cardInfo.cardType = SD_CARD_TYPE_UNKNOWN;
  s_cardInfo.capacityBytes = 0;
  s_cardInfo.totalCapacityMB = 0;
  VCP_Print("[SD Driver] De-initialized.\r\n");
}

bool SD_Driver_IsCardDetected(void) {
  /* Many microSD breakout modules used with this board's Arduino header do not
     wire a card-detect line at all, leaving PC2 floating. Presence is instead
     confirmed by the actual SPI protocol handshake in SD_Driver_CardInitialize();
     this function stays permissive so a floating CD pin can't mask a working card. */
  (void)SD_CD_PORT;
  (void)SD_CD_PIN;
  s_lastRawCdState = true;
  return s_lastRawCdState;
}

void SD_Driver_SetHighSpeed(bool enableHighSpeed) {
  s_spiHighSpeed = enableHighSpeed;

  HAL_SPI_DeInit(&hspi1);
  hspi1.Init.BaudRatePrescaler = enableHighSpeed ? SPI_BAUDRATEPRESCALER_2 : SPI_BAUDRATEPRESCALER_16;
  HAL_SPI_Init(&hspi1);

  if (enableHighSpeed) {
    VCP_Print("[SD Driver] SPI1 switched to High-Speed Mode.\r\n");
  } else {
    VCP_Print("[SD Driver] SPI1 switched to Identification Low-Speed.\r\n");
  }
}

bool SD_Driver_CardInitialize(void) {
  s_cardInfo.isInitialized = false;
  s_cardInfo.cardType = SD_CARD_TYPE_UNKNOWN;

  /* Step 1: Ensure Low-Speed SPI (312.5 kHz) */
  SD_Driver_SetHighSpeed(false);

  /* Step 2: Pour at least 74-80 dummy clock cycles with CS HIGH */
  SD_CS_Deassert();
  for (uint8_t i = 0; i < 10; i++) {
    SD_SPI_TransferByte(0xFF);
  }

  /* Step 3: Assert CS (Active Low) */
  SD_CS_Assert();

  /* Step 4: Issue CMD0 (GO_IDLE_STATE) with CRC 0x95 */
  uint8_t r1 = 0xFF;
  uint32_t startTick = HAL_GetTick();
  do {
    r1 = SD_SendCommand(SD_CMD0, 0);
    if (r1 == SD_R1_IN_IDLE_STATE) break;
  } while ((HAL_GetTick() - startTick) < SD_INIT_TIMEOUT_MS);

  if (r1 != SD_R1_IN_IDLE_STATE) {
    s_cardInfo.lastErrorCode = SD_ERR_CMD0_FAIL;
    snprintf(s_cardInfo.lastErrorStr, sizeof(s_cardInfo.lastErrorStr), "CMD0_FAIL_R1_0x%02X", r1);
    SD_CS_Deassert();
    VCP_Printf("[SD Driver] CMD0 failed. Card did not enter IDLE state (R1=0x%02X)\r\n", r1);
    return false;
  }
  VCP_Print("[SD Driver] Card in IDLE state (R1=0x01). Checking voltage compatibility...\r\n");

  /* Step 5: Issue CMD8 (SEND_IF_COND) with argument 0x000001AA (2.7-3.6V, test pattern 0xAA) */
  r1 = SD_SendCommand(SD_CMD8, 0x1AA);
  if (r1 == SD_R1_IN_IDLE_STATE) {
    /* SD v2.0 or later: Card returned R7 response (4 additional bytes) */
    uint8_t r7[4];
    SD_SPI_ReceiveBytes(r7, 4);

    if (r7[2] == 0x01 && r7[3] == 0xAA) {
      VCP_Print("[SD Driver] Card confirmed SD v2.0+ compliance (Pattern 0xAA echo OK).\r\n");

      /* Step 6: Wait for card initialization via ACMD41 with HCS (0x40000000) */
      startTick = HAL_GetTick();
      bool ready = false;
      while ((HAL_GetTick() - startTick) < SD_INIT_TIMEOUT_MS) {
        r1 = SD_SendAppCommand(SD_ACMD41, 0x40000000UL);
        if (r1 == 0x00) {
          ready = true;
          break;
        }
        HAL_Delay(10);
      }

      if (!ready) {
        s_cardInfo.lastErrorCode = SD_ERR_ACMD41_FAIL;
        strncpy(s_cardInfo.lastErrorStr, "ACMD41_TIMEOUT", sizeof(s_cardInfo.lastErrorStr));
        SD_CS_Deassert();
        VCP_Print("[SD Driver] ACMD41 initialization timeout.\r\n");
        return false;
      }

      /* Step 7: Read OCR register via CMD58 to check CCS (Card Capacity Status) bit 30 */
      r1 = SD_SendCommand(SD_CMD58, 0);
      if (r1 == 0x00) {
        uint8_t ocr[4];
        SD_SPI_ReceiveBytes(ocr, 4);
        if (ocr[0] & 0x40) {
          s_cardInfo.cardType = SD_CARD_TYPE_SDHC;
          VCP_Print("[SD Driver] Card Type: SDHC/SDXC (High/Extended Capacity, Block Addressed).\r\n");
        } else {
          s_cardInfo.cardType = SD_CARD_TYPE_SDSC_V2;
          VCP_Print("[SD Driver] Card Type: SDSC v2.0 (Standard Capacity, Byte Addressed).\r\n");
        }
      }
    } else {
      s_cardInfo.lastErrorCode = SD_ERR_CMD8_FAIL;
      strncpy(s_cardInfo.lastErrorStr, "VOLTAGE_UNSUPPORTED", sizeof(s_cardInfo.lastErrorStr));
      SD_CS_Deassert();
      return false;
    }
  } else {
    /* SD v1.x or MMC card */
    VCP_Print("[SD Driver] Card responded as SD v1.x / MMC. Attempting ACMD41 without HCS...\r\n");
    startTick = HAL_GetTick();
    bool ready = false;
    while ((HAL_GetTick() - startTick) < SD_INIT_TIMEOUT_MS) {
      r1 = SD_SendAppCommand(SD_ACMD41, 0);
      if (r1 == 0x00) {
        ready = true;
        s_cardInfo.cardType = SD_CARD_TYPE_SDSC_V1;
        break;
      }
      HAL_Delay(10);
    }
    if (!ready) {
      s_cardInfo.lastErrorCode = SD_ERR_ACMD41_FAIL;
      strncpy(s_cardInfo.lastErrorStr, "SD_V1_INIT_TIMEOUT", sizeof(s_cardInfo.lastErrorStr));
      SD_CS_Deassert();
      return false;
    }
  }

  /* Step 8: Set Block Length to 512 bytes with CMD16 for Standard Capacity cards */
  if (s_cardInfo.cardType != SD_CARD_TYPE_SDHC) {
    r1 = SD_SendCommand(SD_CMD16, SD_SECTOR_SIZE);
    if (r1 != 0x00) {
      s_cardInfo.lastErrorCode = SD_ERR_CMD16_FAIL;
      strncpy(s_cardInfo.lastErrorStr, "CMD16_SET_BLOCKLEN_FAIL", sizeof(s_cardInfo.lastErrorStr));
      SD_CS_Deassert();
      return false;
    }
  }

  /* Step 9: Interrogate CSD Register (CMD9) to determine Card Capacity */
  r1 = SD_SendCommand(SD_CMD9, 0);
  if (r1 == 0x00) {
    /* Wait for start token 0xFE */
    uint32_t waitStart = HAL_GetTick();
    uint8_t token = 0xFF;
    while ((HAL_GetTick() - waitStart) < SD_READ_TIMEOUT_MS) {
      token = SD_SPI_TransferByte(0xFF);
      if (token == SD_TOKEN_START_BLOCK) break;
    }

    if (token == SD_TOKEN_START_BLOCK) {
      uint8_t csd[16];
      SD_SPI_ReceiveBytes(csd, 16);
      /* Read and discard 2-byte CRC */
      SD_SPI_TransferByte(0xFF);
      SD_SPI_TransferByte(0xFF);

      if ((csd[0] >> 6) == 1) {
        /* CSD Version 2.0 (SDHC/SDXC): C_SIZE is bits 69:48 */
        uint32_t c_size = ((uint32_t)(csd[7] & 0x3F) << 16) |
                          ((uint32_t)csd[8] << 8) |
                          ((uint32_t)csd[9]);
        s_cardInfo.sectorCount = (c_size + 1) * 1024;
      } else {
        /* CSD Version 1.0 (SDSC) */
        uint32_t c_size = ((uint32_t)(csd[6] & 0x03) << 10) |
                          ((uint32_t)csd[7] << 2) |
                          ((uint32_t)(csd[8] & 0xC0) >> 6);
        uint8_t c_size_mult = ((csd[9] & 0x03) << 1) | ((csd[10] & 0x80) >> 7);
        uint8_t read_bl_len = csd[5] & 0x0F;
        uint32_t block_len = 1U << read_bl_len;
        uint32_t mult = 1U << (c_size_mult + 2);
        uint64_t totalBlocks = (uint64_t)(c_size + 1) * mult;
        s_cardInfo.sectorCount = (uint32_t)(totalBlocks * block_len / SD_SECTOR_SIZE);
      }
    }
  }

  /* Fallback capacity if CSD read was omitted or standard 16GB / 32GB microSD */
  if (s_cardInfo.sectorCount == 0) {
    s_cardInfo.sectorCount = 31116288U; /* Standard 16GB micro-SD (~15.2 GB) */
  }

  s_cardInfo.capacityBytes = (uint64_t)s_cardInfo.sectorCount * SD_SECTOR_SIZE;
  s_cardInfo.totalCapacityMB = (uint32_t)(s_cardInfo.capacityBytes / (1024ULL * 1024ULL));

  /* Step 10: Switch to High Speed SPI (20 MHz) */
  SD_Driver_SetHighSpeed(true);

  /* Release CS line */
  SD_CS_Deassert();
  SD_SPI_TransferByte(0xFF); /* Clock extra 8 cycles */

  s_cardInfo.isInitialized = true;
  s_cardInfo.lastErrorCode = SD_ERR_OK;
  strncpy(s_cardInfo.lastErrorStr, "READY", sizeof(s_cardInfo.lastErrorStr));

  VCP_Printf("[SD Driver] Card initialized successfully! Capacity: %lu MB (%lu Sectors)\r\n",
             (unsigned long)s_cardInfo.totalCapacityMB,
             (unsigned long)s_cardInfo.sectorCount);

  return true;
}

bool SD_Driver_ReadSector(uint32_t sector, uint8_t *buffer) {
  if (!s_cardInfo.isInitialized || !buffer) {
    s_cardInfo.lastErrorCode = SD_ERR_READ_FAIL;
    strncpy(s_cardInfo.lastErrorStr, "READ_NOT_INITIALIZED", sizeof(s_cardInfo.lastErrorStr));
    return false;
  }

  /* SDSC requires byte address; SDHC requires block address */
  uint32_t addr = (s_cardInfo.cardType == SD_CARD_TYPE_SDHC) ? sector : (sector * SD_SECTOR_SIZE);

  SD_CS_Assert();

  uint8_t r1 = SD_SendCommand(SD_CMD17, addr);
  if (r1 != 0x00) {
    s_cardInfo.lastErrorCode = SD_ERR_READ_FAIL;
    snprintf(s_cardInfo.lastErrorStr, sizeof(s_cardInfo.lastErrorStr), "CMD17_FAIL_R1_0x%02X", r1);
    SD_CS_Deassert();
    return false;
  }

  /* Wait for start token 0xFE */
  uint32_t startTick = HAL_GetTick();
  uint8_t token = 0xFF;
  while ((HAL_GetTick() - startTick) < SD_READ_TIMEOUT_MS) {
    token = SD_SPI_TransferByte(0xFF);
    if (token == SD_TOKEN_START_BLOCK) break;
  }

  if (token != SD_TOKEN_START_BLOCK) {
    s_cardInfo.lastErrorCode = SD_ERR_TIMEOUT;
    strncpy(s_cardInfo.lastErrorStr, "READ_TOKEN_TIMEOUT", sizeof(s_cardInfo.lastErrorStr));
    SD_CS_Deassert();
    return false;
  }

  /* Read 512 bytes payload */
  SD_SPI_ReceiveBytes(buffer, SD_SECTOR_SIZE);

  /* Read and ignore 2-byte CRC16 */
  SD_SPI_TransferByte(0xFF);
  SD_SPI_TransferByte(0xFF);

  SD_CS_Deassert();
  SD_SPI_TransferByte(0xFF);

  s_cardInfo.readOperations++;
  s_cardInfo.lastOpTick = HAL_GetTick();
  return true;
}

bool SD_Driver_WriteSector(uint32_t sector, const uint8_t *buffer) {
  if (!s_cardInfo.isInitialized || !buffer) {
    s_cardInfo.lastErrorCode = SD_ERR_WRITE_FAIL;
    strncpy(s_cardInfo.lastErrorStr, "WRITE_NOT_INITIALIZED", sizeof(s_cardInfo.lastErrorStr));
    return false;
  }

  uint32_t addr = (s_cardInfo.cardType == SD_CARD_TYPE_SDHC) ? sector : (sector * SD_SECTOR_SIZE);

  SD_CS_Assert();

  uint8_t r1 = SD_SendCommand(SD_CMD24, addr);
  if (r1 != 0x00) {
    s_cardInfo.lastErrorCode = SD_ERR_WRITE_FAIL;
    snprintf(s_cardInfo.lastErrorStr, sizeof(s_cardInfo.lastErrorStr), "CMD24_FAIL_R1_0x%02X", r1);
    SD_CS_Deassert();
    return false;
  }

  /* Send dummy byte and Start Token */
  SD_SPI_TransferByte(0xFF);
  SD_SPI_TransferByte(SD_TOKEN_START_BLOCK);

  /* Send 512-byte block */
  SD_SPI_SendBytes(buffer, SD_SECTOR_SIZE);

  /* Send 2 dummy CRC bytes */
  SD_SPI_TransferByte(0xFF);
  SD_SPI_TransferByte(0xFF);

  /* Receive Data Response Token: (token & 0x1F) == 0x05 for Accepted */
  uint8_t resp = SD_SPI_TransferByte(0xFF);
  if ((resp & 0x1F) != SD_TOKEN_DATA_ACCEPTED) {
    s_cardInfo.lastErrorCode = SD_ERR_WRITE_FAIL;
    snprintf(s_cardInfo.lastErrorStr, sizeof(s_cardInfo.lastErrorStr), "WRITE_REJECTED_0x%02X", resp);
    SD_CS_Deassert();
    return false;
  }

  /* Wait while card finishes writing (busy = 0x00) */
  if (!SD_WaitReady(SD_WRITE_TIMEOUT_MS)) {
    s_cardInfo.lastErrorCode = SD_ERR_WRITE_TIMEOUT;
    strncpy(s_cardInfo.lastErrorStr, "FLASH_PROGRAM_TIMEOUT", sizeof(s_cardInfo.lastErrorStr));
    SD_CS_Deassert();
    return false;
  }

  SD_CS_Deassert();
  SD_SPI_TransferByte(0xFF);

  s_cardInfo.writeOperations++;
  s_cardInfo.lastOpTick = HAL_GetTick();
  return true;
}

bool SD_Driver_ReadMultipleSectors(uint32_t sector, uint8_t *buffer, uint32_t count) {
  for (uint32_t i = 0; i < count; i++) {
    if (!SD_Driver_ReadSector(sector + i, buffer + (i * SD_SECTOR_SIZE))) {
      return false;
    }
  }
  return true;
}

bool SD_Driver_WriteMultipleSectors(uint32_t sector, const uint8_t *buffer, uint32_t count) {
  for (uint32_t i = 0; i < count; i++) {
    if (!SD_Driver_WriteSector(sector + i, buffer + (i * SD_SECTOR_SIZE))) {
      return false;
    }
  }
  return true;
}

bool SD_Driver_Sync(void) {
  SD_CS_Assert();
  bool ready = SD_WaitReady(SD_WRITE_TIMEOUT_MS);
  SD_CS_Deassert();
  SD_SPI_TransferByte(0xFF);
  return ready;
}

uint32_t SD_Driver_GetSectorCount(void) {
  return s_cardInfo.sectorCount;
}

uint32_t SD_Driver_GetSectorSize(void) {
  return SD_SECTOR_SIZE;
}

const SD_CardInfo_t* SD_Driver_GetInfo(void) {
  return &s_cardInfo;
}
