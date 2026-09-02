<template>
  <view class="protocol-page" :class="[appStore.themeClass, { 'protocol-page--wide': isWideScreen }]" :style="appStore.cssVarsStyle">

    <!-- 宽屏左侧导航（以工作台为当前页） -->
    <LeftTabBar v-if="isWideScreen" current-path="/pages/device/index" />

    <scroll-view scroll-y class="plugin-scroll" :class="{ 'plugin-scroll--wide': isWideScreen }">

      <!-- 当前设备上下文 -->
      <view v-if="deviceIdParam" class="ctx-bar">
        <text class="ctx-label">{{ t('collection.currentDevice') }}</text>
        <text class="ctx-name">{{ deviceName || deviceIdParam }}</text>
        <text class="ctx-sep">·</text>
        <text class="ctx-label">{{ t('collection.matched') }}</text>
        <text class="ctx-col" :class="{ 'ctx-col--none': !matchedForDevice }">{{ matchedForDevice?.name ?? t('collection.none') }}</text>
      </view>

      <!-- ═══ 集合 ═══ -->
      <view class="section-hd">
        <view class="section-hd-left">
          <text class="section-title">⬡ {{ t('collection.sectionTitle') }}</text>
          <text class="section-hint">{{ t('collection.sectionHint') }}</text>
        </view>
        <view class="section-actions">
          <view class="sec-btn sec-btn--primary" @click="openImport">
            <text class="sec-btn-text sec-btn-text--primary">⇩ {{ t('collection.import') }}</text>
          </view>
          <view class="sec-btn" @click="createNew">
            <text class="sec-btn-text">＋ {{ t('collection.newCollection') }}</text>
          </view>
        </view>
      </view>

      <view v-if="!userCollections.length" class="empty-inline">
        <text class="empty-inline-text">{{ t('collection.noCollections') }}</text>
      </view>

      <view class="plugin-grid" :class="{ 'plugin-grid--wide': isWideScreen }">
        <view
          v-for="col in allCollections"
          :key="col.id"
          class="col-card"
          :class="{ 'col-card--matched': matchedForDevice?.id === col.id, 'col-card--builtin': col.readonly }"
          @click="openDetail(col)"
          @longpress="openCollectionActions(col)"
        >
          <view class="col-hd">
            <text class="col-name">{{ col.name }}</text>
            <view class="col-more" @click.stop="openCollectionActions(col)"><text class="col-more-text">⋯</text></view>
            <view class="col-badge" :class="`col-badge--${col.source}`">
              <text class="col-badge-text">{{ sourceLabel(col) }}</text>
            </view>
            <view v-if="matchedForDevice?.id === col.id" class="col-badge col-badge--matched">
              <text class="col-badge-text">{{ t('collection.matchedBadge') }}</text>
            </view>
            <view v-else-if="deviceIdParam && col.boundDeviceIds.includes(deviceIdParam)" class="col-badge col-badge--matched">
              <text class="col-badge-text">{{ t('collection.boundBadge') }}</text>
            </view>
          </view>
          <text v-if="col.description" class="col-desc">{{ col.description }}</text>
          <text class="col-stats">{{ statsText(col) }}</text>
          <view class="col-fp">
            <text class="col-fp-label">{{ t('collection.fingerprint') }}</text>
            <template v-if="col.fingerprint.serviceUUIDs.length">
              <view v-for="u in col.fingerprint.serviceUUIDs.slice(0, 4)" :key="u" class="fp-chip">
                <text class="fp-chip-text mono">{{ shortUUID(u) }}</text>
              </view>
              <text v-if="col.fingerprint.serviceUUIDs.length > 4" class="col-fp-more">+{{ col.fingerprint.serviceUUIDs.length - 4 }}</text>
            </template>
            <text v-else class="col-fp-none">{{ t('collection.noFingerprint') }}</text>
            <text v-if="col.fingerprint.namePattern" class="fp-name mono">name~{{ col.fingerprint.namePattern }}</text>
          </view>
          <text v-if="col.boundDeviceIds.length" class="col-bound">{{ t('collection.boundDevices', { n: col.boundDeviceIds.length }) }}</text>
        </view>
      </view>

      <!-- ═══ 解析插件 ═══ -->
      <view class="section-hd section-hd--plugins">
        <view class="section-hd-left">
          <text class="section-title">⌁ {{ t('collection.pluginsTitle') }}</text>
        </view>
        <view class="section-actions">
          <view class="sec-btn" @click="openAdd">
            <text class="sec-btn-text">＋ {{ t('protocol.addPlugin') }}</text>
          </view>
        </view>
      </view>

      <view v-if="!protocolStore.plugins.length" class="empty-inline">
        <text class="empty-inline-text">{{ t('protocol.noPlugins') }}</text>
      </view>

      <view class="plugin-grid" :class="{ 'plugin-grid--wide': isWideScreen }">
        <view
          v-for="plugin in protocolStore.plugins"
          :key="plugin.id"
          class="plugin-card"
          :class="{ 'plugin-card--enabled': plugin.enabled }"
        >
          <view class="plugin-hd">
            <view class="plugin-left">
              <view class="plugin-status" :class="plugin.enabled ? 'status--on' : 'status--off'" />
              <text class="plugin-name">{{ plugin.name }}</text>
              <view v-if="plugin.enabled" class="enabled-badge">
                <text class="enabled-text">{{ t('protocol.running') }}</text>
              </view>
            </view>
            <view class="plugin-actions">
              <view
                class="action-btn"
                :class="plugin.enabled ? 'action-btn--disable' : 'action-btn--enable'"
                @click="toggleEnable(plugin)"
              >
                <text class="action-text">{{ plugin.enabled ? t('protocol.disable') : t('protocol.enable') }}</text>
              </view>
              <view class="action-btn action-btn--edit" @click="openEdit(plugin)">
                <text class="action-text">✎</text>
              </view>
              <view class="action-btn action-btn--delete" @click="handleDelete(plugin.id)">
                <text class="action-text danger">✕</text>
              </view>
            </view>
          </view>
          <view class="code-preview">
            <text class="code-text">{{ codePreview(plugin.code) }}</text>
          </view>
        </view>
      </view>
      <view class="safe-area-bottom" />
    </scroll-view>

    <!-- 插件编辑弹窗 -->
    <view v-if="showEditor" class="editor-overlay" @click="closeEditor">
      <view
        class="editor-sheet"
        :class="[appStore.themeClass, { 'sheet--visible': showEditor }]"
        :style="appStore.cssVarsStyle"
        @click.stop
      >
        <view class="sheet-handle" />
        <view class="editor-header">
          <text class="editor-title">{{ editingPlugin ? t('protocol.editPlugin') : t('protocol.addPlugin') }}</text>
          <view class="editor-close" @click="closeEditor">
            <text class="editor-close-icon">✕</text>
          </view>
        </view>
        <view class="field-group">
          <text class="field-label">{{ t('protocol.pluginName') }}</text>
          <input class="field-input" :value="editorName" :placeholder="t('protocol.namePlaceholder')" placeholder-class="field-ph" maxlength="30" @input="editorName = evtValue($event)" />
        </view>
        <view class="field-group">
          <view class="code-label-row">
            <text class="field-label">{{ t('protocol.pluginCode') }}</text>
            <text class="code-tip">{{ t('protocol.codeTip') }}</text>
          </view>
          <textarea class="code-editor" v-model="editorCode" :placeholder="t('protocol.codePlaceholder')" placeholder-class="field-ph" :auto-height="false" />
        </view>
        <view class="enable-row">
          <text class="enable-label">{{ t('protocol.enable') }}</text>
          <view class="toggle-switch" :class="{ 'toggle-switch--on': editorEnabled }" @click="editorEnabled = !editorEnabled">
            <view class="toggle-thumb" />
          </view>
        </view>
        <view class="editor-actions">
          <view class="editor-btn editor-btn--cancel" @click="closeEditor"><text>{{ t('common.cancel') }}</text></view>
          <view class="editor-btn editor-btn--save" @click="handleSave"><text>{{ t('protocol.save') }}</text></view>
        </view>
        <view class="safe-area-bottom" />
      </view>
    </view>

    <!-- 导入集合弹窗 -->
    <view v-if="showImport" class="editor-overlay" @click="showImport = false">
      <view class="editor-sheet" :class="[appStore.themeClass, { 'sheet--visible': showImport }]" :style="appStore.cssVarsStyle" @click.stop>
        <view class="sheet-handle" />
        <view class="editor-header">
          <text class="editor-title">{{ t('collection.importTitle') }}</text>
          <view class="editor-close" @click="showImport = false"><text class="editor-close-icon">✕</text></view>
        </view>

        <view class="field-group">
          <text class="code-tip">{{ t('collection.importHint') }}</text>
          <textarea class="code-editor code-editor--import" v-model="importText" placeholder='{ "kind": "ble-collection", ... }' placeholder-class="field-ph" :auto-height="false" :adjust-position="true" cursor-spacing="24" @input="importPreview = null" />
          <view class="import-tools">
            <view class="sec-btn" @click="readClipboard"><text class="sec-btn-text">⎘ {{ t('collection.pasteFromClipboard') }}</text></view>
            <view v-if="pickerSupported" class="sec-btn" @click="chooseFile"><text class="sec-btn-text">📄 {{ t('collection.chooseFile') }}</text></view>
            <view class="sec-btn sec-btn--primary" @click="parseImport"><text class="sec-btn-text sec-btn-text--primary">{{ t('collection.parse') }}</text></view>
          </view>
          <text v-if="importLabel" class="code-tip">{{ t('collection.importFrom', { name: importLabel }) }}</text>
        </view>

        <view v-if="importPreview" class="field-group">
          <view class="preview-card">
            <view class="preview-hd">
              <text class="preview-kind">{{ t(`collection.previewKind.${importPreview.kind}`) }}</text>
              <text class="preview-name">{{ importPreview.collection.name }}</text>
            </view>
            <text class="preview-stats">{{ previewStatsText(importPreview) }}</text>
            <text v-if="importPreview.warnings.includes('empty')" class="preview-warn">⚠ {{ t('collection.emptyWarning') }}</text>
          </view>

          <view class="radio-row" @click="importMode = 'new'">
            <view class="radio" :class="{ 'radio--on': importMode === 'new' }" />
            <text class="radio-text">{{ t('collection.modeNew') }}</text>
          </view>
          <view class="radio-row" :class="{ 'radio-row--disabled': !userCollections.length }" @click="userCollections.length && (importMode = 'merge')">
            <view class="radio" :class="{ 'radio--on': importMode === 'merge' }" />
            <text class="radio-text">{{ t('collection.modeMerge') }}</text>
          </view>
          <template v-if="importMode === 'merge'">
            <text class="field-label">{{ t('collection.mergeTarget') }}</text>
            <scroll-view scroll-y class="target-list">
              <view v-for="col in userCollections" :key="col.id" class="target-item" :class="{ 'target-item--active': mergeTargetId === col.id }" @click="mergeTargetId = col.id">
                <view class="radio" :class="{ 'radio--on': mergeTargetId === col.id }" />
                <text class="target-name">{{ col.name }}</text>
                <text class="target-stats">{{ statsText(col) }}</text>
              </view>
            </scroll-view>
            <view class="chips">
              <view class="chip" :class="{ 'chip--active': mergeStrategy === 'keep-existing' }" @click="mergeStrategy = 'keep-existing'"><text class="chip-text">{{ t('collection.strategyKeep') }}</text></view>
              <view class="chip" :class="{ 'chip--active': mergeStrategy === 'overwrite' }" @click="mergeStrategy = 'overwrite'"><text class="chip-text">{{ t('collection.strategyOverwrite') }}</text></view>
            </view>
          </template>
          <view v-if="deviceIdParam" class="radio-row" @click="bindAfterImport = !bindAfterImport">
            <view class="checkbox" :class="{ 'checkbox--on': bindAfterImport }"><text v-if="bindAfterImport" class="checkbox-mark">✓</text></view>
            <text class="radio-text">{{ t('collection.bindCurrent') }}</text>
          </view>
        </view>

        <view class="editor-actions">
          <view class="editor-btn editor-btn--cancel" @click="showImport = false"><text>{{ t('common.cancel') }}</text></view>
          <view class="editor-btn editor-btn--save" :class="{ 'editor-btn--disabled': !importPreview }" @click="confirmImport"><text>{{ t('collection.confirmImport') }}</text></view>
        </view>
        <view class="safe-area-bottom" />
      </view>
    </view>

    <!-- 编辑集合信息 -->
    <view v-if="showColEditor" class="editor-overlay" @click="showColEditor = false">
      <view class="editor-sheet" :class="[appStore.themeClass, { 'sheet--visible': showColEditor }]" :style="appStore.cssVarsStyle" @click.stop>
        <view class="sheet-handle" />
        <view class="editor-header">
          <text class="editor-title">{{ t('collection.editTitle') }}</text>
          <view class="editor-close" @click="showColEditor = false"><text class="editor-close-icon">✕</text></view>
        </view>
        <view class="field-group">
          <text class="field-label">{{ t('collection.nameLabel') }}</text>
          <input class="field-input" :value="colForm.name" placeholder-class="field-ph" maxlength="40" @input="colForm.name = evtValue($event)" />
        </view>
        <view class="field-group">
          <text class="field-label">{{ t('collection.descLabel') }}</text>
          <input class="field-input" :value="colForm.description" :placeholder="t('collection.descPlaceholder')" placeholder-class="field-ph" maxlength="120" @input="colForm.description = evtValue($event)" />
        </view>
        <view class="field-group">
          <text class="field-label">{{ t('collection.namePattern') }}</text>
          <input class="field-input mono" :value="colForm.namePattern" :placeholder="t('collection.namePatternPlaceholder')" placeholder-class="field-ph" maxlength="60" @input="colForm.namePattern = evtValue($event)" />
        </view>
        <view class="editor-actions">
          <view class="editor-btn editor-btn--cancel" @click="showColEditor = false"><text>{{ t('common.cancel') }}</text></view>
          <view class="editor-btn editor-btn--save" @click="saveColEdit"><text>{{ t('common.save') }}</text></view>
        </view>
        <view class="safe-area-bottom" />
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useAppStore } from '../../store/appStore'
import { useBleStore } from '../../store/bleStore'
import { useProtocolStore, type ProtocolPlugin } from '../../store/protocolStore'
import { useCollectionStore } from '../../store/collectionStore'
import { useI18n } from '../../composables/useI18n'
import { useResponsive } from '../../composables/useResponsive'
import { shortUUID } from '../../utils/hex'
import { saveLogsToFile, shareFileWithSystem, buildDeviceReportFilename } from '../../utils/buffer'
import { getDeviceContext, collectionStats, type BleCollection, type ImportPreview, type MergeStrategy } from '../../utils/collection'
import { buildMockSpecFromCollection } from '../../services/mockBle'
import { bleManager } from '../../services/bleManager'
import { pickImportFile, resolveImportSource, isImportPickerSupported } from '../../utils/importFile'
import LeftTabBar from '../../components/LeftTabBar.vue'

