# Changelog

All notable changes to this project are documented here.

## 0.2.0 — 2026-09-02 · Collections · Payload Templates · Mock Mode

Three product phases that move the app from "BLE connector" toward "Postman for BLE": a shareable Collection entity, runnable payloads for real protocols, and a hardware-free mock provider. A screenshot walkthrough lives in [docs/USER_GUIDE_zh.md](docs/USER_GUIDE_zh.md) / [docs/USER_GUIDE.md](docs/USER_GUIDE.md).

### Added

- **Protocol Collections** (`utils/collection.ts`, `store/collectionStore.ts`): services / characteristics / runnable operations / variables / examples / a device-topology snapshot now live in a Collection that is decoupled from the device instance. Collections match devices by a service-UUID fingerprint (subset match) plus an optional device-name rule (substring or `/regex/`), or by an explicit device binding which always wins. Existing per-device annotations are migrated automatically on first launch (a backup is kept under `ble_device_annotations_legacy`). A second unit of the same product, or a teammate's phone, now gets the same commands.
- **Import**: paste JSON / read from clipboard / pick a file (H5) and import `collection.json`, `protocol.json` (0.1.0 and 0.2.0+), a Debug Pack JSON, or a legacy annotation object. Preview shows counts; import either creates a new collection or merges into an existing one with a "keep local (fill blanks)" or "overwrite" strategy, optionally binding the current device. This closes the loop with AI: export a Debug Pack, let an AI fill in `collection.json`, import it back.
- **Collections & Plugins page** (was the plugin page): lists built-in templates (read-only, duplicable), imported and user collections with fingerprint chips, match/bound badges and stats; per-collection actions: copy JSON, share as file, edit name/description/name rule, bind/unbind the current device, duplicate, delete, connect as a mock device. Reachable from the collection chip on the Workspace page.
- **Debug Pack** now includes `collection.json`; `protocol.json` is bumped to 0.3.0 with collection metadata, variables and paired examples; `AI_PROMPT.md` explains the collection schema and payload template syntax so an AI can hand back an importable file; `PROTOCOL.md` documents variables and payload templates; `mock.json` carries variables, examples and the same mock rules the in-app mock device uses.
- **Payload templates** (`utils/payload.ts`): payloads may contain `{{len}}`, `{{len:-2}}`, `{{len:u16le}}`, `{{seq}}`, `{{sum}}`, `{{xor}}`, `{{crc8}}`, `{{crc16}}` (MODBUS), `{{crc16ccitt}}`, `{{variable}}` (hex bytes) and `{{variable:u16le}}` (typed). Checksums cover the bytes before them; `{{seq}}` is a per-session counter that advances on every send. Templates work in operations, variants, and the free-form console input (with a token picker and live rendered preview), and are rendered by the store at send time.
- **Variables & environment**: collection-level variables (exported with the collection) and per-device overrides (local only), edited from the `{ }` button in the command panel; sequence counter shown and resettable there.
- **Typed fields** (`utils/fields.ts`): field-table types are normalized (`uint8`, `u16 LE`, `int16BE`, `float`, `string`, `utf-8`, `bytes`, `bool`, `bitmask`, `bcd`…), selectable from a picker in the field table, and drive three things: RX/TX log entries are decoded into `name=value` chips (from the matched operation, or from the merged built-in/collection docs of that characteristic), variables/variants encode typed values, and assertions compare decoded values.
- **Field assertions**: besides the existing "bytes at offset equal HEX", an operation can assert on a named response field with `==`, `!=`, `>`, `>=`, `<`, `<=`, `in` (comma list) and `range` (`a..b`); failures report the decoded value.
- **Runner options** for sequence runs: step delay, stop on first failure, loop count, expand variants into separate steps; the report shows an aborted marker and average RTT. Options persist.
- **Paired examples**: long-press a TX log entry → "save as paired example" auto-matches the next RX within 2 s; long-press a command → "save last run as example". Examples live in the collection, feed the operation editor's fill chips, the exported docs, and the mock device.
- **Mock mode** (`services/mockBle.ts`): a Demo/Mock toggle in Settings (and a "No hardware? Connect demo device" shortcut on an empty scan list) adds virtual devices to scan results — a built-in demo device matching the built-in templates (command/response, periodic events, battery, device info) and one mock device per collection that has a topology snapshot plus response rules derived from operations and paired examples. `bleManager` routes every `mock:` device ID to the provider, and scanning falls back to a virtual scan when no real adapter is available (H5 / no permission), so the whole flow can be exercised without hardware.

