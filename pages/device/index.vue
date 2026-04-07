<template>
  <view class="device-page" :class="[appStore.themeClass, { 'device-page--wide': isWideScreen }]" :style="appStore.cssVarsStyle">

    <!-- 宽屏左侧导航栏 -->
    <LeftTabBar v-if="isWideScreen" current-path="/pages/device/index" />

    <!-- 页面头部 -->
    <view class="page-header">
      <view class="header-left">
        <text class="page-title">{{ t('device.pageTitle') }}</text>
        <view v-if="sessionEntries.length" class="conn-count-badge">
          <text class="conn-count-text">{{ sessionEntries.length }}</text>
        </view>
      </view>
      <view class="header-right">
        <view class="icon-btn" @click="appStore.toggleTheme()">
          <text class="ib-icon">{{ appStore.isDark ? '☀' : '◑' }}</text>
        </view>
        <view class="icon-btn" @click="showSettings = true">
          <text class="ib-icon">⚙</text>
        </view>
      </view>
    </view>

    <!-- 无会话空状态 -->
    <view v-if="!sessionEntries.length" class="empty-state">
      <text class="empty-icon">⬡</text>
      <text class="empty-tip">{{ t('multiDevice.noSessions') }}</text>
      <view class="go-scan-btn" @click="goToScan">
        <text class="go-scan-text">{{ t('scan.startScan') }}</text>
      </view>
    </view>

    <!-- 会话列表 -->
    <scroll-view v-else scroll-y class="sessions-scroll">
      <view class="sessions-list">
        <view
          v-for="{ deviceId, session } in sessionEntries"
          :key="deviceId"
          class="session-card"
        >
          <!-- 设备头部 -->
          <view class="session-header" @click="toggleSession(deviceId)">
            <view class="session-icon-wrap">
              <view class="session-icon">
                <text class="session-icon-text">⬡</text>
              </view>
              <view class="conn-ring ring--connected" />
            </view>

            <view class="session-info">
              <text class="session-name">{{ session.device.name }}</text>
              <text class="session-id mono">{{ session.device.deviceId }}</text>
              <view class="session-meta">
                <view class="rssi-chip">
                  <text class="rssi-chip-text">{{ session.device.RSSI }} dBm</text>
                </view>
                <view class="mtu-chip">
                  <text class="mtu-chip-text">MTU {{ session.currentMtu }}</text>
                </view>
              </view>
            </view>

            <view class="session-actions">
              <view class="debug-btn" @click.stop="goToDebug(deviceId)">
                <text class="debug-btn-text">{{ t('multiDevice.goToDebug') }}</text>
              </view>
              <view class="disc-btn" @click.stop="handleDisconnect(deviceId, session.device.name)">
                <text class="disc-btn-text">{{ t('device.disconnect') }}</text>
              </view>
              <view class="expand-chevron" :class="{ 'expand-chevron--open': expandedSessions.has(deviceId) }">
                <text class="chevron-text">›</text>
              </view>
            </view>
          </view>

          <!-- RSSI 图表（仅展开时显示） -->
          <view v-if="expandedSessions.has(deviceId) && session.rssiHistory.length >= 2" class="rssi-section">
            <RssiChart
              :history="session.rssiHistory"
              :title="t('device.rssiChart')"
              waiting-text="..."
            />
          </view>

          <!-- MTU 协商（展开时显示） -->
          <view v-if="expandedSessions.has(deviceId)" class="mtu-section">
            <text class="mtu-label">{{ t('device.mtu') }}</text>
            <view class="mtu-row">
              <input
                class="mtu-input"
                v-model="mtuInputs[deviceId]"
                type="number"
                :placeholder="t('device.mtuInputPlaceholder')"
                placeholder-class="mtu-ph"
              />
              <view
                class="mtu-btn"
                :class="{ 'mtu-btn--loading': negotiatingIds.has(deviceId) }"
                @click="handleMtuNegotiate(deviceId)"
              >
                <view v-if="negotiatingIds.has(deviceId)" class="mini-spin" />
                <text v-else class="mtu-btn-text">{{ t('device.mtuNegotiate') }}</text>
              </view>
              <view class="mtu-current">
                <text class="mtu-current-label">MTU</text>
                <text class="mtu-current-val">{{ session.currentMtu }}</text>
              </view>
            </view>
          </view>

          <!-- 服务树（展开时显示） -->
          <view v-if="expandedSessions.has(deviceId)" class="service-tree">
            <view class="tree-header">
              <text class="tree-title">{{ t('device.servicesTitle') }}</text>
              <view class="export-btn" @click="openExport(deviceId)">
                <text class="export-btn-icon">⬆</text>
                <text class="export-btn-label">{{ t('device.export.btn') }}</text>
              </view>
              <view class="refresh-btn" @click="reloadServices(deviceId)">
                <text class="refresh-icon">↻</text>
              </view>
            </view>

            <view v-if="loadingIds.has(deviceId)" class="tree-loading">
              <view class="loading-ring" />
              <text class="loading-text">{{ t('device.parsingServices') }}</text>
            </view>

            <view v-else-if="!session.services.length" class="empty-services">
              <text class="empty-services-text">{{ t('device.noServices') }}</text>
            </view>

            <view
              v-for="service in getServiceTree(deviceId)"
              :key="service.uuid"
              class="service-node"
            >
              <!-- 服务行 -->
              <view
                class="service-row"
                :class="{ 'service-row--expanded': service.expanded }"
                @click="toggleService(deviceId, service)"
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
                  :class="{ 'char-node--selected': isSelectedChar(deviceId, service.uuid, char.uuid) }"
                  @click="selectChar(deviceId, service.uuid, char.uuid)"
                >
                  <view class="char-tree-line" />
                  <view class="char-content">
                    <view class="char-header">
                      <text class="branch-text">├</text>
                      <text class="char-uuid mono">{{ shortUUID(char.uuid) }}</text>
                      <view v-if="isSelectedChar(deviceId, service.uuid, char.uuid)" class="selected-dot" />
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
        </view>
      </view>
    </scroll-view>

    <!-- 设置面板 -->
    <SettingsPanel :visible="showSettings" @close="showSettings = false" />

    <!-- 导出弹窗 -->
    <view v-if="showExportModal" class="modal-overlay" @click="showExportModal = false">
      <view class="modal-card" @click.stop>
        <text class="modal-title">{{ t('device.export.title') }}</text>
        <view class="fmt-tabs">
          <view
            v-for="fmt in exportFormats"
            :key="fmt.value"
            class="fmt-tab"
            :class="{ 'fmt-tab--active': exportFormat === fmt.value }"
            @click="exportFormat = fmt.value"
          >
            <text class="fmt-tab-text">{{ fmt.label }}</text>
          </view>
        </view>
        <view class="notes-section">
          <text class="notes-label">{{ t('device.export.notesLabel') }}</text>
          <textarea
            class="notes-input"
            v-model="exportNotes"
            :placeholder="t('device.export.notesPlaceholder')"
            placeholder-class="notes-ph"
            maxlength="500"
            :auto-height="true"
          />
        </view>
        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @click="showExportModal = false">
            <text>{{ t('common.cancel') }}</text>
          </view>
          <view class="modal-btn modal-btn--confirm" :class="{ 'modal-btn--loading': isExporting }" @click="confirmExport">
            <view v-if="isExporting" class="mini-spin" />
            <text v-else>{{ t('device.export.confirm') }}</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted, watch } from 'vue'
