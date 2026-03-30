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

// ─── iOS only: plus.io FileWriter（iOS 平台稳定；Android 上 onwriteend 不触发，已废弃）───

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
              console.error('[Export/writeToDir] onwriteend error —', JSON.stringify(writer.error))
              reject(new Error(writer.error.message ?? 'write error'))
              return
            }
            const nativeUrl: string = fileEntry.toNativeURL()
            const localUrl: string = fileEntry.toLocalURL()
            console.log('[Export/writeToDir] write success — nativeUrl:', nativeUrl, '| localUrl:', localUrl)
            resolve(nativeUrl || localUrl)
          }
          writer.onerror = (e: any) => {
            console.error('[Export/writeToDir] onerror —', JSON.stringify(e))
            reject(new Error(e?.message ?? 'FileWriter error'))
          }
          console.log('[Export/writeToDir] writer.write() called')
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

// ─── Android: Java 原生 File I/O（绕过 plus.io FileWriter 在 Android 上不稳定的问题）───

/**
 * 通过 Android Java Bridge 写文件，同步执行（JS 线程短暂阻塞，日志文件通常 < 1MB 可接受）
 *
 * usePublicDownloads=true  → /sdcard/Download/ble-debugging/   (需 WRITE_EXTERNAL_STORAGE)
 * usePublicDownloads=false → /sdcard/Android/data/<pkg>/files/ble-debugging/  (无需权限)
 */
function writeViaAndroidJava(name: string, content: string, usePublicDownloads: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const File = plus.android.importClass('java.io.File')
      const FileOutputStream = plus.android.importClass('java.io.FileOutputStream')
      const OutputStreamWriter = plus.android.importClass('java.io.OutputStreamWriter')
      const activity = plus.android.runtimeMainActivity()

      let basePath: string
      if (usePublicDownloads) {
        const Environment = plus.android.importClass('android.os.Environment')
        basePath = Environment
          .getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
          .getAbsolutePath()
        console.log('[Export/JavaFile] target: PUBLIC_DOWNLOADS —', basePath)
      } else {
        // 外部沙盒目录：无需权限，文件管理器可见，FileProvider 可分享
        basePath = activity.getExternalFilesDir(null).getAbsolutePath()
        console.log('[Export/JavaFile] target: externalFilesDir —', basePath)
      }

      const dir = new File(basePath + '/' + EXPORT_SUBFOLDER)
      if (!dir.exists()) {
        const ok: boolean = dir.mkdirs()
        console.log('[Export/JavaFile] mkdirs:', ok, '—', dir.getAbsolutePath())
      }

      const file = new File(dir.getAbsolutePath() + '/' + name)
      const fos = new FileOutputStream(file, false)   // false = overwrite
      const osw = new OutputStreamWriter(fos, 'UTF-8')
      osw.write(content)
      osw.flush()
      osw.close()

      const filePath: string = file.getAbsolutePath()
      console.log('[Export/JavaFile] write success —', filePath)
      resolve(filePath)
    } catch (e: any) {
      console.error('[Export/JavaFile] error —', e?.message ?? JSON.stringify(e))
      reject(new Error(e?.message ?? 'Java File write error'))
    }
  })
}

/** 保存日志到本地文件
 *  Android：Java File I/O（有权限 → 系统 Downloads；无权限 → App 外部文件目录）
 *  iOS    ：plus.io FileWriter（iOS 稳定）
 *  H5     ：触发浏览器下载
 */
