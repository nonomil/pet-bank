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

  const RANDOM_ITEMS = ['⭐ 幸运星', '🛡️ 勇气勋章', '🍭 糖果棒', '🔍 放大镜', '🚀 火箭模型'];
  const RARE_ITEMS = ['👑 黄金皇冠', '💎 璀璨钻石', '🦄 独角兽玩偶', '🐉 传说巨龙'];

  // --- Private Helpers ---

  const getHistory = (key) => JSON.parse(localStorage.getItem(key) || '[]');

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
    if (typeof totalPoints === 'undefined') {
      alert('Error: totalPoints is not defined.');
      return;
    }
    if (totalPoints < item.price) {
      alert('成长分不足，快去完成任务赚积分吧！');
      return;
    }

    totalPoints -= item.price;
    saveHistory('petbank_shop_history', { name: item.name, price: item.price, type: 'purchase' });
    
    if (typeof saveAppState === 'function') {
      saveAppState();
    }
    alert(`兑换成功！${item.name}`);
  };

  const openBlindBox = (box, containerId) => {
    if (typeof totalPoints === 'undefined') {
      alert('Error: totalPoints is not defined.');
      return;
    }
    if (totalPoints < box.price) {
      alert('成长分不足，快去完成任务赚积分吧！');
      return;
    }

    totalPoints -= box.price;
    if (typeof saveAppState === 'function') {
      saveAppState();
    }

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
          result = { type: 'item', emoji: '📦', name: item, value: item };
        }
      } else {
        // Luxury Box
        if (rand < 0.3) {
          const refund = Math.floor(Math.random() * 21) + 20; // 20-40
          result = { type: 'points', emoji: '💰', name: `${refund} 成长分返利`, value: refund };
        } else if (rand < 0.7) {
          const item = RARE_ITEMS[Math.floor(Math.random() * RARE_ITEMS.length)];
          result = { type: 'item', emoji: '✨', name: item, value: item };
        } else {
          result = { type: 'exp', emoji: '⭐', name: '宠物经验+50', value: 50 };
        }
      }

      // Apply Result to State
      if (result.type === 'points') {
        totalPoints += result.value;
        if (typeof saveAppState === 'function') saveAppState();
      } else if (result.type === 'exp') {
        if (window.PetSystem && typeof window.PetSystem.addExp === 'function') {
          window.PetSystem.addExp(50);
        } else if (window.PetSystem && typeof window.PetSystem.addExp === 'function') {
           // Fallback/Safety check if PetSystem exists but method differs
        }
        // Fallback manual update if PetSystem method is unknown, though we assume it exists
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
          <div style="font-size: 1.1rem; color: #e67e22;">当前积分: <span id="shop-total-points">${totalPoints}</span></div>
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
    if (ptsSpan) ptsSpan.textContent = totalPoints;
  };

  // --- Public API ---
  return {
    renderUI,
    buy: (itemId) => {
      const item = ITEMS.find(i => i.id === itemId);
      if (item) buyItem(item);
    },
    openBox: (boxId, containerId) => {
      const box = BLIND_BOXES.find(b => b.id === boxId);
      if (box) openBlindBox(box, containerId);
    }
  };
})();

window.ShopSystem = ShopSystem;
