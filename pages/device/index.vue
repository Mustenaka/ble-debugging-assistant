<template>
  <view class="device-page" :class="appStore.themeClass" :style="appStore.cssVarsStyle">

    <!-- 设备信息卡 -->
    <view class="device-info-card">
      <view class="card-inner">
        <view class="device-icon-wrap">
          <view class="device-icon" :class="{ 'device-icon--connected': bleStore.isConnected }">
            <text class="device-icon-text">⬡</text>
          </view>
          <view class="conn-ring" :class="{ 'ring--connected': bleStore.isConnected }" />
        </view>

        <view class="device-details">
          <text class="device-name">{{ bleStore.connectedDevice?.name ?? t('common.unknown') }}</text>
          <text class="device-id mono">{{ bleStore.connectedDevice?.deviceId ?? '--' }}</text>
          <view class="conn-state">
            <view class="status-dot" :class="bleStore.isConnected ? 'connected' : 'disconnected'" />
            <text class="state-label">{{ bleStore.isConnected ? t('common.connected') : t('common.disconnected') }}</text>
            <view v-if="bleStore.connectedDevice?.RSSI && bleStore.connectedDevice.RSSI > -999" class="rssi-chip">
              <text class="rssi-text">{{ bleStore.connectedDevice.RSSI }} dBm</text>
            </view>
          </view>
        </view>

        <view class="device-actions">
          <view class="disconnect-btn" @click="handleDisconnect">
            <text class="disconnect-text">{{ t('device.disconnect') }}</text>
          </view>
          <!-- 主题/语言快捷按钮 -->
          <view class="quick-row">
            <view class="icon-btn" @click="appStore.toggleTheme()">
              <text class="ib-icon">{{ appStore.isDark ? '☀' : '◑' }}</text>
            </view>
            <view class="icon-btn" @click="showSettings = true">
              <text class="ib-icon">⚙</text>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 加载中 -->
    <view v-if="isLoadingServices" class="loading-card">
      <view class="loading-inner">
        <view class="loading-ring" />
        <text class="loading-text">{{ t('device.parsingServices') }}</text>
      </view>
    </view>

    <!-- 服务树 -->
    <view v-else class="services-section">
      <view class="section-hd">
        <text class="section-title">{{ t('device.servicesTitle') }}</text>
        <view class="refresh-btn" @click="reloadServices">
          <text class="refresh-icon">↻</text>
        </view>
      </view>

      <view v-if="!bleStore.services.length" class="empty-services">
        <text class="empty-services-text">{{ t('device.noServices') }}</text>
      </view>

      <view v-for="service in serviceTree" :key="service.uuid" class="service-node">
        <!-- 服务行 -->
        <view
          class="service-row"
          :class="{ 'service-row--expanded': service.expanded, 'service-row--active': activeService === service.uuid }"
          @click="toggleService(service)"
        >
          <view class="service-indicator" :class="{ 'ind--active': service.expanded }" />
          <view class="service-info">
            <view class="service-uuid-row">
              <text class="service-uuid mono">{{ shortUUID(service.uuid) }}</text>
              <view v-if="service.isPrimary" class="primary-badge">
                <text class="primary-text">PRIMARY</text>
              </view>
            </view>
            <text class="service-full-uuid">{{ service.uuid }}</text>
          </view>
          <view class="expand-icon" :class="{ 'expand-icon--open': service.expanded }">
            <text class="expand-text">›</text>
          </view>
        </view>

        <!-- 特征值列表 -->
        <view v-if="service.expanded" class="char-list">
          <view v-if="service.loading" class="char-loading">
            <view class="mini-ring" />
            <text class="char-loading-text">{{ t('device.loadingChars') }}</text>
          </view>

          <view
            v-for="char in service.characteristics"
            :key="char.uuid"
            class="char-node"
            :class="{ 'char-node--selected': isSelectedChar(service.uuid, char.uuid) }"
            @click="selectCharacteristic(service.uuid, char.uuid)"
          >
            <view class="char-tree-line" />
            <view class="char-content">
              <view class="char-header">
                <text class="branch-text">├</text>
                <text class="char-uuid mono">{{ shortUUID(char.uuid) }}</text>
                <view v-if="isSelectedChar(service.uuid, char.uuid)" class="selected-dot" />
              </view>
              <text class="char-full-uuid">{{ char.uuid }}</text>
              <view class="char-props">
                <view v-if="char.properties.read"          class="prop-badge prop-r"><text class="prop-text">{{ t('device.properties.read') }}</text></view>
                <view v-if="char.properties.write"         class="prop-badge prop-w"><text class="prop-text">{{ t('device.properties.write') }}</text></view>
                <view v-if="char.properties.writeNoResponse" class="prop-badge prop-w"><text class="prop-text">{{ t('device.properties.writeNoResponse') }}</text></view>
                <view v-if="char.properties.notify"        class="prop-badge prop-n"><text class="prop-text">{{ t('device.properties.notify') }}</text></view>
                <view v-if="char.properties.indicate"      class="prop-badge prop-n"><text class="prop-text">{{ t('device.properties.indicate') }}</text></view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view v-if="bleStore.activeCharacteristicId" class="bottom-bar">
      <view class="selected-info">
        <text class="sel-label">{{ t('device.selected') }}</text>
        <text class="sel-uuid mono">{{ shortUUID(bleStore.activeCharacteristicId) }}</text>
        <view class="sel-props">
          <text v-if="bleStore.activeCharacteristic?.properties.write"  class="sp sp-w">W</text>
          <text v-if="bleStore.activeCharacteristic?.properties.notify" class="sp sp-n">N</text>
          <text v-if="bleStore.activeCharacteristic?.properties.read"   class="sp sp-r">R</text>
        </view>
      </view>
      <view class="go-debug-btn" @click="goToDebug">
        <text class="go-debug-text">{{ t('device.startDebug') }}</text>
        <text class="go-debug-arrow">→</text>
      </view>
    </view>

    <!-- 设置面板 -->
    <SettingsPanel :visible="showSettings" @close="showSettings = false" />

  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useBleStore } from '../../store/bleStore'
