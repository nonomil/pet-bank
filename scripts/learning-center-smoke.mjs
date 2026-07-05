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
        'page-learn-print',
        'page-learning-sheet'
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
    check('page-learning-sheet 存在', routeShell.pages[5]);

    const learnRuntime = await page.evaluate(async () => {
      localStorage.removeItem('petbank_learning_catalog_state');
      if (typeof window.switchPage === 'function') window.switchPage('learn');
      await new Promise(resolve => setTimeout(resolve, 350));
      const learnPage = document.getElementById('page-learn');
      const portalCards = learnPage?.querySelectorAll('[data-learn-portal-card]').length || 0;
      return {
        hasModule: !!window.LearnCenter,
        hasRenderHub: typeof window.LearnCenter?.renderHub === 'function',
        pageActive: !!learnPage?.classList.contains('active'),
        pageText: learnPage?.innerText || '',
        portalCards,
        chinesePortalImage: learnPage?.querySelector('[data-learn-portal-card="chinese"] img')?.getAttribute('src') || '',
        englishPortalImage: learnPage?.querySelector('[data-learn-portal-card="english"] img')?.getAttribute('src') || ''
      };
    });

    check('LearnCenter 全局模块存在', learnRuntime.hasModule);
    check('LearnCenter.renderHub 存在', learnRuntime.hasRenderHub);
    check('切到 learn 页面后页面激活', learnRuntime.pageActive);
    check('学习首页展示入口大厅卡片', learnRuntime.portalCards >= 5, `cards=${learnRuntime.portalCards}`);
    check('学习中心首页显示暑假中文资料包入口', /暑假中文|幼小衔接/.test(learnRuntime.pageText), learnRuntime.pageText.slice(0, 60));
    check('学习中心首页显示网站入口型资料包', /网站入口|学习网站/.test(learnRuntime.pageText), learnRuntime.pageText.slice(0, 120));
    check('学习中心首页显示英语资料包入口', /Minecraft我的世界英语故事|Minecraft英语/.test(learnRuntime.pageText), learnRuntime.pageText.slice(0, 180));
    check('学习中心首页中文入口已换成暖黄绘本封面', /portal-chinese-summer-classroom-20260705\.png/.test(learnRuntime.chinesePortalImage), learnRuntime.chinesePortalImage);
    check('学习中心首页英语入口已换成 Minecraft 封面图', /portal-minecraft-english-cover-20260705\.png/.test(learnRuntime.englishPortalImage), learnRuntime.englishPortalImage);
    check('学习首页首屏可直接看到汉字学习入口', /汉字/.test(learnRuntime.pageText), learnRuntime.pageText.slice(0, 220));

    const todayRuntime = await page.evaluate(async () => {
      if (typeof window.switchPage === 'function') window.switchPage('today');
      await new Promise(resolve => setTimeout(resolve, 350));
      const todayPage = document.getElementById('page-today');
      return {
        pageActive: !!todayPage?.classList.contains('active'),
        hasDailySheet: !!todayPage?.querySelector('[data-learn-daily-sheet]'),
        pageText: todayPage?.innerText || ''
      };
    });

    const learningSheetRuntime = await page.evaluate(async () => {
      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      await new Promise(resolve => setTimeout(resolve, 350));
      const sheetPage = document.getElementById('page-learning-sheet');
      const dailyRows = sheetPage?.querySelectorAll('[data-daily-task-row]').length || 0;
      return {
        pageActive: !!sheetPage?.classList.contains('active'),
        hasDailySheet: !!sheetPage?.querySelector('[data-learn-daily-sheet]'),
        pageText: sheetPage?.innerText || '',
        dailyRows
      };
    });

    check('积分页激活成功', todayRuntime.pageActive);
    check('今日打卡页不再直接显示学习单', !todayRuntime.hasDailySheet, todayRuntime.pageText.slice(0, 220));
    check('学习单页激活成功', learningSheetRuntime.pageActive);
    check('学习单页出现学习打卡总控', learningSheetRuntime.hasDailySheet);
    check('学习单页默认展示 4 个轻量任务', learningSheetRuntime.dailyRows === 4, `rows=${learningSheetRuntime.dailyRows}`);
    check('学习单页包含晨读/古诗/识字/睡前复盘', /晨读/.test(learningSheetRuntime.pageText) && /古诗/.test(learningSheetRuntime.pageText) && /识字/.test(learningSheetRuntime.pageText) && /睡前复盘/.test(learningSheetRuntime.pageText), learningSheetRuntime.pageText.slice(0, 220));

    const modeSwitchRuntime = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(350);
      const settingsPage = document.getElementById('page-settings');
      const primaryCards = settingsPage?.querySelectorAll('.settings-mode-grid-primary [data-learning-sheet-mode]').length || 0;
      const advancedPanelOpenBefore = !!settingsPage?.querySelector('[data-learning-mode-advanced-panel].is-open');

      settingsPage?.querySelector('[data-learning-mode-advanced-toggle]')?.click();
      await sleep(180);
      const advancedCards = settingsPage?.querySelectorAll('.settings-mode-grid-advanced [data-learning-sheet-mode]').length || 0;
      const advancedPanelOpenAfter = !!settingsPage?.querySelector('[data-learning-mode-advanced-panel].is-open');
      settingsPage?.querySelector('[data-learning-sheet-mode="template-b"]')?.click();
      await sleep(180);
      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      await sleep(350);
      const templateBRows = document.getElementById('page-learning-sheet')?.querySelectorAll('[data-daily-task-row]').length || 0;
      const templateBText = document.getElementById('page-learning-sheet')?.innerText || '';

      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(250);
      document.getElementById('page-settings')?.querySelector('[data-learning-mode-advanced-toggle]')?.click();
      await sleep(180);
      document.getElementById('page-settings')?.querySelector('[data-learning-sheet-mode="template-c"]')?.click();
      await sleep(180);
      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      await sleep(350);
      const templateCRows = document.getElementById('page-learning-sheet')?.querySelectorAll('[data-daily-task-row]').length || 0;
      const templateCText = document.getElementById('page-learning-sheet')?.innerText || '';

      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(250);
      document.getElementById('page-settings')?.querySelector('[data-learning-sheet-mode="template-a"]')?.click();
      await sleep(180);
      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      await sleep(350);
      const templateARowsAgain = document.getElementById('page-learning-sheet')?.querySelectorAll('[data-daily-task-row]').length || 0;

      return {
        primaryCards,
        advancedCards,
        advancedPanelOpenBefore,
        advancedPanelOpenAfter,
        templateBRows,
        templateBText,
        templateCRows,
        templateCText,
        templateARowsAgain
      };
    });

    check(
      '设置页默认只突出模板 A，并把进阶模式收起',
      modeSwitchRuntime.primaryCards === 1 && !modeSwitchRuntime.advancedPanelOpenBefore,
      `primary=${modeSwitchRuntime.primaryCards} openBefore=${modeSwitchRuntime.advancedPanelOpenBefore}`
    );
    check(
      '设置页可展开进阶模式看到模板 B/C',
      modeSwitchRuntime.advancedCards >= 2 && modeSwitchRuntime.advancedPanelOpenAfter,
      `advanced=${modeSwitchRuntime.advancedCards} openAfter=${modeSwitchRuntime.advancedPanelOpenAfter}`
    );
    check(
      '切到模板 B 后积分页展示 5 项并出现拓展',
      modeSwitchRuntime.templateBRows === 5 && /模板 B|轻量标准版/.test(modeSwitchRuntime.templateBText) && /拓展/.test(modeSwitchRuntime.templateBText),
      modeSwitchRuntime.templateBText.slice(0, 220)
    );
    check(
      '切到模板 C 后积分页展示 5 项并出现错题整理',
      modeSwitchRuntime.templateCRows === 5 && /模板 C|错题加强版/.test(modeSwitchRuntime.templateCText) && /错题整理/.test(modeSwitchRuntime.templateCText) && /今日状态/.test(modeSwitchRuntime.templateCText),
      modeSwitchRuntime.templateCText.slice(0, 260)
    );
    check('切回模板 A 后积分页恢复 4 项', modeSwitchRuntime.templateARowsAgain === 4, `rows=${modeSwitchRuntime.templateARowsAgain}`);

    const printModeRuntime = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(250);
      document.getElementById('page-settings')?.querySelector('[data-learning-mode-advanced-toggle]')?.click();
      await sleep(180);
      document.getElementById('page-settings')?.querySelector('[data-learning-sheet-mode="template-b"]')?.click();
      await sleep(180);
      if (window.LearnCenter?.openPrint) window.LearnCenter.openPrint('summer-chinese-bridge-2026');
      await sleep(350);

      const printPage = document.getElementById('page-learn-print');
      const printText = printPage?.innerText || '';
      const hasDailySheet = !!printPage?.querySelector('.learn-print-daily-sheet');
      const modeCards = printPage?.querySelectorAll('.learn-print-daily-mode-card').length || 0;

      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(250);
      document.getElementById('page-settings')?.querySelector('[data-learning-sheet-mode="template-a"]')?.click();
      await sleep(180);

      return {
        hasDailySheet,
        modeCards,
        printText
      };
    });

    check('打印页出现每日学习单纸面模板', printModeRuntime.hasDailySheet);
    check('打印页展示三档学习单阶段卡', printModeRuntime.modeCards >= 3, `cards=${printModeRuntime.modeCards}`);
    check(
      '打印页会跟随当前模式显示模板 B 内容',
      /模板 B|轻量标准版/.test(printModeRuntime.printText) && /拓展/.test(printModeRuntime.printText) && /每日学习单/.test(printModeRuntime.printText),
      printModeRuntime.printText.slice(0, 260)
    );

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
      localStorage.removeItem('petbank_learning_daily_sheet');

      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      await sleep(300);
      const learnSheetBefore = document.getElementById('page-learning-sheet');
      const readingDailyBtn = learnSheetBefore?.querySelector('[data-daily-task-row="reading"] [data-daily-open-lesson]');
      const literacyDailyBtn = learnSheetBefore?.querySelector('[data-daily-task-row="literacy"] [data-daily-open-lesson]');
      const readingLessonId = readingDailyBtn?.dataset.lessonId || 'day-01';
      const literacyLessonId = literacyDailyBtn?.dataset.lessonId || 'day-01';

      if (window.LearnCenter?.openPack) window.LearnCenter.openPack('summer-chinese-bridge-2026');
      await sleep(300);
      const packText = document.getElementById('page-learn-pack')?.innerText || '';

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'morning-reading', readingLessonId);
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
      if (typeof window.switchPage === 'function') window.switchPage('today');
      await sleep(300);
      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      let readingRowText = '';
      for (let i = 0; i < 8; i += 1) {
        await sleep(120);
        readingRowText = document.getElementById('page-learning-sheet')?.querySelector('[data-daily-task-row="reading"]')?.innerText || '';
        if (/已完成|已打勾/.test(readingRowText)) break;
      }

      const pack = await window.LearnCenter.getPack('summer-chinese-bridge-2026');
      const morning = await window.LearnCenter.getModule('summer-chinese-bridge-2026', 'morning-reading');
      const literacyModule = await window.LearnCenter.getModule('summer-chinese-bridge-2026', 'literacy-45days');
      const poemsModule = await window.LearnCenter.getModule('summer-chinese-bridge-2026', 'poems');

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('summer-chinese-bridge-2026', 'literacy-45days', literacyLessonId);
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
      const printDailySheet = !!printPage?.querySelector('.learn-print-daily-sheet');

      return {
        packText,
        hasToggle: !!toggleBtn,
        hasComplete: !!completeBtn,
        completeBtnTextBefore,
        completeBtnTextAfter,
        completeToast,
        readingRowText,
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
        printDailySheet,
        printText
      };
    });

    check('资料包页显示 60 天晨读', /60 天晨读/.test(packAndLesson.packText), packAndLesson.packText.slice(0, 80));
    check('资料包页显示 45 天识字', /45 天识字/.test(packAndLesson.packText), packAndLesson.packText.slice(0, 80));
    check('学习内容页存在 拼音切换按钮', packAndLesson.hasToggle);
    check('学习内容页存在 完成按钮', packAndLesson.hasComplete);
    check('学习内容页完成按钮使用“读完打勾”文案', /读完打勾/.test(packAndLesson.completeBtnTextBefore), packAndLesson.completeBtnTextBefore);
    check('晨读完成后学习单页同步显示已完成', /已完成|已打勾/.test(packAndLesson.readingRowText), packAndLesson.readingRowText);
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
    check('中文打印页包含每日学习单纸面页', packAndLesson.printDailySheet);
    check(
      '打印页包含第 60 天与第 45 天内容',
      (/(第 ?60 ?天)/.test(packAndLesson.printText) || /第 ?31 ?- ?60 ?天/.test(packAndLesson.printText) || /第2个月 第30日/.test(packAndLesson.printText))
        && (/(第 ?45 ?天)/.test(packAndLesson.printText) || /第45天/.test(packAndLesson.printText))
    );

    const dailySheetRuntime = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      localStorage.removeItem('petbank_learning_daily_rewards');
      const pointsBefore = parseInt(localStorage.getItem('petbank_points') || '0', 10);

      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(250);
      document.getElementById('page-settings')?.querySelector('[data-learning-mode-advanced-toggle]')?.click();
      await sleep(180);
      document.getElementById('page-settings')?.querySelector('[data-learning-sheet-mode="template-b"]')?.click();
      await sleep(180);

      if (typeof window.switchPage === 'function') window.switchPage('learning-sheet');
      await sleep(350);
      document.getElementById('page-learning-sheet')?.querySelector('[data-daily-set-minutes="20"]')?.click();
      await sleep(250);

      const todayPage = document.getElementById('page-learning-sheet');
      const reviewText = todayPage?.querySelector('[data-daily-review-text]');
      const nextStep = todayPage?.querySelector('[data-daily-next-step]');
      if (reviewText) reviewText.value = '今天晨读和识字都完成了。';
      if (nextStep) nextStep.value = '明天先读晨读，再接古诗。';
      todayPage?.querySelector('[data-daily-save-summary]')?.click();
      await sleep(350);

      const pointsAfter = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      const dailyRewardsRaw = localStorage.getItem('petbank_learning_daily_rewards') || '';
      const toast = window.__learnSmokeLastToast || document.getElementById('petToast')?.textContent || '';

      if (typeof window.switchPage === 'function') window.switchPage('review');
      await sleep(800);
      const reviewTextPage = document.getElementById('page-review')?.innerText || '';

      if (typeof window.switchPage === 'function') window.switchPage('settings');
      await sleep(250);
      document.getElementById('page-settings')?.querySelector('[data-learning-sheet-mode="template-a"]')?.click();
      await sleep(180);

      return {
        pointsBefore,
        pointsAfter,
        dailyRewardsRaw,
        toast,
        reviewTextPage
      };
    });

    check(
      '学习单只负责记录，不会额外加分',
      dailySheetRuntime.pointsAfter === dailySheetRuntime.pointsBefore,
      `points ${dailySheetRuntime.pointsBefore} -> ${dailySheetRuntime.pointsAfter}`
    );
    check(
      '学习单不再写入单独奖励存储',
      dailySheetRuntime.dailyRewardsRaw === '',
      dailySheetRuntime.dailyRewardsRaw || '(empty)'
    );
    check(
      '学习单提示更轻量，不再出现额外奖励文案',
      !/学习单奖励/.test(dailySheetRuntime.toast) && /今天的小结已保存|学习单已保存/.test(dailySheetRuntime.toast),
      dailySheetRuntime.toast
    );
    check(
      '复盘页不再显示学习单管理概览',
      !/学习单坚持概览|最近 7 天趋势|最近复盘摘要/.test(dailySheetRuntime.reviewTextPage),
      dailySheetRuntime.reviewTextPage.slice(0, 260)
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

    const englishPackFlow = await page.evaluate(async () => {
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
      localStorage.removeItem('petbank_learning_progress');
      localStorage.removeItem('petbank_learning_rewards');
      const currentPoints = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      if (typeof window.addGrowthPoints === 'function') {
        if (currentPoints < 50) window.addGrowthPoints(50 - currentPoints);
      } else if (currentPoints < 50) {
        localStorage.setItem('petbank_points', '50');
      }
      window.__learnSmokeLastToast = '';

      const pack = await window.LearnCenter?.getPack?.('english-mc-hybrid-2026');
      const storyModule = await window.LearnCenter?.getModule?.('english-mc-hybrid-2026', 'mcbook56-story');
      const startersModule = await window.LearnCenter?.getModule?.('english-mc-hybrid-2026', 'mcbookstarters-reader');
      const reviewModule = await window.LearnCenter?.getModule?.('english-mc-hybrid-2026', 'english-weekly-review');

      if (window.LearnCenter?.openPack) window.LearnCenter.openPack('english-mc-hybrid-2026');
      await sleep(350);
      const packText = document.getElementById('page-learn-pack')?.innerText || '';

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('english-mc-hybrid-2026', 'mcbook56-story', 'chapter-01');
      await sleep(350);
      const lessonPage = document.getElementById('page-learn-lesson');
      const lessonText = lessonPage?.innerText || '';
      const openExternal = lessonPage?.querySelector('[data-learn-action="open-external"]');
      const completeBtn = lessonPage?.querySelector('[data-learn-action="complete-lesson"]');

      window.__learnSmokeLastToast = '';
      const pointsBefore = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      if (completeBtn) completeBtn.click();
      await sleep(250);
      const pointsAfterFirst = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      if (completeBtn) completeBtn.click();
      await sleep(250);
      const pointsAfterSecond = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      const toastAfterFirst = window.__learnSmokeLastToast || document.getElementById('petToast')?.textContent || '';

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('english-mc-hybrid-2026', 'mcbook56-story', 'chapter-02');
      await sleep(350);
      const chapter2Btn = document.getElementById('page-learn-lesson')?.querySelector('[data-learn-action="complete-lesson"]');
      if (chapter2Btn) chapter2Btn.click();
      await sleep(250);
      const pointsAfterChapter2 = parseInt(localStorage.getItem('petbank_points') || '0', 10);

      if (window.LearnCenter?.openLesson) window.LearnCenter.openLesson('english-mc-hybrid-2026', 'mcbook56-story', 'chapter-03');
      await sleep(350);
      const chapter3Btn = document.getElementById('page-learn-lesson')?.querySelector('[data-learn-action="complete-lesson"]');
      window.__learnSmokeLastToast = '';
      const pointsBeforeChapter3 = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      if (chapter3Btn) chapter3Btn.click();
      await sleep(250);
      const pointsAfterChapter3 = parseInt(localStorage.getItem('petbank_points') || '0', 10);
      const toastAfterChapter3 = window.__learnSmokeLastToast || document.getElementById('petToast')?.textContent || '';

      return {
        homepageHasEnglish: /英语/.test(document.getElementById('page-learn')?.innerText || ''),
        manifestPackType: pack?.manifest?.packType || '',
        manifestAdapter: pack?.manifest?.sourceAdapter || '',
        storyCount: storyModule?.lessons?.length || 0,
        startersCount: startersModule?.lessons?.length || 0,
        reviewCount: reviewModule?.lessons?.length || 0,
        firstSourceKind: storyModule?.lessons?.[0]?.source?.kind || '',
        packText,
        lessonText,
        hasOpenExternal: !!openExternal,
        externalUrl: openExternal?.getAttribute('href') || openExternal?.dataset?.url || '',
        pointsBefore,
        pointsAfterFirst,
        pointsAfterSecond,
        toastAfterFirst,
        pointsAfterChapter2,
        pointsBeforeChapter3,
        pointsAfterChapter3,
        toastAfterChapter3,
        progressRaw: localStorage.getItem('petbank_learning_progress'),
        rewardsRaw: localStorage.getItem('petbank_learning_rewards')
      };
    });

    check('英语资料包 manifest 使用 hybrid 类型', englishPackFlow.manifestPackType === 'hybrid', `type=${englishPackFlow.manifestPackType}`);
    check('英语资料包暴露 mayihaoke sourceAdapter', englishPackFlow.manifestAdapter === 'mayihaoke-reader', `adapter=${englishPackFlow.manifestAdapter}`);
    check('英语故事模块至少有 3 节', englishPackFlow.storyCount >= 3, `count=${englishPackFlow.storyCount}`);
    check('英语 Starters 模块至少有 2 节', englishPackFlow.startersCount >= 2, `count=${englishPackFlow.startersCount}`);
    check('英语每周复盘模块存在', englishPackFlow.reviewCount >= 1, `count=${englishPackFlow.reviewCount}`);
    check('英语 lesson 识别 external-chapter 来源', englishPackFlow.firstSourceKind === 'external-chapter', `kind=${englishPackFlow.firstSourceKind}`);
    check('英语资料包页显示故事模块和复盘模块', /我的世界英语故事/.test(englishPackFlow.packText) && /每周英语复盘/.test(englishPackFlow.packText), englishPackFlow.packText.slice(0, 160));
    check('英语 lesson 页面存在打开外部章节按钮', englishPackFlow.hasOpenExternal);
    check('英语外部章节按钮包含 mayihaoke 地址', /mayihaoke\.com/.test(englishPackFlow.externalUrl), englishPackFlow.externalUrl);
    check('英语 lesson 页面展示目标词和家长提示', /目标词|家长提示/.test(englishPackFlow.lessonText), englishPackFlow.lessonText.slice(0, 200));
    check(
      '英语章节积分只发一次',
      englishPackFlow.pointsAfterFirst > englishPackFlow.pointsBefore && englishPackFlow.pointsAfterSecond === englishPackFlow.pointsAfterFirst,
      `points ${englishPackFlow.pointsBefore} -> ${englishPackFlow.pointsAfterFirst} -> ${englishPackFlow.pointsAfterSecond}`
    );
    check('英语章节完成后弹出成长分提示', /成长分 \+2|成长分.*2|\+2 分/.test(englishPackFlow.toastAfterFirst), englishPackFlow.toastAfterFirst);
    check('英语章节完成后写入 learning_progress', !!englishPackFlow.progressRaw);
    check('英语章节完成后写入 learning_rewards', !!englishPackFlow.rewardsRaw);
    check(
      '连续完成 3 个英语章节触发额外奖励',
      englishPackFlow.pointsAfterChapter3 === englishPackFlow.pointsBeforeChapter3 + 3,
      `points ${englishPackFlow.pointsBeforeChapter3} -> ${englishPackFlow.pointsAfterChapter3}`
    );
    check('第 3 个英语章节提示连读奖励', /连读奖励|成长分 \+3|成长分.*3/.test(englishPackFlow.toastAfterChapter3), englishPackFlow.toastAfterChapter3);

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
        restored = !!(
          parsed['summer-chinese-bridge-2026']
          || parsed['learning-sites-gateway-2026']
          || parsed['english-mc-hybrid-2026']
        );
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
