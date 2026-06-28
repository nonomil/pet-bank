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
    if (page === 'mathpk') MathPKGame.renderUI('math-pk-container');
    if (page === 'inventory') renderInventoryPage();
    if (page === 'card' && window.CardCollection) CardCollection.renderUI('card-collection-container');
}

// ============ 宠物页面渲染 ============
    // 当前宠物姿态
    let currentPose = 'idle';

    // 获取宠物图片路径（支持多动作）
    function getPetImagePath(speciesId, pose) {
        const map = {
            'goldfish': 'fish' // 内部ID与文件名映射
        };
        const imgName = map[speciesId] || speciesId;
        return `assets/pets/poses/${imgName}_${pose || 'idle'}.png`;
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
            img.src = getPetImagePath(pet.species, currentPose);
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

    // 大图灯箱：展示宠物3种动作
    window.showPetLightbox = function(petName) {
        const poses = ['idle', 'happy', 'attack'];
        const labels = ['😊 待机', '😄 开心', '⚔️ 攻击'];
        const nameMap = {dog:'柴犬',cat:'橘猫',rabbit:'兔子',turtle:'乌龟',hamster:'仓鼠',parrot:'鹦鹉',fish:'金鱼',hedgehog:'刺猬'};
        const displayName = nameMap[petName] || petName;
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
                <h2 style="margin:0 0 16px;font-size:18px;">🐾 ${displayName} — 动作展示</h2>
                <div style="display:flex;gap:16px;justify-content:center;flex-wrap:wrap;">
                    ${poses.map((p, i) => `
                        <div style="text-align:center;cursor:pointer;" onclick="selectLightboxPose('${petName}','${p}')">
                            <img src="assets/pets/poses/${petName}_${p}.png" alt="${labels[i]}" 
                                 style="width:180px;height:180px;object-fit:contain;border-radius:12px;border:3px solid #eee;transition:all 0.2s;"
                                 id="lb_${petName}_${p}">
                            <div style="margin-top:8px;font-size:13px;color:#666;">${labels[i]}</div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="closeLightbox()" style="margin-top:20px;padding:8px 24px;border:none;background:var(--sage-green);color:white;border-radius:12px;cursor:pointer;font-size:14px;">✕ 关闭</button>
            </div>`;
        overlay.style.display = 'flex';
    };

    window.selectLightboxPose = function(petName, pose) {
        const pet = PetSystem.getState();
        if (pet.species) {
            const imgName = pet.species === 'goldfish' ? 'fish' : pet.species;
            if (imgName === petName) {
                window.setPetPose(pose);
            }
        }
        // 高亮选中
        ['idle', 'happy', 'attack'].forEach(p => {
            const el = document.getElementById(`lb_${petName}_${p}`);
            if (el) el.style.borderColor = p === pose ? 'var(--sage-green)' : '#eee';
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
        if (displayImg) {
            displayImg.src = getPetImagePath(pet.species, currentPose);
            displayImg.style.display = 'block';
        }
        if (poseBtns) poseBtns.style.display = 'flex';
        nameDisplay.textContent = pet.species_data?.name || '未知';
        stageDisplay.textContent = `${pet.stage.name}阶段 · Lv.${pet.level}`;
    } else {
        if (displayImg) displayImg.style.display = 'none';
        if (poseBtns) poseBtns.style.display = 'none';
        nameDisplay.textContent = '尚未选择';
        stageDisplay.textContent = '请从下方选择一只宠物开始';
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
            const imgName = sp.id === 'goldfish' ? 'fish' : sp.id;
            const hasImage = ['dog','cat','rabbit','turtle','hamster','parrot','fish','hedgehog'].includes(imgName);
            const imgHtml = hasImage
                ? `<div class="pet-thumb-lg" onclick="showPetLightbox('${imgName}')"><img src="assets/pets/poses/${imgName}_idle.png" alt="${sp.name}" loading="lazy"></div>`
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
    const sourceNames = { original: '🐾 经典', banchong: '🐹 仓鼠冒险', classpet: '🎨 classpet' };
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
        const hasImage = ['dog','cat','rabbit','turtle','hamster','parrot','fish','hedgehog'].includes(imgName);
        const imgHtml = hasImage
            ? `<div class="pet-thumb" onclick="event.stopPropagation(); showPetLightbox('${imgName}')"><img src="assets/pets/poses/${imgName}_idle.png" alt="${s.name}" loading="lazy"></div>`
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
    if (confirm('确定选择这只宠物吗？选择后等级会重置。')) {
        PetSystem.chooseSpecies(speciesId);
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

// 暴露给全局以支持 WalkSystem 刷新
window.refreshPetUI = function() {
    renderPetPage();
};

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

    // 探索宝箱掉落（30%概率）
    if (window.TreasureChest && Math.random() < 0.3) {
        TreasureChest.addExploreChest();
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
            <div class="text-5xl" id="battlePetEmoji">PetEmoji</div>
            <div class="text-sm mt-1" style="color: var(--text-tertiary);">${pet.species_data?.name} (Lv.${pet.level})</div>
            <div class="hp-bar mt-2"><div class="hp-fill" style="width: ${(pet.hp / pet.total_max_hp) * 100}%;"></div></div>
            <div class="text-xs">HP: ${pet.hp}/${pet.total_max_hp}</div>
        </div>
        <div class="text-5xl text-center mb-4" id="battleMonsterEmoji">MonsterEmoji</div>
        <div class="text-center mb-4">
            <div class="text-sm mt-1" style="color: var(--text-tertiary);">${battle.monster.name}</div>
            <div class="hp-bar mt-2"><div class="hp-fill" style="width: ${(battle.monster.current_hp / battle.monster.hp) * 100}%;"></div></div>
            <div class="text-xs">HP: ${battle.monster.current_hp}/${battle.monster.hp}</div>
        </div>
        <div class="battle-log mb-4" id="battleLog"></div>
        <div class="battle-actions grid grid-cols-2 gap-2" id="battleActions">
            <button class="btn-primary" onclick="battleAction('attack')">⚔️ 攻击</button>
            <button class="btn-secondary" onclick="battleAction('flee')">🏃 逃跑</button>
            <button class="btn-secondary" onclick="useItemInBattle()">🎒 道具</button>
        </div>
    `;
    // Set initial emojis
    document.getElementById('battlePetEmoji').textContent = PetSystem.getStageEmoji();
    document.getElementById('battleMonsterEmoji').textContent = battle.monster.emoji;
    appendBattleLog(battle);
}

function appendBattleLog(battle) {
    const logEl = document.getElementById('battleLog');
    if (!logEl) return;
    logEl.innerHTML = battle.log.map(l => `<p class="log-${l.type}">${l.text}</p>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
}

function appendBattleLog(battle) {
    const logEl = document.getElementById('battleLog');
    if (!logEl) return;
    logEl.innerHTML = battle.log.map(l => `<p class="log-${l.type}">${l.text}</p>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
}

function battleAction(action) {
    // 这里的 action 可以是 'attack', 'flee', 'skill:smash', 'skill:heal', etc.
    let result;
    const battle = ExplorationSystem.getCurrentBattle();
    
    if (action.startsWith('skill:')) {
        const skillId = action.split(':')[1];
        result = ExplorationSystem.battleTurn('skill', skillId);
    } else if (action === 'attack') {
        result = ExplorationSystem.battleTurn('attack');
    } else if (action === 'flee') {
        result = ExplorationSystem.battleTurn('flee');
    } else {
        return;
    }

    if (!result) return;
    appendBattleLog(result);
    const pet = PetSystem.getState();

    // 触发动画 (如果战斗回合内有动画)
    // 注意：triggerAnimation 在 exploration.js 中通过 CustomEvent 实现

    if (result.status === 'won' || result.status === 'lost' || result.status === 'fled') {
        // 战斗胜利有概率掉落卡片
        if (result.status === 'won' && window.CardCollection && Math.random() < 0.25) {
            const petSpecies = PetSystem.getAllSpecies();
            if (petSpecies.length > 0) {
                const randomPet = petSpecies[Math.floor(Math.random() * petSpecies.length)];
                CardCollection.addCard(randomPet.id);
            }
        }
        // 显示结算
        const actionsEl = document.getElementById('battleActions');
        actionsEl.innerHTML = `
            <button class="btn-primary" onclick="closeBattleModal()">${result.status === 'won' ? '🎉 继续冒险' : result.status === 'lost' ? '回到宠物页' : '继续'}</button>
        `;
        renderPetPage();
    }
    
    // 重新渲染战斗 UI (HP Bar)
    updateBattleUI(result);
}

function updateBattleUI(battle) {
    const pet = PetSystem.getState();
    const hpBars = document.querySelectorAll('.hp-bar .hp-fill');
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

function handleBattleAnimate(e) {
    const { type } = e.detail;
    const petEmoji = document.getElementById('battlePetEmoji');
    const monsterEmoji = document.getElementById('battleMonsterEmoji');
    const modal = document.getElementById('battleModal');

    if (type === 'player-attack') {
        if (petEmoji) {
            petEmoji.classList.add('battle-shake');
            setTimeout(() => petEmoji.classList.remove('battle-shake'), 500);
        }
    } else if (type === 'enemy-attack') {
        if (monsterEmoji) {
            monsterEmoji.classList.add('battle-shake');
            setTimeout(() => monsterEmoji.classList.remove('battle-shake'), 500);
        }
        if (modal) {
            modal.classList.add('battle-flash-red');
            setTimeout(() => modal.classList.remove('battle-flash-red'), 500);
        }
    }
}

function useItemInBattle() {
    // 增强版：弹出道具选择列表
    const items = InventorySystem.getAllItems().filter(i => i.type === 'consumable');
    if (items.length === 0) {
        alert('背包中没有消耗品');
        return;
    }

    // 简单的 prompt 模拟选择，实际应为 UI 弹窗
    // 为了快速实现，我们展示一个简单的提示，实际项目建议用 Modal
    const itemNames = items.map((it, idx) => `${idx}: ${it.name} (${InventorySystem.getCount(it.item_id)})`).join('\n');
    const choice = prompt(`选择道具编号:\n${itemNames}`);
    
    if (choice !== null && items[choice]) {
        const itemId = items[choice].item_id;
        const result = ExplorationSystem.battleTurn('item', null, itemId);
        if (result) {
            appendBattleLog(result);
            updateBattleUI(result);
            if (result.status === 'won' || result.status === 'lost' || result.status === 'fled') {
                battleAction(result.status === 'won' ? 'attack' : 'flee'); // 这里的逻辑可以优化
            }
        }
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
    // 初始化宝箱系统
    if (window.TreasureChest) TreasureChest.init();
    if (window.lucide) lucide.createIcons();
}

window.addEventListener('DOMContentLoaded', init);