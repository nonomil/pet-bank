(function (global) {
    'use strict';

    const PACK_ID = 'english-mc-hybrid-2026';
    const MODULE_ID = 'minecraft-vocab';
    const VISUAL_ROOT = 'assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/';
    const HERO_IMAGE = `${VISUAL_ROOT}study-camp-hero.png`;
    const STAGE_IMAGES = {
        review: `${VISUAL_ROOT}warmup-grove.png`,
        new: `${VISUAL_ROOT}new-word-mine.png`,
        recall: `${VISUAL_ROOT}recall-bridge.png`,
        scene: `${VISUAL_ROOT}scene-village.png`
    };
    const STAGE_THUMBS = {
        warmup: `${VISUAL_ROOT}warmup-grove.png`,
        new: `${VISUAL_ROOT}new-word-mine.png`,
        recall: `${VISUAL_ROOT}recall-bridge.png`,
        scene: `${VISUAL_ROOT}scene-village.png`
    };
    const REWARD_IMAGE = `${VISUAL_ROOT}reward-word-stars.png`;
    const EXPEDITION_FALLBACK_IMAGE = 'assets/learn/english-vocab/generated/minecraft-expedition/grassland-trail.png';
    const CARD_FRAME_IMAGE = `${VISUAL_ROOT}card-frame-sheet.png`;
    const UI_ASSET_ROOT = 'assets/learn/english-vocab/generated/minecraft-vocab-ui-pack/';
    const STAGE_BADGE_IMAGES = {
        warmup: `${UI_ASSET_ROOT}stage-warmup.png`,
        new: `${UI_ASSET_ROOT}stage-new-word.png`,
        recall: `${UI_ASSET_ROOT}stage-recall.png`,
        scene: `${UI_ASSET_ROOT}stage-scene.png`
    };
    const REWARD_CHEST_IMAGE = `${UI_ASSET_ROOT}reward-chest.png`;
    const REWARD_STAR_IMAGE = `${UI_ASSET_ROOT}reward-star.png`;
    const COMPANION_IMAGE = `${UI_ASSET_ROOT}learning-companion.png`;
    const CARD_CORNER_IMAGES = {
        tl: `${UI_ASSET_ROOT}card-corner-tl.png`,
        tr: `${UI_ASSET_ROOT}card-corner-tr.png`,
        bl: `${UI_ASSET_ROOT}card-corner-bl.png`,
        br: `${UI_ASSET_ROOT}card-corner-br.png`
    };
    const LEVEL_STORAGE_PREFIX = 'petbank_minecraft_vocab_level_v1';
    const BAND_STORAGE_PREFIX = 'petbank_minecraft_vocab_band_v1';

    let mounted = false;
    let root = null;
    let module = null;
    let expedition = null;
    let expeditionState = null;
    let selectedRegionId = '';
    let state = null;
    let view = 'home';
    let revealed = false;
    let flipped = false;
    let feedback = '';
    let rewardResult = null;
    let audio = null;
    let progressOpen = false;
    let hintUsed = false;
    let selectedLevelId = 'kindergarten';
    let selectedBandId = 'minecraft-core';
    let pageGeneration = 0;
    let selectionRequestId = 0;

    function isCurrentGeneration(generation) {
        return mounted && generation === pageGeneration;
    }

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function asset(path) {
        if (/^(?:[a-z]+:)?\/\//i.test(path) || /^(?:data|blob):/i.test(path)) return path;
        if (global.PetBankRuntime && typeof global.PetBankRuntime.resolveAssetUrl === 'function') {
            return global.PetBankRuntime.resolveAssetUrl(path);
        }
        return path;
    }

    function cssImage(path) {
        return `url("${String(asset(path)).replace(/"/g, '%22')}")`;
    }

    function cards() {
        return Array.isArray(module?.cards) ? module.cards : [];
    }

    function levelsApi() {
        return global.MinecraftVocabLevels || null;
    }

    function profileId() {
        try {
            return String(global.ProfileManager?.getActiveId?.() || 'default');
        } catch (error) {
            return 'default';
        }
    }

    function levelStorageKey() {
        return `${LEVEL_STORAGE_PREFIX}_${profileId()}`;
    }

    function readSelectedLevel() {
        const fallback = levelsApi()?.DEFAULT_LEVEL_ID || 'kindergarten';
        try {
            return levelsApi()?.normalizeLevelId(global.localStorage?.getItem(levelStorageKey()) || fallback) || fallback;
        } catch (error) {
            console.warn('[MinecraftVocabPage] failed to read level selection', error);
            return fallback;
        }
    }

    function saveSelectedLevel(levelId) {
        const normalized = levelsApi()?.normalizeLevelId(levelId) || 'kindergarten';
        selectedLevelId = normalized;
        try {
            global.localStorage?.setItem(levelStorageKey(), normalized);
            return true;
        } catch (error) {
            console.warn('[MinecraftVocabPage] failed to save level selection', error);
            return false;
        }
    }

    function bandStorageKey() {
        return `${BAND_STORAGE_PREFIX}_${profileId()}`;
    }

    function readSelectedBand() {
        const fallback = levelsApi()?.DEFAULT_MINECRAFT_BAND_ID || 'minecraft-core';
        try {
            return levelsApi()?.normalizeBandId(global.localStorage?.getItem(bandStorageKey()) || fallback) || fallback;
        } catch (error) {
            console.warn('[MinecraftVocabPage] failed to read Minecraft band selection', error);
            return fallback;
        }
    }

    function saveSelectedBand(bandId) {
        const normalized = levelsApi()?.normalizeBandId(bandId) || 'minecraft-core';
        selectedBandId = normalized;
        try {
            global.localStorage?.setItem(bandStorageKey(), normalized);
            return true;
        } catch (error) {
            console.warn('[MinecraftVocabPage] failed to save Minecraft band selection', error);
            return false;
        }
    }

    function currentLevel() {
        return levelsApi()?.get(selectedLevelId) || { id: selectedLevelId, label: selectedLevelId, description: '' };
    }

    function currentBand() {
        return levelsApi()?.getBand?.(selectedBandId) || { id: selectedBandId, label: selectedBandId, description: '' };
    }

    function cardsForLevel() {
        return levelsApi()?.filterCards(cards(), selectedLevelId, selectedLevelId === 'minecraft' ? selectedBandId : '') || cards();
    }

    function regionList() {
        return Array.isArray(expedition?.regions) ? expedition.regions : [];
    }

    function regionForId(regionId) {
        return regionList().find(region => region.id === regionId) || null;
    }

    function missionForRegion(regionId) {
        const region = regionForId(regionId);
        return region?.mission || region?.missions?.[0] || null;
    }

    function cardsForRegion(regionId) {
        const mission = missionForRegion(regionId);
        const ids = new Set(mission?.cardIds || []);
        return cards().filter(card => ids.has(card.id));
    }

    function activeQueueCards() {
        return selectedRegionId ? cardsForRegion(selectedRegionId) : cardsForLevel();
    }

    function progressApi() {
        return global.EnglishVocabProgress || null;
    }

    function stats() {
        const activeCards = activeQueueCards();
        const result = progressApi()?.stats?.(activeCards);
        return result || { total: activeCards.length, new: activeCards.length, learning: 0, mastered: 0, due: 0 };
    }

    function cardForTask(task) {
        return cards().find(card => card.id === task?.cardId) || null;
    }

    function currentTask() {
        return state?.queue?.find(item => !state.completed.includes(item.cardId)) || null;
    }

    function currentRegion() {
        return regionForId(selectedRegionId || state?.regionId || '');
    }

    function resolveDataUrl(path) {
        return global.PetBankRuntime && typeof global.PetBankRuntime.resolveAssetUrl === 'function'
            ? global.PetBankRuntime.resolveAssetUrl(path)
            : path;
    }

    function cardImage(card) {
        const image = String(card?.image || '');
        return /^(?:assets|prj\/anki-minecraft-vocab)\//.test(image) ? asset(image) : '';
    }

    function cardBackImage(card) {
        const image = String(card?.backImage || '');
        return /^(?:assets|prj\/anki-minecraft-vocab)\//.test(image) ? asset(image) : '';
    }

    function fallbackBackImage(card) {
        const text = `${card?.word || ''} ${card?.translation || ''} ${card?.sentence || ''}`.toLowerCase();
        if (/lava|nether|blaze|fire|熔岩|下界|烈焰|火/.test(text)) return 'assets/learn/english-vocab/generated/minecraft-expedition/nether-portal.png';
        if (/dragon|ender|portal|末影|传送门|龙/.test(text)) return 'assets/learn/english-vocab/generated/minecraft-expedition/ender-dragon-arena.png';
        if (/mine|ore|diamond|pickaxe|torch|stone|矿|钻石|镐|火把|石/.test(text)) return 'assets/learn/english-vocab/generated/minecraft-expedition/deep-mine.png';
        if (/village|house|tree|campfire|村庄|房子|树|营火/.test(text)) return 'assets/learn/english-vocab/generated/minecraft-expedition/village-gate.png';
        return EXPEDITION_FALLBACK_IMAGE;
    }

    function fallbackCardVisual(card) {
        const category = String(card?.category || 'item').toLowerCase();
        const categoryLabels = {
            block: '方块',
            mob: '生物',
            biome: '生物群系',
            structure: '结构',
            tool: '工具',
            weapon: '武器',
            food: '食物',
            plant: '植物',
            color: '颜色',
            effect: '状态效果',
            advancement: '进度',
            item: '物品'
        };
        return `<div class="mv-card-image-placeholder mv-card-text-visual" data-mv-card-image-fallback data-mv-category="${escapeHtml(category)}">
            <span class="mv-card-text-pixel" aria-hidden="true"></span>
            <small>文字词卡 · ${escapeHtml(categoryLabels[category] || 'Minecraft')}</small>
            <strong>${escapeHtml(card?.word || 'Minecraft')}</strong>
            <em>${escapeHtml(card?.translation || '')}</em>
        </div>`;
    }

    function cardAudio(card, key = 'word') {
        const narration = card?.narrationAudio || {};
        const audioPath = String(narration[key] || (key === 'word' ? card?.audio : '') || '');
        if (!/^(?:assets|prj\/anki-minecraft-vocab)\//.test(audioPath)) return '';
        return global.MinecraftVocabAudio?.getUrl?.(audioPath) || asset(audioPath);
    }

    function cardText(card, key) {
        const aliases = {
            sentence: ['sentence', 'example'],
            sentenceTranslation: ['sentenceTranslation', 'exampleZh', 'exampleTranslation']
        };
        return (aliases[key] || [key]).map(field => String(card?.[field] || '').trim()).find(Boolean) || '';
    }

    function pronunciation(card) {
        return String(card?.phonetic || '').trim() || '点击喇叭听发音';
    }

    function fallbackChoices(card) {
        const words = activeQueueCards().map(item => item.word).filter(Boolean);
        return [...new Set([card?.word, ...(card?.distractors || []), ...words])]
            .filter(Boolean)
            .slice(0, 4);
    }

    function stageLabel(mode) {
        return {
            review: '复习热身',
            new: '新词输入',
            recall: '主动回忆',
            scene: '场景句'
        }[mode] || '单词任务';
    }

    function stageSummary() {
        return [
            { key: 'warmup', label: '热身', detail: '2 张', count: 2 },
            { key: 'new', label: '新词', detail: '5 张', count: 5 },
            { key: 'recall', label: '回忆', detail: '3 张', count: 3 },
            { key: 'scene', label: '场景', detail: '1 句', count: 1 }
        ];
    }

    function completedCount() {
        return state?.completed?.length || 0;
    }

    function renderShell(content, generation = pageGeneration) {
        if (!root || !isCurrentGeneration(generation)) return;
        root.innerHTML = `<div class="minecraft-vocab-page" data-minecraft-vocab-page style="--mv-card-frame: ${escapeHtml(cssImage(CARD_FRAME_IMAGE))}; --mv-corner-tl: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.tl))}; --mv-corner-tr: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.tr))}; --mv-corner-bl: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.bl))}; --mv-corner-br: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.br))}">${content}</div>`;
        bindEvents();
        if (global.lucide && typeof global.lucide.createIcons === 'function') global.lucide.createIcons();
        root.querySelectorAll('[data-mv-card-image], [data-mv-back-image], [data-mv-expedition-image], [data-mv-story-image]').forEach(image => {
            image.addEventListener('error', () => {
                const placeholder = document.createElement('div');
                placeholder.className = 'mv-card-image-placeholder mv-card-text-visual';
                placeholder.textContent = image.dataset.mvExpeditionImage ? '地图待补' : image.dataset.mvStoryImage ? '故事图待补' : image.dataset.mvBackImage ? '场景图待补' : '图片待补';
                image.replaceWith(placeholder);
            }, { once: true });
        });
    }

    function renderHeader(title, kicker = '学习 / Minecraft 单词') {
        const isSessionHeader = view === 'session';
        return `
            <header class="minecraft-vocab-header">
                <button class="mv-icon-button" type="button" data-mv-back aria-label="返回学习中心" title="返回学习中心"><i data-lucide="arrow-left" aria-hidden="true"></i></button>
                <div>
                    <span class="mv-eyebrow">${escapeHtml(kicker)}</span>
                    <h1>${escapeHtml(title)}</h1>
                </div>
                ${isSessionHeader ? `<button class="mv-points-badge mv-progress-toggle" type="button" data-mv-toggle-progress aria-expanded="${progressOpen ? 'true' : 'false'}" aria-controls="mvProgressPanel" aria-label="查看今日学习进度">
                    <i data-lucide="sparkles" aria-hidden="true"></i>
                    <span data-mv-progress>${completedCount()} / ${state?.queue?.length || 11}</span>
                    <small>进度</small>
                </button>` : `<div class="mv-points-badge" aria-label="今日完成任务">
                    <i data-lucide="sparkles" aria-hidden="true"></i>
                    <span data-mv-progress>${completedCount()} / ${state?.queue?.length || 11}</span>
                </div>`}
            </header>
        `;
    }

    function renderStageTrack() {
        return `
            <div class="mv-stage-track" aria-label="今日学习节奏">
                ${stageSummary().map((stage, index) => `
                    <div class="mv-stage${completedCount() >= [2, 7, 10, 11][index] ? ' is-done' : ''}" data-mv-stage="${stage.key}" style="--mv-stage-thumb: ${escapeHtml(cssImage(STAGE_THUMBS[stage.key]))}; --mv-stage-badge: ${escapeHtml(cssImage(STAGE_BADGE_IMAGES[stage.key]))}">
                        <span class="mv-stage-index">${index + 1}</span>
                        <strong>${stage.label}</strong>
                        <small>${stage.detail}</small>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderTaskDots() {
        return `<div class="mv-task-dots" aria-label="今日 11 个任务">
            ${(state?.queue || Array.from({ length: 11 }, (_, index) => ({ cardId: '', mode: 'new', index }))).map((item, index) => `
                <span class="mv-task-dot${state?.completed?.includes(item.cardId) ? ' is-done' : ''}" data-mv-task-dot title="${escapeHtml(stageLabel(item.mode))} ${index + 1}">${state?.completed?.includes(item.cardId) ? '<i data-lucide="check" aria-hidden="true"></i>' : index + 1}</span>
            `).join('')}
        </div>`;
    }

    function renderProgressSidebar(currentStats = stats()) {
        const totalTasks = state?.queue?.length || 11;
        const done = completedCount();
        const percent = totalTasks ? Math.round((done / totalTasks) * 100) : 0;
        const current = currentTask();
        const currentStage = current ? stageLabel(current.mode) : '今日远征已完成';
        const stageSteps = [
            { key: 'warmup', label: '热身复习', detail: '唤醒熟悉的词', limit: 2 },
            { key: 'new', label: '新词矿洞', detail: '认识 5 个新词', limit: 7 },
            { key: 'recall', label: '回忆桥', detail: '主动说出英文', limit: 10 },
            { key: 'scene', label: '村庄对话', detail: '把词放进句子', limit: 11 }
        ];
        return `
            <aside class="mv-progress-sidebar" aria-label="今日学习汇总">
                <div class="mv-sidebar-heading">
                    <div>
                        <span class="mv-sidebar-kicker">今日远征</span>
                        <h2>学习进度</h2>
                    </div>
                    <span class="mv-sidebar-streak" title="今日完成任务"><i data-lucide="flame" aria-hidden="true"></i>${done}</span>
                </div>
                <div class="mv-progress-meter" style="--mv-progress: ${percent}%">
                    <strong>${percent}%</strong>
                    <span>完成今日路线</span>
                </div>
                <div class="mv-progress-count"><strong>${done}</strong><span>/ ${totalTasks} 张卡片</span></div>
                <div class="mv-current-stage"><span>现在进行</span><strong>${escapeHtml(currentStage)}</strong></div>
                <ol class="mv-sidebar-stages">
                    ${stageSteps.map(stage => {
                        const isDone = done >= stage.limit;
                        const isActive = !isDone && (stage.limit === 2 || done >= stage.limit - (stage.key === 'new' ? 5 : stage.key === 'recall' ? 3 : 1));
                        return `<li class="${isDone ? 'is-done' : ''}${isActive ? ' is-active' : ''}">
                            <span class="mv-sidebar-stage-icon" style="--mv-stage-icon: ${escapeHtml(cssImage(STAGE_BADGE_IMAGES[stage.key]))}">${isDone ? '<i data-lucide="check" aria-hidden="true"></i>' : ''}</span>
                            <span><strong>${stage.label}</strong><small>${stage.detail}</small></span>
                            <em>${isDone ? '完成' : `${Math.min(done, stage.limit)}/${stage.limit}`}</em>
                        </li>`;
                    }).join('')}
                </ol>
                <div class="mv-sidebar-stats">
                    <div><span>词库</span><strong>${Number(currentStats.total || 0).toLocaleString('zh-CN')}</strong></div>
                    <div><span>已掌握</span><strong>${Number(currentStats.mastered || 0).toLocaleString('zh-CN')}</strong></div>
                    <div><span>今日奖励</span><strong>+10</strong></div>
                </div>
                ${done < totalTasks ? `<button class="mv-sidebar-start" type="button" data-mv-start><i data-lucide="play" aria-hidden="true"></i><span>${done ? '继续学习' : '开始学习'}</span></button>` : ''}
            </aside>
        `;
    }

    function renderProgressPanel(currentStats = stats()) {
        const totalTasks = state?.queue?.length || 11;
        const done = completedCount();
        const percent = totalTasks ? Math.round((done / totalTasks) * 100) : 0;
        const current = currentTask();
        const currentStage = current ? stageLabel(current.mode) : '今日远征已完成';
        const stageSteps = [
            { key: 'warmup', label: '热身复习', detail: '唤醒熟悉的词', limit: 2 },
            { key: 'new', label: '新词矿洞', detail: '认识 5 个新词', limit: 7 },
            { key: 'recall', label: '回忆桥', detail: '主动说出英文', limit: 10 },
            { key: 'scene', label: '村庄对话', detail: '把词放进句子', limit: 11 }
        ];
        return `
            <section class="mv-progress-panel" id="mvProgressPanel" data-mv-progress-panel data-open="${progressOpen ? 'true' : 'false'}" aria-label="学习进度详情">
                <div class="mv-sidebar-heading">
                    <div><span class="mv-sidebar-kicker">今日远征</span><h2>学习进度</h2></div>
                    <span class="mv-sidebar-streak" title="今日完成任务"><i data-lucide="flame" aria-hidden="true"></i>${done}</span>
                </div>
                <div class="mv-progress-meter" style="--mv-progress: ${percent}%"><strong>${percent}%</strong><span>完成今日路线</span></div>
                <div class="mv-progress-count"><strong>${done}</strong><span>/ ${totalTasks} 张卡片</span></div>
                <div class="mv-current-stage"><span>现在进行</span><strong>${escapeHtml(currentStage)}</strong></div>
                <ol class="mv-sidebar-stages">
                    ${stageSteps.map(stage => {
                        const isDone = done >= stage.limit;
                        const isActive = !isDone && (stage.limit === 2 || done >= stage.limit - (stage.key === 'new' ? 5 : stage.key === 'recall' ? 3 : 1));
                        return `<li class="${isDone ? 'is-done' : ''}${isActive ? ' is-active' : ''}">
                            <span class="mv-sidebar-stage-icon" style="--mv-stage-icon: ${escapeHtml(cssImage(STAGE_BADGE_IMAGES[stage.key]))}">${isDone ? '<i data-lucide="check" aria-hidden="true"></i>' : ''}</span>
                            <span><strong>${stage.label}</strong><small>${stage.detail}</small></span>
                            <em>${isDone ? '完成' : `${Math.min(done, stage.limit)}/${stage.limit}`}</em>
                        </li>`;
                    }).join('')}
                </ol>
                <div class="mv-sidebar-stats">
                    <div><span>词库</span><strong>${Number(currentStats.total || 0).toLocaleString('zh-CN')}</strong></div>
                    <div><span>已掌握</span><strong>${Number(currentStats.mastered || 0).toLocaleString('zh-CN')}</strong></div>
                    <div><span>今日奖励</span><strong>+10</strong></div>
                </div>
            </section>
        `;
    }

    function renderCardPreview(card) {
        if (!card) return '<div class="mv-card-preview-empty">准备下一张词卡...</div>';
        return `
            <article class="mv-card-preview">
                <div class="mv-card-preview-art">${cardImage(card) ? `<img src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(card.word || 'Minecraft 词卡')}" loading="lazy" decoding="async">` : fallbackCardVisual(card)}</div>
                <div class="mv-card-preview-copy">
                    <span class="mv-sidebar-kicker">下一张词卡</span>
                    <h3>${escapeHtml(card.word || '')}</h3>
                    <p>${escapeHtml(card.translation || '先在学习中揭晓释义')}</p>
                    <span class="mv-card-preview-note"><i data-lucide="volume-2" aria-hidden="true"></i>可听发音 · 可看短语 · 可练场景句</span>
                </div>
            </article>
        `;
    }

    function renderLevelPicker(currentStats = stats()) {
        const levelList = levelsApi()?.list?.() || [];
        const selected = currentLevel();
        const selectedBand = currentBand();
        const minecraftTotal = levelsApi()?.filterCards(cards(), 'minecraft').filter(card => levelsApi()?.cardLevel(card) === 'minecraft').length || 0;
        return `
            <section class="mv-level-picker" aria-labelledby="mvLevelPickerTitle">
                <div class="mv-level-picker-copy">
                    <span class="mv-kicker">词库设置 · Learning Stage</span>
                    <h2 id="mvLevelPickerTitle">${escapeHtml(selected.label)}${selectedLevelId === 'minecraft' ? ` · ${escapeHtml(selectedBand.label)}` : ''} <small>${escapeHtml(selectedLevelId === 'minecraft' ? selectedBand.labelEn : selected.labelEn || '')}</small></h2>
                    <p>${escapeHtml(selectedLevelId === 'minecraft' ? `${selectedBand.description} Minecraft 初级共 ${minecraftTotal.toLocaleString('zh-CN')} 张，当前待复习 ${Number(currentStats.due || 0).toLocaleString('zh-CN')} 张，先从当前层级随机抽取。` : selected.description || '')}</p>
                </div>
                <div class="mv-level-options" role="radiogroup" aria-label="选择单词学习阶段">
                    ${levelList.map(level => {
                        const count = levelsApi()?.filterCards(cards(), level.id).length || 0;
                        const isSelected = level.id === selectedLevelId;
                        return `<button class="mv-level-option${isSelected ? ' is-selected' : ''}" type="button" role="radio" aria-checked="${isSelected ? 'true' : 'false'}" data-mv-level="${escapeHtml(level.id)}">
                            <strong>${escapeHtml(level.label)}</strong><small>${Number(count).toLocaleString('zh-CN')} 张</small>
                        </button>`;
                        }).join('')}
                </div>
                ${selectedLevelId === 'minecraft' ? `<div class="mv-band-picker" role="radiogroup" aria-label="选择 Minecraft 初级内部层级">
                    ${levelsApi()?.minecraftBands?.().map(band => {
                        const count = levelsApi()?.filterCards(cards(), 'minecraft', band.id).length || 0;
                        const isSelected = band.id === selectedBandId;
                        return `<button class="mv-level-option mv-band-option${isSelected ? ' is-selected' : ''}" type="button" role="radio" aria-checked="${isSelected ? 'true' : 'false'}" data-mv-band="${escapeHtml(band.id)}">
                            <strong>${escapeHtml(band.label)}</strong><small>${Number(count).toLocaleString('zh-CN')} 张</small>
                        </button>`;
                    }).join('') || ''}
                </div>` : ''}
            </section>
        `;
    }

    function regionLevelAllowed(region) {
        const required = String(region?.minVocabLevel || '').trim();
        if (!required || !levelsApi()) return true;
        const selected = levelsApi().get(selectedLevelId);
        const minimum = levelsApi().get(required);
        return !selected || !minimum || selected.rank >= minimum.rank;
    }

    function renderCampMap() {
        const summary = global.MinecraftVocabExpedition?.getSummary(expeditionState) || { cleared: 0, total: regionList().length, percent: 0, level: 1, experience: 0, inventory: [] };
        return `
            <section class="mv-camp-map" aria-labelledby="mvCampMapTitle">
                <div class="mv-camp-map-heading"><div><span class="mv-kicker">冒险地图 · Adventure Map</span><h2 id="mvCampMapTitle">${escapeHtml(expedition?.camp?.title || '方块营地')}</h2><p>${escapeHtml(expedition?.camp?.subtitle || '')}</p><small>${escapeHtml(expedition?.camp?.subtitleEn || '')}</small></div><span class="mv-camp-map-progress">${summary.cleared}/${summary.total} 区域 · ${summary.percent}%</span></div>
                ${expedition?.camp?.mapImage ? `<div class="mv-expedition-map-art"><img src="${escapeHtml(asset(expedition.camp.mapImage))}" alt="Minecraft 单词远征路线地图" loading="eager" decoding="async" data-mv-expedition-image></div>` : ''}
                <div class="mv-expedition-story"><div><span class="mv-kicker">${escapeHtml(expedition?.story?.titleEn || 'The Word Expedition')}</span><strong>${escapeHtml(expedition?.story?.opening || '')}</strong></div><p>${escapeHtml(expedition?.story?.openingEn || '')}</p></div>
                <div class="mv-expedition-stats" aria-label="远征者成长"><div><span>等级 Level</span><strong>${summary.level}</strong></div><div><span>经验 XP</span><strong>${summary.experience}</strong></div><div><span>道具 Items</span><strong>${summary.inventory.length}</strong></div><div><span>词卡 Cards</span><strong>${summary.cleared * 4}</strong></div></div>
                <div class="mv-region-route">
                    ${regionList().map((region, index) => {
                        const rawStatus = global.MinecraftVocabExpedition?.getRegionState(expeditionState, region.id) || 'locked';
                        const levelLocked = !regionLevelAllowed(region);
                        const status = levelLocked ? 'level-locked' : rawStatus;
                        const mission = missionForRegion(region.id);
                        const isCleared = rawStatus === 'cleared';
                        const requiredLabel = levelsApi()?.get(region.minVocabLevel)?.label || '更高阶段';
                        const statusLabel = levelLocked ? `需要${requiredLabel}` : status === 'locked' ? '未解锁' : isCleared ? '已完成' : '可以进入';
                        const actionLabel = isCleared ? '已点亮 · Cleared' : levelLocked ? `需要${requiredLabel}` : status === 'locked' ? '完成前置后解锁 · Locked' : `${mission?.cardIds?.length || 0} 张词卡 · Enter`;
                        return `<button class="mv-region-node is-${escapeHtml(status)}" type="button" data-mv-region="${escapeHtml(region.id)}" ${status === 'locked' || levelLocked ? 'disabled' : ''} aria-label="${escapeHtml(region.title)}，${escapeHtml(statusLabel)}">
                            <span class="mv-region-node-number">${isCleared ? '✓' : index + 1}</span><span class="mv-region-node-icon">${escapeHtml(region.icon || '◆')}</span><strong>${escapeHtml(region.title)}<small>${escapeHtml(region.titleEn || '')}</small></strong><small>${escapeHtml(region.subtitle || '')}</small><em>${escapeHtml(actionLabel)}</em>
                        </button>${index < regionList().length - 1 ? '<span class="mv-region-path" aria-hidden="true">➜</span>' : ''}`;
                    }).join('')}
                </div>
                <div class="mv-collection-strip"><span>📖 ${escapeHtml(expedition?.collection?.title || '词语收藏册')} · ${escapeHtml(expedition?.collection?.titleEn || 'Word Card Collection')}</span><strong>${summary.inventory.length ? summary.inventory.join(' · ') : '等待第一件道具'}</strong><small>${escapeHtml(expedition?.collection?.description || '')}</small></div>
            </section>
        `;
    }

    function renderStory() {
        const region = currentRegion();
        const mission = missionForRegion(selectedRegionId);
        if (!region || !mission) return renderHome();
        const beats = Array.isArray(region.storyBeats) && region.storyBeats.length
            ? region.storyBeats
            : [{ title: region.title, titleEn: region.titleEn, zh: region.story?.zh || '', en: region.story?.en || '' }];
        const storyImage = String(region.storyImage || region.sceneImage || EXPEDITION_FALLBACK_IMAGE);
        const status = global.MinecraftVocabExpedition?.getRegionState(expeditionState, region.id) || 'available';
        const cardsPreview = cardsForRegion(region.id);
        return `
            ${renderHeader(region.title, `章节故事 / ${region.titleEn}`)}
            <main class="mv-main">
                <section class="mv-story-panel" data-mv-story>
                    <div class="mv-story-hero" style="--mv-story-bg: ${escapeHtml(cssImage(storyImage))}">
                        <img src="${escapeHtml(asset(storyImage))}" alt="${escapeHtml(region.title)} 故事场景" data-mv-story-image loading="eager" decoding="async">
                        <div class="mv-story-hero-copy">
                            <span class="mv-kicker">Chapter ${escapeHtml(String(regionList().findIndex(item => item.id === region.id) + 1).padStart(2, '0'))} · ${escapeHtml(region.titleEn)}</span>
                            <h2>${escapeHtml(region.title)}</h2>
                            <p>${escapeHtml(region.subtitle || '')}</p>
                            <small>${escapeHtml(region.subtitleEn || '')}</small>
                        </div>
                    </div>
                    <div class="mv-story-intro">
                        <div><span class="mv-kicker">双语剧情 · Bilingual Story</span><strong>${escapeHtml(region.story?.zh || '')}</strong></div>
                        <p>${escapeHtml(region.story?.en || '')}</p>
                    </div>
                    <div class="mv-story-beats">
                        ${beats.map((beat, index) => `<article class="mv-story-beat">
                            <span class="mv-story-beat-number">${index + 1}</span>
                            <div><h3>${escapeHtml(beat.title || '')}</h3><small>${escapeHtml(beat.titleEn || '')}</small><p>${escapeHtml(beat.zh || '')}</p><p class="is-en">${escapeHtml(beat.en || '')}</p></div>
                        </article>`).join('')}
                    </div>
                    <div class="mv-story-goal">
                        <div class="mv-story-goal-copy"><span class="mv-kicker">本章收集目标 · Chapter Collection</span><h3>${escapeHtml(mission.title || '')}</h3><p>${escapeHtml(mission.titleEn || '')}</p><small>完成 ${mission.cardIds.length} 张词卡，获得 ${Number(mission.reward?.experience || 0)} XP</small></div>
                        <div class="mv-story-card-strip" aria-label="本章词卡预览">
                            ${cardsPreview.map(card => `<div class="mv-story-card-chip"><img src="${escapeHtml(cardImage(card))}" alt="" loading="lazy" decoding="async"><strong>${escapeHtml(card.word || '')}</strong><small>${escapeHtml(card.translation || '')}</small></div>`).join('')}
                        </div>
                    </div>
                    <div class="mv-story-actions">
                        <button class="mv-secondary-button" type="button" data-mv-story-back><i data-lucide="map" aria-hidden="true"></i><span>返回营地地图</span></button>
                        <button class="mv-primary-button" type="button" data-mv-story-study><i data-lucide="book-open-check" aria-hidden="true"></i><span>${status === 'cleared' ? '重温本章词卡' : '进入本章词卡'}</span></button>
                    </div>
                </section>
            </main>
        `;
    }

    function renderHome() {
        const currentStats = stats();
        const started = completedCount() > 0;
        return `
            ${renderHeader('Minecraft 单词远征', '学习中心 / 今日远征')}
            <main class="mv-main mv-playground-layout">
                ${renderProgressSidebar(currentStats)}
                <section class="mv-learning-column" aria-label="Minecraft 单词卡学习区">
                    <section class="mv-hero mv-hero-compact" data-mv-hero style="--mv-hero-bg: ${escapeHtml(cssImage(HERO_IMAGE))}">
                        <div class="mv-hero-copy">
                            <span class="mv-kicker">今日远征 · 约 10 分钟</span>
                            <h2>带伙伴穿过方块世界，收集 11 颗词语星</h2>
                            <p>先热身，再认识新词，最后把词放回场景里。</p>
                            <button class="mv-primary-button" type="button" data-mv-start><i data-lucide="play" aria-hidden="true"></i><span>${started ? '继续今日远征' : '开始今日远征'}</span></button>
                        </div>
                        <img class="mv-hero-companion" src="${escapeHtml(asset(COMPANION_IMAGE))}" alt="学习伙伴" loading="eager" decoding="async">
                    </section>
                    ${renderLevelPicker(currentStats)}
                    <section class="mv-card-column" aria-label="下一张单词卡">
                        <div class="mv-column-heading"><div><span class="mv-kicker">卡片栏目</span><h2>准备好，开始一张</h2></div><span class="mv-column-caption">图像 · 发音 · 场景</span></div>
                        ${renderCardPreview(cardForTask(currentTask()))}
                    </section>
                    ${renderCampMap()}
                    <section class="mv-source-line">
                        <i data-lucide="archive" aria-hidden="true"></i>
                        <span data-mv-source-summary>素材：Anki 原始 11,241 张 · 可学习 ${Number(currentStats.total || 0).toLocaleString('zh-CN')} 词 · 参考词表 500 条</span>
                        <span class="mv-source-actions"><button class="mv-text-button" type="button" data-mv-open-pack>查看学习包</button><button class="mv-text-button" type="button" data-mv-open-anki>打开完整 Anki 图鉴</button></span>
                    </section>
                </section>
            </main>
        `;
    }

    function renderChoices(card, mode) {
        if (!['recall', 'scene'].includes(mode)) return '';
        const choices = fallbackChoices(card);
        const prompt = mode === 'scene'
            ? String(card?.example || `I see a ${card?.word || 'block'}.`).replace(new RegExp(`\\b${String(card?.word || '').replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i'), '_____')
            : (card?.translation || '看图回忆英文');
        const firstLetter = String(card?.word || '').trim().charAt(0).toUpperCase();
        return `
            <div class="mv-recall-prompt"><span>${mode === 'scene' ? '场景句' : '中文提示'}</span><strong>${escapeHtml(prompt)}</strong></div>
            <div class="mv-hint-row"><button class="mv-hint-button" type="button" data-mv-hint aria-label="显示首字母提示"><i data-lucide="lightbulb" aria-hidden="true"></i><span>给我一点提示</span></button>${hintUsed ? `<span class="mv-hint-status" data-mv-hint-status>首字母：<strong>${escapeHtml(firstLetter || '?')}</strong></span>` : ''}</div>
            <div class="mv-choice-grid" role="group" aria-label="选择英文答案">
                ${choices.map(word => `<button class="mv-choice-button" type="button" data-mv-choice="${escapeHtml(word)}">${escapeHtml(word)}</button>`).join('')}
            </div>
            <label class="mv-answer-field"><span>也可以输入</span><input type="text" autocomplete="off" autocapitalize="none" spellcheck="false" data-mv-answer aria-label="输入英文答案"><button class="mv-icon-button" type="button" data-mv-submit-answer aria-label="检查答案" title="检查答案"><i data-lucide="check" aria-hidden="true"></i></button></label>
        `;
    }

    function renderFlashcard(card, mode) {
        const isQuestion = ['recall', 'scene'].includes(mode);
        const word = card?.word || '';
        const image = cardImage(card);
        const generatedBackImage = cardBackImage(card);
        const backImage = generatedBackImage || currentRegion()?.sceneImage || fallbackBackImage(card);
        const faceLabel = isQuestion ? '先看提示，再回忆英文' : '点击单词翻转看句子';
        const detailAudioButton = (key, label = '播放') => `<button class="mv-audio-button mv-detail-audio-button" type="button" data-mv-listen="${escapeHtml(key)}" aria-label="播放${escapeHtml(key.includes('Translation') || key === 'translation' ? '中文' : '英文')}音频" title="播放音频"><i data-lucide="volume-2" aria-hidden="true"></i><span>${label}</span></button>`;
        return `
            <article class="mv-flip-card${flipped ? ' is-flipped' : ''}" data-mv-flip-card aria-label="${escapeHtml(word || 'Minecraft 单词卡')}">
                <div class="mv-flip-inner">
                    <div class="mv-card-face mv-card-front" data-mv-flip role="button" tabindex="0" aria-label="翻转查看例句">
                        <div class="mv-card-face-top"><span>${escapeHtml(stageLabel(mode))}</span><span class="mv-card-face-count">词卡正面</span></div>
                        <div class="mv-card-art" data-mv-card-art>${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(word || 'Minecraft 词卡')}" data-mv-card-image loading="eager" decoding="async">` : fallbackCardVisual(card)}</div>
                        <div class="mv-card-front-copy">
                            <span class="mv-card-flip-hint"><i data-lucide="mouse-pointer-click" aria-hidden="true"></i>${faceLabel}</span>
                            <div class="mv-card-word-row">
                                <strong>${escapeHtml(isQuestion ? '？' : word)}</strong>
                                <button class="mv-audio-button" type="button" data-mv-listen="word" aria-label="播放 ${escapeHtml(word)} 的发音" title="播放单词发音"><i data-lucide="volume-2" aria-hidden="true"></i><span>听发音</span></button>
                            </div>
                            <span class="mv-card-phonetic">${escapeHtml(pronunciation(card))}</span>
                            ${isQuestion ? `<span class="mv-card-question-note">${escapeHtml(card.translation || '看图回忆英文单词')}</span>` : ''}
                        </div>
                        </div>
                        <div class="mv-card-face mv-card-back" data-mv-flip role="button" tabindex="0" aria-label="翻转回到单词正面">
                            <div class="mv-card-face-top"><span>场景记忆</span><span class="mv-card-face-count">词卡背面</span></div>
                            <div class="mv-card-back-art${generatedBackImage ? '' : ' is-fallback'}">
                                <img src="${escapeHtml(backImage)}" alt="${escapeHtml(word)} 场景记忆图" data-mv-back-image loading="eager" decoding="async">
                            </div>
                            <div class="mv-card-back-copy">
                            <div class="mv-card-back-word"><strong>${escapeHtml(word)}</strong><button class="mv-audio-button is-light" type="button" data-mv-listen="word" aria-label="播放 ${escapeHtml(word)} 的发音" title="播放单词发音"><i data-lucide="volume-2" aria-hidden="true"></i><span>再听一次</span></button></div>
                            <span class="mv-card-phonetic">${escapeHtml(pronunciation(card))}</span>
                            <div class="mv-card-detail-block is-meaning"><div class="mv-detail-heading"><span>中文释义</span>${detailAudioButton('translation')}</div><strong>${escapeHtml(card.translation || '')}</strong></div>
                            <div class="mv-card-detail-block is-phrase"><div class="mv-detail-heading"><span>短语 Phrase</span>${detailAudioButton('phrase')}</div><strong>${escapeHtml(card.phrase || '')}</strong><small>${escapeHtml(card.phraseTranslation || '')}</small><div class="mv-detail-translation-line">${detailAudioButton('phraseTranslation', '听中文')}</div></div>
                            <div class="mv-card-detail-block is-sentence"><div class="mv-detail-heading"><span>场景句 Sentence</span>${detailAudioButton('sentence')}</div><strong>${escapeHtml(cardText(card, 'sentence'))}</strong><small>${escapeHtml(cardText(card, 'sentenceTranslation'))}</small><div class="mv-detail-translation-line">${detailAudioButton('sentenceTranslation', '听中文')}</div></div>
                            <span class="mv-card-flip-hint"><i data-lucide="rotate-ccw" aria-hidden="true"></i>点击卡片回到正面</span>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }

    function renderUpcomingCards() {
        const currentIndex = (state?.queue || []).findIndex(item => item.cardId === currentTask()?.cardId);
        const upcoming = currentIndex >= 0 ? state.queue.slice(currentIndex + 1, currentIndex + 3) : [];
        if (!upcoming.length) return '';
        return `<div class="mv-upcoming-cards" aria-label="后续词卡">
            ${upcoming.map((task, index) => {
                const card = cardForTask(task) || {};
                return `<article class="mv-upcoming-card" aria-label="后续第 ${index + 1} 张词卡">
                    <span class="mv-upcoming-index">${currentIndex + index + 2}</span>
                    <div class="mv-upcoming-art">${cardImage(card) ? `<img src="${escapeHtml(cardImage(card))}" alt="" loading="lazy" decoding="async">` : fallbackCardVisual(card)}</div>
                    <strong>${escapeHtml(card.word || '')}</strong>
                    <small>${escapeHtml(card.translation || '')}</small>
                    <span class="mv-upcoming-lock"><i data-lucide="lock" aria-hidden="true"></i>待学习</span>
                </article>`;
            }).join('')}
        </div>`;
    }

    function renderSession() {
        const task = currentTask();
        if (!task) {
            return `
                ${renderHeader('奖励结算', '今日远征 / 结算中')}
                <main class="mv-main"><section class="mv-pending-panel" data-mv-session data-mv-mode="pending">
                    <i data-lucide="badge-alert" aria-hidden="true"></i><h2>答题已完成，奖励还没有结算</h2>
                    <p>${escapeHtml(feedback || '请保持页面打开并重试一次。')}</p>
                    <button class="mv-primary-button" type="button" data-mv-retry-reward><i data-lucide="rotate-cw" aria-hidden="true"></i><span>重试奖励结算</span></button>
                </section></main>
            `;
        }
        const card = cardForTask(task) || {};
        const taskIndex = (state.queue || []).findIndex(item => item.cardId === task.cardId) + 1;
        const isQuestion = ['recall', 'scene'].includes(task.mode);
        return `
            ${renderHeader('今日远征', `${currentRegion()?.title || 'Minecraft 单词'} / ${stageLabel(task.mode)}`)}
            <main class="mv-main mv-session-main">
                <section class="mv-learning-column">
                <section class="mv-session-shell" data-mv-session data-mv-mode="${escapeHtml(task.mode)}" style="--mv-session-bg: ${escapeHtml(cssImage(STAGE_IMAGES[task.mode] || STAGE_IMAGES.new))}">
                    <div class="mv-session-meta"><span>第 ${taskIndex} / ${state.queue.length}</span><span>${escapeHtml(stageLabel(task.mode))}</span></div>
                    <div class="mv-card-rack">
                        <div class="mv-current-card-wrap">${renderFlashcard(card, task.mode)}</div>
                    </div>
                    ${progressOpen ? renderProgressPanel(stats()) : ''}
                    ${isQuestion ? renderChoices(card, task.mode) : ''}
                    ${feedback ? `<p class="mv-feedback" data-mv-feedback aria-live="polite">${escapeHtml(feedback)}</p>` : ''}
                    <div class="mv-card-actions" data-mv-mobile-actions>
                        ${!isQuestion && flipped ? `<button class="mv-secondary-button mv-grade-button" type="button" data-mv-self-assess="unknown" data-mv-grade="again"><i data-lucide="rotate-ccw" aria-hidden="true"></i><span>再练</span></button><button class="mv-secondary-button mv-grade-button" type="button" data-mv-self-assess="hard" data-mv-grade="hard"><i data-lucide="help-circle" aria-hidden="true"></i><span>有点难</span></button><button class="mv-primary-button mv-grade-button" type="button" data-mv-self-assess="known" data-mv-grade="good"><i data-lucide="check" aria-hidden="true"></i><span>记住了</span></button><button class="mv-primary-button mv-grade-button" type="button" data-mv-self-assess="easy" data-mv-grade="easy"><i data-lucide="sparkles" aria-hidden="true"></i><span>太简单</span></button>` : ''}
                    </div>
                </section>
                </section>
            </main>
        `;
    }

    function renderBattle() {
        const region = currentRegion();
        const mission = missionForRegion(selectedRegionId);
        const battle = mission?.battle || {};
        const summary = global.MinecraftVocabExpedition?.getSummary(expeditionState) || { level: 1, experience: 0, inventory: [], abilities: [] };
        const result = global.MinecraftVocabExpedition?.calculateBattle(expeditionState, battle) || { playerPower: 0, enemyPower: 0, hasAbility: false };
        return `
            ${renderHeader('节点战斗', `${escapeHtml(region?.title || '远征节点')} / ${escapeHtml(region?.titleEn || 'Adventure Node')}`)}
            <main class="mv-main">
                <section class="mv-battle-panel" data-mv-battle-panel style="--mv-battle-bg: ${escapeHtml(cssImage(region?.sceneImage || STAGE_IMAGES.scene))}">
                    <div class="mv-battle-scene"><span class="mv-kicker">${escapeHtml(mission?.titleEn || 'Story Battle')}</span><h2>${escapeHtml(mission?.title || '守住远征路线')}</h2><p>${escapeHtml(region?.story?.zh || '')}</p><small>${escapeHtml(region?.story?.en || '')}</small></div>
                    <div class="mv-battle-versus"><div class="mv-battle-hero"><span>远征者 Explorer</span><strong>Lv.${summary.level}</strong><small>${summary.experience} XP</small><em>${summary.abilities.length ? summary.abilities.join(' · ') : '还没有能力'}</em></div><span class="mv-battle-mark">VS</span><div class="mv-battle-enemy"><span>${escapeHtml(battle.enemyEn || 'Enemy')}</span><strong>${escapeHtml(battle.enemy || '敌人')}</strong><small>战斗力 ${result.enemyPower}</small></div></div>
                    <div class="mv-battle-loadout"><span>当前道具</span><strong>${summary.inventory.length ? summary.inventory.join(' · ') : '空背包'}</strong><span class="mv-battle-power">你的战斗力 ${result.playerPower} / ${result.enemyPower}</span></div>
                    ${result.requiredAbility && !result.hasAbility ? `<p class="mv-battle-warning">还需要上一节点的能力才能安全通过：${escapeHtml(result.requiredAbility)}</p>` : ''}
                    <div class="mv-battle-copy"><strong>${escapeHtml(battle.winText || '')}</strong><small>${escapeHtml(battle.winTextEn || '')}</small></div>
                    ${feedback ? `<p class="mv-feedback" data-mv-feedback aria-live="polite">${escapeHtml(feedback)}</p>` : ''}
                    <button class="mv-primary-button mv-battle-action" type="button" data-mv-battle><i data-lucide="swords" aria-hidden="true"></i><span>开始战斗 · Start Battle</span></button>
                </section>
            </main>
        `;
    }

    function renderComplete() {
        const isRegionMission = !!selectedRegionId;
        return `
            ${renderHeader('远征完成', '今日远征 / 已结算')}
            <main class="mv-main"><section class="mv-complete-panel" data-mv-complete style="--mv-complete-bg: ${escapeHtml(cssImage(REWARD_IMAGE))}">
                <div class="mv-reward-stack" aria-hidden="true"><img class="mv-reward-chest" src="${escapeHtml(asset(REWARD_CHEST_IMAGE))}" alt=""><img class="mv-reward-star" src="${escapeHtml(asset(REWARD_STAR_IMAGE))}" alt=""></div>
                <div class="mv-complete-icon"><i data-lucide="trophy" aria-hidden="true"></i></div>
                <span class="mv-kicker">${state?.queue?.length || 11} / ${state?.queue?.length || 11}</span>
                <h2>今天的词语星已收集</h2>
                <p>${rewardResult?.duplicate ? '今日奖励已经领取过了。' : `成长分 +${Number(rewardResult?.event?.points || state?.rewardPoints || 10)}，宠物经验同步增加`}</p>
                <button class="mv-primary-button" type="button" data-mv-return-camp><i data-lucide="map" aria-hidden="true"></i><span>${isRegionMission ? '回到营地地图' : '回到学习中心'}</span></button>
            </section></main>
        `;
    }

    function renderRoot(generation = pageGeneration) {
        if (!root || !isCurrentGeneration(generation)) return;
        if (view === 'battle') renderShell(renderBattle(), generation);
        else if (view === 'complete') renderShell(renderComplete(), generation);
        else if (view === 'story') renderShell(renderStory(), generation);
        else if (view === 'session') renderShell(renderSession(), generation);
        else renderShell(renderHome(), generation);
    }

    function speakText(card, key = 'word') {
        if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
            global.speechSynthesis.cancel();
            const text = key === 'word' ? String(card?.word || '') : cardText(card, key);
            const utterance = new global.SpeechSynthesisUtterance(text);
            utterance.lang = key === 'translation' || key.includes('Translation') ? 'zh-CN' : 'en-US';
            global.speechSynthesis.speak(utterance);
        }
    }

    function playAudio(card, key = 'word') {
        const src = cardAudio(card, key);
        if (audio) {
            try { audio.pause(); } catch (error) {}
            audio = null;
        }
        if (src && typeof global.Audio === 'function') {
            audio = new global.Audio(src);
            audio.addEventListener('error', () => speakText(card, key), { once: true });
            audio.play().catch(error => {
                console.warn('[MinecraftVocabPage] audio play failed, using speech fallback', error);
                speakText(card, key);
            });
            return;
        }
        speakText(card, key);
    }

    function finishAction(result, metadata = {}) {
        const task = currentTask();
        const card = cardForTask(task);
        if (!task || !card || !progressApi() || typeof progressApi().record !== 'function') return;
        const grade = typeof result === 'boolean' ? (result ? 'good' : 'again') : String(result || 'again');
        const correct = grade !== 'again';
        const progress = progressApi().record(card.id, grade, {
            ...metadata,
            responseMode: metadata.responseMode || task.mode,
            hintUsed
        });
        if (progress?.persisted === false) {
            feedback = '保存失败，本次没有推进，请重试。';
            renderRoot();
            return;
        }
        const next = global.MinecraftVocabSession.recordAction(state, card.id);
        if (!next.persisted) {
            feedback = '远征进度保存失败，本次没有推进，请重试。';
            renderRoot();
            return;
        }
        state = next.state;
        hintUsed = false;
        feedback = grade === 'again'
            ? `再看一次：${card.word}`
            : grade === 'hard'
                ? '想起来了，稍后再见一次。'
                : grade === 'easy'
                    ? '太棒了，这个词可以走得更远。'
                    : '答对了，继续前进。';
        revealed = false;
        flipped = false;
        if (global.MinecraftVocabSession.isComplete(state)) {
            if (selectedRegionId) {
                feedback = '';
                view = 'battle';
            } else {
                rewardResult = global.MinecraftVocabSession.claimReward(state);
                if (rewardResult?.accepted || rewardResult?.reason === 'duplicate') {
                    view = 'complete';
                    if (typeof global.showToast === 'function' && rewardResult.accepted) global.showToast('今日远征完成，成长分 +10');
                } else {
                    feedback = '答题已完成，但奖励暂时没有结算。';
                }
            }
        }
        renderRoot();
    }

    function startRegionSession() {
        const mission = missionForRegion(selectedRegionId);
        if (!selectedRegionId || !mission) return;
        const result = global.MinecraftVocabSession.start(cardsForRegion(selectedRegionId), card => progressApi()?.get?.(card.id), '', {
            regionId: selectedRegionId,
            missionId: mission.id,
            queueSize: mission.cardIds.length,
            rewardPoints: mission.reward?.points || 3,
            levelId: selectedLevelId,
            bandId: ''
        });
        state = result.state;
        view = 'session';
        feedback = result.persisted ? '' : '节点进度暂时无法保存，仍可查看词卡。';
        flipped = false;
        progressOpen = false;
        renderRoot();
    }

    function startGeneralSession() {
        selectedRegionId = '';
        const result = global.MinecraftVocabSession.start(cardsForLevel(), card => progressApi()?.get?.(card.id), '', {
            regionId: '',
            queueSize: 11,
            levelId: selectedLevelId,
            bandId: selectedLevelId === 'minecraft' ? selectedBandId : ''
        });
        state = result.state;
        view = 'session';
        feedback = result.persisted ? '' : '本日进度暂时无法保存，仍可查看词卡。';
        flipped = false;
        progressOpen = false;
        renderRoot();
    }

    async function reloadSelection(nextLevelId, nextBandId = selectedBandId) {
        const generation = pageGeneration;
        const requestId = ++selectionRequestId;
        if (!isCurrentGeneration(generation)) return;
        selectedLevelId = levelsApi()?.normalizeLevelId(nextLevelId) || 'kindergarten';
        selectedBandId = levelsApi()?.normalizeBandId(nextBandId) || 'minecraft-core';
        saveSelectedLevel(selectedLevelId);
        saveSelectedBand(selectedBandId);
        selectedRegionId = '';
        if (root) root.innerHTML = '<div class="mv-loading" aria-live="polite">正在切换词库...</div>';
        try {
            module = await global.MinecraftVocabLoader.loadForSelection(selectedLevelId, selectedBandId);
            if (!isCurrentGeneration(generation) || requestId !== selectionRequestId) return;
            const result = global.MinecraftVocabSession.start(cardsForLevel(), card => progressApi()?.get?.(card.id), '', {
                regionId: '',
                queueSize: 11,
                levelId: selectedLevelId,
                bandId: selectedLevelId === 'minecraft' ? selectedBandId : ''
            });
            state = result.state;
            view = 'home';
            feedback = result.persisted ? '' : '本日进度暂时无法保存，仍可查看词卡。';
            flipped = false;
            renderRoot(generation);
        } catch (error) {
            if (!isCurrentGeneration(generation) || requestId !== selectionRequestId) return;
            console.warn('[MinecraftVocabPage] selection load failed', error);
            if (root) root.innerHTML = '<div class="mv-error" role="alert">词库分片加载失败，请稍后重试。</div>';
        }
    }

    function bindEvents() {
        root.querySelectorAll('[data-mv-back]').forEach(button => button.addEventListener('click', () => {
            if (typeof global.switchPage === 'function') global.switchPage('learn');
        }));
        root.querySelectorAll('[data-mv-return-camp]').forEach(button => button.addEventListener('click', () => {
            if (!selectedRegionId) {
                if (typeof global.switchPage === 'function') global.switchPage('learn');
                return;
            }
            selectedRegionId = '';
            const result = global.MinecraftVocabSession.start(cardsForLevel(), card => progressApi()?.get?.(card.id), '', { regionId: '', queueSize: 11, levelId: selectedLevelId, bandId: selectedLevelId === 'minecraft' ? selectedBandId : '' });
            state = result.state;
            view = 'home';
            feedback = '';
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-start]').forEach(button => button.addEventListener('click', () => {
            startGeneralSession();
        }));
        root.querySelectorAll('[data-mv-level]').forEach(button => button.addEventListener('click', () => {
            const nextLevel = button.dataset.mvLevel || '';
            if (nextLevel === selectedLevelId) return;
            void reloadSelection(nextLevel, selectedBandId);
        }));
        root.querySelectorAll('[data-mv-band]').forEach(button => button.addEventListener('click', () => {
            const nextBand = button.dataset.mvBand || '';
            if (nextBand === selectedBandId && selectedLevelId === 'minecraft') return;
            if (selectedLevelId !== 'minecraft') return;
            void reloadSelection(selectedLevelId, nextBand);
        }));
        root.querySelectorAll('[data-mv-story-back]').forEach(button => button.addEventListener('click', () => {
            selectedRegionId = '';
            const result = global.MinecraftVocabSession.start(cardsForLevel(), card => progressApi()?.get?.(card.id), '', { regionId: '', queueSize: 11, levelId: selectedLevelId, bandId: selectedLevelId === 'minecraft' ? selectedBandId : '' });
            state = result.state;
            view = 'home';
            feedback = '';
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-story-study]').forEach(button => button.addEventListener('click', () => startRegionSession()));
        root.querySelectorAll('[data-mv-toggle-progress]').forEach(button => button.addEventListener('click', () => {
            progressOpen = !progressOpen;
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-region]').forEach(button => button.addEventListener('click', () => {
            const regionId = button.dataset.mvRegion || '';
            const region = regionForId(regionId);
            const mission = missionForRegion(regionId);
            if (!region || !mission || !regionLevelAllowed(region) || !global.MinecraftVocabExpedition) return;
            const entered = global.MinecraftVocabExpedition.enterRegion(expeditionState, regionId, regionList());
            if (entered.reason === 'locked' || entered.reason === 'cleared') return;
            selectedRegionId = regionId;
            if (entered.persisted) expeditionState = entered.state;
            view = 'story';
            feedback = '';
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-open-pack]').forEach(button => button.addEventListener('click', () => {
            if (global.LearnCenter && typeof global.LearnCenter.openPack === 'function') global.LearnCenter.openPack(PACK_ID);
        }));
        root.querySelectorAll('[data-mv-open-anki]').forEach(button => button.addEventListener('click', () => {
            const url = 'prj/anki-minecraft-vocab/index.html';
            if (typeof global.open === 'function') global.open(url, '_blank', 'noopener');
        }));
        root.querySelectorAll('[data-mv-reveal]').forEach(button => button.addEventListener('click', () => {
            revealed = true;
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-hint]').forEach(button => button.addEventListener('click', event => {
            event.stopPropagation();
            hintUsed = true;
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-flip]').forEach(target => {
            const flip = () => {
                flipped = !flipped;
                renderRoot();
            };
            target.addEventListener('click', event => {
                if (event.target.closest('[data-mv-listen]')) return;
                flip();
            });
            target.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    flip();
                }
            });
        });
        root.querySelectorAll('[data-mv-listen]').forEach(button => button.addEventListener('click', event => {
            event.stopPropagation();
            playAudio(cardForTask(currentTask()), button.dataset.mvListen || 'word');
        }));
        root.querySelectorAll('[data-mv-self-assess]').forEach(button => button.addEventListener('click', () => {
            const grade = button.dataset.mvGrade || (button.dataset.mvSelfAssess === 'known' ? 'good' : 'again');
            finishAction(grade, { responseMode: currentTask()?.mode || 'review' });
        }));
        root.querySelectorAll('[data-mv-choice]').forEach(button => button.addEventListener('click', () => {
            const card = cardForTask(currentTask());
            const correct = String(button.dataset.mvChoice || '').toLocaleLowerCase() === String(card?.word || '').toLocaleLowerCase();
            finishAction(correct ? 'good' : 'again', { responseMode: currentTask()?.mode || 'recall' });
        }));
        root.querySelectorAll('[data-mv-submit-answer]').forEach(button => button.addEventListener('click', () => {
            const input = root.querySelector('[data-mv-answer]');
            const card = cardForTask(currentTask());
            const correct = String(input?.value || '').trim().toLocaleLowerCase() === String(card?.word || '').toLocaleLowerCase();
            finishAction(correct ? 'good' : 'again', { responseMode: currentTask()?.mode || 'recall' });
        }));
        root.querySelectorAll('[data-mv-answer]').forEach(input => input.addEventListener('keydown', event => {
            if (event.key === 'Enter') root.querySelector('[data-mv-submit-answer]')?.click();
        }));
        root.querySelectorAll('[data-mv-retry-reward]').forEach(button => button.addEventListener('click', () => {
            rewardResult = global.MinecraftVocabSession.claimReward(state);
            if (rewardResult?.accepted || rewardResult?.reason === 'duplicate') view = 'complete';
            else feedback = '奖励仍未结算，请稍后重试。';
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-battle]').forEach(button => button.addEventListener('click', () => {
            const mission = missionForRegion(selectedRegionId);
            const battle = mission?.battle || {};
            const result = global.MinecraftVocabExpedition?.calculateBattle(expeditionState, battle);
            if (!result?.won) {
                feedback = result?.hasAbility === false && result?.requiredAbility
                    ? `先收集能力：${result.requiredAbility}`
                    : '战斗力还不够，再复习一次这个节点的词卡。';
                renderRoot();
                return;
            }
            rewardResult = global.MinecraftVocabSession.claimReward(state);
            if (!(rewardResult?.accepted || rewardResult?.reason === 'duplicate')) {
                feedback = '战斗胜利，但成长分暂时没有结算，请重试。';
                renderRoot();
                return;
            }
            const reward = mission?.reward || {};
            const completed = global.MinecraftVocabExpedition.completeRegion(
                expeditionState,
                selectedRegionId,
                regionList(),
                mission?.id || '',
                reward.collectionItem || '',
                { ...reward, enemy: battle.enemy || battle.enemyEn || '' }
            );
            if (!completed.persisted) {
                feedback = '战斗已胜利，但远征成长保存失败，请重试。';
                renderRoot();
                return;
            }
            expeditionState = completed.state;
            feedback = '';
            view = 'complete';
            if (typeof global.showToast === 'function' && rewardResult.accepted) global.showToast(`战斗胜利，获得 ${reward.itemLabel || '新道具'}`);
            renderRoot();
        }));
    }

    async function render(containerId = 'minecraft-vocab-root') {
        stop();
        const generation = ++pageGeneration;
        mounted = true;
        root = document.getElementById(containerId);
        if (!root) return;
        root.innerHTML = '<div class="mv-loading" aria-live="polite">正在准备今日远征...</div>';
        try {
            selectedLevelId = readSelectedLevel();
            selectedBandId = readSelectedBand();
            void global.MinecraftVocabAudio?.prepare?.();
            const [loadedModule, response] = await Promise.all([
                global.MinecraftVocabLoader.loadForSelection(selectedLevelId, selectedBandId),
                fetch(resolveDataUrl('data/learn/minecraft-expedition/camp-regions.json'))
            ]);
            if (!isCurrentGeneration(generation)) return;
            if (!response.ok) throw new Error(`expedition data request failed: ${response.status}`);
            module = loadedModule;
            expedition = await response.json();
            if (!isCurrentGeneration(generation)) return;
            expeditionState = global.MinecraftVocabExpedition?.readState(regionList()) || null;
            if (!isCurrentGeneration(generation)) return;
            const savedSession = global.MinecraftVocabSession.readState?.();
            const savedRegionId = String(savedSession?.regionId || expeditionState?.activeRegionId || '');
            const savedRegion = regionForId(savedRegionId);
            const savedMission = missionForRegion(savedRegionId);
            const sessionOptions = savedRegion && savedMission
                ? { regionId: savedRegionId, missionId: savedMission.id, queueSize: savedMission.cardIds.length, rewardPoints: savedMission.reward?.points || 3, levelId: selectedLevelId, bandId: '' }
                : { regionId: '', queueSize: 11, levelId: selectedLevelId, bandId: selectedLevelId === 'minecraft' ? selectedBandId : '' };
            const sessionCards = savedRegion && savedMission ? cardsForRegion(savedRegionId) : cardsForLevel();
            const result = global.MinecraftVocabSession.start(sessionCards, card => progressApi()?.get?.(card.id), '', sessionOptions);
            state = result.state;
            selectedRegionId = String(state.regionId || '');
            view = global.MinecraftVocabSession.isComplete(state) ? (selectedRegionId ? 'battle' : 'complete') : selectedRegionId ? 'session' : 'home';
            feedback = result.persisted ? '' : '本日进度暂时无法保存，仍可查看词卡。';
            renderRoot(generation);
        } catch (error) {
            if (!isCurrentGeneration(generation)) return;
            console.warn('[MinecraftVocabPage] render failed', error);
            root.innerHTML = '<div class="mv-error" role="alert">Minecraft 单词远征加载失败，请稍后重试。</div>';
        }
    }

    function stop() {
        mounted = false;
        pageGeneration += 1;
        selectionRequestId += 1;
        root = null;
        if (audio) {
            try { audio.pause(); } catch (error) {}
            audio = null;
        }
        if (global.speechSynthesis) global.speechSynthesis.cancel();
    }

    global.MinecraftVocabPage = { render, stop };
})(typeof window !== 'undefined' ? window : globalThis);
