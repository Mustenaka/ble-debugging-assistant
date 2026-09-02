/**
 * 导入文件来源（集合 / 协议文档 / Debug Pack zip）
 *
 *  H5      ：uni.chooseFile → File → 文本或字节
 *  Android ：ACTION_OPEN_DOCUMENT 系统文件选择器 → ContentResolver 读文本 / 拷贝字节
 *  iOS     ：暂不支持文件选择（使用粘贴 / 剪贴板）
 *
 * zip 优先用 JS 解析（utils/zipReader）；WebView 不支持 DecompressionStream 时，
 * Android 回退到 plus.zip.decompress 后在解压目录里找 collection.json / protocol.json。
 */

import { isZipBytes, extractImportJsonFromZip } from './zipReader'

export interface PickedFile {
  name: string
  /** 文本内容（json 等） */
  text?: string
  /** 二进制内容（zip） */
  bytes?: Uint8Array
  /** Android：拷贝到沙盒后的绝对路径（zip 回退解压用） */
  localPath?: string
}

export interface ImportSource {
  text: string
  /** 展示用：文件名，zip 时为 "entry (zip 名)" */
  label: string
}

export function isImportPickerSupported(): boolean {
  // #ifdef H5
  return typeof (uni as any).chooseFile === 'function'
  // #endif
  // #ifdef APP-PLUS
  return plus.os.name === 'Android'
  // #endif
  // #ifndef H5 || APP-PLUS
  return false
  // #endif
}

function isZipName(name: string): boolean {
  return /\.zip$/i.test(name)
}

// ── H5 ──────────────────────────────────────────────────────────────────────

function pickFileH5(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    const chooser = (uni as any).chooseFile
    if (typeof chooser !== 'function') { resolve(null); return }
    chooser({
      count: 1,
      type: 'all',
      extension: ['.json', '.zip', '.txt'],
      success: (res: any) => {
        const file: File | undefined = res.tempFiles?.[0]
        if (!file) { resolve(null); return }
        const name = file.name || 'import'
        const reader = new FileReader()
        reader.onerror = () => resolve(null)
        if (isZipName(name)) {
          reader.onload = () => resolve({ name, bytes: new Uint8Array(reader.result as ArrayBuffer) })
          reader.readAsArrayBuffer(file)
        } else {
          reader.onload = () => {
            const bytes = new Uint8Array(reader.result as ArrayBuffer)
            if (isZipBytes(bytes)) resolve({ name, bytes })
            else resolve({ name, text: new TextDecoder('utf-8').decode(bytes) })
          }
          reader.readAsArrayBuffer(file)
        }
      },
      fail: () => resolve(null),
    })
  })
}

// ── Android ─────────────────────────────────────────────────────────────────

const ANDROID_PICK_REQUEST = 0x4c42

/**
 * ContentResolver / Cursor / InputStream 的运行时类多为非 public 内部类，
 * plus.android 不会自动代理其方法，必须走 plus.android.invoke 反射调用。
 */
const inv = (obj: any, method: string, ...args: any[]) => (plus.android.invoke as any)(obj, method, ...args)

function androidDisplayName(main: any, uri: any): string {
  try {
    const resolver = inv(main, 'getContentResolver')
    const cursor = inv(resolver, 'query', uri, null, null, null, null)
    if (cursor) {
      let name = ''
      if (inv(cursor, 'moveToFirst')) {
        const idx = inv(cursor, 'getColumnIndex', '_display_name')
        if (idx >= 0) name = String(inv(cursor, 'getString', idx) ?? '')
      }
      inv(cursor, 'close')
      if (name) return name
    }
  } catch (e: any) {
    console.warn('[ImportFile] display name query failed:', e?.message ?? e)
  }
  try {
    const seg = inv(uri, 'getLastPathSegment') as string
    return (seg || 'import').split('/').pop() || 'import'
  } catch {
    return 'import'
  }
}

function androidOpenStream(main: any, uri: any): any {
  const resolver = inv(main, 'getContentResolver')
  const is = inv(resolver, 'openInputStream', uri)
  if (!is) throw new Error('openInputStream returned null')
  return is
}

function androidReadText(main: any, uri: any): string {
  const Scanner = plus.android.importClass('java.util.Scanner') as any
  const is = androidOpenStream(main, uri)
  const sc = new Scanner(is, 'UTF-8')
  sc.useDelimiter('\\A')
  const text: string = sc.hasNext() ? sc.next() : ''
  sc.close()
  return text
}