const appStore = useAppStore()
const bleStore = useBleStore()
const protocolStore = useProtocolStore()
const collectionStore = useCollectionStore()
collectionStore.init()
const { t } = useI18n()
const { isWideScreen } = useResponsive()

const deviceIdParam = ref('')

onLoad((query: any) => {
  deviceIdParam.value = query?.deviceId ? decodeURIComponent(query.deviceId) : ''
})

onShow(() => {
  collectionStore.refresh()
})

onMounted(() => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('protocol.pageTitle') })
})

// ── 集合列表 ────────────────────────────────────────────────────────────────

const deviceName = computed(() =>
  bleStore.sessions.get(deviceIdParam.value)?.device.name ?? getDeviceContext(deviceIdParam.value)?.name ?? '',
)
const matchedForDevice = computed(() => (deviceIdParam.value ? collectionStore.forDevice(deviceIdParam.value) : null))
const userCollections = computed(() => collectionStore.collections)
const allCollections = computed(() => [...collectionStore.collections, ...collectionStore.builtinCollections])

function sourceLabel(col: BleCollection): string {
  if (col.source === 'builtin') return t('collection.builtinBadge')
  if (col.source === 'import') return t('collection.importBadge')
  return t('collection.userBadge')
}

function statsText(col: BleCollection): string {
  return t('collection.stats', collectionStats(col))
}

