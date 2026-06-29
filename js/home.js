/**
 * home.js - 宠物小屋系统（HomeSystem）P0
 * 方案：docs/方案/宠物小屋-方案.md
 * 计划：docs/方案/requirements-checklist-宠物小屋.md（Step 5）
 *
 * 依赖（批1已就绪）：
 *   - PetSystem.feed(food, {homeContext:true}) / play / rest / bath / decay / markHomeExit / revive / getState
 *   - window.spendPoints(n) / window.addGrowthPoints
 *
 * 核心：5 维状态条（HP/饱食/快乐/亲密/经验）+ cleanliness 角落图标 + 4 互动按钮
 *      + 倒下立绘 + 救援 CTA + 探索禁用 UI 守卫（R5 第一守卫）
 */
const HomeSystem = (function () {

    // ---------- 持久化（家具摆放 / 拥有家具） ----------
    const HOME_STATE_KEY = 'petbank_home_state';
    const HOME_FURNITURE_KEY = 'petbank_home_furniture';

    const DEFAULT_HOME_STATE = {
        slots: {
            center_left: 'food_bowl',
            center_right: null,
            corner_left: 'bath_tub',
            back: null,
            corner_right: null
        },
        theme: 'cozy_night'
    };
    const DEFAULT_FURNITURE = ['food_bowl', 'bath_tub'];

    let homeState = null;
    let furniture = null;

    function _loadHomeState() {
        try {
            const raw = localStorage.getItem(HOME_STATE_KEY);
            homeState = raw ? JSON.parse(raw) : JSON.parse(JSON.stringify(DEFAULT_HOME_STATE));
        } catch (e) {
            homeState = JSON.parse(JSON.stringify(DEFAULT_HOME_STATE));
        }
        // 兜底字段
        if (!homeState || typeof homeState !== 'object') homeState = JSON.parse(JSON.stringify(DEFAULT_HOME_STATE));
        if (!homeState.slots || typeof homeState.slots !== 'object') homeState.slots = JSON.parse(JSON.stringify(DEFAULT_HOME_STATE.slots));
        if (!homeState.theme) homeState.theme = 'cozy_night';
    }

    function _loadFurniture() {
        try {
            const raw = localStorage.getItem(HOME_FURNITURE_KEY);
            furniture = raw ? JSON.parse(raw) : DEFAULT_FURNITURE.slice();
        } catch (e) {
            furniture = DEFAULT_FURNITURE.slice();
        }
        if (!Array.isArray(furniture)) furniture = DEFAULT_FURNITURE.slice();
        // 确保默认两件存在
        if (furniture.indexOf('food_bowl') < 0) furniture.push('food_bowl');
        if (furniture.indexOf('bath_tub') < 0) furniture.push('bath_tub');
    }

    function _saveHomeState() {
        try { localStorage.setItem(HOME_STATE_KEY, JSON.stringify(homeState)); } catch (e) {}
    }
    function _saveFurniture() {
        try { localStorage.setItem(HOME_FURNITURE_KEY, JSON.stringify(furniture)); } catch (e) {}
    }

    // ---------- 样式（一次性注入） ----------
    let _stylesInjected = false;
    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;
        const css = `
.home-wrap{display:grid;grid-template-columns:1fr 320px;gap:16px;}
@media(max-width:900px){.home-wrap{grid-template-columns:1fr;}}
.home-stage{position:relative;border-radius:16px;overflow:hidden;min-height:440px;padding:20px;color:#fff;
  background:linear-gradient(180deg,#2a2350 0%,#3b2f63 45%,#5b4b8a 100%);box-shadow:inset 0 0 60px rgba(0,0,0,.35);}
.home-stage::before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 20% 15%,rgba(255,255,255,.08),transparent 40%);pointer-events:none;}
.home-bubble{position:absolute;left:50%;top:18px;transform:translateX(-50%);background:rgba(255,255,255,.95);color:#333;padding:6px 14px;border-radius:14px;font-size:13px;font-weight:600;white-space:nowrap;z-index:5;box-shadow:0 2px 8px rgba(0,0,0,.2);}
.home-pet-wrap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;height:200px;display:flex;align-items:center;justify-content:center;}
.home-pet-img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 6px 10px rgba(0,0,0,.4));transition:filter .4s,transform .4s;}
.home-pet-img.hungry{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) sepia(.5) saturate(1.4) hue-rotate(-15deg);}
.home-pet-img.dirty{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) brightness(.85) contrast(.95);}
.home-pet-img.weak{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) brightness(.7) saturate(.6);opacity:.85;}
.home-pet-img.down{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) grayscale(1) brightness(.6);transform:rotate(-12deg) translateY(20px);}
.home-rescue{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);background:linear-gradient(90deg,#ff6b6b,#feca57);color:#fff;border:none;padding:12px 28px;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,107,107,.5);animation:home-rescue-pulse 1.2s ease-in-out infinite;z-index:6;}
@keyframes home-rescue-pulse{0%,100%{transform:translateX(-50%) scale(1);}50%{transform:translateX(-50%) scale(1.08);}}
.home-pet-img.revive-flash{animation:home-revive-flash .9s ease-out;}
@keyframes home-revive-flash{0%{transform:scale(.6) rotate(-12deg) translateY(20px);filter:drop-shadow(0 0 24px rgba(127,255,212,.95)) brightness(1.8);}45%{transform:scale(1.15) rotate(0) translateY(-6px);filter:drop-shadow(0 0 30px rgba(127,255,212,.9)) brightness(1.4);}100%{transform:scale(1) rotate(0) translateY(0);filter:drop-shadow(0 6px 10px rgba(0,0,0,.4));}}
.home-cleanliness{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);padding:6px 10px;border-radius:999px;font-size:12px;backdrop-filter:blur(4px);z-index:4;}
.home-furniture-row{position:absolute;left:14px;bottom:14px;display:flex;gap:8px;z-index:4;}
.home-furn-slot{width:54px;height:54px;border-radius:10px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:24px;border:1px dashed rgba(255,255,255,.25);}
.home-furn-slot.filled{background:rgba(255,255,255,.2);border-style:solid;}
.home-side{display:flex;flex-direction:column;gap:14px;}
.home-card{background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
.home-card h4{font-size:13px;font-weight:700;margin:0 0 10px;color:#444;}
.home-vit{display:flex;flex-direction:column;gap:10px;}
.home-vit-row{font-size:12px;}
.home-vit-head{display:flex;justify-content:space-between;margin-bottom:4px;color:#555;}
.home-vit-bar{height:10px;background:#f0f0f0;border-radius:6px;overflow:hidden;}
.home-vit-fill{height:100%;border-radius:6px;transition:width .5s;}
.home-vit-fill.hp{background:linear-gradient(90deg,#e74c3c 0%,#f39c12 50%,#27ae60 100%);}
.home-vit-fill.hunger{background:linear-gradient(90deg,#e67e22,#f1c40f);}
.home-vit-fill.happy{background:linear-gradient(90deg,#9b59b6,#e84393);}
.home-vit-fill.intimacy{background:linear-gradient(90deg,#fd79a8,#fdcb6e);}
.home-vit-fill.exp{background:linear-gradient(90deg,#5B9BD5,#7CB9E8);}
.home-vit-warn{color:#e67e22;font-size:11px;margin-top:4px;font-weight:600;}
.home-vit-danger{color:#e74c3c;}
.home-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.home-btn{border:none;border-radius:12px;padding:12px 8px;font-size:13px;font-weight:600;cursor:pointer;color:#fff;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .15s,opacity .15s;}
.home-btn:active{transform:scale(.96);}
.home-btn:disabled{opacity:.4;cursor:not-allowed;filter:grayscale(.6);}
.home-btn .ico{font-size:22px;}
.home-btn.feed{background:linear-gradient(135deg,#f39c12,#e67e22);}
.home-btn.play{background:linear-gradient(135deg,#9b59b6,#8e44ad);}
.home-btn.bath{background:linear-gradient(135deg,#3498db,#2980b9);}
.home-btn.rest{background:linear-gradient(135deg,#1abc9c,#16a085);}
.home-explore-tip{margin-top:10px;padding:8px 10px;border-radius:8px;background:#fff3cd;color:#856404;font-size:12px;font-weight:600;text-align:center;}
.home-toast{position:fixed;left:50%;top:80px;transform:translateX(-50%);background:rgba(40,40,40,.92);color:#fff;padding:10px 18px;border-radius:999px;font-size:13px;z-index:9999;animation:home-toast-in .3s ease;}
@keyframes home-toast-in{from{opacity:0;transform:translate(-50%,-10px);}to{opacity:1;transform:translate(-50%,0);}}
.home-nav-disabled{opacity:.45!important;cursor:not-allowed!important;pointer-events:none!important;}
        `;
        const style = document.createElement('style');
        style.id = 'home-system-styles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ---------- 工具 ----------
    function _toast(msg) {
        try {
            const el = document.createElement('div');
            el.className = 'home-toast';
            el.textContent = msg;
            document.body.appendChild(el);
            setTimeout(() => { el.remove(); }, 1800);
        } catch (e) {}
    }

    // 经验百分比（参考 PetSystem.EXP_TABLE）
    function _expPct(state) {
        try {
            const table = (window.PetSystem && PetSystem.EXP_TABLE) || [0, 30, 80, 150, 250, 400];
            const need = table[state.level] || 30;
            return Math.min(100, Math.round((state.exp / need) * 100));
        } catch (e) { return 0; }
    }

    // 计算宠物立绘姿态 class
    function _poseClass(s) {
        if (s.hp <= 0) return 'down';
        if (s.hunger != null && s.hunger < 20) return 'hungry';
        if (s.cleanliness != null && s.cleanliness < 20) return 'dirty';
        if (s.hp < 40) return 'weak';
        return '';
    }

    // 气泡文案（饥饿/脏/虚弱/倒下）
    function _bubble(s) {
        if (s.hp <= 0) return '💫 我倒下了…快来救我！';
        if (s.hunger != null && s.hunger < 20) return '🍽️ 我饿了…';
        if (s.cleanliness != null && s.cleanliness < 20) return '🛁 我脏脏…';
        if (s.hp < 40) return '🤕 好虚弱…';
        return '';
    }

    // ---------- 探索禁用 UI 守卫（R5 第一守卫） ----------
    function _setExploreTabDisabled(disabled) {
        const tab = document.querySelector('.nav-tab[data-page="explore"]');
        if (!tab) return;
        if (disabled) tab.classList.add('home-nav-disabled');
        else tab.classList.remove('home-nav-disabled');
    }

    // ---------- 互动按钮处理 ----------
    function onFeed() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        // 先预检积分（feed 内部也会调 spendPoints，这里提前给反馈）
        if (typeof window.spendPoints !== 'function') { _toast('积分系统未就绪'); return; }
        if (typeof window.totalPoints !== 'undefined' && window.totalPoints < 10) {
            _toast('成长分不足（需 10 分）');
            return;
        }
        // 走新语义：扣 10 分 + 饱食/exp/happiness
        const res = PetSystem.feed(null, { homeContext: true });
        _toast(res.msg || (res.success ? '喂食成功' : '喂食失败'));
        if (window.updateStats) window.updateStats();
        renderUI(_lastContainer);
    }

    function onPlay() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        const res = PetSystem.play();
        _toast(res.msg || (res.success ? '玩耍成功' : '玩耍失败'));
        renderUI(_lastContainer);
    }

    function onBath() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        const res = PetSystem.bath();
        _toast(res.msg || (res.success ? '洗澡成功' : '洗澡失败'));
        renderUI(_lastContainer);
    }

    function onRest() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        const res = PetSystem.rest();
        _toast(res.msg || (res.success ? '治疗成功' : '治疗失败'));
        renderUI(_lastContainer);
    }

    // 救援 CTA
    function onRescue() {
        const s = PetSystem.getState();
        if (s.hp > 0) { _toast('宠物不需要救援'); return; }
        const res = PetSystem.revive(50);
        _toast(res.msg || (res.success ? '复活成功' : '复活失败'));
        if (res.success) {
            // 复活动画：立绘 scale+glow 弹跳（AC-16）
            renderUI(_lastContainer);
            const petImg = document.querySelector('#' + _lastContainer + ' .home-pet-img');
            if (petImg) {
                petImg.classList.remove('revive-flash'); // 兜底重置
                void petImg.offsetWidth; // 强制 reflow 以重启动画
                petImg.classList.add('revive-flash');
                petImg.addEventListener('animationend', function handler() {
                    petImg.classList.remove('revive-flash');
                    petImg.removeEventListener('animationend', handler);
                });
            }
            setTimeout(() => _toast('🎉 宠物苏醒了！又可以一起去冒险啦～'), 400);
            return;
        }
        renderUI(_lastContainer);
    }

    // ---------- 摆放家具 ----------
    function placeFurniture(furnId, slot) {
        if (!homeState || !homeState.slots) return false;
        if (furniture && furniture.indexOf(furnId) < 0) {
            _toast('尚未拥有该家具');
            return false;
        }
        homeState.slots[slot] = furnId;
        _saveHomeState();
        renderUI(_lastContainer);
        return true;
    }

    function removeFurniture(slot) {
        if (!homeState || !homeState.slots) return;
        homeState.slots[slot] = null;
        _saveHomeState();
        renderUI(_lastContainer);
    }

    function addFurniture(furnId) {
        if (!furniture) furniture = [];
        if (furniture.indexOf(furnId) < 0) {
            furniture.push(furnId);
            _saveFurniture();
        }
    }

    // ---------- 渲染 ----------
    let _lastContainer = 'home-container';

    function renderUI(containerId) {
        _injectStyles();
        const cid = containerId || _lastContainer;
        _lastContainer = cid;
        const container = document.getElementById(cid);
        if (!container) return;

        // 进入小屋：结算衰减（R4：decay 内部已防双结算）
        if (window.PetSystem && typeof PetSystem.decay === 'function') {
            try { PetSystem.decay(); } catch (e) {}
        }

        const s = PetSystem.getState();
        const downed = (s.hp <= 0 && !!s.species);

        // 探索 Tab 变灰（R5 第一守卫，仅 species 存在才拦，避免未选宠误拦）
        _setExploreTabDisabled(downed);

        // 宠物立绘
        const stageImg = PetSystem.getCurrentStageImage ? PetSystem.getCurrentStageImage() : null;
        const pose = _poseClass(s);
        const petImgHtml = stageImg
            ? `<img class="home-pet-img ${pose}" src="${stageImg}" alt="${s.species_data ? s.species_data.name : '宠物'}">`
            : `<div class="home-pet-img ${pose}" style="font-size:96px;display:flex;align-items:center;justify-content:center;">${s.stage_emoji || '🥚'}</div>`;

        // 气泡
        const bubbleText = _bubble(s);
        const bubbleHtml = bubbleText ? `<div class="home-bubble">${bubbleText}</div>` : '';

        // cleanliness 角落图标
        const clean = (s.cleanliness != null) ? s.cleanliness : 50;
        const cleanIcon = clean >= 60 ? '✨' : (clean >= 30 ? '🫧' : '🧼');
        const cleanHtml = `<div class="home-cleanliness">${cleanIcon} 清洁 ${clean}</div>`;

        // 家具槽（只渲染拥有的）
        const FURN_META = {
            food_bowl: { icon: '🥣', name: '食盆' },
            bath_tub: { icon: '🛁', name: '浴缸' }
        };
        const slotOrder = ['center_left', 'center_right', 'corner_left', 'back', 'corner_right'];
        const furnHtml = slotOrder.map(slot => {
            const fid = homeState.slots[slot];
            if (fid && FURN_META[fid]) {
                return `<div class="home-furn-slot filled" title="${FURN_META[fid].name}（点击移除）" onclick="HomeSystem.removeFurniture('${slot}')">${FURN_META[fid].icon}</div>`;
            }
            return `<div class="home-furn-slot" title="空槽位"></div>`;
        }).join('');

        // 救援 CTA
        const rescueHtml = downed
            ? `<button class="home-rescue" onclick="HomeSystem.onRescue()">🆘 救援宠物（恢复 50% HP）</button>`
            : '';

        // 探索禁用提示
        const exploreTipHtml = downed
            ? `<div class="home-explore-tip">⚠️ 宠物倒下，探索已禁用，请先救援</div>`
            : '';

        // 5 维状态条
        const hpPct = s.max_hp ? Math.round((s.hp / s.max_hp) * 100) : 0;
        const hungerVal = (s.hunger != null) ? s.hunger : null;
        const happyVal = (s.happiness != null) ? s.happiness : null;
        const intimVal = (s.intimacy != null) ? s.intimacy : null;
        const ep = _expPct(s);
        const need = (PetSystem.EXP_TABLE && PetSystem.EXP_TABLE[s.level]) || 30;

        const hpWarn = (s.hp > 0 && s.hp < 40) ? `<div class="home-vit-warn home-vit-danger">⚠️ HP 过低，建议治疗或救援</div>` : '';
        const hungerWarn = (hungerVal != null && hungerVal < 20) ? `<div class="home-vit-warn">⚠️ 饥饿中，请喂食</div>` : '';

        const vitHtml = `
            <div class="home-vit">
                <div class="home-vit-row">
                    <div class="home-vit-head"><span>❤️ HP</span><span>${s.hp}/${s.max_hp}</span></div>
                    <div class="home-vit-bar"><div class="home-vit-fill hp" style="width:${hpPct}%"></div></div>
                    ${hpWarn}
                </div>
                <div class="home-vit-row">
                    <div class="home-vit-head"><span>🍽️ 饱食</span><span>${hungerVal != null ? hungerVal : '--'}</span></div>
                    <div class="home-vit-bar"><div class="home-vit-fill hunger" style="width:${hungerVal != null ? hungerVal : 0}%"></div></div>
                    ${hungerWarn}
                </div>
                <div class="home-vit-row">
                    <div class="home-vit-head"><span>😊 快乐</span><span>${happyVal != null ? happyVal : '--'}</span></div>
                    <div class="home-vit-bar"><div class="home-vit-fill happy" style="width:${happyVal != null ? happyVal : 0}%"></div></div>
                </div>
                <div class="home-vit-row">
                    <div class="home-vit-head"><span>💖 亲密</span><span>${intimVal != null ? intimVal : '--'}</span></div>
                    <div class="home-vit-bar"><div class="home-vit-fill intimacy" style="width:${Math.min(100, intimVal != null ? intimVal : 0)}%"></div></div>
                </div>
                <div class="home-vit-row">
                    <div class="home-vit-head"><span>✨ EXP</span><span>Lv.${s.level} · ${s.exp}/${need}</span></div>
                    <div class="home-vit-bar"><div class="home-vit-fill exp" style="width:${ep}%"></div></div>
                </div>
            </div>
        `;

        // 互动按钮（倒下态禁用）
        const btnDisabled = downed ? 'disabled' : '';
        const actionsHtml = `
            <div class="home-card">
                <h4>互动（喂食消耗 10 成长分）</h4>
                <div class="home-actions">
                    <button class="home-btn feed" ${btnDisabled} onclick="HomeSystem.onFeed()"><span class="ico">🍕</span>喂食</button>
                    <button class="home-btn play" ${btnDisabled} onclick="HomeSystem.onPlay()"><span class="ico">🎾</span>玩耍</button>
                    <button class="home-btn bath" ${btnDisabled} onclick="HomeSystem.onBath()"><span class="ico">🛁</span>洗澡</button>
                    <button class="home-btn rest" ${btnDisabled} onclick="HomeSystem.onRest()"><span class="ico">💤</span>治疗</button>
                </div>
                ${exploreTipHtml}
            </div>
        `;

        const nameHtml = s.species_data ? `${s.species_data.emoji || ''} ${s.species_data.name}` : '未选择宠物';

        container.innerHTML = `
            <div class="home-wrap">
                <div class="home-stage">
                    ${bubbleHtml}
                    ${cleanHtml}
                    <div class="home-pet-wrap">${petImgHtml}</div>
                    <div class="home-furniture-row">${furnHtml}</div>
                    ${rescueHtml}
                </div>
                <div class="home-side">
                    <div class="home-card">
                        <h4>${nameHtml} · ${s.stage ? s.stage.name : ''}</h4>
                        ${vitHtml}
                    </div>
                    ${actionsHtml}
                </div>
            </div>
        `;
    }

    // ---------- init ----------
    function init() {
        _injectStyles();
        _loadHomeState();
        _loadFurniture();
        _saveHomeState();
        _saveFurniture();
        // 首次进入若 last_home_ts 无效，建基线（避免一进就大额衰减）
        try {
            const s = PetSystem.getState();
            if (s.species && !s.last_home_ts && typeof PetSystem.markHomeExit === 'function') {
                PetSystem.markHomeExit();
            }
        } catch (e) {}
    }

    // 标记离开（由 app.js switchPage 调用）
    function markExit() {
        try {
            if (window.PetSystem && typeof PetSystem.markHomeExit === 'function') {
                PetSystem.markHomeExit();
            }
        } catch (e) {}
    }

    return {
        init,
        renderUI,
        onFeed, onPlay, onBath, onRest, onRescue,
        placeFurniture, removeFurniture, addFurniture,
        markExit,
        getHomeState: () => homeState,
        getFurniture: () => furniture
    };
})();

window.HomeSystem = HomeSystem;
