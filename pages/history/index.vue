<template>
  <view class="history-page" :class="[appStore.themeClass, { 'history-page--wide': isWideScreen }]" :style="appStore.cssVarsStyle">

    <!-- 页面头部 -->
    <view class="page-header">
      <view class="header-left">
        <text class="page-title">{{ t('history.pageTitle') }}</text>
        <view v-if="totalSessions" class="count-badge">
          <text class="count-text">{{ totalSessions }}</text>
        </view>
      </view>
      <view class="header-right">
        <view class="icon-btn" @click="appStore.toggleTheme()">
          <text class="ib-icon">{{ appStore.isDark ? '☀' : '◑' }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="!deviceGroups.length" class="empty-state">
      <text class="empty-icon">🕓</text>
      <text class="empty-title">{{ t('history.emptyTitle') }}</text>
      <text class="empty-tip">{{ t('history.emptyTip') }}</text>
    </view>

    <!-- 主体：宽屏双栏 / 手机端单栏钻取 -->
    <view v-else class="hp-body">

      <!-- 会话列表（宽屏左栏；手机端未选中会话时显示） -->
      <scroll-view
        v-if="isWideScreen || !selectedSession"
        scroll-y
        class="hp-list"
        :class="{ 'hp-list--wide': isWideScreen }"
      >
        <view class="device-groups">
          <view v-for="group in deviceGroups" :key="group.deviceId" class="device-group">
            <view class="group-header" @click="toggleDevice(group.deviceId)">
              <view class="group-icon"><text class="gi-text">⬡</text></view>
              <view class="group-info">
                <text class="group-name">{{ group.deviceName }}</text>
                <text class="group-id mono">{{ group.deviceId }}</text>
              </view>
              <view class="group-meta">
                <text class="group-count">{{ t('history.deviceSessions', { n: group.sessions.length }) }}</text>
                <view class="group-clear" @click.stop="handleClearDevice(group.deviceId)">
                  <text class="gc-icon">🗑</text>
                </view>
                <view class="group-chevron" :class="{ 'group-chevron--open': expandedDevices.has(group.deviceId) }">
                  <text class="chev-text">›</text>
                </view>
              </view>
            </view>

            <view v-if="expandedDevices.has(group.deviceId)" class="session-list">
              <view
                v-for="meta in group.sessions"
                :key="meta.id"
                class="session-item"
                :class="{ 'session-item--active': selectedSession?.id === meta.id }"
                @click="selectSession(meta)"
              >
                <view class="si-top">
                  <text class="si-date">{{ formatTimestamp(meta.startedAt, true) }}</text>
                  <view v-if="!meta.endedAt" class="ongoing-chip"><text class="ongoing-text">{{ t('history.ongoing') }}</text></view>
                  <view v-else class="reason-chip" :class="`reason--${meta.endReason ?? 'unknown'}`">
                    <text class="reason-text">{{ t(`history.endReasons.${meta.endReason ?? 'unknown'}`) }}</text>
                  </view>
                </view>
                <view class="si-stats">
                  <text class="si-stat">{{ t('history.duration') }} {{ formatDuration(sessionDurationMs(meta)) }}</text>
                  <text class="si-stat si-tx">↑ {{ meta.txFrames }} / {{ formatBytes(meta.txBytes) }}</text>
                  <text class="si-stat si-rx">↓ {{ meta.rxFrames }} / {{ formatBytes(meta.rxBytes) }}</text>
                  <text v-if="meta.heartbeat" class="si-stat si-hb">♥ {{ meta.heartbeat.acked }}/{{ meta.heartbeat.sent }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </scroll-view>

      <!-- 会话详情（宽屏右栏；手机端选中会话后显示） -->
      <view v-if="isWideScreen || selectedSession" class="hp-detail">

        <!-- 宽屏未选中时的占位 -->
        <view v-if="!selectedSession" class="detail-placeholder">
          <text class="dp-icon">☰</text>
          <text class="dp-text">{{ t('history.selectSession') }}</text>
        </view>

        <template v-else>
          <!-- 手机端返回栏 -->
          <view v-if="!isWideScreen" class="detail-backbar" @click="selectedSession = null">
            <text class="back-arrow">‹</text>
            <text class="back-text">{{ t('common.back') }}</text>
          </view>

          <scroll-view scroll-y class="detail-scroll">
            <!-- 会话信息卡 -->
            <view class="meta-card">
              <view class="meta-card-header">
                <text class="meta-title">{{ t('history.metaTitle') }}</text>
                <view class="meta-actions">
                  <view class="exp-btn" @click="handleExportSession">
                    <text class="exp-btn-text">⬆ {{ t('history.exportSession') }}</text>
                  </view>
                  <view class="del-btn" @click="handleDeleteSession">
                    <text class="del-btn-text">{{ t('history.deleteSession') }}</text>
                  </view>
                </view>
              </view>
              <view class="meta-grid">
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.startTime') }}</text>
                  <text class="meta-value mono">{{ formatTimestamp(selectedSession.startedAt, true) }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.endTime') }}</text>
                  <text class="meta-value mono">{{ selectedSession.endedAt ? formatTimestamp(selectedSession.endedAt, true) : t('history.ongoing') }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.duration') }}</text>
                  <text class="meta-value">{{ formatDuration(sessionDurationMs(selectedSession)) }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.endReasonLabel') }}</text>
                  <text class="meta-value">{{ selectedSession.endedAt ? t(`history.endReasons.${selectedSession.endReason ?? 'unknown'}`) : t('history.ongoing') }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.txStat') }}</text>
                  <text class="meta-value">{{ selectedSession.txFrames }} {{ t('history.framesUnit') }} · {{ formatBytes(selectedSession.txBytes) }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.rxStat') }}</text>
                  <text class="meta-value">{{ selectedSession.rxFrames }} {{ t('history.framesUnit') }} · {{ formatBytes(selectedSession.rxBytes) }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.maxMtu') }}</text>
                  <text class="meta-value mono">{{ selectedSession.maxMtu }}</text>
                </view>
                <view class="meta-cell">
                  <text class="meta-label">{{ t('history.rssiRange') }}</text>
                  <text class="meta-value mono">{{ rssiRangeText(selectedSession) }}</text>
                </view>
              </view>
            </view>

            <!-- 心跳统计卡 -->
            <view v-if="selectedSession.heartbeat" class="hb-card">
              <text class="hb-title">{{ t('history.heartbeatTitle') }}</text>
              <view class="hb-grid">
                <view class="hb-cell">
                  <text class="hb-value">{{ selectedSession.heartbeat.sent }}</text>
                  <text class="hb-label">{{ t('history.hbSent') }}</text>
                </view>
                <view class="hb-cell">
                  <text class="hb-value hb-ok">{{ selectedSession.heartbeat.acked }}</text>
                  <text class="hb-label">{{ t('history.hbAcked') }}</text>
                </view>
                <view class="hb-cell">
                  <text class="hb-value hb-bad">{{ selectedSession.heartbeat.missed }}</text>
                  <text class="hb-label">{{ t('history.hbMissed') }}</text>
                </view>
                <view class="hb-cell">
                  <text class="hb-value">{{ selectedSession.heartbeat.rttAvgMs != null ? selectedSession.heartbeat.rttAvgMs + 'ms' : '—' }}</text>
                  <text class="hb-label">{{ t('history.hbRtt') }}</text>
                </view>
              </view>
            </view>

            <!-- 时间线 -->
            <view class="timeline-card">
              <view class="timeline-header">
                <text class="timeline-title">{{ t('history.timeline') }}</text>
                <view class="filter-chips">
                  <view
                    v-for="f in filterOptions"
                    :key="f"
                    class="filter-chip"
                    :class="{ 'filter-chip--active': logFilter === f }"
                    @click="logFilter = f"
                  >
                    <text class="fc-text">{{ f === 'ALL' ? t('history.filterAll') : f }}</text>
                  </view>
                </view>
              </view>

              <view v-if="selectedSession.storedLogCount < selectedSession.logCount" class="truncated-note">
                <text class="tn-text">{{ t('history.truncatedNote', { stored: selectedSession.storedLogCount, total: selectedSession.logCount }) }}</text>
              </view>

              <view v-if="!filteredLogs.length" class="no-logs">
                <text class="no-logs-text">{{ t('history.noLogs') }}</text>
              </view>

              <template v-else>
                <view v-if="hiddenEarlierCount > 0" class="load-earlier" @click="visibleCount += 100">
                  <text class="le-text">{{ t('history.loadEarlier', { n: Math.min(100, hiddenEarlierCount) }) }}</text>
                </view>

                <view
                  v-for="entry in visibleLogs"
                  :key="entry.id"
                  class="log-entry"
                  :class="`log-entry--${entry.direction.toLowerCase()}`"
                >
                  <view class="le-head">
                    <view class="dir-badge" :class="`dir--${entry.direction.toLowerCase()}`">
                      <text class="dir-text">{{ entry.direction }}</text>
                    </view>
                    <text class="le-time mono">{{ formatTimestamp(entry.timestamp) }}</text>
                    <text v-if="entry.label" class="le-label">{{ entry.label }}</text>
                  </view>
                  <text v-if="entry.direction === 'SYS'" class="le-sys">{{ entry.ascii }}</text>
                  <template v-else>
                    <text class="le-hex mono" :class="entry.direction === 'TX' ? 'hex-tx' : 'hex-rx'">{{ entry.hex }}</text>
                    <text v-if="entry.ascii && entry.ascii.trim()" class="le-ascii mono">{{ entry.ascii }}</text>
                  </template>
                </view>
              </template>
            </view>

            <view class="detail-bottom-space" />
          </scroll-view>
        </template>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '../../store/appStore'
import { useI18n } from '../../composables/useI18n'
import { useResponsive } from '../../composables/useResponsive'
import {
  formatTimestamp,
  saveLogsToFile,
  buildDeviceReportFilename,
  type LogEntry,
  type LogDirection,
} from '../../utils/buffer'
import {
  loadHistoryIndex,
  loadSessionLogs,
  deleteSessionRecord,
  clearDeviceHistory,
  sessionDurationMs,
  loadDeviceAnnotations,
  mergeAnnotationsIntoDocs,
  type SessionMeta,
} from '../../utils/deviceArchive'
import { buildSessionLogMarkdown, type ExportContext } from '../../utils/exporters'

const appStore = useAppStore()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

// ── 数据加载 ────────────────────────────────────────────────────────────────

const historyIndex = ref<Record<string, SessionMeta[]>>({})
const expandedDevices = reactive<Set<string>>(new Set())
const selectedSession = ref<SessionMeta | null>(null)
const sessionLogs = ref<LogEntry[]>([])
const logFilter = ref<'ALL' | LogDirection>('ALL')
const visibleCount = ref(100)
const filterOptions: ('ALL' | LogDirection)[] = ['ALL', 'TX', 'RX', 'SYS']

let deviceIdParam = ''

interface DeviceGroup {
  deviceId: string
  deviceName: string
  sessions: SessionMeta[]
}

const deviceGroups = computed<DeviceGroup[]>(() => {
  const groups: DeviceGroup[] = Object.entries(historyIndex.value).map(([deviceId, sessions]) => ({
    deviceId,
    deviceName: sessions[0]?.deviceName || deviceId,
    sessions,
  }))
  // 指定设备排最前，其余按最近会话时间排序
  groups.sort((a, b) => {
    if (a.deviceId === deviceIdParam) return -1
    if (b.deviceId === deviceIdParam) return 1
    return (b.sessions[0]?.startedAt ?? 0) - (a.sessions[0]?.startedAt ?? 0)
  })
  return groups
})

const totalSessions = computed(() =>
  deviceGroups.value.reduce((sum, g) => sum + g.sessions.length, 0)
)

function refreshIndex() {
  historyIndex.value = loadHistoryIndex()
  // 保持已选会话的 meta 最新（进行中的会话统计会变化）
  if (selectedSession.value) {
    const list = historyIndex.value[selectedSession.value.deviceId] ?? []
    const fresh = list.find((m) => m.id === selectedSession.value!.id)
    if (fresh) {
      selectedSession.value = fresh
      sessionLogs.value = loadSessionLogs(fresh.id)
    } else {
      selectedSession.value = null
      sessionLogs.value = []
    }
  }
}

onLoad((query: any) => {
  deviceIdParam = query?.deviceId ?? ''
})

onShow(() => {
  refreshIndex()
  // 默认展开：指定设备 > 全部展开（设备数少时）
  if (!expandedDevices.size) {
    if (deviceIdParam && historyIndex.value[deviceIdParam]) {
      expandedDevices.add(deviceIdParam)
    } else {
      deviceGroups.value.slice(0, 3).forEach((g) => expandedDevices.add(g.deviceId))
    }
  }
  // 宽屏默认选中第一个会话
  if (isWideScreen.value && !selectedSession.value) {
    const first = deviceIdParam
      ? historyIndex.value[deviceIdParam]?.[0]
      : deviceGroups.value[0]?.sessions[0]
    if (first) selectSession(first)
  }
})

onMounted(() => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('history.pageTitle') })
})

// 进入宽屏布局时自动选中第一个会话（首次 onShow 时 isWideScreen 尚未计算完成）
watch(isWideScreen, (wide) => {
  if (wide && !selectedSession.value) {
    const first = deviceIdParam
      ? historyIndex.value[deviceIdParam]?.[0]
      : deviceGroups.value[0]?.sessions[0]
    if (first) selectSession(first)
  }
})

watch(() => appStore.theme, () => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('history.pageTitle') })
})

watch(() => appStore.locale, () => {
  uni.setNavigationBarTitle({ title: t('history.pageTitle') })
})

// ── 交互 ────────────────────────────────────────────────────────────────────

function toggleDevice(deviceId: string) {
  if (expandedDevices.has(deviceId)) expandedDevices.delete(deviceId)
  else expandedDevices.add(deviceId)
}

function selectSession(meta: SessionMeta) {
  selectedSession.value = meta
  sessionLogs.value = loadSessionLogs(meta.id)
  logFilter.value = 'ALL'
  visibleCount.value = 100
}

async function handleExportSession() {
  const meta = selectedSession.value
  if (!meta) return
  try {
    const annotations = loadDeviceAnnotations(meta.deviceId)
    const ctx: ExportContext = {
      device: { name: meta.deviceName, deviceId: meta.deviceId, mtu: meta.maxMtu, services: [] },
      mergedDocs: mergeAnnotationsIntoDocs({ profiles: [], serviceDocs: {}, charDocs: {} }, annotations),
      builtinProfiles: [],
      annotations,
      logs: sessionLogs.value,
      samples: [],
      sessionMeta: meta,
      options: {
        purpose: 'archive',
        notes: '',
        includeRawLogs: true,
        redactDeviceId: false,
        includeProtocolDoc: false,
        includeSessionLog: true,
        includeAiPrompt: false,
        includeMock: false,
      },
    }
    const content = buildSessionLogMarkdown(ctx)
    const filename = buildDeviceReportFilename(meta.deviceName, 'md').replace('BLE_DeviceReport_', 'BLE_SessionLog_')
    const path = await saveLogsToFile(content, filename, 'text/markdown')
    uni.showModal({
      title: t('history.exportSuccess'),
      content: `${filename}\n\n${path}`,
      showCancel: false,
      confirmText: t('common.ok'),
    })
  } catch {
    uni.showToast({ title: t('debug.exportFailed'), icon: 'none' })
  }
}

function handleDeleteSession() {
  const meta = selectedSession.value
  if (!meta) return
  uni.showModal({
    title: t('history.deleteSession'),
    content: t('history.deleteConfirm'),
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) {
        deleteSessionRecord(meta.deviceId, meta.id)
        selectedSession.value = null
        sessionLogs.value = []
        refreshIndex()
        uni.showToast({ title: t('history.deleted'), icon: 'none' })
      }
    },
  })
}

