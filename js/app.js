/**
 * app.js - 主应用入口，整合所有系统
 * 负责：任务系统、积分系统、页面切换、UI 渲染
 */

const taskCatalog = window.PetBankTaskCatalog;
if (!taskCatalog) throw new Error('[app] task catalog failed to load');
const { DIMENSIONS, HOME_PRIORITY_TASKS, POINT_TASK_ART, getPointTaskArt } = taskCatalog;

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
    if (window.PetBankTime && typeof window.PetBankTime.localDate === 'function') {
        return window.PetBankTime.localDate();
    }
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
    if (window.ProfileManager && typeof window.ProfileManager.requestHighPrioritySync === 'function') {
        window.ProfileManager.requestHighPrioritySync('points');
    }
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
    const wasCompleted = completedTasks.has(tid);
    const pointDelta = wasCompleted
        ? -Math.max(0, Math.floor(Number(pts) || 0))
        : Math.max(0, Math.floor(Number(pts) || 0));
    if (completedTasks.has(tid)) {
        completedTasks.delete(tid);
    } else {
        completedTasks.add(tid);
    }
    if (pointDelta) addGrowthPoints(pointDelta);
    if (window.TaskRewardEvents && typeof window.TaskRewardEvents.record === 'function') {
        window.TaskRewardEvents.record({
            profileId: window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function' ? window.ProfileManager.getActiveId() : 'local',
            date: typeof getLocalDateKey === 'function' ? getLocalDateKey() : new Date().toLocaleDateString(),
            taskId: tid,
            points: pts,
            operation: wasCompleted ? 'undo' : 'complete'
        });
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

function formatScheduledCheckinDate(dateKey) {
    const date = new Date(`${dateKey}T12:00:00`);
    if (Number.isNaN(date.getTime())) return dateKey;
    const weekday = ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    return `${date.getMonth() + 1}月${date.getDate()}日 · 周${weekday}`;
}

function renderScheduledCheckins() {
    const timeline = document.getElementById('scheduledCheckinTimeline');
    if (!timeline || !window.ScheduledCheckins || typeof window.ScheduledCheckins.getToday !== 'function') return;

    const items = window.ScheduledCheckins.getToday({ now: new Date() });
    const completed = items.filter((item) => item.completed).length;
    const rewardPoints = items.reduce((sum, item) => sum + (item.completed ? Number(item.points || 0) : 0), 0);
    const dateKey = items[0]?.date || getLocalDateKey();
    const dateEl = document.getElementById('scheduledCheckinDate');
    const summaryEl = document.getElementById('scheduledCheckinSummary');
    const progressText = document.getElementById('scheduledCheckinProgressText');
    const progressBar = document.getElementById('scheduledCheckinProgressBar');
    if (dateEl) dateEl.textContent = formatScheduledCheckinDate(dateKey);
    if (progressText) progressText.textContent = `${completed} / ${items.length} 已完成`;
    if (progressBar) progressBar.style.width = `${Math.round((completed / Math.max(1, items.length)) * 100)}%`;

    const activeItem = items.find((item) => item.status === 'active');
    const nextItem = items.find((item) => item.status === 'upcoming');
    if (summaryEl) {
        summaryEl.textContent = activeItem
            ? `现在是「${activeItem.title}」时间，完成后可以领取 ${activeItem.points > 0 ? `+${activeItem.points} 成长分` : '今日的小成就'}。`
            : nextItem
                ? `下一项是 ${nextItem.start} 开始的「${nextItem.title}」，先准备好就很棒。`
                : `今天已经完成 ${completed} 项，${rewardPoints > 0 ? `收下了 ${rewardPoints} 成长分。` : '给自己一个轻松的收尾。'}`;
    }

    const statusText = { active: '现在进行中', upcoming: '即将开始', completed: '已完成', missed: '已错过，可补记' };
    timeline.innerHTML = items.map((item) => {
        const buttonLabel = item.completed ? '已打卡' : item.status === 'upcoming' ? '未开始' : item.status === 'missed' ? '补记' : '完成打卡';
        const buttonDisabled = item.completed || item.status === 'upcoming';
        const pointText = item.points > 0 ? `+${item.points} 分` : '自由记录';
        return `
            <article class="scheduled-checkin-item is-${item.status} ${item.late ? 'is-late' : ''}">
                <div class="scheduled-checkin-rail" aria-hidden="true"><span></span></div>
                <div class="scheduled-checkin-time"><span>${item.start}</span><small>${item.end}</small></div>
                <div class="scheduled-checkin-card">
                    <div class="scheduled-checkin-card-icon"><i data-lucide="${item.icon}" class="w-4 h-4" aria-hidden="true"></i></div>
                    <div class="scheduled-checkin-copy">
                        <div class="scheduled-checkin-card-top"><strong>${escapePiHtml(item.title)}</strong><span>${statusText[item.status] || ''}</span></div>
                        <p>${escapePiHtml(item.subtitle)}</p>
                        <div class="scheduled-checkin-meta"><span>${escapePiHtml(item.tag)}</span><em>${pointText}</em>${item.late ? '<small>补记不发分</small>' : ''}</div>
                    </div>
                    <button class="scheduled-checkin-action" type="button" onclick="completeScheduledCheckin('${item.id}')" ${buttonDisabled ? 'disabled' : ''}>${buttonLabel}</button>
                </div>
            </article>
        `;
    }).join('');
    if (window.lucide) lucide.createIcons();
}

function completeScheduledCheckin(itemId) {
    if (!window.ScheduledCheckins || typeof window.ScheduledCheckins.complete !== 'function') return;
    const result = window.ScheduledCheckins.complete(itemId, { now: new Date() });
    if (result.accepted) {
        const message = result.late ? '已补记这项作息，补记不发成长分。' : result.points > 0 ? `打卡成功，成长分 +${result.points}！` : '打卡成功，给自己一个小小的肯定。';
        if (typeof window.showToast === 'function') window.showToast(message);
        renderAll();
        return;
    }
    if (result.duplicate) {
        if (typeof window.showToast === 'function') window.showToast('这一项今天已经打卡过啦。');
        renderAll();
        return;
    }
    const messages = { 'not-open': '这项还没开始，先等到时间再来打卡。', storage: '打卡没有保存成功，请稍后重试。', 'reward-unavailable': '奖励服务暂时不可用，打卡没有完成。' };
    if (typeof window.showToast === 'function') window.showToast(messages[result.reason] || '这项暂时无法打卡，请稍后重试。');
    renderAll();
}

function renderHomeDemoTaskMirror() {
    const container = document.getElementById('homeDemoTaskMirror');
    if (!container) return;
    container.innerHTML = HOME_PRIORITY_TASKS.map((task) => {
        const taskId = `${task.dim}-${task.task}`;
        const done = completedTasks.has(taskId);
        return `
            <button class="home-demo-task-item ${done ? 'is-done' : ''}" type="button" onclick="toggleTask('${task.dim}', '${task.task}', ${task.pts})">
                <span class="home-demo-task-check" aria-hidden="true">${done ? '✓' : ''}</span>
                <span class="home-demo-task-copy"><strong>${escapePiHtml(task.task)}</strong><small>${escapePiHtml(task.hint)}</small></span>
                <span class="home-demo-task-points">+${task.pts}</span>
            </button>
        `;
    }).join('');
}

function updateHomeDemoSummary() {
    const totalTasks = HOME_PRIORITY_TASKS.length;
    const completedCount = HOME_PRIORITY_TASKS.filter((task) => completedTasks.has(`${task.dim}-${task.task}`)).length;
    const percent = Math.round((completedCount / Math.max(1, totalTasks)) * 100);
    const focusTask = getHomeFocusTask();
    const petState = (window.PetSystem && typeof PetSystem.getState === 'function') ? PetSystem.getState() : null;
    const profile = (window.ProfileManager && typeof ProfileManager.getActive === 'function') ? ProfileManager.getActive() : null;
    const values = {
        homeDemoChildName: profile?.name || '默认孩子',
        homeDemoPoints: String(totalPoints),
        homeDemoPetLevel: `Lv.${petState?.level || 1}`,
        homeDemoWins: String(petState?.wins || 0),
        homeDemoFocusTitle: focusTask.task,
        homeDemoFocusMeta: completedTasks.has(`${focusTask.dim}-${focusTask.task}`) ? '今天的优先任务已完成，可以自由探索。' : `完成后拿 ${focusTask.pts} 分，${focusTask.hint}`,
        homeDemoTodayCount: `${completedCount} / ${totalTasks}`,
        homeDemoTodayPercent: `${percent}%`,
        homeDemoRailToday: `${completedCount} / ${totalTasks}`,
        homeDemoRailPoints: String(totalPoints),
        homeDemoOverallPercent: `${percent}%`
    };
    Object.entries(values).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = value;
    });
    ['homeDemoTodayMeter', 'homeDemoOverallMeter'].forEach((id) => {
        const meter = document.getElementById(id);
        if (meter) meter.style.width = `${percent}%`;
    });
    const companionImg = document.getElementById('homeDemoCompanionImg');
    const companionName = document.getElementById('homeDemoCompanionName');
    const companionStage = document.getElementById('homeDemoCompanionStage');
    if (companionImg && petState && typeof PetSystem.getCurrentStageImage === 'function') {
        const stageImage = PetSystem.getCurrentStageImage();
        if (stageImage) companionImg.src = stageImage;
        else if (getActivePageId() === 'map') companionImg.src = 'assets/pets/poses/dog_idle.webp';
        else companionImg.removeAttribute('src');
    }
    if (companionName) companionName.textContent = petState?.species_data?.name || petState?.species || '还没有领养宠物';
    if (companionStage) companionStage.textContent = petState?.species ? `Lv.${petState.level || 1} · 继续一起冒险` : '下一站会显示在这里';
}

