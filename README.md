# ⚡ PromptHub — AI Prompt Toolbox

<p align="center">
  <img src="icons/icon128.png" alt="PromptHub Logo" width="128" />
</p>

<p align="center">
  <strong>200+ Curated AI Prompts · One-Click Fill · Works Everywhere</strong>
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#installation">Installation</a> ·
  <a href="#usage">Usage</a> ·
  <a href="#supported-platforms">Platforms</a>
</p>

---

## 🎯 What is PromptHub?

PromptHub is a beautiful browser extension that gives you instant access to **200+ hand-picked AI prompts** across 10 categories. With one click, you can copy a prompt or **auto-fill it directly into ChatGPT, Claude, DeepSeek, Kimi, Poe, and more.**

No more typing the same instructions over and over. No more digging through notes to find that perfect prompt.

[中文说明](#中文说明)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🏷️ **10 Categories** | Writing, Coding, Translation, Marketing, Education, Data Analysis, Creative, Productivity, Role Play, Utility |
| 🔍 **Instant Search** | Fuzzy search in Chinese & English — find any prompt in seconds |
| ⚡ **One-Click Fill** | Auto-injects prompts into AI chat inputs (ChatGPT, Claude, DeepSeek, Kimi, Poe, Tongyi) |
| ⭐ **Favorites** | Bookmark your most-used prompts for quick access |
| ✏️ **Custom Prompts** | Create and manage your own prompt templates |
| 📤 **Import/Export** | Backup and share your custom prompts as JSON |
| 🌓 **Dark Mode** | Automatically follows your system theme, with manual toggle |
| 🔒 **100% Local** | All data stored in your browser — no tracking, no servers, no analytics |

---

## 📥 Installation

### Step 1: Download

Click the green **「<> Code」** button above → **「Download ZIP」**, then unzip to any folder.

### Step 2: Load the Extension

#### Edge / Chrome

1. Open `edge://extensions` (Edge) or `chrome://extensions` (Chrome)
2. Turn on **「Developer mode」**
3. Click **「Load unpacked」**
4. Select the unzipped `prompt-hub-main` folder
5. Done! The ⚡ icon appears in your toolbar

#### Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **「Load Temporary Add-on…」**
3. Select the `manifest.json` file in the unzipped folder

> 💡 **Note:** Developer mode extensions may show a warning on browser startup — just dismiss it, the extension works fine.

---

## 🚀 Usage

1. Click the ⚡ PromptHub icon in your browser toolbar
2. **Browse** prompts by category or **search** with keywords
3. Click any card to see the full prompt
4. Choose your action:
   - **📋 Copy** — Copy to clipboard
   - **⚡ Fill** — Auto-inject into the AI chat you're currently on
   - **⭐ Star** — Save to favorites

> 💡 **Tip:** Open ChatGPT/Claude/DeepSeek in your current tab, then click "⚡ Fill" on any prompt — it will be injected automatically!

---

## 🏗️ Supported AI Platforms

| Platform | URL | Auto-Fill |
|----------|-----|:---------:|
| ChatGPT | chatgpt.com | ✅ |
| Claude | claude.ai | ✅ |
| DeepSeek | chat.deepseek.com | ✅ |
| Kimi | kimi.moonshot.cn | ✅ |
| Poe | poe.com | ✅ |
| Tongyi Qianwen | tongyi.aliyun.com | ✅ |

---

## 📂 Project Structure

```
prompt-hub/
├── manifest.json              # MV3 manifest (Chrome/Edge/Firefox)
├── background/
│   └── background.js          # Service Worker — message routing
├── content/
│   └── content.js             # Auto-fill injection for AI sites
├── popup/
│   ├── popup.html             # Main popup UI
│   ├── popup.css              # Design system (light + dark)
│   └── popup.js               # Core logic
├── data/
│   └── prompts.js             # 200+ prompt templates
├── icons/                     # Extension icons (16/48/128/300)
└── generate-icons.js          # Pure Node.js icon generator
```

---

## 🛠️ Tech Stack

- **Manifest V3** — Latest browser extension standard
- **Vanilla JS / CSS / HTML** — Zero dependencies, instant load
- **localStorage** — Privacy-first, all data stays local

---

## 🔒 Privacy

PromptHub does **not** collect, transmit, or store any data outside your browser. There are no analytics, no tracking, and no external servers. All prompts are embedded in the extension, and your favorites/custom prompts are stored locally.

---

## 📄 License

MIT © [Stephen-pc](https://github.com/Stephen-pc)

---

---

## 中文说明

### PromptHub — AI 提示词工具箱

一键获取 **200+ 精选 AI 提示词模板**，覆盖写作、编程、翻译、营销、教育、数据分析、创意、生产力、角色扮演、实用工具 10 个分类。

**核心功能：**
- 🔍 中英文搜索，秒找提示词
- ⚡ 一键填入 ChatGPT / Claude / DeepSeek / Kimi / Poe / 通义千问
- ⭐ 收藏常用提示词
- ✏️ 自定义提示词模板，支持 JSON 导入导出
- 🌓 暗色/亮色主题自动切换
- 🔒 所有数据本地存储，无追踪、无服务器

**安装方法：** 点击页面上方绿色「Code」按钮 → Download ZIP → 解压 → Chrome 浏览器打开 `chrome://extensions` → 开启开发者模式 → 加载已解压的扩展程序 → 选择解压后的文件夹。

---

<p align="center">
  Made with ❤️ for the AI community
</p>
