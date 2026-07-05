(function () {
    'use strict';

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

    function getPKState() {
        return window.PKService && typeof window.PKService.getState === 'function'
            ? window.PKService.getState()
            : {};
    }

    function getActivityFeedState() {
        return window.ActivityFeedSystem && typeof window.ActivityFeedSystem.getState === 'function'
            ? window.ActivityFeedSystem.getState()
            : {};
    }

    function getVisibilityLabel(value) {
        return value === 'private' ? '仅家庭可见' : '好友可见';
    }

    function getOutcomeLabel(match) {
        if (!match) return '进行中';
        if (match.pendingForMe) return '待应战';
        if (match.awaitingPeer) return '等好友提交';
        if (match.outcome === 'win') return '获胜';
        if (match.outcome === 'lose') return '惜败';
        if (match.outcome === 'draw') return '平局';
        if (match.expired) return '已过期';
        return match.statusText || '进行中';
    }

    function dedupePeers(householdPeers, friends) {
        const peerMap = new Map();
        (householdPeers || []).concat(friends || []).forEach(function (peer) {
            if (!peer || !peer.id || peerMap.has(peer.id)) return;
            peerMap.set(peer.id, peer);
        });
        return Array.from(peerMap.values());
    }

    function buildMetrics() {
        const householdState = getHouseholdState();
        const socialState = getSocialState();
        const pkState = getPKState();
        const activityFeedState = getActivityFeedState();

        const cloudChildren = Array.isArray(householdState.cloudChildren) ? householdState.cloudChildren : [];
        const visits = Array.isArray(socialState.visits) ? socialState.visits : [];
        const householdPeers = Array.isArray(socialState.householdPeers) ? socialState.householdPeers : [];
        const friends = Array.isArray(socialState.friends) ? socialState.friends : [];
        const peers = dedupePeers(householdPeers, friends);
        const activityEntries = Array.isArray(activityFeedState.entries) ? activityFeedState.entries : [];
        const matches = Array.isArray(pkState.matches) ? pkState.matches : [];
        const pendingMatches = Array.isArray(pkState.pendingMatches) ? pkState.pendingMatches : [];
        const completedMatches = matches.filter(function (match) {
            return Boolean(match.myAttempt && match.peerAttempt);
        });
        const winMatches = completedMatches.filter(function (match) {
            return match.outcome === 'win';
        });

        return {
            householdState: householdState,
            socialState: socialState,
            pkState: pkState,
            cloudChildren: cloudChildren,
            visits: visits,
            householdPeers: householdPeers,
            friends: friends,
            peers: peers,
            activityEntries: activityEntries,
            matches: matches,
            pendingMatches: pendingMatches,
            completedMatches: completedMatches,
            winMatches: winMatches
        };
    }

    function renderMetrics(metrics) {
        return `
            <div class="family-review-metrics">
                <div class="family-review-metric">
                    <span>云端家庭</span>
                    <strong>${metrics.householdState.primaryHouseholdId ? '1' : '0'}</strong>
                </div>
                <div class="family-review-metric">
                    <span>已同步孩子</span>
                    <strong>${metrics.cloudChildren.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>互动同伴</span>
                    <strong>${metrics.peers.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>家庭同伴</span>
                    <strong>${metrics.householdPeers.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>待处理 PK</span>
                    <strong>${metrics.pendingMatches.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>最近串门</span>
                    <strong>${metrics.visits.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>已完赛 PK</span>
                    <strong>${metrics.completedMatches.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>本周胜场感</span>
                    <strong>${metrics.winMatches.length}</strong>
                </div>
                <div class="family-review-metric">
                    <span>最近刷新</span>
                    <strong>${escapeHtml(state.lastRefreshedAt ? formatTime(state.lastRefreshedAt) : '未刷新')}</strong>
                </div>
            </div>
        `;
    }

    function renderChildren(metrics) {
        if (!metrics.cloudChildren.length) {
            return '<div class="family-review-empty">当前家庭还没有同步任何孩子，先到设置页把孩子档案同步到云端。</div>';
        }

        return `
            <div class="family-review-children">
                ${metrics.cloudChildren.map(function (child) {
                    const petSummary = child.pet_summary_json || {};
                    const homeSummary = child.home_summary_json || {};
                    return `
                        <article class="family-review-child-card">
                            <div class="family-review-child-top">
                                <div class="family-review-child-emoji">${escapeHtml(child.emoji || '🧒')}</div>
                                <div class="family-review-child-copy">
                                    <strong>${escapeHtml(child.display_name || '未命名孩子')}</strong>
                                    <span>好友码 ${escapeHtml(child.friend_code || '待生成')} · ${escapeHtml(getVisibilityLabel(child.home_visibility))}</span>
                                </div>
                            </div>
                            <div class="family-review-chip-row">
                                <span class="family-review-chip">🐾 ${escapeHtml(petSummary.species_name || '还没领养宠物')}</span>
                                <span class="family-review-chip">🏠 ${escapeHtml(homeSummary.theme_name || '默认小屋')}</span>
                                <span class="family-review-chip">🚪 ${escapeHtml(child.visit_access === 'private' ? '仅家庭串门' : '好友可串门')}</span>
                                <span class="family-review-chip">🏁 ${escapeHtml(child.pk_access === 'private' ? '仅家庭 PK' : '好友可 PK')}</span>
                                <span class="family-review-chip">✨ 胜场 ${escapeHtml(petSummary.wins || 0)}</span>
                                <span class="family-review-chip">🧭 探索 ${escapeHtml(petSummary.explorations || 0)}</span>
                            </div>
                            <div class="family-review-child-meta">最近同步：${escapeHtml(formatTime(child.last_synced_at))}</div>
                        </article>
                    `;
                }).join('')}
            </div>
        `;
    }

    function buildFeedItems(metrics) {
        const visitItems = metrics.visits.map(function (visit) {
            return {
                key: 'visit-' + String(visit.id || visit.createdAt || Math.random()),
                timestamp: visit.createdAt || '',
                title: (visit.incoming ? '收到串门' : '发起串门') + ' · ' + (visit.peerEmoji || '🐾') + ' ' + (visit.peerName || '好友'),
                body: visit.message || '好友互动',
                tag: '串门'
            };
        });

        const matchItems = metrics.matches.map(function (match) {
            return {
                key: 'pk-' + String(match.id || match.createdAt || Math.random()),
                timestamp: (match.peerAttempt && match.peerAttempt.completedAt)
                    || (match.myAttempt && match.myAttempt.completedAt)
                    || match.createdAt
                    || '',
                title: (match.gameType === 'hanzi' ? '汉字 PK' : '数学 PK') + ' · ' + (match.peerChild && match.peerChild.display_name ? match.peerChild.display_name : '好友'),
                body: getOutcomeLabel(match) + ' · ' + (match.myAttempt ? ('你 ' + match.myAttempt.score + ' 分') : '你未提交') + ' / ' + (match.peerAttempt ? ('好友 ' + match.peerAttempt.score + ' 分') : '好友未提交'),
                tag: match.gameType === 'hanzi' ? '汉字' : '数学'
            };
        });

        return visitItems.concat(matchItems).sort(function (a, b) {
            return new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime();
        }).slice(0, 6);
    }

    function renderFeed(metrics) {
        const items = metrics.activityEntries.length
            ? metrics.activityEntries.map(function (entry) {
                return {
                    key: 'activity-' + String(entry.id || entry.created_at || Math.random()),
                    timestamp: entry.created_at || '',
                    title: entry.summary || '家庭动态',
                    body: entry.payload_json && entry.payload_json.message
                        ? entry.payload_json.message
                        : (entry.event_type || '动态'),
                    tag: entry.event_type || '动态'
                };
            })
            : buildFeedItems(metrics);
        if (!items.length) {
            return '<div class="family-review-empty">一旦孩子开始互加好友、串门或异步 PK，这里就会出现最近动态。</div>';
        }

        return `
            <div class="family-review-feed">
                ${items.map(function (item) {
                    return `
                        <div class="family-review-feed-item">
                            <div class="family-review-feed-top">
                                <strong>${escapeHtml(item.title)}</strong>
                                <span>${escapeHtml(item.tag)}</span>
                            </div>
                            <div class="family-review-feed-body">${escapeHtml(item.body)}</div>
                            <div class="family-review-child-meta">${escapeHtml(formatTime(item.timestamp))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function buildMarkup() {
        const metrics = buildMetrics();
        const householdName = metrics.householdState.primaryHousehold && metrics.householdState.primaryHousehold.name
            ? metrics.householdState.primaryHousehold.name
            : '还没有连接家庭';

        let bodyHtml = '';
        if (!metrics.householdState.primaryHouseholdId) {
            bodyHtml = `
                <div class="family-review-empty">
                    先登录家长账号并创建家庭，后面多个孩子、好友串门和异步 PK 的复盘都会集中展示在这里。
                </div>
            `;
        } else {
            bodyHtml = `
                ${renderMetrics(metrics)}
                <div class="family-review-grid">
                    <section class="family-review-panel">
                        <div class="family-review-panel-head">
                            <h4>孩子与宠物概览</h4>
                            <span>${metrics.cloudChildren.length} 位孩子</span>
                        </div>
                        ${renderChildren(metrics)}
                    </section>
                    <section class="family-review-panel">
                        <div class="family-review-panel-head">
                            <h4>最近互动动态</h4>
                            <span>${metrics.activityEntries.length || (metrics.visits.length + metrics.matches.length)} 条记录</span>
                        </div>
                        ${renderFeed(metrics)}
                    </section>
                </div>
            `;
        }

        return `
            <section class="family-review-shell">
                <div class="family-review-hero">
                    <div>
                        <p class="auth-eyebrow">家庭复盘 / 社交与坚持度</p>
                        <h3>${escapeHtml(householdName)}</h3>
                        <p class="auth-copy">把“家庭账号、好友互动、宠物串门、同题 PK”放到同一张复盘卡里，家长能更快看清孩子有没有真的玩在一起。</p>
                    </div>
                    <button class="btn-secondary household-action-btn" type="button" onclick="FamilyReview.refresh('family-review-root')">刷新复盘</button>
                </div>
                ${bodyHtml}
                ${state.loading ? '<div class="auth-notice auth-info">正在汇总家庭、好友和异步 PK 数据…</div>' : ''}
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
            state.lastRefreshedAt = new Date().toISOString();
        } catch (error) {
            state.error = error && error.message ? error.message : '家庭复盘刷新失败';
        } finally {
            state.loading = false;
            render(containerId);
        }
    }

    window.FamilyReview = {
        render,
        refresh,
        getState() {
            return Object.assign({}, state);
        }
    };
})();
