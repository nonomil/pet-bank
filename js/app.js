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

const HOME_PRIORITY_TASKS = [
    { dim: 'learning', task: '阅读 20 分钟', pts: 1, hint: '读完就能继续点开喜欢的栏目。' },
    { dim: 'sports', task: '运动 30 分钟', pts: 1, hint: '活动一下，再去冒险会更有精神。' },
    { dim: 'selfcontrol', task: '屏幕时间不超过 2 小时', pts: 2, hint: '守住今天的小习惯，也算一次成长。' }
];

const POINT_TASK_ART = {
    guide: 'assets/ui/points-exchange/kidstar-guide.webp',
    reading: 'assets/ui/points-exchange/kidstar-reading.webp',
    writing: 'assets/ui/points-exchange/kidstar-writing.webp',
    math: 'assets/ui/points-exchange/kidstar-math.webp',
    sports: 'assets/ui/points-exchange/kidstar-sports.webp',
    clock: 'assets/ui/points-exchange/kidstar-clock.webp',
    tidy: 'assets/ui/points-exchange/kidstar-tidy.webp',
    explore: 'assets/ui/points-exchange/kidstar-explore.webp',
    petcare: 'assets/ui/points-exchange/kidstar-petcare.webp',
    cooking: 'assets/ui/points-exchange/kidstar-cooking.webp'
};

function getPointTaskArt(task) {
    const text = `${task.dim || ''} ${task.dimName || ''} ${task.name || task.task || ''}`;
    if (/数学|算|口算|计算|专项/.test(text)) return POINT_TASK_ART.math;
    if (/练字|日记|写|听写|抄写/.test(text)) return POINT_TASK_ART.writing;
    if (/阅读|背诵|古诗|英语|学习力|新书/.test(text)) return POINT_TASK_ART.reading;
    if (/运动|跳绳|跑步|骑行|球|晨练|户外/.test(text)) return POINT_TASK_ART.sports;
    if (/起床|屏幕|计划|自控|提醒|赖床|时间|按时|独立完成/.test(text)) return POINT_TASK_ART.clock;
    if (/整理|家务|房间|书桌|清理|垃圾|玩具|分类|衣物/.test(text)) return POINT_TASK_ART.tidy;
    if (/做菜|新菜|家常菜|厨房/.test(text)) return POINT_TASK_ART.cooking;
    if (/宠物|喂食|梳毛|抚摸|遛宠物|宠物窝|清理宠物|陪伴玩耍|健康检查|成长日记|守护力/.test(text)) return POINT_TASK_ART.petcare;
    if (/探索|观察|植物|地图|路线|好奇|记录/.test(text)) return POINT_TASK_ART.explore;
    return POINT_TASK_ART.guide;
}

// ============ 应用状态 ============
let totalPoints = 0;
let completedTasks = new Set();
let activeExploreSceneId = null;
let pageActivationToken = 0;
const GROWTH_WORKS_KEY = 'petbank_growth_works';
const DAILY_STATE_KEY = 'petbank_daily_state';
const DAILY_STATE_MIGRATED_KEY = 'petbank_daily_state_migrated';
const DAILY_CHEST_INITIAL_COUNT = 1;

function getLocalDateKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${now.getFullYear()}-${month}-${day}`;
}

function getActiveDailyProfileId() {
    return window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function'
        ? (window.ProfileManager.getActiveId() || 'p_default')
        : 'p_default';
}

function parseDailyState(raw) {
    try {
        const value = raw ? JSON.parse(raw) : null;
        return value && typeof value === 'object' ? value : null;
    } catch (error) {
        return null;
    }
}

function syncLegacyDailyTaskKeys(tasks) {
    const list = [...tasks];
    localStorage.setItem('petbank_completed', JSON.stringify(list));
    localStorage.setItem('petbank_tasks_completed_today', String(list.length));
}

function normalizeDailyChestCount(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0
        ? value
        : DAILY_CHEST_INITIAL_COUNT;
}

function didLegacyDailyChestClaimToday() {
    const claimedDate = localStorage.getItem('petbank_daily_claim_date');
    return claimedDate === getLocalDateKey() || claimedDate === new Date().toLocaleDateString();
}

function getMigratedDailyChestCount(dailyChestClaimed) {
    if (dailyChestClaimed) return 0;
    const inventory = parseDailyState(localStorage.getItem('petbank_chests'));
    const savedCount = inventory && inventory.daily;
    return typeof savedCount === 'number' && Number.isInteger(savedCount) && savedCount >= 0
        ? Math.max(DAILY_CHEST_INITIAL_COUNT, savedCount)
        : DAILY_CHEST_INITIAL_COUNT;
}

function readDailyState() {
    const date = getLocalDateKey();
    const profileId = getActiveDailyProfileId();
    const saved = parseDailyState(localStorage.getItem(DAILY_STATE_KEY));
    if (saved && saved.date === date && saved.profileId === profileId && Array.isArray(saved.completedTasks)) {
        const dailyChestCount = normalizeDailyChestCount(saved.dailyChestCount);
        if (dailyChestCount !== saved.dailyChestCount) {
            localStorage.setItem(DAILY_STATE_KEY, JSON.stringify({ ...saved, dailyChestCount }));
        }
        return {
            completedTasks: new Set(saved.completedTasks),
            dailyChestClaimed: Boolean(saved.dailyChestClaimed),
            dailyChestCount
        };
    }

    let completedTasks = [];
    const dailyChestClaimed = !saved && didLegacyDailyChestClaimToday();
    if (!saved && localStorage.getItem(DAILY_STATE_MIGRATED_KEY) !== '1') {
        const legacy = parseDailyState(localStorage.getItem('petbank_completed'));
        completedTasks = Array.isArray(legacy) ? legacy : [];
        localStorage.setItem(DAILY_STATE_MIGRATED_KEY, '1');
    }
    const dailyChestCount = saved ? DAILY_CHEST_INITIAL_COUNT : getMigratedDailyChestCount(dailyChestClaimed);
    const state = { date, profileId, completedTasks, dailyChestClaimed, dailyChestCount };
    localStorage.setItem(DAILY_STATE_KEY, JSON.stringify(state));
    syncLegacyDailyTaskKeys(completedTasks);
    return { completedTasks: new Set(completedTasks), dailyChestClaimed, dailyChestCount };
}

function writeDailyState(tasks, dailyChestClaimed, dailyChestCount) {
    const completed = [...tasks];
    localStorage.setItem(DAILY_STATE_KEY, JSON.stringify({
        date: getLocalDateKey(),
        profileId: getActiveDailyProfileId(),
        completedTasks: completed,
        dailyChestClaimed: Boolean(dailyChestClaimed),
        dailyChestCount: normalizeDailyChestCount(dailyChestCount)
    }));
    localStorage.setItem(DAILY_STATE_MIGRATED_KEY, '1');
    syncLegacyDailyTaskKeys(completed);
}

window.PetBankDailyState = {
    localDate: getLocalDateKey,
    load: readDailyState,
    save(tasks) {
        const current = readDailyState();
        writeDailyState(tasks, current.dailyChestClaimed, current.dailyChestCount);
    },
    getCompletedCount() {
        return readDailyState().completedTasks.size;
    },
    hasClaimedDaily() {
        return readDailyState().dailyChestClaimed;
    },
    claimDaily() {
        const current = readDailyState();
        writeDailyState(current.completedTasks, true, current.dailyChestCount);
        localStorage.setItem('petbank_daily_claim_date', new Date().toLocaleDateString());
    },
    getDailyChestCount() {
        return readDailyState().dailyChestCount;
    },
    setDailyChestCount(count) {
        const current = readDailyState();
        writeDailyState(current.completedTasks, current.dailyChestClaimed, count);
    }
};

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
    window.PetBankDailyState.save(completedTasks);
}
function loadAppState() {
    totalPoints = parseInt(localStorage.getItem('petbank_points') || '0');
    completedTasks = window.PetBankDailyState.load().completedTasks;
    window.totalPoints = totalPoints;
}

function readGrowthWorks() {
    try {
        const raw = localStorage.getItem(GROWTH_WORKS_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (error) {
        return [];
    }
}

function writeGrowthWorks(list) {
    try {
        localStorage.setItem(GROWTH_WORKS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
    } catch (error) {}
}

function getGrowthWorksForActiveProfile() {
    const activeId = window.ProfileManager && typeof ProfileManager.getActiveId === 'function'
        ? ProfileManager.getActiveId()
        : 'p_default';
    return readGrowthWorks()
        .filter((item) => item && item.profileId === activeId)
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function renderGrowthWorksPage() {
    const listEl = document.getElementById('worksList');
    const countEl = document.getElementById('worksCountText');
    const summaryEl = document.getElementById('worksSummaryText');
    const childEl = document.getElementById('worksActiveChild');
    if (!listEl || !countEl || !summaryEl || !childEl) return;

    const profile = window.ProfileManager && typeof ProfileManager.getActive === 'function'
        ? ProfileManager.getActive()
        : null;
    const childName = profile && profile.name ? profile.name : '默认孩子';
    const works = getGrowthWorksForActiveProfile();

    childEl.textContent = childName;
    countEl.textContent = `${works.length} 条`;
    summaryEl.textContent = works.length
        ? `最近一条记录在 ${new Date(Number(works[0].createdAt || Date.now())).toLocaleDateString()}，继续把孩子今天的小成果留存下来。`
        : '还没有保存作品，先记录一条今天的小成果。';

    if (!works.length) {
        listEl.innerHTML = '<div class="text-xs text-muted py-4">这里会按当前孩子分别保存作品记录，适合积累成长档案和家长复盘素材。</div>';
        return;
    }

    listEl.innerHTML = works.slice(0, 8).map((item) => `
        <article class="review-box" style="padding:12px;">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <div class="text-xs text-muted">${escapePiHtml(item.type || '成长记录')} · ${new Date(Number(item.createdAt || Date.now())).toLocaleDateString()}</div>
                    <div class="font-bold mt-1">${escapePiHtml(item.title || '未命名作品')}</div>
                    <p class="text-xs text-muted mt-2" style="line-height:1.5;">${escapePiHtml(item.story || '还没有补充作品故事。')}</p>
                    ${item.note ? `<div class="text-xs mt-2" style="color:var(--sage-green);font-weight:700;">家长备注：${escapePiHtml(item.note)}</div>` : ''}
                </div>
                <button class="btn-secondary text-xs" type="button" onclick="removeGrowthWork('${escapePiHtml(item.id)}')">删除</button>
            </div>
        </article>
    `).join('');
}

function saveGrowthWork() {
    const titleEl = document.getElementById('worksTitleInput');
    const typeEl = document.getElementById('worksTypeSelect');
    const storyEl = document.getElementById('worksStoryInput');
    const noteEl = document.getElementById('worksNoteInput');
    if (!titleEl || !typeEl || !storyEl || !noteEl) return;

    const title = (titleEl.value || '').trim();
    const story = (storyEl.value || '').trim();
    const note = (noteEl.value || '').trim();
    const type = (typeEl.value || '').trim() || '成长记录';
    if (!title) {
        alert('请先填写作品名称。');
        titleEl.focus();
        return;
    }

    const profile = window.ProfileManager && typeof ProfileManager.getActive === 'function'
        ? ProfileManager.getActive()
        : null;
    const profileId = window.ProfileManager && typeof ProfileManager.getActiveId === 'function'
        ? ProfileManager.getActiveId()
        : 'p_default';
    const list = readGrowthWorks();
    list.unshift({
        id: `work_${Date.now()}`,
        profileId,
        childName: profile && profile.name ? profile.name : '默认孩子',
        title,
        type,
        story,
        note,
        createdAt: Date.now()
    });
    writeGrowthWorks(list);
    titleEl.value = '';
    storyEl.value = '';
    noteEl.value = '';
    typeEl.value = '绘画';
    renderGrowthWorksPage();
    if (window.sfx && typeof window.sfx.play === 'function') window.sfx.play('rewardFanfare');
}

function removeGrowthWork(id) {
    const next = readGrowthWorks().filter((item) => item && item.id !== id);
    writeGrowthWorks(next);
    renderGrowthWorksPage();
}

function getActivePageId() {
    const active = document.querySelector('.page.active');
    return active ? active.id.replace('page-', '') : 'map';
}

// ============ 任务系统 ============
function toggleTask(dim, taskName, pts) {
    completedTasks = window.PetBankDailyState.load().completedTasks;
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
        const art = getPointTaskArt(t);
        return `
            <button class="task-card agnes-task-card ${done ? 'done' : ''}" type="button" onclick="toggleTask('${t.dim}', '${t.name}', ${t.pts})">
                <span class="agnes-task-check">${done ? '<i data-lucide="check" class="w-3 h-3"></i>' : ''}</span>
                <img class="agnes-task-art" src="${art}" alt="${escapePiHtml(t.name)}" loading="lazy" decoding="async">
                <div class="agnes-task-copy">
                    <div class="agnes-task-title">${escapePiHtml(t.name)}</div>
                    <div class="dim-tag mt-1 inline-block">${escapePiHtml(t.dimName)}</div>
                </div>
                <div class="point-capsule agnes-task-points"><span>+${t.pts}</span></div>
            </button>
        `;
    }).join('');
}

function renderGrowthStickerReport() {
    const heatmap = document.getElementById('growthHeatmap');
    const rows = document.getElementById('growthHabitRows');
    const doneEl = document.getElementById('growthReportDone');
    const pointsEl = document.getElementById('growthReportPoints');
    if (!heatmap || !rows) return;

    const totalTaskCount = Object.values(DIMENSIONS).reduce((sum, dim) => sum + dim.tasks.length, 0);
    const doneCount = completedTasks.size;
    if (doneEl) doneEl.textContent = doneCount;
    if (pointsEl) pointsEl.textContent = totalPoints;

    const heatCells = Math.min(36, Math.max(24, totalTaskCount));
    heatmap.innerHTML = Array.from({ length: heatCells }, (_, index) => (
        `<span class="${index < doneCount ? 'is-done' : ''}" aria-hidden="true"></span>`
    )).join('');

    rows.innerHTML = Object.entries(DIMENSIONS).map(([dimKey, dim]) => {
        const doneInDim = dim.tasks.filter(task => completedTasks.has(`${dimKey}-${task.name}`)).length;
        const percent = Math.round((doneInDim / Math.max(1, dim.tasks.length)) * 100);
        const art = getPointTaskArt({ dim: dimKey, dimName: dim.name, name: dim.tasks[0]?.name || dim.name });
        const dots = dim.tasks.map(task => {
            const done = completedTasks.has(`${dimKey}-${task.name}`);
            return `<i class="${done ? 'is-done' : ''}" aria-hidden="true"></i>`;
        }).join('');
        return `
            <article class="growth-habit-row">
                <img src="${art}" alt="${escapePiHtml(dim.name)}" loading="lazy" decoding="async">
                <div class="growth-habit-copy">
                    <div class="growth-habit-top"><strong>${escapePiHtml(dim.name)}</strong><span>${doneInDim}/${dim.tasks.length}</span></div>
                    <div class="growth-habit-dots" style="--growth-progress:${percent}%">${dots}</div>
                </div>
            </article>
        `;
    }).join('');
}

function renderSidebarTasks() {
    const container = document.getElementById('sidebarTasks');
    if (!container) return;
    container.innerHTML = HOME_PRIORITY_TASKS.map(s => {
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

function getHomeFocusTask() {
    return HOME_PRIORITY_TASKS.find((task) => !completedTasks.has(`${task.dim}-${task.task}`)) || HOME_PRIORITY_TASKS[0];
}

function updateMapHomeSummary() {
    const pointsEl = document.getElementById('mapHomePoints');
    if (pointsEl) pointsEl.textContent = totalPoints;

    const childEl = document.getElementById('mapHomeChildName');
    if (childEl) {
        const profile = (window.ProfileManager && typeof ProfileManager.getActive === 'function')
            ? ProfileManager.getActive()
            : null;
        childEl.textContent = (profile && profile.name) ? profile.name : '默认孩子';
    }

    const focusTitle = document.getElementById('mapHomeFocusTitle');
    const focusMeta = document.getElementById('mapHomeFocusMeta');
    const focusTask = getHomeFocusTask();
    const taskId = `${focusTask.dim}-${focusTask.task}`;
    const done = completedTasks.has(taskId);

    if (focusTitle) focusTitle.textContent = focusTask.task;
    if (focusMeta) {
        focusMeta.textContent = done
            ? '这件已经完成，可以继续去宠物、学习或游乐场。'
            : `完成后拿 ${focusTask.pts} 分，${focusTask.hint}`;
    }
}

function updateStats() {
    window.totalPoints = totalPoints;
    const topPoints = document.getElementById('topPoints');
    const accountPoints = document.getElementById('accountPoints');
    if (topPoints) topPoints.textContent = totalPoints;
    if (accountPoints) accountPoints.textContent = totalPoints;
    const mapPoints = document.getElementById('mapPoints');
    if (mapPoints) mapPoints.textContent = totalPoints;
    const agnesTodayPoints = document.getElementById('agnesTodayPoints');
    const rewardExchangePoints = document.getElementById('rewardExchangePoints');
    if (agnesTodayPoints) agnesTodayPoints.textContent = totalPoints;
    if (rewardExchangePoints) rewardExchangePoints.textContent = totalPoints;
    const agnesTodayChild = document.getElementById('agnesTodayChild');
    if (agnesTodayChild) {
        const profile = (window.ProfileManager && typeof ProfileManager.getActive === 'function')
            ? ProfileManager.getActive()
            : null;
        agnesTodayChild.textContent = (profile && profile.name) ? profile.name : '宝贝';
    }
    const petState = (window.PetSystem && typeof PetSystem.getState === 'function') ? PetSystem.getState() : null;
    const mapPetLevel = document.getElementById('mapPetLevel');
    const mapWins = document.getElementById('mapWins');
    if (mapPetLevel) mapPetLevel.textContent = `Lv.${petState?.level || 1}`;
    if (mapWins) mapWins.textContent = petState?.wins || 0;
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
    updateMapHomeSummary();
    updateMapCompanionCard();
    syncRouteShellStatus();
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

function getMathPkStageSummary() {
    const difficultyMap = {
        easy20: '加减起步',
        easy100: '加减进阶',
        medium_mul: '乘法启程',
        medium_mix: '综合闯关',
        hard: '乘除挑战'
    };
    const difficulty = localStorage.getItem('petbank_math_difficulty') || 'easy20';
    let stars = { medium_mul: 0, medium_mix: 0, hard: 0 };
    try {
        const saved = JSON.parse(localStorage.getItem('petbank_math_support_progress') || '{}');
        stars = {
            medium_mul: Number(saved.medium_mul || 0),
            medium_mix: Number(saved.medium_mix || 0),
            hard: Number(saved.hard || 0)
        };
    } catch (_) {}
    const totalStars = stars.medium_mul + stars.medium_mix + stars.hard;
    const bestScore = window.Leaderboard && typeof window.Leaderboard.getBest === 'function'
        ? window.Leaderboard.getBest('mathpk')
        : Number(localStorage.getItem('petbank_math_high_score') || 0);
    return {
        label: difficultyMap[difficulty] || '加减起步',
        bestScore,
        totalStars,
        stageRewards: [
            { threshold: 3, label: '拆一拆支援卡', unlocked: totalStars >= 3 },
            { threshold: 6, label: '宠物入场动作', unlocked: totalStars >= 6 },
            { threshold: 9, label: '机器人图鉴徽章', unlocked: totalStars >= 9 },
            { threshold: 12, label: '阶段完成印章', unlocked: totalStars >= 12 }
        ],
        nextStep: difficulty === 'medium_mul'
            ? '继续把乘法看成“几组几个”，攒够星轨后再去挑战更快的机器人。'
            : difficulty === 'medium_mix'
                ? '下一局试着先保准确，再把连击拉起来。'
                : '想换脑筋时，可以回乘法启程先练理解。'
    };
}

function getArenaStageSummary() {
    let progress = { cleared: [], current: 1 };
    try {
        const saved = JSON.parse(localStorage.getItem('petbank_arena_progress') || '{}');
        progress = {
            cleared: Array.isArray(saved.cleared) ? saved.cleared : [],
            current: Number(saved.current || 1)
        };
    } catch (_) {}
    const clearedCount = progress.cleared.length;
    const nextStage = progress.current;
    return {
        clearedCount,
        nextStage,
        stageRewards: [
            { threshold: 1, label: '训练营首胜', unlocked: clearedCount >= 1 },
            { threshold: 3, label: '稳定通关节奏', unlocked: clearedCount >= 3 },
            { threshold: 5, label: '中段章节开放', unlocked: clearedCount >= 5 },
            { threshold: 8, label: '高阶训练场', unlocked: clearedCount >= 8 }
        ],
        nextStep: clearedCount === 0
            ? '先去自由练习热身，集齐 2 张卡后就能稳定开打。'
            : `轻章节已经打过 ${clearedCount} 关，下一步可以去挑战第 ${nextStage} 关。`
    };
}

function getExploreStageSummary() {
    const pet = window.PetSystem && typeof PetSystem.getState === 'function' ? PetSystem.getState() : null;
    let unlockedScenes = 0;
    try {
        const raw = JSON.parse(localStorage.getItem('petbank_unlocked_scenes') || '{}');
        unlockedScenes = Object.keys(raw).filter((key) => raw[key]).length;
    } catch (_) {}
    const recommendedScene = getRecommendedScene();
    return {
        explorations: Number(pet?.explorations || 0),
        wins: Number(pet?.wins || 0),
        unlockedScenes,
        stageRewards: [
            { threshold: 1, label: '第一次冒险得手', unlocked: Number(pet?.wins || 0) >= 1 },
            { threshold: 3, label: '连续外出路线', unlocked: Number(pet?.explorations || 0) >= 3 },
            { threshold: 5, label: '更多场景开放', unlocked: unlockedScenes >= 5 },
            { threshold: 8, label: '图鉴补完节奏', unlocked: Number(pet?.wins || 0) >= 8 }
        ],
        nextStep: recommendedScene
            ? `下一站推荐去 ${recommendedScene.name}，顺手补图鉴和掉落。`
            : '先去宠物养成页领养伙伴，再回来开启探索路线。'
    };
}

const TYPING_DEFENSE_PROGRESS_KEY = 'petbank_typing_defense_progress';
const WORD_MEMORY_MAP_PROGRESS_KEY = 'petbank_word_memory_map_progress';
const LEARNING_ARCADE_SETTINGS_KEY = 'learning-arcade-settings-v1';
const LEARNING_ARCADE_PROGRESS_KEY = 'petbank_learning_arcade_progress';

function readWordMemoryMapProgress() {
    try {
        const raw = JSON.parse(localStorage.getItem(WORD_MEMORY_MAP_PROGRESS_KEY) || '{}');
        return {
            sessions: Number(raw.sessions || 0),
            totalStars: Number(raw.totalStars || 0),
            totalPoints: Number(raw.totalPoints || 0),
            bestAccuracy: Number(raw.bestAccuracy || 0),
            highestLevel: Number(raw.highestLevel || 0),
            lastLevelOrder: Number(raw.lastLevelOrder || 0),
            lastLevelTitle: raw.lastLevelTitle || '',
            lastHeroId: raw.lastHeroId || 'boy',
            lastWorldPack: raw.lastWorldPack || 'farm_gpt',
            updatedAt: raw.updatedAt || ''
        };
    } catch (_) {
        return {
            sessions: 0,
            totalStars: 0,
            totalPoints: 0,
            bestAccuracy: 0,
            highestLevel: 0,
            lastLevelOrder: 0,
            lastLevelTitle: '',
            lastHeroId: 'boy',
            lastWorldPack: 'farm_gpt',
            updatedAt: ''
        };
    }
}

function writeWordMemoryMapProgress(progress) {
    try {
        localStorage.setItem(WORD_MEMORY_MAP_PROGRESS_KEY, JSON.stringify(progress || {}));
    } catch (_) {}
}

function friendlyWordMemoryHeroLabel(heroId) {
    return ({
        boy: '小男孩',
        golem: '铁傀儡'
    })[heroId] || '冒险主角';
}

function friendlyWordMemoryWorldLabel(worldPack) {
    return ({
        farm: '农场',
        farm_gpt: '农场 GPT',
        forest: '森林',
        grassland: '草原',
        ocean: '海洋',
        sky: '天空',
        space: '太空',
        alien: '外星球'
    })[worldPack] || '地图探索';
}

function getWordMemoryMapStageSummary() {
    const progress = readWordMemoryMapProgress();
    const highestLevelLabel = progress.highestLevel > 0 ? `第 ${progress.highestLevel} 关` : '还没通关';
    const lastStageLabel = progress.lastLevelOrder > 0
        ? `第 ${progress.lastLevelOrder} 关${progress.lastLevelTitle ? ` · ${progress.lastLevelTitle}` : ''}`
        : '先打一张大地图';
    return {
        sessions: progress.sessions,
        totalStars: progress.totalStars,
        totalPoints: progress.totalPoints,
        bestAccuracy: progress.bestAccuracy,
        highestLevelLabel,
        lastStageLabel,
        heroLabel: friendlyWordMemoryHeroLabel(progress.lastHeroId),
        worldLabel: friendlyWordMemoryWorldLabel(progress.lastWorldPack)
    };
}

function recordWordMemoryMapResult(payload) {
    const progress = readWordMemoryMapProgress();
    const points = Math.max(0, Math.floor(Number(payload.score) || 0));
    const stars = Math.max(0, Math.floor(Number(payload.earnedStars) || 0));
    const accuracy = Math.max(0, Math.min(100, Math.floor(Number(payload.accuracy) || 0)));
    const highestLevel = Math.max(0, Math.floor(Number(payload.highestUnlockedLevel) || 0));
    const lastLevelOrder = Math.max(0, Math.floor(Number(payload.levelOrder) || 0));
    const next = {
        sessions: progress.sessions + 1,
        totalStars: progress.totalStars + stars,
        totalPoints: progress.totalPoints + points,
        bestAccuracy: Math.max(progress.bestAccuracy, accuracy),
        highestLevel: Math.max(progress.highestLevel, highestLevel, lastLevelOrder),
        lastLevelOrder,
        lastLevelTitle: payload.levelTitle || '',
        lastHeroId: payload.heroId || progress.lastHeroId || 'boy',
        lastWorldPack: payload.worldPack || progress.lastWorldPack || 'farm_gpt',
        updatedAt: new Date().toISOString()
    };
    writeWordMemoryMapProgress(next);
    pushBattleRecentActivity({
        id: `word_memory_map_${Date.now()}`,
        mode: 'word-memory-map',
        title: `像素探险通关 · ${lastLevelOrder > 0 ? `第 ${lastLevelOrder} 关` : '大地图'}`,
        detail: `同步 ${points} 成长分，点亮 ${stars} 颗星，命中率 ${accuracy}%`
    });
    return next;
}

function renderWordMemoryMapSummaryPanel() {
    const root = document.getElementById('wordMemoryMapSummary');
    if (!root) return;
    const summary = getWordMemoryMapStageSummary();
    root.innerHTML = `
        <div class="typing-defense-summary-grid">
            <article class="typing-defense-summary-card">
                <small>累计通关</small>
                <strong>${summary.sessions} 张图</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>累计星星</small>
                <strong>${summary.totalStars}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>累计成长分</small>
                <strong>${summary.totalPoints}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最佳命中率</small>
                <strong>${summary.bestAccuracy}%</strong>
            </article>
        </div>
        <div class="typing-defense-summary-grid">
            <article class="typing-defense-summary-card">
                <small>最高解锁</small>
                <strong>${summary.highestLevelLabel}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最近通关</small>
                <strong>${summary.lastStageLabel}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最近主角</small>
                <strong>${summary.heroLabel}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最近地图</small>
                <strong>${summary.worldLabel}</strong>
            </article>
        </div>
    `;
}

function readTypingDefenseProgress() {
    try {
        const raw = JSON.parse(localStorage.getItem(TYPING_DEFENSE_PROGRESS_KEY) || '{}');
        return {
            sessions: Number(raw.sessions || 0),
            wins: Number(raw.wins || 0),
            totalStars: Number(raw.totalStars || 0),
            totalPoints: Number(raw.totalPoints || 0),
            bestScore: Number(raw.bestScore || 0),
            bestCombo: Number(raw.bestCombo || 0),
            lastMode: raw.lastMode || 'words',
            modeCounts: raw.modeCounts && typeof raw.modeCounts === 'object' ? raw.modeCounts : {},
            updatedAt: raw.updatedAt || ''
        };
    } catch (_) {
        return {
            sessions: 0,
            wins: 0,
            totalStars: 0,
            totalPoints: 0,
            bestScore: 0,
            bestCombo: 0,
            lastMode: 'words',
            modeCounts: {},
            updatedAt: ''
        };
    }
}

function writeTypingDefenseProgress(progress) {
    try {
        localStorage.setItem(TYPING_DEFENSE_PROGRESS_KEY, JSON.stringify(progress || {}));
    } catch (_) {}
}

function readLearningArcadeSettings() {
    try {
        const raw = JSON.parse(localStorage.getItem(LEARNING_ARCADE_SETTINGS_KEY) || '{}');
        return {
            wordDifficulty: raw.wordDifficulty || 'basic',
            hanziPack: raw.hanziPack || 'kindergarten-hanzi',
            wordPack: raw.wordPack || 'minecraft',
            explicitWordDifficulty: Boolean(raw._explicitWordDifficulty),
            explicitHanziPack: Boolean(raw._explicitHanziPack),
            pinyinStarterSeen: Boolean(raw._pinyinStarterSeen),
            snakeStarterSeen: Boolean(raw._snakeStarterSeen)
        };
    } catch (_) {
        return {
            wordDifficulty: 'basic',
            hanziPack: 'kindergarten-hanzi',
            wordPack: 'minecraft',
            explicitWordDifficulty: false,
            explicitHanziPack: false,
            pinyinStarterSeen: false,
            snakeStarterSeen: false
        };
    }
}

function readLearningArcadeProgress() {
    try {
        const raw = JSON.parse(localStorage.getItem(LEARNING_ARCADE_PROGRESS_KEY) || '{}');
        return {
            launches: Number(raw.launches || 0),
            completedRounds: Number(raw.completedRounds || 0),
            lastGame: raw.lastGame || '',
            lastTitle: raw.lastTitle || '',
            gameCounts: raw.gameCounts && typeof raw.gameCounts === 'object' ? raw.gameCounts : {},
            updatedAt: raw.updatedAt || ''
        };
    } catch (_) {
        return {
            launches: 0,
            completedRounds: 0,
            lastGame: '',
            lastTitle: '',
            gameCounts: {},
            updatedAt: ''
        };
    }
}

function writeLearningArcadeProgress(progress) {
    try {
        localStorage.setItem(LEARNING_ARCADE_PROGRESS_KEY, JSON.stringify(progress || {}));
    } catch (_) {}
}

function friendlyLearningArcadeGameLabel(gameId) {
    return ({
        'word-shooter': '飞机大战',
        'word-cannon': '拼音赛车',
        'pinyin-snake': '贪吃蛇'
    })[gameId] || '学习机小游戏';
}

function friendlyLearningArcadeDifficultyLabel(level) {
    return ({
        basic: '基础',
        intermediate: '进阶',
        full: '完整'
    })[level] || '基础';
}

function friendlyLearningArcadePackLabel(packId) {
    return ({
        'kindergarten-hanzi': '认汉字',
        'kindergarten-pinyin': '拼音启蒙',
        'bridge-hanzi': '幼小衔接',
        'grade1-ready': '一年级预备',
        all: '全部题卡'
    })[packId] || '认汉字';
}

function getLearningArcadeSummary() {
    const settings = readLearningArcadeSettings();
    const progress = readLearningArcadeProgress();
    const starterCount = Number(settings.pinyinStarterSeen) + Number(settings.snakeStarterSeen);
    const introLabel = starterCount >= 2
        ? '已完成首玩引导'
        : starterCount === 1
            ? '已完成一半引导'
            : '建议先从认汉字开始';
    const gameEntries = Object.entries(progress.gameCounts || {})
        .map(([gameId, count]) => ({ gameId, count: Number(count || 0), label: friendlyLearningArcadeGameLabel(gameId) }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    return {
        games: 3,
        difficultyLabel: friendlyLearningArcadeDifficultyLabel(settings.wordDifficulty),
        hanziPackLabel: friendlyLearningArcadePackLabel(settings.hanziPack),
        introLabel,
        launches: progress.launches,
        completedRounds: progress.completedRounds,
        lastGameLabel: friendlyLearningArcadeGameLabel(progress.lastGame),
        lastTitle: progress.lastTitle || '还没打完一局',
        nextStep: progress.launches === 0
            ? '先从飞机大战或拼音赛车开始，建立“按键马上有反馈”的感觉。'
            : progress.completedRounds === 0
                ? '先完整打完一局，再决定孩子更喜欢哪个入口。'
                : progress.lastGame === 'word-cannon'
                    ? '如果今天已经认过字，可以切到贪吃蛇或飞机大战换换手感。'
                    : '继续在三个小游戏之间轮换，保持兴趣比追求高难更重要。',
        chips: [
            { label: '飞机大战', value: '练字母' },
            { label: '拼音赛车', value: settings.explicitHanziPack ? settings.hanziPack === 'kindergarten-pinyin' ? '练拼音' : '认汉字' : '认汉字' },
            { label: '贪吃蛇', value: '方向键' }
        ],
        gameEntries
    };
}

function renderLearningArcadeSummaryPanel() {
    const root = document.getElementById('learningArcadeSummary');
    if (!root) return;
    const summary = getLearningArcadeSummary();
    const chips = summary.chips.map((item) => `
        <span class="typing-defense-mode-chip">${item.label}<strong>${item.value}</strong></span>
    `).join('');
    root.innerHTML = `
        <div class="typing-defense-summary-grid">
            <article class="typing-defense-summary-card">
                <small>收录玩法</small>
                <strong>${summary.games} 个</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>已开局</small>
                <strong>${summary.launches} 次</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>已完成局数</small>
                <strong>${summary.completedRounds} 局</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最近在玩</small>
                <strong>${summary.lastGameLabel}</strong>
            </article>
        </div>
        <div class="typing-defense-summary-grid">
            <article class="typing-defense-summary-card">
                <small>当前难度</small>
                <strong>${summary.difficultyLabel}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>拼音包</small>
                <strong>${summary.hanziPackLabel}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>上手状态</small>
                <strong>${summary.introLabel}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最近结果</small>
                <strong>${summary.lastTitle}</strong>
            </article>
        </div>
        <div class="typing-defense-mode-strip">${chips}</div>
        <div class="typing-defense-mode-strip">${summary.gameEntries.length
            ? summary.gameEntries.map((item) => `<span class="typing-defense-mode-chip">${item.label}<strong>${item.count} 次</strong></span>`).join('')
            : '<span class="typing-defense-mode-chip">还没有游玩记录<strong>先开一局</strong></span>'}</div>
    `;
}

function friendlyTypingDefenseModeLabel(mode) {
    const labels = {
        words: '年级单词',
        pinyin: '拼音',
        letters: '字母',
        mathEasy20: '加减起步',
        mathEasy100: '加减进阶',
        mathMul: '乘法启程',
        numbers: '数字'
    };
    return labels[mode] || '打字训练';
}

function getTypingDefenseStageSummary() {
    const progress = readTypingDefenseProgress();
    const modeCounts = progress.modeCounts || {};
    const modeEntries = Object.entries(modeCounts)
        .map(([mode, count]) => ({ mode, count: Number(count || 0), label: friendlyTypingDefenseModeLabel(mode) }))
        .filter((item) => item.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 4);
    return {
        label: friendlyTypingDefenseModeLabel(progress.lastMode),
        sessions: progress.sessions,
        wins: progress.wins,
        totalStars: progress.totalStars,
        totalPoints: progress.totalPoints,
        bestScore: progress.bestScore,
        bestCombo: progress.bestCombo,
        modeVariety: modeEntries.length,
        modeEntries,
        stageRewards: [
            { threshold: 1, label: '第一次通关', unlocked: progress.wins >= 1 },
            { threshold: 5, label: '星星收集起步', unlocked: progress.totalStars >= 5 },
            { threshold: 3, label: '稳定练习节奏', unlocked: progress.sessions >= 3 },
            { threshold: 300, label: '键盘熟悉感', unlocked: progress.totalPoints >= 300 }
        ],
        nextStep: progress.sessions === 0
            ? '先打一局年级单词，让孩子熟悉键盘输入和瞄准反馈。'
            : progress.wins === 0
                ? '先把一整局打完，比追高分更重要。'
                : progress.bestCombo >= 4
                    ? '下一步可以切到拼音或加减法，开始练模式切换。'
                    : '先把连续命中拉起来，孩子会更容易形成键盘节奏。'
    };
}

function recordTypingDefenseResult(payload) {
    const progress = readTypingDefenseProgress();
    const mode = String(payload.mode || 'words');
    const score = Math.max(0, Math.floor(Number(payload.score) || 0));
    const stars = Math.max(0, Math.floor(Number(payload.earnedStars) || 0));
    const bestCombo = Math.max(0, Math.floor(Number(payload.bestCombo) || 0));
    const wins = payload.won ? 1 : 0;
    const next = {
        sessions: progress.sessions + 1,
        wins: progress.wins + wins,
        totalStars: progress.totalStars + stars,
        totalPoints: progress.totalPoints + score,
        bestScore: Math.max(progress.bestScore, score),
        bestCombo: Math.max(progress.bestCombo, bestCombo),
        lastMode: mode,
        modeCounts: Object.assign({}, progress.modeCounts, {
            [mode]: Number(progress.modeCounts && progress.modeCounts[mode] || 0) + 1
        }),
        updatedAt: new Date().toISOString()
    };
    writeTypingDefenseProgress(next);
    pushBattleRecentActivity({
        id: `typing_defense_${Date.now()}`,
        mode: 'typing-defense',
        title: payload.won
            ? `消灭苦力怕通关 · ${friendlyTypingDefenseModeLabel(mode)}`
            : `消灭苦力怕练习 · ${friendlyTypingDefenseModeLabel(mode)}`,
        detail: `同步 ${score} 成长分，拿到 ${stars} 颗星，最高连击 ${bestCombo}`
    });
    return next;
}

function renderTypingDefenseSummaryPanel() {
    const root = document.getElementById('typingDefenseSummary');
    if (!root) return;
    const summary = getTypingDefenseStageSummary();
    const chips = summary.modeEntries.length
        ? summary.modeEntries.map((item) => `<span class="typing-defense-mode-chip">${item.label}<strong>${item.count} 局</strong></span>`).join('')
        : '<span class="typing-defense-mode-chip">还没有模式记录<strong>先打一局</strong></span>';
    root.innerHTML = `
        <div class="typing-defense-summary-grid">
            <article class="typing-defense-summary-card">
                <small>累计通关</small>
                <strong>${summary.wins} 局</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>累计星星</small>
                <strong>${summary.totalStars}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最佳连击</small>
                <strong>${summary.bestCombo}</strong>
            </article>
            <article class="typing-defense-summary-card">
                <small>最近主练</small>
                <strong>${summary.label}</strong>
            </article>
        </div>
        <div class="typing-defense-mode-strip">${chips}</div>
    `;
}

const BATTLE_MILESTONE_REWARD_KEY = 'petbank_battle_milestone_rewards';
const BATTLE_RECENT_ACTIVITY_KEY = 'petbank_battle_recent_activity';

const BATTLE_MILESTONES = [
    {
        id: 'math_first_star',
        mode: 'mathpk',
        title: '乘法启程小星轨',
        desc: '数学 PK 累计拿到至少 1 颗星轨。',
        rewardText: '+15 成长分',
        isComplete(summary) {
            return Number(summary.math.totalStars || 0) >= 1;
        },
        reward() {
            return { points: 15 };
        }
    },
    {
        id: 'arena_first_clear',
        mode: 'arena',
        title: '训练营首胜',
        desc: '卡牌对战轻章节累计通关至少 1 关。',
        rewardText: '额外对战券 x1',
        isComplete(summary) {
            return Number(summary.arena.clearedCount || 0) >= 1;
        },
        reward() {
            return { itemId: 'arena_ticket', itemCount: 1 };
        }
    },
    {
        id: 'explore_first_win',
        mode: 'explore',
        title: '第一次冒险得手',
        desc: '探索冒险累计拿到至少 1 场胜利。',
        rewardText: '回血药 x1',
        isComplete(summary) {
            return Number(summary.explore.wins || 0) >= 1;
        },
        reward() {
            return { itemId: 'battle_heal_potion', itemCount: 1 };
        }
    },
    {
        id: 'typing_first_win',
        mode: 'typing-defense',
        title: '消灭苦力怕开张',
        desc: '消灭苦力怕累计通关至少 1 局。',
        rewardText: '+15 成长分',
        isComplete(summary) {
            return Number(summary.typingDefense.wins || 0) >= 1;
        },
        reward() {
            return { points: 15 };
        }
    },
    {
        id: 'typing_three_modes',
        mode: 'typing-defense',
        title: '三种训练都碰过',
        desc: '消灭苦力怕至少体验 3 种不同训练模式。',
        rewardText: '+20 成长分',
        isComplete(summary) {
            return Number(summary.typingDefense.modeVariety || 0) >= 3;
        },
        reward() {
            return { points: 20 };
        }
    },
    {
        id: 'triple_route_open',
        mode: 'all',
        title: '三线作战开张',
        desc: '数学 PK、卡牌对战、探索冒险三条线都真正开始推进。',
        rewardText: '+30 成长分',
        isComplete(summary) {
            return Number(summary.math.totalStars || 0) >= 1
                && Number(summary.arena.clearedCount || 0) >= 1
                && Number(summary.explore.explorations || 0) >= 1;
        },
        reward() {
            return { points: 30 };
        }
    }
];

let battleMilestoneRunBaseline = null;

function readBattleMilestoneRewards() {
    try {
        return JSON.parse(localStorage.getItem(BATTLE_MILESTONE_REWARD_KEY) || '{}');
    } catch (_) {
        return {};
    }
}

function writeBattleMilestoneRewards(rewards) {
    try {
        localStorage.setItem(BATTLE_MILESTONE_REWARD_KEY, JSON.stringify(rewards || {}));
    } catch (_) {}
}

function readBattleRecentActivity() {
    try {
        const raw = JSON.parse(localStorage.getItem(BATTLE_RECENT_ACTIVITY_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch (_) {
        return [];
    }
}

function writeBattleRecentActivity(items) {
    try {
        localStorage.setItem(BATTLE_RECENT_ACTIVITY_KEY, JSON.stringify(Array.isArray(items) ? items.slice(0, 8) : []));
    } catch (_) {}
}

function pushBattleRecentActivity(entry) {
    if (!entry || !entry.title) return;
    const next = readBattleRecentActivity();
    next.unshift({
        id: entry.id || `battle_recent_${Date.now()}`,
        mode: entry.mode || 'all',
        title: entry.title,
        detail: entry.detail || '',
        timestamp: entry.timestamp || new Date().toISOString()
    });
    writeBattleRecentActivity(next);
}
window.recordBattleRecentActivity = pushBattleRecentActivity;

function formatBattleRecentTime(isoText) {
    if (!isoText) return '刚刚';
    const delta = Math.max(0, Date.now() - new Date(isoText).getTime());
    const minutes = Math.floor(delta / 60000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
}

function getBattleRecentActivitySummary() {
    const items = readBattleRecentActivity();
    const todayMomentum = getMathPkStageSummary().totalStars
        + getArenaStageSummary().clearedCount
        + getExploreStageSummary().wins
        + getTypingDefenseStageSummary().wins;
    return {
        items,
        todayMomentum
    };
}

function renderBattleRecentActivity(containerId, options) {
    const root = document.getElementById(containerId);
    if (!root) return;
    const compact = options && options.compact === true;
    const heading = (options && options.heading) || '今日战果';
    const summary = getBattleRecentActivitySummary();
    const items = summary.items;
    root.innerHTML = `
        <section class="battle-recent-board${compact ? ' compact' : ''}">
            <div class="battle-recent-head">
                <div>
                    <span class="battle-recent-kicker">${compact ? '最近收获' : '今日战果'}</span>
                    <h4>${heading}</h4>
                    <p>${items.length ? '把刚刚打出来的奖励、通关和推进留下来，孩子回来看时会更像一段真的冒险旅程。' : '打一局、领一次奖励、推进一小步，这里就会开始长出今天的战果。'}</p>
                </div>
                <div class="battle-recent-badge">+${summary.todayMomentum}</div>
            </div>
            <div class="battle-recent-list">
                ${items.length ? items.map((item) => `
                    <article class="battle-recent-item" data-mode="${item.mode}">
                        <div class="battle-recent-item-top">
                            <strong>${item.title}</strong>
                            <span>${formatBattleRecentTime(item.timestamp)}</span>
                        </div>
                        <p>${item.detail}</p>
                    </article>
                `).join('') : `
                    <article class="battle-recent-item empty">
                        <div class="battle-recent-item-top">
                            <strong>还没有新的战果</strong>
                            <span>现在开始</span>
                        </div>
                        <p>先去打一局数学 PK、卡牌训练营或探索遭遇战，这里会自动记录今天真正推进过的东西。</p>
                    </article>
                `}
            </div>
        </section>
    `;
}

function getBattleMilestoneSummary() {
    const summary = {
        math: getMathPkStageSummary(),
        arena: getArenaStageSummary(),
        explore: getExploreStageSummary(),
        typingDefense: getTypingDefenseStageSummary()
    };
    const claimed = readBattleMilestoneRewards();
    const milestones = BATTLE_MILESTONES.map((item) => {
        const completed = !!item.isComplete(summary);
        const claimedEntry = claimed[item.id] || null;
        return {
            id: item.id,
            mode: item.mode,
            title: item.title,
            desc: item.desc,
            rewardText: item.rewardText,
            completed,
            claimed: !!claimedEntry,
            claimable: completed && !claimedEntry
        };
    });
    return {
        summary,
        milestones,
        claimableCount: milestones.filter((item) => item.claimable).length,
        claimedCount: milestones.filter((item) => item.claimed).length
    };
}

function snapshotBattleMilestonesForRun() {
    const pack = getBattleMilestoneSummary();
    battleMilestoneRunBaseline = {
        completedIds: pack.milestones.filter((item) => item.completed).map((item) => item.id),
        claimedIds: pack.milestones.filter((item) => item.claimed).map((item) => item.id)
    };
    return battleMilestoneRunBaseline;
}

function consumeBattleMilestoneUnlocksForRun() {
    const pack = getBattleMilestoneSummary();
    const baseline = battleMilestoneRunBaseline || { completedIds: [], claimedIds: [] };
    battleMilestoneRunBaseline = null;
    return pack.milestones.filter((item) => item.completed && !baseline.completedIds.includes(item.id));
}

function claimBattleMilestoneRewardFromResult(milestoneId) {
    const ok = claimBattleMilestoneReward(milestoneId);
    if (!ok) return false;
    document.querySelectorAll(`[data-battle-unlock-claim="${milestoneId}"]`).forEach((button) => {
        button.disabled = true;
        button.textContent = '已领取';
        button.classList.add('done');
        const chip = button.closest('.battle-unlock-chip');
        if (chip) chip.classList.add('is-claimed');
    });
    document.querySelectorAll('[data-battle-unlock-summary]').forEach((node) => {
        const pending = node.querySelectorAll('.battle-unlock-claim:not(.done)').length;
        const heading = node.querySelector('[data-battle-unlock-title]');
        const note = node.querySelector('[data-battle-unlock-note]');
        if (pending === 0) {
            node.classList.add('is-cleared');
            if (heading) heading.textContent = '本局奖励已领取';
            if (note) note.textContent = '奖励已经放进背包或成长积分里了，可以继续下一场。';
        }
    });
    return ok;
}

function renderBattleMilestoneUnlockSummary(unlocks, options) {
    const list = Array.isArray(unlocks) ? unlocks : [];
    if (!list.length) return '';
    const compact = options && options.compact === true;
    return `
        <div class="battle-unlock-summary${compact ? ' compact' : ''}" data-battle-unlock-summary>
            <strong data-battle-unlock-title>本局新解锁</strong>
            <div class="battle-unlock-list">
                ${list.map((item) => `
                    <span class="battle-unlock-chip">
                        <span>${item.title} · ${item.rewardText}</span>
                        <button class="battle-unlock-claim" data-battle-unlock-claim="${item.id}" type="button" onclick="claimBattleMilestoneRewardFromResult('${item.id}')">立即领取</button>
                    </span>
                `).join('')}
            </div>
            <p data-battle-unlock-note>可以直接领取，也能稍后去游乐场看板或每周复盘查看。</p>
        </div>
    `;
}

function claimBattleMilestoneReward(milestoneId) {
    const rewards = readBattleMilestoneRewards();
    if (rewards[milestoneId]) return false;
    const pack = getBattleMilestoneSummary();
    const milestone = BATTLE_MILESTONES.find((item) => item.id === milestoneId);
    const status = pack.milestones.find((item) => item.id === milestoneId);
    if (!milestone || !status || !status.claimable) return false;

    const reward = milestone.reward() || {};
    if (reward.points) addGrowthPoints(Number(reward.points) || 0);
    if (reward.itemId && window.InventorySystem && typeof window.InventorySystem.addItem === 'function') {
        window.InventorySystem.addItem(reward.itemId, Number(reward.itemCount) || 1);
    }

    rewards[milestoneId] = {
        claimedAt: new Date().toISOString(),
        reward
    };
    writeBattleMilestoneRewards(rewards);
    pushBattleRecentActivity({
        id: `milestone_${milestone.id}_${Date.now()}`,
        mode: milestone.mode,
        title: milestone.title,
        detail: `已领取 ${milestone.rewardText}`
    });
    if (window.sfx && typeof window.sfx.play === 'function') {
        window.sfx.play('rewardClaim');
        window.sfx.play('rewardFanfare');
    }
    if (typeof showToast === 'function') {
        showToast(`已领取：${milestone.title} · ${milestone.rewardText}`);
    }
    renderPlaygroundProgressBoard();
    renderReviewBattleBoard();
    updateStats();
    return true;
}

window.claimBattleMilestoneReward = claimBattleMilestoneReward;
window.claimBattleMilestoneRewardFromResult = claimBattleMilestoneRewardFromResult;

function renderBattleMilestoneStrip(containerId, options) {
    const root = document.getElementById(containerId);
    if (!root) return;
    const compact = options && options.compact === true;
    const pack = getBattleMilestoneSummary();
    const list = pack.milestones;
    root.innerHTML = `
        <div class="battle-milestone-strip${compact ? ' compact' : ''}">
            <div class="battle-milestone-strip-head">
                <div>
                    <span class="battle-milestone-kicker">成长奖励</span>
                    <h4>跨玩法里程碑</h4>
                    <p>把不同玩法接起来后，奖励会变得更像一次真正的冒险旅程。</p>
                </div>
                <div class="battle-milestone-badge">${pack.claimableCount > 0 ? `待领取 ${pack.claimableCount}` : `已领取 ${pack.claimedCount}`}</div>
            </div>
            <div class="battle-milestone-list">
                ${list.map((item) => `
                    <article class="battle-milestone-card ${item.claimable ? 'is-claimable' : ''} ${item.claimed ? 'is-claimed' : ''}" data-mode="${item.mode}">
                        <div class="battle-milestone-card-top">
                            <strong>${item.title}</strong>
                            <span>${item.rewardText}</span>
                        </div>
                        <p>${item.desc}</p>
                        <div class="battle-milestone-card-bottom">
                            <em>${item.claimed ? '已领取' : item.completed ? '已完成' : '进行中'}</em>
                            ${item.claimable
                                ? `<button class="battle-milestone-claim" type="button" onclick="claimBattleMilestoneReward('${item.id}')">领取</button>`
                                : item.claimed
                                    ? `<button class="battle-milestone-claim done" type="button" disabled>已领取</button>`
                                    : `<button class="battle-milestone-claim ghost" type="button" disabled>继续推进</button>`}
                        </div>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
}

function renderPlaygroundProgressBoard() {
    const root = document.getElementById('playgroundProgressBoard');
    if (!root) return;
    const math = getMathPkStageSummary();
    const arena = getArenaStageSummary();
    const typingDefense = getTypingDefenseStageSummary();
    const learningArcade = getLearningArcadeSummary();
    const totalMomentum = math.totalStars + arena.clearedCount + typingDefense.wins + learningArcade.completedRounds;
    const mathBest = window.Leaderboard && typeof window.Leaderboard.getBest === 'function'
        ? window.Leaderboard.getBest('mathpk')
        : math.bestScore;
    const hanziBest = window.Leaderboard && typeof window.Leaderboard.getBest === 'function'
        ? window.Leaderboard.getBest('hanzi')
        : 0;
    const hanziLevel = window.HanziGame && typeof window.HanziGame.getLevel === 'function'
        ? window.HanziGame.getLevel()
        : '1';

    root.innerHTML = `
        <div class="playground-progress-head">
            <div>
                <span>个人记录</span>
                <h3>今天的游乐场成长路线</h3>
                <p>左边只留最关键的记录，排行榜也直接收进这里。</p>
            </div>
            <div class="playground-progress-badge">✨ 当前势头 ${totalMomentum}</div>
        </div>
        <div class="playground-progress-toolbar">
            <button class="playground-progress-link" type="button" onclick="switchPage('leaderboard')">完整排行榜</button>
            <button class="playground-progress-link" type="button" onclick="openCardArenaEntry()">打开卡牌对战</button>
        </div>
        <div class="playground-progress-grid">
            <article class="playground-progress-card" data-mode="mathpk">
                <div class="playground-progress-top">
                    <div>
                        <span class="playground-progress-kicker">数学 PK 排行</span>
                        <h4 class="playground-progress-title">${math.label}</h4>
                    </div>
                </div>
                <div class="playground-progress-metrics">
                    <span><small>最高分</small><strong>${mathBest}</strong></span>
                    <span><small>星轨</small><strong>${math.totalStars}</strong></span>
                </div>
                <div class="playground-progress-next"><strong>下一步</strong>${math.nextStep}</div>
                <button class="playground-progress-action" type="button" onclick="switchPage('mathpk')">继续数学 PK</button>
            </article>
            <article class="playground-progress-card" data-mode="arena">
                <div class="playground-progress-top">
                    <div>
                        <span class="playground-progress-kicker">汉字 PK 排行</span>
                        <h4 class="playground-progress-title">汉字挑战</h4>
                    </div>
                </div>
                <div class="playground-progress-metrics">
                    <span><small>最高分</small><strong>${hanziBest}</strong></span>
                    <span><small>当前等级</small><strong>Lv.${hanziLevel === 'hsk1' ? 'HSK' : hanziLevel}</strong></span>
                </div>
                <div class="playground-progress-next"><strong>下一步</strong>先挑等级开局，成绩会自动记到完整排行榜。</div>
                <button class="playground-progress-action" type="button" onclick="switchPage('hanzi')">继续汉字挑战</button>
            </article>
            <article class="playground-progress-card" data-mode="learning-arcade">
                <div class="playground-progress-top">
                    <div>
                        <span class="playground-progress-kicker">最近常玩</span>
                        <h4 class="playground-progress-title">消灭苦力怕</h4>
                    </div>
                </div>
                <div class="playground-progress-metrics">
                    <span><small>通关局数</small><strong>${typingDefense.wins}</strong></span>
                    <span><small>最佳连击</small><strong>${typingDefense.bestCombo}</strong></span>
                </div>
                <div class="playground-progress-next"><strong>下一步</strong>${typingDefense.nextStep}</div>
                <button class="playground-progress-action" type="button" onclick="switchPage('typing-defense')">打开消灭苦力怕</button>
            </article>
            <article class="playground-progress-card" data-mode="arena">
                <div class="playground-progress-top">
                    <div>
                        <span class="playground-progress-kicker">战果</span>
                        <h4 class="playground-progress-title">训练营进度</h4>
                    </div>
                </div>
                <div class="playground-progress-metrics">
                    <span><small>已通关</small><strong>${arena.clearedCount} 关</strong></span>
                    <span><small>小游戏完成</small><strong>${learningArcade.completedRounds}</strong></span>
                </div>
                <div class="playground-progress-next"><strong>下一步</strong>${arena.nextStep}</div>
                <button class="playground-progress-action" type="button" onclick="openCardArenaEntry()">继续卡牌 PK</button>
            </article>
        </div>
        <div id="playgroundBattleRecent"></div>
    `;
    renderBattleRecentActivity('playgroundBattleRecent', { compact: true, heading: '今日战果' });
}

function renderReviewBattleBoard() {
    const root = document.getElementById('reviewBattleBoard');
    const momentumEl = document.getElementById('reviewBattleMomentum');
    if (!root) return;
    const math = getMathPkStageSummary();
    const arena = getArenaStageSummary();
    const explore = getExploreStageSummary();
    const typingDefense = getTypingDefenseStageSummary();
    const learningArcade = getLearningArcadeSummary();
    const totalMomentum = math.totalStars + arena.clearedCount + explore.wins + typingDefense.wins + learningArcade.completedRounds;
    if (momentumEl) momentumEl.textContent = String(totalMomentum);

    const cards = [
        {
            mode: 'mathpk',
            kicker: '数学 PK',
            title: math.label,
            metrics: [
                { label: '最高分', value: String(math.bestScore) },
                { label: '星轨', value: String(math.totalStars) }
            ],
            growth: math.totalStars > 0
                ? '已经开始把“会做题”推进到“能连续答对”。'
                : '现在最重要的是先建立理解，不急着全程比速度。',
            next: math.nextStep,
            action: `<button class="review-battle-action" type="button" onclick="switchPage('mathpk')">继续数学 PK</button>`
        },
        {
            mode: 'arena',
            kicker: '卡牌对战',
            title: '训练营进度',
            metrics: [
                { label: '已通关', value: `${arena.clearedCount} 关` },
                { label: '下一关', value: String(arena.nextStage) }
            ],
            growth: arena.clearedCount > 0
                ? '已经把组队、出招和结算接成了完整的一局。'
                : '先多打几局自由练习，把操作顺序和技能节奏玩熟。',
            next: arena.nextStep,
            action: `<button class="review-battle-action" type="button" onclick="openCardArenaEntry()">继续卡牌 PK</button>`
        },
        {
            mode: 'explore',
            kicker: '探索冒险',
            title: '伙伴外出记录',
            metrics: [
                { label: '探索次数', value: String(explore.explorations) },
                { label: '胜场', value: String(explore.wins) }
            ],
            growth: explore.explorations > 0
                ? '已经把战斗放回场景和故事里，不只是单独打一局。'
                : '先出去走一趟，让路线、掉落和战斗真正连起来。',
            next: explore.nextStep,
            action: `<button class="review-battle-action" type="button" onclick="switchPage('explore')">继续探索</button>`
        },
        {
            mode: 'typing-defense',
            kicker: '消灭苦力怕',
            title: typingDefense.label,
            metrics: [
                { label: '通关局数', value: String(typingDefense.wins) },
                { label: '最佳连击', value: String(typingDefense.bestCombo) }
            ],
            growth: typingDefense.sessions > 0
                ? '已经把键盘输入、视觉定位和即时反馈连成同一件事。'
                : '先打一局，让孩子先对“打字会触发结果”建立直接感受。',
            next: typingDefense.nextStep,
            action: `<button class="review-battle-action" type="button" onclick="switchPage('typing-defense')">继续消灭苦力怕</button>`
        },
        {
            mode: 'learning-arcade',
            kicker: '学习机小游戏',
            title: learningArcade.lastGameLabel,
            metrics: [
                { label: '已开局', value: `${learningArcade.launches} 次` },
                { label: '完成局数', value: String(learningArcade.completedRounds) }
            ],
            growth: learningArcade.launches > 0
                ? '已经开始把字母、拼音和方向键练习装进同一个合集里轮换。'
                : '先点进去玩一局，看看孩子更容易被哪个入口吸引住。',
            next: learningArcade.nextStep,
            action: `<button class="review-battle-action" type="button" onclick="switchPage('learning-arcade')">继续小游戏合集</button>`
        }
    ];

    root.innerHTML = `
        <div class="review-battle-grid">
            ${cards.map((card) => `
                <article class="review-battle-card" data-mode="${card.mode}">
                    <div class="review-battle-top">
                        <div>
                            <span class="review-battle-kicker">${card.kicker}</span>
                            <h3 class="review-battle-title">${card.title}</h3>
                        </div>
                    </div>
                    <div class="review-battle-metrics">
                        ${card.metrics.map((metric) => `
                            <span><small>${metric.label}</small><strong>${metric.value}</strong></span>
                        `).join('')}
                    </div>
                    <div class="review-battle-copy">
                        <p><strong>这周看到的进步</strong>${card.growth}</p>
                        <p><strong>下一步</strong>${card.next}</p>
                    </div>
                    ${card.action}
                </article>
            `).join('')}
        </div>
        <div id="reviewBattleRecent"></div>
        <div id="reviewBattleMilestones"></div>
    `;
    renderBattleRecentActivity('reviewBattleRecent', { compact: true, heading: '最近收获' });
    renderBattleMilestoneStrip('reviewBattleMilestones', { compact: false });
}

function updateMapCompanionCard() {
    const companionImg = document.getElementById('mapCompanionImg');
    const companionName = document.getElementById('mapCompanionName');
    const companionStage = document.getElementById('mapCompanionStage');
    const companionStory = document.getElementById('mapCompanionStory');
    const companionMood = document.getElementById('mapCompanionMood');
    const companionRoute = document.getElementById('mapCompanionRoute');
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
        if (companionStory) {
            companionStory.textContent = `${petName} 正在等你，做完一件任务就能继续一起出发。`;
        }
        if (companionMood) {
            companionMood.textContent = pet.hp > Math.max(20, Math.round((pet.total_max_hp || 0) * 0.5))
                ? '今天很适合轻松出发'
                : '先补状态再去冒险';
        }
    } else {
        companionName.textContent = '还没有领养宠物';
        companionStage.textContent = '去宠物养成页挑一位伙伴一起冒险';
        if (companionStory) {
            companionStory.textContent = '先去领养一位伙伴，首页就会变成真正的同行入口。';
        }
        if (companionMood) {
            companionMood.textContent = '先领养再开启冒险';
        }
    }

    const recommendedScene = getRecommendedScene();
    if (recommendedScene) {
        const unlocked = ExplorationSystem.isSceneUnlocked(recommendedScene);
        nextSceneHint.textContent = unlocked
            ? `下一站：${recommendedScene.emoji} ${recommendedScene.name}`
            : `Lv.${recommendedScene.min_level} 解锁 ${recommendedScene.name}`;
        if (companionRoute) {
            companionRoute.textContent = unlocked
                ? `已解锁 ${recommendedScene.name}`
                : `晨读后朝 ${recommendedScene.name} 前进`;
        }
    } else {
        nextSceneHint.textContent = '下一站会显示在这里';
        if (companionRoute) {
            companionRoute.textContent = '晨读后解锁路线';
        }
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

function redeemFamilyReward(points, name) {
    const cost = Math.max(1, Math.floor(Number(points) || 0));
    if (!spendPoints(cost)) return false;
    const message = `兑换成功：${name || '家庭小奖励'}，花费 ${cost} 成长分`;
    if (typeof showToast === 'function') showToast(message);
    else alert(message);
    renderAll();
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
        const resp = await fetch(window.resolvePetBankAssetUrl ? window.resolvePetBankAssetUrl('data/point-items.json') : 'data/point-items.json');
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
    HOME_PRIORITY_TASKS.forEach(s => {
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
const HOME_TAB_MAP = { '首页': 'map', '积分': 'today', '学习': 'learn', '宠物': 'pet', '探索': 'explore', '游乐场': 'playground', '家长区': 'parent' };
function getHomeTabMap() { return Object.assign({}, HOME_TAB_MAP); }
// 叶子页 / hub 页 -> 所属一级 tab 的 data-page（switchPage 时据此高亮父 tab）
const PAGE_TO_TAB = {
    map: 'map',                                                 // 首页（dashboard）
    today: 'today', 'learning-sheet': 'today', review: 'today', reward: 'today',           // 积分（核心任务/学习单/复盘/奖励）
    shop: 'today', inventory: 'today',                          // 兑换并入积分
    learn: 'learn', 'learn-pack': 'learn', 'learn-plan': 'learn',   // 学习中心
    'learn-lesson': 'learn', 'learn-print': 'learn',
    playground: 'playground',                                   // 游乐场（hub）
    mathpk: 'playground', hanzi: 'playground',                  // 数学PK/汉字 → 游乐场
    'typing-defense': 'playground',
    'learning-arcade': 'playground',
    'word-memory-map': 'playground',
    leaderboard: 'playground',                                  // 排行榜 → 游乐场
    pet: 'pet', home: 'pet', 'home-visit': 'pet', card: 'pet', walk: 'pet',          // 宠物
    explore: 'explore',                                         // 探索（含成长地图）
    parent: 'parent',
    works: 'parent', tools: 'parent', settings: 'parent'         // 低频作品/工具/设置归右上角家长区入口
};

const CLASSIC_APP_PAGES = new Set([
    'map',
    'today',
    'learning-sheet',
    'review',
    'reward',
    'shop',
    'inventory',
    'learn',
    'learn-pack',
    'learn-plan',
    'learn-lesson',
    'learn-print',
    'pet',
    'home',
    'home-visit',
    'explore',
    'playground'
]);

const APP_SHELL_PAGES = new Set([
    'walk',
    'card',
    'mathpk',
    'hanzi',
    'typing-defense',
    'learning-arcade',
    'word-memory-map',
    'leaderboard'
]);

const PARENT_SHELL_PAGES = new Set(['parent', 'works', 'tools', 'settings']);

const SETTINGS_SECTION_ROUTES = {
    home: '/settings',
    account: '/settings/account',
    family: '/settings/family',
    learning: '/settings/learning',
    rules: '/settings/rules',
    advanced: '/settings/advanced'
};

const SETTINGS_SECTION_LABELS = {
    home: '设置首页',
    account: '账号与孩子',
    family: '家庭云端',
    learning: '学习与题目',
    rules: '规则模板',
    advanced: '高级与危险操作'
};

const PAGE_ROUTE_MAP = {
    map: '/app',
    today: '/app/today',
    'learning-sheet': '/app/today/learning-sheet',
    review: '/app/today/review',
    reward: '/app/today/reward',
    shop: '/app/today/shop',
    inventory: '/app/today/inventory',
    learn: '/app/learn',
    'learn-pack': '/app/learn/pack',
    'learn-plan': '/app/learn/plan',
    'learn-lesson': '/app/learn/lesson',
    'learn-print': '/app/learn/print',
    pet: '/app/pet',
    home: '/app/pet/home',
    walk: '/app/pet/walk',
    card: '/app/pet/cards',
    'home-visit': '/app/pet/home-visit',
    explore: '/app/explore',
    playground: '/app/playground',
    mathpk: '/app/playground/math-pk',
    hanzi: '/app/playground/hanzi',
    'typing-defense': '/app/playground/typing-defense',
    'learning-arcade': '/app/playground/learning-arcade',
    'word-memory-map': '/app/playground/word-memory-map',
    leaderboard: '/app/playground/leaderboard',
    parent: '/parent',
    works: '/parent/works',
    tools: '/parent/tools',
    settings: '/settings'
};

const ROUTE_TO_PAGE = {
    '/': { page: 'map' },
    '/app': { page: 'map' },
    '/app/today': { page: 'today' },
    '/app/today/learning-sheet': { page: 'learning-sheet' },
    '/app/today/review': { page: 'review' },
    '/app/today/reward': { page: 'reward' },
    '/app/today/shop': { page: 'shop' },
    '/app/today/inventory': { page: 'inventory' },
    '/app/learn': { page: 'learn' },
    '/app/learn/pack': { page: 'learn-pack' },
    '/app/learn/plan': { page: 'learn-plan' },
    '/app/learn/lesson': { page: 'learn-lesson' },
    '/app/learn/print': { page: 'learn-print' },
    '/app/pet': { page: 'pet' },
    '/app/pet/home': { page: 'home' },
    '/app/pet/walk': { page: 'walk' },
    '/app/pet/cards': { page: 'card' },
    '/app/pet/home-visit': { page: 'home-visit' },
    '/app/explore': { page: 'explore' },
    '/app/playground': { page: 'playground' },
    '/app/playground/math-pk': { page: 'mathpk' },
    '/app/playground/hanzi': { page: 'hanzi' },
    '/app/playground/typing-defense': { page: 'typing-defense' },
    '/app/playground/learning-arcade': { page: 'learning-arcade' },
    '/app/playground/word-memory-map': { page: 'word-memory-map' },
    '/app/playground/leaderboard': { page: 'leaderboard' },
    '/today': { page: 'today' },
    '/today/learning-sheet': { page: 'learning-sheet' },
    '/today/review': { page: 'review' },
    '/today/reward': { page: 'reward' },
    '/today/shop': { page: 'shop' },
    '/today/inventory': { page: 'inventory' },
    '/shop': { page: 'shop' },
    '/learn': { page: 'learn' },
    '/learn/pack': { page: 'learn-pack' },
    '/learn/plan': { page: 'learn-plan' },
    '/learn/lesson': { page: 'learn-lesson' },
    '/learn/print': { page: 'learn-print' },
    '/pet': { page: 'pet' },
    '/pet/home': { page: 'home' },
    '/pet/walk': { page: 'walk' },
    '/pet/cards': { page: 'card' },
    '/pet/home-visit': { page: 'home-visit' },
    '/explore': { page: 'explore' },
    '/playground': { page: 'playground' },
    '/playground/math-pk': { page: 'mathpk' },
    '/playground/hanzi': { page: 'hanzi' },
    '/playground/typing-defense': { page: 'typing-defense' },
    '/playground/learning-arcade': { page: 'learning-arcade' },
    '/playground/word-memory-map': { page: 'word-memory-map' },
    '/playground/leaderboard': { page: 'leaderboard' },
    '/parent': { page: 'parent' },
    '/parent/works': { page: 'works' },
    '/parent/tools': { page: 'tools' },
    '/parent/settings': { page: 'settings', settingsSection: 'home' },
    '/parent/settings/account': { page: 'settings', settingsSection: 'account' },
    '/parent/settings/family': { page: 'settings', settingsSection: 'family' },
    '/parent/settings/learning': { page: 'settings', settingsSection: 'learning' },
    '/parent/settings/rules': { page: 'settings', settingsSection: 'rules' },
    '/parent/settings/advanced': { page: 'settings', settingsSection: 'advanced' },
    '/settings': { page: 'settings', settingsSection: 'home' },
    '/settings/account': { page: 'settings', settingsSection: 'account' },
    '/settings/family': { page: 'settings', settingsSection: 'family' },
    '/settings/learning': { page: 'settings', settingsSection: 'learning' },
    '/settings/rules': { page: 'settings', settingsSection: 'rules' },
    '/settings/advanced': { page: 'settings', settingsSection: 'advanced' }
};

let activeSettingsSection = 'home';

function canUsePathRouting() {
    return window.location && /^https?:$/.test(window.location.protocol);
}

function cleanRoutePath(pathname) {
    let path = '/';
    try {
        path = decodeURIComponent(pathname || '/');
    } catch (error) {
        path = pathname || '/';
    }
    path = path.replace(/\/index\.html$/i, '/').replace(/\/+$/g, '') || '/';
    return path;
}

function normalizeRoutePath(pathname) {
    const path = cleanRoutePath(pathname);
    if (ROUTE_TO_PAGE[path]) return path;
    const segments = path.split('/').filter(Boolean);
    for (let i = 1; i < segments.length; i += 1) {
        const candidate = '/' + segments.slice(i).join('/');
        if (ROUTE_TO_PAGE[candidate]) return candidate;
    }
    return path;
}

function inferRouteBase(pathname) {
    const path = cleanRoutePath(pathname);
    if (ROUTE_TO_PAGE[path]) return '';
    const routePaths = Object.keys(ROUTE_TO_PAGE).filter(routePath => routePath !== '/').sort((a, b) => b.length - a.length);
    for (const routePath of routePaths) {
        if (path === routePath || path.endsWith(routePath)) {
            return path.slice(0, -routePath.length).replace(/\/+$/g, '');
        }
    }
    if (/\/index\.html$/i.test(pathname || '')) {
        return (pathname || '').replace(/\/index\.html$/i, '').replace(/\/+$/g, '');
    }
    if (path !== '/' && !/\.[a-z0-9]+$/i.test(path.split('/').pop() || '')) {
        return path;
    }
    return '';
}

function withRouteBase(routePath) {
    const base = inferRouteBase(window.location.pathname || '/');
    if (!base) return routePath;
    if (routePath === '/') return base || '/';
    return `${base}${routePath}`;
}

function cloneRoute(route) {
    return Object.assign({}, route || { page: 'map' });
}

function resolveRouteFromLocation(locationLike) {
    const loc = locationLike || window.location;
    const hashPath = loc && loc.hash && loc.hash.startsWith('#/')
        ? loc.hash.slice(1).replace(/\/+$/g, '') || '/'
        : '';
    const routePath = hashPath || normalizeRoutePath(loc ? loc.pathname : '/');
    return cloneRoute(ROUTE_TO_PAGE[routePath] || { page: 'map' });
}

function normalizeSettingsSection(section) {
    return SETTINGS_SECTION_ROUTES[section] ? section : 'home';
}

function getPathForPage(page, options = {}) {
    if (page === 'settings') {
        return SETTINGS_SECTION_ROUTES[normalizeSettingsSection(options.settingsSection || activeSettingsSection)];
    }
    return PAGE_ROUTE_MAP[page] || PAGE_ROUTE_MAP.map;
}

function updateBrowserRoute(page, options = {}) {
    if (!canUsePathRouting() || options.updateHistory === false) return;
    const path = withRouteBase(getPathForPage(page, options));
    const search = window.location.search || '';
    const nextUrl = `${path}${search}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;
    const state = { page, settingsSection: options.settingsSection || null };
    if (options.replace) {
        window.history.replaceState(state, '', nextUrl);
    } else {
        window.history.pushState(state, '', nextUrl);
    }
}

function getRouteShell(page) {
    if (CLASSIC_APP_PAGES.has(page)) return 'home';
    if (PARENT_SHELL_PAGES.has(page)) return 'parent';
    if (APP_SHELL_PAGES.has(page)) return 'app';
    return 'home';
}

function syncRouteShellStatus() {
    const childNameEl = document.getElementById('appShellChildName');
    const pointsEl = document.getElementById('appShellPoints');
    if (childNameEl) {
        const activeProfile = window.ProfileManager && typeof ProfileManager.getActive === 'function'
            ? ProfileManager.getActive()
            : null;
        const fallbackName = document.getElementById('profileCurName')?.textContent || '默认孩子';
        childNameEl.textContent = activeProfile && activeProfile.name ? activeProfile.name : fallbackName;
    }
    if (pointsEl) pointsEl.textContent = String(totalPoints || 0);
}

function getParentShellNavKey(page) {
    if (page === 'settings') return 'settings';
    if (page === 'works') return 'works';
    if (page === 'tools') return 'tools';
    if (page === 'parent') return 'parent';
    return 'app';
}

function getAppShellSurface(page) {
    const tabPage = PAGE_TO_TAB[page] || page;
    if (page === 'mathpk' || page === 'hanzi' || page === 'typing-defense' || page === 'word-memory-map' || page === 'leaderboard') return 'game';
    if (tabPage === 'explore' || tabPage === 'playground') return 'scene';
    if (tabPage === 'today' || tabPage === 'learn') return 'focus';
    if (tabPage === 'pet') return 'studio';
    return 'home';
}

function applyRouteShell(page) {
    const shell = getRouteShell(page);
    const tabPage = PAGE_TO_TAB[page] || page;
    const parentNavKey = getParentShellNavKey(page);
    document.body.classList.toggle('shell-home', shell === 'home');
    document.body.classList.toggle('shell-app', shell === 'app');
    document.body.classList.toggle('shell-parent', shell === 'parent');
    document.body.setAttribute('data-route-shell', shell);
    if (shell === 'app') {
        document.body.dataset.appPage = tabPage;
        document.body.dataset.appRoutePage = page;
        document.body.dataset.appSurface = getAppShellSurface(page);
    } else {
        delete document.body.dataset.appPage;
        delete document.body.dataset.appRoutePage;
        delete document.body.dataset.appSurface;
    }
    document.querySelectorAll('[data-app-dock]').forEach((item) => {
        item.classList.toggle('is-current', item.dataset.appDock === tabPage);
        item.setAttribute('aria-current', item.dataset.appDock === tabPage ? 'page' : 'false');
    });
    document.querySelectorAll('[data-parent-shell-nav]').forEach((item) => {
        item.classList.toggle('is-current', item.dataset.parentShellNav === parentNavKey);
        item.setAttribute('aria-current', item.dataset.parentShellNav === parentNavKey ? 'page' : 'false');
    });
    syncRouteShellStatus();
}

function applySettingsSection(section) {
    activeSettingsSection = normalizeSettingsSection(section);
    const label = SETTINGS_SECTION_LABELS[activeSettingsSection] || SETTINGS_SECTION_LABELS.home;
    document.querySelectorAll('#page-settings .settings-subpage-panel[data-settings-section]').forEach((panel) => {
        panel.classList.toggle('is-active', panel.dataset.settingsSection === activeSettingsSection);
    });
    document.querySelectorAll('#page-settings [data-settings-nav]').forEach((item) => {
        item.classList.toggle('is-current', item.dataset.settingsNav === activeSettingsSection);
        if (item.tagName === 'A') {
            item.setAttribute('aria-current', item.dataset.settingsNav === activeSettingsSection ? 'page' : 'false');
        }
    });
    document.querySelectorAll('#page-settings .section-menu-current').forEach((node) => {
        node.textContent = `当前：${label}`;
    });
    const title = document.getElementById('settingsHeroTitle');
    const eyebrow = document.getElementById('settingsHeroEyebrow');
    const copy = document.getElementById('settingsHeroCopy');
    if (eyebrow) eyebrow.textContent = activeSettingsSection === 'home' ? '设置 / 家长区' : `设置 / ${label}`;
    if (title) title.textContent = activeSettingsSection === 'home' ? '设置首页' : label;
    if (copy) {
        const copies = {
            home: '把账号、家庭云端、学习题目和危险操作拆成可直达的子页，先让家长区有清晰边界。',
            account: '新增、改名或删除孩子账号；切换当前孩子仍然使用右上角头像。',
            family: '登录、家庭同步、好友串门等能力集中在这里，避免散落到孩子主流程。',
            learning: '管理学习打勾模式、数学 PK 难度等会影响孩子日常体验的配置。',
            rules: '后续把阅读、数学、复盘、整理等加分/扣分项做成可编辑模板。',
            advanced: '数据导入、导出、云端诊断和覆盖类操作统一收纳到高级区。'
        };
        copy.textContent = copies[activeSettingsSection] || copies.home;
    }
}

function handleSettingsNavClick(event, section) {
    if (event) event.preventDefault();
    switchPage('settings', { settingsSection: normalizeSettingsSection(section) });
}

const TOP_HUB_MENU_CONFIG = {
    today: [
        { page: 'today', label: '今日打卡' },
        { page: 'learning-sheet', label: '学习单' },
        { page: 'review', label: '每周复盘' },
        { page: 'reward', label: '奖励兑换' },
        { page: 'shop', label: '兑换商店' },
        { page: 'inventory', label: '背包' }
    ],
    pet: [
        { page: 'pet', label: '我的宠物' },
        { page: 'home', label: '宠物小屋' },
        { page: 'walk', label: '遛弯' },
        { page: 'card', label: '卡片图鉴' }
    ],
    playground: [
        { page: 'playground', label: '游乐场首页' },
        { page: 'mathpk', label: '数学 PK' },
        { page: 'hanzi', label: '汉字游戏' },
        { page: 'typing-defense', label: '消灭苦力怕' },
        { page: 'learning-arcade', label: '学习机小游戏' },
        { page: 'word-memory-map', label: '像素探险' },
        { action: 'cardArena', label: '卡牌对战' },
        { page: 'leaderboard', label: '排行榜' }
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
    } else if (action === 'cardArena' && typeof window.openCardArenaEntry === 'function') {
        window.openCardArenaEntry();
    }
}

function closeSectionMenus() {
    document.querySelectorAll('.section-menu[open]').forEach((menu) => {
        menu.removeAttribute('open');
    });
}

let pendingWalkRouteId = '';

function openPetWalk(routeId) {
    closeSectionMenus();
    pendingWalkRouteId = routeId || '';
    switchPage('walk');
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

function switchPage(page, options = {}) {
    closeSectionMenus();
    closeTopHubMenus();
    if (page === 'settings') {
        activeSettingsSection = normalizeSettingsSection(options.settingsSection || activeSettingsSection || 'home');
    }
    // 离开宠物小屋：标记 exit（写 last_home_ts，下次进入结算）
    const prevPageEl = document.querySelector('.page.active');
    const prevPage = prevPageEl ? prevPageEl.id.replace('page-', '') : null;
    if (prevPage === 'home' && page !== 'home' && window.PetSystem && typeof PetSystem.markHomeExit === 'function') {
        PetSystem.markHomeExit();
        if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
            window.CloudSync.scheduleSync('home_exit');
        }
    }
    if (prevPage === 'explore' && page !== 'explore' && window.VoiceSystem && typeof VoiceSystem.stop === 'function') {
        VoiceSystem.stop();
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
    applyRouteShell(page);
    // 首页保留侧栏状态感；其他 tab 继续沿用全宽内容页。
    document.body.classList.toggle('no-sidebar', page !== 'map');
    document.body.classList.toggle('learn-mode', page === 'learn' || page.startsWith('learn-'));
    updateBrowserRoute(page, {
        settingsSection: page === 'settings' ? activeSettingsSection : null,
        replace: options.replace === true,
        updateHistory: options.updateHistory
    });
    if (page === 'settings') applySettingsSection(activeSettingsSection);
    void preparePage(page);
    /* legacy eager page activation kept disabled after runtime-loader migration
    if (page === 'map' && window.ExplorationSystem && document.getElementById('sceneGridMap')) ExplorationSystem.renderSceneGridMap();
    if (page === 'pet') renderPetPage();
    if (page === 'walk') {
        renderWalkPage();
        if (!pendingWalkRouteId && window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh()
                .then(function () {
                    const walkPage = document.getElementById('page-walk');
                    if (walkPage && walkPage.classList.contains('active')) renderWalkPage();
                })
                .catch(function () {});
        }
    }
    if (page === 'home-visit' && window.SocialSystem && typeof window.SocialSystem.renderFriendHomeVisit === 'function') {
        window.SocialSystem.renderFriendHomeVisit('friend-home-visit-root');
    }
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
    if (page === 'learning-sheet' && window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('points-learning-sheet-container');
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
    */
    window.sfx && sfx.click();
}

window.switchPage = switchPage;

function maybeSeedStarterCards() {
    if (!window.CardCollection || typeof window.CardCollection.addCard !== 'function') return;
    try {
        if (localStorage.getItem('petbank_starter_cards') || typeof PetSystem.getAllSpecies !== 'function') return;
        const commons = PetSystem.getAllSpecies().filter(function (species) {
            return species.rarity === 'common';
        });
        if (commons.length < 3) return;
        commons.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 3)
            .forEach(function (card) {
                window.CardCollection.addCard(card.id);
            });
        localStorage.setItem('petbank_starter_cards', '1');
    } catch (error) {}
}

function updateParentHomePage() {
    const childNameEl = document.getElementById('parentHomeChildName');
    if (!childNameEl) return;
    const activeProfile = window.ProfileManager && typeof ProfileManager.getActive === 'function'
        ? ProfileManager.getActive()
        : null;
    const fallbackName = document.getElementById('profileCurName')?.textContent || '默认孩子';
    childNameEl.textContent = activeProfile && activeProfile.name ? activeProfile.name : fallbackName;
}

const TYPING_DEFENSE_BRIDGE_SOURCE = 'petbank-typing-defense';
const typingDefenseBridgeSeen = new Set();
const WORD_MEMORY_MAP_BRIDGE_SOURCE = 'petbank-word-memory-map';
const wordMemoryMapBridgeSeen = new Set();
const LEARNING_ARCADE_BRIDGE_SOURCE = 'petbank-learning-arcade';
const learningArcadeBridgeSeen = new Set();

function syncTypingDefenseHostPoints() {
    const pgPoints = document.getElementById('pg-points');
    if (pgPoints) pgPoints.textContent = String(totalPoints || 0);
    const status = document.getElementById('typing-defense-status');
    if (status) status.textContent = `主站积分已同步：${totalPoints || 0}`;
    renderTypingDefenseSummaryPanel();
}

function syncWordMemoryMapHostPoints() {
    const pgPoints = document.getElementById('pg-points');
    if (pgPoints) pgPoints.textContent = String(totalPoints || 0);
    const status = document.getElementById('word-memory-map-status');
    if (status) status.textContent = `主站积分已同步：${totalPoints || 0}`;
    renderWordMemoryMapSummaryPanel();
}

function handleTypingDefenseBridgeMessage(event) {
    const data = event && event.data;
    if (!data || data.source !== TYPING_DEFENSE_BRIDGE_SOURCE) return;
    const frame = document.getElementById('typing-defense-frame');
    if (frame && frame.contentWindow && event.source !== frame.contentWindow) return;
    if (event.origin && window.location.origin && event.origin !== window.location.origin) return;

    const sessionId = String(data.sessionId || '');
    const seq = Number(data.seq || 0);
    const key = `${sessionId}:${seq}`;
    if (!sessionId || !Number.isFinite(seq) || typingDefenseBridgeSeen.has(key)) return;
    typingDefenseBridgeSeen.add(key);
    if (typingDefenseBridgeSeen.size > 600) {
        const staleKey = typingDefenseBridgeSeen.values().next().value;
        if (staleKey) typingDefenseBridgeSeen.delete(staleKey);
    }

    const payload = data.payload || {};
    if (data.kind === 'reward') {
        const points = Math.max(0, Math.floor(Number(payload.points) || 0));
        if (points > 0) {
            addGrowthPoints(points);
            syncTypingDefenseHostPoints();
        }
        return;
    }

    if (data.kind === 'result') {
        const progress = recordTypingDefenseResult(payload);
        syncTypingDefenseHostPoints();
        renderPlaygroundProgressBoard();
        renderReviewBattleBoard();
        if (typeof showToast === 'function') {
            const score = Math.max(0, Math.floor(Number(payload.score) || 0));
            const stars = Math.max(0, Math.floor(Number(payload.earnedStars) || 0));
            const summary = payload.won
                ? `消灭苦力怕通关，本局已同步 ${score} 成长分，拿到 ${stars} 颗星，累计通关 ${progress.wins} 局`
                : `消灭苦力怕结束，本局已同步 ${score} 成长分`;
            showToast(summary);
        }
    }
}

window.addEventListener('message', handleTypingDefenseBridgeMessage);

function handleWordMemoryMapBridgeMessage(event) {
    const data = event && event.data;
    if (!data || data.source !== WORD_MEMORY_MAP_BRIDGE_SOURCE) return;
    const frame = document.getElementById('word-memory-map-frame');
    if (frame && frame.contentWindow && event.source !== frame.contentWindow) return;
    if (event.origin && window.location.origin && event.origin !== window.location.origin) return;

    const sessionId = String(data.sessionId || '');
    const seq = Number(data.seq || 0);
    const key = `${sessionId}:${seq}`;
    if (!sessionId || !Number.isFinite(seq) || wordMemoryMapBridgeSeen.has(key)) return;
    wordMemoryMapBridgeSeen.add(key);
    if (wordMemoryMapBridgeSeen.size > 600) {
        const staleKey = wordMemoryMapBridgeSeen.values().next().value;
        if (staleKey) wordMemoryMapBridgeSeen.delete(staleKey);
    }

    const payload = data.payload || {};
    if (data.kind !== 'result') return;
    const points = Math.max(0, Math.floor(Number(payload.score) || 0));
    if (points > 0) {
        addGrowthPoints(points);
    }
    const progress = recordWordMemoryMapResult(payload);
    syncWordMemoryMapHostPoints();
    renderPlaygroundProgressBoard();
    renderReviewBattleBoard();
    if (typeof showToast === 'function') {
        const stars = Math.max(0, Math.floor(Number(payload.earnedStars) || 0));
        showToast(`像素探险通关，本局已同步 ${points} 成长分，拿到 ${stars} 颗星，累计通关 ${progress.sessions} 张图`);
    }
}

window.addEventListener('message', handleWordMemoryMapBridgeMessage);

function handleLearningArcadeBridgeMessage(event) {
    const data = event && event.data;
    if (!data || data.source !== LEARNING_ARCADE_BRIDGE_SOURCE) return;
    const frame = document.getElementById('learning-arcade-frame');
    if (frame && frame.contentWindow && event.source !== frame.contentWindow) return;
    if (event.origin && window.location.origin && event.origin !== window.location.origin) return;

    const sessionId = String(data.sessionId || '');
    const seq = Number(data.seq || 0);
    const key = `${sessionId}:${seq}`;
    if (!sessionId || !Number.isFinite(seq) || learningArcadeBridgeSeen.has(key)) return;
    learningArcadeBridgeSeen.add(key);
    if (learningArcadeBridgeSeen.size > 600) {
        const staleKey = learningArcadeBridgeSeen.values().next().value;
        if (staleKey) learningArcadeBridgeSeen.delete(staleKey);
    }

    const payload = data.payload || {};
    if (data.kind === 'settings') {
        renderLearningArcadeSummaryPanel();
        return;
    }

    const progress = readLearningArcadeProgress();
    if (data.kind === 'start') {
        const gameId = String(payload.gameId || '');
        if (!gameId) return;
        const next = {
            ...progress,
            launches: progress.launches + 1,
            lastGame: gameId,
            gameCounts: Object.assign({}, progress.gameCounts, {
                [gameId]: Number(progress.gameCounts && progress.gameCounts[gameId] || 0) + 1
            }),
            updatedAt: new Date().toISOString()
        };
        writeLearningArcadeProgress(next);
        renderLearningArcadeSummaryPanel();
        return;
    }

    if (data.kind === 'result') {
        const gameId = String(payload.gameId || progress.lastGame || '');
        const gameLabel = payload.gameLabel || friendlyLearningArcadeGameLabel(gameId);
        const title = payload.title || '完成一局';
        const next = {
            ...progress,
            completedRounds: progress.completedRounds + 1,
            lastGame: gameId,
            lastTitle: title,
            updatedAt: new Date().toISOString()
        };
        writeLearningArcadeProgress(next);
        renderLearningArcadeSummaryPanel();
        pushBattleRecentActivity({
            id: `learning_arcade_${Date.now()}`,
            mode: 'learning-arcade',
            title: `${gameLabel} · ${title}`,
            detail: '学习机小游戏合集已回写主站记录。'
        });
        if (typeof showToast === 'function') {
            showToast(`${gameLabel} 已同步回主站`);
        }
    }
}

window.addEventListener('message', handleLearningArcadeBridgeMessage);

function ensureTypingDefenseEmbed() {
    const frame = document.getElementById('typing-defense-frame');
    if (!frame) return;
    const src = withRouteBase('/app/playground/typing-defense-runtime/web/index.html');
    const launchLink = document.getElementById('typing-defense-launch');
    const status = document.getElementById('typing-defense-status');
    if (launchLink) launchLink.href = src;
    if (frame.dataset.loaded === '1') return;
    if (status) {
        status.classList.remove('is-ready');
        status.textContent = '正在加载消灭苦力怕...';
    }
    frame.addEventListener('load', function onLoad() {
        frame.dataset.loaded = '1';
        if (status) {
            status.textContent = `已加载，可直接开始。当前主站积分 ${totalPoints || 0}`;
            window.setTimeout(function () {
                status.classList.add('is-ready');
            }, 260);
        }
        frame.removeEventListener('load', onLoad);
    });
    frame.addEventListener('error', function onError() {
        if (status) {
            status.classList.remove('is-ready');
            status.textContent = '加载失败，请检查消灭苦力怕的静态资源路径。';
        }
        frame.removeEventListener('error', onError);
    });
    frame.src = src;
}

function ensureLearningArcadeEmbed() {
    const frame = document.getElementById('learning-arcade-frame');
    if (!frame) return;
    const requestedGame = String(frame.dataset.requestedGame || '').trim();
    const src = withRouteBase(`/prj/%E5%AD%A6%E4%B9%A0%E6%9C%BA%E7%8E%A9%E6%B3%95%E5%8E%9F%E5%9E%8B/index.html${requestedGame ? `?game=${encodeURIComponent(requestedGame)}` : ''}`);
    const launchLink = document.getElementById('learning-arcade-launch');
    const status = document.getElementById('learning-arcade-status');
    if (launchLink) launchLink.href = src;
    if (frame.dataset.loaded === '1') return;
    if (status) {
        status.classList.remove('is-ready');
        status.textContent = '正在加载学习机小游戏...';
    }
    frame.addEventListener('load', function onLoad() {
        frame.dataset.loaded = '1';
        if (status) {
            status.textContent = '已加载，可直接开始。合集里包含三个小游戏。';
            window.setTimeout(function () {
                status.classList.add('is-ready');
            }, 260);
        }
        frame.removeEventListener('load', onLoad);
    });
    frame.addEventListener('error', function onError() {
        if (status) {
            status.classList.remove('is-ready');
            status.textContent = '加载失败，请检查学习机玩法原型的静态资源路径。';
        }
        frame.removeEventListener('error', onError);
    });
    frame.src = src;
}

function openLearningArcadeGame(gameId) {
    const normalized = String(gameId || '').trim();
    if (!normalized) {
        switchPage('learning-arcade');
        return;
    }
    const frame = document.getElementById('learning-arcade-frame');
    if (frame) {
        frame.dataset.requestedGame = normalized;
    }
    switchPage('learning-arcade');
    window.setTimeout(function () {
        const liveFrame = document.getElementById('learning-arcade-frame');
        const api = liveFrame && liveFrame.contentWindow && liveFrame.contentWindow.LearningArcadePrototype;
        if (api && typeof api.openGame === 'function') {
            try {
                api.openGame(normalized);
            } catch (_) {}
        }
    }, 120);
}

window.openLearningArcadeGame = openLearningArcadeGame;

function ensureWordMemoryMapEmbed() {
    const frame = document.getElementById('word-memory-map-frame');
    if (!frame) return;
    const src = withRouteBase('/prj/%E5%8D%95%E8%AF%8D%E8%AE%B0%E5%BF%86%E5%B0%84%E5%87%BB%E5%9C%BA%E5%8E%9F%E5%9E%8B/index.html');
    const launchLink = document.getElementById('word-memory-map-launch');
    const status = document.getElementById('word-memory-map-status');
    if (launchLink) launchLink.href = src;
    if (frame.dataset.loaded === '1') return;
    if (status) {
        status.classList.remove('is-ready');
        status.textContent = '正在加载像素探险...';
    }
    frame.addEventListener('load', function onLoad() {
        frame.dataset.loaded = '1';
        if (status) {
            status.textContent = `已加载，可直接开始。当前主站积分 ${totalPoints || 0}`;
            window.setTimeout(function () {
                status.classList.add('is-ready');
            }, 260);
        }
        frame.removeEventListener('load', onLoad);
    });
    frame.addEventListener('error', function onError() {
        if (status) {
            status.classList.remove('is-ready');
            status.textContent = '加载失败，请检查像素探险原型的静态资源路径。';
        }
        frame.removeEventListener('error', onError);
    });
    frame.src = src;
}

function runPageActivation(page) {
    if (page === 'map' && window.ExplorationSystem && document.getElementById('sceneGridMap')) ExplorationSystem.renderSceneGridMap();
    if (page === 'parent') updateParentHomePage();
    if (page === 'works') renderGrowthWorksPage();
    if (page === 'pet') renderPetPage();
    if (page === 'walk') {
        renderWalkPage();
        if (!pendingWalkRouteId && window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh()
                .then(function () {
                    const walkPage = document.getElementById('page-walk');
                    if (walkPage && walkPage.classList.contains('active')) renderWalkPage();
                })
                .catch(function () {});
        }
    }
    if (page === 'home-visit' && window.SocialSystem && typeof window.SocialSystem.renderFriendHomeVisit === 'function') {
        window.SocialSystem.renderFriendHomeVisit('friend-home-visit-root');
    }
    if (page === 'explore' && window.ExplorationSystem) void renderExplorePage();
    if (page === 'playground') renderPlaygroundProgressBoard();
    if (page === 'review') renderReviewBattleBoard();
    if (page === 'mathpk' && window.MathPKGame) MathPKGame.renderUI('math-pk-container');
    if (page === 'hanzi' && window.HanziGame) HanziGame.renderUI('hanzi-container');
    if (page === 'typing-defense') {
        renderTypingDefenseSummaryPanel();
        ensureTypingDefenseEmbed();
    }
    if (page === 'learning-arcade') {
        renderLearningArcadeSummaryPanel();
        ensureLearningArcadeEmbed();
    }
    if (page === 'word-memory-map') {
        renderWordMemoryMapSummaryPanel();
        ensureWordMemoryMapEmbed();
    }
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
    if (page === 'learning-sheet' && window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('points-learning-sheet-container');
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
            void window.CloudDiagnostics.refresh('diagnostics-root');
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
    if (page === 'settings' && !window.MathPKGame && window.PetBankRuntime && typeof window.PetBankRuntime.ensurePage === 'function') {
        void window.PetBankRuntime.ensurePage('playground')
            .then(function () {
                const settingsPage = document.getElementById('page-settings');
                if (!settingsPage || !settingsPage.classList.contains('active')) return;
                if (showDiagnostics && window.MathPKGame && typeof window.MathPKGame.renderDifficultySetting === 'function') {
                    MathPKGame.renderDifficultySetting('settings-math-diff');
                }
            })
            .catch(function () {});
    }
    if (page === 'settings') applySettingsSection(activeSettingsSection);
}

async function preparePage(page) {
    const token = ++pageActivationToken;
    if (window.PetBankRuntime && typeof window.PetBankRuntime.ensurePage === 'function') {
        try {
            await window.PetBankRuntime.ensurePage(page);
            maybeSeedStarterCards();
        } catch (error) {
            console.warn('[app] page runtime ensure failed:', page, error);
        }
    }
    if (token !== pageActivationToken || getActivePageId() !== page) return;
    runPageActivation(page);
    if (window.lucide) lucide.createIcons();
}

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
        const sp = PetSystem.getAllSpecies().find(function(item) { return item.id === pet.species; });
        if (sp) {
            window.showPetLightbox(sp.name, sp.imageStyle || 'banchong');
            showToast('点击阶段小图可查看大图');
        }
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

    function escapeLightboxHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeLightboxJs(value) {
        return String(value == null ? '' : value)
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\r/g, '\\r')
            .replace(/\n/g, '\\n');
    }

    function getStageLabelForKey(key, index) {
        const numericKey = Number(key);
        const stage = (PetSystem.STAGES || []).find(function(item) {
            return Number(item.stageIdx || 0) === numericKey;
        });
        if (stage && stage.name) return stage.name;
        const fallback = ['初始形态', '幼体阶段', '成长阶段', '成熟阶段', '完全阶段', '终极阶段'];
        return fallback[index] || `阶段 ${numericKey + 1}`;
    }

    function getPetStageEntriesForSpecies(sp) {
        if (!sp) return [];
        if (sp.imageStages && Object.keys(sp.imageStages).length) {
            return Object.keys(sp.imageStages)
                .sort(function(a, b) { return Number(a) - Number(b); })
                .map(function(key, index) {
                    return {
                        key: key,
                        label: getStageLabelForKey(key, index),
                        src: sp.imageStages[key]
                    };
                })
                .filter(function(entry) { return !!entry.src; });
        }
        if (Array.isArray(sp.stages) && sp.stages.length) {
            return sp.stages.map(function(stage, index) {
                return {
                    key: String(stage.stage != null ? stage.stage : index),
                    label: stage.stage != null ? `阶段 ${stage.stage}` : getStageLabelForKey(index, index),
                    src: stage.imageUrl
                };
            }).filter(function(entry) { return !!entry.src; });
        }
        if (sp.imageUrl) return [{ key: '0', label: '基础形态', src: sp.imageUrl }];
        return [];
    }

    function openPetStageImage(src, petName, label, fallbackEmoji) {
        if (!src) return;
        let zoom = document.getElementById('petStageZoom');
        if (!zoom) {
            zoom = document.createElement('div');
            zoom.id = 'petStageZoom';
            zoom.className = 'pet-stage-zoom';
            document.body.appendChild(zoom);
        }
        const safeName = escapeLightboxHtml(petName || '宠物');
        const safeLabel = escapeLightboxHtml(label || '成长阶段');
        zoom.innerHTML = `
            <div class="pet-stage-zoom-backdrop" onclick="closePetStageZoom()"></div>
            <div class="pet-stage-zoom-panel" role="dialog" aria-modal="true" aria-label="${safeName} ${safeLabel} 大图" onclick="event.stopPropagation()">
                <button type="button" class="pet-stage-zoom-close" onclick="closePetStageZoom()" aria-label="关闭大图">&times;</button>
                <div class="pet-stage-zoom-title">
                    <span>成长阶段</span>
                    <strong>${safeName}</strong>
                    <p>${safeLabel}</p>
                </div>
                <div class="pet-stage-zoom-frame">
                    <img src="${escapeLightboxHtml(src)}" alt="${safeName} ${safeLabel}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                    <div class="pet-stage-zoom-fallback" style="display:none;">${escapeLightboxHtml(fallbackEmoji || '🐾')}</div>
                </div>
            </div>`;
        zoom.classList.add('show');
    }

    window.openPetStageImage = openPetStageImage;

    window.closePetStageZoom = function() {
        const zoom = document.getElementById('petStageZoom');
        if (zoom) zoom.classList.remove('show');
    };

    // 大图灯箱：展示宠物多阶段图库，点击任意阶段继续放大
    window.showPetLightbox = function(petName, style) {
        const species = PetSystem.getAllSpecies();
        const sp = species.find(function(s) { return s.name === petName; });
        if (!sp) return;
        const entries = getPetStageEntriesForSpecies(sp);
        let overlay = document.getElementById('petLightbox');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'petLightbox';
            overlay.className = 'pet-lightbox';
            overlay.onclick = function(e) { if (e.target === overlay) closeLightbox(); };
            document.body.appendChild(overlay);
        }
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', `${petName} 成长阶段图库`);
        const stageHtml = entries.length
            ? entries.map(function(entry) {
                return `
                    <button type="button" class="pet-lightbox-stage" onclick="openPetStageImage('${escapeLightboxJs(entry.src)}','${escapeLightboxJs(sp.name)}','${escapeLightboxJs(entry.label)}','${escapeLightboxJs(sp.emoji || '🐾')}')">
                        <span class="pet-lightbox-stage-art">
                            <img src="${escapeLightboxHtml(entry.src)}" alt="${escapeLightboxHtml(sp.name)} ${escapeLightboxHtml(entry.label)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
                            <span class="pet-lightbox-stage-fallback" style="display:none;">${escapeLightboxHtml(sp.emoji || '🐾')}</span>
                        </span>
                        <strong>${escapeLightboxHtml(entry.label)}</strong>
                        <span>点击看大图</span>
                    </button>`;
            }).join('')
            : `<div class="pet-lightbox-empty">${escapeLightboxHtml(sp.emoji || '🐾')} 暂无可展示阶段图</div>`;
        overlay.innerHTML = `
            <div class="pet-lightbox-panel" onclick="event.stopPropagation()">
                <button type="button" class="pet-lightbox-close" onclick="closeLightbox()" aria-label="关闭阶段图库">&times;</button>
                <div class="pet-lightbox-head">
                    <span>成长图库</span>
                    <h2>${escapeLightboxHtml(sp.emoji || '🐾')} ${escapeLightboxHtml(petName)}</h2>
                    <p>${entries.length} 个阶段 · 再点任意小图查看大图</p>
                </div>
                <div class="pet-lightbox-grid">${stageHtml}</div>
            </div>`;
        overlay.style.display = 'flex';
    };

    window.selectLightboxPose = function(petName, pose) {
        const species = PetSystem.getAllSpecies();
        const sp = species.find(function(s) { return s.name === petName; });
        if (!sp) return;
        const src = (sp.imageStages && sp.imageStages[pose]) || getPetImagePath(sp.id, pose) || sp.imageUrl || '';
        openPetStageImage(src, sp.name, getStageLabelForKey(pose, Number(pose) || 0), sp.emoji || '🐾');
    };

    window.closeLightbox = function() {
        const overlay = document.getElementById('petLightbox');
        if (overlay) overlay.style.display = 'none';
    };

function escapeAppHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAppJs(value) {
    return String(value == null ? '' : value)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r/g, '\\r')
        .replace(/\n/g, '\\n');
}

function getPetStageImageForStage(speciesData, stageIdx) {
    if (!speciesData) return '';
    const key = String(stageIdx || 0);
    if (speciesData.imageStages && speciesData.imageStages[key]) {
        return speciesData.imageStages[key];
    }
    return speciesData.imageUrl || '';
}

function getWalkDaySummary() {
    const today = new Date().toDateString();
    const raw = JSON.parse(localStorage.getItem('petbank_walk_data') || '{}');
    const count = raw.date === today ? Number(raw.count || 0) : 0;
    const max = 3;
    return {
        count: count,
        max: max,
        remaining: Math.max(0, max - count)
    };
}

function canWalkWithPeer(peer) {
    return Boolean(peer) && (peer.peerType === 'household' || peer.visit_access !== 'private');
}

function canOpenPeerHome(peer) {
    return Boolean(peer) && (peer.peerType === 'household' || peer.home_visibility !== 'private');
}

function getWalkPeerSourceLabel(peer) {
    return peer && peer.peerType === 'household' ? '家庭成员' : '好友';
}

function getWalkPeerVisualMarkup(peer) {
    const petSummary = peer && peer.pet_summary_json ? peer.pet_summary_json : {};
    const imageUrl = petSummary.image_url || '';
    if (imageUrl) {
        return `<img class="walk-buddy-stage-img" src="${escapeAppHtml(imageUrl)}" alt="${escapeAppHtml(peer.display_name || '同行宠物')}">`;
    }
    return `<div class="walk-buddy-stage-emoji">${escapeAppHtml(petSummary.species_emoji || peer.emoji || '🐾')}</div>`;
}

