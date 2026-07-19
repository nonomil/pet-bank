/**
 * page-router.js - route definitions and path-only navigation helpers
 * DOM updates and page activation remain in app.js.
 */
(function (global) {
    'use strict';

    const HOME_TAB_MAP = {
        '首页': 'map',
        '积分': 'today',
        '学习': 'learn',
        '宠物': 'pet',
        '探索': 'explore',
        '绘本': 'picturebooks',
        '游乐场': 'playground',
        '家长区': 'parent'
    };

    const PAGE_TO_TAB = {
        map: 'map',
        today: 'today',
        'learning-sheet': 'today',
        review: 'today',
        reward: 'today',
        shop: 'today',
        inventory: 'today',
        learn: 'learn',
        'learn-pack': 'learn',
        'learn-plan': 'learn',
        'learn-lesson': 'learn',
        'learn-print': 'learn',
        'minecraft-vocab': 'minecraft-vocab',
        playground: 'playground',
        mathpk: 'playground',
        hanzi: 'playground',
        'typing-defense': 'playground',
        'learning-arcade': 'playground',
        'word-memory-map': 'playground',
        leaderboard: 'playground',
        pet: 'pet',
        home: 'pet',
        card: 'pet',
        walk: 'pet',
        explore: 'explore',
        'forest-map': 'explore',
        picturebooks: 'picturebooks',
        parent: 'parent',
        works: 'parent',
        tools: 'parent',
        settings: 'parent'
    };

    const CLASSIC_APP_PAGES = new Set([
        'map', 'today', 'learning-sheet', 'review', 'reward', 'shop', 'inventory',
        'learn', 'learn-pack', 'learn-plan', 'learn-lesson', 'learn-print',
        'minecraft-vocab',
        'pet', 'home', 'explore', 'forest-map', 'picturebooks', 'playground'
    ]);

    const APP_SHELL_PAGES = new Set([
        'walk', 'card', 'mathpk', 'hanzi', 'typing-defense', 'learning-arcade',
        'word-memory-map', 'leaderboard'
    ]);

    const PARENT_SHELL_PAGES = new Set(['parent', 'works', 'tools', 'settings']);

    const PUBLIC_ACCESS_PAGES = new Set([
        'parent', 'picturebooks', 'playground', 'mathpk', 'hanzi', 'typing-defense',
        'learning-arcade', 'word-memory-map', 'leaderboard', 'minecraft-vocab'
    ]);

    const SETTINGS_SECTION_ROUTES = {
        home: '/settings',
        account: '/settings/account',
        family: '/settings/family',
        learning: '/settings/learning',
        rules: '/settings/rules',
        advanced: '/settings/advanced'
    };

    const PAGE_ROUTE_MAP = {
        map: '/app',
        today: '/app/today',
        'learning-sheet': '/app/today/learning-sheet',
        review: '/app/today/review',
        reward: '/app/today/reward',
        shop: '/app/today/shop',
        inventory: '/app/today/inventory',
        learn: '/app/learn',
        'learn-pack': '/app/learn/pack',
        'learn-plan': '/app/learn/plan',
        'learn-lesson': '/app/learn/lesson',
        'learn-print': '/app/learn/print',
        'minecraft-vocab': '/app/learn/minecraft-vocab',
        picturebooks: '/app/picturebooks',
        pet: '/app/pet',
        home: '/app/pet/home',
        walk: '/app/pet/walk',
        card: '/app/pet/cards',
        explore: '/app/explore',
        'forest-map': '/app/explore/forest',
        playground: '/app/playground',
        mathpk: '/app/playground/math-pk',
        hanzi: '/app/playground/hanzi',
        'typing-defense': '/app/playground/typing-defense',
        'learning-arcade': '/app/playground/learning-arcade',
        'word-memory-map': '/app/playground/word-memory-map',
        leaderboard: '/app/playground/leaderboard',
        parent: '/parent',
        works: '/parent/works',
        tools: '/parent/tools',
        settings: '/settings'
    };

    const ROUTE_TO_PAGE = {
        '/': { page: 'map' },
        '/app': { page: 'map' },
        '/app/today': { page: 'today' },
        '/app/today/learning-sheet': { page: 'learning-sheet' },
        '/app/today/review': { page: 'review' },
        '/app/today/reward': { page: 'reward' },
        '/app/today/shop': { page: 'shop' },
        '/app/today/inventory': { page: 'inventory' },
        '/app/learn': { page: 'learn' },
        '/app/learn/pack': { page: 'learn-pack' },
        '/app/learn/plan': { page: 'learn-plan' },
        '/app/learn/lesson': { page: 'learn-lesson' },
        '/app/learn/print': { page: 'learn-print' },
        '/app/learn/minecraft-vocab': { page: 'minecraft-vocab' },
        '/app/picturebooks': { page: 'picturebooks' },
        '/app/pet': { page: 'pet' },
        '/app/pet/home': { page: 'home' },
        '/app/pet/walk': { page: 'walk' },
        '/app/pet/cards': { page: 'card' },
        '/app/explore': { page: 'explore' },
        '/app/explore/forest': { page: 'forest-map' },
        '/app/playground': { page: 'playground' },
        '/app/playground/math-pk': { page: 'mathpk' },
        '/app/playground/hanzi': { page: 'hanzi' },
        '/app/playground/typing-defense': { page: 'typing-defense' },
        '/app/playground/learning-arcade': { page: 'learning-arcade' },
        '/app/playground/word-memory-map': { page: 'word-memory-map' },
        '/app/playground/leaderboard': { page: 'leaderboard' },
        '/today': { page: 'today' },
        '/today/learning-sheet': { page: 'learning-sheet' },
        '/today/review': { page: 'review' },
        '/today/reward': { page: 'reward' },
        '/today/shop': { page: 'shop' },
        '/today/inventory': { page: 'inventory' },
        '/shop': { page: 'shop' },
        '/learn': { page: 'learn' },
        '/learn/pack': { page: 'learn-pack' },
        '/learn/plan': { page: 'learn-plan' },
        '/learn/lesson': { page: 'learn-lesson' },
        '/learn/print': { page: 'learn-print' },
        '/learn/minecraft-vocab': { page: 'minecraft-vocab' },
        '/picturebooks': { page: 'picturebooks' },
        '/pet': { page: 'pet' },
        '/pet/home': { page: 'home' },
        '/pet/walk': { page: 'walk' },
        '/pet/cards': { page: 'card' },
        '/explore': { page: 'explore' },
        '/explore/forest': { page: 'forest-map' },
        '/playground': { page: 'playground' },
        '/playground/math-pk': { page: 'mathpk' },
        '/playground/hanzi': { page: 'hanzi' },
        '/playground/typing-defense': { page: 'typing-defense' },
        '/playground/learning-arcade': { page: 'learning-arcade' },
        '/playground/word-memory-map': { page: 'word-memory-map' },
        '/playground/leaderboard': { page: 'leaderboard' },
        '/parent': { page: 'parent' },
        '/parent/works': { page: 'works' },
        '/parent/tools': { page: 'tools' },
        '/parent/settings': { page: 'settings', settingsSection: 'family' },
        '/parent/settings/account': { page: 'settings', settingsSection: 'account' },
        '/parent/settings/family': { page: 'settings', settingsSection: 'family' },
        '/parent/settings/learning': { page: 'settings', settingsSection: 'learning' },
        '/parent/settings/rules': { page: 'settings', settingsSection: 'rules' },
        '/parent/settings/advanced': { page: 'settings', settingsSection: 'advanced' },
        '/settings': { page: 'settings', settingsSection: 'family' },
        '/settings/account': { page: 'settings', settingsSection: 'account' },
        '/settings/family': { page: 'settings', settingsSection: 'family' },
        '/settings/learning': { page: 'settings', settingsSection: 'learning' },
        '/settings/rules': { page: 'settings', settingsSection: 'rules' },
        '/settings/advanced': { page: 'settings', settingsSection: 'advanced' }
    };

    function cleanRoutePath(pathname) {
        let path = '/';
        try {
            path = decodeURIComponent(pathname || '/');
        } catch (_) {
            path = pathname || '/';
        }
        return path.replace(/\/index\.html$/i, '/').replace(/\/+$/g, '') || '/';
    }

    function normalizeRoutePath(pathname) {
        const path = cleanRoutePath(pathname);
        if (ROUTE_TO_PAGE[path]) return path;
        const segments = path.split('/').filter(Boolean);
        for (let i = 1; i < segments.length; i += 1) {
            const candidate = '/' + segments.slice(i).join('/');
            if (ROUTE_TO_PAGE[candidate]) return candidate;
        }
        return path;
    }

    function inferRouteBase(pathname) {
        const path = cleanRoutePath(pathname);
        if (ROUTE_TO_PAGE[path]) return '';
        const routePaths = Object.keys(ROUTE_TO_PAGE)
            .filter(routePath => routePath !== '/')
            .sort((a, b) => b.length - a.length);
        for (const routePath of routePaths) {
            if (path === routePath || path.endsWith(routePath)) {
                return path.slice(0, -routePath.length).replace(/\/+$/g, '');
            }
        }
        if (/\/index\.html$/i.test(pathname || '')) {
            return (pathname || '').replace(/\/index\.html$/i, '').replace(/\/+$/g, '');
        }
        if (path !== '/' && !/\.[a-z0-9]+$/i.test(path.split('/').pop() || '')) return path;
        return '';
    }

    function withRouteBase(routePath, pathname) {
        const base = inferRouteBase(pathname || (global.location && global.location.pathname) || '/');
        if (!base) return routePath;
        if (routePath === '/') return base || '/';
        return `${base}${routePath}`;
    }

    function resolveRouteFromLocation(locationLike) {
        const loc = locationLike || global.location;
        const hashPath = loc && loc.hash && loc.hash.startsWith('#/')
            ? loc.hash.slice(1).replace(/\/+$/g, '') || '/'
            : '';
        const routePath = hashPath || normalizeRoutePath(loc ? loc.pathname : '/');
        return Object.assign({}, ROUTE_TO_PAGE[routePath] || { page: 'map' });
    }

    function normalizeSettingsSection(section) {
        if (section === 'account') return 'family';
        return SETTINGS_SECTION_ROUTES[section] ? section : 'family';
    }

    function getPathForPage(page, settingsSection) {
        if (page === 'settings') return SETTINGS_SECTION_ROUTES[normalizeSettingsSection(settingsSection)];
        return PAGE_ROUTE_MAP[page] || PAGE_ROUTE_MAP.map;
    }

    function canUsePathRouting(locationLike) {
        const loc = locationLike || global.location;
        return Boolean(loc && /^https?:$/.test(loc.protocol));
    }

    function getRouteShell(page) {
        if (CLASSIC_APP_PAGES.has(page)) return 'home';
        if (PARENT_SHELL_PAGES.has(page)) return 'parent';
        if (APP_SHELL_PAGES.has(page)) return 'app';
        return 'home';
    }

    function getParentShellNavKey(page) {
        if (page === 'settings') return 'settings';
        if (page === 'works') return 'works';
        if (page === 'tools') return 'tools';
        if (page === 'parent') return 'parent';
        return 'app';
    }

    function getAppShellSurface(page) {
        const tabPage = PAGE_TO_TAB[page] || page;
        if (['mathpk', 'hanzi', 'typing-defense', 'word-memory-map', 'leaderboard'].includes(page)) return 'game';
        if (tabPage === 'explore' || tabPage === 'playground') return 'scene';
        if (tabPage === 'today' || tabPage === 'learn') return 'focus';
        if (tabPage === 'pet') return 'studio';
        return 'home';
    }

    function requiresAccess(page, settingsSection) {
        if (page === 'settings' && ['home', 'family', 'account'].includes(normalizeSettingsSection(settingsSection))) return false;
        return !PUBLIC_ACCESS_PAGES.has(page);
    }

    global.PetBankPageRouter = Object.freeze({
        getHomeTabMap: () => Object.assign({}, HOME_TAB_MAP),
        getPageToTab: page => PAGE_TO_TAB[page] || page,
        cleanRoutePath,
        normalizeRoutePath,
        inferRouteBase,
        withRouteBase,
        resolveRouteFromLocation,
        normalizeSettingsSection,
        getPathForPage,
        canUsePathRouting,
        getRouteShell,
        getParentShellNavKey,
        getAppShellSurface,
        requiresAccess
    });
}(window));
