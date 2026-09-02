/**
 * Collection 层（Postman 的 Collection）
 *
 * 把"服务 / 特征值 / 命令注释 + 变量 + 样例 + 设备拓扑快照"从具体设备实例上解耦：
 *   - 按服务 UUID 指纹（子集匹配）+ 可选设备名规则自动匹配设备
 *   - 也可显式绑定 deviceId（优先级最高）
 *   - 可序列化导出 / 导入 / 合并，供团队共享与 AI 回写
 *
 * 旧的按 deviceId 存储的注释（ble_device_annotations）首次加载时自动迁移为集合。
 * 面向 UI 的旧 API（loadDeviceAnnotations / saveCharAnnotation / upsertOperationAnnotation …）
 * 保持签名不变，内部改为解析到集合后再读写。
 */

import { normalizeUUID } from './hex'
import type { ProtocolFieldDoc, ProtocolInterfaceDoc, ProtocolProfileDoc } from './protocolDocs'

// ═══════════════════════════════════════════════════════════════════════════
// 一、注释 / 命令模型（原 deviceArchive 定义，迁移至此，deviceArchive 继续 re-export）
// ═══════════════════════════════════════════════════════════════════════════

/** 可执行命令的动作类型（Postman 的 Method） */
export type OperationActionType = 'write' | 'writeNoResponse' | 'read'

export type AssertionOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'range'

/**
 * 字段断言。两种形态：
 *   - 旧：offset + hexValue（响应指定偏移处字节等于 HEX）
 *   - 新：field + op + value（按响应字段表解码后比较，支持数值比较）
 */
export interface FieldAssertion {
  offset?: number
  hexValue?: string
  field?: string
  op?: AssertionOp
  value?: string
}

/** 期望响应（Postman 的 Tests）：判定 PASS / FAIL / TIMEOUT */
export interface OperationExpect {
  enabled: boolean
  /** 响应特征值 UUID（空 = 任意已订阅特征值的 RX） */
  responseCharacteristicUUID: string
  /** HEX 前缀匹配（空 = 任意内容） */
  matchHex: string
  timeoutMs: number
  fieldAssertions?: FieldAssertion[]
}

/** 载荷变体：同一命令的枚举取值（01=开启 / 02=读取 / 03=关闭） */
export interface OperationVariant {
  label: string
  payload: string
}

export interface OperationAnnotation {
  id: string
  name: string
  operationId?: string
  description?: string
  request?: string
  response?: string
  requestExample?: string
  responseExample?: string
  mockRule?: string
  requestFields: ProtocolFieldDoc[]
  responseFields: ProtocolFieldDoc[]
  // ── 执行属性（可选，缺省时按 write + requestExample 执行）──
  actionType?: OperationActionType
  payloadMode?: 'hex' | 'ascii'
  /** 载荷，支持模板占位符：{{len}} {{seq}} {{sum}} {{xor}} {{crc8}} {{crc16}} {{变量名}} */
  payload?: string
  expect?: OperationExpect
  variants?: OperationVariant[]
}

export function defaultOperationExpect(): OperationExpect {
  return { enabled: false, responseCharacteristicUUID: '', matchHex: '', timeoutMs: 2000, fieldAssertions: [] }
}

/** 命令的可执行载荷（payload 优先，回落到 requestExample） */
export function operationPayload(op: OperationAnnotation): string {
  return (op.payload ?? '').trim() || (op.requestExample ?? '').trim()
}

export interface ServiceAnnotation {
  uuid: string
  name?: string
  role?: string
  summary?: string
  updatedAt: number
}

export interface CharAnnotation {
  serviceUUID: string
  uuid: string
  name?: string
  direction?: string
  valueFormat?: string
  description?: string
  operations: OperationAnnotation[]
  updatedAt: number
}

/** 面向 UI 的"某设备当前生效的注释"投影（由集合解析而来） */
export interface DeviceAnnotations {
  deviceId: string
  deviceName?: string
  /** key: normalizeUUID(serviceUUID) */
  services: Record<string, ServiceAnnotation>
  /** key: `${normalizeUUID(svc)}::${normalizeUUID(char)}` */
  characteristics: Record<string, CharAnnotation>
  updatedAt: number
  /** 解析到的集合（无集合时为空） */
  collectionId?: string
  collectionName?: string
}

/** 注释编辑器预填值（UI 层共用） */
export interface AnnotationEditorInitial {
  name?: string
  role?: string
  summary?: string
  direction?: string
  valueFormat?: string
  description?: string
  operations?: OperationAnnotation[]
}

export function charAnnotationKey(serviceUUID: string, charUUID: string): string {
  return `${normalizeUUID(serviceUUID)}::${normalizeUUID(charUUID)}`
}

// ═══════════════════════════════════════════════════════════════════════════
// 二、Collection 模型
// ═══════════════════════════════════════════════════════════════════════════

export interface CollectionVariable {
  name: string
  /** HEX 字节串（如 "01 02"）或数值文本（配合 {{name:u16le}} 使用） */
  value: string
  description?: string
}

export interface CollectionFingerprint {
  /** 规范化的服务 UUID 列表：设备须包含全部这些服务才算匹配（子集匹配） */
  serviceUUIDs: string[]
  /** 可选设备名规则：大小写不敏感的子串；以 / 包裹时按正则处理 */
  namePattern?: string
}

export interface CollectionTopologyChar {
  uuid: string
  /** READ / WRITE / WRITE_NR / NOTIFY / INDICATE */
  properties: string[]
}

