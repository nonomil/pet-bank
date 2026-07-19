import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [indexSource, routerSource, runtimeLoaderSource, appSource, styleSource, learnCenterSource, sessionSource, pageSource] = await Promise.all([
    fs.readFile(path.join(ROOT, 'index.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/page-router.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/runtime-loader.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/app.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'css/style.css'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/learn-center.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/minecraft-vocab-session.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/minecraft-vocab-page.js'), 'utf8')
]);

const routerWindow = { location: { pathname: '/', protocol: 'http:' } };
vm.runInNewContext(routerSource, { window: routerWindow });
const router = routerWindow.PetBankPageRouter;

function extractTextContent(html) {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function assertContract(source, pattern, message) {
    assert.ok(pattern.test(source), message);
}

function countAttributeOccurrences(source, tagName, attribute, value) {
    const escapedValue = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`<${tagName}\\b[^>]*\\b${attribute}\\s*=\\s*["']${escapedValue}["'][^>]*>`, 'gi');
    return [...source.matchAll(pattern)].length;
}

function extractPageMarkup(source, pageId, nextMarker) {
    const start = source.indexOf(`<div class="page" id="${pageId}">`);
    assert.notEqual(start, -1, `${pageId} page container is missing`);
    const end = source.indexOf(nextMarker, start);
    assert.notEqual(end, -1, `${pageId} page boundary is missing`);
    return source.slice(start, end);
}

test('HTML contains the Minecraft vocab page container', () => {
    assert.equal(countAttributeOccurrences(indexSource, 'div', 'id', 'page-minecraft-vocab'), 1, 'page-minecraft-vocab page container must be unique');
    assertContract(indexSource, /<div\b(?=[^>]*\bid\s*=\s*["']page-minecraft-vocab["'])(?=[^>]*\bclass\s*=\s*["'][^"']*\bpage\b[^"']*["'])[^>]*>/i, 'page-minecraft-vocab page container is missing');
});

