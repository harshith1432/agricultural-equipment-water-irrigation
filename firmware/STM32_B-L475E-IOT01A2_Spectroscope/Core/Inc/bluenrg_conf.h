/**
  ******************************************************************************
  * @file    bluenrg_conf.h
  * @brief   BlueNRG-MS stack configuration for the AgriSpectra spectroscope.
  ******************************************************************************
  */

#ifndef BLUENRG_CONF_H
#define BLUENRG_CONF_H

#ifdef __cplusplus
extern "C" {
#endif

#include "stm32l4xx_hal.h"
#include <string.h>

#define BLE1_DEBUG                    0
#define PRINT_CSV_FORMAT              0
#define HCI_READ_PACKET_SIZE          128
#define HCI_MAX_PAYLOAD_SIZE          128

/* Scan Interval / Window (N x 0.625 ms) */
#define SCAN_P      16384
#define SCAN_L      16384

/* Supervision Timeout (N x 10 ms) */
#define SUPERV_TIMEOUT      60

/* Connection Period (N x 1.25 ms) */
#define CONN_P1      40
#define CONN_P2      40

/* Connection Length (N x 0.625 ms) */
#define CONN_L1      2000
#define CONN_L2      2000

/* Advertising: fast discoverable interval (100ms) for a handheld field device */
#define ADV_DATA_TYPE      ADV_IND
#define ADV_INTERV_MIN      160   /* 100 ms */
#define ADV_INTERV_MAX      160   /* 100 ms */

#define L2CAP_INTERV_MIN      9
#define L2CAP_INTERV_MAX      20
#define L2CAP_TIMEOUT_MULTIPLIER      600

#define HCI_DEFAULT_TIMEOUT_MS        1000

#define BLUENRG_memcpy                memcpy
#define BLUENRG_memset                memset

#if (BLE1_DEBUG == 1)
#include <stdio.h>
#define PRINTF(...)                   printf(__VA_ARGS__)
#else
#define PRINTF(...)
#endif

#if PRINT_CSV_FORMAT
#include <stdio.h>
#define PRINT_CSV(...)                printf(__VA_ARGS__)
void print_csv_time(void);
#else
#define PRINT_CSV(...)
#endif

#ifdef __cplusplus
}
#endif
#endif /* BLUENRG_CONF_H */
