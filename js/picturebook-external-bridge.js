/* picturebook-external-bridge.js - portal and reward host for the independent library */
(function (root) {
    'use strict';

    const CONFIG_PATH = 'data/picturebooks/portal.json';
    const CATALOG_PATH = 'data/picturebooks/portal-catalog.json';
    const LAUNCH_STORAGE_KEY = 'petbank_picturebook_launches_v1';
    const COMPLETION_MESSAGE = 'petbank.picturebook.completed';
    const RESULT_MESSAGE = 'petbank.picturebook.reward-result';
    const state = { config: null, catalog: null, origin: '', libraryUrl: '', listening: false, renderToken: 0 };

    function asset(path) {
        return typeof root.resolvePetBankAssetUrl === 'function' ? root.resolvePetBankAssetUrl(path) : path;
    }

    function makeElement(tag, className, text) {
        const element = root.document.createElement(tag);
        if (className) element.className = className;
        if (text) element.textContent = text;
        return element;
    }

    function button(text, className) {
        const element = makeElement('button', className, text);
        element.type = 'button';
        return element;
    }

    function getRoot(id) {
        return root.document && root.document.getElementById(id || 'picturebooks-root');
    }

    function createLaunchId() {
        if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
        return `pb-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function readLaunches() {
        try {
            return JSON.parse(root.sessionStorage.getItem(LAUNCH_STORAGE_KEY) || '{}');
        } catch (error) {
            console.warn('[PicturebookBridge] launch storage read failed:', error);
            return {};
        }
    }

    function writeLaunches(value) {
        try {
            root.sessionStorage.setItem(LAUNCH_STORAGE_KEY, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('[PicturebookBridge] launch storage write failed:', error);
            return false;
        }
    }

    function getProfileId() {
        try {
            return String(root.ProfileManager?.getActiveId?.() || 'p_default');
        } catch (error) {
            console.warn('[PicturebookBridge] profile lookup failed:', error);
            return 'p_default';
        }
    }

    function showMessage(text, kind) {
        const element = root.document.getElementById('picturebooks-portal-feedback');
        if (!element) return;
        element.textContent = text;
        element.className = `picturebooks-portal-feedback is-${kind || 'info'}`;
    }

    function sendResult(event, payload) {
        if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({ type: RESULT_MESSAGE, version: 1, ...payload }, event.origin);
        }
    }

    function handleCompletion(event) {
        if (event.origin !== state.origin || !event.data || event.data.type !== COMPLETION_MESSAGE) return;
        const data = event.data;
        if (data.version !== 1 || !data.launchId || !data.bookId || !data.completionId) return;
        const launches = readLaunches();
        const launch = launches[data.launchId];
        const launchProfileRef = String(launch?.profileRef || '');
        const messageProfileRef = String(data.profileRef || '');
        if (
            !launch
            || launch.bookId !== data.bookId
            || launch.expiresAt < Date.now()
            || !launchProfileRef
            || launchProfileRef !== messageProfileRef
            || getProfileId() !== launchProfileRef
        ) {
            sendResult(event, { launchId: data.launchId, bookId: data.bookId, completionId: data.completionId, profileRef: messageProfileRef, status: 'rejected' });
            return;
        }
        if (launch.used) {
            sendResult(event, { launchId: data.launchId, bookId: data.bookId, completionId: data.completionId, profileRef: launchProfileRef, status: 'duplicate' });
            showMessage('这本绘本的首读奖励已经领取过了。', 'muted');
            return;
        }

        const eventId = `picturebook:${data.bookId}:external:${data.completionId}`;
        let result;
        try {
            result = root.CoreRewardService?.claim?.({
                eventId,
                profileId: launchProfileRef,
                source: 'game',
                sourceId: 'picturebook-library',
                occurredAt: String(data.occurredAt || new Date().toISOString()),
                rewards: [
                    { type: 'growth_points', amount: 8 },
                    { type: 'pet_exp', amount: 4 }
                ]
            });
        } catch (error) {
            console.warn('[PicturebookBridge] reward claim failed:', error);
            result = null;
        }
        if (!result || (!result.accepted && !result.duplicate)) {
            sendResult(event, { launchId: data.launchId, bookId: data.bookId, completionId: data.completionId, profileRef: launchProfileRef, status: 'rejected' });
            showMessage('阅读已记录，但奖励暂未到账，请稍后重试。', 'error');
            return;
        }
        launches[data.launchId] = { ...launch, used: true, completionId: data.completionId };
        writeLaunches(launches);
        const status = result.duplicate ? 'duplicate' : 'accepted';
        sendResult(event, { launchId: data.launchId, bookId: data.bookId, completionId: data.completionId, profileRef: launchProfileRef, status });
        showMessage(status === 'accepted' ? '阅读完成，获得 +8 成长分和 +4 宠物经验。' : '这本绘本的首读奖励已经领取过了。', status === 'accepted' ? 'success' : 'muted');
    }

    function ensureListener() {
        if (state.listening) return;
        root.addEventListener('message', handleCompletion);
        state.listening = true;
    }

    async function loadJson(path) {
        const response = await root.fetch(asset(path));
        if (!response.ok) throw new Error(`${path} request failed: ${response.status}`);
        return response.json();
    }

    async function loadData() {
        if (state.config && state.catalog) return;
        state.config = await loadJson(CONFIG_PATH);
        state.catalog = await loadJson(CATALOG_PATH);
        const useDev = ['127.0.0.1', 'localhost'].includes(root.location.hostname) && state.config.devLibraryUrl;
        state.libraryUrl = String(useDev ? state.config.devLibraryUrl : state.config.libraryUrl);
        state.origin = new URL(state.libraryUrl).origin;
    }

    function launch(storyId) {
        const launchId = createLaunchId();
        const profileRef = getProfileId();
        const launches = readLaunches();
        launches[launchId] = { bookId: storyId, profileRef, expiresAt: Date.now() + Number(state.config.sessionTtlMs || 7200000), used: false };
        if (!writeLaunches(launches)) {
            showMessage('无法创建阅读会话，请稍后重试。', 'error');
            return;
        }
        const url = new URL(state.libraryUrl);
        url.hash = `petbankLaunch=${encodeURIComponent(launchId)}&petbankProfile=${encodeURIComponent(profileRef)}`;
        const opened = root.open(url.toString(), '_blank');
        if (!opened) showMessage('浏览器阻止了新标签，请点击页面中的独立绘本站链接。', 'error');
    }

    function renderCards(rootEl) {
        const grid = rootEl.querySelector('#picturebooks-portal-cards');
        const feedback = rootEl.querySelector('#picturebooks-portal-feedback');
        if (!grid) return;
        feedback.id = 'picturebooks-portal-feedback';
        grid.replaceChildren(...(state.catalog.stories || []).map(function (story) {
            const card = makeElement('article', 'picturebooks-portal-card');
            const cover = button('', 'picturebooks-portal-cover');
            const image = makeElement('img', '', '');
            image.src = asset(story.cover);
            image.alt = `${story.titleZh} 封面`;
            image.loading = 'lazy';
            cover.appendChild(image);
            cover.addEventListener('click', function () { launch(story.id); });
            const content = makeElement('div', 'picturebooks-portal-card-content');
            content.appendChild(makeElement('span', 'picturebooks-portal-shelf', story.shelf));
            content.appendChild(makeElement('h3', '', story.titleZh));
            const tags = makeElement('div', 'picturebooks-portal-tags');
            (story.tags || []).forEach(tag => tags.appendChild(makeElement('span', '', `#${tag}`)));
            content.appendChild(tags);
            const action = button('打开独立绘本站', 'picturebooks-portal-action');
            action.addEventListener('click', function () { launch(story.id); });
            content.appendChild(action);
            card.append(cover, content);
            return card;
        }));
    }

    async function render(rootId) {
        const rootEl = getRoot(rootId);
        if (!rootEl) return false;
        const token = ++state.renderToken;
        rootEl.innerHTML = '<div class="picturebooks-loading">正在连接独立绘本馆...</div>';
        try {
            await loadData();
            if (token !== state.renderToken) return false;
            ensureListener();
            rootEl.innerHTML = '<section class="picturebooks-portal"><div class="picturebooks-portal-heading"><span>独立绘本图书馆</span><h2>把故事读进成长旅程</h2><p>绘本内容在独立图书馆维护，读完并从这里进入的故事，可领取成长奖励。</p></div><div id="picturebooks-portal-feedback" class="picturebooks-portal-feedback" aria-live="polite"></div><div id="picturebooks-portal-cards" class="picturebooks-portal-cards"></div></section>';
            renderCards(rootEl);
            return true;
        } catch (error) {
            console.warn('[PicturebookBridge] portal load failed:', error);
            rootEl.innerHTML = '<div class="picturebooks-error"><strong>独立绘本馆暂时没有打开</strong><span>请检查绘本项目网址或稍后重试。</span></div>';
            return false;
        }
    }

    function stop() {
        state.renderToken += 1;
    }

    root.Picturebooks = { render, stop, launch };
}(typeof window !== 'undefined' ? window : globalThis));
