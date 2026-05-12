---
id: generic-command-profile
name: Generic Command BLE Profile
version: 0.1.0
summary: Command/response BLE template for devices that expose one writable command characteristic and one readable or notifiable response characteristic.
---

# Generic Command BLE Profile

This placeholder profile models the common BLE pattern used by sensors, locks,
meters, and embedded boards: the app writes a binary command frame, then the
device answers through notify, indicate, or read.

## Service: Generic Command Service

- uuid: 0000FFE0-0000-1000-8000-00805F9B34FB
- summary: Vendor command transport service.
- validWhen: Use when the device exposes FFE0/FFE1-style transparent or command transport UUIDs.
- role: request-response transport

### Characteristic: Command TX

- uuid: 0000FFE1-0000-1000-8000-00805F9B34FB
- properties: WRITE, WRITE_NR
- direction: app-to-device
- valueFormat: binary-frame
- description: App writes command frames to this characteristic.

#### Interface: Get Device Info

- operationId: device.getInfo
- request: WRITE
- response: NOTIFY
- requestExample: AA 01 00 AB
- responseExample: AA 81 03 01 00 10 39
- mock: Return responseExample after 120ms when request starts with AA 01.
- description: Reads firmware and protocol version information.

##### Request Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | 1 | uint8 | header | Fixed frame header, 0xAA |
| 1 | 1 | uint8 | command | Command code, 0x01 means get device info |
| 2 | 1 | uint8 | length | Payload length in bytes |
| 3 | 1 | uint8 | checksum | Low 8-bit sum or vendor checksum |

##### Response Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | 1 | uint8 | header | Fixed frame header, 0xAA |
| 1 | 1 | uint8 | command | Response code, request command OR 0x80 |
| 2 | 1 | uint8 | length | Payload length in bytes |
| 3 | 1 | uint8 | fwMajor | Firmware major version |
| 4 | 1 | uint8 | fwMinor | Firmware minor version |
| 5 | 1 | uint8 | proto | Protocol version |
| 6 | 1 | uint8 | checksum | Low 8-bit sum or vendor checksum |

### Characteristic: Event RX

- uuid: 0000FFE2-0000-1000-8000-00805F9B34FB
- properties: READ, NOTIFY
- direction: device-to-app
- valueFormat: binary-frame
- description: Device reports command responses and asynchronous events here.

#### Interface: Device Event

- operationId: device.event
- request: NONE
- response: NOTIFY
- requestExample:
- responseExample: AA E1 02 01 64 52
- mock: Emit responseExample every 5s when notifications are enabled.
- description: Generic asynchronous event notification.

##### Response Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | 1 | uint8 | header | Fixed frame header, 0xAA |
| 1 | 1 | uint8 | event | Event code, 0xE1 means status update |
| 2 | 1 | uint8 | length | Payload length in bytes |
| 3 | 1 | uint8 | status | Device status enum |
| 4 | 1 | uint8 | battery | Battery percentage, 0-100 |
| 5 | 1 | uint8 | checksum | Low 8-bit sum or vendor checksum |
