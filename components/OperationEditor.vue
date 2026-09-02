<template>
  <view v-if="visible" class="oe-overlay" @click="$emit('close')">
    <view class="oe-panel" :class="{ 'oe-panel--wide': isWideScreen }" @click.stop>

      <!-- 头部 -->
      <view class="oe-header">
        <view class="oe-title-col">
          <text class="oe-title">{{ isNew ? t('command.newCommand') : t('command.editCommand') }}</text>
          <text class="oe-subtitle mono">{{ targetText }}</text>
        </view>
        <view class="oe-close" @click="$emit('close')"><text class="oe-close-icon">✕</text></view>
      </view>

      <scroll-view scroll-y class="oe-scroll">
        <view class="oe-form">

          <!-- 名称 + Operation ID -->
          <view class="oe-row">
            <view class="oe-field oe-field--half">
              <text class="oe-label">{{ t('annotation.opName') }}</text>
              <input class="oe-input" :value="form.name" :placeholder="t('annotation.opNamePlaceholder')" placeholder-class="oe-ph"
                @input="form.name = $event.detail.value" />
            </view>
            <view class="oe-field oe-field--half">
              <text class="oe-label">{{ t('annotation.opId') }}</text>
              <input class="oe-input mono" :value="form.operationId" :placeholder="t('annotation.opIdPlaceholder')" placeholder-class="oe-ph"
                @input="form.operationId = $event.detail.value" />
            </view>
          </view>

          <!-- 目标特征值（未锁定时可选） -->
          <view v-if="!lockTarget" class="oe-field">
            <text class="oe-label">{{ t('command.targetLabel') }}</text>
            <view v-if="!allChars.length" class="oe-empty-box">
              <text class="oe-empty-text">{{ t('command.noWritableChars') }}</text>
            </view>
            <scroll-view v-else scroll-y class="oe-char-select">
              <view
                v-for="c in allChars"
                :key="c.serviceUUID + c.uuid"
                class="oe-char-option"
                :class="{ 'oe-char-option--active': targetSvc === c.serviceUUID && targetChar === c.uuid }"
                @click="targetSvc = c.serviceUUID; targetChar = c.uuid"
              >
                <view class="oe-radio" :class="{ 'oe-radio--on': targetSvc === c.serviceUUID && targetChar === c.uuid }" />
                <text class="oe-char-uuid mono">{{ shortUUID(c.serviceUUID) }} / {{ shortUUID(c.uuid) }}</text>
                <view class="oe-char-props">
                  <text v-if="c.write" class="oe-prop">W</text>
                  <text v-if="c.writeNoResponse" class="oe-prop">WNR</text>
                  <text v-if="c.read" class="oe-prop oe-prop--r">R</text>
                  <text v-if="c.notify" class="oe-prop oe-prop--n">N</text>
                </view>
              </view>
            </scroll-view>
          </view>

          <!-- 动作 -->
          <view class="oe-field">
            <text class="oe-label">{{ t('command.actionLabel') }}</text>
            <view class="oe-chips">
              <view v-for="a in actionOptions" :key="a.value" class="oe-chip"
                :class="{ 'oe-chip--active': (form.actionType ?? 'write') === a.value }"
                @click="form.actionType = a.value">
                <text class="oe-chip-text">{{ a.label }}</text>
              </view>
            </view>
          </view>

          <!-- 载荷 -->
          <view v-if="(form.actionType ?? 'write') !== 'read'" class="oe-field">
            <view class="oe-label-row">
              <text class="oe-label">{{ t('command.payloadLabel') }}</text>
              <view class="oe-mode-tabs">
                <view class="oe-mode-tab" :class="{ 'oe-mode-tab--active': (form.payloadMode ?? 'hex') === 'hex' }" @click="form.payloadMode = 'hex'"><text class="oe-mt">HEX</text></view>
                <view class="oe-mode-tab" :class="{ 'oe-mode-tab--active': form.payloadMode === 'ascii' }" @click="form.payloadMode = 'ascii'"><text class="oe-mt">ASCII</text></view>
              </view>
            </view>
            <textarea class="oe-textarea mono" :value="form.payload"
              :placeholder="(form.payloadMode ?? 'hex') === 'hex' ? t('hexInput.hexPlaceholder') : t('hexInput.asciiPlaceholder')"
              placeholder-class="oe-ph" maxlength="500" :adjust-position="true" cursor-spacing="24"
              @input="form.payload = $event.detail.value" />
            <!-- 模板渲染预览 -->
            <view v-if="payloadPreview" class="oe-tpl-preview" :class="{ 'oe-tpl-preview--error': !!payloadPreview.error }">
              <text class="oe-tpl-label">{{ payloadPreview.error ? t('command.templateError') : t('command.templatePreview') }}</text>
              <text class="oe-tpl-value mono">{{ payloadPreview.error || payloadPreview.hex }}</text>
            </view>
            <!-- 占位符 chips -->
            <scroll-view scroll-x class="oe-sample-row">
              <view class="oe-sample-chips">
                <text class="oe-sample-title">{{ t('command.tokens') }}:</text>
                <view v-for="tk in tokenChips" :key="tk" class="oe-token-chip" @click="insertToken(tk)">
                  <text class="oe-token-chip-text mono">{{ tk }}</text>
                </view>
              </view>
            </scroll-view>
            <text class="oe-sub-hint">{{ t('command.templateHint') }}</text>
            <scroll-view v-if="txSamples.length || txExamples.length" scroll-x class="oe-sample-row">
              <view class="oe-sample-chips">
                <text class="oe-sample-title">{{ t('annotation.fromSample') }}:</text>
                <view v-for="s in txSamples" :key="s.id" class="oe-sample-chip" @click="form.payload = s.hex; form.payloadMode = 'hex'">
                  <text class="oe-sample-chip-text">{{ s.name }}</text>
                </view>
                <view v-for="e in txExamples" :key="e.id" class="oe-sample-chip oe-sample-chip--ex" @click="form.payload = e.request!.hex; form.payloadMode = 'hex'">
                  <text class="oe-sample-chip-text">⇄ {{ e.name }}</text>
                </view>
              </view>
            </scroll-view>
          </view>
          <view v-else class="oe-hint-box">
            <text class="oe-hint-text">{{ t('command.payloadReadHint') }}</text>
          </view>

          <!-- 描述 -->
          <view class="oe-field">
            <text class="oe-label">{{ t('annotation.opDescription') }}</text>
            <textarea class="oe-textarea oe-textarea--short" :value="form.description" :placeholder="t('annotation.opDescriptionPlaceholder')"
              placeholder-class="oe-ph" maxlength="300" :adjust-position="true" cursor-spacing="24"
              @input="form.description = $event.detail.value" />
          </view>

          <!-- 期望响应 -->
          <view class="oe-section">
            <view class="oe-toggle-row" @click="toggleExpect">
              <text class="oe-toggle-check">{{ expect.enabled ? '✓' : '' }}</text>
              <view class="oe-toggle-col">
                <text class="oe-toggle-text">{{ t('command.expectLabel') }}</text>
                <text class="oe-toggle-hint">{{ t('command.expectHint') }}</text>
              </view>
            </view>

            <template v-if="expect.enabled">
              <view class="oe-field">
                <text class="oe-label">{{ t('command.expectChar') }}</text>
                <scroll-view scroll-y class="oe-char-select oe-char-select--short">
                  <view class="oe-char-option" :class="{ 'oe-char-option--active': !expect.responseCharacteristicUUID }"
                    @click="expect.responseCharacteristicUUID = ''">
                    <view class="oe-radio" :class="{ 'oe-radio--on': !expect.responseCharacteristicUUID }" />
                    <text class="oe-char-uuid">{{ t('command.anyChar') }}</text>
                  </view>
                  <view v-for="c in notifyChars" :key="c.serviceUUID + c.uuid" class="oe-char-option"
                    :class="{ 'oe-char-option--active': expect.responseCharacteristicUUID === c.uuid }"
                    @click="expect.responseCharacteristicUUID = c.uuid">
                    <view class="oe-radio" :class="{ 'oe-radio--on': expect.responseCharacteristicUUID === c.uuid }" />
                    <text class="oe-char-uuid mono">{{ shortUUID(c.serviceUUID) }} / {{ shortUUID(c.uuid) }}</text>
                    <view class="oe-char-props"><text class="oe-prop oe-prop--n">N</text></view>
                  </view>
                </scroll-view>
              </view>

              <view class="oe-row">
                <view class="oe-field oe-field--half">
                  <text class="oe-label">{{ t('command.matchHex') }}</text>
                  <input class="oe-input mono" :value="expect.matchHex" :placeholder="t('command.matchHexPlaceholder')" placeholder-class="oe-ph"
                    @input="expect.matchHex = $event.detail.value" />
                </view>
                <view class="oe-field oe-field--half">
                  <text class="oe-label">{{ t('command.timeoutLabel') }}</text>
                  <input class="oe-input mono" type="number" :value="String(expect.timeoutMs)" placeholder="2000" placeholder-class="oe-ph"
                    @input="expect.timeoutMs = parseInt($event.detail.value) || 2000" />
                </view>
              </view>

              <!-- 字段断言：偏移字节 / 按字段表解码比较 -->
              <view class="oe-field">
                <view class="oe-label-row">
                  <view class="oe-label-col">
                    <text class="oe-label">{{ t('command.assertions') }}</text>
                    <text class="oe-sub-hint">{{ t('command.fieldAssertionHint') }}</text>
                  </view>
                  <view class="oe-add-group">
                    <view class="oe-add-btn" @click="addAssertion"><text class="oe-add-text">＋ {{ t('command.addOffsetAssertion') }}</text></view>
                    <view class="oe-add-btn" @click="addFieldAssertion"><text class="oe-add-text">＋ {{ t('command.addFieldAssertion') }}</text></view>
                  </view>
                </view>
                <view v-for="(a, i) in assertions" :key="i" class="oe-kv-row">
                  <template v-if="a.field !== undefined">
                    <view class="oe-kv-cell">
                      <text class="oe-kv-label">{{ t('command.assertionField') }}</text>
                      <picker :range="responseFieldNames" @change="a.field = responseFieldNames[$event.detail.value] ?? a.field">
                        <view class="oe-kv-input oe-kv-picker"><text class="oe-kv-picker-text mono">{{ a.field || '—' }}</text><text class="oe-kv-picker-arrow">▾</text></view>
                      </picker>
                    </view>
                    <view class="oe-kv-cell oe-kv-cell--xs">
                      <text class="oe-kv-label">{{ t('command.assertionOp') }}</text>
                      <picker :range="assertionOpLabels" @change="a.op = assertionOps[$event.detail.value].value">
                        <view class="oe-kv-input oe-kv-picker"><text class="oe-kv-picker-text mono">{{ opLabel(a.op) }}</text></view>
                      </picker>
                    </view>
                    <view class="oe-kv-cell">
                      <text class="oe-kv-label">{{ t('command.assertionExpected') }}</text>
                      <input class="oe-kv-input mono" :value="a.value ?? ''" placeholder="1 / 0x01 / 1,2 / 1..5" placeholder-class="oe-ph"
                        @input="a.value = $event.detail.value" />
                    </view>
                  </template>
                  <template v-else>
                    <view class="oe-kv-cell oe-kv-cell--sm">
                      <text class="oe-kv-label">{{ t('command.assertionOffset') }}</text>
                      <input class="oe-kv-input mono" type="number" :value="String(a.offset ?? 0)" placeholder="0" placeholder-class="oe-ph"
                        @input="a.offset = parseInt($event.detail.value) || 0" />
                    </view>
                    <view class="oe-kv-cell">
                      <text class="oe-kv-label">{{ t('command.assertionValue') }}</text>
                      <input class="oe-kv-input mono" :value="a.hexValue ?? ''" placeholder="01" placeholder-class="oe-ph"
                        @input="a.hexValue = $event.detail.value" />
                    </view>
                  </template>
                  <view class="oe-kv-del" @click="assertions.splice(i, 1)"><text class="oe-kv-del-icon">✕</text></view>
                </view>
              </view>
            </template>
          </view>

          <!-- 载荷变体（P2） -->
          <view v-if="(form.actionType ?? 'write') !== 'read'" class="oe-section">
            <view class="oe-label-row">
              <view class="oe-label-col">
                <text class="oe-label">{{ t('command.variants') }}</text>
                <text class="oe-sub-hint">{{ t('command.variantHint') }}</text>
              </view>
              <view class="oe-add-btn" @click="addVariant"><text class="oe-add-text">＋ {{ t('command.addVariant') }}</text></view>
            </view>
            <view v-for="(v, i) in variants" :key="i" class="oe-kv-row">
              <view class="oe-kv-cell oe-kv-cell--sm">
                <text class="oe-kv-label">{{ t('command.variantLabelCol') }}</text>
                <input class="oe-kv-input" :value="v.label" placeholder="开启" placeholder-class="oe-ph"
                  @input="v.label = $event.detail.value" />
              </view>
              <view class="oe-kv-cell">
                <text class="oe-kv-label">{{ t('command.variantPayloadCol') }}</text>
                <input class="oe-kv-input mono" :value="v.payload" placeholder="01" placeholder-class="oe-ph"
                  @input="v.payload = $event.detail.value" />
              </view>
              <view class="oe-kv-del" @click="variants.splice(i, 1)"><text class="oe-kv-del-icon">✕</text></view>
            </view>
          </view>

          <!-- 文档字段（折叠） -->
          <view class="oe-section">
            <view class="oe-collapse-head" @click="showDocFields = !showDocFields">
              <text class="oe-collapse-title">📄 {{ t('annotation.requestSection') }} / {{ t('annotation.responseSection') }}</text>
              <text class="oe-collapse-arrow" :class="{ 'oe-collapse-arrow--open': showDocFields }">›</text>
            </view>
            <template v-if="showDocFields">
              <view class="oe-field">
                <text class="oe-label">{{ t('annotation.requestSection') }} · {{ t('annotation.frameDesc') }}</text>
                <input class="oe-input mono" :value="form.request" :placeholder="t('annotation.frameDescPlaceholder')" placeholder-class="oe-ph"
                  @input="form.request = $event.detail.value" />
              </view>
              <FieldTable v-model:fields="requestFields" />
              <view class="oe-field">
                <text class="oe-label">{{ t('annotation.responseSection') }} · {{ t('annotation.frameDesc') }}</text>
                <input class="oe-input mono" :value="form.response" :placeholder="t('annotation.frameDescPlaceholder')" placeholder-class="oe-ph"
                  @input="form.response = $event.detail.value" />
              </view>
              <view class="oe-field">
                <text class="oe-label">{{ t('annotation.responseSection') }} · {{ t('annotation.example') }}</text>
                <input class="oe-input mono" :value="form.responseExample" :placeholder="t('annotation.examplePlaceholder')" placeholder-class="oe-ph"
                  @input="form.responseExample = $event.detail.value" />
                <scroll-view v-if="rxSamples.length || rxExamples.length" scroll-x class="oe-sample-row">
                  <view class="oe-sample-chips">
                    <text class="oe-sample-title">{{ t('annotation.fromSample') }}:</text>
                    <view v-for="s in rxSamples" :key="s.id" class="oe-sample-chip" @click="form.responseExample = s.hex">
                      <text class="oe-sample-chip-text">{{ s.name }}</text>
                    </view>
                    <view v-for="e in rxExamples" :key="e.id" class="oe-sample-chip oe-sample-chip--ex" @click="form.responseExample = e.response!.hex">
                      <text class="oe-sample-chip-text">⇄ {{ e.name }}</text>
                    </view>
                  </view>
                </scroll-view>
              </view>
              <FieldTable v-model:fields="responseFields" />
              <view class="oe-field">
                <text class="oe-label">{{ t('annotation.mockRule') }}</text>
                <input class="oe-input" :value="form.mockRule" :placeholder="t('annotation.mockRulePlaceholder')" placeholder-class="oe-ph"
                  @input="form.mockRule = $event.detail.value" />
              </view>
            </template>
          </view>

          <view class="oe-btn oe-btn--save" @click="handleSave">
            <text class="oe-btn-text">{{ t('common.save') }}</text>
          </view>
          <view class="safe-bottom-spacer" />
        </view>
      </scroll-view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useBleStore } from '../store/bleStore'
