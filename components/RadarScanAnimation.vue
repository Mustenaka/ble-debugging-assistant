<template>
  <view class="radar-wrap">
    <view class="radar-container" :class="{ 'radar--scanning': scanning }">
      <!-- 同心圆 -->
      <view v-for="i in 4" :key="i" class="radar-ring" :style="ringStyle(i)" />

      <!-- 扫描扇形（使用CSS变量主题色） -->
      <view v-if="scanning" class="radar-sweep" />

      <!-- 中心点 -->
      <view class="radar-center">
        <view class="center-dot" :class="{ 'center-dot--scanning': scanning }" />
      </view>

      <!-- 设备点 -->
      <view
        v-for="(dot, i) in deviceDots"
        :key="`dot-${i}`"
        class="device-dot"
        :style="dot.style"
      />

      <!-- 十字准线 -->
      <view class="crosshair-h" />
      <view class="crosshair-v" />
    </view>

    <!-- 状态文字 -->
    <view class="radar-status">
      <text class="status-text" :class="{ 'status-text--scanning': scanning }">
        {{ scanning ? 'SCANNING...' : 'STANDBY' }}
      </text>
      <text v-if="deviceCount > 0" class="device-count">{{ deviceCount }}{{ deviceCountSuffix }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, watch, ref } from 'vue'

const props = defineProps<{
  scanning: boolean
  deviceCount: number
  theme?: 'dark' | 'light'
  deviceCountSuffix?: string
}>()

const deviceDots = ref<Array<{ style: string }>>([])

// 根据主题选择点颜色
const dotColors = computed(() => {
  if (props.theme === 'light') return ['#059669', '#0369A1']
  return ['#39FF14', '#00F5FF']
})

watch(() => props.deviceCount, (count) => {
  const dots = []
  for (let i = 0; i < Math.min(count, 8); i++) {
    const angle    = (i * 137.5) % 360
    const distance = 20 + (i * 11) % 45
    const rad = (angle * Math.PI) / 180
    const x   = 50 + distance * 0.83 * Math.cos(rad)
    const y   = 50 + distance * 0.83 * Math.sin(rad)
    const color = dotColors.value[i % 2]
    dots.push({ style: `left:${x}%;top:${y}%;background:${color};box-shadow:0 0 8px ${color}` })
  }
  deviceDots.value = dots
})

function ringStyle(i: number) {
  const sizes    = [25, 45, 65, 85]
  const opacities = [0.5, 0.35, 0.2, 0.1]
  return `width:${sizes[i-1]}%;height:${sizes[i-1]}%;opacity:${opacities[i-1]};`
}
</script>

<style lang="scss" scoped>
.radar-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }

.radar-container {
  width: 160px; height: 160px; position: relative;
  display: flex; align-items: center; justify-content: center;
}

/* 同心圆 — 使用 CSS 变量 */
.radar-ring {
  position: absolute; border-radius: 50%;
  border: 1px solid var(--scan-ring-color, rgba(0,245,255,0.6));
  top: 50%; left: 50%; transform: translate(-50%,-50%);
}

/* 扫描扇形 — CSS 变量主题色 */
.radar-sweep {
  position: absolute; width: 100%; height: 100%; border-radius: 50%;
  background: conic-gradient(
    from 0deg,
    transparent 0deg,
    var(--scan-sweep-start, rgba(0,245,255,0.15)) 20deg,
    var(--scan-sweep-end, rgba(0,245,255,0.4)) 60deg,
    transparent 60deg
  );
  animation: ble-spin 2s linear infinite;
  transform-origin: center;
}

/* 中心点 */
.radar-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 3; }
.center-dot {
  width: 10px; height: 10px; background: var(--color-primary); border-radius: 50%;
  box-shadow: 0 0 12px var(--color-primary);
  &--scanning { animation: ble-pulse 1s ease-in-out infinite; }
}

/* 设备点 */
.device-dot { position: absolute; width: 7px; height: 7px; border-radius: 50%; transform: translate(-50%,-50%); z-index: 2; animation: dot-appear 0.4s ease-out; }
@keyframes dot-appear { from { transform: translate(-50%,-50%) scale(0); opacity: 0; } to { transform: translate(-50%,-50%) scale(1); opacity: 1; } }

/* 十字准线 */
.crosshair-h { position: absolute; width: 100%; height: 1px; top: 50%; left: 0; background: var(--border-subtle); }
.crosshair-v { position: absolute; width: 1px; height: 100%; left: 50%; top: 0; background: var(--border-subtle); }

/* 外圈扫描脉冲 */
.radar--scanning .radar-ring:last-child { animation: ring-pulse 2s ease-in-out infinite; }
@keyframes ring-pulse { 0%,100%{opacity:0.08} 50%{opacity:0.25} }

/* 状态文字 */
.radar-status { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.status-text {
  font-size: 11px; font-family: 'Courier New', monospace; font-weight: 700;
  color: var(--text-dimmed); letter-spacing: 2px;
  &--scanning { color: var(--color-primary); animation: ble-blink 1.5s ease-in-out infinite; }
}
.device-count { font-size: 12px; color: var(--color-accent); font-family: 'Courier New', monospace; font-weight: 600; }
</style>
