# BLE Protocol Markdown Templates

These Markdown files are both human-previewable placeholders and application
inputs. The app imports them with `?raw`, parses their headings, bullets, and
field tables, then uses the result to enrich the service tree and AI/mock
exports.

## Supported Structure

- `---` front matter: `id`, `name`, `version`, `summary`
- `## Service: <name>`
- `### Characteristic: <name>`
- `#### Interface: <name>`
- Bullet metadata such as `uuid`, `properties`, `direction`, `valueFormat`,
  `operationId`, `requestExample`, `responseExample`, and `mock`
- Optional `##### Request Fields` / `##### Response Fields` tables with:
  `Offset | Length | Type | Name | Meaning`

Run this local preview command to inspect parsed output:

```bash
npm run docs:protocol
```