test('Minecraft vocab keeps the learn business tab in the app shell with its own dock tab', () => {
    assert.equal(router.getPageToTab('minecraft-vocab'), 'learn');
    assert.equal(router.getRouteShell('minecraft-vocab'), 'app');
    assert.equal(router.getAppShellSurface('minecraft-vocab'), 'focus');
    assert.equal(router.getAppDockPage('minecraft-vocab'), 'minecraft-vocab');
    assertContract(routerSource, /["']minecraft-vocab["']\s*:\s*["']\/app\/learn\/minecraft-vocab["']/i, 'page router path for minecraft-vocab must remain under learn');
    assertContract(appSource, /classList\.toggle\(\s*["']learn-mode["'][\s\S]*?page\s*===\s*["']minecraft-vocab["']/i, 'minecraft-vocab must keep the learn-mode business shell');
    assert.ok(appSource.includes('const dockPage = router.getAppDockPage(page);'), 'app shell must use the dedicated dock page mapping');
});

test('mobile child dock gives app labels a stable readable layout', () => {
    assertContract(
        styleSource,
        /\.app-dock-item\s*>\s*span\s*\{[^}]*width\s*:\s*100%[^}]*height\s*:\s*22px[^}]*white-space\s*:\s*normal[^}]*overflow-wrap\s*:\s*anywhere[^}]*overflow\s*:\s*hidden/is,
        'mobile app dock labels need fixed two-line dimensions and readable wrapping'
    );
});

test('runtime loader registers the minecraftVocab style and script bundles', () => {
    assertContract(runtimeLoaderSource, /minecraftVocab\s*:\s*\[[^\]]*minecraft-vocab\.css/i, 'minecraftVocab style bundle is missing');
    assertContract(runtimeLoaderSource, /minecraftVocab\s*:\s*\[[^\]]*minecraft-vocab-page\.js/i, 'minecraftVocab script bundle is missing');
});

test('app renders MinecraftVocabPage when minecraft-vocab is activated', () => {
    assertContract(
        appSource,
        /if\s*\(\s*page\s*===\s*["']minecraft-vocab["']\s*&&\s*window\.MinecraftVocabPage\s*\)\s*void\s+MinecraftVocabPage\.render\s*\(/i,
        'app.js must render MinecraftVocabPage on the minecraft-vocab page'
    );
});

test('Minecraft vocab page invalidates stale render and selection requests', () => {
    assertContract(pageSource, /let\s+pageGeneration\s*=\s*0/, 'Minecraft vocab page needs a render generation token');
    assertContract(pageSource, /function\s+isCurrentGeneration\s*\([^)]*\)[\s\S]*?mounted[\s\S]*?pageGeneration/, 'Minecraft vocab page needs a mounted generation guard');
    assertContract(pageSource, /function\s+stop\s*\(\)[\s\S]*?mounted\s*=\s*false[\s\S]*?pageGeneration\s*\+=\s*1[\s\S]*?selectionRequestId\s*\+=\s*1/, 'stop() must invalidate render and selection requests');
    assertContract(pageSource, /async function\s+render\s*\([^)]*[\s\S]*?const\s+generation\s*=\s*\+\+pageGeneration/, 'render() must create a new generation token');
    assert.ok((pageSource.match(/isCurrentGeneration\(generation\)/g) || []).length >= 5, 'async render paths must check the active generation after awaits');
    assertContract(pageSource, /async function\s+reloadSelection\s*\([^)]*[\s\S]*?const\s+generation\s*=\s*pageGeneration[\s\S]*?requestId\s*!==\s*selectionRequestId/, 'reloadSelection() must reject stale page generations and requests');
    assert.ok(pageSource.includes('const loadedModule = await global.MinecraftVocabLoader.loadForSelection(selectedLevelId, selectedBandId);'), 'reloadSelection must await into a local module value');
    assert.ok(pageSource.includes('if (!isCurrentGeneration(generation) || requestId !== selectionRequestId) return;\n            module = loadedModule;'), 'reloadSelection must validate before publishing the loaded module');
    assert.ok(pageSource.includes('if (!isCurrentGeneration(generation)) return;\n            if (!response.ok) throw new Error(`expedition data request failed: ${response.status}`);\n            module = loadedModule;'), 'render must validate before publishing the loaded module');
    assert.ok(pageSource.includes('mounted = false;\n        pageGeneration += 1;\n        selectionRequestId += 1;'), 'stop must invalidate both generation and selection tokens before leaving');
});

test('learning center exposes a stable secondary CTA that only navigates to minecraft-vocab', () => {
    assertContract(learnCenterSource, /data-minecraft-vocab-launch/, 'learning center Minecraft vocab CTA marker is missing');
    assertContract(
        learnCenterSource,
        /data-minecraft-vocab-launch[\s\S]*?onclick="LearnCenter\.openMinecraftVocab\(\)"[\s\S]*?(?:单词远征|Word Quest)/i,
        'learning center Minecraft vocab CTA must use the public navigation API and expedition copy'
    );
});

test('today page exposes a single secondary Minecraft vocab entry without rebuilding the expedition page', () => {
    const todayPage = extractPageMarkup(indexSource, 'page-today', '<!-- PAGE: 学习单 -->');
    const entryStart = todayPage.indexOf('id="today-minecraft-vocab-entry"');
    assert.notEqual(entryStart, -1, 'today page Minecraft vocab entry is missing');
    const entry = todayPage.slice(entryStart, todayPage.indexOf('</section>', entryStart) + '</section>'.length);
    assertContract(entry, /单词远征|Word Quest/i, 'today page entry must contain expedition copy');
    assertContract(entry, /id="today-minecraft-vocab-status"/, 'today page entry status target is missing');
    assertContract(entry, /id="today-minecraft-vocab-progress"/, 'today page entry progress target is missing');
    assertContract(
        entry,
        /<button\b(?=[^>]*\bdata-minecraft-vocab-entry-launch\b)(?=[^>]*\bonclick="switchPage\('minecraft-vocab'\)")[^>]*>/i,
        'today page CTA must navigate to the existing minecraft-vocab page'
    );
    assert.ok(!/page-minecraft-vocab|minecraft-vocab-root|MinecraftVocabPage\.render/i.test(entry), 'today page entry must not rebuild expedition page markup');
});

test('today page preloads only the side-effect-free session API before runtime bundles', () => {
    const sessionIndex = indexSource.indexOf('js/minecraft-vocab-session.js?v=1');
    const runtimeIndex = indexSource.indexOf('js/runtime-loader.js');
    assert.ok(sessionIndex >= 0, 'index.html must preload the Minecraft vocab session API');
    assert.equal(countAttributeOccurrences(indexSource, 'script', 'src', 'js/minecraft-vocab-session.js?v=1'), 1, 'index.html must preload the session API exactly once');
    assert.ok(runtimeIndex >= 0 && sessionIndex < runtimeIndex, 'session API must load before runtime-loader');
    assertContract(sessionSource, /activeProfileId\s*,\s*storageKey\s*,\s*readState[\s\S]*?isComplete/, 'session API must expose profile-aware readState and isComplete');
    assert.ok(!/document\.|querySelector|innerHTML|classList/.test(sessionSource), 'session API preload must not have DOM side effects');
});

test('runtime loader deduplicates scripts by source before loading each bundle item', () => {
    assertContract(runtimeLoaderSource, /function\s+findScript\s*\(src\)[\s\S]*?data-petbank-src[\s\S]*?getAttribute\(['"]src['"]\)[\s\S]*?resolveAssetUrl\(src\)/, 'runtime loader must find an existing script by source');
    assertContract(runtimeLoaderSource, /function\s+loadScript\s*\(src\)[\s\S]*?scriptPromises\.has\(src\)[\s\S]*?const existing\s*=\s*findScript\(src\)/, 'runtime loader must reuse the in-flight or existing script promise by source');
    assertContract(runtimeLoaderSource, /async function\s+loadSeries\s*\(items, loader\)[\s\S]*?for\s*\(const item of items \|\| \[\]\)[\s\S]*?await loader\(item\)/, 'runtime loader must load bundle items through the deduplicating loader');
});

test('app renders today expedition summary from the existing session API without writing expedition state', () => {
    assertContract(appSource, /function renderMinecraftVocabTodayEntry\s*\(\)/, 'app.js must define the today Minecraft vocab summary renderer');
    const rendererStart = appSource.indexOf('function renderMinecraftVocabTodayEntry');
    const rendererEnd = appSource.indexOf('\nfunction ', rendererStart + 10);
    const renderer = appSource.slice(rendererStart, rendererEnd === -1 ? undefined : rendererEnd);
    assertContract(renderer, /MinecraftVocabSession/, 'today summary must use MinecraftVocabSession');
    assertContract(renderer, /activeProfileId\s*\(\)/, 'today summary must read the active Profile through the session API');
    assertContract(renderer, /readState\s*\(/, 'today summary must read the existing session state');
    assertContract(renderer, /isComplete\s*\(/, 'today summary must use the existing completion API');
    assertContract(renderer, /getLocalDateKey\s*\(\)/, 'today summary must compare against the current local date');
    assertContract(renderer, /开始今日远征|继续今天的远征|重温词卡/, 'today summary must provide all session states');
    assert.ok(!/localStorage|setItem|STORAGE_PREFIX|PetBankPoints|EnglishVocabProgress|petbank_[a-z0-9_]+/i.test(renderer), 'today summary must not create or write a second state key');
    assertContract(appSource, /renderAll\s*\(\)[\s\S]*?renderMinecraftVocabTodayEntry\s*\(\)/, 'renderAll must refresh the today expedition summary');
    assertContract(appSource, /if\s*\(page\s*===\s*['"]today['"]\)[\s\S]*?renderMinecraftVocabTodayEntry\s*\(\)/, 'today page activation must refresh the expedition summary');
});

test('today expedition entry has bounded responsive styles', () => {
    assertContract(styleSource, /\.today-minecraft-vocab-entry\s*\{[\s\S]*?min-width\s*:\s*0[\s\S]*?overflow-wrap\s*:\s*anywhere/is, 'today expedition entry needs bounded wrapping styles');
    assertContract(styleSource, /\.today-minecraft-vocab-entry[\s\S]*?\.today-minecraft-vocab-entry-action[\s\S]*?min-height\s*:/is, 'today expedition CTA needs a stable button dimension');
});

test('child main navigation has a direct minecraft-vocab entry with expedition copy', () => {
    const mainNav = indexSource.match(
        /<nav\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bapp-bottom-dock\b[^"']*["'])[^>]*>[\s\S]*?<\/nav>/i
    );
    assert.ok(mainNav, 'app-bottom-dock child main navigation is missing');

    const dockMarkup = mainNav[0];
    assert.equal(countAttributeOccurrences(dockMarkup, 'button', 'data-app-dock', 'explore'), 1, 'child main navigation must contain exactly one explore entry');
    assert.equal(countAttributeOccurrences(dockMarkup, 'button', 'data-app-dock', 'minecraft-vocab'), 1, 'child main navigation must contain exactly one minecraft-vocab entry');

    const vocabEntry = dockMarkup.match(
        /<button\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bapp-dock-item\b[^"']*["'])(?=[^>]*\bdata-app-dock\s*=\s*["']minecraft-vocab["'])[^>]*>[\s\S]*?<\/button>/i
    );
    assert.ok(vocabEntry, 'child main navigation lacks a minecraft-vocab app-dock button');

    const openingTag = vocabEntry[0].match(/^<button\b[^>]*>/i);
    assert.ok(openingTag, 'minecraft-vocab app-dock button opening tag is missing');
    const onclickAttribute = openingTag[0].match(/(?:^|\s)onclick\s*=\s*(?:"([^"]*)"|'([^']*)')/i);
    assert.ok(onclickAttribute, 'minecraft-vocab app-dock button onclick attribute is missing');
    const onclickValue = onclickAttribute[1] ?? onclickAttribute[2];
    assertContract(
        onclickValue,
        /^\s*switchPage\('minecraft-vocab'\)\s*;?\s*$/,
        'minecraft-vocab app-dock button onclick must be only switchPage(\'minecraft-vocab\')'
    );
    assertContract(extractTextContent(vocabEntry[0]), /单词远征|Word Quest/i, 'minecraft-vocab app-dock button text must say 单词远征 or Word Quest');
});
