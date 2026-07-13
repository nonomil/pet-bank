/* PixelStoryMap - three worlds plus detective mini-games */
(function (root) {
    'use strict';

    var PACK_ROOT = 'data/story-packs/05-pixel-worlds-story';
    var manifestCache = null;

    function assetUrl(path) {
        return typeof root.resolvePetBankAssetUrl === 'function' ? root.resolvePetBankAssetUrl(path) : path;
    }

    function fetchJson(path) {
        return root.fetch(assetUrl(path)).then(function (response) {
            if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + path);
            return response.json();
        });
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCompletedChapters() {
        if (root.PixelStoryEngine && typeof root.PixelStoryEngine.getCompletedChapters === 'function') {
            return root.PixelStoryEngine.getCompletedChapters();
        }
        return [];
    }

    function getTracks(manifest) {
        return (manifest.worlds || []).concat(manifest.bonusTracks || []);
    }

    function findTrack(manifest, trackId) {
        var tracks = getTracks(manifest);
        return tracks.find(function (track) { return track.id === trackId; }) || tracks[0] || null;
    }

    function render(containerId, preferredTrackId) {
        var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!container) return;

        var manifestPromise = manifestCache
            ? Promise.resolve(manifestCache)
            : fetchJson(PACK_ROOT + '/manifest.json').then(function (manifest) {
                manifestCache = manifest;
                return manifest;
            });

        manifestPromise.then(function (manifest) {
            renderTrack(container, manifest, preferredTrackId || container.dataset.preferredTrack || 'sci-fi');
        }).catch(function (error) {
            container.innerHTML = '<div class="pixel-story-map pixel-story-map-fallback"><div class="pixel-story-map-fallback-content"><strong>像素世界正在准备</strong><span>地图信号暂时离线，请稍后再试。</span></div></div>';
            console.error('[PixelStoryMap] manifest load failed:', error);
        });
    }

    function renderTrack(container, manifest, trackId) {
        var track = findTrack(manifest, trackId);
        if (!track) {
            container.innerHTML = '<div class="pixel-story-map pixel-story-map-fallback">没有可用地图</div>';
            return;
        }

        var completed = getCompletedChapters();
        var tracks = getTracks(manifest);
        var nodes = (track.nodes || []).slice().sort(function (a, b) { return (a.order || 99) - (b.order || 99); });
        var routePath = nodes.map(function (node, index) {
            return (index === 0 ? 'M' : 'L') + node.position.x + ',' + node.position.y;
        }).join(' ');
        var background = track.background ? assetUrl(track.background) : '';

        var html = '<section class="pixel-story-map pixel-story-map-world pixel-story-map-tone-' + escapeHtml(track.tone || 'default') + '" aria-label="' + escapeHtml(track.title) + '">';
        html += '<div class="pixel-story-map-world-tabs" role="tablist" aria-label="像素世界地图">';
        tracks.forEach(function (item) {
            var active = item.id === track.id;
            html += '<button type="button" class="pixel-story-world-tab' + (active ? ' is-active' : '') + '" data-world="' + escapeHtml(item.id) + '" role="tab" aria-selected="' + (active ? 'true' : 'false') + '">';
            html += '<strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.subtitle || '') + '</small></button>';
        });
        html += '</div>';
        if (background) html += '<img class="pixel-story-map-bg" src="' + background + '" alt="">';
        html += '<div class="pixel-story-map-chrome">';
        html += '<div><span class="pixel-story-map-kicker">PIXEL WORLDS / ' + escapeHtml(track.id.toUpperCase()) + '</span><strong>' + escapeHtml(track.title) + '</strong><small>' + escapeHtml(track.subtitle || '') + '</small></div>';
        html += '<div class="pixel-story-map-stat"><strong>' + nodes.filter(function (node) { return completed.indexOf(node.levelId) !== -1; }).length + '<em>/' + nodes.length + '</em></strong><span>已点亮节点</span></div>';
        html += '</div>';
        html += '<svg class="pixel-story-route pixel-story-route-world" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="' + routePath + '" fill="none"></path></svg>';

        nodes.forEach(function (node) {
            var isCompleted = completed.indexOf(node.levelId) !== -1;
            var classNames = 'pixel-story-node pixel-story-node-' + escapeHtml(track.tone || 'default') + (isCompleted ? ' completed' : '');
            if (!isCompleted && node.order === 1) classNames += ' next';
            html += '<button type="button" class="' + classNames + '" style="left:' + node.position.x + '%;top:' + node.position.y + '%" data-chapter="' + escapeHtml(node.levelId) + '" aria-label="进入' + escapeHtml(node.label || node.levelId) + '">';
            html += '<div class="pixel-story-node-glow"></div>';
            if (node.icon) html += '<img class="pixel-story-node-icon" src="' + assetUrl(node.icon) + '" alt="">';
            else html += '<span class="pixel-story-node-icon pixel-story-node-symbol" aria-hidden="true">✦</span>';
            html += '<span class="pixel-story-node-index">' + String(node.order || 0).padStart(2, '0') + '</span>';
            html += '<span class="pixel-story-node-label"><strong>' + escapeHtml(node.label || node.levelId) + '</strong><small>' + escapeHtml(node.subtitle || '') + '</small></span>';
            html += '<span class="pixel-story-node-state">' + (isCompleted ? '已完成' : node.order === 1 ? '现在出发' : '待探索') + '</span></button>';
        });
        html += '<div class="pixel-story-map-legend"><span><i></i>剧情航线</span><small>每个节点都有一段故事和一次小互动</small></div></section>';
        container.innerHTML = html;

        container.querySelectorAll('[data-world]').forEach(function (tab) {
            tab.addEventListener('click', function () { renderTrack(container, manifest, tab.dataset.world); });
        });
        container.querySelectorAll('.pixel-story-node').forEach(function (node) {
            node.addEventListener('click', function () {
                if (root.PixelStoryEngine && typeof root.PixelStoryEngine.enterChapter === 'function') {
                    root.PixelStoryEngine.enterChapter(node.dataset.chapter);
                }
            });
        });
    }

    root.PixelStoryMap = root.PixelStoryMap || { render: render };
})(window);
