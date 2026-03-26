<template>
  <view class="protocol-page" :class="appStore.themeClass" :style="appStore.cssVarsStyle">

    <!-- 插件列表 -->
    <scroll-view scroll-y class="plugin-scroll">
      <!-- 空状态 -->
      <view v-if="!protocolStore.plugins.length" class="empty-wrap">
        <text class="empty-icon">⬡</text>
        <text class="empty-text">{{ t('protocol.noPlugins') }}</text>
      </view>

      <!-- 插件卡片 -->
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

        <!-- 代码预览 -->
        <view class="code-preview">
          <text class="code-text">{{ codePreview(plugin.code) }}</text>
        </view>
      </view>
    </scroll-view>

    <!-- 添加按钮 -->
    <view class="fab" @click="openAdd">
      <text class="fab-icon">+</text>
    </view>

    <!-- 编辑/添加 弹窗 -->
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

        <!-- 插件名称 -->
        <view class="field-group">
          <text class="field-label">{{ t('protocol.pluginName') }}</text>
          <input
            class="field-input"
            v-model="editorName"
            :placeholder="t('protocol.namePlaceholder')"
            placeholder-class="field-ph"
            maxlength="30"
          />
        </view>

        <!-- 函数体代码 -->
        <view class="field-group">
          <view class="code-label-row">
            <text class="field-label">{{ t('protocol.pluginCode') }}</text>
            <text class="code-tip">{{ t('protocol.codeTip') }}</text>
          </view>
          <textarea
            class="code-editor"
            v-model="editorCode"
            :placeholder="t('protocol.codePlaceholder')"
            placeholder-class="field-ph"
            :auto-height="false"
          />
        </view>

        <!-- 启用开关 -->
        <view class="enable-row">
          <text class="enable-label">{{ t('protocol.enable') }}</text>
          <view
            class="toggle-switch"
            :class="{ 'toggle-switch--on': editorEnabled }"
            @click="editorEnabled = !editorEnabled"
          >
            <view class="toggle-thumb" />
          </view>
        </view>

        <view class="editor-actions">
          <view class="editor-btn editor-btn--cancel" @click="closeEditor">
            <text>{{ t('common.cancel') }}</text>
          </view>
          <view class="editor-btn editor-btn--save" @click="handleSave">
            <text>{{ t('protocol.save') }}</text>
          </view>
        </view>

        <view class="safe-area-bottom" />
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from '../../store/appStore'
import { useProtocolStore, type ProtocolPlugin } from '../../store/protocolStore'
import { useI18n } from '../../composables/useI18n'

const appStore = useAppStore()
const protocolStore = useProtocolStore()
const { t } = useI18n()

const showEditor = ref(false)
const editingPlugin = ref<ProtocolPlugin | null>(null)
const editorName = ref('')
const editorCode = ref('')
const editorEnabled = ref(false)

onMounted(() => {
  appStore.applySystemStyle()
  uni.setNavigationBarTitle({ title: t('protocol.pageTitle') })
})

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
}

/* ── 列表 ── */
.plugin-scroll {
  flex: 1;
  padding: 12px;
}

/* ── 空状态 ── */
.empty-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 80px 24px;
}

.empty-icon {
  font-size: 48px;
  color: var(--bg-elevated);
}

.empty-text {
  font-size: 14px;
  color: var(--text-dimmed);
  text-align: center;
  line-height: 1.6;
}

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

  &--enabled {
    border-color: rgba(var(--color-primary-rgb), 0.4);
    box-shadow: 0 0 12px rgba(var(--color-primary-rgb), 0.08);
  }
}

.plugin-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.plugin-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.plugin-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  &--on {
    background: var(--color-accent);
    box-shadow: 0 0 6px rgba(var(--color-accent-rgb), 0.7);
    animation: ble-pulse 2s ease-in-out infinite;
  }

  &--off {
    background: var(--text-dimmed);
  }
}

.plugin-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.enabled-badge {
  background: rgba(var(--color-accent-rgb), 0.12);
  border: 1px solid rgba(var(--color-accent-rgb), 0.3);
  border-radius: 4px;
  padding: 1px 6px;
  flex-shrink: 0;
}

