import { normalizeUUID, shortUUID } from './hex'
import type { LogEntry, BleProtocolSample, DeviceReportInfo } from './buffer'

export interface ProtocolFieldDoc {
  offset: string
  length: string
  type: string
  name: string
  meaning: string
}

export interface ProtocolInterfaceDoc {
  name: string
  operationId: string
  request?: string
  response?: string
  requestExample?: string
  responseExample?: string
  mock?: string
  description?: string
  requestFields: ProtocolFieldDoc[]
  responseFields: ProtocolFieldDoc[]
}

export interface ProtocolCharacteristicDoc {
  uuid: string
  name: string
  properties: string[]
  direction?: string
  valueFormat?: string
  description?: string
  interfaces: ProtocolInterfaceDoc[]
}

export interface ProtocolServiceDoc {
  uuid: string
  name: string
  summary?: string
  validWhen?: string
  role?: string
  characteristics: ProtocolCharacteristicDoc[]
}

export interface ProtocolProfileDoc {
  id: string
  name: string
  version: string
  summary?: string
  services: ProtocolServiceDoc[]
  sourceMarkdown: string
}

export interface MatchedProtocolDocs {
  profiles: ProtocolProfileDoc[]
  serviceDocs: Record<string, ProtocolServiceDoc>
  charDocs: Record<string, ProtocolCharacteristicDoc>
}

type ParseScope = 'profile' | 'service' | 'char' | 'interface'
type TableScope = 'requestFields' | 'responseFields' | null

function normalizeKey(key: string): string {
  return key.trim().replace(/\s+/g, '').toLowerCase()
}

function splitCsv(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter(Boolean)
}

function parseFrontMatter(markdown: string): { meta: Record<string, string>; body: string } {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { meta: {}, body: markdown }
  const meta: Record<string, string> = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx > -1) meta[normalizeKey(line.slice(0, idx))] = line.slice(idx + 1).trim()
  }
  return { meta, body: markdown.slice(match[0].length) }
}

function assignValue(target: any, key: string, value: string) {
  const k = normalizeKey(key)
  if (k === 'uuid') target.uuid = normalizeUUID(value)
  else if (k === 'properties') target.properties = splitCsv(value).map((v) => v.toUpperCase())
  else if (k === 'operationid') target.operationId = value
  else if (k === 'requestexample') target.requestExample = value
  else if (k === 'responseexample') target.responseExample = value
  else if (k === 'valueformat') target.valueFormat = value
  else if (k === 'validwhen') target.validWhen = value
  else target[k] = value
}

function parseTableRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim())
}

export function parseProtocolMarkdown(markdown: string): ProtocolProfileDoc {
  const { meta, body } = parseFrontMatter(markdown)
  const profile: ProtocolProfileDoc = {
    id: meta.id || 'unknown-profile',
    name: meta.name || 'Unnamed BLE Profile',
    version: meta.version || '0.0.0',
    summary: meta.summary,
    services: [],
    sourceMarkdown: markdown,
  }

  let scope: ParseScope = 'profile'
  let tableScope: TableScope = null
  let currentService: ProtocolServiceDoc | null = null
  let currentChar: ProtocolCharacteristicDoc | null = null
  let currentInterface: ProtocolInterfaceDoc | null = null

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const heading = line.match(/^(#{2,5})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const title = heading[2].trim()
      tableScope = null

      if (level === 2 && title.toLowerCase().startsWith('service:')) {
        currentService = {
          uuid: '',
          name: title.replace(/^service:\s*/i, '').trim(),
          characteristics: [],
        }
        profile.services.push(currentService)
        currentChar = null
        currentInterface = null
        scope = 'service'
      } else if (level === 3 && title.toLowerCase().startsWith('characteristic:') && currentService) {
        currentChar = {
          uuid: '',
          name: title.replace(/^characteristic:\s*/i, '').trim(),
          properties: [],
          interfaces: [],
        }
        currentService.characteristics.push(currentChar)
        currentInterface = null
        scope = 'char'
      } else if (level === 4 && title.toLowerCase().startsWith('interface:') && currentChar) {
        currentInterface = {
          name: title.replace(/^interface:\s*/i, '').trim(),
          operationId: '',
          requestFields: [],
          responseFields: [],
        }
        currentChar.interfaces.push(currentInterface)
        scope = 'interface'
      } else if (level === 5) {
        const low = title.toLowerCase()
        if (low.includes('request')) tableScope = 'requestFields'
        else if (low.includes('response')) tableScope = 'responseFields'
      }
      continue
    }

    if (line.startsWith('|') && tableScope && currentInterface) {
      if (/^\|?\s*:?-+:?\s*\|/.test(line)) continue
      const cells = parseTableRow(line)
      if (cells.length >= 5 && normalizeKey(cells[0]) !== 'offset') {
        currentInterface[tableScope].push({
          offset: cells[0],
          length: cells[1],
          type: cells[2],
          name: cells[3],
          meaning: cells.slice(4).join(' | '),
        })
      }
      continue
    }

    const bullet = line.match(/^-\s*([^:]+):\s*(.*)$/)
    if (!bullet) continue
    const key = bullet[1]
    const value = bullet[2]
    const target =
      scope === 'interface' ? currentInterface :
      scope === 'char' ? currentChar :
      scope === 'service' ? currentService :
      profile
    if (target) assignValue(target, key, value)
  }

  return profile
}

