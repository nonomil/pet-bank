(function () {
    'use strict';

    const state = {
        syncing: false,
        info: '',
        error: '',
        lastSyncedAt: '',
        lastReason: '',
        lastOutcome: 'idle',
        lastOutcomeReason: '',
        lastAttemptedAt: '',
        lastSucceededAt: '',
        lastFailedAt: '',
        lastSkippedAt: '',
        pendingReason: '',
        pendingQueuedAt: '',
        lastKnownChildId: '',
        lastLocalProfileId: '',
        lastPersistedSnapshot: false,
        lastStep: 'idle'
    };

    let syncTimer = null;
    let pendingPayload = null;

    const REASON_LABELS = {
        cloud_runtime: '运行时自动同步',
        manual_sync: '手动同步当前孩子',
        home_visibility: '同步小屋可见性',
        visit_access: '同步串门权限',
        pk_access: '同步 PK 权限',
        home_feed: '喂食后自动同步',
        home_play: '玩耍后自动同步',
        home_bath: '洗澡后自动同步',
        home_rest: '休息后自动同步',
        home_rescue: '救援后自动同步',
        home_place_furniture: '摆放家具后自动同步',
        home_remove_furniture: '收起家具后自动同步',
        home_unlock_theme: '解锁小屋主题后自动同步',
        home_theme_change: '切换小屋主题后自动同步',
        home_exit: '离开小屋时自动同步',
        pet_choose_species: '选择宠物后自动同步',
        pet_feed_page: '宠物喂食页自动同步',
        pet_play_page: '宠物玩耍页自动同步',
        pet_rest_page: '宠物休息页自动同步',
        exploration_start: '开始探索后自动同步',
        exploration_win: '探索胜利后自动同步',
        cloud_unavailable: '云端未就绪，跳过同步',
        child_not_synced: '当前孩子尚未绑定云端档案',
        cloud_sync_failed: '云端同步失败'
    };

    const OUTCOME_LABELS = {
        idle: '待命',
        queued: '排队中',
        syncing: '同步中',
        success: '已成功',
        error: '失败',
        skipped: '已跳过'
    };

    const STEP_LABELS = {
        idle: '待命',
        queued: '等待计时器',
        resolving_child: '定位云端孩子',
        updating_child: '写入孩子摘要',
        writing_snapshot: '写入宠物快照',
        refreshing_views: '刷新家庭与社交视图',
        done: '完成',
        skipped: '已跳过',
        error: '失败'
    };

    function notifyStateChanged() {
        if (window.HouseholdSystem && typeof window.HouseholdSystem.renderSummary === 'function') {
            window.HouseholdSystem.renderSummary('household-root');
        }
        if (window.CloudDiagnostics && typeof window.CloudDiagnostics.render === 'function') {
            window.CloudDiagnostics.render('diagnostics-root');
        }
    }

    function patchState(patch) {
        Object.assign(state, patch || {});
        notifyStateChanged();
    }

    function getReasonLabel(reason) {
        return REASON_LABELS[reason] || reason || '未记录';
    }

    function getOutcomeLabel(outcome) {
        return OUTCOME_LABELS[outcome] || outcome || '未记录';
    }

    function getStepLabel(step) {
        return STEP_LABELS[step] || step || '未记录';
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

    function getActiveLocalProfile() {
        return window.ProfileManager && typeof window.ProfileManager.getActive === 'function'
            ? window.ProfileManager.getActive()
            : null;
    }

    function getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : null;
    }

    function buildPetSummary() {
        if (!window.PetSystem || typeof window.PetSystem.getState !== 'function') return {};
        const pet = window.PetSystem.getState();
        const imageUrl = typeof window.PetSystem.getCurrentStageImage === 'function'
            ? window.PetSystem.getCurrentStageImage()
            : '';
        return {
            species_id: pet.species || null,
            species_name: pet.species_data ? pet.species_data.name : '',
            species_emoji: pet.species_data ? (pet.species_data.emoji || '🐾') : '🐾',
            image_url: imageUrl || '',
            level: pet.level || 1,
            stage_name: pet.stage ? pet.stage.name : '',
            hp: pet.hp != null ? pet.hp : null,
            max_hp: pet.max_hp != null ? pet.max_hp : null,
            hunger: pet.hunger != null ? pet.hunger : null,
            happiness: pet.happiness != null ? pet.happiness : null,
            intimacy: pet.intimacy != null ? pet.intimacy : null,
            cleanliness: pet.cleanliness != null ? pet.cleanliness : null,
            last_home_ts: pet.last_home_ts || null,
            wins: pet.wins || 0,
            explorations: pet.explorations || 0
        };
    }

    function buildHomeSummary() {
        if (!window.HomeSystem || typeof window.HomeSystem.getHomeState !== 'function') return {};
        const homeState = window.HomeSystem.getHomeState() || {};
        const themeMeta = typeof window.HomeSystem.getThemeMeta === 'function'
            ? window.HomeSystem.getThemeMeta(homeState.theme)
            : null;
        const petSummary = buildPetSummary();
        const furniture = typeof window.HomeSystem.getFurniture === 'function'
            ? window.HomeSystem.getFurniture()
            : [];
        const slots = homeState.slots || {};
        return {
            theme_id: homeState.theme || 'cozy_night',
            theme_name: themeMeta ? themeMeta.name : (homeState.theme || 'cozy_night'),
            theme_gradient: themeMeta ? themeMeta.gradient : '',
            background_image: themeMeta ? (themeMeta.img || '') : '',
            unlocked_theme_count: Array.isArray(homeState.unlockedThemes) ? homeState.unlockedThemes.length : 0,
            occupied_slots: Object.keys(slots).filter(function (slotId) { return Boolean(slots[slotId]); }).length,
            furniture_count: Array.isArray(furniture) ? furniture.length : 0,
            last_home_ts: petSummary.last_home_ts || null
        };
    }

    function buildSnapshotPayload(reason) {
        const activeProfile = getActiveLocalProfile();
        const petState = window.PetSystem && typeof window.PetSystem.getState === 'function'
            ? window.PetSystem.getState()
            : {};
        const homeState = window.HomeSystem && typeof window.HomeSystem.getHomeState === 'function'
            ? window.HomeSystem.getHomeState()
            : {};
        const profileSnapshot = window.ProfileSync && typeof window.ProfileSync.exportProfileSnapshot === 'function' && activeProfile
            ? window.ProfileSync.exportProfileSnapshot(activeProfile.id)
            : {};
        return {
            localProfileId: activeProfile ? activeProfile.id : '',
            localProfileName: activeProfile ? activeProfile.name : '',
            reason: reason || 'cloud_runtime',
            syncedAt: new Date().toISOString(),
            petState: petState,
            homeState: homeState,
            profileSnapshot: profileSnapshot
        };
    }

    async function resolveActiveCloudChild(client, options) {
        const activeProfile = getActiveLocalProfile();
        const householdState = getHouseholdState();
        if (options && options.knownChildId) {
            return {
                id: options.knownChildId,
                local_profile_id: activeProfile ? activeProfile.id : ''
            };
        }
        if (householdState && Array.isArray(householdState.cloudChildren) && activeProfile) {
            const existing = householdState.cloudChildren.find(function (child) {
                return child.local_profile_id === activeProfile.id;
            });
            if (existing) return existing;
        }
        if (!activeProfile || !householdState || !householdState.primaryHouseholdId) return null;

        const result = await client
            .from('child_profiles')
            .select('id,local_profile_id,home_visibility,visit_access,pk_access')
            .eq('household_id', householdState.primaryHouseholdId)
            .eq('local_profile_id', activeProfile.id)
            .limit(1)
            .maybeSingle();

        if (result.error) throw result.error;
        return result.data || null;
    }

    async function syncActiveChildState(reason, options) {
        const client = getClient();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;
        const activeProfile = getActiveLocalProfile();
        const householdState = getHouseholdState();
        const syncReason = reason || 'cloud_runtime';
        const attemptedAt = new Date().toISOString();
        const persistSnapshot = !options || options.persistSnapshot !== false;

        if (!client || !user || !activeProfile || !householdState || !householdState.primaryHouseholdId) {
            patchState({
                syncing: false,
                info: '当前云端账号、家庭或本地孩子未就绪，已跳过这次云端同步。',
                error: '',
                lastReason: syncReason,
                lastOutcome: 'skipped',
                lastOutcomeReason: 'cloud_unavailable',
                lastAttemptedAt: attemptedAt,
                lastSkippedAt: attemptedAt,
                pendingReason: '',
                pendingQueuedAt: '',
                lastKnownChildId: '',
                lastLocalProfileId: activeProfile ? activeProfile.id : '',
                lastPersistedSnapshot: persistSnapshot,
                lastStep: 'skipped'
            });
            return { skipped: true, reason: 'cloud_unavailable' };
        }

        patchState({
            syncing: true,
            error: '',
            info: '',
            lastReason: syncReason,
            lastOutcome: 'syncing',
            lastOutcomeReason: '',
            lastAttemptedAt: attemptedAt,
            pendingReason: '',
            pendingQueuedAt: '',
            lastKnownChildId: options && options.knownChildId ? options.knownChildId : '',
            lastLocalProfileId: activeProfile.id,
            lastPersistedSnapshot: persistSnapshot,
            lastStep: 'resolving_child'
        });

        try {
            const cloudChild = await resolveActiveCloudChild(client, options || {});
            if (!cloudChild || !cloudChild.id) {
                patchState({
                    syncing: false,
                    info: '当前孩子还没有绑定到云端 child 档案，这次同步已跳过。',
                    error: '',
                    lastOutcome: 'skipped',
                    lastOutcomeReason: 'child_not_synced',
                    lastSkippedAt: new Date().toISOString(),
                    lastKnownChildId: '',
                    lastStep: 'skipped'
                });
                return { skipped: true, reason: 'child_not_synced' };
            }

            const petSummaryJson = buildPetSummary();
            const homeSummaryJson = buildHomeSummary();
            const snapshotPayload = buildSnapshotPayload(syncReason);
            const lastSyncedAt = new Date().toISOString();
            const updatePayload = {
                pet_summary_json: petSummaryJson,
                home_summary_json: homeSummaryJson,
                last_synced_at: lastSyncedAt
            };
            if (options && options.homeVisibility) {
                updatePayload.home_visibility = options.homeVisibility;
            }
            if (options && options.visitAccess) {
                updatePayload.visit_access = options.visitAccess;
            }
            if (options && options.pkAccess) {
                updatePayload.pk_access = options.pkAccess;
            }

            patchState({
                lastKnownChildId: cloudChild.id,
                lastStep: 'updating_child'
            });

            const childResult = await client
                .from('child_profiles')
                .update(updatePayload)
                .eq('id', cloudChild.id)
                .select('id,home_visibility,visit_access,pk_access,last_synced_at')
                .single();

            if (childResult.error) throw childResult.error;

            if (persistSnapshot) {
                patchState({
                    lastStep: 'writing_snapshot'
                });

                const snapshotResult = await client
                    .from('pet_state_snapshots')
                    .insert({
                        child_id: cloudChild.id,
                        pet_species_id: petSummaryJson.species_id || null,
                        pet_name: petSummaryJson.species_name || null,
                        payload_json: snapshotPayload,
                        source: 'cloud_runtime',
                        created_by_account_id: user.id
                    });
                if (snapshotResult.error) throw snapshotResult.error;
            }

            patchState({
                lastSyncedAt: lastSyncedAt,
                lastSucceededAt: lastSyncedAt,
                info: '已同步当前孩子的小屋与宠物摘要',
                syncing: false,
                lastOutcome: 'success',
                lastOutcomeReason: '',
                lastStep: !options || options.refreshViews !== false ? 'refreshing_views' : 'done'
            });

            if (!options || options.refreshViews !== false) {
                if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
                    void window.HouseholdSystem.refresh('household-root');
                }
                if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
                    void window.SocialSystem.refresh();
                }
            }

            patchState({
                lastStep: 'done'
            });

            return {
                ok: true,
                childId: cloudChild.id,
                pet_summary_json: petSummaryJson,
                home_summary_json: homeSummaryJson,
                homeVisibility: childResult.data.home_visibility,
                visitAccess: childResult.data.visit_access,
                pkAccess: childResult.data.pk_access
            };
        } catch (error) {
            patchState({
                error: error && error.message ? error.message : '云端状态同步失败',
                syncing: false,
                lastOutcome: 'error',
                lastOutcomeReason: 'cloud_sync_failed',
                lastFailedAt: new Date().toISOString(),
                lastStep: 'error'
            });
            throw error;
        }
    }

    function scheduleSync(reason, options) {
        pendingPayload = {
            reason: reason || 'cloud_runtime',
            options: Object.assign({ persistSnapshot: false }, options || {})
        };
        if (syncTimer) clearTimeout(syncTimer);

        patchState({
            pendingReason: pendingPayload.reason,
            pendingQueuedAt: new Date().toISOString(),
            lastOutcome: 'queued',
            lastOutcomeReason: pendingPayload.reason,
            info: '',
            error: '',
            lastStep: 'queued'
        });

        syncTimer = setTimeout(function () {
            const payload = pendingPayload;
            pendingPayload = null;
            syncTimer = null;
            if (!payload) return;
            syncActiveChildState(payload.reason, payload.options).catch(function () {});
        }, 700);
    }

    function setHomeVisibility(visibility) {
        return syncActiveChildState('home_visibility', {
            homeVisibility: visibility === 'private' ? 'private' : 'friends',
            persistSnapshot: false
        });
    }

    function setVisitAccess(visibility) {
        return syncActiveChildState('visit_access', {
            visitAccess: visibility === 'private' ? 'private' : 'friends',
            persistSnapshot: false
        });
    }

    function setPKAccess(visibility) {
        return syncActiveChildState('pk_access', {
            pkAccess: visibility === 'private' ? 'private' : 'friends',
            persistSnapshot: false
        });
    }

    function reportSyncStatus(patch) {
        patchState(patch);
    }

    window.CloudSync = {
        syncActiveChildState,
        scheduleSync,
        setHomeVisibility,
        setVisitAccess,
        setPKAccess,
        reportSyncStatus,
        getState() {
            return Object.assign({}, state);
        },
        getReasonLabel,
        getOutcomeLabel,
        getStepLabel
    };
})();
