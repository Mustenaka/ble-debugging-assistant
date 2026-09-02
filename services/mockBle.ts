/**
 * Mock BLE Provider（无硬件模式）
 *
 *  - 设备 ID 以 "mock:" 开头；bleManager 对这类 ID 的全部操作转发到这里
 *  - 内置演示设备（Generic Command + Device Information + Battery），新用户零硬件即可走完全流程
 *  - 每个带拓扑快照的用户集合也可以生成一台 Mock 设备：命令载荷 → 响应样例 / 配对样例 → 响应规则
 *  - 行为尽量贴近真实外设：写入后按规则延迟 Notify；未订阅时响应写入可读值；周期事件；RSSI 抖动
 */

import { normalizeUUID } from '../utils/hex'
import { hexToBytes, bytesToHex } from '../utils/fields'
import { listCollections, operationPayload, type BleCollection } from '../utils/collection'
import { hasTemplateTokens, renderPayloadTemplate } from '../utils/payload'
import type { BleDevice, BleService, BleCharacteristic } from './bleManager'

export const MOCK_ID_PREFIX = 'mock:'
export const DEMO_DEVICE_ID = 'mock:demo'
const MOCK_MODE_KEY = 'ble_mock_mode'

export function isMockDeviceId(id: string | undefined | null): boolean {
  return !!id && id.startsWith(MOCK_ID_PREFIX)
}

