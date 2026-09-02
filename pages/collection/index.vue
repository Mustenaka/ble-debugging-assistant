<template>
  <view class="cd-page" :class="[appStore.themeClass, { 'cd-page--wide': isWideScreen }]" :style="appStore.cssVarsStyle">

    <LeftTabBar v-if="isWideScreen" current-path="/pages/device/index" />

    <view v-if="!col" class="cd-empty">
      <text class="cd-empty-icon">⬡</text>
      <text class="cd-empty-text">{{ t('collection.detail.notFound') }}</text>
    </view>

    <scroll-view v-else scroll-y class="cd-scroll" :class="{ 'cd-scroll--wide': isWideScreen }">

      <!-- 头部 -->
      <view class="cd-head">
        <view class="cd-head-row">
          <text class="cd-name">{{ col.name }}</text>
          <view class="cd-badge" :class="`cd-badge--${col.source}`"><text class="cd-badge-text">{{ sourceLabel(col) }}</text></view>
        </view>
        <text v-if="col.description" class="cd-desc">{{ col.description }}</text>
        <text class="cd-stats">{{ t('collection.stats', collectionStats(col)) }}</text>
        <view class="cd-actions">
          <view class="cd-act" @click="copyJson"><text class="cd-act-text">⎘ {{ t('collection.actionCopy') }}</text></view>
          <view class="cd-act" @click="shareJson"><text class="cd-act-text">⬆ {{ t('collection.actionShare') }}</text></view>
          <view v-if="!col.readonly" class="cd-act" @click="openEdit"><text class="cd-act-text">✎ {{ t('collection.actionEdit') }}</text></view>
          <view v-if="!col.readonly" class="cd-act cd-act--mock" @click="connectAsMock"><text class="cd-act-text cd-act-text--mock">▶ {{ t('collection.actionMock') }}</text></view>
          <view v-if="col.readonly" class="cd-act" @click="duplicate"><text class="cd-act-text">⧉ {{ t('collection.actionDuplicate') }}</text></view>
          <view v-if="!col.readonly" class="cd-act cd-act--danger" @click="confirmDelete"><text class="cd-act-text cd-act-text--danger">✕ {{ t('collection.actionDelete') }}</text></view>
        </view>
      </view>

      <!-- 指纹与拓扑 -->
      <view class="cd-section">
        <text class="cd-section-title">{{ t('collection.detail.topology') }}</text>
        <view class="cd-fp-row">
          <text class="cd-label">{{ t('collection.fingerprint') }}</text>
          <template v-if="col.fingerprint.serviceUUIDs.length">
            <view v-for="u in col.fingerprint.serviceUUIDs" :key="u" class="cd-chip"><text class="cd-chip-text mono">{{ shortUUID(u) }}</text></view>
          </template>
          <text v-else class="cd-muted">{{ t('collection.noFingerprint') }}</text>
        </view>
        <view v-if="col.fingerprint.namePattern" class="cd-fp-row">
          <text class="cd-label">{{ t('collection.namePattern') }}</text>
          <text class="cd-mono-val mono">{{ col.fingerprint.namePattern }}</text>
        </view>
        <view v-if="col.boundDeviceIds.length" class="cd-fp-row">
          <text class="cd-label">{{ t('collection.boundBadge') }}</text>
          <text class="cd-muted">{{ t('collection.boundDevices', { n: col.boundDeviceIds.length }) }}</text>
        </view>
        <view v-if="!col.topology.length" class="cd-placeholder"><text class="cd-muted">{{ t('collection.detail.noTopology') }}</text></view>
        <view v-for="svc in col.topology" :key="svc.uuid" class="cd-topo-svc">
          <view class="cd-topo-svc-hd">
            <text class="cd-topo-svc-name">{{ serviceName(svc.uuid) || shortUUID(svc.uuid) }}</text>
            <text class="cd-topo-uuid mono">{{ svc.uuid }}</text>
          </view>
          <view v-for="ch in svc.characteristics" :key="ch.uuid" class="cd-topo-char">
            <text class="cd-topo-char-name">├ {{ charName(svc.uuid, ch.uuid) || shortUUID(ch.uuid) }}</text>
            <view class="cd-props">
              <text v-for="p in ch.properties" :key="p" class="cd-prop">{{ p }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 变量 -->
      <view class="cd-section">
        <view class="cd-section-hd">
          <text class="cd-section-title">{ } {{ t('collection.detail.variables') }}</text>
          <view v-if="!col.readonly" class="cd-mini-btn" @click="varRows.push({ name: '', value: '', description: '' })"><text class="cd-mini-btn-text">＋ {{ t('command.addVar') }}</text></view>
        </view>
        <view v-if="!varRows.length" class="cd-placeholder"><text class="cd-muted">—</text></view>
        <view v-for="(v, i) in varRows" :key="i" class="cd-var-row">
          <input class="cd-input cd-input--name mono" :disabled="col.readonly" :value="v.name" :placeholder="t('command.varName')" placeholder-class="cd-ph" @input="v.name = evtValue($event)" />
          <input class="cd-input mono" :disabled="col.readonly" :value="v.value" :placeholder="t('command.varValue')" placeholder-class="cd-ph" @input="v.value = evtValue($event)" />
          <input class="cd-input cd-input--desc" :disabled="col.readonly" :value="v.description ?? ''" :placeholder="t('command.varDesc')" placeholder-class="cd-ph" @input="v.description = evtValue($event)" />
          <view v-if="!col.readonly" class="cd-del" @click="varRows.splice(i, 1)"><text class="cd-del-icon">✕</text></view>
        </view>
        <view v-if="!col.readonly && varRows.length" class="cd-save-btn" @click="saveVars"><text class="cd-save-text">{{ t('collection.detail.saveVars') }}</text></view>
      </view>

      <!-- 命令 -->
      <view class="cd-section">
        <text class="cd-section-title">⌘ {{ t('collection.detail.operations') }}</text>
        <view v-if="!charGroups.length" class="cd-placeholder"><text class="cd-muted">{{ t('collection.detail.noOperations') }}</text></view>
        <view v-for="g in charGroups" :key="g.key" class="cd-char-group">
          <view class="cd-char-hd">
            <text class="cd-char-name">{{ g.ch.name || shortUUID(g.ch.uuid) }}</text>
            <text class="cd-char-uuid mono">{{ shortUUID(g.ch.serviceUUID) }} / {{ shortUUID(g.ch.uuid) }}</text>
          </view>
          <view v-if="!g.ch.operations.length" class="cd-placeholder"><text class="cd-muted">{{ t('collection.detail.noOperations') }}</text></view>
          <view v-for="op in g.ch.operations" :key="op.id" class="cd-op" @click="editOp(g.ch, op)">
            <view class="cd-op-main">
              <view class="cd-op-head">
                <text class="cd-op-name">{{ op.name || op.operationId }}</text>
                <view class="cd-op-badge"><text class="cd-op-badge-text">{{ actionLabel(op) }}</text></view>
                <text v-if="op.operationId" class="cd-op-id mono">{{ op.operationId }}</text>
              </view>
              <text v-if="operationPayload(op)" class="cd-op-payload mono">{{ operationPayload(op) }}</text>
              <text v-if="op.description" class="cd-op-desc">{{ op.description }}</text>
            </view>
            <view v-if="!col.readonly" class="cd-del" @click.stop="deleteOp(g.ch, op)"><text class="cd-del-icon">✕</text></view>
          </view>
        </view>
      </view>

      <!-- 样例 -->
      <view class="cd-section">
        <text class="cd-section-title">⇄ {{ t('collection.detail.examples') }}</text>
        <view v-if="!col.examples.length" class="cd-placeholder"><text class="cd-muted">{{ t('collection.detail.noExamples') }}</text></view>
        <view v-for="ex in col.examples" :key="ex.id" class="cd-ex" @click="openExampleActions(ex)">
          <view class="cd-ex-head">
            <text class="cd-ex-name">{{ ex.name }}</text>
            <text v-for="tag in ex.tags ?? []" :key="tag" class="cd-ex-tag" :class="`cd-ex-tag--${tag}`">{{ tag }}</text>
          </view>
          <text class="cd-ex-ep mono">{{ shortUUID(ex.serviceUUID) }} / {{ shortUUID(ex.characteristicUUID) }}{{ ex.operationId ? ` · ${ex.operationId}` : '' }}</text>
          <view v-if="ex.request?.hex" class="cd-ex-line"><text class="cd-ex-dir cd-ex-dir--tx">TX</text><text class="cd-ex-hex mono">{{ ex.request.hex }}</text></view>
          <view class="cd-ex-line">
            <text class="cd-ex-dir cd-ex-dir--rx">RX</text>
            <text v-if="ex.response?.hex" class="cd-ex-hex mono">{{ ex.response.hex }}{{ ex.response.rttMs != null ? ` · ${ex.response.rttMs}ms` : '' }}</text>
            <text v-else class="cd-muted">{{ t('collection.detail.noResponse') }}</text>
          </view>
          <text v-if="ex.note" class="cd-ex-note">{{ ex.note }}</text>
        </view>
      </view>

      <view class="cd-bottom-spacer" />
    </scroll-view>

    <!-- 命令编辑（不落设备，直接写回集合） -->
    <OperationEditor
      :visible="showOpEditor"
      :device-id="editorDeviceId"
      device-name=""
      :serviceUUID="opTarget.serviceUUID"
      :charUUID="opTarget.charUUID"
      lock-target
      :persist="false"
      :initial="opTarget.initial"
      @close="showOpEditor = false"
      @saved="onOpSaved"
    />

    <!-- 编辑集合信息 -->
    <view v-if="showEdit" class="cd-overlay" @click="showEdit = false">
      <view class="cd-sheet" @click.stop>
        <text class="cd-sheet-title">{{ t('collection.editTitle') }}</text>
        <view class="cd-field">
          <text class="cd-label">{{ t('collection.nameLabel') }}</text>
          <input class="cd-input cd-input--full" :value="form.name" placeholder-class="cd-ph" maxlength="40" @input="form.name = evtValue($event)" />
        </view>
        <view class="cd-field">
          <text class="cd-label">{{ t('collection.descLabel') }}</text>
          <input class="cd-input cd-input--full" :value="form.description" :placeholder="t('collection.descPlaceholder')" placeholder-class="cd-ph" maxlength="120" @input="form.description = evtValue($event)" />
        </view>
        <view class="cd-field">
          <text class="cd-label">{{ t('collection.namePattern') }}</text>
          <input class="cd-input cd-input--full mono" :value="form.namePattern" :placeholder="t('collection.namePatternPlaceholder')" placeholder-class="cd-ph" maxlength="60" @input="form.namePattern = evtValue($event)" />
        </view>
        <view class="cd-sheet-actions">
          <view class="cd-sheet-btn cd-sheet-btn--cancel" @click="showEdit = false"><text>{{ t('common.cancel') }}</text></view>
          <view class="cd-sheet-btn cd-sheet-btn--save" @click="saveEdit"><text>{{ t('common.save') }}</text></view>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '../../store/appStore'
import { useBleStore } from '../../store/bleStore'
import { useCollectionStore } from '../../store/collectionStore'
import { useI18n } from '../../composables/useI18n'
import { useResponsive } from '../../composables/useResponsive'
import { shortUUID, normalizeUUID } from '../../utils/hex'
import { saveLogsToFile, shareFileWithSystem, buildDeviceReportFilename } from '../../utils/buffer'
import {
  collectionStats,
  operationPayload,
  upsertOperationInCollection,
  type BleCollection,
  type CharAnnotation,
  type OperationAnnotation,
  type BleExample,
  type CollectionVariable,
} from '../../utils/collection'
import { buildMockSpecFromCollection } from '../../services/mockBle'
import { bleManager } from '../../services/bleManager'
import LeftTabBar from '../../components/LeftTabBar.vue'
import OperationEditor from '../../components/OperationEditor.vue'

const appStore = useAppStore()
const bleStore = useBleStore()
const collectionStore = useCollectionStore()
collectionStore.init()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const collectionId = ref('')
const col = computed<BleCollection | null>(() => {
  void collectionStore.version
  return collectionId.value ? collectionStore.get(collectionId.value) : null
})

onLoad((query: any) => {
  collectionId.value = query?.id ? decodeURIComponent(query.id) : ''
})
onShow(() => collectionStore.refresh())
onMounted(() => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('collection.detail.pageTitle') })
})

