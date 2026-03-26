/**
 * Buffer / 日志相关工具
 */

import { bufToHex, bufToAscii } from './hex'

export type LogDirection = 'TX' | 'RX' | 'SYS'

export interface LogEntry {
  id: string
  timestamp: number
  direction: LogDirection
  hex: string
  ascii: string
  rawLength: number
  label?: string
}

let logIdCounter = 0

/** 创建日志条目 */
export function createLogEntry(
  direction: LogDirection,
  buffer: ArrayBuffer,
  label?: string
): LogEntry {
  return {
    id: `log_${Date.now()}_${++logIdCounter}`,
    timestamp: Date.now(),
    direction,
    hex: bufToHex(buffer),
    ascii: bufToAscii(buffer),
    rawLength: buffer.byteLength,
    label,
  }
}

/** 格式化时间戳显示 */
export function formatTimestamp(ts: number, showDate = false): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  const ms = d.getMilliseconds().toString().padStart(3, '0')
  const time = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${ms}`
  if (!showDate) return time
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${time}`
}

/** 日志条目转导出文本 */
export function logEntryToText(entry: LogEntry): string {
  const ts = formatTimestamp(entry.timestamp, true)
  const dir = entry.direction.padEnd(3)
  const label = entry.label ? ` [${entry.label}]` : ''
  return `[${ts}] ${dir}${label} HEX: ${entry.hex}  ASCII: ${entry.ascii}`
}

/** 日志列表导出为 CSV */
export function exportLogsToCSV(logs: LogEntry[], deviceName = 'Unknown'): string {
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const header = ['Time', 'Direction', 'HEX', 'ASCII', 'Bytes', 'Label'].join(',')
  const rows = logs.map((e) => [
    formatTimestamp(e.timestamp, true),
    e.direction,
    esc(e.hex),
    esc(e.ascii),
    String(e.rawLength),
    esc(e.label ?? ''),
  ].join(','))
  return [header, ...rows].join('\n')
}

/** 日志列表导出为文本 */
export function exportLogsToText(logs: LogEntry[], deviceName = 'Unknown'): string {
  const header = [
    '═══════════════════════════════════════════════════════',
    `  BLE 调试日志  |  设备: ${deviceName}`,
    `  导出时间: ${formatTimestamp(Date.now(), true)}`,
    '═══════════════════════════════════════════════════════',
    '',
  ].join('\n')
  return header + logs.map(logEntryToText).join('\n')
}

/** 保存日志到本地文件 */
export async function saveLogsToFile(content: string, filename?: string, mimeType = 'text/plain'): Promise<string> {
  const name = filename ?? `ble_log_${Date.now()}.txt`

  return new Promise((resolve, reject) => {
    // #ifdef APP-PLUS
    const fs = uni.getFileSystemManager()
    const path = `${uni.env.USER_DATA_PATH}/${name}`
    fs.writeFile({
      filePath: path,
      data: content,
      encoding: 'utf8',
      success: () => resolve(path),
      fail: (err: any) => reject(err),
    })
    // #endif

    // #ifndef APP-PLUS
    // H5 fallback
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    URL.revokeObjectURL(url)
    resolve(name)
    // #endif
  })
}

/** 环形日志缓冲区 */
export class RingBuffer<T> {
  private buf: T[] = []
  private maxSize: number

  constructor(maxSize = 1000) {
    this.maxSize = maxSize
  }

  push(item: T): void {
    this.buf.push(item)
    if (this.buf.length > this.maxSize) {
      this.buf.shift()
    }
  }

  pushAll(items: T[]): void {
    items.forEach((item) => this.push(item))
  }

  getAll(): T[] {
    return [...this.buf]
  }

  clear(): void {
    this.buf = []
  }

  get length(): number {
    return this.buf.length
  }
}

/** 快捷命令类型 */
export interface QuickCommand {
  id: string
  name: string
  data: string // HEX 字符串
  mode: 'hex' | 'ascii'
}

/** 从 storage 加载快捷命令 */
export function loadQuickCommands(): QuickCommand[] {
  try {
    const raw = uni.getStorageSync('ble_quick_commands')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/** 保存快捷命令到 storage */
export function saveQuickCommands(cmds: QuickCommand[]): void {
  uni.setStorageSync('ble_quick_commands', JSON.stringify(cmds))
}

/** 最近连接设备 */
export interface RecentDevice {
  deviceId: string
  name: string
  lastConnected: number
}

export function loadRecentDevices(): RecentDevice[] {
  try {
    const raw = uni.getStorageSync('ble_recent_devices')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRecentDevice(device: RecentDevice): void {
  const list = loadRecentDevices().filter((d) => d.deviceId !== device.deviceId)
  list.unshift(device)
  // 最多保存 10 条
  uni.setStorageSync('ble_recent_devices', JSON.stringify(list.slice(0, 10)))
}
