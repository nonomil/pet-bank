/**
 * CardCollection Module
 * Handles pet card collection system, including display, collection progress, and rewards.
 */
const CardCollection = (function() {
    let _cards = []; // Collected pet IDs
    const STORAGE_KEY = 'petbank_cards';
    const REWARD_POINTS_PER_SERIES = 100;

    // Internal state for the UI
    let _allSpecies = [];
    let _seriesStats = {};
    let _view = 'category';            // 'category'(大类卡片) | 'grid'(瀑布流)
    let _selectedSource = null;
    let _lastContainerId = 'card-collection-container';
    const SOURCE_NAMES = { original: '原生宠物', banchong: '仓鼠大冒险', classpet: '课堂宠物', minecraft: '我的世界' };
    const SOURCE_EMOJI = { original: '🐾', banchong: '🐹', classpet: '🎓', minecraft: '⛏️' };

    function setView(view, source) {
        _view = view;
        _selectedSource = source || null;
        renderUI(_lastContainerId);
    }

    /**
     * Initialize the collection system
     */
    function init() {
        const saved = localStorage.getItem(STORAGE_KEY);
        _cards = saved ? JSON.parse(saved) : [];
        
        // Load species data from PetSystem
        if (typeof PetSystem !== 'undefined') {
            _allSpecies = PetSystem.getAllSpecies();
        }
        
        _calculateSeriesStats();
    }

    /**
     * Add a card to the collection
     * @param {string} petId - The ID of the pet to add
     */
    function addCard(petId) {
        if (!_cards.includes(petId)) {
            _cards.push(petId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_cards));
            _calculateSeriesStats();
            
            // Check for series completion rewards
            checkSeriesRewards(petId);
            return true;
        }
        return false;
    }

    /**
     * Internal: Calculate statistics by series
     */
    function _calculateSeriesStats() {
        _seriesStats = {};
        _allSpecies.forEach(s => {
            const series = s.series || '经典';
            if (!_seriesStats[series]) {
                _seriesStats[series] = { total: 0, collected: 0 };
            }
            _seriesStats[series].total++;
            if (_cards.includes(s.id)) {
                _seriesStats[series].collected++;
            }
        });
    }

    /**
     * Internal: Check if a series was just completed
     */
    function checkSeriesRewards(newPetId) {
        const pet = _allSpecies.find(s => s.id === newPetId);
        if (!pet) return;

        const series = pet.series || '经典';
        const stats = _seriesStats[series];
        
        // If newly collected pet completes the series
        if (stats && stats.collected === stats.total) {
            // Check if reward was already given (simplified: just give it)
            // In a real app, we'd track awarded_series in localStorage
            const awarded = JSON.parse(localStorage.getItem('petbank_awarded_series') || '[]');
            if (!awarded.includes(series)) {
                awarded.push(series);
                localStorage.setItem('petbank_awarded_series', JSON.stringify(awarded));
                
                // Grant points via app global
                if (typeof window.addGrowthPoints === 'function') {
                    window.addGrowthPoints(REWARD_POINTS_PER_SERIES);
                } else if (typeof saveAppState === 'function') {
                    window.totalPoints = (window.totalPoints || 0) + REWARD_POINTS_PER_SERIES;
                    saveAppState();
                }
                console.log(`🎉 Series completed: ${series}! Received ${REWARD_POINTS_PER_SERIES} points!`);
            }
        }
    }

    /**
     * Render the Card Collection UI
     * @param {string} containerId - The ID of the HTML element to render into
     */
    function renderUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        _lastContainerId = containerId;
        if (typeof PetSystem !== 'undefined') _allSpecies = PetSystem.getAllSpecies();
        _calculateSeriesStats();
        container.innerHTML = (_view === 'grid' && _selectedSource) ? _renderGrid() : _renderCategory();
    }

    // 大类视图：总收集 + 4 大类卡片(点击进入瀑布流)
    function _renderCategory() {
        const totalCollected = _cards.length;
        const totalPossible = _allSpecies.length;
        const rarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
        _cards.forEach(id => { const p = _allSpecies.find(s => s.id === id); if (p && rarityCounts[p.rarity] !== undefined) rarityCounts[p.rarity]++; });
        const statsHtml = `
            <div class="card-stats-container">
                <div class="card-stat-item"><div class="card-stat-label">总收集</div><div class="card-stat-value">${totalCollected} / ${totalPossible}</div></div>
                <div class="card-stat-item"><div class="card-stat-label">稀有度</div><div class="card-stat-value text-xs">
                    <span class="text-gray-400">⚪${rarityCounts.common}</span>
                    <span class="text-blue-400">🔵${rarityCounts.rare}</span>
                    <span class="text-purple-400">🟣${rarityCounts.epic}</span>
                    <span class="text-yellow-400">🟡${rarityCounts.legendary}</span>
                </div></div>
            </div>`;

        const sources = ['original', 'banchong', 'classpet', 'minecraft'];
        let catHtml = `<div class="card-section-title">宠物大类 · 点击进入图鉴</div><div class="card-category-grid">`;
        sources.forEach(src => {
            const pets = _allSpecies.filter(s => (s.source || 'original') === src);
            if (!pets.length) return;
            const collected = pets.filter(s => _cards.includes(s.id)).length;
            const percent = Math.round(collected / pets.length * 100);
            catHtml += `
                <div class="card-category-item" onclick="CardCollection.setView('grid','${src}')">
                    <div class="card-category-emoji">${SOURCE_EMOJI[src] || '🐾'}</div>
                    <div class="card-category-name">${SOURCE_NAMES[src] || src}</div>
                    <div class="card-category-count">${collected} / ${pets.length}</div>
                    <div class="card-progress-bar"><div class="card-progress-fill" style="width:${percent}%"></div></div>
                </div>`;
        });
        catHtml += `</div>`;
        return statsHtml + catHtml;
    }

    // 瀑布流视图：返回 + 该大类所有卡片
    function _renderGrid() {
        const pets = _allSpecies.filter(s => (s.source || 'original') === _selectedSource);
        const backHtml = `<div class="card-back-btn" onclick="CardCollection.setView('category')">← 返回大类</div>`;
        const titleHtml = `<div class="card-section-title">${SOURCE_EMOJI[_selectedSource] || ''} ${SOURCE_NAMES[_selectedSource] || _selectedSource}（${pets.length} 种）</div>`;
        let gridHtml = `<div class="card-grid">`;
        pets.forEach(s => {
            const isCollected = _cards.includes(s.id);
            const rarityClass = `card-rarity-${s.rarity || 'common'}`;
            gridHtml += `
                <div class="card-item ${isCollected ? 'collected' : 'uncollected'} ${rarityClass}"
                     onclick="CardCollection.showDetail('${s.id}')">
                    <div class="card-emoji">${isCollected ? s.emoji : '❓'}</div>
                    <div class="card-name">${isCollected ? s.name : '???'}</div>
                </div>`;
        });
        gridHtml += `</div>`;
        return backHtml + titleHtml + gridHtml;
    }

    /**
     * Show card detail modal
     * @param {string} petId 
     */
    function showDetail(petId) {
        const pet = _allSpecies.find(s => s.id === petId);
        if (!pet) return;

        const isCollected = _cards.includes(petId);
        const modal = document.getElementById('cardDetailModal');
        if (!modal) return;

        modal.innerHTML = `
            <div class="card-modal-overlay" onclick="CardCollection.closeDetail()"></div>
            <div class="card-modal-content">
                <div class="card-detail-header">
                    <div class="card-detail-emoji">${isCollected ? pet.emoji : '❓'}</div>
                    <div class="card-detail-title">
                        <div class="text-xl font-bold">${isCollected ? pet.name : '???'}</div>
                        <div class="text-xs opacity-70">${isCollected ? (pet.series || '经典') + ' · ' + pet.rarity : '未收集 · 探索解锁'}</div>
                    </div>
                    <button class="close-btn" onclick="CardCollection.closeDetail()">&times;</button>
                </div>
                <div class="card-detail-body">
                    ${isCollected ? `
                    <div class="card-detail-stat-grid">
                        <div class="stat-box"><span>❤️ HP</span><strong>${pet.base_hp || pet.hp}</strong></div>
                        <div class="stat-box"><span>⚔️ ATK</span><strong>${pet.base_atk || pet.atk}</strong></div>
                    </div>
                    <div class="card-detail-desc">${pet.desc || '暂无描述'}</div>
                    ` : `<div class="card-detail-desc" style="text-align:center;opacity:.75;padding:20px 8px;">🔍 还没收集到这只宠物<br><span style="font-size:13px;">去探索冒险，击败怪物有机会获得！</span></div>`}
                </div>
                <div class="card-detail-footer">
                    ${isCollected ? '<span class="text-green-400">已收藏</span>' : '<span class="text-gray-500">未收集</span>'}
                </div>
            </div>
        `;
        modal.classList.add('show');
    }

    function closeDetail() {
        const modal = document.getElementById('cardDetailModal');
        if (modal) modal.classList.remove('show');
    }

    // Public API
    return {
        init,
        renderUI,
        addCard,
        showDetail,
        closeDetail,
        setView
    };
})();

// Make it globally available for onclick handlers
window.CardCollection = CardCollection;
