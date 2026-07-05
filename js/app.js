/**
 * app.js - 主应用入口，整合所有系统
 * 负责：任务系统、积分系统、页面切换、UI 渲染
 */

// (Styles would normally be in a CSS file, adding here via JS for ease of implementation in this task)
const style = document.createElement('style');
style.textContent = `
.battle-shake { animation: shake 0.5s; }
@keyframes shake {
    0% { transform: translate(1px, 1px) rotate(0deg); }
    10% { transform: translate(-1px, -2px) rotate(-1deg); }
    20% { transform: translate(-3px, 0px) rotate(1deg); }
    30% { transform: translate(3px, 2px) rotate(0deg); }
    40% { transform: translate(1px, -1px) rotate(1deg); }
    50% { transform: translate(-1px, 2px) rotate(-1deg); }
    60% { transform: translate(-3px, 1px) rotate(0deg); }
    70% { transform: translate(3px, 1px) rotate(-1deg); }
    80% { transform: translate(-1px, -1px) rotate(1deg); }
    90% { transform: translate(1px, 2px) rotate(0deg); }
    100% { transform: translate(1px, -2px) rotate(-1deg); }
}
.battle-flash-red { animation: flash-red 0.5s; }
@keyframes flash-red {
    0% { background-color: transparent; }
    50% { background-color: rgba(255, 0, 0, 0.3); }
    100% { background-color: transparent; }
}
.log-player { color: #4ade80; }
.log-enemy { color: #f87171; }
.log-system { color: #94a3b8; font-style: italic; }
.log-reward { color: #fbbf24; font-weight: bold; }
`;
document.head.appendChild(style);

// ============ 任务维度数据 ============
// ... (rest of the file)

const DIMENSIONS = {
    learning: {
        name: '学习力', en: 'Learning', icon: 'book-open',
        tasks: [
            { name: '阅读 20 分钟', pts: 1 },
            { name: '练字一页', pts: 1 },
            { name: '背诵一首古诗', pts: 2 },
            { name: '完成英语听写', pts: 2 },
            { name: '数学专项练习', pts: 2 },
            { name: '写日记', pts: 2 }
        ]
    },
    sports: {
        name: '运动力', en: 'Sports', icon: 'bike',
        tasks: [
            { name: '运动 30 分钟', pts: 1 },
            { name: '跳绳 100 个', pts: 2 },
            { name: '户外跑步', pts: 2 },
            { name: '球类运动 1 小时', pts: 2 },
            { name: '骑行 5 公里', pts: 3 },
            { name: '早起晨练', pts: 2 }
        ]
    },
    selfcontrol: {
        name: '自控力', en: 'Self-control', icon: 'clock',
        tasks: [
            { name: '屏幕时间不超过 2 小时', pts: 2 },
            { name: '整理书桌', pts: 1 },
            { name: '制定明日计划', pts: 1 },
            { name: '按时起床', pts: 1 },
            { name: '独立完成作业', pts: 2 },
            { name: '无需提醒洗漱', pts: 1 }
        ]
    },
    exploration: {
        name: '探索力', en: 'Exploration', icon: 'compass',
        tasks: [
            { name: '观察一种植物', pts: 1 },
            { name: '学做一道新菜', pts: 3 },
            { name: '阅读一本新书', pts: 2 },
            { name: '记录一个好奇点', pts: 1 },
            { name: '绘制一张地图', pts: 2 },
            { name: '探索家附近新路线', pts: 1 }
        ]
    },
    practice: {
        name: '实践力', en: 'Practice', icon: 'wrench',
        tasks: [
            { name: '帮做家务', pts: 1 },
            { name: '整理房间', pts: 1 },
            { name: '浇花/养宠物', pts: 1 },
            { name: '垃圾分类投放', pts: 1 },
            { name: '洗自己的衣物', pts: 2 },
            { name: '做一道家常菜', pts: 3 }
        ]
    },
    petcare: {
        name: '守护力', en: 'Pet Care', icon: 'paw-print',
        tasks: [
            { name: '喂食（按宠物种类按时喂）', pts: 2 },
            { name: '清理宠物窝/笼', pts: 2 },
            { name: '陪伴玩耍 15 分钟', pts: 2 },
            { name: '健康检查（观察状态）', pts: 1 },
            { name: '遛宠物（如适用）', pts: 3 },
            { name: '给宠物梳毛/抚摸', pts: 1 },
            { name: '记录宠物成长日记', pts: 2 }
        ]
    }
};

// ============ 应用状态 ============
let totalPoints = 0;
let completedTasks = new Set();
let activeExploreSceneId = null;

Object.defineProperty(window, 'totalPoints', {
    configurable: true,
    get() {
        return totalPoints;
    },
    set(value) {
        const parsed = Number(value);
        totalPoints = Number.isFinite(parsed) ? parsed : 0;
    }
});

// ============ 持久化 ============
function saveAppState() {
    window.totalPoints = totalPoints;
    localStorage.setItem('petbank_points', totalPoints.toString());
    localStorage.setItem('petbank_completed', JSON.stringify([...completedTasks]));
}
function loadAppState() {
    totalPoints = parseInt(localStorage.getItem('petbank_points') || '0');
    const saved = localStorage.getItem('petbank_completed');
    if (saved) completedTasks = new Set(JSON.parse(saved));
    localStorage.setItem('petbank_tasks_completed_today', String(completedTasks.size));
    window.totalPoints = totalPoints;
}

// ============ 任务系统 ============
function toggleTask(dim, taskName, pts) {
    const tid = `${dim}-${taskName}`;
    if (completedTasks.has(tid)) {
        completedTasks.delete(tid);
        totalPoints -= pts;
    } else {
        completedTasks.add(tid);
        totalPoints += pts;
    }
    localStorage.setItem('petbank_tasks_completed_today', String(completedTasks.size));
    saveAppState();
    renderAll();
}

function renderTaskGrid() {
    const container = document.getElementById('taskGrid');
    if (!container) return;
    const allTasks = [];
    Object.entries(DIMENSIONS).forEach(([dimKey, dim]) => {
        dim.tasks.forEach(t => allTasks.push({ dim: dimKey, dimName: dim.name, ...t }));
    });
    container.innerHTML = allTasks.map(t => {
        const tid = `${t.dim}-${t.name}`;
        const done = completedTasks.has(tid);
        return `
            <div class="task-card ${done ? 'done' : ''}" onclick="toggleTask('${t.dim}', '${t.name}', ${t.pts})">
                <div class="checkbox">${done ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}</div>
                <div class="flex-1 min-w-0">
                    <div class="text-sm">${t.name}</div>
                    <div class="dim-tag mt-1 inline-block">${t.dimName}</div>
                </div>
                <div class="point-capsule"><span>+${t.pts}</span></div>
            </div>
        `;
    }).join('');
}

function renderSidebarTasks() {
    const container = document.getElementById('sidebarTasks');
    if (!container) return;
    const samples = [
        { dim: 'learning', task: '阅读 20 分钟', pts: 1 },
        { dim: 'sports', task: '运动 30 分钟', pts: 1 },
        { dim: 'selfcontrol', task: '屏幕时间不超过 2 小时', pts: 2 }
    ];
    container.innerHTML = samples.map(s => {
        const tid = `${s.dim}-${s.task}`;
        const done = completedTasks.has(tid);
        return `
            <div class="task-card ${done ? 'done' : ''}" onclick="toggleTask('${s.dim}', '${s.task}', ${s.pts})">
                <div class="checkbox">${done ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}</div>
                <div class="flex-1 min-w-0 text-xs truncate">${s.task}</div>
                <div class="text-xs font-bold" style="color: var(--sage-green);">+${s.pts}</div>
            </div>
        `;
    }).join('');
}

function updateStats() {
    window.totalPoints = totalPoints;
    document.getElementById('topPoints').textContent = totalPoints;
    document.getElementById('accountPoints').textContent = totalPoints;
    const sc = document.getElementById('statCompleted');
    const sd = document.getElementById('statDeposited');
    const sh = document.getElementById('statHighlight');
    if (sc) sc.textContent = completedTasks.size;
    if (sd) sd.textContent = totalPoints;
    if (sh) {
        let litDims = 0;
        Object.keys(DIMENSIONS).forEach(d => {
            if (DIMENSIONS[d].tasks.some(t => completedTasks.has(`${d}-${t.name}`))) litDims++;
        });
        sh.textContent = `${litDims}/6`;
    }
    updateMapCompanionCard();
}

function updateTopPoints() {
    totalPoints = parseInt(localStorage.getItem('petbank_points') || '0', 10);
    window.totalPoints = totalPoints;
    updateStats();
}

function getRecommendedScene() {
    if (!window.ExplorationSystem || typeof ExplorationSystem.getAllScenes !== 'function') {
        return null;
    }
    const scenes = ExplorationSystem.getAllScenes();
    if (!Array.isArray(scenes) || scenes.length === 0) return null;

    const unlocked = scenes.filter((scene) => ExplorationSystem.isSceneUnlocked(scene));
    if (unlocked.length > 0) {
        return unlocked.sort((a, b) => {
            if ((a.min_level || 0) !== (b.min_level || 0)) return (a.min_level || 0) - (b.min_level || 0);
            return (a.hp_cost || 0) - (b.hp_cost || 0);
        })[0];
    }

    return scenes.slice().sort((a, b) => {
        if ((a.min_level || 0) !== (b.min_level || 0)) return (a.min_level || 0) - (b.min_level || 0);
        return (a.unlock_cost || 0) - (b.unlock_cost || 0);
    })[0];
}

function updateMapCompanionCard() {
    const companionImg = document.getElementById('mapCompanionImg');
    const companionName = document.getElementById('mapCompanionName');
    const companionStage = document.getElementById('mapCompanionStage');
    const nextSceneHint = document.getElementById('mapNextSceneHint');

    if (!companionImg || !companionName || !companionStage || !nextSceneHint || !window.PetSystem) return;

    const pet = PetSystem.getState();
    const hasSpecies = !!pet.species;
    const stageImage = hasSpecies && typeof PetSystem.getCurrentStageImage === 'function'
        ? PetSystem.getCurrentStageImage()
        : 'assets/pets/poses/dog_idle.webp';
    companionImg.src = stageImage || 'assets/pets/poses/dog_idle.webp';

    if (hasSpecies) {
        const petName = pet.species_data?.name || pet.species || '我的伙伴';
        companionName.textContent = petName;
        companionStage.textContent = `${pet.stage?.name || '成长'}阶段 · Lv.${pet.level} · ❤️ ${pet.hp}/${pet.total_max_hp}`;
    } else {
        companionName.textContent = '还没有领养宠物';
        companionStage.textContent = '去宠物养成页挑一位伙伴一起冒险';
    }

    const recommendedScene = getRecommendedScene();
    if (recommendedScene) {
        const unlocked = ExplorationSystem.isSceneUnlocked(recommendedScene);
        nextSceneHint.textContent = unlocked
            ? `推荐下一站：${recommendedScene.emoji} ${recommendedScene.name}`
            : `下一站目标：Lv.${recommendedScene.min_level} 解锁 ${recommendedScene.name}`;
    } else {
        nextSceneHint.textContent = '下一站会显示在这里';
    }
}

