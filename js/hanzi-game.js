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
        asyncMatch: null,
        asyncQuestions: null,
        matchStartTs: 0,
        asyncSummaryNote: ''
    };
    let containerIdArg = 'hanzi-container';   // 由 renderUI 设置，chooseLevel 刷新大厅时复用

    function isAsyncMode() {
        return state.mode === 'async';
    }

    function getRoundTotal() {
        return isAsyncMode() && Array.isArray(state.asyncQuestions) && state.asyncQuestions.length
            ? state.asyncQuestions.length
            : CONFIG.TOTAL_ROUNDS;
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
                            <div class="hz-level-card ${String(state.level) === String(c.lv) ? 'active' : ''}" data-lv="${c.lv}" onclick="HanziGame.chooseLevel('${c.lv}')">
                                <div class="hz-level-num">${c.lv === 'hsk1' ? 'HSK' : 'Lv.' + c.lv}</div>
                                <div class="hz-level-label">${c.tag}</div>
                                ${progHtml}
                            </div>`;
                        }).join('')}
                    </div>
                    <button class="hz-start-btn" onclick="HanziGame.start()">▶ 开始挑战（${CONFIG.TOTAL_ROUNDS} 题）</button>
                    <div id="hanzi-async-root" style="margin-top:14px;"></div>
                    <div class="hz-best-hint">🥇 你的最高分：<b>${best}</b></div>
                </div>`;
            if (window.PKService && typeof window.PKService.renderBanner === 'function') {
                window.PKService.renderBanner('hanzi');
                if (typeof window.PKService.refresh === 'function') {
                    void window.PKService.refresh();
                }
            }
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
                        <span class="hz-pill" id="hz-round-pill">第 0/${CONFIG.TOTAL_ROUNDS} 题</span>
                        <span class="hz-pill hz-score-pill" id="hz-score-pill">0 分</span>
                        <button class="hz-exit-btn" onclick="HanziGame._exit()">✕ 退出</button>
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
            clearTimeout(t._timer);
            t._timer = setTimeout(() => { t.classList.remove('show'); }, 1100);
        },

        _fadeCard(cb) {
            const card = document.getElementById('hz-card');
            if (!card) { cb && cb(); return; }
            card.classList.add('fading');
            setTimeout(() => cb && cb(), 320);
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
                        <div class="hz-result-title">${isAsyncMode() ? '好友异步挑战完成' : (acc >= 80 ? '太棒了！' : (acc >= 50 ? '继续努力！' : '再练一局吧'))}</div>
                        <div class="hz-result-score">${state.score} 分</div>
                        <div class="hz-result-meta">答对 ${correct}/${total} · 最高连击 ${state.maxCombo} · 正确率 ${acc}%</div>
                        ${state.asyncSummaryNote ? `<div class="hz-result-meta">${state.asyncSummaryNote}</div>` : ''}
                        <div class="hz-result-actions">
                            <button class="hz-btn-primary" onclick="${isAsyncMode() ? "HanziGame.renderUI('hanzi-container')" : 'HanziGame.start()'}">${isAsyncMode() ? '返回大厅' : '🔁 再来一局'}</button>
                            <button class="hz-btn-secondary" onclick="HanziGame._exit()">🏆 看排行榜</button>
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
        state.mode = 'solo';
        state.asyncMatch = null;
        state.asyncQuestions = null;
        state.asyncSummaryNote = '';
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

    async function startAsyncMatch(match) {
        await _loadBank();
        if (!match || !match.questionSetPayload || !Array.isArray(match.questionSetPayload.questions)) return;
        state.mode = 'async';
        state.asyncMatch = match;
        state.asyncQuestions = match.questionSetPayload.questions.slice();
        state.asyncSummaryNote = '';
        state.isPlaying = true;
        state.round = 0;
        state.score = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.correctCount = 0;
        state.answered = 0;
        state.asked = new Set();
        state.matchStartTs = Date.now();
        render._overlay();
        render._scorePill();
        _next();
    }

    function _next() {
        if (state.round >= getRoundTotal()) { void _end(); return; }
        state.round++;
        state.roundClosing = false;
        state.currentQ = isAsyncMode()
            ? state.asyncQuestions[state.round - 1]
            : _genQuestion();
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
        setTimeout(() => { render._fadeCard(() => _next()); }, 1100);
    }

    async function _end() {
        state.isPlaying = false;
        const earned = state.score;
        // 写成长分（对齐 math-pk：addGrowthPoints(earned) 单参）
        if (typeof window.addGrowthPoints === 'function') {
            window.addGrowthPoints(earned);
        } else if (window.totalPoints !== undefined) {
            window.totalPoints = Math.max(0, Number(window.totalPoints || 0) + earned);
            if (typeof window.saveAppState === 'function') window.saveAppState();
            if (typeof window.updateStats === 'function') window.updateStats();
        }
        if (isAsyncMode()) {
            try {
                if (window.PKService && typeof window.PKService.submitAttempt === 'function' && state.asyncMatch) {
                    const submitResult = await window.PKService.submitAttempt(state.asyncMatch.id, {
                        gameType: 'hanzi',
                        score: state.score,
                        correctCount: state.correctCount,
                        total: getRoundTotal(),
                        durationMs: Date.now() - state.matchStartTs,
                        payloadJson: {
                            total: getRoundTotal(),
                            questions: state.asyncQuestions
                        }
                    });
                    state.asyncSummaryNote = submitResult && submitResult.message
                        ? submitResult.message
                        : '成绩已提交，等待好友作答。';
                }
            } catch (error) {
                state.asyncSummaryNote = error && error.message ? error.message : '成绩提交失败，请稍后重试。';
            }
        }
        // 入榜（Bug2 守卫：实际答题数=0 时不入榜，避免假 0 分记录）
        if (state.answered > 0 && window.Leaderboard && typeof window.Leaderboard.record === 'function') {
            window.Leaderboard.record('hanzi', state.score, {
                correct: state.correctCount,
                total: getRoundTotal(),
                asyncMatch: isAsyncMode()
            });
        }
        render._result();
    }

    function _exit() {
        state.isPlaying = false;
        render._hideOverlay();
        if (typeof window.switchPage === 'function') switchPage('leaderboard');
    }

    async function buildAsyncQuestionSet() {
        await _loadBank();
        const bucket = (state.bank && state.bank.levels && state.bank.levels[state.level]) || [];
        const sampled = _shuffle(bucket).slice(0, CONFIG.TOTAL_ROUNDS).map(function (item) {
            const usable = (item.modes || []).filter(function (mode) {
                return CONFIG.IMPL_MODES.indexOf(mode) >= 0;
            });
            const mode = usable.length ? _pick(usable) : CONFIG.IMPL_MODES[0];
            return {
                answer: item.answer,
                pinyin: item.pinyin,
                example: item.example || '',
                opts: _shuffle(item.opts && item.opts.length ? item.opts : [item.answer]),
                mode: mode,
                emoji: item.emoji || '',
                char: item.char || ''
            };
        });
        return {
            gameType: 'hanzi',
            level: state.level,
            totalRounds: CONFIG.TOTAL_ROUNDS,
            questions: sampled
        };
    }

    function getLevelLabel(level) {
        const card = LEVEL_CARDS.find(function (item) {
            return String(item.lv) === String(level);
        });
        if (!card) return '启蒙';
        if (card.lv === 'hsk1') return 'HSK 1';
        return card.tag + ' ' + card.lv;
    }

    function describeAsyncQuestionSet(payload) {
        const level = payload && payload.level ? payload.level : state.level;
        const questions = Array.isArray(payload && payload.questions) ? payload.questions : [];
        const totalRounds = payload && payload.totalRounds ? payload.totalRounds : CONFIG.TOTAL_ROUNDS;
        const uniqueModes = [...new Set(questions.map(function (item) {
            return item && item.mode ? item.mode : '';
        }).filter(Boolean))];

        let modeLabel = '混合题型';
        if (!uniqueModes.length) {
            modeLabel = '识字练习';
        } else if (uniqueModes.length === 1) {
            modeLabel = MODE_LABELS[uniqueModes[0]] || uniqueModes[0];
        } else {
            modeLabel = uniqueModes.map(function (mode) {
                return MODE_LABELS[mode] || mode;
            }).join(' / ');
        }

        return {
            level: level,
            levelLabel: getLevelLabel(level),
            modeLabel: modeLabel,
            totalRounds: totalRounds,
            summaryText: getLevelLabel(level) + ' · ' + modeLabel + ' · ' + totalRounds + ' 题同题挑战'
        };
    }

    // ---------- 挂载 ----------
    window.HanziGame = {
        renderUI: function (cid) { containerIdArg = cid || 'hanzi-container'; return renderUI(cid || 'hanzi-container'); },
        chooseLevel: function (lv) {
            state.level = String(lv);
            render._lobby(containerIdArg);
        },
        start: start,
        startAsyncMatch: startAsyncMatch,
        _answer: _answer,
        _exit: _exit,
        init: init,
        buildAsyncQuestionSet: buildAsyncQuestionSet,
        describeAsyncQuestionSet: describeAsyncQuestionSet,
        getLevel: function () { return state.level; }
    };
})();
