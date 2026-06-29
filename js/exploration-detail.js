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

    function disableEventActions() {
        const actions = document.querySelectorAll('#exploreEvents .explore-continue-btn, #exploreEvents .explore-choice-btn');
        actions.forEach((action) => {
            action.disabled = true;
            action.style.pointerEvents = 'none';
            action.style.opacity = '0.6';
        });
    }

    // 每个场景的探索事件序列
    const sceneEvents = {
        forest: [
            { type: 'narrate', text: '你小心翼翼地走进森林，脚下的落叶发出沙沙的声音……' },
            { type: 'discover', emoji: '🍄', text: '你发现了一朵发光的蘑菇！轻轻摸了一下，它喷出了彩色的孢子。', item: 'mushroom', chance: 0.5 },
            { type: 'math', text: '一棵古树上刻着神秘算式，解开才能继续深入森林……', difficulty: 'easy', reward: { exp: 15, msg: '算式亮起金光，道路打开了！+15 经验' } },
            { type: 'choice', text: '前方出现了两条小路，一条传来流水声，另一条飘着花香。', options: [
                { text: '🌿 走流水小路', reward: '你在溪边发现了一片闪亮的树叶！', item: 'leaf', chance: 0.4 },
                { text: '🌸 走花香小路', reward: '花瓣间藏着一块小石头，上面刻着星星图案！', item: 'stone', chance: 0.3 }
            ]},
            { type: 'encounter', text: '草丛里窸窸窣窣，有什么东西在动……' }
        ],
        beach: [
            { type: 'narrate', text: '海浪轻轻拍打着你的脚丫，沙滩上散落着美丽的贝壳。' },
            { type: 'discover', emoji: '🐚', text: '你捡到了一个特别的贝壳，把它放在耳边，竟然听到了大海的秘密！', item: 'shell', chance: 0.6 },
            { type: 'choice', text: '一只海鸥叼着什么东西飞过，你决定——', options: [
                { text: '🏃 追上去看看', reward: '海鸥掉下了一根闪闪发光的羽毛！', item: 'feather', chance: 0.5 },
                { text: '🏖️ 继续在沙滩寻宝', reward: '你在沙子里挖出了一颗小珍珠！', item: 'pearl', chance: 0.2 }
            ]},
            { type: 'encounter', text: '突然，沙堡后面钻出了一个奇怪的身影……' }
        ],
        mountain: [
            { type: 'narrate', text: '寒风呼啸，雪花打在脸上有点冷，但远处的冰晶闪闪发光，好美！' },
            { type: 'discover', emoji: '❄️', text: '你在一块冰面上看到了奇怪的图案，看起来像是古代的地图！', item: 'ice_crystal', chance: 0.4 },
            { type: 'choice', text: '前面有个冰洞，里面传来微弱的蓝光。', options: [
                { text: '🔦 鼓起勇气走进去', reward: '冰洞深处有一块完美的冰晶，像钻石一样亮！', item: 'ice_crystal', chance: 0.6 },
                { text: '🏔️ 绕过冰洞爬上去', reward: '山顶上有一块柔软的雪狼毛！', item: 'fur', chance: 0.4 }
            ]},
            { type: 'encounter', text: '冰面突然裂开，一个白色的身影从雪中站了起来……' }
        ],
        space: [
            { type: 'narrate', text: '你飘浮在太空中，脚下是蓝色的地球，远处是无尽的星海。' },
            { type: 'discover', emoji: '✨', text: '一颗流星划过，你伸手抓住了它的尾巴——是星尘！', item: 'star_dust', chance: 0.5 },
            { type: 'choice', text: '空间站的通道分成了两条，左边写着"实验室"，右边写着"花园舱"。', options: [
                { text: '🧪 去实验室', reward: '你找到了一块外星高科技芯片！', item: 'alien_tech', chance: 0.5 },
                { text: '🌻 去花园舱', reward: '太空花的种子在发光，你小心地收集了一些！', item: 'space_rock', chance: 0.4 }
            ]},
            { type: 'encounter', text: '警报响起，雷达上出现了一个不明飞行物……' }
        ],
        candy: [
            { type: 'narrate', text: '空气中弥漫着草莓和巧克力的味道，脚下的路是饼干碎铺成的！' },
            { type: 'discover', emoji: '🍬', text: '路边有一棵棒棒糖树，你摇了摇，掉下来一颗彩虹糖！', item: 'candy', chance: 0.7 },
            { type: 'choice', text: '前面有个分岔路，一条通往巧克力河，一条通往棉花糖山。', options: [
                { text: '🍫 走巧克力河边', reward: '河水里漂着一块巧克力金币！', item: 'lollipop', chance: 0.5 },
                { text: '☁️ 爬棉花糖山', reward: '山顶有一块巨大的蛋糕碎片，散发着奶油香气！', item: 'cake_slice', chance: 0.4 }
            ]},
            { type: 'encounter', text: '棉花糖山后面跳出来一个圆滚滚的身影……' }
        ],
        cave: [
            { type: 'narrate', text: '洞穴入口闪烁着紫色的光芒，你深吸一口气走了进去。' },
            { type: 'discover', emoji: '💎', text: '地上有一块碎掉的水晶，但在微光中依然很美！', item: 'crystal_shard', chance: 0.6 },
            { type: 'choice', text: '洞穴分成了两条路，左边传来滴水声，右边飘着淡淡的花香。', options: [
                { text: '💧 走有水声的路', reward: '水滴汇聚成了一个小水晶池，你捞起了一颗发光的石子！', item: 'crystal_shard', chance: 0.5 },
                { text: '🌸 走有花香的路', reward: '一朵发光的蘑菇在等你，你轻轻摘下它！', item: 'glowing_mushroom', chance: 0.6 }
            ]},
            { type: 'encounter', text: '黑暗中，一双亮晶晶的眼睛正盯着你……' }
        ],
        waterfall: [
            { type: 'narrate', text: '水雾在阳光下画出了彩虹，你伸手去触碰，凉凉的，好舒服！' },
            { type: 'discover', emoji: '🌈', text: '水雾中飘浮着几滴发光的水珠，你用叶子接住了一滴！', item: 'rainbow_dew', chance: 0.5 },
            { type: 'choice', text: '你看到瀑布后面好像有个洞口，还有一只青蛙在荷叶上看着你。', options: [
                { text: '🐸 跟着青蛙走', reward: '青蛙带你找到了一片金色的荷叶！', item: 'golden_scale', chance: 0.3 },
                { text: '🕳️ 钻进瀑布后面的洞', reward: '洞里藏着一枚古代的圆形石币！', item: 'lily_pad', chance: 0.5 }
            ]},
            { type: 'encounter', text: '水面突然涌起巨大的水花，一个生物冒了出来……' }
        ],
        desert: [
            { type: 'narrate', text: '热浪在沙丘上方跳舞，但远处的绿洲给了你希望。' },
            { type: 'discover', emoji: '🦂', text: '沙子里露出了一个古老的铜币，上面刻着你从未见过的文字！', item: 'sand_shell', chance: 0.5 },
            { type: 'choice', text: '你在一块巨石上发现了奇怪的壁画，旁边有两条路。', options: [
                { text: '🎨 研究壁画再走', reward: '壁画后面藏着一颗沙漠珍珠！', item: 'desert_pearl', chance: 0.2 },
                { text: '🏜️ 直接去绿洲', reward: '绿洲的泉水边有一颗闪亮的甲虫壳！', item: 'ancient_bandage', chance: 0.5 }
            ]},
            { type: 'encounter', text: '沙丘后面缓缓升起了一个缠着绷带的身影……' }
        ],
        underwater: [
            { type: 'narrate', text: '你沉入海底，周围是五彩缤纷的珊瑚，小鱼好奇地围着你转。' },
            { type: 'discover', emoji: '🪼', text: '一只透明的水母飘过，它身上发出柔和的蓝光，好漂亮！', item: 'glow_jelly', chance: 0.6 },
            { type: 'choice', text: '前方有一个珊瑚迷宫，左边有洋流，右边看起来很安静。', options: [
                { text: '🌊 顺着洋流游', reward: '洋流把你带到了一个沉没的宝箱旁，找到了一颗鲨鱼牙！', item: 'shark_tooth', chance: 0.4 },
                { text: '🤿 穿过安静的路', reward: '珊瑚丛中藏着一袋墨鱼的墨囊！', item: 'ink_sac', chance: 0.5 }
            ]},
            { type: 'encounter', text: '珊瑚丛后面闪过一道黑影，越来越大……' }
        ],
        castle: [
            { type: 'narrate', text: '你踏上彩虹桥，每走一步桥就发出叮叮咚咚的音乐声。' },
            { type: 'discover', emoji: '⚔️', text: '桥头有一把生锈的小剑，但你擦了擦，它竟然闪起了金光！', item: 'knight_shield', chance: 0.4 },
            { type: 'choice', text: '城堡大门开着，里面左边是图书馆，右边是武器室。', options: [
                { text: '📚 去图书馆', reward: '一本旧书里掉出了一张魔法卷轴！', item: 'magic_wand', chance: 0.3 },
                { text: '🛡️ 去武器室', reward: '墙上挂着一片幼龙的鳞片，闪闪发光！', item: 'dragon_scale', chance: 0.4 }
            ]},
            { type: 'encounter', text: '楼梯上传来沉重的脚步声，越来越近……' }
        ],
        volcano: [
            { type: 'narrate', text: '温暖的空气包裹着你，岩浆像橙色的河流缓缓流淌。' },
            { type: 'discover', emoji: '🔥', text: '路边有一块冷却的岩浆石，掰开后里面竟然有火红色的晶体质！', item: 'fire_scale', chance: 0.5 },
            { type: 'choice', text: '前方有个温泉池，旁边有条小路通向火山口。', options: [
                { text: '♨️ 在温泉休息一下', reward: '温泉水底有一块温热的水晶！', item: 'lava_crystal', chance: 0.5 },
                { text: '🌋 爬向火山口', reward: '火山口边缘有一根脱落的凤凰羽毛！', item: 'phoenix_feather', chance: 0.2 }
            ]},
            { type: 'encounter', text: '岩浆里冒出了泡泡，一个火红色的身影浮了上来……' }
        ],
        stargarden: [
            { type: 'narrate', text: '你踩在发光的苔藓上，每一步都留下星光般的脚印。' },
            { type: 'discover', emoji: '🌟', text: '一朵花悄悄绽放，花蕊里有一颗小小的星星！', item: 'star_dust', chance: 0.6 },
            { type: 'choice', text: '花园中间有一棵月亮树，树上挂满了发光的灯笼。', options: [
                { text: '🌕 摘一个月亮灯笼', reward: '灯笼里面装满了星尘！', item: 'star_fragment', chance: 0.3 },
                { text: '🦊 跟着星狐的脚印走', reward: '脚印尽头有一块月亮形状的糕点！', item: 'moon_cake', chance: 0.4 }
            ]},
            { type: 'encounter', text: '星座图案突然在空中亮起，一个身影从星光中走了出来……' }
        ]
    };

    // galgame 立绘映射（场景 → 角色立绘图，Agnes 生图后填路径）
    const SCENE_CHAR_PORTRAIT = {
        forest: 'assets/characters/forest-mushroom-fairy.png',
        beach: 'assets/characters/beach-captain-gull.png',
        mountain: 'assets/characters/mountain-snow-wolf.png',
        space: 'assets/characters/space-alien-guide.png',
        candy: 'assets/characters/candy-princess.png',
        cave: 'assets/characters/cave-crystal-guard.png',
        waterfall: 'assets/characters/waterfall-frog-guide.png',
        desert: 'assets/characters/desert-mummy-traveler.png',
        underwater: 'assets/characters/underwater-mermaid.png',
        castle: 'assets/characters/castle-library-ghost.png',
        volcano: 'assets/characters/volcano-phoenix.png',
        stargarden: 'assets/characters/stargarden-star-fox.png',
    };

    // 显示探索页（galgame 风格：背景 + 左右立绘 + 底部对话框 + 推进）
    function show(sceneId) {
        // 宠物小屋 R5 第二守卫（F1 兜底）：hp<=0 且已选宠 → 拦截
        if (window.PetSystem) {
            try {
                const s = PetSystem.getState();
                if (s.species && s.hp <= 0) {
                    alert('宠物倒下了，请先去宠物小屋救援！');
                    return;
                }
            } catch (e) {}
        }
        const scenes = ExplorationSystem.getAllScenes();
        currentScene = scenes.find(s => s.id === sceneId);
        if (!currentScene) return;
        eventIndex = 0;
        foundItems = [];

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
    function genMathQuestion(difficulty) {
        const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
        const ops = difficulty === 'easy' ? ['+', '-'] : difficulty === 'medium' ? ['×', '×'] : ['×', '÷'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let a, b, answer;
        if (op === '+') { a = rand(5, 25); b = rand(5, 25); answer = a + b; }
        else if (op === '-') { a = rand(15, 40); b = rand(1, a - 1); answer = a - b; }
        else if (op === '×') { a = rand(2, 9); b = rand(2, 9); answer = a * b; }
        else { b = rand(2, 9); const q = rand(2, 9); a = b * q; answer = q; }
        return { text: `${a} ${op} ${b} = ?`, answer };
    }
    function genMathOptions(answer) {
        const opts = new Set([answer]);
        while (opts.size < 4) {
            const v = answer + Math.floor(Math.random() * 7) - 3;
            if (v >= 0) opts.add(v);
        }
        return [...opts].sort(() => Math.random() - 0.5);
    }
    function answerMath(correct, exp, msg) {
        const textEl = document.getElementById('galgameText');
        const choicesEl = document.getElementById('galgameChoices');
        const box = document.getElementById('galgameBox');
        if (!textEl) return;
        if (correct) {
            if (exp && window.PetSystem) PetSystem.addExp(exp);
            textEl.innerHTML = `<span class="galgame-found">${msg || '答对了！'}</span>`;
        } else {
            textEl.innerHTML = `<span class="galgame-warn">答错了……继续探索吧。</span>`;
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
            nameEl.textContent = '⚠️ 遭遇';
            textEl.innerHTML = `<span class="galgame-warn">${event.text}</span><br>点击准备战斗！`;
        } else if (event.type === 'math') {
            const q = genMathQuestion(event.difficulty || 'easy');
            const opts = genMathOptions(q.answer);
            nameEl.textContent = '🔢 谜题';
            textEl.innerHTML = `${event.text}<br><span class="galgame-math">${q.text}</span>`;
            choicesEl.innerHTML = opts.map(o =>
                `<button class="galgame-choice" onclick="event.stopPropagation();ExplorationDetail.answerMath(${o === q.answer}, ${event.reward?.exp || 0}, '${(event.reward?.msg || '').replace(/'/g, "\\'")}')">${o}</button>`
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
            const battle = ExplorationSystem.startBattle(result.battle.scene, result.battle.monster);
            showBattleModal(battle);
        } else {
            showToast(result.msg);
            exit();
        }
    }

    function next() {
        showNextEvent();  // galgame 单条推进（无堆叠，无需 disable）
    }

    function exit() {
        const sceneId = currentScene?.id;
        currentScene = null;
        eventIndex = 0;
        foundItems = [];

        const pageExplore = document.getElementById('page-explore');
        if (pageExplore) {
            pageExplore.innerHTML = EXPLORE_SHELL_HTML;
            void renderExplorePage(sceneId);
            window.scrollTo(0, 0);
        }
    }

    return { show, next, choose, exit, answerMath };
})();

window.ExplorationDetail = ExplorationDetail;
