# Changelog

All notable changes to this project are documented here.

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
