(function () {
    'use strict';

    function render(containerId) {
        const mount = document.getElementById(containerId || 'admin-console-root');
        if (!mount) return;
        mount.innerHTML = `
            <section class="auth-shell admin-gate-card">
                <div class="auth-shell-head">
                    <div>
                        <p class="auth-eyebrow">后台功能预留</p>
                        <h3>查询台即将接入</h3>
                    </div>
                    <span class="auth-badge offline">待接线</span>
                </div>
                <p class="auth-copy">下一步会把账号 / 家庭 / 孩子搜索，以及邀请码巡检接到新的 admin Edge Functions 上。</p>
            </section>
        `;
    }

    window.AdminConsole = {
        render,
    };
})();
