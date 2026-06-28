/**
 * exploration.js - 探索冒险 + 自动回合制战斗
 * 负责：场景管理、怪物遭遇、回合制战斗、奖励发放
 */

const ExplorationSystem = (function () {
    let scenes = null;     // 场景数据
    let currentBattle = null; // 当前战斗状态

    // 加载场景数据
    async function loadScenes() {
        if (scenes) return scenes;
        try {
            const response = await fetch('data/scenes.json');
            scenes = await response.json();
            return scenes;
        } catch (e) {
            console.error('Failed to load scenes.json:', e);
            return { scenes: [] };
        }
    }

    // 检查场景是否解锁
    function isSceneUnlocked(scene) {
        const pet = PetSystem.getState();
        return pet.level >= (scene.min_level || 1);
    }

    // 开始探索
    function startExploration(sceneId) {
        const scene = scenes?.scenes?.find(s => s.id === sceneId);
        if (!scene) return { success: false, msg: '场景不存在' };
        if (!isSceneUnlocked(scene)) return { success: false, msg: `需要 Lv.${scene.min_level} 才能探索` };

        const pet = PetSystem.getState();
        if (pet.hp <= 0) return { success: false, msg: '宠物已倒下，无法探索' };
        if (pet.hp < scene.hp_cost) return { success: false, msg: `HP 不足，需要 ${scene.hp_cost}` };

        // 扣除 HP
        PetSystem.takeDamage(scene.hp_cost);
        PetSystem.addExploration();

        // 随机遭遇怪物（70% 概率）
        if (Math.random() < 0.7 && scene.monsters.length > 0) {
            const monster = scene.monsters[Math.floor(Math.random() * scene.monsters.length)];
            return { success: true, msg: `遇到 ${monster.name}！`, battle: { scene, monster } };
        }

        // 直接获得少量经验
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
            status: 'ongoing'  // ongoing, won, lost, fled
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
        const petMaxHp = PetSystem.getTotalMaxHp();

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
                // 敌人攻击
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

        // 攻击
        const playerDmg = Math.max(1, petAtk + Math.floor(Math.random() * 3) - 1);
        battle.monster.current_hp -= playerDmg;
        battle.log.push({ type: 'player', text: `⚔️ 你攻击 ${battle.monster.name}，造成 ${playerDmg} 伤害 (${Math.max(0, battle.monster.current_hp)}/${battle.monster.hp})` });

        if (battle.monster.current_hp <= 0) {
            battle.status = 'won';
            PetSystem.addWin();
            const expGain = battle.monster.exp + battle.scene.danger_level * 3;
            const result = PetSystem.addExp(expGain);
            battle.log.push({ type: 'reward', text: `🎉 胜利！获得 ${expGain} EXP${result.leveled_up ? `，升级 Lv.${result.new_level}！` : ''}` });

            // 掉落
            for (const drop of battle.monster.drops || []) {
                if (Math.random() < drop.rate) {
                    InventorySystem.addItem(drop.item_id, 1);
                    const itemData = InventorySystem.getItemData(drop.item_id);
                    battle.log.push({ type: 'reward', text: `📦 掉落: ${itemData?.name || drop.item_id} x1` });
                }
            }
            // 稀有掉落
            for (const rare of battle.scene.rare_drops || []) {
                if (Math.random() < rare.rate) {
                    InventorySystem.addItem(rare.item_id, 1);
                    const itemData = InventorySystem.getItemData(rare.item_id);
                    battle.log.push({ type: 'reward', text: `💎 稀有掉落: ${itemData?.name || rare.item_id} x1` });
                }
            }
            return battle;
        }

        // 敌人反击
        const enemyDmg = Math.max(1, battle.monster.atk + Math.floor(Math.random() * 2) - 1);
        const ko = PetSystem.takeDamage(enemyDmg);
        battle.log.push({ type: 'enemy', text: `${battle.monster.name} 反击！造成 ${enemyDmg} 伤害` });
        if (ko) {
            battle.status = 'lost';
            battle.log.push({ type: 'system', text: '💀 宠物倒下了...' });
        }

        return battle;
    }

    // 结束战斗
    function endBattle() {
        currentBattle = null;
    }

    // 获取所有场景
    function getAllScenes() {
        return scenes?.scenes || [];
    }

    // 获取当前战斗
    function getCurrentBattle() {
        return currentBattle;
    }

    return {
        loadScenes, isSceneUnlocked,
        startExploration, startBattle, battleTurn, endBattle,
        getAllScenes, getCurrentBattle
    };
})();

window.ExplorationSystem = ExplorationSystem;