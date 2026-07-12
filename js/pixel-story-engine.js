/* PixelStoryEngine — 像素对话故事核心引擎 */
(function (root) {
    'use strict';

    var STORAGE_KEY = 'petbank_pixel_story_progress_v1';
    var STORY_ID = 'pixel-dialogue-story';
    var CHAPTERS_BASE = 'data/story-packs/04-pixel-dialogue-story';
    var DIALOGUE_CONTAINER_SEL = '#pixelStoryBox';
    var TEXT_CONTAINER_SEL = '#pixelStoryText';

    /* ===== 状态 ===== */
    var manifest = null;
    var chaptersCache = {};      // chapterId -> parsed JSON
    var currentChapter = null;   // current chapter data
    var currentSceneIdx = 0;     // scene index within chapter
    var currentLineIdx = 0;      // line index within scene
    var isAwaitingChoice = false;
    var isFeedbackPhase = false;
    var isCompleteScreen = false;
    var shellElement = null;     // #pixelStoryShell
    var sceneBgElement = null;   // img element for bg
    var spriteL = null;          // left sprite
    var spriteR = null;          // right sprite
    var spriteC = null;          // center sprite
    var backBtn = null;
    var boxEl = null;
    var nameEl = null;
    var textEl = null;
    var choicesEl = null;
    var nextHint = null;

    /* ===== 工具 ===== */
    function assetUrl(path) {
        return typeof root.resolvePetBankAssetUrl === 'function' ? root.resolvePetBankAssetUrl(path) : path;
    }

    function fetchJson(path) {
        return root.fetch(assetUrl(path)).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + path);
            return r.json();
        });
    }

    function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
    function qsa(sel, ctx) { return (ctx || document).querySelectorAll(sel); }

    /* ===== 进度持久化 ===== */
    function readProgress() {
        try {
            return JSON.parse(root.localStorage.getItem(STORAGE_KEY) || '{}');
        } catch (e) { return {}; }
    }

    function writeProgress(partial) {
        try {
            var cur = readProgress();
            cur.schemaVersion = 1;
            cur.storyId = STORY_ID;
            var merged = {};
            for (var k in cur) merged[k] = cur[k];
            for (var k2 in partial) merged[k2] = partial[k2];
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        } catch (e) { /* storage full or unavailable */ }
    }

    function getChapterProgress(chapterId) {
        var p = readProgress();
        return p.chapters && p.chapters[chapterId] ? p.chapters[chapterId] : null;
    }

    function getCompletedChapters() {
        var p = readProgress();
        var ids = [];
        if (p.chapters) {
            for (var id in p.chapters) {
                if (p.chapters[id] && p.chapters[id].completed) ids.push(id);
            }
        }
        return ids;
    }

    /* ===== 加载 ===== */
    function loadManifest() {
        if (manifest) return Promise.resolve(manifest);
        return fetchJson(CHAPTERS_BASE + '/manifest.json').then(function (m) {
            manifest = m;
            return m;
        });
    }

    function loadChapter(chapterId) {
        if (chaptersCache[chapterId]) return Promise.resolve(chaptersCache[chapterId]);
        return fetchJson(CHAPTERS_BASE + '/chapters/' + chapterId + '.json').then(function (data) {
            chaptersCache[chapterId] = data;
            return data;
        });
    }

    /* ===== 对话引擎核心 ===== */
    function getCurrentLine() {
        if (!currentChapter || !currentChapter.scenes) return null;
        var scene = currentChapter.scenes[currentSceneIdx];
        if (!scene || !scene.lines) return null;
        return scene.lines[currentLineIdx] || null;
    }

    function getCurrentScene() {
        if (!currentChapter || !currentChapter.scenes) return null;
        return currentChapter.scenes[currentSceneIdx] || null;
    }

    function hasNextLine() {
        var scene = getCurrentScene();
        if (!scene) return false;
        return currentLineIdx + 1 < scene.lines.length;
    }

    function hasNextScene() {
        return currentSceneIdx + 1 < currentChapter.scenes.length;
    }

    /* ===== 渲染 ===== */
    function renderLine(line) {
        if (!line || !shellElement) return;
        var scene = getCurrentScene();
        if (!scene) return;

        // 背景切换
        if (scene.background && sceneBgElement) {
            sceneBgElement.src = assetUrl(scene.background);
            sceneBgElement.style.display = 'block';
        }

        // 隐藏立绘
        if (spriteL) spriteL.classList.add('pixel-story-sprite-hide');
        if (spriteR) spriteR.classList.add('pixel-story-sprite-hide');
        if (spriteC) spriteC.classList.add('pixel-story-sprite-hide');

        // 旁白模式
        if (line.type === 'narration') {
            renderNarration(line);
            return;
        }

        // 隐藏旁白遮罩
        hideNarration();

        // 对话框模式
        if (boxEl) boxEl.style.display = 'block';
        isAwaitingChoice = false;
        isFeedbackPhase = false;

        // 角色立绘
        var charData = getCharacterData(line.character);
        if (charData && charData.sprite) {
            var pos = line.position || 'left';
            var el = pos === 'center' ? spriteC : (pos === 'right' ? spriteR : spriteL);
            if (el) {
                el.src = assetUrl(charData.sprite);
                el.classList.remove('pixel-story-sprite-hide');
            }
        }

        // 角色名标签
        if (nameEl && charData) {
            nameEl.textContent = charData.name || line.character;
            nameEl.className = 'pixel-story-name pixel-story-name-' + (charData.labelStyle || 'npc');
            nameEl.style.display = 'inline-block';
        }

        // 对话文本（打字效果）
        if (textEl) {
            textEl.textContent = line.text || '';
            textEl.className = 'pixel-story-text';
        }

        // Choice 选择
        if (line.type === 'choice' && line.options) {
            renderChoices(line);
            if (boxEl) boxEl.classList.add('no-click');
            if (nextHint) nextHint.style.display = 'none';
        } else {
            clearChoices();
            if (boxEl) boxEl.classList.remove('no-click');
            if (nextHint) nextHint.style.display = 'block';
        }

        // 触发语音
        triggerVoice(line);
    }

    function renderNarration(line) {
        hideNarration(); // remove existing
        if (boxEl) boxEl.style.display = 'none';

        var overlay = document.createElement('div');
        overlay.className = 'pixel-story-narration-overlay';
        overlay.id = 'pixelNarrationOverlay';

        var textDiv = document.createElement('div');
        textDiv.className = 'pixel-story-narration-text';
        textDiv.textContent = line.text || '';
        overlay.appendChild(textDiv);

        overlay.addEventListener('click', function () {
            advanceLine();
        });

        if (shellElement) shellElement.appendChild(overlay);
        triggerVoice(line);
    }

    function hideNarration() {
        var existing = document.getElementById('pixelNarrationOverlay');
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        if (boxEl) boxEl.style.display = 'block';
    }

    function renderChoices(line) {
        if (!choicesEl) return;
        isAwaitingChoice = true;
        choicesEl.innerHTML = '';
        choicesEl.style.display = 'flex';

        line.options.forEach(function (opt, idx) {
            var btn = document.createElement('button');
            btn.className = 'pixel-story-choice-btn';
            btn.textContent = opt.label;
            btn.addEventListener('click', function () { handleChoice(line, opt, idx); });
            choicesEl.appendChild(btn);
        });
    }

    function clearChoices() {
        if (!choicesEl) return;
        choicesEl.innerHTML = '';
        choicesEl.style.display = 'none';
        isAwaitingChoice = false;
    }

    function handleChoice(line, chosen, idx) {
        if (!isAwaitingChoice || !choicesEl) return;
        isAwaitingChoice = false;
        isFeedbackPhase = true;

        // 禁用所有按钮
        qsa('.pixel-story-choice-btn', choicesEl).forEach(function (b) { b.disabled = true; });

        // 标记正确/错误
        if (chosen.isCorrect) {
            chosen.el.className = 'pixel-story-choice-btn correct';
        } else {
            chosen.el.className = 'pixel-story-choice-btn wrong';
            // 如果只有一个正确答案，高亮正确答案
            var correctOpt = line.options.filter(function (o) { return o.isCorrect; })[0];
            if (correctOpt) {
                var btns = qsa('.pixel-story-choice-btn', choicesEl);
                // mark correct
            }
        }

        // 显示反馈
        var feedback = document.createElement('div');
        feedback.className = 'pixel-story-feedback ' + (chosen.isCorrect ? 'correct' : 'wrong');
        feedback.textContent = chosen.feedback || (chosen.isCorrect ? '答对了！' : '再想想～');
        choicesEl.appendChild(feedback);

        // 继续按钮
        var continueBtn = document.createElement('button');
        continueBtn.className = 'pixel-story-continue-btn';
        continueBtn.textContent = '继续 ▶';
        continueBtn.addEventListener('click', function () {
            isFeedbackPhase = false;
            advanceLine();
        });
        choicesEl.appendChild(continueBtn);

        // 记录学习结果
        recordLearning(line, chosen);
    }

    function recordLearning(line, chosen) {
        try {
            var p = readProgress();
            if (!p.learning) p.learning = {};
            var key = line.learningType + ':' + (line.word || line.expression || line.answer || 'q');
            if (!p.learning[key]) p.learning[key] = { total: 0, correct: 0 };
            p.learning[key].total += 1;
            if (chosen.isCorrect) p.learning[key].correct += 1;
            writeProgress({ learning: p.learning });
        } catch (e) { /* ignore */ }
    }

    function advanceLine() {
        if (isAwaitingChoice || isFeedbackPhase) return;

        var scene = getCurrentScene();
        if (!scene) return;

        // 旁白遮罩点击 → 关闭遮罩
        var overlay = document.getElementById('pixelNarrationOverlay');
        if (overlay) {
            hideNarration();
            return;
        }

        if (hasNextLine()) {
            currentLineIdx++;
            renderLine(getCurrentLine());
        } else if (hasNextScene()) {
            currentSceneIdx++;
            currentLineIdx = 0;
            renderLine(getCurrentLine());
        } else {
            showChapterComplete();
        }
    }

    /* ===== 章节完成 ===== */
    function showChapterComplete() {
        if (!shellElement) return;
        isCompleteScreen = true;

        // 保存完成状态
        var p = {};
        if (!p.chapters) p.chapters = {};
        p.chapters[currentChapter.chapterId] = { completed: true, completedAt: Date.now() };
        writeProgress({ chapters: p.chapters });

        var div = document.createElement('div');
        div.className = 'pixel-story-complete';
        div.innerHTML =
            '<div class="pixel-story-complete-card">' +
            '<div class="pixel-story-complete-title">✨ 完成！</div>' +
            '<div class="pixel-story-complete-subtitle">' +
            (currentChapter.title || '本章通过') +
            '</div>' +
            '<button class="pixel-story-complete-btn" id="pixelStoryBackToMapBtn">返回星际地图</button>' +
            '</div>';
        shellElement.appendChild(div);

        document.getElementById('pixelStoryBackToMapBtn').addEventListener('click', function () {
            if (div.parentNode) div.parentNode.removeChild(div);
            isCompleteScreen = false;
            showMap();
        });
    }

    /* ===== 语音 ===== */
    function triggerVoice(line) {
        if (root.VoiceSystem && typeof root.VoiceSystem.speak === 'function') {
            var charData = getCharacterData(line.character);
            var text = line.text || '';
            if (text) {
                if (charData && charData.voicePreset) {
                    root.VoiceSystem.speak(text, { voice: charData.voicePreset, force: true });
                } else {
                    root.VoiceSystem.speak(text, { force: true });
                }
            }
        }
    }

    function getCharacterData(charId) {
        if (!manifest || !manifest.characters) return null;
        for (var key in manifest.characters) {
            if (manifest.characters[key].id === charId || key === charId) {
                return manifest.characters[key];
            }
        }
        return null;
    }

    /* ===== 地图渲染 ===== */
    function showMap() {
        if (!shellElement) return;
        // dispatch to PixelStoryMap if available
        if (root.PixelStoryMap && typeof root.PixelStoryMap.render === 'function') {
            root.PixelStoryMap.render('pixelStoryMapContainer');
        } else {
            // fallback: simple list
            renderSimpleChapterList();
        }
    }

    function renderSimpleChapterList() {
        if (!shellElement || !manifest) return;
        shellElement.innerHTML =
            '<div class="pixel-story-tabs" id="pixelStoryTabs">' +
            '<button class="pixel-story-tab active" data-mode="story">📖 故事漫游</button>' +
            '<button class="pixel-story-tab" data-mode="adventure">⚔️ 冒险挑战</button>' +
            '</div>' +
            '<div class="pixel-story-map" id="pixelStoryMapContainer"></div>';

        setupTabListeners();
        if (root.PixelStoryMap && typeof root.PixelStoryMap.render === 'function') {
            root.PixelStoryMap.render('pixelStoryMapContainer');
        }
    }

    function setupTabListeners() {
        var tabs = qsa('.pixel-story-tab');
        if (!tabs.length) return;
        tabs.forEach(function (tab) {
            tab.addEventListener('click', function () {
                if (tab.classList.contains('active')) return;
                qsa('.pixel-story-tab').forEach(function (t) { t.classList.remove('active'); });
                tab.classList.add('active');
                if (tab.dataset.mode === 'adventure') {
                    switchToAdventureMode();
                } else {
                    showMap();
                }
            });
        });
    }

    function switchToAdventureMode() {
        // 切换到现有探索系统
        if (root.SpaceGrowthDetective && typeof root.SpaceGrowthDetective.render === 'function') {
            writeProgress({ activeMode: 'adventure' });
            if (shellElement) {
                shellElement.innerHTML =
                    '<div class="pixel-story-tabs" id="pixelStoryTabs">' +
                    '<button class="pixel-story-tab" data-mode="story">📖 故事漫游</button>' +
                    '<button class="pixel-story-tab active" data-mode="adventure">⚔️ 冒险挑战</button>' +
                    '</div>' +
                    '<div id="adventureContainer"></div>';
                setupTabListeners();
                root.SpaceGrowthDetective.render('adventureContainer');
            }
        } else {
            showToast('冒险挑战模式加载中...');
            showMap();
        }
    }

    /* ===== 入口：进入章节 ===== */
    function enterChapter(chapterId) {
        if (!shellElement) return;
        loadChapter(chapterId).then(function (chapter) {
            currentChapter = chapter;
            currentSceneIdx = 0;
            currentLineIdx = 0;
            isAwaitingChoice = false;
            isFeedbackPhase = false;
            isCompleteScreen = false;

            // 恢复进度
            var saved = getChapterProgress(chapterId);
            if (saved) {
                if (saved.sceneIdx != null) currentSceneIdx = saved.sceneIdx;
                if (saved.lineIdx != null) currentLineIdx = saved.lineIdx;
            }

            renderStage();
            renderLine(getCurrentLine());
        }).catch(function (err) {
            if (typeof showToast === 'function') showToast('故事加载失败: ' + err.message);
            else console.error('[PixelStory] load error:', err);
        });
    }

    function renderStage() {
        if (!shellElement) return;
        var chapter = currentChapter;
        if (!chapter) return;

        shellElement.innerHTML =
            '<div class="pixel-story-stage">' +
            '  <img class="pixel-story-bg" id="pixelStoryBg" src="" alt="" style="display:none">' +
            '  <img class="pixel-story-sprite pixel-story-sprite-left pixel-story-sprite-hide" id="pixelStorySpriteL" alt="">' +
            '  <img class="pixel-story-sprite pixel-story-sprite-right pixel-story-sprite-hide" id="pixelStorySpriteR" alt="">' +
            '  <img class="pixel-story-sprite pixel-story-sprite-center pixel-story-sprite-hide" id="pixelStorySpriteC" alt="">' +
            '  <button class="pixel-story-back" id="pixelStoryBack">← 返回</button>' +
            '  <div class="pixel-story-box" id="pixelStoryBox">' +
            '    <div class="pixel-story-name" id="pixelStoryName" style="display:none"></div>' +
            '    <div class="pixel-story-text" id="pixelStoryText"></div>' +
            '    <div class="pixel-story-choices" id="pixelStoryChoices" style="display:none"></div>' +
            '    <div class="pixel-story-next" id="pixelStoryNext">▼</div>' +
            '  </div>' +
            '</div>';

        // 缓存DOM引用
        sceneBgElement = document.getElementById('pixelStoryBg');
        spriteL = document.getElementById('pixelStorySpriteL');
        spriteR = document.getElementById('pixelStorySpriteR');
        spriteC = document.getElementById('pixelStorySpriteC');
        backBtn = document.getElementById('pixelStoryBack');
        boxEl = document.getElementById('pixelStoryBox');
        nameEl = document.getElementById('pixelStoryName');
        textEl = document.getElementById('pixelStoryText');
        choicesEl = document.getElementById('pixelStoryChoices');
        nextHint = document.getElementById('pixelStoryNext');

        boxEl.addEventListener('click', function (e) {
            if (e.target !== boxEl && !boxEl.contains(e.target)) return;
            if (isAwaitingChoice || isFeedbackPhase || isCompleteScreen) return;
            advanceLine();
        });

        backBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            // 保存进度
            writeProgress({
                chapters: (function () {
                    var c = {};
                    var key = currentChapter ? currentChapter.chapterId : 'unknown';
                    c[key] = { sceneIdx: currentSceneIdx, lineIdx: currentLineIdx, savedAt: Date.now() };
                    return c;
                })()
            });
            showMap();
        });

        // Store choices for reference during click
        choicesEl.addEventListener('click', function (e) {
            var btn = e.target.closest('.pixel-story-choice-btn');
            if (!btn || btn.disabled) return;
            // Choice handled via individual btn click listeners
        });
    }

    /* ===== 主入口 ===== */
    function render(containerId) {
        var container = document.getElementById(containerId);
        if (!container) {
            console.error('[PixelStory] container not found:', containerId);
            return Promise.reject(new Error('container not found'));
        }
        shellElement = container;
        shellElement.classList.add('pixel-story-engine-host');

        return loadManifest().then(function () {
            showMap();
        }).catch(function (err) {
            container.innerHTML = '<div style="padding:40px;color:#ff6b6b;text-align:center">故事加载失败，请检查网络后重试</div>';
            console.error('[PixelStory] init error:', err);
        });
    }

    /* ===== 工具 ===== */
    function showToast(msg) {
        if (typeof root.showToast === 'function') root.showToast(msg);
        else console.log('[PixelStory]', msg);
    }

    /* ===== 对外 API ===== */
    var PixelStoryEngine = {
        render: render,
        enterChapter: enterChapter,
        showMap: showMap,
        loadManifest: loadManifest,
        loadChapter: loadChapter,
        getCompletedChapters: getCompletedChapters,
        getChapterProgress: getChapterProgress,
        readProgress: readProgress
    };

    if (typeof root.PixelStoryEngine === 'undefined') {
        root.PixelStoryEngine = PixelStoryEngine;
    }
})(window);