export interface CollectionTopologyService {
  uuid: string
  isPrimary: boolean
  characteristics: CollectionTopologyChar[]
}

export interface ExampleFrame {
  hex: string
  ascii?: string
  characteristicUUID?: string
  timestamp?: number
}

/** 请求-响应配对样例（Postman 的 Example） */
export interface BleExample {
  id: string
  name: string
  serviceUUID: string
  characteristicUUID: string
  operationId?: string
  opId?: string
  request?: ExampleFrame
  response?: ExampleFrame & { rttMs?: number }
  tags?: string[]
  note?: string
  mock?: { delayMs?: number; match?: string }
  createdAt: number
}

export type CollectionSource = 'user' | 'import' | 'builtin'

export interface BleCollection {
  kind: 'ble-collection'
  schema: 1
  id: string
  name: string
  description?: string
  source: CollectionSource
  readonly?: boolean
  createdAt: number
  updatedAt: number
  fingerprint: CollectionFingerprint
  /** 显式绑定的设备 ID（优先于指纹匹配；导出时默认剥离） */
  boundDeviceIds: string[]
  /** 设备拓扑快照（Mock 与文档用） */
  topology: CollectionTopologyService[]
  services: Record<string, ServiceAnnotation>
  characteristics: Record<string, CharAnnotation>
  variables: CollectionVariable[]
  examples: BleExample[]
}

const COLLECTIONS_KEY = 'ble_collections'
const LEGACY_ANNOTATIONS_KEY = 'ble_device_annotations'
const LEGACY_BACKUP_KEY = 'ble_device_annotations_legacy'
const DEVICE_ENV_KEY = 'ble_device_env'

function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function createEmptyCollection(init: Partial<BleCollection> & { name: string }): BleCollection {
  const now = Date.now()
  return {
    kind: 'ble-collection',
    schema: 1,
    id: init.id ?? newId('col'),
    name: init.name,
    description: init.description,
    source: init.source ?? 'user',
    readonly: init.readonly,
    createdAt: init.createdAt ?? now,
    updatedAt: init.updatedAt ?? now,
    fingerprint: {
      serviceUUIDs: (init.fingerprint?.serviceUUIDs ?? []).map(normalizeUUID),
      namePattern: init.fingerprint?.namePattern,
    },
    boundDeviceIds: [...(init.boundDeviceIds ?? [])],
    topology: init.topology ?? [],
    services: init.services ?? {},
    characteristics: init.characteristics ?? {},
    variables: init.variables ?? [],
    examples: init.examples ?? [],
  }
}

// ── 变更通知（Pinia store 订阅后驱动 UI 刷新）────────────────────────────────

let version = 0
const changeListeners = new Set<(v: number) => void>()

function bump() {
  version++
  changeListeners.forEach((fn) => fn(version))
}

export function collectionsVersion(): number {
  return version
}

export function onCollectionsChanged(fn: (v: number) => void): () => void {
  changeListeners.add(fn)
  return () => changeListeners.delete(fn)
}

// ── 存储 ────────────────────────────────────────────────────────────────────

let migrated = false

function loadAll(): Record<string, BleCollection> {
  let all: Record<string, BleCollection> = {}
  try {
    const raw = uni.getStorageSync(COLLECTIONS_KEY)
    all = raw ? JSON.parse(raw) : {}
  } catch {
    all = {}
  }
  if (!migrated) {
    migrated = true
    if (migrateLegacyAnnotations(all)) saveAll(all)
  }
  return all
}

function saveAll(all: Record<string, BleCollection>): void {
  try {
    uni.setStorageSync(COLLECTIONS_KEY, JSON.stringify(all))
  } catch (e) {
    console.error('[Collection] save failed:', e)
  }
}

/** 旧版按设备存储的注释 → 每设备一个集合（显式绑定 deviceId）。返回是否发生迁移。 */
function migrateLegacyAnnotations(all: Record<string, BleCollection>): boolean {
  let raw = ''
  try {
    raw = uni.getStorageSync(LEGACY_ANNOTATIONS_KEY)
  } catch {
    return false
  }
  if (!raw) return false
  let legacy: Record<string, DeviceAnnotations> = {}
  try {
    legacy = JSON.parse(raw)
  } catch {
    return false
  }
  let changed = false
  for (const [deviceId, dev] of Object.entries(legacy)) {
    const hasContent = Object.keys(dev.services ?? {}).length || Object.keys(dev.characteristics ?? {}).length
    if (!hasContent) continue
    const serviceUUIDs = new Set<string>()
    for (const key of Object.keys(dev.services ?? {})) serviceUUIDs.add(normalizeUUID(key))
    for (const key of Object.keys(dev.characteristics ?? {})) serviceUUIDs.add(normalizeUUID(key.split('::')[0]))
    const col = createEmptyCollection({
      name: dev.deviceName || deviceId,
      fingerprint: { serviceUUIDs: Array.from(serviceUUIDs) },
      boundDeviceIds: [deviceId],
      services: dev.services ?? {},
      characteristics: dev.characteristics ?? {},
      createdAt: dev.updatedAt || Date.now(),
      updatedAt: dev.updatedAt || Date.now(),
    })
    all[col.id] = col
    changed = true
  }
  try {
    uni.setStorageSync(LEGACY_BACKUP_KEY, raw)
    uni.removeStorageSync(LEGACY_ANNOTATIONS_KEY)
  } catch { /* 忽略 */ }
  return changed
}

