# ⚡ PromptHub — AI 提示词工具箱

<p align="center">
  <img src="icons/icon128.png" alt="PromptHub" width="128" />
</p>

<p align="center">
  <strong>185 条精选 AI 提示词 · 一键填入 · 覆盖主流 AI 对话站</strong>
</p>

<p align="center">
  <a href="#这是什么">这是什么</a> ·
  <a href="#功能">功能</a> ·
  <a href="#安装">安装</a> ·
  <a href="#用法">用法</a> ·
  <a href="#支持的平台">支持的平台</a>
</p>

---

## 这是什么

一个浏览器扩展，内置 **185 条手写提示词**，分 10 个分类。看到合适的，可以复制走，也可以**一键直接填进你正在用的 AI 对话框**。

不用再反复手打同一段指令，也不用翻笔记去找「上次那个写得挺好的提示词」。

---

## 功能

| 功能 | 说明 |
|------|------|
| 🏷️ **10 个分类** | 写作、编程、翻译、营销、教育、数据分析、创意、生产力、角色扮演、实用工具 |
| 🔍 **即时搜索** | 中英文模糊搜索，几秒内定位到想要的那条 |
| ⚡ **一键填入** | 把提示词直接注入当前标签页的 AI 输入框，不用手动粘贴 |
| ⭐ **收藏** | 常用提示词打星，随时调出来 |
| ✏️ **自定义提示词** | 自己写模板，和内置的一起管理 |
| 📤 **导入导出** | 自定义提示词可导出为 JSON，方便备份和分享 |
| 🌓 **暗色模式** | 跟随系统，也可手动切换 |
| 🔒 **纯本地** | 数据全部存在浏览器里，无追踪、无服务器、无统计 |

---

## 安装

### 第一步：下载

点页面右上角绿色 **「Code」** 按钮 → **「Download ZIP」**，解压到任意文件夹。

### 第二步：加载扩展

#### Chrome / Edge

1. 地址栏输入 `chrome://extensions`（Chrome）或 `edge://extensions`（Edge）
2. 打开右上角的 **开发者模式**
3. 点 **加载已解压的扩展程序**
4. 选择解压出来的 `prompt-hub-main` 文件夹
5. 完成，工具栏会出现 ⚡ 图标

> 💡 开发者模式的扩展在浏览器启动时可能弹提示，忽略即可，不影响使用。

#### Firefox

**目前不支持。** 本扩展用的是 Manifest V3 的 `background.service_worker`，Firefox 的 MV3 实现不支持这种后台形态，装上去填入功能不会工作。等 Firefox 支持后再适配。

---

## 用法

1. 点工具栏的 ⚡ 图标打开面板
2. 按分类浏览，或者直接搜索
3. 点卡片看完整提示词
4. 选一个动作：
   - **📋 复制** —— 复制到剪贴板
   - **⚡ 填入** —— 注入当前标签页的 AI 输入框
   - **⭐ 收藏** —— 存进收藏夹

> 💡 **要点**：先在你当前标签页打开 ChatGPT / Claude / DeepSeek 等，再点「⚡ 填入」，提示词会直接出现在对话框里。

---

## 支持的平台

| 平台 | 域名 | 一键填入 |
|------|------|:--------:|
| ChatGPT | chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| DeepSeek | chat.deepseek.com | ✅ |
| Kimi | kimi.moonshot.cn / kimi.com | ✅ |
| 豆包 | doubao.com | ✅ |
| 腾讯元宝 | yuanbao.tencent.com | ✅ |
| 智谱清言 | chatglm.cn | ✅ |
| Gemini | gemini.google.com | ✅ |
| 通义千问 | tongyi.aliyun.com | ✅ |
| Poe | poe.com | ✅ |

**关于新加的平台**：豆包、元宝、智谱、Gemini 和 Kimi 新域名是这一版加的，输入框选择器按各家当前页面结构写的。这些站改版比较勤，如果点了填入没反应，请提 issue 告诉我——填入逻辑本身有通用兜底（任意可见的输入框都会被尝试），所以多数改版能扛住，但不敢保证。

---

## 项目结构

```
prompt-hub/
├── manifest.json              # MV3 清单
├── background/
│   └── background.js          # Service Worker，消息路由
├── content/
│   └── content.js             # 各站输入框定位与填充
├── popup/
│   ├── popup.html             # 面板结构
│   ├── popup.css              # 样式（亮色 + 暗色）
│   └── popup.js               # 面板逻辑
├── data/
│   └── prompts.js             # 185 条提示词模板
├── icons/                     # 图标 16 / 32 / 48 / 128
└── generate-icons.js          # 图标生成脚本
```

---

## 技术栈

- **Manifest V3** —— 当前扩展标准
- **原生 JS / CSS / HTML** —— 零依赖，打开即用，没有构建步骤
- **localStorage** —— 数据不出浏览器

---

## 隐私

PromptHub 不收集、不上传、不在浏览器外存储任何数据。没有统计、没有追踪、没有外部服务器。提示词全部打包在扩展里，收藏和自定义提示词存在你自己的浏览器里。

---

## 更新日志

### 1.3.0

- **新增 Claude Code 自定义命令**：`tools/make-commands.py` 把提示词生成为 `~/.claude/commands/*.md`，在终端里用 `/review`、`/sql` 等直接调用。浏览器扩展和终端两条路走同一份数据。
- 生成时跳过了与常见既有命令重复的三条（提交信息、bug 修复、单元测试），避免覆盖你原有的命令。
- `--check` 校验来源条目是否还在、仓库里的 `.md` 有没有被手改后忘记同步脚本（已接入 CI）。

