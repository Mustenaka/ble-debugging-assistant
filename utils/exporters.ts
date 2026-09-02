/**
 * Debug Pack 导出生成器（阶段④重构）
 *
 * 产物拆分为职责清晰的文档集：
 *   README.md       — 包索引（人读）
 *   PROTOCOL.md     — 接口解析文档（人读，含字段表，无 JSON 块）
 *   protocol.json   — 接口文档机器可读孪生
 *   SESSION_LOG.md  — 传输过程记录（会话元信息 + 心跳统计 + 时间线）
 *   logs.csv        — 全量原始日志
 *   AI_PROMPT.md    — AI 上下文（引用而非内嵌其他文件）
 *   mock.json       — Mock seed
 */

import { normalizeUUID, shortUUID } from './hex'
import {
  formatTimestamp,
  exportLogsToCSV,
  type LogEntry,
  type BleProtocolSample,
  type DeviceReportInfo,
} from './buffer'
import type {
  MatchedProtocolDocs,
  ProtocolProfileDoc,
  ProtocolServiceDoc,
  ProtocolCharacteristicDoc,
  ProtocolInterfaceDoc,
  ProtocolFieldDoc,
  DebugPackPurpose,
} from './protocolDocs'
import { buildMockPack } from './protocolDocs'
import { isHeartbeatLabel } from './heartbeat'
import {
  operationToInterfaceDoc,
  sessionDurationMs,
  operationRunKey,
  type DeviceAnnotations,
  type SessionMeta,
  type OperationRunRecord,
} from './deviceArchive'
import { serializeCollection, type BleCollection } from './collection'
import { buildMockSpecFromCollection } from '../services/mockBle'

export interface DebugPackExportOptions {
  purpose: DebugPackPurpose
  notes: string
  includeRawLogs: boolean
  redactDeviceId: boolean
  includeProtocolDoc: boolean
  includeSessionLog: boolean
  includeAiPrompt: boolean
  includeMock: boolean
}

export interface ExportContext {
  device: DeviceReportInfo
  mergedDocs: MatchedProtocolDocs
  builtinProfiles: ProtocolProfileDoc[]
  annotations: DeviceAnnotations | null
  logs: LogEntry[]
  samples: BleProtocolSample[]
  sessionMeta: SessionMeta | null
  /** 命令执行记录（runKey → 最近执行列表），进 SESSION_LOG.md */
  operationRuns?: Record<string, OperationRunRecord[]>
  /** 设备匹配到的集合（导出 collection.json，AI 可回写后再导入） */
  collection?: BleCollection | null
  options: DebugPackExportOptions
}

export interface DebugPackFile {
  name: string
  content: string
}

// ── 辅助 ────────────────────────────────────────────────────────────────────

function deviceIdFor(ctx: ExportContext): string {
  return ctx.options.redactDeviceId ? '(redacted)' : ctx.device.deviceId || 'unknown'
}

function serviceDocOf(ctx: ExportContext, serviceUUID: string): ProtocolServiceDoc | null {
  return ctx.mergedDocs.serviceDocs[normalizeUUID(serviceUUID)] ?? null
}

function charDocOf(ctx: ExportContext, serviceUUID: string, charUUID: string): ProtocolCharacteristicDoc | null {
  return ctx.mergedDocs.charDocs[`${normalizeUUID(serviceUUID)}::${normalizeUUID(charUUID)}`] ?? null
}

function endpointName(ctx: ExportContext, serviceUUID?: string, charUUID?: string): string {
  if (!serviceUUID || !charUUID) return ''
  const doc = charDocOf(ctx, serviceUUID, charUUID)
  return doc?.name || ''
}

function propsText(p: { read?: boolean; write?: boolean; writeNoResponse?: boolean; notify?: boolean; indicate?: boolean }): string {
  const tags: string[] = []
  if (p.read) tags.push('READ')
  if (p.write) tags.push('WRITE')
  if (p.writeNoResponse) tags.push('WRITE_NR')
  if (p.notify) tags.push('NOTIFY')
  if (p.indicate) tags.push('INDICATE')
  return tags.join(', ') || '—'
}

