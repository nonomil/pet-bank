(function () {
    'use strict';

    const SNAPSHOT_PREFIX = 'petbank_profile_data_';
    const PET_STATE_KEY = 'petbank_pet';
    const HOME_STATE_KEY = 'petbank_home_state';
    const HOME_FURNITURE_KEY = 'petbank_home_furniture';

    function safeParse(raw, fallback) {
        if (raw == null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
    }

    function getManager() {
        return window.ProfileManager || null;
    }

    function readCurrentBusinessSnapshot() {
        const manager = getManager();
        const snapshot = {};
        if (!manager || typeof manager._getBusinessKeys !== 'function') return snapshot;

        manager._getBusinessKeys().forEach(function (key) {
            snapshot[key] = localStorage.getItem(key);
        });
        return snapshot;
    }

    function readStoredSnapshot(profileId) {
        return safeParse(localStorage.getItem(SNAPSHOT_PREFIX + profileId), {});
    }

    function readProfileSnapshot(profileId) {
        const manager = getManager();
        const activeId = manager && typeof manager.getActiveId === 'function'
            ? manager.getActiveId()
            : null;

        if (profileId === activeId) {
            return readCurrentBusinessSnapshot();
        }
        return readStoredSnapshot(profileId);
    }

    function resolveSpeciesMeta(petState) {
        if (petState && petState.species_data && petState.species_data.name) {
            return petState.species_data;
        }
        const allSpecies = window.PetSystem && typeof window.PetSystem.getAllSpecies === 'function'
            ? window.PetSystem.getAllSpecies()
            : [];
        return allSpecies.find(function (species) {
            return species.id === (petState ? petState.species : null);
        }) || null;
    }

    function resolveStageName(level) {
        const stages = window.PetSystem && Array.isArray(window.PetSystem.STAGES)
            ? window.PetSystem.STAGES
            : [
                { min_level: 1, name: '蛋' },
                { min_level: 3, name: '幼崽' },
                { min_level: 5, name: '成长期' },
                { min_level: 8, name: '完全体' },
                { min_level: 15, name: '终极体' }
            ];
        let current = stages[0] || { name: '' };
        stages.forEach(function (stage) {
            if ((Number(level) || 1) >= (stage.min_level || 1)) current = stage;
        });
        return current.name || '';
    }

    function buildPetSummaryFromSnapshot(snapshot) {
        const petState = safeParse(snapshot[PET_STATE_KEY], {});
        const speciesMeta = resolveSpeciesMeta(petState);
        return {
            species_id: petState.species || null,
            species_name: speciesMeta ? speciesMeta.name : '',
            species_emoji: speciesMeta ? (speciesMeta.emoji || '🐾') : '🐾',
            image_url: speciesMeta ? (speciesMeta.imageUrl || '') : '',
            level: petState.level || 1,
            stage_name: resolveStageName(petState.level),
            hp: petState.hp != null ? petState.hp : null,
            max_hp: petState.max_hp != null ? petState.max_hp : null,
            hunger: petState.hunger != null ? petState.hunger : null,
            happiness: petState.happiness != null ? petState.happiness : null,
            intimacy: petState.intimacy != null ? petState.intimacy : null,
            cleanliness: petState.cleanliness != null ? petState.cleanliness : null,
            last_home_ts: petState.last_home_ts || null,
            wins: petState.wins || 0,
            explorations: petState.explorations || 0
        };
    }

    function buildHomeSummaryFromSnapshot(snapshot) {
        const homeState = safeParse(snapshot[HOME_STATE_KEY], {});
        const furniture = safeParse(snapshot[HOME_FURNITURE_KEY], []);
        const themeId = homeState.theme || 'cozy_night';
        const themeMeta = window.HomeSystem && typeof window.HomeSystem.getThemeMeta === 'function'
            ? window.HomeSystem.getThemeMeta(themeId)
            : null;
        const slots = homeState && typeof homeState.slots === 'object' && homeState.slots
            ? homeState.slots
            : {};
        return {
            theme_id: themeId,
            theme_name: themeMeta ? themeMeta.name : themeId,
            theme_gradient: themeMeta ? (themeMeta.gradient || '') : '',
            background_image: themeMeta ? (themeMeta.img || '') : '',
            unlocked_theme_count: Array.isArray(homeState.unlockedThemes) ? homeState.unlockedThemes.length : 0,
            occupied_slots: Object.keys(slots).filter(function (slotId) { return Boolean(slots[slotId]); }).length,
            furniture_count: Array.isArray(furniture) ? furniture.length : 0
        };
    }

    const ProfileSync = {
        snapshotPrefix: SNAPSHOT_PREFIX,

        exportLocalProfiles() {
            const manager = getManager();
            const profiles = manager && typeof manager.list === 'function'
                ? manager.list()
                : [];
            const activeId = manager && typeof manager.getActiveId === 'function'
                ? manager.getActiveId()
                : null;

            return profiles.map(function (profile) {
                const snapshot = readProfileSnapshot(profile.id);
                const snapshotKeys = Object.keys(snapshot);
                return {
                    id: profile.id,
                    name: profile.name,
                    emoji: profile.emoji,
                    isActive: profile.id === activeId,
                    snapshotKey: SNAPSHOT_PREFIX + profile.id,
                    snapshotKeys: snapshotKeys,
                    businessKeyCount: snapshotKeys.length
                };
            });
        },

        exportProfileSnapshot(profileId) {
            return readProfileSnapshot(profileId);
        },

        buildCloudChildSummary(profileId) {
            const snapshot = readProfileSnapshot(profileId);
            const petSummaryJson = buildPetSummaryFromSnapshot(snapshot);
            const homeSummaryJson = buildHomeSummaryFromSnapshot(snapshot);
            return {
                snapshotPayload: snapshot,
                petSpeciesId: petSummaryJson.species_id || null,
                petName: petSummaryJson.species_name || null,
                petSummaryJson: petSummaryJson,
                homeSummaryJson: homeSummaryJson
            };
        },

        buildChildDrafts() {
            return this.exportLocalProfiles().map(function (profile) {
                return {
                    localProfileId: profile.id,
                    childName: profile.name,
                    emoji: profile.emoji,
                    sourceSnapshotKey: profile.snapshotKey,
                    sourceBusinessKeyCount: profile.businessKeyCount
                };
            });
        },

        buildCloudImportPayload(householdId) {
            return {
                householdId: householdId || null,
                children: this.exportLocalProfiles().map(function (profile) {
                    return {
                        localProfileId: profile.id,
                        displayName: profile.name,
                        emoji: profile.emoji,
                        sourceSnapshotKey: profile.snapshotKey,
                        petStateSnapshot: readProfileSnapshot(profile.id)
                    };
                })
            };
        }
    };

    window.ProfileSync = ProfileSync;
})();
