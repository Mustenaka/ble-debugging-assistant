/**
 * 字段类型系统：
 *  - 把字段表（offset / length / type / name / meaning）从"纯文档"变成可机器解释的定义
 *  - 同一套类型驱动三件事：接收解码（日志显示语义值）、断言比较、变量/变体编码
 */

import type { ProtocolFieldDoc } from './protocolDocs'
import type { FieldAssertion, OperationAnnotation } from './collection'

export type FieldType =
  | 'u8' | 'i8'
  | 'u16le' | 'u16be' | 'i16le' | 'i16be'
  | 'u24le' | 'u24be'
  | 'u32le' | 'u32be' | 'i32le' | 'i32be'
  | 'f32le' | 'f32be'
  | 'bytes' | 'ascii' | 'utf8' | 'bool' | 'bitmask' | 'bcd'

export interface FieldTypeOption {
  value: FieldType
  label: string
  /** 固定字节数；null = 变长 */
  size: number | null
}

export const FIELD_TYPE_OPTIONS: FieldTypeOption[] = [
  { value: 'u8', label: 'u8', size: 1 },
  { value: 'i8', label: 'i8', size: 1 },
  { value: 'u16le', label: 'u16 LE', size: 2 },
  { value: 'u16be', label: 'u16 BE', size: 2 },
  { value: 'i16le', label: 'i16 LE', size: 2 },
  { value: 'i16be', label: 'i16 BE', size: 2 },
  { value: 'u24le', label: 'u24 LE', size: 3 },
  { value: 'u24be', label: 'u24 BE', size: 3 },
  { value: 'u32le', label: 'u32 LE', size: 4 },
  { value: 'u32be', label: 'u32 BE', size: 4 },
  { value: 'i32le', label: 'i32 LE', size: 4 },
  { value: 'i32be', label: 'i32 BE', size: 4 },
  { value: 'f32le', label: 'float32 LE', size: 4 },
  { value: 'f32be', label: 'float32 BE', size: 4 },
  { value: 'bool', label: 'bool', size: 1 },
  { value: 'bitmask', label: 'bitmask', size: null },
  { value: 'bcd', label: 'BCD', size: null },
  { value: 'bytes', label: 'bytes', size: null },
  { value: 'ascii', label: 'ascii', size: null },
  { value: 'utf8', label: 'utf8', size: null },
]

const FIELD_SIZE: Record<FieldType, number | null> = Object.fromEntries(
  FIELD_TYPE_OPTIONS.map((o) => [o.value, o.size]),
) as Record<FieldType, number | null>

export function fieldSize(type: FieldType | null): number | null {
  return type ? FIELD_SIZE[type] : null
}

/**
 * 把自由文本类型规范化为 FieldType：
 *   uint8 / byte → u8；uint16 / uint16 LE / u16_le → u16le；uint16BE → u16be；
 *   float / float32 → f32le；string / str / char → ascii；utf-8 → utf8；hex / raw / bin → bytes
 * 无法识别返回 null（调用方按长度推断或按 bytes 处理）
 */
