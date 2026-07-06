/**
 * exploration-detail.js - 场景探索中间页
 * 大图背景 + 故事推进 + 互动事件 → 战斗
 */

const ExplorationDetail = (function () {
    let currentScene = null;
    let eventIndex = 0;
    let foundItems = [];
    const EXPLORE_SHELL_HTML = document.getElementById('page-explore')?.innerHTML || '';
    const EXPLORE_ACTIVE_HTML = '<div id="exploreContainer"></div>';

    // CMATH 应用题池（data/math-cmath.json，来源 XiaoMi/cmath CC BY 4.0）
    // 懒加载：进入探索即后台 fetch 一次缓存到内存，genMathQuestion 同步读取
    let CMATH_POOL = null;        // { '1': [...], '2': [...] }
    let _cmathLoading = false;
    function _ensureCmathPool() {
        if (CMATH_POOL || _cmathLoading) return;
        _cmathLoading = true;
        fetch('data/math-cmath.json')
            .then(r => r.json())
            .then(d => { CMATH_POOL = d.grades || {}; _cmathLoading = false; })
            .catch(() => { _cmathLoading = false; });
    }

    function playSfx(name) {
        if (window.sfx && typeof window.sfx.play === 'function') window.sfx.play(name);
    }

    // 探索故事事件（数据驱动 data/stories/ 文件夹，每场景一个 json；fetch 失败回退硬编码 sceneEvents 兜底）
    const STORY_SCENE_IDS = ['forest', 'beach', 'mountain', 'space', 'candy', 'cave', 'waterfall', 'desert', 'underwater', 'castle', 'volcano', 'stargarden'];
    let _storiesLoaded = false;
    let _storiesLoadingPromise = null;
    async function _loadStories() {
        if (_storiesLoaded) return;
        if (_storiesLoadingPromise) return _storiesLoadingPromise;
        _storiesLoadingPromise = (async () => {
            try {
                const results = await Promise.all(STORY_SCENE_IDS.map(id => fetch(`data/stories/${id}.json`).then(r => r.json())));
                results.forEach((s, i) => {
                    if (s && s.events) sceneEvents[STORY_SCENE_IDS[i]] = s.events;
                    if (s && s.ending_text) SCENE_ENDING[STORY_SCENE_IDS[i]] = s.ending_text;
                });
                _storiesLoaded = true;
            } catch (e) {
                console.warn('stories folder load failed', e);
            } finally {
                _storiesLoadingPromise = null;
            }
        })();
        return _storiesLoadingPromise;
    }

    // 每个场景的探索事件序列（R1 单一源：data/stories/*.json 唯一正式源，_loadStories 加载填充）
    let sceneEvents = {};

    // galgame 立绘映射（场景 → 角色立绘图，Agnes 生图后填路径）
    const SCENE_CHAR_PORTRAIT = {
        forest: 'assets/characters/forest-mushroom-fairy.webp',
        beach: 'assets/characters/beach-captain-gull.webp',
        mountain: 'assets/characters/mountain-snow-wolf.webp',
        space: 'assets/characters/space-alien-guide.webp',
        candy: 'assets/characters/candy-princess.webp',
        cave: 'assets/characters/cave-crystal-guard.webp',
        waterfall: 'assets/characters/waterfall-frog-guide.webp',
        desert: 'assets/characters/desert-mummy-traveler.webp',
        underwater: 'assets/characters/underwater-mermaid.webp',
        castle: 'assets/characters/castle-library-ghost.webp',
        volcano: 'assets/characters/volcano-phoenix.webp',
        stargarden: 'assets/characters/stargarden-star-fox.webp',
    };

    // 显示探索页（galgame 风格：背景 + 左右立绘 + 底部对话框 + 推进）
    async function show(sceneId) {
        // 宠物小屋 R5 第二守卫（F1 兜底）：hp<=0 且已选宠 → 拦截
        if (window.PetSystem) {
            try {
                const s = PetSystem.getState();
                if (s.species && s.hp <= 0) {
                    if (typeof window.switchPage === 'function') window.switchPage('explore');
                    if (typeof window.showToast === 'function') {
                        window.showToast('宠物倒下了，先去宠物小屋救援吧');
                    } else {
                        alert('宠物倒下了，请先去宠物小屋救援！');
                    }
                    return;
                }
            } catch (e) {}
        }
        const scenes = ExplorationSystem.getAllScenes();
        currentScene = scenes.find(s => s.id === sceneId);
        if (!currentScene) return;
        await _loadStories();
        // 故事未加载(file://协议或fetch失败) → 明确提示，不再静默回退兜底（R1 单一源）
        if (!sceneEvents[currentScene.id]) {
            switchPage('explore');
            const pe = document.getElementById('page-explore');
            if (pe) pe.innerHTML = '<div style="padding:60px;text-align:center;color:#fbbf24;font-size:18px;line-height:1.8;">📖 故事加载失败<br><span style="font-size:14px;color:#888;">请用本地服务器打开：<code>python -m http.server 8000</code><br>然后访问 http://localhost:8000/</span></div>';
            currentScene = null;
            return;
        }
        eventIndex = 0;
        foundItems = [];
        _ensureCmathPool();  // 后台预加载应用题库（CMATH）

        switchPage('explore');

        const pageExplore = document.getElementById('page-explore');
        if (!pageExplore) return;
        if (pageExplore.innerHTML !== EXPLORE_ACTIVE_HTML) {
            pageExplore.innerHTML = EXPLORE_ACTIVE_HTML;
        }
        const el = document.getElementById('exploreContainer');
        if (!el) return;

        // galgame 框架：背景 + 左右立绘位 + 退出 + 底部对话框（点击推进）
        el.innerHTML = `
            <div class="galgame-stage" id="galgameStage">
                <div class="galgame-bg"><img src="${currentScene.image}" alt="${currentScene.name}"></div>
                <img class="galgame-portrait galgame-portrait-left" id="galgamePortraitL" style="display:none">
                <img class="galgame-portrait galgame-portrait-right" id="galgamePortraitR" src="${PetSystem.getCurrentStageImage ? PetSystem.getCurrentStageImage() : ''}" alt="宠物">
                <button class="galgame-back" onclick="ExplorationDetail.exit()">← 退出探索</button>
                <div class="galgame-box" id="galgameBox" onclick="ExplorationDetail.next()">
                    <div class="galgame-name" id="galgameName">${currentScene.emoji} ${currentScene.name}</div>
                    <div class="galgame-text" id="galgameText"></div>
                    <div class="galgame-choices" id="galgameChoices"></div>
                    <div class="galgame-next">▶</div>
                </div>
            </div>
        `;
        showNextEvent();
    }

    // 设置左侧角色立绘（场景对应角色）
    function setScenePortrait() {
        const img = document.getElementById('galgamePortraitL');
        if (!img) return;
        const p = SCENE_CHAR_PORTRAIT[currentScene.id];
        if (p) { img.src = p; img.style.display = ''; img.onerror = () => { img.style.display = 'none'; }; }
        else { img.style.display = 'none'; }
    }

    // 数学解谜出题（难度分级，自实现，不依赖 math-pk 闭包）
    // mathType: 'arithmetic'(裸算式,默认) | 'word'(CMATH 应用题) | 'logic'(找规律)
    // event: 可选，携带 R3 固定场景题(question/answer/options)时优先用
    function genMathQuestion(mathType, difficulty, event) {
        // R3 场景化：事件自带固定场景题优先（无则回退 arithmetic/word-CMATH/logic）
        if (event && event.question && event.answer != null) {
            return { text: event.question, answer: event.answer, options: event.options || genMathOptions(event.answer) };
        }
        // 应用题：从 CMATH 池按年级抽（池未就绪则回退算式，保证不阻塞）
        if (mathType === 'word' && CMATH_POOL) {
            const g = difficulty === 'easy' ? '1' : '2';
            const pool = CMATH_POOL[g] || CMATH_POOL['1'] || [];
            if (pool.length) {
                const q = pool[Math.floor(Math.random() * pool.length)];
                return { text: q.q, answer: q.a, options: q.opts };  // CMATH 自带选项
            }
        }
        // 逻辑题：找规律 / 等式平衡（思维启蒙，后段场景）
        if (mathType === 'logic') return genLogic();
        const d = difficulty || 'easy';
        const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
        const ops = d === 'easy' ? ['+', '-'] : d === 'medium' ? ['×', '×'] : ['×', '÷'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let a, b, answer;
        if (op === '+') { a = rand(5, 25); b = rand(5, 25); answer = a + b; }
        else if (op === '-') { a = rand(15, 40); b = rand(1, a - 1); answer = a - b; }
        else if (op === '×') { a = rand(2, 9); b = rand(2, 9); answer = a * b; }
        else { b = rand(2, 9); const q = rand(2, 9); a = b * q; answer = q; }
        return { text: `${a} ${op} ${b} = ?`, answer };
    }
    // 逻辑题：找规律（等差/倍数/斐波那契）/ 等式平衡，思维启蒙向（答案≤50）
    function genLogic() {
        const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
        const k = Math.random();
        if (k < 0.4) {                       // 等差
            const a0 = rand(1, 5), d = rand(2, 5);
            return { text: `找规律：${a0}, ${a0 + d}, ${a0 + 2 * d}, ${a0 + 3 * d}, ?`, answer: a0 + 4 * d };
        } else if (k < 0.65) {               // 倍数
            const a0 = rand(2, 4);
            return { text: `找规律：${a0}, ${a0 * 2}, ${a0 * 4}, ?`, answer: a0 * 8 };
        } else if (k < 0.85) {               // 斐波那契
            return { text: `找规律：1, 1, 2, 3, 5, ?`, answer: 8 };
        } else {                             // 等式平衡 ? + a = b
            const b = rand(10, 18), a = rand(2, 8);
            return { text: `猜一猜：? + ${a} = ${b}`, answer: b - a };
        }
    }
    function genMathOptions(answer) {
        const opts = new Set([answer]);
        while (opts.size < 4) {
            const v = answer + Math.floor(Math.random() * 7) - 3;
            if (v >= 0) opts.add(v);
        }
        return [...opts].sort(() => Math.random() - 0.5);
    }
    function answerMath(correct, exp, msg, hint, explanation) {
        const textEl = document.getElementById('galgameText');
        const choicesEl = document.getElementById('galgameChoices');
        const box = document.getElementById('galgameBox');
        if (!textEl) return;
        if (correct) {
            playSfx('mathCorrect');
            if (exp && window.PetSystem) PetSystem.addExp(exp);
            const parts = [`<span class="galgame-found">${msg || '答对了！'}</span>`];
            if (explanation) {
                parts.push(`<span class="galgame-explanation">解析：${explanation}</span>`);
            }
            textEl.innerHTML = parts.join('<br>');
        } else {
            playSfx('mathWrong');
            const parts = ['<span class="galgame-warn">这次记录还差一点点。</span>'];
            if (hint) {
                parts.push(`<span class="galgame-hint">提示：${hint}</span>`);
            } else {
                parts.push('<span class="galgame-warn">答错了……继续探索吧。</span>');
            }
            textEl.innerHTML = parts.join('<br>');
        }
        choicesEl.innerHTML = '';
        box.onclick = () => ExplorationDetail.next();
    }

    function showNextEvent() {
        const events = sceneEvents[currentScene.id] || [];
        if (eventIndex >= events.length) { triggerBattle(); return; }
        const event = events[eventIndex];
        const nameEl = document.getElementById('galgameName');
        const textEl = document.getElementById('galgameText');
        const choicesEl = document.getElementById('galgameChoices');
        const box = document.getElementById('galgameBox');
        if (!nameEl || !textEl) return;
        eventIndex++;
        choicesEl.innerHTML = '';
        box.onclick = () => ExplorationDetail.next();  // 默认点击对话框推进

        if (event.type === 'narrate') {
            nameEl.textContent = `${currentScene.emoji} ${currentScene.name}`;
            textEl.innerHTML = event.text;
            setScenePortrait();
        } else if (event.type === 'discover') {
            playSfx('discover');
            const found = !!(event.item && Math.random() < event.chance);
            nameEl.textContent = '✨ 发现';
            textEl.innerHTML = `<span style="font-size:28px">${event.emoji}</span> ${event.text}${found ? '<br><span class="galgame-found">✨ 获得物品！</span>' : ''}`;
            setScenePortrait();
            if (found) foundItems.push(event.item);
        } else if (event.type === 'choice') {
            nameEl.textContent = `${currentScene.emoji} ${currentScene.name}`;
            textEl.innerHTML = event.text;
            choicesEl.innerHTML = event.options.map((opt, i) =>
                `<button class="galgame-choice" onclick="event.stopPropagation();ExplorationDetail.choose(${eventIndex - 1},${i})">${opt.text}</button>`
            ).join('');
            box.onclick = null;  // choice 时禁点击推进，等选择
            eventIndex--;  // undo，等 choose 推进
            return;
        } else if (event.type === 'encounter') {
            playSfx('encounterWarning');
            nameEl.textContent = '⚠️ 遭遇';
            textEl.innerHTML = `<span class="galgame-warn">${event.text}</span><br>点击准备战斗！`;
        } else if (event.type === 'math') {
            const q = genMathQuestion(event.mathType || 'arithmetic', event.difficulty || 'easy', event);
            const opts = q.options || genMathOptions(q.answer);
            nameEl.textContent = '🔢 谜题';
            // R3: 固定场景题(长题面)用 galgame-word 样式, 仅裸算式保留 galgame-math
            const useWordStyle = !!event.question || event.mathType === 'word';
            const skillHtml = event.skill ? `<span class="galgame-skill">能力点：${event.skill}</span>` : '';
            const qHtml = `${event.text}${skillHtml ? `<br>${skillHtml}` : ''}<br><span class="${useWordStyle ? 'galgame-word' : 'galgame-math'}">${q.text}</span>`;
            const rewardMsg = JSON.stringify(event.reward?.msg || '');
            const hint = JSON.stringify(event.hint || '');
            const explanation = JSON.stringify(event.explanation || '');
            textEl.innerHTML = qHtml;
            choicesEl.innerHTML = opts.map(o =>
                `<button class="galgame-choice" onclick='event.stopPropagation();ExplorationDetail.answerMath(${o === q.answer}, ${event.reward?.exp || 0}, ${rewardMsg}, ${hint}, ${explanation})'>${o}</button>`
            ).join('');
            box.onclick = null;  // 等答题
            return;
        }
    }

    function choose(eventIdx, choiceIdx) {
        const events = sceneEvents[currentScene.id] || [];
        const event = events[eventIdx];
        if (!event) return;
        const choice = event.options[choiceIdx];
        const found = !!(choice.item && Math.random() < choice.chance);
        const textEl = document.getElementById('galgameText');
        const choicesEl = document.getElementById('galgameChoices');
        const box = document.getElementById('galgameBox');
        if (!textEl) return;
        playSfx('choiceConfirm');
        textEl.innerHTML = `<span class="galgame-reward">${choice.text}</span><br>${choice.reward}${found ? '<br><span class="galgame-found">✨ 获得物品！</span>' : ''}`;
        choicesEl.innerHTML = '';
        box.onclick = () => ExplorationDetail.next();  // 恢复点击推进
        if (found) foundItems.push(choice.item);
        eventIndex++;
    }

    function triggerBattle() {
        const result = ExplorationSystem.startExploration(currentScene.id);
        if (!result.success) {
            showToast(result.msg);
            exit();
            return;
        }
        // 给予发现的物品
        foundItems.forEach(itemId => {
            InventorySystem.addItem(itemId, 1);
        });
        if (foundItems.length > 0) {
            showToast(`探索中发现了 ${foundItems.length} 件物品！`);
        }

        if (result.battle) {
            playSfx('battleStart');
            const battle = ExplorationSystem.startBattle(result.battle.scene, result.battle.monster);
            showBattleModal(battle);
        } else {
            showToast(result.msg);
            exit();
        }
    }

    function next() {
        playSfx('dialogueNext');
        showNextEvent();  // galgame 单条推进（无堆叠，无需 disable）
    }

    function exit() {
        const sceneId = currentScene?.id;
        currentScene = null;
        eventIndex = 0;
        foundItems = [];

        const pageExplore = document.getElementById('page-explore');
        if (pageExplore) {
            if (window.ensureExploreMapShell) {
                window.ensureExploreMapShell();
            } else {
                pageExplore.innerHTML = EXPLORE_SHELL_HTML;
            }
            void renderExplorePage(sceneId);
            window.scrollTo(0, 0);
        }
    }

    // 场景结束叙事（"奖励→回家"，01 成功标准：进入感+结束感；先配 3 样板场景）
    let SCENE_ENDING = {};

    // 战斗胜利后显示结束叙事（点 ▶ 回场景列表），无结束语的场景直接 exit
    function showEnding() {
        const msg = currentScene && SCENE_ENDING[currentScene.id];
        const nameEl = document.getElementById('galgameName');
        const textEl = document.getElementById('galgameText');
        const box = document.getElementById('galgameBox');
        if (!msg || !nameEl || !textEl) { exit(); return; }
        document.getElementById('galgameChoices').innerHTML = '';
        nameEl.textContent = '🎉 冒险完成';
        textEl.innerHTML = `<span class="galgame-found">${msg}</span>`;
        box.onclick = () => ExplorationDetail.exit();
    }

    // 是否处于 galgame 探索中（战斗结束后判断要不要回场景列表）
    function isActive() { return currentScene != null; }

    _loadStories();  // 模块加载即预取 data/stories.json（数据驱动），show 用缓存/兜底

    return { show, next, choose, exit, answerMath, isActive, showEnding };
})();

window.ExplorationDetail = ExplorationDetail;
