<template>
  <view v-if="visible" class="hb-overlay" @click="$emit('close')">
    <view class="hb-panel" :class="{ 'hb-panel--wide': isWideScreen }" @click.stop>

      <!-- 头部 -->
      <view class="hb-header">
        <view class="hb-title-row">
          <text class="hb-heart" :class="{ 'hb-heart--beating': hb?.running }">♥</text>
          <text class="hb-title">{{ t('heartbeat.title') }}</text>
        </view>
        <view class="hb-close" @click="$emit('close')"><text class="hb-close-icon">✕</text></view>
      </view>

      <scroll-view scroll-y class="hb-scroll">

        <!-- ═══ 运行中：实时统计 ═══ -->
        <view v-if="hb?.running" class="hb-running">

          <view class="run-banner">
            <text class="run-banner-text">{{ t('heartbeat.running') }} · {{ t('heartbeat.uptime') }} {{ uptimeText }}</text>
          </view>

          <view v-if="hb.consecutiveMissed >= 3" class="warn-banner">
            <text class="warn-text">⚠ {{ t('heartbeat.consecutiveWarn', { n: hb.consecutiveMissed }) }}</text>
          </view>

          <view class="stat-grid">
            <view class="stat-cell">
              <text class="stat-num">{{ hb.sent }}</text>
              <text class="stat-lbl">{{ t('heartbeat.statSent') }}</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num stat-ok">{{ hb.acked }}</text>
              <text class="stat-lbl">{{ t('heartbeat.statAcked') }}</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num stat-bad">{{ hb.missed }}</text>
              <text class="stat-lbl">{{ t('heartbeat.statMissed') }}</text>
            </view>
            <view class="stat-cell">
              <text class="stat-num" :class="lossPercent > 5 ? 'stat-bad' : 'stat-ok'">{{ lossPercent }}%</text>
              <text class="stat-lbl">{{ t('heartbeat.statLoss') }}</text>
            </view>
          </view>

          <view v-if="hb.config?.expectResponse" class="rtt-grid">
            <view class="rtt-cell">
              <text class="rtt-lbl">{{ t('heartbeat.statLastRtt') }}</text>
              <text class="rtt-num mono">{{ hb.lastRttMs != null ? hb.lastRttMs + 'ms' : '—' }}</text>
            </view>
            <view class="rtt-cell">
              <text class="rtt-lbl">{{ t('heartbeat.statAvgRtt') }}</text>
              <text class="rtt-num mono">{{ hb.rttAvgMs != null ? hb.rttAvgMs + 'ms' : '—' }}</text>
            </view>
            <view class="rtt-cell">
              <text class="rtt-lbl">{{ t('heartbeat.statMinRtt') }}</text>
              <text class="rtt-num mono">{{ hb.rttMinMs != null ? hb.rttMinMs + 'ms' : '—' }}</text>
            </view>
            <view class="rtt-cell">
              <text class="rtt-lbl">{{ t('heartbeat.statMaxRtt') }}</text>
              <text class="rtt-num mono">{{ hb.rttMaxMs != null ? hb.rttMaxMs + 'ms' : '—' }}</text>
            </view>
          </view>

          <!-- RTT 迷你趋势条 -->
          <view v-if="hb.rttHistory.length >= 2" class="rtt-bars">
            <view
              v-for="(p, i) in hb.rttHistory.slice(-40)"
              :key="i"
              class="rtt-bar"
              :style="{ height: rttBarHeight(p.rtt) + '%' }"
            />
          </view>

          <view class="cfg-summary">
            <text class="cfg-summary-text mono">
              {{ shortUUID(hb.config?.serviceUUID ?? '') }} / {{ shortUUID(hb.config?.characteristicUUID ?? '') }}
              · {{ hb.config?.intervalMs }}ms
              · {{ hb.config?.writeWithResponse ? 'WRITE' : 'WRITE NR' }}
            </text>
            <text class="cfg-summary-payload mono">{{ hb.config?.payload }}</text>
          </view>

          <view class="hb-btn hb-btn--stop" @click="handleStop">
            <text class="hb-btn-text">{{ t('heartbeat.stop') }}</text>
          </view>
        </view>

        <!-- ═══ 未运行：配置表单 ═══ -->
        <view v-else class="hb-form">

          <!-- 写入目标 -->
          <view class="form-field">
            <text class="form-label">{{ t('heartbeat.targetLabel') }}</text>
            <view v-if="!writableChars.length" class="empty-chars">
              <text class="empty-chars-text">{{ t('heartbeat.noWritableChars') }}</text>
            </view>
            <scroll-view v-else scroll-y class="char-select">
              <view
                v-for="c in writableChars"
                :key="c.serviceUUID + c.uuid"
                class="char-option"
                :class="{ 'char-option--active': isTarget(c) }"
                @click="selectTarget(c)"
              >
                <view class="co-radio" :class="{ 'co-radio--on': isTarget(c) }" />
                <view class="co-info">
                  <text class="co-uuid mono">{{ shortUUID(c.serviceUUID) }} / {{ shortUUID(c.uuid) }}</text>
                </view>
                <view class="co-props">
                  <text v-if="c.write" class="co-prop">W</text>
                  <text v-if="c.writeNoResponse" class="co-prop">WNR</text>
                </view>
              </view>
            </scroll-view>
          </view>

          <!-- 心跳内容 -->
          <view class="form-field">
            <view class="form-label-row">
              <text class="form-label">{{ t('heartbeat.payloadLabel') }}</text>
              <view class="mode-tabs">
                <view class="mode-tab" :class="{ 'mode-tab--active': form.payloadMode === 'hex' }" @click="form.payloadMode = 'hex'"><text class="mt-text">HEX</text></view>
                <view class="mode-tab" :class="{ 'mode-tab--active': form.payloadMode === 'ascii' }" @click="form.payloadMode = 'ascii'"><text class="mt-text">ASCII</text></view>
              </view>
            </view>
            <textarea
              class="form-textarea mono"
              :value="form.payload"
              :placeholder="form.payloadMode === 'hex' ? t('hexInput.hexPlaceholder') : t('hexInput.asciiPlaceholder')"
              placeholder-class="form-ph"
              maxlength="500"
              :adjust-position="true"
              cursor-spacing="24"
              @input="form.payload = $event.detail.value"
            />
            <text class="form-hint">{{ t('heartbeat.payloadHint') }}</text>
            <scroll-view v-if="bleStore.quickCommands.length" scroll-x class="qc-row">
              <view class="qc-chips">
                <text class="qc-title">{{ t('heartbeat.fromQuickCmd') }}:</text>
                <view v-for="cmd in bleStore.quickCommands" :key="cmd.id" class="qc-chip" @click="fillFromQuick(cmd)">
                  <text class="qc-chip-text">{{ cmd.name }}</text>
                </view>
              </view>
            </scroll-view>
          </view>

          <!-- 间隔 + 写入方式 -->
          <view class="form-row">
            <view class="form-field form-field--half">
              <text class="form-label">{{ t('heartbeat.intervalLabel') }}</text>
              <input
                class="form-input mono"
                type="number"
                :value="String(form.intervalMs)"
                placeholder="5000"
                placeholder-class="form-ph"
                @input="form.intervalMs = parseInt($event.detail.value) || 0"
              />
            </view>
            <view class="form-field form-field--half">
              <text class="form-label">{{ t('heartbeat.writeModeLabel') }}</text>
              <view class="mode-tabs mode-tabs--fill">
                <view class="mode-tab" :class="{ 'mode-tab--active': form.writeWithResponse }" @click="form.writeWithResponse = true"><text class="mt-text">WRITE</text></view>
                <view class="mode-tab" :class="{ 'mode-tab--active': !form.writeWithResponse }" @click="form.writeWithResponse = false"><text class="mt-text">WRITE NR</text></view>
              </view>
            </view>
          </view>

          <!-- 应答校验 -->
          <view class="form-field">
            <view class="toggle-row" @click="form.expectResponse = !form.expectResponse">
              <text class="toggle-check">{{ form.expectResponse ? '✓' : '' }}</text>
              <text class="toggle-text">{{ t('heartbeat.expectResponse') }}</text>
            </view>
          </view>

          <template v-if="form.expectResponse">
            <view class="form-field">
              <text class="form-label">{{ t('heartbeat.responseCharLabel') }}</text>
              <scroll-view scroll-y class="char-select char-select--short">
                <view
                  class="char-option"
                  :class="{ 'char-option--active': !form.responseCharacteristicUUID }"
                  @click="form.responseCharacteristicUUID = ''"
                >
                  <view class="co-radio" :class="{ 'co-radio--on': !form.responseCharacteristicUUID }" />
                  <view class="co-info"><text class="co-uuid">{{ t('heartbeat.anyChar') }}</text></view>
                </view>
                <view
                  v-for="c in notifyChars"
                  :key="c.serviceUUID + c.uuid"
                  class="char-option"
                  :class="{ 'char-option--active': isResponseChar(c) }"
                  @click="selectResponseChar(c)"
                >
                  <view class="co-radio" :class="{ 'co-radio--on': isResponseChar(c) }" />
                  <view class="co-info">
                    <text class="co-uuid mono">{{ shortUUID(c.serviceUUID) }} / {{ shortUUID(c.uuid) }}</text>
                  </view>
                  <view class="co-props"><text class="co-prop co-prop--n">N</text></view>
                </view>
              </scroll-view>
              <text class="form-hint">{{ form.responseCharacteristicUUID ? t('heartbeat.notifyHint') : t('heartbeat.anyNotifyHint') }}</text>
            </view>

            <view class="form-row">
              <view class="form-field form-field--half">
                <text class="form-label">{{ t('heartbeat.matchHexLabel') }}</text>
                <input
                  class="form-input mono"
                  :value="form.responseMatchHex"
                  :placeholder="t('heartbeat.matchHexPlaceholder')"
                  placeholder-class="form-ph"
                  @input="form.responseMatchHex = $event.detail.value"
                />
              </view>
              <view class="form-field form-field--half">
                <text class="form-label">{{ t('heartbeat.timeoutLabel') }}</text>
                <input
                  class="form-input mono"
                  type="number"
                  :value="String(form.timeoutMs)"
                  placeholder="2000"
                  placeholder-class="form-ph"
                  @input="form.timeoutMs = parseInt($event.detail.value) || 0"
                />
              </view>
            </view>
          </template>

          <view class="hb-btn hb-btn--start" @click="handleStart">
            <text class="hb-btn-text">♥ {{ t('heartbeat.start') }}</text>
          </view>
        </view>

        <view class="safe-bottom-spacer" />
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch, onUnmounted } from 'vue'
import { useBleStore } from '../store/bleStore'
import { useI18n } from '../composables/useI18n'
import { useResponsive } from '../composables/useResponsive'
import { shortUUID, isValidHex, normalizeHex } from '../utils/hex'
import { bleManager } from '../services/bleManager'
import {
  defaultHeartbeatConfig,
  loadHeartbeatConfig,
  heartbeatLossPercent,
  type HeartbeatConfig,
} from '../utils/heartbeat'
import type { QuickCommand } from '../utils/buffer'

