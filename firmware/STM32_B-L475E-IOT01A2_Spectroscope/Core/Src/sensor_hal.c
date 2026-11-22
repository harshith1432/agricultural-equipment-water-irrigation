/**
  ******************************************************************************
  * @file           : sensor_hal.c
  * @brief          : Optical Spectrometer Sensor Driver (AS7265x Triad / 76-Band).
  *                   Thin adapter over the real as7265x.c driver (vendored
  *                   verbatim from the verified STM32_DualSensor_WebDashboard
  *                   project) on I2C1 (PB8 SCL / PB9 SDA - the Arduino header's
  *                   dedicated I2C pins, confirmed by that project's own
  *                   PIN_CONFIGURATION_GUIDE.md and by live hardware testing).
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#include "sensor_hal.h"
#include "main.h"
#include "led_driver.h"
#include "as7265x.h"
#include "app_config.h"
#include <math.h>

static SpectrometerSensor_t s_sensor = {0};

/* Global HAL handle: as7265x.c references `extern I2C_HandleTypeDef hi2c1;`
   declared in main.h, matching the original project's convention exactly. */
I2C_HandleTypeDef hi2c1;

/* Wavelengths (nm) of as7265x_data_t's 18 channels, already in ascending
   410..940 order - matches the CSV header ch_410..ch_940 used elsewhere. */
static const uint16_t CHANNEL_WAVELENGTHS[SENSOR_RAW_CHANNELS] = {
  410, 435, 460, 485, 510, 535,
  560, 585, 610, 645, 680, 705,
  730, 760, 810, 860, 900, 940
};

static bool I2C1_Init(void) {
  GPIO_InitTypeDef gpio = {0};

  __HAL_RCC_GPIOB_CLK_ENABLE();

  RCC->CR |= RCC_CR_HSION;
  uint32_t start = HAL_GetTick();
  while (!(RCC->CR & RCC_CR_HSIRDY)) {
    if ((HAL_GetTick() - start) > 50) break;
  }
  RCC->CCIPR &= ~RCC_CCIPR_I2C1SEL_Msk;
  RCC->CCIPR |= RCC_CCIPR_I2C1SEL_1; /* I2C1 kernel clock = HSI16 */

  __HAL_RCC_I2C1_CLK_ENABLE();

  gpio.Pin = SENSORS_I2C_SCL_PIN | SENSORS_I2C_SDA_PIN;
  gpio.Mode = GPIO_MODE_AF_OD;
  gpio.Pull = GPIO_PULLUP;
  gpio.Speed = GPIO_SPEED_FREQ_VERY_HIGH;
  gpio.Alternate = GPIO_AF4_I2C1;
  HAL_GPIO_Init(SENSORS_I2C_SCL_PORT, &gpio);

  hi2c1.Instance = SENSORS_I2C;
  hi2c1.Init.Timing = 0x10909CECU; /* 100 kHz standard mode @ 16 MHz I2C kernel clock */
  hi2c1.Init.OwnAddress1 = 0;
  hi2c1.Init.AddressingMode = I2C_ADDRESSINGMODE_7BIT;
  hi2c1.Init.DualAddressMode = I2C_DUALADDRESS_DISABLE;
  hi2c1.Init.OwnAddress2 = 0;
  hi2c1.Init.GeneralCallMode = I2C_GENERALCALL_DISABLE;
  hi2c1.Init.NoStretchMode = I2C_NOSTRETCH_DISABLE;

  return (HAL_I2C_Init(&hi2c1) == HAL_OK);
}

bool Sensor_HAL_Init(void) {
  memset(&s_sensor, 0, sizeof(s_sensor));

  if (!I2C1_Init()) {
    VCP_Print("[Sensor HAL] I2C1 peripheral init failed.\r\n");
    return false;
  }

  as7265x_status_t r = as7265x_init();
  if (r != AS7265X_OK) {
    VCP_Printf("[Sensor HAL] AS7265x not detected on I2C1 (%s).\r\n", as7265x_status_str(r));
    s_sensor.isInitialized = false;
    return false;
  }

  VCP_Printf("[Sensor HAL] AS7265x ONLINE (real driver), HW ver %02X.%02X, gain=16x, int=49 cycles.\r\n",
             as7265x_hw_version_high(), as7265x_hw_version_low());

  s_sensor.isInitialized = true;
  s_sensor.isDarkCalibrated = false;
  s_sensor.isWhiteCalibrated = false;
  return true;
}

bool Sensor_HAL_SelfTest(void) {
  return s_sensor.isInitialized;
}

bool Sensor_HAL_ReadRawChannels(uint16_t *outCounts) {
  if (!outCounts || !s_sensor.isInitialized) return false;

  /* Mirror the external illumination MOSFET's state onto the sensor's own
     onboard bulb driver too, matching the verified reference firmware. */
  as7265x_set_bulb(LED_Driver_GetState() == LED_STATE_ON);

  if (as7265x_start_measurement() != AS7265X_OK) {
    return false;
  }

  as7265x_data_t data;
  as7265x_status_t r;
  uint32_t start = HAL_GetTick();
  do {
    r = as7265x_poll(&data);
    if (r == AS7265X_OK) break;
    if (r != AS7265X_ERR_BUSY) {
      VCP_Printf("[Sensor HAL] AS7265x read failed (%s).\r\n", as7265x_status_str(r));
      return false;
    }
    HAL_Delay(5);
  } while ((HAL_GetTick() - start) < (SENSOR_MEAS_TIMEOUT_MS + 200U));

  if (r != AS7265X_OK) {
    VCP_Print("[Sensor HAL] AS7265x measurement timeout.\r\n");
    return false;
  }

  memcpy(outCounts, data.raw, sizeof(data.raw));
  memcpy(s_sensor.lastRawCounts, data.raw, sizeof(data.raw));
  return true;
}

