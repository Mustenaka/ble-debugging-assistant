import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bleManager, BleState, type BleDevice, type BleService, type BleCharacteristic } from '../services/bleManager'
import { bufToHex, bufToAscii, rssiToColor, rssiToLevel } from '../utils/hex'
import { RingBuffer, type LogEntry, type QuickCommand, loadQuickCommands, saveQuickCommands, saveRecentDevice, loadRecentDevices, type RecentDevice } from '../utils/buffer'

export type DisplayMode = 'hex' | 'ascii'

// ─── BLE Store ───────────────────────────────────────────────────────────────

export const useBleStore = defineStore('ble', () => {

  // ── 状态 ────────────────────────────────────────────────────────────────

  const bleState = ref<BleState>(BleState.UNINITIALIZED)
  const scannedDevices = ref<BleDevice[]>([])
  const connectedDevice = ref<BleDevice | null>(null)
  const services = ref<BleService[]>([])
  const characteristics = ref<Map<string, BleCharacteristic[]>>(new Map())

  // 当前选中的调试目标
  const activeServiceId = ref<string>('')
  const activeCharacteristicId = ref<string>('')
  const notifyEnabled = ref<boolean>(false)

  // 日志
  const logBuffer = new RingBuffer<LogEntry>(2000)
  const logs = ref<LogEntry[]>([])

  // 快捷命令
  const quickCommands = ref<QuickCommand[]>(loadQuickCommands())

  // 最近设备
  const recentDevices = ref<RecentDevice[]>(loadRecentDevices())

  // 过滤条件
  const filterName = ref<string>('')
  const filterMinRssi = ref<number>(-100)

  // 显示模式
  const rxDisplayMode = ref<DisplayMode>('hex')
  const txDisplayMode = ref<DisplayMode>('hex')

  // 连接状态标记
  const isConnecting = ref<boolean>(false)
  const errorMessage = ref<string>('')

  // 统计
  const txBytes = ref<number>(0)
  const rxBytes = ref<number>(0)

  // ── 计算属性 ─────────────────────────────────────────────────────────────

  const isScanning = computed(() => bleState.value === BleState.SCANNING)
  const isConnected = computed(() => bleState.value === BleState.CONNECTED)
  const isReady = computed(() => bleState.value !== BleState.UNINITIALIZED)

  const filteredDevices = computed(() => {
    return scannedDevices.value.filter((d) => {
      const nameOk = !filterName.value || d.name.toLowerCase().includes(filterName.value.toLowerCase())
      const rssiOk = d.RSSI >= filterMinRssi.value
      return nameOk && rssiOk
    })
  })

  const activeCharacteristics = computed(() => {
    if (!activeServiceId.value) return []
    return characteristics.value.get(activeServiceId.value) ?? []
  })

  const activeCharacteristic = computed(() => {
    return activeCharacteristics.value.find((c) => c.uuid === activeCharacteristicId.value) ?? null
  })

  // ── 初始化 & 监听 ────────────────────────────────────────────────────────

  function init() {
    bleManager.onStateChange((s) => {
      bleState.value = s
      if (s === BleState.DISCONNECTED) {
        notifyEnabled.value = false
      }
    })

    bleManager.onDeviceFound((devices) => {
      scannedDevices.value = devices
    })

    bleManager.onDataReceived((deviceId, serviceId, characteristicId, value) => {
      rxBytes.value += value.byteLength
      const entry: LogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        direction: 'RX',
        hex: bufToHex(value),
        ascii: bufToAscii(value),
        rawLength: value.byteLength,
        label: `${shortUUID(serviceId)} / ${shortUUID(characteristicId)}`,
      }
      logBuffer.push(entry)
      logs.value = logBuffer.getAll()
    })

    bleManager.onConnectionChange((deviceId, connected) => {
      if (!connected && connectedDevice.value?.deviceId === deviceId) {
        addSysLog(`设备断开连接: ${connectedDevice.value.name}`)
      }
    })
  }

  // ── 扫描操作 ─────────────────────────────────────────────────────────────

  async function startScan(timeoutMs = 15000) {
    console.log('[BleStore] startScan() called, bleState:', bleState.value)
    try {
      errorMessage.value = ''
      scannedDevices.value = []
      await bleManager.startScan({ timeoutMs })
      console.log('[BleStore] startScan() succeeded, bleState:', bleState.value)
    } catch (e: any) {
      console.error('[BleStore] startScan() caught error — code:', (e as any).code, '| message:', e.message, '| raw:', JSON.stringify((e as any).raw))
      errorMessage.value = e.message ?? '扫描失败'
      throw e
    }
  }

  async function stopScan() {
    await bleManager.stopScan()
  }

  // ── 连接操作 ─────────────────────────────────────────────────────────────

  async function connectDevice(device: BleDevice) {
    isConnecting.value = true
    errorMessage.value = ''
    try {
      await bleManager.connect(device.deviceId)
      connectedDevice.value = device
      saveRecentDevice({ deviceId: device.deviceId, name: device.name, lastConnected: Date.now() })
      recentDevices.value = loadRecentDevices()
      addSysLog(`已连接: ${device.name} (${device.deviceId})`)
      await loadDeviceServices(device.deviceId)
    } catch (e: any) {
      errorMessage.value = e.message ?? '连接失败'
      throw e
    } finally {
      isConnecting.value = false
    }
  }

  async function disconnectDevice() {
    if (!connectedDevice.value) return
    const name = connectedDevice.value.name
    await bleManager.disconnect()
    services.value = []
    characteristics.value = new Map()
    activeServiceId.value = ''
    activeCharacteristicId.value = ''
    connectedDevice.value = null
    addSysLog(`已断开: ${name}`)
  }

  // ── 服务 & 特征值 ────────────────────────────────────────────────────────

  async function loadDeviceServices(deviceId: string) {
    const svcs = await bleManager.getServices(deviceId)
    services.value = svcs
    characteristics.value = new Map()
  }

  async function loadCharacteristics(serviceId: string) {
    const deviceId = bleManager.getConnectedDeviceId()
    if (!deviceId) return
    const chars = await bleManager.getCharacteristics(deviceId, serviceId)
    characteristics.value.set(serviceId, chars)
    activeServiceId.value = serviceId
  }

  function selectCharacteristic(charId: string) {
    activeCharacteristicId.value = charId
  }

  // ── Notify ────────────────────────────────────────────────────────────────

  async function toggleNotify(enable: boolean) {
    const deviceId = bleManager.getConnectedDeviceId()
    if (!deviceId || !activeServiceId.value || !activeCharacteristicId.value) return

    await bleManager.setNotify(
      deviceId,
      activeServiceId.value,
      activeCharacteristicId.value,
      enable
    )
    notifyEnabled.value = enable
    addSysLog(`Notify ${enable ? '已开启' : '已关闭'}: ${shortUUID(activeCharacteristicId.value)}`)
  }

  // ── 发送数据 ──────────────────────────────────────────────────────────────

  async function sendData(data: ArrayBuffer, chunked = true, label?: string) {
    const deviceId = bleManager.getConnectedDeviceId()
    if (!deviceId || !activeServiceId.value || !activeCharacteristicId.value) {
      throw new Error('未选择发送目标')
    }

    if (chunked) {
      await bleManager.writeChunked(deviceId, activeServiceId.value, activeCharacteristicId.value, data)
    } else {
      await bleManager.write(deviceId, activeServiceId.value, activeCharacteristicId.value, data)
    }

    txBytes.value += data.byteLength
    const entry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      direction: 'TX',
      hex: bufToHex(data),
      ascii: bufToAscii(data),
      rawLength: data.byteLength,
      label,
    }
    logBuffer.push(entry)
    logs.value = logBuffer.getAll()
  }

  // ── 日志操作 ──────────────────────────────────────────────────────────────

  function addSysLog(message: string) {
    const entry: LogEntry = {
      id: `sys_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      direction: 'SYS',
      hex: '',
      ascii: message,
      rawLength: 0,
    }
    logBuffer.push(entry)
    logs.value = logBuffer.getAll()
  }

  function clearLogs() {
    logBuffer.clear()
    logs.value = []
    txBytes.value = 0
    rxBytes.value = 0
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

  // ── 重置 ──────────────────────────────────────────────────────────────────

  function reset() {
    scannedDevices.value = []
    connectedDevice.value = null
    services.value = []
    characteristics.value = new Map()
    activeServiceId.value = ''
    activeCharacteristicId.value = ''
    notifyEnabled.value = false
    isConnecting.value = false
    errorMessage.value = ''
    clearLogs()
  }

  return {
    // state
    bleState,
    scannedDevices,
    connectedDevice,
    services,
    characteristics,
    activeServiceId,
    activeCharacteristicId,
    notifyEnabled,
    logs,
    quickCommands,
    recentDevices,
    filterName,
    filterMinRssi,
    rxDisplayMode,
    txDisplayMode,
    isConnecting,
    errorMessage,
    txBytes,
    rxBytes,
    // computed
    isScanning,
    isConnected,
    isReady,
    filteredDevices,
    activeCharacteristics,
    activeCharacteristic,
    // actions
    init,
    startScan,
    stopScan,
    connectDevice,
    disconnectDevice,
    loadDeviceServices,
    loadCharacteristics,
    selectCharacteristic,
    toggleNotify,
    sendData,
    addSysLog,
    clearLogs,
    addQuickCommand,
    removeQuickCommand,
    reset,
  }
})

// 辅助：短 UUID 显示
function shortUUID(uuid: string): string {
  if (!uuid) return ''
  const upper = uuid.toUpperCase()
  if (upper.endsWith('-0000-1000-8000-00805F9B34FB')) {
    const prefix = upper.split('-')[0]
    return prefix.length === 8 ? prefix.slice(4) : prefix
  }
  return upper.length > 8 ? `${upper.slice(0, 8)}...` : upper
}
