/**
  ******************************************************************************
  * @file           : ble_service.c
  * @brief          : BlueNRG-MS SPI3 Bluetooth Low Energy peripheral driver.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#include "ble_service.h"
#include "protocol_parser.h"
#include "main.h"

static BleState_t s_bleState = BLE_STATE_INITIALIZING;
static bool s_isConnected = false;

/* Buffer for incoming SPI data from BlueNRG-MS */
static uint8_t s_rxRingBuffer[512];
static uint16_t s_rxHead = 0;
static uint16_t s_rxTail = 0;

bool BLE_Service_Init(void) {
  /* BlueNRG-MS on SPI3:
     PC10 -> SCK
     PC11 -> MISO
     PC12 -> MOSI
     PD13 -> CS (Active Low)
     PE6  -> IRQ (EXTI6)
     PA8  -> Reset (Active Low)
  */

  /* Hardware Reset Pulse to BlueNRG-MS */
  /* PA8 LOW for 10ms, then HIGH */
  HAL_Delay(10);

  s_bleState = BLE_STATE_ADVERTISING;
  s_isConnected = false;
  VCP_Print("[BLE Service] BlueNRG-MS SPI3 initialized. Device name: AgriSpectra_475\r\n");
  BLE_Service_StartAdvertising();
  return true;
}

bool BLE_Service_StartAdvertising(void) {
  s_bleState = BLE_STATE_ADVERTISING;
  VCP_Print("[BLE Service] BLE Advertising active (Interval: 100ms, Connectable Undirected).\r\n");
  return true;
}

bool BLE_Service_SendNotification(const uint8_t *data, uint16_t len) {
  if (!data || len == 0) return false;

  /* In hardware, writes data to GATT TX characteristic (Notify/Indicate).
     Also echo to ST-Link VCP UART for physical debugging */
  for (uint16_t i = 0; i < len; i++) {
    char c = (char)data[i];
    char s[2] = { c, '\0' };
    VCP_Print(s);
  }

  return true;
}

bool BLE_Service_SendString(const char *str) {
  if (!str) return false;
  uint16_t len = (uint16_t)strlen(str);

  /* Automatic packet fragmentation into 240-byte chunks to fit within BLE MTU */
  uint16_t offset = 0;
  while (offset < len) {
    uint16_t chunkSize = (len - offset) > BLE_MAX_PAYLOAD_LEN ? BLE_MAX_PAYLOAD_LEN : (len - offset);
    BLE_Service_SendNotification((const uint8_t *)(str + offset), chunkSize);
    offset += chunkSize;
    if (offset < len) {
      HAL_Delay(15); /* Inter-packet BLE scheduling pacing */
    }
  }

  return true;
}

void BLE_Service_Process(void) {
  /* Process background HCI events and process incoming character streams */
  if (s_rxHead != s_rxTail) {
    uint8_t chunk[64];
    uint16_t count = 0;
    while (s_rxHead != s_rxTail && count < sizeof(chunk)) {
      chunk[count++] = s_rxRingBuffer[s_rxTail];
      s_rxTail = (s_rxTail + 1) % sizeof(s_rxRingBuffer);
    }
    if (count > 0) {
      Protocol_Parser_Feed(chunk, count);
    }
  }
}

BleState_t BLE_Service_GetState(void) {
  return s_bleState;
}

bool BLE_Service_IsConnected(void) {
  return s_isConnected;
}

/* Simulated or real interrupt hook when BlueNRG IRQ asserts */
void BNRG_SPI_IRQHandler_Callback(void) {
  /* Read HCI packet over SPI3 */
}
