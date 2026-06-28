/**
 * exploration.js - 探索冒险 + 自动回合制战斗 + 首页场景卡片渲染
 */

const ExplorationSystem = (function () {
    let scenes = null;
    let currentBattle = null;
    let unlockedScenes = {}; // {sceneId: true} 持久化到 localStorage

    // 加载场景数据
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

    // 持久化解锁状态
    function loadUnlockState() {
        try {
            unlockedScenes = JSON.parse(localStorage.getItem('petbank_unlocked_scenes') || '{}');
        } catch { unlockedScenes = {}; }
    }
    function saveUnlockState() {
        localStorage.setItem('petbank_unlocked_scenes', JSON.stringify(unlockedScenes));
    }

    // 检查场景是否解锁（等级 + 积分 + 手动解锁）
    function isSceneUnlocked(scene) {
        const pet = PetSystem.getState();
        // 等级检查
        if (pet.level < (scene.min_level || 1)) return false;
        // 积分解锁（unlock_cost=0 表示免费）
        if (scene.unlock_cost > 0 && !unlockedScenes[scene.id]) return false;
        return true;
    }

    // 用积分解锁场景
    function unlockScene(sceneId) {
        const scene = scenes?.scenes?.find(s => s.id === sceneId);
        if (!scene) return { success: false, msg: '场景不存在' };
        if (unlockedScenes[sceneId]) return { success: false, msg: '已解锁' };
        if (scene.unlock_cost <= 0) return { success: false, msg: '免费场景' };

        const pet = PetSystem.getState();
        if (pet.level < scene.min_level) return { success: false, msg: `需要 Lv.${scene.min_level}` };

        // 扣积分
        const pts = parseInt(localStorage.getItem('petbank_points') || '0');
        if (pts < scene.unlock_cost) return { success: false, msg: `积分不足（需要 ${scene.unlock_cost}）` };

        localStorage.setItem('petbank_points', String(pts - scene.unlock_cost));
        unlockedScenes[sceneId] = true;
        saveUnlockState();
        updateTopPoints();
        return { success: true, msg: `解锁成功！花费 ${scene.unlock_cost} 积分` };
    }

    // 渲染首页场景卡片网格
    function renderSceneGridMap() {
        const grid = document.getElementById('sceneGridMap');
        if (!grid || !scenes) return;

        const allScenes = scenes.scenes || [];
        grid.innerHTML = allScenes.map(s => {
            const unlocked = isSceneUnlocked(s);
            const dangerColors = ['', '#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];
            const dangerColor = dangerColors[s.danger_level] || '#6b7280';

            if (!unlocked && s.unlock_cost > 0) {
                return `<div class="scene-card locked" onclick="ExplorationSystem.tryUnlock('${s.id}')">
                    <img class="scene-card-bg" src="${s.image}" alt="${s.name}" loading="lazy">
                    <div class="scene-card-badges">
                        <span class="scene-card-badge" style="background:${dangerColor};color:white">Lv.${s.min_level}</span>
                    </div>
                    <div class="scene-card-lock">
                        <span class="scene-card-lock-icon">🔒</span>
                        <div class="scene-card-lock-cost">${s.unlock_cost} 积分解锁</div>
                    </div>
                    <div class="scene-card-overlay">
                        <div class="scene-card-name">${s.emoji} ${s.name}</div>
                    </div>
                </div>`;
            }

            return `<div class="scene-card" onclick="ExplorationSystem.goExplore('${s.id}')">
                <img class="scene-card-bg" src="${s.image}" alt="${s.name}" loading="lazy">
                <div class="scene-card-badges">
                    <span class="scene-card-badge" style="background:${dangerColor};color:white">Lv.${s.min_level}</span>
                    ${s.unlock_cost > 0 ? '<span class="scene-card-badge" style="background:#22c55e;color:white">✓</span>' : ''}
                </div>
                <div class="scene-card-overlay">
                    <div class="scene-card-name">${s.emoji} ${s.name}</div>
                    <div class="scene-card-desc">${s.description}</div>
                </div>
            </div>`;
        }).join('');

        updateMapStats();
    }

    // 更新地图统计
    function updateMapStats() {
        const allScenes = scenes?.scenes || [];
        const unlockedCount = allScenes.filter(s => isSceneUnlocked(s)).length;
        const el = (id) => document.getElementById(id);

        const countEl = el('mapUnlockedCount');
        if (countEl) countEl.textContent = `${unlockedCount}/12 场景已解锁`;

        const barEl = el('mapProgressBar');
        if (barEl) barEl.style.width = `${Math.round(unlockedCount / 12 * 100)}%`;

        const pts = parseInt(localStorage.getItem('petbank_points') || '0');
        const ptsEl = el('mapPoints');
        if (ptsEl) ptsEl.textContent = pts;

        const pet = PetSystem.getState();
        const lvlEl = el('mapPetLevel');
        if (lvlEl) lvlEl.textContent = `Lv.${pet.level}`;

        const winsEl = el('mapWins');
        if (winsEl) winsEl.textContent = pet.wins || 0;
    }

    // 尝试解锁
    function tryUnlock(sceneId) {
        const result = unlockScene(sceneId);
        if (result.success) {
            renderSceneGridMap();
            // 显示提示
            showToast(result.msg);
        } else {
            showToast(result.msg);
        }
    }

    // 跳转探索页
    function goExplore(sceneId) {
        const scene = scenes?.scenes?.find(s => s.id === sceneId);
        if (!scene) return;
        showSceneDetail(sceneId);
    }

    // 显示场景详情（大图+故事+探索按钮）
    function showSceneDetail(sceneId) {
        const scene = scenes?.scenes?.find(s => s.id === sceneId);
        if (!scene) return;

        // 隐藏首页场景网格，显示详情
        const gridMap = document.getElementById('sceneGridMap');
        const quickBtns = gridMap?.nextElementSibling; // 快捷入口
        const headerCard = document.querySelector('#page-map > .card');
        const statsCard = document.querySelector('#page-map > .card:nth-child(2)');
        const treasureCard = document.getElementById('treasureWarehouseCard');

        // 插入详情页
        let detail = document.getElementById('sceneDetail');
        if (!detail) {
            detail = document.createElement('div');
            detail.id = 'sceneDetail';
            gridMap.parentNode.insertBefore(detail, gridMap);
        }

        const unlocked = isSceneUnlocked(scene);
        const pet = PetSystem.getState();

        detail.innerHTML = `
            <div class="card mb-4 p-0 overflow-hidden">
                <div class="scene-detail-img-wrap">
                    <img src="${scene.image}" alt="${scene.name}" class="w-full" style="height:220px;object-fit:cover;">
                    <div class="scene-detail-overlay">
                        <button class="scene-detail-back" onclick="ExplorationSystem.closeSceneDetail()">← 返回地图</button>
                        <div class="text-white">
                            <h3 class="text-xl font-bold" style="text-shadow:0 2px 4px rgba(0,0,0,0.5)">${scene.emoji} ${scene.name}</h3>
                            <div class="flex gap-2 mt-1">
                                <span class="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded">⚠️ 危险 ${scene.danger_level}</span>
                                <span class="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded">❤️ -${scene.hp_cost} HP</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <p class="text-sm leading-relaxed mb-4" style="color:#444;line-height:1.8">${scene.story}</p>
                    ${unlocked ? `
                        <button class="btn-primary w-full py-3 text-base font-bold" onclick="ExplorationSystem.closeSceneDetail();document.querySelector('[data-page=explore]')?.click();setTimeout(()=>exploreScene('${scene.id}'),200)">
                            🗺️ 开始探索
                        </button>
                        ${pet.hp < scene.hp_cost ? '<p class="text-xs text-red-500 text-center mt-2">⚠️ HP不足，请先恢复</p>' : ''}
                    ` : `
                        <button class="btn-primary w-full py-3 text-base font-bold" onclick="ExplorationSystem.tryUnlock('${scene.id}')">
                            🔓 ${scene.unlock_cost > 0 ? scene.unlock_cost + ' 积分解锁' : '需要 Lv.' + scene.min_level}
                        </button>
                    `}
                </div>
            </div>
        `;

        // 隐藏首页其他元素
        if (headerCard) headerCard.style.display = 'none';
        if (statsCard) statsCard.style.display = 'none';
        gridMap.style.display = 'none';
        if (quickBtns) quickBtns.style.display = 'none';
        if (treasureCard) treasureCard.style.display = 'none';
    }

    function closeSceneDetail() {
        const gridMap = document.getElementById('sceneGridMap');
        const detail = document.getElementById('sceneDetail');
        if (detail) detail.remove();
        // 恢复首页元素
        document.querySelectorAll('#page-map > .card').forEach(el => el.style.display = '');
        if (gridMap) gridMap.style.display = '';
        gridMap?.nextElementSibling && (gridMap.nextElementSibling.style.display = '');
        const treasureCard = document.getElementById('treasureWarehouseCard');
        if (treasureCard) treasureCard.style.display = '';
        window.scrollTo(0, 0);
    }

    // 开始探索
    function startExploration(sceneId) {
        const scene = scenes?.scenes?.find(s => s.id === sceneId);
        if (!scene) return { success: false, msg: '场景不存在' };
        if (!isSceneUnlocked(scene)) return { success: false, msg: '场景未解锁' };

        const pet = PetSystem.getState();
        if (pet.hp <= 0) return { success: false, msg: '宠物已倒下，无法探索' };
        if (pet.hp < scene.hp_cost) return { success: false, msg: `HP 不足，需要 ${scene.hp_cost}` };

        PetSystem.takeDamage(scene.hp_cost);
        PetSystem.addExploration();

        if (Math.random() < 0.7 && scene.monsters.length > 0) {
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

    // 开始战斗
    function startBattle(scene, monster) {
        const pet = PetSystem.getState();
        currentBattle = {
            scene,
            monster: Object.assign({}, monster, { current_hp: monster.hp }),
            pet_max_hp: pet.hp,
            log: [],
            turn: 1,
            status: 'ongoing'
        };
        currentBattle.log.push({ type: 'system', text: `⚔️ 遭遇战：${pet.species_data?.name || '宠物'} vs ${monster.name} (Lv.${scene.danger_level})` });
        return currentBattle;
    }

    // 战斗一回合
    function battleTurn(action = 'attack') {
        if (!currentBattle || currentBattle.status !== 'ongoing') return null;

        const battle = currentBattle;
        const pet = PetSystem.getState();
        const petAtk = PetSystem.getTotalAtk();

        battle.turn += 1;

        if (action === 'flee') {
            if (Math.random() < 0.5) {
                battle.status = 'fled';
                battle.log.push({ type: 'system', text: '🏃 逃跑成功！' });
                const expGain = Math.floor(battle.monster.exp * 0.3);
                PetSystem.addExp(expGain);
                battle.log.push({ type: 'reward', text: `获得 ${expGain} EXP (逃跑奖励减半)` });
            } else {
                battle.log.push({ type: 'system', text: '逃跑失败！' });
                const damage = Math.max(1, battle.monster.atk - Math.floor(pet.level / 2));
                PetSystem.takeDamage(damage);
                battle.log.push({ type: 'enemy', text: `${battle.monster.name} 攻击！造成 ${damage} 伤害` });
                if (PetSystem.getState().hp <= 0) {
                    battle.status = 'lost';
                    battle.log.push({ type: 'system', text: '💀 宠物倒下了...' });
                }
            }
            return battle;
        }

        const playerDmg = Math.max(1, petAtk + Math.floor(Math.random() * 3) - 1);
        battle.monster.current_hp -= playerDmg;
        battle.log.push({ type: 'player', text: `⚔️ 你攻击 ${battle.monster.name}，造成 ${playerDmg} 伤害 (${Math.max(0, battle.monster.current_hp)}/${battle.monster.hp})` });

        if (battle.monster.current_hp <= 0) {
            battle.status = 'won';
            PetSystem.addWin();
            const expGain = battle.monster.exp + battle.scene.danger_level * 3;
            const result = PetSystem.addExp(expGain);
            battle.log.push({ type: 'reward', text: `🎉 胜利！获得 ${expGain} EXP${result.leveled_up ? `，升级 Lv.${result.new_level}！` : ''}` });

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
            return battle;
        }

        const enemyDmg = Math.max(1, battle.monster.atk + Math.floor(Math.random() * 2) - 1);
        const ko = PetSystem.takeDamage(enemyDmg);
        battle.log.push({ type: 'enemy', text: `${battle.monster.name} 反击！造成 ${enemyDmg} 伤害` });
        if (ko) {
            battle.status = 'lost';
            battle.log.push({ type: 'system', text: '💀 宠物倒下了...' });
        }

        return battle;
    }

    function endBattle() { currentBattle = null; }
    function getAllScenes() { return scenes?.scenes || []; }
    function getCurrentBattle() { return currentBattle; }

    return {
        loadScenes, isSceneUnlocked, unlockScene,
        startExploration, startBattle, battleTurn, endBattle,
        getAllScenes, getCurrentBattle,
        renderSceneGridMap, updateMapStats, tryUnlock, goExplore,
        showSceneDetail, closeSceneDetail
    };
})();

window.ExplorationSystem = ExplorationSystem;