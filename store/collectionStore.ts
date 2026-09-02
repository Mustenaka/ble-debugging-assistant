import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  listCollections,
  getCollection,
  saveCollection,
  deleteCollection,
  createCollection,
  cloneCollection,
  bindDeviceToCollection,
  unbindDevice,
  resolveCollectionForDevice,
  collectionsVersion,
  onCollectionsChanged,
  parseCollectionImport,
  importCollection,
  serializeCollection,
  builtinProfileToCollection,
  saveCollectionVariables,
  loadDeviceEnv,
  saveDeviceEnv,
  resolveVariables,
  addExampleToCollection,
  removeExampleFromCollection,
  type BleCollection,
  type ImportPreview,
  type ImportOptions,
  type CollectionVariable,
  type BleExample,
} from '../utils/collection'
import { getBuiltinProtocolProfiles } from '../services/builtinProtocolDocs'

/**
 * Collection 的响应式外壳：
 *  - collection.ts 是纯存储层（无 Vue 依赖），每次变更触发 onCollectionsChanged
 *  - 这里把变更映射到 version ref，页面/组件 watch(version) 即可刷新
 */
export const useCollectionStore = defineStore('collection', () => {
  const version = ref(collectionsVersion())
  const collections = ref<BleCollection[]>([])
  let subscribed = false

  function refresh() {
    collections.value = listCollections()
    version.value = collectionsVersion()
  }

  function init() {
    if (subscribed) return
    subscribed = true
    onCollectionsChanged(() => refresh())
    refresh()
  }

  const builtinCollections = computed<BleCollection[]>(() =>
    getBuiltinProtocolProfiles().map(builtinProfileToCollection),
  )

  function forDevice(deviceId: string): BleCollection | null {
    void version.value
    return resolveCollectionForDevice(deviceId)
  }

  function get(id: string): BleCollection | null {
    if (id.startsWith('builtin:')) return builtinCollections.value.find((c) => c.id === id) ?? null
    return getCollection(id)
  }

  function save(col: BleCollection) {
    saveCollection(col)
  }

  function remove(id: string) {
    deleteCollection(id)
  }

  function create(name: string, extra?: Partial<BleCollection>) {
    return createCollection({ ...extra, name })
  }

  function duplicate(col: BleCollection, name?: string) {
    return cloneCollection(col, name)
  }

  function bind(deviceId: string, collectionId: string) {
    return bindDeviceToCollection(deviceId, collectionId)
  }

  function unbind(deviceId: string) {
    unbindDevice(deviceId)
  }

  function parseImport(text: string): ImportPreview {
    return parseCollectionImport(text)
  }

  function applyImport(preview: ImportPreview, opts: ImportOptions): BleCollection {
    return importCollection(preview, opts)
  }

  function serialize(col: BleCollection): string {
    return serializeCollection(col)
  }

  function setVariables(collectionId: string, vars: CollectionVariable[]) {
    return saveCollectionVariables(collectionId, vars)
  }

  function deviceEnv(deviceId: string): Record<string, string> {
    void version.value
    return loadDeviceEnv(deviceId)
  }

  function setDeviceEnv(deviceId: string, vars: Record<string, string>) {
    saveDeviceEnv(deviceId, vars)
  }

  function variablesFor(deviceId: string): Record<string, string> {
    void version.value
    return resolveVariables(deviceId)
  }

  function addExample(collectionId: string, example: BleExample) {
    return addExampleToCollection(collectionId, example)
  }

  function removeExample(collectionId: string, exampleId: string) {
    return removeExampleFromCollection(collectionId, exampleId)
  }

  return {
    version,
    collections,
    builtinCollections,
    init,
    refresh,
    forDevice,
    get,
    save,
    remove,
    create,
    duplicate,
    bind,
    unbind,
    parseImport,
    applyImport,
    serialize,
    setVariables,
    deviceEnv,
    setDeviceEnv,
    variablesFor,
    addExample,
    removeExample,
  }
})
