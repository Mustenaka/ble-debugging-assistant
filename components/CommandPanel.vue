<template>
  <view class="cp-wrap">

    <!-- 顶部工具栏 -->
    <view class="cp-toolbar">
      <text class="cp-title">{{ t('command.panelTitle') }}</text>
      <view class="cp-tools">
        <view v-if="!sequenceMode" class="cp-tool-btn" @click="openNewCommand">
          <text class="cp-tool-text">＋</text>
        </view>
        <view v-if="!sequenceMode" class="cp-tool-btn" @click="openVars">
          <text class="cp-tool-text mono">{ }</text>
        </view>
        <view v-if="!sequenceMode && bleStore.quickCommands.length" class="cp-tool-btn" @click="showImportModal = true">
          <text class="cp-tool-text">⇪</text>
        </view>
        <view class="cp-tool-btn cp-tool-btn--seq" :class="{ 'cp-tool-btn--seq-on': sequenceMode }" @click="toggleSequenceMode">
          <text class="cp-tool-text" :class="{ 'cp-seq-on-text': sequenceMode }">☰▶</text>
        </view>
      </view>
    </view>

    <!-- 空态 -->
    <view v-if="!panelServices.length" class="cp-empty">
      <text class="cp-empty-icon">⌘</text>
      <text class="cp-empty-title">{{ t('command.emptyTitle') }}</text>
      <text class="cp-empty-tip">{{ t('command.emptyTip') }}</text>
      <view class="cp-empty-btn" @click="openNewCommand">
        <text class="cp-empty-btn-text">＋ {{ t('command.newCommand') }}</text>
      </view>
      <view v-if="bleStore.quickCommands.length" class="cp-empty-btn cp-empty-btn--alt" @click="showImportModal = true">
        <text class="cp-empty-btn-text cp-empty-alt-text">⇪ {{ t('command.importQuick') }}</text>
      </view>
    </view>

    <!-- 命令树 -->
    <scroll-view v-else scroll-y class="cp-scroll">
      <view class="cp-tree">
        <view v-for="svc in panelServices" :key="svc.uuid" class="cp-service">
          <view class="cp-svc-head" @click="toggleService(svc.uuid)">
            <view class="cp-svc-indicator" />
            <view class="cp-svc-info">
              <text class="cp-svc-name">{{ svc.name || t('command.unnamedService') }}</text>
              <text class="cp-svc-uuid mono">{{ shortUUID(svc.uuid) }}</text>
            </view>
            <text class="cp-svc-count">{{ svc.opCount }}</text>
            <view class="cp-svc-chevron" :class="{ 'cp-svc-chevron--open': !collapsedServices.has(svc.uuid) }">
              <text class="cp-chev">›</text>
            </view>
          </view>

          <view v-if="!collapsedServices.has(svc.uuid)" class="cp-chars">
            <view v-for="ch in svc.chars" :key="ch.uuid" class="cp-char">
              <view class="cp-char-head">
                <text class="cp-char-name">{{ ch.name || shortUUID(ch.uuid) }}</text>
                <text v-if="ch.name" class="cp-char-uuid mono">{{ shortUUID(ch.uuid) }}</text>
                <view class="cp-char-add" @click="openNewCommandFor(svc.uuid, ch.uuid)">
                  <text class="cp-char-add-text">＋</text>
                </view>
              </view>

              <view
                v-for="item in ch.ops"
                :key="item.runKey"
                class="cp-op"
                :class="{ 'cp-op--selected': sequenceMode && selectedKeys.has(item.runKey) }"
                @click="sequenceMode ? toggleSelect(item) : fillFromOp(item)"
                @longpress="!sequenceMode && openOpActions(item)"
              >
                <!-- 序列勾选框 -->
                <view v-if="sequenceMode" class="cp-op-check" :class="{ 'cp-op-check--on': selectedKeys.has(item.runKey) }">
                  <text v-if="selectedKeys.has(item.runKey)" class="cp-op-check-mark">✓</text>
                </view>

                <view class="cp-op-main">
                  <view class="cp-op-head">
                    <text class="cp-op-name">{{ item.op.name || item.op.operationId }}</text>
                    <view class="cp-op-action-badge">
                      <text class="cp-op-action-text">{{ actionLabel(item.op) }}</text>
                    </view>
                    <view v-if="item.builtin" class="cp-op-builtin"><text class="cp-op-builtin-text">{{ t('command.builtinBadge') }}</text></view>
                    <view v-if="isTemplateOp(item.op)" class="cp-op-tpl"><text class="cp-op-tpl-text">ƒ</text></view>
                  </view>
                  <text v-if="opPayloadPreview(item.op)" class="cp-op-payload mono">{{ opPayloadPreview(item.op) }}</text>
                  <text v-if="isTemplateOp(item.op)" class="cp-op-rendered mono" :class="{ 'cp-op-rendered--error': !!renderedPreview(item.op).error }">→ {{ renderedPreview(item.op).error || renderedPreview(item.op).hex }}</text>
                  <text v-if="item.op.description" class="cp-op-desc">{{ item.op.description }}</text>

                  <!-- 变体 chips（点击直接执行）-->
                  <view v-if="item.op.variants?.length && !sequenceMode" class="cp-variants">
                    <view
                      v-for="v in item.op.variants"
                      :key="v.label"
                      class="cp-variant-chip"
                      @click.stop="runOp(item, v)"
                    >
                      <text class="cp-variant-text">{{ v.label }}</text>
                      <text class="cp-variant-payload mono">{{ v.payload }}</text>
                    </view>
                  </view>

                  <!-- 执行历史圆点 + RTT -->
                  <view v-if="item.runs.length" class="cp-runs-row">
                    <view class="cp-dots">
                      <view
                        v-for="(r, ri) in item.runs.slice(0, 10)"
                        :key="ri"
                        class="cp-dot"
                        :class="`cp-dot--${r.result}`"
                      />
                    </view>
                    <text class="cp-run-info mono">{{ lastRunText(item) }}</text>
                  </view>
                </view>

                <!-- 执行按钮 -->
                <view v-if="!sequenceMode" class="cp-run-btn" :class="{ 'cp-run-btn--busy': runningKey === item.runKey }" @click.stop="runOp(item)">
                  <view v-if="runningKey === item.runKey" class="cp-run-spin" />
                  <text v-else class="cp-run-icon">▶</text>
                </view>
              </view>
            </view>
          </view>
        </view>
        <view class="safe-bottom-spacer" />
      </view>
    </scroll-view>

    <!-- Runner 选项 -->
    <view v-if="sequenceMode && showRunnerOptions" class="cp-runner-opts">
      <view class="cp-ro-cell">
        <text class="cp-ro-label">{{ t('command.stepDelay') }}</text>
        <input class="cp-ro-input mono" type="number" :value="String(runnerOpts.stepDelayMs)" @input="runnerOpts.stepDelayMs = Math.max(0, parseInt(evtValue($event)) || 0)" />
      </view>
      <view class="cp-ro-cell">
        <text class="cp-ro-label">{{ t('command.loops') }}</text>
        <input class="cp-ro-input mono" type="number" :value="String(runnerOpts.loops)" @input="runnerOpts.loops = Math.max(1, Math.min(1000, parseInt(evtValue($event)) || 1))" />
      </view>
      <view class="cp-ro-toggle" :class="{ 'cp-ro-toggle--on': runnerOpts.stopOnFail }" @click="runnerOpts.stopOnFail = !runnerOpts.stopOnFail">
        <text class="cp-ro-toggle-text">{{ runnerOpts.stopOnFail ? '✓ ' : '' }}{{ t('command.stopOnFail') }}</text>
      </view>
      <view class="cp-ro-toggle" :class="{ 'cp-ro-toggle--on': runnerOpts.expandVariants }" @click="runnerOpts.expandVariants = !runnerOpts.expandVariants">
        <text class="cp-ro-toggle-text">{{ runnerOpts.expandVariants ? '✓ ' : '' }}{{ t('command.expandVariants') }}</text>
      </view>
    </view>

    <!-- 序列模式底栏 -->
    <view v-if="sequenceMode" class="cp-seq-bar">
      <text class="cp-seq-info">{{ sequenceRunningText || t('command.sequenceMode') }}</text>
      <view class="cp-seq-actions">
        <view class="cp-seq-btn cp-seq-btn--cancel" :class="{ 'cp-seq-btn--opts-on': showRunnerOptions }" @click="showRunnerOptions = !showRunnerOptions">
          <text class="cp-seq-btn-text">⚙</text>
        </view>
        <view class="cp-seq-btn cp-seq-btn--cancel" @click="toggleSequenceMode">
          <text class="cp-seq-btn-text">{{ t('command.sequenceExit') }}</text>
        </view>
        <view class="cp-seq-btn cp-seq-btn--go" :class="{ 'cp-seq-btn--disabled': isSequenceRunning }" @click="runSequence">
          <text class="cp-seq-btn-text cp-seq-go-text">▶ {{ t('command.sequenceStart', { n: selectedKeys.size }) }}</text>
        </view>
      </view>
    </view>

    <!-- 命令编辑器 -->
    <OperationEditor
      :visible="showOpEditor"
      :device-id="deviceId"
      :device-name="deviceName"
      :serviceUUID="editorTarget.serviceUUID"
      :charUUID="editorTarget.charUUID"
      :lock-target="editorTarget.lock"
      :initial="editorTarget.initial"
      :persist="true"
      @close="showOpEditor = false"
      @saved="onEditorSaved"
    />

    <!-- 导入快捷命令 -->
    <view v-if="showImportModal" class="cp-modal-overlay" @click="showImportModal = false">
      <view class="cp-modal" :class="{ 'cp-modal--wide': isWideScreen }" @click.stop>
        <text class="cp-modal-title">{{ t('command.importQuickTitle') }}</text>

        <text class="cp-modal-label">{{ t('command.importTarget') }}</text>
        <scroll-view scroll-y class="cp-import-chars">
          <view
            v-for="c in writableChars"
            :key="c.serviceUUID + c.uuid"
            class="cp-import-char"
            :class="{ 'cp-import-char--active': importSvc === c.serviceUUID && importChar === c.uuid }"
            @click="importSvc = c.serviceUUID; importChar = c.uuid"
          >
            <view class="cp-radio" :class="{ 'cp-radio--on': importSvc === c.serviceUUID && importChar === c.uuid }" />
            <text class="cp-import-uuid mono">{{ shortUUID(c.serviceUUID) }} / {{ shortUUID(c.uuid) }}</text>
          </view>
        </scroll-view>

        <scroll-view scroll-y class="cp-import-list">
          <view
            v-for="cmd in bleStore.quickCommands"
            :key="cmd.id"
            class="cp-import-item"
            @click="toggleImportCmd(cmd.id)"
          >
            <view class="cp-check" :class="{ 'cp-check--on': importSelected.has(cmd.id) }">
              <text v-if="importSelected.has(cmd.id)" class="cp-check-mark">✓</text>
            </view>
            <view class="cp-import-info">
              <text class="cp-import-name">{{ cmd.name }}</text>
              <text class="cp-import-data mono">{{ cmd.data }}</text>
            </view>
          </view>
        </scroll-view>

        <view class="cp-modal-actions">
          <view class="cp-modal-btn cp-modal-btn--cancel" @click="showImportModal = false">
            <text>{{ t('common.cancel') }}</text>
          </view>
          <view class="cp-modal-btn cp-modal-btn--confirm" @click="confirmImport">
            <text>{{ t('command.importSelected', { n: importSelected.size }) }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 变量与环境 -->
    <view v-if="showVars" class="cp-modal-overlay" @click="showVars = false">
      <view class="cp-modal" :class="{ 'cp-modal--wide': isWideScreen }" @click.stop>
        <text class="cp-modal-title">{ } {{ t('command.variablesTitle') }}</text>

        <view class="cp-seq-row">
          <text class="cp-modal-label">{{ t('command.seqLabel') }}</text>
          <text class="cp-seq-val mono">{{ bleStore.activeSeq }}</text>
          <view class="cp-mini-btn" @click="bleStore.resetSeq()"><text class="cp-mini-btn-text">{{ t('command.resetSeq') }}</text></view>
        </view>

        <scroll-view scroll-y class="cp-vars-scroll">
          <view class="cp-vars-section">
            <view class="cp-vars-hd">
              <text class="cp-modal-label">{{ t('command.collectionVars') }}</text>
              <view v-if="varsCollectionId" class="cp-mini-btn" @click="colVars.push({ name: '', value: '', description: '' })"><text class="cp-mini-btn-text">＋ {{ t('command.addVar') }}</text></view>
            </view>
            <text v-if="!varsCollectionId" class="cp-vars-hint">{{ t('command.noCollectionForVars') }}</text>
            <view v-for="(v, i) in colVars" :key="i" class="cp-var-row">
              <input class="cp-var-input cp-var-input--name mono" :value="v.name" :placeholder="t('command.varName')" placeholder-class="cp-ph" @input="v.name = evtValue($event)" />
              <input class="cp-var-input mono" :value="v.value" :placeholder="t('command.varValue')" placeholder-class="cp-ph" @input="v.value = evtValue($event)" />
              <input class="cp-var-input cp-var-input--desc" :value="v.description ?? ''" :placeholder="t('command.varDesc')" placeholder-class="cp-ph" @input="v.description = evtValue($event)" />
              <view class="cp-var-del" @click="colVars.splice(i, 1)"><text class="cp-var-del-icon">✕</text></view>
            </view>
          </view>

          <view class="cp-vars-section">
            <view class="cp-vars-hd">
              <text class="cp-modal-label">{{ t('command.deviceVars') }}</text>
              <view class="cp-mini-btn" @click="envRows.push({ name: '', value: '' })"><text class="cp-mini-btn-text">＋ {{ t('command.addVar') }}</text></view>
            </view>
            <view v-for="(v, i) in envRows" :key="i" class="cp-var-row">
              <input class="cp-var-input cp-var-input--name mono" :value="v.name" :placeholder="t('command.varName')" placeholder-class="cp-ph" @input="v.name = evtValue($event)" />
              <input class="cp-var-input mono" :value="v.value" :placeholder="t('command.varValue')" placeholder-class="cp-ph" @input="v.value = evtValue($event)" />
              <view class="cp-var-del" @click="envRows.splice(i, 1)"><text class="cp-var-del-icon">✕</text></view>
            </view>
          </view>
          <text class="cp-vars-hint">{{ t('command.templateHint') }}</text>
        </scroll-view>

        <view class="cp-modal-actions">
          <view class="cp-modal-btn cp-modal-btn--cancel" @click="showVars = false"><text>{{ t('common.cancel') }}</text></view>
          <view class="cp-modal-btn cp-modal-btn--confirm" @click="saveVars"><text>{{ t('common.save') }}</text></view>
        </view>
      </view>
    </view>

    <!-- 序列执行报告 -->
    <view v-if="showReport" class="cp-modal-overlay" @click="showReport = false">
      <view class="cp-modal" :class="{ 'cp-modal--wide': isWideScreen }" @click.stop>
        <text class="cp-modal-title">{{ t('command.sequenceReportTitle') }}</text>
        <text class="cp-report-summary">{{ reportSummaryText }}</text>
        <scroll-view scroll-y class="cp-report-list">
          <view v-for="(r, i) in sequenceReport" :key="i" class="cp-report-item" :class="`cp-report-item--${r.record.result}`">
            <view class="cp-report-head">
              <text class="cp-report-name">{{ r.name }}</text>
              <text class="cp-report-result" :class="`cp-result--${r.record.result}`">{{ resultLabel(r.record.result) }}</text>
            </view>
            <text v-if="r.record.requestHex" class="cp-report-line mono">TX {{ r.record.requestHex }}</text>
            <text v-if="r.record.responseHex" class="cp-report-line mono">RX {{ r.record.responseHex }}{{ r.record.rttMs != null ? ` · ${r.record.rttMs}ms` : '' }}</text>
            <text v-if="r.record.reason" class="cp-report-reason">{{ r.record.reason }}</text>
          </view>
        </scroll-view>
        <view class="cp-modal-actions">
          <view class="cp-modal-btn cp-modal-btn--confirm" @click="showReport = false">
            <text>{{ t('common.ok') }}</text>
          </view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, computed, reactive, watch } from 'vue'