/** 测试/重置用：清除迁移标记（storage 被清空后需要重新迁移时调用） */
export function resetCollectionCache(): void {
  migrated = false
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export function listCollections(): BleCollection[] {
  return Object.values(loadAll()).sort((a, b) => b.updatedAt - a.updatedAt)
}

export function getCollection(id: string): BleCollection | null {
  return loadAll()[id] ?? null
}

export function saveCollection(col: BleCollection): BleCollection {
  const all = loadAll()
  col.updatedAt = Date.now()
  all[col.id] = col
  saveAll(all)
  bump()
  return col
}

export function deleteCollection(id: string): void {
  const all = loadAll()
  if (!all[id]) return
  delete all[id]
  saveAll(all)
  bump()
}

export function createCollection(init: Partial<BleCollection> & { name: string }): BleCollection {
  const col = createEmptyCollection(init)
  const all = loadAll()
  all[col.id] = col
  saveAll(all)
  bump()
  return col
}

/** 复制一份可编辑集合（内置模板"复制为可编辑"、或备份） */
export function cloneCollection(src: BleCollection, name?: string): BleCollection {
  const copy: BleCollection = JSON.parse(JSON.stringify(src))
  return createCollection({
    ...copy,
    id: undefined,
    name: name ?? `${src.name} copy`,
    source: 'user',
    readonly: false,
    boundDeviceIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })
}

/** 绑定设备到集合（同一设备只能绑定一个集合） */
export function bindDeviceToCollection(deviceId: string, collectionId: string): BleCollection | null {
  const all = loadAll()
  const target = all[collectionId]
  if (!target) return null
  for (const col of Object.values(all)) {
    col.boundDeviceIds = (col.boundDeviceIds ?? []).filter((id) => id !== deviceId)
  }
  target.boundDeviceIds.push(deviceId)
  target.updatedAt = Date.now()
  saveAll(all)
  bump()
  return target
}

export function unbindDevice(deviceId: string): void {
  const all = loadAll()
  let changed = false
  for (const col of Object.values(all)) {
    const before = col.boundDeviceIds?.length ?? 0
    col.boundDeviceIds = (col.boundDeviceIds ?? []).filter((id) => id !== deviceId)
    if (col.boundDeviceIds.length !== before) changed = true
  }
  if (changed) {
    saveAll(all)
    bump()
  }
}

// ── 设备运行时上下文（bleStore 在连接/发现服务时登记，供解析与拓扑同步）──────

export interface DeviceContext {
  name: string
  serviceUUIDs: string[]
  topology: CollectionTopologyService[]
}

const deviceContexts = new Map<string, DeviceContext>()

export function registerDeviceContext(deviceId: string, ctx: Partial<DeviceContext>): DeviceContext {
  const prev = deviceContexts.get(deviceId) ?? { name: '', serviceUUIDs: [], topology: [] }
  const next: DeviceContext = {
    name: ctx.name ?? prev.name,
    serviceUUIDs: ctx.serviceUUIDs ? ctx.serviceUUIDs.map(normalizeUUID) : prev.serviceUUIDs,
    topology: ctx.topology ?? prev.topology,
  }
  deviceContexts.set(deviceId, next)
  return next
}

/** 登记某服务的特征值（拓扑快照增量） */
export function registerDeviceCharacteristics(
  deviceId: string,
  serviceUUID: string,
  chars: CollectionTopologyChar[],
): void {
  const ctx = deviceContexts.get(deviceId) ?? { name: '', serviceUUIDs: [], topology: [] }
  const svcKey = normalizeUUID(serviceUUID)
  let svc = ctx.topology.find((s) => normalizeUUID(s.uuid) === svcKey)
  if (!svc) {
    svc = { uuid: serviceUUID, isPrimary: true, characteristics: [] }
    ctx.topology.push(svc)
  }
  svc.characteristics = chars.map((c) => ({ uuid: c.uuid, properties: [...c.properties] }))
  if (!ctx.serviceUUIDs.includes(svcKey)) ctx.serviceUUIDs.push(svcKey)
  deviceContexts.set(deviceId, ctx)
}

export function getDeviceContext(deviceId: string): DeviceContext | null {
  return deviceContexts.get(deviceId) ?? null
}

export function clearDeviceContext(deviceId: string): void {
  deviceContexts.delete(deviceId)
}

// ── 匹配解析 ────────────────────────────────────────────────────────────────

function namePatternMatches(pattern: string | undefined, deviceName: string): boolean {
  const p = (pattern ?? '').trim()
  if (!p) return true
  if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) {
    try {
      return new RegExp(p.slice(1, -1), 'i').test(deviceName)
    } catch {
      return false
    }
  }
  return deviceName.toLowerCase().includes(p.toLowerCase())
}

/**
 * 匹配分数：
 *   显式绑定 → 1000
 *   指纹子集匹配 → 指纹服务数（名称规则不满足则 0）
 *   仅名称规则 → 1
 *   无指纹无规则 → 0（只能显式绑定）
 */