function addGrowthPoints(delta) {
    totalPoints += delta;
    if (totalPoints < 0) totalPoints = 0;
    saveAppState();
    updateStats();
    return totalPoints;
}

// 积分预检 + 扣分（R3 定案：宠物小屋喂食等扣分入口封装）
// 预检 totalPoints >= n，不足 alert 并 return false；足则 addGrowthPoints(-n) 返回 true
function spendPoints(n) {
    if (typeof totalPoints === 'undefined' || totalPoints < n) {
        alert('成长分不足，快去完成任务赚积分吧！');
        return false;
    }
    addGrowthPoints(-n);
    return true;
}

// ============ 加分/扣分项目弹窗 (point-item modal) ============
// 预设项来自 data/point-items.json；自定义项存 localStorage['petbank_custom_items'] 并合并展示。
// 加分复用 addGrowthPoints；扣分用 deductGrowthPoints（允许扣到负数，区别于消费预检的 spendPoints）。
let pointItems = { add: [], deduct: [] };
let piMode = 'add';                 // 'add' | 'deduct'
let piCustomItems = [];             // [{emoji,name,pts,mode}]
const PI_DEFAULT_EMOJI = { add: '⭐', deduct: '⚠️' };

async function loadPointItems() {
    try {
        const resp = await fetch('data/point-items.json');
        if (resp.ok) {
            const data = await resp.json();
            pointItems.add = Array.isArray(data.add) ? data.add : [];
            pointItems.deduct = Array.isArray(data.deduct) ? data.deduct : [];
        }
    } catch (e) { console.warn('point-items.json 加载失败:', e); }
    try { piCustomItems = JSON.parse(localStorage.getItem('petbank_custom_items') || '[]'); }
    catch (e) { piCustomItems = []; }
}

// 扣分（惩罚语义）：允许 totalPoints 变为负数。addGrowthPoints 会把 <0 截断到 0，spendPoints 会预检拒绝。
function deductGrowthPoints(pts) {
    totalPoints -= Math.max(0, Math.floor(pts));
    saveAppState();
    updateStats();
    return totalPoints;
}

function getPiList(mode) {
    const base = (pointItems[mode] || []).map(it => Object.assign({}, it, { _custom: false }));
    const custom = piCustomItems.filter(it => it.mode === mode).map(it => Object.assign({}, it, { _custom: true }));
    return base.concat(custom);
}
// 删除已收藏的自定义项（按唯一 id）
function removeCustomItem(item) {
    if (!item || !item.id) return;
    piCustomItems = piCustomItems.filter(it => it.id !== item.id);
    try { localStorage.setItem('petbank_custom_items', JSON.stringify(piCustomItems)); } catch (e) {}
}

function openPointItemModal() {
    const modal = document.getElementById('pointItemModal');
    if (!modal) return;
    piMode = 'add';
    const si = document.getElementById('piSearchInput'); if (si) si.value = '';
    syncPiTabs(); syncPiHeader(); renderPointItems();
    modal.classList.add('show');
}
function closePointItemModal() {
    const m = document.getElementById('pointItemModal'); if (m) m.classList.remove('show');
}
function switchPiMode(mode) {
    piMode = mode;
    const si = document.getElementById('piSearchInput'); if (si) si.value = '';
    syncPiTabs(); syncPiHeader(); renderPointItems();
}
function syncPiTabs() {
    document.querySelectorAll('.pi-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === piMode));
    const m = document.querySelector('.pi-modal'); if (m) m.classList.toggle('is-deduct', piMode === 'deduct');
}
function syncPiHeader() {
    const mt = document.getElementById('piModeText'); if (mt) mt.textContent = piMode === 'add' ? '加分' : '扣分';
    const img = document.getElementById('piPetImg');
    const stage = (window.PetSystem && typeof PetSystem.getCurrentStageImage === 'function') ? PetSystem.getCurrentStageImage() : null;
    if (img && stage) img.src = stage;
    const cn = document.getElementById('piChildName');
    if (cn) {
        const p = (window.ProfileManager && typeof ProfileManager.getActive === 'function') ? ProfileManager.getActive() : null;
        cn.textContent = (p && p.name) ? p.name : '宝贝';
    }
}
function escapePiHtml(s) {
    return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
function renderPointItems() {
    const grid = document.getElementById('piGrid'); if (!grid) return;
    const kw = (document.getElementById('piSearchInput').value || '').trim().toLowerCase();
    const list = getPiList(piMode).filter(it => !kw || (it.name || '').toLowerCase().includes(kw));
    const sign = piMode === 'add' ? '+' : '-';
    const cls = piMode === 'add' ? 'pi-add' : 'pi-deduct';
    const defEmoji = PI_DEFAULT_EMOJI[piMode];
    grid.innerHTML = list.length ? list.map((it, i) => `
        <button class="pi-item ${cls} ${it._custom ? 'pi-is-custom' : ''}" data-idx="${i}">
            <span class="pi-item-emoji">${it.emoji || defEmoji}</span>
            <span class="pi-item-name">${escapePiHtml(it.name || '')}</span>
            <span class="pi-item-pts">${sign}${Math.max(1, Math.floor(it.pts || 1))}</span>
            ${it._custom ? '<span class="pi-item-del" data-del="' + i + '" title="删除">×</span>' : ''}
        </button>`).join('') : `<p class="pi-empty">没有匹配的项目</p>`;
    grid.querySelectorAll('.pi-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = parseInt(el.dataset.idx, 10);
            const item = list[idx];
            if (item) applyPointItem(item, el);
        });
    });
    grid.querySelectorAll('.pi-item-del').forEach(d => {
        d.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(d.dataset.del, 10);
            const item = list[idx];
            if (item && confirm('删除自定义项「' + (item.name || '') + '」？')) {
                removeCustomItem(item);
                renderPointItems();
            }
        });
    });
}
function filterPointItems() { renderPointItems(); }
function applyPointItem(item, originEl) {
    const pts = Math.max(1, Math.floor(item.pts || 1));
    if (piMode === 'add') { addGrowthPoints(pts); floatPointFeedback('+' + pts, true, originEl); }
    else { deductGrowthPoints(pts); floatPointFeedback('-' + pts, false, originEl); }
    updateRewardPetCard();
}
function applyCustomItem() {
    const emojiEl = document.getElementById('piCustomEmoji');
    const nameEl = document.getElementById('piCustomName');
    const ptsEl = document.getElementById('piCustomPts');
    let emoji = (emojiEl && emojiEl.value || '').trim();
    let name = (nameEl && nameEl.value || '').trim();
    let pts = parseInt(ptsEl && ptsEl.value, 10);
    if (!Number.isFinite(pts) || pts < 1) pts = 1;
    if (!name) { if (nameEl) nameEl.focus(); return; }   // 必须填项目名
    const item = {
        id: 'c' + Date.now() + Math.random().toString(36).slice(2, 6),
        emoji: emoji || PI_DEFAULT_EMOJI[piMode],
        name: name, pts: pts, mode: piMode
    };
    try {
        piCustomItems.push(item);
        localStorage.setItem('petbank_custom_items', JSON.stringify(piCustomItems));
    } catch (e) {}
    applyPointItem(item, document.getElementById('piCustomBtn'));
    if (emojiEl) emojiEl.value = '';
    if (nameEl) nameEl.value = '';
    if (ptsEl) ptsEl.value = 1;
    renderPointItems();
}
// 浮动 +N/-N 反馈：在被点击的项目按钮（或形象卡）上向上飘起
function floatPointFeedback(text, isAdd, el) {
    const host = el || document.getElementById('rewardPetCard');
    if (!host) return;
    const f = document.createElement('div');
    f.className = 'pi-float ' + (isAdd ? 'pi-float-add' : 'pi-float-deduct');
    f.textContent = text;
    host.appendChild(f);
    setTimeout(() => f.remove(), 1100);
}
// 刷新积分页顶部宠物形象卡（图/名/孩子名/当前积分）
function updateRewardPetCard() {
    const img = document.getElementById('rewardPetImg');
    const petName = document.getElementById('rewardPetName');
    const childName = document.getElementById('rewardChildName');
    const cur = document.getElementById('rewardCurPoints');
    const stage = (window.PetSystem && typeof PetSystem.getCurrentStageImage === 'function') ? PetSystem.getCurrentStageImage() : null;
    if (img) img.src = stage || 'assets/pets/poses/dog_idle.webp';
    const p = (window.ProfileManager && typeof ProfileManager.getActive === 'function') ? ProfileManager.getActive() : null;
    if (childName) childName.textContent = (p && p.name) ? p.name : '宝贝';
    const pet = (window.PetSystem && typeof PetSystem.getState === 'function') ? PetSystem.getState() : null;
    if (petName) petName.textContent = (pet && pet.name) ? pet.name : '点击伙伴开启奖惩';
    if (cur) cur.textContent = (window.totalPoints != null) ? window.totalPoints : 0;
}

function completeRecommended() {
    const samples = [
        { dim: 'learning', task: '阅读 20 分钟', pts: 1 },
        { dim: 'sports', task: '运动 30 分钟', pts: 1 },
        { dim: 'selfcontrol', task: '屏幕时间不超过 2 小时', pts: 2 }
    ];
    samples.forEach(s => {
        const tid = `${s.dim}-${s.task}`;
        if (!completedTasks.has(tid)) {
            completedTasks.add(tid);
            totalPoints += s.pts;
        }
    });
    localStorage.setItem('petbank_tasks_completed_today', String(completedTasks.size));
    saveAppState();
    renderAll();
}

// ============ 一级导航映射（首页 Tab 收口，M0.6） ============
// tab 名称 -> 默认落地页（单一事实源，对应 docs/plans/2026-06-29-home-tab-navigation-*）
const HOME_TAB_MAP = { '首页': 'map', '积分': 'today', '学习': 'learn', '宠物': 'pet', '探索': 'explore', '更多': 'works' };
function getHomeTabMap() { return Object.assign({}, HOME_TAB_MAP); }
// 叶子页 / hub 页 -> 所属一级 tab 的 data-page（switchPage 时据此高亮父 tab）
const PAGE_TO_TAB = {
    map: 'map',                                                 // 首页（dashboard）
    today: 'today', review: 'today', reward: 'today',           // 积分（核心任务/复盘/奖励）
    shop: 'today', inventory: 'today',                          // 兑换并入积分
    learn: 'learn', 'learn-pack': 'learn', 'learn-plan': 'learn',   // 学习中心
    'learn-lesson': 'learn', 'learn-print': 'learn',
    playground: 'playground',                                   // 游乐场（hub）
    mathpk: 'playground', hanzi: 'playground',                  // 数学PK/汉字 → 游乐场
    leaderboard: 'playground',                                  // 排行榜 → 游乐场
    pet: 'pet', home: 'pet', card: 'pet', walk: 'pet',          // 宠物
    explore: 'explore',                                         // 探索（含成长地图）
    works: 'playground', tools: 'playground', settings: 'playground' // 作品/工具/设置都继续归游乐场 tab
};