function previewStatsText(p: ImportPreview): string {
  return t('collection.previewStats', {
    services: p.serviceCount, chars: p.charCount, ops: p.opCount, examples: p.exampleCount, variables: p.variableCount,
  })
}

function createNew() {
  const col = collectionStore.create(t('collection.newDefaultName'))
  openColEdit(col)
}

function evtValue(e: any): string {
  return String(e?.detail?.value ?? '')
}

function openDetail(col: BleCollection) {
  uni.navigateTo({ url: `/pages/collection/index?id=${encodeURIComponent(col.id)}` })
}

function openCollectionActions(col: BleCollection) {
  const items: { label: string; run: () => void }[] = []
  items.push({ label: t('collection.actionCopy'), run: () => copyJson(col) })
  items.push({ label: t('collection.actionShare'), run: () => shareJson(col) })
  if (deviceIdParam.value && !col.readonly) {
    if (col.boundDeviceIds.includes(deviceIdParam.value)) {
      items.push({ label: t('collection.actionUnbind'), run: () => { collectionStore.unbind(deviceIdParam.value); uni.showToast({ title: t('collection.unbound'), icon: 'none' }) } })
    } else {
      items.push({ label: t('collection.actionBind'), run: () => { collectionStore.bind(deviceIdParam.value, col.id); uni.showToast({ title: t('collection.bound'), icon: 'none' }) } })
    }
  }
  if (!col.readonly) {
    items.push({ label: t('collection.actionMock'), run: () => connectAsMock(col) })
  }
  if (col.readonly) {
    items.push({ label: t('collection.actionDuplicate'), run: () => { collectionStore.duplicate(col, col.name); uni.showToast({ title: t('collection.duplicated'), icon: 'none' }) } })
  } else {
    items.push({ label: t('collection.actionEdit'), run: () => openColEdit(col) })
    items.push({ label: t('collection.actionDuplicate'), run: () => { collectionStore.duplicate(col); uni.showToast({ title: t('collection.duplicated'), icon: 'none' }) } })
    items.push({ label: t('collection.actionDelete'), run: () => confirmDelete(col) })
  }
  uni.showActionSheet({
    itemList: items.map((i) => i.label),
    success: (res) => items[res.tapIndex]?.run(),
  })
}