bool Sensor_HAL_CalibrateDark(uint16_t *outOffset) {
  LED_Driver_SetOff();
  HAL_Delay(50);

  uint16_t raw[SENSOR_RAW_CHANNELS];
  if (!Sensor_HAL_ReadRawChannels(raw)) {
    return false;
  }

  uint32_t sum = 0;
  for (uint8_t i = 0; i < SENSOR_RAW_CHANNELS; i++) {
    s_sensor.darkCounts[i] = raw[i];
    sum += raw[i];
  }

  s_sensor.isDarkCalibrated = true;
  if (outOffset) {
    *outOffset = (uint16_t)(sum / SENSOR_RAW_CHANNELS);
  }

  VCP_Printf("[Sensor HAL] DARK Baseline Calibrated (real AS7265x): Avg offset = %u counts.\r\n",
             (unsigned int)(sum / SENSOR_RAW_CHANNELS));
  return true;
}

bool Sensor_HAL_CalibrateWhite(uint16_t *outPeak) {
  LED_Driver_SetOn();
  HAL_Delay(150);

  uint16_t raw[SENSOR_RAW_CHANNELS];
  bool ok = Sensor_HAL_ReadRawChannels(raw);

  LED_Driver_SetOff();

  if (!ok) return false;

  uint16_t maxPeak = 0;
  for (uint8_t i = 0; i < SENSOR_RAW_CHANNELS; i++) {
    s_sensor.whiteCounts[i] = raw[i];
    if (raw[i] > maxPeak) maxPeak = raw[i];
  }

  s_sensor.isWhiteCalibrated = true;
  if (outPeak) *outPeak = maxPeak;

  VCP_Printf("[Sensor HAL] WHITE Reference Calibrated (real AS7265x): Peak = %u counts.\r\n",
             (unsigned int)maxPeak);
  return true;
}

bool Sensor_HAL_ExecuteScan(uint16_t *outBands) {
  if (!outBands) return false;

  LED_Driver_SetOn();
  HAL_Delay(120);

  uint16_t raw[SENSOR_RAW_CHANNELS];
  bool ok = Sensor_HAL_ReadRawChannels(raw);

  LED_Driver_SetOff();
  as7265x_set_bulb(false);

  if (!ok) return false;

  /* Compute per-channel reflectance using dark/white calibration if available,
     then linearly interpolate across the 18 real channel wavelengths to the
     76-band 350-1100nm output grid. */
  float reflectance[SENSOR_RAW_CHANNELS];
  for (uint8_t i = 0; i < SENSOR_RAW_CHANNELS; i++) {
    float value;
    if (s_sensor.isDarkCalibrated && s_sensor.isWhiteCalibrated &&
        s_sensor.whiteCounts[i] > s_sensor.darkCounts[i]) {
      value = (float)(raw[i] - s_sensor.darkCounts[i]) /
              (float)(s_sensor.whiteCounts[i] - s_sensor.darkCounts[i]);
    } else {
      value = (float)raw[i] / 65535.0f;
    }
    if (value < 0.0f) value = 0.0f;
    if (value > 1.0f) value = 1.0f;
    reflectance[i] = value;
  }

  for (uint8_t b = 0; b < SENSOR_INTERPOLATED_BANDS; b++) {
    uint16_t wl = 350 + (b * 10);
    float norm;

    if (wl <= CHANNEL_WAVELENGTHS[0]) {
      norm = reflectance[0];
    } else if (wl >= CHANNEL_WAVELENGTHS[SENSOR_RAW_CHANNELS - 1]) {
      norm = reflectance[SENSOR_RAW_CHANNELS - 1];
    } else {
      uint8_t lo = 0;
      while (lo < SENSOR_RAW_CHANNELS - 1 && CHANNEL_WAVELENGTHS[lo + 1] < wl) {
        lo++;
      }
      uint16_t wlLo = CHANNEL_WAVELENGTHS[lo];
      uint16_t wlHi = CHANNEL_WAVELENGTHS[lo + 1];
      float t = (wlHi > wlLo) ? ((float)(wl - wlLo) / (float)(wlHi - wlLo)) : 0.0f;
      norm = reflectance[lo] + t * (reflectance[lo + 1] - reflectance[lo]);
    }

    if (norm < 0.0f) norm = 0.0f;
    if (norm > 1.0f) norm = 1.0f;

    outBands[b] = (uint16_t)(norm * 65535.0f);
    s_sensor.lastInterpolatedSpectrum[b] = outBands[b];
  }

  s_sensor.lastScanTimestamp = HAL_GetTick();
  VCP_Print("[Sensor HAL] Scan executed: 76 spectral bands derived from the real AS7265x driver.\r\n");
  return true;
}

const SpectrometerSensor_t* Sensor_HAL_GetStatus(void) {
  return &s_sensor;
}
