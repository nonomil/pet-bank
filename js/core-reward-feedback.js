/**
 * core-reward-feedback.js - safe, reusable reward result card
 */
(function (root) {
    'use strict';

    function text(document, value) {
        const node = document.createElement('span');
        node.textContent = value == null ? '' : String(value);
        return node;
    }

    function render(container, model) {
        if (!container || !container.ownerDocument) return false;
        const document = container.ownerDocument;
        container.textContent = '';
        container.className = `${container.className || ''} core-reward-card`.trim();

        const title = document.createElement('strong');
        title.appendChild(text(document, model && model.title ? model.title : '奖励结果'));
        container.appendChild(title);

        const list = document.createElement('ul');
        list.className = 'core-reward-lines';
        (model && Array.isArray(model.lines) ? model.lines : []).forEach((line) => {
            const item = document.createElement('li');
            item.appendChild(text(document, line));
            list.appendChild(item);
        });
        container.appendChild(list);

        if (model && model.nextAction && model.nextAction.label) {
            const next = document.createElement('p');
            next.className = 'core-reward-next';
            next.appendChild(text(document, `下一步：${model.nextAction.label}${model.nextAction.reason ? ` · ${model.nextAction.reason}` : ''}`));
            container.appendChild(next);
        }
        return true;
    }

    function show(result, options = {}) {
        const service = root.CoreRewardService;
        const model = service && typeof service.toPresentation === 'function'
            ? service.toPresentation(result)
            : { title: '奖励结果', lines: [], accepted: false };
        const document = root.document;
        const selector = options.selector || '#core-reward-feedback';
        const container = options.container || (document && document.querySelector(selector));
        if (container && render(container, model)) {
            container.hidden = false;
            return model;
        }
        if (typeof root.showToast === 'function' && model.lines && model.lines.length) {
            root.showToast(`${model.title}：${model.lines.join('、')}`);
        }
        return model;
    }

    root.CoreRewardFeedback = { render, show };
})(typeof window !== 'undefined' ? window : globalThis);
