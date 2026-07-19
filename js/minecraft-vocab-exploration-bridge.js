(function (global) {
    'use strict';

    var pendingContext = null;
    var returnContext = null;

    function profileId(value) {
        if (value) return String(value);
        try {
            return String(global.ProfileManager && typeof global.ProfileManager.getActiveId === 'function'
                ? global.ProfileManager.getActiveId() || 'default'
                : 'default');
        } catch (error) {
            return 'default';
        }
    }

    function targetOf(value) {
        return value === 'forest-map' ? 'forest-map' : 'explore';
    }

    function contextOf(regionId, options) {
        var input = options || {};
        return {
            regionId: String(regionId || ''),
            returnTarget: targetOf(input.returnTarget),
            storyNodeId: String(input.storyNodeId || ''),
            preferredTrackId: String(input.preferredTrackId || 'block'),
            requiredAbility: String(input.requiredAbility || ''),
            profileId: profileId(input.profileId),
            openedAt: Date.now()
        };
    }

    function stateFor(profile) {
        if (!global.MinecraftVocabExpedition || typeof global.MinecraftVocabExpedition.readState !== 'function') return {};
        try {
            return global.MinecraftVocabExpedition.readState([], profile) || {};
        } catch (error) {
            console.warn('[MinecraftVocabExplorationBridge] failed to read expedition state', error);
            return {};
        }
    }

    function dispatch(name, detail) {
        if (typeof global.dispatchEvent !== 'function' || typeof global.CustomEvent !== 'function') return;
        global.dispatchEvent(new global.CustomEvent(name, { detail: detail }));
    }

    function canUseAbility(abilityId, profile) {
        var id = String(abilityId || '').trim();
        if (!id) return true;
        var state = stateFor(profileId(profile));
        return Array.isArray(state.abilities) && state.abilities.indexOf(id) !== -1;
    }

    function buildStoryContext(regionId, profile) {
        var id = profileId(profile);
        var state = stateFor(id);
        return {
            regionId: String(regionId || ''),
            profileId: id,
            level: Number(state.level || 1),
            experience: Number(state.experience || 0),
            wordCards: Array.isArray(state.wordCardIds) ? state.wordCardIds.slice() : [],
            abilities: Array.isArray(state.abilities) ? state.abilities.slice() : []
        };
    }

    function openExpedition(regionId, options) {
        var context = contextOf(regionId, options);
        pendingContext = context;
        returnContext = context;
        dispatch('petbank:minecraft-vocab-open', context);
        if (typeof global.switchPage === 'function') global.switchPage('minecraft-vocab');
        return Object.assign({}, context);
    }

    function consumeOpenContext() {
        var context = pendingContext;
        pendingContext = null;
        return context ? Object.assign({}, context) : null;
    }

    function getReturnContext() {
        return returnContext ? Object.assign({}, returnContext) : null;
    }

    function returnToExploration(options) {
        var context = Object.assign({}, returnContext || pendingContext || {}, options || {});
        context.returnTarget = targetOf(context.returnTarget);
        pendingContext = null;
        returnContext = null;
        dispatch('petbank:minecraft-vocab-return', context);
        if (typeof global.switchPage === 'function') global.switchPage(context.returnTarget);
        return context;
    }

    function stop() {
        pendingContext = null;
        returnContext = null;
    }

    global.MinecraftVocabExplorationBridge = {
        canUseAbility: canUseAbility,
        buildStoryContext: buildStoryContext,
        openExpedition: openExpedition,
        consumeOpenContext: consumeOpenContext,
        getReturnContext: getReturnContext,
        returnToExploration: returnToExploration,
        stop: stop
    };
})(typeof window !== 'undefined' ? window : globalThis);