export function collectionMatchScore(
  col: BleCollection,
  deviceId: string,
  serviceUUIDs: string[],
  deviceName: string,
): number {
  if ((col.boundDeviceIds ?? []).includes(deviceId)) return 1000
  const fp = (col.fingerprint?.serviceUUIDs ?? []).map(normalizeUUID)
  const pattern = col.fingerprint?.namePattern
  if (!fp.length && !(pattern ?? '').trim()) return 0
  if (!namePatternMatches(pattern, deviceName)) return 0
  if (!fp.length) return 1
  const present = new Set(serviceUUIDs.map(normalizeUUID))
  if (!present.size) return 0
  for (const uuid of fp) {
    if (!present.has(uuid)) return 0
  }
  return fp.length
}

export function resolveCollectionForDevice(
  deviceId: string,
  serviceUUIDs?: string[],
  deviceName?: string,
): BleCollection | null {
  const ctx = deviceContexts.get(deviceId)
  const uuids = serviceUUIDs ?? ctx?.serviceUUIDs ?? []
  const name = deviceName ?? ctx?.name ?? ''
  let best: BleCollection | null = null
  let bestScore = 0
  for (const col of Object.values(loadAll())) {
    const score = collectionMatchScore(col, deviceId, uuids, name)
    if (score > bestScore || (score === bestScore && score > 0 && best && col.updatedAt > best.updatedAt)) {
      best = col
      bestScore = score
    }
  }
  return best
}

/** 解析不到集合时，为该设备创建并绑定一个新集合 */
export function ensureCollectionForDevice(deviceId: string, deviceName?: string): BleCollection {
  const existing = resolveCollectionForDevice(deviceId, undefined, deviceName)
  if (existing) return existing
  const ctx = deviceContexts.get(deviceId)
  const name = deviceName || ctx?.name || deviceId
  return createCollection({
    name,
    fingerprint: { serviceUUIDs: ctx?.serviceUUIDs ?? [] },
    boundDeviceIds: [deviceId],
    topology: ctx ? JSON.parse(JSON.stringify(ctx.topology)) : [],
  })
}

/** 把设备当前拓扑合并进已匹配集合（补全指纹与特征值属性） */
export function syncCollectionTopology(deviceId: string): BleCollection | null {
  const ctx = deviceContexts.get(deviceId)
  const col = resolveCollectionForDevice(deviceId)
  if (!ctx || !col) return col
  let changed = false
  if (!col.fingerprint.serviceUUIDs.length && ctx.serviceUUIDs.length) {
    col.fingerprint.serviceUUIDs = [...ctx.serviceUUIDs]
    changed = true
  }
  for (const svc of ctx.topology) {
    const key = normalizeUUID(svc.uuid)
    let target = col.topology.find((s) => normalizeUUID(s.uuid) === key)
    if (!target) {
      target = { uuid: svc.uuid, isPrimary: svc.isPrimary, characteristics: [] }
      col.topology.push(target)
      changed = true
    }
    for (const ch of svc.characteristics) {
      const chKey = normalizeUUID(ch.uuid)
      const existing = target.characteristics.find((c) => normalizeUUID(c.uuid) === chKey)
      if (!existing) {
        target.characteristics.push({ uuid: ch.uuid, properties: [...ch.properties] })
        changed = true
      } else if (existing.properties.join(',') !== ch.properties.join(',')) {
        existing.properties = [...ch.properties]
        changed = true
      }
    }
  }
  if (changed) {
    const all = loadAll()
    all[col.id] = col
    saveAll(all)
    // 拓扑同步不触发 UI 级变更通知（避免连接过程中的重复刷新）
  }
  return col
}

// ── 旧 API 兼容层（按设备读写，内部落到集合）───────────────────────────────

function projectAnnotations(deviceId: string, col: BleCollection | null): DeviceAnnotations {
  if (!col) return { deviceId, services: {}, characteristics: {}, updatedAt: 0 }
  return {
    deviceId,
    deviceName: deviceContexts.get(deviceId)?.name,
    services: col.services,
    characteristics: col.characteristics,
    updatedAt: col.updatedAt,
    collectionId: col.id,
    collectionName: col.name,
  }
}

export function loadDeviceAnnotations(deviceId: string): DeviceAnnotations {
  return projectAnnotations(deviceId, resolveCollectionForDevice(deviceId))
}

export function saveServiceAnnotation(deviceId: string, deviceName: string, ann: ServiceAnnotation): DeviceAnnotations {
  if (deviceName) registerDeviceContext(deviceId, { name: deviceName })
  const col = ensureCollectionForDevice(deviceId, deviceName)
  col.services[normalizeUUID(ann.uuid)] = { ...ann, updatedAt: Date.now() }
  saveCollection(col)
  return projectAnnotations(deviceId, col)
}

export function saveCharAnnotation(deviceId: string, deviceName: string, ann: CharAnnotation): DeviceAnnotations {
  if (deviceName) registerDeviceContext(deviceId, { name: deviceName })
  const col = ensureCollectionForDevice(deviceId, deviceName)
  col.characteristics[charAnnotationKey(ann.serviceUUID, ann.uuid)] = { ...ann, updatedAt: Date.now() }
  saveCollection(col)
  return projectAnnotations(deviceId, col)
}

export function removeCharAnnotation(deviceId: string, serviceUUID: string, charUUID: string): void {
  const col = resolveCollectionForDevice(deviceId)
  if (!col) return
  delete col.characteristics[charAnnotationKey(serviceUUID, charUUID)]
  saveCollection(col)
}