import { useBleStore } from '../store/bleStore'
import { useCollectionStore } from '../store/collectionStore'
import { useI18n } from '../composables/useI18n'
import { useResponsive } from '../composables/useResponsive'
import { shortUUID, normalizeUUID } from '../utils/hex'
import { matchBuiltinProtocolDocs } from '../services/builtinProtocolDocs'
import { hasTemplateTokens } from '../utils/payload'
import type { CollectionVariable } from '../utils/collection'
import type { QuickCommand } from '../utils/buffer'
import { loadRunnerOptions, saveRunnerOptions, buildRunPlan, shouldStopAfter, summarizeRun, type RunnerOptions } from '../utils/runner'
import { exampleFromRun, saveExampleForDevice } from '../utils/examples'
import {
  loadDeviceAnnotations,
  mergeAnnotationsIntoDocs,
  loadOperationRuns,
  operationRunKey,
  operationPayload,
  upsertOperationAnnotation,
  removeOperationAnnotation,
  charAnnotationKey,
  type OperationAnnotation,
  type OperationRunRecord,
  type OperationVariant,
  type DeviceAnnotations,
} from '../utils/deviceArchive'
import OperationEditor from './OperationEditor.vue'

const emit = defineEmits<{
  fill: [payload: { data: string; mode: 'hex' | 'ascii'; serviceUUID: string; charUUID: string }]
}>()