.enabled-text {
  font-size: 9px;
  font-weight: 700;
  color: var(--color-accent);
  letter-spacing: 0.5px;
}

.plugin-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  height: 28px;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--border-subtle);
  background: var(--bg-elevated);
  min-width: 28px;
  &:active { opacity: 0.7; }

  &--enable {
    border-color: rgba(var(--color-accent-rgb), 0.3);
    background: rgba(var(--color-accent-rgb), 0.08);
    .action-text { color: var(--color-accent); }
  }

  &--disable {
    border-color: rgba(var(--color-warning-rgb), 0.3);
    background: rgba(var(--color-warning-rgb), 0.08);
    .action-text { color: var(--color-warning); }
  }

  &--edit {
    .action-text { color: var(--color-primary); }
  }

  &--delete {
    border-color: rgba(var(--color-danger-rgb), 0.2);
    .action-text.danger { color: var(--color-danger); }
  }
}

.action-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

/* ── 代码预览 ── */
.code-preview {
  background: var(--bg-elevated);
  border-radius: 6px;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  overflow: hidden;
}

.code-text {
  font-size: 11px;
  color: var(--text-muted);
  font-family: 'Courier New', monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* ── FAB ── */
.fab {
  position: fixed;
  bottom: calc(24px + env(safe-area-inset-bottom, 0px));
  right: 20px;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(var(--color-primary-rgb), 0.4);
  z-index: 50;
  &:active { transform: scale(0.93); opacity: 0.9; }
}

.fab-icon {
  font-size: 28px;
  color: var(--bg-base);
  font-weight: 300;
  line-height: 1;
}

/* ── 编辑底部弹窗 ── */
.editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 500;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.editor-sheet {
  width: 100%;
  max-width: 560px;
  border-radius: 20px 20px 0 0;
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  padding-bottom: 0;
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
  display: flex;
  flex-direction: column;
  max-height: 85vh;
  overflow-y: auto;

  &.sheet--visible {
    transform: translateY(0);
  }
}

.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-dimmed);
  margin: 12px auto 0;
  opacity: 0.5;
  flex-shrink: 0;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px 10px;
  flex-shrink: 0;
}

.editor-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.editor-close {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 50%;
  border: 1px solid var(--border-subtle);
  &:active { opacity: 0.7; }
}

.editor-close-icon {
  font-size: 12px;
  color: var(--text-muted);
}

/* ── 字段 ── */
.field-group {
  padding: 10px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.code-label-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.code-tip {
  font-size: 10px;
  color: var(--text-dimmed);
  flex: 1;
}

.field-input {
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 14px;
  color: var(--text-primary);
}

.code-editor {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: 8px;
  padding: 10px 14px;
  font-size: 12px;
  font-family: 'Courier New', monospace;
  color: var(--text-mono);
  height: 160px;
  width: 100%;
  line-height: 1.6;
}

.field-ph { color: var(--text-dimmed); }

/* ── 启用开关 ── */
.enable-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
}

.enable-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.toggle-switch {
  width: 44px;
  height: 26px;
  border-radius: 13px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  position: relative;
  transition: all 0.2s;
  &:active { opacity: 0.8; }

  &--on {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }
}

.toggle-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.2s;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);

  .toggle-switch--on & {
    transform: translateX(18px);
  }
}

/* ── 操作按钮 ── */
.editor-actions {
  display: flex;
  gap: 10px;
  padding: 12px 20px;
}

.editor-btn {
  flex: 1;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  &:active { opacity: 0.85; }

  &--cancel {
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
  }

  &--save {
    background: linear-gradient(135deg, var(--color-primary), rgba(var(--color-primary-rgb), 0.7));
    color: var(--bg-base);
    box-shadow: 0 0 14px rgba(var(--color-primary-rgb), 0.3);
  }
}

.safe-area-bottom {
  height: env(safe-area-inset-bottom, 16px);
  min-height: 16px;
}
</style>
