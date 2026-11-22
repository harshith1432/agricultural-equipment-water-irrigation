/**
  ******************************************************************************
  * @file           : main.c
  * @brief          : Main program body for B-L475E-IOT01A2 Spectroscope.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  * @mcu            : STM32L475VGT6 (ARM Cortex-M4 @ 80 MHz)
  ******************************************************************************
  */

#include "main.h"
#include "led_driver.h"
#include "sensor_hal.h"
#include "ble_service.h"
#include "protocol_parser.h"
#include "sd_card_driver.h"
#include "sd_storage_manager.h"
#include "ff.h"
#include <stdarg.h>

/* Global Millisecond Tick counter */
static volatile uint32_t s_msTicks = 0;

static UART_HandleTypeDef huart1;

static void VCP_Init(void) {
  __HAL_RCC_GPIOB_CLK_ENABLE();
  __HAL_RCC_USART1_CLK_ENABLE();

  GPIO_InitTypeDef gpio = {0};
  gpio.Pin = VCP_TX_PIN | VCP_RX_PIN;
  gpio.Mode = GPIO_MODE_AF_PP;
  gpio.Pull = GPIO_PULLUP;
  gpio.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  gpio.Alternate = GPIO_AF7_USART1;
  HAL_GPIO_Init(VCP_TX_PORT, &gpio);

  huart1.Instance = VCP_USART;
  huart1.Init.BaudRate = 115200;
  huart1.Init.WordLength = UART_WORDLENGTH_8B;
  huart1.Init.StopBits = UART_STOPBITS_1;
  huart1.Init.Parity = UART_PARITY_NONE;
  huart1.Init.Mode = UART_MODE_TX_RX;
  huart1.Init.HwFlowCtl = UART_HWCONTROL_NONE;
  huart1.Init.OverSampling = UART_OVERSAMPLING_16;
  HAL_UART_Init(&huart1);
}

uint32_t HAL_GetTick(void) {
  return s_msTicks;
}

void HAL_Delay(uint32_t Delay) {
  uint32_t tickstart = HAL_GetTick();
  uint32_t wait = Delay;
  if (wait < 0xFFFFFFFFU) {
    wait += 1U;
  }
  while ((HAL_GetTick() - tickstart) < wait) {
    /* Yield or NOP */
  }
}

void SysTick_Handler(void) {
  s_msTicks++;
}

void VCP_Print(const char *str) {
  /* Transmit character string over ST-Link Virtual COM Port (USART1 @ 115200) */
  if (!str) return;
  HAL_UART_Transmit(&huart1, (const uint8_t *)str, (uint16_t)strlen(str), 200);
}

void VCP_Printf(const char *fmt, ...) {
  char buf[256];
  va_list args;
  va_start(args, fmt);
  vsnprintf(buf, sizeof(buf), fmt, args);
  va_end(args);
  VCP_Print(buf);
}

void SystemClock_Config(void) {
  /* Configure System Clock to 80 MHz using PLL and MSI or HSE oscillator */
}

int main(void) {
  /* 1. Reset of all peripherals, Initializes the Flash interface and the Systick. */
  HAL_Init();
  SystemClock_Config();

  /* SystemCoreClock is set by SystemInit() (called from the startup file) to the
     default MSI 4 MHz boot clock. Configure a 1ms SysTick now - without this,
     HAL_GetTick() never advances and every HAL_Delay() call hangs forever. */
  SysTick_Config(SystemCoreClock / 1000U);

  /* 2. Initialize ST-Link Virtual COM Port (PB6 TX, PB7 RX @ 115200 8-N-1) */
  VCP_Init();
  VCP_Print("\r\n=======================================================\r\n");
  VCP_Print("   AGRISPECTRA B-L475E-IOT01A2 SPECTROSCOPE FIRMWARE   \r\n");
  VCP_Printf("   Version: %s | MCU: STM32L475VGT6 (80 MHz)          \r\n", FW_BUILD_STRING);
  VCP_Print("=======================================================\r\n");

  /* 3. Initialize Illumination MOSFET Gate Driver (PB0 / D3) & Status LEDs */
  LED_Driver_Init();

  /* 4. Initialize AS7265x Optical Spectrometer Sensor Triad (I2C2 on PB10/PB11) */
  Sensor_HAL_Init();

  /* 5. Initialize Protocol Parser and Specimen Metadata */
  Protocol_Parser_Init();

  /* 6. Initialize BlueNRG-MS SPI3 Bluetooth Low Energy Peripheral */
  BLE_Service_Init();

  /* 7. Initialize SD Storage Manager and Mount FatFs filesystem (/SCANS/) */
  SD_Storage_Init();

  VCP_Print("[System Boot] Firmware ready. Waiting for mobile BLE connection...\r\n");

  /* Main Superloop */
  uint32_t lastHeartbeatTick = 0;
  while (1) {
    /* 1. Process background BLE events */
    BLE_Service_Process();

    /* 2. Illumination LED Thermal Safety Watchdog Tick */
    LED_Driver_Watchdog_Tick();

    /* 3. Periodic Status Heartbeat (every 5 seconds) */
    uint32_t now = HAL_GetTick();
    if (now - lastHeartbeatTick >= 5000) {
      lastHeartbeatTick = now;
      const SD_StorageHealth_t *sd = SD_Storage_GetHealth();
      VCP_Printf("[Heartbeat] Uptime: %lu s | BLE: %s | LED: %s | SD: %s (%lu MB free, %lu scans)\r\n", 
                 (unsigned long)(now / 1000),
                 BLE_Service_IsConnected() ? "CONNECTED" : "ADVERTISING",
                 LED_Driver_GetState() == LED_STATE_ON ? "ON" : "OFF",
                 sd->mounted ? "MOUNTED" : (sd->detected ? "DETECTED" : "NO_CARD"),
                 (unsigned long)sd->freeCapacityMB,
                 (unsigned long)sd->fileCount);
    }
  }

  return 0;
}

void Error_Handler(void) {
  /* Turn OFF illumination LED immediately during hard faults */
  LED_Driver_SetOff();
  while (1) {
    /* Flash red/error user LED */
  }
}