import { useCollectionStore } from '../store/collectionStore'
import { useI18n } from '../composables/useI18n'
import { useResponsive } from '../composables/useResponsive'
import { shortUUID, normalizeUUID, isValidHex, normalizeHex } from '../utils/hex'
import { hasTemplateTokens, BUILTIN_TOKENS } from '../utils/payload'
import { ASSERTION_OPS } from '../utils/fields'
import type { BleProtocolSample } from '../utils/buffer'
import type { ProtocolFieldDoc } from '../utils/protocolDocs'
import {
  upsertOperationAnnotation,
  defaultOperationExpect,
  type OperationAnnotation,
  type OperationExpect,
  type OperationVariant,
  type DeviceAnnotations,
  type FieldAssertion,
} from '../utils/deviceArchive'
import FieldTable from './FieldTable.vue'

const props = defineProps<{
  visible: boolean
  deviceId: string
  deviceName: string
  serviceUUID?: string
  charUUID?: string
  /** true: 目标特征值锁定不可改（来自注释编辑器/卡片编辑） */
  lockTarget?: boolean
  /** null/undefined = 新建 */
  initial?: OperationAnnotation | null
  /** true: 保存直接 upsert 落库；false: 只把结果 emit 给父级 */
  persist?: boolean
  samples?: BleProtocolSample[]
}>()