/** 单条命令 upsert：命令面板/命令编辑器直接落库，不必整个特征值重存 */
export function upsertOperationAnnotation(
  deviceId: string,
  deviceName: string,
  serviceUUID: string,
  charUUID: string,
  op: OperationAnnotation,
): DeviceAnnotations {
  if (deviceName) registerDeviceContext(deviceId, { name: deviceName })
  const col = ensureCollectionForDevice(deviceId, deviceName)
  upsertOperationInCollection(col, serviceUUID, charUUID, op)
  saveCollection(col)
  return projectAnnotations(deviceId, col)
}

export function upsertOperationInCollection(
  col: BleCollection,
  serviceUUID: string,
  charUUID: string,
  op: OperationAnnotation,
): CharAnnotation {
  const key = charAnnotationKey(serviceUUID, charUUID)
  const charAnn: CharAnnotation = col.characteristics[key] ?? {
    serviceUUID,
    uuid: charUUID,
    operations: [],
    updatedAt: 0,
  }
  const idx = charAnn.operations.findIndex((o) => o.id === op.id)
  if (idx >= 0) charAnn.operations[idx] = { ...op }
  else charAnn.operations.push({ ...op })
  charAnn.updatedAt = Date.now()
  col.characteristics[key] = charAnn
  return charAnn
}

/** 删除单条命令 */
export function removeOperationAnnotation(
  deviceId: string,
  serviceUUID: string,
  charUUID: string,
  opId: string,
): DeviceAnnotations {
  const col = resolveCollectionForDevice(deviceId)
  if (!col) return projectAnnotations(deviceId, null)
  const key = charAnnotationKey(serviceUUID, charUUID)
  const charAnn = col.characteristics[key]
  if (charAnn) {
    charAnn.operations = charAnn.operations.filter((o) => o.id !== opId)
    charAnn.updatedAt = Date.now()
    saveCollection(col)
  }
  return projectAnnotations(deviceId, col)
}

// ── 变量 / 环境（集合默认值 ← 设备级覆盖）──────────────────────────────────

