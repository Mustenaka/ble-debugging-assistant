<template>
  <view class="debug-page" :class="[appStore.themeClass, { 'debug-page--wide': isWideScreen }]" :style="appStore.cssVarsStyle">

    <!-- 顶部状态栏 -->
    <view class="debug-header">
      <view class="header-left">
        <view class="conn-indicator" :class="bleStore.isConnected ? 'conn--on' : 'conn--off'" />
        <view class="device-brief">
          <text class="dev-name">{{ bleStore.connectedDevice?.name ?? t('debug.notConnected') }}</text>
          <text class="char-brief mono">{{ charBrief }}</text>
        </view>
      </view>

      <view class="header-right">
        <!-- Notify 开关 -->
        <view v-if="canNotify" class="notify-toggle" :class="{ 'notify-toggle--on': bleStore.notifyEnabled }" @click="toggleNotify">
          <text class="notify-icon">{{ bleStore.notifyEnabled ? '◉' : '○' }}</text>
          <text class="notify-label">NOTIFY</text>
        </view>
        <!-- 主题/语言快切 -->
        <view class="hdr-btn" @click="appStore.toggleTheme()">
          <text class="hdr-btn-icon">{{ appStore.isDark ? '☀' : '◑' }}</text>
        </view>
        <view class="hdr-btn" @click="appStore.toggleLocale()">
          <text class="hdr-btn-icon lang">{{ appStore.locale === 'zh' ? 'EN' : '中' }}</text>
        </view>
        <!-- 更多菜单 -->
        <view class="more-btn" @click="showMoreMenu = !showMoreMenu">
          <text class="more-icon">⋮</text>
        </view>
      </view>
    </view>

    <!-- 更多菜单 -->
    <view v-if="showMoreMenu" class="menu-overlay" @click="showMoreMenu = false">
      <view class="more-menu" @click.stop>
        <view class="menu-item" @click="handleReadChar"><text class="mi-icon">⬇</text><text class="mi-text">{{ t('debug.moreMenu.read') }}</text></view>
        <view class="menu-divider" />
        <view class="menu-item" @click="handleCharHistory"><text class="mi-icon">◈</text><text class="mi-text">{{ t('debug.moreMenu.charHistory') }}</text></view>
        <view class="menu-divider" />
        <view class="menu-item" @click="handleExportLog"><text class="mi-icon">⬆</text><text class="mi-text">{{ t('debug.moreMenu.export') }}</text></view>
        <view class="menu-divider" />
        <view class="menu-item" @click="handleClearLog"><text class="mi-icon danger">✕</text><text class="mi-text danger">{{ t('debug.moreMenu.clearLog') }}</text></view>
        <view class="menu-divider" />
        <view class="menu-item" @click="openSettings"><text class="mi-icon">⚙</text><text class="mi-text">{{ t('settings.title') }}</text></view>
        <view class="menu-divider" />
        <view class="menu-item" @click="handleDisconnect"><text class="mi-icon danger">⊗</text><text class="mi-text danger">{{ t('debug.moreMenu.disconnect') }}</text></view>
      </view>
    </view>

    <!-- 主体 -->
    <view class="debug-body" :class="{ 'debug-body--wide': isWideScreen }">

      <!-- 日志面板 -->
      <view class="log-panel-wrap" :class="{ 'log-panel-wrap--wide': isWideScreen }">
        <BleLogPanel
          :logs="bleStore.logs"
          :tx-bytes="bleStore.txBytes"
          :rx-bytes="bleStore.rxBytes"
          v-model:displayMode="logDisplayMode"
          :log-title="t('log.title')"
          :total-label="t('log.total')"
          :auto-label="t('log.autoScroll')"
          :waiting-text="t('log.waiting')"
          :new-msg-text="t('log.newMessages')"
          @clear="bleStore.clearLogs()"
          @export="handleExportLog"
        />
      </view>

      <!-- 发送面板 -->
      <view class="send-panel" :class="{ 'send-panel--wide': isWideScreen }">

        <!-- 目标信息 -->
        <view class="target-info">
          <view class="target-row">
            <text class="target-label">{{ t('debug.service') }}</text>
            <text class="target-uuid mono">{{ shortUUID(bleStore.activeServiceId) }}</text>
          </view>
          <view class="target-row">
            <text class="target-label">{{ t('debug.characteristic') }}</text>
            <text class="target-uuid mono">{{ shortUUID(bleStore.activeCharacteristicId) }}</text>
            <view class="char-props-mini">
              <text v-if="canWrite"  class="cprop cprop-w">W</text>
              <text v-if="canNotify" class="cprop cprop-n">N</text>
              <text v-if="canRead"   class="cprop cprop-r">R</text>
            </view>
          </view>
        </view>

        <!-- 未选择特征值 -->
        <view v-if="!bleStore.activeCharacteristicId" class="no-char-tip">
          <text class="tip-icon">⚡</text>
          <text class="tip-text">{{ t('debug.noCharTip') }}</text>
          <view class="tip-btn" @click="goToDevice"><text class="tip-btn-text">{{ t('debug.goSelect') }}</text></view>
        </view>

        <!-- 发送区 -->
        <view v-else class="send-area">
          <HexInput
            :quick-commands="bleStore.quickCommands"
            :is-sending="isSending"
            :disabled="!canWrite || !bleStore.isConnected"
            :hex-placeholder="t('hexInput.hexPlaceholder')"
            :ascii-placeholder="t('hexInput.asciiPlaceholder')"
            :hex-error="t('hexInput.hexError')"
            :preview-label="t('hexInput.preview')"
            :bytes-label="t('hexInput.bytes')"
            :quick-label="t('hexInput.quick')"
            :save-as-quick-label="t('hexInput.saveAsQuick')"
            :send-label="t('hexInput.send')"
            :sending-label="t('hexInput.sending')"
            @send="handleSend"
            @save-quick="handleSaveQuick"
            @delete-quick="bleStore.removeQuickCommand($event)"
          />
          <view v-if="!canWrite" class="no-write-tip">
            <text class="no-write-text">{{ t('debug.noWriteSupport') }}</text>
          </view>
        </view>

        <!-- 协议解析 -->
        <view class="protocol-section">
          <view class="protocol-header" @click="showProtocol = !showProtocol">
            <text class="protocol-title">{{ t('debug.protocolAnalysis') }}</text>
            <text class="protocol-arrow" :class="{ 'arrow--open': showProtocol }">›</text>
          </view>
          <view v-if="showProtocol" class="protocol-body">
            <view class="protocol-tabs">
              <view v-for="p in protocols" :key="p.id" class="proto-tab" :class="{ 'proto-tab--active': activeProtocol === p.id }" @click="activeProtocol = p.id">
                <text class="proto-name">{{ p.label }}</text>
              </view>
            </view>

            <!-- 自定义 tab：插件管理入口 -->
            <view v-if="activeProtocol === 'custom'" class="custom-plugin-bar">
              <view v-if="protocolStore.enabledPlugin" class="plugin-indicator">
                <view class="plugin-dot" />
                <text class="plugin-running-name">{{ protocolStore.enabledPlugin.name }}</text>
              </view>
              <text v-else class="no-plugin-hint">{{ t('protocol.noEnabled') }}</text>
              <view class="manage-link" @click="goToProtocolManage">
                <text class="manage-text">{{ t('protocol.manage') }} ›</text>
              </view>
            </view>

            <view v-if="parsedProtocol" class="parsed-result">
              <view v-for="(field, i) in parsedProtocol" :key="i" class="parsed-field">
                <text class="field-name">{{ field.name }}</text>
                <text class="field-value mono">{{ field.value }}</text>
              </view>
            </view>
            <view v-else class="no-parse">
              <text class="no-parse-text">{{ activeProtocol === 'raw' ? t('debug.proto.noParseRaw') : t('debug.proto.waiting') }}</text>
            </view>
          </view>
        </view>

      </view>
    </view>

    <!-- 保存快捷命令弹窗 -->
    <view v-if="showSaveQuickDialog" class="modal-overlay" @click="showSaveQuickDialog = false">
      <view class="modal-card" @click.stop>
        <text class="modal-title">{{ t('debug.saveQuickCmd') }}</text>
        <input
          class="modal-input"
          v-model="quickCmdName"
          :placeholder="t('debug.cmdNamePlaceholder')"
          placeholder-class="modal-ph"
          maxlength="20"
          :focus="showSaveQuickDialog"
          :adjust-position="true"
        />
        <text class="modal-preview mono">{{ pendingQuickData?.data }}</text>
        <view class="modal-actions">
          <view class="modal-btn modal-btn--cancel" @click="showSaveQuickDialog = false"><text>{{ t('common.cancel') }}</text></view>
          <view class="modal-btn modal-btn--confirm" @click="confirmSaveQuick"><text>{{ t('common.save') }}</text></view>
        </view>
      </view>
    </view>

    <!-- 特征值历史 Diff 弹窗 -->
    <DiffModal
      v-if="showDiffModal"
      :history="bleStore.charValueHistory[bleStore.activeCharacteristicId] ?? []"
      :title="t('debug.charHistory')"
      :empty-text="t('debug.noHistory')"
      :changed-label="t('debug.charHistory')"
      same-label="—"
      @close="showDiffModal = false"
    />

    <!-- 设置面板 -->
    <SettingsPanel :visible="showSettings" @close="showSettings = false" />

  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useBleStore } from '../../store/bleStore'
