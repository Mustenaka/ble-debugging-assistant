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

export interface ExportDeviceInfo {
  name: string
  deviceId: string
  txBytes: number
  rxBytes: number
}

/** 根据设备名 + 当前时间生成导出文件名 */
export function buildExportFilename(deviceName: string, ext: 'txt' | 'csv'): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const safeName = (deviceName || 'Unknown').replace(/[^\w\u4e00-\u9fa5]/g, '_').slice(0, 20)
  return `BLE_${safeName}_${date}_${time}.${ext}`
}

/** 日志列表导出为 CSV */
export function exportLogsToCSV(logs: LogEntry[], device: ExportDeviceInfo | string = 'Unknown'): string {
  const info: ExportDeviceInfo = typeof device === 'string'
    ? { name: device, deviceId: '', txBytes: 0, rxBytes: 0 }
    : device
  const esc = (s: string) => `"${s.replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const meta = [
    `# BLE调试日志`,
    `# 设备名称,${esc(info.name)}`,
    `# 设备ID,${esc(info.deviceId)}`,
    `# 导出时间,${formatTimestamp(Date.now(), true)}`,
    `# 发送字节,${info.txBytes}`,
    `# 接收字节,${info.rxBytes}`,
    `# 日志条数,${logs.length}`,
    '',
  ].join('\n')
  const header = ['Time', 'Direction', 'HEX', 'ASCII', 'Bytes', 'Label'].join(',')
  const rows = logs.map((e) => [
    formatTimestamp(e.timestamp, true),
    e.direction,
    esc(e.hex),
    esc(e.ascii),
    String(e.rawLength),
    esc(e.label ?? ''),
  ].join(','))
  return meta + [header, ...rows].join('\n')
}

/** 日志列表导出为文本 */
export function exportLogsToText(logs: LogEntry[], device: ExportDeviceInfo | string = 'Unknown'): string {
  const info: ExportDeviceInfo = typeof device === 'string'
    ? { name: device, deviceId: '', txBytes: 0, rxBytes: 0 }
    : device
  const sep = '═══════════════════════════════════════════════════════'
  const header = [
    sep,
    `  BLE 调试日志`,
    `  设备名称 : ${info.name}`,
    `  设备 ID  : ${info.deviceId || '—'}`,
    `  导出时间 : ${formatTimestamp(Date.now(), true)}`,
    `  发送字节 : ${info.txBytes} B    接收字节 : ${info.rxBytes} B`,
    `  日志条数 : ${logs.length}`,
    sep,
    '',
  ].join('\n')
  return header + logs.map(logEntryToText).join('\n')
}

const EXPORT_SUBFOLDER = 'ble-debugging'

/** 写文件核心：dirEntry → 子目录 → 文件 → writer（使用 onwriteend 确保回调触发） */
function writeToDir(dirEntry: any, name: string, content: string, mimeType: string): Promise<string> {
  return new Promise((resolve, reject) => {
    console.log('[Export/writeToDir] getDirectory —', EXPORT_SUBFOLDER)
    dirEntry.getDirectory(EXPORT_SUBFOLDER, { create: true, exclusive: false }, (subDir: any) => {
      console.log('[Export/writeToDir] subfolder ready, getFile —', name)
      subDir.getFile(name, { create: true, exclusive: false }, (fileEntry: any) => {
        console.log('[Export/writeToDir] fileEntry obtained, creating writer...')
        fileEntry.createWriter((writer: any) => {
          writer.onwriteend = () => {
            if (writer.error) {
              console.error('[Export/writeToDir] onwriteend — writer.error:', JSON.stringify(writer.error))
              reject(new Error(writer.error.message ?? 'write error'))
              return
            }
            const nativeUrl: string = fileEntry.toNativeURL()
            const localUrl: string = fileEntry.toLocalURL()
            console.log('[Export/writeToDir] write success — nativeUrl:', nativeUrl, '| localUrl:', localUrl)
            resolve(nativeUrl || localUrl)
          }
          writer.onerror = (e: any) => {
            console.error('[Export/writeToDir] FileWriter.onerror —', JSON.stringify(e))
            reject(new Error(e?.message ?? 'FileWriter error'))
          }
          // plus.io FileWriter 在部分 Android 版本对 Blob 写入不触发 onwriteend，
          // 直接写字符串更可靠
          console.log('[Export/writeToDir] writer.write() called (string mode)')
          writer.write(content)
        }, (e: any) => {
          console.error('[Export/writeToDir] createWriter error —', JSON.stringify(e))
          reject(new Error(e?.message ?? 'createWriter error'))
        })
      }, (e: any) => {
        console.error('[Export/writeToDir] getFile error —', JSON.stringify(e))
        reject(new Error(e?.message ?? 'getFile error'))
      })
    }, (e: any) => {
      console.error('[Export/writeToDir] getDirectory error —', JSON.stringify(e))
      reject(new Error(e?.message ?? 'getDirectory error'))
    })
  })
}

