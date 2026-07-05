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
        printPrefs: 'petbank_learning_print_prefs'
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

    function getPrintPrefs() {
        return readStorage(STORAGE_KEYS.printPrefs, { showPinyin: true });
    }

    function savePrintPrefs(next) {
        writeStorage(STORAGE_KEYS.printPrefs, next);
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

    function getModuleProgress(packId, module) {
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

        const actionLead = module?.type === 'resource-hub'
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
        if (result.totalPoints > 0 && result.bundleGranted) {
            return `✅ 读完打勾成功，成长分 +${result.totalPoints}（含连读奖励）`;
        }
        if (result.totalPoints > 0) {
            return `✅ 读完打勾成功，成长分 +${result.totalPoints}`;
        }
        return '✅ 读完打勾完成，进度已保存';
    }

    function getLessonCompletionSuccessNote(result) {
        if (result.totalPoints > 0 && result.bundleGranted) {
            return `已打勾完成，成长分 +${result.totalPoints} 已到账，今天的连读奖励也一起记上了。`;
        }
        if (result.totalPoints > 0) {
            return `已打勾完成，成长分 +${result.totalPoints} 已到账，可以继续下一节。`;
        }
        return '已打勾完成，进度已保存；这页的成长分之前已经领过了。';
    }

    function getContinueLessonId(packId, module) {
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

    function getTodayLearningPlan(summerRecord, siteRecord) {
        const today = new Date();
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
                return {
                    key,
                    claimedAt: Number(value?.claimedAt) || 0,
                    points: Number(value?.points) || 0,
                    title: isBundle
                        ? '晨读 + 识字同日完成'
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
            '复盘': 'fu pan'
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

    function renderLessonBody(module, lesson, showPinyin, context) {
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

        const readingModule = summerRecord?.modulesById?.['morning-reading'] || null;
        const literacyModule = summerRecord?.modulesById?.['literacy-45days'] || null;
        const reviewModule = summerRecord?.modulesById?.['weekly-review'] || null;
        const guidedSitesModule = siteRecord?.modulesById?.['guided-sites'] || null;

        const readingContinueId = readingModule ? getContinueLessonId(summerRecord.id, readingModule) : null;
        const literacyContinueId = literacyModule ? getContinueLessonId(summerRecord.id, literacyModule) : null;
        const reviewContinueId = reviewModule ? getContinueLessonId(summerRecord.id, reviewModule) : null;
        const siteContinueId = guidedSitesModule ? getContinueLessonId(siteRecord.id, guidedSitesModule) : null;

        const readingMeta = getModuleMeta(summerRecord?.pack?.manifest, 'morning-reading');
        const literacyMeta = getModuleMeta(summerRecord?.pack?.manifest, 'literacy-45days');
        const reviewMeta = getModuleMeta(summerRecord?.pack?.manifest, 'weekly-review');
        const siteMeta = getModuleMeta(siteRecord?.pack?.manifest, 'guided-sites');

        const readingProgress = readingModule ? getModuleProgress(summerRecord.id, readingModule) : { completed: 0, total: 0, percent: 0 };
        const literacyProgress = literacyModule ? getModuleProgress(summerRecord.id, literacyModule) : { completed: 0, total: 0, percent: 0 };
        const reviewProgress = reviewModule ? getModuleProgress(summerRecord.id, reviewModule) : { completed: 0, total: 0, percent: 0 };
        const siteProgress = guidedSitesModule ? getModuleProgress(siteRecord.id, guidedSitesModule) : { completed: 0, total: 0, percent: 0 };
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
        const rewards = getRewardState();
        const totalPointsEarned = sumRewardPoints(rewards);
        const overallPercent = totalProgress.total ? Math.round((totalProgress.completed / totalProgress.total) * 100) : 0;
        const recentRewardItems = getRecentRewardItems(rewards, packRecords);

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

        const activeHubTab = ['today', 'packs', 'sites', 'prints', 'progress'].includes(state.activeHubTab) ? state.activeHubTab : 'today';
        const tabPanelMap = {
            today: `
                <div class="learn-hub-grid">${quickCards}</div>
                <div class="learn-soft-note">${todayPlan.note}。推荐先从晨读或识字开始，再视状态穿插“学习网站入口”。</div>
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
                        <p class="learn-hub-eyebrow">学习主页</p>
                        <h2>今天先学什么？</h2>
                        <p>这里直接进入幼小衔接暑假中文资料包、学习网站入口和打印讲义，不再先放宣传封面。${todayPlan.note}</p>
                        ${buildBadges([
                            `📅 ${todayPlan.todayLabel}`,
                            `📚 ${packRecords.length} 套资料包`,
                            `✅ 已完成 ${totalProgress.completed}/${totalProgress.total || 0} · ${overallPercent}%`,
                            `⭐ 累计学习分 ${totalPointsEarned}`,
                            '🌐 学习网站入口',
                            '🖨️ 打印讲义可用'
                        ])}
                    </div>
                    <div class="learn-hub-visuals">
                        <article class="learn-hub-visual learn-hub-visual-reading">
                            <div class="learn-hub-visual-art learn-hub-visual-art-reading">
                                <div class="learn-illus-sun"></div>
                                <div class="learn-illus-book">
                                    <span></span>
                                    <span></span>
                                </div>
                                <div class="learn-illus-lines">
                                    <i></i><i></i><i></i>
                                </div>
                            </div>
                            <div class="learn-hub-visual-copy">
                                <span>晨读入口</span>
                                <strong>短句 · 唐诗 · 经典短句</strong>
                                <p>像翻讲义一样，轻轻开始。</p>
                            </div>
                        </article>
                        <article class="learn-hub-visual learn-hub-visual-literacy">
                            <div class="learn-hub-visual-art learn-hub-visual-art-literacy">
                                <div class="learn-illus-tile">字</div>
                                <div class="learn-illus-tile">词</div>
                                <div class="learn-illus-pencil"></div>
                            </div>
                            <div class="learn-hub-visual-copy">
                                <span>识字入口</span>
                                <strong>45 天识字</strong>
                                <p>拼音、新字、短句一起推进。</p>
                            </div>
                        </article>
                        <article class="learn-hub-visual learn-hub-visual-sites">
                            <div class="learn-hub-visual-art learn-hub-visual-art-sites">
                                <div class="learn-illus-window">
                                    <b></b><b></b><b></b>
                                    <span></span>
                                </div>
                                <div class="learn-illus-card learn-illus-card-left"></div>
                                <div class="learn-illus-card learn-illus-card-right"></div>
                            </div>
                            <div class="learn-hub-visual-copy">
                                <span>学习网站</span>
                                <strong>官方平台 + 工具站 + 阅读站</strong>
                                <p>先在站内选入口，再出去学。</p>
                            </div>
                        </article>
                    </div>
                </section>
                <section class="learn-stage-panel learn-hub-panel-wrap">
                    <div class="learn-stage-head learn-hub-tabs-head">
                        <h3 class="learn-section-title">学习选项卡</h3>
                        <div class="learn-hub-tabs">
                            <button class="learn-hub-tab ${activeHubTab === 'today' ? 'is-active' : ''}" data-learn-hub-tab="today">今日学习</button>
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
                        <button class="learn-btn learn-btn-primary" onclick="LearnCenter.openLesson('${packId}','${moduleMeta.id}','${continueLessonId || ''}')">${progress.completed ? '继续学习' : '打开第一节'}</button>
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
        const rewardPoints = rewardForModule(manifest, moduleId);
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
                ${renderLessonBody(module, lesson, prefs.showPinyin, lessonContext)}
                <section class="learn-card learn-complete-card ${completed ? 'is-completed' : ''}" data-learn-complete-card>
                    <div class="learn-complete-copy">
                        <span class="learn-complete-kicker">${completed ? '本页已打勾' : '本页读完就点这里'}</span>
                        <h3 data-learn-complete-heading>${completed ? '这一页已经打勾了' : '这一页读完了吗？'}</h3>
                        <p data-learn-complete-copy>${completionIntro}</p>
                    </div>
                    <div class="learn-complete-actions">
                        <button class="learn-btn learn-btn-primary learn-btn-check" data-learn-action="complete-lesson" ${completed ? 'disabled' : ''}>${completed ? '✅ 已打勾' : `✅ 读完打勾 +${rewardPoints} 分`}</button>
                        <p class="learn-complete-note" data-learn-complete-note>${completionHint}</p>
                    </div>
                </section>
                <section class="learn-card learn-lesson-actions">
                    <div class="learn-lesson-actions-copy">
                        <h3 class="learn-section-title">继续学习</h3>
                        <p class="learn-lesson-actions-note">打完勾后，可以继续下一节、返回资料包，或者切换拼音显示。</p>
                    </div>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-secondary" onclick="LearnCenter.openPack('${packId}')">返回资料包</button>
                        <button class="learn-btn learn-btn-secondary" ${nav.prevLessonId ? '' : 'disabled'} data-learn-action="prev-lesson">上一节</button>
                        <button class="learn-btn learn-btn-secondary" ${nav.nextLessonId ? '' : 'disabled'} data-learn-action="next-lesson">下一节</button>
                        <button class="learn-btn learn-btn-secondary" data-learn-action="toggle-pinyin">${prefs.showPinyin ? '隐藏拼音' : '显示拼音'}</button>
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
                        <p>可以先在网页里看效果，再直接用浏览器打印或导出 PDF。</p>
                    </div>
                    <div class="learn-card-actions">
                        <button class="learn-btn learn-btn-secondary" data-learn-action="toggle-print-pinyin">${prefs.showPinyin ? '打印时隐藏拼音' : '打印时显示拼音'}</button>
                    </div>
                </section>
                <div class="learn-print-sheet">
                    <section class="learn-print-section learn-print-section-cover">
                        ${renderPrintCover(manifest, plan)}
                        ${renderPrintWorkbookMap(manifest, plan, modulesById)}
                    </section>
                    ${moduleSections}
                </div>
            </div>
        `;

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
        totalPoints += bundle.bundlePoints;
        saveRewardState(rewards);
        return {
            rewardGranted,
            bundleGranted: bundle.bundleGranted,
            totalPoints
        };
    }

    function openPack(packId) {
        state.activePackId = packId || state.activePackId;
        persistCatalogState();
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
        if (typeof window.switchPage === 'function') {
            window.switchPage('learn-lesson');
        } else {
            void renderLesson('learn-lesson-container');
        }
    }

    function openPlan(packId) {
        state.activePackId = packId || state.activePackId;
        persistCatalogState();
        if (typeof window.switchPage === 'function') {
            window.switchPage('learn-plan');
        } else {
            void renderPlan('learn-plan-container');
        }
    }

    function openPrint(packId) {
        state.activePackId = packId || state.activePackId;
        persistCatalogState();
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
        renderPack,
        renderPlan,
        renderLesson,
        renderPrint,
        openPack,
        openLesson,
        openPlan,
        openPrint,
        completeLesson
    };
})();
