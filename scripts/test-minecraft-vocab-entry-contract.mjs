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
        /<nav\b(?=[^>]*\baria-label\s*=\s*["']孩子端主导航["'])[^>]*>[\s\S]*?<\/nav>/i
    );
    assert.ok(mainNav, '孩子端主导航 nav is missing');
    assertContract(mainNav[0], /switchPage\s*\(\s*["']minecraft-vocab["']\s*\)/i, '孩子端主导航 lacks a direct minecraft-vocab action');
    assertContract(extractTextContent(mainNav[0]), /单词远征|Word Quest/i, '孩子端主导航 text must say 单词远征 or Word Quest');
});
