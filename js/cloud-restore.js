(function () {
    'use strict';

    const state = {
        hydrating: false,
        info: '',
        error: '',
        lastHydratedAt: ''
    };

    function safeParse(raw, fallback) {
        if (raw == null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    function getClient() {
        return window.CloudClient && typeof window.CloudClient.getClient === 'function'
            ? window.CloudClient.getClient()
            : null;
    }

    function getAuthState() {
        return window.AuthSystem && typeof window.AuthSystem.getState === 'function'
            ? window.AuthSystem.getState()
            : null;
    }

    function getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : null;
    }

    function getManager() {
        return window.ProfileManager || null;
    }

    function resolveLocalProfileId(child) {
        if (!child) return '';
        return String(child.local_profile_id || ('cloud_' + child.id) || '').trim();
    }

    function hasMeaningfulSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return false;
        return Object.keys(snapshot).some(function (key) {
            return key && key.indexOf('petbank_') === 0;
        });
    }

    function normalizeCloudSnapshotPayload(payload) {
        if (!payload || typeof payload !== 'object') return {};

        const source = payload.profileSnapshot && typeof payload.profileSnapshot === 'object'
            ? payload.profileSnapshot
            : payload;
        const profileSnapshot = {};
        Object.keys(source).forEach(function (key) {
            if (key && key.indexOf('petbank_') === 0) {
                profileSnapshot[key] = source[key];
            }
        });
        return profileSnapshot;
    }

    function readStoredSnapshot(manager, profileId) {
        if (!manager || typeof manager.getSnapshotKey !== 'function') return {};
        return safeParse(localStorage.getItem(manager.getSnapshotKey(profileId)), {});
    }

    async function fetchLatestSnapshots(client, childIds) {
        if (!childIds.length) return new Map();

        const result = await client
            .from('pet_state_snapshots')
            .select('child_id,payload_json,created_at,source')
            .in('child_id', childIds)
            .order('created_at', { ascending: false });

        if (result.error) throw result.error;

        const latestByChild = new Map();
        (result.data || []).forEach(function (row) {
            if (!row || !row.child_id || latestByChild.has(row.child_id)) return;
            latestByChild.set(row.child_id, row);
        });
        return latestByChild;
    }

    function importCloudProfiles(manager, cloudChildren) {
        return cloudChildren.map(function (child) {
            const localProfileId = resolveLocalProfileId(child);
            if (!localProfileId) return null;

            const profile = manager.upsertImportedProfile({
                id: localProfileId,
                name: child.display_name || '云端孩子',
                emoji: child.emoji || '🧒',
                createdAt: child.created_at ? new Date(child.created_at).getTime() : Date.now()
            });

            return profile ? {
                childId: child.id,
                localProfileId: localProfileId
            } : null;
        }).filter(Boolean);
    }

    async function hydrateFromCloud(options) {
        const config = Object.assign({
            overwriteExisting: false
        }, options || {});

        const client = getClient();
        const authState = getAuthState();
        const householdState = getHouseholdState();
        const manager = getManager();
        const user = authState && authState.user ? authState.user : null;
        const cloudChildren = householdState && Array.isArray(householdState.cloudChildren)
            ? householdState.cloudChildren.filter(function (child) { return Boolean(child && child.id); })
            : [];

        if (!client || !user || !manager || typeof manager.upsertImportedProfile !== 'function' || typeof manager.applySnapshotForProfile !== 'function') {
            return { skipped: true, reason: 'restore_unavailable' };
        }
        if (!cloudChildren.length) {
            return { skipped: true, reason: 'no_cloud_children' };
        }

        state.hydrating = true;
        state.error = '';
        state.info = '';

        try {
            const bindings = importCloudProfiles(manager, cloudChildren);
            const latestSnapshots = await fetchLatestSnapshots(client, bindings.map(function (binding) {
                return binding.childId;
            }));

            let restoredCount = 0;
            let activatedProfileId = '';

            bindings.forEach(function (binding) {
                const row = latestSnapshots.get(binding.childId);
                if (!row) return;

                const cloudSnapshot = normalizeCloudSnapshotPayload(row.payload_json);
                if (!hasMeaningfulSnapshot(cloudSnapshot)) return;

                const liveSnapshot = manager.getProfileSnapshot(binding.localProfileId);
                const storedSnapshot = readStoredSnapshot(manager, binding.localProfileId);
                const hasLocalSnapshot = hasMeaningfulSnapshot(liveSnapshot) || hasMeaningfulSnapshot(storedSnapshot);
                const shouldRestore = config.overwriteExisting || !hasLocalSnapshot;
                const shouldActivate = binding.localProfileId === manager.getActiveId() && !hasMeaningfulSnapshot(liveSnapshot);

                if (shouldRestore) {
                    manager.applySnapshotForProfile(binding.localProfileId, cloudSnapshot, {
                        activate: shouldActivate
                    });
                    restoredCount += 1;
                    if (shouldActivate) activatedProfileId = binding.localProfileId;
                    return;
                }

                if (shouldActivate && hasMeaningfulSnapshot(storedSnapshot)) {
                    manager.applySnapshotForProfile(binding.localProfileId, storedSnapshot, {
                        activate: true
                    });
                    activatedProfileId = binding.localProfileId;
                }
            });

            state.lastHydratedAt = new Date().toISOString();
            state.info = restoredCount
                ? '已从云端恢复 ' + restoredCount + ' 个孩子档案'
                : '已同步云端孩子目录，本地现有档案保持不变';

            return {
                ok: true,
                restoredCount: restoredCount,
                activatedProfileId: activatedProfileId,
                cloudChildCount: bindings.length
            };
        } catch (error) {
            state.error = error && error.message ? error.message : '云端档案恢复失败';
            throw error;
        } finally {
            state.hydrating = false;
        }
    }

    window.CloudRestore = {
        hydrateFromCloud,
        normalizeCloudSnapshotPayload,
        getState() {
            return Object.assign({}, state);
        }
    };
})();
