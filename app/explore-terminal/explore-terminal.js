(function () {
    'use strict';

    var ASSET_ROOT = '../../assets/story/pixel-dialogue/ui/adventure-terminal/';
    var worlds = {
        forest: {
            title: '森林探险',
            subtitle: '溪流、树屋和荧光路线',
            preview: ASSET_ROOT + 'reference/forest.png',
            marker: ASSET_ROOT + 'published/world-forest-marker.png',
            accent: '#5ee28a'
        },
        'sci-fi': {
            title: '星港科技区',
            subtitle: '空间站、穹顶和星际航线',
            preview: ASSET_ROOT + 'reference/scifi.png',
            marker: ASSET_ROOT + 'published/world-space-marker.png',
            accent: '#61dff3'
        },
        block: {
            title: '方块地下城',
            subtitle: '村庄、水晶和地下遗迹',
            preview: ASSET_ROOT + 'reference/block.png',
            marker: ASSET_ROOT + 'published/world-block-marker.png',
            accent: '#b98cff'
        }
    };

    var activeWorld = document.body.dataset.activeWorld || 'forest';
    var buttons = Array.from(document.querySelectorAll('[data-terminal-world]'));
    var stage = document.querySelector('.terminal-stage');
    var preview = document.getElementById('terminalPreviewImage');
    var marker = document.getElementById('terminalWorldMarker');
    var activeLabel = document.getElementById('terminalActiveWorld');
    var subtitle = document.getElementById('terminalWorldSubtitle');
    var liveStatus = document.getElementById('terminalLiveStatus');

    function renderWorld(id) {
        var world = worlds[id];
        if (!world || !preview) return;
        activeWorld = id;
        document.body.dataset.activeWorld = id;
        document.documentElement.style.setProperty('--terminal-accent', world.accent);
        if (stage) stage.style.setProperty('--world-accent', world.accent);
        preview.src = world.preview;
        preview.alt = world.title + '首页设计预览';
        if (marker) {
            marker.src = world.marker;
            marker.alt = world.title + '路线标记';
        }
        if (activeLabel) activeLabel.textContent = world.title;
        if (subtitle) subtitle.textContent = world.subtitle;
        buttons.forEach(function (button) {
            var active = button.dataset.terminalWorld === id;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-selected', active ? 'true' : 'false');
        });
        if (liveStatus) liveStatus.textContent = world.title + '已准备好，下一站正在等你。';
    }

    buttons.forEach(function (button) {
        button.addEventListener('click', function () { renderWorld(button.dataset.terminalWorld); });
    });

    var continueButton = document.querySelector('[aria-label="继续冒险"]');
    if (continueButton) continueButton.addEventListener('click', function () {
        liveStatus.textContent = '已锁定' + worlds[activeWorld].title + '，正在准备下一站。';
    });

    var detectiveButton = document.querySelector('[aria-label="打开侦探小游戏"]');
    if (detectiveButton) detectiveButton.addEventListener('click', function () {
        liveStatus.textContent = '侦探小游戏入口已打开，当前为探险终端设计预览。';
    });

    renderWorld(activeWorld);
})();