import { useBleStore, type DeviceSession } from '../../store/bleStore'
import { useAppStore } from '../../store/appStore'
import { useI18n } from '../../composables/useI18n'
import { useResponsive } from '../../composables/useResponsive'
import type { BleCharacteristic } from '../../services/bleManager'
import { shortUUID } from '../../utils/hex'
import {
  saveLogsToFile, buildDeviceReportFilename,
  exportDeviceReportToText, exportDeviceReportToMarkdown, exportDeviceReportToCSV,
  type DeviceReportInfo,
} from '../../utils/buffer'
import SettingsPanel from '../../components/SettingsPanel.vue'
import RssiChart from '../../components/RssiChart.vue'
import LeftTabBar from '../../components/LeftTabBar.vue'

const bleStore = useBleStore()
const appStore = useAppStore()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const showSettings = ref(false)
const expandedSessions = reactive<Set<string>>(new Set())
const loadingIds = reactive<Set<string>>(new Set())
const negotiatingIds = reactive<Set<string>>(new Set())
const mtuInputs = reactive<Record<string, string>>({})

// ── 导出 ──
const showExportModal = ref(false)
const exportNotes = ref('')
const exportFormat = ref<'txt' | 'md' | 'csv'>('txt')
const isExporting = ref(false)
const exportTargetId = ref<string>('')
const exportFormats = computed(() => [
  { value: 'txt', label: t('device.export.fmtTxt') },
  { value: 'md',  label: t('device.export.fmtMd') },
  { value: 'csv', label: t('device.export.fmtCsv') },
])

