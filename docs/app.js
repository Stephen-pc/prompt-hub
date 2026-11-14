// 网页版只与扩展共用 PROMPTS、CATEGORIES 和 SEARCH_INDEX；不依赖 chrome API。
// 旧网页版状态键保持不变，用户的收藏、自定义内容无需迁移。
const STORAGE_KEY = 'prompthub_web_prompthub_state';
const THEME_KEY = 'prompthub_theme';
const PLACEHOLDER = /\[([^\[\]]{1,20})\]/g;
const CATEGORY_KEYS = new Set(CATEGORIES.map(category => category.key).filter(key => key !== 'all'));
const $ = id => document.getElementById(id);
const ui = Object.fromEntries([
  'searchInput', 'viewNav', 'categoryNav', 'promptList', 'resultsCount', 'emptyState',
  'emptyText', 'editorEmpty', 'editorDetail', 'customEditor', 'detailTitle',
  'detailCategory', 'detailDescription', 'detailForm', 'fieldSection', 'fieldCount',
  'detailPrompt', 'missingCount', 'copyHint', 'favoriteButton', 'editButton',
  'customHeading', 'customTitle', 'customCategory', 'customTags', 'customText',
  'deleteButton', 'dataButton', 'dataMenu', 'importFile', 'toast', 'allCount',
  'favCount', 'customCount'
].map(id => [id, $(id)]));
let state = { schemaVersion: 1, favorites: {}, customPrompts: [] };
let view = 'all';
let category = 'all';
let selectedId = null;
let editingId = null;
let draft = new Map();
let toastTimer;

function notify(message) {
  ui.toast.textContent = message;
  ui.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { ui.toast.hidden = true; }, 3500);
}