const emit = defineEmits<{
  close: []
  saved: [op: OperationAnnotation, serviceUUID: string, charUUID: string, annotations: DeviceAnnotations | null]
}>()

const bleStore = useBleStore()
const collectionStore = useCollectionStore()
collectionStore.init()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const isNew = computed(() => !props.initial)

// ── 模板 / 占位符 ───────────────────────────────────────────────────────────

const payloadPreview = computed(() => {
  const text = form.payload ?? ''
  if (!hasTemplateTokens(text)) return null
  return bleStore.previewPayloadFor(text, form.payloadMode ?? 'hex', props.deviceId)
})

const tokenChips = computed(() => {
  void collectionStore.version
  const vars = Object.keys(collectionStore.variablesFor(props.deviceId)).map((n) => `{{${n}}}`)
  return [...BUILTIN_TOKENS.map((b) => b.token), ...vars]
})

function insertToken(tok: string) {
  const cur = (form.payload ?? '').replace(/\s+$/, '')
  form.payload = cur ? `${cur} ${tok}` : tok
}

// ── 断言 ────────────────────────────────────────────────────────────────────

const assertionOps = ASSERTION_OPS
const assertionOpLabels = ASSERTION_OPS.map((o) => o.label)
const responseFieldNames = computed(() => responseFields.value.map((f) => f.name).filter(Boolean))