function handleClearDevice(deviceId: string) {
  uni.showModal({
    title: t('history.clearDevice'),
    content: t('history.clearConfirm'),
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) {
        clearDeviceHistory(deviceId)
        if (selectedSession.value?.deviceId === deviceId) {
          selectedSession.value = null
          sessionLogs.value = []
        }
        refreshIndex()
        uni.showToast({ title: t('history.deleted'), icon: 'none' })
      }
    },
  })
}

// ── 时间线过滤与分页 ─────────────────────────────────────────────────────────

const filteredLogs = computed(() => {
  if (logFilter.value === 'ALL') return sessionLogs.value
  return sessionLogs.value.filter((e) => e.direction === logFilter.value)
})

const visibleLogs = computed(() => filteredLogs.value.slice(-visibleCount.value))

const hiddenEarlierCount = computed(() => Math.max(0, filteredLogs.value.length - visibleCount.value))

// ── 格式化 ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${bytes}B`
}

function rssiRangeText(meta: SessionMeta): string {
  if (meta.rssiMin === null) return '—'
  return `${meta.rssiMin} / ${meta.rssiAvg} / ${meta.rssiMax} dBm`
}
</script>

<style lang="scss" scoped>
.history-page {
  height: 100vh;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 页面头部 ── */
.page-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 16px 10px;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.header-left { display: flex; align-items: center; gap: 8px; }
.page-title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
.count-badge {
  background: rgba(var(--color-primary-rgb), 0.15);
  border: 1px solid rgba(var(--color-primary-rgb), 0.3);
  border-radius: 999px; padding: 1px 9px;
}
.count-text { font-size: 12px; color: var(--color-primary); font-weight: 700; }
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
  gap: 12px; padding: 48px 32px;
}
.empty-icon { font-size: 48px; }
.empty-title { font-size: 16px; font-weight: 700; color: var(--text-secondary); }
.empty-tip { font-size: 13px; color: var(--text-muted); text-align: center; line-height: 1.6; }

