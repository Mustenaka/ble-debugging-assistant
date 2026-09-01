/**
 * 心跳持续连接测试：配置模型与持久化
 * 运行时逻辑在 bleStore 中（需要访问会话与 RX 流）
 */

export const HEARTBEAT_LABEL = 'HEARTBEAT'
export const HEARTBEAT_ACK_LABEL = 'HEARTBEAT ACK'

/** 日志条目是否属于心跳收发 */
export function isHeartbeatLabel(label?: string): boolean {
  return !!label && label.startsWith(HEARTBEAT_LABEL)
}

export interface HeartbeatConfig {
  /** 心跳写入目标 */
  serviceUUID: string
  characteristicUUID: string
  /** 心跳内容（符合设备协议的有效负载，而非空包） */
  payloadMode: 'hex' | 'ascii'
  payload: string
  /** 发送间隔毫秒 */
  intervalMs: number
  writeWithResponse: boolean
  /** 是否校验设备应答 */
  expectResponse: boolean
  /** 应答特征值 UUID（空 = 任意已订阅特征值的 RX 都算应答） */
  responseCharacteristicUUID: string
  /** 应答内容 HEX 前缀匹配（空 = 任意内容即算应答） */
  responseMatchHex: string
  /** 应答超时毫秒（超时计为丢失） */
  timeoutMs: number
}

export function defaultHeartbeatConfig(): HeartbeatConfig {
  return {
    serviceUUID: '',
    characteristicUUID: '',
    payloadMode: 'hex',
    payload: '',
    intervalMs: 5000,
    writeWithResponse: false,
    expectResponse: true,
    responseCharacteristicUUID: '',
    responseMatchHex: '',
    timeoutMs: 2000,
  }
}

const HEARTBEAT_CONFIG_KEY = 'ble_heartbeat_configs'

function loadAllConfigs(): Record<string, HeartbeatConfig> {
  try {
    const raw = uni.getStorageSync(HEARTBEAT_CONFIG_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function loadHeartbeatConfig(deviceId: string): HeartbeatConfig | null {
  return loadAllConfigs()[deviceId] ?? null
}

export function saveHeartbeatConfig(deviceId: string, config: HeartbeatConfig): void {
  const all = loadAllConfigs()
  all[deviceId] = config
  try {
    uni.setStorageSync(HEARTBEAT_CONFIG_KEY, JSON.stringify(all))
  } catch (e) {
    console.error('[Heartbeat] saveConfig failed:', e)
  }
}

/** 心跳运行时状态（挂在 DeviceSession 上） */
export interface HeartbeatRuntime {
  running: boolean
  config: HeartbeatConfig | null
  startedAt: number | null
  sent: number
  acked: number
  missed: number
  consecutiveMissed: number
  lastRttMs: number | null
  rttMinMs: number | null
  rttAvgMs: number | null
  rttMaxMs: number | null
  rttSum: number
  rttHistory: { time: number; rtt: number }[]
  timer: ReturnType<typeof setInterval> | null
  timeoutTimer: ReturnType<typeof setTimeout> | null
  pendingSentAt: number | null
}

export function createHeartbeatRuntime(): HeartbeatRuntime {
  return {
    running: false,
    config: null,
    startedAt: null,
    sent: 0,
    acked: 0,
    missed: 0,
    consecutiveMissed: 0,
    lastRttMs: null,
    rttMinMs: null,
    rttAvgMs: null,
    rttMaxMs: null,
    rttSum: 0,
    rttHistory: [],
    timer: null,
    timeoutTimer: null,
    pendingSentAt: null,
  }
}

/** 丢失率百分比（0~100，保留 1 位小数） */
export function heartbeatLossPercent(hb: HeartbeatRuntime): number {
  const judged = hb.acked + hb.missed
  if (!judged) return 0
  return Math.round((hb.missed / judged) * 1000) / 10
}