### Changed

- Tabs renamed to Scan / Workspace / Console; the Workspace page shows which collection the connected device resolved to.
- `ProtocolInterfaceDoc` gained an optional `payload` template field; built-in Markdown templates may declare `- payload:`.
- Android/iOS system file sharing was factored into `shareFileWithSystem` (`utils/buffer.ts`) and reused by Debug Pack and collection export.

- **Zip import** (`utils/zipReader.ts`, `utils/importFile.ts`): the import sheet's "Choose file" now accepts `.json` and `.zip` on H5 (browser file picker) and Android (system document picker via `ACTION_OPEN_DOCUMENT`); a Debug Pack zip is parsed in JS (store + deflate via `DecompressionStream`) and the best candidate is picked automatically (`collection.json` > `protocol.json` > `debug-pack.json`), with a native `plus.zip` fallback on Android when the WebView cannot inflate. iOS keeps paste / clipboard import.
- **Collection detail page** (`pages/collection/index.vue`): tap a collection card to open it. Shows fingerprint, name rule, bound devices and the topology snapshot; edits collection variables in place; lists operations per characteristic with edit (shared Operation Editor, written straight back to the collection) and delete; lists paired examples with rename / edit note / delete. Header actions: copy JSON, share file, edit info, connect as mock, duplicate (built-in) or delete.

### Fixed (verified on a Xiaomi Android 16 device via the HBuilderX standard base)

- Connecting from Scan / Workspace / Collections now lands on the Console: the console is a tab page, so `navigateTo` silently failed; switched to `switchTab`.
- Bottom-sheet editors (operation, annotation, heartbeat) could not scroll when their content exceeded the screen: the panel used `max-height`, so the flex `scroll-view` inside never got a definite height. Panels now use a fixed percentage height.
- The operation editor auto-discovers characteristics when opened right after connecting, instead of showing "no target characteristic".
- Built-in template commands now carry a default expected response (notify characteristic in the same service + first byte of the response example), so they judge PASS/FAIL out of the box; event-type interfaces (`request: NONE`) are no longer listed as runnable.
- Android import: ContentResolver / Cursor / InputStream calls go through `plus.android.invoke` (their runtime classes are non-public and not auto-proxied), and file copying uses `android.os.FileUtils.copy` instead of the varargs `Files.copy`.
- Copy that still said "Device page" now says "Workspace".

### Notes

- Descriptor access and bonding state remain platform limitations of the uni-app BLE API.
- iOS has no in-app file picker yet; use paste / clipboard import there.

## 2026-09-02

### Fixed

- Bottom-sheet editors (operation/annotation/heartbeat), the command panel, the debug send area, and the history page now pad for the system navigation bar (`safe-area-inset-bottom`), so the save button is no longer hidden behind it and lists scroll fully into view.
- The app version shown on the Scan page chip and in Settings → About now follows `manifest.json`'s `versionName` at runtime instead of a hardcoded "v1.0".

### Added

- Made operations runnable, Postman-style: each operation now carries an action (WRITE / WRITE NR / READ), an executable payload (HEX/ASCII), and an optional expected response (response characteristic, HEX prefix match, timeout) that judges every run as PASS / FAIL / TIMEOUT. Notify is enabled automatically on the response characteristic when needed, and every run is logged and persisted (last 10 per operation).
- Added a Command Collection panel on the Debug page — a dedicated Commands tab on phones and a permanent third column on wide screens. Commands are grouped by service/characteristic with run-history dots, last RTT, one-tap ▶ execution, tap-to-fill into the send box, long-press actions (run / fill / edit / duplicate / delete), and per-characteristic quick add.
- Added a unified Operation Editor (execution fields + expected response + field-level assertions + payload variants + collapsible doc fields) used by both the command panel and the annotation editor.
- Added payload variants: enum values of one command (e.g. 01=on / 02=read / 03=off) shown as chips that execute directly.
- Added field-level response assertions: bytes at a given offset must equal the expected HEX value, otherwise the run fails with the mismatch reason.
- Added sequence runs: select multiple commands and execute them in order, with a per-command PASS/FAIL report modal and a summary system log.
- Added "create command from log entry" (long-press a TX log) and "import quick commands" (bind existing global quick commands to a characteristic as runnable operations).
- Added an "Operation Runs" section to the exported `SESSION_LOG.md` with result history, pass rate, and average RTT per command.