function evtValue(e: any): string {
  return String(e?.detail?.value ?? '')
}

function sourceLabel(c: BleCollection): string {
  if (c.source === 'builtin') return t('collection.builtinBadge')
  if (c.source === 'import') return t('collection.importBadge')
  return t('collection.userBadge')
}

function serviceName(uuid: string): string {
  return col.value?.services[normalizeUUID(uuid)]?.name ?? ''
}

function charName(svc: string, chr: string): string {
  return col.value?.characteristics[`${normalizeUUID(svc)}::${normalizeUUID(chr)}`]?.name ?? ''
}

function actionLabel(op: OperationAnnotation): string {
  const request = (op.request ?? '').trim().toUpperCase()
  if (!op.actionType && request === 'NONE') return 'EVENT'
  const a = op.actionType ?? (request === 'READ' ? 'read' : 'write')
  return a === 'read' ? 'READ' : a === 'writeNoResponse' ? 'W-NR' : 'WRITE'
}

/** 编辑器需要一个 deviceId 来解析变量：优先已绑定设备，其次当前会话 */
const editorDeviceId = computed(() => col.value?.boundDeviceIds[0] ?? bleStore.activeSessionId ?? '')

// ── 头部动作 ────────────────────────────────────────────────────────────────

function copyJson() {
  if (!col.value) return
  uni.setClipboardData({ data: collectionStore.serialize(col.value), success: () => uni.showToast({ title: t('collection.copied'), icon: 'none' }) })
}