const TOP_HUB_MENU_CONFIG = {
    today: [
        { page: 'today', label: '今日打卡' },
        { page: 'review', label: '每周复盘' },
        { page: 'reward', label: '奖励兑换' },
        { page: 'shop', label: '兑换商店' },
        { page: 'inventory', label: '背包' }
    ],
    pet: [
        { page: 'pet', label: '我的宠物' },
        { page: 'home', label: '宠物小屋' },
        { page: 'card', label: '卡片图鉴' },
        { action: 'walk', label: '遛弯' }
    ],
    playground: [
        { page: 'playground', label: '游乐场首页' },
        { page: 'works', label: '成长作品' },
        { page: 'tools', label: '工具箱' },
        { page: 'settings', label: '设置' }
    ]
};

function getCurrentPageId() {
    const activePage = document.querySelector('.page.active');
    return activePage ? activePage.id.replace('page-', '') : 'map';
}

function closeTopHubMenus() {
    document.querySelectorAll('.nav-hub').forEach((hub) => hub.classList.remove('is-open'));
    const menu = document.getElementById('topHubMenu');
    if (!menu) return;
    menu.hidden = true;
    menu.innerHTML = '';
    menu.style.left = '';
}

function renderTopHubMenu(page) {
    const items = TOP_HUB_MENU_CONFIG[page];
    const menu = document.getElementById('topHubMenu');
    const trigger = document.querySelector(`.nav-hub[data-page="${page}"] .nav-tab`);
    const container = document.querySelector('.top-nav-inner');
    const hub = document.querySelector(`.nav-hub[data-page="${page}"]`);
    if (!items || !menu || !trigger || !container || !hub) return;

    const currentPage = getCurrentPageId();
    menu.innerHTML = items.map((item) => {
        const isCurrent = item.page ? currentPage === item.page : false;
        const handler = item.action
            ? `handleTopHubMenuAction('${item.action}')`
            : `handleTopHubMenuSelect('${item.page}')`;
        return `<button class="nav-tab-menu-item${isCurrent ? ' is-current' : ''}" type="button" onclick="${handler}">${item.label}</button>`;
    }).join('');

    const triggerRect = trigger.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const preferredLeft = triggerRect.left - containerRect.left + triggerRect.width / 2;
    const clampedLeft = Math.min(Math.max(preferredLeft, 132), containerRect.width - 132);

    menu.style.left = `${clampedLeft}px`;
    menu.hidden = false;
    hub.classList.add('is-open');
}

function handlePrimaryNavClick(page) {
    const tab = document.querySelector(`.nav-tab[data-page="${page}"]`);
    const hub = document.querySelector(`.nav-hub[data-page="${page}"]`);
    if (!tab || !hub) {
        closeTopHubMenus();
        switchPage(page);
        return;
    }

    if (!tab.classList.contains('active')) {
        closeTopHubMenus();
        switchPage(page);
        return;
    }

    if (hub.classList.contains('is-open')) {
        closeTopHubMenus();
        return;
    }

    closeTopHubMenus();
    renderTopHubMenu(page);
}

function handleTopHubMenuSelect(page) {
    closeTopHubMenus();
    switchPage(page);
}

function handleTopHubMenuAction(action) {
    closeTopHubMenus();
    if (action === 'walk') {
        openPetWalk();
    }
}

function closeSectionMenus() {
    document.querySelectorAll('.section-menu[open]').forEach((menu) => {
        menu.removeAttribute('open');
    });
}

function openPetWalk() {
    closeSectionMenus();
    switchPage('pet');
    requestAnimationFrame(() => {
        if (window.WalkSystem && typeof WalkSystem.renderUI === 'function') {
            WalkSystem.renderUI('walkArea');
        }
    });
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.section-menu')) closeSectionMenus();
    if (!event.target.closest('.nav-hub') && !event.target.closest('#topHubMenu')) closeTopHubMenus();
});
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        closeSectionMenus();
        closeTopHubMenus();
    }
});

function switchPage(page) {
    closeSectionMenus();
    closeTopHubMenus();
    // 离开宠物小屋：标记 exit（写 last_home_ts，下次进入结算）
    const prevPageEl = document.querySelector('.page.active');
    const prevPage = prevPageEl ? prevPageEl.id.replace('page-', '') : null;
    if (prevPage === 'home' && page !== 'home' && window.PetSystem && typeof PetSystem.markHomeExit === 'function') {
        PetSystem.markHomeExit();
        if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
            window.CloudSync.scheduleSync('home_exit');
        }
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-hub').forEach(h => h.classList.remove('active'));
    // 叶子页（如 today/review/mathpk/shop…）没有独立 tab，按 PAGE_TO_TAB 高亮其父 tab
    const tabPage = (PAGE_TO_TAB[page] || page);
    const tab = document.querySelector(`.nav-tab[data-page="${tabPage}"]`);
    if (tab) {
        tab.classList.add('active');
        const hub = tab.closest('.nav-hub');
        if (hub) hub.classList.add('active');
    }
    // sidebar 只在积分首页(map)显示，其他页面全宽独占 → 每个 tab 都是独立完整页面
    document.body.classList.toggle('no-sidebar', page !== 'map');
    document.body.classList.toggle('learn-mode', page === 'learn' || page.startsWith('learn-'));
    // 切换到特定页面时执行特定渲染
    if (page === 'map' && window.ExplorationSystem && document.getElementById('sceneGridMap')) ExplorationSystem.renderSceneGridMap();
    if (page === 'pet') renderPetPage();
    if (page === 'explore') void renderExplorePage();
    if (page === 'mathpk') MathPKGame.renderUI('math-pk-container');
    if (page === 'hanzi' && window.HanziGame) HanziGame.renderUI('hanzi-container');
    if (page === 'review' && window.FamilyReview && typeof window.FamilyReview.refresh === 'function') void FamilyReview.refresh('family-review-root');
    if (page === 'leaderboard' && window.Leaderboard) {
        switchLeaderboardTab(window._lbCurrentGame || 'mathpk');
        if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh()
                .then(function () {
                    if (window.PKService && typeof window.PKService.refresh === 'function') {
                        return window.PKService.refresh();
                    }
                    return null;
                })
                .then(function () {
                    const leaderboardPage = document.getElementById('page-leaderboard');
                    if (leaderboardPage && leaderboardPage.classList.contains('active')) {
                        switchLeaderboardTab(window._lbCurrentGame || 'mathpk');
                    }
                })
                .catch(function () {});
        }
    }
    if (page === 'learn' && window.LearnCenter) void LearnCenter.renderHub('learn-container');
    if (page === 'learn-pack' && window.LearnCenter) void LearnCenter.renderPack('learn-pack-container');
    if (page === 'learn-plan' && window.LearnCenter) void LearnCenter.renderPlan('learn-plan-container');
    if (page === 'learn-lesson' && window.LearnCenter) void LearnCenter.renderLesson('learn-lesson-container');
    if (page === 'learn-print' && window.LearnCenter) void LearnCenter.renderPrint('learn-print-container');
    if (page === 'today' && window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('today-learning-checkin');
    }
    if (page === 'inventory') renderInventoryPage();
    if (page === 'today') updateRewardPetCard();
    if (page === 'card' && window.CardCollection) CardCollection.renderUI('card-collection-container');
    if (page === 'shop' && window.ShopSystem) ShopSystem.renderUI('shop-ui');
    if (page === 'tools' && window.ToolboxSystem) ToolboxSystem.renderUI('tools-ui');
    if (page === 'home' && window.HomeSystem) HomeSystem.renderUI('home-container');
    if (page === 'settings' && window.SettingsPage) SettingsPage.render();
    if (page === 'settings' && window.AuthSystem && typeof window.AuthSystem.render === 'function') AuthSystem.render('auth-root');
    if (page === 'settings' && window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') void HouseholdSystem.refresh('household-root');
    if (page === 'settings' && window.SocialSystem && typeof window.SocialSystem.refresh === 'function') void SocialSystem.refresh();
    const showDiagnostics = !window.FamilySocialScope
        || typeof window.FamilySocialScope.shouldShowDiagnostics !== 'function'
        || window.FamilySocialScope.shouldShowDiagnostics();
    if (page === 'settings' && showDiagnostics && window.CloudDiagnostics && typeof window.CloudDiagnostics.render === 'function') {
        CloudDiagnostics.render('diagnostics-root');
        if (typeof window.CloudDiagnostics.refresh === 'function') {
            void CloudDiagnostics.refresh('diagnostics-root');
        }
    } else if (page === 'settings') {
        const diagnosticsRoot = document.getElementById('diagnostics-root');
        if (diagnosticsRoot) diagnosticsRoot.innerHTML = '';
    }
    if (page === 'settings' && showDiagnostics && window.MathPKGame && typeof window.MathPKGame.renderDifficultySetting === 'function') {
        MathPKGame.renderDifficultySetting('settings-math-diff');
    } else if (page === 'settings') {
        const settingsMathDiff = document.getElementById('settings-math-diff');
        if (settingsMathDiff) settingsMathDiff.innerHTML = '';
    }
    window.sfx && sfx.click();
}

window.switchPage = switchPage;

// ============ 排行榜玩法 tab 切换（mathpk / hanzi） ============
function switchLeaderboardTab(game) {
    game = game || 'mathpk';
    window._lbCurrentGame = game;
    document.querySelectorAll('.hz-lb-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.game === game);
    });
    if (!window.Leaderboard) return;
    const label = game === 'hanzi' ? '汉字挑战' : '数学 PK';
    Leaderboard.renderUI('leaderboard-container', game, { label: label });
}
window.switchLeaderboardTab = switchLeaderboardTab;

