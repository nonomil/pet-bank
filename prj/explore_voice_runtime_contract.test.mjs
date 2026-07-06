import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const BASE = process.env.PETBANK_BASE_URL || 'http://127.0.0.1:8765';

const results = [];
function check(name, cond, detail = '') {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'} - ${name}${detail ? ` (${detail})` : ''}`);
}

const browser = await chromium.launch(browserLaunchOpts());
const page = await browser.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
    if (msg.type() === 'error') {
        const text = msg.text();
        if (/Failed to load resource|404|net::ERR/i.test(text)) return;
        consoleErrors.push(text);
    }
});
page.on('pageerror', (err) => consoleErrors.push(String(err)));

await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('petbank_voice_settings', JSON.stringify({ enabled: true, autoPlay: true }));
    window.__audioEvents = [];
    window.__audioId = 0;
    window.Audio = class FakeAudio {
        constructor(src) {
            this.src = src || '';
            this.volume = 1;
            this.onended = null;
            this.onerror = null;
            this._paused = false;
            this._id = ++window.__audioId;
            this._listeners = {};
            window.__audioEvents.push({ type: 'construct', id: this._id, src: this.src });
        }
        addEventListener(type, listener) {
            this._listeners[type] = listener;
            if (type === 'canplaythrough') {
                setTimeout(() => {
                    if (this._listeners[type]) this._listeners[type]();
                }, 0);
            }
        }
        removeEventListener(type) {
            delete this._listeners[type];
        }
        play() {
            window.__audioEvents.push({ type: 'play', id: this._id, src: this.src });
            return Promise.resolve();
        }
        pause() {
            this._paused = true;
            window.__audioEvents.push({ type: 'pause', id: this._id, src: this.src });
        }
    };
});

let releaseVoiceMap;
const voiceMapGate = new Promise((resolve) => {
    releaseVoiceMap = resolve;
});
await page.route('**/assets/voice/map.json', async (route) => {
    await voiceMapGate;
    await route.continue();
});

await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForFunction(() => typeof window.switchPage === 'function', undefined, { timeout: 15000 });

const voiceMapResponse = page.waitForResponse(
    (res) => res.url().includes('/assets/voice/map.json') && res.ok(),
    { timeout: 15000 }
).catch(() => null);

await page.evaluate(async () => {
    await window.PetBankRuntime.ensurePage('explore');
    await window.ExplorationSystem.loadScenes();
});

await page.waitForFunction(
    () => window.VoiceSystem && window.sfx && typeof window.sfx.play === 'function',
    undefined,
    { timeout: 15000 }
).catch(() => {});

const runtimeProbe = await page.evaluate(() => ({
    hasVoice: !!window.VoiceSystem,
    hasSfx: !!(window.sfx && typeof window.sfx.play === 'function')
}));
check('explore runtime exposes VoiceSystem', runtimeProbe.hasVoice, JSON.stringify(runtimeProbe));
check('explore runtime exposes semantic sfx', runtimeProbe.hasSfx, JSON.stringify(runtimeProbe));

await page.evaluate(async () => {
    await window.ExplorationDetail.show('forest');
});
await page.waitForSelector('#galgameText', { timeout: 15000 });

const pendingMapProbe = await page.evaluate(() => ({
    text: document.getElementById('galgameText')?.textContent || '',
    voicePlays: window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length
}));
check('forest scene waits for delayed voice map instead of dropping first narration', pendingMapProbe.voicePlays === 0 && pendingMapProbe.text.includes('神秘森林'), JSON.stringify(pendingMapProbe));

releaseVoiceMap();
const mapLoaded = await voiceMapResponse;
check('explore runtime loads voice map', !!mapLoaded);

await page.waitForFunction(
    () => window.__audioEvents.some((event) => event.type === 'play' && event.src.includes('assets/voice/')),
    undefined,
    { timeout: 15000 }
).catch(() => {});

