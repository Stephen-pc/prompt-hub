#!/usr/bin/env node
/**
 * 生成拼音搜索索引。
 *
 * 为什么需要：中文用户打字快的时候会直接敲拼音——搜 "gongsi" 找「公司」，
 * 或者只打首字母 "gs"。原来的搜索是纯字符串包含，这两种都搜不到。
 *
 * 做法是在构建时把标题和标签转成拼音存下来，运行时只做字符串比较。
 * 这样运行时不引入任何拼音库（扩展和网页版都保持零依赖），代价只是
 * 多一个几十 KB 的索引文件。
 *
 *   node tools/build-search-index.mjs           生成
 *   node tools/build-search-index.mjs --check   校验是否与 prompts.js 同步
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinyin } from 'pinyin-pro'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CHECK = process.argv.includes('--check')

const source = readFileSync(join(ROOT, 'data/prompts.js'), 'utf8')
const match = source.match(/const PROMPTS = (\[[\s\S]*?\n\];)/)
if (!match) {
  console.error('解析失败：没在 data/prompts.js 里找到 PROMPTS 数组')
  process.exit(1)
}
const PROMPTS = eval(match[1].replace(/;$/, ''))

// 把一段中文转成「首字母串」和「全拼串」。
// 英文原样保留（转小写），标点和空格去掉——用户不会打标点。
function toPinyin(text) {
  if (!text) return { i: '', f: '' }
  const clean = String(text).replace(/[\s\p{P}]/gu, '')
  if (!clean) return { i: '', f: '' }
  const opts = { toneType: 'none', type: 'array', nonZh: 'consecutive' }
  const initials = pinyin(clean, { ...opts, pattern: 'first' }).join('').toLowerCase()
  const full = pinyin(clean, opts).join('').toLowerCase()
  return { i: initials, f: full }
}

const index = {}
for (const p of PROMPTS) {
  // 只转中文部分：英文标题留在原有的直接匹配里，混进来会把首字母串拉得很长
  const text = [p.title, (p.tags || []).join('')].filter(Boolean).join('')
  index[p.id] = toPinyin(text)
}

const body = Object.entries(index)
  .map(([id, v]) => `  ${JSON.stringify(id)}: { i: ${JSON.stringify(v.i)}, f: ${JSON.stringify(v.f)} },`)
  .join('\n')

const content =
  '// 自动生成，不要手改。改 data/prompts.js 后重跑 tools/build-search-index.mjs\n' +
  '// i = 首字母串（代码审查 -> dmsc），f = 全拼串（daimashencha）\n' +
  'const SEARCH_INDEX = {\n' +
  body + '\n' +
  '};\n'

const outPath = join(ROOT, 'data/search-index.js')

if (CHECK) {
  let current = ''
  try {
    current = readFileSync(outPath, 'utf8')
  } catch (e) {
    console.error('  FAIL 缺少 data/search-index.js')
    process.exit(1)
  }
  if (current !== content) {
    console.error('  FAIL data/search-index.js 与 data/prompts.js 不同步（重跑生成脚本）')
    process.exit(1)
  }
  console.log(`  ok   data/search-index.js（${Object.keys(index).length} 条）`)
} else {
  writeFileSync(outPath, content)
  console.log(`已生成拼音索引 ${Object.keys(index).length} 条 -> data/search-index.js`)
}