## 2026-09-01

### Added

- Added a persistent per-device session archive (`utils/deviceArchive.ts`): every connection is recorded as a session (logs, TX/RX stats, RSSI range, MTU, disconnect reason, heartbeat stats) with throttled flushing, per-device/session caps, and automatic pruning.
- Added a Transfer History page (`pages/history/`) with device-grouped session lists, per-session detail (summary, heartbeat stats, filterable timeline with pagination), session deletion, device history clearing, and single-session `SESSION_LOG.md` export. Phone uses drill-down navigation; wide screens use a master-detail two-pane layout.
- Added history entry points on Device page session cards and Scan page recent devices.
- Added user protocol annotations: services, characteristics, and operations (with request/response field tables, examples, and mock rules) are editable in-app via a new Annotation Editor, stored per device, and merged over built-in protocol templates (user annotations win). Operation counts and annotated names surface in the Device page service tree.
- Added heartbeat connection soak testing: per-device configurable payload (HEX/ASCII, fill from quick commands), interval, write mode, and optional response verification (response characteristic, HEX prefix match, timeout). Live stats (sent/acked/missed/loss %, RTT min/avg/max, RTT trend bars), consecutive-miss warnings, auto Notify enabling, heartbeat entries in the log stream with a filter toggle, and heartbeat stats recorded into the session archive and exports.

### Changed

- Rebuilt Debug Pack export from one mixed Markdown file into a zipped document set: `README.md`, `PROTOCOL.md` + `protocol.json` (annotation-merged endpoint docs with field tables), `SESSION_LOG.md` + `logs.csv` (session summary, heartbeat stats, per-endpoint traffic, annotated timeline), `AI_PROMPT.md` (references pack files instead of embedding JSON), and `mock.json`. Export modal now selects which documents to include; Android/iOS package to zip via native APIs, H5 downloads files individually.
- Removed the dead legacy heartbeat scaffolding from `services/bleManager.ts`; heartbeat now runs in the BLE store with full logging and statistics.

## 2026-05-15

### Fixed

- Fixed quick-command saving flow by replacing the fragile command-name `v-model` binding in the modal with explicit input handlers.

### Added

- Added the first offline Debug Pack export flow, generating one AI/Mock-friendly Markdown pack with embedded device, protocol, mock, sample, and log artifacts.
- Upgraded quick commands toward a Postman-like saved request model with name, type, description, content, and content format.
- Added command type badges in the quick command list.
- Added quick-command names to TX log labels when a saved command is applied and sent.

### Changed

- Consolidated the Device page export UI around a single "Export Debug Pack" entry with purpose, raw-log, and device-ID redaction options.
- Removed the standalone log export action from the Debug console so exports are routed through the Debug Pack workflow.

## 2026-05-14

### Added

- Added Markdown-first built-in BLE protocol templates under `docs/protocols/`.
- Added `npm run docs:protocol` for local preview of parsed protocol templates.
- Added protocol document parser and export builders for AI reports, protocol specs, and mock packs.
- Added built-in protocol matching by Service UUID and enriched service/characteristic descriptions in the Device page.
- Added AI Debug Report Markdown export.
- Added Protocol Spec JSON export.
- Added Mock Pack JSON export.
- Added long-press TX/RX log sample saving for protocol and mock documentation.
- Added service/characteristic metadata to TX/RX log entries and CSV/TXT log export.
- Added project prompt and architecture context documents under the outer `document/prompt` workspace folder.

### Changed

- Extended the product direction from a serial-style BLE debugger toward an API-debugging workflow similar to Postman / Apifox.
- Extended device report export from device topology only to a fuller documentation and mocking pipeline.

### Notes

- App build was not verified in this local shell because the environment did not expose the global `uni` command. Use HBuilderX or an installed UniApp CLI environment for final App-Plus build verification.
