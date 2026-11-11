// 自动生成，不要手改。改源文件后重跑 tools/build-web.mjs
// ============================================================
// PromptHub — Popup Logic
// 核心交互：搜索、分类、卡片渲染、收藏、自定义、自动填充
// ============================================================

// --- State ---
let currentView = 'all';        // 'all' | 'favorites' | 'custom'
let currentCategory = 'all';    // category key
let searchQuery = '';
let selectedPromptId = null;    // for detail modal
let detailRawPrompt = '';       // 详情里那条提示词的原始文本（未被占位符替换）

// --- Data ---
let favorites = {};             // { promptId: true }
let customPrompts = [];         // user-created prompts

// --- DOM Elements ---
const $searchInput = document.getElementById('searchInput');
const $btnClearSearch = document.getElementById('btnClearSearch');
const $categoryNav = document.getElementById('categoryNav');
const $contentArea = document.getElementById('contentArea');
const $promptList = document.getElementById('promptList');
const $emptyState = document.getElementById('emptyState');
const $emptyText = document.getElementById('emptyText');
const $toast = document.getElementById('toast');
const $favCount = document.getElementById('favCount');
const $customCount = document.getElementById('customCount');

// Detail modal
const $detailModal = document.getElementById('detailModal');
const $detailTitle = document.getElementById('detailTitle');
const $detailCategory = document.getElementById('detailCategory');
const $detailTags = document.getElementById('detailTags');
const $detailPrompt = document.getElementById('detailPrompt');
const $detailForm = document.getElementById('detailForm');

// Edit modal
const $editModal = document.getElementById('editModal');
const $editModalTitle = document.getElementById('editModalTitle');
const $editTitle = document.getElementById('editTitle');
const $editCategory = document.getElementById('editCategory');
const $editPrompt = document.getElementById('editPrompt');
const $editTags = document.getElementById('editTags');
const $btnDeleteCustom = document.getElementById('btnDeleteCustom');
let editingPromptId = null;

// --- Init ---
document.addEventListener('DOMContentLoaded', async () => {
  // 数据读取是异步的，必须等它回来再渲染，否则首帧永远是空列表
  const state = await loadState();
  favorites = state.favorites;
  customPrompts = state.customPrompts;

  renderCategories();
  renderPrompts();
  bindEvents();

  // 深链：链接里带 #/p/<id> 就直接打开那一条，不用在 185 条里翻
  const initialId = readHashId();
  if (initialId) openDetail(initialId, { fromHash: true });

  // 浏览器前进/后退、手动改地址，都要跟着开合详情
  window.addEventListener('hashchange', () => {
    const id = readHashId();
    if (id) {
      if (id !== selectedPromptId) openDetail(id, { fromHash: true });
    } else if (selectedPromptId) {
      closeDetail({ fromHash: true });
    }
  });

  // Focus search on Ctrl+F / Cmd+F
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      $searchInput.focus();
    }
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
});

// --- Storage ---
// 收藏和自定义提示词存在 chrome.storage.local，不再用 localStorage：
//   - localStorage 挂在扩展源的「站点数据」下，Chrome 清除浏览数据时可能连带清掉，
//     用户攒的收藏会一起消失，而且没有任何提示；
//   - manifest 一直申请着 storage 权限却从未使用（商店审核会问「为什么需要它」）；
//   - 将来要跨设备同步，只有 chrome.storage.sync 这条路，localStorage 做不到。
//
// 主题仍然留在 localStorage：它在 <script> 解析阶段就要生效（否则会先闪一下亮色），
// 而 chrome.storage 是异步的，等它返回画面已经画完了。主题丢了也无所谓，数据不行。
const SCHEMA_VERSION = 1;
const STATE_KEY = 'prompthub_state';
const hasChromeStorage = typeof chrome !== 'undefined' && !!chrome.storage && !!chrome.storage.local;

function blankState() {
  return { schemaVersion: SCHEMA_VERSION, favorites: {}, customPrompts: [] };
}

// 读到的结构一律过一遍这里，别信任存储里的内容——
// 它可能来自旧版本、来自手改，也可能被别的扩展写坏。
function normalizeState(saved) {
  const out = blankState();
  if (saved && typeof saved === 'object') {
    if (saved.favorites && typeof saved.favorites === 'object') out.favorites = saved.favorites;
    if (Array.isArray(saved.customPrompts)) out.customPrompts = saved.customPrompts;
    // 目前只有 v1。将来加迁移时，按 saved.schemaVersion 分支处理再写回
    out.schemaVersion = Number(saved.schemaVersion) || SCHEMA_VERSION;
  }
  return out;
}

