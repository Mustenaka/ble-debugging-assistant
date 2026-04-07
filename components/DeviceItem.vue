<template>
  <view class="device-item" :class="{ 'device-item--connecting': isConnecting }" @click="$emit('connect', device)">

    <!-- 左：信号强度 -->
    <view class="signal-block">
      <view class="rssi-bars">
        <view
          v-for="i in 5" :key="i"
          class="bar"
          :class="{ active: i <= rssiLevel }"
          :style="{ color: rssiColor }"
        />
      </view>
      <text class="rssi-value mono" :style="{ color: rssiColor }">{{ device.RSSI }} dBm</text>
    </view>

    <!-- 中：设备信息 -->
    <view class="device-info">
      <view class="device-name-row">
        <text class="device-name">{{ displayName }}</text>
        <view v-if="isAlreadyConnected" class="connected-badge">
          <text class="connected-badge-text">{{ alreadyConnectedLabel }}</text>
        </view>
        <view v-else-if="device.connectable !== false" class="connectable-badge">
          <text class="connectable-text">{{ connectableLabel }}</text>
        </view>
        <view v-if="hasPinConfig" class="pin-badge">
          <text class="pin-badge-text">🔑</text>
        </view>
      </view>
      <text class="device-id mono">{{ device.deviceId }}</text>
      <view v-if="device.advertisServiceUUIDs?.length" class="service-uuids">
        <view v-for="uuid in device.advertisServiceUUIDs.slice(0, 2)" :key="uuid" class="uuid-chip">
          <text class="uuid-text">{{ shortUUID(uuid) }}</text>
        </view>
        <view v-if="device.advertisServiceUUIDs.length > 2" class="uuid-chip uuid-chip--more">
          <text class="uuid-text">+{{ device.advertisServiceUUIDs.length - 2 }}</text>
        </view>
      </view>
    </view>

    <!-- 右：操作 -->
    <view class="device-action">
      <!-- PIN 配置按钮 -->
      <view class="pin-btn" @click.stop="$emit('configPin', device)">
        <text class="pin-btn-icon">🔑</text>
      </view>
      <view v-if="isConnecting" class="connecting-spin">
        <view class="spin-ring" />
      </view>
      <view v-else class="connect-arrow">
        <text class="arrow-icon">›</text>
      </view>
    </view>

    <!-- 信号脉冲光效 -->
    <view class="signal-pulse" :style="{ backgroundColor: rssiColor, opacity: pulseOpacity }" />
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { BleDevice } from '../services/bleManager'
import { rssiToLevel, rssiToColor, shortUUID } from '../utils/hex'

const props = defineProps<{
  device: BleDevice
  isConnecting?: boolean
  isAlreadyConnected?: boolean
  connectableLabel?: string
  alreadyConnectedLabel?: string
  unknownLabel?: string
  hasPinConfig?: boolean
}>()

defineEmits<{
  connect: [device: BleDevice]
  configPin: [device: BleDevice]
}>()

const rssiLevel = computed(() => rssiToLevel(props.device.RSSI))
const rssiColor = computed(() => rssiToColor(props.device.RSSI))
const displayName = computed(() => {
  const n = props.device.name?.trim()
  return (!n || n === 'N/A') ? (props.unknownLabel ?? '未知设备') : n
})

const pulseOpacity = ref(0)
let pulseTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  pulseTimer = setInterval(() => {
    pulseOpacity.value = 0.18
    setTimeout(() => { pulseOpacity.value = 0 }, 600)
  }, 3000)
})

onUnmounted(() => { if (pulseTimer) clearInterval(pulseTimer) })
</script>

<style lang="scss" scoped>
.device-item {
  display: flex; align-items: center; gap: 12px; padding: 14px 16px;
  background: var(--bg-card); border-radius: 12px; border: 1px solid var(--border-subtle);
  position: relative; overflow: hidden; transition: border-color 0.2s, background 0.2s;

  &:active { background: var(--bg-elevated); border-color: rgba(var(--color-primary-rgb), 0.3); }
  &--connecting { border-color: rgba(var(--color-primary-rgb), 0.4); animation: pulse-border 1.5s ease-in-out infinite; }
}

@keyframes pulse-border {
  0%,100% { border-color: rgba(var(--color-primary-rgb), 0.4); }
  50%      { border-color: rgba(var(--color-primary-rgb), 0.8); }
}

/* 信号 */
.signal-block { display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 44px; }

.rssi-bars { display: flex; align-items: flex-end; gap: 3px; height: 18px; }
.bar {
  width: 5px; border-radius: 2px; background: var(--bg-elevated); transition: background 0.3s;
  &:nth-child(1) { height: 4px; } &:nth-child(2) { height: 7px; } &:nth-child(3) { height: 11px; }
  &:nth-child(4) { height: 14px; } &:nth-child(5) { height: 18px; }
  &.active { background: currentColor; box-shadow: 0 0 4px currentColor; }
}

.rssi-value { font-size: 10px; white-space: nowrap; }

/* 设备信息 */
.device-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.device-name-row { display: flex; align-items: center; gap: 8px; }
.device-name { font-size: 15px; font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; }
.connectable-badge { background: rgba(var(--color-accent-rgb), 0.12); border: 1px solid rgba(var(--color-accent-rgb), 0.3); border-radius: 4px; padding: 1px 6px; flex-shrink: 0; }
.connectable-text { font-size: 10px; color: var(--color-accent); font-weight: 600; }
.connected-badge { background: rgba(var(--color-primary-rgb), 0.15); border: 1px solid rgba(var(--color-primary-rgb), 0.4); border-radius: 4px; padding: 1px 6px; flex-shrink: 0; }
.connected-badge-text { font-size: 10px; color: var(--color-primary); font-weight: 700; }
.device-id { font-size: 11px; color: var(--text-dimmed); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.service-uuids { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
.uuid-chip { background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.2); border-radius: 4px; padding: 1px 6px; &--more { background: rgba(var(--text-muted), 0.08); border-color: var(--border-subtle); } }
.uuid-text { font-size: 10px; color: var(--color-primary); font-family: 'Courier New', monospace; }

/* 操作 */
.device-action { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.connect-arrow { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(var(--color-primary-rgb), 0.08); border-radius: 8px; }
.arrow-icon { font-size: 20px; color: var(--color-primary); font-weight: 300; line-height: 1; }
.connecting-spin { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; }
.spin-ring { width: 22px; height: 22px; border: 2px solid var(--border-subtle); border-top-color: var(--color-primary); border-radius: 50%; animation: ble-spin 0.8s linear infinite; }
.pin-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: rgba(var(--color-primary-rgb), 0.06); border-radius: 8px; }
.pin-btn-icon { font-size: 16px; line-height: 1; }
.pin-badge { display: flex; align-items: center; }
.pin-badge-text { font-size: 12px; line-height: 1; }

/* 脉冲光效 */
.signal-pulse { position: absolute; right: 0; top: 0; bottom: 0; width: 3px; border-radius: 0 12px 12px 0; transition: opacity 0.6s ease; }
</style>