const props = defineProps<{ visible: boolean }>()
const emit = defineEmits<{ close: [] }>()

const bleStore = useBleStore()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const hb = computed(() => bleStore.activeHeartbeat)
const lossPercent = computed(() => (hb.value ? heartbeatLossPercent(hb.value) : 0))

// ── 表单状态 ────────────────────────────────────────────────────────────────

const form = reactive<HeartbeatConfig>(defaultHeartbeatConfig())

interface CharOption {
  serviceUUID: string
  uuid: string
  write: boolean
  writeNoResponse: boolean
}

const writableChars = computed<CharOption[]>(() => {
  const session = bleStore.activeSession
  if (!session) return []
  const list: CharOption[] = []
  session.characteristics.forEach((chars, serviceUUID) => {
    for (const c of chars) {
      if (c.properties.write || c.properties.writeNoResponse) {
        list.push({
          serviceUUID,
          uuid: c.uuid,
          write: !!c.properties.write,
          writeNoResponse: !!c.properties.writeNoResponse,
        })
      }
    }
  })
  return list
})

const notifyChars = computed<{ serviceUUID: string; uuid: string }[]>(() => {
  const session = bleStore.activeSession
  if (!session) return []
  const list: { serviceUUID: string; uuid: string }[] = []
  session.characteristics.forEach((chars, serviceUUID) => {
    for (const c of chars) {
      if (c.properties.notify || c.properties.indicate) {
        list.push({ serviceUUID, uuid: c.uuid })
      }
    }
  })
  return list
})