/** 把 content:// 内容拷贝到 App 外部沙盒，返回绝对路径（android.os.FileUtils.copy，API 29+） */
function androidCopyToSandbox(main: any, uri: any, name: string): string {
  const File = plus.android.importClass('java.io.File') as any
  const FileOutputStream = plus.android.importClass('java.io.FileOutputStream') as any
  const FileUtils = plus.android.importClass('android.os.FileUtils') as any
  const dir = new File(inv(inv(main, 'getExternalFilesDir', null), 'getAbsolutePath') + '/ble-debugging/import')
  if (!dir.exists()) dir.mkdirs()
  const dest = new File(dir.getAbsolutePath() + '/' + name.replace(/[\\/:*?"<>|]/g, '_'))
  const is = androidOpenStream(main, uri)
  const fos = new FileOutputStream(dest, false)
  try {
    FileUtils.copy(is, fos)
  } finally {
    try { fos.flush(); fos.close() } catch { /* 忽略 */ }
    try { inv(is, 'close') } catch { /* 忽略 */ }
  }
  return dest.getAbsolutePath() as string
}

function androidReadBytes(path: string): Uint8Array {
  const File = plus.android.importClass('java.io.File') as any
  const Files = plus.android.importClass('java.nio.file.Files') as any
  const file = new File(path)
  const arr: number[] = Files.readAllBytes(inv(file, 'toPath'))
  const out = new Uint8Array(arr.length)
  for (let i = 0; i < arr.length; i++) out[i] = arr[i] & 0xff
  return out
}

function pickFileAndroid(): Promise<PickedFile | null> {
  return new Promise((resolve) => {
    try {
      const Intent = plus.android.importClass('android.content.Intent') as any
      const main = plus.android.runtimeMainActivity() as any
      const intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
      intent.addCategory(Intent.CATEGORY_OPENABLE)
      intent.setType('*/*')
      main.onActivityResult = (requestCode: number, resultCode: number, data: any) => {
        if (requestCode !== ANDROID_PICK_REQUEST) return
        main.onActivityResult = null
        try {
          if (resultCode !== -1 || !data) { resolve(null); return }
          const uri = inv(data, 'getData')
          if (!uri) { resolve(null); return }
          const name = androidDisplayName(main, uri)
          console.log('[ImportFile] picked:', name, String(inv(uri, 'toString')))
          if (isZipName(name)) {
            const localPath = androidCopyToSandbox(main, uri, name)
            resolve({ name, bytes: androidReadBytes(localPath), localPath })
            return
          }
          const text = androidReadText(main, uri)
          // 扩展名不是 zip 但内容是 zip（少见），按字节处理
          if (text.startsWith('PK')) {
            const localPath = androidCopyToSandbox(main, uri, name + '.zip')
            resolve({ name, bytes: androidReadBytes(localPath), localPath })
            return
          }
          resolve({ name, text })
        } catch (e: any) {
          console.error('[ImportFile] android read failed:', e?.message ?? e)
          resolve(null)
        }
      }
      main.startActivityForResult(intent, ANDROID_PICK_REQUEST)
    } catch (e: any) {
      console.error('[ImportFile] android picker failed:', e?.message ?? e)
      resolve(null)
    }
  })
}

/** Android 回退：plus.zip 解压后在目录里找候选 JSON */
function androidUnzipAndFind(localPath: string): Promise<{ text: string; entryName: string } | null> {
  return new Promise((resolve) => {
    const outDir = localPath.replace(/\.zip$/i, '') + '_unzipped'
    ;(plus as any).zip.decompress(localPath, outDir, () => {
      try {
        const File = plus.android.importClass('java.io.File') as any
        const Scanner = plus.android.importClass('java.util.Scanner') as any
        const candidates = ['collection.json', 'protocol.json', 'debug-pack.json']
        const walk = (dir: any, depth: number): any | null => {
          if (depth > 3) return null
          const files: any[] = dir.listFiles() ?? []
          for (const target of candidates) {
            for (const f of files) {
              if (!f.isDirectory() && String(f.getName()).toLowerCase() === target) return f
            }
          }
          for (const f of files) {
            if (f.isDirectory()) {
              const hit = walk(f, depth + 1)
              if (hit) return hit
            }
          }
          return null
        }
        const hit = walk(new File(outDir), 0)
        if (!hit) { resolve(null); return }
        const sc = new Scanner(new File(String(inv(hit, 'getAbsolutePath'))), 'UTF-8')
        sc.useDelimiter('\\A')
        const text: string = sc.hasNext() ? sc.next() : ''
        sc.close()
        resolve({ text, entryName: String(hit.getName()) })
      } catch (e: any) {
        console.error('[ImportFile] unzip walk failed:', e?.message ?? e)
        resolve(null)
      }
    }, (e: any) => {
      console.error('[ImportFile] plus.zip.decompress failed:', JSON.stringify(e))
      resolve(null)
    })
  })
}

// ── 统一入口 ────────────────────────────────────────────────────────────────

export function pickImportFile(): Promise<PickedFile | null> {
  // #ifdef H5
  return pickFileH5()
  // #endif
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') return pickFileAndroid()
  return Promise.resolve(null)
  // #endif
  // #ifndef H5 || APP-PLUS
  return Promise.resolve(null)
  // #endif
}

/**
 * 把选中的文件变成可解析的 JSON 文本。
 * 抛出：'zip-no-json'（zip 内无候选）、'deflate-unsupported'（无法解压）
 */
export async function resolveImportSource(file: PickedFile): Promise<ImportSource> {
  if (file.text !== undefined && !file.bytes) {
    return { text: file.text, label: file.name }
  }
  const bytes = file.bytes ?? new Uint8Array(0)
  if (!isZipBytes(bytes)) {
    return { text: new TextDecoder('utf-8').decode(bytes), label: file.name }
  }
  let hit: { text: string; entryName: string } | null = null
  try {
    hit = await extractImportJsonFromZip(bytes)
  } catch (e: any) {
    if (e?.message !== 'deflate-unsupported') throw e
    // #ifdef APP-PLUS
    if (file.localPath && plus.os.name === 'Android') {
      hit = await androidUnzipAndFind(file.localPath)
    }
    // #endif
    if (!hit) throw new Error('deflate-unsupported')
  }
  if (!hit) throw new Error('zip-no-json')
  return { text: hit.text, label: `${hit.entryName.split('/').pop()} (${file.name})` }
}
