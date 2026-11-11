#!/usr/bin/env node
/**
 * 生成网页版所需的文件。
 *
 * 网页版不是另写一套：它直接复用扩展的 popup.html / popup.css / popup.js，
 * 只在前面垫一个 chrome-shim.js 把 chrome.* API 换成浏览器原生能力。
 * 这样两边共用同一份界面代码和同一份提示词，不会各改各的。
 *
 * 这里负责把「源文件」复制到 docs/ 并加上「勿手改」的头注释：
 *   data/prompts.js   -> docs/prompts.js
 *   popup/popup.css   -> docs/styles.css
 *   popup/popup.js    -> docs/app.js
 *
 *   node tools/build-web.mjs           生成
 *   node tools/build-web.mjs --check   校验 docs/ 里的副本是否与源一致
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = process.argv.includes('--check')

const FILES = [
  {
    src: 'data/prompts.js',
    dst: 'docs/prompts.js',
    header: '// 自动生成，不要手改。改 data/prompts.js 后重跑 tools/build-web.mjs\n',
  },
  {
    src: 'popup/popup.css',
    dst: 'docs/styles.css',
    header: '/* 自动生成，不要手改。改 popup/popup.css 后重跑 tools/build-web.mjs */\n',
  },
  {
    src: 'popup/popup.js',
    dst: 'docs/app.js',
    header: '// 自动生成，不要手改。改 popup/popup.js 后重跑 tools/build-web.mjs\n',
  },
]

let failed = 0

for (const f of FILES) {
  const src = readFileSync(join(ROOT, f.src), 'utf8')
  const expected = f.header + src
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
