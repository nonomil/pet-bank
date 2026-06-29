/**
 * profiles.js - ProfileManager（多孩子本地切换 · C 方案 swap 实现）
 *
 * 设计核心：业务代码（app/pet/inventory/exploration/walk/card/treasure/home/shop）
 * 继续读写 `petbank_*` 键（零改动）。ProfileManager 在切换 profile 时，
 * 动态遍历 localStorage 所有 `petbank_*` 业务键，把当前 profile 的数据快照
 * 存到 `petbank_profile_data_{id}`，再加载目标 profile 的快照写回业务键，
 * 最后 location.reload()，各模块重新读 petbank_* 完成切换。
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

    // 全局共享键前缀（不属于任何 profile，切换时不搬动）
    const RESERVED_KEYS = new Set([META_KEY, ACTIVE_KEY]);

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

    /**
     * 动态遍历 localStorage，返回当前所有业务键（petbank_* 减去元数据/快照）
     */
    function getBusinessKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (isBusinessKey(k)) keys.push(k);
        }
        return keys;
    }

    function safeParse(raw, fallback) {
        if (raw == null) return fallback;
        try { return JSON.parse(raw); } catch (e) { return fallback; }
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
         *   5. location.reload()
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
            const snapshot = safeParse(raw, {});
            Object.keys(snapshot).forEach(k => {
                if (snapshot[k] !== null && snapshot[k] !== undefined) {
                    localStorage.setItem(k, snapshot[k]);
                }
            });
            // 4. 设 active
            this._setActiveId(targetId);
        },

        /**
         * 切换 profile（对外）：校验后 swap + reload
         */
        switchTo(id) {
            const list = this._readMeta();
            if (!list.find(p => p.id === id)) return { ok: false, reason: 'not_found' };
            if (id === this.getActiveId()) return { ok: false, reason: 'same' };
            this._swapTo(id, false);
            // 5. reload 让各模块重新读 petbank_*
            location.reload();
            return { ok: true };
        },

        /**
         * 重置当前 profile 的所有业务数据（危险操作，需确认）
         * 清空当前业务键 + 移除当前快照 + reload
         */
        resetCurrent() {
            const id = this.getActiveId();
            if (!id) return { ok: false };
            getBusinessKeys().forEach(k => localStorage.removeItem(k));
            localStorage.removeItem(DATA_PREFIX + id);
            location.reload();
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

        // 暴露给测试用
        _getBusinessKeys: getBusinessKeys,
        _META_KEY: META_KEY,
        _ACTIVE_KEY: ACTIVE_KEY,
        _DATA_PREFIX: DATA_PREFIX
    };

    window.ProfileManager = ProfileManager;

    // ---------- ProfileUI：切换器渲染 + 交互 ----------
    const ProfileUI = {
        _panel: null,
        _outsideHandler: null,
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
                            <button class="profile-item-edit" title="改名" onclick="event.stopPropagation();ProfileUI.rename('${p.id}')">✎</button>
                            ${p.id !== 'p_default' && list.length > 1 ? `<button class="profile-item-del" title="删除" onclick="event.stopPropagation();ProfileUI.remove('${p.id}')">✕</button>` : ''}
                        </div>
                    `).join('')}
                </div>
                <button class="profile-new" onclick="ProfileUI.create()">➕ 新建孩子</button>
            `;
            document.body.appendChild(panel);
            const sw = document.getElementById('profileSwitcher');
            if (sw) {
                const r = sw.getBoundingClientRect();
                panel.style.top = (r.bottom + 6) + 'px';
                panel.style.right = Math.max(8, window.innerWidth - r.right) + 'px';
            }
            this._panel = panel;
            setTimeout(() => {
                this._outsideHandler = (e) => { if (!panel.contains(e.target) && e.target.id !== 'profileSwitcher') this._close(); };
                document.addEventListener('click', this._outsideHandler);
            }, 0);
        },
        _close() {
            if (this._panel) { this._panel.remove(); this._panel = null; }
            if (this._outsideHandler) { document.removeEventListener('click', this._outsideHandler); this._outsideHandler = null; }
        },
        select(id) {
            this._close();
            if (id === ProfileManager.getActiveId()) return;
            if (confirm('切换到这个孩子？当前孩子的数据会自动保留。')) ProfileManager.switchTo(id);
        },
        create() {
            this._close();
            const name = prompt('新孩子的名字：', '');
            if (!name || !name.trim()) return;
            const p = ProfileManager.create(name.trim(), '🧒');
            if (confirm(`已创建「${p.name}」，立即切换过去吗？`)) ProfileManager.switchTo(p.id);
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
})();
