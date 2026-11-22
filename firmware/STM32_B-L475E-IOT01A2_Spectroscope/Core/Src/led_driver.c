/**
  ******************************************************************************
  * @file           : led_driver.c
  * @brief          : LED illumination driver & MOSFET gate actuation.
  *                   PB0 = external broadband illumination MOSFET gate (real
  *                   GPIO drive). PB14 = onboard status LED, driven to reflect
  *                   live BLE connection activity.
  *                   Note: PA5 (User LED1) is physically shared with the SD
  *                   card's SPI1 SCK line on this board and is intentionally
  *                   left unused here to avoid bus contention.
  ******************************************************************************
  */

#include "led_driver.h"
#include "main.h"

static volatile LedState_t s_ledState = LED_STATE_OFF;
static volatile uint32_t s_ledTurnOnTick = 0;

void LED_Driver_Init(void) {
  __HAL_RCC_GPIOB_CLK_ENABLE();

  GPIO_InitTypeDef gpio = {0};
  gpio.Mode = GPIO_MODE_OUTPUT_PP;
  gpio.Pull = GPIO_NOPULL;
  gpio.Speed = GPIO_SPEED_FREQ_LOW;

  gpio.Pin = ILLUM_LED_PIN;
  HAL_GPIO_Init(ILLUM_LED_PORT, &gpio);
  HAL_GPIO_WritePin(ILLUM_LED_PORT, ILLUM_LED_PIN, GPIO_PIN_RESET);

  gpio.Pin = USER_LED2_PIN;
  HAL_GPIO_Init(USER_LED2_PORT, &gpio);
  HAL_GPIO_WritePin(USER_LED2_PORT, USER_LED2_PIN, GPIO_PIN_RESET);

  VCP_Print("[LED Driver] Initialized: PB0 MOSFET gate (illumination), PB14 (BLE activity).\r\n");
}

bool LED_Driver_SetOn(void) {
  s_ledState = LED_STATE_ON;
  s_ledTurnOnTick = HAL_GetTick();

  HAL_GPIO_WritePin(ILLUM_LED_PORT, ILLUM_LED_PIN, GPIO_PIN_SET);
  VCP_Print("[LED Driver] PB0 HIGH -> Illumination MOSFET Gate ACTIVE.\r\n");
  return true;
}

bool LED_Driver_SetOff(void) {
  s_ledState = LED_STATE_OFF;
  s_ledTurnOnTick = 0;

  HAL_GPIO_WritePin(ILLUM_LED_PORT, ILLUM_LED_PIN, GPIO_PIN_RESET);
  VCP_Print("[LED Driver] PB0 LOW -> Illumination MOSFET Gate OFF.\r\n");
  return true;
}

void LED_Driver_Toggle(void) {
  if (s_ledState == LED_STATE_ON) {
    LED_Driver_SetOff();
  } else {
    LED_Driver_SetOn();
  }
}

LedState_t LED_Driver_GetState(void) {
  return s_ledState;
}

void LED_Driver_Watchdog_Tick(void) {
  if (s_ledState == LED_STATE_ON) {
    uint32_t currentTick = HAL_GetTick();
    if ((currentTick - s_ledTurnOnTick) > LED_AUTO_OFF_TIMEOUT_MS) {
      LED_Driver_SetOff();
      VCP_Print("[LED Driver] FAILSAFE WATCHDOG: Maximum ON duration exceeded. Forced OFF.\r\n");
    }
  }
}

void LED_Status_SetBleActive(bool active) {
  HAL_GPIO_WritePin(USER_LED2_PORT, USER_LED2_PIN, active ? GPIO_PIN_SET : GPIO_PIN_RESET);
}