const bleStore = useBleStore()
const collectionStore = useCollectionStore()
collectionStore.init()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const deviceId = computed(() => bleStore.activeSessionId)
const deviceName = computed(() => bleStore.activeSession?.device.name ?? '')

// 数据刷新信号（保存/执行后自增；集合被导入/编辑时也刷新）
const refreshTick = ref(0)
const collapsedServices = reactive<Set<string>>(new Set())

watch(deviceId, () => {
  collapsedServices.clear()
  refreshTick.value++
})
watch(() => collectionStore.version, () => { refreshTick.value++ })

// ── 模板预览 ────────────────────────────────────────────────────────────────

function isTemplateOp(op: OperationAnnotation): boolean {
  return hasTemplateTokens(operationPayload(op))
}

function renderedPreview(op: OperationAnnotation): { hex: string; error?: string } {
  void refreshTick.value
  void collectionStore.version
  void bleStore.activeSeq
  return bleStore.previewPayloadFor(operationPayload(op), op.payloadMode ?? 'hex', deviceId.value)
}

// ── 变量与环境 ──────────────────────────────────────────────────────────────

const showVars = ref(false)
const varsCollectionId = ref('')
const colVars = ref<CollectionVariable[]>([])
const envRows = ref<{ name: string; value: string }[]>([])

