import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface ProtocolPlugin {
  id: string
  name: string
  enabled: boolean
  /** JS 函数体，参数: hexStr, asciiStr，返回: { fields: [{name, value}] } */
  code: string
}

const STORAGE_KEY = 'ble_protocol_plugins'

function loadPlugins(): ProtocolPlugin[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export const useProtocolStore = defineStore('protocol', () => {
  const plugins = ref<ProtocolPlugin[]>(loadPlugins())

  function _save() {
    uni.setStorageSync(STORAGE_KEY, JSON.stringify(plugins.value))
  }

  function addPlugin(plugin: Omit<ProtocolPlugin, 'id'>) {
    // 只允许一个启用状态
    if (plugin.enabled) {
      plugins.value.forEach((p) => (p.enabled = false))
    }
    plugins.value.push({ ...plugin, id: `plugin_${Date.now()}` })
    _save()
  }

  function updatePlugin(id: string, updates: Partial<Omit<ProtocolPlugin, 'id'>>) {
    const idx = plugins.value.findIndex((p) => p.id === id)
    if (idx === -1) return
    if (updates.enabled) {
      // 启用时禁用其他
      plugins.value.forEach((p) => (p.enabled = false))
    }
    plugins.value[idx] = { ...plugins.value[idx], ...updates }
    _save()
  }

  function removePlugin(id: string) {
    plugins.value = plugins.value.filter((p) => p.id !== id)
    _save()
  }

  function runPlugin(
    plugin: ProtocolPlugin,
    hexStr: string,
    asciiStr: string
  ): { name: string; value: string }[] {
    try {
      // eslint-disable-next-line no-new-func
      const fn = new Function('hexStr', 'asciiStr', plugin.code)
      const result = fn(hexStr, asciiStr)
      if (result?.fields && Array.isArray(result.fields)) {
        return result.fields.map((f: any) => ({
          name: String(f.name ?? ''),
          value: String(f.value ?? ''),
        }))
      }
      return [{ name: 'Error', value: 'Plugin must return { fields: [...] }' }]
    } catch (e) {
      return [{ name: 'Error', value: String(e) }]
    }
  }

  const enabledPlugin = computed(() => plugins.value.find((p) => p.enabled) ?? null)

  return {
    plugins,
    addPlugin,
    updatePlugin,
    removePlugin,
    runPlugin,
    enabledPlugin,
  }
})
