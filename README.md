# ⚡ PromptHub — AI 提示词工具箱

<p align="center">
  <img src="icons/icon128.png" alt="PromptHub" width="128" />
</p>

<p align="center">
  <strong>200+ 精选 AI 提示词 · 一键填入 · 覆盖主流 AI 对话站</strong>
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

一个浏览器扩展，内置 **200+ 条手写提示词**，分 10 个分类。看到合适的，可以复制走，也可以**一键直接填进你正在用的 AI 对话框**。

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
│   └── prompts.js             # 200+ 提示词模板
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

## 许可

MIT © [Stephen-pc](https://github.com/Stephen-pc)
