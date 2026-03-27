<div align="center">

# ⬡ BLE 调试助手

**面向硬件工程师的专业蓝牙低功耗调试工具**

[![UniApp](https://img.shields.io/badge/UniApp-Vue3-42b883?style=flat-square&logo=vuedotjs)](https://uniapp.dcloud.net.cn/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178c6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Pinia](https://img.shields.io/badge/Pinia-2.x-ffd859?style=flat-square)](https://pinia.vuejs.org/)
[![平台](https://img.shields.io/badge/平台-Android%20%7C%20iOS-lightgrey?style=flat-square)](https://uniapp.dcloud.net.cn/)
[![版本](https://img.shields.io/badge/版本-1.1.0-00F5FF?style=flat-square)](#)
[![协议](https://img.shields.io/badge/协议-MIT-green?style=flat-square)](#)

[English](./README.md) · [功能特性](#功能特性) · [快速开始](#快速开始) · [架构设计](#架构设计) · [界面截图](#界面截图)

</div>

---

## 项目简介

**BLE 调试助手**是一款基于 UniApp + Vue3 开发的跨平台（Android / iOS）蓝牙低功耗调试工具。专为嵌入式开发者和硬件工程师设计，提供类似串口调试助手的无线调试体验——涵盖实时 HEX/ASCII 双向通信、服务特征值树状解析、Notify 订阅、快捷命令管理、RSSI 信号历史图表、MTU 协商控制、特征值历史 Diff 对比、自定义协议插件执行和多格式日志导出等全套能力。

应用内置**暗色/亮色双主题**和**中/英双语界面**，无需重启即可随时切换。

![1](./docs/pics/1.jpg)

![4](./docs/pics/4.jpg)

![2](./docs/pics/2.jpg)

![3](./docs/pics/3.jpg)

---

## 功能特性

### BLE 核心能力
- **设备扫描** — 实时发现周边 BLE 广播包，配合雷达动效可视化
- **智能过滤** — 支持按设备名称或 RSSI 信号阈值筛选设备
- **服务特征值树** — 可展开的树状结构，属性标签一目了然（READ / WRITE / WRITE NR / NOTIFY / INDICATE）
- **HEX / ASCII 双向通信** — 支持两种格式的数据收发，随时切换
- **Notify 订阅** — 逐特征值开启/关闭 BLE 通知监听
- **主动读取** — 按需触发特征值 Read 操作
- **自动重连** — 支持断线自动重连和心跳保活机制
- **MTU 协商** — 在设备页直接协商 MTU 大小（23–512 字节），实时显示协商结果

### 开发者体验
- **快捷命令** — 保存常用指令并命名，长按删除；一键发送历史命令
- **通信日志** — 带时间戳的 TX/RX/SYS 彩色日志，环形缓冲区最多保留 2000 条
- **三种显示模式** — HEX 模式、ASCII 模式、DUAL 双显模式自由切换
- **日志导出（TXT / CSV）** — 导出时选择纯文本格式或电子表格 CSV 格式，一键保存至本地
- **协议解析** — 内置 RAW / UART 解析器；支持**自定义 JavaScript 协议插件**，自定义帧格式解析逻辑
- **RSSI 信号历史图表** — 连接后每 2 秒采集一次信号强度，以柱状图实时展示趋势
- **特征值历史 Diff** — 记录每个特征值的历史接收值，逐字节高亮标注变化字节
- **最近设备** — 持久化最近连接记录，支持快速重连

### UI / UX
- **暗色主题** — 科技感终端风 (`#0A0F1C` 背景 + `#00F5FF` 霓虹蓝 + `#39FF14` 荧光绿)
- **亮色主题** — 专业日间模式 (`#EDF2F7` 背景 + `#0369A1` 深蓝 + `#059669` 翠绿)
- **主题切换** — 顶部按钮或设置面板即时切换，偏好持久化
- **双语界面** — 完整中/英文界面，无缝切换，导航栏标题同步更新
- **响应式布局** — 手机端上下堆叠；平板/横屏切换为左右分栏布局

---

## 界面截图

> _左：暗色主题 · 右：亮色主题_

| 扫描页 | 设备服务页 | 调试控制台 |
|--------|-----------|-----------|
| 雷达动效、RSSI 信号格、名称过滤 | 服务树 · MTU 协商面板 · RSSI 图表 | HEX/ASCII 收发 · 日志面板 · 协议插件 · Diff 历史 |

---

## 技术栈

| 层级 | 技术选型 |
|------|---------|
| 框架 | UniApp（Vue 3 + `<script setup>`） |
| 语言 | TypeScript 5 |
| 状态管理 | Pinia 2 |
| BLE API | UniApp 原生 BLE API（Promise 化封装） |
| 样式 | Scoped SCSS + CSS 自定义属性（双主题） |
| 国际化 | 自研 `useI18n` composable（dot-notation key） |
| 持久化 | `uni.setStorageSync`（设置、快捷命令、协议插件） |

---

## 运行环境

| 平台 | 最低版本 |
|------|---------|
| Android | API 21（Android 5.0） |
| iOS | iOS 13.0 |
| HBuilderX | 3.x+ |
| Node.js | 16+（CLI 模式） |

> **蓝牙权限**已在 `manifest.json` 中声明。
> Android 12+ 设备上，`BLUETOOTH_SCAN` 和 `BLUETOOTH_CONNECT` 权限会在运行时动态申请。

---

## 快速开始

### 方式 A — HBuilderX（推荐）

```bash
# 1. 克隆仓库
git clone https://github.com/your-org/uniapp-ble-debugging-assistant.git
cd uniapp-ble-debugging-assistant

# 2. 安装依赖
npm install

# 3. 用 HBuilderX 打开 → 运行 → 运行到手机或模拟器
```

> 在 HBuilderX 中选择 **运行 → 运行到手机或模拟器 → 运行到 Android/iOS** 直接编译部署。

### 方式 B — CLI

```bash
npm install

# 开发构建（App-Plus）
npm run dev:app

# 生产构建
npm run build:app
```

---

## 项目结构

```
uniapp-ble-debugging-assistant/
│
├── pages/
│   ├── scan/index.vue          # 设备扫描页（首页）
│   ├── device/index.vue        # 服务树 · MTU 协商 · RSSI 信号图表
│   ├── debug/index.vue         # BLE 通信调试控制台 · Diff 历史 · 协议插件
│   └── protocol/index.vue      # 协议插件管理页（添加 / 编辑 / 启用）
│
├── components/
│   ├── DeviceItem.vue           # 扫描列表卡片（RSSI 信号格、可连接标签）
│   ├── BleLogPanel.vue          # 通信日志查看器
│   ├── HexInput.vue             # HEX/ASCII 输入 + 快捷命令 + 发送
│   ├── RadarScanAnimation.vue   # 雷达扫描动效（含设备点位）
│   ├── RssiChart.vue            # RSSI 信号历史柱状图（已连接设备实时采集）
│   ├── DiffModal.vue            # 特征值历史记录弹窗（逐字节 Diff 高亮）
│   └── SettingsPanel.vue        # 底部弹出设置面板（主题 & 语言切换）
│
├── services/
│   └── bleManager.ts            # BLE 封装层（状态机、Promise API）
│                                #   + getRSSI()  + negotiateMTU()
│
├── store/
│   ├── bleStore.ts              # BLE 运行时状态（设备、日志、特征值）
│   │                            #   + rssiHistory  + charValueHistory  + currentMtu
│   ├── appStore.ts              # 应用设置状态（主题、语言、CSS 变量）
│   └── protocolStore.ts         # 协议插件注册表（添加 / 执行 / 持久化）
│
├── composables/
│   └── useI18n.ts               # i18n composable — t('dot.notation.key')
│
├── locales/
│   ├── zh.ts                    # 简体中文语言包
│   └── en.ts                    # 英文语言包
│
├── utils/
│   ├── hex.ts                   # HEX↔ArrayBuffer、ASCII、UUID、RSSI 工具函数
│   └── buffer.ts                # 日志条目、环形缓冲区、TXT/CSV 导出、持久化
│
├── App.vue                      # 全局 CSS 自定义属性定义（双主题变量）
├── pages.json                   # 路由配置
└── manifest.json                # 应用权限 & 平台配置
```

---

## 架构设计

### BLE 状态机

```
未初始化 → 就绪 → 扫描中 → 连接中 → 已连接 → 已断开
           ↑                                    |
           └────────────────────────────────────┘
                        （自动重连）
```

`bleManager.ts` 管理状态机并对外暴露 Promise 化 API，所有回调全部封装——页面和 Store 中无 callback hell。

### 主题系统

CSS 自定义属性定义在 `App.vue` 的 `.theme-dark` 和 `.theme-light` 类中。每个页面根元素应用 `:class="appStore.themeClass"`，所有子组件的 Scoped CSS 通过 `var(--xxx)` 自动继承当前主题变量。

```
App.vue（定义 .theme-dark / .theme-light 变量）
  └── 页面根 <view :class="appStore.themeClass">
        └── 子组件 → var(--bg-base), var(--color-primary), ...
```

`appStore` 同时导出 `cssVarsStyle`（内联 style 字符串），用于需要直接注入变量的特殊场景。

### 国际化系统

```ts
// composables/useI18n.ts
const { t } = useI18n()
t('scan.startScan')   // → '开始扫描' | 'Start Scan'
t('debug.bytes')      // → '字节'     | 'bytes'
```

切换 `appStore.locale`（`'zh'` / `'en'`）是响应式的，所有 `t()` 调用即时生效，导航栏标题通过 `watch` 同步更新。

### 协议插件系统

插件以 JavaScript 函数体字符串形式存储，由 `protocolStore` 通过 `new Function()` 动态执行。插件接收 `hexStr`（如 `"01 02 FF"`）和 `asciiStr` 两个参数，返回 `{ fields: [{ name, value }] }`。

```js
// 示例插件 — 解析 4 字节自定义帧
const b = hexStr.split(' ').map(h => parseInt(h, 16));
return {
  fields: [
    { name: 'CMD',  value: '0x' + b[0].toString(16).toUpperCase() },
    { name: '长度', value: b[1] + ' 字节' },
    { name: '载荷', value: hexStr.slice(6) },
    { name: 'CRC',  value: '0x' + b[b.length - 1].toString(16).toUpperCase() },
  ]
};
```

同一时刻只允许启用一个插件。管理入口：**调试页 → 协议解析 → 自定义 → 管理插件**。

### RSSI 信号采集

设备连接成功后，`bleStore` 每 **2 秒**自动调用 `bleManager.getRSSI()` 更新信号强度，并将结果追加至 `rssiHistory`（最多保留 60 个点）。`RssiChart` 组件响应式读取该数组，用 CSS 柱状图呈现趋势。断开连接时，轮询定时器自动清除。

### 特征值历史 Diff

每次 RX 数据到达时，`bleStore` 自动以特征值 UUID 为 key，将 HEX 字符串追加到 `charValueHistory`（每个特征值最多保留 50 条）。`DiffModal` 弹窗将历史条目倒序排列，逐字节对比相邻两条记录，变化字节以**橙黄色高亮**标注。

---

## 核心 API 参考

### `services/bleManager.ts`

| 方法 | 说明 |
|------|------|
| `init()` | 打开蓝牙适配器，设置状态与设备监听器 |
| `startDiscovery(timeout?)` | 开始 BLE 扫描，可设超时时间 |
| `stopDiscovery()` | 停止 BLE 扫描 |
| `connect(deviceId)` | 建立 BLE 连接 |
| `disconnect(deviceId)` | 断开 BLE 连接 |
| `getServices(deviceId)` | 获取全部服务 |
| `getCharacteristics(deviceId, serviceId)` | 获取特征值列表 |
| `write(deviceId, serviceId, charId, buffer)` | 向特征值写入数据 |
| `read(deviceId, serviceId, charId)` | 读取特征值当前值 |
| `setNotify(deviceId, serviceId, charId, enable)` | 开启/关闭 BLE 通知 |
| `getRSSI(deviceId)` | 查询已连接设备的当前 RSSI 信号强度 |
| `negotiateMTU(mtu)` | 发起 MTU 协商请求（23–512），返回实际协商结果 |
| `onData(listener)` | 订阅特征值数据变化 |

### `utils/hex.ts`

| 函数 | 说明 |
|------|------|
| `bufToHex(buf)` | `ArrayBuffer → "01 AB FF"` |
| `hexToBuf(str)` | `"01ABFF" → ArrayBuffer` |
| `bufToAscii(buf)` | 二进制 → 可打印 ASCII（不可打印字符显示为 `.`） |
| `isValidHex(str)` | 验证 HEX 字符串格式 |
| `normalizeHex(str)` | 格式化 HEX，补全空格分隔 |
| `shortUUID(uuid)` | 将完整 UUID 缩写为 `0xXXXX` 格式 |
| `rssiToLevel(rssi)` | RSSI 值 → 信号格等级（1–5） |
| `rssiToColor(rssi)` | RSSI 值 → 对应颜色字符串 |

### `utils/buffer.ts`

| 函数 | 说明 |
|------|------|
| `exportLogsToText(logs, device)` | 将日志数组序列化为格式化纯文本 |
| `exportLogsToCSV(logs, device)` | 将日志数组序列化为 RFC-4180 标准 CSV |
| `saveLogsToFile(content, filename, mimeType)` | App 端写入本地文件；H5 端触发浏览器下载 |

---

## 主题色彩规范

### 暗色主题（默认）

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--bg-base` | `#0A0F1C` | 页面背景 |
| `--bg-panel` | `#111827` | 卡片、头部区域 |
| `--bg-card` | `#1A2235` | 列表项卡片 |
| `--color-primary` | `#00F5FF` | 霓虹蓝 — 主要操作、边框 |
| `--color-accent` | `#39FF14` | 荧光绿 — RX 数据、成功状态 |
| `--color-danger` | `#FF3B3B` | 错误、断开连接 |
| `--color-warning` | `#F59E0B` | 警告、系统日志 |
| `--text-primary` | `#E2E8F0` | 主体文字 |
| `--text-mono` | `#A8D8A8` | 等宽数据显示区 |

### 亮色主题

| 变量名 | 色值 | 用途 |
|--------|------|------|
| `--bg-base` | `#EDF2F7` | 页面背景 |
| `--bg-panel` | `#FFFFFF` | 卡片、头部区域 |
| `--bg-card` | `#F7FAFC` | 列表项卡片 |
| `--color-primary` | `#0369A1` | 深蓝 — 主要操作、边框 |
| `--color-accent` | `#059669` | 翠绿 — RX 数据、成功状态 |
| `--color-danger` | `#DC2626` | 错误、断开连接 |
| `--color-warning` | `#D97706` | 警告、系统日志 |
| `--text-primary` | `#1A202C` | 主体文字 |
| `--text-mono` | `#1A5F2E` | 等宽数据显示区 |

---

## 数据持久化

| 设置项 | Storage Key | 默认值 |
|--------|-------------|--------|
| 显示主题 | `ble_app_theme` | `dark` |
| 界面语言 | `ble_app_locale` | `zh` |
| 快捷命令 | `ble_quick_commands` | `[]` |
| 最近设备 | `ble_recent_devices` | `[]` |
| 协议插件 | `ble_protocol_plugins` | `[]` |

全部设置通过 `uni.setStorageSync` 持久化，应用重启后自动恢复。

---

## 权限说明

### Android

| 权限 | 用途 |
|------|------|
| `BLUETOOTH` / `BLUETOOTH_ADMIN` | 基础蓝牙控制（API < 31） |
| `BLUETOOTH_SCAN` | BLE 设备扫描（API 31+） |
| `BLUETOOTH_CONNECT` | BLE 设备连接（API 31+） |
| `ACCESS_FINE_LOCATION` | BLE 扫描需要位置权限 |
| `WRITE_EXTERNAL_STORAGE` | 日志文件导出 |

### iOS

| 权限 | 用途 |
|------|------|
| `NSBluetoothAlwaysUsageDescription` | BLE 设备扫描与连接 |
| `NSBluetoothPeripheralUsageDescription` | 外设数据通信 |
| `NSLocationWhenInUseUsageDescription` | BLE 扫描位置需求 |

---

## 常见问题

**Q: Android 设备扫描不到蓝牙设备？**
> 检查是否已开启手机蓝牙和位置服务；Android 12+ 需授予 `BLUETOOTH_SCAN` 和位置权限。

**Q: iOS 无法连接设备？**
> 确认已在系统设置中授予蓝牙权限；部分 iOS 设备需先在系统蓝牙中配对。

**Q: 发送数据没有响应？**
> 确认已选择支持 WRITE 或 WRITE WITHOUT RESPONSE 属性的特征值，在设备页可查看属性标签。

**Q: MTU 协商失败？**
> 部分设备或固件不支持 MTU 协商，此时 API 会返回错误，保持默认 23 字节即可。iOS 会自动协商 MTU，无需手动操作。

**Q: 协议插件运行出错？**
> 插件代码在沙盒 `new Function()` 中执行。出错时字段列表会显示 `Error: <错误信息>`，便于定位问题。注意函数体最后需要有 `return` 语句。

**Q: 日志显示乱码？**
> 切换到 HEX 模式查看原始字节；ASCII 模式下不可打印字符会显示为 `.`。

**Q: 如何保存常用发送命令？**
> 在调试页输入数据后，点击「+ 保存为快捷命令」输入名称即可；下次发送只需点击命令按钮。

---

## 未来计划

- [x] BLE 信号强度图表（RSSI 时序曲线）— _v1.1.0_
- [x] 自定义协议解析插件机制 — _v1.1.0_
- [x] MTU 协商控制 — _v1.1.0_
- [x] 特征值历史值 Diff 对比 — _v1.1.0_
- [x] 日志 CSV 格式导出 — _v1.1.0_
- [ ] 批量多设备同时调试

---

## 参与贡献

1. Fork 本仓库
2. 创建功能分支：`git checkout -b feature/my-feature`
3. 提交变更：`git commit -m 'feat: 添加新功能'`
4. 推送并创建 Pull Request

请遵循现有的 TypeScript + Vue3 Composition API 代码风格，所有 UI 文字须同步更新 `locales/zh.ts` 和 `locales/en.ts`。

---

## 开源协议

MIT © 2024 BLE 调试助手贡献者

---

<div align="center">
<sub>基于 UniApp · Vue 3 · TypeScript · Pinia 构建</sub><br/>
<sub>专为对工具有极致要求的硬件工程师设计</sub>
</div>