function evtValue(e: any): string {
  return String(e?.detail?.value ?? '')
}

function openVars() {
  const col = collectionStore.forDevice(deviceId.value)
  varsCollectionId.value = col?.id ?? ''
  colVars.value = (col?.variables ?? []).map((v) => ({ ...v }))
  envRows.value = Object.entries(collectionStore.deviceEnv(deviceId.value)).map(([name, value]) => ({ name, value }))
  showVars.value = true
}

function saveVars() {
  if (varsCollectionId.value) {
    collectionStore.setVariables(varsCollectionId.value, colVars.value.filter((v) => v.name.trim()))
  }
  const env: Record<string, string> = {}
  for (const row of envRows.value) if (row.name.trim()) env[row.name.trim()] = row.value
  collectionStore.setDeviceEnv(deviceId.value, env)
  showVars.value = false
  refreshTick.value++
  uni.showToast({ title: t('command.varsSaved'), icon: 'success', duration: 1200 })
}

// ── 面板数据组装 ────────────────────────────────────────────────────────────

interface PanelOp {
  op: OperationAnnotation
  serviceUUID: string
  charUUID: string
  builtin: boolean
  runKey: string
  runs: OperationRunRecord[]
}

interface PanelChar { uuid: string; name: string; ops: PanelOp[] }
interface PanelService { uuid: string; name: string; chars: PanelChar[]; opCount: number }

const annotations = computed<DeviceAnnotations>(() => {
  void refreshTick.value
  return loadDeviceAnnotations(deviceId.value)
})

const runsMap = computed<Record<string, OperationRunRecord[]>>(() => {
  void refreshTick.value
  return loadOperationRuns(deviceId.value)
})

const panelServices = computed<PanelService[]>(() => {
  void refreshTick.value
  const session = bleStore.activeSession
  const ann = annotations.value
  const builtin = matchBuiltinProtocolDocs((session?.services ?? []).map((s) => s.uuid))
  const merged = mergeAnnotationsIntoDocs(builtin, ann)
  const runs = runsMap.value

  // 收集：serviceUUID → charUUID → PanelOp[]
  const svcMap = new Map<string, Map<string, PanelOp[]>>()

  const pushOp = (svcUUID: string, chUUID: string, op: OperationAnnotation, isBuiltin: boolean) => {
    const key = operationRunKey(svcUUID, chUUID, op.id || op.operationId || op.name)
    const chMap = svcMap.get(normalizeUUID(svcUUID)) ?? new Map<string, PanelOp[]>()
    const list = chMap.get(normalizeUUID(chUUID)) ?? []
    list.push({
      op,
      serviceUUID: svcUUID,
      charUUID: chUUID,
      builtin: isBuiltin,
      runKey: key,
      runs: runs[key] ?? [],
    })
    chMap.set(normalizeUUID(chUUID), list)
    svcMap.set(normalizeUUID(svcUUID), chMap)
  }

  // 1) 用户注释命令（完整可执行）
  for (const charAnn of Object.values(ann.characteristics)) {
    for (const op of charAnn.operations ?? []) {
      pushOp(charAnn.serviceUUID, charAnn.uuid, op, false)
    }
  }

  // 2) 内置模板命令（未被注释同 operationId 覆盖的），构造为默认可执行
  const annOpIds = new Set<string>()
  for (const charAnn of Object.values(ann.characteristics)) {
    for (const op of charAnn.operations ?? []) {
      if (op.operationId) annOpIds.add(`${charAnnotationKey(charAnn.serviceUUID, charAnn.uuid)}::${op.operationId}`)
    }
  }
  for (const [charKey, doc] of Object.entries(builtin.charDocs)) {
    const [svcUUID, chUUID] = charKey.split('::')
    // 同服务里的 Notify/Indicate 特征值：模板命令的默认响应通道
    const notifyCharInService = Object.entries(builtin.charDocs)
      .filter(([k, d]) => k.startsWith(`${svcUUID}::`) && k !== charKey && d.properties.some((p) => /NOTIFY|INDICATE/i.test(p)))
      .map(([k]) => k.split('::')[1])[0]
    for (const api of doc.interfaces) {
      if (api.operationId && annOpIds.has(`${charKey}::${api.operationId}`)) continue
      const request = (api.request ?? '').trim().toUpperCase()
      if (request === 'NONE') continue // 事件型接口（设备主动上报）不是可执行命令
      const isRead = request === 'READ'
      const respHead = (api.responseExample ?? '').trim().split(/\s+/)[0] ?? ''
      const hasResponse = !!(api.response && api.response.toUpperCase() !== 'NONE')
      pushOp(svcUUID, chUUID, {
        id: `builtin_${api.operationId || api.name}`,
        name: api.name,
        operationId: api.operationId,
        description: api.description,
        request: api.request,
        response: api.response,
        requestExample: api.requestExample,
        responseExample: api.responseExample,
        requestFields: api.requestFields,
        responseFields: api.responseFields,
        actionType: isRead ? 'read' : 'write',
        payloadMode: 'hex',
        payload: api.payload || api.requestExample || '',
        // 模板自带响应样例时默认开启判定：READ 以被读特征值判定；WRITE 以同服务 Notify 特征值 + 响应首字节判定
        expect: hasResponse
          ? {
              enabled: true,
              responseCharacteristicUUID: isRead ? '' : (notifyCharInService ?? ''),
              matchHex: isRead ? '' : (/^[0-9A-Fa-f]{2}$/.test(respHead) ? respHead : ''),
              timeoutMs: 2000,
              fieldAssertions: [],
            }
          : undefined,
      }, true)
    }
  }

  // 组装展示树（服务/特征值名称走合并文档）
  const result: PanelService[] = []
  svcMap.forEach((chMap, svcKey) => {
    const svcDoc = merged.serviceDocs[svcKey]
    const chars: PanelChar[] = []
    let opCount = 0
    chMap.forEach((ops, chKey) => {
      const charDoc = merged.charDocs[`${svcKey}::${chKey}`]
      opCount += ops.length
      chars.push({ uuid: chKey, name: charDoc?.name ?? '', ops })
    })
    result.push({
      uuid: svcKey,
      name: svcDoc?.name ?? '',
      chars,
      opCount,
    })
  })
  return result
})

