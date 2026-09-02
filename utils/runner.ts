/**
 * 顺序执行（Postman Runner）的计划与选项
 */

import type { OperationAnnotation, OperationVariant } from './collection'
import type { OperationRunRecord } from './deviceArchive'

export interface RunnerOptions {
  /** 步间延时 */
  stepDelayMs: number
  /** FAIL / 超时 / 错误 时终止 */
  stopOnFail: boolean
  /** 循环次数 */
  loops: number
  /** 把每个变体展开为独立步骤 */
  expandVariants: boolean
}

const RUNNER_OPTIONS_KEY = 'ble_runner_options'

export function defaultRunnerOptions(): RunnerOptions {
  return { stepDelayMs: 200, stopOnFail: false, loops: 1, expandVariants: false }
}

export function loadRunnerOptions(): RunnerOptions {
  try {
    const raw = uni.getStorageSync(RUNNER_OPTIONS_KEY)
    if (!raw) return defaultRunnerOptions()
    const parsed = JSON.parse(raw)
    return {
      stepDelayMs: Math.max(0, Number(parsed.stepDelayMs) || 0),
      stopOnFail: !!parsed.stopOnFail,
      loops: Math.max(1, Math.min(1000, Number(parsed.loops) || 1)),
      expandVariants: !!parsed.expandVariants,
    }
  } catch {
    return defaultRunnerOptions()
  }
}

export function saveRunnerOptions(opts: RunnerOptions): void {
  try {
    uni.setStorageSync(RUNNER_OPTIONS_KEY, JSON.stringify(opts))
  } catch { /* 忽略 */ }
}

export interface RunStep<T extends { op: OperationAnnotation }> {
  item: T
  variant?: OperationVariant
  /** 从 1 开始 */
  loop: number
  /** 全局步序，从 1 开始 */
  index: number
  label: string
}

export function buildRunPlan<T extends { op: OperationAnnotation }>(items: T[], opts: RunnerOptions): RunStep<T>[] {
  const steps: RunStep<T>[] = []
  const loops = Math.max(1, opts.loops)
  for (let loop = 1; loop <= loops; loop++) {
    for (const item of items) {
      const variants = opts.expandVariants && item.op.variants?.length ? item.op.variants : [undefined]
      for (const variant of variants) {
        const name = item.op.name || item.op.operationId || '—'
        const label = `${name}${variant ? ` [${variant.label}]` : ''}${loops > 1 ? ` #${loop}` : ''}`
        steps.push({ item, variant, loop, index: steps.length + 1, label })
      }
    }
  }
  return steps
}

export function isFailure(record: OperationRunRecord): boolean {
  return record.result === 'fail' || record.result === 'timeout' || record.result === 'error'
}

export function shouldStopAfter(record: OperationRunRecord, opts: RunnerOptions): boolean {
  return opts.stopOnFail && isFailure(record)
}

export interface RunSummary {
  pass: number
  fail: number
  timeout: number
  error: number
  total: number
  aborted: boolean
  avgRttMs: number | null
}

export function summarizeRun(records: OperationRunRecord[], plannedTotal: number): RunSummary {
  const s: RunSummary = { pass: 0, fail: 0, timeout: 0, error: 0, total: records.length, aborted: records.length < plannedTotal, avgRttMs: null }
  const rtts: number[] = []
  for (const r of records) {
    if (r.result === 'pass' || r.result === 'sent') s.pass++
    else if (r.result === 'fail') s.fail++
    else if (r.result === 'timeout') s.timeout++
    else s.error++
    if (r.rttMs != null) rtts.push(r.rttMs)
  }
  if (rtts.length) s.avgRttMs = Math.round(rtts.reduce((a, b) => a + b, 0) / rtts.length)
  return s
}
