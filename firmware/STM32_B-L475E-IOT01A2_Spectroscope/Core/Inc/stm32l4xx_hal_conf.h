/**
  ******************************************************************************
  * @file           : stm32l4xx_hal_conf.h
  * @brief          : HAL configuration template file.
  ******************************************************************************
  */

#ifndef __STM32L4xx_HAL_CONF_H
#define __STM32L4xx_HAL_CONF_H

#ifdef __cplusplus
extern "C" {
#endif

#define HAL_MODULE_ENABLED
#define HAL_GPIO_MODULE_ENABLED
#define HAL_EXTI_MODULE_ENABLED
#define HAL_SPI_MODULE_ENABLED
#define HAL_I2C_MODULE_ENABLED
#define HAL_UART_MODULE_ENABLED
#define HAL_RCC_MODULE_ENABLED
#define HAL_FLASH_MODULE_ENABLED
#define HAL_PWR_MODULE_ENABLED
#define HAL_CORTEX_MODULE_ENABLED

#define HSE_VALUE    ((uint32_t)8000000U)
#define MSI_VALUE    ((uint32_t)4000000U)
#define HSI_VALUE    ((uint32_t)16000000U)
#define LSE_VALUE    ((uint32_t)32768U)
#define LSI_VALUE    ((uint32_t)32000U)
#define VDD_VALUE    ((uint32_t)3300U)
#define TICK_INT_PRIORITY            ((uint32_t)0U)
#define PREFETCH_ENABLE              1U
#define INSTRUCTION_CACHE_ENABLE     1U
#define DATA_CACHE_ENABLE            1U

#ifdef __cplusplus
}
#endif

#endif /* __STM32L4xx_HAL_CONF_H */