// ── 服务树状态（每 deviceId 独立）───────────────────────────────────────────

interface ServiceNode {
  uuid: string
  isPrimary: boolean
  expanded: boolean
  loading: boolean
  characteristics: BleCharacteristic[]
}

const serviceTrees = reactive<Record<string, ServiceNode[]>>({})

function getServiceTree(deviceId: string): ServiceNode[] {
  return serviceTrees[deviceId] ?? []
}

// ── 计算：session 列表 ────────────────────────────────────────────────────────

const sessionEntries = computed<{ deviceId: string; session: DeviceSession }[]>(() => {
  const list: { deviceId: string; session: DeviceSession }[] = []
  bleStore.sessions.forEach((session, deviceId) => {
    list.push({ deviceId, session })
  })
  return list
})

onMounted(async () => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('device.pageTitle') })
  // 展开所有 session 并加载服务
  for (const { deviceId } of sessionEntries.value) {
    expandedSessions.add(deviceId)
    await reloadServices(deviceId)
  }
})

watch(() => appStore.theme, () => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('device.pageTitle') })
})

watch(() => appStore.locale, () => {
  uni.setNavigationBarTitle({ title: t('device.pageTitle') })
})

// ── 展开/折叠 session ────────────────────────────────────────────────────────

function toggleSession(deviceId: string) {
  if (expandedSessions.has(deviceId)) {
    expandedSessions.delete(deviceId)
  } else {
    expandedSessions.add(deviceId)
    if (!serviceTrees[deviceId]) reloadServices(deviceId)
  }
}

// ── 服务加载 ──────────────────────────────────────────────────────────────────

async function reloadServices(deviceId: string) {
  loadingIds.add(deviceId)
  try {
    await bleStore.loadDeviceServices(deviceId)
    const session = bleStore.sessions.get(deviceId)
    serviceTrees[deviceId] = (session?.services ?? []).map((s) => ({
      uuid: s.uuid,
      isPrimary: s.isPrimary,
      expanded: false,
      loading: false,
      characteristics: [],
    }))
    // 自动展开第一个服务
    if (serviceTrees[deviceId].length > 0) {
      await toggleService(deviceId, serviceTrees[deviceId][0])
    }
  } catch (e: any) {
    uni.showToast({ title: e.message ?? t('device.loadServicesFailed'), icon: 'none' })
  } finally {
    loadingIds.delete(deviceId)
  }
}

// ── 服务树交互 ────────────────────────────────────────────────────────────────

async function toggleService(deviceId: string, node: ServiceNode) {
  if (node.expanded) { node.expanded = false; return }
  node.expanded = true
  if (!node.characteristics.length) {
    node.loading = true
    try {
      await bleStore.loadCharacteristics(node.uuid, deviceId)
      const session = bleStore.sessions.get(deviceId)
      node.characteristics = session?.characteristics.get(node.uuid) ?? []
    } catch (e: any) {
      uni.showToast({ title: e.message ?? t('device.loadCharsFailed'), icon: 'none' })
    } finally {
      node.loading = false
    }
  }
}

function isSelectedChar(deviceId: string, serviceId: string, charId: string): boolean {
  const session = bleStore.sessions.get(deviceId)
  return session?.activeServiceId === serviceId && session?.activeCharacteristicId === charId
}

function selectChar(deviceId: string, serviceId: string, charId: string) {
  bleStore.selectCharacteristic(charId, deviceId)
  // 同步 activeServiceId 到 session
  const session = bleStore.sessions.get(deviceId)
  if (session) session.activeServiceId = serviceId
  uni.showToast({ title: `${t('device.selected')} ${shortUUID(charId)}`, icon: 'none', duration: 1000 })
}

// ── MTU 协商 ──────────────────────────────────────────────────────────────────

