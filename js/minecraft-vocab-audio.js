(function (global) {
    'use strict';

    let baseUrl = '';
    let manifestPromise = null;
    let indexPromises = new Map();
    let fileMap = new Map();
    let manifest = null;

    function configuredBaseUrl() {
        const config = global.PetBankConfig || global.PETBANK_CONFIG || {};
        return String(config.minecraftAudioBaseUrl
            || global.__PETBANK_MINECRAFT_AUDIO_BASE_URL__
            || global.document?.querySelector?.('meta[name="petbank-minecraft-audio-base"]')?.content
            || '').trim();
    }

    function normalizeBaseUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        try {
            const resolved = global.PetBankRuntime?.resolveAssetUrl ? global.PetBankRuntime.resolveAssetUrl(raw) : raw;
            return new URL(resolved, global.location?.href || undefined).href.replace(/\/+$/, '') + '/';
        } catch (error) {
            console.warn('[MinecraftVocabAudio] invalid audio base URL', error);
            return '';
        }
    }

    function configure(value = configuredBaseUrl()) {
        const nextBaseUrl = normalizeBaseUrl(value);
        if (nextBaseUrl === baseUrl) return baseUrl;
        baseUrl = nextBaseUrl;
        manifestPromise = null;
        indexPromises = new Map();
        fileMap = new Map();
        manifest = null;
        return baseUrl;
    }

    async function prepare(value = configuredBaseUrl()) {
        configure(value);
        if (!baseUrl) return { enabled: false, files: 0 };
        if (!manifestPromise) {
            manifestPromise = fetch(new URL('manifest.json', baseUrl).href, { cache: 'force-cache' })
                .then((response) => {
                    if (!response.ok) throw new Error(`audio manifest request failed: ${response.status}`);
                    return response.json();
                })
                .then((nextManifest) => {
                    if (!nextManifest || nextManifest.id !== 'minecraft-vocab-audio' || nextManifest.indexMode !== 'selection' || !nextManifest.indexes) throw new Error('invalid Minecraft audio manifest');
                    manifest = nextManifest;
                    return { enabled: true, files: 0, indexes: Object.keys(manifest.indexes), releaseId: manifest.releaseId || '' };
                })
                .catch((error) => {
                    manifestPromise = null;
                    manifest = null;
                    fileMap = new Map();
                    console.warn('[MinecraftVocabAudio] CDN manifest unavailable; using local/speech fallback', error);
                    return { enabled: false, files: 0, error };
                });
        }
        return manifestPromise;
    }

    async function loadIndex(indexId) {
        await prepare();
        if (!baseUrl || !manifest?.indexes?.[indexId]) return { enabled: false, files: 0, indexId };
        if (!indexPromises.has(indexId)) {
            const promise = fetch(new URL(manifest.indexes[indexId].path, baseUrl).href, { cache: 'force-cache' })
                .then((response) => {
                    if (!response.ok) throw new Error(`audio index request failed: ${response.status}`);
                    return response.json();
                })
                .then((index) => {
                    if (!index || !Array.isArray(index.files)) throw new Error(`invalid Minecraft audio index: ${indexId}`);
                    for (const entry of index.files) {
                        const source = String(entry?.source || '').trim();
                        const filePath = String(entry?.path || '').trim();
                        if (source && filePath) fileMap.set(source, new URL(filePath, baseUrl).href);
                    }
                    return { enabled: true, files: index.files.length, indexId };
                })
                .catch((error) => {
                    indexPromises.delete(indexId);
                    console.warn(`[MinecraftVocabAudio] audio index unavailable: ${indexId}`, error);
                    return { enabled: false, files: 0, indexId, error };
                });
            indexPromises.set(indexId, promise);
        }
        return indexPromises.get(indexId);
    }

    async function prepareForSelection(levelId = 'kindergarten', bandId = 'minecraft-core') {
        const result = await prepare();
        if (!result.enabled) return result;
        const indexes = ['starter'];
        if (levelId === 'minecraft') indexes.push(bandId || 'minecraft-core');
        if (levelId === 'all') indexes.push('minecraft-core', 'minecraft-basic', 'minecraft-building', 'minecraft-mobs', 'minecraft-world', 'minecraft-advanced');
        const loaded = await Promise.all([...new Set(indexes)].map(loadIndex));
        return { enabled: loaded.some((item) => item.enabled), files: loaded.reduce((sum, item) => sum + item.files, 0), indexes: loaded };
    }

    function getUrl(sourcePath) { return fileMap.get(String(sourcePath || '').trim()) || ''; }

    global.MinecraftVocabAudio = Object.freeze({ configure, prepare, loadIndex, prepareForSelection, getUrl, isConfigured: () => !!baseUrl });
})(typeof window !== 'undefined' ? window : globalThis);