// ============ 宠物页面渲染 ============
    // 当前宠物姿态
    let currentPose = 'idle';

    // 获取宠物图片路径（支持多动作 + banchong宠物）
    function getPetImagePath(speciesId, pose) {
        const species = PetSystem.getAllSpecies();
        const sp = species.find(s => s.id === speciesId);
        if (!sp) return '';
        // PVZ 宠物的动作（idle/happy/attack）用 poses/{pet}_{action}.webp（assets 已有动作图）
        if ((sp.imageStyle === 'pvz' || sp.imageStyle === 'minecraft') && ['idle', 'happy', 'attack'].includes(pose)) {
            return `assets/pets/poses/${speciesId}_${pose}.webp`;
        }
        // 有 imageStages 的宠物（按阶段 key 0-4）
        if (sp.imageStages && sp.imageStages[pose]) {
            return sp.imageStages[pose];
        }
        // banchong 宠物（单图）
        if (sp.imageUrl) {
            return sp.imageUrl;
        }
        return '';
    }

    // 切换宠物动作（点击按钮调用）
    window.setPetPose = function(pose) {
        currentPose = pose;
        updatePetDisplayImg();
        updatePoseBtnActive();
    };

    // 点击宠物图片：循环切换动作
    let poseCycle = ['idle', 'happy', 'attack'];
    window.onPetSpriteClick = function() {
        const pet = PetSystem.getState();
        if (!pet.species) return;
        const idx = poseCycle.indexOf(currentPose);
        currentPose = poseCycle[(idx + 1) % poseCycle.length];
        updatePetDisplayImg();
        updatePoseBtnActive();
        const labels = { idle: '😊 待机', happy: '😄 开心', attack: '⚔️ 攻击' };
        showToast(labels[currentPose]);
    };

    function updatePetDisplayImg() {
        const pet = PetSystem.getState();
        if (!pet.species) return;
        const img = document.getElementById('petDisplayImg');
        if (img) {
            img.classList.remove('dancing');
            void img.offsetWidth; // reflow
            const stageImg = PetSystem.getCurrentStageImage();
            const poseImg = getPetImagePath(pet.species, currentPose);
            // PVZ 宠物切动作（idle/happy/attack）：用动作图；否则用进化阶段图
            const sp = PetSystem.getAllSpecies().find(s => s.id === pet.species);
            const isActionPose = sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'minecraft') && (currentPose === 'happy' || currentPose === 'attack');
            img.src = isActionPose ? poseImg : (stageImg || poseImg);
            img.classList.add('dancing');
        }
    }

    function updatePoseBtnActive() {
        document.querySelectorAll('#petPoseBtns .btn-tiny').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`#petPoseBtns .btn-tiny:nth-child(${poseCycle.indexOf(currentPose) + 1})`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    // Toast 提示
    function showToast(msg) {
        let toast = document.getElementById('petToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'petToast';
            toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.75);color:#fff;padding:8px 20px;border-radius:20px;font-size:14px;z-index:9999;transition:opacity 0.3s;pointer-events:none;';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.style.opacity = '1';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1200);
    }

window.showToast = showToast;

    // 大图灯箱：展示宠物动作/进化阶段
    window.showPetLightbox = function(petName, style) {
        const species = PetSystem.getAllSpecies();
        const sp = species.find(s => s.name === petName);
        
        let poses, labels;
        if (sp && sp.imageStages && style === 'pvz') {
            // PVZ 宠物：3动作
            poses = ['idle', 'happy', 'attack'];
            labels = ['😊 待机', '😄 开心', '⚔️ 攻击'];
        } else if (sp && sp.imageStages) {
            // 非 PVZ 宠物：多进化阶段
            poses = Object.keys(sp.imageStages);
            labels = poses.map(p => `⭐ 阶段 ${p}`);
        } else {
            // 只有一张图
            poses = ['0'];
            labels = [''];
        }
        let overlay = document.getElementById('petLightbox');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'petLightbox';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;';
            overlay.onclick = function(e) { if (e.target === overlay) closeLightbox(); };
            document.body.appendChild(overlay);
        }
        overlay.innerHTML = `
            <div style="background:white;border-radius:16px;padding:24px;max-width:720px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.3);">
                <h2 style="margin:0 0 16px;font-size:18px;">🐾 ${petName} — ${style === 'pvz' ? '动作展示' : '进化阶段'}</h2>
                <div style="display:flex;gap:16px;flex-wrap:wrap;justify-content:center;max-width:800px;">
                    ${poses.map((pose, i) => {
                        let imgSrc;
                        if (sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'minecraft') && ['idle', 'happy', 'attack'].includes(pose)) {
                            imgSrc = `assets/pets/poses/${sp.id}_${pose}.webp`;
                        } else if (sp && sp.imageStages && sp.imageStages[pose]) {
                            imgSrc = sp.imageStages[pose];
                        } else if (sp && sp.imageUrl) {
                            imgSrc = sp.imageUrl;
                        } else {
                            return '';
                        }
                        return `
                        <div style="text-align:center;cursor:pointer;" onclick="selectLightboxPose('${petName}','${pose}')">
                            <img src="${imgSrc}" alt="${labels[i]}"
                                 style="width:180px;height:180px;object-fit:contain;border-radius:12px;border:3px solid #eee;transition:all 0.2s;"
                                 id="lb_${petName}_${pose}">
                            <div style="margin-top:8px;font-size:13px;color:#666;">${labels[i]}</div>
                        </div>`;
                    }).join('')}
                </div>
                <button onclick="closeLightbox()" style="margin-top:20px;padding:8px 24px;border:none;background:var(--sage-green);color:white;border-radius:12px;cursor:pointer;font-size:14px;">✕ 关闭</button>
            </div>`;
        overlay.style.display = 'flex';
    };

    window.selectLightboxPose = function(petName, pose) {
        // PVZ 宠物：切换动作；banchong 宠物：无动作切换
        const species = PetSystem.getAllSpecies();
        const sp = species.find(s => s.name === petName);
        if (sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'minecraft') && ['idle','happy','attack'].includes(pose)) {
            const pet = PetSystem.getState();
            if (pet.species) {
                window.setPetPose(pose);
            }
        }
        // 高亮选中
        document.querySelectorAll(`[id^="lb_${petName}_"]`).forEach(el => {
            el.style.borderColor = el.id === `lb_${petName}_${pose}` ? 'var(--sage-green)' : '#eee';
        });
    };

    window.closeLightbox = function() {
        const overlay = document.getElementById('petLightbox');
        if (overlay) overlay.style.display = 'none';
    };

function renderPetPage() {
    const pet = PetSystem.getState();
    const species = PetSystem.getAllSpecies();

    // 渲染宠物图片（替代emoji）
    const displayImg = document.getElementById('petDisplayImg');
    const poseBtns = document.getElementById('petPoseBtns');
    const nameDisplay = document.getElementById('petNameDisplay');
    const stageDisplay = document.getElementById('petStageDisplay');
    if (pet.species) {
        const sp = species.find(s => s.id === pet.species);
        // 默认按成长阶段(stage)显示(蛋→幼崽→…→终极)；仅 PVZ/minecraft 的 happy/attack 动作才用动作图
        const isPosePet = sp && (sp.imageStyle === 'pvz' || sp.imageStyle === 'minecraft');
        const isEgg = pet.level < 3;
        const isActionPose = isPosePet && (currentPose === 'happy' || currentPose === 'attack');
        const imgSrc = isActionPose ? getPetImagePath(pet.species, currentPose) : (PetSystem.getCurrentStageImage() || getPetImagePath(pet.species, currentPose));
        const area = document.getElementById('petDisplayArea');
        if (displayImg && imgSrc) {
            displayImg.src = imgSrc;
            displayImg.style.display = 'block';
            area?.querySelector('.pet-emoji-fallback')?.remove();
        } else {
            // 无图宠物(课堂宠物等)：显示阶段 emoji 兜底(蛋→幼崽…)
            if (displayImg) displayImg.style.display = 'none';
            if (area) {
                let fb = area.querySelector('.pet-emoji-fallback');
                if (!fb) { fb = document.createElement('div'); fb.className = 'pet-emoji-fallback'; fb.style.cssText = 'font-size:110px;line-height:160px;text-align:center;width:160px;height:160px;'; area.insertBefore(fb, area.firstChild); }
                fb.textContent = PetSystem.getStageEmoji ? PetSystem.getStageEmoji() : (pet.species_data?.emoji || '🐾');
            }
        }
        // 蛋阶段无动作；非蛋 PVZ/minecraft 才显示动作按钮
        if (poseBtns) poseBtns.style.display = (isPosePet && !isEgg) ? 'flex' : 'none';
        nameDisplay.textContent = pet.species_data?.name || '未知';
        stageDisplay.textContent = `${pet.stage.name}阶段 · Lv.${pet.level}`;
    } else {
        if (displayImg) displayImg.style.display = 'none';
        if (poseBtns) poseBtns.style.display = 'none';
        nameDisplay.textContent = '尚未选择';
        stageDisplay.textContent = '请从下方选择一只宠物开始';
    }

    // 渲染 HP / EXP
    const expToNext = pet.level >= PetSystem.MAX_LEVEL ? null : PetSystem.EXP_TABLE[pet.level];
    const hpPercent = pet.total_max_hp > 0 ? (pet.hp / pet.total_max_hp) * 100 : 0;
    const expPercent = expToNext ? (pet.exp / expToNext) * 100 : 100;
    document.getElementById('petHPFill').style.width = hpPercent + '%';
    document.getElementById('petHPText').textContent = `${pet.hp}/${pet.total_max_hp}`;
    document.getElementById('petEXPFill').style.width = expPercent + '%';
    document.getElementById('petEXPText').textContent = expToNext ? `${pet.exp}/${expToNext}` : 'MAX';
    document.getElementById('petLevelDisplay').textContent = `Lv.${pet.level}`;
    document.getElementById('petATKDisplay').textContent = pet.total_atk;
    document.getElementById('petExploreDisplay').textContent = pet.explorations;
    document.getElementById('petSpeciesDisplay').textContent = pet.species_data?.name || '未选择';
    document.getElementById('petDaysDisplay').textContent = `${pet.days_cared} 天`;
    document.getElementById('petWinsDisplay').textContent = `${pet.wins} 场`;
    document.getElementById('petItemsDisplay').textContent = `${InventorySystem.getAllItems().length} 件`;
    document.getElementById('petWeaponDisplay').textContent = pet.weapon?.name || '无';
    document.getElementById('petArmorDisplay').textContent = pet.armor?.name || '无';

    // 渲染地图页的宠物状态
    const mapEmoji = document.getElementById('mapPetEmoji');
    const mapLevel = document.getElementById('mapPetLevel');
    const mapHP = document.getElementById('mapPetHP');
    const mapEXP = document.getElementById('mapPetEXP');
    if (mapEmoji) mapEmoji.textContent = PetSystem.getStageEmoji();
    if (mapLevel) mapLevel.textContent = `Lv.${pet.level}`;
    if (mapHP) mapHP.textContent = `${pet.hp}/${pet.total_max_hp}`;
    if (mapEXP) mapEXP.textContent = expToNext ? `${pet.exp}/${expToNext}` : 'MAX';

    // 渲染种类选择
    renderSpeciesSelection();
}

// ============ 宠物认养弹窗 ============
// 参考 classpet-pro1.0 的弹窗认养 + banchong.cn 的系列标签筛选
let adoptFilter = { source: 'all', series: 'all', rarity: 'all' };