function isTarget(c: CharOption): boolean {
  return form.serviceUUID === c.serviceUUID && form.characteristicUUID === c.uuid
}

function selectTarget(c: CharOption) {
  form.serviceUUID = c.serviceUUID
  form.characteristicUUID = c.uuid
  // 目标只支持无响应写时自动切换
  if (!c.write) form.writeWithResponse = false
}

function isResponseChar(c: { serviceUUID: string; uuid: string }): boolean {
  return form.responseCharacteristicUUID === c.uuid
}

function selectResponseChar(c: { serviceUUID: string; uuid: string }) {
  form.responseCharacteristicUUID = c.uuid
}

function fillFromQuick(cmd: QuickCommand) {
  form.payloadMode = cmd.mode
  form.payload = cmd.data
}

// 打开面板时载入设备已保存配置
watch(() => props.visible, (v) => {
  if (!v) return
  const deviceId = bleStore.activeSessionId
  if (!deviceId) return
  const saved = loadHeartbeatConfig(deviceId)
  Object.assign(form, defaultHeartbeatConfig(), saved ?? {})
  // 校验保存的目标是否仍然有效，否则选第一个可写特征值
  const stillValid = writableChars.value.some((c) => isTarget(c))
  if (!stillValid) {
    const session = bleStore.activeSession
    const active = writableChars.value.find(
      (c) => session && c.serviceUUID === session.activeServiceId && c.uuid === session.activeCharacteristicId
    )
    const first = active ?? writableChars.value[0]
    if (first) selectTarget(first)
    else { form.serviceUUID = ''; form.characteristicUUID = '' }
  }
})