// 旧版把数据放在 localStorage 的两个键里，升级时搬一次
function readLegacyState() {
  const out = blankState();
  try {
    out.favorites = JSON.parse(localStorage.getItem('prompthub_favorites') || '{}') || {};
    out.customPrompts = JSON.parse(localStorage.getItem('prompthub_custom') || '[]') || [];
  } catch (e) {
    /* 旧数据坏了就当没有，不影响启动 */
  }
  return out;
}

async function loadState() {
  if (!hasChromeStorage) return readLegacyState();

  try {
    const bag = await chrome.storage.local.get(STATE_KEY);
    if (bag && bag[STATE_KEY]) return normalizeState(bag[STATE_KEY]);

    // 首次运行，或从旧版升级：搬一次，搬完清掉旧键，避免两边不一致
    const legacy = readLegacyState();
    await chrome.storage.local.set({ [STATE_KEY]: legacy });
    try {
      localStorage.removeItem('prompthub_favorites');
      localStorage.removeItem('prompthub_custom');
    } catch (e) { /* 清不掉也不影响，下次读的是新位置 */ }
    return legacy;
  } catch (e) {
    // 存储读不了（权限、损坏）：退回旧路径，至少别白屏
    return readLegacyState();
  }
}

function saveData() {
  const state = { schemaVersion: SCHEMA_VERSION, favorites, customPrompts };

  if (!hasChromeStorage) {
    try {
      localStorage.setItem('prompthub_favorites', JSON.stringify(favorites));
      localStorage.setItem('prompthub_custom', JSON.stringify(customPrompts));
    } catch (e) { /* 配额满就放弃，不打断交互 */ }
    return;
  }

  chrome.storage.local.set({ [STATE_KEY]: state }).catch(() => {
    showToast('⚠️ 保存失败，可能是存储空间不足', 'error');
  });
}

// --- Events ---
function bindEvents() {
  $searchInput.addEventListener('input', debounce(() => {
    searchQuery = $searchInput.value.trim().toLowerCase();
    $btnClearSearch.classList.toggle('hidden', !searchQuery);
    renderPrompts();
  }, 150));

  $btnClearSearch.addEventListener('click', () => {
    $searchInput.value = '';
    searchQuery = '';
    $btnClearSearch.classList.add('hidden');
    renderPrompts();
    $searchInput.focus();
  });

  // Category chips — delegated
  $categoryNav.addEventListener('click', (e) => {
    const chip = e.target.closest('.cat-chip');
    if (!chip) return;
    currentCategory = chip.dataset.category;
    renderCategories();
    renderPrompts();
  });

  // Bottom nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      currentView = item.dataset.view;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      renderPrompts();
    });
  });

  // Card click — delegated
  $promptList.addEventListener('click', (e) => {
    const card = e.target.closest('.prompt-card');
    if (!card) return;

    // Favorite button
    if (e.target.closest('.fav-btn')) {
      e.stopPropagation();
      toggleFavorite(card.dataset.id);
      return;
    }
    // Copy button
    if (e.target.closest('.btn-copy')) {
      e.stopPropagation();
      copyPrompt(card.dataset.id);
      return;
    }
    // Fill button
    if (e.target.closest('.btn-use')) {
      e.stopPropagation();
      fillPrompt(card.dataset.id);
      return;
    }
    // Edit button (custom)
    if (e.target.closest('.btn-edit')) {
      e.stopPropagation();
      openEditModal(card.dataset.id);
      return;
    }
    // Add custom card
    if (e.target.closest('.add-custom-card')) {
      openEditModal();
      return;
    }

    // Open detail
    openDetail(card.dataset.id);
  });

  // Detail modal
  document.getElementById('btnCloseDetail').addEventListener('click', closeDetail);
  document.getElementById('btnCopyFromDetail').addEventListener('click', () => {
    const p = findPrompt(selectedPromptId);
    if (!p) return;
    navigator.clipboard.writeText(applyPlaceholders(p.prompt)).then(() => {
      const n = $detailForm.querySelectorAll('.ph-input[value], .ph-input').length;
      const filled = [...$detailForm.querySelectorAll('.ph-input')].filter(i => i.value.trim()).length;
      showToast(filled ? `✅ 已复制（填了 ${filled} 处）` : '✅ 已复制到剪贴板', 'success');
    }).catch(() => showToast('❌ 复制失败', 'error'));
  });
  document.getElementById('btnUseFromDetail').addEventListener('click', () => {
    const p = findPrompt(selectedPromptId);
    if (!p) return;
    fillText(applyPlaceholders(p.prompt));
  });
  document.getElementById('btnFavoriteFromDetail').addEventListener('click', () => {
    toggleFavorite(selectedPromptId);
    updateDetailFavBtn();
  });
  $detailModal.querySelector('.modal-backdrop')?.addEventListener('click', closeDetail);

  // Edit modal
  document.getElementById('btnCloseEdit').addEventListener('click', closeEditModal);
  document.getElementById('btnSaveCustom').addEventListener('click', saveCustomPrompt);
  document.getElementById('btnDeleteCustom').addEventListener('click', deleteCustomPrompt);
  $editModal.querySelector('.modal-backdrop')?.addEventListener('click', closeEditModal);

  // Import/Export
  document.getElementById('btnExport').addEventListener('click', exportData);
  document.getElementById('btnImport').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });
  document.getElementById('importFile').addEventListener('change', importData);

  // Theme toggle
  document.getElementById('btnTheme').addEventListener('click', toggleTheme);
}

