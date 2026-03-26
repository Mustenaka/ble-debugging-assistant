<template>
  <view class="rssi-chart-wrap">
    <view class="chart-hd">
      <text class="chart-title">{{ title }}</text>
      <view class="chart-stats">
        <view v-if="minRssi !== null" class="stat-chip">
          <text class="stat-label">Min</text>
          <text class="stat-val" :style="{ color: rssiColor(minRssi) }">{{ minRssi }}</text>
        </view>
        <view v-if="currentRssi !== null" class="stat-chip stat-chip--current">
          <text class="stat-val current-val" :style="{ color: rssiColor(currentRssi) }">{{ currentRssi }} dBm</text>
        </view>
        <view v-if="maxRssi !== null" class="stat-chip">
          <text class="stat-label">Max</text>
          <text class="stat-val" :style="{ color: rssiColor(maxRssi) }">{{ maxRssi }}</text>
        </view>
      </view>
    </view>

    <view class="chart-body">
      <!-- Y 轴刻度 -->
      <view class="y-axis">
        <text class="y-label">0</text>
        <text class="y-label">-50</text>
        <text class="y-label">-100</text>
      </view>

      <!-- 柱状图区域 -->
      <view class="bars-area">
        <!-- 网格线 -->
        <view class="grid-line grid-line--top" />
        <view class="grid-line grid-line--mid" />
        <view class="grid-line grid-line--bot" />

        <!-- RSSI 柱 -->
        <view class="bars-row">
          <view
            v-for="(pt, i) in displayPoints"
            :key="i"
            class="rssi-bar"
            :style="{
              height: barHeightPct(pt.rssi) + '%',
              background: rssiColor(pt.rssi),
              opacity: i === displayPoints.length - 1 ? 1 : 0.6 + (i / displayPoints.length) * 0.4,
            }"
          />
        </view>
      </view>
    </view>

    <view v-if="!history.length" class="chart-empty">
      <text class="chart-empty-text">{{ waitingText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  history: { time: number; rssi: number }[]
  title?: string
  waitingText?: string
}>()

const displayPoints = computed(() => props.history.slice(-40))

const currentRssi = computed(() =>
  props.history.length ? props.history[props.history.length - 1].rssi : null
)
const minRssi = computed(() =>
  props.history.length ? Math.min(...props.history.map((p) => p.rssi)) : null
)
const maxRssi = computed(() =>
  props.history.length ? Math.max(...props.history.map((p) => p.rssi)) : null
)

function barHeightPct(rssi: number): number {
  // RSSI range: -100 ~ 0, map to 4~100%
  return Math.max(4, Math.min(100, rssi + 100))
}

function rssiColor(rssi: number): string {
  if (rssi >= -60) return '#39FF14'
  if (rssi >= -75) return '#FFD700'
  return '#FF6B6B'
}
</script>

<style lang="scss" scoped>
.rssi-chart-wrap {
  width: 100%;
}

/* ── 头部 ── */
.chart-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.chart-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.chart-stats {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat-chip {
  display: flex;
  align-items: center;
  gap: 4px;
}

.stat-chip--current {
  background: rgba(var(--color-primary-rgb), 0.08);
  border: 1px solid rgba(var(--color-primary-rgb), 0.2);
  border-radius: 6px;
  padding: 2px 8px;
}

.stat-label {
  font-size: 10px;
  color: var(--text-dimmed);
}

.stat-val {
  font-size: 11px;
  font-family: 'Courier New', monospace;
  font-weight: 600;
}

.current-val {
  font-size: 13px;
}

/* ── 图表体 ── */
.chart-body {
  display: flex;
  gap: 6px;
  height: 64px;
}

.y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-end;
  flex-shrink: 0;
  padding: 0 0 2px;
}

.y-label {
  font-size: 9px;
  color: var(--text-dimmed);
  font-family: 'Courier New', monospace;
  line-height: 1;
}

.bars-area {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.grid-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--border-subtle);
  opacity: 0.5;

  &--top { top: 0; }
  &--mid { top: 50%; }
  &--bot { bottom: 0; }
}

.bars-row {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: 0;
  display: flex;
  align-items: flex-end;
  gap: 2px;
}

.rssi-bar {
  flex: 1;
  min-width: 3px;
  border-radius: 2px 2px 0 0;
  transition: height 0.3s ease;
}

/* ── 空状态 ── */
.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64px;
}

.chart-empty-text {
  font-size: 12px;
  color: var(--text-dimmed);
  font-family: 'Courier New', monospace;
}
</style>
