/**
 * 设备档案层：
 *  1. 用户协议注释：已迁移到 Collection 层（utils/collection.ts），此处 re-export 兼容 API
 *  2. 命令执行记录（Postman 的历史锚点）
 *  3. 会话传输记录（按设备分会话持久化缓存，用于跨会话追踪问题）
 */

import type { LogEntry, LogDirection } from './buffer'
import type {
  MatchedProtocolDocs,
  ProtocolServiceDoc,
  ProtocolCharacteristicDoc,
  ProtocolInterfaceDoc,
} from './protocolDocs'
import { charAnnotationKey, type OperationAnnotation, type DeviceAnnotations } from './collection'

// ═══════════════════════════════════════════════════════════════════════════
// 一、用户协议注释 —— 已迁移到 Collection 层（utils/collection.ts），此处保留 re-export
//     以兼容既有调用方；按 deviceId 的读写在内部解析到匹配的集合。
// ═══════════════════════════════════════════════════════════════════════════

export {
  defaultOperationExpect,
  operationPayload,
  charAnnotationKey,
  loadDeviceAnnotations,
  saveServiceAnnotation,
  saveCharAnnotation,
  removeCharAnnotation,
  upsertOperationAnnotation,
  removeOperationAnnotation,
} from './collection'
export type {
  OperationActionType,
  AssertionOp,
  FieldAssertion,
  OperationExpect,
  OperationVariant,
  OperationAnnotation,
  ServiceAnnotation,
  CharAnnotation,
  DeviceAnnotations,
  AnnotationEditorInitial,
} from './collection'

// ── 命令执行记录（Postman 的历史锚点）──────────────────────────────────────

export type OperationRunResult = 'pass' | 'fail' | 'timeout' | 'error' | 'sent'

export interface OperationRunRecord {
  timestamp: number
  requestHex: string
  responseHex: string | null
  rttMs: number | null
  result: OperationRunResult
  /** fail/error 时的原因（断言不匹配、写入异常等） */
  reason?: string
  /** 使用的变体标签（P2） */
  variantLabel?: string
}

const OPERATION_RUNS_KEY = 'ble_operation_runs'
const MAX_RUNS_PER_OPERATION = 10

type AllOperationRuns = Record<string, Record<string, OperationRunRecord[]>>

