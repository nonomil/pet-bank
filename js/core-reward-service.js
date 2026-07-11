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

    function toPresentation(result) {
        const safe = result && typeof result === 'object' ? result : {};
        const event = safe.event || {};
        const rewards = Array.isArray(event.rewards) ? event.rewards : [];
        const lines = rewards.map((reward) => {
            const amount = Number(reward.amount || 0);
            if (reward.type === 'growth_points') return `成长分 +${amount}`;
            if (reward.type === 'pet_exp') return `宠物经验 +${amount}`;
            if (reward.type === 'intimacy') return `亲密度 +${amount}`;
            if (reward.type === 'item') return `获得道具 ${reward.itemId || '物品'} ×${amount}`;
            if (reward.type === 'furniture') return `获得家具 ×${amount}`;
            if (reward.type === 'theme') return `解锁主题 ×${amount}`;
            return '';
        }).filter(Boolean);
        if (safe.leveledUp) lines.push(`宠物升级到 Lv.${safe.petAfter && safe.petAfter.level ? safe.petAfter.level : ''}`.trim());
        if (safe.evolutionChanged) lines.push(`宠物进化为 ${safe.petAfter && safe.petAfter.stage ? safe.petAfter.stage : '新形态'}`);
        if (safe.duplicate) lines.push('这份奖励已经领取过了');
        const nextAction = safe.nextAction && typeof safe.nextAction === 'object'
            ? { action: String(safe.nextAction.action || ''), label: String(safe.nextAction.label || ''), reason: String(safe.nextAction.reason || '') }
            : null;
        return {
            accepted: safe.accepted === true,
            duplicate: safe.duplicate === true,
            title: safe.duplicate ? '奖励已领取' : (safe.accepted ? '获得新奖励' : '奖励未发放'),
            lines,
            nextAction,
            eventId: String(event.eventId || '')
        };
    }

    root.CoreRewardService = { claim, getHistory, normalizeEvent, toPresentation, STORAGE_KEY, POLICY_VERSION };
})(typeof window !== 'undefined' ? window : globalThis);