function getFeaturedWalkPeer(combinedPeers, availablePeers, pendingInvites) {
    if (pendingInvites.length) {
        const invite = pendingInvites[0];
        const matched = combinedPeers.find(function(peer) {
            return peer && peer.id === invite.peerChildId;
        });
        if (matched) return matched;
        return {
            id: invite.peerChildId,
            display_name: invite.peerName || '好友',
            emoji: invite.peerEmoji || '🐾',
            peerType: 'friend',
            pet_summary_json: {
                species_emoji: invite.peerEmoji || '🐾'
            },
            home_summary_json: {}
        };
    }
    return availablePeers[0] || null;
}

function renderWalkPage() {
    const root = document.getElementById('walk-page-root');
    if (!root) return;

    const pet = PetSystem.getState();
    const socialState = window.SocialSystem && typeof window.SocialSystem.getState === 'function'
        ? window.SocialSystem.getState()
        : { loading: false, info: '', error: '', activeCloudChild: null, householdPeers: [], friends: [], visits: [] };
    const walkSummary = getWalkDaySummary();
    const walkRoutes = window.WalkSystem && typeof WalkSystem.getRoutes === 'function'
        ? WalkSystem.getRoutes()
        : [];
    const activeRouteId = window.WalkSystem && typeof WalkSystem.getActiveRouteId === 'function'
        ? WalkSystem.getActiveRouteId()
        : '';
    const activeRoute = walkRoutes.find(function(route) {
        return route.id === activeRouteId;
    }) || walkRoutes[0] || null;
    const petMaxHp = pet.total_max_hp || pet.max_hp || 0;
    const walkActionDisabled = pet.hp <= 0 ? 'disabled' : '';
    const hpPct = petMaxHp ? Math.max(0, Math.min(100, Math.round((pet.hp / petMaxHp) * 100))) : 0;
    const hungerVal = pet.hunger != null ? pet.hunger : null;
    const happyVal = pet.happiness != null ? pet.happiness : null;
    const intimacyVal = pet.intimacy != null ? pet.intimacy : null;
    const expNeed = (window.PetSystem && PetSystem.EXP_TABLE && PetSystem.EXP_TABLE[pet.level]) || 30;
    const expPct = expNeed ? Math.max(0, Math.min(100, Math.round(((pet.exp || 0) / expNeed) * 100))) : 100;
    const vitalsMarkup = `
        <div class="walk-home-vitals">
            <div class="walk-home-vit-row">
                <div class="walk-home-vit-head"><span>❤️ HP</span><span>${escapeAppHtml(pet.hp)}/${escapeAppHtml(petMaxHp)}</span></div>
                <div class="walk-home-vit-bar"><div class="walk-home-vit-fill hp" style="width:${hpPct}%"></div></div>
                ${pet.hp > 0 && hpPct < 40 ? '<div class="walk-home-vit-warn is-danger">⚠️ 体力偏低，建议先休息或回小屋救援。</div>' : ''}
            </div>
            <div class="walk-home-vit-row">
                <div class="walk-home-vit-head"><span>🍽️ 饱食</span><span>${hungerVal != null ? escapeAppHtml(hungerVal) : '--'}</span></div>
                <div class="walk-home-vit-bar"><div class="walk-home-vit-fill hunger" style="width:${hungerVal != null ? hungerVal : 0}%"></div></div>
                ${hungerVal != null && hungerVal < 20 ? '<div class="walk-home-vit-warn">⚠️ 有点饿了，先喂点零食会更舒服。</div>' : ''}
            </div>
            <div class="walk-home-vit-row">
                <div class="walk-home-vit-head"><span>😊 快乐</span><span>${happyVal != null ? escapeAppHtml(happyVal) : '--'}</span></div>
                <div class="walk-home-vit-bar"><div class="walk-home-vit-fill happy" style="width:${happyVal != null ? happyVal : 0}%"></div></div>
            </div>
            <div class="walk-home-vit-row">
                <div class="walk-home-vit-head"><span>💖 亲密</span><span>${intimacyVal != null ? escapeAppHtml(intimacyVal) : '--'}</span></div>
                <div class="walk-home-vit-bar"><div class="walk-home-vit-fill intimacy" style="width:${Math.min(100, intimacyVal != null ? intimacyVal : 0)}%"></div></div>
            </div>
            <div class="walk-home-vit-row">
                <div class="walk-home-vit-head"><span>✨ EXP</span><span>Lv.${escapeAppHtml(pet.level)} · ${escapeAppHtml(pet.exp || 0)}/${escapeAppHtml(expNeed)}</span></div>
                <div class="walk-home-vit-bar"><div class="walk-home-vit-fill exp" style="width:${expPct}%"></div></div>
            </div>
        </div>
    `;

    if (!pet.species) {
        pendingWalkRouteId = '';
        root.innerHTML = `
            <div class="card walk-empty-card">
                <div class="card-body text-center">
                    <h2 class="text-lg font-bold">🚶 遛弯还没开始</h2>
                    <p class="text-sm text-muted mt-2">先去我的宠物里认养伙伴，再来这里挑路线、看好友、发起一起遛弯。</p>
                    <button class="btn-primary mt-4" type="button" onclick="switchPage('pet')">先去认养宠物</button>
                </div>
            </div>
        `;
        return;
    }

    const combinedPeers = [];
    const seen = new Set();
    socialState.householdPeers.concat(socialState.friends).forEach(function(peer) {
        if (!peer || seen.has(peer.id)) return;
        seen.add(peer.id);
        combinedPeers.push(peer);
    });
    const availablePeers = combinedPeers.filter(canWalkWithPeer);
    const pendingInvites = (socialState.visits || []).filter(function(visit) {
        return visit && visit.pendingWalkInvite;
    });
    const featuredWalkPeer = getFeaturedWalkPeer(combinedPeers, availablePeers, pendingInvites);
    const walkBuddyStageMarkup = featuredWalkPeer ? `
        <div class="walk-buddy-stage-card" aria-label="同行伙伴宠物">
            <span class="walk-buddy-stage-kicker">同行伙伴</span>
            <div class="walk-buddy-stage-visual">${getWalkPeerVisualMarkup(featuredWalkPeer)}</div>
            <strong>${escapeAppHtml(featuredWalkPeer.display_name || '好友')}</strong>
            <small>${escapeAppHtml((featuredWalkPeer.pet_summary_json && featuredWalkPeer.pet_summary_json.species_name) || '一起遛弯')}</small>
        </div>
    ` : '';
    const walkStatusMarkup = `
        <div class="card walk-home-card">
            <div class="card-body walk-home-status">
                <p class="walk-home-kicker">遛弯中心 / 户外版宠物小屋</p>
                <h3>带着 ${escapeAppHtml(pet.species_data?.name || '小伙伴')} 去 ${escapeAppHtml(activeRoute ? activeRoute.sceneTitle : '户外')} 散步</h3>
                <p class="walk-home-summary">左边保留大场景，右边只留互动、好友和路线信息，整个结构和宠物小屋保持一致。</p>
                ${vitalsMarkup}
                <div class="walk-home-metrics">
                    <div class="walk-home-metric">
                        <span>今日剩余</span>
                        <strong>${walkSummary.remaining}/${walkSummary.max}</strong>
                    </div>
                    <div class="walk-home-metric">
                        <span>当前路线</span>
                        <strong>${escapeAppHtml(activeRoute ? activeRoute.shortName : '--')}</strong>
                    </div>
                    <div class="walk-home-metric">
                        <span>当前等级</span>
                        <strong>Lv.${escapeAppHtml(pet.level)}</strong>
                    </div>
                </div>
                ${pet.hp <= 0 ? '<div class="walk-home-rescue-note">宠物倒下了，先回宠物小屋救援，再回来继续户外遛弯。</div>' : ''}
                <div class="walk-home-actions">
                    <button class="walk-home-action feed" type="button" ${walkActionDisabled} onclick="WalkSystem.handleAdventureAction('feed')"><span>🍪</span>喂点零食</button>
                    <button class="walk-home-action play" type="button" ${walkActionDisabled} onclick="WalkSystem.handleAdventureAction('play')"><span>🎾</span>一起玩耍</button>
                    <button class="walk-home-action rest" type="button" ${walkActionDisabled} onclick="WalkSystem.handleAdventureAction('rest')"><span>🪑</span>坐下休息</button>
                    <button class="walk-home-action walk" type="button" ${walkActionDisabled} onclick="WalkSystem.handleAdventureAction('walk')"><span>🚶</span>立即出发</button>
                </div>
                <div class="walk-home-links">
                    <button class="btn-secondary social-mini-btn" type="button" onclick="switchPage('home')">🏠 回宠物小屋</button>
                    <button class="btn-secondary social-mini-btn" type="button" onclick="switchPage('pet')">📘 看成长档案</button>
                </div>
            </div>
        </div>
    `;
    const walkBuddyMarkup = socialState.loading
        ? '<div class="walk-side-empty">正在刷新可一起遛弯的家庭成员和好友…</div>'
        : !socialState.activeCloudChild
            ? `
                <div class="walk-side-empty">先在设置里登录家长账号并同步当前孩子，好友遛弯列表才会亮起来。</div>
                <div class="social-cta-row walk-side-cta">
                    <button class="btn-primary social-main-btn" type="button" onclick="switchPage('settings')">去设置连接账号</button>
                </div>
            `
            : availablePeers.length
                ? availablePeers.map(function(peer) {
                    const petSummary = peer.pet_summary_json || {};
                    const homeSummary = peer.home_summary_json || {};
                    const peerId = escapeAppHtml(peer.id);
                    return `
                        <div class="walk-peer-item">
                            <div class="walk-peer-main">
                                <div class="walk-peer-emoji">${escapeAppHtml(peer.emoji || '🐾')}</div>
                                <div class="walk-peer-copy">
                                    <strong>${escapeAppHtml(peer.display_name || '未命名好友')}</strong>
                                    <span>${escapeAppHtml(getWalkPeerSourceLabel(peer))} · ${escapeAppHtml(petSummary.species_name || '还没同步宠物')}</span>
                                </div>
                            </div>
                            <div class="walk-peer-chips">
                                <span class="walk-peer-chip">🏠 ${escapeAppHtml(homeSummary.theme_name || '默认小屋')}</span>
                                <span class="walk-peer-chip">👀 ${escapeAppHtml(peer.home_visibility === 'private' ? '仅家庭可见' : '好友可见')}</span>
                                <span class="walk-peer-chip">✨ ${escapeAppHtml(petSummary.wins || 0)} 胜</span>
                            </div>
                            <div class="walk-peer-actions">
                                <button class="btn-primary social-mini-btn" type="button" onclick="SocialSystem.openWalkInvite('${peerId}')">🚶 约一起遛弯</button>
                                <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.openPeerHome('${peerId}')" ${canOpenPeerHome(peer) ? '' : 'disabled'}>🏠 去小屋看看</button>
                            </div>
                        </div>
                    `;
                }).join('')
                : '<div class="walk-side-empty">还没有可一起遛弯的好友。先把多个孩子同步到同一个家庭，或去设置里兑换好友码。</div>';
    const inviteMarkup = pendingInvites.length
        ? pendingInvites.map(function(visit) {
            const peerId = escapeAppHtml(visit.peerChildId);
            const visitId = escapeAppHtml(visit.id);
            return `
                <div class="walk-invite-item">
                    <div class="walk-invite-title">📨 ${escapeAppHtml(visit.peerEmoji || '🐾')} ${escapeAppHtml(visit.peerName || '好友')} 邀请你一起遛弯</div>
                    <div class="walk-invite-body">同一路线：${escapeAppHtml(visit.routeName || '好友推荐路线')}</div>
                    <div class="walk-peer-actions">
                        <button class="btn-primary social-mini-btn" type="button" onclick="SocialSystem.acceptWalkInvite('${visitId}')">按同路线遛弯</button>
                        <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.openPeerHome('${peerId}')">先去看看小屋</button>
                    </div>
                </div>
            `;
        }).join('')
        : '<div class="walk-side-note">暂时还没有收到一起遛弯邀请。</div>';
    const socialNoticeMarkup = `
        ${socialState.error ? `<div class="auth-notice auth-error">${escapeAppHtml(socialState.error)}</div>` : ''}
        ${socialState.info ? `<div class="auth-notice auth-info">${escapeAppHtml(socialState.info)}</div>` : ''}
    `;

    root.innerHTML = `
        <section class="walk-home-shell">
            <div class="walk-home-main">
                <div class="walk-scene-stage-wrap">
                    <div id="walk-scene-stage"></div>
                    ${walkBuddyStageMarkup}
                </div>
            </div>
            <aside class="walk-home-side">
                ${walkStatusMarkup}
                <div class="card walk-home-card">
                    <div class="card-header flex items-center justify-between">
                        <h3 class="text-sm font-bold">👫 好友遛弯</h3>
                        <span class="text-xs text-muted">${availablePeers.length} 位</span>
                    </div>
                    <div class="card-body walk-home-social">
                        ${socialNoticeMarkup}
                        <div class="walk-home-social-block">
                            <div class="walk-home-block-title">待回应邀请</div>
                            <div class="walk-home-invites is-compact">${inviteMarkup}</div>
                        </div>
                        <div class="walk-home-social-block">
                            <div class="walk-home-block-title">可约伙伴</div>
                            <div class="walk-home-peer-list is-compact">${walkBuddyMarkup}</div>
                        </div>
                    </div>
                </div>
                <div class="card walk-home-card">
                    <div class="card-header flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-bold">🗺️ 路线与记录</h3>
                            <p class="text-xs text-muted mt-1">在右侧挑路线，在左边大场景里直接互动和出发。</p>
                        </div>
                        <span class="text-xs text-muted">${walkSummary.remaining}/${walkSummary.max}</span>
                    </div>
                    <div class="card-body">
                        <div id="walk-route-panel"></div>
                    </div>
                </div>
            </aside>
        </section>
    `;

    if (window.WalkSystem && typeof WalkSystem.renderUI === 'function') {
        if (typeof WalkSystem.renderAdventureStage === 'function') {
            WalkSystem.renderAdventureStage('walk-scene-stage');
        }
        WalkSystem.renderUI('walk-route-panel');
        if (pendingWalkRouteId && typeof WalkSystem.startWalk === 'function') {
            const routeId = pendingWalkRouteId;
            pendingWalkRouteId = '';
            requestAnimationFrame(function() {
                WalkSystem.startWalk(routeId);
            });
        }
    }
}