function loadAllOperationRuns(): AllOperationRuns {
  try {
    const raw = uni.getStorageSync(OPERATION_RUNS_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

/** 执行记录 key：注释命令用 op.id；内置模板命令用 operationId（无 id 可用时） */
export function operationRunKey(serviceUUID: string, charUUID: string, opIdOrName: string): string {
  return `${charAnnotationKey(serviceUUID, charUUID)}::${opIdOrName}`
}

export function appendOperationRun(deviceId: string, runKey: string, record: OperationRunRecord): OperationRunRecord[] {
  const all = loadAllOperationRuns()
  const dev = all[deviceId] ?? {}
  const list = [record, ...(dev[runKey] ?? [])].slice(0, MAX_RUNS_PER_OPERATION)
  dev[runKey] = list
  all[deviceId] = dev
  try {
    uni.setStorageSync(OPERATION_RUNS_KEY, JSON.stringify(all))
  } catch (e) {
    console.error('[DeviceArchive] appendOperationRun failed:', e)
  }
  return list
}

export function loadOperationRuns(deviceId: string): Record<string, OperationRunRecord[]> {
  return loadAllOperationRuns()[deviceId] ?? {}
}

export function clearOperationRuns(deviceId: string): void {
  const all = loadAllOperationRuns()
  delete all[deviceId]
  try {
    uni.setStorageSync(OPERATION_RUNS_KEY, JSON.stringify(all))
  } catch { /* 忽略 */ }
}

/** 注释 → 协议文档接口结构（供导出与展示复用） */
export function operationToInterfaceDoc(op: OperationAnnotation): ProtocolInterfaceDoc {
  return {
    name: op.name,
    operationId: op.operationId ?? '',
    request: op.request,
    response: op.response,
    requestExample: op.requestExample,
    responseExample: op.responseExample,
    payload: op.payload && op.payload !== op.requestExample ? op.payload : undefined,
    mock: op.mockRule,
    description: op.description,
    requestFields: op.requestFields ?? [],
    responseFields: op.responseFields ?? [],
  }
}

/**
 * 合并链：用户注释 > 内置模板 > 裸 UUID。
 * 返回一个新的 MatchedProtocolDocs，注释字段覆盖内置文档；
 * 内置文档不存在时由注释创建独立文档条目。
 */
export function mergeAnnotationsIntoDocs(
  matched: MatchedProtocolDocs,
  annotations: DeviceAnnotations | null,
): MatchedProtocolDocs {
  if (!annotations || (!Object.keys(annotations.services).length && !Object.keys(annotations.characteristics).length)) {
    return matched
  }

  const serviceDocs: Record<string, ProtocolServiceDoc> = { ...matched.serviceDocs }
  const charDocs: Record<string, ProtocolCharacteristicDoc> = { ...matched.charDocs }

  for (const [svcKey, svcAnn] of Object.entries(annotations.services)) {
    const base: ProtocolServiceDoc = serviceDocs[svcKey] ?? {
      uuid: svcAnn.uuid,
      name: '',
      characteristics: [],
    }
    serviceDocs[svcKey] = {
      ...base,
      name: svcAnn.name || base.name,
      role: svcAnn.role || base.role,
      summary: svcAnn.summary || base.summary,
    }
  }

  for (const [charKey, charAnn] of Object.entries(annotations.characteristics)) {
    const base: ProtocolCharacteristicDoc = charDocs[charKey] ?? {
      uuid: charAnn.uuid,
      name: '',
      properties: [],
      interfaces: [],
    }
    const annotatedInterfaces = (charAnn.operations ?? []).map(operationToInterfaceDoc)
    // 注释操作在前，内置模板里未被同名（operationId）覆盖的操作保留在后
    const annotatedIds = new Set(annotatedInterfaces.map((i) => i.operationId).filter(Boolean))
    const keptBuiltin = base.interfaces.filter((i) => !i.operationId || !annotatedIds.has(i.operationId))
    charDocs[charKey] = {
      ...base,
      name: charAnn.name || base.name,
      direction: charAnn.direction || base.direction,
      valueFormat: charAnn.valueFormat || base.valueFormat,
      description: charAnn.description || base.description,
      interfaces: [...annotatedInterfaces, ...keptBuiltin],
    }
  }

  return { profiles: matched.profiles, serviceDocs, charDocs }
}

// ═══════════════════════════════════════════════════════════════════════════
// 二、会话传输记录（持久化缓存）
// ═══════════════════════════════════════════════════════════════════════════

export type SessionEndReason = 'user' | 'lost' | 'app-exit' | 'unknown'

export interface HeartbeatSummary {
  sent: number
  acked: number
  missed: number
  rttMinMs: number | null
  rttAvgMs: number | null
  rttMaxMs: number | null
}

export interface SessionMeta {
  id: string
  deviceId: string
  deviceName: string
  startedAt: number
  endedAt: number | null
  endReason: SessionEndReason | null
  txBytes: number
  rxBytes: number
  txFrames: number
  rxFrames: number
  logCount: number
  /** 实际持久化的日志条数（超过上限时小于 logCount） */
  storedLogCount: number
  maxMtu: number
  rssiMin: number | null
  rssiMax: number | null
  rssiAvg: number | null
  heartbeat: HeartbeatSummary | null
}

const HISTORY_INDEX_KEY = 'ble_history_index'
const HISTORY_LOGS_PREFIX = 'ble_history_logs_'

/** 每会话最多持久化的日志条数（环形，保留最新） */
const MAX_STORED_LOGS_PER_SESSION = 800
/** 每设备最多保留的历史会话数 */
const MAX_SESSIONS_PER_DEVICE = 8
/** 最多追踪的设备数（超过时按最近会话时间淘汰整设备） */
const MAX_TRACKED_DEVICES = 12
/** 落盘节流：脏数据最长等待毫秒数 */
const FLUSH_INTERVAL_MS = 3000
/** 落盘节流：脏数据条数阈值 */
const FLUSH_DIRTY_THRESHOLD = 40

/** 紧凑日志元组: [timestamp, direction, hex, ascii, label, serviceUUID, characteristicUUID] */
type CompactLog = [number, LogDirection, string, string, string, string, string]

interface StoredSessionLogs {
  v: 1
  entries: CompactLog[]
}

function compactLog(e: LogEntry): CompactLog {
  return [e.timestamp, e.direction, e.hex, e.ascii, e.label ?? '', e.serviceUUID ?? '', e.characteristicUUID ?? '']
}

function expandLog(c: CompactLog, idx: number, sessionId: string): LogEntry {
  return {
    id: `${sessionId}_${idx}`,
    timestamp: c[0],
    direction: c[1],
    hex: c[2],
    ascii: c[3],
    rawLength: c[2] ? c[2].split(' ').filter(Boolean).length : 0,
    label: c[4] || undefined,
    serviceUUID: c[5] || undefined,
    characteristicUUID: c[6] || undefined,
  }
}

export function loadHistoryIndex(): Record<string, SessionMeta[]> {
  try {
    const raw = uni.getStorageSync(HISTORY_INDEX_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveHistoryIndex(index: Record<string, SessionMeta[]>): void {
  try {
    uni.setStorageSync(HISTORY_INDEX_KEY, JSON.stringify(index))
  } catch (e) {
    console.error('[DeviceArchive] saveHistoryIndex failed:', e)
  }
}

export function loadDeviceSessionMetas(deviceId: string): SessionMeta[] {
  return loadHistoryIndex()[deviceId] ?? []
}

export function loadSessionLogs(sessionId: string): LogEntry[] {
  try {
    const raw = uni.getStorageSync(HISTORY_LOGS_PREFIX + sessionId)
    if (!raw) return []
    const stored: StoredSessionLogs = JSON.parse(raw)
    return stored.entries.map((c, i) => expandLog(c, i, sessionId))
  } catch {
    return []
  }
}

export function deleteSessionRecord(deviceId: string, sessionId: string): void {
  const index = loadHistoryIndex()
  const list = index[deviceId]
  if (list) {
    index[deviceId] = list.filter((m) => m.id !== sessionId)
    if (!index[deviceId].length) delete index[deviceId]
    saveHistoryIndex(index)
  }
  try {
    uni.removeStorageSync(HISTORY_LOGS_PREFIX + sessionId)
  } catch { /* 忽略 */ }
}

export function clearDeviceHistory(deviceId: string): void {
  const index = loadHistoryIndex()
  for (const meta of index[deviceId] ?? []) {
    try {
      uni.removeStorageSync(HISTORY_LOGS_PREFIX + meta.id)
    } catch { /* 忽略 */ }
  }
  delete index[deviceId]
  saveHistoryIndex(index)
}

/** 是否存在任何历史记录（扫描页/设备页入口显隐用） */
export function hasDeviceHistory(deviceId: string): boolean {
  return (loadHistoryIndex()[deviceId] ?? []).length > 0
}

// ── 会话录制器 ──────────────────────────────────────────────────────────────

interface ActiveRecorder {
  meta: SessionMeta
  logs: CompactLog[]
  rssiSum: number
  rssiCount: number
  rttSum: number
  dirtyCount: number
  flushTimer: ReturnType<typeof setTimeout> | null
}

const activeRecorders = new Map<string, ActiveRecorder>()

function pruneStorage(index: Record<string, SessionMeta[]>): void {
  // 每设备保留最近 N 个会话
  for (const deviceId of Object.keys(index)) {
    const list = index[deviceId]
    if (list.length > MAX_SESSIONS_PER_DEVICE) {
      const removed = list.splice(MAX_SESSIONS_PER_DEVICE)
      for (const meta of removed) {
        try {
          uni.removeStorageSync(HISTORY_LOGS_PREFIX + meta.id)
        } catch { /* 忽略 */ }
      }
    }
  }
  // 设备数超限时，按最近会话时间淘汰最旧的整设备
  const deviceIds = Object.keys(index)
  if (deviceIds.length > MAX_TRACKED_DEVICES) {
    const sorted = deviceIds.sort((a, b) => (index[b][0]?.startedAt ?? 0) - (index[a][0]?.startedAt ?? 0))
    for (const deviceId of sorted.slice(MAX_TRACKED_DEVICES)) {
      for (const meta of index[deviceId]) {
        try {
          uni.removeStorageSync(HISTORY_LOGS_PREFIX + meta.id)
        } catch { /* 忽略 */ }
      }
      delete index[deviceId]
    }
  }
}

function flushRecorder(rec: ActiveRecorder): void {
  if (rec.flushTimer) {
    clearTimeout(rec.flushTimer)
    rec.flushTimer = null
  }
  rec.dirtyCount = 0
  const index = loadHistoryIndex()
  const list = index[rec.meta.deviceId] ?? []
  const pos = list.findIndex((m) => m.id === rec.meta.id)
  if (pos >= 0) list[pos] = { ...rec.meta }
  else list.unshift({ ...rec.meta })
  index[rec.meta.deviceId] = list
  pruneStorage(index)
  saveHistoryIndex(index)
  try {
    const stored: StoredSessionLogs = { v: 1, entries: rec.logs }
    uni.setStorageSync(HISTORY_LOGS_PREFIX + rec.meta.id, JSON.stringify(stored))
  } catch (e) {
    console.error('[DeviceArchive] flush logs failed:', e)
  }
}

function scheduleFlush(rec: ActiveRecorder): void {
  rec.dirtyCount++
  if (rec.dirtyCount >= FLUSH_DIRTY_THRESHOLD) {
    flushRecorder(rec)
    return
  }
  if (!rec.flushTimer) {
    rec.flushTimer = setTimeout(() => {
      rec.flushTimer = null
      flushRecorder(rec)
    }, FLUSH_INTERVAL_MS)
  }
}

/** 连接成功时调用：开始录制新会话，返回 sessionId */
export function beginSessionRecord(deviceId: string, deviceName: string): string {
  // 若同设备存在未结束的旧录制（异常残留），先收尾
  const stale = activeRecorders.get(deviceId)
  if (stale) endSessionRecord(deviceId, 'unknown')

  const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const rec: ActiveRecorder = {
    meta: {
      id,
      deviceId,
      deviceName: deviceName || deviceId,
      startedAt: Date.now(),
      endedAt: null,
      endReason: null,
      txBytes: 0,
      rxBytes: 0,
      txFrames: 0,
      rxFrames: 0,
      logCount: 0,
      storedLogCount: 0,
      maxMtu: 23,
      rssiMin: null,
      rssiMax: null,
      rssiAvg: null,
      heartbeat: null,
    },
    logs: [],
    rssiSum: 0,
    rssiCount: 0,
    rttSum: 0,
    dirtyCount: 0,
    flushTimer: null,
  }
  activeRecorders.set(deviceId, rec)
  flushRecorder(rec)
  return id
}

/** 通信日志写入录制（TX/RX/SYS 全量） */
export function recordSessionLog(deviceId: string, entry: LogEntry): void {
  const rec = activeRecorders.get(deviceId)
  if (!rec) return
  rec.meta.logCount++
  if (entry.direction === 'TX') {
    rec.meta.txFrames++
    rec.meta.txBytes += entry.rawLength
  } else if (entry.direction === 'RX') {
    rec.meta.rxFrames++
    rec.meta.rxBytes += entry.rawLength
  }
  rec.logs.push(compactLog(entry))
  if (rec.logs.length > MAX_STORED_LOGS_PER_SESSION) {
    rec.logs.splice(0, rec.logs.length - MAX_STORED_LOGS_PER_SESSION)
  }
  rec.meta.storedLogCount = rec.logs.length
  scheduleFlush(rec)
}

export function recordSessionRssi(deviceId: string, rssi: number): void {
  const rec = activeRecorders.get(deviceId)
  if (!rec) return
  rec.rssiSum += rssi
  rec.rssiCount++
  rec.meta.rssiMin = rec.meta.rssiMin === null ? rssi : Math.min(rec.meta.rssiMin, rssi)
  rec.meta.rssiMax = rec.meta.rssiMax === null ? rssi : Math.max(rec.meta.rssiMax, rssi)
  rec.meta.rssiAvg = Math.round(rec.rssiSum / rec.rssiCount)
  // RSSI 变化不单独触发落盘，随日志/心跳节流写入
}

export function recordSessionMtu(deviceId: string, mtu: number): void {
  const rec = activeRecorders.get(deviceId)
  if (!rec) return
  rec.meta.maxMtu = Math.max(rec.meta.maxMtu, mtu)
  scheduleFlush(rec)
}

/** 心跳统计写入（阶段 ② 心跳测试使用） */
export function recordSessionHeartbeat(
  deviceId: string,
  event: { type: 'sent' } | { type: 'acked'; rttMs: number } | { type: 'missed' },
): void {
  const rec = activeRecorders.get(deviceId)
  if (!rec) return
  const hb: HeartbeatSummary = rec.meta.heartbeat ?? {
    sent: 0, acked: 0, missed: 0, rttMinMs: null, rttAvgMs: null, rttMaxMs: null,
  }
  if (event.type === 'sent') hb.sent++
  else if (event.type === 'missed') hb.missed++
  else {
    hb.acked++
    rec.rttSum += event.rttMs
    hb.rttMinMs = hb.rttMinMs === null ? event.rttMs : Math.min(hb.rttMinMs, event.rttMs)
    hb.rttMaxMs = hb.rttMaxMs === null ? event.rttMs : Math.max(hb.rttMaxMs, event.rttMs)
    hb.rttAvgMs = Math.round(rec.rttSum / hb.acked)
  }
  rec.meta.heartbeat = hb
  scheduleFlush(rec)
}

/** 断开/关闭时调用：收尾并最终落盘 */
export function endSessionRecord(deviceId: string, reason: SessionEndReason): void {
  const rec = activeRecorders.get(deviceId)
  if (!rec) return
  rec.meta.endedAt = Date.now()
  rec.meta.endReason = reason
  flushRecorder(rec)
  activeRecorders.delete(deviceId)
}

/** App 进入后台/退出时调用：全部强制落盘（不结束会话） */
export function flushAllSessionRecords(): void {
  activeRecorders.forEach((rec) => flushRecorder(rec))
}

/** 当前正在录制的会话 meta（导出传输记录用；无录制时返回 null） */
export function getActiveSessionMeta(deviceId: string): SessionMeta | null {
  const rec = activeRecorders.get(deviceId)
  return rec ? { ...rec.meta } : null
}

/** 会话时长（毫秒），未结束时按当前时间计算 */
export function sessionDurationMs(meta: SessionMeta): number {
  return (meta.endedAt ?? Date.now()) - meta.startedAt
}
