// ============================================================
// js/hanzi-game.js
// 汉字答题玩法（P1）· 复用 math-pk 结算骨架：出题→判对错→计分→addGrowthPoints→Leaderboard.record
// 零依赖，IIFE + window.HanziGame 挂载
// ============================================================
(function () {
    'use strict';

    const CONFIG = {
        TOTAL_ROUNDS: 10,
        BASE_SCORE: 10,
        COMBO_STEP: 2,
        COMBO_CAP: 20,        // 连击加成上限 +20
        QUESTIONS_URL: 'data/hanzi-questions.json',
        HSK_URL: 'data/hanzi-hsk.json',
        IMPL_MODES: ['choose-char-by-pinyin', 'fill-blank'] // 本期实现的 2 种
    };
    // 大厅等级卡（启蒙关 1-3 + HSK 1 级）
    const LEVEL_CARDS = [
        { lv: '1', tag: '启蒙' }, { lv: '2', tag: '进阶' }, { lv: '3', tag: '提高' },
        { lv: 'hsk1', tag: 'HSK 1' }
    ];

    const MODE_LABELS = {
        'choose-char-by-pinyin': '看拼音选字',
        'fill-blank': '例句填空'
    };
    const ROUND_BACKGROUNDS = [
        'assets/scenes/stargarden.webp',
        'assets/scenes/forest.webp',
        'assets/scenes/castle.webp',
        'assets/scenes/waterfall.webp'
    ];
    const BG_ROTATE_EVERY = 3;

    const state = {
        bank: null,           // { levels: {1:[...],2:[...],3:[...]} }
        bankLoaded: false,
        level: '1',
        mode: 'solo',
        isPlaying: false,
        round: 0,
        score: 0,
        combo: 0,
        maxCombo: 0,
        correctCount: 0,
        answered: 0,          // 实际答题数（Bug2 守卫：0 题不入榜）
        asked: null,          // 本局已出 itemId 集合（Bug1：局内去重）
        roundClosing: false,
        currentQ: null,       // { char, pinyin, emoji, example, answer, opts, mode }
        matchStartTs: 0,
    };
    let containerIdArg = 'hanzi-container';   // 由 renderUI 设置，chooseLevel 刷新大厅时复用
    const gameTimers = new Set();
    let toastTimer = null;

    function scheduleGameTimeout(callback, delay) {
        const timer = setTimeout(() => {
            gameTimers.delete(timer);
            callback();
        }, delay);
        gameTimers.add(timer);
        return timer;
    }

    function clearGameTimers() {
        gameTimers.forEach(timer => clearTimeout(timer));
        gameTimers.clear();
        if (toastTimer) {
            clearTimeout(toastTimer);
            toastTimer = null;
        }
    }

    function getRoundTotal() {
        return CONFIG.TOTAL_ROUNDS;
    }

    // ---------- 工具 ----------
    function _shuffle(arr) {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }
    function _pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
    function _resolveLocalAsset(path) {
        if (!path) return path;
        return window.resolvePetBankAssetUrl ? window.resolvePetBankAssetUrl(path) : path;
    }

    function _backgroundForRound(round) {
        const safeRound = Math.max(1, Number(round || 1));
        const idx = Math.floor((safeRound - 1) / BG_ROTATE_EVERY) % ROUND_BACKGROUNDS.length;
        return ROUND_BACKGROUNDS[idx];
    }

    function _applyRoundBackground(round) {
        const ov = document.getElementById('hz-overlay');
        if (!ov) return;
        const bg = _backgroundForRound(round);
        const bgUrl = _resolveLocalAsset(bg);
        ov.style.setProperty('--hz-bg', `url("${bgUrl}")`);
        ov.dataset.hzBg = bg;
    }

    // ---------- 学习记忆（HanziProgress）itemId 工具 ----------
    // itemId 规范："{level}:{type}:{key}"  type∈{char,word}
    //   有 word 字段 → 词组填空用 word；否则 char（启蒙关 + HSK 单字）
    function _itemIdFor(level, item) {
        if (!item) return String(level) + ':char:';
        if (item.word) return level + ':word:' + item.word;
        const key = item.char || item.answer || '';
        return level + ':char:' + key;
    }
    function _levelPool(level) {
        const bucket = (state.bank && state.bank.levels && state.bank.levels[level]) || [];
        return bucket.map(it => _itemIdFor(level, it));
    }

    async function _loadBank() {
        if (state.bankLoaded) return state.bank;
        try {
            const resp = await fetch(_resolveLocalAsset(CONFIG.QUESTIONS_URL));
            if (resp.ok) {
                state.bank = await resp.json();
                state.bankLoaded = true;
            }
        } catch (e) {
            console.warn('hanzi-questions.json 加载失败:', e);
        }
        // 合并 HSK 题库（levels.hsk1 → 启蒙关并存）
        if (state.bank) {
            try {
                const r2 = await fetch(_resolveLocalAsset(CONFIG.HSK_URL));
                if (r2.ok) {
                    const hsk = await r2.json();
                    if (hsk && hsk.levels && hsk.levels.hsk1) {
                        state.bank.levels.hsk1 = hsk.levels.hsk1;
                    }
                }
            } catch (e) {
                console.warn('hanzi-hsk.json 加载失败（HSK 入口将不可用）:', e);
            }
        }
        return state.bank;
    }

    // 把 example 解析为 { before, target, after }
    //   启蒙关格式：abc**字**def （target 由 ** 包裹）
    //   HSK 词组填空格式：爱？  （？为占位，target = answer）
    function _parseExample(example, answer) {
        const s = String(example || '');
        const m = s.match(/^(.*?)\*\*(.+?)\*\*(.*)$/s);
        if (m) return { before: m[1], target: m[2], after: m[3] };
        const qIdx = s.indexOf('？');
        if (qIdx >= 0) {
            return { before: s.slice(0, qIdx), target: answer || '', after: s.slice(qIdx + 1) };
        }
        return { before: s, target: '', after: '' };
    }

    // ---------- 手绘插图（UI v2 P2）----------
    // 有图字集合：命中则渲染 assets/ui/hanzi-img/{char}.png，否则 fallback emoji。
    // 题库确认此 30 字作为单字出现（启蒙关 q.char / HSK 关 q.answer）。
    const HANZI_IMG_CHARS = new Set('山水日月花木火雨云星树草果风河鸟马牛鸡车书桌门杯茶田石笔船海'.split(''));
    // 返回题图区域 html：单字命中 manifest → <img>；否则保留原 emoji（HSK 关 emoji 空 → 空串，不报错）。
    function _renderEmoji(q) {
        const char = (q && (q.char || q.answer)) || '';
        if (char && HANZI_IMG_CHARS.has(char)) {
            return `<img src="${_resolveLocalAsset(`assets/ui/hanzi-img/${char}.png`)}" class="hz-emoji-img" alt="${char}">`;
        }
        return (q && q.emoji) || '';
    }

    // 取一道题：先让 HanziProgress.pickNext 按「错题>新字>learning>mastered」权重
    //   决定目标 itemId（学习记忆驱动，传 state.asked 做局内去重），再从桶里取对应条目；兜底随机。
    function _genQuestion() {
        const bucket = (state.bank && state.bank.levels && state.bank.levels[state.level]) || [];
        if (!bucket.length) return null;
        let item = null;
        if (window.HanziProgress && typeof window.HanziProgress.pickNext === 'function') {
            try {
                const pool = _levelPool(state.level);
                const targetId = window.HanziProgress.pickNext(pool, state.asked);
                if (targetId) item = bucket.find(it => _itemIdFor(state.level, it) === targetId) || null;
            } catch (_) {}
        }
        if (!item) {
            // 兜底随机：同样尊重本局去重（state.asked）
            let cand = bucket;
            if (state.asked && state.asked.size) {
                const f = bucket.filter(it => !state.asked.has(_itemIdFor(state.level, it)));
                if (f.length) cand = f;
            }
            item = _pick(cand);
        }
        if (item && state.asked) state.asked.add(_itemIdFor(state.level, item));
        const usable = (item.modes || []).filter(m => CONFIG.IMPL_MODES.indexOf(m) >= 0);
        const mode = usable.length ? _pick(usable) : CONFIG.IMPL_MODES[0];
        // opts 打乱，保持 answer 在内
        const opts = _shuffle(item.opts && item.opts.length ? item.opts : [item.answer]);
        return Object.assign({}, item, { mode: mode, opts: opts });
    }

    // ---------- 渲染 ----------
    const render = {
        _lobby(containerId) {
            const el = document.getElementById(containerId);
            if (!el) return;
            const best = (window.Leaderboard && typeof window.Leaderboard.getBest === 'function')
                ? window.Leaderboard.getBest('hanzi') : 0;
            el.innerHTML = `
                <div class="hz-lobby card">
                    <div class="hz-page-actions">
                        <button class="hz-page-btn" type="button" onclick="switchPage('map')">首页</button>
                        <div class="hz-page-actions-right">
                            <button class="hz-page-btn is-close" type="button" onclick="switchPage('playground')">关闭</button>
                        </div>
                    </div>
                    <div class="hz-lobby-head">
                        <h2>📝 汉字挑战</h2>
                        <p>看拼音选字 / 例句填空 · 答对加分 · 连击有奖</p>
                    </div>
                    <div class="hz-level-grid">
                        ${LEVEL_CARDS.map(c => {
                            const bucket = (state.bank && state.bank.levels && state.bank.levels[c.lv]) || [];
                            const cnt = bucket.length;
                            let progHtml = `<div class="hz-level-sub">${cnt} 题</div>`;
                            if (cnt && window.HanziProgress && typeof window.HanziProgress.stats === 'function') {
                                try {
                                    const s = window.HanziProgress.stats(c.lv, _levelPool(c.lv));
                                    progHtml = `
                                        <div class="hz-level-sub">${cnt} 题</div>
                                        <div class="hz-level-prog"><span>已学</span> <b>${s.learned}/${s.total}</b></div>
                                        <div class="hz-level-prog"><span>掌握</span> <b>${s.mastered}</b> · 待复习 <b>${s.toReview}</b></div>`;
                                } catch (_) {}
                            }
                            return `
                            <button class="hz-level-card ${String(state.level) === String(c.lv) ? 'active' : ''}" type="button" data-lv="${c.lv}" onclick="HanziGame.chooseLevel('${c.lv}')">
                                <div class="hz-level-num">${c.lv === 'hsk1' ? 'HSK' : 'Lv.' + c.lv}</div>
                                <div class="hz-level-label">${c.tag}</div>
                                ${progHtml}
                            </button>`;
                        }).join('')}
                    </div>
                    <button class="hz-start-btn" type="button" onclick="HanziGame.start()">▶ 开始挑战（${CONFIG.TOTAL_ROUNDS} 题）</button>
                    <div class="hz-best-hint">🥇 你的最高分：<b>${best}</b></div>
                </div>`;
        },

        _overlay() {
            // 全屏覆盖层（对齐 math-pk：fixed;inset:0;z-index:1000）
            let ov = document.getElementById('hz-overlay');
            if (!ov) {
                ov = document.createElement('div');
                ov.id = 'hz-overlay';
                ov.className = 'hz-overlay';
                document.body.appendChild(ov);
            }
            ov.style.display = 'flex';
            _applyRoundBackground(1);
            ov.innerHTML = `
                <div class="hz-stage">
                    <div class="hz-topbar">
                        <div class="hz-topbar-left">
                            <button class="hz-home-btn" type="button" onclick="switchPage('map')">首页</button>
                        </div>
                        <div class="hz-topbar-center">
                            <span class="hz-pill" id="hz-round-pill">第 0/${CONFIG.TOTAL_ROUNDS} 题</span>
                            <span class="hz-pill hz-score-pill" id="hz-score-pill">0 分</span>
                        </div>
                        <div class="hz-topbar-right">
                            <button class="hz-exit-btn" type="button" onclick="HanziGame._exit()">关闭</button>
                        </div>
                    </div>
                    <div class="hz-card" id="hz-card"></div>
                    <div class="hz-opts" id="hz-opts"></div>
                </div>
                <div class="hz-toast" id="hz-toast"></div>`;
        },

        _hideOverlay() {
            const ov = document.getElementById('hz-overlay');
            if (ov) ov.style.display = 'none';
        },

        _roundPill() {
            const el = document.getElementById('hz-round-pill');
            if (el) el.textContent = `第 ${state.round}/${getRoundTotal()} 题`;
        },
        _scorePill() {
            const el = document.getElementById('hz-score-pill');
            if (el) el.textContent = `${state.score} 分`;
        },

        _question(q) {
            const card = document.getElementById('hz-card');
            const optsEl = document.getElementById('hz-opts');
            if (!card || !optsEl) return;
            _applyRoundBackground(state.round || 1);

            let bodyHtml = '';
            if (q.mode === 'choose-char-by-pinyin') {
                // 看拼音 + emoji，选汉字（不显示汉字大字）
                bodyHtml = `
                    <span class="hz-mode-tag">🔊 看拼音选字</span>
                    <div class="hz-emoji">${_renderEmoji(q)}</div>
                    <div class="hz-pinyin">${q.pinyin}</div>
                    <div class="hz-example" style="color:#94a3b8;font-size:13px;">从下方选出这个拼音对应的汉字</div>`;
            } else {
                // fill-blank：例句挖掉目标字，选汉字
                //   启蒙关 example 用 **字** 标记；HSK 词组用 「？」占位。
                //   example 为空时回退为「选这个拼音对应字」提示，不崩。
                const ex = q.example || '';
                if (!ex) {
                    bodyHtml = `
                        <span class="hz-mode-tag">✏️ 例句填空</span>
                        <div class="hz-emoji">${_renderEmoji(q)}</div>
                        <div class="hz-pinyin">${q.pinyin}</div>
                        <div class="hz-example" style="color:#94a3b8;font-size:13px;">选出这个拼音对应的汉字</div>`;
                } else {
                    const parts = _parseExample(ex, q.answer);
                    bodyHtml = `
                        <span class="hz-mode-tag">✏️ 例句填空</span>
                        <div class="hz-emoji">${_renderEmoji(q)}</div>
                        <div class="hz-pinyin">${q.pinyin}</div>
                        <div class="hz-example">${parts.before}<span class="hz-blank">？</span>${parts.after}</div>`;
                }
            }
            card.innerHTML = bodyHtml;
            // 学习记忆角标：新字「新」/ 待复习「复习」
            if (window.HanziProgress && typeof window.HanziProgress.getStatus === 'function') {
                let badge = '';
                try {
                    const st = window.HanziProgress.getStatus(_itemIdFor(state.level, q));
                    if (!st.seen) badge = '<span class="hz-badge hz-badge-new">新</span>';
                    else if (st.wrong > 0 && st.status !== 'mastered') badge = '<span class="hz-badge hz-badge-review">复习</span>';
                } catch (_) {}
                if (badge) {
                    const tag = card.querySelector('.hz-mode-tag');
                    if (tag) tag.insertAdjacentHTML('afterend', badge);
                }
            }
            card.classList.remove('fading');

            optsEl.innerHTML = q.opts.map((o, i) =>
                `<button class="hz-opt" data-i="${i}" onclick="HanziGame._answer(this, '${o.replace(/'/g, "\\'")}')">${o}</button>`
            ).join('');
        },

        _markOpt(optEl, ok) {
            if (!optEl) return;
            optEl.classList.add(ok ? 'correct' : 'wrong');
        },
        _disableOpts() {
            document.querySelectorAll('#hz-opts .hz-opt').forEach(b => b.classList.add('disabled'));
        },

        _toast(text, kind) {
            const t = document.getElementById('hz-toast');
            if (!t) return;
            t.className = 'hz-toast show ' + (kind || '');
            t.innerHTML = text;
            if (toastTimer) clearTimeout(toastTimer);
            toastTimer = scheduleGameTimeout(() => {
                toastTimer = null;
                t.classList.remove('show');
            }, 1100);
        },

        _fadeCard(cb) {
            const card = document.getElementById('hz-card');
            if (!card) { cb && cb(); return; }
            card.classList.add('fading');
            scheduleGameTimeout(() => {
                if (state.isPlaying) cb && cb();
            }, 320);
        },

        _result() {
            const ov = document.getElementById('hz-overlay');
            if (!ov) return;
            _applyRoundBackground(state.round || 1);
            const total = getRoundTotal();
            const correct = state.correctCount;
            const acc = total ? Math.round(correct / total * 100) : 0;
            const emoji = acc >= 80 ? '🌟' : (acc >= 50 ? '👍' : '🌱');
            ov.innerHTML = `
                <div class="hz-stage">
                    <div class="hz-result">
                        <div class="hz-result-emoji">${emoji}</div>
                        <div class="hz-result-title">${acc >= 80 ? '太棒了！' : (acc >= 50 ? '继续努力！' : '再练一局吧')}</div>
                        <div class="hz-result-score">${state.score} 分</div>
                        <div class="hz-result-meta">答对 ${correct}/${total} · 最高连击 ${state.maxCombo} · 正确率 ${acc}%</div>
                        <div class="hz-result-actions">
                            <button class="hz-btn-primary" onclick="HanziGame.start()">🔁 再来一局</button>
                            <button class="hz-btn-secondary" onclick="HanziGame._exit()">返回游乐场</button>
                        </div>
                    </div>
                </div>`;
        }
    };

    // ---------- 流程 ----------
    async function init() {
        await _loadBank();
    }

    async function renderUI(containerId) {
        await _loadBank();
        render._lobby(containerId);
    }

    function chooseLevel(lv) {
        state.level = String(lv);
        render._lobby(containerIdArg);
    }

    async function start() {
        await _loadBank();
        if (!state.bank) { alert('题库加载失败，请稍后再试'); return; }
        // Bug2 守卫：空等级不允许开始（避免不出题直接结算写假 0 分）
        const pool = _levelPool(state.level);
        if (!pool.length) {
            if (typeof showToast === 'function') showToast('该等级暂无题目，请稍后再试');
            else alert('该等级暂无题目，请稍后再试');
            return;
        }
        clearGameTimers();
        state.mode = 'solo';
        state.isPlaying = true;
        state.round = 0;
        state.score = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.correctCount = 0;
        state.answered = 0;
        state.asked = new Set();   // Bug1：本局已出 itemId 集合
        state.matchStartTs = Date.now();
        render._overlay();
        render._scorePill();
        _next();
    }

    function _next() {
        if (state.round >= getRoundTotal()) { void _end(); return; }
        state.round++;
        state.roundClosing = false;
        state.currentQ = _genQuestion();
        if (!state.currentQ) { void _end(); return; }
        render._roundPill();
        render._fadeCard(() => {
            render._question(state.currentQ);
        });
    }

    function _answer(btnEl, selected) {
        if (!state.isPlaying || state.roundClosing) return;
        state.roundClosing = true;
        state.answered++;   // Bug2：累计实际答题数
        render._disableOpts();
        const q = state.currentQ;
        const ok = selected === q.answer;
        // 学习记忆：记录本题对错（不阻塞主流程）
        if (window.HanziProgress && typeof window.HanziProgress.record === 'function') {
            try { window.HanziProgress.record(_itemIdFor(state.level, q), ok); } catch (_) {}
        }
        if (ok) {
            state.correctCount++;
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            const bonus = Math.min(state.combo * CONFIG.COMBO_STEP, CONFIG.COMBO_CAP);
            const gain = CONFIG.BASE_SCORE + bonus;
            state.score += gain;
            render._markOpt(btnEl, true);
            render._toast(`✓ 答对！<small>+${gain} 分${bonus > 0 ? '（连击 +' + bonus + '）' : ''}</small>`, 'win');
        } else {
            state.combo = 0;
            render._markOpt(btnEl, false);
            // 高亮正确项
            const opts = document.querySelectorAll('#hz-opts .hz-opt');
            opts.forEach(b => { if (b.textContent === q.answer) b.classList.add('correct'); });
            render._toast(`✗ 答错了<small>正确答案：${q.answer}</small>`, 'lose');
        }
        render._scorePill();
        scheduleGameTimeout(() => { render._fadeCard(() => _next()); }, 1100);
    }

    async function _end() {
        state.isPlaying = false;
        clearGameTimers();
        const earned = state.score;
        const profileId = window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function'
            ? (window.ProfileManager.getActiveId() || 'p_default')
            : 'p_default';
        const localDate = window.PetBankDailyState && typeof window.PetBankDailyState.localDate === 'function'
            ? window.PetBankDailyState.localDate()
            : (window.PetBankTime && typeof window.PetBankTime.localDate === 'function'
                ? window.PetBankTime.localDate()
                : '');
        const receiptService = window.GameRewardReceipts && typeof window.GameRewardReceipts.claim === 'function'
            ? window.GameRewardReceipts
            : null;
        if (receiptService) {
            const receipt = receiptService.claim({
                profileId,
                source: 'hanzi',
                eventId: `${state.matchStartTs || Date.now()}:${state.level}`,
                points: earned,
                localDate
            });
            if (!receipt.accepted && typeof window.showToast === 'function') {
                window.showToast('本局奖励已经领取过了');
            }
        } else if (window.PetBankPoints && typeof window.PetBankPoints.add === 'function') {
            window.PetBankPoints.add(earned);
        } else if (typeof window.showToast === 'function') {
            window.showToast('积分系统未就绪，本局奖励未发放');
        }
        // 入榜（Bug2 守卫：实际答题数=0 时不入榜，避免假 0 分记录）
        if (state.answered > 0 && window.Leaderboard && typeof window.Leaderboard.record === 'function') {
            window.Leaderboard.record('hanzi', state.score, {
                correct: state.correctCount,
                total: getRoundTotal()
            });
        }
        render._result();
    }

    function stop() {
        state.isPlaying = false;
        clearGameTimers();
        render._hideOverlay();
    }

    function _exit() {
        stop();
        if (typeof window.switchPage === 'function') switchPage('playground');
    }

    function getLevelLabel(level) {
        const card = LEVEL_CARDS.find(function (item) {
            return String(item.lv) === String(level);
        });
        if (!card) return '启蒙';
        if (card.lv === 'hsk1') return 'HSK 1';
        return card.tag + ' ' + card.lv;
    }

    // ---------- 挂载 ----------
    window.HanziGame = {
        renderUI: function (cid) { containerIdArg = cid || 'hanzi-container'; return renderUI(cid || 'hanzi-container'); },
        chooseLevel: function (lv) {
            state.level = String(lv);
            render._lobby(containerIdArg);
        },
        start: start,
        _answer: _answer,
        _exit: _exit,
        stop: stop,
        init: init,
        getLevel: function () { return state.level; }
    };
})();
