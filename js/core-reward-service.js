/**
 * core-reward-service.js - core loop reward policy v1
 *
 * Keeps reward receipt/deduplication separate from individual UI modules.
 * Existing business APIs remain the source of truth for applying values.
 */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'petbank_core_reward_receipts_v1';
    const POLICY_VERSION = 'core-loop-v1';
    const VALID_SOURCES = new Set(['task', 'game', 'chest', 'home', 'shop', 'system']);
    const VALID_TYPES = new Set(['growth_points', 'pet_exp', 'intimacy', 'item', 'furniture', 'theme']);

    function storage() {
        try {
            if (root.localStorage && typeof root.localStorage.getItem === 'function') return root.localStorage;
        } catch (e) {}
        return null;
    }

    function readReceipts() {
        const store = storage();
        if (!store) return {};
        try {
            const raw = store.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch (e) {
            return {};
        }
    }

    function writeReceipts(receipts) {
        const store = storage();
        if (!store) return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(receipts));
            return true;
        } catch (e) {
            return false;
        }
    }

    function normalizeEvent(input) {
        const event = input && typeof input === 'object' ? input : {};
        const eventId = String(event.eventId || '').trim();
        const source = String(event.source || '').trim();
        const profileId = String(event.profileId || 'local').trim() || 'local';
        if (!eventId) throw new Error('reward eventId is required');
        if (!VALID_SOURCES.has(source)) throw new Error('unsupported reward source: ' + source);
        if (!Array.isArray(event.rewards)) throw new Error('reward rewards must be an array');

        const rewards = event.rewards.map((reward) => {
            const item = reward && typeof reward === 'object' ? reward : {};
            const type = String(item.type || '').trim();
            const amount = Math.floor(Number(item.amount));
            if (!VALID_TYPES.has(type)) throw new Error('unsupported reward type: ' + type);
            if (!Number.isFinite(amount) || amount < 0) throw new Error('reward amount must be non-negative');
            return {
                type,
                amount,
                itemId: item.itemId ? String(item.itemId) : undefined
            };
        });

        return {
            eventId,
            profileId,
            source,
            sourceId: event.sourceId ? String(event.sourceId) : '',
            rewards,
            occurredAt: event.occurredAt || new Date().toISOString(),
            policyVersion: event.policyVersion || POLICY_VERSION
        };
    }

    function snapshotPet() {
        try {
            if (root.PetSystem && typeof root.PetSystem.getState === 'function') {
                const state = root.PetSystem.getState();
                return {
                    exp: Number(state.exp || 0),
                    level: Number(state.level || 1),
                    intimacy: Number(state.intimacy || 0),
                    stage: state.stage && state.stage.name ? state.stage.name : ''
                };
            }
        } catch (e) {}
        return null;
    }

    function applyReward(reward) {
        if (reward.amount <= 0) return;
        if (reward.type === 'growth_points' && typeof root.addGrowthPoints === 'function') {
            root.addGrowthPoints(reward.amount);
            return;
        }
        if (reward.type === 'pet_exp' && root.PetSystem && typeof root.PetSystem.addExp === 'function') {
            root.PetSystem.addExp(reward.amount);
            return;
        }
        if (reward.type === 'intimacy' && root.PetSystem && typeof root.PetSystem.addIntimacy === 'function') {
            root.PetSystem.addIntimacy(reward.amount);
            return;
        }
        if (reward.type === 'item' && reward.itemId && root.InventorySystem && typeof root.InventorySystem.addItem === 'function') {
            root.InventorySystem.addItem(reward.itemId, reward.amount);
        }
    }

    function claim(input) {
        const event = normalizeEvent(input);
        const receipts = readReceipts();
        const receiptKey = event.profileId + ':' + event.eventId;
        if (receipts[receiptKey]) {
            return {
                accepted: false,
                duplicate: true,
                event,
                receipt: receipts[receiptKey]
            };
        }

        const before = snapshotPet();
        event.rewards.forEach(applyReward);
        const after = snapshotPet();
        const receipt = {
            eventId: event.eventId,
            profileId: event.profileId,
            source: event.source,
            sourceId: event.sourceId,
            rewards: event.rewards,
            occurredAt: event.occurredAt,
            policyVersion: event.policyVersion,
            claimedAt: new Date().toISOString()
        };
        receipts[receiptKey] = receipt;
        writeReceipts(receipts);

        return {
            accepted: true,
            duplicate: false,
            event,
            receipt,
            petBefore: before,
            petAfter: after,
            petExpApplied: event.rewards
                .filter((reward) => reward.type === 'pet_exp')
                .reduce((sum, reward) => sum + reward.amount, 0),
            leveledUp: !!(after && before && after.level > before.level),
            evolutionChanged: !!(after && before && after.stage && after.stage !== before.stage)
        };
    }

    function getHistory() {
        return Object.values(readReceipts());
    }

    root.CoreRewardService = { claim, getHistory, normalizeEvent, STORAGE_KEY, POLICY_VERSION };
})(typeof window !== 'undefined' ? window : globalThis);
