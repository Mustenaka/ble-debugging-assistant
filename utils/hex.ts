/**
 * HEX / ASCII 工具函数
 */

// ─── ArrayBuffer ↔ HEX 字符串 ────────────────────────────────────────────────

/** ArrayBuffer 转 HEX 字符串，如 "01 AB FF" */
export function bufToHex(buffer: ArrayBuffer, separator = ' '): string {
  if (!buffer || buffer.byteLength === 0) return ''
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(separator)
}

/** HEX 字符串转 ArrayBuffer（忽略空格、0x前缀）*/
export function hexToBuf(hex: string): ArrayBuffer {
  const clean = hex.replace(/\s+/g, '').replace(/0[xX]/g, '')
  if (clean.length % 2 !== 0) throw new Error('HEX 字符串长度必须为偶数')
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16)
    if (isNaN(byte)) throw new Error(`无效的 HEX 字符: ${clean.slice(i, i + 2)}`)
    bytes[i / 2] = byte
  }
  return bytes.buffer
}

/** 验证 HEX 字符串是否合法 */
export function isValidHex(hex: string): boolean {
  const clean = hex.replace(/\s+/g, '').replace(/0[xX]/g, '')
  return clean.length > 0 && clean.length % 2 === 0 && /^[0-9A-Fa-f]+$/.test(clean)
}

// ─── ArrayBuffer ↔ ASCII 字符串 ──────────────────────────────────────────────

/** ArrayBuffer 转 ASCII 字符串（不可打印字符显示为'.'）*/
export function bufToAscii(buffer: ArrayBuffer): string {
  if (!buffer || buffer.byteLength === 0) return ''
  return Array.from(new Uint8Array(buffer))
    .map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.'))
    .join('')
}

/** ASCII 字符串转 ArrayBuffer */
export function asciiToBuf(str: string): ArrayBuffer {
  const bytes = new Uint8Array(str.length)
  for (let i = 0; i < str.length; i++) {
    bytes[i] = str.charCodeAt(i) & 0xff
  }
  return bytes.buffer
}

// ─── 格式化工具 ──────────────────────────────────────────────────────────────

/** 格式化 HEX 字符串：每 N 个字节换行 */
export function formatHexDump(buffer: ArrayBuffer, bytesPerLine = 16): string {
  if (!buffer || buffer.byteLength === 0) return ''
  const bytes = Array.from(new Uint8Array(buffer))
  const lines: string[] = []

  for (let i = 0; i < bytes.length; i += bytesPerLine) {
    const chunk = bytes.slice(i, i + bytesPerLine)
    const offset = i.toString(16).padStart(4, '0').toUpperCase()
    const hexPart = chunk.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
    const asciiPart = chunk.map((b) => (b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')).join('')
    lines.push(`${offset}  ${hexPart.padEnd(bytesPerLine * 3 - 1)}  ${asciiPart}`)
  }

  return lines.join('\n')
}

/** 从 HEX 字符串中格式化为带空格的形式 */
export function normalizeHex(hex: string): string {
  const clean = hex.replace(/\s+/g, '').replace(/0[xX]/g, '').toUpperCase()
  return clean.match(/.{1,2}/g)?.join(' ') ?? ''
}

/** 数字转带前缀的 HEX */
export function numToHex(num: number, bytes = 1): string {
  return '0x' + num.toString(16).toUpperCase().padStart(bytes * 2, '0')
}

/** UUID 标准化（补全短 UUID 为 128-bit）*/
export function normalizeUUID(uuid: string): string {
  if (uuid.length === 4) {
    return `0000${uuid.toUpperCase()}-0000-1000-8000-00805F9B34FB`
  }
  if (uuid.length === 8) {
    return `${uuid.toUpperCase()}-0000-1000-8000-00805F9B34FB`
  }
  return uuid.toUpperCase()
}

/** 短化显示 UUID（128-bit → 4字符 if 是标准格式）*/
export function shortUUID(uuid: string): string {
  const upper = uuid.toUpperCase()
  if (upper.endsWith('-0000-1000-8000-00805F9B34FB')) {
    const prefix = upper.split('-')[0]
    if (prefix.length === 8) return prefix.slice(4)
    return prefix
  }
  return upper.length > 8 ? `${upper.slice(0, 8)}...` : upper
}

// ─── 计算工具 ────────────────────────────────────────────────────────────────

/** 计算 XOR 校验和 */
export function calcXorChecksum(buffer: ArrayBuffer): number {
  return Array.from(new Uint8Array(buffer)).reduce((acc, b) => acc ^ b, 0)
}

/** 计算累加和（低 8 位）*/
export function calcSumChecksum(buffer: ArrayBuffer): number {
  return Array.from(new Uint8Array(buffer)).reduce((acc, b) => (acc + b) & 0xff, 0)
}

/** 信号强度 → 百分比 */
export function rssiToPercent(rssi: number): number {
  // RSSI 通常在 -100dBm（弱）到 -30dBm（强）
  const clamped = Math.max(-100, Math.min(-30, rssi))
  return Math.round(((clamped + 100) / 70) * 100)
}

/** 信号强度 → 等级 (0-4) */
export function rssiToLevel(rssi: number): number {
  if (rssi >= -55) return 4
  if (rssi >= -65) return 3
  if (rssi >= -75) return 2
  if (rssi >= -85) return 1
  return 0
}

/** 信号强度 → 颜色 */
export function rssiToColor(rssi: number): string {
  if (rssi >= -55) return '#39FF14' // 绿
  if (rssi >= -65) return '#00F5FF' // 蓝
  if (rssi >= -75) return '#F59E0B' // 黄
  if (rssi >= -85) return '#FF6B35' // 橙
  return '#FF3B3B'                   // 红
}
