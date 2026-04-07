<template>
  <view class="device-tab-bar">
    <scroll-view scroll-x class="tabs-scroll" :scroll-into-view="activeScrollId">
      <!-- 无会话空状态 -->
      <view v-if="!sessionList.length" class="tab-empty">
        <text class="tab-empty-text">{{ t('multiDevice.noSessions') }}</text>
      </view>

      <!-- 设备 Tab -->
      <view
        v-for="item in sessionList"
        :key="item.deviceId"
        :id="`tab_${item.deviceId.replace(/[^a-z0-9]/gi, '')}`"
        class="tab-item"
        :class="{ 'tab-item--active': item.deviceId === activeSessionId }"
        @click="handleTabClick(item.deviceId)"
      >
        <!-- 连接状态指示点 -->
        <view class="tab-dot" :class="item.connected ? 'dot--on' : 'dot--off'" />

        <!-- 设备名 -->
        <text class="tab-name" :numberOfLines="1">{{ item.name }}</text>

        <!-- RSSI 信号格 -->
        <view class="tab-rssi">
          <view
            v-for="i in 4"
            :key="i"
            class="rssi-bar"
            :class="{ 'rssi-bar--lit': i <= item.rssiLevel }"
          />
        </view>

        <!-- 关闭（断开）按钮 -->
        <view class="tab-close" @click.stop="handleClose(item.deviceId)">
          <text class="tab-close-icon">×</text>
        </view>
      </view>
    </scroll-view>

    <!-- 添加设备按钮 -->
    <view class="tab-add" @click="handleAdd">
      <text class="tab-add-icon">+</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useBleStore } from '../store/bleStore'
import { useI18n } from '../composables/useI18n'
import { rssiToLevel } from '../utils/hex'
import { BleDeviceState } from '../services/bleManager'

const bleStore = useBleStore()
const { t } = useI18n()

const emit = defineEmits<{
  (e: 'add'): void
  (e: 'close', deviceId: string): void
}>()

const sessionList = computed(() => {
  const list: {
    deviceId: string
    name: string
    rssiLevel: number
    connected: boolean
  }[] = []
  bleStore.sessions.forEach((session, deviceId) => {
    list.push({
      deviceId,
      name: session.device.name,
      rssiLevel: rssiToLevel(session.device.RSSI),
      connected: session.deviceState === BleDeviceState.CONNECTED,
    })
  })
  return list
})

const activeSessionId = computed(() => bleStore.activeSessionId)

// 自动滚动到当前激活 tab
const activeScrollId = computed(() => {
  if (!activeSessionId.value) return ''
  return `tab_${activeSessionId.value.replace(/[^a-z0-9]/gi, '')}`
})

function handleTabClick(deviceId: string) {
  bleStore.switchSession(deviceId)
}

function handleClose(deviceId: string) {
  emit('close', deviceId)
}

function handleAdd() {
  emit('add')
}
</script>

<style lang="scss" scoped>
.device-tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle);
  height: 44px;
  overflow: hidden;
}

.tabs-scroll {
  flex: 1;
  white-space: nowrap;
  height: 44px;
}

/* ── Tab 空状态 ── */
.tab-empty {
  display: inline-flex;
  align-items: center;
  height: 44px;
  padding: 0 16px;
}
.tab-empty-text {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── Tab 项 ── */
.tab-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 44px;
  padding: 0 10px 0 12px;
  border-right: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.15s;
  position: relative;

  &:active { background: var(--bg-elevated); }

  &--active {
    background: var(--bg-elevated);
    // 底部激活线
    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: var(--color-primary);
      border-radius: 1px 1px 0 0;
    }
  }
}

/* ── 连接状态点 ── */
.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;

  &.dot--on {
    background: var(--color-accent);
    box-shadow: 0 0 5px rgba(var(--color-accent-rgb, 57, 255, 20), 0.5);
  }
  &.dot--off {
    background: var(--color-danger);
  }
}

/* ── 设备名 ── */
.tab-name {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  .tab-item--active & {
    color: var(--color-primary);
  }
}

/* ── RSSI 信号格 ── */
.tab-rssi {
  display: flex;
  align-items: flex-end;
  gap: 1px;
  height: 12px;
  flex-shrink: 0;
}
.rssi-bar {
  width: 3px;
  border-radius: 1px;
  background: var(--bg-elevated);
  &:nth-child(1) { height: 30%; }
  &:nth-child(2) { height: 50%; }
  &:nth-child(3) { height: 75%; }
  &:nth-child(4) { height: 100%; }

  &--lit { background: var(--color-accent); }
}

/* ── 关闭按钮 ── */
.tab-close {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  flex-shrink: 0;

  &:active { background: var(--bg-elevated); opacity: 0.7; }
}
.tab-close-icon {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1;

  .tab-item--active & { color: var(--color-danger); }
}

/* ── 添加设备按钮 ── */
.tab-add {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-left: 1px solid var(--border-subtle);
  flex-shrink: 0;
  &:active { background: var(--bg-elevated); }
}
.tab-add-icon {
  font-size: 20px;
  color: var(--color-primary);
  line-height: 1;
}
</style>