function opLabel(op?: string): string {
  return ASSERTION_OPS.find((o) => o.value === (op ?? 'eq'))?.label ?? '=='
}

function addFieldAssertion() {
  if (!responseFieldNames.value.length) {
    uni.showToast({ title: t('command.noResponseFields'), icon: 'none', duration: 2200 })
    showDocFields.value = true
    return
  }
  assertions.value.push({ field: responseFieldNames.value[0], op: 'eq', value: '' })
}

const form = reactive<OperationAnnotation>(emptyOp())
const expect = reactive<OperationExpect>(defaultOperationExpect())
const assertions = ref<FieldAssertion[]>([])
const variants = ref<OperationVariant[]>([])
const requestFields = ref<ProtocolFieldDoc[]>([])
const responseFields = ref<ProtocolFieldDoc[]>([])
const targetSvc = ref('')
const targetChar = ref('')
const showDocFields = ref(false)

function emptyOp(): OperationAnnotation {
  return {
    id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    operationId: '',
    description: '',
    request: '',
    response: '',
    requestExample: '',
    responseExample: '',
    mockRule: '',
    requestFields: [],
    responseFields: [],
    actionType: 'write',
    payloadMode: 'hex',
    payload: '',
  }
}

const actionOptions = computed(() => [
  { value: 'write' as const, label: 'WRITE' },
  { value: 'writeNoResponse' as const, label: 'WRITE NR' },
  { value: 'read' as const, label: 'READ' },
])

