/**
 * 学习中心最小冒烟测试
 *
 * 用法（需 http server 跑在 127.0.0.1:8000）：
 *   node scripts/learning-center-smoke.mjs
 */

import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const BASE = 'http://127.0.0.1:8000';
const NAV_TIMEOUT = 20000;

const results = [];
let passCount = 0;

function check(name, cond, detail = '') {
  const ok = !!cond;
  if (ok) passCount += 1;
  results.push({ name, pass: ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('━━━ learning-center 冒烟测试 ━━━');
  console.log(`BASE = ${BASE}`);

  let browser;
  try {
    browser = await chromium.launch(browserLaunchOpts());
  } catch (e) {
    console.error('❌ 浏览器启动失败：', e.message);
    process.exit(2);
  }

  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];

  page.on('pageerror', e => pageErrors.push(String(e?.message || e)));
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const t = msg.text();
      if (!/tailwind|lucide|fonts\.googleapis|cdn/i.test(t)) {
        pageErrors.push('[console.error] ' + t);
      }
    }
  });

  try {
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });

    const routeShell = await page.evaluate(() => {
      const nav = document.querySelector('.nav-tab[data-page="learn"]');
      const pages = [
        'page-learn',
        'page-learn-pack',
        'page-learn-plan',
        'page-learn-lesson',
        'page-learn-print'
      ].map(id => !!document.getElementById(id));
      return {
        hasLearnTab: !!nav,
        pages
      };
    });

    check('顶部导航存在 学习 tab', routeShell.hasLearnTab);
    check('page-learn 存在', routeShell.pages[0]);
    check('page-learn-pack 存在', routeShell.pages[1]);
    check('page-learn-plan 存在', routeShell.pages[2]);
    check('page-learn-lesson 存在', routeShell.pages[3]);
    check('page-learn-print 存在', routeShell.pages[4]);

    const learnRuntime = await page.evaluate(async () => {
      if (typeof window.switchPage === 'function') window.switchPage('learn');
      await new Promise(resolve => setTimeout(resolve, 300));
      const learnPage = document.getElementById('page-learn');
      return {
        hasModule: !!window.LearnCenter,
        hasRenderHub: typeof window.LearnCenter?.renderHub === 'function',
        pageActive: !!learnPage?.classList.contains('active'),
        pageText: learnPage?.innerText || ''
      };
    });

    check('LearnCenter 全局模块存在', learnRuntime.hasModule);
    check('LearnCenter.renderHub 存在', learnRuntime.hasRenderHub);
    check('切到 learn 页面后页面激活', learnRuntime.pageActive);
    check('学习中心首页显示暑假中文资料包入口', /暑假中文|幼小衔接/.test(learnRuntime.pageText), learnRuntime.pageText.slice(0, 60));
    check('学习中心首页显示网站入口型资料包', /网站入口|学习网站/.test(learnRuntime.pageText), learnRuntime.pageText.slice(0, 120));

    const packAndLesson = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      if (typeof window.showToast === 'function' && !window.__learnSmokeToastWrapped) {
        const originalShowToast = window.showToast;
        window.__learnSmokeToastLog = [];
        window.showToast = function patchedShowToast(msg) {
          const text = String(msg || '');
          window.__learnSmokeLastToast = text;
          window.__learnSmokeToastLog.push(text);
          return originalShowToast.apply(this, arguments);
        };
        window.__learnSmokeToastWrapped = true;
      }
      if (window.addGrowthPoints) {
        window.addGrowthPoints(30);
      } else {
        localStorage.setItem('petbank_points', '30');
      }
      localStorage.removeItem('petbank_learning_progress');
      localStorage.removeItem('petbank_learning_rewards');

      if (window.LearnCenter?.openPack) window.LearnCenter.openPack('summer-chinese-bridge-2026');
      await sleep(300);
      const packText = document.getElementById('page-learn-pack')?.innerText || '';

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'morning-reading', 'day-01');
      await sleep(300);

      const lessonPage = document.getElementById('page-learn-lesson');
      const toggleBtn = lessonPage?.querySelector('[data-learn-action="toggle-pinyin"]');
      const completeBtn = lessonPage?.querySelector('[data-learn-action="complete-lesson"]');
      const completeBtnTextBefore = completeBtn?.textContent?.trim() || '';
      const pointsBefore = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      if (completeBtn) completeBtn.click();
      await sleep(250);
      const pointsAfterFirst = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      const completeBtnTextAfter = completeBtn?.textContent?.trim() || '';
      const completeToast = window.__learnSmokeLastToast || document.getElementById('petToast')?.textContent || '';
      if (completeBtn) completeBtn.click();
      await sleep(250);
      const pointsAfterSecond = parseInt(localStorage.getItem('petbank_points') || '0', 10);

      const pack = await window.LearnCenter.getPack('summer-chinese-bridge-2026');
      const morning = await window.LearnCenter.getModule('summer-chinese-bridge-2026', 'morning-reading');
      const literacyModule = await window.LearnCenter.getModule('summer-chinese-bridge-2026', 'literacy-45days');
      const poemsModule = await window.LearnCenter.getModule('summer-chinese-bridge-2026', 'poems');

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'literacy-45days', 'day-01');
      await sleep(350);
      const literacyPage = document.getElementById('page-learn-lesson');
      const literacyComplete = literacyPage?.querySelector('[data-learn-action="complete-lesson"]');
      const pointsBeforeLiteracy = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      if (literacyComplete) literacyComplete.click();
      await sleep(250);
      const pointsAfterLiteracy = parseInt(localStorage.getItem('petbank_points') || '0', 10);

      if (window.LearnCenter?.openPrint) window.LearnCenter.openPrint('summer-chinese-bridge-2026');
      await sleep(350);
      const printPage = document.getElementById('page-learn-print');
      const printText = printPage?.innerText || '';
      const printSheet = !!printPage?.querySelector('.learn-print-sheet');
      const printSections = printPage?.querySelectorAll('.learn-print-section').length || 0;

      return {
        packText,
        hasToggle: !!toggleBtn,
        hasComplete: !!completeBtn,
        completeBtnTextBefore,
        completeBtnTextAfter,
        completeToast,
        progressKey: localStorage.getItem('petbank_learning_progress'),
        rewardsKey: localStorage.getItem('petbank_learning_rewards'),
        pointsBefore,
        pointsAfterFirst,
        pointsAfterSecond,
        morningCount: morning?.lessons?.length || 0,
        literacyCount: literacyModule?.lessons?.length || 0,
        poemsCount: poemsModule?.lessons?.length || 0,
        planWeeks: pack?.plan?.weeks?.length || 0,
        pointsBeforeLiteracy,
        pointsAfterLiteracy,
        printSheet,
        printSections,
        printText
      };
    });

    check('资料包页显示 60 天晨读', /60 天晨读/.test(packAndLesson.packText), packAndLesson.packText.slice(0, 80));
    check('资料包页显示 45 天识字', /45 天识字/.test(packAndLesson.packText), packAndLesson.packText.slice(0, 80));
    check('学习内容页存在 拼音切换按钮', packAndLesson.hasToggle);
    check('学习内容页存在 完成按钮', packAndLesson.hasComplete);
    check('学习内容页完成按钮使用“读完打勾”文案', /读完打勾/.test(packAndLesson.completeBtnTextBefore), packAndLesson.completeBtnTextBefore);
    check('完成 lesson 后写入 learning_progress', !!packAndLesson.progressKey);
    check('完成 lesson 后写入 learning_rewards', !!packAndLesson.rewardsKey);
    check('晨读模块共有 60 天', packAndLesson.morningCount === 60, `count=${packAndLesson.morningCount}`);
    check('识字模块共有 45 天', packAndLesson.literacyCount === 45, `count=${packAndLesson.literacyCount}`);
    check('古诗模块覆盖 60 首', packAndLesson.poemsCount === 60, `count=${packAndLesson.poemsCount}`);
    check('学习计划覆盖 9 周收尾', packAndLesson.planWeeks === 9, `weeks=${packAndLesson.planWeeks}`);
    check(
      '晨读 lesson 积分只发一次',
      packAndLesson.pointsAfterFirst > packAndLesson.pointsBefore && packAndLesson.pointsAfterSecond === packAndLesson.pointsAfterFirst,
      `points ${packAndLesson.pointsBefore} -> ${packAndLesson.pointsAfterFirst} -> ${packAndLesson.pointsAfterSecond}`
    );
    check('读完打勾后按钮显示已打勾状态', /已打勾/.test(packAndLesson.completeBtnTextAfter), packAndLesson.completeBtnTextAfter);
    check('读完打勾后弹出成长分提示', /成长分 \\+2|成长分.*2|\\+2 分/.test(packAndLesson.completeToast), packAndLesson.completeToast);
    check(
      '同一天完成晨读和识字会叠加发分',
      packAndLesson.pointsAfterLiteracy === packAndLesson.pointsBeforeLiteracy + 4,
      `points ${packAndLesson.pointsBeforeLiteracy} -> ${packAndLesson.pointsAfterLiteracy}`
    );
    check('打印页存在 A4 友好容器', packAndLesson.printSheet);
    check('打印页渲染出多个资料分区', packAndLesson.printSections >= 5, `sections=${packAndLesson.printSections}`);
    check(
      '打印页包含第 60 天与第 45 天内容',
      (/(第 ?60 ?天)/.test(packAndLesson.printText) || /第 ?31 ?- ?60 ?天/.test(packAndLesson.printText) || /第2个月 第30日/.test(packAndLesson.printText))
        && (/(第 ?45 ?天)/.test(packAndLesson.printText) || /第45天/.test(packAndLesson.printText))
    );

    const poemLesson = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      if (window.LearnCenter?.openLesson) {
        window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'morning-reading', 'day-05');
      }
      await sleep(350);
      const lessonText = document.getElementById('page-learn-lesson')?.innerText || '';
      return { lessonText };
    });

    check('唐诗页面展示《登鹳雀楼》后两句', /欲穷千里目/.test(poemLesson.lessonText) && /更上一层楼/.test(poemLesson.lessonText), poemLesson.lessonText.slice(0, 220));
    check('唐诗页面展示古诗解释', /看得更远|再往高处走一步|站得更高/.test(poemLesson.lessonText), poemLesson.lessonText.slice(0, 260));
    check(
      '唐诗页面按“一句拼音一句中文”交替显示',
      /bái rì yī shān jìn[\s\S]*白日依山尽[\s\S]*yù qióng qiān lǐ mù[\s\S]*欲穷千里目/.test(poemLesson.lessonText),
      poemLesson.lessonText.slice(0, 320)
    );

    const poemRotation = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      if (window.LearnCenter?.openLesson) {
        window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'morning-reading', 'day-01');
      }
      await sleep(350);
      const day01Text = document.getElementById('page-learn-lesson')?.innerText || '';
      if (window.LearnCenter?.openLesson) {
        window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'morning-reading', 'day-09');
      }
      await sleep(350);
      const day09Text = document.getElementById('page-learn-lesson')?.innerText || '';
      return { day01Text, day09Text };
    });

    check(
      '第 9 天古诗不再重复第 1 天',
      /咏鹅/.test(poemRotation.day01Text) && !/咏鹅/.test(poemRotation.day09Text),
      `day01=${poemRotation.day01Text.slice(0, 60)} | day09=${poemRotation.day09Text.slice(0, 60)}`
    );

    const gatewayPackFlow = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      if (window.LearnCenter?.openPack) window.LearnCenter.openPack('learning-sites-gateway-2026');
      await sleep(350);
      const packText = document.getElementById('page-learn-pack')?.innerText || '';

      if (window.LearnCenter?.openPlan) window.LearnCenter.openPlan('learning-sites-gateway-2026');
      await sleep(350);
      const planPage = document.getElementById('page-learn-plan');
      const planActions = planPage?.querySelectorAll('.learn-plan-item .learn-btn').length || 0;
      const planText = planPage?.innerText || '';

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('learning-sites-gateway-2026', 'guided-sites', 'day-01');
      await sleep(350);
      const lessonPage = document.getElementById('page-learn-lesson');
      const resourceCards = lessonPage?.querySelectorAll('.learn-resource-card').length || 0;
      const resourceLinks = lessonPage?.querySelectorAll('.learn-resource-card a[href^="http"]').length || 0;
      const completeBtn = lessonPage?.querySelector('[data-learn-action="complete-lesson"]');
      if (completeBtn) completeBtn.click();
      await sleep(250);

      if (window.LearnCenter?.openPrint) window.LearnCenter.openPrint('learning-sites-gateway-2026');
      await sleep(350);
      const printPage = document.getElementById('page-learn-print');
      const printUrls = printPage?.querySelectorAll('.learn-resource-url').length || 0;

      return {
        packText,
        planActions,
        planText,
        resourceCards,
        resourceLinks,
        printUrls,
        progressRaw: localStorage.getItem('petbank_learning_progress')
      };
    });

    check('第二套资料包页显示网站入口模块', /网站学习入口|每周回看/.test(gatewayPackFlow.packText), gatewayPackFlow.packText.slice(0, 100));
    check('第二套资料包计划页渲染动作按钮', gatewayPackFlow.planActions >= 2, `actions=${gatewayPackFlow.planActions}`);
    check('第二套资料包计划页显示三周节奏', /第 1 周|第 2 周|第 3 周/.test(gatewayPackFlow.planText), gatewayPackFlow.planText.slice(0, 120));
    check('网站入口 lesson 渲染资源卡片', gatewayPackFlow.resourceCards >= 2, `cards=${gatewayPackFlow.resourceCards}`);
    check('网站入口 lesson 提供外部链接按钮', gatewayPackFlow.resourceLinks >= 2, `links=${gatewayPackFlow.resourceLinks}`);

    let gatewayProgress = false;
    try {
      const parsed = JSON.parse(gatewayPackFlow.progressRaw || '{}');
      gatewayProgress = !!parsed['learning-sites-gateway-2026'];
    } catch (err) {
      gatewayProgress = false;
    }
    check('完成网站入口 lesson 后写入第二套资料包进度', gatewayProgress);
    check('第二套资料包打印页渲染资源网址', gatewayPackFlow.printUrls >= 2, `urls=${gatewayPackFlow.printUrls}`);

    const profileSetup = await page.evaluate(() => {
      const activeBefore = window.ProfileManager?.getActiveId?.();
      const created = window.ProfileManager?.create?.('学习中心冒烟', '🧒');
      return {
        activeBefore,
        newId: created?.id || null
      };
    });

    if (profileSetup.newId) {
      await page.evaluate((newId) => {
        window.ProfileManager.switchTo(newId);
      }, profileSetup.newId);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });

      const newProfileState = await page.evaluate(() => ({
        activeId: window.ProfileManager?.getActiveId?.(),
        progressRaw: localStorage.getItem('petbank_learning_progress')
      }));

      check(
        '切到新孩子后学习进度隔离为空',
        newProfileState.activeId === profileSetup.newId && !newProfileState.progressRaw,
        `active=${newProfileState.activeId} progress=${newProfileState.progressRaw}`
      );

      await page.evaluate((activeBefore) => {
        window.ProfileManager.switchTo(activeBefore);
      }, profileSetup.activeBefore);
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => typeof window.switchPage === 'function', { timeout: 15000 });

      const restoredProfileState = await page.evaluate(() => ({
        activeId: window.ProfileManager?.getActiveId?.(),
        progressRaw: localStorage.getItem('petbank_learning_progress')
      }));

      let restored = false;
      try {
        const parsed = JSON.parse(restoredProfileState.progressRaw || '{}');
        restored = !!parsed['summer-chinese-bridge-2026'];
      } catch (err) {
        restored = false;
      }

      check(
        '切回原孩子后学习进度恢复',
        restoredProfileState.activeId === profileSetup.activeBefore && restored,
        `active=${restoredProfileState.activeId}`
      );
    }

    const realErrors = pageErrors.filter(e =>
      !/Failed to load resource|net::ERR|404|tailwind|lucide|fonts\.googleapis|cdn/i.test(e)
    );
    check('学习中心链路无 pageerror', realErrors.length === 0, realErrors.slice(0, 2).join(' | '));
  } catch (e) {
    console.error('\n💥 测试执行异常：', e.message);
    console.error(e.stack);
    check('测试主流程未抛异常', false, String(e.message));
  } finally {
    await browser.close();
  }

  const total = results.length;
  console.log('\n━━━ 冒烟总报告 ━━━');
  console.log(`通过 ${passCount}/${total}`);
  const failed = results.filter(r => !r.pass);
  if (failed.length) {
    console.log('\n失败项：');
    failed.forEach(r => console.log(`  ❌ ${r.name}${r.detail ? ' — ' + r.detail : ''}`));
  } else {
    console.log('\n全部通过 ✅');
  }
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(3);
});
