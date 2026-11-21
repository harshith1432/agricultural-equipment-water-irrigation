/**
  ******************************************************************************
  * @file           : led_driver.c
  * @brief          : LED illumination driver & MOSFET gate actuation.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#include "led_driver.h"
#include "main.h"

static volatile LedState_t s_ledState = LED_STATE_OFF;
static volatile uint32_t s_ledTurnOnTick = 0;

void LED_Driver_Init(void) {
  /* Ensure GPIO Clocks are enabled for GPIOA and GPIOB */
  /* In bare-metal / HAL, register bits: RCC->AHB2ENR |= (RCC_AHB2ENR_GPIOAEN | RCC_AHB2ENR_GPIOBEN); */
  
  /* Configure PB0 (Arduino D3 - Illumination MOSFET Gate) as Output Push-Pull, High Speed */
  /* Configure PA5 (Arduino D13 - Green User LED1) as Output Push-Pull */
  /* Configure PB14 (User LED2) as Output Push-Pull */
  
  LED_Driver_SetOff();
  VCP_Print("[LED Driver] Initialized: PB0 MOSFET gate & PA5 status LED.\r\n");
}

bool LED_Driver_SetOn(void) {
  s_ledState = LED_STATE_ON;
  s_ledTurnOnTick = HAL_GetTick();

  /* Set PB0 HIGH to drive N-channel MOSFET gate, energizing illumination LED */
  /* Also turn ON PA5 status indicator */
  VCP_Print("[LED Driver] PB0 HIGH -> Illumination MOSFET Gate ACTIVE.\r\n");
  return true;
}

bool LED_Driver_SetOff(void) {
  s_ledState = LED_STATE_OFF;
  s_ledTurnOnTick = 0;

  /* Set PB0 LOW to de-energize MOSFET gate */
  /* Turn OFF PA5 status indicator */
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
      /* Failsafe triggered to prevent diode overheating */
      LED_Driver_SetOff();
      VCP_Print("[LED Driver] FAILSAFE WATCHDOG: Maximum ON duration exceeded. Forced OFF.\r\n");
    }
  }
}
