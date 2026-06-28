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
                if (typeof totalPoints !== 'undefined') {
                    totalPoints += REWARD_POINTS_PER_SERIES;
                    // Trigger app update if possible
                    if (typeof saveAppState === 'function') saveAppState();
                    // We'll call renderAll via an event or direct call if needed
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

        // Always refresh species data from PetSystem (async loading)
        if (typeof PetSystem !== 'undefined') {
            _allSpecies = PetSystem.getAllSpecies();
        }

        _calculateSeriesStats();

        // 1. Stats Header
        const totalCollected = _cards.length;
        const totalPossible = _allSpecies.length;
        const rarityCounts = { common: 0, rare: 0, epic: 0, legendary: 0 };
        _cards.forEach(id => {
            const p = _allSpecies.find(s => s.id === id);
            if (p && rarityCounts[p.rarity] !== undefined) rarityCounts[p.rarity]++;
        });

        let statsHtml = `
            <div class="card-stats-container">
                <div class="card-stat-item">
                    <div class="card-stat-label">总收集</div>
                    <div class="card-stat-value">${totalCollected} / ${totalPossible}</div>
                </div>
                <div class="card-stat-item">
                    <div class="card-stat-label">稀有度</div>
                    <div class="card-stat-value text-xs">
                        <span class="text-gray-400">⚪${rarityCounts.common}</span> 
                        <span class="text-blue-400">🔵${rarityCounts.rare}</span> 
                        <span class="text-purple-400">🟣${rarityCounts.epic}</span> 
                        <span class="text-yellow-400">🟡${rarityCounts.legendary}</span>
                    </div>
                </div>
            </div>
        `;

        // 2. Series Progress
        let seriesHtml = `<div class="card-section-title">系列进度</div><div class="card-series-grid">`;
        Object.entries(_seriesStats).forEach(([name, stats]) => {
            const percent = Math.round((stats.collected / stats.total) * 100);
            const isComplete = stats.collected === stats.total;
            seriesHtml += `
                <div class="card-series-item ${isComplete ? 'complete' : ''}">
                    <div class="card-series-info">
                        <span class="card-series-name">${name}</span>
                        <span class="card-series-count">${stats.collected}/${stats.total}</span>
                    </div>
                    <div class="card-progress-bar">
                        <div class="card-progress-fill" style="width: ${percent}%"></div>
                    </div>
                </div>
            `;
        });
        seriesHtml += `</div>`;

        // 3. Collection Grid
        let gridHtml = `<div class="card-section-title">宠物图鉴</div><div class="card-grid">`;
        _allSpecies.forEach(s => {
            const isCollected = _cards.includes(s.id);
            const rarityClass = `card-rarity-${s.rarity || 'common'}`;
            gridHtml += `
                <div class="card-item ${isCollected ? 'collected' : 'uncollected'} ${rarityClass}" 
                     onclick="CardCollection.showDetail('${s.id}')">
                    <div class="card-emoji">${isCollected ? s.emoji : '❓'}</div>
                    <div class="card-name">${isCollected ? s.name : '???'}</div>
                    <div class="card-rarity-tag">${isCollected ? s.rarity : ''}</div>
                </div>
            `;
        });
        gridHtml += `</div>`;

        container.innerHTML = statsHtml + seriesHtml + gridHtml;
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
                    <div class="card-detail-emoji">${pet.emoji}</div>
                    <div class="card-detail-title">
                        <div class="text-xl font-bold">${pet.name}</div>
                        <div class="text-xs opacity-70">${pet.series || '经典'} · ${pet.rarity}</div>
                    </div>
                    <button class="close-btn" onclick="CardCollection.closeDetail()">&times;</button>
                </div>
                <div class="card-detail-body">
                    <div class="card-detail-stat-grid">
                        <div class="stat-box"><span>❤️ HP</span><strong>${pet.base_hp || pet.hp}</strong></div>
                        <div class="stat-box"><span>⚔️ ATK</span><strong>${pet.base_atk || pet.atk}</strong></div>
                    </div>
                    <div class="card-detail-desc">
                        ${pet.desc || '暂无描述'}
                    </div>
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
        closeDetail
    };
})();

// Make it globally available for onclick handlers
window.CardCollection = CardCollection;
