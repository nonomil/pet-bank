(function () {
    'use strict';

    const ICONS = {
        check: '<polyline points="20 6 9 17 4 12"></polyline>',
        'check-check': '<polyline points="18 7 10.5 14.5 7 11"></polyline><polyline points="11 7 3.5 14.5 0 11"></polyline>',
        archive: '<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>'
    };

    function buildSvg(name, className) {
        const markup = ICONS[name];
        if (!markup) return null;
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('fill', 'none');
        svg.setAttribute('stroke', 'currentColor');
        svg.setAttribute('stroke-width', '2');
        svg.setAttribute('stroke-linecap', 'round');
        svg.setAttribute('stroke-linejoin', 'round');
        if (className) svg.setAttribute('class', className);
        svg.innerHTML = markup;
        return svg;
    }

    function createIcons(options) {
        const root = options && options.root ? options.root : document;
        root.querySelectorAll('[data-lucide]').forEach(function (node) {
            const name = node.getAttribute('data-lucide');
            const svg = buildSvg(name, node.getAttribute('class'));
            if (!svg) return;
            svg.setAttribute('aria-hidden', 'true');
            node.replaceWith(svg);
        });
    }

    window.lucide = {
        createIcons: createIcons
    };
})();