import { useAppStore } from '../../store/appStore'
import { useI18n } from '../../composables/useI18n'
import { shortUUID } from '../../utils/hex'
import { exportLogsToText, exportLogsToCSV, saveLogsToFile, buildExportFilename, type ExportDeviceInfo } from '../../utils/buffer'
import { useProtocolStore } from '../../store/protocolStore'
import BleLogPanel from '../../components/BleLogPanel.vue'
import HexInput from '../../components/HexInput.vue'
import SettingsPanel from '../../components/SettingsPanel.vue'
import DiffModal from '../../components/DiffModal.vue'

const bleStore = useBleStore()
const appStore = useAppStore()
const protocolStore = useProtocolStore()
const { t } = useI18n()

const isSending = ref(false)
const showMoreMenu = ref(false)
const showProtocol = ref(false)
const showSettings = ref(false)
const showDiffModal = ref(false)
const activeProtocol = ref('raw')
const logDisplayMode = ref<'hex' | 'ascii' | 'both'>('hex')
const isWideScreen = ref(false)
const showSaveQuickDialog = ref(false)
const quickCmdName = ref('')
const pendingQuickData = ref<{ data: string; mode: 'hex' | 'ascii' } | null>(null)

onMounted(() => {
  checkScreenWidth()
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('debug.pageTitle') })
  uni.onWindowResize((res: any) => { isWideScreen.value = res.size.windowWidth >= 768 })
  if (!bleStore.isConnected) bleStore.addSysLog('⚠ ' + t('debug.notConnected'))
})

