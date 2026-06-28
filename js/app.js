/**
 * app.js - 主应用入口，整合所有系统
 * 负责：任务系统、积分系统、页面切换、UI 渲染
 */

// ============ 任务维度数据 ============
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

// ============ 持久化 ============
function saveAppState() {
    localStorage.setItem('petbank_points', totalPoints.toString());
    localStorage.setItem('petbank_completed', JSON.stringify([...completedTasks]));
}
function loadAppState() {
    totalPoints = parseInt(localStorage.getItem('petbank_points') || '0');
    const saved = localStorage.getItem('petbank_completed');
    if (saved) completedTasks = new Set(JSON.parse(saved));
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
    saveAppState();
    renderAll();
}

function switchPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    const tab = document.querySelector(`.nav-tab[data-page="${page}"]`);
    if (tab) tab.classList.add('active');
    // 切换到特定页面时执行特定渲染
    if (page === 'pet') renderPetPage();
    if (page === 'explore') renderExplorePage();
    if (page === 'inventory') renderInventoryPage();
}

// ============ 宠物页面渲染 ============
function renderPetPage() {
    const pet = PetSystem.getState();
    const species = PetSystem.getAllSpecies();

    // 渲染宠物显示
    const display = document.getElementById('petDisplay');
    const nameDisplay = document.getElementById('petNameDisplay');
    const stageDisplay = document.getElementById('petStageDisplay');
    if (pet.species) {
        display.textContent = PetSystem.getStageEmoji();
        nameDisplay.textContent = pet.species_data?.name || '未知';
        stageDisplay.textContent = `${pet.stage.name}阶段 · Lv.${pet.level}`;
        display.classList.add('happy');
    } else {
        display.textContent = '🥚';
        nameDisplay.textContent = '尚未选择';
        stageDisplay.textContent = '请从下方选择一只宠物开始';
        display.classList.remove('happy');
    }

    // 渲染 HP / EXP
    const hpPercent = (pet.hp / pet.total_max_hp) * 100;
    const expPercent = pet.level >= PetSystem.MAX_LEVEL ? 100 : (pet.exp / PetSystem.EXP_TABLE[pet.level]) * 100;
    document.getElementById('petHPFill').style.width = hpPercent + '%';
    document.getElementById('petHPText').textContent = `${pet.hp}/${pet.total_max_hp}`;
    document.getElementById('petEXPFill').style.width = expPercent + '%';
    document.getElementById('petEXPText').textContent = `${pet.exp}/${PetSystem.EXP_TABLE[pet.level]}`;
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
    if (mapEXP) mapEXP.textContent = `${pet.exp}/${PetSystem.EXP_TABLE[pet.level]}`;

    // 渲染种类选择
    renderSpeciesSelection();
}

function renderSpeciesSelection() {
    const grid = document.getElementById('petSpeciesGrid');
    if (!grid) return;
    const species = PetSystem.getAllSpecies();
    const pet = PetSystem.getState();
    grid.innerHTML = species.map(s => `
        <div class="task-card text-center ${pet.species === s.id ? 'done' : ''}" onclick="choosePetSpecies('${s.id}')">
            <div class="text-4xl">${s.emoji}</div>
            <div class="font-bold text-sm mt-1">${s.name}</div>
            <div class="text-xs mt-1" style="color: var(--text-tertiary);">${s.desc}</div>
            <div class="text-xs mt-1">❤️ ${s.base_hp} ⚔️ ${s.base_atk}</div>
            ${pet.species === s.id ? '<div class="text-xs mt-1" style="color: var(--sage-green);">✓ 当前</div>' : ''}
        </div>
    `).join('');
}

function choosePetSpecies(speciesId) {
    if (confirm('确定选择这只宠物吗？选择后可以重新选择，但等级会重置。')) {
        PetSystem.chooseSpecies(speciesId);
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
    renderPetPage();
}
function playWithPet() {
    const result = PetSystem.play();
    alert(result.msg);
    renderPetPage();
}
function restPet() {
    const result = PetSystem.rest();
    alert(result.msg);
    renderPetPage();
}

// ============ 探索页面渲染 ============
async function renderExplorePage() {
    const grid = document.getElementById('sceneGrid');
    if (!grid) return;
    await ExplorationSystem.loadScenes();
    const scenes = ExplorationSystem.getAllScenes();
    const pet = PetSystem.getState();

    grid.innerHTML = scenes.map(scene => {
        const unlocked = ExplorationSystem.isSceneUnlocked(scene);
        return `
            <div class="scene-card ${unlocked ? '' : 'locked'}" style="background: linear-gradient(135deg, ${scene.bg_color}, ${darken(scene.bg_color, 20)});"
                 onclick="${unlocked ? `exploreScene('${scene.id}')` : `alert('需要 Lv.${scene.min_level} 才能探索')`}">
                <div class="scene-emoji">${scene.emoji}</div>
                <div class="scene-name">${scene.name}</div>
                <div class="scene-desc">${scene.description}</div>
                <div class="scene-stats">
                    <span>⚠️ 危险 ${scene.danger_level}</span>
                    <span>❤️ -${scene.hp_cost}</span>
                    <span>⏱️ ${scene.duration}</span>
                </div>
                ${unlocked ? '' : `<div class="absolute top-3 right-3 text-xs bg-black bg-opacity-30 px-2 py-1 rounded">🔒 Lv.${scene.min_level}</div>`}
            </div>
        `;
    }).join('');
}

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
        alert(result.msg);
        return;
    }

    if (result.battle) {
        // 开始战斗
        const battle = ExplorationSystem.startBattle(result.battle.scene, result.battle.monster);
        showBattleModal(battle);
    } else {
        alert(result.msg);
    }
    renderAll();
}

