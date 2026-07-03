/**
 * sfx.js — 音效系统
 *
 * 用 ZzFX 代码合成音效（零依赖，立即可用），
 * 若 assets/audio/sfx/ 下有对应 mp3 则自动选用（用户可覆盖）。
 *
 * 音量 localStorage: petbank_sfx_volume (0-100, 默认 80)
 * 静音: sfx.mute() / sfx.isMuted()
 *
 * 用法：
 *   sfx.click()     — 按钮/切换
 *   sfx.hit()       — 战斗命中
 *   sfx.coin()      — 获得物品/盲盒
 *   sfx.levelup()   — 升级成功
 *   sfx.error()     — 失败/错误
 *   sfx.notice()    — 提示通知
 */

// ===== 等待 ZzFX 就绪后初始化 =====
(function () {
    'use strict';

    var _volume = 80;
    var _muted = false;
    var _ready = false;
    var _queue = [];

    try {
        var s = localStorage.getItem('petbank_sfx_volume');
        if (s !== null) _volume = Math.max(0, Math.min(100, parseInt(s, 10) || 80));
    } catch (e) {}

    // ===== 音效定义（ZZFXSound 参数）=====
    // 格式: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, tremDepth, tremSpeed, flanger]
    // 可为每个音效指定 mp3 路径（可选覆盖）
    var SOUNDS = {
        click:   { zzfx: [0.3, 0, 800, 0.01, 0.005, 0.03, 0, 1, 0, 0, -0.2, 0, 0.5], mp3: 'assets/audio/sfx/click.mp3' },
        hit:     { zzfx: [0.5, 0, 150, 0.01, 0.04, 0.08, 1, 0.5, 0, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/hit.mp3' },
        coin:    { zzfx: [0.4, 0, 600, 0.02, 0.06, 0.1, 0, 1, 0, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/coin.mp3' },
        levelup: { zzfx: [0.5, 0, 300, 0.03, 0.1, 0.15, 0, 0, -200, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/levelup.mp3' },
        error:   { zzfx: [0.4, 0, 100, 0.03, 0.08, 0.12, 3, 0, 0, 0, -50, 0, 0.5], mp3: 'assets/audio/sfx/error.mp3' },
        notice:  { zzfx: [0.3, 0, 400, 0.01, 0.02, 0.06, 0, 1, 0, 0, -50, 0, 0.5], mp3: 'assets/audio/sfx/notice.mp3' },
    };
    var _instances = {}; // {name: ZZFXSound}

    function _prep() {
        if (_ready) return;
        if (typeof ZZFXSound === 'undefined') { return; } // ZzFX 还没加载
        for (var name in SOUNDS) {
            if (SOUNDS.hasOwnProperty(name)) {
                try {
                    _instances[name] = new ZZFXSound(SOUNDS[name].zzfx);
                } catch (e) { /* 静默 */ }
            }
        }
        _ready = true;
        // 播放队列累积
        while (_queue.length) _play(_queue.shift());
    }

    function _play(name) {
        if (_muted) return;
        if (!_ready) { _prep(); _queue.push(name); return; }

        var vol = (_volume / 100);
        var inst = _instances[name];
        if (inst) {
            inst.play(vol);
            return;
        }
        // 回退 mp3（ZZFXSound 创建失败时）
        var s = SOUNDS[name];
        if (s && s.mp3) {
            try { var a = new Audio(s.mp3); a.volume = vol; a.play().catch(function () {}); } catch (e) {}
        }
    }

    window.sfx = {
        click:   function () { _play('click'); },
        hit:     function () { _play('hit'); },
        coin:    function () { _play('coin'); },
        levelup: function () { _play('levelup'); },
        error:   function () { _play('error'); },
        notice:  function () { _play('notice'); },

        setVolume: function (v) {
            _volume = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
            try { localStorage.setItem('petbank_sfx_volume', String(_volume)); } catch (e) {}
        },
        getVolume: function () { return _volume; },
        mute: function (v) { _muted = (v === undefined) ? !_muted : !!v; return _muted; },
        isMuted: function () { return _muted; },
    };

    // 初始化（ZzFX 可能已在之前加载）
    _prep();
})();