async function handleMtuNegotiate(deviceId: string) {
  const mtu = parseInt(mtuInputs[deviceId] ?? '')
  if (isNaN(mtu) || mtu < 23 || mtu > 512) {
    uni.showToast({ title: t('device.mtuInputPlaceholder'), icon: 'none' }); return
  }
  negotiatingIds.add(deviceId)
  try {
    const actual = await bleStore.negotiateMtu(mtu, deviceId)
    uni.showToast({ title: `${t('device.mtuSuccess')} ${actual}`, icon: 'none', duration: 2000 })
  } catch (e: any) {
    uni.showToast({ title: e.message ?? t('device.mtuFailed'), icon: 'none' })
  } finally {
    negotiatingIds.delete(deviceId)
  }
}

// ── 导航 ────────────────────────────────────────────────────────────────────

function goToDebug(deviceId: string) {
  bleStore.switchSession(deviceId)
  uni.navigateTo({ url: '/pages/debug/index' })
}

function goToScan() {
  uni.switchTab({ url: '/pages/scan/index' })
}

// ── 断开设备 ─────────────────────────────────────────────────────────────────

function handleDisconnect(deviceId: string, name: string) {
  uni.showModal({
    title: t('device.disconnectTitle'),
    content: `${t('device.disconnectConfirm')} "${name}" ${t('device.disconnectSuffix')}`,
    confirmColor: '#DC2626',
    success: async (res) => {
      if (res.confirm) {
        delete serviceTrees[deviceId]
        expandedSessions.delete(deviceId)
        await bleStore.disconnectDevice(deviceId)
      }
    },
  })
}

// ── 导出 ────────────────────────────────────────────────────────────────────

function openExport(deviceId: string) {
  exportTargetId.value = deviceId
  exportNotes.value = ''
  showExportModal.value = true
}

async function confirmExport() {
  if (isExporting.value) return
  const deviceId = exportTargetId.value
  const session = bleStore.sessions.get(deviceId)
  if (!session) return
  isExporting.value = true
  try {
    const tree = getServiceTree(deviceId)
    // 确保所有服务特征值已加载
    for (const node of tree) {
      if (!node.characteristics.length && !node.loading) {
        node.loading = true
        try {
          await bleStore.loadCharacteristics(node.uuid, deviceId)
          node.characteristics = session.characteristics.get(node.uuid) ?? []
        } catch { /* 单服务失败不中断 */ } finally { node.loading = false }
      }
    }

    const reportInfo: DeviceReportInfo = {
      name:     session.device.name,
      deviceId: session.device.deviceId,
      rssi:     session.device.RSSI,
      mtu:      session.currentMtu,
      notes:    exportNotes.value,
      services: tree.map((node) => ({
        uuid:        node.uuid,
        isPrimary:   node.isPrimary,
        charsLoaded: node.characteristics.length > 0 || node.expanded,
        characteristics: node.characteristics.map((ch: BleCharacteristic) => ({
          uuid: ch.uuid,
          properties: {
            read: !!ch.properties.read, write: !!ch.properties.write,
            writeNoResponse: !!ch.properties.writeNoResponse,
            notify: !!ch.properties.notify, indicate: !!ch.properties.indicate,
          },
        })),
      })),
    }

    const fmt = exportFormat.value
    const mimeType = fmt === 'csv' ? 'text/csv' : 'text/plain'
    const content =
      fmt === 'md'  ? exportDeviceReportToMarkdown(reportInfo) :
      fmt === 'csv' ? exportDeviceReportToCSV(reportInfo) :
                      exportDeviceReportToText(reportInfo)
    const filename = buildDeviceReportFilename(session.device.name, fmt)
    showExportModal.value = false
    const path = await saveLogsToFile(content, filename, mimeType)

    // #ifdef APP-PLUS
    if (plus.os.name === 'Android') {
      try {
        const Intent = plus.android.importClass('android.content.Intent')
        const File = plus.android.importClass('java.io.File')
        const BuildVersion = plus.android.importClass('android.os.Build$VERSION')
        const activity = plus.android.runtimeMainActivity()
        const intent = new Intent(Intent.ACTION_SEND)
        intent.setType(mimeType)
        const file = new File(path)
        if (BuildVersion.SDK_INT >= 24) {
          const FileProvider = plus.android.importClass('androidx.core.content.FileProvider')
          const authority = activity.getPackageName() + '.dc.fileprovider'
          const uri = FileProvider.getUriForFile(activity, authority, file)
          intent.putExtra(Intent.EXTRA_STREAM, uri)
          intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } else {
          const Uri = plus.android.importClass('android.net.Uri')
          intent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(file))
        }
        activity.startActivity(Intent.createChooser(intent, t('device.export.shareTitle')))
      } catch {
        uni.showModal({ title: t('device.export.success'), content: `${filename}\n\n${t('device.export.savePath')}${path}`, showCancel: false, confirmText: t('common.ok') })
      }
    } else {
      plus.share.sendWithSystem({ type: 'file', href: path }, () => {}, () => {
        uni.showModal({ title: t('device.export.success'), content: `${filename}\n\n${t('device.export.savePath')}${path}`, showCancel: false, confirmText: t('common.ok') })
      })
    }
    // #endif
    // #ifndef APP-PLUS
    uni.showModal({ title: t('device.export.success'), content: `${filename}\n\n${t('device.export.savePath')}${path}`, showCancel: false, confirmText: t('common.ok') })
    // #endif
  } catch (e: any) {
    uni.showToast({ title: t('device.export.failed'), icon: 'none' })
  } finally {
    isExporting.value = false
  }
}
</script>