function loadAllDeviceEnv(): Record<string, Record<string, string>> {
  try {
    const raw = uni.getStorageSync(DEVICE_ENV_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function loadDeviceEnv(deviceId: string): Record<string, string> {
  return loadAllDeviceEnv()[deviceId] ?? {}
}

export function saveDeviceEnv(deviceId: string, vars: Record<string, string>): void {
  const all = loadAllDeviceEnv()
  const cleaned: Record<string, string> = {}
  for (const [k, v] of Object.entries(vars)) {
    if (k.trim()) cleaned[k.trim()] = v
  }
  if (Object.keys(cleaned).length) all[deviceId] = cleaned
  else delete all[deviceId]
  try {
    uni.setStorageSync(DEVICE_ENV_KEY, JSON.stringify(all))
  } catch (e) {
    console.error('[Collection] saveDeviceEnv failed:', e)
  }
  bump()
}

export function saveCollectionVariables(collectionId: string, vars: CollectionVariable[]): BleCollection | null {
  const col = getCollection(collectionId)
  if (!col) return null
  col.variables = vars.filter((v) => v.name.trim()).map((v) => ({ ...v, name: v.name.trim() }))
  return saveCollection(col)
}

/** 解析某设备当前可用变量：集合默认值被设备级覆盖 */
export function resolveVariables(deviceId: string): Record<string, string> {
  const col = resolveCollectionForDevice(deviceId)
  const out: Record<string, string> = {}
  for (const v of col?.variables ?? []) out[v.name] = v.value
  const env = loadDeviceEnv(deviceId)
  for (const [k, v] of Object.entries(env)) out[k] = v
  return out
}

// ── 样例（请求-响应配对）────────────────────────────────────────────────────

export function addExampleToCollection(collectionId: string, example: BleExample): BleCollection | null {
  const col = getCollection(collectionId)
  if (!col) return null
  col.examples = [example, ...(col.examples ?? []).filter((e) => e.id !== example.id)].slice(0, 200)
  return saveCollection(col)
}

export function removeExampleFromCollection(collectionId: string, exampleId: string): BleCollection | null {
  const col = getCollection(collectionId)
  if (!col) return null
  col.examples = (col.examples ?? []).filter((e) => e.id !== exampleId)
  return saveCollection(col)
}

export function newExampleId(): string {
  return newId('ex')
}

// ═══════════════════════════════════════════════════════════════════════════
// 三、导入 / 导出 / 合并
// ═══════════════════════════════════════════════════════════════════════════

export type ImportKind = 'collection' | 'protocol-spec' | 'debug-pack' | 'legacy-annotations'

export interface ImportPreview {
  kind: ImportKind
  collection: BleCollection
  serviceCount: number
  charCount: number
  opCount: number
  exampleCount: number
  variableCount: number
  warnings: string[]
}

export function serializeCollection(col: BleCollection, opts?: { stripBindings?: boolean }): string {
  const out: BleCollection = JSON.parse(JSON.stringify(col))
  if (opts?.stripBindings !== false) out.boundDeviceIds = []
  out.source = out.source === 'builtin' ? 'builtin' : 'user'
  delete out.readonly
  return JSON.stringify(out, null, 2)
}

function interfaceDocToOperation(api: ProtocolInterfaceDoc, idPrefix: string): OperationAnnotation {
  const isRead = (api.request ?? '').trim().toUpperCase() === 'READ'
  const template = (api.payload ?? '').trim()
  const hasWriteExample = !!template || !!(api.requestExample ?? '').trim()
  return {
    id: `${idPrefix}_${(api.operationId || api.name || 'op').replace(/[^\w.-]/g, '_')}`,
    name: api.name || api.operationId || 'Unnamed',
    operationId: api.operationId || '',
    description: api.description,
    request: api.request,
    response: api.response,
    requestExample: api.requestExample,
    responseExample: api.responseExample,
    mockRule: api.mock,
    requestFields: api.requestFields ?? [],
    responseFields: api.responseFields ?? [],
    actionType: isRead ? 'read' : 'write',
    payloadMode: 'hex',
    payload: hasWriteExample ? (template || api.requestExample) : '',
    expect: defaultOperationExpect(),
  }
}

function propsToList(p: any): string[] {
  if (Array.isArray(p)) return p.map((x) => String(x).toUpperCase())
  if (!p || typeof p !== 'object') return []
  const out: string[] = []
  if (p.read) out.push('READ')
  if (p.write) out.push('WRITE')
  if (p.writeNoResponse) out.push('WRITE_NR')
  if (p.notify) out.push('NOTIFY')
  if (p.indicate) out.push('INDICATE')
  return out
}

/** 把"服务文档数组"（protocol.json 0.2.0 / ProtocolServiceDoc）灌入集合 */
function absorbServiceDocs(col: BleCollection, services: any[], idPrefix: string): void {
  for (const svc of services ?? []) {
    if (!svc?.uuid) continue
    const svcKey = normalizeUUID(String(svc.uuid))
    if (!col.fingerprint.serviceUUIDs.includes(svcKey)) col.fingerprint.serviceUUIDs.push(svcKey)
    if (svc.name || svc.role || svc.summary) {
      col.services[svcKey] = {
        uuid: String(svc.uuid),
        name: svc.name || undefined,
        role: svc.role || undefined,
        summary: svc.summary || undefined,
        updatedAt: Date.now(),
      }
    }
    const topoSvc: CollectionTopologyService = { uuid: String(svc.uuid), isPrimary: svc.isPrimary !== false, characteristics: [] }
    for (const ch of svc.characteristics ?? []) {
      if (!ch?.uuid) continue
      const props = propsToList(ch.properties)
      topoSvc.characteristics.push({ uuid: String(ch.uuid), properties: props })
      const interfaces: ProtocolInterfaceDoc[] = ch.operations ?? ch.interfaces ?? []
      const ops = interfaces.map((api) => interfaceDocToOperation(api, idPrefix))
      const hasDoc = ch.name || ch.direction || ch.valueFormat || ch.description || ops.length
      if (!hasDoc) continue
      col.characteristics[charAnnotationKey(String(svc.uuid), String(ch.uuid))] = {
        serviceUUID: String(svc.uuid),
        uuid: String(ch.uuid),
        name: ch.name || undefined,
        direction: ch.direction || undefined,
        valueFormat: ch.valueFormat || undefined,
        description: ch.description || undefined,
        operations: ops,
        updatedAt: Date.now(),
      }
    }
    if (topoSvc.characteristics.length) col.topology.push(topoSvc)
  }
}

function normalizeImportedCollection(raw: any): BleCollection {
  const col = createEmptyCollection({
    id: typeof raw.id === 'string' && raw.id ? raw.id : undefined,
    name: String(raw.name || 'Imported Collection'),
    description: raw.description ? String(raw.description) : undefined,
    source: 'import',
    createdAt: Number(raw.createdAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
    fingerprint: {
      serviceUUIDs: Array.isArray(raw.fingerprint?.serviceUUIDs) ? raw.fingerprint.serviceUUIDs.map(String) : [],
      namePattern: raw.fingerprint?.namePattern ? String(raw.fingerprint.namePattern) : undefined,
    },
    boundDeviceIds: [],
    topology: Array.isArray(raw.topology) ? raw.topology : [],
    services: raw.services && typeof raw.services === 'object' ? raw.services : {},
    characteristics: raw.characteristics && typeof raw.characteristics === 'object' ? raw.characteristics : {},
    variables: Array.isArray(raw.variables) ? raw.variables.filter((v: any) => v && v.name) : [],
    examples: Array.isArray(raw.examples) ? raw.examples.filter((e: any) => e && e.id) : [],
  })
  // 特征值注释缺 operations 时补空数组，避免 UI 崩
  for (const ch of Object.values(col.characteristics)) {
    if (!Array.isArray(ch.operations)) ch.operations = []
    for (const op of ch.operations) {
      if (!Array.isArray(op.requestFields)) op.requestFields = []
      if (!Array.isArray(op.responseFields)) op.responseFields = []
      if (!op.id) op.id = newId('op')
    }
  }
  return col
}

export function parseCollectionImport(text: string): ImportPreview {
  let raw: any
  try {
    raw = JSON.parse(text.trim())
  } catch {
    throw new Error('invalid-json')
  }
  if (!raw || typeof raw !== 'object') throw new Error('invalid-json')

  const warnings: string[] = []
  let kind: ImportKind
  let col: BleCollection
  const idPrefix = `op_imp_${Date.now().toString(36)}`

  if (raw.kind === 'ble-collection') {
    kind = 'collection'
    col = normalizeImportedCollection(raw)
  } else if (raw.kind === 'ble-debug-pack' && raw.protocolSpec) {
    kind = 'debug-pack'
    col = fromProtocolSpec(raw.protocolSpec, idPrefix, warnings)
  } else if (raw.kind === 'ble-protocol-spec') {
    kind = 'protocol-spec'
    col = fromProtocolSpec(raw, idPrefix, warnings)
  } else if (raw.services && raw.characteristics && typeof raw.services === 'object' && !Array.isArray(raw.services)) {
    kind = 'legacy-annotations'
    col = normalizeImportedCollection({
      ...raw,
      name: raw.deviceName || raw.deviceId || 'Imported Annotations',
      fingerprint: { serviceUUIDs: Object.keys(raw.services) },
      topology: [],
    })
  } else {
    throw new Error('unknown-format')
  }

  // 若集合自带协议 protocol.json 里的 collection 元信息（0.3.0 起），沿用名称与指纹
  if (raw.collection && typeof raw.collection === 'object' && kind === 'protocol-spec') {
    if (raw.collection.name) col.name = String(raw.collection.name)
    if (Array.isArray(raw.collection.fingerprint?.serviceUUIDs) && raw.collection.fingerprint.serviceUUIDs.length) {
      col.fingerprint.serviceUUIDs = raw.collection.fingerprint.serviceUUIDs.map(normalizeUUID)
    }
    if (raw.collection.fingerprint?.namePattern) col.fingerprint.namePattern = String(raw.collection.fingerprint.namePattern)
    if (Array.isArray(raw.collection.variables)) col.variables = raw.collection.variables.filter((v: any) => v && v.name)
  }

  const charCount = Object.keys(col.characteristics).length
  const opCount = Object.values(col.characteristics).reduce((n, c) => n + (c.operations?.length ?? 0), 0)
  if (!Object.keys(col.services).length && !charCount) warnings.push('empty')
  return {
    kind,
    collection: col,
    serviceCount: Object.keys(col.services).length,
    charCount,
    opCount,
    exampleCount: col.examples.length,
    variableCount: col.variables.length,
    warnings,
  }
}

function fromProtocolSpec(spec: any, idPrefix: string, warnings: string[]): BleCollection {
  const deviceName = spec.device?.name ? String(spec.device.name) : ''
  const col = createEmptyCollection({ name: deviceName || 'Imported Protocol', source: 'import' })
  if (Array.isArray(spec.services)) {
    // 0.2.0：services[].characteristics[].operations
    absorbServiceDocs(col, spec.services, idPrefix)
  } else if (Array.isArray(spec.matchedProfiles)) {
    // 0.1.0：matchedProfiles[].services（内置模板 + 注释伪 profile）
    for (const profile of spec.matchedProfiles) absorbServiceDocs(col, profile.services ?? [], idPrefix)
    if (Array.isArray(spec.device?.services)) {
      for (const svc of spec.device.services) {
        const key = normalizeUUID(String(svc.uuid ?? ''))
        if (key && !col.fingerprint.serviceUUIDs.includes(key)) col.fingerprint.serviceUUIDs.push(key)
      }
    }
  } else {
    warnings.push('no-services')
  }
  if (Array.isArray(spec.savedSamples)) {
    for (const s of spec.savedSamples) {
      if (!s?.hex || !s?.serviceUUID || !s?.characteristicUUID) continue
      const frame: ExampleFrame = { hex: String(s.hex), ascii: s.ascii, timestamp: s.timestamp }
      col.examples.push({
        id: String(s.id || newId('ex')),
        name: String(s.name || 'sample'),
        serviceUUID: String(s.serviceUUID),
        characteristicUUID: String(s.characteristicUUID),
        operationId: s.operationId,
        request: s.direction === 'TX' ? frame : undefined,
        response: s.direction === 'RX' ? frame : undefined,
        createdAt: Number(s.timestamp) || Date.now(),
      })
    }
  }
  return col
}

export type MergeStrategy = 'keep-existing' | 'overwrite'

function fillEmpty<T extends object>(target: T, incoming: T, keys: (keyof T)[]): void {
  for (const k of keys) {
    const cur = target[k]
    const inc = incoming[k]
    if ((cur === undefined || cur === null || cur === '') && inc !== undefined && inc !== null && inc !== '') {
      target[k] = inc
    }
  }
}

function mergeOperation(target: OperationAnnotation, incoming: OperationAnnotation, strategy: MergeStrategy): OperationAnnotation {
  if (strategy === 'overwrite') return { ...incoming, id: target.id }
  const merged: OperationAnnotation = { ...target }
  fillEmpty(merged, incoming, [
    'operationId', 'description', 'request', 'response', 'requestExample', 'responseExample',
    'mockRule', 'actionType', 'payloadMode', 'payload',
  ])
  if (!merged.requestFields?.length && incoming.requestFields?.length) merged.requestFields = incoming.requestFields
  if (!merged.responseFields?.length && incoming.responseFields?.length) merged.responseFields = incoming.responseFields
  if (!merged.expect?.enabled && incoming.expect?.enabled) merged.expect = incoming.expect
  if (!merged.variants?.length && incoming.variants?.length) merged.variants = incoming.variants
  return merged
}

/** 返回合并后的新对象（不落库） */
export function mergeCollections(target: BleCollection, incoming: BleCollection, strategy: MergeStrategy): BleCollection {
  const out: BleCollection = JSON.parse(JSON.stringify(target))
  for (const uuid of incoming.fingerprint.serviceUUIDs) {
    const key = normalizeUUID(uuid)
    if (!out.fingerprint.serviceUUIDs.includes(key)) out.fingerprint.serviceUUIDs.push(key)
  }
  if (!out.fingerprint.namePattern && incoming.fingerprint.namePattern) out.fingerprint.namePattern = incoming.fingerprint.namePattern
  if (!out.description && incoming.description) out.description = incoming.description

  for (const [key, svc] of Object.entries(incoming.services)) {
    const cur = out.services[key]
    if (!cur || strategy === 'overwrite') out.services[key] = { ...svc, updatedAt: Date.now() }
    else fillEmpty(cur, svc, ['name', 'role', 'summary'])
  }

  for (const [key, ch] of Object.entries(incoming.characteristics)) {
    const cur = out.characteristics[key]
    if (!cur) {
      out.characteristics[key] = JSON.parse(JSON.stringify(ch))
      continue
    }
    if (strategy === 'overwrite') fillEmptyOverwrite(cur, ch)
    else fillEmpty(cur, ch, ['name', 'direction', 'valueFormat', 'description'])
    for (const op of ch.operations ?? []) {
      const idx = cur.operations.findIndex((o) =>
        o.id === op.id ||
        (op.operationId && o.operationId === op.operationId) ||
        (!op.operationId && o.name === op.name),
      )
      if (idx < 0) cur.operations.push(JSON.parse(JSON.stringify(op)))
      else cur.operations[idx] = mergeOperation(cur.operations[idx], op, strategy)
    }
    cur.updatedAt = Date.now()
  }

  for (const v of incoming.variables ?? []) {
    const idx = out.variables.findIndex((x) => x.name === v.name)
    if (idx < 0) out.variables.push({ ...v })
    else if (strategy === 'overwrite') out.variables[idx] = { ...v }
  }
  for (const ex of incoming.examples ?? []) {
    if (!out.examples.some((x) => x.id === ex.id)) out.examples.push(JSON.parse(JSON.stringify(ex)))
  }
  for (const svc of incoming.topology ?? []) {
    const key = normalizeUUID(svc.uuid)
    let cur = out.topology.find((s) => normalizeUUID(s.uuid) === key)
    if (!cur) {
      cur = { uuid: svc.uuid, isPrimary: svc.isPrimary, characteristics: [] }
      out.topology.push(cur)
    }
    for (const ch of svc.characteristics) {
      if (!cur.characteristics.some((c) => normalizeUUID(c.uuid) === normalizeUUID(ch.uuid))) {
        cur.characteristics.push({ uuid: ch.uuid, properties: [...ch.properties] })
      }
    }
  }
  out.updatedAt = Date.now()
  return out
}

function fillEmptyOverwrite(cur: CharAnnotation, inc: CharAnnotation): void {
  if (inc.name) cur.name = inc.name
  if (inc.direction) cur.direction = inc.direction
  if (inc.valueFormat) cur.valueFormat = inc.valueFormat
  if (inc.description) cur.description = inc.description
}

export interface ImportOptions {
  mode: 'new' | 'merge'
  targetId?: string
  strategy?: MergeStrategy
  /** 导入后立即绑定到该设备 */
  bindDeviceId?: string
}

export function importCollection(preview: ImportPreview, opts: ImportOptions): BleCollection {
  const all = loadAll()
  let result: BleCollection
  if (opts.mode === 'merge' && opts.targetId && all[opts.targetId]) {
    result = mergeCollections(all[opts.targetId], preview.collection, opts.strategy ?? 'keep-existing')
  } else {
    result = JSON.parse(JSON.stringify(preview.collection))
    // 避免与本地已有 id 冲突
    if (all[result.id]) result.id = newId('col')
    result.source = 'import'
    result.readonly = false
    result.boundDeviceIds = []
    result.updatedAt = Date.now()
  }
  if (opts.bindDeviceId) {
    for (const col of Object.values(all)) {
      col.boundDeviceIds = (col.boundDeviceIds ?? []).filter((id) => id !== opts.bindDeviceId)
    }
    if (!result.boundDeviceIds.includes(opts.bindDeviceId)) result.boundDeviceIds.push(opts.bindDeviceId)
  }
  all[result.id] = result
  saveAll(all)
  bump()
  return result
}

// ── 内置模板 → 只读集合视图（工作台列表用）─────────────────────────────────

export function builtinProfileToCollection(profile: ProtocolProfileDoc): BleCollection {
  const col = createEmptyCollection({
    id: `builtin:${profile.id}`,
    name: profile.name,
    description: profile.summary,
    source: 'builtin',
    readonly: true,
    createdAt: 0,
    updatedAt: 0,
  })
  const services = profile.services.map((svc) => ({
    uuid: svc.uuid,
    isPrimary: true,
    name: svc.name,
    role: svc.role,
    summary: svc.summary,
    characteristics: svc.characteristics.map((ch) => ({
      uuid: ch.uuid,
      properties: ch.properties,
      name: ch.name,
      direction: ch.direction,
      valueFormat: ch.valueFormat,
      description: ch.description,
      operations: ch.interfaces,
    })),
  }))
  absorbServiceDocs(col, services, `builtin_${profile.id}`)
  return col
}

/** 集合统计（列表卡片用） */
export function collectionStats(col: BleCollection): { services: number; chars: number; ops: number; examples: number; variables: number } {
  return {
    services: Math.max(Object.keys(col.services).length, col.fingerprint.serviceUUIDs.length),
    chars: Object.keys(col.characteristics).length,
    ops: Object.values(col.characteristics).reduce((n, c) => n + (c.operations?.length ?? 0), 0),
    examples: col.examples?.length ?? 0,
    variables: col.variables?.length ?? 0,
  }
}