// ── 启动 / 停止 ─────────────────────────────────────────────────────────────

async function handleStart() {
  if (!form.serviceUUID || !form.characteristicUUID) {
    uni.showToast({ title: t('heartbeat.invalidTarget'), icon: 'none' }); return
  }
  if (!form.payload.trim()) {
    uni.showToast({ title: t('heartbeat.invalidPayload'), icon: 'none' }); return
  }
  if (form.payloadMode === 'hex') {
    const normalized = normalizeHex(form.payload)
    if (!isValidHex(normalized)) {
      uni.showToast({ title: t('heartbeat.invalidPayload'), icon: 'none' }); return
    }
    form.payload = normalized
  }
  if (!form.intervalMs || form.intervalMs < 200) {
    uni.showToast({ title: t('heartbeat.invalidInterval'), icon: 'none' }); return
  }
  if (form.expectResponse && (form.timeoutMs < 100 || form.timeoutMs > form.intervalMs)) {
    uni.showToast({ title: t('heartbeat.invalidTimeout'), icon: 'none' }); return
  }
  if (form.responseMatchHex && !isValidHex(normalizeHex(form.responseMatchHex))) {
    form.responseMatchHex = ''
  }

  const deviceId = bleStore.activeSessionId
  if (!deviceId) return

  // 自动为指定应答特征值开启 Notify
  if (form.expectResponse && form.responseCharacteristicUUID) {
    const target = notifyChars.value.find((c) => c.uuid === form.responseCharacteristicUUID)
    if (target) {
      try {
        await bleManager.setNotify(deviceId, target.serviceUUID, target.uuid, true)
      } catch { /* Notify 可能已开启，忽略 */ }
    }
  }

  bleStore.startHeartbeatTest(deviceId, { ...form })
  uni.showToast({ title: t('heartbeat.startedToast'), icon: 'none', duration: 1200 })
}

