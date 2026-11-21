/**
  ******************************************************************************
  * @file           : protocol_parser.h
  * @brief          : Header for Two-Way Wire Command Protocol Parser.
  * @board          : STMicroelectronics B-L475E-IOT01A2
  ******************************************************************************
  */

#ifndef __PROTOCOL_PARSER_H
#define __PROTOCOL_PARSER_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define MAX_METADATA_LEN               48U

typedef struct {
  char plantNumber[MAX_METADATA_LEN];
  char plantName[MAX_METADATA_LEN];
  char potNumber[MAX_METADATA_LEN];
  char cropVariety[MAX_METADATA_LEN];
  char zone[MAX_METADATA_LEN];
  char leafSpot[MAX_METADATA_LEN];
  bool hasMetadata;
} SpecimenMetadata_t;

/**
  * @brief  Initialize protocol parser and specimen metadata storage.
  */
void Protocol_Parser_Init(void);

/**
  * @brief  Feed received byte string from BLE RX or ST-Link UART into protocol parser.
  * @param  buffer Pointer to received bytes.
  * @param  len Length in bytes.
  */
void Protocol_Parser_Feed(const uint8_t *buffer, uint16_t len);

/**
  * @brief  Execute single parsed command line.
  * @param  line Null-terminated ASCII command string.
  */
void Protocol_Parser_ExecuteCommand(const char *line);

/**
  * @brief  Send formatted ACK response back to mobile app.
  * @param  cmd Command name (e.g. "HELLO", "LED_ON", "START_SCAN").
  * @param  params Optional key-value parameters (e.g. "STATUS=ON,GATE=PB0").
  */
void Protocol_SendAck(const char *cmd, const char *params);

/**
  * @brief  Send formatted ERR response back to mobile app.
  * @param  cmd Command name.
  * @param  reason Error message description.
  */
void Protocol_SendErr(const char *cmd, const char *reason);

/**
  * @brief  Send 76-band optical spectrum packet ($SPEC).
  * @param  bands Array of 76 uint16_t counts.
  */
void Protocol_SendSpectrum(const uint16_t *bands, uint16_t count);

/**
  * @brief  Get currently active specimen metadata.
  */
const SpecimenMetadata_t* Protocol_GetMetadata(void);

/**
  * @brief  Set active specimen metadata directly.
  * @param  metadata Pointer to specimen metadata structure.
  */
void Protocol_SetMetadata(const SpecimenMetadata_t *metadata);

#ifdef __cplusplus
}
#endif

#endif /* __PROTOCOL_PARSER_H */
