(function () {
    'use strict';

    const state = {
        loading: false,
        info: '',
        error: '',
        matches: [],
        pendingMatches: []
    };

    const ONLY_HOUSEHOLD_PK_NOTICE = 'only household peers can challenge right now';

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

    function getActiveLocalProfile() {
        return window.ProfileManager && typeof window.ProfileManager.getActive === 'function'
            ? window.ProfileManager.getActive()
            : null;
    }

    function getSocialState() {
        return window.SocialSystem && typeof window.SocialSystem.getState === 'function'
            ? window.SocialSystem.getState()
            : null;
    }

    function getPeerSourceLabel(peer) {
        return peer && peer.peerType === 'household' ? '家庭成员' : '好友';
    }

    function canChallengePeer(peer) {
        return Boolean(peer) && (peer.peerType === 'household' || peer.pk_access !== 'private');
    }

    function getAvailablePeers(socialState) {
        if (!socialState) return [];

        const householdPeers = Array.isArray(socialState.householdPeers)
            ? socialState.householdPeers
            : [];
        const friends = Array.isArray(socialState.friends)
            ? socialState.friends
            : [];
        const peerMap = new Map();

        householdPeers.concat(friends).forEach(function (peer) {
            if (!peer || !peer.id || peerMap.has(peer.id)) return;
            peerMap.set(peer.id, peer);
        });

        return Array.from(peerMap.values()).filter(canChallengePeer);
    }

    async function getChildSocialProfiles(childIds) {
        const targetIds = [...new Set((childIds || []).filter(Boolean))];
        if (!targetIds.length) return [];
        if (!window.CloudClient || typeof window.CloudClient.getChildSocialProfiles !== 'function') {
            throw new Error('云端社交资料读取器尚未就绪');
        }

        const rows = await window.CloudClient.getChildSocialProfiles(targetIds);
        const profileMap = new Map((rows || []).map(function (child) {
            return [child.id, child];
        }));

        return targetIds.map(function (id) {
            return profileMap.get(id);
        }).filter(Boolean);
    }

    function getMountId(gameType) {
        return gameType === 'hanzi' ? 'hanzi-async-root' : 'mathpk-async-root';
    }

    function getGameHandler(gameType) {
        return gameType === 'hanzi' ? window.HanziGame : window.MathPKGame;
    }

    function getQuestionSetSummary(match) {
        const handler = getGameHandler(match && match.gameType);
        if (handler && typeof handler.describeAsyncQuestionSet === 'function') {
            return handler.describeAsyncQuestionSet(match.questionSetPayload || {});
        }
        return {
            modeLabel: match && match.gameType === 'hanzi' ? '汉字 PK' : '数学 PK',
            summaryText: match && match.gameType === 'hanzi' ? '汉字同题挑战' : '数学同题挑战'
        };
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

    function formatDuration(durationMs) {
        const totalMs = Number(durationMs || 0);
        if (!Number.isFinite(totalMs) || totalMs <= 0) return '未记录';
        const totalSeconds = Math.round(totalMs / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        if (minutes > 0) {
            return minutes + '分' + String(seconds).padStart(2, '0') + '秒';
        }
        return totalSeconds + '秒';
    }

    function isExpired(match) {
        return Boolean(match.expiresAt && new Date(match.expiresAt).getTime() < Date.now());
    }

    function compareAttempts(myAttempt, peerAttempt) {
        if (!myAttempt || !peerAttempt) return 'pending';
        if (myAttempt.score > peerAttempt.score) return 'win';
        if (myAttempt.score < peerAttempt.score) return 'lose';

        const myDuration = Number(myAttempt.durationMs || myAttempt.duration_ms || Number.MAX_SAFE_INTEGER);
        const peerDuration = Number(peerAttempt.durationMs || peerAttempt.duration_ms || Number.MAX_SAFE_INTEGER);
        if (myDuration < peerDuration) return 'win';
        if (myDuration > peerDuration) return 'lose';
        return 'draw';
    }

    function getQuestionTotal(match) {
        if (!match) return 0;
        if (match.questionSetPayload && Array.isArray(match.questionSetPayload.questions)) {
            return match.questionSetPayload.questions.length;
        }
        return Number(match.questionSetPayload && match.questionSetPayload.totalRounds) || 0;
    }

    function formatAttemptSummary(label, attempt, total) {
        if (!attempt) return label + '：未提交';
        const correctCount = Number(attempt.correctCount || attempt.correct_count || 0);
        const duration = formatDuration(attempt.durationMs || attempt.duration_ms);
        const parts = [
            label + '：' + attempt.score + ' 分',
            '答对 ' + correctCount + '/' + total,
            '用时 ' + duration
        ];
        return parts.join(' · ');
    }

    function getTieBreakerNote(match) {
        if (!match || !match.myAttempt || !match.peerAttempt) return '';
        if (Number(match.myAttempt.score) !== Number(match.peerAttempt.score)) return '';
        const myDuration = Number(match.myAttempt.durationMs || match.myAttempt.duration_ms || Number.MAX_SAFE_INTEGER);
        const peerDuration = Number(match.peerAttempt.durationMs || match.peerAttempt.duration_ms || Number.MAX_SAFE_INTEGER);
        if (myDuration === peerDuration) return '双方同分同用时，本场判定为平局。';
        return '双方同分，系统按用时更短者胜出。';
    }

    function decorateMatch(match, activeChildId) {
        const myAttempt = match.myAttempt || null;
        const peerAttempt = match.peerAttempt || null;
        const expired = isExpired(match);
        const pendingForMe = !myAttempt && !expired && match.status !== 'completed';
        const awaitingPeer = Boolean(myAttempt && !peerAttempt && !expired && match.status !== 'completed');
        const outcome = compareAttempts(myAttempt, peerAttempt);

        let statusText = '准备就绪';
        if (expired) statusText = '挑战已过期';
        else if (pendingForMe) statusText = '轮到你应战';
        else if (awaitingPeer) statusText = '等待好友作答';
        else if (outcome === 'win') statusText = '你赢了';
        else if (outcome === 'lose') statusText = '好友胜出';
        else if (outcome === 'draw') statusText = '平局';
        else if (match.status === 'completed') statusText = '已结束';

        return Object.assign({}, match, {
            activeChildId: activeChildId,
            pendingForMe: pendingForMe,
            awaitingPeer: awaitingPeer,
            expired: expired,
            outcome: outcome,
            statusText: statusText
        });
    }

    function getMatchesForGame(gameType) {
        return state.matches.filter(function (match) {
            return match.gameType === gameType;
        });
    }

    function renderMatchList(gameType) {
        const matches = getMatchesForGame(gameType);
        if (!matches.length) {
            return '<div class="pk-match-empty">还没有异步挑战。可以先给好友发起一场同题 PK。</div>';
        }

        return `
            <div class="pk-match-list">
                ${matches.slice(0, 4).map(function (match) {
                    const peerScore = match.peerAttempt ? match.peerAttempt.score : null;
                    const myScore = match.myAttempt ? match.myAttempt.score : null;
                    const questionSetSummary = getQuestionSetSummary(match);
                    return `
                        <div class="pk-match-card ${match.pendingForMe ? 'is-pending' : ''}">
                            <div class="pk-match-row">
                                <div>
                                    <strong>${escapeHtml(match.peerChild.emoji || '🐾')} ${escapeHtml(match.peerChild.display_name)}</strong>
                                    <span>${escapeHtml(match.statusText)} · ${escapeHtml(formatTime(match.createdAt))}</span>
                                    <span>${escapeHtml(questionSetSummary.summaryText || '')}</span>
                                </div>
                                <span class="pk-match-tag">${gameType === 'hanzi' ? '汉字 PK' : '数学 PK'}</span>
                            </div>
                            <div class="pk-match-meta">
                                ${myScore != null ? `<span>你的成绩 ${myScore}</span>` : '<span>你还没作答</span>'}
                                ${peerScore != null ? `<span>好友成绩 ${peerScore}</span>` : '<span>好友待作答</span>'}
                            </div>
                            <div class="pk-match-actions">
                                ${match.pendingForMe
                                    ? `<button class="btn-primary social-main-btn" type="button" onclick="PKService.openMatch('${match.id}')">开始应战</button>`
                                    : `<button class="btn-secondary social-main-btn" type="button" onclick="PKService.viewMatchResult('${match.id}')">查看详情</button>`}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderBanner(gameType) {
        const mount = document.getElementById(getMountId(gameType));
        if (!mount) return;
        const matches = getMatchesForGame(gameType);
        const pendingCount = matches.filter(function (match) { return match.pendingForMe; }).length;

        mount.innerHTML = `
            <div class="pk-async-banner">
                <div>
                    <strong>异步 PK</strong>
                    <span>和家庭成员或好友做同一套题，不需要同时在线。${pendingCount > 0 ? ' 当前有 ' + pendingCount + ' 场等你应战。' : ''}</span>
                </div>
                <button class="btn-secondary pk-async-btn" type="button" onclick="PKService.openComposer('${gameType}')">发起挑战</button>
            </div>
            ${renderMatchList(gameType)}
            ${state.info ? `<div class="auth-notice auth-info">${escapeHtml(state.info)}</div>` : ''}
            ${state.error ? `<div class="auth-notice auth-error">${escapeHtml(state.error)}</div>` : ''}
        `;
    }

    function renderAll() {
        renderBanner('mathpk');
        renderBanner('hanzi');
    }

    function choosePeer(peers) {
        if (!peers.length) return null;
        if (peers.length === 1) return peers[0];
        const promptText = peers.map(function (peer, index) {
            return (index + 1) + '. ' + peer.display_name + '（' + getPeerSourceLabel(peer) + '）';
        }).join('\n');
        const raw = window.prompt('选择要发起异步 PK 的孩子编号：\n' + promptText, '1');
        const index = Number(raw || '1') - 1;
        return peers[index] || null;
    }

    async function buildPayload(gameType) {
        const handler = getGameHandler(gameType);
        if (handler && typeof handler.buildAsyncQuestionSet === 'function') {
            return handler.buildAsyncQuestionSet();
        }
        throw new Error('题目导出器尚未就绪');
    }

    async function fetchMatches() {
        const client = getClient();
        const socialState = getSocialState();
        if (!client || !socialState || !socialState.activeCloudChild) {
            state.matches = [];
            state.pendingMatches = [];
            return state.matches;
        }

        const activeChildId = socialState.activeCloudChild.id;
        const matchResult = await client
            .from('pk_matches')
            .select('id,game_type,question_set_id,challenger_child_id,opponent_child_id,status,difficulty,expires_at,created_at')
            .or('challenger_child_id.eq.' + activeChildId + ',opponent_child_id.eq.' + activeChildId)
            .in('status', ['pending', 'active', 'completed'])
            .order('created_at', { ascending: false })
            .limit(12);

        if (matchResult.error) throw matchResult.error;
        const matches = matchResult.data || [];
        if (!matches.length) {
            state.matches = [];
            state.pendingMatches = [];
            return state.matches;
        }

        const questionSetIds = [...new Set(matches.map(function (row) { return row.question_set_id; }))];
        const childIds = [...new Set(matches.flatMap(function (row) {
            return [row.challenger_child_id, row.opponent_child_id];
        }))];
        const matchIds = matches.map(function (row) { return row.id; });

        const questionSetResult = await client
            .from('pk_question_sets')
            .select('id,payload_json,difficulty,game_type')
            .in('id', questionSetIds);
        if (questionSetResult.error) throw questionSetResult.error;

        const attemptResult = await client
            .from('pk_match_attempts')
            .select('match_id,child_id,score,correct_count,duration_ms,payload_json,completed_at')
            .in('match_id', matchIds);
        if (attemptResult.error) throw attemptResult.error;

        const questionSetMap = new Map((questionSetResult.data || []).map(function (row) {
            return [row.id, row];
        }));
        const childProfiles = await getChildSocialProfiles(childIds);
        const childMap = new Map(childProfiles.map(function (row) {
            return [row.id, row];
        }));
        const attemptsByMatch = new Map();
        (attemptResult.data || []).forEach(function (attempt) {
            if (!attemptsByMatch.has(attempt.match_id)) attemptsByMatch.set(attempt.match_id, []);
            attemptsByMatch.get(attempt.match_id).push(attempt);
        });

        state.matches = matches.map(function (row) {
            const attempts = attemptsByMatch.get(row.id) || [];
            const myAttempt = attempts.find(function (attempt) { return attempt.child_id === activeChildId; }) || null;
            const peerId = row.challenger_child_id === activeChildId ? row.opponent_child_id : row.challenger_child_id;
            const peerAttempt = attempts.find(function (attempt) { return attempt.child_id === peerId; }) || null;
            const questionSet = questionSetMap.get(row.question_set_id) || null;
            const decorated = decorateMatch({
                id: row.id,
                gameType: row.game_type,
                questionSetId: row.question_set_id,
                questionSetPayload: questionSet ? questionSet.payload_json : null,
                status: row.status,
                difficulty: row.difficulty,
                expiresAt: row.expires_at,
                createdAt: row.created_at,
                challengerChild: childMap.get(row.challenger_child_id) || { id: row.challenger_child_id, display_name: '挑战方', emoji: '🐾' },
                peerChild: childMap.get(peerId) || { id: peerId, display_name: '好友', emoji: '🐾' },
                myAttempt: myAttempt ? {
                    score: myAttempt.score,
                    correctCount: myAttempt.correct_count,
                    durationMs: myAttempt.duration_ms,
                    payloadJson: myAttempt.payload_json,
                    completedAt: myAttempt.completed_at
                } : null,
                peerAttempt: peerAttempt ? {
                    score: peerAttempt.score,
                    correctCount: peerAttempt.correct_count,
                    durationMs: peerAttempt.duration_ms,
                    payloadJson: peerAttempt.payload_json,
                    completedAt: peerAttempt.completed_at
                } : null
            }, activeChildId);
            return decorated;
        });

        state.pendingMatches = state.matches.filter(function (match) {
            return match.pendingForMe;
        });
        return state.matches;
    }

    async function refresh() {
        state.loading = true;
        state.error = '';
        renderAll();
        try {
            await fetchMatches();
        } catch (error) {
            state.error = error && error.message ? error.message : '异步 PK 列表刷新失败';
        } finally {
            state.loading = false;
            renderAll();
        }
        return state;
    }

    async function openComposer(gameType) {
        state.info = '';
        state.error = '';
        renderAll();

        const client = getClient();
        const socialState = getSocialState();
        const activeProfile = getActiveLocalProfile();

        if (!client || !socialState || !socialState.activeCloudChild || !activeProfile) {
            state.error = '请先登录云端、创建家庭并同步当前孩子，再发起异步 PK。';
            renderAll();
            return false;
        }

        const peers = getAvailablePeers(socialState);
        if (!peers.length) {
            state.error = '请先同步同家庭的其他孩子，或添加至少一位好友。部分好友当前只开放给家庭里的孩子 PK。';
            renderAll();
            return false;
        }

        const friend = choosePeer(peers);
        if (!friend) {
            state.error = '没有选中要挑战的孩子。';
            renderAll();
            return false;
        }

        try {
            const payload = await buildPayload(gameType);
            const difficulty = payload.difficulty || payload.level || null;
            const result = await client.functions.invoke('issue-pk-match', {
                body: {
                    gameType: gameType,
                    localProfileId: activeProfile.id,
                    childId: socialState.activeCloudChild.id,
                    opponentChildId: friend.id,
                    difficulty: difficulty,
                    payloadJson: payload
                }
            });
            if (result && result.error) throw result.error;

            const label = gameType === 'hanzi' ? '汉字 PK' : '数学 PK';
            state.info = label + ' 已发给「' + friend.display_name + '」，双方会做同一套题。';
            await refresh();
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '发起异步 PK 失败';
            renderAll();
        }

        return false;
    }

    function findMatch(matchId) {
        return state.matches.find(function (match) {
            return match.id === matchId;
        }) || null;
    }

    function describeOutcome(match) {
        if (!match) return '挑战状态未知。';
        if (match.pendingForMe) return '轮到你应战，和好友做同一套题吧。';
        if (match.awaitingPeer) return '你的成绩已提交，正在等待好友完成同题挑战。';
        if (match.outcome === 'win') return '你赢下了这场异步 PK。';
        if (match.outcome === 'lose') return '这场异步 PK 由好友胜出。';
        if (match.outcome === 'draw') return '这场异步 PK 打成平局。';
        if (match.expired) return '这场异步 PK 已经过期。';
        return '挑战还在进行中。';
    }

    function viewMatchResult(matchId) {
        const match = findMatch(matchId);
        if (!match) {
            window.alert('还没有拿到这场挑战的最新状态。');
            return false;
        }

        const lines = [
            (match.gameType === 'hanzi' ? '汉字 PK' : '数学 PK') + ' · ' + match.peerChild.display_name,
            getQuestionSetSummary(match).summaryText,
            describeOutcome(match),
            formatAttemptSummary('你的成绩', match.myAttempt, getQuestionTotal(match)),
            formatAttemptSummary('好友成绩', match.peerAttempt, getQuestionTotal(match))
        ];
        const tieBreakerNote = getTieBreakerNote(match);
        if (tieBreakerNote) lines.push(tieBreakerNote);
        window.alert(lines.join('\n'));
        return false;
    }

    function openMatch(matchId) {
        const match = findMatch(matchId);
        if (!match) {
            state.error = '还没有拿到这场挑战的题目。请稍后重试。';
            renderAll();
            return false;
        }

        const handler = getGameHandler(match.gameType);
        if (!handler || typeof handler.startAsyncMatch !== 'function') {
            state.error = '当前玩法还没有接好异步挑战入口。';
            renderAll();
            return false;
        }

        if (!match.questionSetPayload || !Array.isArray(match.questionSetPayload.questions)) {
            state.error = '这场挑战的题目数据不完整。';
            renderAll();
            return false;
        }

        handler.startAsyncMatch(match);
        return false;
    }

    async function submitAttempt(matchId, summary) {
        const client = getClient();
        const socialState = getSocialState();
        const activeProfile = getActiveLocalProfile();
        if (!client || !socialState || !socialState.activeCloudChild || !activeProfile) {
            throw new Error('云端账号或当前孩子还没有准备好，无法提交异步 PK 成绩。');
        }

        const result = await client.functions.invoke('submit-pk-attempt', {
            body: {
                matchId: matchId,
                localProfileId: activeProfile.id,
                childId: socialState.activeCloudChild.id,
                summary: summary
            }
        });
        if (result && result.error) throw result.error;

        await refresh();
        if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
            await window.ActivityFeedSystem.refresh();
        }
        const updatedMatch = findMatch(matchId);
        const message = describeOutcome(updatedMatch);
        state.info = message;
        renderAll();
        return {
            match: updatedMatch,
            message: message
        };
    }

    window.PKService = {
        renderBanner,
        renderAll,
        refresh,
        openComposer,
        openMatch,
        viewMatchResult,
        submitAttempt,
        getAvailablePeers,
        getState() {
            return {
                loading: state.loading,
                info: state.info,
                error: state.error,
                matches: state.matches.slice(),
                pendingMatches: state.pendingMatches.slice()
            };
        }
    };
})();
