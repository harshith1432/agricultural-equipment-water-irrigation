##########################################################################################################################
# AgriSpectra B-L475E-IOT01A2 Spectroscope firmware - real STM32L4 HAL + BlueNRG-MS BLE stack.
##########################################################################################################################

TARGET = STM32_B-L475E-IOT01A2_Spectroscope
DEBUG = 1
OPT = -Og

BUILD_DIR = build

C_SOURCES =  \
Core/Src/main.c \
Core/Src/led_driver.c \
Core/Src/sensor_hal.c \
Core/Src/as7265x.c \
Core/Src/ble_service.c \
Core/Src/app_ble.c \
Core/Src/hci_tl_interface.c \
Core/Src/protocol_parser.c \
Core/Src/sd_card_driver.c \
Core/Src/fatfs_sd.c \
Core/Src/ff.c \
Core/Src/sd_storage_manager.c \
Core/Src/stm32l4xx_it.c \
Core/Src/stm32l4xx_hal_msp.c \
Drivers/CMSIS/Device/ST/STM32L4xx/Source/Templates/system_stm32l4xx.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_cortex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_dma.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_dma_ex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_exti.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_flash.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_flash_ex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_flash_ramfunc.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_gpio.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_i2c.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_i2c_ex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_pwr.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_pwr_ex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_rcc.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_rcc_ex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_spi.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_spi_ex.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_uart.c \
Drivers/STM32L4xx_HAL_Driver/Src/stm32l4xx_hal_uart_ex.c \
Middlewares/ST/BlueNRG-MS/hci/hci_le.c \
Middlewares/ST/BlueNRG-MS/hci/hci_tl_patterns/Basic/hci_tl.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_gap_aci.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_gatt_aci.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_hal_aci.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_l2cap_aci.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_updater_aci.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_utils_small.c \
Middlewares/ST/BlueNRG-MS/hci/controller/bluenrg_IFR.c \
Middlewares/ST/BlueNRG-MS/utils/ble_list.c

ASM_SOURCES = \
Drivers/CMSIS/Device/ST/STM32L4xx/Source/Templates/gcc/startup_stm32l475xx.s

PREFIX = arm-none-eabi-
CC = $(PREFIX)gcc
AS = $(PREFIX)gcc -x assembler-with-cpp
CP = $(PREFIX)objcopy
SZ = $(PREFIX)size
HEX = $(CP) -O ihex
BIN = $(CP) -O binary -S

CPU = -mcpu=cortex-m4
FPU = -mfpu=fpv4-sp-d16
FLOAT-ABI = -mfloat-abi=hard
MCU = $(CPU) -mthumb $(FPU) $(FLOAT-ABI)

C_DEFS =  \
-DUSE_HAL_DRIVER \
-DSTM32L475xx

C_INCLUDES =  \
-ICore/Inc \
-IDrivers/CMSIS/Core/Include \
-IDrivers/CMSIS/Device/ST/STM32L4xx/Include \
-IDrivers/STM32L4xx_HAL_Driver/Inc \
-IMiddlewares/ST/BlueNRG-MS/includes \
-IMiddlewares/ST/BlueNRG-MS/hci/hci_tl_patterns/Basic \
-IMiddlewares/ST/BlueNRG-MS/utils

CFLAGS = $(MCU) $(C_DEFS) $(C_INCLUDES) $(OPT) -Wall -fdata-sections -ffunction-sections

ifeq ($(DEBUG), 1)
CFLAGS += -g -gdwarf-2
endif

CFLAGS += -MMD -MP -MF"$(@:%.o=%.d)"

ASFLAGS = $(MCU) $(OPT) -g -gdwarf-2

LDSCRIPT = STM32L475VGTx_FLASH.ld
LIBS = -lc -lm -lnosys
LDFLAGS = $(MCU) -specs=nano.specs -T$(LDSCRIPT) $(LIBS) -Wl,-Map=$(BUILD_DIR)/$(TARGET).map,--cref -Wl,--gc-sections

all: $(BUILD_DIR)/$(TARGET).elf $(BUILD_DIR)/$(TARGET).hex $(BUILD_DIR)/$(TARGET).bin

OBJECTS = $(addprefix $(BUILD_DIR)/,$(notdir $(C_SOURCES:.c=.o)))
OBJECTS += $(addprefix $(BUILD_DIR)/,$(notdir $(ASM_SOURCES:.s=.o)))
vpath %.c $(sort $(dir $(C_SOURCES)))
vpath %.s $(sort $(dir $(ASM_SOURCES)))

$(BUILD_DIR)/%.o: %.c Makefile | $(BUILD_DIR)
	$(CC) -c $(CFLAGS) $< -o $@

$(BUILD_DIR)/%.o: %.s Makefile | $(BUILD_DIR)
	$(AS) -c $(ASFLAGS) $< -o $@

$(BUILD_DIR)/$(TARGET).elf: $(OBJECTS) Makefile
	$(CC) $(OBJECTS) $(LDFLAGS) -o $@
	$(SZ) $@

$(BUILD_DIR)/%.hex: $(BUILD_DIR)/%.elf | $(BUILD_DIR)
	$(HEX) $< $@

$(BUILD_DIR)/%.bin: $(BUILD_DIR)/%.elf | $(BUILD_DIR)
	$(BIN) $< $@

$(BUILD_DIR):
	mkdir -p $@

clean:
	rm -fR $(BUILD_DIR)

.PHONY: all clean
