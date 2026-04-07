<template>
  <view class="scan-page" :class="appStore.themeClass" :style="appStore.cssVarsStyle">

    <!-- 宽屏左侧导航栏 -->
    <LeftTabBar v-if="isWideScreen" current-path="/pages/scan/index" />

    <!-- 主体（窄屏：单列；宽屏：左40% + 右60%） -->
    <view class="scan-body" :class="{ 'scan-body--wide': isWideScreen }">

      <!-- 左栏：状态 + 雷达 + 控制 -->
      <view class="scan-left" :class="{ 'scan-left--wide': isWideScreen }">

        <!-- 顶部状态栏 -->
        <view class="status-bar">
          <view class="status-left">
            <view class="status-dot" :class="stateClass" />
            <text class="status-text">{{ stateLabel }}</text>
          </view>
          <view class="status-right">
            <text class="version-chip">{{ t('status.version') }}</text>
            <!-- 语言快切 -->
            <view class="lang-quick-btn" @click="appStore.toggleLocale()">
              <text class="lang-quick-text">{{ appStore.locale === 'zh' ? 'EN' : '中' }}</text>
            </view>
            <!-- 主题快切 -->
            <view class="theme-quick-btn" @click="appStore.toggleTheme()">
              <text class="theme-icon">{{ appStore.isDark ? '☀' : '◑' }}</text>
            </view>
            <!-- 设置按钮 -->
            <view class="settings-trigger" @click="showSettings = true">
              <text class="settings-icon">⚙</text>
            </view>
          </view>
        </view>

        <!-- 雷达动画区 -->
        <view class="radar-section">
          <RadarScanAnimation
            :scanning="bleStore.isScanning"
            :device-count="bleStore.filteredDevices.length"
            :theme="appStore.theme"
          />
        </view>

        <!-- 过滤 & 控制区 -->
        <view class="control-card">
          <view class="filter-row">
            <view class="filter-input-wrap">
              <text class="filter-icon">⌕</text>
              <input
                class="filter-input"
                v-model="bleStore.filterName"
                :placeholder="t('scan.filterPlaceholder')"
                placeholder-class="filter-ph"
              />
              <view v-if="bleStore.filterName" class="filter-clear" @click="bleStore.filterName = ''">
                <text class="filter-clear-icon">✕</text>
              </view>
            </view>

            <view class="rssi-filter">
              <text class="rssi-label">{{ t('scan.rssiFilter') }}</text>
              <picker mode="selector" :range="rssiOptions" :value="rssiPickerIndex" @change="onRssiChange">
                <view class="rssi-picker">
                  <text class="rssi-value">{{ rssiOptions[rssiPickerIndex] }}</text>
                  <text class="rssi-arr">⌄</text>
                </view>
              </picker>
            </view>
          </view>

          <!-- 扫描时长选择 -->
          <view class="duration-row">
            <text class="duration-label">{{ t('scan.scanDuration') }}</text>
            <view class="duration-chips">
              <view
                v-for="opt in durationOpts"
                :key="opt.value"
                class="dur-chip"
                :class="{ 'dur-chip--active': scanDuration === opt.value }"
                @click="scanDuration = opt.value"
              >
                <text class="dur-chip-text">{{ opt.label }}</text>
              </view>
            </view>
          </view>

          <view class="scan-btn-row">
            <view
              class="scan-main-btn"
              :class="{ 'scan-main-btn--stop': bleStore.isScanning }"
              @click="toggleScan"
            >
              <view class="btn-inner">
                <view v-if="bleStore.isScanning" class="btn-spin" />
                <text v-else class="btn-icon">◉</text>
                <text class="btn-label">{{ bleStore.isScanning ? t('scan.stopScan') : t('scan.startScan') }}</text>
              </view>
            </view>
            <view class="clear-btn" @click="clearDevices">
              <text class="clear-label">{{ t('common.clear') }}</text>
            </view>
          </view>
        </view>

      </view>

      <!-- 右栏：最近连接 + 设备列表 -->
      <view class="scan-right" :class="{ 'scan-right--wide': isWideScreen }">

        <!-- 最近连接 -->
        <view v-if="bleStore.recentDevices.length && !bleStore.isScanning && !bleStore.filteredDevices.length" class="recent-section">
          <view class="section-hd">
            <text class="section-title">{{ t('scan.recentDevices') }}</text>
            <text class="section-count">{{ bleStore.recentDevices.length }}</text>
          </view>
          <view class="recent-list">
            <view
              v-for="recent in bleStore.recentDevices.slice(0, 3)"
              :key="recent.deviceId"
              class="recent-item"
              @click="quickReconnect(recent)"
            >
              <view class="recent-icon"><text class="ri-text">⟳</text></view>
              <view class="recent-info">
                <text class="recent-name">{{ recent.name }}</text>
                <text class="recent-time">{{ formatRelativeTime(recent.lastConnected) }}</text>
              </view>
              <text class="recent-arr">›</text>
            </view>
          </view>
        </view>

        <!-- 设备列表 -->
        <view class="device-section">
          <view class="section-hd">
            <text class="section-title">{{ t('scan.scanResults') }}</text>
            <view class="section-badges">
              <view v-if="bleStore.filteredDevices.length" class="count-badge">
                <text class="count-text">{{ bleStore.filteredDevices.length }}</text>
              </view>
              <view v-if="bleStore.isScanning" class="scanning-badge">
                <text class="scanning-dot anim-blink">●</text>
                <text class="scanning-text">{{ t('scan.scanningLabel') }}</text>
              </view>
            </view>
          </view>

          <scroll-view scroll-y class="device-scroll" :class="{ 'device-scroll--wide': isWideScreen }">
            <view class="device-list">
              <view v-if="!bleStore.filteredDevices.length" class="list-empty">
                <text v-if="bleStore.isScanning" class="empty-scan-text mono">{{ t('scan.searchingDevices') }}</text>
                <view v-else class="empty-idle">
                  <text class="empty-icon">⊙</text>
                  <text class="empty-tip">{{ t('scan.tapToScan') }}</text>
                </view>
              </view>

              <DeviceItem
                v-for="device in bleStore.filteredDevices"
                :key="device.deviceId"
                :device="device"
                :is-connecting="connectingId === device.deviceId"
                :is-already-connected="bleStore.sessions.has(device.deviceId)"
                :connectable-label="t('scan.connectable')"
                :already-connected-label="t('multiDevice.alreadyConnected')"
                :unknown-label="t('scan.unknownDevice')"
                :has-pin-config="!!devicePins[device.deviceId]"
                @connect="connectDevice"
                @config-pin="openPinModal"
              />
            </view>
          </scroll-view>
        </view>

      </view>
    </view>

    <!-- 错误提示 -->
    <view v-if="bleStore.errorMessage" class="error-toast anim-fade-in" :class="{ 'error-toast--wide': isWideScreen }">
      <text class="error-icon">⚠</text>
      <text class="error-msg">{{ bleStore.errorMessage }}</text>
      <view class="error-close" @click="bleStore.errorMessage = ''">
        <text class="error-close-text">✕</text>
      </view>
    </view>

    <!-- 设置面板 -->
    <SettingsPanel :visible="showSettings" @close="showSettings = false" />

    <!-- PIN 输入弹窗 -->
    <PinInputModal
      :visible="showPinModal"
      :device-id="pinTargetDevice?.deviceId ?? ''"
      :device-name="pinTargetDevice?.name ?? ''"
      :initial-config="pinTargetDevice ? devicePins[pinTargetDevice.deviceId] ?? null : null"
      @confirm="onPinConfirm"
      @clear="onPinClear"
      @cancel="showPinModal = false"
    />

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue'
import { useBleStore } from '../../store/bleStore'
import { useAppStore } from '../../store/appStore'
import { useI18n } from '../../composables/useI18n'
import { useResponsive } from '../../composables/useResponsive'
import { bleManager, BleAdapterState, type BleDevice } from '../../services/bleManager'
import {
  saveDevicePin, removeDevicePin, loadDevicePins,
  type DevicePinConfig,
} from '../../utils/buffer'
import DeviceItem from '../../components/DeviceItem.vue'
import RadarScanAnimation from '../../components/RadarScanAnimation.vue'
import SettingsPanel from '../../components/SettingsPanel.vue'
import PinInputModal from '../../components/PinInputModal.vue'
import LeftTabBar from '../../components/LeftTabBar.vue'

