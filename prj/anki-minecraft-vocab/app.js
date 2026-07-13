(() => {
  'use strict';

  const state = {
    manifest: null,
    tree: [],
    cards: [],
    flatDecks: [],
    selectedPath: [],
    selectedCardId: null,
    query: '',
    scope: 'all',
    visibleLimit: 80,
    answerVisible: false,
    expanded: new Set(),
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  const pathKey = (path) => path.join('\u0000');
  const encodePath = (path) => encodeURIComponent(JSON.stringify(path));
  const decodePath = (value) => JSON.parse(decodeURIComponent(value));
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const formatNumber = (value) => new Intl.NumberFormat('zh-CN').format(Number(value || 0));
  const assetUrl = (value) => encodeURI(String(value || ''));

  async function loadJson(path) {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`${path} (${response.status})`);
    return response.json();
  }

  function showToast(message, tone = 'normal') {
    const toast = $('[data-toast]');
    toast.textContent = message;
    toast.dataset.tone = tone;
    toast.classList.add('is-visible');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('is-visible'), 3000);
  }

  function setError(error) {
    const message = error instanceof Error ? error.message : String(error);
    $('[data-directory-status]').textContent = '目录读取失败';
    $('[data-card-list]').innerHTML = `<div class="error-block"><strong>无法加载词卡数据</strong><p>${escapeHtml(message)}</p><p>请通过本地静态服务打开，例如 <code>python -m http.server 8766</code>，不要直接双击 HTML。</p></div>`;
    $('[data-source-status]').textContent = '加载失败';
  }

  function nodeByPath(path) {
    let nodes = state.tree;
    let result = null;
    for (const part of path) {
      result = nodes.find((node) => node.name === part) || null;
      if (!result) return null;
      nodes = result.children || [];
    }
    return result;
  }

  function renderDirectoryNode(node, depth = 0) {
    const key = pathKey(node.path);
    const hasChildren = node.children?.length > 0;
    const isExpanded = state.expanded.has(key);
    const isSelected = pathKey(state.selectedPath) === key;
    const toggle = hasChildren
      ? `<button class="tree-toggle" type="button" data-action="toggle-node" data-path="${encodePath(node.path)}" aria-label="${isExpanded ? '收起' : '展开'} ${escapeHtml(node.name)}" aria-expanded="${isExpanded}">${isExpanded ? '⌄' : '›'}</button>`
      : '<span class="tree-spacer" aria-hidden="true"></span>';
    const children = hasChildren && isExpanded
      ? `<div class="tree-children">${node.children.map((child) => renderDirectoryNode(child, depth + 1)).join('')}</div>`
      : '';
    return `<div class="tree-node depth-${Math.min(depth, 5)}">
      <div class="tree-row ${isSelected ? 'is-selected' : ''}">
        ${toggle}
        <button class="tree-label" type="button" data-action="select-deck" data-path="${encodePath(node.path)}">
          <span class="tree-name">${escapeHtml(node.name)}</span>
          <span class="tree-count">${formatNumber(node.cardCount)}</span>
        </button>
      </div>
      ${children}
    </div>`;
  }

  function renderDirectory() {
    $('[data-directory]').innerHTML = state.tree.map((node) => renderDirectoryNode(node)).join('');
    const selected = nodeByPath(state.selectedPath);
    $('[data-directory-status]').textContent = selected
      ? `${formatNumber(selected.cardCount)} 张卡片 · ${state.flatDecks.length} 个末级目录`
      : '目录已就绪';
  }

  function fieldEntries(card) {
    return Object.entries(card.fields || {});
  }

  function readableText(card) {
    return fieldEntries(card).filter(([, field]) => !field.encrypted).map(([, field]) => field.text).filter(Boolean).join(' ');
  }

  function titleFromMedia(card) {
    const reference = (card.media || []).find((item) => item.kind === 'audio') || (card.media || [])[0];
    if (!reference) return `卡片 ${card.id}`;
    return reference.name.replace(/\.(mp3|wav|ogg|m4a|png|jpg|jpeg|gif|webp)$/i, '');
  }

  function displayTitle(card) {
    const candidates = ['mainword', 'word', 'Front', 'Text', 'targetword', 'number'];
    for (const name of candidates) {
      const field = card.fields?.[name];
      if (field && !field.encrypted && field.text && !/^\d+$/.test(field.text) && !field.text.includes('[sound:')) return field.text;
    }
    return titleFromMedia(card);
  }

  function displayDefinition(card) {
    const candidates = ['meaning', 'permeaning', 'Back', 'meaning2', 'explanation', 'targetsentence', 'nativesentence'];
    const text = candidates.map((name) => card.fields?.[name]).find((field) => field && !field.encrypted && field.text);
    if (text) return text.text;
    return '内容字段在此 Anki 包中以加密形式保存，当前先展示目录、媒体和可恢复字段。';
  }

  function isWithin(card, selectedPath) {
    return selectedPath.every((part, index) => card.deckPath[index] === part);
  }

  function matches(card) {
    if (!isWithin(card, state.selectedPath)) return false;
    if (state.scope === 'readable' && !readableText(card)) return false;
    if (state.scope === 'media' && !(card.media || []).length) return false;
    if (!state.query) return true;
    const haystack = [card.deckPath.join(' '), card.modelName, card.templateName, card.sortField, displayTitle(card), readableText(card), ...(card.media || []).map((item) => item.name)].join(' ').toLowerCase();
    return haystack.includes(state.query.toLowerCase());
  }

  function filteredCards() {
    return state.cards.filter(matches);
  }

  function renderMedia(card) {
    const images = (card.media || []).filter((item) => item.kind === 'image' && item.available);
    const audio = (card.media || []).filter((item) => item.kind === 'audio' && item.available);
    const imageMarkup = images.length ? `<div class="media-gallery">${images.slice(0, 4).map((item) => `<figure><img src="${assetUrl(item.path)}" alt="${escapeHtml(item.name)}" loading="lazy"><figcaption>${escapeHtml(item.name)}</figcaption></figure>`).join('')}</div>` : '';
    const audioMarkup = audio.length ? `<div class="audio-list">${audio.slice(0, 5).map((item) => `<div class="audio-row"><span>${escapeHtml(item.name)}</span><audio controls preload="none" src="${assetUrl(item.path)}"></audio></div>`).join('')}</div>` : '';
    if (!imageMarkup && !audioMarkup) return '<div class="media-empty">这张卡片没有可解析的本地媒体引用。</div>';
    return `${imageMarkup}${audioMarkup}`;
  }

  function renderDetail() {
    const card = state.cards.find((item) => item.id === state.selectedCardId);
    if (!card) {
      $('[data-card-detail]').innerHTML = '<div class="empty-detail"><span class="empty-number">01</span><h3>选择一张卡片</h3><p>目录和搜索结果会显示在这里。媒体会从本地提取目录加载，不依赖外部网站。</p></div>';
      return;
    }
    const encryptedCount = fieldEntries(card).filter(([, field]) => field.encrypted).length;
    const fieldMarkup = fieldEntries(card).map(([name, field]) => `<div class="field-row"><div class="field-name">${escapeHtml(name)}</div><div class="field-value ${field.encrypted ? 'is-encrypted' : ''}">${field.encrypted ? 'Anki 加密字段，暂不显示原文' : escapeHtml(field.text || '空字段')}</div></div>`).join('');
    $('[data-card-detail]').innerHTML = `<div class="detail-header">
      <div><p class="section-kicker">CARD ${escapeHtml(String(card.id))}</p><h3>${escapeHtml(displayTitle(card))}</h3><p class="detail-path">${escapeHtml(card.deckPath.join(' / '))}</p></div>
      <button class="answer-button ${state.answerVisible ? 'is-active' : ''}" type="button" data-action="toggle-answer" aria-pressed="${state.answerVisible}">${state.answerVisible ? '隐藏释义' : '显示释义'}</button>
    </div>
    <div class="card-face ${state.answerVisible ? 'is-answer' : ''}">
      <div class="face-label">${state.answerVisible ? 'ANSWER' : 'PROMPT'}</div>
      <div class="face-title">${escapeHtml(state.answerVisible ? displayDefinition(card) : displayTitle(card))}</div>
      ${state.answerVisible ? `<div class="answer-copy">${encryptedCount ? `<span class="encryption-note">${encryptedCount} 个字段仍为加密状态</span>` : ''}${fieldMarkup}</div>` : '<p class="face-hint">先根据图片或音频回想，再查看释义字段。</p>'}
    </div>
    <div class="detail-section"><div class="subheading"><h4>本地媒体</h4><span class="muted">${formatNumber(card.media?.length || 0)} 项</span></div>${renderMedia(card)}</div>
    <div class="detail-meta"><span>${escapeHtml(card.modelName)}</span><span>${escapeHtml(card.templateName)}</span><span>${(card.tags || []).length ? escapeHtml(card.tags.join(' · ')) : '无标签'}</span></div>`;
  }

  function renderCards() {
    const selected = nodeByPath(state.selectedPath);
    const results = filteredCards();
    const visible = results.slice(0, state.visibleLimit);
    $('[data-current-deck]').textContent = selected?.name || '全部卡片';
    $('[data-result-summary]').textContent = `${formatNumber(results.length)} / ${formatNumber(selected?.cardCount || state.cards.length)} 张匹配`;
    $('[data-list-range]').textContent = results.length ? `显示 ${formatNumber(visible.length)} 张` : '';
    $('[data-card-list]').innerHTML = results.length ? visible.map((card) => {
      const active = card.id === state.selectedCardId;
      const mediaBadge = card.media?.length ? `<span class="row-badge">${formatNumber(card.media.length)} 媒体</span>` : '';
      const encryptedBadge = fieldEntries(card).some(([, field]) => field.encrypted) ? '<span class="row-badge is-muted">加密字段</span>' : '';
      return `<button class="card-row ${active ? 'is-active' : ''}" type="button" data-action="select-card" data-card-id="${card.id}"><span class="row-index">${String(card.id).slice(-3)}</span><span class="row-main"><strong>${escapeHtml(displayTitle(card))}</strong><span>${escapeHtml(displayDefinition(card).slice(0, 96))}</span><small>${escapeHtml(card.deckPath.slice(-2).join(' / '))}</small></span><span class="row-badges">${mediaBadge}${encryptedBadge}</span></button>`;
    }).join('') : `<div class="empty-list"><span class="empty-number">00</span><h3>没有匹配卡片</h3><p>尝试缩短搜索词，或切换到上级目录。</p></div>`;
    const loadMore = $('[data-action="load-more"]');
    loadMore.hidden = visible.length >= results.length;
    if (visible.length) {
      if (!state.selectedCardId || !visible.some((card) => card.id === state.selectedCardId)) state.selectedCardId = visible[0].id;
      renderDetail();
    } else {
      state.selectedCardId = null;
      renderDetail();
    }
  }

  function chooseDeck(path) {
    state.selectedPath = path;
    state.visibleLimit = 80;
    state.selectedCardId = null;
    state.answerVisible = false;
    renderDirectory();
    renderCards();
    if (window.innerWidth < 900) document.body.classList.remove('directory-open');
  }

  function handleAction(action, target) {
    if (action === 'toggle-directory') {
      const open = document.body.classList.toggle('directory-open');
      $('.mobile-menu-button').setAttribute('aria-expanded', String(open));
      $('.mobile-backdrop').hidden = !open;
    } else if (action === 'collapse-all') {
      state.expanded.clear();
      renderDirectory();
    } else if (action === 'toggle-node') {
      const path = decodePath(target.dataset.path);
      const key = pathKey(path);
      if (state.expanded.has(key)) state.expanded.delete(key); else state.expanded.add(key);
      renderDirectory();
    } else if (action === 'select-deck') {
      chooseDeck(decodePath(target.dataset.path));
    } else if (action === 'select-card') {
      state.selectedCardId = Number(target.dataset.cardId);
      state.answerVisible = false;
      renderCards();
    } else if (action === 'toggle-answer') {
      state.answerVisible = !state.answerVisible;
      renderDetail();
    } else if (action === 'load-more') {
      state.visibleLimit += 80;
      renderCards();
    } else if (action === 'clear-search') {
      $('[data-search]').value = '';
      state.query = '';
      state.visibleLimit = 80;
      renderCards();
    }
  }

  function attachEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target.closest('[data-action]');
      if (target) handleAction(target.dataset.action, target);
    });
    $('[data-search]').addEventListener('input', (event) => {
      state.query = event.target.value.trim();
      state.visibleLimit = 80;
      renderCards();
    });
    $('[data-scope]').addEventListener('change', (event) => {
      state.scope = event.target.value;
      state.visibleLimit = 80;
      renderCards();
    });
  }

  async function init() {
    if (window.location.protocol === 'file:') {
      setError(new Error('检测到 file:// 打开方式'));
      return;
    }
    attachEvents();
    try {
      const [manifest, decks, cards] = await Promise.all([loadJson('data/manifest.json'), loadJson('data/decks.json'), loadJson('data/cards.json')]);
      state.manifest = manifest;
      state.tree = decks.tree || [];
      state.flatDecks = decks.flat || [];
      state.cards = cards;
      state.selectedPath = state.tree[0]?.path || [];
      state.tree.slice(0, 1).forEach((root) => {
        state.expanded.add(pathKey(root.path));
        (root.children || []).forEach((child) => state.expanded.add(pathKey(child.path)));
      });
      $('[data-stat="cards"]').textContent = formatNumber(manifest.cardCount);
      $('[data-stat="decks"]').textContent = formatNumber(manifest.deckCount);
      $('[data-stat="media"]').textContent = formatNumber(manifest.mediaCount);
      $('[data-source-status]').textContent = `${manifest.databaseEntry} · ${formatNumber(manifest.encryptedFieldCount)} 个字段保留加密状态`;
      renderDirectory();
      renderCards();
    } catch (error) {
      setError(error);
    }
  }

  window.renderDirectory = renderDirectory;
  window.toggleAnswer = () => handleAction('toggle-answer', $('[data-action="toggle-answer"]'));
  window.addEventListener('DOMContentLoaded', init);
})();
