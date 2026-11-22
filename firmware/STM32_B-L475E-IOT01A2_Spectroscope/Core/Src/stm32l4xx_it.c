/**
  ******************************************************************************
  * @file           : stm32l4xx_it.c
  * @brief          : Interrupt Service Routines for B-L475E-IOT01A2.
  ******************************************************************************
  */

#include "main.h"
#include "stm32l4xx_it.h"
#include "led_driver.h"
#include "hci_tl_interface.h"

void NMI_Handler(void) {}

void HardFault_Handler(void) {
  /* Failsafe LED shutoff */
  LED_Driver_SetOff();
  while (1) {}
}

void MemManage_Handler(void) {
  LED_Driver_SetOff();
  while (1) {}
}

void BusFault_Handler(void) {
  LED_Driver_SetOff();
  while (1) {}
}

void UsageFault_Handler(void) {
  LED_Driver_SetOff();
  while (1) {}
}

void SVC_Handler(void) {}
void DebugMon_Handler(void) {}
void PendSV_Handler(void) {}

void EXTI9_5_IRQHandler(void) {
  /* BlueNRG-MS data-ready IRQ is on PE6 (EXTI6) */
  HAL_EXTI_IRQHandler(&hexti6);
}

void USART1_IRQHandler(void) {
  /* ST-Link VCP UART Rx Interrupt */
}
