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

    function hasSnapshotData(snapshot) {
        if (!snapshot || typeof snapshot !== 'object') return false;
        return Object.keys(snapshot).some(function (key) {
            return isBusinessKey(key) || (key && key.startsWith('petbank_'));
        });
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

        getSnapshotKey(id) {
            return DATA_PREFIX + id;
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
            return safeParse(localStorage.getItem(DATA_PREFIX + id), {});
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
            const nextSnapshot = snapshot && typeof snapshot === 'object'
                ? snapshot
                : {};

            localStorage.setItem(DATA_PREFIX + profileId, JSON.stringify(nextSnapshot));

            if (config.activate) {
                getBusinessKeys().forEach(function (key) {
                    localStorage.removeItem(key);
                });
                Object.keys(nextSnapshot).forEach(function (key) {
                    if (nextSnapshot[key] !== null && nextSnapshot[key] !== undefined) {
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
                        </div>
                    `).join('')}
                </div>
                <button class="profile-new" onclick="ProfileUI._close();switchPage('settings')">⚙️ 账号管理 →</button>
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

    // ---------- SettingsPage：账号管理页渲染 ----------
    const SettingsPage = {
        learningModeAdvancedExpanded: false,
        render() {
            const container = document.getElementById('settings-account-list');
            if (!container) return;
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
                            <span class="settings-panel-kicker">学习打勾模式</span>
                            <h3>积分区学习单显示哪种模式</h3>
                            <p>推荐先用幼小衔接超轻量版，等孩子节奏稳了，再切到更完整的记录模板。</p>
                        </div>
                        <div class="settings-panel-tip">按孩子账号分别记住</div>
                    </div>
                    <div class="settings-learning-default">
                        <div class="settings-learning-default-copy">
                            <strong>默认先用超轻量版</strong>
                            <span>先把每天 4 个核心小项跑顺，后面再决定要不要升级记录强度。</span>
                        </div>
                        ${advancedModes.length ? `
                            <button
                                class="settings-learning-advanced-toggle ${advancedExpanded ? 'is-open' : ''}"
                                type="button"
                                data-learning-mode-advanced-toggle="1">
                                ${advancedExpanded ? '收起进阶模式' : `显示进阶模式（${advancedModes.length} 个）`}
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
                                <strong>进阶模式</strong>
                                <span>家长觉得孩子节奏稳定后，再考虑切到这里。</span>
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
                    <div class="settings-learning-foot">切换后，积分区的“学习单”子页会立即按新模式显示；lesson 的原有积分规则继续沿用。</div>
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
            const name = prompt('新孩子的名字：', '');
            if (!name || !name.trim()) return;
            const p = ProfileManager.create(name.trim(), '🧒');
            if (confirm(`已创建「${p.name}」，立即切换过去吗？`)) {
                ProfileManager.switchTo(p.id); // 内部会 reload
            } else {
                this.render();
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
