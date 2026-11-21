/**
  ******************************************************************************
  * @file           : stm32l4xx_it.c
  * @brief          : Interrupt Service Routines for B-L475E-IOT01A2.
  ******************************************************************************
  */

#include "main.h"
#include "stm32l4xx_it.h"
#include "led_driver.h"

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
  /* BlueNRG-MS SPI3 IRQ is on PE6 (EXTI6) */
}

void USART1_IRQHandler(void) {
  /* ST-Link VCP UART Rx Interrupt */
}
