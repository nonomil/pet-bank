import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const repoRoot = process.cwd();
const outputPath = path.join(repoRoot, 'data', 'learn', 'external', 'mayihaoke', 'word-map.json');
const chromePath = process.env.PETBANK_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  try {
    const page = await browser.newPage();
    try {
      await page.goto('https://mayihaoke.com/word_map.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch (error) {
      if (!page.url().includes('/word_map.html')) throw error;
    }
    await page.waitForTimeout(2500);
    const frame = page.mainFrame();
    await frame.waitForSelector('.tab-content .vocab-item', { state: 'attached', timeout: 20000 });
    const groups = await frame.evaluate(() => [...document.querySelectorAll('.tab-content')]
      .map((panel, index) => ({
        id: panel.id || `tab-${index}`,
        age: panel.querySelector('h2')?.textContent?.replace(/\s+/g, ' ').trim() || '',
        words: [...panel.querySelectorAll('.vocab-item')]
          .map(node => node.textContent.replace(/\s+/g, ' ').trim())
          .filter(Boolean)
      }))
      .filter(group => group.words.length));
    const words = [...new Set(groups.flatMap(group => group.words))].sort((a, b) => a.localeCompare(b));
    const snapshot = {
      provider: 'mayihaoke',
      sourceUrl: 'https://mayihaoke.com/word-map',
      embeddedUrl: 'https://mayihaoke.com/word_map.html',
      fetchedAt: new Date().toISOString(),
      scope: 'general-english-word-map',
      note: '通用英语年龄分级词表；不并入 Minecraft 专题学习池。',
      groupCount: groups.length,
      totalRenderedEntries: groups.reduce((sum, group) => sum + group.words.length, 0),
      uniqueWords: words.length,
      groups,
      words
    };
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify({ output: path.relative(repoRoot, outputPath).replaceAll('\\', '/'), groups: groups.length, entries: snapshot.totalRenderedEntries, uniqueWords: words.length }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(`[mayihaoke-word-map] ${error.message}`);
  process.exitCode = 1;
});
