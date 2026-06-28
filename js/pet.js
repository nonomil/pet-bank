/**
 * pet.js - 宠物养成核心系统 v2.0
 * 负责：宠物状态管理、等级/经验/HP、阶段进化、行动(喂食/玩耍/休息)
 * 
 * 宠物数据库来源：
 *   - pet-bank 原生 8 种（经典系列）
 *   - 仓鼠大冒险 91 种（灵兽族/星瞳族/绮梦族/萌肖族/酷肖族 等 12 系列）
 *   - classpet-pro1.0 40 种（萌宠风/幻想风/像素风/科幻风/国潮风 5 风格）
 * 
 * 数据文件：data/pets.json（139 种宠物）
 */

const PetSystem = (function () {
    // 宠物阶段配置（对应 imageStages 索引）
    // banchong 宠物：6阶段(0蛋→5完全体)
    // PVZ 宠物：5阶段(0蛋→1种子→2幼苗→3成熟→4终极)
    // classpet 宠物：4阶段(emoji)
    const STAGES = [
        { min_level: 1, name: '蛋',     emoji: '🥚', stageIdx: 0 },
        { min_level: 3, name: '幼崽',   emoji: '🐣', stageIdx: 1 },
        { min_level: 5, name: '成长期', emoji: '🐥', stageIdx: 2 },
        { min_level: 8, name: '完全体', emoji: '🦅', stageIdx: 3 },
        { min_level: 15, name: '终极体', emoji: '👑', stageIdx: 4 },
    ];

    // 等级经验表
    const EXP_TABLE = [0, 30, 80, 150, 250, 400, 600, 850, 1200, 1600];
    const MAX_LEVEL = 10;

    // 稀有度配置
    const RARITY = {
        common:    { name: '普通', color: '#95a5a6', icon: '⚪' },
        rare:      { name: '稀有', color: '#3498db', icon: '🔵' },
        epic:      { name: '史诗', color: '#9b59b6', icon: '🟣' },
        legendary: { name: '传说', color: '#f39c12', icon: '🟡' }
    };

    // 宠物种类数据库（139 种，从 data/pets.json 动态加载）
    // 内置 fallback PVZ 宠物
    const SPECIES_FALLBACK = [
        { id: 'dog', name: '豌豆射手', emoji: '🫛', desc: '发射豌豆攻击，入门级植物', base_hp: 110, base_atk: 7 },
        { id: 'cat', name: '向日葵', emoji: '🌻', desc: '产出阳光资源，不可或缺', base_hp: 95, base_atk: 6 },
        { id: 'rabbit', name: '坚果墙', emoji: '🥜', desc: '防御力超强，守护前线', base_hp: 130, base_atk: 5 },
        { id: 'turtle', name: '大嘴花', emoji: '🪴', desc: '一口吞僵尸，攻击力惊人', base_hp: 80, base_atk: 12 },
        { id: 'hamster', name: '寒冰射手', emoji: '❄️', desc: '冰冻减速敌人，控制型', base_hp: 70, base_atk: 4 },
        { id: 'parrot', name: '双发射手', emoji: '🔫', desc: '双倍火力输出，DPS之王', base_hp: 85, base_atk: 9 },
        { id: 'goldfish', name: '樱桃炸弹', emoji: '🍒', desc: '范围爆炸伤害，一击必杀', base_hp: 75, base_atk: 3 },
        { id: 'hedgehog', name: '机枪豌豆', emoji: '🟢', desc: '四管齐射，火力压制', base_hp: 90, base_atk: 8 }
    ];

    let SPECIES = [...SPECIES_FALLBACK];
    let PET_DB_LOADED = false;
    let ALL_SERIES = {};

    // 当前宠物状态
    let state = {
        species: null,           // 种类 id
        level: 1,                // 等级
        exp: 0,                  // 当前经验
        hp: 100,                 // 当前 HP
        max_hp: 100,             // 最大 HP
        atk: 5,                  // 攻击力
        wins: 0,                 // 战斗胜利数
        explorations: 0,         // 探索次数
        days_cared: 0,           // 陪伴天数
        weapon: null,            // 装备武器
        armor: null,             // 装备护甲
        last_action_time: null,  // 上次行动时间
        happiness: 100           // 快乐度
    };

    // 加载保存的状态
    function load() {
        const saved = localStorage.getItem('petbank_pet');
        if (saved) {
            try {
                state = Object.assign(state, JSON.parse(saved));
            } catch (e) {
                console.error('Pet state load failed:', e);
            }
        }
    }

    // 保存状态
    function save() {
        localStorage.setItem('petbank_pet', JSON.stringify(state));
    }

    // 选择宠物
    function chooseSpecies(speciesId) {
        const species = SPECIES.find(s => s.id === speciesId);
        if (!species) return false;
        state.species = speciesId;
        state.species_data = species;
        state.max_hp = species.base_hp;
        state.hp = species.base_hp;
        state.atk = species.base_atk;
        state.level = 1;       // 从蛋开始
        state.exp = 0;
        state.wins = 0;
        state.explorations = 0;
        state.days_cared = 0;
        state.weapon = null;
        state.armor = null;
        state.happiness = 100;
        state.evolution_stage = 0;  // 0=蛋
        save();
        return true;
    }

    // 获取当前阶段
    function getCurrentStage() {
        let current = STAGES[0];
        for (const stage of STAGES) {
            if (state.level >= stage.min_level) {
                current = stage;
            }
        }
        return current;
    }

    // 获取当前进化阶段索引（映射到 imageStages）
    function getEvolutionStageIndex() {
        const stage = getCurrentStage();
        return stage.stageIdx || 0;
    }

    // 根据当前阶段获取宠物图片URL
    function getCurrentStageImage() {
        if (!state.species) return null;
        const species = SPECIES.find(s => s.id === state.species);
        if (!species || !species.imageStages) return species.imageUrl || null;
        const idx = getEvolutionStageIndex();
        const key = String(idx);
        return species.imageStages[key] || species.imageUrl || null;
    }

    // 获取当前阶段 emoji
    function getStageEmoji() {
        if (!state.species) return '🥚';
        const species = SPECIES.find(s => s.id === state.species);
        if (!species) return '🥚';
        // Lv 1-2: 蛋；Lv 3-4: 物种 emoji 缩小版；Lv 5+: 完整
        if (state.level < 3) return '🥚';
        if (state.level < 5) return species.emoji; // 幼崽用原 emoji
        return species.emoji;
    }

    // 增加经验值（升级处理）
    function addExp(amount) {
        if (state.level >= MAX_LEVEL) return { leveled_up: false };
        state.exp += amount;
        let leveled_up = false;
        while (state.level < MAX_LEVEL && state.exp >= EXP_TABLE[state.level]) {
            state.exp -= EXP_TABLE[state.level];
            state.level += 1;
            // 升级提升属性
            state.max_hp += 15;
            state.hp = Math.min(state.hp + 30, state.max_hp);
            state.atk += 2;
            // 更新进化阶段
            state.evolution_stage = getEvolutionStageIndex();
            leveled_up = true;
        }
        if (state.level >= MAX_LEVEL) state.exp = 0;
        save();
        return { leveled_up, new_level: state.level };
    }

    // 受到伤害
    function takeDamage(amount) {
        state.hp = Math.max(0, state.hp - amount);
        save();
        return state.hp <= 0;
    }

    // 治疗
    function heal(amount) {
        state.hp = Math.min(state.max_hp, state.hp + amount);
        save();
    }

    // 喂食
    function feed(foodItem) {
        if (!state.species) return { success: false, msg: '请先选择一只宠物' };
        if (state.hp <= 0) return { success: false, msg: '宠物需要先复活' };
        const healAmount = foodItem.effect?.hp || 20;
        heal(healAmount);
        state.happiness = Math.min(100, state.happiness + 5);
        save();
        return { success: true, msg: `喂食成功！恢复 ${healAmount} HP` };
    }

    // 玩耍
    function play() {
        if (!state.species) return { success: false, msg: '请先选择一只宠物' };
        if (state.hp <= 0) return { success: false, msg: '宠物需要先复活' };
        if (state.hp < 10) return { success: false, msg: 'HP 太低，不能玩耍（先去探索或休息）' };
        state.happiness = Math.min(100, state.happiness + 15);
        state.hp -= 5; // 玩耍消耗体力
        save();
        return { success: true, msg: '玩耍成功！快乐度 +15' };
    }

    // 休息
    function rest() {
        if (!state.species) return { success: false, msg: '请先选择一只宠物' };
        heal(Math.floor(state.max_hp * 0.3));
        state.happiness = Math.max(0, state.happiness - 5);
        save();
        return { success: true, msg: '休息成功！恢复 30% HP' };
    }

    // 复活
    function revive(hpPercent = 50) {
        if (state.hp > 0) return { success: false, msg: '宠物不需要复活' };
        state.hp = Math.floor(state.max_hp * hpPercent / 100);
        save();
        return { success: true, msg: `复活成功！恢复 ${hpPercent}% HP` };
    }

    // 计算总攻击力（含装备）
    function getTotalAtk() {
        let total = state.atk;
        if (state.weapon && state.weapon.effect?.atk) {
            total += state.weapon.effect.atk;
        }
        return total;
    }

    // 计算总最大 HP（含装备）
    function getTotalMaxHp() {
        let total = state.max_hp;
        if (state.armor && state.armor.effect?.max_hp) {
            total += state.armor.effect.max_hp;
        }
        return total;
    }

    // 装备物品
    function equip(item) {
        if (item.type !== 'equip') return { success: false, msg: '这不是装备' };
        if (item.slot === 'weapon') {
            state.weapon = item;
        } else if (item.slot === 'armor') {
            state.armor = item;
        }
        // 重新计算 HP 上限
        const newMaxHp = getTotalMaxHp();
        if (newMaxHp > state.max_hp) state.hp += (newMaxHp - state.max_hp);
        state.max_hp = newMaxHp;
        save();
        return { success: true, msg: `已装备 ${item.name}` };
    }

    // 卸下装备
    function unequip(slot) {
        if (slot === 'weapon') state.weapon = null;
        else if (slot === 'armor') state.armor = null;
        const newMaxHp = getTotalMaxHp();
        if (state.hp > newMaxHp) state.hp = newMaxHp;
        state.max_hp = newMaxHp;
        save();
    }

    // 增加探索次数
    function addExploration() {
        state.explorations += 1;
        state.days_cared += 1;
        save();
    }

    // 战斗胜利
    function addWin() {
        state.wins += 1;
        save();
    }

    // 获取状态快照
    function getState() {
        return Object.assign({}, state, {
            stage: getCurrentStage(),
            stage_emoji: getStageEmoji(),
            species_data: SPECIES.find(s => s.id === state.species),
            total_atk: getTotalAtk(),
            total_max_hp: getTotalMaxHp()
        });
    }

    // 加载外部宠物数据库（data/pets.json）
    async function loadPetDB() {
        if (PET_DB_LOADED) return;
        try {
            const resp = await fetch('data/pets.json');
            if (!resp.ok) return;
            const db = await resp.json();
            if (db.flat && db.flat.length > SPECIES_FALLBACK.length) {
                SPECIES = db.flat.map(p => ({
                    id: p.id,
                    name: p.name,
                    emoji: p.emoji || '🐾',
                    desc: p.desc || '',
                    base_hp: p.base_hp || 100,
                    base_atk: p.base_atk || 5,
                    series: p.series,
                    rarity: p.rarity || 'common',
                    source: p.source,
                    stages: p.stages,
                    imageUrl: p.imageUrl || '',
                    imageStages: p.imageStages || null,
                    imageStyle: p.imageStyle || ''
                }));
                ALL_SERIES = db.series || {};
                PET_DB_LOADED = true;
                console.log(`[PetDB] Loaded ${SPECIES.length} pets, ${Object.keys(ALL_SERIES).length} series`);
            }
        } catch (e) {
            console.warn('[PetDB] Failed to load pets.json:', e);
        }
    }

    // 获取所有种类
    function getAllSpecies() {
        return SPECIES;
    }

    // 按系列分组获取宠物
    function getAllSpeciesBySeries() {
        const groups = {};
        for (const p of SPECIES) {
            const s = p.series || '经典';
            if (!groups[s]) groups[s] = [];
            groups[s].push(p);
        }
        return groups;
    }

    // 按稀有度获取宠物
    function getSpeciesByRarity(rarity) {
        return SPECIES.filter(p => (p.rarity || 'common') === rarity);
    }

    // 获取稀有度配置
    function getRarityConfig() {
        return RARITY;
    }

    // 获取系列列表
    function getAllSeries() {
        return ALL_SERIES;
    }

    // 数据库是否已加载
    function isDBLoaded() {
        return PET_DB_LOADED;
    }

    // 公开 API
    return {
        load, save, chooseSpecies, getCurrentStage, getStageEmoji,
        getEvolutionStageIndex, getCurrentStageImage,
        addExp, takeDamage, heal, feed, play, rest, revive,
        equip, unequip, addExploration, addWin, getState, getAllSpecies,
        getAllSpeciesBySeries, getSpeciesByRarity, getRarityConfig, getAllSeries,
        isDBLoaded, loadPetDB,
        MAX_LEVEL, EXP_TABLE, STAGES, RARITY
    };
})();

window.PetSystem = PetSystem;
