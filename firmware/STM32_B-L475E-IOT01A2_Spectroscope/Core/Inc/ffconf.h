/*---------------------------------------------------------------------------/
/  FatFs Configuration File
/---------------------------------------------------------------------------*/

#ifndef FFCONF_DEF
#define FFCONF_DEF 86631

/* Function Configurations --------------------------------------------------*/
#define FF_FS_READONLY   0   /* 0: Read/Write, 1: Read only */
#define FF_FS_MINIMIZE   0   /* 0: Full function */
#define FF_USE_FIND      0   /* Filtered directory search */
#define FF_USE_MKFS      1   /* f_mkfs() function */
#define FF_USE_FASTSEEK  0   /* Fast seek function */
#define FF_USE_EXPAND    0   /* f_expand() function */
#define FF_USE_CHMOD     0   /* f_chmod(), f_utime() */
#define FF_USE_LABEL     0   /* Volume label functions */
#define FF_USE_FORWARD   0   /* Forward function */
#define FF_USE_STRFUNC   0   /* String functions */

/* Locale and Namespace Configurations --------------------------------------*/
#define FF_CODE_PAGE     437 /* U.S. (OEM) */
#define FF_USE_LFN       2   /* Long File Name: 2=Dynamic buffer on stack */
#define FF_MAX_LFN       255 /* Maximum LFN length in characters */
#define FF_LFN_UNICODE   0   /* 0: ANSI/OEM, 1: UTF-16, 2: UTF-8 */
#define FF_LFN_BUF       255
#define FF_SFN_BUF       12
#define FF_FS_RPATH      0   /* Relative path disabled */

/* Volume and Drive Configurations ------------------------------------------*/
#define FF_VOLUMES       1   /* Number of volumes (logical drives) */
#define FF_STR_VOLUME_ID 0   /* Support string volume ID */
#define FF_MULTI_PARTITION 0
#define FF_MIN_SS        512 /* Minimum sector size */
#define FF_MAX_SS        512 /* Maximum sector size */
#define FF_LBA64         0   /* 32-bit LBA */
#define FF_MIN_GPT       0x10000000
#define FF_USE_TRIM      0   /* Sector erase/trim */
#define FF_FS_NOFSINFO   0   /* 0: Load FSINFO */

/* System Configurations ----------------------------------------------------*/
#define FF_FS_TINY       0   /* 0: Normal, 1: Tiny */
#define FF_FS_EXFAT      0   /* exFAT disabled */
#define FF_FS_NORTC      0   /* 0: Use get_fattime() */
#define FF_FS_LOCK       0   /* File sharing lock */
#define FF_FS_REENTRANT  0   /* Application handles safe mutex locking */

#endif /* FFCONF_DEF */
