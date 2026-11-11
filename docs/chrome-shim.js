// 让扩展版的 popup.js 直接跑在普通网页里。
//
// popup.js 只依赖两个 chrome API：
//   chrome.storage.local.get / set   —— 收藏和自定义提示词
//   chrome.runtime.sendMessage       —— 判断当前标签页是不是 AI 站点、把提示词填进去
//
// 网页里没有扩展上下文，所以这里：
//   - storage 用 localStorage 顶上，键名形状保持一致
//   - sendMessage 一律回答「不是 AI 站点」，于是 popup.js 自己会走它原有的
//     降级分支：复制到剪贴板并提示「请在 AI 页面使用」。不用改它一行代码。

(function () {
  'use strict';

  const PREFIX = 'prompthub_web_';

  const storage = {
    local: {
      get(key) {
        const raw = localStorage.getItem(PREFIX + key);
        let value = null;
        try {
          value = raw === null ? null : JSON.parse(raw);
        } catch (e) {
          value = null;
        }
        return Promise.resolve({ [key]: value });
      },
      set(obj) {
        try {
          for (const [k, v] of Object.entries(obj)) {
            localStorage.setItem(PREFIX + k, JSON.stringify(v));
          }
          return Promise.resolve();
        } catch (e) {
          // 配额满或被隐私模式禁掉，交给调用方的 catch 处理
          return Promise.reject(e);
        }
      },
    },
  };

  const runtime = {
    sendMessage(message, callback) {
      // 网页里没有「当前标签页」，所以永远不是 AI 站点。
      // popup.js 收到 false 会自己复制到剪贴板，这正是网页版该有的行为。
      if (typeof callback === 'function') {
        callback({ isAISite: false, url: location.href });
      }
    },
  };

  // 只有在真正的扩展环境之外才覆盖，避免误伤
  if (typeof chrome === 'undefined' || !chrome.storage) {
    window.chrome = { storage, runtime };
  }
})();
