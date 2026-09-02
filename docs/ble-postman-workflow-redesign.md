# BLE Postman Workflow Redesign

> 状态（0.2.0）：本文提出的 Endpoint 工作台、请求-响应样例配对、导出整理页、AI Prompt Builder、Mock Mode、协议库回写（Collection 导入）均已落地，逐界面说明见 [USER_GUIDE_zh.md](./USER_GUIDE_zh.md)。

这份文档用于重新梳理 `uniapp-ble-debugging-assistant` 的产品主线：从“串口式 BLE 调试工具”升级为“Postman / Apifox 式、AI Prompt / Mock 数据友好的 BLE 接口调试软件”。

## 一句话定位

把 BLE 设备的 Service / Characteristic / TX-RX 日志，沉淀成可理解、可复用、可导出、可模拟的接口资产。

旧定位偏向工具：

- 找设备
- 选特征值
- 发 HEX / ASCII
- 看日志
- 导出若干格式

新定位偏向工作流：

- 发现设备能力
- 把 UUID 解释成接口
- 把真实通信沉淀成样例
- 把样例组织成协议契约
- 一键导出 Debug Pack
- 交给 AI 分析或交给 Mock Mode 复现

## 当前能力梳理

项目已经具备成为 BLE API 工作台的基础：

- 扫描、过滤、连接、服务发现、特征值发现。
- 多设备 session，每个设备独立日志、服务树、RSSI、MTU、激活特征值。
- 调试页支持 HEX / ASCII 发送、READ、Notify、快捷命令、协议插件解析。
- TX/RX 日志已经携带 `serviceUUID` 和 `characteristicUUID`。
- 长按 TX/RX 日志可以保存协议样例。
- 内置协议模板以 Markdown 编写，并可解析成结构化模型。
- 已有 AI Markdown、Protocol JSON、Mock JSON、TXT、CSV 多种导出生成器。

真正的问题不是能力不足，而是“能力被拆散了”：

- 调试页有日志导出，设备页又有设备/AI/Mock 导出。
- 用户需要先理解多种格式，而不是先表达导出意图。
- “设备报告”“AI 报告”“协议 JSON”“Mock JSON”看起来是并列能力，但它们本质上都应该来自同一份调试资产包。
- 样例保存入口藏在日志长按里，无法形成“请求-响应配对”的接口样例。
- 协议插件、内置协议文档、快捷命令、Mock 数据之间还没有被串成同一条接口生命周期。

## 核心改造原则

### 1. 只保留一个主导出接口

主按钮统一命名为：

> Export Debug Pack / 导出调试包

它是唯一的主导出入口。用户不再先选择 TXT、CSV、AI Markdown、Mock JSON，而是先选择导出目的：

- 给 AI 分析
- 给 App Mock 测试
- 给同事复现
- 归档本次调试

目的只影响 Debug Pack 中的默认重点和文件命名，不影响底层内容完整性。

### 2. 格式变成包内产物，而不是 UI 主选项

Debug Pack 建议固定包含：

```text
ble-debug-pack/
  README.md              # 人读摘要
  AI_PROMPT.md           # 可直接发给 AI agent 的问题上下文
  protocol.json          # 结构化协议模型
  mock.json              # Mock seed / response rules
  logs.csv               # 原始通信日志
  logs.md                # 按 endpoint 分组的人读日志
  samples.json           # 用户保存和配对后的样例
  device.json            # 设备、RSSI、MTU、Service、Characteristic 拓扑
```

后续如需分享单个文件，可以在导出完成页提供“复制 AI Prompt”“分享 Mock JSON”等次级动作，但主流程只有一个导出。

### 3. 从“导出格式”转成“调试资产”

核心数据模型应围绕这些对象组织：

- Device：设备身份、连接信息、RSSI、MTU。
- Endpoint：`serviceUUID + characteristicUUID + properties + semantic doc`。
- Operation：一次可命名的接口操作，如 `device.getInfo`。
- Example：真实 TX / RX 样例，可单条、也可请求-响应配对。
- Mock Rule：根据请求匹配、延迟、响应、Notify 事件生成模拟数据。
- Issue Context：用户备注、异常现象、期望行为、复现步骤。

## 建议删减

这些内容不一定删除代码，但应该从主流程里降级：

- 删除调试页顶部菜单里的“导出日志”主入口。
- 删除日志面板上的独立导出按钮，改为“加入调试包”或完全隐藏。
- 删除设备页导出弹窗中的格式 Tab。
- 删除“设备信息导出”这个产品概念，归入 Debug Pack 的 `device.json` 和 README。
- 将 TXT / CSV 视为兼容产物，不再作为用户需要理解的主功能。
- 将 Protocol JSON / Mock JSON 从主选项降级为 Debug Pack 内固定文件。
- 协议插件管理页不再孤立存在，后续应并入“协议工作台 / Protocol Workspace”。

