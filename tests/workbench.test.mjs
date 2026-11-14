import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const url = pathToFileURL(join(root, 'docs/index.html')).href
const browser = await chromium.launch(process.env.CHROME_PATH
  ? { executablePath: process.env.CHROME_PATH } : {})
let passed = 0
async function check(name, run) {
  await run()
  passed++
  console.log(`  ok  ${name}`)
}

try {
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(url)
  await check('全部列表和拼音索引', async () => {
    assert.equal(await page.locator('.prompt-row').count(), 185)
    await page.locator('#searchInput').fill('fanyi')
    assert.ok(await page.locator('.prompt-row').count() >= 1)
    await page.locator('#searchInput').fill('')
  })
  await check('桌面选择→填空→预览→复制→深链', async () => {
    await page.locator('.prompt-row[data-id="c03"]').click()
    assert.match(page.url(), /#\/p\/c03$/)
    await page.locator('[data-field="语言"]').fill('JavaScript')
    await page.locator('[data-field="代码"]').fill('function greet() { return "hi" }')
    assert.match(await page.locator('#detailPrompt').textContent(), /function greet/)
    await page.locator('#copyButton').click()
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /JavaScript/)
    assert.equal(await page.locator('#missingCount').textContent(), '已填写完整')
    await page.locator('#shareButton').click()
    assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'https://stephen-pc.github.io/prompt-hub/#/p/c03')
    await page.reload()
    assert.equal(await page.locator('#detailTitle').textContent(), '代码审查')
  })
  await check('收藏、自定义及旧版数据键保持兼容', async () => {
    await page.locator('#favoriteButton').click()
    const state = JSON.parse(await page.evaluate(() => localStorage.getItem('prompthub_web_prompthub_state')))
    assert.equal(state.favorites.c03, true)
    await page.locator('#newPromptButton').click()
    await page.locator('#customTitle').fill('我的示例')
    await page.locator('#customText').fill('请解释 [主题]')
    await page.locator('#customEditor button[type="submit"]').click()
    assert.equal(await page.locator('#detailTitle').textContent(), '我的示例')
    await page.locator('#firstField').fill('测试')
    await page.locator('#editButton').click()
    await page.locator('#customTitle').fill('我的示例已改名')
    await page.locator('#customEditor button[type="submit"]').click()
    assert.equal(await page.locator('#detailTitle').textContent(), '我的示例已改名')
  })
  await check('导出→合并导入不清除已有收藏', async () => {
    await page.locator('#dataButton').click()
    const downloadPromise = page.waitForEvent('download')
    await page.locator('#exportButton').click()
    const download = await downloadPromise
    assert.match(download.suggestedFilename(), /prompthub-backup/)
    await page.locator('#importFile').setInputFiles({ name: 'backup.json', mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ favorites: ['w01'], customPrompts: [] })) })
    await page.waitForFunction(() => {
      const saved = JSON.parse(localStorage.getItem('prompthub_web_prompthub_state'))
      return saved.favorites.w01 && saved.favorites.c03
    })
    const state = JSON.parse(await page.evaluate(() => localStorage.getItem('prompthub_web_prompthub_state')))
    assert.equal(state.customPrompts.length, 1)
  })
  await check('浅色主题可切换并保持，且提示词可选中', async () => {
    await page.locator('#dataButton').click()
    await page.locator('#themeButton').click()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light')
    await page.reload()
    assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), 'light')
    assert.equal(await page.locator('#detailPrompt').evaluate(el => getComputedStyle(el).userSelect), 'text')
  })
  assert.deepEqual(errors, [], '网页不能有 JS 错误')
  await context.close()

  const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true })
  const phone = await mobile.newPage()
  await phone.goto(url + '#/p/w01')
  await check('手机深链详情、返回列表和无横向溢出', async () => {
    assert.equal(await phone.locator('#detailTitle').textContent(), '专业文章撰写')
    assert.equal(await phone.locator('.browser').isVisible(), false)
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    await phone.locator('#backButton').click()
    assert.equal(await phone.locator('.browser').isVisible(), true)
    assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  })
  await check('手机主操作在首屏可触达', async () => {
    await phone.locator('.prompt-row[data-id="c03"]').click()
    const y = await phone.locator('#copyButton').evaluate(el => el.getBoundingClientRect().bottom)
    assert.ok(y <= 812, `复制按钮超出首屏：${y}px`)
  })
  await mobile.close()

  const badUrl = await browser.newPage()
  await badUrl.goto(url + '#/p/%')
  await check('无效 URL 编码不阻断初始化', async () => {
    assert.equal(await badUrl.locator('.prompt-row').count(), 185)
  })
  await badUrl.close()

  const legacy = await browser.newPage()
  await legacy.goto(url)
  await legacy.evaluate(() => {
    localStorage.removeItem('prompthub_web_prompthub_state')
    localStorage.setItem('prompthub_favorites', JSON.stringify({ c03: true }))
    localStorage.setItem('prompthub_custom', JSON.stringify([{
      id: 'custom_old', title: '历史提示词', category: 'coding', prompt: '旧内容', tags: []
    }]))
  })
  await legacy.reload()
  await check('旧版收藏与自定义提示词迁移不丢失', async () => {
    assert.equal(await legacy.locator('#customCount').textContent(), '1')
    const saved = JSON.parse(await legacy.evaluate(() => localStorage.getItem('prompthub_web_prompthub_state')))
    assert.equal(saved.favorites.c03, true)
    assert.equal(saved.customPrompts[0].id, 'custom_old')
  })
  await legacy.close()

  const blocked = await browser.newPage()
  await blocked.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw Error('blocked storage') } })
  })
  await blocked.goto(url)
  await check('禁用存储时仍可浏览提示词', async () => {
    assert.equal(await blocked.locator('.prompt-row').count(), 185)
  })
  await blocked.close()
  console.log(`\n工作台 ${passed} 项通过`)
} finally {
  await browser.close()
}
