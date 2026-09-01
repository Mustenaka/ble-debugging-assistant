import { defineStore } from 'pinia'
import { ref, computed, reactive, toRaw } from 'vue'
import {
  bleManager,
  BleAdapterState,
  BleDeviceState,
  type BleDevice,
  type BleService,
  type BleCharacteristic,
} from '../services/bleManager'
import { bufToHex, bufToAscii, shortUUID, hexToBuf, asciiToBuf, normalizeUUID } from '../utils/hex'
import {
  RingBuffer,
  type LogEntry,
  type QuickCommand,
  type BleProtocolSample,
  loadQuickCommands,
  saveQuickCommands,
  saveRecentDevice,
  loadRecentDevices,
  loadProtocolSamples,
  saveProtocolSample,
  type RecentDevice,
} from '../utils/buffer'
import {
  beginSessionRecord,
  recordSessionLog,
  recordSessionRssi,
  recordSessionMtu,
  recordSessionHeartbeat,
  endSessionRecord,
  flushAllSessionRecords,
  operationPayload,
  operationRunKey,
  appendOperationRun,
  type OperationAnnotation,
  type OperationRunRecord,
} from '../utils/deviceArchive'
import {
  HEARTBEAT_LABEL,
  HEARTBEAT_ACK_LABEL,
  createHeartbeatRuntime,
  saveHeartbeatConfig,
  heartbeatLossPercent,
  type HeartbeatConfig,
  type HeartbeatRuntime,
} from '../utils/heartbeat'

export type DisplayMode = 'hex' | 'ascii'

/** 正在等待响应判定的命令执行 */
export interface PendingOpRun {
  runKey: string
  op: OperationAnnotation
  serviceUUID: string
  characteristicUUID: string
  requestHex: string
  variantLabel?: string
  sentAt: number
  timeoutTimer: ReturnType<typeof setTimeout> | null
  resolve: (record: OperationRunRecord) => void
}

// ─── DeviceSession：每设备独立数据容器 ──────────────────────────────────────

export interface DeviceSession {
  device: BleDevice
  deviceState: BleDeviceState
  services: BleService[]
  characteristics: Map<string, BleCharacteristic[]>
  logBuffer: RingBuffer<LogEntry>
  logs: LogEntry[]
  txBytes: number
  rxBytes: number
  rssiHistory: { time: number; rssi: number }[]
  rssiPollTimer: ReturnType<typeof setInterval> | null
  charValueHistory: Record<string, { time: number; hex: string }[]>
  savedSamples: BleProtocolSample[]
  currentMtu: number
  activeServiceId: string
  activeCharacteristicId: string
  notifyEnabled: boolean
  rxDisplayMode: DisplayMode
  txDisplayMode: DisplayMode
  heartbeat: HeartbeatRuntime
  pendingOpRun: PendingOpRun | null
  /** 命令执行互斥：从进入 runOperation 到判定结束（含 await 间隙） */
  opRunBusy: boolean
}

function createSession(device: BleDevice): DeviceSession {
  return {
    device,
    deviceState: BleDeviceState.CONNECTED,
    services: [],
    characteristics: new Map(),
    logBuffer: new RingBuffer<LogEntry>(2000),
    logs: [],
    txBytes: 0,
    rxBytes: 0,
    rssiHistory: [],
    rssiPollTimer: null,
    charValueHistory: {},
    savedSamples: loadProtocolSamples(device.deviceId),
    currentMtu: 23,
    activeServiceId: '',
    activeCharacteristicId: '',
    notifyEnabled: false,
    rxDisplayMode: 'hex',
    txDisplayMode: 'hex',
    // reactive: 心跳统计需要在 UI 中实时刷新
    heartbeat: reactive(createHeartbeatRuntime()),
    pendingOpRun: null,
    opRunBusy: false,
  }
}

// ─── BLE Store ───────────────────────────────────────────────────────────────

