<div align="center">

# ⬡ BLE Debugger

**A professional Bluetooth Low Energy debugging tool for hardware engineers**

[![UniApp](https://img.shields.io/badge/UniApp-Vue3-42b883?style=flat-square&logo=vuedotjs)](https://uniapp.dcloud.net.cn/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Pinia](https://img.shields.io/badge/Pinia-2.x-ffd859?style=flat-square)](https://pinia.vuejs.org/)
[![Platform](https://img.shields.io/badge/Platform-Android%20%7C%20iOS-lightgrey?style=flat-square)](https://uniapp.dcloud.net.cn/)
[![Version](https://img.shields.io/badge/Version-1.1.0-00F5FF?style=flat-square)](#)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](#)

[中文文档](./README_Zh.md) · [Features](#features) · [Quick Start](#quick-start) · [Architecture](#architecture) · [Screenshots](#screenshots)

</div>

---

## Overview

**BLE Debugger** is a cross-platform (Android / iOS) Bluetooth Low Energy debugging assistant built with UniApp + Vue3. Designed for embedded engineers and hardware developers, it delivers a serial-tool-like experience for wireless debugging — complete with real-time HEX/ASCII communication, service tree inspection, notify subscriptions, quick command management, RSSI signal charts, MTU negotiation, characteristic value diff history, custom protocol plugin execution, and multi-format log export.

The app ships with two display themes (Dark / Light) and full bilingual support (Chinese / English), switchable at any time without restarting.

![1](./docs/pics/1.jpg)

![4](./docs/pics/4.jpg)

![2](./docs/pics/2.jpg)

![3](./docs/pics/3.jpg)

---

## Features

### Core BLE Capabilities
- **Device Scanning** — Real-time BLE advertisement discovery with radar animation
- **Smart Filtering** — Filter by device name or minimum RSSI threshold
- **Service & Characteristic Tree** — Visual expandable tree with property badges (READ / WRITE / WRITE NR / NOTIFY / INDICATE)
- **HEX / ASCII Communication** — Full duplex send & receive with format switching
- **Notify Subscriptions** — Toggle BLE notifications per characteristic
- **Read on Demand** — Trigger explicit characteristic reads
- **Auto-Reconnect** — Automatic reconnection with configurable heartbeat keep-alive
- **MTU Negotiation** — Negotiate MTU size (23–512 bytes) directly from the device page with real-time feedback

### Developer Experience
- **Quick Commands** — Save frequently used payloads with custom names; long-press to delete
- **Communication Log** — Timestamped, color-coded TX/RX/SYS entries with 2000-entry ring buffer
- **Dual Display Mode** — View data in HEX, ASCII, or DUAL mode simultaneously
- **Log Export (TXT / CSV)** — Export session logs in plain text or spreadsheet-ready CSV format; format selected at export time
- **Protocol Analysis** — Built-in RAW / UART parser; **custom JavaScript plugin system** for user-defined frame parsers
- **RSSI Signal Chart** — Live bar chart of received signal strength over time, polled every 2 s while connected
- **Characteristic Value Diff** — Per-characteristic history of received values with byte-level change highlighting
- **Recent Devices** — Quick reconnect from a persistent recent-device list

### UI / UX
- **Dark Theme** — High-contrast terminal aesthetic (`#0A0F1C` + `#00F5FF` cyan + `#39FF14` green)
- **Light Theme** — Professional daylight mode (`#EDF2F7` + `#0369A1` blue + `#059669` green)
- **Theme Toggle** — Instant switch via header buttons or Settings panel; preference persisted
- **Bilingual** — Full Chinese / English interface; instant switching, nav bar title synced
- **Responsive Layout** — Stacked on phones; side-by-side panel layout on tablets / landscape

---

## Screenshots

> _Dark theme on the left · Light theme on the right_

| Scan | Device Services | Debug Console |
|------|----------------|---------------|
| Radar animation, RSSI bars, filter | Service tree · MTU panel · RSSI chart | HEX/ASCII I/O · log panel · protocol parser · diff history |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | UniApp (Vue 3 + `<script setup>`) |
| Language | TypeScript 5 |
| State Management | Pinia 2 |
| BLE API | UniApp native BLE APIs (Promise-wrapped) |
| Styling | Scoped SCSS + CSS Custom Properties (dual theme) |
| i18n | Custom `useI18n` composable (dot-notation keys) |
| Storage | `uni.setStorageSync` for settings, quick commands & plugins |

---

## Requirements

| Platform | Minimum Version |
|----------|----------------|
| Android | API 21 (Android 5.0) |
| iOS | iOS 13.0 |
| HBuilderX | 3.x+ |
| Node.js | 16+ (CLI mode) |

> **Bluetooth permissions** are declared automatically via `manifest.json`.
> On Android 12+, `BLUETOOTH_SCAN` and `BLUETOOTH_CONNECT` are requested at runtime.

---

## Quick Start

### Option A — HBuilderX (Recommended)

```bash
# 1. Clone the repository
git clone https://github.com/your-org/uniapp-ble-debugging-assistant.git
cd uniapp-ble-debugging-assistant

# 2. Install dependencies
npm install

# 3. Open in HBuilderX → Run → Run to Phone/Emulator
```

> Go to **Run → Run to Phone or Emulator → Run to Android/iOS** to build and deploy directly.

### Option B — CLI

```bash
npm install

# Development build (App-Plus)
npm run dev:app

# Production build
npm run build:app
```

---

## Project Structure

```
uniapp-ble-debugging-assistant/
│
├── pages/
│   ├── scan/index.vue          # Device scan page (home)
│   ├── device/index.vue        # Service tree · MTU negotiation · RSSI chart
│   ├── debug/index.vue         # BLE communication console · diff history · protocol plugin
│   └── protocol/index.vue      # Protocol plugin management (add / edit / enable)
│
├── components/
│   ├── DeviceItem.vue           # Scan list card (RSSI bars, connectable badge)
│   ├── BleLogPanel.vue          # Communication log viewer
│   ├── HexInput.vue             # HEX/ASCII input + quick commands + send
│   ├── RadarScanAnimation.vue   # Animated radar with device dots
│   ├── RssiChart.vue            # Live RSSI bar chart (connected device signal history)
│   ├── DiffModal.vue            # Characteristic value history with byte-level diff highlight
│   └── SettingsPanel.vue        # Bottom-sheet: theme & language switcher
│
├── services/
│   └── bleManager.ts            # BLE abstraction layer (state machine, Promise API)
│                                #   + getRSSI()  + negotiateMTU()
│
├── store/
│   ├── bleStore.ts              # BLE runtime state (devices, logs, characteristics)
│   │                            #   + rssiHistory  + charValueHistory  + currentMtu
│   ├── appStore.ts              # App settings state (theme, locale, CSS variables)
│   └── protocolStore.ts         # Protocol plugin registry (add / run / persist)
│
├── composables/
│   └── useI18n.ts               # i18n composable — t('dot.notation.key')
│
├── locales/
│   ├── zh.ts                    # Simplified Chinese strings
│   └── en.ts                    # English strings
│
├── utils/
│   ├── hex.ts                   # HEX↔ArrayBuffer, ASCII, UUID, RSSI utilities
│   └── buffer.ts                # Log entries, ring buffer, TXT/CSV export, persistence
│
├── App.vue                      # Global CSS custom property definitions (both themes)
├── pages.json                   # Route configuration
└── manifest.json                # App permissions & platform config
```

---

## Architecture

### BLE State Machine

```
UNINITIALIZED → IDLE → SCANNING → CONNECTING → CONNECTED → DISCONNECTED
                 ↑                                               |
                 └───────────────────────────────────────────────┘
                               (auto-reconnect)
```

`bleManager.ts` owns the state machine and exposes a Promise-based API. All callbacks are converted — no callback hell in pages or stores.

### Theme System

CSS custom properties are declared in `App.vue` under `.theme-dark` and `.theme-light` classes. Each page root element applies `:class="appStore.themeClass"`, making all scoped child component styles automatically inherit the active theme via `var(--xxx)`.

```
App.vue (defines .theme-dark / .theme-light vars)
  └── page root <view :class="appStore.themeClass">
        └── child components → var(--bg-base), var(--color-primary), ...
```

`appStore` also exports `cssVarsStyle` (inline style string) for components that need direct variable injection.

### i18n System

```ts
// composables/useI18n.ts
const { t } = useI18n()
t('scan.startScan')   // → '开始扫描' | 'Start Scan'
t('debug.bytes')      // → '字节'     | 'bytes'
```

Switching `appStore.locale` between `'zh'` and `'en'` is reactive and updates all `t()` calls instantly.

### Protocol Plugin System

Plugins are plain JavaScript function bodies stored in `uni.setStorageSync`. Each plugin receives `hexStr` and `asciiStr` as arguments and must return `{ fields: [{ name, value }] }`.

```js
// Example plugin — parse a 4-byte custom frame
const b = hexStr.split(' ').map(h => parseInt(h, 16));
return {
  fields: [
    { name: 'CMD',     value: '0x' + b[0].toString(16).toUpperCase() },
    { name: 'Length',  value: b[1] + ' bytes' },
    { name: 'Payload', value: hexStr.slice(6) },
    { name: 'CRC',     value: '0x' + b[b.length - 1].toString(16).toUpperCase() },
  ]
};
```

Plugins are executed via `new Function()` in `protocolStore.runPlugin()`. Only one plugin can be enabled at a time. Manage plugins at **Debug → Protocol → Custom → Manage Plugins**.

---

## Key Files Reference

### `services/bleManager.ts`

| Method | Description |
|--------|-------------|
| `init()` | Open Bluetooth adapter; sets up state & device listeners |
| `startDiscovery(timeout?)` | Start BLE scan with optional timeout |
| `stopDiscovery()` | Stop BLE scan |
| `connect(deviceId)` | Create BLE connection |
| `disconnect(deviceId)` | Destroy BLE connection |
| `getServices(deviceId)` | Retrieve all services |
| `getCharacteristics(deviceId, serviceId)` | Retrieve characteristics |
| `write(deviceId, serviceId, charId, buffer)` | Write data to characteristic |
| `read(deviceId, serviceId, charId)` | Read characteristic value |
| `setNotify(deviceId, serviceId, charId, enable)` | Toggle BLE notifications |
| `getRSSI(deviceId)` | Query current RSSI of connected device |
| `negotiateMTU(mtu)` | Request MTU negotiation (23–512); returns actual MTU |
| `onData(listener)` | Subscribe to incoming characteristic data |

### `utils/hex.ts`

| Function | Description |
|----------|-------------|
| `bufToHex(buf)` | `ArrayBuffer → "01 AB FF"` |
| `hexToBuf(str)` | `"01ABFF" → ArrayBuffer` |
| `bufToAscii(buf)` | Binary → printable ASCII (`.` for non-printable) |
| `isValidHex(str)` | Validate HEX string format |
| `normalizeHex(str)` | Format HEX with spaces |
| `shortUUID(uuid)` | Shorten UUID to `0xXXXX` form |
| `rssiToLevel(rssi)` | RSSI → signal bar level (1–5) |
| `rssiToColor(rssi)` | RSSI → color string |

### `utils/buffer.ts`

| Function | Description |
|----------|-------------|
| `exportLogsToText(logs, device)` | Serialize log array as formatted plain text |
| `exportLogsToCSV(logs, device)` | Serialize log array as RFC-4180 CSV |
| `saveLogsToFile(content, filename, mimeType)` | Write file to local storage (App) or trigger download (H5) |

---

## Theme Color Reference

### Dark Mode (Default)

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#0A0F1C` | Page background |
| `--bg-panel` | `#111827` | Cards, headers |
| `--color-primary` | `#00F5FF` | Cyan — primary actions, borders |
| `--color-accent` | `#39FF14` | Green — RX data, success states |
| `--color-danger` | `#FF3B3B` | Errors, disconnect |
| `--text-primary` | `#E2E8F0` | Main body text |
| `--text-mono` | `#A8D8A8` | Monospace data display |

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-base` | `#EDF2F7` | Page background |
| `--bg-panel` | `#FFFFFF` | Cards, headers |
| `--color-primary` | `#0369A1` | Deep blue — primary actions |
| `--color-accent` | `#059669` | Emerald — RX data, success |
| `--color-danger` | `#DC2626` | Errors, disconnect |
| `--text-primary` | `#1A202C` | Main body text |
| `--text-mono` | `#1A5F2E` | Monospace data display |

---

## Settings & Persistence

| Setting | Storage Key | Default |
|---------|-------------|---------|
| Theme | `ble_app_theme` | `dark` |
| Language | `ble_app_locale` | `zh` |
| Quick Commands | `ble_quick_commands` | `[]` |
| Recent Devices | `ble_recent_devices` | `[]` |
| Protocol Plugins | `ble_protocol_plugins` | `[]` |

All settings survive app restarts via `uni.setStorageSync`.

---

## Roadmap

- [x] BLE signal strength chart (RSSI over time) — _v1.1.0_
- [x] Custom protocol parser plugin system — _v1.1.0_
- [x] MTU negotiation control — _v1.1.0_
- [x] Characteristic value history diff view — _v1.1.0_
- [x] Export logs as CSV — _v1.1.0_
- [ ] Multi-device simultaneous debugging

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m 'feat: add my feature'`
4. Push and open a Pull Request

Please follow the existing TypeScript + Vue3 Composition API style. All UI text must be added to both `locales/zh.ts` and `locales/en.ts`.

---

## License

MIT © 2024 BLE Debugger Contributors

---

<div align="center">
<sub>Built with UniApp · Vue 3 · TypeScript · Pinia</sub><br/>
<sub>Designed for hardware engineers who demand professional tools</sub>
</div>
