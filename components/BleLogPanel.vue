<template>
  <view class="log-panel">

    <!-- 头部控制栏 -->
    <view class="log-header">
      <view class="log-title-row">
        <text class="log-title">{{ logTitle }}</text>
        <view class="log-stats">
          <view class="stat-item"><text class="stat-label">TX</text><text class="stat-value stat-tx">{{ formatBytes(txBytes) }}</text></view>
          <view class="stat-div" />
          <view class="stat-item"><text class="stat-label">RX</text><text class="stat-value stat-rx">{{ formatBytes(rxBytes) }}</text></view>
          <view class="stat-div" />
          <view class="stat-item"><text class="stat-label">{{ totalLabel }}</text><text class="stat-value">{{ logs.length }}</text></view>
        </view>
      </view>

      <view class="log-controls">
        <view class="mode-tabs">
          <view class="mode-tab" :class="{ active: displayMode === 'hex' }"   @click="$emit('update:displayMode', 'hex')"><text>HEX</text></view>
          <view class="mode-tab" :class="{ active: displayMode === 'ascii' }" @click="$emit('update:displayMode', 'ascii')"><text>ASCII</text></view>
          <view class="mode-tab" :class="{ active: displayMode === 'both' }"  @click="$emit('update:displayMode', 'both')"><text>DUAL</text></view>
        </view>

        <view class="toggle-btn" :class="{ active: autoScroll }" @click="toggleAutoScroll">
          <text class="toggle-icon">↓</text>
          <text class="toggle-label">{{ autoLabel }}</text>
        </view>

        <view class="log-actions">
          <view class="action-btn" @click="$emit('export')"><text class="action-icon">⬇</text></view>
          <view class="action-btn action-btn--danger" @click="$emit('clear')"><text class="action-icon">✕</text></view>
        </view>
      </view>
    </view>

    <!-- 日志列表 -->
    <scroll-view
      :id="scrollId"
      scroll-y
      :scroll-top="scrollTop"
      class="log-scroll"
      @scroll="onScroll"
    >
      <view class="log-list">
        <view v-if="!logs.length" class="log-empty">
          <text class="empty-icon-text">⌁</text>
          <text class="empty-text">{{ waitingText }}</text>
        </view>

        <view
          v-for="entry in logs"
          :key="entry.id"
          class="log-entry"
          :class="`log-entry--${entry.direction.toLowerCase()}`"
        >
          <view class="entry-meta">
            <view class="dir-badge" :class="`dir-${entry.direction.toLowerCase()}`">
              <text class="dir-text">{{ entry.direction }}</text>
            </view>
            <text class="entry-time mono">{{ formatTimestamp(entry.timestamp) }}</text>
            <text v-if="entry.label" class="entry-label">{{ entry.label }}</text>
            <text class="entry-len">{{ entry.rawLength > 0 ? `${entry.rawLength}B` : '' }}</text>
          </view>

          <view v-if="entry.direction === 'SYS'" class="sys-message">
            <text class="sys-text">{{ entry.ascii }}</text>
          </view>
          <view v-else class="entry-data">
            <text v-if="displayMode === 'hex' || displayMode === 'both'" class="data-hex mono" :class="`hex-${entry.direction.toLowerCase()}`">{{ entry.hex }}</text>
            <text v-if="displayMode === 'ascii' || displayMode === 'both'" class="data-ascii mono" :class="`ascii-${entry.direction.toLowerCase()}`">{{ entry.ascii }}</text>
          </view>
        </view>

        <view id="log-bottom" style="height:4px;" />
      </view>
    </scroll-view>

    <!-- 未读提示 -->
    <view v-if="!autoScroll && unreadCount > 0" class="unread-badge" @click="scrollToBottom">
      <text class="unread-text">{{ unreadCount }}{{ newMsgText }} ↓</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { LogEntry } from '../utils/buffer'
import { formatTimestamp } from '../utils/buffer'

type DisplayMode = 'hex' | 'ascii' | 'both'

const props = defineProps<{
  logs: LogEntry[]
  txBytes: number
  rxBytes: number
  displayMode: DisplayMode
  logTitle?: string
  totalLabel?: string
  autoLabel?: string
  waitingText?: string
  newMsgText?: string
}>()

defineEmits<{
  'update:displayMode': [mode: DisplayMode]
  clear: []
  export: []
}>()

const scrollId = 'ble-log-scroll'
const scrollTop = ref(0)
const autoScroll = ref(true)
const unreadCount = ref(0)
const lastLogCount = ref(0)

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value
  if (autoScroll.value) { unreadCount.value = 0; scrollToBottom() }
}

function scrollToBottom() {
  nextTick(() => {
    const query = uni.createSelectorQuery()
    query.select(`#${scrollId}`).scrollOffset()
    query.exec((res: any) => {
      if (res[0]?.scrollHeight != null) scrollTop.value = res[0].scrollHeight
    })
  })
}

function onScroll(e: any) {
  const { scrollTop: st, scrollHeight, clientHeight } = e.detail
  const atBottom = scrollHeight - st - clientHeight < 40
  if (atBottom && !autoScroll.value) { autoScroll.value = true; unreadCount.value = 0 }
  else if (!atBottom && autoScroll.value) autoScroll.value = false
}

