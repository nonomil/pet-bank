(function () {
    'use strict';

    const state = {
        loading: false,
        error: '',
        info: '',
        snapshot: null,
        lastRefreshedAt: '',
        lastCopiedAt: '',
        lastExportedAt: ''
    };
    const DEVICE_LABEL_KEY = 'petbank_diagnostics_device_label';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatTime(value) {
        if (!value) return '未记录';
        try {
            return new Date(value).toLocaleString('zh-CN', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (error) {
            return '未记录';
        }
    }

    function readDeviceLabel() {
        try {
            return String(localStorage.getItem(DEVICE_LABEL_KEY) || '').trim();
        } catch (error) {
            return '';
        }
    }

    function saveDeviceLabel(value) {
        try {
            const nextValue = String(value || '').trim();
            if (nextValue) {
                localStorage.setItem(DEVICE_LABEL_KEY, nextValue);
            } else {
                localStorage.removeItem(DEVICE_LABEL_KEY);
            }
        } catch (error) {}
    }

    function padTwo(value) {
        return String(value).padStart(2, '0');
    }

    function buildExportFileName(snapshot) {
        const generatedAt = snapshot && snapshot.generatedAt ? new Date(snapshot.generatedAt) : new Date();
        const datePart = [
            generatedAt.getFullYear(),
            padTwo(generatedAt.getMonth() + 1),
            padTwo(generatedAt.getDate())
        ].join('');
        const timePart = [
            padTwo(generatedAt.getHours()),
            padTwo(generatedAt.getMinutes()),
            padTwo(generatedAt.getSeconds())
        ].join('');
        const deviceLabel = snapshot && snapshot.device && snapshot.device.label
            ? String(snapshot.device.label).replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '-')
            : '';
        const emailPrefix = snapshot && snapshot.auth && snapshot.auth.email
            ? String(snapshot.auth.email).split('@')[0].replace(/[^a-zA-Z0-9_-]/g, '-')
            : 'guest';
        return 'petbank-cloud-diagnostics-'
            + (deviceLabel ? deviceLabel + '-' : '')
            + emailPrefix + '-'
            + datePart + '-' + timePart + '.json';
    }

    function getCloudStatus() {
        if (!window.CloudClient || typeof window.CloudClient.getStatus !== 'function') {
            return {
                enabled: false,
                hasSupabaseScript: false,
                hasClient: false,
                hasPersistedConfig: false,
                configSource: 'none',
                configSourceLabel: '未配置',
                siteUrl: '',
                supabaseUrl: ''
            };
        }
        return window.CloudClient.getStatus();
    }

    function getAuthState() {
        return window.AuthSystem && typeof window.AuthSystem.getState === 'function'
            ? window.AuthSystem.getState()
            : {};
    }

    function getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : {};
    }

    function getSocialState() {
        return window.SocialSystem && typeof window.SocialSystem.getState === 'function'
            ? window.SocialSystem.getState()
            : {};
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

    function getActivityState() {
        return window.ActivityFeedSystem && typeof window.ActivityFeedSystem.getState === 'function'
            ? window.ActivityFeedSystem.getState()
            : {};
    }

    function getPKState() {
        return window.PKService && typeof window.PKService.getState === 'function'
            ? window.PKService.getState()
            : {};
    }

    function getProfileSummary() {
        const manager = window.ProfileManager;
        const profiles = manager && typeof manager.list === 'function'
            ? manager.list()
            : [];
        const activeProfile = manager && typeof manager.getActive === 'function'
            ? manager.getActive()
            : null;

        return {
            totalProfiles: profiles.length,
            activeProfileId: activeProfile ? activeProfile.id : '',
            activeProfileName: activeProfile ? activeProfile.name : '',
            profiles: profiles.map(function (profile) {
                return {
                    id: profile.id,
                    name: profile.name,
                    emoji: profile.emoji || '🧒'
                };
            })
        };
    }

    function getHouseholdChildrenSummary(cloudChildren) {
        return (Array.isArray(cloudChildren) ? cloudChildren : []).map(function (child) {
            return {
                id: child.id,
                localProfileId: child.local_profile_id || '',
                displayName: child.display_name || '未命名孩子',
                emoji: child.emoji || '🧒',
                friendCode: child.friend_code || '',
                homeVisibility: child.home_visibility || 'friends',
                visitAccess: child.visit_access || 'friends',
                pkAccess: child.pk_access || 'friends',
                lastSyncedAt: child.last_synced_at || ''
            };
        });
    }

    function collectIssues(snapshot) {
        const issues = [];
        if (snapshot.auth.error) issues.push('登录：' + snapshot.auth.error);
        if (snapshot.household.error) issues.push('家庭：' + snapshot.household.error);
        if (snapshot.social.error) issues.push('社交：' + snapshot.social.error);
        if (snapshot.restore.error) issues.push('恢复：' + snapshot.restore.error);
        if (snapshot.sync.error) issues.push('同步：' + snapshot.sync.error);
        if (snapshot.activity.error) issues.push('动态流：' + snapshot.activity.error);
        if (snapshot.pk.error) issues.push('PK：' + snapshot.pk.error);
        return issues;
    }

    function buildSnapshot() {
        const cloud = getCloudStatus();
        const auth = getAuthState();
        const household = getHouseholdState();
        const social = getSocialState();
        const restore = getRestoreState();
        const sync = getCloudSyncState();
        const activity = getActivityState();
        const pk = getPKState();
        const profiles = getProfileSummary();
        const children = getHouseholdChildrenSummary(household.cloudChildren);

        const snapshot = {
            generatedAt: new Date().toISOString(),
            device: {
                label: readDeviceLabel(),
                userAgent: typeof navigator !== 'undefined' && navigator.userAgent
                    ? navigator.userAgent
                    : ''
            },
            cloud: {
                enabled: Boolean(cloud.enabled),
                hasSupabaseScript: Boolean(cloud.hasSupabaseScript),
                hasClient: Boolean(cloud.hasClient),
                hasPersistedConfig: Boolean(cloud.hasPersistedConfig),
                configSource: cloud.configSource || 'none',
                configSourceLabel: cloud.configSourceLabel || '未配置',
                siteUrl: cloud.siteUrl || '',
                supabaseUrl: cloud.supabaseUrl || ''
            },
            auth: {
                status: auth.status || 'idle',
                mode: auth.mode || 'signin',
                userId: auth.user && auth.user.id ? auth.user.id : '',
                email: auth.user && auth.user.email ? auth.user.email : '',
                parentName: auth.user && auth.user.user_metadata && auth.user.user_metadata.parent_name
                    ? auth.user.user_metadata.parent_name
                    : '',
                claimedInviteCode: auth.claimedInviteCode || '',
                error: auth.error || ''
            },
            profiles: profiles,
            household: {
                householdCount: Array.isArray(household.households) ? household.households.length : 0,
                primaryHouseholdId: household.primaryHouseholdId || '',
                primaryHouseholdName: household.primaryHousehold && household.primaryHousehold.name
                    ? household.primaryHousehold.name
                    : '',
                activeInviteCode: household.activeInvite && household.activeInvite.invite_code
                    ? household.activeInvite.invite_code
                    : '',
                cloudChildCount: children.length,
                children: children,
                error: household.error || ''
            },
            social: {
                activeCloudChildId: social.activeCloudChild && social.activeCloudChild.id
                    ? social.activeCloudChild.id
                    : '',
                householdPeerCount: Array.isArray(social.householdPeers) ? social.householdPeers.length : 0,
                friendCount: Array.isArray(social.friends) ? social.friends.length : 0,
                visitCount: Array.isArray(social.visits) ? social.visits.length : 0,
                error: social.error || ''
            },
            restore: {
                hydrating: Boolean(restore.hydrating),
                lastHydratedAt: restore.lastHydratedAt || '',
                info: restore.info || '',
                error: restore.error || ''
            },
            sync: {
                syncing: Boolean(sync.syncing),
                lastOutcome: sync.lastOutcome || 'idle',
                lastOutcomeReason: sync.lastOutcomeReason || '',
                lastReason: sync.lastReason || '',
                pendingReason: sync.pendingReason || '',
                lastAttemptedAt: sync.lastAttemptedAt || '',
                lastSucceededAt: sync.lastSucceededAt || '',
                lastFailedAt: sync.lastFailedAt || '',
                lastSkippedAt: sync.lastSkippedAt || '',
                pendingQueuedAt: sync.pendingQueuedAt || '',
                lastKnownChildId: sync.lastKnownChildId || '',
                lastLocalProfileId: sync.lastLocalProfileId || '',
                lastPersistedSnapshot: Boolean(sync.lastPersistedSnapshot),
                lastStep: sync.lastStep || 'idle',
                info: sync.info || '',
                error: sync.error || ''
            },
            activity: {
                entryCount: Array.isArray(activity.entries) ? activity.entries.length : 0,
                lastRefreshedAt: activity.lastRefreshedAt || '',
                error: activity.error || ''
            },
            pk: {
                matchCount: Array.isArray(pk.matches) ? pk.matches.length : 0,
                pendingCount: Array.isArray(pk.pendingMatches) ? pk.pendingMatches.length : 0,
                error: pk.error || ''
            }
        };

        snapshot.issues = collectIssues(snapshot);
        return snapshot;
    }

    function renderChildren(snapshot) {
        if (!snapshot.household.children.length) {
            return '<div class="cloud-diagnostics-empty">当前还没有云端孩子映射。先创建家庭并同步至少一个孩子。</div>';
        }

        return `
            <div class="cloud-diagnostics-child-list">
                ${snapshot.household.children.map(function (child) {
                    return `
                        <article class="cloud-diagnostics-child-card">
                            <div class="cloud-diagnostics-child-top">
                                <strong>${escapeHtml(child.emoji)} ${escapeHtml(child.displayName)}</strong>
                                <span>${escapeHtml(child.friendCode || '好友码待生成')}</span>
                            </div>
                            <div class="cloud-diagnostics-kv">
                                <span>child_id</span><code>${escapeHtml(child.id)}</code>
                                <span>local_profile_id</span><code>${escapeHtml(child.localProfileId || '未绑定')}</code>
                                <span>小屋可见</span><code>${escapeHtml(child.homeVisibility)}</code>
                                <span>串门权限</span><code>${escapeHtml(child.visitAccess)}</code>
                                <span>PK 权限</span><code>${escapeHtml(child.pkAccess)}</code>
                                <span>最近同步</span><code>${escapeHtml(formatTime(child.lastSyncedAt))}</code>
                            </div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function buildMarkup() {
        const snapshot = state.snapshot || buildSnapshot();
        const issuesHtml = snapshot.issues.length
            ? `<div class="auth-notice auth-error">${escapeHtml(snapshot.issues.join(' ｜ '))}</div>`
            : '';

        return `
            <section class="cloud-diagnostics-shell">
                <div class="cloud-diagnostics-head">
                    <div>
                        <p class="auth-eyebrow">联调支撑 / 云端诊断</p>
                        <h3>云端账号与家庭联调快照</h3>
                        <p class="auth-copy">把当前家长账号、家庭、孩子映射、权限、恢复状态和动态流摘要集中展示，方便双家长、双设备和跨家庭联调时快速定位问题。</p>
                    </div>
                    <div class="cloud-diagnostics-actions">
                        <button class="btn-secondary household-action-btn" type="button" onclick="CloudDiagnostics.setDeviceLabel()">设置设备标签</button>
                        <button class="btn-secondary household-action-btn" type="button" onclick="CloudDiagnostics.copySnapshot()">复制诊断 JSON</button>
                        <button class="btn-secondary household-action-btn" type="button" onclick="CloudDiagnostics.exportSnapshot()">导出诊断 JSON</button>
                        <button class="btn-primary household-action-btn" type="button" onclick="CloudDiagnostics.refresh('diagnostics-root')">刷新云端快照</button>
                    </div>
                </div>
                <div class="cloud-diagnostics-metrics">
                    <div class="cloud-diagnostics-metric"><span>云端配置</span><strong>${snapshot.cloud.enabled ? '已启用' : '本地模式'}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>当前家长</span><strong>${escapeHtml(snapshot.auth.email || snapshot.auth.parentName || '未登录')}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>家庭数量</span><strong>${escapeHtml(snapshot.household.householdCount)}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>云端孩子</span><strong>${escapeHtml(snapshot.household.cloudChildCount)}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>家庭同伴</span><strong>${escapeHtml(snapshot.social.householdPeerCount)}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>跨家庭好友</span><strong>${escapeHtml(snapshot.social.friendCount)}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>同步状态</span><strong>${escapeHtml(getCloudSyncOutcomeLabel(snapshot.sync.lastOutcome))}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>动态流条目</span><strong>${escapeHtml(snapshot.activity.entryCount)}</strong></div>
                    <div class="cloud-diagnostics-metric"><span>待处理 PK</span><strong>${escapeHtml(snapshot.pk.pendingCount)}</strong></div>
                </div>
                <div class="cloud-diagnostics-grid">
                    <section class="cloud-diagnostics-card">
                        <div class="social-section-head">
                            <h4>账号与家庭</h4>
                            <span>${escapeHtml(snapshot.auth.status)}</span>
                        </div>
                        <div class="cloud-diagnostics-kv">
                            <span>配置来源</span><code>${escapeHtml(snapshot.cloud.configSourceLabel || '未配置')}</code>
                            <span>user_id</span><code>${escapeHtml(snapshot.auth.userId || '未登录')}</code>
                            <span>primary_household_id</span><code>${escapeHtml(snapshot.household.primaryHouseholdId || '未创建')}</code>
                            <span>家庭名称</span><code>${escapeHtml(snapshot.household.primaryHouseholdName || '未创建')}</code>
                            <span>家庭邀请码</span><code>${escapeHtml(snapshot.household.activeInviteCode || '当前无待处理邀请码')}</code>
                            <span>config_source_key</span><code>${escapeHtml(snapshot.cloud.configSource || 'none')}</code>
                            <span>site_url</span><code>${escapeHtml(snapshot.cloud.siteUrl || '未配置')}</code>
                            <span>supabase_url</span><code>${escapeHtml(snapshot.cloud.supabaseUrl || '未配置')}</code>
                        </div>
                    </section>
                    <section class="cloud-diagnostics-card">
                        <div class="social-section-head">
                            <h4>最近同步结果</h4>
                            <span class="cloud-sync-badge cloud-sync-badge-${escapeHtml(snapshot.sync.lastOutcome)}">${escapeHtml(getCloudSyncOutcomeLabel(snapshot.sync.lastOutcome))}</span>
                        </div>
                        <div class="cloud-diagnostics-kv">
                            <span>最近原因</span><code>${escapeHtml(getCloudSyncReasonLabel(snapshot.sync.pendingReason || snapshot.sync.lastReason || snapshot.sync.lastOutcomeReason))}</code>
                            <span>最近步骤</span><code>${escapeHtml(getCloudSyncStepLabel(snapshot.sync.lastStep))}</code>
                            <span>本地孩子</span><code>${escapeHtml(snapshot.sync.lastLocalProfileId || '未记录')}</code>
                            <span>云端孩子</span><code>${escapeHtml(snapshot.sync.lastKnownChildId || '未定位')}</code>
                            <span>最近尝试</span><code>${escapeHtml(formatTime(snapshot.sync.lastAttemptedAt))}</code>
                            <span>最近成功</span><code>${escapeHtml(formatTime(snapshot.sync.lastSucceededAt))}</code>
                            <span>最近失败</span><code>${escapeHtml(formatTime(snapshot.sync.lastFailedAt))}</code>
                            <span>快照写入</span><code>${escapeHtml(snapshot.sync.lastPersistedSnapshot ? '已写 pet_state_snapshots' : '仅更新摘要')}</code>
                            <span>同步提示</span><code>${escapeHtml(snapshot.sync.info || snapshot.sync.error || '当前没有额外提示')}</code>
                        </div>
                    </section>
                    <section class="cloud-diagnostics-card">
                        <div class="social-section-head">
                            <h4>联调状态摘要</h4>
                            <span>${escapeHtml(formatTime(state.lastRefreshedAt || snapshot.generatedAt))}</span>
                        </div>
                        <div class="cloud-diagnostics-kv">
                            <span>当前本地孩子</span><code>${escapeHtml(snapshot.profiles.activeProfileName || '未选择')}</code>
                            <span>当前云端孩子</span><code>${escapeHtml(snapshot.social.activeCloudChildId || '未绑定')}</code>
                            <span>诊断标签</span><code>${escapeHtml(snapshot.device.label || '未设置')}</code>
                            <span>本地档案数</span><code>${escapeHtml(snapshot.profiles.totalProfiles)}</code>
                            <span>最近恢复</span><code>${escapeHtml(formatTime(snapshot.restore.lastHydratedAt))}</code>
                            <span>动态流刷新</span><code>${escapeHtml(formatTime(snapshot.activity.lastRefreshedAt))}</code>
                            <span>最近复制</span><code>${escapeHtml(formatTime(state.lastCopiedAt))}</code>
                            <span>最近导出</span><code>${escapeHtml(formatTime(state.lastExportedAt))}</code>
                        </div>
                    </section>
                    <section class="cloud-diagnostics-card cloud-diagnostics-card-wide">
                        <div class="social-section-head">
                            <h4>云端孩子映射与权限</h4>
                            <span>${escapeHtml(snapshot.household.children.length)} 位孩子</span>
                        </div>
                        ${renderChildren(snapshot)}
                    </section>
                    <section class="cloud-diagnostics-card cloud-diagnostics-card-wide">
                        <div class="social-section-head">
                            <h4>诊断 JSON 预览</h4>
                            <span>可直接复制到联调记录</span>
                        </div>
                        <pre class="cloud-diagnostics-pre">${escapeHtml(JSON.stringify(snapshot, null, 2))}</pre>
                    </section>
                </div>
                ${state.loading ? '<div class="auth-notice auth-info">正在刷新家庭、社交、PK 和动态流快照…</div>' : ''}
                ${state.info ? `<div class="auth-notice auth-info">${escapeHtml(state.info)}</div>` : ''}
                ${issuesHtml}
            </section>
        `;
    }

    function render(containerId) {
        const mount = document.getElementById(containerId || 'diagnostics-root');
        if (!mount) return;
        if (window.FamilySocialScope && typeof window.FamilySocialScope.shouldShowDiagnostics === 'function' && !window.FamilySocialScope.shouldShowDiagnostics()) {
            mount.innerHTML = '';
            return;
        }
        if (!state.snapshot) {
            state.snapshot = buildSnapshot();
        }
        mount.innerHTML = buildMarkup();
    }

    async function refresh(containerId) {
        if (window.FamilySocialScope && typeof window.FamilySocialScope.shouldShowDiagnostics === 'function' && !window.FamilySocialScope.shouldShowDiagnostics()) {
            state.loading = false;
            state.error = '';
            state.info = '';
            state.snapshot = buildSnapshot();
            render(containerId);
            return state;
        }

        state.loading = true;
        state.error = '';
        state.info = '';
        render(containerId);

        try {
            if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
                await window.HouseholdSystem.refresh('household-root');
            }
            if (window.SocialSystem && typeof window.SocialSystem.refresh === 'function') {
                await window.SocialSystem.refresh();
            }
            if (window.PKService && typeof window.PKService.refresh === 'function') {
                await window.PKService.refresh();
            }
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }

            state.snapshot = buildSnapshot();
            state.lastRefreshedAt = new Date().toISOString();
            state.info = '已刷新当前云端联调快照。';
        } catch (error) {
            state.error = error && error.message ? error.message : '刷新联调快照失败';
            state.snapshot = buildSnapshot();
        } finally {
            state.loading = false;
            render(containerId);
        }

        return state;
    }

    async function copySnapshot() {
        state.info = '';
        state.error = '';
        state.snapshot = buildSnapshot();

        try {
            const text = JSON.stringify(state.snapshot, null, 2);
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(text);
                state.lastCopiedAt = new Date().toISOString();
                state.info = '联调诊断 JSON 已复制到剪贴板。';
            } else {
                state.error = '当前浏览器不支持自动复制，请展开 JSON 预览手动复制。';
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '复制联调诊断失败';
        }

        render('diagnostics-root');
        return false;
    }

    async function exportSnapshot() {
        state.info = '';
        state.error = '';
        state.snapshot = buildSnapshot();

        try {
            if (typeof document === 'undefined' || typeof Blob === 'undefined' || !window.URL || typeof window.URL.createObjectURL !== 'function') {
                state.error = '当前浏览器不支持直接导出文件，请先复制诊断 JSON。';
                render('diagnostics-root');
                return false;
            }

            const text = JSON.stringify(state.snapshot, null, 2);
            const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
            const url = window.URL.createObjectURL(blob);
            const fileName = buildExportFileName(state.snapshot);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = fileName;
            anchor.style.display = 'none';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);

            state.lastExportedAt = new Date().toISOString();
            state.info = '联调诊断 JSON 已导出：' + fileName;
        } catch (error) {
            state.error = error && error.message ? error.message : '导出联调诊断失败';
        }

        render('diagnostics-root');
        return false;
    }

    async function setDeviceLabel() {
        state.info = '';
        state.error = '';
        const currentLabel = readDeviceLabel();
        const nextLabel = window.prompt('给当前设备设置一个联调标签，方便导出 JSON 和跨设备对比（例如：设备1-家长A1 / iPad-家长A2）。', currentLabel || '');
        if (nextLabel === null) {
            state.info = '已取消修改设备标签。';
            render('diagnostics-root');
            return false;
        }

        saveDeviceLabel(nextLabel);
        state.snapshot = buildSnapshot();
        state.info = nextLabel && String(nextLabel).trim()
            ? '当前设备标签已保存：' + String(nextLabel).trim()
            : '已清空当前设备标签。';
        render('diagnostics-root');
        return false;
    }

    window.CloudDiagnostics = {
        render,
        refresh,
        copySnapshot,
        exportSnapshot,
        setDeviceLabel,
        buildSnapshot,
        getState() {
            return {
                loading: state.loading,
                error: state.error,
                info: state.info,
                snapshot: state.snapshot,
                lastRefreshedAt: state.lastRefreshedAt,
                lastCopiedAt: state.lastCopiedAt,
                lastExportedAt: state.lastExportedAt
            };
        }
    };
})();
