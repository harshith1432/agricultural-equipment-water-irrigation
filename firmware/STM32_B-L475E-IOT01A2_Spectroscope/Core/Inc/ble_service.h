/**
  ******************************************************************************
  * @file           : ble_service.h
  * @brief          : Header for BlueNRG-MS SPI3 Bluetooth Low Energy service.
  ******************************************************************************
  */

#ifndef __BLE_SERVICE_H
#define __BLE_SERVICE_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Maximum BLE notification chunk size (Standard BLE MTU payload) */
#define BLE_MAX_PAYLOAD_LEN            244U

typedef enum {
  BLE_STATE_INITIALIZING = 0,
  BLE_STATE_ADVERTISING,
  BLE_STATE_CONNECTED,
  BLE_STATE_NOTIFICATIONS_ENABLED,
  BLE_STATE_DISCONNECTED,
  BLE_STATE_ERROR
} BleState_t;

/**
  * @brief  Initialize BlueNRG-MS SPI3 peripheral, GPIOs, and stack.
  */
bool BLE_Service_Init(void);

/**
  * @brief  Start BLE advertising with device name and custom service.
  */
bool BLE_Service_StartAdvertising(void);

/**
  * @brief  Send formatted response packet to mobile application over BLE notification.
  * @param  data Pointer to data buffer.
  * @param  len Length in bytes.
  * @retval true if transmitted or queued.
  */
bool BLE_Service_SendNotification(const uint8_t *data, uint16_t len);

/**
  * @brief  Send ASCII string over BLE notification (handles automatic fragmentation).
  * @param  str Null-terminated ASCII string.
  */
bool BLE_Service_SendString(const char *str);

/**
  * @brief  Process background BLE stack events (SPI IRQ, connection states).
  */
void BLE_Service_Process(void);

/**
  * @brief  Get current BLE state.
  */
BleState_t BLE_Service_GetState(void);

/**
  * @brief  Check if mobile device is currently connected over BLE.
  */
bool BLE_Service_IsConnected(void);

#ifdef __cplusplus
}
#endif

#endif /* __BLE_SERVICE_H */