const bleStore = useBleStore()
const appStore = useAppStore()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const connectingId = ref<string | null>(null)
const showSettings = ref(false)
const rssiOptions = ['-100', '-90', '-80', '-70', '-60']
const rssiPickerIndex = ref(0)

// ── 扫描时长 ────────────────────────────────────────────────────────────────
const scanDuration = ref(30) // 默认 30 秒
const durationOpts = computed(() => [
  { value: 10, label: '10s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 0, label: `∞ ${t('scan.durationUnlimited')}` },
])

// ── PIN 码相关 ──────────────────────────────────────────────────────────────
const devicePins = reactive<Record<string, DevicePinConfig>>(loadDevicePins())
const showPinModal = ref(false)
const pinTargetDevice = ref<BleDevice | null>(null)

function openPinModal(device: BleDevice) {
  pinTargetDevice.value = device
  showPinModal.value = true
}

function onPinConfirm(config: DevicePinConfig, remember: boolean) {
  if (remember) {
    saveDevicePin(config)
    devicePins[config.deviceId] = config
  }
  showPinModal.value = false
  // 保存完 PIN 配置后立即连接
  if (pinTargetDevice.value) {
    connectDevice(pinTargetDevice.value)
  }
}

function onPinClear() {
  if (pinTargetDevice.value) {
    removeDevicePin(pinTargetDevice.value.deviceId)
    delete devicePins[pinTargetDevice.value.deviceId]
  }
  showPinModal.value = false
}

/**
 * 连接后自动发送 PIN 到指定特征值
 */
async function autoSendPin(config: DevicePinConfig, deviceId: string) {
  if (!config.autoSend || !config.charUUID || !config.serviceUUID) return
  try {
    let buf: ArrayBuffer
    if (config.mode === 'hex') {
      const hex = config.pin.replace(/\s+/g, '')
      const bytes = new Uint8Array(hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16)))
      buf = bytes.buffer
    } else {
      const encoder = new TextEncoder()
      buf = encoder.encode(config.pin).buffer
    }
    await bleManager.write(deviceId, config.serviceUUID, config.charUUID, buf)
    uni.showToast({ title: t('pin.pinSent'), icon: 'success', duration: 1500 })
  } catch {
    uni.showToast({ title: t('pin.pinSendFailed'), icon: 'none', duration: 2000 })
  }
}

