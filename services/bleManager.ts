/**
 * BLE Manager - 蓝牙低功耗管理器
 * 职责：Promise化BLE API、状态机管理、统一错误处理
 */

// ─── 类型定义 ────────────────────────────────────────────────────────────────

export enum BleState {
  UNINITIALIZED = 'UNINITIALIZED',
  IDLE = 'IDLE',
  SCANNING = 'SCANNING',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
}

export interface BleDevice {
  deviceId: string
  name: string
  localName?: string
  RSSI: number
  advertisData?: ArrayBuffer
  advertisServiceUUIDs?: string[]
  serviceData?: Record<string, ArrayBuffer>
  connectable?: boolean
}

export interface BleService {
  uuid: string
  isPrimary: boolean
}

export interface BleCharacteristic {
  uuid: string
  serviceUUID: string
  properties: {
    read: boolean
    write: boolean
    notify: boolean
    indicate: boolean
    writeNoResponse: boolean
  }
}

export interface BleError {
  code: number
  message: string
  raw?: any
}

export type BleStateListener = (state: BleState) => void
export type BleDeviceListener = (devices: BleDevice[]) => void
export type BleDataListener = (deviceId: string, serviceId: string, characteristicId: string, value: ArrayBuffer) => void
export type BleConnectionListener = (deviceId: string, connected: boolean) => void

// ─── 错误码映射 ──────────────────────────────────────────────────────────────

const BLE_ERROR_MAP: Record<number, string> = {
  0: '正常',
  10000: '未初始化蓝牙适配器',
  10001: '蓝牙适配器不可用（已关闭或不支持）',
  10002: '未找到指定设备',
  10003: '连接失败',
  10004: '未找到指定服务',
  10005: '未找到指定特征值',
  10006: '当前连接已断开',
  10007: '当前特征值不支持此操作',
  10008: '当前设备操作已超时',
  10009: '系统版本不支持 BLE',
  10010: '系统蓝牙功能未开启',
  10011: '未授权蓝牙权限',
  10012: '位置权限未授权（Android）',
  10013: '当前蓝牙适配器状态不允许连接',
  10016: '位置服务未开启，请在系统设置中开启 GPS',
}

function createBleError(errCode: number, raw?: any): BleError {
  // uni-app 部分平台返回 err.code 而非 err.errCode，统一兼容
  const resolvedCode = errCode ?? (raw?.code) ?? 10000
  return {
    code: resolvedCode,
    message: BLE_ERROR_MAP[resolvedCode] ?? `未知错误(${resolvedCode})`,
    raw,
  }
}

// ─── BLE Manager 类 ──────────────────────────────────────────────────────────

class BleManager {
  private state: BleState = BleState.UNINITIALIZED
  private scanTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null

  private stateListeners: Set<BleStateListener> = new Set()
  private deviceListeners: Set<BleDeviceListener> = new Set()
  private dataListeners: Set<BleDataListener> = new Set()
  private connectionListeners: Set<BleConnectionListener> = new Set()

  private discoveredDevices: Map<string, BleDevice> = new Map()
  private connectedDeviceId: string | null = null
  private reconnectConfig = {
    enabled: false,
    deviceId: '',
    maxAttempts: 5,
    currentAttempts: 0,
    intervalMs: 3000,
  }

  // ── 状态机 ────────────────────────────────────────────────────────────────

  getState(): BleState {
    return this.state
  }

  private setState(newState: BleState) {
    if (this.state === newState) return
    this.state = newState
    this.stateListeners.forEach((fn) => fn(newState))
  }

  // ── 事件监听注册 ──────────────────────────────────────────────────────────

  onStateChange(fn: BleStateListener) {
    this.stateListeners.add(fn)
    return () => this.stateListeners.delete(fn)
  }

  onDeviceFound(fn: BleDeviceListener) {
    this.deviceListeners.add(fn)
    return () => this.deviceListeners.delete(fn)
  }

  onDataReceived(fn: BleDataListener) {
    this.dataListeners.add(fn)
    return () => this.dataListeners.delete(fn)
  }

  onConnectionChange(fn: BleConnectionListener) {
    this.connectionListeners.add(fn)
    return () => this.connectionListeners.delete(fn)
  }

  // ── 初始化蓝牙适配器 ──────────────────────────────────────────────────────

