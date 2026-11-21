/**
  ******************************************************************************
  * @file           : sensor_hal.h
  * @brief          : Header for Optical Spectrometer Sensor Hardware Abstraction.
  ******************************************************************************
  */

#ifndef __SENSOR_HAL_H
#define __SENSOR_HAL_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define SENSOR_RAW_CHANNELS            18U
#define SENSOR_INTERPOLATED_BANDS      76U

typedef struct {
  bool isInitialized;
  bool isDarkCalibrated;
  bool isWhiteCalibrated;
  uint16_t darkCounts[SENSOR_RAW_CHANNELS];
  uint16_t whiteCounts[SENSOR_RAW_CHANNELS];
  uint16_t lastRawCounts[SENSOR_RAW_CHANNELS];
  uint16_t lastInterpolatedSpectrum[SENSOR_INTERPOLATED_BANDS];
  uint32_t lastScanTimestamp;
} SpectrometerSensor_t;

/**
  * @brief  Initialize I2C2 and AS7265x optical sensor triad (AS72651, AS72652, AS72653).
  */
bool Sensor_HAL_Init(void);

/**
  * @brief  Check if optical spectrometer sensor is responding on I2C.
  */
bool Sensor_HAL_SelfTest(void);

/**
  * @brief  Acquire 18-channel raw optical integration.
  * @param  outCounts Array of at least 18 uint16_t values.
  * @retval true if read succeeded.
  */
bool Sensor_HAL_ReadRawChannels(uint16_t *outCounts);

/**
  * @brief  Execute Dark Baseline Calibration (0% Null).
  * @note   LED must be OFF. Records thermal detector leakage.
  */
bool Sensor_HAL_CalibrateDark(uint16_t *outOffset);

/**
  * @brief  Execute White Reference Standard Calibration (100% Normalization).
  * @note   LED must be ON with 99% PTFE standard in chamber.
  */
bool Sensor_HAL_CalibrateWhite(uint16_t *outPeak);

/**
  * @brief  Perform complete optical scan and generate 76-band calibrated spectrum.
  * @param  outBands Array of 76 uint16_t values (reflectance scaled 0-65535).
  * @retval true on valid scan.
  */
bool Sensor_HAL_ExecuteScan(uint16_t *outBands);

/**
  * @brief  Get sensor state structure.
  */
const SpectrometerSensor_t* Sensor_HAL_GetStatus(void);

#ifdef __cplusplus
}
#endif

#endif /* __SENSOR_HAL_H */