import { useAppStore } from '../../store/appStore'
import { useI18n } from '../../composables/useI18n'
import type { BleCharacteristic } from '../../services/bleManager'
import { shortUUID } from '../../utils/hex'
import SettingsPanel from '../../components/SettingsPanel.vue'

const bleStore = useBleStore()
const appStore = useAppStore()
const { t } = useI18n()

const isLoadingServices = ref(false)
const showSettings = ref(false)
const activeService = ref('')

interface ServiceNode {
  uuid: string; isPrimary: boolean
  expanded: boolean; loading: boolean
  characteristics: BleCharacteristic[]
}
const serviceTree = ref<ServiceNode[]>([])

onMounted(async () => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('device.pageTitle') })
  if (!bleStore.isConnected) {
    uni.showToast({ title: t('device.noDevice'), icon: 'none' }); return
  }
  await reloadServices()
})

async function reloadServices() {
  if (!bleStore.connectedDevice) return
  isLoadingServices.value = true
  try {
    await bleStore.loadDeviceServices(bleStore.connectedDevice.deviceId)
    serviceTree.value = bleStore.services.map((s) => ({
      uuid: s.uuid, isPrimary: s.isPrimary, expanded: false, loading: false, characteristics: [],
    }))
    if (serviceTree.value.length > 0) await toggleService(serviceTree.value[0])
  } catch (e: any) {
    uni.showToast({ title: e.message ?? t('device.loadServicesFailed'), icon: 'none' })
  } finally {
    isLoadingServices.value = false
  }
}

async function toggleService(node: ServiceNode) {
  if (node.expanded) { node.expanded = false; return }
  node.expanded = true
  activeService.value = node.uuid
  if (!node.characteristics.length) {
    node.loading = true
    try {
      await bleStore.loadCharacteristics(node.uuid)
      node.characteristics = bleStore.characteristics.get(node.uuid) ?? []
    } catch (e: any) {
      uni.showToast({ title: e.message ?? t('device.loadCharsFailed'), icon: 'none' })
    } finally { node.loading = false }
  }
}

function selectCharacteristic(serviceId: string, charId: string) {
  bleStore.activeServiceId = serviceId
  bleStore.selectCharacteristic(charId)
  uni.showToast({ title: `${t('device.selected')} ${shortUUID(charId)}`, icon: 'none', duration: 1000 })
}

function isSelectedChar(serviceId: string, charId: string) {
  return bleStore.activeServiceId === serviceId && bleStore.activeCharacteristicId === charId
}

function goToDebug() { uni.navigateTo({ url: '/pages/debug/index' }) }