const targetText = computed(() => {
  const svc = targetSvc.value || props.serviceUUID || ''
  const chr = targetChar.value || props.charUUID || ''
  return svc && chr ? `${shortUUID(svc)} / ${shortUUID(chr)}` : '—'
})

interface CharOption {
  serviceUUID: string
  uuid: string
  write: boolean
  writeNoResponse: boolean
  read: boolean
  notify: boolean
}

const allChars = computed<CharOption[]>(() => {
  const session = bleStore.activeSession
  if (!session) return []
  const list: CharOption[] = []
  session.characteristics.forEach((chars, serviceUUID) => {
    for (const c of chars) {
      list.push({
        serviceUUID,
        uuid: c.uuid,
        write: !!c.properties.write,
        writeNoResponse: !!c.properties.writeNoResponse,
        read: !!c.properties.read,
        notify: !!(c.properties.notify || c.properties.indicate),
      })
    }
  })
  return list
})

const notifyChars = computed(() => allChars.value.filter((c) => c.notify))

const charSamples = computed(() => {
  const svc = targetSvc.value
  const chr = targetChar.value
  if (!svc || !chr) return []
  return (props.samples ?? bleStore.activeSession?.savedSamples ?? []).filter(
    (s: BleProtocolSample) =>
      normalizeUUID(s.serviceUUID) === normalizeUUID(svc) &&
      normalizeUUID(s.characteristicUUID) === normalizeUUID(chr)
  )
})
const txSamples = computed(() => charSamples.value.filter((s: BleProtocolSample) => s.direction === 'TX'))
const rxSamples = computed(() => charSamples.value.filter((s: BleProtocolSample) => s.direction === 'RX'))

// 集合里的请求-响应配对样例（同端点）
const charExamples = computed(() => {
  void collectionStore.version
  const svc = targetSvc.value
  const chr = targetChar.value
  if (!svc || !chr) return []
  return (collectionStore.forDevice(props.deviceId)?.examples ?? []).filter(
    (e) => normalizeUUID(e.serviceUUID) === normalizeUUID(svc) && normalizeUUID(e.characteristicUUID) === normalizeUUID(chr),
  )
})
const txExamples = computed(() => charExamples.value.filter((e) => e.request?.hex))
const rxExamples = computed(() => charExamples.value.filter((e) => e.response?.hex))

