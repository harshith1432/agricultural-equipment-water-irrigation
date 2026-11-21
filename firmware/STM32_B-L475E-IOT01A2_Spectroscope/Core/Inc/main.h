/**
  ******************************************************************************
  * @file           : main.h
  * @brief          : Header for main.c file.
  *                   This file contains the common defines of the application.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  * @mcu            : STM32L475VGT6
  ******************************************************************************
  */

#ifndef __MAIN_H
#define __MAIN_H

#ifdef __cplusplus
extern "C" {
#endif

/* Includes ------------------------------------------------------------------*/
#include <stdint.h>
#include <stdbool.h>
#include <string.h>
#include <stdio.h>

/* Board Pin Definitions -----------------------------------------------------*/

/* Illumination LED Driver (External N-Channel MOSFET Gate) */
#define ILLUM_LED_PORT                 GPIOB
#define ILLUM_LED_PIN                  (1U << 0)   /* PB0 - Arduino D3 */

/* Onboard User Diagnostic LEDs */
#define USER_LED1_PORT                 GPIOA
#define USER_LED1_PIN                  (1U << 5)   /* PA5 - Arduino D13 (Green) */
#define USER_LED2_PORT                 GPIOB
#define USER_LED2_PIN                  (1U << 14)  /* PB14 (User LED2) */

/* BlueNRG-MS SPI3 Interface Pins */
#define BNRG_SPI_INSTANCE              SPI3
#define BNRG_SPI_SCK_PORT              GPIOC
#define BNRG_SPI_SCK_PIN               (1U << 10)  /* PC10 */
#define BNRG_SPI_MISO_PORT             GPIOC
#define BNRG_SPI_MISO_PIN              (1U << 11)  /* PC11 */
#define BNRG_SPI_MOSI_PORT             GPIOC
#define BNRG_SPI_MOSI_PIN              (1U << 12)  /* PC12 */

#define BNRG_SPI_CS_PORT               GPIOD
#define BNRG_SPI_CS_PIN                (1U << 13)  /* PD13 - Active Low */

#define BNRG_SPI_IRQ_PORT              GPIOE
#define BNRG_SPI_IRQ_PIN               (1U << 6)   /* PE6 - EXTI6 */

#define BNRG_SPI_RESET_PORT            GPIOA
#define BNRG_SPI_RESET_PIN             (1U << 8)   /* PA8 - Active Low */

/* ST-Link Virtual COM Port (USART1 @ 115200 8-N-1) */
#define VCP_USART                      USART1
#define VCP_TX_PORT                    GPIOB
#define VCP_TX_PIN                     (1U << 6)   /* PB6 */
#define VCP_RX_PORT                    GPIOB
#define VCP_RX_PIN                     (1U << 7)   /* PB7 */

/* AS7265x Spectrometer I2C2 Interface */
#define SENSORS_I2C                    I2C2
#define SENSORS_I2C_SCL_PORT           GPIOB
#define SENSORS_I2C_SCL_PIN            (1U << 10)  /* PB10 */
#define SENSORS_I2C_SDA_PORT           GPIOB
#define SENSORS_I2C_SDA_PIN            (1U << 11)  /* PB11 */

/* External SPI SD Card Module (Arduino Uno Expansion Header) */
#define SD_SPI_INSTANCE                SPI1
#define SD_SPI_SCK_PORT                GPIOA
#define SD_SPI_SCK_PIN                 (1U << 5)   /* PA5 - Arduino D13 (Shared with User LED1) */
#define SD_SPI_MISO_PORT               GPIOA
#define SD_SPI_MISO_PIN                (1U << 6)   /* PA6 - Arduino D12 */
#define SD_SPI_MOSI_PORT               GPIOA
#define SD_SPI_MOSI_PIN                (1U << 7)   /* PA7 - Arduino D11 */
#define SD_CS_PORT                     GPIOB
#define SD_CS_PIN                      (1U << 1)   /* PB1 - Arduino D4 (Active Low) */
#define SD_CD_PORT                     GPIOC
#define SD_CD_PIN                      (1U << 2)   /* PC2 - Arduino A1 (Card Detect, Active Low) */

/* Firmware Metadata */
#define FW_VERSION_MAJOR               2
#define FW_VERSION_MINOR               1
#define FW_VERSION_PATCH               0
#define FW_BUILD_STRING                "v2.1.0-STM32L475-AS7265X"
#define BOARD_MODEL_STRING             "B-L475E-IOT01A2"
#define BLE_DEVICE_NAME                "AgriSpectra_475"

/* Exported Functions --------------------------------------------------------*/
void Error_Handler(void);
void SystemClock_Config(void);
void VCP_Print(const char *str);
void VCP_Printf(const char *fmt, ...);
uint32_t HAL_GetTick(void);
void HAL_Delay(uint32_t Delay);

#ifdef __cplusplus
}
#endif

#endif /* __MAIN_H */
