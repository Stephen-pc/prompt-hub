// PromptHub — Service Worker
// 功能：接收 popup 消息，转发给 content script 执行自动填充

// 必须与 manifest 的 host_permissions、content.js 的 PLATFORM_SELECTORS 保持一致。
// 三处任一遗漏，表现都是「在某个站点点填入没反应」——最难排查的那类问题。
const AI_SITES = [
  'chatgpt.com',
  'claude.ai',
  'chat.deepseek.com',
  'kimi.moonshot.cn',
  'kimi.com',
  'poe.com',
  'tongyi.aliyun.com',
  'doubao.com',
  'yuanbao.tencent.com',
  'chatglm.cn',
  'gemini.google.com'
];

// 检测当前标签页是否为 AI 网站
function isAISite(url) {
  return AI_SITES.some(site => url.includes(site));
}

// 监听来自 popup 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_AI_SITE') {
    // 查询当前活动标签页
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        const isAI = isAISite(tabs[0].url || '');
        sendResponse({ isAISite: isAI, url: tabs[0].url, tabId: tabs[0].id });
      } else {
        sendResponse({ isAISite: false });
      }
    });
    return true; // 异步响应
  }

  if (message.type === 'FILL_PROMPT') {
    // 将提示词发送到当前标签页的 content script
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0 && isAISite(tabs[0].url || '')) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'FILL_PROMPT',
          text: message.text
        }, (response) => {
          sendResponse(response || { success: false, error: 'no response' });
        });
      } else {
        sendResponse({ success: false, error: 'not on AI site' });
      }
    });
    return true;
  }
});

// 扩展安装/更新时的初始化
chrome.runtime.onInstalled.addListener(() => {
  console.log('PromptHub installed successfully!');
});
