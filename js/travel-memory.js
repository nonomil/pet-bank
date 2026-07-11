/* Idempotent travel memories shared by exploration completion and the home UI. */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'petbank_travel_memory_v1';
    let scenes = {};

    function read() {
        try {
            const raw = JSON.parse(root.localStorage?.getItem(STORAGE_KEY) || '{}');
            return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
        } catch (error) {
            return {};
        }
    }

    function write(value) {
        try { root.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (error) {}
    }

    function configure(catalog) {
        scenes = catalog && typeof catalog === 'object' && !Array.isArray(catalog) ? catalog : {};
        return scenes;
    }

    async function load() {
        if (Object.keys(scenes).length) return scenes;
        try {
            const url = root.resolvePetBankAssetUrl ? root.resolvePetBankAssetUrl('data/travel-rewards.json') : 'data/travel-rewards.json';
            const response = await root.fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            configure(data.scenes);
        } catch (error) {
            configure({});
        }
        return scenes;
    }

    function getSceneMemory(sceneId) {
        const scene = scenes[String(sceneId || '')];
        if (!scene) return null;
        return {
            sceneId: String(sceneId),
            title: scene.memoryTitle || '旅行纪念物',
            icon: scene.memoryIcon || '📸',
            itemId: scene.itemId || null,
            nextPreview: scene.nextPreview || '下一站正在准备中',
            returnText: scene.returnText || '宠物带着旅行纪念物回家啦！'
        };
    }

    function record(input = {}) {
        const sceneId = String(input.sceneId || '').trim();
        const template = getSceneMemory(sceneId);
        if (!sceneId || !template) return { accepted: false, reason: 'unknown_scene' };
        const memories = read();
        if (memories[sceneId]) return { accepted: false, reason: 'duplicate', memory: memories[sceneId] };
        const memory = {
            ...template,
            completedAt: input.completedAt || new Date().toISOString(),
            schemaVersion: 1
        };
        memories[sceneId] = memory;
        write(memories);
        return { accepted: true, memory };
    }

    function getAll() { return Object.values(read()); }

    root.TravelMemory = { STORAGE_KEY, configure, load, getSceneMemory, record, getAll };
})(typeof window !== 'undefined' ? window : globalThis);
