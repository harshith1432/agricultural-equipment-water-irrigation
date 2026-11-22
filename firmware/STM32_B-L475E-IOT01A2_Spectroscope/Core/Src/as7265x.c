/*
 * AS7265x driver (AS72651 NIR + AS72652 VIS + AS72653 UV, "Spectral Triad").
 * The chip set is accessed through a "virtual register" protocol on a single I2C
 * address (7-bit 0x49): physical registers 0x00 STATUS, 0x01 WRITE, 0x02 READ.
 * Register map and channel assignment follow the ams AS7265x datasheet as
 * implemented by the SparkFun AS7265x library (see LICENSES_AND_DEPENDENCIES.md).
 * Every wait is time-limited; nothing here can block forever.
 */
#include "as7265x.h"
#include "main.h"
#include "app_config.h"
#include <string.h>

#define I2C_ADDR        (AS7265X_I2C_ADDR_7BIT << 1)

#define PHY_STATUS      0x00U
#define PHY_WRITE       0x01U
#define PHY_READ        0x02U
#define ST_RX_VALID     0x01U
#define ST_TX_VALID     0x02U

#define VREG_HW_VER_H   0x00U
#define VREG_HW_VER_L   0x01U
#define VREG_CONFIG     0x04U   /* b7 reset, b6 INT en, b5:4 gain, b3:2 mode, b1 DATA_RDY */
#define VREG_INT_TIME   0x05U   /* integration = value x 2.8 ms */
#define VREG_DEV_TEMP   0x06U
#define VREG_LED_CONFIG 0x07U   /* b0 IND en, b2:1 IND I-lim, b3 DRV en, b5:4 DRV I-lim */
#define VREG_RAW_BASE   0x08U   /* 6 x 16-bit big-endian: R/G/A, S/H/B, T/I/C, U/J/D, V/K/E, W/L/F */
#define VREG_CAL_BASE   0x14U   /* 6 x IEEE-754 float, big-endian, same channel order */
#define VREG_DEV_SEL    0x4FU

#define DEV_NIR         0x00U   /* AS72651 (master) */
#define DEV_VIS         0x01U   /* AS72652 */
#define DEV_UV          0x02U   /* AS72653 */

#define CFG_RESET       0x80U
#define CFG_INT_EN      0x40U
#define CFG_GAIN_MASK   0x30U
#define CFG_MODE_MASK   0x0CU
#define CFG_MODE_6CH_ONE_SHOT (0x03U << 2)
#define CFG_DATA_RDY    0x02U

/* Wavelength order -> (device, channel slot). Slot = position in R/S/T/U/V/W register group. */
typedef struct { uint8_t dev; uint8_t slot; } chan_map_t;
const uint16_t as7265x_wavelength_nm[AS7265X_NUM_CHANNELS] =
  {410,435,460,485,510,535, 560,585,610,645,680,705, 730,760,810,860,900,940};
static const chan_map_t chan_map[AS7265X_NUM_CHANNELS] = {
  {DEV_UV,0},{DEV_UV,1},{DEV_UV,2},{DEV_UV,3},{DEV_UV,4},{DEV_UV,5},      /* 410..535 nm */
  {DEV_VIS,0},{DEV_VIS,1},{DEV_VIS,2},{DEV_VIS,3},{DEV_VIS,4},{DEV_VIS,5},/* 560..705 nm */
  {DEV_NIR,0},{DEV_NIR,1},{DEV_NIR,2},{DEV_NIR,3},{DEV_NIR,4},{DEV_NIR,5} /* 730..940 nm */
};

static bool     s_init;
static bool     s_measuring;
static uint32_t s_meas_start;
static uint8_t  s_hw_h, s_hw_l;
static uint8_t  s_led_cfg;

/* ---------- physical + virtual register access (all bounded) ---------- */
static as7265x_status_t phy_read(uint8_t reg, uint8_t *v)
{
  return (HAL_I2C_Mem_Read(&hi2c1, I2C_ADDR, reg, I2C_MEMADD_SIZE_8BIT, v, 1, I2C_TIMEOUT_MS) == HAL_OK)
         ? AS7265X_OK : AS7265X_ERR_I2C;
}
static as7265x_status_t phy_write(uint8_t reg, uint8_t v)
{
  return (HAL_I2C_Mem_Write(&hi2c1, I2C_ADDR, reg, I2C_MEMADD_SIZE_8BIT, &v, 1, I2C_TIMEOUT_MS) == HAL_OK)
         ? AS7265X_OK : AS7265X_ERR_I2C;
}