onUnmounted(() => { uni.offWindowResize(() => {}) })

watch(() => appStore.theme, () => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('debug.pageTitle') })
})

watch(() => appStore.locale, () => {
  uni.setNavigationBarTitle({ title: t('debug.pageTitle') })
})

function checkScreenWidth() {
  isWideScreen.value = uni.getSystemInfoSync().windowWidth >= 768
}

const canWrite  = computed(() => { const c = bleStore.activeCharacteristic; return !!(c?.properties.write || c?.properties.writeNoResponse) })
const canRead   = computed(() => !!bleStore.activeCharacteristic?.properties.read)
const canNotify = computed(() => { const c = bleStore.activeCharacteristic; return !!(c?.properties.notify || c?.properties.indicate) })
const charBrief = computed(() => bleStore.activeCharacteristicId ? shortUUID(bleStore.activeCharacteristicId) : t('debug.noCharSelected'))

const protocols = computed(() => [
  { id: 'raw',    label: 'RAW' },
  { id: 'uart',   label: 'UART' },
  { id: 'custom', label: t('debug.customProtocol') },
])

const parsedProtocol = computed(() => {
  const lastRx = [...bleStore.logs].reverse().find((l) => l.direction === 'RX')
  if (!lastRx?.hex || activeProtocol.value === 'raw') return null
  if (activeProtocol.value === 'uart') {
    const bytes = lastRx.hex.split(' ').map((h) => parseInt(h, 16))
    if (!bytes.length) return null
    return [
      { name: t('debug.proto.dataLength'), value: `${bytes.length} ${t('debug.bytes')}` },
      { name: t('debug.proto.rawHex'),     value: lastRx.hex },
      { name: t('debug.proto.ascii'),      value: lastRx.ascii },
      { name: t('debug.proto.firstByte'),  value: `0x${bytes[0].toString(16).toUpperCase().padStart(2,'0')}` },
      { name: t('debug.proto.lastByte'),   value: `0x${bytes[bytes.length-1].toString(16).toUpperCase().padStart(2,'0')}` },
    ]
  }
  if (activeProtocol.value === 'custom') {
    if (!protocolStore.enabledPlugin) return null
    return protocolStore.runPlugin(protocolStore.enabledPlugin, lastRx.hex, lastRx.ascii)
  }
  return null
})

