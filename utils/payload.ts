/**
 * 载荷模板（Postman 的变量 + 预请求脚本的最小替代）
 *
 * 语法：HEX 串里嵌入 {{token}}，从左到右渲染，校验和只覆盖它之前的字节。
 *
 *   {{len}}            总帧长（字节），1 字节
 *   {{len:-2}}         总帧长 - 2（如 LEN 后面的字节数）；{{len:+1}}
 *   {{len:u16le}}      2 字节小端；{{len:-2:u16be}}
 *   {{seq}}            序号（每次发送后自增），{{seq:u16le}}
 *   {{sum}}            前面所有字节累加和低 8 位；{{sum:1}} 从偏移 1 开始；{{sum:1:u16le}}
 *   {{xor}}            异或校验；{{xor:1}}
 *   {{crc8}}           CRC-8（poly 0x07, init 0x00）
 *   {{crc16}}          CRC-16/MODBUS（poly 0x8005 反射, init 0xFFFF），小端；{{crc16:0:be}}
 *   {{crc16ccitt}}     CRC-16/CCITT-FALSE（poly 0x1021, init 0xFFFF），大端
 *   {{name}}           变量：值为 HEX 字节串
 *   {{name:u16le}}     变量按类型编码（值为十进制 / 0x 十六进制）；{{name:ascii}}
 *
 * ASCII 模式只做 {{name}} 文本替换。
 */

import { encodeValue, hexToBytes, bytesToHex, normalizeFieldType, type FieldType } from './fields'

export interface RenderContext {
  variables: Record<string, string>
  seq: number
}

export interface RenderedToken {
  token: string
  hex: string
  error?: string
}

export interface RenderResult {
  ok: boolean
  hex: string
  bytes: Uint8Array
  tokens: RenderedToken[]
  usesSeq: boolean
  error?: string
}

export const TEMPLATE_TOKEN_RE = /\{\{\s*([^{}]+?)\s*\}\}/g

export function hasTemplateTokens(s: string | undefined | null): boolean {
  if (!s) return false
  TEMPLATE_TOKEN_RE.lastIndex = 0
  return TEMPLATE_TOKEN_RE.test(s)
}

export const BUILTIN_TOKENS: { token: string; hint: string }[] = [
  { token: '{{len}}', hint: 'frame length' },
  { token: '{{len:-2}}', hint: 'length - 2' },
  { token: '{{seq}}', hint: 'sequence' },
  { token: '{{sum}}', hint: 'sum8' },
  { token: '{{xor}}', hint: 'xor8' },
  { token: '{{crc8}}', hint: 'CRC-8' },
  { token: '{{crc16}}', hint: 'CRC-16 MODBUS' },
  { token: '{{crc16ccitt}}', hint: 'CRC-16 CCITT' },
]

// ── 校验算法 ────────────────────────────────────────────────────────────────

export function sum8(bytes: Uint8Array, from = 0, to = bytes.length): number {
  let s = 0
  for (let i = from; i < to; i++) s = (s + bytes[i]) & 0xffff
  return s
}

export function xor8(bytes: Uint8Array, from = 0, to = bytes.length): number {
  let x = 0
  for (let i = from; i < to; i++) x ^= bytes[i]
  return x & 0xff
}

export function crc8(bytes: Uint8Array, from = 0, to = bytes.length, poly = 0x07, init = 0x00): number {
  let crc = init
  for (let i = from; i < to; i++) {
    crc ^= bytes[i]
    for (let b = 0; b < 8; b++) crc = crc & 0x80 ? ((crc << 1) ^ poly) & 0xff : (crc << 1) & 0xff
  }
  return crc & 0xff
}