function copyJson(col: BleCollection) {
  uni.setClipboardData({
    data: collectionStore.serialize(col),
    success: () => uni.showToast({ title: t('collection.copied'), icon: 'none' }),
  })
}

async function shareJson(col: BleCollection) {
  try {
    const content = collectionStore.serialize(col)
    const filename = buildDeviceReportFilename(col.name, 'json').replace('BLE_DeviceReport_', 'BLE_Collection_')
    const path = await saveLogsToFile(content, filename, 'application/json')
    const shared = await shareFileWithSystem(path, 'application/json', col.name)
    if (!shared) {
      uni.showModal({ title: t('collection.shared'), content: path, showCancel: false, confirmText: t('common.ok') })
    }
  } catch {
    uni.showToast({ title: t('collection.shareFailed'), icon: 'none' })
  }
}

/** 无硬件：把集合变成一台 Mock 设备直接连接 */
async function connectAsMock(col: BleCollection) {
  if (!buildMockSpecFromCollection(col)) {
    uni.showToast({ title: t('collection.mockUnavailable'), icon: 'none', duration: 3000 })
    return
  }
  appStore.setMockMode(true)
  const device = bleManager.getMockDevice(`mock:${col.id}`)
  if (!device) {
    uni.showToast({ title: t('collection.mockUnavailable'), icon: 'none', duration: 3000 })
    return
  }
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

function confirmDelete(col: BleCollection) {
  uni.showModal({
    title: t('collection.actionDelete'),
    content: t('collection.deleteConfirm', { name: col.name }),
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) {
        collectionStore.remove(col.id)
        uni.showToast({ title: t('collection.deleted'), icon: 'none' })
      }
    },
  })
}