function handleStop() {
  bleStore.stopHeartbeatTest(bleStore.activeSessionId)
  uni.showToast({ title: t('heartbeat.stoppedToast'), icon: 'none', duration: 1200 })
}

// ── 运行时长（每秒刷新）─────────────────────────────────────────────────────

const nowTick = ref(Date.now())
let tickTimer: ReturnType<typeof setInterval> | null = null

watch(
  () => props.visible && !!hb.value?.running,
  (active) => {
    if (active && !tickTimer) {
      tickTimer = setInterval(() => { nowTick.value = Date.now() }, 1000)
    } else if (!active && tickTimer) {
      clearInterval(tickTimer)
      tickTimer = null
    }
  },
  { immediate: true },
)

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer)
})

const uptimeText = computed(() => {
  const started = hb.value?.startedAt
  if (!started) return '—'
  const totalSec = Math.max(0, Math.floor((nowTick.value - started) / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
})

function rttBarHeight(rtt: number): number {
  const max = hb.value?.rttMaxMs ?? rtt
  if (!max) return 10
  return Math.max(10, Math.round((rtt / max) * 100))
}
</script>

<style lang="scss" scoped>
.hb-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 300;
}

.hb-panel {
  width: 100%;
  max-height: 84vh;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 18px 18px 0 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  padding-bottom: env(safe-area-inset-bottom, 0px);

  &--wide {
    max-width: 540px;
    border-radius: 16px;
    margin-bottom: 8vh;
    align-self: center;
  }
}

.hb-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 18px 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.hb-title-row { display: flex; align-items: center; gap: 8px; }
.hb-heart {
  font-size: 18px; color: var(--color-danger);
  &--beating { animation: hb-beat 1s ease-in-out infinite; }
}
@keyframes hb-beat {
  0%, 100% { transform: scale(1); }
  15% { transform: scale(1.3); }
  30% { transform: scale(1); }
}
.hb-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.hb-close {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px;
  &:active { opacity: 0.7; }
}
.hb-close-icon { font-size: 13px; color: var(--text-muted); }

.hb-scroll { flex: 1; min-height: 0; }

/* ═══ 运行态 ═══ */
.hb-running { padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 14px; }

.run-banner {
  padding: 9px 12px; border-radius: 10px;
  background: rgba(var(--color-accent-rgb), 0.08);
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
}
.run-banner-text { font-size: 12px; color: var(--color-accent); font-weight: 600; }

.warn-banner {
  padding: 9px 12px; border-radius: 10px;
  background: rgba(var(--color-danger-rgb), 0.08);
  border: 1px solid rgba(var(--color-danger-rgb), 0.3);
}
.warn-text { font-size: 12px; color: var(--color-danger); font-weight: 600; }

.stat-grid { display: flex; background: var(--bg-panel); border-radius: 12px; border: 1px solid var(--border-subtle); padding: 14px 0; }
.stat-cell { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
.stat-num { font-size: 22px; font-weight: 700; color: var(--text-primary); font-family: 'Courier New', monospace; }
.stat-ok { color: var(--color-accent); }
.stat-bad { color: var(--color-danger); }
.stat-lbl { font-size: 10px; color: var(--text-muted); }

.rtt-grid { display: flex; gap: 8px; }
.rtt-cell {
  flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px;
  background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 8px 0;
}
.rtt-lbl { font-size: 9px; color: var(--text-dimmed); }
.rtt-num { font-size: 13px; font-weight: 700; color: var(--color-primary); }

.rtt-bars {
  display: flex; align-items: flex-end; gap: 2px; height: 44px;
  background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 10px;
  padding: 6px 8px;
}
.rtt-bar { flex: 1; min-width: 2px; background: rgba(var(--color-primary-rgb), 0.55); border-radius: 2px 2px 0 0; }

.cfg-summary {
  padding: 10px 12px; background: var(--bg-panel); border: 1px dashed var(--border-default);
  border-radius: 10px; display: flex; flex-direction: column; gap: 4px;
}
.cfg-summary-text { font-size: 11px; color: var(--text-muted); }
.cfg-summary-payload { font-size: 11px; color: var(--text-mono); word-break: break-all; }

/* ═══ 配置表单 ═══ */
.hb-form { padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 14px; }
.form-field { display: flex; flex-direction: column; gap: 7px; &--half { flex: 1; min-width: 0; } }
.form-row { display: flex; gap: 10px; }
.form-label { font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
.form-label-row { display: flex; align-items: center; justify-content: space-between; }
.form-hint { font-size: 10px; color: var(--text-dimmed); line-height: 1.5; }

.empty-chars { padding: 14px; background: var(--bg-input); border: 1px dashed var(--border-default); border-radius: 10px; }
.empty-chars-text { font-size: 12px; color: var(--text-dimmed); }

.char-select {
  max-height: 132px;
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  &--short { max-height: 110px; }
}
.char-option {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-elevated); }
  &--active { background: rgba(var(--color-primary-rgb), 0.07); }
}
.co-radio {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border-default);
  &--on { border-color: var(--color-primary); background: var(--color-primary); box-shadow: inset 0 0 0 3px var(--bg-input); }
}
.co-info { flex: 1; min-width: 0; }
.co-uuid { font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block; }
.co-props { display: flex; gap: 4px; flex-shrink: 0; }
.co-prop {
  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary);
  &--n { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-accent); }
}