function activateHomeDemoImages() {
    document.querySelectorAll('#homeCommonEntries img[data-home-src]').forEach((image) => {
        if (image.getAttribute('src')) return;
        const rawSource = image.dataset.homeSrc;
        if (!rawSource) return;
        image.src = typeof window.resolvePetBankAssetUrl === 'function'
            ? window.resolvePetBankAssetUrl(rawSource)
            : rawSource;
    });
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
const LEARNING_ARCADE_SETTINGS_KEY = 'petbank_learning_arcade_settings_v1';
const LEARNING_ARCADE_SETTINGS_LEGACY_KEY = 'learning-arcade-settings-v1';
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
        title: `单词跑酷通关 · ${lastLevelOrder > 0 ? `第 ${lastLevelOrder} 关` : '大地图'}`,
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
        window.PetBankStorageMigrations?.migrateKey(
            localStorage,
            LEARNING_ARCADE_SETTINGS_LEGACY_KEY,
            LEARNING_ARCADE_SETTINGS_KEY
        );
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
const GUIDED_FEEDBACK_HISTORY_KEY = 'petbank_guided_feedback_history';

function readGuidedFeedbackHistory() {
    try {
        const raw = JSON.parse(localStorage.getItem(GUIDED_FEEDBACK_HISTORY_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    } catch (_) {
        return [];
    }
}

function recordGuidedFeedback(entry) {
    if (!entry || !entry.mode || !entry.nextStep) return;
    const next = readGuidedFeedbackHistory();
    next.unshift({
        id: entry.id || `guided_feedback_${Date.now()}`,
        mode: entry.mode,
        cause: entry.cause || 'unknown',
        note: entry.note || '',
        nextStep: entry.nextStep,
        timestamp: entry.timestamp || new Date().toISOString()
    });
    try {
        localStorage.setItem(GUIDED_FEEDBACK_HISTORY_KEY, JSON.stringify(next.slice(0, 12)));
    } catch (_) {}
}

window.readGuidedFeedbackHistory = readGuidedFeedbackHistory;
window.recordGuidedFeedback = recordGuidedFeedback;

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
        : '';
    if (stageImage) companionImg.src = stageImage;
    else if (getActivePageId() === 'map') companionImg.src = 'assets/pets/poses/dog_idle.webp';
    else companionImg.removeAttribute('src');

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

function getGrowthPoints() {
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
    if (img) {
        if (stage) img.src = stage;
        else if (getActivePageId() === 'reward') img.src = 'assets/pets/poses/dog_idle.webp';
        else img.removeAttribute('src');
    }
    const p = (window.ProfileManager && typeof ProfileManager.getActive === 'function') ? ProfileManager.getActive() : null;
    if (childName) childName.textContent = (p && p.name) ? p.name : '宝贝';
    const pet = (window.PetSystem && typeof PetSystem.getState === 'function') ? PetSystem.getState() : null;
    if (petName) petName.textContent = (pet && pet.name) ? pet.name : '点击伙伴开启奖惩';
    if (cur) cur.textContent = (window.totalPoints != null) ? window.totalPoints : 0;
}

function completeRecommended() {
    let addedPoints = 0;
    HOME_PRIORITY_TASKS.forEach(s => {
        const tid = `${s.dim}-${s.task}`;
        if (!completedTasks.has(tid)) {
            completedTasks.add(tid);
            addedPoints += Math.max(0, Math.floor(Number(s.pts) || 0));
        }
    });
    if (addedPoints) addGrowthPoints(addedPoints);
    localStorage.setItem('petbank_tasks_completed_today', String(completedTasks.size));
    saveAppState();
    renderAll();
}

const SETTINGS_SECTION_LABELS = {
    home: '设置首页',
    account: '家庭与孩子',
    family: '家庭与孩子',
    learning: '学习与题目',
    rules: '规则模板',
    advanced: '高级与危险操作'
};

let activeSettingsSection = 'family';

function getHomeTabMap() { return window.PetBankPageRouter.getHomeTabMap(); }
function normalizeSettingsSection(section) { return window.PetBankPageRouter.normalizeSettingsSection(section); }
function getPageToTab(page) { return window.PetBankPageRouter.getPageToTab(page); }
function withRouteBase(routePath) { return window.PetBankPageRouter.withRouteBase(routePath, window.location.pathname); }
function resolveRouteFromLocation(locationLike) { return window.PetBankPageRouter.resolveRouteFromLocation(locationLike); }
function updateBrowserRoute(page, options = {}) {
    const router = window.PetBankPageRouter;
    if (!router.canUsePathRouting() || options.updateHistory === false) return;
    const path = withRouteBase(router.getPathForPage(page, options.settingsSection || activeSettingsSection));
    const search = window.location.search || '';
    const nextUrl = `${path}${search}`;
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (nextUrl === currentUrl) return;
    const state = { page, settingsSection: options.settingsSection || null };
    if (options.replace) window.history.replaceState(state, '', nextUrl);
    else window.history.pushState(state, '', nextUrl);
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

function applyRouteShell(page) {
    const router = window.PetBankPageRouter;
    const shell = router.getRouteShell(page);
    const tabPage = router.getPageToTab(page);
    const dockPage = router.getAppDockPage(page);
    const parentNavKey = router.getParentShellNavKey(page);
    document.body.classList.toggle('shell-home', shell === 'home');
    document.body.classList.toggle('shell-app', shell === 'app');
    document.body.classList.toggle('shell-parent', shell === 'parent');
    document.body.classList.toggle('map-page-bg', page === 'map');
    document.body.setAttribute('data-route-shell', shell);
    if (shell === 'app') {
        document.body.dataset.appPage = tabPage;
        document.body.dataset.appRoutePage = page;
        document.body.dataset.appSurface = router.getAppShellSurface(page);
    } else {
        delete document.body.dataset.appPage;
        delete document.body.dataset.appRoutePage;
        delete document.body.dataset.appSurface;
    }
    document.querySelectorAll('[data-app-dock]').forEach((item) => {
        item.classList.toggle('is-current', item.dataset.appDock === dockPage);
        item.setAttribute('aria-current', item.dataset.appDock === dockPage ? 'page' : 'false');
    });
    document.querySelectorAll('[data-parent-shell-nav]').forEach((item) => {
        item.classList.toggle('is-current', item.dataset.parentShellNav === parentNavKey);
        item.setAttribute('aria-current', item.dataset.parentShellNav === parentNavKey ? 'page' : 'false');
    });
    syncRouteShellStatus();
    if (window.ChildWorkbenchShell && typeof window.ChildWorkbenchShell.sync === 'function') {
        window.ChildWorkbenchShell.sync(page);
    }
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
    const moreSettings = document.querySelector('#page-settings .settings-subpage-nav-more');
    if (moreSettings) {
        moreSettings.open = ['learning', 'rules', 'advanced'].includes(activeSettingsSection);
    }
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
            account: '先登录家长账号，再创建或加入家庭，最后添加孩子。',
            family: '先登录家长账号，再创建或加入家庭，最后添加孩子。',
            learning: '默认设置可以直接使用。需要调整时，再选择学习单或数学 PK 难度。',
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
        { page: 'word-memory-map', label: '单词跑酷' },
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

function continueLocalPageNavigation(page, options) {
    return switchPage(page, Object.assign({}, options, { skipAccessGate: true }));
}

function isLocalTestMode() {
    return window.__PETBANK_TEST_MODE__ === true
        && ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname);
}

function guardPageAccess(page, options) {
    const api = window.SelfHostedApi;
    if (!api || typeof api.checkAccess !== 'function') return continueLocalPageNavigation(page, options);
    if (isLocalTestMode()) return continueLocalPageNavigation(page, options);
    return api.checkAccess().then(() => continueLocalPageNavigation(page, options)).catch((error) => {
        const isLocalOnly = error && (
            error.status === 404 ||
            error.status === 405 ||
            (error.status === 200 && error.code === 'INVALID_RESPONSE')
        );
        if (isLocalOnly) return continueLocalPageNavigation(page, options);

        if (typeof api.clearSession === 'function') api.clearSession();
        if (typeof window.showToast === 'function') {
            window.showToast(error?.status === 401 || error?.status === 403
                ? '当前账号未授权或授权已失效，请先登录。'
                : '授权服务暂时不可用，核心页面已锁定。');
        }
        return switchPage('parent', { skipAccessGate: true, replace: true });
    });
}

function switchPage(page, options = {}) {
    const router = window.PetBankPageRouter;
    if (!options.skipAccessGate && router && typeof router.requiresAccess === 'function' && router.requiresAccess(page, options.settingsSection || activeSettingsSection)) {
        return guardPageAccess(page, options);
    }
    closeSectionMenus();
    closeTopHubMenus();
    if (window.ScheduledCheckins) {
        if (page === 'today' && typeof window.ScheduledCheckins.startTicker === 'function') {
            window.ScheduledCheckins.startTicker(() => {
                if (getActivePageId() === 'today') renderScheduledCheckins();
            });
        } else if (page !== 'today' && typeof window.ScheduledCheckins.stopTicker === 'function') {
            window.ScheduledCheckins.stopTicker();
        }
    }
    if (page !== 'playground' && document.body.classList.contains('card-arena-shell-active')) {
        document.body.classList.remove('card-arena-shell-active');
        const shellBar = document.getElementById('playgroundArenaShellBar');
        if (shellBar) shellBar.hidden = true;
    }
    if (page === 'settings') {
        activeSettingsSection = normalizeSettingsSection(options.settingsSection || activeSettingsSection || 'family');
    }
    // 离开宠物小屋：标记 exit（写 last_home_ts，下次进入结算）
    const prevPageEl = document.querySelector('.page.active');
    const prevPage = prevPageEl ? prevPageEl.id.replace('page-', '') : null;
    if (prevPage === 'home' && page !== 'home' && window.PetSystem && typeof PetSystem.markHomeExit === 'function') {
        PetSystem.markHomeExit();
    }
    if ((prevPage === 'explore' || prevPage === 'forest-map') && page !== prevPage && window.VoiceSystem && typeof VoiceSystem.stop === 'function') {
        VoiceSystem.stop();
    }
    if (prevPage === 'tools' && page !== 'tools' && window.ToolboxSystem && typeof ToolboxSystem.destroy === 'function') {
        ToolboxSystem.destroy();
    }
    if (prevPage === 'walk' && page !== 'walk' && window.WalkSystem && typeof WalkSystem.cancelActiveWalk === 'function') {
        WalkSystem.cancelActiveWalk();
    }
    if (prevPage === 'hanzi' && page !== 'hanzi' && window.HanziGame && typeof HanziGame.stop === 'function') {
        HanziGame.stop();
    }
    if (prevPage === 'mathpk' && page !== 'mathpk' && window.MathPKGame && typeof MathPKGame.stop === 'function') {
        MathPKGame.stop();
    }
    if (prevPage === 'card' && page !== 'card' && window.CardArenaUI && typeof CardArenaUI.stop === 'function') {
        CardArenaUI.stop();
    }
    if (prevPage === 'minecraft-vocab' && page !== 'minecraft-vocab' && window.MinecraftVocabPage && typeof MinecraftVocabPage.stop === 'function') {
        MinecraftVocabPage.stop();
    }
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`page-${page}`);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-hub').forEach(h => h.classList.remove('active'));
    // 叶子页（如 today/review/mathpk/shop…）没有独立 tab，按 PAGE_TO_TAB 高亮其父 tab
    const tabPage = getPageToTab(page);
    const tab = document.querySelector(`.nav-tab[data-page="${tabPage}"]`);
    if (tab) {
        tab.classList.add('active');
        const hub = tab.closest('.nav-hub');
        if (hub) hub.classList.add('active');
    }
    applyRouteShell(page);
    // 首页保留侧栏状态感；其他 tab 继续沿用全宽内容页。
    document.body.classList.toggle('no-sidebar', page !== 'map');
    document.body.classList.toggle('learn-mode', page === 'learn' || page === 'minecraft-vocab' || page.startsWith('learn-'));
    document.body.classList.toggle('picturebooks-route', page === 'picturebooks');
    document.body.classList.toggle('pixel-story-page-route', page === 'explore');
    document.body.classList.toggle('forest-map-page-route', page === 'forest-map');
    const exploreMapSwitcher = document.getElementById('exploreMapSwitcher');
    if (exploreMapSwitcher) {
        const visible = page === 'explore' || page === 'forest-map';
        exploreMapSwitcher.hidden = !visible;
        exploreMapSwitcher.querySelectorAll('[data-explore-map]').forEach((item) => {
            const active = item.dataset.exploreMap === (page === 'forest-map' ? 'forest' : 'story');
            item.classList.toggle('is-current', active);
            item.setAttribute('aria-selected', active ? 'true' : 'false');
        });
    }
    if (window.HomeShowcase && typeof window.HomeShowcase.setActive === 'function') {
        window.HomeShowcase.setActive(page === 'map');
    }
    updateBrowserRoute(page, {
        settingsSection: page === 'settings' ? activeSettingsSection : null,
        replace: options.replace === true,
        updateHistory: options.updateHistory
    });
    if (page === 'settings') applySettingsSection(activeSettingsSection);
    // 暴露页面激活 Promise，调用方可在需要时等待 runtime 和首屏渲染完成。
    // 未等待返回值的现有 inline handler 仍保持原有行为。
    const pageReady = preparePage(page);
    window.sfx && sfx.click();
    return pageReady;
}

window.switchPage = switchPage;

window.addEventListener('petbank:exploration-stage-exit', function (event) {
    const target = event.detail?.returnTarget || 'forest-map';
    if (target === 'forest-map') {
        void switchPage('forest-map', { skipAccessGate: true });
        return;
    }
    if (target === 'explore-story-map') {
        void switchPage('explore', { skipAccessGate: true });
        return;
    }
    if (target === 'forest-map') {
        void switchPage('forest-map', { skipAccessGate: true });
    }
});

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
    if (childNameEl) {
        const activeProfile = window.ProfileManager && typeof ProfileManager.getActive === 'function'
            ? ProfileManager.getActive()
            : null;
        const fallbackName = document.getElementById('profileCurName')?.textContent || '默认孩子';
        childNameEl.textContent = activeProfile && activeProfile.name ? activeProfile.name : fallbackName;
    }
    const householdNameEl = document.getElementById('parentShellHouseholdName');
    if (householdNameEl) {
        const accountState = window.ParentAccountUI && typeof window.ParentAccountUI.getState === 'function'
            ? window.ParentAccountUI.getState()
            : null;
        const activeHousehold = accountState?.households?.find(item => item.id === accountState.activeHouseholdId);
        householdNameEl.textContent = activeHousehold?.name || (accountState?.account ? '未选择家庭' : '本机家庭');
    }
}
window.updateParentHomePage = updateParentHomePage;

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
        const receiptService = window.GameRewardReceipts && typeof window.GameRewardReceipts.claim === 'function'
            ? window.GameRewardReceipts
            : null;
        if (receiptService) {
            const receipt = receiptService.claim({
                profileId: getActiveDailyProfileId(),
                source: 'typing-defense',
                eventId: `${sessionId}:${seq}:reward`,
                points,
                localDate: getLocalDateKey()
            });
            if (receipt.accepted) syncTypingDefenseHostPoints();
        } else {
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
    const receiptService = window.GameRewardReceipts && typeof window.GameRewardReceipts.claim === 'function'
        ? window.GameRewardReceipts
        : null;
    if (receiptService) {
        const receipt = receiptService.claim({
            profileId: getActiveDailyProfileId(),
            source: 'word-memory-map',
            eventId: `${sessionId}:${seq}:result`,
            points,
            localDate: getLocalDateKey()
        });
        if (!receipt.accepted && typeof showToast === 'function') showToast('本局奖励已经领取过了');
    } else {
        addGrowthPoints(points);
    }
    const progress = recordWordMemoryMapResult(payload);
    syncWordMemoryMapHostPoints();
    renderPlaygroundProgressBoard();
    renderReviewBattleBoard();
    if (typeof showToast === 'function') {
        const stars = Math.max(0, Math.floor(Number(payload.earnedStars) || 0));
        showToast(`单词跑酷通关，本局已同步 ${points} 成长分，拿到 ${stars} 颗星，累计通关 ${progress.sessions} 张图`);
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
    const launchLink = document.getElementById('typing-defense-launch');
    const status = document.getElementById('typing-defense-status');
    if (frame.dataset.loaded === '1' || frame.dataset.loading === '1') return;
    frame.dataset.loading = '1';
    if (status) {
        status.classList.remove('is-ready');
        status.textContent = '正在加载消灭苦力怕...';
    }
    resolveTypingDefenseEmbedSrc().then(function (src) {
        if (launchLink) launchLink.href = src;
        frame.addEventListener('load', function onLoad() {
            frame.dataset.loaded = '1';
            frame.dataset.loading = '0';
            if (status) {
                status.textContent = `已加载，可直接开始。当前主站积分 ${totalPoints || 0}`;
                window.setTimeout(function () {
                    status.classList.add('is-ready');
                }, 260);
            }
            frame.removeEventListener('load', onLoad);
        });
        frame.addEventListener('error', function onError() {
            frame.dataset.loading = '0';
            if (status) {
                status.classList.remove('is-ready');
                status.textContent = '加载失败，请检查消灭苦力怕的静态资源路径。';
            }
            frame.removeEventListener('error', onError);
        });
        frame.src = src;
    }).catch(function () {
        frame.dataset.loading = '0';
        if (status) {
            status.classList.remove('is-ready');
            status.textContent = '加载失败，请检查消灭苦力怕的静态资源路径。';
        }
    });
}

let typingDefenseEmbedSrcPromise = null;

function isLocalDevelopmentHost() {
    const hostname = String(window.location.hostname || '').toLowerCase();
    return !hostname || hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

function resolveTypingDefenseEmbedSrc() {
    if (typingDefenseEmbedSrcPromise) return typingDefenseEmbedSrcPromise;
    const runtimeSrc = withRouteBase('/app/playground/typing-defense-runtime/web/index.html');
    const sourceSrc = withRouteBase('/prj/%E6%B6%88%E7%81%AD%E8%8B%A6%E5%8A%9B%E6%80%95%E6%89%93%E5%AD%97%E6%B8%B8%E6%88%8F/web/index.html');
    if (isLocalDevelopmentHost()) return Promise.resolve(sourceSrc);
    typingDefenseEmbedSrcPromise = Promise.resolve(runtimeSrc);
    return typingDefenseEmbedSrcPromise;
}

function ensureLearningArcadeEmbed() {
    const frame = document.getElementById('learning-arcade-frame');
    if (!frame) return;
    const requestedGame = String(frame.dataset.requestedGame || '').trim();
    const params = new URLSearchParams();
    if (requestedGame) params.set('game', requestedGame);
    params.set('v', 'learning-arcade-fullscreen-20260711n');
    const src = withRouteBase(`/prj/%E5%AD%A6%E4%B9%A0%E6%9C%BA%E7%8E%A9%E6%B3%95%E5%8E%9F%E5%9E%8B/index.html?${params.toString()}`);
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
    const src = `${withRouteBase('/prj/%E5%8D%95%E8%AF%8D%E8%AE%B0%E5%BF%86%E5%B0%84%E5%87%BB%E5%9C%BA%E5%8E%9F%E5%9E%8B/index.html')}?vocab=core`;
    const launchLink = document.getElementById('word-memory-map-launch');
    const status = document.getElementById('word-memory-map-status');
    if (launchLink) launchLink.href = src;
    if (frame.dataset.loaded === '1') return;
    if (status) {
        status.classList.remove('is-ready');
        status.textContent = '正在加载单词跑酷...';
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
            status.textContent = '加载失败，请检查单词跑酷原型的静态资源路径。';
        }
        frame.removeEventListener('error', onError);
    });
    frame.src = src;
}

async function renderForestMapPage() {
    const page = document.getElementById('page-forest-map');
    const board = document.getElementById('forestMapSceneGrid');
    if (!page || !board || !window.ExplorationSystem) return;
    try {
        await ExplorationSystem.loadScenes();
        if (!page.classList.contains('active')) return;
        ExplorationSystem.renderSceneGridMap(null, 'forestMapSceneGrid');
    } catch (error) {
        console.warn('[app] forest map page render failed:', error);
        board.innerHTML = '<div class="home-explore-map-fallback">森林冒险地图暂时没有收到信号，请稍后重试。</div>';
    }
}

function runPageActivation(page) {
    if (page === 'map') {
        activateHomeDemoImages();
        updateHomeDemoSummary();
        updateMapCompanionCard();
    }
    if (page === 'parent') updateParentHomePage();
    if (page === 'works') renderGrowthWorksPage();
    if (page === 'pet') renderPetPage();
    if (page === 'walk') renderWalkPage();
    if (page === 'explore' && window.ExplorationSystem) void renderExplorePage();
    if (page === 'forest-map' && window.ExplorationSystem) void renderForestMapPage();
    if (page === 'playground') {
        renderPlaygroundProgressBoard();
        if (window.PetBankPlaygroundCatalog && typeof window.PetBankPlaygroundCatalog.mount === 'function') {
            window.PetBankPlaygroundCatalog.mount();
        }
    }
    if (page === 'review') renderReviewBattleBoard();
    if (page === 'mathpk' && window.MathPKGame) MathPKGame.renderUI('math-pk-container');
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
    if (page === 'leaderboard' && window.Leaderboard) switchLeaderboardTab(window._lbCurrentGame || 'mathpk');
    if (page === 'learn' && window.LearnCenter) void LearnCenter.renderHub('learn-container');
    if (page === 'picturebooks' && window.Picturebooks) void Picturebooks.render('picturebooks-root');
    if (page === 'learn-pack' && window.LearnCenter) void LearnCenter.renderPack('learn-pack-container');
    if (page === 'learn-plan' && window.LearnCenter) void LearnCenter.renderPlan('learn-plan-container');
    if (page === 'learn-lesson' && window.LearnCenter) void LearnCenter.renderLesson('learn-lesson-container');
    if (page === 'learn-print' && window.LearnCenter) void LearnCenter.renderPrint('learn-print-container');
    if (page === 'minecraft-vocab' && window.MinecraftVocabPage) void MinecraftVocabPage.render('minecraft-vocab-root');
    if (page === 'learning-sheet' && window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('points-learning-sheet-container');
    }
    if (page === 'inventory') renderInventoryPage();
    if (page === 'today') {
        updateRewardPetCard();
        renderMinecraftVocabTodayEntry();
    }
    if (page === 'card' && window.CardCollection) CardCollection.renderUI('card-collection-container');
    if (page === 'shop' && window.ShopSystem) ShopSystem.renderUI('shop-ui');
    if (page === 'tools' && window.ToolboxSystem) ToolboxSystem.renderUI('tools-ui');
    if (page === 'home' && window.HomeSystem) HomeSystem.renderUI('home-container');
    if (page === 'settings' && window.SettingsPage) SettingsPage.render();
    if (page === 'settings' && activeSettingsSection === 'family' && window.ParentAccountUI) ParentAccountUI.render();
    if (page === 'settings') {
        const diagnosticsRoot = document.getElementById('diagnostics-root');
        if (diagnosticsRoot) diagnosticsRoot.innerHTML = '';
    }
    if (page === 'settings' && window.MathPKGame && typeof window.MathPKGame.renderDifficultySetting === 'function') {
        MathPKGame.renderDifficultySetting('settings-math-diff');
    } else if (page === 'settings') {
        const settingsMathDiff = document.getElementById('settings-math-diff');
        if (settingsMathDiff) settingsMathDiff.innerHTML = '';
    }
    if (page === 'settings' && !window.MathPKGame && window.PetBankRuntime && typeof window.PetBankRuntime.ensurePage === 'function') {
        // Settings only needs the math difficulty control; loading the full
        // child playground shell here causes parent routes to fetch child UI.
        void window.PetBankRuntime.ensurePage('mathpk')
            .then(function () {
                const settingsPage = document.getElementById('page-settings');
                if (!settingsPage || !settingsPage.classList.contains('active')) return;
                if (window.MathPKGame && typeof window.MathPKGame.renderDifficultySetting === 'function') {
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
    if (window.ChildWorkbenchShell && typeof window.ChildWorkbenchShell.sync === 'function') {
        window.ChildWorkbenchShell.sync(page);
    }
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
    const today = window.PetBankDailyState.localDate();
    const raw = JSON.parse(localStorage.getItem('petbank_walk_data') || '{}');
    const count = raw.date === today ? Number(raw.count || 0) : 0;
    const max = 3;
    return {
        count: count,
        max: max,
        remaining: Math.max(0, max - count)
    };
}

function renderWalkPage() {
    const root = document.getElementById('walk-page-root');
    if (!root) return;

    const pet = PetSystem.getState();
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
                    <p class="text-sm text-muted mt-2">先去我的宠物里认养伙伴，再来这里挑路线、一起出发。</p>
                    <button class="btn-primary mt-4" type="button" onclick="switchPage('pet')">先去认养宠物</button>
                </div>
            </div>
        `;
        return;
    }

    const walkStatusMarkup = `
        <div class="card walk-home-card">
            <div class="card-body walk-home-status">
                <p class="walk-home-kicker">遛弯中心 / 户外版宠物小屋</p>
                <h3>带着 ${escapeAppHtml(pet.species_data?.name || '小伙伴')} 去 ${escapeAppHtml(activeRoute ? activeRoute.sceneTitle : '户外')} 散步</h3>
                <p class="walk-home-summary">左边是户外场景，右边是宠物状态、互动和路线信息。</p>
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
                    <button class="btn-secondary" type="button" onclick="switchPage('pet')">📘 看成长档案</button>
                </div>
            </div>
        </div>
    `;
    root.innerHTML = `
        <section class="walk-home-shell">
            <div class="walk-home-main">
                <div class="walk-scene-stage-wrap">
                    <div id="walk-scene-stage"></div>
                </div>
            </div>
            <aside class="walk-home-side">
                ${walkStatusMarkup}
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
        showToast(result.msg);
    } else {
        // 没有宠物粮就回血
        PetSystem.feed({ effect: { hp: 10 } });
        showToast('背包中没有宠物粮，先简单恢复 10 HP');
    }
    renderPetPage();
}
function playWithPet() {
    const result = PetSystem.play();
    showToast(result.msg);
    renderPetPage();
}
function restPet() {
    const result = PetSystem.rest();
    showToast(result.msg);
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

async function renderExplorePage(selectedSceneId) {
    if (selectedSceneId === 'space-growth-detective') {
        await renderPixelStoryExplorePage();
        await switchExploreToAdventure();
        return;
    }
    if (selectedSceneId && window.ExplorationDetail && typeof window.ExplorationDetail.show === 'function') {
        await window.ExplorationDetail.show(selectedSceneId, {
            hostId: 'explorationStageRoot',
            returnTarget: 'explore-story-map'
        });
        return;
    }
    const shell = document.getElementById('pixelStoryShell');
    if (shell?.dataset.mode === 'adventure' && window.PixelStoryPage
        && typeof window.PixelStoryPage.showAdventure === 'function') {
        await window.PixelStoryPage.showAdventure();
        return;
    }
    await renderPixelStoryExplorePage();
}

async function renderPixelStoryExplorePage(preferredTrackId = 'sci-fi') {
    if (!window.PixelStoryPage || typeof window.PixelStoryPage.activate !== 'function') return;
    await window.PixelStoryPage.activate({ preferredTrackId });
}

async function switchExploreToAdventure() {
    if (window.PixelStoryPage && typeof window.PixelStoryPage.showAdventure === 'function') {
        return window.PixelStoryPage.showAdventure();
    }
    return false;
}

function focusExploreScene(sceneId) {
    activeExploreSceneId = sceneId;
    void renderExplorePage(sceneId);
}

function startExplorationUI(sceneId) {
    activeExploreSceneId = sceneId;
    if (window.ExplorationDetail && typeof window.ExplorationDetail.show === 'function') {
        void window.ExplorationDetail.show(sceneId, {
            hostId: 'explorationStageRoot',
            returnTarget: 'forest-map'
        });
        return;
    }
    void renderExplorePage(sceneId);
}

window.focusExploreScene = focusExploreScene;
window.startExplorationUI = startExplorationUI;
window.renderExplorePage = renderExplorePage;
window.switchExploreToAdventure = switchExploreToAdventure;
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
    const arenaBg = `assets/arena/arena-${battle.chapter || 1}.webp`;
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
    const storyBattleResult = window.SpaceGrowthDetective
        && typeof window.SpaceGrowthDetective.handleBattleClosed === 'function'
        ? window.SpaceGrowthDetective.handleBattleClosed(status)
        : null;
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
        if (storyBattleResult?.accepted) {
            activeExploreSceneId = 'space-growth-detective';
            showToast('案件完成，故事卡和徽章已经收进成长册。');
        }
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

function renderMinecraftVocabTodayEntry() {
    const root = document.getElementById('today-minecraft-vocab-entry');
    if (!root) return;

    const session = window.MinecraftVocabSession;
    let status = 'not-started';
    let completed = 0;
    let total = 0;
    if (session
        && typeof session.activeProfileId === 'function'
        && typeof session.readState === 'function'
        && typeof session.isComplete === 'function') {
        const profileId = String(session.activeProfileId() || '');
        const state = session.readState(profileId);
        const today = getLocalDateKey();
        if (state
            && String(state.profileId || '') === profileId
            && state.localDate === today
            && Array.isArray(state.queue)
            && Array.isArray(state.completed)
            && state.queue.length > 0) {
            total = state.queue.length;
            completed = Math.min(state.completed.length, total);
            status = session.isComplete(state) ? 'complete' : 'in-progress';
        }
    }

    const copy = {
        'not-started': { status: '开始今日远征', action: '开始今日远征', progress: '11 步短会话' },
        'in-progress': { status: '继续今天的远征', action: '继续今天的远征', progress: `${completed} / ${total} 步已完成` },
        complete: { status: '今天已完成', action: '重温词卡', progress: `${completed} / ${total} 步已完成` }
    }[status];
    root.dataset.status = status;
    const statusEl = document.getElementById('today-minecraft-vocab-status');
    const progressEl = document.getElementById('today-minecraft-vocab-progress');
    const actionEl = root.querySelector('[data-minecraft-vocab-entry-launch]');
    if (statusEl) statusEl.textContent = copy.status;
    if (progressEl) progressEl.textContent = copy.progress;
    if (actionEl) actionEl.textContent = copy.action;
}

// ============ 总体渲染 ============
function renderAll() {
    const activePage = getActivePageId();
    renderTaskGrid();
    renderSidebarTasks();
    renderHomeDemoTaskMirror();
    updateStats();
    updateHomeDemoSummary();
    renderGrowthStickerReport();
    renderScheduledCheckins();
    renderMinecraftVocabTodayEntry();
    renderReviewBattleBoard();
    if (activePage === 'learning-sheet' && window.LearnCenter && typeof window.LearnCenter.renderDailyCheckin === 'function') {
        void window.LearnCenter.renderDailyCheckin('points-learning-sheet-container');
    }
    renderPetPage();
    renderInventoryPage();
    if (activePage === 'explore' && window.ExplorationSystem) void renderExplorePage();
    if (activePage === 'playground') renderPlaygroundProgressBoard();
    if (activePage === 'shop' && window.ShopSystem) ShopSystem.renderUI('shop-ui');
    if (activePage === 'works') renderGrowthWorksPage();
    if (window.lucide) lucide.createIcons();
}

window.totalPoints = totalPoints;
window.updateStats = updateStats;
window.updateTopPoints = updateTopPoints;
window.addGrowthPoints = addGrowthPoints;
window.getGrowthPoints = getGrowthPoints;
window.spendPoints = spendPoints;
window.redeemFamilyReward = redeemFamilyReward;
window.deductGrowthPoints = deductGrowthPoints;
window.PetBankPoints = Object.freeze({
    get: getGrowthPoints,
    add: addGrowthPoints,
    spend: spendPoints,
    deduct: deductGrowthPoints
});
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
window.completeScheduledCheckin = completeScheduledCheckin;

// ============ 初始化 ============
async function init() {
    const initialRoute = resolveRouteFromLocation(window.location);
    if (initialRoute.page === 'explore' || initialRoute.page === 'forest-map') document.body.classList.add('app-loading-explore');
    if (initialRoute.page === 'forest-map') document.body.classList.add('app-loading-forest-map');
    if (initialRoute.page === 'settings') {
        activeSettingsSection = normalizeSettingsSection(initialRoute.settingsSection);
    }
    if (window.ProfileManager && typeof ProfileManager.ensureDefault === 'function') {
        ProfileManager.ensureDefault();
    }
    if (window.ProfileManager && typeof ProfileManager.hydrateActiveFromCloud === 'function') {
        await ProfileManager.hydrateActiveFromCloud();
    }
    if (window.ProfileManager && typeof ProfileManager.installCloudLifecycle === 'function') {
        ProfileManager.installCloudLifecycle();
    }
    if (window.ProfileUI && typeof ProfileUI.render === 'function') {
        ProfileUI.render();
    }
    loadAppState();
    PetSystem.load();
    InventorySystem.load();
    await InventorySystem.loadItemsData();
    await loadPointItems();
    // Align the placeholder DOM with a deep-link before the first shared render.
    // Otherwise hidden map/reward fallbacks can win the first image request.
    const initialPageElement = document.getElementById(`page-${initialRoute.page}`);
    if (initialPageElement) {
        document.querySelectorAll('.page.active').forEach((pageElement) => pageElement.classList.remove('active'));
        initialPageElement.classList.add('active');
    }
    updateRewardPetCard();
    // 宠物小屋 decay 补算（R4：PetSystem 加载后，若 last_home_ts 存在则结算离线衰减）
    // decay() 内部结算后会立即写 last_home_ts=now，保证后续 switchPage('home')→renderUI 再算幂等
    if (typeof PetSystem.decay === 'function' && PetSystem.getState().last_home_ts) {
        PetSystem.decay();
    }
    renderAll();
    // 初始化宝箱系统
    if (window.TreasureChest) TreasureChest.init();
    await switchPage(initialRoute.page, {
        settingsSection: initialRoute.settingsSection,
        replace: true
    });
    document.body.classList.add('app-ready');
    document.body.classList.remove('app-loading-explore');
    document.body.classList.remove('app-loading-forest-map');
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
