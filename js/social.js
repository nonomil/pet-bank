(function () {
    'use strict';

    const ACTION_META = {
        visit: { label: '来串门', icon: '🏠', message: '来小屋串门啦！' },
        wave: { label: '打招呼', icon: '👋', message: '在门口热情地打了招呼！' },
        gift: { label: '送小花', icon: '🌼', message: '送来一朵友谊小花！' },
        walk: { label: '一起遛弯', icon: '🚶', message: '约上伙伴一起去遛弯啦！' }
    };

    const LOCAL_VISIT_KEY = 'petbank_social_local_visits';

    const state = {
        loading: false,
        info: '',
        error: '',
        activeCloudChild: null,
        activeVisitPeerId: '',
        walkInvitePeerId: '',
        householdPeers: [],
        friends: [],
        visits: []
    };

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function safeParse(raw, fallback) {
        if (raw == null) return fallback;
        try {
            return JSON.parse(raw);
        } catch (error) {
            return fallback;
        }
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

    function getActiveLocalProfile() {
        return window.ProfileManager && typeof window.ProfileManager.getActive === 'function'
            ? window.ProfileManager.getActive()
            : null;
    }

    function getHouseholdState() {
        return window.HouseholdSystem && typeof window.HouseholdSystem.getState === 'function'
            ? window.HouseholdSystem.getState()
            : null;
    }

    function getCloudReady() {
        const authState = getAuthState();
        return Boolean(getClient() && authState && authState.user);
    }

    function shouldShowPKControls() {
        if (!window.FamilySocialScope || typeof window.FamilySocialScope.shouldShowPKControls !== 'function') {
            return true;
        }
        return window.FamilySocialScope.shouldShowPKControls();
    }

    function getScopeSummaryCopy() {
        return shouldShowPKControls()
            ? '先接家庭里的其他孩子、好友码和串门记录，下一步会把同一套互动关系接到数学 PK 和汉字 PK 上。'
            : '一期先做好友码、串门和轻互动，数学 PK 与识字 PK 暂缓到二期。';
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

    function getActionMeta(actionType) {
        return ACTION_META[actionType] || ACTION_META.visit;
    }

    function getVisibilityLabel(value) {
        return value === 'private' ? '仅家庭可见' : '好友可见';
    }

    function getPeerSourceLabel(peer) {
        return peer && peer.peerType === 'household' ? '家庭成员' : '好友';
    }

    function getAccessLabel(value, kind) {
        if (value === 'private') {
            return kind === 'pk' ? '仅家庭可 PK' : '仅家庭可串门';
        }
        return kind === 'pk' ? '好友可 PK' : '好友可串门';
    }

    function canVisitPeer(peer) {
        return Boolean(peer) && (peer.peerType === 'household' || peer.visit_access !== 'private');
    }

    function canViewPeerHome(peer) {
        return Boolean(peer) && (peer.peerType === 'household' || peer.home_visibility !== 'private');
    }

    function getWalkRoutes() {
        if (window.WalkSystem && typeof window.WalkSystem.getRoutes === 'function') {
            return window.WalkSystem.getRoutes();
        }
        return [
            { id: 'park', name: '🌳 公园', desc: '环境优雅，适合散步' },
            { id: 'river', name: '🌊 河边', desc: '清凉宜人，风景优美' },
            { id: 'mall', name: '🛍️ 商场', desc: '繁华热闹，偶遇惊喜' },
            { id: 'school', name: '🏫 学校', desc: '充满活力，适合学习' }
        ];
    }

    function getWalkRoute(routeId) {
        return getWalkRoutes().find(function (route) {
            return route.id === routeId;
        }) || null;
    }

    function findPeer(peerChildId) {
        return state.householdPeers.concat(state.friends).find(function (peer) {
            return peer && peer.id === peerChildId;
        }) || null;
    }

    function readLocalVisits(profileId) {
        const bag = safeParse(localStorage.getItem(LOCAL_VISIT_KEY), {});
        return Array.isArray(bag[profileId]) ? bag[profileId] : [];
    }

    function writeLocalVisit(profileId, visit) {
        const bag = safeParse(localStorage.getItem(LOCAL_VISIT_KEY), {});
        const list = Array.isArray(bag[profileId]) ? bag[profileId] : [];
        list.unshift(visit);
        bag[profileId] = list.slice(0, 8);
        localStorage.setItem(LOCAL_VISIT_KEY, JSON.stringify(bag));
    }

    async function resolveActiveCloudChild(client) {
        const activeProfile = getActiveLocalProfile();
        if (!activeProfile) return null;

        const result = await client
            .from('child_profiles')
            .select('id,household_id,display_name,emoji,friend_code,local_profile_id,home_visibility,visit_access,pk_access,pet_summary_json,home_summary_json,last_synced_at,created_at')
            .eq('local_profile_id', activeProfile.id)
            .order('created_at', { ascending: false })
            .limit(1);

        if (result.error) throw result.error;
        return result.data && result.data.length ? result.data[0] : null;
    }

    async function fetchFriendProfiles(client, activeCloudChild) {
        if (!activeCloudChild) return [];

        const friendshipResult = await client
            .from('child_friendships')
            .select('friend_child_id,created_at,status')
            .eq('child_id', activeCloudChild.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false });

        if (friendshipResult.error) throw friendshipResult.error;

        const ids = (friendshipResult.data || []).map(function (row) {
            return row.friend_child_id;
        });
        if (!ids.length) return [];

        const rows = await getChildSocialProfiles(ids);
        const profileMap = new Map(rows.map(function (child) {
            return [child.id, child];
        }));

        return ids.map(function (id) {
            const child = profileMap.get(id);
            return child ? Object.assign({}, child, { peerType: 'friend' }) : null;
        }).filter(Boolean);
    }

    function getHouseholdPeers(activeCloudChild, householdState) {
        const cloudChildren = householdState && Array.isArray(householdState.cloudChildren)
            ? householdState.cloudChildren
            : [];
        if (!activeCloudChild || !cloudChildren.length) return [];

        return cloudChildren.filter(function (child) {
            return child
                && child.id !== activeCloudChild.id
                && child.household_id === activeCloudChild.household_id;
        }).map(function (child) {
            return Object.assign({}, child, { peerType: 'household' });
        });
    }

    async function fetchVisits(client, activeCloudChild) {
        if (!activeCloudChild) return [];

        const visitResult = await client
            .from('house_visits')
            .select('id,from_child_id,to_child_id,action_type,message,metadata_json,created_at')
            .or('from_child_id.eq.' + activeCloudChild.id + ',to_child_id.eq.' + activeCloudChild.id)
            .order('created_at', { ascending: false })
            .limit(8);

        if (visitResult.error) throw visitResult.error;

        const rows = visitResult.data || [];
        const childIds = [...new Set(rows.flatMap(function (visit) {
            return [visit.from_child_id, visit.to_child_id];
        }))];

        const socialProfiles = childIds.length ? await getChildSocialProfiles(childIds) : [];
        const profileMap = new Map(socialProfiles.map(function (child) {
            return [child.id, child];
        }));
        const respondedInviteIds = new Set(rows.map(function (visit) {
            return visit && visit.metadata_json ? visit.metadata_json.response_to_visit_id : '';
        }).filter(Boolean));

        return rows.map(function (visit) {
            const meta = visit.metadata_json || {};
            const fromChild = profileMap.get(visit.from_child_id);
            const toChild = profileMap.get(visit.to_child_id);
            const incoming = visit.to_child_id === activeCloudChild.id;
            const peer = incoming ? fromChild : toChild;
            const peerChildId = incoming ? visit.from_child_id : visit.to_child_id;
            const pendingWalkInvite = incoming
                && visit.action_type === 'walk'
                && meta.kind === 'walk_invite'
                && !respondedInviteIds.has(visit.id);
            return {
                id: visit.id,
                actionType: visit.action_type,
                message: visit.message,
                metadata: meta,
                routeId: meta.route_id || '',
                routeName: meta.route_name || '',
                pendingWalkInvite: pendingWalkInvite,
                peerChildId: peerChildId,
                createdAt: visit.created_at,
                incoming: incoming,
                peerName: peer ? peer.display_name : '互动同伴',
                peerEmoji: peer ? (peer.emoji || '🐾') : '🐾'
            };
        });
    }

    function renderPeerList(peers, emptyText) {
        if (!peers.length) {
            return '<div class="social-empty">' + escapeHtml(emptyText) + '</div>';
        }

        return `
            <div class="social-friend-list">
                ${peers.map(function (peer) {
                    const codeCopy = peer.friend_code
                        ? '好友码 ' + escapeHtml(peer.friend_code) + ' · '
                        : '';
                    return `
                        <div class="social-friend-card">
                            <div class="social-friend-main">
                                <div class="social-friend-emoji">${escapeHtml(peer.emoji || '🐾')}</div>
                                <div class="social-friend-copy">
                                    <strong>${escapeHtml(peer.display_name)}</strong>
                                    <span>${escapeHtml(getPeerSourceLabel(peer))} · ${codeCopy}${escapeHtml(getVisibilityLabel(peer.home_visibility))} · ${escapeHtml(getAccessLabel(peer.visit_access, 'visit'))}${shouldShowPKControls() ? ' · ' + escapeHtml(getAccessLabel(peer.pk_access, 'pk')) : ''}</span>
                                </div>
                            </div>
                            <div class="social-house-preview">
                                <div class="social-house-preview-title">${escapeHtml(getPeerSourceLabel(peer))}小屋</div>
                                ${renderFriendHousePreview(peer)}
                            </div>
                            <div class="social-friend-actions">
                                <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.recordVisit('${peer.id}','wave')" ${canVisitPeer(peer) ? '' : 'disabled'}>👋 打招呼</button>
                                <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.recordVisit('${peer.id}','visit')" ${canVisitPeer(peer) && canViewPeerHome(peer) ? '' : 'disabled'}>🏠 串门</button>
                                <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.recordVisit('${peer.id}','gift')" ${canVisitPeer(peer) ? '' : 'disabled'}>🌼 送花</button>
                                <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.openWalkInvite('${peer.id}')" ${canVisitPeer(peer) ? '' : 'disabled'}>🚶 一起遛弯</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderHouseholdPeerList() {
        return renderPeerList(
            state.householdPeers,
            '同一家庭下还没有其他已同步的孩子。把多个孩子同步到同一个家庭后，就能直接互相串门和互动。'
        );
    }

    function renderFriendList() {
        return renderPeerList(
            state.friends,
            '还没有跨家庭好友。兑换好友码后，就能和其他家庭互相串门和互动啦。'
        );
    }

    function renderFriendHousePreview(friend) {
        const petSummary = friend.pet_summary_json || {};
        const homeSummary = friend.home_summary_json || {};
        const peerLabel = getPeerSourceLabel(friend);
        if (!canViewPeerHome(friend)) {
            return '<div class="social-house-private">这个' + escapeHtml(peerLabel) + '把小屋设成了仅家庭可见。</div>';
        }
        if (!petSummary.species_name && !homeSummary.theme_name) {
            return '<div class="social-house-private">' + escapeHtml(peerLabel) + '小屋还没有同步最新摘要。</div>';
        }
        return `
            <div class="social-house-grid">
                <div class="social-house-chip">🐾 ${escapeHtml(petSummary.species_name || '还没领养宠物')} ${petSummary.level ? '· Lv.' + escapeHtml(petSummary.level) : ''}</div>
                <div class="social-house-chip">🏠 ${escapeHtml(homeSummary.theme_name || '默认小屋')}</div>
                <div class="social-house-chip">✨ 胜场 ${escapeHtml(petSummary.wins || 0)}</div>
                <div class="social-house-chip">🧭 探索 ${escapeHtml(petSummary.explorations || 0)}</div>
            </div>
        `;
    }

    function getVisitBodyCopy(visit, action) {
        if (visit.pendingWalkInvite) {
            return '邀请你按同一路线去遛弯：' + escapeHtml(visit.routeName || '好友推荐路线');
        }
        if (visit.actionType === 'walk' && visit.metadata && visit.metadata.kind === 'walk_reply') {
            return '已经按同一路线去遛弯啦：' + escapeHtml(visit.routeName || '好友路线');
        }
        if (visit.actionType === 'walk' && visit.routeName) {
            return escapeHtml(visit.message || action.message) + ' · ' + escapeHtml(visit.routeName);
        }
        return escapeHtml(visit.message || action.message);
    }

    function renderWalkInviteAction(visit, compact) {
        if (!visit.pendingWalkInvite) return '';
        return `
            <div class="${compact ? 'home-visit-action' : 'social-visit-action'}">
                <button class="btn-primary social-mini-btn" type="button" onclick="SocialSystem.acceptWalkInvite('${visit.id}')">按同路线遛弯</button>
            </div>
        `;
    }

    function renderVisitList(activeProfile) {
        if (!getCloudReady()) {
            const localVisits = activeProfile ? readLocalVisits(activeProfile.id) : [];
            if (!localVisits.length) {
                return '<div class="social-empty">连接云端后，这里会显示跨家庭串门和互动记录。</div>';
            }

            return `
                <div class="social-visit-list">
                    ${localVisits.map(function (visit) {
                        return `
                            <div class="social-visit-item">
                                <div class="social-visit-title">本地演示 · ${escapeHtml(visit.message || '好友互动')}</div>
                                <div class="social-visit-meta">${escapeHtml(formatTime(visit.createdAt))}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (!state.visits.length) {
            return '<div class="social-empty">还没有串门记录。先和其他孩子打个招呼吧。</div>';
        }

        return `
            <div class="social-visit-list">
                ${state.visits.map(function (visit) {
                    const action = getActionMeta(visit.actionType);
                    return `
                        <div class="social-visit-item">
                            <div class="social-visit-title">${visit.incoming ? '收到' : '发出'}${action.icon} ${escapeHtml(visit.peerEmoji)} ${escapeHtml(visit.peerName)}</div>
                            <div class="social-visit-body">${getVisitBodyCopy(visit, action)}</div>
                            ${renderWalkInviteAction(visit, false)}
                            <div class="social-visit-meta">${escapeHtml(formatTime(visit.createdAt))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderHomeVisitItems(activeProfile) {
        if (!getCloudReady()) {
            const localVisits = activeProfile ? readLocalVisits(activeProfile.id) : [];
            if (!localVisits.length) {
                return '<div class="social-empty">等好友来串门后，这里会亮起第一条来访足迹。</div>';
            }

            return `
                <div class="home-visit-list">
                    ${localVisits.slice(0, 3).map(function (visit) {
                        const action = getActionMeta(visit.actionType);
                        return `
                            <div class="home-visit-item">
                                <div class="home-visit-title">本地演示 · ${escapeHtml(action.icon)} ${escapeHtml(action.label)}</div>
                                <div class="home-visit-body">${escapeHtml(visit.message || action.message)}</div>
                                <div class="home-visit-meta">${escapeHtml(formatTime(visit.createdAt))}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        if (!state.visits.length) {
            return '<div class="social-empty">还没有真实来访记录。先邀请好友来逛逛你的小屋吧。</div>';
        }

        return `
            <div class="home-visit-list">
                ${state.visits.slice(0, 3).map(function (visit) {
                    const action = getActionMeta(visit.actionType);
                    return `
                        <div class="home-visit-item">
                            <div class="home-visit-title">${visit.incoming ? '收到' : '发出'} ${escapeHtml(action.icon)} ${escapeHtml(visit.peerEmoji)} ${escapeHtml(visit.peerName)}</div>
                            <div class="home-visit-body">${getVisitBodyCopy(visit, action)}</div>
                            ${renderWalkInviteAction(visit, true)}
                            <div class="home-visit-meta">${escapeHtml(formatTime(visit.createdAt))}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function buildHomeVisitSlotMarkup() {
        const activeProfile = getActiveLocalProfile();
        const count = getCloudReady()
            ? state.visits.length
            : (activeProfile ? readLocalVisits(activeProfile.id).length : 0);
        return `
            <section class="home-card home-visit-shell">
                <div class="social-section-head">
                    <h4>最近来访</h4>
                    <span>${count} 条</span>
                </div>
                ${renderHomeVisitItems(activeProfile)}
            </section>
        `;
    }

    function buildFriendHomeVisitMarkup() {
        const peer = state.activeVisitPeerId ? findPeer(state.activeVisitPeerId) : null;
        if (!peer) {
            return `
                <section class="social-shell friend-home-visit-empty">
                    <div class="social-shell-head">
                        <div>
                            <p class="auth-eyebrow">好友小屋 / 访客模式</p>
                            <h3>还没有选中要访问的小屋</h3>
                        </div>
                        <button class="btn-secondary social-main-btn" type="button" onclick="switchPage('home')">回自己的小屋</button>
                    </div>
                    <p class="auth-copy">从“家庭里的其他孩子”或“好友列表”里点“串门”，就能进入对方的小屋访客页。</p>
                </section>
            `;
        }

        if (!canViewPeerHome(peer)) {
            return `
                <section class="social-shell friend-home-visit-empty">
                    <div class="social-shell-head">
                        <div>
                            <p class="auth-eyebrow">好友小屋 / 访客模式</p>
                            <h3>${escapeHtml(peer.display_name)} 的小屋暂不可见</h3>
                        </div>
                        <button class="btn-secondary social-main-btn" type="button" onclick="switchPage('home')">回自己的小屋</button>
                    </div>
                    <p class="auth-copy">这个${escapeHtml(getPeerSourceLabel(peer))}把小屋设成了仅家庭可见。</p>
                </section>
            `;
        }

        const petSummary = peer.pet_summary_json || {};
        const homeSummary = peer.home_summary_json || {};
        const gradient = homeSummary.theme_gradient || 'linear-gradient(135deg, #f8fbf7, #eef5f0)';
        const backgroundStyle = homeSummary.background_image
            ? `background:${escapeHtml(gradient)};background-image:linear-gradient(rgba(255,255,255,0.08), rgba(255,255,255,0.1)), url('${escapeHtml(homeSummary.background_image)}');background-size:cover;background-position:center;`
            : `background:${escapeHtml(gradient)};`;
        const petVisual = petSummary.image_url
            ? `<img class="friend-home-pet-img" src="${escapeHtml(petSummary.image_url)}" alt="${escapeHtml(peer.display_name)}">`
            : `<div class="friend-home-pet-emoji">${escapeHtml(petSummary.species_emoji || peer.emoji || '🐾')}</div>`;

        return `
            <section class="social-shell friend-home-visit-shell">
                <div class="social-shell-head">
                    <div>
                        <p class="auth-eyebrow">好友小屋 / 访客模式</p>
                        <h3>${escapeHtml(peer.display_name)} 的宠物小屋</h3>
                    </div>
                    <button class="btn-secondary social-main-btn" type="button" onclick="switchPage('home')">回自己的小屋</button>
                </div>
                <p class="auth-copy">现在是只读参观模式，不会改动对方的数据。你可以看看小屋风格，再顺手打招呼、送花或约一起遛弯。</p>
                <div class="friend-home-hero" style="${backgroundStyle}">
                    <div class="friend-home-hero-copy">
                        <span class="friend-home-badge">${escapeHtml(getPeerSourceLabel(peer))}小屋</span>
                        <h4>${escapeHtml(homeSummary.theme_name || '温馨小屋')}</h4>
                        <p>${escapeHtml(petSummary.species_name || '还没同步宠物摘要')} ${petSummary.level ? '· Lv.' + escapeHtml(petSummary.level) : ''}</p>
                    </div>
                    <div class="friend-home-pet-card">
                        ${petVisual}
                    </div>
                </div>
                <div class="friend-home-info-grid">
                    <div class="friend-home-info-card">
                        <span>🐾 宠物</span>
                        <strong>${escapeHtml(petSummary.species_name || '还没领养宠物')}</strong>
                        <small>${petSummary.level ? '等级 Lv.' + escapeHtml(petSummary.level) : '等待同步等级'}</small>
                    </div>
                    <div class="friend-home-info-card">
                        <span>🏠 主题</span>
                        <strong>${escapeHtml(homeSummary.theme_name || '默认小屋')}</strong>
                        <small>${escapeHtml(getVisibilityLabel(peer.home_visibility))}</small>
                    </div>
                    <div class="friend-home-info-card">
                        <span>✨ 战绩</span>
                        <strong>${escapeHtml(petSummary.wins || 0)} 场胜利</strong>
                        <small>探索 ${escapeHtml(petSummary.explorations || 0)} 次</small>
                    </div>
                    <div class="friend-home-info-card">
                        <span>🛋️ 家具</span>
                        <strong>${escapeHtml(homeSummary.furniture_count || 0)} 件</strong>
                        <small>已摆放 ${escapeHtml(homeSummary.occupied_slots || 0)} 个位置</small>
                    </div>
                </div>
                <div class="social-friend-actions friend-home-actions">
                    <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.recordVisit('${peer.id}','wave')">👋 打招呼</button>
                    <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.recordVisit('${peer.id}','gift')">🌼 送花</button>
                    <button class="btn-secondary social-mini-btn" type="button" onclick="SocialSystem.openWalkInvite('${peer.id}')">🚶 一起遛弯</button>
                </div>
            </section>
        `;
    }

    function buildWalkInviteModalMarkup() {
        const peer = state.walkInvitePeerId ? findPeer(state.walkInvitePeerId) : null;
        if (!peer) return '';

        const routes = getWalkRoutes();
        return `
            <div class="walk-modal social-walk-invite-modal">
                <div class="social-walk-invite-peer">${escapeHtml(peer.emoji || '🐾')} ${escapeHtml(peer.display_name)}</div>
                <h3 class="walk-title">选择一起遛弯的路线</h3>
                <p class="walk-desc">先挑一条路线发给对方。对方会在自己的小屋里收到“按同路线遛弯”的邀请。</p>
                <div class="walk-route-grid social-walk-invite-grid">
                    ${routes.map(function (route) {
                        return `
                            <button class="walk-route-card" type="button" onclick="SocialSystem.sendWalkInvite('${route.id}')">
                                <div class="walk-route-emoji">${escapeHtml(route.name.split(' ')[0] || '🚶')}</div>
                                <div class="walk-route-name">${escapeHtml(route.name.split(' ')[1] || route.name)}</div>
                                <div class="social-walk-route-desc">${escapeHtml(route.desc || '')}</div>
                            </button>
                        `;
                    }).join('')}
                </div>
                <div class="social-walk-invite-actions">
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.closeWalkInvite()">先不发了</button>
                </div>
            </div>
        `;
    }

    function buildPanelMarkup(variant) {
        const activeProfile = getActiveLocalProfile();
        const householdState = getHouseholdState();
        const primaryHouseholdName = householdState && householdState.primaryHousehold
            ? householdState.primaryHousehold.name
            : '';
        const canUseCloud = getCloudReady();
        const showPKControls = shouldShowPKControls();

        let bodyHtml = '';
        if (state.loading) {
            bodyHtml = '<div class="social-empty">正在刷新家庭孩子、好友码和串门记录…</div>';
        } else if (!canUseCloud) {
            bodyHtml = `
                <div class="social-empty">${showPKControls ? '先登录家长账号并配置云端，才能开启多家庭好友、串门和异步 PK。' : '先登录家长账号并配置云端，才能开启多家庭好友、串门和轻互动。'}</div>
            `;
        } else if (!householdState || !householdState.primaryHouseholdId) {
            bodyHtml = `
                <div class="social-empty">先创建一个家庭，后面才能把多个孩子和好友互动都挂到同一个家庭下面。</div>
                <div class="social-cta-row">
                    <button class="btn-primary social-main-btn" type="button" onclick="HouseholdSystem.ensurePrimaryHousehold()">创建我的家庭</button>
                </div>
            `;
        } else if (!state.activeCloudChild) {
            bodyHtml = `
                <div class="social-empty">当前孩子「${escapeHtml(activeProfile ? activeProfile.name : '未选择')}」还没同步到云端 child 档案。同步后才能生成好友码和串门。</div>
                <div class="social-cta-row">
                    <button class="btn-primary social-main-btn" type="button" onclick="HouseholdSystem.syncActiveChild()">同步当前孩子到云端</button>
                </div>
            `;
        } else {
            bodyHtml = `
                <div class="social-code-card">
                    <div>
                        <p class="social-code-kicker">当前孩子好友码</p>
                        <h4>${escapeHtml(state.activeCloudChild.display_name)} · ${escapeHtml(state.activeCloudChild.friend_code)}</h4>
                        <p class="social-code-sub">${escapeHtml(primaryHouseholdName || '家庭已连接')} · 给其他家庭输入这个好友码，就能互相串门。当前小屋：${escapeHtml(getVisibilityLabel(state.activeCloudChild.home_visibility))} · 当前串门：${escapeHtml(getAccessLabel(state.activeCloudChild.visit_access, 'visit'))}${showPKControls ? ' · 当前 PK：' + escapeHtml(getAccessLabel(state.activeCloudChild.pk_access, 'pk')) : ''}</p>
                    </div>
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.copyFriendCode()">复制好友码</button>
                </div>
                <div class="social-visibility-row">
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.setHomeVisibility('friends')">开放给好友看</button>
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.setHomeVisibility('private')">仅家庭可见</button>
                </div>
                <div class="social-visibility-row">
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.setVisitAccess('friends')">开放好友串门</button>
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.setVisitAccess('private')">仅家庭串门</button>
                </div>
                ${showPKControls ? `
                <div class="social-visibility-row">
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.setPKAccess('friends')">开放好友 PK</button>
                    <button class="btn-secondary social-main-btn" type="button" onclick="SocialSystem.setPKAccess('private')">仅家庭 PK</button>
                </div>` : ''}
                <form class="social-redeem-form" onsubmit="return SocialSystem.redeemFriendCode(event)">
                    <input class="text-input" type="text" name="friendCode" placeholder="输入其他孩子的好友码（如：PET-3F92ABCD）">
                    <button class="btn-primary social-main-btn" type="submit">成为好友</button>
                </form>
                <div class="social-section">
                    <div class="social-section-head">
                        <h4>家庭里的其他孩子</h4>
                        <span>${state.householdPeers.length} 位同伴</span>
                    </div>
                    ${renderHouseholdPeerList()}
                </div>
                <div class="social-section">
                    <div class="social-section-head">
                        <h4>好友列表</h4>
                        <span>${state.friends.length} 位好友</span>
                    </div>
                    ${renderFriendList()}
                </div>
                <div class="social-section">
                    <div class="social-section-head">
                        <h4>最近串门记录</h4>
                        <span>${state.visits.length} 条</span>
                    </div>
                    ${renderVisitList(activeProfile)}
                </div>
            `;
        }

        return `
            <section class="social-shell ${variant === 'settings' ? 'social-shell-settings' : 'social-shell-home'}">
                <div class="social-shell-head">
                    <div>
                        <p class="auth-eyebrow">好友串门与互动</p>
                        <h3>${variant === 'settings' ? '好友码与互动管理' : '宠物小屋好友互动'}</h3>
                    </div>
                    <span class="auth-badge ${canUseCloud ? 'online' : 'offline'}">${canUseCloud ? '云端社交可用' : '等待云端社交'}</span>
                </div>
                <p class="auth-copy">${escapeHtml(getScopeSummaryCopy())}</p>
                ${bodyHtml}
                ${state.info ? `<div class="auth-notice auth-info">${escapeHtml(state.info)}</div>` : ''}
                ${state.error ? `<div class="auth-notice auth-error">${escapeHtml(state.error)}</div>` : ''}
            </section>
        `;
    }

    function renderHomePanel(containerId) {
        const mount = document.getElementById(containerId || 'home-social-panel');
        if (!mount) return;
        mount.innerHTML = buildPanelMarkup('home');
    }

    function renderSettingsPanel(containerId) {
        const mount = document.getElementById(containerId || 'social-root');
        if (!mount) return;
        mount.innerHTML = buildPanelMarkup('settings');
    }

    function renderHomeVisitSlot(containerId) {
        const mount = document.getElementById(containerId || 'home-visit-slot');
        if (!mount) return;
        mount.innerHTML = buildHomeVisitSlotMarkup();
    }

    function renderFriendHomeVisit(containerId) {
        const mount = document.getElementById(containerId || 'friend-home-visit-root');
        if (!mount) return;
        mount.innerHTML = buildFriendHomeVisitMarkup();
    }

    function renderWalkInviteModal() {
        const existing = document.getElementById('socialWalkInviteOverlay');
        if (!state.walkInvitePeerId) {
            if (existing) existing.remove();
            return;
        }

        const overlay = existing || document.createElement('div');
        overlay.id = 'socialWalkInviteOverlay';
        overlay.className = 'walk-overlay social-walk-invite-overlay';
        overlay.innerHTML = buildWalkInviteModalMarkup();
        overlay.onclick = function (event) {
            if (event.target === overlay) {
                closeWalkInvite();
            }
        };
        if (!existing) {
            document.body.appendChild(overlay);
        }
    }

    function renderAll() {
        renderHomeVisitSlot('home-visit-slot');
        renderHomePanel('home-social-panel');
        renderSettingsPanel('social-root');
        renderFriendHomeVisit('friend-home-visit-root');
        renderWalkInviteModal();
        if (typeof window.renderWalkPage === 'function') {
            const walkPage = document.getElementById('page-walk');
            if (walkPage && walkPage.classList.contains('active')) {
                window.renderWalkPage();
            }
        }
    }

    function openPeerHome(peerChildId) {
        const peer = findPeer(peerChildId);
        if (!peer) {
            state.error = '还没找到这个孩子的小屋摘要，请先刷新好友列表。';
            renderAll();
            return false;
        }
        if (!canViewPeerHome(peer)) {
            state.error = '这个孩子把小屋设成了仅家庭可见。';
            renderAll();
            return false;
        }
        state.activeVisitPeerId = peerChildId;
        renderFriendHomeVisit('friend-home-visit-root');
        if (typeof window.switchPage === 'function') {
            window.switchPage('home-visit');
        }
        return false;
    }

    function closeWalkInvite() {
        state.walkInvitePeerId = '';
        renderWalkInviteModal();
        return false;
    }

    function openWalkInvite(peerChildId) {
        const peer = findPeer(peerChildId);
        if (!peer) {
            state.error = '还没找到这个孩子，请先刷新好友列表。';
            renderAll();
            return false;
        }
        if (!canVisitPeer(peer)) {
            state.error = '这个孩子当前不开放一起遛弯邀请。';
            renderAll();
            return false;
        }
        state.walkInvitePeerId = peerChildId;
        renderWalkInviteModal();
        return false;
    }

    async function sendWalkInvite(routeId) {
        state.info = '';
        state.error = '';

        const peer = state.walkInvitePeerId ? findPeer(state.walkInvitePeerId) : null;
        const route = getWalkRoute(routeId);
        const client = getClient();
        const authState = getAuthState();
        const activeProfile = getActiveLocalProfile();

        if (!peer || !route) {
            state.error = '路线或好友信息还没准备好，请重新选择。';
            renderAll();
            return false;
        }
        if (!client || !authState || !authState.user || !state.activeCloudChild) {
            state.error = '请先连接云端并同步当前孩子，再发起一起遛弯。';
            renderAll();
            return false;
        }

        try {
            const result = await client
                .from('house_visits')
                .insert({
                    from_child_id: state.activeCloudChild.id,
                    to_child_id: peer.id,
                    action_type: 'walk',
                    message: '约上伙伴一起去遛弯啦！',
                    metadata_json: {
                        localProfileId: activeProfile ? activeProfile.id : null,
                        kind: 'walk_invite',
                        route_id: route.id,
                        route_name: route.name
                    },
                    created_by_account_id: authState.user.id
                });

            if (result.error) throw result.error;
            state.walkInvitePeerId = '';
            state.info = '已把“' + route.name + '”路线发给 ' + peer.display_name + '。';
            await refresh({ preserveInfo: true });
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '一起遛弯邀请发送失败';
            renderAll();
        }

        return false;
    }

    async function acceptWalkInvite(visitId) {
        state.info = '';
        state.error = '';

        const visit = (state.visits || []).find(function (item) {
            return item && item.id === visitId;
        });
        const client = getClient();
        const authState = getAuthState();
        const activeProfile = getActiveLocalProfile();

        if (!visit || !visit.pendingWalkInvite) {
            state.error = '这个一起遛弯邀请已经处理过了。';
            renderAll();
            return false;
        }
        if (!client || !authState || !authState.user || !state.activeCloudChild) {
            state.error = '请先连接云端并同步当前孩子，再响应一起遛弯。';
            renderAll();
            return false;
        }

        try {
            const result = await client
                .from('house_visits')
                .insert({
                    from_child_id: state.activeCloudChild.id,
                    to_child_id: visit.peerChildId,
                    action_type: 'walk',
                    message: '已经按同一路线去遛弯啦！',
                    metadata_json: {
                        localProfileId: activeProfile ? activeProfile.id : null,
                        kind: 'walk_reply',
                        route_id: visit.routeId,
                        route_name: visit.routeName,
                        response_to_visit_id: visit.id
                    },
                    created_by_account_id: authState.user.id
                });

            if (result.error) throw result.error;
            state.info = '已接受邀请，现在按同一路线去遛弯。';
            await refresh({ preserveInfo: true });
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }
            if (typeof window.openPetWalk === 'function') {
                window.openPetWalk(visit.routeId);
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '响应一起遛弯失败';
            renderAll();
        }

        return false;
    }

    async function refresh(options) {
        const config = Object.assign({ preserveInfo: false }, options || {});
        const preserveInfo = Boolean(config.preserveInfo);
        state.error = '';
        if (!preserveInfo) {
            state.info = '';
        }
        state.loading = true;
        renderAll();

        try {
            if (window.HouseholdSystem && typeof window.HouseholdSystem.refresh === 'function') {
                await window.HouseholdSystem.refresh();
            }

            state.activeCloudChild = null;
            state.householdPeers = [];
            state.friends = [];
            state.visits = [];

            if (!getCloudReady()) {
                state.loading = false;
                renderAll();
                return state;
            }

            const householdState = getHouseholdState();
            if (!householdState || !householdState.primaryHouseholdId) {
                state.loading = false;
                renderAll();
                return state;
            }

            const client = getClient();
            state.activeCloudChild = await resolveActiveCloudChild(client);
            if (state.activeCloudChild) {
                state.householdPeers = getHouseholdPeers(state.activeCloudChild, householdState);
                state.friends = await fetchFriendProfiles(client, state.activeCloudChild);
                state.visits = await fetchVisits(client, state.activeCloudChild);
            }
            state.error = '';
        } catch (error) {
            state.error = error && error.message ? error.message : '社交数据刷新失败';
        } finally {
            state.loading = false;
            renderAll();
        }

        return state;
    }

    async function redeemFriendCode(event) {
        event.preventDefault();
        state.info = '';
        state.error = '';

        const client = getClient();
        const activeProfile = getActiveLocalProfile();
        if (!client || !state.activeCloudChild || !activeProfile) {
            state.error = '请先创建家庭并同步当前孩子，再兑换好友码。';
            renderAll();
            return false;
        }

        const formData = new FormData(event.target);
        const friendCode = String(formData.get('friendCode') || '').trim().toUpperCase();
        if (!friendCode) {
            state.error = '请输入好友码。';
            renderAll();
            return false;
        }

        try {
            const result = await client.functions.invoke('redeem-friend-code', {
                body: {
                    friendCode: friendCode,
                    localProfileId: activeProfile.id,
                    childId: state.activeCloudChild.id
                }
            });
            if (result && result.error) throw result.error;
            const friendName = result && result.data && result.data.targetChild
                ? result.data.targetChild.display_name
                : '新好友';
            state.info = '好友添加成功：已和「' + friendName + '」建立好友关系。';
            event.target.reset();
            await refresh({ preserveInfo: true });
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '好友码兑换失败';
            renderAll();
        }

        return false;
    }

    async function setHomeVisibility(visibility) {
        state.info = '';
        state.error = '';
        try {
            if (!window.CloudSync || typeof window.CloudSync.setHomeVisibility !== 'function') {
                throw new Error('云端小屋可见性同步尚未就绪');
            }
            await window.CloudSync.setHomeVisibility(visibility);
            state.info = '好友小屋可见性已更新为：' + getVisibilityLabel(visibility);
            await refresh({ preserveInfo: true });
        } catch (error) {
            state.error = error && error.message ? error.message : '更新小屋可见性失败';
            renderAll();
        }
        return false;
    }

    async function setVisitAccess(visibility) {
        state.info = '';
        state.error = '';
        try {
            if (!window.CloudSync || typeof window.CloudSync.setVisitAccess !== 'function') {
                throw new Error('云端串门权限同步尚未就绪');
            }
            await window.CloudSync.setVisitAccess(visibility);
            state.info = '好友串门权限已更新为：' + getAccessLabel(visibility, 'visit');
            await refresh({ preserveInfo: true });
        } catch (error) {
            state.error = error && error.message ? error.message : '更新串门权限失败';
            renderAll();
        }
        return false;
    }

    async function setPKAccess(visibility) {
        state.info = '';
        state.error = '';
        try {
            if (!window.CloudSync || typeof window.CloudSync.setPKAccess !== 'function') {
                throw new Error('云端 PK 权限同步尚未就绪');
            }
            await window.CloudSync.setPKAccess(visibility);
            state.info = '好友 PK 权限已更新为：' + getAccessLabel(visibility, 'pk');
            await refresh({ preserveInfo: true });
        } catch (error) {
            state.error = error && error.message ? error.message : '更新 PK 权限失败';
            renderAll();
        }
        return false;
    }

    async function recordVisit(peerChildId, actionType) {
        state.info = '';
        state.error = '';

        const action = getActionMeta(actionType);
        const client = getClient();
        const authState = getAuthState();
        const activeProfile = getActiveLocalProfile();

        if (!client || !authState || !authState.user || !state.activeCloudChild) {
            if (activeProfile) {
                writeLocalVisit(activeProfile.id, {
                    actionType: actionType,
                    message: action.message,
                    createdAt: new Date().toISOString()
                });
                state.info = '已写入本地演示串门记录。连接云端后会显示真实好友互动。';
            } else {
                state.error = '请先连接云端并同步当前孩子。';
            }
            renderAll();
            return false;
        }

        if (!peerChildId) {
            state.error = '请选择一个孩子再互动。';
            renderAll();
            return false;
        }

        const peer = findPeer(peerChildId);
        if (peer && !canVisitPeer(peer)) {
            state.error = '这个孩子目前只允许家庭里的其他孩子来串门。';
            renderAll();
            return false;
        }
        if (actionType === 'visit' && peer && !canViewPeerHome(peer)) {
            state.error = '这个孩子把小屋设成了仅家庭可见。';
            renderAll();
            return false;
        }

        try {
            const result = await client
                .from('house_visits')
                .insert({
                    from_child_id: state.activeCloudChild.id,
                    to_child_id: peerChildId,
                    action_type: actionType,
                    message: action.message,
                    metadata_json: {
                        localProfileId: activeProfile ? activeProfile.id : null
                    },
                    created_by_account_id: authState.user.id
                });

            if (result.error) throw result.error;
            state.info = action.label + '已发送，等好友回来看小屋吧。';
            await refresh({ preserveInfo: true });
            if (window.ActivityFeedSystem && typeof window.ActivityFeedSystem.refresh === 'function') {
                await window.ActivityFeedSystem.refresh();
            }
            if (actionType === 'visit') {
                openPeerHome(peerChildId);
                return false;
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '串门互动发送失败';
            renderAll();
        }

        return false;
    }

    async function copyFriendCode() {
        if (!state.activeCloudChild || !state.activeCloudChild.friend_code) {
            state.error = '当前孩子还没有云端好友码。';
            renderAll();
            return false;
        }

        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                await navigator.clipboard.writeText(state.activeCloudChild.friend_code);
                state.info = '好友码已复制到剪贴板。';
            } else {
                state.info = '当前浏览器不支持自动复制，请手动记下好友码：' + state.activeCloudChild.friend_code;
            }
        } catch (error) {
            state.error = error && error.message ? error.message : '复制好友码失败';
        }

        renderAll();
        return false;
    }

    window.SocialSystem = {
        refresh,
        renderHomePanel,
        renderSettingsPanel,
        renderHomeVisitSlot,
        renderFriendHomeVisit,
        redeemFriendCode,
        recordVisit,
        openPeerHome,
        openWalkInvite,
        closeWalkInvite,
        sendWalkInvite,
        acceptWalkInvite,
        copyFriendCode,
        setHomeVisibility,
        setVisitAccess,
        setPKAccess,
        getState() {
            return {
                loading: state.loading,
                info: state.info,
                error: state.error,
                activeCloudChild: state.activeCloudChild,
                activeVisitPeerId: state.activeVisitPeerId,
                walkInvitePeerId: state.walkInvitePeerId,
                householdPeers: state.householdPeers.slice(),
                friends: state.friends.slice(),
                visits: state.visits.slice()
            };
        }
    };
})();
