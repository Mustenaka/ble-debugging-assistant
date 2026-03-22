import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'

export type Theme = 'dark' | 'light'
export type Locale = 'zh' | 'en'

const STORAGE_THEME_KEY = 'ble_app_theme'
const STORAGE_LOCALE_KEY = 'ble_app_locale'

// ─── 主题 CSS 变量表 ──────────────────────────────────────────────────────────

export const THEME_VARS: Record<Theme, Record<string, string>> = {
  dark: {
    '--bg-base':            '#0A0F1C',
    '--bg-panel':           '#111827',
    '--bg-card':            '#1A2235',
    '--bg-elevated':        '#1E2D44',
    '--bg-input':           '#0D1526',
    '--bg-overlay':         'rgba(10,15,28,0.95)',
    '--color-primary':      '#00F5FF',
    '--color-primary-rgb':  '0,245,255',
    '--color-accent':       '#39FF14',
    '--color-accent-rgb':   '57,255,20',
    '--color-warning':      '#F59E0B',
    '--color-warning-rgb':  '245,158,11',
    '--color-danger':       '#FF3B3B',
    '--color-danger-rgb':   '255,59,59',
    '--color-info':         '#60A5FA',
    '--color-purple':       '#8B5CF6',
    '--text-primary':       '#E2E8F0',
    '--text-secondary':     '#94A3B8',
    '--text-muted':         '#475569',
    '--text-dimmed':        '#334155',
    '--text-mono':          '#A8D8A8',
    '--border-subtle':      'rgba(0,245,255,0.08)',
    '--border-default':     'rgba(0,245,255,0.15)',
    '--border-active':      'rgba(0,245,255,0.5)',
    '--border-card':        'rgba(255,255,255,0.06)',
    '--shadow-card':        '0 4px 20px rgba(0,0,0,0.4)',
    '--nav-bg':             '#0A0F1C',
    '--nav-front':          '#ffffff',
    '--scan-ring-color':    'rgba(0,245,255,0.6)',
    '--scan-sweep-color':   'rgba(0,245,255,0.15)',
    '--scan-sweep-end':     'rgba(0,245,255,0.4)',
    '--badge-tx-bg':        'rgba(96,165,250,0.2)',
    '--badge-tx-color':     '#60A5FA',
    '--badge-rx-bg':        'rgba(57,255,20,0.2)',
    '--badge-rx-color':     '#39FF14',
    '--badge-sys-bg':       'rgba(245,158,11,0.2)',
    '--badge-sys-color':    '#F59E0B',
    '--entry-tx-bg':        'rgba(96,165,250,0.05)',
    '--entry-tx-border':    '#60A5FA',
    '--entry-rx-bg':        'rgba(57,255,20,0.05)',
    '--entry-rx-border':    '#39FF14',
    '--entry-sys-bg':       'rgba(245,158,11,0.05)',
    '--entry-sys-border':   '#F59E0B',
    '--data-hex-tx':        '#93C5FD',
    '--data-hex-rx':        '#86EFAC',
    '--data-ascii-tx':      '#60A5FA',
    '--data-ascii-rx':      '#39FF14',
  },
  light: {
    '--bg-base':            '#EDF2F7',
    '--bg-panel':           '#FFFFFF',
    '--bg-card':            '#F7FAFC',
    '--bg-elevated':        '#EBF4FF',
    '--bg-input':           '#FFFFFF',
    '--bg-overlay':         'rgba(237,242,247,0.97)',
    '--color-primary':      '#0369A1',
    '--color-primary-rgb':  '3,105,161',
    '--color-accent':       '#059669',
    '--color-accent-rgb':   '5,150,105',
    '--color-warning':      '#D97706',
    '--color-warning-rgb':  '217,119,6',
    '--color-danger':       '#DC2626',
    '--color-danger-rgb':   '220,38,38',
    '--color-info':         '#2563EB',
    '--color-purple':       '#7C3AED',
    '--text-primary':       '#1A202C',
    '--text-secondary':     '#4A5568',
    '--text-muted':         '#718096',
    '--text-dimmed':        '#A0AEC0',
    '--text-mono':          '#1A5F2E',
    '--border-subtle':      'rgba(3,105,161,0.1)',
    '--border-default':     'rgba(3,105,161,0.2)',
    '--border-active':      'rgba(3,105,161,0.5)',
    '--border-card':        'rgba(3,105,161,0.08)',
    '--shadow-card':        '0 2px 12px rgba(0,0,0,0.08)',
    '--nav-bg':             '#FFFFFF',
    '--nav-front':          '#000000',
    '--scan-ring-color':    'rgba(3,105,161,0.5)',
    '--scan-sweep-color':   'rgba(3,105,161,0.1)',
    '--scan-sweep-end':     'rgba(3,105,161,0.3)',
    '--badge-tx-bg':        'rgba(37,99,235,0.12)',
    '--badge-tx-color':     '#2563EB',
    '--badge-rx-bg':        'rgba(5,150,105,0.12)',
    '--badge-rx-color':     '#059669',
    '--badge-sys-bg':       'rgba(217,119,6,0.12)',
    '--badge-sys-color':    '#D97706',
    '--entry-tx-bg':        'rgba(37,99,235,0.04)',
    '--entry-tx-border':    '#2563EB',
    '--entry-rx-bg':        'rgba(5,150,105,0.04)',
    '--entry-rx-border':    '#059669',
    '--entry-sys-bg':       'rgba(217,119,6,0.04)',
    '--entry-sys-border':   '#D97706',
    '--data-hex-tx':        '#1D4ED8',
    '--data-hex-rx':        '#065F46',
    '--data-ascii-tx':      '#2563EB',
    '--data-ascii-rx':      '#059669',
  },
}

