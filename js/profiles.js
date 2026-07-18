/**
 * profiles.js - ProfileManager（多孩子本地切换 · C 方案 swap 实现）
 *
 * 设计核心：业务代码（app/pet/inventory/exploration/walk/card/treasure/home/shop）
 * 继续读写 `petbank_*` 键。ProfileManager 在切换 profile 时，
 * 按 `PetBankProfileStoragePolicy` 排除设备/家长/账号键，再遍历 Profile 业务键，把当前 profile 的数据快照
 * 存到 `petbank_profile_data_{id}`，再加载目标 profile 的快照写回业务键，
 * 最后回到当前应用入口壳重新初始化，各模块重新读 petbank_* 完成切换。
 *
 * 元数据键（全局共享，不随 profile 切换）：
 *   - petbank_profiles_meta   : [{id,name,emoji,createdAt}]
 *   - petbank_active_profile  : 当前 profile id
 *   - petbank_profile_data_{id} : 该 profile 的所有业务键值快照（{key: value}）
 */

(function () {
    'use strict';

    const META_KEY = 'petbank_profiles_meta';
    const ACTIVE_KEY = 'petbank_active_profile';
    const DATA_PREFIX = 'petbank_profile_data_';
    const CLOUD_OUTBOX_KEY = 'petbank_self_hosted_snapshot_outbox_v1';
    const HIGH_PRIORITY_SYNC_DEBOUNCE_MS = 900;
    const SELF_HOSTED_AUTH_KEYS = new Set([
        'petbank_self_hosted_access_token',
        'petbank_self_hosted_refresh_token',
        'petbank_self_hosted_api_base_url'
    ]);
    const FALLBACK_LEARNING_MODES = [
        {
            id: 'template-a',
            badge: '模板 A',
            title: '幼小衔接超轻量版',
            desc: '4 个核心小项，最适合刚开始的暑假学习节奏。',
            meta: '4 项任务 · 总时长 + 卡点 + 睡前一句话',
            recommended: true
        },
        {
            id: 'template-b',
            badge: '模板 B',
            title: '轻量标准版',
            desc: '保留轻量感，再加一个拓展入口和“明天先做什么”。',
            meta: '5 项任务 · 适合节奏稳定后再加一点管理',
            recommended: false
        },
        {
            id: 'template-c',
            badge: '模板 C',
            title: '错题加强版',
            desc: '加入状态、错题整理和复盘字段，更像小学学习单。',
            meta: '5 项任务 · 更完整，但每天填写会更重',
            recommended: false
        }
    ];

    // 全局共享键前缀（不属于任何 profile，切换时不搬动）
    const RESERVED_KEYS = new Set([META_KEY, ACTIVE_KEY, CLOUD_OUTBOX_KEY, ...SELF_HOSTED_AUTH_KEYS]);

    /**
     * 判断一个 localStorage key 是否是 profile 数据快照键（petbank_profile_data_xxx）
     */
    function isProfileDataKey(key) {
        return key && key.startsWith(DATA_PREFIX);
    }

    /**
     * 判断是否为业务键：以 petbank_ 开头，且不是元数据/active/profile_data 快照
     */
    function isBusinessKey(key) {
        if (!key || !key.startsWith('petbank_')) return false;
        if (RESERVED_KEYS.has(key)) return false;
        if (isProfileDataKey(key)) return false;
        return true;
    }

    function shouldSnapshotKey(key) {
        const policy = window.PetBankProfileStoragePolicy;
        return !policy || typeof policy.shouldSnapshot !== 'function' || policy.shouldSnapshot(key);
    }

    function isSnapshotBusinessKey(key) {
        return isBusinessKey(key) && shouldSnapshotKey(key);
    }

    /**
     * 动态遍历 localStorage，返回当前应进入 Profile 快照的业务键。
     * 未知 petbank_* 键默认保留，避免漏登记导致新功能失去隔离。
     */
    function getBusinessKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (isSnapshotBusinessKey(k)) keys.push(k);
        }
        return keys;
    }

    function safeParse(raw, fallback) {
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
    }

    function sanitizeSnapshot(snapshot) {
        if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return {};
        return Object.keys(snapshot).reduce(function (result, key) {
            if (isSnapshotBusinessKey(key)) result[key] = snapshot[key];
            return result;
        }, {});
    }

    function hasSnapshotData(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return false;
        return Object.keys(snapshot).some(function (key) {
            return isSnapshotBusinessKey(key);
        });
    }

    function selfHostedApi() {
        return window.SelfHostedApi && typeof window.SelfHostedApi.listChildren === 'function'
            ? window.SelfHostedApi
            : null;
    }

    function cloudSyncOutbox() {
        const outbox = window.PetBankCloudSyncOutbox;
        return outbox && typeof outbox.upsert === 'function' ? outbox : null;
    }

    function cloudOutboxId(profileId, childId) {
        return `${String(profileId || '').trim()}:${String(childId || '').trim()}`;
    }

    function updateCloudProfileMeta(profileId, revision) {
        const list = safeParse(localStorage.getItem(META_KEY), []);
        const current = list.find(item => item.id === profileId);
        if (!current) return;
        current.cloudRevision = Math.max(Number(current.cloudRevision || 0), Number(revision || 0));
        current.lastCloudSyncAt = Date.now();
        localStorage.setItem(META_KEY, JSON.stringify(list));
    }

    function queueCloudSnapshot(profile, snapshot, revision, error, options) {
        const outbox = cloudSyncOutbox();
        if (!outbox || !profile?.cloudChildId) return false;
        const previous = outbox.get(localStorage, cloudOutboxId(profile.id, profile.cloudChildId));
        const config = options || {};
        return outbox.upsert(localStorage, {
            id: cloudOutboxId(profile.id, profile.cloudChildId),
            profileId: profile.id,
            childId: profile.cloudChildId,
            revision,
            payload: snapshot,
            status: config.status || 'pending',
            attempts: config.attempts ?? Number(previous?.attempts || 0),
            nextAttemptAt: config.nextAttemptAt ?? Date.now(),
            queuedAt: previous?.queuedAt || Date.now(),
            lastError: error ? String(error.message || error) : String(previous?.lastError || ''),
            remoteRevision: config.remoteRevision ?? previous?.remoteRevision
        });
    }

    function cloudProfileId(childId) {
        return `p_cloud_${String(childId || '').replace(/[^a-zA-Z0-9_-]/g, '')}`;
    }

    const ROUTE_PREFIXES = [
        '/learning-sheet',
        '/learn-lesson',
        '/learn-print',
        '/learn-plan',
        '/learn-pack',
        '/leaderboard',
        '/playground',
        '/inventory',
        '/settings',
        '/explore',
        '/review',
        '/reward',
        '/parent',
        '/today',
        '/learn',
        '/mathpk',
        '/hanzi',
        '/works',
        '/tools',
        '/shop',
        '/walk',
        '/home',
        '/card',
        '/pet',
        '/app'
    ];

    function resolveAppShellUrl() {
        const pathname = (window.location && window.location.pathname) || '/';
        for (let i = 0; i < ROUTE_PREFIXES.length; i += 1) {
            const prefix = ROUTE_PREFIXES[i];
            const index = pathname.indexOf(prefix);
            if (index >= 0 && (index === 0 || pathname.charAt(index - 1) === '/')) {
                let base = pathname.slice(0, index) || '/';
                if (base !== '/' && !/\/$/.test(base)) base += '/';
                return new URL(base, window.location.origin).href;
            }
        }
        return new URL('./', document.baseURI || window.location.href).href;
    }

    function reloadAppShell() {
        const shellUrl = resolveAppShellUrl();
        window.location.replace(shellUrl);
    }

    const ProfileManager = {
        // ---------- 元数据读写 ----------
        _readMeta() {
            return safeParse(localStorage.getItem(META_KEY), []);
        },
        _writeMeta(list) {
            localStorage.setItem(META_KEY, JSON.stringify(list));
        },
        getActiveId() {
            return localStorage.getItem(ACTIVE_KEY) || null;
        },
        _setActiveId(id) {
            localStorage.setItem(ACTIVE_KEY, id);
        },

        // ---------- 查询 ----------
        list() {
            return this._readMeta();
        },
        getActive() {
            const id = this.getActiveId();
            if (!id) return null;
            return this._readMeta().find(p => p.id === id) || null;
        },
        get(id) {
            return this._readMeta().find(p => p.id === id) || null;
        },

        // ---------- 首次启动迁移（幂等）----------
        /**
         * 首次启动（无 profiles_meta）→ 创建 p_default profile，
         * 当前数据归 p_default（不搬动业务键，active=p_default，业务键就是 p_default 的数据）。
         * 幂等：已存在 meta 则直接返回。
         * 必须在 app.js init 最开头调用（早于 loadAppState）。
         */
        ensureDefault() {
            const existing = this._readMeta();
            if (existing.length > 0) {
                // meta 已存在，确保 active 有效
                let active = this.getActiveId();
                if (!active || !existing.find(p => p.id === active)) {
                    active = existing[0].id;
                    this._setActiveId(active);
                }
                return active;
            }
            // 首次：创建 p_default，当前业务键原地不动（即归 p_default）
            const now = Date.now();
            const def = { id: 'p_default', name: '默认孩子', emoji: '🧒', createdAt: now };
            this._writeMeta([def]);
            this._setActiveId('p_default');
            return 'p_default';
        },

        // ---------- 增删改 ----------
        create(name, emoji) {
            const id = 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
            const profile = {
                id,
                name: (name || '').trim() || '新孩子',
                emoji: emoji || '🧒',
                createdAt: Date.now()
            };
            const list = this._readMeta();
            list.push(profile);
            this._writeMeta(list);
            return profile;
        },

        rename(id, name) {
            const list = this._readMeta();
            const p = list.find(x => x.id === id);
            if (p) {
                p.name = (name || '').trim() || p.name;
                this._writeMeta(list);
            }
            return p;
        },

        setEmoji(id, emoji) {
            const list = this._readMeta();
            const p = list.find(x => x.id === id);
            if (p) {
                p.emoji = emoji || p.emoji;
                this._writeMeta(list);
            }
            return p;
        },

        linkCloudChild(id, cloudChildId, householdId) {
            const list = this._readMeta();
            const profile = list.find(item => item.id === id);
            if (!profile) return null;
            profile.cloudChildId = String(cloudChildId || '').trim() || undefined;
            profile.cloudHouseholdId = String(householdId || '').trim() || undefined;
            this._writeMeta(list);
            return profile;
        },

        findByCloudChildId(cloudChildId) {
            const target = String(cloudChildId || '').trim();
            return this._readMeta().find(profile => profile.cloudChildId === target) || null;
        },

        ensureCloudProfile(child) {
            if (!child || !child.id) return null;
            const existing = this.findByCloudChildId(child.id)
                || this._readMeta().find(profile => child.localProfileId && profile.id === child.localProfileId);
            const profile = existing || this.upsertImportedProfile({
                id: child.localProfileId || cloudProfileId(child.id),
                name: child.name,
                emoji: '🧒'
            });
            if (!profile) return null;
            return this.linkCloudChild(profile.id, child.id, child.householdId);
        },

        async bootstrapCloudProfiles() {
            const api = selfHostedApi();
            if (!api || !api.isSignedIn()) return [];
            try {
                const payload = await api.listChildren();
                const children = Array.isArray(payload?.children) ? payload.children : [];
                children.forEach(child => this.ensureCloudProfile(child));
                return children;
            } catch (error) {
                return [];
            }
        },

        async hydrateActiveFromCloud() {
            const api = selfHostedApi();
            if (!api || !api.isSignedIn()) return null;
            await this.bootstrapCloudProfiles();
            return this.restoreActiveFromCloud().catch(() => null);
        },

        _writeLiveSnapshot(id) {
            const snapshot = this.getProfileSnapshot(id);
            if (id) localStorage.setItem(DATA_PREFIX + id, JSON.stringify(snapshot));
            return snapshot;
        },

        async flushCloudOutbox() {
            const api = selfHostedApi();
            const outbox = cloudSyncOutbox();
            if (!api || !outbox || !api.isSignedIn()) return { skipped: true, reason: 'not-ready' };
            const results = [];
            for (let entry of outbox.list(localStorage)) {
                if (entry.status !== 'pending' || Number(entry.nextAttemptAt || 0) > Date.now()) continue;
                const profile = this.get(entry.profileId);
                if (!profile || profile.cloudChildId !== entry.childId) continue;
                const knownCloudRevision = Number(profile.cloudRevision || 0);
                if (knownCloudRevision >= Number(entry.revision || 0)) {
                    const snapshot = this._writeLiveSnapshot(profile.id);
                    queueCloudSnapshot(profile, snapshot, knownCloudRevision + 1, null, {
                        attempts: 0,
                        nextAttemptAt: 0,
                        remoteRevision: knownCloudRevision
                    });
                    entry = outbox.get(localStorage, entry.id) || entry;
                }
                try {
                    const payload = await api.pushSnapshot(entry.childId, entry.revision, entry.payload);
                    const saved = payload?.snapshot || {};
                    updateCloudProfileMeta(profile.id, Number(saved.revision || entry.revision));
                    outbox.remove(localStorage, entry.id);
                    results.push({ id: entry.id, status: 'synced', revision: Number(saved.revision || entry.revision) });
                } catch (error) {
                    if (error.code === 'SNAPSHOT_REVISION_CONFLICT') {
                        let remoteRevision = 0;
                        try {
                            const latest = await api.latestSnapshot(entry.childId);
                            remoteRevision = Number(latest?.snapshot?.revision || 0);
                            updateCloudProfileMeta(profile.id, remoteRevision);
                        } catch (_) {}
                        queueCloudSnapshot(profile, entry.payload, entry.revision, error, {
                            status: 'conflict',
                            attempts: Number(entry.attempts || 0) + 1,
                            nextAttemptAt: 0,
                            remoteRevision
                        });
                        results.push({ id: entry.id, status: 'conflict', remoteRevision });
                    } else {
                        const attempts = Number(entry.attempts || 0) + 1;
                        queueCloudSnapshot(profile, entry.payload, entry.revision, error, {
                            attempts,
                            nextAttemptAt: Date.now() + Math.min(300000, 1000 * (2 ** Math.min(attempts, 8)))
                        });
                        results.push({ id: entry.id, status: 'queued', attempts });
                    }
                }
            }
            return results;
        },

        requestHighPrioritySync(reason) {
            const api = selfHostedApi();
            const profile = this.getActive();
            if (!api || !profile?.cloudChildId || !api.isSignedIn()) {
                return { scheduled: false, reason: 'not-linked' };
            }

            if (this._cloudSyncTimer) clearTimeout(this._cloudSyncTimer);
            const syncReason = String(reason || 'state-change');
            this._cloudSyncTimer = setTimeout(() => {
                this._cloudSyncTimer = null;
                return this.syncActiveToCloud().catch((error) => {
                    console.warn(`[ProfileManager] ${syncReason} cloud sync deferred`, error);
                    return { queued: true, reason: error.code || 'sync-error' };
                });
            }, HIGH_PRIORITY_SYNC_DEBOUNCE_MS);

            return {
                scheduled: true,
                reason: syncReason,
                delayMs: HIGH_PRIORITY_SYNC_DEBOUNCE_MS
            };
        },

        async syncActiveToCloud() {
            if (this._cloudSyncTimer) {
                clearTimeout(this._cloudSyncTimer);
                this._cloudSyncTimer = null;
            }
            if (this._cloudSyncPromise) return this._cloudSyncPromise;
            const run = this._syncActiveToCloudOnce();
            this._cloudSyncPromise = run;
            try {
                return await run;
            } finally {
                if (this._cloudSyncPromise === run) this._cloudSyncPromise = null;
            }
        },

        async _syncActiveToCloudOnce() {
            const api = selfHostedApi();
            const profile = this.getActive();
            if (!api || !profile?.cloudChildId || !api.isSignedIn()) {
                return { skipped: true, reason: 'not-linked' };
            }
            const snapshot = this._writeLiveSnapshot(profile.id);
            const outbox = cloudSyncOutbox();
            const outboxId = cloudOutboxId(profile.id, profile.cloudChildId);
            const pending = outbox?.get(localStorage, outboxId);
            if (pending?.status === 'conflict') {
                const conflict = new Error('本地快照与云端版本冲突，需要先处理冲突再同步');
                conflict.code = 'SNAPSHOT_REVISION_CONFLICT';
                conflict.remoteRevision = pending.remoteRevision;
                throw conflict;
            }
            const knownCloudRevision = Number(profile.cloudRevision || 0);
            const pendingRevision = Number(pending?.revision || 0);
            const revision = Math.max(knownCloudRevision + 1, pendingRevision || 0);
            try {
                const payload = await api.pushSnapshot(profile.cloudChildId, revision, snapshot);
                const saved = payload?.snapshot || {};
                updateCloudProfileMeta(profile.id, Number(saved.revision || revision));
                outbox?.remove(localStorage, outboxId);
                return saved;
            } catch (error) {
                if (error.code === 'SNAPSHOT_REVISION_CONFLICT') {
                    let latestRevision = Number(profile.cloudRevision || 0);
                    try {
                        const latest = await api.latestSnapshot(profile.cloudChildId);
                        latestRevision = Number(latest?.snapshot?.revision || 0);
                        updateCloudProfileMeta(profile.id, latestRevision);
                    } catch (latestError) {
                        console.warn('[ProfileManager] 无法读取冲突快照的远端版本', latestError);
                    }
                    queueCloudSnapshot(profile, snapshot, revision, error, {
                        status: 'conflict',
                        attempts: Number(pending?.attempts || 0) + 1,
                        nextAttemptAt: 0,
                        remoteRevision: latestRevision
                    });
                } else {
                    queueCloudSnapshot(profile, snapshot, revision, error, {
                        attempts: Number(pending?.attempts || 0) + 1,
                        nextAttemptAt: Date.now() + Math.min(300000, 1000 * (2 ** Math.min(Number(pending?.attempts || 0) + 1, 8)))
                    });
                    return { queued: true, revision, reason: error.code || 'network-error' };
                }
                throw error;
            }
        },

        async restoreActiveFromCloud() {
            const api = selfHostedApi();
            const profile = this.getActive();
            if (!api || !profile?.cloudChildId || !api.isSignedIn()) {
                return null;
            }
            const payload = await api.latestSnapshot(profile.cloudChildId);
            const snapshot = payload?.snapshot;
            if (!snapshot || !snapshot.payload || typeof snapshot.payload !== 'object') return null;
            this.applySnapshotForProfile(profile.id, snapshot.payload, { activate: true });
            const list = this._readMeta();
            const current = list.find(item => item.id === profile.id);
            if (current) {
                current.cloudRevision = Number(snapshot.revision || 0);
                current.lastCloudSyncAt = Date.now();
                this._writeMeta(list);
            }
            return snapshot;
        },

        async switchToAsync(id) {
            const list = this._readMeta();
            if (!list.find(p => p.id === id)) return { ok: false, reason: 'not_found' };
            if (id === this.getActiveId()) return { ok: false, reason: 'same' };
            try {
                await this.syncActiveToCloud();
            } catch (error) {
                if (typeof window.showToast === 'function') window.showToast(error.message);
                return { ok: false, reason: 'sync_failed', error };
            }
            this._swapTo(id, false);
            await this.restoreActiveFromCloud().catch(() => null);
            reloadAppShell();
            return { ok: true };
        },

        installCloudLifecycle() {
            if (this._cloudLifecycleInstalled) return;
            this._cloudLifecycleInstalled = true;
            const flush = (force) => {
                if (force || document.visibilityState === 'hidden' || !document.visibilityState) {
                    void this.flushCloudOutbox()
                        .then(() => this.syncActiveToCloud())
                        .catch(() => null);
                }
            };
            document.addEventListener('visibilitychange', flush);
            window.addEventListener('pagehide', () => flush(true));
            window.addEventListener('online', () => { void this.flushCloudOutbox().catch(() => null); });
        },

        /**
         * 删除 profile：
         *   - 不允许删除最后一个 profile
         *   - 删除其快照键 petbank_profile_data_{id}
         *   - 若删除的是当前 active，先把业务键清空并加载剩余 profile 的数据
         *   - 返回 {ok, reloaded}，reloaded=true 表示已触发 reload（页面会刷新）
         */
        remove(id) {
            const list = this._readMeta();
            if (!list.find(p => p.id === id)) return { ok: false, reason: 'not_found' };
            if (list.length <= 1) return { ok: false, reason: 'last_one' };

            // 删除快照键
            localStorage.removeItem(DATA_PREFIX + id);

            // 从 meta 移除
            const newList = list.filter(p => p.id !== id);
            this._writeMeta(newList);

            const active = this.getActiveId();
            if (active === id) {
                // 删的是当前：切换到剩余第一个，需 reload
                const target = newList[0].id;
                this._swapTo(target, /*skipSaveCurrent*/ true); // 当前数据作废，不存被删档
                return { ok: true, reloaded: true };
            }
            return { ok: true, reloaded: false };
        },

        // ---------- 切换（核心 swap）----------
        /**
         * 切换到 target profile：
         *   1. 存当前 active 的所有业务键快照到 petbank_profile_data_{currentId}
         *   2. 清空当前所有业务键
         *   3. 加载 target 快照写回业务键
         *   4. 设 active=target
         *   5. 回到应用入口壳重新初始化
         *
         * skipSaveCurrent=true 时跳过步骤 1（用于删除当前档）
         */
        _swapTo(targetId, skipSaveCurrent) {
            const currentId = this.getActiveId();
            // 1. 快照当前业务键
            if (currentId && !skipSaveCurrent) {
                const snapshot = {};
                getBusinessKeys().forEach(k => {
                    snapshot[k] = localStorage.getItem(k);
                });
                localStorage.setItem(DATA_PREFIX + currentId, JSON.stringify(snapshot));
            }
            // 2. 清空当前业务键
            getBusinessKeys().forEach(k => localStorage.removeItem(k));
            // 3. 加载 target 快照
            const raw = localStorage.getItem(DATA_PREFIX + targetId);
            const snapshot = sanitizeSnapshot(safeParse(raw, {}));
            Object.keys(snapshot).forEach(k => {
                if (isSnapshotBusinessKey(k) && snapshot[k] !== null && snapshot[k] !== undefined) {
                    localStorage.setItem(k, snapshot[k]);
                }
            });
            // 4. 设 active
            this._setActiveId(targetId);
        },

        /**
         * 切换 profile（对外）：校验后 swap + 回到应用入口壳
         */
        switchTo(id) {
            const list = this._readMeta();
            if (!list.find(p => p.id === id)) return { ok: false, reason: 'not_found' };
            if (id === this.getActiveId()) return { ok: false, reason: 'same' };
            this._swapTo(id, false);
            // 5. 回到入口页，避免本地静态服务器在深路由 reload 时返回 404
            reloadAppShell();
            return { ok: true };
        },

        /**
         * 重置当前 profile 的所有业务数据（危险操作，需确认）
         * 清空当前业务键 + 移除当前快照 + 回到应用入口壳
         */
        resetCurrent() {
            const id = this.getActiveId();
            if (!id) return { ok: false };
            getBusinessKeys().forEach(k => localStorage.removeItem(k));
            localStorage.removeItem(DATA_PREFIX + id);
            reloadAppShell();
            return { ok: true };
        },

        // ---------- 调试/统计 ----------
        getBusinessKeysCount() {
            return getBusinessKeys().length;
        },
        debugDump() {
            return {
                meta: this._readMeta(),
                active: this.getActiveId(),
                businessKeys: getBusinessKeys(),
                snapshots: this._readMeta().map(p => ({
                    id: p.id,
                    hasSnapshot: localStorage.getItem(DATA_PREFIX + p.id) !== null
                }))
            };
        },

        getSnapshotKey(id) {
            return DATA_PREFIX + id;
        },

        getCloudSyncOutbox() {
            const outbox = cloudSyncOutbox();
            return outbox ? outbox.list(localStorage) : [];
        },

        getCloudConflictExport(profileId) {
            const outbox = cloudSyncOutbox();
            const profile = this.get(profileId || this.getActiveId());
            if (!outbox || !profile?.cloudChildId) return null;
            const entry = outbox.get(localStorage, cloudOutboxId(profile.id, profile.cloudChildId));
            if (!entry || entry.status !== 'conflict') return null;
            return {
                version: 1,
                exportedAt: new Date().toISOString(),
                profileId: profile.id,
                childId: profile.cloudChildId,
                revision: entry.revision,
                remoteRevision: entry.remoteRevision,
                payload: safeParse(JSON.stringify(entry.payload), {})
            };
        },

        async resolveCloudConflict(profileId, choice) {
            const outbox = cloudSyncOutbox();
            const api = selfHostedApi();
            const profile = this.get(profileId || this.getActiveId());
            if (!outbox || !profile?.cloudChildId) {
                const error = new Error('找不到待处理的云端冲突');
                error.code = 'SNAPSHOT_CONFLICT_NOT_FOUND';
                throw error;
            }
            const outboxId = cloudOutboxId(profile.id, profile.cloudChildId);
            const entry = outbox.get(localStorage, outboxId);
            if (!entry || entry.status !== 'conflict') {
                const error = new Error('当前 Profile 没有待处理的云端冲突');
                error.code = 'SNAPSHOT_CONFLICT_NOT_FOUND';
                throw error;
            }
            if (choice === 'export') return { status: 'exported', export: this.getCloudConflictExport(profile.id) };
            if (!api || !api.isSignedIn()) {
                const error = new Error('请先登录家长账号后再处理云端冲突');
                error.code = 'SELF_HOSTED_AUTH_REQUIRED';
                throw error;
            }

            const latest = await api.latestSnapshot(profile.cloudChildId);
            const remote = latest?.snapshot;
            const remoteRevision = Number(remote?.revision || entry.remoteRevision || 0);
            if (!remote || !remote.payload || typeof remote.payload !== 'object' || !Number.isSafeInteger(remoteRevision) || remoteRevision < 1) {
                const error = new Error('云端没有可恢复的最新快照');
                error.code = 'SNAPSHOT_REMOTE_MISSING';
                throw error;
            }

            if (choice === 'remote') {
                const activate = profile.id === this.getActiveId();
                this.applySnapshotForProfile(profile.id, remote.payload, { activate });
                updateCloudProfileMeta(profile.id, remoteRevision);
                outbox.remove(localStorage, outboxId);
                if (activate && typeof window.location?.replace === 'function') reloadAppShell();
                return { status: 'resolved', choice: 'remote', revision: remoteRevision };
            }

            if (choice === 'local') {
                const nextRevision = remoteRevision + 1;
                if (!outbox.upsert(localStorage, {
                    id: outboxId,
                    profileId: profile.id,
                    childId: profile.cloudChildId,
                    revision: nextRevision,
                    payload: entry.payload,
                    status: 'pending',
                    attempts: 0,
                    nextAttemptAt: 0,
                    queuedAt: entry.queuedAt,
                    lastError: '',
                    remoteRevision
                })) {
                    const error = new Error('无法保存本地冲突处理结果');
                    error.code = 'SNAPSHOT_CONFLICT_SAVE_FAILED';
                    throw error;
                }
                const results = await this.flushCloudOutbox();
                const result = results.find(item => item.id === outboxId);
                return result || { status: 'pending', id: outboxId, revision: nextRevision };
            }

            const error = new Error('不支持的冲突处理方式');
            error.code = 'SNAPSHOT_CONFLICT_CHOICE_INVALID';
            throw error;
        },

        getProfileSnapshot(id) {
            if (!id) return {};
            if (id === this.getActiveId()) {
                const liveSnapshot = {};
                getBusinessKeys().forEach(k => {
                    liveSnapshot[k] = localStorage.getItem(k);
                });
                return liveSnapshot;
            }
            return sanitizeSnapshot(safeParse(localStorage.getItem(DATA_PREFIX + id), {}));
        },

        exportProfiles() {
            const activeId = this.getActiveId();
            return this.list().map(profile => {
                const snapshot = this.getProfileSnapshot(profile.id);
                return {
                    id: profile.id,
                    name: profile.name,
                    emoji: profile.emoji,
                    createdAt: profile.createdAt,
                    isActive: profile.id === activeId,
                    snapshotKey: this.getSnapshotKey(profile.id),
                    snapshot
                };
            });
        },

        upsertImportedProfile(input) {
            const importedId = String(input && input.id || '').trim();
            if (!importedId) return null;

            const normalized = {
                id: importedId,
                name: String(input && input.name || '').trim() || '云端孩子',
                emoji: String(input && input.emoji || '').trim() || '🧒',
                createdAt: Number(input && input.createdAt) || Date.now()
            };

            const list = this._readMeta();
            const existing = list.find(function (profile) {
                return profile.id === importedId;
            });
            if (existing) {
                existing.name = normalized.name;
                existing.emoji = normalized.emoji;
                if (!existing.createdAt) existing.createdAt = normalized.createdAt;
                this._writeMeta(list);
                return existing;
            }

            const activeId = this.getActiveId();
            const placeholder = list.length === 1 && list[0] && list[0].id === 'p_default'
                ? list[0]
                : null;
            const placeholderSnapshot = placeholder ? this.getProfileSnapshot(placeholder.id) : {};
            if (placeholder && activeId === 'p_default' && !hasSnapshotData(placeholderSnapshot)) {
                list[0] = normalized;
                this._writeMeta(list);
                this._setActiveId(importedId);
                localStorage.removeItem(DATA_PREFIX + 'p_default');
                return normalized;
            }

            list.push(normalized);
            this._writeMeta(list);
            return normalized;
        },

        applySnapshotForProfile(id, snapshot, options) {
            const profileId = String(id || '').trim();
            if (!profileId) return {};

            const config = Object.assign({
                activate: false
            }, options || {});
            const nextSnapshot = sanitizeSnapshot(snapshot);

            localStorage.setItem(DATA_PREFIX + profileId, JSON.stringify(nextSnapshot));

            if (config.activate) {
                getBusinessKeys().forEach(function (key) {
                    localStorage.removeItem(key);
                });
                Object.keys(nextSnapshot).forEach(function (key) {
                    if (isSnapshotBusinessKey(key) && nextSnapshot[key] !== null && nextSnapshot[key] !== undefined) {
                        localStorage.setItem(key, nextSnapshot[key]);
                    }
                });
                this._setActiveId(profileId);
            }

            return nextSnapshot;
        },

        // 暴露给测试用
        _getBusinessKeys: getBusinessKeys,
        _META_KEY: META_KEY,
        _ACTIVE_KEY: ACTIVE_KEY,
        _DATA_PREFIX: DATA_PREFIX,
        _SELF_HOSTED_AUTH_KEYS: [...SELF_HOSTED_AUTH_KEYS]
    };

    window.ProfileManager = ProfileManager;

    // ---------- ProfileUI：切换器渲染 + 交互 ----------
    const ProfileUI = {
        _panel: null,
        _outsideHandler: null,
        _trigger: null,
        render() {
            const cur = ProfileManager.getActive();
            if (!cur) return;
            const e = document.getElementById('profileCurEmoji');
            const n = document.getElementById('profileCurName');
            if (e) e.textContent = cur.emoji;
            if (n) n.textContent = cur.name;
        },
        toggle(ev) {
            if (ev) ev.stopPropagation();
            if (this._panel && document.body.contains(this._panel)) { this._close(); return; }
            this._trigger = ev?.currentTarget || document.getElementById('profileSwitcher');
            this._open();
        },
        _open() {
            const list = ProfileManager.list();
            const activeId = ProfileManager.getActiveId();
            const panel = document.createElement('div');
            panel.className = 'profile-panel';
            panel.innerHTML = `
                <div class="profile-panel-title">切换孩子</div>
                <div class="profile-list">
                    ${list.map(p => `
                        <div class="profile-item ${p.id === activeId ? 'active' : ''}" onclick="ProfileUI.select('${p.id}')">
                            <span class="profile-item-emoji">${p.emoji}</span>
                            <span class="profile-item-name">${p.name}</span>
                            ${p.id === activeId ? '<span class="profile-item-check">✓</span>' : ''}
                        </div>
                    `).join('')}
                </div>
                <button class="profile-new" onclick="ProfileUI._close();switchPage('settings')">⚙️ 账号管理 →</button>
            `;
            document.body.appendChild(panel);
            const sw = this._trigger || document.getElementById('profileSwitcher');
            if (sw) {
                const r = sw.getBoundingClientRect();
                panel.style.top = (r.bottom + 6) + 'px';
                panel.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
            }
            this._panel = panel;
            setTimeout(() => {
                this._outsideHandler = (e) => { if (!panel.contains(e.target) && !e.target.closest('[data-profile-trigger]') && e.target.id !== 'profileSwitcher') this._close(); };
                document.addEventListener('click', this._outsideHandler);
            }, 0);
        },
        _close() {
            if (this._panel) { this._panel.remove(); this._panel = null; }
            if (this._outsideHandler) { document.removeEventListener('click', this._outsideHandler); this._outsideHandler = null; }
            this._trigger = null;
        },
        select(id) {
            this._close();
            if (id === ProfileManager.getActiveId()) return;
            if (confirm('切换到这个孩子？当前孩子的数据会自动保留。')) void ProfileManager.switchToAsync(id);
        },
        create() {
            this._close();
            if (window.ParentAccountUI && typeof window.ParentAccountUI.openChildDialog === 'function') {
                window.ParentAccountUI.openChildDialog();
            }
        },
        rename(id) {
            const p = ProfileManager.get(id);
            if (!p) return;
            const name = prompt('修改名字：', p.name);
            if (name && name.trim()) { ProfileManager.rename(id, name.trim()); this._open(); }
        },
        remove(id) {
            const p = ProfileManager.get(id);
            if (!p) return;
            if (confirm(`删除「${p.name}」？该孩子的所有数据将被清除，不可恢复。`)) {
                ProfileManager.remove(id);
            }
        }
    };
    window.ProfileUI = ProfileUI;

    // ---------- SettingsPage：账号管理页渲染 ----------
    const SettingsPage = {
        learningModeAdvancedExpanded: false,
        render() {
            const container = document.getElementById('settings-account-list');
            if (container) {
                const list = ProfileManager.list();
                const activeId = ProfileManager.getActiveId();
                const html = list.map(p => {
                const isActive = p.id === activeId;
                // 默认账号 p_default 或仅剩 1 个时不显示删除
                const canDelete = p.id !== 'p_default' && list.length > 1;
                return `
                    <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;background:#fff;border:1px solid rgba(220,228,221,0.9);border-radius:12px;margin-bottom:10px;box-shadow:0 2px 8px rgba(73,84,74,0.06);">
                        <span style="font-size:28px;">${p.emoji}</span>
                        <span style="flex:1;font-size:15px;font-weight:600;color:var(--text-primary);">${p.name}</span>
                        ${isActive ? '<span style="font-size:12px;font-weight:700;color:#fff;background:var(--sage-green);padding:2px 10px;border-radius:999px;">当前</span>' : ''}
                        <button onclick="SettingsPage.rename('${p.id}')" title="改名" style="background:none;border:none;cursor:pointer;font-size:16px;padding:4px 8px;color:var(--text-secondary);">✎</button>
                        ${canDelete ? `<button onclick="SettingsPage.remove('${p.id}')" title="删除" style="background:none;border:none;cursor:pointer;font-size:16px;padding:4px 8px;color:#e57373;">✕</button>` : ''}
                    </div>
                `;
                }).join('');
                const footer = `
                <button onclick="SettingsPage.create()" style="margin-top:8px;width:100%;padding:12px;border:1px dashed rgba(126,182,108,0.5);border-radius:12px;background:transparent;color:var(--text-primary);cursor:pointer;font-size:14px;font-weight:600;transition:background 0.12s;" onmouseover="this.style.background='rgba(126,182,108,0.08)'" onmouseout="this.style.background='transparent'">➕ 新建孩子</button>
            `;
                container.innerHTML = html + footer;
            }
            this.renderLearningMode();
        },
        renderLearningMode() {
            const container = document.getElementById('settings-learning-mode');
            if (!container) return;

            const modeList = window.LearnCenter && typeof window.LearnCenter.getDailySheetModes === 'function'
                ? window.LearnCenter.getDailySheetModes()
                : FALLBACK_LEARNING_MODES;
            const currentMode = window.LearnCenter && typeof window.LearnCenter.getDailySheetMode === 'function'
                ? window.LearnCenter.getDailySheetMode()
                : 'template-a';
            const primaryMode = modeList.find(mode => mode.recommended) || modeList[0] || FALLBACK_LEARNING_MODES[0];
            const advancedModes = modeList.filter(mode => mode.id !== primaryMode?.id);
            const advancedExpanded = currentMode !== primaryMode?.id || this.learningModeAdvancedExpanded;

            container.innerHTML = `
                <section class="settings-panel settings-learning-panel">
                    <div class="settings-panel-head">
                        <div>
                            <span class="settings-panel-kicker">学习单</span>
                            <h3>选择学习单模式</h3>
                            <p>默认推荐最轻量的 4 项。孩子适应后，再考虑更完整的记录。</p>
                        </div>
                        <div class="settings-panel-tip">每个孩子单独记住</div>
                    </div>
                    <div class="settings-learning-default">
                        <div class="settings-learning-default-copy">
                            <strong>推荐先用这个</strong>
                            <span>每天 4 项，先把学习节奏跑顺。</span>
                        </div>
                        ${advancedModes.length ? `
                            <button
                                class="settings-learning-advanced-toggle ${advancedExpanded ? 'is-open' : ''}"
                                type="button"
                                data-learning-mode-advanced-toggle="1">
                                ${advancedExpanded ? '收起其他模式' : `查看其他模式（${advancedModes.length} 个）`}
                            </button>
                        ` : ''}
                    </div>
                    <div class="settings-mode-grid settings-mode-grid-primary">
                        ${primaryMode ? `
                            <button
                                class="settings-mode-card settings-mode-card-primary ${primaryMode.id === currentMode ? 'is-active' : ''}"
                                type="button"
                                data-learning-sheet-mode="${primaryMode.id}">
                                <div class="settings-mode-top">
                                    <span class="settings-mode-badge">${primaryMode.badge || '模板'}</span>
                                    <span class="settings-mode-pill">默认推荐</span>
                                </div>
                                <strong>${primaryMode.title || primaryMode.id}</strong>
                                <p>${primaryMode.desc || ''}</p>
                                <div class="settings-mode-meta">${primaryMode.meta || ''}</div>
                            </button>
                        ` : ''}
                    </div>
                    ${advancedModes.length ? `
                        <div class="settings-learning-advanced ${advancedExpanded ? 'is-open' : ''}" data-learning-mode-advanced-panel="1">
                            <div class="settings-learning-advanced-head">
                                <strong>其他模式</strong>
                                <span>需要更完整记录时，再从这里选择。</span>
                            </div>
                            <div class="settings-mode-grid settings-mode-grid-advanced">
                                ${advancedModes.map(mode => `
                                    <button
                                        class="settings-mode-card ${mode.id === currentMode ? 'is-active' : ''}"
                                        type="button"
                                        data-learning-sheet-mode="${mode.id}">
                                        <div class="settings-mode-top">
                                            <span class="settings-mode-badge">${mode.badge || '模板'}</span>
                                            <span class="settings-mode-pill">进阶</span>
                                        </div>
                                        <strong>${mode.title || mode.id}</strong>
                                        <p>${mode.desc || ''}</p>
                                        <div class="settings-mode-meta">${mode.meta || ''}</div>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    <div class="settings-learning-foot">修改后，积分区的学习单会立即更新。</div>
                </section>
            `;

            const advancedToggle = container.querySelector('[data-learning-mode-advanced-toggle]');
            if (advancedToggle) {
                advancedToggle.addEventListener('click', () => {
                    this.learningModeAdvancedExpanded = !advancedExpanded;
                    this.renderLearningMode();
                });
            }
            container.querySelectorAll('[data-learning-sheet-mode]').forEach(button => {
                button.addEventListener('click', () => {
                    this.selectLearningMode(button.dataset.learningSheetMode || 'template-a');
                });
            });
        },
        selectLearningMode(modeId) {
            const nextMode = window.LearnCenter && typeof window.LearnCenter.setDailySheetMode === 'function'
                ? window.LearnCenter.setDailySheetMode(modeId)
                : (modeId || 'template-a');
            this.learningModeAdvancedExpanded = nextMode !== 'template-a';
            this.renderLearningMode();
            if (typeof window.showToast === 'function') {
                const mode = (window.LearnCenter && typeof window.LearnCenter.getDailySheetModes === 'function'
                    ? window.LearnCenter.getDailySheetModes()
                    : FALLBACK_LEARNING_MODES
                ).find(item => item.id === nextMode);
                window.showToast(`📘 已切换为${mode ? `「${mode.title}」` : '新的学习单模式'}`);
            }
        },
        create() {
            if (window.ParentAccountUI && typeof window.ParentAccountUI.openChildDialog === 'function') {
                window.ParentAccountUI.openChildDialog();
            }
        },
        rename(id) {
            const p = ProfileManager.get(id);
            if (!p) return;
            const name = prompt('修改名字：', p.name);
            if (name && name.trim()) {
                ProfileManager.rename(id, name.trim());
                this.render();
                if (window.ProfileUI) ProfileUI.render();
            }
        },
        remove(id) {
            const p = ProfileManager.get(id);
            if (!p) return;
            if (confirm(`删除「${p.name}」？该孩子的所有数据将被清除，不可恢复。`)) {
                const res = ProfileManager.remove(id);
                // 若删除的是当前 active，remove 内部已 reload，无需再 render
                if (res.ok && !res.reloaded) {
                    this.render();
                    if (window.ProfileUI) ProfileUI.render();
                }
            }
        }
    };
    window.SettingsPage = SettingsPage;
})();