export const useBleStore = defineStore('ble', () => {

  // ── 适配器层（共享）──────────────────────────────────────────────────────

  const adapterState = ref<BleAdapterState>(BleAdapterState.UNINITIALIZED)
  const scannedDevices = ref<BleDevice[]>([])
  const filterName = ref<string>('')
  const filterMinRssi = ref<number>(-100)
  const isConnecting = ref<boolean>(false)
  const errorMessage = ref<string>('')

  // 快捷命令（全局，不依附于某设备）
  const quickCommands = ref<QuickCommand[]>(loadQuickCommands())
  // 最近设备
  const recentDevices = ref<RecentDevice[]>(loadRecentDevices())

  // ── 多设备会话层 ──────────────────────────────────────────────────────────

  // 使用 ref<Map> 以便 Vue 追踪到 Map 本身被替换
  const sessions = ref<Map<string, DeviceSession>>(new Map())
  const activeSessionId = ref<string>('')

  // ── 计算属性：适配器层 ────────────────────────────────────────────────────

  const isScanning = computed(() => adapterState.value === BleAdapterState.SCANNING)
  const isReady = computed(() => adapterState.value !== BleAdapterState.UNINITIALIZED)
  const hasConnections = computed(() => sessions.value.size > 0)

  const filteredDevices = computed(() => {
    return scannedDevices.value.filter((d) => {
      const nameOk = !filterName.value || d.name.toLowerCase().includes(filterName.value.toLowerCase())
      const rssiOk = d.RSSI >= filterMinRssi.value
      return nameOk && rssiOk
    })
  })

  // ── 计算属性：活跃会话代理 ────────────────────────────────────────────────

  const activeSession = computed<DeviceSession | null>(() => {
    if (!activeSessionId.value) return null
    return sessions.value.get(activeSessionId.value) ?? null
  })

  // 以下全部代理到 activeSession，与原单设备接口保持兼容
  const connectedDevice = computed(() => activeSession.value?.device ?? null)
  const isConnected = computed(() => activeSession.value?.deviceState === BleDeviceState.CONNECTED)
  const services = computed(() => activeSession.value?.services ?? [])
  const characteristics = computed(() => activeSession.value?.characteristics ?? new Map<string, BleCharacteristic[]>())
  const logs = computed(() => activeSession.value?.logs ?? [])
  const txBytes = computed(() => activeSession.value?.txBytes ?? 0)
  const rxBytes = computed(() => activeSession.value?.rxBytes ?? 0)
  const rssiHistory = computed(() => activeSession.value?.rssiHistory ?? [])
  const charValueHistory = computed(() => activeSession.value?.charValueHistory ?? {})
  const savedSamples = computed(() => activeSession.value?.savedSamples ?? [])
  const currentMtu = computed(() => activeSession.value?.currentMtu ?? 23)
  const activeServiceId = computed(() => activeSession.value?.activeServiceId ?? '')
  const activeCharacteristicId = computed(() => activeSession.value?.activeCharacteristicId ?? '')
  const notifyEnabled = computed(() => activeSession.value?.notifyEnabled ?? false)
  const rxDisplayMode = computed(() => activeSession.value?.rxDisplayMode ?? 'hex')
  const txDisplayMode = computed(() => activeSession.value?.txDisplayMode ?? 'hex')

  const activeCharacteristics = computed(() => {
    const svcId = activeSession.value?.activeServiceId
    if (!svcId) return []
    return activeSession.value?.characteristics.get(svcId) ?? []
  })

  const activeCharacteristic = computed(() => {
    const charId = activeSession.value?.activeCharacteristicId
    return activeCharacteristics.value.find((c) => c.uuid === charId) ?? null
  })

  const activeHeartbeat = computed<HeartbeatRuntime | null>(() => activeSession.value?.heartbeat ?? null)

  // ── 内部辅助：获取可写会话 ───────────────────────────────────────────────

  function getSession(deviceId: string): DeviceSession | null {
    return sessions.value.get(deviceId) ?? null
  }

  function getActiveSessionMut(): DeviceSession | null {
    if (!activeSessionId.value) return null
    return sessions.value.get(activeSessionId.value) ?? null
  }

  function triggerSessionUpdate() {
    // 触发 Map ref 响应式更新
    sessions.value = new Map(sessions.value)
  }

  // ── 初始化 & 全局监听 ─────────────────────────────────────────────────────

  function init() {
    bleManager.onAdapterStateChange((s) => {
      adapterState.value = s
    })

    bleManager.onDeviceFound((devices) => {
      scannedDevices.value = devices
    })

    bleManager.onDataReceived((deviceId, serviceId, characteristicId, value) => {
      const session = getSession(deviceId)
      if (!session) return
      session.rxBytes += value.byteLength
      const hex = bufToHex(value)
      const entry: LogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        direction: 'RX',
        hex,
        ascii: bufToAscii(value),
        rawLength: value.byteLength,
        label: `${shortUUID(serviceId)} / ${shortUUID(characteristicId)}`,
        serviceUUID: serviceId,
        characteristicUUID: characteristicId,
      }
      const consumedByOpRun = _matchOpRunResponse(deviceId, session, characteristicId, hex, entry)
      if (!consumedByOpRun) _matchHeartbeatAck(deviceId, session, characteristicId, hex, entry)
      session.logBuffer.push(entry)
      session.logs = session.logBuffer.getAll()
      recordSessionLog(deviceId, entry)
      _addCharHistory(session, characteristicId, hex)
      triggerSessionUpdate()
    })

    bleManager.onConnectionChange((deviceId, connected) => {
      if (!connected) {
        const session = getSession(deviceId)
        if (!session) return
        stopHeartbeatTest(deviceId, true)
        _cancelPendingOpRun(deviceId, session, 'disconnected')
        _addSysLogToSession(session, `设备断开连接: ${session.device.name}`)
        endSessionRecord(deviceId, 'lost')
        _stopRssiPoll(session)
        session.deviceState = BleDeviceState.DISCONNECTED
        // 断开后从 sessions 中移除
        sessions.value.delete(deviceId)
        // 若当前活跃会话断开，切换到其他会话
        if (activeSessionId.value === deviceId) {
          const remaining = Array.from(sessions.value.keys())
          activeSessionId.value = remaining[0] ?? ''
        }
        triggerSessionUpdate()
      }
    })
  }

  // ── 扫描操作 ─────────────────────────────────────────────────────────────

  async function startScan(timeoutMs?: number) {
    try {
      errorMessage.value = ''
      // 保留已连接设备的扫描条目，只清除未连接设备（避免重新扫描时丢失已连接设备信息）
      const connectedIds = new Set(sessions.value.keys())
      scannedDevices.value = scannedDevices.value.filter(d => connectedIds.has(d.deviceId))
      await bleManager.startScan({ timeoutMs })
    } catch (e: any) {
      errorMessage.value = e.message ?? '扫描失败'
      throw e
    }
  }

  async function stopScan() {
    await bleManager.stopScan()
  }

  // ── 连接操作 ─────────────────────────────────────────────────────────────

  async function connectDevice(device: BleDevice) {
    // 已连接的设备：切换到其 session 即可
    if (bleManager.isDeviceConnected(device.deviceId)) {
      activeSessionId.value = device.deviceId
      return
    }

    isConnecting.value = true
    errorMessage.value = ''
    try {
      await bleManager.connect(device.deviceId)
      // 创建新 session
      const session = createSession(device)
      sessions.value.set(device.deviceId, session)
      activeSessionId.value = device.deviceId
      beginSessionRecord(device.deviceId, device.name)
      triggerSessionUpdate()

      saveRecentDevice({ deviceId: device.deviceId, name: device.name, lastConnected: Date.now() })
      recentDevices.value = loadRecentDevices()
      _addSysLogToSession(session, `已连接: ${device.name} (${device.deviceId})`)
      await loadDeviceServices(device.deviceId)
      _startRssiPoll(device.deviceId)
    } catch (e: any) {
      errorMessage.value = e.message ?? '连接失败'
      throw e
    } finally {
      isConnecting.value = false
    }
  }

  async function disconnectDevice(deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    if (!id) return
    const session = getSession(id)
    const name = session?.device.name ?? id
    if (session) _stopRssiPoll(session)
    stopHeartbeatTest(id, true)
    if (session) _cancelPendingOpRun(id, session, 'disconnected')
    endSessionRecord(id, 'user')
    try {
      await bleManager.disconnect(id)
    } catch {
      // 强制清理本地状态
    }
    sessions.value.delete(id)
    if (activeSessionId.value === id) {
      const remaining = Array.from(sessions.value.keys())
      activeSessionId.value = remaining[0] ?? ''
    }
    triggerSessionUpdate()
    _addSysLogToAll(`已断开: ${name}`)
  }

  function switchSession(deviceId: string) {
    if (sessions.value.has(deviceId)) {
      activeSessionId.value = deviceId
    }
  }

  // ── 服务 & 特征值 ────────────────────────────────────────────────────────

  async function loadDeviceServices(deviceId: string) {
    const session = getSession(deviceId)
    if (!session) return
    const svcs = await bleManager.getServices(deviceId)
    session.services = svcs
    session.characteristics = new Map()
    triggerSessionUpdate()
  }

  async function loadCharacteristics(serviceId: string, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (!session) return
    const chars = await bleManager.getCharacteristics(id, serviceId)
    session.characteristics.set(serviceId, chars)
    session.activeServiceId = serviceId
    triggerSessionUpdate()
  }

  function selectCharacteristic(charId: string, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (session) {
      session.activeCharacteristicId = charId
      triggerSessionUpdate()
    }
  }

  // ── Notify ────────────────────────────────────────────────────────────────

  async function toggleNotify(enable: boolean, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (!session || !session.activeServiceId || !session.activeCharacteristicId) return
    await bleManager.setNotify(id, session.activeServiceId, session.activeCharacteristicId, enable)
    session.notifyEnabled = enable
    _addSysLogToSession(session, `Notify ${enable ? '已开启' : '已关闭'}: ${shortUUID(session.activeCharacteristicId)}`)
    triggerSessionUpdate()
  }

  // ── 发送数据 ──────────────────────────────────────────────────────────────

  async function sendData(data: ArrayBuffer, chunked = true, label?: string) {
    const session = getActiveSessionMut()
    if (!session || !session.activeServiceId || !session.activeCharacteristicId) {
      throw new Error('未选择发送目标')
    }
    const deviceId = session.device.deviceId
    if (chunked) {
      await bleManager.writeChunked(deviceId, session.activeServiceId, session.activeCharacteristicId, data)
    } else {
      await bleManager.write(deviceId, session.activeServiceId, session.activeCharacteristicId, data)
    }
    session.txBytes += data.byteLength
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      direction: 'TX',
      hex: bufToHex(data),
      ascii: bufToAscii(data),
      rawLength: data.byteLength,
      label,
      serviceUUID: session.activeServiceId,
      characteristicUUID: session.activeCharacteristicId,
    }
    session.logBuffer.push(entry)
    session.logs = session.logBuffer.getAll()
    recordSessionLog(deviceId, entry)
    triggerSessionUpdate()
  }

  // ── 日志操作 ──────────────────────────────────────────────────────────────

  function addSysLog(message: string, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (session) {
      _addSysLogToSession(session, message)
      triggerSessionUpdate()
    }
  }

  function clearLogs(deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (session) {
      session.logBuffer.clear()
      session.logs = []
      session.txBytes = 0
      session.rxBytes = 0
      triggerSessionUpdate()
    }
  }

  function saveLogAsProtocolSample(logId: string, name?: string, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (!session) return null
    const entry = session.logs.find((log) => log.id === logId)
    if (!entry || entry.direction === 'SYS' || !entry.serviceUUID || !entry.characteristicUUID) return null
    const sample: BleProtocolSample = {
      id: `sample_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      deviceId: session.device.deviceId,
      serviceUUID: entry.serviceUUID,
      characteristicUUID: entry.characteristicUUID,
      direction: entry.direction,
      name: name?.trim() || `${entry.direction} ${shortUUID(entry.characteristicUUID)} ${session.savedSamples.length + 1}`,
      hex: entry.hex,
      ascii: entry.ascii,
      rawLength: entry.rawLength,
      timestamp: Date.now(),
      sourceLogId: entry.id,
      operationId: entry.operationId,
    }
    session.savedSamples = saveProtocolSample(sample)
    triggerSessionUpdate()
    return sample
  }

  // ── 快捷命令 ──────────────────────────────────────────────────────────────

  function addQuickCommand(cmd: Omit<QuickCommand, 'id'>) {
    const newCmd: QuickCommand = {
      ...cmd,
      id: `qc_${Date.now()}`,
      commandType: cmd.commandType ?? 'custom',
      description: cmd.description ?? '',
    }
    quickCommands.value.unshift(newCmd)
    saveQuickCommands(quickCommands.value)
  }

  function removeQuickCommand(id: string) {
    quickCommands.value = quickCommands.value.filter((c) => c.id !== id)
    saveQuickCommands(quickCommands.value)
  }

  // ── MTU 协商 ──────────────────────────────────────────────────────────────

  async function negotiateMtu(mtu: number, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (!session) return
    const actual = await bleManager.negotiateMTU(id, mtu)
    session.currentMtu = actual
    recordSessionMtu(id, actual)
    triggerSessionUpdate()
    return actual
  }

  function _cleanHexStr(s: string): string {
    return s.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
  }

  // ── 命令执行引擎（Runnable Operation，Postman 式）─────────────────────────

  /** 字段级断言：响应 offset 处的字节序列应等于 hexValue；返回失败原因或 null */
  function _checkFieldAssertions(responseHex: string, op: OperationAnnotation): string | null {
    const assertions = op.expect?.fieldAssertions ?? []
    if (!assertions.length) return null
    const bytes = _cleanHexStr(responseHex).match(/.{2}/g) ?? []
    for (const a of assertions) {
      const expected = _cleanHexStr(a.hexValue).match(/.{2}/g) ?? []
      if (!expected.length) continue
      for (let i = 0; i < expected.length; i++) {
        const actual = bytes[a.offset + i]
        if (actual !== expected[i]) {
          return `offset ${a.offset + i}: expect ${expected[i]} got ${actual ?? '∅'}`
        }
      }
    }
    return null
  }

  function _finishOpRun(deviceId: string, session: DeviceSession, record: OperationRunRecord) {
    const pending = session.pendingOpRun
    if (!pending) return
    if (pending.timeoutTimer) {
      clearTimeout(pending.timeoutTimer)
      pending.timeoutTimer = null
    }
    session.pendingOpRun = null
    session.opRunBusy = false
    appendOperationRun(deviceId, pending.runKey, record)
    pending.resolve(record)
    triggerSessionUpdate()
  }

  function _cancelPendingOpRun(deviceId: string, session: DeviceSession, reason: string) {
    const pending = session.pendingOpRun
    if (!pending) return
    _finishOpRun(deviceId, session, {
      timestamp: Date.now(),
      requestHex: pending.requestHex,
      responseHex: null,
      rttMs: null,
      result: 'error',
      reason,
      variantLabel: pending.variantLabel,
    })
  }

  /** RX 是否被待判定命令消费（是则改写日志标签并出结果） */
  function _matchOpRunResponse(
    deviceId: string,
    session: DeviceSession,
    characteristicId: string,
    hex: string,
    entry: LogEntry,
  ): boolean {
    const pending = session.pendingOpRun
    if (!pending) return false
    const expect = pending.op.expect
    if (!expect?.enabled) return false
    // READ 动作未指定响应特征值时，默认以被读特征值判定
    const expectedChar = expect.responseCharacteristicUUID ||
      ((pending.op.actionType === 'read' && pending.characteristicUUID) ? pending.characteristicUUID : '')
    if (expectedChar && normalizeUUID(expectedChar) !== normalizeUUID(characteristicId)) return false
    if (expect.matchHex && !_cleanHexStr(hex).startsWith(_cleanHexStr(expect.matchHex))) return false

    const rtt = Date.now() - pending.sentAt
    const assertionFailure = _checkFieldAssertions(hex, pending.op)
    const result: OperationRunRecord['result'] = assertionFailure ? 'fail' : 'pass'
    entry.operationId = pending.op.operationId || pending.op.id
    entry.label = assertionFailure
      ? `${pending.op.name} · FAIL · ${assertionFailure}`
      : `${pending.op.name} · PASS · ${rtt}ms`
    _finishOpRun(deviceId, session, {
      timestamp: Date.now(),
      requestHex: pending.requestHex,
      responseHex: hex,
      rttMs: rtt,
      result,
      reason: assertionFailure ?? undefined,
      variantLabel: pending.variantLabel,
    })
    return true
  }

  async function runOperation(params: {
    deviceId?: string
    serviceUUID: string
    characteristicUUID: string
    op: OperationAnnotation
    payloadOverride?: string
    variantLabel?: string
  }): Promise<OperationRunRecord> {
    const id = params.deviceId ?? activeSessionId.value
    const session = getSession(id)
    const now = Date.now()
    const fail = (result: OperationRunRecord['result'], reason: string, requestHex = ''): OperationRunRecord => ({
      timestamp: now, requestHex, responseHex: null, rttMs: null, result, reason,
      variantLabel: params.variantLabel,
    })

    if (!session || !bleManager.isDeviceConnected(id)) return fail('error', 'not-connected')
    if (session.pendingOpRun || session.opRunBusy) return fail('error', 'busy')
    session.opRunBusy = true

    const op = params.op
    const runKey = operationRunKey(params.serviceUUID, params.characteristicUUID, op.id || op.operationId || op.name)
    const actionType = op.actionType ?? 'write'

    try {
      // 确保该服务的特征值已发现（部分平台写前必须 getCharacteristics）
      if (!session.characteristics.get(params.serviceUUID)?.length) {
        try {
          await loadCharacteristics(params.serviceUUID, id)
        } catch { /* 发现失败不阻断执行 */ }
      }

      // 期望响应时自动为响应特征值开启 Notify（若其支持）
      if (op.expect?.enabled) {
        const respChar = op.expect.responseCharacteristicUUID ||
          (actionType === 'read' ? params.characteristicUUID : '')
        if (respChar) {
          for (const [svcUUID, chars] of session.characteristics) {
            const target = chars.find((c) => normalizeUUID(c.uuid) === normalizeUUID(respChar))
            if (target && (target.properties.notify || target.properties.indicate)) {
              try {
                await bleManager.setNotify(id, svcUUID, target.uuid, true)
              } catch { /* 可能已开启 */ }
              break
            }
          }
        }
      }

      // READ 动作：读请求 + 等待特征值变化回调
      if (actionType === 'read') {
        const promise = _armOpExpectation(id, session, runKey, op, '', params.serviceUUID, params.characteristicUUID, params.variantLabel)
        try {
          _addSysLogToSession(session, `▶ ${op.name} (READ ${shortUUID(params.characteristicUUID)})`)
          triggerSessionUpdate()
          await bleManager.readCharacteristic(id, params.serviceUUID, params.characteristicUUID)
        } catch (e: any) {
          if (promise) {
            _cancelPendingOpRun(id, session, e?.message ?? 'read failed')
            return promise
          }
          const record = fail('error', e?.message ?? 'read failed')
          appendOperationRun(id, runKey, record)
          return record
        }
        if (promise) return promise
        const record = { ...fail('sent', ''), reason: undefined }
        appendOperationRun(id, runKey, record)
        triggerSessionUpdate()
        return record
      }

      // WRITE / WRITE_NR 动作
      const payloadStr = (params.payloadOverride ?? '').trim() || operationPayload(op)
      if (!payloadStr) return fail('error', 'empty-payload')
      let buf: ArrayBuffer
      try {
        buf = (op.payloadMode ?? 'hex') === 'hex' ? hexToBuf(payloadStr) : asciiToBuf(payloadStr)
      } catch {
        return fail('error', 'invalid-payload')
      }
      const requestHex = bufToHex(buf)

      const promise = _armOpExpectation(id, session, runKey, op, requestHex, params.serviceUUID, params.characteristicUUID, params.variantLabel)
      try {
        await bleManager.write(id, params.serviceUUID, params.characteristicUUID, buf, actionType === 'write')
      } catch (e: any) {
        _addSysLogToSession(session, `✗ ${op.name} 发送失败: ${e?.message ?? e}`)
        triggerSessionUpdate()
        if (promise) {
          _cancelPendingOpRun(id, session, e?.message ?? 'write failed')
          return promise
        }
        const record = fail('error', e?.message ?? 'write failed', requestHex)
        appendOperationRun(id, runKey, record)
        return record
      }
      session.txBytes += buf.byteLength
      const entry: LogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        direction: 'TX',
        hex: requestHex,
        ascii: bufToAscii(buf),
        rawLength: buf.byteLength,
        label: `▶ ${op.name}${params.variantLabel ? ` [${params.variantLabel}]` : ''}`,
        serviceUUID: params.serviceUUID,
        characteristicUUID: params.characteristicUUID,
        operationId: op.operationId || op.id,
      }
      session.logBuffer.push(entry)
      session.logs = session.logBuffer.getAll()
      recordSessionLog(id, entry)
      triggerSessionUpdate()
      if (promise) return promise
      const record: OperationRunRecord = {
        timestamp: now, requestHex, responseHex: null, rttMs: null, result: 'sent',
        variantLabel: params.variantLabel,
      }
      appendOperationRun(id, runKey, record)
      triggerSessionUpdate()
      return record
    } finally {
      // 有 pending（等待响应判定）时保持互斥，由 _finishOpRun 释放；其余路径立即释放
      if (!session.pendingOpRun) session.opRunBusy = false
    }
  }

  /** 布好期望响应的判定钩子；未启用期望时返回 null */
  function _armOpExpectation(
    deviceId: string,
    session: DeviceSession,
    runKey: string,
    op: OperationAnnotation,
    requestHex: string,
    serviceUUID: string,
    characteristicUUID: string,
    variantLabel?: string,
  ): Promise<OperationRunRecord> | null {
    if (!op.expect?.enabled) return null
    return new Promise<OperationRunRecord>((resolve) => {
      const pending: PendingOpRun = {
        runKey,
        op,
        serviceUUID,
        characteristicUUID,
        requestHex,
        variantLabel,
        sentAt: Date.now(),
        timeoutTimer: null,
        resolve,
      }
      pending.timeoutTimer = setTimeout(() => {
        pending.timeoutTimer = null
        // session 经 Vue reactive 包装，存入的对象取出为 proxy，须比较 raw 身份
        if (toRaw(session.pendingOpRun) !== pending) return
        _addSysLogToSession(session, `⚠ ${op.name} 响应超时 (${op.expect?.timeoutMs ?? 0}ms)`)
        _finishOpRun(deviceId, session, {
          timestamp: Date.now(),
          requestHex,
          responseHex: null,
          rttMs: null,
          result: 'timeout',
          variantLabel,
        })
      }, Math.max(100, op.expect?.timeoutMs ?? 2000))
      session.pendingOpRun = pending
    })
  }

  // ── 心跳持续连接测试（每 session 独立）───────────────────────────────────

  function _matchHeartbeatAck(
    deviceId: string,
    session: DeviceSession,
    characteristicId: string,
    hex: string,
    entry: LogEntry,
  ) {
    const hb = session.heartbeat
    const cfg = hb.config
    if (!hb.running || !cfg || !cfg.expectResponse || hb.pendingSentAt === null) return
    if (
      cfg.responseCharacteristicUUID &&
      normalizeUUID(cfg.responseCharacteristicUUID) !== normalizeUUID(characteristicId)
    ) return
    if (cfg.responseMatchHex && !_cleanHexStr(hex).startsWith(_cleanHexStr(cfg.responseMatchHex))) return

    const rtt = Date.now() - hb.pendingSentAt
    hb.pendingSentAt = null
    if (hb.timeoutTimer) {
      clearTimeout(hb.timeoutTimer)
      hb.timeoutTimer = null
    }
    hb.acked++
    hb.consecutiveMissed = 0
    hb.lastRttMs = rtt
    hb.rttSum += rtt
    hb.rttMinMs = hb.rttMinMs === null ? rtt : Math.min(hb.rttMinMs, rtt)
    hb.rttMaxMs = hb.rttMaxMs === null ? rtt : Math.max(hb.rttMaxMs, rtt)
    hb.rttAvgMs = Math.round(hb.rttSum / hb.acked)
    hb.rttHistory.push({ time: Date.now(), rtt })
    if (hb.rttHistory.length > 60) hb.rttHistory.splice(0, 1)
    entry.label = `${HEARTBEAT_ACK_LABEL} · ${rtt}ms`
    entry.operationId = 'heartbeat'
    recordSessionHeartbeat(deviceId, { type: 'acked', rttMs: rtt })
  }

  async function _heartbeatTick(deviceId: string) {
    const session = getSession(deviceId)
    if (!session) return
    const hb = session.heartbeat
    const cfg = hb.config
    if (!hb.running || !cfg) return
    if (!bleManager.isDeviceConnected(deviceId)) {
      stopHeartbeatTest(deviceId, true)
      return
    }
    let payload: ArrayBuffer
    try {
      payload = cfg.payloadMode === 'hex' ? hexToBuf(cfg.payload) : asciiToBuf(cfg.payload)
    } catch {
      _addSysLogToSession(session, '♥ 心跳内容格式错误，测试已停止')
      stopHeartbeatTest(deviceId)
      return
    }
    try {
      await bleManager.write(deviceId, cfg.serviceUUID, cfg.characteristicUUID, payload, cfg.writeWithResponse)
      hb.sent++
      session.txBytes += payload.byteLength
      const entry: LogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        direction: 'TX',
        hex: bufToHex(payload),
        ascii: bufToAscii(payload),
        rawLength: payload.byteLength,
        label: HEARTBEAT_LABEL,
        serviceUUID: cfg.serviceUUID,
        characteristicUUID: cfg.characteristicUUID,
        operationId: 'heartbeat',
      }
      session.logBuffer.push(entry)
      session.logs = session.logBuffer.getAll()
      recordSessionLog(deviceId, entry)
      recordSessionHeartbeat(deviceId, { type: 'sent' })
      if (cfg.expectResponse) {
        hb.pendingSentAt = Date.now()
        if (hb.timeoutTimer) clearTimeout(hb.timeoutTimer)
        hb.timeoutTimer = setTimeout(() => {
          hb.timeoutTimer = null
          if (!hb.running || hb.pendingSentAt === null) return
          hb.pendingSentAt = null
          hb.missed++
          hb.consecutiveMissed++
          recordSessionHeartbeat(deviceId, { type: 'missed' })
          _addSysLogToSession(session, `♥ 心跳应答超时 #${hb.missed}（连续 ${hb.consecutiveMissed} 次）`)
          triggerSessionUpdate()
        }, Math.min(cfg.timeoutMs, cfg.intervalMs))
      }
      triggerSessionUpdate()
    } catch (e: any) {
      hb.missed++
      hb.consecutiveMissed++
      recordSessionHeartbeat(deviceId, { type: 'missed' })
      _addSysLogToSession(session, `♥ 心跳发送失败: ${e?.message ?? e}`)
      triggerSessionUpdate()
    }
  }

  function startHeartbeatTest(deviceId: string, config: HeartbeatConfig) {
    const session = getSession(deviceId)
    if (!session) return
    stopHeartbeatTest(deviceId, true)
    const hb = session.heartbeat
    Object.assign(hb, createHeartbeatRuntime())
    hb.running = true
    hb.config = { ...config }
    hb.startedAt = Date.now()
    saveHeartbeatConfig(deviceId, config)
    _addSysLogToSession(
      session,
      `♥ 心跳测试开始: ${shortUUID(config.characteristicUUID)} / 每 ${config.intervalMs}ms` +
        (config.expectResponse ? ` / 应答超时 ${config.timeoutMs}ms` : ' / 不校验应答'),
    )
    _heartbeatTick(deviceId)
    hb.timer = setInterval(() => _heartbeatTick(deviceId), config.intervalMs)
    triggerSessionUpdate()
  }

  function stopHeartbeatTest(deviceId?: string, silent = false) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (!session) return
    const hb = session.heartbeat
    if (hb.timer) {
      clearInterval(hb.timer)
      hb.timer = null
    }
    if (hb.timeoutTimer) {
      clearTimeout(hb.timeoutTimer)
      hb.timeoutTimer = null
    }
    hb.pendingSentAt = null
    if (hb.running) {
      hb.running = false
      if (!silent) {
        _addSysLogToSession(
          session,
          `♥ 心跳测试结束: 发 ${hb.sent} / 应 ${hb.acked} / 丢 ${hb.missed} (${heartbeatLossPercent(hb)}%)` +
            (hb.rttAvgMs !== null ? ` / RTT 均值 ${hb.rttAvgMs}ms` : ''),
        )
      }
      triggerSessionUpdate()
    }
  }

  // ── RSSI 轮询（每 session 独立）──────────────────────────────────────────

  function _startRssiPoll(deviceId: string) {
    const session = getSession(deviceId)
    if (!session) return
    _stopRssiPoll(session)
    session.rssiHistory = []
    session.rssiPollTimer = setInterval(async () => {
      const s = getSession(deviceId)
      if (!s || !bleManager.isDeviceConnected(deviceId)) {
        if (s) _stopRssiPoll(s)
        return
      }
      try {
        const rssi = await bleManager.getRSSI(deviceId)
        recordSessionRssi(deviceId, rssi)
        s.rssiHistory.push({ time: Date.now(), rssi })
        if (s.rssiHistory.length > 60) s.rssiHistory.splice(0, 1)
        s.device = { ...s.device, RSSI: rssi }
        triggerSessionUpdate()
      } catch {
        // 静默处理
      }
    }, 2000)
  }

  function _stopRssiPoll(session: DeviceSession) {
    if (session.rssiPollTimer) {
      clearInterval(session.rssiPollTimer)
      session.rssiPollTimer = null
    }
    session.rssiHistory = []
  }

  // ── 特征值历史 ────────────────────────────────────────────────────────────

  function _addCharHistory(session: DeviceSession, charId: string, hex: string) {
    if (!charId || !hex) return
    const arr = [...(session.charValueHistory[charId] ?? []), { time: Date.now(), hex }]
    if (arr.length > 50) arr.splice(0, arr.length - 50)
    session.charValueHistory = { ...session.charValueHistory, [charId]: arr }
  }

  function addCharHistory(charId: string, hex: string, deviceId?: string) {
    const id = deviceId ?? activeSessionId.value
    const session = getSession(id)
    if (session) {
      _addCharHistory(session, charId, hex)
      triggerSessionUpdate()
    }
  }

  // ── 私有日志辅助 ──────────────────────────────────────────────────────────

  function _addSysLogToSession(session: DeviceSession, message: string) {
    const entry: LogEntry = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      direction: 'SYS',
      hex: '',
      ascii: message,
      rawLength: 0,
    }
    session.logBuffer.push(entry)
    session.logs = session.logBuffer.getAll()
    recordSessionLog(session.device.deviceId, entry)
  }

  function _addSysLogToAll(message: string) {
    sessions.value.forEach((session) => {
      _addSysLogToSession(session, message)
    })
    triggerSessionUpdate()
  }

  // ── App 生命周期 ──────────────────────────────────────────────────────────

  function onAppBackground() {
    flushAllSessionRecords()
    sessions.value.forEach((session) => {
      if (session.rssiPollTimer) {
        clearInterval(session.rssiPollTimer)
        session.rssiPollTimer = null
      }
    })
    if (adapterState.value === BleAdapterState.SCANNING) {
      bleManager.stopScan()
    }
  }

  function onAppForeground() {
    sessions.value.forEach((session, deviceId) => {
      if (bleManager.isDeviceConnected(deviceId)) {
        if (!session.rssiPollTimer) _startRssiPoll(deviceId)
        bleManager.getRSSI(deviceId).catch(() => {
          _stopRssiPoll(session)
          stopHeartbeatTest(deviceId, true)
          _cancelPendingOpRun(deviceId, session, 'disconnected')
          endSessionRecord(deviceId, 'lost')
          const name = session.device.name
          sessions.value.delete(deviceId)
          if (activeSessionId.value === deviceId) {
            const remaining = Array.from(sessions.value.keys())
            activeSessionId.value = remaining[0] ?? ''
          }
          triggerSessionUpdate()
          _addSysLogToAll(`后台期间连接已断开: ${name}`)
        })
      }
    })
  }

  // ── 重置 ──────────────────────────────────────────────────────────────────

  function reset() {
    sessions.value.forEach((_, deviceId) => stopHeartbeatTest(deviceId, true))
    sessions.value.forEach((session, deviceId) => _cancelPendingOpRun(deviceId, session, 'reset'))
    sessions.value.forEach((session) => _stopRssiPoll(session))
    sessions.value.clear()
    activeSessionId.value = ''
    scannedDevices.value = []
    isConnecting.value = false
    errorMessage.value = ''
    triggerSessionUpdate()
  }

  // ── 兼容层：原 bleState 接口（扫描页状态点使用）────────────────────────
  // 扫描页只关心 UNINITIALIZED / IDLE / SCANNING，直接暴露 adapterState
  const bleState = adapterState

  return {
    // 适配器层
    bleState,
    adapterState,
    scannedDevices,
    filterName,
    filterMinRssi,
    isConnecting,
    errorMessage,
    quickCommands,
    recentDevices,
    // 多设备会话
    sessions,
    activeSessionId,
    // 计算属性：适配器
    isScanning,
    isReady,
    hasConnections,
    filteredDevices,
    // 计算属性：活跃会话代理
    activeSession,
    connectedDevice,
    isConnected,
    services,
    characteristics,
    logs,
    txBytes,
    rxBytes,
    rssiHistory,
    charValueHistory,
    savedSamples,
    currentMtu,
    activeServiceId,
    activeCharacteristicId,
    notifyEnabled,
    rxDisplayMode,
    txDisplayMode,
    activeCharacteristics,
    activeCharacteristic,
    activeHeartbeat,
    // actions
    init,
    onAppBackground,
    onAppForeground,
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
    switchSession,
    loadDeviceServices,
    loadCharacteristics,
    selectCharacteristic,
    toggleNotify,
    sendData,
    addSysLog,
    addCharHistory,
    clearLogs,
    saveLogAsProtocolSample,
    addQuickCommand,
    removeQuickCommand,
    negotiateMtu,
    startHeartbeatTest,
    stopHeartbeatTest,
    runOperation,
    reset,
  }
})