<style lang="scss" scoped>
.device-page {
  min-height: 100vh;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;

  &--wide { padding-left: 60px; }
}

/* ── 页面头部 ── */
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.page-title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
.conn-count-badge {
  background: rgba(var(--color-primary-rgb), 0.15);
  border: 1px solid rgba(var(--color-primary-rgb), 0.3);
  border-radius: 999px; padding: 1px 9px;
}
.conn-count-text { font-size: 12px; color: var(--color-primary); font-weight: 700; }
.header-right { display: flex; gap: 6px; }
.icon-btn {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px;
  &:active { opacity: 0.7; }
}
.ib-icon { font-size: 14px; color: var(--text-muted); }

/* ── 空状态 ── */
.empty-state {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; padding: 48px 24px;
}
.empty-icon { font-size: 56px; color: var(--bg-elevated); }
.empty-tip { font-size: 14px; color: var(--text-muted); text-align: center; }
.go-scan-btn {
  padding: 10px 28px;
  background: rgba(var(--color-primary-rgb), 0.1);
  border: 1px solid rgba(var(--color-primary-rgb), 0.3);
  border-radius: 10px;
  &:active { opacity: 0.75; }
}
.go-scan-text { font-size: 14px; color: var(--color-primary); font-weight: 600; }

/* ── 会话滚动区 ── */
.sessions-scroll { flex: 1; }
.sessions-list { display: flex; flex-direction: column; gap: 12px; padding: 12px; }

