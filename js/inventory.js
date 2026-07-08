/**
 * inventory.js - 道具背包系统
 * 负责：物品存储、堆叠、添加/移除、装备管理
 */

const InventorySystem = (function () {
    let items = [];      // 物品堆叠数组 [{ item_id, count }]
    let itemsData = null; // 物品定义表（从 data/items.json 加载）

    // 加载物品定义
    async function loadItemsData() {
        if (itemsData) return itemsData;
        try {
            const response = await fetch(window.resolvePetBankAssetUrl ? window.resolvePetBankAssetUrl('data/items.json') : 'data/items.json');
            itemsData = await response.json();
            return itemsData;
        } catch (e) {
            console.error('Failed to load items.json:', e);
            return { items: [] };
        }
    }

    // 加载背包
    function load() {
        const saved = localStorage.getItem('petbank_inventory');
        if (saved) {
            try {
                items = JSON.parse(saved);
            } catch (e) {
                console.error('Inventory load failed:', e);
                items = [];
            }
        }
    }

    // 保存背包
    function save() {
        localStorage.setItem('petbank_inventory', JSON.stringify(items));
    }

    // 添加物品
    function addItem(itemId, count = 1) {
        const data = itemsData?.items?.find(i => i.id === itemId);
        if (!data) return { success: false, msg: `未知物品: ${itemId}` };

        const existing = items.find(i => i.item_id === itemId);
        const maxStack = data.stack_max || 99;

        if (existing) {
            existing.count = Math.min(existing.count + count, maxStack);
        } else {
            items.push({ item_id: itemId, count: Math.min(count, maxStack) });
        }
        save();
        return { success: true, msg: `获得 ${data.name} x${count}` };
    }

    // 移除物品
    function removeItem(itemId, count = 1) {
        const idx = items.findIndex(i => i.item_id === itemId);
        if (idx === -1) return { success: false, msg: '物品不存在' };

        if (items[idx].count <= count) {
            items.splice(idx, 1);
        } else {
            items[idx].count -= count;
        }
        save();
        return { success: true };
    }

    // 获取物品数量
    function getCount(itemId) {
        const item = items.find(i => i.item_id === itemId);
        return item ? item.count : 0;
    }

    // 使用物品（消耗品）
    function useItem(itemId) {
        const data = itemsData?.items?.find(i => i.id === itemId);
        if (!data) return { success: false, msg: '物品不存在' };
        if (getCount(itemId) <= 0) return { success: false, msg: '物品数量不足' };

        // 处理装备
        if (data.type === 'equip') {
            const result = PetSystem.equip(data);
            if (result.success) {
                // 装备不消耗
                return { success: true, msg: result.msg, type: 'equip' };
            }
            return result;
        }

        // 消耗品
        let result;
        if (data.effect?.revive) {
            result = PetSystem.revive(data.effect.hp_percent || 50);
        } else {
            if (data.effect?.hp) PetSystem.heal(data.effect.hp);
            if (data.effect?.exp) PetSystem.addExp(data.effect.exp);
            result = { success: true, msg: `使用 ${data.name} 成功` };
        }

        if (result.success) removeItem(itemId, 1);
        return result;
    }

    // 获取所有物品（带详情）
    function getAllItems() {
        return items.map(inv => {
            const data = itemsData?.items?.find(i => i.id === inv.item_id);
            return Object.assign({}, inv, data);
        }).filter(i => i.name); // 过滤未定义物品
    }

    // 按类型分组
    function getItemsByType(type) {
        return getAllItems().filter(i => i.type === type);
    }

    // 按稀有度分组
    function getItemsByRarity(rarity) {
        return getAllItems().filter(i => i.rarity === rarity);
    }

    // 获取物品定义
    function getItemData(itemId) {
        return itemsData?.items?.find(i => i.id === itemId);
    }

    // 公开 API
    return {
        loadItemsData, load, save,
        addItem, removeItem, getCount, useItem,
        getAllItems, getItemsByType, getItemsByRarity, getItemData
    };
})();

window.InventorySystem = InventorySystem;
