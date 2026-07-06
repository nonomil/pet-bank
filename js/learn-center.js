(function () {
    'use strict';

    const state = {
        initialized: false,
        catalog: null,
        packCache: {},
        activePackId: null,
        activeModuleId: null,
        activeLessonId: null,
        activeHubTab: 'today'
    };

    const STORAGE_KEYS = {
        catalogState: 'petbank_learning_catalog_state',
        progress: 'petbank_learning_progress',
        rewards: 'petbank_learning_rewards',
        quizAttempts: 'petbank_learning_quiz_attempts',
        printPrefs: 'petbank_learning_print_prefs',
        dailySheet: 'petbank_learning_daily_sheet',
        dailySheetMode: 'petbank_learning_sheet_mode',
        vocabFocus: 'petbank_learning_vocab_focus'
    };

    const VOCAB_STAGE_SIZE = 6;
    const VOCAB_IMAGE_BY_WORD = {
        block: 'assets/learn/english-vocab/block.webp',
        world: 'assets/learn/english-vocab/world.webp',
        hello: 'assets/learn/english-vocab/hello.webp',
        look: 'assets/learn/english-vocab/look.webp',
        stone: 'assets/learn/english-vocab/stone.webp',
        light: 'assets/learn/english-vocab/light.webp'
    };
    const VOCAB_FALLBACK_IMAGE = 'assets/learn/english-vocab/minecraft-card.webp';
    let activeVocabAudio = null;

    const DAILY_SHEET_MODES = {
        'template-a': {
            id: 'template-a',
            badge: '模板 A',
            title: '幼小衔接超轻量版',
            desc: '4 个核心小项，先让暑假节奏跑顺，不给记录负担。',
            meta: '4 项任务 · 总时长 + 卡点 + 睡前一句话',
            recommended: true
        },
        'template-b': {
            id: 'template-b',
            badge: '模板 B',
            title: '轻量标准版',
            desc: '加上拓展入口和“明天先做什么”，更像一张轻量学习单。',
            meta: '5 项任务 · 适合节奏稳定后再升级',
            recommended: false
        },
        'template-c': {
            id: 'template-c',
            badge: '模板 C',
            title: '错题加强版',
            desc: '加入状态、错题整理和复盘字段，适合后续更完整管理。',
            meta: '5 项任务 · 更完整，也更偏小学阶段',
            recommended: false
        }
    };

    function readStorage(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            return fallback;
        }
    }

    function writeStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {}
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    async function fetchJson(url) {
        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            return await resp.json();
        } catch (err) {
            console.warn('[LearnCenter] fetch failed:', url, err);
            return null;
        }
    }

    async function init() {
        if (state.initialized) return true;
        state.catalog = await fetchJson('data/learn/catalog.json');
        if (!state.catalog || !Array.isArray(state.catalog.packs)) {
            state.catalog = { packs: [] };
        }
        if (!state.activePackId && state.catalog.packs[0]) {
            state.activePackId = state.catalog.packs[0].id;
        }
        const savedCatalogState = readStorage(STORAGE_KEYS.catalogState, null);
        if (savedCatalogState) {
            state.activePackId = savedCatalogState.activePackId || state.activePackId;
            state.activeModuleId = savedCatalogState.activeModuleId || null;
            state.activeLessonId = savedCatalogState.activeLessonId || null;
            state.activeHubTab = savedCatalogState.activeHubTab || state.activeHubTab;
        }
        state.initialized = true;
        return true;
    }

    async function getCatalog() {
        await init();
        return state.catalog;
    }

    async function getPack(packId) {
        await init();
        const id = packId || state.activePackId;
        if (!id) return null;
        if (state.packCache[id]) return state.packCache[id];

        const [manifest, plan, charLibrary] = await Promise.all([
            fetchJson(`data/learn/packs/${id}/manifest.json`),
            fetchJson(`data/learn/packs/${id}/plan.json`),
            fetchJson(`data/learn/packs/${id}/char-library.json`)
        ]);

        state.packCache[id] = {
            manifest,
            plan,
            charLibrary,
            modules: {}
        };
        return state.packCache[id];
    }

    async function getModule(packId, moduleId) {
        const id = packId || state.activePackId;
        if (!id || !moduleId) return null;
        const pack = await getPack(id);
        if (pack.modules[moduleId]) return pack.modules[moduleId];
        const data = await fetchJson(`data/learn/packs/${id}/modules/${moduleId}.json`);
        pack.modules[moduleId] = data;
        return data;
    }

    async function loadAllModules(packId) {
        const pack = await getPack(packId);
        const manifest = pack && pack.manifest;
        if (!manifest || !Array.isArray(manifest.modules)) return {};
        const results = await Promise.all(
            manifest.modules.map(async (moduleMeta) => [moduleMeta.id, await getModule(packId, moduleMeta.id)])
        );
        return Object.fromEntries(results);
    }

    function persistCatalogState() {
        writeStorage(STORAGE_KEYS.catalogState, {
            activePackId: state.activePackId,
            activeModuleId: state.activeModuleId,
            activeLessonId: state.activeLessonId,
            activeHubTab: state.activeHubTab,
            updatedAt: Date.now()
        });
    }

    function resetLearningScroll() {
        try {
            window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
            window.setTimeout(() => window.scrollTo({ top: 0, left: 0, behavior: 'auto' }), 0);
        } catch (err) {
            try { window.scrollTo(0, 0); } catch (innerErr) {}
        }
    }

    function getProgressState() {
        return readStorage(STORAGE_KEYS.progress, {});
    }

    function saveProgressState(progress) {
        writeStorage(STORAGE_KEYS.progress, progress);
    }

    function getRewardState() {
        return readStorage(STORAGE_KEYS.rewards, {});
    }

    function saveRewardState(rewards) {
        writeStorage(STORAGE_KEYS.rewards, rewards);
    }

    function getQuizAttempts() {
        return readStorage(STORAGE_KEYS.quizAttempts, {});
    }

    function saveQuizAttempts(attempts) {
        writeStorage(STORAGE_KEYS.quizAttempts, attempts || {});
    }

    function getQuizKey(packId, moduleId, lessonId) {
        return `${packId}:${moduleId}:${lessonId}`;
    }

    function getLessonQuiz(lesson) {
        const quiz = lesson?.quiz || null;
        if (!quiz || !Array.isArray(quiz.questions) || !quiz.questions.length) return null;
        return quiz;
    }

    function isQuizPassed(packId, moduleId, lessonId) {
        const attempts = getQuizAttempts();
        return !!attempts[getQuizKey(packId, moduleId, lessonId)]?.passed;
    }

    function getPrintPrefs() {
        return readStorage(STORAGE_KEYS.printPrefs, { showPinyin: true });
    }

    function savePrintPrefs(next) {
        writeStorage(STORAGE_KEYS.printPrefs, next);
    }

    function getDateKey(date) {
        const target = date instanceof Date ? date : new Date();
        const year = target.getFullYear();
        const month = String(target.getMonth() + 1).padStart(2, '0');
        const day = String(target.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    function parseDateKey(dateKey) {
        const match = String(dateKey || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) return null;
        const target = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        return Number.isNaN(target.getTime()) ? null : target;
    }

    function getDailySheetState() {
        return readStorage(STORAGE_KEYS.dailySheet, {});
    }

    function saveDailySheetState(next) {
        writeStorage(STORAGE_KEYS.dailySheet, next);
    }

    function normalizeDailySheetMode(modeId) {
        return DAILY_SHEET_MODES[modeId] ? modeId : 'template-a';
    }

    function getDailySheetModes() {
        return Object.values(DAILY_SHEET_MODES);
    }

    function getDailySheetMode() {
        return normalizeDailySheetMode(readStorage(STORAGE_KEYS.dailySheetMode, 'template-a'));
    }

    function setDailySheetMode(modeId) {
        const nextMode = normalizeDailySheetMode(modeId);
        writeStorage(STORAGE_KEYS.dailySheetMode, nextMode);
        const pointsContainer = document.getElementById('points-learning-sheet-container');
        if (pointsContainer) {
            void renderDailyCheckin('points-learning-sheet-container');
        }
        return nextMode;
    }

    function getDefaultDailySheetEntry(dateKey) {
        return {
            date: dateKey,
            modeId: '',
            totalMinutes: '',
            stuckPoint: '',
            reviewText: '',
            parentNote: '',
            nextStep: '',
            extensionCompleted: false,
            energyLevel: '',
            reviewBest: '',
            reviewHard: '',
            errorItems: '',
            errorReviewCompleted: false,
            updatedAt: 0
        };
    }

    function getDailySheetEntry(dateKey) {
        const key = dateKey || getDateKey();
        const state = getDailySheetState();
        return Object.assign(getDefaultDailySheetEntry(key), state?.[key] || {});
    }

    function updateDailySheetEntry(dateKey, patch) {
        const key = dateKey || getDateKey();
        const state = getDailySheetState();
        const prev = getDailySheetEntry(key);
        state[key] = Object.assign({}, prev, patch || {}, {
            modeId: patch && patch.modeId ? patch.modeId : (prev.modeId || getDailySheetMode()),
            date: key,
            updatedAt: Date.now()
        });
        saveDailySheetState(state);
        return state[key];
    }

    function getLessonKey(lesson) {
        if (!lesson) return '';
        if (lesson.id) return String(lesson.id);
        if (lesson.day != null) return `day-${String(lesson.day).padStart(2, '0')}`;
        if (lesson.week != null) return `week-${String(lesson.week).padStart(2, '0')}`;
        return String(lesson.title || 'lesson');
    }

    function renderEmpty(containerId, title, desc) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = `
            <div class="learn-empty">
                <h3 class="learn-section-title">${title}</h3>
                <p>${desc}</p>
            </div>
        `;
    }

    function getModuleMeta(manifest, moduleId) {
        return (manifest?.modules || []).find(module => module.id === moduleId) || null;
    }

    function getVocabCards(module) {
        return Array.isArray(module?.cards) ? module.cards : [];
    }

    function getVocabStats(module) {
        const cards = getVocabCards(module);
        return window.EnglishVocabProgress?.stats?.(cards) || {
            total: cards.length,
            new: cards.length,
            learning: 0,
            mastered: 0
        };
    }

    function getVocabModuleKey(module) {
        return String(module?.id || 'minecraft-vocab');
    }

    function getVocabFocusIndex(module, cards) {
        const cardList = Array.isArray(cards) ? cards : getVocabCards(module);
        if (!cardList.length) return 0;
        const focusState = readStorage(STORAGE_KEYS.vocabFocus, {});
        const saved = Number(focusState?.[getVocabModuleKey(module)]);
        if (Number.isInteger(saved) && saved >= 0 && saved < cardList.length) return saved;
        const progressApi = window.EnglishVocabProgress || null;
        const firstUnmastered = cardList.findIndex(card => (progressApi?.get?.(card.id)?.status || 'new') !== 'mastered');
        return firstUnmastered >= 0 ? firstUnmastered : 0;
    }

    function setVocabFocusIndex(module, nextIndex) {
        const cards = getVocabCards(module);
        if (!cards.length) return;
        const normalized = ((Number(nextIndex || 0) % cards.length) + cards.length) % cards.length;
        const focusState = readStorage(STORAGE_KEYS.vocabFocus, {});
        focusState[getVocabModuleKey(module)] = normalized;
        writeStorage(STORAGE_KEYS.vocabFocus, focusState);
    }

    function getVocabStageItems(cards, focusIndex) {
        const safeCards = Array.isArray(cards) ? cards : [];
        if (!safeCards.length) return [];
        const maxStart = Math.max(0, safeCards.length - VOCAB_STAGE_SIZE);
        const stageStart = Math.min(Math.floor(Number(focusIndex || 0) / VOCAB_STAGE_SIZE) * VOCAB_STAGE_SIZE, maxStart);
        return safeCards.slice(stageStart, stageStart + VOCAB_STAGE_SIZE).map((card, offset) => ({
            card,
            index: stageStart + offset
        }));
    }

    function getVocabCardImage(card) {
        const explicit = String(card?.image || '').trim();
        if (explicit) return explicit;
        return VOCAB_IMAGE_BY_WORD[String(card?.word || '').toLowerCase()] || VOCAB_FALLBACK_IMAGE;
    }

    function getVocabCardAudio(card) {
        const explicit = String(card?.audio || '').trim();
        if (explicit) return explicit;
        const word = String(card?.word || '').trim().toLowerCase();
        return word ? `assets/learn/english-vocab/audio/${word}.mp3` : '';
    }

    function playVocabAudio(src) {
        if (!src) return;
        try {
            if (activeVocabAudio) {
                activeVocabAudio.pause();
                activeVocabAudio.currentTime = 0;
            }
            activeVocabAudio = new Audio(src);
            activeVocabAudio.play().catch(() => {});
        } catch (err) {}
    }

    function getModuleProgress(packId, module) {
        if (module?.type === 'vocab') {
            const vocabStats = getVocabStats(module);
            return {
                total: vocabStats.total,
                completed: vocabStats.mastered,
                percent: vocabStats.total ? Math.round((vocabStats.mastered / vocabStats.total) * 100) : 0
            };
        }
        const lessonIds = Array.isArray(module?.lessons) ? module.lessons.map(getLessonKey) : [];
        const progress = getProgressState();
        const done = progress?.[packId]?.modules?.[module?.id]?.completedLessons || [];
        const completed = lessonIds.filter(id => done.includes(id)).length;
        return {
            total: lessonIds.length,
            completed,
            percent: lessonIds.length ? Math.round((completed / lessonIds.length) * 100) : 0
        };
    }

    function getPackProgress(packId, modulesById) {
        const values = Object.values(modulesById || {});
        let total = 0;
        let completed = 0;
        values.forEach(module => {
            const stats = getModuleProgress(packId, module);
            total += stats.total;
            completed += stats.completed;
        });
        return {
            total,
            completed,
            percent: total ? Math.round((completed / total) * 100) : 0
        };
    }

    function isLessonCompleted(packId, moduleId, lessonId) {
        const progress = getProgressState();
        const completed = progress?.[packId]?.modules?.[moduleId]?.completedLessons || [];
        return completed.includes(lessonId);
    }

    function rewardForModule(manifest, moduleId) {
        const rules = manifest?.rewardRules || {};
        return rules[moduleId] || rules.default || 1;
    }

    function resolvePackCapabilities(manifest) {
        const packType = manifest?.packType || 'internal';
        return {
            packType,
            sourceAdapter: manifest?.sourceAdapter || null,
            customPackEnabled: !!manifest?.customPackEnabled,
            hasExternalLessons: packType === 'hybrid' || packType === 'external-gateway' || !!manifest?.sourceAdapter,
            hasStreakRule: !!manifest?.streakRule
        };
    }

    function resolveLessonSource(pack, module, lesson) {
        const manifest = pack?.manifest || null;
        const lessonSource = lesson?.source || null;
        const moduleSource = module?.source || null;
        if (!lessonSource && !moduleSource && module?.type !== 'external-reader') return null;
        return {
            kind: lessonSource?.kind || moduleSource?.kind || (module?.type === 'external-reader' ? 'external-chapter' : 'internal-content'),
            adapterId: lessonSource?.adapterId || module?.adapterId || manifest?.sourceAdapter || null,
            provider: lessonSource?.provider || moduleSource?.provider || null,
            chapterSlug: lessonSource?.chapterSlug || null,
            url: lessonSource?.url || null,
            baseUrl: moduleSource?.baseUrl || null,
            routePattern: moduleSource?.routePattern || null,
            label: lessonSource?.label || null
        };
    }

    function resolveLessonLaunchUrl(pack, module, lesson) {
        const source = resolveLessonSource(pack, module, lesson);
        if (!source) return '';
        if (source.url) return source.url;
        if (source.routePattern && source.chapterSlug) {
            return source.routePattern.replace('{chapterSlug}', source.chapterSlug);
        }
        return source.baseUrl || '';
    }

    function resolveLessonReward(manifest, moduleId, lesson) {
        const rules = manifest?.rewardRules || {};
        const lessonPoints = Number(lesson?.completion?.points);
        if (lessonPoints > 0) return lessonPoints;
        const rewardKeyPoints = Number(lesson?.rewardKey ? rules[lesson.rewardKey] : 0);
        if (rewardKeyPoints > 0) return rewardKeyPoints;
        return rewardForModule(manifest, moduleId);
    }

    function getDailyBundlePoints(manifest) {
        return Number(manifest?.rewardRules?.dailyBundle) || 0;
    }

    function getLessonCompletionBadge(completed) {
        return completed ? '✅ 本页已打勾' : '🕒 本页还没打勾';
    }

    function getLessonCompletionIntro(manifest, moduleId, module, rewardPoints, completed) {
        if (completed) {
            return '这一页已经打过勾了，完成记录和成长分都已经存好，可以直接继续下一节。';
        }

        const actionLead = module?.type === 'external-reader'
            ? '打开外部点读页读完后'
            : module?.type === 'resource-hub'
            ? '看完今天的网站入口后'
            : module?.type === 'review'
                ? '做完这一页复盘后'
                : '读完这一页后';
        let message = `${actionLead}点一下打勾，系统会自动记录进度并加入 ${rewardPoints} 成长分。`;
        const bundlePoints = getDailyBundlePoints(manifest);
        if (bundlePoints && (moduleId === 'morning-reading' || moduleId === 'literacy-45days')) {
            message += `同一天晨读和识字都完成，再加 ${bundlePoints} 分。`;
        }
        return message;
    }

    function getLessonCompletionHint(manifest, moduleId, module, completed) {
        if (completed) {
            return '进度已经保存，下次回来也会继续累计到“我的进度”和积分系统里。';
        }
        if (module?.type === 'external-reader') {
            const streakRule = manifest?.streakRule;
            if (Number(streakRule?.points) > 0 && Number(streakRule?.every) > 0) {
                return `先打开点读页，学完回来打勾；连续完成 ${streakRule.every} 节英语章节，还会再送 ${streakRule.points} 分连读奖励。`;
            }
            return '先打开点读页，学完回来点这里，也能把进度和成长分记回当前项目。';
        }
        if (module?.type === 'resource-hub') {
            return '如果跳去外部网站学习，学完回来再点这里，也能把进度和积分记回当前项目。';
        }
        const bundlePoints = getDailyBundlePoints(manifest);
        if (bundlePoints && (moduleId === 'morning-reading' || moduleId === 'literacy-45days')) {
            return `今天把晨读和识字都打勾，还会额外送 ${bundlePoints} 分连读奖励。`;
        }
        return '点击后会立刻打勾记录本页学习，并弹出成长分提示。';
    }

    function getLessonCompletionToast(result) {
        if (result.totalPoints > 0 && (result.bundleGranted || result.streakGranted)) {
            return `✅ 读完打勾成功，成长分 +${result.totalPoints}（含连读奖励）`;
        }
        if (result.totalPoints > 0) {
            return `✅ 读完打勾成功，成长分 +${result.totalPoints}`;
        }
        return '✅ 读完打勾完成，进度已保存';
    }

    function getLessonCompletionSuccessNote(result) {
        if (result.totalPoints > 0 && (result.bundleGranted || result.streakGranted)) {
            return `已打勾完成，成长分 +${result.totalPoints} 已到账，今天的连读奖励也一起记上了。`;
        }
        if (result.totalPoints > 0) {
            return `已打勾完成，成长分 +${result.totalPoints} 已到账，可以继续下一节。`;
        }
        return '已打勾完成，进度已保存；这页的成长分之前已经领过了。';
    }

    function getContinueLessonId(packId, module) {
        if (module?.type === 'vocab') return 'vocab-practice';
        if (!Array.isArray(module?.lessons) || !module.lessons.length) return null;
        const firstIncomplete = module.lessons.find(lesson => !isLessonCompleted(packId, module.id, getLessonKey(lesson)));
        return getLessonKey(firstIncomplete || module.lessons[0]);
    }

    function setHubTab(tabId) {
        state.activeHubTab = tabId || 'today';
        persistCatalogState();
    }

    function renderHubEntryCard(options) {
        return `
            <article class="learn-entry-card ${options?.theme ? `learn-entry-card-${options.theme}` : ''}">
                <div class="learn-entry-art">
                    <span class="learn-entry-art-chip">${options?.chip || '学习入口'}</span>
                    <strong>${options?.artTitle || ''}</strong>
                    <p>${options?.artText || ''}</p>
                </div>
                <div class="learn-entry-copy">
                    <span class="learn-entry-kicker">${options?.kicker || '继续学习'}</span>
                    <h3>${options?.title || '学习卡片'}</h3>
                    <p>${options?.desc || ''}</p>
                    ${options?.meta ? `<div class="learn-entry-meta">${options.meta}</div>` : ''}
                    <div class="learn-card-actions">
                        ${options?.primaryAction || ''}
                        ${options?.secondaryAction || ''}
                    </div>
                </div>
            </article>
        `;
    }

    function renderPortalCard(options) {
        const badges = Array.isArray(options?.badges) ? options.badges : [];
        return `
            <button class="learn-portal-card ${options?.theme ? `learn-portal-card-${options.theme}` : ''}" type="button" data-learn-portal-card="${options?.id || ''}" onclick="${options?.onclick || ''}">
                <div class="learn-portal-media ${options?.imageSrc ? 'has-image' : ''}">
                    ${options?.imageSrc
                        ? `
                            <img src="${options.imageSrc}" alt="${options?.title || '学习入口'}" ${options?.imageStyle ? `style="${options.imageStyle}"` : ''}>
                            ${badges.length ? `<div class="learn-portal-badges learn-portal-badges-overlay">${badges.map(item => `<span>${item}</span>`).join('')}</div>` : ''}
                        `
                        : `
                            <div class="learn-portal-art">
                                <div class="learn-portal-art-top">
                                    <span>${options?.emoji || '📚'}</span>
                                    ${options?.chip ? `<b>${options.chip}</b>` : ''}
                                </div>
                                <strong>${options?.artTitle || ''}</strong>
                                <p>${options?.artText || ''}</p>
                                ${badges.length ? `<div class="learn-portal-badges">${badges.map(item => `<span>${item}</span>`).join('')}</div>` : ''}
                            </div>
                        `}
                </div>
                <div class="learn-portal-copy">
                    <span class="learn-portal-kicker">${options?.kicker || '快速入口'}</span>
                    <strong>${options?.title || '学习入口'}</strong>
                    <p>${options?.desc || ''}</p>
                    <div class="learn-portal-foot">
                        <span>${options?.cta || '点击进入'}</span>
                        <i aria-hidden="true">→</i>
                    </div>
                </div>
            </button>
        `;
    }

    function getLessonById(module, lessonId) {
        const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
        return lessons.find(lesson => getLessonKey(lesson) === lessonId) || null;
    }

    function parseLessonDay(lessonId) {
        const match = String(lessonId || '').match(/day-(\d+)/);
        return match ? Number(match[1]) : null;
    }

    function getRecommendedLessonIdForDay(packId, module, preferredDay) {
        if (!module) return null;
        const fallback = getContinueLessonId(packId, module);
        if (!preferredDay) return fallback;
        const preferredId = `day-${String(preferredDay).padStart(2, '0')}`;
        if (!getLessonById(module, preferredId)) return fallback;
        if (!isLessonCompleted(packId, module.id, preferredId)) return preferredId;
        const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
        const nextOpen = lessons.find(lesson => {
            const lessonId = getLessonKey(lesson);
            const lessonDay = parseLessonDay(lessonId);
            return lessonDay != null && lessonDay >= preferredDay && !isLessonCompleted(packId, module.id, lessonId);
        });
        return getLessonKey(nextOpen || lessons[0] || null) || fallback;
    }

    function formatDateText(date) {
        if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
        return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    }

    function getTodayLearningPlan(summerRecord, siteRecord, targetDate) {
        const today = targetDate instanceof Date ? targetDate : new Date();
        const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const plan = summerRecord?.pack?.plan;
        const weekCount = Array.isArray(plan?.weeks) ? plan.weeks.length : 9;
        const startDate = new Date(normalizedToday.getFullYear(), 6, 1);
        const dayIndex = Math.floor((normalizedToday - startDate) / 86400000) + 1;
        const inSummerWindow = dayIndex >= 1 && dayIndex <= 60;
        const readingModule = summerRecord?.modulesById?.['morning-reading'] || null;
        const literacyModule = summerRecord?.modulesById?.['literacy-45days'] || null;
        const reviewModule = summerRecord?.modulesById?.['weekly-review'] || null;
        const guidedSitesModule = siteRecord?.modulesById?.['guided-sites'] || null;

        if (inSummerWindow) {
            const readingDay = Math.min(dayIndex, 60);
            const literacyDay = Math.min(dayIndex, 45);
            const weekIndex = Math.min(Math.floor((dayIndex - 1) / 7) + 1, weekCount);
            const targetWeek = (plan?.weeks || [])[weekIndex - 1] || null;
            const reviewIndex = Math.min(Math.floor((dayIndex - 1) / 7) + 1, 8);
            const reviewLessonId = dayIndex % 7 === 0 && reviewModule ? `week-${String(reviewIndex).padStart(2, '0')}` : null;
            const siteLessonIndex = guidedSitesModule ? Math.min(4, Math.ceil(weekIndex / 2)) : null;
            return {
                todayLabel: formatDateText(normalizedToday),
                mode: 'calendar',
                note: `按 ${formatDateText(normalizedToday)} 的暑假节奏推荐`,
                readingDay,
                literacyDay,
                targetWeek,
                reviewLessonId,
                siteLessonId: siteLessonIndex ? `day-${String(siteLessonIndex).padStart(2, '0')}` : null
            };
        }

        const readingFallback = getContinueLessonId(summerRecord?.id, readingModule) || 'day-01';
        const literacyFallback = getContinueLessonId(summerRecord?.id, literacyModule) || 'day-01';
        const reviewFallback = getContinueLessonId(summerRecord?.id, reviewModule) || 'week-01';
        const siteFallback = getContinueLessonId(siteRecord?.id, guidedSitesModule) || 'day-01';
        return {
            todayLabel: formatDateText(normalizedToday),
            mode: 'progress',
            note: `${formatDateText(normalizedToday)} 不在暑假 60 天排程内，先按当前进度继续`,
            readingDay: parseLessonDay(readingFallback) || 1,
            literacyDay: parseLessonDay(literacyFallback) || 1,
            targetWeek: null,
            reviewLessonId: reviewFallback,
            siteLessonId: siteFallback
        };
    }

    function getPoemLessonForDay(poemsModule, day) {
        const lessons = Array.isArray(poemsModule?.lessons) ? poemsModule.lessons : [];
        if (!lessons.length) return null;
        const index = Math.max(0, Math.min(lessons.length - 1, (Number(day) || 1) - 1));
        return lessons[index] || lessons[0] || null;
    }

    function renderDailyTaskAction(action) {
        if (!action) return '';
        return `<button class="learn-btn ${action.kind === 'secondary' ? 'learn-btn-secondary' : 'learn-btn-primary'}" ${action.attrs || ''}>${action.label}</button>`;
    }

    function getDailySheetCompletionStats(tasks) {
        const list = Array.isArray(tasks) ? tasks : [];
        const requiredTasks = list.filter(item => !item.optional);
        const optionalTasks = list.filter(item => !!item.optional);
        const requiredCompleted = requiredTasks.filter(item => item.completed).length;
        const optionalCompleted = optionalTasks.filter(item => item.completed).length;
        return {
            requiredCount: requiredTasks.length,
            requiredCompleted,
            optionalCount: optionalTasks.length,
            optionalCompleted,
            allRequiredCompleted: requiredTasks.length > 0 && requiredCompleted === requiredTasks.length
        };
    }

    function buildDailyTaskRow(task) {
        const actions = Array.isArray(task?.actions)
            ? task.actions.filter(Boolean)
            : (task?.action ? [task.action] : []);
        const stateText = task?.completed
            ? '✅ 已完成'
            : (task?.optional ? '✨ 可选加做' : '🕒 待打勾');
        const stateClass = task?.completed
            ? 'is-completed'
            : (task?.optional ? 'is-optional' : '');
        const metaChips = Array.isArray(task?.metaChips) && task.metaChips.length
            ? `<div class="learn-daily-task-meta">${task.metaChips.map(item => `<span>${item}</span>`).join('')}</div>`
            : '';
        return `
            <article class="learn-daily-task ${task?.completed ? 'is-completed' : ''}" data-daily-task-row="${task?.id || ''}">
                <div class="learn-daily-task-top">
                    <span class="learn-daily-task-tag">${task?.label || '任务'}</span>
                    <span class="learn-daily-task-state ${stateClass}">${stateText}</span>
                </div>
                <h4>${task?.title || '今日任务'}</h4>
                <p>${task?.desc || ''}</p>
                ${metaChips}
                ${actions.length ? `<div class="learn-card-actions">${actions.map(renderDailyTaskAction).join('')}</div>` : ''}
            </article>
        `;
    }

    function renderMinuteButtons(entry, dateKey, minuteOptions) {
        return minuteOptions.map(item => `
            <button class="learn-daily-minute-chip ${Number(entry.totalMinutes) === item ? 'is-active' : ''}" data-daily-set-minutes="${item}" data-daily-date-key="${dateKey}">${item} 分钟</button>
        `).join('');
    }

    function renderEnergyButtons(entry, dateKey) {
        const options = [
            { id: 'great', label: '精神好' },
            { id: 'okay', label: '一般' },
            { id: 'tired', label: '累了' }
        ];
        return options.map(item => `
            <button class="learn-daily-minute-chip ${entry.energyLevel === item.id ? 'is-active' : ''}" data-daily-set-energy="${item.id}" data-daily-date-key="${dateKey}">${item.label}</button>
        `).join('');
    }

    function renderDailySheetHeader(config) {
        return `
            <div class="learn-daily-sheet-head">
                <div>
                    <span class="learn-card-kicker">${config.kicker}</span>
                    <h3>${config.title || '今日学习单'}</h3>
                    <p>${config.desc || ''}</p>
                </div>
                <div class="learn-daily-sheet-score ${config.completed ? 'is-completed' : ''}">
                    <strong>${config.scoreText}</strong>
                    <span>${config.scoreHint}</span>
                </div>
            </div>
        `;
    }

    function renderDailySheetTemplateA(options) {
        const dateKey = options?.dateKey || getDateKey();
        const entry = getDailySheetEntry(dateKey);
        const readingDay = Number(options?.readingDay) || 1;
        const readingCompleted = !!options?.readingCompleted;
        const literacyCompleted = !!options?.literacyCompleted;
        const reviewCompleted = !!String(entry.reviewText || '').trim();
        const tasks = [
            {
                id: 'reading',
                label: '晨读',
                title: options?.readingTitle || '今天晨读',
                desc: readingCompleted ? '今天的晨读已经打勾，可以再顺一遍。' : '先打开今天晨读，读顺就可以，不用拖太久。',
                completed: readingCompleted,
                metaChips: ['建议 5 分', '主线任务'],
                action: options?.readingLessonId ? {
                    label: readingCompleted ? '再看晨读' : '打开晨读',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="morning-reading" data-lesson-id="${options.readingLessonId}"`,
                    kind: readingCompleted ? 'secondary' : 'primary'
                } : null
            },
            {
                id: 'poem',
                label: '今日古诗',
                title: options?.poemTitle || '今天的古诗',
                desc: readingCompleted
                    ? `今天的古诗《${options?.poemTitle || '今日古诗'}》已经跟晨读一起完成了。`
                    : `今天读《${options?.poemTitle || '今日古诗'}》，一句拼音一句中文，跟晨读一起走。`,
                completed: readingCompleted,
                metaChips: ['跟晨读联动', '一句拼音一句中文'],
                action: options?.readingLessonId ? {
                    label: readingCompleted ? '再读古诗' : '去晨读里读',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="morning-reading" data-lesson-id="${options.readingLessonId}"`,
                    kind: 'secondary'
                } : null
            },
            {
                id: 'literacy',
                label: '识字',
                title: options?.literacyTitle || '今天识字',
                desc: literacyCompleted ? '今天的识字已经完成，可以轻轻回看一遍。' : '今天先认字、指读短句，重在开口，不追求写很多。',
                completed: literacyCompleted,
                metaChips: ['建议 8 分', '认读为主'],
                action: options?.literacyLessonId ? {
                    label: literacyCompleted ? '再看识字' : '打开识字',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="literacy-45days" data-lesson-id="${options.literacyLessonId}"`,
                    kind: literacyCompleted ? 'secondary' : 'primary'
                } : null
            },
            {
                id: 'review',
                label: '睡前复盘',
                title: reviewCompleted ? '今晚一句话已经写好了' : '睡前说一句今天最顺的一项',
                desc: reviewCompleted
                    ? `今晚的小复盘已经保存：${escapeHtml(entry.reviewText)}`
                    : '睡前花 1 分钟，说一句今天最顺的地方，帮助孩子把一天轻轻收住。',
                completed: reviewCompleted,
                metaChips: ['建议 1 分', '睡前收口'],
                action: {
                    label: reviewCompleted ? '修改一句话' : '写一句话',
                    attrs: 'data-daily-focus-field="review-text"',
                    kind: 'secondary'
                }
            }
        ];
        const stats = getDailySheetCompletionStats(tasks);
        const summaryText = stats.allRequiredCompleted
            ? '今天这张学习单已经完成啦，晚上轻轻收尾就好。'
            : '今天先把 4 个核心小项慢慢走完，建议总时长控制在 15 到 20 分钟。';
        const minuteButtons = renderMinuteButtons(entry, dateKey, [10, 15, 20, 30]);

        return `
            <section class="learn-daily-sheet" data-learn-daily-sheet>
                ${renderDailySheetHeader({
                    kicker: '模板 A · 幼小衔接超轻量版',
                    title: '今日学习单',
                    desc: `${formatDateText(new Date())} · 第 ${readingDay} 天。${summaryText}`,
                    scoreText: `${stats.requiredCompleted}/${stats.requiredCount}`,
                    scoreHint: stats.allRequiredCompleted ? '今天收口完成' : '今天慢慢完成',
                    completed: stats.allRequiredCompleted
                })}
                <div class="learn-daily-task-grid">
                    ${tasks.map(buildDailyTaskRow).join('')}
                </div>
                <div class="learn-daily-sheet-meta">
                    <section class="learn-daily-meta-card">
                        <h4>今天用了多久？</h4>
                        <p>幼小衔接先看总时长，不急着逐行记时间。</p>
                        <div class="learn-daily-minute-row">${minuteButtons}</div>
                        <div class="learn-daily-minute-note">${entry.totalMinutes ? `当前已记：大约 ${entry.totalMinutes} 分钟` : '还没记总时长，学完后点一个最接近的就行。'}</div>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>今天卡住的 1 个点</h4>
                        <p>只记 1 个最需要明天再看一眼的点，不做重错题本。</p>
                        <textarea class="learn-daily-textarea" data-daily-stuck-note placeholder="比如：&ldquo;雀&rdquo;还不太熟，或者这一句读快了会卡。">${escapeHtml(entry.stuckPoint)}</textarea>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>睡前一句话</h4>
                        <p>睡前说一句今天最顺的一项，写上去就算完成复盘。</p>
                        <textarea class="learn-daily-textarea" data-daily-review-text placeholder="比如：今天古诗读得最顺。">${escapeHtml(entry.reviewText)}</textarea>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>家长一句话</h4>
                        <p>这一项可选，后面做打印版时也能复用。</p>
                        <input class="learn-daily-input" data-daily-parent-note type="text" value="${escapeHtml(entry.parentNote)}" placeholder="比如：今天状态不错，愿意开口读。" />
                    </section>
                </div>
                <div class="learn-card-actions learn-daily-sheet-actions">
                    <button class="learn-btn learn-btn-primary" data-daily-save-summary="1" data-daily-date-key="${dateKey}">${reviewCompleted ? '更新今天的小结' : '保存今天的小结'}</button>
                    <button class="learn-btn learn-btn-secondary" data-daily-focus-field="review-text">${reviewCompleted ? '查看睡前一句话' : '去写睡前一句话'}</button>
                </div>
            </section>
        `;
    }

    function renderDailySheetTemplateB(options) {
        const dateKey = options?.dateKey || getDateKey();
        const entry = getDailySheetEntry(dateKey);
        const reviewCompleted = !!String(entry.reviewText || '').trim() && !!String(entry.nextStep || '').trim();
        const extensionCompleted = !!entry.extensionCompleted;
        const tasks = [
            {
                id: 'reading',
                label: '晨读',
                title: options?.readingTitle || '今天晨读',
                desc: options?.readingCompleted ? '晨读已经打勾，今天可以直接复看。' : '先把晨读顺一遍，完成后积分会自动同步。',
                completed: !!options?.readingCompleted,
                metaChips: ['建议 5 分', '自动同步'],
                action: options?.readingLessonId ? {
                    label: options?.readingCompleted ? '再看晨读' : '打开晨读',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="morning-reading" data-lesson-id="${options.readingLessonId}"`,
                    kind: options?.readingCompleted ? 'secondary' : 'primary'
                } : null
            },
            {
                id: 'poem',
                label: '古诗',
                title: options?.poemTitle || '今日古诗',
                desc: options?.readingCompleted ? '古诗已跟晨读一起完成。' : '古诗继续跟晨读走，不额外拆开一大页。',
                completed: !!options?.readingCompleted,
                metaChips: ['建议 3 分', '晨读联动'],
                action: options?.readingLessonId ? {
                    label: options?.readingCompleted ? '再读古诗' : '去晨读里读',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="morning-reading" data-lesson-id="${options.readingLessonId}"`,
                    kind: 'secondary'
                } : null
            },
            {
                id: 'literacy',
                label: '识字',
                title: options?.literacyTitle || '今天识字',
                desc: options?.literacyCompleted ? '识字已经完成，今天的主线任务基本收住了。' : '识字继续以认读和短句开口为主，不追求写很多。',
                completed: !!options?.literacyCompleted,
                metaChips: ['建议 8 分', '自动同步'],
                action: options?.literacyLessonId ? {
                    label: options?.literacyCompleted ? '再看识字' : '打开识字',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="literacy-45days" data-lesson-id="${options.literacyLessonId}"`,
                    kind: options?.literacyCompleted ? 'secondary' : 'primary'
                } : null
            },
            {
                id: 'extension',
                label: '拓展',
                title: options?.siteTitle ? `拓展：${options.siteTitle}` : '拓展：学习网站 / 打印讲义',
                desc: extensionCompleted
                    ? '今天的拓展入口已经打勾，做一个就够。'
                    : '有余力时再做一项拓展：看看学习网站入口，或者打开打印讲义。',
                completed: extensionCompleted,
                optional: true,
                metaChips: ['可选', '网站 / 讲义 二选一'],
                actions: [
                    options?.siteLessonId
                        ? {
                            label: '打开拓展入口',
                            attrs: `data-daily-open-lesson="1" data-pack-id="${options.sitePackId}" data-module-id="guided-sites" data-lesson-id="${options.siteLessonId}"`,
                            kind: extensionCompleted ? 'secondary' : 'primary'
                        }
                        : {
                            label: '打开打印讲义',
                            attrs: `data-daily-open-print="1" data-pack-id="${options.packId}"`,
                            kind: extensionCompleted ? 'secondary' : 'primary'
                        },
                    {
                        label: extensionCompleted ? '取消拓展打勾' : '标记拓展完成',
                        attrs: `data-daily-toggle-flag="extensionCompleted" data-daily-date-key="${dateKey}"`,
                        kind: 'secondary'
                    }
                ]
            },
            {
                id: 'review',
                label: '复盘',
                title: reviewCompleted ? '今晚复盘和明日提醒都写好了' : '睡前写一句今天最顺的，再写明天先做什么',
                desc: reviewCompleted
                    ? `今晚复盘：${escapeHtml(entry.reviewText)} 明天先做：${escapeHtml(entry.nextStep)}`
                    : '先轻轻收尾，再给明天留一个起步提示，第二天更容易开始。',
                completed: reviewCompleted,
                metaChips: ['建议 2 分', '睡前收口'],
                action: {
                    label: reviewCompleted ? '修改复盘' : '去写复盘',
                    attrs: 'data-daily-focus-field="review-text"',
                    kind: 'secondary'
                }
            }
        ];
        const stats = getDailySheetCompletionStats(tasks);
        const minuteButtons = renderMinuteButtons(entry, dateKey, [15, 18, 20, 25, 30]);
        const summaryText = stats.allRequiredCompleted
            ? `今天 4 项核心已经收口${stats.optionalCompleted ? '，拓展也完成了。' : '，有余力的话可以顺手加一个拓展。'}`
            : '今天先完成 4 项核心，小拓展有余力再加，不需要硬塞满。';

        return `
            <section class="learn-daily-sheet learn-daily-sheet-b" data-learn-daily-sheet>
                ${renderDailySheetHeader({
                    kicker: '模板 B · 轻量标准版',
                    title: '今日学习单',
                    desc: `${formatDateText(new Date())} · 第 ${Number(options?.readingDay) || 1} 天。${summaryText}`,
                    scoreText: `${stats.requiredCompleted}/${stats.requiredCount}`,
                    scoreHint: stats.allRequiredCompleted ? '核心任务收口' : '先做核心 4 项',
                    completed: stats.allRequiredCompleted
                })}
                <div class="learn-daily-task-grid">
                    ${tasks.map(buildDailyTaskRow).join('')}
                </div>
                <div class="learn-daily-sheet-meta">
                    <section class="learn-daily-meta-card">
                        <h4>今日总时长</h4>
                        <p>这版开始记总时长，但还不用拆到每一项。</p>
                        <div class="learn-daily-minute-row">${minuteButtons}</div>
                        <div class="learn-daily-minute-note">${entry.totalMinutes ? `当前已记：大约 ${entry.totalMinutes} 分钟` : '学完后点一个最接近的时间就行。'}</div>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>今天卡住的点</h4>
                        <p>只抓一个最需要明天回看的点，保持轻量。</p>
                        <textarea class="learn-daily-textarea" data-daily-stuck-note placeholder="比如：&ldquo;欲穷千里目&rdquo;读快了会卡。">${escapeHtml(entry.stuckPoint)}</textarea>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>睡前一句话</h4>
                        <p>写一句今天最顺的一项，帮助孩子把成就感留住。</p>
                        <textarea class="learn-daily-textarea" data-daily-review-text placeholder="比如：今天晨读状态最顺。">${escapeHtml(entry.reviewText)}</textarea>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>明天先做什么</h4>
                        <p>只写一句启动动作，第二天就更容易开场。</p>
                        <input class="learn-daily-input" data-daily-next-step type="text" value="${escapeHtml(entry.nextStep)}" placeholder="比如：先读晨读，再接古诗。" />
                    </section>
                </div>
                <div class="learn-card-actions learn-daily-sheet-actions">
                    <button class="learn-btn learn-btn-primary" data-daily-save-summary="1" data-daily-date-key="${dateKey}">${reviewCompleted ? '更新今天学习单' : '保存今天学习单'}</button>
                    <button class="learn-btn learn-btn-secondary" data-daily-focus-field="next-step">${String(entry.nextStep || '').trim() ? '查看明天先做什么' : '去写明天先做什么'}</button>
                </div>
            </section>
        `;
    }

    function renderDailySheetTemplateC(options) {
        const dateKey = options?.dateKey || getDateKey();
        const entry = getDailySheetEntry(dateKey);
        const reviewCompleted = !!String(entry.reviewBest || '').trim()
            && !!String(entry.reviewHard || '').trim()
            && !!String(entry.nextStep || '').trim();
        const errorReviewCompleted = !!entry.errorReviewCompleted;
        const hasErrorItems = !!String(entry.errorItems || entry.stuckPoint || '').trim();
        const tasks = [
            {
                id: 'reading',
                label: '晨读',
                title: options?.readingTitle || '今天晨读',
                desc: options?.readingCompleted ? '晨读已经完成，可以顺着今天的卡点再看一遍。' : '先把晨读完成，今天主线的第一格就能自动打勾。',
                completed: !!options?.readingCompleted,
                metaChips: ['计划 5 分', '主线'],
                action: options?.readingLessonId ? {
                    label: options?.readingCompleted ? '再看晨读' : '打开晨读',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="morning-reading" data-lesson-id="${options.readingLessonId}"`,
                    kind: options?.readingCompleted ? 'secondary' : 'primary'
                } : null
            },
            {
                id: 'poem',
                label: '古诗',
                title: options?.poemTitle || '今日古诗',
                desc: options?.readingCompleted ? '古诗已经跟晨读同步完成。' : '保持一句拼音一句中文，重在读顺和节奏。',
                completed: !!options?.readingCompleted,
                metaChips: ['计划 3 分', '交替朗读'],
                action: options?.readingLessonId ? {
                    label: options?.readingCompleted ? '再读古诗' : '去晨读里读',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="morning-reading" data-lesson-id="${options.readingLessonId}"`,
                    kind: 'secondary'
                } : null
            },
            {
                id: 'literacy',
                label: '识字',
                title: options?.literacyTitle || '今天识字',
                desc: options?.literacyCompleted ? '识字完成后，今天的中文主线就差不多收住了。' : '识字这格仍然以认读和短句开口为主。',
                completed: !!options?.literacyCompleted,
                metaChips: ['计划 8 分', '认读为主'],
                action: options?.literacyLessonId ? {
                    label: options?.literacyCompleted ? '再看识字' : '打开识字',
                    attrs: `data-daily-open-lesson="1" data-pack-id="${options.packId}" data-module-id="literacy-45days" data-lesson-id="${options.literacyLessonId}"`,
                    kind: options?.literacyCompleted ? 'secondary' : 'primary'
                } : null
            },
            {
                id: 'error-review',
                label: '错题整理',
                title: hasErrorItems ? '把今天卡住的字句顺手整理一下' : '今天如果有卡点，就顺手整理一下',
                desc: errorReviewCompleted
                    ? '今天的错题整理已经打勾。'
                    : (hasErrorItems
                        ? '今天已经记下卡点了，顺手整理一下，明天就更容易回看。'
                        : '没有明显卡点也没关系，这一项可以留空。'),
                completed: errorReviewCompleted,
                optional: true,
                metaChips: ['计划 5 分', hasErrorItems ? '建议整理' : '可选'],
                actions: [
                    {
                        label: hasErrorItems ? '去整理卡点' : '先写卡点',
                        attrs: 'data-daily-focus-field="error-items"',
                        kind: errorReviewCompleted ? 'secondary' : 'primary'
                    },
                    {
                        label: errorReviewCompleted ? '取消整理打勾' : '标记整理完成',
                        attrs: `data-daily-toggle-flag="errorReviewCompleted" data-daily-date-key="${dateKey}"`,
                        kind: 'secondary'
                    }
                ]
            },
            {
                id: 'review',
                label: '睡前复盘',
                title: reviewCompleted ? '今晚复盘三小项已经写好' : '写下今天最顺、最难，以及明天先做什么',
                desc: reviewCompleted
                    ? `最顺：${escapeHtml(entry.reviewBest)}；最难：${escapeHtml(entry.reviewHard)}；明天先做：${escapeHtml(entry.nextStep)}`
                    : '这版更接近小学学习单，但先写短句就够，不需要长段落。',
                completed: reviewCompleted,
                metaChips: ['计划 3 分', '睡前收口'],
                action: {
                    label: reviewCompleted ? '修改复盘' : '去写复盘',
                    attrs: 'data-daily-focus-field="review-best"',
                    kind: 'secondary'
                }
            }
        ];
        const stats = getDailySheetCompletionStats(tasks);
        const minuteButtons = renderMinuteButtons(entry, dateKey, [15, 20, 25, 30, 35]);
        const energyButtons = renderEnergyButtons(entry, dateKey);
        const summaryText = stats.allRequiredCompleted
            ? `${hasErrorItems && !errorReviewCompleted ? '核心任务已完成，卡点整理有空再补。' : '核心任务已经收口，今天这张学习单可以安心结束。'}`
            : '这版更完整，但也不用全写满，先把核心四项完成最重要。';

        return `
            <section class="learn-daily-sheet learn-daily-sheet-c" data-learn-daily-sheet>
                ${renderDailySheetHeader({
                    kicker: '模板 C · 错题加强版',
                    title: '今日学习单',
                    desc: `${formatDateText(new Date())} · 第 ${Number(options?.readingDay) || 1} 天。${summaryText}`,
                    scoreText: `${stats.requiredCompleted}/${stats.requiredCount}`,
                    scoreHint: stats.allRequiredCompleted ? '核心任务收口' : '先做核心 4 项',
                    completed: stats.allRequiredCompleted
                })}
                <div class="learn-daily-task-grid">
                    ${tasks.map(buildDailyTaskRow).join('')}
                </div>
                <div class="learn-daily-sheet-meta">
                    <section class="learn-daily-meta-card">
                        <h4>今日状态</h4>
                        <p>记录一下今天的精力，后面更容易看出哪种节奏最合适。</p>
                        <div class="learn-daily-minute-row">${energyButtons}</div>
                        <div class="learn-daily-minute-note">${entry.energyLevel === 'great' ? '今天状态：精神好' : entry.energyLevel === 'okay' ? '今天状态：一般' : entry.energyLevel === 'tired' ? '今天状态：累了' : '还没记录今天状态。'}</div>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>今日总时长</h4>
                        <p>这版开始更稳定地看时长，但仍然先记总量。</p>
                        <div class="learn-daily-minute-row">${minuteButtons}</div>
                        <div class="learn-daily-minute-note">${entry.totalMinutes ? `当前已记：大约 ${entry.totalMinutes} 分钟` : '还没记时长，学完后点一个最接近的就行。'}</div>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>卡点 / 错题整理</h4>
                        <p>把今天最卡的字、句或节奏写下来，明天回看就更精准。</p>
                        <textarea class="learn-daily-textarea" data-daily-error-items placeholder="比如：&ldquo;雀&rdquo;容易忘，或者“欲穷千里目”的节奏还不稳。">${escapeHtml(entry.errorItems || entry.stuckPoint)}</textarea>
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>今天最顺的一项</h4>
                        <p>不需要长篇，写清楚是哪一项就可以。</p>
                        <input class="learn-daily-input" data-daily-review-best type="text" value="${escapeHtml(entry.reviewBest)}" placeholder="比如：古诗最顺。" />
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>今天最难的一项</h4>
                        <p>后面做周复盘时，这里会特别有用。</p>
                        <input class="learn-daily-input" data-daily-review-hard type="text" value="${escapeHtml(entry.reviewHard)}" placeholder="比如：识字里“雀”还不太稳。" />
                    </section>
                    <section class="learn-daily-meta-card">
                        <h4>明天先做什么</h4>
                        <p>给明天留一个最容易启动的动作。</p>
                        <input class="learn-daily-input" data-daily-next-step type="text" value="${escapeHtml(entry.nextStep)}" placeholder="比如：先回看“雀”，再开始晨读。" />
                    </section>
                </div>
                <div class="learn-card-actions learn-daily-sheet-actions">
                    <button class="learn-btn learn-btn-primary" data-daily-save-summary="1" data-daily-date-key="${dateKey}">${reviewCompleted ? '更新今天学习单' : '保存今天学习单'}</button>
                    <button class="learn-btn learn-btn-secondary" data-daily-focus-field="${hasErrorItems ? 'error-items' : 'review-best'}">${hasErrorItems ? '查看卡点整理' : '去写复盘'}</button>
                </div>
            </section>
        `;
    }

    function bindDailySheetInteractions(container, rerender) {
        if (!container) return;

        container.querySelectorAll('[data-daily-open-lesson]').forEach(button => {
            button.addEventListener('click', () => {
                openLesson(
                    button.dataset.packId,
                    button.dataset.moduleId,
                    button.dataset.lessonId
                );
            });
        });

        container.querySelectorAll('[data-daily-open-print]').forEach(button => {
            button.addEventListener('click', () => {
                openPrint(button.dataset.packId || 'summer-chinese-bridge-2026');
            });
        });

        container.querySelectorAll('[data-daily-set-minutes]').forEach(button => {
            button.addEventListener('click', () => {
                const dateKey = button.dataset.dailyDateKey || getDateKey();
                updateDailySheetEntry(dateKey, {
                    totalMinutes: Number(button.dataset.dailySetMinutes) || ''
                });
                if (typeof window.showToast === 'function') {
                    window.showToast(`🕒 已记今天大约 ${button.dataset.dailySetMinutes} 分钟`);
                }
                if (typeof rerender === 'function') rerender();
            });
        });

        container.querySelectorAll('[data-daily-set-energy]').forEach(button => {
            button.addEventListener('click', () => {
                updateDailySheetEntry(button.dataset.dailyDateKey || getDateKey(), {
                    energyLevel: button.dataset.dailySetEnergy || ''
                });
                if (typeof window.showToast === 'function') {
                    window.showToast(`🧭 已记录今天状态：${button.textContent.trim()}`);
                }
                if (typeof rerender === 'function') rerender();
            });
        });

        container.querySelectorAll('[data-daily-toggle-flag]').forEach(button => {
            button.addEventListener('click', () => {
                const dateKey = button.dataset.dailyDateKey || getDateKey();
                const field = button.dataset.dailyToggleFlag || '';
                if (!field) return;
                const entry = getDailySheetEntry(dateKey);
                const nextValue = !entry[field];
                updateDailySheetEntry(dateKey, {
                    [field]: nextValue
                });
                if (typeof window.showToast === 'function') {
                    window.showToast(nextValue ? '✅ 已标记完成' : '↩️ 已取消这一项打勾');
                }
                if (typeof rerender === 'function') rerender();
            });
        });

        container.querySelectorAll('[data-daily-focus-field]').forEach(button => {
            button.addEventListener('click', () => {
                const selectorMap = {
                    'review-text': '[data-daily-review-text]',
                    'next-step': '[data-daily-next-step]',
                    'review-best': '[data-daily-review-best]',
                    'error-items': '[data-daily-error-items]'
                };
                const selector = selectorMap[button.dataset.dailyFocusField];
                const target = selector ? container.querySelector(selector) : null;
                if (target && typeof target.focus === 'function') {
                    target.focus();
                }
            });
        });

        const saveDailySummaryBtn = container.querySelector('[data-daily-save-summary]');
        if (saveDailySummaryBtn) {
            saveDailySummaryBtn.addEventListener('click', () => {
                const dateKey = saveDailySummaryBtn.dataset.dailyDateKey || getDateKey();
                const stuckField = container.querySelector('[data-daily-stuck-note]');
                const reviewField = container.querySelector('[data-daily-review-text]');
                const parentField = container.querySelector('[data-daily-parent-note]');
                const nextStepField = container.querySelector('[data-daily-next-step]');
                const reviewBestField = container.querySelector('[data-daily-review-best]');
                const reviewHardField = container.querySelector('[data-daily-review-hard]');
                const errorItemsField = container.querySelector('[data-daily-error-items]');
                const patch = {};

                if (stuckField) patch.stuckPoint = stuckField.value.trim();
                if (reviewField) patch.reviewText = reviewField.value.trim();
                if (parentField) patch.parentNote = parentField.value.trim();
                if (nextStepField) patch.nextStep = nextStepField.value.trim();
                if (reviewBestField) patch.reviewBest = reviewBestField.value.trim();
                if (reviewHardField) patch.reviewHard = reviewHardField.value.trim();
                if (errorItemsField) {
                    patch.errorItems = errorItemsField.value.trim();
                    if (!stuckField) patch.stuckPoint = errorItemsField.value.trim();
                }

                updateDailySheetEntry(dateKey, patch);
                if (typeof window.showToast === 'function') {
                    const hasSummaryText = Object.values(patch).some(value => !!String(value || '').trim());
                    window.showToast(hasSummaryText ? '✅ 今天的小结已保存' : '✅ 学习单已保存');
                }
                if (typeof rerender === 'function') rerender();
            });
        }
    }

    async function buildDailySheetOptions(dateKey) {
        const summerId = 'summer-chinese-bridge-2026';
        const siteId = 'learning-sites-gateway-2026';
        const targetDate = parseDateKey(dateKey) || new Date();
        const [summerPack, sitePack] = await Promise.all([
            getPack(summerId),
            getPack(siteId)
        ]);
        if (!summerPack?.manifest) return null;
        const [modulesById, siteModulesById] = await Promise.all([
            loadAllModules(summerId),
            sitePack?.manifest ? loadAllModules(siteId) : Promise.resolve({})
        ]);
        const summerRecord = {
            id: summerId,
            pack: summerPack,
            modulesById
        };
        const siteRecord = sitePack?.manifest ? {
            id: siteId,
            pack: sitePack,
            modulesById: siteModulesById
        } : null;
        const readingModule = modulesById?.['morning-reading'] || null;
        const literacyModule = modulesById?.['literacy-45days'] || null;
        const poemsModule = modulesById?.['poems'] || null;
        const guidedSitesModule = siteModulesById?.['guided-sites'] || null;
        if (!readingModule || !literacyModule) return null;

        const todayPlan = getTodayLearningPlan(summerRecord, siteRecord, targetDate);
        const readingContinueId = getContinueLessonId(summerId, readingModule) || '';
        const literacyContinueId = getContinueLessonId(summerId, literacyModule) || '';
        const siteContinueId = siteRecord && guidedSitesModule ? getContinueLessonId(siteId, guidedSitesModule) || '' : '';
        const readingTodayId = getRecommendedLessonIdForDay(summerId, readingModule, todayPlan.readingDay) || readingContinueId;
        const literacyTodayId = getRecommendedLessonIdForDay(summerId, literacyModule, todayPlan.literacyDay) || literacyContinueId;
        const siteTodayId = guidedSitesModule
            ? (todayPlan.mode === 'calendar'
                ? getRecommendedLessonIdForDay(siteId, guidedSitesModule, parseLessonDay(todayPlan.siteLessonId))
                : todayPlan.siteLessonId || siteContinueId)
            : siteContinueId;
        const readingSheetId = todayPlan.mode === 'calendar' && todayPlan.readingDay
            ? `day-${String(todayPlan.readingDay).padStart(2, '0')}`
            : readingTodayId;
        const literacySheetId = todayPlan.mode === 'calendar' && todayPlan.literacyDay
            ? `day-${String(todayPlan.literacyDay).padStart(2, '0')}`
            : literacyTodayId;
        const readingLesson = getLessonById(readingModule, readingSheetId) || getLessonById(readingModule, readingTodayId);
        const literacyLesson = getLessonById(literacyModule, literacySheetId) || getLessonById(literacyModule, literacyTodayId);
        const poemLesson = getPoemLessonForDay(poemsModule, parseLessonDay(readingSheetId) || todayPlan.readingDay || 1);
        const siteLesson = siteTodayId ? getLessonById(guidedSitesModule, siteTodayId) : null;

        return {
            dateKey: dateKey || getDateKey(targetDate),
            packId: summerId,
            readingDay: parseLessonDay(readingSheetId) || todayPlan.readingDay || 1,
            readingTitle: readingLesson?.title || '今天晨读',
            readingLessonId: readingSheetId || readingTodayId || readingContinueId,
            readingCompleted: !!(readingSheetId && isLessonCompleted(summerId, 'morning-reading', readingSheetId)),
            poemTitle: poemLesson?.title || '今日古诗',
            literacyTitle: literacyLesson?.title || '今天识字',
            literacyLessonId: literacySheetId || literacyTodayId || literacyContinueId,
            literacyCompleted: !!(literacySheetId && isLessonCompleted(summerId, 'literacy-45days', literacySheetId)),
            sitePackId: siteRecord?.id || '',
            siteLessonId: siteTodayId || '',
            siteTitle: siteLesson?.title || '学习网站 / 打印讲义'
        };
    }

    async function renderDailyCheckin(containerId) {
        const resolvedContainerId = containerId || 'points-learning-sheet-container';
        const container = document.getElementById(resolvedContainerId);
        if (!container) return;
        const options = await buildDailySheetOptions();
        if (!options) {
            container.innerHTML = '';
            return;
        }
        const mode = getDailySheetMode();
        if (mode === 'template-b') {
            container.innerHTML = renderDailySheetTemplateB(options);
        } else if (mode === 'template-c') {
            container.innerHTML = renderDailySheetTemplateC(options);
        } else {
            container.innerHTML = renderDailySheetTemplateA(options);
        }
        bindDailySheetInteractions(container, () => void renderDailyCheckin(resolvedContainerId));
    }

    function sumRewardPoints(rewards) {
        return Object.values(rewards || {}).reduce((total, item) => total + (Number(item?.points) || 0), 0);
    }

    function getRecentRewardItems(rewards, packRecords) {
        const packMap = Object.fromEntries((packRecords || []).map(record => [record.id, record]));
        return Object.entries(rewards || {})
            .map(([key, value]) => {
                const [packId, moduleId, ...rest] = key.split(':');
                const lessonId = rest.join(':');
                const packRecord = packMap[packId];
                const moduleMeta = getModuleMeta(packRecord?.pack?.manifest, moduleId);
                const module = packRecord?.modulesById?.[moduleId];
                const lesson = getLessonById(module, lessonId);
                const isBundle = moduleId === 'daily-bundle';
                const isStreak = moduleId === 'streak';
                const streakRule = packRecord?.pack?.manifest?.streakRule || null;
                return {
                    key,
                    claimedAt: Number(value?.claimedAt) || 0,
                    points: Number(value?.points) || 0,
                    title: isBundle
                        ? '晨读 + 识字同日完成'
                        : isStreak
                            ? (streakRule?.title || '连续学习奖励')
                        : `${moduleMeta?.title || moduleId || '学习记录'} · ${lesson?.title || lessonId || '已完成'}`,
                    packTitle: packRecord?.packMeta?.title || packId
                };
            })
            .filter(item => item.claimedAt)
            .sort((a, b) => b.claimedAt - a.claimedAt)
            .slice(0, 6);
    }

    function getLessonNav(module, lessonId) {
        const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
        const idx = Math.max(0, lessons.findIndex(lesson => getLessonKey(lesson) === lessonId));
        return {
            index: idx,
            total: lessons.length,
            prevLessonId: idx > 0 ? getLessonKey(lessons[idx - 1]) : null,
            nextLessonId: idx < lessons.length - 1 ? getLessonKey(lessons[idx + 1]) : null
        };
    }

    function togglePinyinPref() {
        const current = getPrintPrefs();
        savePrintPrefs(Object.assign({}, current, { showPinyin: !current.showPinyin }));
    }

    function buildBadges(items) {
        return `
            <div class="learn-badges">
                ${items.map(item => `<span class="learn-badge">${item}</span>`).join('')}
            </div>
        `;
    }

    function getLabelPinyin(label) {
        const map = {
            '短句': 'duan ju',
            '唐诗': 'tang shi',
            '古诗': 'gu shi',
            '弟子规': 'di zi gui',
            '经典短句': 'jing dian duan ju',
            '新字': 'xin zi',
            '例句': 'li ju',
            '复盘': 'fu pan',
            '目标词': 'mu biao ci',
            '家长提示': 'jia zhang ti shi',
            '打开点读': 'da kai dian du',
            '完成目标': 'wan cheng mu biao'
        };
        return map[label] || '';
    }

    function numberToPinyin(value) {
        const n = Number(value) || 0;
        const digits = ['ling', 'yī', 'èr', 'sān', 'sì', 'wǔ', 'liù', 'qī', 'bā', 'jiǔ'];
        const shi = 'shí';
        if (n <= 0) return digits[0];
        if (n < 10) return digits[n];
        if (n === 10) return shi;
        if (n < 20) return `${shi} ${digits[n - 10]}`;
        if (n < 100) {
            const tens = Math.floor(n / 10);
            const ones = n % 10;
            return ones ? `${digits[tens]} ${shi} ${digits[ones]}` : `${digits[tens]} ${shi}`;
        }
        return String(n);
    }

    function getReadingTitlePinyin(meta) {
        if (!meta?.monthIndex || !meta?.dayInMonth) return '';
        return `dì ${numberToPinyin(meta.monthIndex)} gè yuè dì ${numberToPinyin(meta.dayInMonth)} rì`;
    }

    function getLiteracyTitlePinyin(day) {
        return `${numberToPinyin(45)} tiān shí zì kè chéng dì ${numberToPinyin(day || 1)} tiān`;
    }

    function buildCheckGrid(note, title) {
        return `
            <div class="learn-sheet-checkbar">
                <p class="learn-sheet-checknote">${note}</p>
                <div class="learn-sheet-checkpanel">
                    <div class="learn-sheet-checktitle">${title || '读完打勾'}</div>
                    <div class="learn-check-grid">
                        ${Array.from({ length: 24 }, () => '<span class="learn-check-cell"></span>').join('')}
                    </div>
                </div>
            </div>
        `;
    }

    function buildCharLibraryMap(charLibrary) {
        const items = Array.isArray(charLibrary?.items) ? charLibrary.items : [];
        return items.reduce((acc, item) => {
            if (item?.char && item?.pinyin) {
                acc[item.char] = item.pinyin;
            }
            return acc;
        }, {});
    }

    function toLibraryPinyin(text, charLibraryMap) {
        if (!text) return '';
        return Array.from(String(text)).map(ch => {
            if (charLibraryMap?.[ch]) return charLibraryMap[ch];
            if ('，。！？；：、（）《》“”‘’ 0123456789'.includes(ch)) return ch;
            return ch;
        }).join(' ')
            .replace(/ ，/g, '，')
            .replace(/ 。/g, '。')
            .replace(/ ！/g, '！')
            .replace(/ ？/g, '？')
            .replace(/ ：/g, '：')
            .replace(/ ；/g, '；')
            .replace(/ 、/g, '、')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function normalizeExampleSentence(text) {
        return String(text || '')
            .replace(/\s+/g, '')
            .replace(/[?？!！]+/g, '。')
            .replace(/。+/g, '。')
            .trim();
    }

    function getLiteracySentenceText(lesson) {
        if (lesson?.practiceSentence) return String(lesson.practiceSentence).trim();
        const items = Array.isArray(lesson?.items) ? lesson.items : [];
        const candidates = items
            .map(item => normalizeExampleSentence(item.example || ''))
            .filter(Boolean)
            .sort((a, b) => a.length - b.length);
        return candidates.slice(0, 2).join(' ') || '先认字，再读顺。';
    }

    function splitLiteracyRows(items) {
        if (!Array.isArray(items) || !items.length) return [];
        const mid = Math.ceil(items.length / 2);
        return [items.slice(0, mid), items.slice(mid)].filter(row => row.length);
    }

    function enhancePrintPaper(html, options) {
        return html
            .replace('class="learn-study-sheet', 'class="learn-study-sheet learn-print-paper');
    }

    function renderPrintWorkbookMap(manifest, plan, modulesById) {
        const modules = Array.isArray(manifest?.modules) ? manifest.modules : [];
        const weeks = Array.isArray(plan?.weeks) ? plan.weeks.length : 0;
        const moduleRows = modules.map((moduleMeta, index) => {
            const module = modulesById?.[moduleMeta.id];
            const lessonCount = Array.isArray(module?.lessons) ? module.lessons.length : 0;
            const countText = lessonCount ? `${lessonCount} 页内容` : '拓展材料';
            return `
                <li>
                    <span class="learn-print-toc-number">${String(index + 1).padStart(2, '0')}</span>
                    <div>
                        <strong>${moduleMeta.emoji || '·'} ${moduleMeta.title}</strong>
                        <small>${moduleMeta.summary || moduleMeta.duration || countText}</small>
                    </div>
                    <em>${moduleMeta.duration || countText}</em>
                </li>
            `;
        }).join('');
        const routines = (plan?.dailyRoutine || []).map(item => `<span>${item}</span>`).join('');
        return `
            <section class="learn-print-workbook-map learn-print-paper">
                <div class="learn-print-map-eyebrow">printable workbook</div>
                <h2>一本可以直接打印的暑假中文手册</h2>
                <p class="learn-print-map-lead">${plan?.summary || manifest?.description || '把网页里的学习内容整理成适合 A4 打印的讲义。'}</p>
                <div class="learn-print-map-grid">
                    <article>
                        <span>01</span>
                        <h3>先整理内容</h3>
                        <p>晨读、识字、古诗和复盘都保留在资料包里，网页学习和打印讲义共用同一份数据。</p>
                    </article>
                    <article>
                        <span>02</span>
                        <h3>再排成讲义</h3>
                        <p>每一页自动带上模块、天数、拼音开关和打勾区，方便直接预览、打印或导出 PDF。</p>
                    </article>
                    <article>
                        <span>03</span>
                        <h3>最后接回积分</h3>
                        <p>孩子在网页里完成学习后，进度和成长分仍然会回到当前项目的成长积分系统。</p>
                    </article>
                </div>
                <div class="learn-print-routine-strip">${routines}</div>
                <ol class="learn-print-toc-list">
                    ${moduleRows}
                </ol>
                <div class="learn-print-map-note">${weeks ? `计划共 ${weeks} 周，可以按家庭节奏顺延。` : '可以按家庭节奏顺延，不需要赶进度。'}</div>
            </section>
        `;
    }

    function renderPrintModuleDivider(moduleMeta, module, index) {
        const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
        const countText = lessons.length ? `${lessons.length}` : '拓展';
        const sampleTitle = lessons[0]?.title || moduleMeta?.summary || '打开后按孩子状态轻量使用。';
        const lastLesson = lessons.length ? lessons[lessons.length - 1] : null;
        return `
            <section class="learn-print-module-divider learn-print-paper">
                <div class="learn-print-divider-head">
                    <span>chapter ${String(index + 1).padStart(2, '0')}</span>
                    <strong>${moduleMeta?.duration || '学习资源'}</strong>
                </div>
                <div class="learn-print-divider-main">
                    <div class="learn-print-divider-emoji">${moduleMeta?.emoji || '📘'}</div>
                    <div>
                        <p class="learn-print-divider-kicker">本章内容</p>
                        <h2>${moduleMeta?.title || module?.title || '学习模块'}</h2>
                        <p>${moduleMeta?.summary || '这一部分可以作为日常学习或复习资料。'}</p>
                    </div>
                </div>
                <div class="learn-print-divider-stats">
                    <div><b>${countText}</b><span>${lessons.length ? '课时' : '材料'}</span></div>
                    <div><b>${lessons[0]?.day || 1}</b><span>起始天</span></div>
                    <div><b>${lastLesson?.day || lessons.length || '加餐'}</b><span>结束天</span></div>
                </div>
                <p class="learn-print-divider-note">第一页示例：${sampleTitle}</p>
            </section>
        `;
    }

    function renderPrintChapterMarker(moduleMeta, lesson, plan, mode, maxDay) {
        const day = lesson?.day || 1;
        const meta = getPlanDayMeta(plan, day, mode);
        const monthIndex = meta.monthIndex || 1;
        const rangeStart = (monthIndex - 1) * 30 + 1;
        const rangeEnd = maxDay ? Math.min(monthIndex * 30, maxDay) : monthIndex * 30;
        return `
            <section class="learn-print-chapter-marker learn-print-paper">
                <span class="learn-print-chapter-label">${moduleMeta?.title || '学习内容'}</span>
                <h2>第${monthIndex}个月</h2>
                <p>${meta.targetWeek?.focus || '每天一点点，先读顺、认熟，再慢慢建立自信。'}</p>
                <div class="learn-print-chapter-range">
                    <span>从第 ${day} 天开始</span>
                    <strong>建议范围：第 ${rangeStart} - ${rangeEnd} 天</strong>
                </div>
            </section>
        `;
    }

    function getDailySheetModeGuide(modeId) {
        const normalized = normalizeDailySheetMode(modeId);
        if (normalized === 'template-b') {
            return {
                stage: '适合节奏稳定后',
                duration: '建议 18 到 25 分钟',
                note: '比超轻量版多一点管理能力，但仍然不做重表格。'
            };
        }
        if (normalized === 'template-c') {
            return {
                stage: '适合更稳定阶段',
                duration: '建议 20 到 30 分钟',
                note: '加入错题整理和复盘字段，更接近小学学习单。'
            };
        }
        return {
            stage: '适合幼小衔接起步',
            duration: '建议 15 到 20 分钟',
            note: '先让每天学习节奏跑顺，不被记录负担拖住。'
        };
    }

    function formatStoredMultilineText(value) {
        return escapeHtml(String(value || '')).replace(/\r?\n/g, '<br>');
    }

    function renderPrintDailyModeStrip(activeMode) {
        const current = normalizeDailySheetMode(activeMode);
        return `
            <div class="learn-print-daily-mode-strip">
                ${getDailySheetModes().map(mode => `
                    <article class="learn-print-daily-mode-card ${mode.id === current ? 'is-active' : ''}">
                        <span>${mode.badge}</span>
                        <strong>${mode.title}</strong>
                        <p>${mode.id === current ? '当前打印跟随这一档。' : mode.desc}</p>
                    </article>
                `).join('')}
            </div>
        `;
    }

    function renderPrintDailyTaskTable(rows) {
        return `
            <div class="learn-print-daily-table">
                <div class="learn-print-daily-row is-head">
                    <span>勾选</span>
                    <span>类型</span>
                    <span>今日任务</span>
                    <span>建议时长</span>
                    <span>备注</span>
                </div>
                ${rows.map(row => `
                    <div class="learn-print-daily-row ${row.completed ? 'is-completed' : ''}">
                        <span class="learn-print-daily-check">${row.completed ? '☑' : '□'}</span>
                        <span class="learn-print-daily-type">${row.type}</span>
                        <div class="learn-print-daily-task">
                            <strong>${row.title}</strong>
                            ${row.sub ? `<small>${row.sub}</small>` : ''}
                        </div>
                        <span class="learn-print-daily-plan">${row.plan || '—'}</span>
                        <span class="learn-print-daily-note">${row.note || '—'}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderPrintDailyFieldCard(field) {
        const hasPrefill = !!String(field?.value || '').trim();
        const chips = Array.isArray(field?.chips) ? field.chips : [];
        return `
            <article class="learn-print-daily-note-card ${field?.wide ? 'is-wide' : ''}">
                <div class="learn-print-daily-note-head">
                    <h3>${field?.label || '记录项'}</h3>
                    <span>${hasPrefill ? '网页已记' : '打印后手写'}</span>
                </div>
                <p>${field?.hint || ''}</p>
                ${chips.length ? `
                    <div class="learn-print-daily-chip-row">
                        ${chips.map(item => `<span class="${item.active ? 'is-active' : ''}">${item.label}</span>`).join('')}
                    </div>
                ` : ''}
                <div class="learn-print-daily-writebox">
                    ${hasPrefill
                        ? `<div class="learn-print-daily-prefill">${formatStoredMultilineText(field.value)}</div>`
                        : `
                            <div class="learn-print-daily-write-line"></div>
                            <div class="learn-print-daily-write-line"></div>
                            ${field?.wide ? '<div class="learn-print-daily-write-line"></div>' : ''}
                        `}
                </div>
            </article>
        `;
    }

    function renderPrintDailyFieldGrid(fields) {
        return `
            <div class="learn-print-daily-field-grid">
                ${(fields || []).map(renderPrintDailyFieldCard).join('')}
            </div>
        `;
    }

    function buildPrintDailySheetModel(modeId, options) {
        const normalized = normalizeDailySheetMode(modeId);
        const entry = getDailySheetEntry(options?.dateKey || getDateKey());
        const readingDay = Number(options?.readingDay) || 1;
        const guide = getDailySheetModeGuide(normalized);
        const reviewCompleted = !!String(entry.reviewText || '').trim();
        const reviewPlusNextCompleted = reviewCompleted && !!String(entry.nextStep || '').trim();
        const advancedReviewCompleted = !!String(entry.reviewBest || '').trim()
            && !!String(entry.reviewHard || '').trim()
            && !!String(entry.nextStep || '').trim();
        let rows = [];
        let fields = [];
        let scoreText = '';
        let scoreNote = '';
        let completed = false;

        if (normalized === 'template-b') {
            rows = [
                {
                    type: '晨读',
                    title: options?.readingTitle || '今天晨读',
                    sub: options?.readingCompleted ? '网页已打勾' : '网页未打勾',
                    plan: '5 分',
                    note: '先顺一遍，不拖太久',
                    completed: !!options?.readingCompleted
                },
                {
                    type: '古诗',
                    title: options?.poemTitle || '今日古诗',
                    sub: '一句拼音一句中文',
                    plan: '3 分',
                    note: '跟晨读一起走',
                    completed: !!options?.readingCompleted
                },
                {
                    type: '识字',
                    title: options?.literacyTitle || '今天识字',
                    sub: options?.literacyCompleted ? '网页已打勾' : '网页未打勾',
                    plan: '8 分',
                    note: '认读为主',
                    completed: !!options?.literacyCompleted
                },
                {
                    type: '拓展',
                    title: options?.siteTitle || '学习网站 / 打印讲义',
                    sub: entry.extensionCompleted ? '网页已标记' : '按状态可选',
                    plan: '可选',
                    note: '有余力再加做一项',
                    completed: !!entry.extensionCompleted
                },
                {
                    type: '复盘',
                    title: '睡前复盘 + 明天先做什么',
                    sub: reviewPlusNextCompleted ? '网页已填写' : '睡前完成',
                    plan: '2 分',
                    note: '写一句今天最顺的，再留明天起步动作',
                    completed: reviewPlusNextCompleted
                }
            ];
            const stats = getDailySheetCompletionStats(rows.map(row => Object.assign({ optional: row.type === '拓展' }, row)));
            scoreText = `${stats.requiredCompleted}/${stats.requiredCount}`;
            scoreNote = stats.allRequiredCompleted ? '核心任务已收口' : '先做核心 4 项';
            completed = stats.allRequiredCompleted;
            fields = [
                {
                    label: '今日总时长',
                    hint: '先记总时长，不需要逐项细记。',
                    chips: [15, 18, 20, 25, 30].map(item => ({ label: `${item} 分`, active: Number(entry.totalMinutes) === item })),
                    value: entry.totalMinutes ? `已记录：约 ${entry.totalMinutes} 分钟` : '',
                    wide: false
                },
                {
                    label: '今天卡住的点',
                    hint: '只抓一个最需要明天回看的点。',
                    value: entry.stuckPoint,
                    wide: false
                },
                {
                    label: '睡前一句话',
                    hint: '写一句今天最顺的一项，帮助孩子收口。',
                    value: entry.reviewText,
                    wide: true
                },
                {
                    label: '明天先做什么',
                    hint: '只写一个最容易启动的动作。',
                    value: entry.nextStep,
                    wide: true
                }
            ];
        } else if (normalized === 'template-c') {
            rows = [
                {
                    type: '晨读',
                    title: options?.readingTitle || '今天晨读',
                    sub: options?.readingCompleted ? '网页已打勾' : '网页未打勾',
                    plan: '5 分',
                    note: '主线学习',
                    completed: !!options?.readingCompleted
                },
                {
                    type: '古诗',
                    title: options?.poemTitle || '今日古诗',
                    sub: '一句拼音一句中文',
                    plan: '3 分',
                    note: '重在节奏和读顺',
                    completed: !!options?.readingCompleted
                },
                {
                    type: '识字',
                    title: options?.literacyTitle || '今天识字',
                    sub: options?.literacyCompleted ? '网页已打勾' : '网页未打勾',
                    plan: '8 分',
                    note: '认读 + 短句开口',
                    completed: !!options?.literacyCompleted
                },
                {
                    type: '整理',
                    title: '错题 / 卡点整理',
                    sub: entry.errorReviewCompleted ? '网页已标记' : '按状态整理',
                    plan: '5 分',
                    note: '把今天最卡的字句留住',
                    completed: !!entry.errorReviewCompleted
                },
                {
                    type: '复盘',
                    title: '最顺 / 最难 / 明天先做什么',
                    sub: advancedReviewCompleted ? '网页已填写' : '睡前完成',
                    plan: '3 分',
                    note: '更接近小学学习单',
                    completed: advancedReviewCompleted
                }
            ];
            const stats = getDailySheetCompletionStats(rows.map(row => Object.assign({ optional: row.type === '整理' }, row)));
            scoreText = `${stats.requiredCompleted}/${stats.requiredCount}`;
            scoreNote = stats.allRequiredCompleted ? '核心任务已收口' : '先做核心 4 项';
            completed = stats.allRequiredCompleted;
            fields = [
                {
                    label: '今日状态',
                    hint: '看一眼今天精力，后面更容易找到合适节奏。',
                    chips: [
                        { label: '精神好', active: entry.energyLevel === 'great' },
                        { label: '一般', active: entry.energyLevel === 'okay' },
                        { label: '累了', active: entry.energyLevel === 'tired' }
                    ],
                    value: '',
                    wide: false
                },
                {
                    label: '今日总时长',
                    hint: '先记总量，逐项拆分可以以后再加。',
                    chips: [15, 20, 25, 30, 35].map(item => ({ label: `${item} 分`, active: Number(entry.totalMinutes) === item })),
                    value: entry.totalMinutes ? `已记录：约 ${entry.totalMinutes} 分钟` : '',
                    wide: false
                },
                {
                    label: '错题 / 卡点整理',
                    hint: '把今天最卡的字、句或节奏记下来。',
                    value: entry.errorItems || entry.stuckPoint,
                    wide: true
                },
                {
                    label: '今天最顺的一项',
                    hint: '写清楚是哪一项就够。',
                    value: entry.reviewBest,
                    wide: false
                },
                {
                    label: '今天最难的一项',
                    hint: '后面做周复盘时会特别有用。',
                    value: entry.reviewHard,
                    wide: false
                },
                {
                    label: '明天先做什么',
                    hint: '给明天留一个最容易启动的动作。',
                    value: entry.nextStep,
                    wide: true
                }
            ];
        } else {
            rows = [
                {
                    type: '晨读',
                    title: options?.readingTitle || '今天晨读',
                    sub: options?.readingCompleted ? '网页已打勾' : '网页未打勾',
                    plan: '5 分',
                    note: '读顺就可以',
                    completed: !!options?.readingCompleted
                },
                {
                    type: '古诗',
                    title: options?.poemTitle || '今日古诗',
                    sub: '一句拼音一句中文',
                    plan: '3 分',
                    note: '跟晨读一起走',
                    completed: !!options?.readingCompleted
                },
                {
                    type: '识字',
                    title: options?.literacyTitle || '今天识字',
                    sub: options?.literacyCompleted ? '网页已打勾' : '网页未打勾',
                    plan: '8 分',
                    note: '认读为主',
                    completed: !!options?.literacyCompleted
                },
                {
                    type: '复盘',
                    title: '睡前说一句今天最顺的一项',
                    sub: reviewCompleted ? '网页已填写' : '睡前完成',
                    plan: '1 分',
                    note: '帮助一天轻轻收住',
                    completed: reviewCompleted
                }
            ];
            const stats = getDailySheetCompletionStats(rows);
            scoreText = `${stats.requiredCompleted}/${stats.requiredCount}`;
            scoreNote = stats.allRequiredCompleted ? '今天已收口' : '今天慢慢完成';
            completed = stats.allRequiredCompleted;
            fields = [
                {
                    label: '今天用了多久？',
                    hint: '幼小衔接先看总时长，不用逐项填写。',
                    chips: [10, 15, 20, 30].map(item => ({ label: `${item} 分`, active: Number(entry.totalMinutes) === item })),
                    value: entry.totalMinutes ? `已记录：约 ${entry.totalMinutes} 分钟` : '',
                    wide: false
                },
                {
                    label: '今天卡住的 1 个点',
                    hint: '只记一个明天要再看一眼的点。',
                    value: entry.stuckPoint,
                    wide: false
                },
                {
                    label: '睡前一句话',
                    hint: '说一句今天最顺的一项，写上去就算完成。',
                    value: entry.reviewText,
                    wide: true
                },
                {
                    label: '家长一句话',
                    hint: '这一项可选，适合简单留个观察。',
                    value: entry.parentNote,
                    wide: true
                }
            ];
        }

        return {
            modeMeta: getDailySheetModeMeta(normalized),
            guide,
            readingDay,
            entry,
            rows,
            fields,
            scoreText,
            scoreNote,
            completed
        };
    }

    function getDailySheetModeMeta(modeId) {
        return DAILY_SHEET_MODES[normalizeDailySheetMode(modeId)] || DAILY_SHEET_MODES['template-a'];
    }

    function renderPrintDailySheet(modeId, options) {
        const model = buildPrintDailySheetModel(modeId, options);
        const dateText = formatDateText(new Date());
        return `
            <section class="learn-print-daily-sheet learn-print-paper">
                <div class="learn-print-daily-eyebrow">daily learning sheet</div>
                <div class="learn-print-daily-head">
                    <div>
                        <h2>今日学习单 · ${model.modeMeta.badge}</h2>
                        <p>${dateText} · 第 ${model.readingDay} 天 · ${model.modeMeta.title}</p>
                    </div>
                    <div class="learn-print-daily-score ${model.completed ? 'is-completed' : ''}">
                        <strong>${model.scoreText}</strong>
                        <span>${model.scoreNote}</span>
                    </div>
                </div>
                ${renderPrintDailyModeStrip(modeId)}
                <div class="learn-print-daily-overview">
                    <article>
                        <span>适合阶段</span>
                        <strong>${model.guide.stage}</strong>
                        <p>${model.guide.note}</p>
                    </article>
                    <article>
                        <span>建议节奏</span>
                        <strong>${model.guide.duration}</strong>
                        <p>可先在积分页勾选，再决定是否打印纸面记录。</p>
                    </article>
                    <article>
                        <span>切换入口</span>
                        <strong>设置页</strong>
                        <p>路径：设置 → 学习打勾模式。积分页和打印页会一起跟随。</p>
                    </article>
                </div>
                ${renderPrintDailyTaskTable(model.rows)}
                ${renderPrintDailyFieldGrid(model.fields)}
                <div class="learn-print-page-foot">
                    <span>daily sheet</span>
                    <strong>${model.modeMeta.title}</strong>
                    <span>网页和打印共用同一套字段</span>
                </div>
            </section>
        `;
    }

    function getPlanDayMeta(plan, day, mode) {
        const weeks = Array.isArray(plan?.weeks) ? plan.weeks : [];
        const key = mode === 'literacy' ? 'literacyRange' : 'readingRange';
        const targetWeek = weeks.find(week => {
            const range = week?.[key];
            return Array.isArray(range) && day >= range[0] && day <= range[1];
        }) || null;
        const weekIndex = targetWeek ? weeks.findIndex(week => week.id === targetWeek.id) + 1 : null;
        const monthIndex = day ? Math.floor((day - 1) / 30) + 1 : null;
        const dayInMonth = day ? ((day - 1) % 30) + 1 : null;
        return {
            weekIndex,
            monthIndex,
            dayInMonth,
            targetWeek,
            headerText: monthIndex && weekIndex && dayInMonth
                ? `第${monthIndex}个月 · 第${weekIndex}周 · 第${dayInMonth}日`
                : `第 ${day || 1} 天`
        };
    }

    function getReadingCompanions(modulesById, lesson) {
        const dayIndex = Math.max(0, (lesson?.day || 1) - 1);
        const poems = modulesById?.poems?.lessons || [];
        const classics = modulesById?.classics?.lessons || [];
        return {
            poem: poems.length ? poems[dayIndex % poems.length] : null,
            classic: classics.length ? classics[dayIndex % classics.length] : null
        };
    }

    function formatStudyText(text) {
        return String(text || '').replace(/\n/g, '<br>');
    }

    function splitStudyLines(text) {
        return String(text || '')
            .split(/\r?\n/g)
            .map(item => item.trim())
            .filter(Boolean);
    }

    function renderStudyLinePairs(content, pinyin, showPinyin) {
        const contentLines = splitStudyLines(content);
        const pinyinLines = splitStudyLines(pinyin);
        if (!contentLines.length) return '';

        return `
            <div class="learn-study-pairs">
                ${contentLines.map((line, index) => `
                    <div class="learn-study-pair">
                        ${showPinyin && pinyinLines[index] ? `<p class="learn-study-text learn-study-text-pinyin learn-study-text-pair-pinyin">${formatStudyText(pinyinLines[index])}</p>` : ''}
                        <p class="learn-study-text learn-study-text-pair">${formatStudyText(line)}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderStudyBlock(label, heading, content, pinyin, showPinyin, explanation, options) {
        const pairedLines = !!options?.pairedLines;
        return `
            <section class="learn-study-block">
                <div class="learn-study-block-head">
                    ${getLabelPinyin(label) ? `<span class="learn-study-block-pinyin">${getLabelPinyin(label)}</span>` : ''}
                    <h4 class="learn-study-block-label">${label}</h4>
                </div>
                ${heading ? `<div class="learn-study-block-title">${heading}</div>` : ''}
                ${pairedLines
                    ? renderStudyLinePairs(content, pinyin, showPinyin)
                    : `
                        ${showPinyin && pinyin ? `<p class="learn-study-text learn-study-text-pinyin">${formatStudyText(pinyin)}</p>` : ''}
                        ${content ? `<p class="learn-study-text">${formatStudyText(content)}</p>` : ''}
                    `}
                ${explanation ? `<p class="learn-study-explanation">${explanation}</p>` : ''}
            </section>
        `;
    }

    function renderReadingWorksheet(lesson, showPinyin, context) {
        const meta = context?.meta || { headerText: `第 ${lesson?.day || 1} 天` };
        const poem = context?.poem || null;
        const classic = context?.classic || null;
        const mainTitle = meta.monthIndex
            ? `第${meta.monthIndex}个月 第${meta.dayInMonth}日`
            : `${lesson.title || '今日晨读'}`;
        const titlePinyin = getReadingTitlePinyin(meta);
        const footerNote = lesson?.estimatedMinutes
            ? `指字朗读一遍，读顺即可，不用背诵。建议时长 ${lesson.estimatedMinutes} 分钟。`
            : '指字朗读一遍，读顺即可，不用背诵。';
        return `
            <article class="learn-study-sheet learn-study-sheet-reading">
                <header class="learn-study-head">
                    <span class="learn-study-head-left">暑期小一中文</span>
                    <span class="learn-study-head-right">${meta.headerText}</span>
                </header>
                <div class="learn-study-title-wrap">
                    ${titlePinyin ? `<p class="learn-study-title-pinyin">${titlePinyin}</p>` : ''}
                    <h3 class="learn-study-title">${mainTitle}</h3>
                    <p class="learn-study-summary">${lesson.focus || '每天读一点，让中文语感慢慢熟起来。'}</p>
                </div>
                ${renderStudyBlock('短句', lesson.title || '今日短句', lesson.content || '', lesson.pinyinContent || '', showPinyin)}
                ${poem ? renderStudyBlock('古诗', poem.title || '今日古诗', poem.content || '', poem.pinyinContent || '', showPinyin, poem.explanation || '', { pairedLines: true }) : ''}
                ${classic ? renderStudyBlock(classic.title && classic.title.includes('弟子规') ? '弟子规' : '经典短句', classic.title || '今日短句', classic.content || '', classic.pinyinContent || '', showPinyin) : ''}
                ${buildCheckGrid(footerNote, '读完打勾')}
            </article>
        `;
    }

    function renderLiteracyWorksheet(lesson, showPinyin, context) {
        const items = Array.isArray(lesson?.items) ? lesson.items : [];
        const charLibraryMap = buildCharLibraryMap(context?.charLibrary);
        const sentenceText = getLiteracySentenceText(lesson);
        const sentencePinyin = showPinyin ? toLibraryPinyin(sentenceText, charLibraryMap) : '';
        const rows = splitLiteracyRows(items);
        const day = lesson?.day || 1;
        return `
            <article class="learn-study-sheet learn-study-sheet-literacy">
                <header class="learn-study-head">
                    <span class="learn-study-head-left">暑期小一识字</span>
                    <span class="learn-study-head-right">第${day}天</span>
                </header>
                <div class="learn-study-title-wrap">
                    <p class="learn-study-title-pinyin">${getLiteracyTitlePinyin(day)}</p>
                    <h3 class="learn-study-title">45天识字课程 第${day}天</h3>
                    <p class="learn-study-summary">${lesson?.focus || '每天 10 个字，先认、再读、再回看。'}</p>
                </div>
                <section class="learn-study-block">
                    <div class="learn-study-block-head">
                        <span class="learn-study-block-pinyin">${getLabelPinyin('新字')}</span>
                        <h4 class="learn-study-block-label">新字</h4>
                    </div>
                    <div class="learn-literacy-stream">
                        ${rows.map(row => `
                            <div class="learn-literacy-row">
                                ${row.map((item, idx) => `
                                    <span class="learn-literacy-token">
                                        <span class="learn-literacy-token-pinyin ${showPinyin ? '' : 'learn-is-hidden'}">${item.pinyin || ''}</span>
                                        <span class="learn-literacy-token-char">${item.char || ''}</span>
                                        ${idx < row.length - 1 ? '<span class="learn-literacy-token-sep">、</span>' : ''}
                                    </span>
                                `).join('')}
                            </div>
                        `).join('')}
                    </div>
                </section>
                <section class="learn-study-block">
                    <div class="learn-study-block-head">
                        <span class="learn-study-block-pinyin">${getLabelPinyin('短句')}</span>
                        <h4 class="learn-study-block-label">短句</h4>
                    </div>
                    ${sentencePinyin ? `<p class="learn-literacy-sentence-pinyin">${sentencePinyin}</p>` : ''}
                    <p class="learn-literacy-sentence-text">${sentenceText}</p>
                </section>
                ${buildCheckGrid('每天 10 个字，不抄写，指读就行。读完一遍就打勾。', '读完打勾')}
            </article>
        `;
    }

    function renderResourceHubWorksheet(module, lesson) {
        const resources = Array.isArray(lesson?.resources) ? lesson.resources : [];
        const checklist = Array.isArray(lesson?.checklist) ? lesson.checklist : [];
        return `
            <article class="learn-study-sheet learn-study-sheet-resource">
                <header class="learn-study-head">
                    <span class="learn-study-head-left">${module?.title || '学习网站入口'}</span>
                    <span class="learn-study-head-right">${lesson?.duration || `第${lesson?.day || 1}节`}</span>
                </header>
                <div class="learn-study-title-wrap">
                    <h3 class="learn-study-title">${lesson?.title || '学习网站入口'}</h3>
                    <p class="learn-study-summary">${lesson?.focus || '先在当前项目里选入口，再跳转到对应网站学习，学完回来点完成。'}</p>
                </div>
                <section class="learn-study-block">
                    <div class="learn-study-block-head">
                        <h4 class="learn-study-block-label">网站入口</h4>
                    </div>
                    <div class="learn-resource-grid">
                        ${resources.map(resource => `
                            <article class="learn-resource-card">
                                <div class="learn-resource-card-top">
                                    <span class="learn-resource-badge">${resource?.sourceType || resource?.category || '学习网站'}</span>
                                    ${resource?.keywords ? `<span class="learn-resource-keywords">${resource.keywords}</span>` : ''}
                                </div>
                                <h4 class="learn-resource-title">${resource?.title || '资源入口'}</h4>
                                <p class="learn-resource-desc">${resource?.description || ''}</p>
                                ${resource?.actionHint ? `<p class="learn-resource-tip">打开提示：${resource.actionHint}</p>` : ''}
                                <p class="learn-resource-url">${resource?.url || ''}</p>
                                <div class="learn-resource-actions">
                                    <a class="learn-btn learn-btn-primary" href="${resource?.url || '#'}" target="_blank" rel="noopener noreferrer">打开网站</a>
                                </div>
                            </article>
                        `).join('')}
                    </div>
                </section>
                ${checklist.length ? `
                    <section class="learn-study-block">
                        <div class="learn-study-block-head">
                            <h4 class="learn-study-block-label">使用步骤</h4>
                        </div>
                        <ul class="learn-checklist">
                            ${checklist.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </section>
                ` : ''}
                ${buildCheckGrid(lesson?.completionNote || '打开 1 个网站学习 10-15 分钟，回到当前项目点完成就能计分。', '学完打勾')}
            </article>
        `;
    }

    function renderExternalReaderWorksheet(pack, module, lesson) {
        const support = lesson?.support || {};
        const source = resolveLessonSource(pack, module, lesson);
        const launchUrl = resolveLessonLaunchUrl(pack, module, lesson);
        const keywords = Array.isArray(support?.keywords) ? support.keywords : [];
        const objectives = Array.isArray(lesson?.objectives) ? lesson.objectives : [];
        const checklist = Array.isArray(lesson?.checklist) ? lesson.checklist : [];
        return `
            <article class="learn-study-sheet learn-study-sheet-external">
                <header class="learn-study-head">
                    <span class="learn-study-head-left">英语点读</span>
                    <span class="learn-study-head-right">${lesson?.duration || '约 10 分钟'}</span>
                </header>
                <div class="learn-study-title-wrap">
                    <h3 class="learn-study-title">${lesson?.title || '英语章节'}</h3>
                    <p class="learn-study-summary">${lesson?.summary || lesson?.focus || '先在当前项目里看目标词，再去外部章节里轻轻听读一遍。'}</p>
                </div>
                <section class="learn-study-block">
                    <div class="learn-study-block-head">
                        <span class="learn-study-block-pinyin">${getLabelPinyin('完成目标')}</span>
                        <h4 class="learn-study-block-label">完成目标</h4>
                    </div>
                    <p class="learn-study-text learn-study-text-review">${lesson?.focus || '先听一遍，再跟读一遍，最后回到当前项目打勾。'}</p>
                    ${objectives.length ? `
                        <ul class="learn-checklist">
                            ${objectives.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    ` : ''}
                </section>
                ${keywords.length ? `
                    <section class="learn-study-block learn-external-support-block">
                        <div class="learn-study-block-head">
                            <span class="learn-study-block-pinyin">${getLabelPinyin('目标词')}</span>
                            <h4 class="learn-study-block-label">目标词</h4>
                        </div>
                        <div class="learn-external-keywords">
                            ${keywords.map(item => `<span class="learn-external-keyword">${item}</span>`).join('')}
                        </div>
                    </section>
                ` : ''}
                <section class="learn-study-block learn-external-launch-block">
                    <div class="learn-study-block-head">
                        <span class="learn-study-block-pinyin">${getLabelPinyin('打开点读')}</span>
                        <h4 class="learn-study-block-label">打开点读</h4>
                    </div>
                    <div class="learn-external-launch-card">
                        <p class="learn-resource-desc">${source?.provider === 'mayihaoke' ? '这节会跳到 mayihaoke 的对应章节阅读页，读完再回到当前项目打勾。' : '打开外部章节页后，学完再回到当前项目打勾。'}</p>
                        ${launchUrl ? `<p class="learn-resource-url">${launchUrl}</p>` : ''}
                        <div class="learn-resource-actions">
                            <a class="learn-btn learn-btn-primary" data-learn-action="open-external" href="${launchUrl || '#'}" target="_blank" rel="noopener noreferrer">打开点读页</a>
                        </div>
                    </div>
                </section>
                ${support?.parentTip ? `
                    <section class="learn-study-block learn-external-support-block">
                        <div class="learn-study-block-head">
                            <span class="learn-study-block-pinyin">${getLabelPinyin('家长提示')}</span>
                            <h4 class="learn-study-block-label">家长提示</h4>
                        </div>
                        <p class="learn-study-explanation">${support.parentTip}</p>
                    </section>
                ` : ''}
                ${checklist.length ? `
                    <section class="learn-study-block">
                        <div class="learn-study-block-head">
                            <h4 class="learn-study-block-label">使用步骤</h4>
                        </div>
                        <ul class="learn-checklist">
                            ${checklist.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    </section>
                ` : ''}
                ${buildCheckGrid(lesson?.completionNote || '外部章节读完后，回到当前项目点“读完打勾”就能记录英语进度。', '读完打勾')}
            </article>
        `;
    }

    function renderLessonQuiz(packId, moduleId, lessonId, lesson) {
        const quiz = getLessonQuiz(lesson);
        if (!quiz) return '';
        const attempts = getQuizAttempts();
        const attempt = attempts[getQuizKey(packId, moduleId, lessonId)] || null;
        const passed = !!attempt?.passed;
        const passScore = Number(quiz.passScore) || Math.max(1, quiz.questions.length);
        const statusText = passed
            ? `已通过 · 答对 ${attempt.correct}/${attempt.total}`
            : attempt
                ? `再试一次 · 上次答对 ${attempt.correct}/${attempt.total}`
                : `答对 ${passScore} 题即可打勾`;
        return `
            <section class="learn-card learn-quiz-card ${passed ? 'is-passed' : ''}" data-learn-quiz>
                <div class="learn-quiz-head">
                    <div>
                        <span class="learn-card-kicker">Quiz</span>
                        <h3>章节轻测验</h3>
                    </div>
                    <span class="learn-quiz-status">${escapeHtml(statusText)}</span>
                </div>
                <div class="learn-quiz-list">
                    ${quiz.questions.map((question, index) => `
                        <article class="learn-quiz-question" data-learn-quiz-question data-question-id="${escapeHtml(question.id)}">
                            <div class="learn-quiz-question-head">
                                <span>${index + 1}</span>
                                <strong>${escapeHtml(question.prompt)}</strong>
                            </div>
                            <div class="learn-quiz-choices">
                                ${(question.choices || []).map(choice => `
                                    <button class="learn-btn learn-btn-secondary learn-quiz-choice" type="button" data-learn-quiz-choice="${escapeHtml(choice)}">${escapeHtml(choice)}</button>
                                `).join('')}
                            </div>
                            ${question.explain ? `<p class="learn-quiz-explain">${escapeHtml(question.explain)}</p>` : ''}
                        </article>
                    `).join('')}
                </div>
                <div class="learn-card-actions learn-quiz-actions">
                    <button class="learn-btn learn-btn-primary" type="button" data-learn-action="submit-quiz">${passed ? '重新提交测验' : '提交测验'}</button>
                </div>
            </section>
        `;
    }

    function getVocabStatusLabel(status) {
        const map = {
            mastered: '已掌握',
            learning: '学习中',
            new: '新词'
        };
        return map[status] || map.new;
    }

    function renderEnglishRewards(cards) {
        const rewards = window.EnglishVocabProgress?.claimMilestoneRewards?.(cards) || {};
        const reward = rewards['minecraft-card-common-10'] || null;
        if (reward) {
            return `
                <section class="learn-card learn-english-rewards is-earned" data-learn-english-rewards>
                    <div>
                        <span class="learn-card-kicker">英语兑换</span>
                        <h3>${escapeHtml(reward.title || 'Minecraft 普通卡兑换券')}</h3>
                        <p>已放入奖励记录。</p>
                    </div>
                    <span class="learn-english-reward-badge">已获得</span>
                </section>
            `;
        }

        const stats = window.EnglishVocabProgress?.stats?.(cards) || { mastered: 0 };
        const remain = Math.max(0, 10 - Number(stats.mastered || 0));
        return `
            <section class="learn-card learn-english-rewards" data-learn-english-rewards>
                <div>
                    <span class="learn-card-kicker">英语兑换</span>
                    <h3>10 个词换 Minecraft 普通卡</h3>
                    <p>还差 ${remain} 个词。</p>
                </div>
                <span class="learn-english-reward-badge">待领取</span>
            </section>
        `;
    }

    function renderVocabWorksheet(module) {
        const cards = getVocabCards(module);
        const progressApi = window.EnglishVocabProgress || null;
        const stats = getVocabStats(module);
        if (!cards.length) {
            return `
                <section class="learn-vocab" data-learn-vocab>
                    <div class="learn-empty">
                        <h3 class="learn-section-title">还没有单词卡</h3>
                    </div>
                </section>
            `;
        }
        const focusIndex = getVocabFocusIndex(module, cards);
        const focusCard = cards[focusIndex] || cards[0];
        const focusProgress = progressApi?.get?.(focusCard.id) || { status: 'new', streak: 0, correct: 0, wrong: 0 };
        const focusStatus = focusProgress.status || 'new';
        const stageItems = getVocabStageItems(cards, focusIndex);
        const stageMastered = stageItems.filter(item => (progressApi?.get?.(item.card.id)?.status || 'new') === 'mastered').length;
        const stagePercent = stageItems.length ? Math.round((stageMastered / stageItems.length) * 100) : 0;
        const stageNumber = Math.floor(focusIndex / VOCAB_STAGE_SIZE) + 1;
        const focusImage = getVocabCardImage(focusCard);
        const focusAudio = getVocabCardAudio(focusCard);
        return `
            <section class="learn-vocab" data-learn-vocab>
                <div class="learn-vocab-board">
                    <div class="learn-vocab-board-head">
                        <div>
                            <span class="learn-card-kicker">Minecraft Words</span>
                            <h3>看图认单词</h3>
                        </div>
                        <div class="learn-vocab-stats" data-learn-vocab-stats>
                            <span>第 ${stageNumber} 组</span>
                            <span>已掌握 ${stats.mastered}/${stats.total}</span>
                        </div>
                    </div>
                    <div class="learn-vocab-progress-row">
                        <div class="learn-vocab-progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${stageItems.length}" aria-valuenow="${stageMastered}">
                            <span style="width: ${stagePercent}%"></span>
                        </div>
                        <strong>${stageMastered}/${stageItems.length}</strong>
                    </div>
                    <div class="learn-vocab-stage-track" aria-label="本组单词进度">
                        ${stageItems.map(item => {
                            const progress = progressApi?.get?.(item.card.id) || { status: 'new', streak: 0 };
                            const status = progress.status || 'new';
                            const isActive = item.index === focusIndex;
                            return `
                                <button class="learn-vocab-stage-card is-${escapeHtml(status)}${isActive ? ' is-active' : ''}" type="button" data-vocab-stage-card data-learn-vocab-stage="${item.index}" aria-label="第 ${item.index + 1} 张 ${escapeHtml(item.card.word)}">
                                    <span class="learn-vocab-stage-star" aria-hidden="true">★</span>
                                    <span class="learn-vocab-stage-word">${escapeHtml(item.card.translation)}</span>
                                </button>
                            `;
                        }).join('')}
                    </div>
                    <article class="learn-vocab-card learn-vocab-focus-card is-${escapeHtml(focusStatus)}" data-vocab-card="${escapeHtml(focusCard.id)}" data-vocab-focus-card>
                        <div class="learn-vocab-art" data-vocab-art>
                            <img src="${escapeHtml(focusImage)}" alt="${escapeHtml(focusCard.word)} ${escapeHtml(focusCard.translation)}" loading="lazy">
                        </div>
                        <div class="learn-vocab-focus-copy">
                            <div class="learn-vocab-card-top">
                                <span class="learn-vocab-status">${getVocabStatusLabel(focusStatus)}</span>
                                <span class="learn-vocab-level">${escapeHtml(focusCard.level || 'starter')}</span>
                            </div>
                            <div class="learn-vocab-word-row">
                                <strong data-vocab-focus-word>${escapeHtml(focusCard.word)}</strong>
                                ${focusAudio ? `
                                    <button class="learn-vocab-listen" type="button" data-learn-vocab-listen="${escapeHtml(focusAudio)}" aria-label="听 ${escapeHtml(focusCard.word)}">
                                        <svg viewBox="0 0 24 24" aria-hidden="true">
                                            <path d="M4 9v6h4l5 4V5L8 9H4z"></path>
                                            <path d="M16 9.5a4 4 0 0 1 0 5"></path>
                                            <path d="M18.5 7a7 7 0 0 1 0 10"></path>
                                        </svg>
                                    </button>
                                ` : ''}
                            </div>
                            <span class="learn-vocab-translation">${escapeHtml(focusCard.translation)}</span>
                            <div class="learn-vocab-actions learn-vocab-focus-actions">
                                <button class="learn-btn learn-btn-primary" type="button" data-learn-vocab-practice="${escapeHtml(focusCard.id)}">认识了</button>
                                <button class="learn-btn learn-btn-secondary" type="button" data-learn-vocab-miss="${escapeHtml(focusCard.id)}">再看一次</button>
                                <button class="learn-btn learn-btn-secondary" type="button" data-learn-vocab-next="${escapeHtml(focusCard.id)}">下一张</button>
                            </div>
                            <p>${escapeHtml(focusCard.example || '')}</p>
                            <small>${escapeHtml(focusCard.exampleZh || '')}</small>
                            <div class="learn-vocab-reward-strip" aria-label="本组星星">
                                <span>星星</span>
                                <div>
                                    ${stageItems.map(item => {
                                        const status = progressApi?.get?.(item.card.id)?.status || 'new';
                                        return `<i class="${status === 'mastered' ? 'is-earned' : ''}" aria-hidden="true">★</i>`;
                                    }).join('')}
                                </div>
                            </div>
                            <div class="learn-vocab-memory">
                                <span>连对 ${Math.min(Number(focusProgress.streak || 0), 2)}/2</span>
                                <span>错 ${Number(focusProgress.wrong || 0)}</span>
                            </div>
                        </div>
                    </article>
                </div>
            </section>
            ${renderEnglishRewards(cards)}
        `;
    }

    function bindVocabInteractions(container, module, rerender) {
        const progressApi = window.EnglishVocabProgress;
        const cards = getVocabCards(module);
        const cardsById = Object.fromEntries(cards.map((card, index) => [card.id, { card, index }]));
        container.querySelectorAll('[data-learn-vocab-listen]').forEach(button => {
            button.addEventListener('click', () => {
                playVocabAudio(button.dataset.learnVocabListen || '');
            });
        });
        container.querySelectorAll('[data-learn-vocab-stage]').forEach(button => {
            button.addEventListener('click', () => {
                setVocabFocusIndex(module, Number(button.dataset.learnVocabStage || 0));
                rerender();
            });
        });
        container.querySelectorAll('[data-learn-vocab-next]').forEach(button => {
            button.addEventListener('click', () => {
                const cardId = button.dataset.learnVocabNext || '';
                const entry = cardsById[cardId];
                setVocabFocusIndex(module, (entry?.index || getVocabFocusIndex(module, cards)) + 1);
                rerender();
            });
        });
        if (!progressApi) return;
        container.querySelectorAll('[data-learn-vocab-practice]').forEach(button => {
            button.addEventListener('click', () => {
                const cardId = button.dataset.learnVocabPractice || '';
                const next = progressApi.record(cardId, true);
                const entry = cardsById[cardId];
                if (next.status === 'mastered' && entry) {
                    setVocabFocusIndex(module, entry.index + 1);
                } else if (entry) {
                    setVocabFocusIndex(module, entry.index);
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(next.status === 'mastered'
                        ? `已掌握：${entry?.card?.word || cardId}`
                        : `继续加油：${entry?.card?.word || cardId} 连续 ${next.streak}/2`);
                }
                rerender();
            });
        });
        container.querySelectorAll('[data-learn-vocab-miss]').forEach(button => {
            button.addEventListener('click', () => {
                const cardId = button.dataset.learnVocabMiss || '';
                const next = progressApi.record(cardId, false);
                const entry = cardsById[cardId];
                if (entry) setVocabFocusIndex(module, entry.index);
                if (typeof window.showToast === 'function') {
                    window.showToast(`再看一次：${entry?.card?.word || cardId}，当前 ${getVocabStatusLabel(next.status)}`);
                }
                rerender();
            });
        });
    }

    function renderVocabLesson(container, containerId, packId, moduleId, moduleMeta, module) {
        const lessonId = state.activeLessonId || 'vocab-practice';
        state.activeLessonId = lessonId;
        persistCatalogState();
        const stats = getVocabStats(module);
        container.innerHTML = `
            <div class="learn-shell learn-vocab-lesson-shell">
                <section class="learn-vocab-topbar">
                    <button class="learn-btn learn-btn-secondary" type="button" onclick="LearnCenter.openPack('${packId}')">返回</button>
                    <div>
                        <span class="learn-card-kicker">Minecraft Words</span>
                        <h2>${escapeHtml(moduleMeta?.title || module?.title || 'Minecraft 单词卡')}</h2>
                    </div>
                    <div class="learn-vocab-topbar-score">
                        <span>${stats.mastered}</span>
                        <small>已掌握</small>
                    </div>
                </section>
                ${renderVocabWorksheet(module)}
            </div>
        `;
        bindVocabInteractions(container, module, () => void renderLesson(containerId || 'learn-lesson-container'));
    }

    function renderReviewWorksheet(lesson) {
        const checklist = Array.isArray(lesson?.checklist) ? lesson.checklist : [];
        return `
            <article class="learn-study-sheet learn-study-sheet-review">
                <header class="learn-study-head">
                    <span class="learn-study-head-left">每周复盘</span>
                    <span class="learn-study-head-right">${lesson?.title || '周末小结'}</span>
                </header>
                <div class="learn-study-title-wrap">
                    <h3 class="learn-study-title">${lesson?.title || '每周复盘'}</h3>
                    <p class="learn-study-summary">周末和孩子一起回看这一周，不赶进度，只看有没有更熟一点。</p>
                </div>
                <section class="learn-study-block">
                    <div class="learn-study-block-head">
                        <span class="learn-study-block-pinyin">${getLabelPinyin('复盘')}</span>
                        <h4 class="learn-study-block-label">复盘</h4>
                    </div>
                    <p class="learn-study-text learn-study-text-review">${lesson?.prompt || ''}</p>
                    <ul class="learn-checklist">
                        ${checklist.map(item => `<li>${item}</li>`).join('')}
                    </ul>
                </section>
                ${buildCheckGrid('一起说说这周最顺手的地方，也看看下周想慢慢改什么。', '复盘完成')}
            </article>
        `;
    }

    function renderReadingCollection(module, showPinyin) {
        const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
        return `
            <article class="learn-study-sheet learn-study-sheet-reading">
                <header class="learn-study-head">
                    <span class="learn-study-head-left">补充晨读</span>
                    <span class="learn-study-head-right">${module?.title || '补充资源'}</span>
                </header>
                <div class="learn-study-title-wrap">
                    <h3 class="learn-study-title">${module?.title || '补充晨读'}</h3>
                    <p class="learn-study-summary">这部分可以穿插在每天晨读里，用作替换、加餐或复习。</p>
                </div>
                ${lessons.map(item => renderStudyBlock(item.title && item.title.includes('弟子规') ? '弟子规' : '经典短句', item.title || '', item.content || '', item.pinyinContent || '', showPinyin)).join('')}
            </article>
        `;
    }

    function renderPrintCover(manifest, plan) {
        return `
            <section class="learn-cover-sheet learn-cover-sheet-print">
                <div class="learn-cover-top">
                    <span>AI 做资料记录</span>
                    <span>Codex × 幼小衔接中文</span>
                </div>
                <div class="learn-cover-stage">
                    <p class="learn-cover-mark">我用 Codex</p>
                    <h2 class="learn-cover-title">做了一份<br>幼小衔接暑假中文计划</h2>
                    <p class="learn-cover-subtitle">内容、拼音、排版、PDF 和网页讲义，都让 AI 跑了一遍</p>
                </div>
                <div class="learn-process-card">
                    <h3>这次我让 Codex 做了什么：</h3>
                    <ol class="learn-process-list">
                        <li><span>1</span><p>整理两个月晨读和 45 天识字内容</p></li>
                        <li><span>2</span><p>给正文逐句补上拼音，方便孩子自己跟读</p></li>
                        <li><span>3</span><p>写页面和打印版，让当前项目里也能直接打开学习</p></li>
                        <li><span>4</span><p>学完就能计分，进度也会继续汇总到孩子档案里</p></li>
                    </ol>
                </div>
                <div class="learn-cover-footer">
                    <div class="learn-cover-footer-title">从内容到拼音，再到 A4 讲义</div>
                    <div class="learn-cover-footer-note">${manifest?.title || '学习资料包'} · ${plan?.summary || '这套内容现在已经能在当前项目里继续学习、打印和计分。'}</div>
                </div>
            </section>
        `;
    }

    function renderLessonBody(pack, module, lesson, showPinyin, context) {
        if (module?.type === 'external-reader') return renderExternalReaderWorksheet(pack, module, lesson);
        if (module?.type === 'vocab') return renderVocabWorksheet(module);
        if (module?.type === 'resource-hub') return renderResourceHubWorksheet(module, lesson);
        if (module?.type === 'literacy') return renderLiteracyWorksheet(lesson, showPinyin, context);
        if (module?.type === 'review') return renderReviewWorksheet(lesson);
        return renderReadingWorksheet(lesson, showPinyin, context);
    }

    function getWeekPlanActions(week) {
        if (Array.isArray(week?.actions) && week.actions.length) {
            return week.actions.filter(action => action?.moduleId && action?.lessonId && action?.label);
        }
        const actions = [];
        if (Array.isArray(week?.readingRange) && week.readingRange.length >= 1) {
            actions.push({
                label: '打开本周晨读',
                moduleId: 'morning-reading',
                lessonId: `day-${String(week.readingRange[0]).padStart(2, '0')}`
            });
        }
        if (Array.isArray(week?.literacyRange) && week.literacyRange.length >= 1) {
            actions.push({
                label: '打开本周识字',
                moduleId: 'literacy-45days',
                lessonId: `day-${String(week.literacyRange[0]).padStart(2, '0')}`
            });
        }
        return actions;
    }

    function getWeekPlanMetaText(week) {
        if (week?.rangeText) return week.rangeText;
        const chunks = [];
        if (Array.isArray(week?.readingRange) && week.readingRange.length >= 2) {
            chunks.push(`晨读：第 ${week.readingRange[0]}-${week.readingRange[1]} 天`);
        }
        if (Array.isArray(week?.literacyRange) && week.literacyRange.length >= 2) {
            chunks.push(`识字：第 ${week.literacyRange[0]}-${week.literacyRange[1]} 天`);
        }
        return chunks.join(' · ');
    }

    async function renderHub(containerId) {
        const container = document.getElementById(containerId || 'learn-container');
        if (!container) return;
        const catalog = await getCatalog();
        const packs = Array.isArray(catalog.packs) ? catalog.packs : [];
        if (!packs.length) {
            renderEmpty(containerId || 'learn-container', '学习中心准备中', '资料包目录还没有加载成功。');
            return;
        }

        const packRecords = await Promise.all(packs.map(async packMeta => {
            const pack = await getPack(packMeta.id);
            const modulesById = await loadAllModules(packMeta.id);
            return {
                id: packMeta.id,
                packMeta,
                pack,
                modulesById,
                progress: getPackProgress(packMeta.id, modulesById)
            };
        }));

        const totalProgress = packRecords.reduce((acc, record) => {
            acc.total += record.progress.total;
            acc.completed += record.progress.completed;
            return acc;
        }, { total: 0, completed: 0 });

        const summerRecord = packRecords.find(record => record.id === 'summer-chinese-bridge-2026') || packRecords[0];
        const siteRecord = packRecords.find(record => record.id === 'learning-sites-gateway-2026') || packRecords[1] || null;
        const englishRecord = packRecords.find(record => record.id === 'english-mc-hybrid-2026') || null;

        const readingModule = summerRecord?.modulesById?.['morning-reading'] || null;
        const literacyModule = summerRecord?.modulesById?.['literacy-45days'] || null;
        const poemsModule = summerRecord?.modulesById?.['poems'] || null;
        const reviewModule = summerRecord?.modulesById?.['weekly-review'] || null;
        const guidedSitesModule = siteRecord?.modulesById?.['guided-sites'] || null;
        const englishStoryModule = englishRecord?.modulesById?.['mcbook56-story'] || null;

        const readingContinueId = readingModule ? getContinueLessonId(summerRecord.id, readingModule) : null;
        const literacyContinueId = literacyModule ? getContinueLessonId(summerRecord.id, literacyModule) : null;
        const reviewContinueId = reviewModule ? getContinueLessonId(summerRecord.id, reviewModule) : null;
        const siteContinueId = guidedSitesModule ? getContinueLessonId(siteRecord.id, guidedSitesModule) : null;
        const englishContinueId = englishStoryModule ? getContinueLessonId(englishRecord.id, englishStoryModule) : null;

        const readingMeta = getModuleMeta(summerRecord?.pack?.manifest, 'morning-reading');
        const literacyMeta = getModuleMeta(summerRecord?.pack?.manifest, 'literacy-45days');
        const reviewMeta = getModuleMeta(summerRecord?.pack?.manifest, 'weekly-review');
        const siteMeta = getModuleMeta(siteRecord?.pack?.manifest, 'guided-sites');
        const englishMeta = getModuleMeta(englishRecord?.pack?.manifest, 'mcbook56-story');

        const readingProgress = readingModule ? getModuleProgress(summerRecord.id, readingModule) : { completed: 0, total: 0, percent: 0 };
        const literacyProgress = literacyModule ? getModuleProgress(summerRecord.id, literacyModule) : { completed: 0, total: 0, percent: 0 };
        const reviewProgress = reviewModule ? getModuleProgress(summerRecord.id, reviewModule) : { completed: 0, total: 0, percent: 0 };
        const siteProgress = guidedSitesModule ? getModuleProgress(siteRecord.id, guidedSitesModule) : { completed: 0, total: 0, percent: 0 };
        const englishProgress = englishStoryModule ? getModuleProgress(englishRecord.id, englishStoryModule) : { completed: 0, total: 0, percent: 0 };
        const todayPlan = getTodayLearningPlan(summerRecord, siteRecord);
        const readingTodayId = readingModule ? getRecommendedLessonIdForDay(summerRecord.id, readingModule, todayPlan.readingDay) : readingContinueId;
        const literacyTodayId = literacyModule ? getRecommendedLessonIdForDay(summerRecord.id, literacyModule, todayPlan.literacyDay) : literacyContinueId;
        const siteTodayId = guidedSitesModule
            ? (todayPlan.mode === 'calendar'
                ? getRecommendedLessonIdForDay(siteRecord.id, guidedSitesModule, parseLessonDay(todayPlan.siteLessonId))
                : todayPlan.siteLessonId || siteContinueId)
            : siteContinueId;
        const reviewTodayId = reviewModule && todayPlan.reviewLessonId ? todayPlan.reviewLessonId : null;
        const reviewTodayLesson = reviewTodayId ? getLessonById(reviewModule, reviewTodayId) : null;
        const showReviewToday = !!(reviewTodayId && !isLessonCompleted(summerRecord.id, 'weekly-review', reviewTodayId));
        const readingTodayLesson = readingTodayId ? getLessonById(readingModule, readingTodayId) : null;
        const literacyTodayLesson = literacyTodayId ? getLessonById(literacyModule, literacyTodayId) : null;
        const englishTodayLesson = englishContinueId ? getLessonById(englishStoryModule, englishContinueId) : null;
        const readingSheetId = todayPlan.mode === 'calendar' && todayPlan.readingDay
            ? `day-${String(todayPlan.readingDay).padStart(2, '0')}`
            : (readingTodayId || readingContinueId || '');
        const literacySheetId = todayPlan.mode === 'calendar' && todayPlan.literacyDay
            ? `day-${String(todayPlan.literacyDay).padStart(2, '0')}`
            : (literacyTodayId || literacyContinueId || '');
        const readingSheetLesson = readingSheetId ? getLessonById(readingModule, readingSheetId) : readingTodayLesson;
        const literacySheetLesson = literacySheetId ? getLessonById(literacyModule, literacySheetId) : literacyTodayLesson;
        const readingCompanions = readingModule && readingSheetLesson
            ? getReadingCompanions(summerRecord?.modulesById, readingSheetLesson)
            : { poem: null, classic: null };
        const poemTodayLesson = readingCompanions?.poem || getPoemLessonForDay(poemsModule, parseLessonDay(readingSheetId) || todayPlan.readingDay || 1);
        const readingDoneToday = !!(readingSheetId && isLessonCompleted(summerRecord.id, 'morning-reading', readingSheetId));
        const literacyDoneToday = !!(literacySheetId && isLessonCompleted(summerRecord.id, 'literacy-45days', literacySheetId));
        const rewards = getRewardState();
        const totalPointsEarned = sumRewardPoints(rewards);
        const overallPercent = totalProgress.total ? Math.round((totalProgress.completed / totalProgress.total) * 100) : 0;
        const recentRewardItems = getRecentRewardItems(rewards, packRecords);
        const portalChineseImage = 'assets/learn/portal-chinese-summer-classroom-20260705.png';
        const portalEnglishImage = 'assets/learn/portal-minecraft-english-cover-20260705.png';
        const portalCards = [
            summerRecord ? renderPortalCard({
                id: 'chinese',
                theme: 'chinese',
                imageSrc: portalChineseImage,
                imageStyle: 'object-position:center 56%;',
                badges: ['晨读', '古诗', '识字'],
                kicker: '中文学习',
                title: summerRecord.packMeta?.title || '中文资料包',
                desc: '先从这里进中文学习，最快能找到晨读、古诗和识字。',
                cta: '进入中文学习',
                onclick: `LearnCenter.openPack('${summerRecord.id}')`
            }) : '',
            englishRecord ? renderPortalCard({
                id: 'english',
                theme: 'english',
                imageSrc: portalEnglishImage,
                imageStyle: 'object-position:center top;',
                badges: ['5-6岁', '500+词', 'RAZ风格'],
                kicker: '英语故事',
                title: englishRecord.packMeta?.title || 'Minecraft我的世界英语故事',
                desc: '从 Minecraft 英语故事这里进，先听再跟读，学完回来继续打勾计分。',
                cta: '进入英语学习',
                onclick: `LearnCenter.openPack('${englishRecord.id}')`
            }) : '',
            renderPortalCard({
                id: 'hanzi',
                theme: 'hanzi',
                imageSrc: 'assets/ui/pg-card-hanzi.webp?v=20260704b',
                badges: ['认字', '闯关', '快速进入'],
                kicker: '汉字学习',
                title: '汉字挑战',
                desc: '直接进入汉字练习，不用先绕到游乐场里找入口。',
                cta: '开始汉字练习',
                onclick: `switchPage('hanzi')`
            }),
            siteRecord ? renderPortalCard({
                id: 'sites',
                theme: 'sites',
                emoji: '站',
                chip: '外部入口',
                artTitle: '网站入口包',
                artText: '官网、工具和阅读站统一收纳',
                badges: ['官网', '工具站', '阅读站'],
                kicker: '学习网站',
                title: siteRecord.packMeta?.title || '学习网站入口包',
                desc: '先在这里挑入口，再出去学，回来仍然能记进度和积分。',
                cta: '查看网站入口',
                onclick: `LearnCenter.openPack('${siteRecord.id}')`
            }) : '',
            renderPortalCard({
                id: 'prints',
                theme: 'prints',
                emoji: '🖨️',
                chip: '纸面讲义',
                artTitle: 'A4 讲义 · 打印页',
                artText: '一键打印',
                badges: ['A4', '讲义', '入口单'],
                kicker: '打印讲义',
                title: '打印中心',
                desc: '需要纸面讲义或入口单时，直接从这里进打印页。',
                cta: '打开打印中心',
                onclick: `LearnCenter.openPrint('${summerRecord?.id || ''}')`
            })
        ].filter(Boolean).join('');

        const quickCards = [
            readingModule ? renderHubEntryCard({
                theme: 'reading',
                chip: `${todayPlan.todayLabel} · 晨读`,
                artTitle: todayPlan.mode === 'calendar' ? `第 ${todayPlan.readingDay} 天` : '按当前进度继续',
                artText: todayPlan.targetWeek?.focus || '轻量进入中文状态',
                kicker: '今日晨读',
                title: readingTodayId && getLessonById(readingModule, readingTodayId)?.title
                    ? `今天读：${getLessonById(readingModule, readingTodayId)?.title}`
                    : '幼小衔接暑假中文资料包',
                desc: todayPlan.note,
                meta: `晨读进度 ${readingProgress.completed}/${readingProgress.total} · ${readingProgress.percent}%`,
                primaryAction: `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${summerRecord.id}', 'morning-reading', '${readingTodayId || readingContinueId || ''}')">打开今天晨读</button>`,
                secondaryAction: `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPlan('${summerRecord.id}')">查看周计划</button>`
            }) : '',
            literacyModule ? renderHubEntryCard({
                theme: 'literacy',
                chip: `${todayPlan.todayLabel} · 识字`,
                artTitle: todayPlan.mode === 'calendar' ? `第 ${todayPlan.literacyDay} 天` : '按当前进度继续',
                artText: '认字、拼音、短句一起走',
                kicker: '今日识字',
                title: literacyTodayId && getLessonById(literacyModule, literacyTodayId)?.title
                    ? `今天认：${getLessonById(literacyModule, literacyTodayId)?.title}`
                    : '45 天识字课程',
                desc: literacyMeta?.summary || '每天 10 个字，适合幼小衔接暑假轻量推进。',
                meta: `识字进度 ${literacyProgress.completed}/${literacyProgress.total} · ${literacyProgress.percent}%`,
                primaryAction: `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${summerRecord.id}', 'literacy-45days', '${literacyTodayId || literacyContinueId || ''}')">打开今天识字</button>`,
                secondaryAction: `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${summerRecord.id}')">查看资料包</button>`
            }) : '',
            englishStoryModule ? renderHubEntryCard({
                theme: 'english',
                chip: 'Minecraft英语',
                artTitle: englishProgress.completed ? `已完成 ${englishProgress.completed} 节` : '先听再跟读',
                artText: 'Minecraft故事点读 + 站内打勾计分',
                kicker: '今日英语',
                title: englishContinueId && getLessonById(englishStoryModule, englishContinueId)?.title
                    ? `今天读：${getLessonById(englishStoryModule, englishContinueId)?.title}`
                    : 'Minecraft我的世界英语故事',
                desc: englishMeta?.summary || englishRecord?.packMeta?.summary || '在当前项目看目标词，再打开 Minecraft 外部点读页轻量学习。',
                meta: `英语进度 ${englishProgress.completed}/${englishProgress.total} · ${englishProgress.percent}%`,
                primaryAction: `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${englishRecord.id}', 'mcbook56-story', '${englishContinueId || ''}')">打开今日英语</button>`,
                secondaryAction: `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${englishRecord.id}')">查看英语资料包</button>`
            }) : '',
            (showReviewToday && reviewModule) ? renderHubEntryCard({
                theme: 'review',
                chip: `第 ${reviewTodayLesson?.week || 1} 周回看`,
                artTitle: '本周复盘',
                artText: '周末一起轻轻回看',
                kicker: '本周回看',
                title: reviewTodayLesson?.title || '每周复盘',
                desc: reviewTodayLesson?.prompt || reviewMeta?.summary || '看看这一周最喜欢什么、还想再看什么。',
                meta: `复盘进度 ${reviewProgress.completed}/${reviewProgress.total} · ${reviewProgress.percent}%`,
                primaryAction: `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${summerRecord.id}', 'weekly-review', '${reviewTodayId}')">打开本周复盘</button>`,
                secondaryAction: `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPlan('${summerRecord.id}')">查看周计划</button>`
            }) : (guidedSitesModule ? renderHubEntryCard({
                theme: 'sites',
                chip: todayPlan.mode === 'calendar' && todayPlan.targetWeek ? `${todayPlan.targetWeek.title} 加餐` : '学习网站入口',
                artTitle: '官网 + 工具 + 阅读',
                artText: '先在这里选入口，再出去学',
                kicker: '今日加餐',
                title: siteTodayId && getLessonById(guidedSitesModule, siteTodayId)?.title
                    ? `今天加餐：${getLessonById(guidedSitesModule, siteTodayId)?.title}`
                    : '幼小衔接学习网站入口包',
                desc: siteMeta?.summary || '把学习网站整理成站内入口卡，学完回来继续计分。',
                meta: `网站入口进度 ${siteProgress.completed}/${siteProgress.total} · ${siteProgress.percent}%`,
                primaryAction: `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${siteRecord.id}', 'guided-sites', '${siteTodayId || siteContinueId || ''}')">打开今日加餐</button>`,
                secondaryAction: `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${siteRecord.id}')">查看入口包</button>`
            }) : '')
        ].filter(Boolean).join('');

        const packCards = packRecords.map(record => `
            <article class="learn-card">
                <div class="learn-card-kicker">${record.packMeta.coverEmoji || '📚'} ${record.packMeta.audience || '学习资料包'}</div>
                <h3>${record.packMeta.title}</h3>
                <p>${record.packMeta.summary || ''}</p>
                <div class="learn-metrics">
                    <div class="learn-stat">
                        <span class="label">模块</span>
                        <strong>${Object.keys(record.modulesById).length}</strong>
                    </div>
                    <div class="learn-stat">
                        <span class="label">完成</span>
                        <strong>${record.progress.completed}/${record.progress.total}</strong>
                    </div>
                    <div class="learn-stat">
                        <span class="label">进度</span>
                        <strong>${record.progress.percent}%</strong>
                    </div>
                </div>
                <ul>
                    ${(record.packMeta.highlights || []).map(item => `<li>${item}</li>`).join('')}
                </ul>
                <div class="learn-card-actions">
                    <button class="learn-btn learn-btn-primary" onclick="LearnCenter.openPack('${record.id}')">进入资料包</button>
                    <button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPrint('${record.id}')">查看打印页</button>
                </div>
            </article>
        `).join('');

        const sitePreviewItems = Array.isArray(guidedSitesModule?.lessons)
            ? guidedSitesModule.lessons.flatMap(lesson => (lesson.resources || []).slice(0, 2).map(resource => ({
                lessonId: getLessonKey(lesson),
                lessonTitle: lesson.title,
                resource
            }))).slice(0, 4)
            : [];

        const siteCards = sitePreviewItems.map(item => `
            <article class="learn-site-card">
                <div class="learn-site-card-top">
                    <span class="learn-site-card-badge">${item.resource?.sourceType || '学习网站'}</span>
                    <span class="learn-site-card-tag">${item.lessonTitle}</span>
                </div>
                <h3>${item.resource?.title || '学习入口'}</h3>
                <p>${item.resource?.description || ''}</p>
                <div class="learn-site-card-url">${item.resource?.url || ''}</div>
                <div class="learn-card-actions">
                    <button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${siteRecord?.id || ''}', 'guided-sites', '${item.lessonId}')">进入这一节</button>
                </div>
            </article>
        `).join('');

        const printCards = packRecords.map(record => `
            <article class="learn-print-card">
                <div class="learn-print-card-art ${record.id === 'learning-sites-gateway-2026' ? 'is-sites' : 'is-workbook'}">
                    <span>${record.id === 'learning-sites-gateway-2026' ? '网站入口单' : 'A4 讲义'}</span>
                    <strong>${record.id === 'learning-sites-gateway-2026' ? '入口卡 + 回看页' : '晨读 + 识字 + 复盘'}</strong>
                </div>
                <div class="learn-print-card-copy">
                    <h3>${record.packMeta.title}</h3>
                    <p>${record.id === 'learning-sites-gateway-2026' ? '适合把网站入口、网址和每周回看页统一打印出来。' : '适合直接预览、打印或导出 PDF，带讲义页和打勾区。'}</p>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-primary" onclick="LearnCenter.openPrint('${record.id}')">打开打印页</button>
                        <button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${record.id}')">查看资料包</button>
                    </div>
                </div>
            </article>
        `).join('');

        const progressRows = packRecords.map(record => {
            const moduleRows = (record.pack?.manifest?.modules || []).map(moduleMeta => {
                const progress = getModuleProgress(record.id, record.modulesById[moduleMeta.id]);
                return `
                    <div class="learn-progress-module">
                        <div class="learn-progress-module-head">
                            <strong>${moduleMeta.title}</strong>
                            <span>${progress.completed}/${progress.total} · ${progress.percent}%</span>
                        </div>
                        <div class="learn-progress-bar"><span style="width:${progress.percent}%;"></span></div>
                    </div>
                `;
            }).join('');
            return `
                <article class="learn-progress-pack">
                    <div class="learn-progress-pack-head">
                        <div>
                            <span class="learn-card-kicker">${record.packMeta.coverEmoji || '📚'} ${record.packMeta.audience || '资料包'}</span>
                            <h3>${record.packMeta.title}</h3>
                        </div>
                        <div class="learn-progress-pack-score">${record.progress.percent}%</div>
                    </div>
                    <p>${record.packMeta.summary || ''}</p>
                    <div class="learn-progress-module-list">${moduleRows}</div>
                </article>
            `;
        }).join('');

        const recentProgressList = recentRewardItems.length
            ? recentRewardItems.map(item => `
                <li>
                    <div>
                        <strong>${item.title}</strong>
                        <span>${item.packTitle} · ${formatDateText(new Date(item.claimedAt))}</span>
                    </div>
                    <em>+${item.points}</em>
                </li>
            `).join('')
            : '<li class="is-empty"><div><strong>还没有学习记录</strong><span>从“今日学习”点开第一节后，这里会开始累计。</span></div><em>0</em></li>';

        const nextStepItems = [
            readingTodayId ? `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${summerRecord.id}', 'morning-reading', '${readingTodayId}')">继续今天晨读</button>` : '',
            literacyTodayId ? `<button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${summerRecord.id}', 'literacy-45days', '${literacyTodayId}')">继续今天识字</button>` : '',
            showReviewToday && reviewTodayId
                ? `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openLesson('${summerRecord.id}', 'weekly-review', '${reviewTodayId}')">打开本周复盘</button>`
                : (siteTodayId ? `<button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openLesson('${siteRecord?.id || ''}', 'guided-sites', '${siteTodayId}')">打开今日加餐</button>` : '')
        ].filter(Boolean).join('');
        const summaryCards = `
            <article class="learn-progress-stat-card">
                <span>今天推荐</span>
                <strong>${todayPlan.todayLabel}</strong>
                <p>${todayPlan.mode === 'calendar' ? '今天按暑假节奏继续往前学。' : '今天按当前进度继续学。'}</p>
            </article>
            <article class="learn-progress-stat-card">
                <span>资料包数量</span>
                <strong>${packRecords.length}</strong>
                <p>中文、英语、网站入口都已经汇到同一个学习页里。</p>
            </article>
            <article class="learn-progress-stat-card">
                <span>已完成</span>
                <strong>${totalProgress.completed}/${totalProgress.total}</strong>
                <p>所有学习资料合并后的当前完成节数。</p>
            </article>
            <article class="learn-progress-stat-card">
                <span>累计学习分</span>
                <strong>${totalPointsEarned}</strong>
                <p>学习中心累计发出的成长分，继续统一回到积分系统。</p>
            </article>
        `;

        const activeHubTab = ['today', 'packs', 'sites', 'prints', 'progress'].includes(state.activeHubTab) ? state.activeHubTab : 'today';
        const tabPanelMap = {
            today: `
                <div class="learn-stage-head learn-stage-head-tight">
                    <h3 class="learn-section-title">今日推荐入口</h3>
                    ${buildBadges(['📚 晨读', '✏️ 识字', '🔤 英语', '🌐 网站加餐'])}
                </div>
                <div class="learn-hub-grid">${quickCards}</div>
                <div class="learn-soft-note">${todayPlan.note}。学习页现在优先负责“快速找到入口”，今日学习打卡已经移到积分页。</div>
            `,
            packs: `
                <div class="learn-stage-head learn-stage-head-tight">
                    <h3 class="learn-section-title">当前资料包</h3>
                    ${buildBadges(['🌱 幼小衔接', '🗓️ 暑假节奏', '🖨️ A4 打印友好', '⭐ 学完可计分'])}
                </div>
                <div class="learn-pack-grid">${packCards}</div>
            `,
            sites: `
                <div class="learn-stage-head learn-stage-head-tight">
                    <h3 class="learn-section-title">学习网站入口</h3>
                    ${buildBadges(['🌐 官方平台', '🔎 查字 / 古诗', '📖 少儿阅读', '👨‍👩‍👧 亲子探索'])}
                </div>
                <div class="learn-site-grid">${siteCards || '<div class="learn-empty"><h3 class="learn-section-title">网站入口准备中</h3><p>稍后补充更多站点入口。</p></div>'}</div>
            `,
            prints: `
                <div class="learn-stage-head learn-stage-head-tight">
                    <h3 class="learn-section-title">打印讲义</h3>
                    ${buildBadges(['🖨️ 浏览器直接打印', '📄 A4 友好', '📘 晨读讲义', '🗂️ 网站入口单'])}
                </div>
                <div class="learn-print-grid">${printCards}</div>
            `,
            progress: `
                <div class="learn-progress-overview">
                    <article class="learn-progress-stat-card">
                        <span>总进度</span>
                        <strong>${totalProgress.completed}/${totalProgress.total}</strong>
                        <p>当前所有学习资料的完成节数。</p>
                    </article>
                    <article class="learn-progress-stat-card">
                        <span>整体完成率</span>
                        <strong>${overallPercent}%</strong>
                        <p>所有资料包合并后的整体节奏。</p>
                    </article>
                    <article class="learn-progress-stat-card">
                        <span>累计学习分</span>
                        <strong>${totalPointsEarned}</strong>
                        <p>学习中心累计发出的成长分。</p>
                    </article>
                    <article class="learn-progress-stat-card">
                        <span>最近推荐</span>
                        <strong>${todayPlan.todayLabel}</strong>
                        <p>${todayPlan.mode === 'calendar' ? '今天按暑假日历继续学。' : '今天按当前进度继续学。'}</p>
                    </article>
                </div>
                <div class="learn-progress-layout">
                    <section class="learn-progress-panel">
                        <div class="learn-stage-head learn-stage-head-tight">
                            <h3 class="learn-section-title">我的资料进度</h3>
                            ${buildBadges(['📚 资料包', '📈 模块进度条'])}
                        </div>
                        <div class="learn-progress-pack-list">${progressRows}</div>
                    </section>
                    <section class="learn-progress-panel">
                        <div class="learn-stage-head learn-stage-head-tight">
                            <h3 class="learn-section-title">最近完成</h3>
                            ${buildBadges(['🕒 最近 6 条', '⭐ 发分记录'])}
                        </div>
                        <ul class="learn-progress-recent">${recentProgressList}</ul>
                        <div class="learn-progress-next">
                            <h4>下一步</h4>
                            <p>${todayPlan.note}</p>
                            <div class="learn-card-actions">${nextStepItems}</div>
                        </div>
                    </section>
                </div>
            `
        };

        container.innerHTML = `
            <div class="learn-shell">
                <section class="learn-hero learn-hub-hero">
                    <div class="learn-hub-hero-copy">
                        <p class="learn-hub-eyebrow">学习入口大厅</p>
                        <h2>先找到要学什么，再一键进去</h2>
                        <p>学习入口先放到最上面，中文、英语、汉字、学习网站、打印讲义都尽量首屏可见，不再把关键入口藏深。${todayPlan.note}</p>
                        ${buildBadges([
                            '📚 中文主线',
                            '🔤 Minecraft英语',
                            '📝 汉字练习',
                            '🌐 网站入口',
                            '🖨️ 打印讲义'
                        ])}
                    </div>
                    <div class="learn-portal-grid learn-portal-grid-hero">${portalCards}</div>
                </section>
                <div class="learn-progress-overview learn-hub-summary-overview">${summaryCards}</div>
                <section class="learn-stage-panel learn-hub-panel-wrap">
                    <div class="learn-stage-head learn-hub-tabs-head">
                        <h3 class="learn-section-title">学习选项卡</h3>
                        <div class="learn-hub-tabs">
                            <button class="learn-hub-tab ${activeHubTab === 'today' ? 'is-active' : ''}" data-learn-hub-tab="today">快速入口</button>
                            <button class="learn-hub-tab ${activeHubTab === 'packs' ? 'is-active' : ''}" data-learn-hub-tab="packs">资料包</button>
                            <button class="learn-hub-tab ${activeHubTab === 'sites' ? 'is-active' : ''}" data-learn-hub-tab="sites">学习网站</button>
                            <button class="learn-hub-tab ${activeHubTab === 'prints' ? 'is-active' : ''}" data-learn-hub-tab="prints">打印讲义</button>
                            <button class="learn-hub-tab ${activeHubTab === 'progress' ? 'is-active' : ''}" data-learn-hub-tab="progress">我的进度</button>
                        </div>
                    </div>
                    <div class="learn-hub-panel">${tabPanelMap[activeHubTab] || tabPanelMap.today}</div>
                </section>
            </div>
        `;

        container.querySelectorAll('[data-learn-hub-tab]').forEach(button => {
            button.addEventListener('click', () => {
                setHubTab(button.dataset.learnHubTab);
                void renderHub(containerId || 'learn-container');
            });
        });
        bindDailySheetInteractions(container, () => void renderHub(containerId || 'learn-container'));
    }

    async function renderPack(containerId) {
        const container = document.getElementById(containerId || 'learn-pack-container');
        if (!container) return;
        const packId = state.activePackId;
        const pack = await getPack(packId);
        const manifest = pack && pack.manifest;
        if (!manifest) {
            renderEmpty(containerId || 'learn-pack-container', '资料包未找到', '当前资料包清单加载失败。');
            return;
        }

        const modulesById = await loadAllModules(packId);
        const packProgress = getPackProgress(packId, modulesById);

        const moduleCards = await Promise.all((manifest.modules || []).map(async moduleMeta => {
            const module = modulesById[moduleMeta.id];
            const progress = getModuleProgress(packId, module);
            const continueLessonId = getContinueLessonId(packId, module);
            const actionLabel = module?.type === 'vocab'
                ? '打开单词卡'
                : (progress.completed ? '继续学习' : '打开第一节');
            return `
                <article class="learn-card">
                    <div class="learn-card-kicker">${moduleMeta.emoji || '📝'} ${moduleMeta.duration || ''}</div>
                    <h3>${moduleMeta.title}</h3>
                    <p>${moduleMeta.summary || ''}</p>
                    <div class="learn-module-meta">
                        <span>完成 ${progress.completed}/${progress.total}</span>
                        <span>${progress.percent}%</span>
                    </div>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${packId}','${moduleMeta.id}','${continueLessonId || ''}')">${actionLabel}</button>
                    </div>
                </article>
            `;
        }));

        container.innerHTML = `
            <div class="learn-shell">
                <section class="learn-hero">
                    <h2>${manifest.coverEmoji || '📚'} ${manifest.title}</h2>
                    <p>${manifest.description || ''}</p>
                    ${buildBadges([
                        `👧 ${manifest.audience || '幼小衔接'}`,
                        `🗂️ ${(manifest.modules || []).length} 个模块`,
                        `⭐ ${manifest.rewardSummary || '完成学习可获得成长分'}`,
                        `📈 总进度 ${packProgress.completed}/${packProgress.total} · ${packProgress.percent}%`
                    ])}
                </section>
                <section>
                    <h3 class="learn-section-title">模块入口</h3>
                    <div class="learn-module-grid">${moduleCards.join('')}</div>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-primary" onclick="LearnCenter.openPlan('${manifest.id}')">查看学习计划</button>
                        <button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPrint('${manifest.id}')">查看 A4 打印页</button>
                    </div>
                </section>
            </div>
        `;
    }

    async function renderPlan(containerId) {
        const container = document.getElementById(containerId || 'learn-plan-container');
        if (!container) return;
        const packId = state.activePackId;
        const pack = await getPack(packId);
        const manifest = pack && pack.manifest;
        const plan = pack && pack.plan;
        if (!plan || !Array.isArray(plan.weeks)) {
            renderEmpty(containerId || 'learn-plan-container', '学习计划准备中', '计划数据稍后补齐。');
            return;
        }

        container.innerHTML = `
            <div class="learn-shell">
                <section class="learn-hero">
                    <h2>🗓️ 学习计划</h2>
                    <p>${plan.summary || ''}</p>
                    ${buildBadges((plan.dailyRoutine || []).map(item => `✔️ ${item}`))}
                </section>
                <section class="learn-plan-list">
                    ${plan.weeks.map(week => `
                        <article class="learn-plan-item">
                            <h3 class="learn-section-title">${week.title}</h3>
                            <p>${week.focus}</p>
                            ${getWeekPlanMetaText(week) ? `<p class="learn-soft-note">${getWeekPlanMetaText(week)}</p>` : ''}
                            <p class="learn-soft-note">${week.suggestion || ''}</p>
                            <div class="learn-card-actions">
                                ${getWeekPlanActions(week).map((action, index) => `
                                    <button class="learn-btn ${index === 0 ? 'learn-btn-primary' : 'learn-btn-secondary'}" onclick="LearnCenter.openLesson('${packId}','${action.moduleId}','${action.lessonId}')">${action.label}</button>
                                `).join('')}
                            </div>
                        </article>
                    `).join('')}
                </section>
                <div class="learn-card-actions">
                    <button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${manifest?.id || packId}')">返回资料包</button>
                </div>
            </div>
        `;
    }

    async function renderLesson(containerId) {
        const container = document.getElementById(containerId || 'learn-lesson-container');
        if (!container) return;
        const packId = state.activePackId;
        const moduleId = state.activeModuleId;
        if (!packId || !moduleId) {
            renderEmpty(containerId || 'learn-lesson-container', '学习内容准备中', '请先从资料包页面进入某个模块。');
            return;
        }

        const pack = await getPack(packId);
        const manifest = pack && pack.manifest;
        const module = await getModule(packId, moduleId);
        const moduleMeta = getModuleMeta(manifest, moduleId);
        const plan = pack && pack.plan;
        if (module?.type === 'vocab') {
            renderVocabLesson(container, containerId || 'learn-lesson-container', packId, moduleId, moduleMeta, module);
            return;
        }
        const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
        const lesson = lessons.find(item => getLessonKey(item) === state.activeLessonId) || lessons[0];
        if (!lesson) {
            renderEmpty(containerId || 'learn-lesson-container', '暂无学习内容', '当前模块的数据稍后补齐。');
            return;
        }

        const lessonId = getLessonKey(lesson);
        state.activeLessonId = lessonId;
        persistCatalogState();
        const prefs = getPrintPrefs();
        const completed = isLessonCompleted(packId, moduleId, lessonId);
        const nav = getLessonNav(module, lessonId);
        const rewardPoints = resolveLessonReward(manifest, moduleId, lesson);
        const modulesById = moduleId === 'morning-reading'
            ? await loadAllModules(packId)
            : null;
        const lessonContext = module?.type === 'reading'
            ? Object.assign(
                { meta: getPlanDayMeta(plan, lesson.day || nav.index + 1, 'reading') },
                moduleId === 'morning-reading' ? getReadingCompanions(modulesById, lesson) : {}
            )
            : module?.type === 'literacy'
                ? { charLibrary: pack?.charLibrary || { items: [] } }
            : null;
        const completionIntro = getLessonCompletionIntro(manifest, moduleId, module, rewardPoints, completed);
        const completionHint = getLessonCompletionHint(manifest, moduleId, module, completed);
        const showPinyinToggle = module?.type !== 'external-reader';
        const quizRequired = !!getLessonQuiz(lesson);
        const quizPassed = !quizRequired || isQuizPassed(packId, moduleId, lessonId);
        const completeDisabled = completed || !quizPassed;
        const actionNote = module?.type === 'external-reader'
            ? '先打开点读页，读完回来打勾，然后继续下一节或返回资料包。'
            : '打完勾后，可以继续下一节、返回资料包，或者切换拼音显示。';
        const completeNoteText = !completed && quizRequired && !quizPassed
            ? '先完成章节轻测验，通过后再打勾领取成长分。'
            : completionHint;

        container.innerHTML = `
            <div class="learn-shell">
                <section class="learn-hero learn-lesson-hero">
                    <h2>${moduleMeta?.emoji || '📝'} ${moduleMeta?.title || module?.title || '学习内容'}</h2>
                    <p>${lesson.title || '今日学习内容'} · ${manifest?.title || ''}</p>
                    ${buildBadges([
                        `📍 ${lessonId}`,
                        `📘 第 ${nav.index + 1}/${nav.total} 节`,
                        `⭐ 完成可得 ${rewardPoints} 分`,
                        completed ? '✅ 已完成' : '🕒 待完成'
                    ])}
                    <div class="learn-lesson-state ${completed ? 'is-completed' : ''}" data-learn-completion-badge>${getLessonCompletionBadge(completed)}</div>
                </section>
                ${renderLessonBody(pack, module, lesson, prefs.showPinyin, lessonContext)}
                ${renderLessonQuiz(packId, moduleId, lessonId, lesson)}
                <section class="learn-card learn-complete-card ${completed ? 'is-completed' : ''}" data-learn-complete-card>
                    <div class="learn-complete-copy">
                        <span class="learn-complete-kicker">${completed ? '本页已打勾' : '本页读完就点这里'}</span>
                        <h3 data-learn-complete-heading>${completed ? '这一页已经打勾了' : '这一页读完了吗？'}</h3>
                        <p data-learn-complete-copy>${completionIntro}</p>
                    </div>
                    <div class="learn-complete-actions">
                        <button class="learn-btn learn-btn-primary learn-btn-check" data-learn-action="complete-lesson" ${completeDisabled ? 'disabled' : ''}>${completed ? '✅ 已打勾' : quizRequired && !quizPassed ? '先通过测验再打勾' : `✅ 读完打勾 +${rewardPoints} 分`}</button>
                        <p class="learn-complete-note" data-learn-complete-note>${completeNoteText}</p>
                    </div>
                </section>
                <section class="learn-card learn-lesson-actions">
                    <div class="learn-lesson-actions-copy">
                        <h3 class="learn-section-title">继续学习</h3>
                        <p class="learn-lesson-actions-note">${actionNote}</p>
                    </div>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${packId}')">返回资料包</button>
                        <button class="learn-btn learn-btn-secondary" ${nav.prevLessonId ? '' : 'disabled'} data-learn-action="prev-lesson">上一节</button>
                        <button class="learn-btn learn-btn-secondary" ${nav.nextLessonId ? '' : 'disabled'} data-learn-action="next-lesson">下一节</button>
                        ${showPinyinToggle ? `<button class="learn-btn learn-btn-secondary" data-learn-action="toggle-pinyin">${prefs.showPinyin ? '隐藏拼音' : '显示拼音'}</button>` : ''}
                    </div>
                </section>
            </div>
        `;

        const prevBtn = container.querySelector('[data-learn-action="prev-lesson"]');
        if (prevBtn && nav.prevLessonId) {
            prevBtn.addEventListener('click', () => openLesson(packId, moduleId, nav.prevLessonId));
        }
        const nextBtn = container.querySelector('[data-learn-action="next-lesson"]');
        if (nextBtn && nav.nextLessonId) {
            nextBtn.addEventListener('click', () => openLesson(packId, moduleId, nav.nextLessonId));
        }

        const toggleBtn = container.querySelector('[data-learn-action="toggle-pinyin"]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                togglePinyinPref();
                void renderLesson(containerId || 'learn-lesson-container');
            });
        }

        container.querySelectorAll('[data-learn-quiz-choice]').forEach(button => {
            button.addEventListener('click', () => {
                const question = button.closest('[data-learn-quiz-question]');
                question?.querySelectorAll('[data-learn-quiz-choice]').forEach(item => item.classList.remove('is-selected'));
                button.classList.add('is-selected');
            });
        });

        const quizBtn = container.querySelector('[data-learn-action="submit-quiz"]');
        if (quizBtn) {
            quizBtn.addEventListener('click', () => {
                const quiz = getLessonQuiz(lesson);
                if (!quiz) return;
                let correct = 0;
                quiz.questions.forEach(question => {
                    const block = container.querySelector(`[data-question-id="${CSS.escape(question.id)}"]`);
                    const selected = block?.querySelector('[data-learn-quiz-choice].is-selected')?.dataset.learnQuizChoice || '';
                    if (selected === question.answer) correct += 1;
                });
                const total = quiz.questions.length;
                const passScore = Number(quiz.passScore) || Math.max(1, total);
                const passed = correct >= passScore;
                const attempts = getQuizAttempts();
                attempts[getQuizKey(packId, moduleId, lessonId)] = {
                    passed,
                    correct,
                    total,
                    updatedAt: new Date().toISOString()
                };
                saveQuizAttempts(attempts);
                if (typeof window.showToast === 'function') {
                    window.showToast(passed ? `✅ 测验通过：答对 ${correct}/${total} 题` : `再试一次：答对 ${correct}/${total} 题`);
                }
                void renderLesson(containerId || 'learn-lesson-container');
            });
        }

        const completeBtn = container.querySelector('[data-learn-action="complete-lesson"]');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => {
                const result = completeLesson(packId, moduleId, lessonId, rewardPoints);
                const completionBadge = container.querySelector('[data-learn-completion-badge]');
                const completeCard = container.querySelector('[data-learn-complete-card]');
                const completeHeading = container.querySelector('[data-learn-complete-heading]');
                const completeCopy = container.querySelector('[data-learn-complete-copy]');
                const completeNote = container.querySelector('[data-learn-complete-note]');

                completeBtn.textContent = result.totalPoints > 0
                    ? `✅ 已打勾 +${result.totalPoints} 分`
                    : '✅ 已打勾';
                completeBtn.disabled = true;
                if (completionBadge) {
                    completionBadge.textContent = getLessonCompletionBadge(true);
                    completionBadge.classList.add('is-completed');
                }
                if (completeCard) completeCard.classList.add('is-completed');
                if (completeHeading) completeHeading.textContent = '这一页已经打勾了';
                if (completeCopy) {
                    completeCopy.textContent = '完成记录已经保存，可以继续下一节，也可以回到“我的进度”查看累计成长分。';
                }
                if (completeNote) {
                    completeNote.textContent = getLessonCompletionSuccessNote(result);
                }
                if (document.getElementById('points-learning-sheet-container')) {
                    void renderDailyCheckin('points-learning-sheet-container');
                }
                if (typeof window.showToast === 'function') {
                    window.showToast(getLessonCompletionToast(result));
                }
            });
        }
    }

    async function renderPrint(containerId) {
        const container = document.getElementById(containerId || 'learn-print-container');
        if (!container) return;
        const packId = state.activePackId;
        const pack = await getPack(packId);
        const manifest = pack && pack.manifest;
        const plan = pack && pack.plan;
        const modulesById = await loadAllModules(packId);
        const prefs = getPrintPrefs();
        const dailyPrintMode = getDailySheetMode();
        const showDailyPrintSheet = packId === 'summer-chinese-bridge-2026';
        const dailyPrintOptions = showDailyPrintSheet ? await buildDailySheetOptions() : null;

        const moduleSections = (manifest?.modules || []).map((moduleMeta, moduleIndex) => {
            const module = modulesById[moduleMeta.id];
            const lessons = Array.isArray(module?.lessons) ? module.lessons : [];
            let body = '';
            if (moduleMeta.id === 'morning-reading') {
                body = lessons.map(lesson => {
                    const dayMeta = getPlanDayMeta(plan, lesson.day, 'reading');
                    const lastLesson = lessons.length ? lessons[lessons.length - 1] : null;
                    const marker = lesson.day === 1 || lesson.day === 31
                        ? renderPrintChapterMarker(moduleMeta, lesson, plan, 'reading', lastLesson?.day || lessons.length)
                        : '';
                    const worksheet = renderReadingWorksheet(
                        lesson,
                        prefs.showPinyin,
                        Object.assign(
                            { meta: dayMeta },
                            getReadingCompanions(modulesById, lesson)
                        )
                    );
                    return marker + enhancePrintPaper(worksheet, {
                        moduleTitle: moduleMeta.title,
                        pageLabel: `第 ${lesson.day || 1} 天`,
                        ribbon: dayMeta.headerText,
                        footer: '指字朗读一遍，读顺即可'
                    });
                }).join('');
            } else if (moduleMeta.id === 'literacy-45days') {
                body = lessons.map(lesson => {
                    const dayMeta = getPlanDayMeta(plan, lesson.day, 'literacy');
                    const lastLesson = lessons.length ? lessons[lessons.length - 1] : null;
                    const marker = lesson.day === 1 || lesson.day === 31
                        ? renderPrintChapterMarker(moduleMeta, lesson, plan, 'literacy', lastLesson?.day || lessons.length)
                        : '';
                    return marker + enhancePrintPaper(renderLiteracyWorksheet(
                        lesson,
                        prefs.showPinyin,
                        { charLibrary: pack?.charLibrary || { items: [] } }
                    ), {
                        moduleTitle: moduleMeta.title,
                        pageLabel: `第 ${lesson.day || 1} 天`,
                        ribbon: dayMeta.headerText,
                        footer: '先认字，再读例句，不要求抄写'
                    });
                }).join('');
            } else if (module?.type === 'resource-hub') {
                body = lessons.map((lesson, index) => enhancePrintPaper(renderResourceHubWorksheet(module, lesson), {
                    moduleTitle: moduleMeta.title,
                    pageLabel: lesson?.duration || `第 ${index + 1} 节`,
                    ribbon: lesson?.title || '网站入口',
                    footer: '网站学习结束后，回到当前项目点完成'
                })).join('');
            } else if (module?.type === 'external-reader') {
                body = lessons.map((lesson, index) => enhancePrintPaper(renderExternalReaderWorksheet(pack, module, lesson), {
                    moduleTitle: moduleMeta.title,
                    pageLabel: lesson?.duration || `第 ${index + 1} 节`,
                    ribbon: lesson?.title || '英语点读',
                    footer: '点读结束后回到当前项目领取成长分'
                })).join('');
            } else if (module?.type === 'review') {
                body = lessons.map((lesson, index) => enhancePrintPaper(renderReviewWorksheet(lesson), {
                    moduleTitle: moduleMeta.title,
                    pageLabel: lesson?.title || `第 ${index + 1} 次`,
                    ribbon: '周末复盘',
                    footer: '复盘完成后回到网页领取成长分'
                })).join('');
            } else {
                body = enhancePrintPaper(renderReadingCollection(module, prefs.showPinyin), {
                    moduleTitle: moduleMeta.title,
                    pageLabel: moduleMeta.duration || '拓展',
                    ribbon: '补充资源',
                    footer: '可以穿插到晨读里使用'
                });
            }
            return `
                <section class="learn-print-section">
                    <div class="learn-print-section-heading">${moduleMeta.emoji || '📝'} ${moduleMeta.title}</div>
                    ${renderPrintModuleDivider(moduleMeta, module, moduleIndex)}
                    ${body}
                </section>
            `;
        }).join('');

        container.innerHTML = `
            <div class="learn-shell">
                <section class="learn-hero learn-print-hero">
                    <div>
                        <h2>🖨️ A4 讲义预览</h2>
                        <p>${showDailyPrintSheet ? '支持“每日一页学习单 + 讲义正文”一起预览，也可以直接用浏览器打印或导出 PDF。' : '可以先在网页里看效果，再直接用浏览器打印或导出 PDF。'}</p>
                    </div>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-primary" data-learn-action="print-page">打印 / 导出 PDF</button>
                        <button class="learn-btn learn-btn-secondary" data-learn-action="toggle-print-pinyin">${prefs.showPinyin ? '打印时隐藏拼音' : '打印时显示拼音'}</button>
                    </div>
                </section>
                <div class="learn-print-sheet">
                    <section class="learn-print-section learn-print-section-cover">
                        ${renderPrintCover(manifest, plan)}
                        ${renderPrintWorkbookMap(manifest, plan, modulesById)}
                    </section>
                    ${showDailyPrintSheet && dailyPrintOptions ? `
                        <section class="learn-print-section">
                            <div class="learn-print-section-heading">🗓️ 每日学习单</div>
                            ${renderPrintDailySheet(dailyPrintMode, dailyPrintOptions)}
                        </section>
                    ` : ''}
                    ${moduleSections}
                </div>
            </div>
        `;

        const printBtn = container.querySelector('[data-learn-action="print-page"]');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                if (typeof window.print === 'function') window.print();
            });
        }

        const toggleBtn = container.querySelector('[data-learn-action="toggle-print-pinyin"]');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                togglePinyinPref();
                void renderPrint(containerId || 'learn-print-container');
            });
        }
    }

    function maybeGrantDailyBundle(packId, lessonId, rewards) {
        const dayMatch = /^day-\d+$/.test(lessonId);
        if (!dayMatch) return { bundleGranted: false, bundlePoints: 0 };
        const morningDone = isLessonCompleted(packId, 'morning-reading', lessonId);
        const literacyDone = isLessonCompleted(packId, 'literacy-45days', lessonId);
        const bundleKey = `${packId}:daily-bundle:${lessonId}`;
        if (morningDone && literacyDone && !rewards[bundleKey]) {
            rewards[bundleKey] = {
                points: 1,
                claimedAt: Date.now()
            };
            if (typeof window.addGrowthPoints === 'function') {
                window.addGrowthPoints(1);
            }
            return { bundleGranted: true, bundlePoints: 1 };
        }
        return { bundleGranted: false, bundlePoints: 0 };
    }

    function maybeGrantPackStreak(packId, moduleId, progress, rewards) {
        const manifest = state.packCache?.[packId]?.manifest || null;
        const streakRule = manifest?.streakRule || null;
        const moduleIds = Array.isArray(streakRule?.moduleIds) ? streakRule.moduleIds : [];
        if (!moduleIds.length || !moduleIds.includes(moduleId)) {
            return { streakGranted: false, streakPoints: 0 };
        }
        const every = Number(streakRule?.every) || 0;
        const streakPoints = Number(streakRule?.points) || Number(manifest?.rewardRules?.[streakRule?.rewardKey]) || 0;
        if (!every || !streakPoints) {
            return { streakGranted: false, streakPoints: 0 };
        }
        const completedCount = moduleIds.reduce((total, id) => {
            const completedLessons = progress?.[packId]?.modules?.[id]?.completedLessons || [];
            return total + completedLessons.length;
        }, 0);
        if (!completedCount || completedCount % every !== 0) {
            return { streakGranted: false, streakPoints: 0 };
        }
        const streakKey = `${packId}:streak:${completedCount}`;
        if (rewards[streakKey]) {
            return { streakGranted: false, streakPoints: 0 };
        }
        rewards[streakKey] = {
            points: streakPoints,
            claimedAt: Date.now()
        };
        if (typeof window.addGrowthPoints === 'function') {
            window.addGrowthPoints(streakPoints);
        }
        return { streakGranted: true, streakPoints };
    }

    function completeLesson(packId, moduleId, lessonId, rewardPoints) {
        const progress = getProgressState();
        const rewards = getRewardState();
        if (!progress[packId]) {
            progress[packId] = { modules: {}, updatedAt: Date.now() };
        }
        if (!progress[packId].modules[moduleId]) {
            progress[packId].modules[moduleId] = { completedLessons: [] };
        }
        const completedLessons = progress[packId].modules[moduleId].completedLessons;
        if (!completedLessons.includes(lessonId)) {
            completedLessons.push(lessonId);
        }
        progress[packId].lastLessonId = `${moduleId}:${lessonId}`;
        progress[packId].updatedAt = Date.now();
        saveProgressState(progress);

        let rewardGranted = false;
        let totalPoints = 0;
        const rewardKey = `${packId}:${moduleId}:${lessonId}`;
        if (!rewards[rewardKey]) {
            rewards[rewardKey] = {
                points: rewardPoints,
                claimedAt: Date.now()
            };
            if (typeof window.addGrowthPoints === 'function') {
                window.addGrowthPoints(rewardPoints);
            }
            rewardGranted = true;
            totalPoints += rewardPoints;
        }

        const bundle = maybeGrantDailyBundle(packId, lessonId, rewards);
        const streak = maybeGrantPackStreak(packId, moduleId, progress, rewards);
        totalPoints += bundle.bundlePoints;
        totalPoints += streak.streakPoints;
        saveRewardState(rewards);
        return {
            rewardGranted,
            bundleGranted: bundle.bundleGranted,
            streakGranted: streak.streakGranted,
            totalPoints
        };
    }

    function openPack(packId) {
        state.activePackId = packId || state.activePackId;
        persistCatalogState();
        resetLearningScroll();
        if (typeof window.switchPage === 'function') {
            window.switchPage('learn-pack');
        } else {
            void renderPack('learn-pack-container');
        }
    }

    function openLesson(packId, moduleId, lessonId) {
        state.activePackId = packId || state.activePackId;
        state.activeModuleId = moduleId;
        state.activeLessonId = lessonId;
        persistCatalogState();
        resetLearningScroll();
        if (typeof window.switchPage === 'function') {
            window.switchPage('learn-lesson');
        } else {
            void renderLesson('learn-lesson-container');
        }
    }

    function openPlan(packId) {
        state.activePackId = packId || state.activePackId;
        persistCatalogState();
        resetLearningScroll();
        if (typeof window.switchPage === 'function') {
            window.switchPage('learn-plan');
        } else {
            void renderPlan('learn-plan-container');
        }
    }

    function openPrint(packId) {
        state.activePackId = packId || state.activePackId;
        persistCatalogState();
        resetLearningScroll();
        if (typeof window.switchPage === 'function') {
            window.switchPage('learn-print');
        } else {
            void renderPrint('learn-print-container');
        }
    }

    window.LearnCenter = {
        init,
        getCatalog,
        getPack,
        getModule,
        loadAllModules,
        renderHub,
        renderDailyCheckin,
        getDailySheetMode,
        setDailySheetMode,
        getDailySheetModes,
        renderPack,
        renderPlan,
        renderLesson,
        renderPrint,
        openPack,
        openLesson,
        openPlan,
        openPrint,
        resolvePackCapabilities,
        resolveLessonSource,
        resolveLessonLaunchUrl,
        resolveLessonReward,
        completeLesson
    };
})();
