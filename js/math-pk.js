/**
 * math-pk.js - 数学 PK 竞技台（人机对战）
 *
 * 全屏竞技台：左=人类选手，右=机器人选手，同题竞速。
 * 每轮同一题，机器人有「思考倒计时」（按难度），人若在机器人之前答对则人赢该轮；
 * 答错不结束（继续抢答但机器人仍在计时）。共 5 轮，比胜场，人赢获成长积分。
 * 难度从「设置」页读取（petbank_math_difficulty），综合进阶档约 30% 出 CMATH 应用题。
 * 美术：assets/arena/（竞技台背景）+ 当前宠物头像 + 分级机器人对手。
 */
(function() {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ============ 配置与状态 ============
    const CONFIG = {
        TOTAL_ROUNDS: 5,         // 每局轮数
        BASE_SCORE: 10,          // 赢一轮基础分
        WIN_BONUS: 25,           // 赢得整局额外奖励
        WORD_RATIO: 0.3,         // medium_mix 出 CMATH 应用题概率
        STORAGE_KEY_HIGH_SCORE: 'petbank_math_high_score',
        STORAGE_KEY_DIFFICULTY: 'petbank_math_difficulty',
        MUL_TRAINING_UNLOCK_STREAK: 5
    };

    const DIFFICULTY_LABELS = {
        easy20: '加减起步',
        easy100: '加减进阶',
        medium_mul: '乘法启程',
        medium_mix: '综合闯关',
        hard: '乘除挑战'
    };

    const MATH_PK_ROBOT_RIVALS = {
        easy20: { name: '圆圆练习机', image: 'assets/arena/math-rivals/robot-easy20.webp' },
        easy100: { name: '彩键计算机', image: 'assets/arena/math-rivals/robot-easy100.webp' },
        medium_mul: { name: '星阵机器人', image: 'assets/arena/math-rivals/robot-mul.webp' },
        medium_mix: { name: '博士计算机', image: 'assets/arena/math-rivals/robot-mix.webp' },
        hard: { name: '冠军计算机', image: 'assets/arena/math-rivals/robot-hard.webp' }
    };

    const VALID_DIFFICULTIES = Object.keys(DIFFICULTY_LABELS);
    const LEGACY_DIFFICULTY_MAP = {
        easy: 'easy20',
        medium: 'medium_mix',
        hard: 'hard'
    };

    let state = {
        isPlaying: false,
        roundClosing: false,     // 轮次结算等待期，锁输入
        mode: 'robot',
        mathDifficulty: 'easy20',
        currentQuestion: null,
        currentInput: '',
        asyncMatch: null,
        asyncQuestions: null,
        matchStartTs: 0,
        asyncSummary: null,
        // 竞速
        round: 0,
        humanWins: 0,
        robotWins: 0,
        roundStartTs: 0,
        robotThinkMs: 0,
        robotTimer: null,
        roundResolved: false,
        // 计分
        score: 0,
        combo: 0,
        maxCombo: 0,
        correctCount: 0,
        training: {
            active: false,
            streak: 0,
            totalCorrect: 0,
            currentQuestion: null,
            readyForPk: false
        }
    };

    // CMATH 应用题池（data/math-cmath.json，来源 XiaoMi/cmath CC BY 4.0）
    let CMATH_POOL = null;
    let _cmathLoading = false;
    function _ensureCmathPool() {
        if (CMATH_POOL || _cmathLoading) return;
        _cmathLoading = true;
        fetch('data/math-cmath.json')
            .then(r => r.json())
            .then(d => { CMATH_POOL = d.grades || {}; _cmathLoading = false; })
            .catch(() => { _cmathLoading = false; });
    }

    let _lastDiffContainer = null;

    function isAsyncMode() {
        return state.mode === 'async';
    }

    function getRoundTotal() {
        return isAsyncMode() && Array.isArray(state.asyncQuestions) && state.asyncQuestions.length
            ? state.asyncQuestions.length
            : CONFIG.TOTAL_ROUNDS;
    }

    function normalizeDifficulty(diff) {
        const mapped = LEGACY_DIFFICULTY_MAP[diff] || diff;
        return VALID_DIFFICULTIES.includes(mapped) ? mapped : 'easy20';
    }

    function getMathPkPlayerAvatar() {
        const fallback = 'assets/pets/poses/dog_idle.webp';
        try {
            if (window.PetSystem && typeof window.PetSystem.getCurrentStageImage === 'function') {
                return window.PetSystem.getCurrentStageImage() || fallback;
            }
        } catch (e) {}
        return fallback;
    }

    function getMathPkPlayerName() {
        try {
            if (window.PetSystem && typeof window.PetSystem.getState === 'function' && typeof window.PetSystem.getAllSpecies === 'function') {
                const petState = window.PetSystem.getState();
                const species = window.PetSystem.getAllSpecies().find(item => item.id === petState.species);
                return species && species.name ? species.name : '我的宠物';
            }
        } catch (e) {}
        return '我的宠物';
    }

    function getMathPkRobotRival(diff) {
        return MATH_PK_ROBOT_RIVALS[normalizeDifficulty(diff)] || MATH_PK_ROBOT_RIVALS.easy20;
    }

    // ============ 工具函数 ============
    const utils = {
        getRandomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; },
        _addsub(maxN) {
            const op = Math.random() > 0.5 ? '+' : '-';
            let a, b, answer;
            if (op === '+') {
                a = this.getRandomInt(1, maxN - 1);
                b = this.getRandomInt(1, maxN - a);
                answer = a + b;
            } else {
                a = this.getRandomInt(1, maxN);
                b = this.getRandomInt(0, a);
                answer = a - b;
            }
            return { text: `${a} ${op} ${b}`, answer, op };
        },
        _mul(amin, amax, bmin, bmax) {
            const a = this.getRandomInt(amin, amax);
            const b = this.getRandomInt(bmin, bmax);
            return { text: `${a} × ${b}`, answer: a * b, op: '*' };
        },
        _div() {
            const answer = this.getRandomInt(2, 10);
            const b = this.getRandomInt(2, 10);
            const a = answer * b;
            return { text: `${a} ÷ ${b}`, answer, op: '/' };
        },
        generateQuestion(difficulty) {
            const normalized = normalizeDifficulty(difficulty);
            const r = Math.random();
            if (normalized === 'easy20') return this._addsub(20);
            if (normalized === 'easy100') return this._addsub(100);
            if (normalized === 'medium_mul') return this._mul(2, 6, 2, 9);
            if (normalized === 'medium_mix') return r < 0.35 ? this._mul(2, 9, 2, 9) : this._addsub(100);
            return r < 0.5 ? this._mul(2, 12, 2, 9) : this._div();
        },
        generateMultiplicationTrainingQuestion(streak) {
            const earlySizes = [2, 5, 10];
            const laterSizes = [2, 3, 4, 5, 10];
            const sizes = streak >= 3 ? laterSizes : earlySizes;
            let groups;
            let groupSize;
            let answer;
            do {
                groups = this.getRandomInt(2, streak >= 3 ? 5 : 4);
                groupSize = sizes[this.getRandomInt(0, sizes.length - 1)];
                answer = groups * groupSize;
            } while (answer > 60);
            return {
                text: `${groups} 组，每组 ${groupSize} 个`,
                answer,
                op: '*',
                isMultiplicationTraining: true,
                groups,
                groupSize,
                repeatedAddition: Array(groups).fill(groupSize).join(' + '),
                multiplication: `${groups} × ${groupSize}`
            };
        },
        generateWordQuestion(difficulty) {
            const normalized = normalizeDifficulty(difficulty);
            const grade = normalized === 'easy20' || normalized === 'easy100' ? '1' : '2';
            const arr = (CMATH_POOL && CMATH_POOL[grade]) || [];
            if (arr.length === 0) return null;
            const item = arr[this.getRandomInt(0, arr.length - 1)];
            return { text: item.q, answer: item.a, isWord: true };
        }
    };

    // ============ UI 渲染 ============
    const render = {
        // 全屏竞技台外壳 + 起始大厅
        createContainer(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return null;
            _ensureCmathPool();
            const playerAvatar = getMathPkPlayerAvatar();
            const playerName = escapeHtml(getMathPkPlayerName());
            const robotRival = getMathPkRobotRival(state.mathDifficulty);
            const robotName = escapeHtml(robotRival.name);
            container.innerHTML = `
                <div class="math-arena" id="math-arena">
                    <style>
                        .math-arena { position:fixed; inset:0; z-index:1000; color:#fff; font-family:inherit; overflow:hidden;
                            background:#0f1419 url('assets/arena/arena-bg.webp') center/cover no-repeat; display:flex; flex-direction:column; }
                        .math-arena::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(8,12,22,.5), rgba(8,12,22,.78)); }
                        .arena-topbar { position:relative; z-index:3; display:flex; justify-content:space-between; align-items:center; padding:14px 22px; gap:10px; }
                        .arena-pill { background:rgba(255,255,255,.13); backdrop-filter:blur(8px); padding:8px 16px; border-radius:999px; font-weight:700; font-size:14px; white-space:nowrap; }
                        .arena-score { font-size:20px; letter-spacing:3px; }
                        .arena-score b { color:#ffd166; font-size:24px; }
                        .arena-exit { background:rgba(255,255,255,.13); border:none; color:#fff; width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:18px; }
                        .arena-exit:hover { background:rgba(255,255,255,.24); }
                        .arena-stage { position:relative; z-index:2; flex:1; display:grid; grid-template-columns:1fr 1.15fr 1fr; grid-template-areas:'human center robot'; gap:10px; padding:4px 20px 18px; min-height:0; }
                        .arena-side { grid-area:auto; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; transition:filter .3s; isolation:isolate; }
                        .arena-side.human { grid-area:human; }
                        .arena-side.robot { grid-area:robot; }
                        .arena-side::before { content:''; position:absolute; width:min(82%, 330px); height:260px; top:50%; transform:translateY(-58%); background:url('assets/arena/math-pk-left-glow.webp') center/contain no-repeat; opacity:.94; z-index:0; pointer-events:none; }
                        .arena-side.robot::before { background-image:url('assets/arena/math-pk-right-glow.webp'); }
                        .arena-avatar { position:relative; z-index:2; width:200px; height:200px; object-fit:contain; filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); transition:filter .3s; }
                        .arena-side.dim .arena-avatar { filter:grayscale(.7) brightness(.55); }
                        .arena-side.win .arena-avatar { filter:drop-shadow(0 0 20px rgba(110,231,183,.95)); }
                        .arena-name { position:relative; z-index:3; font-size:18px; font-weight:800; text-shadow:0 2px 6px rgba(0,0,0,.5); }
                        .arena-status { position:relative; z-index:3; font-size:13px; background:rgba(255,255,255,.15); padding:5px 14px; border-radius:999px; min-height:26px; display:flex; align-items:center; }
                        .arena-time { position:relative; z-index:3; font-size:13px; color:#ffd166; font-weight:700; min-height:18px; }
                        .arena-thinkbar { width:130px; height:9px; background:rgba(255,255,255,.2); border-radius:999px; overflow:hidden; }
                        .arena-thinkbar > i { display:block; height:100%; width:100%; background:linear-gradient(90deg,#6ee7b7,#22d3ee); }
                        .arena-center { grid-area:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:14px; }
                        .arena-qtag { font-size:.72rem; background:rgba(255,255,255,.22); padding:3px 12px; border-radius:999px; }
                        .arena-question { font-size:3.2rem; font-weight:900; text-shadow:0 3px 12px rgba(0,0,0,.65); text-align:center; line-height:1.1; }
                        .arena-question.word { font-size:1.15rem; font-weight:600; line-height:1.6; max-width:92%; text-shadow:0 2px 6px rgba(0,0,0,.7); }
                        .arena-display { background:rgba(15,20,29,.85); color:#6ee7b7; font-family:'Noto Sans SC',monospace; font-size:2rem; font-weight:800; padding:10px 22px; border-radius:14px; min-width:170px; text-align:right; letter-spacing:3px; }
                        .arena-display.empty { color:rgba(255,255,255,.45); font-size:1rem; letter-spacing:0; font-weight:600; }
                        .arena-display.shake { animation:arena-shake .35s ease; }
                        .arena-keypad { display:grid; grid-template-columns:repeat(3,62px); gap:8px; }
                        .arena-key { width:62px; height:54px; font-size:1.35rem; font-weight:800; color:#fff; background:rgba(255,255,255,.15); border:1px solid rgba(255,255,255,.22); border-radius:13px; cursor:pointer; transition:transform .08s, background .15s; user-select:none; }
                        .arena-key:hover { background:rgba(255,255,255,.26); }
                        .arena-key:active { transform:scale(.92); }
                        .arena-key.clear { background:rgba(239,68,68,.28); }
                        .arena-key.confirm { background:var(--sage-green,#7BAE8F); border-color:transparent; font-size:1rem; }
                        .arena-vs { position:absolute; left:50%; top:40%; transform:translate(-50%,-50%); font-size:2.4rem; font-weight:900; color:rgba(255,255,255,.18); z-index:1; pointer-events:none; }
                        .arena-toast { position:absolute; left:50%; top:46%; transform:translate(-50%,-50%); z-index:6; font-size:1.5rem; font-weight:900; padding:16px 38px; border-radius:18px; text-align:center; box-shadow:0 12px 40px rgba(0,0,0,.5); display:none; }
                        .arena-toast.show { display:block; animation:arena-pop .3s ease; }
                        .arena-toast small { display:block; font-size:.85rem; font-weight:600; opacity:.9; margin-top:4px; }
                        .arena-toast.win { background:linear-gradient(135deg,#10b981,#22d3ee); }
                        .arena-toast.lose { background:linear-gradient(135deg,#ef4444,#f59e0b); }
                        .arena-lobby { text-align:center; }
                        .arena-lobby h2 { font-size:2.6rem; font-weight:900; text-shadow:0 4px 14px rgba(0,0,0,.6); margin-bottom:6px; }
                        .arena-lobby p { color:rgba(255,255,255,.82); margin-bottom:4px; }
                        .arena-btn { margin-top:14px; padding:15px 44px; font-size:1.25rem; font-weight:800; border:none; border-radius:999px; background:linear-gradient(135deg,var(--gold,#d4b96a),var(--sage-green,#7BAE8F)); color:#fff; cursor:pointer; box-shadow:0 10px 28px rgba(0,0,0,.35); transition:transform .1s; }
                        .arena-btn:hover { transform:translateY(-2px); }
                        .mul-mode-switch { display:inline-grid; grid-template-columns:1fr 1fr; gap:6px; padding:5px; border-radius:999px; background:rgba(255,255,255,.12); margin:12px 0 4px; }
                        .mul-mode-switch button { border:0; border-radius:999px; padding:9px 18px; color:#fff; background:transparent; font-weight:800; cursor:pointer; }
                        .mul-mode-switch button.active { background:rgba(255,255,255,.24); }
                        .math-array { display:grid; gap:7px; padding:14px 18px; border-radius:16px; background:rgba(255,255,255,.12); }
                        .math-array-row { display:flex; justify-content:center; gap:7px; }
                        .math-array-dot { width:18px; height:18px; border-radius:50%; background:#ffd166; box-shadow:0 2px 8px rgba(0,0,0,.25); transition:transform .18s ease, box-shadow .18s ease, background .18s ease; }
                        .mul-explain { display:grid; gap:6px; text-align:center; font-weight:800; }
                        .mul-explain span { padding:6px 12px; border-radius:999px; background:rgba(15,20,29,.72); }
                        .mul-feedback { max-width:420px; line-height:1.6; color:rgba(255,255,255,.9); }
                        .mul-streak-meter { display:flex; justify-content:center; gap:6px; margin:2px 0 4px; }
                        .mul-streak-cell { width:28px; height:8px; border-radius:999px; background:rgba(255,255,255,.18); overflow:hidden; }
                        .mul-streak-cell.active { background:linear-gradient(90deg,#6ee7b7,#ffd166); box-shadow:0 0 12px rgba(255,209,102,.38); }
                        .math-array-row.fx-reveal { animation:math-row-reveal .32s ease both; animation-delay:calc(var(--row-index, 0) * 70ms); }
                        .math-array.correct .math-array-dot { animation:math-correct-spark .55s ease both; }
                        .math-answer-correct { animation:math-answer-pop .42s ease both; }
                        .math-answer-wrong { animation:arena-shake .35s ease; }
                        .math-fx-burst { position:absolute; pointer-events:none; width:120px; height:120px; border-radius:50%; background:radial-gradient(circle,rgba(255,209,102,.8),rgba(110,231,183,.25) 42%,transparent 70%); animation:math-fx-burst .7s ease forwards; }
                        @keyframes arena-pop { 0%{transform:translate(-50%,-50%) scale(.6);opacity:0;} 100%{transform:translate(-50%,-50%) scale(1);opacity:1;} }
                        @keyframes arena-shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-7px);} 75%{transform:translateX(7px);} }
                        @keyframes math-row-reveal { from{ transform:translateY(8px); opacity:0; } to{ transform:translateY(0); opacity:1; } }
                        @keyframes math-correct-spark { 0%{ transform:scale(1); } 45%{ transform:scale(1.18); box-shadow:0 0 16px rgba(255,209,102,.75); } 100%{ transform:scale(1); } }
                        @keyframes math-answer-pop { 0%{ transform:scale(.92); opacity:.7; } 100%{ transform:scale(1); opacity:1; } }
                        @keyframes math-fx-burst { from{ transform:scale(.45); opacity:.9; } to{ transform:scale(1.3); opacity:0; } }
                        @media (prefers-reduced-motion: reduce) {
                            .math-array-row.fx-reveal,
                            .math-array.correct .math-array-dot,
                            .math-answer-correct,
                            .math-answer-wrong,
                            .math-fx-burst { animation:none !important; transition:none !important; }
                        }
                        @media (max-width:760px){
                            .arena-stage { grid-template-columns:1fr 1fr; grid-template-areas:'human robot' 'center center'; }
                            .arena-avatar { width:120px; height:120px; }
                            .arena-side::before { width:170px; height:145px; transform:translateY(-62%); }
                            .arena-name { font-size:14px; } .arena-status { font-size:11px; }
                            .arena-thinkbar { width:90px; }
                            .arena-question { font-size:2.4rem; } .arena-question.word { font-size:1rem; }
                            .arena-keypad { grid-template-columns:repeat(3,54px); gap:6px; }
                            .arena-key { width:54px; height:48px; font-size:1.15rem; }
                            .arena-lobby h2 { font-size:1.8rem; }
                        }
                    </style>
                    <div class="arena-topbar">
                        <span class="arena-pill" id="arena-round-pill">数学 PK 竞技台</span>
                        <span class="arena-pill arena-score" id="arena-score-pill">宠物 <b id="arena-human-score">0</b> : <b id="arena-robot-score">0</b> 机器人</span>
                        <button class="arena-exit" title="退出" onclick="MathPKGame._exit()">✕</button>
                    </div>
                    <div class="arena-stage">
                        <div class="arena-side human" id="arena-side-human">
                            <img class="arena-avatar pet-avatar" id="arena-human-avatar" src="${escapeHtml(playerAvatar)}" alt="${playerName}" onerror="this.src='assets/pets/poses/dog_idle.webp'">
                            <div class="arena-name" id="arena-human-name">${playerName}</div>
                            <div class="arena-status" id="arena-human-status">准备就绪</div>
                            <div class="arena-time" id="arena-human-time"></div>
                        </div>
                        <div class="arena-center" id="arena-center"></div>
                        <div class="arena-side robot" id="arena-side-robot">
                            <img class="arena-avatar robot-avatar" id="arena-robot-avatar" src="${escapeHtml(robotRival.image)}" alt="${robotName}">
                            <div class="arena-name" id="arena-robot-name">${robotName}</div>
                            <div class="arena-status" id="arena-robot-status">准备就绪</div>
                            <div class="arena-time" id="arena-robot-time"></div>
                            <div class="arena-thinkbar" id="arena-robot-bar" style="display:none;"><i></i></div>
                        </div>
                        <div class="arena-vs">VS</div>
                        <div class="arena-toast" id="arena-toast"></div>
                    </div>
                </div>
            `;
            this._lobby();
            return container;
        },

        // 起始大厅
        _lobby() {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const high = localStorage.getItem(CONFIG.STORAGE_KEY_HIGH_SCORE) || 0;
            const difficultyLabel = DIFFICULTY_LABELS[normalizeDifficulty(state.mathDifficulty)] || '加减起步';
            if (normalizeDifficulty(state.mathDifficulty) === 'medium_mul') {
                this._multiplicationLobby();
                return;
            }
            center.innerHTML = `
                <div class="arena-lobby">
                    <h2>🔢 数学 PK 竞技台</h2>
                    <p>和机器人同题竞速，${CONFIG.TOTAL_ROUNDS} 局定胜负！</p>
                    <p>当前难度：<b style="color:#ffd166;">${difficultyLabel}</b>（在「设置」中修改）</p>
                    <button class="arena-btn" onclick="MathPKGame.start()">开始对战</button>
                    <div id="mathpk-async-root" style="margin-top:14px;"></div>
                    <p style="margin-top:14px;font-size:.8rem;opacity:.7;">历史最高分：${high}</p>
                </div>
            `;
            if (window.PKService && typeof window.PKService.renderBanner === 'function') {
                window.PKService.renderBanner('mathpk');
                if (typeof window.PKService.refresh === 'function') {
                    void window.PKService.refresh();
                }
            }
            // 大厅态：隐藏机器人思考条、重置双方状态
            const bar = document.getElementById('arena-robot-bar'); if (bar) bar.style.display = 'none';
            this._setSide('human', { status: '准备就绪', time: '' });
            this._setSide('robot', { status: '准备就绪', time: '' });
            this._setSideClass('human', ''); this._setSideClass('robot', '');
        },

        _multiplicationLobby() {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const high = localStorage.getItem(CONFIG.STORAGE_KEY_HIGH_SCORE) || 0;
            center.innerHTML = `
                <div class="arena-lobby">
                    <h2>乘法启程</h2>
                    <p>先看懂“几组几个”，再挑战机器人。</p>
                    <div class="mul-mode-switch" aria-label="乘法启程模式">
                        <button class="active" type="button" onclick="MathPKGame.startTraining()">练习场</button>
                        <button type="button" onclick="MathPKGame.start()">PK</button>
                    </div>
                    <button class="arena-btn" onclick="MathPKGame.startTraining()">开始练习</button>
                    <button class="arena-btn" style="margin-top:10px;background:rgba(255,255,255,.18);" onclick="MathPKGame.start()">开始对战</button>
                    <p style="margin-top:14px;font-size:.8rem;opacity:.7;">历史最高分：${high}</p>
                </div>
            `;
            const bar = document.getElementById('arena-robot-bar');
            if (bar) bar.style.display = 'none';
            this._setSide('human', { status: '准备练习', time: '' });
            this._setSide('robot', { status: '等你准备好再 PK', time: '' });
            this._setSideClass('human', '');
            this._setSideClass('robot', '');
        },

        // 对战中：题面 + 显示屏 + 键盘
        match(question) {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const isWord = !!question.isWord;
            const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
                `<button class="arena-key" onclick="MathPKGame._inputDigit(${d})">${d}</button>`).join('');
            center.innerHTML = `
                ${isWord ? '<div class="arena-qtag">📝 应用题</div>' : ''}
                <div class="arena-question ${isWord ? 'word' : ''}">${question.text}${isWord ? '' : ' ='}</div>
                <div class="arena-display empty" id="arena-display">输入答案</div>
                <div class="arena-keypad">
                    ${keys}
                    <button class="arena-key clear" onclick="MathPKGame._clearInput()">⌫ 清除</button>
                    <button class="arena-key" onclick="MathPKGame._inputDigit(0)">0</button>
                    <button class="arena-key confirm" onclick="MathPKGame._submitAnswer()">✓ 确认</button>
                </div>
            `;
            // 双方进入思考态
            this._setSide('human', { status: '思考中…', time: '' });
            this._setSide('robot', { status: '思考中…', time: '' });
            this._setSideClass('human', ''); this._setSideClass('robot', '');
        },

        _streakMeter() {
            const total = CONFIG.MUL_TRAINING_UNLOCK_STREAK;
            const active = Math.min(state.training.streak, total);
            return `
                <div class="mul-streak-meter" aria-label="连对 ${active}/${total}">
                    ${Array(total).fill(0).map((_, index) => `<i class="mul-streak-cell ${index < active ? 'active' : ''}"></i>`).join('')}
                </div>
            `;
        },

        trainingMatch(question) {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const rows = Array(question.groups).fill(0).map((_, index) => `
                <div class="math-array-row fx-reveal" style="--row-index:${index};">
                    ${Array(question.groupSize).fill(0).map(() => '<i class="math-array-dot"></i>').join('')}
                </div>
            `).join('');
            const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
                `<button class="arena-key" onclick="MathPKGame._inputDigit(${d})">${d}</button>`).join('');
            center.innerHTML = `
                ${this._streakMeter()}
                <div class="arena-qtag">练习场</div>
                <div class="arena-question word">${question.text}，一共有几个？</div>
                <div class="math-array">${rows}</div>
                <div class="mul-explain">
                    <span>${question.repeatedAddition} = ?</span>
                    <span>${question.multiplication} = ?</span>
                </div>
                <div class="arena-display empty" id="arena-display">输入答案</div>
                <div class="arena-keypad">
                    ${keys}
                    <button class="arena-key clear" onclick="MathPKGame._clearInput()">⌫ 清除</button>
                    <button class="arena-key" onclick="MathPKGame._inputDigit(0)">0</button>
                    <button class="arena-key confirm" onclick="MathPKGame._submitAnswer()">✓ 确认</button>
                </div>
                <div class="mul-feedback" id="mul-feedback"></div>
            `;
            this._setSide('human', { status: `连对 ${state.training.streak}`, time: '' });
            this._setSide('robot', { status: '练会再挑战', time: '' });
        },

        _multiplicationReady() {
            const center = document.getElementById('arena-center');
            if (!center) return;
            center.innerHTML = `
                <div class="arena-lobby">
                    <h2>可以挑战了</h2>
                    <p>你已经连续看懂 ${CONFIG.MUL_TRAINING_UNLOCK_STREAK} 道“几组几个”。</p>
                    <button class="arena-btn" onclick="MathPKGame.start()">挑战机器人</button>
                    <button class="arena-btn" style="margin-top:10px;background:rgba(255,255,255,.18);" onclick="MathPKGame.startTraining()">继续练习</button>
                </div>
            `;
            this._setSide('human', { status: '准备挑战', time: '' });
            this._setSide('robot', { status: '机器人上线', time: '' });
        },

        _setSide(who, opts) {
            const s = document.getElementById(`arena-${who}-status`);
            const t = document.getElementById(`arena-${who}-time`);
            if (s && opts.status !== undefined) s.textContent = opts.status;
            if (t && opts.time !== undefined) t.textContent = opts.time || '';
        },
        _setSideClass(who, cls) {
            const el = document.getElementById(`arena-side-${who}`);
            if (!el) return;
            el.classList.remove('win', 'dim');
            if (cls) el.classList.add(cls);
        },
        _setScore() {
            const pill = document.getElementById('arena-score-pill');
            if (isAsyncMode()) {
                if (pill) pill.innerHTML = `好友异步挑战 · <b id="arena-human-score">${state.score}</b> 分`;
                return;
            }
            const h = document.getElementById('arena-human-score');
            const r = document.getElementById('arena-robot-score');
            if (h) h.textContent = state.humanWins;
            if (r) r.textContent = state.robotWins;
        },
        _setRoundPill(text) {
            const el = document.getElementById('arena-round-pill');
            if (el) el.textContent = text;
        },

        // 机器人思考条：100% → 0%（robotThinkMs 线性）
        startRobotBar() {
            const wrap = document.getElementById('arena-robot-bar');
            if (!wrap) return;
            wrap.style.display = '';
            const bar = wrap.querySelector('i');
            bar.style.transition = 'none';
            bar.style.width = '100%';
            void bar.offsetWidth; // 强制回流
            bar.style.transition = `width ${state.robotThinkMs}ms linear`;
            bar.style.width = '0%';
        },

        toast(html, type) {
            const el = document.getElementById('arena-toast');
            if (!el) return;
            el.className = `arena-toast show ${type}`;
            el.innerHTML = html;
        },
        hideToast() {
            const el = document.getElementById('arena-toast');
            if (el) el.classList.remove('show');
        },

        // 结算（覆盖中央）
        result(data) {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const bar = document.getElementById('arena-robot-bar'); if (bar) bar.style.display = 'none';
            if (data.mode === 'async') {
                center.innerHTML = `
                    <div class="arena-lobby">
                        <h2 style="font-size:2rem;">${escapeHtml(data.title || '好友异步挑战完成')}</h2>
                        <p style="font-size:1.1rem;">你的得分 <b style="color:#ffd166;">${data.score}</b></p>
                        <p style="opacity:.8;">答对 ${data.correctCount}/${data.total}</p>
                        <p style="margin-top:8px;opacity:.92;">${escapeHtml(data.note || '成绩已提交。')}</p>
                        <button class="arena-btn" onclick="MathPKGame.renderUI('math-pk-container')">返回大厅</button>
                    </div>
                `;
                return;
            }
            const win = data.humanWins > data.robotWins;
            center.innerHTML = `
                <div class="arena-lobby">
                    <h2 style="font-size:2rem;">${win ? '🏆 你赢了！' : (data.humanWins === data.robotWins ? '🤝 平局！' : '🤖 机器人赢了')}</h2>
                    <p style="font-size:1.1rem;">比分 你 <b style="color:#ffd166;">${data.humanWins}</b> : <b style="color:#ffd166;">${data.robotWins}</b> 机器人</p>
                    <p style="font-size:2.2rem;font-weight:900;color:#ffd166;margin-top:8px;">+${data.earnedPoints}</p>
                    <p style="opacity:.8;">获得成长积分</p>
                    <p style="margin-top:6px;opacity:.75;font-size:.85rem;">答对 ${data.correctCount}/${data.total} · 最高连击 ${data.maxCombo}</p>
                    <button class="arena-btn" onclick="MathPKGame.start()">再来一局</button>
                    <button class="arena-btn" style="margin-top:10px;background:rgba(255,255,255,.18);" onclick="MathPKGame.renderUI('math-pk-container')">返回大厅</button>
                </div>
            `;
            this._setSideClass(win ? 'human' : 'robot', 'win');
            this._setSideClass(win ? 'robot' : 'human', 'dim');
        },

        // 设置页：难度选择器
        renderDifficultySetting(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            _lastDiffContainer = containerId;
            const cur = normalizeDifficulty(state.mathDifficulty);
            const opts = [
                { id: 'easy20', label: '加减起步', desc: '20 以内加减' },
                { id: 'easy100', label: '加减进阶', desc: '100 以内加减' },
                { id: 'medium_mul', label: '乘法启程', desc: '基础乘法练习' },
                { id: 'medium_mix', label: '综合闯关', desc: '加减乘 + 应用题' },
                { id: 'hard', label: '乘除挑战', desc: '乘除（机器人更快）' }
            ];
            container.innerHTML = `
                <div class="card" style="margin-top:16px;">
                    <div class="card-header"><h3 class="text-sm font-bold">🔢 数学 PK 难度</h3></div>
                    <div class="card-body">
                        <p class="text-xs text-muted" style="margin-bottom:12px;">数学 PK 竞技台每局 ${CONFIG.TOTAL_ROUNDS} 轮，在此选择出题难度（也影响机器人速度）。</p>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;">
                            ${opts.map(o => `
                                <button data-diff="${o.id}" onclick="MathPKGame._setDifficulty('${o.id}')"
                                    style="padding:14px 10px;border-radius:14px;cursor:pointer;text-align:center;border:2px solid ${cur === o.id ? 'transparent' : '#e5e7eb'};background:${cur === o.id ? 'var(--sage-green, #7BAE8F)' : '#f7f9f8'};color:${cur === o.id ? '#fff' : '#3f5e4a'};transition:all 0.15s;">
                                    <div style="font-weight:700;font-size:15px;">${o.label}</div>
                                    <div style="font-size:11px;margin-top:4px;opacity:0.85;">${o.desc}</div>
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>
            `;
        }
    };

    // ============ 核心逻辑 ============
    const Game = {
        init() {
            state.mathDifficulty = normalizeDifficulty(localStorage.getItem(CONFIG.STORAGE_KEY_DIFFICULTY) || state.mathDifficulty);
        },

        _setDifficulty(diff) {
            const normalized = normalizeDifficulty(diff);
            if (!VALID_DIFFICULTIES.includes(normalized)) return;
            state.mathDifficulty = normalized;
            try { localStorage.setItem(CONFIG.STORAGE_KEY_DIFFICULTY, normalized); } catch (e) {}
            if (_lastDiffContainer) render.renderDifficultySetting(_lastDiffContainer);
        },

        renderUI(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            // 先恢复难度，保证大厅显示正确（createContainer 内 _lobby 会用到）
            state.mathDifficulty = normalizeDifficulty(localStorage.getItem(CONFIG.STORAGE_KEY_DIFFICULTY) || state.mathDifficulty);
            render.createContainer(containerId);
            this.init();
        },

        start() {
            state.isPlaying = true;
            state.roundClosing = false;
            state.mode = 'robot';
            state.asyncMatch = null;
            state.asyncQuestions = null;
            state.asyncSummary = null;
            state.round = 0;
            state.humanWins = 0;
            state.robotWins = 0;
            state.score = 0;
            state.combo = 0;
            state.maxCombo = 0;
            state.correctCount = 0;
            state.training.active = false;
            state.training.currentQuestion = null;
            state.training.readyForPk = false;
            state.matchStartTs = Date.now();
            render._setScore();
            this._nextRound();
        },

        startTraining() {
            state.isPlaying = true;
            state.roundClosing = false;
            state.mode = 'training';
            state.currentInput = '';
            state.training.active = true;
            state.training.streak = 0;
            state.training.totalCorrect = 0;
            state.training.readyForPk = false;
            if (state.robotTimer) clearTimeout(state.robotTimer);
            this._nextTrainingQuestion();
        },

        _nextTrainingQuestion() {
            state.currentInput = '';
            state.roundResolved = false;
            state.roundClosing = false;
            state.currentQuestion = utils.generateMultiplicationTrainingQuestion(state.training.streak);
            state.training.currentQuestion = state.currentQuestion;
            render._setRoundPill(`乘法练习 · 连对 ${state.training.streak} / ${CONFIG.MUL_TRAINING_UNLOCK_STREAK}`);
            render.trainingMatch(state.currentQuestion);
        },

        _submitTrainingAnswer(selected) {
            const correct = selected === state.currentQuestion.answer;
            if (!correct) {
                const explanation = `再看一眼：${state.currentQuestion.multiplication} 是 ${state.currentQuestion.groups} 组 ${state.currentQuestion.groupSize} 个，${state.currentQuestion.repeatedAddition} = ${state.currentQuestion.answer}`;
                state.training.streak = 0;
                state.currentInput = '';
                render.trainingMatch(state.currentQuestion);
                const display = document.getElementById('arena-display');
                if (display) {
                    display.classList.add('math-answer-wrong');
                    setTimeout(() => display.classList.remove('math-answer-wrong'), 360);
                }
                const feedback = document.getElementById('mul-feedback');
                if (feedback) {
                    feedback.innerHTML = explanation;
                }
                render._setSide('human', { status: '看图再试一次', time: '' });
                window.sfx && sfx.error();
                return;
            }
            const array = document.querySelector && document.querySelector('.math-array');
            if (array) array.classList.add('correct');
            const display = document.getElementById('arena-display');
            if (display) display.classList.add('math-answer-correct');
            const center = document.getElementById('arena-center');
            if (center && typeof center.insertAdjacentHTML === 'function') {
                center.insertAdjacentHTML('beforeend', '<span class="math-fx-burst"></span>');
            }
            state.training.streak++;
            state.training.totalCorrect++;
            state.currentInput = '';
            if (state.training.streak >= CONFIG.MUL_TRAINING_UNLOCK_STREAK) {
                state.training.readyForPk = true;
                render.toast(`已经连对 ${state.training.streak} 题<small>要不要挑战机器人？</small>`, 'win');
                setTimeout(() => {
                    render.hideToast();
                    render._multiplicationReady();
                }, 900);
                return;
            }
            render.toast(`答对了！<small>${state.currentQuestion.repeatedAddition} = ${state.currentQuestion.answer}</small>`, 'win');
            setTimeout(() => {
                render.hideToast();
                this._nextTrainingQuestion();
            }, 900);
        },

        startAsyncMatch(match) {
            if (!match || !match.questionSetPayload || !Array.isArray(match.questionSetPayload.questions)) return;
            state.isPlaying = true;
            state.roundClosing = false;
            state.mode = 'async';
            state.asyncMatch = match;
            state.asyncQuestions = match.questionSetPayload.questions.slice();
            state.asyncSummary = null;
            state.round = 0;
            state.humanWins = 0;
            state.robotWins = 0;
            state.score = 0;
            state.combo = 0;
            state.maxCombo = 0;
            state.correctCount = 0;
            state.currentInput = '';
            state.training.active = false;
            state.training.currentQuestion = null;
            state.training.readyForPk = false;
            state.matchStartTs = Date.now();
            render._setScore();
            this._nextRound();
        },

        _exit() {
            state.isPlaying = false;
            if (state.robotTimer) clearTimeout(state.robotTimer);
            if (typeof window.switchPage === 'function') switchPage('map');
            else render.renderUI('math-pk-container');
        },

        _genQuestion() {
            const diff = normalizeDifficulty(state.mathDifficulty);
            if (diff === 'medium_mix' && CMATH_POOL && Math.random() < CONFIG.WORD_RATIO) {
                const w = utils.generateWordQuestion(diff);
                if (w) return w;
            }
            return utils.generateQuestion(diff);
        },

        _robotThinkMs(diff) {
            const normalized = normalizeDifficulty(diff);
            if (normalized === 'easy20') return 5200 + Math.floor(Math.random() * 3800);      // 5.2-9.0s
            if (normalized === 'easy100') return 4700 + Math.floor(Math.random() * 3300);     // 4.7-8.0s
            if (normalized === 'medium_mul') return 4000 + Math.floor(Math.random() * 2500);  // 4.0-6.5s
            if (normalized === 'medium_mix') return 3500 + Math.floor(Math.random() * 2500);  // 3.5-6.0s
            return 2800 + Math.floor(Math.random() * 1700);                                     // 2.8-4.5s
        },

        _nextRound() {
            if (state.round >= getRoundTotal()) { void this._endMatch(); return; }
            state.round++;
            state.roundResolved = false;
            state.roundClosing = false;
            state.currentInput = '';
            state.currentQuestion = isAsyncMode()
                ? state.asyncQuestions[state.round - 1]
                : this._genQuestion();
            if (!state.currentQuestion) { void this._endMatch(); return; }
            state.roundStartTs = Date.now();
            render._setRoundPill(`${isAsyncMode() ? '好友异步挑战' : '第'} ${state.round} / ${getRoundTotal()} ${isAsyncMode() ? '题' : '轮'}`);
            render.match(state.currentQuestion);
            render.hideToast();
            if (isAsyncMode()) {
                const bar = document.getElementById('arena-robot-bar');
                if (bar) bar.style.display = 'none';
                render._setSide('human', { status: '你的回合', time: '' });
                render._setSide('robot', { status: '好友稍后作答', time: '' });
                render._setSideClass('human', '');
                render._setSideClass('robot', '');
                return;
            }
            state.robotThinkMs = this._robotThinkMs(state.mathDifficulty);
            render.startRobotBar();
            if (state.robotTimer) clearTimeout(state.robotTimer);
            state.robotTimer = setTimeout(() => this._robotAnswer(), state.robotThinkMs);
        },

        _robotAnswer() {
            if (state.roundResolved) return;
            state.roundResolved = true;
            this._resolveRound('robot');
        },

        _inputDigit(d) {
            if (!state.isPlaying || state.roundClosing || state.roundResolved) return;
            if (state.currentInput.length >= 4) return;
            state.currentInput += String(d);
            this._refreshDisplay();
        },
        _clearInput() {
            if (!state.isPlaying || state.roundClosing || state.roundResolved) return;
            state.currentInput = '';
            this._refreshDisplay();
        },
        _refreshDisplay() {
            const el = document.getElementById('arena-display');
            if (!el) return;
            if (state.currentInput === '') { el.textContent = '输入答案'; el.classList.add('empty'); }
            else { el.textContent = state.currentInput; el.classList.remove('empty'); }
        },

        _submitAnswer() {
            if (!state.isPlaying || state.roundClosing || state.roundResolved) return;
            if (state.currentInput === '') return;
            const selected = parseInt(state.currentInput, 10);
            if (state.mode === 'training') {
                this._submitTrainingAnswer(selected);
                return;
            }
            const correct = selected === state.currentQuestion.answer;
            if (isAsyncMode()) {
                state.roundResolved = true;
                state.roundClosing = true;
                if (correct) {
                    state.correctCount++;
                    state.combo++;
                    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
                    const gain = CONFIG.BASE_SCORE + Math.min(state.combo * 2, 20);
                    state.score += gain;
                    render._setSide('human', { status: '✓ 答对！', time: '' });
                    render._setSide('robot', { status: '好友稍后作答', time: '' });
                    render.toast(`✨ 本题得 ${gain} 分<small>好友也会做同一题</small>`, 'win');
                } else {
                    state.combo = 0;
                    render._setSide('human', { status: '答错了', time: '' });
                    render._setSide('robot', { status: '好友稍后作答', time: '' });
                    render.toast(`✗ 正确答案：${state.currentQuestion.answer}<small>下一题继续加油</small>`, 'lose');
                }
                render._setScore();
                setTimeout(() => {
                    render.hideToast();
                    this._nextRound();
                }, 1200);
                return;
            }
            if (!correct) {
                // 答错：不结束本轮，扣时间继续抢答（机器人仍在计时）
                const disp = document.getElementById('arena-display');
                if (disp) { disp.classList.add('shake'); setTimeout(() => disp.classList.remove('shake'), 350); }
                state.currentInput = '';
                this._refreshDisplay();
                window.sfx && sfx.error();
                return;
            }
            // 答对：人在机器人之前完成 → 人赢本轮
            state.roundResolved = true;
            if (state.robotTimer) clearTimeout(state.robotTimer);
            const humanMs = Date.now() - state.roundStartTs;
            this._resolveRound('human', humanMs);
            window.sfx && sfx.click();
        },

        _resolveRound(winner, humanMs) {
            state.roundClosing = true;
            const robotSec = (state.robotThinkMs / 1000).toFixed(1);
            if (winner === 'human') {
                state.humanWins++;
                state.correctCount++;
                state.combo++;
                if (state.combo > state.maxCombo) state.maxCombo = state.combo;
                state.score += CONFIG.BASE_SCORE + Math.min(state.combo * 2, 20);
                const hs = (humanMs / 1000).toFixed(1);
                render._setSide('human', { status: '✓ 答对！', time: `⚡ ${hs}s` });
                render._setSide('robot', { status: '被抢先了', time: '' });
                render._setSideClass('human', 'win'); render._setSideClass('robot', 'dim');
                render.toast(`⚡ 你赢了！<small>用时 ${hs}s · +${CONFIG.BASE_SCORE + Math.min(state.combo * 2, 20)} 分</small>`, 'win');
            } else {
                state.robotWins++;
                state.combo = 0;
                render._setSide('robot', { status: '✓ 答对！', time: `⚡ ${robotSec}s` });
                render._setSide('human', { status: '慢了一步', time: '' });
                render._setSideClass('robot', 'win'); render._setSideClass('human', 'dim');
                render.toast(`🤖 机器人赢了<small>它用时 ${robotSec}s</small>`, 'lose');
            }
            render._setScore();
            // 停掉机器人思考条动画
            const bar = document.getElementById('arena-robot-bar');
            if (bar) bar.style.display = 'none';

            setTimeout(() => {
                render.hideToast();
                this._nextRound();
            }, 1500);
        },

        async _endMatch() {
            state.isPlaying = false;
            if (state.robotTimer) clearTimeout(state.robotTimer);
            const win = state.humanWins > state.robotWins;
            const earnedPoints = state.score + (win ? CONFIG.WIN_BONUS : 0);

            // 写入成长分主链路
            if (typeof window.addGrowthPoints === 'function') {
                window.addGrowthPoints(earnedPoints);
            } else if (window.totalPoints !== undefined) {
                window.totalPoints = Math.max(0, Number(window.totalPoints || 0) + earnedPoints);
                if (typeof window.saveAppState === 'function') window.saveAppState();
                if (typeof window.updateStats === 'function') window.updateStats();
            }
            // 最高分（旧键，保留向后兼容）
            const currentHigh = Number(localStorage.getItem(CONFIG.STORAGE_KEY_HIGH_SCORE) || 0);
            if (state.score > currentHigh) localStorage.setItem(CONFIG.STORAGE_KEY_HIGH_SCORE, String(state.score));

            // 写入通用排行榜
            if (window.Leaderboard && typeof window.Leaderboard.record === 'function') {
                // best-effort 迁移：首次进入时把旧 high_score 吞入排行榜
                if (window.Leaderboard.getBest('mathpk') === 0 && currentHigh > 0) {
                    window.Leaderboard.record('mathpk', currentHigh, { migrated: true });
                }
                window.Leaderboard.record('mathpk', state.score, {
                    correct: state.correctCount,
                    total: getRoundTotal(),
                    win: win,
                    asyncMatch: isAsyncMode()
                });
            }

            if (isAsyncMode()) {
                let summaryNote = '成绩已提交，等待好友完成同题挑战。';
                try {
                    if (window.PKService && typeof window.PKService.submitAttempt === 'function' && state.asyncMatch) {
                        const submitResult = await window.PKService.submitAttempt(state.asyncMatch.id, {
                            gameType: 'mathpk',
                            score: state.score,
                            correctCount: state.correctCount,
                            total: getRoundTotal(),
                            durationMs: Date.now() - state.matchStartTs,
                            payloadJson: {
                                total: getRoundTotal(),
                                questions: state.asyncQuestions
                            }
                        });
                        summaryNote = submitResult && submitResult.message ? submitResult.message : summaryNote;
                    }
                } catch (error) {
                    summaryNote = error && error.message ? error.message : '成绩提交失败，请稍后重试。';
                }
                render._setRoundPill('好友挑战完成');
                render.result({
                    mode: 'async',
                    title: '好友异步挑战完成',
                    score: state.score,
                    correctCount: state.correctCount,
                    total: getRoundTotal(),
                    note: summaryNote
                });
                return;
            }

            render._setRoundPill(win ? '🏆 胜利' : '对战结束');
            window.sfx && sfx.levelup();
            render.result({
                humanWins: state.humanWins,
                robotWins: state.robotWins,
                earnedPoints,
                correctCount: state.correctCount,
                maxCombo: state.maxCombo,
                total: CONFIG.TOTAL_ROUNDS
            });
        }
    };

    // 暴露给全局
    async function buildAsyncQuestionSet() {
        const diff = normalizeDifficulty(localStorage.getItem(CONFIG.STORAGE_KEY_DIFFICULTY) || state.mathDifficulty);
        const questions = [];
        for (let i = 0; i < CONFIG.TOTAL_ROUNDS; i++) {
            if (diff === 'medium_mix' && CMATH_POOL && Math.random() < CONFIG.WORD_RATIO) {
                const word = utils.generateWordQuestion(diff);
                questions.push(word || utils.generateQuestion(diff));
            } else {
                questions.push(utils.generateQuestion(diff));
            }
        }
        return {
            gameType: 'mathpk',
            difficulty: diff,
            totalRounds: CONFIG.TOTAL_ROUNDS,
            questions: questions
        };
    }

    function describeAsyncQuestionSet(payload) {
        const difficulty = normalizeDifficulty(payload && payload.difficulty ? payload.difficulty : state.mathDifficulty);
        const totalRounds = payload && payload.totalRounds ? payload.totalRounds : CONFIG.TOTAL_ROUNDS;
        const difficultyLabel = DIFFICULTY_LABELS[difficulty] || '加减起步';
        return {
            difficulty: difficulty,
            difficultyLabel: difficultyLabel,
            totalRounds: totalRounds,
            modeLabel: difficultyLabel,
            summaryText: difficultyLabel + ' · ' + totalRounds + ' 题同题挑战'
        };
    }

    window.MathPKGame = {
        start: () => Game.start(),
        startTraining: () => Game.startTraining(),
        renderUI: (id) => Game.renderUI(id),
        _exit: () => Game._exit(),
        _setDifficulty: (d) => Game._setDifficulty(d),
        renderDifficultySetting: (id) => render.renderDifficultySetting(id),
        _inputDigit: (d) => Game._inputDigit(d),
        _clearInput: () => Game._clearInput(),
        _submitAnswer: () => Game._submitAnswer(),
        startAsyncMatch: (match) => Game.startAsyncMatch(match),
        buildAsyncQuestionSet: buildAsyncQuestionSet,
        describeAsyncQuestionSet: describeAsyncQuestionSet,
        getDifficulty: () => normalizeDifficulty(localStorage.getItem(CONFIG.STORAGE_KEY_DIFFICULTY) || state.mathDifficulty)
    };

    // 物理键盘支持（仅对战中）
    document.addEventListener('keydown', (e) => {
        if (!state.isPlaying || state.roundClosing || state.roundResolved) return;
        if (e.key >= '0' && e.key <= '9') Game._inputDigit(parseInt(e.key, 10));
        else if (e.key === 'Backspace') Game._clearInput();
        else if (e.key === 'Enter') Game._submitAnswer();
    });

})();
