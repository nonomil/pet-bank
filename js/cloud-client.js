(function () {
    'use strict';

    const defaultConfig = {
        supabaseUrl: '',
        supabaseAnonKey: '',
        siteUrl: '',
        configSource: 'none',
        configSourceLabel: '未配置'
    };
    const LOCAL_CONFIG_KEY = 'petbank_cloud_config';

    function readPersistedConfig() {
        try {
            const raw = localStorage.getItem(LOCAL_CONFIG_KEY);
            if (!raw) return {};
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch (error) {
            return {};
        }
    }

    function readRuntimeConfig() {
        const raw = window.__PETBANK_CLOUD_CONFIG__ || {};
        const persisted = readPersistedConfig();
        const runtimeSource = String(window.__PETBANK_CLOUD_CONFIG_SOURCE__ || '').trim();
        const runtimeSourceLabel = String(window.__PETBANK_CLOUD_CONFIG_SOURCE_LABEL__ || '').trim();
        const hasRuntimeConfig = Boolean(raw.supabaseUrl || raw.url || raw.supabaseAnonKey || raw.anonKey || raw.siteUrl);
        const hasPersistedConfig = Boolean(persisted.supabaseUrl || persisted.supabaseAnonKey || persisted.siteUrl);
        const hasLegacyWindowConfig = Boolean(window.APP_SUPABASE_URL || window.APP_SUPABASE_ANON_KEY || window.APP_SUPABASE_SITE_URL);
        const runtimeConfigShadowedByPersisted = Boolean(hasPersistedConfig && hasRuntimeConfig);

        let configSource = 'none';
        let configSourceLabel = '未配置';
        if (hasPersistedConfig) {
            configSource = 'persisted-localstorage';
            configSourceLabel = '当前浏览器已保存的云端配置';
        } else if (hasRuntimeConfig) {
            configSource = runtimeSource || 'runtime-object';
            configSourceLabel = runtimeSourceLabel || '运行时注入 window.__PETBANK_CLOUD_CONFIG__';
        } else if (hasLegacyWindowConfig) {
            configSource = 'legacy-window-app-supabase';
            configSourceLabel = '宿主页面 window.APP_SUPABASE_*';
        }

        return {
            supabaseUrl: String(persisted.supabaseUrl || raw.supabaseUrl || raw.url || window.APP_SUPABASE_URL || '').trim(),
            supabaseAnonKey: String(persisted.supabaseAnonKey || raw.supabaseAnonKey || raw.anonKey || window.APP_SUPABASE_ANON_KEY || '').trim(),
            siteUrl: String(persisted.siteUrl || raw.siteUrl || window.APP_SUPABASE_SITE_URL || '').trim(),
            configSource: configSource,
            configSourceLabel: configSourceLabel,
            hasRuntimeConfig: hasRuntimeConfig,
            hasPersistedConfig: hasPersistedConfig,
            runtimeConfigShadowedByPersisted: runtimeConfigShadowedByPersisted
        };
    }

    function hasBrowserClientFactory() {
        return Boolean(
            window.supabase &&
            typeof window.supabase.createClient === 'function'
        );
    }

    function dedupeIds(values) {
        return Array.from(new Set((values || []).filter(Boolean)));
    }

    const CloudClient = {
        _client: null,
        _config: null,

        getConfig() {
            if (!this._config) {
                this._config = Object.assign({}, defaultConfig, readRuntimeConfig());
            }
            return Object.assign({}, this._config);
        },

        refreshConfig() {
            this._config = Object.assign({}, defaultConfig, readRuntimeConfig());
            this._client = null;
            return this.getConfig();
        },

        saveConfig(input) {
            const nextConfig = {
                supabaseUrl: String(input && input.supabaseUrl || '').trim(),
                supabaseAnonKey: String(input && input.supabaseAnonKey || '').trim(),
                siteUrl: String(input && input.siteUrl || '').trim()
            };
            try {
                localStorage.setItem(LOCAL_CONFIG_KEY, JSON.stringify(nextConfig));
            } catch (error) {}
            return this.refreshConfig();
        },

        clearConfig() {
            try {
                localStorage.removeItem(LOCAL_CONFIG_KEY);
            } catch (error) {}
            return this.refreshConfig();
        },

        isEnabled() {
            const config = this.getConfig();
            return Boolean(config.supabaseUrl && config.supabaseAnonKey);
        },

        canCreateClient() {
            return this.isEnabled() && hasBrowserClientFactory();
        },

        getClient() {
            if (this._client) return this._client;
            if (!this.canCreateClient()) return null;

            const config = this.getConfig();
            this._client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
            return this._client;
        },

        async getChildSocialProfiles(childIds) {
            const client = this.getClient();
            const targetIds = dedupeIds(childIds);
            if (!client || !targetIds.length) return [];

            const result = await client.rpc('get_child_social_profiles', {
                target_ids: targetIds
            });
            if (result.error) throw result.error;
            return Array.isArray(result.data) ? result.data : [];
        },

        getStatus() {
            const config = this.getConfig();
            return {
                enabled: this.isEnabled(),
                hasSupabaseScript: hasBrowserClientFactory(),
                hasClient: Boolean(this._client),
                hasPersistedConfig: Boolean(config.hasPersistedConfig),
                hasRuntimeConfig: Boolean(config.hasRuntimeConfig),
                runtimeConfigShadowedByPersisted: Boolean(config.runtimeConfigShadowedByPersisted),
                configSource: config.configSource,
                configSourceLabel: config.configSourceLabel,
                siteUrl: config.siteUrl,
                supabaseUrl: config.supabaseUrl
            };
        }
    };

    window.CloudClient = CloudClient;
})();
