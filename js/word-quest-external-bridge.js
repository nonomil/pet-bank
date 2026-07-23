/* word-quest-external-bridge.js - host bridge for the independent word project */
(function (root) {
    'use strict';

    const CONFIG_PATH = 'data/word-quest/portal.json';
    const LAUNCH_STORAGE_KEY = 'petbank_word_quest_launches_v1';
    const COMPLETION_MESSAGE = 'petbank.bridge.v1.completed';
    const RESULT_MESSAGE = 'petbank.bridge.v1.reward-result';
    const state = { config: null, configPromise: null, origin: '', projectUrl: '', listening: false };

    function asset(path) {
        return typeof root.resolvePetBankAssetUrl === 'function' ? root.resolvePetBankAssetUrl(path) : path;
    }

    function getProfileId() {
        try {
            return String(root.ProfileManager?.getActiveId?.() || 'p_default');
        } catch (error) {
            console.warn('[WordQuestBridge] profile lookup failed:', error);
            return 'p_default';
        }
    }

    function readLaunches() {
        try {
            return JSON.parse(root.sessionStorage.getItem(LAUNCH_STORAGE_KEY) || '{}');
        } catch (error) {
            console.warn('[WordQuestBridge] launch storage read failed:', error);
            return {};
        }
    }

    function writeLaunches(value) {
        try {
            root.sessionStorage.setItem(LAUNCH_STORAGE_KEY, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('[WordQuestBridge] launch storage write failed:', error);
            return false;
        }
    }

    function showMessage(text, kind) {
        const element = root.document?.querySelector('[data-word-quest-external-feedback]');
        if (!element) return;
        element.textContent = text;
        element.dataset.kind = kind || 'info';
    }

    function createLaunchId() {
        if (root.crypto && typeof root.crypto.randomUUID === 'function') return root.crypto.randomUUID();
        return `word-quest-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function sendResult(event, payload) {
        if (event.source && typeof event.source.postMessage === 'function') {
            event.source.postMessage({ type: RESULT_MESSAGE, version: 1, projectId: 'word-quest', ...payload }, event.origin);
        }
    }

    function handleCompletion(event) {
        if (event.origin !== state.origin || !event.data || event.data.type !== COMPLETION_MESSAGE) return;
        const data = event.data;
        if (
            data.version !== 1
            || data.projectId !== 'word-quest'
            || !data.launchId
            || !data.profileRef
            || !data.activityId
            || !data.completionId
        ) return;
        const launches = readLaunches();
        const launch = launches[data.launchId];
        const profileRef = String(launch?.profileRef || '');
        if (
            !launch
            || launch.expiresAt < Date.now()
            || profileRef !== String(data.profileRef)
            || getProfileId() !== profileRef
        ) {
            sendResult(event, { launchId: data.launchId, profileRef: String(data.profileRef), activityId: data.activityId, completionId: data.completionId, status: 'rejected' });
            return;
        }
        if (launch.used) {
            sendResult(event, { launchId: data.launchId, profileRef, activityId: data.activityId, completionId: data.completionId, status: 'duplicate' });
            showMessage('这一组单词的成长奖励已经领取过了。', 'muted');
            return;
        }

        const eventId = `word-quest:${data.activityId}:external:${data.completionId}`;
        let result;
        try {
            result = root.CoreRewardService?.claim?.({
                eventId,
                profileId: profileRef,
                source: 'game',
                sourceId: 'word-quest',
                occurredAt: String(data.occurredAt || new Date().toISOString()),
                rewards: [
                    { type: 'growth_points', amount: Number(state.config?.reward?.growthPoints || 10) },
                    { type: 'pet_exp', amount: Number(state.config?.reward?.petExp || 5) }
                ]
            });
        } catch (error) {
            console.warn('[WordQuestBridge] reward claim failed:', error);
            result = null;
        }
        if (!result || (!result.accepted && !result.duplicate)) {
            sendResult(event, { launchId: data.launchId, profileRef, activityId: data.activityId, completionId: data.completionId, status: 'rejected' });
            showMessage('学习已保存，但成长奖励暂未到账，请稍后重试。', 'error');
            return;
        }
        launches[data.launchId] = { ...launch, used: true, activityId: data.activityId, completionId: data.completionId };
        writeLaunches(launches);
        const status = result.duplicate ? 'duplicate' : 'accepted';
        sendResult(event, { launchId: data.launchId, profileRef, activityId: data.activityId, completionId: data.completionId, status });
        showMessage(status === 'accepted' ? '本组学习完成，获得 +10 成长分和 +5 宠物经验。' : '这一组单词的成长奖励已经领取过了。', status === 'accepted' ? 'success' : 'muted');
    }

    async function loadConfig() {
        if (state.config) return state.config;
        if (state.configPromise) return state.configPromise;
        state.configPromise = fetch(asset(CONFIG_PATH)).then(response => {
            if (!response.ok) throw new Error(`${CONFIG_PATH} request failed: ${response.status}`);
            return response.json();
        }).then(config => {
            state.config = config;
            const useDev = ['127.0.0.1', 'localhost'].includes(root.location.hostname) && config.devProjectUrl;
            state.projectUrl = String(useDev ? config.devProjectUrl : config.projectUrl || '');
            state.origin = state.projectUrl ? new URL(state.projectUrl).origin : '';
            return state.config;
        }).catch(error => {
            state.configPromise = null;
            console.warn('[WordQuestBridge] config load failed:', error);
            state.config = { schemaVersion: 1, projectId: 'word-quest', projectUrl: '', devProjectUrl: '', sessionTtlMs: 7200000, reward: { growthPoints: 10, petExp: 5 } };
            state.projectUrl = '';
            state.origin = '';
            return state.config;
        });
        return state.configPromise;
    }

    function ensureListener() {
        if (state.listening) return;
        root.addEventListener('message', handleCompletion);
        state.listening = true;
    }

    async function init() {
        await loadConfig();
        ensureListener();
        return Boolean(state.projectUrl);
    }

    function canLaunch() {
        return Boolean(state.projectUrl && state.origin);
    }

    function launch() {
        if (!canLaunch()) {
            showMessage('独立单词项目尚未配置可确认的发布地址。', 'muted');
            return false;
        }
        const launchId = createLaunchId();
        const profileRef = getProfileId();
        const launches = readLaunches();
        launches[launchId] = {
            profileRef,
            expiresAt: Date.now() + Number(state.config?.sessionTtlMs || 7200000),
            used: false
        };
        if (!writeLaunches(launches)) {
            showMessage('无法创建单词学习会话，请稍后重试。', 'error');
            return false;
        }
        const url = new URL(state.projectUrl);
        url.hash = `petbankLaunch=${encodeURIComponent(launchId)}&petbankProfile=${encodeURIComponent(profileRef)}`;
        const opened = root.open(url.toString(), '_blank');
        if (!opened) showMessage('浏览器阻止了新标签，请允许弹窗后重试。', 'error');
        return Boolean(opened);
    }

    function stop() {
        if (!state.listening) return;
        root.removeEventListener('message', handleCompletion);
        state.listening = false;
    }

    root.WordQuestExternalBridge = { init, canLaunch, launch, stop };
}(typeof window !== 'undefined' ? window : globalThis));