async function shareJson() {
  if (!col.value) return
  try {
    const content = collectionStore.serialize(col.value)
    const filename = buildDeviceReportFilename(col.value.name, 'json').replace('BLE_DeviceReport_', 'BLE_Collection_')
    const path = await saveLogsToFile(content, filename, 'application/json')
    const shared = await shareFileWithSystem(path, 'application/json', col.value.name)
    if (!shared) uni.showModal({ title: t('collection.shared'), content: path, showCancel: false, confirmText: t('common.ok') })
  } catch {
    uni.showToast({ title: t('collection.shareFailed'), icon: 'none' })
  }
}

function duplicate() {
  if (!col.value) return
  const copy = collectionStore.duplicate(col.value, col.value.name)
  uni.showToast({ title: t('collection.duplicated'), icon: 'none' })
  uni.redirectTo({ url: `/pages/collection/index?id=${encodeURIComponent(copy.id)}` })
}

function confirmDelete() {
  const c = col.value
  if (!c) return
  uni.showModal({
    title: t('collection.actionDelete'),
    content: t('collection.deleteConfirm', { name: c.name }),
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) {
        collectionStore.remove(c.id)
        uni.showToast({ title: t('collection.deleted'), icon: 'none' })
        uni.navigateBack()
      }
    },
  })
}