onMounted(() => {
  bleStore.init()
  appStore.applySystemStyle()
  requestBlePermission()
})

onUnmounted(() => {
  // 多设备模式：有已连接设备时继续保持扫描，方便追加更多设备
  if (bleStore.isScanning && !bleStore.hasConnections) {
    bleStore.stopScan()
  }
})

// 主题变化时更新系统导航栏
watch(() => appStore.theme, () => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('scan.pageTitle') })
}, { immediate: false })

// 语言变化时更新导航栏标题
watch(() => appStore.locale, () => {
  uni.setNavigationBarTitle({ title: t('scan.pageTitle') })
}, { immediate: true })

async function requestBlePermission() {
  console.log('[ScanPage] requestBlePermission() called')
  // #ifdef APP-PLUS
  try {
    plus.android.requestPermissions(
      ['android.permission.BLUETOOTH_SCAN', 'android.permission.BLUETOOTH_CONNECT', 'android.permission.ACCESS_FINE_LOCATION'],
      (e: any) => {
        console.log('[ScanPage] permissions result — granted:', JSON.stringify(e.granted), '| denied:', JSON.stringify(e.denied), '| deniedAlways:', JSON.stringify(e.deniedAlways))
        if (e.deniedAlways?.length) {
          uni.showModal({ title: t('scan.permissionTitle'), content: t('scan.permissionDenied'), showCancel: false })
        }
      },
      (e: any) => {
        console.error('[ScanPage] requestPermissions error callback:', JSON.stringify(e))
      }
    )
  } catch (ex) {
    console.error('[ScanPage] requestBlePermission exception:', ex)
  }
  // #endif
}

async function toggleScan() {
  console.log('[ScanPage] toggleScan() called, isScanning:', bleStore.isScanning, '| bleState:', bleStore.bleState, '| duration:', scanDuration.value)
  if (bleStore.isScanning) {
    await bleStore.stopScan()
  } else {
    try {
      // scanDuration === 0 表示不限时（不传 timeout）
      const timeout = scanDuration.value > 0 ? scanDuration.value * 1000 : undefined
      await bleStore.startScan(timeout)
    } catch (e: any) {
      console.error('[ScanPage] toggleScan() startScan threw — code:', (e as any).code, '| message:', e.message)
      uni.showToast({ title: e.message ?? t('scan.scanFailed'), icon: 'none', duration: 2000 })
    }
  }
}