function handleDisconnect() {
  uni.showModal({
    title: t('device.disconnectTitle'),
    content: `${t('device.disconnectConfirm')} "${bleStore.connectedDevice?.name}" ${t('device.disconnectSuffix')}`,
    confirmColor: '#DC2626',
    success: async (res) => {
      if (res.confirm) { await bleStore.disconnectDevice(); uni.navigateBack() }
    },
  })
}
</script>

<style lang="scss" scoped>
.device-page {
  min-height: 100vh; background: var(--bg-base);
  padding: 12px 12px 80px; display: flex; flex-direction: column; gap: 12px;
}

/* ── 设备信息卡 ── */
.device-info-card { background: var(--bg-panel); border-radius: 14px; border: 1px solid var(--border-subtle); padding: 16px; }
.card-inner { display: flex; align-items: center; gap: 14px; }
.device-icon-wrap { position: relative; flex-shrink: 0; }
.device-icon {
  width: 52px; height: 52px; border-radius: 14px; background: var(--bg-card);
  display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-subtle);
  &--connected { border-color: rgba(var(--color-accent-rgb), 0.4); box-shadow: 0 0 14px rgba(var(--color-accent-rgb), 0.2); }
}
.device-icon-text { font-size: 26px; color: var(--color-primary); }
.conn-ring {
  position: absolute; top: -3px; right: -3px; width: 14px; height: 14px;
  border-radius: 50%; background: var(--text-dimmed); border: 2px solid var(--bg-panel);
  &.ring--connected { background: var(--color-accent); box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.7); }
}
.device-details { flex: 1; min-width: 0; }
.device-name { font-size: 16px; font-weight: 700; color: var(--text-primary); display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.device-id { font-size: 11px; color: var(--text-dimmed); display: block; margin: 3px 0 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.conn-state { display: flex; align-items: center; gap: 6px; }
.status-dot { width: 7px; height: 7px; border-radius: 50%; &.connected { background: var(--color-accent); } &.disconnected { background: var(--color-danger); } }
.state-label { font-size: 12px; color: var(--text-secondary); }
.rssi-chip { background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.2); border-radius: 999px; padding: 1px 8px; }
.rssi-text { font-size: 11px; color: var(--color-primary); font-family: 'Courier New', monospace; }

.device-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; align-items: flex-end; }
.disconnect-btn { padding: 6px 14px; background: rgba(var(--color-danger-rgb), 0.1); border: 1px solid rgba(var(--color-danger-rgb), 0.3); border-radius: 8px; &:active { opacity: 0.75; } }
.disconnect-text { font-size: 13px; color: var(--color-danger); font-weight: 500; }
.quick-row { display: flex; gap: 5px; }
.icon-btn { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 7px; &:active { opacity: 0.7; } }
.ib-icon { font-size: 13px; color: var(--text-muted); }

/* ── 加载 ── */
.loading-card { background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border-subtle); padding: 32px; }
.loading-inner { display: flex; flex-direction: column; align-items: center; gap: 14px; }
.loading-ring { width: 36px; height: 36px; border: 3px solid var(--border-subtle); border-top-color: var(--color-primary); border-radius: 50%; animation: ble-spin 1s linear infinite; }
.loading-text { font-size: 13px; color: var(--text-muted); font-family: 'Courier New', monospace; }

/* ── 服务区 ── */
.services-section { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.section-hd { display: flex; align-items: center; justify-content: space-between; padding: 0 2px; margin-bottom: 4px; }
.section-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); }
.refresh-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(var(--color-primary-rgb), 0.06); border: 1px solid rgba(var(--color-primary-rgb), 0.15); border-radius: 8px; &:active { opacity: 0.7; } }
.refresh-icon { font-size: 16px; color: var(--color-primary); }

.empty-services { padding: 32px; text-align: center; background: var(--bg-panel); border-radius: 12px; border: 1px dashed var(--border-subtle); }
.empty-services-text { font-size: 13px; color: var(--text-dimmed); }

