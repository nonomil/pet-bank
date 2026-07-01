/**
 * card-arena.js - 卡牌对战（宝可梦式 3v3 PvE）核心逻辑
 *
 * 设计（方案 docs/方案/2026-07-01-卡牌对战-方案.md §3 机制 / §4 架构 / §5 技术）：
 *   - 纯逻辑 + 状态：选队 / 入场 / 回合制（普攻/技能/防御/换人） / 胜负 / 自动换人
 *   - 不碰 DOM/UI/掉落/EXP（mode adapter 职责，UI 由 app.js 后续接入）
 *   - def/spd 必接：calcDamage(useDef:true) + decideOrder 先手
 *   - combatant 用 BattleEngine.makeCombatant
 *
 * 事件契约（log 数组，供 UI 渲染，非中文文本判伤害）：
 *   { actor, side, action, dmg, targetHp, faint, switch }
 *   side: 'player'|'enemy'  action: 'attack'|'power_strike'|'ultimate'|'defend'|'switch'
 */
const CardArena = (function () {

    // ===== 技能定义（每场重置 CD）=====
    // 普攻 { mult:1, cd:0 }  /  power_strike { mult:1.8, cd:2 }  /  defend { type:'defend', cd:3 }  /  ultimate { mult:3, cd:5 }
    const SKILL_DEFS = {
        attack:       { id: 'attack',       type: 'attack', mult: 1,   cd: 0 },
        power_strike: { id: 'power_strike', type: 'attack', mult: 1.8, cd: 2 },
        defend:       { id: 'defend',       type: 'defend', mult: 0,   cd: 3 },
        ultimate:     { id: 'ultimate',     type: 'attack', mult: 3,   cd: 5 }
    };

    // SSR（传说）稀有度限制：每队 ≤1
    const SSR_RARITIES = ['legendary'];

    let playerTeam = null;   // 玩家选定队伍（combatant×3，已 makeCombatant）
    let arenaState = null;   // 当前对战状态

    /**
     * 构建默认 3 技能槽（普攻 + power_strike + defend + ultimate 四技能）
     * 每只 combatant 都带这 4 个技能，CD 各自独立计数。
     */
    function _defaultSkills() {
        return Object.values(SKILL_DEFS).map(s => ({
            id: s.id, type: s.type, mult: s.mult || 0, cd: s.cd || 0, currentCd: 0
        }));
    }

    /**
     * 从 PetSystem species 构建单个 combatant
     * @param {object} species PetSystem.getAllSpecies() 项（base_hp/atk/def/spd/rarity/imageStages）
     * @param {'player'|'enemy'} side
     */
    function _combatantFromSpecies(species, side) {
        return BattleEngine.makeCombatant({
            id: species.id,
            name: species.name || species.id,
            img: (species.imageStages && species.imageStages['2']) || species.imageUrl || '',
            side: side,
            level: 1,
            hp: species.base_hp || 100,
            maxHp: species.base_hp || 100,
            atk: species.base_atk || 5,
            def: species.base_def || 0,
            spd: species.base_spd || 0,
            skills: _defaultSkills()
        });
    }

    /**
     * 从预设数值构建 enemy combatant（enemySpeciesOrIds 项若是 object 直接用，否则当 speciesId 查）
     */
    function _combatantFromEnemySpec(spec, side) {
        // 已是 combatant-like 对象（含 hp/atk/def/spd）
        if (spec && (spec.hp != null || spec.maxHp != null) && (spec.atk != null)) {
            return BattleEngine.makeCombatant({
                id: spec.id || ('enemy_' + Math.random().toString(36).slice(2, 7)),
                name: spec.name || spec.id || '敌方',
                img: spec.img || '',
                side: side,
                level: spec.level || 1,
                hp: spec.hp != null ? spec.hp : (spec.maxHp || 100),
                maxHp: spec.maxHp || spec.hp || 100,
                atk: spec.atk || 5,
                def: spec.def || 0,
                spd: spec.spd || 0,
                skills: Array.isArray(spec.skills) && spec.skills.length ? spec.skills : _defaultSkills()
            });
        }
        // 否则当 speciesId，查 PetSystem
        const all = (typeof PetSystem !== 'undefined') ? PetSystem.getAllSpecies() : [];
        const sp = all.find(s => s.id === spec);
        if (sp) return _combatantFromSpecies(sp, side);
        // 兜底
        return BattleEngine.makeCombatant({
            id: String(spec), name: String(spec), side: side,
            hp: 100, maxHp: 100, atk: 5, def: 0, spd: 0, skills: _defaultSkills()
        });
    }

    /**
     * 选队：从收集卡 / 任意 species 选 3 只上场
     * @param {string[]} petIds 3 个 species id
     * @returns {object} { ok, error?, team? }
     *
     * 校验：恰好 3 只 + 每队 SSR(legendary) ≤1
     */
    function selectTeam(petIds) {
        if (!Array.isArray(petIds) || petIds.length !== 3) {
            return { ok: false, error: '队伍必须恰好 3 只' };
        }
        const all = (typeof PetSystem !== 'undefined') ? PetSystem.getAllSpecies() : [];
        const picked = [];
        let ssrCount = 0;
        for (const id of petIds) {
            const sp = all.find(s => s.id === id);
            if (!sp) {
                return { ok: false, error: '未找到宠物: ' + id };
            }
            if (SSR_RARITIES.includes(sp.rarity)) ssrCount++;
            picked.push(sp);
        }
        if (ssrCount > 1) {
            return { ok: false, error: '每队 SSR(传说) 最多 1 只' };
        }
        // 首发：spd 最高首发（方案 §3.3）。按 spd 降序排，首发 index=0
        picked.sort((a, b) => (b.base_spd || 0) - (a.base_spd || 0));
        playerTeam = picked.map(sp => _combatantFromSpecies(sp, 'player'));
        return { ok: true, team: playerTeam };
    }

    /**
     * 开始对战
     * @param {(string|object)[]} enemySpeciesOrIds 敌方 3 只（speciesId 或预设数值对象）
     * @returns {object} arenaState
     */
    function startBattle(enemySpeciesOrIds) {
        if (!playerTeam || playerTeam.length !== 3) {
            throw new Error('startBattle: 尚未选队，请先 selectTeam');
        }
        if (!Array.isArray(enemySpeciesOrIds) || enemySpeciesOrIds.length !== 3) {
            throw new Error('startBattle: 敌方必须 3 只');
        }
        const enemy = enemySpeciesOrIds.map(spec => _combatantFromEnemySpec(spec, 'enemy'));
        arenaState = {
            player: playerTeam,
            enemy: enemy,
            activeP: 0,
            activeE: 0,
            round: 1,
            status: 'ongoing',
            log: []
        };
        return arenaState;
    }

    // ===== 内部：取/设 当前上场 combatant =====
    function _activeP() { return arenaState.player[arenaState.activeP]; }
    function _activeE() { return arenaState.enemy[arenaState.activeE]; }

    /**
     * 查找下一只存活的 combatant index（从 start 起环形扫描）
     * @returns {number|null} 存活 index，全灭返回 null
     */
    function _nextAliveIndex(team, start) {
        const n = team.length;
        for (let i = 0; i < n; i++) {
            const idx = (start + i) % n;
            if (team[idx].hp > 0) return idx;
        }
        return null;
    }

    /**
     * 判全灭
     */
    function _allFainted(team) {
        return team.every(c => c.hp <= 0);
    }

    /**
     * 对 target 造成伤害（应用 defending 减伤 + calcDamage useDef）
     * @returns {{ dmg:number, targetHp:number }}
     */
    function _dealDamage(actor, target, skill) {
        const mult = skill ? (skill.mult || 1) : 1;
        // calcDamage(useDef:true) → base = max(1, atk - floor(def/2))，def=0 退化安全（atk）
        let dmg = BattleEngine.calcDamage(actor.atk, target.def, { mult: mult, useDef: true });
        // defend 减伤：目标本回合 defending → 受击 ×0.5（一次性，方案 §3.2）
        if (target.defending) {
            dmg = Math.max(1, Math.floor(dmg * 0.5));
            target.defending = false; // 一次性消耗
        }
        target.hp = Math.max(0, target.hp - dmg);
        return { dmg: dmg, targetHp: target.hp };
    }

    /**
     * 敌方 AI（贪心，方案 §3.4）
     * 返回 action 对象：{ type, skillId? }
     *  - HP<30% 且 defend CD 好 → defend
     *  - ultimate CD 好 → ultimate
     *  - power_strike CD 好 → power_strike
     *  - 否则 attack
     */
    function _enemyDecide(self) {
        const hpRatio = self.maxHp > 0 ? self.hp / self.maxHp : 1;
        const findSkill = (id) => self.skills.find(s => s.id === id);
        const canUse = (sk) => sk && sk.currentCd <= 0;

        if (hpRatio < 0.3) {
            const defend = findSkill('defend');
            if (canUse(defend)) return { type: 'defend', skillId: 'defend' };
        }
        const ult = findSkill('ultimate');
        if (canUse(ult)) return { type: 'skill', skillId: 'ultimate' };
        const ps = findSkill('power_strike');
        if (canUse(ps)) return { type: 'skill', skillId: 'power_strike' };
        return { type: 'attack', skillId: 'attack' };
    }

    /**
     * 执行单个 actor 的一次行动（对 target）
     * 修改 actor/target 状态，push log，返回是否触发 faint（target hp<=0）
     * @param {object} actor 攻击方 combatant
     * @param {object} target 防守方 combatant
     * @param {object} action { type:'attack'|'skill'|'defend', skillId? }
     * @param {'player'|'enemy'} side actor 所属方
     */
    function _execAction(actor, target, action, side) {
        // defend：设置本方 defending 标志（下次受击减伤），不造伤
        if (action.type === 'defend') {
            actor.defending = true;
            const sk = actor.skills.find(s => s.id === (action.skillId || 'defend'));
            if (sk) sk.currentCd = sk.cd; // 进入 CD
            arenaState.log.push({
                actor: actor.id, side: side, action: 'defend',
                dmg: 0, targetHp: target.hp, faint: false, switch: false
            });
            return false;
        }

        // attack / skill → 取 skill 定义
        const skillId = action.skillId || (action.type === 'skill' ? 'power_strike' : 'attack');
        const sk = actor.skills.find(s => s.id === skillId) || SKILL_DEFS.attack;
        // CD 检查：技能在 CD 中 → 退化为普攻（容错，不阻塞）
        let usedSkill = sk;
        if (sk && sk.currentCd > 0) {
            usedSkill = actor.skills.find(s => s.id === 'attack') || SKILL_DEFS.attack;
        }
        const { dmg, targetHp } = _dealDamage(actor, target, usedSkill);
        // 进入 CD（普攻 cd=0 不影响）
        if (usedSkill && usedSkill.cd > 0) usedSkill.currentCd = usedSkill.cd;

        const faint = target.hp <= 0;
        arenaState.log.push({
            actor: actor.id, side: side, action: usedSkill.id,
            dmg: dmg, targetHp: targetHp, faint: faint, switch: false
        });
        return faint;
    }

    /**
     * 倒下后自动换人（不耗回合）
     * @param {'player'|'enemy'} side
     * @returns {boolean} 是否触发了换人
     */
    function _autoSwitchAfterFaint(side) {
        if (side === 'player') {
            const fainted = _activeP();
            if (fainted.hp <= 0) {
                arenaState.log.push({
                    actor: fainted.id, side: 'player', action: 'faint',
                    dmg: 0, targetHp: 0, faint: true, switch: false
                });
                const next = _nextAliveIndex(arenaState.player, arenaState.activeP + 1);
                if (next != null) {
                    arenaState.activeP = next;
                    arenaState.log.push({
                        actor: _activeP().id, side: 'player', action: 'switch',
                        dmg: 0, targetHp: _activeP().hp, faint: false, switch: true
                    });
                    return true;
                }
            }
        } else {
            const fainted = _activeE();
            if (fainted.hp <= 0) {
                arenaState.log.push({
                    actor: fainted.id, side: 'enemy', action: 'faint',
                    dmg: 0, targetHp: 0, faint: true, switch: false
                });
                const next = _nextAliveIndex(arenaState.enemy, arenaState.activeE + 1);
                if (next != null) {
                    arenaState.activeE = next;
                    arenaState.log.push({
                        actor: _activeE().id, side: 'enemy', action: 'switch',
                        dmg: 0, targetHp: _activeE().hp, faint: false, switch: true
                    });
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * 回合末 CD tick（跳过本回合刚启动 CD 的技能）
     * @param {Set<string>} startedThisTurn 本回合进入 CD 的技能 key（actor.id + skillId）
     */
    function _cdTick(startedThisTurn) {
        const tickCombatant = (c) => {
            if (!c.skills) return;
            for (const sk of c.skills) {
                if (sk.currentCd > 0) {
                    const key = c.id + ':' + sk.id;
                    if (!startedThisTurn.has(key)) {
                        sk.currentCd = Math.max(0, sk.currentCd - 1);
                    }
                }
            }
        };
        arenaState.player.forEach(tickCombatant);
        arenaState.enemy.forEach(tickCombatant);
    }

    /**
     * 判胜负
     */
    function _resolveEnd() {
        if (_allFainted(arenaState.enemy)) {
            arenaState.status = 'win';
            arenaState.log.push({
                actor: 'system', side: 'system', action: 'battleEnd',
                dmg: 0, targetHp: 0, faint: false, switch: false, result: 'win'
            });
            return true;
        }
        if (_allFainted(arenaState.player)) {
            arenaState.status = 'lose';
            arenaState.log.push({
                actor: 'system', side: 'system', action: 'battleEnd',
                dmg: 0, targetHp: 0, faint: false, switch: false, result: 'lose'
            });
            return true;
        }
        return false;
    }

    /**
     * 玩家行动 → 敌方 AI 行动（或反序，由 spd 先手决定）
     * @param {object} action { type:'attack'|'skill'|'defend'|'switch', skillId?, switchIdx? }
     * @returns {object} arenaState
     *
     * switch：换人=耗本回合（不出招），activeP=switchIdx
     */
    function turn(action) {
        if (!arenaState || arenaState.status !== 'ongoing') {
            throw new Error('turn: 无进行中的对战');
        }
        if (!action || !action.type) {
            throw new Error('turn: 缺少 action.type');
        }

        const roundStartLogLen = arenaState.log.length;
        const startedThisTurn = new Set(); // 本回合进入 CD 的技能（CD tick 跳过）

        const p = _activeP();
        const e = _activeE();

        // ----- 玩家手动换人：耗本回合，不出招 -----
        if (action.type === 'switch') {
            const idx = action.switchIdx;
            if (typeof idx !== 'number' || idx < 0 || idx >= arenaState.player.length) {
                throw new Error('turn: switchIdx 非法');
            }
            if (idx === arenaState.activeP) {
                throw new Error('turn: 不能换成当前上场宠物');
            }
            if (arenaState.player[idx].hp <= 0) {
                throw new Error('turn: 不能换成已倒下的宠物');
            }
            const oldId = p.id;
            arenaState.activeP = idx;
            arenaState.log.push({
                actor: arenaState.player[idx].id, side: 'player', action: 'switch',
                dmg: 0, targetHp: arenaState.player[idx].hp, faint: false, switch: true,
                from: oldId
            });
            // 换人耗本回合 → 敌方 AI 仍行动一次（玩家本回合不出招）
            // 敌方对玩家新上场 combatant 攻击
            const enemyAction = _enemyDecide(e);
            _execAction(e, _activeP(), enemyAction, 'enemy');
            if (enemyAction.skillId) startedThisTurn.add(e.id + ':' + enemyAction.skillId);
            _autoSwitchAfterFaint('player');
            if (_resolveEnd()) { arenaState.round++; return arenaState; }

            _cdTick(startedThisTurn);
            arenaState.round++;
            return arenaState;
        }

        // ----- 普攻/技能/防御：按 spd 先手决定顺序 -----
        const order = BattleEngine.decideOrder(p.spd, e.spd); // 'A'=玩家先, 'B'=敌方先

        const playerAct = () => {
            const curP = _activeP();
            const curE = _activeE();
            // 玩家 defend/attack/skill
            const act = { type: action.type, skillId: action.skillId || (action.type === 'defend' ? 'defend' : 'attack') };
            _execAction(curP, curE, act, 'player');
            if (act.skillId && action.type !== 'attack') {
                startedThisTurn.add(curP.id + ':' + act.skillId);
            }
        };
        const enemyAct = () => {
            const curP = _activeP();
            const curE = _activeE();
            // 敌方已倒下则跳过（不会再行动）
            if (curE.hp <= 0) return;
            const ea = _enemyDecide(curE);
            _execAction(curE, curP, ea, 'enemy');
            if (ea.skillId && ea.type !== 'attack') {
                startedThisTurn.add(curE.id + ':' + ea.skillId);
            }
        };

        if (order === 'A') {
            playerAct();
            if (!_resolveEnd()) {
                _autoSwitchAfterFaint('enemy');
                if (!_resolveEnd()) enemyAct();
            }
        } else {
            enemyAct();
            if (!_resolveEnd()) {
                _autoSwitchAfterFaint('player');
                if (!_resolveEnd()) playerAct();
            }
        }

        // ----- 倒下自动换人 + 胜负判定 -----
        _autoSwitchAfterFaint('player');
        _autoSwitchAfterFaint('enemy');
        if (_resolveEnd()) { arenaState.round++; return arenaState; }

        // ----- 回合末 CD tick（跳过本回合启动的）-----
        _cdTick(startedThisTurn);
        arenaState.round++;
        return arenaState;
    }

    /**
     * 获取当前对战状态
     */
    function getState() {
        return arenaState;
    }

    /**
     * 重置：清空选队 + 对战状态
     */
    function reset() {
        playerTeam = null;
        arenaState = null;
    }

    // Public API
    return {
        selectTeam,
        startBattle,
        turn,
        getState,
        reset,
        // 暴露技能定义供 UI/测试查阅
        SKILL_DEFS
    };
})();

window.CardArena = CardArena;
