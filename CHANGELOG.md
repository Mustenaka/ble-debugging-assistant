# Changelog

All notable changes to this project are documented here.

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
