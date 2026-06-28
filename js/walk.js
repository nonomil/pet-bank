/**
 * walk.js - 宠物遛弯模块
 * 负责：遛弯流程管理、路线选择、动画展示、随机事件处理、日志记录
 */

const WalkSystem = (function() {
    // --- 配置与数据 ---
    const ROUTES = [
        { id: 'park', name: '🌳 公园', desc: '环境优雅，适合散步' },
        { id: 'river', name: '🌊 河边', desc: '清凉宜人，风景优美' },
        { id: 'mall', name: '🛍️ 商场', desc: '繁华热闹，偶遇惊喜' },
        { id: 'school', name: '🏫 学校', desc: '充满活力，适合学习' }
    ];

    const MAX_WALKS_PER_DAY = 3;
    const WALK_COST_HP = 5;
    const LOG_LIMIT = 5;

    // 随机事件库 (15种)
    const RANDOM_EVENTS = [
        { type: 'social', msg: '🐾 遇到其他宠物，打了个招呼！', action: (p) => { /* 亲密度逻辑通常在PetSystem其他地方，这里我们模拟逻辑 */ return { type: 'social', msg: '🐾 遇到其他宠物，亲密度+1' }; } },
        { type: 'item', msg: '🎁 捡到了一个有趣的道具！', action: (p) => { InventorySystem.addItem('toy_ball', 1); return { type: 'item', msg: '🎁 捡到了一个小球！' }; } },
        { type: 'item', msg: '💎 发现了一块宝箱碎片！', action: (p) => { InventorySystem.addItem('chest_fragment', 1); return { type: 'item', msg: '💎 发现宝箱碎片！' }; } },
        { type: 'bad', msg: '🌧️ 天气变差了，淋雨了...', action: (p) => { PetSystem.takeDamage(5); return { type: 'bad', msg: '🌧️ 淋雨了，HP-5' }; } },
        { type: 'good', msg: '🍖 发现了一份美食！', action: (p) => { PetSystem.heal(10); return { type: 'good', msg: '🍖 发现美食，HP+10' }; } },
        { type: 'good', msg: '🦋 看到了一只漂亮的蝴蝶！', action: (p) => { /* 快乐值逻辑 */ return { type: 'good', msg: '🦋 遇到蝴蝶，心情愉悦！' }; } },
        { type: 'good', msg: '🐦 听到小鸟在唱歌...', action: (p) => { return { type: 'good', msg: '🐦 听到小鸟在唱歌，快乐值+!' }; } },
        { type: 'exp', msg: '✨ 散步让身体变得更强壮了！', action: (p) => { const exp = Math.floor(Math.random() * 4) + 2; PetSystem.addExp(exp); return { type: 'exp', msg: `✨ 遛弯结束，获得 ${exp} EXP` }; } },
        { type: 'social', msg: '🐕 遇到了一群狗狗在玩耍', action: (p) => { return { type: 'social', msg: '🐕 遇到狗狗玩耍，亲密度+1' }; } },
        { type: 'item', msg: '🧶 捡到了一团毛线', action: (p) => { InventorySystem.addItem('yarn', 1); return { type: 'item', msg: '🧶 捡到毛线球！' }; } },
        { type: 'bad', msg: '👣 踩到了一块小石头...', action: (p) => { PetSystem.takeDamage(2); return { type: 'bad', msg: '👣 踩到小石头，HP-2' }; } },
        { type: 'good', msg: '🍦 闻到了冰淇淋的味道！', action: (p) => { return { type: 'good', msg: '🍦 闻到美食，心情大好！' }; } },
        { type: 'item', msg: '🦴 捡到一根美味的骨头', action: (p) => { InventorySystem.addItem('bone', 1); return { type: 'item', msg: '🦴 捡到骨头！' }; } },
        { type: 'good', msg: '🌈 看到了一道彩虹！', action: (p) => { return { type: 'good', msg: '🌈 看到彩虹，心情变好！' }; } },
        { type: 'exp', msg: '🏃 运动量达标啦！', action: (p) => { PetSystem.addExp(3); return { type: 'exp', msg: '🏃 运动达标，EXP+3' }; } }
    ];

    // --- 内部状态 ---
    let currentContainerId = null;

    // --- 工具函数 ---
    function getWalkCount() {
        const today = new Date().toDateString();
        const data = JSON.parse(localStorage.getItem('petbank_walk_data') || '{}');
        if (data.date !== today) {
            return 0;
        }
        return data.count || 0;
    }

    function incrementWalkCount() {
        const today = new Date().toDateString();
        const data = JSON.parse(localStorage.getItem('petbank_walk_data') || '{}');
        const newCount = (data.date === today ? data.count : 0) + 1;
        localStorage.setItem('petbank_walk_data', JSON.stringify({
            date: today,
            count: newCount
        }));
    }

    function addLog(msg) {
        let logs = JSON.parse(localStorage.getItem('petbank_walk_logs') || '[]');
        logs.unshift(`[${new Date().toLocaleTimeString()}] ${msg}`);
        logs = logs.slice(0, LOG_LIMIT);
        localStorage.setItem('petbank_walk_logs', JSON.stringify(logs));
    }

    function getLogs() {
        return JSON.parse(localStorage.getItem('petbank_walk_logs') || '[]');
    }

    // --- 核心逻辑 ---
    async function startWalk(routeId) {
        const pet = PetSystem.getState();
        
        // 检查逻辑
        if (!pet.species) {
            alert('请先认养一只宠物！');
            return;
        }
        if (pet.hp <= 0) {
            alert('宠物太累了，需要先休息或喂食！');
            return;
        }
        if (getWalkCount() >= MAX_WALKS_PER_DAY) {
            alert('今日遛弯次数已达上限，明天再来吧！');
            return;
        }

        // 准备 UI 容器
        const container = document.getElementById(currentContainerId);
        if (!container) return;

        // 1. 消耗 HP
        PetSystem.takeDamage(WALK_COST_HP);
        incrementWalkCount();

        // 2. 显示选择路线界面 (如果还没开始)
        // 注意：此处假设 startWalk 是从按钮点击触发的，调用者可以传入 routeId
        // 如果 routeId 存在，则直接进入动画流程
        if (routeId) {
            runWalkAnimation(routeId);
        }
    }

    function runWalkAnimation(routeId) {
        const container = document.getElementById(currentContainerId);
        const route = ROUTES.find(r => r.id === routeId);
        
        // 创建动画覆盖层
        const overlay = document.createElement('div');
        overlay.className = 'walk-overlay';
        overlay.innerHTML = `
            <div class="walk-modal">
                <h3 class="walk-title">${route.name}</h3>
                <p class="walk-desc">${route.desc}</p>
                <div class="walk-progress-container">
                    <div class="walk-progress-bar" id="walkProgressBar"></div>
                </div>
                <p class="walk-status" id="walkStatus">正在出发...</p>
            </div>
        `;
        container.appendChild(overlay);

        const bar = overlay.querySelector('#walkProgressBar');
        const status = overlay.querySelector('#walkStatus');

        let progress = 0;
        const duration = 3000; // 3秒
        const intervalTime = 50;
        const step = (intervalTime / duration) * 100;

        const timer = setInterval(() => {
            progress += step;
            if (progress >= 100) {
                progress = 100;
                clearInterval(timer);
                setTimeout(() => finishWalk(routeId, overlay), 500);
            }
            bar.style.width = progress + '%';
            if (progress > 30 && progress < 70) status.innerText = '🐾 正在散步中...';
            if (progress >= 70) status.innerText = '🏁 即将到达...';
        }, intervalTime);
    }

    function finishWalk(routeId, overlay) {
        const container = document.getElementById(currentContainerId);
        container.removeChild(overlay);

        // 随机事件
        const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        const result = event.action(PetSystem.getState());
        
        addLog(result.msg);

        // 展示事件弹窗
        showEventModal(result.msg);
        
        // 更新全局 UI (例如 HP 栏)
        // 注意：由于 index.html 里的 UI 是动态渲染的，通常需要重新调用渲染逻辑
        // 这里假设调用 app.js 中的刷新逻辑，如果没有，我们手动触发一下
        if (window.refreshPetUI) {
            window.refreshPetUI();
        } else {
            // 兜底方案：如果无法直接刷新，建议用户在 app.js 中添加这个 hook
            console.log('[WalkSystem] Event finished. Manual UI refresh may be needed.');
        }
    }

    function showEventModal(msg) {
        const modal = document.createElement('div');
        modal.className = 'walk-modal-event';
        modal.innerHTML = `
            <div class="walk-event-content">
                <div class="walk-event-icon">✨</div>
                <div class="walk-event-msg">${msg}</div>
                <button class="walk-event-btn" onclick="this.parentElement.parentElement.remove()">太棒了！</button>
            </div>
        `;
        document.body.appendChild(modal);
        setTimeout(() => {
            if (modal.parentElement) modal.remove();
        }, 4000);
    }

    // --- 公开 API ---
    return {
        startWalk: function(routeId) {
            startWalk(routeId);
        },
        renderUI: function(containerId) {
            currentContainerId = containerId;
            const container = document.getElementById(containerId);
            if (!container) return;

            const logs = getLogs();
            const remaining = MAX_WALKS_PER_DAY - getWalkCount();

            const html = `
                <div class="walk-panel">
                    <div class="walk-header">
                        <h3 class="text-sm font-bold">🚶 遛弯系统</h3>
                        <span class="walk-limit">今日剩余: ${remaining}/${MAX_WALKS_PER_DAY}</span>
                    </div>
                    
                    <div class="walk-route-grid">
                        ${ROUTES.map(r => `
                            <button class="walk-route-card" onclick="WalkSystem.startWalk('${r.id}')">
                                <div class="walk-route-emoji">${r.name.split(' ')[0]}</div>
                                <div class="walk-route-name">${r.name.split(' ')[1]}</div>
                            </button>
                        `).join('')}
                    </div>

                    <div class="walk-logs">
                        <h4 class="text-xs font-bold text-muted mb-2">📜 最近遛弯日志</h4>
                        <ul class="walk-log-list">
                            ${logs.length === 0 ? '<li class="text-xs text-muted">暂无记录</li>' : 
                                logs.map(l => `<li class="text-xs">${l}</li>`).join('')
                            }
                        </ul>
                    </div>
                </div>
            `;
            container.innerHTML = html;
        }
    };
})();

// 挂载到 window
window.WalkSystem = WalkSystem;