async function handleSend(buffer: ArrayBuffer) {
  if (isSending.value) return
  isSending.value = true
  try { await bleStore.sendData(buffer, true) }
  catch (e: any) { uni.showToast({ title: e.message ?? t('debug.sendFailed'), icon: 'none', duration: 2000 }) }
  finally { isSending.value = false }
}

async function toggleNotify() {
  try {
    await bleStore.toggleNotify(!bleStore.notifyEnabled)
    uni.showToast({ title: bleStore.notifyEnabled ? t('debug.notifyOn') : t('debug.notifyOff'), icon: 'none', duration: 1200 })
  } catch (e: any) { uni.showToast({ title: e.message ?? t('debug.notifyFailed'), icon: 'none' }) }
}

async function handleReadChar() {
  showMoreMenu.value = false
  if (!bleStore.connectedDevice || !bleStore.activeServiceId || !bleStore.activeCharacteristicId) {
    uni.showToast({ title: t('debug.noCharTip'), icon: 'none' }); return
  }
  try {
    const { bleManager } = await import('../../services/bleManager')
    await bleManager.readCharacteristic(bleStore.connectedDevice.deviceId, bleStore.activeServiceId, bleStore.activeCharacteristicId)
    bleStore.addSysLog(t('debug.readComplete'))
  } catch (e: any) { uni.showToast({ title: e.message ?? t('debug.readFailed'), icon: 'none' }) }
}