const writableChars = computed(() => {
  const session = bleStore.activeSession
  if (!session) return []
  const list: { serviceUUID: string; uuid: string }[] = []
  session.characteristics.forEach((chars, serviceUUID) => {
    for (const c of chars) {
      if (c.properties.write || c.properties.writeNoResponse) {
        list.push({ serviceUUID, uuid: c.uuid })
      }
    }
  })
  return list
})

function toggleService(uuid: string) {
  if (collapsedServices.has(uuid)) collapsedServices.delete(uuid)
  else collapsedServices.add(uuid)
}

defineExpose({ refresh: () => { refreshTick.value++ } })

function actionLabel(op: OperationAnnotation): string {
  const a = op.actionType ?? 'write'
  return a === 'read' ? 'READ' : a === 'writeNoResponse' ? 'W-NR' : 'WRITE'
}

function opPayloadPreview(op: OperationAnnotation): string {
  const p = operationPayload(op)
  return p.length > 30 ? p.slice(0, 30) + '…' : p
}

function lastRunText(item: PanelOp): string {
  const last = item.runs[0]
  if (!last) return ''
  const label = resultLabel(last.result)
  return last.rttMs != null ? `${label} · ${last.rttMs}ms` : label
}

function resultLabel(result: OperationRunRecord['result']): string {
  const map: Record<string, string> = {
    pass: t('command.resultPass'),
    fail: t('command.resultFail'),
    timeout: t('command.resultTimeout'),
    error: t('command.resultError'),
    sent: t('command.resultSent'),
  }
  return map[result] ?? result
}

// ── 定位 + 填入发送框 ───────────────────────────────────────────────────────

function locateOp(item: PanelOp) {
  const session = bleStore.activeSession
  if (!session) return
  session.activeServiceId = item.serviceUUID
  bleStore.selectCharacteristic(item.charUUID, deviceId.value)
}

function fillFromOp(item: PanelOp) {
  locateOp(item)
  const payload = operationPayload(item.op)
  emit('fill', {
    data: payload,
    mode: item.op.payloadMode ?? 'hex',
    serviceUUID: item.serviceUUID,
    charUUID: item.charUUID,
  })
}

// ── 执行 ────────────────────────────────────────────────────────────────────

const runningKey = ref('')

async function runOp(item: PanelOp, variant?: OperationVariant): Promise<OperationRunRecord> {
  if (!bleStore.isConnected) {
    uni.showToast({ title: t('command.notConnected'), icon: 'none' })
    return { timestamp: Date.now(), requestHex: '', responseHex: null, rttMs: null, result: 'error', reason: 'not-connected' }
  }
  locateOp(item)
  runningKey.value = item.runKey
  try {
    const record = await bleStore.runOperation({
      serviceUUID: item.serviceUUID,
      characteristicUUID: item.charUUID,
      op: item.op,
      payloadOverride: variant?.payload,
      variantLabel: variant?.label,
    })
    if (record.reason === 'busy') {
      uni.showToast({ title: t('command.busy'), icon: 'none' })
    } else {
      const toastKey = `command.toast${record.result.charAt(0).toUpperCase()}${record.result.slice(1)}`
      uni.showToast({ title: t(toastKey), icon: 'none', duration: 1500 })
    }
    return record
  } finally {
    runningKey.value = ''
    refreshTick.value++
  }
}

// ── 新建 / 编辑 / 复制 / 删除 ───────────────────────────────────────────────

const showOpEditor = ref(false)
const editorTarget = ref<{
  serviceUUID?: string
  charUUID?: string
  lock: boolean
  initial: OperationAnnotation | null
}>({ lock: false, initial: null })

function openNewCommand() {
  editorTarget.value = { lock: false, initial: null }
  showOpEditor.value = true
}

function openNewCommandFor(serviceUUID: string, charUUID: string) {
  editorTarget.value = { serviceUUID, charUUID, lock: true, initial: null }
  showOpEditor.value = true
}

function onEditorSaved() {
  showOpEditor.value = false
  refreshTick.value++
}

function saveLastRunAsExample(item: PanelOp) {
  const last = item.runs[0]
  const example = last ? exampleFromRun(item.serviceUUID, item.charUUID, item.op, last) : null
  if (!example) {
    uni.showToast({ title: t('command.noRunToSave'), icon: 'none' }); return
  }
  const col = saveExampleForDevice(deviceId.value, deviceName.value, example)
  refreshTick.value++
  uni.showToast({ title: t('command.exampleSaved', { name: col.name }), icon: 'none', duration: 1800 })
}

function openOpActions(item: PanelOp) {
  const actions: { label: string; run: () => void }[] = [
    { label: t('command.run'), run: () => { runOp(item) } },
    { label: t('command.fill'), run: () => fillFromOp(item) },
  ]
  if (item.runs[0]?.requestHex || item.runs[0]?.responseHex) {
    actions.push({ label: t('command.saveRunAsExample'), run: () => saveLastRunAsExample(item) })
  }
  if (!item.builtin) {
    actions.push({
      label: t('command.editCommand'),
      run: () => {
        editorTarget.value = {
          serviceUUID: item.serviceUUID, charUUID: item.charUUID, lock: true,
          initial: JSON.parse(JSON.stringify(item.op)),
        }
        showOpEditor.value = true
      },
    })
  }
  actions.push({ label: t('command.duplicate'), run: () => duplicateOp(item) })
  if (!item.builtin) {
    actions.push({
      label: t('command.deleteCommand'),
      run: () => {
        uni.showModal({
          title: t('command.deleteCommand'),
          content: t('command.deleteConfirm'),
          confirmColor: '#DC2626',
          success: (r) => {
            if (r.confirm) {
              removeOperationAnnotation(deviceId.value, item.serviceUUID, item.charUUID, item.op.id)
              refreshTick.value++
            }
          },
        })
      },
    })
  }
  uni.showActionSheet({
    itemList: actions.map((a) => a.label),
    success: (res) => actions[res.tapIndex]?.run(),
  })
}

