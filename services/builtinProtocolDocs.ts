import genericCommandProfileMd from '../docs/protocols/generic-command-profile.md?raw'
import nordicUartServiceMd from '../docs/protocols/nordic-uart-service.md?raw'
import standardGattBasicsMd from '../docs/protocols/standard-gatt-basics.md?raw'
import {
  matchProtocolDocs,
  parseProtocolMarkdown,
  type MatchedProtocolDocs,
  type ProtocolProfileDoc,
} from '../utils/protocolDocs'

const BUILTIN_MARKDOWN_SOURCES = [
  genericCommandProfileMd,
  nordicUartServiceMd,
  standardGattBasicsMd,
]

let cachedProfiles: ProtocolProfileDoc[] | null = null

export function getBuiltinProtocolProfiles(): ProtocolProfileDoc[] {
  if (!cachedProfiles) {
    cachedProfiles = BUILTIN_MARKDOWN_SOURCES.map(parseProtocolMarkdown)
  }
  return cachedProfiles
}

export function matchBuiltinProtocolDocs(serviceUUIDs: string[]): MatchedProtocolDocs {
  return matchProtocolDocs(getBuiltinProtocolProfiles(), serviceUUIDs)
}
