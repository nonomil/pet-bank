import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:7000';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
let voiceMapFetches = 0;
page.on('request', (request) => {
    if (request.url().includes('/assets/voice/map.json')) voiceMapFetches += 1;
});

await page.addInitScript(() => {
    window.__voiceAudioPlays = [];
    window.Audio = class FakeAudio {
        constructor(src) {
            this.src = src || '';
            this.onended = null;
            this.onerror = null;
        }

        play() {
            window.__voiceAudioPlays.push(this.src);
            return Promise.resolve();
        }

        pause() {}
    };
});

try {
    await page.goto(`${baseUrl}/app/explore`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.evaluate(async () => { await window.switchPage('explore', { skipAccessGate: true }); });
    await page.waitForFunction(() => window.VoiceSystem, { timeout: 20000 });
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(voiceMapFetches, 0, 'entering explore must not load the legacy voice map');

    await page.evaluate(() => {
        window.VoiceSystem.speak('海浪把一串写着宠物名字缩写的漂流瓶推到你脚边，图鉴馆要你在这片海滩补齐旅行型伙伴的调查记录。', { force: true });
    });
    await page.waitForTimeout(500);
    assert.equal(voiceMapFetches, 1, 'first mapped sentence should load the voice map once');
    await page.waitForFunction(() => window.__voiceAudioPlays.length === 1, { timeout: 5000 });

    await page.evaluate(() => {
        window.VoiceSystem.speak('海风吹开图鉴页角，你补上了这只海边伙伴的社交习惯和远行档案，也顺利收下了它的调查卡。', { force: true });
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    const result = await page.evaluate(() => ({
        audioPlays: window.__voiceAudioPlays.length,
    }));
    assert.equal(voiceMapFetches, 1, 'voice map must be fetched once and then reused');
    assert.equal(result.audioPlays, 2, 'a mapped sentence should play without another index request');
    console.log(JSON.stringify(result));
} finally {
    await browser.close();
}
