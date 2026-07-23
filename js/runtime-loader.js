(function () {
    'use strict';

    const GAME_REWARD_RECEIPT_KEY = 'petbank_game_reward_receipts_v1';
    function readGameRewardReceipts() {
        try {
            const raw = JSON.parse(localStorage.getItem(GAME_REWARD_RECEIPT_KEY) || '{}');
            return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        } catch (error) {
            return {};
        }
    }
    function getRewardLocalDate(input) {
        const supplied = String(input && input.localDate || '').trim();
        if (window.PetBankTime && typeof window.PetBankTime.isDateKey === 'function'
            && window.PetBankTime.isDateKey(supplied)) return supplied;
        if (window.PetBankTime && typeof window.PetBankTime.localDate === 'function') {
            return window.PetBankTime.localDate();
        }
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    }
    function claimGameRewardReceipt(input = {}) {
        const profileId = String(input.profileId || 'p_default').trim() || 'p_default';
        const source = String(input.source || '').trim();
        const eventId = String(input.eventId || '').trim();
        const points = Math.floor(Number(input.points) || 0);
        if (!source || !eventId || points <= 0) return { accepted: false, reason: 'invalid' };

        // Bridge all game rewards into the core loop. The legacy receipt below
        // remains for compatibility with existing game progress views.
        const key = `${profileId}:${source}:${eventId}`;
        const receipts = readGameRewardReceipts();
        if (receipts[key]) return { accepted: false, reason: 'duplicate', receipt: receipts[key] };

        if (window.CoreRewardService && typeof window.CoreRewardService.claim === 'function') {
            const coreResult = window.CoreRewardService.claim({
                eventId: `${source}:${eventId}`,
                profileId,
                source: 'game',
                sourceId: source,
                rewards: [
                    { type: 'growth_points', amount: points },
                    { type: 'pet_exp', amount: points }
                ]
            });
            if (!coreResult.accepted) {
                return {
                    accepted: false,
                    reason: coreResult.reason || (coreResult.duplicate ? 'duplicate' : 'unavailable'),
                    receipt: coreResult.receipt
                };
            }
            if (window.CoreRewardFeedback && typeof window.CoreRewardFeedback.show === 'function') {
                window.CoreRewardFeedback.show(coreResult);
            }
        } else if (window.PetBankPoints && typeof window.PetBankPoints.add === 'function') {
            window.PetBankPoints.add(points);
        } else {
            console.warn('[GameRewardReceipts] points API unavailable; reward was not applied');
            return { accepted: false, reason: 'unavailable' };
        }
        receipts[key] = {
            profileId,
            source,
            eventId,
            points,
            localDate: getRewardLocalDate(input),
            claimedAt: new Date().toISOString(),
            schemaVersion: 1
        };
        const keys = Object.keys(receipts);
        if (keys.length > 600) keys.slice(0, keys.length - 600).forEach((oldKey) => delete receipts[oldKey]);
        try { localStorage.setItem(GAME_REWARD_RECEIPT_KEY, JSON.stringify(receipts)); } catch (error) {}
        return { accepted: true, receipt: receipts[key] };
    }
    window.GameRewardReceipts = { claim: claimGameRewardReceipt, key: GAME_REWARD_RECEIPT_KEY };

    const scriptPromises = new Map();
    const stylePromises = new Map();
    const featurePromises = new Map();
    const initFlags = Object.create(null);
    const assetBaseHref = resolveAssetBaseHref();

    const STYLE_BUNDLES = {
        childShell: ['css/child-workbench-shell.css?v=20260718-playground-wide'],
        map: ['css/showcase.css'],
        home: ['css/travel-memory.css'],
        walk: ['css/walk.css'],
        card: ['css/travel-memory.css', 'css/card-collection.css'],
        arena: ['css/arena.css'],
        playground: ['css/playground.css?v=category-tabs-20260719', 'css/leaderboard.css?v=2', 'css/hanzi-game.css?v=4'],
        explore: ['css/travel-memory.css', 'css/pixel-story.css?v=20260715-stage-fullscreen1'],
        learn: ['css/learn-center.css?v=7'],
        minecraftVocab: ['css/minecraft-vocab.css?v=2'],
        picturebooks: ['css/picturebook-portal.css']
    };

    const SCRIPT_BUNDLES = {
        audio: ['js/zzfx.js', 'js/sfx.js'],
        childShell: ['js/child-workbench-shell.js?v=20260718-playground-wide'],
        map: ['js/exploration.js', 'js/showcase.js'],
        today: ['js/minecraft-vocab-session.js?v=1'],
        home: ['js/pet-care-daily.js', 'js/core-reward-feedback.js', 'js/pet-growth-history.js', 'js/task-reward-events.js', 'js/pet-evolution-preview.js', 'js/travel-memory.js', 'js/home.js'],
        walk: ['js/walk.js'],
        cardCollection: ['js/travel-memory.js', 'js/card-collection.js'],
        cardArena: ['js/battle-engine.js', 'js/card-arena.js', 'js/card-arena-ui.js'],
        explore: ['js/voice.js', 'js/battle-fx.js', 'js/battle-engine.js', 'js/exploration.js', 'js/pet-story-cases.js', 'js/space-growth-detective.js', 'js/exploration-copy.js', 'js/exploration-chapter.js', 'js/exploration-progress.js', 'js/travel-memory.js', 'js/exploration-detail.js', 'js/pixel-story-page.js', 'js/pixel-story-map.js?v=20260715-stage-fullscreen1', 'js/pixel-story-engine.js?v=20260715-stage-fullscreen1', 'js/minecraft-vocab-exploration-bridge.js?v=1'],
        playground: ['js/math-pk.js?v=4', 'js/leaderboard.js', 'js/hanzi-progress.js', 'js/hanzi-game.js', 'js/tools.js', 'js/playground-catalog.js?v=20260719', 'js/mini-games-external-bridge.js?v=1'],
        learn: ['js/english-vocab-progress.js?v=1', 'js/learn-center.js?v=7', 'js/learning-center-external-bridge.js?v=1'],
        minecraftVocab: ['js/minecraft-vocab-expedition.js?v=2', 'js/minecraft-vocab-levels.js?v=1', 'js/minecraft-vocab-loader.js?v=1', 'js/minecraft-vocab-audio.js?v=1', 'js/minecraft-vocab-session.js?v=1', 'js/minecraft-vocab-page.js?v=2', 'js/minecraft-vocab-exploration-bridge.js?v=1', 'js/word-quest-external-bridge.js?v=1'],
        picturebooks: ['js/picturebook-external-bridge.js'],
        shop: ['js/shop.js'],
        review: ['js/family-review.js']
    };

    function findScript(src) {
        return Array.from(document.scripts).find(function (script) {
            return script.getAttribute('data-petbank-src') === src
                || script.getAttribute('src') === src
                || script.getAttribute('src') === resolveAssetUrl(src);
        }) || null;
    }

    function findStyle(href) {
        return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(function (link) {
            return link.getAttribute('data-petbank-href') === href
                || link.getAttribute('href') === href
                || link.getAttribute('href') === resolveAssetUrl(href);
        }) || null;
    }

    function resolveAssetBaseHref() {
        try {
            const current = document.currentScript;
            if (current && current.src) {
                return new URL('../', current.src).href;
            }
            const script = Array.from(document.scripts).find(function (node) {
                return /(?:^|\/)js\/runtime-loader\.js(?:\?|$)/.test(node.src || '');
            });
            if (script && script.src) {
                return new URL('../', script.src).href;
            }
        } catch (error) {}
        return new URL('./', document.baseURI || window.location.href).href;
    }

    function resolveAssetUrl(path) {
        if (!path) return path;
        if (/^(?:[a-z]+:)?\/\//i.test(path) || /^(?:data|blob):/i.test(path)) return path;
        return new URL(path.replace(/^\/+/, ''), assetBaseHref).href;
    }

    function loadScript(src) {
        if (!src) return Promise.resolve();
        if (scriptPromises.has(src)) return scriptPromises.get(src);

        const existing = findScript(src);
        if (existing) {
            const ready = Promise.resolve(existing);
            scriptPromises.set(src, ready);
            return ready;
        }

        const promise = new Promise(function (resolve, reject) {
            const script = document.createElement('script');
            script.src = resolveAssetUrl(src);
            script.async = false;
            script.fetchPriority = 'high';
            script.dataset.petbankSrc = src;
            script.onload = function () { resolve(script); };
            script.onerror = function () {
                scriptPromises.delete(src);
                if (typeof script.remove === 'function') script.remove();
                reject(new Error('[runtime-loader] failed to load script: ' + src));
            };
            document.body.appendChild(script);
        });

        scriptPromises.set(src, promise);
        return promise;
    }

    function loadStyle(href) {
        if (!href) return Promise.resolve();
        if (stylePromises.has(href)) return stylePromises.get(href);

        const existing = findStyle(href);
        if (existing) {
            const ready = Promise.resolve(existing);
            stylePromises.set(href, ready);
            return ready;
        }

        const promise = new Promise(function (resolve, reject) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = resolveAssetUrl(href);
            link.fetchPriority = 'high';
            link.dataset.petbankHref = href;
            link.onload = function () { resolve(link); };
            link.onerror = function () {
                stylePromises.delete(href);
                if (typeof link.remove === 'function') link.remove();
                reject(new Error('[runtime-loader] failed to load style: ' + href));
            };
            document.head.appendChild(link);
        });

        stylePromises.set(href, promise);
        return promise;
    }

    async function loadSeries(items, loader) {
        for (const item of items || []) {
            await loader(item);
        }
    }

    function once(key, factory) {
        if (featurePromises.has(key)) return featurePromises.get(key);
        const promise = Promise.resolve().then(factory);
        featurePromises.set(key, promise);
        promise.catch(function () {
            if (featurePromises.get(key) === promise) featurePromises.delete(key);
        });
        return promise;
    }

    async function ensurePetCatalog() {
        return once('pet-catalog', async function () {
            if (window.PetSystem && typeof window.PetSystem.loadPetDB === 'function') {
                await window.PetSystem.loadPetDB();
            }
            return true;
        });
    }

    async function ensurePetRuntimeIndex() {
        return once('pet-runtime-index', async function () {
            if (window.PetSystem && typeof window.PetSystem.loadPetRuntimeIndex === 'function') {
                await window.PetSystem.loadPetRuntimeIndex();
            }
            return true;
        });
    }

    async function ensurePetSkills() {
        return once('pet-skills', async function () {
            if (window.PetSystem && typeof window.PetSystem.loadSkills === 'function') {
                try {
                    await window.PetSystem.loadSkills();
                } catch (error) {
                    console.warn('[runtime-loader] skills.json load failed:', error);
                }
            }
            return true;
        });
    }

    async function ensureAudioFeature() {
        return once('feature-audio', async function () {
            await loadSeries(SCRIPT_BUNDLES.audio, loadScript);
            return true;
        });
    }

    async function ensureHomeFeature() {
        return once('feature-home', async function () {
            await ensurePetCatalog();
            await loadSeries(STYLE_BUNDLES.home, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.home, loadScript);
            if (!initFlags.homeInit && window.HomeSystem && typeof window.HomeSystem.init === 'function') {
                window.HomeSystem.init();
                initFlags.homeInit = true;
            }
            if (!initFlags.homeCatalog && window.HomeSystem && typeof window.HomeSystem.loadCatalog === 'function') {
                try {
                    await window.HomeSystem.loadCatalog();
                } catch (error) {}
                initFlags.homeCatalog = true;
            }
            if (window.TravelMemory && typeof window.TravelMemory.load === 'function') {
                await window.TravelMemory.load();
                if (typeof window.TravelMemory.hydrateStoredMemories === 'function') window.TravelMemory.hydrateStoredMemories();
            }
            return true;
        });
    }

    async function ensureMapFeature() {
        return once('feature-map', async function () {
            await Promise.all([
                ensureChildShellFeature(),
                loadSeries(STYLE_BUNDLES.map, loadStyle),
                loadSeries(SCRIPT_BUNDLES.map, loadScript)
            ]);
            if (window.ExplorationSystem && typeof window.ExplorationSystem.loadScenes === 'function') {
                await window.ExplorationSystem.loadScenes();
            }
            if (window.HomeShowcase && typeof window.HomeShowcase.setActive === 'function') {
                window.HomeShowcase.setActive(true);
            }
            return true;
        });
    }

    async function ensureTodayFeature() {
        return once('feature-today', async function () {
            await Promise.all([
                ensureChildShellFeature(),
                loadSeries(SCRIPT_BUNDLES.today, loadScript)
            ]);
            return true;
        });
    }

    async function ensureChildShellFeature() {
        return once('feature-child-shell', async function () {
            await Promise.all([
                loadSeries(STYLE_BUNDLES.childShell, loadStyle),
                loadSeries(SCRIPT_BUNDLES.childShell, loadScript)
            ]);
            return true;
        });
    }

    async function ensureWalkFeature() {
        return once('feature-walk', async function () {
            await ensurePetCatalog();
            await loadSeries(STYLE_BUNDLES.walk, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.walk, loadScript);
            return true;
        });
    }

    async function ensureCardFeature() {
        return once('feature-card', async function () {
            await Promise.all([
                ensurePetCatalog(),
                loadSeries(STYLE_BUNDLES.card, loadStyle),
                loadSeries(SCRIPT_BUNDLES.cardCollection, loadScript)
            ]);
            if (window.TravelMemory && typeof window.TravelMemory.load === 'function') {
                await window.TravelMemory.load();
                if (typeof window.TravelMemory.hydrateStoredMemories === 'function') window.TravelMemory.hydrateStoredMemories();
            }
            if (!initFlags.cardInit && window.CardCollection && typeof window.CardCollection.init === 'function') {
                window.CardCollection.init();
                initFlags.cardInit = true;
            }
            return true;
        });
    }

    async function ensureCardArenaFeature() {
        return once('feature-card-arena', async function () {
            await ensureCardFeature();
            await Promise.all([
                ensureAudioFeature(),
                loadSeries(STYLE_BUNDLES.arena, loadStyle)
            ]);
            await loadSeries(SCRIPT_BUNDLES.cardArena, loadScript);
            return true;
        });
    }

    async function ensureExploreFeature() {
        return once('feature-explore', async function () {
            await ensurePetRuntimeIndex();
            await ensurePetSkills();
            await ensureAudioFeature();
            await loadSeries(STYLE_BUNDLES.explore, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.explore, loadScript);
            if (window.ExplorationSystem && typeof window.ExplorationSystem.loadScenes === 'function') {
                await window.ExplorationSystem.loadScenes();
            }
            return true;
        });
    }

    async function ensurePlaygroundFeature() {
        return once('feature-playground', async function () {
            await Promise.all([
                ensureAudioFeature(),
                loadSeries(STYLE_BUNDLES.playground, loadStyle)
            ]);
            await loadSeries(SCRIPT_BUNDLES.playground, loadScript);
            if (window.MiniGamesExternalBridge && typeof window.MiniGamesExternalBridge.init === 'function') {
                await window.MiniGamesExternalBridge.init();
            }
            if (!initFlags.toolboxInit && window.ToolboxSystem && typeof window.ToolboxSystem.init === 'function') {
                window.ToolboxSystem.init();
                initFlags.toolboxInit = true;
            }
            return true;
        });
    }

    async function ensureLearnFeature() {
        return once('feature-learn', async function () {
            await loadSeries(STYLE_BUNDLES.learn, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.learn, loadScript);
            if (window.LearningCenterExternalBridge && typeof window.LearningCenterExternalBridge.init === 'function') {
                await window.LearningCenterExternalBridge.init();
            }
            if (!initFlags.learnInit && window.LearnCenter && typeof window.LearnCenter.init === 'function') {
                await window.LearnCenter.init();
                initFlags.learnInit = true;
            }
            return true;
        });
    }

    async function ensureMinecraftVocabFeature() {
        return once('feature-minecraft-vocab', async function () {
            await ensureLearnFeature();
            await loadSeries(STYLE_BUNDLES.minecraftVocab, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.minecraftVocab, loadScript);
            return true;
        });
    }

    async function ensurePicturebooksFeature() {
        return once('feature-picturebooks', async function () {
            await loadSeries(STYLE_BUNDLES.picturebooks, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.picturebooks, loadScript);
            return true;
        });
    }

    async function ensureShopFeature() {
        return once('feature-shop', async function () {
            await ensureHomeFeature();
            await loadSeries(SCRIPT_BUNDLES.shop, loadScript);
            return true;
        });
    }

    async function ensureReviewFeature() {
        return once('feature-review', async function () {
            await loadSeries(SCRIPT_BUNDLES.review, loadScript);
            return true;
        });
    }

    async function ensurePage(page) {
        if (['map', 'today', 'learning-sheet', 'learn', 'learn-pack', 'learn-plan', 'learn-lesson', 'learn-print', 'picturebooks', 'pet', 'home', 'explore', 'forest-map', 'playground'].includes(page)) {
            await ensureChildShellFeature();
        }
        switch (page) {
            case 'map':
                return ensureMapFeature();
            case 'today':
                return ensureTodayFeature();
            case 'reward':
            case 'inventory':
            case 'works':
                return true;
            case 'playground':
                return ensurePlaygroundFeature();
            case 'pet':
                return ensurePetCatalog();
            case 'home':
                await ensureHomeFeature();
                return true;
            case 'walk':
                await ensureWalkFeature();
                return true;
            case 'card':
                return ensureCardFeature();
            case 'explore':
                return ensureExploreFeature();
            case 'forest-map':
                return ensureExploreFeature();
            case 'shop':
                return ensureShopFeature();
            case 'mathpk':
            case 'hanzi':
            case 'typing-defense':
            case 'leaderboard':
            case 'tools':
                return ensurePlaygroundFeature();
            case 'learn':
            case 'learn-pack':
            case 'learn-plan':
            case 'learn-lesson':
            case 'learn-print':
            case 'learning-sheet':
                return ensureLearnFeature();
            case 'minecraft-vocab':
                return ensureMinecraftVocabFeature();
            case 'picturebooks':
                return ensurePicturebooksFeature();
            case 'review':
                return ensureReviewFeature();
            case 'settings':
                return ensureLearnFeature();
            default:
                return true;
        }
    }

    function prefetch(page, delayMs) {
        const wait = Number(delayMs || 0);
        window.setTimeout(function () {
            ensurePage(page).catch(function (error) {
                console.warn('[runtime-loader] prefetch failed for page:', page, error);
            });
        }, wait);
    }

    async function openCardArenaEntry() {
        if (typeof window.showToast === 'function') {
            window.showToast('正在加载卡牌对战...');
        }
        try {
            await ensureCardArenaFeature();
            if (typeof window.switchPage === 'function') {
                window.switchPage('playground');
            }
            document.body.classList.add('card-arena-shell-active');
            const shellBar = document.getElementById('playgroundArenaShellBar');
            if (shellBar) shellBar.hidden = false;
            if (window.CardArenaUI && typeof window.CardArenaUI.openStages === 'function') {
                window.CardArenaUI.openStages();
                return true;
            }
            throw new Error('CardArenaUI.openStages is unavailable');
        } catch (error) {
            console.warn('[runtime-loader] card arena entry failed:', error);
            if (typeof window.showToast === 'function') {
                window.showToast('卡牌对战加载失败，请稍后再试');
            }
            return false;
        }
    }

    function closeCardArenaEntry() {
        document.body.classList.remove('card-arena-shell-active');
        const shellBar = document.getElementById('playgroundArenaShellBar');
        if (shellBar) shellBar.hidden = true;
        if (window.CardArenaUI) {
            try {
                if (typeof window.CardArenaUI.closeBattleModal === 'function') window.CardArenaUI.closeBattleModal();
                if (typeof window.CardArenaUI.closeTeamModal === 'function') window.CardArenaUI.closeTeamModal();
                if (typeof window.CardArenaUI.closeStages === 'function') window.CardArenaUI.closeStages();
            } catch (error) {
                console.warn('[runtime-loader] close card arena entry failed:', error);
            }
        }
        if (typeof window.switchPage === 'function') {
            window.switchPage('playground');
        }
    }

    window.PetBankRuntime = {
        ensurePage: ensurePage,
        ensurePetCatalog: ensurePetCatalog,
        ensurePetRuntimeIndex: ensurePetRuntimeIndex,
        ensureAudioFeature: ensureAudioFeature,
        ensureCardArenaFeature: ensureCardArenaFeature,
        resolveAssetUrl: resolveAssetUrl,
        prefetch: prefetch,
        _loadScript: loadScript,
        _loadStyle: loadStyle
    };
    window.resolvePetBankAssetUrl = resolveAssetUrl;
    window.openCardArenaEntry = openCardArenaEntry;
    window.closeCardArenaEntry = closeCardArenaEntry;
})();
