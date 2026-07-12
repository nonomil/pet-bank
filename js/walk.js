/**
 * walk.js - 宠物遛弯模块
 * 负责：户外场景切换、宠物气泡互动、路线选择、遛弯结算、最近日志
 */

const WalkSystem = (function() {
    const ROUTES = [
        {
            id: 'park',
            name: '🌤️ 晨光花园',
            shortName: '晨光花园',
            desc: '清晨的花园步道，先热身，再慢慢散步。',
            sceneTitle: '清晨阳光步道',
            sceneImage: 'assets/background/dawn.webp',
            sceneGradient: 'linear-gradient(180deg, #f7c987 0%, #f4a7a4 42%, #88c9ef 100%)',
            bubbleLines: ['早上的风好舒服呀~', '阳光暖暖的，想慢慢走一圈。', '先在花园里闻闻花香吧！'],
            scenePrompt: 'storybook outdoor pet walking garden at dawn, warm sunrise, wide empty ground for a pet, no text'
        },
        {
            id: 'river',
            name: '🌊 溪流步道',
            shortName: '溪流步道',
            desc: '沿着水声前进，适合放松和补充体力。',
            sceneTitle: '瀑布溪谷',
            sceneImage: 'assets/scenes/waterfall.webp',
            sceneGradient: 'linear-gradient(180deg, #7acde8 0%, #3f9fcb 44%, #2d6b95 100%)',
            bubbleLines: ['听见水声就想多走两步。', '这里凉凉的，好适合休息。', '水边有好多小石头和白云。'],
            scenePrompt: 'storybook outdoor pet riverside path with waterfall mist, cozy pet adventure landscape, no text'
        },
        {
            id: 'mall',
            name: '🌿 林间草坡',
            shortName: '林间草坡',
            desc: '草坡和林荫之间最适合追蝴蝶、踩叶子。',
            sceneTitle: '森林草坡',
            sceneImage: 'assets/scenes/forest.webp',
            sceneGradient: 'linear-gradient(180deg, #8bcf8d 0%, #4a915d 45%, #d4bb82 100%)',
            bubbleLines: ['我想去追那只蝴蝶！', '树荫底下凉凉的，好舒服。', '草地软软的，可以打个滚。'],
            scenePrompt: 'storybook outdoor pet forest meadow trail, butterflies, sunbeams, child-friendly adventure scene, no text'
        },
        {
            id: 'school',
            name: '🌼 花园阳台',
            shortName: '花园阳台',
            desc: '花墙、栏杆和微风，很适合停下来聊天。',
            sceneTitle: '露台花园',
            sceneImage: 'assets/background/garden_balcony.webp',
            sceneGradient: 'linear-gradient(180deg, #b4e0c9 0%, #8dd3c4 45%, #f5d49e 100%)',
            bubbleLines: ['好多花呀，我想靠近看看。', '这里的风闻起来甜甜的。', '可以在阳台边晒一小会太阳。'],
            scenePrompt: 'storybook outdoor pet flower balcony garden, sunny terrace, cozy railings, no text'
        }
    ];

    const MAX_WALKS_PER_DAY = 3;
    const WALK_COST_HP = 5;
    const LOG_LIMIT = 5;

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

    const RANDOM_EVENTS = [
        { type: 'social', action: function() { return { msg: '🐾 遇到其他宠物，互相挥了挥爪子，亲密感也悄悄涨了一点。' }; } },
        { type: 'item', action: function() { InventorySystem.addItem('toy_ball', 1); return { msg: '🎁 在草丛边捡到了一个小球！' }; } },
        { type: 'item', action: function() { InventorySystem.addItem('chest_fragment', 1); return { msg: '💎 在路边发现了一块宝箱碎片。' }; } },
        { type: 'bad', action: function() { PetSystem.takeDamage(5); return { msg: '🌧️ 半路飘来一阵小雨，HP -5。' }; } },
        { type: 'good', action: function() { PetSystem.heal(10); return { msg: '🍖 遇到好心路人递来小零食，HP +10。' }; } },
        { type: 'good', action: function() { return { msg: '🦋 追到了蝴蝶，心情一下子变得超好。' }; } },
        { type: 'good', action: function() { return { msg: '🐦 听到树梢上的小鸟唱歌，脚步都轻快了。' }; } },
        { type: 'exp', action: function() { const exp = Math.floor(Math.random() * 4) + 2; PetSystem.addExp(exp); return { msg: `✨ 遛弯回来，获得 ${exp} EXP。` }; } },
        { type: 'item', action: function() { InventorySystem.addItem('yarn', 1); return { msg: '🧶 在角落里捡到了一团毛线球。' }; } },
        { type: 'bad', action: function() { PetSystem.takeDamage(2); return { msg: '👣 踩到小石子，HP -2。' }; } },
        { type: 'good', action: function() { return { msg: '🌈 抬头看见一道彩虹，整只宠物都精神了。' }; } },
        { type: 'exp', action: function() { PetSystem.addExp(3); return { msg: '🏃 今天运动量达标，EXP +3。' }; } }
    ];

    let currentContainerId = '';
    let currentStageContainerId = '';
    let activeRouteId = 'park';
    let stageBubbleText = '';
    let stageBubbleTimer = null;
    let activeWalkTimer = null;
    let activeWalkFinishTimer = null;
    let activeWalkOverlay = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getWalkCount() {
        const today = getTodayKey();
        const data = JSON.parse(localStorage.getItem('petbank_walk_data') || '{}');
        if (data.date !== today) return 0;
        return Number(data.count || 0);
    }

    function getRemainingWalks() {
        return Math.max(0, MAX_WALKS_PER_DAY - getWalkCount());
    }

    function incrementWalkCount() {
        const today = getTodayKey();
        const data = JSON.parse(localStorage.getItem('petbank_walk_data') || '{}');
        const nextCount = (data.date === today ? Number(data.count || 0) : 0) + 1;
        localStorage.setItem('petbank_walk_data', JSON.stringify({
            date: today,
            count: nextCount
        }));
    }

    function addLog(msg) {
        let logs = JSON.parse(localStorage.getItem('petbank_walk_logs') || '[]');
        logs.unshift('[' + new Date().toLocaleTimeString() + '] ' + msg);
        logs = logs.slice(0, LOG_LIMIT);
        localStorage.setItem('petbank_walk_logs', JSON.stringify(logs));
    }

    function getLogs() {
        return JSON.parse(localStorage.getItem('petbank_walk_logs') || '[]');
    }

    function notify(msg) {
        if (typeof window.showToast === 'function') {
            window.showToast(msg);
            return;
        }
        alert(msg);
    }

    function getRoute(routeId) {
        return ROUTES.find(function(route) {
            return route.id === routeId;
        }) || ROUTES[0];
    }

    function getActiveRoute() {
        return getRoute(activeRouteId);
    }

    function getPetSpriteMarkup(pet) {
        const image = window.PetSystem && typeof PetSystem.getCurrentStageImage === 'function'
            ? PetSystem.getCurrentStageImage()
            : '';
        if (image) {
            return '<img class="walk-stage-pet-img pet-sprite" src="' + escapeHtml(image) + '" alt="' + escapeHtml((pet.species_data && pet.species_data.name) || '宠物') + '">';
        }
        const emoji = window.PetSystem && typeof PetSystem.getStageEmoji === 'function'
            ? PetSystem.getStageEmoji()
            : '🐾';
        return '<div class="walk-stage-pet-emoji">' + escapeHtml(emoji) + '</div>';
    }

    function getDefaultBubble(pet, route) {
        if (!pet.species) return '先去认养一只宠物，再来户外遛弯吧。';
        if (pet.hp <= 0) return '宠物倒下了，先回宠物小屋救援吧。';
        if (pet.hunger != null && pet.hunger < 20) return '我有点饿了，能先吃点零食吗？';
        if (pet.cleanliness != null && pet.cleanliness < 20) return '跑来跑去有点脏，等会记得回小屋清理一下。';
        if (pet.hp < 40) return '体力有点低，想先坐下来休息一会儿。';
        return route.bubbleLines[Math.floor(Math.random() * route.bubbleLines.length)];
    }

    function refreshWalkPageIfVisible() {
        if (typeof window.renderWalkPage === 'function') {
            const page = document.getElementById('page-walk');
            if (page && page.classList.contains('active')) {
                window.renderWalkPage();
                return;
            }
        }
        if (currentStageContainerId) renderAdventureStage(currentStageContainerId);
        if (currentContainerId) renderUI(currentContainerId);
    }

    function showStageBubble(msg, duration) {
        stageBubbleText = msg || '';
        refreshWalkPageIfVisible();
        if (stageBubbleTimer) {
            clearTimeout(stageBubbleTimer);
            stageBubbleTimer = null;
        }
        if (!msg) return;
        stageBubbleTimer = setTimeout(function() {
            stageBubbleText = '';
            refreshWalkPageIfVisible();
        }, duration || 2600);
    }

    function setActiveRoute(routeId) {
        const route = getRoute(routeId);
        activeRouteId = route.id;
        showStageBubble(route.bubbleLines[0], 2200);
        return true;
    }

    function onPetSceneTap() {
        const pet = PetSystem.getState();
        showStageBubble(getDefaultBubble(pet, getActiveRoute()), 2400);
        if (window.sfx && typeof window.sfx.click === 'function') {
            window.sfx.click();
        }
    }

    function handleAdventureAction(action) {
        const pet = PetSystem.getState();
        if (!pet.species) {
            notify('请先认养一只宠物');
            showStageBubble('先去认养一只宠物，再来遛弯吧。', 2200);
            return false;
        }
        if (pet.hp <= 0) {
            notify('宠物倒下了，请先去宠物小屋救援');
            showStageBubble('现在先回宠物小屋救援，恢复后再继续户外遛弯。', 2600);
            return false;
        }

        let result = null;
        if (action === 'feed') {
            result = PetSystem.feed(null, { homeContext: true });
        } else if (action === 'play') {
            result = PetSystem.play();
        } else if (action === 'rest') {
            result = PetSystem.rest();
        } else if (action === 'walk') {
            return startWalk(activeRouteId);
        } else {
            return false;
        }

        if (!result || !result.success) {
            notify(result && result.msg ? result.msg : '操作失败');
            showStageBubble(result && result.msg ? result.msg : '这次操作没有成功。', 2200);
            return false;
        }

        notify(result.msg);
        if (action === 'feed') {
            showStageBubble('零食补给完成，等会儿可以继续向前走啦。', 2200);
        } else if (action === 'play') {
            showStageBubble('一起玩耍之后，连走路都更有精神了。', 2200);
        } else if (action === 'rest') {
            showStageBubble('在长椅边坐下休息了一会儿，体力回来了。', 2200);
        }
        if (window.sfx && typeof window.sfx.click === 'function') {
            window.sfx.click();
        }
        if (typeof window.refreshPetUI === 'function') {
            window.refreshPetUI();
        } else {
            refreshWalkPageIfVisible();
        }
        return true;
    }

    function startWalk(routeId) {
        const pet = PetSystem.getState();
        const route = getRoute(routeId || activeRouteId);
        activeRouteId = route.id;

        if (!pet.species) {
            notify('请先认养一只宠物');
            showStageBubble('没有小伙伴，没法开始遛弯。', 2200);
            return false;
        }
        if (pet.hp <= 0) {
            notify('宠物太累了，需要先休息或救援');
            showStageBubble('宠物现在太虚弱了，先回小屋休整吧。', 2400);
            return false;
        }
        if (getWalkCount() >= MAX_WALKS_PER_DAY) {
            notify('今日遛弯次数已达上限，明天再来吧');
            showStageBubble('今天已经走够次数啦，明天再来新的户外场景。', 2400);
            return false;
        }

        const mount = document.getElementById(currentStageContainerId || currentContainerId);
        if (!mount) return false;

        PetSystem.takeDamage(WALK_COST_HP);
        incrementWalkCount();
        runWalkAnimation(route, mount);
        return true;
    }

    function runWalkAnimation(route, mount) {
        cancelActiveWalk();
        const overlay = document.createElement('div');
        activeWalkOverlay = overlay;
        overlay.className = 'walk-overlay';
        overlay.innerHTML = ''
            + '<div class="walk-modal">'
            + '    <h3 class="walk-title">' + escapeHtml(route.name) + '</h3>'
            + '    <p class="walk-desc">' + escapeHtml(route.desc) + '</p>'
            + '    <div class="walk-progress-container"><div class="walk-progress-bar" id="walkProgressBar"></div></div>'
            + '    <p class="walk-status" id="walkStatus">正在和宠物一起出发...</p>'
            + '</div>';
        mount.appendChild(overlay);

        const bar = overlay.querySelector('#walkProgressBar');
        const status = overlay.querySelector('#walkStatus');
        let progress = 0;
        const duration = 3000;
        const intervalTime = 50;
        const step = (intervalTime / duration) * 100;

        activeWalkTimer = setInterval(function() {
            progress += step;
            if (progress >= 100) {
                progress = 100;
                clearInterval(activeWalkTimer);
                activeWalkTimer = null;
                activeWalkFinishTimer = setTimeout(function() {
                    activeWalkFinishTimer = null;
                    finishWalk(route, overlay);
                }, 450);
            }
            if (bar) bar.style.width = progress + '%';
            if (status) {
                if (progress < 30) status.innerText = '🌤️ 正在走进场景...';
                else if (progress < 70) status.innerText = '🐾 和宠物一起散步中...';
                else status.innerText = '🏁 快走完这一圈啦...';
            }
        }, intervalTime);
    }

    function cancelActiveWalk() {
        if (activeWalkTimer) {
            clearInterval(activeWalkTimer);
            activeWalkTimer = null;
        }
        if (activeWalkFinishTimer) {
            clearTimeout(activeWalkFinishTimer);
            activeWalkFinishTimer = null;
        }
        if (activeWalkOverlay && activeWalkOverlay.parentElement) activeWalkOverlay.remove();
        activeWalkOverlay = null;
    }

    function finishWalk(route, overlay) {
        if (activeWalkOverlay === overlay) activeWalkOverlay = null;
        if (overlay && overlay.parentElement) {
            overlay.remove();
        }

        const event = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        const result = event.action(PetSystem.getState(), route);
        addLog(route.shortName + ' · ' + result.msg);

        showEventModal(result.msg);
        showStageBubble(result.msg, 3200);
        if (window.sfx && typeof window.sfx.notice === 'function') {
            window.sfx.notice();
        }
        if (typeof window.refreshPetUI === 'function') {
            window.refreshPetUI();
        } else {
            refreshWalkPageIfVisible();
        }
    }

    function showEventModal(msg) {
        const modal = document.createElement('div');
        modal.className = 'walk-modal-event';
        modal.innerHTML = ''
            + '<div class="walk-event-content">'
            + '    <div class="walk-event-icon">✨</div>'
            + '    <div class="walk-event-msg">' + escapeHtml(msg) + '</div>'
            + '    <button class="walk-event-btn" onclick="this.parentElement.parentElement.remove()">继续冒险</button>'
            + '</div>';
        document.body.appendChild(modal);
        setTimeout(function() {
            if (modal.parentElement) modal.remove();
        }, 3800);
    }

    function renderAdventureStage(containerId) {
        currentStageContainerId = containerId;
        const container = document.getElementById(containerId);
        if (!container) return;

        const pet = PetSystem.getState();
        const route = getActiveRoute();
        const remaining = getRemainingWalks();
        const bubble = stageBubbleText || getDefaultBubble(pet, route);
        const routeTabs = ROUTES.map(function(item) {
            const active = item.id === route.id ? ' is-current' : '';
            return ''
                + '<button class="walk-scene-pill' + active + '" type="button" onclick="WalkSystem.setActiveRoute(\'' + item.id + '\')">'
                + '    <span>' + escapeHtml(item.name) + '</span>'
                + '    <small>' + escapeHtml(item.sceneTitle) + '</small>'
                + '</button>';
        }).join('');

        container.innerHTML = ''
            + '<section class="walk-stage-shell">'
            + '    <div class="walk-stage-scene">'
            + '        <div class="walk-stage-bg" style="background:' + escapeHtml(route.sceneGradient) + ';">'
            + '            <img class="walk-stage-bg-img" src="' + escapeHtml(route.sceneImage) + '" alt="' + escapeHtml(route.sceneTitle) + '">'
            + '        </div>'
            + '        <div class="walk-stage-topbar">'
            + '            <span class="walk-stage-chip">🎒 今日剩余 ' + remaining + '/' + MAX_WALKS_PER_DAY + '</span>'
            + '            <span class="walk-stage-chip">✨ Lv.' + escapeHtml(pet.level || 1) + '</span>'
            + '            <span class="walk-stage-chip">❤️ ' + escapeHtml(pet.hp || 0) + '/' + escapeHtml(pet.total_max_hp || 0) + '</span>'
            + '        </div>'
            + '        <div class="walk-stage-bubble">' + escapeHtml(bubble) + '</div>'
            + '        <div class="walk-stage-pet" onclick="WalkSystem.onPetSceneTap()">' + getPetSpriteMarkup(pet) + '</div>'
            + '        <div class="walk-stage-scene-tag">'
            + '            <strong>' + escapeHtml(route.sceneTitle) + '</strong>'
            + '            <span>' + escapeHtml(route.desc) + '</span>'
            + '        </div>'
            + '        <div class="walk-stage-route-tabs" id="walkStageRouteTabs">' + routeTabs + '</div>'
            + '    </div>'
            + (!pet.species ? '<div class="walk-stage-tip">先去认养宠物，这里就会变成真正的户外互动场景。</div>' : '')
            + (pet.hp <= 0 ? '<div class="walk-stage-tip is-danger">宠物倒下了，请先回宠物小屋救援，再继续户外遛弯。</div>' : '<div class="walk-stage-tip">点一下宠物会冒泡说话；底部切路线，右侧卡片负责互动、好友和记录。</div>')
            + '</section>';
    }

    function renderUI(containerId) {
        currentContainerId = containerId;
        const container = document.getElementById(containerId);
        if (!container) return;

        const active = getActiveRoute();
        const logs = getLogs();
        const remaining = getRemainingWalks();

        container.innerHTML = ''
            + '<div class="walk-route-panel-shell is-compact">'
            + '    <div class="walk-route-grid is-compact">'
            +         ROUTES.map(function(route) {
                        const activeClass = route.id === active.id ? ' is-current' : '';
                        return ''
                            + '<button class="walk-route-card' + activeClass + '" type="button" onclick="WalkSystem.setActiveRoute(\'' + route.id + '\')">'
                            + '    <div class="walk-route-thumb"><img src="' + escapeHtml(route.sceneImage) + '" alt="' + escapeHtml(route.sceneTitle) + '"></div>'
                            + '    <div class="walk-route-name">' + escapeHtml(route.name) + '</div>'
                            + '    <div class="walk-route-desc">' + escapeHtml(route.desc) + '</div>'
                            + '</button>';
                    }).join('')
            + '    </div>'
            + '    <div class="walk-route-detail is-compact">'
            + '        <div class="walk-route-detail-preview"><img src="' + escapeHtml(active.sceneImage) + '" alt="' + escapeHtml(active.sceneTitle) + '"></div>'
            + '        <div class="walk-route-detail-copy">'
            + '            <strong>' + escapeHtml(active.sceneTitle) + '</strong>'
            + '            <p>' + escapeHtml(active.desc) + '</p>'
            + '            <span class="walk-route-detail-note">今日剩余 ' + remaining + '/' + MAX_WALKS_PER_DAY + ' 次。选好路线后，可在上方状态卡里直接出发。</span>'
            + '        </div>'
            + '    </div>'
            + '    <div class="walk-logs is-compact">'
            + '        <h4 class="text-xs font-bold text-muted mb-2">📜 最近遛弯日志</h4>'
            + '        <ul class="walk-log-list">'
            +             (logs.length === 0
                                ? '<li class="text-xs text-muted">还没有遛弯记录，先选一条路线出发吧。</li>'
                                : logs.map(function(log) {
                                    return '<li class="text-xs">' + escapeHtml(log) + '</li>';
                                }).join(''))
            + '        </ul>'
            + '    </div>'
            + '</div>';
    }

    return {
        getRoutes: function() {
            return ROUTES.map(function(route) {
                return Object.assign({}, route);
            });
        },
        getActiveRouteId: function() {
            return activeRouteId;
        },
        setActiveRoute: setActiveRoute,
        onPetSceneTap: onPetSceneTap,
        handleAdventureAction: handleAdventureAction,
        startWalk: startWalk,
        cancelActiveWalk: cancelActiveWalk,
        renderAdventureStage: renderAdventureStage,
        renderUI: renderUI
    };
})();

window.WalkSystem = WalkSystem;
