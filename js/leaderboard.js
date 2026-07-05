// ============================================================
// js/leaderboard.js
// 通用本地排行榜（按 gameId + profileId 隔离）
// 存储规范：petbank_lb_{gameId}_{ProfileManager.getActiveId()||'default'}
// 数据结构：{ best:Number, recent:[{score, ts, ...meta}] }
// 零依赖，IIFE + window 挂载
// ============================================================
(function () {
    'use strict';

    const RECENT_MAX = 10;

    function _profileId() {
        try {
            if (window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function') {
                return window.ProfileManager.getActiveId() || 'default';
            }
        } catch (_) {}
        return 'default';
    }

    function _key(gameId) {
        return `petbank_lb_${gameId}_${_profileId()}`;
    }

    function _read(gameId) {
        try {
            const raw = localStorage.getItem(_key(gameId));
            if (!raw) return { best: 0, recent: [] };
            const obj = JSON.parse(raw);
            return {
                best: Number(obj.best) || 0,
                recent: Array.isArray(obj.recent) ? obj.recent : []
            };
        } catch (_) {
            return { best: 0, recent: [] };
        }
    }

    function _write(gameId, data) {
        try {
            localStorage.setItem(_key(gameId), JSON.stringify(data));
        } catch (_) {}
    }

    // 记录一次成绩，维护 best + recent(≤10)，返回 { best, recent }
    function record(gameId, score, meta) {
        meta = meta || {};
        const data = _read(gameId);
        const n = Number(score) || 0;
        const entry = Object.assign({ score: n, ts: Date.now() }, meta);
        data.recent.unshift(entry);
        if (data.recent.length > RECENT_MAX) data.recent.length = RECENT_MAX;
        if (n > data.best) data.best = n;
        _write(gameId, data);
        return data;
    }

    function getBest(gameId) {
        return _read(gameId).best;
    }

    function getRecent(gameId, n) {
        const all = _read(gameId).recent;
        if (typeof n !== 'number' || n <= 0) n = RECENT_MAX;
        return all.slice(0, Math.min(n, all.length));
    }

    // 简易 sparkline：emoji ▁▂▃▄▅▆▇█ 八档，仅依赖 score 数组
    const _SPARK = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    function _sparkline(scores) {
        if (!scores.length) return '<span class="lb-spark-empty">— 还没有数据 —</span>';
        const lo = Math.min.apply(null, scores);
        const hi = Math.max.apply(null, scores);
        const span = hi - lo;
        return scores.map(function (s) {
            let idx = span === 0 ? 4 : Math.floor((s - lo) / span * 7);
            if (idx < 0) idx = 0;
            if (idx > 7) idx = 7;
            return `<span class="lb-spark-bar" title="${s}">${_SPARK[idx]}</span>`;
        }).join('');
    }

    function _fmtDate(ts) {
        try {
            const d = new Date(ts);
            const pad = function (x) { return x < 10 ? '0' + x : '' + x; };
            return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch (_) { return ''; }
    }

    function _getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : null;
    }

    function _getSocialState() {
        return window.SocialSystem && typeof window.SocialSystem.getState === 'function'
            ? window.SocialSystem.getState()
            : null;
    }

    function _getPKState() {
        return window.PKService && typeof window.PKService.getState === 'function'
            ? window.PKService.getState()
            : null;
    }

    function _cloudOutcome(match) {
        if (!match) return '进行中';
        if (match.pendingForMe) return '待应战';
        if (match.awaitingPeer) return '等好友提交';
        if (match.outcome === 'win') return '获胜';
        if (match.outcome === 'lose') return '惜败';
        if (match.outcome === 'draw') return '平局';
        if (match.expired) return '已过期';
        return match.statusText || '进行中';
    }

    function _dedupePeers(householdPeers, friends) {
        const peerMap = new Map();
        (householdPeers || []).concat(friends || []).forEach(function (peer) {
            if (!peer || !peer.id || peerMap.has(peer.id)) return;
            peerMap.set(peer.id, peer);
        });
        return Array.from(peerMap.values());
    }

    function _renderCloudSummary(gameId) {
        const householdState = _getHouseholdState();
        const socialState = _getSocialState();
        const pkState = _getPKState();

        if (!householdState || !householdState.primaryHouseholdId) {
            return `
                <div class="lb-cloud-card">
                    <div class="lb-cloud-head">
                        <h3>好友与云端战绩</h3>
                        <span>未连接家庭</span>
                    </div>
                    <div class="lb-cloud-empty">登录并同步家庭后，这里会显示好友数量、待应战场次，以及这项玩法的异步 PK 结果。</div>
                </div>
            `;
        }

        const householdPeers = socialState && Array.isArray(socialState.householdPeers) ? socialState.householdPeers : [];
        const friends = socialState && Array.isArray(socialState.friends) ? socialState.friends : [];
        const peers = _dedupePeers(householdPeers, friends);
        const visits = socialState && Array.isArray(socialState.visits) ? socialState.visits : [];
        const matches = pkState && Array.isArray(pkState.matches)
            ? pkState.matches.filter(function (match) { return match.gameType === gameId; })
            : [];
        const pending = matches.filter(function (match) { return match.pendingForMe; });
        const completed = matches.filter(function (match) { return match.myAttempt && match.peerAttempt; });
        const wins = completed.filter(function (match) { return match.outcome === 'win'; });

        const recentHtml = matches.length
            ? matches.slice(0, 3).map(function (match) {
                return `
                    <div class="lb-cloud-match">
                        <div class="lb-cloud-match-top">
                            <strong>${match.peerChild && match.peerChild.emoji ? match.peerChild.emoji : '🐾'} ${match.peerChild && match.peerChild.display_name ? match.peerChild.display_name : '好友'}</strong>
                            <span>${_cloudOutcome(match)}</span>
                        </div>
                        <div class="lb-cloud-match-body">
                            ${match.myAttempt ? `你 ${match.myAttempt.score} 分` : '你未提交'}
                            ·
                            ${match.peerAttempt ? `好友 ${match.peerAttempt.score} 分` : '好友未提交'}
                        </div>
                        <div class="lb-cloud-match-time">${_fmtDate((match.peerAttempt && match.peerAttempt.completedAt) || (match.myAttempt && match.myAttempt.completedAt) || match.createdAt)}</div>
                    </div>
                `;
            }).join('')
            : '<div class="lb-cloud-empty">这项玩法还没有云端异步 PK 记录，先去给好友发起一场同题挑战吧。</div>';

        return `
            <div class="lb-cloud-card">
                <div class="lb-cloud-head">
                    <h3>好友与云端战绩</h3>
                    <span>${householdState.primaryHousehold && householdState.primaryHousehold.name ? householdState.primaryHousehold.name : '家庭已连接'}</span>
                </div>
                <div class="lb-cloud-grid">
                    <div class="lb-cloud-metric">
                        <span>互动同伴</span>
                        <strong>${peers.length}</strong>
                    </div>
                    <div class="lb-cloud-metric">
                        <span>家庭同伴</span>
                        <strong>${householdPeers.length}</strong>
                    </div>
                    <div class="lb-cloud-metric">
                        <span>待应战</span>
                        <strong>${pending.length}</strong>
                    </div>
                    <div class="lb-cloud-metric">
                        <span>已完赛</span>
                        <strong>${completed.length}</strong>
                    </div>
                    <div class="lb-cloud-metric">
                        <span>胜场</span>
                        <strong>${wins.length}</strong>
                    </div>
                </div>
                <div class="lb-cloud-subhead">
                    <span>最近串门 ${visits.length} 次</span>
                    <span>异步 PK ${matches.length} 场</span>
                </div>
                <div class="lb-cloud-list">${recentHtml}</div>
            </div>
        `;
    }

    // 渲染：最高分卡片 + 进步趋势 + 最近列表
    function renderUI(containerId, gameId, opts) {
        opts = opts || {};
        const el = document.getElementById(containerId);
        if (!el) return;
        const data = _read(gameId);
        const recent = data.recent;
        const scoresAsc = recent.slice().reverse().map(function (r) { return r.score; });
        const gameLabel = opts.label || (gameId === 'mathpk' ? '数学 PK' : gameId);

        let listHtml = '';
        if (!recent.length) {
            listHtml = '<li class="lb-empty">还没有对局记录，去玩一局吧 ✨</li>';
        } else {
            listHtml = recent.map(function (r, i) {
                const meta = [];
                if (r.correct !== undefined && r.total !== undefined) {
                    meta.push(`<span class="lb-meta">答对 ${r.correct}/${r.total}</span>`);
                }
                if (r.win !== undefined) {
                    meta.push(`<span class="lb-meta">${r.win ? '🏆 胜' : '⚔️ 负'}</span>`);
                }
                return `<li class="lb-row">
                    <span class="lb-rank">${i === 0 ? '🥇' : '#' + (i + 1)}</span>
                    <span class="lb-score">${r.score}</span>
                    <span class="lb-meta-wrap">${meta.join('')}</span>
                    <span class="lb-ts">${_fmtDate(r.ts)}</span>
                </li>`;
            }).join('');
        }

        // 进步趋势：把历史 best 也标出
        const trendNote = (function () {
            if (scoresAsc.length < 2) return '';
            const first = scoresAsc[0];
            const last = scoresAsc[scoresAsc.length - 1];
            const delta = last - first;
            if (delta > 0) return `<span class="lb-trend up">📈 +${delta} 进步</span>`;
            if (delta < 0) return `<span class="lb-trend down">📉 ${delta} 退步</span>`;
            return `<span class="lb-trend flat">➖ 持平</span>`;
        })();

        el.innerHTML = `
        <div class="lb-page card">
            <div class="card-header">
                <h2 class="text-lg font-bold">🏆 ${gameLabel} 排行榜</h2>
                <p class="text-xs mt-1 text-muted">和自己赛跑 · 记录最高分与最近 ${RECENT_MAX} 局</p>
            </div>
            <div class="lb-body">
                ${_renderCloudSummary(gameId)}
                <div class="lb-best-card">
                    <div class="lb-best-label">最高分</div>
                    <div class="lb-best-num">${data.best}</div>
                    <div class="lb-best-trend">${trendNote}</div>
                </div>
                <div class="lb-spark-wrap">
                    <div class="lb-spark-label">最近得分趋势</div>
                    <div class="lb-spark">${_sparkline(scoresAsc)}</div>
                </div>
                <div class="lb-list-wrap">
                    <div class="lb-list-label">最近 ${RECENT_MAX} 局</div>
                    <ul class="lb-list">${listHtml}</ul>
                </div>
            </div>
        </div>`;
    }

    window.Leaderboard = {
        record: record,
        getBest: getBest,
        getRecent: getRecent,
        renderUI: renderUI,
        _read: _read // 供迁移逻辑内部使用
    };
})();