function renderSpeciesSelection() {
    // 预览区：已选宠物或提示
    const preview = document.getElementById('petSpeciesPreview');
    const countEl = document.getElementById('petSpeciesCount');
    const species = PetSystem.getAllSpecies();
    const pet = PetSystem.getState();

    if (countEl) countEl.textContent = `${species.length} 种宠物可选`;

    if (pet.species) {
        const sp = species.find(s => s.id === pet.species);
        if (sp && preview) {
            const r = PetSystem.getRarityConfig()[sp.rarity || 'common'] || PetSystem.getRarityConfig().common;
            const petImgUrl = sp.imageUrl || '';
            const imgHtml = petImgUrl
                ? `<div class="pet-thumb-lg" onclick="showPetLightbox('${sp.name}','${sp.imageStyle || 'banchong'}')"><img src="${petImgUrl}" alt="${sp.name}" loading="lazy" onerror="this.onerror=null;this.parentElement.textContent='${sp.emoji||'🐾'}'"></div>`
                : `<div class="text-6xl">${sp.emoji}</div>`;
            preview.innerHTML = `
                <div class="text-center">
                    ${imgHtml}
                    <div class="font-bold mt-2">${sp.name}</div>
                    <div class="text-xs" style="color: ${r.color};">${r.icon} ${r.name}</div>
                    <div class="text-xs text-muted mt-1">${sp.series || ''}</div>
                    <button class="btn-secondary text-xs mt-3" onclick="openAdoptModal()">🔄 更换宠物</button>
                </div>`;
        }
    } else if (preview) {
        preview.innerHTML = `<div class="text-center text-sm text-muted py-8">点击「认养宠物」选择你的伙伴</div>`;
    }
}

function openAdoptModal() {
    const modal = document.getElementById('adoptModal');
    if (!modal) return;
    modal.classList.add('show');

    const species = PetSystem.getAllSpecies();
    const pet = PetSystem.getState();

    // 更新计数
    const countEl = document.getElementById('adoptModalCount');
    if (countEl) countEl.textContent = `共 ${species.length} 种宠物`;

    // 构建来源 Tab
    const sources = {};
    for (const s of species) {
        const src = s.source || 'original';
        if (!sources[src]) sources[src] = 0;
        sources[src]++;
    }
    const sourceNames = { original: '🌿 PVZ 原版', banchong: '🐹 仓鼠冒险', classpet: '🎨 classpet', minecraft: '⛏️ 我的世界' };
    const sourceEl = document.getElementById('adoptSourceTabs');
    sourceEl.innerHTML = `<div class="adopt-tab adopt-tab-all ${adoptFilter.source === 'all' ? 'active' : ''}" onclick="setAdoptFilter('source','all')">全部 (${species.length})</div>`;
    for (const [src, cnt] of Object.entries(sources)) {
        sourceEl.innerHTML += `<div class="adopt-tab ${adoptFilter.source === src ? 'active' : ''}" onclick="setAdoptFilter('source','${src}')">${sourceNames[src] || src} (${cnt})</div>`;
    }

    // 构建系列 Tab
    const seriesMap = {};
    for (const s of species) {
        if (adoptFilter.source !== 'all' && (s.source || 'original') !== adoptFilter.source) continue;
        const ser = s.series || '经典';
        if (!seriesMap[ser]) seriesMap[ser] = 0;
        seriesMap[ser]++;
    }
    const seriesEl = document.getElementById('adoptSeriesTabs');
    let seriesTotal = Object.values(seriesMap).reduce((a, b) => a + b, 0);
    seriesEl.innerHTML = `<div class="adopt-tab adopt-tab-all ${adoptFilter.series === 'all' ? 'active' : ''}" onclick="setAdoptFilter('series','all')">全部系列 (${seriesTotal})</div>`;
    for (const [name, cnt] of Object.entries(seriesMap)) {
        seriesEl.innerHTML += `<div class="adopt-tab ${adoptFilter.series === name ? 'active' : ''}" onclick="setAdoptFilter('series','${name}')">${name} (${cnt})</div>`;
    }

    // 构建稀有度 Tab
    const rarityEl = document.getElementById('adoptRarityTabs');
    const rarityNames = { common: '⚪ 普通', rare: '🔵 稀有', epic: '🟣 史诗', legendary: '🟡 传说' };
    rarityEl.innerHTML = `<div class="adopt-tab adopt-tab-all ${adoptFilter.rarity === 'all' ? 'active' : ''}" onclick="setAdoptFilter('rarity','all')">全部稀有度</div>`;
    for (const [r, label] of Object.entries(rarityNames)) {
        rarityEl.innerHTML += `<div class="adopt-tab adopt-tab-rarity-${r} ${adoptFilter.rarity === r ? 'active' : ''}" onclick="setAdoptFilter('rarity','${r}')">${label}</div>`;
    }

    // 渲染卡片
    renderAdoptGrid(pet.species);
}

function setAdoptFilter(type, value) {
    adoptFilter[type] = value;
    // 切换来源时重置系列选择
    if (type === 'source') adoptFilter.series = 'all';
    openAdoptModal(); // 重新渲染
}

function renderAdoptGrid(currentSpeciesId) {
    const grid = document.getElementById('adoptGrid');
    const species = PetSystem.getAllSpecies();
    const rarityCfg = PetSystem.getRarityConfig();

    // 筛选
    let filtered = species.filter(s => {
        if (adoptFilter.source !== 'all' && (s.source || 'original') !== adoptFilter.source) return false;
        if (adoptFilter.series !== 'all' && (s.series || '经典') !== adoptFilter.series) return false;
        if (adoptFilter.rarity !== 'all' && (s.rarity || 'common') !== adoptFilter.rarity) return false;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="text-center text-muted py-12 col-span-full">没有匹配的宠物</div>';
        return;
    }

    grid.innerHTML = filtered.map(s => {
        const r = rarityCfg[s.rarity || 'common'] || rarityCfg.common;
        const isSelected = currentSpeciesId === s.id;
        const imgName = s.id === 'goldfish' ? 'fish' : s.id;
        const petImgUrl = s.imageUrl || '';
        // 认养卡片显示蛋形态（stage 0）如果有 imageStages
        const eggImg = (s.imageStages && s.imageStages['0']) ? s.imageStages['0'] : petImgUrl;
        const displayImg = eggImg || petImgUrl;
        const imgHtml = displayImg
            ? `<div class="pet-thumb" onclick="event.stopPropagation(); showPetLightbox('${s.name}','${s.imageStyle || 'banchong'}')"><img src="${displayImg}" alt="${s.name}" loading="lazy" onerror="this.onerror=null;this.parentElement.textContent='${s.emoji||'🐾'}'"></div>`
            : `<div class="emoji">${s.emoji}</div>`;
        return `
        <div class="adopt-card ${isSelected ? 'selected' : ''}" onclick="choosePetFromModal('${s.id}')">
            <div class="rarity-badge rarity-badge-${s.rarity || 'common'}">${r.icon} ${r.name}</div>
            ${imgHtml}
            <div class="name">${s.name}</div>
            <div class="info">${s.series || ''}</div>
            <div class="stats-row">
                <span>❤️${s.base_hp}</span>
                <span>⚔️${s.base_atk}</span>
            </div>
            ${isSelected ? '<div class="text-xs mt-1" style="color: var(--sage-green);">✓ 当前</div>' : ''}
        </div>`;
    }).join('');
}

function choosePetFromModal(speciesId) {
    if (confirm('🥚 领养这颗宠物蛋吗？领养后从蛋开始孵化成长。')) {
        PetSystem.chooseSpecies(speciesId);
        // 领养即入卡池（修复卡牌可达性：领养的宠物也能用于卡牌对战）
        if (window.CardCollection && typeof CardCollection.addCard === 'function') {
            CardCollection.addCard(speciesId);
        }
        if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
            window.CloudSync.scheduleSync('pet_choose_species');
        }
        closeAdoptModal();
        renderPetPage();
    }
}

function closeAdoptModal() {
    const modal = document.getElementById('adoptModal');
    if (modal) modal.classList.remove('show');
}

function choosePetSpecies(speciesId) {
    if (confirm('确定选择这只宠物吗？选择后可以重新选择，但等级会重置。')) {
        PetSystem.chooseSpecies(speciesId);
        if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
            window.CloudSync.scheduleSync('pet_choose_species');
        }
        renderPetPage();
    }
}

// 宠物行动
function feedPet() {
    // 自动用 basic pet food
    const foodCount = InventorySystem.getCount('pet_food_basic');
    if (foodCount > 0) {
        const food = InventorySystem.getItemData('pet_food_basic');
        const result = PetSystem.feed(food);
        alert(result.msg);
    } else {
        // 没有宠物粮就回血
        const result = PetSystem.feed({ effect: { hp: 10 } });
        alert('背包中没有宠物粮，简单恢复 10 HP（探索获得宠物粮可喂食更多）');
    }
    if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
        window.CloudSync.scheduleSync('pet_feed_page');
    }
    renderPetPage();
}
function playWithPet() {
    const result = PetSystem.play();
    alert(result.msg);
    if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
        window.CloudSync.scheduleSync('pet_play_page');
    }
    renderPetPage();
}
function restPet() {
    const result = PetSystem.rest();
    alert(result.msg);
    if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
        window.CloudSync.scheduleSync('pet_rest_page');
    }
    renderPetPage();
}

// 暴露给全局以支持 WalkSystem 刷新
window.refreshPetUI = function() {
    renderPetPage();
};

// ============ 探索页面渲染 ============
function renderScenePreview(scene) {
    const preview = document.getElementById('sceneFocusCard');
    if (!preview) return;
    if (!scene) {
        preview.innerHTML = '<div class="scene-preview-empty">选择一个场景预览</div>';
        return;
    }

    const unlocked = ExplorationSystem.isSceneUnlocked(scene);
    const actionButton = unlocked
        ? `<button class="btn-primary" onclick="ExplorationSystem.goExplore('${scene.id}')">从 ${scene.name} 出发</button>`
        : (scene.unlock_cost || 0) > 0
            ? `<button class="btn-secondary" onclick="ExplorationSystem.tryUnlock('${scene.id}')">解锁 ${scene.name}</button>`
            : `<button class="btn-secondary" onclick="showToast('需要先提升到 Lv.${scene.min_level}')">需要 Lv.${scene.min_level}</button>`;

    preview.innerHTML = `
        <div class="scene-preview-card">
            <div class="scene-preview-image">
                <img src="${scene.image}" alt="${scene.name}" loading="lazy">
                <div class="scene-preview-body">
                    <h3>${scene.emoji} ${scene.name}</h3>
                    <p>${scene.description}</p>
                    <div class="scene-preview-meta">
                        <span>危险 ${scene.danger_level}</span>
                        <span>HP -${scene.hp_cost}</span>
                        <span>${scene.duration}</span>
                        <span>${unlocked ? '已开放' : `Lv.${scene.min_level}`}</span>
                    </div>
                    <div class="scene-preview-action">${actionButton}</div>
                </div>
            </div>
        </div>
    `;
}