export function isMockModeEnabled(): boolean {
  try {
    return uni.getStorageSync(MOCK_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function setMockModeEnabled(on: boolean): void {
  try {
    uni.setStorageSync(MOCK_MODE_KEY, on ? '1' : '0')
  } catch { /* 忽略 */ }
}

// ── 规格 ────────────────────────────────────────────────────────────────────

export interface MockCharSpec {
  uuid: string
  properties: BleCharacteristic['properties']
}

export interface MockServiceSpec {
  uuid: string
  isPrimary: boolean
  characteristics: MockCharSpec[]
}

export interface MockRule {
  id: string
  name: string
  serviceUUID: string
  characteristicUUID: string
  /** 请求 HEX 前缀（空 = 任意写入都匹配） */
  matchHex: string
  responseCharacteristicUUID: string
  responseHex: string
  delayMs: number
}

export interface MockPeriodic {
  name: string
  serviceUUID: string
  characteristicUUID: string
  hex: string
  intervalMs: number
}

export interface MockDeviceSpec {
  deviceId: string
  name: string
  rssi: number
  mtu: number
  services: MockServiceSpec[]
  rules: MockRule[]
  periodic: MockPeriodic[]
  /** key: svc::chr → 可读值 HEX */
  readValues: Record<string, string>
  /** 无规则命中时是否把写入回显到指定 Notify 特征值（NUS 风格） */
  echo?: { serviceUUID: string; characteristicUUID: string }
  /** 来源集合（无硬件调试时按集合规则应答） */
  collectionId?: string
}

function key(svc: string, chr: string): string {
  return `${normalizeUUID(svc)}::${normalizeUUID(chr)}`
}

function props(p: Partial<BleCharacteristic['properties']>): BleCharacteristic['properties'] {
  return { read: !!p.read, write: !!p.write, notify: !!p.notify, indicate: !!p.indicate, writeNoResponse: !!p.writeNoResponse }
}

const SVC_CMD = '0000FFE0-0000-1000-8000-00805F9B34FB'
const CHR_CMD_TX = '0000FFE1-0000-1000-8000-00805F9B34FB'
const CHR_CMD_RX = '0000FFE2-0000-1000-8000-00805F9B34FB'
const SVC_DIS = '0000180A-0000-1000-8000-00805F9B34FB'
const CHR_MANUF = '00002A29-0000-1000-8000-00805F9B34FB'
const CHR_FW = '00002A26-0000-1000-8000-00805F9B34FB'
const SVC_BAT = '0000180F-0000-1000-8000-00805F9B34FB'
const CHR_BAT = '00002A19-0000-1000-8000-00805F9B34FB'

/** 内置演示设备：与内置协议模板（generic-command / standard-gatt）完全对应 */
export function buildDemoDeviceSpec(): MockDeviceSpec {
  return {
    deviceId: DEMO_DEVICE_ID,
    name: 'BLE Demo Device',
    rssi: -52,
    mtu: 185,
    services: [
      {
        uuid: SVC_CMD, isPrimary: true,
        characteristics: [
          { uuid: CHR_CMD_TX, properties: props({ write: true, writeNoResponse: true }) },
          { uuid: CHR_CMD_RX, properties: props({ read: true, notify: true }) },
        ],
      },
      {
        uuid: SVC_DIS, isPrimary: true,
        characteristics: [
          { uuid: CHR_MANUF, properties: props({ read: true }) },
          { uuid: CHR_FW, properties: props({ read: true }) },
        ],
      },
      {
        uuid: SVC_BAT, isPrimary: true,
        characteristics: [{ uuid: CHR_BAT, properties: props({ read: true, notify: true }) }],
      },
    ],
    rules: [
      { id: 'demo.getInfo', name: 'device.getInfo', serviceUUID: SVC_CMD, characteristicUUID: CHR_CMD_TX, matchHex: 'AA 01', responseCharacteristicUUID: CHR_CMD_RX, responseHex: 'AA 81 03 01 00 10 39', delayMs: 120 },
      { id: 'demo.setConfig', name: 'device.setConfig', serviceUUID: SVC_CMD, characteristicUUID: CHR_CMD_TX, matchHex: 'AA 02', responseCharacteristicUUID: CHR_CMD_RX, responseHex: 'AA 82 01 00 2D', delayMs: 80 },
      { id: 'demo.reboot', name: 'device.reboot', serviceUUID: SVC_CMD, characteristicUUID: CHR_CMD_TX, matchHex: 'AA 03', responseCharacteristicUUID: CHR_CMD_RX, responseHex: 'AA 83 00 2D', delayMs: 300 },
      { id: 'demo.nack', name: 'device.unknownCommand', serviceUUID: SVC_CMD, characteristicUUID: CHR_CMD_TX, matchHex: 'AA', responseCharacteristicUUID: CHR_CMD_RX, responseHex: 'AA FF 01 EE 98', delayMs: 60 },
    ],
    periodic: [
      { name: 'device.event', serviceUUID: SVC_CMD, characteristicUUID: CHR_CMD_RX, hex: 'AA E1 02 01 64 52', intervalMs: 5000 },
      { name: 'battery.level', serviceUUID: SVC_BAT, characteristicUUID: CHR_BAT, hex: '64', intervalMs: 10000 },
    ],
    readValues: {
      [key(SVC_CMD, CHR_CMD_RX)]: 'AA E1 02 01 64 52',
      [key(SVC_DIS, CHR_MANUF)]: '41 43 4D 45',
      [key(SVC_DIS, CHR_FW)]: '31 2E 30 2E 30',
      [key(SVC_BAT, CHR_BAT)]: '64',
    },
  }
}

function propsFromList(list: string[]): BleCharacteristic['properties'] {
  const up = list.map((p) => p.toUpperCase().replace(/\s+/g, '_'))
  return props({
    read: up.includes('READ'),
    write: up.includes('WRITE'),
    writeNoResponse: up.includes('WRITE_NR') || up.includes('WRITENORESPONSE') || up.includes('WRITE_NO_RESPONSE'),
    notify: up.includes('NOTIFY'),
    indicate: up.includes('INDICATE'),
  })
}

function parseEverySeconds(text: string | undefined): number | null {
  const m = (text ?? '').match(/every\s+(\d+(?:\.\d+)?)\s*(ms|s)?/i)
  if (!m) return null
  const n = parseFloat(m[1])
  return m[2]?.toLowerCase() === 'ms' ? n : n * 1000
}

function parseDelayMs(text: string | undefined, fallback: number): number {
  const m = (text ?? '').match(/(\d+)\s*ms/i)
  return m ? parseInt(m[1], 10) : fallback
}

/**
 * 从集合生成 Mock 设备：
 *   - 拓扑快照 → 服务/特征值
 *   - 命令（payload + responseExample）→ 写入应答规则；配对样例 → 规则
 *   - READ 命令 / 无请求接口 的 responseExample → 可读值；mockRule 含 "every Ns" → 周期通知
 * 无拓扑或无任何规则时返回 null
 */
export function buildMockSpecFromCollection(col: BleCollection): MockDeviceSpec | null {
  if (!col.topology?.length) return null
  const services: MockServiceSpec[] = col.topology
    .filter((s) => s.characteristics.length)
    .map((s) => ({
      uuid: s.uuid,
      isPrimary: s.isPrimary !== false,
      characteristics: s.characteristics.map((c) => ({ uuid: c.uuid, properties: propsFromList(c.properties) })),
    }))
  if (!services.length) return null

  const findNotifyChar = (svcUUID: string, exclude: string): string | null => {
    const svc = services.find((s) => normalizeUUID(s.uuid) === normalizeUUID(svcUUID))
    const c = svc?.characteristics.find((ch) => (ch.properties.notify || ch.properties.indicate) && normalizeUUID(ch.uuid) !== normalizeUUID(exclude))
    return c?.uuid ?? null
  }
  const hasNotify = (svcUUID: string, chrUUID: string): boolean => {
    const svc = services.find((s) => normalizeUUID(s.uuid) === normalizeUUID(svcUUID))
    const c = svc?.characteristics.find((ch) => normalizeUUID(ch.uuid) === normalizeUUID(chrUUID))
    return !!(c && (c.properties.notify || c.properties.indicate))
  }

  const rules: MockRule[] = []
  const periodic: MockPeriodic[] = []
  const readValues: Record<string, string> = {}
  const vars: Record<string, string> = {}
  for (const v of col.variables ?? []) vars[v.name] = v.value

  for (const ch of Object.values(col.characteristics)) {
    for (const op of ch.operations ?? []) {
      const respHex = (op.responseExample ?? '').trim()
      const action = op.actionType ?? ((op.request ?? '').toUpperCase() === 'READ' ? 'read' : 'write')
      if (action === 'read') {
        if (respHex) readValues[key(ch.serviceUUID, ch.uuid)] = respHex
        continue
      }
      let reqHex = operationPayload(op)
      if (!reqHex && (op.request ?? '').toUpperCase() === 'NONE') {
        // 无请求的事件型接口：周期通知 / 可读值
        if (respHex) {
          // 事件型接口若被标注在写特征值上，周期通知改走同服务的 Notify 特征值
          const eventChar = hasNotify(ch.serviceUUID, ch.uuid) ? ch.uuid : (findNotifyChar(ch.serviceUUID, '') ?? ch.uuid)
          readValues[key(ch.serviceUUID, eventChar)] = respHex
          const every = parseEverySeconds(op.mockRule)
          if (every) periodic.push({ name: op.operationId || op.name, serviceUUID: ch.serviceUUID, characteristicUUID: eventChar, hex: respHex, intervalMs: every })
        }
        continue
      }
      if (!reqHex || !respHex) continue
      if (hasTemplateTokens(reqHex)) {
        const r = renderPayloadTemplate(reqHex, { variables: vars, seq: 0 })
        if (!r.ok) continue
        // 模板命令按前两个字节匹配（校验/序号位不参与）
        reqHex = r.hex.split(' ').slice(0, 2).join(' ')
      }
      const respChar = op.expect?.responseCharacteristicUUID || findNotifyChar(ch.serviceUUID, ch.uuid) || ch.uuid
      rules.push({
        id: `col.${op.id}`,
        name: op.operationId || op.name,
        serviceUUID: ch.serviceUUID,
        characteristicUUID: ch.uuid,
        matchHex: reqHex,
        responseCharacteristicUUID: respChar,
        responseHex: respHex,
        delayMs: parseDelayMs(op.mockRule, 100),
      })
    }
  }

  for (const ex of col.examples ?? []) {
    if (!ex.request?.hex || !ex.response?.hex) continue
    rules.push({
      id: `ex.${ex.id}`,
      name: ex.name,
      serviceUUID: ex.serviceUUID,
      characteristicUUID: ex.characteristicUUID,
      matchHex: ex.mock?.match || ex.request.hex,
      responseCharacteristicUUID: ex.response.characteristicUUID || findNotifyChar(ex.serviceUUID, ex.characteristicUUID) || ex.characteristicUUID,
      responseHex: ex.response.hex,
      delayMs: ex.mock?.delayMs ?? (ex.response.rttMs ? Math.min(ex.response.rttMs, 2000) : 100),
    })
  }

  if (!rules.length && !Object.keys(readValues).length && !periodic.length) return null
  return {
    deviceId: `${MOCK_ID_PREFIX}${col.id}`,
    name: `${col.name} (Mock)`,
    rssi: -58,
    mtu: 185,
    services,
    rules,
    periodic,
    readValues,
    collectionId: col.id,
  }
}

/** 演示设备 + 所有可生成 Mock 的用户集合 */
export function buildAllMockSpecs(): MockDeviceSpec[] {
  const specs: MockDeviceSpec[] = [buildDemoDeviceSpec()]
  for (const col of listCollections()) {
    const spec = buildMockSpecFromCollection(col)
    if (spec) specs.push(spec)
  }
  return specs
}

// ── Provider ────────────────────────────────────────────────────────────────

type DataListener = (deviceId: string, serviceId: string, characteristicId: string, value: ArrayBuffer) => void
type ConnectionListener = (deviceId: string, connected: boolean) => void

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
}

interface DeviceRuntime {
  spec: MockDeviceSpec
  connected: boolean
  notify: Set<string>
  timers: Set<ReturnType<typeof setTimeout>>
  intervals: Map<string, ReturnType<typeof setInterval>>
  values: Record<string, string>
  rssi: number
  battery: number
}

export class MockBleProvider {
  private devices = new Map<string, DeviceRuntime>()
  dataListener: DataListener | null = null
  connectionListener: ConnectionListener | null = null
  /** 连接耗时（测试可调小） */
  connectDelayMs = 250

  setSpecs(specs: MockDeviceSpec[]): void {
    const keep = new Set(specs.map((s) => s.deviceId))
    for (const [id, rt] of this.devices) {
      if (!keep.has(id)) {
        this.clearTimers(rt)
        this.devices.delete(id)
      }
    }
    for (const spec of specs) {
      const existing = this.devices.get(spec.deviceId)
      if (existing) {
        existing.spec = spec
        continue
      }
      this.devices.set(spec.deviceId, {
        spec,
        connected: false,
        notify: new Set(),
        timers: new Set(),
        intervals: new Map(),
        values: { ...spec.readValues },
        rssi: spec.rssi,
        battery: 100,
      })
    }
  }

  has(deviceId: string): boolean {
    return this.devices.has(deviceId)
  }

  listDevices(): BleDevice[] {
    return Array.from(this.devices.values()).map((rt) => this.toDevice(rt))
  }

  deviceFor(deviceId: string): BleDevice | null {
    const rt = this.devices.get(deviceId)
    return rt ? this.toDevice(rt) : null
  }

  private toDevice(rt: DeviceRuntime): BleDevice {
    return {
      deviceId: rt.spec.deviceId,
      name: rt.spec.name,
      localName: rt.spec.name,
      RSSI: rt.rssi,
      advertisServiceUUIDs: rt.spec.services.map((s) => s.uuid),
      connectable: true,
    }
  }

  isConnected(deviceId: string): boolean {
    return this.devices.get(deviceId)?.connected === true
  }

  async connect(deviceId: string): Promise<void> {
    const rt = this.devices.get(deviceId)
    if (!rt) throw { code: 10002, message: 'mock device not found' }
    await new Promise((r) => setTimeout(r, this.connectDelayMs))
    rt.connected = true
    rt.values = { ...rt.spec.readValues }
  }

  async disconnect(deviceId: string): Promise<void> {
    const rt = this.devices.get(deviceId)
    if (!rt) return
    this.clearTimers(rt)
    rt.connected = false
    rt.notify.clear()
  }

  async getServices(deviceId: string): Promise<BleService[]> {
    const rt = this.requireConnected(deviceId)
    return rt.spec.services.map((s) => ({ uuid: s.uuid, isPrimary: s.isPrimary }))
  }

  async getCharacteristics(deviceId: string, serviceId: string): Promise<BleCharacteristic[]> {
    const rt = this.requireConnected(deviceId)
    const svc = rt.spec.services.find((s) => normalizeUUID(s.uuid) === normalizeUUID(serviceId))
    if (!svc) throw { code: 10004, message: 'service not found' }
    return svc.characteristics.map((c) => ({ uuid: c.uuid, serviceUUID: svc.uuid, properties: { ...c.properties } }))
  }

  async setNotify(deviceId: string, serviceId: string, characteristicId: string, enable: boolean): Promise<void> {
    const rt = this.requireConnected(deviceId)
    const k = key(serviceId, characteristicId)
    if (enable) {
      rt.notify.add(k)
      for (const p of rt.spec.periodic) {
        if (key(p.serviceUUID, p.characteristicUUID) !== k || rt.intervals.has(k + '::' + p.name)) continue
        const timer = setInterval(() => {
          if (!rt.connected || !rt.notify.has(k)) return
          let hex = p.hex
          if (normalizeUUID(p.characteristicUUID) === normalizeUUID(CHR_BAT)) {
            rt.battery = Math.max(5, rt.battery - 1)
            hex = rt.battery.toString(16).toUpperCase().padStart(2, '0')
            rt.values[k] = hex
          }
          this.emit(deviceId, p.serviceUUID, p.characteristicUUID, hex)
        }, p.intervalMs)
        rt.intervals.set(k + '::' + p.name, timer)
      }
    } else {
      rt.notify.delete(k)
      for (const [ik, timer] of rt.intervals) {
        if (ik.startsWith(k + '::')) {
          clearInterval(timer)
          rt.intervals.delete(ik)
        }
      }
    }
  }

  async read(deviceId: string, serviceId: string, characteristicId: string): Promise<ArrayBuffer> {
    const rt = this.requireConnected(deviceId)
    const k = key(serviceId, characteristicId)
    const hex = rt.values[k] ?? '00'
    const buf = toArrayBuffer(hexToBytes(hex))
    // 与真实平台一致：读取结果通过特征值变化回调送达
    setTimeout(() => this.emit(deviceId, serviceId, characteristicId, hex), 20)
    return buf
  }

  async write(deviceId: string, serviceId: string, characteristicId: string, value: ArrayBuffer): Promise<void> {
    const rt = this.requireConnected(deviceId)
    const reqHex = bytesToHex(new Uint8Array(value))
    const reqClean = reqHex.replace(/\s+/g, '')
    const k = key(serviceId, characteristicId)
    rt.values[k] = reqHex

    // 规则：同端点、前缀匹配，最长前缀优先
    let best: MockRule | null = null
    let bestLen = -1
    for (const rule of rt.spec.rules) {
      if (key(rule.serviceUUID, rule.characteristicUUID) !== k) continue
      const m = rule.matchHex.replace(/[^0-9a-fA-F]/g, '').toUpperCase()
      if (m && !reqClean.startsWith(m)) continue
      if (m.length > bestLen) {
        best = rule
        bestLen = m.length
      }
    }
    if (best) {
      const rule = best
      const rk = key(rule.serviceUUID, rule.responseCharacteristicUUID)
      const timer = setTimeout(() => {
        rt.timers.delete(timer)
        rt.values[rk] = rule.responseHex
        if (rt.notify.has(rk)) this.emit(deviceId, rule.serviceUUID, rule.responseCharacteristicUUID, rule.responseHex)
      }, rule.delayMs)
      rt.timers.add(timer)
      return
    }
    if (rt.spec.echo) {
      const ek = key(rt.spec.echo.serviceUUID, rt.spec.echo.characteristicUUID)
      const timer = setTimeout(() => {
        rt.timers.delete(timer)
        rt.values[ek] = reqHex
        if (rt.notify.has(ek)) this.emit(deviceId, rt.spec.echo!.serviceUUID, rt.spec.echo!.characteristicUUID, reqHex)
      }, 30)
      rt.timers.add(timer)
    }
  }

  async getRSSI(deviceId: string): Promise<number> {
    const rt = this.requireConnected(deviceId)
    rt.rssi = Math.max(-95, Math.min(-35, rt.rssi + Math.round((Math.random() - 0.5) * 6)))
    return rt.rssi
  }

  async negotiateMTU(deviceId: string, mtu: number): Promise<number> {
    const rt = this.requireConnected(deviceId)
    return Math.max(23, Math.min(mtu, rt.spec.mtu))
  }

  /** 模拟设备主动断开（测试连接丢失路径） */
  simulateDrop(deviceId: string): void {
    const rt = this.devices.get(deviceId)
    if (!rt || !rt.connected) return
    this.clearTimers(rt)
    rt.connected = false
    rt.notify.clear()
    this.connectionListener?.(deviceId, false)
  }

  private requireConnected(deviceId: string): DeviceRuntime {
    const rt = this.devices.get(deviceId)
    if (!rt || !rt.connected) throw { code: 10006, message: 'mock device not connected' }
    return rt
  }

  private emit(deviceId: string, serviceId: string, characteristicId: string, hex: string) {
    this.dataListener?.(deviceId, serviceId, characteristicId, toArrayBuffer(hexToBytes(hex)))
  }

  private clearTimers(rt: DeviceRuntime) {
    rt.timers.forEach((t) => clearTimeout(t))
    rt.timers.clear()
    rt.intervals.forEach((t) => clearInterval(t))
    rt.intervals.clear()
  }
}

export const mockBle = new MockBleProvider()
