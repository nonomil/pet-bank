(function () {
    'use strict';

    const state = {
        booted: false,
        loading: false,
        mode: 'signin',
        status: 'idle',
        info: '',
        error: '',
        session: null,
        user: null,
        claimedInviteCode: '',
        inviteLoading: false,
        registrationInvites: []
    };

    let authSubscription = null;
    let claimPromise = null;

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCloudStatus() {
        if (!window.CloudClient || typeof window.CloudClient.getStatus !== 'function') {
            return {
                enabled: false,
                hasSupabaseScript: false,
                hasClient: false,
                supabaseUrl: ''
            };
        }
        return window.CloudClient.getStatus();
    }

    function getClient() {
        if (!window.CloudClient || typeof window.CloudClient.getClient !== 'function') return null;
        return window.CloudClient.getClient();
    }

    function getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : null;
    }

    function cleanupSubscription() {
        if (authSubscription && typeof authSubscription.unsubscribe === 'function') {
            authSubscription.unsubscribe();
        }
        authSubscription = null;
    }

    function applySession(session) {
        state.session = session || null;
        state.user = session && session.user ? session.user : null;
    }

    function normalizeInviteCode(value) {
        return String(value || '').trim().toUpperCase();
    }

    async function validateRegistrationInvite(inviteCode) {
        const client = getClient();
        const normalized = normalizeInviteCode(inviteCode);
        if (!client) throw new Error('当前还没有配置云端账号，请先注入 Supabase 配置。');

        const result = await client.functions.invoke('validate-registration-invite', {
            body: { inviteCode: normalized }
        });
        if (result && result.error) {
            throw result.error;
        }
        return normalized;
    }

    async function claimRegistrationInvite() {
        const client = getClient();
        const user = state.user;
        const inviteCode = user && user.user_metadata
            ? normalizeInviteCode(user.user_metadata.registration_invite_code)
            : '';

        if (!client || !state.session || !user || !inviteCode) return null;
        if (state.claimedInviteCode === inviteCode) return { ok: true, skipped: true, alreadyClaimed: true };
        if (claimPromise) return claimPromise;

        claimPromise = client.functions.invoke('claim-registration-invite', {
            body: { inviteCode: inviteCode }
        }).then(function (result) {
            if (result && result.error) throw result.error;
            state.claimedInviteCode = inviteCode;
            return result ? result.data : { ok: true };
        }).finally(function () {
            claimPromise = null;
        });

        return claimPromise;
    }

    async function refreshRegistrationInvites() {
        const client = getClient();
        if (!client || !state.user) {
            state.registrationInvites = [];
            return [];
        }

        state.inviteLoading = true;
        render();
        try {
            const result = await client.functions.invoke('list-registration-invites', {
                body: { limit: 8 }
            });
            if (result && result.error) throw result.error;
            state.registrationInvites = result && result.data && Array.isArray(result.data.invites)
                ? result.data.invites
                : [];
            return state.registrationInvites;
        } catch (error) {
            state.error = error && error.message ? error.message : '注册邀请码列表刷新失败';
            return [];
        } finally {
            state.inviteLoading = false;
            render();
        }
    }

    function getStatusCopy() {
        const cloud = getCloudStatus();
        const minimalScope = Boolean(window.FamilySocialScope && typeof window.FamilySocialScope.isMinimalV1 === 'function' && window.FamilySocialScope.isMinimalV1());
        if (!cloud.enabled) {
            return minimalScope
                ? '当前运行在本地模式。配置 Supabase 后，可先开启家长账号、邀请码注册、多个孩子同步和好友串门。'
                : '当前运行在本地模式。配置 Supabase 后，可开启家长账号、邀请码注册和跨家庭互动。';
        }
        if (!cloud.hasSupabaseScript) {
            return '已检测到云端配置，但浏览器端 Supabase SDK 尚未可用。';
        }
        if (state.user) {
            return minimalScope
                ? '云端账号已连接，一期先聚焦家庭、多个孩子同步和好友串门互动。'
                : '云端账号已连接，可逐步接入家庭、孩子同步与异步 PK。';
        }
        return '云端已就绪，请先登录或注册家长账号。';
    }

    function renderRegistrationInvites() {
        if (!state.user) return '';

        const householdState = getHouseholdState();
        const householdName = householdState && householdState.primaryHousehold
            ? householdState.primaryHousehold.name
            : '当前未连接家庭';
        const listHtml = state.registrationInvites.length
            ? `
                <div class="auth-invite-list">
                    ${state.registrationInvites.map(function (invite) {
                        const expiresAt = invite.expires_at
                            ? new Date(invite.expires_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '长期';
                        return `
                            <div class="household-issued-invite-card auth-registration-invite-card">
                                <div class="household-issued-invite-copy">
                                    <strong>${escapeHtml(invite.invite_code)}</strong>
                                    <span>${escapeHtml(invite.label || '未写备注')} · ${escapeHtml(invite.status || 'pending')} · 截止 ${escapeHtml(expiresAt)}</span>
                                </div>
                                ${invite.status === 'pending' ? `
                                    <div class="household-actions household-actions-compact">
                                        <button class="btn-secondary household-action-btn" type="button" onclick="AuthSystem.revokeRegistrationInvite('${invite.id}')">撤销邀请码</button>
                                    </div>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            `
            : '<div class="household-empty">你还没有签发过注册邀请码。先生成一个给另一位家长完成注册，再配合家庭邀请码加入同一个家庭。</div>';

        return `
            <div class="auth-registration-shell">
                <div class="social-section-head">
                    <h4>注册邀请码管理</h4>
                    <span>${state.inviteLoading ? '正在刷新…' : (state.registrationInvites.length + ' 个我发出的邀请码')}</span>
                </div>
                <p class="auth-copy">当前家庭：${escapeHtml(householdName)}。先签发注册邀请码，让另一位家长完成账号注册；注册成功后，再使用家庭邀请码加入同一个家庭。</p>
                <form class="auth-form auth-config-form" onsubmit="return AuthSystem.issueRegistrationInvite(event)">
                    <input class="text-input" type="text" name="label" placeholder="邀请码备注（如：爸爸注册 / 奶奶测试）">
                    <input class="text-input" type="number" name="expiresDays" min="1" max="90" value="30" placeholder="有效天数">
                    <div class="household-actions">
                        <button class="btn-primary auth-submit" type="submit">${state.inviteLoading ? '处理中…' : '签发注册邀请码'}</button>
                        <button class="btn-secondary household-action-btn" type="button" onclick="AuthSystem.refreshRegistrationInvites()">刷新邀请码列表</button>
                    </div>
                </form>
                ${listHtml}
            </div>
        `;
    }

    function renderAuthCard() {
        const cloud = getCloudStatus();
        const config = window.CloudClient && typeof window.CloudClient.getConfig === 'function'
            ? window.CloudClient.getConfig()
            : { supabaseUrl: '', supabaseAnonKey: '', siteUrl: '' };
        const userLabel = state.user
            ? (state.user.user_metadata && state.user.user_metadata.parent_name) || state.user.email || state.user.phone || state.user.id
            : '';
        const minimalScope = Boolean(window.FamilySocialScope && typeof window.FamilySocialScope.isMinimalV1 === 'function' && window.FamilySocialScope.isMinimalV1());
        const sessionCopy = minimalScope
            ? '家庭、多个孩子和好友串门都会挂到这个云端身份上。'
            : '后续会把家庭、多个孩子、好友串门和题目 PK 都挂到这个云端身份上。';
        const footnoteCopy = minimalScope
            ? '一期先聚焦：注册邀请码、家庭协作、多孩子同步、好友码和串门互动。数学 / 识字 PK 和复杂联调诊断先放到二期。'
            : '注册邀请码已接入真实校验；接下来继续联动家庭邀请码、孩子同步和串门 / PK。';
        const sessionHtml = state.user ? `
            <div class="auth-session-card">
                <div>
                    <p class="auth-eyebrow">家长账号</p>
                    <h3>${escapeHtml(userLabel)}</h3>
                    <p class="auth-copy">${escapeHtml(sessionCopy)}</p>
                </div>
                <button class="btn-secondary" type="button" onclick="AuthSystem.signOut()">退出登录</button>
            </div>
        ` : `
            <div class="auth-tabs">
                <button class="auth-tab ${state.mode === 'signin' ? 'active' : ''}" type="button" onclick="AuthSystem.switchMode('signin')">登录家长账号</button>
                <button class="auth-tab ${state.mode === 'signup' ? 'active' : ''}" type="button" onclick="AuthSystem.switchMode('signup')">注册家长账号</button>
            </div>
            <form class="auth-form" onsubmit="return AuthSystem.handleSubmit(event)">
                <input class="text-input" type="email" name="email" placeholder="家长邮箱" required>
                <input class="text-input" type="password" name="password" placeholder="登录密码（至少 6 位）" minlength="6" required>
                <input class="text-input" type="text" name="parentName" placeholder="家长称呼（可选）">
                ${state.mode === 'signup' ? '<input class="text-input" type="text" name="inviteCode" placeholder="注册邀请码（首次部署的第一个家长可留空）">' : ''}
                <button class="btn-primary auth-submit" type="submit">${state.loading ? '提交中…' : (state.mode === 'signup' ? '注册并绑定家庭' : '登录并继续')}</button>
            </form>
        `;
        const configHtml = `
            <form class="auth-form auth-config-form" onsubmit="return AuthSystem.saveCloudConfig(event)">
                <div class="social-section-head">
                    <h4>云端配置</h4>
                    <span>${cloud.enabled ? '当前可连云端' : '先保存后启用'}</span>
                </div>
                <p class="auth-copy">当前来源：${escapeHtml(cloud.configSourceLabel || '未配置')}。手动保存会覆盖默认注入，清空后会回退到 cloud-config.local.js 或宿主页面配置。</p>
                ${cloud.runtimeConfigShadowedByPersisted ? '<div class="auth-notice auth-info">当前浏览器里手动保存的云端配置，正在覆盖默认注入的云端配置。</div>' : ''}
                <input class="text-input" type="url" name="supabaseUrl" placeholder="Supabase URL" value="${escapeHtml(config.supabaseUrl || '')}">
                <input class="text-input" type="password" name="supabaseAnonKey" placeholder="Supabase anon key" value="${escapeHtml(config.supabaseAnonKey || '')}">
                <input class="text-input" type="url" name="siteUrl" placeholder="Site URL（可选，例如 http://127.0.0.1:5500）" value="${escapeHtml(config.siteUrl || '')}">
                <div class="household-actions">
                    <button class="btn-primary auth-submit" type="submit">保存云端配置</button>
                    <button class="btn-secondary household-action-btn" type="button" onclick="AuthSystem.clearCloudConfig()">清空云端配置</button>
                </div>
            </form>
        `;
        const registrationInviteHtml = renderRegistrationInvites();

        return `
            <section class="auth-shell">
                <div class="auth-shell-head">
                    <div>
                        <p class="auth-eyebrow">家庭账号云端接入</p>
                        <h3>家长账号与多孩子数据</h3>
                    </div>
                    <span class="auth-badge ${cloud.enabled ? 'online' : 'offline'}">${cloud.enabled ? '云端已配置' : '本地模式'}</span>
                </div>
                <p class="auth-copy">${escapeHtml(getStatusCopy())}</p>
                ${sessionHtml}
                ${configHtml}
                ${registrationInviteHtml}
                ${state.info ? `<div class="auth-notice auth-info">${escapeHtml(state.info)}</div>` : ''}
                ${state.error ? `<div class="auth-notice auth-error">${escapeHtml(state.error)}</div>` : ''}
                <div class="auth-footnote">
                    <span>当前阶段：</span>
                    <span>${escapeHtml(footnoteCopy)}</span>
                </div>
            </section>
        `;
    }

    function render(containerId) {
        const mountId = containerId || 'auth-root';
        const mount = document.getElementById(mountId);
        if (!mount) return;
        mount.innerHTML = renderAuthCard();
        if (window.HouseholdSystem && typeof window.HouseholdSystem.renderSummary === 'function') {
            window.HouseholdSystem.renderSummary('household-root');
        }
        if (window.SocialSystem && typeof window.SocialSystem.renderSettingsPanel === 'function') {
            window.SocialSystem.renderSettingsPanel('social-root');
        }
    }

    async function boot() {
        if (state.booted) {
            render();
            return state;
        }

        state.booted = true;
        state.status = 'booting';
        render();

        const client = getClient();
        if (!client) {
            state.status = 'local-only';
            render();
            return state;
        }

        try {
            const result = await client.auth.getSession();
            if (result && result.error) throw result.error;
            applySession(result && result.data ? result.data.session : null);
            state.status = 'ready';
            if (state.user) {
                await claimRegistrationInvite().catch(function () {});
                await refreshRegistrationInvites().catch(function () {});
            }

            if (!authSubscription) {
                const subscription = client.auth.onAuthStateChange(function (_event, session) {
                    applySession(session);
                    if (!session) {
                        state.claimedInviteCode = '';
                        state.registrationInvites = [];
                    } else {
                        void claimRegistrationInvite().catch(function () {});
                        void refreshRegistrationInvites().catch(function () {});
                    }
                    render();
                });
                authSubscription = subscription && subscription.data ? subscription.data.subscription : null;
            }
        } catch (error) {
            state.status = 'error';
            state.error = error && error.message ? error.message : '云端账号初始化失败';
        }

        render();
        if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
            void window.HouseholdSystem.refresh('household-root');
        }
        if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh();
        }
        return state;
    }

    function switchMode(mode) {
        state.mode = mode === 'signup' ? 'signup' : 'signin';
        state.error = '';
        state.info = '';
        render();
        return false;
    }

    async function handleSubmit(event) {
        event.preventDefault();
        state.error = '';
        state.info = '';

        const client = getClient();
        if (!client) {
            state.error = '当前还没有配置云端账号，请先注入 Supabase 配置。';
            render();
            return false;
        }

        const form = event.target;
        const formData = new FormData(form);
        const email = String(formData.get('email') || '').trim();
        const password = String(formData.get('password') || '').trim();
        const parentName = String(formData.get('parentName') || '').trim();
        const inviteCode = normalizeInviteCode(formData.get('inviteCode'));
        let inviteValidation = null;
        let restoreResult = null;

        state.loading = true;
        render();

        try {
            let result;
            if (state.mode === 'signup') {
                inviteValidation = await validateRegistrationInvite(inviteCode);
                const metadata = {
                    parent_name: parentName
                };
                if (inviteCode) {
                    metadata.registration_invite_code = inviteCode;
                }
                result = await client.auth.signUp({
                    email,
                    password,
                    options: {
                        data: metadata
                    }
                });
                state.info = inviteValidation && inviteValidation.bootstrapAllowed
                    ? '首个家长账号注册请求已提交。登录后可先创建家庭，再签发后续家长的邀请码。'
                    : '注册请求已提交。邀请码会在首次成功登录时自动核销。';
            } else {
                result = await client.auth.signInWithPassword({
                    email,
                    password
                });
                state.info = '登录成功，已准备好接入家庭和孩子数据。';
            }

            if (result && result.error) throw result.error;
            applySession(result && result.data ? (result.data.session || null) : null);
            if (state.mode === 'signin' && !state.user && result && result.data && result.data.user) {
                state.user = result.data.user;
            }
            if (state.user) {
                await claimRegistrationInvite().catch(function () {});
                await refreshRegistrationInvites().catch(function () {});
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '账号操作失败';
        } finally {
            state.loading = false;
            render();
        }

        if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
            await window.HouseholdSystem.refresh('household-root');
        }
        if (window.CloudRestore && typeof window.CloudRestore.hydrateFromCloud === 'function') {
            restoreResult = await window.CloudRestore.hydrateFromCloud().catch(function () {
                return null;
            });
        }
        if (restoreResult && (restoreResult.restoredCount > 0 || restoreResult.activatedProfileId)) {
            state.info = '登录成功，已从云端恢复孩子档案，正在刷新本地视图…';
            render();
            setTimeout(function () {
                location.reload();
            }, 20);
            return false;
        }
        if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh();
        }

        return false;
    }

    async function signOut() {
        const client = getClient();
        if (!client) return false;

        state.error = '';
        state.info = '';
        try {
            const result = await client.auth.signOut();
            if (result && result.error) throw result.error;
            applySession(null);
            state.claimedInviteCode = '';
            state.registrationInvites = [];
            state.info = '已退出云端账号，当前仍可继续使用本地孩子档案。';
        } catch (error) {
            state.error = error && error.message ? error.message : '退出登录失败';
        }
        render();
        if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
            void window.HouseholdSystem.refresh('household-root');
        }
        if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
            void window.SocialSystem.refresh();
        }
        return false;
    }

    async function issueRegistrationInvite(event) {
        event.preventDefault();
        state.error = '';
        state.info = '';

        const client = getClient();
        if (!client || !state.user) {
            state.error = '请先登录家长账号，再签发注册邀请码。';
            render();
            return false;
        }

        const formData = new FormData(event.target);
        const label = String(formData.get('label') || '').trim();
        const expiresDays = Number(formData.get('expiresDays') || 30);
        const householdState = getHouseholdState();
        const householdId = householdState && householdState.primaryHouseholdId
            ? householdState.primaryHouseholdId
            : '';

        state.inviteLoading = true;
        render();
        try {
            const result = await client.functions.invoke('issue-registration-invite', {
                body: {
                    label: label,
                    expiresDays: expiresDays,
                    householdId: householdId
                }
            });
            if (result && result.error) throw result.error;
            const invite = result && result.data ? result.data.invite : null;
            state.info = invite && invite.invite_code
                ? '注册邀请码已签发：' + invite.invite_code
                : '注册邀请码已签发。';
            event.target.reset();
            await refreshRegistrationInvites();
        } catch (error) {
            state.error = error && error.message ? error.message : '签发注册邀请码失败';
        } finally {
            state.inviteLoading = false;
            render();
        }

        return false;
    }

    async function revokeRegistrationInvite(inviteId) {
        state.error = '';
        state.info = '';

        const client = getClient();
        if (!client || !state.user) {
            state.error = '请先登录家长账号，再撤销注册邀请码。';
            render();
            return false;
        }

        if (!inviteId) {
            state.error = '要撤销的邀请码不存在。';
            render();
            return false;
        }

        const confirmed = confirm('撤销后，这个注册邀请码将不能再用于新家长注册。确定继续吗？');
        if (!confirmed) {
            state.info = '已取消撤销操作。';
            render();
            return false;
        }

        state.inviteLoading = true;
        render();
        try {
            const result = await client.functions.invoke('revoke-registration-invite', {
                body: { inviteId: inviteId }
            });
            if (result && result.error) throw result.error;
            state.info = result && result.data && result.data.inviteCode
                ? '注册邀请码已撤销：' + result.data.inviteCode
                : '注册邀请码已撤销。';
            await refreshRegistrationInvites();
        } catch (error) {
            state.error = error && error.message ? error.message : '撤销注册邀请码失败';
        } finally {
            state.inviteLoading = false;
            render();
        }

        return false;
    }

    async function saveCloudConfig(event) {
        event.preventDefault();
        state.error = '';
        state.info = '';

        if (!window.CloudClient || typeof window.CloudClient.saveConfig !== 'function') {
            state.error = '云端配置器尚未就绪。';
            render();
            return false;
        }

        const formData = new FormData(event.target);
        const supabaseUrl = String(formData.get('supabaseUrl') || '').trim();
        const supabaseAnonKey = String(formData.get('supabaseAnonKey') || '').trim();
        const siteUrl = String(formData.get('siteUrl') || '').trim();

        if (!supabaseUrl || !supabaseAnonKey) {
            state.error = '请至少填写 Supabase URL 和 anon key。';
            render();
            return false;
        }

        window.CloudClient.saveConfig({
            supabaseUrl: supabaseUrl,
            supabaseAnonKey: supabaseAnonKey,
            siteUrl: siteUrl
        });

        cleanupSubscription();
        applySession(null);
        state.claimedInviteCode = '';
        state.registrationInvites = [];
        state.booted = false;
        state.info = '云端配置已保存，正在重新连接 Supabase…';
        render();
        await boot();
        state.info = '云端配置已保存，可继续注册或登录家长账号。';
        render();
        return false;
    }

    async function clearCloudConfig() {
        state.error = '';
        state.info = '';

        if (!window.CloudClient || typeof window.CloudClient.clearConfig !== 'function') {
            state.error = '云端配置器尚未就绪。';
            render();
            return false;
        }

        cleanupSubscription();
        window.CloudClient.clearConfig();
        applySession(null);
        state.claimedInviteCode = '';
        state.registrationInvites = [];
        state.booted = false;
        state.status = 'idle';
        state.info = '本地保存的云端配置已清空，当前回到本地模式。';
        render();
        await boot();
        return false;
    }

    window.AuthSystem = {
        boot,
        render,
        switchMode,
        handleSubmit,
        saveCloudConfig,
        clearCloudConfig,
        refreshRegistrationInvites,
        issueRegistrationInvite,
        revokeRegistrationInvite,
        signOut,
        getState() {
            return Object.assign({}, state, {
                session: state.session,
                user: state.user
            });
        }
    };
})();