async function handleExportLog() {
  showMoreMenu.value = false
  if (!bleStore.logs.length) { uni.showToast({ title: t('debug.noLogs'), icon: 'none' }); return }

  const deviceInfo: ExportDeviceInfo = {
    name: bleStore.connectedDevice?.name ?? 'Unknown',
    deviceId: bleStore.connectedDevice?.deviceId ?? '',
    txBytes: bleStore.txBytes,
    rxBytes: bleStore.rxBytes,
  }

  uni.showActionSheet({
    itemList: [t('settings.exportTxt'), t('settings.exportCsv')],
    success: async (res) => {
      try {
        let content: string
        let filename: string
        let mimeType: string
        if (res.tapIndex === 1) {
          content = exportLogsToCSV(bleStore.logs, deviceInfo)
          filename = buildExportFilename(deviceInfo.name, 'csv')
          mimeType = 'text/csv'
        } else {
          content = exportLogsToText(bleStore.logs, deviceInfo)
          filename = buildExportFilename(deviceInfo.name, 'txt')
          mimeType = 'text/plain'
        }
        console.log('[Export] start —', filename, '| logs:', bleStore.logs.length, '| content length:', content.length)
        bleStore.addSysLog(`⬆ 导出开始: ${filename} (${bleStore.logs.length} 条)`)

        const path = await saveLogsToFile(content, filename, mimeType)
        console.log('[Export] saved —', path)
        bleStore.addSysLog(`✓ 导出成功: ${path}`)

        // #ifdef APP-PLUS
        if (plus.os.name === 'Android') {
          // Android 7+ 禁止 file:// URI 跨进程传递，必须通过 FileProvider 生成 content:// URI
          // HBuilderX 已内置 FileProvider，authority = packageName + '.dc.fileprovider'
          console.log('[Export] Android share via Java Intent + FileProvider — path:', path)
          try {
            const Intent       = plus.android.importClass('android.content.Intent')
            const File         = plus.android.importClass('java.io.File')
            const BuildVersion = plus.android.importClass('android.os.Build$VERSION')
            const activity     = plus.android.runtimeMainActivity()

            const intent = new Intent(Intent.ACTION_SEND)
            intent.setType(mimeType)

            const file = new File(path)
            if (BuildVersion.SDK_INT >= 24) {
              const FileProvider = plus.android.importClass('androidx.core.content.FileProvider')
              const authority    = activity.getPackageName() + '.dc.fileprovider'
              console.log('[Export] FileProvider authority:', authority)
              const uri = FileProvider.getUriForFile(activity, authority, file)
              console.log('[Export] content:// URI:', uri.toString())
              intent.putExtra(Intent.EXTRA_STREAM, uri)
              intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } else {
              const Uri = plus.android.importClass('android.net.Uri')
              intent.putExtra(Intent.EXTRA_STREAM, Uri.fromFile(file))
            }

            const chooser = Intent.createChooser(intent, t('debug.exportShare'))
            activity.startActivity(chooser)
            console.log('[Export] share chooser started')
          } catch (shareErr: any) {
            console.error('[Export] Java share error —', shareErr?.message ?? JSON.stringify(shareErr))
            bleStore.addSysLog(`⚠ 分享失败: ${shareErr?.message ?? '未知'}`)
            uni.showModal({
              title: t('debug.exportTitle'),
              content: `${filename}\n\n${t('debug.exportSaved')}${path}`,
              showCancel: false,
              confirmText: t('common.ok'),
            })
          }
        } else {
          // iOS: plus.share 可正常传递沙盒内文件
          console.log('[Export] iOS share via plus.share.sendWithSystem — path:', path)
          plus.share.sendWithSystem(
            { type: 'file', href: path },
            () => { console.log('[Export] iOS share done') },
            (e: any) => {
              console.warn('[Export] iOS share failed —', JSON.stringify(e))
              uni.showModal({
                title: t('debug.exportTitle'),
                content: `${filename}\n\n${t('debug.exportSaved')}${path}`,
                showCancel: false,
                confirmText: t('common.ok'),
              })
            },
          )
        }
        // #endif
        // #ifndef APP-PLUS
        uni.showModal({
          title: t('debug.exportTitle'),
          content: `${filename}\n\n${t('debug.exportSaved')}${path}`,
          showCancel: false,
          confirmText: t('common.ok'),
        })
        // #endif
      } catch (e: any) {
        console.error('[Export] failed —', e?.message, JSON.stringify(e))
        bleStore.addSysLog(`⚠ 导出失败: ${e?.message ?? '未知错误'}`)
        uni.showToast({ title: t('debug.exportFailed'), icon: 'none' })
      }
    },
  })
}

function handleClearLog() {
  showMoreMenu.value = false
  uni.showModal({ title: t('debug.clearLogTitle'), content: t('debug.clearLogConfirm'), confirmColor: '#DC2626',
    success: (res) => { if (res.confirm) bleStore.clearLogs() } })
}

function handleCharHistory() {
  showMoreMenu.value = false
  showDiffModal.value = true
}

function goToProtocolManage() {
  uni.navigateTo({ url: '/pages/protocol/index' })
}

async function handleDisconnect() {
  showMoreMenu.value = false
  await bleStore.disconnectDevice()
  uni.navigateBack()
}

function openSettings() { showMoreMenu.value = false; showSettings.value = true }

function handleSaveQuick(payload: { data: string; mode: 'hex' | 'ascii' }) {
  if (!payload.data.trim()) { uni.showToast({ title: t('debug.saveQuickTip'), icon: 'none' }); return }
  pendingQuickData.value = payload; quickCmdName.value = ''; showSaveQuickDialog.value = true
}

function confirmSaveQuick() {
  if (!quickCmdName.value.trim()) { uni.showToast({ title: t('debug.cmdNameRequired'), icon: 'none' }); return }
  bleStore.addQuickCommand({ name: quickCmdName.value.trim(), data: pendingQuickData.value!.data, mode: pendingQuickData.value!.mode })
  showSaveQuickDialog.value = false
  uni.showToast({ title: t('debug.saved'), icon: 'success' })
}