## 建议新增

### 1. Endpoint 工作台

设备页不只展示 Service / Characteristic 树，而是展示接口化视图：

- Service 卡片：名称、UUID、角色、匹配到的协议模板、有效性提示。
- Characteristic 行：方向、属性、值格式、最后一次 TX/RX、样例数量。
- Operation 列表：从内置协议文档、用户标注、样例配对中生成。

用户看到的不是“FFE1”，而是：

```text
Generic Command Service
  Command TX
    device.getInfo
    device.setConfig
  Event RX
    device.event
```

### 2. 请求-响应样例配对

日志长按保存单条样例还不够。应增加：

- 选择一条 TX，自动推荐时间窗口内的 RX。
- 保存为接口样例：`requestExample + responseExample`。
- 可编辑操作名、描述、字段备注、Mock 策略。
- 可标记异常样例：timeout、invalid checksum、unexpected response。

这会把“日志”升级为“协议学习材料”。

### 3. 导出前整理页

点击“导出调试包”后，不直接选择格式，而是进入一个轻量整理页：

- 设备：本设备 / 所有已连接设备。
- 范围：全部日志 / 近 80 条 / 已保存样例优先。
- 目的：AI 分析 / Mock 测试 / 团队归档。
- 问题描述：当前遇到的问题、期望 AI 回答什么。
- 隐私选项：是否脱敏设备 ID、是否包含原始日志。

确认后生成同一个 Debug Pack。

### 4. AI Prompt Builder

`AI_PROMPT.md` 不应该只是报告，而应该像一个可执行的上下文包：

```md
# Task
请分析这个 BLE 设备协议，并指出请求/响应关系、字段含义、潜在错误和 Mock 建议。

# Device Context
...

# Known Endpoints
...

# Saved Examples
...

# Recent Logs
...

# Questions
- 为什么发送 AA 01 00 AB 后偶尔没有 Notify？
- 这个响应中的第 4、5 字节可能表示什么？
```

它的目标是让 AI agent 不需要追问基础上下文。

### 5. Mock Mode

Mock JSON 不只是导出给外部工具，还应反哺 App：

- 导入 Debug Pack 或 Mock JSON。
- 在无硬件时创建虚拟设备 session。
- 调试页仍然使用相同 UI：选择 endpoint、发送命令、收到模拟 RX。
- Mock 响应来自保存样例、协议模板、用户规则。

这样产品闭环从“导出 Mock 文档”升级为“App 内无硬件复现”。

## 完整流程设计

### 阶段 1：想法 / 任务创建

用户不是从“我要导出什么格式”开始，而是从调试任务开始：

- 我要接入一个新 BLE 设备。
- 我要复现一个硬件问题。
- 我要把协议交给 App 同事联调。
- 我要让 AI 帮我分析未知帧。
- 我要生成无硬件 Mock 数据。

App 内可以用一个简单字段承接：

```text
本次调试目标 / 问题描述
```

这段内容会进入 Debug Pack。

### 阶段 2：扫描与连接

用户扫描设备，按名称/RSSI 过滤并连接。系统创建独立 session：

- 设备身份
- RSSI 历史
- MTU
- 服务树
- 通信日志
- 保存样例

多设备仍然保留，但每个设备都应能独立导出 Debug Pack。

### 阶段 3：服务发现与语义增强

加载 Service / Characteristic 后，系统自动做三件事：

- 用内置 Markdown 协议模板匹配已知 UUID。
- 为未知 UUID 创建待标注 Endpoint。
- 给每个 endpoint 计算可用动作：READ、WRITE、WRITE_NR、NOTIFY、INDICATE。

界面重点从“树”变成“接口资产”：

```text
Endpoint = Service + Characteristic + Properties + Direction + Examples + Mock
```

### 阶段 4：实时调试

用户在调试页进行硬件工程师熟悉的操作：

- HEX / ASCII 发送。
- READ。
- Notify 订阅。
- MTU 协商。
- 快捷命令复用。
- 协议插件解析 RX。

这部分保持“串口助手式即时体验”，不要牺牲。

### 阶段 5：沉淀样例

系统将日志按 endpoint 自动归类。用户可以：

- 保存单条 TX / RX 样例。
- 把 TX 与 RX 配对为接口样例。
- 将快捷命令升级为 Operation 请求。
- 将协议插件解析结果写回样例字段。
- 标注 Mock 响应规则。

这是产品差异化的核心：调试过程自然生成协议文档。

### 阶段 6：导出 Debug Pack

全局唯一主入口：

```text
导出调试包
```

导出内容固定、完整、机器可读：

- 设备拓扑
- 协议文档
- endpoint 语义
- 操作列表
- 请求/响应样例
- 原始日志
- AI prompt
- Mock seed
- 用户问题描述

用户不需要理解“我要导出 Markdown 还是 JSON”。用户只需要知道“我要把本次调试交给谁继续处理”。

