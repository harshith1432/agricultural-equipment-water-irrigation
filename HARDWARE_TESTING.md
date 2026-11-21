# AgriSpectra Flow & Field: Spectroscope Physical Bench Testing Guide

**Target Board:** STMicroelectronics B-L475E-IOT01A2  
**MCU:** STM32L475VGT6  
**Tools Required:**
- USB Micro-B cable (connected to ST-LINK USB port CN1)
- Digital Multimeter (DMM) or Logic Analyzer / Oscilloscope
- Android Smartphone with AgriSpectra Mobile Application
- Optional: Serial Terminal program (PuTTY, Tera Term, Minicom, screen)
- Optional: BLE Scanner App (nRF Connect for Mobile)

---

## 1. Bench Setup & Hardware Wiring Check

Before powering the board, inspect the physical wiring:

```
                  B-L475E-IOT01A2 BOARD
               +--------------------------+
               |                          |
Arduino D3 ----| PB0 (MOSFET Gate Signal) |-----> [ Gate (Pin 1) of 2N7002 / IRLML2502 ]
               |                          |           |
Arduino GND ---| GND                      |-----> [ Source (Pin 2) & External Supply GND ]
               |                          |
Arduino +3V3 --| +3.3V                    |-----> [ AS7265x VDD (if external) ]
               |                          |
Arduino D15 ---| PB10 (I2C2_SCL)          |-----> [ AS7265x SCL ]
Arduino D14 ---| PB11 (I2C2_SDA)          |-----> [ AS7265x SDA ]
               +--------------------------+
```

### Illumination Circuit Verification

1. Measure resistance between `PB0` (Arduino D3) and `GND`: Should be ~10 kΩ (gate pull-down resistor).
2. Measure resistance between LED cathode and MOSFET Drain: Continuity (< 1 Ω).
3. Connect External Illumination Power Supply (e.g. +5V or +12V) cathode to common ground with STM32 GND.

---

## 2. Test 1: ST-Link Virtual COM Port (VCP) Serial Verification

The STM32 firmware boots and outputs diagnostic logs to `USART1` through the onboard ST-LINK VCP:
- **Port:** Operating system assigned COM port (e.g. `COM9` on Windows, `/dev/ttyACM0` on Linux)
- **Baud Rate:** `115200`
- **Data Bits:** `8`
- **Parity:** `None`
- **Stop Bits:** `1`
- **Flow Control:** `None`

### Execution Steps

1. Plug USB cable into ST-LINK connector `CN1`.
2. Open terminal at 115200 baud.
3. Press black **RESET** button (B2) on the B-L475E-IOT01A2 board.
4. Verify boot banner:
   ```
   =======================================================
      AGRISPECTRA B-L475E-IOT01A2 SPECTROSCOPE FIRMWARE   
      Version: v2.1.0-STM32L475-AS7265X | MCU: STM32L475VGT6 (80 MHz)          
   =======================================================
   [LED Driver] Initialized: PB0 MOSFET gate & PA5 status LED.
   [Sensor HAL] Initialized AS7265x optical spectrometer triad interface.
   [BLE Service] BlueNRG-MS SPI3 initialized. Device name: AgriSpectra_475
   [BLE Service] BLE Advertising active (Interval: 100ms, Connectable Undirected).
   [System Boot] Firmware ready. Waiting for mobile BLE connection...
   ```

---

## 3. Test 2: Hardware Illumination Actuation (DMM PB0 Voltage)

Test actuation of the external illumination MOSFET driver:

1. In the serial terminal or via BLE, send:
   ```
   LED_ON
   ```
2. Check terminal response:
   ```
   [Protocol RX] "LED_ON"
   [LED Driver] PB0 HIGH -> Illumination MOSFET Gate ACTIVE.
   [Protocol TX] $ACK:LED_ON,STATUS=ON,GATE=PB0
   ```
3. **Multimeter Measurement:**
   - Probe positive lead on `PB0` (Arduino D3), negative lead on `GND`.
   - **Expected Voltage:** `3.28V – 3.32V DC` (Logic HIGH).
   - Illumination LED must illuminate brightly.
   - Onboard User LED1 (`PA5`, Arduino D13) illuminates green.

4. Send:
   ```
   LED_OFF
   ```
5. Check terminal response:
   ```
   [Protocol RX] "LED_OFF"
   [LED Driver] PB0 LOW -> Illumination MOSFET Gate OFF.
   [Protocol TX] $ACK:LED_OFF,STATUS=OFF,GATE=PB0
   ```
6. **Multimeter Measurement:**
   - **Expected Voltage:** `0.00V – 0.05V DC` (Logic LOW).
   - Illumination LED extinguishes completely.
   - Onboard User LED1 (`PA5`) turns OFF.

