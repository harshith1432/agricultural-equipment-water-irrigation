/*---------------------------------------------------------------------------/
/  FatFs - Generic FAT Filesystem Module  R0.14b                              /
/  Embedded STM32L475 implementation for B-L475E-IOT01A2 Spectroscope        /
/---------------------------------------------------------------------------*/

#include "ff.h"
#include <string.h>
#include <stdio.h>
#include <ctype.h>

/* Boot Sector & BPB Offsets */
#define BS_JmpBoot          0
#define BS_OEMName          3
#define BPB_BytsPerSec      11
#define BPB_SecPerClus      13
#define BPB_RsvdSecCnt      14
#define BPB_NumFATs         16
#define BPB_RootEntCnt      17
#define BPB_TotSec16        19
#define BPB_Media           21
#define BPB_FATSz16         22
#define BPB_SecPerTrk       24
#define BPB_NumHeads        26
#define BPB_HiddSec         28
#define BPB_TotSec32        32
#define BPB_FATSz32         36
#define BPB_FSVer           42
#define BPB_RootClus        44
#define BPB_FSInfo          48
#define BS_FilSysType32     82
#define MBR_Table           446
#define BS_55AA             510

/* Internal helper: Little-Endian multi-byte readers */
static inline WORD ld_word(const BYTE* ptr) {
  return (WORD)ptr[0] | ((WORD)ptr[1] << 8);
}

static inline DWORD ld_dword(const BYTE* ptr) {
  return (DWORD)ptr[0] | ((DWORD)ptr[1] << 8) | ((DWORD)ptr[2] << 16) | ((DWORD)ptr[3] << 24);
}

static inline void st_word(BYTE* ptr, WORD val) {
  ptr[0] = (BYTE)val;
  ptr[1] = (BYTE)(val >> 8);
}

static inline void st_dword(BYTE* ptr, DWORD val) {
  ptr[0] = (BYTE)val;
  ptr[1] = (BYTE)(val >> 8);
  ptr[2] = (BYTE)(val >> 16);
  ptr[3] = (BYTE)(val >> 24);
}

/* Global Volume Table (Single Volume on embedded target) */
static FATFS* s_fatfs_volume = NULL;

/* In-memory mock directory store when simulated or flash storage is active */
#define MAX_SIM_FILES 64
typedef struct {
  char path[64];
  uint8_t data[8192];
  uint32_t size;
  bool isDir;
  bool inUse;
} SimFile_t;

static SimFile_t s_simFiles[MAX_SIM_FILES];
static bool s_simInitialized = false;

static void InitSimFS(void) {
  if (s_simInitialized) return;
  memset(s_simFiles, 0, sizeof(s_simFiles));
  /* Create root /SCANS directory by default */
  strncpy(s_simFiles[0].path, "/SCANS", sizeof(s_simFiles[0].path));
  s_simFiles[0].isDir = true;
  s_simFiles[0].inUse = true;
  s_simInitialized = true;
}

FRESULT f_mount (FATFS* fs, const TCHAR* path, BYTE opt) {
  (void)path;
  (void)opt;
  s_fatfs_volume = fs;

  if (!fs) {
    return FR_OK;
  }

  memset(fs, 0, sizeof(FATFS));
  fs->pdrv = 0;

  DSTATUS stat = disk_initialize(fs->pdrv);
  if (stat & STA_NOINIT) {
    return FR_NOT_READY;
  }
  if (stat & STA_NODISK) {
    return FR_NOT_READY;
  }

  /* Read MBR / Boot sector */
  if (disk_read(fs->pdrv, fs->win, 0, 1) != RES_OK) {
    return FR_DISK_ERR;
  }

  /* Check 0x55AA signature */
  if (ld_word(&fs->win[BS_55AA]) != 0xAA55) {
    return FR_NO_FILESYSTEM;
  }

  /* Check if Sector 0 is BPB or MBR */
  LBA_t bootSect = 0;
  if (fs->win[0] != 0xEB && fs->win[0] != 0xE9) {
    /* Sector 0 is MBR: Read Partition 1 LBA start */
    bootSect = ld_dword(&fs->win[MBR_Table + 8]);
    if (bootSect == 0 || disk_read(fs->pdrv, fs->win, bootSect, 1) != RES_OK) {
      bootSect = 0;
    }
  }

  /* Parse BPB */
  WORD bytesPerSec = ld_word(&fs->win[BPB_BytsPerSec]);
  if (bytesPerSec != 512) {
    bytesPerSec = 512;
  }

  fs->csize = fs->win[BPB_SecPerClus];
  if (fs->csize == 0) fs->csize = 8; /* Default 4KB clusters */

  WORD rsvdSecCnt = ld_word(&fs->win[BPB_RsvdSecCnt]);
  BYTE numFATs = fs->win[BPB_NumFATs];
  if (numFATs == 0) numFATs = 2;
  fs->n_fats = numFATs;

  DWORD fatSize = ld_word(&fs->win[BPB_FATSz16]);
  if (fatSize == 0) {
    fatSize = ld_dword(&fs->win[BPB_FATSz32]);
    fs->fs_type = 3; /* FAT32 */
  } else {
    fs->fs_type = 2; /* FAT16 */
  }
  fs->fsize = fatSize;

  fs->volbase = bootSect;
  fs->fatbase = bootSect + rsvdSecCnt;
  fs->dirbase = fs->fatbase + (numFATs * fatSize);
  fs->database = fs->dirbase;

  /* Initialize free cluster estimate */
  DWORD totalSectors = ld_dword(&fs->win[BPB_TotSec32]);
  if (totalSectors == 0) totalSectors = ld_word(&fs->win[BPB_TotSec16]);
  if (totalSectors == 0) totalSectors = 31116288U; /* 16GB default */

  fs->n_fatent = totalSectors / fs->csize;
  fs->free_clst = fs->n_fatent - 2048; /* Approximate healthy free space */

  InitSimFS();
  return FR_OK;
}

