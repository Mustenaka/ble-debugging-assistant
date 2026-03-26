<template>
  <view class="diff-overlay" @click="$emit('close')">
    <view
      class="diff-modal"
      :class="appStore.themeClass"
      :style="appStore.cssVarsStyle"
      @click.stop
    >
      <!-- 头部 -->
      <view class="diff-header">
        <view class="diff-header-left">
          <text class="diff-title">{{ title }}</text>
          <view v-if="history.length" class="diff-count">
            <text class="diff-count-text">{{ history.length }}</text>
          </view>
        </view>
        <view class="diff-close" @click="$emit('close')">
          <text class="diff-close-icon">✕</text>
        </view>
      </view>

      <!-- 空状态 -->
      <view v-if="!history.length" class="diff-empty">
        <text class="diff-empty-icon">⊙</text>
        <text class="diff-empty-text">{{ emptyText }}</text>
      </view>

      <!-- 历史列表（最新在上） -->
      <scroll-view v-else scroll-y class="diff-list">
        <view
          v-for="(entry, i) in reversedHistory"
          :key="entry.time"
          class="diff-entry"
          :class="{ 'diff-entry--latest': i === 0 }"
        >
          <view class="entry-meta">
            <view v-if="i === 0" class="latest-badge">
              <text class="latest-text">LATEST</text>
            </view>
            <text class="entry-time">{{ formatTs(entry.time) }}</text>
            <text class="entry-len">{{ byteCount(entry.hex) }} B</text>
          </view>
          <view class="entry-bytes">
            <text
              v-for="(byte, j) in splitBytes(entry.hex)"
              :key="j"
              class="entry-byte"
              :class="{ 'entry-byte--changed': isByteChanged(i, j) }"
            >{{ byte }}</text>
            <text v-if="!splitBytes(entry.hex).length" class="entry-empty">—</text>
          </view>
        </view>
      </scroll-view>

      <!-- 图例 -->
      <view v-if="history.length" class="diff-legend">
        <view class="legend-item">
          <view class="legend-dot legend-dot--changed" />
          <text class="legend-text">{{ changedLabel }}</text>
        </view>
        <view class="legend-item">
          <view class="legend-dot legend-dot--same" />
          <text class="legend-text">{{ sameLabel }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store/appStore'
import { formatTimestamp } from '../utils/buffer'

const props = defineProps<{
  history: { time: number; hex: string }[]
  title?: string
  emptyText?: string
  changedLabel?: string
  sameLabel?: string
}>()

defineEmits<{ close: [] }>()

const appStore = useAppStore()

// 最新的在最前面
const reversedHistory = computed(() => [...props.history].reverse())

function formatTs(ts: number): string {
  return formatTimestamp(ts, false)
}

function splitBytes(hex: string): string[] {
  return hex.trim() ? hex.trim().split(' ') : []
}

function byteCount(hex: string): number {
  return splitBytes(hex).length
}

/**
 * i 是 reversedHistory 中的索引（0 = latest），
 * 比较 reversedHistory[i] 与 reversedHistory[i+1]（更早的一条）
 */
function isByteChanged(entryIndex: number, byteIndex: number): boolean {
  // 最后一条没有前驱，不高亮
  if (entryIndex >= reversedHistory.value.length - 1) return false
  const curr = splitBytes(reversedHistory.value[entryIndex].hex)
  const prev = splitBytes(reversedHistory.value[entryIndex + 1].hex)
  if (byteIndex >= curr.length) return false
  return byteIndex >= prev.length || prev[byteIndex] !== curr[byteIndex]
}
</script>

<style lang="scss" scoped>
.diff-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  z-index: 400;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.diff-modal {
  width: 100%;
  max-width: 560px;
  max-height: 70vh;
  border-radius: 20px 20px 0 0;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── 头部 ── */
.diff-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-subtle);
}

.diff-header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.diff-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.diff-count {
  background: rgba(var(--color-primary-rgb), 0.12);
  border: 1px solid rgba(var(--color-primary-rgb), 0.25);
  border-radius: 999px;
  padding: 1px 8px;
}

.diff-count-text {
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 600;
}

.diff-close {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  &:active { opacity: 0.7; }
}

.diff-close-icon {
  font-size: 13px;
  color: var(--text-muted);
}

/* ── 空状态 ── */
.diff-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 40px 24px;
}

.diff-empty-icon {
  font-size: 36px;
  color: var(--bg-elevated);
}

.diff-empty-text {
  font-size: 13px;
  color: var(--text-dimmed);
}

/* ── 列表 ── */
.diff-list {
  flex: 1;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-entry {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &--latest {
    border-color: rgba(var(--color-primary-rgb), 0.3);
    background: rgba(var(--color-primary-rgb), 0.04);
  }
}

.entry-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.latest-badge {
  background: rgba(var(--color-primary-rgb), 0.12);
  border: 1px solid rgba(var(--color-primary-rgb), 0.3);
  border-radius: 4px;
  padding: 1px 6px;
}

.latest-text {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-primary);
  letter-spacing: 0.5px;
}

.entry-time {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
  flex: 1;
}

.entry-len {
  font-size: 11px;
  color: var(--text-dimmed);
  font-family: 'Courier New', monospace;
}

/* ── 字节显示 ── */
.entry-bytes {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.entry-byte {
  font-size: 13px;
  font-family: 'Courier New', monospace;
  color: var(--text-mono);
  padding: 2px 4px;
  border-radius: 3px;
  background: var(--bg-elevated);

  &--changed {
    color: var(--color-warning);
    background: rgba(var(--color-warning-rgb), 0.12);
    border: 1px solid rgba(var(--color-warning-rgb), 0.3);
  }
}

.entry-empty {
  font-size: 12px;
  color: var(--text-dimmed);
}

/* ── 图例 ── */
.diff-legend {
  display: flex;
  gap: 16px;
  padding: 10px 20px;
  border-top: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 2px;

  &--changed {
    background: var(--color-warning);
    border: 1px solid rgba(var(--color-warning-rgb), 0.5);
  }

  &--same {
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
  }
}

.legend-text {
  font-size: 11px;
  color: var(--text-muted);
}
</style>
