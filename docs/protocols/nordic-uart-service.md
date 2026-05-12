---
id: nordic-uart-service
name: Nordic UART Service
version: 0.1.0
summary: BLE UART-style service commonly used by Nordic SDK examples and compatible embedded firmware.
---

# Nordic UART Service

NUS turns BLE into a bidirectional byte stream. It does not define a business
protocol by itself; application frames are usually layered on top of the RX/TX
characteristics.

## Service: Nordic UART Service

- uuid: 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
- summary: UART-like transparent byte transport over BLE.
- validWhen: Use when the service UUID is 6E400001-B5A3-F393-E0A9-E50E24DCCA9E.
- role: transparent transport

### Characteristic: RX Write

- uuid: 6E400002-B5A3-F393-E0A9-E50E24DCCA9E
- properties: WRITE, WRITE_NR
- direction: app-to-device
- valueFormat: bytes
- description: App writes bytes to the device.

#### Interface: UART Write Bytes

- operationId: uart.write
- request: WRITE
- response: NONE
- requestExample: 48 45 4C 4C 4F
- responseExample:
- mock: Accept any request and optionally echo through uart.notify.
- description: Sends arbitrary bytes to the device-side UART bridge.

##### Request Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | n | bytes | payload | Application-defined UART payload |

### Characteristic: TX Notify

- uuid: 6E400003-B5A3-F393-E0A9-E50E24DCCA9E
- properties: NOTIFY
- direction: device-to-app
- valueFormat: bytes
- description: Device notifies bytes back to the app.

#### Interface: UART Notify Bytes

- operationId: uart.notify
- request: NONE
- response: NOTIFY
- requestExample:
- responseExample: 4F 4B
- mock: Emit OK or echo the latest uart.write payload.
- description: Receives arbitrary bytes from the device-side UART bridge.

##### Response Fields

| Offset | Length | Type | Name | Meaning |
|:--|:--|:--|:--|:--|
| 0 | n | bytes | payload | Application-defined UART payload |