export function normalizeFieldType(raw: string | undefined | null): FieldType | null {
  if (!raw) return null
  const s = raw.toLowerCase().replace(/[\s_\-()]/g, '')
  if (!s) return null
  const endian: 'le' | 'be' = /be$|bigendian$|big$/.test(s) ? 'be' : 'le'
  const base = s.replace(/(le|be|littleendian|bigendian|little|big)$/, '')
  const map: Record<string, FieldType | 'int16' | 'uint16' | 'int32' | 'uint32' | 'uint24' | 'float32'> = {
    u8: 'u8', uint8: 'u8', uint8t: 'u8', byte: 'u8', uchar: 'u8', char8: 'u8',
    i8: 'i8', int8: 'i8', int8t: 'i8', sbyte: 'i8',
    u16: 'uint16', uint16: 'uint16', uint16t: 'uint16', word: 'uint16', ushort: 'uint16',
    i16: 'int16', int16: 'int16', int16t: 'int16', short: 'int16',
    u24: 'uint24', uint24: 'uint24',
    u32: 'uint32', uint32: 'uint32', uint32t: 'uint32', dword: 'uint32', uint: 'uint32', ulong: 'uint32',
    i32: 'int32', int32: 'int32', int32t: 'int32', int: 'int32', long: 'int32',
    f32: 'float32', float: 'float32', float32: 'float32', single: 'float32',
    bytes: 'bytes', hex: 'bytes', raw: 'bytes', bin: 'bytes', binary: 'bytes', array: 'bytes', blob: 'bytes', data: 'bytes',
    ascii: 'ascii', str: 'ascii', string: 'ascii', char: 'ascii', chars: 'ascii', text: 'ascii',
    utf8: 'utf8', utf8string: 'utf8', unicode: 'utf8',
    bool: 'bool', boolean: 'bool', flag: 'bool',
    bitmask: 'bitmask', bits: 'bitmask', bitfield: 'bitmask', mask: 'bitmask',
    bcd: 'bcd',
  }
  const hit = map[base] ?? map[s]
  if (!hit) return null
  switch (hit) {
    case 'uint16': return endian === 'be' ? 'u16be' : 'u16le'
    case 'int16': return endian === 'be' ? 'i16be' : 'i16le'
    case 'uint24': return endian === 'be' ? 'u24be' : 'u24le'
    case 'uint32': return endian === 'be' ? 'u32be' : 'u32le'
    case 'int32': return endian === 'be' ? 'i32be' : 'i32le'
    case 'float32': return endian === 'be' ? 'f32be' : 'f32le'
    default: return hit
  }
}

// ── HEX 辅助 ────────────────────────────────────────────────────────────────

export function hexToBytes(hex: string): Uint8Array {
  const clean = (hex ?? '').replace(/0x/gi, '').replace(/[^0-9a-fA-F]/g, '')
  const even = clean.length % 2 ? '0' + clean : clean
  const out = new Uint8Array(even.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(even.slice(i * 2, i * 2 + 2), 16)
  return out
}

export function bytesToHex(bytes: Uint8Array | number[]): string {
  return Array.from(bytes).map((b) => (b & 0xff).toString(16).toUpperCase().padStart(2, '0')).join(' ')
}

export function parseIntLoose(s: string | undefined | null): number | null {
  if (s === undefined || s === null) return null
  const t = String(s).trim()
  if (!t) return null
  if (/^0x[0-9a-f]+$/i.test(t)) return parseInt(t, 16)
  if (/^[+-]?\d+(\.\d+)?$/.test(t)) return Number(t)
  const m = t.match(/^(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

// ── 数值编解码 ──────────────────────────────────────────────────────────────

function readNumber(bytes: Uint8Array, offset: number, type: FieldType): number | null {
  const size = FIELD_SIZE[type] ?? 0
  if (!size || offset + size > bytes.length) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset + offset, size)
  switch (type) {
    case 'u8': case 'bool': return view.getUint8(0)
    case 'i8': return view.getInt8(0)
    case 'u16le': return view.getUint16(0, true)
    case 'u16be': return view.getUint16(0, false)
    case 'i16le': return view.getInt16(0, true)
    case 'i16be': return view.getInt16(0, false)
    case 'u24le': return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
    case 'u24be': return (bytes[offset] << 16) | (bytes[offset + 1] << 8) | bytes[offset + 2]
    case 'u32le': return view.getUint32(0, true)
    case 'u32be': return view.getUint32(0, false)
    case 'i32le': return view.getInt32(0, true)
    case 'i32be': return view.getInt32(0, false)
    case 'f32le': return view.getFloat32(0, true)
    case 'f32be': return view.getFloat32(0, false)
    default: return null
  }
}

/** 数值 → 字节（定长类型）；返回 null 表示类型不是定长数值 */
export function encodeNumber(type: FieldType, value: number): Uint8Array | null {
  const size = FIELD_SIZE[type]
  if (!size) return null
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  switch (type) {
    case 'u8': view.setUint8(0, value & 0xff); break
    case 'bool': view.setUint8(0, value ? 1 : 0); break
    case 'i8': view.setInt8(0, value); break
    case 'u16le': view.setUint16(0, value & 0xffff, true); break
    case 'u16be': view.setUint16(0, value & 0xffff, false); break
    case 'i16le': view.setInt16(0, value, true); break
    case 'i16be': view.setInt16(0, value, false); break
    case 'u24le': out[0] = value & 0xff; out[1] = (value >> 8) & 0xff; out[2] = (value >> 16) & 0xff; break
    case 'u24be': out[0] = (value >> 16) & 0xff; out[1] = (value >> 8) & 0xff; out[2] = value & 0xff; break
    case 'u32le': view.setUint32(0, value >>> 0, true); break
    case 'u32be': view.setUint32(0, value >>> 0, false); break
    case 'i32le': view.setInt32(0, value, true); break
    case 'i32be': view.setInt32(0, value, false); break
    case 'f32le': view.setFloat32(0, value, true); break
    case 'f32be': view.setFloat32(0, value, false); break
    default: return null
  }
  return out
}

function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text)
  const out: number[] = []
  for (const ch of text) {
    const cp = ch.codePointAt(0) ?? 0
    if (cp < 0x80) out.push(cp)
    else if (cp < 0x800) out.push(0xc0 | (cp >> 6), 0x80 | (cp & 0x3f))
    else if (cp < 0x10000) out.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
    else out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f))
  }
  return Uint8Array.from(out)
}