/* ── 会话卡片 ── */
.session-card {
  background: var(--bg-panel);
  border-radius: 14px;
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

/* ── 会话头部 ── */
.session-header {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  &:active { background: var(--bg-elevated); }
}

.session-icon-wrap { position: relative; flex-shrink: 0; }
.session-icon {
  width: 44px; height: 44px; border-radius: 12px;
  background: var(--bg-card); border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 0 12px rgba(var(--color-accent-rgb), 0.15);
}
.session-icon-text { font-size: 22px; color: var(--color-primary); }
.conn-ring {
  position: absolute; top: -3px; right: -3px;
  width: 12px; height: 12px; border-radius: 50%;
  border: 2px solid var(--bg-panel);
  &.ring--connected { background: var(--color-accent); box-shadow: 0 0 6px rgba(var(--color-accent-rgb), 0.7); }
}

.session-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.session-name { font-size: 15px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-id { font-size: 10px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.session-meta { display: flex; gap: 6px; align-items: center; margin-top: 2px; }
.rssi-chip, .mtu-chip {
  padding: 1px 7px; border-radius: 999px;
}
.rssi-chip { background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.2); }
.rssi-chip-text { font-size: 10px; color: var(--color-primary); font-family: 'Courier New', monospace; }
.mtu-chip { background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.2); }
.mtu-chip-text { font-size: 10px; color: var(--color-accent); font-family: 'Courier New', monospace; }

.session-actions { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.debug-btn {
  padding: 5px 12px;
  background: linear-gradient(135deg, var(--color-accent) 0%, rgba(var(--color-accent-rgb), 0.7) 100%);
  border-radius: 8px; &:active { opacity: 0.8; }
}
.debug-btn-text { font-size: 12px; font-weight: 700; color: var(--bg-base); }
.disc-btn {
  padding: 4px 10px;
  background: rgba(var(--color-danger-rgb), 0.1);
  border: 1px solid rgba(var(--color-danger-rgb), 0.25);
  border-radius: 7px; &:active { opacity: 0.7; }
}
.disc-btn-text { font-size: 11px; color: var(--color-danger); font-weight: 500; }
.expand-chevron { transition: transform 0.2s; &--open { transform: rotate(90deg); } }
.chevron-text { font-size: 16px; color: var(--text-muted); }

/* ── RSSI 区域 ── */
.rssi-section {
  padding: 0 16px 12px;
  border-top: 1px solid var(--border-subtle);
}

/* ── MTU 区域 ── */
.mtu-section {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex; flex-direction: column; gap: 8px;
}
.mtu-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.mtu-row { display: flex; align-items: center; gap: 8px; }
.mtu-input {
  flex: 1; background: var(--bg-input); border: 1px solid var(--border-default);
  border-radius: 8px; padding: 8px 12px; font-size: 14px; color: var(--text-primary);
  font-family: 'Courier New', monospace;
}
.mtu-ph { color: var(--text-dimmed); }
.mtu-btn {
  height: 36px; padding: 0 14px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--color-primary-rgb), 0.1); border: 1px solid rgba(var(--color-primary-rgb), 0.3);
  border-radius: 8px; flex-shrink: 0; min-width: 56px;
  &:active { opacity: 0.75; } &--loading { opacity: 0.6; }
}
.mtu-btn-text { font-size: 13px; color: var(--color-primary); font-weight: 600; }
.mtu-current { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; min-width: 40px; }
.mtu-current-label { font-size: 9px; color: var(--text-dimmed); text-transform: uppercase; }
.mtu-current-val { font-size: 16px; font-weight: 700; color: var(--color-primary); font-family: 'Courier New', monospace; }

/* ── 服务树 ── */
.service-tree {
  padding: 12px 16px;
  border-top: 1px solid var(--border-subtle);
  display: flex; flex-direction: column; gap: 8px;
}
.tree-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.tree-title { font-size: 13px; font-weight: 600; color: var(--text-secondary); flex: 1; }
.export-btn {
  display: flex; align-items: center; gap: 4px; height: 30px; padding: 0 10px;
  background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  border-radius: 7px; &:active { opacity: 0.7; }
}
.export-btn-icon { font-size: 12px; color: var(--color-accent); }
.export-btn-label { font-size: 11px; color: var(--color-accent); font-weight: 600; }
.refresh-btn { width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; background: rgba(var(--color-primary-rgb), 0.06); border: 1px solid rgba(var(--color-primary-rgb), 0.15); border-radius: 7px; &:active { opacity: 0.7; } }
.refresh-icon { font-size: 15px; color: var(--color-primary); }

.tree-loading { display: flex; align-items: center; gap: 8px; padding: 16px; }
.loading-ring { width: 20px; height: 20px; border: 2px solid var(--border-subtle); border-top-color: var(--color-primary); border-radius: 50%; animation: ble-spin 1s linear infinite; }
.loading-text { font-size: 13px; color: var(--text-muted); }

.empty-services { padding: 24px; text-align: center; background: var(--bg-card); border-radius: 10px; border: 1px dashed var(--border-subtle); }
.empty-services-text { font-size: 13px; color: var(--text-dimmed); }

