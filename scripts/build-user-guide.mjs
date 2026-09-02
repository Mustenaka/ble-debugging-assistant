#!/usr/bin/env node
/**
 * 把 docs/USER_GUIDE_zh.md / docs/USER_GUIDE.md 构建为独立 HTML 说明书。
 *
 *   node scripts/build-user-guide.mjs            → docs/USER_GUIDE_zh.html + docs/USER_GUIDE.html（图片走相对路径）
 *   node scripts/build-user-guide.mjs --inline   → 图片以 data URI 内嵌，单文件可直接分发（体积较大，默认不入库）
 *   node scripts/build-user-guide.mjs --out DIR  → 指定输出目录
 *   node scripts/build-user-guide.mjs --lang zh  → 只生成中文说明书（en 为英文）
 *
 * 只依赖 Node 内置模块；支持的 Markdown 子集：标题、段落、无序/有序列表、表格、图片、链接、
 * 行内代码、粗体、围栏代码块、引用、分隔线。标题锚点按 GitHub 规则生成，与文中目录链接一致。
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve, join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')
const DOCS = join(ROOT, 'docs')

const args = process.argv.slice(2)
const INLINE = args.includes('--inline')
const outIdx = args.indexOf('--out')
if (outIdx >= 0 && (!args[outIdx + 1] || args[outIdx + 1].startsWith('--'))) {
  throw new Error('--out requires an output directory')
}
const OUT_DIR = outIdx >= 0 ? resolve(args[outIdx + 1]) : DOCS
const langIdx = args.indexOf('--lang')
const LANG = langIdx >= 0 ? args[langIdx + 1] : null
if (langIdx >= 0 && !['zh', 'en'].includes(LANG)) throw new Error('--lang must be zh or en')
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

const GUIDES = [
  { src: 'USER_GUIDE_zh.md', out: 'USER_GUIDE_zh.html', lang: 'zh-CN', title: 'BLE 调试助手 使用说明书', tocTitle: '目录', other: { href: 'USER_GUIDE.html', label: 'English' } },
  { src: 'USER_GUIDE.md', out: 'USER_GUIDE.html', lang: 'en', title: 'BLE Debugger User Guide', tocTitle: 'Contents', other: { href: 'USER_GUIDE_zh.html', label: '中文' } },
]

// ── 工具 ────────────────────────────────────────────────────────────────────

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function slug(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
}

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp' }

function imageSrc(src) {
  if (!INLINE) {
    if (OUT_DIR === DOCS) return src
    // 输出到其他目录时改为指向 docs 的绝对路径
    return 'file:///' + resolve(DOCS, src).replace(/\\/g, '/')
  }
  const abs = resolve(DOCS, src)
  if (!existsSync(abs)) return src
  const mime = MIME[extname(abs).toLowerCase()] ?? 'application/octet-stream'
  return `data:${mime};base64,${readFileSync(abs).toString('base64')}`
}

// 为现有 PNG 真机截图预留固有比例，避免懒加载后章节锚点发生位移。
function imageDimensions(src) {
  const abs = resolve(DOCS, src)
  if (extname(abs).toLowerCase() !== '.png' || !existsSync(abs)) return ''
  const bytes = readFileSync(abs)
  if (bytes.length < 24 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a') return ''
  return ` width="${bytes.readUInt32BE(16)}" height="${bytes.readUInt32BE(20)}"`
}

/** 行内格式：图片、链接、行内代码、粗体、斜体 */
function inline(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const rest = text.slice(i)
    let m
    if ((m = rest.match(/^!\[([^\]]*)\]\(([^)]+)\)/))) {
      const alt = escapeHtml(m[1])
      const src = imageSrc(m[2].trim())
      out += `<a class="shot" href="${escapeHtml(src)}" target="_blank" rel="noopener"><img src="${escapeHtml(src)}" alt="${alt}"${imageDimensions(m[2].trim())} loading="lazy" decoding="async"></a>`
      i += m[0].length
      continue
    }
    if ((m = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/))) {
      const href = m[2].trim().replace(/\.md$/i, '.html').replace(/\.md(#)/i, '.html$1')
      const external = /^https?:/i.test(href)
      out += `<a href="${escapeHtml(href)}"${external ? ' target="_blank" rel="noopener"' : ''}>${inline(m[1])}</a>`
      i += m[0].length
      continue
    }
    if ((m = rest.match(/^`([^`]+)`/))) {
      out += `<code>${escapeHtml(m[1])}</code>`
      i += m[0].length
      continue
    }
    if ((m = rest.match(/^\*\*([^*]+)\*\*/))) {
      out += `<strong>${inline(m[1])}</strong>`
      i += m[0].length
      continue
    }
    if ((m = rest.match(/^\*([^*]+)\*/))) {
      out += `<em>${inline(m[1])}</em>`
      i += m[0].length
      continue
    }
    out += escapeHtml(text[i])
    i++
  }
  return out
}

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
}

// ── 块级解析 ────────────────────────────────────────────────────────────────

function render(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const html = []
  const headings = []
  let i = 0
  const flushParagraph = (buf) => {
    if (buf.length) html.push(`<p>${inline(buf.join(' '))}</p>`)
    buf.length = 0
  }
  const para = []

  while (i < lines.length) {
    const line = lines[i]

    if (/^```/.test(line)) {
      flushParagraph(para)
      const langName = line.slice(3).trim()
      const buf = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++ }
      i++
      html.push(`<pre><code class="lang-${escapeHtml(langName)}">${escapeHtml(buf.join('\n'))}</code></pre>`)
      continue
    }

    const h = line.match(/^(#{1,4})\s+(.+?)\s*$/)
    if (h) {
      flushParagraph(para)
      const level = h[1].length
      const text = h[2]
      const id = slug(text)
      if (level <= 2) headings.push({ level, text, id })
      html.push(`<h${level} id="${id}">${inline(text)}</h${level}>`)
      i++
      continue
    }

    if (/^---\s*$/.test(line)) {
      flushParagraph(para)
      html.push('<hr>')
      i++
      continue
    }

    if (/^>\s?/.test(line)) {
      flushParagraph(para)
      const buf = []
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++ }
      html.push(`<blockquote><p>${inline(buf.join(' '))}</p></blockquote>`)
      continue
    }

    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-+/.test(lines[i + 1])) {
      flushParagraph(para)
      const header = splitRow(line)
      i += 2
      const rows = []
      while (i < lines.length && /^\|/.test(lines[i])) { rows.push(splitRow(lines[i])); i++ }
      const isGallery = rows.length > 0 && rows.every((r) => r.every((c) => /^!\[/.test(c)))
      if (isGallery) {
        // 截图表格 → 图库卡片
        html.push('<div class="gallery">')
        rows.forEach((r) => r.forEach((cell, ci) => {
          html.push(`<figure>${inline(cell)}<figcaption>${inline(header[ci] ?? '')}</figcaption></figure>`)
        }))
        html.push('</div>')
      } else {
        const th = header.map((c) => `<th>${inline(c)}</th>`).join('')
        const body = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')
        html.push(`<div class="table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`)
      }
      continue
    }

    if (/^\s*[-*]\s+/.test(line)) {
      flushParagraph(para)
      html.push('<ul>')
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, '')
        i++
        while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i])) { item += ' ' + lines[i].trim(); i++ }
        html.push(`<li>${inline(item)}</li>`)
      }
      html.push('</ul>')
      continue
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      flushParagraph(para)
      html.push('<ol>')
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        html.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`)
        i++
      }
      html.push('</ol>')
      continue
    }

    const shot = line.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (shot) {
      flushParagraph(para)
      html.push(`<figure class="single">${inline(line.trim())}${shot[1] ? `<figcaption>${escapeHtml(shot[1])}</figcaption>` : ''}</figure>`)
      i++
      continue
    }

    if (!line.trim()) {
      flushParagraph(para)
      i++
      continue
    }

    para.push(line.trim())
    i++
  }
  flushParagraph(para)
  return { body: html.join('\n'), headings }
}

// ── 页面模板 ────────────────────────────────────────────────────────────────

const CSS = `
:root{--bg:#0A0F1C;--panel:#111827;--card:#1A2235;--elev:#1E2D44;--primary:#00F5FF;--accent:#39FF14;--warn:#F59E0B;--text:#E2E8F0;--muted:#94A3B8;--dim:#64748B;--border:rgba(0,245,255,.14);--mono:"Cascadia Code","JetBrains Mono","Fira Code",Consolas,"Courier New",monospace}
*{box-sizing:border-box}
html{scroll-behavior:smooth;scroll-padding-top:24px}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.7 -apple-system,"Segoe UI","PingFang SC","Microsoft YaHei","Noto Sans CJK SC",Roboto,sans-serif}
a{color:var(--primary);text-decoration:none}a:hover{text-decoration:underline}
a:focus-visible,summary:focus-visible{outline:2px solid var(--primary);outline-offset:4px}
.skip-link{position:absolute;left:12px;top:-100px;z-index:10;padding:8px 14px;background:var(--panel)}
.skip-link:focus{top:12px}
.layout{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:100vh}
nav.toc{position:sticky;top:0;height:100vh;overflow:auto;padding:24px 18px;background:var(--panel);border-right:1px solid var(--border)}
nav.toc .brand{font-weight:700;color:var(--primary);letter-spacing:.5px;margin-bottom:4px}
nav.toc .ver{font-size:12px;color:var(--dim);margin-bottom:14px}
nav.toc .lang{display:inline-block;margin-bottom:16px;padding:3px 10px;border:1px solid var(--border);border-radius:999px;font-size:12px}
nav.toc h4{margin:0 0 8px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:var(--dim)}
nav.toc ul{list-style:none;margin:0;padding:0}
nav.toc li{margin:0}
nav.toc a{display:block;padding:6px 8px;border-radius:6px;color:var(--muted);font-size:13px}
nav.toc a:hover{background:var(--elev);color:var(--text);text-decoration:none}
nav.toc li.l1>a{color:var(--text);font-weight:600}
main{padding:32px 48px 80px;max-width:1080px;width:100%;min-width:0;overflow-wrap:anywhere}
h1{font-size:30px;margin:0 0 8px;color:#fff}
h2{font-size:22px;margin:44px 0 14px;padding-bottom:8px;border-bottom:1px solid var(--border);color:var(--primary)}
h3{font-size:17px;margin:28px 0 10px;color:#fff}
p{margin:10px 0}
hr{border:0;border-top:1px solid var(--border);margin:32px 0}
code{font-family:var(--mono);font-size:.9em;background:var(--elev);padding:1px 6px;border-radius:5px;color:#A8D8A8}
pre{background:#0D1526;border:1px solid var(--border);border-radius:10px;padding:14px 16px;overflow:auto}
pre code{background:none;padding:0;color:#CDE7FF}
blockquote{margin:14px 0;padding:10px 16px;border-left:3px solid var(--warn);background:rgba(245,158,11,.06);border-radius:0 8px 8px 0;color:var(--muted)}
ul,ol{padding-left:24px}li{margin:4px 0}
strong{color:#fff}
.table-wrap{overflow:auto;margin:14px 0;border:1px solid var(--border);border-radius:10px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{padding:9px 12px;border-bottom:1px solid var(--border);text-align:left;vertical-align:top}
td code{white-space:nowrap}
th{background:var(--panel);color:var(--primary);font-weight:600;white-space:nowrap}
tr:last-child td{border-bottom:0}
.gallery{display:flex;flex-wrap:wrap;gap:16px;margin:16px 0}
figure{margin:0;flex:1 1 220px;max-width:300px;background:var(--panel);border:1px solid var(--border);border-radius:14px;padding:10px;text-align:center}
figure.single{width:100%;max-width:300px;flex:none;margin:18px 0 24px}
figure img{width:100%;height:auto;border-radius:10px;display:block;box-shadow:0 6px 24px rgba(0,0,0,.45)}
figcaption{font-size:12px;color:var(--muted);margin-top:8px;line-height:1.4}
a.shot{display:block}
.topbar{display:none}
.mobile-nav{display:none}
@media (max-width:900px){
  .layout{grid-template-columns:1fr}
  nav.toc{display:none}
  .mobile-nav{display:block;padding:14px 18px;background:var(--panel);border-bottom:1px solid var(--border)}
  .mobile-nav summary{cursor:pointer;color:var(--primary);font-weight:600;min-height:32px;padding:4px 0}
  .mobile-nav ul{padding:8px 0;list-style:none;margin:0;columns:2;column-gap:16px}
  .mobile-nav li{break-inside:avoid;margin:0}
  .mobile-nav li a{display:block;padding:6px 0;font-size:13px}
  .mobile-nav .lang{display:inline-block;margin-top:10px;font-size:13px}
  main{padding:20px 18px 60px}
  h1{font-size:26px}h2{font-size:21px}
  figure{max-width:none;flex-basis:160px}
}
@media (max-width:400px){.mobile-nav ul{columns:1}}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{
  @page{margin:16mm}
  body{background:#fff;color:#111;font-size:10pt;line-height:1.6}
  nav.toc,.mobile-nav,.skip-link{display:none}.layout{display:block}
  main{padding:0;max-width:none}
  h1,h2,h3,h4,strong{color:#111}h2,h3,h4{break-after:avoid}
  h2{margin-top:24px;border-color:#bbb}a{color:#16466a}
  code{color:#16466a;background:#eef}pre{background:#f5f7fa;border-color:#ccc;white-space:pre-wrap}
  pre code{color:#111}blockquote{color:#333;background:#f7f7f7;border-color:#777}
  .table-wrap{overflow:visible;border-color:#bbb}table{font-size:9pt}
  th{background:#eee;color:#111;white-space:normal}td,th{border-color:#ccc}
  td code{white-space:normal}
  thead{display:table-header-group}tr{break-inside:avoid}
  figure{background:#fff;border-color:#ccc;break-inside:avoid}
  figure.single{max-width:58mm}figure img{box-shadow:none}figcaption{color:#444}
}
`

function page(guide, body, headings) {
  const isZh = guide.lang === 'zh-CN'
  const toc = headings
    .map((h) => `<li class="l${h.level}"><a href="#${h.id}">${escapeHtml(h.text)}</a></li>`)
    .join('\n')
  return `<!DOCTYPE html>
<html lang="${guide.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(guide.title)}</title>
<style>${CSS}</style>
</head>
<body>
<a class="skip-link" href="#guide-content">${isZh ? '跳到正文' : 'Skip to content'}</a>
<header class="mobile-nav">
  <details>
    <summary>⬡ BLE Debugger · ${escapeHtml(guide.tocTitle)}</summary>
    <nav aria-label="${escapeHtml(guide.tocTitle)}"><ul>${toc}</ul></nav>
    <a class="lang" href="${guide.other.href}">${guide.other.label}</a>
  </details>
</header>
<div class="layout">
<nav class="toc" aria-label="${escapeHtml(guide.tocTitle)}">
  <div class="brand">⬡ BLE Debugger</div>
  <div class="ver">v${escapeHtml(VERSION)}</div>
  <a class="lang" href="${guide.other.href}">${guide.other.label}</a>
  <h4>${escapeHtml(guide.tocTitle)}</h4>
  <ul>
${toc}
  </ul>
</nav>
<main id="guide-content" tabindex="-1">
${body}
</main>
</div>
</body>
</html>
`
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true })
for (const guide of GUIDES) {
  if (LANG && (guide.lang === 'zh-CN' ? 'zh' : 'en') !== LANG) continue
  // Markdown 保留目录供直接阅读；HTML 由侧栏 / 手机折叠目录导航。
  const md = readFileSync(join(DOCS, guide.src), 'utf8')
    .replace(/^## (?:目录|Contents|Table of Contents)\r?\n[\s\S]*?(?=^## |^---\s*$)/m, '')
  const { body, headings } = render(md)
  const out = page(guide, body, headings.filter((h) => h.level === 2))
  const outPath = join(OUT_DIR, guide.out)
  writeFileSync(outPath, out, 'utf8')
  const kb = Math.round(Buffer.byteLength(out, 'utf8') / 1024)
  console.log(`${basename(outPath)}  ${kb} KB  (${headings.filter((h) => h.level === 2).length} sections${INLINE ? ', images inlined' : ''})`)
}