/** 刚连接、尚未展开过服务时，编辑器自动发现全部特征值，避免"无目标可选" */
async function ensureCharacteristicsLoaded() {
  const session = bleStore.activeSession
  if (!session || !session.services.length) return
  const missing = session.services.filter((s) => !session.characteristics.get(s.uuid)?.length)
  if (!missing.length) return
  for (const svc of missing) {
    try { await bleStore.loadCharacteristics(svc.uuid, session.device.deviceId) } catch { /* 单个服务失败不阻断 */ }
  }
  if (!props.lockTarget && (!targetSvc.value || !targetChar.value) && allChars.value.length) {
    const writable = allChars.value.find((c) => c.write || c.writeNoResponse) ?? allChars.value[0]
    targetSvc.value = writable.serviceUUID
    targetChar.value = writable.uuid
  }
}

watch(() => props.visible, (v) => {
  if (!v) return
  ensureCharacteristicsLoaded()
  const init = props.initial
  Object.assign(form, emptyOp(), init ? JSON.parse(JSON.stringify(init)) : {})
  // payload 缺省时用 requestExample 起步（旧命令兼容）
  if (!form.payload && form.requestExample) form.payload = form.requestExample
  Object.assign(expect, defaultOperationExpect(), init?.expect ? JSON.parse(JSON.stringify(init.expect)) : {})
  assertions.value = (expect.fieldAssertions ?? []).map((a) => ({ ...a }))
  variants.value = (init?.variants ?? []).map((x) => ({ ...x }))
  requestFields.value = (init?.requestFields ?? []).map((x) => ({ ...x }))
  responseFields.value = (init?.responseFields ?? []).map((x) => ({ ...x }))
  targetSvc.value = props.serviceUUID ?? ''
  targetChar.value = props.charUUID ?? ''
  showDocFields.value = false
  // 新建且无目标时默认选中当前激活特征值
  if (!props.lockTarget && (!targetSvc.value || !targetChar.value)) {
    const session = bleStore.activeSession
    if (session?.activeServiceId && session?.activeCharacteristicId) {
      targetSvc.value = session.activeServiceId
      targetChar.value = session.activeCharacteristicId
    } else if (allChars.value.length) {
      targetSvc.value = allChars.value[0].serviceUUID
      targetChar.value = allChars.value[0].uuid
    }
  }
})

function toggleExpect() {
  expect.enabled = !expect.enabled
}

function addAssertion() {
  assertions.value.push({ offset: 0, hexValue: '' })
}

function addVariant() {
  variants.value.push({ label: '', payload: '' })
}

function handleSave() {
  if (!form.name.trim() && !form.operationId?.trim()) {
    uni.showToast({ title: t('command.nameRequired'), icon: 'none' }); return
  }
  const svc = targetSvc.value
  const chr = targetChar.value
  if (!svc || !chr) {
    uni.showToast({ title: t('command.targetRequired'), icon: 'none' }); return
  }
  const actionType = form.actionType ?? 'write'
  if (actionType !== 'read') {
    if (!(form.payload ?? '').trim()) {
      uni.showToast({ title: t('command.payloadRequired'), icon: 'none' }); return
    }
    if ((form.payloadMode ?? 'hex') === 'hex') {
      if (hasTemplateTokens(form.payload ?? '')) {
        // 模板：以当前变量渲染校验；文档样例取渲染结果
        const preview = payloadPreview.value
        if (!preview || preview.error) {
          uni.showToast({ title: `${t('command.templateError')}: ${preview?.error ?? ''}`, icon: 'none', duration: 2500 }); return
        }
        form.payload = (form.payload ?? '').trim()
        if (!form.requestExample || form.requestExample === props.initial?.payload || !isValidHex(form.requestExample)) {
          form.requestExample = preview.hex
        }
      } else {
        const normalized = normalizeHex(form.payload ?? '')
        if (!isValidHex(normalized)) {
          uni.showToast({ title: t('command.invalidPayload'), icon: 'none' }); return
        }
        form.payload = normalized
        // payload 同步为文档请求样例（保持导出文档一致）
        if (!form.requestExample || form.requestExample === props.initial?.payload) {
          form.requestExample = normalized
        }
      }
    }
  }

  const cleanFields = (rows: ProtocolFieldDoc[]) =>
    rows.filter((f) => f.offset || f.length || f.type || f.name || f.meaning)

  const saved: OperationAnnotation = JSON.parse(JSON.stringify({
    ...form,
    requestFields: cleanFields(requestFields.value),
    responseFields: cleanFields(responseFields.value),
    expect: {
      ...expect,
      fieldAssertions: assertions.value.filter((a) => (a.hexValue ?? '').trim() || (a.field && (a.value ?? '').trim())),
    },
    variants: variants.value.filter((v) => v.label.trim() && v.payload.trim()),
  }))

  let annotations: DeviceAnnotations | null = null
  if (props.persist !== false) {
    annotations = upsertOperationAnnotation(props.deviceId, props.deviceName, svc, chr, saved)
    uni.showToast({ title: t('command.saved'), icon: 'success', duration: 1200 })
  }
  emit('saved', saved, svc, chr, annotations)
  emit('close')
}
</script>