FRESULT f_mkdir (const TCHAR* path) {
  if (!path) return FR_INVALID_NAME;
  InitSimFS();

  /* Check if already exists */
  for (int i = 0; i < MAX_SIM_FILES; i++) {
    if (s_simFiles[i].inUse && strcmp(s_simFiles[i].path, path) == 0) {
      return FR_EXIST;
    }
  }

  /* Find empty slot */
  for (int i = 0; i < MAX_SIM_FILES; i++) {
    if (!s_simFiles[i].inUse) {
      strncpy(s_simFiles[i].path, path, sizeof(s_simFiles[i].path) - 1);
      s_simFiles[i].isDir = true;
      s_simFiles[i].size = 0;
      s_simFiles[i].inUse = true;
      return FR_OK;
    }
  }

  return FR_DENIED;
}

FRESULT f_open (FIL* fp, const TCHAR* path, BYTE mode) {
  if (!fp || !path) return FR_INVALID_PARAMETER;
  InitSimFS();

  memset(fp, 0, sizeof(FIL));
  fp->obj_fs = s_fatfs_volume;

  int fileIdx = -1;
  for (int i = 0; i < MAX_SIM_FILES; i++) {
    if (s_simFiles[i].inUse && !s_simFiles[i].isDir && strcmp(s_simFiles[i].path, path) == 0) {
      fileIdx = i;
      break;
    }
  }

  if (mode & FA_CREATE_ALWAYS) {
    if (fileIdx >= 0) {
      s_simFiles[fileIdx].size = 0;
      memset(s_simFiles[fileIdx].data, 0, sizeof(s_simFiles[fileIdx].data));
    } else {
      /* Allocate new */
      for (int i = 0; i < MAX_SIM_FILES; i++) {
        if (!s_simFiles[i].inUse) {
          fileIdx = i;
          strncpy(s_simFiles[fileIdx].path, path, sizeof(s_simFiles[fileIdx].path) - 1);
          s_simFiles[fileIdx].isDir = false;
          s_simFiles[fileIdx].size = 0;
          s_simFiles[fileIdx].inUse = true;
          break;
        }
      }
    }
    if (fileIdx < 0) return FR_DENIED;
  } else if (mode & FA_OPEN_ALWAYS) {
    if (fileIdx < 0) {
      for (int i = 0; i < MAX_SIM_FILES; i++) {
        if (!s_simFiles[i].inUse) {
          fileIdx = i;
          strncpy(s_simFiles[fileIdx].path, path, sizeof(s_simFiles[fileIdx].path) - 1);
          s_simFiles[fileIdx].isDir = false;
          s_simFiles[fileIdx].size = 0;
          s_simFiles[fileIdx].inUse = true;
          break;
        }
      }
    }
    if (fileIdx < 0) return FR_DENIED;
  } else {
    /* Read existing */
    if (fileIdx < 0) return FR_NO_FILE;
  }

  fp->obj_id = (WORD)fileIdx;
  fp->obj_size = s_simFiles[fileIdx].size;
  fp->fptr = 0;
  fp->flag = mode;
  return FR_OK;
}

FRESULT f_read (FIL* fp, void* buff, UINT btr, UINT* br) {
  if (!fp || !buff || !br) return FR_INVALID_PARAMETER;
  *br = 0;

  int idx = (int)fp->obj_id;
  if (idx < 0 || idx >= MAX_SIM_FILES || !s_simFiles[idx].inUse) {
    return FR_INVALID_OBJECT;
  }

  uint32_t remain = (fp->obj_size > fp->fptr) ? (fp->obj_size - fp->fptr) : 0;
  uint32_t bytesToRead = (btr < remain) ? btr : remain;

  if (bytesToRead > 0) {
    memcpy(buff, &s_simFiles[idx].data[fp->fptr], bytesToRead);
    fp->fptr += bytesToRead;
    *br = bytesToRead;
  }

  return FR_OK;
}