function goToDevice() { uni.navigateTo({ url: '/pages/device/index' }) }
</script>

<style lang="scss" scoped>
.debug-page { height: 100vh; background: var(--bg-base); display: flex; flex-direction: column; overflow: hidden; }

/* ── 顶部栏 ── */
.debug-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 10px 14px; background: var(--bg-panel);
  border-bottom: 1px solid var(--border-subtle); flex-shrink: 0; z-index: 10;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.conn-indicator {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
  &.conn--on  { background: var(--color-accent); box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.7); animation: ble-pulse 2s ease-in-out infinite; }
  &.conn--off { background: var(--color-danger); }
}
.device-brief { display: flex; flex-direction: column; gap: 1px; }
.dev-name  { font-size: 13px; font-weight: 600; color: var(--text-primary); }
.char-brief { font-size: 11px; color: var(--color-primary); }
.header-right { display: flex; align-items: center; gap: 6px; }

.notify-toggle {
  display: flex; align-items: center; gap: 4px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid rgba(var(--color-accent-rgb), 0.2); background: transparent; transition: all 0.2s;
  &--on { background: rgba(var(--color-accent-rgb), 0.1); border-color: rgba(var(--color-accent-rgb), 0.5); .notify-icon, .notify-label { color: var(--color-accent); } }
}
.notify-icon, .notify-label { font-size: 11px; color: var(--text-muted); }
.notify-label { font-weight: 700; letter-spacing: 0.5px; }

.hdr-btn {
  width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
  background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 7px;
  &:active { opacity: 0.7; }
}
.hdr-btn-icon { font-size: 13px; color: var(--text-muted); &.lang { font-size: 11px; font-weight: 700; color: var(--color-primary); } }
.more-btn { width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; background: var(--bg-elevated); border: 1px solid var(--border-subtle); border-radius: 8px; &:active { opacity: 0.7; } }
.more-icon { font-size: 18px; color: var(--text-secondary); }

/* ── 更多菜单 ── */
.menu-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.3); }
.more-menu { position: absolute; top: 58px; right: 14px; background: var(--bg-card); border: 1px solid var(--border-default); border-radius: 12px; overflow: hidden; min-width: 160px; box-shadow: var(--shadow-card); z-index: 201; }
.menu-item { display: flex; align-items: center; gap: 10px; padding: 14px 18px; &:active { background: rgba(var(--color-primary-rgb), 0.05); } }
.mi-icon { font-size: 14px; color: var(--text-secondary); width: 18px; text-align: center; flex-shrink: 0; &.danger { color: var(--color-danger); } }
.mi-text { font-size: 14px; color: var(--text-primary); &.danger { color: var(--color-danger); } }
.menu-divider { height: 1px; background: var(--border-subtle); }

/* ── 主体布局 ── */
.debug-body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; &--wide { flex-direction: row; } }
.log-panel-wrap { flex: 1; min-height: 0; overflow: hidden; &--wide { flex: 1.4; border-right: 1px solid var(--border-subtle); } }
.send-panel {
  background: var(--bg-panel); border-top: 1px solid var(--border-subtle);
  padding: 14px; display: flex; flex-direction: column; gap: 12px;
  overflow-y: auto; max-height: 55vh;
  &--wide { max-height: 100vh; border-top: none; border-left: 1px solid var(--border-subtle); min-width: 320px; max-width: 400px; }
}

/* ── 目标信息 ── */
.target-info { background: var(--bg-elevated); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 5px; }
.target-row { display: flex; align-items: center; gap: 8px; }
.target-label { font-size: 11px; color: var(--text-muted); min-width: 36px; font-weight: 600; }
.target-uuid { font-size: 12px; color: var(--color-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.char-props-mini { display: flex; gap: 4px; }
.cprop { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 3px; }
.cprop-w { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }
.cprop-n { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-accent); }
.cprop-r { background: rgba(var(--color-info, 96,165,250), 0.12); color: var(--color-info); }

/* ── 无特征值提示 ── */
.no-char-tip { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 0; }
.tip-icon { font-size: 28px; color: var(--color-warning); }
.tip-text { font-size: 13px; color: var(--text-muted); text-align: center; }
.tip-btn { padding: 8px 20px; background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.25); border-radius: 8px; &:active { opacity: 0.75; } }
.tip-btn-text { font-size: 13px; color: var(--color-primary); font-weight: 500; }

