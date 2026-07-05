// 首页功能展示轮播 —— 自动播放 + 手动切换 + 悬停暂停
// 每栏目一张代表性图片做背景（file:// 协议下用 <div background-image> 加载本地 webp，不走 XHR，不会被浏览器拦截）
(function () {
  const SLIDES = [
    { icon: '🗺️', title: '场景探索冒险', desc: '12大奇幻场景，点亮路线解锁剧情与宝藏', img: 'assets/scenes/forest.webp' },
    { icon: '🐾', title: '宠物养成', desc: '领养10族伙伴，喂食互动陪它一起成长', img: 'assets/banchong/灵兽族/岚纹麒麟-0.webp' },
    { icon: '⚔️', title: '热血战斗', desc: '回合对战掉装备，越级挑战赢取稀有奖励', img: 'assets/characters/volcano-phoenix.webp' },
    { icon: '🔢', title: '数学PK', desc: '趣味数学挑战，烧脑对答赚取积分', img: 'assets/scenes/stargarden.webp' },
    { icon: '🎁', title: '积分兑换', desc: '积分开盲盒，抽出稀有道具与宠物', img: 'assets/scenes/castle.webp' },
    { icon: '📖', title: '宠物图鉴', desc: '收集147只宠物，点亮全族图鉴', img: 'assets/banchong/灵兽族/岚纹麒麟-0.webp' },
  ];
  const INTERVAL = 4000;
  const track = document.getElementById('showcaseTrack');
  const dotsBox = document.getElementById('showcaseDots');
  const prevBtn = document.getElementById('showcasePrev');
  const nextBtn = document.getElementById('showcaseNext');
  const root = document.getElementById('showcase');
  if (!track || !SLIDES.length) return;
  let current = 0;
  let timer = null;

  // 渲染 slides
  SLIDES.forEach((s, i) => {
    const slide = document.createElement('div');
    slide.className = 'showcase-slide' + (i === 0 ? ' active' : '');
    slide.style.backgroundImage = `url("${s.img}")`;
    slide.innerHTML = `
      <div class="showcase-overlay"></div>
      <div class="showcase-copy">
        <div class="showcase-icon">${s.icon}</div>
        <div class="showcase-title">${s.title}</div>
        <div class="showcase-desc">${s.desc}</div>
      </div>`;
    track.appendChild(slide);

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

  function go(i) {
    current = (i + SLIDES.length) % SLIDES.length;
    track.querySelectorAll('.showcase-slide').forEach((el, idx) =>
      el.classList.toggle('active', idx === current));
    dotsBox.querySelectorAll('.showcase-dot').forEach((el, idx) =>
      el.classList.toggle('active', idx === current));
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

  start();
})();