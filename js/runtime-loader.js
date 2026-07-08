(function () {
    'use strict';

    const scriptPromises = new Map();
    const stylePromises = new Map();
    const featurePromises = new Map();
    const initFlags = Object.create(null);
    const assetBaseHref = resolveAssetBaseHref();

    const STYLE_BUNDLES = {
        walk: ['css/walk.css'],
        card: ['css/card-collection.css'],
        arena: ['css/arena.css'],
        playground: ['css/playground.css?v=8', 'css/leaderboard.css?v=2', 'css/hanzi-game.css?v=4'],
        learn: ['css/learn-center.css?v=6']
    };

    const SCRIPT_BUNDLES = {
        audio: ['js/zzfx.js', 'js/sfx.js'],
        home: ['js/home.js'],
        walk: ['js/walk.js'],
        cardCollection: ['js/card-collection.js'],
        cardArena: ['js/battle-engine.js', 'js/card-arena.js', 'js/card-arena-ui.js'],
        explore: ['js/voice.js', 'js/battle-engine.js', 'js/exploration.js', 'js/exploration-detail.js'],
        playground: ['js/math-pk.js?v=4', 'js/leaderboard.js', 'js/hanzi-progress.js', 'js/hanzi-game.js', 'js/tools.js'],
        learn: ['js/english-vocab-progress.js?v=1', 'js/learn-center.js?v=6'],
        shop: ['js/shop.js'],
        cloud: [
            'js/vendor/supabase-js.js',
            'js/cloud-config-loader.js',
            'js/cloud-client.js',
            'js/profile-sync.js',
            'js/family-social-scope.js',
            'js/auth.js',
            'js/household.js',
            'js/cloud-sync.js',
            'js/cloud-restore.js',
            'js/social.js',
            'js/pk-service.js',
            'js/activity-feed.js',
            'js/cloud-diagnostics.js',
            'js/family-review.js'
        ],
        admin: [
            'js/vendor/supabase-js.js',
            'js/cloud-config-loader.js',
            'js/cloud-client.js',
            'js/family-social-scope.js',
            'js/auth.js',
            'js/admin-auth.js',
            'js/admin-console.js'
        ]
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
            script.onerror = function () { reject(new Error('[runtime-loader] failed to load script: ' + src)); };
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
            link.onerror = function () { reject(new Error('[runtime-loader] failed to load style: ' + href)); };
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
            await ensurePetCatalog();
            await ensurePetSkills();
            await ensureAudioFeature();
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
            if (!initFlags.toolboxInit && window.ToolboxSystem && typeof window.ToolboxSystem.init === 'function') {
                window.ToolboxSystem.init();
                initFlags.toolboxInit = true;
            }
            window.setTimeout(function () {
                ensureCardArenaFeature().catch(function (error) {
                    console.warn('[runtime-loader] card arena prefetch failed:', error);
                });
            }, 400);
            return true;
        });
    }

    async function ensureLearnFeature() {
        return once('feature-learn', async function () {
            await loadSeries(STYLE_BUNDLES.learn, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.learn, loadScript);
            if (!initFlags.learnInit && window.LearnCenter && typeof window.LearnCenter.init === 'function') {
                await window.LearnCenter.init();
                initFlags.learnInit = true;
            }
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

    async function ensureCloudFeature() {
        return once('feature-cloud', async function () {
            await loadSeries(SCRIPT_BUNDLES.cloud, loadScript);
            if (window.__PETBANK_OPTIONAL_BOOTSTRAP__ && typeof window.__PETBANK_OPTIONAL_BOOTSTRAP__.then === 'function') {
                try {
                    await window.__PETBANK_OPTIONAL_BOOTSTRAP__;
                } catch (error) {}
            }
            if (!initFlags.cloudBooted) {
                if (window.AuthSystem && typeof window.AuthSystem.boot === 'function') {
                    try {
                        await window.AuthSystem.boot();
                    } catch (error) {
                        console.warn('[runtime-loader] auth boot failed:', error);
                    }
                }
                if (window.CloudRestore && typeof window.CloudRestore.hydrateFromCloud === 'function') {
                    try {
                        await window.CloudRestore.hydrateFromCloud();
                    } catch (error) {}
                }
                initFlags.cloudBooted = true;
            }
            if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
                try {
                    await window.HouseholdSystem.refresh('household-root');
                } catch (error) {}
            }
            if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
                try {
                    await window.SocialSystem.refresh();
                } catch (error) {}
            }
            if (window.PKService && typeof window.PKService.refresh === 'function') {
                try {
                    await window.PKService.refresh();
                } catch (error) {}
            }
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                try {
                    await window.ActivityFeedSystem.refresh();
                } catch (error) {}
            }
            return true;
        });
    }

    async function ensureAdminPage() {
        return once('page-admin', async function () {
            await loadSeries(SCRIPT_BUNDLES.admin, loadScript);
            if (window.__PETBANK_OPTIONAL_BOOTSTRAP__ && typeof window.__PETBANK_OPTIONAL_BOOTSTRAP__.then === 'function') {
                try {
                    await window.__PETBANK_OPTIONAL_BOOTSTRAP__;
                } catch (error) {}
            }
            if (window.AuthSystem && typeof window.AuthSystem.boot === 'function') {
                try {
                    await window.AuthSystem.boot();
                } catch (error) {}
            }
            return true;
        });
    }

    async function ensurePage(page) {
        switch (page) {
            case 'map':
            case 'today':
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
                window.setTimeout(function () {
                    ensureCloudFeature()
                        .then(function () {
                            const homePage = document.getElementById('page-home');
                            if (homePage && homePage.classList.contains('active') && window.HomeSystem && typeof window.HomeSystem.renderUI === 'function') {
                                window.HomeSystem.renderUI('home-container');
                            }
                        })
                        .catch(function (error) {
                            console.warn('[runtime-loader] home cloud background load failed:', error);
                        });
                }, 0);
                return true;
            case 'walk':
                await ensureWalkFeature();
                await ensureCloudFeature();
                return true;
            case 'card':
                return ensureCardFeature();
            case 'explore':
                return ensureExploreFeature();
            case 'shop':
                return ensureShopFeature();
            case 'mathpk':
            case 'hanzi':
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
            case 'review':
                await ensureCloudFeature();
                return true;
            case 'settings':
                await ensureCloudFeature();
                return true;
            case 'home-visit':
                return ensureCloudFeature();
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

    window.PetBankRuntime = {
        ensurePage: ensurePage,
        ensureAdminPage: ensureAdminPage,
        ensurePetCatalog: ensurePetCatalog,
        ensureAudioFeature: ensureAudioFeature,
        ensureCloudFeature: ensureCloudFeature,
        ensureCardArenaFeature: ensureCardArenaFeature,
        resolveAssetUrl: resolveAssetUrl,
        prefetch: prefetch,
        _loadScript: loadScript,
        _loadStyle: loadStyle
    };
    window.resolvePetBankAssetUrl = resolveAssetUrl;
    window.openCardArenaEntry = openCardArenaEntry;
})();
