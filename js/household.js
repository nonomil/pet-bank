(function () {
    'use strict';

    const state = {
        loading: false,
        info: '',
        error: '',
        lastAcceptedInviteCode: '',
        activeInvite: null,
        households: [],
        primaryHousehold: null,
        primaryHouseholdId: '',
        cloudChildren: [],
        householdInvites: []
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
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

    function getLocalProfiles() {
        return window.ProfileSync && typeof window.ProfileSync.exportLocalProfiles === 'function'
            ? window.ProfileSync.exportLocalProfiles()
            : [];
    }

    function getActiveLocalProfile() {
        return window.ProfileManager && typeof window.ProfileManager.getActive === 'function'
            ? window.ProfileManager.getActive()
            : null;
    }

    function findLocalProfile(profileId) {
        return getLocalProfiles().find(function (profile) {
            return profile.id === profileId;
        }) || null;
    }

    function randomUuid() {
        if (window.crypto && typeof window.crypto.randomUUID === 'function') {
            return window.crypto.randomUUID();
        }
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (char) {
            const random = Math.random() * 16 | 0;
            const value = char === 'x' ? random : (random & 0x3 | 0x8);
            return value.toString(16);
        });
    }

    function getParentDisplayName(user) {
        if (!user) return '我的家庭';
        const parentName = user.user_metadata && user.user_metadata.parent_name;
        if (parentName) return String(parentName).trim() + '一家';
        if (user.email) return String(user.email).split('@')[0] + '一家';
        return '我的家庭';
    }

    function formatTime(value) {
        if (!value) return '刚刚';
        try {
            return new Date(value).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '刚刚';
        }
    }

    function applyCloudState(households, children, activeInvite, householdInvites) {
        state.households = households || [];
        state.primaryHousehold = state.households.length ? state.households[0] : null;
        state.primaryHouseholdId = state.primaryHousehold ? state.primaryHousehold.id : '';
        state.cloudChildren = children || [];
        state.activeInvite = activeInvite || null;
        state.householdInvites = householdInvites || [];
    }

    async function loadCloudState() {
        const client = getClient();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;

        if (!client || !user) {
            applyCloudState([], [], null, []);
            return state;
        }

        const accountResult = await client.from('accounts').upsert({
            id: user.id,
            email: user.email || null,
            parent_name: user.user_metadata && user.user_metadata.parent_name
                ? user.user_metadata.parent_name
                : null
        });
        if (accountResult.error) throw accountResult.error;

        const householdResult = await client
            .from('households')
            .select('id,name,owner_account_id,created_at')
            .order('created_at', { ascending: true });

        if (householdResult.error) throw householdResult.error;

        const households = householdResult.data || [];
        let children = [];
        let activeInvite = null;
        let householdInvites = [];
        if (households.length) {
            const childResult = await client
                .from('child_profiles')
                .select('id,household_id,local_profile_id,display_name,emoji,friend_code,home_visibility,visit_access,pk_access,pet_summary_json,home_summary_json,last_synced_at,created_at')
                .eq('household_id', households[0].id)
                .order('created_at', { ascending: true });

            if (childResult.error) throw childResult.error;
            children = childResult.data || [];

            const inviteResult = await client
                .from('household_invites')
                .select('id,invite_code,status,role,expires_at,created_at')
                .eq('household_id', households[0].id)
                .order('created_at', { ascending: false })
                .limit(6);

            if (inviteResult.error) throw inviteResult.error;
            householdInvites = inviteResult.data || [];
            activeInvite = householdInvites.find(function (invite) {
                return invite && invite.status === 'pending';
            }) || null;
        }

        applyCloudState(households, children, activeInvite, householdInvites);
        return state;
    }

    function renderProfileList(profiles) {
        if (!profiles.length) {
            return '<div class="household-empty">当前还没有可导出的本地孩子档案。</div>';
        }

        const cloudByLocalId = new Map(state.cloudChildren.map(function (child) {
            return [child.local_profile_id, child];
        }));

        return `
            <div class="household-child-list">
                ${profiles.map(function (profile) {
                    const cloudChild = cloudByLocalId.get(profile.id);
                    return `
                        <div class="household-child-card">
                            <div class="household-child-emoji">${escapeHtml(profile.emoji || '🧒')}</div>
                            <div class="household-child-copy">
                                <strong>${escapeHtml(profile.name)}</strong>
                                <span>${cloudChild
                                    ? '已同步云端 · 好友码 ' + escapeHtml(cloudChild.friend_code || '待生成') + ' · ' + escapeHtml(cloudChild.home_visibility === 'private' ? '仅家庭可见' : '好友可见')
                                    : (profile.isActive ? '当前孩子待同步' : '待同步孩子') + ' · ' + profile.businessKeyCount + ' 项本地数据'}</span>
                                ${cloudChild && cloudChild.last_synced_at ? `<span>最近同步：${escapeHtml(new Date(cloudChild.last_synced_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))}</span>` : ''}
                            </div>
                            <div class="household-child-actions">
                                <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.syncProfile('${profile.id}')">${cloudChild ? '重新同步' : '同步到云端'}</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderIssuedInvite(canIssueInvite) {
        if (!state.primaryHouseholdId) return '';

        const invite = state.activeInvite;
        const historyHtml = state.householdInvites.length ? `
            <div class="auth-invite-list">
                ${state.householdInvites.map(function (row) {
                    return `
                        <div class="household-issued-invite-card auth-registration-invite-card">
                            <div class="household-issued-invite-copy">
                                <strong>${escapeHtml(row.invite_code)}</strong>
                                <span>${escapeHtml(row.status || 'pending')} · 截止 ${escapeHtml(formatTime(row.expires_at))}</span>
                            </div>
                            ${row.status === 'pending' && canIssueInvite ? `
                                <div class="household-actions household-actions-compact">
                                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.revokeInvite('${row.id}')">撤销邀请码</button>
                                </div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
        ` : '';
        const bodyHtml = invite ? `
            <div class="household-issued-invite-card">
                <div class="household-issued-invite-copy">
                    <strong>家庭邀请码 ${escapeHtml(invite.invite_code)}</strong>
                    <span>状态 ${escapeHtml(invite.status || 'pending')} · 截止 ${escapeHtml(formatTime(invite.expires_at))}</span>
                </div>
                <div class="household-actions household-actions-compact">
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.copyInviteCode()">复制邀请码</button>
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.issueInvite()" ${canIssueInvite ? '' : 'disabled'}>重新生成</button>
                </div>
            </div>
        ` : `
            <div class="household-empty">当前还没有可分享的家庭邀请码。生成后，另一位家长就能加入同一个家庭。</div>
            <div class="household-actions household-actions-compact">
                <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.issueInvite()" ${canIssueInvite ? '' : 'disabled'}>生成家庭邀请码</button>
            </div>
        `;

        return `
            <div class="household-issued-invite-shell">
                <div class="social-section-head">
                    <h4>协作家长家庭邀请码</h4>
                    <span>${canIssueInvite ? '仅家庭创建者可签发' : '等待家庭创建者签发'}</span>
                </div>
                ${bodyHtml}
                ${historyHtml}
            </div>
        `;
    }

    function getRestoreState() {
        return window.CloudRestore && typeof window.CloudRestore.getState === 'function'
            ? window.CloudRestore.getState()
            : {};
    }

    function getCloudSyncState() {
        return window.CloudSync && typeof window.CloudSync.getState === 'function'
            ? window.CloudSync.getState()
            : {};
    }

    function getCloudSyncOutcomeLabel(outcome) {
        return window.CloudSync && typeof window.CloudSync.getOutcomeLabel === 'function'
            ? window.CloudSync.getOutcomeLabel(outcome)
            : (outcome || '待命');
    }

    function getCloudSyncReasonLabel(reason) {
        return window.CloudSync && typeof window.CloudSync.getReasonLabel === 'function'
            ? window.CloudSync.getReasonLabel(reason)
            : (reason || '未记录');
    }

    function getCloudSyncStepLabel(step) {
        return window.CloudSync && typeof window.CloudSync.getStepLabel === 'function'
            ? window.CloudSync.getStepLabel(step)
            : (step || '未记录');
    }

    function reportCloudSyncStatus(patch) {
        if (window.CloudSync && typeof window.CloudSync.reportSyncStatus === 'function') {
            window.CloudSync.reportSyncStatus(patch);
        }
    }

    function renderSyncStatusPanel(canUseInvite, activeProfile) {
        const syncState = getCloudSyncState();
        const outcome = syncState.lastOutcome || (syncState.syncing ? 'syncing' : 'idle');
        const reasonCode = syncState.pendingReason || syncState.lastReason || syncState.lastOutcomeReason || '';
        const retryDisabled = !(canUseInvite && activeProfile);
        const lastLocalProfile = syncState.lastLocalProfileId || (activeProfile ? activeProfile.id : '');
        const snapshotMode = syncState.lastPersistedSnapshot ? '已写入 pet_state_snapshots' : '仅更新摘要';

        return `
            <div class="household-issued-invite-shell">
                <div class="social-section-head">
                    <h4>最近一次云端同步</h4>
                    <span class="cloud-sync-badge cloud-sync-badge-${escapeHtml(outcome)}">${escapeHtml(getCloudSyncOutcomeLabel(outcome))}</span>
                </div>
                <div class="cloud-diagnostics-kv">
                    <span>最近原因</span><code>${escapeHtml(getCloudSyncReasonLabel(reasonCode))}</code>
                    <span>最近步骤</span><code>${escapeHtml(getCloudSyncStepLabel(syncState.lastStep || 'idle'))}</code>
                    <span>本地孩子</span><code>${escapeHtml(lastLocalProfile || '未记录')}</code>
                    <span>云端孩子</span><code>${escapeHtml(syncState.lastKnownChildId || '未定位')}</code>
                    <span>最近排队</span><code>${escapeHtml(syncState.pendingQueuedAt ? formatTime(syncState.pendingQueuedAt) : '未排队')}</code>
                    <span>最近尝试</span><code>${escapeHtml(syncState.lastAttemptedAt ? formatTime(syncState.lastAttemptedAt) : '未尝试')}</code>
                    <span>最近成功</span><code>${escapeHtml(syncState.lastSucceededAt ? formatTime(syncState.lastSucceededAt) : '尚未成功')}</code>
                    <span>最近失败</span><code>${escapeHtml(syncState.lastFailedAt ? formatTime(syncState.lastFailedAt) : '暂无失败')}</code>
                    <span>快照写入</span><code>${escapeHtml(snapshotMode)}</code>
                    <span>同步详情</span><code>${escapeHtml(syncState.info || syncState.error || '当前没有额外提示')}</code>
                </div>
                <div class="household-actions household-actions-compact">
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.syncActiveChild()" ${retryDisabled ? 'disabled' : ''}>立即重试当前孩子</button>
                </div>
            </div>
        `;
    }

    function renderCloudRestorePanel(canUseRestore) {
        const restoreState = getRestoreState();
        const statusCopy = restoreState.lastHydratedAt
            ? '最近恢复：' + escapeHtml(formatTime(restoreState.lastHydratedAt))
            : '当前还没有执行过手动恢复';

        return `
            <div class="household-issued-invite-shell">
                <div class="social-section-head">
                    <h4>云端档案恢复</h4>
                    <span>${statusCopy}</span>
                </div>
                <div class="household-empty">
                    在另一台设备登录后，如果本地还没有对应孩子档案，可以先“从云端导入孩子档案”；如果想直接用云端快照覆盖当前本地数据，再用“用云端覆盖本地数据”。
                </div>
                <div class="household-actions household-actions-compact">
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.restoreFromCloud('safe')" ${canUseRestore ? '' : 'disabled'}>从云端导入孩子档案</button>
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.restoreFromCloud('overwrite')" ${canUseRestore ? '' : 'disabled'}>用云端覆盖本地数据</button>
                </div>
            </div>
        `;
    }

    function renderSummary(containerId) {
        const mount = document.getElementById(containerId || 'household-root');
        if (!mount) return;

        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;
        const profiles = getLocalProfiles();
        const canUseInvite = Boolean(authState && authState.user && getClient());
        const canUseRestore = Boolean(
            canUseInvite
            && window.CloudRestore
            && typeof window.CloudRestore.hydrateFromCloud === 'function'
        );
        const activeProfile = getActiveLocalProfile();
        const canIssueInvite = Boolean(
            canUseInvite
            && state.primaryHouseholdId
            && state.primaryHousehold
            && user
            && state.primaryHousehold.owner_account_id === user.id
        );

        mount.innerHTML = `
            <section class="household-shell">
                <div class="household-shell-head">
                    <div>
                        <p class="auth-eyebrow">家庭与多孩子基础层</p>
                        <h3>家庭、邀请码和孩子同步预备区</h3>
                    </div>
                    <span class="auth-badge ${canUseInvite ? 'online' : 'offline'}">${canUseInvite ? '云端家庭可用' : '等待云端登录'}</span>
                </div>
                <p class="auth-copy">先建立家庭，再把当前孩子同步成云端档案。这样后面才能接好友码、串门和同题异步 PK。</p>
                <div class="household-summary-grid">
                    <div class="household-metric">
                        <span class="household-metric-label">云端家庭</span>
                        <strong>${state.households.length}</strong>
                    </div>
                    <div class="household-metric">
                        <span class="household-metric-label">已同步孩子</span>
                        <strong>${state.cloudChildren.length}</strong>
                    </div>
                    <div class="household-metric">
                        <span class="household-metric-label">最近接收邀请码</span>
                        <strong>${escapeHtml(state.lastAcceptedInviteCode || '暂无')}</strong>
                    </div>
                </div>
                <div class="household-actions">
                    <button class="btn-primary household-action-btn" type="button" onclick="HouseholdSystem.ensurePrimaryHousehold()" ${canUseInvite ? '' : 'disabled'}>${state.primaryHouseholdId ? '已有家庭：' + escapeHtml(state.primaryHousehold.name) : '创建我的家庭'}</button>
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.syncActiveChild()" ${(canUseInvite && state.primaryHouseholdId && activeProfile) ? '' : 'disabled'}>同步当前孩子到云端</button>
                    <button class="btn-secondary household-action-btn" type="button" onclick="HouseholdSystem.syncAllChildren()" ${(canUseInvite && activeProfile) ? '' : 'disabled'}>同步全部孩子到云端</button>
                </div>
                ${renderSyncStatusPanel(canUseInvite, activeProfile)}
                ${renderIssuedInvite(canIssueInvite)}
                ${renderCloudRestorePanel(canUseRestore)}
                ${renderProfileList(profiles)}
                <form class="household-invite-form" onsubmit="return HouseholdSystem.acceptInvite(event)">
                    <input class="text-input" type="text" name="inviteCode" placeholder="输入家庭邀请码（如：HOME-8K2F）" ${canUseInvite ? '' : 'disabled'}>
                    <button class="btn-secondary" type="submit" ${canUseInvite ? '' : 'disabled'}>加入已有家庭</button>
                </form>
                ${state.loading ? '<div class="auth-notice auth-info">正在刷新家庭与孩子云端状态…</div>' : ''}
                ${state.info ? `<div class="auth-notice auth-info">${escapeHtml(state.info)}</div>` : ''}
                ${state.error ? `<div class="auth-notice auth-error">${escapeHtml(state.error)}</div>` : ''}
            </section>
        `;
    }

    async function refresh(containerId) {
        state.error = '';
        state.loading = true;
        renderSummary(containerId);
        try {
            await loadCloudState();
            state.error = '';
        } catch (error) {
            state.error = error && error.message ? error.message : '家庭状态刷新失败';
        } finally {
            state.loading = false;
            renderSummary(containerId);
        }
        return state;
    }

    async function ensurePrimaryHousehold() {
        state.info = '';
        state.error = '';
        renderSummary();

        const client = getClient();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;
        if (!client || !user) {
            state.error = '请先配置云端并登录家长账号，再创建家庭。';
            renderSummary();
            return false;
        }

        if (state.primaryHouseholdId) {
            state.info = '当前已经有家庭：' + state.primaryHousehold.name;
            renderSummary();
            return false;
        }

        const householdId = randomUuid();
        const householdName = getParentDisplayName(user);

        try {
            const accountResult = await client.from('accounts').upsert({
                id: user.id,
                email: user.email || null,
                parent_name: user.user_metadata && user.user_metadata.parent_name
                    ? user.user_metadata.parent_name
                    : null
            });
            if (accountResult.error) throw accountResult.error;

            const householdResult = await client.from('households').insert({
                id: householdId,
                name: householdName,
                owner_account_id: user.id
            });
            if (householdResult.error) throw householdResult.error;

            const memberResult = await client.from('household_members').insert({
                household_id: householdId,
                account_id: user.id,
                role: 'owner',
                status: 'active'
            });
            if (memberResult.error) throw memberResult.error;

            state.info = '家庭已创建，接下来可以把当前孩子同步到云端。';
            await refresh('household-root');
        } catch (error) {
            state.error = error && error.message ? error.message : '创建家庭失败';
            renderSummary('household-root');
        }

        return false;
    }

    async function restoreFromCloud(mode) {
        state.info = '';
        state.error = '';
        renderSummary('household-root');

        if (!window.CloudRestore || typeof window.CloudRestore.hydrateFromCloud !== 'function') {
            state.error = '云端档案恢复器尚未就绪。';
            renderSummary('household-root');
            return false;
        }

        const overwriteExisting = mode === 'overwrite';
        if (overwriteExisting) {
            const confirmed = confirm('这会用云端最新快照覆盖当前本地孩子档案。建议先确认云端数据正确，再继续覆盖。确定继续吗？');
            if (!confirmed) {
                state.info = '已取消云端覆盖，本地数据保持不变。';
                renderSummary('household-root');
                return false;
            }
        }

        try {
            const result = overwriteExisting
                ? await window.CloudRestore.hydrateFromCloud({ overwriteExisting: true })
                : await window.CloudRestore.hydrateFromCloud({ overwriteExisting: false });

            if (result && result.skipped) {
                state.info = result.reason === 'no_cloud_children'
                    ? '当前账号下还没有可恢复的云端孩子档案。'
                    : '当前还不能执行云端恢复，请先登录家长账号并连接家庭。';
                renderSummary('household-root');
                return false;
            }

            if (window.ProfileUI && typeof window.ProfileUI.render === 'function') {
                window.ProfileUI.render();
            }
            if (window.SettingsPage && typeof window.SettingsPage.render === 'function') {
                window.SettingsPage.render();
            }

            await refresh('household-root');
            if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
                await window.SocialSystem.refresh();
            }
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }

            if (result && result.restoredCount > 0) {
                state.info = overwriteExisting
                    ? '已用云端快照覆盖本地档案，正在刷新页面…'
                    : '已从云端恢复孩子档案，正在刷新页面…';
                renderSummary('household-root');
                setTimeout(function () {
                    location.reload();
                }, 20);
                return false;
            }

            state.info = result && result.cloudChildCount
                ? '已从云端导入 ' + result.cloudChildCount + ' 个孩子档案入口。'
                : '当前没有新的云端孩子档案需要导入。';
        } catch (error) {
            state.error = error && error.message ? error.message : '云端档案恢复失败';
        }

        renderSummary('household-root');
        if (window.CloudDiagnostics && typeof window.CloudDiagnostics.refresh === 'function') {
            void window.CloudDiagnostics.refresh('diagnostics-root');
        }
        return false;
    }

    async function syncProfile(profileId, options) {
        const config = Object.assign({
            refreshViews: true,
            silent: false
        }, options || {});

        if (!config.silent) {
            state.info = '';
            state.error = '';
            renderSummary('household-root');
        }

        const client = getClient();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;
        const targetProfile = findLocalProfile(profileId);
        const activeProfile = getActiveLocalProfile();

        if (!client || !user) {
            throw new Error('请先登录家长账号，再同步孩子。');
        }

        if (!targetProfile) {
            throw new Error('要同步的孩子档案不存在。');
        }

        if (!state.primaryHouseholdId) {
            await ensurePrimaryHousehold();
            if (!state.primaryHouseholdId) {
                throw new Error('家庭创建失败，无法继续同步孩子。');
            }
        }
        reportCloudSyncStatus({
            syncing: true,
            info: '',
            error: '',
            lastReason: 'manual_sync',
            lastOutcome: 'syncing',
            lastOutcomeReason: '',
            lastAttemptedAt: new Date().toISOString(),
            pendingReason: '',
            pendingQueuedAt: '',
            lastLocalProfileId: targetProfile.id,
            lastKnownChildId: '',
            lastPersistedSnapshot: true,
            lastStep: 'updating_child'
        });

        try {
            const childResult = await client
                .from('child_profiles')
                .upsert({
                    household_id: state.primaryHouseholdId,
                    local_profile_id: targetProfile.id,
                    display_name: targetProfile.name,
                    emoji: targetProfile.emoji || '🧒'
                }, {
                    onConflict: 'household_id,local_profile_id'
                })
                .select('id,display_name,friend_code')
                .single();

            if (childResult.error) throw childResult.error;

            reportCloudSyncStatus({
                lastKnownChildId: childResult.data.id
            });

            if (activeProfile && activeProfile.id === targetProfile.id && window.CloudSync && typeof window.CloudSync.syncActiveChildState === 'function') {
                await window.CloudSync.syncActiveChildState('manual_sync', {
                    knownChildId: childResult.data.id,
                    persistSnapshot: true,
                    refreshViews: false
                });
            } else {
                const summary = window.ProfileSync && typeof window.ProfileSync.buildCloudChildSummary === 'function'
                    ? window.ProfileSync.buildCloudChildSummary(targetProfile.id)
                    : null;
                if (!summary) {
                    throw new Error('本地孩子快照解析失败，无法同步到云端。');
                }

                const now = new Date().toISOString();
                const updateResult = await client
                    .from('child_profiles')
                    .update({
                        pet_summary_json: summary.petSummaryJson,
                        home_summary_json: summary.homeSummaryJson,
                        last_synced_at: now
                    })
                    .eq('id', childResult.data.id);

                if (updateResult.error) throw updateResult.error;

                reportCloudSyncStatus({
                    lastStep: 'writing_snapshot'
                });

                const snapshotResult = await client
                    .from('pet_state_snapshots')
                    .insert({
                        child_id: childResult.data.id,
                        pet_species_id: summary.petSpeciesId,
                        pet_name: summary.petName,
                        payload_json: summary.snapshotPayload,
                        source: 'manual_sync',
                        created_by_account_id: user.id
                    });

                if (snapshotResult.error) throw snapshotResult.error;

                reportCloudSyncStatus({
                    syncing: false,
                    info: '已同步当前孩子的小屋与宠物摘要',
                    error: '',
                    lastSyncedAt: now,
                    lastSucceededAt: now,
                    lastOutcome: 'success',
                    lastOutcomeReason: '',
                    lastStep: 'done'
                });
            }

            if (!config.silent) {
                state.info = '孩子「' + targetProfile.name + '」已同步到云端，好友码：' + childResult.data.friend_code;
            }

            if (config.refreshViews) {
                await refresh('household-root');
                if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
                    await window.SocialSystem.refresh();
                }
            }

            return childResult.data;
        } catch (error) {
            reportCloudSyncStatus({
                syncing: false,
                error: error && error.message ? error.message : '同步当前孩子失败',
                lastOutcome: 'error',
                lastOutcomeReason: 'cloud_sync_failed',
                lastFailedAt: new Date().toISOString(),
                lastStep: 'error'
            });
            throw error;
        }
    }

    async function syncActiveChild() {
        const activeProfile = getActiveLocalProfile();
        if (!activeProfile) {
            state.info = '';
            state.error = '请先选择一个本地孩子档案。';
            renderSummary('household-root');
            return false;
        }

        try {
            await syncProfile(activeProfile.id, { refreshViews: true, silent: false });
        } catch (error) {
            state.error = error && error.message ? error.message : '同步当前孩子失败';
            renderSummary('household-root');
        }

        return false;
    }

    async function syncAllChildren() {
        state.info = '';
        state.error = '';
        renderSummary('household-root');

        const profiles = getLocalProfiles();
        if (!profiles.length) {
            state.error = '当前没有可同步的本地孩子档案。';
            renderSummary('household-root');
            return false;
        }

        try {
            let syncedCount = 0;
            for (const profile of profiles) {
                await syncProfile(profile.id, {
                    refreshViews: false,
                    silent: true
                });
                syncedCount += 1;
            }
            state.info = '已把 ' + syncedCount + ' 个孩子同步到同一个云端家庭。';
            await refresh('household-root');
            if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
                await window.SocialSystem.refresh();
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '同步全部孩子失败';
            renderSummary('household-root');
        }

        return false;
    }

    async function acceptInvite(event) {
        event.preventDefault();
        state.info = '';
        state.error = '';

        const client = getClient();
        if (!client) {
            state.error = '请先配置云端并登录家长账号，再接收家庭邀请码。';
            renderSummary('household-root');
            return false;
        }

        const formData = new FormData(event.target);
        const inviteCode = String(formData.get('inviteCode') || '').trim().toUpperCase();
        if (!inviteCode) {
            state.error = '请输入家庭邀请码。';
            renderSummary('household-root');
            return false;
        }

        try {
            const result = await client.functions.invoke('accept-household-invite', {
                body: { inviteCode: inviteCode }
            });
            if (result && result.error) throw result.error;
            state.lastAcceptedInviteCode = inviteCode;
            state.info = '邀请码已接受。接下来可以把当前孩子同步到这个家庭下。';
            await refresh('household-root');
        } catch (error) {
            state.error = error && error.message ? error.message : '家庭邀请码接收失败';
            renderSummary('household-root');
        }

        return false;
    }

    async function issueInvite() {
        state.info = '';
        state.error = '';
        renderSummary('household-root');

        const client = getClient();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;

        if (!client || !user) {
            state.error = '请先登录家长账号，再生成家庭邀请码。';
            renderSummary('household-root');
            return false;
        }

        if (!state.primaryHouseholdId) {
            state.error = '请先创建家庭，再邀请另一位家长加入。';
            renderSummary('household-root');
            return false;
        }

        try {
            const result = await client.functions.invoke('issue-household-invite', {
                body: {
                    householdId: state.primaryHouseholdId
                }
            });
            if (result && result.error) throw result.error;
            const invite = result && result.data ? result.data.invite : null;
            state.activeInvite = invite || null;
            state.info = invite && invite.invite_code
                ? '家庭邀请码已生成：' + invite.invite_code
                : '家庭邀请码已生成。';
            await refresh('household-root');
        } catch (error) {
            state.error = error && error.message ? error.message : '生成家庭邀请码失败';
            renderSummary('household-root');
        }

        return false;
    }

    async function copyInviteCode() {
        const inviteCode = state.activeInvite && state.activeInvite.invite_code
            ? state.activeInvite.invite_code
            : '';
        if (!inviteCode) {
            state.error = '当前还没有可复制的家庭邀请码。';
            renderSummary('household-root');
            return false;
        }

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(inviteCode);
                state.info = '家庭邀请码已复制到剪贴板。';
            } else {
                state.info = '当前浏览器不支持自动复制，请手动记下家庭邀请码：' + inviteCode;
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '复制家庭邀请码失败';
        }

        renderSummary('household-root');
        return false;
    }

    async function revokeInvite(inviteId) {
        state.info = '';
        state.error = '';
        renderSummary('household-root');

        const client = getClient();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;

        if (!client || !user) {
            state.error = '请先登录家长账号，再撤销家庭邀请码。';
            renderSummary('household-root');
            return false;
        }

        if (!inviteId) {
            state.error = '要撤销的家庭邀请码不存在。';
            renderSummary('household-root');
            return false;
        }

        const confirmed = confirm('撤销后，这个家庭邀请码将不能再用于加入当前家庭。确定继续吗？');
        if (!confirmed) {
            state.info = '已取消家庭邀请码撤销操作。';
            renderSummary('household-root');
            return false;
        }

        try {
            const result = await client.functions.invoke('revoke-household-invite', {
                body: { inviteId: inviteId }
            });
            if (result && result.error) throw result.error;
            state.info = result && result.data && result.data.inviteCode
                ? '家庭邀请码已撤销：' + result.data.inviteCode
                : '家庭邀请码已撤销。';
            await refresh('household-root');
        } catch (error) {
            state.error = error && error.message ? error.message : '撤销家庭邀请码失败';
            renderSummary('household-root');
        }

        return false;
    }

    window.HouseholdSystem = {
        renderSummary,
        refresh,
        acceptInvite,
        issueInvite,
        copyInviteCode,
        revokeInvite,
        syncProfile,
        ensurePrimaryHousehold,
        syncActiveChild,
        syncAllChildren,
        restoreFromCloud,
        getState() {
            return {
                loading: state.loading,
                info: state.info,
                error: state.error,
                lastAcceptedInviteCode: state.lastAcceptedInviteCode,
                activeInvite: state.activeInvite,
                households: state.households.slice(),
                primaryHouseholdId: state.primaryHouseholdId,
                primaryHousehold: state.primaryHousehold,
                cloudChildren: state.cloudChildren.slice(),
                householdInvites: state.householdInvites.slice()
            };
        }
    };
})();
