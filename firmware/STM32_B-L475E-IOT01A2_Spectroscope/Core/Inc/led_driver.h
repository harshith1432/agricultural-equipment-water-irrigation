/**
  ******************************************************************************
  * @file           : led_driver.h
  * @brief          : Header for LED illumination driver & safety interlocks.
  ******************************************************************************
  */

#ifndef __LED_DRIVER_H
#define __LED_DRIVER_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Maximum safe continuous illumination duration in milliseconds (Failsafe) */
#define LED_AUTO_OFF_TIMEOUT_MS        15000U

typedef enum {
  LED_STATE_OFF = 0,
  LED_STATE_ON  = 1
} LedState_t;

/**
  * @brief  Initialize GPIO pins for Illumination MOSFET Gate (PB0) and User LEDs.
  */
void LED_Driver_Init(void);

/**
  * @brief  Turn ON the physical illumination LED.
  * @note   Enables PB0 (MOSFET Gate HIGH) and User LED1 (PA5). Starts watchdog timer.
  * @retval true if successfully actuated.
  */
bool LED_Driver_SetOn(void);

/**
  * @brief  Turn OFF the physical illumination LED.
  * @note   Pulls PB0 (MOSFET Gate LOW) and turns off User LED1.
  * @retval true if successfully actuated.
  */
bool LED_Driver_SetOff(void);

/**
  * @brief  Toggle LED state.
  */
void LED_Driver_Toggle(void);

/**
  * @brief  Get current illumination LED state.
  * @retval LED_STATE_ON or LED_STATE_OFF.
  */
LedState_t LED_Driver_GetState(void);

/**
  * @brief  Periodic watchdog tick to prevent LED thermal overload.
  * @note   Called from main loop. If LED remains ON longer than LED_AUTO_OFF_TIMEOUT_MS,
  *         it forces the LED off to prevent thermal runaway.
  */
void LED_Driver_Watchdog_Tick(void);

#ifdef __cplusplus
}
#endif

#endif /* __LED_DRIVER_H */
