/**
 * profile-storage-policy.js - runtime boundary for non-profile local state
 *
 * Unknown petbank_* keys stay profile-scoped for backward compatibility. The
 * explicit exclusions below are device, parent, account, or Profile metadata.
 */
(function (global) {
    'use strict';

    const NON_PROFILE_PATTERNS = Object.freeze([
        'petbank_profiles_meta',
        'petbank_active_profile',
        'petbank_profile_data_*',
        'petbank_learning_arcade_settings_v1',
        'petbank_sfx_volume',
        'petbank_sfx_muted',
        'petbank_voice_settings',
        'petbank_parent_admin_tools',
        'petbank_advanced_tools',
        'petbank_family_members',
        'petbank_pomodoro_today',
        'petbank_toolbox_last_tool',
        'petbank_toolbox_history',
        'petbank_self_hosted_access_token',
        'petbank_self_hosted_refresh_token',
        'petbank_self_hosted_api_base_url',
        'petbank_self_hosted_snapshot_outbox_v1'
    ]);

    function matches(key, pattern) {
        return pattern.endsWith('*')
            ? key.startsWith(pattern.slice(0, -1))
            : key === pattern;
    }

    function isNonProfileKey(key) {
        const normalized = String(key || '');
        return NON_PROFILE_PATTERNS.some((pattern) => matches(normalized, pattern));
    }

    function shouldSnapshot(key) {
        return !isNonProfileKey(key);
    }

    global.PetBankProfileStoragePolicy = Object.freeze({
        shouldSnapshot,
        isNonProfileKey,
        getNonProfilePatterns: () => [...NON_PROFILE_PATTERNS]
    });
}(window));
