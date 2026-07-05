(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCloudStatus() {
        return window.CloudClient && typeof window.CloudClient.getStatus === 'function'
            ? window.CloudClient.getStatus()
            : { enabled: false, configSourceLabel: '未配置' };
    }

    function getAuthState() {
        return window.AuthSystem && typeof window.AuthSystem.getState === 'function'
            ? window.AuthSystem.getState()
            : null;
    }

    function buildGateMarkup() {
        const cloud = getCloudStatus();
        const authState = getAuthState();
        const user = authState && authState.user ? authState.user : null;
        const label = user
            ? (user.user_metadata && user.user_metadata.parent_name) || user.email || user.phone || user.id
            : '';

        if (!cloud.enabled) {
            return `
                <section class="auth-shell admin-gate-card">
                    <div class="auth-shell-head">
                        <div>
                            <p class="auth-eyebrow">后台门禁</p>
                            <h3>先配置云端连接</h3>
                        </div>
                        <span class="auth-badge offline">等待配置</span>
                    </div>
                    <p class="auth-copy">轻后台复用主站的 Supabase 账号体系。请先保存云端配置，再继续登录管理员账号。</p>
                </section>
            `;
        }

        if (!user) {
            return `
                <section class="auth-shell admin-gate-card">
                    <div class="auth-shell-head">
                        <div>
                            <p class="auth-eyebrow">后台门禁</p>
                            <h3>请先登录管理员账号</h3>
                        </div>
                        <span class="auth-badge offline">未登录</span>
                    </div>
                    <p class="auth-copy">这里先复用家长账号登录。真正的 admin 角色校验和后台功能会在下一步接入。</p>
                </section>
            `;
        }

        return `
            <section class="auth-shell admin-gate-card">
                <div class="auth-shell-head">
                    <div>
                        <p class="auth-eyebrow">后台门禁</p>
                        <h3>${escapeHtml(label)}</h3>
                    </div>
                    <span class="auth-badge online">已登录</span>
                </div>
                <p class="auth-copy">管理员角色校验即将接入。当前这一步先确认后台壳、登录态和云端配置链路都能跑通。</p>
                <div class="admin-gate-note">
                    <strong>当前状态：</strong>
                    <span>后台壳已就绪，下一步将接入 admin 角色表、管理员审计日志和后台查询函数。</span>
                </div>
            </section>
        `;
    }

    function renderShell() {
        const mount = document.getElementById('admin-root');
        if (!mount) return;

        const cloud = getCloudStatus();
        mount.innerHTML = `
            <div class="admin-shell">
                <section class="map-hero admin-hero">
                    <div class="map-hero-copy">
                        <p class="map-eyebrow">后台 / 轻运营入口</p>
                        <h2>家庭账号轻后台</h2>
                        <p>这一版先把管理员登录、云端配置和后台门禁接起来，再逐步开放邀请码管理、家庭排查和孩子同步巡检。</p>
                    </div>
                    <div class="map-hero-side">
                        <div class="map-hero-stats">
                            <div class="map-hero-stat">
                                <span class="label">后台模式</span>
                                <strong>轻后台</strong>
                            </div>
                            <div class="map-hero-stat">
                                <span class="label">账号体系</span>
                                <strong>复用家长账号</strong>
                            </div>
                            <div class="map-hero-stat">
                                <span class="label">云端配置</span>
                                <strong>${escapeHtml(cloud.enabled ? '已连接' : '未配置')}</strong>
                            </div>
                        </div>
                    </div>
                </section>
                <div class="admin-shell-grid">
                    <div id="auth-root"></div>
                    <div class="admin-right-rail">
                        <div id="admin-gate-root"></div>
                        <div id="admin-console-root"></div>
                    </div>
                </div>
            </div>
        `;
    }

    function renderGate() {
        const gateMount = document.getElementById('admin-gate-root');
        if (!gateMount) return;
        gateMount.innerHTML = buildGateMarkup();
    }

    async function boot() {
        renderShell();
        if (window.AuthSystem && typeof window.AuthSystem.boot === 'function') {
            await window.AuthSystem.boot();
            if (typeof window.AuthSystem.render === 'function') {
                window.AuthSystem.render('auth-root');
            }
        }
        renderGate();
        if (window.AdminConsole && typeof window.AdminConsole.render === 'function') {
            window.AdminConsole.render('admin-console-root');
        }
    }

    window.AdminAuth = {
        boot,
        render: renderGate
    };

    window.addEventListener('DOMContentLoaded', function () {
        void boot();
    });
})();
