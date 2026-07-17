/* picturebooks.js - curated picture-book library and in-app reader */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'petbank_picturebook_progress_v1';
    const LIBRARY_STORAGE_KEY = 'petbank_picturebook_library_v1';
    const CATALOG_PATH = 'data/picturebooks/catalog.json';
    const DEFAULT_PROGRESS = { schemaVersion: 1, books: {} };
    const DEFAULT_LIBRARY = { schemaVersion: 1, favorites: [] };
    const SHELF_LABELS = {
        snake: '中文启蒙',
        'pete-cat': '生活故事',
        'little-critter': '生活故事',
        'knuffle-bunny': '生活故事',
        'pigeon-bus': '生活故事',
        gruffalo: '想象世界',
        'wild-things': '想象世界',
        'crayons-quit': '想象世界'
    };

    const state = {
        catalog: [],
        category: '全部',
        search: '',
        status: 'all',
        sort: 'recommended',
        activeStoryId: '',
        activePage: 0,
        loaded: false,
        renderToken: 0
    };

    function getRoot(rootId) {
        return root.document && root.document.getElementById(rootId || 'picturebooks-root');
    }

    function resolveAsset(path) {
        return typeof root.resolvePetBankAssetUrl === 'function'
            ? root.resolvePetBankAssetUrl(path)
            : path;
    }

    function getProfileId() {
        try {
            if (root.ProfileManager && typeof root.ProfileManager.getActiveId === 'function') {
                return String(root.ProfileManager.getActiveId() || 'p_default');
            }
        } catch (error) {
            console.warn('[Picturebooks] profile id lookup failed:', error);
        }
        return 'p_default';
    }

    function getLocalDate() {
        if (root.PetBankTime && typeof root.PetBankTime.localDate === 'function') {
            return root.PetBankTime.localDate();
        }
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }

    function defaultBookProgress() {
        return {
            currentPage: 0,
            completedCount: 0,
            lastReadAt: '',
            lastCompletedAt: '',
            completionEventId: '',
            rewardClaimed: false
        };
    }

    function normalizeProgress(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const books = source.books && typeof source.books === 'object' && !Array.isArray(source.books)
            ? source.books
            : {};
        const normalizedBooks = {};
        Object.keys(books).forEach(function (id) {
            const item = books[id];
            if (!item || typeof item !== 'object' || Array.isArray(item)) return;
            normalizedBooks[id] = {
                ...defaultBookProgress(),
                currentPage: Math.max(0, Math.floor(Number(item.currentPage) || 0)),
                completedCount: Math.max(0, Math.floor(Number(item.completedCount) || 0)),
                lastReadAt: String(item.lastReadAt || ''),
                lastCompletedAt: String(item.lastCompletedAt || ''),
                completionEventId: String(item.completionEventId || ''),
                rewardClaimed: item.rewardClaimed === true
            };
        });
        return { schemaVersion: 1, books: normalizedBooks };
    }

    function readProgress() {
        try {
            const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
            return normalizeProgress(raw ? JSON.parse(raw) : DEFAULT_PROGRESS);
        } catch (error) {
            console.warn('[Picturebooks] progress read failed; using defaults:', error);
            return { ...DEFAULT_PROGRESS, books: {} };
        }
    }

    function writeProgress(progress) {
        try {
            if (!root.localStorage) return false;
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeProgress(progress)));
            return true;
        } catch (error) {
            console.warn('[Picturebooks] progress write failed:', error);
            return false;
        }
    }

    function normalizeLibrary(value) {
        const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
        const favorites = Array.isArray(source.favorites)
            ? Array.from(new Set(source.favorites.map(item => String(item || '').trim()).filter(Boolean)))
            : [];
        return { schemaVersion: 1, favorites };
    }

    function readLibrary() {
        try {
            const raw = root.localStorage && root.localStorage.getItem(LIBRARY_STORAGE_KEY);
            return normalizeLibrary(raw ? JSON.parse(raw) : DEFAULT_LIBRARY);
        } catch (error) {
            console.warn('[Picturebooks] library preferences read failed; using defaults:', error);
            return { ...DEFAULT_LIBRARY, favorites: [] };
        }
    }

    function writeLibrary(value) {
        try {
            if (!root.localStorage) return false;
            root.localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(normalizeLibrary(value)));
            return true;
        } catch (error) {
            console.warn('[Picturebooks] library preferences write failed:', error);
            return false;
        }
    }

    function isFavorite(library, storyId) {
        return library.favorites.includes(storyId);
    }

    function toggleFavorite(storyId) {
        const library = readLibrary();
        const favorites = isFavorite(library, storyId)
            ? library.favorites.filter(id => id !== storyId)
            : library.favorites.concat(storyId);
        if (writeLibrary({ ...library, favorites })) renderDirectory();
    }

    function progressFor(progress, storyId) {
        return progress.books[storyId] || defaultBookProgress();
    }

    function getShelf(story) {
        return String((story && (story.shelf || SHELF_LABELS[story.id])) || '双语阅读');
    }

    function normalizeStory(story) {
        if (!story || typeof story !== 'object' || !story.id || !Array.isArray(story.pages) || !story.pages.length) return null;
        const pages = story.pages.map(function (page, index) {
            if (!page || !page.image) return null;
            return {
                page: index + 1,
                image: String(page.image),
                en: String(page.en || ''),
                zh: String(page.zh || '')
            };
        }).filter(Boolean);
        if (!pages.length) return null;
        return {
            id: String(story.id),
            title: String(story.title || story.id),
            titleZh: String(story.titleZh || story.title || story.id),
            titleEn: String(story.titleEn || story.title || story.id),
            category: String(story.category || '绘本'),
            shelf: getShelf(story),
            author: String(story.author || '儿童绘本素材库'),
            ageRange: String(story.ageRange || '4-6岁'),
            difficulty: String(story.difficulty || '入门'),
            durationMin: Math.max(1, Math.floor(Number(story.durationMin) || 1)),
            tags: Array.isArray(story.tags) ? story.tags.map(item => String(item)).filter(Boolean) : [],
            keywords: Array.isArray(story.keywords) ? story.keywords.map(item => String(item)).filter(Boolean) : [],
            license: String(story.license || 'unspecified'),
            publishable: story.publishable === true,
            cover: String(story.cover || pages[0].image),
            pages
        };
    }

    async function loadCatalog() {
        const response = await fetch(resolveAsset(CATALOG_PATH));
        if (!response.ok) throw new Error(`catalog request failed: ${response.status}`);
        const payload = await response.json();
        const stories = Array.isArray(payload && payload.stories) ? payload.stories.map(normalizeStory).filter(Boolean) : [];
        if (!stories.length) throw new Error('catalog contains no valid stories');
        return stories;
    }

    function getCategories() {
        return ['全部'].concat(Array.from(new Set(state.catalog.map(getShelf))));
    }

    function getStoryStatus(story, progress) {
        const item = progressFor(progress, story.id);
        if (item.completedCount > 0) return 'completed';
        if (item.currentPage > 0) return 'reading';
        return 'unread';
    }

    function getVisibleStories(progress) {
        const query = state.search.trim().toLocaleLowerCase();
        const library = readLibrary();
        const visible = state.catalog.filter(function (story) {
            if (state.category !== '全部' && getShelf(story) !== state.category) return false;
            if (state.status === 'favorite' && !isFavorite(library, story.id)) return false;
            if (state.status !== 'all' && state.status !== 'favorite' && getStoryStatus(story, progress) !== state.status) return false;
            if (!query) return true;
            const haystack = [story.titleZh, story.titleEn, story.author, story.shelf, story.ageRange, story.difficulty]
                .concat(story.tags, story.keywords).join(' ').toLocaleLowerCase();
            return haystack.includes(query);
        });
        return visible.sort(function (left, right) {
            if (state.sort === 'title') return left.titleZh.localeCompare(right.titleZh, 'zh-CN');
            if (state.sort === 'duration') return left.durationMin - right.durationMin;
            if (state.sort === 'newest') return state.catalog.indexOf(right) - state.catalog.indexOf(left);
            return state.catalog.indexOf(left) - state.catalog.indexOf(right);
        });
    }

    function makeElement(tag, className, text) {
        const node = root.document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function icon(name) {
        const node = makeElement('i');
        node.dataset.lucide = name;
        node.setAttribute('aria-hidden', 'true');
        return node;
    }

    function button(label, className, action, ariaLabel) {
        const node = makeElement('button', className, label);
        node.type = 'button';
        node.dataset.picturebookAction = action;
        if (ariaLabel) node.setAttribute('aria-label', ariaLabel);
        return node;
    }

    function clearRoot(rootEl) {
        rootEl.textContent = '';
        rootEl.className = 'picturebooks-page';
    }

    function buildShell(rootEl) {
        clearRoot(rootEl);

        const hero = makeElement('section', 'picturebooks-hero');
        const heroCopy = makeElement('div', 'picturebooks-hero-copy');
        heroCopy.appendChild(makeElement('span', 'picturebooks-kicker', '绘本故事屋'));
        heroCopy.appendChild(makeElement('h2', '', '读一个故事，陪宠物长大'));
        heroCopy.appendChild(makeElement('p', '', '从一张图开始，慢慢读到最后一页。每本绘本首次读完，都有一份成长礼物。'));
        hero.appendChild(heroCopy);

        const heroStats = makeElement('div', 'picturebooks-hero-stats');
        [['picturebooks-total-count', '本故事'], ['picturebooks-completed-count', '本已读'], ['picturebooks-points-hint', '完成奖励']].forEach(function (item) {
            const stat = makeElement('div', 'picturebooks-stat');
            stat.appendChild(makeElement('strong', '', '0'));
            stat.firstChild.id = item[0];
            stat.appendChild(makeElement('span', '', item[1]));
            heroStats.appendChild(stat);
        });
        const pointsHint = heroStats.querySelector('#picturebooks-points-hint');
        if (pointsHint) pointsHint.textContent = '+8 分';
        hero.appendChild(heroStats);
        rootEl.appendChild(hero);

        const layout = makeElement('div', 'picturebooks-layout');
        const aside = makeElement('aside', 'picturebooks-sidebar');
        aside.appendChild(makeElement('div', 'picturebooks-sidebar-heading', '按主题找故事'));
        const categoryList = makeElement('div', 'picturebooks-category-list');
        categoryList.id = 'picturebooks-categories';
        categoryList.setAttribute('role', 'list');
        aside.appendChild(categoryList);
        const note = makeElement('div', 'picturebooks-sidebar-note');
        note.appendChild(icon('sparkles'));
        note.appendChild(makeElement('span', '', '读到最后一页，再点击完成阅读，成长分才会到账。'));
        aside.appendChild(note);
        layout.appendChild(aside);

        const content = makeElement('section', 'picturebooks-content');
        const contentHead = makeElement('div', 'picturebooks-content-head');
        const heading = makeElement('div');
        heading.appendChild(makeElement('p', 'picturebooks-section-kicker', '今天读哪一本？'));
        const title = makeElement('h3', '', '故事书架');
        title.id = 'picturebooks-shelf-title';
        heading.appendChild(title);
        contentHead.appendChild(heading);
        const count = makeElement('span', 'picturebooks-result-count');
        count.id = 'picturebooks-result-count';
        contentHead.appendChild(count);
        content.appendChild(contentHead);
        const tools = makeElement('div', 'picturebooks-library-tools');
        const searchLabel = makeElement('label', 'picturebooks-search-label');
        searchLabel.setAttribute('for', 'picturebooks-search');
        searchLabel.appendChild(icon('search'));
        const search = makeElement('input');
        search.id = 'picturebooks-search';
        search.className = 'picturebooks-search';
        search.type = 'search';
        search.placeholder = '搜索书名、主题或关键词';
        search.value = state.search;
        searchLabel.appendChild(search);
        tools.appendChild(searchLabel);
        const status = makeElement('select', 'picturebooks-status');
        status.id = 'picturebooks-status';
        [['all', '全部状态'], ['unread', '未读'], ['reading', '阅读中'], ['completed', '已读'], ['favorite', '我的收藏']].forEach(function (item) {
            const option = makeElement('option', '', item[1]);
            option.value = item[0];
            option.selected = state.status === item[0];
            status.appendChild(option);
        });
        tools.appendChild(status);
        const sort = makeElement('select', 'picturebooks-sort');
        sort.id = 'picturebooks-sort';
        [['recommended', '推荐顺序'], ['newest', '最近加入'], ['title', '按书名'], ['duration', '阅读时长']].forEach(function (item) {
            const option = makeElement('option', '', item[1]);
            option.value = item[0];
            option.selected = state.sort === item[0];
            sort.appendChild(option);
        });
        tools.appendChild(sort);
        content.appendChild(tools);
        const cards = makeElement('div', 'picturebooks-card-waterfall');
        cards.id = 'picturebooks-cards';
        cards.setAttribute('aria-live', 'polite');
        content.appendChild(cards);
        layout.appendChild(content);
        rootEl.appendChild(layout);

        const reader = makeElement('div', 'picturebooks-reader-layer');
        reader.id = 'picturebooks-reader';
        reader.hidden = true;
        reader.setAttribute('aria-hidden', 'true');
        rootEl.appendChild(reader);
    }

    function renderCategories(progress) {
        const list = root.document.getElementById('picturebooks-categories');
        if (!list) return;
        list.textContent = '';
        getCategories().forEach(function (category) {
            const stories = category === '全部' ? state.catalog : state.catalog.filter(story => getShelf(story) === category);
            const item = makeElement('button', `picturebooks-category ${state.category === category ? 'is-active' : ''}`);
            item.type = 'button';
            item.setAttribute('role', 'listitem');
            item.dataset.picturebookCategory = category;
            item.appendChild(makeElement('span', 'picturebooks-category-name', category));
            item.appendChild(makeElement('span', 'picturebooks-category-count', String(stories.length)));
            list.appendChild(item);
        });
        list.querySelectorAll('[data-picturebook-category]').forEach(function (item) {
            item.addEventListener('click', function () {
                state.category = item.dataset.picturebookCategory || '全部';
                renderDirectory();
            });
        });
        void progress;
    }

    function renderCard(story, progress) {
        const item = progressFor(progress, story.id);
        const card = makeElement('article', 'picturebook-card');
        const coverButton = makeElement('button', 'picturebook-card-cover');
        coverButton.type = 'button';
        coverButton.dataset.picturebookId = story.id;
        coverButton.setAttribute('aria-label', `打开《${story.titleZh}》`);
        const image = makeElement('img');
        image.src = resolveAsset(story.cover);
        image.alt = `${story.titleZh}封面`;
        image.loading = 'lazy';
        image.decoding = 'async';
        image.addEventListener('error', function () {
            coverButton.classList.add('is-image-missing');
            image.alt = '封面暂时无法加载';
        }, { once: true });
        coverButton.appendChild(image);
        const badge = makeElement('span', 'picturebook-card-badge', item.completedCount > 0 ? '已读' : '未读');
        coverButton.appendChild(badge);
        card.appendChild(coverButton);

        const body = makeElement('div', 'picturebook-card-body');
        const meta = makeElement('div', 'picturebook-card-meta');
        meta.appendChild(makeElement('span', '', getShelf(story)));
        meta.appendChild(makeElement('span', '', `${story.pages.length} 页`));
        body.appendChild(meta);
        body.appendChild(makeElement('h4', '', story.titleZh));
        body.appendChild(makeElement('p', 'picturebook-card-en', story.titleEn));
        const details = makeElement('div', 'picturebook-card-details');
        [story.ageRange, story.difficulty, `${story.durationMin} 分钟`].forEach(function (value) {
            details.appendChild(makeElement('span', '', value));
        });
        body.appendChild(details);
        const tags = makeElement('div', 'picturebook-card-tags');
        story.tags.slice(0, 3).forEach(tag => tags.appendChild(makeElement('span', '', `#${tag}`)));
        body.appendChild(tags);
        const footer = makeElement('div', 'picturebook-card-footer');
        const progressText = item.completedCount > 0
            ? `读过 ${item.completedCount} 次`
            : (item.currentPage > 0 ? `读到第 ${item.currentPage + 1} 页` : '从第一页开始');
        footer.appendChild(makeElement('span', 'picturebook-card-progress', progressText));
        const favorite = makeElement('button', `picturebook-favorite ${isFavorite(readLibrary(), story.id) ? 'is-active' : ''}`);
        favorite.type = 'button';
        favorite.dataset.picturebookFavorite = story.id;
        favorite.setAttribute('aria-label', isFavorite(readLibrary(), story.id) ? `取消收藏《${story.titleZh}》` : `收藏《${story.titleZh}》`);
        favorite.appendChild(icon('bookmark'));
        footer.appendChild(favorite);
        const action = makeElement('button', 'picturebook-card-action');
        action.type = 'button';
        action.dataset.picturebookId = story.id;
        action.appendChild(makeElement('span', '', item.currentPage > 0 ? '继续阅读' : '打开阅读'));
        action.appendChild(icon('arrow-up-right'));
        footer.appendChild(action);
        body.appendChild(footer);
        card.appendChild(body);
        return card;
    }

    function renderDirectory() {
        const rootEl = getRoot();
        if (!rootEl || !state.loaded) return;
        const progress = readProgress();
        renderCategories(progress);
        const cards = root.document.getElementById('picturebooks-cards');
        const title = root.document.getElementById('picturebooks-shelf-title');
        const count = root.document.getElementById('picturebooks-result-count');
        if (!cards || !title || !count) return;
        const visible = getVisibleStories(progress);
        title.textContent = state.category === '全部' ? '故事书架' : state.category;
        count.textContent = `${visible.length} 本可读`;
        cards.textContent = '';
        if (visible.length) {
            visible.forEach(story => cards.appendChild(renderCard(story, progress)));
        } else {
            const empty = makeElement('div', 'picturebooks-empty');
            empty.appendChild(makeElement('strong', '', '没有找到匹配的绘本'));
            empty.appendChild(makeElement('span', '', '试试换个关键词，或清空筛选条件。'));
            cards.appendChild(empty);
        }

        const completed = state.catalog.filter(story => progressFor(progress, story.id).completedCount > 0).length;
        const total = root.document.getElementById('picturebooks-total-count');
        const completedEl = root.document.getElementById('picturebooks-completed-count');
        if (total) total.textContent = String(state.catalog.length);
        if (completedEl) completedEl.textContent = String(completed);
        cards.querySelectorAll('[data-picturebook-id]').forEach(function (item) {
            item.addEventListener('click', function () { openStory(item.dataset.picturebookId); });
        });
        cards.querySelectorAll('[data-picturebook-favorite]').forEach(function (item) {
            item.addEventListener('click', function (event) {
                event.stopPropagation();
                toggleFavorite(item.dataset.picturebookFavorite);
            });
        });
        const search = root.document.getElementById('picturebooks-search');
        const status = root.document.getElementById('picturebooks-status');
        const sort = root.document.getElementById('picturebooks-sort');
        if (search) {
            search.addEventListener('input', function () {
                state.search = search.value;
                renderDirectory();
                const nextSearch = root.document.getElementById('picturebooks-search');
                if (nextSearch) {
                    nextSearch.focus();
                    nextSearch.setSelectionRange(state.search.length, state.search.length);
                }
            });
        }
        if (status) status.addEventListener('change', function () { state.status = status.value; renderDirectory(); });
        if (sort) sort.addEventListener('change', function () { state.sort = sort.value; renderDirectory(); });
        if (root.lucide && typeof root.lucide.createIcons === 'function') root.lucide.createIcons();
    }

    function getStory(id) {
        return state.catalog.find(story => story.id === id) || null;
    }

    function updateProgress(storyId, changes) {
        const progress = readProgress();
        const next = { ...progress, books: { ...progress.books } };
        next.books[storyId] = { ...defaultBookProgress(), ...progressFor(progress, storyId), ...changes };
        return { ok: writeProgress(next), progress: next };
    }

    function renderReader() {
        const reader = root.document.getElementById('picturebooks-reader');
        const story = getStory(state.activeStoryId);
        if (!reader || !story) return;
        const page = story.pages[state.activePage] || story.pages[0];
        const isLast = state.activePage >= story.pages.length - 1;
        const progress = readProgress();
        const item = progressFor(progress, story.id);
        reader.textContent = '';
        reader.hidden = false;
        reader.setAttribute('aria-hidden', 'false');

        const panel = makeElement('section', 'picturebooks-reader-panel');
        panel.setAttribute('role', 'dialog');
        panel.setAttribute('aria-modal', 'true');
        panel.setAttribute('aria-label', `阅读《${story.titleZh}》`);
        const header = makeElement('header', 'picturebooks-reader-header');
        const headerCopy = makeElement('div');
        headerCopy.appendChild(makeElement('span', 'picturebooks-reader-kicker', '正在阅读'));
        headerCopy.appendChild(makeElement('h3', '', story.titleZh));
        headerCopy.appendChild(makeElement('p', '', story.titleEn));
        header.appendChild(headerCopy);
        const close = button('', 'picturebooks-icon-button', 'close', '退出阅读');
        close.appendChild(icon('x'));
        header.appendChild(close);
        panel.appendChild(header);

        const progressBar = makeElement('div', 'picturebooks-reader-progress');
        const progressFill = makeElement('span');
        progressFill.style.width = `${Math.round(((state.activePage + 1) / story.pages.length) * 100)}%`;
        progressBar.appendChild(progressFill);
        panel.appendChild(progressBar);

        const stage = makeElement('div', 'picturebooks-reader-stage');
        const image = makeElement('img');
        image.src = resolveAsset(page.image);
        image.alt = `${story.titleZh}第 ${page.page} 页`;
        image.className = 'picturebooks-reader-image';
        image.addEventListener('error', function () {
            image.classList.add('is-image-missing');
        }, { once: true });
        stage.appendChild(image);
        const textPanel = makeElement('div', 'picturebooks-reader-copy');
        textPanel.appendChild(makeElement('span', 'picturebooks-reader-page-label', `第 ${page.page} / ${story.pages.length} 页`));
        if (page.zh) textPanel.appendChild(makeElement('p', 'picturebooks-reader-zh', page.zh));
        if (page.en) textPanel.appendChild(makeElement('p', 'picturebooks-reader-en', page.en));
        stage.appendChild(textPanel);
        panel.appendChild(stage);

        const feedback = makeElement('div', 'picturebooks-reader-feedback');
        feedback.id = 'picturebook-reward-feedback';
        feedback.hidden = true;
        panel.appendChild(feedback);

        const footer = makeElement('footer', 'picturebooks-reader-footer');
        const previous = button('', 'picturebooks-reader-nav is-secondary', 'previous', '上一页');
        previous.appendChild(icon('arrow-left'));
        previous.appendChild(makeElement('span', '', '上一页'));
        previous.disabled = state.activePage <= 0;
        const pageState = makeElement('span', 'picturebooks-reader-page-state', item.rewardClaimed ? '已获得首读奖励' : (isLast ? '读完后领取成长礼物' : '继续往后读'));
        const next = button('', 'picturebooks-reader-nav', isLast ? 'finish' : 'next', isLast ? '完成阅读' : '下一页');
        next.appendChild(makeElement('span', '', isLast ? (item.rewardClaimed ? '再次完成' : '完成阅读') : '下一页'));
        next.appendChild(icon(isLast ? 'check' : 'arrow-right'));
        footer.appendChild(previous);
        footer.appendChild(pageState);
        footer.appendChild(next);
        panel.appendChild(footer);
        reader.appendChild(panel);

        reader.querySelectorAll('[data-picturebook-action]').forEach(function (action) {
            action.addEventListener('click', function () { handleReaderAction(action.dataset.picturebookAction); });
        });
        if (root.lucide && typeof root.lucide.createIcons === 'function') root.lucide.createIcons();
    }

    function openStory(id) {
        const story = getStory(id);
        if (!story) return;
        state.activeStoryId = story.id;
        const progress = readProgress();
        const item = progressFor(progress, story.id);
        state.activePage = item.currentPage >= story.pages.length - 1 ? 0 : Math.min(item.currentPage, story.pages.length - 1);
        updateProgress(story.id, { currentPage: state.activePage, lastReadAt: new Date().toISOString() });
        renderReader();
        const reader = root.document.getElementById('picturebooks-reader');
        if (reader) reader.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function closeReader() {
        const reader = root.document.getElementById('picturebooks-reader');
        if (reader) {
            reader.hidden = true;
            reader.setAttribute('aria-hidden', 'true');
            reader.textContent = '';
        }
        state.activeStoryId = '';
        state.activePage = 0;
        renderDirectory();
    }

    function showReaderMessage(message, kind) {
        const feedback = root.document.getElementById('picturebook-reward-feedback');
        if (!feedback) return;
        feedback.hidden = false;
        feedback.className = `picturebooks-reader-feedback is-${kind || 'info'}`;
        feedback.textContent = message;
    }

    function claimCompletion(story) {
        const eventId = `picturebook:${story.id}:complete`;
        const progress = readProgress();
        const current = progressFor(progress, story.id);
        let record = current;
        if (current.completionEventId !== eventId) {
            record = {
                ...current,
                completedCount: current.completedCount + 1,
                lastCompletedAt: new Date().toISOString(),
                completionEventId: eventId,
                rewardClaimed: false,
                currentPage: story.pages.length - 1
            };
            const saved = updateProgress(story.id, record);
            if (!saved.ok) {
                showReaderMessage('阅读完成记录保存失败，暂时没有发放奖励，请重试。', 'error');
                return;
            }
        }

        if (record.rewardClaimed) {
            showReaderMessage('这本绘本的首读奖励已经领取过了，再读一遍也很棒。', 'muted');
            return;
        }

        const service = root.CoreRewardService;
        if (!service || typeof service.claim !== 'function') {
            showReaderMessage('核心奖励服务暂时不可用，阅读已记录，请稍后再次点击完成阅读。', 'error');
            return;
        }
        let result;
        try {
            result = service.claim({
                eventId,
                profileId: getProfileId(),
                source: 'game',
                sourceId: 'picturebooks',
                occurredAt: new Date().toISOString(),
                rewards: [
                    { type: 'growth_points', amount: 8 },
                    { type: 'pet_exp', amount: 4 }
                ]
            });
        } catch (error) {
            console.warn('[Picturebooks] completion reward failed:', error);
            showReaderMessage('奖励发放失败，但阅读已经记录，请稍后重试。', 'error');
            return;
        }
        if (result && (result.accepted || result.duplicate)) {
            updateProgress(story.id, { rewardClaimed: true });
            if (root.CoreRewardFeedback && typeof root.CoreRewardFeedback.show === 'function') {
                root.CoreRewardFeedback.show(result, { container: root.document.getElementById('picturebook-reward-feedback') });
                const feedback = root.document.getElementById('picturebook-reward-feedback');
                if (feedback) feedback.className = 'picturebooks-reader-feedback is-success';
            } else {
                showReaderMessage(result.duplicate ? '首读奖励已经领取过了。' : '完成阅读，获得 +8 成长分和 +4 宠物经验！', 'success');
            }
            renderDirectory();
            return;
        }
        showReaderMessage('阅读已记录，但奖励暂未到账，请稍后再次点击完成阅读。', 'error');
    }

    function handleReaderAction(action) {
        const story = getStory(state.activeStoryId);
        if (!story) return;
        if (action === 'close') {
            closeReader();
            return;
        }
        if (action === 'previous') {
            state.activePage = Math.max(0, state.activePage - 1);
        } else if (action === 'next') {
            state.activePage = Math.min(story.pages.length - 1, state.activePage + 1);
        } else if (action === 'finish') {
            if (state.activePage < story.pages.length - 1) return;
            claimCompletion(story);
            return;
        }
        updateProgress(story.id, { currentPage: state.activePage, lastReadAt: new Date().toISOString() });
        renderReader();
    }

    async function render(rootId) {
        const rootEl = getRoot(rootId);
        if (!rootEl) return false;
        const token = ++state.renderToken;
        if (!state.loaded) {
            rootEl.innerHTML = '<div class="picturebooks-loading" aria-live="polite">正在整理故事书架...</div>';
            try {
                state.catalog = await loadCatalog();
                state.loaded = true;
            } catch (error) {
                console.warn('[Picturebooks] catalog load failed:', error);
                if (token === state.renderToken) {
                    rootEl.innerHTML = '<div class="picturebooks-error"><strong>绘本馆暂时没有打开</strong><span>故事目录加载失败，请检查静态资源后重试。</span><button type="button" class="btn-secondary" data-picturebook-retry>重新加载</button></div>';
                    const retry = rootEl.querySelector('[data-picturebook-retry]');
                    if (retry) retry.addEventListener('click', function () { state.loaded = false; void render(rootId); });
                }
                return false;
            }
        }
        if (token !== state.renderToken || !rootEl.closest('.page')?.classList.contains('active')) return false;
        buildShell(rootEl);
        renderDirectory();
        return true;
    }

    function stop() {
        state.renderToken += 1;
        state.activeStoryId = '';
        state.activePage = 0;
    }

    root.Picturebooks = { render, stop, openStory, closeReader, STORAGE_KEY };
}(typeof window !== 'undefined' ? window : globalThis));