export function crc16Modbus(bytes: Uint8Array, from = 0, to = bytes.length): number {
  let crc = 0xffff
  for (let i = from; i < to; i++) {
    crc ^= bytes[i]
    for (let b = 0; b < 8; b++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1
  }
  return crc & 0xffff
}

export function crc16Ccitt(bytes: Uint8Array, from = 0, to = bytes.length): number {
  let crc = 0xffff
  for (let i = from; i < to; i++) {
    crc ^= bytes[i] << 8
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc & 0xffff
}

// ── 模板解析 ────────────────────────────────────────────────────────────────

type Width = 'u8' | 'u16le' | 'u16be' | 'u32le' | 'u32be'

interface Segment {
  kind: 'literal' | 'token'
  text: string
  /** 渲染后的字节数（预扫描确定） */
  size: number
  bytes?: Uint8Array
  // token 解析
  name?: string
  args?: string[]
}

const WIDTH_SIZE: Record<Width, number> = { u8: 1, u16le: 2, u16be: 2, u32le: 4, u32be: 4 }

function parseWidth(args: string[], fallback: Width): Width {
  for (const a of args) {
    const s = a.toLowerCase()
    if (s === 'u8' || s === 'u16le' || s === 'u16be' || s === 'u32le' || s === 'u32be') return s
    if (s === 'le') return fallback === 'u8' ? 'u16le' : fallback
    if (s === 'be') return fallback === 'u8' ? 'u16be' : (fallback.replace('le', 'be') as Width)
  }
  return fallback
}

function parseOffsetArg(args: string[]): number {
  for (const a of args) {
    if (/^[+-]\d+$/.test(a)) return parseInt(a, 10)
  }
  return 0
}

function parseFromArg(args: string[]): number {
  for (const a of args) {
    if (/^\d+$/.test(a)) return parseInt(a, 10)
  }
  return 0
}

function encodeWidth(value: number, width: Width): Uint8Array {
  switch (width) {
    case 'u8': return Uint8Array.from([value & 0xff])
    case 'u16le': return Uint8Array.from([value & 0xff, (value >> 8) & 0xff])
    case 'u16be': return Uint8Array.from([(value >> 8) & 0xff, value & 0xff])
    case 'u32le': return Uint8Array.from([value & 0xff, (value >> 8) & 0xff, (value >> 16) & 0xff, (value >>> 24) & 0xff])
    case 'u32be': return Uint8Array.from([(value >>> 24) & 0xff, (value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff])
  }
}

const COMPUTED = new Set(['len', 'seq', 'sum', 'xor', 'crc8', 'crc16', 'crc16ccitt'])

function isValidHexLiteral(s: string): boolean {
  const clean = s.replace(/0x/gi, '').replace(/\s+/g, '')
  return clean.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(clean)
}

/** 变量取值：无类型参数时必须是 HEX 字节串；有类型参数时按类型编码 */
function encodeVariable(name: string, args: string[], ctx: RenderContext): { bytes?: Uint8Array; error?: string } {
  if (!(name in ctx.variables)) return { error: `unknown token {{${name}}}` }
  const raw = ctx.variables[name] ?? ''
  let type: FieldType | null = null
  let length: number | undefined
  for (const a of args) {
    const t = normalizeFieldType(a)
    if (t) type = t
    else if (/^\d+$/.test(a)) length = parseInt(a, 10)
  }
  try {
    if (type === null) {
      if (!isValidHexLiteral(raw)) return { error: `variable ${name} is not hex: "${raw}"` }
      const b = hexToBytes(raw)
      if (length && b.length !== length) {
        const fixed = new Uint8Array(length)
        fixed.set(b.subarray(0, length))
        return { bytes: fixed }
      }
      return { bytes: b }
    }
    return { bytes: encodeValue(type, raw, length) }
  } catch (e: any) {
    return { error: `variable ${name}: ${e?.message ?? 'encode failed'}` }
  }
}

export function renderPayloadTemplate(template: string, ctx: RenderContext): RenderResult {
  const tokens: RenderedToken[] = []
  const fail = (error: string): RenderResult => ({ ok: false, hex: '', bytes: new Uint8Array(0), tokens, usesSeq: false, error })

  // 1) 切分
  const segments: Segment[] = []
  let last = 0
  TEMPLATE_TOKEN_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = TEMPLATE_TOKEN_RE.exec(template)) !== null) {
    if (m.index > last) segments.push({ kind: 'literal', text: template.slice(last, m.index), size: 0 })
    const parts = m[1].split(':').map((p) => p.trim()).filter(Boolean)
    segments.push({ kind: 'token', text: m[0], size: 0, name: parts[0] ?? '', args: parts.slice(1) })
    last = m.index + m[0].length
  }
  if (last < template.length) segments.push({ kind: 'literal', text: template.slice(last), size: 0 })

  // 2) 预扫描：确定每段字节数（len 需要总长）
  let usesSeq = false
  for (const seg of segments) {
    if (seg.kind === 'literal') {
      if (!seg.text.trim()) { seg.size = 0; seg.bytes = new Uint8Array(0); continue }
      if (!isValidHexLiteral(seg.text)) return fail(`invalid hex "${seg.text.trim()}"`)
      seg.bytes = hexToBytes(seg.text)
      seg.size = seg.bytes.length
      continue
    }
    const name = (seg.name ?? '').toLowerCase()
    const args = seg.args ?? []
    if (COMPUTED.has(name)) {
      if (name === 'seq') usesSeq = true
      const defaultWidth: Width = name === 'crc16' || name === 'crc16ccitt' ? 'u16le' : 'u8'
      seg.size = WIDTH_SIZE[parseWidth(args, defaultWidth)]
    } else {
      const enc = encodeVariable(seg.name ?? '', args, ctx)
      if (enc.error) {
        tokens.push({ token: seg.text, hex: '', error: enc.error })
        return fail(enc.error)
      }
      seg.bytes = enc.bytes
      seg.size = enc.bytes!.length
    }
  }
  const total = segments.reduce((n, s) => n + s.size, 0)

  // 3) 渲染
  const out = new Uint8Array(total)
  let pos = 0
  for (const seg of segments) {
    if (seg.kind === 'literal' || seg.bytes) {
      const b = seg.bytes ?? new Uint8Array(0)
      out.set(b, pos)
      if (seg.kind === 'token') tokens.push({ token: seg.text, hex: bytesToHex(b) })
      pos += b.length
      continue
    }
    const name = (seg.name ?? '').toLowerCase()
    const args = seg.args ?? []
    let value = 0
    let width: Width
    switch (name) {
      case 'len':
        width = parseWidth(args, 'u8')
        value = total + parseOffsetArg(args)
        break
      case 'seq':
        width = parseWidth(args, 'u8')
        value = ctx.seq
        break
      case 'sum':
        width = parseWidth(args, 'u8')
        value = sum8(out, parseFromArg(args), pos)
        break
      case 'xor':
        width = parseWidth(args, 'u8')
        value = xor8(out, parseFromArg(args), pos)
        break
      case 'crc8':
        width = parseWidth(args, 'u8')
        value = crc8(out, parseFromArg(args), pos)
        break
      case 'crc16':
        width = parseWidth(args, 'u16le')
        value = crc16Modbus(out, parseFromArg(args), pos)
        break
      case 'crc16ccitt':
        width = parseWidth(args, 'u16be')
        value = crc16Ccitt(out, parseFromArg(args), pos)
        break
      default:
        return fail(`unknown token ${seg.text}`)
    }
    const b = encodeWidth(value, width)
    out.set(b, pos)
    tokens.push({ token: seg.text, hex: bytesToHex(b) })
    pos += b.length
  }

  return { ok: true, hex: bytesToHex(out), bytes: out, tokens, usesSeq }
}

/** ASCII 模式：仅替换 {{name}} 为变量文本；未知变量原样保留 */
export function renderAsciiTemplate(template: string, ctx: RenderContext): string {
  return template.replace(TEMPLATE_TOKEN_RE, (whole, inner: string) => {
    const name = inner.split(':')[0].trim()
    if (name.toLowerCase() === 'seq') return String(ctx.seq)
    return name in ctx.variables ? ctx.variables[name] : whole
  })
}

/** 供 UI 预览：对 HEX / ASCII 两种模式统一返回渲染后的 HEX 与错误 */
export function previewPayload(
  text: string,
  mode: 'hex' | 'ascii',
  ctx: RenderContext,
): { hex: string; error?: string; tokens: RenderedToken[]; usesSeq: boolean } {
  if (mode === 'ascii') {
    const s = renderAsciiTemplate(text, ctx)
    const bytes = Uint8Array.from(Array.from(s).map((c) => c.charCodeAt(0) & 0xff))
    return { hex: bytesToHex(bytes), tokens: [], usesSeq: /\{\{\s*seq\s*\}\}/i.test(text) }
  }
  const r = renderPayloadTemplate(text, ctx)
  return { hex: r.hex, error: r.error, tokens: r.tokens, usesSeq: r.usesSeq }
}