/* ── 主体布局 ── */
.hp-body { flex: 1; display: flex; overflow: hidden; min-height: 0; }
.hp-list { flex: 1; height: 100%; }
.hp-list--wide {
  flex: none; width: 380px;
  border-right: 1px solid var(--border-subtle);
}
.hp-detail { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }

/* ── 设备分组 ── */
.device-groups { display: flex; flex-direction: column; gap: 10px; padding: 12px; padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }
.device-group {
  background: var(--bg-panel);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}
.group-header {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  &:active { background: var(--bg-elevated); }
}
.group-icon {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  background: var(--bg-card); border: 1px solid rgba(var(--color-primary-rgb), 0.25);
  display: flex; align-items: center; justify-content: center;
}
.gi-text { font-size: 18px; color: var(--color-primary); }
.group-info { flex: 1; min-width: 0; }
.group-name { display: block; font-size: 14px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.group-id { display: block; font-size: 9px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }
.group-meta { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.group-count { font-size: 11px; color: var(--text-muted); }
.group-clear {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: rgba(var(--color-danger-rgb), 0.08); border: 1px solid rgba(var(--color-danger-rgb), 0.2);
  border-radius: 6px; &:active { opacity: 0.7; }
}
.gc-icon { font-size: 11px; }
.group-chevron { transition: transform 0.2s; &--open { transform: rotate(90deg); } }
.chev-text { font-size: 16px; color: var(--text-muted); }

/* ── 会话条目 ── */
.session-list { border-top: 1px solid var(--border-subtle); }
.session-item {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-subtle);
  border-left: 3px solid transparent;
  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-elevated); }
  &--active {
    background: rgba(var(--color-primary-rgb), 0.06);
    border-left-color: var(--color-primary);
  }
}
.si-top { display: flex; align-items: center; gap: 8px; }
.si-date { font-size: 12px; font-weight: 600; color: var(--text-primary); font-family: 'Courier New', monospace; flex: 1; }
.ongoing-chip {
  padding: 1px 7px; border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.12); border: 1px solid rgba(var(--color-accent-rgb), 0.3);
}
.ongoing-text { font-size: 10px; color: var(--color-accent); font-weight: 700; }
.reason-chip { padding: 1px 7px; border-radius: 999px; border: 1px solid var(--border-default); }
.reason--user { background: rgba(var(--color-primary-rgb), 0.06); .reason-text { color: var(--text-muted); } }
.reason--lost { background: rgba(var(--color-danger-rgb), 0.08); border-color: rgba(var(--color-danger-rgb), 0.25); .reason-text { color: var(--color-danger); } }
.reason--app-exit, .reason--unknown { background: rgba(var(--color-warning-rgb), 0.08); border-color: rgba(var(--color-warning-rgb), 0.25); .reason-text { color: var(--color-warning); } }
.reason-text { font-size: 10px; font-weight: 600; }
.si-stats { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 5px; }
.si-stat { font-size: 10px; color: var(--text-muted); font-family: 'Courier New', monospace; }
.si-tx { color: var(--badge-tx-color); }
.si-rx { color: var(--badge-rx-color); }
.si-hb { color: var(--color-purple); }