function clearDevices() { bleStore.scannedDevices = [] }

async function connectDevice(device: BleDevice) {
  // 已连接：切换到该设备的 session 并跳转调试页
  if (bleStore.sessions.has(device.deviceId)) {
    bleStore.switchSession(device.deviceId)
    uni.navigateTo({ url: '/pages/debug/index' })
    return
  }

  if (connectingId.value) return
  connectingId.value = device.deviceId

  // 连接数 >= 3 时给出提示
  if (bleStore.sessions.size >= 3) {
    uni.showToast({ title: t('multiDevice.tooManyWarning'), icon: 'none', duration: 3000 })
  }

  try {
    uni.showLoading({ title: t('scan.connecting'), mask: true })
    await bleStore.connectDevice(device)
    uni.hideLoading()
    uni.showToast({ title: t('scan.connectSuccess'), icon: 'success', duration: 1500 })

    // 连接成功后：若有 PIN 配置则处理自动发送
    const pinConfig = devicePins[device.deviceId]
    if (pinConfig) {
      if (pinConfig.autoSend && pinConfig.charUUID && pinConfig.serviceUUID) {
        await autoSendPin(pinConfig, device.deviceId)
      } else {
        uni.showToast({ title: t('pin.manualSendHint'), icon: 'none', duration: 2500 })
      }
    }

    uni.navigateTo({ url: '/pages/debug/index' })
  } catch (e: any) {
    uni.hideLoading()
    const errMsg = e.message ?? t('scan.connectFailed')
    uni.showModal({
      title: t('scan.connectFailed'),
      content: errMsg,
      confirmText: t('pin.retryWithPin'),
      cancelText: t('common.cancel'),
      success: (res) => {
        if (res.confirm) openPinModal(device)
      },
    })
  } finally {
    connectingId.value = null
  }
}

async function quickReconnect(recent: { deviceId: string; name: string }) {
  // 已连接：直接切换 session 跳调试页
  if (bleStore.sessions.has(recent.deviceId)) {
    bleStore.switchSession(recent.deviceId)
    uni.navigateTo({ url: '/pages/debug/index' })
    return
  }

  if (bleStore.sessions.size >= 3) {
    uni.showToast({ title: t('multiDevice.tooManyWarning'), icon: 'none', duration: 3000 })
  }

  uni.showLoading({ title: t('scan.reconnecting'), mask: true })
  try {
    const device: BleDevice = { deviceId: recent.deviceId, name: recent.name, RSSI: -999 }
    await bleStore.connectDevice(device)
    uni.hideLoading()
    uni.showToast({ title: t('scan.reconnectSuccess'), icon: 'success' })

    const pinConfig = devicePins[recent.deviceId]
    if (pinConfig?.autoSend && pinConfig.charUUID && pinConfig.serviceUUID) {
      await autoSendPin(pinConfig, recent.deviceId)
    }

    uni.navigateTo({ url: '/pages/debug/index' })
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: e.message ?? t('scan.reconnectFailed'), icon: 'none' })
  }
}

function onRssiChange(e: any) {
  rssiPickerIndex.value = e.detail.value
  bleStore.filterMinRssi = parseInt(rssiOptions[rssiPickerIndex.value])
}

const stateClass = computed(() => {
  const map: Record<BleAdapterState, string> = {
    [BleAdapterState.UNINITIALIZED]: 'idle',
    [BleAdapterState.IDLE]: bleStore.hasConnections ? 'connected' : 'idle',
    [BleAdapterState.SCANNING]: 'scanning',
  }
  return map[bleStore.adapterState] ?? 'idle'
})