function fieldTableMd(fields: ProtocolFieldDoc[]): string[] {
  if (!fields.length) return []
  const lines = [
    '| Offset | Length | Type | Name | Meaning |',
    '|:-------|:-------|:-----|:-----|:--------|',
  ]
  for (const f of fields) {
    lines.push(`| ${f.offset || '—'} | ${f.length || '—'} | ${f.type || '—'} | ${f.name || '—'} | ${f.meaning || '—'} |`)
  }
  return lines
}

function interfaceMd(api: ProtocolInterfaceDoc): string[] {
  const lines: string[] = [`#### ${api.name || api.operationId || 'Unnamed Operation'}`, '']
  if (api.operationId) lines.push(`- Operation ID: \`${api.operationId}\``)
  if (api.description) lines.push(`- Description: ${api.description}`)
  if (api.mock) lines.push(`- Mock Rule: ${api.mock}`)
  lines.push('')
  lines.push('**Request**')
  lines.push('')
  if (api.request) lines.push(`- Frame: \`${api.request}\``)
  if (api.payload) lines.push(`- Payload Template: \`${api.payload}\``)
  if (api.requestExample) lines.push(`- Example: \`${api.requestExample}\``)
  if (!api.request && !api.requestExample && !api.payload && !api.requestFields.length) lines.push('- (none)')
  lines.push('')
  lines.push(...fieldTableMd(api.requestFields))
  lines.push('')
  lines.push('**Response**')
  lines.push('')
  if (api.response) lines.push(`- Frame: \`${api.response}\``)
  if (api.responseExample) lines.push(`- Example: \`${api.responseExample}\``)
  if (!api.response && !api.responseExample && !api.responseFields.length) lines.push('- (none)')
  lines.push('')
  lines.push(...fieldTableMd(api.responseFields))
  lines.push('')
  return lines
}

