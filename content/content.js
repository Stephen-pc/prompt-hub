// PromptHub — Content Script
// 自动检测 AI 网站并注入提示词到输入框
// 支持: ChatGPT, Claude, DeepSeek, Kimi, Poe, 通义千问

(function() {
  'use strict';

  const host = location.hostname;

  // AI 平台输入框选择器映射
  const PLATFORM_SELECTORS = {
    'chatgpt.com': {
      input: '#prompt-textarea',
      type: 'textarea'
    },
    'claude.ai': {
      input: 'div[contenteditable="true"].ProseMirror',
      type: 'contenteditable',
      // Claude has multiple contenteditables, use the main chat input
      fallback: '[contenteditable="true"]'
    },
    'chat.deepseek.com': {
      input: '#chat-input',
      type: 'textarea'
    },
    'kimi.moonshot.cn': {
      input: 'div[contenteditable="true"]',
      type: 'contenteditable'
    },
    'poe.com': {
      input: 'textarea[class*="chat"]',
      type: 'textarea',
      fallback: 'textarea'
    },
    'tongyi.aliyun.com': {
      input: 'textarea',
      type: 'textarea'
    },
    'www.kimi.com': {
      input: 'div[contenteditable="true"]',
      type: 'contenteditable'
    },
    'www.doubao.com': {
      input: 'textarea',
      type: 'textarea',
      fallback: 'div[contenteditable="true"]'
    },
    'yuanbao.tencent.com': {
      input: 'div[contenteditable="true"]',
      type: 'contenteditable',
      fallback: 'textarea'
    },
    'chatglm.cn': {
      input: 'textarea',
      type: 'textarea',
      fallback: 'div[contenteditable="true"]'
    },
    'gemini.google.com': {
      input: 'rich-textarea div[contenteditable="true"]',
      type: 'contenteditable',
      fallback: 'div[contenteditable="true"]'
    }
  };

  function getPlatformConfig() {
    for (const [domain, config] of Object.entries(PLATFORM_SELECTORS)) {
      if (host.includes(domain)) return { domain, ...config };
    }
    return null;
  }

  // 返回 { el, type }。type 按元素实际类型推断，不盲信配置——
  // 平台改版后原选择器可能命中的是另一种元素，用错填充函数会静默失败。
  function findInputElement(config) {
    const resolved = (el) => ({
      el,
      type: el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' ? 'textarea' : 'contenteditable'
    });

    let el = document.querySelector(config.input);
    if (el && isVisible(el)) return resolved(el);

    if (config.fallback) {
      for (const candidate of document.querySelectorAll(config.fallback)) {
        if (isVisible(candidate)) return resolved(candidate);
      }
    }

    // 通用兜底：任意可见的 textarea / contenteditable / role=textbox。
    // 原来只对 contenteditable 兜底，textarea 类站点（豆包、智谱、通义）
    // 一旦改版就直接「input element not found」，用户看到的是「填不进去」。
    for (const sel of ['textarea', 'div[contenteditable="true"]', '[role="textbox"]']) {
      for (const candidate of document.querySelectorAll(sel)) {
        if (isVisible(candidate)) return resolved(candidate);
      }
    }

    return null;
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
           style.display !== 'none' &&
           style.visibility !== 'hidden' &&
           style.opacity !== '0';
  }

  function fillTextarea(el, text) {
    el.focus();
    // Use native setter to trigger React/Vue bindings
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    );
    if (nativeSetter && nativeSetter.set) {
      nativeSetter.set.call(el, text);
    } else {
      el.value = text;
    }
    // Dispatch events to notify framework
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillContentEditable(el, text) {
    el.focus();

    // Clear existing content
    el.innerHTML = '';

    // Insert text as paragraph(s)
    const paragraphs = text.split('\n');
    paragraphs.forEach((para, i) => {
      const p = document.createElement('p');
      p.textContent = para || ' ';
      el.appendChild(p);
    });

    // Move cursor to end
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    // Dispatch input event
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillPrompt(text) {
    const config = getPlatformConfig();
    if (!config) {
      return { success: false, error: 'unknown platform' };
    }

    const found = findInputElement(config);
    if (!found) {
      return { success: false, error: 'input element not found' };
    }

    const { el, type } = found;
    try {
      if (type === 'contenteditable') {
        fillContentEditable(el, text);
      } else {
        fillTextarea(el, text);
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // Listen for fill requests from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_PROMPT') {
      const result = fillPrompt(message.text);
      sendResponse(result);
    }
    return true;
  });

  console.log(`[PromptHub] Ready on ${host}`);
})();
