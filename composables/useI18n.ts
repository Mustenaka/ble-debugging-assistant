import { computed } from 'vue'
import { useAppStore } from '../store/appStore'
import { zh } from '../locales/zh'
import { en } from '../locales/en'

const locales = { zh, en }

type DeepRecord = Record<string, any>

/**
 * 根据 dot-notation key 获取嵌套值
 * 例：t('scan.startScan') → '开始扫描' / 'Start Scan'
 */
function getNestedValue(obj: DeepRecord, key: string): string {
  const result = key.split('.').reduce((o: any, k) => o?.[k], obj)
  return typeof result === 'string' ? result : key
}

export function useI18n() {
  const appStore = useAppStore()

  const locale = computed(() => appStore.locale)

  /**
   * 翻译函数，支持 dot-notation
   * 支持简单插值：t('scan.deviceCount', { n: 5 }) → '5 个设备'
   */
  function t(key: string, params?: Record<string, string | number>): string {
    const dict = locales[locale.value] ?? locales.zh
    let result = getNestedValue(dict, key)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        result = result.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return result
  }

  return { t, locale }
}
