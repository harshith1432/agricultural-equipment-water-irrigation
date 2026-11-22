/**
  ******************************************************************************
  * @file    hci_tl_interface.h
  * @brief   BlueNRG-MS SPI3 transport layer pin mapping for the onboard
  *          SPBTLE-RF module on the B-L475E-IOT01A2 (PC10/11/12, PD13, PE6, PA8).
  ******************************************************************************
  */

#ifndef HCI_TL_INTERFACE_H
#define HCI_TL_INTERFACE_H

#ifdef __cplusplus
extern "C" {
#endif

#include "stm32l4xx_hal.h"

#define HCI_TL_SPI_INSTANCE    SPI3

#define HCI_TL_SPI_SCK_PORT    GPIOC
#define HCI_TL_SPI_SCK_PIN     GPIO_PIN_10
#define HCI_TL_SPI_MISO_PORT   GPIOC
#define HCI_TL_SPI_MISO_PIN    GPIO_PIN_11
#define HCI_TL_SPI_MOSI_PORT   GPIOC
#define HCI_TL_SPI_MOSI_PIN    GPIO_PIN_12
#define HCI_TL_SPI_AF          GPIO_AF6_SPI3

#define HCI_TL_SPI_CS_PORT     GPIOD
#define HCI_TL_SPI_CS_PIN      GPIO_PIN_13

#define HCI_TL_SPI_EXTI_PORT   GPIOE
#define HCI_TL_SPI_EXTI_PIN    GPIO_PIN_6
#define HCI_TL_SPI_EXTI_IRQn   EXTI9_5_IRQn
#define HCI_TL_SPI_EXTI_LINE   EXTI_LINE_6

#define HCI_TL_SPI_IRQ_PORT    GPIOE
#define HCI_TL_SPI_IRQ_PIN     GPIO_PIN_6

#define HCI_TL_RST_PORT        GPIOA
#define HCI_TL_RST_PIN         GPIO_PIN_8

extern EXTI_HandleTypeDef hexti6;
#define H_EXTI_6 hexti6

int32_t HCI_TL_SPI_Init    (void* pConf);
int32_t HCI_TL_SPI_DeInit  (void);
int32_t HCI_TL_SPI_Receive (uint8_t* buffer, uint16_t size);
int32_t HCI_TL_SPI_Send    (uint8_t* buffer, uint16_t size);
int32_t HCI_TL_SPI_Reset   (void);

void hci_tl_lowlevel_init(void);
void hci_tl_lowlevel_isr(void);

#ifdef __cplusplus
}
#endif
#endif /* HCI_TL_INTERFACE_H */
