/**
 * 请求-响应样例（Postman 的 Example）：从执行记录 / 日志配对生成，落入集合
 */

import type { LogEntry } from './buffer'
import type { OperationRunRecord } from './deviceArchive'
import {
  ensureCollectionForDevice,
  addExampleToCollection,
  newExampleId,
  type BleExample,
  type BleCollection,
  type OperationAnnotation,
} from './collection'
import { isHeartbeatLabel } from './heartbeat'
import { normalizeUUID } from './hex'

/** 在 TX 之后的时间窗内找第一条 RX（优先同服务；跳过心跳应答） */
export function findPairedRx(logs: LogEntry[], tx: LogEntry, windowMs = 2000): LogEntry | null {
  const idx = logs.findIndex((l) => l.id === tx.id)
  if (idx < 0) return null
  let fallback: LogEntry | null = null
  for (let i = idx + 1; i < logs.length; i++) {
    const l = logs[i]
    if (l.timestamp - tx.timestamp > windowMs) break
    if (l.direction !== 'RX' || isHeartbeatLabel(l.label)) continue
    if (tx.serviceUUID && l.serviceUUID && normalizeUUID(l.serviceUUID) === normalizeUUID(tx.serviceUUID)) return l
    if (!fallback) fallback = l
  }
  return fallback
}

export function exampleFromLogs(name: string, tx: LogEntry, rx: LogEntry | null, opId?: string): BleExample | null {
  if (!tx.serviceUUID || !tx.characteristicUUID) return null
  return {
    id: newExampleId(),
    name,
    serviceUUID: tx.serviceUUID,
    characteristicUUID: tx.characteristicUUID,
    operationId: tx.operationId || opId,
    request: { hex: tx.hex, ascii: tx.ascii, timestamp: tx.timestamp },
    response: rx
      ? { hex: rx.hex, ascii: rx.ascii, characteristicUUID: rx.characteristicUUID, timestamp: rx.timestamp, rttMs: rx.timestamp - tx.timestamp }
      : undefined,
    createdAt: Date.now(),
  }
}

export function exampleFromRun(
  serviceUUID: string,
  characteristicUUID: string,
  op: OperationAnnotation,
  record: OperationRunRecord,
  responseCharacteristicUUID?: string,
): BleExample | null {
  if (!record.requestHex && !record.responseHex) return null
  const name = `${op.name || op.operationId || 'op'}${record.variantLabel ? ` [${record.variantLabel}]` : ''} · ${record.result.toUpperCase()}`
  return {
    id: newExampleId(),
    name,
    serviceUUID,
    characteristicUUID,
    operationId: op.operationId || undefined,
    opId: op.id,
    request: record.requestHex ? { hex: record.requestHex, timestamp: record.timestamp } : undefined,
    response: record.responseHex
      ? { hex: record.responseHex, characteristicUUID: responseCharacteristicUUID || op.expect?.responseCharacteristicUUID || undefined, rttMs: record.rttMs ?? undefined, timestamp: record.timestamp }
      : undefined,
    tags: [record.result],
    createdAt: Date.now(),
  }
}

/** 落库：解析不到集合时为该设备自动建一个 */
export function saveExampleForDevice(deviceId: string, deviceName: string, example: BleExample): BleCollection {
  const col = ensureCollectionForDevice(deviceId, deviceName)
  return addExampleToCollection(col.id, example) ?? col
}
