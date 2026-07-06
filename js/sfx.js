/**
 * sfx.js — 音效系统
 *
 * 默认用 ZzFX 合成音效，若 assets/audio/sfx/ 下存在同名 mp3，则优先播放 mp3。
 *
 * 音量 localStorage: petbank_sfx_volume (0-100, 默认 80)
 * 静音 localStorage: petbank_sfx_muted ('1' 静音)
 *
 * 旧 API 继续可用：
 *   sfx.click(), sfx.hit(), sfx.coin(), sfx.levelup(), sfx.error(), sfx.notice()
 *
 * 语义化 API：
 *   sfx.dialogueNext(), sfx.discover(), sfx.mathCorrect(), sfx.mathWrong()
 *   sfx.choiceConfirm(), sfx.encounterWarning(), sfx.battleStart()
 *   sfx.playerAttack(), sfx.enemyAttack(), sfx.skillCast(), sfx.defend()
 *   sfx.itemUse(), sfx.battleWin(), sfx.battleLose()
 */

(function () {
    'use strict';

    var VOLUME_KEY = 'petbank_sfx_volume';
    var MUTED_KEY = 'petbank_sfx_muted';
    var _volume = 80;
    var _muted = false;
    var _ready = false;
    var _queue = [];
    var _mp3State = {}; // name -> true(usable) / false(missing or blocked)

    try {
        var s = localStorage.getItem(VOLUME_KEY);
        if (s !== null) _volume = Math.max(0, Math.min(100, parseInt(s, 10) || 80));
        _muted = localStorage.getItem(MUTED_KEY) === '1';
    } catch (e) {}

    // 格式: [volume, randomness, frequency, attack, sustain, release, shape, shapeCurve, slide, deltaSlide, tremDepth, tremSpeed, flanger]
    var SOUNDS = {
        click:            { zzfx: [0.3, 0, 800, 0.01, 0.005, 0.03, 0, 1, 0, 0, -0.2, 0, 0.5], mp3: 'assets/audio/sfx/click.mp3' },
        hit:              { zzfx: [0.5, 0, 150, 0.01, 0.04, 0.08, 1, 0.5, 0, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/hit.mp3' },
        coin:             { zzfx: [0.4, 0, 600, 0.02, 0.06, 0.1, 0, 1, 0, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/coin.mp3' },
        levelup:          { zzfx: [0.5, 0, 300, 0.03, 0.1, 0.15, 0, 0, -200, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/levelup.mp3' },
        error:            { zzfx: [0.4, 0, 100, 0.03, 0.08, 0.12, 3, 0, 0, 0, -50, 0, 0.5], mp3: 'assets/audio/sfx/error.mp3' },
        notice:           { zzfx: [0.3, 0, 400, 0.01, 0.02, 0.06, 0, 1, 0, 0, -50, 0, 0.5], mp3: 'assets/audio/sfx/notice.mp3' },

        dialogueNext:     { zzfx: [0.18, 0, 520, 0.005, 0.01, 0.035, 0, 1.2, 40, 0, 0, 0, 0.25], mp3: 'assets/audio/sfx/dialogueNext.mp3' },
        discover:         { zzfx: [0.34, 0, 720, 0.015, 0.06, 0.16, 0, 1.1, 160, 0, 0, 0, 0.35], mp3: 'assets/audio/sfx/discover.mp3' },
        mathCorrect:      { zzfx: [0.36, 0, 640, 0.01, 0.06, 0.14, 0, 1, 240, 0, 0, 0, 0.4], mp3: 'assets/audio/sfx/mathCorrect.mp3' },
        mathWrong:        { zzfx: [0.26, 0, 180, 0.015, 0.05, 0.1, 2, 0.8, -80, 0, 0, 0, 0.3], mp3: 'assets/audio/sfx/mathWrong.mp3' },
        choiceConfirm:    { zzfx: [0.26, 0, 680, 0.008, 0.025, 0.06, 0, 1, 80, 0, 0, 0, 0.2], mp3: 'assets/audio/sfx/choiceConfirm.mp3' },
        encounterWarning: { zzfx: [0.34, 0, 220, 0.02, 0.08, 0.16, 3, 0.7, -40, 0, 0.25, 8, 0.4], mp3: 'assets/audio/sfx/encounterWarning.mp3' },
        battleStart:      { zzfx: [0.4, 0, 260, 0.02, 0.08, 0.16, 1, 0.8, 180, 0, 0, 0, 0.45], mp3: 'assets/audio/sfx/battleStart.mp3' },
        playerAttack:     { zzfx: [0.42, 0, 170, 0.005, 0.04, 0.09, 1, 0.5, -80, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/playerAttack.mp3' },
        enemyAttack:      { zzfx: [0.44, 0, 130, 0.008, 0.055, 0.11, 1, 0.45, -110, 0, 0, 0, 0.5], mp3: 'assets/audio/sfx/enemyAttack.mp3' },
        skillCast:        { zzfx: [0.42, 0, 360, 0.02, 0.08, 0.18, 0, 1, 260, 0, 0.12, 5, 0.45], mp3: 'assets/audio/sfx/skillCast.mp3' },
        defend:           { zzfx: [0.32, 0, 420, 0.015, 0.06, 0.13, 0, 1.4, -60, 0, 0, 0, 0.55], mp3: 'assets/audio/sfx/defend.mp3' },
        itemUse:          { zzfx: [0.3, 0, 560, 0.01, 0.055, 0.12, 0, 1, 120, 0, 0, 0, 0.35], mp3: 'assets/audio/sfx/itemUse.mp3' },
        battleWin:        { zzfx: [0.46, 0, 500, 0.025, 0.12, 0.24, 0, 1, 320, 0, 0.08, 4, 0.55], mp3: 'assets/audio/sfx/battleWin.mp3' },
        battleLose:       { zzfx: [0.34, 0, 190, 0.03, 0.12, 0.22, 2, 0.75, -120, 0, 0, 0, 0.4], mp3: 'assets/audio/sfx/battleLose.mp3' }
    };

    var _instances = {};

    function _prep() {
        if (_ready) return;
        if (typeof ZZFXSound === 'undefined') return;
        for (var name in SOUNDS) {
            if (Object.prototype.hasOwnProperty.call(SOUNDS, name)) {
                try {
                    _instances[name] = new ZZFXSound(SOUNDS[name].zzfx);
                } catch (e) {}
            }
        }
        _ready = true;
        while (_queue.length) _play(_queue.shift());
    }

    function _playZzfx(name, vol) {
        var inst = _instances[name];
        if (inst) {
            inst.play(vol);
            return true;
        }
        return false;
    }

    function _playMp3(name, vol) {
        var sound = SOUNDS[name];
        if (!sound || !sound.mp3 || typeof Audio === 'undefined' || _mp3State[name] === false) return false;
        try {
            var a = new Audio(sound.mp3);
            var fellBack = false;
            var fallback = function () {
                if (fellBack) return;
                fellBack = true;
                _mp3State[name] = false;
                _playZzfx(name, vol);
            };
            a.volume = vol;
            a.addEventListener('canplaythrough', function () { _mp3State[name] = true; }, { once: true });
            a.addEventListener('error', fallback, { once: true });
            var p = a.play();
            if (p && typeof p.catch === 'function') p.catch(fallback);
            return true;
        } catch (e) {
            _mp3State[name] = false;
            return false;
        }
    }

    function _play(name) {
        if (_muted || !SOUNDS[name]) return;
        if (!_ready) {
            _prep();
            if (!_ready) {
                _queue.push(name);
                return;
            }
        }

        var vol = (_volume / 100);
        if (_playMp3(name, vol)) return;
        var inst = _instances[name];
        if (inst) inst.play(vol);
    }

    function _saveMuted() {
        try { localStorage.setItem(MUTED_KEY, _muted ? '1' : '0'); } catch (e) {}
    }

    function _saveVolume() {
        try { localStorage.setItem(VOLUME_KEY, String(_volume)); } catch (e) {}
    }

    function _injectSettingsUI(panel) {
        if (!panel || panel.dataset.sfxInjected) return;
        panel.dataset.sfxInjected = '1';

        var card = document.createElement('div');
        card.className = 'card sfx-settings-card';
        card.style.marginTop = '12px';
        card.innerHTML =
            '<div class="card-header"><h3 class="text-sm font-bold">游戏音效</h3></div>' +
            '<div class="card-body sfx-settings-body">' +
                '<label class="sfx-settings-row">' +
                    '<input type="checkbox" id="sfxEnabled" ' + (!_muted ? 'checked' : '') + '> 启用音效' +
                '</label>' +
                '<label class="sfx-settings-row sfx-volume-row">' +
                    '<span>音量</span>' +
                    '<input type="range" id="sfxVolume" min="0" max="100" value="' + _volume + '">' +
                    '<span id="sfxVolumeValue">' + _volume + '%</span>' +
                '</label>' +
                '<button type="button" class="btn-secondary sfx-test-btn" id="sfxTest">测试音效</button>' +
                '<div class="sfx-settings-hint">探索、答题和战斗音效会跟随这里的开关与音量。</div>' +
            '</div>';
        panel.appendChild(card);

        var enabled = card.querySelector('#sfxEnabled');
        var volume = card.querySelector('#sfxVolume');
        var volumeValue = card.querySelector('#sfxVolumeValue');
        var test = card.querySelector('#sfxTest');

        enabled.addEventListener('change', function () {
            _muted = !enabled.checked;
            _saveMuted();
            if (!_muted) _play('notice');
        });
        volume.addEventListener('input', function () {
            _volume = Math.max(0, Math.min(100, parseInt(volume.value, 10) || 0));
            volumeValue.textContent = _volume + '%';
            _saveVolume();
        });
        test.addEventListener('click', function (event) {
            event.stopPropagation();
            _play('discover');
        });
    }

    function _initPanelObserver() {
        if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
        var injectAll = function () {
            var panels = document.querySelectorAll('.profile-panel');
            for (var i = 0; i < panels.length; i++) _injectSettingsUI(panels[i]);
        };
        injectAll();
        var obs = new MutationObserver(function () { injectAll(); });
        obs.observe(document.body, { childList: true, subtree: true });
    }

    window.sfx = {
        click: function () { _play('click'); },
        hit: function () { _play('hit'); },
        coin: function () { _play('coin'); },
        levelup: function () { _play('levelup'); },
        error: function () { _play('error'); },
        notice: function () { _play('notice'); },

        dialogueNext: function () { _play('dialogueNext'); },
        discover: function () { _play('discover'); },
        mathCorrect: function () { _play('mathCorrect'); },
        mathWrong: function () { _play('mathWrong'); },
        choiceConfirm: function () { _play('choiceConfirm'); },
        encounterWarning: function () { _play('encounterWarning'); },
        battleStart: function () { _play('battleStart'); },
        playerAttack: function () { _play('playerAttack'); },
        enemyAttack: function () { _play('enemyAttack'); },
        skillCast: function () { _play('skillCast'); },
        defend: function () { _play('defend'); },
        itemUse: function () { _play('itemUse'); },
        battleWin: function () { _play('battleWin'); },
        battleLose: function () { _play('battleLose'); },
        play: function (name) { _play(name); },

        setVolume: function (v) {
            _volume = Math.max(0, Math.min(100, parseInt(v, 10) || 0));
            _saveVolume();
        },
        getVolume: function () { return _volume; },
        mute: function (v) {
            _muted = (v === undefined) ? !_muted : !!v;
            _saveMuted();
            return _muted;
        },
        isMuted: function () { return _muted; }
    };

    _prep();
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _initPanelObserver);
    } else {
        _initPanelObserver();
    }
})();
