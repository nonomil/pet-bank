/**
 * treasure.js - 宝箱系统模块
 * 负责：日常/探索/里程碑宝箱逻辑、开箱动画、奖励发放
 */

const TreasureChest = (function () {
    // 宝箱类型定义
    const CHEST_TYPES = {
        DAILY: 'daily',
        EXPLORE: 'explore',
        MILESTONE: 'milestone'
    };

    // 宝箱库存数据结构 (localStorage: petbank_chests)
    let inventory = { daily: 0, explore: 0, milestone: 0 };

    // 内部状态
    let itemsData = null;

    // 加载数据
    async function load() {
        try {
            const resp = await fetch('data/items.json');
            const data = await resp.json();
            itemsData = data.items || [];
        } catch (e) {
            console.error('[Treasure] Load items failed:', e);
        }

        const saved = localStorage.getItem('petbank_chests');
        if (saved) {
            inventory = JSON.parse(saved);
        }
    }

    function save() {
        localStorage.setItem('petbank_chests', JSON.stringify(inventory));
    }

    function hasClaimedDaily() {
        const lastClaimed = localStorage.getItem('petbank_daily_claim_date');
        if (!lastClaimed) return false;
        const today = new Date().toLocaleDateString();
        return lastClaimed === today;
    }

    function markDailyClaimed() {
        localStorage.setItem('petbank_daily_claim_date', new Date().toLocaleDateString());
    }

    function canOpenDaily() {
        if (hasClaimedDaily()) return { can: false, msg: '今日已领取' };
        
        // 检查任务完成情况 (假设 app.js 中会更新 petbank_tasks_completed_today)
        const completedToday = parseInt(localStorage.getItem('petbank_tasks_completed_today') || '0');
        if (completedToday < 1) return { can: false, msg: '请先完成至少1个任务' };
        
        return { can: true };
    }

    function checkMilestones() {
        const pet = PetSystem.getState();
        const level = pet.level;
        const milestones = [5, 10, 15];
        
        let claimedMilestones = JSON.parse(localStorage.getItem('petbank_claimed_milestones') || '[]');
        
        let newlyUnlocked = false;
        milestones.forEach(m => {
            if (level >= m && !claimedMilestones.includes(m)) {
                inventory.milestone += 1;
                claimedMilestones.push(m);
                newlyUnlocked = true;
            }
        });

        if (newlyUnlocked) {
            localStorage.setItem('petbank_claimed_milestones', JSON.stringify(claimedMilestones));
            save();
        }
    }

    function addExploreChest() {
        if (Math.random() < 0.3) {
            inventory.explore += 1;
            save();
            return true;
        }
        return false;
    }

    async function openChest(type) {
        // 1. 验证类型和库存
        if (type === CHEST_TYPES.DAILY) {
            const check = canOpenDaily();
            if (!check.can) {
                alert(check.msg);
                return null;
            }
            inventory.daily -= 1;
            markDailyClaimed();
        } else if (type === CHEST_TYPES.EXPLORE) {
            if (inventory.explore <= 0) {
                alert('没有探索宝箱');
                return null;
            }
            inventory.explore -= 1;
        } else if (type === CHEST_TYPES.MILESTONE) {
            if (inventory.milestone <= 0) {
                alert('没有里程碑宝箱');
                return null;
            }
            inventory.milestone -= 1;
        } else {
            return null;
        }

        save();
        
        // 2. 动画准备
        showAnimation(type);

        // 3. 生成奖励并等待动画时间
        const reward = await new Promise(resolve => {
            setTimeout(() => {
                const r = generateReward();
                resolve(r);
            }, 1500); // 模拟开箱动画时间
        });

        // 4. 执行动画效果 (金光 + 展示奖励)
        showRewardEffect(reward);

        // 5. 延迟应用奖励，让用户看完
        setTimeout(() => {
            applyReward(reward);
            hideAnimation();
            renderInventory();
            resolveRewardUI(reward);
        }, 1000);

        return reward; 
    }

    // 动画 UI 控制
    function showAnimation(type) {
        const modal = document.getElementById('chest-anim-modal');
        const icon = document.getElementById('chest-anim-icon');
        const typeMap = { 'daily': '🎁', 'explore': '🗺️', 'milestone': '🏆' };
        
        modal.style.display = 'flex';
        icon.className = 'chest-anim-icon shaking';
        icon.textContent = typeMap[type] || '🎁';
    }

    function showRewardEffect(reward) {
        const modal = document.getElementById('chest-anim-modal');
        const icon = document.getElementById('chest-anim-icon');
        icon.className = 'chest-anim-icon golden-glow';
    }

    function hideAnimation() {
        const modal = document.getElementById('chest-anim-modal');
        modal.style.display = 'none';
    }

    function resolveRewardUI(reward) {
        const resDiv = document.getElementById('chest-anim-reward');
        if (resDiv) {
            resDiv.innerHTML = `<h3>获得奖励!</h3><div class="reward-label">${reward.label}</div>`;
            resDiv.style.display = 'block';
        }
    }

    function generateReward() {
        const isRare = Math.random() < 0.15; 
        if (isRare) {
            const points = 20 + Math.floor(Math.random() * 30);
            return { type: 'points', value: points, label: `${points} 成长积分` };
        } else {
            if (Math.random() < 0.5) {
                const points = 1 + Math.floor(Math.random() * 10);
                return { type: 'points', value: points, label: `${points} 成长积分` };
            } else {
                if (!itemsData || itemsData.length === 0) {
                    return { type: 'points', value: 5, label: '5 成长积分' };
                }
                const item = itemsData[Math.floor(Math.random() * itemsData.length)];
                return { type: 'item', id: item.id, label: item.name };
            }
        }
    }

    function applyReward(reward) {
        if (reward.type === 'points') {
            if (typeof totalPoints !== 'undefined') {
                totalPoints += reward.value;
                const topEl = document.getElementById('topPoints');
                const accEl = document.getElementById('accountPoints');
                if (topEl) topEl.textContent = totalPoints;
                if (accEl) accEl.textContent = totalPoints;
            }
        } else if (reward.type === 'item') {
            InventorySystem.addItem(reward.id, 1);
        }
    }

    function init() {
        load().then(() => {
            checkMilestones();
            renderInventory();
        });
    }

    function renderInventory() {
        const container = document.getElementById('chest-inventory-area');
        if (!container) return;

        container.innerHTML = `
            <div class="grid grid-cols-3 gap-4 mt-4">
                <div class="chest-card" onclick="TreasureChest.openChest('daily')">
                    <div class="chest-icon">🎁</div>
                    <div class="chest-name">日常</div>
                    <div class="chest-count">${inventory.daily}</div>
                </div>
                <div class="chest-card" onclick="TreasureChest.openChest('explore')">
                    <div class="chest-icon">🗺️</div>
                    <div class="chest-name">探索</div>
                    <div class="chest-count">${inventory.explore}</div>
                </div>
                <div class="chest-card" onclick="TreasureChest.openChest('milestone')">
                    <div class="chest-icon">🏆</div>
                    <div class="chest-name">里程碑</div>
                    <div class="chest-count">${inventory.milestone}</div>
                </div>
            </div>
        `;
    }

    return {
        init,
        openChest,
        addExploreChest,
        checkMilestones,
        renderInventory
    };
})();

window.TreasureChest = TreasureChest;
