#!/usr/bin/env node
/**
 * 把 data/prompts.js 里的提示词导出成一份可离线阅读的 Markdown。
 *
 * 为什么需要：185 条在网页里得一条条点开看，想通读或者打印出来不合适。
 * 导出成单文件，可以搜索、可以打印、也可以直接发给别人。
 *
 *   node tools/export-prompts.mjs [输出路径]
 *   默认输出到仓库根目录的 prompt-hub-全部提示词.md
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

// prompts.js 是给浏览器用的经典脚本（const PROMPTS = [...]），
// 这里取出数组字面量求值。文件内容由本仓库维护，不做沙箱隔离。
const source = readFileSync(join(ROOT, 'data/prompts.js'), 'utf8')
const match = source.match(/const PROMPTS = (\[[\s\S]*?\n\];)/)
if (!match) {
  console.error('解析失败：没在 data/prompts.js 里找到 PROMPTS 数组')
  process.exit(1)
}
const PROMPTS = eval(match[1].replace(/;$/, ''))

const CATEGORIES = [
  ['writing', '写作'],
  ['coding', '编程'],
  ['translation', '翻译'],
  ['marketing', '营销'],
  ['education', '教育'],
  ['data', '数据分析'],
  ['creative', '创意'],
  ['productivity', '效率'],
  ['roleplay', '角色扮演'],
  ['utility', '实用工具'],
]

const out = resolve(process.argv[2] || join(ROOT, 'prompt-hub-全部提示词.md'))
const lines = []

lines.push('# PromptHub · 全部提示词')
lines.push('')
lines.push(`共 ${PROMPTS.length} 条，分 ${CATEGORIES.length} 类。`)
lines.push('')
lines.push('用法：复制正文，粘进任意 AI 对话框，把 `[方括号]` 里的内容换成你自己的。')
lines.push('')
lines.push('---')
lines.push('')

// 目录
lines.push('## 目录')
lines.push('')
for (const [key, label] of CATEGORIES) {
  const items = PROMPTS.filter((p) => p.category === key)
  lines.push(`- **${label}**（${items.length} 条）：${items.map((p) => p.title).join('、')}`)
}
lines.push('')
lines.push('---')
lines.push('')

// 正文
let seq = 0
for (const [key, label] of CATEGORIES) {
  const items = PROMPTS.filter((p) => p.category === key)
  if (!items.length) continue
  lines.push(`## ${label}`)
  lines.push('')
  for (const p of items) {
    seq += 1
    lines.push(`### ${seq}. ${p.title}`)
    lines.push('')
    if (p.tags && p.tags.length) {
      lines.push(`*${p.tags.join(' · ')}*`)
      lines.push('')
    }
    lines.push('```text')
    lines.push(p.prompt)
    lines.push('```')
    lines.push('')
  }
}

lines.push('---')
lines.push('')
lines.push('由 [prompt-hub](https://github.com/Stephen-pc/prompt-hub) 导出。')

writeFileSync(out, lines.join('\n') + '\n', { encoding: 'utf8' })
console.log(`已导出 ${PROMPTS.length} 条 -> ${out}`)
