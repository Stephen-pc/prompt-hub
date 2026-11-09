#!/usr/bin/env node
/**
 * 一致性检查：manifest / content / background 三处的站点列表必须对得上。
 *
 * 这三处任一遗漏，症状都是「在某个站点点填入没反应」——最难排查的那类问题：
 * 扩展不报错、控制台也没异常，只是什么都不发生。
 *
 *   node tools/check-consistency.js
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')

let failed = 0
const ok = (msg) => console.log(`  ok   ${msg}`)
const bad = (msg) => { console.error(`  FAIL ${msg}`); failed += 1 }

// ---------- 1. manifest 结构 ----------
const manifest = JSON.parse(read('manifest.json'))

if (manifest.manifest_version === 3) ok('manifest_version = 3')
else bad(`manifest_version = ${manifest.manifest_version}，应为 3`)

if (/^\d+\.\d+\.\d+$/.test(manifest.version)) ok(`version = ${manifest.version}`)
else bad(`version 格式不合法：${manifest.version}`)

// ---------- 2. 图标：声明的必须存在，且尺寸要在 Chrome 认识的范围内 ----------
const ICON_SIZES = new Set(['16', '32', '48', '128'])
for (const [size, path] of Object.entries(manifest.icons || {})) {
  if (!ICON_SIZES.has(size)) bad(`icons 里声明了 Chrome 不识别的尺寸 ${size}（只认 16/32/48/128）`)
  else if (!existsSync(join(ROOT, path))) bad(`icons["${size}"] 指向的文件不存在：${path}`)
  else ok(`icon ${size} -> ${path}`)
}
for (const size of ['16', '32', '48', '128']) {
  if (!(manifest.icons || {})[size]) bad(`缺少 ${size}px 图标声明`)
}

// ---------- 3. 站点列表三处一致 ----------
const matchHosts = new Set(
  (manifest.content_scripts?.[0]?.matches || []).map((m) => m.replace(/^https:\/\//, '').replace(/\/\*$/, ''))
)
const hostPerms = new Set(
  (manifest.host_permissions || []).map((m) => m.replace(/^https:\/\//, '').replace(/\/\*$/, ''))
)

const bgSource = read('background/background.js')
const bgBlock = bgSource.slice(bgSource.indexOf('const AI_SITES'), bgSource.indexOf('];', bgSource.indexOf('const AI_SITES')))
const bgSites = new Set([...bgBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]))

const contentSource = read('content/content.js')
const selBlock = contentSource.slice(
  contentSource.indexOf('const PLATFORM_SELECTORS'),
  contentSource.indexOf('};', contentSource.indexOf('const PLATFORM_SELECTORS'))
)
const selSites = new Set([...selBlock.matchAll(/'([^']+)':\s*\{/g)].map((m) => m[1]))

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x))

if (sameSet(matchHosts, hostPerms)) ok(`content_scripts.matches 与 host_permissions 一致（${matchHosts.size} 个）`)
else bad(`matches 与 host_permissions 不一致\n    matches: ${[...matchHosts].sort().join(', ')}\n    hosts:   ${[...hostPerms].sort().join(', ')}`)

// background 用 includes 匹配，content 用 host.includes(domain)，
// 所以它们允许写成子串形式（如 kimi.com 覆盖 www.kimi.com），
// 这里只检查「manifest 里的每个域名都有对应的处理逻辑」。
for (const host of matchHosts) {
  const covered = [...bgSites].some((s) => host.includes(s)) && [...selSites].some((s) => host.includes(s))
  if (covered) ok(`站点 ${host} 三处齐全`)
  else bad(`站点 ${host} 缺少 background 或 content 的对应配置`)
}

// ---------- 4. 文件引用 ----------
for (const ref of [manifest.background?.service_worker, manifest.action?.default_popup, ...(manifest.content_scripts?.[0]?.js || [])]) {
  if (!ref) continue
  if (existsSync(join(ROOT, ref))) ok(`引用存在：${ref}`)
  else bad(`manifest 引用的文件不存在：${ref}`)
}

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`)
process.exit(failed === 0 ? 0 : 1)
