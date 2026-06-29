// Playwright 浏览器路径配置（纯路径模块，不依赖 playwright 包）
//
// 优先级（从高到低）：
//   1. process.env.PLAYWRIGHT_BROWSER / PLAYWRIGHT_BROWSER_PATH
//   2. 项目根 .env 文件里的 PLAYWRIGHT_BROWSER*
//   3. 系统 Chrome（C:\Program Files\Google\Chrome\...）
//   4. Playwright chromium 缓存（ms-playwright\chromium-1217 等）
//   5. 都找不到 → 返回 null，让 playwright 用自带默认浏览器
//
// 用法（测试脚本）：
//   import { chromium } from 'playwright';
//   import { BROWSER_PATH } from '../../scripts/playwright-browser.mjs';
//   const browser = await chromium.launch({ headless: true, executablePath: BROWSER_PATH });
//   // BROWSER_PATH 为 null 时不传 executablePath（用 playwright 默认）

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function readEnvFile() {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return {};
  const out = {};
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && m[2]) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const fileEnv = readEnvFile();

function chromiumCandidates() {
  const local = (process.env.LOCALAPPDATA || join(process.env.USERPROFILE || '', 'AppData/Local')).replace(/\\/g, '/');
  const base = `${local}/ms-playwright`;
  return ['chromium-1217', 'chromium-1208', 'chromium-1187'].flatMap(v => [
    `${base}/${v}/chrome-win64/chrome.exe`,
    `${base}/${v}/chrome-win/chrome.exe`,
  ]);
}

// 候选路径（按优先级）
export const BROWSER_CANDIDATES = [
  process.env.PLAYWRIGHT_BROWSER,
  process.env.PLAYWRIGHT_BROWSER_PATH,
  fileEnv.PLAYWRIGHT_BROWSER,
  fileEnv.PLAYWRIGHT_BROWSER_PATH,
  // 系统 Chrome / Edge
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  // Playwright chromium 缓存
  ...chromiumCandidates(),
].filter(Boolean);

export function findBrowser() {
  for (const p of BROWSER_CANDIDATES) {
    if (existsSync(p)) return p;
  }
  return null;
}

// 当前选中的浏览器路径（null = 用 playwright 默认）
export const BROWSER_PATH = findBrowser();

// 便捷：构造 launch 选项（BROWSER_PATH 为 null 时不加 executablePath）
export function browserLaunchOpts(opts = {}) {
  const o = { headless: true, ...opts };
  if (BROWSER_PATH) o.executablePath = BROWSER_PATH;
  return o;
}