  async openAdapter(): Promise<void> {
    console.log('[BleManager] openAdapter() called, current state:', this.state)
    return new Promise((resolve, reject) => {
      uni.openBluetoothAdapter({
        mode: 'central',
        success: (res: any) => {
          console.log('[BleManager] openBluetoothAdapter SUCCESS:', JSON.stringify(res))
          this.setState(BleState.IDLE)
          this._registerAdapterStateChange()
          this._registerConnectionStateChange()
          resolve()
        },
        fail: (err: any) => {
          console.error('[BleManager] openBluetoothAdapter FAIL — raw err:', JSON.stringify(err))
          console.error('[BleManager] openBluetoothAdapter FAIL — errCode:', err.errCode, '| code:', err.code, '| errMsg:', err.errMsg)
          this.setState(BleState.UNINITIALIZED)
          reject(createBleError(err.errCode ?? err.code ?? 10000, err))
        },
      })
    })
  }

  async closeAdapter(): Promise<void> {
    this._clearTimers()
    return new Promise((resolve, reject) => {
      uni.closeBluetoothAdapter({
        success: () => {
          this.setState(BleState.UNINITIALIZED)
          this.discoveredDevices.clear()
          resolve()
        },
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10000, err)),
      })
    })
  }

  // ── 设备扫描 ──────────────────────────────────────────────────────────────

  async startScan(options?: {
    services?: string[]
    allowDuplicatesKey?: boolean
    interval?: number
    powerLevel?: string
    timeoutMs?: number
  }): Promise<void> {
    console.log('[BleManager] startScan() called, current state:', this.state)
    if (this.state === BleState.UNINITIALIZED) {
      console.log('[BleManager] state is UNINITIALIZED, calling openAdapter()...')
      await this.openAdapter()
      console.log('[BleManager] openAdapter() completed, state now:', this.state)
    }
    if (this.state === BleState.SCANNING) {
      console.log('[BleManager] already scanning, stopping first...')
      await this.stopScan()
    }

    this.discoveredDevices.clear()
    console.log('[BleManager] calling startBluetoothDevicesDiscovery...')

    return new Promise((resolve, reject) => {
      uni.startBluetoothDevicesDiscovery({
        services: options?.services ?? [],
        allowDuplicatesKey: options?.allowDuplicatesKey ?? true,
        interval: options?.interval ?? 500,
        powerLevel: (options?.powerLevel ?? 'medium') as any,
        success: (res: any) => {
          console.log('[BleManager] startBluetoothDevicesDiscovery SUCCESS:', JSON.stringify(res))
          this.setState(BleState.SCANNING)
          this._registerDeviceFound()

          if (options?.timeoutMs) {
            this.scanTimer = setTimeout(() => this.stopScan(), options.timeoutMs)
          }

          resolve()
        },
        fail: (err: any) => {
          console.error('[BleManager] startBluetoothDevicesDiscovery FAIL — raw err:', JSON.stringify(err))
          console.error('[BleManager] startBluetoothDevicesDiscovery FAIL — errCode:', err.errCode, '| code:', err.code, '| errMsg:', err.errMsg)
          reject(createBleError(err.errCode ?? err.code ?? 10000, err))
        },
      })
    })
  }

  async stopScan(): Promise<void> {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer)
      this.scanTimer = null
    }

    return new Promise((resolve) => {
      uni.stopBluetoothDevicesDiscovery({
        success: () => {
          if (this.state === BleState.SCANNING) {
            this.setState(BleState.IDLE)
          }
          resolve()
        },
        fail: () => resolve(), // 停止扫描失败不阻塞
      })
    })
  }

  getDiscoveredDevices(): BleDevice[] {
    return Array.from(this.discoveredDevices.values()).sort((a, b) => b.RSSI - a.RSSI)
  }

  // ── 设备连接 ──────────────────────────────────────────────────────────────

  async connect(deviceId: string, timeout = 10000): Promise<void> {
    if (this.state === BleState.SCANNING) {
      await this.stopScan()
    }

    this.setState(BleState.CONNECTING)

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(createBleError(10008))
        this.setState(BleState.IDLE)
      }, timeout)

      uni.createBLEConnection({
        deviceId,
        timeout,
        success: () => {
          clearTimeout(timer)
          this.connectedDeviceId = deviceId
          this.setState(BleState.CONNECTED)
          this.reconnectConfig.currentAttempts = 0
          resolve()
        },
        fail: (err: any) => {
          clearTimeout(timer)
          this.setState(BleState.IDLE)
          reject(createBleError(err.errCode ?? err.code ?? 10003, err))
        },
      })
    })
  }

  async disconnect(deviceId?: string): Promise<void> {
    const id = deviceId ?? this.connectedDeviceId
    if (!id) return

    this._stopHeartbeat()
    this.reconnectConfig.enabled = false

    return new Promise((resolve, reject) => {
      uni.closeBLEConnection({
        deviceId: id,
        success: () => {
          this.connectedDeviceId = null
          this.setState(BleState.DISCONNECTED)
          resolve()
        },
        fail: (err: any) => {
          const errCode = err.errCode ?? err.code ?? 10006
          // errCode 10006 表示连接已经断开，视为断开成功并清理状态
          if (errCode === 10006) {
            this.connectedDeviceId = null
            this.setState(BleState.DISCONNECTED)
            resolve()
          } else {
            reject(createBleError(errCode, err))
          }
        },
      })
    })
  }

  getConnectedDeviceId(): string | null {
    return this.connectedDeviceId
  }

  // ── 服务 & 特征值发现 ─────────────────────────────────────────────────────

  async getServices(deviceId: string): Promise<BleService[]> {
    return new Promise((resolve, reject) => {
      uni.getBLEDeviceServices({
        deviceId,
        success: (res: any) => resolve(res.services as BleService[]),
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10004, err)),
      })
    })
  }

  async getCharacteristics(deviceId: string, serviceId: string): Promise<BleCharacteristic[]> {
    return new Promise((resolve, reject) => {
      uni.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res: any) => {
          const chars: BleCharacteristic[] = res.characteristics.map((c: any) => ({
            uuid: c.uuid,
            serviceUUID: serviceId,
            properties: {
              read: !!c.properties.read,
              write: !!c.properties.write,
              notify: !!c.properties.notify,
              indicate: !!c.properties.indicate,
              writeNoResponse: !!c.properties.writeNoResponse,
            },
          }))
          resolve(chars)
        },
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10005, err)),
      })
    })
  }

  // ── Notify 订阅 ───────────────────────────────────────────────────────────

  async setNotify(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    enable: boolean
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      uni.notifyBLECharacteristicValueChange({
        deviceId,
        serviceId,
        characteristicId,
        state: enable,
        success: () => resolve(),
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10007, err)),
      })
    })
  }

  // ── 读取特征值 ────────────────────────────────────────────────────────────

  async readCharacteristic(
    deviceId: string,
    serviceId: string,
    characteristicId: string
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      // 先注册一次性监听
      const handler = (res: any) => {
        if (
          res.deviceId === deviceId &&
          res.serviceId.toUpperCase() === serviceId.toUpperCase() &&
          res.characteristicId.toUpperCase() === characteristicId.toUpperCase()
        ) {
          uni.offBLECharacteristicValueChange(handler)
          resolve(res.value)
        }
      }
      uni.onBLECharacteristicValueChange(handler)

      uni.readBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        success: () => {},
        fail: (err: any) => {
          uni.offBLECharacteristicValueChange(handler)
          reject(createBleError(err.errCode ?? err.code ?? 10007, err))
        },
      })
    })
  }

  // ── 写入特征值 ────────────────────────────────────────────────────────────

  async write(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    value: ArrayBuffer,
    withResponse = true
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      uni.writeBLECharacteristicValue({
        deviceId,
        serviceId,
        characteristicId,
        value,
        writeType: withResponse ? 'write' : 'writeNoResponse',
        success: () => resolve(),
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10007, err)),
      })
    })
  }

  // ── 查询设备 RSSI ─────────────────────────────────────────────────────────

  async getRSSI(deviceId: string): Promise<number> {
    return new Promise((resolve, reject) => {
      uni.getBLEDeviceRSSI({
        deviceId,
        success: (res: any) => resolve(res.RSSI),
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10008, err)),
      })
    })
  }

  // ── MTU 协商 ──────────────────────────────────────────────────────────────

  async negotiateMTU(mtu: number): Promise<number> {
    const deviceId = this.connectedDeviceId
    if (!deviceId) throw createBleError(10006)
    return new Promise((resolve, reject) => {
      // #ifdef APP-PLUS
      uni.setBLEMTU({
        deviceId,
        mtu,
        success: (res: any) => resolve((res as any).mtu ?? mtu),
        fail: (err: any) => reject(createBleError(err.errCode ?? err.code ?? 10007, err)),
      })
      // #endif
      // #ifndef APP-PLUS
      resolve(mtu)
      // #endif
    })
  }

  // ── 分包写入（MTU 分片）────────────────────────────────────────────────────

  async writeChunked(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    data: ArrayBuffer,
    mtu = 20,
    withResponse = true
  ): Promise<void> {
    const chunks = this._splitBuffer(data, mtu)
    for (const chunk of chunks) {
      await this.write(deviceId, serviceId, characteristicId, chunk, withResponse)
      // 避免过快写入
      await this._delay(withResponse ? 50 : 20)
    }
  }

  // ── 心跳包 ────────────────────────────────────────────────────────────────

  startHeartbeat(
    deviceId: string,
    serviceId: string,
    characteristicId: string,
    payload: ArrayBuffer,
    intervalMs = 5000
  ) {
    this._stopHeartbeat()
    this.heartbeatTimer = setInterval(async () => {
      if (this.state !== BleState.CONNECTED) {
        this._stopHeartbeat()
        return
      }
      try {
        await this.write(deviceId, serviceId, characteristicId, payload, false)
      } catch {
        // 心跳失败静默处理，连接断开事件会触发重连
      }
    }, intervalMs)
  }

  private _stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  // ── 自动重连 ──────────────────────────────────────────────────────────────

  enableAutoReconnect(deviceId: string, maxAttempts = 5, intervalMs = 3000) {
    this.reconnectConfig = {
      enabled: true,
      deviceId,
      maxAttempts,
      currentAttempts: 0,
      intervalMs,
    }
  }

  disableAutoReconnect() {
    this.reconnectConfig.enabled = false
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private _triggerReconnect() {
    const cfg = this.reconnectConfig
    if (!cfg.enabled || cfg.currentAttempts >= cfg.maxAttempts) return

    cfg.currentAttempts++
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect(cfg.deviceId)
      } catch {
        this._triggerReconnect()
      }
    }, cfg.intervalMs)
  }

  // ── 内部辅助 ──────────────────────────────────────────────────────────────

  private _registerAdapterStateChange() {
    uni.onBluetoothAdapterStateChange((res: any) => {
      if (!res.available) {
        this._clearTimers()
        this.setState(BleState.UNINITIALIZED)
      }
    })
  }

  private _registerConnectionStateChange() {
    uni.onBLEConnectionStateChange((res: any) => {
      this.connectionListeners.forEach((fn) => fn(res.deviceId, res.connected))
      if (!res.connected && res.deviceId === this.connectedDeviceId) {
        this._stopHeartbeat()
        this.connectedDeviceId = null
        this.setState(BleState.DISCONNECTED)
        this._triggerReconnect()
      }
    })
  }

  private _registerDeviceFound() {
    uni.onBluetoothDeviceFound((res: any) => {
      res.devices.forEach((d: any) => {
        const existing = this.discoveredDevices.get(d.deviceId)
        const device: BleDevice = {
          deviceId: d.deviceId,
          name: d.name || d.localName || '未知设备',
          localName: d.localName,
          RSSI: d.RSSI,
          advertisData: d.advertisData,
          advertisServiceUUIDs: d.advertisServiceUUIDs,
          serviceData: d.serviceData,
          connectable: d.connectable,
        }
        if (!existing || existing.RSSI !== device.RSSI) {
          this.discoveredDevices.set(d.deviceId, device)
        }
      })
      this.deviceListeners.forEach((fn) => fn(this.getDiscoveredDevices()))
    })

    uni.onBLECharacteristicValueChange((res: any) => {
      this.dataListeners.forEach((fn) =>
        fn(res.deviceId, res.serviceId, res.characteristicId, res.value)
      )
    })
  }

  private _splitBuffer(buffer: ArrayBuffer, chunkSize: number): ArrayBuffer[] {
    const chunks: ArrayBuffer[] = []
    const src = new Uint8Array(buffer)
    for (let i = 0; i < src.length; i += chunkSize) {
      chunks.push(src.slice(i, i + chunkSize).buffer)
    }
    return chunks
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private _clearTimers() {
    if (this.scanTimer) { clearTimeout(this.scanTimer); this.scanTimer = null }
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = null }
    this._stopHeartbeat()
  }
}

// 单例导出
export const bleManager = new BleManager()
