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
    function openTeamSelect() {
        const ids = _getCollectedIds();
        if (ids.length < 3) {
            // 收集不足：提示去探索，不打开 modal
            if (typeof showToast === 'function') showToast('收集的宠物不足 3 只，先去探索收集宠物卡 ⛏️');
            else alert('收集的宠物不足 3 只，先去探索收集宠物卡');
            return;
        }
        selectedIds = [];
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
            // SSR 校验提示（最终以 CardArena.selectTeam 为准）
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
        if (text) text.textContent = `已选 ${selectedIds.length} / 3`;
        if (btn) btn.disabled = selectedIds.length !== 3;
    }

    function confirmTeam() {
        if (selectedIds.length !== 3) return;
        const res = CardArena.selectTeam(selectedIds.slice());
        if (!res.ok) {
            if (typeof showToast === 'function') showToast(res.error || '选队失败');
            return;
        }
        // 关选队 modal
        document.getElementById('arenaTeamModal').classList.remove('show');
        // 开战：3 预设敌人
        CardArena.startBattle(_pickEnemies());
        logSeenLen = 0;
        lastDamageEvents = [];
        uiLocked = false;
        openBattleModal();
    }

    function closeTeamModal() {
        document.getElementById('arenaTeamModal').classList.remove('show');
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
        const stage = document.getElementById('arenaStage');
        const p = s.player[s.activeP];
        const e = s.enemy[s.activeE];

        stage.innerHTML = `
            <div class="arena-round-tag">第 ${s.round} 回合</div>
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

        // 玩家替补队列
        const bench = document.getElementById('arenaBench');
        bench.innerHTML = '<span style="font-size:11px;align-self:center;opacity:.7;margin-right:4px;">替补</span>' +
            s.player.map((c, i) => _benchSlotHtml(c, i, i === s.activeP)).join('');

        // 动作区
        const actions = document.getElementById('arenaActions');
        actions.innerHTML = `
            <div class="arena-action-row">${_actionBtnsHtml(p)}</div>
            <div class="arena-switch-row">${_switchBtnsHtml(s)}</div>
            <div class="arena-log" id="arenaLog"></div>
        `;

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

    function _benchSlotHtml(c, i, active) {
        const img = c.img;
        const fainted = c.hp <= 0;
        return `
            <div class="arena-bench-slot ${active ? 'active' : ''} ${fainted ? 'fainted' : ''}"
                 ${(!active && !fainted) ? `onclick="CardArenaUI.doSwitch(${i})"` : ''}
                 title="${fainted ? '已倒下' : (active ? '上场中' : '点击换人（耗回合）')}">
                ${img
                    ? `<img class="bench-img" src="${img}" alt="${c.name}" onerror="this.style.display='none';this.parentElement.querySelector('.bench-emoji').style.display=''">`
                    : `<span class="bench-emoji">🐾</span>`}
                <div class="bench-hp"><div class="bench-hp-fill" style="width:${_hpPct(c)}%"></div></div>
            </div>
        `;
    }

    // 4 动作按钮（普攻/重击/防御/必杀），CD 中禁用
    function _actionBtnsHtml(p) {
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
            const disabled = uiLocked || cd > 0;
            const cdTag = cd > 0 ? `<span class="cd-tag">CD ${cd}</span>` : '';
            const act = JSON.stringify(b.action).replace(/"/g, '&quot;');
            return `<button class="arena-act-btn" ${disabled ? 'disabled' : ''} onclick='CardArenaUI.doAction(${act})'>${b.label}${cdTag}</button>`;
        }).join('');
    }

    // 换人按钮（除当前上场外，存活的）
    function _switchBtnsHtml(s) {
        return s.player.map((c, i) => {
            if (i === s.activeP) return '';
            const fainted = c.hp <= 0;
            const disabled = uiLocked || fainted;
            return `<button class="arena-switch-btn" ${disabled ? 'disabled' : ''} onclick="CardArenaUI.doSwitch(${i})">🔄 ${c.name}（${c.hp}）</button>`;
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
        const side = ev.side === 'player' ? '我方' : (ev.side === 'enemy' ? '敌方' : '系统');
        switch (ev.action) {
            case 'defend': return `${side} 进入防御`;
            case 'attack': return `${side} 普攻 → ${ev.dmg} 伤害`;
            case 'power_strike': return `${side} 重击 → ${ev.dmg} 伤害`;
            case 'ultimate': return `${side} 必杀 → ${ev.dmg} 伤害`;
            case 'switch': return `${side} 换人`;
            case 'faint': return `${side} 倒下`;
            case 'battleEnd': return ev.result === 'win' ? '胜利！' : '失败';
            default: return '';
        }
    }

    // ===== 动作执行 =====
    function doAction(action) {
        const s = CardArena.getState();
        if (!s || s.status !== 'ongoing' || uiLocked) return;
        uiLocked = true;
        const beforeLogLen = s.log.length;
        let st;
        try {
            st = CardArena.turn(action);
        } catch (err) {
            uiLocked = false;
            if (typeof showToast === 'function') showToast(err.message || '操作失败');
            return;
        }
        // 本回合新增事件（beforeLogLen..end）
        _animateAndRender(st, beforeLogLen);
    }

    function doSwitch(idx) {
        const s = CardArena.getState();
        if (!s || s.status !== 'ongoing' || uiLocked) return;
        uiLocked = true;
        const beforeLogLen = s.log.length;
        let st;
        try {
            st = CardArena.turn({ type: 'switch', switchIdx: idx });
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
    function _showResult(status) {
        const overlay = document.getElementById('arenaResultOverlay');
        if (!overlay) return;
        const isWin = status === 'win';
        const reward = isWin ? Math.floor(30 + Math.random() * 30) : 5; // 胜 30-60 积分，败 5 积分
        // 发放积分（InventorySystem 积分 / 简单 localStorage）
        _grantReward(reward);
        overlay.innerHTML = `
            <div class="arena-result-title ${isWin ? 'win' : 'lose'}">${isWin ? '🏆 胜利' : '💀 失败'}</div>
            <div class="arena-result-reward">+${reward} 积分</div>
            <div class="arena-result-btns">
                <button class="btn-primary" onclick="CardArenaUI.rematch()">🔁 再战一局</button>
                <button class="btn-secondary" onclick="CardArenaUI.closeBattleModal()">✕ 关闭</button>
            </div>
        `;
        overlay.classList.add('show');
    }

    // 发放积分：尝试走 InventorySystem，兜底 localStorage 计数
    function _grantReward(amount) {
        try {
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
                CardArena.startBattle(_pickEnemies());
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
        // 暴露给测试
        _pickEnemies
    };
})();

window.CardArenaUI = CardArenaUI;
