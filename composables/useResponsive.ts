import { ref, onMounted, onUnmounted } from 'vue'

const WIDE_BREAKPOINT = 768
const TABLET_MIN_SIDE = 600

export function useResponsive() {
  const isWideScreen = ref(false)

  function isWideLayout(windowWidth: number, windowHeight: number) {
    const isLandscape = windowWidth > windowHeight
    const isTabletLike = Math.min(windowWidth, windowHeight) >= TABLET_MIN_SIDE
    return isLandscape || (isTabletLike && windowWidth >= WIDE_BREAKPOINT)
  }

  function applyLayout(windowWidth: number, windowHeight: number) {
    const wide = isWideLayout(windowWidth, windowHeight)
    isWideScreen.value = wide
    try {
      if (wide) uni.hideTabBar({ animation: false } as any)
      else uni.showTabBar({ animation: false } as any)
    } catch (_) {}
  }

  function handleResize(res: { size: { windowWidth: number; windowHeight: number } }) {
    applyLayout(res.size.windowWidth, res.size.windowHeight)
  }

  onMounted(() => {
    const info = uni.getSystemInfoSync()
    applyLayout(info.windowWidth, info.windowHeight)
    uni.onWindowResize(handleResize)
  })

  onUnmounted(() => {
    uni.offWindowResize(handleResize)
    try { uni.showTabBar({ animation: false } as any) } catch (_) {}
  })

  return { isWideScreen }
}