### 1.2.0

- **收藏和自定义提示词改用 `chrome.storage.local`**。原来存在 `localStorage`，而它挂在扩展源的「站点数据」下——Chrome 清除浏览数据时可能连带清掉，用户攒的收藏会无声消失。同时 manifest 一直申请着 `storage` 权限却从未使用。
- **加了数据版本号 `schemaVersion`**，并在首次启动时把旧 `localStorage` 里的数据自动搬过来、搬完清掉旧键。将来改数据结构才有迁移依据。
- **新增填入逻辑的端到端测试**：用 Playwright 的路由拦截把 `chatgpt.com` / `claude.ai` 的响应换成本地 fixture，hostname 仍是原站点，所以平台识别和选择器匹配走真实路径，然后真的点一次填入并断言结果。
- 测试里放了一个**诱饵输入框**：只断言「目标框有内容」是不够的，因为填入逻辑有通用兜底，专属选择器失效时兜底会填到诱饵框，测试照样通过。所以同时要求诱饵框为空——这样才区分得开「选择器对了」和「碰巧填对了」。
- 主题仍存在 `localStorage`：它在 `<script>` 解析阶段就要生效（否则会先闪一下亮色），而 `chrome.storage` 是异步的。主题丢了无所谓，数据不行。

### 1.1.1

- 提示词数量从「200+」改为实际值 **185**。README、manifest 描述、仓库描述三处都虚标了。

### 1.1.0

- **新增 4 个平台**：豆包、腾讯元宝、智谱清言、Gemini，另加 Kimi 新域名 `kimi.com`
- **填入逻辑加通用兜底**：找不到平台专属选择器时，会尝试任意可见的 `textarea` / `contenteditable` / `role="textbox"`。原先只对 `contenteditable` 兜底，textarea 类站点一改版就彻底填不进去
- **填充方式按元素实际类型判断**，不再盲信配置里的 `type`——平台改版后原选择器可能命中另一种元素，用错填充函数会静默失败
- **修一个注入漏洞**：卡片 `data-id` 属性未转义，导入的 JSON 可以在面板里注入标签并执行脚本（面板有扩展权限，能读走你的提示词）。现在属性值单独转义，并且导入时逐条校验字段
- **补 32px 图标**：`icons` 里缺 `icon32.png`，清单里却写了一个 Chrome 不识别的 `300` 尺寸
- 修正 README 中「支持 Firefox」的错误说明

### 1.0.0

首个版本。

---

## 在 Claude Code 里用

同一份提示词，也能变成 **Claude Code 的自定义命令**——在终端里敲 `/review`、`/sql`，不用把长提示词手打一遍。

```bash
python tools/make-commands.py          # 生成并安装到 ~/.claude/commands
python tools/make-commands.py --dry-run  # 只看内容，不写文件
python tools/make-commands.py --check    # 校验来源与本地文件
```

生成 7 个命令：

| 命令 | 作用 |
|---|---|
| `/review` | 五维审查：正确性 / 性能 / 安全 / 可读性 / 可维护性 |
| `/refactor` | 重构：提重复、改命名、简化逻辑 |
| `/sql` | SQL 性能分析 + 具体 `CREATE INDEX` 语句 |
| `/regex` | 写正则并逐段解释，附边缘用例 |
| `/sh` | 写 Bash 脚本，含错误处理和跨平台注意 |
| `/ci` | 生成 GitHub Actions 工作流 |
| `/explain` | 报错翻译成人话，按可能性排序排查 |

用法：`/review src/api/user.js`，或者直接 `/review` 让它审当前对话里的代码。**给路径比粘代码片段好**——它能自己读文件，看到调用方和现有测试，结论更准。

命令正文是从 `data/prompts.js` 里的提示词**改写**来的——终端场景要改的东西（占位符换掉、加参数兜底、禁止执行 `git commit`）没法机械替换，所以是手写的，**不是运行时读取**。也就是说：改了 `prompts.js` 不会自动更新命令，两边要一起改。

`--check` 会校验两件事：来源条目是否还在、本地文件有没有被手改过。

```bash
python tools/make-commands.py --check
```

> 如果你 `~/.claude/commands` 里已经有 `commit` / `debug` / `generate-tests` 之类的命令，这套不会覆盖它们——重复的三条（提交信息、bug 修复、单元测试）故意没有生成。

---

## 开发与测试

扩展本体零依赖，不需要构建。测试用的依赖写在 `package.json` 的 `devDependencies` 里，只在开发时安装。

```bash
npm install                      # 只装 playwright（测试用）
npm test                         # 一致性检查 + 填入逻辑端到端
```

单独跑：

```bash
node tools/check-consistency.js  # manifest / content / background 三处站点列表是否一致
node tests/fill.test.mjs         # 填入逻辑（需要 playwright）
```

如果不想下载 Playwright 自带的浏览器，可以指定系统里已有的 Chrome：

```bash
CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe" node tests/fill.test.mjs
```

**为什么需要这些测试**：填入功能失效时不会有任何报错——扩展不崩、控制台也干净，用户看到的只是「点了没反应」。平台改一次版，选择器就可能静默失配。这两类检查是唯一能在改版后第一时间发现问题的办法。

---

## 许可

MIT © [Stephen-pc](https://github.com/Stephen-pc)
