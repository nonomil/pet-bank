(function () {
    'use strict';

    const PUBLIC_CONFIG_PATH = 'js/cloud-config.public.js';
    const LOCAL_CONFIG_PATH = 'cloud-config.local.js';

    window.__PETBANK_CLOUD_CONFIG__ = window.__PETBANK_CLOUD_CONFIG__ || {};
    window.__PETBANK_CLOUD_CONFIG_SOURCE__ = window.__PETBANK_CLOUD_CONFIG_SOURCE__ || '';
    window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ || '';

    function applySourceLabelIfNeeded(sourceKey, sourceLabel) {
        const raw = window.__PETBANK_CLOUD_CONFIG__ || {};
        const hasConfig = Boolean(raw.supabaseUrl || raw.url || raw.supabaseAnonKey || raw.anonKey || raw.siteUrl);
        if (!hasConfig) return;
        if (!window.__PETBANK_CLOUD_CONFIG_SOURCE__) {
            window.__PETBANK_CLOUD_CONFIG_SOURCE__ = sourceKey;
        }
        if (!window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__) {
            window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = sourceLabel;
        }
    }

    function shouldTryRootLocalOverride() {
        const locationObject = window.location || {};
        const hostname = String(locationObject.hostname || '').toLowerCase();
        const protocol = String(locationObject.protocol || '').toLowerCase();
        return protocol === 'file:' || hostname === 'localhost' || hostname === '127.0.0.1';
    }

    async function loadOptionalConfig(path, sourceKey, sourceLabel) {
        try {
            const response = await fetch(path, { cache: 'no-store' });
            if (!response.ok) {
                if (response.status === 404) return;
                console.warn('[cloud-config-loader] optional config returned status', response.status, path);
                return;
            }

            const source = await response.text();
            if (!source.trim()) return;

            const evaluator = new Function(`${source}\n//# sourceURL=${path}`);
            evaluator();
            applySourceLabelIfNeeded(sourceKey, sourceLabel);
        } catch (error) {
            console.warn('[cloud-config-loader] failed to load optional config:', path, error);
        }
    }

    window.__PETBANK_OPTIONAL_BOOTSTRAP__ = (async function bootstrapOptionalConfig() {
        await loadOptionalConfig(PUBLIC_CONFIG_PATH, 'public-config', '站点内置云端配置片段');
        if (shouldTryRootLocalOverride()) {
            await loadOptionalConfig(LOCAL_CONFIG_PATH, 'local-file', '站点根目录 cloud-config.local.js');
        }
    })();
})();
