/**
 * ToolboxSystem Module
 * Part of the Pet-Bank project.
 * Features: Random Name Picker & Pomodoro Timer.
 */
const ToolboxSystem = (function() {
    // --- Private State & Constants ---
    let state = {
        activeTool: null, // 'picker' or 'pomodoro'
        familyMembers: ["爸爸", "妈妈", "我", "奶奶", "爷爷"],
        pomodoroCountToday: 0,
        timerInterval: null,
        timerRemaining: 0,
        timerTotal: 0,
        isTimerRunning: false,
        currentTimerMode: 'pomodoro' // 'pomodoro', 'short', 'long'
    };

    const STORAGE_KEYS = {
        FAMILY: 'petbank_family_members',
        POMODORO_TODAY: 'petbank_pomodoro_today'
    };
    const ADVANCED_TOOLS_FLAG = 'petbank_parent_admin_tools';

    const _isAdvancedToolsEnabled = () => {
        try {
            const params = new URLSearchParams(window.location.search || '');
            return params.get('parentAdmin') === '1'
                || localStorage.getItem(ADVANCED_TOOLS_FLAG) === '1'
                || sessionStorage.getItem(ADVANCED_TOOLS_FLAG) === '1';
        } catch (e) {
            return false;
        }
    };

    // --- Helper Methods ---
    const _loadState = () => {
        const savedMembers = localStorage.getItem(STORAGE_KEYS.FAMILY);
        if (savedMembers) {
            state.familyMembers = JSON.parse(savedMembers);
        }
        const savedPomodoro = localStorage.getItem(STORAGE_KEYS.POMODORO_TODAY);
        if (savedPomodoro) {
            state.pomodoroCountToday = parseInt(savedPomodoro, 10) || 0;
        }
    };

    const _saveState = () => {
        localStorage.setItem(STORAGE_KEYS.FAMILY, JSON.stringify(state.familyMembers));
        localStorage.setItem(STORAGE_KEYS.POMODORO_TODAY, state.pomodoroCountToday.toString());
    };

    const _beep = (frequency = 440, duration = 200) => {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = frequency;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + duration / 1000);
        } catch (e) {
            console.error("AudioContext error:", e);
        }
    };

    // --- CSS Injection ---
    const _injectStyles = () => {
        if (document.getElementById('toolbox-system-styles')) return;
        const style = document.createElement('style');
        style.id = 'toolbox-system-styles';
        style.textContent = `
            @keyframes pulse-gold {
                0% { transform: scale(1); text-shadow: none; }
                50% { transform: scale(1.3); text-shadow: 0 0 20px #ffd700; color: #ffd700; }
                100% { transform: scale(1); text-shadow: none; }
            }
            @keyframes flash-red {
                0%, 100% { background-color: transparent; }
                50% { background-color: rgba(255, 0, 0, 0.3); }
            }
            .toolbox-card {
                cursor: pointer;
                transition: transform 0.2s, box-shadow 0.2s;
                border-radius: 12px;
                padding: 20px;
                text-align: center;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                background: white;
            }
            .toolbox-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 15px rgba(0,0,0,0.15);
            }
            .animate-gold {
                animation: pulse-gold 0.6s ease-in-out 2;
            }
            .animate-flash {
                animation: flash-red 0.5s infinite;
            }
        `;
        document.head.appendChild(style);
    };

    // --- Data Import/Export Logic ---
    const _initDataIO = (container) => {
        const allKeys = () => Object.keys(localStorage).filter(k => k.startsWith('petbank_'));
        container.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:16px;max-width:560px;margin:0 auto;width:100%;">
                <div style="background:#f8f9fa;border-radius:12px;padding:16px;">
                    <div style="font-weight:bold;margin-bottom:8px;">📤 导出数据</div>
                    <div style="font-size:12px;color:#666;margin-bottom:12px;">把所有孩子的数据（积分/宠物/背包/小屋/探索...）导出为 JSON 文件备份。</div>
                    <button id="dio-export-btn" style="width:100%;padding:10px;border:none;border-radius:8px;background:#4caf50;color:#fff;font-weight:bold;cursor:pointer;">导出为 JSON 文件</button>
                </div>
                <div style="background:#f8f9fa;border-radius:12px;padding:16px;">
                    <div style="font-weight:bold;margin-bottom:8px;">📥 导入数据</div>
                    <div style="font-size:12px;color:#666;margin-bottom:12px;">从 JSON 文件恢复数据。<b style="color:#e53935;">注意：会覆盖当前所有数据。</b></div>
                    <input type="file" id="dio-import-input" accept=".json,application/json" style="display:none;">
                    <button id="dio-import-btn" style="width:100%;padding:10px;border:none;border-radius:8px;background:#ff9800;color:#fff;font-weight:bold;cursor:pointer;">选择 JSON 文件导入</button>
                </div>
                <div id="dio-msg" style="font-size:12px;color:#666;text-align:center;min-height:18px;"></div>
            </div>
        `;
        const msg = container.querySelector('#dio-msg');
        // 导出：收集所有 petbank_* 键 → JSON 下载
        container.querySelector('#dio-export-btn').onclick = () => {
            const data = {};
            allKeys().forEach(k => { data[k] = localStorage.getItem(k); });
            const payload = { __app: 'pet-bank', __version: '1.0', __exportedAt: new Date().toISOString(), data };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `pet-bank-backup-${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            msg.textContent = '✅ 已导出（' + Object.keys(data).length + ' 项数据）';
            msg.style.color = '#4caf50';
        };
        // 导入：读 JSON → 校验 → 覆盖写 localStorage → reload
        const input = container.querySelector('#dio-import-input');
        container.querySelector('#dio-import-btn').onclick = () => input.click();
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const payload = JSON.parse(ev.target.result);
                    const data = payload.data || payload;  // 兼容 {data:{}} 或裸 {}
                    if (!data || typeof data !== 'object') throw new Error('文件格式错误');
                    if (!confirm('确认导入？当前所有数据将被覆盖，建议先导出备份。')) return;
                    allKeys().forEach(k => localStorage.removeItem(k));  // 清空当前
                    let n = 0;
                    Object.entries(data).forEach(([k, v]) => {
                        if (k.startsWith('petbank_') && v != null) { localStorage.setItem(k, v); n++; }
                    });
                    msg.textContent = `✅ 导入成功（${n} 项），1 秒后刷新...`;
                    msg.style.color = '#4caf50';
                    setTimeout(() => location.reload(), 1000);
                } catch (err) {
                    msg.textContent = '❌ 导入失败：' + err.message;
                    msg.style.color = '#e53935';
                }
            };
            reader.readAsText(file);
        };
    };

    // --- Random Picker Logic ---
    const _initPicker = (container) => {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
                <div style="flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8f9fa; border-radius: 15px; position: relative; overflow: hidden;">
                    <div id="picker-display" style="font-size: 4rem; font-weight: bold; color: #333; z-index: 10;">?</div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                    <div style="display: flex; gap: 10px;">
                        <button id="picker-start-btn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #4caf50; color: white; font-weight: bold; cursor: pointer;">开始</button>
                        <button id="picker-reset-btn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #ff9800; color: white; font-weight: bold; cursor: pointer;">再来一次</button>
                    </div>
                    <textarea id="picker-members-edit" style="width: 100%; height: 60px; border-radius: 8px; border: 1px solid #ddd; padding: 5px; font-size: 12px;" placeholder="一行一个名字..."></textarea>
                    <button id="picker-save-members" style="width: 100%; padding: 5px; border: none; border-radius: 5px; background: #2196f3; color: white; cursor: pointer;">保存名单</button>
                </div>
            </div>
        `;

        const display = container.querySelector('#picker-display');
        const startBtn = container.querySelector('#picker-start-btn');
        const resetBtn = container.querySelector('#picker-reset-btn');
        const textarea = container.querySelector('#picker-members-edit');
        const saveBtn = container.querySelector('#picker-save-members');

        textarea.value = state.familyMembers.join('\\n');

        let pickerInterval = null;
        let currentSpeed = 50;

        const stopPicker = (finalName) => {
            clearInterval(pickerInterval);
            display.textContent = finalName;
            display.classList.add('animate-gold');
            _beep(660, 300);
            setTimeout(() => display.classList.remove('animate-gold'), 1500);
        };

        const startPicker = () => {
            display.classList.remove('animate-gold');
            let count = 0;
            currentSpeed = 50;
            
            // Update members from textarea before starting
            const lines = textarea.value.split('\\n').map(s => s.trim()).filter(s => s !== "");
            if (lines.length === 0) {
                alert("请输入至少一个名字！");
                return;
            }
            state.familyMembers = lines;
            _saveState();

            pickerInterval = setInterval(() => {
                const randomIndex = Math.floor(Math.random() * state.familyMembers.length);
                display.textContent = state.familyMembers[randomIndex];
                
                count++;
                // Slow down logic: every 10 ticks, increase interval
                if (count % 10 === 0 && currentSpeed < 500) {
                    currentSpeed += 50;
                    clearInterval(pickerInterval);
                    pickerInterval = setInterval(() => {
                        const randomIndex = Math.floor(Math.random() * state.familyMembers.length);
                        display.textContent = state.familyMembers[randomIndex];
                        count++;
                        if (count % 10 === 0 && currentSpeed < 500) {
                            currentSpeed += 50;
                            clearInterval(pickerInterval);
                            pickerInterval = setInterval(() => {
                                const randomIndex = Math.floor(Math.random() * state.familyMembers.length);
                                display.textContent = state.familyMembers[randomIndex];
                                count++;
                                if (count % 15 === 0 && currentSpeed < 800) {
                                    currentSpeed += 100;
                                    clearInterval(pickerInterval);
                                    pickerInterval = setInterval(() => {
                                        const randomIndex = Math.floor(Math.random() * state.familyMembers.length);
                                        display.textContent = state.familyMembers[randomIndex];
                                        count++;
                                        if (count > 40) stopPicker(display.textContent);
                                    }, currentSpeed);
                                }
                            }, currentSpeed);
                        }
                    }, currentSpeed);
                }

                if (count > 40) {
                    stopPicker(display.textContent);
                }
            }, currentSpeed);
        };

        // Simplified slow down logic for stability
        const runAnimation = () => {
            display.classList.remove('animate-gold');
            let ticks = 0;
            let speed = 50;
            clearInterval(pickerInterval);
            
            pickerInterval = setInterval(() => {
                const randomIndex = Math.floor(Math.random() * state.familyMembers.length);
                display.textContent = state.familyMembers[randomIndex];
                ticks++;

                if (ticks > 30) { // Fast phase
                    speed = 100;
                } else if (ticks > 50) { // Slowing phase
                    speed = 250;
                } else if (ticks > 70) { // Very slow
                    speed = 500;
                }

                if (ticks > 85) {
                    stopPicker(display.textContent);
                    clearInterval(pickerInterval);
                }
                
                // Actually, let's use a more robust approach
                // (The above setInterval nested logic is messy, let's rewrite simple)
            }, speed);
        };

        // RE-RE-WRITTEN robust picker logic
        const robustStart = () => {
            display.classList.remove('animate-gold');
            const lines = textarea.value.split('\\n').map(s => s.trim()).filter(s => s !== "");
            if (lines.length === 0) return alert("请输入名单");
            state.familyMembers = lines;
            _saveState();

            let ticks = 0;
            let speed = 50;
            clearInterval(pickerInterval);

            const step = () => {
                const randomIndex = Math.floor(Math.random() * state.familyMembers.length);
                display.textContent = state.familyMembers[randomIndex];
                ticks++;

                if (ticks < 30) {
                    speed = 50;
                } else if (ticks < 50) {
                    speed = 100;
                } else if (ticks < 70) {
                    speed = 300;
                } else if (ticks < 90) {
                    speed = 600;
                } else {
                    stopPicker(display.textContent);
                    return;
                }

                pickerInterval = setTimeout(step, speed);
            };
            step();
        };

        startBtn.onclick = robustStart;
        resetBtn.onclick = () => {
            display.textContent = "?";
            display.classList.remove('animate-gold');
        };
        saveBtn.onclick = () => {
            const lines = textarea.value.split('\\n').map(s => s.trim()).filter(s => s !== "");
            state.familyMembers = lines;
            _saveState();
            alert("名单已保存！");
        };
    };

    // --- Pomodoro Logic ---
    const _initPomodoro = (container) => {
        container.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
                <div style="flex: 2; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #fff5f5; border-radius: 15px; position: relative;">
                    <svg width="200" height="200" style="transform: rotate(-90deg);">
                        <circle cx="100" cy="100" r="90" stroke="#eee" stroke-width="10" fill="none" />
                        <circle id="timer-progress" cx="100" cy="100" r="90" stroke="#ff5252" stroke-width="10" fill="none" 
                            stroke-dasharray="565.48" stroke-dashoffset="0" style="transition: stroke-dashoffset 1s linear;" />
                    </svg>
                    <div id="timer-display" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 2.5rem; font-weight: bold; color: #333;">25:00</div>
                </div>
                <div style="flex: 1; display: flex; flex-direction: column; gap: 10px;">
                    <div style="display: flex; gap: 5px; justify-content: center;">
                        <button data-mode="pomodoro" class="mode-btn" style="padding: 5px 10px; border-radius: 5px; border: 1px solid #ddd; cursor: pointer; background: #fff;">🍅 25m</button>
                        <button data-mode="short" class="mode-btn" style="padding: 5px 10px; border-radius: 5px; border: 1px solid #ddd; cursor: pointer; background: #fff;">☕ 5m</button>
                        <button data-mode="long" class="mode-btn" style="padding: 5px 10px; border-radius: 5px; border: 1px solid #ddd; cursor: pointer; background: #fff;">🌴 15m</button>
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <button id="timer-start-btn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #4caf50; color: white; font-weight: bold; cursor: pointer;">开始</button>
                        <button id="timer-pause-btn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #ff9800; color: white; font-weight: bold; cursor: pointer;">暂停</button>
                        <button id="timer-reset-btn" style="flex: 1; padding: 10px; border: none; border-radius: 8px; background: #f44336; color: white; font-weight: bold; cursor: pointer;">重置</button>
                    </div>
                </div>
            </div>
        `;

        const display = container.querySelector('#timer-display');
        const progressCircle = container.querySelector('#timer-progress');
        const startBtn = container.querySelector('#timer-start-btn');
        const pauseBtn = container.querySelector('#timer-pause-btn');
        const resetBtn = container.querySelector('#timer-reset-btn');
        const modeBtns = container.querySelectorAll('.mode-btn');
        const circumference = 2 * Math.PI * 90;

        const modes = {
            'pomodoro': 25 * 60,
            'short': 5 * 60,
            'long': 15 * 60
        };

        const updateUI = () => {
            const mins = Math.floor(state.timerRemaining / 60);
            const secs = state.timerRemaining % 60;
            display.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            
            const offset = circumference - (state.timerRemaining / state.timerTotal) * circumference;
            progressCircle.style.strokeDashoffset = offset;
        };

        const resetTimer = (mode) => {
            clearInterval(state.timerInterval);
            state.isTimerRunning = false;
            state.currentTimerMode = mode;
            state.timerTotal = modes[mode];
            state.timerRemaining = modes[mode];
            updateUI();
            container.querySelector('.animate-flash')?.classList.remove('animate-flash');
        };

        const startTimer = () => {
            if (state.isTimerRunning) return;
            state.isTimerRunning = true;
            state.timerInterval = setInterval(() => {
                state.timerRemaining--;
                updateUI();

                if (state.timerRemaining <= 0) {
                    clearInterval(state.timerInterval);
                    state.isTimerRunning = false;
                    handleTimerComplete();
                }
            }, 1000);
        };

        const handleTimerComplete = () => {
            _beep(880, 500);
            container.querySelector('.animate-flash')?.classList.add('animate-flash');
            
            if (state.currentTimerMode === 'pomodoro') {
                // Success!
                state.pomodoroCountToday++;
                _saveState();
                
                // Call global functions if they exist
                if (typeof window.addGrowthPoints === 'function') {
                    window.addGrowthPoints(5);
                } else if (typeof saveAppState === 'function') {
                    window.totalPoints = (window.totalPoints || 0) + 5;
                    saveAppState();
                }
                alert("🍅 番茄钟完成！获得 +5 成长分！");
            } else {
                alert("☕ 休息结束，准备好继续了吗？");
            }
        };

        // Event Listeners
        modeBtns.forEach(btn => {
            btn.onclick = () => {
                modeBtns.forEach(b => b.style.background = '#fff');
                btn.style.background = '#e3f2fd';
                resetTimer(btn.dataset.mode);
            };
        });

        startBtn.onclick = startTimer;
        pauseBtn.onclick = () => {
            clearInterval(state.timerInterval);
            state.isTimerRunning = false;
        };
        resetBtn.onclick = () => resetTimer(state.currentTimerMode);

        // Initial Setup
        resetTimer('pomodoro');
    };

    // --- Public API ---
    return {
        init: function() {
            _loadState();
            _injectStyles();
        },

        renderUI: function(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
            
            // Clear container
            container.innerHTML = '';

            // Create Main Layout Container
            const mainWrapper = document.createElement('div');
            mainWrapper.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 20px;
                width: 100%;
                max-width: 800px;
                margin: 0 auto;
            `;

            // 1. Top Entry Cards
            const cardRow = document.createElement('div');
            cardRow.style.cssText = `
                display: flex;
                gap: 15px;
                justify-content: center;
            `;

            const createCard = (title, icon, color, toolKey) => {
                const card = document.createElement('div');
                card.className = 'toolbox-card';
                card.style.cssText = `flex: 1; background: ${color}; color: white;`;
                card.innerHTML = `<div style="font-size: 2rem;">${icon}</div><div style="font-weight: bold;">${title}</div>`;
                card.onclick = () => ToolboxSystem.openTool(toolKey, container);
                return card;
            };

            cardRow.appendChild(createCard('随机点名', '🎲', '#673ab7', 'picker'));
            cardRow.appendChild(createCard('番茄计时', '🍅', '#ff5252', 'pomodoro'));
            if (_isAdvancedToolsEnabled()) {
                cardRow.appendChild(createCard('数据管理', '💾', '#607d8b', 'data_io'));
            }
            mainWrapper.appendChild(cardRow);

            // 2. Tool Display Area (Two-column layout when a tool is active)
            const toolArea = document.createElement('div');
            toolArea.id = 'toolbox-tool-area';
            toolArea.style.cssText = `
                display: none; 
                min-height: 400px;
                gap: 20px;
            `;
            mainWrapper.appendChild(toolArea);

            container.appendChild(mainWrapper);
        },

        openTool: function(toolKey, container) {
            const toolArea = document.getElementById('toolbox-tool-area');
            toolArea.innerHTML = '';
            toolArea.style.display = 'flex';
            state.activeTool = toolKey;

            // Reset state for new tool session
            if (toolKey === 'picker') {
                _initPicker(toolArea);
            } else if (toolKey === 'pomodoro') {
                _initPomodoro(toolArea);
            } else if (toolKey === 'data_io') {
                _initDataIO(toolArea);
            }
        },

        pause: function() {
            // Stop any running timers
            clearInterval(state.timerInterval);
            state.isTimerRunning = false;
        },

        destroy: function() {
            this.pause();
            state.activeTool = null;
            const toolArea = document.getElementById('toolbox-tool-area');
            if (toolArea) toolArea.style.display = 'none';
        },

        enableAdvancedTools: function() {
            try { localStorage.setItem(ADVANCED_TOOLS_FLAG, '1'); } catch (e) {}
        },

        disableAdvancedTools: function() {
            try {
                localStorage.removeItem(ADVANCED_TOOLS_FLAG);
                sessionStorage.removeItem(ADVANCED_TOOLS_FLAG);
            } catch (e) {}
        }
    };
})();

window.ToolboxSystem = ToolboxSystem;
