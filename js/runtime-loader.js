(function () {
    'use strict';

    const scriptPromises = new Map();
    const stylePromises = new Map();
    const featurePromises = new Map();
    const initFlags = Object.create(null);

    const STYLE_BUNDLES = {
        walk: ['css/walk.css'],
        card: ['css/card-collection.css', 'css/arena.css'],
        playground: ['css/playground.css?v=8', 'css/arena.css', 'css/leaderboard.css?v=2', 'css/hanzi-game.css?v=4'],
        learn: ['css/learn-center.css?v=2']
    };

    const SCRIPT_BUNDLES = {
        home: ['js/home.js'],
        walk: ['js/walk.js'],
        card: ['js/battle-engine.js', 'js/card-arena.js', 'js/card-arena-ui.js', 'js/card-collection.js'],
        explore: ['js/battle-engine.js', 'js/exploration.js', 'js/exploration-detail.js'],
        playground: ['js/math-pk.js?v=2', 'js/leaderboard.js', 'js/hanzi-progress.js', 'js/hanzi-game.js', 'js/tools.js'],
        learn: ['js/learn-center.js?v=2'],
        shop: ['js/shop.js'],
        cloud: [
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
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
            'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
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
            return script.getAttribute('data-petbank-src') === src || script.getAttribute('src') === src;
        }) || null;
    }

    function findStyle(href) {
        return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).find(function (link) {
            return link.getAttribute('data-petbank-href') === href || link.getAttribute('href') === href;
        }) || null;
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
            script.src = src;
            script.async = false;
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
            link.href = href;
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
            await ensurePetCatalog();
            await loadSeries(STYLE_BUNDLES.card, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.card, loadScript);
            if (!initFlags.cardInit && window.CardCollection && typeof window.CardCollection.init === 'function') {
                window.CardCollection.init();
                initFlags.cardInit = true;
            }
            return true;
        });
    }

    async function ensureExploreFeature() {
        return once('feature-explore', async function () {
            await ensurePetCatalog();
            await ensurePetSkills();
            await loadSeries(SCRIPT_BUNDLES.explore, loadScript);
            if (window.ExplorationSystem && typeof window.ExplorationSystem.loadScenes === 'function') {
                await window.ExplorationSystem.loadScenes();
            }
            return true;
        });
    }

    async function ensurePlaygroundFeature() {
        return once('feature-playground', async function () {
            await loadSeries(STYLE_BUNDLES.playground, loadStyle);
            await loadSeries(SCRIPT_BUNDLES.playground, loadScript);
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
                await ensureCloudFeature();
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
                await ensureLearnFeature();
                await ensurePlaygroundFeature();
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

    window.PetBankRuntime = {
        ensurePage: ensurePage,
        ensureAdminPage: ensureAdminPage,
        ensurePetCatalog: ensurePetCatalog,
        ensureCloudFeature: ensureCloudFeature,
        prefetch: prefetch,
        _loadScript: loadScript,
        _loadStyle: loadStyle
    };
})();
