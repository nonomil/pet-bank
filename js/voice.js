/**
 * VoiceSystem — 宠物积分系统专用语音播报（galgame 呈现层）
 *
 * 纯本地预生成 mp3 播放（assets/voice），无 TTS/WebSpeech。
 * 零侵入：MutationObserver 自动监听 galgameText 等容器，不改业务代码。
 * 命中 map.json 的文本播 assets/voice/*.mp3；未命中静默（开发者补生成，运行时不降级）。
 *
 * 挂载点：window.VoiceSystem。DOMContentLoaded 自动 boot，无需手动调用。
 * 存储：localStorage 'petbank_voice_settings'（petbank_ 前缀，随 profile swap 跟随）。
 *
 * 暴露 API：
 *   speak(text, opts)    主动播报（opts.force 忽略 enabled 开关）
 *   stop()               停止当前语音并清空待播队列
 *   getSettings()        读取当前设置（副本）
 *   setSettings(partial) 局部更新并持久化
 */
(function () {
    'use strict';

    // ===== 配置 =====
    var STORAGE_KEY = 'petbank_voice_settings';
    var DEFAULT_SETTINGS = {
        enabled: true,              // 启用语音（默认开）
        autoPlay: true              // 自动播报开关（关闭后仅播放按钮工作）
    };

    // 预生成层：统一 mp3 格式
    var PREFETCH_BASE = 'assets/voice';
    var PREFETCH_EXT = '.mp3';
    var _prefetchMap = null;       // null=未加载/失败；{}=已加载（可能为空）
    var _prefetchReady = false;
    var _pendingSpeak = null;

    var settings = null;

    // 节流状态：selector -> lastTimestamp
    var _throttleMap = {};
    var _throttleTextMap = {};

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
        // 清理旧版本残留字段（serverUrl/voice/rate/pitch 等 TTS 配置）
        var legacyKeys = ['serverUrl', 'voice', 'rate', 'pitch'];
        for (var i = 0; i < legacyKeys.length; i++) {
            if (legacyKeys[i] in settings) delete settings[legacyKeys[i]];
        }
    }
    function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) { /* ignore */ }
    }
    function getSettings() { return _mergeSettings(settings, null); }
    function setSettings(partial) {
        settings = _mergeSettings(settings, partial || {});
        // 防御：禁止写入已废弃的 TTS 字段
        var legacyKeys = ['serverUrl', 'voice', 'rate', 'pitch'];
        for (var i = 0; i < legacyKeys.length; i++) {
            if (legacyKeys[i] in settings) delete settings[legacyKeys[i]];
        }
        save();
        if (!settings.enabled || !settings.autoPlay) stop();
        _syncPlayButtonsDisplay();
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
                _prefetchReady = true;
                console.log('[VoiceSystem] prefetch map loaded:', Object.keys(_prefetchMap).length, 'entries');
                _flushPendingSpeak();
            })
            .catch(function () {
                _prefetchMap = {};
                _prefetchReady = true;
                _pendingSpeak = null;
                /* 静默失败，运行时不降级 */
            })
            .then(cleanup, cleanup);
    }

    // ===== galgame 文本清洗 =====
    // 探索 galgameText.textContent 含 <br> 拼接的多段文本与后缀（"✨ 获得物品！"、"点击准备战斗！"、
    // reward msg、choice 文本等）。这里剥离运行时附加段，只保留首段（与 map.json 键一致的形态）。
    function _cleanGalgameText(text) {
        if (typeof text !== 'string') return '';
        var s = text;
        // 先去后缀（"✨ 获得物品！"含 emoji 前缀，必须在去 emoji 前处理，否则 ✨ 被早去、后缀残留）
        s = s.replace(/\s*✨\s*获得物品！\s*/g, ' ');
        s = s.replace(/\s*点击准备战斗！\s*/g, ' ');
        s = s.replace(/\s*答错了……继续探索吧。\s*/g, ' ');
        s = s.replace(/\s*答对了！\s*/g, ' ');
        // 再去 emoji（discover 前缀 🍄 / choose reward 前缀 🌿 / 残留 ✨ 等，map 键无 emoji）
        try { s = s.replace(/\p{Extended_Pictographic}/gu, ''); }
        catch (e) { s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/gu, ''); }
        // 去 emoji 附加的 variation selector（U+FE0F）和 ZWJ（U+200D）—— \p 不含这些会残留，导致首字符对不上 map 键
        s = s.replace(/[\u{FE00}-\u{FE0F}\u{200D}]/gu, '');
        // 统一去所有空格对齐 map 键（intro+" "+question / discover emoji 前空格 / choose reward 前空格）
        s = s.replace(/\s+/g, '');
        s = s.trim();
        if (!s) return '';
        return s;
    }

    // ===== 串行播放队列 + 2s 指纹去重 =====
    var _queue = [];
    var _playing = false;
    var _currentAudio = null;
    var _playToken = 0;
    var _lastText = '';
    var _lastTime = 0;

    function stop() {
        _playToken++;
        _queue = [];
        _playing = false;
        _pendingSpeak = null;
        _lastText = '';
        _lastTime = 0;
        _throttleMap = {};
        _throttleTextMap = {};
        if (_currentAudio) {
            try { _currentAudio.pause(); } catch (e) {}
            try { _currentAudio.src = ''; } catch (e2) {}
            _currentAudio = null;
        }
    }

    function speak(text, opts) {
        if (!settings.enabled && !(opts && opts.force)) return;
        if (typeof text !== 'string' || !text) return;
        var key = text;
        var now = Date.now();
        if (key === _lastText && (now - _lastTime) < 2000) return;   // 指纹去重
        stop(); // 新对话/新场景替换旧语音，避免地图切换后旧旁白继续播。
        _lastText = key; _lastTime = now;
        if (!_prefetchReady) {
            _pendingSpeak = { text: key };
            return;
        }
        _playMappedText(key);
    }

    function _flushPendingSpeak() {
        var pending = _pendingSpeak;
        _pendingSpeak = null;
        if (!pending || !pending.text) return;
        _playMappedText(pending.text);
    }

    function _playMappedText(key) {
        var hit = _prefetchMap ? _prefetchMap[key] : null;
        if (!hit) {
            // 未命中本地预生成：静默（开发者补生成，运行时不走 TTS/WebSpeech）
            console.warn('[VoiceSystem] no local audio for: ' + key.slice(0, 30));
            return;
        }
        _queue.push({ kind: 'prefetch', text: key });
        _playNext();
    }

    function _playNext() {
        if (_playing) return;
        var item = _queue.shift();
        if (!item) return;
        _playing = true;
        var token = _playToken;
        var done = function () {
            if (token !== _playToken) return;
            _playing = false;
            _currentAudio = null;
            _playNext();
        };

        if (item.kind === 'prefetch') {
            var md5 = _prefetchMap ? _prefetchMap[item.text] : null;
            if (md5) {
                var url = PREFETCH_BASE + '/' + md5 + PREFETCH_EXT;
                _playPrefetch(url, token).then(done).catch(function () { done(); });
                return;
            }
            done();
            return;
        }
        done();
    }

    // ===== 预生成播放 =====
    // 统一 mp3 格式；播放失败静默跳过（无降级链）。
    function _playPrefetch(url, token) {
        return new Promise(function (resolve, reject) {
            var settled = false;
            var timer = setTimeout(function () { if (!settled) { settled = true; resolve(); } }, 12000); // 安全兜底
            function ok() { if (settled || token !== _playToken) return; settled = true; clearTimeout(timer); resolve(); }
            function failFinal() { if (settled || token !== _playToken) return; settled = true; clearTimeout(timer); reject(new Error('prefetch audio error')); }
            var audio = new Audio(url);
            _currentAudio = audio;
            audio.onended = ok;
            audio.onerror = failFinal;
            audio.play().catch(failFinal);
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
        btn.style.cssText = 'position:absolute;top:8px;right:8px;z-index:50;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;line-height:1;';
        // 关键：阻止冒泡到 #galgameBox 的 onclick=next()；用 _cleanGalgameText 剥离运行时附加段后查询 map
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            e.preventDefault();
            var t = document.getElementById('galgameText');
            var raw = t ? t.textContent : '';
            var cleaned = _cleanGalgameText(raw);
            speak(cleaned || raw, { force: true });
        });
        box.appendChild(btn);
    }

    function _syncPlayButtonsDisplay() {
        // 播放按钮始终显示（点击 force 播放，不受 enabled 影响）；enabled 仅控制自动播报
    }

    function _hasScript(src) {
        var scripts = document.scripts || [];
        for (var i = 0; i < scripts.length; i++) {
            if (scripts[i].getAttribute('data-petbank-src') === src || scripts[i].getAttribute('src') === src) {
                return true;
            }
        }
        return false;
    }

    function _ensureAuxScript(src) {
        if (_hasScript(src)) return;
        var script = document.createElement('script');
        script.src = src;
        script.async = false;
        document.body.appendChild(script);
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
    // 自动播报规则：只保留探索地图 galgame 对话
    var AUTOPLAY_RULES = [
        // innerText excludes the collapsed detail copy, keeping audio aligned
        // with the short-first visual path.
        { sel: '#galgameText', extract: function (n) { return _cleanGalgameText(n.innerText || n.textContent); }, throttle: 300 }
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
                try {
                    var t = rule.extract(matched);
                    if (t) {
                        // 只节流同一文本，允许孩子快速点击时新对话立即播报。
                        var now = Date.now();
                        var last = _throttleMap[rule.sel] || 0;
                        var lastText = _throttleTextMap[rule.sel] || '';
                        if (rule.throttle && t === lastText && (now - last) < rule.throttle) return null;
                        _throttleMap[rule.sel] = now;
                        _throttleTextMap[rule.sel] = t;
                        return t;
                    }
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
                    '<input type="checkbox" id="voiceEnabled" ' + (settings.enabled ? 'checked' : '') + '> 启用语音' +
                '</label>' +
                '<label style="display:flex;align-items:center;gap:8px;">' +
                    '<input type="checkbox" id="voiceAutoPlay" ' + (settings.autoPlay ? 'checked' : '') + '> 自动播报（关闭后仅播放按钮朗读）' +
                '</label>' +
            '</div>';
        panel.appendChild(card);

        var elEnabled = card.querySelector('#voiceEnabled');
        var elAutoPlay = card.querySelector('#voiceAutoPlay');

        elEnabled.addEventListener('change', function () {
            setSettings({ enabled: elEnabled.checked });
        });
        elAutoPlay.addEventListener('change', function () {
            setSettings({ autoPlay: elAutoPlay.checked });
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
        _loadPrefetchMap();
        _initPlayButtonObserver();
        _initAutoPlayObserver();
        _initPanelObserver();
        console.log('[VoiceSystem] boot, enabled=' + settings.enabled + ', autoPlay=' + settings.autoPlay + ', prefetchMap=' + (_prefetchMap === null ? 'loading' : 'ready'));
        // 运行时加载器会优先加载音效；这里保留兜底，避免单独引入 voice.js 时缺失 sfx。
        _ensureAuxScript('js/zzfx.js');
        _ensureAuxScript('js/sfx.js');
    }

    // ===== 暴露 API =====
    window.VoiceSystem = {
        speak: speak,
        stop: stop,
        getSettings: getSettings,
        setSettings: setSettings
    };

    // DOMContentLoaded 自动启动
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