const firstSceneProbe = await page.evaluate(() => ({
    text: document.getElementById('galgameText')?.textContent || '',
    voicePlays: window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length
}));
check('forest scene auto-plays first narration voice after voice map resolves', firstSceneProbe.voicePlays >= 1, JSON.stringify(firstSceneProbe));

await page.evaluate(() => window.ExplorationDetail.next());
await page.waitForFunction(
    () => window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length >= 2,
    undefined,
    { timeout: 15000 }
).catch(() => {});

const nextProbe = await page.evaluate(() => ({
    voicePlays: window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length,
    voicePauses: window.__audioEvents.filter((event) => event.type === 'pause' && event.src.includes('assets/voice/')).length,
    sfxPlays: window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/audio/sfx/')).map((event) => event.src)
}));
check('next dialogue starts a new voice clip', nextProbe.voicePlays >= 2, JSON.stringify(nextProbe));
check('next dialogue stops previous voice clip instead of queuing over it', nextProbe.voicePauses >= 1, JSON.stringify(nextProbe));
check('next dialogue triggers dialogueNext sfx', nextProbe.sfxPlays.some((src) => /dialogueNext/.test(src)), JSON.stringify(nextProbe.sfxPlays));
check('discover event triggers discover sfx', nextProbe.sfxPlays.some((src) => /discover/.test(src)), JSON.stringify(nextProbe.sfxPlays));

await page.evaluate(async () => {
    await window.ExplorationDetail.show('beach');
});
await page.waitForFunction(
    () => (document.getElementById('galgameText')?.textContent || '').includes('海浪'),
    undefined,
    { timeout: 15000 }
);
await page.waitForFunction(
    () => window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length >= 3,
    undefined,
    { timeout: 15000 }
).catch(() => {});

const switchProbe = await page.evaluate(() => ({
    text: document.getElementById('galgameText')?.textContent || '',
    voicePlays: window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length,
    voicePauses: window.__audioEvents.filter((event) => event.type === 'pause' && event.src.includes('assets/voice/')).length
}));
check('switching to another map scene auto-plays that scene voice', switchProbe.voicePlays >= 3 && switchProbe.text.includes('海浪'), JSON.stringify(switchProbe));
check('switching map scenes stops the previous voice clip', switchProbe.voicePauses >= 2, JSON.stringify(switchProbe));

await page.evaluate(() => window.ExplorationDetail.exit());
const exitProbe = await page.evaluate(() => ({
    voicePauses: window.__audioEvents.filter((event) => event.type === 'pause' && event.src.includes('assets/voice/')).length,
    hasGalgameStage: !!document.getElementById('galgameStage')
}));
check('exiting exploration story mode stops current voice clip', exitProbe.voicePauses >= 3 && !exitProbe.hasGalgameStage, JSON.stringify(exitProbe));

await page.evaluate(async () => {
    await window.ExplorationDetail.show('beach');
});
await page.waitForFunction(
    () => window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length >= 4,
    undefined,
    { timeout: 15000 }
).catch(() => {});
const reentryProbe = await page.evaluate(() => ({
    text: document.getElementById('galgameText')?.textContent || '',
    voicePlays: window.__audioEvents.filter((event) => event.type === 'play' && event.src.includes('assets/voice/')).length
}));
check('re-entering the same map scene auto-plays despite duplicate guard', reentryProbe.voicePlays >= 4 && reentryProbe.text.includes('海浪'), JSON.stringify(reentryProbe));

await page.evaluate(() => window.switchPage('home'));
const leavePageProbe = await page.evaluate(() => ({
    activePage: document.querySelector('.page.active')?.id || '',
    voicePauses: window.__audioEvents.filter((event) => event.type === 'pause' && event.src.includes('assets/voice/')).length
}));
check('leaving explore page stops current voice clip', leavePageProbe.voicePauses >= 4 && leavePageProbe.activePage === 'page-home', JSON.stringify(leavePageProbe));

check('no console errors during voice runtime flow', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();

const failed = results.filter((item) => !item.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

if (failed.length) {
    console.log('FAILURES:', failed.map((item) => item.name).join('; '));
    process.exit(1);
}
