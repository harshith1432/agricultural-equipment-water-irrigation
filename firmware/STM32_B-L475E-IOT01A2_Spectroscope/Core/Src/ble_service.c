/**
  ******************************************************************************
  * @file           : ble_service.c
  * @brief          : Public BLE service API, backed by the real BlueNRG-MS
  *                   stack in app_ble.c (SPI3 HCI transport + GATT chat
  *                   service). This keeps the same surface main.c and
  *                   protocol_parser.c already call against.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#include "ble_service.h"
#include "app_ble.h"
#include "main.h"

static BleState_t s_bleState = BLE_STATE_INITIALIZING;

bool BLE_Service_Init(void) {
  APP_BLE_Init();
  s_bleState = BLE_STATE_ADVERTISING;
  VCP_Printf("[BLE Service] BlueNRG-MS SPI3 initialized. Device name: %s\r\n", BLE_DEVICE_NAME);
  return true;
}

bool BLE_Service_StartAdvertising(void) {
  /* Advertising is (re)armed automatically by APP_BLE_Process() on boot and after disconnect. */
  s_bleState = BLE_STATE_ADVERTISING;
  return true;
}

bool BLE_Service_SendNotification(const uint8_t *data, uint16_t len) {
  if (!data || len == 0) return false;
  return APP_BLE_SendData(data, len);
}

bool BLE_Service_SendString(const char *str) {
  if (!str) return false;
  uint16_t len = (uint16_t)strlen(str);

  /* Fragment into BLE_MAX_PAYLOAD_LEN chunks to fit within the negotiated MTU */
  uint16_t offset = 0;
  while (offset < len) {
    uint16_t chunkSize = (len - offset) > BLE_MAX_PAYLOAD_LEN ? BLE_MAX_PAYLOAD_LEN : (len - offset);
    if (!BLE_Service_SendNotification((const uint8_t *)(str + offset), chunkSize)) {
      return false;
    }
    offset += chunkSize;
  }

  return true;
}

void BLE_Service_Process(void) {
  APP_BLE_Process();

  bool nowConnected = APP_BLE_IsConnected();
  if (nowConnected && s_bleState != BLE_STATE_CONNECTED && s_bleState != BLE_STATE_NOTIFICATIONS_ENABLED) {
    s_bleState = BLE_STATE_CONNECTED;
  } else if (!nowConnected && s_bleState != BLE_STATE_ADVERTISING) {
    s_bleState = BLE_STATE_ADVERTISING;
  }
}

BleState_t BLE_Service_GetState(void) {
  return s_bleState;
}

bool BLE_Service_IsConnected(void) {
  return APP_BLE_IsConnected();
}
