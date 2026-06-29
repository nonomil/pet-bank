/**
 * ShopSystem Module - Pet Bank
 * Handles the Exchange Shop and Blind Box systems.
 */
const ShopSystem = (function () {
  // --- Private Data ---
  const ITEMS = [
    { id: 'item_dinner', emoji: '🍕', name: '选晚餐', price: 30, desc: '今晚可以选想吃的晚餐' },
    { id: 'item_anime', emoji: '📺', name: '多看15分钟动画', price: 20, desc: '额外15分钟屏幕时间' },
    { id: 'item_dessert', emoji: '🍰', name: '周末甜点', price: 40, desc: '周末可以吃一份甜点' },
    { id: 'item_game', emoji: '🎮', name: '游戏30分钟', price: 50, desc: '30分钟自由游戏时间' },
    { id: 'item_chore', emoji: '🧹', name: '免做家务', price: 25, desc: '今天不用做家务' },
    { id: 'item_book', emoji: '📚', name: '选一本新书', price: 35, desc: '去书店选一本书' },
    { id: 'item_craft', emoji: '🎨', name: '手工材料', price: 45, desc: '买一套手工材料' },
    { id: 'item_outdoor', emoji: '🌳', name: '户外探险', price: 60, desc: '全家户外探险活动' }
  ];

  const BLIND_BOXES = [
    {
      id: 'box_normal',
      emoji: '🎁',
      name: '普通盲盒',
      price: 20,
      desc: '50%获得5-15分返利，50%获得随机道具'
    },
    {
      id: 'box_luxury',
      emoji: '🎊',
      name: '豪华盲盒',
      price: 50,
      desc: '30%获得20-40分返利，40%获得稀有道具，30%获得经验加成'
    }
  ];

  const RANDOM_ITEMS = [
    { id: 'toy_ball', emoji: '⚽', name: '玩具球' },
    { id: 'bone', emoji: '🦴', name: '香香骨头' },
    { id: 'candy', emoji: '🍬', name: '彩虹糖' },
    { id: 'feather', emoji: '🪶', name: '发光羽毛' },
    { id: 'chest_fragment', emoji: '🧩', name: '宝箱碎片' }
  ];
  const RARE_ITEMS = [
    { id: 'forest_gem', emoji: '💚', name: '森林之泪' },
    { id: 'ocean_gem', emoji: '💙', name: '海洋之心' },
    { id: 'star_gem', emoji: '⭐', name: '星辰碎片' },
    { id: 'phoenix_feather', emoji: '🪶', name: '凤凰羽毛' }
  ];

  // --- Private Helpers ---

  const getHistory = (key) => JSON.parse(localStorage.getItem(key) || '[]');

  const getCurrentPoints = () => {
    if (typeof window.totalPoints === 'number') return window.totalPoints;
    if (typeof totalPoints === 'number') return totalPoints;
    return 0;
  };

  const adjustGrowthPoints = (delta) => {
    if (typeof window.addGrowthPoints === 'function') {
      return window.addGrowthPoints(delta);
    }

    if (window.totalPoints !== undefined) {
      window.totalPoints = Math.max(0, Number(window.totalPoints || 0) + delta);
      if (typeof window.saveAppState === 'function') window.saveAppState();
      if (typeof window.updateStats === 'function') window.updateStats();
      return window.totalPoints;
    }

    return null;
  };

  const saveHistory = (key, entry) => {
    const history = getHistory(key);
    history.unshift({ ...entry, timestamp: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(history.slice(0, 50))); // Keep last 50
  };

  const injectStyles = () => {
    if (document.getElementById('shop-system-styles')) return;
    const style = document.createElement('style');
    style.id = 'shop-system-styles';
    style.textContent = `
      @keyframes box-shake {
        0% { transform: rotate(0deg); }
        25% { transform: rotate(10deg); }
        50% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
        100% { transform: rotate(0deg); }
      }
      @keyframes box-open {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.2); opacity: 0.5; }
        100% { transform: scale(0); opacity: 0; }
      }
      @keyframes reward-reveal {
        0% { transform: scale(0); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
      }
      .shop-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; color: #333; }
      .shop-header { background: #f8f9fa; padding: 15px; border-radius: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
      .shop-section-title { font-size: 1.5rem; margin: 25px 0 15px; border-left: 5px solid #4CAF50; padding-left: 10px; }
      .shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 15px; }
      .shop-card { background: white; border: 1px solid #eee; border-radius: 12px; padding: 15px; text-align: center; transition: transform 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
      .shop-card:hover { transform: translateY(-5px); }
      .shop-emoji { font-size: 2.5rem; margin-bottom: 10px; display: block; }
      .shop-name { font-weight: bold; display: block; margin-bottom: 5px; }
      .shop-price { color: #e67e22; font-weight: bold; display: block; margin-bottom: 5px; }
      .shop-desc { font-size: 0.85rem; color: #666; margin-bottom: 10px; min-height: 34px; }
      .shop-btn { background: #4CAF50; color: white; border: none; padding: 8px 15px; border-radius: 20px; cursor: pointer; font-weight: bold; width: 100%; }
      .shop-btn:hover { background: #45a049; }
      .shop-btn:disabled { background: #ccc; cursor: not-allowed; }
      .blindbox-area { display: flex; gap: 20px; justify-content: center; margin-bottom: 30px; }
      .blindbox-card { background: linear-gradient(135deg, #6e8efb, #a777e3); color: white; border-radius: 15px; padding: 20px; width: 200px; text-align: center; cursor: pointer; position: relative; overflow: hidden; }
      .blindbox-card:hover { transform: scale(1.05); }
      .history-list { background: #fff; border-radius: 12px; padding: 15px; box-shadow: inset 0 0 10px rgba(0,0,0,0.05); }
      .history-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 0.9rem; }
      .history-item:last-child { border-bottom: none; }
      
      /* Animation Styles */
      .anim-shake { animation: box-shake 0.5s ease-in-out 3; }
      .anim-open { animation: box-open 0.6s forwards; }
      .anim-reveal { animation: reward-reveal 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      
      .overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: none; align-items: center; justify-content: center; z-index: 1000; }
      .reward-popup { background: white; padding: 30px; border-radius: 20px; text-align: center; max-width: 300px; }
      .reward-emoji { font-size: 4rem; margin-bottom: 15px; display: block; }
      .reward-msg { font-size: 1.2rem; font-weight: bold; margin-bottom: 20px; }
    `;
    document.head.appendChild(style);
  };

  // --- Private Logic ---

  const buyItem = (item) => {
    const currentPoints = getCurrentPoints();
    if (currentPoints === null) {
      alert('Error: totalPoints is not defined.');
      return;
    }
    if (currentPoints < item.price) {
      alert('成长分不足，快去完成任务赚积分吧！');
      return;
    }

    adjustGrowthPoints(-item.price);
    saveHistory('petbank_shop_history', { name: item.name, price: item.price, type: 'purchase' });
    alert(`兑换成功！${item.name}`);
  };

  // --- 家具购买（联动 HomeSystem，纯装饰，永久拥有，不进背包） ---
  // 守卫顺序：家具存在 → 未拥有 → 积分足够 → 扣分 → 写 ownership → 历史 → 重渲染
  const SLOT_LABELS = { floor: '地面', corner: '角落', backdrop: '背景' };

  const getFurnitureCatalog = () => {
    if (window.HomeSystem && typeof window.HomeSystem.getFurnitureCatalog === 'function') {
      return window.HomeSystem.getFurnitureCatalog();
    }
    return [];
  };

  const getOwnedFurniture = () => {
    if (window.HomeSystem && typeof window.HomeSystem.getFurniture === 'function') {
      return window.HomeSystem.getFurniture();
    }
    return [];
  };

  const buyFurniture = (itemId) => {
    const catalog = getFurnitureCatalog();
    const item = catalog.find(x => x.id === itemId);
    if (!item) return false;
    // 不可重复购买：已拥有直接拦截
    if (getOwnedFurniture().indexOf(itemId) >= 0) return false;

    const currentPoints = getCurrentPoints();
    if (currentPoints === null) {
      alert('Error: totalPoints is not defined.');
      return false;
    }
    if (currentPoints < item.price) {
      alert('成长分不足，快去完成任务赚积分吧！');
      return false;
    }

    adjustGrowthPoints(-item.price);
    // 只调 HomeSystem.addFurniture，不直接写 localStorage、不进 InventorySystem
    if (window.HomeSystem && typeof window.HomeSystem.addFurniture === 'function') {
      window.HomeSystem.addFurniture(itemId);
    }
    saveHistory('petbank_shop_history', { name: item.name, price: item.price, type: 'furniture' });
    renderUI('shop-ui');
    return true;
  };

  const openBlindBox = (box, containerId) => {
    const currentPoints = getCurrentPoints();
    if (currentPoints === null) {
      alert('Error: totalPoints is not defined.');
      return;
    }
    if (currentPoints < box.price) {
      alert('成长分不足，快去完成任务赚积分吧！');
      return;
    }

    adjustGrowthPoints(-box.price);

    // Prepare Animation Overlay
    const overlay = document.createElement('div');
    overlay.className = 'overlay';
    overlay.style.display = 'flex';
    
    const popup = document.createElement('div');
    popup.className = 'reward-popup';
    
    const boxVisual = document.createElement('div');
    boxVisual.className = 'shop-emoji anim-shake';
    boxVisual.textContent = box.emoji;
    boxVisual.style.fontSize = '5rem';
    
    popup.appendChild(boxVisual);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    // Sequence: Shake -> Open -> Reveal
    setTimeout(() => {
      boxVisual.classList.remove('anim-shake');
      boxVisual.classList.add('anim-open');
    }, 1500);

    setTimeout(() => {
      // Determine Result
      let result = { type: 'item', emoji: '🎁', name: '随机道具', value: 'random' };
      const rand = Math.random();

      if (box.id === 'box_normal') {
        if (rand < 0.5) {
          const refund = Math.floor(Math.random() * 11) + 5; // 5-15
          result = { type: 'points', emoji: '💰', name: `${refund} 成长分返利`, value: refund };
        } else {
          const item = RANDOM_ITEMS[Math.floor(Math.random() * RANDOM_ITEMS.length)];
          result = { type: 'item', emoji: item.emoji, name: item.name, value: item.id };
        }
      } else {
        // Luxury Box
        if (rand < 0.3) {
          const refund = Math.floor(Math.random() * 21) + 20; // 20-40
          result = { type: 'points', emoji: '💰', name: `${refund} 成长分返利`, value: refund };
        } else if (rand < 0.7) {
          const item = RARE_ITEMS[Math.floor(Math.random() * RARE_ITEMS.length)];
          result = { type: 'item', emoji: item.emoji, name: item.name, value: item.id };
        } else {
          result = { type: 'exp', emoji: '⭐', name: '宠物经验+50', value: 50 };
        }
      }

      // Apply Result to State
      if (result.type === 'points') {
        adjustGrowthPoints(result.value);
      } else if (result.type === 'exp') {
        if (window.PetSystem && typeof window.PetSystem.addExp === 'function') {
          window.PetSystem.addExp(50);
        }
      } else if (result.type === 'item') {
        if (window.InventorySystem && typeof window.InventorySystem.addItem === 'function') {
          window.InventorySystem.addItem(result.value);
        }
      }

      saveHistory('petbank_blindbox_history', { name: result.name, type: 'blindbox_result' });

      // Show Reward
      popup.innerHTML = `
        <span class="reward-emoji anim-reveal">${result.emoji}</span>
        <div class="reward-msg anim-reveal">${result.name}</div>
        <button class="shop-btn anim-reveal" onclick="this.parentElement.parentElement.remove()">太棒了!</button>
      `;
      
      // Re-render UI to update points
      if (typeof ShopSystem.renderUI === 'function') {
        ShopSystem.renderUI(containerId);
      }

    }, 2200);

    // Close overlay on click outside popup
    overlay.onclick = (e) => {
      if (e.target === overlay) overlay.remove();
    };
  };

  const renderUI = (containerId) => {
    const container = document.getElementById(containerId);
    if (!container) return;

    injectStyles();

    const history = getHistory('petbank_shop_history').concat(getHistory('petbank_blindbox_history'));
    const sortedHistory = history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 5);

    container.innerHTML = `
      <div class="shop-container">
        <div class="shop-header">
          <div style="font-size: 1.2rem; font-weight: bold;">🛍️ 兑换商店</div>
          <div style="font-size: 1.1rem; color: #e67e22;">当前积分: <span id="shop-total-points">${getCurrentPoints()}</span></div>
        </div>

        <div class="shop-section-title">🎁 盲盒惊喜</div>
        <div class="blindbox-area">
          ${BLIND_BOXES.map(box => `
            <div class="blindbox-card" onclick="ShopSystem.openBox('${box.id}', '${containerId}')">
              <div style="font-size: 2.5rem;">${box.emoji}</div>
              <div style="font-weight: bold; margin: 5px 0;">${box.name}</div>
              <div style="font-size: 0.8rem; opacity: 0.9;">${box.desc}</div>
              <div style="margin-top: 10px; font-weight: bold; background: rgba(255,255,255,0.2); border-radius: 10px; padding: 3px;">${box.price} 分</div>
            </div>
          `).join('')}
        </div>

        <div class="shop-section-title">🍕 奖励兑换</div>
        <div class="shop-grid">
          ${ITEMS.map(item => `
            <div class="shop-card">
              <span class="shop-emoji">${item.emoji}</span>
              <span class="shop-name">${item.name}</span>
              <span class="shop-price">${item.price} 分</span>
              <div class="shop-desc">${item.desc}</div>
              <button class="shop-btn" onclick="ShopSystem.buy('${item.id}')">兑换</button>
            </div>
          `).join('')}
        </div>

        <div class="shop-section-title">🛋️ 家园装饰</div>
        <div class="shop-grid">
          ${(() => {
            const catalog = getFurnitureCatalog();
            const owned = getOwnedFurniture();
            if (catalog.length === 0) {
              return '<div style="color:#999;grid-column:1/-1;text-align:center;padding:10px;">家具目录加载中…</div>';
            }
            // 只展示可购买的（排除 defaultOwned 默认两件，避免在商店卖 0 分默认家具）
            return catalog.filter(it => !it.defaultOwned).map(it => {
              const isOwned = owned.indexOf(it.id) >= 0;
              const slotLabel = SLOT_LABELS[it.slotType] || it.slotType;
              return `
                <div class="shop-card">
                  <span class="shop-emoji">${it.icon}</span>
                  <span class="shop-name">${it.name}</span>
                  <span class="shop-price">${it.price} 分</span>
                  <div class="shop-desc">${it.description || ''}</div>
                  <div style="font-size:.7rem;color:#888;background:#f4f1ff;padding:2px 8px;border-radius:999px;display:inline-block;margin-bottom:8px;">📍 ${slotLabel}</div>
                  ${isOwned
                    ? '<button class="shop-btn" disabled>已拥有</button>'
                    : `<button class="shop-btn" onclick="ShopSystem.buyFurniture('${it.id}')">购买</button>`}
                </div>
              `;
            }).join('');
          })()}
        </div>

        <div class="shop-section-title">📜 最近动态</div>
        <div class="history-list">
          ${sortedHistory.length === 0 ? '<div style="color:#999; text-align:center; padding:10px;">暂无记录</div>' : 
            sortedHistory.map(h => `
              <div class="history-item">
                <span>${h.name}</span>
                <span style="color: #888;">${new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
            `).join('')}
        </div>
      </div>
    `;
    
    // Ensure totalPoints is updated in UI
    const ptsSpan = container.querySelector('#shop-total-points');
    if (ptsSpan) ptsSpan.textContent = getCurrentPoints();
  };

  // --- Public API ---
  return {
    renderUI,
    buy: (itemId) => {
      const item = ITEMS.find(i => i.id === itemId);
      if (item) buyItem(item);
    },
    buyFurniture,
    openBox: (boxId, containerId) => {
      const box = BLIND_BOXES.find(b => b.id === boxId);
      if (box) openBlindBox(box, containerId);
    }
  };
})();

window.ShopSystem = ShopSystem;
