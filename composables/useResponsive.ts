import { ref, onMounted, onUnmounted } from 'vue'

const WIDE_BREAKPOINT = 768

export function useResponsive() {
  const isWideScreen = ref(false)

  function handleResize(res: { size: { windowWidth: number } }) {
    const wide = res.size.windowWidth >= WIDE_BREAKPOINT
    isWideScreen.value = wide
    try {
      if (wide) uni.hideTabBar({ animation: false } as any)
      else uni.showTabBar({ animation: false } as any)
    } catch (_) {}
  }

  onMounted(() => {
    const info = uni.getSystemInfoSync()
    isWideScreen.value = info.windowWidth >= WIDE_BREAKPOINT
    uni.onWindowResize(handleResize)
    if (isWideScreen.value) {
      try { uni.hideTabBar({ animation: false } as any) } catch (_) {}
    }
  })

  onUnmounted(() => {
    uni.offWindowResize(handleResize)
  })

  return { isWideScreen }
}
