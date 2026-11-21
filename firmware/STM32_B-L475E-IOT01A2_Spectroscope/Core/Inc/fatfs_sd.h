/**
  ******************************************************************************
  * @file           : fatfs_sd.h
  * @brief          : Header for FatFs DiskIO Driver for SPI SD Card.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#ifndef __FATFS_SD_H
#define __FATFS_SD_H

#ifdef __cplusplus
extern "C" {
#endif

#include "diskio.h"
#include <stdint.h>
#include <stdbool.h>

/* Logical Drive Mapping */
#define SD_DRIVE_NUM                   0U

/**
  * @brief  Initialize SD card disk interface.
  */
DSTATUS FATFS_SD_disk_initialize(BYTE pdrv);

/**
  * @brief  Get current SD card disk status.
  */
DSTATUS FATFS_SD_disk_status(BYTE pdrv);

/**
  * @brief  Read sector(s) from SD card.
  */
DRESULT FATFS_SD_disk_read(BYTE pdrv, BYTE *buff, LBA_t sector, UINT count);

/**
  * @brief  Write sector(s) to SD card.
  */
DRESULT FATFS_SD_disk_write(BYTE pdrv, const BYTE *buff, LBA_t sector, UINT count);

/**
  * @brief  Miscellaneous device control IOCTL.
  */
DRESULT FATFS_SD_disk_ioctl(BYTE pdrv, BYTE cmd, void *buff);

/**
  * @brief  Get current timestamp formatted as 32-bit FAT timestamp.
  */
DWORD FATFS_SD_get_fattime(void);

#ifdef __cplusplus
}
#endif

#endif /* __FATFS_SD_H */