// ── 编辑集合信息 ────────────────────────────────────────────────────────────

const showColEditor = ref(false)
const colForm = reactive({ id: '', name: '', description: '', namePattern: '' })

function openColEdit(col: BleCollection) {
  colForm.id = col.id
  colForm.name = col.name
  colForm.description = col.description ?? ''
  colForm.namePattern = col.fingerprint.namePattern ?? ''
  showColEditor.value = true
}

function saveColEdit() {
  const col = collectionStore.get(colForm.id)
  if (!col) { showColEditor.value = false; return }
  col.name = colForm.name.trim() || col.name
  col.description = colForm.description.trim() || undefined
  col.fingerprint.namePattern = colForm.namePattern.trim() || undefined
  collectionStore.save(col)
  showColEditor.value = false
  uni.showToast({ title: t('common.save'), icon: 'success', duration: 1000 })
}

// ── 导入 ────────────────────────────────────────────────────────────────────

const showImport = ref(false)
const importText = ref('')
const importLabel = ref('')
const importPreview = ref<ImportPreview | null>(null)
const importMode = ref<'new' | 'merge'>('new')
const mergeTargetId = ref('')
const mergeStrategy = ref<MergeStrategy>('keep-existing')
const bindAfterImport = ref(true)
const pickerSupported = isImportPickerSupported()

function openImport() {
  importText.value = ''
  importLabel.value = ''
  importPreview.value = null
  importMode.value = 'new'
  mergeTargetId.value = matchedForDevice.value?.id ?? userCollections.value[0]?.id ?? ''
  mergeStrategy.value = 'keep-existing'
  bindAfterImport.value = !!deviceIdParam.value
  showImport.value = true
}

function readClipboard() {
  uni.getClipboardData({
    success: (res: any) => {
      importText.value = String(res.data ?? '')
      importLabel.value = ''
      importPreview.value = null
      if (importText.value.trim()) parseImport()
    },
  })
}

/** 选择 json / zip 文件（H5 与 Android；zip 自动取出 collection.json / protocol.json） */
async function chooseFile() {
  const file = await pickImportFile()
  if (!file) {
    uni.showToast({ title: t('collection.pickFailed'), icon: 'none' })
    return
  }
  try {
    const src = await resolveImportSource(file)
    importText.value = src.text
    importLabel.value = src.label
    importPreview.value = null
    parseImport()
  } catch (e: any) {
    const msg = e?.message === 'zip-no-json'
      ? t('collection.zipNoJson')
      : e?.message === 'deflate-unsupported'
        ? t('collection.zipUnsupported')
        : t('collection.pickFailed')
    uni.showToast({ title: msg, icon: 'none', duration: 3000 })
  }
}

function parseImport() {
  try {
    importPreview.value = collectionStore.parseImport(importText.value)
    if (importMode.value === 'merge' && !mergeTargetId.value) importMode.value = 'new'
  } catch (e: any) {
    importPreview.value = null
    const reason = e?.message === 'invalid-json' ? t('collection.reasonInvalidJson') : t('collection.reasonUnknownFormat')
    uni.showToast({ title: t('collection.parseFailed', { reason }), icon: 'none', duration: 2500 })
  }
}