// --- Render Categories ---
function renderCategories() {
  $categoryNav.innerHTML = CATEGORIES.map(cat => {
    const active = cat.key === currentCategory ? ' active' : '';
    const count = cat.key === 'all' ? PROMPTS.length : cat.count;
    return `<button class="cat-chip${active}" data-category="${cat.key}">
      <span class="chip-icon">${cat.icon}</span>${cat.label}
      <span class="chip-count">${count}</span>
    </button>`;
  }).join('');
}

// --- Render Prompts ---
function renderPrompts() {
  let prompts = getFilteredPrompts();

  // Update empty state
  if (prompts.length === 0) {
    $promptList.innerHTML = '';
    $emptyState.classList.remove('hidden');
    if (currentView === 'favorites') {
      $emptyText.textContent = '还没有收藏任何提示词';
    } else if (currentView === 'custom') {
      $emptyText.textContent = '还没有自定义提示词';
    } else {
      $emptyText.textContent = '没有匹配的提示词';
    }
    return;
  }

  $emptyState.classList.add('hidden');

  const categoryMeta = CATEGORIES.find(c => c.key === currentCategory) || {};

  let html = prompts.map(p => {
    const isFav = favorites[p.id] || false;
    const isCustom = p.id && p.id.startsWith('custom_');
    const catIcon = (CATEGORIES.find(c => c.key === p.category) || {}).icon || '📋';
    const catLabel = (CATEGORIES.find(c => c.key === p.category) || {}).label || p.category;
    const preview = (p.prompt || '').replace(/\n/g, ' ').substring(0, 80);

    return `
    <div class="prompt-card" data-id="${escapeAttr(p.id)}">
      <div class="card-header">
        <div class="card-title">${escapeHtml(p.title)}</div>
        <div class="card-actions">
          <button class="btn-icon btn-copy" title="复制">📋</button>
          <button class="btn-icon btn-use" title="填入AI聊天框">⚡</button>
          <button class="btn-icon fav-btn${isFav ? ' favorited' : ''}" title="${isFav ? '取消收藏' : '收藏'}">${isFav ? '⭐' : '☆'}</button>
          ${isCustom ? '<button class="btn-icon btn-edit" title="编辑">✏️</button>' : ''}
        </div>
      </div>
      <div class="card-preview">${escapeHtml(preview)}</div>
      <div class="card-footer">
        <span class="card-tag">${catIcon} ${catLabel}</span>
        ${(p.tags || []).slice(0, 3).map(t => `<span class="card-keyword">${escapeHtml(t)}</span>`).join('')}
        ${isCustom ? '<span class="card-keyword" style="color:var(--success)">自定义</span>' : ''}
      </div>
    </div>`;
  }).join('');

  // Add "new custom" button in custom view
  if (currentView === 'custom') {
    html += `
    <div class="prompt-card add-custom-card">
      <span>➕</span> 添加新的提示词
    </div>`;
  }

  $promptList.innerHTML = html;

  // Update badge counts
  const favCount = Object.keys(favorites).length;
  $favCount.textContent = favCount;
  $favCount.classList.toggle('hidden', favCount === 0);

  const custCount = customPrompts.length;
  $customCount.textContent = custCount;
  $customCount.classList.toggle('hidden', custCount === 0);
}

