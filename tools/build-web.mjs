#!/usr/bin/env node
/**
 * 生成网页版所需的文件。
 *
 * 扩展和网页只共享提示词及拼音搜索数据。网页版页面与交互独立维护，
 * 不再从 480px 宽的扩展弹窗模板生成。
 *
 * 生成的文件：
 *   data/prompts.js       -> docs/prompts.js
 *   data/search-index.js  -> docs/search-index.js
 *
 * 手写的页面文件：docs/index.html、docs/web.css、docs/app.js。
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
const COPIES = [
  { src: 'data/prompts.js', dst: 'docs/prompts.js', banner: BANNER_JS },
  { src: 'data/search-index.js', dst: 'docs/search-index.js', banner: BANNER_JS },
]

let failed = 0

for (const f of COPIES) {
  const raw = readFileSync(join(ROOT, f.src), 'utf8')
  const expected = f.banner + raw
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
