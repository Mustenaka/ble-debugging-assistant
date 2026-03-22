<template>
  <view class="hex-input-wrap">

    <!-- 模式切换 & 工具栏 -->
    <view class="input-toolbar">
      <view class="mode-tabs">
        <view class="mode-tab" :class="{ active: mode === 'hex' }"   @click="setMode('hex')"><text>HEX</text></view>
        <view class="mode-tab" :class="{ active: mode === 'ascii' }" @click="setMode('ascii')"><text>ASCII</text></view>
      </view>
      <view class="toolbar-actions">
        <view class="tool-btn" @click="clearInput">
          <text class="tool-icon">✕</text>
        </view>
        <view class="tool-btn" @click="pasteInput">
          <text class="tool-icon">⎘</text>
        </view>
      </view>
    </view>

    <!-- 输入框 -->
    <view class="input-area" :class="{ 'input-area--error': !!validationError }">
      <textarea
        class="hex-textarea mono"
        :value="inputValue"
        :placeholder="modePlaceholder"
        placeholder-class="ph-style"
        :auto-height="false"
        fixed
        @input="onInput"
        @blur="onBlur"
      />
      <view v-if="validationError" class="error-hint">
        <text class="error-text">{{ validationError }}</text>
      </view>
    </view>

    <!-- 数据预览 -->
    <view v-if="previewText" class="data-preview">
      <text class="preview-label">{{ previewLabel }}</text>
      <text class="preview-value mono">{{ previewText }}</text>
      <text class="byte-count">{{ byteCount }} {{ bytesLabel }}</text>
    </view>

    <!-- 快捷命令 -->
    <view v-if="quickCommands.length" class="quick-commands">
      <text class="quick-label">{{ quickLabel }}</text>
      <scroll-view scroll-x class="cmd-scroll">
        <view class="cmd-list">
          <view v-for="cmd in quickCommands" :key="cmd.id" class="cmd-chip" @click="applyQuickCommand(cmd)" @longpress="$emit('delete-quick', cmd.id)">
            <text class="cmd-name">{{ cmd.name }}</text>
          </view>
          <view class="cmd-chip cmd-chip--add" @click="$emit('save-quick', { data: inputValue, mode })">
            <text class="cmd-add-icon">+</text>
          </view>
        </view>
      </scroll-view>
    </view>
    <view v-else class="quick-empty-add">
      <view class="cmd-chip cmd-chip--add" @click="$emit('save-quick', { data: inputValue, mode })">
        <text class="cmd-add-icon">+</text>
        <text class="cmd-add-text">{{ saveAsQuickLabel }}</text>
      </view>
    </view>

    <!-- 发送按钮 -->
    <view class="send-btn" :class="{ 'send-btn--disabled': !canSend || isSending }" @click="onSend">
      <view v-if="isSending" class="send-spin" />
      <text v-else class="send-icon">▶</text>
      <text class="send-label">{{ isSending ? sendingLabel : sendLabel }}</text>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { hexToBuf, asciiToBuf, isValidHex, bufToHex, bufToAscii, normalizeHex } from '../utils/hex'
import type { QuickCommand } from '../utils/buffer'

const props = defineProps<{
  quickCommands: QuickCommand[]
  isSending?: boolean
  disabled?: boolean
  hexPlaceholder?: string
  asciiPlaceholder?: string
  hexError?: string
  previewLabel?: string
  bytesLabel?: string
  quickLabel?: string
  saveAsQuickLabel?: string
  sendLabel?: string
  sendingLabel?: string
}>()

const emit = defineEmits<{
  send: [buffer: ArrayBuffer, label?: string]
  'save-quick': [payload: { data: string; mode: 'hex' | 'ascii' }]
  'delete-quick': [id: string]
}>()

const mode = ref<'hex' | 'ascii'>('hex')
const inputValue = ref('')
const validationError = ref('')

const modePlaceholder = computed(() => mode.value === 'hex' ? (props.hexPlaceholder ?? 'Enter HEX data') : (props.asciiPlaceholder ?? 'Enter ASCII string'))

const parsedBuffer = computed<ArrayBuffer | null>(() => {
  const val = inputValue.value.trim()
  if (!val) return null
  try { return mode.value === 'hex' ? hexToBuf(val) : asciiToBuf(val) } catch { return null }
})

const previewText = computed(() => {
  const buf = parsedBuffer.value
  if (!buf) return ''
  return mode.value === 'hex' ? bufToAscii(buf) : bufToHex(buf)
})

const byteCount = computed(() => parsedBuffer.value?.byteLength ?? 0)

const canSend = computed(() => {
  if (props.disabled) return false
  const val = inputValue.value.trim()
  if (!val) return false
  if (mode.value === 'hex' && !isValidHex(val)) return false
  return true
})

function setMode(m: 'hex' | 'ascii') {
  if (m === mode.value) return
  const buf = parsedBuffer.value
  inputValue.value = buf ? (m === 'hex' ? bufToHex(buf) : bufToAscii(buf)) : ''
  mode.value = m; validationError.value = ''
}

