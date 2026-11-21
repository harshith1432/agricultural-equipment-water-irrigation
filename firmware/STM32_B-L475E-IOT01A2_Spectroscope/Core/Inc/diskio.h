/*-----------------------------------------------------------------------/
/  Low level disk interface modue include file   (C)ChaN, 2019          /
/-----------------------------------------------------------------------*/

#ifndef _DISKIO_DEFINED
#define _DISKIO_DEFINED

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>

/* Type definitions */
#ifndef _BYTE_DEFINED
#define _BYTE_DEFINED
typedef unsigned char   BYTE;
#endif

#ifndef _WORD_DEFINED
#define _WORD_DEFINED
typedef unsigned short  WORD;
#endif

#ifndef _DWORD_DEFINED
#define _DWORD_DEFINED
typedef unsigned long   DWORD;
#endif

#ifndef _UINT_DEFINED
#define _UINT_DEFINED
typedef unsigned int    UINT;
#endif

#ifndef _LBA_DEFINED
#define _LBA_DEFINED
typedef DWORD           LBA_t;
#endif

/* Status of Disk Functions */
typedef BYTE    DSTATUS;

/* Results of Disk Functions */
typedef enum {
  RES_OK = 0,     /* 0: Successful */
  RES_ERROR,      /* 1: R/W Error */
  RES_WRPRT,      /* 2: Write Protected */
  RES_NOTRDY,     /* 3: Not Ready */
  RES_PARERR      /* 4: Invalid Parameter */
} DRESULT;

/* Disk Status Bits (DSTATUS) */
#define STA_NOINIT      0x01    /* Drive not initialized */
#define STA_NODISK      0x02    /* No medium in the drive */
#define STA_PROTECT     0x04    /* Write protected */

/* Command code for disk_ioctl function */
#define CTRL_SYNC         0     /* Complete pending write process */
#define GET_SECTOR_COUNT  1     /* Get media size (number of sectors) */
#define GET_SECTOR_SIZE   2     /* Get sector size (512 bytes) */
#define GET_BLOCK_SIZE    3     /* Get erase block size */
#define CTRL_TRIM         4     /* Inform device of unused sectors */

/* Prototypes for disk control functions */
DSTATUS disk_initialize (BYTE pdrv);
DSTATUS disk_status (BYTE pdrv);
DRESULT disk_read (BYTE pdrv, BYTE* buff, LBA_t sector, UINT count);
DRESULT disk_write (BYTE pdrv, const BYTE* buff, LBA_t sector, UINT count);
DRESULT disk_ioctl (BYTE pdrv, BYTE cmd, void* buff);
DWORD get_fattime (void);

#ifdef __cplusplus
}
#endif

#endif /* _DISKIO_DEFINED */