// ─── App Store ────────────────────────────────────────────────────────────────

export const useAppStore = defineStore('app', () => {
  // 读取持久化配置
  const savedTheme = (uni.getStorageSync(STORAGE_THEME_KEY) || 'dark') as Theme
  const savedLocale = (uni.getStorageSync(STORAGE_LOCALE_KEY) || 'zh') as Locale

  const theme = ref<Theme>(savedTheme)
  const locale = ref<Locale>(savedLocale)

  // 计算 CSS class
  const themeClass = computed(() => `theme-${theme.value}`)
  const isDark = computed(() => theme.value === 'dark')

  // 当前主题变量
  const vars = computed(() => THEME_VARS[theme.value])

  // CSS 变量字符串（用于 style 注入）
  const cssVarsStyle = computed(() => {
    const entries = Object.entries(vars.value)
    return entries.map(([k, v]) => `${k}:${v}`).join(';')
  })

  // ── 切换主题 ────────────────────────────────────────────────────────────────

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setTheme(t: Theme) {
    theme.value = t
  }

  // ── 切换语言 ────────────────────────────────────────────────────────────────

  function toggleLocale() {
    locale.value = locale.value === 'zh' ? 'en' : 'zh'
  }

  function setLocale(l: Locale) {
    locale.value = l
  }

  // ── 应用系统级样式 ────────────────────────────────────────────────────────

  function applySystemStyle() {
    const v = vars.value
    try {
      uni.setNavigationBarColor({
        frontColor: v['--nav-front'] as '#ffffff' | '#000000',
        backgroundColor: v['--nav-bg'],
        animation: { duration: 200, timingFunc: 'easeIn' },
      })
      uni.setBackgroundColor({
        backgroundColor: v['--bg-base'],
        backgroundColorTop: v['--bg-base'],
        backgroundColorBottom: v['--bg-base'],
      })
    } catch {}
  }

  // ── 持久化监听 ────────────────────────────────────────────────────────────

  watch(theme, (val) => {
    uni.setStorageSync(STORAGE_THEME_KEY, val)
    applySystemStyle()
  })

  watch(locale, (val) => {
    uni.setStorageSync(STORAGE_LOCALE_KEY, val)
  })

  return {
    theme,
    locale,
    themeClass,
    isDark,
    vars,
    cssVarsStyle,
    toggleTheme,
    setTheme,
    toggleLocale,
    setLocale,
    applySystemStyle,
  }
})
