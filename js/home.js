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

    // 槽位元数据：固定 5 槽位 -> 槽位类型（家具 slotType 必须匹配才能摆放）
    const SLOT_TYPES = {
        center_left: 'floor',
        center_right: 'floor',
        corner_left: 'corner',
        corner_right: 'corner',
        back: 'backdrop'
    };

    let homeState = null;
    let furniture = null;
    let furnitureCatalog = [];        // 共享家具目录（data/furniture.json）
    let furnitureCatalogById = {};    // id -> item 索引，便于 canPlace 查询

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
        if (!Array.isArray(homeState.unlockedThemes)) homeState.unlockedThemes = ['cozy_night'];
        if (homeState.unlockedThemes.indexOf('cozy_night') < 0) homeState.unlockedThemes.push('cozy_night');
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

    // ---------- 共享目录加载（Task 2） ----------
    // 从 data/furniture.json 加载家具目录，建立 id 索引，并归一化 ownership
    async function loadCatalog() {
        try {
            const res = await fetch(window.resolvePetBankAssetUrl ? window.resolvePetBankAssetUrl('data/furniture.json') : 'data/furniture.json');
            if (!res.ok) throw new Error('furniture.json HTTP ' + res.status);
            const data = await res.json();
            furnitureCatalog = Array.isArray(data.furniture) ? data.furniture : [];
            furnitureCatalogById = {};
            furnitureCatalog.forEach(it => { furnitureCatalogById[it.id] = it; });
            // defaults 可能来自 json，兜底用模块常量
            const defs = Array.isArray(data.defaults) && data.defaults.length ? data.defaults : DEFAULT_FURNITURE;
            normalizeOwnedFurniture(defs);
            return true;
        } catch (e) {
            // 降级：保留默认两件家具，避免白屏
            furnitureCatalog = [];
            furnitureCatalogById = {};
            normalizeOwnedFurniture(DEFAULT_FURNITURE);
            return false;
        }
    }

    // 强制默认家具始终存在于 ownership 集合（去重）
    function normalizeOwnedFurniture(defaultIds) {
        if (!furniture) furniture = [];
        (defaultIds || DEFAULT_FURNITURE).forEach(id => {
            if (furniture.indexOf(id) < 0) furniture.push(id);
        });
        _saveFurniture();
    }

    function getFurnitureCatalog() {
        return furnitureCatalog.slice();
    }

    // 已拥有未摆放家具 = owned - placed（派生状态，不单独存）
    function getUnplacedFurniture() {
        if (!furniture) return [];
        if (!homeState || !homeState.slots) return furniture.slice();
        const placed = {};
        Object.keys(homeState.slots).forEach(slot => {
            const fid = homeState.slots[slot];
            if (fid) placed[fid] = true;
        });
        return furniture.filter(id => !placed[id]);
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
.home-bubble{position:absolute;left:50%;top:18px;transform:translateX(-50%);background:rgba(255,255,255,.96);color:#3a3050;padding:9px 18px;border-radius:16px;font-size:17px;font-weight:700;white-space:nowrap;z-index:5;box-shadow:0 4px 14px rgba(0,0,0,.25);max-width:80%;}
.home-pet-wrap{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:200px;height:200px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:transform .2s ease,filter .2s ease;z-index:3;}
.home-pet-wrap:hover{transform:translate(-50%,-50%) scale(1.05);}
.home-pet-wrap:hover .home-pet-img{filter:drop-shadow(0 10px 18px rgba(0,0,0,.5)) brightness(1.08);}
.home-pet-wrap:active{transform:translate(-50%,-50%) scale(.95);}
.home-pet-wrap:active .home-pet-img{filter:drop-shadow(0 4px 6px rgba(0,0,0,.45)) brightness(.95);}
.home-pet-img{max-width:100%;max-height:100%;object-fit:contain;image-rendering:pixelated;filter:drop-shadow(0 6px 10px rgba(0,0,0,.4));transition:filter .25s ease;}
.home-pet-img:not(.down):not(.revive-flash){animation:home-pet-idle 3.6s ease-in-out infinite;transform-origin:center bottom;}
@keyframes home-pet-idle{0%,100%{transform:scale(1) rotate(0);}25%{transform:scale(1.03) rotate(-1.3deg);}75%{transform:scale(1.03) rotate(1.3deg);}}
.home-pet-img.hungry{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) sepia(.5) saturate(1.4) hue-rotate(-15deg);}
.home-pet-img.dirty{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) brightness(.85) contrast(.95);}
.home-pet-img.weak{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) brightness(.7) saturate(.6);opacity:.85;}
.home-pet-img.down{filter:drop-shadow(0 6px 10px rgba(0,0,0,.4)) grayscale(1) brightness(.6);transform:rotate(-12deg) translateY(20px);}
.home-rescue{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);background:linear-gradient(90deg,#ff6b6b,#feca57);color:#fff;border:none;padding:12px 28px;border-radius:999px;font-size:15px;font-weight:700;cursor:pointer;box-shadow:0 4px 14px rgba(255,107,107,.5);animation:home-rescue-pulse 1.2s ease-in-out infinite;z-index:6;}
@keyframes home-rescue-pulse{0%,100%{transform:translateX(-50%) scale(1);}50%{transform:translateX(-50%) scale(1.08);}}
.home-pet-img.revive-flash{animation:home-revive-flash .9s ease-out;}
@keyframes home-revive-flash{0%{transform:scale(.6) rotate(-12deg) translateY(20px);filter:drop-shadow(0 0 24px rgba(127,255,212,.95)) brightness(1.8);}45%{transform:scale(1.15) rotate(0) translateY(-6px);filter:drop-shadow(0 0 30px rgba(127,255,212,.9)) brightness(1.4);}100%{transform:scale(1) rotate(0) translateY(0);filter:drop-shadow(0 6px 10px rgba(0,0,0,.4));}}
.home-cleanliness{position:absolute;right:14px;top:14px;display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.12);padding:6px 10px;border-radius:999px;font-size:12px;backdrop-filter:blur(4px);z-index:4;}
.home-bg-switch{position:absolute;left:14px;top:14px;background:rgba(255,255,255,.16);color:#fff;border:none;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;backdrop-filter:blur(4px);z-index:5;transition:background .15s;}
.home-bg-switch:hover{background:rgba(255,255,255,.3);}
.home-furniture-row{position:absolute;left:14px;bottom:14px;display:flex;gap:8px;z-index:4;}
.home-furn-slot{width:54px;height:54px;border-radius:10px;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;font-size:24px;border:1px dashed rgba(255,255,255,.25);cursor:default;transition:background .2s,border-color .2s;}
.home-furn-slot.filled{background:rgba(255,255,255,.2);border-style:solid;cursor:pointer;}
.home-furn-slot.home-furn-target{background:rgba(108,92,231,.35);border:1px solid #a29bfe;cursor:pointer;animation:home-furn-pulse 1.2s ease-in-out infinite;color:#fff;font-weight:700;}
.home-furn-slot.home-furn-dim{opacity:.35;cursor:not-allowed;}
@keyframes home-furn-pulse{0%,100%{box-shadow:0 0 0 0 rgba(162,155,254,.5);}50%{box-shadow:0 0 0 6px rgba(162,155,254,0);}}
.home-tray{margin-top:2px;padding:10px 12px;border-radius:12px;background:#faf8ff;border:1px dashed #d8d0f5;}
.home-tray-head{font-size:11px;color:#6c5ce7;font-weight:600;margin-bottom:8px;}
.home-tray-head .home-tray-cancel{color:#00b894;cursor:pointer;text-decoration:underline;margin-left:2px;}
.home-tray-row{display:flex;gap:8px;flex-wrap:wrap;}
.home-tray-item{width:42px;height:42px;border-radius:8px;background:#fff;border:1px solid #ece6ff;display:flex;align-items:center;justify-content:center;font-size:22px;cursor:pointer;transition:transform .15s,border-color .15s;}
.home-tray-item:hover{transform:translateY(-2px);}
.home-tray-item.home-tray-item-sel{border:2px solid #6c5ce7;background:#f4f1ff;transform:translateY(-2px);box-shadow:0 3px 8px rgba(108,92,231,.25);}
.home-side{display:flex;flex-direction:column;gap:14px;}
.home-card{background:#fff;border-radius:14px;padding:14px 16px;box-shadow:0 2px 8px rgba(0,0,0,.06);}
.home-card h4{font-size:13px;font-weight:700;margin:0 0 10px;color:#444;}
.home-care-daily{margin:-2px 0 12px;padding:10px 11px;border:1px solid #e7e1fb;border-radius:10px;background:#faf9ff;}
.home-care-head{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#4b3fa3;}
.home-care-head span{color:#7c73a8;font-size:11px;}
.home-care-track{height:7px;margin:7px 0 5px;border-radius:5px;background:#ece9f8;overflow:hidden;}
.home-care-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,#6c5ce7,#00b894);transition:width .3s ease;}
.home-care-meta{font-size:11px;color:#777;line-height:1.45;}
.home-care-next{width:100%;margin-top:7px;padding:6px 8px;border:1px solid #d9d0ff;border-radius:8px;background:#fff;color:#5b4dc2;font-size:11px;text-align:left;cursor:pointer;}
.home-care-next:hover{background:#f2efff;}
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
.home-evo{margin-top:12px;padding-top:10px;border-top:1px dashed #eee;}
.home-evo-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;}
.home-evo-lv{font-size:14px;font-weight:800;color:#6c5ce7;}
.home-evo-stage{font-size:11px;color:#888;background:#f4f1ff;padding:2px 8px;border-radius:999px;}
.home-evo-bar{height:12px;background:#f0f0f0;border-radius:6px;overflow:hidden;position:relative;border:1px solid #ececec;}
.home-evo-fill{height:100%;background:linear-gradient(90deg,#a29bfe,#6c5ce7,#00cec9);border-radius:6px;transition:width .6s ease;position:relative;}
.home-evo-fill::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent);animation:home-evo-shine 2.2s linear infinite;}
@keyframes home-evo-shine{from{transform:translateX(-100%);}to{transform:translateX(100%);}}
.home-evo-meta{display:flex;justify-content:space-between;font-size:10px;color:#999;margin-top:3px;}
.home-evo-max{font-size:11px;color:#00b894;font-weight:700;}
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
/* P1-B：点击台词气泡 */
.home-speech-bubble{z-index:8;top:74px;font-size:21px;padding:11px 22px;border-radius:18px;max-width:78%;opacity:0;transform:translateX(-50%) scale(.7);transition:opacity .3s ease,transform .3s ease;background:rgba(255,255,255,.97);border:2.5px solid #6c5ce7;color:#4a3a7a;font-weight:700;box-shadow:0 6px 20px rgba(76,58,122,.35);}
.home-speech-bubble.home-speech-show{opacity:1;transform:translateX(-50%) scale(1);}
.home-speech-bubble.home-speech-fade{opacity:0;transform:translateX(-50%) scale(.9);}
.home-speech-bubble::after{content:"";position:absolute;left:50%;bottom:-7px;transform:translateX(-50%);border:7px solid transparent;border-top-color:#6c5ce7;border-bottom:0;}
/* P1-B：背景层 */
.home-bg{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,#2a2350 0%,#3b2f63 45%,#5b4b8a 100%);transition:background .6s ease;}
.home-bg-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:none;}
/* 管理小屋弹窗（背景积分解锁制） */
.home-manage-overlay{position:fixed;inset:0;z-index:9000;display:none;align-items:center;justify-content:center;background:rgba(20,15,40,.6);backdrop-filter:blur(3px);padding:16px;}
.home-manage-overlay.show{display:flex;animation:home-fade-in .2s ease;}
.home-manage-modal{width:100%;max-width:520px;max-height:88vh;overflow-y:auto;background:linear-gradient(180deg,#fff,#f6f3ff);border-radius:18px;padding:18px 18px 22px;box-shadow:0 24px 60px rgba(40,20,80,.4);}
.home-manage-head{display:flex;justify-content:space-between;align-items:center;font-size:18px;font-weight:800;color:#4a3a7a;margin-bottom:6px;}
.home-manage-close{background:none;border:none;font-size:26px;color:#9a8fc4;cursor:pointer;line-height:1;}
.home-manage-tip{font-size:12px;color:#7a6da0;background:#f0eaff;border-radius:8px;padding:7px 10px;margin-bottom:10px;}
.home-manage-balance{font-size:13px;color:#6c5ce7;font-weight:700;margin-bottom:12px;padding:8px 12px;background:#fff;border:1px solid #e6dffa;border-radius:10px;}
.home-bg-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;}
.home-bg-card{position:relative;border-radius:14px;overflow:hidden;border:2.5px solid #e6dffa;background:#fff;transition:transform .15s,border-color .15s;}
.home-bg-card:hover{transform:translateY(-2px);}
.home-bg-card.active{border-color:#6c5ce7;box-shadow:0 0 0 3px rgba(108,92,231,.18);}
.home-bg-card.locked .home-bg-thumb{filter:grayscale(.55) brightness(.82);}
.home-bg-thumb{width:100%;height:84px;object-fit:cover;display:block;background:#eee;}
.home-bg-thumb-fallback{width:100%;height:84px;}
.home-bg-badge{position:absolute;top:6px;left:6px;font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;background:rgba(255,255,255,.92);color:#444;}
.home-bg-badge.active{background:#6c5ce7;color:#fff;}
.home-bg-badge.locked{background:rgba(40,30,60,.82);color:#fff;}
.home-bg-name{font-size:13px;font-weight:700;color:#3a3050;padding:7px 8px 2px;}
.home-bg-desc{font-size:11px;color:#8a7fa8;line-height:1.4;padding:0 8px 6px;min-height:30px;}
.home-bg-btn{display:block;width:calc(100% - 16px);margin:0 8px 9px;padding:7px 0;border:none;border-radius:9px;font-size:13px;font-weight:700;cursor:pointer;color:#fff;}
.home-bg-btn.use{background:linear-gradient(135deg,#6c5ce7,#a29bfe);}
.home-bg-btn.buy{background:linear-gradient(135deg,#f39c12,#e67e22);}
.home-bg-btn.buy.poor{background:#b8b0c8;cursor:not-allowed;}
.home-bg-btn.using{background:#d8d0f0;color:#7a6da0;cursor:default;}
.home-bg-coin{font-size:12px;margin-right:2px;}
@keyframes home-fade-in{from{opacity:0;}to{opacity:1;}}
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

    // 进化进度（基于 PetSystem.STAGES 的 min_level 区间）
    // 返回 { pct, curIdx, nextIdx, curMin, nextMin, isMax, stageName, nextName }
    function _evoProgress(s) {
        try {
            const STAGES = (window.PetSystem && PetSystem.STAGES) || null;
            const stage = s.stage || {};
            if (!STAGES || STAGES.length === 0) {
                return { pct: 0, isMax: !!stage.name, stageName: stage.name || '', nextName: '' };
            }
            const lv = s.level || 1;
            let curIdx = 0;
            for (let i = 0; i < STAGES.length; i++) {
                if (lv >= STAGES[i].min_level) curIdx = i;
            }
            const isMax = (curIdx >= STAGES.length - 1);
            if (isMax) {
                return {
                    pct: 100, isMax: true,
                    stageName: STAGES[curIdx].name,
                    nextName: ''
                };
            }
            const curMin = STAGES[curIdx].min_level;
            const nextMin = STAGES[curIdx + 1].min_level;
            const span = nextMin - curMin;
            const done = lv - curMin;
            const pct = Math.max(0, Math.min(100, Math.round((done / span) * 100)));
            return {
                pct, isMax: false,
                curIdx, nextIdx: curIdx + 1,
                curMin, nextMin,
                stageName: STAGES[curIdx].name,
                nextName: STAGES[curIdx + 1].name
            };
        } catch (e) {
            return { pct: 0, isMax: false, stageName: '', nextName: '' };
        }
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

    // ---------- 点击台词（P1-B 功能1） ----------
    // 按状态分组的中文台词库
    const SPEECH_LINES = {
        happy: ['主人最好啦~', '今天也元气满满！', '想出去玩~', '抱抱我嘛！', '嘿嘿，开心！'],
        hungry: ['好饿啊...', '肚子咕咕叫', '求投喂~', '主人有吃的吗？'],
        dirty: ['好脏呀想洗澡', '需要清洁一下~', '黏糊糊的不舒服'],
        down: ['...需要救援...', '起不来了...', '眼前发黑...'],
        weak: ['头好晕...', '没什么力气呢', '想休息一会儿'],
        default: ['哼哼~', '陪陪我嘛', '在发呆中', '今天天气不错呢', '主人加油！']
    };

    // 根据状态选择台词组（优先级：倒下 > 饥饿 > 脏 > 虚弱 > 开心 > 默认）
    function _pickSpeechGroup(s) {
        if (s.hp <= 0) return SPEECH_LINES.down;
        if (s.hunger != null && s.hunger < 30) return SPEECH_LINES.hungry;
        if (s.cleanliness != null && s.cleanliness < 20) return SPEECH_LINES.dirty;
        if (s.hp < 40) return SPEECH_LINES.weak;
        if (s.hp > 50 && s.happiness != null && s.happiness > 60) return SPEECH_LINES.happy;
        return SPEECH_LINES.default;
    }

    let _speechTimer = null;
    let _lastSpeechIdx = -1;

    // 显示点击台词气泡（复用 .home-bubble DOM/样式，叠加弹出动画 class）
    function _showSpeechBubble(text) {
        try {
            const stage = document.querySelector('#' + _lastContainer + ' .home-stage');
            if (!stage) return;
            let bubble = stage.querySelector('.home-speech-bubble');
            if (bubble) {
                bubble.remove();
            }
            bubble = document.createElement('div');
            bubble.className = 'home-speech-bubble home-bubble';
            bubble.textContent = text;
            stage.appendChild(bubble);
            // 触发弹出动画
            void bubble.offsetWidth;
            bubble.classList.add('home-speech-show');
            // 清理上一个 timer
            if (_speechTimer) { clearTimeout(_speechTimer); _speechTimer = null; }
            _speechTimer = setTimeout(() => {
                if (bubble && bubble.parentNode) {
                    bubble.classList.remove('home-speech-show');
                    bubble.classList.add('home-speech-fade');
                    setTimeout(() => { if (bubble.parentNode) bubble.remove(); }, 300);
                }
            }, 2000);
        } catch (e) {}
    }

    // 点击宠物 → 随机台词
    function onPetClick() {
        try {
            const s = PetSystem.getState();
            if (!s.species) { _toast('请先选择一只宠物'); return; }
            const group = _pickSpeechGroup(s);
            // 避免连续两次相同
            let idx;
            if (group.length <= 1) {
                idx = 0;
            } else {
                do { idx = Math.floor(Math.random() * group.length); } while (idx === _lastSpeechIdx);
            }
            _lastSpeechIdx = idx;
            _showSpeechBubble(group[idx]);
        } catch (e) {}
    }

    // ---------- 探索禁用 UI 守卫（R5 第一守卫） ----------
    function _setExploreTabDisabled(disabled) {
        const tab = document.querySelector('.nav-tab[data-page="explore"]');
        if (!tab) return;
        if (disabled) tab.classList.add('home-nav-disabled');
        else tab.classList.remove('home-nav-disabled');
    }

    function _scheduleCloudSync(reason, options) {
        if (window.CloudSync && typeof window.CloudSync.scheduleSync === 'function') {
            window.CloudSync.scheduleSync(reason || 'home_runtime', options || {});
        }
    }

    // ---------- 互动按钮处理 ----------
    function onFeed() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); window.sfx && sfx.error(); return; }
        // 先预检积分（feed 内部也会调 spendPoints，这里提前给反馈）
        if (typeof window.spendPoints !== 'function') { _toast('积分系统未就绪'); return; }
        if (typeof window.totalPoints !== 'undefined' && window.totalPoints < 10) {
            _toast('成长分不足（需 10 分）');
            return;
        }
        // 走新语义：扣 10 分 + 饱食/exp/happiness
        const res = PetSystem.feed(null, { homeContext: true });
        if (res.success && window.PetCareDaily) window.PetCareDaily.recordAction('feed');
        _toast(res.msg || (res.success ? '喂食成功' : '喂食失败'));
        window.sfx && sfx.click();
        if (window.updateStats) window.updateStats();
        renderUI(_lastContainer);
        _scheduleCloudSync('home_feed');
    }

    function onPlay() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        const res = PetSystem.play();
        if (res.success && window.PetCareDaily) window.PetCareDaily.recordAction('play');
        _toast(res.msg || (res.success ? '玩耍成功' : '玩耍失败'));
        window.sfx && sfx.click();
        renderUI(_lastContainer);
        _scheduleCloudSync('home_play');
    }

    function onBath() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        const res = PetSystem.bath();
        if (res.success && window.PetCareDaily) window.PetCareDaily.recordAction('bath');
        _toast(res.msg || (res.success ? '洗澡成功' : '洗澡失败'));
        window.sfx && sfx.click();
        renderUI(_lastContainer);
        _scheduleCloudSync('home_bath');
    }

    function onRest() {
        const s = PetSystem.getState();
        if (!s.species) { _toast('请先选择一只宠物'); return; }
        if (s.hp <= 0) { _toast('宠物倒下了，请先救援'); return; }
        const res = PetSystem.rest();
        if (res.success && window.PetCareDaily) window.PetCareDaily.recordAction('rest');
        _toast(res.msg || (res.success ? '治疗成功' : '治疗失败'));
        window.sfx && sfx.click();
        renderUI(_lastContainer);
        _scheduleCloudSync('home_rest');
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
            _scheduleCloudSync('home_rescue');
            return;
        }
        renderUI(_lastContainer);
    }

    // ---------- 摆放家具 ----------
    // 槽位兼容检查：家具 slotType 必须匹配槽位类型
    function canPlace(furnId, slotId) {
        const item = furnitureCatalogById[furnId];
        if (!item) return false;
        const slotType = SLOT_TYPES[slotId];
        if (!slotType) return false;
        return item.slotType === slotType;
    }

    function placeFurniture(furnId, slot) {
        if (!homeState || !homeState.slots) return false;
        if (furniture && furniture.indexOf(furnId) < 0) {
            _toast('尚未拥有该家具');
            return false;
        }
        // 兼容性检查：不兼容槽位拒绝摆放（不改 ownership，不改 slots）
        if (!canPlace(furnId, slot)) {
            const item = furnitureCatalogById[furnId];
            const slotType = SLOT_TYPES[slot];
            const need = item ? item.slotType : '?';
            _toast(`不兼容：该家具需要 ${need} 槽位（当前槽位类型 ${slotType || '未知'}）`);
            return false;
        }
        // 同槽位替换：旧家具只是从 slots 移出，ownership 不动 → 自动回到未摆放栏
        // （homeState.slots[slot] 被覆盖即可，旧家具 id 仍在 furniture 数组里）
        homeState.slots[slot] = furnId;
        _saveHomeState();
        _selectedFurniture = null; // 摆放后清空选中
        renderUI(_lastContainer);
        _scheduleCloudSync('home_place_furniture');
        return true;
    }

    function removeFurniture(slot) {
        if (!homeState || !homeState.slots) return;
        homeState.slots[slot] = null;
        _saveHomeState();
        renderUI(_lastContainer);
        _scheduleCloudSync('home_remove_furniture');
    }

    function addFurniture(furnId) {
        if (!furniture) furniture = [];
        if (furniture.indexOf(furnId) < 0) {
            furniture.push(furnId);
            _saveFurniture();
        }
    }

    // ---------- 未摆放家具选择态（Task 4） ----------
    let _selectedFurniture = null;
    function selectFurniture(furnId) {
        if (!furniture || furniture.indexOf(furnId) < 0) return;
        _selectedFurniture = (_selectedFurniture === furnId) ? null : furnId;
        renderUI(_lastContainer);
    }
    function clearSelection() {
        _selectedFurniture = null;
        renderUI(_lastContainer);
    }

    // ---------- 背景层（P1-B 功能2） ----------
    // 背景主题表：渐变兜底 + ChatGPT 生图 img（assets/home-bg/room-{theme}.webp）
    const BG_THEMES = {
        cozy_night: { name: '深夜温馨卧室', desc: '默认小屋，温馨的星空卧室，免费入住。', gradient: 'linear-gradient(180deg,#2a2350 0%,#3b2f63 45%,#5b4b8a 100%)', img: 'assets/home-bg/room-starter.webp', price: 0 },
        dawn: { name: '清晨阳光房', desc: '清晨阳光洒满的温暖房间，元气满满。', gradient: 'linear-gradient(180deg,#f6c68b 0%,#f3a8a2 38%,#8ecae6 100%)', img: 'assets/background/dawn.webp', price: 60 },
        starry: { name: '星空阁楼', desc: '满天星斗的安静阁楼，适合许愿。', gradient: 'radial-gradient(circle at 30% 20%,#1a1f4d 0%,#0d1130 60%,#000018 100%)', img: 'assets/home-bg/room-starry.webp', price: 80 },
        garden_balcony: { name: '花园阳台', desc: '鲜花环绕的小阳台，蝴蝶常来做客。', gradient: 'linear-gradient(180deg,#b7e4c7 0%,#8fd3c8 45%,#f6d7a7 100%)', img: 'assets/background/garden_balcony.webp', price: 60 },
        underwater_aquarium: { name: '海底水族房', desc: '海底世界水族房，和鱼儿一起游泳。', gradient: 'linear-gradient(180deg,#7ad7f0 0%,#4ca7d8 45%,#1f5d8f 100%)', img: 'assets/home-bg/room-ocean.webp', price: 100 },
        candy_cottage: { name: '糖果甜梦屋', desc: '甜蜜糖果色的梦幻小屋，甜到心里。', gradient: 'linear-gradient(180deg,#ffd6e7 0%,#ffc4a3 45%,#fff1b8 100%)', img: 'assets/home-bg/room-candy.webp', price: 80 },
        forest_treehouse: { name: '森林树屋', desc: '森林深处的秘密树屋，鸟语花香。', gradient: 'linear-gradient(180deg,#7fb77e 0%,#4f8f6b 45%,#d6b37a 100%)', img: 'assets/home-bg/room-forest.webp', price: 100 },
        volcano_hearth: { name: '火山暖窝', desc: '火山旁的温暖小窝，热乎乎超安心。', gradient: 'linear-gradient(180deg,#5b3a32 0%,#8f4e3a 42%,#f2a65a 100%)', img: 'assets/home-bg/room-volcano.webp', price: 120 }
    };
    const BG_THEME_ORDER = ['cozy_night', 'dawn', 'starry', 'garden_balcony', 'underwater_aquarium', 'candy_cottage', 'forest_treehouse', 'volcano_hearth'];  // 换背景循环顺序(8主题)

    // 循环切换背景（换背景按钮）→ 打开「管理小屋」弹窗
    function cycleHomeBg() {
        openManageHome();
    }

    // 判断背景是否已解锁（price<=0 视为免费默认）
    function _isThemeUnlocked(theme) {
        if (!homeState) _loadHomeState();
        const t = BG_THEMES[theme];
        if (!t) return false;
        if (!t.price || t.price <= 0) return true;
        return Array.isArray(homeState.unlockedThemes) && homeState.unlockedThemes.indexOf(theme) >= 0;
    }

    // 购买解锁背景（花成长分）
    function buyTheme(theme) {
        try {
            if (!homeState) _loadHomeState();
            const t = BG_THEMES[theme];
            if (!t) return false;
            if (_isThemeUnlocked(theme)) { setHomeBg(theme); _renderManageBgGrid(); return true; }
            if (typeof window.spendPoints !== 'function') { _toast('积分系统未就绪'); return false; }
            if (!window.spendPoints(t.price)) return false; // 积分不足会 alert
            if (!Array.isArray(homeState.unlockedThemes)) homeState.unlockedThemes = ['cozy_night'];
            homeState.unlockedThemes.push(theme);
            _saveHomeState();
            setHomeBg(theme);
            _toast('🎉 解锁「' + t.name + '」！');
            _renderManageBgGrid();
            _scheduleCloudSync('home_unlock_theme');
            return true;
        } catch (e) { return false; }
    }

    // 切换背景主题（仅已解锁可切，暴露到 window）
    function setHomeBg(theme) {
        try {
            if (!homeState) _loadHomeState();
            const t = BG_THEMES[theme];
            if (!t) { _toast('未知背景主题：' + theme); return false; }
            if (!_isThemeUnlocked(theme)) { _toast('该背景未解锁，先在管理小屋购买~'); return false; }
            homeState.theme = theme;
            _saveHomeState();
            // 实时更新背景层（若已渲染）
            const bg = document.querySelector('#' + _lastContainer + ' .home-bg');
            if (bg) {
                _applyBg(bg, t);
            }
            _scheduleCloudSync('home_theme_change');
            return true;
        } catch (e) { return false; }
    }

    // 「管理小屋」弹窗：背景网格（已解锁可切/未解锁花积分解锁）
    function openManageHome() {
        if (!homeState) _loadHomeState();
        let modal = document.getElementById('homeManageModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'homeManageModal';
            modal.className = 'home-manage-overlay';
            modal.innerHTML = '<div class="home-manage-modal">'
                + '<div class="home-manage-head"><span>🏠 管理小屋</span><button class="home-manage-close" onclick="HomeSystem.closeManageHome()">×</button></div>'
                + '<div class="home-manage-tip">💡 切换小屋背景需用成长分解锁；装饰家具请到【商店】购买。</div>'
                + '<div class="home-manage-balance" id="homeManageBalance"></div>'
                + '<div class="home-bg-grid" id="homeBgGrid"></div>'
                + '</div>';
            modal.addEventListener('click', e => { if (e.target === modal) closeManageHome(); });
            document.body.appendChild(modal);
        }
        _renderManageBgGrid();
        modal.classList.add('show');
    }
    function closeManageHome() {
        const modal = document.getElementById('homeManageModal');
        if (modal) modal.classList.remove('show');
    }
    // 渲染背景网格卡片
    function _renderManageBgGrid() {
        const grid = document.getElementById('homeBgGrid');
        if (!grid) return;
        if (!homeState) _loadHomeState();
        const cur = (homeState && homeState.theme) || 'cozy_night';
        const pts = (typeof window.totalPoints === 'number') ? window.totalPoints : 0;
        const unlockedCount = BG_THEME_ORDER.filter(k => _isThemeUnlocked(k)).length;
        grid.innerHTML = BG_THEME_ORDER.map(key => {
            const t = BG_THEMES[key];
            const unlocked = _isThemeUnlocked(key);
            const active = cur === key;
            const thumb = t.img
                ? `<img class="home-bg-thumb" src="${t.img}" alt="${t.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><div class="home-bg-thumb-fallback" style="display:none;background:${t.gradient}"></div>`
                : `<div class="home-bg-thumb-fallback" style="background:${t.gradient}"></div>`;
            let badge, action;
            if (active) { badge = '<span class="home-bg-badge active">✓ 使用中</span>'; action = '<button class="home-bg-btn using" disabled>当前</button>'; }
            else if (unlocked) { badge = '<span class="home-bg-badge unlocked">已拥有</span>'; action = `<button class="home-bg-btn use" onclick="HomeSystem.setHomeBg('${key}');HomeSystem.refreshManage()">切换</button>`; }
            else { badge = '<span class="home-bg-badge locked">🔒 未解锁</span>'; action = `<button class="home-bg-btn buy ${pts < t.price ? 'poor' : ''}" onclick="HomeSystem.buyTheme('${key}')"><span class="home-bg-coin">🪙</span>${t.price}</button>`; }
            return `<div class="home-bg-card ${active ? 'active' : ''} ${!unlocked ? 'locked' : ''}">${badge}${thumb}<div class="home-bg-name">${t.name}</div><div class="home-bg-desc">${t.desc || ''}</div>${action}</div>`;
        }).join('');
        const bal = document.getElementById('homeManageBalance');
        if (bal) bal.innerHTML = `💰 成长分 <b>${pts}</b> · 已解锁 <b>${unlockedCount}</b> / ${BG_THEME_ORDER.length} 间`;
    }
    function refreshManage() { _renderManageBgGrid(); }

    // 应用背景到 .home-bg 元素（img 优先，图未生时用渐变兜底）
    function _applyBg(bgEl, theme) {
        if (!bgEl || !theme) return;
        bgEl.style.background = theme.gradient || BG_THEMES.cozy_night.gradient;
        if (theme.img) {
            const img = bgEl.querySelector('.home-bg-img');
            if (img) {
                img.src = theme.img;
                img.style.display = 'block';
            }
        } else {
            const img = bgEl.querySelector('.home-bg-img');
            if (img) img.style.display = 'none';
        }
    }

    // ---------- 渲染 ----------
    let _lastContainer = 'home-container';

    function renderUI(containerId) {
        _injectStyles();
        if (!homeState || typeof homeState !== 'object' || !homeState.slots || typeof homeState.slots !== 'object') {
            _loadHomeState();
        }
        if (!Array.isArray(furniture)) {
            _loadFurniture();
        }
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

        // 家具元数据：优先取共享目录，兜底旧硬编码（避免 catalog 未加载时白屏）
        const FURN_META_FALLBACK = {
            food_bowl: { icon: '🥣', name: '食盆' },
            bath_tub: { icon: '🛁', name: '浴缸' }
        };
        function _furnMeta(id) {
            const cat = furnitureCatalogById[id];
            if (cat) return { icon: cat.icon, name: cat.name, image: cat.image || '' };
            return FURN_META_FALLBACK[id] || { icon: '📦', name: id };
        }
        // 家具视觉：image 优先(img)，无图回退 emoji icon
        function _furnVisual(meta) {
            if (!meta) return '';
            if (meta.image) return `<img src="${meta.image}" alt="${meta.name}" style="width:100%;height:100%;object-fit:contain" onerror="this.style.display='none';this.parentElement.textContent='${meta.icon}'">`;
            return meta.icon;
        }

        // 家具槽：选中态下点击兼容槽位摆放，否则点击已摆放家具移除
        const slotOrder = ['center_left', 'center_right', 'corner_left', 'back', 'corner_right'];
        const furnHtml = slotOrder.map(slot => {
            const fid = homeState.slots[slot];
            const meta = fid ? _furnMeta(fid) : null;
            // 选中了家具：判断该槽位是否兼容
            if (_selectedFurniture) {
                const ok = canPlace(_selectedFurniture, slot);
                if (meta) {
                    // 已有家具：兼容则提示替换，点击进入替换
                    return ok
                        ? `<div class="home-furn-slot filled home-furn-target" title="替换为 ${_furnMeta(_selectedFurniture).name}" onclick="HomeSystem.placeFurniture('${_selectedFurniture}','${slot}')">${_furnVisual(meta)}</div>`
                        : `<div class="home-furn-slot filled home-furn-dim" title="不兼容槽位">${_furnVisual(meta)}</div>`;
                }
                return ok
                    ? `<div class="home-furn-slot home-furn-target" title="摆放 ${_furnMeta(_selectedFurniture).name}（点击）" onclick="HomeSystem.placeFurniture('${_selectedFurniture}','${slot}')">＋</div>`
                    : `<div class="home-furn-slot home-furn-dim" title="不兼容槽位">✕</div>`;
            }
            // 未选中：常规态，点击已摆放家具移除
            if (meta) {
                return `<div class="home-furn-slot filled" title="${meta.name}（点击移除）" onclick="HomeSystem.removeFurniture('${slot}')">${_furnVisual(meta)}</div>`;
            }
            return `<div class="home-furn-slot" title="空槽位"></div>`;
        }).join('');

        // 未摆放家具栏：owned - placed，点击选中/取消
        const unplaced = getUnplacedFurniture();
        const trayHtml = (unplaced.length > 0) ? `
            <div class="home-tray">
                <div class="home-tray-head">${_selectedFurniture ? `已选：${_furnMeta(_selectedFurniture).name}（点击兼容槽位摆放，或` : '点选家具后'}<a class="home-tray-cancel" onclick="HomeSystem.clearSelection()">取消</a>）</div>
                <div class="home-tray-row">
                    ${unplaced.map(id => {
                        const m = _furnMeta(id);
                        const sel = (_selectedFurniture === id) ? 'home-tray-item-sel' : '';
                        return `<div class="home-tray-item ${sel}" title="${m.name}（点击${_selectedFurniture === id ? '取消' : '选中'}）" onclick="HomeSystem.selectFurniture('${id}')">${_furnVisual(m)}</div>`;
                    }).join('')}
                </div>
            </div>
        ` : '';

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

        const careState = window.PetCareDaily && typeof window.PetCareDaily.getState === 'function'
            ? window.PetCareDaily.getState()
            : { progress: 0, total: 4, complete: false, remaining: [], labels: {} };
        const nextCare = window.PetCareDaily && typeof window.PetCareDaily.getNextAction === 'function'
            ? window.PetCareDaily.getNextAction(s)
            : null;
        const careRemaining = careState.remaining.map((action) => careState.labels[action] || action).join('、');
        const careHtml = `
            <div class="home-care-daily" data-home-care-daily>
                <div class="home-care-head"><strong>今日照料 ${careState.progress}/${careState.total}</strong><span>${careState.complete ? '🎉 已完成' : '再照顾几步吧'}</span></div>
                <div class="home-care-track"><div class="home-care-fill" style="width:${Math.round((careState.progress / careState.total) * 100)}%"></div></div>
                <div class="home-care-meta">${careState.complete ? '今天的宠物照料完成啦！' : `还需要：${careRemaining || '无'}`}</div>
                ${nextCare ? `<button class="home-care-next" type="button" onclick="HomeSystem.on${nextCare.action.charAt(0).toUpperCase() + nextCare.action.slice(1)}()">${nextCare.label}：${nextCare.reason}</button>` : ''}
            </div>
        `;

        // 进化进度条（P1-B）：基于 PetSystem.STAGES 的 min_level 区间
        const evo = _evoProgress(s);
        const evoHtml = s.species ? (evo.isMax
            ? `<div class="home-evo">
                   <div class="home-evo-head">
                       <span class="home-evo-lv">Lv.${s.level} · ${evo.stageName}</span>
                       <span class="home-evo-max">🌟 最终形态</span>
                   </div>
                   <div class="home-evo-bar"><div class="home-evo-fill" style="width:100%"></div></div>
                   <div class="home-evo-meta"><span>已达最高进化阶段</span><span>MAX</span></div>
               </div>`
            : `<div class="home-evo">
                   <div class="home-evo-head">
                       <span class="home-evo-lv">Lv.${s.level} · ${evo.stageName}</span>
                       <span class="home-evo-stage">下一阶段：${evo.nextName}（Lv.${evo.nextMin}）</span>
                   </div>
                   <div class="home-evo-bar"><div class="home-evo-fill" data-evo-fill style="width:${evo.pct}%"></div></div>
                   <div class="home-evo-meta"><span>当前 Lv.${s.level}</span><span>需 Lv.${evo.nextMin} 进化（${evo.pct}%）</span></div>
               </div>`) : '';

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
            ${evoHtml}
        `;

        // 互动按钮（倒下态禁用）
        const btnDisabled = downed ? 'disabled' : '';
        const actionsHtml = `
            <div class="home-card">
                <h4>互动（喂食消耗 10 成长分）</h4>
                ${careHtml}
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

        // P1-B 功能2：背景层（渐变兜底 + 预留 img 接口）
        const curThemeName = (homeState && homeState.theme) || 'cozy_night';
        const curTheme = BG_THEMES[curThemeName] || BG_THEMES.cozy_night;
        const bgImgDisplay = curTheme.img ? 'block' : 'none';
        const bgHtml = `<div class="home-bg" data-bg-theme="${curThemeName}" style="background:${curTheme.gradient};">
            <img class="home-bg-img" src="${curTheme.img || ''}" alt="" style="display:${bgImgDisplay};">
        </div>`;

        container.innerHTML = `
            <div class="home-wrap">
                <div class="home-stage">
                    ${bgHtml}
                    <button class="home-bg-switch" onclick="HomeSystem.cycleHomeBg()" title="管理小屋 / 切换背景">🏠 管理小屋</button>
                    ${bubbleHtml}
                    ${cleanHtml}
                    <div class="home-pet-wrap" onclick="HomeSystem.onPetClick()">${petImgHtml}</div>
                    <div class="home-furniture-row">${furnHtml}</div>
                    ${rescueHtml}
                </div>
                <div class="home-side">
                    <div class="home-card">
                        <h4>${nameHtml} · ${s.stage ? s.stage.name : ''}</h4>
                        ${vitHtml}
                    </div>
                    ${actionsHtml}
                    <div id="home-visit-slot"></div>
                    <div id="home-social-panel"></div>
                    ${trayHtml}
                </div>
            </div>
        `;
        if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh();
        } else if (window.SocialSystem) {
            if (typeof window.SocialSystem.renderHomeVisitSlot === 'function') {
                window.SocialSystem.renderHomeVisitSlot('home-visit-slot');
            }
            if (typeof window.SocialSystem.renderHomePanel === 'function') {
                window.SocialSystem.renderHomePanel('home-social-panel');
            }
        }
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
        canPlace, selectFurniture, clearSelection,
        onPetClick, setHomeBg, cycleHomeBg,
        openManageHome, closeManageHome, buyTheme, refreshManage,
        markExit,
        loadCatalog,
        getFurnitureCatalog,
        getUnplacedFurniture,
        getThemeMeta: (theme) => {
            const key = theme || ((homeState && homeState.theme) || 'cozy_night');
            const meta = BG_THEMES[key];
            return meta ? Object.assign({ id: key }, meta) : null;
        },
        getHomeState: () => homeState,
        getFurniture: () => furniture
    };
})();

window.HomeSystem = HomeSystem;
