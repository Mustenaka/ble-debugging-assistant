import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  bleManager,
  BleAdapterState,
  BleDeviceState,
  type BleDevice,
  type BleService,
  type BleCharacteristic,
} from '../services/bleManager'
import { bufToHex, bufToAscii, shortUUID } from '../utils/hex'
import {
  RingBuffer,
  type LogEntry,
  type QuickCommand,
  loadQuickCommands,
  saveQuickCommands,
  saveRecentDevice,
  loadRecentDevices,
  type RecentDevice,
} from '../utils/buffer'

export type DisplayMode = 'hex' | 'ascii'

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
  currentMtu: number
  activeServiceId: string
  activeCharacteristicId: string
  notifyEnabled: boolean
  rxDisplayMode: DisplayMode
  txDisplayMode: DisplayMode
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
    currentMtu: 23,
    activeServiceId: '',
    activeCharacteristicId: '',
    notifyEnabled: false,
    rxDisplayMode: 'hex',
    txDisplayMode: 'hex',
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
      }
      session.logBuffer.push(entry)
      session.logs = session.logBuffer.getAll()
      _addCharHistory(session, characteristicId, hex)
      triggerSessionUpdate()
    })

    bleManager.onConnectionChange((deviceId, connected) => {
      if (!connected) {
        const session = getSession(deviceId)
        if (!session) return
        _addSysLogToSession(session, `设备断开连接: ${session.device.name}`)
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

  async function startScan(timeoutMs = 15000) {
    try {
      errorMessage.value = ''
      scannedDevices.value = []
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
    }
    session.logBuffer.push(entry)
    session.logs = session.logBuffer.getAll()
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

  // ── 快捷命令 ──────────────────────────────────────────────────────────────

  function addQuickCommand(cmd: Omit<QuickCommand, 'id'>) {
    const newCmd: QuickCommand = { ...cmd, id: `qc_${Date.now()}` }
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
    triggerSessionUpdate()
    return actual
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
  }

  function _addSysLogToAll(message: string) {
    sessions.value.forEach((session) => {
      _addSysLogToSession(session, message)
    })
    triggerSessionUpdate()
  }

  // ── App 生命周期 ──────────────────────────────────────────────────────────

  function onAppBackground() {
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
    currentMtu,
    activeServiceId,
    activeCharacteristicId,
    notifyEnabled,
    rxDisplayMode,
    txDisplayMode,
    activeCharacteristics,
    activeCharacteristic,
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
    addQuickCommand,
    removeQuickCommand,
    negotiateMtu,
    reset,
  }
})
