(function (global) {
    'use strict';

    const PACK_ID = 'english-mc-hybrid-2026';
    const MODULE_ID = 'minecraft-vocab';
    const VISUAL_ROOT = 'assets/learn/english-vocab/generated/minecraft-vocab-visual-pack/';
    const HERO_IMAGE = `${VISUAL_ROOT}study-camp-hero.png`;
    const FALLBACK_IMAGE = 'assets/learn/english-vocab/minecraft-card.webp';
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
        return image.startsWith('assets/') ? asset(image) : asset(FALLBACK_IMAGE);
    }

    function cardAudio(card) {
        const audioPath = String(card?.audio || '');
        return audioPath.startsWith('assets/') ? asset(audioPath) : '';
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
        root.innerHTML = `<div class="minecraft-vocab-page" data-minecraft-vocab-page style="--mv-card-frame: ${escapeHtml(cssImage(CARD_FRAME_IMAGE))}; --mv-card-corner-tl: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.tl))}; --mv-card-corner-tr: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.tr))}; --mv-card-corner-bl: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.bl))}; --mv-card-corner-br: ${escapeHtml(cssImage(CARD_CORNER_IMAGES.br))}">${content}</div>`;
        bindEvents();
        if (global.lucide && typeof global.lucide.createIcons === 'function') global.lucide.createIcons();
        const image = root.querySelector('[data-mv-card-image]');
        if (image) {
            image.addEventListener('error', () => {
                image.src = asset(FALLBACK_IMAGE);
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

    function renderHome() {
        const currentStats = stats();
        const started = completedCount() > 0;
        return `
            ${renderHeader('Minecraft 单词远征', '学习中心 / 今日远征')}
            <main class="mv-main">
                <section class="mv-hero" data-mv-hero style="--mv-hero-bg: ${escapeHtml(cssImage(HERO_IMAGE))}">
                    <div class="mv-hero-copy">
                        <span class="mv-kicker">今日远征 · 约 10 分钟</span>
                        <h2>带伙伴穿过方块世界，收集 11 颗词语星</h2>
                        <p>先热身，再认识新词，最后把词放回场景里。</p>
                        <button class="mv-primary-button" type="button" data-mv-start><i data-lucide="play" aria-hidden="true"></i><span>${started ? '继续今日远征' : '开始今日远征'}</span></button>
                    </div>
                    <img class="mv-hero-companion" src="${escapeHtml(asset(COMPANION_IMAGE))}" alt="学习伙伴" loading="eager" decoding="async">
                </section>
                <section class="mv-overview-band" aria-label="学习概览">
                    <div class="mv-overview-copy">
                        <span class="mv-kicker">本日路线</span>
                        <h2>先完成眼前这一组</h2>
                        <p>进度会跟着当前孩子 Profile 保存。</p>
                    </div>
                    ${renderStageTrack()}
                    ${renderTaskDots()}
                </section>
                <section class="mv-stat-grid" aria-label="词汇统计">
                    <div><span>词卡总数</span><strong>${currentStats.total}</strong><small>本地可播放词卡</small></div>
                    <div><span>已掌握</span><strong>${currentStats.mastered}</strong><small>连续答对 2 次</small></div>
                    <div><span>今日奖励</span><strong>+10</strong><small>完成远征后结算</small></div>
                </section>
                <section class="mv-source-line">
                    <i data-lucide="archive" aria-hidden="true"></i>
                    <span data-mv-source-summary>素材：Anki 本地词卡 11,241 张 · 主站学习池 ${currentStats.total} 张 · 参考词表 500 条</span>
                    <button class="mv-text-button" type="button" data-mv-open-pack>查看学习包</button>
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
        const translation = isQuestion || revealed ? card.translation : '先听一遍，再翻开释义';
        return `
            ${renderHeader('今日远征', `Minecraft 单词 / ${stageLabel(task.mode)}`)}
            <main class="mv-main">
                <section class="mv-session-shell" data-mv-session data-mv-mode="${escapeHtml(task.mode)}" style="--mv-session-bg: ${escapeHtml(cssImage(STAGE_IMAGES[task.mode] || STAGE_IMAGES.new))}">
                    <div class="mv-session-meta"><span>第 ${taskIndex} / 11</span><span>${escapeHtml(stageLabel(task.mode))}</span></div>
                    <div class="mv-card-grid">
                        <div class="mv-card-art"><span class="mv-card-corner mv-card-corner-tl" aria-hidden="true"></span><span class="mv-card-corner mv-card-corner-tr" aria-hidden="true"></span><span class="mv-card-corner mv-card-corner-bl" aria-hidden="true"></span><span class="mv-card-corner mv-card-corner-br" aria-hidden="true"></span><img src="${escapeHtml(cardImage(card))}" alt="${escapeHtml(card.word || 'Minecraft 词卡')}" data-mv-card-image loading="eager" decoding="async"></div>
                        <div class="mv-card-copy">
                            <div class="mv-word-line"><strong>${escapeHtml(isQuestion ? '？' : card.word || '')}</strong><button class="mv-icon-button" type="button" data-mv-listen aria-label="播放单词发音" title="播放单词发音"><i data-lucide="volume-2" aria-hidden="true"></i></button></div>
                            ${card.phonetic ? `<span class="mv-phonetic">${escapeHtml(card.phonetic)}</span>` : ''}
                            <span class="mv-translation">${escapeHtml(translation || '')}</span>
                            ${!isQuestion ? '<button class="mv-text-button" type="button" data-mv-reveal><i data-lucide="eye" aria-hidden="true"></i><span>显示释义</span></button>' : ''}
                            ${renderChoices(card, task.mode)}
                            ${!isQuestion ? `
                                <div class="mv-phrase" data-mv-phrase>
                                    <span>短语</span>
                                    <strong>${escapeHtml(card.phrase || '')}</strong>
                                    <small>${escapeHtml(card.phraseTranslation || '')}</small>
                                </div>
                                <div class="mv-sentence" data-mv-sentence>
                                    <span>场景句</span>
                                    <p>${escapeHtml(card.sentence || card.example || '')}</p>
                                    <small>${escapeHtml(card.sentenceTranslation || card.exampleZh || card.exampleTranslation || '')}</small>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    ${feedback ? `<p class="mv-feedback" data-mv-feedback aria-live="polite">${escapeHtml(feedback)}</p>` : ''}
                    <div class="mv-mobile-actions" data-mv-mobile-actions>
                        ${!isQuestion ? `<button class="mv-secondary-button" type="button" data-mv-self-assess="unknown"><i data-lucide="rotate-ccw" aria-hidden="true"></i><span>还不熟</span></button><button class="mv-primary-button" type="button" data-mv-self-assess="known"><i data-lucide="check" aria-hidden="true"></i><span>认识了</span></button>` : ''}
                    </div>
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

    function playAudio(card) {
        const src = cardAudio(card);
        if (audio) {
            try { audio.pause(); } catch (error) {}
            audio = null;
        }
        if (src && typeof global.Audio === 'function') {
            audio = new global.Audio(src);
            audio.play().catch(error => console.warn('[MinecraftVocabPage] audio play failed', error));
            return;
        }
        if (global.speechSynthesis && global.SpeechSynthesisUtterance) {
            global.speechSynthesis.cancel();
            const utterance = new global.SpeechSynthesisUtterance(card?.word || '');
            utterance.lang = 'en-US';
            global.speechSynthesis.speak(utterance);
        }
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
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-open-pack]').forEach(button => button.addEventListener('click', () => {
            if (global.LearnCenter && typeof global.LearnCenter.openPack === 'function') global.LearnCenter.openPack(PACK_ID);
        }));
        root.querySelectorAll('[data-mv-reveal]').forEach(button => button.addEventListener('click', () => {
            revealed = true;
            renderRoot();
        }));
        root.querySelectorAll('[data-mv-listen]').forEach(button => button.addEventListener('click', () => playAudio(cardForTask(currentTask()))));
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