export function matchProtocolDocs(profiles: ProtocolProfileDoc[], serviceUUIDs: string[]): MatchedProtocolDocs {
  const serviceSet = new Set(serviceUUIDs.map(normalizeUUID))
  const matchedProfiles: ProtocolProfileDoc[] = []
  const serviceDocs: Record<string, ProtocolServiceDoc> = {}
  const charDocs: Record<string, ProtocolCharacteristicDoc> = {}

  for (const profile of profiles) {
    let profileMatched = false
    for (const service of profile.services) {
      const serviceUUID = normalizeUUID(service.uuid)
      if (serviceSet.has(serviceUUID)) {
        profileMatched = true
        serviceDocs[serviceUUID] = service
        for (const char of service.characteristics) {
          charDocs[`${serviceUUID}::${normalizeUUID(char.uuid)}`] = char
        }
      }
    }
    if (profileMatched) matchedProfiles.push(profile)
  }

  return { profiles: matchedProfiles, serviceDocs, charDocs }
}

export function getServiceDoc(matched: MatchedProtocolDocs, serviceUUID: string): ProtocolServiceDoc | null {
  return matched.serviceDocs[normalizeUUID(serviceUUID)] ?? null
}

export function getCharacteristicDoc(
  matched: MatchedProtocolDocs,
  serviceUUID: string,
  charUUID: string,
): ProtocolCharacteristicDoc | null {
  return matched.charDocs[`${normalizeUUID(serviceUUID)}::${normalizeUUID(charUUID)}`] ?? null
}

function fenceJson(value: unknown): string {
  return '```json\n' + JSON.stringify(value, null, 2) + '\n```'
}

function logEndpoint(log: LogEntry): string {
  const svc = log.serviceUUID ? shortUUID(log.serviceUUID) : 'unknown-service'
  const chr = log.characteristicUUID ? shortUUID(log.characteristicUUID) : 'unknown-char'
  return `${svc} / ${chr}`
}

export interface AiExportInfo {
  device: DeviceReportInfo
  profiles: ProtocolProfileDoc[]
  logs: LogEntry[]
  samples: BleProtocolSample[]
}

