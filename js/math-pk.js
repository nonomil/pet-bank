/**
 * math-pk.js - 数学PK游戏模块
 * 功能：随机数学题、积分奖励、难度递进、可视化反馈
 */
(function() {
    'use strict';

    // ============ 配置与状态 ============
    const CONFIG = {
        DURATION: 30, // 游戏时长（秒）
        BASE_SCORE: 10, // 基础单题得分
        MAX_LEVEL_SCORE: 50, // 最高单题得分（含连击）
        STORAGE_KEY_HIGH_SCORE: 'petbank_math_high_score'
    };

    let state = {
        isPlaying: false,
        timeLeft: CONFIG.DURATION,
        currentQuestion: null,
        score: 0,
        combo: 0,
        maxCombo: 0,
        correctCount: 0,
        totalCount: 0,
        timerInterval: null,
        questionIndex: 0 // 用于难度递进判断
    };

    // ============ 工具函数 ============
    const utils = {
        getRandomInt(min, max) {
            return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        // 生成题目
        generateQuestion(index) {
            let a, b, op, answer;
            // 难度递进逻辑
            if (index < 5) {
                // 简单：20以内加减
                op = Math.random() > 0.5 ? '+' : '-';
                if (op === '+') {
                    a = this.getRandomInt(0, 15);
                    b = this.getRandomInt(0, 15 - a);
                    answer = a + b;
                } else {
                    a = this.getRandomInt(5, 20);
                    b = this.getRandomInt(0, a);
                    answer = a - b;
                }
            } else if (index < 15) {
                // 中等：100以内加减
                op = Math.random() > 0.5 ? '+' : '-';
                if (op === '+') {
                    a = this.getRandomInt(10, 80);
                    b = this.getRandomInt(1, 100 - a);
                    answer = a + b;
                } else {
                    a = this.getRandomInt(30, 100);
                    b = this.getRandomInt(1, a);
                    answer = a - b;
                }
            } else {
                // 困难：乘除
                const modes = ['*', '/'];
                op = modes[this.getRandomInt(0, 1)];
                if (op === '*') {
                    a = this.getRandomInt(2, 12);
                    b = this.getRandomInt(2, 9);
                    answer = a * b;
                } else {
                    // 除法保证整除
                    answer = this.getRandomInt(2, 10);
                    b = this.getRandomInt(2, 10);
                    a = answer * b;
                    op = '÷';
                }
            }

            // 统一符号显示
            const displayOp = op === '*' ? '×' : op;
            return { text: `${a} ${displayOp} ${b}`, answer, a, b, op };
        },
        // 生成4个选项
        generateOptions(answer) {
            const options = new Set([answer]);
            while (options.size < 4) {
                // 选项范围在答案附近，防止太离谱
                const offset = this.getRandomInt(-10, 10);
                const opt = answer + offset;
                if (opt >= 0 && opt !== answer) {
                    options.add(opt);
                }
            }
            return Array.from(options).sort(() => Math.random() - 0.5);
        }
    };

    // ============ UI 渲染 ============
    const render = {
        // 创建游戏容器
        createContainer(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return null;
            container.innerHTML = `
                <div class="math-game-wrapper">
                    <style>
                        .math-game-wrapper {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            min-height: 60vh;
                            font-family: inherit;
                        }
                        .math-card {
                            background: white;
                            border-radius: 24px;
                            padding: 2rem;
                            width: 100%;
                            max-width: 400px;
                            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
                            text-align: center;
                        }
                        .math-question {
                            font-size: 3.5rem;
                            font-weight: 900;
                            margin-bottom: 2rem;
                            color: #1f2937;
                        }
                        .math-options {
                            display: grid;
                            grid-template-columns: 1fr 1fr;
                            gap: 1rem;
                        }
                        .math-btn {
                            padding: 1rem;
                            font-size: 1.5rem;
                            font-weight: bold;
                            border-radius: 16px;
                            border: 2px solid #e5e7eb;
                            background: white;
                            cursor: pointer;
                            transition: all 0.2s;
                        }
                        .math-btn:active { transform: scale(0.95); }
                        .math-btn.correct {
                            background-color: #10b981 !important;
                            color: white !important;
                            border-color: #10b981 !important;
                            animation: math-flash-green 0.5s ease;
                        }
                        .math-btn.wrong {
                            background-color: #ef4444 !important;
                            color: white !important;
                            border-color: #ef4444 !important;
                            animation: math-shake 0.4s ease;
                        }
                        .math-timer {
                            font-size: 1.25rem;
                            font-weight: bold;
                            color: #ef4444;
                            margin-bottom: 1rem;
                        }
                        .math-stats {
                            display: flex;
                            justify-content: space-between;
                            margin-bottom: 1rem;
                            font-size: 0.875rem;
                            color: #6b7280;
                        }
                        .math-result-page {
                            text-align: center;
                        }
                        .math-result-score {
                            font-size: 4rem;
                            font-weight: 900;
                            color: #8b5cf6;
                        }
                        @keyframes math-flash-green {
                            0% { opacity: 1; }
                            50% { opacity: 0.5; }
                            100% { opacity: 1; }
                        }
                        @keyframes math-shake {
                            0%, 100% { transform: translateX(0); }
                            25% { transform: translateX(-10px); }
                            75% { transform: translateX(10px); }
                        }
                    </style>
                    <div id="math-game-content">
                        <div class="text-center">
                            <h2 class="text-2xl font-bold mb-4">数学 PK 挑战</h2>
                            <p class="text-sm text-muted mb-6">快速回答数学题，赚取成长积分！</p>
                            <button class="btn-primary w-full" onclick="MathPKGame.start()">开始挑战</button>
                            <div class="mt-4 text-xs text-muted">历史最高分: <span id="math-high-score">0</span></div>
                        </div>
                    </div>
                </div>
            `;
            return container;
        },

        updateQuestionUI(question, options) {
            const content = document.getElementById('math-game-content');
            if (!content) return;

            content.innerHTML = `
                <div class="math-card">
                    <div class="math-stats">
                        <span>得分: <span id="math-current-score">${state.score}</span></span>
                        <span>连击: <span id="math-current-combo">${state.combo}</span></span>
                    </div>
                    <div class="math-timer" id="math-timer-display">⏱️ ${state.timeLeft}s</div>
                    <div class="math-question">${question.text}</div>
                    <div class="math-options">
                        ${options.map(opt => `<button class="math-btn" onclick="MathPKGame._handleAnswer(${opt})">${opt}</button>`).join('')}
                    </div>
                </div>
            `;
        },

        showResult(data) {
            const content = document.getElementById('math-game-content');
            if (!content) return;

            content.innerHTML = `
                <div class="math-card math-result-page">
                    <h2 class="text-2xl font-bold mb-2">挑战结束!</h2>
                    <div class="math-result-score">${data.earnedPoints}</div>
                    <div class="text-sm text-muted mb-6">获得的成长积分</div>
                    
                    <div class="grid grid-cols-2 gap-4 mb-6">
                        <div class="bg-gray-50 p-3 rounded-xl">
                            <div class="text-xs text-muted">正确率</div>
                            <div class="font-bold">${data.accuracy}%</div>
                        </div>
                        <div class="bg-gray-50 p-3 rounded-xl">
                            <div class="text-xs text-muted">最高连击</div>
                            <div class="font-bold">${data.maxCombo}</div>
                        </div>
                    </div>

                    <button class="btn-primary w-full" onclick="MathPKGame.start()">再玩一次</button>
                    <button class="btn-secondary w-full mt-3" onclick="MathPKGame.renderUI('math-pk-container')">返回</button>
                </div>
            `;
        }
    };

    // ============ 核心逻辑 ============
    const Game = {
        init() {
            const high = localStorage.getItem(CONFIG.STORAGE_KEY_HIGH_SCORE) || 0;
            const highScoreEl = document.getElementById('math-high-score');
            if (highScoreEl) highScoreEl.textContent = high;
        },

        renderUI(containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                render.createContainer(containerId);
                this.init();
            }
        },

        start() {
            // 重置状态
            state.isPlaying = true;
            state.timeLeft = CONFIG.DURATION;
            state.score = 0;
            state.combo = 0;
            state.maxCombo = 0;
            state.correctCount = 0;
            state.totalCount = 0;
            state.questionIndex = 0;

            this._nextQuestion();
            this._startTimer();
        },

        _startTimer() {
            if (state.timerInterval) clearInterval(state.timerInterval);
            state.timerInterval = setInterval(() => {
                state.timeLeft--;
                const timerEl = document.getElementById('math-timer-display');
                if (timerEl) timerEl.textContent = `⏱️ ${state.timeLeft}s`;

                if (state.timeLeft <= 0) {
                    this._endGame();
                }
            }, 1000);
        },

        _nextQuestion() {
            state.totalCount++;
            state.questionIndex++;
            const question = utils.generateQuestion(state.questionIndex);
            state.currentQuestion = question;
            const options = utils.generateOptions(question.answer);
            render.updateQuestionUI(question, options);
        },

        _handleAnswer(selected) {
            if (!state.isPlaying) return;

            const buttons = document.querySelectorAll('.math-btn');
            const correct = selected === state.currentQuestion.answer;
            
            // 找到对应的按钮进行反馈
            buttons.forEach(btn => {
                if (parseInt(btn.textContent) === selected) {
                    if (correct) {
                        btn.classList.add('correct');
                    } else {
                        btn.classList.add('wrong');
                    }
                }
            });

            // 延迟处理，方便看动画
            setTimeout(() => {
                if (correct) {
                    this._onCorrect();
                } else {
                    this._onWrong();
                }
                this._nextQuestion();
            }, 400);
        },

        _onCorrect() {
            state.correctCount++;
            state.combo++;
            if (state.combo > state.maxCombo) state.maxCombo = state.combo;
            
            // 积分计算：基础 + 连击加成
            // 连击越多分数越高，但设个上限
            const comboBonus = Math.min(state.combo * 2, 20); 
            const pointsEarned = CONFIG.BASE_SCORE + comboBonus;
            state.score += pointsEarned;

            // 更新 UI
            const scoreEl = document.getElementById('math-current-score');
            const comboEl = document.getElementById('math-current-combo');
            if (scoreEl) scoreEl.textContent = state.score;
            if (comboEl) comboEl.textContent = state.combo;
        },

        _onWrong() {
            state.combo = 0;
            const comboEl = document.getElementById('math-current-combo');
            if (comboEl) comboEl.textContent = state.combo;
        },

        _endGame() {
            state.isPlaying = false;
            clearInterval(state.timerInterval);

            // 计算结果
            const accuracy = Math.round((state.correctCount / state.totalCount) * 100) || 0;
            const earnedPoints = state.score;

            // 1. 写入成长分主链路
            if (typeof window.addGrowthPoints === 'function') {
                window.addGrowthPoints(earnedPoints);
            } else if (window.totalPoints !== undefined) {
                window.totalPoints = Math.max(0, Number(window.totalPoints || 0) + earnedPoints);
                if (typeof window.saveAppState === 'function') window.saveAppState();
                if (typeof window.updateStats === 'function') window.updateStats();
            }

            // 2. 保存最高分
            const currentHigh = localStorage.getItem(CONFIG.STORAGE_KEY_HIGH_SCORE) || 0;
            if (state.score > currentHigh) {
                localStorage.setItem(CONFIG.STORAGE_KEY_HIGH_SCORE, state.score.toString());
            }

            // 3. 显示结果页面
            render.showResult({
                accuracy: accuracy,
                earnedPoints: earnedPoints,
                maxCombo: state.maxCombo
            });
        }
    };

    // 暴露给全局
    window.MathPKGame = {
        start: () => Game.start(),
        renderUI: (id) => Game.renderUI(id),
        // 供内部回调使用
        _handleAnswer: (val) => Game._handleAnswer(val)
    };

    // 启动初始化
    document.addEventListener('DOMContentLoaded', () => {
        // 仅在 DOM 加载后尝试初始化（如果有容器的话）
        // 实际上 renderUI 会被手动调用
    });

})();