/* ── 详情区 ── */
.detail-placeholder {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
}
.dp-icon { font-size: 40px; color: var(--text-dimmed); }
.dp-text { font-size: 13px; color: var(--text-muted); }

.detail-backbar {
  display: flex; align-items: center; gap: 4px; padding: 10px 14px;
  background: var(--bg-panel); border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
  &:active { opacity: 0.7; }
}
.back-arrow { font-size: 20px; color: var(--color-primary); line-height: 1; }
.back-text { font-size: 14px; color: var(--color-primary); font-weight: 600; }

.detail-scroll { flex: 1; height: 100%; min-height: 0; }

/* ── 会话信息卡 ── */
.meta-card, .hb-card, .timeline-card {
  margin: 12px 12px 0;
  background: var(--bg-panel);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
  padding: 14px;
}
.meta-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.meta-title, .hb-title, .timeline-title { font-size: 13px; font-weight: 700; color: var(--text-secondary); }
.meta-actions { display: flex; gap: 6px; }
.exp-btn {
  padding: 4px 10px;
  background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  border-radius: 7px; &:active { opacity: 0.7; }
}
.exp-btn-text { font-size: 11px; color: var(--color-accent); font-weight: 600; }
.del-btn {
  padding: 4px 10px;
  background: rgba(var(--color-danger-rgb), 0.08); border: 1px solid rgba(var(--color-danger-rgb), 0.25);
  border-radius: 7px; &:active { opacity: 0.7; }
}
.del-btn-text { font-size: 11px; color: var(--color-danger); font-weight: 600; }
.meta-grid { display: flex; flex-wrap: wrap; }
.meta-cell { width: 50%; padding: 5px 0; display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; color: var(--text-dimmed); text-transform: uppercase; letter-spacing: 0.4px; }
.meta-value { font-size: 12px; color: var(--text-primary); font-weight: 600; }