7. **Thermal Watchdog Verification:**
   - Send `LED_ON`.
   - Leave undisturbed for 15 seconds.
   - Verify that the LED automatically turns OFF and the terminal reports:
     ```
     [LED Driver] FAILSAFE WATCHDOG: Maximum ON duration exceeded. Forced OFF.
     ```

---

## 4. Test 3: Bluetooth Low Energy Discovery (nRF Connect or Mobile App)

1. Open **nRF Connect for Mobile** or the **AgriSpectra App**.
2. Scan for Bluetooth devices.
3. Look for advertised device name: `AgriSpectra_475` or `BlueNRG_Chat`.
4. Connect to the device.
5. Inspect GATT Services:
   - Primary Service: `00000000-000e-11e1-9ab4-0002a5d5c51b`
   - Characteristic `d973f2e1-b19e-11e2-9e96-0800200c9a66` (Notify)
   - Characteristic `d973f2e2-b19e-11e2-9e96-0800200c9a66` (Write / WriteWithoutResponse)
6. Enable Notifications on `d973f2e1`.
7. Write `HELLO\r\n` (ASCII) to `d973f2e2`.
8. Verify incoming notification:
   ```
   $ACK:HELLO,DEVICE=B-L475E-IOT01A2,FW=2.1.0,STATUS=OK
   ```

---

## 5. Test 4: Mobile App Hardware Diagnostics Screen Testing

Launch the AgriSpectra Mobile Application on your smartphone:

1. Navigate to the **Spectroscopy** tab.
2. At the top of the screen, tap **`[🔧 Diagnostics]`**.
3. The **Hardware Diagnostics Screen** opens.
4. Verify that **Operating Mode** displays `REAL HARDWARE` (green indicator).
5. Perform sequential verification using the 10 diagnostic test buttons:

| # | Button | Action Performed | Expected Visual Feedback |
|---|---|---|---|
| **1** | **`1. Connect`** | Opens BLE scanner modal and pairs with device | Status badge transitions to `CONNECTED`, MAC & MTU populate |
| **2** | **`3. Handshake`** | Sends `HELLO\r\n` and validates firmware ACK | Toast: `✓ Handshake Verified: v2.1.0-STM32L475` |
| **3** | **`4. LED ON`** | Sends `LED_ON\r\n` | Physical LED turns ON, LED indicator badge glows amber `ON (Active)` |
| **4** | **`5. LED OFF`** | Sends `LED_OFF\r\n` | Physical LED turns OFF, badge changes to `OFF` |
| **5** | **`6. Read Status`** | Queries `GET_STATUS\r\n` | Telemetry grid updates with sensor status and battery |
| **6** | **`7. Test Sensor`** | Tests AS7265x triad communication | Sensor status confirms `READY` |
| **7** | **`8. Calib Dark`** | Sends `START_DARK_CALIBRATION\r\n` | Calibration badge indicates `CALIBRATING`, then stores 0% null offset |
| **8** | **`9. Calib White`** | Sends `START_WHITE_CALIBRATION\r\n` | LED briefly turns ON, records 100% PTFE standard, turns LED OFF |
| **9** | **`10. Test Scan`** | Executes full 20-step optical integration | LED turns ON, integrates 18 channels, LED turns OFF, displays 76-band curve |
| **10**| **`2. Disconnect`**| Gracefully terminates BLE connection | Badge changes to `DISCONNECTED` |

6. In the **Live Wire Protocol Terminal**, verify that all commands show formatted `[TX]`, `[RX]`, and `[ACK]` lines with microsecond timestamps.

---

## 6. Test 5: Specimen Metadata Synchronization Verification

1. In the **Guided Studio** or **Diagnostics** mode, tap **"Enter Data in Pop-up"**.
2. Enter specimen parameters:
   - **Plant Name:** `Roma Tomato`
   - **Plant Number:** `PLANT-108`
   - **Pot / Row:** `POT-04`
   - **Zone:** `Zone 2`
3. Tap **"Save & Transmit to Sensor"**.
4. Observe the live terminal:
   ```
   [TX] SET_METADATA PLANT=PLANT-108,NAME=Roma Tomato,POT=POT-04
   [ACK] $ACK:SET_METADATA,PLANT=PLANT-108,NAME=Roma Tomato,POT=POT-04,STATUS=OK
   ```
5. Confirm toast message: `✓ Hardware Specimen Confirmed: STM32 acknowledged #PLANT-108 (Roma Tomato)`.
6. Verify that if Bluetooth is disconnected, the app alerts that metadata was saved locally and will sync once reconnected.