static as7265x_status_t wait_status(uint8_t mask, bool want_set, uint8_t *st_out)
{
  uint32_t t0 = HAL_GetTick();
  uint8_t st;
  for (;;) {
    as7265x_status_t r = phy_read(PHY_STATUS, &st);
    if (r != AS7265X_OK) return r;
    if (((st & mask) != 0U) == want_set) { if (st_out) *st_out = st; return AS7265X_OK; }
    if ((HAL_GetTick() - t0) > 100U) return AS7265X_ERR_TIMEOUT;
  }
}

static as7265x_status_t vreg_read(uint8_t reg, uint8_t *val)
{
  uint8_t st, junk;
  as7265x_status_t r = wait_status(ST_TX_VALID, false, &st);       /* TX buffer free */
  if (r != AS7265X_OK) return r;
  if (st & ST_RX_VALID) { (void)phy_read(PHY_READ, &junk); }        /* flush stale byte */
  if ((r = phy_write(PHY_WRITE, reg)) != AS7265X_OK) return r;
  if ((r = wait_status(ST_RX_VALID, true, NULL)) != AS7265X_OK) return r;
  return phy_read(PHY_READ, val);
}

static as7265x_status_t vreg_write(uint8_t reg, uint8_t val)
{
  as7265x_status_t r = wait_status(ST_TX_VALID, false, NULL);
  if (r != AS7265X_OK) return r;
  if ((r = phy_write(PHY_WRITE, (uint8_t)(reg | 0x80U))) != AS7265X_OK) return r;
  if ((r = wait_status(ST_TX_VALID, false, NULL)) != AS7265X_OK) return r;
  return phy_write(PHY_WRITE, val);
}

static as7265x_status_t select_dev(uint8_t dev) { return vreg_write(VREG_DEV_SEL, dev); }

static as7265x_status_t vreg_modify(uint8_t reg, uint8_t mask, uint8_t bits)
{
  uint8_t v; as7265x_status_t r = vreg_read(reg, &v);
  if (r != AS7265X_OK) return r;
  return vreg_write(reg, (uint8_t)((v & ~mask) | (bits & mask)));
}

/* ---------- public API ---------- */
as7265x_status_t as7265x_init(void)
{
  as7265x_status_t r;
  uint8_t v = 0;
  s_init = false; s_measuring = false; s_led_cfg = 0;

  if (HAL_I2C_IsDeviceReady(&hi2c1, I2C_ADDR, 2, I2C_PROBE_TIMEOUT_MS) != HAL_OK) return AS7265X_ERR_I2C;

  /* Software reset, then wait (max 2 s) for the virtual-register interface to answer again */
  (void)select_dev(DEV_NIR);
  (void)vreg_write(VREG_CONFIG, CFG_RESET);
  uint32_t t0 = HAL_GetTick();
  HAL_Delay(100);
  do {
    r = vreg_read(VREG_HW_VER_H, &v);
    if (r == AS7265X_OK) break;
    HAL_Delay(50);
  } while ((HAL_GetTick() - t0) < 2000U);
  if (r != AS7265X_OK) return r;
  if (v != 0x40U) return AS7265X_ERR_ID;
  s_hw_h = v;
  if ((r = vreg_read(VREG_HW_VER_L, &s_hw_l)) != AS7265X_OK) return r;

  /* Configure all three dies: LEDs off, integration time, gain, no interrupt */
  for (uint8_t dev = DEV_NIR; dev <= DEV_UV; dev++) {
    if ((r = select_dev(dev)) != AS7265X_OK) return r;
    if ((r = vreg_write(VREG_LED_CONFIG, 0x00U)) != AS7265X_OK) return r;
    if ((r = vreg_write(VREG_INT_TIME, (uint8_t)AS7265X_INTEGRATION_CYCLES)) != AS7265X_OK) return r;
    if ((r = vreg_modify(VREG_CONFIG, (uint8_t)(CFG_GAIN_MASK | CFG_INT_EN),
                         (uint8_t)((AS7265X_GAIN_CODE & 3U) << 4))) != AS7265X_OK) return r;
  }
  if ((r = select_dev(DEV_NIR)) != AS7265X_OK) return r;
  s_init = true;
  return AS7265X_OK;
}