async function connectAsMock() {
  const c = col.value
  if (!c) return
  if (!buildMockSpecFromCollection(c)) {
    uni.showToast({ title: t('collection.mockUnavailable'), icon: 'none', duration: 3000 }); return
  }
  appStore.setMockMode(true)
  const device = bleManager.getMockDevice(`mock:${c.id}`)
  if (!device) { uni.showToast({ title: t('collection.mockUnavailable'), icon: 'none', duration: 3000 }); return }
  if (bleStore.sessions.has(device.deviceId)) {
    bleStore.switchSession(device.deviceId)
    uni.switchTab({ url: '/pages/debug/index' })
    return
  }
  uni.showLoading({ title: t('collection.mockConnecting'), mask: true })
  try {
    await bleStore.connectDevice(device)
    uni.hideLoading()
    uni.switchTab({ url: '/pages/debug/index' })
  } catch (e: any) {
    uni.hideLoading()
    uni.showToast({ title: e?.message ?? t('scan.connectFailed'), icon: 'none' })
  }
}

// ── 编辑信息 ────────────────────────────────────────────────────────────────

const showEdit = ref(false)
const form = reactive({ name: '', description: '', namePattern: '' })

function openEdit() {
  const c = col.value
  if (!c) return
  form.name = c.name
  form.description = c.description ?? ''
  form.namePattern = c.fingerprint.namePattern ?? ''
  showEdit.value = true
}

