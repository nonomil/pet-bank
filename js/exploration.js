/**
 * exploration.js - 探索冒险 + 地图路线渲染
 */

const ExplorationSystem = (function () {
    const MAP_LAYOUT = [
        { id: 'forest', x: 17, y: 18, size: 198, chapter: 1 },
        { id: 'beach', x: 70, y: 12, size: 182, chapter: 2 },
        { id: 'candy', x: 28, y: 43, size: 176, chapter: 2 },
        { id: 'waterfall', x: 56, y: 42, size: 176, chapter: 3 },
        { id: 'underwater', x: 22, y: 72, size: 188, chapter: 3 },
        { id: 'mountain', x: 85, y: 34, size: 182, chapter: 4 },
        { id: 'cave', x: 54, y: 64, size: 198, chapter: 4 },
        { id: 'desert', x: 82, y: 62, size: 176, chapter: 3 },
        { id: 'castle', x: 49, y: 84, size: 188, chapter: 4 },
        { id: 'volcano', x: 32, y: 92, size: 176, chapter: 4 },
        { id: 'space', x: 75, y: 83, size: 174, chapter: 5 },
        { id: 'stargarden', x: 64, y: 95, size: 194, chapter: 5 }
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

    function buildMapNode(scene, layout, activeSceneId) {
        const unlocked = isSceneUnlocked(scene);
        const unlockCost = scene.unlock_cost || 0;
        const isLockedByPoints = unlockCost > 0 && !unlockedScenes[scene.id];
        const action = unlocked
            ? `ExplorationSystem.goExplore('${scene.id}')`
            : `ExplorationSystem.tryUnlock('${scene.id}')`;
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
                return scene ? buildMapNode(scene, layout, activeSceneId) : '';
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

    function tryUnlock(sceneId) {
        const result = unlockScene(sceneId);
        if (typeof window.showToast === 'function') {
            window.showToast(result.msg);
        } else {
            alert(result.msg);
        }
        if (result.success) {
            renderSceneGridMap(sceneId);
            if (typeof window.renderExplorePage === 'function') {
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
            const monster = scene.monsters[Math.floor(Math.random() * scene.monsters.length)];
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
