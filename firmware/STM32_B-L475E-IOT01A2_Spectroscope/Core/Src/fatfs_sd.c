/**
  ******************************************************************************
  * @file           : fatfs_sd.c
  * @brief          : FatFs DiskIO Driver implementation bridging Chan FatFs to SD SPI.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#include "fatfs_sd.h"
#include "sd_card_driver.h"
#include "main.h"

static volatile DSTATUS s_diskStatus = STA_NOINIT;

DSTATUS disk_initialize(BYTE pdrv) {
  if (pdrv != SD_DRIVE_NUM) {
    return STA_NOINIT;
  }

  if (!SD_Driver_IsCardDetected()) {
    s_diskStatus = STA_NODISK | STA_NOINIT;
    return s_diskStatus;
  }

  if (SD_Driver_Init()) {
    s_diskStatus &= ~STA_NOINIT;
  } else {
    s_diskStatus |= STA_NOINIT;
  }

  return s_diskStatus;
}

DSTATUS disk_status(BYTE pdrv) {
  if (pdrv != SD_DRIVE_NUM) {
    return STA_NOINIT;
  }

  if (!SD_Driver_IsCardDetected()) {
    s_diskStatus = STA_NODISK | STA_NOINIT;
  } else {
    s_diskStatus &= ~STA_NODISK;
    const SD_CardInfo_t *info = SD_Driver_GetInfo();
    if (info->isInitialized) {
      s_diskStatus &= ~STA_NOINIT;
    } else {
      s_diskStatus |= STA_NOINIT;
    }
  }

  return s_diskStatus;
}

DRESULT disk_read(BYTE pdrv, BYTE *buff, LBA_t sector, UINT count) {
  if (pdrv != SD_DRIVE_NUM || !buff || count == 0) {
    return RES_PARERR;
  }

  if (s_diskStatus & STA_NOINIT) {
    return RES_NOTRDY;
  }

  if (count == 1) {
    if (SD_Driver_ReadSector((uint32_t)sector, (uint8_t*)buff)) {
      return RES_OK;
    }
  } else {
    if (SD_Driver_ReadMultipleSectors((uint32_t)sector, (uint8_t*)buff, (uint32_t)count)) {
      return RES_OK;
    }
  }

  return RES_ERROR;
}

DRESULT disk_write(BYTE pdrv, const BYTE *buff, LBA_t sector, UINT count) {
  if (pdrv != SD_DRIVE_NUM || !buff || count == 0) {
    return RES_PARERR;
  }

  if (s_diskStatus & STA_NOINIT) {
    return RES_NOTRDY;
  }

  if (s_diskStatus & STA_PROTECT) {
    return RES_WRPRT;
  }

  if (count == 1) {
    if (SD_Driver_WriteSector((uint32_t)sector, (const uint8_t*)buff)) {
      return RES_OK;
    }
  } else {
    if (SD_Driver_WriteMultipleSectors((uint32_t)sector, (const uint8_t*)buff, (uint32_t)count)) {
      return RES_OK;
    }
  }

  return RES_ERROR;
}

DRESULT disk_ioctl(BYTE pdrv, BYTE cmd, void *buff) {
  if (pdrv != SD_DRIVE_NUM) {
    return RES_PARERR;
  }

  if (s_diskStatus & STA_NOINIT) {
    return RES_NOTRDY;
  }

  DRESULT res = RES_ERROR;

  switch (cmd) {
    case CTRL_SYNC:
      if (SD_Driver_Sync()) {
        res = RES_OK;
      }
      break;

    case GET_SECTOR_COUNT:
      if (buff) {
        *(LBA_t*)buff = (LBA_t)SD_Driver_GetSectorCount();
        res = RES_OK;
      } else {
        res = RES_PARERR;
      }
      break;

    case GET_SECTOR_SIZE:
      if (buff) {
        *(WORD*)buff = (WORD)SD_Driver_GetSectorSize();
        res = RES_OK;
      } else {
        res = RES_PARERR;
      }
      break;

    case GET_BLOCK_SIZE:
      if (buff) {
        /* Standard 512-byte block erase granularity in SPI mode */
        *(DWORD*)buff = 1;
        res = RES_OK;
      } else {
        res = RES_PARERR;
      }
      break;

    case CTRL_TRIM:
      /* Sector trimming unsupported over SPI; harmless NOP */
      res = RES_OK;
      break;

    default:
      res = RES_PARERR;
      break;
  }

  return res;
}

DWORD get_fattime(void) {
  /* Pack date and time into 32-bit FAT timestamp:
     bit 31:25 - Year origin from 1980 (e.g. 2026 - 1980 = 46)
     bit 24:21 - Month (1..12, e.g. 11 = November)
     bit 20:16 - Day (1..31, e.g. 20)
     bit 15:11 - Hour (0..23, e.g. 14)
     bit 10:5  - Minute (0..59, e.g. 30)
     bit 4:0   - Second / 2 (0..29, e.g. 0)
  */
  uint32_t year = 2026 - 1980;
  uint32_t month = 11;
  uint32_t day = 20;
  uint32_t hour = 14;
  uint32_t min = 30;
  uint32_t sec2 = 0;

  return ((year & 0x7F) << 25) |
         ((month & 0x0F) << 21) |
         ((day & 0x1F) << 16)   |
         ((hour & 0x1F) << 11)  |
         ((min & 0x3F) << 5)    |
         (sec2 & 0x1F);
}

/* Explicit aliases */
DSTATUS FATFS_SD_disk_initialize(BYTE pdrv) { return disk_initialize(pdrv); }
DSTATUS FATFS_SD_disk_status(BYTE pdrv) { return disk_status(pdrv); }
DRESULT FATFS_SD_disk_read(BYTE pdrv, BYTE *buff, LBA_t sector, UINT count) { return disk_read(pdrv, buff, sector, count); }
DRESULT FATFS_SD_disk_write(BYTE pdrv, const BYTE *buff, LBA_t sector, UINT count) { return disk_write(pdrv, buff, sector, count); }
DRESULT FATFS_SD_disk_ioctl(BYTE pdrv, BYTE cmd, void *buff) { return disk_ioctl(pdrv, cmd, buff); }
DWORD FATFS_SD_get_fattime(void) { return get_fattime(); }
