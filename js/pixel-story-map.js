/* PixelStoryMap — 像素星际地图导航组件 */
(function (root) {
    'use strict';

    var CHAPTERS_BASE = 'data/story-packs/04-pixel-dialogue-story';

    function assetUrl(path) {
        return typeof root.resolvePetBankAssetUrl === 'function' ? root.resolvePetBankAssetUrl(path) : path;
    }

    function fetchJson(path) {
        return root.fetch(assetUrl(path)).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ': ' + path);
            return r.json();
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

    /* ===== 生成星星粒子 ===== */
    function generateStars() {
        var html = '';
        for (var i = 0; i < 40; i++) {
            var x = Math.random() * 100;
            var y = Math.random() * 100;
            var delay = Math.random() * 3;
            var size = 1 + Math.floor(Math.random() * 3);
            html += '<span class="pixel-star-particle" style="left:' + x + '%;top:' + y + '%;width:' + size + 'px;height:' + size + 'px;animation-delay:' + delay + 's"></span>';
        }
        return html;
    }

    /* ===== 渲染地图 ===== */
    function render(containerId) {
        var container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!container) return;

        fetchJson(CHAPTERS_BASE + '/manifest.json').then(function (manifest) {
            if (!manifest || !manifest.map || !manifest.map.nodes) {
                container.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.4)">地图数据暂不可用</div>';
                return;
            }

            var completed = getCompletedChapters();
            var nodes = manifest.map.nodes;
            nodes = nodes.slice().sort(function (a, b) { return (a.order || 99) - (b.order || 99); });

            // 生成路线路径
            var routePoints = nodes.map(function (n) { return { x: n.position.x, y: n.position.y }; });
            var routePath = '';
            if (routePoints.length > 1) {
                var parts = [];
                for (var i = 0; i < routePoints.length; i++) {
                    parts.push((i === 0 ? 'M' : 'L') + routePoints[i].x + ',' + routePoints[i].y);
                }
                routePath = parts.join(' ');
            }

            var bgUrl = manifest.map.background ? assetUrl(manifest.map.background) : '';

            var html = '<section class="pixel-story-map" aria-label="像素星际漫游地图">';
            if (bgUrl) {
                html += '<img class="pixel-story-map-bg" src="' + bgUrl + '" alt="">';
            }
            html += generateStars();

            html += '<div class="pixel-story-map-chrome">';
            html += '  <div><span class="pixel-story-map-kicker">STORY MAP / 01</span><strong>星际漫游航线</strong><small>读故事，解谜题，陪宠物一起成长</small></div>';
            html += '  <div class="pixel-story-map-stat"><strong>' + completed.length + '<em>/' + nodes.length + '</em></strong><span>已点亮章节</span></div>';
            html += '</div>';

            // 路线 SVG
            html += '<svg class="pixel-story-route" viewBox="0 0 100 100" preserveAspectRatio="none">';
            if (routePath) {
                html += '<path d="' + routePath + '" fill="none"/>';
            }
            html += '</svg>';

            nodes.forEach(function (node) {
                var isCompleted = completed.indexOf(node.chapterId) !== -1;
                var classNames = 'pixel-story-node pixel-story-node-' + escapeHtml(node.tone || 'default');
                if (isCompleted) classNames += ' completed';
                if (!isCompleted && completed.length === 0 && node.order === 1) classNames += ' next';

                html += '<button type="button" class="' + classNames + '" style="left:' + node.position.x + '%;top:' + node.position.y + '%" data-chapter="' + escapeHtml(node.chapterId) + '" aria-label="进入' + escapeHtml(node.label || node.chapterId) + '">';
                html += '  <div class="pixel-story-node-glow"></div>';
                if (node.icon) {
                    html += '  <img class="pixel-story-node-icon" src="' + assetUrl(node.icon) + '" alt="">';
                } else {
                    html += '  <span class="pixel-story-node-icon pixel-story-node-symbol" aria-hidden="true">' + escapeHtml(node.symbol || '✦') + '</span>';
                }
                html += '  <span class="pixel-story-node-index">' + String(node.order || 0).padStart(2, '0') + '</span>';
                html += '  <span class="pixel-story-node-label"><strong>' + escapeHtml(node.label || node.chapterId) + '</strong><small>' + escapeHtml(node.subtitle || '') + '</small></span>';
                html += '  <span class="pixel-story-node-state">' + (isCompleted ? '已完成' : node.order === 1 ? '现在出发' : '待探索') + '</span>';
                html += '</button>';
            });

            html += '<div class="pixel-story-map-legend"><span><i></i>星光航线</span><small>每一章都藏着一个小小学习任务</small></div>';
            html += '</section>';

            container.innerHTML = html;

            // 节点点击事件
            container.querySelectorAll('.pixel-story-node').forEach(function (el) {
                el.addEventListener('click', function () {
                    var chapterId = el.dataset.chapter;
                    if (!chapterId) return;
                    if (root.PixelStoryEngine && typeof root.PixelStoryEngine.enterChapter === 'function') {
                        root.PixelStoryEngine.enterChapter(chapterId);
                    }
                });
            });
        }).catch(function (err) {
            container.innerHTML = '<div style="padding:40px;text-align:center;color:rgba(255,255,255,0.4)">星际地图加载失败</div>';
            console.error('[PixelStoryMap] error:', err);
        });
    }

    /* ===== 对外 API ===== */
    var PixelStoryMap = {
        render: render
    };

    if (typeof root.PixelStoryMap === 'undefined') {
        root.PixelStoryMap = PixelStoryMap;
    }
})(window);