function getExploreRescueCardHTML(petState) {
    const petName = petState && petState.species_data && petState.species_data.name
        ? petState.species_data.name
        : '宠物伙伴';

    return `
        <div class="explore-rescue-shell">
            <section class="explore-rescue-card" role="alert" aria-live="polite">
                <div class="explore-rescue-header">
                    <span class="explore-rescue-header-icon" aria-hidden="true">!</span>
                    <div class="explore-rescue-header-copy">
                        <span class="explore-rescue-header-kicker">任务中断</span>
                        <strong>探索紧急提示框</strong>
                    </div>
                </div>
                <div class="explore-rescue-body">
                    <div class="explore-rescue-illustration" aria-hidden="true">
                        <svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="exploreRescueBg" x1="38" y1="24" x2="214" y2="190" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#FFF7D8"/>
                                    <stop offset="1" stop-color="#FFD9B3"/>
                                </linearGradient>
                                <linearGradient id="exploreRescueFloor" x1="78" y1="154" x2="198" y2="188" gradientUnits="userSpaceOnUse">
                                    <stop stop-color="#FFD7C6"/>
                                    <stop offset="1" stop-color="#F8B27D"/>
                                </linearGradient>
                            </defs>
                            <circle cx="130" cy="110" r="92" fill="url(#exploreRescueBg)"/>
                            <circle cx="70" cy="74" r="24" fill="#FFFFFF" fill-opacity="0.85"/>
                            <path d="M70 58l8 12 14 3-10 9 1 14-13-7-13 7 1-14-10-9 14-3 8-12z" fill="#F2B53A"/>
                            <g transform="translate(30 116)">
                                <path d="M18 30 42 10 66 30v28H18V30z" fill="#7AB27B"/>
                                <path d="M12 30 42 4l30 26" stroke="#5A8F61" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
                                <rect x="35" y="34" width="14" height="24" rx="7" fill="#FFF4DA"/>
                                <path d="M42 42c2-4 8-4 10 0-2 5-7 7-10 10-3-3-8-5-10-10 2-4 8-4 10 0z" fill="#F28AA9"/>
                            </g>
                            <ellipse cx="148" cy="176" rx="72" ry="22" fill="url(#exploreRescueFloor)"/>
                            <ellipse cx="148" cy="173" rx="58" ry="16" fill="#FFF3EE"/>
                            <ellipse cx="120" cy="146" rx="38" ry="28" fill="#E8A764" transform="rotate(-12 120 146)"/>
                            <circle cx="163" cy="128" r="28" fill="#EDB36C"/>
                            <path d="M143 113 150 92l14 16" fill="#D08D4E"/>
                            <path d="M176 106 188 90l6 20" fill="#D08D4E"/>
                            <circle cx="153" cy="128" r="4" fill="#5B3E2C"/>
                            <circle cx="171" cy="128" r="4" fill="#5B3E2C"/>
                            <path d="M153 141c6 6 16 6 22 0" stroke="#5B3E2C" stroke-width="4" stroke-linecap="round"/>
                            <rect x="154" y="108" width="20" height="16" rx="5" fill="#FFF7F2" transform="rotate(-10 154 108)"/>
                            <path d="M164 111v10M159 116h10" stroke="#F08D8D" stroke-width="3" stroke-linecap="round"/>
                            <path d="M96 155c16 8 33 10 52 8" stroke="#C68446" stroke-width="8" stroke-linecap="round"/>
                            <circle cx="205" cy="72" r="24" fill="#FFFDF6"/>
                            <circle cx="205" cy="72" r="18" fill="#FF8F7B"/>
                            <path d="M205 61v22M194 72h22" stroke="#FFF9F4" stroke-width="6" stroke-linecap="round"/>
                        </svg>
                    </div>
                    <div class="explore-rescue-copy">
                        <span class="explore-rescue-badge">探索暂停中</span>
                        <h3>宠物倒下了，先去宠物小屋救援</h3>
                        <p>${petName} 现在没有力气继续探索了。先回宠物小屋点击“救援宠物”，恢复后再回来继续冒险。</p>
                        <div class="explore-rescue-status">
                            <span class="explore-rescue-status-label">当前状态</span>
                            <strong>${petName} 需要立即救援</strong>
                            <span>回到宠物小屋完成救援后，这条探索路线会继续保留，不用重新找路。</span>
                        </div>
                        <div class="explore-rescue-note">建议先处理救援，再回来继续主线探索。</div>
                        <div class="explore-rescue-actions">
                            <button class="btn-primary" type="button" onclick="switchPage('home')">去宠物小屋救援</button>
                            <span class="explore-rescue-action-note">当前进度会保留</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    `;
}

function getExploreMapShellHTML() {
    return `
        <section class="explore-hero">
            <div class="explore-hero-copy" style="grid-column:1/-1">
                <p class="map-eyebrow">探索冒险 / 场景路线</p>
                <h2>沿着星光路线，一站站探索冒险</h2>
                <p>点击地图上的场景卡片即可出发。金色星点已开放，灰色尚未解锁，发光路线把场景串成一条旅程。</p>
            </div>
        </section>
        <section class="map-board-shell">
            <div class="map-board-surface">
                <div class="map-board-texture"></div>
                <div id="sceneGrid" class="map-board"><!-- 由 exploration.js 渲染路线地图 --></div>
            </div>
        </section>
    `;
}

function ensureExploreMapShell() {
    const pageExplore = document.getElementById('page-explore');
    if (!pageExplore) return null;

    let grid = pageExplore.querySelector('#sceneGrid');
    if (grid) return grid;

    const activeGalgame = pageExplore.querySelector('.galgame-stage')
        && window.ExplorationDetail
        && typeof ExplorationDetail.isActive === 'function'
        && ExplorationDetail.isActive();
    if (activeGalgame) return null;

    pageExplore.innerHTML = getExploreMapShellHTML();
    return pageExplore.querySelector('#sceneGrid');
}

async function renderExplorePage(selectedSceneId = activeExploreSceneId) {
    const grid = ensureExploreMapShell();
    if (!grid) return;

    // 宠物小屋 R5 渲染层兜底（F1 第二道）：hp<=0 且已选宠 → 探索页不渲染场景网格
    if (window.PetSystem) {
        try {
            const s = PetSystem.getState();
            if (s.species && s.hp <= 0) {
                grid.innerHTML = getExploreRescueCardHTML(s);
                return;
            }
        } catch (e) {}
    }
    await ExplorationSystem.loadScenes();
    // 探索 tab 复用首页路线地图（MAP_LAYOUT 坐标 + SVG 连线 + 点击 goExplore），渲染到 #sceneGrid
    ExplorationSystem.renderSceneGridMap(selectedSceneId, 'sceneGrid');
    if (window.lucide) lucide.createIcons();
}

function focusExploreScene(sceneId) {
    activeExploreSceneId = sceneId;
    void renderExplorePage(sceneId);
}

function startExplorationUI(sceneId) {
    activeExploreSceneId = sceneId;
    void renderExplorePage(sceneId);
}

window.focusExploreScene = focusExploreScene;
window.startExplorationUI = startExplorationUI;
window.renderExplorePage = renderExplorePage;
window.ensureExploreMapShell = ensureExploreMapShell;
function darken(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - percent);
    const g = Math.max(0, ((num >> 8) & 0x00FF) - percent);
    const b = Math.max(0, (num & 0x0000FF) - percent);
    return '#' + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

function exploreScene(sceneId) {
    const result = ExplorationSystem.startExploration(sceneId);
    if (!result.success) {
        showToast(result.msg);
        return;
    }

    // 探索宝箱掉落（30%概率）
    if (window.TreasureChest && Math.random() < 0.3) {
        TreasureChest.addExploreChest();
    }

    if (result.battle) {
        // 开始战斗
        const battle = ExplorationSystem.startBattle(result.battle.scene, result.battle.monster);
        showBattleModal(battle);
    } else {
        showToast(result.msg);
    }
    renderAll();
}

function showBattleModal(battle) {
    battleUILocked = false;   // 新战斗开始，重置 UI 锁（修复上次战斗结束残留导致下次卡死）
    const modal = document.getElementById('battleModal');
    const content = document.getElementById('battleContent');
    modal.classList.add('show');

    const pet = PetSystem.getState();
    const arenaBg = `assets/arena/arena-${battle.chapter || 1}.png`;
    const petImg = (PetSystem.getCurrentStageImage ? PetSystem.getCurrentStageImage() : '') || '';
    const monsterImg = `assets/monsters/${battle.monster.id}.webp`;
    const petName = pet.species_data?.name || '宠物';
    content.innerHTML = `
        <div class="battle-arena">
            <img class="battle-arena-bg" src="${arenaBg}" alt="" onerror="this.style.display='none'">
            <div class="battle-fighters">
                <div class="battle-fighter battle-fighter-left" id="battleFighterPet">
                    <img class="battle-fighter-img" src="${petImg}" alt="${petName}">
                    <div class="battle-fighter-name">${petName} <span>Lv.${pet.level}</span></div>
                </div>
                <div class="battle-vs">⚔️<span>VS</span></div>
                <div class="battle-fighter battle-fighter-right" id="battleFighterMonster">
                    <img class="battle-fighter-img" src="${monsterImg}" alt="${battle.monster.name}" onerror="this.onerror=null;this.style.display='none';this.parentElement.querySelector('.battle-fighter-emoji').style.display=''">
                    <div class="battle-fighter-emoji" style="display:none">${battle.monster.emoji}</div>
                    <div class="battle-fighter-name">${battle.monster.name}</div>
                </div>
            </div>
            <div class="battle-hp-row">
                <div class="hp-bar"><div class="hp-fill" style="width:${(pet.hp / pet.total_max_hp) * 100}%"></div></div>
                <div class="hp-bar"><div class="hp-fill" style="width:${(battle.monster.current_hp / battle.monster.hp) * 100}%"></div></div>
            </div>
            <div class="battle-damage-zone" id="battleDamageZone"></div>
        </div>
        <div class="battle-box">
            <div id="battleActions"></div>
        </div>
    `;
    appendBattleLog(battle);
    renderBattleActions();   // 渲染技能面板 + 道具快捷栏 + 攻击/逃跑
}

// 战斗深化：技能面板 + 道具快捷栏（设计稿 DESIGN-2026-06-29-02）
const BATTLE_ITEM_SLOTS = ['potion_small', 'potion_large', 'pet_food_basic', 'revive_potion'];
let battleUILocked = false;   // 玩家行动后→敌人反击前，按钮禁用（防连点）

