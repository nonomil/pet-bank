(function () {
    'use strict';

    const ICONS = {
        check: '<polyline points="20 6 9 17 4 12"></polyline>',
        'check-check': '<polyline points="18 7 10.5 14.5 7 11"></polyline><polyline points="11 7 3.5 14.5 0 11"></polyline>',
        archive: '<rect x="3" y="4" width="18" height="4" rx="1"></rect><path d="M5 8v11a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"></path><path d="M10 12h4"></path>',
        home: '<path d="m3 10 9-7 9 7"></path><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"></path>',
        settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"></path><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.37a1.7 1.7 0 0 0-1 .38V20a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-.38 1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.63 15a1.7 1.7 0 0 0-.38-1H4a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 .38-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.63a1.7 1.7 0 0 0 1-.38V4a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 .38 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.37 9c0 .36.12.7.38 1H20a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-.51 1Z"></path>',
        star: '<polygon points="12 2 15.1 8.3 22 9.3 17 14.2 18.2 21 12 17.8 5.8 21 7 14.2 2 9.3 8.9 8.3 12 2"></polygon>',
        'book-open': '<path d="M12 7v14"></path><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H12v18H5.5A2.5 2.5 0 0 1 3 18.5Z"></path><path d="M21 5.5A2.5 2.5 0 0 0 18.5 3H12v18h6.5a2.5 2.5 0 0 0 2.5-2.5Z"></path>',
        'paw-print': '<circle cx="11" cy="4" r="2"></circle><circle cx="18" cy="8" r="2"></circle><circle cx="5" cy="8" r="2"></circle><path d="M6.5 18.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5c0 1.4-1.1 2.5-2.5 2.5-.9 0-1.7-.5-3-.5s-2.1.5-3 .5a2.5 2.5 0 0 1-2.5-2.5Z"></path>',
        map: '<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21 3 6"></polygon><path d="M9 3v15"></path><path d="M15 6v15"></path>',
        'gamepad-2': '<path d="M6 12h4"></path><path d="M8 10v4"></path><path d="M15 13h.01"></path><path d="M18 11h.01"></path><path d="M17.3 6H6.7A4.7 4.7 0 0 0 2 10.7v2.6A4.7 4.7 0 0 0 6.7 18h.2a3 3 0 0 0 2.1-.9l1-1.1h4l1 1.1a3 3 0 0 0 2.1.9h.2a4.7 4.7 0 0 0 4.7-4.7v-2.6A4.7 4.7 0 0 0 17.3 6Z"></path>',
        wrench: '<path d="M14.7 6.3a4 4 0 0 0 5 5L10.5 20.5a2.1 2.1 0 0 1-3-3l9.2-9.2a4 4 0 0 0-2-2Z"></path><path d="m18 2 4 4"></path><path d="m2 22 5-5"></path>'
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
