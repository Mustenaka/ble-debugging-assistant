<template>
  <view v-if="visible" class="ae-overlay" @click="handleClose">
    <view class="ae-panel" :class="{ 'ae-panel--wide': isWideScreen }" @click.stop>

      <!-- 头部 -->
      <view class="ae-header">
        <view class="ae-header-left">
          <view class="ae-title-col">
            <text class="ae-title">{{ headerTitle }}</text>
            <text class="ae-subtitle mono">{{ headerSubtitle }}</text>
          </view>
        </view>
        <view class="ae-close" @click="handleClose"><text class="ae-close-icon">✕</text></view>
      </view>

      <scroll-view scroll-y class="ae-scroll">

        <view class="ae-form">

          <!-- 服务模式 -->
          <template v-if="mode === 'service'">
            <view class="ae-field">
              <text class="ae-label">{{ t('annotation.serviceName') }}</text>
              <input class="ae-input" :value="svcForm.name" :placeholder="t('annotation.serviceNamePlaceholder')" placeholder-class="ae-ph"
                @input="svcForm.name = $event.detail.value" />
            </view>
            <view class="ae-field">
              <text class="ae-label">{{ t('annotation.serviceRole') }}</text>
              <input class="ae-input" :value="svcForm.role" :placeholder="t('annotation.serviceRolePlaceholder')" placeholder-class="ae-ph"
                @input="svcForm.role = $event.detail.value" />
            </view>
            <view class="ae-field">
              <text class="ae-label">{{ t('annotation.serviceSummary') }}</text>
              <textarea class="ae-textarea" :value="svcForm.summary" :placeholder="t('annotation.serviceSummaryPlaceholder')" placeholder-class="ae-ph"
                maxlength="300" :adjust-position="true" cursor-spacing="24"
                @input="svcForm.summary = $event.detail.value" />
            </view>
          </template>

          <!-- 特征值模式 -->
          <template v-else>
            <view class="ae-field">
              <text class="ae-label">{{ t('annotation.charName') }}</text>
              <input class="ae-input" :value="charForm.name" :placeholder="t('annotation.charNamePlaceholder')" placeholder-class="ae-ph"
                @input="charForm.name = $event.detail.value" />
            </view>

            <view class="ae-row">
              <view class="ae-field ae-field--half">
                <text class="ae-label">{{ t('annotation.direction') }}</text>
                <view class="ae-chips">
                  <view v-for="d in directionOptions" :key="d.value" class="ae-chip"
                    :class="{ 'ae-chip--active': charForm.direction === d.value }"
                    @click="charForm.direction = charForm.direction === d.value ? '' : d.value">
                    <text class="ae-chip-text">{{ d.label }}</text>
                  </view>
                </view>
              </view>
            </view>

            <view class="ae-field">
              <text class="ae-label">{{ t('annotation.valueFormat') }}</text>
              <input class="ae-input" :value="charForm.valueFormat" :placeholder="t('annotation.valueFormatPlaceholder')" placeholder-class="ae-ph"
                @input="charForm.valueFormat = $event.detail.value" />
            </view>

            <view class="ae-field">
              <text class="ae-label">{{ t('annotation.charDescription') }}</text>
              <textarea class="ae-textarea" :value="charForm.description" :placeholder="t('annotation.charDescriptionPlaceholder')" placeholder-class="ae-ph"
                maxlength="500" :adjust-position="true" cursor-spacing="24"
                @input="charForm.description = $event.detail.value" />
            </view>

            <!-- 操作列表 -->
            <view class="ae-field">
              <view class="ae-label-row">
                <text class="ae-label">{{ t('annotation.operations') }}</text>
                <view class="ae-add-btn" @click="openNewOperation">
                  <text class="ae-add-text">＋ {{ t('annotation.addOperation') }}</text>
                </view>
              </view>

              <view v-if="!ops.length" class="ae-empty-ops">
                <text class="ae-empty-text">{{ t('annotation.noOperations') }}</text>
              </view>

              <view v-for="(op, i) in ops" :key="op.id" class="op-item" @click="openEditOperation(i)">
                <view class="op-info">
                  <text class="op-name">{{ op.name || op.operationId || '—' }}</text>
                  <text v-if="op.operationId" class="op-id mono">{{ op.operationId }}</text>
                  <view class="op-meta">
                    <text v-if="op.requestFields.length" class="op-meta-item">REQ {{ op.requestFields.length }}f</text>
                    <text v-if="op.responseFields.length" class="op-meta-item">RSP {{ op.responseFields.length }}f</text>
                    <text v-if="op.requestExample" class="op-meta-item mono">{{ op.requestExample.slice(0, 20) }}{{ op.requestExample.length > 20 ? '…' : '' }}</text>
                  </view>
                </view>
                <view class="op-del" @click.stop="removeOperation(i)"><text class="op-del-icon">✕</text></view>
                <text class="op-arrow">›</text>
              </view>
            </view>
          </template>

          <view class="ae-btn ae-btn--save" @click="handleSaveMain">
            <text class="ae-btn-text">{{ t('common.save') }}</text>
          </view>
        </view>

        <view style="height: 20px;" />
      </scroll-view>

      <!-- 操作编辑：统一命令编辑器（return 模式，不落库，保存回本地列表） -->
      <OperationEditor
        :visible="showOpEditor"
        :device-id="deviceId"
        :device-name="deviceName"
        :serviceUUID="serviceUUID"
        :charUUID="charUUID"
        lock-target
        :persist="false"
        :initial="opInitial"
        :samples="samples"
        @close="showOpEditor = false"
        @saved="onOpSaved"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useI18n } from '../composables/useI18n'