function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    try { return new TextDecoder('utf-8').decode(bytes) } catch { /* fallthrough */ }
  }
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return s
}

/**
 * 把文本值按类型编码为字节：
 *   数值类型：十进制 / 0x 十六进制 / 负数 / 小数（浮点）
 *   bytes：HEX 字节串；ascii / utf8：文本
 *   length 指定时对变长类型做截断或右补零
 */
export function encodeValue(type: FieldType | null, value: string, length?: number): Uint8Array {
  const v = (value ?? '').trim()
  let out: Uint8Array
  if (type === null || type === 'bytes' || type === 'bitmask' || type === 'bcd') {
    out = type === 'bcd' ? bcdEncode(v) : hexToBytes(v)
  } else if (type === 'ascii') {
    out = Uint8Array.from(Array.from(v).map((c) => c.charCodeAt(0) & 0xff))
  } else if (type === 'utf8') {
    out = utf8Encode(v)
  } else if (type === 'bool') {
    const truthy = /^(1|true|on|yes)$/i.test(v)
    out = Uint8Array.from([truthy ? 1 : 0])
  } else {
    const n = parseIntLoose(v)
    if (n === null) throw new Error(`not a number: ${v}`)
    out = encodeNumber(type, n) ?? hexToBytes(v)
  }
  if (length && length > 0 && out.length !== length) {
    const fixed = new Uint8Array(length)
    fixed.set(out.subarray(0, length))
    return fixed
  }
  return out
}

