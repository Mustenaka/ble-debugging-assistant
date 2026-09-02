<template>
  <view class="ft-wrap">
    <view class="ft-header">
      <text class="ft-title">{{ t('annotation.fields') }}</text>
      <view class="ft-add" @click="addRow">
        <text class="ft-add-text">＋ {{ t('annotation.addField') }}</text>
      </view>
    </view>

    <view v-if="!fields.length" class="ft-empty">
      <text class="ft-empty-text">{{ t('annotation.noFields') }}</text>
    </view>

    <view v-for="(row, i) in fields" :key="i" class="ft-row">
      <view class="ft-row-top">
        <view class="ft-cell ft-cell--sm">
          <text class="ft-cell-label">{{ t('annotation.fieldOffset') }}</text>
          <input class="ft-input mono" :value="row.offset" placeholder="0" placeholder-class="ft-ph"
            @input="row.offset = $event.detail.value" />
        </view>
        <view class="ft-cell ft-cell--sm">
          <text class="ft-cell-label">{{ t('annotation.fieldLength') }}</text>
          <input class="ft-input mono" :value="row.length" placeholder="1" placeholder-class="ft-ph"
            @input="row.length = $event.detail.value" />
        </view>
        <view class="ft-cell">
          <text class="ft-cell-label">{{ t('annotation.fieldType') }}</text>
          <view class="ft-type-row">
            <input class="ft-input mono ft-input--type" :class="{ 'ft-input--known': isKnownType(row.type) }" :value="row.type" :placeholder="t('annotation.fieldTypePlaceholder')" placeholder-class="ft-ph"
              @input="row.type = $event.detail.value" />
            <picker :range="typeLabels" @change="onPickType(row, $event)">
              <view class="ft-type-pick"><text class="ft-type-pick-text">▾</text></view>
            </picker>
          </view>
        </view>
        <view class="ft-del" @click="removeRow(i)">
          <text class="ft-del-icon">✕</text>
        </view>
      </view>
      <view class="ft-row-bottom">
        <view class="ft-cell">
          <text class="ft-cell-label">{{ t('annotation.fieldName') }}</text>
          <input class="ft-input" :value="row.name" placeholder="cmd" placeholder-class="ft-ph"
            @input="row.name = $event.detail.value" />
        </view>
        <view class="ft-cell ft-cell--wide">
          <text class="ft-cell-label">{{ t('annotation.fieldMeaning') }}</text>
          <input class="ft-input" :value="row.meaning" placeholder="0x01=查询 0x02=控制" placeholder-class="ft-ph"
            @input="row.meaning = $event.detail.value" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from '../composables/useI18n'
import type { ProtocolFieldDoc } from '../utils/protocolDocs'
import { FIELD_TYPE_OPTIONS, normalizeFieldType } from '../utils/fields'

const props = defineProps<{ fields: ProtocolFieldDoc[] }>()
const emit = defineEmits<{ 'update:fields': [fields: ProtocolFieldDoc[]] }>()

const { t } = useI18n()
const typeLabels = FIELD_TYPE_OPTIONS.map((o) => o.label)

function isKnownType(raw: string): boolean {
  return normalizeFieldType(raw) !== null
}

function onPickType(row: ProtocolFieldDoc, e: any) {
  const idx = Number(e?.detail?.value ?? -1)
  const opt = FIELD_TYPE_OPTIONS[idx]
  if (!opt) return
  row.type = opt.value
  if (opt.size && !row.length) row.length = String(opt.size)
}

function addRow() {
  emit('update:fields', [...props.fields, { offset: '', length: '', type: '', name: '', meaning: '' }])
}

function removeRow(index: number) {
  emit('update:fields', props.fields.filter((_, i) => i !== index))
}
</script>

<style lang="scss" scoped>
.ft-wrap { display: flex; flex-direction: column; gap: 8px; }
.ft-header { display: flex; align-items: center; justify-content: space-between; }
.ft-title { font-size: 11px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.4px; }
.ft-add {
  padding: 3px 10px; border-radius: 6px;
  background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid rgba(var(--color-primary-rgb), 0.25);
  &:active { opacity: 0.7; }
}
.ft-add-text { font-size: 10px; color: var(--color-primary); font-weight: 700; }

.ft-empty { padding: 12px; background: var(--bg-input); border: 1px dashed var(--border-default); border-radius: 8px; text-align: center; }
.ft-empty-text { font-size: 11px; color: var(--text-dimmed); }

.ft-row {
  display: flex; flex-direction: column; gap: 6px;
  padding: 9px 10px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: 10px;
}
.ft-row-top, .ft-row-bottom { display: flex; gap: 6px; align-items: flex-end; }
.ft-cell { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; &--sm { flex: 0 0 56px; } &--wide { flex: 2; } }
.ft-cell-label { font-size: 8px; color: var(--text-dimmed); text-transform: uppercase; letter-spacing: 0.3px; }
.ft-input {
  background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 7px;
  padding: 6px 8px; font-size: 12px; color: var(--text-primary); width: 100%; min-height: 32px;
  &--type { flex: 1; min-width: 0; }
  &--known { color: var(--color-accent); }
}
.ft-type-row { display: flex; gap: 4px; align-items: center; }
.ft-type-pick {
  width: 26px; height: 32px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  background: var(--bg-panel); border: 1px solid var(--border-subtle); border-radius: 7px;
  &:active { opacity: 0.7; }
}
.ft-type-pick-text { font-size: 12px; color: var(--color-primary); }
.ft-ph { color: var(--text-dimmed); }
.ft-del {
  width: 26px; height: 32px; display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  &:active { opacity: 0.6; }
}
.ft-del-icon { font-size: 11px; color: var(--color-danger); }

.mono { font-family: 'Courier New', monospace; }
</style>