function confirmImport() {
  const preview = importPreview.value
  if (!preview) return
  const col = collectionStore.applyImport(preview, {
    mode: importMode.value,
    targetId: importMode.value === 'merge' ? mergeTargetId.value : undefined,
    strategy: mergeStrategy.value,
    bindDeviceId: bindAfterImport.value && deviceIdParam.value ? deviceIdParam.value : undefined,
  })
  showImport.value = false
  uni.showToast({ title: t('collection.imported', { name: col.name }), icon: 'success', duration: 1800 })
}

// ── 插件 ────────────────────────────────────────────────────────────────────

const showEditor = ref(false)
const editingPlugin = ref<ProtocolPlugin | null>(null)
const editorName = ref('')
const editorCode = ref('')
const editorEnabled = ref(false)

function codePreview(code: string): string {
  const line = code.trim().split('\n')[0]
  return line.length > 60 ? line.slice(0, 57) + '...' : line
}

function openAdd() {
  editingPlugin.value = null
  editorName.value = ''
  editorCode.value = t('protocol.codePlaceholder')
  editorEnabled.value = false
  showEditor.value = true
}

function openEdit(plugin: ProtocolPlugin) {
  editingPlugin.value = plugin
  editorName.value = plugin.name
  editorCode.value = plugin.code
  editorEnabled.value = plugin.enabled
  showEditor.value = true
}

function closeEditor() {
  showEditor.value = false
}

function handleSave() {
  if (!editorName.value.trim()) {
    uni.showToast({ title: t('protocol.namePlaceholder'), icon: 'none' })
    return
  }
  if (!editorCode.value.trim()) {
    uni.showToast({ title: t('protocol.pluginCode'), icon: 'none' })
    return
  }
  if (editingPlugin.value) {
    protocolStore.updatePlugin(editingPlugin.value.id, {
      name: editorName.value.trim(),
      code: editorCode.value.trim(),
      enabled: editorEnabled.value,
    })
  } else {
    protocolStore.addPlugin({
      name: editorName.value.trim(),
      code: editorCode.value.trim(),
      enabled: editorEnabled.value,
    })
  }
  closeEditor()
  uni.showToast({ title: t('common.save'), icon: 'success', duration: 1000 })
}

function toggleEnable(plugin: ProtocolPlugin) {
  protocolStore.updatePlugin(plugin.id, { enabled: !plugin.enabled })
}

function handleDelete(id: string) {
  uni.showModal({
    title: t('protocol.delete'),
    content: t('protocol.deleteConfirm'),
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) protocolStore.removePlugin(id)
    },
  })
}
</script>

<style lang="scss" scoped>
.protocol-page {
  min-height: 100vh;
  background: var(--bg-base);
  display: flex;
  flex-direction: column;
  &--wide { padding-left: 60px; }
}

.plugin-scroll {
  flex: 1;
  padding: 12px;
  &--wide { padding: 16px 20px; }
}

/* ── 当前设备上下文 ── */
.ctx-bar {
  display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  padding: 8px 12px; margin-bottom: 12px;
  background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 10px;
}
.ctx-label { font-size: 10px; color: var(--text-dimmed); text-transform: uppercase; letter-spacing: 0.4px; }
.ctx-name { font-size: 12px; color: var(--text-primary); font-weight: 700; }
.ctx-sep { font-size: 12px; color: var(--text-dimmed); }
.ctx-col { font-size: 12px; color: var(--color-primary); font-weight: 700; &--none { color: var(--text-muted); font-weight: 500; } }

/* ── 分区标题 ── */
.section-hd {
  display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;
  margin-bottom: 10px;
  &--plugins { margin-top: 18px; }
}
.section-hd-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.section-title { font-size: 14px; font-weight: 700; color: var(--color-primary); letter-spacing: 0.4px; }
.section-hint { font-size: 10px; color: var(--text-muted); line-height: 1.5; }
.section-actions { display: flex; gap: 6px; flex-shrink: 0; }
.sec-btn {
  height: 30px; padding: 0 10px; display: flex; align-items: center; justify-content: center;
  border-radius: 7px; border: 1px solid var(--border-subtle); background: var(--bg-elevated);
  &:active { opacity: 0.7; }
  &--primary { border-color: rgba(var(--color-primary-rgb), 0.35); background: rgba(var(--color-primary-rgb), 0.1); }
}
.sec-btn-text { font-size: 12px; font-weight: 600; color: var(--text-secondary); &--primary { color: var(--color-primary); } }

.empty-inline {
  padding: 18px 14px; margin-bottom: 10px;
  background: var(--bg-panel); border: 1px dashed var(--border-default); border-radius: 12px;
}
.empty-inline-text { font-size: 12px; color: var(--text-dimmed); line-height: 1.6; }

/* ── 网格 ── */
.plugin-grid {
  display: flex;
  flex-direction: column;
  &--wide {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    align-items: start;
  }
}