function saveEdit() {
  const c = col.value
  if (!c) return
  c.name = form.name.trim() || c.name
  c.description = form.description.trim() || undefined
  c.fingerprint.namePattern = form.namePattern.trim() || undefined
  collectionStore.save(c)
  showEdit.value = false
  uni.setNavigationBarTitle({ title: t('collection.detail.pageTitle') })
}

// ── 变量 ────────────────────────────────────────────────────────────────────

const varRows = ref<CollectionVariable[]>([])
watch(() => col.value?.id, () => {
  varRows.value = (col.value?.variables ?? []).map((v) => ({ ...v }))
}, { immediate: true })

function saveVars() {
  const c = col.value
  if (!c) return
  collectionStore.setVariables(c.id, varRows.value.filter((v) => v.name.trim()))
  varRows.value = (collectionStore.get(c.id)?.variables ?? []).map((v) => ({ ...v }))
  uni.showToast({ title: t('command.varsSaved'), icon: 'success', duration: 1200 })
}

// ── 命令 ────────────────────────────────────────────────────────────────────

const charGroups = computed(() => {
  const c = col.value
  if (!c) return []
  return Object.entries(c.characteristics).map(([key, ch]) => ({ key, ch }))
})

const showOpEditor = ref(false)
const opTarget = ref<{ serviceUUID: string; charUUID: string; initial: OperationAnnotation | null }>({ serviceUUID: '', charUUID: '', initial: null })

function editOp(ch: CharAnnotation, op: OperationAnnotation) {
  if (col.value?.readonly) return
  opTarget.value = { serviceUUID: ch.serviceUUID, charUUID: ch.uuid, initial: JSON.parse(JSON.stringify(op)) }
  showOpEditor.value = true
}

function onOpSaved(op: OperationAnnotation, serviceUUID: string, charUUID: string) {
  const c = col.value
  if (!c) return
  upsertOperationInCollection(c, serviceUUID, charUUID, op)
  collectionStore.save(c)
  showOpEditor.value = false
  uni.showToast({ title: t('command.saved'), icon: 'success', duration: 1200 })
}

function deleteOp(ch: CharAnnotation, op: OperationAnnotation) {
  const c = col.value
  if (!c) return
  uni.showModal({
    title: t('collection.detail.deleteOp'),
    content: t('command.deleteConfirm'),
    confirmColor: '#DC2626',
    success: (res) => {
      if (!res.confirm) return
      ch.operations = ch.operations.filter((o) => o.id !== op.id)
      ch.updatedAt = Date.now()
      collectionStore.save(c)
    },
  })
}

// ── 样例 ────────────────────────────────────────────────────────────────────

function promptText(title: string, current: string, done: (text: string) => void) {
  ;(uni.showModal as any)({
    title,
    editable: true,
    placeholderText: current,
    content: current,
    success: (res: any) => {
      if (!res.confirm) return
      const text = typeof res.content === 'string' ? res.content.trim() : current
      done(text)
    },
  })
}