watch(() => props.logs.length, (newLen) => {
  if (newLen > lastLogCount.value) {
    if (autoScroll.value) { scrollToBottom(); unreadCount.value = 0 }
    else { unreadCount.value += newLen - lastLogCount.value }
  }
  lastLogCount.value = newLen
})

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`
  if (n < 1048576) return `${(n / 1024).toFixed(1)}K`
  return `${(n / 1048576).toFixed(1)}M`
}
</script>

<style lang="scss" scoped>
.log-panel {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--bg-base); border-radius: 12px; border: 1px solid var(--border-subtle);
  overflow: hidden; position: relative;
}

/* 头部 */
.log-header { padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); background: var(--bg-panel); flex-shrink: 0; }
.log-title-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.log-title { font-size: 13px; font-weight: 600; color: var(--color-primary); letter-spacing: 0.5px; }
.log-stats { display: flex; align-items: center; gap: 8px; }
.stat-item { display: flex; align-items: center; gap: 4px; }
.stat-label { font-size: 10px; color: var(--text-dimmed); }
.stat-value { font-size: 11px; color: var(--text-secondary); font-family: 'Courier New', monospace; font-weight: 600; }
.stat-tx { color: var(--badge-tx-color); }
.stat-rx { color: var(--badge-rx-color); }
.stat-div { width: 1px; height: 14px; background: var(--border-subtle); }

/* 控制栏 */
.log-controls { display: flex; align-items: center; gap: 8px; }
.mode-tabs { display: flex; background: var(--bg-elevated); border-radius: 6px; padding: 2px; gap: 1px; }
.mode-tab { padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 600; color: var(--text-muted); transition: all 0.2s; &.active { background: rgba(var(--color-primary-rgb), 0.15); color: var(--color-primary); } }

.toggle-btn {
  display: flex; align-items: center; gap: 3px; padding: 4px 10px; border-radius: 6px;
  border: 1px solid var(--border-subtle); background: transparent; transition: all 0.2s;
  &.active { border-color: rgba(var(--color-primary-rgb), 0.3); background: rgba(var(--color-primary-rgb), 0.08); .toggle-icon, .toggle-label { color: var(--color-primary); } }
}
.toggle-icon, .toggle-label { font-size: 11px; color: var(--text-secondary); }

.log-actions { display: flex; gap: 4px; margin-left: auto; }
.action-btn {
  width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 6px;
  &:active { opacity: 0.7; }
  &--danger .action-icon { color: var(--color-danger); }
  &--danger:active { background: rgba(var(--color-danger-rgb), 0.1); }
}
.action-icon { font-size: 12px; color: var(--text-secondary); }

/* 日志列表 */
.log-scroll { flex: 1; min-height: 0; }
.log-list { padding: 8px; display: flex; flex-direction: column; gap: 3px; }

.log-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 0; gap: 8px; }
.empty-icon-text { font-size: 40px; color: var(--bg-elevated); font-weight: 100; }
.empty-text { font-size: 13px; color: var(--text-dimmed); font-family: 'Courier New', monospace; }

/* 日志条目 */
.log-entry {
  padding: 7px 10px; border-radius: 8px; border-left: 3px solid transparent;
  animation: ble-fade-in 0.2s ease-out;
  &--tx  { background: var(--entry-tx-bg);  border-left-color: var(--entry-tx-border); }
  &--rx  { background: var(--entry-rx-bg);  border-left-color: var(--entry-rx-border); }
  &--sys { background: var(--entry-sys-bg); border-left-color: var(--entry-sys-border); }
}

.entry-meta { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.dir-badge {
  padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
  &.dir-tx  { background: var(--badge-tx-bg);  .dir-text { color: var(--badge-tx-color); } }
  &.dir-rx  { background: var(--badge-rx-bg);  .dir-text { color: var(--badge-rx-color); } }
  &.dir-sys { background: var(--badge-sys-bg); .dir-text { color: var(--badge-sys-color); } }
}
.dir-text { font-size: 10px; font-weight: 700; }
.entry-time  { font-size: 10px; color: var(--text-dimmed); }
.entry-label { font-size: 10px; color: var(--text-muted); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.entry-len   { font-size: 10px; color: var(--text-dimmed); margin-left: auto; }

.entry-data { display: flex; flex-direction: column; gap: 2px; }
.data-hex   { font-size: 13px; line-height: 1.6; word-break: break-all; letter-spacing: 0.5px; }
.data-ascii { font-size: 12px; line-height: 1.6; word-break: break-all; }
.hex-tx, .ascii-tx { color: var(--data-hex-tx); }
.hex-rx, .ascii-rx { color: var(--data-hex-rx); }
.ascii-tx { opacity: 0.75; color: var(--data-ascii-tx); }
.ascii-rx { opacity: 0.75; color: var(--data-ascii-rx); }

.sys-text { font-size: 12px; color: var(--badge-sys-color); font-style: italic; }

/* 未读提示 */
.unread-badge {
  position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
  background: var(--color-primary); border-radius: 999px; padding: 5px 16px;
  box-shadow: 0 4px 16px rgba(var(--color-primary-rgb), 0.3);
}
.unread-text { font-size: 12px; font-weight: 600; color: var(--bg-base); }
</style>