/* ── 服务节点 ── */
.service-node { background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border-subtle); overflow: hidden; }
.service-row {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px; transition: background 0.2s;
  &:active { background: rgba(var(--color-primary-rgb), 0.04); }
  &--expanded { background: rgba(var(--color-primary-rgb), 0.03); border-bottom: 1px solid var(--border-subtle); }
}
.service-indicator { width: 4px; height: 20px; border-radius: 2px; background: var(--bg-elevated); flex-shrink: 0; &.ind--active { background: var(--color-primary); box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.5); } }
.service-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.service-uuid-row { display: flex; align-items: center; gap: 8px; }
.service-uuid { font-size: 15px; font-weight: 600; color: var(--color-primary); }
.service-full-uuid { font-size: 10px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.primary-badge { background: rgba(var(--color-purple, 139,92,246), 0.12); border: 1px solid rgba(var(--color-purple, 139,92,246), 0.25); border-radius: 3px; padding: 1px 6px; }
.primary-text { font-size: 9px; color: var(--color-purple); font-weight: 700; letter-spacing: 0.5px; }
.expand-icon { flex-shrink: 0; transition: transform 0.2s; &--open { transform: rotate(90deg); } }
.expand-text { font-size: 18px; color: var(--text-muted); }

/* ── 特征值 ── */
.char-list { padding: 8px 12px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
.char-loading { display: flex; align-items: center; gap: 8px; padding: 10px; }
.mini-ring { width: 16px; height: 16px; border: 2px solid var(--border-subtle); border-top-color: var(--color-primary); border-radius: 50%; animation: ble-spin 0.8s linear infinite; }
.char-loading-text { font-size: 12px; color: var(--text-muted); }

.char-node {
  display: flex; gap: 8px; padding: 10px 12px; border-radius: 8px; border: 1px solid transparent;
  background: rgba(0,0,0,0.05); transition: all 0.2s;
  &:active { background: rgba(var(--color-primary-rgb), 0.05); }
  &--selected { background: rgba(var(--color-primary-rgb), 0.06); border-color: rgba(var(--color-primary-rgb), 0.2); }
}
.char-tree-line { width: 1px; background: rgba(var(--color-primary-rgb), 0.15); border-radius: 1px; flex-shrink: 0; }
.char-content { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.char-header { display: flex; align-items: center; gap: 6px; }
.branch-text { font-size: 14px; color: var(--text-dimmed); font-family: 'Courier New', monospace; }
.char-uuid { font-size: 14px; font-weight: 600; color: var(--color-info); flex: 1; }
.selected-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 6px rgba(var(--color-accent-rgb), 0.6); flex-shrink: 0; }
.char-full-uuid { font-size: 10px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 20px; }
.char-props { display: flex; flex-wrap: wrap; gap: 4px; padding-left: 20px; }

.prop-badge { padding: 1px 7px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.5px; }
.prop-r { background: rgba(var(--color-info, 96,165,250), 0.12); border: 1px solid rgba(var(--color-info, 96,165,250), 0.25); .prop-text { color: var(--color-info); } }
.prop-w { background: rgba(var(--color-primary-rgb), 0.12); border: 1px solid rgba(var(--color-primary-rgb), 0.25); .prop-text { color: var(--color-primary); } }
.prop-n { background: rgba(var(--color-accent-rgb), 0.12); border: 1px solid rgba(var(--color-accent-rgb), 0.25); .prop-text { color: var(--color-accent); } }
.prop-text { font-size: 9px; font-weight: 700; }

/* ── 底部栏 ── */
.bottom-bar {
  position: fixed; bottom: 0; left: 0; right: 0;
  background: var(--bg-panel); border-top: 1px solid var(--border-subtle);
  padding: 12px 16px; padding-bottom: calc(12px + env(safe-area-inset-bottom));
  display: flex; align-items: center; gap: 12px; z-index: 50;
}
.selected-info { flex: 1; display: flex; align-items: center; gap: 6px; }
.sel-label { font-size: 12px; color: var(--text-muted); }
.sel-uuid { font-size: 13px; color: var(--color-primary); font-weight: 600; }
.sel-props { display: flex; gap: 4px; }
.sp { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
.sp-w { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }
.sp-n { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-accent); }
.sp-r { background: rgba(var(--color-info, 96,165,250), 0.12); color: var(--color-info); }

.go-debug-btn {
  display: flex; align-items: center; gap: 6px;
  background: linear-gradient(135deg, var(--color-accent) 0%, rgba(var(--color-accent-rgb), 0.7) 100%);
  border-radius: 10px; padding: 10px 20px;
  box-shadow: 0 0 16px rgba(var(--color-accent-rgb), 0.3);
  &:active { opacity: 0.85; }
}
.go-debug-text { font-size: 14px; font-weight: 700; color: var(--bg-base); }
.go-debug-arrow { font-size: 14px; color: var(--bg-base); }
</style>