export function buildAiDebugReportMarkdown(info: AiExportInfo): string {
  const now = new Date().toISOString()
  const lines: string[] = [
    '# BLE AI Debug Report',
    '',
    '## Device',
    '',
    `- Name: ${info.device.name}`,
    `- Device ID: ${info.device.deviceId || 'unknown'}`,
    `- RSSI: ${info.device.rssi != null ? `${info.device.rssi} dBm` : 'unknown'}`,
    `- MTU: ${info.device.mtu ?? 'unknown'}`,
    `- Generated At: ${now}`,
    '',
    '## Matched Built-in Profiles',
    '',
  ]

  if (!info.profiles.length) {
    lines.push('- No built-in profile matched. Treat services as vendor-specific until annotated.')
  } else {
    for (const profile of info.profiles) {
      lines.push(`- ${profile.name} (${profile.id}, v${profile.version}): ${profile.summary ?? ''}`)
    }
  }

  lines.push('', '## Services, Characteristics, And Interfaces', '')
  for (const service of info.device.services) {
    const doc = info.profiles.flatMap((p) => p.services).find((s) => normalizeUUID(s.uuid) === normalizeUUID(service.uuid))
    lines.push(`### Service ${shortUUID(service.uuid)}`)
    lines.push('')
    lines.push(`- UUID: \`${service.uuid}\``)
    lines.push(`- Primary: ${service.isPrimary}`)
    if (doc) {
      lines.push(`- Name: ${doc.name}`)
      lines.push(`- Role: ${doc.role ?? 'unspecified'}`)
      lines.push(`- Summary: ${doc.summary ?? ''}`)
      lines.push(`- Valid When: ${doc.validWhen ?? ''}`)
    }
    lines.push('')
    if (!service.characteristics.length) {
      lines.push('- No loaded characteristics.')
      lines.push('')
      continue
    }
    for (const ch of service.characteristics) {
      const charDoc = doc?.characteristics.find((c) => normalizeUUID(c.uuid) === normalizeUUID(ch.uuid))
      const propNames = Object.entries(ch.properties).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'
      lines.push(`#### Characteristic ${shortUUID(ch.uuid)}`)
      lines.push('')
      lines.push(`- UUID: \`${ch.uuid}\``)
      lines.push(`- Properties: ${propNames}`)
      if (charDoc) {
        lines.push(`- Name: ${charDoc.name}`)
        lines.push(`- Direction: ${charDoc.direction ?? 'unspecified'}`)
        lines.push(`- Value Format: ${charDoc.valueFormat ?? 'unknown'}`)
        lines.push(`- Description: ${charDoc.description ?? ''}`)
        for (const api of charDoc.interfaces) {
          lines.push('')
          lines.push(`##### Interface: ${api.name}`)
          lines.push(`- Operation ID: \`${api.operationId || 'unknown'}\``)
          lines.push(`- Request: ${api.request || 'NONE'}`)
          lines.push(`- Response: ${api.response || 'NONE'}`)
          lines.push(`- Request Example: \`${api.requestExample || ''}\``)
          lines.push(`- Response Example: \`${api.responseExample || ''}\``)
          lines.push(`- Mock Rule: ${api.mock || 'none'}`)
        }
      }
      lines.push('')
    }
  }

  lines.push('## Saved Samples', '')
  if (!info.samples.length) {
    lines.push('- No saved samples yet. Long press a TX/RX log entry in the debug page to save one.')
  } else {
    for (const sample of info.samples) {
      lines.push(`- ${sample.name} [${sample.direction}] ${shortUUID(sample.serviceUUID)} / ${shortUUID(sample.characteristicUUID)}: \`${sample.hex}\``)
    }
  }

  lines.push('', '## Recent Communication Logs', '')
  for (const log of info.logs.slice(-80)) {
    if (log.direction === 'SYS') {
      lines.push(`- ${new Date(log.timestamp).toISOString()} SYS ${log.ascii}`)
    } else {
      lines.push(`- ${new Date(log.timestamp).toISOString()} ${log.direction} ${logEndpoint(log)} ${log.rawLength}B HEX=\`${log.hex}\` ASCII=\`${log.ascii}\``)
    }
  }

  lines.push('', '## Machine-readable Mock Seed', '', fenceJson(buildMockPack(info)))
  return lines.join('\n')
}

export function buildProtocolSpecJson(info: AiExportInfo): string {
  return JSON.stringify({
    kind: 'ble-protocol-spec',
    version: '0.1.0',
    device: info.device,
    matchedProfiles: info.profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      version: profile.version,
      summary: profile.summary,
      services: profile.services,
    })),
    savedSamples: info.samples,
  }, null, 2)
}

export function buildMockPack(info: AiExportInfo) {
  const presentServiceUUIDs = new Set(info.device.services.map((service) => normalizeUUID(service.uuid)))
  return {
    kind: 'ble-mock-pack',
    version: '0.1.0',
    device: {
      name: info.device.name,
      deviceId: info.device.deviceId,
      mtu: info.device.mtu,
    },
    services: info.device.services.map((service) => ({
      uuid: service.uuid,
      isPrimary: service.isPrimary,
      characteristics: service.characteristics.map((ch) => ({
        uuid: ch.uuid,
        properties: ch.properties,
        samples: info.samples.filter((s) =>
          normalizeUUID(s.serviceUUID) === normalizeUUID(service.uuid) &&
          normalizeUUID(s.characteristicUUID) === normalizeUUID(ch.uuid)
        ),
      })),
    })),
    profileMocks: info.profiles.flatMap((profile) =>
      profile.services.filter((service) => presentServiceUUIDs.has(normalizeUUID(service.uuid))).flatMap((service) =>
        service.characteristics.flatMap((ch) =>
          ch.interfaces.map((api) => ({
            profileId: profile.id,
            serviceUUID: service.uuid,
            characteristicUUID: ch.uuid,
            operationId: api.operationId,
            name: api.name,
            request: api.request,
            response: api.response,
            requestExample: api.requestExample,
            responseExample: api.responseExample,
            mockRule: api.mock,
          }))
        )
      )
    ),
  }
}

export function buildMockPackJson(info: AiExportInfo): string {
  return JSON.stringify(buildMockPack(info), null, 2)
}
