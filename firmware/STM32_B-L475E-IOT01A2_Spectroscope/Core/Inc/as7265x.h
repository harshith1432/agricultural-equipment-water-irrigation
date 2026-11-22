#ifndef AS7265X_H
#define AS7265X_H
#include <stdint.h>
#include <stdbool.h>

#define AS7265X_NUM_CHANNELS 18U
#define AS7265X_I2C_ADDR_7BIT 0x49U

typedef enum {
  AS7265X_OK = 0,
  AS7265X_ERR_I2C,        /* HAL I2C transfer failed (no ACK, bus error, HAL timeout) */
  AS7265X_ERR_TIMEOUT,    /* virtual-register handshake or measurement timed out */
  AS7265X_ERR_ID,         /* HW version register did not read 0x40 */
  AS7265X_ERR_NOT_INIT,
  AS7265X_ERR_BUSY
} as7265x_status_t;

typedef struct {
  float    cal[AS7265X_NUM_CHANNELS];   /* calibrated values, wavelength order 410..940 nm */
  uint16_t raw[AS7265X_NUM_CHANNELS];   /* raw 16-bit channel counts, same order */
  uint8_t  dev_temp_c[3];               /* die temperature of AS72651 (NIR), AS72652 (VIS), AS72653 (UV) */
} as7265x_data_t;

extern const uint16_t as7265x_wavelength_nm[AS7265X_NUM_CHANNELS];

as7265x_status_t as7265x_init(void);                   /* probe, reset, configure. Bounded (~2 s worst case). */
as7265x_status_t as7265x_start_measurement(void);      /* starts a 6-channel one-shot measurement, returns at once */
as7265x_status_t as7265x_poll(as7265x_data_t *out);    /* AS7265X_OK = data in *out, AS7265X_ERR_BUSY = not ready yet */
as7265x_status_t as7265x_set_indicator_led(bool on);   /* on-board indicator LEDs (1 mA limit) */
as7265x_status_t as7265x_set_bulb(bool on);            /* DRV output for external bulbs, 12.5 mA limit */
uint8_t  as7265x_hw_version_high(void);
uint8_t  as7265x_hw_version_low(void);
const char *as7265x_status_str(as7265x_status_t s);
#endif