function openExampleActions(ex: BleExample) {
  const c = col.value
  if (!c || c.readonly) return
  const actions: { label: string; run: () => void }[] = [
    { label: t('collection.detail.rename'), run: () => promptText(t('collection.detail.rename'), ex.name, (text) => { if (text) { ex.name = text; collectionStore.save(c) } }) },
    { label: t('collection.detail.editNote'), run: () => promptText(t('collection.detail.editNote'), ex.note ?? '', (text) => { ex.note = text || undefined; collectionStore.save(c) }) },
    { label: t('collection.detail.deleteExample'), run: () => {
      uni.showModal({
        title: t('collection.detail.deleteExample'),
        content: t('collection.detail.deleteExampleConfirm'),
        confirmColor: '#DC2626',
        success: (res) => { if (res.confirm) collectionStore.removeExample(c.id, ex.id) },
      })
    } },
  ]
  uni.showActionSheet({ itemList: actions.map((a) => a.label), success: (res) => actions[res.tapIndex]?.run() })
}
</script>

<style lang="scss" scoped>
.cd-page { min-height: 100vh; background: var(--bg-base); display: flex; flex-direction: column; &--wide { padding-left: 60px; } }
.cd-scroll { flex: 1; padding: 12px; &--wide { padding: 16px 20px; max-width: 900px; } }
.cd-empty { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 60px 24px; }
.cd-empty-icon { font-size: 48px; color: var(--bg-elevated); }
.cd-empty-text { font-size: 13px; color: var(--text-dimmed); }

.cd-head { background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 14px; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
.cd-head-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.cd-name { font-size: 17px; font-weight: 700; color: var(--text-primary); }
.cd-badge { padding: 1px 6px; border-radius: 4px; background: var(--bg-elevated); border: 1px solid var(--border-subtle);
  &--builtin { border-color: rgba(var(--color-warning-rgb), 0.3); .cd-badge-text { color: var(--color-warning); } }
  &--import { .cd-badge-text { color: var(--color-info); } }
  &--user { .cd-badge-text { color: var(--text-secondary); } }
}
.cd-badge-text { font-size: 9px; font-weight: 700; }
.cd-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }
.cd-stats { font-size: 11px; color: var(--text-muted); }
.cd-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
.cd-act { padding: 6px 10px; border-radius: 8px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); &:active { opacity: 0.7; }
  &--mock { background: rgba(var(--color-warning-rgb), 0.08); border-color: rgba(var(--color-warning-rgb), 0.35); }
  &--danger { border-color: rgba(var(--color-danger-rgb), 0.25); }
}
.cd-act-text { font-size: 11px; font-weight: 600; color: var(--text-secondary); &--mock { color: var(--color-warning); } &--danger { color: var(--color-danger); } }

.cd-section { background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 14px; padding: 12px 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; }
.cd-section-hd { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.cd-section-title { font-size: 13px; font-weight: 700; color: var(--color-primary); letter-spacing: 0.4px; }
.cd-label { font-size: 9px; color: var(--text-dimmed); text-transform: uppercase; letter-spacing: 0.4px; }
.cd-muted { font-size: 11px; color: var(--text-dimmed); line-height: 1.5; }
.cd-placeholder { padding: 10px; background: var(--bg-input); border: 1px dashed var(--border-default); border-radius: 8px; }
.cd-fp-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cd-chip { padding: 1px 6px; border-radius: 4px; background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.2); }
.cd-chip-text { font-size: 9px; color: var(--color-accent); }
.cd-mono-val { font-size: 11px; color: var(--color-info); }