export function saveLogsToFile(content: string, filename?: string, mimeType = 'text/plain'): Promise<string> {
  const name = filename ?? `ble_log_${Date.now()}.txt`

  return new Promise<string>((resolve, reject) => {
    // #ifdef APP-PLUS
    console.log('[Export/saveLogsToFile] APP-PLUS: writing', name, '| content length:', content.length, '| os:', plus.os.name)

    if (plus.os.name === 'Android') {
      // 动态申请 WRITE_EXTERNAL_STORAGE（Android 9 以下有效；Android 10+ 会进 deniedAlways）
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
          writeViaAndroidJava(name, content, granted)
            .then(resolve)
            .catch((err: Error) => {
              // 公开目录写入失败时回退到外部沙盒目录
              console.warn('[Export/saveLogsToFile] public write failed, retrying with externalFilesDir —', err.message)
              writeViaAndroidJava(name, content, false).then(resolve).catch(reject)
            })
        },
        (e: any) => {
          console.warn('[Export/saveLogsToFile] requestPermissions error, using externalFilesDir —', JSON.stringify(e))
          writeViaAndroidJava(name, content, false).then(resolve).catch(reject)
        },
      )
    } else {
      // iOS：plus.io 在 iOS 平台稳定可用
      console.log('[Export/saveLogsToFile] iOS: writing to _doc/', name)
      plus.io.resolveLocalFileSystemURL('_doc/', (rootDir: any) => {
        console.log('[Export/saveLogsToFile] iOS: _doc/ resolved')
        writeToDir(rootDir, name, content, mimeType).then(resolve).catch(reject)
      }, (e: any) => {
        console.error('[Export/saveLogsToFile] iOS: _doc/ error —', JSON.stringify(e))
        reject(new Error(e?.message ?? '_doc/ error'))
      })
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

// ─── 设备信息报告导出 ────────────────────────────────────────────────────────

export interface DeviceCharExport {
  uuid: string
  properties: { read?: boolean; write?: boolean; writeNoResponse?: boolean; notify?: boolean; indicate?: boolean }
}

export interface DeviceServiceExport {
  uuid: string
  isPrimary: boolean
  charsLoaded: boolean
  characteristics: DeviceCharExport[]
}

export interface DeviceReportInfo {
  name: string
  deviceId: string
  rssi?: number
  mtu?: number
  services: DeviceServiceExport[]
  notes?: string
}

export function buildDeviceReportFilename(deviceName: string, ext: 'txt' | 'md' | 'csv'): string {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const safeName = (deviceName || 'Unknown').replace(/[^\w\u4e00-\u9fa5]/g, '_').slice(0, 20)
  return `BLE_DeviceReport_${safeName}_${date}_${time}.${ext}`
}

function propsLabel(p: DeviceCharExport['properties']): string {
  const tags: string[] = []
  if (p.read)            tags.push('READ')
  if (p.write)           tags.push('WRITE')
  if (p.writeNoResponse) tags.push('WRITE NR')
  if (p.notify)          tags.push('NOTIFY')
  if (p.indicate)        tags.push('INDICATE')
  return tags.join('  ') || '—'
}

export function exportDeviceReportToText(info: DeviceReportInfo): string {
  const sep = '═'.repeat(54)
  const now = formatTimestamp(Date.now(), true)
  const lines: string[] = [
    sep,
    '  BLE 设备信息报告',
    sep,
    `  设备名称 : ${info.name}`,
    `  设备 ID  : ${info.deviceId || '—'}`,
    `  RSSI     : ${info.rssi != null ? info.rssi + ' dBm' : '—'}`,
    `  MTU      : ${info.mtu ?? '—'}`,
    `  导出时间 : ${now}`,
    '',
    '  备注:',
    info.notes?.trim() ? `  ${info.notes.trim().replace(/\n/g, '\n  ')}` : '  （无备注）',
    sep,
    `  服务 & 特征值 (共 ${info.services.length} 个)`,
    sep,
    '',
  ]
  for (const [i, svc] of info.services.entries()) {
    lines.push(`[${i + 1}] SERVICE: ${svc.uuid}${svc.isPrimary ? '  (PRIMARY)' : ''}`)
    if (!svc.charsLoaded) {
      lines.push('    CHARS: （未加载，请展开后重新导出）')
    } else if (!svc.characteristics.length) {
      lines.push('    CHARS: （无）')
    } else {
      lines.push(`    CHARS (${svc.characteristics.length}):`)
      svc.characteristics.forEach((ch, ci) => {
        const last = ci === svc.characteristics.length - 1
        lines.push(`    ${last ? '└' : '├'} [${ci + 1}] ${ch.uuid}`)
        lines.push(`    ${last ? ' ' : '│'}       Properties: ${propsLabel(ch.properties)}`)
      })
    }
    lines.push('')
  }
  return lines.join('\n')
}

export function exportDeviceReportToMarkdown(info: DeviceReportInfo): string {
  const now = formatTimestamp(Date.now(), true)
  const ck = (v?: boolean) => v ? '✓' : ''
  const lines: string[] = [
    '# BLE Device Report',
    '',
    '## Device Info',
    '',
    '| Field | Value |',
    '|:------|:------|',
    `| Name | ${info.name} |`,
    `| Device ID | \`${info.deviceId || '—'}\` |`,
    `| RSSI | ${info.rssi != null ? info.rssi + ' dBm' : '—'} |`,
    `| MTU | ${info.mtu ?? '—'} |`,
    `| Export Time | ${now} |`,
    '',
    '## Notes',
    '',
    info.notes?.trim()
      ? `> ${info.notes.trim().replace(/\n/g, '\n> ')}`
      : '> *(empty)*',
    '',
    '## Services & Characteristics',
    '',
  ]
  for (const [i, svc] of info.services.entries()) {
    lines.push(`### Service ${i + 1}${svc.isPrimary ? ' · PRIMARY' : ''}`)
    lines.push('')
    lines.push(`**UUID:** \`${svc.uuid}\``)
    lines.push('')
    if (!svc.charsLoaded) {
      lines.push('> ⚠ Characteristics not loaded — expand this service and re-export.')
    } else if (!svc.characteristics.length) {
      lines.push('> No characteristics.')
    } else {
      lines.push('| Characteristic | READ | WRITE | WRITE NR | NOTIFY | INDICATE |')
      lines.push('|:--------------|:----:|:-----:|:--------:|:------:|:--------:|')
      for (const ch of svc.characteristics) {
        const p = ch.properties
        lines.push(`| \`${ch.uuid}\` | ${ck(p.read)} | ${ck(p.write)} | ${ck(p.writeNoResponse)} | ${ck(p.notify)} | ${ck(p.indicate)} |`)
      }
    }
    lines.push('')
  }
  lines.push('---')
  lines.push(`*Generated by BLE Debugging Assistant — ${now}*`)
  return lines.join('\n')
}

export function exportDeviceReportToCSV(info: DeviceReportInfo): string {
  const now = formatTimestamp(Date.now(), true)
  const esc = (s: string) => `"${String(s).replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`
  const rows: string[] = [
    `# BLE Device Report,${esc(now)}`,
    '',
    '## Device Info',
    'Field,Value',
    `Name,${esc(info.name)}`,
    `Device ID,${esc(info.deviceId || '—')}`,
    `RSSI,${esc(info.rssi != null ? info.rssi + ' dBm' : '—')}`,
    `MTU,${esc(String(info.mtu ?? '—'))}`,
    `Notes,${esc(info.notes?.trim() || '')}`,
    '',
    '## Services & Characteristics',
    'Service UUID,Primary,Char UUID,READ,WRITE,WRITE NR,NOTIFY,INDICATE',
  ]
  for (const svc of info.services) {
    if (!svc.charsLoaded || !svc.characteristics.length) {
      rows.push(`${esc(svc.uuid)},${svc.isPrimary},${svc.charsLoaded ? '(none)' : '(not loaded)'},,,,,`)
    } else {
      for (const ch of svc.characteristics) {
        const p = ch.properties
        rows.push([
          esc(svc.uuid), String(svc.isPrimary), esc(ch.uuid),
          String(!!p.read), String(!!p.write), String(!!p.writeNoResponse),
          String(!!p.notify), String(!!p.indicate),
        ].join(','))
      }
    }
  }
  return rows.join('\n')
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
