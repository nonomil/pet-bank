(function () {
    'use strict';

    function getTaskId(dim, taskName) {
        return `${dim}-${taskName}`;
    }

    function isCompleted(taskId) {
        const state = window.PetBankDailyState && typeof window.PetBankDailyState.load === 'function'
            ? window.PetBankDailyState.load()
            : null;
        return Boolean(state && state.completedTasks && state.completedTasks.has(taskId));
    }

    function showFeedback(taskName, points) {
        const card = document.getElementById('childJourneyFeedback');
        const text = document.getElementById('childJourneyFeedbackText');
        if (!card || !text) return;
        const reward = Math.max(0, Math.floor(Number(points) || 0));
        text.textContent = reward > 0
            ? `“${taskName}”完成啦！你收下了 ${reward} 成长分，小伙伴也更有精神了。`
            : `“${taskName}”完成啦！小伙伴正在为你鼓掌。`;
        card.hidden = false;
        card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function handleGameResult(event) {
        const data = event && event.data;
        if (!data || !['petbank-typing-defense', 'petbank-word-memory-map'].includes(data.source)) return;
        if (event.origin && window.location.origin && event.origin !== window.location.origin) return;
        if (data.kind !== 'result') return;

        const payload = data.payload || {};
        const points = data.source === 'petbank-word-memory-map'
            ? payload.score
            : payload.score;
        const title = data.source === 'petbank-typing-defense'
            ? (payload.won ? '打字防线通关' : '打字防线练习')
            : '像素探险清关';
        showFeedback(title, points);
    }

    function wrapTaskToggle() {
        if (typeof window.toggleTask !== 'function' || window.toggleTask.__childJourneyWrapped) return;
        const originalToggleTask = window.toggleTask;
        function toggleTaskWithFeedback(dim, taskName, points) {
            const taskId = getTaskId(dim, taskName);
            const wasCompleted = isCompleted(taskId);
            const result = originalToggleTask.apply(this, arguments);
            if (!wasCompleted && isCompleted(taskId)) showFeedback(taskName, points);
            return result;
        }
        toggleTaskWithFeedback.__childJourneyWrapped = true;
        window.toggleTask = toggleTaskWithFeedback;
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wrapTaskToggle, { once: true });
    } else {
        wrapTaskToggle();
    }

    window.addEventListener('message', handleGameResult);
}());
