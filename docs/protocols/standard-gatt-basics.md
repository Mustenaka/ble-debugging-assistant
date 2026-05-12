---
id: standard-gatt-basics
name: Standard GATT Basics
version: 0.1.0
summary: Common Bluetooth SIG services for battery level and device information.
---

# Standard GATT Basics

This profile documents common standard services that often appear alongside a
vendor-specific control service.

## Service: Device Information

- uuid: 0000180A-0000-1000-8000-00805F9B34FB
- summary: Standard service exposing manufacturer, model, firmware, and serial metadata.
- validWhen: Bluetooth SIG Device Information service is present.
- role: metadata

### Characteristic: Manufacturer Name String

- uuid: 00002A29-0000-1000-8000-00805F9B34FB
- properties: READ
- direction: device-to-app
- valueFormat: utf8-string
- description: Human-readable manufacturer name.

#### Interface: Read Manufacturer

- operationId: deviceInfo.readManufacturer
- request: READ
- response: READ_VALUE
- requestExample:
- responseExample: 41 43 4D 45
- mock: Return an ASCII/UTF-8 manufacturer string.
- description: Reads the manufacturer name.

##### Response Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | n | utf8 | manufacturer | Manufacturer name string |

### Characteristic: Firmware Revision String

- uuid: 00002A26-0000-1000-8000-00805F9B34FB
- properties: READ
- direction: device-to-app
- valueFormat: utf8-string
- description: Human-readable firmware revision.

#### Interface: Read Firmware Revision

- operationId: deviceInfo.readFirmware
- request: READ
- response: READ_VALUE
- requestExample:
- responseExample: 31 2E 30 2E 30
- mock: Return a semantic version string such as 1.0.0.
- description: Reads the firmware revision string.

##### Response Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | n | utf8 | firmwareRevision | Firmware revision string |

## Service: Battery Service

- uuid: 0000180F-0000-1000-8000-00805F9B34FB
- summary: Standard service exposing current battery level.
- validWhen: Bluetooth SIG Battery service is present.
- role: telemetry

### Characteristic: Battery Level

- uuid: 00002A19-0000-1000-8000-00805F9B34FB
- properties: READ, NOTIFY
- direction: device-to-app
- valueFormat: uint8
- description: Battery percentage in the inclusive range 0-100.

#### Interface: Battery Level Update

- operationId: battery.level
- request: READ
- response: READ_VALUE_OR_NOTIFY
- requestExample:
- responseExample: 64
- mock: Return or notify a uint8 battery percentage.
- description: Reads or receives battery level.

##### Response Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | 1 | uint8 | batteryLevel | Battery percentage, 0-100 |
