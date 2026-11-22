/**
  ******************************************************************************
  * @file    app_ble.c
  * @brief   BlueNRG-MS stack bring-up for the AgriSpectra spectroscope.
  *          Exposes the "AgriSpectra_475" / ST BlueNRG Chat GATT service
  *          (Service d973f2e0, TX-notify d973f2e1, RX-write d973f2e2) that
  *          the mobile app already scans for. RX bytes are handed directly
  *          to Protocol_Parser_Feed(); TX notifications carry ACK/$SPEC
  *          frames produced by protocol_parser.c.
  ******************************************************************************
  */

#include "app_ble.h"
#include "bluenrg_gap.h"
#include "bluenrg_aci_const.h"
#include "hci.h"
#include "hci_le.h"
#include "hci_tl.h"
#include "hci_tl_interface.h"
#include "bluenrg_utils.h"
#include "bluenrg_gatt_server.h"
#include "bluenrg_gap_aci.h"
#include "bluenrg_gatt_aci.h"
#include "bluenrg_hal_aci.h"
#include "protocol_parser.h"
#include "ble_service.h"
#include "led_driver.h"
#include "main.h"
#include <string.h>

#define IDB04A1 0
#define IDB05A1 1

static volatile uint8_t  s_connected = FALSE;
static volatile uint8_t  s_setConnectable = TRUE;
static volatile uint16_t s_connectionHandle = 0;
static volatile uint8_t  s_notificationsEnabled = FALSE;

static uint8_t  s_bnrgBoard = IDB05A1;
static uint16_t s_serviceHandle;
static uint16_t s_txCharHandle;
static uint16_t s_rxCharHandle;

static void MakeDiscoverable(void)
{
  /* "AgriSpectra_475" complete local name, matches BLE_DEVICE_NAME in main.h */
  const char localName[] = { AD_TYPE_COMPLETE_LOCAL_NAME, 'A','g','r','i','S','p','e','c','t','r','a','_','4','7','5' };

  hci_le_set_scan_resp_data(0, NULL);

  tBleStatus r = aci_gap_set_discoverable(ADV_DATA_TYPE, ADV_INTERV_MIN, ADV_INTERV_MAX, PUBLIC_ADDR,
                            NO_WHITE_LIST_USE, sizeof(localName), localName, 0, NULL, 0, 0);
  VCP_Printf("[APP_BLE] set_discoverable ret=0x%02X\r\n", r);
}

static tBleStatus AddChatService(void)
{
  tBleStatus ret;

  /* D973F2E0 / E1 / E2 - B19E-11E2-9E96-0800200C9A66 (ST BlueNRG Chat profile) */
  const uint8_t serviceUuid[16] = {0x66,0x9a,0x0c,0x20,0x00,0x08,0x96,0x9e,0xe2,0x11,0x9e,0xb1,0xe0,0xf2,0x73,0xd9};
  const uint8_t txUuid[16]      = {0x66,0x9a,0x0c,0x20,0x00,0x08,0x96,0x9e,0xe2,0x11,0x9e,0xb1,0xe1,0xf2,0x73,0xd9};
  const uint8_t rxUuid[16]      = {0x66,0x9a,0x0c,0x20,0x00,0x08,0x96,0x9e,0xe2,0x11,0x9e,0xb1,0xe2,0xf2,0x73,0xd9};

  ret = aci_gatt_add_serv(UUID_TYPE_128, serviceUuid, PRIMARY_SERVICE, 7, &s_serviceHandle);
  if (ret != BLE_STATUS_SUCCESS) return ret;

  ret = aci_gatt_add_char(s_serviceHandle, UUID_TYPE_128, txUuid, BLE_MAX_PAYLOAD_LEN,
                           CHAR_PROP_NOTIFY, ATTR_PERMISSION_NONE, 0, 16, 1, &s_txCharHandle);
  if (ret != BLE_STATUS_SUCCESS) return ret;

  ret = aci_gatt_add_char(s_serviceHandle, UUID_TYPE_128, rxUuid, BLE_MAX_PAYLOAD_LEN,
                           CHAR_PROP_WRITE | CHAR_PROP_WRITE_WITHOUT_RESP, ATTR_PERMISSION_NONE,
                           GATT_NOTIFY_ATTRIBUTE_WRITE, 16, 1, &s_rxCharHandle);
  return ret;
}

static void HandleAttributeModified(uint16_t handle, uint8_t dataLength, uint8_t *attData)
{
  if (handle == s_rxCharHandle + 1) {
    Protocol_Parser_Feed(attData, dataLength);
  } else if (handle == s_txCharHandle + 2) {
    s_notificationsEnabled = (attData[0] == 0x01);
  }
}

static void HandleDisconnection(void)
{
  s_connected = FALSE;
  s_notificationsEnabled = FALSE;
  s_setConnectable = TRUE;
  LED_Status_SetBleActive(false);
}

