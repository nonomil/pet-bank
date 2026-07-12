/* SpaceGrowthDetective - second-story map, collectibles and battle bridge. */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'petbank_space_growth_collectibles_v1';
    const TEST_PARAM = 'story_test';
    const STORY_ID = 'space-growth-detective';
    let storyPromise = null;
    let selectedCaseId = '';
    let pendingBattle = null;

    function storage() {
        try {
            return root.localStorage && typeof root.localStorage.getItem === 'function' ? root.localStorage : null;
        } catch (error) {
            return null;
        }
    }

    function profileId() {
        try {
            const id = root.ProfileManager && typeof root.ProfileManager.getActiveId === 'function'
                ? root.ProfileManager.getActiveId()
                : 'p_default';
            return String(id || 'p_default');
        } catch (error) {
            return 'p_default';
        }
    }

    function isLocalHost() {
        const hostname = String(root.location?.hostname || '').toLowerCase();
        return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    }

    function isTestMode() {
        if (!isLocalHost()) return false;
        try {
            return new URLSearchParams(root.location?.search || '').get(TEST_PARAM) === STORY_ID;
        } catch (error) {
            return false;
        }
    }

    function emptyCollection() {
        return { cards: [], badges: [] };
    }

    function normalizeCollection(value) {
        const source = value && typeof value === 'object' ? value : {};
        return {
            cards: Array.isArray(source.cards) ? [...new Set(source.cards.map(String))] : [],
            badges: Array.isArray(source.badges) ? [...new Set(source.badges.map(String))] : []
        };
    }

    function readState() {
        const store = storage();
        if (!store) return { schemaVersion: 1, profiles: {} };
        try {
            const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '{}');
            return parsed && typeof parsed === 'object' && parsed.profiles && typeof parsed.profiles === 'object'
                ? { schemaVersion: 1, profiles: parsed.profiles }
                : { schemaVersion: 1, profiles: {} };
        } catch (error) {
            return { schemaVersion: 1, profiles: {} };
        }
    }

    function writeState(state) {
        const store = storage();
        if (!store) return false;
        try {
            store.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (error) {
            return false;
        }
    }

    function readCollection(targetProfileId = profileId()) {
        const state = readState();
        return normalizeCollection(state.profiles[String(targetProfileId)]);
    }

    function claimCollectibles(targetProfileId, rewards) {
        const id = String(targetProfileId || profileId());
        const state = readState();
        const current = normalizeCollection(state.profiles[id]);
        const cardId = String(rewards?.cardId || '').trim();
        const badgeId = String(rewards?.badgeId || '').trim();
        const alreadyClaimed = (!cardId || current.cards.includes(cardId)) && (!badgeId || current.badges.includes(badgeId));
        if (alreadyClaimed) return { accepted: false, duplicate: true, collection: current };
        if (cardId && !current.cards.includes(cardId)) current.cards.push(cardId);
        if (badgeId && !current.badges.includes(badgeId)) current.badges.push(badgeId);
        state.profiles[id] = current;
        if (!writeState(state)) return { accepted: false, reason: 'storage', collection: current };
        return { accepted: true, duplicate: false, collection: current };
    }

    function resetCollection(targetProfileId = profileId()) {
        const state = readState();
        delete state.profiles[String(targetProfileId)];
        writeState(state);
        return emptyCollection();
    }

    function assetUrl(path) {
        return typeof root.resolvePetBankAssetUrl === 'function' ? root.resolvePetBankAssetUrl(path) : path;
    }

    async function fetchJson(path) {
        const response = await root.fetch(assetUrl(path));
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
        return response.json();
    }

    async function loadStory() {
        if (!storyPromise) {
            storyPromise = (async function () {
                const basePath = 'data/story-packs/03-space-growth-detective';
                const manifest = await fetchJson(`${basePath}/manifest.json`);
                if (!manifest || manifest.id !== STORY_ID || manifest.active !== true || manifest.runtime !== 'explore-story-map') {
                    throw new Error('星光成长侦探社地图尚未启用');
                }
                const cases = await Promise.all((manifest.caseIds || []).map((caseId) => fetchJson(`${basePath}/cases/${caseId}.json`)));
                return { manifest, cases };
            })().catch((error) => {
                storyPromise = null;
                throw error;
            });
        }
        return storyPromise;
    }

    function getPetIdentity() {
        try {
            const pet = root.PetSystem && typeof root.PetSystem.getState === 'function' ? root.PetSystem.getState() : null;
            return pet && typeof pet.pet_id === 'string' && pet.pet_id.trim() ? pet.pet_id.trim() : 'no-pet';
        } catch (error) {
            return 'no-pet';
        }
    }

    function getCompletedCaseIds() {
        if (!root.PetStoryCases || typeof root.PetStoryCases.getCompletedCaseIds !== 'function') return [];
        return root.PetStoryCases.getCompletedCaseIds(STORY_ID, profileId(), getPetIdentity());
    }

    function activeCase(story, completed) {
        const done = new Set(completed);
        return story.cases.find((item) => !done.has(item.id) && (!item.prerequisiteCaseId || done.has(item.prerequisiteCaseId))) || null;
    }

    function isCaseUnlocked(item, completed) {
        if (isTestMode()) return true;
        const done = new Set(completed);
        return !item.prerequisiteCaseId || done.has(item.prerequisiteCaseId);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function iconForCase(caseId) {
        return {
            'energy-stardust': 'battery-charging',
            'cloud-code': 'cloud',
            'star-dust-footprints': 'scan-line',
            'companion-link': 'link-2',
            'home-star-map': 'home'
        }[String(caseId || '')] || 'sparkles';
    }

    function renderCollectible(item, collection, type, catalog) {
        const id = String(item.id || '');
        const claimed = collection[type].includes(id);
        const label = claimed ? item.name : '待解锁收藏';
        return `
            <article class="space-growth-collectible ${claimed ? 'is-collected' : 'is-locked'}" data-space-growth-collectible="${escapeHtml(id)}">
                <div class="space-growth-collectible-art"><img src="${assetUrl(item.image)}" alt="${escapeHtml(label)}" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('has-fallback')"><i data-lucide="${type === 'cards' ? 'book-open' : 'award'}" aria-hidden="true"></i></div>
                <div class="space-growth-collectible-copy"><strong>${escapeHtml(label)}</strong><span>${claimed ? escapeHtml(item.subtitle || '星光档案已收录') : `${catalog} · 胜利后获得`}</span></div>
            </article>`;
    }

    function renderTestControls() {
        if (!isTestMode()) return '';
        return `<div class="space-growth-test-tools" data-space-growth-test-controls>
            <span class="space-growth-test-label">本地测试</span>
            <button type="button" data-space-test-action="prepare">准备测试宠物</button>
            <button type="button" data-space-test-action="reset">重置第二故事</button>
        </div>`;
    }

    function renderMap(container, story, completed) {
        const map = story.manifest.map;
        const nodesById = new Map((map.nodes || []).map((node) => [node.caseId, node]));
        const completedSet = new Set(completed);
        const current = activeCase(story, completed);
        if (!selectedCaseId || completedSet.has(selectedCaseId) || !story.cases.some((item) => item.id === selectedCaseId)) {
            selectedCaseId = current?.id || story.cases[story.cases.length - 1]?.id || '';
        }
        const collection = readCollection(profileId());
        const nodeButtons = story.cases.map((item, index) => {
            const node = nodesById.get(item.id) || item.node || {};
            const done = completedSet.has(item.id);
            const unlocked = isCaseUnlocked(item, completed);
            const state = done ? 'is-complete' : unlocked ? (selectedCaseId === item.id ? 'is-current' : 'is-open') : 'is-locked';
            const position = node.position || { x: 15 + index * 18, y: 70 - (index % 2) * 25 };
            return `<button type="button" class="space-growth-node ${state}" data-space-growth-node data-case-id="${escapeHtml(item.id)}" style="--node-x:${Number(position.x) || 0}%;--node-y:${Number(position.y) || 0}%;" ${unlocked ? '' : 'disabled'} aria-label="${escapeHtml(unlocked ? `进入${item.title}` : `锁定${item.title}`)}">
                <span class="space-growth-node-art"><img src="${assetUrl(node.image || item.node?.image || '')}" alt="" loading="lazy" onerror="this.style.display='none';this.parentElement.classList.add('has-fallback')"><i data-lucide="${iconForCase(item.id)}" aria-hidden="true"></i><span class="space-growth-node-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span></span>
                <span class="space-growth-node-copy"><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(node.shortLabel || node.label || '')}</small></span>
                <span class="space-growth-node-state">${done ? '已完成' : unlocked ? '进入案件' : `前置：${escapeHtml(item.prerequisiteCaseId || '上一案')}`}</span>
            </button>`;
        }).join('');
        const points = story.cases.map((item, index) => {
            const node = nodesById.get(item.id) || item.node || {};
            const position = node.position || { x: 15 + index * 18, y: 70 - (index % 2) * 25 };
            return `${Number(position.x) || 0},${Number(position.y) || 0}`;
        }).join(' ');
        const cardItems = (story.manifest.collectibles?.cards || []).map((item) => renderCollectible(item, collection, 'cards', '故事卡')).join('');
        const badgeItems = (story.manifest.collectibles?.badges || []).map((item) => renderCollectible(item, collection, 'badges', '徽章')).join('');
        container.innerHTML = `<section class="space-growth-map-shell" data-space-growth-map aria-label="星光成长侦探社地图">
            <header class="space-growth-map-header"><div><p class="space-growth-map-kicker">第二故事 · 星际成长侦探社</p><h2>宠物手机：星光成长侦探社</h2><p>跟着宠物一起看线索、做选择，赢回五颗成长星。</p></div><div class="space-growth-progress"><strong>${completed.length}/${story.cases.length}</strong><span>案件完成</span><div class="space-growth-progress-bar"><i style="width:${Math.round(completed.length / Math.max(1, story.cases.length) * 100)}%"></i></div></div></header>
            ${renderTestControls()}
            <div class="space-growth-map" style="--space-growth-map-bg:url('${assetUrl(map.background)}')"><svg class="space-growth-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}"></polyline></svg>${nodeButtons}<div class="space-growth-map-caption"><span>星光航线</span><small>每完成一案，就会点亮一颗成长星</small></div></div>
            <section class="space-growth-case-slot" aria-label="当前星际案件"><div id="petStoryCasePanel"></div></section>
            <section class="space-growth-collection" aria-label="故事收藏"><div class="space-growth-collection-head"><div><p>案件收藏</p><h3>把调查线索收进成长册</h3></div><span>${collection.cards.length + collection.badges.length}/10 已收集</span></div><div class="space-growth-collection-grid">${cardItems}${badgeItems}</div></section>
        </section>`;
        container.querySelectorAll('[data-space-growth-node]').forEach((button) => {
            button.addEventListener('click', () => {
                selectedCaseId = button.dataset.caseId || '';
                void render(container.id);
            });
        });
        container.querySelectorAll('[data-space-test-action="prepare"]').forEach((button) => button.addEventListener('click', prepareTestPet));
        container.querySelectorAll('[data-space-test-action="reset"]').forEach((button) => button.addEventListener('click', resetStory));
        if (root.lucide && typeof root.lucide.createIcons === 'function') root.lucide.createIcons();
    }

    async function render(containerId = 'spaceGrowthDetectiveContainer') {
        const container = root.document?.getElementById(containerId);
        if (!container) return false;
        try {
            const story = await loadStory();
            const completed = getCompletedCaseIds();
            renderMap(container, story, completed);
            if (root.PetStoryCases && typeof root.PetStoryCases.render === 'function') {
                await root.PetStoryCases.render('petStoryCasePanel', selectedCaseId);
            }
            return true;
        } catch (error) {
            console.warn('[SpaceGrowthDetective] map unavailable', error);
            container.innerHTML = '<section class="space-growth-map-shell space-growth-map-error"><p>星光地图暂时没有收到信号。</p></section>';
            return false;
        }
    }

    function prepareTestPet() {
        if (!isTestMode()) return;
        try {
            const pet = root.PetSystem && typeof root.PetSystem.getState === 'function' ? root.PetSystem.getState() : null;
            if (pet && !pet.species && typeof root.PetSystem.getAllSpecies === 'function') {
                const species = root.PetSystem.getAllSpecies()[0];
                if (species && typeof root.PetSystem.chooseSpecies === 'function') root.PetSystem.chooseSpecies(species.id);
            }
            if (root.PetSystem) {
                if (typeof root.PetSystem.addExp === 'function') root.PetSystem.addExp(1000);
                if (typeof root.PetSystem.heal === 'function') root.PetSystem.heal(999);
                if (typeof root.PetSystem.bath === 'function') root.PetSystem.bath();
            }
            if (typeof root.addGrowthPoints === 'function') root.addGrowthPoints(500);
            if (typeof root.showToast === 'function') root.showToast('测试宠物已准备好，可以依次挑战五个案件。');
        } catch (error) {
            console.warn('[SpaceGrowthDetective] test pet preparation failed', error);
        }
    }

    function resetStory() {
        if (!isTestMode()) return;
        const store = storage();
        if (store) {
            store.removeItem(root.PetStoryCases?.STORAGE_KEY || 'petbank_pet_story_cases_v1');
            resetCollection(profileId());
            try {
                const receipts = JSON.parse(store.getItem('petbank_core_reward_receipts_v1') || '{}');
                Object.keys(receipts).filter((key) => key.includes('space-growth-detective:')).forEach((key) => delete receipts[key]);
                store.setItem('petbank_core_reward_receipts_v1', JSON.stringify(receipts));
            } catch (error) {}
        }
        selectedCaseId = '';
        if (typeof root.showToast === 'function') root.showToast('第二故事测试进度已重置。');
        void render();
    }

    function startCaseBattle(input) {
        const item = input?.item;
        if (!item?.battle || !root.ExplorationSystem || typeof root.ExplorationSystem.startBattle !== 'function') {
            return { success: false, msg: '追踪战暂时无法启动' };
        }
        const pet = root.PetSystem && typeof root.PetSystem.getState === 'function' ? root.PetSystem.getState() : {};
        const scene = {
            id: item.battle.sceneId,
            chapter: Number(item.battle.chapter) || 1,
            danger_level: Number(item.battle.chapter) || 1,
            hp_cost: 0
        };
        const monster = { ...item.battle.monster, reward_exp: Number(item.battle.monster.exp) || 0 };
        const battle = root.ExplorationSystem.startBattle(scene, monster);
        if (!battle) return { success: false, msg: '追踪战暂时无法启动' };
        pendingBattle = {
            item,
            profileId: profileId(),
            petIdentity: pet && pet.pet_id ? String(pet.pet_id) : 'no-pet',
            selectedAnswerId: String(input.selectedAnswerId || '')
        };
        if (typeof root.showBattleModal === 'function') root.showBattleModal(battle);
        else return { success: false, msg: '战斗界面暂时没有准备好' };
        return { success: true, battle };
    }

    function claimVictoryRewards(pending) {
        const item = pending.item;
        const rewards = item.rewards || {};
        let rewardResult = null;
        if (root.CoreRewardService && typeof root.CoreRewardService.claim === 'function') {
            rewardResult = root.CoreRewardService.claim({
                eventId: `${STORY_ID}:${item.id}:victory`,
                profileId: pending.profileId,
                source: 'game',
                sourceId: STORY_ID,
                rewards: [
                    { type: 'growth_points', amount: Number(rewards.growthPoints) || 0 },
                    { type: 'pet_exp', amount: Number(rewards.petExp) || 0 }
                ]
            });
        } else {
            if (typeof root.addGrowthPoints === 'function') root.addGrowthPoints(Number(rewards.growthPoints) || 0);
            if (root.PetSystem && typeof root.PetSystem.addExp === 'function') root.PetSystem.addExp(Number(rewards.petExp) || 0);
            rewardResult = { accepted: true };
        }
        const collectibleResult = claimCollectibles(pending.profileId, rewards);
        return { rewardResult, collectibleResult };
    }

    function handleBattleClosed(status) {
        const pending = pendingBattle;
        pendingBattle = null;
        if (!pending || status !== 'won') return { accepted: false, reason: status || 'closed' };
        const item = pending.item;
        const completion = root.PetStoryCases && typeof root.PetStoryCases.completeCase === 'function'
            ? root.PetStoryCases.completeCase({
                storyId: STORY_ID,
                caseId: item.id,
                profileId: pending.profileId,
                petIdentity: pending.petIdentity,
                selectedAnswerId: pending.selectedAnswerId,
                resolution: 'care-action-battle',
                summary: item.battle.victory || item.reply?.careAction || ''
            })
            : { accepted: false, reason: 'story-module' };
        if (completion.accepted) {
            const reward = claimVictoryRewards(pending);
            if (typeof root.showToast === 'function') root.showToast(`案件完成：${item.title} · 故事卡与徽章已收进成长册`);
            return { accepted: true, completion, reward };
        }
        return { accepted: false, duplicate: completion.duplicate, completion };
    }

    root.SpaceGrowthDetective = {
        STORAGE_KEY,
        STORY_ID,
        isTestMode,
        loadStory,
        readCollection,
        claimCollectibles,
        resetCollection,
        getCompletedCaseIds,
        isCaseUnlocked,
        render,
        prepareTestPet,
        resetStory,
        startCaseBattle,
        handleBattleClosed,
        getSelectedCaseId: () => selectedCaseId
    };
})(typeof window !== 'undefined' ? window : globalThis);
