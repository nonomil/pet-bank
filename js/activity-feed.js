(function () {
    'use strict';

    const state = {
        loading: false,
        error: '',
        entries: [],
        lastRefreshedAt: ''
    };

    function getClient() {
        return window.CloudClient && typeof window.CloudClient.getClient === 'function'
            ? window.CloudClient.getClient()
            : null;
    }

    function getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : null;
    }

    async function refresh() {
        const client = getClient();
        const householdState = getHouseholdState();

        state.loading = true;
        state.error = '';

        try {
            if (!client || !householdState || !householdState.primaryHouseholdId) {
                state.entries = [];
                return state;
            }

            const result = await client
                .from('activity_feed')
                .select('id,child_id,event_type,summary,payload_json,created_at')
                .eq('household_id', householdState.primaryHouseholdId)
                .order('created_at', { ascending: false })
                .limit(12);

            if (result.error) throw result.error;
            state.entries = Array.isArray(result.data) ? result.data : [];
            state.lastRefreshedAt = new Date().toISOString();
        } catch (error) {
            state.error = error && error.message ? error.message : '动态流刷新失败';
        } finally {
            state.loading = false;
        }

        return state;
    }

    window.ActivityFeedSystem = {
        refresh,
        getState() {
            return {
                loading: state.loading,
                error: state.error,
                entries: state.entries.slice(),
                lastRefreshedAt: state.lastRefreshedAt
            };
        }
    };
})();
