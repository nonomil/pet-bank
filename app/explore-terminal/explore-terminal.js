(function () {
    'use strict';

    var ASSET_ROOT = '../../assets/story/pixel-dialogue/ui/adventure-terminal/';
    var worlds = {
        forest: {
            title: '森林探险',
            subtitle: '溪流、树屋和荧光路线',
            preview: ASSET_ROOT + 'reference/clean-forest.png',
            accent: '#5ee28a'
        },
        'sci-fi': {
            title: '星港科技区',
            subtitle: '空间站、穹顶和星际航线',
            preview: ASSET_ROOT + 'reference/clean-scifi.png',
            accent: '#61dff3'
        },
        block: {
            title: '方块地下城',
            subtitle: '村庄、水晶和地下遗迹',
            preview: ASSET_ROOT + 'reference/clean-block.png',
            accent: '#b98cff'
        }
    };

    var activeWorld = document.body.dataset.activeWorld || 'forest';
    var buttons = Array.from(document.querySelectorAll('[data-terminal-world]'));
    var nodeButtons = Array.from(document.querySelectorAll('[data-world-node]'));
    var stage = document.querySelector('.terminal-stage');
    var preview = document.getElementById('terminalPreviewImage');
    var activeLabel = document.getElementById('terminalActiveWorld');
    var subtitle = document.getElementById('terminalWorldSubtitle');
    var liveStatus = document.getElementById('terminalLiveStatus');
    var activeNodeByWorld = { forest: 'treehouse', 'sci-fi': 'orbital', block: 'village' };

    function getNodeTitle(node) {
        var title = node && node.querySelector('strong');
        return title ? title.textContent : '下一站';
    }

    function renderNodes(id) {
        nodeButtons.forEach(function (node) {
            var visible = node.dataset.nodeWorld === id;
            var selected = visible && node.dataset.nodeId === activeNodeByWorld[id];
            node.hidden = !visible;
            node.tabIndex = visible ? 0 : -1;
            node.setAttribute('aria-hidden', visible ? 'false' : 'true');
            node.setAttribute('aria-pressed', selected ? 'true' : 'false');
            node.classList.toggle('is-selected', selected);
        });
    }

    function renderWorld(id) {
        var world = worlds[id];
        if (!world || !preview) return;
        activeWorld = id;
        document.body.dataset.activeWorld = id;
        document.documentElement.style.setProperty('--terminal-accent', world.accent);
        if (stage) {
            stage.style.setProperty('--world-accent', world.accent);
            stage.dataset.world = id;
        }
        preview.src = world.preview;
        preview.alt = world.title + '地图';
        if (activeLabel) activeLabel.textContent = world.title;
        if (subtitle) subtitle.textContent = world.subtitle;
        renderNodes(id);
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

    nodeButtons.forEach(function (node) {
        node.addEventListener('click', function () {
            var worldId = node.dataset.nodeWorld;
            activeNodeByWorld[worldId] = node.dataset.nodeId;
            renderNodes(worldId);
            if (liveStatus) liveStatus.textContent = worlds[worldId].title + ' · ' + getNodeTitle(node) + ' 已选中，点击继续冒险进入下一站。';
        });
    });

    var continueButton = document.querySelector('[aria-label="继续冒险"]');
    if (continueButton) continueButton.addEventListener('click', function () {
        var selectedNode = nodeButtons.find(function (node) {
            return node.dataset.nodeWorld === activeWorld && node.dataset.nodeId === activeNodeByWorld[activeWorld];
        });
        liveStatus.textContent = '已锁定' + worlds[activeWorld].title + ' · ' + getNodeTitle(selectedNode) + '，正在准备下一站。';
    });

    var detectiveButton = document.querySelector('[aria-label="打开侦探小游戏"]');
    if (detectiveButton) detectiveButton.addEventListener('click', function () {
        liveStatus.textContent = '侦探小游戏入口已打开，当前为探险终端设计预览。';
    });

    renderWorld(activeWorld);
})();
