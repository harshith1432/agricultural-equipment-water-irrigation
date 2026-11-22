/**
  ******************************************************************************
  * @file    hci_tl_interface.c
  * @brief   BlueNRG-MS SPI3 HCI transport layer for the onboard SPBTLE-RF
  *          module on the B-L475E-IOT01A2. Implements the documented 5-byte
  *          SPI framing protocol (header exchange, device-ready polling).
  ******************************************************************************
  */

#include "hci_tl_interface.h"
#include "hci_tl.h"

#define HEADER_SIZE       5U
#define MAX_BUFFER_SIZE   255U
#define TIMEOUT_DURATION  15U

EXTI_HandleTypeDef hexti6;
static SPI_HandleTypeDef hspi3;

static int32_t SPI3_SendRecv(uint8_t *txBuf, uint8_t *rxBuf, uint16_t size)
{
  return (HAL_SPI_TransmitReceive(&hspi3, txBuf, rxBuf, size, 1000) == HAL_OK) ? 0 : -1;
}

int32_t HCI_TL_SPI_Init(void* pConf)
{
  GPIO_InitTypeDef gpio = {0};

  __HAL_RCC_GPIOA_CLK_ENABLE();
  __HAL_RCC_GPIOC_CLK_ENABLE();
  __HAL_RCC_GPIOD_CLK_ENABLE();
  __HAL_RCC_GPIOE_CLK_ENABLE();
  __HAL_RCC_SPI3_CLK_ENABLE();

  /* SPI3 SCK/MISO/MOSI alternate function pins */
  gpio.Mode = GPIO_MODE_AF_PP;
  gpio.Pull = GPIO_NOPULL;
  gpio.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  gpio.Alternate = HCI_TL_SPI_AF;

  gpio.Pin = HCI_TL_SPI_SCK_PIN;
  HAL_GPIO_Init(HCI_TL_SPI_SCK_PORT, &gpio);
  gpio.Pin = HCI_TL_SPI_MISO_PIN;
  HAL_GPIO_Init(HCI_TL_SPI_MISO_PORT, &gpio);
  gpio.Pin = HCI_TL_SPI_MOSI_PIN;
  HAL_GPIO_Init(HCI_TL_SPI_MOSI_PORT, &gpio);

  /* CS: software-managed, active low */
  gpio.Pin = HCI_TL_SPI_CS_PIN;
  gpio.Mode = GPIO_MODE_OUTPUT_PP;
  gpio.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(HCI_TL_SPI_CS_PORT, &gpio);
  HAL_GPIO_WritePin(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN, GPIO_PIN_SET);

  /* RESET: active low */
  gpio.Pin = HCI_TL_RST_PIN;
  gpio.Mode = GPIO_MODE_OUTPUT_PP;
  gpio.Speed = GPIO_SPEED_FREQ_LOW;
  HAL_GPIO_Init(HCI_TL_RST_PORT, &gpio);
  HAL_GPIO_WritePin(HCI_TL_RST_PORT, HCI_TL_RST_PIN, GPIO_PIN_SET);

  /* IRQ (data-ready) line from BlueNRG-MS, rising edge */
  gpio.Pin = HCI_TL_SPI_EXTI_PIN;
  gpio.Mode = GPIO_MODE_IT_RISING;
  gpio.Pull = GPIO_NOPULL;
  HAL_GPIO_Init(HCI_TL_SPI_EXTI_PORT, &gpio);

  hspi3.Instance = HCI_TL_SPI_INSTANCE;
  hspi3.Init.Mode = SPI_MODE_MASTER;
  hspi3.Init.Direction = SPI_DIRECTION_2LINES;
  hspi3.Init.DataSize = SPI_DATASIZE_8BIT;
  hspi3.Init.CLKPolarity = SPI_POLARITY_LOW;
  hspi3.Init.CLKPhase = SPI_PHASE_1EDGE;
  hspi3.Init.NSS = SPI_NSS_SOFT;
  hspi3.Init.BaudRatePrescaler = SPI_BAUDRATEPRESCALER_16;
  hspi3.Init.FirstBit = SPI_FIRSTBIT_MSB;
  hspi3.Init.TIMode = SPI_TIMODE_DISABLE;
  hspi3.Init.CRCCalculation = SPI_CRCCALCULATION_DISABLE;
  hspi3.Init.CRCPolynomial = 7;

  return (HAL_SPI_Init(&hspi3) == HAL_OK) ? 0 : -1;
}