.send-area { display: flex; flex-direction: column; gap: 10px; }
.no-write-tip { padding: 8px 12px; background: rgba(var(--color-warning-rgb), 0.08); border: 1px solid rgba(var(--color-warning-rgb), 0.2); border-radius: 8px; }
.no-write-text { font-size: 12px; color: var(--color-warning); }

/* ── 协议解析 ── */
.protocol-section { background: var(--bg-elevated); border-radius: 10px; border: 1px solid var(--border-subtle); overflow: hidden; }
.protocol-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; &:active { opacity: 0.7; } }
.protocol-title { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
.protocol-arrow { font-size: 16px; color: var(--text-muted); transition: transform 0.2s; &.arrow--open { transform: rotate(90deg); } }
.protocol-body { border-top: 1px solid var(--border-subtle); padding: 10px; }
.protocol-tabs { display: flex; gap: 6px; margin-bottom: 10px; }
.proto-tab { padding: 4px 12px; border-radius: 6px; background: var(--bg-input); border: 1px solid var(--border-subtle); &--active { background: rgba(var(--color-primary-rgb), 0.1); border-color: rgba(var(--color-primary-rgb), 0.3); .proto-name { color: var(--color-primary); } } }
.proto-name { font-size: 12px; color: var(--text-muted); font-weight: 600; }
/* ── 自定义插件栏 ── */
.custom-plugin-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  background: rgba(var(--color-primary-rgb), 0.04);
  border: 1px solid rgba(var(--color-primary-rgb), 0.12);
  border-radius: 6px;
  margin-bottom: 8px;
}

.plugin-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}

.plugin-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-accent);
  box-shadow: 0 0 5px rgba(var(--color-accent-rgb), 0.7);
  animation: ble-pulse 2s ease-in-out infinite;
  flex-shrink: 0;
}

.plugin-running-name {
  font-size: 11px;
  color: var(--color-accent);
  font-weight: 600;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.no-plugin-hint {
  font-size: 11px;
  color: var(--text-dimmed);
  flex: 1;
}

.manage-link {
  flex-shrink: 0;
  &:active { opacity: 0.7; }
}

.manage-text {
  font-size: 11px;
  color: var(--color-primary);
  font-weight: 600;
}

.parsed-result { display: flex; flex-direction: column; gap: 6px; }
.parsed-field { display: flex; gap: 10px; padding: 6px 8px; background: var(--bg-input); border-radius: 6px; }
.field-name { font-size: 11px; color: var(--text-muted); min-width: 64px; flex-shrink: 0; }
.field-value { font-size: 12px; color: var(--text-mono); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.no-parse { padding: 12px 0; text-align: center; }
.no-parse-text { font-size: 12px; color: var(--text-dimmed); }

/* ── 弹窗 ── */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 300; }
.modal-card { background: var(--bg-card); border-radius: 16px; border: 1px solid var(--border-default); padding: 24px; margin: 24px; width: 100%; max-width: 360px; display: flex; flex-direction: column; gap: 16px; box-shadow: var(--shadow-card); }
.modal-title { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.modal-input { background: var(--bg-input); border: 1px solid var(--border-default); border-radius: 8px; padding: 12px 14px; font-size: 14px; color: var(--text-primary); width: 100%; }
.modal-ph { color: var(--text-dimmed); }
.modal-preview { font-size: 12px; color: var(--text-mono); padding: 8px 12px; background: var(--bg-elevated); border-radius: 6px; word-break: break-all; }
.modal-actions { display: flex; gap: 10px; }
.modal-btn { flex: 1; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 10px; font-size: 14px; font-weight: 600; }
.modal-btn--cancel { background: var(--bg-elevated); border: 1px solid var(--border-subtle); color: var(--text-secondary); }
.modal-btn--confirm { background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7)); color: var(--bg-base); box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.3); }
</style>
