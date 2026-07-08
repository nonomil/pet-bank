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
 *   sfx.uiOpen(), sfx.uiClose(), sfx.mathRoundStart(), sfx.mathKeyTap()
 *   sfx.comboUp(), sfx.supportReady(), sfx.supportUse(), sfx.rewardStar()
 *   sfx.battleImpact(), sfx.healPulse(), sfx.countdownTick(), sfx.countdownUrgent()
 *   sfx.dashWhoosh(), sfx.roundWinCue(), sfx.roundLoseCue()
 *   sfx.questionReveal(), sfx.answerSubmit(), sfx.inputErase(), sfx.robotCharge()
 *   sfx.challengeStart(), sfx.trainingUnlock(), sfx.teamSelect(), sfx.teamDeselect()
 *   sfx.duelReady(), sfx.resultStamp(), sfx.spotlightPulse()
 *   sfx.attackHop(), sfx.attackSpin(), sfx.shieldSpark(), sfx.faintDrop(), sfx.rewardFanfare()
 *   sfx.cardFlip(), sfx.switchPoof(), sfx.stunPop(), sfx.victoryBurst()
 *   sfx.purchaseConfirm(), sfx.rewardClaim(), sfx.chestOpen(), sfx.itemInspect()
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
        battleLose:       { zzfx: [0.34, 0, 190, 0.03, 0.12, 0.22, 2, 0.75, -120, 0, 0, 0, 0.4], mp3: 'assets/audio/sfx/battleLose.mp3' },
        uiOpen:           { zzfx: [0.2, 0, 720, 0.01, 0.025, 0.08, 0, 1, 120, 0, 0, 0, 0.22], mp3: 'assets/audio/sfx/uiOpen.mp3' },
        uiClose:          { zzfx: [0.18, 0, 420, 0.008, 0.02, 0.07, 0, 1, -90, 0, 0, 0, 0.2], mp3: 'assets/audio/sfx/uiClose.mp3' },
        mathRoundStart:   { zzfx: [0.3, 0, 540, 0.015, 0.045, 0.11, 0, 1, 180, 0, 0, 0, 0.32], mp3: 'assets/audio/sfx/mathRoundStart.mp3' },
        mathKeyTap:       { zzfx: [0.12, 0, 860, 0.003, 0.01, 0.02, 0, 1, 0, 0, 0, 0, 0.12], mp3: 'assets/audio/sfx/mathKeyTap.mp3' },
        comboUp:          { zzfx: [0.32, 0, 620, 0.012, 0.05, 0.14, 0, 1, 260, 0, 0.05, 6, 0.35], mp3: 'assets/audio/sfx/comboUp.mp3' },
        supportReady:     { zzfx: [0.28, 0, 780, 0.012, 0.05, 0.16, 0, 1.1, 220, 0, 0.06, 5, 0.32], mp3: 'assets/audio/sfx/supportReady.mp3' },
        supportUse:       { zzfx: [0.28, 0, 560, 0.01, 0.04, 0.12, 0, 1.1, 140, 0, 0.04, 4, 0.3], mp3: 'assets/audio/sfx/supportUse.mp3' },
        rewardStar:       { zzfx: [0.34, 0, 860, 0.012, 0.07, 0.18, 0, 1, 280, 0, 0.08, 7, 0.38], mp3: 'assets/audio/sfx/rewardStar.mp3' },
        battleImpact:     { zzfx: [0.4, 0, 120, 0.004, 0.03, 0.08, 1, 0.4, -40, 0, 0, 0, 0.45], mp3: 'assets/audio/sfx/battleImpact.mp3' },
        healPulse:        { zzfx: [0.26, 0, 660, 0.012, 0.06, 0.16, 0, 1, 160, 0, 0, 0, 0.3], mp3: 'assets/audio/sfx/healPulse.mp3' },
        countdownTick:    { zzfx: [0.16, 0, 940, 0.004, 0.012, 0.028, 0, 1, -10, 0, 0, 0, 0.14], mp3: 'assets/audio/sfx/countdownTick.mp3' },
        countdownUrgent:  { zzfx: [0.22, 0, 980, 0.004, 0.02, 0.06, 2, 0.95, -60, 0, 0.08, 10, 0.18], mp3: 'assets/audio/sfx/countdownUrgent.mp3' },
        dashWhoosh:       { zzfx: [0.24, 0, 220, 0.004, 0.03, 0.08, 3, 0.8, 420, 0, 0, 0, 0.22], mp3: 'assets/audio/sfx/dashWhoosh.mp3' },
        roundWinCue:      { zzfx: [0.28, 0, 700, 0.01, 0.04, 0.12, 0, 1.1, 180, 0, 0.03, 5, 0.26], mp3: 'assets/audio/sfx/roundWinCue.mp3' },
        roundLoseCue:     { zzfx: [0.22, 0, 240, 0.01, 0.04, 0.1, 2, 0.95, -90, 0, 0, 0, 0.22], mp3: 'assets/audio/sfx/roundLoseCue.mp3' },
        questionReveal:   { zzfx: [0.22, 0, 760, 0.01, 0.03, 0.08, 0, 1.1, 90, 0, 0, 0, 0.2], mp3: 'assets/audio/sfx/questionReveal.mp3' },
        answerSubmit:     { zzfx: [0.18, 0, 540, 0.004, 0.012, 0.04, 0, 1, -20, 0, 0, 0, 0.12], mp3: 'assets/audio/sfx/answerSubmit.mp3' },
        inputErase:       { zzfx: [0.14, 0, 320, 0.004, 0.01, 0.03, 0, 1, -40, 0, 0, 0, 0.1], mp3: 'assets/audio/sfx/inputErase.mp3' },
        robotCharge:      { zzfx: [0.2, 0, 280, 0.01, 0.05, 0.14, 3, 0.8, 140, 0, 0.05, 7, 0.24], mp3: 'assets/audio/sfx/robotCharge.mp3' },
        challengeStart:   { zzfx: [0.36, 0, 420, 0.02, 0.06, 0.16, 1, 0.9, 220, 0, 0.05, 4, 0.3], mp3: 'assets/audio/sfx/challengeStart.mp3' },
        trainingUnlock:   { zzfx: [0.34, 0, 820, 0.015, 0.08, 0.2, 0, 1.05, 260, 0, 0.06, 6, 0.34], mp3: 'assets/audio/sfx/trainingUnlock.mp3' },
        teamSelect:       { zzfx: [0.2, 0, 720, 0.006, 0.018, 0.05, 0, 1, 70, 0, 0, 0, 0.16], mp3: 'assets/audio/sfx/teamSelect.mp3' },
        teamDeselect:     { zzfx: [0.16, 0, 380, 0.005, 0.015, 0.04, 0, 1, -50, 0, 0, 0, 0.12], mp3: 'assets/audio/sfx/teamDeselect.mp3' },
        duelReady:        { zzfx: [0.3, 0, 680, 0.015, 0.04, 0.11, 0, 1.05, 180, 0, 0.04, 5, 0.28], mp3: 'assets/audio/sfx/duelReady.mp3' },
        resultStamp:      { zzfx: [0.3, 0, 210, 0.004, 0.03, 0.08, 1, 0.8, -20, 0, 0, 0, 0.34], mp3: 'assets/audio/sfx/resultStamp.mp3' },
        spotlightPulse:   { zzfx: [0.24, 0, 560, 0.02, 0.05, 0.12, 0, 1.1, 210, 0, 0.03, 4, 0.24], mp3: 'assets/audio/sfx/spotlightPulse.mp3' },
        attackHop:        { zzfx: [0.22, 0, 430, 0.006, 0.03, 0.08, 0, 1.05, 220, 0, 0.02, 3, 0.18], mp3: 'assets/audio/sfx/attackHop.mp3' },
        attackSpin:       { zzfx: [0.24, 0, 300, 0.008, 0.05, 0.12, 3, 0.9, 280, 0, 0.05, 8, 0.22], mp3: 'assets/audio/sfx/attackSpin.mp3' },
        shieldSpark:      { zzfx: [0.2, 0, 720, 0.004, 0.03, 0.1, 0, 1.2, -40, 0, 0.08, 6, 0.2], mp3: 'assets/audio/sfx/shieldSpark.mp3' },
        faintDrop:        { zzfx: [0.26, 0, 160, 0.01, 0.06, 0.18, 1, 0.75, -180, 0, 0, 0, 0.28], mp3: 'assets/audio/sfx/faintDrop.mp3' },
        rewardFanfare:    { zzfx: [0.34, 0, 460, 0.02, 0.08, 0.22, 0, 1.05, 320, 0, 0.06, 5, 0.42], mp3: 'assets/audio/sfx/rewardFanfare.mp3' },
        cardFlip:         { zzfx: [0.18, 0, 640, 0.004, 0.016, 0.05, 0, 1.1, 140, 0, 0.02, 6, 0.14], mp3: 'assets/audio/sfx/cardFlip.mp3' },
        switchPoof:       { zzfx: [0.22, 0, 360, 0.008, 0.028, 0.08, 3, 0.95, 160, 0, 0.03, 5, 0.16], mp3: 'assets/audio/sfx/switchPoof.mp3' },
        stunPop:          { zzfx: [0.18, 0, 240, 0.005, 0.02, 0.055, 1, 0.9, -30, 0, 0, 0, 0.16], mp3: 'assets/audio/sfx/stunPop.mp3' },
        victoryBurst:     { zzfx: [0.3, 0, 760, 0.012, 0.07, 0.17, 0, 1.08, 220, 0, 0.07, 7, 0.34], mp3: 'assets/audio/sfx/victoryBurst.mp3' },
        purchaseConfirm:  { zzfx: [0.24, 0, 680, 0.01, 0.03, 0.08, 0, 1.05, 120, 0, 0.02, 4, 0.2], mp3: 'assets/audio/sfx/purchaseConfirm.mp3' },
        rewardClaim:      { zzfx: [0.3, 0, 820, 0.012, 0.06, 0.14, 0, 1.08, 180, 0, 0.05, 6, 0.3], mp3: 'assets/audio/sfx/rewardClaim.mp3' },
        chestOpen:        { zzfx: [0.28, 0, 300, 0.01, 0.05, 0.14, 1, 0.85, 200, 0, 0.04, 5, 0.26], mp3: 'assets/audio/sfx/chestOpen.mp3' },
        itemInspect:      { zzfx: [0.16, 0, 760, 0.004, 0.015, 0.05, 0, 1, 70, 0, 0, 0, 0.14], mp3: 'assets/audio/sfx/itemInspect.mp3' }
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
            _play('uiOpen');
            setTimeout(function () { _play('mathCorrect'); }, 180);
            setTimeout(function () { _play('battleWin'); }, 420);
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
        uiOpen: function () { _play('uiOpen'); },
        uiClose: function () { _play('uiClose'); },
        mathRoundStart: function () { _play('mathRoundStart'); },
        mathKeyTap: function () { _play('mathKeyTap'); },
        comboUp: function () { _play('comboUp'); },
        supportReady: function () { _play('supportReady'); },
        supportUse: function () { _play('supportUse'); },
        rewardStar: function () { _play('rewardStar'); },
        battleImpact: function () { _play('battleImpact'); },
        healPulse: function () { _play('healPulse'); },
        countdownTick: function () { _play('countdownTick'); },
        countdownUrgent: function () { _play('countdownUrgent'); },
        dashWhoosh: function () { _play('dashWhoosh'); },
        roundWinCue: function () { _play('roundWinCue'); },
        roundLoseCue: function () { _play('roundLoseCue'); },
        questionReveal: function () { _play('questionReveal'); },
        answerSubmit: function () { _play('answerSubmit'); },
        inputErase: function () { _play('inputErase'); },
        robotCharge: function () { _play('robotCharge'); },
        challengeStart: function () { _play('challengeStart'); },
        trainingUnlock: function () { _play('trainingUnlock'); },
        teamSelect: function () { _play('teamSelect'); },
        teamDeselect: function () { _play('teamDeselect'); },
        duelReady: function () { _play('duelReady'); },
        resultStamp: function () { _play('resultStamp'); },
        spotlightPulse: function () { _play('spotlightPulse'); },
        attackHop: function () { _play('attackHop'); },
        attackSpin: function () { _play('attackSpin'); },
        shieldSpark: function () { _play('shieldSpark'); },
        faintDrop: function () { _play('faintDrop'); },
        rewardFanfare: function () { _play('rewardFanfare'); },
        cardFlip: function () { _play('cardFlip'); },
        switchPoof: function () { _play('switchPoof'); },
        stunPop: function () { _play('stunPop'); },
        victoryBurst: function () { _play('victoryBurst'); },
        purchaseConfirm: function () { _play('purchaseConfirm'); },
        rewardClaim: function () { _play('rewardClaim'); },
        chestOpen: function () { _play('chestOpen'); },
        itemInspect: function () { _play('itemInspect'); },
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