int32_t HCI_TL_SPI_DeInit(void)
{
  HAL_GPIO_DeInit(HCI_TL_SPI_EXTI_PORT, HCI_TL_SPI_EXTI_PIN);
  HAL_GPIO_DeInit(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN);
  HAL_GPIO_DeInit(HCI_TL_RST_PORT, HCI_TL_RST_PIN);
  HAL_SPI_DeInit(&hspi3);
  return 0;
}

int32_t HCI_TL_SPI_Reset(void)
{
  HAL_GPIO_WritePin(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN, GPIO_PIN_SET);

  HAL_GPIO_WritePin(HCI_TL_RST_PORT, HCI_TL_RST_PIN, GPIO_PIN_RESET);
  HAL_Delay(5);
  HAL_GPIO_WritePin(HCI_TL_RST_PORT, HCI_TL_RST_PIN, GPIO_PIN_SET);
  HAL_Delay(5);
  return 0;
}

int32_t HCI_TL_SPI_Receive(uint8_t* buffer, uint16_t size)
{
  uint16_t byte_count;
  /* Must match byte_count's width: on a negotiated MTU this can exceed 255,
     and a uint8_t loop counter here would silently wrap at 256, causing an
     infinite read loop and out-of-bounds writes into buffer[]. */
  uint16_t len = 0;
  uint8_t char_ff = 0xff;
  uint8_t read_char;

  uint8_t header_master[HEADER_SIZE] = {0x0b, 0x00, 0x00, 0x00, 0x00};
  uint8_t header_slave[HEADER_SIZE];

  HAL_GPIO_WritePin(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN, GPIO_PIN_RESET);

  SPI3_SendRecv(header_master, header_slave, HEADER_SIZE);

  if (header_slave[0] == 0x02) {
    byte_count = (uint16_t)((header_slave[4] << 8) | header_slave[3]);

    if (byte_count > 0) {
      if (byte_count > size) {
        byte_count = size;
      }
      for (len = 0; len < byte_count; len++) {
        SPI3_SendRecv(&char_ff, &read_char, 1);
        buffer[len] = read_char;
      }
    }
  }

  HAL_GPIO_WritePin(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN, GPIO_PIN_SET);

  return len;
}

int32_t HCI_TL_SPI_Send(uint8_t* buffer, uint16_t size)
{
  int32_t result;
  uint8_t header_master[HEADER_SIZE] = {0x0a, 0x00, 0x00, 0x00, 0x00};
  uint8_t header_slave[HEADER_SIZE];
  static uint8_t scratch[MAX_BUFFER_SIZE];
  uint32_t tickstart = HAL_GetTick();

  do {
    result = 0;

    HAL_GPIO_WritePin(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN, GPIO_PIN_RESET);

    SPI3_SendRecv(header_master, header_slave, HEADER_SIZE);

    if (header_slave[0] == 0x02) {
      if (header_slave[1] >= size) {
        SPI3_SendRecv(buffer, scratch, size);
      } else {
        result = -2;
      }
    } else {
      result = -1;
    }

    HAL_GPIO_WritePin(HCI_TL_SPI_CS_PORT, HCI_TL_SPI_CS_PIN, GPIO_PIN_SET);

    if ((HAL_GetTick() - tickstart) > TIMEOUT_DURATION) {
      result = -3;
      break;
    }
  } while (result < 0);

  return result;
}

static int32_t HCI_TL_GetTick(void)
{
  return (int32_t)HAL_GetTick();
}

static int32_t IsDataAvailable(void)
{
  return (HAL_GPIO_ReadPin(HCI_TL_SPI_EXTI_PORT, HCI_TL_SPI_EXTI_PIN) == GPIO_PIN_SET);
}

void hci_tl_lowlevel_init(void)
{
  tHciIO fops;

  fops.Init    = HCI_TL_SPI_Init;
  fops.DeInit  = HCI_TL_SPI_DeInit;
  fops.Send    = HCI_TL_SPI_Send;
  fops.Receive = HCI_TL_SPI_Receive;
  fops.Reset   = HCI_TL_SPI_Reset;
  fops.GetTick = HCI_TL_GetTick;

  hci_register_io_bus(&fops);

  HAL_EXTI_GetHandle(&hexti6, HCI_TL_SPI_EXTI_LINE);
  HAL_EXTI_RegisterCallback(&hexti6, HAL_EXTI_COMMON_CB_ID, hci_tl_lowlevel_isr);
  HAL_NVIC_SetPriority(HCI_TL_SPI_EXTI_IRQn, 1, 0);
  HAL_NVIC_EnableIRQ(HCI_TL_SPI_EXTI_IRQn);
}

void hci_tl_lowlevel_isr(void)
{
  while (IsDataAvailable()) {
    if (hci_notify_asynch_evt(NULL)) {
      return;
    }
  }
}
