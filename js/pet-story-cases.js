/* PetStoryCases - scoped progress and safe care actions for story cases. */
(function (root) {
    'use strict';

    const STORAGE_KEY = 'petbank_pet_story_cases_v1';
    const SCHEMA_VERSION = 1;
    const CLUE_SOURCES = {
        'pet.hunger': (pet) => pet && Number.isFinite(Number(pet.hunger)) ? Number(pet.hunger) : null,
        'pet.hp': (pet) => pet && Number.isFinite(Number(pet.hp)) ? Number(pet.hp) : null,
        'pet.happiness': (pet) => pet && Number.isFinite(Number(pet.happiness)) ? Number(pet.happiness) : null,
        'pet.cleanliness': (pet) => pet && Number.isFinite(Number(pet.cleanliness)) ? Number(pet.cleanliness) : null,
        'pet.intimacy': (pet) => pet && Number.isFinite(Number(pet.intimacy)) ? Number(pet.intimacy) : null,
        'pet.level': (pet) => pet && Number.isFinite(Number(pet.level)) ? Number(pet.level) : null,
        'pet.stage': (pet) => pet && pet.stage && typeof pet.stage.name === 'string' ? pet.stage.name : null
    };
    const CARE_ACTIONS = {
        feed: 'feed',
        play: 'play',
        rest: 'rest',
        bath: 'bath'
    };
    let storyPromise = null;
    let lastReply = null;

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
                if (!manifest || manifest.active !== true || !Array.isArray(manifest.caseIds)) throw new Error('故事包尚未启用');
                const cases = await Promise.all(manifest.caseIds.map((caseId) => fetchJson(`${basePath}/cases/${caseId}.json`)));
                return { manifest, cases };
            })();
        }
        return storyPromise;
    }

    function readState() {
        try {
            const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : null;
            if (parsed && typeof parsed === 'object' && parsed.records && typeof parsed.records === 'object' && !Array.isArray(parsed.records)) {
                return { schemaVersion: SCHEMA_VERSION, records: parsed.records };
            }
        } catch (error) {
            console.warn('[PetStoryCases] unable to read progress', error);
        }
        return { schemaVersion: SCHEMA_VERSION, records: {} };
    }

    function writeState(state) {
        try {
            if (!root.localStorage) return false;
            root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (error) {
            console.warn('[PetStoryCases] unable to save progress', error);
            return false;
        }
    }

    function getProfileId() {
        const id = root.ProfileManager && typeof root.ProfileManager.getActiveId === 'function'
            ? root.ProfileManager.getActiveId()
            : 'p_default';
        return String(id || 'p_default');
    }

    function getPetIdentity(pet) {
        return pet && typeof pet.pet_id === 'string' && pet.pet_id.trim() ? pet.pet_id.trim() : '';
    }

    function buildRecordKey(input) {
        const storyId = String(input && input.storyId || '').trim();
        const caseId = String(input && input.caseId || '').trim();
        const profileId = String(input && input.profileId || '').trim();
        const petIdentity = String(input && input.petIdentity || '').trim();
        if (!storyId || !caseId || !profileId || !petIdentity) return '';
        return [storyId, caseId, profileId, petIdentity].map(encodeURIComponent).join(':');
    }

    function resolveClue(clue, pet) {
        const source = clue && typeof clue.source === 'string' ? clue.source : '';
        const value = CLUE_SOURCES[source] ? CLUE_SOURCES[source](pet) : null;
        if (value == null) return { available: false, id: 'unavailable', label: String(clue?.unavailable?.label || '还没有收到这条信号') };
        const bands = Array.isArray(clue?.presentation?.bands) ? clue.presentation.bands : [];
        const band = bands.find((item) => Number(value) <= Number(item?.max));
        if (!band) return { available: false, id: 'unavailable', label: String(clue?.unavailable?.label || '还没有收到这条信号') };
        return { available: true, id: String(band.id || ''), label: String(band.label || '') };
    }

    function getRecord(input) {
        const key = buildRecordKey(input);
        return key ? readState().records[key] || null : null;
    }

    function complete(input) {
        const key = buildRecordKey(input);
        if (!key) return { accepted: false, reason: 'invalid' };
        const state = readState();
        if (state.records[key]) return { accepted: false, duplicate: true, receipt: state.records[key] };
        const receipt = {
            storyId: String(input.storyId),
            caseId: String(input.caseId),
            profileId: String(input.profileId),
            petIdentity: String(input.petIdentity),
            selectedAnswerId: String(input.selectedAnswerId || ''),
            resolution: String(input.resolution || 'observation-fallback'),
            summary: String(input.summary || ''),
            receiptId: `storycase:${key}`,
            completedAt: new Date().toISOString()
        };
        state.records[key] = receipt;
        if (!writeState(state)) return { accepted: false, reason: 'storage' };
        return { accepted: true, duplicate: false, receipt };
    }

    function getCompletedCaseIds(storyId, profileId, petIdentity) {
        const targetStory = String(storyId || '');
        const targetProfile = String(profileId || getProfileId());
        const targetPet = String(petIdentity || '');
        return Object.values(readState().records)
            .filter((record) => record.storyId === targetStory && record.profileId === targetProfile && record.petIdentity === targetPet)
            .map((record) => record.caseId);
    }

    function getActiveCase(story, profileId, petIdentity) {
        const completed = new Set(getCompletedCaseIds(story.manifest.id, profileId, petIdentity));
        return story.cases.find((item) => !completed.has(item.id) && (!item.prerequisiteCaseId || completed.has(item.prerequisiteCaseId))) || null;
    }

    function runCareAction(action) {
        const id = String(action?.id || '');
        const method = CARE_ACTIONS[id];
        if (!method || action?.invoke !== method || !root.PetSystem || typeof root.PetSystem[method] !== 'function') {
            return { success: false, msg: '这项照料暂时不能使用' };
        }
        const options = action && action.options && typeof action.options === 'object' ? action.options : {};
        if (method === 'feed') return root.PetSystem.feed(null, options);
        return root.PetSystem[method](options);
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function scopeForPet(pet) {
        return getPetIdentity(pet) || 'no-pet';
    }

    function completeFromPanel(story, item, pet, selectedAnswerId, resolution, summary) {
        return complete({
            storyId: story.manifest.id,
            caseId: item.id,
            profileId: getProfileId(),
            petIdentity: scopeForPet(pet),
            selectedAnswerId,
            resolution,
            summary
        });
    }

    function renderCase(container, story, item, pet, selectedAnswerId, feedback) {
        const clue = resolveClue(item.clue, pet);
        const selected = item.question.answers.find((answer) => answer.id === selectedAnswerId) || null;
        const canAdvance = !!selected && selected.isCorrect === true;
        const actionLabel = String(item.careAction?.label || '完成照料');
        const hasPet = Boolean(getPetIdentity(pet));
        const replyHtml = lastReply
            ? `<p class="story-case-reply" data-story-reply>${escapeHtml(lastReply)}</p>`
            : '';
        const choicesHtml = item.question.answers.map((answer) => `
            <button class="story-case-answer" type="button" data-story-answer="${escapeHtml(answer.id)}">${escapeHtml(answer.label)}</button>
        `).join('');
        const nextStepHtml = canAdvance
            ? `<div class="story-case-action-row">
                ${hasPet && item.careAction ? `<button class="story-case-action" type="button" data-story-care>${escapeHtml(actionLabel)}</button>` : ''}
                <button class="story-case-secondary" type="button" data-story-fallback>${hasPet ? '先用观察结案' : '用观察结案'}</button>
            </div>`
            : '';
        container.innerHTML = `
            <section class="story-case-panel" aria-label="星光联络器">
                <div class="story-case-heading"><span aria-hidden="true">✦</span><div><p>星光联络器</p><h3>${escapeHtml(item.title)}</h3></div></div>
                ${replyHtml}
                <article class="story-case-card"><span class="story-case-label">来信</span><p>${escapeHtml(item.message.text)}</p></article>
                <article class="story-case-card"><span class="story-case-label">线索</span><p data-story-clue>${escapeHtml(clue.label)}</p></article>
                <article class="story-case-card"><span class="story-case-label">小侦探选择</span><p>${escapeHtml(item.question.prompt)}</p><div class="story-case-answers">${choicesHtml}</div></article>
                ${feedback ? `<p class="story-case-feedback" role="status">${escapeHtml(feedback)}</p>` : ''}
                ${nextStepHtml}
            </section>
        `;
        container.querySelectorAll('[data-story-answer]').forEach((button) => {
            button.addEventListener('click', function () {
                const answer = item.question.answers.find((entry) => entry.id === button.dataset.storyAnswer);
                if (!answer) return;
                const nextFeedback = answer.isCorrect ? answer.reason : answer.hint;
                renderCase(container, story, item, pet, answer.isCorrect ? answer.id : '', nextFeedback);
            });
        });
        const fallback = container.querySelector('[data-story-fallback]');
        if (fallback) fallback.addEventListener('click', function () {
            const result = completeFromPanel(story, item, pet, selectedAnswerId, 'observation-fallback', item.reply.fallback);
            if (!result.accepted && !result.duplicate) return renderCase(container, story, item, pet, selectedAnswerId, '联络器暂时没能记下这封回信。');
            lastReply = item.reply.fallback;
            void render(container.id);
        });
        const care = container.querySelector('[data-story-care]');
        if (care) care.addEventListener('click', function () {
            const careResult = runCareAction(item.careAction);
            if (!careResult || !careResult.success) {
                renderCase(container, story, item, pet, selectedAnswerId, careResult?.msg || '这项照料暂时不能使用，可以先用观察结案。');
                return;
            }
            const result = completeFromPanel(story, item, pet, selectedAnswerId, 'care-action', item.reply.careAction);
            if (!result.accepted && !result.duplicate) return renderCase(container, story, item, pet, selectedAnswerId, '照料完成了，但联络器没能记下回信。');
            lastReply = item.reply.careAction;
            void render(container.id);
        });
    }

    async function render(containerId) {
        const container = typeof containerId === 'string' ? root.document?.getElementById(containerId) : containerId;
        if (!container) return false;
        try {
            const story = await loadStory();
            const pet = root.PetSystem && typeof root.PetSystem.getState === 'function' ? root.PetSystem.getState() : {};
            const profileId = getProfileId();
            const item = getActiveCase(story, profileId, scopeForPet(pet));
            if (!item) {
                container.innerHTML = `<section class="story-case-panel"><div class="story-case-heading"><span aria-hidden="true">✦</span><div><p>星光联络器</p><h3>星图已经亮起</h3></div></div>${lastReply ? `<p class="story-case-reply" data-story-reply>${escapeHtml(lastReply)}</p>` : ''}<p class="story-case-finish">这一季的五颗成长星点都回家了。</p></section>`;
                return true;
            }
            renderCase(container, story, item, pet, '', '');
            return true;
        } catch (error) {
            console.warn('[PetStoryCases] story panel unavailable', error);
            container.innerHTML = '<section class="story-case-panel"><p class="story-case-feedback">联络器暂时没有收到来信。</p></section>';
            return false;
        }
    }

    root.PetStoryCases = {
        STORAGE_KEY,
        SCHEMA_VERSION,
        CLUE_SOURCES: Object.keys(CLUE_SOURCES),
        CARE_ACTIONS: Object.keys(CARE_ACTIONS),
        getProfileId,
        getPetIdentity,
        buildRecordKey,
        resolveClue,
        getRecord,
        complete,
        getCompletedCaseIds,
        getActiveCase,
        runCareAction,
        loadStory,
        render
    };
})(typeof window !== 'undefined' ? window : globalThis);
