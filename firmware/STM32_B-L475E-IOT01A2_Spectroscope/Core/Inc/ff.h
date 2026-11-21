/*---------------------------------------------------------------------------/
/  FatFs - Generic FAT Filesystem Module  R0.14b                              /
/---------------------------------------------------------------------------*/

#ifndef FF_DEFINED
#define FF_DEFINED 86631

#ifdef __cplusplus
extern "C" {
#endif

#include "ffconf.h"
#include "diskio.h"
#include <stdint.h>
#include <stdbool.h>

#define FF_INTDEF 2
typedef unsigned int    UINT;
typedef unsigned char   BYTE;
typedef uint16_t        WORD;
typedef uint16_t        WCHAR;
typedef uint32_t        DWORD;
typedef uint64_t        QWORD;
typedef DWORD           LBA_t;
typedef DWORD           FSIZE_t;
typedef char            TCHAR;

/* File access mode and open method flags (3rd argument of f_open) */
#define FA_READ             0x01
#define FA_WRITE            0x02
#define FA_OPEN_EXISTING    0x00
#define FA_CREATE_NEW       0x04
#define FA_CREATE_ALWAYS    0x08
#define FA_OPEN_ALWAYS      0x10
#define FA_OPEN_APPEND      0x30

/* File attribute bits for directory entry (FILINFO.fattrib) */
#define AM_RDO  0x01    /* Read only */
#define AM_HID  0x02    /* Hidden */
#define AM_SYS  0x04    /* System */
#define AM_DIR  0x10    /* Directory */
#define AM_ARC  0x20    /* Archive */

/* File system object structure (FATFS) */
typedef struct {
  BYTE    fs_type;      /* Filesystem type (0:N/A, 1:FAT12, 2:FAT16, 3:FAT32) */
  BYTE    pdrv;         /* Physical drive number */
  BYTE    n_fats;       /* Number of FATs (1 or 2) */
  BYTE    wflag;        /* win[] flag (b0:dirty) */
  BYTE    fsi_flag;     /* FSINFO flags (b7:disabled, b0:dirty) */
  WORD    id;           /* Volume mount ID */
  WORD    n_rootdir;    /* Number of root directory entries (FAT12/16) */
  WORD    csize;        /* Cluster size [sectors] */
  DWORD   last_clst;    /* Last allocated cluster */
  DWORD   free_clst;    /* Number of free clusters */
  DWORD   n_fatent;     /* Number of FAT entries (number of clusters + 2) */
  DWORD   fsize;        /* Size of an FAT [sectors] */
  LBA_t   volbase;      /* Volume base sector */
  LBA_t   fatbase;      /* FAT base sector */
  LBA_t   dirbase;      /* Root directory base sector (FAT12/16) or cluster (FAT32) */
  LBA_t   database;     /* Data base sector */
  LBA_t   winsect;      /* Current sector appearing in the win[] */
  BYTE    win[FF_MAX_SS]; /* Disk access window for Directory/FAT */
} FATFS;

/* File object structure (FIL) */
typedef struct {
  FATFS*  obj_fs;       /* Pointer to the hosting volume of this file */
  WORD    obj_id;       /* Hosting volume mount ID */
  BYTE    flag;         /* File status flags */
  BYTE    err;          /* Abort flag (error code) */
  FSIZE_t fptr;         /* File read/write pointer (byte offset) */
  DWORD   clust;        /* Current cluster of fpter */
  LBA_t   sect;         /* Sector number appearing in buf[] */
  FSIZE_t obj_size;     /* File size */
  DWORD   obj_sclust;   /* File start cluster */
  BYTE    buf[FF_MAX_SS]; /* File private data read/write cache */
} FIL;

/* Directory object structure (DIR) */
typedef struct {
  FATFS*  obj_fs;       /* Pointer to the hosting volume of this directory */
  WORD    obj_id;       /* Hosting volume mount ID */
  DWORD   dptr;         /* Current read/write offset */
  DWORD   clust;        /* Current cluster */
  LBA_t   sect;         /* Current sector */
  BYTE*   dir;          /* Pointer to the directory entry in the win[] */
  BYTE    fn[12];       /* SFN (in/out) {body[8],ext[3],status[1]} */
  DWORD   blk_ofs;      /* Offset for readdir */
} DIR;

/* File information structure (FILINFO) */
typedef struct {
  FSIZE_t fsize;        /* File size */
  WORD    fdate;        /* Modified date */
  WORD    ftime;        /* Modified time */
  BYTE    fattrib;      /* File attribute */
  TCHAR   fname[FF_MAX_LFN + 1]; /* File name */
  TCHAR   altname[FF_SFN_BUF + 1]; /* Alternative file name */
} FILINFO;

/* File function return code (FRESULT) */
typedef enum {
  FR_OK = 0,            /* (0) Succeeded */
  FR_DISK_ERR,          /* (1) A hard error occurred in the low level disk I/O layer */
  FR_INT_ERR,           /* (2) Assertion failed */
  FR_NOT_READY,         /* (3) The physical drive cannot work */
  FR_NO_FILE,           /* (4) Could not find the file */
  FR_NO_PATH,           /* (5) Could not find the path */
  FR_INVALID_NAME,      /* (6) The path name format is invalid */
  FR_DENIED,            /* (7) Access denied due to prohibited access or directory full */
  FR_EXIST,             /* (8) Access denied due to prohibited access */
  FR_INVALID_OBJECT,    /* (9) The file/directory object is invalid */
  FR_WRITE_PROTECTED,   /* (10) The physical drive is write protected */
  FR_INVALID_DRIVE,     /* (11) The logical drive number is invalid */
  FR_NOT_ENABLED,       /* (12) The volume has no work area */
  FR_NO_FILESYSTEM,     /* (13) There is no valid FAT volume */
  FR_MKFS_ABORTED,      /* (14) The f_mkfs() aborted due to any problem */
  FR_TIMEOUT,           /* (15) Could not get a grant to access the volume */
  FR_LOCKED,            /* (16) The operation is rejected according to the file sharing policy */
  FR_NOT_ENOUGH_CORE,   /* (17) LFN working buffer could not be allocated */
  FR_TOO_MANY_OPEN_FILES,/* (18) Number of open files > FF_FS_LOCK */
  FR_INVALID_PARAMETER  /* (19) Given parameter is invalid */
} FRESULT;

/* FatFs Module Application Interface ---------------------------------------*/
FRESULT f_open (FIL* fp, const TCHAR* path, BYTE mode);
FRESULT f_close (FIL* fp);
FRESULT f_read (FIL* fp, void* buff, UINT btr, UINT* br);
FRESULT f_write (FIL* fp, const void* buff, UINT btw, UINT* bw);
FRESULT f_lseek (FIL* fp, FSIZE_t ofs);
FRESULT f_sync (FIL* fp);
FRESULT f_opendir (DIR* dp, const TCHAR* path);
FRESULT f_closedir (DIR* dp);
FRESULT f_readdir (DIR* dp, FILINFO* fno);
FRESULT f_stat (const TCHAR* path, FILINFO* fno);
FRESULT f_unlink (const TCHAR* path);
FRESULT f_mkdir (const TCHAR* path);
FRESULT f_getfree (const TCHAR* path, DWORD* nclst, FATFS** fatfs);
FRESULT f_mount (FATFS* fs, const TCHAR* path, BYTE opt);

#define f_eof(fp) ((int)((fp)->fptr == (fp)->obj_size))
#define f_error(fp) ((fp)->err)
#define f_tell(fp) ((fp)->fptr)
#define f_size(fp) ((fp)->obj_size)

#ifdef __cplusplus
}
#endif

#endif /* FF_DEFINED */