function showBattleModal(battle) {
    const modal = document.getElementById('battleModal');
    const content = document.getElementById('battleContent');
    modal.classList.add('show');

    const pet = PetSystem.getState();
    content.innerHTML = `
        <div class="text-center mb-4">
            <div class="text-5xl">${PetSystem.getStageEmoji()}</div>
            <div class="text-sm mt-1" style="color: var(--text-tertiary);">${pet.species_data?.name} (Lv.${pet.level})</div>
            <div class="hp-bar mt-2"><div class="hp-fill" style="width: ${(pet.hp / pet.total_max_hp) * 100}%;"></div></div>
            <div class="text-xs">HP: ${pet.hp}/${pet.total_max_hp}</div>
        </div>
        <div class="text-5xl text-center mb-4">⚔️</div>
        <div class="text-center mb-4">
            <div class="text-5xl">${battle.monster.emoji}</div>
            <div class="text-sm mt-1" style="color: var(--text-tertiary);">${battle.monster.name}</div>
            <div class="hp-bar mt-2"><div class="hp-fill" style="width: ${(battle.monster.current_hp / battle.monster.hp) * 100}%;"></div></div>
            <div class="text-xs">HP: ${battle.monster.current_hp}/${battle.monster.hp}</div>
        </div>
        <div class="battle-log mb-4" id="battleLog"></div>
        <div class="battle-actions" id="battleActions">
            <button class="btn-primary" onclick="battleAction('attack')">⚔️ 攻击</button>
            <button class="btn-secondary" onclick="battleAction('flee')">🏃 逃跑</button>
            <button class="btn-secondary" onclick="useItemInBattle()">🎒 道具</button>
        </div>
    `;
    appendBattleLog(battle);
}

function appendBattleLog(battle) {
    const logEl = document.getElementById('battleLog');
    if (!logEl) return;
    logEl.innerHTML = battle.log.map(l => `<p class="log-${l.type}">${l.text}</p>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
}

function battleAction(action) {
    const battle = ExplorationSystem.battleTurn(action);
    if (!battle) return;
    appendBattleLog(battle);
    const pet = PetSystem.getState();

    if (battle.status === 'won' || battle.status === 'lost' || battle.status === 'fled') {
        // 显示结算
        const actionsEl = document.getElementById('battleActions');
        actionsEl.innerHTML = `
            <button class="btn-primary" onclick="closeBattleModal()">${battle.status === 'won' ? '🎉 继续冒险' : battle.status === 'lost' ? '回到宠物页' : '继续'}</button>
        `;
        // 更新战斗信息
        const hpBar = document.querySelector('.hp-bar .hp-fill');
        // 重新渲染（用于更新宠物 HP 视觉）
        renderPetPage();
    }
}

function useItemInBattle() {
    // 简化版：直接给一个使用治疗药水的选项
    const potionCount = InventorySystem.getCount('potion_small');
    if (potionCount > 0) {
        const result = InventorySystem.useItem('potion_small');
        alert(result.msg);
        renderPetPage();
        closeBattleModal();
    } else {
        alert('背包中没有治疗药水');
    }
}

function closeBattleModal() {
    ExplorationSystem.endBattle();
    document.getElementById('battleModal').classList.remove('show');
    renderAll();
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

// ============ 总体渲染 ============
function renderAll() {
    renderTaskGrid();
    renderSidebarTasks();
    updateStats();
    renderPetPage();
    renderExplorePage();
    renderInventoryPage();
    if (window.lucide) lucide.createIcons();
}

// ============ 初始化 ============
async function init() {
    loadAppState();
    PetSystem.load();
    InventorySystem.load();
    await InventorySystem.loadItemsData();
    await ExplorationSystem.loadScenes();
    renderAll();
    if (window.lucide) lucide.createIcons();
}

window.addEventListener('DOMContentLoaded', init);