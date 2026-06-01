// ============================================================
// PromptHub — Popup Logic
// 核心交互：搜索、分类、卡片渲染、收藏、自定义、自动填充
// ============================================================

// --- State ---
let currentView = 'all';        // 'all' | 'favorites' | 'custom'
let currentCategory = 'all';    // category key
let searchQuery = '';
let selectedPromptId = null;    // for detail modal

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
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  renderCategories();
  renderPrompts();
  bindEvents();

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

function loadData() {
  try {
    favorites = JSON.parse(localStorage.getItem('prompthub_favorites') || '{}');
    customPrompts = JSON.parse(localStorage.getItem('prompthub_custom') || '[]');
  } catch (e) {
    favorites = {};
    customPrompts = [];
  }
}

function saveData() {
  localStorage.setItem('prompthub_favorites', JSON.stringify(favorites));
  localStorage.setItem('prompthub_custom', JSON.stringify(customPrompts));
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
  document.getElementById('btnCopyFromDetail').addEventListener('click', () => copyPrompt(selectedPromptId));
  document.getElementById('btnUseFromDetail').addEventListener('click', () => fillPrompt(selectedPromptId));
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
    <div class="prompt-card" data-id="${p.id}">
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

  // Check if current tab is an AI site
  chrome.runtime.sendMessage({ type: 'CHECK_AI_SITE' }, (response) => {
    if (response && response.isAISite) {
      chrome.runtime.sendMessage({ type: 'FILL_PROMPT', text: prompt.prompt }, (res) => {
        if (res && res.success) {
          showToast('⚡ 已填入聊天框！', 'success');
          window.close();
        } else {
          showToast('⚠️ 填充失败，请手动粘贴', 'warning');
        }
      });
    } else {
      // Copy and notify
      navigator.clipboard.writeText(prompt.prompt).then(() => {
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
function openDetail(id) {
  const prompt = findPrompt(id);
  if (!prompt) return;
  selectedPromptId = id;

  $detailTitle.textContent = prompt.title;
  const catIcon = (CATEGORIES.find(c => c.key === prompt.category) || {}).icon || '📋';
  const catLabel = (CATEGORIES.find(c => c.key === prompt.category) || {}).label || prompt.category;
  $detailCategory.textContent = `${catIcon} ${catLabel}`;
  $detailTags.textContent = (prompt.tags || []).join(' · ');
  $detailPrompt.textContent = prompt.prompt;

  $detailModal.classList.remove('hidden');
  updateDetailFavBtn();
}

function closeDetail() {
  $detailModal.classList.add('hidden');
  selectedPromptId = null;
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

      if (data.customPrompts && Array.isArray(data.customPrompts)) {
        // Merge with existing (don't overwrite — merge by id)
        const existingIds = new Set(customPrompts.map(p => p.id));
        for (const p of data.customPrompts) {
          if (!existingIds.has(p.id)) {
            customPrompts.push(p);
          }
        }
      }

      saveData();
      renderPrompts();
      showToast('📥 数据已导入', 'success');
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
