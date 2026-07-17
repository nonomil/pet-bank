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

    let mounted = false;
    let root = null;
    let module = null;
    let state = null;
    let view = 'home';
    let revealed = false;
    let flipped = false;
    let feedback = '';
    let rewardResult = null;
    let audio = null;

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

    function progressApi() {
        return global.EnglishVocabProgress || null;
    }

    function stats() {
        const result = progressApi()?.stats?.(cards());
        return result || { total: cards().length, new: cards().length, learning: 0, mastered: 0 };
    }

    function cardForTask(task) {
        return cards().find(card => card.id === task?.cardId) || null;
    }

    function currentTask() {
        return state?.queue?.find(item => !state.completed.includes(item.cardId)) || null;
    }

    function cardImage(card) {
        const image = String(card?.image || '');
        return /^(?:assets|prj\/anki-minecraft-vocab)\//.test(image) ? asset(image) : '';
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
        return /^(?:assets|prj\/anki-minecraft-vocab)\//.test(audioPath) ? asset(audioPath) : '';
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
        const words = cards().map(item => item.word).filter(Boolean);
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

    function renderShell(content) {
        if (!root || !mounted) return;
        root.innerHTML = `<div class="minecraft-vocab-page" data-minecraft-vocab-page style="--mv-card-frame: ${escapeHtml(cssImage(CARD_FRAME_IMAGE))}; --mv-corner-tl: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.tl))}; --mv-corner-tr: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.tr))}; --mv-corner-bl: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.bl))}; --mv-corner-br: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.br))}">${content}</div>`;
        bindEvents();
        if (global.lucide && typeof global.lucide.createIcons === 'function') global.lucide.createIcons();
        const image = root.querySelector('[data-mv-card-image]');
        if (image) {
            image.addEventListener('error', () => {
                const placeholder = document.createElement('div');
                placeholder.className = 'mv-card-image-placeholder';
                placeholder.textContent = '图片待补';
                image.replaceWith(placeholder);
            }, { once: true });
        }
    }

    function renderHeader(title, kicker = '学习 / Minecraft 单词') {
        return `
            <header class="minecraft-vocab-header">
                <button class="mv-icon-button" type="button" data-mv-back aria-label="返回学习中心" title="返回学习中心"><i data-lucide="arrow-left" aria-hidden="true"></i></button>
                <div>
                    <span class="mv-eyebrow">${escapeHtml(kicker)}</span>
                    <h1>${escapeHtml(title)}</h1>
                </div>
                <div class="mv-points-badge" aria-label="今日完成任务">
                    <i data-lucide="sparkles" aria-hidden="true"></i>
                    <span data-mv-progress>${completedCount()} / 11</span>
                </div>
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
                    <section class="mv-card-column" aria-label="下一张单词卡">
                        <div class="mv-column-heading"><div><span class="mv-kicker">卡片栏目</span><h2>准备好，开始一张</h2></div><span class="mv-column-caption">图像 · 发音 · 场景</span></div>
                        ${renderCardPreview(cardForTask(currentTask()))}
                    </section>
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
        return `
            <div class="mv-recall-prompt"><span>${mode === 'scene' ? '场景句' : '中文提示'}</span><strong>${escapeHtml(prompt)}</strong></div>
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
            ${renderHeader('今日远征', `Minecraft 单词 / ${stageLabel(task.mode)}`)}
            <main class="mv-main mv-playground-layout mv-session-layout">
                ${renderProgressSidebar(stats())}
                <section class="mv-learning-column">
                <section class="mv-session-shell" data-mv-session data-mv-mode="${escapeHtml(task.mode)}" style="--mv-session-bg: ${escapeHtml(cssImage(STAGE_IMAGES[task.mode] || STAGE_IMAGES.new))}">
                    <div class="mv-session-meta"><span>第 ${taskIndex} / 11</span><span>${escapeHtml(stageLabel(task.mode))}</span></div>
                    <div class="mv-card-rack">
                        <div class="mv-current-card-wrap">${renderFlashcard(card, task.mode)}</div>
                        ${renderUpcomingCards()}
                    </div>
                    ${isQuestion ? renderChoices(card, task.mode) : ''}
                    ${feedback ? `<p class="mv-feedback" data-mv-feedback aria-live="polite">${escapeHtml(feedback)}</p>` : ''}
                    <div class="mv-card-actions" data-mv-mobile-actions>
                        ${!isQuestion ? `<button class="mv-secondary-button" type="button" data-mv-self-assess="unknown"><i data-lucide="rotate-ccw" aria-hidden="true"></i><span>还不熟</span></button><button class="mv-primary-button" type="button" data-mv-self-assess="known"><i data-lucide="check" aria-hidden="true"></i><span>认识了</span></button>` : ''}
                    </div>
                </section>
                </section>
            </main>
        `;
    }

    function renderComplete() {
        return `
            ${renderHeader('远征完成', '今日远征 / 已结算')}
            <main class="mv-main"><section class="mv-complete-panel" data-mv-complete style="--mv-complete-bg: ${escapeHtml(cssImage(REWARD_IMAGE))}">
                <div class="mv-reward-stack" aria-hidden="true"><img class="mv-reward-chest" src="${escapeHtml(asset(REWARD_CHEST_IMAGE))}" alt=""><img class="mv-reward-star" src="${escapeHtml(asset(REWARD_STAR_IMAGE))}" alt=""></div>
                <div class="mv-complete-icon"><i data-lucide="trophy" aria-hidden="true"></i></div>
                <span class="mv-kicker">11 / 11</span>
                <h2>今天的词语星已收集</h2>
                <p>${rewardResult?.duplicate ? '今日奖励已经领取过了。' : '成长分 +10，宠物经验 +10'}</p>
                <button class="mv-primary-button" type="button" data-mv-back><i data-lucide="book-open" aria-hidden="true"></i><span>回到学习中心</span></button>
            </section></main>
        `;
    }

    function renderRoot() {
        if (!mounted || !root) return;
        if (view === 'complete') renderShell(renderComplete());
        else if (view === 'session') renderShell(renderSession());
        else renderShell(renderHome());
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

    function finishAction(correct) {
        const task = currentTask();
        const card = cardForTask(task);
        if (!task || !card || !progressApi() || typeof progressApi().record !== 'function') return;
        const progress = progressApi().record(card.id, correct);
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
        feedback = correct ? '答对了，继续前进。' : `再看一次：${card.word}`;
        revealed = false;
        flipped = false;
        if (global.MinecraftVocabSession.isComplete(state)) {
            rewardResult = global.MinecraftVocabSession.claimReward(state);
            if (rewardResult?.accepted || rewardResult?.reason === 'duplicate') {
                view = 'complete';
                if (typeof global.showToast === 'function' && rewardResult.accepted) global.showToast('今日远征完成，成长分 +10');
            } else {
                feedback = '答题已完成，但奖励暂时没有结算。';
            }
        }
        renderRoot();
    }

    function bindEvents() {
        root.querySelectorAll('[data-mv-back]').forEach(button => button.addEventListener('click', () => {
            if (typeof global.switchPage === 'function') global.switchPage('learn');
        }));
        root.querySelectorAll('[data-mv-start]').forEach(button => button.addEventListener('click', () => {
            view = 'session';
            feedback = '';
            flipped = false;
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
        root.querySelectorAll('[data-mv-self-assess]').forEach(button => button.addEventListener('click', () => finishAction(button.dataset.mvSelfAssess === 'known')));
        root.querySelectorAll('[data-mv-choice]').forEach(button => button.addEventListener('click', () => {
            const card = cardForTask(currentTask());
            finishAction(String(button.dataset.mvChoice || '').toLocaleLowerCase() === String(card?.word || '').toLocaleLowerCase());
        }));
        root.querySelectorAll('[data-mv-submit-answer]').forEach(button => button.addEventListener('click', () => {
            const input = root.querySelector('[data-mv-answer]');
            const card = cardForTask(currentTask());
            finishAction(String(input?.value || '').trim().toLocaleLowerCase() === String(card?.word || '').toLocaleLowerCase());
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
    }

    async function render(containerId = 'minecraft-vocab-root') {
        stop();
        mounted = true;
        root = document.getElementById(containerId);
        if (!root) return;
        root.innerHTML = '<div class="mv-loading" aria-live="polite">正在准备今日远征...</div>';
        try {
            module = await global.LearnCenter.getModule(PACK_ID, MODULE_ID);
            if (!mounted) return;
            const result = global.MinecraftVocabSession.start(cards(), card => progressApi()?.get?.(card.id), '');
            state = result.state;
            view = global.MinecraftVocabSession.isComplete(state) ? 'complete' : 'home';
            feedback = result.persisted ? '' : '本日进度暂时无法保存，仍可查看词卡。';
            renderRoot();
        } catch (error) {
            console.warn('[MinecraftVocabPage] render failed', error);
            root.innerHTML = '<div class="mv-error" role="alert">Minecraft 单词远征加载失败，请稍后重试。</div>';
        }
    }

    function stop() {
        mounted = false;
        if (audio) {
            try { audio.pause(); } catch (error) {}
            audio = null;
        }
        if (global.speechSynthesis) global.speechSynthesis.cancel();
    }

    global.MinecraftVocabPage = { render, stop };
})(typeof window !== 'undefined' ? window : globalThis);
