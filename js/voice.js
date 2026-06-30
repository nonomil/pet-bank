/**
 * VoiceSystem — 宠物积分系统专用语音播报（galgame 呈现层）
 *
 * 三层降级：预生成音频（assets/voice，统一 mp3）→ 后端 TTS（VoxCPM2/edge-tts）→ Web Speech API → 静默
 * 零侵入：MutationObserver 自动监听 galgameText / 场景卡片 / 战斗日志等容器，不改业务代码。
 *
 * 挂载点：window.VoiceSystem。DOMContentLoaded 自动 boot，无需手动调用。
 * 存储：localStorage 'petbank_voice_settings'（petbank_ 前缀，随 profile swap 跟随）。
 *
 * 暴露 API：
 *   speak(text)          主动播报（走降级链）
 *   getSettings()        读取当前设置（副本）
 *   setSettings(partial) 局部更新并持久化
 *   checkServer()        手动触发服务可达性检测（Promise<boolean>）
 */
(function () {
    'use strict';

    // ===== 配置 =====
    var STORAGE_KEY = 'petbank_voice_settings';
    var DEFAULT_SETTINGS = {
        enabled: false,
        voice: 'mom',              // mom / grandpa / teacher / child
        rate: 1.0,
        pitch: 1.0,
        serverUrl: '',             // 如 'http://127.0.0.1:9885'，留空则跳过服务
        autoPlay: true             // 自动播报开关（关闭后仅播放按钮工作）
    };

    // 预生成层
    // 注：统一 mp3 格式（兼容性优先，覆盖所有现代浏览器；opus 编解码兼容性差已弃用）。
    var PREFETCH_BASE = 'assets/voice';
    var PREFETCH_EXT = '.mp3';
    var PREFETCH_FALLBACK_EXT = '.mp3';
    var _prefetchMap = null;       // null=未加载/失败；{}=已加载（可能为空）

    var settings = null;
    var _serverAvailable = false;
    var _lastServerCheck = 0;
    var _SERVER_CHECK_INTERVAL = 30000;

    // 节流状态：selector -> lastTimestamp
    var _throttleMap = {};

    function _mergeSettings(defaults, stored) {
        var base = {};
        for (var k in defaults) base[k] = defaults[k];
        if (stored) for (var k2 in stored) base[k2] = stored[k2];
        return base;
    }

    // ===== 配置存储 =====
    function load() {
        try {
            var raw = localStorage.getItem(STORAGE_KEY);
            settings = _mergeSettings(DEFAULT_SETTINGS, raw ? JSON.parse(raw) : null);
        } catch (e) {
            settings = _mergeSettings(DEFAULT_SETTINGS, null);
        }
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    }
    function getSettings() { return _mergeSettings(settings, null); }
    function setSettings(partial) {
        settings = _mergeSettings(settings, partial || {});
        save();
        _syncPlayButtonsDisplay();
        if (partial && 'serverUrl' in partial) { _lastServerCheck = 0; checkServer(); }
    }

    // ===== 预生成层：加载 map.json =====
    function _loadPrefetchMap() {
        var ctrl;
        try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
        var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e2) {} }, 3000) : null;
        var cleanup = function () { if (timer) clearTimeout(timer); };
        fetch(PREFETCH_BASE + '/map.json', ctrl ? { signal: ctrl.signal } : {})
            .then(function (res) { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
            .then(function (m) {
                _prefetchMap = (m && typeof m === 'object') ? m : {};
                console.log('[VoiceSystem] prefetch map loaded:', Object.keys(_prefetchMap).length, 'entries');
            })
            .catch(function () { _prefetchMap = null; /* 静默失败，降级到服务/Web Speech */ })
            .then(cleanup, cleanup);
    }

    // ===== 文本清洗 =====
    function cleanText(text) {
        if (typeof text !== 'string') return '';
        var s = text;
        // 去 emoji：优先 Unicode 属性，否则回退区间
        try {
            s = s.replace(/\p{Extended_Pictographic}/gu, '');
        } catch (e) {
            s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, '');
        }
        s = s.replace(/\s+/g, ' ').trim();
        if (!s) return '';
        // 数学符号转中文读法（仅当文本含运算符时）
        if (/[\d+\-*/×÷=]/.test(s) && /[+\-*/×÷=]/.test(s)) {
            s = s.replace(/\+/g, '加')
                 .replace(/-/g, '减')
                 .replace(/[×*]/g, '乘')
                 .replace(/÷/g, '除')
                 .replace(/=/g, '等于');
            s = s.trim();
        }
        if (!s) return '';
        if (/^\d+(\.\d+)?$/.test(s)) return '';   // 纯数字不播
        if (s.length < 2) return '';              // 太短不播
        return s;
    }

    // ===== 串行播放队列 + 2s 指纹去重 =====
    var _queue = [];
    var _playing = false;
    var _lastText = '';
    var _lastTime = 0;

    function speak(text) {
        if (!settings.enabled) return;
        if (typeof text !== 'string' || !text) return;
        var prefetchHit = (_prefetchMap && settings.voice === 'mom' && _prefetchMap[text]);
        var queueText;
        if (prefetchHit) {
            // 用原始 text 命中预生成，仍存原始 text 以便查 map
            queueText = text;
        } else {
            queueText = cleanText(text);
            if (!queueText) return;
        }
        var now = Date.now();
        if (queueText === _lastText && (now - _lastTime) < 2000) return;   // 指纹去重
        _lastText = queueText; _lastTime = now;
        _queue.push(prefetchHit ? { kind: 'prefetch', text: text } : { kind: 'normal', text: queueText });
        _playNext();
    }

    function _playNext() {
        if (_playing) return;
        var item = _queue.shift();
        if (!item) return;
        _playing = true;
        var done = function () { _playing = false; _playNext(); };

        if (item.kind === 'prefetch') {
            var md5 = _prefetchMap ? _prefetchMap[item.text] : null;
            if (md5) {
                var url = PREFETCH_BASE + '/' + md5 + PREFETCH_EXT;
                _playPrefetch(url).then(done).catch(function () {
                    // 预生成播放失败，降级到服务/Web Speech（用 cleanText 后的文本）
                    var t = cleanText(item.text);
                    if (!t) { done(); return; }
                    _playNormal(t, done);
                });
                return;
            }
            // map 没命中，走普通链
            var t0 = cleanText(item.text);
            if (!t0) { done(); return; }
            _playNormal(t0, done);
            return;
        }

        _playNormal(item.text, done);
    }

    function _playNormal(text, done) {
        if (settings.serverUrl && _serverAvailable) {
            _speakViaServer(text).then(done).catch(function (err) {
                console.warn('[VoiceSystem] server tts failed, fallback browser:', err && err.message);
                _speakViaBrowser(text, done);
            });
        } else {
            _speakViaBrowser(text, done);
        }
    }

    // ===== 预生成播放 =====
    // 统一 mp3 格式；播放失败上抛降级到服务/Web Speech。
    function _playPrefetch(url) {
        return new Promise(function (resolve, reject) {
            var settled = false;
            var timer = setTimeout(function () { if (!settled) { settled = true; resolve(); } }, 12000); // 安全兜底
            function ok() { if (settled) return; settled = true; clearTimeout(timer); resolve(); }
            function failFinal() { if (settled) return; settled = true; clearTimeout(timer); reject(new Error('prefetch audio error')); }
            function play(src, onErr) {
                var audio = new Audio(src);
                audio.onended = ok;
                audio.onerror = onErr;
                audio.play().catch(onErr);
            }
            play(url, function () {
                // 统一 mp3，无回退扩展；直接上抛降级
                failFinal();
            });
        });
    }

    // ===== 后端 TTS =====
    function _speakViaServer(text) {
        return new Promise(function (resolve, reject) {
            var ctrl = new AbortController();
            var timer = setTimeout(function () { ctrl.abort(); }, 15000);
            fetch(settings.serverUrl.replace(/\/$/, '') + '/tts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: text, voice: settings.voice, engine: 'auto' }),
                signal: ctrl.signal
            }).then(function (res) {
                if (!res.ok) throw new Error('HTTP ' + res.status);
                var contentType = res.headers.get('content-type') || '';
                function playBlob(blob) {
                    var u = URL.createObjectURL(blob);
                    var audio = new Audio(u);
                    audio.onended = function () { URL.revokeObjectURL(u); resolve(); };
                    audio.onerror = function () { URL.revokeObjectURL(u); reject(new Error('audio play error')); };
                    audio.play().catch(function (e) { URL.revokeObjectURL(u); reject(e); });
                }
                if (contentType.indexOf('json') !== -1) {
                    return res.json().then(function (j) { reject(new Error((j && j.error) || 'server tts error')); });
                }
                return res.blob().then(playBlob);
            }).catch(function (err) { reject(err); })
              .finally(function () { clearTimeout(timer); });
        });
    }

    // ===== 浏览器 Web Speech API =====
    var _voicesCache = null;
    function _getVoices() {
        if (_voicesCache && _voicesCache.length) return _voicesCache;
        try { _voicesCache = window.speechSynthesis.getVoices() || []; } catch (e) { _voicesCache = []; }
        return _voicesCache;
    }
    function _pickBrowserVoice() {
        var voices = _getVoices();
        if (!voices.length) return null;
        var zh = voices.filter(function (v) {
            return v.lang && (v.lang.indexOf('zh') === 0 || v.lang.indexOf('cmn') === 0);
        });
        var pool = zh.length ? zh : voices;
        var kw;
        if (settings.voice === 'grandpa') kw = ['Yun', 'Male', '男'];
        else if (settings.voice === 'teacher' || settings.voice === 'mom' || settings.voice === 'child') kw = ['Xiao', 'Female', '女'];
        else kw = ['Female', '女'];
        for (var i = 0; i < kw.length; i++) {
            var hit = pool.find(function (vv) { return vv.name && vv.name.indexOf(kw[i]) !== -1; });
            if (hit) return hit;
        }
        return pool[0];
    }
    function _speakViaBrowser(text, done) {
        if (!('speechSynthesis' in window)) { done && done(); return; }
        var utter;
        try { utter = new SpeechSynthesisUtterance(text); } catch (e) { done && done(); return; }
        utter.lang = 'zh-CN';
        var v = _pickBrowserVoice();
        if (v) utter.voice = v;
        var rate = settings.rate;
        if (settings.voice === 'child') rate *= 0.85;
        utter.rate = rate;
        utter.pitch = settings.pitch;
        var settled = false;
        var finish = function () { if (settled) return; settled = true; done && done(); };
        utter.onend = finish;
        utter.onerror = finish;
        try { window.speechSynthesis.speak(utter); } catch (e) { finish(); }
        setTimeout(finish, 5000);
    }

    // ===== 服务可达性检测 =====
    function checkServer() {
        if (!settings.serverUrl) { _serverAvailable = false; return Promise.resolve(false); }
        var now = Date.now();
        if ((now - _lastServerCheck) < _SERVER_CHECK_INTERVAL && _lastServerCheck) {
            return Promise.resolve(_serverAvailable);
        }
        _lastServerCheck = now;
        return new Promise(function (resolve) {
            var ctrl;
            try { ctrl = new AbortController(); } catch (e) { ctrl = null; }
            var timer = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e2) {} }, 2000) : null;
            var opts = ctrl ? { signal: ctrl.signal } : {};
            fetch(settings.serverUrl.replace(/\/$/, '') + '/health', opts)
                .then(function (res) { _serverAvailable = !!res.ok; resolve(_serverAvailable); })
                .catch(function () { _serverAvailable = false; resolve(false); })
                .then(function () { if (timer) clearTimeout(timer); }, function () { if (timer) clearTimeout(timer); });
        });
    }

    // ===== 播放按钮注入（核心）：监听 #galgameBox 出现 =====
    function _injectPlayButton(box) {
        if (!box || box.dataset.voiceBtn) return;
        box.dataset.voiceBtn = '1';
        // 确保 box 有定位上下文
        if (getComputedStyle(box).position === 'static') {
            box.style.position = 'relative';
        }
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'voice-play-btn';
        btn.textContent = '🔊';
        btn.title = '朗读当前对话';
        btn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:50;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:' + (settings.enabled ? 'inline-flex' : 'none') + ';align-items:center;justify-content:center;line-height:1;';
        // 关键：阻止冒泡到 #galgameBox 的 onclick=next()
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            var t = document.getElementById('galgameText');
            speak(t ? t.textContent : '');
        });
        box.appendChild(btn);
    }

    function _syncPlayButtonsDisplay() {
        var show = settings.enabled ? 'inline-flex' : 'none';
        var btns = document.querySelectorAll('.voice-play-btn');
        for (var i = 0; i < btns.length; i++) btns[i].style.display = show;
    }

    function _initPlayButtonObserver() {
        var injectAll = function () {
            var boxes = document.querySelectorAll('#galgameBox');
            for (var i = 0; i < boxes.length; i++) _injectPlayButton(boxes[i]);
        };
        injectAll();
        var obs = new MutationObserver(function (mutations) {
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.addedNodes && m.addedNodes.length) {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var n = m.addedNodes[j];
                        if (n.nodeType !== 1) continue;
                        if (n.id === 'galgameBox') _injectPlayButton(n);
                        else if (n.querySelector && n.querySelector('#galgameBox')) injectAll();
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // ===== 自动播报：监听文字容器 =====
    // 选择器规则：sel + extract(node)->string + 可选 throttle
    var AUTOPLAY_RULES = [
        { sel: '#galgameText', extract: function (n) { return n.textContent; }, throttle: 1500 },
        { sel: '#sceneFocusCard', extract: function (n) { var p = n.querySelector('p'); return p ? p.textContent : ''; } },
        { sel: '#petToast', extract: function (n) { return n.textContent; } },
        { sel: '.home-toast', extract: function (n) { return n.textContent; } },
        { sel: '#battleLog', extract: function (n) { var ps = n.querySelectorAll('p'); return ps.length ? ps[ps.length - 1].textContent : ''; }, throttle: 600 },
        { sel: '.walk-event-msg', extract: function (n) { return n.textContent; } },
        { sel: '.math-question', extract: function (n) { return n.textContent; } },
        { sel: '.math-result-page', extract: function (n) { var h = n.querySelector('h2'); return h ? h.textContent : ''; } }
    ];

    function _matchAndExtract(node) {
        if (!node || node.nodeType !== 1) return null;
        for (var i = 0; i < AUTOPLAY_RULES.length; i++) {
            var rule = AUTOPLAY_RULES[i];
            var matched = null;
            try {
                if (node.matches && node.matches(rule.sel)) matched = node;
                else if (node.closest && node.closest(rule.sel)) matched = node.closest(rule.sel);
            } catch (e) { /* invalid selector */ }
            if (matched) {
                if (rule.throttle) {
                    var last = _throttleMap[rule.sel] || 0;
                    if (Date.now() - last < rule.throttle) return null;
                    _throttleMap[rule.sel] = Date.now();
                }
                try {
                    var t = rule.extract(matched);
                    if (t) return t;
                } catch (e) { /* ignore */ }
            }
        }
        return null;
    }
    function _handleMutationNode(node) {
        var text = _matchAndExtract(node);
        if (text) speak(text);
    }
    function _initAutoPlayObserver() {
        var obs = new MutationObserver(function (mutations) {
            if (!settings.enabled || !settings.autoPlay) return;   // autoPlay=false 不播
            for (var i = 0; i < mutations.length; i++) {
                var m = mutations[i];
                if (m.type === 'characterData') {
                    var parent = m.target.parentElement;
                    if (parent) _handleMutationNode(parent);
                    continue;
                }
                if (m.addedNodes && m.addedNodes.length) {
                    for (var j = 0; j < m.addedNodes.length; j++) {
                        var n = m.addedNodes[j];
                        if (n.nodeType === 1) _handleMutationNode(n);
                        else if (n.nodeType === 3 && n.parentElement) _handleMutationNode(n.parentElement);
                    }
                }
            }
        });
        obs.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    // ===== 设置面板注入（监听 .profile-panel 出现）=====
    function _injectSettingsUI(panel) {
        if (!panel || panel.dataset.voiceInjected) return;
        panel.dataset.voiceInjected = '1';

        var card = document.createElement('div');
        card.className = 'card';
        card.style.marginTop = '12px';
        card.innerHTML =
            '<div class="card-header"><h3 class="text-sm font-bold">🔊 语音设置</h3></div>' +
            '<div class="card-body" style="display:flex;flex-direction:column;gap:10px;font-size:14px;">' +
                '<label style="display:flex;align-items:center;gap:8px;">' +
                    '<input type="checkbox" id="voiceEnabled" ' + (settings.enabled ? 'checked' : '') + '> 启用语音播报' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;">' +
                    '<input type="checkbox" id="voiceAutoPlay" ' + (settings.autoPlay ? 'checked' : '') + '> 自动播报（关闭后仅播放按钮朗读）' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;">音色 ' +
                    '<select id="voiceSelect" class="text-input" style="flex:1;">' +
                        '<option value="mom"' + (settings.voice === 'mom' ? ' selected' : '') + '>温柔妈妈</option>' +
                        '<option value="grandpa"' + (settings.voice === 'grandpa' ? ' selected' : '') + '>温暖爷爷</option>' +
                        '<option value="teacher"' + (settings.voice === 'teacher' ? ' selected' : '') + '>活泼老师</option>' +
                        '<option value="child"' + (settings.voice === 'child' ? ' selected' : '') + '>可爱童声</option>' +
                    '</select>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;">语速 ' +
                    '<input type="range" id="voiceRate" min="0.5" max="1.5" step="0.1" value="' + settings.rate + '" style="flex:1;">' +
                    '<span id="voiceRateVal" style="min-width:32px;text-align:right;">' + settings.rate.toFixed(1) + '</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;">音调 ' +
                    '<input type="range" id="voicePitch" min="0.7" max="1.3" step="0.1" value="' + settings.pitch + '" style="flex:1;">' +
                    '<span id="voicePitchVal" style="min-width:32px;text-align:right;">' + settings.pitch.toFixed(1) + '</span>' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;">服务地址 ' +
                    '<input type="text" id="voiceServerUrl" class="text-input" placeholder="http://127.0.0.1:9885" value="' + (settings.serverUrl || '') + '" style="flex:1;">' +
                '</label>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                    '<button type="button" id="voiceTestConn" class="btn-tiny">测试连接</button>' +
                    '<button type="button" id="voicePreview" class="btn-primary btn-tiny">🔊 试听</button>' +
                '</div>' +
            '</div>';
        panel.appendChild(card);

        var elEnabled = card.querySelector('#voiceEnabled');
        var elAutoPlay = card.querySelector('#voiceAutoPlay');
        var elVoice = card.querySelector('#voiceSelect');
        var elRate = card.querySelector('#voiceRate');
        var elRateVal = card.querySelector('#voiceRateVal');
        var elPitch = card.querySelector('#voicePitch');
        var elPitchVal = card.querySelector('#voicePitchVal');
        var elServerUrl = card.querySelector('#voiceServerUrl');
        var elTestConn = card.querySelector('#voiceTestConn');
        var elPreview = card.querySelector('#voicePreview');

        elEnabled.addEventListener('change', function () {
            settings.enabled = elEnabled.checked; save(); _syncPlayButtonsDisplay();
        });
        elAutoPlay.addEventListener('change', function () { settings.autoPlay = elAutoPlay.checked; save(); });
        elVoice.addEventListener('change', function () { settings.voice = elVoice.value; save(); });
        elRate.addEventListener('input', function () { settings.rate = parseFloat(elRate.value); elRateVal.textContent = settings.rate.toFixed(1); save(); });
        elPitch.addEventListener('input', function () { settings.pitch = parseFloat(elPitch.value); elPitchVal.textContent = settings.pitch.toFixed(1); save(); });
        elServerUrl.addEventListener('change', function () {
            settings.serverUrl = elServerUrl.value.trim(); save(); _lastServerCheck = 0; checkServer();
        });
        elTestConn.addEventListener('click', function () {
            settings.serverUrl = elServerUrl.value.trim(); save(); _lastServerCheck = 0;
            checkServer().then(function (ok) {
                elTestConn.textContent = ok ? '✓ 可达' : '✗ 不可达';
                setTimeout(function () { elTestConn.textContent = '测试连接'; }, 2000);
            });
        });
        // 试听：用户手势激活 speechSynthesis（Chrome 首次需交互）
        elPreview.addEventListener('click', function () {
            if (!settings.enabled) { settings.enabled = true; elEnabled.checked = true; save(); _syncPlayButtonsDisplay(); }
            speak('你好呀，我是你的小伙伴！');
        });
    }

    function _initPanelObserver() {
        var injectAll = function () {
            var panels = document.querySelectorAll('.profile-panel');
            for (var i = 0; i < panels.length; i++) _injectSettingsUI(panels[i]);
        };
        injectAll();
        var obs = new MutationObserver(function () { injectAll(); });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    // ===== 启动 =====
    var _booted = false;
    function boot() {
        if (_booted) return;
        _booted = true;
        load();
        if ('speechSynthesis' in window) {
            try {
                window.speechSynthesis.onvoiceschanged = function () { _voicesCache = window.speechSynthesis.getVoices() || []; };
            } catch (e) {}
        }
        _loadPrefetchMap();
        _initPlayButtonObserver();
        _initAutoPlayObserver();
        _initPanelObserver();
        checkServer();
        setInterval(function () { if (settings.serverUrl) checkServer(); }, _SERVER_CHECK_INTERVAL);
        console.log('[VoiceSystem] boot, enabled=' + settings.enabled + ', autoPlay=' + settings.autoPlay + ', prefetchMap=' + (_prefetchMap === null ? 'loading' : 'ready'));
    }

    // ===== 暴露 API =====
    window.VoiceSystem = {
        speak: speak,
        getSettings: getSettings,
        setSettings: setSettings,
        checkServer: checkServer
    };

    // DOMContentLoaded 自动启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
