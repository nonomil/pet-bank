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
        STORAGE_KEY_SUPPORT_PROGRESS: 'petbank_math_support_progress',
        STORAGE_KEY_SUPPORT_UNLOCKS: 'petbank_math_support_unlocks',
        STORAGE_KEY_SUPPORT_SELECTED: 'petbank_math_support_selected',
        MUL_TRAINING_UNLOCK_STREAK: 5
    };

    const DIFFICULTY_LABELS = {
        easy20: '加减起步',
        easy100: '加减进阶',
        medium_mul: '乘法启程',
        medium_mix: '综合闯关',
        hard: '乘除挑战'
    };

    const DIFFICULTY_OPTIONS = [
        {
            id: 'easy20',
            label: '加减起步',
            desc: '20 以内加减',
            fitFor: '适合刚开始热身',
            reason: '数字小，更容易先看清题目和符号。'
        },
        {
            id: 'easy100',
            label: '加减进阶',
            desc: '100 以内加减',
            fitFor: '适合已经能稳住 20 以内',
            reason: '练进位、退位和更长一点的心算节奏。'
        },
        {
            id: 'medium_mul',
            label: '乘法启程',
            desc: '基础乘法练习',
            fitFor: '适合刚开始理解乘法',
            reason: '先把乘法看成“几组几个”，再慢慢提速。'
        },
        {
            id: 'medium_mix',
            label: '综合闯关',
            desc: '加减乘 + 应用题',
            fitFor: '适合想练切换思路',
            reason: '一局里会遇到不同题型，适合练观察和判断。'
        },
        {
            id: 'hard',
            label: '乘除挑战',
            desc: '乘除（机器人更快）',
            fitFor: '适合已经比较熟练',
            reason: '用更快节奏练稳定度，先保准确再追速度。'
        }
    ];

    const MATH_PK_ROBOT_RIVALS = {
        easy20: { name: '圆圆练习机', image: 'assets/arena/math-rivals/robot-easy20-v5.webp' },
        easy100: { name: '彩键计算机', image: 'assets/arena/math-rivals/robot-easy100-v5.webp' },
        medium_mul: { name: '星阵机器人', image: 'assets/arena/math-rivals/robot-mul-v5.webp' },
        medium_mix: { name: '博士计算机', image: 'assets/arena/math-rivals/robot-mix-v5.webp' },
        hard: { name: '冠军计算机', image: 'assets/arena/math-rivals/robot-hard-v5.webp' }
    };

    const MATH_PK_SUPPORT_CARDS = {
        show_array: {
            id: 'show_array',
            name: '看阵列',
            stages: ['medium_mul'],
            type: 'learning_support',
            timing: 'question_render',
            description: '乘法题自动显示分组图',
            tag: '适合看图'
        },
        slow_robot: {
            id: 'slow_robot',
            name: '慢一点',
            stages: ['medium_mul', 'medium_mix'],
            type: 'learning_support',
            timing: 'robot_think',
            description: '本局机器人每题多思考 2 秒',
            tag: '适合慢慢想',
            effect: { robotThinkMsBonus: 2000 }
        },
        retry_once: {
            id: 'retry_once',
            name: '再试一次',
            stages: ['medium_mul', 'medium_mix'],
            type: 'learning_support',
            timing: 'first_wrong_answer',
            description: '本局第一次答错不扣连对或多给一点思考时间',
            tag: '适合练信心'
        }
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
        robotDeadlineTs: 0,
        robotTimer: null,
        roundResolved: false,
        // 计分
        score: 0,
        combo: 0,
        maxCombo: 0,
        correctCount: 0,
        multiplicationCorrectCount: 0,
        training: {
            active: false,
            streak: 0,
            totalCorrect: 0,
            currentQuestion: null,
            readyForPk: false
        },
        support: {
            selectedCardId: null,
            offeredCardIds: [],
            pendingMode: null,
            retryUsed: false,
            starsEarned: 0
        }
    };

    // CMATH 应用题池（data/math-cmath.json，来源 XiaoMi/cmath CC BY 4.0）
    let CMATH_POOL = null;
    let _cmathLoading = false;
    function _ensureCmathPool() {
        if (CMATH_POOL || _cmathLoading) return;
        _cmathLoading = true;
        fetch(window.resolvePetBankAssetUrl ? window.resolvePetBankAssetUrl('data/math-cmath.json') : 'data/math-cmath.json')
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

    function getDefaultUnlockedSupportCardIds() {
        return ['show_array', 'slow_robot', 'retry_once'];
    }

    function readJsonStorage(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function writeJsonStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {}
    }

    function getUnlockedSupportCardIds() {
        const saved = readJsonStorage(CONFIG.STORAGE_KEY_SUPPORT_UNLOCKS, null);
        if (Array.isArray(saved) && saved.length) return saved.filter((id) => MATH_PK_SUPPORT_CARDS[id]);
        return getDefaultUnlockedSupportCardIds();
    }

    function getSupportProgress() {
        const saved = readJsonStorage(CONFIG.STORAGE_KEY_SUPPORT_PROGRESS, {});
        return {
            medium_mul: Number(saved.medium_mul || 0),
            medium_mix: Number(saved.medium_mix || 0),
            hard: Number(saved.hard || 0)
        };
    }

    function saveSupportProgress(progress) {
        writeJsonStorage(CONFIG.STORAGE_KEY_SUPPORT_PROGRESS, progress);
    }

    function setSelectedSupportCardId(cardId) {
        state.support.selectedCardId = cardId || null;
        try {
            if (cardId) localStorage.setItem(CONFIG.STORAGE_KEY_SUPPORT_SELECTED, cardId);
            else localStorage.removeItem(CONFIG.STORAGE_KEY_SUPPORT_SELECTED);
        } catch (e) {}
    }

    function getSelectedSupportCard() {
        const selectedId = state.support.selectedCardId || localStorage.getItem(CONFIG.STORAGE_KEY_SUPPORT_SELECTED);
        return selectedId && MATH_PK_SUPPORT_CARDS[selectedId] ? MATH_PK_SUPPORT_CARDS[selectedId] : null;
    }

    function isSupportChooserDifficulty(diff) {
        const normalized = normalizeDifficulty(diff);
        return normalized === 'medium_mul' || normalized === 'medium_mix';
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

    function buildGuidedFeedback(summary) {
        const data = summary || {};
        const total = Math.max(1, Number(data.total || CONFIG.TOTAL_ROUNDS || 1));
        const correctCount = Number(data.correctCount || 0);
        const ratio = correctCount / total;
        const difficulty = normalizeDifficulty(data.difficulty || state.mathDifficulty);
        const win = !!data.win;
        const maxCombo = Number(data.maxCombo || 0);

        if (difficulty === 'medium_mul' && ratio < 0.7) {
            return {
                note: '这局最值得练的是把乘法看成“几组几个”。',
                nextStep: '下一局先数有几组，再数每组几个，最后再写乘法。'
            };
        }
        if (correctCount === 0) {
            return {
                note: '这局题目节奏有点快，先把观察顺序找回来。',
                nextStep: '下一局先慢读题，再点答案；也可以换到更适合热身的难度。'
            };
        }
        if (ratio < 0.5) {
            return {
                note: '你已经开始抓到题目了，还需要多一点确认时间。',
                nextStep: '下一局先看符号，再算数字，确定后再出手。'
            };
        }
        if (!win) {
            return {
                note: maxCombo >= 2 ? '你已经能连续答对，说明方法是对的。' : '你答对了一些题，准确度正在变稳。',
                nextStep: '下一局先保准确，再慢慢追速度。'
            };
        }
        return {
            note: maxCombo >= 2 ? '你这局已经打出连续思考节奏。' : '你完成了这一局挑战。',
            nextStep: '下一局可以继续巩固，也可以试试更适合挑战的新难度。'
        };
    }

    function getMathPkPlayerAttackArchetype() {
        const avatar = getMathPkPlayerAvatar();
        const lower = String(avatar || '').toLowerCase();
        if (lower.includes('plant') || lower.includes('pea') || lower.includes('sprout')) return 'hopper';
        if (lower.includes('dragon') || lower.includes('bird') || lower.includes('wing')) return 'spinner';
        if (lower.includes('cat') || lower.includes('fox') || lower.includes('rabbit')) return 'dasher';
        return 'allrounder';
    }

    function getMathPkRobotAttackArchetype(diff) {
        const normalized = normalizeDifficulty(diff);
        if (normalized === 'easy20') return 'hopper';
        if (normalized === 'easy100') return 'dasher';
        if (normalized === 'medium_mul') return 'spinner';
        if (normalized === 'medium_mix') return 'allrounder';
        return 'spinner';
    }

    function playSfx(name) {
        if (window.sfx && typeof window.sfx.play === 'function') {
            window.sfx.play(name);
        }
    }

    function playSfxLater(name, delayMs, guard) {
        setTimeout(() => {
            if (typeof guard === 'function' && !guard()) return;
            playSfx(name);
        }, Math.max(0, Number(delayMs) || 0));
    }

    function playAttackStyleSfx(attackStyle, side) {
        if (attackStyle === 'attack-hop') {
            playSfx('attackHop');
            return;
        }
        if (attackStyle === 'attack-spin') {
            playSfx('attackSpin');
            return;
        }
        playSfx(side === 'robot' ? 'enemyAttack' : 'playerAttack');
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
            if (normalized === 'medium_mul') return r < 0.45 ? this._addsub(20) : this._mul(2, 5, 2, 5);
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
                        .main-content:has(#math-arena) { z-index:6000; }
                        .math-arena { position:fixed; inset:0; z-index:5000; color:#fff; font-family:inherit; overflow:hidden;
                            background:#0f1419 url('assets/arena/arena-bg.webp') center/cover no-repeat; display:flex; flex-direction:column; }
                        .math-arena::before { content:''; position:absolute; inset:0; background:linear-gradient(180deg, rgba(8,12,22,.5), rgba(8,12,22,.78)); }
                        .arena-topbar { position:relative; z-index:3; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; padding:14px 22px; gap:10px; }
                        .arena-pill { background:rgba(255,255,255,.13); backdrop-filter:blur(8px); padding:8px 16px; border-radius:999px; font-weight:700; font-size:14px; white-space:nowrap; }
                        .arena-score { font-size:20px; letter-spacing:3px; }
                        .arena-score b { color:#ffd166; font-size:24px; }
                        .math-pk-hp-track { flex-basis:100%; display:flex; justify-content:center; gap:16px; align-items:center; }
                        .math-pk-hp-side { display:flex; align-items:center; gap:6px; font-size:12px; font-weight:800; color:rgba(255,255,255,.82); }
                        .math-pk-hp-cells { display:flex; gap:4px; }
                        .math-pk-hp-cell { width:24px; height:9px; border-radius:999px; background:rgba(255,255,255,.18); box-shadow:inset 0 0 0 1px rgba(255,255,255,.1); }
                        .math-pk-hp-cell.active.human { background:linear-gradient(90deg,#6ee7b7,#22d3ee); box-shadow:0 0 10px rgba(110,231,183,.45); }
                        .math-pk-hp-cell.active.robot { background:linear-gradient(90deg,#f97316,#facc15); box-shadow:0 0 10px rgba(250,204,21,.42); }
                        .arena-exit { background:rgba(255,255,255,.13); border:none; color:#fff; width:40px; height:40px; border-radius:50%; cursor:pointer; font-size:18px; }
                        .arena-exit:hover { background:rgba(255,255,255,.24); }
                        .arena-stage { position:relative; z-index:2; flex:1; display:grid; grid-template-columns:1fr minmax(250px,.9fr) 1fr; grid-template-areas:'human center robot'; gap:10px; padding:4px 20px 18px; min-height:0; }
                        .arena-side { grid-area:auto; position:relative; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; transition:filter .3s; isolation:isolate; }
                        .arena-side.human { grid-area:human; }
                        .arena-side.robot { grid-area:robot; }
                        .arena-side::before { content:''; position:absolute; width:min(82%, 330px); height:260px; top:50%; transform:translateY(-58%); background:url('assets/arena/math-pk-left-glow.webp') center/contain no-repeat; opacity:.94; z-index:0; pointer-events:none; }
                        .arena-side.robot::before { background-image:url('assets/arena/math-pk-right-glow.webp'); }
                        .arena-avatar { position:relative; z-index:2; width:200px; height:200px; object-fit:contain; filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); transition:filter .3s; }
                        .arena-side.dim .arena-avatar { filter:grayscale(.7) brightness(.55); }
                        .arena-side.win .arena-avatar { filter:drop-shadow(0 0 20px rgba(110,231,183,.95)); }
                        .arena-side.math-pk-caster.math-pk-rush-active.attack-dash.human .arena-avatar { animation:math-pk-rush-dash-human .84s cubic-bezier(.2,.88,.22,1) both; }
                        .arena-side.math-pk-caster.math-pk-rush-active.attack-dash.robot .arena-avatar { animation:math-pk-rush-dash-robot .84s cubic-bezier(.2,.88,.22,1) both; }
                        .arena-side.math-pk-caster.math-pk-rush-active.attack-hop.human .arena-avatar { animation:math-pk-rush-hop-human .9s cubic-bezier(.2,.82,.26,1) both; }
                        .arena-side.math-pk-caster.math-pk-rush-active.attack-hop.robot .arena-avatar { animation:math-pk-rush-hop-robot .9s cubic-bezier(.2,.82,.26,1) both; }
                        .arena-side.math-pk-caster.math-pk-rush-active.attack-spin.human .arena-avatar { animation:math-pk-rush-spin-human .88s cubic-bezier(.2,.88,.22,1) both; }
                        .arena-side.math-pk-caster.math-pk-rush-active.attack-spin.robot .arena-avatar { animation:math-pk-rush-spin-robot .88s cubic-bezier(.2,.88,.22,1) both; }
                        .arena-side.math-pk-target-hit.from-human .arena-avatar { animation:math-pk-target-hit-from-human .62s ease both; }
                        .arena-side.math-pk-target-hit.from-robot .arena-avatar { animation:math-pk-target-hit-from-robot .62s ease both; }
                        .arena-side.math-pk-target-hit::after { content:''; position:absolute; z-index:1; top:43%; width:180px; height:180px; border-radius:50%; background:radial-gradient(circle,rgba(255,255,255,.95) 0 9%,rgba(255,209,102,.82) 10% 28%,rgba(34,211,238,.28) 29% 52%,transparent 64%); animation:math-pk-impact-burst .62s ease-out forwards; pointer-events:none; }
                        .arena-side.math-pk-target-recoil.from-human .arena-avatar { animation:math-pk-target-recoil-from-human .66s ease both; }
                        .arena-side.math-pk-target-recoil.from-robot .arena-avatar { animation:math-pk-target-recoil-from-robot .66s ease both; }
                        .arena-name { position:relative; z-index:3; font-size:18px; font-weight:800; text-shadow:0 2px 6px rgba(0,0,0,.5); }
                        .arena-status { position:relative; z-index:3; font-size:13px; background:rgba(255,255,255,.15); padding:5px 14px; border-radius:999px; min-height:26px; display:flex; align-items:center; }
                        .arena-time { position:relative; z-index:3; font-size:13px; color:#ffd166; font-weight:700; min-height:18px; }
                        .arena-thinkbar { width:130px; height:9px; background:rgba(255,255,255,.2); border-radius:999px; overflow:hidden; }
                        .arena-thinkbar > i { display:block; height:100%; width:100%; background:linear-gradient(90deg,#6ee7b7,#22d3ee); }
                        .arena-center { grid-area:center; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; }
                        .arena-qtag { font-size:.72rem; background:rgba(255,255,255,.13); border:1px solid rgba(255,255,255,.12); padding:3px 12px; border-radius:999px; }
                        .arena-question { font-size:3.2rem; font-weight:900; text-shadow:0 3px 12px rgba(0,0,0,.65); text-align:center; line-height:1.1; }
                        .arena-question.word { font-size:1.15rem; font-weight:600; line-height:1.6; max-width:92%; text-shadow:0 2px 6px rgba(0,0,0,.7); }
                        .arena-display { background:rgba(9,14,22,.58); color:#b9ead6; font-family:'Noto Sans SC',monospace; font-size:1.7rem; font-weight:800; padding:7px 18px; border-radius:12px; min-width:146px; text-align:right; letter-spacing:2px; border:1px solid rgba(255,255,255,.1); box-shadow:0 10px 22px rgba(0,0,0,.22); }
                        .arena-display.empty { color:rgba(255,255,255,.45); font-size:1rem; letter-spacing:0; font-weight:600; }
                        .arena-display.shake { animation:arena-shake .35s ease; }
                        .arena-keypad { display:grid; grid-template-columns:repeat(3,64px); gap:9px; padding:8px; border-radius:16px; background:rgba(7,12,20,.2); border:1px solid rgba(255,255,255,.08); backdrop-filter:blur(6px); }
                        .arena-key { width:64px; height:54px; font-size:1.22rem; font-weight:800; color:rgba(255,255,255,.92); background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.14); border-radius:12px; cursor:pointer; transition:transform .08s, background .15s, border-color .15s; user-select:none; box-shadow:inset 0 1px 0 rgba(255,255,255,.07); }
                        .arena-key:hover { background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.22); }
                        .arena-key:active { transform:scale(.92); }
                        .arena-key.clear { background:rgba(120,72,72,.22); font-size:.92rem; line-height:1.1; }
                        .arena-key.confirm { background:rgba(123,174,143,.7); border-color:rgba(210,236,220,.24); font-size:.92rem; line-height:1.1; }
                        .arena-vs { position:absolute; left:50%; top:40%; transform:translate(-50%,-50%); font-size:2.1rem; font-weight:900; color:rgba(255,255,255,.11); z-index:1; pointer-events:none; }
                        .arena-toast.math-pk-battle-caption { position:absolute; left:50%; top:auto; bottom:18px; transform:translateX(-50%); z-index:6; max-width:min(430px,calc(100% - 32px)); color:#eef7f2; font-size:.9rem; font-weight:800; padding:7px 14px; border-radius:999px; text-align:center; box-shadow:0 8px 20px rgba(0,0,0,.24); display:none; backdrop-filter:blur(8px); border:1px solid rgba(255,255,255,.13); background:rgba(13,20,24,.62); pointer-events:none; }
                        .arena-toast.show { display:block; animation:math-pk-caption-in .24s ease; }
                        .arena-toast small { display:inline; font-size:.78rem; font-weight:650; opacity:.78; margin-left:8px; }
                        .arena-toast.win { background:rgba(20,37,34,.64); border-color:rgba(164,196,184,.22); }
                        .arena-toast.lose { background:rgba(40,31,29,.64); border-color:rgba(210,176,148,.22); }
                        .math-pk-attack-cue { position:absolute; left:50%; top:18%; transform:translate(-50%,-50%); z-index:5; display:none; padding:5px 11px; border-radius:999px; background:rgba(15,20,29,.52); border:1px solid rgba(255,255,255,.14); font-size:.86rem; font-weight:800; box-shadow:0 6px 18px rgba(0,0,0,.22); }
                        .math-pk-attack-cue.show { display:block; animation:arena-pop .26s ease; }
                        .math-pk-rush-trail { position:absolute; top:43%; left:29%; width:156px; height:84px; z-index:4; pointer-events:none; opacity:0; filter:blur(.2px); transform:translate(-50%,-50%); }
                        .math-pk-rush-trail::before { content:''; position:absolute; inset:20px 8px; border-radius:999px; background:linear-gradient(90deg,rgba(211,226,220,0),rgba(196,225,216,.34),rgba(255,255,255,.82)); box-shadow:0 0 16px rgba(194,226,216,.34); }
                        .math-pk-rush-trail::after { content:''; position:absolute; right:0; top:50%; width:58px; height:58px; border-radius:50%; background:radial-gradient(circle,rgba(255,255,255,.82) 0 16%,rgba(255,209,102,.48) 17% 40%,rgba(110,231,183,.18) 41% 62%,transparent 64%); transform:translateY(-50%); }
                        .math-pk-rush-trail.robot { left:71%; }
                        .math-pk-rush-trail.robot::before { background:linear-gradient(270deg,rgba(225,215,178,0),rgba(226,201,138,.34),rgba(255,255,255,.8)); box-shadow:0 0 16px rgba(226,201,138,.34); }
                        .math-pk-rush-trail.robot::after { left:0; right:auto; background:radial-gradient(circle,rgba(255,255,255,.82) 0 16%,rgba(226,201,138,.5) 17% 40%,rgba(210,167,118,.2) 41% 62%,transparent 64%); }
                        .math-pk-rush-trail.attack-dash.human { animation:math-pk-trail-dash-human .66s ease-out forwards; }
                        .math-pk-rush-trail.attack-dash.robot { animation:math-pk-trail-dash-robot .66s ease-out forwards; }
                        .math-pk-rush-trail.attack-hop.human { animation:math-pk-trail-hop-human .74s ease-out forwards; }
                        .math-pk-rush-trail.attack-hop.robot { animation:math-pk-trail-hop-robot .74s ease-out forwards; }
                        .math-pk-rush-trail.attack-spin.human { animation:math-pk-trail-spin-human .72s ease-out forwards; }
                        .math-pk-rush-trail.attack-spin.robot { animation:math-pk-trail-spin-robot .72s ease-out forwards; }
                        .arena-lobby { text-align:center; }
                        .arena-lobby h2 { font-size:2.6rem; font-weight:900; text-shadow:0 4px 14px rgba(0,0,0,.6); margin-bottom:6px; }
                        .arena-lobby p { color:rgba(255,255,255,.82); margin-bottom:4px; }
                        .arena-btn { margin-top:14px; padding:15px 44px; font-size:1.25rem; font-weight:800; border:none; border-radius:999px; background:linear-gradient(135deg,var(--gold,#d4b96a),var(--sage-green,#7BAE8F)); color:#fff; cursor:pointer; box-shadow:0 10px 28px rgba(0,0,0,.35); transition:transform .1s; }
                        .arena-btn:hover { transform:translateY(-2px); }
                        .mathpk-difficulty-panel { width:min(560px,calc(100vw - 44px)); margin:14px auto 0; padding:10px; border-radius:16px; background:rgba(7,12,20,.26); border:1px solid rgba(255,255,255,.1); backdrop-filter:blur(8px); }
                        .mathpk-difficulty-title { display:flex; align-items:center; justify-content:space-between; gap:10px; margin:0 2px 8px; color:rgba(255,255,255,.86); font-size:.82rem; font-weight:800; }
                        .mathpk-difficulty-title small { color:rgba(255,255,255,.58); font-weight:650; }
                        .mathpk-difficulty-grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:7px; }
                        .mathpk-difficulty-option { min-height:92px; padding:8px 6px; border-radius:12px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.09); color:rgba(255,255,255,.84); cursor:pointer; text-align:center; transition:background .15s,border-color .15s,transform .08s; }
                        .mathpk-difficulty-option:hover { background:rgba(255,255,255,.15); border-color:rgba(255,255,255,.2); }
                        .mathpk-difficulty-option:active { transform:scale(.96); }
                        .mathpk-difficulty-option.active { background:rgba(123,174,143,.78); border-color:rgba(226,240,231,.34); color:#fff; }
                        .mathpk-difficulty-option b { display:block; font-size:.86rem; line-height:1.15; }
                        .mathpk-difficulty-option span { display:block; margin-top:4px; font-size:.68rem; line-height:1.15; opacity:.76; }
                        .mathpk-difficulty-option small { display:block; margin-top:5px; font-size:.64rem; line-height:1.18; opacity:.9; font-weight:800; }
                        .mathpk-difficulty-option em { display:block; margin-top:4px; font-size:.6rem; line-height:1.22; opacity:.68; font-style:normal; }
                        .mathpk-result-guide { margin:12px auto 10px; max-width:420px; padding:10px 12px; border-radius:14px; background:rgba(255,255,255,.1); border:1px solid rgba(255,255,255,.14); text-align:left; }
                        .mathpk-result-guide strong { display:block; color:#ffd166; font-size:.82rem; margin-top:4px; }
                        .mathpk-result-guide p { margin:3px 0 6px; line-height:1.5; font-size:.88rem; opacity:.9; }
                        .mul-mode-switch { display:inline-grid; grid-template-columns:1fr 1fr; gap:6px; padding:5px; border-radius:999px; background:rgba(255,255,255,.12); margin:12px 0 4px; }
                        .mul-mode-switch button { border:0; border-radius:999px; padding:9px 18px; color:#fff; background:transparent; font-weight:800; cursor:pointer; }
                        .mul-mode-switch button.active { background:rgba(255,255,255,.24); }
                        .math-pk-support-chooser { width:min(620px,calc(100vw - 36px)); padding:18px; border-radius:20px; background:rgba(9,14,22,.64); border:1px solid rgba(255,255,255,.12); box-shadow:0 18px 48px rgba(0,0,0,.34); backdrop-filter:blur(10px); }
                        .math-pk-support-chooser h3 { margin:0 0 6px; font-size:1.5rem; font-weight:900; }
                        .math-pk-support-chooser p { margin:0; color:rgba(255,255,255,.78); }
                        .math-pk-support-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:14px; }
                        .math-pk-support-card { padding:14px 12px; border-radius:16px; border:1px solid rgba(255,255,255,.12); background:rgba(255,255,255,.08); color:#fff; text-align:left; cursor:pointer; transition:transform .08s, background .15s, border-color .15s; }
                        .math-pk-support-card:hover { background:rgba(255,255,255,.14); border-color:rgba(255,255,255,.24); transform:translateY(-2px); }
                        .math-pk-support-card b { display:block; font-size:1rem; margin-bottom:6px; }
                        .math-pk-support-card span { display:block; font-size:.82rem; line-height:1.45; color:rgba(255,255,255,.82); }
                        .math-pk-support-card i { display:inline-flex; margin-top:10px; padding:4px 10px; border-radius:999px; background:rgba(123,174,143,.26); color:#dff4e5; font-size:.74rem; font-style:normal; font-weight:800; }
                        .math-pk-support-status { display:inline-flex; align-items:center; justify-content:center; gap:6px; max-width:min(420px,96%); margin:0 auto 4px; padding:6px 14px; border-radius:999px; background:rgba(255,255,255,.12); border:1px solid rgba(255,255,255,.1); font-size:.82rem; font-weight:800; color:#f4f8f6; }
                        .math-array { display:grid; gap:7px; padding:14px 18px; border-radius:16px; background:rgba(255,255,255,.12); }
                        .math-array.math-array-compact { gap:4px; padding:10px 12px; background:rgba(255,255,255,.08); }
                        .math-array.math-array-compact .math-array-row { gap:4px; }
                        .math-array.math-array-compact .math-array-dot { width:12px; height:12px; }
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
                        @keyframes math-pk-caption-in { from{ transform:translateX(-50%) translateY(8px); opacity:0; } to{ transform:translateX(-50%) translateY(0); opacity:1; } }
                        @keyframes arena-shake { 0%,100%{transform:translateX(0);} 25%{transform:translateX(-7px);} 75%{transform:translateX(7px);} }
                        @keyframes math-row-reveal { from{ transform:translateY(8px); opacity:0; } to{ transform:translateY(0); opacity:1; } }
                        @keyframes math-correct-spark { 0%{ transform:scale(1); } 45%{ transform:scale(1.18); box-shadow:0 0 16px rgba(255,209,102,.75); } 100%{ transform:scale(1); } }
                        @keyframes math-answer-pop { 0%{ transform:scale(.92); opacity:.7; } 100%{ transform:scale(1); opacity:1; } }
                        @keyframes math-fx-burst { from{ transform:scale(.45); opacity:.9; } to{ transform:scale(1.3); opacity:0; } }
                        @keyframes math-pk-rush-dash-human { 0%{ transform:translateX(0) scale(1); } 24%{ transform:translateX(34px) scale(1.06); } 52%{ transform:translateX(118px) scale(1.14); } 66%{ transform:translateX(136px) scale(1.08); } 100%{ transform:translateX(0) scale(1); } }
                        @keyframes math-pk-rush-dash-robot { 0%{ transform:translateX(0) scale(1); } 24%{ transform:translateX(-34px) scale(1.06); } 52%{ transform:translateX(-118px) scale(1.14); } 66%{ transform:translateX(-136px) scale(1.08); } 100%{ transform:translateX(0) scale(1); } }
                        @keyframes math-pk-rush-hop-human { 0%{ transform:translateX(0) translateY(0) scale(1); } 26%{ transform:translateX(36px) translateY(-10px) scale(1.05); } 58%{ transform:translateX(120px) translateY(-42px) scale(1.12); } 72%{ transform:translateX(136px) translateY(-6px) scale(1.08); } 100%{ transform:translateX(0) translateY(0) scale(1); } }
                        @keyframes math-pk-rush-hop-robot { 0%{ transform:translateX(0) translateY(0) scale(1); } 26%{ transform:translateX(-36px) translateY(-10px) scale(1.05); } 58%{ transform:translateX(-120px) translateY(-42px) scale(1.12); } 72%{ transform:translateX(-136px) translateY(-6px) scale(1.08); } 100%{ transform:translateX(0) translateY(0) scale(1); } }
                        @keyframes math-pk-rush-spin-human { 0%{ transform:translateX(0) rotate(0deg) scale(1); } 24%{ transform:translateX(28px) rotate(-10deg) scale(1.05); } 56%{ transform:translateX(112px) rotate(250deg) scale(1.13); } 70%{ transform:translateX(128px) rotate(320deg) scale(1.08); } 100%{ transform:translateX(0) rotate(360deg) scale(1); } }
                        @keyframes math-pk-rush-spin-robot { 0%{ transform:translateX(0) rotate(0deg) scale(1); } 24%{ transform:translateX(-28px) rotate(10deg) scale(1.05); } 56%{ transform:translateX(-112px) rotate(-250deg) scale(1.13); } 70%{ transform:translateX(-128px) rotate(-320deg) scale(1.08); } 100%{ transform:translateX(0) rotate(-360deg) scale(1); } }
                        @keyframes math-pk-target-hit-from-human { 0%,100%{ transform:translateX(0) rotate(0); filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); } 18%{ transform:translateX(18px) rotate(2deg) scale(1.04); filter:drop-shadow(0 0 24px rgba(255,209,102,.95)); } 36%{ transform:translateX(8px) rotate(1deg); } 56%{ transform:translateX(-8px) rotate(-1deg); } 76%{ transform:translateX(4px) rotate(.5deg); } }
                        @keyframes math-pk-target-hit-from-robot { 0%,100%{ transform:translateX(0) rotate(0); filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); } 18%{ transform:translateX(-18px) rotate(-2deg) scale(1.04); filter:drop-shadow(0 0 24px rgba(255,209,102,.95)); } 36%{ transform:translateX(-8px) rotate(-1deg); } 56%{ transform:translateX(8px) rotate(1deg); } 76%{ transform:translateX(-4px) rotate(-.5deg); } }
                        @keyframes math-pk-target-recoil-from-human { 0%{ transform:translateX(0) scale(1); filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); } 18%{ transform:translateX(24px) scale(1.07); filter:brightness(1.2) drop-shadow(0 0 28px rgba(255,209,102,.95)); } 40%{ transform:translateX(10px) scale(.98); } 100%{ transform:translateX(0) scale(1); filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); } }
                        @keyframes math-pk-target-recoil-from-robot { 0%{ transform:translateX(0) scale(1); filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); } 18%{ transform:translateX(-24px) scale(1.07); filter:brightness(1.2) drop-shadow(0 0 28px rgba(255,209,102,.95)); } 40%{ transform:translateX(-10px) scale(.98); } 100%{ transform:translateX(0) scale(1); filter:drop-shadow(0 8px 16px rgba(0,0,0,.55)); } }
                        @keyframes math-pk-trail-dash-human { 0%{ opacity:0; transform:translate(-50%,-50%) scale(.65); left:30%; } 22%{ opacity:.88; } 100%{ opacity:0; transform:translate(-50%,-50%) scale(1.06); left:62%; } }
                        @keyframes math-pk-trail-dash-robot { 0%{ opacity:0; transform:translate(-50%,-50%) scale(.65); left:70%; } 22%{ opacity:.88; } 100%{ opacity:0; transform:translate(-50%,-50%) scale(1.06); left:38%; } }
                        @keyframes math-pk-trail-hop-human { 0%{ opacity:0; transform:translate(-50%,-50%) scale(.65) translateY(6px); left:30%; } 22%{ opacity:.82; } 100%{ opacity:0; transform:translate(-50%,-50%) scale(1.02) translateY(-14px); left:62%; } }
                        @keyframes math-pk-trail-hop-robot { 0%{ opacity:0; transform:translate(-50%,-50%) scale(.65) translateY(6px); left:70%; } 22%{ opacity:.82; } 100%{ opacity:0; transform:translate(-50%,-50%) scale(1.02) translateY(-14px); left:38%; } }
                        @keyframes math-pk-trail-spin-human { 0%{ opacity:0; transform:translate(-50%,-50%) scale(.62) rotate(-12deg); left:30%; } 22%{ opacity:.86; } 100%{ opacity:0; transform:translate(-50%,-50%) scale(1.08) rotate(18deg); left:60%; } }
                        @keyframes math-pk-trail-spin-robot { 0%{ opacity:0; transform:translate(-50%,-50%) scale(.62) rotate(12deg); left:70%; } 22%{ opacity:.86; } 100%{ opacity:0; transform:translate(-50%,-50%) scale(1.08) rotate(-18deg); left:40%; } }
                        @keyframes math-pk-impact-burst { 0%{ opacity:0; transform:scale(.45); } 32%{ opacity:.82; transform:scale(1.02); } 100%{ opacity:0; transform:scale(1.35); } }
                        @media (prefers-reduced-motion: reduce) {
                            .math-array-row.fx-reveal,
                            .math-array.correct .math-array-dot,
                            .math-answer-correct,
                            .math-answer-wrong,
                            .math-fx-burst,
                            .arena-side.math-pk-caster .arena-avatar,
                            .arena-side.math-pk-target-hit.from-human .arena-avatar,
                            .arena-side.math-pk-target-hit.from-robot .arena-avatar,
                            .arena-side.math-pk-target-recoil.from-human .arena-avatar,
                            .arena-side.math-pk-target-recoil.from-robot .arena-avatar,
                            .arena-side.math-pk-target-hit::after,
                            .math-pk-rush-trail { animation:none !important; transition:none !important; }
                        }
                        @media (max-width:760px){
                            .math-pk-hp-track { gap:8px; }
                            .math-pk-hp-cell { width:16px; }
                            .arena-stage { grid-template-columns:1fr 1fr; grid-template-areas:'human robot' 'center center'; }
                            .arena-avatar { width:120px; height:120px; }
                            .arena-side::before { width:170px; height:145px; transform:translateY(-62%); }
                            .arena-name { font-size:14px; } .arena-status { font-size:11px; }
                            .arena-thinkbar { width:90px; }
                            .arena-question { font-size:2.4rem; } .arena-question.word { font-size:1rem; }
                            .arena-keypad { grid-template-columns:repeat(3,54px); gap:6px; background:rgba(7,12,20,.22); }
                            .arena-key { width:54px; height:48px; font-size:1.15rem; }
                            .arena-lobby h2 { font-size:1.8rem; }
                            .mathpk-difficulty-panel { width:calc(100vw - 24px); padding:8px; }
                            .mathpk-difficulty-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
                            .math-pk-support-grid { grid-template-columns:1fr; }
                        }
                    </style>
                    <div class="arena-topbar">
                        <span class="arena-pill" id="arena-round-pill">数学 PK 竞技台</span>
                        <span class="arena-pill arena-score" id="arena-score-pill">宠物 <b id="arena-human-score">0</b> : <b id="arena-robot-score">0</b> 机器人</span>
                        <button class="arena-exit" title="退出" onclick="MathPKGame._exit()">✕</button>
                        <div class="math-pk-hp-track" id="math-pk-hp-track">${this._hpTrack()}</div>
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
                        <div class="math-pk-attack-cue" id="math-pk-attack-cue"></div>
                        <div class="arena-toast math-pk-battle-caption" id="arena-toast"></div>
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
                    <p>当前难度：<b style="color:#ffd166;">${difficultyLabel}</b></p>
                    ${this._difficultyPanel()}
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
                    ${this._difficultyPanel()}
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

        _difficultyPanel() {
            const cur = normalizeDifficulty(state.mathDifficulty);
            return `
                <div class="mathpk-difficulty-panel" aria-label="数学 PK 难度设置">
                    <div class="mathpk-difficulty-title">
                        <span>难度设置</span>
                        <small>影响题目和机器人速度</small>
                    </div>
                    <div class="mathpk-difficulty-grid">
                        ${DIFFICULTY_OPTIONS.map((option) => `
                            <button type="button" class="mathpk-difficulty-option ${cur === option.id ? 'active' : ''}" onclick="MathPKGame._setDifficulty('${option.id}')">
                                <b>${escapeHtml(option.label)}</b>
                                <span>${escapeHtml(option.desc)}</span>
                                <small>${escapeHtml(option.fitFor || '')}</small>
                                <em>${escapeHtml(option.reason || '')}</em>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        },

        _supportBadge() {
            const card = getSelectedSupportCard();
            if (!card) return '';
            const usedText = card.id === 'retry_once' && state.support.retryUsed ? '已使用' : '';
            return `<div class="math-pk-support-status" id="math-pk-support-status">本局支援：${card.name}${usedText ? ` · ${usedText}` : ''}</div>`;
        },

        _refreshSupportStatus() {
            const el = document.getElementById('math-pk-support-status');
            if (!el) return;
            const card = getSelectedSupportCard();
            if (!card) {
                el.textContent = '';
                return;
            }
            const usedText = card.id === 'retry_once' && state.support.retryUsed ? ' · 已使用' : '';
            el.textContent = `本局支援：${card.name}${usedText}`;
        },

        _renderCompactArray(question) {
            const nums = Game._extractQuestionNumbers(question);
            const groups = Math.max(2, Math.min(5, Number(question.groups || nums[0] || 0)));
            const groupSize = Math.max(2, Math.min(5, Number(question.groupSize || nums[1] || 0)));
            if (!groups || !groupSize) return '';
            return `
                <div class="math-array math-array-compact" aria-label="${groups} 组每组 ${groupSize} 个">
                    ${Array(groups).fill(0).map((_, index) => `
                        <div class="math-array-row" style="--row-index:${index};">
                            ${Array(groupSize).fill(0).map(() => '<i class="math-array-dot"></i>').join('')}
                        </div>
                    `).join('')}
                </div>
            `;
        },

        supportChooser(diff) {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const cards = state.support.offeredCardIds
                .map((cardId) => MATH_PK_SUPPORT_CARDS[cardId])
                .filter(Boolean);
            const nextLabel = state.support.pendingMode === 'training' ? '练习场' : 'PK';
            center.innerHTML = `
                <div class="math-pk-support-chooser">
                    <h3>先选一个支援</h3>
                    <p>${DIFFICULTY_LABELS[normalizeDifficulty(diff)]} · 进入 ${nextLabel} 前，挑一个更适合这局的帮助。</p>
                    <div class="math-pk-support-grid">
                        ${cards.map((card) => `
                            <button type="button" class="math-pk-support-card" onclick="MathPKGame.chooseSupportCardAndStart('${card.id}','${state.support.pendingMode}')">
                                <b>${card.name}</b>
                                <span>${card.description}</span>
                                <i>${card.tag}</i>
                            </button>
                        `).join('')}
                    </div>
                    <button class="arena-btn" style="margin-top:14px;background:rgba(255,255,255,.18);" onclick="MathPKGame.renderUI('math-pk-container')">返回大厅</button>
                </div>
            `;
            this._setSide('human', { status: '挑个帮手再出发', time: '' });
            this._setSide('robot', { status: '机器人正在等你', time: '' });
            this._setSideClass('human', '');
            this._setSideClass('robot', '');
        },

        // 对战中：题面 + 显示屏 + 键盘
        match(question) {
            const center = document.getElementById('arena-center');
            if (!center) return;
            const isWord = !!question.isWord;
            const supportCard = getSelectedSupportCard();
            const showCompactArray = supportCard && supportCard.id === 'show_array' && question && question.op === '*';
            const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(d =>
                `<button class="arena-key" onclick="MathPKGame._inputDigit(${d})">${d}</button>`).join('');
            center.innerHTML = `
                ${this._supportBadge()}
                ${isWord ? '<div class="arena-qtag">📝 应用题</div>' : ''}
                <div class="arena-question ${isWord ? 'word' : ''}">${question.text}${isWord ? '' : ' ='}</div>
                ${showCompactArray ? this._renderCompactArray(question) : ''}
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
                ${this._supportBadge()}
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
            playSfx('duelReady');
            playSfx('spotlightPulse');
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
                this._renderHpTrack();
                return;
            }
            const h = document.getElementById('arena-human-score');
            const r = document.getElementById('arena-robot-score');
            if (h) h.textContent = state.humanWins;
            if (r) r.textContent = state.robotWins;
            this._renderHpTrack();
        },
        _hpTrack() {
            const total = getRoundTotal();
            const side = (label, score, cls) => `
                <div class="math-pk-hp-side ${cls}">
                    <span>${label}</span>
                    <div class="math-pk-hp-cells">
                        ${Array(total).fill(0).map((_, index) => `<i class="math-pk-hp-cell ${cls} ${index < score ? 'active' : ''}"></i>`).join('')}
                    </div>
                </div>
            `;
            return side('宠物', state.humanWins || 0, 'human') + side('机器人', state.robotWins || 0, 'robot');
        },
        _renderHpTrack() {
            const el = document.getElementById('math-pk-hp-track');
            if (!el) return;
            el.innerHTML = isAsyncMode() ? '' : this._hpTrack();
        },
        _attackCue(text, type) {
            const el = document.getElementById('math-pk-attack-cue');
            if (!el) return;
            el.textContent = text;
            el.className = `math-pk-attack-cue show ${type || ''}`;
            setTimeout(() => el.classList.remove('show'), 1100);
        },
        _pickAttackStyle(winner) {
            const stylesByArchetype = {
                hopper: ['attack-hop', 'attack-dash', 'attack-hop', 'attack-spin'],
                spinner: ['attack-spin', 'attack-dash', 'attack-spin', 'attack-hop'],
                dasher: ['attack-dash', 'attack-dash', 'attack-hop', 'attack-spin'],
                allrounder: ['attack-dash', 'attack-hop', 'attack-spin']
            };
            const archetype = winner === 'human'
                ? getMathPkPlayerAttackArchetype()
                : getMathPkRobotAttackArchetype(state.mathDifficulty);
            const styles = stylesByArchetype[archetype] || stylesByArchetype.allrounder;
            const q = state.currentQuestion || {};
            const seed = (state.round || 0) + (q.answer || 0) + (winner === 'human' ? 1 : 2);
            return styles[seed % styles.length];
        },
        _playAttackFx(winner) {
            const caster = winner === 'human' ? 'human' : 'robot';
            const target = winner === 'human' ? 'robot' : 'human';
            const casterEl = document.getElementById(`arena-side-${caster}`);
            const targetEl = document.getElementById(`arena-side-${target}`);
            const stage = document.querySelector('.arena-stage');
            const attackStyle = this._pickAttackStyle(winner);
            const cueText = {
                'attack-dash': '飞扑突击',
                'attack-hop': '腾空一击',
                'attack-spin': '旋风撞击'
            }[attackStyle] || '近战突击';
            [casterEl, targetEl].forEach((el) => {
                if (!el) return;
                el.classList.remove('math-pk-caster', 'math-pk-rush-active', 'math-pk-target-hit', 'math-pk-target-recoil', 'attack-dash', 'attack-hop', 'attack-spin', 'from-human', 'from-robot');
            });
            const oldTrail = stage && stage.querySelector('.math-pk-rush-trail');
            if (oldTrail) oldTrail.remove();
            if (casterEl) {
                void casterEl.offsetWidth;
                casterEl.classList.add('math-pk-caster');
                casterEl.classList.add('math-pk-rush-active');
                casterEl.classList.add(attackStyle);
            }
            this._attackCue(cueText, attackStyle);
            if (stage) {
                const trail = document.createElement('i');
                trail.className = `math-pk-rush-trail ${caster} ${attackStyle}`;
                trail.setAttribute('aria-hidden', 'true');
                stage.appendChild(trail);
                setTimeout(() => trail.remove(), 820);
            }
            setTimeout(() => {
                if (!targetEl) return;
                targetEl.classList.add('math-pk-target-hit');
                targetEl.classList.add('math-pk-target-recoil');
                targetEl.classList.add(attackStyle);
                targetEl.classList.add(caster === 'human' ? 'from-human' : 'from-robot');
            }, 420);
            setTimeout(() => {
                if (casterEl) casterEl.classList.remove('math-pk-caster', 'math-pk-rush-active', 'attack-dash', 'attack-hop', 'attack-spin');
                if (targetEl) targetEl.classList.remove('math-pk-target-hit', 'math-pk-target-recoil', 'attack-dash', 'attack-hop', 'attack-spin', 'from-human', 'from-robot');
            }, 980);
            return attackStyle;
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
            if (state.robotThinkMs >= 2800) {
                const cueRound = state.round;
                playSfxLater('countdownTick', Math.max(240, Math.floor(state.robotThinkMs * 0.5)), () => state.isPlaying && !state.roundResolved && state.round === cueRound);
                playSfxLater('countdownUrgent', Math.max(320, state.robotThinkMs - 1200), () => state.isPlaying && !state.roundResolved && state.round === cueRound);
            }
        },

        toast(html, type) {
            const el = document.getElementById('arena-toast');
            if (!el) return;
            el.className = `arena-toast math-pk-battle-caption show ${type}`;
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
            const stars = Number(data.starsEarned || 0);
            const progress = Number(data.totalStars || 0);
            const starText = `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}`;
            const guidedFeedback = data.guidedFeedback || buildGuidedFeedback(data);
            center.innerHTML = `
                <div class="arena-lobby">
                    <h2 style="font-size:2rem;">${win ? '🏆 你赢了！' : (data.humanWins === data.robotWins ? '🤝 平局！' : '🤖 机器人赢了')}</h2>
                    <p style="font-size:1.1rem;">比分 你 <b style="color:#ffd166;">${data.humanWins}</b> : <b style="color:#ffd166;">${data.robotWins}</b> 机器人</p>
                    <p style="font-size:2.2rem;font-weight:900;color:#ffd166;margin-top:8px;">+${data.earnedPoints}</p>
                    <p style="opacity:.8;">获得成长积分</p>
                    <p style="margin-top:6px;opacity:.75;font-size:.85rem;">答对 ${data.correctCount}/${data.total} · 最高连击 ${data.maxCombo}</p>
                    <p style="margin-top:10px;font-size:1rem;">本局获得 <b style="color:#ffd166;">${starText}</b></p>
                    <p style="opacity:.82;">累计星轨：${progress} / 12</p>
                    <p style="opacity:.9;font-size:.88rem;">解锁：${escapeHtml(data.rewardMessage || '继续收集星星')}</p>
                    <div class="mathpk-result-guide">
                        <strong>复盘</strong>
                        <p>${escapeHtml(guidedFeedback.note || '')}</p>
                        <strong>下一局</strong>
                        <p>${escapeHtml(guidedFeedback.nextStep || '')}</p>
                    </div>
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
            container.innerHTML = `
                <div class="card" style="margin-top:16px;">
                    <div class="card-header"><h3 class="text-sm font-bold">🔢 数学 PK 难度</h3></div>
                    <div class="card-body">
                        <p class="text-xs text-muted" style="margin-bottom:12px;">数学 PK 竞技台每局 ${CONFIG.TOTAL_ROUNDS} 轮，在此选择出题难度（也影响机器人速度）。</p>
                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(132px,1fr));gap:10px;">
                            ${DIFFICULTY_OPTIONS.map(o => `
                                <button data-diff="${o.id}" onclick="MathPKGame._setDifficulty('${o.id}')"
                                    style="padding:14px 10px;border-radius:14px;cursor:pointer;text-align:left;border:2px solid ${cur === o.id ? 'transparent' : '#e5e7eb'};background:${cur === o.id ? 'var(--sage-green, #7BAE8F)' : '#f7f9f8'};color:${cur === o.id ? '#fff' : '#3f5e4a'};transition:all 0.15s;">
                                    <div style="font-weight:800;font-size:15px;">${escapeHtml(o.label)}</div>
                                    <div style="font-size:11px;margin-top:4px;opacity:0.85;">${escapeHtml(o.desc)}</div>
                                    <div style="font-size:12px;margin-top:7px;font-weight:800;">${escapeHtml(o.fitFor || '')}</div>
                                    <div style="font-size:11px;margin-top:4px;line-height:1.45;opacity:0.86;">${escapeHtml(o.reason || '')}</div>
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

        _resetSupportForMatch() {
            state.support.retryUsed = false;
            state.support.starsEarned = 0;
        },

        _buildSupportOffer(diff) {
            const normalized = normalizeDifficulty(diff);
            const unlocked = getUnlockedSupportCardIds();
            return unlocked
                .map((cardId) => MATH_PK_SUPPORT_CARDS[cardId])
                .filter((card) => card && Array.isArray(card.stages) && card.stages.includes(normalized))
                .slice(0, 3)
                .map((card) => card.id);
        },

        _openSupportChooser(nextMode) {
            const diff = normalizeDifficulty(state.mathDifficulty);
            const offeredCardIds = this._buildSupportOffer(diff);
            if (!offeredCardIds.length) return false;
            state.isPlaying = false;
            state.support.offeredCardIds = offeredCardIds;
            state.support.pendingMode = nextMode;
            render._setRoundPill(`${DIFFICULTY_LABELS[diff]} · 选支援`);
            render.supportChooser(diff);
            playSfx('supportReady');
            playSfx('spotlightPulse');
            return true;
        },

        _maybeOpenSupportChooser(nextMode) {
            const diff = normalizeDifficulty(state.mathDifficulty);
            if (!isSupportChooserDifficulty(diff)) return false;
            return this._openSupportChooser(nextMode);
        },

        chooseSupportCardAndStart(cardId, nextMode) {
            const card = MATH_PK_SUPPORT_CARDS[cardId];
            if (!card) return;
            setSelectedSupportCardId(card.id);
            state.support.pendingMode = null;
            state.support.offeredCardIds = [];
            this._resetSupportForMatch();
            playSfx('supportUse');
            if (nextMode === 'training') {
                this._startTrainingCore();
                return;
            }
            this._startRobotMatchCore();
        },

        _startRobotMatchCore() {
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
            state.multiplicationCorrectCount = 0;
            state.training.active = false;
            state.training.currentQuestion = null;
            state.training.readyForPk = false;
            state.matchStartTs = Date.now();
            this._resetSupportForMatch();
            render._setScore();
            playSfx('challengeStart');
            this._nextRound();
        },

        _startTrainingCore() {
            state.isPlaying = true;
            state.roundClosing = false;
            state.mode = 'training';
            state.currentInput = '';
            state.training.active = true;
            state.training.streak = 0;
            state.training.totalCorrect = 0;
            state.training.readyForPk = false;
            state.multiplicationCorrectCount = 0;
            this._resetSupportForMatch();
            if (state.robotTimer) clearTimeout(state.robotTimer);
            playSfx('challengeStart');
            this._nextTrainingQuestion();
        },

        _setDifficulty(diff) {
            const normalized = normalizeDifficulty(diff);
            if (!VALID_DIFFICULTIES.includes(normalized)) return;
            if (state.mathDifficulty !== normalized) playSfx('choiceConfirm');
            state.mathDifficulty = normalized;
            try { localStorage.setItem(CONFIG.STORAGE_KEY_DIFFICULTY, normalized); } catch (e) {}
            if (!isSupportChooserDifficulty(normalized)) {
                setSelectedSupportCardId(null);
                state.support.offeredCardIds = [];
                state.support.pendingMode = null;
            }
            const mathPage = document.getElementById('page-mathpk');
            const arena = document.getElementById('math-arena');
            if (arena && mathPage && mathPage.classList.contains('active') && !state.isPlaying) {
                this.renderUI('math-pk-container');
                return;
            }
            if (_lastDiffContainer) render.renderDifficultySetting(_lastDiffContainer);
        },

        renderUI(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            // 先恢复难度，保证大厅显示正确（createContainer 内 _lobby 会用到）
            state.mathDifficulty = normalizeDifficulty(localStorage.getItem(CONFIG.STORAGE_KEY_DIFFICULTY) || state.mathDifficulty);
            render.createContainer(containerId);
            this.init();
            playSfx('uiOpen');
            playSfx('spotlightPulse');
        },

        start() {
            playSfx('choiceConfirm');
            if (this._maybeOpenSupportChooser('robot')) return;
            this._startRobotMatchCore();
        },

        startTraining() {
            playSfx('choiceConfirm');
            if (this._maybeOpenSupportChooser('training')) return;
            this._startTrainingCore();
        },

        _nextTrainingQuestion() {
            state.currentInput = '';
            state.roundResolved = false;
            state.roundClosing = false;
            state.currentQuestion = utils.generateMultiplicationTrainingQuestion(state.training.streak);
            state.training.currentQuestion = state.currentQuestion;
            render._setRoundPill(`乘法练习 · 连对 ${state.training.streak} / ${CONFIG.MUL_TRAINING_UNLOCK_STREAK}`);
            render.trainingMatch(state.currentQuestion);
            playSfx('mathRoundStart');
            playSfx('questionReveal');
        },

        _submitTrainingAnswer(selected) {
            playSfx('answerSubmit');
            const correct = selected === state.currentQuestion.answer;
            if (!correct) {
                const explanation = `再看一眼：${state.currentQuestion.multiplication} 是 ${state.currentQuestion.groups} 组 ${state.currentQuestion.groupSize} 个，${state.currentQuestion.repeatedAddition} = ${state.currentQuestion.answer}`;
                const retryCard = getSelectedSupportCard();
                const keepStreak = retryCard && retryCard.id === 'retry_once' && !state.support.retryUsed;
                if (keepStreak) {
                    state.support.retryUsed = true;
                    render._refreshSupportStatus();
                    render.toast('这次不扣连对<small>再试一次已使用</small>', 'win');
                    playSfx('supportUse');
                } else {
                    state.training.streak = 0;
                }
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
                render._setSide('human', { status: keepStreak ? '这次不扣连对' : '看图再试一次', time: '' });
                playSfx('mathWrong');
                playSfx('stunPop');
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
            state.multiplicationCorrectCount++;
            state.currentInput = '';
            playSfx('mathCorrect');
            if (state.training.streak >= 2) playSfx('comboUp');
            if (state.training.streak >= CONFIG.MUL_TRAINING_UNLOCK_STREAK) {
                state.training.readyForPk = true;
                render.toast(`已经连对 ${state.training.streak} 题<small>要不要挑战机器人？</small>`, 'win');
                playSfx('duelReady');
                playSfx('supportReady');
                playSfx('trainingUnlock');
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
            playSfx('challengeStart');
            this._nextRound();
        },

        _exit() {
            state.isPlaying = false;
            if (state.robotTimer) clearTimeout(state.robotTimer);
            playSfx('uiClose');
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

        _extractQuestionNumbers(question) {
            return (String(question && question.text || '').match(/\d+/g) || []).map((value) => Number(value));
        },

        _estimateRobotThinkMs(question, diff) {
            const normalized = normalizeDifficulty(diff);
            const profile = {
                easy20: { min: 5200, max: 9000, jitter: 520 },
                easy100: { min: 4700, max: 8000, jitter: 480 },
                medium_mul: { min: 6400, max: 9800, jitter: 520 },
                medium_mix: { min: 3500, max: 7000, jitter: 420 },
                hard: { min: 3000, max: 5600, jitter: 360 }
            }[normalized] || { min: 3000, max: 5600, jitter: 360 };

            const q = question || {};
            const nums = this._extractQuestionNumbers(q);
            const op = q.op || (/×/.test(q.text) ? '*' : (/÷/.test(q.text) ? '/' : (/[-]/.test(q.text) ? '-' : '+')));
            let ms = profile.min;

            if (q.isWord) {
                ms += 900;
            } else if (op === '*') {
                const a = Number(q.groups || nums[0] || 2);
                const b = Number(q.groupSize || nums[1] || 2);
                const larger = Math.max(a, b);
                const smaller = Math.min(a, b);
                ms += 900 + (larger - 2) * 170 + (smaller - 2) * 110;
                if (a * b >= 30) ms += 320;
                if (normalized === 'medium_mul') ms += 1100;
                if ([2, 5, 10].includes(a) || [2, 5, 10].includes(b)) ms += 180;
                else ms += 320;
            } else if (op === '/') {
                const dividend = Number(nums[0] || 12);
                const divisor = Number(nums[1] || 2);
                ms += 980 + Math.max(0, divisor - 2) * 85 + Math.max(0, Math.floor(dividend / 10)) * 70;
            } else {
                const a = Number(nums[0] || 0);
                const b = Number(nums[1] || 0);
                const larger = Math.max(a, b);
                ms += larger <= 20 ? 260 : 720;
                if (op === '+') {
                    if ((a % 10) + (b % 10) >= 10) ms += 420;
                    if (a + b >= 100) ms += 260;
                } else {
                    if ((a % 10) < (b % 10)) ms += 520;
                    if (a >= 50) ms += 180;
                }
                if (normalized === 'medium_mul') ms += 520;
            }

            const jitterSeed = (Number(q.answer) || 0) + nums.reduce((sum, value) => sum + value, 0) + normalized.length * 17;
            const jitter = ((jitterSeed * 73) % (profile.jitter * 2 + 1)) - profile.jitter;
            ms += jitter;
            const supportCard = getSelectedSupportCard();
            let maxMs = profile.max;
            if (supportCard && supportCard.id === 'slow_robot') {
                const bonus = Number((supportCard.effect && supportCard.effect.robotThinkMsBonus) || 0);
                ms += bonus;
                maxMs += bonus;
            }
            return Math.max(profile.min, Math.min(maxMs, ms));
        },

        _robotThinkMs(question, diff) {
            return this._estimateRobotThinkMs(question, diff);
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
            playSfx('mathRoundStart');
            playSfx('questionReveal');
            if (isAsyncMode()) {
                const bar = document.getElementById('arena-robot-bar');
                if (bar) bar.style.display = 'none';
                render._setSide('human', { status: '你的回合', time: '' });
                render._setSide('robot', { status: '好友稍后作答', time: '' });
                render._setSideClass('human', '');
                render._setSideClass('robot', '');
                return;
            }
            state.robotThinkMs = this._robotThinkMs(state.currentQuestion, state.mathDifficulty);
            state.robotDeadlineTs = Date.now() + state.robotThinkMs;
            render.startRobotBar();
            playSfx('robotCharge');
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
            playSfx('mathKeyTap');
        },
        _clearInput() {
            if (!state.isPlaying || state.roundClosing || state.roundResolved) return;
            if (state.currentInput === '') return;
            state.currentInput = '';
            this._refreshDisplay();
            playSfx('inputErase');
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
            playSfx('answerSubmit');
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
                    playSfx('mathCorrect');
                    if (state.combo >= 2) playSfx('comboUp');
                } else {
                    state.combo = 0;
                    render._setSide('human', { status: '答错了', time: '' });
                    render._setSide('robot', { status: '好友稍后作答', time: '' });
                    render.toast(`✗ 正确答案：${state.currentQuestion.answer}<small>下一题继续加油</small>`, 'lose');
                    playSfx('mathWrong');
                    playSfx('stunPop');
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
                const retryCard = getSelectedSupportCard();
                if (!isAsyncMode() && retryCard && retryCard.id === 'retry_once' && !state.support.retryUsed) {
                    state.support.retryUsed = true;
                    render._refreshSupportStatus();
                    const now = Date.now();
                    const remaining = Math.max(0, state.robotDeadlineTs - now);
                    const extendedMs = remaining + 1500;
                    state.robotThinkMs = extendedMs;
                    state.robotDeadlineTs = now + extendedMs;
                    if (state.robotTimer) clearTimeout(state.robotTimer);
                    state.robotTimer = setTimeout(() => this._robotAnswer(), extendedMs);
                    render.startRobotBar();
                    render.toast('再试一次已使用<small>机器人稍微等你一下</small>', 'win');
                    playSfx('supportUse');
                }
                state.currentInput = '';
                this._refreshDisplay();
                playSfx('mathWrong');
                playSfx('stunPop');
                return;
            }
            // 答对：人在机器人之前完成 → 人赢本轮
            state.roundResolved = true;
            if (state.robotTimer) clearTimeout(state.robotTimer);
            const humanMs = Date.now() - state.roundStartTs;
            this._resolveRound('human', humanMs);
            playSfx('mathCorrect');
        },

        _resolveRound(winner, humanMs) {
            state.roundClosing = true;
            const robotSec = (state.robotThinkMs / 1000).toFixed(1);
            if (winner === 'human') {
                const resolvedRound = state.round;
                state.humanWins++;
                state.correctCount++;
                if (state.currentQuestion && state.currentQuestion.op === '*') state.multiplicationCorrectCount++;
                state.combo++;
                if (state.combo > state.maxCombo) state.maxCombo = state.combo;
                state.score += CONFIG.BASE_SCORE + Math.min(state.combo * 2, 20);
                const hs = (humanMs / 1000).toFixed(1);
                render._setSide('human', { status: '✓ 答对！', time: `⚡ ${hs}s` });
                render._setSide('robot', { status: '被抢先了', time: '' });
                render._setSideClass('human', 'win'); render._setSideClass('robot', 'dim');
                const attackStyle = render._playAttackFx('human');
                render.toast(`⚡ 宠物出招！<small>用时 ${hs}s · +${CONFIG.BASE_SCORE + Math.min(state.combo * 2, 20)} 分</small>`, 'win');
                playSfx('dashWhoosh');
                playAttackStyleSfx(attackStyle, 'human');
                playSfx('roundWinCue');
                playSfxLater('battleImpact', 320, () => state.round === resolvedRound && state.roundClosing);
                if (state.combo >= 2) playSfx('comboUp');
            } else {
                const resolvedRound = state.round;
                state.robotWins++;
                state.combo = 0;
                render._setSide('robot', { status: '✓ 答对！', time: `⚡ ${robotSec}s` });
                render._setSide('human', { status: '慢了一步', time: '' });
                render._setSideClass('robot', 'win'); render._setSideClass('human', 'dim');
                const attackStyle = render._playAttackFx('robot');
                render.toast(`🤖 机器人反击<small>它用时 ${robotSec}s</small>`, 'lose');
                playSfx('dashWhoosh');
                playAttackStyleSfx(attackStyle, 'robot');
                playSfx('roundLoseCue');
                playSfxLater('battleImpact', 320, () => state.round === resolvedRound && state.roundClosing);
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

            const starsEarned = this._estimateRewardStars({
                difficulty: state.mathDifficulty,
                completed: true,
                correctCount: state.correctCount,
                multiplicationCorrectCount: state.multiplicationCorrectCount,
                win: win,
                total: getRoundTotal(),
                maxCombo: state.maxCombo
            });
            state.support.starsEarned = starsEarned;
            const progress = getSupportProgress();
            const diff = normalizeDifficulty(state.mathDifficulty);
            const previousStars = Number(progress[diff] || 0);
            const totalStars = previousStars + starsEarned;
            progress[diff] = totalStars;
            saveSupportProgress(progress);
            let rewardMessage = '再拿 1 颗星，就能更进一步';
            if (previousStars < 3 && totalStars >= 3) rewardMessage = '解锁新支援卡「拆一拆」';
            else if (previousStars < 6 && totalStars >= 6) rewardMessage = '解锁宠物入场动作';
            else if (previousStars < 9 && totalStars >= 9) rewardMessage = '解锁机器人图鉴徽章';
            else if (previousStars < 12 && totalStars >= 12) rewardMessage = '获得当前阶段完成印章';

            render._setRoundPill(win ? '🏆 胜利' : '对战结束');
            playSfx(win ? 'battleWin' : 'battleLose');
            if (starsEarned > 0) playSfx('rewardStar');
            if (win || starsEarned > 0) playSfx('rewardFanfare');
            if (win) playSfx('victoryBurst');
            if (!win) playSfx('faintDrop');
            playSfx('resultStamp');
            render.result({
                difficulty: state.mathDifficulty,
                humanWins: state.humanWins,
                robotWins: state.robotWins,
                earnedPoints,
                correctCount: state.correctCount,
                maxCombo: state.maxCombo,
                total: CONFIG.TOTAL_ROUNDS,
                starsEarned: starsEarned,
                totalStars: totalStars,
                rewardMessage: rewardMessage,
                guidedFeedback: buildGuidedFeedback({
                    difficulty: state.mathDifficulty,
                    humanWins: state.humanWins,
                    robotWins: state.robotWins,
                    correctCount: state.correctCount,
                    multiplicationCorrectCount: state.multiplicationCorrectCount,
                    maxCombo: state.maxCombo,
                    total: CONFIG.TOTAL_ROUNDS,
                    win: win
                })
            });
        },

        _estimateRewardStars(summary) {
            const data = summary || {};
            const difficulty = normalizeDifficulty(data.difficulty || state.mathDifficulty);
            if (difficulty === 'medium_mul') {
                let stars = 0;
                if (data.completed) stars++;
                if (Number(data.correctCount || 0) >= 3) stars++;
                if (Number(data.multiplicationCorrectCount || 0) >= 1) stars++;
                return Math.min(3, stars);
            }
            if (difficulty === 'medium_mix') {
                let stars = 0;
                if (data.win) stars++;
                const total = Math.max(1, Number(data.total || CONFIG.TOTAL_ROUNDS));
                if ((Number(data.correctCount || 0) / total) >= 0.7) stars++;
                if (Number(data.maxCombo || 0) >= 2) stars++;
                return Math.min(3, stars);
            }
            return 0;
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
        chooseSupportCardAndStart: (cardId, nextMode) => Game.chooseSupportCardAndStart(cardId, nextMode),
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
        estimateRobotThinkMs: (question, difficulty) => Game._estimateRobotThinkMs(question, difficulty),
        estimateRewardStars: (summary) => Game._estimateRewardStars(summary),
        getDifficulty: () => normalizeDifficulty(localStorage.getItem(CONFIG.STORAGE_KEY_DIFFICULTY) || state.mathDifficulty),
        getSupportCards: () => MATH_PK_SUPPORT_CARDS,
        getUnlockedSupportCardIds: () => getUnlockedSupportCardIds()
    };

    // 物理键盘支持（仅对战中）
    document.addEventListener('keydown', (e) => {
        if (!state.isPlaying || state.roundClosing || state.roundResolved) return;
        if (e.key >= '0' && e.key <= '9') Game._inputDigit(parseInt(e.key, 10));
        else if (e.key === 'Backspace') Game._clearInput();
        else if (e.key === 'Enter') Game._submitAnswer();
    });

})();
