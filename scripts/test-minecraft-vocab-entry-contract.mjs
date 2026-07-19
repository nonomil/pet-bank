import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [indexSource, routerSource, runtimeLoaderSource, appSource] = await Promise.all([
    fs.readFile(path.join(ROOT, 'index.html'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/page-router.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/runtime-loader.js'), 'utf8'),
    fs.readFile(path.join(ROOT, 'js/app.js'), 'utf8')
]);

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

test('HTML contains the Minecraft vocab page container', () => {
    assertContract(
        indexSource,
        /<div\b(?=[^>]*\bid\s*=\s*["']page-minecraft-vocab["'])(?=[^>]*\bclass\s*=\s*["'][^"']*\bpage\b[^"']*["'])[^>]*>/i,
        'page-minecraft-vocab page container is missing'
    );
});

test('page router registers minecraft-vocab under the learn route', () => {
    assertContract(routerSource, /["']minecraft-vocab["']\s*:\s*["']learn["']/i, 'page router must map minecraft-vocab to learn');
    assertContract(routerSource, /["']minecraft-vocab["']\s*:\s*["']\/app\/learn\/minecraft-vocab["']/i, 'page router path for minecraft-vocab is missing');
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

test('child main navigation has a direct minecraft-vocab entry with expedition copy', () => {
    const mainNav = indexSource.match(
        /<nav\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bapp-bottom-dock\b[^"']*["'])[^>]*>[\s\S]*?<\/nav>/i
    );
    assert.ok(mainNav, 'app-bottom-dock child main navigation is missing');

    const vocabEntry = mainNav[0].match(
        /<button\b(?=[^>]*\bclass\s*=\s*["'][^"']*\bapp-dock-item\b[^"']*["'])(?=[^>]*\bdata-app-dock\s*=\s*["']minecraft-vocab["'])[^>]*>[\s\S]*?<\/button>/i
    );
    assert.ok(vocabEntry, 'child main navigation lacks a minecraft-vocab app-dock button');
    assertContract(vocabEntry[0], /switchPage\s*\(\s*["']minecraft-vocab["']\s*\)/i, 'minecraft-vocab app-dock button lacks a direct action');
    assertContract(extractTextContent(vocabEntry[0]), /单词远征|Word Quest/i, 'minecraft-vocab app-dock button text must say 单词远征 or Word Quest');
});
