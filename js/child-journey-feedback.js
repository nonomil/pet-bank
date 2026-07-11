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
}());
