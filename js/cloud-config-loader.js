(function () {
    'use strict';

    const LOCAL_CONFIG_PATH = 'cloud-config.local.js';

    window.__PETBANK_CLOUD_CONFIG__ = window.__PETBANK_CLOUD_CONFIG__ || {};
    window.__PETBANK_CLOUD_CONFIG_SOURCE__ = window.__PETBANK_CLOUD_CONFIG_SOURCE__ || '';
    window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ || '';

    function applySourceLabelIfNeeded() {
        const raw = window.__PETBANK_CLOUD_CONFIG__ || {};
        const hasConfig = Boolean(raw.supabaseUrl || raw.url || raw.supabaseAnonKey || raw.anonKey || raw.siteUrl);
        if (!hasConfig) return;
        if (!window.__PETBANK_CLOUD_CONFIG_SOURCE__) {
            window.__PETBANK_CLOUD_CONFIG_SOURCE__ = 'local-file';
        }
        if (!window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__) {
            window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ = '站点根目录 cloud-config.local.js';
        }
    }

    async function loadOptionalLocalConfig() {
        try {
            const response = await fetch(LOCAL_CONFIG_PATH, { cache: 'no-store' });
            if (!response.ok) {
                if (response.status === 404) return;
                console.warn('[cloud-config-loader] optional local config returned status', response.status);
                return;
            }

            const source = await response.text();
            if (!source.trim()) return;

            const evaluator = new Function(`${source}\n//# sourceURL=${LOCAL_CONFIG_PATH}`);
            evaluator();
            applySourceLabelIfNeeded();
        } catch (error) {
            console.warn('[cloud-config-loader] failed to load optional local config:', error);
        }
    }

    window.__PETBANK_OPTIONAL_BOOTSTRAP__ = loadOptionalLocalConfig();
})();