/* ── 集合卡片 ── */
.col-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 10px;
  display: flex; flex-direction: column; gap: 6px;
  &:active { background: var(--bg-elevated); }
  .plugin-grid--wide & { margin-bottom: 0; }
  &--matched { border-color: rgba(var(--color-primary-rgb), 0.45); box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.08); }
  &--builtin { opacity: 0.85; }
}
.col-hd { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.col-name { font-size: 14px; font-weight: 700; color: var(--text-primary); flex: 1; min-width: 0; }
.col-more { width: 28px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: var(--bg-elevated); border: 1px solid var(--border-subtle); order: 99; &:active { opacity: 0.7; } }
.col-more-text { font-size: 14px; color: var(--text-muted); font-weight: 700; line-height: 1; }
.col-badge {
  padding: 1px 6px; border-radius: 4px; background: var(--bg-elevated); border: 1px solid var(--border-subtle);
  &--builtin { .col-badge-text { color: var(--color-warning); } border-color: rgba(var(--color-warning-rgb), 0.3); }
  &--import { .col-badge-text { color: var(--color-info); } }
  &--user { .col-badge-text { color: var(--text-secondary); } }
  &--matched { background: rgba(var(--color-primary-rgb), 0.1); border-color: rgba(var(--color-primary-rgb), 0.35); .col-badge-text { color: var(--color-primary); } }
}
.col-badge-text { font-size: 9px; font-weight: 700; letter-spacing: 0.3px; }
.col-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }
.col-stats { font-size: 11px; color: var(--text-muted); }
.col-fp { display: flex; align-items: center; gap: 5px; flex-wrap: wrap; }
.col-fp-label { font-size: 9px; color: var(--text-dimmed); text-transform: uppercase; }
.fp-chip { padding: 1px 6px; border-radius: 4px; background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.2); }
.fp-chip-text { font-size: 9px; color: var(--color-accent); }
.col-fp-more { font-size: 9px; color: var(--text-dimmed); }
.col-fp-none { font-size: 10px; color: var(--text-dimmed); }
.fp-name { font-size: 9px; color: var(--color-info); }
.col-bound { font-size: 10px; color: var(--text-dimmed); }