function validCustom(raw, preserveExisting = false) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim() : '';
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!preserveExisting && (title.length > 100 || prompt.length > 20000)) return null;
  if (!title || !prompt) return null;
  return {
    id: typeof raw.id === 'string' && /^custom_[\w-]{1,64}$/.test(raw.id)
      ? raw.id : 'custom_' + crypto.randomUUID().replaceAll('-', ''),
    title, prompt, titleEn: '',
    category: CATEGORY_KEYS.has(raw.category) ? raw.category : 'utility',
    tags: Array.isArray(raw.tags) ? raw.tags.filter(t => typeof t === 'string')
      .map(t => t.trim().slice(0, 40)).filter(Boolean).slice(0, 8) : []
  };
}
function normalize(raw) {
  if (!raw || typeof raw !== 'object') return state;
  const favorites = Object.create(null);
  if (raw.favorites && typeof raw.favorites === 'object' && !Array.isArray(raw.favorites)) {
    for (const [id, active] of Object.entries(raw.favorites)) {
      if (/^[\w-]{1,75}$/.test(id) && active === true) favorites[id] = true;
    }
  }
  // 读旧数据不截断：限制只对新输入生效，否则下一次保存会永久丢失旧条目。
  const customPrompts = Array.isArray(raw.customPrompts)
    ? raw.customPrompts.map(item => validCustom(item, true)).filter(Boolean) : [];
  return { schemaVersion: 1, favorites, customPrompts };
}
function persist(next) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    state = next;
    return true;
  } catch {
    notify('保存失败：浏览器可能禁用了本地存储。请先导出已有备份。');
    return false;
  }
}
function findPrompt(id) {
  return PROMPTS.find(prompt => prompt.id === id) || state.customPrompts.find(prompt => prompt.id === id);
}
function fieldNames(text) {
  return [...new Set([...text.matchAll(PLACEHOLDER)].map(match => match[1].trim()).filter(Boolean))];
}
function categoryName(key) {
  return CATEGORIES.find(item => item.key === key)?.label || '其他';
}
function matching(prompt, q) {
  if (!q) return true;
  if ([prompt.title, prompt.titleEn, prompt.prompt, prompt.category, ...(prompt.tags || [])]
    .some(value => String(value || '').toLowerCase().includes(q))) return true;
  const meta = SEARCH_INDEX[prompt.id];
  return q.length > 1 && !!meta && (meta.i.includes(q) || meta.f.includes(q));
}
function currentPool() {
  let pool = view === 'custom' ? state.customPrompts
    : view === 'favorites' ? [...PROMPTS, ...state.customPrompts].filter(p => state.favorites[p.id])
    : [...PROMPTS, ...state.customPrompts];
  if (category !== 'all') pool = pool.filter(p => p.category === category);
  const query = ui.searchInput.value.trim().toLowerCase();
  return pool.filter(p => matching(p, query));
}
function renderCategories() {
  ui.categoryNav.replaceChildren();
  for (const item of CATEGORIES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = item.label;
    button.dataset.category = item.key;
    button.setAttribute('aria-pressed', String(category === item.key));
    ui.categoryNav.append(button);
  }
}
function renderList() {
  ui.allCount.textContent = PROMPTS.length + state.customPrompts.length;
  ui.favCount.textContent = Object.keys(state.favorites).filter(id => state.favorites[id]).length;
  ui.customCount.textContent = state.customPrompts.length;
  ui.viewNav.querySelectorAll('[data-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(view === button.dataset.view));
  });
  renderCategories();
  const prompts = currentPool();
  ui.resultsCount.textContent = `${prompts.length} 条结果`;
  ui.emptyState.hidden = prompts.length !== 0;
  ui.emptyText.textContent = view === 'favorites' && !ui.searchInput.value
    ? '还没有收藏。选一条，在右侧点“收藏”即可。'
    : view === 'custom' && !ui.searchInput.value
      ? '还没有自己写的提示词。点“新建我的提示词”试试。'
      : '没有找到匹配的提示词。';
  const fragment = document.createDocumentFragment();
  for (const prompt of prompts) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'prompt-row';
    row.dataset.id = prompt.id;
    row.setAttribute('aria-current', String(prompt.id === selectedId));
    const top = document.createElement('span');
    top.className = 'row-top';
    const title = document.createElement('span');
    title.className = 'row-title';
    title.textContent = prompt.title;
    const kind = document.createElement('span');
    kind.className = 'row-kind';
    kind.textContent = categoryName(prompt.category);
    const summary = document.createElement('span');
    summary.className = 'row-summary';
    summary.textContent = prompt.prompt.replace(/\s+/g, ' ').slice(0, 80);
    top.append(title, kind);
    row.append(top, summary);
    fragment.append(row);
  }
  ui.promptList.replaceChildren(fragment);
}
function showPanel(panel) {
  ui.editorEmpty.hidden = panel !== 'empty';
  ui.editorDetail.hidden = panel !== 'detail';
  ui.customEditor.hidden = panel !== 'custom';
  document.body.classList.toggle('has-selection', panel !== 'empty');
  if (panel !== 'empty' && matchMedia('(max-width: 800px)').matches) window.scrollTo(0, 0);
}
function readIdFromHash() {
  if (!location.hash.startsWith('#/p/')) return null;
  try {
    const id = decodeURIComponent(location.hash.slice(4));
    return /^[\w-]{1,75}$/.test(id) ? id : null;
  } catch {
    return null;
  }
}
function updatePreview() {
  const source = findPrompt(selectedId)?.prompt || '';
  const values = new Map([...ui.detailForm.querySelectorAll('[data-field]')]
    .map(input => [input.dataset.field, input.value.trim()]));
  const output = source.replace(PLACEHOLDER, (match, name) => values.get(name.trim()) || match);
  const missing = fieldNames(source).filter(name => !values.get(name));
  ui.detailPrompt.textContent = output;
  ui.missingCount.textContent = missing.length ? `${missing.length} 项未填` : '已填写完整';
  ui.copyHint.textContent = missing.length
    ? `还有 ${missing.length} 项未填；复制时将保留原占位符。`
    : '复制后粘贴到你常用的 AI 对话框。';
  return output;
}
function selectPrompt(id, updateHash = true) {
  const prompt = findPrompt(id);
  if (!prompt) return false;
  if (selectedId !== id) draft = new Map();
  selectedId = id;
  editingId = null;
  ui.detailTitle.textContent = prompt.title;
  ui.detailCategory.textContent = categoryName(prompt.category);
  ui.detailDescription.textContent = (prompt.tags || []).join(' · ') || '可直接复制，也可以填好再复制';
  ui.favoriteButton.setAttribute('aria-pressed', String(!!state.favorites[id]));
  ui.favoriteButton.textContent = state.favorites[id] ? '已收藏' : '收藏';
  ui.editButton.hidden = !id.startsWith('custom_');
  ui.detailForm.replaceChildren();
  const fields = fieldNames(prompt.prompt);
  ui.fieldSection.hidden = fields.length === 0;
  ui.fieldCount.textContent = `${fields.length} 项，可留空`;
  for (const [index, field] of fields.entries()) {
    const label = document.createElement('label');
    label.className = 'field' + (/代码|原文|内容|描述|记录|文本|正文|示例/.test(field) ? ' field-wide' : '');
    label.textContent = field;
    const input = /代码|原文|内容|描述|记录|文本|正文|示例/.test(field)
      ? document.createElement('textarea') : document.createElement('input');
    if (input.tagName === 'TEXTAREA') input.rows = 3;
    input.dataset.field = field;
    input.placeholder = `输入${field}`;
    input.autocomplete = 'off';
    input.value = draft.get(field) || '';
    if (index === 0) input.id = 'firstField';
    label.append(input);
    ui.detailForm.append(label);
  }
  updatePreview();
  showPanel('detail');
  renderList();
  if (updateHash && location.hash !== '#/p/' + id) location.hash = '#/p/' + id;
  return true;
}
function returnToList() {
  selectedId = null;
  editingId = null;
  draft = new Map();
  showPanel('empty');
  renderList();
  if (location.hash.startsWith('#/p/')) history.replaceState(null, '', location.pathname + location.search);
  if (!matchMedia('(max-width: 800px)').matches) ui.searchInput.focus({ preventScroll: true });
}
function openCustom(id = null) {
  const prompt = id ? state.customPrompts.find(p => p.id === id) : null;
  editingId = prompt?.id || null;
  ui.customHeading.textContent = prompt ? '编辑我的提示词' : '新建提示词';
  ui.customTitle.value = prompt?.title || '';
  ui.customCategory.value = prompt?.category || 'writing';
  ui.customTags.value = (prompt?.tags || []).join(', ');
  ui.customText.value = prompt?.prompt || '';
  ui.deleteButton.hidden = !prompt;
  showPanel('custom');
  ui.customTitle.focus({ preventScroll: true });
}
async function copyText(text, message) {
  try { await navigator.clipboard.writeText(text); notify(message); }
  catch { notify('复制失败。请在 HTTPS 页面使用，或手动选中预览文字。'); }
}
function importBackup(file) {
  if (!file || file.size > 2 * 1024 * 1024) { notify('文件过大：备份需小于 2 MB。'); return; }
  file.text().then(text => {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.favorites) || !Array.isArray(data.customPrompts)
      || data.favorites.length > 2000 || data.customPrompts.length > 500) throw Error('bad backup');
    const favorites = { ...state.favorites };
    for (const id of data.favorites) {
      if (typeof id === 'string' && /^[\w-]{1,75}$/.test(id)) favorites[id] = true;
    }
    const byId = new Map(state.customPrompts.map(item => [item.id, item]));
    let added = 0;
    for (const entry of data.customPrompts) {
      const item = validCustom(entry, true);
      if (item && !byId.has(item.id)) { byId.set(item.id, item); added++; }
    }
    if (persist({ schemaVersion: 1, favorites, customPrompts: [...byId.values()] })) {
      renderList();
      notify(`导入完成：新增 ${added} 条；现有收藏和同名条目没有被覆盖。`);
    }
  }).catch(() => notify('文件格式不正确：请选择 PromptHub 导出的 JSON 备份。'));
}
function exportBackup() {
  const backup = { version: '1.0.0', exportedAt: new Date().toISOString(),
    favorites: Object.keys(state.favorites).filter(id => state.favorites[id]), customPrompts: state.customPrompts };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `prompthub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('备份已下载。');
}

(function init() {
  let savedTheme = 'dark';
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing) state = normalize(JSON.parse(existing));
    else {
      // 兼容早期网页/扩展保留在 localStorage 的旧键，仅首次迁移。
      const oldFavorites = JSON.parse(localStorage.getItem('prompthub_favorites') || '{}');
      const oldCustom = JSON.parse(localStorage.getItem('prompthub_custom') || '[]');
      state = normalize({ favorites: oldFavorites, customPrompts: oldCustom });
      if (Object.keys(state.favorites).length || state.customPrompts.length) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    }
    savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  } catch { notify('本地数据读取失败；先检查或导出浏览器旧数据，再保存新收藏。'); }
  document.documentElement.dataset.theme = savedTheme === 'light' ? 'light' : 'dark';
  for (const item of CATEGORIES.filter(item => item.key !== 'all')) {
    const option = document.createElement('option');
    option.value = item.key;
    option.textContent = item.label;
    ui.customCategory.append(option);
  }
  renderList();
  const id = readIdFromHash();
  if (id && !selectPrompt(id, false)) notify('这条提示词不存在。请从列表中重新选择。');
  ui.searchInput.addEventListener('input', renderList);
  ui.viewNav.addEventListener('click', event => {
    const button = event.target.closest('[data-view]');
    if (!button) return;
    view = button.dataset.view;
    category = 'all';
    renderList();
  });
  ui.categoryNav.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    renderList();
  });
  ui.promptList.addEventListener('click', event => {
    const row = event.target.closest('[data-id]');
    if (row) selectPrompt(row.dataset.id);
  });
  $('resetButton').addEventListener('click', () => { view = 'all'; category = 'all'; ui.searchInput.value = ''; renderList(); });
  $('newPromptButton').addEventListener('click', () => openCustom());
  ui.detailForm.addEventListener('input', event => {
    if (!event.target.matches('[data-field]')) return;
    draft.set(event.target.dataset.field, event.target.value);
    updatePreview();
  });
  $('copyButton').addEventListener('click', () => copyText(updatePreview(), '成品已复制。'));
  $('shareButton').addEventListener('click', () => {
    const base = location.protocol === 'file:'
      ? 'https://stephen-pc.github.io/prompt-hub/'
      : location.origin + location.pathname;
    copyText(base + '#/p/' + selectedId, '链接已复制，可直接分享这一条。');
  });
  ui.favoriteButton.addEventListener('click', () => {
    if (!selectedId) return;
    const favorites = { ...state.favorites };
    if (favorites[selectedId]) delete favorites[selectedId];
    else favorites[selectedId] = true;
    if (persist({ ...state, favorites })) selectPrompt(selectedId, false);
  });
  ui.editButton.addEventListener('click', () => openCustom(selectedId));
  $('backButton').addEventListener('click', returnToList);
  $('cancelMobileButton').addEventListener('click', returnToList);
  $('cancelEditButton').addEventListener('click', () => {
    if (selectedId && findPrompt(selectedId)) selectPrompt(selectedId, false);
    else returnToList();
  });
  ui.customEditor.addEventListener('submit', event => {
    event.preventDefault();
    const nextPrompt = validCustom({ id: editingId || 'custom_' + crypto.randomUUID().replaceAll('-', ''),
      title: ui.customTitle.value, prompt: ui.customText.value,
      category: ui.customCategory.value, tags: ui.customTags.value.split(',') });
    if (!nextPrompt) { notify('标题和内容都要填写。'); return; }
    const customPrompts = editingId
      ? state.customPrompts.map(item => item.id === editingId ? nextPrompt : item)
      : [...state.customPrompts, nextPrompt];
    if (persist({ ...state, customPrompts })) {
      selectPrompt(nextPrompt.id);
      notify('已保存到本机浏览器。');
    }
  });
  ui.deleteButton.addEventListener('click', () => {
    if (!editingId || !confirm('删除这条自定义提示词？删除后无法恢复。')) return;
    const customPrompts = state.customPrompts.filter(item => item.id !== editingId);
    const favorites = { ...state.favorites };
    delete favorites[editingId];
    if (persist({ ...state, favorites, customPrompts })) { returnToList(); notify('已删除。'); }
  });
  ui.dataButton.addEventListener('click', () => {
    ui.dataMenu.hidden = !ui.dataMenu.hidden;
    ui.dataButton.setAttribute('aria-expanded', String(!ui.dataMenu.hidden));
  });
  document.addEventListener('click', event => {
    if (!ui.dataMenu.hidden && !ui.dataMenu.contains(event.target) && !ui.dataButton.contains(event.target)) {
      ui.dataMenu.hidden = true;
      ui.dataButton.setAttribute('aria-expanded', 'false');
    }
  });
  $('importButton').addEventListener('click', () => { ui.dataMenu.hidden = true; ui.importFile.click(); });
  ui.importFile.addEventListener('change', () => { importBackup(ui.importFile.files[0]); ui.importFile.value = ''; });
  $('exportButton').addEventListener('click', () => { ui.dataMenu.hidden = true; exportBackup(); });
  $('themeButton').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem(THEME_KEY, theme); } catch { notify('主题偏好无法保存，刷新后会恢复默认。'); }
    ui.dataMenu.hidden = true;
  });
  window.addEventListener('hashchange', () => {
    const id = readIdFromHash();
    if (id && id !== selectedId) {
      if (!selectPrompt(id, false)) notify('这条提示词不存在。');
    } else if (!id && selectedId) returnToList();
  });
  document.addEventListener('keydown', event => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (event.key === '/' && !typing) { event.preventDefault(); returnToList(); ui.searchInput.focus(); }
    if (event.key === 'Escape' && !ui.dataMenu.hidden) { ui.dataMenu.hidden = true; ui.dataButton.focus(); }
    else if (event.key === 'Escape' && document.body.classList.contains('has-selection')) returnToList();
  });
})();