/** 保存日志到本地文件
 *  Android：先动态申请 WRITE_EXTERNAL_STORAGE，授权后写入公开下载目录，
 *            拒绝或失败则回退到 App 私有目录（_doc/ble-debugging/）
 *  iOS：直接写入 App 私有目录（Documents/ble-debugging/），通过分享面板导出
 *  H5：触发浏览器下载
 */
export function saveLogsToFile(content: string, filename?: string, mimeType = 'text/plain'): Promise<string> {
  const name = filename ?? `ble_log_${Date.now()}.txt`

  return new Promise<string>((resolve, reject) => {
    // #ifdef APP-PLUS
    console.log('[Export/saveLogsToFile] APP-PLUS: writing', name, '| content length:', content.length, '| os:', plus.os.name)

    const writeToPublicDownloads = () => {
      console.log('[Export/saveLogsToFile] trying PUBLIC_DOWNLOADS...')
      plus.io.requestFileSystem(plus.io.PUBLIC_DOWNLOADS, (fs: any) => {
        console.log('[Export/saveLogsToFile] PUBLIC_DOWNLOADS acquired')
        writeToDir(fs.root, name, content, mimeType).then(resolve).catch((e: any) => {
          console.warn('[Export/saveLogsToFile] PUBLIC_DOWNLOADS write failed, fallback to _doc/ —', e.message)
          writeToPrivateDoc()
        })
      }, (e: any) => {
        console.warn('[Export/saveLogsToFile] PUBLIC_DOWNLOADS requestFileSystem failed, fallback to _doc/ —', JSON.stringify(e))
        writeToPrivateDoc()
      })
    }

    const writeToPrivateDoc = () => {
      console.log('[Export/saveLogsToFile] writing to _doc/ble-debugging/')
      plus.io.resolveLocalFileSystemURL('_doc/', (rootDir: any) => {
        console.log('[Export/saveLogsToFile] _doc/ resolved')
        writeToDir(rootDir, name, content, mimeType).then(resolve).catch((e: any) => {
          console.error('[Export/saveLogsToFile] _doc/ write failed —', e.message)
          reject(e)
        })
      }, (e: any) => {
        console.error('[Export/saveLogsToFile] _doc/ resolveLocalFileSystemURL error —', JSON.stringify(e))
        reject(new Error(e?.message ?? '_doc/ error'))
      })
    }

    if (plus.os.name === 'Android') {
      // Android 6+ 需要动态申请危险权限
      console.log('[Export/saveLogsToFile] Android: requesting WRITE_EXTERNAL_STORAGE...')
      plus.android.requestPermissions(
        ['android.permission.WRITE_EXTERNAL_STORAGE'],
        (e: any) => {
          const granted = (e.granted as string[]).includes('android.permission.WRITE_EXTERNAL_STORAGE')
          console.log(
            '[Export/saveLogsToFile] permission result — granted:', granted,
            '| deniedPresent:', JSON.stringify(e.deniedPresent),
            '| deniedAlways:', JSON.stringify(e.deniedAlways),
          )
          if (granted) {
            writeToPublicDownloads()
          } else {
            // Android 10+ (targetSdkVersion=33) 无法授予此权限，直接回退私有目录
            console.log('[Export/saveLogsToFile] permission denied — fallback to _doc/')
            writeToPrivateDoc()
          }
        },
        (e: any) => {
          console.warn('[Export/saveLogsToFile] requestPermissions error —', JSON.stringify(e))
          writeToPrivateDoc()
        },
      )
    } else {
      // iOS：直接写私有目录，再通过分享面板导出到 Files / AirDrop 等
      writeToPrivateDoc()
    }
    // #endif

    // #ifndef APP-PLUS
    console.log('[Export/saveLogsToFile] H5 fallback — filename:', name)
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

// ─── 设备 PIN 配置 ────────────────────────────────────────────────────────────

/** 设备 PIN 码配置（按 deviceId 存储） */
export interface DevicePinConfig {
  deviceId: string
  pin: string
  /** 'ascii' = 直接作为字符串写入；'hex' = 解析为字节序列写入 */
  mode: 'ascii' | 'hex'
  /** 是否在连接成功后自动写入 PIN */
  autoSend: boolean
  /** 自动发送目标特征值 UUID（为空则仅提示手动发送） */
  charUUID: string
  /** 自动发送目标服务 UUID */
  serviceUUID: string
}

const PIN_STORAGE_KEY = 'ble_device_pins'

export function loadDevicePins(): Record<string, DevicePinConfig> {
  try {
    const raw = uni.getStorageSync(PIN_STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function saveDevicePin(config: DevicePinConfig): void {
  const all = loadDevicePins()
  all[config.deviceId] = config
  uni.setStorageSync(PIN_STORAGE_KEY, JSON.stringify(all))
}

export function removeDevicePin(deviceId: string): void {
  const all = loadDevicePins()
  delete all[deviceId]
  uni.setStorageSync(PIN_STORAGE_KEY, JSON.stringify(all))
}

export function getDevicePin(deviceId: string): DevicePinConfig | null {
  return loadDevicePins()[deviceId] ?? null
}