function getFilteredPrompts() {
  let pool;

  // Determine source pool
  if (currentView === 'favorites') {
    pool = PROMPTS.filter(p => favorites[p.id]);
  } else if (currentView === 'custom') {
    pool = customPrompts;
  } else {
    pool = PROMPTS;
  }

  // Category filter
  if (currentCategory !== 'all') {
    pool = pool.filter(p => p.category === currentCategory);
  }

  // Search filter (fuzzy match on title, tags, prompt)
  if (searchQuery) {
    const q = searchQuery;
    pool = pool.filter(p => {
      if ((p.title || '').toLowerCase().includes(q)) return true;
      if ((p.titleEn || '').toLowerCase().includes(q)) return true;
      if ((p.prompt || '').toLowerCase().includes(q)) return true;
      if ((p.tags || []).some(t => t.toLowerCase().includes(q))) return true;
      if ((p.category || '').toLowerCase().includes(q)) return true;
      // 拼音：搜 gongsi 或 gs 都能找到「公司」。
      // 单字母不参与拼音匹配，否则随便敲一个字母会命中一大片。
      const meta = (typeof SEARCH_INDEX !== 'undefined') ? SEARCH_INDEX[p.id] : null;
      if (q.length >= 2 && meta && (meta.i.includes(q) || meta.f.includes(q))) return true;
      return false;
    });
  }

  return pool;
}

// --- Actions ---
function copyPrompt(id) {
  const prompt = findPrompt(id);
  if (!prompt) return;
  navigator.clipboard.writeText(prompt.prompt).then(() => {
    showToast('✅ 已复制到剪贴板', 'success');
  }).catch(() => {
    showToast('❌ 复制失败', 'error');
  });
}

function fillPrompt(id) {
  const prompt = findPrompt(id);
  if (!prompt) return;
  fillText(prompt.prompt);
}

// 和 fillPrompt 的区别：这里收的是已经拼好的文本（可能已经填过占位符），
// 不再按 id 去查原始提示词。
function fillText(text) {
  // Check if current tab is an AI site
  chrome.runtime.sendMessage({ type: 'CHECK_AI_SITE' }, (response) => {
    if (response && response.isAISite) {
      chrome.runtime.sendMessage({ type: 'FILL_PROMPT', text }, (res) => {
        if (res && res.success) {
          showToast('⚡ 已填入聊天框！', 'success');
          window.close();
        } else {
          showToast('⚠️ 填充失败，请手动粘贴', 'warning');
        }
      });
    } else {
      // Copy and notify
      navigator.clipboard.writeText(text).then(() => {
        showToast('📋 已复制（请在AI页面使用）', 'warning');
      });
    }
  });
}

function toggleFavorite(id) {
  if (favorites[id]) {
    delete favorites[id];
  } else {
    favorites[id] = true;
  }
  saveData();
  renderPrompts();
}

// --- Detail Modal ---
// 提示词里的 [方括号] 就是让用户填的空。185 条里有 178 条带这种占位符，
// 原来只能复制走再手动找括号替换——这是整个产品最大的摩擦点。
function extractPlaceholders(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text).matchAll(/\[([^\[\]]{1,20})\]/g)) {
    const key = m[1].trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(key);
    }
  }
  return out;
}

// 按占位符生成输入框。数量不多（每条平均 2–4 个），全部平铺展示。
function renderPlaceholderForm(text) {
  const keys = extractPlaceholders(text);
  if (!keys.length) {
    $detailForm.innerHTML = '';
    $detailForm.classList.add('hidden');
    return;
  }
  $detailForm.innerHTML = keys.map((k, i) => `
    <label class="ph-field">
      <span class="ph-label">${escapeHtml(k)}</span>
      <input class="ph-input" type="text" data-ph="${escapeAttr(k)}"
             placeholder="填这里…" autocomplete="off" ${i === 0 ? 'data-first="1"' : ''} />
    </label>`).join('');
  $detailForm.classList.remove('hidden');

  // 实时预览：填一个空，下面那段提示词立刻变成替换后的样子。
  // 用户能看见结果，才知道这些框是干什么用的。
  $detailForm.oninput = () => {
    $detailPrompt.textContent = applyPlaceholders(detailRawPrompt);
  };
}