const stateLabel = computed(() => {
  if (bleStore.adapterState === BleAdapterState.SCANNING) return t('status.scanning')
  if (bleStore.hasConnections) return `${t('status.connected')} (${bleStore.sessions.size})`
  if (bleStore.adapterState === BleAdapterState.IDLE) return t('status.idle')
  return t('status.uninitialized')
})

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60000) return t('scan.justNow')
  if (diff < 3600000) return `${Math.floor(diff / 60000)}${t('scan.minutesAgo')}`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}${t('scan.hoursAgo')}`
  return `${Math.floor(diff / 86400000)}${t('scan.daysAgo')}`
}
</script>

<style lang="scss" scoped>
.scan-page {
  min-height: 100vh;
  background: var(--bg-base);
}

/* ── 主体布局 ── */
.scan-body {
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 12px;
  min-height: 100vh;

  &--wide {
    flex-direction: row;
    height: 100vh;
    min-height: unset;
    padding: 0;
    padding-left: 60px; // 左侧导航栏偏移
    gap: 0;
    overflow: hidden;
  }
}

/* 左栏 */
.scan-left {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &--wide {
    flex: 4;
    padding: 12px;
    overflow-y: auto;
    border-right: 1px solid var(--border-subtle);
  }
}

/* 右栏 */
.scan-right {
  display: flex;
  flex-direction: column;
  gap: 12px;

  &--wide {
    flex: 6;
    padding: 12px;
    overflow-y: auto;
  }
}

/* ── 状态栏 ── */
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: var(--bg-panel);
  border-radius: 10px;
  border: 1px solid var(--border-subtle);
}

.status-left { display: flex; align-items: center; gap: 8px; }

.status-dot {
  width: 8px; height: 8px; border-radius: 50%;
  &.connected    { background: var(--color-accent); box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.6); }
  &.scanning     { background: var(--color-primary); animation: ble-blink 1s infinite; }
  &.disconnected { background: var(--color-danger); }
  &.idle         { background: var(--text-dimmed); }
}

.status-text { font-size: 13px; color: var(--text-secondary); font-family: 'Courier New', monospace; }

.status-right { display: flex; align-items: center; gap: 6px; }

.version-chip {
  font-size: 10px; color: var(--text-dimmed);
  background: var(--bg-elevated); padding: 2px 7px; border-radius: 4px;
}

.lang-quick-btn, .theme-quick-btn, .settings-trigger {
  width: 30px; height: 30px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 7px;
  &:active { opacity: 0.7; }
}

.lang-quick-text { font-size: 11px; font-weight: 700; color: var(--color-primary); }
.theme-icon      { font-size: 14px; color: var(--color-warning); }
.settings-icon   { font-size: 15px; color: var(--text-muted); }

/* ── 雷达区 ── */
.radar-section { display: flex; justify-content: center; padding: 12px 0 4px; }

/* ── 控制卡片 ── */
.control-card {
  background: var(--bg-panel);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  padding: 14px;
  display: flex; flex-direction: column; gap: 12px;
}

.filter-row { display: flex; gap: 10px; align-items: center; }

.filter-input-wrap {
  flex: 1; display: flex; align-items: center; gap: 8px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 8px; padding: 8px 12px;
}
.filter-icon { font-size: 16px; color: var(--text-muted); flex-shrink: 0; }
.filter-input { flex: 1; font-size: 13px; color: var(--text-primary); background: transparent; border: none; }
.filter-ph { color: var(--text-dimmed); }
.filter-clear { width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); border-radius: 50%; }
.filter-clear-icon { font-size: 10px; color: var(--text-secondary); }

.rssi-filter { display: flex; flex-direction: column; align-items: center; gap: 2px; flex-shrink: 0; }
.rssi-label { font-size: 10px; color: var(--text-muted); }
.rssi-picker { display: flex; align-items: center; gap: 2px; padding: 6px 10px; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 6px; }
.rssi-value { font-size: 12px; color: var(--color-primary); font-family: 'Courier New', monospace; }
.rssi-arr { font-size: 10px; color: var(--text-muted); }

/* ── 扫描时长选择 ── */
.duration-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.duration-label {
  font-size: 11px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.duration-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.dur-chip {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--border-default);
  background: var(--bg-input);
  &:active { opacity: 0.7; }
  &--active {
    background: rgba(var(--color-primary-rgb), 0.12);
    border-color: rgba(var(--color-primary-rgb), 0.5);
  }
}
.dur-chip-text {
  font-size: 12px;
  color: var(--text-secondary);
  font-family: 'Courier New', monospace;
  .dur-chip--active & { color: var(--color-primary); font-weight: 600; }
}

/* ── 扫描按钮 ── */
.scan-btn-row { display: flex; gap: 10px; }

.scan-main-btn {
  flex: 1; height: 48px; display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--color-primary) 0%, rgba(var(--color-primary-rgb), 0.7) 100%);
  border-radius: 10px;
  box-shadow: 0 0 20px rgba(var(--color-primary-rgb), 0.35);
  transition: all 0.2s;
  &:active { opacity: 0.85; transform: scale(0.98); }
  &--stop {
    background: linear-gradient(135deg, var(--color-danger) 0%, rgba(var(--color-danger-rgb), 0.7) 100%);
    box-shadow: 0 0 20px rgba(var(--color-danger-rgb), 0.35);
  }
}
.btn-inner { display: flex; align-items: center; gap: 8px; }
.btn-spin { width: 20px; height: 20px; border: 2px solid rgba(10,15,28,0.3); border-top-color: #0A0F1C; border-radius: 50%; animation: ble-spin 0.8s linear infinite; }
.btn-icon { font-size: 18px; color: var(--bg-base); }
.btn-label { font-size: 15px; font-weight: 700; color: var(--bg-base); letter-spacing: 0.5px; }

.clear-btn { height: 48px; padding: 0 20px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 10px; &:active { opacity: 0.7; } }
.clear-label { font-size: 14px; color: var(--text-secondary); }

/* ── 最近连接 ── */
.recent-section { background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border-subtle); padding: 14px; }

.section-hd { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
.section-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.section-count { font-size: 11px; color: var(--text-muted); background: var(--bg-elevated); padding: 1px 7px; border-radius: 999px; }
.section-badges { display: flex; align-items: center; gap: 8px; }
.count-badge { background: rgba(var(--color-primary-rgb), 0.12); border: 1px solid rgba(var(--color-primary-rgb), 0.25); border-radius: 999px; padding: 1px 8px; }
.count-text { font-size: 11px; color: var(--color-primary); font-weight: 600; }
.scanning-badge { display: flex; align-items: center; gap: 4px; }
.scanning-dot { font-size: 8px; color: var(--color-primary); }
.scanning-text { font-size: 11px; color: var(--color-primary); }

.recent-list { display: flex; flex-direction: column; gap: 8px; }
.recent-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-card); border-radius: 8px; border: 1px solid var(--border-subtle); &:active { background: var(--bg-elevated); } }
.recent-icon { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(var(--color-primary-rgb), 0.08); border-radius: 8px; }
.ri-text { font-size: 16px; color: var(--color-primary); }
.recent-info { flex: 1; }
.recent-name { font-size: 14px; color: var(--text-primary); font-weight: 500; display: block; }
.recent-time { font-size: 11px; color: var(--text-muted); display: block; margin-top: 2px; }
.recent-arr { font-size: 18px; color: var(--text-muted); }

/* ── 设备列表 ── */
.device-section { flex: 1; display: flex; flex-direction: column; }
.device-scroll {
  flex: 1;
  max-height: 400px;
  &--wide { max-height: none; min-height: 200px; }
}
.device-list { display: flex; flex-direction: column; gap: 8px; padding-bottom: 8px; }

.list-empty { display: flex; align-items: center; justify-content: center; padding: 40px 24px; background: var(--bg-panel); border-radius: 12px; border: 1px dashed var(--border-subtle); }
.empty-scan-text { font-size: 13px; color: var(--text-dimmed); }
.empty-idle { display: flex; flex-direction: column; align-items: center; gap: 10px; }
.empty-icon { font-size: 40px; color: var(--bg-elevated); }
.empty-tip { font-size: 13px; color: var(--text-muted); text-align: center; line-height: 1.6; }

/* ── 错误提示 ── */
.error-toast {
  position: fixed; bottom: 100px; left: 16px; right: 16px;
  display: flex; align-items: center; gap: 8px; padding: 12px 16px;
  background: var(--bg-panel); border: 1px solid var(--color-danger);
  border-radius: 10px; box-shadow: 0 4px 20px rgba(var(--color-danger-rgb), 0.2); z-index: 100;
  &--wide { left: 76px; } // 60px sidebar + 16px margin
}
.error-icon { font-size: 16px; color: var(--color-danger); flex-shrink: 0; }
.error-msg { flex: 1; font-size: 13px; color: var(--color-danger); }
.error-close { width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; }
.error-close-text { font-size: 12px; color: var(--color-danger); }
</style>
