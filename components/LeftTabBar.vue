<template>
  <view class="left-tabbar" :class="appStore.themeClass" :style="appStore.cssVarsStyle">
    <view
      v-for="item in tabs"
      :key="item.path"
      class="tab-item"
      :class="{ 'tab-item--active': currentPath === item.path }"
      @click="navigate(item.path)"
    >
      <image class="tab-icon" :src="item.icon" mode="aspectFit" />
      <text class="tab-label">{{ item.label }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store/appStore'
import { useI18n } from '../composables/useI18n'

const props = defineProps<{ currentPath: string }>()
const appStore = useAppStore()
const { t } = useI18n()

const tabs = computed(() => {
  void appStore.locale
  return [
    { path: '/pages/scan/index',   icon: '/static/scanning_white.png', label: t('nav.scan')   },
    { path: '/pages/device/index', icon: '/static/device_white.png',   label: t('nav.device') },
    { path: '/pages/debug/index',  icon: '/static/debugging_white.png', label: t('nav.debug')  },
  ]
})

function navigate(path: string) {
  if (props.currentPath !== path) {
    uni.switchTab({ url: path })
  }
}
</script>

<style lang="scss" scoped>
.left-tabbar {
  position: fixed;
  left: 0;
  top: 0;
  bottom: 0;
  width: 60px;
  background: var(--bg-panel);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 16px;
  gap: 4px;
  z-index: 100;
}

.tab-item {
  width: 52px;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  border-radius: 10px;
  border-left: 3px solid transparent;
  transition: all 0.2s;
  &:active { opacity: 0.7; }

  &--active {
    background: rgba(var(--color-primary-rgb), 0.1);
    border-left-color: var(--color-primary);
    .tab-label { color: var(--color-primary); }
    .tab-icon { opacity: 1; }
  }
}

.tab-icon {
  width: 22px;
  height: 22px;
  opacity: 0.45;
}

.tab-label {
  font-size: 9px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.3px;
}
</style>