function onInput(e: any) {
  let val = e.detail.value as string
  if (mode.value === 'hex') val = val.toUpperCase().replace(/[^0-9A-F\s]/g, '')
  inputValue.value = val; validateInput(val)
}

function onBlur() {
  if (mode.value === 'hex' && inputValue.value.trim()) inputValue.value = normalizeHex(inputValue.value)
}

function validateInput(val: string) {
  if (!val.trim()) { validationError.value = ''; return }
  if (mode.value === 'hex' && !isValidHex(val)) {
    validationError.value = props.hexError ?? 'Invalid HEX format'
  } else { validationError.value = '' }
}

function clearInput() { inputValue.value = ''; validationError.value = '' }

async function pasteInput() {
  try {
    // #ifdef APP-PLUS
    const clipboard = await new Promise<string>((resolve) => {
      uni.getClipboardData({ success: (res: any) => resolve(res.data), fail: () => resolve('') })
    })
    inputValue.value = clipboard; validateInput(clipboard)
    // #endif
  } catch {}
}

function applyQuickCommand(cmd: QuickCommand) {
  mode.value = cmd.mode; inputValue.value = cmd.data; validateInput(cmd.data)
}

async function onSend() {
  if (!canSend.value || props.isSending) return
  const buf = parsedBuffer.value
  if (!buf) return
  emit('send', buf)
}
</script>

<style lang="scss" scoped>
.hex-input-wrap { display: flex; flex-direction: column; gap: 10px; }

/* 工具栏 */
.input-toolbar { display: flex; align-items: center; justify-content: space-between; }
.mode-tabs { display: flex; background: var(--bg-elevated); border-radius: 8px; padding: 3px; gap: 2px; }
.mode-tab {
  padding: 5px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;
  color: var(--text-muted); letter-spacing: 0.5px; transition: all 0.2s;
  &.active { background: rgba(var(--color-primary-rgb), 0.15); color: var(--color-primary); box-shadow: 0 0 8px rgba(var(--color-primary-rgb), 0.2); }
}
.toolbar-actions { display: flex; gap: 6px; }
.tool-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 6px; &:active { opacity: 0.7; } }
.tool-icon { font-size: 14px; color: var(--text-secondary); }

/* 输入框 */
.input-area {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px; overflow: hidden; transition: border-color 0.2s;
  &--error { border-color: rgba(var(--color-danger-rgb), 0.5); }
}
.hex-textarea { width: 100%; min-height: 80px; padding: 12px 14px; background: transparent; font-size: 14px; color: var(--text-mono); line-height: 1.6; border: none; resize: none; }
.ph-style { color: var(--text-dimmed); font-family: 'Courier New', monospace; font-size: 13px; }
.error-hint { padding: 4px 14px 8px; }
.error-text { font-size: 11px; color: var(--color-danger); }

/* 预览 */
.data-preview { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--bg-elevated); border-radius: 8px; flex-wrap: wrap; }
.preview-label { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.preview-value { flex: 1; font-size: 12px; color: var(--color-info); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.byte-count { font-size: 11px; color: var(--text-dimmed); flex-shrink: 0; }

/* 快捷命令 */
.quick-commands { display: flex; align-items: center; gap: 10px; }
.quick-label { font-size: 11px; color: var(--text-dimmed); flex-shrink: 0; }
.cmd-scroll { flex: 1; white-space: nowrap; }
.cmd-list { display: flex; gap: 6px; padding-bottom: 4px; }
.cmd-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px;
  background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.2);
  border-radius: 999px; flex-shrink: 0; white-space: nowrap;
  &:active { background: rgba(var(--color-primary-rgb), 0.18); }
  &--add { background: rgba(var(--color-accent-rgb), 0.08); border-color: rgba(var(--color-accent-rgb), 0.2); }
}
.cmd-name { font-size: 12px; color: var(--color-primary); font-weight: 500; }
.cmd-add-icon { font-size: 14px; color: var(--color-accent); font-weight: 300; }
.cmd-add-text { font-size: 12px; color: var(--color-accent); }
.quick-empty-add { display: flex; }

/* 发送按钮 */
.send-btn {
  height: 44px; display: flex; align-items: center; justify-content: center; gap: 8px;
  background: linear-gradient(135deg, var(--color-primary) 0%, rgba(var(--color-primary-rgb), 0.7) 100%);
  border-radius: 10px; box-shadow: 0 0 16px rgba(var(--color-primary-rgb), 0.35); transition: all 0.2s;
  &:active:not(.send-btn--disabled) { transform: scale(0.97); opacity: 0.9; }
  &--disabled { background: var(--bg-elevated); box-shadow: none; opacity: 0.5; }
}
.send-icon  { font-size: 14px; color: var(--bg-base); }
.send-label { font-size: 15px; font-weight: 700; color: var(--bg-base); letter-spacing: 1px; }
.send-spin  { width: 18px; height: 18px; border: 2px solid rgba(0,0,0,0.2); border-top-color: var(--bg-base); border-radius: 50%; animation: ble-spin 0.7s linear infinite; }
</style>
