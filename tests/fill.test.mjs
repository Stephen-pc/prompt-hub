#!/usr/bin/env node
/**
 * 填入逻辑的端到端测试。
 *
 * 为什么要这个：CI 里的 check-consistency.js 只能证明「三处列表写的一致」，
 * 证明不了「点填入真的能把字塞进去」。而后者失效时没有任何报错——用户看到
 * 的只是「点了没反应」。平台改一次版，选择器就可能静默失配。
 *
 * 做法：不连真的 AI 站点，用 Playwright 的路由拦截把 https://chatgpt.com/
 * 和 https://claude.ai/ 的响应换成本地 fixture，再把 content.js 注进去。
 * hostname 仍然是原站点，所以平台识别、选择器匹配走的都是真实路径。
 *
 *   node tests/fill.test.mjs
 *
 * 需要 playwright（devDependency）。浏览器可复用系统已装的 Chrome：
 *   CHROME_PATH="C:/.../chrome.exe" node tests/fill.test.mjs
 */

import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const CONTENT_JS = read('content/content.js')

const SAMPLE = '第一行：请扮演一位严谨的技术编辑\n第二行：指出这段文字里的逻辑漏洞'

let failed = 0
const ok = (m) => console.log(`  ok   ${m}`)
const bad = (m) => { console.error(`  FAIL ${m}`); failed += 1 }

// 在页面里注入 content.js 前，先垫一个最小的 chrome.runtime 桩，
// 把注册进来的消息处理器存下来，供测试主动触发。
const STUB = () => {
  window.__promptHubHandlers = []
  window.chrome = {
    runtime: {
      onMessage: { addListener: (fn) => window.__promptHubHandlers.push(fn) },
    },
  }
}

async function runCase(browser, { name, url, fixture, extract }) {
  const page = await browser.newPage()
  try {
    await page.addInitScript(STUB)
    await page.route(`${new URL(url).origin}/**`, (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: fixture })
    )
    await page.goto(url)
    await page.addScriptTag({ content: CONTENT_JS })

    const result = await page.evaluate((text) => {
      const handlers = window.__promptHubHandlers || []
      if (!handlers.length) return { error: 'content.js 没有注册消息处理器' }
      let response
      handlers[0]({ type: 'FILL_PROMPT', text }, null, (r) => { response = r })
      return { response }
    }, SAMPLE)

    if (result.error) { bad(`${name}：${result.error}`); return }
    if (!result.response || !result.response.success) {
      bad(`${name}：fill 返回 ${JSON.stringify(result.response)}`)
      return
    }

    const got = await page.evaluate(extract)
    const norm = (s) => (s || '').replace(/\s+/g, ' ').trim()
    if (norm(got) === norm(SAMPLE)) ok(`${name}：内容正确写入`)
    else bad(`${name}：写入内容不符\n    期望: ${norm(SAMPLE)}\n    实际: ${norm(got)}`)
  } finally {
    await page.close()
  }
}

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}
)

try {
  await runCase(browser, {
    name: 'textarea 型（ChatGPT）',
    url: 'https://chatgpt.com/',
    fixture: read('tests/fixtures/textarea.html'),
    extract: () => document.querySelector('#prompt-textarea').value,
  })

  await runCase(browser, {
    name: 'contenteditable 型（Claude）',
    url: 'https://claude.ai/',
    fixture: read('tests/fixtures/contenteditable.html'),
    extract: () => document.querySelector('.ProseMirror').innerText,
  })

  // 不可见元素不该被选中：fixture 里那个 display:none 的 textarea 必须保持空
  {
    const page = await browser.newPage()
    await page.addInitScript(STUB)
    await page.route('https://chatgpt.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: read('tests/fixtures/textarea.html') })
    )
    await page.goto('https://chatgpt.com/')
    await page.addScriptTag({ content: CONTENT_JS })
    await page.evaluate((text) => {
      window.__promptHubHandlers[0]({ type: 'FILL_PROMPT', text }, null, () => {})
    }, SAMPLE)

    const hidden = await page.evaluate(() => document.querySelector('#hidden-one').value)
    if (hidden === '') ok('不可见输入框未被误填')
    else bad('不可见输入框被填了内容')

    // 关键断言：诱饵框必须空着。
    // content.js 有通用兜底（找不到专属选择器就抓第一个可见 textarea），
    // 所以只断言「目标框有内容」是不够的——选择器失效时兜底会填到诱饵框，
    // 断言依然通过，测试就成了摆设。必须同时证明「没填错地方」。
    const decoy = await page.evaluate(() => document.querySelector('#search-box').value)
    if (decoy === '') ok('诱饵输入框未被误填（说明专属选择器生效，不是兜底碰巧命中）')
    else bad(`诱饵输入框被误填：${decoy.slice(0, 30)}（专属选择器可能已失效，靠兜底才填进去）`)

    await page.close()
  }
} finally {
  await browser.close()
}

console.log(failed === 0 ? '\n全部通过' : `\n失败 ${failed} 项`)
process.exit(failed === 0 ? 0 : 1)
