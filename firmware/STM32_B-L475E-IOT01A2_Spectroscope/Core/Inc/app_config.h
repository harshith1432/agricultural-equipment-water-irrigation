/**
  ******************************************************************************
  * @file    app_config.h
  * @brief   AS7265x driver timing/gain constants, copied from the verified
  *          original STM32_DualSensor_WebDashboard project (app_config.h) so
  *          the vendored as7265x.c driver compiles and behaves identically.
  ******************************************************************************
  */

#ifndef APP_CONFIG_H
#define APP_CONFIG_H

#define SENSOR_MEAS_TIMEOUT_MS      1500U   /* give up on one measurement after this long */
#define AS7265X_INTEGRATION_CYCLES  49U     /* integration time = cycles x 2.8 ms (~137 ms) */
#define AS7265X_GAIN_CODE           2U      /* 0=1x 1=3.7x 2=16x 3=64x */
#define I2C_TIMEOUT_MS              25U     /* per I2C transfer */
#define I2C_PROBE_TIMEOUT_MS        10U     /* "is anything at this address?" check */

#endif /* APP_CONFIG_H */