window.renderWalkPage = renderWalkPage;

function renderPetPage() {
    const pet = PetSystem.getState();
    const species = PetSystem.getAllSpecies();
    const currentSpecies = pet.species ? species.find(function(item) { return item.id === pet.species; }) : null;

    // 渲染宠物图片（替代emoji）
    const displayImg = document.getElementById('petDisplayImg');
    const poseBtns = document.getElementById('petPoseBtns');
    const nameDisplay = document.getElementById('petNameDisplay');
    const stageDisplay = document.getElementById('petStageDisplay');
    if (pet.species) {
        const sp = currentSpecies;
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

    const levelForecast = document.getElementById('petLevelForecast');
    if (levelForecast) {
        if (!pet.species) {
            levelForecast.textContent = '先认养宠物，成长预测和升级路线就会在这里出现。';
        } else if (pet.level >= PetSystem.MAX_LEVEL) {
            levelForecast.textContent = '已经到达最高等级，现在更适合去宠物小屋互动，或去遛弯页积累冒险记录。';
        } else {
            const needExp = Math.max(0, (PetSystem.EXP_TABLE[pet.level] || 0) - pet.exp);
            levelForecast.textContent = `距离下一等级还差 ${needExp} EXP，升级后会额外提升 HP 和攻击力。`;
        }
    }

    const nextStagePreview = document.getElementById('petNextStagePreview');
    const nextStage = (PetSystem.STAGES || []).find(function(stage) {
        return pet.level < stage.min_level;
    });
    if (nextStagePreview) {
        if (!pet.species) {
            nextStagePreview.innerHTML = '<div class="text-sm text-muted">认养宠物后，这里会显示下一个阶段的形态和解锁等级。</div>';
        } else if (!nextStage) {
            nextStagePreview.innerHTML = `
                <div class="pet-next-stage-card">
                    <div class="pet-next-stage-copy">
                        <strong>👑 已到终极体</strong>
                        <p>现在已经解锁所有成长阶段，可以专心去宠物小屋互动，或者去遛弯页找好友一起冒险。</p>
                    </div>
                </div>
            `;
        } else {
            const previewImage = getPetStageImageForStage(currentSpecies, nextStage.stageIdx);
            const previewClick = previewImage
                ? `onclick="openPetStageImage('${escapeAppJs(previewImage)}','${escapeAppJs(currentSpecies?.name || pet.species_data?.name || '宠物')}','${escapeAppJs(nextStage.name)}','${escapeAppJs(nextStage.emoji || currentSpecies?.emoji || '🐾')}')"`
                : '';
            nextStagePreview.innerHTML = `
                <div class="pet-next-stage-card${previewImage ? ' is-clickable' : ''}" ${previewClick} ${previewImage ? 'role="button" tabindex="0" aria-label="查看下一阶段大图"' : ''}>
                    <div class="pet-next-stage-art">
                        ${previewImage
                            ? `<img src="${escapeAppHtml(previewImage)}" alt="${escapeAppHtml(nextStage.name)}">`
                            : `<div class="pet-next-stage-emoji">${escapeAppHtml(nextStage.emoji || '🐾')}</div>`}
                    </div>
                    <div class="pet-next-stage-copy">
                        <strong>${escapeAppHtml(nextStage.emoji || '✨')} ${escapeAppHtml(nextStage.name)}</strong>
                        <p>达到 Lv.${escapeAppHtml(nextStage.min_level)} 后解锁这个阶段，适合提前看看后面的样子。</p>
                    </div>
                </div>
            `;
        }
    }

    const roadmap = document.getElementById('petGrowthRoadmap');
    if (roadmap) {
        if (!pet.species) {
            roadmap.innerHTML = '<div class="text-sm text-muted">认养宠物后，蛋、幼崽、成长期到终极体的路线会显示在这里。</div>';
        } else {
            roadmap.innerHTML = (PetSystem.STAGES || []).map(function(stage) {
                const isUnlocked = pet.level >= stage.min_level;
                const isCurrent = pet.stage && pet.stage.name === stage.name;
                const stageImage = getPetStageImageForStage(currentSpecies, stage.stageIdx);
                const stageClick = stageImage
                    ? `onclick="openPetStageImage('${escapeAppJs(stageImage)}','${escapeAppJs(currentSpecies?.name || pet.species_data?.name || '宠物')}','${escapeAppJs(stage.name)}','${escapeAppJs(stage.emoji || currentSpecies?.emoji || '🐾')}')"`
                    : '';
                return `
                    <button type="button" class="pet-stage-pill${isUnlocked ? ' is-unlocked' : ''}${isCurrent ? ' is-current' : ''}" ${stageClick} ${stageImage ? '' : 'disabled'}>
                        <div class="pet-stage-pill-art">
                            ${stageImage
                                ? `<img src="${escapeAppHtml(stageImage)}" alt="${escapeAppHtml(stage.name)}">`
                                : `<span>${escapeAppHtml(stage.emoji || '🐾')}</span>`}
                        </div>
                        <div class="pet-stage-pill-copy">
                            <strong>${escapeAppHtml(stage.name)}</strong>
                            <span>${isCurrent ? '当前阶段' : isUnlocked ? '已解锁' : `Lv.${escapeAppHtml(stage.min_level)} 解锁`}</span>
                        </div>
                    </button>
                `;
            }).join('');
        }
    }

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
    const sourceNames = { original: '🌿 PVZ 原版', banchong: '🐹 仓鼠冒险', banchong2: '🐾 萌爪伙伴', banchong2_plant: '🌱 甜芽花园', classpet: '🎨 classpet', minecraft: '⛏️ 我的世界' };
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
        showToast(result.msg);
    } else {
        // 没有宠物粮就回血
        PetSystem.feed({ effect: { hp: 10 } });
        showToast('背包中没有宠物粮，先简单恢复 10 HP');
    }
    if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
        window.CloudSync.scheduleSync('pet_feed_page');
    }
    renderPetPage();
}
function playWithPet() {
    const result = PetSystem.play();
    showToast(result.msg);
    if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
        window.CloudSync.scheduleSync('pet_play_page');
    }
    renderPetPage();
}
function restPet() {
    const result = PetSystem.rest();
    showToast(result.msg);
    if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
        window.CloudSync.scheduleSync('pet_rest_page');
    }
    renderPetPage();
}

