/**
  ******************************************************************************
  * @file    app_ble.h
  * @brief   BlueNRG-MS stack bring-up and "AgriSpectra Chat" GATT service
  *          (ST BlueNRG Chat UUID family) for the spectroscope.
  ******************************************************************************
  */

#ifndef APP_BLE_H
#define APP_BLE_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>

void APP_BLE_Init(void);
void APP_BLE_Process(void);
bool APP_BLE_IsConnected(void);
bool APP_BLE_SendData(const uint8_t *data, uint16_t len);

#ifdef __cplusplus
}
#endif
#endif /* APP_BLE_H */
