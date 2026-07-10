import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { browserLaunchOpts } from '../scripts/playwright-browser.mjs';

const PROTOTYPE_URL = process.env.WORD_MEMORY_MAP_URL
  || 'http://127.0.0.1:8000/prj/%E5%8D%95%E8%AF%8D%E8%AE%B0%E5%BF%86%E5%B0%84%E5%87%BB%E5%9C%BA%E5%8E%9F%E5%9E%8B/index.html';

async function installVoiceMocks(page, mode) {
  await page.addInitScript(({ activeMode }) => {
    const voiceEvents = [];
    const remoteVoiceEvents = [];
    const speechEvents = [];
    const realFetch = window.fetch.bind(window);

    function recordVoice(src) {
      voiceEvents.push({ src: String(src || '') });
    }

    class MockAudio {
      constructor(src = '') {
        this._src = src;
        this.onended = null;
        this.onerror = null;
      }

      set src(value) {
        this._src = value;
      }

      get src() {
        return this._src;
      }

      play() {
        recordVoice(this._src);
        if (typeof this.onended === 'function') {
          window.setTimeout(() => this.onended(), 0);
        }
        return Promise.resolve();
      }

      pause() {}
    }

    Object.defineProperty(window, '__wordMemoryVoiceEvents', {
      value: voiceEvents,
      configurable: true
    });
    Object.defineProperty(window, '__wordMemoryRemoteVoiceEvents', {
      value: remoteVoiceEvents,
      configurable: true
    });
    Object.defineProperty(window, '__wordMemorySpeechEvents', {
      value: speechEvents,
      configurable: true
    });
    Object.defineProperty(window, 'Audio', {
      value: MockAudio,
      configurable: true
    });
    Object.defineProperty(window, 'speechSynthesis', {
      value: {
        cancel() {},
        speak(utterance) {
          speechEvents.push({
            text: utterance?.text || '',
            lang: utterance?.lang || ''
          });
          if (typeof utterance?.onend === 'function') {
            window.setTimeout(() => utterance.onend(), 0);
          }
        }
      },
      configurable: true
    });
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      value: function SpeechSynthesisUtterance(text) {
        this.text = text;
        this.lang = '';
        this.rate = 1;
      },
      configurable: true
    });

    if (activeMode === 'local' || activeMode === 'fallback') {
      Object.defineProperty(window, 'WORD_MEMORY_TTS_ENDPOINT', {
        value: '',
        configurable: true
      });
    }

    if (activeMode === 'remote') {
      Object.defineProperty(window, 'WORD_MEMORY_TTS_ENDPOINT', {
        value: 'https://tts.test/tts',
        configurable: true
      });
      Object.defineProperty(window, 'fetch', {
        value(input, init) {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (/assets\/voice\/map\.json/.test(url)) {
            return Promise.resolve(new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
          if (/https:\/\/tts\.test\/tts/.test(url)) {
            let body = {};
            try {
              body = JSON.parse(init?.body || '{}');
            } catch (error) {
              body = {};
            }
            remoteVoiceEvents.push({
              text: body?.text || '',
              lang: body?.lang || '',
              voice: body?.voice || '',
              engine: body?.engine || ''
            });
            return Promise.resolve(new Response(JSON.stringify({
              audioUrl: `https://tts.test/audio/${encodeURIComponent(body?.text || 'empty')}.mp3`
            }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
          return realFetch(input, init);
        },
        configurable: true
      });
      return;
    }

    if (activeMode === 'remote-timeout') {
      Object.defineProperty(window, 'WORD_MEMORY_TTS_ENDPOINT', {
        value: 'https://tts.test/tts',
        configurable: true
      });
      Object.defineProperty(window, 'fetch', {
        value(input, init) {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (/assets\/voice\/map\.json/.test(url)) {
            return Promise.resolve(new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
          if (/https:\/\/tts\.test\/tts/.test(url)) {
            return new Promise((resolve, reject) => {
              const signal = init?.signal;
              if (!signal || typeof signal.addEventListener !== 'function') {
                return;
              }
              signal.addEventListener('abort', () => {
                reject(new DOMException('The operation was aborted.', 'AbortError'));
              }, { once: true });
            });
          }
          return realFetch(input, init);
        },
        configurable: true
      });
      return;
    }

    if (activeMode === 'loopback-refused') {
      Object.defineProperty(window, 'WORD_MEMORY_TTS_ENDPOINT', {
        value: 'http://127.0.0.1:9885/tts',
        configurable: true
      });
      Object.defineProperty(window, 'fetch', {
        value(input, init) {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (/assets\/voice\/map\.json/.test(url)) {
            return Promise.resolve(new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
          if (/127\.0\.0\.1:9885\/tts/.test(url)) {
            let body = {};
            try {
              body = JSON.parse(init?.body || '{}');
            } catch (error) {
              body = {};
            }
            remoteVoiceEvents.push({
              text: body?.text || '',
              lang: body?.lang || '',
              voice: body?.voice || '',
              engine: body?.engine || ''
            });
            return Promise.reject(new TypeError('Failed to fetch'));
          }
          return realFetch(input, init);
        },
        configurable: true
      });
      return;
    }

    if (activeMode === 'fallback') {
      Object.defineProperty(window, 'fetch', {
        value(input, init) {
          const url = typeof input === 'string' ? input : input?.url || '';
          if (/assets\/voice\/map\.json/.test(url)) {
            return Promise.resolve(new Response('{}', {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            }));
          }
          return realFetch(input, init);
        },
        configurable: true
      });
    }
  }, { activeMode: mode });
}

async function openPage(mode) {
  const browser = await chromium.launch(browserLaunchOpts());
  const page = await browser.newPage({
    viewport: { width: 1366, height: 768 },
    deviceScaleFactor: 1
  });

  await installVoiceMocks(page, mode);
  await page.goto(PROTOTYPE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.hero-sprite');
  await page.waitForFunction(() => window.__wordMemoryReady === true, null, { timeout: 5000 });
  return { browser, page };
}

async function snapshotVoice(page) {
  return page.evaluate(() => ({
    voice: window.__wordMemoryVoiceEvents.slice(),
    remote: window.__wordMemoryRemoteVoiceEvents.slice(),
    speech: window.__wordMemorySpeechEvents.slice(),
    currentMeaning: document.querySelector('#currentMeaningText')?.textContent || '',
    visibleWords: [...document.querySelectorAll('[data-target-id]')]
      .map(target => target.getAttribute('aria-label') || '')
  }));
}

async function hasLocalVoice(page, text) {
  return page.evaluate((value) => {
    const key = String(value || '').replace(/\s+/g, '').trim();
    return Boolean(window.WORD_MEMORY_VOICE_MAP && window.WORD_MEMORY_VOICE_MAP[key]);
  }, text);
}

async function firstVisibleId(page, selector, attr) {
  const value = await page.evaluate(({ selector: query, attr: attribute }) => {
    const nodes = [...document.querySelectorAll(query)];
    const viewport = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };
    const visible = nodes.find(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 0
        && rect.height > 0
        && rect.right > viewport.left
        && rect.left < viewport.right
        && rect.bottom > viewport.top
        && rect.top < viewport.bottom;
    });
    return visible?.getAttribute(attribute) || '';
  }, { selector, attr });
  assert.ok(value, `expected a visible element for ${selector}`);
  return value;
}

async function clickFirstOrb(page) {
  await page.waitForSelector('[data-orb-id]');
  const orbId = await firstVisibleId(page, '[data-orb-id]', 'data-orb-id');
  await page.locator(`[data-orb-id="${orbId}"]`).click({ force: true });
  await page.waitForSelector('.hero-carry-orb');
  return orbId;
}

{
  const { browser, page } = await openPage('local');
  const orbId = await firstVisibleId(page, '[data-orb-id]', 'data-orb-id');
  assert.ok(orbId, 'expected an orb id to exist');

  await clickFirstOrb(page);
  await page.waitForTimeout(240);

  const afterPickup = await snapshotVoice(page);
  assert.ok(afterPickup.voice.length + afterPickup.speech.length >= 1, 'picking up a meaning orb should speak the meaning');
  if (await hasLocalVoice(page, afterPickup.currentMeaning)) {
    assert.ok(afterPickup.voice.length >= 1, 'pickup should prefer local audio when that meaning has an mp3');
    assert.equal(afterPickup.speech.length, 0, 'pickup voice should not fall back to browser speech when local audio exists');
  } else {
    assert.ok(afterPickup.speech.length >= 1, 'pickup should use browser speech when the large external deck has no local mp3');
  }

  await page.locator('#speakButton').click({ force: true });
  await page.waitForTimeout(260);

  const afterSpeak = await snapshotVoice(page);
  assert.ok(afterSpeak.voice.length + afterSpeak.speech.length >= 3, 'speak button should replay visible words using local audio or speech fallback');
  const visibleLocalFlags = await Promise.all(afterSpeak.visibleWords.map(word => hasLocalVoice(page, word)));
  if (visibleLocalFlags.some(Boolean)) {
    assert.ok(afterSpeak.voice.length >= 1, 'speak button should prefer local audio for visible words that have mp3 assets');
  }
  assert.ok(
    afterSpeak.voice.every(event => /assets\/voice\/[a-f0-9]{32}\.mp3/i.test(event.src)),
    `expected local voice playback to use prototype mp3 assets, got: ${afterSpeak.voice.map(event => event.src).join(', ')}`
  );

  await browser.close();
}

{
  const { browser, page } = await openPage('remote');
  const orbId = await firstVisibleId(page, '[data-orb-id]', 'data-orb-id');
  assert.ok(orbId, 'expected an orb id to exist in remote mode');

  await clickFirstOrb(page);
  await page.waitForTimeout(240);

  const afterPickup = await snapshotVoice(page);
  assert.ok(afterPickup.remote.length >= 1, 'remote mode should request unified tts when local mp3 is unavailable');
  assert.ok(
    afterPickup.voice.every(event => !/assets\/voice\/[a-f0-9]{32}\.mp3/i.test(event.src)),
    'remote mode should not resolve to packaged local mp3 assets when the map is empty'
  );
  assert.ok(
    afterPickup.voice.some(event => /https:\/\/tts\.test\/audio\//.test(event.src)),
    'remote mode should play the audio returned by the configured tts endpoint'
  );
  assert.equal(afterPickup.speech.length, 0, 'remote mode should not fall back to browser speech when tts endpoint succeeds');
  assert.equal(afterPickup.remote[0].lang, 'zh-CN', 'pickup meaning should preserve Chinese lang for remote tts');

  await page.locator('#speakButton').click({ force: true });
  await page.waitForTimeout(260);

  const afterSpeak = await snapshotVoice(page);
  assert.ok(afterSpeak.remote.length >= 3, 'speak button should also use remote tts for visible words');
  assert.ok(afterSpeak.remote.some(event => event.lang === 'en-US'), 'visible word playback should preserve English lang for remote tts');

  await browser.close();
}

{
  const { browser, page } = await openPage('fallback');
  const orbId = await firstVisibleId(page, '[data-orb-id]', 'data-orb-id');
  assert.ok(orbId, 'expected an orb id to exist in fallback mode');

  await clickFirstOrb(page);
  await page.waitForTimeout(240);

  const afterPickup = await snapshotVoice(page);
  assert.equal(afterPickup.voice.length, 0, 'fallback mode should not have local mp3 playback');
  assert.ok(afterPickup.speech.length >= 1, 'fallback mode should use browser speech when local map is unavailable');

  await browser.close();
}

{
  const { browser, page } = await openPage('remote-timeout');
  await clickFirstOrb(page);
  await page.waitForTimeout(2800);

  const afterPickup = await snapshotVoice(page);
  assert.equal(afterPickup.voice.length, 0, 'timeout mode should not reach a playable remote audio url');
  assert.ok(afterPickup.speech.length >= 1, 'timeout mode should fall back to browser speech when remote tts stalls');

  await browser.close();
}

{
  const { browser, page } = await openPage('loopback-refused');
  await clickFirstOrb(page);
  await page.waitForTimeout(240);
  await page.locator('#speakButton').click({ force: true });
  await page.waitForTimeout(260);

  const snapshot = await snapshotVoice(page);
  assert.equal(snapshot.remote.length, 1, 'loopback tts should stop retrying after the first refused local request');
  assert.ok(snapshot.speech.length >= 2, 'loopback tts refusal should continue with browser speech fallback');

  await browser.close();
}

console.log('PASS - word memory map voice playback');
