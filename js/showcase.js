// 首页栏目轮播：自动切换、手动切换、整张图点击跳转到对应栏目
(function () {
  const SLIDES = [
    {
      icon: '📚',
      title: '学习中心',
      desc: '先进入今天的学习内容，打开就能继续读、练、看。',
      img: 'assets/ui/hanzi-new-bg.webp',
      page: 'learn',
    },
    {
      icon: '🐾',
      title: '宠物伙伴',
      desc: '去看看今天的同行伙伴，喂食、互动，再一起继续成长。',
      img: 'assets/home-bg/room-forest.webp',
      page: 'pet',
    },
    {
      icon: '🗺️',
      title: '探索冒险',
      desc: '沿着发光路线去下一站，点亮新的场景和故事。',
      img: 'assets/scenes/forest.webp',
      page: 'explore',
    },
    {
      icon: '🎡',
      title: '游乐场',
      desc: '想轻松一点时，就去数学、汉字和卡牌小游戏里玩一会儿。',
      img: 'assets/ui/playground-bg.webp',
      page: 'playground',
    },
    {
      icon: '⭐',
      title: '今日打卡',
      desc: '把今天最重要的一件小事做完，积分就会马上加进来。',
      img: 'assets/scenes/stargarden.webp',
      page: 'today',
    },
  ];

  const INTERVAL = 4200;
  const START_DELAY = 14000;
  const track = document.getElementById('showcaseTrack');
  const dotsBox = document.getElementById('showcaseDots');
  const prevBtn = document.getElementById('showcasePrev');
  const nextBtn = document.getElementById('showcaseNext');
  const root = document.getElementById('showcase');
  if (!root || !track || !dotsBox || !SLIDES.length) return;

  let current = 0;
  let timer = null;
  let startTimer = null;

  function openSlide(slide) {
    if (!slide || !slide.page || typeof window.switchPage !== 'function') return;
    window.switchPage(slide.page);
  }

  function ensureSlideBg(index) {
    const slide = track.querySelector(`.showcase-slide[data-index="${index}"]`);
    if (!slide || slide.dataset.bgLoaded === '1') return;
    slide.style.backgroundImage = `url("${slide.dataset.bg}")`;
    slide.dataset.bgLoaded = '1';
  }

  SLIDES.forEach((slideData, index) => {
    const slide = document.createElement('button');
    slide.className = `showcase-slide${index === 0 ? ' active' : ''}`;
    slide.type = 'button';
    slide.dataset.index = String(index);
    slide.dataset.bg = slideData.img;
    if (index === 0) {
      slide.style.backgroundImage = `url("${slideData.img}")`;
      slide.dataset.bgLoaded = '1';
    }
    slide.setAttribute('aria-label', `打开${slideData.title}`);
    slide.innerHTML = `
      <span class="showcase-overlay"></span>
      <span class="showcase-copy">
        <span class="showcase-icon">${slideData.icon}</span>
        <span class="showcase-title">${slideData.title}</span>
        <span class="showcase-desc">${slideData.desc}</span>
      </span>`;
    slide.addEventListener('click', () => openSlide(slideData));
    track.appendChild(slide);

    const dot = document.createElement('button');
    dot.className = `showcase-dot${index === 0 ? ' active' : ''}`;
    dot.type = 'button';
    dot.dataset.index = String(index);
    dot.setAttribute('aria-label', `切换到第${index + 1}张`);
    dotsBox.appendChild(dot);
  });

  function go(index) {
    current = (index + SLIDES.length) % SLIDES.length;
    ensureSlideBg(current);
    track.querySelectorAll('.showcase-slide').forEach((slide, slideIndex) => {
      slide.classList.toggle('active', slideIndex === current);
    });
    dotsBox.querySelectorAll('.showcase-dot').forEach((dot, dotIndex) => {
      dot.classList.toggle('active', dotIndex === current);
    });
    restart();
  }

  function next() {
    go(current + 1);
  }

  function prev() {
    go(current - 1);
  }

  function stop() {
    if (startTimer) {
      clearTimeout(startTimer);
      startTimer = null;
    }
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function start() {
    if (SLIDES.length <= 1) return;
    if (timer) clearInterval(timer);
    timer = setInterval(next, INTERVAL);
  }

  function scheduleStart() {
    if (SLIDES.length <= 1 || startTimer || timer) return;
    startTimer = setTimeout(() => {
      startTimer = null;
      start();
    }, START_DELAY);
  }

  function restart() {
    if (root.matches(':hover')) return;
    start();
  }

  dotsBox.addEventListener('click', (event) => {
    const dot = event.target.closest('.showcase-dot');
    if (!dot) return;
    go(Number(dot.dataset.index || 0));
  });

  if (prevBtn) prevBtn.addEventListener('click', prev);
  if (nextBtn) nextBtn.addEventListener('click', next);
  root.addEventListener('mouseenter', stop);
  root.addEventListener('mouseleave', scheduleStart);

  scheduleStart();
})();