.form-textarea {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: var(--text-mono); width: 100%; height: 64px; line-height: 1.5;
}
.form-input {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: var(--text-primary); width: 100%; min-height: 40px;
}
.form-ph { color: var(--text-dimmed); }

.mode-tabs {
  display: flex; background: var(--bg-elevated); border-radius: 7px; padding: 2px; gap: 2px;
  &--fill { width: 100%; .mode-tab { flex: 1; } }
}
.mode-tab {
  padding: 5px 12px; border-radius: 5px; display: flex; align-items: center; justify-content: center;
  &--active { background: rgba(var(--color-primary-rgb), 0.15); .mt-text { color: var(--color-primary); } }
}
.mt-text { font-size: 11px; font-weight: 700; color: var(--text-muted); }

.qc-row { width: 100%; white-space: nowrap; }
.qc-chips { display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; }
.qc-title { font-size: 10px; color: var(--text-dimmed); flex-shrink: 0; }
.qc-chip {
  padding: 4px 10px; border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.07); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  &:active { opacity: 0.7; }
}
.qc-chip-text { font-size: 11px; color: var(--color-accent); font-weight: 600; }

.toggle-row {
  display: flex; align-items: center; gap: 10px; padding: 10px 12px;
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  &:active { opacity: 0.8; }
}
.toggle-check {
  width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
  border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--color-primary); font-weight: 700;
  background: var(--bg-panel);
}
.toggle-text { font-size: 13px; color: var(--text-primary); font-weight: 600; }

.hb-btn {
  height: 46px; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; margin-top: 2px;
  &:active { opacity: 0.85; }
  &--start {
    background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7));
    box-shadow: 0 0 14px rgba(var(--color-primary-rgb), 0.3);
    .hb-btn-text { color: var(--bg-base); }
  }
  &--stop {
    background: rgba(var(--color-danger-rgb), 0.1);
    border: 1px solid rgba(var(--color-danger-rgb), 0.35);
    .hb-btn-text { color: var(--color-danger); }
  }
}
.hb-btn-text { font-size: 15px; font-weight: 700; }

.safe-bottom-spacer { height: calc(16px + env(safe-area-inset-bottom, 16px)); flex-shrink: 0; }

.mono { font-family: 'Courier New', monospace; }
</style>
