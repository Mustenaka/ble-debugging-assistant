import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const protocolDir = path.join(root, 'docs', 'protocols')

function normalizeKey(key) {
  return key.trim().replace(/\s+/g, '').toLowerCase()
}

function parseFrontMatter(markdown) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!match) return { meta: {}, body: markdown }
  const meta = {}
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':')
    if (idx > -1) meta[normalizeKey(line.slice(0, idx))] = line.slice(idx + 1).trim()
  }
  return { meta, body: markdown.slice(match[0].length) }
}

function parseMarkdown(markdown) {
  const { meta, body } = parseFrontMatter(markdown)
  const profile = {
    id: meta.id || 'unknown-profile',
    name: meta.name || 'Unnamed BLE Profile',
    version: meta.version || '0.0.0',
    summary: meta.summary,
    services: [],
  }
  let service = null
  let characteristic = null
  let api = null
  let scope = 'profile'
  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.trim()
    const heading = line.match(/^(#{2,4})\s+(.+)$/)
    if (heading) {
      const level = heading[1].length
      const title = heading[2]
      if (level === 2 && title.toLowerCase().startsWith('service:')) {
        service = { name: title.replace(/^service:\s*/i, ''), characteristics: [] }
        profile.services.push(service)
        characteristic = null
        api = null
        scope = 'service'
      } else if (level === 3 && service && title.toLowerCase().startsWith('characteristic:')) {
        characteristic = { name: title.replace(/^characteristic:\s*/i, ''), interfaces: [] }
        service.characteristics.push(characteristic)
        api = null
        scope = 'characteristic'
      } else if (level === 4 && characteristic && title.toLowerCase().startsWith('interface:')) {
        api = { name: title.replace(/^interface:\s*/i, '') }
        characteristic.interfaces.push(api)
        scope = 'interface'
      }
      continue
    }
    const bullet = line.match(/^-\s*([^:]+):\s*(.*)$/)
    if (!bullet) continue
    const target =
      scope === 'interface' ? api :
      scope === 'characteristic' ? characteristic :
      scope === 'service' ? service :
      profile
    target[normalizeKey(bullet[1])] = bullet[2]
  }
  return profile
}

const profiles = fs.readdirSync(protocolDir)
  .filter((name) => name.endsWith('.md') && name.toLowerCase() !== 'readme.md')
  .map((name) => parseMarkdown(fs.readFileSync(path.join(protocolDir, name), 'utf8')))

console.log(JSON.stringify(profiles, null, 2))
