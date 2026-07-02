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

    const state = {
        bank: null,           // { levels: {1:[...],2:[...],3:[...]} }
        bankLoaded: false,
        level: '1',
        isPlaying: false,
        round: 0,
        score: 0,
        combo: 0,
        maxCombo: 0,
        correctCount: 0,
        roundClosing: false,
        currentQ: null        // { char, pinyin, emoji, example, answer, opts, mode }
    };
    let containerIdArg = 'hanzi-container';   // 由 renderUI 设置，chooseLevel 刷新大厅时复用

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

    async function _loadBank() {
        if (state.bankLoaded) return state.bank;
        try {
            const resp = await fetch(CONFIG.QUESTIONS_URL);
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
                const r2 = await fetch(CONFIG.HSK_URL);
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

    // 取一道题：在所选 level 桶里随机挑一条，再从它的 modes ∩ IMPL_MODES 里挑一个
    function _genQuestion() {
        const bucket = (state.bank && state.bank.levels && state.bank.levels[state.level]) || [];
        if (!bucket.length) return null;
        const item = _pick(bucket);
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
                            const cnt = (state.bank && state.bank.levels && state.bank.levels[c.lv] || []).length;
                            return `
                            <div class="hz-level-card ${String(state.level) === String(c.lv) ? 'active' : ''}" data-lv="${c.lv}" onclick="HanziGame.chooseLevel('${c.lv}')">
                                <div class="hz-level-num">${c.lv === 'hsk1' ? 'HSK' : 'Lv.' + c.lv}</div>
                                <div class="hz-level-label">${c.tag}</div>
                                <div class="hz-level-sub">${cnt} 题</div>
                            </div>`;
                        }).join('')}
                    </div>
                    <button class="hz-start-btn" onclick="HanziGame.start()">▶ 开始挑战（${CONFIG.TOTAL_ROUNDS} 题）</button>
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
            if (el) el.textContent = `第 ${state.round}/${CONFIG.TOTAL_ROUNDS} 题`;
        },
        _scorePill() {
            const el = document.getElementById('hz-score-pill');
            if (el) el.textContent = `${state.score} 分`;
        },

        _question(q) {
            const card = document.getElementById('hz-card');
            const optsEl = document.getElementById('hz-opts');
            if (!card || !optsEl) return;

            let bodyHtml = '';
            if (q.mode === 'choose-char-by-pinyin') {
                // 看拼音 + emoji，选汉字（不显示汉字大字）
                bodyHtml = `
                    <span class="hz-mode-tag">🔊 看拼音选字</span>
                    <div class="hz-emoji">${q.emoji || ''}</div>
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
                        <div class="hz-emoji">${q.emoji || ''}</div>
                        <div class="hz-pinyin">${q.pinyin}</div>
                        <div class="hz-example" style="color:#94a3b8;font-size:13px;">选出这个拼音对应的汉字</div>`;
                } else {
                    const parts = _parseExample(ex, q.answer);
                    bodyHtml = `
                        <span class="hz-mode-tag">✏️ 例句填空</span>
                        <div class="hz-emoji">${q.emoji || ''}</div>
                        <div class="hz-pinyin">${q.pinyin}</div>
                        <div class="hz-example">${parts.before}<span class="hz-blank">？</span>${parts.after}</div>`;
                }
            }
            card.innerHTML = bodyHtml;
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
            const total = CONFIG.TOTAL_ROUNDS;
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
        state.isPlaying = true;
        state.round = 0;
        state.score = 0;
        state.combo = 0;
        state.maxCombo = 0;
        state.correctCount = 0;
        render._overlay();
        render._scorePill();
        _next();
    }

    function _next() {
        if (state.round >= CONFIG.TOTAL_ROUNDS) { _end(); return; }
        state.round++;
        state.roundClosing = false;
        state.currentQ = _genQuestion();
        if (!state.currentQ) { _end(); return; }
        render._roundPill();
        render._fadeCard(() => {
            render._question(state.currentQ);
        });
    }

    function _answer(btnEl, selected) {
        if (!state.isPlaying || state.roundClosing) return;
        state.roundClosing = true;
        render._disableOpts();
        const q = state.currentQ;
        const ok = selected === q.answer;
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

    function _end() {
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
        // 入榜
        if (window.Leaderboard && typeof window.Leaderboard.record === 'function') {
            window.Leaderboard.record('hanzi', state.score, {
                correct: state.correctCount,
                total: CONFIG.TOTAL_ROUNDS
            });
        }
        render._result();
    }

    function _exit() {
        state.isPlaying = false;
        render._hideOverlay();
        if (typeof window.switchPage === 'function') switchPage('leaderboard');
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
        init: init
    };
})();