/* ── 插件卡片 ── */
.plugin-card {
  background: var(--bg-panel);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition: border-color 0.2s;
  .plugin-grid--wide & { margin-bottom: 0; }
  &--enabled {
    border-color: rgba(var(--color-primary-rgb), 0.4);
    box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.08);
  }
}
.plugin-hd { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.plugin-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.plugin-status {
  width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  &--on { background: var(--color-accent); box-shadow: 0 0 6px rgba(var(--color-accent-rgb), 0.7); animation: ble-pulse 2s ease-in-out infinite; }
  &--off { background: var(--text-dimmed); }
}
.plugin-name { font-size: 15px; font-weight: 600; color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.enabled-badge { background: rgba(var(--color-accent-rgb), 0.12); border: 1px solid rgba(var(--color-accent-rgb), 0.3); border-radius: 4px; padding: 1px 6px; flex-shrink: 0; }
.enabled-text { font-size: 9px; font-weight: 700; color: var(--color-accent); letter-spacing: 0.5px; }
.plugin-actions { display: flex; gap: 6px; flex-shrink: 0; }
.action-btn {
  height: 28px; padding: 0 10px; display: flex; align-items: center; justify-content: center;
  border-radius: 6px; border: 1px solid var(--border-subtle); background: var(--bg-elevated); min-width: 28px;
  &:active { opacity: 0.7; }
  &--enable { border-color: rgba(var(--color-accent-rgb), 0.3); background: rgba(var(--color-accent-rgb), 0.08); .action-text { color: var(--color-accent); } }
  &--disable { border-color: rgba(var(--color-warning-rgb), 0.3); background: rgba(var(--color-warning-rgb), 0.08); .action-text { color: var(--color-warning); } }
  &--edit { .action-text { color: var(--color-primary); } }
  &--delete { border-color: rgba(var(--color-danger-rgb), 0.2); .action-text.danger { color: var(--color-danger); } }
}
.action-text { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
.code-preview { background: var(--bg-elevated); border-radius: 6px; padding: 8px 10px; border: 1px solid var(--border-subtle); overflow: hidden; }
.code-text { font-size: 11px; color: var(--text-muted); font-family: 'Courier New', monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; }

/* ── 底部弹窗 ── */
.editor-overlay {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.55); z-index: 500;
  display: flex; align-items: flex-end; justify-content: center; backdrop-filter: blur(2px);
}
.editor-sheet {
  width: 100%; max-width: 560px; border-radius: 20px 20px 0 0;
  background: var(--bg-panel); border-top: 1px solid var(--border-subtle);
  transform: translateY(100%); transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
  display: flex; flex-direction: column; max-height: 88vh; overflow-y: auto;
  &.sheet--visible { transform: translateY(0); }
}
.sheet-handle { width: 36px; height: 4px; border-radius: 2px; background: var(--text-dimmed); margin: 12px auto 0; opacity: 0.5; flex-shrink: 0; }
.editor-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px 10px; flex-shrink: 0; }
.editor-title { font-size: 17px; font-weight: 700; color: var(--text-primary); }
.editor-close {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-card); border-radius: 50%; border: 1px solid var(--border-subtle);
  &:active { opacity: 0.7; }
}
.editor-close-icon { font-size: 12px; color: var(--text-muted); }
.field-group { padding: 10px 20px; display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12px; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
.code-label-row { display: flex; align-items: baseline; gap: 10px; }
.code-tip { font-size: 10px; color: var(--text-dimmed); flex: 1; line-height: 1.5; }
.field-input {
  background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 8px;
  padding: 10px 14px; font-size: 14px; color: var(--text-primary);
}
.code-editor {
  background: var(--bg-elevated); border: 1px solid var(--border-default); border-radius: 8px;
  padding: 10px 14px; font-size: 12px; font-family: 'Courier New', monospace; color: var(--text-mono);
  height: 160px; width: 100%; line-height: 1.6;
  &--import { height: 120px; }
}
.field-ph { color: var(--text-dimmed); }
.import-tools { display: flex; gap: 6px; flex-wrap: wrap; }

.preview-card { padding: 10px 12px; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px; display: flex; flex-direction: column; gap: 4px; }
.preview-hd { display: flex; align-items: center; gap: 8px; }
.preview-kind { font-size: 9px; font-weight: 700; color: var(--color-info); padding: 1px 6px; border-radius: 4px; background: rgba(96,165,250,0.12); }
.preview-name { font-size: 13px; font-weight: 700; color: var(--text-primary); }
.preview-stats { font-size: 11px; color: var(--text-secondary); }
.preview-warn { font-size: 11px; color: var(--color-warning); }

.radio-row { display: flex; align-items: center; gap: 10px; padding: 6px 0; &:active { opacity: 0.8; } &--disabled { opacity: 0.4; } }
.radio { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; border: 2px solid var(--border-default); &--on { border-color: var(--color-primary); background: var(--color-primary); box-shadow: inset 0 0 0 3px var(--bg-panel); } }
.radio-text { font-size: 13px; color: var(--text-primary); }
.checkbox { width: 18px; height: 18px; border-radius: 5px; flex-shrink: 0; border: 1px solid var(--border-default); background: var(--bg-input); display: flex; align-items: center; justify-content: center; &--on { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.12); } }
.checkbox-mark { font-size: 11px; color: var(--color-primary); font-weight: 700; }
.target-list { max-height: 140px; background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 10px; }
.target-item { display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-bottom: 1px solid var(--border-subtle); &:last-child { border-bottom: none; } &--active { background: rgba(var(--color-primary-rgb), 0.07); } }
.target-name { font-size: 12px; font-weight: 600; color: var(--text-primary); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.target-stats { font-size: 10px; color: var(--text-dimmed); flex-shrink: 0; }
.chips { display: flex; gap: 6px; flex-wrap: wrap; }
.chip { padding: 5px 12px; border-radius: 999px; background: var(--bg-input); border: 1px solid var(--border-default); &--active { background: rgba(var(--color-primary-rgb), 0.1); border-color: rgba(var(--color-primary-rgb), 0.4); .chip-text { color: var(--color-primary); } } }
.chip-text { font-size: 11px; color: var(--text-muted); font-weight: 600; }

.enable-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 20px; }
.enable-label { font-size: 14px; color: var(--text-primary); font-weight: 500; }
.toggle-switch {
  width: 44px; height: 26px; border-radius: 13px; background: var(--bg-elevated); border: 1px solid var(--border-default);
  position: relative; transition: all 0.2s;
  &:active { opacity: 0.8; }
  &--on { background: var(--color-primary); border-color: var(--color-primary); }
}
.toggle-thumb {
  position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff;
  transition: transform 0.2s; box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  .toggle-switch--on & { transform: translateX(18px); }
}

.editor-actions { display: flex; gap: 10px; padding: 12px 20px; }
.editor-btn {
  flex: 1; height: 46px; display: flex; align-items: center; justify-content: center;
  border-radius: 12px; font-size: 15px; font-weight: 600;
  &:active { opacity: 0.85; }
  &--cancel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-secondary); }
  &--save { background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7)); color: var(--bg-base); box-shadow: 0 0 14px rgba(var(--color-primary-rgb), 0.3); }
  &--disabled { opacity: 0.45; }
}

.safe-area-bottom { height: env(safe-area-inset-bottom, 16px); min-height: 16px; }
.mono { font-family: 'Courier New', monospace; }
</style>