### 阶段 7：AI 分析 / Mock 复用

AI 使用 `AI_PROMPT.md` 和 `protocol.json` 理解上下文：

- 归纳协议接口。
- 猜测字段含义。
- 找出异常帧。
- 生成测试建议。
- 补全 Mock 规则。

App 或测试环境使用 `mock.json`：

- 生成虚拟设备响应。
- 无硬件联调 App 业务层。
- 复现异常响应和边界数据。

### 阶段 8：反哺协议库

AI 或用户整理后的结论可以回写成：

- 新的 Markdown 协议模板。
- 更新后的快捷命令集合。
- 新的字段定义。
- 新的 Mock 规则。

最终形成团队共享的 BLE API Collection。

## 新项目亮点文案

建议对外介绍时，不再把功能点平铺成“扫描、连接、日志、导出”，而是突出这些亮点：

### BLE API Collection

像管理 HTTP API 一样管理 BLE 接口。Service 和 Characteristic 不再只是 UUID，而是有名称、方向、字段、样例和 Mock 规则的接口资产。

### Traffic To Contract

真实 TX/RX 通信可以一键沉淀为协议样例，并按设备、服务、特征值、操作归类，逐步形成可维护的协议契约。

### One-click Debug Pack

唯一导出入口生成完整 Debug Pack，同时包含人读 README、AI Prompt、协议 JSON、Mock JSON、原始日志和样例数据。

### AI-ready BLE Context

导出的 AI Prompt 自带设备拓扑、接口语义、样例、近期日志和问题描述，让 AI agent 能直接进入分析状态。

### Hardware-free Mock

Mock Pack 可用于 App 无硬件联调，后续可在 App 内创建虚拟 BLE session，用同一套调试界面复现真实设备行为。

### Engineer-first Console

保留硬件工程师熟悉的 HEX / ASCII、READ、WRITE、Notify、MTU、RSSI 实时调试体验，同时把调试过程自动沉淀为接口文档。

## 页面信息架构建议

保留三个主 Tab，但重新定义职责：

### Scan

职责：发现设备和恢复最近连接。

不承担导出、不承担协议管理。

### Workspace

由当前 Device 页演进而来。

职责：

- 多设备总览。
- Endpoint / Operation 工作台。
- 协议模板匹配。
- 样例和 Mock 规则整理。
- 唯一导出入口。

### Console

由当前 Debug 页演进而来。

职责：

- 实时收发。
- 日志查看。
- READ / Notify / MTU。
- 快捷命令。
- 保存样例和配对样例。

Console 可以有“保存为样例”，但不再有独立“导出日志”主入口。

## 代码落地路线

### Step 1：统一导出模型

新增 `buildDebugPack(info)`，由它统一生成：

- `device`
- `endpoints`
- `operations`
- `samples`
- `logs`
- `aiPrompt`
- `protocolSpec`
- `mockPack`

现有 `buildAiDebugReportMarkdown`、`buildProtocolSpecJson`、`buildMockPackJson` 改为 Debug Pack 的子产物。

### Step 2：统一导出入口

设备页只保留一个按钮：

```text
导出调试包
```

删除格式 Tab，改为导出目的、范围、备注、脱敏选项。

调试页和日志面板移除独立导出按钮，必要时跳转到 Workspace 的导出整理页。

### Step 3：样例配对

扩展 `BleProtocolSample`：

```ts
type BleProtocolExample = {
  id: string
  deviceId: string
  serviceUUID: string
  characteristicUUID: string
  operationId?: string
  name: string
  request?: SampleFrame
  response?: SampleFrame
  tags?: string[]
  note?: string
  mock?: {
    delayMs?: number
    match?: string
    responseHex?: string
    repeat?: boolean
  }
}
```

短期兼容现有单条 sample，长期迁移到 request/response example。

### Step 4：Endpoint 视图

新增 endpoint 聚合函数：

```ts
buildEndpointCatalog(session, matchedProtocolDocs, samples, logs)
```

用于设备页展示和 Debug Pack 导出。

### Step 5：Mock Mode

先实现导入 Mock JSON 后创建虚拟 session，后续再抽象成完整 BLE provider：

- RealBleProvider：真实 UniApp BLE。
- MockBleProvider：读取 Mock Pack。

这样调试页不关心底层是真硬件还是模拟设备。

## 最终目标流程

```text
想法 / 问题
  -> 扫描设备
  -> 连接并发现服务
  -> 自动匹配协议模板
  -> 选择 endpoint 实时调试
  -> 保存 TX/RX 或配对样例
  -> 标注 operation / 字段 / Mock 规则
  -> 一键导出 Debug Pack
  -> AI 分析或 Mock 复用
  -> 回写协议模板与团队共享
```

这条链路就是项目最应该突出的产品价值：不是单次收发数据，而是把一次 BLE 调试变成可复用的接口资产。