.cd-topo-svc { border-top: 1px solid var(--border-subtle); padding-top: 8px; display: flex; flex-direction: column; gap: 4px; }
.cd-topo-svc-hd { display: flex; flex-direction: column; gap: 1px; }
.cd-topo-svc-name { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.cd-topo-uuid { font-size: 9px; color: var(--text-dimmed); }
.cd-topo-char { display: flex; align-items: center; gap: 8px; padding-left: 6px; }
.cd-topo-char-name { font-size: 11px; color: var(--text-secondary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cd-props { display: flex; gap: 3px; flex-shrink: 0; }
.cd-prop { font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); }

.cd-mini-btn { padding: 4px 10px; border-radius: 6px; background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.25); &:active { opacity: 0.7; } }
.cd-mini-btn-text { font-size: 10px; color: var(--color-primary); font-weight: 700; }
.cd-var-row { display: flex; gap: 5px; align-items: center; }
.cd-input { flex: 1; min-width: 0; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 7px; padding: 6px 8px; font-size: 12px; color: var(--text-primary); min-height: 32px;
  &--name { flex: 0 0 82px; color: var(--color-primary); }
  &--desc { flex: 0 0 90px; font-size: 11px; }
  &--full { flex: none; width: 100%; min-height: 38px; }
}
.cd-ph { color: var(--text-dimmed); }
.cd-del { width: 24px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &:active { opacity: 0.6; } }
.cd-del-icon { font-size: 11px; color: var(--color-danger); }
.cd-save-btn { align-self: flex-end; padding: 7px 16px; border-radius: 8px; background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7)); &:active { opacity: 0.85; } }
.cd-save-text { font-size: 12px; font-weight: 700; color: var(--bg-base); }

.cd-char-group { border-top: 1px solid var(--border-subtle); padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.cd-char-hd { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; }
.cd-char-name { font-size: 12px; font-weight: 700; color: var(--color-accent); }
.cd-char-uuid { font-size: 9px; color: var(--text-dimmed); }
.cd-op { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px; &:active { background: var(--bg-elevated); } }
.cd-op-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.cd-op-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cd-op-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.cd-op-badge { padding: 0 5px; border-radius: 3px; background: rgba(var(--color-primary-rgb), 0.1); }
.cd-op-badge-text { font-size: 8px; font-weight: 700; color: var(--color-primary); }
.cd-op-id { font-size: 10px; color: var(--color-primary); }
.cd-op-payload { font-size: 11px; color: var(--text-mono); word-break: break-all; }
.cd-op-desc { font-size: 10px; color: var(--text-muted); }

.cd-ex { display: flex; flex-direction: column; gap: 3px; padding: 9px 10px; background: var(--bg-card); border: 1px solid var(--border-subtle); border-radius: 10px; &:active { background: var(--bg-elevated); } }
.cd-ex-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.cd-ex-name { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.cd-ex-tag { font-size: 8px; font-weight: 700; padding: 0 5px; border-radius: 3px; background: var(--bg-elevated); color: var(--text-muted);
  &--pass { color: var(--color-accent); } &--fail, &--error { color: var(--color-danger); } &--timeout { color: var(--color-warning); }
}
.cd-ex-ep { font-size: 9px; color: var(--text-dimmed); }
.cd-ex-line { display: flex; align-items: flex-start; gap: 6px; }
.cd-ex-dir { font-size: 9px; font-weight: 700; padding: 0 4px; border-radius: 3px; flex-shrink: 0; margin-top: 1px;
  &--tx { background: var(--badge-tx-bg); color: var(--badge-tx-color); } &--rx { background: var(--badge-rx-bg); color: var(--badge-rx-color); }
}
.cd-ex-hex { font-size: 11px; color: var(--text-mono); word-break: break-all; }
.cd-ex-note { font-size: 10px; color: var(--text-secondary); font-style: italic; }
.cd-bottom-spacer { height: calc(24px + env(safe-area-inset-bottom, 0px)); }

.cd-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 400; }
.cd-sheet { width: 100%; max-width: 420px; margin: 18px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 16px; padding: 18px; display: flex; flex-direction: column; gap: 12px; }
.cd-sheet-title { font-size: 15px; font-weight: 700; color: var(--text-primary); }
.cd-field { display: flex; flex-direction: column; gap: 5px; }
.cd-sheet-actions { display: flex; gap: 10px; }
.cd-sheet-btn { flex: 1; height: 42px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 14px; font-weight: 600;
  &--cancel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-secondary); }
  &--save { background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7)); color: var(--bg-base); }
}
.mono { font-family: 'Courier New', monospace; }
</style>
