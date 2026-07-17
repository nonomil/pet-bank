import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from './playwright-browser.mjs';

const baseUrl = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';
const expectedAudioExtension = process.env.PETBANK_PIXEL_STORY_AUDIO_EXT || 'wav';
const browser = await chromium.launch(browserLaunchOpts());
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

await page.addInitScript(() => {
    window.__pixelStoryAudioCalls = [];
    window.Audio = class FakeAudio {
        constructor(src) {
            this.src = src || '';
            this.onended = null;
            this.onerror = null;
        }

        play() {
            window.__pixelStoryAudioCalls.push(this.src);
            return Promise.resolve();
        }

        pause() {}
    };
});

try {
    await page.goto(`${baseUrl}/app/explore`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForFunction(() => window.PetBankRuntime && window.switchPage, { timeout: 20000 });
    await page.evaluate(() => {
        window.VoiceSystem = {
            speakTTS(text) { window.__pixelStoryAudioCalls.push('tts:' + text); },
            playStoryAudio(url) { window.__pixelStoryAudioCalls.push(url); },
            stop() {}
        };
    });
    await page.evaluate(async () => {
        localStorage.removeItem('petbank_pixel_worlds_progress_v1');
        await window.switchPage('explore');
    });
    await page.waitForSelector('#pixelStoryMapContainer .pixel-story-node', { state: 'attached', timeout: 20000 });
    await page.locator('#pixelStoryMapContainer .pixel-story-node').first().click();
    await page.waitForSelector('.pixel-story-stage', { state: 'visible', timeout: 20000 });

    const calls = await page.evaluate(() => window.__pixelStoryAudioCalls || []);
    assert.equal(calls.length, 1, `entering a story must play exactly one current line, got ${JSON.stringify(calls)}`);
    assert.ok(calls[0].startsWith('tts:') || calls[0].includes('/lines/'), `expected current-line audio, got ${JSON.stringify(calls)}`);
    const firstText = await page.locator('#pixelStoryText').textContent();
    await page.locator('#pixelStoryBox').click();
    await page.waitForFunction(() => window.__pixelStoryAudioCalls.length === 2, { timeout: 5000 });
    const secondText = await page.locator('#pixelStoryText').textContent();
    assert.notEqual(secondText, firstText, 'one dialogue click must advance exactly one text');
    const afterNextCalls = await page.evaluate(() => window.__pixelStoryAudioCalls || []);
    assert.equal(afterNextCalls.length, 2, `one dialogue click must add exactly one audio, got ${JSON.stringify(afterNextCalls)}`);

    await page.evaluate(async () => {
        await window.switchPage('map');
        window.openHomeExploreMode('sci-fi');
    });
    await page.waitForSelector('#homePixelWorldMapSlot .pixel-story-node', { state: 'attached', timeout: 20000 });
    await page.locator('#homePixelWorldMapSlot .pixel-story-node').first().click();
    await page.waitForSelector('.pixel-story-stage', { state: 'visible', timeout: 20000 });
    const homeCalls = await page.evaluate(() => window.__pixelStoryAudioCalls || []);
    assert.equal(homeCalls.length, 3, `home map entry plus one click must add two current-line audios, got ${JSON.stringify(homeCalls)}`);
    assert.ok(homeCalls.every((src) => src.startsWith('tts:') || src.includes('/lines/')), `home map must not play whole-chapter audio: ${JSON.stringify(homeCalls)}`);
    console.log(JSON.stringify({ audioCalls: homeCalls }));
} finally {
    await browser.close();
}
