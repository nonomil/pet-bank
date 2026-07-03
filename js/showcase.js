// 首页功能展示 — Lottie 动画背景 + HTML 文字同步
(function () {
  const SLIDES = [
    { icon: '🗺️', title: '场景探索冒险', desc: '12大奇幻场景，点亮路线解锁剧情与宝藏' },
    { icon: '🐾', title: '宠物养成', desc: '领养10族伙伴，喂食互动陪它一起成长' },
    { icon: '⚔️', title: '热血战斗', desc: '回合对战掉装备，越级挑战赢取稀有奖励' },
    { icon: '🔢', title: '数学PK', desc: '趣味数学挑战，烧脑对答赚取积分' },
    { icon: '🎁', title: '积分兑换', desc: '积分开盲盒，抽出稀有道具与宠物' },
    { icon: '📖', title: '宠物图鉴', desc: '收集147只宠物，点亮全族图鉴' },
  ];
  const FRAMES = 150;             // 动画总帧数
  const SEG = 25;                 // 每栏目帧数
  const INTERVAL = 4500;          // 自动切换间隔 ms

  const root = document.getElementById('showcase');
  const track = document.getElementById('showcaseTrack');
  const dotsBox = document.getElementById('showcaseDots');
  const prevBtn = document.getElementById('showcasePrev');
  const nextBtn = document.getElementById('showcaseNext');
  if (!root || !SLIDES.length) return;

  let current = 0;
  let timer = null;
  let anim = null;

  // 清空 track，放入 Lottie 容器
  track.innerHTML = '<div id="showcaseLottie" style="width:100%;height:100%;"></div>';

  // 创建文字覆盖层（单组，不随 slide 切换重建）
  const copyEl = document.createElement('div');
  copyEl.className = 'showcase-copy';
  copyEl.innerHTML = '<div class="showcase-icon"></div><div class="showcase-title"></div><div class="showcase-desc"></div>';
  root.appendChild(copyEl);

  // 创建 dots（之前全靠 click 事件，改为 data-index 委托）
  SLIDES.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'showcase-dot' + (i === 0 ? ' active' : '');
    dot.type = 'button';
    dot.dataset.index = i;
    dot.setAttribute('aria-label', `第${i + 1}屏`);
    dotsBox.appendChild(dot);
  });
  dotsBox.addEventListener('click', e => {
    const dot = e.target.closest('.showcase-dot');
    if (dot) go(+dot.dataset.index);
  });

  // 更新文字、dot 高亮、动画片段
  function go(i) {
    current = (i + SLIDES.length) % SLIDES.length;
    // 文字
    const s = SLIDES[current];
    copyEl.querySelector('.showcase-icon').textContent = s.icon;
    copyEl.querySelector('.showcase-title').textContent = s.title;
    copyEl.querySelector('.showcase-desc').textContent = s.desc;
    // dots
    dotsBox.querySelectorAll('.showcase-dot').forEach((el, idx) =>
      el.classList.toggle('active', idx === current));
    // Lottie 跳转
    if (anim && anim.totalFrames) {
      const start = current * SEG;
      anim.goToAndPlay(start);
    }
    restart();
  }

  function next() { go(current + 1); }
  function prev() { go(current - 1); }
  function start() { stop(); timer = setInterval(next, INTERVAL); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function restart() { if (root && root.matches(':hover')) return; start(); }

  prevBtn && prevBtn.addEventListener('click', prev);
  nextBtn && nextBtn.addEventListener('click', next);
  root && root.addEventListener('mouseenter', stop);
  root && root.addEventListener('mouseleave', start);

  // 加载 Lottie 动画
  if (typeof lottie !== 'undefined') {
    anim = lottie.loadAnimation({
      container: document.getElementById('showcaseLottie'),
      renderer: 'svg',
      loop: true,
      autoplay: false,
      path: 'assets/lottie/showcase-reel.json'
    });
    anim.addEventListener('DOMLoaded', () => go(0));
  } else {
    // lottie 未加载时的降级：直接显示第一段文字
    go(0);
  }

  // lottie 加载可能慢，先显示第一段（不依赖 loaded 事件）
  setTimeout(() => go(0), 100);
})();
