<template>
  <!-- 遮罩 -->
  <view v-if="visible" class="settings-overlay" @click="$emit('close')">
    <!-- 面板主体（阻止冒泡） -->
    <view
      class="settings-sheet"
      :class="[appStore.themeClass, { 'sheet--visible': visible }]"
      :style="appStore.cssVarsStyle"
      @click.stop
    >
      <!-- 拖拽指示条 -->
      <view class="sheet-handle" />

      <!-- 标题栏 -->
      <view class="sheet-header">
        <text class="sheet-title">{{ t('settings.title') }}</text>
        <view class="close-btn" @click="$emit('close')">
          <text class="close-icon">✕</text>
        </view>
      </view>

      <!-- ── 主题切换 ───────────────────────────────────────── -->
      <view class="settings-section">
        <text class="section-label">{{ t('settings.theme') }}</text>
        <view class="theme-cards">

          <!-- 暗色主题卡片 -->
          <view
            class="theme-card"
            :class="{ 'theme-card--active': appStore.theme === 'dark' }"
            @click="appStore.setTheme('dark')"
          >
            <view class="theme-preview theme-preview--dark">
              <view class="preview-bar dark-bar-1" />
              <view class="preview-bar dark-bar-2" />
              <view class="preview-dot dark-dot" />
              <view class="preview-line dark-line" />
              <view class="preview-line dark-line2" />
            </view>
            <view class="theme-card-footer">
              <view class="theme-radio" :class="{ active: appStore.theme === 'dark' }" />
              <view>
                <text class="theme-name">{{ t('settings.themeDark') }}</text>
                <text class="theme-desc">{{ t('settings.themeDarkDesc') }}</text>
              </view>
            </view>
          </view>

          <!-- 亮色主题卡片 -->
          <view
            class="theme-card"
            :class="{ 'theme-card--active': appStore.theme === 'light' }"
            @click="appStore.setTheme('light')"
          >
            <view class="theme-preview theme-preview--light">
              <view class="preview-bar light-bar-1" />
              <view class="preview-bar light-bar-2" />
              <view class="preview-dot light-dot" />
              <view class="preview-line light-line" />
              <view class="preview-line light-line2" />
            </view>
            <view class="theme-card-footer">
              <view class="theme-radio" :class="{ active: appStore.theme === 'light' }" />
              <view>
                <text class="theme-name">{{ t('settings.themeLight') }}</text>
                <text class="theme-desc">{{ t('settings.themeLightDesc') }}</text>
              </view>
            </view>
          </view>

        </view>
      </view>

      <!-- 分割线 -->
      <view class="section-divider" />

      <!-- ── 语言切换 ───────────────────────────────────────── -->
      <view class="settings-section">
        <text class="section-label">{{ t('settings.language') }}</text>
        <view class="lang-row">

          <view
            class="lang-btn"
            :class="{ 'lang-btn--active': appStore.locale === 'zh' }"
            @click="appStore.setLocale('zh')"
          >
            <text class="lang-flag">🇨🇳</text>
            <view>
              <text class="lang-name">中文</text>
              <text class="lang-sub">简体中文</text>
            </view>
            <view class="lang-check" :class="{ active: appStore.locale === 'zh' }">
              <text class="check-icon">✓</text>
            </view>
          </view>

          <view
            class="lang-btn"
            :class="{ 'lang-btn--active': appStore.locale === 'en' }"
            @click="appStore.setLocale('en')"
          >
            <text class="lang-flag">🇺🇸</text>
            <view>
              <text class="lang-name">English</text>
              <text class="lang-sub">English (US)</text>
            </view>
            <view class="lang-check" :class="{ active: appStore.locale === 'en' }">
              <text class="check-icon">✓</text>
            </view>
          </view>

        </view>
      </view>

      <!-- 分割线 -->
      <view class="section-divider" />

      <!-- ── 关于 ──────────────────────────────────────────── -->
      <view class="settings-section about-section">
        <view class="about-row">
          <view class="app-icon-wrap">
            <text class="app-icon">⬡</text>
          </view>
          <view class="about-info">
            <text class="about-app-name">{{ t('status.appName') }}</text>
            <text class="about-desc">{{ t('settings.aboutContent') }}</text>
          </view>
          <text class="about-version">{{ t('status.version') }}</text>
        </view>
      </view>

      <!-- 安全区域占位 -->
      <view class="safe-area-bottom" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { useAppStore } from '../store/appStore'
import { useI18n } from '../composables/useI18n'

defineProps<{ visible: boolean }>()
defineEmits<{ close: [] }>()

const appStore = useAppStore()
const { t } = useI18n()
</script>

<style lang="scss" scoped>
/* ── 遮罩 ── */
.settings-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 1000;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  backdrop-filter: blur(2px);
}

/* ── 面板 ── */
.settings-sheet {
  width: 100%;
  max-width: 560px;
  border-radius: 20px 20px 0 0;
  padding: 0 0 0;
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);

  /* 主题变量 */
  background: var(--bg-panel);
  border-top: 1px solid var(--border-subtle);
  box-shadow: 0 -8px 40px rgba(0, 0, 0, 0.3);

  &.sheet--visible {
    transform: translateY(0);
  }
}

