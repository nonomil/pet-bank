(function (global) {
    'use strict';

    const PRIMARY_ITEMS = [
        { id: 'map', label: '首页', sublabel: '成长总览', icon: '⌂', group: '成长' },
        { id: 'today', label: '今日', sublabel: '任务与奖励', icon: '✓', group: '成长' },
        { id: 'learn', label: '学习', sublabel: '学习工作台', icon: '✦', group: '成长' },
        { id: 'picturebooks', label: '绘本', sublabel: '故事书架', icon: '▤', group: '成长' },
        { id: 'pet', label: '宠物', sublabel: '陪伴与养成', icon: '♣', group: '生活' },
        { id: 'explore', label: '探索', sublabel: '故事与地图', icon: '↗', group: '生活' },
        { id: 'playground', label: '游乐场', sublabel: '互动挑战', icon: '◇', group: '游戏' }
    ];

    const PAGE_TITLES = {
        map: ['首页', '成长总览'],
        today: ['今日', '今日任务'],
        'learning-sheet': ['今日', '学习单'],
        review: ['今日', '每周复盘'],
        reward: ['今日', '奖励兑换'],
        shop: ['今日', '兑换商店'],
        inventory: ['今日', '背包'],
        learn: ['学习', '学习工作台'],
        'learn-pack': ['学习', '资料包'],
        'learn-plan': ['学习', '学习计划'],
        'learn-lesson': ['学习', '学习内容'],
        'learn-print': ['学习', '打印学习单'],
        'minecraft-vocab': ['学习', 'Minecraft 单词远征'],
        picturebooks: ['绘本', '绘本书架'],
        pet: ['宠物', '我的宠物'],
        home: ['宠物', '宠物小屋'],
        explore: ['探索', '故事地图'],
        'forest-map': ['探索', '森林冒险'],
        playground: ['游乐场', '互动挑战']
    };

    const NEXT_STEPS = {
        map: [
            ['继续今日任务', '先完成一件小事', 'today'],
            ['打开学习工作台', '晨读、识字或数学', 'learn'],
            ['去故事地图', '选择一条探索路线', 'explore']
        ],
        today: [
            ['完成今日推荐', '点亮一张成长卡', 'today'],
            ['继续学习', '完成后领取成长分', 'learn'],
            ['读一本绘本', '把故事读到结尾', 'picturebooks']
        ],
        learn: [
            ['继续今日学习', '约 8 分钟', 'learn'],
            ['读一本绘本', '完成后领取成长奖励', 'picturebooks'],
            ['玩一局学习游戏', '飞机大战或拼音赛车', 'playground']
        ],
        picturebooks: [
            ['挑一本绘本', '从上次阅读处继续', 'picturebooks'],
            ['回到学习', '继续识字或英语', 'learn'],
            ['记录今日完成', '把阅读收进成长轨迹', 'today']
        ],
        pet: [
            ['看看伙伴状态', '完成一次照料', 'pet'],
            ['布置宠物小屋', '让陪伴空间更舒服', 'home'],
            ['去故事地图', '带伙伴开始冒险', 'explore']
        ],
        explore: [
            ['继续故事地图', '选择一个已解锁节点', 'explore'],
            ['照料同行伙伴', '补充冒险能量', 'pet'],
            ['完成今日任务', '收下成长分', 'today']
        ],
        playground: [
            ['开始数学 PK', '100 以内加减法', 'mathpk'],
            ['玩一局汉字游戏', '认字和反应一起练', 'hanzi'],
            ['玩一局单词跑酷', '把单词放回故事里', 'word-memory-map']
        ]
    };

    const SECONDARY_PAGES = new Set(['learn']);

    let mounted = false;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getActiveProfile() {
        return global.ProfileManager && typeof global.ProfileManager.getActive === 'function'
            ? global.ProfileManager.getActive()
            : null;
    }

    function getPoints() {
        if (global.PetBankPoints && typeof global.PetBankPoints.get === 'function') return Number(global.PetBankPoints.get()) || 0;
        return Number(global.localStorage?.getItem('petbank_points') || 0) || 0;
    }

    function getPetLevel() {
        if (global.PetSystem && typeof global.PetSystem.getState === 'function') {
            return Number(global.PetSystem.getState()?.level || 1) || 1;
        }
        return 1;
    }

    function getCompletedToday() {
        return Number(global.localStorage?.getItem('petbank_tasks_completed_today') || 0) || 0;
    }

    function resolveTab(page) {
        if (!global.PetBankPageRouter || typeof global.PetBankPageRouter.getPageToTab !== 'function') return page || 'map';
        return global.PetBankPageRouter.getPageToTab(page) || 'map';
    }

    function getTitle(page) {
        const tab = resolveTab(page);
        return PAGE_TITLES[page] || PAGE_TITLES[tab] || ['孩子端', '成长工作台'];
    }

    function renderPrimary() {
        const host = document.getElementById('childPrimarySidebar');
        if (!host) return;
        let lastGroup = '';
        const items = PRIMARY_ITEMS.map((item) => {
            const group = item.group !== lastGroup ? `<p class="child-primary-group">${escapeHtml(item.group)}</p>` : '';
            lastGroup = item.group;
            return `${group}<button class="child-primary-item" type="button" data-child-primary="${item.id}" data-page="${item.id}">
                <span class="child-primary-icon" aria-hidden="true">${item.icon}</span>
                <span class="child-primary-copy"><strong>${escapeHtml(item.label)}</strong><small>${escapeHtml(item.sublabel)}</small></span>
            </button>`;
        }).join('');
        host.innerHTML = `<div class="child-primary-head"><span class="child-primary-mark">萌</span><span><strong>孩子端栏目</strong><small>一级入口</small></span></div><nav id="childPrimaryNav" class="child-primary-nav" aria-label="全站一级分类">${items}</nav><div class="child-primary-utility" aria-label="孩子端工具"><button class="child-primary-utility-item" type="button" data-child-action="profile" data-profile-trigger><i data-lucide="user-round" aria-hidden="true"></i><span>切换孩子</span></button><button class="child-primary-utility-item" type="button" data-child-action="parent"><i data-lucide="settings" aria-hidden="true"></i><span>家长区</span></button></div><p class="child-primary-note">一级栏目固定在左侧，内容页保持完整宽度。</p>`;
        host.querySelectorAll('[data-child-primary]').forEach((button) => {
            button.addEventListener('click', () => {
                if (typeof global.switchPage === 'function') void global.switchPage(button.dataset.page);
            });
        });
        const profileButton = host.querySelector('[data-child-action="profile"]');
        if (profileButton) {
            profileButton.addEventListener('click', (event) => {
                if (global.ProfileUI && typeof global.ProfileUI.toggle === 'function') global.ProfileUI.toggle(event);
            });
        }
        const parentButton = host.querySelector('[data-child-action="parent"]');
        if (parentButton) {
            parentButton.addEventListener('click', () => {
                if (typeof global.switchPage === 'function') void global.switchPage('parent');
            });
        }
        if (global.lucide && typeof global.lucide.createIcons === 'function') global.lucide.createIcons({ root: host });
    }

    function renderProgress(page) {
        const host = document.getElementById('childProgressRail');
        if (!host) return;
        const tab = resolveTab(page);
        const [category, title] = getTitle(page);
        const profile = getActiveProfile();
        const childName = profile?.name || document.getElementById('profileCurName')?.textContent || '默认孩子';
        const points = getPoints();
        const level = getPetLevel();
        const completed = Math.min(3, getCompletedToday());
        const steps = NEXT_STEPS[tab] || NEXT_STEPS.map;
        host.innerHTML = `<section class="child-progress-panel">
            <div class="child-progress-heading"><div><p>当前孩子</p><h2>${escapeHtml(childName)}</h2></div><span class="child-progress-avatar">🧒</span></div>
            <div class="child-progress-overview"><div><strong>${points}</strong><span>成长分</span></div><div class="child-progress-meter"><i style="width:${Math.min(100, Math.round((completed / 3) * 100))}%"></i></div><small>今天完成 ${completed} / 3 项</small></div>
            <div class="child-progress-stats"><div><span>宠物等级</span><strong>Lv.${level}</strong></div><div><span>当前栏目</span><strong>${escapeHtml(category)}</strong></div></div>
        </section>
        <section class="child-progress-panel"><div class="child-progress-title"><h2>下一步</h2><span>${escapeHtml(title)}</span></div><div class="child-next-list">${steps.map(([label, copy, target], index) => `<button type="button" data-child-next="${escapeHtml(target)}"><b>${index + 1}</b><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(copy)}</small></span><em aria-hidden="true">›</em></button>`).join('')}</div></section>
        <section class="child-progress-panel child-recent-panel"><div class="child-progress-title"><h2>最近完成</h2><span>成长轨迹</span></div><ul><li><b>✓</b><span>今日任务进度已同步</span></li><li><b>✓</b><span>积分和宠物状态已保存</span></li></ul></section>`;
        host.querySelectorAll('[data-child-next]').forEach((button) => {
            button.addEventListener('click', () => {
                if (typeof global.switchPage === 'function') void global.switchPage(button.dataset.childNext);
            });
        });
    }

    function sync(page) {
        const host = document.getElementById('childPrimarySidebar');
        const rail = document.getElementById('childProgressRail');
        const tab = resolveTab(page);
        const enabled = Boolean(global.PetBankPageRouter && global.PetBankPageRouter.getRouteShell(page) === 'home');
        document.body.classList.toggle('child-workbench-active', enabled);
        document.body.classList.toggle('child-workbench-playground', enabled && tab === 'playground');
        document.body.classList.toggle('child-workbench-secondary', enabled && SECONDARY_PAGES.has(page));
        if (host) host.hidden = !enabled;
        if (rail) rail.hidden = !enabled;
        if (!enabled) return;
        document.querySelectorAll('[data-child-primary]').forEach((item) => {
            const active = item.dataset.childPrimary === tab;
            item.classList.toggle('is-current', active);
            item.setAttribute('aria-current', active ? 'page' : 'false');
        });
        const [category, title] = getTitle(page);
        const categoryEl = document.getElementById('appRouteCategory');
        const titleEl = document.getElementById('appRouteTitle');
        if (categoryEl) categoryEl.textContent = category;
        if (titleEl) titleEl.textContent = title;
        renderProgress(page);
    }

    function mount() {
        if (mounted) return;
        mounted = true;
        renderPrimary();
    }

    global.ChildWorkbenchShell = Object.freeze({ mount, sync, renderPrimary, renderProgress });
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
    else mount();
}(window));
