/**
 * card-arena-ui.js - 卡牌对战（3v3）UI 层
 *
 * 依赖：window.CardArena（js/card-arena.js 纯逻辑）、PetSystem.getAllSpecies、CardCollection
 * 设计（方案 docs/方案/2026-07-01-卡牌对战-方案.md §5.3）：
 *   - 独立 arena modal（#arenaBattleModal / #arenaTeamModal），不动探索 battle modal
 *   - 听 CardArena.getState().log 事件（actionResolved/faint/switch/battleEnd）更新 UI，不解析中文
 *   - 选队 → startBattle（3 预设敌人）→ 回合制（普攻/技能/防御/必杀/换人）→ 胜负结算
 */
const CardArenaUI = (function () {

    // ===== 状态 =====
    let selectedIds = [];        // 选队已选 species id
    let logSeenLen = 0;          // 已渲染到 UI 的 log 长度（用于增量取事件）
    let lastDamageEvents = [];   // 本回合伤害事件（用于浮动数字）
    let uiLocked = false;        // 动作锁（防连点）

    // ===== PvP 本地热座状态 =====
    // pvpMode：'off' | 'pickA' | 'pickB'（选队阶段轮到谁）
    let pvpMode = 'off';         // 选队进度：off=A未选 / pickA=A选队中 / pickB=B选队中
    let pvpTeamAIds = [];        // 玩家A 已选 species id（3 只）
    let pvpTeamBIds = [];        // 玩家B 已选 species id（3 只）

    // ===== 闯关：关卡数据 + 进度 =====
    const PROGRESS_KEY = 'petbank_arena_progress'; // { cleared:[id], current:id }
    let stagesCache = null;       // arena-stages.json 缓存
    let pendingStageId = null;    // 当前正在打的关卡 id（null = 自由对战/随机敌人）

    // 读进度（带兜底：默认解锁第 1 关）
    function getProgress() {
        try {
            const raw = localStorage.getItem(PROGRESS_KEY);
            if (raw) {
                const p = JSON.parse(raw);
                if (p && Array.isArray(p.cleared)) {
                    return { cleared: p.cleared, current: p.current || 1 };
                }
            }
        } catch (e) {}
        return { cleared: [], current: 1 };
    }

    function _saveProgress(p) {
        try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (e) {}
    }

    // 关卡是否解锁：id <= current
    function isUnlocked(id) {
        const p = getProgress();
        return id <= p.current;
    }

    // 关卡是否已通关
    function isCleared(id) {
        return getProgress().cleared.includes(id);
    }

    /**
     * 通关一关：标记 + 解锁下一关（仅首次发放奖励，重玩不再发）
     * @param {number} stageId
     * @param {object} reward { points, dropCard }
     * @returns {object} { firstClear:boolean, unlockedNext:number|null, granted:{points,card?} }
     */
    function clearStage(stageId, reward) {
        const p = getProgress();
        const firstClear = !p.cleared.includes(stageId);
        let unlockedNext = null;
        let granted = {};
        if (firstClear) {
            p.cleared.push(stageId);
            // 解锁下一关
            const maxId = (stagesCache && stagesCache.stages)
                ? Math.max(...stagesCache.stages.map(s => s.id))
                : 10;
            if (stageId < maxId && stageId >= p.current) {
                p.current = stageId + 1;
                unlockedNext = stageId + 1;
            }
            _saveProgress(p);
            // 发奖励（仅首次）：首通只送固定新卡，不再发成长积分
            // （卡牌系统不产出成长积分，收口到主循环任务/探索；reward.points 字段保留供 Step6 接训练券复用）
            if (reward && reward.dropCard) {
                try {
                    if (window.CardCollection && typeof CardCollection.addCard === 'function') {
                        CardCollection.addCard(reward.dropCard);
                        granted.card = reward.dropCard;
                    }
                } catch (e) {}
            }
        }
        return { firstClear, unlockedNext, granted };
    }

    // 加载关卡数据（运行时 fetch，带缓存）
    async function _loadStages() {
        if (stagesCache) return stagesCache;
        try {
            const res = await fetch('data/arena-stages.json');
            stagesCache = await res.json();
        } catch (e) {
            stagesCache = null;
        }
        return stagesCache;
    }

    // species id → 名字（展示敌人/掉卡用）
    function _speciesName(id) {
        try {
            const all = PetSystem.getAllSpecies();
            const sp = all.find(s => s.id === id);
            return sp ? (sp.name || id) : id;
        } catch (e) { return id; }
    }

    // ===== 关卡选择 modal =====
    async function openStages() {
        const data = await _loadStages();
        const modal = document.getElementById('arenaStagesModal');
        const grid = document.getElementById('arenaStagesGrid');
        if (!modal || !grid) return;
        if (!data || !Array.isArray(data.stages)) {
            grid.innerHTML = '<div class="text-xs text-muted">关卡数据加载失败，请刷新重试。</div>';
            modal.classList.add('show');
            return;
        }
        const p = getProgress();
        // 自由练习入口卡片（置顶）：随机敌人，不计进度不计积分，随时玩
        const freePlayCard = `
            <div class="arena-stage-card open" style="grid-column:1/-1;background:linear-gradient(90deg,#FFF8DC80,#FAF8F2);border-color:#D4B96A;" onclick="CardArenaUI.openFreePlay()">
                <div class="stage-head">
                    <span class="stage-no">🆓</span>
                    <span class="stage-name">自由练习</span>
                    <span class="stage-state open">▶ 随时玩</span>
                </div>
                <div class="stage-chapter">不计进度 · 不计积分</div>
                <div class="stage-desc">随机对手，自由组队，随时热身一局。</div>
                <div class="stage-enemies">敌方：随机 3 只</div>
                <div class="stage-reward">奖励：无（成长积分看轻章节首通）</div>
            </div>
        `;
        // 按 5 大区域分组渲染：每区域一个标题 + 该区域下的轻章节卡片
        // 五区低饱和色（贴合项目鼠尾草绿基调；参考 design-to-code 生成图 + Codex token）
        const regionColors = {
            1: { main: '#8FCAA6', text: '#3F7A5E' },  // 起点花园 薄荷绿
            2: { main: '#7AB06A', text: '#4A7A40' },  // 森林边界 苔藓绿
            3: { main: '#7AB5CC', text: '#3D6E85' },  // 海边集市 雾蓝
            4: { main: '#A89C8C', text: '#6A5E50' },  // 高地洞窟 石灰棕
            5: { main: '#D4B96A', text: '#8A7240' }   // 星空终点 浅金
        };
        let lastChapter = 0;
        const stagesHtml = data.stages.map(st => {
            // 区域切换 → 插入区域标题（grid-column:1/-1 跨两列独占行）
            let regionHeader = '';
            if (st.chapter !== lastChapter) {
                const ch = (data.chapters || []).find(c => c.id === st.chapter) || {};
                const rc = regionColors[st.chapter] || regionColors[1];
                regionHeader = `
                    <div class="arena-region-head" style="grid-column:1/-1;display:flex;align-items:baseline;flex-wrap:wrap;gap:8px;margin:10px 0 2px;padding:6px 12px;background:linear-gradient(90deg,${rc.main}33,${rc.main}0A);border-left:3px solid ${rc.main};border-radius:10px;">
                        <span style="font-weight:700;font-size:13px;color:${rc.text};">🗺️ 区域 ${st.chapter} · ${ch.name || ''}</span>
                        <span class="text-xs text-muted">${ch.theme || ''}</span>
                    </div>
                `;
                lastChapter = st.chapter;
            }
            const cleared = p.cleared.includes(st.id);
            const unlocked = st.id <= p.current;
            const stateTag = cleared ? '✓ 已通关' : (unlocked ? '▶ 可挑战' : '🔒 锁定');
            const stateCls = cleared ? 'cleared' : (unlocked ? 'open' : 'locked');
            const stars = '★'.repeat(st.difficulty) + '☆'.repeat(5 - st.difficulty);
            const enemyNames = st.enemies.slice(0, 3).map(_speciesName).join(' / ');
            const clickAttr = unlocked
                ? `onclick="CardArenaUI.enterStage(${st.id})"`
                : '';
            return regionHeader + `
                <div class="arena-stage-card ${stateCls}" ${clickAttr}>
                    <div class="stage-head">
                        <span class="stage-no">${st.id}</span>
                        <span class="stage-name">${st.name}</span>
                        <span class="stage-state ${stateCls}">${stateTag}</span>
                    </div>
                    <div class="stage-chapter">轻章节 · ${stars}</div>
                    <div class="stage-desc">${st.desc || ''}</div>
                    <div class="stage-enemies">敌方：${enemyNames}</div>
                    <div class="stage-reward">🃏 首通送新卡：${(st.reward&&st.reward.dropCard)?_speciesName(st.reward.dropCard):'—'}</div>
                </div>
            `;
        }).join('');
        grid.innerHTML = freePlayCard + stagesHtml;
        modal.classList.add('show');
    }

    function closeStages() {
        const m = document.getElementById('arenaStagesModal');
        if (m) m.classList.remove('show');
    }

    // 点关卡 → 进入选队（敌人 = 该关 enemies）
    function enterStage(stageId) {
        if (!isUnlocked(stageId)) return;
        pendingStageId = stageId;
        closeStages();
        openTeamSelect(stageId);
    }

    // 自由练习入口：随机敌人，不计进度不计积分，随时玩（基础练习免费）
    function openFreePlay() {
        pendingStageId = null;
        closeStages();
        openTeamSelect();  // 不传 stageId → 自由对战分支（_currentEnemies 走随机敌人）
    }

    // 预设敌方队伍（中等强度，保证有对战）
    // 用 PetSystem.getAllSpecies 随机 3 只 common/rare 兜底，避免硬编码 id 失效
    function _pickEnemies() {
        const all = PetSystem.getAllSpecies();
        const candidates = all.filter(s => s.rarity === 'common' || s.rarity === 'rare');
        const pool = candidates.length >= 3 ? candidates : all;
        // 洗牌取 3 只
        const shuffled = pool.slice().sort(() => Math.random() - 0.5);
        return shuffled.slice(0, 3).map(s => s.id);
    }

    // 取当前对战敌人：闯关模式用该关 enemies，否则随机
    function _currentEnemies() {
        if (pendingStageId != null && stagesCache) {
            const st = stagesCache.stages.find(s => s.id === pendingStageId);
            if (st && Array.isArray(st.enemies) && st.enemies.length === 3) {
                return st.enemies.slice();
            }
        }
        return _pickEnemies();
    }

    // 取当前关卡奖励对象（闯关模式；自由对战返回 null）
    function _currentStageReward() {
        if (pendingStageId == null || !stagesCache) return null;
        const st = stagesCache.stages.find(s => s.id === pendingStageId);
        return st ? st.reward : null;
    }

    // 读取已收集的卡 id（CardCollection 私有，读同名 localStorage）
    function _getCollectedIds() {
        try {
            const raw = localStorage.getItem('petbank_cards');
            return raw ? JSON.parse(raw) : [];
        } catch (e) { return []; }
    }

    // 取 species 立绘图（imageStages['2'] 终极态 / imageUrl）
    function _speciesImg(sp) {
        if (!sp) return '';
        if (sp.imageStages && sp.imageStages['2']) return sp.imageStages['2'];
        return sp.imageUrl || '';
    }

    // 稀有度边框 class
    function _rarityCls(sp) {
        return 'rarity-' + (sp.rarity || 'common');
    }

    // 四维小数值文本
    function _statsText(c) {
        return `ATK ${c.atk} · DEF ${c.def} · SPD ${c.spd}`;
    }

    // HP 百分比（防 maxHp=0）
    function _hpPct(c) {
        if (!c || !c.maxHp || c.maxHp <= 0) return 0;
        return Math.max(0, Math.min(100, (c.hp / c.maxHp) * 100));
    }

    // ===== 选队 modal =====
    // stageId 可选：闯关模式传关卡 id（敌人用该关 enemies）；不传 = 自由对战（随机敌人）
    function openTeamSelect(stageId) {
        pendingStageId = (typeof stageId === 'number') ? stageId : null;
        pvpMode = 'off';  // PvE 选队：清空 PvP 模式标记
        _openTeamSelectInternal();
    }

    /**
     * PvP 本地热座入口：双人轮流选 3 只，共用收集卡池
     * 流程：A 选 3 只 → 确认 → 提示"轮到玩家B" → B 选 3 只 → 确认 → 开战（mode='pvp'）
     */
    function openPvpSetup() {
        pvpMode = 'pickA';        // 进入 A 选队阶段
        pvpTeamAIds = [];
        pvpTeamBIds = [];
        pendingStageId = null;    // PvP 不走闯关
        closeStages();
        _openTeamSelectInternal();
    }

    /**
     * 选队 modal 内部实现（PvE / PvP 共用）
     * - pvpMode='off'：PvE 单人选队（selectedIds）
     * - pvpMode='pickA'/'pickB'：PvP 双人轮流选队（selectedIds 复用作当前方暂存）
     */
    function _openTeamSelectInternal() {
        const ids = _getCollectedIds();
        if (ids.length < 3) {
            // 收集不足：提示去探索，不打开 modal
            if (typeof showToast === 'function') showToast('收集的宠物不足 3 只，先去探索收集宠物卡 ⛏️');
            else alert('收集的宠物不足 3 只，先去探索收集宠物卡');
            return;
        }
        selectedIds = [];  // 重置当前方暂存
        const all = PetSystem.getAllSpecies();
        const owned = ids
            .map(id => all.find(s => s.id === id))
            .filter(Boolean);

        const modal = document.getElementById('arenaTeamModal');
        const grid = document.getElementById('arenaTeamGrid');
        if (!modal || !grid) return;

        grid.innerHTML = owned.map(sp => {
            const img = _speciesImg(sp);
            const isSSR = sp.rarity === 'legendary';
            return `
                <div class="arena-pick-card ${_rarityCls(sp)}" data-id="${sp.id}" onclick="CardArenaUI.togglePick('${sp.id}')">
                    <span class="pick-badge">✓</span>
                    ${img
                        ? `<img class="pick-img" src="${img}" alt="${sp.name}" onerror="this.style.display='none';this.parentElement.querySelector('.pick-emoji').style.display=''">`
                        : ''}
                    <div class="pick-emoji" style="${img ? 'display:none' : ''}">${sp.emoji || '🐾'}</div>
                    <div class="pick-name">${sp.name}</div>
                    <div class="pick-stats">HP${sp.base_hp||100} ATK${sp.base_atk||5} ${isSSR ? '🟡' : ''}</div>
                </div>
            `;
        }).join('');

        _updateTeamFooter();
        modal.classList.add('show');
    }

    function togglePick(id) {
        const idx = selectedIds.indexOf(id);
        if (idx >= 0) {
            selectedIds.splice(idx, 1);
        } else {
            if (selectedIds.length >= 3) {
                if (typeof showToast === 'function') showToast('已选满 3 只');
                return;
            }
            // SSR 校验提示（最终以 CardArena.selectTeam / selectTeamPvp 为准）
            const all = PetSystem.getAllSpecies();
            const sp = all.find(s => s.id === id);
            const ssrCount = selectedIds
                .map(x => all.find(s => s.id === x))
                .filter(s => s && s.rarity === 'legendary').length;
            if (sp && sp.rarity === 'legendary' && ssrCount >= 1) {
                if (typeof showToast === 'function') showToast('每队 SSR(传说) 最多 1 只');
                return;
            }
            selectedIds.push(id);
        }
        // 同步 DOM 选中态
        document.querySelectorAll('#arenaTeamGrid .arena-pick-card').forEach(el => {
            el.classList.toggle('selected', selectedIds.includes(el.dataset.id));
        });
        _updateTeamFooter();
    }

    function _updateTeamFooter() {
        const text = document.getElementById('arenaTeamCount');
        const btn = document.getElementById('arenaTeamConfirm');
        if (pvpMode === 'pickA' || pvpMode === 'pickB') {
            // PvP：提示当前选择方
            const who = (pvpMode === 'pickA') ? '玩家A' : '玩家B';
            if (text) text.textContent = `${who}：已选 ${selectedIds.length} / 3`;
            if (btn) {
                btn.disabled = selectedIds.length !== 3;
                btn.textContent = (pvpMode === 'pickA') ? '玩家A 确认 →' : '开始友谊赛 ⚔️';
            }
        } else {
            if (text) text.textContent = `已选 ${selectedIds.length} / 3`;
            if (btn) btn.disabled = selectedIds.length !== 3;
        }
    }

    function confirmTeam() {
        if (selectedIds.length !== 3) return;

        // ===== PvP 轮流选队分支 =====
        if (pvpMode === 'pickA') {
            // 玩家A 确认 → 暂存 A 队，切到 B 选队
            pvpTeamAIds = selectedIds.slice();
            pvpMode = 'pickB';
            selectedIds = [];
            // 重开 modal 渲染 B 选队（共用卡池）
            _openTeamSelectInternal();
            if (typeof showToast === 'function') showToast('玩家A 已选完，轮到玩家B 选队');
            return;
        }
        if (pvpMode === 'pickB') {
            // 玩家B 确认 → 开战
            pvpTeamBIds = selectedIds.slice();
            pvpMode = 'off';
            // 调用 CardArena PvP 选队 + 开战
            const res = CardArena.selectTeamPvp(pvpTeamAIds.slice(), pvpTeamBIds.slice());
            if (!res.ok) {
                if (typeof showToast === 'function') showToast(res.error || 'PvP 选队失败');
                pvpMode = 'pickA'; pvpTeamAIds = []; pvpTeamBIds = [];
                _openTeamSelectInternal();
                return;
            }
            document.getElementById('arenaTeamModal').classList.remove('show');
            CardArena.startBattlePvp();
            logSeenLen = 0;
            lastDamageEvents = [];
            uiLocked = false;
            openBattleModal();
            return;
        }

        // ===== PvE 选队分支（原逻辑）=====
        const res = CardArena.selectTeam(selectedIds.slice());
        if (!res.ok) {
            if (typeof showToast === 'function') showToast(res.error || '选队失败');
            return;
        }
        // 关选队 modal
        document.getElementById('arenaTeamModal').classList.remove('show');
        // 开战：闯关模式用该关 enemies，否则随机敌人（自由对战兼容）
        const enemies = _currentEnemies();
        CardArena.startBattle(enemies);
        logSeenLen = 0;
        lastDamageEvents = [];
        uiLocked = false;
        openBattleModal();
    }

    function closeTeamModal() {
        document.getElementById('arenaTeamModal').classList.remove('show');
        // PvP 选队中途关闭：重置 PvP 状态，避免脏数据残留
        if (pvpMode === 'pickA' || pvpMode === 'pickB') {
            pvpMode = 'off';
            pvpTeamAIds = [];
            pvpTeamBIds = [];
        }
    }

    // ===== 对战 modal =====
    function openBattleModal() {
        const modal = document.getElementById('arenaBattleModal');
        if (!modal) return;
        modal.classList.add('show');
        renderBattle();
    }

    function closeBattleModal() {
        document.getElementById('arenaBattleModal').classList.remove('show');
    }

    // 取当前上场 combatant
    function _p() { const s = CardArena.getState(); return s ? s.player[s.activeP] : null; }
    function _e() { const s = CardArena.getState(); return s ? s.enemy[s.activeE] : null; }

    function renderBattle() {
        const s = CardArena.getState();
        if (!s) return;
        const isPvp = (s.mode === 'pvp');
        const stage = document.getElementById('arenaStage');
        const p = s.player[s.activeP];
        const e = s.enemy[s.activeE];

        // PvP：顶部显示当前操作方提示（玩家A/B 回合）
        const opTag = (isPvp && s.operator)
            ? `<div class="arena-pvp-turn-tag ${s.operator === 'A' ? 'pvp-a' : 'pvp-b'}">🎮 ${s.operator === 'A' ? '玩家A' : '玩家B'} 回合</div>`
            : '';

        stage.innerHTML = `
            <div class="arena-round-tag">第 ${s.round} 回合</div>
            ${opTag}
            <div class="arena-field">
                <div class="arena-fighter" id="arenaFighterP">
                    ${_fighterHtml(p, 'player')}
                    <div class="arena-hp-line">
                        <div class="hp-bar"><div class="hp-fill" style="width:${_hpPct(p)}%"></div></div>
                        <div class="arena-hp-text">❤️ ${p.hp}/${p.maxHp}</div>
                    </div>
                </div>
                <div class="arena-vs">⚔️</div>
                <div class="arena-fighter" id="arenaFighterE">
                    ${_fighterHtml(e, 'enemy')}
                    <div class="arena-hp-line">
                        <div class="hp-bar"><div class="hp-fill" style="width:${_hpPct(e)}%"></div></div>
                        <div class="arena-hp-text">❤️ ${e.hp}/${e.maxHp}</div>
                    </div>
                </div>
            </div>
            <div class="arena-bench" id="arenaBench"></div>
            <div class="arena-damage-zone" id="arenaDamageZone"></div>
            <div class="arena-result-overlay" id="arenaResultOverlay"></div>
        `;

        // 替补队列：PvP 双方都显示（A 队=左/上方，B 队=右/下方），PvE 仅玩家
        const bench = document.getElementById('arenaBench');
        if (isPvp) {
            bench.innerHTML =
                '<span style="font-size:11px;align-self:center;opacity:.7;margin-right:4px;">A替补</span>' +
                s.player.map((c, i) => _benchSlotHtml(c, i, i === s.activeP, 'player')).join('') +
                '<span style="font-size:11px;align-self:center;opacity:.7;margin:0 4px;">|</span>' +
                '<span style="font-size:11px;align-self:center;opacity:.7;margin-right:4px;">B替补</span>' +
                s.enemy.map((c, i) => _benchSlotHtml(c, i, i === s.activeE, 'enemy')).join('');
        } else {
            bench.innerHTML = '<span style="font-size:11px;align-self:center;opacity:.7;margin-right:4px;">替补</span>' +
                s.player.map((c, i) => _benchSlotHtml(c, i, i === s.activeP, 'player')).join('');
        }

        // 动作区
        const actions = document.getElementById('arenaActions');
        if (isPvp) {
            // PvP：双方动作按钮（操作方启用，非操作方禁用）
            const pEnabled = (s.operator === 'A');
            const eEnabled = (s.operator === 'B');
            actions.innerHTML = `
                <div class="arena-action-row arena-action-pvp">
                    <div class="arena-side-label ${pEnabled ? 'active' : ''}">玩家A</div>
                    <div class="arena-side-btns">${_actionBtnsHtml(p, 'player', pEnabled)}</div>
                    <div class="arena-switch-row">${_switchBtnsHtml(s, 'player', pEnabled)}</div>
                </div>
                <div class="arena-action-row arena-action-pvp">
                    <div class="arena-side-label ${eEnabled ? 'active' : ''}">玩家B</div>
                    <div class="arena-side-btns">${_actionBtnsHtml(e, 'enemy', eEnabled)}</div>
                    <div class="arena-switch-row">${_switchBtnsHtml(s, 'enemy', eEnabled)}</div>
                </div>
                <div class="arena-log" id="arenaLog"></div>
            `;
        } else {
            // PvE：仅玩家动作按钮（原逻辑）
            actions.innerHTML = `
                <div class="arena-action-row">${_actionBtnsHtml(p, 'player', true)}</div>
                <div class="arena-switch-row">${_switchBtnsHtml(s, 'player', true)}</div>
                <div class="arena-log" id="arenaLog"></div>
            `;
        }

        // 渲染最近 3 条日志
        _renderLog();
    }

    function _fighterHtml(c, side) {
        const img = c.img;
        return `
            ${img
                ? `<img class="fighter-img" src="${img}" alt="${c.name}" onerror="this.style.display='none';this.parentElement.querySelector('.fighter-emoji').style.display=''">`
                : ''}
            <div class="fighter-emoji" style="${img ? 'display:none' : ''}">🐾</div>
            <div class="fighter-name">${c.name}</div>
            <div class="fighter-mini-stats">${_statsText(c)}</div>
        `;
    }

    /**
     * 替补槽 HTML
     * @param {object} c combatant
     * @param {number} i 队内 index
     * @param {boolean} active 是否当前上场
     * @param {'player'|'enemy'} side 方位（PvP 点击换人需带上）
     */
    function _benchSlotHtml(c, i, active, side) {
        const img = c.img;
        const fainted = c.hp <= 0;
        const clickAttr = (!active && !fainted) ? `onclick="CardArenaUI.doSwitch(${i}, '${side}')"` : '';
        return `
            <div class="arena-bench-slot ${active ? 'active' : ''} ${fainted ? 'fainted' : ''}"
                 ${clickAttr}
                 title="${fainted ? '已倒下' : (active ? '上场中' : '点击换人（耗回合）')}">
                ${img
                    ? `<img class="bench-img" src="${img}" alt="${c.name}" onerror="this.style.display='none';this.parentElement.querySelector('.bench-emoji').style.display=''">`
                    : `<span class="bench-emoji">🐾</span>`}
                <div class="bench-hp"><div class="bench-hp-fill" style="width:${_hpPct(c)}%"></div></div>
            </div>
        `;
    }

    // 4 动作按钮（普攻/重击/防御/必杀），CD 中或非操作方禁用
    // sideEnabled：该方是否为当前操作方（PvE 传 true）
    function _actionBtnsHtml(p, side, sideEnabled) {
        const findSk = (id) => (p.skills || []).find(s => s.id === id);
        const buttons = [
            { id: 'attack', label: '⚔️ 普攻', action: { type: 'attack' } },
            { id: 'power_strike', label: '💥 重击', action: { type: 'skill', skillId: 'power_strike' } },
            { id: 'defend', label: '🛡️ 防御', action: { type: 'defend', skillId: 'defend' } },
            { id: 'ultimate', label: '🌟 必杀', action: { type: 'skill', skillId: 'ultimate' } },
        ];
        return buttons.map(b => {
            const sk = findSk(b.id);
            const cd = sk ? sk.currentCd : 0;
            // 非操作方 / 锁中 / CD 中 → 禁用
            const disabled = !sideEnabled || uiLocked || cd > 0;
            const cdTag = cd > 0 ? `<span class="cd-tag">CD ${cd}</span>` : '';
            // action 带 side 字段，doAction 据此路由（PvE 忽略，PvP 用来判定方位）
            const actWithSide = Object.assign({ side: side }, b.action);
            const act = JSON.stringify(actWithSide).replace(/"/g, '&quot;');
            return `<button class="arena-act-btn" ${disabled ? 'disabled' : ''} onclick='CardArenaUI.doAction(${act})'>${b.label}${cdTag}</button>`;
        }).join('');
    }

    // 换人按钮（除当前上场外，存活的）；sideEnabled 控制启用
    function _switchBtnsHtml(s, side, sideEnabled) {
        const team = (side === 'enemy') ? s.enemy : s.player;
        const activeIdx = (side === 'enemy') ? s.activeE : s.activeP;
        return team.map((c, i) => {
            if (i === activeIdx) return '';
            const fainted = c.hp <= 0;
            const disabled = !sideEnabled || uiLocked || fainted;
            return `<button class="arena-switch-btn" ${disabled ? 'disabled' : ''} onclick="CardArenaUI.doSwitch(${i}, '${side}')">🔄 ${c.name}（${c.hp}）</button>`;
        }).join('');
    }

    function _renderLog() {
        const el = document.getElementById('arenaLog');
        if (!el) return;
        const s = CardArena.getState();
        if (!s) return;
        const recent = s.log.slice(-3);
        el.innerHTML = recent.map(ev => `<p>${_logText(ev)}</p>`).join('');
        el.scrollTop = el.scrollHeight;
    }

    // 日志事件 → 简洁文本（不用于判伤害，仅展示）
    function _logText(ev) {
        // PvP：方位→玩家标识
        const s = CardArena.getState();
        let side;
        if (s && s.mode === 'pvp') {
            side = ev.side === 'player' ? '玩家A' : (ev.side === 'enemy' ? '玩家B' : '系统');
        } else {
            side = ev.side === 'player' ? '我方' : (ev.side === 'enemy' ? '敌方' : '系统');
        }
        switch (ev.action) {
            case 'defend': return `${side} 进入防御`;
            case 'attack': return `${side} 普攻 → ${ev.dmg} 伤害`;
            case 'power_strike': return `${side} 重击 → ${ev.dmg} 伤害`;
            case 'ultimate': return `${side} 必杀 → ${ev.dmg} 伤害`;
            case 'switch': return `${side} 换人`;
            case 'faint': return `${side} 倒下`;
            case 'pvpTurnStart': return `轮到 ${ev.operator === 'A' ? '玩家A' : '玩家B'} 操作`;
            case 'battleEnd':
                if (s && s.mode === 'pvp') {
                    return `玩家${ev.pvpWinner || (ev.result === 'win' ? 'A' : 'B')} 获胜！`;
                }
                return ev.result === 'win' ? '胜利！' : '失败';
            default: return '';
        }
    }

    // ===== 动作执行 =====
    /**
     * @param {object} action { type, skillId?, side? } side 由按钮注入（'player'/'enemy'）
     * PvE：忽略 side，走 CardArena.turn
     * PvP：校验 action.side === 当前操作方方位，否则忽略；走 CardArena.turnPvp
     */
    function doAction(action) {
        const s = CardArena.getState();
        if (!s || s.status !== 'ongoing' || uiLocked) return;
        // PvP：校验操作方方位（A=player, B=enemy），非操作方点击忽略
        if (s.mode === 'pvp') {
            const opSide = (s.operator === 'A') ? 'player' : 'enemy';
            if (action.side !== opSide) return;
        }
        uiLocked = true;
        const beforeLogLen = s.log.length;
        let st;
        try {
            st = (s.mode === 'pvp') ? CardArena.turnPvp(action) : CardArena.turn(action);
        } catch (err) {
            uiLocked = false;
            if (typeof showToast === 'function') showToast(err.message || '操作失败');
            return;
        }
        // 本回合新增事件（beforeLogLen..end）
        _animateAndRender(st, beforeLogLen);
    }

    /**
     * @param {number} idx 换人目标 index
     * @param {'player'|'enemy'} side 方位（PvP 区分双方；PvE 默认 player）
     */
    function doSwitch(idx, side) {
        const s = CardArena.getState();
        if (!s || s.status !== 'ongoing' || uiLocked) return;
        const actSide = side || 'player';
        // PvP：校验操作方方位
        if (s.mode === 'pvp') {
            const opSide = (s.operator === 'A') ? 'player' : 'enemy';
            if (actSide !== opSide) return;
        }
        uiLocked = true;
        const beforeLogLen = s.log.length;
        const action = { type: 'switch', switchIdx: idx, side: actSide };
        let st;
        try {
            st = (s.mode === 'pvp') ? CardArena.turnPvp(action) : CardArena.turn(action);
        } catch (err) {
            uiLocked = false;
            if (typeof showToast === 'function') showToast(err.message || '换人失败');
            return;
        }
        _animateAndRender(st, beforeLogLen);
    }

    // 增量取事件 → 浮动伤害 → 解锁 → 重渲染 → 结算
    function _animateAndRender(st, beforeLogLen) {
        const newEvents = st.log.slice(beforeLogLen);
        const ended = (st.status === 'win' || st.status === 'lose');
        if (!ended) uiLocked = false;  // 先解锁，再 renderBattle（按钮 disabled 据此）
        renderBattle();                // 重渲染 stage（含 #arenaDamageZone）
        _popDamage(newEvents);         // 重渲染后再 append 浮动伤害（zone 已存在）
        if (ended) {
            setTimeout(() => _showResult(st.status), 700);
        }
    }

    // 浮动伤害数字（听 dmg 事件，不解析文本）
    function _popDamage(events) {
        const zone = document.getElementById('arenaDamageZone');
        if (!zone) return;
        const s = CardArena.getState();
        events.forEach(ev => {
            if (ev.dmg == null || ev.dmg <= 0) return;
            // side = actor 方：player 攻击 → 命中敌方（右侧），enemy 攻击 → 命中我方（左侧）
            const targetSide = ev.side === 'player' ? 'enemy' : 'player';
            const el = document.createElement('div');
            el.className = 'arena-dmg-pop ' + ev.side;
            el.textContent = '-' + ev.dmg;
            // 落点：命中方 fighter 区域随机偏移
            const isLeft = targetSide === 'player';
            const x = isLeft ? (10 + Math.random() * 30) : (60 + Math.random() * 30);
            const y = 30 + Math.random() * 40;
            el.style.left = x + '%';
            el.style.top = y + '%';
            zone.appendChild(el);
            setTimeout(() => el.remove(), 900);
        });
    }

    // ===== 胜负结算 =====
    // PvP 模式（s.mode==='pvp'）：显示玩家A/B 获胜 + 再战/关闭
    // 闯关模式（pendingStageId!=null）：胜利→clearStage（仅首次发奖+解锁下一关）；失败→不结算进度
    // 自由对战（pendingStageId==null）：随机积分，行为不变
    function _showResult(status) {
        const overlay = document.getElementById('arenaResultOverlay');
        if (!overlay) return;
        const isWin = status === 'win';
        const s = CardArena.getState();

        // —— PvP 本地热座彩蛋 ——
        // win = 玩家A 胜（enemy=玩家B 全灭），lose = 玩家A 负 / 玩家B 胜
        if (s && s.mode === 'pvp') {
            const winner = isWin ? 'A' : 'B';  // A 队=player 全灭→lose→B 胜
            overlay.innerHTML = `
                <div class="arena-result-title win">🏆 玩家${winner} 获胜！</div>
                <div class="text-xs text-muted" style="margin:4px 0;">家庭双人彩蛋 · 友谊赛不计积分</div>
                <div class="arena-result-btns">
                    <button class="btn-primary" onclick="CardArenaUI.rematchPvp()">🔁 再战</button>
                    <button class="btn-secondary" onclick="CardArenaUI.closeBattleModal()">✕ 关闭</button>
                </div>
            `;
            overlay.classList.add('show');
            return;
        }

        // —— 闯关模式 ——
        if (isWin && pendingStageId != null) {
            const reward = _currentStageReward() || { points: 0 };
            const result = clearStage(pendingStageId, reward);
            const stageName = (stagesCache && stagesCache.stages)
                ? (stagesCache.stages.find(s => s.id === pendingStageId) || {}).name
                : ('关卡 ' + pendingStageId);
            const rewardLines = [];
            if (result.firstClear) {
                if (result.granted.points) rewardLines.push(`+${result.granted.points} 积分`);
                if (result.granted.card) rewardLines.push(`🃏 解锁新卡：${_speciesName(result.granted.card)}`);
            } else {
                rewardLines.push('重玩关卡（奖励已领取）');
            }
            const nextBtn = result.unlockedNext
                ? `<button class="btn-primary" onclick="CardArenaUI.gotoNext(${result.unlockedNext})">➡️ 下一关</button>`
                : '';
            overlay.innerHTML = `
                <div class="arena-result-title win">🏆 通关！</div>
                <div class="text-xs text-muted" style="margin-bottom:4px;">${stageName}</div>
                <div class="arena-result-reward">${rewardLines.join(' · ') || '完成'}</div>
                ${result.unlockedNext ? '<div class="text-xs" style="color:#10b981;margin:4px 0;">🔓 已解锁下一关</div>' : ''}
                <div class="arena-result-btns">
                    ${nextBtn}
                    <button class="btn-secondary" onclick="CardArenaUI.replayStage()">🔁 再战</button>
                    <button class="btn-secondary" onclick="CardArenaUI.backToStages()">📋 关卡列表</button>
                </div>
            `;
            overlay.classList.add('show');
            return;
        }
        if (!isWin && pendingStageId != null) {
            overlay.innerHTML = `
                <div class="arena-result-title lose">💀 失败</div>
                <div class="text-xs text-muted" style="margin:4px 0;">再调整队伍试试吧</div>
                <div class="arena-result-btns">
                    <button class="btn-primary" onclick="CardArenaUI.replayStage()">🔁 再战</button>
                    <button class="btn-secondary" onclick="CardArenaUI.backToStages()">📋 关卡列表</button>
                </div>
            `;
            overlay.classList.add('show');
            return;
        }

        // —— 自由对战（练习模式：可随时玩，不计成长积分，避免刷分循环）——
        // 奖励收口到「轻章节首通」；自由练习只给成就感，不走 addGrowthPoints
        overlay.innerHTML = `
            <div class="arena-result-title ${isWin ? 'win' : 'lose'}">${isWin ? '🏆 胜利' : '💀 失败'}</div>
            <div class="arena-result-reward">${isWin ? '练习完成！' : '再调整队伍试试'}</div>
            <div class="text-xs text-muted" style="margin:4px 0;">自由练习 · 不计成长积分（奖励看轻章节首通）</div>
            <div class="arena-result-btns">
                <button class="btn-primary" onclick="CardArenaUI.rematch()">🔁 再战一局</button>
                <button class="btn-secondary" onclick="CardArenaUI.closeBattleModal()">✕ 关闭</button>
            </div>
        `;
        overlay.classList.add('show');
    }

    // 下一关：解锁后直接进入（需关卡已解锁）
    function gotoNext(nextId) {
        const overlay = document.getElementById('arenaResultOverlay');
        if (overlay) overlay.classList.remove('show');
        closeBattleModal();
        enterStage(nextId);
    }

    // 再战当前关：同关同队重打
    function replayStage() {
        const overlay = document.getElementById('arenaResultOverlay');
        if (overlay) overlay.classList.remove('show');
        if (pendingStageId == null || selectedIds.length !== 3) {
            closeBattleModal();
            openTeamSelect();
            return;
        }
        CardArena.reset();
        const res = CardArena.selectTeam(selectedIds.slice());
        if (!res.ok) { closeBattleModal(); openStages(); return; }
        CardArena.startBattle(_currentEnemies());
        logSeenLen = 0;
        lastDamageEvents = [];
        uiLocked = false;
        renderBattle();
    }

    // 返回关卡列表
    function backToStages() {
        const overlay = document.getElementById('arenaResultOverlay');
        if (overlay) overlay.classList.remove('show');
        closeBattleModal();
        openStages();
    }

    // 发放积分：优先走 addGrowthPoints（主积分），再 InventorySystem/ProfileSystem，兜底 localStorage 计数
    function _grantReward(amount) {
        try {
            if (typeof window.addGrowthPoints === 'function') {
                window.addGrowthPoints(amount);
                return;
            }
            if (typeof InventorySystem !== 'undefined' && typeof InventorySystem.addPoints === 'function') {
                InventorySystem.addPoints(amount);
                return;
            }
            if (typeof ProfileSystem !== 'undefined' && typeof ProfileSystem.addPoints === 'function') {
                ProfileSystem.addPoints(amount);
                return;
            }
        } catch (e) { /* 兜底 */ }
        // 兜底：localStorage 计数（不影响主流程）
        try {
            const cur = parseInt(localStorage.getItem('arena_points') || '0', 10);
            localStorage.setItem('arena_points', String(cur + amount));
        } catch (e) {}
    }

    function rematch() {
        const overlay = document.getElementById('arenaResultOverlay');
        if (overlay) overlay.classList.remove('show');
        CardArena.reset();
        // 重新选队 + 开战
        if (selectedIds.length === 3) {
            const res = CardArena.selectTeam(selectedIds.slice());
            if (res.ok) {
                CardArena.startBattle(_currentEnemies());
                logSeenLen = 0;
                lastDamageEvents = [];
                uiLocked = false;
                renderBattle();
                return;
            }
        }
        // 选队信息丢失 → 回到选队
        closeBattleModal();
        openTeamSelect();
    }

    /**
     * PvP 再战：用已存的双方队伍 ID 重新选队 + 开战（不重走选队 modal）
     */
    function rematchPvp() {
        const overlay = document.getElementById('arenaResultOverlay');
        if (overlay) overlay.classList.remove('show');
        CardArena.reset();
        if (pvpTeamAIds.length === 3 && pvpTeamBIds.length === 3) {
            const res = CardArena.selectTeamPvp(pvpTeamAIds.slice(), pvpTeamBIds.slice());
            if (res.ok) {
                CardArena.startBattlePvp();
                logSeenLen = 0;
                lastDamageEvents = [];
                uiLocked = false;
                renderBattle();
                return;
            }
        }
        // 队伍信息丢失 → 回到 PvP 选队
        closeBattleModal();
        openPvpSetup();
    }

    // Public API
    return {
        openTeamSelect,
        togglePick,
        confirmTeam,
        closeTeamModal,
        closeBattleModal,
        doAction,
        doSwitch,
        rematch,
        // PvP 本地热座
        openPvpSetup,
        rematchPvp,
        // 闯关
        openStages,
        closeStages,
        enterStage,
        openFreePlay,
        gotoNext,
        replayStage,
        backToStages,
        getProgress,
        isUnlocked,
        isCleared,
        clearStage,
        // 暴露给测试
        _pickEnemies,
        _loadStages
    };
})();

window.CardArenaUI = CardArenaUI;
