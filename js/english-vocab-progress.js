(function () {
    'use strict';

    const PROGRESS_KEY = 'petbank_learning_vocab_progress';
    const REWARD_KEY = 'petbank_learning_english_rewards';
    const REVIEW_EVENTS_KEY = 'petbank_learning_vocab_review_events';
    const CALIBRATION_KEY = 'petbank_learning_vocab_scheduler_calibration';
    const SCOPE_MIGRATION_PREFIX = 'petbank_english_vocab_scope_migration_v2_';
    const MASTERED_STREAK = 2;
    const COMMON_VOUCHER_ID = 'minecraft-card-common-10';
    const SRS_INTERVALS_DAYS = [1, 3, 7, 14, 30, 60];
    const SRS_MAX_INTERVAL_DAYS = 90;
    const SRS_DEFAULT_EASE = 2.5;
    const SRS_MIN_EASE = 1.3;
    const SRS_MAX_EASE = 3;
    const SRS_RETRY_MINUTES = 10;
    const SRS_HARD_RETRY_HOURS = 12;
    const SRS_EASY_MIN_INTERVAL_DAYS = 2;
    const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'];
    const MAX_REVIEW_EVENTS = 365;
    const SCHEDULER_VERSION = 'fsrs-5';
    const FSRS_TARGET_RETENTION = 0.9;
    const FSRS_MIN_RETENTION = 0.85;
    const FSRS_MAX_RETENTION = 0.97;
    const FSRS_DAY_MS = 24 * 60 * 60 * 1000;
    const FSRS_MIN_CALIBRATION_REVIEWS = 20;
    const FSRS_MIN_CALIBRATION_TRANSITIONS = 5;
    const FSRS_CALIBRATION_ITERATIONS = 4;
    // FSRS-5 default parameters from the open-spaced-repetition reference.
    const FSRS_WEIGHTS = Object.freeze([
        0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046,
        1.54575, 0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315,
        2.9898, 0.51655, 0.6621
    ]);
    const FSRS_WEIGHT_BOUNDS = Object.freeze([
        [0.1, 5], [0.1, 10], [0.1, 30], [0.1, 100], [1, 20], [0.01, 1],
        [0.1, 5], [0, 1], [0, 5], [-2, 2], [0.1, 5], [0.1, 10],
        [-1, 2], [0.01, 2], [0, 5], [0.1, 1], [0.1, 5], [0.01, 2], [0.01, 2]
    ]);

    function readKey(key, fallback) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch (err) {
            console.warn('[EnglishVocabProgress] failed to read storage; using fallback', key, err);
            return fallback;
        }
    }

    function writeKey(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value || {}));
            return true;
        } catch (err) {
            console.warn('[EnglishVocabProgress] failed to write storage', key, err);
            return false;
        }
    }

    function resolveNow(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        const parsed = Date.parse(String(value || ''));
        return Number.isFinite(parsed) ? parsed : Date.now();
    }

    function isoAt(timestamp) {
        return new Date(timestamp).toISOString();
    }

    function clampEase(value) {
        return Math.max(SRS_MIN_EASE, Math.min(SRS_MAX_EASE, Number(value) || SRS_DEFAULT_EASE));
    }

    function clampNumber(value, min, max, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number)) return fallback;
        return Math.max(min, Math.min(max, number));
    }

    function gradeNumber(grade) {
        return { again: 1, hard: 2, good: 3, easy: 4 }[normalizeGrade(grade)] || 1;
    }

    function fsrsRetrievability(elapsedDays, stabilityDays) {
        const elapsed = Math.max(0, Number(elapsedDays) || 0);
        const stability = Math.max(0.1, Number(stabilityDays) || 0.1);
        const value = Math.pow(1 + (19 / 81) * (elapsed / stability), -0.5);
        return clampNumber(value, 0, 1, 1);
    }

    function fsrsInterval(retention, stabilityDays) {
        const target = clampNumber(retention, FSRS_MIN_RETENTION, FSRS_MAX_RETENTION, FSRS_TARGET_RETENTION);
        const stability = Math.max(0.1, Number(stabilityDays) || 0.1);
        return Math.max(0.1, stability * (81 / 19) * (Math.pow(target, -2) - 1));
    }

    function normalizeFsrsWeights(input) {
        if (!Array.isArray(input) || input.length !== FSRS_WEIGHTS.length) return [...FSRS_WEIGHTS];
        return input.map((value, index) => {
            const bounds = FSRS_WEIGHT_BOUNDS[index];
            return clampNumber(value, bounds[0], bounds[1], FSRS_WEIGHTS[index]);
        });
    }

    function fsrsInitialStability(grade, weights = FSRS_WEIGHTS) {
        const activeWeights = normalizeFsrsWeights(weights);
        return Math.max(0.1, Number(activeWeights[gradeNumber(grade) - 1]) || 0.1);
    }

    function fsrsInitialDifficulty(grade, weights = FSRS_WEIGHTS) {
        const activeWeights = normalizeFsrsWeights(weights);
        const numericGrade = gradeNumber(grade);
        return clampNumber(
            activeWeights[4] - Math.exp(activeWeights[5] * (numericGrade - 1)) + 1,
            1,
            10,
            5
        );
    }

    function fsrsDifficulty(difficulty, grade, weights = FSRS_WEIGHTS) {
        const activeWeights = normalizeFsrsWeights(weights);
        const numericGrade = gradeNumber(grade);
        const initialEasyDifficulty = fsrsInitialDifficulty('easy', activeWeights);
        const delta = -activeWeights[6] * (numericGrade - 3) * Math.pow(10, -Number(difficulty || 5) / 9);
        const damped = Number(difficulty || 5) + delta;
        return clampNumber(
            activeWeights[7] * initialEasyDifficulty + (1 - activeWeights[7]) * damped,
            1,
            10,
            initialEasyDifficulty
        );
    }

    function fsrsRecallStability(difficulty, stability, retrievability, grade, weights = FSRS_WEIGHTS) {
        const activeWeights = normalizeFsrsWeights(weights);
        const d = clampNumber(difficulty, 1, 10, 5);
        const s = Math.max(0.1, Number(stability) || 0.1);
        const r = clampNumber(retrievability, 0, 1, 1);
        const gradeNumberValue = gradeNumber(grade);
        const hardPenalty = gradeNumberValue === 2 ? activeWeights[15] : 1;
        const easyBonus = gradeNumberValue === 4 ? activeWeights[16] : 1;
        const increase = Math.exp(activeWeights[8])
            * (11 - d)
            * Math.pow(s, -activeWeights[9])
            * (Math.exp(activeWeights[10] * (1 - r)) - 1)
            * hardPenalty
            * easyBonus;
        return Math.max(0.1, s * (increase + 1));
    }

    function fsrsForgetStability(difficulty, stability, retrievability, weights = FSRS_WEIGHTS) {
        const activeWeights = normalizeFsrsWeights(weights);
        const d = clampNumber(difficulty, 1, 10, 5);
        const s = Math.max(0.1, Number(stability) || 0.1);
        const r = clampNumber(retrievability, 0, 1, 1);
        return Math.max(
            0.1,
            activeWeights[11]
            * Math.pow(d, -activeWeights[12])
            * (Math.pow(s + 1, activeWeights[13]) - 1)
            * Math.exp(activeWeights[14] * (1 - r))
        );
    }

    function fsrsShortTermStability(stability, grade, weights = FSRS_WEIGHTS) {
        const activeWeights = normalizeFsrsWeights(weights);
        return Math.max(0.1, Math.max(0.1, Number(stability) || 0.1)
            * Math.exp(activeWeights[17] * (gradeNumber(grade) - 3 + activeWeights[18])));
    }

    function activeFsrsWeights(calibration = readCalibration()) {
        const parameterCalibration = calibration && calibration.parameterCalibration;
        return calibration && calibration.parametersReady === true && parameterCalibration && parameterCalibration.fitted
            ? normalizeFsrsWeights(parameterCalibration.weights)
            : [...FSRS_WEIGHTS];
    }

    function scheduler() {
        const calibration = readCalibration();
        const targetRetention = clampNumber(
            calibration.targetRetention,
            FSRS_MIN_RETENTION,
            FSRS_MAX_RETENTION,
            FSRS_TARGET_RETENTION
        );
        return {
            algorithm: SCHEDULER_VERSION,
            targetRetention,
            retentionRange: [FSRS_MIN_RETENTION, FSRS_MAX_RETENTION],
            weights: activeFsrsWeights(calibration),
            weightsSource: calibration.parametersReady ? 'profile-calibration' : 'fsrs-5-default',
            forgettingCurve: 'R(t,S)=(1+19t/(81S))^-0.5',
            ebbinghausCurve: calibration.ebbinghaus?.fitted ? 'R(t)=exp(-lambda*t)' : '',
            ebbinghaus: calibration.ebbinghaus || null,
            learningStepsDays: [1, 3],
            relearningMinutes: SRS_RETRY_MINUTES,
            calibration
        };
    }

    function defaultItem() {
        return {
            seen: 0,
            correct: 0,
            wrong: 0,
            streak: 0,
            status: 'new',
            repetitions: 0,
            intervalDays: 0,
            ease: SRS_DEFAULT_EASE,
            lapses: 0,
            dueAt: '',
            lastReviewedAt: '',
            lastGrade: '',
            hintUsed: false,
            responseMode: '',
            lastResponseMs: 0,
            schedulerVersion: SCHEDULER_VERSION,
            stabilityDays: 0.1,
            difficulty: fsrsInitialDifficulty('good', activeFsrsWeights()),
            retrievability: 1
        };
    }

    function migrateSchedulerItem(input, now) {
        const source = input && typeof input === 'object' ? input : {};
        const item = Object.assign(defaultItem(), source);
        const hasFsrsState = source.schedulerVersion === SCHEDULER_VERSION
            && Number.isFinite(Number(source.stabilityDays))
            && Number.isFinite(Number(source.difficulty))
            && Number.isFinite(Number(source.retrievability));
        if (hasFsrsState) {
            item.stabilityDays = Math.max(0.1, Number(item.stabilityDays));
            item.difficulty = clampNumber(item.difficulty, 1, 10, 5);
            item.retrievability = clampNumber(item.retrievability, 0, 1, 1);
            return { item, migrated: false };
        }

        const legacyInterval = Math.max(0, Number(source.intervalDays) || 0);
        const legacyEase = clampEase(source.ease);
        const reviewedAt = Date.parse(String(source.lastReviewedAt || ''));
        const elapsedDays = Number.isFinite(reviewedAt)
            ? Math.max(0, (Number(now) - reviewedAt) / FSRS_DAY_MS)
            : 0;
        item.schedulerVersion = SCHEDULER_VERSION;
        item.schedulerMigration = 'sm2-to-fsrs5';
        item.stabilityDays = Math.max(0.1, legacyInterval || (Number(source.repetitions) > 0 ? 1 : 0.1));
        item.difficulty = clampNumber(
            10 - ((legacyEase - SRS_MIN_EASE) / (SRS_MAX_EASE - SRS_MIN_EASE)) * 9,
            1,
            10,
            5
        );
        item.retrievability = Number.isFinite(reviewedAt)
            ? fsrsRetrievability(elapsedDays, item.stabilityDays)
            : 1;
        return { item, migrated: true };
    }

    function updateFsrsState(item, grade, reviewedAtMs) {
        const weights = activeFsrsWeights();
        const previousReviewedAt = Date.parse(String(item.lastReviewedAt || ''));
        const elapsedDays = Number.isFinite(previousReviewedAt)
            ? Math.max(0, (reviewedAtMs - previousReviewedAt) / FSRS_DAY_MS)
            : 0;
        const previousStability = Math.max(0.1, Number(item.stabilityDays) || 0.1);
        const previousDifficulty = clampNumber(item.difficulty, 1, 10, fsrsInitialDifficulty('good', weights));
        const retrievability = fsrsRetrievability(elapsedDays, previousStability);
        const difficulty = fsrsDifficulty(previousDifficulty, grade, weights);
        let stability;
        if (grade === 'again') {
            stability = fsrsForgetStability(difficulty, previousStability, retrievability, weights);
        } else if (Number(item.seen || 0) === 0) {
            stability = fsrsInitialStability(grade, weights);
        } else if (elapsedDays <= 1) {
            stability = fsrsShortTermStability(previousStability, grade, weights);
        } else {
            stability = fsrsRecallStability(difficulty, previousStability, retrievability, grade, weights);
        }
        item.schedulerVersion = SCHEDULER_VERSION;
        item.stabilityDays = Math.max(0.1, stability);
        item.difficulty = difficulty;
        item.retrievability = fsrsRetrievability(0, item.stabilityDays);
        return {
            elapsedDays,
            previousStability,
            previousDifficulty,
            retrievability,
            weights
        };
    }

    function normalizeGrade(input) {
        if (typeof input === 'boolean') return input ? 'good' : 'again';
        const grade = String(input || '').trim().toLowerCase();
        return REVIEW_GRADES.includes(grade) ? grade : 'again';
    }

    function requestProfileSync(reason) {
        try {
            window.ProfileManager?.requestHighPrioritySync?.(reason);
        } catch (err) {
            console.warn('[EnglishVocabProgress] profile sync request failed', err);
        }
    }

    function activeProfileScope() {
        try {
            if (window.ProfileManager && typeof window.ProfileManager.getActiveId === 'function') {
                const id = window.ProfileManager.getActiveId();
                if (id) return { id, resolved: true };
            }
        } catch (err) {
            console.warn('[EnglishVocabProgress] failed to migrate profile-scoped storage', err);
        }
        return { id: 'default', resolved: false };
    }

    function activeProfileId() {
        return activeProfileScope().id;
    }

    function scopedKey(key) {
        return `${key}_${activeProfileId()}`;
    }

    function migrationKey(profileId) {
        return `${SCOPE_MIGRATION_PREFIX}${profileId}`;
    }

    function copyKeyIfMissing(sourceKey, targetKey) {
        if (localStorage.getItem(targetKey) !== null) return;
        const raw = localStorage.getItem(sourceKey);
        if (raw !== null) localStorage.setItem(targetKey, raw);
    }

    // Keep legacy fixed keys for rollback. A fallback copy remains pending until a real profile resolves.
    function ensureScopedMigration() {
        try {
            const scope = activeProfileScope();
            const markerKey = migrationKey(scope.id);
            const marker = localStorage.getItem(markerKey);
            const progressKey = `${PROGRESS_KEY}_${scope.id}`;
            const rewardKey = `${REWARD_KEY}_${scope.id}`;
            if (!scope.resolved) {
                if (marker) return;
                copyKeyIfMissing(PROGRESS_KEY, progressKey);
                copyKeyIfMissing(REWARD_KEY, rewardKey);
                localStorage.setItem(markerKey, 'fallback');
                return;
            }
            if (marker && marker !== 'fallback') return;
            const fallbackMarkerKey = migrationKey('default');
            if (scope.id !== 'default' && localStorage.getItem(fallbackMarkerKey) === 'fallback') {
                copyKeyIfMissing(`${PROGRESS_KEY}_default`, progressKey);
                copyKeyIfMissing(`${REWARD_KEY}_default`, rewardKey);
                localStorage.setItem(fallbackMarkerKey, `claimed:${scope.id}`);
            } else {
                copyKeyIfMissing(PROGRESS_KEY, progressKey);
                copyKeyIfMissing(REWARD_KEY, rewardKey);
            }
            localStorage.setItem(markerKey, '1');
        } catch (err) {}
    }

    function read() {
        ensureScopedMigration();
        return readKey(scopedKey(PROGRESS_KEY), {});
    }

    function write(data) {
        ensureScopedMigration();
        return writeKey(scopedKey(PROGRESS_KEY), data || {});
    }

    function readRewards() {
        ensureScopedMigration();
        return readKey(scopedKey(REWARD_KEY), {});
    }

    function writeRewards(rewards) {
        ensureScopedMigration();
        return writeKey(scopedKey(REWARD_KEY), rewards || {});
    }

    function readReviewEvents() {
        ensureScopedMigration();
        const events = readKey(scopedKey(REVIEW_EVENTS_KEY), []);
        return Array.isArray(events) ? events.filter(event => event && typeof event === 'object') : [];
    }

    function writeReviewEvents(events) {
        ensureScopedMigration();
        return writeKey(scopedKey(REVIEW_EVENTS_KEY), Array.isArray(events) ? events.slice(-MAX_REVIEW_EVENTS) : []);
    }

    function readCalibration() {
        ensureScopedMigration();
        const raw = readKey(scopedKey(CALIBRATION_KEY), null);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return {
                version: 2,
                algorithm: SCHEDULER_VERSION,
                sampleSize: 0,
                observedRetention: null,
                targetRetention: FSRS_TARGET_RETENTION,
                calibrated: false,
                confidence: 'insufficient',
                minimumReviews: FSRS_MIN_CALIBRATION_REVIEWS,
                minimumTransitions: FSRS_MIN_CALIBRATION_TRANSITIONS,
                parameterCalibration: null,
                ebbinghaus: null
            };
        }
        return Object.assign({
            version: 2,
            algorithm: SCHEDULER_VERSION,
            sampleSize: 0,
            observedRetention: null,
            targetRetention: FSRS_TARGET_RETENTION,
            calibrated: false,
            confidence: 'insufficient',
            minimumReviews: FSRS_MIN_CALIBRATION_REVIEWS,
            minimumTransitions: FSRS_MIN_CALIBRATION_TRANSITIONS,
            parameterCalibration: null,
            ebbinghaus: null
        }, raw);
    }

    function writeCalibration(calibration) {
        ensureScopedMigration();
        return writeKey(scopedKey(CALIBRATION_KEY), calibration || {});
    }

    function uniqueCalibrationEvents(input) {
        const byId = new Map();
        (Array.isArray(input) ? input : []).forEach(event => {
            if (!event || typeof event !== 'object') return;
            const grade = normalizeGrade(event.grade);
            const reviewedAt = Date.parse(String(event.reviewedAt || ''));
            if (!REVIEW_GRADES.includes(grade) || !Number.isFinite(reviewedAt)) return;
            const reviewId = String(event.reviewId || `${event.cardId || 'unknown'}:${reviewedAt}`);
            if (!byId.has(reviewId)) byId.set(reviewId, {
                ...event,
                reviewId,
                grade,
                cardId: String(event.cardId || 'unknown'),
                reviewedAtMs: reviewedAt
            });
        });
        return [...byId.values()].sort((a, b) => a.reviewedAtMs - b.reviewedAtMs);
    }

    function fsrsCalibrationLoss(weights, events) {
        const states = new Map();
        let loss = 0;
        let observations = 0;
        events.forEach(event => {
            const previous = states.get(event.cardId) || {
                seen: 0,
                stability: fsrsInitialStability('good', weights),
                difficulty: fsrsInitialDifficulty('good', weights),
                reviewedAtMs: null
            };
            const elapsedDays = previous.reviewedAtMs == null
                ? Math.max(0, Number(event.elapsedDays) || 0)
                : Math.max(0, (event.reviewedAtMs - previous.reviewedAtMs) / FSRS_DAY_MS);
            const retrievability = fsrsRetrievability(elapsedDays, previous.stability);
            const success = event.grade !== 'again';
            const probability = clampNumber(retrievability, 0.02, 0.98, 0.5);
            loss += success ? -Math.log(probability) : -Math.log(1 - probability);
            const difficulty = fsrsDifficulty(previous.difficulty, event.grade, weights);
            let stability;
            if (previous.seen === 0) stability = fsrsInitialStability(event.grade, weights);
            else if (event.grade === 'again') stability = fsrsForgetStability(difficulty, previous.stability, retrievability, weights);
            else if (elapsedDays <= 1) stability = fsrsShortTermStability(previous.stability, event.grade, weights);
            else stability = fsrsRecallStability(difficulty, previous.stability, retrievability, event.grade, weights);
            states.set(event.cardId, {
                seen: previous.seen + 1,
                stability: Math.max(0.1, stability),
                difficulty,
                reviewedAtMs: event.reviewedAtMs
            });
            observations += 1;
        });
        return observations ? loss / observations : Infinity;
    }

    function fitFsrsParameters(events) {
        const seenCards = new Set();
        const transitionCount = events.reduce((count, event) => {
            const transition = seenCards.has(event.cardId) ? 1 : 0;
            seenCards.add(event.cardId);
            return count + transition;
        }, 0);
        if (events.length < FSRS_MIN_CALIBRATION_REVIEWS || transitionCount < FSRS_MIN_CALIBRATION_TRANSITIONS) {
            return {
                version: 1,
                method: 'coordinate-descent-log-loss',
                fitted: false,
                sampleSize: events.length,
                transitionCount,
                reason: events.length < FSRS_MIN_CALIBRATION_REVIEWS
                    ? 'insufficient-review-events'
                    : 'insufficient-repeated-card-observations',
                weights: [...FSRS_WEIGHTS]
            };
        }
        let weights = [...FSRS_WEIGHTS];
        const objectiveBefore = fsrsCalibrationLoss(weights, events);
        let objective = objectiveBefore;
        const steps = FSRS_WEIGHTS.map((value, index) => {
            const bounds = FSRS_WEIGHT_BOUNDS[index];
            return Math.max((bounds[1] - bounds[0]) * 0.02, Math.abs(value) * 0.15);
        });
        let iterations = 0;
        for (let iteration = 0; iteration < FSRS_CALIBRATION_ITERATIONS; iteration += 1) {
            iterations += 1;
            for (let index = 0; index < weights.length; index += 1) {
                const candidates = [-1, 1].map(direction => {
                    const candidate = [...weights];
                    candidate[index] = candidate[index] + direction * steps[index];
                    return normalizeFsrsWeights(candidate);
                });
                const scored = candidates
                    .map(candidate => ({ candidate, score: fsrsCalibrationLoss(candidate, events) }))
                    .sort((a, b) => a.score - b.score)[0];
                if (scored.score < objective) {
                    weights = scored.candidate;
                    objective = scored.score;
                }
            }
            for (let index = 0; index < steps.length; index += 1) steps[index] *= 0.55;
        }
        return {
            version: 1,
            method: 'coordinate-descent-log-loss',
            fitted: Number.isFinite(objective) && objective <= objectiveBefore,
            sampleSize: events.length,
            transitionCount,
            iterations,
            objectiveBefore,
            objectiveAfter: objective,
            weights: normalizeFsrsWeights(weights),
            baselineWeights: [...FSRS_WEIGHTS]
        };
    }

    function ebbinghausLoss(lambda, observations) {
        return observations.reduce((total, observation) => {
            const probability = clampNumber(Math.exp(-lambda * observation.elapsedDays), 0.02, 0.98, 0.5);
            return total + (observation.success ? -Math.log(probability) : -Math.log(1 - probability));
        }, 0) / Math.max(1, observations.length);
    }

    function fitEbbinghaus(events) {
        const lastByCard = new Map();
        const observations = [];
        events.forEach(event => {
            const previousAt = lastByCard.get(event.cardId);
            if (previousAt != null) {
                const elapsedDays = Math.max(0.25, (event.reviewedAtMs - previousAt) / FSRS_DAY_MS);
                observations.push({ elapsedDays, success: event.grade !== 'again' });
            }
            lastByCard.set(event.cardId, event.reviewedAtMs);
        });
        if (events.length < FSRS_MIN_CALIBRATION_REVIEWS || observations.length < 10) {
            return {
                version: 1,
                model: 'ebbinghaus-exponential',
                fitted: false,
                sampleSize: events.length,
                transitionCount: observations.length,
                lambda: null,
                halfLifeDays: null,
                reason: events.length < FSRS_MIN_CALIBRATION_REVIEWS
                    ? 'insufficient-review-events'
                    : 'insufficient-repeated-card-observations'
            };
        }
        let low = 0.001;
        let high = 8;
        for (let index = 0; index < 36; index += 1) {
            const left = low + (high - low) / 3;
            const right = high - (high - low) / 3;
            if (ebbinghausLoss(left, observations) <= ebbinghausLoss(right, observations)) high = right;
            else low = left;
        }
        const lambda = (low + high) / 2;
        return {
            version: 1,
            model: 'ebbinghaus-exponential',
            fitted: Number.isFinite(lambda),
            sampleSize: events.length,
            transitionCount: observations.length,
            lambda,
            halfLifeDays: Math.log(2) / lambda,
            objective: ebbinghausLoss(lambda, observations)
        };
    }

    function calibrate(options = {}) {
        const events = uniqueCalibrationEvents(Array.isArray(options.events) ? options.events : readReviewEvents());
        const sampleSize = events.length;
        const retained = events.filter(event => normalizeGrade(event.grade) !== 'again').length;
        const observedRetention = sampleSize ? retained / sampleSize : null;
        const minimumReviews = FSRS_MIN_CALIBRATION_REVIEWS;
        const calibrated = sampleSize >= minimumReviews && Number.isFinite(observedRetention);
        const targetRetention = clampNumber(
            calibrated
                ? FSRS_TARGET_RETENTION + clampNumber((FSRS_TARGET_RETENTION - observedRetention) * 0.25, -0.02, 0.02, 0)
                : FSRS_TARGET_RETENTION,
            FSRS_MIN_RETENTION,
            FSRS_MAX_RETENTION,
            FSRS_TARGET_RETENTION
        );
        const parameterCalibration = fitFsrsParameters(events);
        const ebbinghaus = fitEbbinghaus(events);
        const result = {
            version: 2,
            algorithm: SCHEDULER_VERSION,
            calibrationMethod: 'fsrs-5-coordinate-descent-plus-ebbinghaus',
            sampleSize,
            observedRetention,
            targetRetention,
            calibrated,
            confidence: sampleSize >= 50 ? 'high' : calibrated ? 'medium' : 'insufficient',
            minimumReviews,
            minimumTransitions: FSRS_MIN_CALIBRATION_TRANSITIONS,
            parametersReady: parameterCalibration.fitted && ebbinghaus.fitted,
            needsRecalibration: false,
            parameterCalibration,
            ebbinghaus,
            updatedAt: new Date().toISOString()
        };
        const persisted = options.persist === false ? true : writeCalibration(result);
        return Object.assign(result, { persisted });
    }

    function localDateAt(timestamp) {
        if (window.PetBankTime && typeof window.PetBankTime.localDate === 'function') {
            return window.PetBankTime.localDate(timestamp);
        }
        return new Date(timestamp).toISOString().slice(0, 10);
    }

    function appendReviewEvent(event) {
        const events = readReviewEvents();
        const existing = events.find(item => item.reviewId === event.reviewId);
        if (existing) return { persisted: true, duplicate: true };
        events.push(event);
        return { persisted: writeReviewEvents(events), duplicate: false };
    }

    function buildReviewEvent(cardId, item, grade, reviewedAtMs, options, reviewId, transition = {}) {
        return {
            version: 1,
            reviewId,
            cardId: String(cardId),
            grade,
            correct: grade !== 'again',
            reviewedAt: item.lastReviewedAt || isoAt(reviewedAtMs),
            localDate: localDateAt(reviewedAtMs),
            dueAt: item.dueAt || '',
            status: item.status || 'learning',
            intervalDays: Number(item.intervalDays || 0),
            schedulerVersion: item.schedulerVersion || SCHEDULER_VERSION,
            elapsedDays: Number(transition.elapsedDays || 0),
            previousStabilityDays: Number(transition.previousStability || 0),
            previousDifficulty: Number(transition.previousDifficulty || 0),
            previousRetrievability: Number(transition.retrievability || 0),
            stabilityDays: Number(item.stabilityDays || 0),
            difficulty: Number(item.difficulty || 0),
            retrievability: Number(item.retrievability || 0),
            lapses: Number(item.lapses || 0),
            hintUsed: Boolean(item.hintUsed),
            responseMode: String(item.responseMode || options.responseMode || ''),
            responseMs: Number(item.lastResponseMs || 0)
        };
    }

    function get(cardId) {
        const data = read();
        const result = migrateSchedulerItem(data[cardId], Date.now());
        if (data[cardId] && result.migrated) {
            data[cardId] = result.item;
            write(data);
        }
        return result.item;
    }

    function record(cardId, isCorrect, options = {}) {
        if (!cardId) return get(cardId);
        const data = read();
        const item = Object.assign({}, get(cardId));
        const reviewedAtMs = resolveNow(options.now);
        const grade = normalizeGrade(options.grade || isCorrect);
        const reviewId = String(options.reviewId || `${activeProfileId()}:${cardId}:${reviewedAtMs}:${Number(item.seen || 0) + 1}`);
        if (item.lastReviewId === reviewId) {
            const existingEvent = readReviewEvents().find(event => event.reviewId === reviewId);
            if (existingEvent) return Object.assign({}, item, { persisted: true, eventPersisted: true, duplicate: true });
            const previousReviewAt = Date.parse(String(item.lastReviewedAt || ''));
            const retryEvent = buildReviewEvent(cardId, item, item.lastGrade || grade, Number.isFinite(previousReviewAt) ? previousReviewAt : reviewedAtMs, options, reviewId);
            const retryResult = appendReviewEvent(retryEvent);
            return Object.assign({}, item, {
                persisted: true,
                eventPersisted: retryResult.persisted,
                partial: !retryResult.persisted,
                duplicate: true
            });
        }
        const correct = grade !== 'again';
        const transition = updateFsrsState(item, grade, reviewedAtMs);
        item.seen += 1;
        if (correct) {
            item.correct += 1;
            item.streak += 1;
        } else {
            item.wrong += 1;
            item.streak = 0;
        }
        item.status = grade !== 'again' && grade !== 'hard' && item.streak >= MASTERED_STREAK ? 'mastered' : 'learning';
        const easeDelta = { again: -0.2, hard: -0.05, good: 0.05, easy: 0.15 }[grade];
        item.ease = clampEase(Number(item.ease || SRS_DEFAULT_EASE) + easeDelta);
        item.lapses = Math.max(0, Number(item.lapses || 0) + (grade === 'again' ? 1 : 0));
        if (grade === 'again') {
            item.repetitions = 0;
            item.intervalDays = 0;
            item.dueAt = isoAt(reviewedAtMs + SRS_RETRY_MINUTES * 60 * 1000);
        } else if (grade === 'hard') {
            item.intervalDays = 0;
            item.dueAt = isoAt(reviewedAtMs + SRS_HARD_RETRY_HOURS * 60 * 60 * 1000);
        } else {
            item.repetitions = Math.max(0, Number(item.repetitions || 0)) + 1;
            const useLearningStep = item.repetitions <= 2;
            const scheduleIndex = Math.min(item.repetitions - 1, SRS_INTERVALS_DAYS.length - 1);
            const baseDays = useLearningStep
                ? SRS_INTERVALS_DAYS[scheduleIndex]
                : Math.min(SRS_MAX_INTERVAL_DAYS, Math.max(1, Math.round(fsrsInterval(scheduler().targetRetention, item.stabilityDays))));
            const scheduledDays = grade === 'easy'
                ? Math.min(SRS_MAX_INTERVAL_DAYS, Math.max(SRS_EASY_MIN_INTERVAL_DAYS, Math.round(baseDays * 1.5)))
                : baseDays;
            item.intervalDays = scheduledDays;
            item.dueAt = isoAt(reviewedAtMs + scheduledDays * 24 * 60 * 60 * 1000);
        }
        item.lastGrade = grade;
        if (Object.prototype.hasOwnProperty.call(options, 'hintUsed')) item.hintUsed = Boolean(options.hintUsed);
        if (options.responseMode) item.responseMode = String(options.responseMode);
        if (Number.isFinite(Number(options.responseMs))) item.lastResponseMs = Math.max(0, Number(options.responseMs));
        item.lastReviewedAt = isoAt(reviewedAtMs);
        item.updatedAt = item.lastReviewedAt;
        item.lastReviewId = reviewId;
        data[cardId] = item;
        const persisted = write(data);
        if (!persisted) return Object.assign({}, item, { persisted: false, eventPersisted: false });
        const eventResult = appendReviewEvent(buildReviewEvent(cardId, item, grade, reviewedAtMs, options, reviewId, transition));
        requestProfileSync('english-vocab-progress');
        return Object.assign({}, item, {
            persisted: true,
            eventPersisted: eventResult.persisted,
            partial: !eventResult.persisted,
            duplicate: false
        });
    }

    function stats(cards) {
        const data = read();
        const now = Date.now();
        return (cards || []).reduce((acc, card) => {
            const progress = data[card.id] || {};
            const status = progress.status || 'new';
            if (status === 'mastered') acc.mastered += 1;
            else if (status === 'learning') acc.learning += 1;
            else acc.new += 1;
            if (status !== 'new' && (!progress.dueAt || Date.parse(progress.dueAt) <= now)) acc.due += 1;
            acc.total += 1;
            return acc;
        }, { total: 0, new: 0, learning: 0, mastered: 0, due: 0 });
    }

    function reviewStats(cards, options = {}) {
        const sourceCards = Array.isArray(cards) ? cards.filter(card => card && card.id) : [];
        const cardMap = new Map(sourceCards.map(card => [String(card.id), card]));
        const allowedIds = sourceCards.length ? new Set(sourceCards.map(card => String(card.id))) : null;
        const now = resolveNow(options.now);
        const days = Math.max(1, Math.min(30, Math.floor(Number(options.days) || 7)));
        const since = now - (days * 24 * 60 * 60 * 1000);
        const events = readReviewEvents()
            .filter(event => !allowedIds || allowedIds.has(String(event.cardId)))
            .filter(event => {
                const reviewedAt = Date.parse(String(event.reviewedAt || ''));
                return !Number.isFinite(reviewedAt) || reviewedAt >= since;
            });
        const daily = Array.from({ length: days }, (_, index) => {
            const timestamp = now - ((days - index - 1) * 24 * 60 * 60 * 1000);
            return { date: localDateAt(timestamp), reviews: 0, correct: 0, wrong: 0, accuracy: 0 };
        });
        const dailyMap = new Map(daily.map(item => [item.date, item]));
        const byMode = {};
        const byCard = new Map();
        let correct = 0;
        events.forEach(event => {
            const isCorrect = event.correct !== false && event.grade !== 'again';
            if (isCorrect) correct += 1;
            const mode = String(event.responseMode || 'unknown');
            const modeStats = byMode[mode] || { reviews: 0, correct: 0, wrong: 0, accuracy: 0 };
            modeStats.reviews += 1;
            if (isCorrect) modeStats.correct += 1;
            else modeStats.wrong += 1;
            modeStats.accuracy = Math.round((modeStats.correct / modeStats.reviews) * 100);
            byMode[mode] = modeStats;
            const reviewedAtMs = Date.parse(String(event.reviewedAt || ''));
            const date = String(event.localDate || (Number.isFinite(reviewedAtMs) ? localDateAt(reviewedAtMs) : ''));
            const day = dailyMap.get(date);
            if (day) {
                day.reviews += 1;
                if (isCorrect) day.correct += 1;
                else day.wrong += 1;
                day.accuracy = Math.round((day.correct / day.reviews) * 100);
            }
            const cardId = String(event.cardId || '');
            const cardStats = byCard.get(cardId) || { cardId, reviews: 0, correct: 0, wrong: 0, accuracy: 0 };
            cardStats.reviews += 1;
            if (isCorrect) cardStats.correct += 1;
            else cardStats.wrong += 1;
            cardStats.accuracy = Math.round((cardStats.correct / cardStats.reviews) * 100);
            byCard.set(cardId, cardStats);
        });
        const weakCards = [...byCard.values()]
            .sort((a, b) => b.wrong - a.wrong || a.accuracy - b.accuracy || b.reviews - a.reviews)
            .slice(0, 8)
            .map(item => {
                const card = cardMap.get(item.cardId) || {};
                return Object.assign(item, { word: String(card.word || item.cardId), translation: String(card.translation || '') });
            });
        const progressStats = stats(sourceCards);
        return {
            days,
            totalReviews: events.length,
            correct,
            wrong: events.length - correct,
            accuracy: events.length ? Math.round((correct / events.length) * 100) : 0,
            due: progressStats.due,
            new: progressStats.new,
            learning: progressStats.learning,
            mastered: progressStats.mastered,
            daily,
            byMode,
            weakCards,
            events: events.slice(-20)
        };
    }

    function claimMilestoneRewards(cards) {
        const cardStats = stats(cards || []);
        const rewards = readRewards();
        if (cardStats.mastered >= 10 && !rewards[COMMON_VOUCHER_ID]) {
            rewards[COMMON_VOUCHER_ID] = {
                type: 'card-token',
                title: 'Minecraft 普通卡兑换券',
                reason: 'mastered-10-minecraft-words',
                masteredCount: cardStats.mastered,
                createdAt: new Date().toISOString()
            };
            if (!writeRewards(rewards)) {
                delete rewards[COMMON_VOUCHER_ID];
            }
        }
        return rewards;
    }

    function reset() {
        write({});
        writeRewards({});
        writeReviewEvents([]);
    }

    window.EnglishVocabProgress = {
        read,
        write,
        get,
        record,
        stats,
        readRewards,
        writeRewards,
        readReviewEvents,
        writeReviewEvents,
        reviewStats,
        readCalibration,
        writeCalibration,
        calibrate,
        claimMilestoneRewards,
        reset,
        scheduler,
        SRS_INTERVALS_DAYS,
        SRS_RETRY_MINUTES
    };
})();