/* ── 拖拽条 ── */
.sheet-handle {
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--text-dimmed);
  margin: 12px auto 0;
  opacity: 0.5;
}

/* ── 标题栏 ── */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 12px;
}

.sheet-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-card);
  border-radius: 50%;
  border: 1px solid var(--border-subtle);

  &:active { opacity: 0.7; }
}

.close-icon {
  font-size: 13px;
  color: var(--text-muted);
}

/* ── 分区 ── */
.settings-section {
  padding: 12px 20px;
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
  display: block;
  margin-bottom: 12px;
}

.section-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 0 20px;
}

/* ── 主题卡片 ── */
.theme-cards {
  display: flex;
  gap: 12px;
}

.theme-card {
  flex: 1;
  border-radius: 14px;
  border: 2px solid var(--border-subtle);
  overflow: hidden;
  transition: all 0.2s;
  background: var(--bg-card);

  &:active { transform: scale(0.97); }

  &--active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
  }
}

/* 主题预览区 */
.theme-preview {
  height: 72px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  gap: 4px;
}

.theme-preview--dark {
  background: linear-gradient(135deg, #0A0F1C 0%, #111827 100%);
}

.theme-preview--light {
  background: linear-gradient(135deg, #EDF2F7 0%, #FFFFFF 100%);
}

/* 暗色预览元素 */
.dark-bar-1 {
  height: 8px;
  width: 65%;
  background: #1A2235;
  border-radius: 3px;
  border: 1px solid rgba(0, 245, 255, 0.2);
}

.dark-bar-2 {
  height: 8px;
  width: 45%;
  background: #1A2235;
  border-radius: 3px;
  border: 1px solid rgba(0, 245, 255, 0.1);
}

.dark-dot {
  position: absolute;
  right: 12px;
  top: 10px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(0, 245, 255, 0.4);
}

.dark-line {
  height: 3px;
  width: 80%;
  background: linear-gradient(90deg, #00F5FF 0%, rgba(0, 245, 255, 0.1) 100%);
  border-radius: 2px;
  margin-top: 4px;
}

.dark-line2 {
  height: 3px;
  width: 55%;
  background: linear-gradient(90deg, #39FF14 0%, rgba(57, 255, 20, 0.1) 100%);
  border-radius: 2px;
}

/* 亮色预览元素 */
.light-bar-1 {
  height: 8px;
  width: 65%;
  background: #FFFFFF;
  border-radius: 3px;
  border: 1px solid rgba(3, 105, 161, 0.2);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}

.light-bar-2 {
  height: 8px;
  width: 45%;
  background: #FFFFFF;
  border-radius: 3px;
  border: 1px solid rgba(3, 105, 161, 0.12);
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.light-dot {
  position: absolute;
  right: 12px;
  top: 10px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid rgba(3, 105, 161, 0.4);
}

.light-line {
  height: 3px;
  width: 80%;
  background: linear-gradient(90deg, #0369A1 0%, rgba(3, 105, 161, 0.1) 100%);
  border-radius: 2px;
  margin-top: 4px;
}

.light-line2 {
  height: 3px;
  width: 55%;
  background: linear-gradient(90deg, #059669 0%, rgba(5, 150, 105, 0.1) 100%);
  border-radius: 2px;
}

/* 卡片底部 */
.theme-card-footer {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
}

.theme-radio {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-default);
  flex-shrink: 0;
  position: relative;
  transition: all 0.2s;

  &.active {
    border-color: var(--color-primary);

    &::after {
      content: '';
      position: absolute;
      inset: 3px;
      background: var(--color-primary);
      border-radius: 50%;
    }
  }
}

.theme-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}

.theme-desc {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-top: 1px;
}

/* ── 语言按钮 ── */
.lang-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.lang-btn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border-radius: 12px;
  border: 1.5px solid var(--border-subtle);
  background: var(--bg-card);
  transition: all 0.2s;

  &:active { opacity: 0.8; }

  &--active {
    border-color: var(--color-primary);
    background: rgba(var(--color-primary-rgb), 0.06);
  }
}

.lang-flag {
  font-size: 24px;
  flex-shrink: 0;
}

.lang-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
}

.lang-sub {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-top: 1px;
}

.lang-check {
  margin-left: auto;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid var(--border-default);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;

  &.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
  }
}

.check-icon {
  font-size: 13px;
  color: transparent;

  .lang-check.active & {
    color: #0A0F1C;
  }
}

/* ── 关于 ── */
.about-section {
  padding-bottom: 16px;
}

.about-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.app-icon-wrap {
  width: 44px;
  height: 44px;
  background: var(--bg-elevated);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-default);
  flex-shrink: 0;
}

.app-icon {
  font-size: 22px;
  color: var(--color-primary);
}

.about-info {
  flex: 1;
}

.about-app-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  display: block;
}

.about-desc {
  font-size: 11px;
  color: var(--text-muted);
  display: block;
  margin-top: 2px;
}

.about-version {
  font-size: 12px;
  color: var(--text-dimmed);
  font-family: 'Courier New', monospace;
  background: var(--bg-elevated);
  padding: 3px 8px;
  border-radius: 6px;
  flex-shrink: 0;
}

.safe-area-bottom {
  height: env(safe-area-inset-bottom, 16px);
  min-height: 16px;
}
</style>