<style lang="scss" scoped>
.oe-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.7);
  display: flex; align-items: flex-end; justify-content: center;
  z-index: 340;
}

.oe-panel {
  width: 100%;
  /* 定高（而非 max-height）：flex 子项 scroll-view 的 100% 高度才能解析，内容才可滚动 */
  height: 88%;
  background: var(--bg-card);
  border: 1px solid var(--border-default);
  border-radius: 18px 18px 0 0;
  display: flex; flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  padding-bottom: env(safe-area-inset-bottom, 0px);

  &--wide {
    max-width: 640px;
    border-radius: 16px;
    margin-bottom: 4vh;
    align-self: center;
  }
}

.oe-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 14px 18px 12px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.oe-title-col { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }
.oe-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.oe-subtitle { font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oe-close {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px;
  flex-shrink: 0;
  &:active { opacity: 0.7; }
}
.oe-close-icon { font-size: 13px; color: var(--text-muted); }

.oe-scroll { flex: 1; min-height: 0; }
.oe-form { padding: 16px 18px 4px; display: flex; flex-direction: column; gap: 13px; }

.oe-field { display: flex; flex-direction: column; gap: 6px; &--half { flex: 1; min-width: 0; } }
.oe-row { display: flex; gap: 10px; }
.oe-label { font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
.oe-label-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.oe-label-col { display: flex; flex-direction: column; gap: 3px; flex: 1; min-width: 0; }
.oe-sub-hint { font-size: 10px; color: var(--text-dimmed); line-height: 1.4; }
.oe-input {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: var(--text-primary); width: 100%; min-height: 40px;
}
.oe-textarea {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  padding: 10px 12px; font-size: 13px; color: var(--text-mono); width: 100%; height: 64px; line-height: 1.5;
  &--short { height: 52px; color: var(--text-primary); }
}
.oe-ph { color: var(--text-dimmed); }

.oe-chips { display: flex; gap: 6px; flex-wrap: wrap; }
.oe-chip {
  padding: 6px 14px; border-radius: 999px;
  background: var(--bg-input); border: 1px solid var(--border-default);
  &:active { opacity: 0.75; }
  &--active {
    background: rgba(var(--color-primary-rgb), 0.1);
    border-color: rgba(var(--color-primary-rgb), 0.4);
    .oe-chip-text { color: var(--color-primary); }
  }
}
.oe-chip-text { font-size: 12px; color: var(--text-muted); font-weight: 700; }

.oe-mode-tabs { display: flex; background: var(--bg-elevated); border-radius: 7px; padding: 2px; gap: 2px; }
.oe-mode-tab {
  padding: 4px 12px; border-radius: 5px;
  &--active { background: rgba(var(--color-primary-rgb), 0.15); .oe-mt { color: var(--color-primary); } }
}
.oe-mt { font-size: 11px; font-weight: 700; color: var(--text-muted); }

.oe-empty-box, .oe-hint-box {
  padding: 12px; background: var(--bg-input); border: 1px dashed var(--border-default); border-radius: 10px;
}
.oe-empty-text, .oe-hint-text { font-size: 12px; color: var(--text-dimmed); }

.oe-char-select {
  max-height: 128px;
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
  &--short { max-height: 104px; }
}
.oe-char-option {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-elevated); }
  &--active { background: rgba(var(--color-primary-rgb), 0.07); }
}
.oe-radio {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border-default);
  &--on { border-color: var(--color-primary); background: var(--color-primary); box-shadow: inset 0 0 0 3px var(--bg-input); }
}
.oe-char-uuid { flex: 1; font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oe-char-props { display: flex; gap: 4px; flex-shrink: 0; }
.oe-prop {
  font-size: 9px; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary);
  &--n { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-accent); }
  &--r { background: rgba(96,165,250, 0.12); color: var(--color-info); }
}