function formatBytesText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatDurationText(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

// ── PROTOCOL.md 接口解析文档 ────────────────────────────────────────────────

export function buildProtocolMarkdown(ctx: ExportContext): string {
  const now = formatTimestamp(Date.now(), true)
  const lines: string[] = [
    `# BLE Protocol Documentation — ${ctx.device.name}`,
    '',
    '## Device',
    '',
    '| Field | Value |',
    '|:------|:------|',
    `| Name | ${ctx.device.name} |`,
    `| Device ID | \`${deviceIdFor(ctx)}\` |`,
    `| MTU | ${ctx.device.mtu ?? 'unknown'} |`,
    `| Generated | ${now} |`,
    '',
  ]

  if (ctx.options.notes.trim()) {
    lines.push('## Notes', '', `> ${ctx.options.notes.trim().replace(/\n/g, '\n> ')}`, '')
  }

  if (ctx.collection?.variables?.length) {
    lines.push('## Variables', '')
    lines.push('Payload templates may reference these with `{{name}}` (hex bytes) or `{{name:u16le}}` (typed).', '')
    lines.push('| Name | Value | Description |', '|:-----|:------|:------------|')
    for (const v of ctx.collection.variables) {
      lines.push(`| ${v.name} | \`${v.value}\` | ${v.description ?? ''} |`)
    }
    lines.push('')
  }

  lines.push('## Services & Endpoints', '')

  for (const svc of ctx.device.services) {
    const doc = serviceDocOf(ctx, svc.uuid)
    const title = doc?.name ? `${doc.name} (${shortUUID(svc.uuid)})` : `Service ${shortUUID(svc.uuid)}`
    lines.push(`### ${title}`, '')
    lines.push(`- UUID: \`${svc.uuid}\``)
    lines.push(`- Primary: ${svc.isPrimary}`)
    if (doc?.role) lines.push(`- Role: ${doc.role}`)
    if (doc?.summary) lines.push(`- Summary: ${doc.summary}`)
    lines.push('')

    if (!svc.charsLoaded) {
      lines.push('> ⚠ Characteristics not loaded when exporting.', '')
      continue
    }
    if (!svc.characteristics.length) {
      lines.push('> No characteristics.', '')
      continue
    }

    for (const ch of svc.characteristics) {
      const charDoc = charDocOf(ctx, svc.uuid, ch.uuid)
      const charTitle = charDoc?.name ? `${charDoc.name} (${shortUUID(ch.uuid)})` : `Characteristic ${shortUUID(ch.uuid)}`
      lines.push(`#### ${charTitle}`, '')
      lines.push(`- UUID: \`${ch.uuid}\``)
      lines.push(`- Properties: ${propsText(ch.properties)}`)
      if (charDoc?.direction) lines.push(`- Direction: ${charDoc.direction}`)
      if (charDoc?.valueFormat) lines.push(`- Value Format: ${charDoc.valueFormat}`)
      if (charDoc?.description) lines.push(`- Description: ${charDoc.description}`)
      if (!charDoc) lines.push('- Status: unannotated — treat as vendor-specific')
      lines.push('')
      for (const api of charDoc?.interfaces ?? []) {
        // 接口标题在特征值层级下降一级展示
        const apiLines = interfaceMd(api).map((l) => (l.startsWith('#### ') ? '##' + l : l))
        lines.push(...apiLines)
      }
    }
  }

  // 已存样例附录
  lines.push('## Saved Samples', '')
  if (!ctx.samples.length) {
    lines.push('- (none)')
  } else {
    lines.push('| Name | Direction | Endpoint | HEX |', '|:-----|:----------|:---------|:----|')
    for (const s of ctx.samples) {
      const name = endpointName(ctx, s.serviceUUID, s.characteristicUUID) || `${shortUUID(s.serviceUUID)}/${shortUUID(s.characteristicUUID)}`
      lines.push(`| ${s.name} | ${s.direction} | ${name} | \`${s.hex}\` |`)
    }
  }
  lines.push('', '---', `*Generated by BLE Debugging Assistant — ${now}*`)
  return lines.join('\n')
}

// ── protocol.json ───────────────────────────────────────────────────────────

export function buildProtocolJson(ctx: ExportContext): string {
  const services = ctx.device.services.map((svc) => {
    const doc = serviceDocOf(ctx, svc.uuid)
    return {
      uuid: svc.uuid,
      isPrimary: svc.isPrimary,
      name: doc?.name || null,
      role: doc?.role || null,
      summary: doc?.summary || null,
      characteristics: svc.characteristics.map((ch) => {
        const charDoc = charDocOf(ctx, svc.uuid, ch.uuid)
        return {
          uuid: ch.uuid,
          properties: ch.properties,
          name: charDoc?.name || null,
          direction: charDoc?.direction || null,
          valueFormat: charDoc?.valueFormat || null,
          description: charDoc?.description || null,
          operations: charDoc?.interfaces ?? [],
        }
      }),
    }
  })

  const col = ctx.collection
  return JSON.stringify({
    kind: 'ble-protocol-spec',
    version: '0.3.0',
    generatedAt: new Date().toISOString(),
    device: {
      name: ctx.device.name,
      deviceId: deviceIdFor(ctx),
      mtu: ctx.device.mtu ?? null,
      rssi: ctx.device.rssi ?? null,
    },
    collection: col
      ? {
          id: col.id,
          name: col.name,
          description: col.description ?? null,
          fingerprint: col.fingerprint,
          variables: col.variables ?? [],
        }
      : null,
    services,
    savedSamples: ctx.samples,
    examples: col?.examples ?? [],
    notes: ctx.options.notes.trim() || null,
  }, null, 2)
}

// ── SESSION_LOG.md 传输过程记录 ─────────────────────────────────────────────

export function buildSessionLogMarkdown(ctx: ExportContext): string {
  const now = formatTimestamp(Date.now(), true)
  const meta = ctx.sessionMeta
  const txFrames = ctx.logs.filter((l) => l.direction === 'TX').length
  const rxFrames = ctx.logs.filter((l) => l.direction === 'RX').length
  const txBytes = ctx.logs.filter((l) => l.direction === 'TX').reduce((s, l) => s + l.rawLength, 0)
  const rxBytes = ctx.logs.filter((l) => l.direction === 'RX').reduce((s, l) => s + l.rawLength, 0)

  const lines: string[] = [
    `# BLE Session Log — ${ctx.device.name}`,
    '',
    '## Session Summary',
    '',
    '| Field | Value |',
    '|:------|:------|',
    `| Device | ${ctx.device.name} (\`${deviceIdFor(ctx)}\`) |`,
    `| Exported | ${now} |`,
  ]
  if (meta) {
    lines.push(`| Session Started | ${formatTimestamp(meta.startedAt, true)} |`)
    lines.push(`| Duration | ${formatDurationText(sessionDurationMs(meta))} |`)
    lines.push(`| Max MTU | ${meta.maxMtu} |`)
    if (meta.rssiMin !== null) {
      lines.push(`| RSSI min/avg/max | ${meta.rssiMin} / ${meta.rssiAvg} / ${meta.rssiMax} dBm |`)
    }
  }
  lines.push(`| TX | ${txFrames} frames · ${formatBytesText(txBytes)} |`)
  lines.push(`| RX | ${rxFrames} frames · ${formatBytesText(rxBytes)} |`)
  lines.push(`| Log Entries | ${ctx.logs.length} |`)
  lines.push('')

  // 心跳统计
  const hb = meta?.heartbeat
  if (hb) {
    const judged = hb.acked + hb.missed
    const lossPct = judged ? Math.round((hb.missed / judged) * 1000) / 10 : 0
    lines.push('## Heartbeat Test', '')
    lines.push('| Metric | Value |', '|:-------|:------|')
    lines.push(`| Sent | ${hb.sent} |`)
    lines.push(`| Acked | ${hb.acked} |`)
    lines.push(`| Missed | ${hb.missed} |`)
    lines.push(`| Loss | ${lossPct}% |`)
    if (hb.rttAvgMs !== null) {
      lines.push(`| RTT min/avg/max | ${hb.rttMinMs} / ${hb.rttAvgMs} / ${hb.rttMaxMs} ms |`)
    }
    lines.push('')
  }

  // 按 endpoint 的流量统计
  const endpointStats = new Map<string, { name: string; tx: number; rx: number; txBytes: number; rxBytes: number }>()
  for (const log of ctx.logs) {
    if (log.direction === 'SYS' || !log.serviceUUID || !log.characteristicUUID) continue
    const key = `${normalizeUUID(log.serviceUUID)}::${normalizeUUID(log.characteristicUUID)}`
    const name = endpointName(ctx, log.serviceUUID, log.characteristicUUID) ||
      `${shortUUID(log.serviceUUID)}/${shortUUID(log.characteristicUUID)}`
    const stat = endpointStats.get(key) ?? { name, tx: 0, rx: 0, txBytes: 0, rxBytes: 0 }
    if (log.direction === 'TX') { stat.tx++; stat.txBytes += log.rawLength }
    else { stat.rx++; stat.rxBytes += log.rawLength }
    endpointStats.set(key, stat)
  }
  if (endpointStats.size) {
    lines.push('## Traffic by Endpoint', '')
    lines.push('| Endpoint | TX Frames | TX Bytes | RX Frames | RX Bytes |')
    lines.push('|:---------|:----------|:---------|:----------|:---------|')
    endpointStats.forEach((stat) => {
      lines.push(`| ${stat.name} | ${stat.tx} | ${formatBytesText(stat.txBytes)} | ${stat.rx} | ${formatBytesText(stat.rxBytes)} |`)
    })
    lines.push('')
  }

  // 命令执行记录（Runnable Operation 判定历史）
  const runs = ctx.operationRuns ?? {}
  const runKeys = Object.keys(runs).filter((k) => runs[k]?.length)
  if (runKeys.length) {
    // runKey → 命令名映射（注释命令按 op.id 对应；builtin 前缀直接展示）
    const nameByKey = new Map<string, string>()
    for (const charAnn of Object.values(ctx.annotations?.characteristics ?? {})) {
      for (const op of charAnn.operations ?? []) {
        const key = operationRunKey(charAnn.serviceUUID, charAnn.uuid, op.id || op.operationId || op.name)
        nameByKey.set(key, op.name || op.operationId || op.id)
      }
    }
    lines.push('## Operation Runs', '')
    lines.push('| Operation | Results (newest first) | Pass Rate | Avg RTT | Last Run |')
    lines.push('|:----------|:-----------------------|:----------|:--------|:---------|')
    for (const key of runKeys) {
      const list = runs[key]
      const name = nameByKey.get(key) ?? key.split('::').pop()?.replace(/^builtin_/, '') ?? key
      const symbols = list.map((r) =>
        r.result === 'pass' ? '✓' : r.result === 'sent' ? '·' : r.result === 'timeout' ? '⏱' : '✗'
      ).join(' ')
      const judged = list.filter((r) => r.result !== 'sent')
      const passed = judged.filter((r) => r.result === 'pass').length
      const passRate = judged.length ? `${Math.round((passed / judged.length) * 100)}%` : '—'
      const rtts = list.filter((r) => r.rttMs != null).map((r) => r.rttMs as number)
      const avgRtt = rtts.length ? `${Math.round(rtts.reduce((s, v) => s + v, 0) / rtts.length)}ms` : '—'
      lines.push(`| ${name} | ${symbols} | ${passRate} | ${avgRtt} | ${formatTimestamp(list[0].timestamp, true)} |`)
    }
    lines.push('')
  }

  // 时间线
  lines.push('## Timeline', '')
  if (!ctx.options.includeRawLogs) {
    lines.push('- Raw logs were excluded by export option. See export settings.')
  } else if (!ctx.logs.length) {
    lines.push('- No logs captured.')
  } else {
    lines.push('```text')
    for (const log of ctx.logs) {
      const ts = formatTimestamp(log.timestamp, true)
      if (log.direction === 'SYS') {
        lines.push(`${ts}  SYS  ${log.ascii}`)
      } else {
        const heart = isHeartbeatLabel(log.label) ? ` [${log.label}]` : ''
        const name = endpointName(ctx, log.serviceUUID, log.characteristicUUID) ||
          `${shortUUID(log.serviceUUID ?? '')}/${shortUUID(log.characteristicUUID ?? '')}`
        const ascii = log.ascii && log.ascii.trim() ? `  ascii="${log.ascii}"` : ''
        lines.push(`${ts}  ${log.direction.padEnd(3)}  ${name}${heart}  ${log.rawLength}B  ${log.hex}${ascii}`)
      }
    }
    lines.push('```')
  }
  lines.push('', '---', `*Generated by BLE Debugging Assistant — ${now}*`)
  return lines.join('\n')
}

// ── AI_PROMPT.md ────────────────────────────────────────────────────────────

function purposeTask(purpose: DebugPackPurpose): string {
  if (purpose === 'mock') {
    return 'Build or verify a BLE mock plan from the captured device topology, endpoint docs, saved samples, and traffic in this pack.'
  }
  if (purpose === 'share') {
    return 'Help another engineer reproduce this BLE debugging session and understand the documented endpoints, logs, and examples.'
  }
  if (purpose === 'archive') {
    return 'Summarize this BLE debugging session as a reusable protocol and troubleshooting record.'
  }
  return 'Analyze this BLE device protocol: identify request/response relationships, explain likely field meanings, point out anomalies in the traffic, and suggest debugging or mock improvements.'
}

export function buildAiPromptMarkdown(ctx: ExportContext): string {
  const lines: string[] = [
    '# Task',
    '',
    purposeTask(ctx.options.purpose),
    '',
  ]

  if (ctx.options.notes.trim()) {
    lines.push('# Questions / Context From The Engineer', '', ctx.options.notes.trim(), '')
  }

  lines.push(
    '# Device',
    '',
    `- Name: ${ctx.device.name}`,
    `- Device ID: \`${deviceIdFor(ctx)}\``,
    `- MTU: ${ctx.device.mtu ?? 'unknown'}`,
    `- RSSI: ${ctx.device.rssi != null ? ctx.device.rssi + ' dBm' : 'unknown'}`,
    '',
    '# Known Endpoints',
    '',
  )

  let endpointCount = 0
  for (const svc of ctx.device.services) {
    const svcDoc = serviceDocOf(ctx, svc.uuid)
    for (const ch of svc.characteristics) {
      endpointCount++
      const charDoc = charDocOf(ctx, svc.uuid, ch.uuid)
      const name = charDoc?.name ? ` — ${charDoc.name}` : ''
      const ops = charDoc?.interfaces.length
        ? ` — ops: ${charDoc.interfaces.map((i) => i.operationId || i.name).join(', ')}`
        : ''
      lines.push(`- \`${shortUUID(svc.uuid)}/${shortUUID(ch.uuid)}\`${name} [${propsText(ch.properties)}]${svcDoc?.name ? ` (service: ${svcDoc.name})` : ''}${ops}`)
    }
  }
  if (!endpointCount) lines.push('- No characteristics loaded.')
  lines.push('')

  if (ctx.collection?.variables?.length) {
    lines.push('# Variables', '')
    for (const v of ctx.collection.variables) lines.push(`- \`${v.name}\` = \`${v.value}\`${v.description ? ` — ${v.description}` : ''}`)
    lines.push('')
  }

  lines.push('# Saved Examples', '')
  const paired = ctx.collection?.examples ?? []
  if (!ctx.samples.length && !paired.length) {
    lines.push('- (none)')
  } else {
    for (const ex of paired) {
      const req = ex.request?.hex ? `TX \`${ex.request.hex}\`` : ''
      const rsp = ex.response?.hex ? `RX \`${ex.response.hex}\`${ex.response.rttMs != null ? ` (${ex.response.rttMs}ms)` : ''}` : ''
      lines.push(`- ${ex.name} \`${shortUUID(ex.serviceUUID)}/${shortUUID(ex.characteristicUUID)}\`: ${[req, rsp].filter(Boolean).join(' → ')}${ex.note ? ` — ${ex.note}` : ''}`)
    }
    for (const s of ctx.samples) {
      lines.push(`- ${s.name} [${s.direction}] \`${shortUUID(s.serviceUUID)}/${shortUUID(s.characteristicUUID)}\`: \`${s.hex}\``)
    }
  }
  lines.push('')

  lines.push('# Recent Traffic (latest 60 entries)', '')
  const recent = ctx.options.includeRawLogs ? ctx.logs.slice(-60) : []
  if (!recent.length) {
    lines.push('- (raw logs excluded or empty; see logs.csv if included)')
  } else {
    lines.push('```text')
    for (const log of recent) {
      const ts = new Date(log.timestamp).toISOString()
      if (log.direction === 'SYS') lines.push(`${ts} SYS ${log.ascii}`)
      else lines.push(`${ts} ${log.direction} ${shortUUID(log.serviceUUID ?? '')}/${shortUUID(log.characteristicUUID ?? '')} ${log.hex}`)
    }
    lines.push('```')
  }
  lines.push('')

  lines.push(
    '# Attached Files In This Pack',
    '',
    '- `PROTOCOL.md` / `protocol.json` — full endpoint documentation including user-annotated field tables.',
    '- `SESSION_LOG.md` / `logs.csv` — the complete session transfer record and statistics.',
    '- `mock.json` — mock seed for hardware-free reproduction.',
  )
  if (ctx.collection) {
    lines.push('- `collection.json` — the app\'s native Collection file (services, characteristics, runnable operations, variables, examples). It can be imported back into the app.')
  }
  lines.push(
    '',
    '# Output Expectations',
    '',
    '- Map unknown frames to likely operations and explain byte-level field meanings with offsets.',
    '- Point out timing anomalies, unanswered requests, and suspicious frames in the timeline.',
    '- Propose additions to the protocol documentation (names, field tables, mock rules) in the same structure as PROTOCOL.md.',
  )
  if (ctx.collection) {
    lines.push(
      '- Preferably return an updated `collection.json` in the same schema (`kind: "ble-collection"`, `schema: 1`): fill in `name`, `direction`, `valueFormat`, `operations[]` with `payload`, `requestFields` / `responseFields` (`offset`, `length`, `type` such as u8 / u16le / i16be / f32le / ascii / bytes, `name`, `meaning`), `expect.matchHex`, and `variables`. Payloads may use template tokens: `{{len}}`, `{{len:-2}}`, `{{seq}}`, `{{sum}}`, `{{xor}}`, `{{crc8}}`, `{{crc16}}`, `{{variableName}}`, `{{variableName:u16le}}`.',
    )
  }
  return lines.join('\n')
}

// ── mock.json ───────────────────────────────────────────────────────────────

function annotationsPseudoProfile(ctx: ExportContext): ProtocolProfileDoc | null {
  const ann = ctx.annotations
  if (!ann) return null
  const serviceMap = new Map<string, ProtocolServiceDoc>()
  for (const [key, charAnn] of Object.entries(ann.characteristics)) {
    const svcUUID = key.split('::')[0]
    const svc = serviceMap.get(svcUUID) ?? {
      uuid: svcUUID,
      name: ann.services[svcUUID]?.name ?? '',
      summary: ann.services[svcUUID]?.summary,
      role: ann.services[svcUUID]?.role,
      characteristics: [],
    }
    svc.characteristics.push({
      uuid: charAnn.uuid,
      name: charAnn.name ?? '',
      properties: [],
      direction: charAnn.direction,
      valueFormat: charAnn.valueFormat,
      description: charAnn.description,
      interfaces: (charAnn.operations ?? []).map(operationToInterfaceDoc),
    })
    serviceMap.set(svcUUID, svc)
  }
  if (!serviceMap.size) return null
  return {
    id: `user-annotations-${ann.deviceId}`,
    name: `User Annotations (${ann.deviceName ?? ann.deviceId})`,
    version: '1.0.0',
    summary: 'Endpoint documentation annotated by the engineer in-app.',
    services: Array.from(serviceMap.values()),
    sourceMarkdown: '',
  }
}

export function buildMockJson(ctx: ExportContext): string {
  const profiles = [...ctx.builtinProfiles]
  const pseudo = annotationsPseudoProfile(ctx)
  if (pseudo) profiles.push(pseudo)
  const pack = buildMockPack({
    device: { ...ctx.device, deviceId: deviceIdFor(ctx) },
    profiles,
    logs: ctx.logs,
    samples: ctx.samples,
  })
  // 集合的变量 / 配对样例 / 可执行 Mock 规则（与 App 内 Mock 设备一致）
  const col = ctx.collection
  const mockDevice = col ? buildMockSpecFromCollection(col) : null
  return JSON.stringify({
    ...pack,
    variables: col?.variables ?? [],
    examples: col?.examples ?? [],
    mockDevice: mockDevice
      ? { name: mockDevice.name, services: mockDevice.services, rules: mockDevice.rules, periodic: mockDevice.periodic, readValues: mockDevice.readValues }
      : null,
  }, null, 2)
}

// ── README.md + 打包 ────────────────────────────────────────────────────────

function purposeLabel(purpose: DebugPackPurpose): string {
  return { ai: 'AI analysis', mock: 'Mock testing', share: 'Team reproduction', archive: 'Archive' }[purpose] ?? purpose
}

export function buildDebugPackFiles(ctx: ExportContext): DebugPackFile[] {
  const files: DebugPackFile[] = []
  const opts = ctx.options
  const now = formatTimestamp(Date.now(), true)

  const readme: string[] = [
    `# BLE Debug Pack — ${ctx.device.name}`,
    '',
    `- Purpose: ${purposeLabel(opts.purpose)}`,
    `- Device: ${ctx.device.name} (\`${deviceIdFor(ctx)}\`)`,
    `- Generated: ${now}`,
    '',
  ]
  if (opts.notes.trim()) {
    readme.push('## Notes', '', `> ${opts.notes.trim().replace(/\n/g, '\n> ')}`, '')
  }
  readme.push('## Files', '')

  if (opts.includeProtocolDoc) {
    files.push({ name: 'PROTOCOL.md', content: buildProtocolMarkdown(ctx) })
    files.push({ name: 'protocol.json', content: buildProtocolJson(ctx) })
    readme.push('- `PROTOCOL.md` — human-readable endpoint documentation with field tables')
    readme.push('- `protocol.json` — machine-readable protocol spec')
    if (ctx.collection) {
      files.push({ name: 'collection.json', content: serializeCollection(ctx.collection) })
      readme.push('- `collection.json` — importable Collection (operations, variables, examples); share it or let an AI fill it in and import it back')
    }
  }
  if (opts.includeSessionLog) {
    files.push({ name: 'SESSION_LOG.md', content: buildSessionLogMarkdown(ctx) })
    readme.push('- `SESSION_LOG.md` — session summary, heartbeat stats, and annotated timeline')
    if (opts.includeRawLogs) {
      const csvDevice = {
        name: ctx.device.name,
        deviceId: deviceIdFor(ctx),
        txBytes: ctx.logs.filter((l) => l.direction === 'TX').reduce((s, l) => s + l.rawLength, 0),
        rxBytes: ctx.logs.filter((l) => l.direction === 'RX').reduce((s, l) => s + l.rawLength, 0),
      }
      files.push({ name: 'logs.csv', content: exportLogsToCSV(ctx.logs, csvDevice) })
      readme.push('- `logs.csv` — full raw log export')
    }
  }
  if (opts.includeAiPrompt) {
    files.push({ name: 'AI_PROMPT.md', content: buildAiPromptMarkdown(ctx) })
    readme.push('- `AI_PROMPT.md` — ready-to-send AI analysis context')
  }
  if (opts.includeMock) {
    files.push({ name: 'mock.json', content: buildMockJson(ctx) })
    readme.push('- `mock.json` — mock seed for hardware-free reproduction')
  }

  readme.push('', '---', '*Generated by BLE Debugging Assistant*')
  files.unshift({ name: 'README.md', content: readme.join('\n') })
  return files
}