.service-node { background: var(--bg-card); border-radius: 10px; border: 1px solid var(--border-subtle); overflow: hidden; }
.service-row {
  display: flex; align-items: center; gap: 12px; padding: 12px 14px; transition: background 0.2s;
  &:active { background: rgba(var(--color-primary-rgb), 0.04); }
  &--expanded { border-bottom: 1px solid var(--border-subtle); }
}
.service-indicator { width: 4px; height: 18px; border-radius: 2px; background: var(--bg-elevated); flex-shrink: 0; &.ind--active { background: var(--color-primary); box-shadow: 0 0 6px rgba(var(--color-primary-rgb), 0.5); } }
.service-info { flex: 1; min-width: 0; }
.service-uuid-row { display: flex; align-items: center; gap: 8px; }
.service-uuid { font-size: 14px; font-weight: 600; color: var(--color-primary); }
.service-full-uuid { font-size: 10px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.primary-badge { background: rgba(139,92,246, 0.12); border: 1px solid rgba(139,92,246, 0.25); border-radius: 3px; padding: 1px 5px; }
.primary-text { font-size: 9px; color: rgb(139,92,246); font-weight: 700; }
.expand-icon { flex-shrink: 0; transition: transform 0.2s; &--open { transform: rotate(90deg); } }
.expand-text { font-size: 16px; color: var(--text-muted); }

.char-list { padding: 6px 12px 10px 12px; display: flex; flex-direction: column; gap: 5px; }
.char-loading { display: flex; align-items: center; gap: 8px; padding: 8px; }
.mini-ring { width: 14px; height: 14px; border: 2px solid var(--border-subtle); border-top-color: var(--color-primary); border-radius: 50%; animation: ble-spin 0.8s linear infinite; }
.mini-spin { width: 14px; height: 14px; border: 2px solid rgba(var(--color-primary-rgb), 0.3); border-top-color: var(--color-primary); border-radius: 50%; animation: ble-spin 0.8s linear infinite; }
.char-loading-text { font-size: 12px; color: var(--text-muted); }

.char-node {
  display: flex; gap: 8px; padding: 9px 10px; border-radius: 7px; border: 1px solid transparent;
  background: rgba(0,0,0,0.03); transition: all 0.2s;
  &:active { background: rgba(var(--color-primary-rgb), 0.05); }
  &--selected { background: rgba(var(--color-primary-rgb), 0.06); border-color: rgba(var(--color-primary-rgb), 0.2); }
}
.char-tree-line { width: 1px; background: rgba(var(--color-primary-rgb), 0.15); border-radius: 1px; flex-shrink: 0; }
.char-content { flex: 1; min-width: 0; }
.char-header { display: flex; align-items: center; gap: 6px; }
.branch-text { font-size: 13px; color: var(--text-dimmed); }
.char-uuid { font-size: 13px; font-weight: 600; color: var(--color-info, #60a5fa); flex: 1; }
.selected-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-accent); box-shadow: 0 0 6px rgba(var(--color-accent-rgb), 0.6); flex-shrink: 0; }
.char-full-uuid { font-size: 10px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-left: 18px; margin-top: 2px; }
.char-props { display: flex; flex-wrap: wrap; gap: 3px; padding-left: 18px; margin-top: 4px; }
.prop-badge { padding: 1px 6px; border-radius: 3px; }
.prop-text { font-size: 9px; font-weight: 700; }
.prop-r { background: rgba(96,165,250, 0.12); border: 1px solid rgba(96,165,250, 0.25); .prop-text { color: #60a5fa; } }
.prop-w { background: rgba(var(--color-primary-rgb), 0.12); border: 1px solid rgba(var(--color-primary-rgb), 0.25); .prop-text { color: var(--color-primary); } }
.prop-n { background: rgba(var(--color-accent-rgb), 0.12); border: 1px solid rgba(var(--color-accent-rgb), 0.25); .prop-text { color: var(--color-accent); } }

/* ── 导出弹窗 ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 300; }
.modal-card {
  background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-default);
  padding: 24px; margin: 24px; width: 100%; max-width: 380px;
  display: flex; flex-direction: column; gap: 16px;
}
.modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.fmt-tabs { display: flex; gap: 6px; }
.fmt-tab {
  flex: 1; height: 36px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-input); border: 1px solid var(--border-subtle); border-radius: 8px;
  &:active { opacity: 0.75; }
  &--active { background: rgba(var(--color-primary-rgb), 0.1); border-color: rgba(var(--color-primary-rgb), 0.4); .fmt-tab-text { color: var(--color-primary); } }
}
.fmt-tab-text { font-size: 12px; font-weight: 600; color: var(--text-muted); }
.notes-section { display: flex; flex-direction: column; gap: 6px; }
.notes-label { font-size: 11px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; }
.notes-input { background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 8px; padding: 10px 12px; font-size: 13px; color: var(--text-primary); width: 100%; min-height: 72px; }
.notes-ph { color: var(--text-dimmed); }
.modal-actions { display: flex; gap: 10px; }
.modal-btn {
  flex: 1; height: 44px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  &--cancel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-secondary); }
  &--confirm { background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7)); color: var(--bg-base); &:active { opacity: 0.85; } }
  &--loading { opacity: 0.6; }
}
</style>