.oe-section {
  display: flex; flex-direction: column; gap: 11px;
  padding: 12px; background: var(--bg-panel);
  border: 1px solid var(--border-subtle); border-radius: 12px;
}

.oe-toggle-row {
  display: flex; align-items: flex-start; gap: 10px;
  &:active { opacity: 0.8; }
}
.oe-toggle-check {
  width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
  border: 1px solid var(--border-default);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; color: var(--color-primary); font-weight: 700;
  background: var(--bg-input);
}
.oe-toggle-col { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.oe-toggle-text { font-size: 13px; color: var(--text-primary); font-weight: 700; }
.oe-toggle-hint { font-size: 10px; color: var(--text-dimmed); line-height: 1.4; }

.oe-add-btn {
  padding: 4px 12px; border-radius: 7px; flex-shrink: 0;
  background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  &:active { opacity: 0.7; }
}
.oe-add-text { font-size: 11px; color: var(--color-accent); font-weight: 700; }

.oe-kv-row { display: flex; gap: 6px; align-items: flex-end; }
.oe-kv-cell { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; &--sm { flex: 0 0 76px; } &--xs { flex: 0 0 62px; } }
.oe-kv-picker { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
.oe-kv-picker-text { font-size: 12px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.oe-kv-picker-arrow { font-size: 10px; color: var(--text-muted); flex-shrink: 0; }
.oe-add-group { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }

.oe-tpl-preview {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 8px;
  background: rgba(var(--color-accent-rgb), 0.06); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  &--error { background: rgba(var(--color-danger-rgb), 0.06); border-color: rgba(var(--color-danger-rgb), 0.3); .oe-tpl-value { color: var(--color-danger); } .oe-tpl-label { color: var(--color-danger); } }
}
.oe-tpl-label { font-size: 9px; color: var(--color-accent); font-weight: 700; text-transform: uppercase; flex-shrink: 0; }
.oe-tpl-value { font-size: 11px; color: var(--text-mono); word-break: break-all; }
.oe-token-chip {
  padding: 3px 8px; border-radius: 6px;
  background: rgba(var(--color-primary-rgb), 0.07); border: 1px solid rgba(var(--color-primary-rgb), 0.25);
  &:active { opacity: 0.7; }
}
.oe-token-chip-text { font-size: 10px; color: var(--color-primary); }
.oe-kv-label { font-size: 8px; color: var(--text-dimmed); text-transform: uppercase; }
.oe-kv-input {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 7px;
  padding: 6px 8px; font-size: 12px; color: var(--text-primary); width: 100%; min-height: 32px;
}
.oe-kv-del {
  width: 26px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  &:active { opacity: 0.6; }
}
.oe-kv-del-icon { font-size: 11px; color: var(--color-danger); }

.oe-collapse-head { display: flex; align-items: center; justify-content: space-between; &:active { opacity: 0.7; } }
.oe-collapse-title { font-size: 12px; font-weight: 700; color: var(--text-secondary); }
.oe-collapse-arrow { font-size: 16px; color: var(--text-muted); transition: transform 0.2s; &--open { transform: rotate(90deg); } }

.oe-sample-row { width: 100%; white-space: nowrap; }
.oe-sample-chips { display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; }
.oe-sample-title { font-size: 10px; color: var(--text-dimmed); flex-shrink: 0; }
.oe-sample-chip {
  padding: 3px 10px; border-radius: 999px;
  background: rgba(var(--color-accent-rgb), 0.07); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  &:active { opacity: 0.7; }
}
.oe-sample-chip-text { font-size: 11px; color: var(--color-accent); font-weight: 600; }
.oe-sample-chip--ex { background: rgba(var(--color-primary-rgb), 0.07); border-color: rgba(var(--color-primary-rgb), 0.3); .oe-sample-chip-text { color: var(--color-primary); } }

.oe-btn {
  height: 46px; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; margin-top: 4px;
  &:active { opacity: 0.85; }
  &--save {
    background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7));
    box-shadow: 0 0 14px rgba(var(--color-primary-rgb), 0.3);
    .oe-btn-text { color: var(--bg-base); }
  }
}
.oe-btn-text { font-size: 15px; font-weight: 700; }

.safe-bottom-spacer { height: calc(20px + env(safe-area-inset-bottom, 16px)); flex-shrink: 0; }

.mono { font-family: 'Courier New', monospace; }
</style>
