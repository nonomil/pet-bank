/**
 * treasure.js - 宝箱系统模块
 * 负责：日常/探索/里程碑宝箱逻辑、开箱动画、奖励发放
 */

const TreasureChest = (function () {
    const STORAGE_KEY = 'petbank_chests';
    const DAILY_DATE_KEY = 'petbank_daily_claim_date';
    const MILESTONES_KEY = 'petbank_claimed_milestones';

    function getTodayKey() {
        if (window.PetBankDailyState && typeof window.PetBankDailyState.localDate === 'function') {
            return window.PetBankDailyState.localDate();
        }
        if (window.PetBankTime && typeof window.PetBankTime.localDate === 'function') {
            return window.PetBankTime.localDate();
        }
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    // 宝箱库存
    let inventory = { daily: 0, explore: 0, milestone: 0 };
    let itemsData = null;

    // ============ 数据持久化 ============
    function save() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
    }

    async function load() {
        try {
            if (!window.PetBankAssetLoader || typeof window.PetBankAssetLoader.fetchJson !== 'function') {
                throw new Error('PetBankAssetLoader is unavailable');
            }
            const data = await window.PetBankAssetLoader.fetchJson('data/items.json');
            itemsData = data.items || [];
        } catch (e) {
            console.warn('[Treasure] items.json load failed:', e);
        }
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try { inventory = JSON.parse(saved); } catch(e) {}
        }
    }

    // ============ 日常宝箱 ============
    function hasClaimedDaily() {
        if (window.PetBankDailyState && typeof window.PetBankDailyState.hasClaimedDaily === 'function') {
            return window.PetBankDailyState.hasClaimedDaily();
        }
        const last = localStorage.getItem(DAILY_DATE_KEY);
        if (!last) return false;
        return last === getTodayKey() || last === new Date().toLocaleDateString();
    }

    function canOpenDaily() {
        if (hasClaimedDaily()) return { can: false, msg: '今日已领取' };
        const done = window.PetBankDailyState && typeof window.PetBankDailyState.getCompletedCount === 'function'
            ? window.PetBankDailyState.getCompletedCount()
            : parseInt(localStorage.getItem('petbank_tasks_completed_today') || '0');
        if (done < 1) return { can: false, msg: '完成至少1个任务后可领取' };
        return { can: true };
    }

    // ============ 里程碑宝箱 ============
    function checkMilestones() {
        const pet = PetSystem ? PetSystem.getState() : null;
        if (!pet) return;
        const level = pet.level || 1;
        const milestones = [5, 10, 15];
        let claimed = JSON.parse(localStorage.getItem(MILESTONES_KEY) || '[]');
        let newUnlock = false;
        milestones.forEach(m => {
            if (level >= m && !claimed.includes(m)) {
                inventory.milestone += 1;
                claimed.push(m);
                newUnlock = true;
            }
        });
        if (newUnlock) {
            localStorage.setItem(MILESTONES_KEY, JSON.stringify(claimed));
            save();
        }
    }

    function addExploreChest() {
        inventory.explore += 1;
        save();
    }

    // ============ 开箱 ============
    function generateReward(rare) {
        if (!rare) {
            if (Math.random() < 0.5) {
                const pts = 1 + Math.floor(Math.random() * 10);
                return { type: 'points', value: pts, label: `${pts} 成长积分` };
            } else if (itemsData && itemsData.length > 0) {
                const item = itemsData[Math.floor(Math.random() * itemsData.length)];
                return { type: 'item', id: item.id, label: item.name };
            }
            return { type: 'points', value: 5, label: '5 成长积分' };
        } else {
            const pts = 20 + Math.floor(Math.random() * 30);
            return { type: 'points', value: pts, label: `${pts} 成长积分` };
        }
    }

    function applyReward(reward, chestType) {
        const service = window.CoreRewardService;
        const eventId = `chest:${chestType || 'unknown'}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
        if (service && typeof service.claim === 'function') {
            const rewards = reward.type === 'points'
                ? [
                    { type: 'growth_points', amount: reward.value },
                    { type: 'pet_exp', amount: reward.value }
                ]
                : [{ type: 'item', itemId: reward.id, amount: 1 }];
            const result = service.claim({
                eventId,
                profileId: window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function'
                    ? window.ProfileManager.getActiveId()
                    : 'local',
                source: 'chest',
                sourceId: chestType || 'unknown',
                rewards
            });
            if (result.accepted && window.CoreRewardFeedback && typeof window.CoreRewardFeedback.show === 'function') {
                window.CoreRewardFeedback.show(result);
            }
            if (typeof renderAll === 'function' && result.accepted) renderAll();
            return result;
        }
        if (reward.type === 'points') {
            const pointsApi = window.PetBankPoints;
            if (!pointsApi || typeof pointsApi.add !== 'function') {
                console.warn('[Treasure] points API unavailable; reward was not applied');
                return;
            }
            pointsApi.add(reward.value);
            if (typeof PetSystem !== 'undefined') PetSystem.addExp(reward.value);
            if (typeof renderAll === 'function') renderAll();
        } else if (reward.type === 'item' && typeof InventorySystem !== 'undefined') {
            InventorySystem.addItem(reward.id, 1);
        }
    }

    function openChest(type) {
        if (type === 'daily') {
            const check = canOpenDaily();
            if (!check.can) { alert(check.msg); return; }
            inventory.daily = Math.max(0, inventory.daily - 1);
            if (window.PetBankDailyState && typeof window.PetBankDailyState.claimDaily === 'function') {
                if (typeof window.PetBankDailyState.setDailyChestCount === 'function') {
                    window.PetBankDailyState.setDailyChestCount(inventory.daily);
                }
                window.PetBankDailyState.claimDaily();
            } else {
                localStorage.setItem(DAILY_DATE_KEY, getTodayKey());
            }
        } else {
            if (inventory[type] <= 0) { alert('没有可用的宝箱！'); return; }
            inventory[type] -= 1;
        }
        save();

        const isRare = type === 'milestone' || Math.random() < 0.15;
        const reward = generateReward(isRare);

        // 动画
        showChestAnimation(reward, () => {
            applyReward(reward, type);
            window.sfx && sfx.coin();
        });
    }

    function showChestAnimation(reward, onDone) {
        const modal = document.getElementById('chest-anim-modal');
        if (!modal) { onDone(); return; }

        const iconEl = modal.querySelector('#chest-anim-icon') || modal;
        const rewardEl = modal.querySelector('#chest-anim-reward') || modal;

        modal.style.display = 'flex';
        modal.style.cssText += 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);align-items:center;justify-content:center;flex-direction:column;';
        iconEl.innerHTML = '<div style="font-size:80px;animation:chest-shake 0.5s ease-in-out 3">📦</div>';
        rewardEl.innerHTML = '';

        setTimeout(() => {
            const glow = isRareReward() ? 'text-yellow-400' : 'text-green-400';
            iconEl.innerHTML = `<div style="font-size:80px;animation:chest-glow 0.5s ease-out">🎉</div>`;
            rewardEl.innerHTML = `<div style="font-size:24px;font-weight:bold;margin-top:16px;" class="${glow}">${reward.label}</div><button onclick="this.parentElement.parentElement.style.display='none'" style="margin-top:12px;padding:8px 24px;border-radius:8px;background:#4CAF50;color:#fff;border:none;cursor:pointer;">收下</button>`;
            if (onDone) onDone();
        }, 1500);
    }

    function isRareReward() { return false; }

    // ============ UI渲染 ============
    function renderInventory() {
        const container = document.getElementById('chest-inventory-area') || document.getElementById('treasureWarehouseGrid');
        if (!container) return;

        const dailyCheck = canOpenDaily();
        const dailyBtnStyle = inventory.daily > 0 ? '' : 'opacity:0.5;';

        container.innerHTML = `
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">
                <div class="chest-card" style="text-align:center;padding:16px;border-radius:12px;background:#f8f6f0;border:2px solid #e8e0c8;cursor:pointer;${dailyBtnStyle}" onclick="TreasureChest.openChest('daily')">
                    <div style="font-size:32px;">🎁</div>
                    <div style="font-size:12px;font-weight:bold;margin-top:4px;">日常宝箱</div>
                    <div style="font-size:20px;font-weight:bold;color:#8B6F2A;">${inventory.daily}</div>
                    <div style="font-size:10px;color:#999;margin-top:2px;">${dailyCheck.can ? '可领取' : dailyCheck.msg}</div>
                </div>
                <div class="chest-card" style="text-align:center;padding:16px;border-radius:12px;background:#f0f8ff;border:2px solid #c8e0f0;cursor:pointer;" onclick="TreasureChest.openChest('explore')">
                    <div style="font-size:32px;">🗺️</div>
                    <div style="font-size:12px;font-weight:bold;margin-top:4px;">探索宝箱</div>
                    <div style="font-size:20px;font-weight:bold;color:#4A90D9;">${inventory.explore}</div>
                </div>
                <div class="chest-card" style="text-align:center;padding:16px;border-radius:12px;background:#fff8f0;border:2px solid #f0e0c8;cursor:pointer;" onclick="TreasureChest.openChest('milestone')">
                    <div style="font-size:32px;">🏆</div>
                    <div style="font-size:12px;font-weight:bold;margin-top:4px;">里程碑宝箱</div>
                    <div style="font-size:20px;font-weight:bold;color:#D4A017;">${inventory.milestone}</div>
                </div>
            </div>
        `;

        // 更新状态文字
        const statusEl = document.getElementById('chestDailyStatus');
        if (statusEl) {
            statusEl.textContent = hasClaimedDaily() ? '今日已领取 ✓' : (inventory.daily > 0 ? `${inventory.daily} 个可开` : '今日未领取');
        }
    }

    // ============ 初始化 ============
    function init() {
        load().then(() => {
            if (window.PetBankDailyState && typeof window.PetBankDailyState.getDailyChestCount === 'function') {
                inventory.daily = window.PetBankDailyState.getDailyChestCount();
                save();
            }
            // 初始给1个日常宝箱
            if (!window.PetBankDailyState && !hasClaimedDaily() && inventory.daily === 0) {
                inventory.daily = 1;
                save();
            }
            checkMilestones();
            renderInventory();
        });
    }

    return {
        init, openChest, addExploreChest, checkMilestones, renderInventory, canOpenDaily
    };
})();

window.TreasureChest = TreasureChest;