function duplicateOp(item: PanelOp) {
  const copy: OperationAnnotation = JSON.parse(JSON.stringify(item.op))
  copy.id = `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  copy.name = `${copy.name}${t('command.copySuffix')}`
  if (copy.operationId) copy.operationId = `${copy.operationId}.copy`
  upsertOperationAnnotation(deviceId.value, deviceName.value, item.serviceUUID, item.charUUID, copy)
  refreshTick.value++
  // 直接进入编辑，方便改载荷
  editorTarget.value = {
    serviceUUID: item.serviceUUID, charUUID: item.charUUID, lock: true,
    initial: copy,
  }
  showOpEditor.value = true
}

// ── 导入快捷命令 ────────────────────────────────────────────────────────────

const showImportModal = ref(false)
const importSelected = reactive<Set<string>>(new Set())
const importSvc = ref('')
const importChar = ref('')

watch(showImportModal, (v) => {
  if (!v) return
  importSelected.clear()
  bleStore.quickCommands.forEach((cmd) => importSelected.add(cmd.id))
  const session = bleStore.activeSession
  const active = writableChars.value.find(
    (c) => session && c.serviceUUID === session.activeServiceId && c.uuid === session.activeCharacteristicId
  )
  const first = active ?? writableChars.value[0]
  importSvc.value = first?.serviceUUID ?? ''
  importChar.value = first?.uuid ?? ''
})

function toggleImportCmd(id: string) {
  if (importSelected.has(id)) importSelected.delete(id)
  else importSelected.add(id)
}

function confirmImport() {
  if (!importSelected.size) {
    uni.showToast({ title: t('command.importEmpty'), icon: 'none' }); return
  }
  if (!importSvc.value || !importChar.value) {
    uni.showToast({ title: t('command.targetRequired'), icon: 'none' }); return
  }
  let count = 0
  for (const cmd of bleStore.quickCommands as QuickCommand[]) {
    if (!importSelected.has(cmd.id)) continue
    const op: OperationAnnotation = {
      id: `op_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${count}`,
      name: cmd.name,
      operationId: '',
      description: cmd.description ?? '',
      requestFields: [],
      responseFields: [],
      actionType: 'write',
      payloadMode: cmd.mode,
      payload: cmd.data,
      requestExample: cmd.mode === 'hex' ? cmd.data : '',
    }
    upsertOperationAnnotation(deviceId.value, deviceName.value, importSvc.value, importChar.value, op)
    count++
  }
  showImportModal.value = false
  refreshTick.value++
  uni.showToast({ title: t('command.importDone', { n: count }), icon: 'success' })
}

// ── 顺序执行（P3）───────────────────────────────────────────────────────────

const sequenceMode = ref(false)
const selectedKeys = reactive<Set<string>>(new Set())
const isSequenceRunning = ref(false)
const sequenceRunningText = ref('')
const showReport = ref(false)
const sequenceReport = ref<{ name: string; record: OperationRunRecord }[]>([])
const showRunnerOptions = ref(false)
const runnerOpts = reactive<RunnerOptions>(loadRunnerOptions())
const lastPlanTotal = ref(0)

function toggleSequenceMode() {
  if (isSequenceRunning.value) return
  sequenceMode.value = !sequenceMode.value
  selectedKeys.clear()
  sequenceRunningText.value = ''
}

function toggleSelect(item: PanelOp) {
  if (selectedKeys.has(item.runKey)) selectedKeys.delete(item.runKey)
  else selectedKeys.add(item.runKey)
}

const reportSummaryText = computed(() => {
  const s = summarizeRun(sequenceReport.value.map((r) => r.record), lastPlanTotal.value)
  let text = t('command.sequenceSummary', { pass: s.pass, fail: s.fail, timeout: s.timeout, error: s.error })
  if (s.aborted) text += ` · ${t('command.runnerAborted', { done: s.total, total: lastPlanTotal.value })}`
  if (s.avgRttMs != null) text += ` · ${t('command.runnerAvgRtt', { ms: s.avgRttMs })}`
  return text
})

async function runSequence() {
  if (isSequenceRunning.value) return
  // 按面板顺序收集被选命令
  const items: PanelOp[] = []
  for (const svc of panelServices.value) {
    for (const ch of svc.chars) {
      for (const item of ch.ops) {
        if (selectedKeys.has(item.runKey)) items.push(item)
      }
    }
  }
  if (!items.length) {
    uni.showToast({ title: t('command.selectAtLeast'), icon: 'none' }); return
  }
  saveRunnerOptions({ ...runnerOpts })
  const plan = buildRunPlan(items, runnerOpts)
  lastPlanTotal.value = plan.length
  isSequenceRunning.value = true
  const report: { name: string; record: OperationRunRecord }[] = []
  try {
    for (const step of plan) {
      sequenceRunningText.value = t('command.sequenceRunning', { i: step.index, n: plan.length, name: step.label })
      locateOp(step.item)
      const record = await bleStore.runOperation({
        serviceUUID: step.item.serviceUUID,
        characteristicUUID: step.item.charUUID,
        op: step.item.op,
        payloadOverride: step.variant?.payload,
        variantLabel: step.variant?.label,
      })
      report.push({ name: step.label, record })
      if (shouldStopAfter(record, runnerOpts)) break
      if (runnerOpts.stepDelayMs > 0) await new Promise((r) => setTimeout(r, runnerOpts.stepDelayMs))
    }
  } finally {
    isSequenceRunning.value = false
    sequenceRunningText.value = ''
    refreshTick.value++
  }
  sequenceReport.value = report
  showReport.value = true
  bleStore.addSysLog(`☰▶ 顺序执行完成: ${reportSummaryText.value}`)
}
</script>

<style lang="scss" scoped>
.cp-wrap {
  display: flex; flex-direction: column; height: 100%; min-height: 0;
  background: var(--bg-base); position: relative;
}

/* 工具栏 */
.cp-toolbar {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
}
.cp-title { font-size: 13px; font-weight: 700; color: var(--color-primary); letter-spacing: 0.5px; }
.cp-tools { display: flex; gap: 6px; }
.cp-tool-btn {
  min-width: 30px; height: 30px; padding: 0 8px;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 7px;
  &:active { opacity: 0.7; }
  &--seq-on { background: rgba(var(--color-purple, 139,92,246), 0.15); border-color: var(--color-purple); }
}
.cp-tool-text { font-size: 13px; color: var(--text-secondary); font-weight: 700; }
.cp-seq-on-text { color: var(--color-purple); }

/* 空态 */
.cp-empty {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; padding: 32px 28px;
}
.cp-empty-icon { font-size: 42px; color: var(--text-dimmed); }
.cp-empty-title { font-size: 15px; font-weight: 700; color: var(--text-secondary); }
.cp-empty-tip { font-size: 12px; color: var(--text-muted); text-align: center; line-height: 1.6; }
.cp-empty-btn {
  margin-top: 6px; padding: 9px 22px;
  background: rgba(var(--color-primary-rgb), 0.1); border: 1px solid rgba(var(--color-primary-rgb), 0.3);
  border-radius: 10px;
  &:active { opacity: 0.75; }
  &--alt { background: rgba(var(--color-accent-rgb), 0.08); border-color: rgba(var(--color-accent-rgb), 0.25); }
}
.cp-empty-btn-text { font-size: 13px; color: var(--color-primary); font-weight: 600; }
.cp-empty-alt-text { color: var(--color-accent); }

/* 树 */
.cp-scroll { flex: 1; min-height: 0; }
.cp-tree { padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }

.cp-service {
  background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 12px;
  overflow: hidden;
}
.cp-svc-head {
  display: flex; align-items: center; gap: 10px; padding: 11px 12px;
  &:active { background: var(--bg-elevated); }
}
.cp-svc-indicator { width: 4px; height: 16px; border-radius: 2px; background: var(--color-primary); flex-shrink: 0; }
.cp-svc-info { flex: 1; min-width: 0; }
.cp-svc-name { display: block; font-size: 13px; font-weight: 700; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-svc-uuid { display: block; font-size: 9px; color: var(--text-dimmed); margin-top: 1px; }
.cp-svc-count { font-size: 11px; color: var(--text-muted); font-family: 'Courier New', monospace; }
.cp-svc-chevron { transition: transform 0.2s; &--open { transform: rotate(90deg); } }
.cp-chev { font-size: 15px; color: var(--text-muted); }

.cp-chars { border-top: 1px solid var(--border-subtle); padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; }
.cp-char-head { display: flex; align-items: center; gap: 6px; padding: 2px 2px 0; }
.cp-char-name { font-size: 11px; font-weight: 700; color: var(--color-accent); }
.cp-char-uuid { font-size: 9px; color: var(--text-dimmed); flex: 1; }
.cp-char-head .cp-char-uuid:not(:last-child) { flex: 1; }
.cp-char-add {
  margin-left: auto; width: 22px; height: 22px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.25);
  border-radius: 6px;
  &:active { opacity: 0.7; }
}
.cp-char-add-text { font-size: 12px; color: var(--color-accent); }
.cp-char { display: flex; flex-direction: column; gap: 6px; }

/* 命令卡片 */
.cp-op {
  display: flex; align-items: center; gap: 8px;
  padding: 9px 10px; background: var(--bg-card);
  border: 1px solid var(--border-subtle); border-radius: 10px;
  &:active { background: var(--bg-elevated); }
  &--selected { border-color: rgba(var(--color-purple, 139,92,246), 0.6); background: rgba(139,92,246, 0.06); }
}
.cp-op-check {
  width: 20px; height: 20px; border-radius: 6px; flex-shrink: 0;
  border: 1px solid var(--border-default); background: var(--bg-input);
  display: flex; align-items: center; justify-content: center;
  &--on { border-color: var(--color-purple); background: rgba(139,92,246, 0.15); }
}
.cp-op-check-mark { font-size: 12px; color: var(--color-purple); font-weight: 700; }
.cp-op-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.cp-op-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cp-op-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.cp-op-action-badge { padding: 0 5px; border-radius: 3px; background: rgba(var(--color-primary-rgb), 0.1); }
.cp-op-action-text { font-size: 8px; font-weight: 700; color: var(--color-primary); }
.cp-op-builtin { padding: 0 5px; border-radius: 3px; background: rgba(var(--color-warning-rgb), 0.1); }
.cp-op-builtin-text { font-size: 8px; font-weight: 700; color: var(--color-warning); }
.cp-op-payload { font-size: 11px; color: var(--text-mono); }
.cp-op-rendered { font-size: 10px; color: var(--color-accent); word-break: break-all; &--error { color: var(--color-danger); } }
.cp-op-tpl { padding: 0 5px; border-radius: 3px; background: rgba(var(--color-accent-rgb), 0.12); }
.cp-op-tpl-text { font-size: 9px; font-weight: 700; color: var(--color-accent); font-style: italic; }
.cp-op-desc { font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 变量弹窗 */
.cp-seq-row { display: flex; align-items: center; gap: 10px; .cp-modal-label { text-transform: none; } }
.cp-seq-val { font-size: 14px; font-weight: 700; color: var(--color-primary); flex: 1; }
.cp-mini-btn {
  padding: 4px 10px; border-radius: 6px;
  background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.25);
  &:active { opacity: 0.7; }
}
.cp-mini-btn-text { font-size: 10px; color: var(--color-primary); font-weight: 700; }
.cp-vars-scroll { max-height: 50vh; display: flex; flex-direction: column; }
.cp-vars-section { display: flex; flex-direction: column; gap: 6px; margin-bottom: 12px; }
.cp-vars-hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cp-vars-hint { font-size: 10px; color: var(--text-dimmed); line-height: 1.5; }
.cp-var-row { display: flex; gap: 5px; align-items: center; }
.cp-var-input {
  flex: 1; min-width: 0; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 7px;
  padding: 6px 8px; font-size: 12px; color: var(--text-primary); min-height: 32px;
  &--name { flex: 0 0 82px; color: var(--color-primary); }
  &--desc { flex: 0 0 90px; font-size: 11px; }
}
.cp-ph { color: var(--text-dimmed); }
.cp-var-del { width: 22px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &:active { opacity: 0.6; } }
.cp-var-del-icon { font-size: 11px; color: var(--color-danger); }

.cp-variants { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 2px; }
.cp-variant-chip {
  display: flex; align-items: center; gap: 5px; padding: 3px 9px;
  background: rgba(var(--color-accent-rgb), 0.07); border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  border-radius: 999px;
  &:active { background: rgba(var(--color-accent-rgb), 0.18); }
}
.cp-variant-text { font-size: 11px; color: var(--color-accent); font-weight: 700; }
.cp-variant-payload { font-size: 9px; color: var(--text-muted); }

.cp-runs-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
.cp-dots { display: flex; gap: 3px; flex-direction: row-reverse; }
.cp-dot {
  width: 7px; height: 7px; border-radius: 50%;
  &--pass { background: var(--color-accent); }
  &--sent { background: var(--text-dimmed); }
  &--fail { background: var(--color-danger); }
  &--timeout { background: var(--color-warning); }
  &--error { background: var(--color-danger); opacity: 0.5; }
}
.cp-run-info { font-size: 9px; color: var(--text-muted); }

.cp-run-btn {
  width: 38px; height: 38px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7));
  border-radius: 10px; box-shadow: 0 0 10px rgba(var(--color-primary-rgb), 0.25);
  &:active { transform: scale(0.94); }
  &--busy { opacity: 0.6; }
}
.cp-run-icon { font-size: 14px; color: var(--bg-base); }
.cp-run-spin { width: 16px; height: 16px; border: 2px solid rgba(0,0,0,0.2); border-top-color: var(--bg-base); border-radius: 50%; animation: ble-spin 0.7s linear infinite; }

/* 序列底栏 */
.cp-seq-bar {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: var(--bg-panel);
  padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--border-subtle); flex-shrink: 0;
}
.cp-seq-info { flex: 1; font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-seq-actions { display: flex; gap: 8px; flex-shrink: 0; }
.cp-seq-btn {
  padding: 8px 14px; border-radius: 9px;
  &:active { opacity: 0.8; }
  &--cancel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); }
  &--go { background: linear-gradient(135deg, var(--color-purple), rgba(139,92,246, 0.7)); }
  &--disabled { opacity: 0.5; }
}
.cp-seq-btn-text { font-size: 12px; font-weight: 700; color: var(--text-secondary); }
.cp-seq-go-text { color: #fff; }
.cp-seq-btn--opts-on { border-color: rgba(var(--color-purple, 139,92,246), 0.6); .cp-seq-btn-text { color: var(--color-purple); } }

/* Runner 选项 */
.cp-runner-opts {
  display: flex; align-items: flex-end; gap: 8px; flex-wrap: wrap;
  padding: 8px 14px; background: var(--bg-panel); border-top: 1px solid var(--border-subtle); flex-shrink: 0;
}
.cp-ro-cell { display: flex; flex-direction: column; gap: 3px; flex: 0 0 90px; }
.cp-ro-label { font-size: 9px; color: var(--text-dimmed); text-transform: uppercase; }
.cp-ro-input {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 7px;
  padding: 5px 8px; font-size: 12px; color: var(--text-primary); min-height: 30px; width: 100%;
}
.cp-ro-toggle {
  padding: 6px 10px; border-radius: 7px; border: 1px solid var(--border-default); background: var(--bg-input);
  &:active { opacity: 0.7; }
  &--on { border-color: rgba(139,92,246, 0.6); background: rgba(139,92,246, 0.1); .cp-ro-toggle-text { color: var(--color-purple); } }
}
.cp-ro-toggle-text { font-size: 11px; color: var(--text-muted); font-weight: 600; }

/* 弹窗 */
.cp-modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.7);
  display: flex; align-items: center; justify-content: center; z-index: 330;
}
.cp-modal {
  background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-default);
  padding: 18px; margin: 18px; width: 100%; max-width: 420px; max-height: 82vh;
  display: flex; flex-direction: column; gap: 12px; box-shadow: var(--shadow-card);
  &--wide { max-width: 480px; }
}
.cp-modal-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.cp-modal-label { font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; }

.cp-import-chars {
  max-height: 100px;
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
}
.cp-import-char {
  display: flex; align-items: center; gap: 10px; padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }
  &--active { background: rgba(var(--color-primary-rgb), 0.07); }
}
.cp-radio {
  width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0;
  border: 2px solid var(--border-default);
  &--on { border-color: var(--color-primary); background: var(--color-primary); box-shadow: inset 0 0 0 3px var(--bg-input); }
}
.cp-import-uuid { font-size: 12px; color: var(--text-primary); }

.cp-import-list {
  max-height: 220px; flex-shrink: 1;
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px;
}
.cp-import-item {
  display: flex; align-items: center; gap: 10px; padding: 9px 12px;
  border-bottom: 1px solid var(--border-subtle);
  &:last-child { border-bottom: none; }
  &:active { background: var(--bg-elevated); }
}
.cp-check {
  width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0;
  border: 1px solid var(--border-default); background: var(--bg-panel);
  display: flex; align-items: center; justify-content: center;
  &--on { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.12); }
}
.cp-check-mark { font-size: 11px; color: var(--color-primary); font-weight: 700; }
.cp-import-info { flex: 1; min-width: 0; }
.cp-import-name { display: block; font-size: 13px; color: var(--text-primary); font-weight: 600; }
.cp-import-data { display: block; font-size: 10px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px; }

.cp-modal-actions { display: flex; gap: 10px; }
.cp-modal-btn {
  flex: 1; height: 42px; display: flex; align-items: center; justify-content: center;
  border-radius: 10px; font-size: 14px; font-weight: 600;
  &--cancel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-secondary); }
  &--confirm { background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7)); color: var(--bg-base); }
}

/* 报告 */
.cp-report-summary { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
.cp-report-list { max-height: 300px; display: flex; flex-direction: column; }
.cp-report-item {
  padding: 8px 10px; margin-bottom: 6px; border-radius: 9px;
  border-left: 3px solid var(--border-default); background: var(--bg-input);
  &--pass, &--sent { border-left-color: var(--color-accent); }
  &--fail, &--error { border-left-color: var(--color-danger); }
  &--timeout { border-left-color: var(--color-warning); }
}
.cp-report-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cp-report-name { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.cp-report-result { font-size: 11px; font-weight: 700; }
.cp-result--pass, .cp-result--sent { color: var(--color-accent); }
.cp-result--fail, .cp-result--error { color: var(--color-danger); }
.cp-result--timeout { color: var(--color-warning); }
.cp-report-line { display: block; font-size: 10px; color: var(--text-muted); margin-top: 3px; word-break: break-all; }
.cp-report-reason { display: block; font-size: 10px; color: var(--color-danger); margin-top: 2px; }

.safe-bottom-spacer { height: calc(12px + env(safe-area-inset-bottom, 0px)); flex-shrink: 0; }

.mono { font-family: 'Courier New', monospace; }
</style>