// 暴露给全局以支持 WalkSystem 刷新
window.refreshPetUI = function() {
    renderPetPage();
    const walkPage = document.getElementById('page-walk');
    if (walkPage && walkPage.classList.contains('active')) {
        renderWalkPage();
    }
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
    snapshotBattleMilestonesForRun();
    const modal = document.getElementById('battleModal');
    const content = document.getElementById('battleContent');
    modal.classList.add('show');

    const pet = PetSystem.getState();
    const arenaBg = `assets/arena/arena-${battle.chapter || 1}.png`;
    const petImg = (PetSystem.getCurrentStageImage ? PetSystem.getCurrentStageImage() : '') || '';
    const monsterImg = `assets/monsters/${battle.monster.id}.webp`;
    const petName = pet.species_data?.name || '宠物';
    window.removeEventListener('battle-animate', handleBattleAnimate);
    window.addEventListener('battle-animate', handleBattleAnimate);
    content.innerHTML = `
        <div class="battle-arena">
            <img class="battle-arena-bg" src="${arenaBg}" alt="" onerror="this.style.display='none'">
            <div class="battle-encounter-intro">
                <strong>敌人出现</strong>
                <span>${battle.monster.name} 挡住了去路</span>
            </div>
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
                <div class="battle-hp-card">
                    <div class="battle-hp-name">${petName}</div>
                    <div class="hp-bar"><div class="hp-fill" style="width:${(pet.hp / pet.total_max_hp) * 100}%"></div></div>
                    <div class="battle-hp-value">${pet.hp}/${pet.total_max_hp}</div>
                </div>
                <div class="battle-hp-card">
                    <div class="battle-hp-name">${battle.monster.name}</div>
                    <div class="hp-bar"><div class="hp-fill" style="width:${(battle.monster.current_hp / battle.monster.hp) * 100}%"></div></div>
                    <div class="battle-hp-value">${battle.monster.current_hp}/${battle.monster.hp}</div>
                </div>
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
        <div class="battle-action-hint">选择技能，帮宠物突破这一关</div>
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

function renderBattleResultGuide(battle) {
    const guide = battle && battle.guidedFeedback;
    if (!guide || battle.status !== 'lost') return '';
    return `
        <div class="battle-result-guide">
            <strong>复盘</strong>
            <p>${escapeAppHtml(guide.note || '')}</p>
            <strong>下一步</strong>
            <p>${escapeAppHtml(guide.nextStep || '')}</p>
        </div>
    `;
}

function renderBattleResultRewardSummary(battle) {
    if (!battle || battle.status !== 'won') return '';
    const rewardLines = Array.isArray(battle.log)
        ? battle.log.filter((item) => item && item.type === 'reward').slice(-3).map((item) => item.text || '')
        : [];
    if (!rewardLines.length) return '';
    return `
        <div class="battle-result-reward-box">
            <strong>本局收获</strong>
            <p>${escapeAppHtml(rewardLines.join(' · '))}</p>
        </div>
    `;
}

function renderBattleResultHero(battle) {
    if (!battle) return '';
    const isWin = battle.status === 'won';
    const statusLabel = isWin ? '胜利结算' : battle.status === 'lost' ? '战斗结束' : '探索完成';
    const headline = isWin ? '这一场已经稳稳拿下' : battle.status === 'lost' ? '先收住，再准备下一次出发' : '这次外出已经记进旅程';
    return `
        <div class="battle-result-hero ${isWin ? 'win' : 'lose'}">
            <span class="battle-result-kicker">${statusLabel}</span>
            <strong>${headline}</strong>
        </div>
    `;
}

function renderBattleEndActions(battle) {
    const label = battle.status === 'won' ? '🎉 继续探索' : battle.status === 'lost' ? '回到宠物页' : '继续探索';
    return `
        ${renderBattleResultHero(battle)}
        ${renderBattleResultRewardSummary(battle)}
        ${renderBattleMilestoneUnlockSummary(battle && battle.newMilestones, { compact: true })}
        ${renderBattleResultGuide(battle)}
        <button class="btn-primary" onclick="closeBattleModal()">${label}</button>
    `;
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

    if (result.status === 'won' || result.status === 'lost' || result.status === 'fled') {
        result.newMilestones = consumeBattleMilestoneUnlocksForRun();
        if (result.status === 'won' && typeof window.recordBattleRecentActivity === 'function') {
            const rewardText = Array.isArray(result.log)
                ? result.log.filter((item) => item && item.type === 'reward').slice(-2).map((item) => item.text).join(' · ')
                : '';
            window.recordBattleRecentActivity({
                id: `explore_${Date.now()}`,
                mode: 'explore',
                title: `探索胜利 · ${result.monster && result.monster.name ? result.monster.name : '遭遇战'}`,
                detail: rewardText || '完成一场探索遭遇战'
            });
        }
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
        actionsEl.innerHTML = renderBattleEndActions(result);
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
    const values = modal ? modal.querySelectorAll('.battle-hp-value') : [];
    if (values.length >= 1) {
        values[0].textContent = `${pet.hp}/${pet.total_max_hp}`;
    }
    if (values.length >= 2) {
        values[1].textContent = `${battle.monster.current_hp}/${battle.monster.hp}`;
    }
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
    const damageZone = document.getElementById('battleDamageZone');
    if (window.BattleFx && typeof BattleFx.show === 'function') BattleFx.show(type, e.detail);
    const spec = window.BattleFx && typeof window.BattleFx.getEffectSpec === 'function'
        ? window.BattleFx.getEffectSpec(type, e.detail)
        : null;
    const play = (name) => {
        if (window.sfx && typeof window.sfx.play === 'function') window.sfx.play(name);
    };
    const pulse = (el, className, duration) => {
        if (!el) return;
        el.classList.remove(className);
        void el.offsetWidth;
        el.classList.add(className);
        setTimeout(() => el.classList.remove(className), duration || 500);
    };
    const clearMotion = () => {
        [petEl, monsterEl, damageZone, modal].forEach((el) => {
            if (!el) return;
            el.classList.remove(
                'battle-motion-approach',
                'battle-motion-approach-left',
                'battle-motion-approach-right',
                'battle-motion-impact',
                'battle-motion-impact-style-dash',
                'battle-motion-impact-style-pounce',
                'battle-motion-impact-style-arc',
                'battle-motion-impact-style-burst',
                'battle-motion-contact-flare',
                'battle-motion-ground-ring',
                'battle-motion-impact-shockwave',
                'battle-motion-recoil',
                'battle-motion-recoil-left',
                'battle-motion-recoil-right',
                'battle-motion-slam',
                'battle-motion-style-dash',
                'battle-motion-style-pounce',
                'battle-motion-style-arc',
                'battle-motion-style-burst',
                'battle-motion-afterimage',
                'battle-motion-stage-impact-focus'
            );
        });
    };
    const motion = (attacker, defender, style) => {
        const attackerEl = attacker === 'pet' ? petEl : monsterEl;
        const defenderEl = defender === 'pet' ? petEl : monsterEl;
        const approachSide = attacker === 'pet' ? 'battle-motion-approach-right' : 'battle-motion-approach-left';
        const recoilSide = defender === 'pet' ? 'battle-motion-recoil-left' : 'battle-motion-recoil-right';
        const impactStyle = style === 'burst'
            ? 'battle-motion-impact-style-burst'
            : style === 'arc'
                ? 'battle-motion-impact-style-arc'
                : style === 'pounce'
                    ? 'battle-motion-impact-style-pounce'
                    : 'battle-motion-impact-style-dash';
        clearMotion();
        if (attackerEl) {
            attackerEl.classList.add('battle-motion-approach', approachSide, 'battle-motion-afterimage');
            if (style) attackerEl.classList.add(`battle-motion-style-${style}`);
        }
        if (modal) modal.classList.add('battle-motion-stage-impact-focus');
        setTimeout(() => {
            if (damageZone) damageZone.classList.add('battle-motion-impact', impactStyle);
            if (defenderEl) {
                defenderEl.classList.add('battle-motion-impact', impactStyle, 'battle-motion-contact-flare', 'battle-motion-ground-ring', 'battle-motion-impact-shockwave');
                defenderEl.classList.add('battle-motion-recoil', 'battle-motion-slam', recoilSide);
                if (style) defenderEl.classList.add(`battle-motion-style-${style}`);
            }
        }, style === 'burst' ? 170 : 130);
        setTimeout(clearMotion, 860);
    };

    if (type === 'battle-start') {
        play('battleStart');
        pulse(modal, 'battle-cast', 520);
    } else if (type === 'player-attack') {
        play('dashWhoosh');
        play('playerAttack');
        motion((spec && spec.attacker) || 'pet', (spec && spec.defender) || 'monster', (spec && spec.motionStyle) || 'dash');
        // 玩家攻击 → 怪物受击抖动
        if (e.detail.damage) showBattleDamage(e.detail.damage, 'monster');
        if (e.detail.damage) play('battleImpact');
        pulse(monsterEl, 'battle-hit', 500);
    } else if (type === 'skill-cast') {
        play('dashWhoosh');
        play('skillCast');
        motion((spec && spec.attacker) || 'pet', (spec && spec.defender) || 'monster', (spec && spec.motionStyle) || 'arc');
        if (e.detail.damage) showBattleDamage(e.detail.damage, 'monster');
        if (e.detail.damage) play('battleImpact');
        pulse(petEl, 'battle-cast', 520);
        pulse(monsterEl, 'battle-hit', 500);
    } else if (type === 'defend') {
        play('defend');
        play('shieldSpark');
        pulse(petEl, 'battle-guard', 650);
    } else if (type === 'item-use') {
        play('itemUse');
        if (e.detail.heal) play('healPulse');
        play('shieldSpark');
        pulse(petEl, 'battle-guard', 650);
    } else if (type === 'enemy-attack') {
        play('dashWhoosh');
        play('enemyAttack');
        motion((spec && spec.attacker) || 'monster', (spec && spec.defender) || 'pet', (spec && spec.motionStyle) || 'pounce');
        // 敌人攻击 → 宠物受击抖动 + 红闪
        if (e.detail.damage) showBattleDamage(e.detail.damage, 'pet');
        if (e.detail.damage) {
            play('battleImpact');
            play('stunPop');
        }
        pulse(petEl, 'battle-hit', 500);
        if (modal) {
            pulse(modal, 'battle-flash-red', 500);
        }
    } else if (type === 'battle-win') {
        play('roundWinCue');
        play('battleWin');
        play('rewardFanfare');
        play('victoryBurst');
        pulse(modal, 'battle-win-glow', 900);
    } else if (type === 'battle-lose') {
        play('roundLoseCue');
        play('battleLose');
        play('faintDrop');
        pulse(modal, 'battle-lose-dim', 900);
    }
}

function playGlobalSfx(name) {
    if (window.sfx && typeof window.sfx.play === 'function') {
        window.sfx.play(name);
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
        actionsEl.innerHTML = renderBattleEndActions(battle);
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
    window.removeEventListener('battle-animate', handleBattleAnimate);
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
    playGlobalSfx('itemInspect');
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
    playGlobalSfx('levelup');
    playGlobalSfx('rewardClaim');
    playGlobalSfx('victoryBurst');

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
    const activePage = getActivePageId();
    renderTaskGrid();
    renderSidebarTasks();
    updateStats();
    renderGrowthStickerReport();
    renderReviewBattleBoard();
    if (activePage === 'learning-sheet' && window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('points-learning-sheet-container');
    }
    renderPetPage();
    renderInventoryPage();
    if (activePage === 'explore' && window.ExplorationSystem) void renderExplorePage();
    if (activePage === 'playground') renderPlaygroundProgressBoard();
    if (activePage === 'map' && window.ExplorationSystem && document.getElementById('sceneGridMap')) ExplorationSystem.renderSceneGridMap();
    if (activePage === 'shop' && window.ShopSystem) ShopSystem.renderUI('shop-ui');
    if (activePage === 'works') renderGrowthWorksPage();
    if (window.lucide) lucide.createIcons();
}

window.totalPoints = totalPoints;
window.updateStats = updateStats;
window.updateTopPoints = updateTopPoints;
window.addGrowthPoints = addGrowthPoints;
window.spendPoints = spendPoints;
window.redeemFamilyReward = redeemFamilyReward;
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
window.handleSettingsNavClick = handleSettingsNavClick;
window.saveGrowthWork = saveGrowthWork;
window.removeGrowthWork = removeGrowthWork;
window.renderAll = renderAll;
window.saveAppState = saveAppState;

// ============ 初始化 ============
async function init() {
    const initialRoute = resolveRouteFromLocation(window.location);
    if (initialRoute.page === 'settings') {
        activeSettingsSection = normalizeSettingsSection(initialRoute.settingsSection);
    }
    const needsCloudBootstrap = ['settings', 'parent'].includes(initialRoute.page);
    if (window.RuntimeLoader && typeof window.RuntimeLoader.ensureCloudFeature === 'function' && needsCloudBootstrap) {
        try {
            await window.RuntimeLoader.ensureCloudFeature();
        } catch (error) {
            console.warn('[app] cloud feature preload failed:', error);
        }
    }
    if (window.CloudRestore && typeof window.CloudRestore.hydrateFromCloud === 'function') {
        try {
            await window.CloudRestore.hydrateFromCloud();
        } catch (error) {
            console.warn('[app] cloud restore failed during init:', error);
        }
    }
    if (window.ProfileManager && typeof ProfileManager.ensureDefault === 'function') {
        ProfileManager.ensureDefault();
    }
    if (window.ProfileUI && typeof ProfileUI.render === 'function') {
        ProfileUI.render();
    }
    loadAppState();
    PetSystem.load();
    InventorySystem.load();
    await InventorySystem.loadItemsData();
    await loadPointItems();
    updateRewardPetCard();
    // 宠物小屋 decay 补算（R4：PetSystem 加载后，若 last_home_ts 存在则结算离线衰减）
    // decay() 内部结算后会立即写 last_home_ts=now，保证后续 switchPage('home')→renderUI 再算幂等
    if (typeof PetSystem.decay === 'function' && PetSystem.getState().last_home_ts) {
        PetSystem.decay();
    }
    renderAll();
    // 初始化宝箱系统
    if (window.TreasureChest) TreasureChest.init();
    switchPage(initialRoute.page, {
        settingsSection: initialRoute.settingsSection,
        replace: true
    });
    if (window.lucide) lucide.createIcons();
}

window.addEventListener('DOMContentLoaded', init);
window.addEventListener('popstate', function () {
    const route = resolveRouteFromLocation(window.location);
    switchPage(route.page, {
        settingsSection: route.settingsSection,
        replace: true,
        updateHistory: false
    });
});