// 用输入框里的内容替换 [xxx]；没填的保持原样，不硬塞空字符串
function applyPlaceholders(text) {
  if (!$detailForm || $detailForm.classList.contains('hidden')) return text;
  let out = String(text);
  for (const input of $detailForm.querySelectorAll('.ph-input')) {
    const value = input.value.trim();
    if (!value) continue;
    out = out.split('[' + input.dataset.ph + ']').join(value);
  }
  return out;
}

// 深链：#/p/<id>。发出去的链接能直接落到某一条上，不用在 185 条里翻。
function readHashId() {
  const m = location.hash.match(/^#\/p\/([\w-]+)$/);
  return m ? m[1] : null;
}

function openDetail(id, { fromHash = false } = {}) {
  const prompt = findPrompt(id);
  if (!prompt) return;
  selectedPromptId = id;

  $detailTitle.textContent = prompt.title;
  const catIcon = (CATEGORIES.find(c => c.key === prompt.category) || {}).icon || '📋';
  const catLabel = (CATEGORIES.find(c => c.key === prompt.category) || {}).label || prompt.category;
  $detailCategory.textContent = `${catIcon} ${catLabel}`;
  $detailTags.textContent = (prompt.tags || []).join(' · ');
  detailRawPrompt = prompt.prompt;
  $detailPrompt.textContent = prompt.prompt;
  renderPlaceholderForm(prompt.prompt);

  $detailModal.classList.remove('hidden');
  updateDetailFavBtn();

  if (!fromHash && location.hash !== '#/p/' + id) {
    location.hash = '#/p/' + id;
  }
  // 打开就聚焦第一个空，省一次点击
  const first = $detailForm.querySelector('.ph-input');
  if (first) first.focus();
}

function closeDetail({ fromHash = false } = {}) {
  $detailModal.classList.add('hidden');
  selectedPromptId = null;
  if (!fromHash && readHashId()) {
    location.hash = '';
  }
}

function updateDetailFavBtn() {
  const btn = document.getElementById('btnFavoriteFromDetail');
  if (selectedPromptId && favorites[selectedPromptId]) {
    btn.textContent = '⭐';
    btn.classList.add('favorited');
  } else {
    btn.textContent = '☆';
    btn.classList.remove('favorited');
  }
}

// --- Edit Modal (Custom Prompts) ---
function openEditModal(id) {
  editingPromptId = id || null;
  $btnDeleteCustom.classList.toggle('hidden', !id);

  // Populate category select
  $editCategory.innerHTML = CATEGORIES
    .filter(c => c.key !== 'all')
    .map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`)
    .join('');

  if (id) {
    const prompt = customPrompts.find(p => p.id === id);
    if (prompt) {
      $editModalTitle.textContent = '编辑自定义提示词';
      $editTitle.value = prompt.title || '';
      $editCategory.value = prompt.category || 'writing';
      $editPrompt.value = prompt.prompt || '';
      $editTags.value = (prompt.tags || []).join(', ');
    }
  } else {
    $editModalTitle.textContent = '添加自定义提示词';
    $editTitle.value = '';
    $editCategory.value = 'writing';
    $editPrompt.value = '';
    $editTags.value = '';
  }

  $editModal.classList.remove('hidden');
  $editTitle.focus();
}

function closeEditModal() {
  $editModal.classList.add('hidden');
  editingPromptId = null;
}

function saveCustomPrompt() {
  const title = $editTitle.value.trim();
  const category = $editCategory.value;
  const prompt = $editPrompt.value.trim();
  const tags = $editTags.value.split(',').map(t => t.trim()).filter(Boolean);

  if (!title || !prompt) {
    showToast('⚠️ 标题和内容不能为空', 'warning');
    return;
  }

  if (editingPromptId) {
    // Update existing
    const idx = customPrompts.findIndex(p => p.id === editingPromptId);
    if (idx >= 0) {
      customPrompts[idx] = {
        ...customPrompts[idx],
        title,
        category,
        prompt,
        tags,
        titleEn: ''
      };
    }
  } else {
    // Create new
    customPrompts.push({
      id: 'custom_' + Date.now(),
      category,
      title,
      titleEn: '',
      prompt,
      tags
    });
  }

  saveData();
  closeEditModal();
  renderPrompts();
  showToast('✅ 已保存', 'success');
}

function deleteCustomPrompt() {
  if (!editingPromptId) return;
  customPrompts = customPrompts.filter(p => p.id !== editingPromptId);
  if (favorites[editingPromptId]) delete favorites[editingPromptId];
  saveData();
  closeEditModal();
  renderPrompts();
  showToast('🗑️ 已删除', 'success');
}

// --- Import / Export ---
function exportData() {
  const data = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    favorites: Object.keys(favorites),
    customPrompts: customPrompts
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompthub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📤 数据已导出', 'success');
}

const VALID_CATEGORIES = new Set([
  'writing', 'coding', 'translation', 'marketing', 'education',
  'data', 'creative', 'productivity', 'roleplay', 'utility'
]);

// 导入的 JSON 来自外部文件，不能直接信任。
// 不校验的话，一个 id 里带引号和 <img onerror> 的文件就能在 popup 里执行脚本，
// 而 popup 有 chrome.* 权限、也能读到你所有提示词。返回 null 表示丢弃该条。
function sanitizePrompt(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const str = (v, max) => (typeof v === 'string' ? v.slice(0, max).trim() : '');
  const title = str(raw.title, 200);
  const prompt = str(raw.prompt, 20000);
  if (!title || !prompt) return null;

  const id = (typeof raw.id === 'string' && /^custom_[A-Za-z0-9_-]{1,64}$/.test(raw.id))
    ? raw.id
    : 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  return {
    id,
    title,
    prompt,
    category: VALID_CATEGORIES.has(raw.category) ? raw.category : 'utility',
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter(t => typeof t === 'string').map(t => t.slice(0, 40)).slice(0, 8)
      : []
  };
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);

      if (data.favorites && Array.isArray(data.favorites)) {
        favorites = {};
        data.favorites.forEach(id => { favorites[id] = true; });
      }

      let rejected = 0;
      if (data.customPrompts && Array.isArray(data.customPrompts)) {
        // Merge with existing (don't overwrite — merge by id)
        const existingIds = new Set(customPrompts.map(p => p.id));
        for (const raw of data.customPrompts) {
          const p = sanitizePrompt(raw);
          if (!p) { rejected += 1; continue; }
          if (!existingIds.has(p.id)) {
            customPrompts.push(p);
            existingIds.add(p.id);
          }
        }
      }

      saveData();
      renderPrompts();
      if (rejected) {
        showToast(`📥 已导入，跳过 ${rejected} 条无效数据`, 'error');
      } else {
        showToast('📥 数据已导入', 'success');
      }
    } catch (err) {
      showToast('❌ 文件格式错误', 'error');
    }
  };
  reader.readAsText(file);

  // Reset file input
  e.target.value = '';
}

// --- Helpers ---
function findPrompt(id) {
  // Check built-in
  let p = PROMPTS.find(p => p.id === id);
  if (p) return p;
  // Check custom
  return customPrompts.find(p => p.id === id);
}

function closeAllModals() {
  closeDetail();
  closeEditModal();
}

function showToast(msg, type = '') {
  $toast.textContent = msg;
  $toast.className = 'toast ' + type;
  $toast.classList.remove('hidden');
  clearTimeout($toast._timeout);
  $toast._timeout = setTimeout(() => {
    $toast.classList.add('hidden');
  }, 2000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// 属性值必须单独转义：上面的 escapeHtml 只处理 & < >，
// 引号原样保留——放进 data-xxx="..." 里就能闭合属性并注入标签。
function escapeAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --- Theme Toggle ---
function toggleTheme() {
  const html = document.documentElement;
  const current = html.getAttribute('data-theme');
  if (current === 'dark') {
    html.removeAttribute('data-theme');
    localStorage.setItem('prompthub_theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('prompthub_theme', 'dark');
  }
}

// Apply saved theme on load
(function initTheme() {
  const saved = localStorage.getItem('prompthub_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
