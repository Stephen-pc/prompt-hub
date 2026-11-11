#!/usr/bin/env node
/**
 * 生成网页版所需的文件。
 *
 * 网页版不是另写一套：它直接复用扩展的 popup.html / popup.css / popup.js，
 * 只在前面垫一个 chrome-shim.js 把 chrome.* API 换成浏览器原生能力。
 * 这样两边共用同一份界面代码和同一份数据，不会各改各的。
 *
 * 生成的东西（都带「勿手改」头注释）：
 *   data/prompts.js       -> docs/prompts.js
 *   data/search-index.js  -> docs/search-index.js
 *   popup/popup.css       -> docs/styles.css
 *   popup/popup.js        -> docs/app.js
 *   popup/popup.html      -> docs/index.html（改路径、加说明条、换脚本）
 *
 * 手写的只有 docs/web.css、docs/chrome-shim.js、docs/favicon.svg。
 *
 *   node tools/build-web.mjs           生成
 *   node tools/build-web.mjs --check   校验 docs/ 与源文件是否一致
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = process.argv.includes('--check')

const BANNER_JS = '// 自动生成，不要手改。改源文件后重跑 tools/build-web.mjs\n'
const BANNER_CSS = '/* 自动生成，不要手改。改 popup/popup.css 后重跑 tools/build-web.mjs */\n'
const BANNER_HTML = '<!-- 自动生成，不要手改。改 popup/popup.html 后重跑 tools/build-web.mjs -->\n'

// 网页版专属的一段说明，插在 header 后面
const WEB_NOTE = `  <div class="web-note">
    185 条精选提示词，浏览器里直接用，不用装东西。点 ⚡ 或 📋 都会复制到剪贴板，粘贴到任意 AI 对话框即可。
    想在自己常用的 AI 网站上「一键填入」，装<a href="https://github.com/Stephen-pc/prompt-hub" target="_blank" rel="noopener">浏览器扩展</a>。
  </div>
`

// 把扩展的 popup.html 改造成网页版首页。
// 每一步替换都断言命中，否则说明 popup.html 结构变了、这里要跟着改。
function makeIndexHtml(src) {
  const steps = [
    [
      '<title>PromptHub — AI 提示词工具箱</title>',
      '<title>PromptHub — 185 条 AI 提示词</title>',
    ],
    [
      '<link rel="stylesheet" href="popup.css">',
      '<link rel="icon" href="favicon.svg" type="image/svg+xml">\n' +
        '  <link rel="stylesheet" href="styles.css">\n' +
        '  <link rel="stylesheet" href="web.css">',
    ],
    ['</header>', '</header>\n\n' + WEB_NOTE],
    [
      '  <script src="../data/prompts.js"></script>\n' +
        '  <script src="../data/search-index.js"></script>\n' +
        '  <script src="popup.js"></script>',
      '  <script src="prompts.js"></script>\n' +
        '  <script src="search-index.js"></script>\n' +
        '  <script src="chrome-shim.js"></script>\n' +
        '  <script src="app.js"></script>',
    ],
  ]

  let out = src
  for (const [from, to] of steps) {
    if (!out.includes(from)) {
      throw new Error(`popup.html 里找不到预期片段，网页版生成失败：\n  ${from.slice(0, 60)}`)
    }
    out = out.replace(from, to)
  }
  return out
}

const COPIES = [
  { src: 'data/prompts.js', dst: 'docs/prompts.js', banner: BANNER_JS },
  { src: 'data/search-index.js', dst: 'docs/search-index.js', banner: BANNER_JS },
  { src: 'popup/popup.css', dst: 'docs/styles.css', banner: BANNER_CSS },
  { src: 'popup/popup.js', dst: 'docs/app.js', banner: BANNER_JS },
  { src: 'popup/popup.html', dst: 'docs/index.html', banner: BANNER_HTML, transform: makeIndexHtml },
]

let failed = 0

for (const f of COPIES) {
  const raw = readFileSync(join(ROOT, f.src), 'utf8')
  const expected = f.banner + (f.transform ? f.transform(raw) : raw)
  const dstPath = join(ROOT, f.dst)

  if (CHECK) {
    if (!existsSync(dstPath)) {
      console.error(`  FAIL 缺少 ${f.dst}`)
      failed++
    } else if (readFileSync(dstPath, 'utf8') !== expected) {
      console.error(`  FAIL ${f.dst} 与 ${f.src} 不一致（源改过但没重新生成？）`)
      failed++
    } else {
      console.log(`  ok   ${f.dst}`)
    }
  } else {
    writeFileSync(dstPath, expected)
    console.log(`  ${f.src} -> ${f.dst}`)
  }
}

if (CHECK) {
  console.log(failed === 0 ? '\n网页版文件与源一致' : `\n失败 ${failed} 项`)
  process.exit(failed === 0 ? 0 : 1)
}