import { useResponsive } from '../composables/useResponsive'
import { shortUUID } from '../utils/hex'
import type { BleProtocolSample } from '../utils/buffer'
import {
  saveServiceAnnotation,
  saveCharAnnotation,
  type AnnotationEditorInitial,
  type DeviceAnnotations,
  type OperationAnnotation,
} from '../utils/deviceArchive'
import OperationEditor from './OperationEditor.vue'

const props = defineProps<{
  visible: boolean
  deviceId: string
  deviceName: string
  mode: 'service' | 'char'
  serviceUUID: string
  charUUID?: string
  initial?: AnnotationEditorInitial
  samples?: BleProtocolSample[]
}>()

const emit = defineEmits<{
  close: []
  saved: [annotations: DeviceAnnotations]
}>()

const { t } = useI18n()
const { isWideScreen } = useResponsive()

const svcForm = reactive({ name: '', role: '', summary: '' })
const charForm = reactive({ name: '', direction: '', valueFormat: '', description: '' })
const ops = ref<OperationAnnotation[]>([])

const showOpEditor = ref(false)
const opEditIndex = ref<number | null>(null)
const opInitial = ref<OperationAnnotation | null>(null)

const directionOptions = computed(() => [
  { value: 'TX', label: t('annotation.dirTx') },
  { value: 'RX', label: t('annotation.dirRx') },
  { value: 'TX/RX', label: t('annotation.dirBoth') },
])

const headerTitle = computed(() =>
  props.mode === 'service' ? t('annotation.editService') : t('annotation.editChar')
)

const headerSubtitle = computed(() => {
  if (props.mode === 'service') return shortUUID(props.serviceUUID)
  return `${shortUUID(props.serviceUUID)} / ${shortUUID(props.charUUID ?? '')}`
})

// 打开时载入初始值
watch(() => props.visible, (v) => {
  if (!v) return
  showOpEditor.value = false
  const init = props.initial ?? {}
  svcForm.name = init.name ?? ''
  svcForm.role = init.role ?? ''
  svcForm.summary = init.summary ?? ''
  charForm.name = init.name ?? ''
  charForm.direction = init.direction ?? ''
  charForm.valueFormat = init.valueFormat ?? ''
  charForm.description = init.description ?? ''
  ops.value = JSON.parse(JSON.stringify(init.operations ?? []))
})

function handleClose() {
  emit('close')
}

// ── 操作编辑（统一命令编辑器）────────────────────────────────────────────────

function openNewOperation() {
  opEditIndex.value = null
  opInitial.value = null
  showOpEditor.value = true
}

function openEditOperation(index: number) {
  opEditIndex.value = index
  opInitial.value = JSON.parse(JSON.stringify(ops.value[index]))
  showOpEditor.value = true
}

function onOpSaved(op: OperationAnnotation) {
  if (opEditIndex.value === null) ops.value.push(op)
  else ops.value[opEditIndex.value] = op
  showOpEditor.value = false
}

function removeOperation(index: number) {
  uni.showModal({
    title: t('annotation.deleteOperation'),
    content: t('annotation.deleteOpConfirm'),
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) ops.value.splice(index, 1)
    },
  })
}

// ── 保存 ────────────────────────────────────────────────────────────────────

function handleSaveMain() {
  let result: DeviceAnnotations
  if (props.mode === 'service') {
    result = saveServiceAnnotation(props.deviceId, props.deviceName, {
      uuid: props.serviceUUID,
      name: svcForm.name.trim(),
      role: svcForm.role.trim(),
      summary: svcForm.summary.trim(),
      updatedAt: Date.now(),
    })
  } else {
    result = saveCharAnnotation(props.deviceId, props.deviceName, {
      serviceUUID: props.serviceUUID,
      uuid: props.charUUID ?? '',
      name: charForm.name.trim(),
      direction: charForm.direction,
      valueFormat: charForm.valueFormat.trim(),
      description: charForm.description.trim(),
      operations: JSON.parse(JSON.stringify(ops.value)),
      updatedAt: Date.now(),
    })
  }
  emit('saved', result)
  uni.showToast({ title: t('annotation.saved'), icon: 'success', duration: 1200 })
  emit('close')
}
</script>