/* ── 心跳卡 ── */
.hb-title { display: block; margin-bottom: 10px; }
.hb-grid { display: flex; }
.hb-cell { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; }
.hb-value { font-size: 17px; font-weight: 700; color: var(--text-primary); font-family: 'Courier New', monospace; }
.hb-ok { color: var(--color-accent); }
.hb-bad { color: var(--color-danger); }
.hb-label { font-size: 10px; color: var(--text-muted); }

/* ── 时间线 ── */
.timeline-card { margin-bottom: 0; }
.timeline-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-wrap: wrap; gap: 8px; }
.filter-chips { display: flex; gap: 6px; }
.filter-chip {
  padding: 3px 12px; border-radius: 999px;
  background: var(--bg-card); border: 1px solid var(--border-subtle);
  &:active { opacity: 0.7; }
  &--active {
    background: rgba(var(--color-primary-rgb), 0.1);
    border-color: rgba(var(--color-primary-rgb), 0.4);
    .fc-text { color: var(--color-primary); }
  }
}
.fc-text { font-size: 11px; color: var(--text-muted); font-weight: 600; }

.truncated-note { padding: 6px 10px; background: rgba(var(--color-warning-rgb), 0.06); border: 1px dashed rgba(var(--color-warning-rgb), 0.3); border-radius: 8px; margin-bottom: 8px; }
.tn-text { font-size: 11px; color: var(--color-warning); }