function renderBattleActions() {
    const container = document.getElementById('battleActions');
    if (!container) return;

    const pet = PetSystem.getState();
    const skillsData = PetSystem.getSkillsData?.() || { skills: [] };
    const ownedSkills = Array.isArray(pet.skills) ? pet.skills : [];

    // 技能按钮（3 个通用技能）
    const skillBtns = ownedSkills.map(id => {
        const sk = skillsData.skills?.find(s => s.id === id);
        if (!sk) return '';
        const cd = PetSystem.getCooldown ? PetSystem.getCooldown(id) : 0;
        const disabled = battleUILocked || cd > 0;
        const cdTip = cd > 0 ? ` (CD:${cd})` : '';
        const cls = disabled ? 'btn-secondary' : 'btn-primary';
        return `<button class="${cls}" ${disabled ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''} onclick="battleAction({type:'skill',skillId:'${sk.id}'})">${sk.icon} ${sk.name}${cdTip}</button>`;
    }).join('');

    // 道具快捷栏（4 槽）
    const itemSlots = BATTLE_ITEM_SLOTS.map(id => {
        const item = InventorySystem.getItemData(id);
        const count = InventorySystem.getCount(id);
        if (!item) return '';
        const empty = count <= 0;
        const disabled = battleUILocked || empty;
        const emoji = item.emoji || '🎒';
        const name = item.name;
        const cls = disabled ? 'btn-secondary' : 'btn-primary';
        return `<button class="${cls} battle-item-slot" ${disabled ? 'disabled style="opacity:.45;cursor:not-allowed;"' : ''} onclick="useItemInBattle('${id}')" title="${name}">${emoji} ${name} x${count}</button>`;
    }).join('');

    // 普攻 / 逃跑
    const attackDisabled = battleUILocked;
    const fleeDisabled = battleUILocked;

    container.innerHTML = `
        <div class="grid grid-cols-2 gap-2 mb-2" id="battleSkillRow">
            <button class="btn-primary" ${attackDisabled ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''} onclick="battleAction('attack')">⚔️ 攻击</button>
            ${skillBtns}
        </div>
        <div class="text-xs mt-2 mb-1" style="color: var(--text-tertiary);">🎒 道具快捷栏（使用消耗 1 回合）</div>
        <div class="grid grid-cols-2 gap-2 mb-2" id="battleItemRow">${itemSlots}</div>
        <div class="grid grid-cols-1 gap-2" id="battleFleeRow">
            <button class="btn-secondary" ${fleeDisabled ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''} onclick="battleAction('flee')">🏃 逃跑</button>
        </div>
    `;
}

// 锁定/解锁战斗 UI（防连点）
function setBattleUILock(locked) {
    battleUILocked = !!locked;
    renderBattleActions();
}

function appendBattleLog(battle) {
    // 浮动气泡版：只在 arena 顶部冒最新一条，2.2s 消失，不挡按钮
    if (!battle || !battle.log || battle.log.length === 0) return;
    const zone = document.getElementById('battleDamageZone');
    if (!zone) return;
    const last = battle.log[battle.log.length - 1];
    const bubble = document.createElement('div');
    bubble.className = `battle-status-bubble log-${last.type || 'system'}`;
    bubble.textContent = last.text;
    zone.appendChild(bubble);
    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 2200);
}

function getSpeciesDisplayName(speciesId, fallbackName) {
    if (fallbackName) return fallbackName;
    try {
        const allSpecies = (typeof PetSystem?.getAllSpecies === 'function') ? PetSystem.getAllSpecies() : [];
        const matched = allSpecies.find((species) => species.id === speciesId);
        if (matched && matched.name) return matched.name;
    } catch (e) {}
    return speciesId || '未知伙伴';
}

function battleAction(action) {
    // 战斗结束态或 UI 锁定：忽略
    const cur = ExplorationSystem.getCurrentBattle();
    if (!cur || cur.status !== 'ongoing' || battleUILocked) return;

    let result;
    // 行动前锁定 UI（防连点，敌人反击前不可再操作）
    setBattleUILock(true);

    if (action === 'attack') {
        result = ExplorationSystem.battleTurn('attack');
    } else if (action === 'flee') {
        result = ExplorationSystem.battleTurn('flee');
    } else if (action && typeof action === 'object' && action.type === 'skill') {
        // 二次校验：CD 中则解锁返回
        if (typeof PetSystem.canUseSkill === 'function' && !PetSystem.canUseSkill(action.skillId)) {
            setBattleUILock(false);
            showToast('技能冷却中');
            return;
        }
        result = ExplorationSystem.battleTurn({ type: 'skill', skillId: action.skillId });
    } else {
        setBattleUILock(false);
        return;
    }

    if (!result) { setBattleUILock(false); return; }
    appendBattleLog(result);
    // 浮动伤害：取最后一条伤害记录，弹到对应一方上方
    const lastDmg = result.log.slice().reverse().find(l => /造成\s*(\d+)\s*伤害/.test(l.text));
    if (lastDmg) {
        const m = lastDmg.text.match(/造成\s*(\d+)\s*伤害/);
        if (m) showBattleDamage(parseInt(m[1], 10), lastDmg.type === 'enemy' ? 'pet' : 'monster');
    }

    if (result.status === 'won' || result.status === 'lost' || result.status === 'fled') {
        // 战斗胜利有概率掉落卡片
        if (result.status === 'won' && window.CardCollection) {
            const curBattle = (typeof ExplorationSystem.getCurrentBattle === 'function') ? ExplorationSystem.getCurrentBattle() : null;
            const enemySpeciesId = (curBattle && curBattle.monster && curBattle.monster.isSpecies) ? curBattle.monster.speciesId : null;
            if (enemySpeciesId) {
                // species 敌人：首胜 100% 定向掉卡，重复击败降级 10%（防刷卡；见 species 敌人规则 §七）
                const FW_KEY = 'petbank_species_first_win';
                let firstWon = [];
                try { firstWon = JSON.parse(localStorage.getItem(FW_KEY) || '[]'); } catch (e) {}
                const isFirst = !firstWon.includes(enemySpeciesId);
                if (Math.random() < (isFirst ? 1.0 : 0.1)) {
                    const speciesName = getSpeciesDisplayName(enemySpeciesId, curBattle.monster.baseName);
                    const addedNewCard = CardCollection.addCard(enemySpeciesId);
                    if (isFirst) {
                        firstWon.push(enemySpeciesId);
                        localStorage.setItem(FW_KEY, JSON.stringify(firstWon));
                    }
                    if (typeof showToast === 'function') {
                        if (addedNewCard) {
                            showToast(`📘 登记完成：${speciesName} 已加入图鉴馆收藏`);
                        } else if (isFirst) {
                            showToast(`📘 调查完成：${speciesName} 的现场档案已登记，图鉴卡原本就在馆藏中`);
                        } else {
                            showToast(`📘 图鉴复核：${speciesName} 的现场资料又补完了一页`);
                        }
                    }
                }
            } else if (Math.random() < 0.25) {
                // monster：现有 25% 通用随机掉卡（按 rarity 加权）
                const petSpecies = PetSystem.getAllSpecies();
                if (petSpecies.length > 0) {
                    const rw = { common: 50, uncommon: 30, rare: 15, epic: 4, legendary: 1 };
                    const weighted = [];
                    petSpecies.forEach(p => { const pw = rw[p.rarity] || 10; for (let i = 0; i < pw; i++) weighted.push(p); });
                    const picked = weighted[Math.floor(Math.random() * weighted.length)];
                    const addedNewCard = CardCollection.addCard(picked.id);
                    if (typeof showToast === 'function') {
                        showToast(addedNewCard
                            ? `🃏 图鉴补完：意外收录了 ${picked.name}`
                            : `📘 额外线索：${picked.name} 的图鉴卡已经在馆藏中了`);
                    }
                }
            }
        }
        // 显示结算
        const actionsEl = document.getElementById('battleActions');
        actionsEl.innerHTML = `
            <button class="btn-primary" onclick="closeBattleModal()">${result.status === 'won' ? '🎉 继续冒险' : result.status === 'lost' ? '回到宠物页' : '继续'}</button>
        `;
        renderPetPage();
    } else {
        // 战斗继续：解锁 UI（敌人反击已完成）
        setBattleUILock(false);
    }

    // 重新渲染战斗 UI (HP Bar)
    updateBattleUI(result);
}

function updateBattleUI(battle) {
    const pet = PetSystem.getState();
    const modal = document.getElementById('battleModal');
    const hpBars = modal ? modal.querySelectorAll('.hp-bar .hp-fill') : [];
    if (hpBars.length >= 1) {
        hpBars[0].style.width = `${(pet.hp / pet.total_max_hp) * 100}%`;
    }
    if (hpBars.length >= 2) {
        hpBars[1].style.width = `${(battle.monster.current_hp / battle.monster.hp) * 100}%`;
    }

    // 处理动画
    // 监听 exploration.js 发出的事件
    window.removeEventListener('battle-animate', handleBattleAnimate);
    window.addEventListener('battle-animate', handleBattleAnimate, { once: true });
}