<style lang="scss" scoped>
.ae-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 320;
}

.ae-panel {
  width: 100%;
  max-height: 88vh;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 18px 18px 0 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-card);

  &--wide {
    max-width: 640px;
    border-radius: 16px;
    margin-bottom: 5vh;
    align-self: center;
  }
}

.ae-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.ae-header-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.ae-back {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px;
  flex-shrink: 0;
  &:active { opacity: 0.7; }
}
.ae-back-icon { font-size: 18px; color: var(--color-primary); }
.ae-title-col { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ae-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.ae-subtitle { font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ae-close {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px;
  flex-shrink: 0;
  &:active { opacity: 0.7; }
}
.ae-close-icon { font-size: 13px; color: var(--text-muted); }

.ae-scroll { flex: 1; min-height: 0; }
.ae-form { padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 13px; }

.ae-field { display: flex; flex-direction: column; gap: 6px; &--half { flex: 1; min-width: 0; } }
.ae-row { display: flex; gap: 10px; }
.ae-label { font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
.ae-label-row { display: flex; align-items: center; justify-content: space-between; }
.ae-input {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: var(--text-primary); width: 100%; min-height: 40px;
}
.ae-textarea {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: var(--text-primary); width: 100%; height: 72px; line-height: 1.5;
  &--short { height: 56px; }
}
.ae-ph { color: var(--text-dimmed); }

.ae-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.ae-chip {
  padding: 6px 14px; border-radius: 999px;
  background: var(--bg-input); border: 1px solid var(--border-default);
  &:active { opacity: 0.75; }
  &--active {
    background: rgba(var(--color-primary-rgb), 0.1);
    border-color: rgba(var(--color-primary-rgb), 0.4);
    .ae-chip-text { color: var(--color-primary); }
  }
}
.ae-chip-text { font-size: 12px; color: var(--text-muted); font-weight: 600; }

.ae-add-btn {
  padding: 4px 12px; border-radius: 7px;
  background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  &:active { opacity: 0.7; }
}
.ae-add-text { font-size: 11px; color: var(--color-accent); font-weight: 700; }

.ae-empty-ops { padding: 18px; background: var(--bg-input); border: 1px dashed var(--border-default); border-radius: 10px; text-align: center; }
.ae-empty-text { font-size: 12px; color: var(--text-dimmed); }

.op-item {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 12px; background: var(--bg-input);
  border: 1px solid var(--border-default); border-radius: 10px;
  &:active { background: var(--bg-elevated); }
}
.op-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.op-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.op-id { font-size: 10px; color: var(--color-primary); }
.op-meta { display: flex; gap: 8px; flex-wrap: wrap; }
.op-meta-item { font-size: 9px; color: var(--text-dimmed); }
.op-del {
  width: 26px; height: 26px; display: flex; align-items: center; justify-content: center;
  background: rgba(var(--color-danger-rgb), 0.07); border: 1px solid rgba(var(--color-danger-rgb), 0.2);
  border-radius: 6px; flex-shrink: 0;
  &:active { opacity: 0.7; }
}
.op-del-icon { font-size: 10px; color: var(--color-danger); }
.op-arrow { font-size: 16px; color: var(--text-muted); flex-shrink: 0; }

.frame-section {
  display: flex; flex-direction: column; gap: 11px;
  padding: 12px; background: var(--bg-panel);
  border: 1px solid var(--border-subtle); border-radius: 12px;
}
.frame-title { font-size: 12px; font-weight: 700; color: var(--color-primary); letter-spacing: 0.5px; }

.sample-row { width: 100%; white-space: nowrap; }
.sample-chips { display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; }
.sample-title { font-size: 10px; color: var(--text-dimmed); flex-shrink: 0; }
.sample-chip {
  padding: 3px 10px; border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.07); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  &:active { opacity: 0.7; }
}
.sample-chip-text { font-size: 11px; color: var(--color-accent); font-weight: 600; }

.ae-btn {
  height: 46px; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; margin-top: 4px;
  &:active { opacity: 0.85; }
  &--save {
    background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7));
    box-shadow: 0 0 14px rgba(var(--color-primary-rgb), 0.3);
    .ae-btn-text { color: var(--bg-base); }
  }
}
.ae-btn-text { font-size: 15px; font-weight: 700; }

.mono { font-family: 'Courier New', monospace; }
</style>
