/**
 * 极简 ZIP 读取器（导入 Debug Pack zip 用）
 *  - 解析 End Of Central Directory → Central Directory → Local File Header
 *  - 支持 store(0) 与 deflate(8)；deflate 通过 DecompressionStream('deflate-raw')，不可用时抛 deflate-unsupported
 *  - 不支持 ZIP64 / 加密（Debug Pack 远小于 4GB）
 */

export interface ZipEntry {
  name: string
  size: number
  compressedSize: number
  method: number
  localHeaderOffset: number
  crc32: number
  isDirectory: boolean
}

const SIG_EOCD = 0x06054b50
const SIG_CENTRAL = 0x02014b50
const SIG_LOCAL = 0x04034b50

function u16(b: Uint8Array, o: number): number {
  return b[o] | (b[o + 1] << 8)
}

function u32(b: Uint8Array, o: number): number {
  return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0
}

function decodeName(bytes: Uint8Array, utf8Flag: boolean): string {
  if (typeof TextDecoder !== 'undefined') {
    try { return new TextDecoder(utf8Flag ? 'utf-8' : 'utf-8').decode(bytes) } catch { /* fallthrough */ }
  }
  let s = ''
  for (const c of bytes) s += String.fromCharCode(c)
  return s
}

export function isZipBytes(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
}

export function listZipEntries(bytes: Uint8Array): ZipEntry[] {
  // EOCD 在文件尾部，注释最长 65535
  const minPos = Math.max(0, bytes.length - 22 - 65535)
  let eocd = -1
  for (let i = bytes.length - 22; i >= minPos; i--) {
    if (u32(bytes, i) === SIG_EOCD) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not-a-zip')
  const entryCount = u16(bytes, eocd + 10)
  const cdOffset = u32(bytes, eocd + 16)
  const entries: ZipEntry[] = []
  let p = cdOffset
  for (let i = 0; i < entryCount; i++) {
    if (u32(bytes, p) !== SIG_CENTRAL) throw new Error('bad-central-directory')
    const flags = u16(bytes, p + 8)
    const method = u16(bytes, p + 10)
    const crc32 = u32(bytes, p + 16)
    const compressedSize = u32(bytes, p + 20)
    const size = u32(bytes, p + 24)
    const nameLen = u16(bytes, p + 28)
    const extraLen = u16(bytes, p + 30)
    const commentLen = u16(bytes, p + 32)
    const localHeaderOffset = u32(bytes, p + 42)
    const name = decodeName(bytes.subarray(p + 46, p + 46 + nameLen), (flags & 0x800) !== 0)
    entries.push({ name, size, compressedSize, method, localHeaderOffset, crc32, isDirectory: name.endsWith('/') })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as any).DecompressionStream
  if (typeof DS !== 'function') throw new Error('deflate-unsupported')
  const stream = new Blob([data as any]).stream().pipeThrough(new DS('deflate-raw'))
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
  const p = entry.localHeaderOffset
  if (u32(bytes, p) !== SIG_LOCAL) throw new Error('bad-local-header')
  const nameLen = u16(bytes, p + 26)
  const extraLen = u16(bytes, p + 28)
  const start = p + 30 + nameLen + extraLen
  const data = bytes.subarray(start, start + entry.compressedSize)
  if (entry.method === 0) return data.slice()
  if (entry.method === 8) return inflateRaw(data)
  throw new Error(`unsupported-method-${entry.method}`)
}

export async function readZipEntryText(bytes: Uint8Array, entry: ZipEntry): Promise<string> {
  const data = await readZipEntry(bytes, entry)
  if (typeof TextDecoder !== 'undefined') return new TextDecoder('utf-8').decode(data)
  let s = ''
  for (const c of data) s += String.fromCharCode(c)
  return s
}

/** 导入候选优先级：collection.json > protocol.json > debug-pack.json > 其他 *.json */
export function findImportCandidates(entries: ZipEntry[]): ZipEntry[] {
  const rank = (name: string): number => {
    const base = name.split('/').pop()?.toLowerCase() ?? ''
    if (base === 'collection.json') return 0
    if (base === 'protocol.json') return 1
    if (base === 'debug-pack.json') return 2
    if (base.endsWith('.json')) return 3
    return 9
  }
  return entries
    .filter((e) => !e.isDirectory && rank(e.name) < 9)
    .sort((a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

/** 从 zip 字节里取出最适合导入的 JSON 文本；找不到返回 null */
export async function extractImportJsonFromZip(bytes: Uint8Array): Promise<{ text: string; entryName: string } | null> {
  const candidates = findImportCandidates(listZipEntries(bytes))
  for (const entry of candidates) {
    try {
      const text = await readZipEntryText(bytes, entry)
      JSON.parse(text)
      return { text, entryName: entry.name }
    } catch (e: any) {
      if (e?.message === 'deflate-unsupported') throw e
      // 非法 JSON：继续尝试下一个候选
    }
  }
  return null
}