as7265x_status_t as7265x_start_measurement(void)
{
  if (!s_init) return AS7265X_ERR_NOT_INIT;
  as7265x_status_t r = select_dev(DEV_NIR);
  if (r != AS7265X_OK) return r;
  /* Writing the one-shot mode bits starts one 6-channel conversion on all three dies */
  r = vreg_modify(VREG_CONFIG, CFG_MODE_MASK, CFG_MODE_6CH_ONE_SHOT);
  if (r != AS7265X_OK) return r;
  s_measuring = true; s_meas_start = HAL_GetTick();
  return AS7265X_OK;
}

static float be_float(const uint8_t *b)
{
  uint32_t u = ((uint32_t)b[0] << 24) | ((uint32_t)b[1] << 16) | ((uint32_t)b[2] << 8) | b[3];
  float f; memcpy(&f, &u, sizeof f); return f;
}

as7265x_status_t as7265x_poll(as7265x_data_t *out)
{
  if (!s_init) return AS7265X_ERR_NOT_INIT;
  if (!s_measuring) return AS7265X_ERR_BUSY;
  as7265x_status_t r;
  uint8_t cfg;

  if ((r = select_dev(DEV_NIR)) != AS7265X_OK) { s_measuring = false; return r; }
  if ((r = vreg_read(VREG_CONFIG, &cfg)) != AS7265X_OK) { s_measuring = false; return r; }
  if ((cfg & CFG_DATA_RDY) == 0U) {
    if ((HAL_GetTick() - s_meas_start) > SENSOR_MEAS_TIMEOUT_MS) { s_measuring = false; return AS7265X_ERR_TIMEOUT; }
    return AS7265X_ERR_BUSY;
  }

  /* data ready: read raw + calibrated values of the three dies */
  for (uint8_t dev = DEV_NIR; dev <= DEV_UV; dev++) {
    uint8_t rawb[12], calb[24], t;
    if ((r = select_dev(dev)) != AS7265X_OK) goto fail;
    for (uint8_t i = 0; i < 12U; i++) if ((r = vreg_read((uint8_t)(VREG_RAW_BASE + i), &rawb[i])) != AS7265X_OK) goto fail;
    for (uint8_t i = 0; i < 24U; i++) if ((r = vreg_read((uint8_t)(VREG_CAL_BASE + i), &calb[i])) != AS7265X_OK) goto fail;
    if ((r = vreg_read(VREG_DEV_TEMP, &t)) != AS7265X_OK) goto fail;
    out->dev_temp_c[dev] = t;
    for (uint8_t c = 0; c < AS7265X_NUM_CHANNELS; c++) {
      if (chan_map[c].dev != dev) continue;
      uint8_t s = chan_map[c].slot;
      out->raw[c] = (uint16_t)(((uint16_t)rawb[2U * s] << 8) | rawb[2U * s + 1U]);
      out->cal[c] = be_float(&calb[4U * s]);
    }
  }
  (void)select_dev(DEV_NIR);
  s_measuring = false;
  return AS7265X_OK;
fail:
  s_measuring = false;
  return r;
}

static as7265x_status_t led_apply(void)
{
  as7265x_status_t r;
  for (uint8_t dev = DEV_NIR; dev <= DEV_UV; dev++) {
    if ((r = select_dev(dev)) != AS7265X_OK) return r;
    if ((r = vreg_write(VREG_LED_CONFIG, s_led_cfg)) != AS7265X_OK) return r;
  }
  return select_dev(DEV_NIR);
}
/* IND current-limit bits left at 00 (1 mA); DRV current-limit bits left at 00 (12.5 mA) = safe defaults */
as7265x_status_t as7265x_set_indicator_led(bool on)
{ if (!s_init) return AS7265X_ERR_NOT_INIT; if (on) s_led_cfg |= 0x01U; else s_led_cfg &= (uint8_t)~0x01U; return led_apply(); }
as7265x_status_t as7265x_set_bulb(bool on)
{ if (!s_init) return AS7265X_ERR_NOT_INIT; if (on) s_led_cfg |= 0x08U; else s_led_cfg &= (uint8_t)~0x08U; return led_apply(); }

uint8_t as7265x_hw_version_high(void) { return s_hw_h; }
uint8_t as7265x_hw_version_low(void)  { return s_hw_l; }
const char *as7265x_status_str(as7265x_status_t s)
{
  switch (s) {
    case AS7265X_OK: return "ok";
    case AS7265X_ERR_I2C: return "i2c_error";
    case AS7265X_ERR_TIMEOUT: return "timeout";
    case AS7265X_ERR_ID: return "wrong_device_id";
    case AS7265X_ERR_NOT_INIT: return "not_initialised";
    default: return "busy";
  }
}