// 浮动伤害数字（出招时弹到 battleDamageZone，1.2s 上浮淡出）
function showBattleDamage(dmg, target) {
    const zone = document.getElementById('battleDamageZone');
    if (!zone) return;
    const el = document.createElement('div');
    el.className = 'battle-damage-float battle-damage-' + (target === 'pet' ? 'pet' : 'monster');
    el.textContent = '-' + dmg;
    zone.appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

function handleBattleAnimate(e) {
    const { type } = e.detail;
    const petEl = document.getElementById('battleFighterPet');
    const monsterEl = document.getElementById('battleFighterMonster');
    const modal = document.getElementById('battleModal');

    if (type === 'player-attack') {
        // 玩家攻击 → 怪物受击抖动
        monsterEl?.classList.add('battle-hit');
        setTimeout(() => monsterEl?.classList.remove('battle-hit'), 500);
    } else if (type === 'enemy-attack') {
        // 敌人攻击 → 宠物受击抖动 + 红闪
        petEl?.classList.add('battle-hit');
        setTimeout(() => petEl?.classList.remove('battle-hit'), 500);
        if (modal) {
            modal.classList.add('battle-flash-red');
            setTimeout(() => modal.classList.remove('battle-flash-red'), 500);
        }
    }
}

// 战斗中使用道具（设计稿 §4：接收 id 参数，替代 prompt；使用消耗 1 回合 → 敌人反击）
function useItemInBattle(itemId) {
    const cur = ExplorationSystem.getCurrentBattle();
    if (!cur || cur.status !== 'ongoing' || battleUILocked) return;

    const data = InventorySystem.getItemData(itemId);
    if (!data) { showToast('道具不存在'); return; }
    const count = InventorySystem.getCount(itemId);
    if (count <= 0) { showToast(`${data.name} 数量不足`); return; }

    // 战斗中不允许用复活药水（HP>0 时无意义，且 takeDamage 校验在 useItem 内）
    setBattleUILock(true);

    const result = InventorySystem.useItem(itemId);
    if (!result.success) {
        showToast(result.msg);
        setBattleUILock(false);
        return;
    }

    // 消耗 1 回合：调用 battleTurn 的 item 分支（触发敌人反击 + CD tick）
    const battle = ExplorationSystem.battleTurn({
        type: 'item',
        itemId: itemId,
        itemName: data.name,
        resultMsg: result.msg
    });

    if (!battle) { setBattleUILock(false); return; }
    appendBattleLog(battle);

    if (battle.status === 'won' || battle.status === 'lost' || battle.status === 'fled') {
        const actionsEl = document.getElementById('battleActions');
        actionsEl.innerHTML = `
            <button class="btn-primary" onclick="closeBattleModal()">${battle.status === 'won' ? '🎉 继续冒险' : battle.status === 'lost' ? '回到宠物页' : '继续'}</button>
        `;
        renderPetPage();
    } else {
        setBattleUILock(false);
    }

    updateBattleUI(battle);
    showToast(result.msg);
    renderPetPage();
}

function closeBattleModal() {
    battleUILocked = false;   // 关闭战斗时重置 UI 锁，避免残留导致下次战斗按钮全禁用
    const status = ExplorationSystem.getCurrentBattle && ExplorationSystem.getCurrentBattle()?.status;
    ExplorationSystem.endBattle();
    document.getElementById('battleModal').classList.remove('show');
    // 战斗从 galgame 探索进入：回到场景列表并清理 galgame 状态，
    // 否则 page-explore 仍是 galgame-stage（#sceneGrid 被覆盖 renderAll 渲染不出），
    // 且残留的 encounter 末事件会让点 ▶ 再次 triggerBattle（"又从头打"）。
    if (typeof ExplorationDetail !== 'undefined' && ExplorationDetail.isActive && ExplorationDetail.isActive()) {
        if (status === 'won' && ExplorationDetail.showEnding) {
            ExplorationDetail.showEnding();   // 样板场景：胜利后显示结束叙事，点 ▶ 回列表
        } else {
            if (status === 'won') showToast('🎉 调查完成，图鉴馆已记录这次冒险结果');
            ExplorationDetail.exit();
        }
    } else {
        renderAll();
    }
}

// ============ 背包页面渲染 ============
async function renderInventoryPage() {
    await InventorySystem.loadItemsData();
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;
    const items = InventorySystem.getAllItems();
    if (items.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-12" style="color: var(--text-tertiary);"><div class="text-4xl mb-2">🎒</div><div class="text-sm">背包是空的</div><div class="text-xs mt-1">去探索场景获得道具吧</div></div>';
        return;
    }
    grid.innerHTML = items.map(item => `
        <div class="inv-slot rarity-${item.rarity}" onclick="showItemDetail('${item.item_id}')">
            <div class="item-emoji">${item.emoji}</div>
            ${item.count > 1 ? `<div class="item-count">${item.count}</div>` : ''}
        </div>
    `).join('');
}

function showItemDetail(itemId) {
    const item = InventorySystem.getItemData(itemId);
    if (!item) return;
    const count = InventorySystem.getCount(itemId);
    let actionBtn = '';
    if (item.type === 'consumable') {
        actionBtn = `<button class="btn-primary mt-3 w-full" onclick="useInvItem('${itemId}')">使用 (${count})</button>`;
    } else if (item.type === 'equip') {
        actionBtn = `<button class="btn-primary mt-3 w-full" onclick="equipInvItem('${itemId}')">装备</button>`;
    }
    document.getElementById('itemModalTitle').textContent = `${item.emoji} ${item.name}`;
    document.getElementById('itemModalContent').innerHTML = `
        <div class="text-center mb-3"><div class="text-6xl">${item.emoji}</div></div>
        <div class="text-sm" style="color: var(--text-secondary);">${item.description}</div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><span style="color: var(--text-tertiary);">类型：</span>${item.type === 'consumable' ? '消耗品' : item.type === 'equip' ? '装备' : '材料'}</div>
            <div><span style="color: var(--text-tertiary);">稀有度：</span>${item.rarity}</div>
            <div><span style="color: var(--text-tertiary);">数量：</span>${count}</div>
        </div>
        ${actionBtn}
    `;
    document.getElementById('itemModal').classList.add('show');
}

function useInvItem(itemId) {
    const result = InventorySystem.useItem(itemId);
    alert(result.msg);
    document.getElementById('itemModal').classList.remove('show');
    renderAll();
}

function equipInvItem(itemId) {
    const result = InventorySystem.useItem(itemId);
    alert(result.msg);
    document.getElementById('itemModal').classList.remove('show');
    renderAll();
}

function closeItemModal() {
    document.getElementById('itemModal').classList.remove('show');
}

// ============ 升级动画 ============
function showLevelUpAnimation(level) {
    const pet = PetSystem.getState();
    const species = pet.species_id ? PetSystem.getAllSpecies().find(s => s.id === pet.species_id) : null;
    const petName = species ? species.name : '宠物';
    const stageNames = ['🥚 蛋', '👶 幼崽', '🧒 少年', '💪 成年'];

    const overlay = document.createElement('div');
    overlay.className = 'level-up-overlay';
    overlay.id = 'levelUpOverlay';
    overlay.innerHTML = `
        <div class="level-up-card">
            <div style="font-size:48px;">🎉</div>
            <h2>升级了！</h2>
            <div class="level-badge">Lv.${level}</div>
            <div style="font-size:16px;color:#333;margin-top:8px;">${petName} ${stageNames[Math.min(level, 3)] || stageNames[3]}</div>
            <div class="new-abilities">HP+15 | ATK+2 | ❤️ 回复30</div>
            <button onclick="document.getElementById('levelUpOverlay').remove()" style="margin-top:20px;padding:10px 32px;border:none;border-radius:10px;background:#4CAF50;color:white;font-size:14px;cursor:pointer;font-weight:bold;">太棒了！</button>
        </div>
    `;
    document.body.appendChild(overlay);

    // 撒彩色纸屑
    const colors = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8'];
    for (let i = 0; i < 40; i++) {
        const piece = document.createElement('div');
        piece.className = 'confetti-piece';
        piece.style.left = Math.random() * 100 + 'vw';
        piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
        piece.style.width = (6 + Math.random() * 8) + 'px';
        piece.style.height = (6 + Math.random() * 8) + 'px';
        piece.style.animationDuration = (1.5 + Math.random() * 2) + 's';
        piece.style.animationDelay = Math.random() * 0.5 + 's';
        overlay.appendChild(piece);
    }
}

// 包装 PetSystem.addExp 以触发升级动画
const _origAddExp = PetSystem.addExp.bind(PetSystem);
PetSystem.addExp = function(amount) {
    const oldLevel = PetSystem.getState().level;
    const result = _origAddExp(amount);
    if (result && result.leveled_up) {
        const newLevel = PetSystem.getState().level;
        showLevelUpAnimation(newLevel);
    }
    return result;
};

// ============ 总体渲染 ============
function renderAll() {
    renderTaskGrid();
    renderSidebarTasks();
    updateStats();
    if (window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('today-learning-checkin');
    }
    renderPetPage();
    void renderExplorePage();
    if (window.ExplorationSystem && document.getElementById('sceneGridMap')) ExplorationSystem.renderSceneGridMap();
    renderInventoryPage();
    if (window.ShopSystem) ShopSystem.renderUI('shop-ui');
    if (window.lucide) lucide.createIcons();
}

window.totalPoints = totalPoints;
window.updateStats = updateStats;
window.updateTopPoints = updateTopPoints;
window.addGrowthPoints = addGrowthPoints;
window.spendPoints = spendPoints;
window.deductGrowthPoints = deductGrowthPoints;
window.openPointItemModal = openPointItemModal;
window.closePointItemModal = closePointItemModal;
window.switchPiMode = switchPiMode;
window.filterPointItems = filterPointItems;
window.applyCustomItem = applyCustomItem;
window.updateRewardPetCard = updateRewardPetCard;
window.openPetWalk = openPetWalk;
window.handlePrimaryNavClick = handlePrimaryNavClick;
window.handleTopHubMenuSelect = handleTopHubMenuSelect;
window.handleTopHubMenuAction = handleTopHubMenuAction;
window.renderAll = renderAll;
window.saveAppState = saveAppState;

// ============ 初始化 ============
async function init() {
    if (window.ProfileManager && typeof ProfileManager.ensureDefault === 'function') {
        ProfileManager.ensureDefault();
    }
    if (window.ProfileUI && typeof ProfileUI.render === 'function') {
        ProfileUI.render();
    }
    if (window.AuthSystem && typeof window.AuthSystem.boot === 'function') {
        await AuthSystem.boot();
    }
    if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
        await HouseholdSystem.refresh('household-root');
    }
    if (window.CloudRestore && typeof window.CloudRestore.hydrateFromCloud === 'function') {
        await CloudRestore.hydrateFromCloud().catch(function () {});
    }
    if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
        await SocialSystem.refresh();
    }
    if (window.PKService && typeof window.PKService.refresh === 'function') {
        await PKService.refresh();
    }
    if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
        await ActivityFeedSystem.refresh();
    }
    loadAppState();
    PetSystem.load();
    InventorySystem.load();
    await InventorySystem.loadItemsData();
    await loadPointItems();
    updateRewardPetCard();
    if (window.LearnCenter && typeof LearnCenter.init === 'function') {
        await LearnCenter.init();
    }
    await ExplorationSystem.loadScenes();
    // 战斗深化：预加载技能定义表 data/skills.json
    if (typeof PetSystem.loadSkills === 'function') {
        try { await PetSystem.loadSkills(); } catch (e) { console.warn('skills.json 加载失败:', e); }
    }
    if (window.CardCollection && typeof window.CardCollection.init === 'function') {
        window.CardCollection.init();
        // 新玩家初始送 3 张 common 卡（修复卡牌可达性：保证能凑够 3 只打卡牌，只送一次）
        try {
            if (!localStorage.getItem('petbank_starter_cards') && typeof PetSystem.getAllSpecies === 'function') {
                const commons = PetSystem.getAllSpecies().filter(s => s.rarity === 'common');
                if (commons.length >= 3) {
                    commons.slice().sort(() => Math.random() - 0.5).slice(0, 3)
                        .forEach(c => window.CardCollection.addCard(c.id));
                    localStorage.setItem('petbank_starter_cards', '1');
                }
            }
        } catch (e) {}
    }
    if (window.ToolboxSystem && typeof window.ToolboxSystem.init === 'function') {
        window.ToolboxSystem.init();
    }
    // 宠物小屋 decay 补算（R4：PetSystem 加载后，若 last_home_ts 存在则结算离线衰减）
    // decay() 内部结算后会立即写 last_home_ts=now，保证后续 switchPage('home')→renderUI 再算幂等
    if (typeof PetSystem.decay === 'function' && PetSystem.getState().last_home_ts) {
        PetSystem.decay();
    }
    // 宠物小屋 HomeSystem 初始化（需在 PetSystem 就绪后）
    if (window.HomeSystem && typeof window.HomeSystem.init === 'function') {
        window.HomeSystem.init();
        // 预加载共享家具目录（商店 + 小屋共用同一份 data/furniture.json）
        if (typeof window.HomeSystem.loadCatalog === 'function') {
            try { await window.HomeSystem.loadCatalog(); } catch (e) {}
        }
    }
    renderAll();
    if (window.FamilyReview && typeof window.FamilyReview.render === 'function') {
        window.FamilyReview.render('family-review-root');
    }
    // 初始化宝箱系统
    if (window.TreasureChest) TreasureChest.init();
    // 初始化商店和工具箱
    if (window.ShopSystem) ShopSystem.renderUI('shop-ui');
    if (window.ToolboxSystem) ToolboxSystem.renderUI('tools-ui');
    if (window.lucide) lucide.createIcons();
}

window.addEventListener('DOMContentLoaded', init);
