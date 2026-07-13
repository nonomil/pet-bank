(function () {
    'use strict';

    const state = {
        account: null,
        households: [],
        activeHouseholdId: '',
        members: [],
        children: [],
        mode: 'login',
        loading: false,
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function root() { return document.getElementById('parent-account-root'); }

    function setStatus(message, tone) {
        const node = document.getElementById('parent-account-status');
        if (!node) return;
        node.textContent = message || '';
        node.dataset.tone = tone || '';
    }

    function buttonLabel() { return state.loading ? '处理中…' : '提交'; }

    function cloudConflicts() {
        const manager = window.ProfileManager;
        if (!manager || typeof manager.getCloudSyncOutbox !== 'function') return [];
        return manager.getCloudSyncOutbox()
            .filter(entry => entry && entry.status === 'conflict')
            .map(entry => ({
                entry,
                profile: typeof manager.get === 'function' ? manager.get(entry.profileId) : null
            }));
    }

    function renderCloudConflictPanel() {
        const conflicts = cloudConflicts();
        if (!conflicts.length) return '';
        return `
            <section class="parent-cloud-conflicts" aria-labelledby="parent-cloud-conflicts-title">
                <div class="parent-account-section-head">
                    <div><p class="parent-account-kicker">需要处理</p><h5 id="parent-cloud-conflicts-title">云端数据冲突</h5></div>
                    <span class="parent-account-state is-warning">${conflicts.length} 条</span>
                </div>
                <p class="parent-account-note">本机和云端都有新进度。系统不会自动覆盖任何一方，请选择保留哪份数据，或先导出本机备份。</p>
                <div class="parent-cloud-conflict-list">
                    ${conflicts.map(({ entry, profile }) => `
                        <div class="parent-cloud-conflict-item">
                            <div class="parent-cloud-conflict-copy">
                                <strong>${escapeHtml(profile?.name || entry.profileId)}</strong>
                                <small>本机版本 ${entry.revision} · 云端版本 ${entry.remoteRevision || '未知'}</small>
                            </div>
                            <div class="parent-cloud-conflict-actions">
                                <button class="parent-row-action" type="button" data-parent-conflict-choice="remote" data-parent-conflict-profile="${escapeHtml(entry.profileId)}">采用云端</button>
                                <button class="parent-row-action" type="button" data-parent-conflict-choice="local" data-parent-conflict-profile="${escapeHtml(entry.profileId)}">保留本机</button>
                                <button class="parent-row-action" type="button" data-parent-conflict-choice="export" data-parent-conflict-profile="${escapeHtml(entry.profileId)}">导出备份</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    function renderCloudSyncStatus() {
        const manager = window.ProfileManager;
        const profile = manager && typeof manager.getActive === 'function' ? manager.getActive() : null;
        if (!profile?.cloudChildId) {
            return '<p class="parent-cloud-sync-status">孩子添加后，积分和宠物进度会在本机保存；连接家庭后自动备份到 SQLite。</p>';
        }

        const entries = manager && typeof manager.getCloudSyncOutbox === 'function'
            ? manager.getCloudSyncOutbox().filter(entry => entry.profileId === profile.id && entry.childId === profile.cloudChildId)
            : [];
        if (entries.some(entry => entry.status === 'conflict')) {
            return '<p class="parent-cloud-sync-status is-warning">本机和云端都有新进度，请在上方处理冲突。</p>';
        }
        if (entries.some(entry => entry.status === 'pending')) {
            return '<p class="parent-cloud-sync-status is-pending">本机进度待同步，网络恢复后会自动重试。</p>';
        }
        if (profile.lastCloudSyncAt) {
            const time = new Date(profile.lastCloudSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `<p class="parent-cloud-sync-status is-success">积分和宠物进度已同步 · ${escapeHtml(time)}</p>`;
        }
        return '<p class="parent-cloud-sync-status">已连接 SQLite；积分和宠物进度会在修改后自动同步。</p>';
    }

    function downloadCloudConflict(profileId) {
        const manager = window.ProfileManager;
        const exported = manager && typeof manager.getCloudConflictExport === 'function'
            ? manager.getCloudConflictExport(profileId)
            : null;
        if (!exported) throw new Error('没有找到可导出的冲突快照');
        const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `petbank-cloud-conflict-${String(profileId).replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
    }

    async function handleCloudConflictChoice(event) {
        const button = event.currentTarget;
        const choice = button.dataset.parentConflictChoice;
        const profileId = button.dataset.parentConflictProfile;
        const panel = button.closest('.parent-cloud-conflicts');
        if (!choice || !profileId || !window.ProfileManager) return;
        panel?.querySelectorAll('button').forEach(item => { item.disabled = true; });
        try {
            if (choice === 'export') {
                downloadCloudConflict(profileId);
                setStatus('本机冲突快照已导出，请妥善保存。', 'success');
                return;
            }
            const result = await window.ProfileManager.resolveCloudConflict(profileId, choice);
            await loadData();
            if (result.status === 'synced') setStatus('本机快照已作为新版本同步到云端。', 'success');
            else setStatus('冲突处理结果已保存，稍后会继续同步。', 'success');
        } catch (error) {
            setStatus(error.message || '处理云端冲突失败。', 'error');
        } finally {
            panel?.querySelectorAll('button').forEach(item => { item.disabled = false; });
        }
    }

    function renderSignedOut() {
        const node = root();
        if (!node) return;
        const register = state.mode === 'register';
        node.innerHTML = `
            <div class="parent-account-card">
                <div class="parent-account-head">
                    <div>
                        <p class="parent-account-kicker">家长账号</p>
                        <h4>${register ? '创建家长账号' : '家长登录'}</h4>
                    </div>
                    <span class="parent-account-state">${register ? '注册' : '登录'}</span>
                </div>
                <p class="parent-account-copy">先登录家长账号，再创建或加入家庭，孩子档案会挂靠在当前家庭下面。</p>
                <form id="parent-account-form" class="parent-account-form">
                    ${register ? '<label>显示名称<input name="displayName" autocomplete="name" maxlength="80" placeholder="例如：妈妈" required></label>' : ''}
                    <label>用户名<input name="username" autocomplete="username" autocapitalize="none" maxlength="32" placeholder="例如：mama_01" required></label>
                    <label>密码<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" placeholder="至少 8 个字符" required></label>
                    <div class="parent-account-actions">
                        <button class="btn-primary" type="submit">${buttonLabel()}</button>
                        <button class="btn-secondary" type="button" data-parent-account-toggle>${register ? '已有账号，去登录' : '还没有账号，去注册'}</button>
                    </div>
                </form>
                <p class="parent-account-status" id="parent-account-status" role="status"></p>
            </div>
        `;
        const form = document.getElementById('parent-account-form');
        if (form) form.addEventListener('submit', handleAuthSubmit);
        const toggle = node.querySelector('[data-parent-account-toggle]');
        if (toggle) toggle.addEventListener('click', () => { state.mode = register ? 'login' : 'register'; render(); });
    }

    function renderSignedIn() {
        const node = root();
        if (!node) return;
        const household = state.households.find(item => item.id === state.activeHouseholdId) || state.households[0];
        state.activeHouseholdId = household ? household.id : '';
        node.innerHTML = `
            <div class="parent-account-card">
                <div class="parent-account-head">
                    <div>
                        <p class="parent-account-kicker">已登录家长</p>
                        <h4>${escapeHtml(state.account.displayName)}</h4>
                    </div>
                    <button class="btn-secondary parent-account-logout" type="button" data-parent-logout>退出</button>
                </div>
                <p class="parent-account-copy">用户名：${escapeHtml(state.account.username)}</p>
                ${renderCloudConflictPanel()}
                ${renderCloudSyncStatus()}
                ${household ? `<div class="parent-household-summary"><strong>${escapeHtml(household.name)}</strong><span>当前家庭</span></div>` : `
                    <div class="parent-account-empty">先创建家庭，或输入邀请码加入已有家庭。</div>
                    <div class="parent-account-inline-actions">
                        <button class="btn-primary" type="button" data-parent-create-household>创建家庭</button>
                        <button class="btn-secondary" type="button" data-parent-redeem>输入邀请码</button>
                    </div>
                `}
                <div id="parent-household-content"></div>
                <details class="parent-account-more-actions" data-parent-more-actions>
                    <summary>更多操作</summary>
                    ${household && state.households.length > 1 ? `<label class="parent-account-select-label">切换家庭
                        <select id="parent-household-select">
                            ${state.households.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === state.activeHouseholdId ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}
                        </select>
                    </label>` : ''}
                    ${household ? '<button class="parent-row-action" type="button" data-parent-create-household>创建另一个家庭</button><button class="parent-row-action" type="button" data-parent-redeem>输入家庭邀请码</button>' : ''}
                    <button class="parent-row-action is-danger" type="button" data-parent-delete-account>删除账号</button>
                </details>
                <p class="parent-account-status" id="parent-account-status" role="status"></p>
            </div>
        `;
        node.querySelector('[data-parent-logout]')?.addEventListener('click', handleLogout);
        node.querySelectorAll('[data-parent-create-household]').forEach((button) => button.addEventListener('click', createHousehold));
        node.querySelectorAll('[data-parent-redeem]').forEach((button) => button.addEventListener('click', redeemInvite));
        node.querySelector('[data-parent-delete-account]')?.addEventListener('click', deleteAccount);
        node.querySelectorAll('[data-parent-conflict-choice]').forEach((button) => button.addEventListener('click', handleCloudConflictChoice));
        node.querySelector('#parent-household-select')?.addEventListener('change', (event) => {
            state.activeHouseholdId = event.target.value;
            loadChildren();
            loadMembers();
        });
        renderHouseholdContent();
    }

    function renderHouseholdContent() {
        const node = document.getElementById('parent-household-content');
        if (!node) return;
        const household = state.households.find(item => item.id === state.activeHouseholdId);
        if (!household) {
            node.innerHTML = '';
            return;
        }
        const currentMember = state.members.find(item => item.account.id === state.account?.id);
        const canManageHousehold = currentMember?.role === 'owner';
        const canManageChildren = currentMember?.role === 'owner';
        node.innerHTML = `
            <div class="parent-account-section-head"><h5>孩子档案</h5><button class="btn-primary" type="button" data-parent-add-child>添加孩子</button></div>
            <div class="parent-child-cloud-list">${state.children.length ? state.children.map(child => `
                <div class="parent-child-cloud-item"><span class="parent-child-cloud-avatar">🧒</span><div><strong>${escapeHtml(child.name)}</strong><small>${child.localProfileId ? '可在这台设备进入孩子端' : '已添加到当前家庭'}</small></div>${canManageChildren ? `<div class="parent-child-cloud-actions"><button class="parent-row-action" type="button" data-parent-rename-child="${escapeHtml(child.id)}">改名</button><button class="parent-row-action is-danger" type="button" data-parent-delete-child="${escapeHtml(child.id)}">删除</button></div>` : '<span class="parent-member-current">只读</span>'}</div>
            `).join('') : '<div class="parent-account-empty">这个家庭还没有孩子档案。</div>'}</div>
            ${canManageHousehold ? `<details class="parent-account-more-actions"><summary>邀请另一位家长</summary><p class="parent-account-note">对方注册自己的家长账号后，输入邀请码即可加入当前家庭。</p><button class="parent-row-action" type="button" data-parent-create-invite>生成邀请码</button><div class="parent-account-invite-result" id="parent-invite-result"></div></details>` : ''}
        `;
        node.querySelector('[data-parent-add-child]')?.addEventListener('click', () => openChildDialog());
        node.querySelector('[data-parent-create-invite]')?.addEventListener('click', createInvite);
        node.querySelectorAll('[data-parent-rename-child]').forEach((button) => button.addEventListener('click', () => renameChild(button.dataset.parentRenameChild)));
        node.querySelectorAll('[data-parent-delete-child]').forEach((button) => button.addEventListener('click', () => deleteChild(button.dataset.parentDeleteChild)));
    }

    async function handleAuthSubmit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        state.loading = true;
        renderSignedOut();
        try {
            const payload = state.mode === 'register'
                ? await SelfHostedApi.register(data.get('username'), data.get('password'), data.get('displayName'))
                : await SelfHostedApi.login(data.get('username'), data.get('password'));
            state.account = payload.account;
            await loadData();
            if (typeof window.showToast === 'function') window.showToast('家长账号已连接');
        } catch (error) {
            state.loading = false;
            renderSignedOut();
            setStatus(error.message, 'error');
        }
    }

    async function handleLogout() {
        state.loading = true;
        try {
            if (window.ProfileManager && typeof window.ProfileManager.syncActiveToCloud === 'function') {
                await window.ProfileManager.syncActiveToCloud();
            }
        } catch (error) {}
        try { await SelfHostedApi.logout(); } catch (error) {}
            state.account = null;
            state.households = [];
            state.children = [];
            state.members = [];
            state.loading = false;
            if (typeof window.updateParentHomePage === 'function') window.updateParentHomePage();
            render();
    }

    async function createHousehold() {
        const name = window.prompt('家庭名称：', '我的家庭');
        if (!name || !name.trim()) return;
        try {
            await SelfHostedApi.createHousehold(name.trim());
            await loadData();
            setStatus('家庭已创建。', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function redeemInvite() {
        const code = window.prompt('输入 8 位家庭邀请码：', '');
        if (!code || !code.trim()) return;
        try {
            await SelfHostedApi.redeemInvite(code.trim());
            await loadData();
            setStatus('已加入家庭。', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function createInvite() {
        if (!state.activeHouseholdId) return;
        try {
            const payload = await SelfHostedApi.createInvite(state.activeHouseholdId);
            const node = document.getElementById('parent-invite-result');
            if (node) node.innerHTML = `邀请码：<strong class="parent-invite-code">${escapeHtml(payload.invite.code)}</strong>，7 天内有效。`;
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function removeMember(accountId) {
        const member = state.members.find(item => item.account.id === accountId);
        if (!member || !state.activeHouseholdId) return;
        if (!window.confirm(`移除家长“${member.account.displayName}”？对方将退出当前家庭，但账号不会被删除。`)) return;
        try {
            await SelfHostedApi.removeMember(state.activeHouseholdId, accountId);
            await loadMembers();
            setStatus('已移除家庭成员。', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function renameChild(childId) {
        const child = state.children.find(item => item.id === childId);
        if (!child) return;
        const name = window.prompt('修改孩子昵称：', child.name);
        if (!name || !name.trim() || name.trim() === child.name) return;
        try {
            await SelfHostedApi.renameChild(childId, name.trim());
            const local = ProfileManager.findByCloudChildId(childId);
            if (local) ProfileManager.rename(local.id, name.trim());
            await loadChildren();
            setStatus('孩子昵称已更新。', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function deleteChild(childId) {
        const child = state.children.find(item => item.id === childId);
        if (!child) return;
        if (!window.confirm(`删除“${child.name}”？云端快照会一并删除，此操作不可恢复。`)) return;
        try {
            await SelfHostedApi.deleteChild(childId);
            const local = ProfileManager.findByCloudChildId(childId);
            const profiles = ProfileManager.list();
            if (local && profiles.length > 1) {
                const result = ProfileManager.remove(local.id);
                if (result.reloaded) window.location.reload();
            } else if (local) {
                ProfileManager.linkCloudChild(local.id, '', '');
            }
            await loadChildren();
            setStatus('孩子档案已删除。', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function deleteAccount() {
        const username = state.account?.username || '';
        const password = window.prompt(`删除账号 ${username} 前请输入当前密码：`, '');
        if (!password) return;
        if (!window.confirm('确定删除账号？账号不能恢复；如果名下还有家庭，服务端会拒绝删除。')) return;
        try {
            await SelfHostedApi.deleteAccount(password);
            SelfHostedApi.clearSession();
            state.account = null;
            state.households = [];
            state.members = [];
            state.children = [];
            render();
            setStatus('账号已删除。', 'success');
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function loadChildren() {
        if (!state.activeHouseholdId) { state.children = []; renderHouseholdContent(); return; }
        try {
            const payload = await SelfHostedApi.listChildren(state.activeHouseholdId);
            state.children = payload.children || [];
            renderHouseholdContent();
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function loadMembers() {
        if (!state.activeHouseholdId) { state.members = []; renderHouseholdContent(); return; }
        try {
            const payload = await SelfHostedApi.listMembers(state.activeHouseholdId);
            state.members = payload.members || [];
            renderHouseholdContent();
        } catch (error) { setStatus(error.message, 'error'); }
    }

    async function loadData() {
        state.loading = true;
        try {
            const [me, households] = await Promise.all([SelfHostedApi.me(), SelfHostedApi.listHouseholds()]);
            state.account = me.account;
        state.households = households.households || [];
            if (!state.activeHouseholdId || !state.households.some(item => item.id === state.activeHouseholdId)) {
                state.activeHouseholdId = state.households[0]?.id || '';
            }
            state.loading = false;
            renderSignedIn();
            await loadChildren();
            await loadMembers();
            if (typeof window.updateParentHomePage === 'function') window.updateParentHomePage();
        } catch (error) {
            state.loading = false;
            if (error.status === 401) { SelfHostedApi.clearSession(); state.account = null; renderSignedOut(); }
            else { renderSignedIn(); setStatus(error.message, 'error'); }
        }
    }

    function closeChildDialog(dialog) {
        if (dialog && dialog.parentNode) dialog.parentNode.removeChild(dialog);
    }

    function openChildDialog() {
        if (!root() || !root().offsetParent || !state.account || !state.activeHouseholdId) {
            startChildSetup();
            return;
        }
        const existing = document.getElementById('parent-child-dialog');
        if (existing) return;
        const dialog = document.createElement('div');
        dialog.id = 'parent-child-dialog';
        dialog.className = 'parent-account-dialog-backdrop';
        dialog.innerHTML = `
            <section class="parent-account-dialog" role="dialog" aria-modal="true" aria-labelledby="parent-child-dialog-title">
                <div class="parent-account-head"><div><p class="parent-account-kicker">孩子档案</p><h4 id="parent-child-dialog-title">添加孩子</h4></div><button class="btn-secondary" type="button" data-child-dialog-close aria-label="关闭">关闭</button></div>
                <p class="parent-account-copy">填写昵称和头像后，就能进入孩子端开始使用。</p>
                <form class="parent-account-form" data-child-dialog-form>
                    <label>孩子昵称<input name="name" maxlength="80" placeholder="例如：小星" required></label>
                    <label>头像<select name="emoji"><option value="🧒">🧒 小朋友</option><option value="👧">👧 女孩</option><option value="👦">👦 男孩</option><option value="🐣">🐣 小伙伴</option></select></label>
                    <p class="parent-account-status" data-child-dialog-status role="status"></p>
                    <div class="parent-account-actions"><button class="btn-primary" type="submit">添加孩子</button><button class="btn-secondary" type="button" data-child-dialog-cancel>取消</button></div>
                </form>
            </section>
        `;
        document.body.appendChild(dialog);
        const close = () => closeChildDialog(dialog);
        dialog.querySelector('[data-child-dialog-close]')?.addEventListener('click', close);
        dialog.querySelector('[data-child-dialog-cancel]')?.addEventListener('click', close);
        dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
        dialog.querySelector('[data-child-dialog-form]')?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            const name = String(data.get('name') || '').trim();
            const emoji = String(data.get('emoji') || '🧒');
            const status = dialog.querySelector('[data-child-dialog-status]');
            if (!name) return;
            const submit = form.querySelector('button[type="submit"]');
            if (submit) submit.disabled = true;
            const localProfile = ProfileManager.create(name, emoji);
            let cloudError = null;
            try {
                if (state.account && state.activeHouseholdId) {
                    let child = state.children.find(item => item.localProfileId === localProfile.id);
                    if (!child) {
                        const existing = await SelfHostedApi.listChildren(state.activeHouseholdId);
                        child = (existing.children || []).find(item => item.localProfileId === localProfile.id);
                    }
                    if (!child) {
                        const payload = await SelfHostedApi.createChild(state.activeHouseholdId, name, localProfile.id);
                        child = payload.child;
                    }
                    ProfileManager.linkCloudChild(localProfile.id, child.id, state.activeHouseholdId);
                }
            } catch (error) {
                cloudError = error;
            }
            if (cloudError && status) {
                status.textContent = `已保存在本机，云端稍后重试：${cloudError.message}`;
                status.dataset.tone = 'error';
            }
            if (!cloudError && status) {
                status.textContent = state.account ? '孩子已添加到当前家庭。' : '孩子档案已创建。';
                status.dataset.tone = 'success';
            }
            if (submit) submit.disabled = false;
            state.children = state.children.filter(item => item.localProfileId !== localProfile.id);
            if (state.account && state.activeHouseholdId) await loadChildren();
            if (window.SettingsPage) SettingsPage.render();
            if (window.ProfileUI) ProfileUI.render();
            window.setTimeout(() => {
                closeChildDialog(dialog);
                void ProfileManager.switchToAsync(localProfile.id);
            }, cloudError ? 900 : 250);
        });
    }

    function render() {
        if (!root()) return;
        if (state.account || SelfHostedApi.isSignedIn()) {
            void loadData();
        } else {
            renderSignedOut();
        }
    }

    function startChildSetup() {
        if (!root() || !root().offsetParent) {
            if (typeof window.switchPage === 'function') window.switchPage('settings', { settingsSection: 'family' });
            window.setTimeout(startChildSetup, 50);
            return;
        }
        if (!state.account && !SelfHostedApi.isSignedIn()) {
            state.mode = 'login';
            renderSignedOut();
            setStatus('请先登录家长账号；登录后再创建或加入家庭。', '');
            document.querySelector('#parent-account-form input[name="username"]')?.focus();
            return;
        }
        void loadData().then(() => {
            if (!state.activeHouseholdId) {
                setStatus('请先创建家庭或输入邀请码加入家庭，孩子才能挂靠到家庭下面。', '');
                document.querySelector('[data-parent-create-household]')?.focus();
                return;
            }
            openChildDialog();
        });
    }

    window.ParentAccountUI = {
        render,
        refresh: loadData,
        openChildDialog,
        startChildSetup,
        getState: () => ({ ...state, households: [...state.households], members: [...state.members], children: [...state.children] })
    };
})();