static void HandleConnectionComplete(uint16_t handle)
{
  s_connected = TRUE;
  s_connectionHandle = handle;
  LED_Status_SetBleActive(true);
}

void user_notify(void *pData)
{
  hci_uart_pckt *hciPckt = pData;
  hci_event_pckt *eventPckt = (hci_event_pckt *)hciPckt->data;

  if (hciPckt->type != HCI_EVENT_PKT) return;

  switch (eventPckt->evt) {
    case EVT_DISCONN_COMPLETE:
      HandleDisconnection();
      break;

    case EVT_LE_META_EVENT: {
      evt_le_meta_event *evt = (void *)eventPckt->data;
      if (evt->subevent == EVT_LE_CONN_COMPLETE) {
        evt_le_connection_complete *cc = (void *)evt->data;
        HandleConnectionComplete(cc->handle);
      }
      break;
    }

    case EVT_VENDOR: {
      evt_blue_aci *blueEvt = (void *)eventPckt->data;
      if (blueEvt->ecode == EVT_BLUE_GATT_ATTRIBUTE_MODIFIED) {
        if (s_bnrgBoard == IDB05A1) {
          evt_gatt_attr_modified_IDB05A1 *evt = (evt_gatt_attr_modified_IDB05A1 *)blueEvt->data;
          HandleAttributeModified(evt->attr_handle, evt->data_length, evt->att_data);
        } else {
          evt_gatt_attr_modified_IDB04A1 *evt = (evt_gatt_attr_modified_IDB04A1 *)blueEvt->data;
          HandleAttributeModified(evt->attr_handle, evt->data_length, evt->att_data);
        }
      }
      break;
    }
  }
}

void APP_BLE_Init(void)
{
  uint8_t bdaddr[6] = {0xaa, 0x00, 0x00, 0xE1, 0x80, 0x02}; /* -> 02:80:E1:00:00:AA, matched by the mobile app's discovery heuristics */
  uint16_t serviceHandle, devNameCharHandle, appearanceCharHandle;
  uint8_t hwVersion;
  uint16_t fwVersion;

  hci_init(user_notify, NULL);
  VCP_Print("[APP_BLE] hci_init done\r\n");

  getBlueNRGVersion(&hwVersion, &fwVersion);
  VCP_Printf("[APP_BLE] getBlueNRGVersion hw=0x%02X fw=0x%04X\r\n", hwVersion, fwVersion);

  hci_reset();
  HAL_Delay(100);
  VCP_Print("[APP_BLE] hci_reset done\r\n");

  s_bnrgBoard = (hwVersion > 0x30) ? IDB05A1 : IDB04A1;

  {
    tBleStatus r;
    r = aci_hal_write_config_data(CONFIG_DATA_PUBADDR_OFFSET, CONFIG_DATA_PUBADDR_LEN, bdaddr);
    VCP_Printf("[APP_BLE] write_config_data ret=0x%02X\r\n", r);

    r = aci_gatt_init();
    VCP_Printf("[APP_BLE] gatt_init ret=0x%02X\r\n", r);

    if (s_bnrgBoard == IDB05A1) {
      r = aci_gap_init_IDB05A1(GAP_PERIPHERAL_ROLE_IDB05A1, 0, 0x10, &serviceHandle, &devNameCharHandle, &appearanceCharHandle);
    } else {
      r = aci_gap_init_IDB04A1(GAP_PERIPHERAL_ROLE_IDB04A1, &serviceHandle, &devNameCharHandle, &appearanceCharHandle);
    }
    VCP_Printf("[APP_BLE] gap_init board=%d ret=0x%02X\r\n", s_bnrgBoard, r);

    r = aci_gatt_update_char_value(serviceHandle, devNameCharHandle, 0, strlen(BLE_DEVICE_NAME), (uint8_t *)BLE_DEVICE_NAME);
    VCP_Printf("[APP_BLE] set_dev_name ret=0x%02X\r\n", r);

    r = AddChatService();
    VCP_Printf("[APP_BLE] AddChatService ret=0x%02X svc=0x%04X tx=0x%04X rx=0x%04X\r\n", r, s_serviceHandle, s_txCharHandle, s_rxCharHandle);
  }

  aci_hal_set_tx_power_level(1, 4);

  s_setConnectable = TRUE;
}

void APP_BLE_Process(void)
{
  if (s_setConnectable) {
    MakeDiscoverable();
    s_setConnectable = FALSE;
  }

  hci_user_evt_proc();
}

bool APP_BLE_IsConnected(void)
{
  return s_connected != FALSE;
}

bool APP_BLE_SendData(const uint8_t *data, uint16_t len)
{
  if (!s_connected || !s_notificationsEnabled || len == 0) {
    return false;
  }
  return aci_gatt_update_char_value(s_serviceHandle, s_txCharHandle, 0, len, (uint8_t *)data) == BLE_STATUS_SUCCESS;
}
