/**
 * exploration.js - 探索冒险 + 地图路线渲染
 */

const ExplorationSystem = (function () {
    /**
     * S1：阿基米德螺旋布局生成器 r = b·θ（外→内顺时针，约 2.5 圈）。
     * 参数：K=42（r→百分比映射，外圈首点落 ~8%/92% 边缘带）；
     *      θStart=5π，dθ=5π/(count-1)（12 点跨 2.5 圈）；
     *      b=K/(5π)，外圈首点 r=K≈42%。
     * 半径最小的最后 4 点（i=8~11，castle/volcano/space/stargarden）
     * 因 190px 固定卡片在中心死区（r<15%）必然重叠，**手调坐标**拉开间距，
     * 标记 [手调]，保证路径相邻卡片不覆盖（相邻间距均 ≥22%）。
     * 返回 [{x,y},...] 顺时针向内；数组前部=外圈=低章节，末部=中心=第5章终点。
     */
    function generateSpiralLayout(count) {
        const n = count || 12;
        const K = 42;
        const thetaStart = 5 * Math.PI;            // 外圈起始角
        const dtheta = (5 * Math.PI) / (n - 1);    // 每步
        const b = K / (5 * Math.PI);               // 使外圈首点 r=K
        const pts = [];
        for (let i = 0; i < n; i++) {
            const theta = thetaStart - i * dtheta; // 顺时针向内
            const r = b * theta;
            const t = -theta;                       // 屏幕 y 向下 → -θ 视觉顺时针
            pts.push({
                x: +(50 + r * Math.cos(t)).toFixed(1),
                y: +(50 + r * Math.sin(t)).toFixed(1)
            });
        }
        // [手调] 最后 4 点（r 最小、中心死区）改人工坐标，保证相邻不覆盖
        pts[8]  = { x: 40, y: 70 };  // castle    [手调] 左下
        pts[9]  = { x: 62, y: 72 };  // volcano   [手调] 右下
        pts[10] = { x: 68, y: 44 };  // space     [手调] 右上
        pts[11] = { x: 46, y: 57 };  // stargarden[手调] 核心终点
        return pts;
    }

    // 螺旋坐标由 generateSpiralLayout() 生成；size/chapter/id 保留，章节顺序外→内（1→5）。
    const _SPIRAL = generateSpiralLayout(12);
    const MAP_LAYOUT = [
        { id: 'forest',     x: _SPIRAL[0].x,  y: _SPIRAL[0].y,  size: 198, chapter: 1 },
        { id: 'beach',      x: _SPIRAL[1].x,  y: _SPIRAL[1].y,  size: 182, chapter: 2 },
        { id: 'candy',      x: _SPIRAL[2].x,  y: _SPIRAL[2].y,  size: 176, chapter: 2 },
        { id: 'waterfall',  x: _SPIRAL[3].x,  y: _SPIRAL[3].y,  size: 176, chapter: 3 },
        { id: 'underwater', x: _SPIRAL[4].x,  y: _SPIRAL[4].y,  size: 188, chapter: 3 },
        { id: 'desert',     x: _SPIRAL[5].x,  y: _SPIRAL[5].y,  size: 176, chapter: 3 },
        { id: 'mountain',   x: _SPIRAL[6].x,  y: _SPIRAL[6].y,  size: 182, chapter: 4 },
        { id: 'cave',       x: _SPIRAL[7].x,  y: _SPIRAL[7].y,  size: 198, chapter: 4 },
        { id: 'castle',     x: _SPIRAL[8].x,  y: _SPIRAL[8].y,  size: 188, chapter: 4 },
        { id: 'volcano',    x: _SPIRAL[9].x,  y: _SPIRAL[9].y,  size: 176, chapter: 4 },
        { id: 'space',      x: _SPIRAL[10].x, y: _SPIRAL[10].y, size: 174, chapter: 5 },
        { id: 'stargarden', x: _SPIRAL[11].x, y: _SPIRAL[11].y, size: 194, chapter: 5 }
    ];
    // 章节（03 章节结构）：1 起点花园 / 2 森林边界 / 3 海边集市 / 4 高地洞窟 / 5 星空终点
    const CHAPTER_THEME = {
        1: { name: '起点花园', color: '#7ee68a' },
        2: { name: '森林边界', color: '#5ec8a0' },
        3: { name: '海边集市', color: '#5ab8d4' },
        4: { name: '高地洞窟', color: '#c89060' },
        5: { name: '星空终点', color: '#a888d4' }
    };

    let scenes = null;
    let currentBattle = null;
    let unlockedScenes = {};

    async function loadScenes() {
        if (scenes) return scenes;
        try {
            const response = await fetch('data/scenes.json');
            scenes = await response.json();
            loadUnlockState();
            return scenes;
        } catch (e) {
            console.error('Failed to load scenes.json:', e);
            return { scenes: [] };
        }
    }

    function loadUnlockState() {
        try {
            unlockedScenes = JSON.parse(localStorage.getItem('petbank_unlocked_scenes') || '{}');
        } catch {
            unlockedScenes = {};
        }
    }

    function saveUnlockState() {
        localStorage.setItem('petbank_unlocked_scenes', JSON.stringify(unlockedScenes));
    }

    function getAllScenes() {
        return scenes?.scenes || [];
    }

    function getSceneById(sceneId) {
        return getAllScenes().find((scene) => scene.id === sceneId) || null;
    }

    function getCurrentBattle() {
        return currentBattle;
    }

    function getMapLayout() {
        return MAP_LAYOUT.map((item) => ({ ...item }));
    }

    function isSceneUnlocked(scene) {
        const pet = PetSystem.getState();
        if (pet.level < (scene.min_level || 1)) return false;
        if ((scene.unlock_cost || 0) > 0 && !unlockedScenes[scene.id]) return false;
        return true;
    }

    function getUnlockedCount() {
        return getAllScenes().filter((scene) => isSceneUnlocked(scene)).length;
    }

    function getCurrentPoints() {
        return parseInt(localStorage.getItem('petbank_points') || '0', 10);
    }

    function updatePointBindings() {
        if (typeof window.totalPoints !== 'undefined') {
            window.totalPoints = getCurrentPoints();
        }
        if (typeof window.updateStats === 'function') {
            window.updateStats();
        }
    }

    function updateMapStats() {
        const totalSceneCount = getAllScenes().length || 1;
        const unlockedCount = getUnlockedCount();
        const countEl = document.getElementById('mapUnlockedCount');
        const barEl = document.getElementById('mapProgressBar');
        const ptsEl = document.getElementById('mapPoints');
        const petLevelEl = document.getElementById('mapPetLevel');
        const winsEl = document.getElementById('mapWins');
        const pet = PetSystem.getState();

        if (countEl) countEl.textContent = `${unlockedCount}/${totalSceneCount} 场景已解锁`;
        if (barEl) barEl.style.width = `${Math.round(unlockedCount / totalSceneCount * 100)}%`;
        if (ptsEl) ptsEl.textContent = getCurrentPoints();
        if (petLevelEl) petLevelEl.textContent = `Lv.${pet.level}`;
        if (winsEl) winsEl.textContent = pet.wins || 0;
    }

    function buildRouteSvg() {
        const points = MAP_LAYOUT.map((node) => `${node.x} ${node.y}`).join(', ');
        const stars = MAP_LAYOUT.map((node) => `
            <circle class="map-route-spark" cx="${node.x}" cy="${node.y}" r="1.8"></circle>
        `).join('');
        return `
            <svg class="map-route-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline class="map-route-line" points="${points}" vector-effect="non-scaling-stroke"></polyline>
                <polyline class="map-route-dash" points="${points}" vector-effect="non-scaling-stroke"></polyline>
                ${stars}
            </svg>
        `;
    }

    function buildMapNode(scene, layout, activeSceneId, boardId) {
        const unlocked = isSceneUnlocked(scene);
        const unlockCost = scene.unlock_cost || 0;
        const isLockedByPoints = unlockCost > 0 && !unlockedScenes[scene.id];
        // S0(F2)：解锁动作透传 boardId，避免重渲回首页板
        const safeBoard = boardId || 'sceneGridMap';
        const action = unlocked
            ? `ExplorationSystem.goExplore('${scene.id}')`
            : `ExplorationSystem.tryUnlock('${scene.id}', '${safeBoard}')`;
        const theme = CHAPTER_THEME[layout.chapter] || CHAPTER_THEME[1];
        const stateClass = [
            'map-scene-node',
            `chapter-${layout.chapter}`,
            unlocked ? 'is-open' : 'is-locked',
            activeSceneId === scene.id ? 'is-active' : ''
        ].filter(Boolean).join(' ');
        const pillText = unlocked
            ? `<span class="map-scene-pill">危险 ${scene.danger_level}</span><span class="map-scene-pill">HP -${scene.hp_cost}</span>`
            : `<span class="map-scene-pill locked">Lv.${scene.min_level}</span>${unlockCost > 0 ? `<span class="map-scene-pill locked">${unlockCost} 分</span>` : ''}`;

        return `
            <button
                type="button"
                class="${stateClass}"
                style="left:${layout.x}%;top:${layout.y}%;--node-size:${layout.size}px;--chapter-color:${theme.color};"
                onclick="${action}"
                aria-label="${unlocked ? `前往${scene.name}` : `解锁${scene.name}`}"
            >
                <div class="map-scene-bubble">
                    <div class="map-scene-thumb">
                        <img src="${scene.image}" alt="${scene.name}" loading="lazy">
                        <div class="map-scene-meta">
                            <div class="map-scene-title"><span>${scene.emoji}</span><span>${scene.name}</span></div>
                            <div class="map-scene-chapter" style="color:${theme.color}">${theme.name}</div>
                            <div class="map-scene-desc">${scene.description}</div>
                        </div>
                        ${!unlocked ? `
                            <div class="map-scene-lock">
                                <strong>🔒 ${isLockedByPoints ? `${unlockCost} 积分解锁` : `需要 Lv.${scene.min_level}`}</strong>
                                <span>${isLockedByPoints ? `当前需达到 Lv.${scene.min_level}` : '升级后即可进入'}</span>
                            </div>` : ''
                        }
                    </div>
                    <div class="map-scene-pills">${pillText}</div>
                    <div class="map-scene-star"></div>
                </div>
            </button>
        `;
    }

    function renderSceneGridMap(activeSceneId = null, boardId = 'sceneGridMap') {
        const board = document.getElementById(boardId);
        if (!board || !scenes) return;

        const sceneMap = new Map(getAllScenes().map((scene) => [scene.id, scene]));
        const nodes = MAP_LAYOUT
            .map((layout) => {
                const scene = sceneMap.get(layout.id);
                return scene ? buildMapNode(scene, layout, activeSceneId, boardId) : '';
            })
            .join('');

        board.innerHTML = `${nodes}${buildRouteSvg()}`;
        updateMapStats();
    }

    function unlockScene(sceneId) {
        const scene = getSceneById(sceneId);
        if (!scene) return { success: false, msg: '场景不存在' };
        if (unlockedScenes[sceneId]) return { success: false, msg: '已解锁' };
        if ((scene.unlock_cost || 0) <= 0) return { success: false, msg: '免费场景无需解锁' };

        const pet = PetSystem.getState();
        if (pet.level < scene.min_level) return { success: false, msg: `需要 Lv.${scene.min_level}` };

        const points = getCurrentPoints();
        if (points < scene.unlock_cost) return { success: false, msg: `积分不足（需要 ${scene.unlock_cost}）` };

        if (typeof window.addGrowthPoints === 'function') {
            window.addGrowthPoints(-scene.unlock_cost);
        } else {
            localStorage.setItem('petbank_points', String(Math.max(0, points - scene.unlock_cost)));
        }
        unlockedScenes[sceneId] = true;
        saveUnlockState();
        updatePointBindings();
        updateMapStats();
        return { success: true, msg: `解锁成功！花费 ${scene.unlock_cost} 积分` };
    }

    function tryUnlock(sceneId, boardId) {
        const result = unlockScene(sceneId);
        if (typeof window.showToast === 'function') {
            window.showToast(result.msg);
        } else {
            alert(result.msg);
        }
        if (result.success) {
            // S0(F2)：重渲保留调用方所在 board，默认首页板；探索 tab 内调用透传 'sceneGrid'。
            const targetBoard = boardId || 'sceneGridMap';
            renderSceneGridMap(sceneId, targetBoard);
            if (targetBoard === 'sceneGrid' && typeof window.renderExplorePage === 'function') {
                void window.renderExplorePage(sceneId);
            }
        }
    }

    // 跳转探索页
    function goExplore(sceneId) {
        // 宠物小屋 R5 第二守卫（F1）：hp<=0 且已选宠 → 拦截，不进任何探索页
        if (window.PetSystem) {
            try {
                const s = PetSystem.getState();
                if (s.species && s.hp <= 0) {
                    alert('宠物倒下了，请先去宠物小屋救援！');
                    return;
                }
            } catch (e) {}
        }
        if (window.ExplorationDetail && typeof window.ExplorationDetail.show === 'function') {
            window.ExplorationDetail.show(sceneId);
            return;
        }
        if (typeof window.switchPage === 'function') {
            window.switchPage('explore');
        }
        if (typeof window.startExplorationUI === 'function') {
            window.startExplorationUI(sceneId);
            return;
        }
        if (typeof window.renderExplorePage === 'function') {
            void window.renderExplorePage(sceneId);
        }
    }

    function showSceneDetail(sceneId) {
        goExplore(sceneId);
    }

    function closeSceneDetail() {
        if (window.ExplorationDetail && typeof window.ExplorationDetail.exit === 'function') {
            window.ExplorationDetail.exit();
            return;
        }
        if (typeof window.renderExplorePage === 'function') {
            void window.renderExplorePage();
        }
    }

    function startExploration(sceneId) {
        const scene = getSceneById(sceneId);
        if (!scene) return { success: false, msg: '场景不存在' };
        if (!isSceneUnlocked(scene)) return { success: false, msg: '场景未解锁' };

        const pet = PetSystem.getState();
        if (pet.hp <= 0) return { success: false, msg: '宠物已倒下，无法探索' };
        if (pet.hp < scene.hp_cost) return { success: false, msg: `HP 不足，需要 ${scene.hp_cost}` };

        PetSystem.takeDamage(scene.hp_cost);
        PetSystem.addExploration();

        if (scene.monsters.length > 0) {
            // 章末精英区（danger>=4）40% 概率遇 species 敌人（图鉴宠物，首胜定向掉卡）
            let monster = null;
            if (scene.danger_level >= 4 && Math.random() < 0.4 && typeof PetSystem.getAllSpecies === 'function') {
                monster = _pickSpeciesEnemy(scene.danger_level);
            }
            if (!monster) {
                monster = scene.monsters[Math.floor(Math.random() * scene.monsters.length)];
            }
            return { success: true, msg: `遇到 ${monster.name}！`, battle: { scene, monster } };
        }

        const expGain = 5 + scene.danger_level * 2;
        const result = PetSystem.addExp(expGain);
        return {
            success: true,
            msg: `安全通过！获得 ${expGain} EXP${result.leveled_up ? `，升级到 Lv.${result.new_level}！` : ''}`,
            leveled_up: result.leveled_up
        };
    }

    // 章末精英区 species 敌人（图鉴宠物，包装名，首胜定向掉卡；见 docs/卡牌系统/方案/2026-07-01-探索species敌人-规则.md）
    function _pickSpeciesEnemy(danger) {
        const all = PetSystem.getAllSpecies();
        const rarities = danger >= 5 ? ['legendary', 'epic'] : ['epic', 'legendary'];
        const pool = all.filter(s => rarities.includes(s.rarity));
        if (pool.length === 0) return null;
        const sp = pool[Math.floor(Math.random() * pool.length)];
        // 命名包装（不敌对感）：野生/失控/镜像/同族守卫 4 选 1
        const base = sp.name || sp.id;
        const r = Math.random();
        const name = r < 0.25 ? `${base}同族守卫`
            : r < 0.5 ? `野生${base}`
            : r < 0.75 ? `失控${base}`
            : `镜像${base}`;
        return {
            id: sp.id + '_enemy',
            name: name,
            emoji: sp.emoji || '🐾',
            hp: sp.base_hp,
            atk: sp.base_atk,
            def: sp.base_def || 0,
            exp: 10 + danger * 5,
            drops: [],
            isSpecies: true,
            speciesId: sp.id,
            baseName: base
        };
    }

    function startBattle(scene, monster) {
        const pet = PetSystem.getState();
        // 战斗深化：每场战斗重置 CD/防御态（设计稿 §9）
        if (typeof PetSystem.resetBattleState === 'function') {
            PetSystem.resetBattleState();
        }
        const arenaChapter = (MAP_LAYOUT.find(m => m.id === scene.id) || {}).chapter || 1;
        currentBattle = {
            scene,
            monster: Object.assign({}, monster, { current_hp: monster.hp }),
            pet_max_hp: pet.hp,
            log: [],
            turn: 1,
            status: 'ongoing',
            chapter: arenaChapter
        };
        currentBattle.log.push({ type: 'system', text: `⚔️ 遭遇战：${pet.species_data?.name || '宠物'} vs ${monster.name} (Lv.${scene.danger_level})` });
        return currentBattle;
    }

    // battleTurn(action)
    //   action: 'attack' | 'flee' | { type:'skill', skillId } | { type:'item', itemId, itemName, resultMsg }
    // 技能/道具都消耗 1 回合（敌人反击），defend 在敌人反击时减伤并清除
    function battleTurn(action = 'attack') {
        if (!currentBattle || currentBattle.status !== 'ongoing') return null;

        const battle = currentBattle;
        const pet = PetSystem.getState();
        const petAtk = PetSystem.getTotalAtk();

        battle.turn += 1;

        // 归一化 action 为对象形式
        const act = (typeof action === 'string') ? { type: action } : (action || { type: 'attack' });
        // 本回合刚启动 CD 的技能，回合末 tick 时跳过（保证 CD=N 真正封禁 N 回合）
        const cdStartedThisTurn = [];

        if (act.type === 'flee') {
            // flee_chance 对齐 combat.json（0.3）
            const fleeChance = 0.3;
            if (Math.random() < fleeChance) {
                battle.status = 'fled';
                battle.log.push({ type: 'system', text: '🏃 逃跑成功！' });
                const expGain = Math.floor(battle.monster.exp * 0.3);
                PetSystem.addExp(expGain);
                battle.log.push({ type: 'reward', text: `获得 ${expGain} EXP (逃跑奖励减半)` });
            } else {
                battle.log.push({ type: 'system', text: '逃跑失败！' });
                const damage = Math.max(1, battle.monster.atk - Math.floor(pet.level / 2));
                const ko = PetSystem.takeDamage(damage, { applyDefend: true });
                battle.log.push({ type: 'enemy', text: `${battle.monster.name} 攻击！造成 ${damage} 伤害` });
                if (ko || PetSystem.getState().hp <= 0) {
                    battle.status = 'lost';
                    battle.log.push({ type: 'system', text: '💀 宠物倒下了...' });
                }
            }
            // 回合结束：CD 递减
            if (typeof PetSystem.tickCooldowns === 'function') PetSystem.tickCooldowns(cdStartedThisTurn);
            return battle;
        }

        // ---- 玩家行动 ----
        let playerDmg = 0;
        let actionLabel = '攻击';

        if (act.type === 'skill') {
            const skill = PetSystem.getSkill(act.skillId);
            if (!skill) {
                battle.log.push({ type: 'system', text: `未知技能：${act.skillId}` });
                return battle;
            }
            // CD 校验（理论上 UI 已禁用，二次防护）
            if (!PetSystem.canUseSkill(act.skillId)) {
                battle.log.push({ type: 'system', text: `${skill.name} 冷却中（剩 ${PetSystem.getCooldown(act.skillId)} 回合）` });
                return battle;
            }
            if (skill.type === 'defend') {
                // 防御：设 defending，下回合减伤，本回合不造伤
                PetSystem.setDefending(true);
                battle.log.push({ type: 'player', text: `${skill.icon} ${skill.name}！下回合受击减伤 50%` });
                PetSystem.startCooldown(skill.id, skill.cooldown);
                cdStartedThisTurn.push(skill.id);
            } else {
                // 攻击型技能：multiplier × getTotalAtk
                playerDmg = BattleEngine.calcDamage(petAtk, battle.monster.def || 0, { mult: skill.multiplier, randSub: 0 });
                battle.monster.current_hp -= playerDmg;
                battle.log.push({
                    type: 'player',
                    text: `${skill.icon} ${skill.name}！对 ${battle.monster.name} 造成 ${playerDmg} 伤害 (${Math.max(0, battle.monster.current_hp)}/${battle.monster.hp})`
                });
                PetSystem.startCooldown(skill.id, skill.cooldown);
                cdStartedThisTurn.push(skill.id);
            }
        } else if (act.type === 'item') {
            // 道具：使用动作在 app.js 已完成（InventorySystem.useItem），这里只记录日志 + 消耗回合
            battle.log.push({ type: 'reward', text: `🎒 使用 ${act.itemName || '道具'}：${act.resultMsg || '生效'}` });
        } else {
            // 普攻
            playerDmg = BattleEngine.calcDamage(petAtk, battle.monster.def || 0, { useDef: false });
            battle.monster.current_hp -= playerDmg;
            battle.log.push({
                type: 'player',
                text: `⚔️ 你攻击 ${battle.monster.name}，造成 ${playerDmg} 伤害 (${Math.max(0, battle.monster.current_hp)}/${battle.monster.hp})`
            });
        }

        // ---- 判定胜利 ----
        if (battle.monster.current_hp <= 0) {
            battle.status = 'won';
            PetSystem.addWin();
            const expGain = battle.monster.exp + battle.scene.danger_level * 3;
            const result = PetSystem.addExp(expGain);
            battle.log.push({
                type: 'reward',
                text: `🎉 胜利！获得 ${expGain} EXP${result.leveled_up ? `，升级 Lv.${result.new_level}！` : ''}`
            });

            for (const drop of battle.monster.drops || []) {
                if (Math.random() < drop.rate) {
                    InventorySystem.addItem(drop.item_id, 1);
                    const itemData = InventorySystem.getItemData(drop.item_id);
                    battle.log.push({ type: 'reward', text: `📦 掉落: ${itemData?.name || drop.item_id} x1` });
                }
            }
            for (const rare of battle.scene.rare_drops || []) {
                if (Math.random() < rare.rate) {
                    InventorySystem.addItem(rare.item_id, 1);
                    const itemData = InventorySystem.getItemData(rare.item_id);
                    battle.log.push({ type: 'reward', text: `💎 稀有掉落: ${itemData?.name || rare.item_id} x1` });
                }
            }
            // 回合结束：CD 递减
            if (typeof PetSystem.tickCooldowns === 'function') PetSystem.tickCooldowns(cdStartedThisTurn);
            return battle;
        }

        // ---- 敌人反击（defend/道具/普攻/技能后均触发，除非玩家已胜利）----
        const enemyAtk = BattleEngine.calcDamage(battle.monster.atk, 0, { randMax: 2 });
        // applyDefend=true：若玩家处于 defending 态，takeDamage 内部伤害×0.5 并清除 defending（一次性）
        const wasDefending = !!(typeof PetSystem.isDefending === 'function' && PetSystem.isDefending());
        const ko = PetSystem.takeDamage(enemyAtk, { applyDefend: true });
        battle.log.push({
            type: 'enemy',
            text: `${battle.monster.name} 反击！造成 ${enemyAtk} 伤害${wasDefending ? '（🛡️ 防御减伤已生效）' : ''}`
        });
        if (ko) {
            battle.status = 'lost';
            battle.log.push({ type: 'system', text: '💀 宠物倒下了...' });
        }

        // 回合结束：CD 递减
        if (typeof PetSystem.tickCooldowns === 'function') PetSystem.tickCooldowns(cdStartedThisTurn);

        return battle;
    }

    function endBattle() {
        currentBattle = null;
    }

    return {
        loadScenes,
        getAllScenes,
        getSceneById,
        getCurrentBattle,
        getMapLayout,
        generateSpiralLayout,
        getUnlockedCount,
        isSceneUnlocked,
        unlockScene,
        tryUnlock,
        renderSceneGridMap,
        updateMapStats,
        goExplore,
        showSceneDetail,
        closeSceneDetail,
        startExploration,
        startBattle,
        battleTurn,
        endBattle
    };
})();

window.ExplorationSystem = ExplorationSystem;
