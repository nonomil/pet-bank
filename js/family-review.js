(function () {
    'use strict';

    const GUIDED_FEEDBACK_HISTORY_KEY = 'petbank_guided_feedback_history';
    const state = {
        loading: false,
        error: '',
        lastRefreshedAt: ''
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function readGuidedFeedbackHistory() {
        if (typeof window.readGuidedFeedbackHistory === 'function') {
            return window.readGuidedFeedbackHistory();
        }
        try {
            const raw = JSON.parse(localStorage.getItem(GUIDED_FEEDBACK_HISTORY_KEY) || '[]');
            return Array.isArray(raw) ? raw : [];
        } catch (_) {
            return [];
        }
    }

    function buildGuidedInsights(entries) {
        const labels = {
            mathpk: '数学 PK',
            explore: '探索冒险'
        };
        const list = (Array.isArray(entries) ? entries : readGuidedFeedbackHistory())
            .filter(function (entry) {
                return entry && entry.mode && entry.nextStep;
            })
            .sort(function (a, b) {
                return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
            })
            .slice(0, 6);
        if (!list.length) {
            return {
                hasData: false,
                title: '还没有可复盘的卡点',
                detail: '完成一局数学 PK 或探索战斗后，这里会把需要再看一眼的地方整理出来。',
                nextStep: '先完成一局，再根据结果决定下一步。',
                items: []
            };
        }

        const groups = {};
        list.forEach(function (entry) {
            const key = `${entry.mode}:${entry.cause || 'unknown'}`;
            groups[key] = groups[key] || { mode: entry.mode, cause: entry.cause, count: 0 };
            groups[key].count += 1;
        });
        const lead = Object.values(groups).sort(function (a, b) {
            return b.count - a.count;
        })[0];
        const latest = list.find(function (entry) {
            return entry.mode === lead.mode && (entry.cause || 'unknown') === (lead.cause || 'unknown');
        }) || list[0];
        return {
            hasData: true,
            title: `${labels[lead.mode] || '最近玩法'} 最近需要复盘`,
            detail: lead.count > 1
                ? `${labels[lead.mode] || '这个玩法'}最近有 ${lead.count} 次相似卡点：${latest.note}`
                : latest.note,
            nextStep: latest.nextStep,
            items: list.map(function (entry) {
                return {
                    label: labels[entry.mode] || '学习活动',
                    note: entry.note || '这次留下了一条复盘记录。',
                    nextStep: entry.nextStep,
                    timestamp: entry.timestamp || ''
                };
            })
        };
    }

    function renderGuidedInsights() {
        const insights = buildGuidedInsights();
        return `
            <section class="family-review-guided-insights">
                <div class="family-review-panel-head">
                    <h4>最近卡点</h4>
                    <span>${insights.hasData ? `${insights.items.length} 条复盘` : '等待记录'}</span>
                </div>
                <div class="family-review-insight-main">
                    <strong>${escapeHtml(insights.title)}</strong>
                    <p>${escapeHtml(insights.detail)}</p>
                    <p><b>下一步</b>${escapeHtml(insights.nextStep)}</p>
                </div>
                ${insights.items.length ? `
                    <div class="family-review-insight-list">
                        ${insights.items.slice(0, 3).map(function (item) {
                            return `<div class="family-review-insight-item"><span>${escapeHtml(item.label)}</span><p>${escapeHtml(item.note)}</p><small>下一步：${escapeHtml(item.nextStep)}</small></div>`;
                        }).join('')}
                    </div>
                ` : ''}
            </section>
        `;
    }

    function buildMarkup() {
        return `
            <section class="family-review-shell">
                <div class="family-review-hero">
                    <div>
                        <p class="auth-eyebrow">本机成长复盘</p>
                        <h3>把最近卡点整理成下一步</h3>
                        <p class="auth-copy">当前版本只读取本机复盘记录，不连接云端账号、家庭同步或好友数据。</p>
                    </div>
                    <button class="btn-secondary household-action-btn" type="button" onclick="FamilyReview.refresh('family-review-root')">刷新复盘</button>
                </div>
                ${renderGuidedInsights()}
                ${state.loading ? '<div class="auth-notice auth-info">正在整理本机复盘记录…</div>' : ''}
                ${state.error ? `<div class="auth-notice auth-error">${escapeHtml(state.error)}</div>` : ''}
            </section>
        `;
    }

    function render(containerId) {
        const mount = document.getElementById(containerId || 'family-review-root');
        if (!mount) return;
        mount.innerHTML = buildMarkup();
    }

    async function refresh(containerId) {
        state.loading = true;
        state.error = '';
        render(containerId);
        try {
            state.lastRefreshedAt = new Date().toISOString();
        } catch (error) {
            state.error = '本机复盘刷新失败';
        } finally {
            state.loading = false;
            render(containerId);
        }
        return true;
    }

    window.FamilyReview = {
        render,
        refresh,
        buildGuidedInsights,
        getState() {
            return Object.assign({}, state);
        }
    };
})();