function bcdEncode(digits: string): Uint8Array {
  const d = digits.replace(/\D/g, '')
  const padded = d.length % 2 ? '0' + d : d
  const out = new Uint8Array(padded.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(padded.slice(i * 2, i * 2 + 2), 16)
  return out
}

// ── 字段表解码 ──────────────────────────────────────────────────────────────

export interface DecodedField {
  name: string
  type: FieldType | null
  offset: number
  length: number
  /** 切片 HEX */
  raw: string
  /** 人读值 */
  value: string
  numeric?: number
  text?: string
  /** 响应长度不足，切片缺失 */
  missing: boolean
  meaning?: string
}

export function parseOffset(s: string | undefined): number | null {
  return parseIntLoose(s)
}

export function parseLength(s: string | undefined, remaining: number, type: FieldType | null): number {
  const t = (s ?? '').trim().toLowerCase()
  if (!t || t === 'n' || t === '*' || t === 'rest' || t === 'var' || t === '...') {
    const fixed = fieldSize(type)
    return fixed ?? Math.max(0, remaining)
  }
  const n = parseIntLoose(t)
  if (n === null || n <= 0) return fieldSize(type) ?? Math.max(0, remaining)
  return n
}

function inferTypeFromLength(len: number): FieldType {
  if (len === 1) return 'u8'
  if (len === 2) return 'u16le'
  if (len === 4) return 'u32le'
  return 'bytes'
}

function formatNumber(n: number, type: FieldType, raw: Uint8Array): string {
  if (type === 'f32le' || type === 'f32be') {
    return Number.isInteger(n) ? String(n) : n.toFixed(4).replace(/\.?0+$/, '')
  }
  if (type === 'bool') return n ? 'true' : 'false'
  const hex = Array.from(raw).map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join('')
  return `${n} (0x${hex})`
}

export function decodeFields(bytes: Uint8Array, fields: ProtocolFieldDoc[]): DecodedField[] {
  const out: DecodedField[] = []
  let cursor = 0
  for (const f of fields ?? []) {
    const explicitType = normalizeFieldType(f.type)
    const offset = parseOffset(f.offset) ?? cursor
    const remaining = bytes.length - offset
    const length = parseLength(f.length, remaining, explicitType)
    const type = explicitType ?? (length > 0 && length <= 4 && !/^n$|^\*$/.test((f.length ?? '').trim()) ? inferTypeFromLength(length) : (explicitType ?? 'bytes'))
    const end = offset + length
    const missing = offset < 0 || offset >= bytes.length || (length > 0 && end > bytes.length)
    const slice = missing ? bytes.subarray(Math.max(0, Math.min(offset, bytes.length)), Math.min(end, bytes.length)) : bytes.subarray(offset, end)
    const item: DecodedField = {
      name: f.name || `field${out.length}`,
      type,
      offset,
      length,
      raw: bytesToHex(slice),
      value: '∅',
      missing,
      meaning: f.meaning || undefined,
    }
    if (!missing && slice.length) {
      if (type === 'ascii') {
        item.text = Array.from(slice).map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('')
        item.value = item.text
      } else if (type === 'utf8') {
        item.text = utf8Decode(slice)
        item.value = item.text
      } else if (type === 'bytes') {
        item.value = item.raw
      } else if (type === 'bitmask') {
        item.value = Array.from(slice).map((b) => b.toString(2).padStart(8, '0')).join(' ')
        item.numeric = slice.length <= 4 ? Array.from(slice).reduce((acc, b) => (acc << 8) | b, 0) >>> 0 : undefined
      } else if (type === 'bcd') {
        item.value = Array.from(slice).map((b) => b.toString(16).padStart(2, '0')).join('')
        item.numeric = parseInt(item.value, 10)
        if (Number.isNaN(item.numeric)) item.numeric = undefined
      } else {
        const n = readNumber(slice, 0, type)
        if (n === null) {
          item.value = item.raw
        } else {
          item.numeric = n
          item.value = formatNumber(n, type, slice)
        }
      }
    }
    out.push(item)
    cursor = Math.max(cursor, missing ? cursor : end)
  }
  return out
}

export function decodeHexFields(hex: string, fields: ProtocolFieldDoc[]): DecodedField[] {
  return decodeFields(hexToBytes(hex), fields)
}

/** 日志条目上的紧凑形式 */
export function decodedToLogFields(list: DecodedField[]): { name: string; value: string }[] {
  return list.map((d) => ({ name: d.name, value: d.missing ? '∅' : d.value }))
}

// ── 断言 ────────────────────────────────────────────────────────────────────

function parseNumberList(s: string): number[] {
  return s.split(/[,\s]+/).map((x) => parseIntLoose(x)).filter((n): n is number => n !== null)
}

function parseRange(s: string): [number, number] | null {
  const m = s.match(/^\s*(0x[0-9a-f]+|[+-]?\d+(?:\.\d+)?)\s*(?:\.\.|-|~|,)\s*(0x[0-9a-f]+|[+-]?\d+(?:\.\d+)?)\s*$/i)
  if (!m) return null
  const a = parseIntLoose(m[1])
  const b = parseIntLoose(m[2])
  if (a === null || b === null) return null
  return [Math.min(a, b), Math.max(a, b)]
}

function normHex(s: string): string {
  return (s ?? '').replace(/[^0-9a-fA-F]/g, '').toUpperCase()
}

function checkOne(bytes: Uint8Array, a: FieldAssertion, op: OperationAnnotation): string | null {
  // 旧形态：偏移字节相等
  if (!a.field) {
    const expected = normHex(a.hexValue ?? '').match(/.{2}/g) ?? []
    if (!expected.length) return null
    const base = a.offset ?? 0
    for (let i = 0; i < expected.length; i++) {
      const actual = bytes[base + i]
      const actualHex = actual === undefined ? undefined : actual.toString(16).toUpperCase().padStart(2, '0')
      if (actualHex !== expected[i]) return `offset ${base + i}: expect ${expected[i]} got ${actualHex ?? '∅'}`
    }
    return null
  }

  const fields = op.responseFields ?? []
  const def = fields.find((f) => (f.name ?? '').toLowerCase() === a.field!.toLowerCase())
  if (!def) return `field ${a.field}: not defined`
  const decoded = decodeFields(bytes, fields).find((d) => d.name.toLowerCase() === a.field!.toLowerCase())
  if (!decoded || decoded.missing) return `field ${a.field}: missing in response`
  const cmp = a.op ?? 'eq'
  const expectedRaw = (a.value ?? '').trim()

  if (decoded.numeric !== undefined && decoded.type !== 'bytes') {
    const n = decoded.numeric
    const label = `field ${a.field}=${n}`
    switch (cmp) {
      case 'eq': { const e = parseIntLoose(expectedRaw); return e !== null && n === e ? null : `${label}: expect == ${expectedRaw}` }
      case 'ne': { const e = parseIntLoose(expectedRaw); return e !== null && n !== e ? null : `${label}: expect != ${expectedRaw}` }
      case 'gt': { const e = parseIntLoose(expectedRaw); return e !== null && n > e ? null : `${label}: expect > ${expectedRaw}` }
      case 'gte': { const e = parseIntLoose(expectedRaw); return e !== null && n >= e ? null : `${label}: expect >= ${expectedRaw}` }
      case 'lt': { const e = parseIntLoose(expectedRaw); return e !== null && n < e ? null : `${label}: expect < ${expectedRaw}` }
      case 'lte': { const e = parseIntLoose(expectedRaw); return e !== null && n <= e ? null : `${label}: expect <= ${expectedRaw}` }
      case 'in': { const list = parseNumberList(expectedRaw); return list.includes(n) ? null : `${label}: expect in [${expectedRaw}]` }
      case 'range': { const r = parseRange(expectedRaw); return r && n >= r[0] && n <= r[1] ? null : `${label}: expect in ${expectedRaw}` }
      default: return `${label}: unsupported op ${cmp}`
    }
  }

  // 文本 / 字节：只支持 eq / ne / in
  const actualText = decoded.text ?? normHex(decoded.raw)
  const isText = decoded.text !== undefined
  const norm = (s: string) => (isText ? s : normHex(s))
  const label = `field ${a.field}="${decoded.value}"`
  switch (cmp) {
    case 'eq': return norm(expectedRaw) === norm(actualText) ? null : `${label}: expect == ${expectedRaw}`
    case 'ne': return norm(expectedRaw) !== norm(actualText) ? null : `${label}: expect != ${expectedRaw}`
    case 'in': {
      const list = expectedRaw.split(isText ? /[,|]/ : /[,|;]/).map((x) => norm(x.trim())).filter(Boolean)
      return list.includes(norm(actualText)) ? null : `${label}: expect in [${expectedRaw}]`
    }
    default: return `${label}: op ${cmp} needs a numeric field`
  }
}

/** 返回第一条失败原因；全部通过返回 null */
export function checkFieldAssertions(responseHex: string, op: OperationAnnotation): string | null {
  const assertions = op.expect?.fieldAssertions ?? []
  if (!assertions.length) return null
  const bytes = hexToBytes(responseHex)
  for (const a of assertions) {
    const fail = checkOne(bytes, a, op)
    if (fail) return fail
  }
  return null
}

export const ASSERTION_OPS: { value: NonNullable<FieldAssertion['op']>; label: string }[] = [
  { value: 'eq', label: '==' },
  { value: 'ne', label: '!=' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
  { value: 'in', label: 'in' },
  { value: 'range', label: 'range' },
]
