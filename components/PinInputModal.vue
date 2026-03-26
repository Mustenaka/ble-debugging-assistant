<template>
  <view v-if="visible" class="pin-overlay" @click="onCancel">
    <view
      class="pin-modal"
      :class="appStore.themeClass"
      :style="appStore.cssVarsStyle"
      @click.stop
    >
      <!-- 头部 -->
      <view class="pin-header">
        <view class="pin-icon-wrap">
          <text class="pin-icon">🔑</text>
        </view>
        <view class="pin-header-text">
          <text class="pin-title">{{ t('pin.title') }}</text>
          <text class="pin-subtitle">{{ deviceName }}</text>
        </view>
        <view class="pin-close" @click="onCancel">
          <text class="pin-close-icon">✕</text>
        </view>
      </view>

      <!-- PIN 输入 -->
      <view class="pin-field">
        <text class="field-label">{{ t('pin.pinLabel') }}</text>
        <view class="pin-input-wrap">
          <input
            class="pin-input"
            v-model="localPin"
            :placeholder="t('pin.pinPlaceholder')"
            placeholder-class="pin-ph"
            :password="pinHidden"
            maxlength="64"
          />
          <view class="pin-eye" @click="pinHidden = !pinHidden">
            <text class="pin-eye-icon">{{ pinHidden ? '◉' : '○' }}</text>
          </view>
        </view>
      </view>

      <!-- 格式选择 -->
      <view class="pin-field">
        <text class="field-label">{{ t('pin.modeLabel') }}</text>
        <view class="mode-row">
          <view
            class="mode-btn"
            :class="{ 'mode-btn--active': localMode === 'ascii' }"
            @click="localMode = 'ascii'"
          >
            <text class="mode-text">{{ t('pin.modeAscii') }}</text>
          </view>
          <view
            class="mode-btn"
            :class="{ 'mode-btn--active': localMode === 'hex' }"
            @click="localMode = 'hex'"
          >
            <text class="mode-text">{{ t('pin.modeHex') }}</text>
          </view>
        </view>
      </view>

      <!-- 记住 PIN -->
      <view class="pin-field pin-field--row" @click="localRemember = !localRemember">
        <view class="checkbox" :class="{ 'checkbox--checked': localRemember }">
          <text v-if="localRemember" class="checkbox-check">✓</text>
        </view>
        <text class="field-label field-label--inline">{{ t('pin.rememberPin') }}</text>
      </view>

      <!-- 自动发送 -->
      <view class="pin-field pin-field--row" @click="localAutoSend = !localAutoSend">
        <view class="checkbox" :class="{ 'checkbox--checked': localAutoSend }">
          <text v-if="localAutoSend" class="checkbox-check">✓</text>
        </view>
        <text class="field-label field-label--inline">{{ t('pin.autoSend') }}</text>
      </view>

      <!-- 自动发送目标（展开时显示） -->
      <view v-if="localAutoSend" class="auto-send-section">
        <view class="pin-field">
          <text class="field-label">{{ t('pin.charUUIDLabel') }}</text>
          <input
            class="uuid-input"
            v-model="localCharUUID"
            :placeholder="t('pin.charUUIDPlaceholder')"
            placeholder-class="pin-ph"
          />
        </view>
        <view class="pin-field">
          <text class="field-label">{{ t('pin.serviceUUIDLabel') }}</text>
          <input
            class="uuid-input"
            v-model="localServiceUUID"
            :placeholder="t('pin.serviceUUIDPlaceholder')"
            placeholder-class="pin-ph"
          />
        </view>
        <view class="hint-row">
          <text class="hint-icon">ℹ</text>
          <text class="hint-text">
            {{ localCharUUID ? t('pin.autoSendHint') : t('pin.manualSendHint') }}
          </text>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="pin-actions">
        <view class="pin-btn pin-btn--clear" @click="onClear">
          <text class="pin-btn-text">{{ t('pin.clear') }}</text>
        </view>
        <view class="pin-btn pin-btn--cancel" @click="onCancel">
          <text class="pin-btn-text">{{ t('pin.cancel') }}</text>
        </view>
        <view class="pin-btn pin-btn--save" @click="onSave">
          <text class="pin-btn-text">{{ t('pin.save') }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../composables/useI18n'
import type { DevicePinConfig } from '../utils/buffer'

const props = defineProps<{
  visible: boolean
  deviceId: string
  deviceName: string
  initialConfig?: DevicePinConfig | null
}>()

const emit = defineEmits<{
  (e: 'confirm', config: DevicePinConfig, remember: boolean): void
  (e: 'clear'): void
  (e: 'cancel'): void
}>()

const appStore = useAppStore()
const { t } = useI18n()

const localPin = ref('')
const localMode = ref<'ascii' | 'hex'>('ascii')
const localRemember = ref(true)
const localAutoSend = ref(false)
const localCharUUID = ref('')
const localServiceUUID = ref('')
const pinHidden = ref(true)

// 当弹窗打开时，从已存配置填充字段
watch(() => props.visible, (val) => {
  if (val && props.initialConfig) {
    localPin.value = props.initialConfig.pin
    localMode.value = props.initialConfig.mode
    localAutoSend.value = props.initialConfig.autoSend
    localCharUUID.value = props.initialConfig.charUUID ?? ''
    localServiceUUID.value = props.initialConfig.serviceUUID ?? ''
    localRemember.value = true
  } else if (val) {
    localPin.value = ''
    localMode.value = 'ascii'
    localRemember.value = true
    localAutoSend.value = false
    localCharUUID.value = ''
    localServiceUUID.value = ''
  }
})

function onSave() {
  if (!localPin.value.trim()) {
    uni.showToast({ title: t('pin.pinRequired'), icon: 'none' })
    return
  }
  const config: DevicePinConfig = {
    deviceId: props.deviceId,
    pin: localPin.value.trim(),
    mode: localMode.value,
    autoSend: localAutoSend.value,
    charUUID: localCharUUID.value.trim(),
    serviceUUID: localServiceUUID.value.trim(),
  }
  emit('confirm', config, localRemember.value)
}

function onClear() {
  emit('clear')
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.pin-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.pin-modal {
  width: 100%;
  max-height: 90vh;
  border-radius: 20rpx 20rpx 0 0;
  background: var(--bg-card);
  padding: 32rpx 32rpx 48rpx;
  overflow-y: auto;
}

.pin-header {
  display: flex;
  align-items: center;
  margin-bottom: 36rpx;
}

.pin-icon-wrap {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  background: var(--accent-alpha);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
  flex-shrink: 0;
}

.pin-icon {
  font-size: 36rpx;
}

.pin-header-text {
  flex: 1;
  min-width: 0;
}

.pin-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}

.pin-subtitle {
  font-size: 24rpx;
  color: var(--text-muted);
  display: block;
  margin-top: 4rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pin-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pin-close-icon {
  font-size: 24rpx;
  color: var(--text-muted);
}

.pin-field {
  margin-bottom: 28rpx;
}

.pin-field--row {
  display: flex;
  flex-direction: row;
  align-items: center;
  cursor: pointer;
}

.field-label {
  font-size: 24rpx;
  color: var(--text-muted);
  margin-bottom: 12rpx;
  display: block;
}

.field-label--inline {
  margin-bottom: 0;
  margin-left: 16rpx;
  font-size: 28rpx;
  color: var(--text-secondary);
}

.pin-input-wrap {
  display: flex;
  align-items: center;
  background: var(--bg-input);
  border-radius: 12rpx;
  border: 1px solid var(--border-color);
  padding: 0 24rpx;
}

.pin-input {
  flex: 1;
  height: 80rpx;
  font-size: 30rpx;
  color: var(--text-primary);
  background: transparent;
  font-family: 'Courier New', monospace;
  letter-spacing: 2rpx;
}

.pin-ph {
  color: var(--text-muted);
}

.pin-eye {
  padding: 16rpx;
}

.pin-eye-icon {
  font-size: 28rpx;
  color: var(--text-muted);
}

.mode-row {
  display: flex;
  gap: 16rpx;
}

.mode-btn {
  flex: 1;
  height: 64rpx;
  border-radius: 12rpx;
  border: 1px solid var(--border-color);
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mode-btn--active {
  background: var(--accent-alpha);
  border-color: var(--accent);
}

.mode-text {
  font-size: 26rpx;
  color: var(--text-secondary);
}

.mode-btn--active .mode-text {
  color: var(--accent);
  font-weight: 600;
}

.checkbox {
  width: 40rpx;
  height: 40rpx;
  border-radius: 8rpx;
  border: 2px solid var(--border-color);
  background: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.checkbox--checked {
  background: var(--accent);
  border-color: var(--accent);
}

.checkbox-check {
  font-size: 24rpx;
  color: #fff;
  font-weight: 700;
  line-height: 1;
}

.auto-send-section {
  background: var(--bg-input);
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  margin-bottom: 28rpx;
  border: 1px solid var(--border-color);
}

.auto-send-section .pin-field {
  margin-bottom: 20rpx;
}

.auto-send-section .pin-field:last-child {
  margin-bottom: 0;
}

.uuid-input {
  height: 64rpx;
  background: var(--bg-card);
  border-radius: 8rpx;
  border: 1px solid var(--border-color);
  padding: 0 20rpx;
  font-size: 24rpx;
  color: var(--text-primary);
  font-family: 'Courier New', monospace;
  width: 100%;
  box-sizing: border-box;
}

.hint-row {
  display: flex;
  align-items: flex-start;
  margin-top: 12rpx;
}

.hint-icon {
  font-size: 22rpx;
  color: var(--text-muted);
  margin-right: 8rpx;
  flex-shrink: 0;
  margin-top: 2rpx;
}

.hint-text {
  font-size: 22rpx;
  color: var(--text-muted);
  line-height: 1.5;
}

.pin-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 12rpx;
}

.pin-btn {
  height: 80rpx;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.pin-btn--clear {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  flex: 0 0 auto;
  padding: 0 28rpx;
}

.pin-btn--cancel {
  background: var(--bg-input);
  border: 1px solid var(--border-color);
}

.pin-btn--save {
  background: var(--accent);
  flex: 2;
}

.pin-btn-text {
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-secondary);
}

.pin-btn--save .pin-btn-text {
  color: #fff;
}
</style>