.no-logs { padding: 28px; text-align: center; }
.no-logs-text { font-size: 13px; color: var(--text-dimmed); }

.load-earlier {
  padding: 8px; text-align: center; margin-bottom: 8px;
  background: rgba(var(--color-primary-rgb), 0.05); border: 1px dashed rgba(var(--color-primary-rgb), 0.25);
  border-radius: 8px;
  &:active { opacity: 0.7; }
}
.le-text { font-size: 12px; color: var(--color-primary); font-weight: 600; }

.log-entry {
  padding: 7px 10px; margin-bottom: 6px;
  border-radius: 8px; border-left: 3px solid transparent;
  &--tx { background: var(--entry-tx-bg); border-left-color: var(--entry-tx-border); }
  &--rx { background: var(--entry-rx-bg); border-left-color: var(--entry-rx-border); }
  &--sys { background: var(--entry-sys-bg); border-left-color: var(--entry-sys-border); }
}
.le-head { display: flex; align-items: center; gap: 8px; }
.dir-badge {
  padding: 0 6px; border-radius: 4px; height: 16px;
  display: flex; align-items: center;
  &.dir--tx { background: var(--badge-tx-bg); .dir-text { color: var(--badge-tx-color); } }
  &.dir--rx { background: var(--badge-rx-bg); .dir-text { color: var(--badge-rx-color); } }
  &.dir--sys { background: var(--badge-sys-bg); .dir-text { color: var(--badge-sys-color); } }
}
.dir-text { font-size: 9px; font-weight: 700; }
.le-time { font-size: 10px; color: var(--text-muted); }
.le-label { font-size: 10px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; text-align: right; }
.le-sys { display: block; font-size: 11px; color: var(--text-secondary); margin-top: 3px; }
.le-hex { display: block; font-size: 11px; margin-top: 3px; word-break: break-all; }
.hex-tx { color: var(--data-hex-tx); }
.hex-rx { color: var(--data-hex-rx); }
.le-ascii { display: block; font-size: 10px; color: var(--text-muted); margin-top: 2px; word-break: break-all; }

.detail-bottom-space { height: calc(24px + env(safe-area-inset-bottom, 0px)); }

.mono { font-family: 'Courier New', monospace; }
</style>
