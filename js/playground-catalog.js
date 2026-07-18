(function (global) {
    'use strict';

    const DEFAULT_CATEGORY = 'english';
    let activeCategory = DEFAULT_CATEGORY;

    function getPage() {
        return document.getElementById('page-playground');
    }

    function getCategoryLabel(category) {
        const tab = getPage()?.querySelector(`[data-playground-category-tab][data-playground-category="${category}"]`);
        return tab?.querySelector('span')?.textContent?.trim() || '学习游戏';
    }

    function setCategory(category) {
        const page = getPage();
        if (!page) return false;
        const tabs = [...page.querySelectorAll('[data-playground-category-tab]')];
        const cards = [...page.querySelectorAll('[data-playground-category]:not([data-playground-category-tab])')];
        const nextCategory = tabs.some((tab) => tab.dataset.playgroundCategory === category)
            ? category
            : DEFAULT_CATEGORY;
        const label = getCategoryLabel(nextCategory);
        let visibleCount = 0;

        tabs.forEach((tab) => {
            const selected = tab.dataset.playgroundCategory === nextCategory;
            tab.classList.toggle('is-active', selected);
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
            tab.tabIndex = selected ? 0 : -1;
        });
        cards.forEach((card) => {
            const visible = card.dataset.playgroundCategory === nextCategory;
            card.hidden = !visible;
            card.setAttribute('aria-hidden', visible ? 'false' : 'true');
            if (visible) visibleCount += 1;
        });

        const count = page.querySelector('#playgroundVisibleCount');
        const hint = page.querySelector('#playgroundCatalogHint');
        if (count) count.textContent = String(visibleCount);
        if (hint) hint.textContent = `${label} · ${visibleCount} 款游戏`;
        activeCategory = nextCategory;
        return true;
    }

    function handleClick(event) {
        const tab = event.target.closest('[data-playground-category-tab]');
        if (!tab || !getPage()?.contains(tab)) return;
        setCategory(tab.dataset.playgroundCategory);
    }

    function handleKeydown(event) {
        const tab = event.target.closest('[data-playground-category-tab]');
        if (!tab || !getPage()?.contains(tab)) return;
        const tabs = [...getPage().querySelectorAll('[data-playground-category-tab]')];
        const index = tabs.indexOf(tab);
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home'
            ? 0
            : event.key === 'End'
                ? tabs.length - 1
                : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[nextIndex]?.focus();
        setCategory(tabs[nextIndex]?.dataset.playgroundCategory);
    }

    function mount() {
        const page = getPage();
        if (!page || page.dataset.playgroundCatalogMounted === 'true') return Boolean(page);
        page.dataset.playgroundCatalogMounted = 'true';
        page.addEventListener('click', handleClick);
        page.addEventListener('keydown', handleKeydown);
        setCategory(activeCategory);
        return true;
    }

    global.PetBankPlaygroundCatalog = Object.freeze({
        mount,
        setCategory,
        getCategory: () => activeCategory
    });
}(window));