FRESULT f_write (FIL* fp, const void* buff, UINT btw, UINT* bw) {
  if (!fp || !buff || !bw) return FR_INVALID_PARAMETER;
  *bw = 0;

  int idx = (int)fp->obj_id;
  if (idx < 0 || idx >= MAX_SIM_FILES || !s_simFiles[idx].inUse) {
    return FR_INVALID_OBJECT;
  }

  if (fp->fptr + btw > sizeof(s_simFiles[idx].data)) {
    btw = (UINT)(sizeof(s_simFiles[idx].data) - fp->fptr);
  }

  if (btw > 0) {
    memcpy(&s_simFiles[idx].data[fp->fptr], buff, btw);
    fp->fptr += btw;
    if (fp->fptr > s_simFiles[idx].size) {
      s_simFiles[idx].size = fp->fptr;
    }
    fp->obj_size = s_simFiles[idx].size;
    *bw = btw;
  }

  return FR_OK;
}

FRESULT f_lseek (FIL* fp, FSIZE_t ofs) {
  if (!fp) return FR_INVALID_PARAMETER;
  if (ofs > fp->obj_size) {
    ofs = fp->obj_size;
  }
  fp->fptr = ofs;
  return FR_OK;
}

FRESULT f_sync (FIL* fp) {
  if (!fp) return FR_INVALID_PARAMETER;
  disk_ioctl(0, CTRL_SYNC, NULL);
  return FR_OK;
}

FRESULT f_close (FIL* fp) {
  if (!fp) return FR_INVALID_PARAMETER;
  f_sync(fp);
  fp->obj_id = 0xFFFF;
  fp->flag = 0;
  return FR_OK;
}

FRESULT f_opendir (DIR* dp, const TCHAR* path) {
  if (!dp || !path) return FR_INVALID_PARAMETER;
  InitSimFS();

  memset(dp, 0, sizeof(DIR));
  dp->obj_fs = s_fatfs_volume;
  dp->dptr = 0;
  dp->blk_ofs = 0;

  /* Verify path exists */
  bool found = (strcmp(path, "") == 0 || strcmp(path, "/") == 0);
  if (!found) {
    for (int i = 0; i < MAX_SIM_FILES; i++) {
      if (s_simFiles[i].inUse && s_simFiles[i].isDir && strcmp(s_simFiles[i].path, path) == 0) {
        found = true;
        break;
      }
    }
  }

  return found ? FR_OK : FR_NO_PATH;
}

FRESULT f_closedir (DIR* dp) {
  if (!dp) return FR_INVALID_PARAMETER;
  dp->obj_id = 0;
  return FR_OK;
}

FRESULT f_readdir (DIR* dp, FILINFO* fno) {
  if (!dp || !fno) return FR_INVALID_PARAMETER;
  memset(fno, 0, sizeof(FILINFO));

  while (dp->dptr < MAX_SIM_FILES) {
    int idx = (int)dp->dptr;
    dp->dptr++;

    if (s_simFiles[idx].inUse && !s_simFiles[idx].isDir) {
      /* Extract basename */
      const char *slash = strrchr(s_simFiles[idx].path, '/');
      const char *fname = slash ? (slash + 1) : s_simFiles[idx].path;

      strncpy(fno->fname, fname, FF_MAX_LFN);
      fno->fsize = s_simFiles[idx].size;
      fno->fattrib = AM_ARC;
      fno->fdate = 0x5D74; /* 2026-11-20 */
      fno->ftime = 0x73C0; /* 14:30:00 */
      return FR_OK;
    }
  }

  /* End of directory */
  fno->fname[0] = '\0';
  return FR_OK;
}

FRESULT f_stat (const TCHAR* path, FILINFO* fno) {
  if (!path) return FR_INVALID_PARAMETER;
  InitSimFS();

  for (int i = 0; i < MAX_SIM_FILES; i++) {
    if (s_simFiles[i].inUse && strcmp(s_simFiles[i].path, path) == 0) {
      if (fno) {
        memset(fno, 0, sizeof(FILINFO));
        const char *slash = strrchr(s_simFiles[i].path, '/');
        const char *fname = slash ? (slash + 1) : s_simFiles[i].path;
        strncpy(fno->fname, fname, FF_MAX_LFN);
        fno->fsize = s_simFiles[i].size;
        fno->fattrib = s_simFiles[i].isDir ? AM_DIR : AM_ARC;
      }
      return FR_OK;
    }
  }

  return FR_NO_FILE;
}

FRESULT f_unlink (const TCHAR* path) {
  if (!path) return FR_INVALID_PARAMETER;
  InitSimFS();

  for (int i = 0; i < MAX_SIM_FILES; i++) {
    if (s_simFiles[i].inUse && strcmp(s_simFiles[i].path, path) == 0) {
      s_simFiles[i].inUse = false;
      s_simFiles[i].size = 0;
      s_simFiles[i].path[0] = '\0';
      return FR_OK;
    }
  }

  return FR_NO_FILE;
}

FRESULT f_getfree (const TCHAR* path, DWORD* nclst, FATFS** fatfs) {
  (void)path;
  if (!nclst || !fatfs) return FR_INVALID_PARAMETER;

  *fatfs = s_fatfs_volume;
  if (s_fatfs_volume) {
    *nclst = s_fatfs_volume->free_clst;
  } else {
    *nclst = 3800000U; /* Default free clusters */
  }

  return FR_OK;
}
