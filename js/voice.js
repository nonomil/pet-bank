/**
 * VoiceSystem — 前端语音播报系统（零侵入）
 *
 * 三层降级：Python TTS 服务 → 浏览器 Web Speech API → 静默
 * 默认关闭。通过 MutationObserver 监听 DOM 变化触发播报，
 * 不修改任何现有 JS 文件逻辑。
 *
 * localStorage: petbank_voice_settings （随 profiles.js profile swap 自动跟随）
 */
(function () {
    'use strict';

    const STORAGE_KEY = 'petbank_voice_settings';
    const DEFAULT_SETTINGS = {
        enabled: false,
        voice: 'mom',
        rate: 1.0,
        pitch: 1.0,
        serverUrl: ''
    };

    // ===== 配置存储 =====
    let settings = Object.assign({}, DEFAULT_SETTINGS);
    let _serverAvailable = false;
    let _lastServerCheck = 0;
    const _SERVER_CHECK_INTERVAL = 30000; // 30s 周期重检

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                settings = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
            }
        } catch (e) {
            settings = Object.assign({}, DEFAULT_SETTINGS);
        }
    }

    function save() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (e) { /* ignore */ }
    }

    function getSettings() { return Object.assign({}, settings); }
    function setSettings(partial) {
        settings = Object.assign({}, settings, partial || {});
        save();
        // 地址变更时立即重检
        if (partial && 'serverUrl' in partial) {
            _lastServerCheck = 0;
            checkServer();
        }
    }

    // ===== 文本清洗 =====
    function cleanText(text) {
        if (typeof text !== 'string') return '';
        let s = text;
        // 去 emoji：优先用 Unicode 属性，否则回退区间
        try {
            s = s.replace(/\p{Extended_Pictographic}/gu, '');
        } catch (e) {
            s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '');
        }
        s = s.trim();
        if (!s) return '';
        // 数学符号转中文（仅当文本像算式时：含数字与运算符）
        if (/[\d+\-*/×÷=]/.test(s) && /[+\-*/×÷=]/.test(s)) {
            s = s.replace(/\+/g, '加')
                 .replace(/-/g, '减')
                 .replace(/[×*]/g, '乘')
                 .replace(/÷/g, '除')
                 .replace(/=/g, '等于');
            s = s.trim();
        }
        // 纯数字 / 长度<2 → 空
        if (!s) return '';
        if (/^\d+(\.\d+)?$/.test(s)) return '';
        if (s.length < 2) return '';
        return s;
    }

    // ===== 播放队列（串行）=====
    const _queue = [];
    let _playing = false;
    let _lastText = '';
    let _lastTime = 0;
    let _battleThrottle = 0;

    function speak(text, opts) {
        opts = opts || {};
        if (!settings.enabled) return;
        text = cleanText(text);
        if (!text) return;
        // 指纹去重（2s）
        const now = Date.now();
        if (text === _lastText && (now - _lastTime) < 2000) return;
        _lastText = text;
        _lastTime = now;
        _queue.push(text);
        _playNext();
    }

    function _playNext() {
        if (_playing) return;
        const text = _queue.shift();
        if (text == null) return;
        _playing = true;
        const done = function () {
            _playing = false;
            _playNext();
        };
        if (settings.serverUrl && _serverAvailable) {
            _speakViaServer(text).then(done).catch(function (err) {
                console.warn('[VoiceSystem] server tts failed, fallback browser:', err && err.message);
                _speakViaBrowser(text, done);
            });
        } else {
            _speakViaBrowser(text, done);
        }
    }

    // ===== 服务端 TTS =====
    function _speakViaServer(text) {
        return new Promise(function (resolve, reject) {
            const ctrl = new AbortController();
            const timer = setTimeout(function () { ctrl.abort(); }, 15000);
            fetch(settings.serverUrl.replace(/\/$/, '') + '/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, voice: settings.voice, engine: 'auto' }),
                signal: ctrl.signal
            }).then(function (res) {
                if (!res.ok) {
                    throw new Error('HTTP ' + res.status);
                }
                const contentType = res.headers.get('content-type') || '';
                if (contentType.indexOf('audio') !== -1) {
                    return res.blob().then(function (blob) {
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        audio.onended = function () { URL.revokeObjectURL(url); resolve(); };
                        audio.onerror = function () { URL.revokeObjectURL(url); reject(new Error('audio play error')); };
                        audio.play().then(function () {
                            // 播放启动成功，等 onended resolve
                        }).catch(function (e) {
                            URL.revokeObjectURL(url);
                            reject(e);
                        });
                    });
                } else if (contentType.indexOf('json') !== -1) {
                    return res.json().then(function (j) {
                        reject(new Error((j && j.error) || 'server tts error'));
                    });
                } else {
                    // 未知类型，尝试当音频
                    return res.blob().then(function (blob) {
                        const url = URL.createObjectURL(blob);
                        const audio = new Audio(url);
                        audio.onended = function () { URL.revokeObjectURL(url); resolve(); };
                        audio.onerror = function () { URL.revokeObjectURL(url); reject(new Error('audio play error')); };
                        audio.play().catch(function (e) { URL.revokeObjectURL(url); reject(e); });
                    });
                }
            }).catch(function (err) {
                reject(err);
            }).then(function () {}, function () {}).finally(function () {
                clearTimeout(timer);
            });
        });
    }

    // ===== 浏览器 Web Speech API =====
    let _voicesCache = null;
    function _getVoices() {
        if (_voicesCache && _voicesCache.length) return _voicesCache;
        try {
            _voicesCache = window.speechSynthesis.getVoices() || [];
        } catch (e) { _voicesCache = []; }
        return _voicesCache;
    }

    function _pickBrowserVoice() {
        const voices = _getVoices();
        if (!voices.length) return null;
        const zh = voices.filter(function (v) {
            return v.lang && (v.lang.indexOf('zh') === 0 || v.lang.indexOf('cmn') === 0);
        });
        const pool = zh.length ? zh : voices;
        const v = settings.voice;
        let kw;
        if (v === 'grandpa') {
            kw = ['Yun', 'Male', '男'];
        } else if (v === 'teacher' || v === 'mom' || v === 'child') {
            kw = ['Xiao', 'Female', '女'];
        } else {
            kw = ['Female', '女'];
        }
        for (let i = 0; i < kw.length; i++) {
            const hit = pool.find(function (vv) { return vv.name && vv.name.indexOf(kw[i]) !== -1; });
            if (hit) return hit;
        }
        return pool[0];
    }

    function _speakViaBrowser(text, done) {
        if (!('speechSynthesis' in window)) { done && done(); return; }
        let utter;
        try {
            utter = new SpeechSynthesisUtterance(text);
        } catch (e) { done && done(); return; }
        utter.lang = 'zh-CN';
        const v = _pickBrowserVoice();
        if (v) utter.voice = v;
        let rate = settings.rate;
        if (settings.voice === 'child') rate *= 0.85;
        utter.rate = rate;
        utter.pitch = settings.pitch;
        let settled = false;
        const finish = function () {
            if (settled) return; settled = true;
            done && done();
        };
        utter.onend = finish;
        utter.onerror = finish;
        try {
            window.speechSynthesis.speak(utter);
        } catch (e) { finish(); }
        // 安全兜底：5s 未结束也释放
        setTimeout(finish, 5000);
    }

    // ===== 服务可达性检测 =====
    function checkServer() {
        if (!settings.serverUrl) { _serverAvailable = false; return Promise.resolve(false); }
        const now = Date.now();
        if ((now - _lastServerCheck) < _SERVER_CHECK_INTERVAL && _lastServerCheck) {
            return Promise.resolve(_serverAvailable);
        }
        _lastServerCheck = now;
        return new Promise(function (resolve) {
            const ctrl = new AbortController();
            const timer = setTimeout(function () { ctrl.abort(); }, 2000);
            fetch(settings.serverUrl.replace(/\/$/, '') + '/health', { signal: ctrl.signal })
                .then(function (res) {
                    _serverAvailable = !!res.ok;
                    resolve(_serverAvailable);
                })
                .catch(function () { _serverAvailable = false; resolve(false); })
                .finally(function () { clearTimeout(timer); });
        });
    }

    // ===== MutationObserver：播报监听 =====
    const SELECTOR_RULES = [
        { sel: '#petToast', extract: function (n) { return n.textContent || ''; } },
        { sel: '.home-toast', extract: function (n) { return n.textContent || ''; } },
        { sel: '#battleLog', extract: function (n) {
            const now = Date.now();
            if (now - _battleThrottle < 600) return '';
            _battleThrottle = now;
            const ps = n.querySelectorAll('p');
            if (!ps.length) return '';
            return ps[ps.length - 1].textContent || '';
        } },
        { sel: '.explore-event-card:last-child', extract: function (n) {
            const p = n.querySelector('p');
            return p ? (p.textContent || '') : (n.textContent || '');
        } },
        { sel: '.walk-event-msg', extract: function (n) { return n.textContent || ''; } },
        { sel: '.math-question', extract: function (n) { return n.textContent || ''; } },
        { sel: '.math-result-page', extract: function (n) {
            const h2 = n.querySelector('h2');
            return h2 ? (h2.textContent || '') : '';
        } }
    ];

    function _matchAndExtract(node) {
        if (!node || node.nodeType !== 1) return null;
        for (let i = 0; i < SELECTOR_RULES.length; i++) {
            const rule = SELECTOR_RULES[i];
            let matched = null;
            try {
                if (node.matches && node.matches(rule.sel)) matched = node;
                else if (node.closest && node.closest(rule.sel)) matched = node.closest(rule.sel);
            } catch (e) { /* invalid selector on text node */ }
            if (matched) {
                try {
                    const t = rule.extract(matched);
                    if (t) return t;
                } catch (e) { /* ignore */ }
            }
        }
        return null;
    }

    function _handleMutationNode(node) {
        const text = _matchAndExtract(node);
        if (text) speak(text);
    }

    function _initContentObserver() {
        const obs = new MutationObserver(function (mutations) {
            for (let i = 0; i < mutations.length; i++) {
                const m = mutations[i];
                if (m.type === 'characterData') {
                    const parent = m.target.parentElement;
                    if (parent) _handleMutationNode(parent);
                    continue;
                }
                if (m.addedNodes && m.addedNodes.length) {
                    for (let j = 0; j < m.addedNodes.length; j++) {
                        const n = m.addedNodes[j];
                        if (n.nodeType === 1) _handleMutationNode(n);
                        else if (n.nodeType === 3 && n.parentElement) _handleMutationNode(n.parentElement);
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    // ===== 设置 UI 自注入 =====
    function _injectSettingsUI(panel) {
        if (!panel || panel.dataset.voiceInjected) return;
        panel.dataset.voiceInjected = '1';

        const card = document.createElement('div');
        card.className = 'card';
        card.style.marginTop = '12px';
        card.innerHTML =
            '<div class="card-header"><span>🔊 语音设置</span></div>' +
            '<div class="card-body" style="display:flex;flex-direction:column;gap:10px;font-size:14px;">' +
                '<label style="display:flex;align-items:center;gap:8px;color:var(--text-primary);">' +
                    '<input type="checkbox" id="voiceEnabled" ' + (settings.enabled ? 'checked' : '') + '> 启用语音播报' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;color:var(--text-primary);">音色 ' +
                    '<select id="voiceSelect" class="text-input" style="flex:1;padding:4px;">' +
                        '<option value="mom"' + (settings.voice === 'mom' ? ' selected' : '') + '>温柔妈妈</option>' +
                        '<option value="grandpa"' + (settings.voice === 'grandpa' ? ' selected' : '') + '>温暖爷爷</option>' +
                        '<option value="teacher"' + (settings.voice === 'teacher' ? ' selected' : '') + '>活泼老师</option>' +
                        '<option value="child"' + (settings.voice === 'child' ? ' selected' : '') + '>可爱童声</option>' +
                    '</select>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;color:var(--text-primary);">语速 ' +
                    '<input type="range" id="voiceRate" min="0.5" max="1.5" step="0.1" value="' + settings.rate + '" style="flex:1;">' +
                    '<span id="voiceRateVal" style="min-width:32px;text-align:right;color:var(--text-secondary);">' + settings.rate.toFixed(1) + '</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;color:var(--text-primary);">音调 ' +
                    '<input type="range" id="voicePitch" min="0.7" max="1.3" step="0.1" value="' + settings.pitch + '" style="flex:1;">' +
                    '<span id="voicePitchVal" style="min-width:32px;text-align:right;color:var(--text-secondary);">' + settings.pitch.toFixed(1) + '</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;color:var(--text-primary);">服务地址 ' +
                    '<input type="text" id="voiceServerUrl" class="text-input" placeholder="http://127.0.0.1:9885" value="' + (settings.serverUrl || '') + '" style="flex:1;padding:4px;">' +
                '</label>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                    '<button type="button" class="btn-tiny" id="voiceTestConn" style="border:1px solid var(--sage-green);color:var(--sage-green);">测试连接</button>' +
                    '<button type="button" class="btn-tiny btn-primary" id="voicePreview">🔊 试听</button>' +
                '</div>' +
            '</div>';

        panel.appendChild(card);

        const elEnabled = card.querySelector('#voiceEnabled');
        const elVoice = card.querySelector('#voiceSelect');
        const elRate = card.querySelector('#voiceRate');
        const elRateVal = card.querySelector('#voiceRateVal');
        const elPitch = card.querySelector('#voicePitch');
        const elPitchVal = card.querySelector('#voicePitchVal');
        const elServerUrl = card.querySelector('#voiceServerUrl');
        const elTestConn = card.querySelector('#voiceTestConn');
        const elPreview = card.querySelector('#voicePreview');

        elEnabled.addEventListener('change', function () {
            settings.enabled = elEnabled.checked; save();
        });
        elVoice.addEventListener('change', function () {
            settings.voice = elVoice.value; save();
        });
        elRate.addEventListener('input', function () {
            settings.rate = parseFloat(elRate.value); elRateVal.textContent = settings.rate.toFixed(1); save();
        });
        elPitch.addEventListener('input', function () {
            settings.pitch = parseFloat(elPitch.value); elPitchVal.textContent = settings.pitch.toFixed(1); save();
        });
        elServerUrl.addEventListener('change', function () {
            settings.serverUrl = elServerUrl.value.trim();
            save();
            _lastServerCheck = 0;
            checkServer();
        });
        elTestConn.addEventListener('click', function () {
            settings.serverUrl = elServerUrl.value.trim();
            save();
            _lastServerCheck = 0;
            checkServer().then(function (ok) {
                elTestConn.textContent = ok ? '✓ 可达' : '✗ 不可达';
                setTimeout(function () { elTestConn.textContent = '测试连接'; }, 2000);
            });
        });
        elPreview.addEventListener('click', function () {
            if (!settings.enabled) {
                settings.enabled = true; elEnabled.checked = true; save();
            }
            speak('你好呀，我是你的小伙伴！');
        });
    }

    function _initPanelObserver() {
        const obs = new MutationObserver(function () {
            const panels = document.querySelectorAll('.profile-panel');
            panels.forEach(function (p) { _injectSettingsUI(p); });
        });
        obs.observe(document.body, { childList: true, subtree: true });
        // 首次扫描
        const panels0 = document.querySelectorAll('.profile-panel');
        panels0.forEach(function (p) { _injectSettingsUI(p); });
    }

    // ===== 挂载 =====
    window.VoiceSystem = {
        speak: speak,
        getSettings: getSettings,
        setSettings: setSettings,
        checkServer: checkServer
    };

    function _boot() {
        load();
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.onvoiceschanged = function () { _voicesCache = window.speechSynthesis.getVoices() || []; };
            } catch (e) {}
        }
        _initContentObserver();
        _initPanelObserver();
        checkServer();
        // 周期重检
        setInterval(function () {
            if (settings.serverUrl) checkServer();
        }, _SERVER_CHECK_INTERVAL);
        console.log('[VoiceSystem] booted, enabled=' + settings.enabled);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _boot);
    } else {
        _boot();
    }
})();
